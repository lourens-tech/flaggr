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

/**
 * Go to a member screen the way a member does from a tab screen. The four tabs
 * are Home, Course, Rewards and Profile; My Golf opens from Home's "My Golf"
 * link (always shown) and Reward Activity from Profile's "Reward Activity" row.
 */
export async function tab(page: Page, label: 'Home' | 'Course' | 'My Golf' | 'Rewards' | 'Activity' | 'Profile') {
  if (label === 'My Golf') {
    await tab(page, 'Home');
    await page.getByRole('link', { name: 'My Golf', exact: true }).filter({ visible: true }).first().click();
    return;
  }
  if (label === 'Activity') {
    await tab(page, 'Profile');
    await page.getByRole('button', { name: 'Reward Activity', exact: true }).filter({ visible: true }).first().click();
    return;
  }
  // Pushed screens have no tab bar (it slides away): go Back to the tabs first, as a member would.
  const bar = page.getByRole('tablist');
  const back = page.getByRole('button', { name: /^(Back|Close)$/ }).filter({ visible: true });
  for (let i = 0; i < 4; i++) {
    await expect(bar.or(back).first()).toBeVisible();
    if (await bar.isVisible()) break;
    await back.first().click();
  }
  const t = page.getByRole('tab', { name: label });
  // Tapping the tab you're already on scrolls it to the top (Bento), so only tap to switch:
  // a lit tab with a Back button showing (My Golf lights Course) still needs the tap.
  const lit = (await t.getAttribute('aria-selected')) === 'true';
  if (!lit || (await back.count()) > 0) await t.click();
}
