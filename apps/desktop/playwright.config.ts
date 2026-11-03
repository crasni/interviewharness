import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // CI's Windows runners are at times several times slower than usual; 5 s was too short there for a round's
  // first line to show.
  expect: { timeout: 10_000 },
});
