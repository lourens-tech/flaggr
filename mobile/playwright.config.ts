import { defineConfig } from '@playwright/test';

// Automated click-through of the member app (see docs/Member-App-Functionality-Inventory.md).
// `npm run e2e` exports the web build pointed at the sample-data mock API, then runs every spec in e2e/.
// One worker: the specs share the mock's state and reset it before each test.
const API_PORT = Number(process.env.E2E_API_PORT ?? 4020);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 8090);
const WEB_DIR = process.env.E2E_WEB_DIR ?? '.web';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: `e2e/.report${WEB_DIR === '.web' ? '' : '-' + WEB_DIR.replace('.web-', '')}`, open: 'never' }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    colorScheme: 'light',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  outputDir: `e2e/.results${WEB_DIR === '.web' ? '' : '-' + WEB_DIR.replace('.web-', '')}`,
  webServer: [
    { command: `E2E_API_PORT=${API_PORT} npx tsx e2e/mock-api/server.ts`, port: API_PORT, reuseExistingServer: false, timeout: 60_000 },
    { command: `E2E_WEB_PORT=${WEB_PORT} E2E_WEB_DIR=${WEB_DIR} npx tsx e2e/serve-web.ts`, port: WEB_PORT, reuseExistingServer: false, timeout: 60_000 },
  ],
});
