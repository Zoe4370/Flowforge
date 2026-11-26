import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateDashboard, isRateLimited, resetRateLimiter } from '../server/generate';

const spec = { title: 'Weekly plan', widgets: [1, 2, 3].map((n) => ({ type: 'kpi', title: `K${n}`, value: String(n) })) };
const geminiReply = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
const env = { GEMINI_API_KEY: 'test-key' };

beforeEach(() => {
  resetRateLimiter();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('generateDashboard', () => {
  it('returns 400 for an invalid request', async () => {
    expect((await generateDashboard({ goal: '' }, 'a', env)).status).toBe(400);
  });
  it('returns 503 when no API key is configured', async () => {
    expect((await generateDashboard({ goal: 'plan my week' }, 'a', {})).status).toBe(503);
  });
  it('returns a validated spec and keeps the key out of the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiReply(JSON.stringify(spec)));
    const result = await generateDashboard({ goal: 'plan my week' }, 'a', env, fetchMock as unknown as typeof fetch);
    expect(result.status).toBe(200);
    expect(JSON.stringify(result.body)).not.toContain('test-key');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain('test-key');
    expect((init as RequestInit).headers).toMatchObject({ 'x-goog-api-key': 'test-key' });
  });
  it('strips markdown fences from the model reply', async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiReply('```json\n' + JSON.stringify(spec) + '\n```'));
    expect((await generateDashboard({ goal: 'plan my week' }, 'a', env, fetchMock as unknown as typeof fetch)).status).toBe(200);
  });
  it('retries once when the first reply fails validation', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(geminiReply('{"title":"x"}')).mockResolvedValueOnce(geminiReply(JSON.stringify(spec)));
    const result = await generateDashboard({ goal: 'plan my week' }, 'a', env, fetchMock as unknown as typeof fetch);
    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('fails safely after two invalid replies', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => geminiReply('not json'));
    expect((await generateDashboard({ goal: 'plan my week' }, 'a', env, fetchMock as unknown as typeof fetch)).status).toBe(502);
  });
  it('maps an upstream error to 502 without leaking details', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('quota exceeded for key test-key', { status: 429 }));
    const result = await generateDashboard({ goal: 'plan my week' }, 'a', env, fetchMock as unknown as typeof fetch);
    expect(result.status).toBe(502);
    expect(JSON.stringify(result.body)).not.toContain('quota');
  });
});

describe('isRateLimited', () => {
  it('blocks the 21st request in a minute per client', () => {
    for (let i = 0; i < 20; i++) expect(isRateLimited('x', 1_000)).toBe(false);
    expect(isRateLimited('x', 1_000)).toBe(true);
    expect(isRateLimited('other', 1_000)).toBe(false);
  });
  it('recovers after the window passes', () => {
    for (let i = 0; i < 20; i++) isRateLimited('y', 1_000);
    expect(isRateLimited('y', 62_000)).toBe(false);
  });
});
