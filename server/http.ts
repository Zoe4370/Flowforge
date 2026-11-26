import type { IncomingMessage, ServerResponse } from 'node:http';
import { generateDashboard, getProviderHealth, type Env, type UserKeys } from './generate.js';

const MAX_BODY_BYTES = 64 * 1024;

function clientId(req: IncomingMessage): string {
  // Vercel supplies x-vercel-forwarded-for at the edge. Fall back to the
  // conventional header for local adapters, then to the socket address.
  const forwarded = req.headers['x-vercel-forwarded-for'] ?? req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || req.socket?.remoteAddress || 'unknown';
}

function headerStr(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers[name];
  const val = Array.isArray(raw) ? raw[0] : raw;
  return typeof val === 'string' && val.trim() ? val.trim().slice(0, 256) : undefined;
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const preParsed = (req as IncomingMessage & { body?: unknown }).body;
  if (preParsed !== undefined && preParsed !== null && preParsed !== '') {
    return typeof preParsed === 'string' ? JSON.parse(preParsed) : preParsed;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buf.length;
    if (size > MAX_BODY_BYTES) throw new RangeError('payload too large');
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) throw new SyntaxError('empty body');
  return JSON.parse(raw);
}

function send(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders?: Record<string, string | undefined>,
): void {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      if (v) res.setHeader(k, v);
    }
  }
  res.end(JSON.stringify(body));
}

/** Framework-free handler shared by the Vercel function and the Vite dev server. */
export async function handleGenerate(req: IncomingMessage, res: ServerResponse, env: Env = process.env): Promise<void> {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return send(res, 405, { error: 'Use POST.' });
    }
    const contentType = headerStr(req, 'content-type');
    if (contentType && !/^application\/json(?:\s*;|$)/i.test(contentType)) {
      return send(res, 415, { error: 'Content-Type must be application/json.' });
    }
    let body: unknown;
    try {
      body = await readBody(req);
    } catch (err) {
      return err instanceof RangeError
        ? send(res, 413, { error: 'That request is too large.' })
        : send(res, 400, { error: 'Request body must be valid JSON.' });
    }
    const userKeys: UserKeys = {
      hfToken: headerStr(req, 'x-hf-token'),
      geminiKey: headerStr(req, 'x-gemini-key'),
    };
    const result = await generateDashboard(body, clientId(req), env, fetch, userKeys);
    send(res, result.status, result.body, {
      'X-FlowForge-Provider': result.provider,
      'X-FlowForge-Model': result.model,
    });
  } catch (err) {
    console.error('Unhandled handleGenerate error:', err instanceof Error ? err.message : 'unknown');
    send(res, 500, { error: 'Unexpected workspace server error. Please retry.' });
  }
}

export async function handleHealth(req: IncomingMessage, res: ServerResponse, env: Env = process.env): Promise<void> {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return send(res, 405, { error: 'Use GET.' });
    }
    send(res, 200, getProviderHealth(env));
  } catch (err) {
    console.error('Unhandled handleHealth error:', err instanceof Error ? err.message : 'unknown');
    send(res, 500, { ok: false, error: 'Health check failed.' });
  }
}
