import { defineConfig } from '@playwright/test';
import base from '../playwright.config';

export default defineConfig({
  ...base,
  testDir: '.',
  outputDir: '../.tmp/competition-browser-results',
  projects: [{ name: 'competition', testMatch: '**/competition.spec.ts', use: { launchOptions: { args: ['--disable-webgl'] } } }],
  webServer: {
    command: 'node scripts/start-browser-acceptance.mjs',
    cwd: '..',
    url: 'http://127.0.0.1:5193/login',
    reuseExistingServer: false,
    timeout: 60_000,
    env: { METAEXB_SKILL_AI_ACCEPTANCE: '1' },
  },
});
