import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateDashboard, getProviderHealth, isRateLimited, resetRateLimiter } from '../server/generate.js';
import { handleGenerate, handleHealth } from '../server/http.js';

const spec = { title: 'Weekly plan', widgets: [1, 2, 3].map((n) => ({ type: 'kpi', title: `K${n}`, value: String(n) })) };
const geminiReply = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
const hfReply = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });
const geminiEnv = { GEMINI_API_KEY: 'test-gemini-key' };
const hfEnv = { HF_TOKEN: 'hf_test_token' };

beforeEach(() => {
  resetRateLimiter();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('generateDashboard', () => {
  it('returns 400 for an invalid request', async () => {
    expect((await generateDashboard({ goal: '' }, 'a', geminiEnv)).status).toBe(400);
  });

  it('returns 503 when requireCloud is true and no API key is configured', async () => {
    expect((await generateDashboard({ goal: 'plan my week', requireCloud: true }, 'a', {})).status).toBe(503);
  });

  it('synthesizes a real validated dashboard locally when no cloud API key is configured', async () => {
    const csv = 'Month,Revenue,Users\nJan,$1000,50\nFeb,$1500,80\nMar,$2000,110';
    const result = await generateDashboard({ goal: 'Analyze SaaS revenue', sourceData: csv }, 'a', {});
    expect(result.status).toBe(200);
    expect(result.provider).toBe('local');
    const serialized = JSON.stringify(result.body);
    expect(serialized).toContain('$4,500');
  });

  it('calls Hugging Face Inference Router when HF_TOKEN is configured and hides the token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(hfReply(JSON.stringify(spec)));
    const result = await generateDashboard({ goal: 'plan my week' }, 'a', hfEnv, fetchMock as unknown as typeof fetch);
    expect(result.status).toBe(200);
    expect(result.provider).toBe('huggingface');
    expect(JSON.stringify(result.body)).not.toContain('hf_test_token');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('router.huggingface.co/v1/chat/completions');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer hf_test_token' });
  });

  it('returns a validated Gemini spec and keeps the key out of the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiReply(JSON.stringify(spec)));
    const result = await generateDashboard({ goal: 'plan my week' }, 'a', geminiEnv, fetchMock as unknown as typeof fetch);
    expect(result.status).toBe(200);
    expect(result.provider).toBe('gemini');
    expect(JSON.stringify(result.body)).not.toContain('test-gemini-key');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain('test-gemini-key');
    expect(String(url)).toContain('gemini-2.5-flash');
    expect((init as RequestInit).headers).toMatchObject({ 'x-goog-api-key': 'test-gemini-key' });
  });

  it('strips markdown fences from the model reply', async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiReply('```json\n' + JSON.stringify(spec) + '\n```'));
    expect((await generateDashboard({ goal: 'plan my week' }, 'a', geminiEnv, fetchMock as unknown as typeof fetch)).status).toBe(200);
  });

  it('retries once when the first reply fails validation', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(geminiReply('{"title":"x"}')).mockResolvedValueOnce(geminiReply(JSON.stringify(spec)));
    const result = await generateDashboard({ goal: 'plan my week' }, 'a', geminiEnv, fetchMock as unknown as typeof fetch);
    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails safely in strict cloud mode after two invalid replies', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => geminiReply('not json'));
    expect((await generateDashboard({ goal: 'plan my week', requireCloud: true }, 'a', geminiEnv, fetchMock as unknown as typeof fetch)).status).toBe(502);
  });

  it('maps an upstream error to 502 in strict cloud mode without leaking details', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('quota exceeded for key test-gemini-key', { status: 429 }));
    const result = await generateDashboard({ goal: 'plan my week', requireCloud: true }, 'a', geminiEnv, fetchMock as unknown as typeof fetch);
    expect(result.status).toBe(502);
    expect(JSON.stringify(result.body)).not.toContain('quota');
  });

  it('falls back gracefully to smart local synthesis when upstream fails in default mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('upstream error', { status: 503 }));
    const result = await generateDashboard({ goal: 'SaaS financial dashboard' }, 'a', geminiEnv, fetchMock as unknown as typeof fetch);
    expect(result.status).toBe(200);
    expect(result.provider).toBe('local-fallback');
  });
});

describe('getProviderHealth', () => {
  it('reports configured providers without exposing keys', () => {
    const health = getProviderHealth({ HF_TOKEN: 'secret-hf' });
    expect(health.providers.huggingface).toBe(true);
    expect(health.providers.local).toBe(true);
    expect(health.defaultProvider).toBe('huggingface');
    expect(JSON.stringify(health)).not.toContain('secret-hf');
  });
});

describe('isRateLimited', () => {
  it('blocks the 31st request in a minute per client', () => {
    for (let i = 0; i < 30; i++) expect(isRateLimited('x', 1_000)).toBe(false);
    expect(isRateLimited('x', 1_000)).toBe(true);
    expect(isRateLimited('other', 1_000)).toBe(false);
  });

  it('recovers after the window passes', () => {
    for (let i = 0; i < 30; i++) isRateLimited('y', 1_000);
    expect(isRateLimited('y', 62_000)).toBe(false);
  });
});

function mockReq(method: string, body?: string, headers: Record<string, string> = {}): IncomingMessage {
  const stream = Readable.from(body ? [Buffer.from(body)] : []) as unknown as IncomingMessage;
  stream.method = method;
  stream.headers = headers;
  (stream as unknown as { socket: { remoteAddress: string } }).socket = { remoteAddress: '127.0.0.1' };
  return stream;
}

function mockRes() {
  const headers: Record<string, string> = {};
  let raw = '';
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader(k: string, v: string) { headers[k.toLowerCase()] = v; },
    end(chunk?: string) { if (chunk) raw += chunk; res.headersSent = true; },
  };
  return { res: res as unknown as ServerResponse, headers, json: () => JSON.parse(raw) };
}

describe('HTTP handlers', () => {
  it('rejects non-POST on handleGenerate with 405 JSON', async () => {
    const { res, headers, json } = mockRes();
    await handleGenerate(mockReq('GET'), res, {});
    expect(res.statusCode).toBe(405);
    expect(headers['content-type']).toContain('application/json');
    expect(json().error).toBe('Use POST.');
  });

  it('rejects malformed JSON on handleGenerate with 400 JSON', async () => {
    const { res, json } = mockRes();
    await handleGenerate(mockReq('POST', '{invalid'), res, {});
    expect(res.statusCode).toBe(400);
    expect(json().error).toContain('JSON');
  });

  it('returns provider metadata headers and valid spec on handleGenerate', async () => {
    const { res, headers, json } = mockRes();
    await handleGenerate(mockReq('POST', JSON.stringify({ goal: 'SaaS financial KPIs' })), res, {});
    expect(res.statusCode).toBe(200);
    expect(headers['x-flowforge-provider']).toBe('local');
    expect(Array.isArray(json().widgets)).toBe(true);
  });

  it('returns live provider health JSON on handleHealth', async () => {
    const { res, json } = mockRes();
    await handleHealth(mockReq('GET'), res, { HF_TOKEN: 'hf_abc' });
    expect(res.statusCode).toBe(200);
    expect(json().ok).toBe(true);
    expect(json().providers.huggingface).toBe(true);
  });
});
