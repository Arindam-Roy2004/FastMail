import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_TARGET = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
      '/admin': { target: API_TARGET, changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Vendor chunks change rarely, so they cache across deploys.
        manualChunks(id) {
          if (id.includes('@tiptap') || id.includes('prosemirror')) return 'editor';
          if (id.includes('radix-ui') || id.includes('@radix-ui') || id.includes('sonner')) return 'ui';
          return undefined;
        },
      },
    },
  },
});
