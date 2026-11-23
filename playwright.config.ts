import fs from 'node:fs';
import { defineConfig } from '@playwright/test';

const preinstalledChromium =
  '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    headless: true,
    trace: 'retain-on-failure',
    launchOptions: fs.existsSync(preinstalledChromium)
      ? { executablePath: preinstalledChromium }
      : undefined,
  },
  webServer: {
    command: 'npx tsx tests/e2e/server-runner.ts',
    url: 'http://127.0.0.1:3100/api/health',
    reuseExistingServer: false,
    timeout: 45000,
  },
});
