import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleGenerate } from '../server/http';

// Vercel Node.js Function: POST /api/generate
export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleGenerate(req, res);
}
