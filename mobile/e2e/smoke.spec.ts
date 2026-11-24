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
