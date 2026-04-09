import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    //@ts-ignore
    base: process.env.NODE_ENV === 'development' ? './' : "/sendbox/",
    server: {
        port: 5819,
        proxy: {
            '/api': {
                target: 'http://localhost:5820',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'build',
    },
});
