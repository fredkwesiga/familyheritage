import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  optimizeDeps: {
    // @fh/shared is a linked workspace package, and Vite skips dependency
    // pre-bundling for linked packages by default. Because our build output is
    // CommonJS, that leaves Vite converting it on the fly on every cold start.
    // Naming it here gets it pre-bundled with everything else.
    include: ['@fh/shared'],
  },
  server: {
    port: 5173,
    // The dev proxy means the browser only ever talks to one origin. No CORS in
    // development, and relative '/api/v1/...' paths work unchanged in production.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});