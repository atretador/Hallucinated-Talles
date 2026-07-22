import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    include: [
      'src/renderer/src/__tests__/**/*.test.{ts,tsx}',
      'src/main/__tests__/**/*.test.{ts,tsx}',
    ],
  },
});
