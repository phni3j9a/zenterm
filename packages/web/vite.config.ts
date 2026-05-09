import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/web/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../gateway/public/web'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        // Put hashed assets under /web/assets/ so gateway's web.ts SPA fallback
        // can distinguish them from client-routed paths.
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:18765',
      '/ws': { target: 'ws://localhost:18765', ws: true },
    },
  },
});
