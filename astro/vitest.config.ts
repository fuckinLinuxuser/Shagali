import { defineConfig } from 'vitest/config';

// e2e (Playwright) запускается отдельно: npm run test:e2e
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], exclude: ['tests/e2e/**', 'node_modules/**'] },
});
