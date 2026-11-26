import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleHealth } from '../server/http.js';

// Vercel Node.js Function: GET /api/health
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    await handleHealth(req, res);
  } catch (err) {
    console.error('api/health fatal error:', err instanceof Error ? err.message : 'unknown');
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: 'Health check failed.' }));
    }
  }
}
