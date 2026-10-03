import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, retries: 0, timeout: 90_000,
  expect: { timeout: 15_000 }, outputDir: '.tmp/browser-results', reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5193', viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'workflow-2d', testMatch: ['**/reliability.spec.ts', '**/analytics.spec.ts', '**/audit-recovery.spec.ts'], use: { launchOptions: { args: ['--disable-webgl'] } } },
    { name: 'webgl', testMatch: ['**/collaboration-recovery.spec.ts', '**/public-webgl.spec.ts', '**/editor-ai-builder.spec.ts'],
      use: { launchOptions: { channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } } },
  ],
  webServer: { command: 'node scripts/start-browser-acceptance.mjs', url: 'http://127.0.0.1:5193/login', reuseExistingServer: false, timeout: 60_000 },
});
