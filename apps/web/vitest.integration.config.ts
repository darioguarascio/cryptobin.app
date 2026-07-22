import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = dirname(fileURLToPath(import.meta.url));

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5432/cryptobin_test';

const ci = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(rootDir, 'src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.integration.test.ts'],
    fileParallelism: false,
    reporters: ci ? ['default', 'junit', 'json'] : ['default'],
    outputFile: ci
      ? {
          junit: 'test-results/integration/junit.xml',
          json: 'test-results/integration/results.json',
        }
      : undefined,
    env: {
      DATABASE_URL: testDatabaseUrl,
      TEST_DATABASE_URL: testDatabaseUrl,
      NODE_ENV: 'test',
      NOTIFICATIONS_SYNC: '1',
      EMAILS_SYNC: '1',
      MODERATION_SYNC: '1',
      PROFILE_VIEWS_SYNC: '1',
      TELEGRAM_SYNC: '1',
    },
  },
});
