import type { IncomingMessage, ServerResponse } from 'node:http';
import { generateDashboard, type Env } from './generate';

const MAX_BODY_BYTES = 64 * 1024; // goal (500) + prior spec + 12 KB CSV fits comfortably

function clientId(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || req.socket.remoteAddress || 'unknown';
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const preParsed = (req as IncomingMessage & { body?: unknown }).body;
  if (preParsed !== undefined) return typeof preParsed === 'string' ? JSON.parse(preParsed) : preParsed;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new RangeError('payload too large');
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

/** Framework-free handler shared by the Vercel function and the Vite dev server. */
export async function handleGenerate(req: IncomingMessage, res: ServerResponse, env: Env = process.env): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Use POST.' });
  }
  let body: unknown;
  try {
    body = await readBody(req);
  } catch (err) {
    return err instanceof RangeError ? send(res, 413, { error: 'That request is too large.' }) : send(res, 400, { error: 'Request body must be valid JSON.' });
  }
  const result = await generateDashboard(body, clientId(req), env);
  send(res, result.status, result.body);
}
