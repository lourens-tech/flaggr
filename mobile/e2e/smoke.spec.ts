import { test, expect } from '@playwright/test';
import { openSignedIn, openSignedOut, reset, TEST_EMAIL, TEST_PASSWORD } from './helpers';

// Smoke: the harness itself works (mock API, web export, sign-in, tabs).
test.beforeEach(async ({ page }) => reset(page));

test('signed out, the app opens on Landing with its three ways in', async ({ page }) => {
  await openSignedOut(page);
  await expect(page.getByText('Get Started')).toBeVisible();
  await expect(page.getByText('I already have an account')).toBeVisible();
});

test('log in with the sample account reaches Home', async ({ page }) => {
  await openSignedOut(page);
  await page.getByText('I already have an account').click();
  await page.getByPlaceholder('Email').fill(TEST_EMAIL);
  await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
  await page.getByText('Login', { exact: true }).last().click();
  await expect(page.getByText('Flagrr Cash').first()).toBeVisible();
});

test('signed in, every tab opens', async ({ page }) => {
  await openSignedIn(page);
  for (const label of ['Course', 'Rewards', 'Profile', 'Home']) {
    await page.getByText(label, { exact: true }).last().click();
    await expect(page).toHaveURL(/.*/);
  }
  await expect(page.getByText('Flagrr Cash').first()).toBeVisible();
});

// Web regression (found 25 Nov 2026): @react-navigation/stack put the focused card in "page" mode
// (min-height 100%) expecting the browser page to scroll, but Expo's web body never scrolls, so
// pushed screens could not be scrolled at all. headerMode 'float' in the stacks fixes it.
async function wheelScrolls(page: import('@playwright/test').Page) {
  const scrolled = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('div')).some((d) => {
        const el = d as HTMLElement;
        return el.offsetParent !== null && /(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollTop > 0;
      }),
    );
  expect(await scrolled()).toBe(false);
  const vh = page.viewportSize()?.height ?? 844;
  await page.mouse.move(195, Math.round(vh * 0.6));
  await page.mouse.wheel(0, 400);
  await expect.poll(scrolled).toBe(true);
}

test('web: a pushed screen (My Golf) scrolls with the mouse wheel', async ({ page }) => {
  await openSignedIn(page);
  await page.getByRole('link', { name: 'My Golf', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'My Golf', exact: true }).first()).toBeVisible();
  await wheelScrolls(page);
});

test('web: a signed-out stack screen (Sign up) scrolls in a short window', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await openSignedOut(page);
  await page.getByText('Get Started').click();
  await expect(page.getByText('Create your account').first()).toBeVisible();
  await wheelScrolls(page);
});
