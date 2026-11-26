import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleGenerate } from '../server/http.js';

// Vercel Node.js Function: POST /api/generate
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    await handleGenerate(req, res);
  } catch (err) {
    console.error('api/generate fatal error:', err instanceof Error ? err.message : 'unknown');
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Workspace service encountered an unexpected error.' }));
    }
  }
}
