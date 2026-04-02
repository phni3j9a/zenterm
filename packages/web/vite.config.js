import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig(({ command }) => ({
    plugins: [react()],
    base: command === 'build' ? '/app/' : '/',
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
    server: {
        port: 5173,
        proxy: {
            '/api': 'http://localhost:18765',
            '/ws': {
                target: 'ws://localhost:18765',
                ws: true,
            },
        },
    },
    build: {
        outDir: '../gateway/public/app',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    xterm: ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-unicode11'],
                },
            },
        },
    },
}));
