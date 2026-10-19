import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Integration tests start real PostgreSQL and Redis containers with Testcontainers (Docker required).
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/integration/**/*.int-spec.ts'],
    environment: 'node',
    globalSetup: ['test/integration/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});
