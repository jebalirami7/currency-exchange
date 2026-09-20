import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `RateService` reads a cached snapshot from localStorage on construction,
    // so the service tests need a DOM-like environment.
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
});
