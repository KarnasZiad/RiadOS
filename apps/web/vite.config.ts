/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Same origin as the API in development, exactly like behind Nginx in production:
    // the refresh cookie stays SameSite=Strict and no CORS preflight is needed.
    proxy: { '/api': 'http://localhost:3000' },
  },
  build: {
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/**/*.spec.{ts,tsx}', 'src/lib/types.ts'],
      reporter: ['text-summary', 'lcov', 'html'],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 75 },
    },
  },
});
