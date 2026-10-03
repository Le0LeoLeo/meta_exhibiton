import { defineConfig } from '@playwright/test';
import base from '../playwright.config';

export default defineConfig({
  ...base,
  testDir: '.',
  outputDir: '../.tmp/cv-browser-results',
  projects: [{ name: 'cv-workspace', testMatch: '**/cv-workspace.spec.ts' }],
  webServer: {
    command: 'node scripts/start-browser-acceptance.mjs',
    cwd: '..',
    url: 'http://127.0.0.1:5193/login',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
