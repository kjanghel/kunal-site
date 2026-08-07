import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'retain-on-failure',
  },
  // Server lifecycle is managed by pretest:e2e / posttest:e2e in package.json:
  // Astro 7's `astro dev` daemonizes by default, which Playwright's webServer
  // spawner would interpret as an early exit. The pretest hook starts (or
  // reuses) the daemon and Playwright then connects directly.
});
