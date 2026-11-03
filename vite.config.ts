/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento, /api/* vai para as Pages Functions (wrangler pages dev, porta 8788).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8788' },
  },
  build: { outDir: 'dist' },
  test: { include: ['shared/**/*.test.ts', 'src/**/*.test.ts', 'functions/**/*.test.ts'] },
});
