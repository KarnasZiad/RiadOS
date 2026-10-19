import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC emits decorator metadata, which NestJS dependency injection relies on.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/main.ts',
        'src/**/*.module.ts',
        'src/**/*.spec.ts',
        'src/testing/**',
        'src/infrastructure/prisma/prisma.service.ts',
      ],
      reporter: ['text-summary', 'lcov', 'html'],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 75 },
    },
  },
});
