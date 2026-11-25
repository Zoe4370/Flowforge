import { createServer as createViteServer } from 'vite';
import { resolve } from 'node:path';
import { app } from './app';

app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok' }));

if (process.env.NODE_ENV === 'production') {
  const dist = resolve(process.cwd(), 'dist');
  app.use((await import('express')).default.static(dist));
  app.get(/.*/, (_req, res) => res.sendFile(resolve(dist, 'index.html')));
} else {
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

const port = Number(process.env.PORT) || 3000;
app.listen(port, '0.0.0.0', () => console.log(`FlowForge listening on 0.0.0.0:${port}`));
