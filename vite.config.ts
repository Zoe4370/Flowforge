import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleGenerate } from './server/http';

// Serves /api/generate during `pnpm dev` with the same handler Vercel runs in production.
function devApi(env: Record<string, string>): Plugin {
  return {
    name: 'flowforge-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/generate', (req, res) => void handleGenerate(req, res, env));
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), devApi(loadEnv(mode, process.cwd(), ''))],
  server: { allowedHosts: ['.us5.manus.computer'] },
  build: {
    rollupOptions: {
      output: { manualChunks: { motion: ['framer-motion'], react: ['react', 'react-dom'] } },
    },
  },
}));
