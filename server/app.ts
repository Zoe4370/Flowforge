import express from 'express';
import { generateHandler } from './generate';

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.post('/api/generate', generateHandler);
