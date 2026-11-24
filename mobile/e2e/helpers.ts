import { expect, type Page } from '@playwright/test';

// Shared helpers for the click-through specs. Test-only sample account and
// codes live in e2e/mock-api/server.ts.
export const API = `http://localhost:${process.env.E2E_API_PORT ?? 4020}`;
export const TEST_EMAIL = 'demo@flagrr.test';
export const TEST_PASSWORD = 'Golf2026!x';
export const RESET_CODE = '123456';
export const TOKEN = 'e2e-demo-token';

/** Put the mock back to its seed data and default scenario. Call in beforeEach. */
export async function reset(page: Page) {
  await page.request.post(`${API}/api/__reset`);
}

/** Switch mock scenarios, e.g. { scan: 'dup' }, { noRewards: true }, { fail: { 'POST /api/redeem': 500 } }. */
export async function scenario(page: Page, s: Record<string, unknown>) {
  await page.request.post(`${API}/api/__scenario`, { data: s });
}

/** Open the app already signed in (as if "Keep me logged in" was on), optionally in dark mode. */
export async function openSignedIn(page: Page, opts: { theme?: 'light' | 'dark' | 'system' } = {}) {
  await page.addInitScript(([token, theme]) => {
    try {
      localStorage.setItem('flagrr_auth_token', token);
      if (theme) localStorage.setItem('flagrr_theme_preference', theme);
    } catch { /* ignore */ }
  }, [TOKEN, opts.theme ?? ''] as const);
  await page.goto('/');
  await expect(page.getByText('Flagrr Cash').first()).toBeVisible();
}

/** Open the app signed out (Landing). */
export async function openSignedOut(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.removeItem('flagrr_auth_token'); } catch { /* ignore */ }
  });
  await page.goto('/');
}

/** The app's own alert card (AppAlertHost): returns a locator scoped to the dialog. */
export function appAlert(page: Page) {
  return page.getByRole('alertdialog').or(page.locator('[aria-modal="true"]')).last();
}

/** Tap a tab in the member tab bar by its label. */
export async function tab(page: Page, label: 'Home' | 'Course' | 'My Golf' | 'Rewards' | 'Activity' | 'Profile') {
  await page.getByRole('tab', { name: label }).or(page.getByRole('button', { name: label, exact: true })).first().click();
}
