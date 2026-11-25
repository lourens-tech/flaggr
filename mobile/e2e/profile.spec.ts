import { test, expect, type Page, type Route, type Locator } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { API, TOKEN, TEST_EMAIL, TEST_PASSWORD, openSignedIn, openSignedOut, reset, scenario, tab } from './helpers';

// Click-through of inventory section "E. Profile and support"
// (docs/Member-App-Functionality-Inventory.md): Member Profile (rows, sheets,
// alerts), Edit Profile, Refer a Friend, Notification Preferences, Help Center,
// Contact Your Club, My Enquiries, Enquiry Chat, Give Feedback, Terms and Privacy.
//
// Where the sample-data mock has no switch for a state (a capped referral, a
// resolved enquiry, a slow request), the test shapes that one response in the
// browser with page.route, so the mock and the app stay untouched.

const PHOTO = path.resolve(__dirname, '../assets/images/strand-golf-club-fairway.jpg');
// Friendly wording (owner decision 24 Nov 2026, utils/errors.ts friendlyError): a server error (500)
// and a network failure no longer show raw technical text.
const SERVER = 'Something went wrong on our side. Please try again.';
const NETWORK = 'We couldn’t reach Flagrr. Check your connection and try again.';
const auth = { Authorization: `Bearer ${TOKEN}` };

// ---------------------------------------------------------------- helpers

type Pred = { method?: string; path: string; action?: string | null };
function matches(p: Pred) {
  return (url: URL) => url.pathname === p.path && (p.action === undefined || (url.searchParams.get('action') ?? null) === p.action);
}
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };

/** Intercept one API call. The handler gets non-preflight requests only. */
async function intercept(page: Page, p: Pred, handler: (route: Route) => Promise<void>) {
  await page.route(matches(p), async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (p.method && req.method() !== p.method) return route.fallback();
    return handler(route);
  });
}

/** Hold matching requests until the returned release() is called (to observe loading/busy states). */
async function hold(page: Page, p: Pred) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await intercept(page, p, async (route) => {
    await gate;
    await route.continue().catch(() => {});
  });
  return release;
}

/** Answer matching requests with fixed JSON. */
async function fulfill(page: Page, p: Pred, status: number, json: unknown) {
  await intercept(page, p, (route) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(json) }));
}

async function apiGet(page: Page, pathAndQuery: string) {
  const r = await page.request.get(`${API}${pathAndQuery}`, { headers: auth });
  return r.json();
}
async function apiPost(page: Page, pathAndQuery: string, data: unknown) {
  return page.request.post(`${API}${pathAndQuery}`, { headers: auth, data });
}
const serverUser = async (page: Page) => (await apiGet(page, '/api/me')).user;

/** The app's own alert card with this title. */
function alertCard(page: Page, title: string) {
  return page.getByRole('alert').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).last();
}
/** Assert an alert (title, message, buttons) is showing; returns it. */
async function expectAlert(page: Page, title: string, message?: string, buttons: string[] = ['OK']) {
  const a = alertCard(page, title);
  await expect(a).toBeVisible();
  if (message !== undefined) await expect(a.getByText(message, { exact: true })).toBeVisible();
  for (const b of buttons) await expect(a.getByRole('button', { name: b, exact: true })).toBeVisible();
  await expect(a.getByRole('button')).toHaveCount(buttons.length);
  return a;
}
async function tapAlert(page: Page, title: string, button: string) {
  await alertCard(page, title).getByRole('button', { name: button, exact: true }).click();
  await expect(alertCard(page, title)).toHaveCount(0);
}
const noAlert = (page: Page) => expect(page.getByRole('alert')).toHaveCount(0);

/** A Bento sheet (modal card) by its title. */
function sheet(page: Page, title: string): Locator {
  return page.locator('[aria-modal="true"]').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).first();
}

// Screens left behind in the stack stay in the DOM (hidden), so page-level lookups keep visible matches only.
const T = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true });
const btn = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).filter({ visible: true });
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true }).filter({ visible: true }).first();
const back = (page: Page) => btn(page, 'Back').click();

async function openProfile(page: Page, opts: { theme?: 'light' | 'dark' | 'system' } = {}) {
  await openSignedIn(page, opts);
  await tab(page, 'Profile');
  await expect(heading(page, 'Sam Mokoena')).toBeVisible();
}
async function expectOnProfile(page: Page) {
  await expect(heading(page, 'Sam Mokoena')).toBeVisible();
  await expect(btn(page, 'Log Out')).toBeVisible();
}
async function openFromProfile(page: Page, row: string, title: string) {
  await openProfile(page);
  await btn(page, row).click();
  await expect(heading(page, title)).toBeVisible();
}
/** Formats a date the way the Profile Details rows do (device locale dd/mm/yyyy style). */
const profileDate = (page: Page, iso: string) =>
  page.evaluate((d) => new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' }), iso);
const spinner = (scope: Page | Locator) => scope.getByRole('progressbar').filter({ visible: true });
/** A pill button in its busy state: disabled, with a spinner in place of its label. */
async function expectBusy(page: Page, name: string) {
  await expect(btn(page, name)).toBeDisabled();
  await expect(btn(page, name).getByRole('progressbar')).toHaveCount(1);
}

// react-native-web 0.21 drops accessibilityState, so radios and switches carry no
// aria-checked on the web build (see report). Their on/off state is read from what
// the member sees instead: the selected segment's label colour, the club radio's
// filled dot, the switch knob's position.
async function selectedTheme(page: Page) {
  return page.getByRole('radiogroup', { name: 'Theme' }).filter({ visible: true }).evaluate((g) => {
    const radios = Array.from(g.querySelectorAll('[role="radio"]')) as HTMLElement[];
    const cols = radios.map((r) => getComputedStyle(r.querySelector('div[dir], span, div') ?? r).color);
    const i = cols.findIndex((c) => cols.filter((x) => x === c).length === 1);
    return i < 0 ? null : radios[i].textContent;
  });
}
const clubChecked = (radio: Locator) => radio.evaluate((el) => (el.lastElementChild?.childElementCount ?? 0) === 1);
const switchOn = (sw: Locator) =>
  sw.evaluate((el) => new DOMMatrix(getComputedStyle(el.firstElementChild as Element).transform === 'none' ? '' : getComputedStyle(el.firstElementChild as Element).transform).m41 > 10);
async function expectSwitch(page: Page, name: string, on: boolean) {
  await expect.poll(() => switchOn(page.getByRole('switch', { name }))).toBe(on);
}

test.beforeEach(async ({ page }) => reset(page));

// ================================================================ Member Profile

test.describe('Member Profile', () => {
  test('Profile › shows avatar initials, name, club · tier, stats and every section row', async ({ page }) => {
    await openProfile(page);
    await expect(btn(page, 'Change profile photo')).toContainText('SM');
    await expect(T(page, 'Strand Golf Club · Gold')).toBeVisible();
    // Stats count up to their final values.
    const stats = T(page, 'Week Streak').locator('../..');
    await expect(stats).toHaveText(/^12,480\s*Flagrr Cash\s*4\s*Week Streak\s*18\s*Rounds Played$/); // 18 = 2 nine-hole + 16 eighteen-hole
    // Refer a Friend hero
    await expect(btn(page, 'Refer a Friend')).toContainText('Bring your four-ball');
    for (const s of ['Activity', 'Details', 'Support', 'Settings', 'Account']) await expect(T(page, s).first()).toBeVisible();
    for (const r of ['Reward Activity', 'Receipt History', 'Help Center', 'Contact Your Club', 'My Enquiries', 'Give Feedback', 'My Feedback, unread reply', 'Notification Preferences', 'Export My Data', 'Terms and Privacy', 'Log Out', 'Delete Account'])
      await expect(btn(page, r)).toBeVisible();
    await expect(btn(page, 'Security')).toContainText('Change your password');
    await expect(T(page, 'Appearance')).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio')).toHaveText(['Light', 'Dark', 'System']);
  });

  test('Profile › Details rows show name, phone, email, birthday, club and member since (Member Since not tappable)', async ({ page }) => {
    await openProfile(page);
    await expect(btn(page, 'Name: Sam Mokoena')).toBeVisible();
    await expect(btn(page, 'Phone: 0820000000')).toBeVisible();
    await expect(btn(page, `Email: ${TEST_EMAIL}`)).toBeVisible();
    await expect(btn(page, `Birthday: ${await profileDate(page, '1990-05-04')}`)).toBeVisible();
    await expect(btn(page, 'Club: Strand Golf Club')).toBeVisible();
    const since = await profileDate(page, '2026-08-01');
    await expect(page.getByLabel(`Member Since: ${since}`)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Member Since/ })).toHaveCount(0);
  });

  test('Profile › empty phone and birthday show “—”; empty club shows tier only', async ({ page }) => {
    await apiPost(page, '/api/profile?action=update', { phone: null, dateOfBirth: null, homeClub: '' });
    await openProfile(page);
    await expect(btn(page, 'Phone: —')).toBeVisible();
    await expect(btn(page, 'Birthday: —')).toBeVisible();
    await expect(T(page, 'Gold').first()).toBeVisible();
    await expect(page.getByText(/ · Gold$/)).toHaveCount(0);
  });

  test('Profile › placeholder club shows “My Club Isn’t Listed Yet” in the Club row', async ({ page }) => {
    await scenario(page, { placeholder: true });
    await openSignedIn(page);
    // Home's placeholder popup shows on the first open; close it.
    await tapAlert(page, 'You\'re Almost In the Family', 'Close');
    await tab(page, 'Profile');
    await expect(btn(page, "Club: My Club Isn't Listed Yet")).toBeVisible();
  });

  test('Profile › reached from the Home avatar button and the Home “Your Club” tile', async ({ page }) => {
    await openSignedIn(page);
    await btn(page, 'Profile').click();
    await expectOnProfile(page);
    await tab(page, 'Home');
    await expect(page.getByText('Flagrr Cash').first()).toBeVisible();
    await page.getByLabel('Your Club: Strand Golf Club').click();
    await expectOnProfile(page);
  });

  test('Profile › every navigation row opens its screen and Back returns', async ({ page }) => {
    await openProfile(page);
    const rows: Array<[string, (p: Page) => Locator]> = [
      ['Refer a Friend', (p) => p.getByText('Earn Flagrr Cash', { exact: true })],
      ['Receipt History', (p) => heading(p, 'Receipt History')],
      ['Name: Sam Mokoena', (p) => heading(p, 'Edit Profile')],
      ['Phone: 0820000000', (p) => heading(p, 'Edit Profile')],
      [`Email: ${TEST_EMAIL}`, (p) => heading(p, 'Edit Profile')],
      ['Help Center', (p) => heading(p, 'Help Center')],
      ['Contact Your Club', (p) => heading(p, 'Contact Us')],
      ['My Enquiries', (p) => heading(p, 'My Enquiries')],
      ['Give Feedback', (p) => heading(p, 'Give Feedback')],
      ['My Feedback, unread reply', (p) => heading(p, 'My Feedback')],
      ['Notification Preferences', (p) => heading(p, 'Notification Preferences')],
      ['Terms and Privacy', (p) => heading(p, 'Terms and Privacy')],
    ];
    for (const [row, dest] of rows) {
      await btn(page, row).click();
      await expect(dest(page)).toBeVisible();
      await back(page);
      await expectOnProfile(page);
    }
    // Birthday row too
    await page.getByRole('button', { name: /^Birthday: / }).click();
    await expect(heading(page, 'Edit Profile')).toBeVisible();
    await back(page);
    // Reward Activity opens the Activity tab
    await btn(page, 'Reward Activity').click();
    await expect(heading(page, 'Reward Activity')).toBeVisible();
    await expect(btn(page, 'Log Out')).toHaveCount(0);
  });

  // The header's Edit Profile button (boards AppProfile and G-E-ProfileTop) opens Edit Profile, like the Details rows.
  test('Profile › Edit Profile button opens Edit Profile and Back returns', async ({ page }) => {
    await openProfile(page);
    await btn(page, 'Edit Profile').click();
    await expect(heading(page, 'Edit Profile')).toBeVisible();
    await expect(page.getByPlaceholder('First Name')).toHaveValue('Sam');
    await back(page);
    await expectOnProfile(page);
  });

  // ---------------- Appearance
  test('Appearance › Light/Dark/System saves to the server, applies and persists', async ({ page }) => {
    await openProfile(page);
    const group = page.getByRole('radiogroup', { name: 'Theme' });
    await expect.poll(() => selectedTheme(page)).toBe('Light');
    // The theme applies at once: the name's ink colour flips.
    const bg = () => heading(page, 'Sam Mokoena').evaluate((el) => getComputedStyle(el).color);
    const lightBg = await bg();

    await group.getByRole('radio', { name: 'Dark' }).click();
    await expect.poll(() => selectedTheme(page)).toBe('Dark');
    await expect.poll(async () => (await serverUser(page)).themePreference).toBe('dark');
    await expect.poll(bg).not.toBe(lightBg);

    await group.getByRole('radio', { name: 'System' }).click();
    await expect.poll(() => selectedTheme(page)).toBe('System');
    await expect.poll(async () => (await serverUser(page)).themePreference).toBe('system');

    await group.getByRole('radio', { name: 'Dark' }).click();
    await expect.poll(async () => (await serverUser(page)).themePreference).toBe('dark');
    // The app stores the choice on the device once the server answers; the device copy is what a reload reads first.
    await expect.poll(() => page.evaluate(() => localStorage.getItem('flagrr_theme_preference'))).toBe('dark');
    await page.reload();
    await tab(page, 'Profile');
    await expect.poll(() => selectedTheme(page)).toBe('Dark');
  });

  test('Appearance › re-tapping the current segment still calls the server', async ({ page }) => {
    await openProfile(page);
    let calls = 0;
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('action=themePreference')) calls++;
    });
    await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Light' }).click();
    await expect.poll(() => calls).toBe(1);
  });

  test('Appearance › failure shows “Couldn’t update appearance” and keeps the previous value', async ({ page }) => {
    await scenario(page, { fail: { 'POST /api/profile?action=themePreference': 500 } });
    await openProfile(page);
    const group = page.getByRole('radiogroup', { name: 'Theme' });
    await group.getByRole('radio', { name: 'Dark' }).click();
    await expectAlert(page, 'Couldn’t update appearance', SERVER); // friendly wording (owner decision 24 Nov 2026)
    await tapAlert(page, 'Couldn’t update appearance', 'OK');
    await expect.poll(() => selectedTheme(page)).toBe('Light');
    expect((await serverUser(page)).themePreference).toBe('light');
  });

  // ---------------- Change password sheet
  test('Password › sheet shows title, subtitle, fields, helper and eye toggles', async ({ page }) => {
    // Labelled fields with no placeholder, as on the boards (owner rule 1; G-E-PasswordSheet, G-E-DeleteSheet, G-E-ContactFAQ): found by label.
    await openProfile(page);
    await btn(page, 'Security').click();
    const s = sheet(page, 'Change your password');
    await expect(s).toBeVisible();
    await expect(s.getByText('Security', { exact: true })).toBeVisible();
    await expect(s.getByText('At least 8 characters. Use your new password next time you log in.', { exact: true })).toBeVisible();
    const cur = s.getByLabel('Current password', { exact: true });
    const next = s.getByLabel('New password', { exact: true });
    await expect(cur).toHaveAttribute('type', 'password');
    await expect(next).toHaveAttribute('type', 'password');
    await expect(s.getByLabel('Current password')).toBeVisible();
    await expect(s.getByLabel('New password')).toBeVisible();
    await cur.fill('abc');
    await s.getByRole('button', { name: 'Show password' }).first().click();
    await expect(cur).not.toHaveAttribute('type', 'password');
    await expect(s.getByRole('button', { name: 'Hide password' })).toBeVisible();
    await s.getByRole('button', { name: 'Hide password' }).click();
    await expect(cur).toHaveAttribute('type', 'password');
    await expect(s.getByRole('button', { name: 'Update Password' })).toBeVisible();
  });

  test('Password › missing current or short new password shows “Missing info”', async ({ page }) => {
    // Labelled fields with no placeholder, as on the boards (owner rule 1; G-E-PasswordSheet, G-E-DeleteSheet, G-E-ContactFAQ): found by label.
    await openProfile(page);
    await btn(page, 'Security').click();
    const s = sheet(page, 'Change your password');
    const msg = 'Enter your current password and a new password (min. 8 characters).';
    await s.getByRole('button', { name: 'Update Password' }).click();
    await expectAlert(page, 'Missing info', msg);
    await tapAlert(page, 'Missing info', 'OK');
    await s.getByLabel('Current password', { exact: true }).fill(TEST_PASSWORD);
    await s.getByLabel('New password', { exact: true }).fill('short77');
    await s.getByRole('button', { name: 'Update Password' }).click();
    await expectAlert(page, 'Missing info', msg);
    await tapAlert(page, 'Missing info', 'OK');
    await s.getByLabel('Current password', { exact: true }).fill('');
    await s.getByLabel('New password', { exact: true }).fill('LongEnough1');
    await s.getByRole('button', { name: 'Update Password' }).click();
    await expectAlert(page, 'Missing info', msg);
  });

  test('Password › wrong current password shows “Couldn’t change password” and keeps the sheet filled', async ({ page }) => {
    // Labelled fields with no placeholder, as on the boards (owner rule 1; G-E-PasswordSheet, G-E-DeleteSheet, G-E-ContactFAQ): found by label.
    await openProfile(page);
    await btn(page, 'Security').click();
    const s = sheet(page, 'Change your password');
    await s.getByLabel('Current password', { exact: true }).fill('WrongPass1');
    await s.getByLabel('New password', { exact: true }).fill('NewGolf2027!');
    await s.getByRole('button', { name: 'Update Password' }).click();
    await expectAlert(page, 'Couldn’t change password', 'Current password is incorrect');
    await tapAlert(page, 'Couldn’t change password', 'OK');
    await expect(s).toBeVisible();
    await expect(s.getByLabel('Current password', { exact: true })).toHaveValue('WrongPass1');
    await expect(s.getByLabel('New password', { exact: true })).toHaveValue('NewGolf2027!');
  });

  test('Password › server error shows its message', async ({ page }) => {
    // Labelled fields with no placeholder, as on the boards (owner rule 1; G-E-PasswordSheet, G-E-DeleteSheet, G-E-ContactFAQ): found by label.
    await scenario(page, { fail: { 'POST /api/profile?action=changePassword': 500 } });
    await openProfile(page);
    await btn(page, 'Security').click();
    const s = sheet(page, 'Change your password');
    await s.getByLabel('Current password', { exact: true }).fill(TEST_PASSWORD);
    await s.getByLabel('New password', { exact: true }).fill('NewGolf2027!');
    await s.getByRole('button', { name: 'Update Password' }).click();
    await expectAlert(page, 'Couldn’t change password', SERVER); // friendly wording (owner decision 24 Nov 2026)
  });

  test('Password › success clears and closes the sheet, shows “Password changed”, new password works', async ({ page }) => {
    // Labelled fields with no placeholder, as on the boards (owner rule 1; G-E-PasswordSheet, G-E-DeleteSheet, G-E-ContactFAQ): found by label.
    await openProfile(page);
    await btn(page, 'Security').click();
    const s = sheet(page, 'Change your password');
    const release = await hold(page, { method: 'POST', path: '/api/profile', action: 'changePassword' });
    await s.getByLabel('Current password', { exact: true }).fill(TEST_PASSWORD);
    await s.getByLabel('New password', { exact: true }).fill('NewGolf2027!');
    await s.getByRole('button', { name: 'Update Password' }).click();
    await expect(s.getByRole('progressbar')).toHaveCount(1); // saving spinner replaces the button label
    await expect(s.getByText('Update Password', { exact: true })).toHaveCount(0);
    release();
    await expectAlert(page, 'Password changed', 'Use your new password next time you log in.');
    await expect(s).toHaveCount(0);
    await tapAlert(page, 'Password changed', 'OK');
    // Fields were cleared.
    await btn(page, 'Security').click();
    await expect(sheet(page, 'Change your password').getByLabel('Current password', { exact: true })).toHaveValue('');
    await expect(sheet(page, 'Change your password').getByLabel('New password', { exact: true })).toHaveValue('');
    // Server effect: the new password logs in, the old one no longer does; this device stays signed in.
    const ok = await page.request.post(`${API}/api/auth/login`, { data: { email: TEST_EMAIL, password: 'NewGolf2027!' } });
    expect(ok.status()).toBe(200);
    const old = await page.request.post(`${API}/api/auth/login`, { data: { email: TEST_EMAIL, password: TEST_PASSWORD } });
    expect(old.status()).toBe(401);
  });

  test('Password › closing without saving keeps what was typed (× and backdrop)', async ({ page }) => {
    // Labelled fields with no placeholder, as on the boards (owner rule 1; G-E-PasswordSheet, G-E-DeleteSheet, G-E-ContactFAQ): found by label.
    await openProfile(page);
    await btn(page, 'Security').click();
    let s = sheet(page, 'Change your password');
    await s.getByLabel('Current password', { exact: true }).fill('typed-1');
    await s.getByRole('button', { name: 'Close' }).last().click(); // × button
    await expect(s).toHaveCount(0);
    await btn(page, 'Security').click();
    s = sheet(page, 'Change your password');
    await expect(s.getByLabel('Current password', { exact: true })).toHaveValue('typed-1');
    await page.getByRole('button', { name: 'Close' }).first().click({ position: { x: 20, y: 20 } }); // backdrop
    await expect(s).toHaveCount(0);
  });

  test('Password › signing out other devices', async () => {
    test.skip(true, 'server-only: changePassword deleting other sessions is not observable in the web client or the mock');
  });

  // ---------------- Delete account
  test('Delete › sheet copy, empty password “Missing info”, Cancel closes', async ({ page }) => {
    // Labelled fields with no placeholder, as on the boards (owner rule 1; G-E-PasswordSheet, G-E-DeleteSheet, G-E-ContactFAQ): found by label.
    await openProfile(page);
    await btn(page, 'Delete Account').click();
    const s = sheet(page, 'Delete your account?');
    // Brand words (owner decision 24 Nov 2026): "Flagrr Cash", not "points".
    await expect(s.getByText('Deleting your account permanently removes your profile, Flagrr Cash, receipts, and reward history. This can’t be undone. Enter your current password to confirm.', { exact: true })).toBeVisible();
    await expect(s.getByLabel('Current password', { exact: true })).toHaveAttribute('type', 'password');
    await expect(s.getByLabel('Current password')).toBeVisible();
    await expect(s.getByRole('button', { name: 'Show password' })).toBeVisible();
    await s.getByRole('button', { name: 'Delete Account', exact: true }).click();
    await expectAlert(page, 'Missing info', 'Enter your current password to confirm.');
    await tapAlert(page, 'Missing info', 'OK');
    await s.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(s).toHaveCount(0);
    await expectOnProfile(page);
  });

  test('Delete › second confirmation alert; Cancel keeps the account and the sheet', async ({ page }) => {
    // Labelled fields with no placeholder, as on the boards (owner rule 1; G-E-PasswordSheet, G-E-DeleteSheet, G-E-ContactFAQ): found by label.
    await openProfile(page);
    await btn(page, 'Delete Account').click();
    const s = sheet(page, 'Delete your account?');
    await s.getByLabel('Current password', { exact: true }).fill(TEST_PASSWORD);
    await s.getByRole('button', { name: 'Delete Account', exact: true }).click();
    // Brand words (owner decision 24 Nov 2026): "Flagrr Cash", not "points".
    await expectAlert(page, 'Delete your account?', 'This permanently removes your profile, Flagrr Cash, receipts, vouchers, and message history. This can’t be undone.', ['Cancel', 'Delete Account']);
    await tapAlert(page, 'Delete your account?', 'Cancel');
    await expect(s).toBeVisible();
    await expect(s.getByLabel('Current password', { exact: true })).toHaveValue(TEST_PASSWORD);
  });

  test('Delete › wrong password shows “Couldn’t delete account”; sheet stays, button re-enabled', async ({ page }) => {
    // Labelled fields with no placeholder, as on the boards (owner rule 1; G-E-PasswordSheet, G-E-DeleteSheet, G-E-ContactFAQ): found by label.
    await openProfile(page);
    await btn(page, 'Delete Account').click();
    const s = sheet(page, 'Delete your account?');
    await s.getByLabel('Current password', { exact: true }).fill('WrongPass1');
    await s.getByRole('button', { name: 'Delete Account', exact: true }).click();
    await tapAlert(page, 'Delete your account?', 'Delete Account');
    await expectAlert(page, 'Couldn’t delete account', 'Current password is incorrect');
    await tapAlert(page, 'Couldn’t delete account', 'OK');
    await expect(s).toBeVisible();
    await expect(s.getByRole('button', { name: 'Delete Account', exact: true })).toBeEnabled();
  });

  test('Delete › confirmed delete shows a spinner, then returns to Landing (signed out)', async ({ page }) => {
    // Labelled fields with no placeholder, as on the boards (owner rule 1; G-E-PasswordSheet, G-E-DeleteSheet, G-E-ContactFAQ): found by label.
    await openProfile(page);
    await btn(page, 'Delete Account').click();
    const s = sheet(page, 'Delete your account?');
    await s.getByLabel('Current password', { exact: true }).fill(TEST_PASSWORD);
    const release = await hold(page, { method: 'POST', path: '/api/profile', action: 'deleteAccount' });
    await s.getByRole('button', { name: 'Delete Account', exact: true }).click();
    await tapAlert(page, 'Delete your account?', 'Delete Account');
    await expect(spinner(s)).toBeVisible();
    release();
    await expect(page.getByText('Get Started')).toBeVisible();
    await expect(page.getByText('I already have an account')).toBeVisible();
    await noAlert(page);
    expect(await page.evaluate(() => localStorage.getItem('flagrr_auth_token'))).toBeNull();
  });

  // ---------------- Club picker
  test('Club › picker lists every club (placeholder last) with the current one checked; × closes', async ({ page }) => {
    await openProfile(page);
    const release = await hold(page, { method: 'GET', path: '/api/courses', action: null });
    await btn(page, 'Club: Strand Golf Club').click();
    const s = sheet(page, 'Choose Golf Club');
    await expect(spinner(s)).toBeVisible();
    release();
    const radios = s.getByRole('radio');
    // Each row now also shows the club's monogram (board G-E-ClubList), so the names are read from the rows' labels.
    await expect.poll(() => radios.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))).toEqual(['Strand Golf Club', 'Sample Links Golf Club', "My Club Isn't Listed Yet"]);
    expect(await clubChecked(s.getByRole('radio', { name: 'Strand Golf Club' }))).toBe(true);
    expect(await clubChecked(s.getByRole('radio', { name: 'Sample Links Golf Club' }))).toBe(false);
    expect(await clubChecked(s.getByRole('radio', { name: "My Club Isn't Listed Yet" }))).toBe(false);
    await s.getByRole('button', { name: 'Close' }).last().click();
    await expect(s).toHaveCount(0);
  });

  test('Club › tapping the current club closes the picker with no change', async ({ page }) => {
    await openProfile(page);
    await btn(page, 'Club: Strand Golf Club').click();
    const s = sheet(page, 'Choose Golf Club');
    await s.getByRole('radio', { name: 'Strand Golf Club' }).click();
    await expect(s).toHaveCount(0);
    await noAlert(page);
    await expect(btn(page, 'Club: Strand Golf Club')).toBeVisible();
  });

  test('Club › “Change home club?” Cancel keeps the club; Switch shows Updating… then the new club', async ({ page }) => {
    await openProfile(page);
    await btn(page, 'Club: Strand Golf Club').click();
    await sheet(page, 'Choose Golf Club').getByRole('radio', { name: 'Sample Links Golf Club' }).click();
    await expect(sheet(page, 'Choose Golf Club')).toHaveCount(0);
    const msg = 'Switch your home club to Sample Links Golf Club? Your rewards and any ads shown in the app will update to match.';
    await expectAlert(page, 'Change home club?', msg, ['Switch', 'Cancel']);
    await tapAlert(page, 'Change home club?', 'Cancel');
    await expect(btn(page, 'Club: Strand Golf Club')).toBeVisible();
    expect((await serverUser(page)).homeClub).toBe('Strand Golf Club');

    await btn(page, 'Club: Strand Golf Club').click();
    await sheet(page, 'Choose Golf Club').getByRole('radio', { name: 'Sample Links Golf Club' }).click();
    const release = await hold(page, { method: 'POST', path: '/api/profile', action: 'changeClub' });
    await tapAlert(page, 'Change home club?', 'Switch');
    // Row reads Updating… and is not tappable meanwhile.
    await expect(page.getByLabel('Club: Updating…')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Club: Updating…' })).toHaveCount(0);
    release();
    await expect(btn(page, 'Club: Sample Links Golf Club')).toBeVisible();
    await expect(T(page, 'Sample Links Golf Club · Gold')).toBeVisible();
    expect((await serverUser(page)).homeClub).toBe('Sample Links Golf Club');
    // Picker now checks the new club.
    await btn(page, 'Club: Sample Links Golf Club').click();
    await expect.poll(() => clubChecked(sheet(page, 'Choose Golf Club').getByRole('radio', { name: 'Sample Links Golf Club' }))).toBe(true);
  });

  test('Club › switching to and away from the placeholder club', async ({ page }) => {
    await openProfile(page);
    await btn(page, 'Club: Strand Golf Club').click();
    await sheet(page, 'Choose Golf Club').getByRole('radio', { name: "My Club Isn't Listed Yet" }).click();
    await tapAlert(page, 'Change home club?', 'Switch');
    await expect(btn(page, "Club: My Club Isn't Listed Yet")).toBeVisible();
    await btn(page, "Club: My Club Isn't Listed Yet").click();
    await sheet(page, 'Choose Golf Club').getByRole('radio', { name: 'Strand Golf Club' }).click();
    await tapAlert(page, 'Change home club?', 'Switch');
    await expect(btn(page, 'Club: Strand Golf Club')).toBeVisible();
  });

  test('Club › change failure shows “Couldn’t change club”', async ({ page }) => {
    await scenario(page, { fail: { 'POST /api/profile?action=changeClub': 500 } });
    await openProfile(page);
    await btn(page, 'Club: Strand Golf Club').click();
    await sheet(page, 'Choose Golf Club').getByRole('radio', { name: 'Sample Links Golf Club' }).click();
    await tapAlert(page, 'Change home club?', 'Switch');
    await expectAlert(page, 'Couldn’t change club', SERVER); // friendly wording (owner decision 24 Nov 2026)
    await tapAlert(page, 'Couldn’t change club', 'OK');
    await expect(btn(page, 'Club: Strand Golf Club')).toBeVisible();
  });

  // Owner decision 25 Nov 2026: a failed club list shows a message with Try again (it used to be an empty box).
  test('Club › course list failure shows “Couldn’t load clubs” with Try again, which loads the list', async ({ page }) => {
    await scenario(page, { fail: { 'GET /api/courses': 500 } });
    await openProfile(page);
    await btn(page, 'Club: Strand Golf Club').click();
    const s = sheet(page, 'Choose Golf Club');
    await expect(s).toBeVisible();
    await expect(s.getByRole('heading', { name: 'Couldn’t load clubs' })).toBeVisible();
    await expect(s.getByText(SERVER)).toBeVisible();
    await expect(spinner(s)).toHaveCount(0);
    await expect(s.getByRole('radio')).toHaveCount(0);
    await noAlert(page);
    await scenario(page, { fail: { 'GET /api/courses': 0 } }); // 0 = stop failing
    const loads = page.waitForRequest((r) => /\/api\/courses(\?|$)/.test(r.url()) && r.method() === 'GET');
    await s.getByRole('button', { name: 'Try again' }).click();
    await loads;
    await expect(s.getByRole('radio', { name: 'Strand Golf Club' })).toBeVisible();
    await expect(s.getByRole('heading', { name: 'Couldn’t load clubs' })).toHaveCount(0);
  });

  // Approved small addition (24 Nov 2026): search in Choose Golf Club.
  test('Club › search filters the club list by name; reopening starts with the full list', async ({ page }) => {
    await openProfile(page);
    await btn(page, 'Club: Strand Golf Club').click();
    const s = sheet(page, 'Choose Golf Club');
    const names = () => s.getByRole('radio').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    await expect.poll(names).toEqual(['Strand Golf Club', 'Sample Links Golf Club', "My Club Isn't Listed Yet"]);
    await s.getByLabel('Search clubs', { exact: true }).fill('LINKS');
    await expect.poll(names).toEqual(['Sample Links Golf Club']);
    await s.getByLabel('Search clubs', { exact: true }).fill('zzqx');
    await expect.poll(names).toEqual([]);
    await expect(s.getByText('Nothing matches that search.', { exact: true })).toBeVisible();
    await s.getByLabel('Search clubs', { exact: true }).fill('listed');
    await expect.poll(names).toEqual(["My Club Isn't Listed Yet"]);
    // Choosing from a filtered list works as before.
    await s.getByRole('radio', { name: "My Club Isn't Listed Yet" }).click();
    await expectAlert(page, 'Change home club?', "Switch your home club to My Club Isn't Listed Yet? Your rewards and any ads shown in the app will update to match.", ['Switch', 'Cancel']);
    await tapAlert(page, 'Change home club?', 'Cancel');
    // Reopening starts with the full list again.
    await btn(page, 'Club: Strand Golf Club').click();
    await expect(sheet(page, 'Choose Golf Club').getByLabel('Search clubs', { exact: true })).toHaveValue('');
    await expect.poll(() => sheet(page, 'Choose Golf Club').getByRole('radio').count()).toBe(3);
  });

  // ---------------- Export, log out, avatar
  test('Export › web downloads flagrr-my-data.json (row busy while exporting, no success alert)', async ({ page }) => {
    await openProfile(page);
    const release = await hold(page, { method: 'GET', path: '/api/profile', action: 'exportMyData' });
    const dl = page.waitForEvent('download');
    await btn(page, 'Export My Data').click();
    await expect(spinner(btn(page, 'Export My Data'))).toBeVisible();
    await expect(btn(page, 'Export My Data')).toBeDisabled();
    release();
    const download = await dl;
    expect(download.suggestedFilename()).toBe('flagrr-my-data.json');
    const body = JSON.parse(await fs.promises.readFile((await download.path())!, 'utf8'));
    expect(body.user.email).toBe(TEST_EMAIL);
    await expect(spinner(btn(page, 'Export My Data'))).toHaveCount(0);
    await noAlert(page);
  });

  test('Export › failure shows “Couldn’t export your data”', async ({ page }) => {
    await scenario(page, { fail: { 'GET /api/profile?action=exportMyData': 500 } });
    await openProfile(page);
    await btn(page, 'Export My Data').click();
    await expectAlert(page, 'Couldn’t export your data', SERVER); // friendly wording (owner decision 24 Nov 2026): a 500 export failure
    await tapAlert(page, 'Couldn’t export your data', 'OK');
    await expect(btn(page, 'Export My Data')).toBeEnabled();
  });

  test('Export › “Not available here” when sharing is unavailable', async () => {
    test.skip(true, 'native only: Sharing.isAvailableAsync() false → “Not available here” (web always downloads); native share sheet “Your Flagrr Data”');
  });

  test('Log Out › signs out immediately with no confirmation and returns to Landing', async ({ page }) => {
    await openProfile(page);
    await btn(page, 'Log Out').click();
    await expect(page.getByText('Get Started')).toBeVisible();
    await noAlert(page);
    expect(await page.evaluate(() => localStorage.getItem('flagrr_auth_token'))).toBeNull();
  });

  test('Avatar › choosing a photo uploads it (spinner while uploading) and replaces the initials', async ({ page }) => {
    await openProfile(page);
    const release = await hold(page, { method: 'POST', path: '/api/profile', action: null });
    const chooser = page.waitForEvent('filechooser');
    await btn(page, 'Change profile photo').click();
    await (await chooser).setFiles(PHOTO);
    await expect(spinner(btn(page, 'Change profile photo'))).toBeVisible();
    await expect(btn(page, 'Change profile photo')).toBeDisabled();
    release();
    await expect(spinner(btn(page, 'Change profile photo'))).toHaveCount(0);
    await expect(btn(page, 'Change profile photo')).not.toContainText('SM');
    await expect(btn(page, 'Change profile photo').locator('img[src*="strand-golf-club-fairway"]')).toHaveCount(1);
    expect((await serverUser(page)).avatarUrl).toContain('strand-golf-club-fairway');
    // Every avatar updates (Home's Profile button).
    await tab(page, 'Home');
    await expect(btn(page, 'Profile').locator('img[src*="strand-golf-club-fairway"]')).toHaveCount(1);
  });

  test('Avatar › upload failure shows “Couldn’t update profile picture”', async ({ page }) => {
    await scenario(page, { fail: { 'POST /api/profile': 500 } });
    await openProfile(page);
    const chooser = page.waitForEvent('filechooser');
    await btn(page, 'Change profile photo').click();
    await (await chooser).setFiles(PHOTO);
    await expectAlert(page, 'Couldn’t update profile picture', SERVER); // friendly wording (owner decision 24 Nov 2026)
    await tapAlert(page, 'Couldn’t update profile picture', 'OK');
    await expect(btn(page, 'Change profile photo')).toContainText('SM');
  });

  test('Avatar › cancelling the picker does nothing', async ({ page }) => {
    await openProfile(page);
    let uploads = 0;
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/api\/profile$/.test(new URL(r.url()).pathname) && !new URL(r.url()).searchParams.get('action')) uploads++;
    });
    const chooser = page.waitForEvent('filechooser');
    await btn(page, 'Change profile photo').click();
    await (await chooser).setFiles([]);
    await expect(btn(page, 'Change profile photo')).toBeEnabled();
    await expect(spinner(btn(page, 'Change profile photo'))).toHaveCount(0);
    await noAlert(page);
    expect(uploads).toBe(0);
  });

  test('Avatar › photo-library permission denied alert', async () => {
    test.skip(true, 'native only: OS photo-library permission prompt → “Permission needed” (web always grants)');
  });
});

// ================================================================ Edit Profile

test.describe('Edit Profile', () => {
  test('Edit Profile › form is pre-filled; date input is limited to today; no photo control', async ({ page }) => {
    await openFromProfile(page, 'Name: Sam Mokoena', 'Edit Profile');
    await expect(page.getByPlaceholder('First Name')).toHaveValue('Sam');
    await expect(page.getByPlaceholder('Last Name')).toHaveValue('Mokoena');
    await expect(page.getByPlaceholder('Email')).toHaveValue(TEST_EMAIL);
    await expect(page.getByPlaceholder('Phone Number')).toHaveValue('0820000000');
    const dob = page.getByLabel('Date of Birth');
    await expect(dob).toHaveValue('1990-05-04');
    await expect(dob).toHaveAttribute('max', new Date().toISOString().slice(0, 10));
    await expect(btn(page, 'Save Changes').or(T(page, 'Save Changes')).first()).toBeVisible();
    await expect(page.getByText(/Change photo/i)).toHaveCount(0);
    await expect(btn(page, 'Change profile photo')).toHaveCount(0);
  });

  test('Edit Profile › blank first name and bad email show both inline errors; typing clears each', async ({ page }) => {
    await openFromProfile(page, 'Name: Sam Mokoena', 'Edit Profile');
    let saves = 0;
    page.on('request', (r) => { if (r.url().includes('action=update')) saves++; });
    await page.getByPlaceholder('First Name').fill('   ');
    await page.getByPlaceholder('Email').fill('not-an-email');
    await T(page, 'Save Changes').click();
    await expect(T(page, 'First name is required')).toBeVisible();
    await expect(T(page, 'Enter a valid email address')).toBeVisible();
    await expect(page.getByPlaceholder('First Name')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByPlaceholder('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(saves).toBe(0);
    await page.getByPlaceholder('First Name').fill('Samuel');
    await expect(T(page, 'First name is required')).toHaveCount(0);
    await expect(T(page, 'Enter a valid email address')).toBeVisible();
    await page.getByPlaceholder('Email').fill('sam@flagrr.test');
    await expect(T(page, 'Enter a valid email address')).toHaveCount(0);
    await expect(heading(page, 'Edit Profile')).toBeVisible();
  });

  test('Edit Profile › Save Changes saves (spinner), goes back silently, Profile shows the new values', async ({ page }) => {
    await openFromProfile(page, 'Name: Sam Mokoena', 'Edit Profile');
    await page.getByPlaceholder('First Name').fill('  Samuel ');
    await page.getByPlaceholder('Last Name').fill('Mokoena-Smith');
    await page.getByPlaceholder('Email').fill('samuel@flagrr.test');
    await page.getByPlaceholder('Phone Number').fill('0831234567');
    await page.getByLabel('Date of Birth').fill('1985-12-25');
    const release = await hold(page, { method: 'POST', path: '/api/profile', action: 'update' });
    await T(page, 'Save Changes').click();
    await expectBusy(page, 'Save Changes');
    release();
    await expect(heading(page, 'Samuel Mokoena-Smith')).toBeVisible();
    await noAlert(page);
    await expect(btn(page, 'Name: Samuel Mokoena-Smith')).toBeVisible();
    await expect(btn(page, 'Phone: 0831234567')).toBeVisible();
    await expect(btn(page, 'Email: samuel@flagrr.test')).toBeVisible();
    await expect(btn(page, `Birthday: ${await profileDate(page, '1985-12-25')}`)).toBeVisible();
    const u = await serverUser(page);
    expect([u.firstName, u.lastName, u.email, u.phone, u.dateOfBirth]).toEqual(['Samuel', 'Mokoena-Smith', 'samuel@flagrr.test', '0831234567', '1985-12-25']);
  });

  test('Edit Profile › web date input can be cleared (Profile shows “—”)', async ({ page }) => {
    await openFromProfile(page, 'Name: Sam Mokoena', 'Edit Profile');
    await page.getByLabel('Date of Birth').fill('');
    await T(page, 'Save Changes').click();
    await expectOnProfile(page);
    await expect(btn(page, 'Birthday: —')).toBeVisible();
  });

  test('Edit Profile › clearing phone stores null and Profile shows “—”', async ({ page }) => {
    await openFromProfile(page, 'Name: Sam Mokoena', 'Edit Profile');
    await page.getByPlaceholder('Phone Number').fill('');
    await T(page, 'Save Changes').click();
    await expectOnProfile(page);
    await expect(btn(page, 'Phone: —')).toBeVisible();
    expect((await serverUser(page)).phone).toBeNull();
  });

  test('Edit Profile › save failure shows “Couldn’t save changes” and stays on the form', async ({ page }) => {
    await scenario(page, { fail: { 'POST /api/profile?action=update': 500 } });
    await openFromProfile(page, 'Name: Sam Mokoena', 'Edit Profile');
    await page.getByPlaceholder('First Name').fill('Samuel');
    await T(page, 'Save Changes').click();
    await expectAlert(page, 'Couldn’t save changes', SERVER); // friendly wording (owner decision 24 Nov 2026)
    await tapAlert(page, 'Couldn’t save changes', 'OK');
    await expect(heading(page, 'Edit Profile')).toBeVisible();
    await expect(page.getByPlaceholder('First Name')).toHaveValue('Samuel');
  });

  test('Edit Profile › duplicate email (409) shows the server message', async ({ page }) => {
    await fulfill(page, { method: 'POST', path: '/api/profile', action: 'update' }, 409, { error: 'An account with this email already exists' });
    await openFromProfile(page, 'Name: Sam Mokoena', 'Edit Profile');
    await page.getByPlaceholder('Email').fill('taken@flagrr.test');
    await T(page, 'Save Changes').click();
    await expectAlert(page, 'Couldn’t save changes', 'An account with this email already exists');
  });

  test('Edit Profile › Back discards edits without a prompt', async ({ page }) => {
    await openFromProfile(page, 'Name: Sam Mokoena', 'Edit Profile');
    await page.getByPlaceholder('First Name').fill('Changed');
    await back(page);
    await expectOnProfile(page);
    await noAlert(page);
    await btn(page, 'Name: Sam Mokoena').click();
    await expect(page.getByPlaceholder('First Name')).toHaveValue('Sam');
  });

  test('Edit Profile › native date pickers', async () => {
    test.skip(true, 'native only: iOS inline-calendar modal with Done, Android calendar dialog, “Mon D, YYYY” display');
  });
});

// ================================================================ Refer a Friend

test.describe('Refer a Friend', () => {
  test('Referral › loading spinner, then code, progress, How it works and footnote', async ({ page }) => {
    await openProfile(page);
    const release = await hold(page, { method: 'GET', path: '/api/profile', action: 'referralInfo' });
    await btn(page, 'Refer a Friend').click();
    await expect(heading(page, 'Refer a Friend')).toBeVisible();
    await expect(T(page, 'Earn Flagrr Cash')).toBeVisible();
    await expect(spinner(page)).toBeVisible();
    release();
    await expect(T(page, 'Your referral code')).toBeVisible();
    await expect(T(page, 'FLG7K2')).toBeVisible();
    await expect(T(page, 'Share My Code')).toBeVisible();
    await expect(T(page, '2 of 10 referral bonuses earned')).toBeVisible();
    await expect(T(page, 'How it works')).toBeVisible();
    await expect(T(page, 'Refer a friend')).toBeVisible();
    await expect(T(page, 'When a friend signs up and enters your code, you get 15 Flagrr Cash.')).toBeVisible();
    await expect(T(page, 'Refer a golf club')).toBeVisible();
    await expect(T(page, 'When a golf club signs up for Flagrr using your code, you get 500 Flagrr Cash.')).toBeVisible();
    await expect(T(page, "Your bonus is credited as soon as your friend's account is created, or once a referred club's first payment clears — you'll see it in your Activity feed and get a notification.")).toBeVisible();
    await expect(page.getByText(/copy/i)).toHaveCount(0); // no copy-to-clipboard control
  });

  test('Referral › capped shows “You’ve reached the 10-referral limit — thank you!” and Share stays', async ({ page }) => {
    await fulfill(page, { method: 'GET', path: '/api/profile', action: 'referralInfo' }, 200, { code: 'FLG7K2', memberBonus: 15, courseBonus: 500, redeemedCount: 10, maxRedemptions: 10 });
    await openFromProfile(page, 'Refer a Friend', 'Refer a Friend');
    await expect(T(page, "You've reached the 10-referral limit — thank you!")).toBeVisible();
    await expect(page.getByText(/referral bonuses earned/)).toHaveCount(0);
    await expect(T(page, 'Share My Code')).toBeVisible();
  });

  test('Referral › Share My Code shares the referral message (navigator.share)', async ({ page }) => {
    await page.addInitScript(() => {
      (navigator as any).share = async (d: unknown) => { (window as any).__shared = d; };
    });
    await openFromProfile(page, 'Refer a Friend', 'Refer a Friend');
    await T(page, 'Share My Code').click();
    await expect.poll(() => page.evaluate(() => (window as any).__shared?.text)).toBe('Join me on Flagrr! Use my referral code FLG7K2 when you sign up and we both earn Flagrr Cash.');
  });

  test('Referral › Share without navigator.share does nothing (no error shown)', async ({ page }) => {
    await page.addInitScript(() => {
      try { delete (Navigator.prototype as any).share; } catch { /* ignore */ }
      (navigator as any).share = undefined;
    });
    await openFromProfile(page, 'Refer a Friend', 'Refer a Friend');
    await T(page, 'Share My Code').click();
    await page.waitForTimeout(300);
    await noAlert(page);
    await expect(T(page, 'FLG7K2')).toBeVisible();
  });

  // No silent failures (owner decision 24 Nov 2026): the failed load shows a message with Try again
  // in the screen (it was an alert, then a blank body with no retry).
  test('Referral › load failure shows “Couldn’t load your referral code” with Try again, which loads it', async ({ page }) => {
    await scenario(page, { fail: { 'GET /api/profile?action=referralInfo': 500 } });
    await openFromProfile(page, 'Refer a Friend', 'Refer a Friend');
    await expect(heading(page, 'Couldn’t load your referral code')).toBeVisible();
    await expect(T(page, SERVER)).toBeVisible();
    await noAlert(page);
    await expect(T(page, 'Earn Flagrr Cash')).toBeVisible();
    await expect(T(page, 'Your referral code')).toHaveCount(0);
    await expect(T(page, 'Share My Code')).toHaveCount(0);
    await expect(spinner(page)).toHaveCount(0);
    // Try again runs the same load.
    await scenario(page, { fail: { 'GET /api/profile?action=referralInfo': 0 } }); // 0 = stop failing
    const loads = page.waitForRequest((r) => r.url().includes('action=referralInfo') && r.method() === 'GET');
    await btn(page, 'Try again').click();
    await loads;
    await expect(T(page, 'FLG7K2')).toBeVisible();
    await expect(T(page, '2 of 10 referral bonuses earned')).toBeVisible();
    await expect(heading(page, 'Couldn’t load your referral code')).toHaveCount(0);
  });

  test('Referral › expired session (401) asks to log in again and does not log out', async ({ page }) => {
    await fulfill(page, { method: 'GET', path: '/api/profile', action: 'referralInfo' }, 401, { error: 'Not authenticated' });
    await openFromProfile(page, 'Refer a Friend', 'Refer a Friend');
    // Shown in the screen's load-error message, not an alert (owner decision 24 Nov 2026: no silent failures, with Try again).
    await expect(heading(page, 'Couldn’t load your referral code')).toBeVisible();
    await expect(T(page, 'Your session has ended. Please log in again.')).toBeVisible(); // Friendly errors (owner decision 24 Nov 2026): an expired session (401 "Not authenticated") asks the member to log in again; technical text (camelCase field names, "data URI") gets the screen's fallback.
    await back(page);
    await expectOnProfile(page);
  });
});

// ================================================================ Notification Preferences

test.describe('Notification Preferences', () => {
  const rows = [
    ['Account Activity', 'Receipts earned, redemptions, tier and streak rewards.'],
    ['Support Replies', 'Replies to an enquiry you sent your club.'],
    ['Club and Flagrr Announcements', 'Broadcasts from your club or the Flagrr team.'],
  ] as const;

  test('Notification Preferences › spinner, then three rows with server values', async ({ page }) => {
    await openProfile(page);
    const release = await hold(page, { method: 'GET', path: '/api/profile', action: 'notificationPreferences' });
    await btn(page, 'Notification Preferences').click();
    await expect(heading(page, 'Notification Preferences')).toBeVisible();
    await expect(spinner(page)).toBeVisible();
    release();
    for (const [label, desc] of rows) {
      await expect(T(page, label)).toBeVisible();
      await expect(T(page, desc)).toBeVisible();
    }
    await expectSwitch(page, 'Account Activity', true);
    await expectSwitch(page, 'Support Replies', true);
    await expectSwitch(page, 'Club and Flagrr Announcements', false);
  });

  test('Notification Preferences › toggling saves all three (row spinner while saving) and persists', async ({ page }) => {
    await openFromProfile(page, 'Notification Preferences', 'Notification Preferences');
    let sent: any = null;
    page.on('request', (r) => { if (r.url().includes('action=updateNotificationPreferences') && r.method() === 'POST') sent = r.postDataJSON(); });
    const release = await hold(page, { method: 'POST', path: '/api/profile', action: 'updateNotificationPreferences' });
    await page.getByRole('switch', { name: 'Club and Flagrr Announcements' }).click();
    // The toggled row shows a spinner in place of its switch; the others stay usable.
    await expect(page.getByRole('switch', { name: 'Club and Flagrr Announcements' })).toHaveCount(0);
    await expect(spinner(page)).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Account Activity' })).toBeEnabled();
    release();
    await expectSwitch(page, 'Club and Flagrr Announcements', true);
    expect(sent).toEqual({ accountActivity: true, supportReplies: true, announcements: true });
    await page.unroute(() => true).catch(() => {});
    await page.getByRole('switch', { name: 'Account Activity' }).click();
    await expectSwitch(page, 'Account Activity', false);
    await expect.poll(async () => apiGet(page, '/api/profile?action=notificationPreferences')).toEqual({ accountActivity: false, supportReplies: true, announcements: true });
    // Re-open: values come back from the server.
    await back(page);
    await btn(page, 'Notification Preferences').click();
    await expectSwitch(page, 'Account Activity', false);
    await expectSwitch(page, 'Club and Flagrr Announcements', true);
  });

  test('Notification Preferences › update failure reverts the switch and shows “Couldn’t update preferences”', async ({ page }) => {
    await scenario(page, { fail: { 'POST /api/profile?action=updateNotificationPreferences': 500 } });
    await openFromProfile(page, 'Notification Preferences', 'Notification Preferences');
    await page.getByRole('switch', { name: 'Support Replies' }).click();
    await expectAlert(page, 'Couldn’t update preferences', SERVER); // friendly wording (owner decision 24 Nov 2026)
    await tapAlert(page, 'Couldn’t update preferences', 'OK');
    await expectSwitch(page, 'Support Replies', true);
  });

  // No silent failures (owner decision 24 Nov 2026): the failed load shows a message with Try again
  // in the screen (it was an alert, then a spinner that never stopped).
  test('Notification Preferences › load failure shows “Couldn’t load preferences” with Try again, which loads them', async ({ page }) => {
    await scenario(page, { fail: { 'GET /api/profile?action=notificationPreferences': 500 } });
    await openFromProfile(page, 'Notification Preferences', 'Notification Preferences');
    await expect(heading(page, 'Couldn’t load preferences')).toBeVisible();
    await expect(T(page, SERVER)).toBeVisible();
    await noAlert(page);
    await expect(spinner(page)).toHaveCount(0);
    await expect(page.getByRole('switch')).toHaveCount(0);
    await scenario(page, { fail: { 'GET /api/profile?action=notificationPreferences': 0 } }); // 0 = stop failing
    const loads = page.waitForRequest((r) => r.url().includes('action=notificationPreferences') && r.method() === 'GET');
    await btn(page, 'Try again').click();
    await loads;
    await expectSwitch(page, 'Account Activity', true);
    await expectSwitch(page, 'Club and Flagrr Announcements', false);
    await expect(heading(page, 'Couldn’t load preferences')).toHaveCount(0);
  });
});

// ================================================================ Help Center

test.describe('Help Center', () => {
  const FAQ_Q = [
    'How Do I Earn Flagrr Cash?',
    'How do I redeem rewards?',
    'How do membership tiers work?',
    'What do the tiers actually get me?',
    'What’s the benefit of keeping a streak going?',
    'Where can I use my reward voucher?',
    'Why was my receipt not approved?',
    'Can I change my selected club?',
  ];
  const A1 = 'You can earn Flagrr Cash by playing qualifying rounds, scanning eligible receipts, participating in promotions, and completing selected in-app activities.';
  const A2 = 'Open the Rewards Shop, choose a reward you can afford, and tap Redeem Now to receive a QR voucher.';
  const A8 = 'Yes — open My Profile and tap Club to switch your home club at any time.';
  const ARTICLES = [
    ['How Do I Earn Flagrr Cash?', 'Learn how to earn Flagrr Cash through qualifying...'],
    ['How Do I Redeem Rewards?', 'Learn how to redeem your Flagrr Cash for rewards...'],
    ['Getting Started With Flagrr', 'Everything you need to know as a new member...'],
  ];

  test('Help Center › greeting, hero, search, support row, 3 articles and 8 FAQs (first open)', async ({ page }) => {
    await openFromProfile(page, 'Help Center', 'Help Center');
    await expect(T(page, 'Hello, Sam')).toBeVisible();
    await expect(T(page, 'How can we help you today?')).toBeVisible();
    await expect(page.getByPlaceholder('Search')).toBeVisible();
    await expect(T(page, 'Contact Your Club')).toBeVisible();
    await expect(T(page, "Send a message and chat with your club's team")).toBeVisible();
    await expect(T(page, 'Latest Articles')).toBeVisible();
    for (const [t, s] of ARTICLES) {
      await expect(T(page, t).first()).toBeVisible();
      await expect(T(page, s)).toBeVisible();
    }
    await expect(T(page, 'Frequently Asked Questions')).toBeVisible();
    for (const q of FAQ_Q) await expect(T(page, q).last()).toBeAttached();
    await expect(T(page, A1)).toBeVisible();
    await expect(T(page, A2)).toHaveCount(0);
  });

  test('Help Center › FAQ accordion opens one at a time; tapping the open one closes it', async ({ page }) => {
    await openFromProfile(page, 'Help Center', 'Help Center');
    await T(page, 'How do I redeem rewards?').click();
    await expect(T(page, A2)).toBeVisible();
    await expect(T(page, A1)).toHaveCount(0);
    await T(page, 'Can I change my selected club?').click();
    await expect(T(page, A8)).toBeVisible();
    await expect(T(page, A2)).toHaveCount(0);
    await T(page, 'Can I change my selected club?').click();
    await expect(T(page, A8)).toHaveCount(0);
  });

  test('Help Center › search filters FAQs and hides Latest Articles when no article matches', async ({ page }) => {
    await openFromProfile(page, 'Help Center', 'Help Center');
    await page.getByPlaceholder('Search').fill('VOUCHER');
    await expect(T(page, 'Latest Articles')).toHaveCount(0);
    await expect(T(page, 'How do I redeem rewards?')).toBeVisible();
    await expect(T(page, 'What do the tiers actually get me?')).toBeVisible();
    await expect(T(page, 'Where can I use my reward voucher?')).toBeVisible();
    await expect(T(page, 'How do membership tiers work?')).toHaveCount(0);
    // Open state is by index: the first match is now open.
    await expect(T(page, A2)).toBeVisible();
    // Support row is never filtered.
    await expect(T(page, 'Contact Your Club')).toBeVisible();
  });

  test('Help Center › search filters articles by title or summary', async ({ page }) => {
    await openFromProfile(page, 'Help Center', 'Help Center');
    await page.getByPlaceholder('Search').fill('new member');
    await expect(T(page, 'Latest Articles')).toBeVisible();
    await expect(T(page, 'Getting Started With Flagrr')).toBeVisible();
    await expect(T(page, 'How Do I Redeem Rewards?')).toHaveCount(0);
    await page.getByPlaceholder('Search').fill('redeem');
    await expect(T(page, 'How Do I Redeem Rewards?')).toBeVisible();
    await expect(T(page, 'Getting Started With Flagrr')).toHaveCount(0);
    await page.getByPlaceholder('Search').fill('');
    await expect(T(page, 'Getting Started With Flagrr')).toBeVisible();
  });

  test('Help Center › no match shows “No results for "…" — try a different search.”', async ({ page }) => {
    await openFromProfile(page, 'Help Center', 'Help Center');
    await page.getByPlaceholder('Search').fill('  zzqx  ');
    await expect(T(page, 'No results for "zzqx" — try a different search.')).toBeVisible();
    await expect(T(page, 'Frequently Asked Questions')).toBeVisible();
    await expect(T(page, 'Latest Articles')).toHaveCount(0);
  });

  test('Help Center › article cards are not tappable; Contact Your Club row opens Contact', async ({ page }) => {
    await openFromProfile(page, 'Help Center', 'Help Center');
    await T(page, 'Getting Started With Flagrr').click();
    await expect(heading(page, 'Help Center')).toBeVisible();
    await T(page, 'Contact Your Club').click();
    await expect(heading(page, 'Contact Us')).toBeVisible();
    await back(page);
    await expect(heading(page, 'Help Center')).toBeVisible();
  });
});

// ================================================================ Contact Your Club

test.describe('Contact Your Club', () => {
  // Brand words (owner decision 24 Nov 2026): "Rewards and Flagrr Cash", not "Rewards and Points".
  const TYPES = ['Rewards and Flagrr Cash', 'Receipts', 'Membership', 'Technical Issue', 'Other'];

  test('Contact › pre-filled form, link, type placeholder, message box, Submit and FAQ', async ({ page }) => {
    // Labelled fields with no placeholder, as on the boards (owner rule 1; G-E-PasswordSheet, G-E-DeleteSheet, G-E-ContactFAQ): found by label.
    await openFromProfile(page, 'Contact Your Club', 'Contact Us');
    await expect(T(page, 'Have Any Questions?')).toBeVisible();
    await expect(T(page, 'View my previous enquiries')).toBeVisible();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Sam');
    await expect(page.getByLabel('Surname', { exact: true })).toHaveValue('Mokoena');
    await expect(page.getByLabel('Phone', { exact: true })).toHaveValue('0820000000');
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue(TEST_EMAIL);
    await expect(T(page, 'Choose Type Of Support Enquiry')).toBeVisible();
    await expect(page.getByPlaceholder('Type Your Message Here')).toBeVisible();
    await expect(T(page, 'Submit Enquiry')).toBeVisible();
    await expect(T(page, 'Frequently Asked Questions')).toBeVisible();
    await expect(T(page, 'You can earn Flagrr Cash by playing qualifying rounds, scanning eligible receipts, participating in promotions, and completing selected in-app activities.')).toBeVisible();
    await T(page, 'How do I redeem rewards?').click();
    await expect(T(page, 'Open the Rewards Shop, choose a reward you can afford, and tap Redeem Now to receive a QR voucher.')).toBeVisible();
  });

  // The type picker is a bottom sheet (owner decision 24 Nov 2026), so it closes by choosing or with × (it was an inline list toggled by the field).
  test('Contact › enquiry type sheet lists 5 types, selecting one shows it and closes the sheet', async ({ page }) => {
    await openFromProfile(page, 'Contact Your Club', 'Contact Us');
    await T(page, 'Choose Type Of Support Enquiry').click();
    const s = sheet(page, 'Enquiry type');
    await expect(s).toBeVisible();
    await expect(s.getByText('Choose Type Of Support Enquiry', { exact: true })).toBeVisible();
    await expect(s.getByRole('radio')).toHaveText(TYPES);
    await s.getByRole('radio', { name: 'Membership' }).click();
    await expect(s).toHaveCount(0);
    await expect(T(page, 'Choose Type Of Support Enquiry')).toHaveCount(0);
    await expect(T(page, 'Membership')).toBeVisible();
    await expect(T(page, 'Technical Issue')).toHaveCount(0);
    // Open again: the chosen type is marked; × closes; it cannot be cleared back to none.
    await T(page, 'Membership').click();
    await expect(sheet(page, 'Enquiry type').getByRole('radio', { name: 'Membership' }).locator('svg')).toHaveCount(1);
    await expect(sheet(page, 'Enquiry type').getByRole('radio', { name: 'Technical Issue' }).locator('svg')).toHaveCount(0);
    await sheet(page, 'Enquiry type').getByRole('button', { name: 'Close' }).last().click();
    await expect(sheet(page, 'Enquiry type')).toHaveCount(0);
    await expect(T(page, 'Membership')).toBeVisible();
    await expect(T(page, 'Choose Type Of Support Enquiry')).toHaveCount(0);
  });

  test('Contact › empty or blank message shows “Add a message”', async ({ page }) => {
    await openFromProfile(page, 'Contact Your Club', 'Contact Us');
    await T(page, 'Submit Enquiry').click();
    await expectAlert(page, 'Add a message', 'Let us know what your enquiry is about before sending.');
    await tapAlert(page, 'Add a message', 'OK');
    await page.getByPlaceholder('Type Your Message Here').fill('   ');
    await T(page, 'Submit Enquiry').click();
    await expectAlert(page, 'Add a message', 'Let us know what your enquiry is about before sending.');
  });

  test('Contact › Submit Enquiry (spinner) replaces Contact with the new Pending chat; Back skips Contact', async ({ page }) => {
    // Labelled fields with no placeholder, as on the boards (owner rule 1; G-E-PasswordSheet, G-E-DeleteSheet, G-E-ContactFAQ): found by label.
    await openFromProfile(page, 'Contact Your Club', 'Contact Us');
    let sent: any = null;
    page.on('request', (r) => { if (r.url().includes('action=contact') && r.method() === 'POST') sent = r.postDataJSON(); });
    await page.getByLabel('Phone', { exact: true }).fill('0839999999');
    await T(page, 'Choose Type Of Support Enquiry').click();
    await T(page, 'Receipts').click();
    await page.getByPlaceholder('Type Your Message Here').fill('  My slip from Saturday did not earn.  ');
    const release = await hold(page, { method: 'POST', path: '/api/profile', action: 'contact' });
    await T(page, 'Submit Enquiry').click();
    await expectBusy(page, 'Submit Enquiry');
    release();
    await expect(heading(page, 'Receipts')).toBeVisible();
    await expect(T(page, 'Pending')).toBeVisible();
    await expect(T(page, 'My slip from Saturday did not earn.')).toBeVisible();
    expect(sent).toEqual({ name: 'Sam', surname: 'Mokoena', phone: '0839999999', email: TEST_EMAIL, enquiryType: 'Receipts', message: 'My slip from Saturday did not earn.' });
    await back(page);
    await expectOnProfile(page);
    // It is listed in My Enquiries.
    await btn(page, 'My Enquiries').click();
    await expect(T(page, 'My slip from Saturday did not earn.')).toBeVisible();
  });

  test('Contact › type is optional: no type chosen is stored as “General”', async ({ page }) => {
    await openFromProfile(page, 'Contact Your Club', 'Contact Us');
    await page.getByPlaceholder('Type Your Message Here').fill('A question about my tier.');
    await T(page, 'Submit Enquiry').click();
    await expect(heading(page, 'General')).toBeVisible();
    await expect(T(page, 'Pending')).toBeVisible();
    await expect(T(page, 'A question about my tier.')).toBeVisible();
  });

  test('Contact › submit failure shows “Couldn’t send your enquiry” and keeps the form', async ({ page }) => {
    await scenario(page, { fail: { 'POST /api/profile?action=contact': 500 } });
    await openFromProfile(page, 'Contact Your Club', 'Contact Us');
    await page.getByPlaceholder('Type Your Message Here').fill('Hello club');
    await T(page, 'Submit Enquiry').click();
    await expectAlert(page, 'Couldn’t send your enquiry', SERVER); // friendly wording (owner decision 24 Nov 2026)
    await tapAlert(page, 'Couldn’t send your enquiry', 'OK');
    await expect(heading(page, 'Contact Us')).toBeVisible();
    await expect(page.getByPlaceholder('Type Your Message Here')).toHaveValue('Hello club');
  });

  test('Contact › network failure shows the generic message', async ({ page }) => {
    await intercept(page, { method: 'POST', path: '/api/profile', action: 'contact' }, (route) => route.abort('failed'));
    await openFromProfile(page, 'Contact Your Club', 'Contact Us');
    await page.getByPlaceholder('Type Your Message Here').fill('Hello club');
    await T(page, 'Submit Enquiry').click();
    await expectAlert(page, 'Couldn’t send your enquiry', NETWORK); // friendly wording (owner decision 24 Nov 2026)
  });

  test('Contact › View my previous enquiries opens My Enquiries', async ({ page }) => {
    await openFromProfile(page, 'Contact Your Club', 'Contact Us');
    await T(page, 'View my previous enquiries').click();
    await expect(heading(page, 'My Enquiries')).toBeVisible();
    await back(page);
    await expect(heading(page, 'Contact Us')).toBeVisible();
  });

  test('Contact › reached from Help Center and from the placeholder-club “Contact Support” popups and empty shop', async ({ page }) => {
    await scenario(page, { placeholder: true });
    await openSignedIn(page);
    // Home popup (first open)
    await expectAlert(page, 'You\'re Almost In the Family', undefined, ['Contact Support', 'Close']);
    await tapAlert(page, 'You\'re Almost In the Family', 'Contact Support');
    await expect(heading(page, 'Contact Us')).toBeVisible();
    await back(page);
    // Rewards popup (every visit)
    await tab(page, 'Rewards');
    await tapAlert(page, 'You\'re Almost In the Family', 'Contact Support');
    await expect(heading(page, 'Contact Us')).toBeVisible();
    await back(page);
    // Rewards empty state action
    await tapAlert(page, 'You\'re Almost In the Family', 'Close');
    await btn(page, 'Contact Support').or(T(page, 'Contact Support')).first().click();
    await expect(heading(page, 'Contact Us')).toBeVisible();
  });
});

// ================================================================ My Enquiries

test.describe('My Enquiries', () => {
  test('My Enquiries › row shows type, unread dot, last message, relative time and “Chat in Progress”', async ({ page }) => {
    await openFromProfile(page, 'My Enquiries', 'My Enquiries');
    await expect(T(page, 'Bookings')).toBeVisible();
    await expect(T(page, 'Thanks, we have booked your tee time.')).toBeVisible();
    await expect(T(page, '2d ago')).toBeVisible();
    await expect(T(page, 'Chat in Progress')).toBeVisible();
    // Unread dot sits next to the type (an extra element beside the type text).
    await expect.poll(() => T(page, 'Bookings').locator('..').evaluate((el) => el.childElementCount)).toBe(2);
  });

  test('My Enquiries › Pending badge and “just now” for a new enquiry; no unread dot on it', async ({ page }) => {
    await apiPost(page, '/api/profile?action=contact', { enquiryType: 'Membership', message: 'Renewal question' });
    await openFromProfile(page, 'My Enquiries', 'My Enquiries');
    await expect(T(page, 'Pending')).toBeVisible();
    await expect(T(page, 'just now')).toBeVisible();
    await expect(T(page, 'Membership').locator('..').evaluate((el) => el.childElementCount)).resolves.toBe(1);
    // Newest first (server order) is kept.
    await expect(page.getByText(/^(Membership|Bookings)$/)).toHaveText(['Membership', 'Bookings']);
  });

  test('My Enquiries › Resolved badge, “—” for no last message, and m/h/d relative times', async ({ page }) => {
    const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
    await fulfill(page, { method: 'GET', path: '/api/profile', action: 'myEnquiries' }, 200, [
      { id: 'e1', enquiryType: 'Other', status: 'resolved', createdAt: ago(9e5), updatedAt: ago(5 * 60000 + 5000), lastMessage: null, hasUnread: false },
      { id: 'e2', enquiryType: 'Technical Issue', status: 'pending', createdAt: ago(1e7), updatedAt: ago(3 * 3600000 + 5000), lastMessage: 'App froze', hasUnread: false },
      { id: 'e3', enquiryType: 'Receipts', status: 'in_progress', createdAt: ago(1e9), updatedAt: ago(9 * 86400000 + 5000), lastMessage: 'Sorted', hasUnread: false },
    ]);
    await openFromProfile(page, 'My Enquiries', 'My Enquiries');
    await expect(T(page, 'Resolved')).toBeVisible();
    await expect(T(page, '—')).toBeVisible();
    await expect(T(page, '5m ago')).toBeVisible();
    await expect(T(page, '3h ago')).toBeVisible();
    await expect(T(page, '9d ago')).toBeVisible();
    await expect(T(page, 'Pending')).toBeVisible();
    await expect(T(page, 'Chat in Progress')).toBeVisible();
  });

  // Approved small addition (24 Nov 2026): "Contact Your Club" on the empty list (board AppEnquiriesEmpty, title “No enquiries”).
  test('My Enquiries › empty state “No enquiries” with “Contact Your Club”, which opens Contact', async ({ page }) => {
    await scenario(page, { noEnquiries: true });
    await openFromProfile(page, 'My Enquiries', 'My Enquiries');
    await expect(heading(page, 'No enquiries')).toBeVisible();
    await expect(T(page, "You haven't sent any enquiries yet.")).toBeVisible();
    await btn(page, 'Contact Your Club').click();
    await expect(heading(page, 'Contact Us')).toBeVisible();
    await back(page);
    await expect(heading(page, 'My Enquiries')).toBeVisible();
  });

  // No silent failures (owner decision 24 Nov 2026): a failed load shows a message with Try again (it looked like an empty list).
  test('My Enquiries › failed load shows a message with Try again, which loads the list', async ({ page }) => {
    await scenario(page, { fail: { 'GET /api/profile?action=myEnquiries': 500 } });
    await openFromProfile(page, 'My Enquiries', 'My Enquiries');
    await expect(heading(page, 'Couldn’t load this')).toBeVisible();
    await expect(T(page, SERVER)).toBeVisible();
    await expect(T(page, "You haven't sent any enquiries yet.")).toHaveCount(0);
    await noAlert(page);
    await scenario(page, { fail: { 'GET /api/profile?action=myEnquiries': 0 } }); // 0 = stop failing
    const loads = page.waitForRequest((r) => r.url().includes('action=myEnquiries') && r.method() === 'GET');
    await btn(page, 'Try again').click();
    await loads;
    await expect(T(page, 'Bookings')).toBeVisible();
    await expect(heading(page, 'Couldn’t load this')).toHaveCount(0);
  });

  // Approved small addition (24 Nov 2026): "+" on My Enquiries opens Contact.
  test('My Enquiries › “New enquiry” (+) opens Contact', async ({ page }) => {
    await openFromProfile(page, 'My Enquiries', 'My Enquiries');
    await btn(page, 'New enquiry').click();
    await expect(heading(page, 'Contact Us')).toBeVisible();
    await back(page);
    await expect(heading(page, 'My Enquiries')).toBeVisible();
  });

  test('My Enquiries › spinner on every focus; row opens the chat', async ({ page }) => {
    await openProfile(page);
    let release = await hold(page, { method: 'GET', path: '/api/profile', action: 'myEnquiries' });
    await btn(page, 'My Enquiries').click();
    await expect(spinner(page)).toBeVisible();
    release();
    await page.unroute(() => true).catch(() => {});
    await T(page, 'Bookings').click();
    await expect(heading(page, 'Bookings')).toBeVisible();
    release = await hold(page, { method: 'GET', path: '/api/profile', action: 'myEnquiries' });
    await back(page);
    await expect(heading(page, 'My Enquiries')).toBeVisible();
    await expect(spinner(page)).toBeVisible();
    release();
    await expect(T(page, 'Chat in Progress')).toBeVisible();
  });

  test('My Enquiries › unread dot clears after opening the chat and coming back', async ({ page }) => {
    await openFromProfile(page, 'My Enquiries', 'My Enquiries');
    const dotCount = () => T(page, 'Bookings').locator('..').evaluate((el) => el.childElementCount);
    await expect.poll(dotCount).toBe(2);
    await T(page, 'Bookings').click();
    await expect(heading(page, 'Bookings')).toBeVisible();
    await back(page);
    await expect(heading(page, 'My Enquiries')).toBeVisible();
    await expect.poll(dotCount).toBe(1);
  });
});

// ================================================================ Enquiry Chat

test.describe('Enquiry Chat', () => {
  test('Enquiry Chat › title, status badge, both bubbles with en-ZA timestamps, composer', async ({ page }) => {
    const thread = await apiGet(page, '/api/profile?action=enquiryThread&id=e1');
    await openFromProfile(page, 'My Enquiries', 'My Enquiries');
    await T(page, 'Bookings').click();
    await expect(heading(page, 'Bookings')).toBeVisible();
    await expect(T(page, 'Chat in Progress')).toBeVisible();
    await expect(T(page, 'Can I book a tee time for Saturday morning?')).toBeVisible();
    await expect(T(page, 'Thanks, we have booked your tee time.')).toBeVisible();
    for (const m of thread.messages) {
      const ts = await page.evaluate((iso) => new Date(iso).toLocaleString('en-ZA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), m.createdAt);
      await expect(T(page, ts).first()).toBeVisible();
    }
    await expect(page.getByPlaceholder('Type a message…')).toBeVisible();
    await expect(btn(page, 'Send message')).toBeDisabled();
  });

  test('Enquiry Chat › loading shows the “Enquiry” title and a spinner', async ({ page }) => {
    await openFromProfile(page, 'My Enquiries', 'My Enquiries');
    const release = await hold(page, { method: 'GET', path: '/api/profile', action: 'enquiryThread' });
    await T(page, 'Bookings').click();
    await expect(heading(page, 'Enquiry')).toBeVisible();
    await expect(spinner(page)).toBeVisible();
    release();
    await expect(heading(page, 'Bookings')).toBeVisible();
  });

  test('Enquiry Chat › Send is disabled for a blank draft; sending (spinner) adds the bubble and clears the draft', async ({ page }) => {
    await openFromProfile(page, 'My Enquiries', 'My Enquiries');
    await T(page, 'Bookings').click();
    const box = page.getByPlaceholder('Type a message…');
    await box.fill('   ');
    await expect(btn(page, 'Send message')).toBeDisabled();
    await box.fill('  Thank you!  ');
    await expect(btn(page, 'Send message')).toBeEnabled();
    let sent: any = null;
    page.on('request', (r) => { if (r.url().includes('action=enquiryReply')) sent = r.postDataJSON(); });
    const release = await hold(page, { method: 'POST', path: '/api/profile', action: 'enquiryReply' });
    await btn(page, 'Send message').click();
    await expect(spinner(btn(page, 'Send message'))).toBeVisible();
    await expect(btn(page, 'Send message')).toBeDisabled();
    release();
    await expect(T(page, 'Thank you!')).toBeVisible();
    await expect(box).toHaveValue('');
    expect(sent).toEqual({ enquiryId: 'e1', message: 'Thank you!' });
    const t = await apiGet(page, '/api/profile?action=enquiryThread&id=e1');
    expect(t.messages.at(-1).body).toBe('Thank you!');
  });

  test('Enquiry Chat › send failure shows “Couldn’t send message” and keeps the draft', async ({ page }) => {
    await scenario(page, { fail: { 'POST /api/profile?action=enquiryReply': 500 } });
    await openFromProfile(page, 'My Enquiries', 'My Enquiries');
    await T(page, 'Bookings').click();
    await page.getByPlaceholder('Type a message…').fill('Hello?');
    await btn(page, 'Send message').click();
    await expectAlert(page, 'Couldn’t send message', SERVER); // friendly wording (owner decision 24 Nov 2026)
    await tapAlert(page, 'Couldn’t send message', 'OK');
    await expect(page.getByPlaceholder('Type a message…')).toHaveValue('Hello?');
  });

  test('Enquiry Chat › load failure shows “Couldn’t load enquiry”, spinner stays, alert repeats with the 12 s poll', async ({ page }) => {
    test.setTimeout(45_000);
    await openFromProfile(page, 'My Enquiries', 'My Enquiries');
    await scenario(page, { fail: { 'GET /api/profile?action=enquiryThread': 500 } });
    await T(page, 'Bookings').click();
    await expectAlert(page, 'Couldn’t load enquiry', SERVER); // friendly wording (owner decision 24 Nov 2026)
    await tapAlert(page, 'Couldn’t load enquiry', 'OK');
    await expect(heading(page, 'Enquiry')).toBeVisible();
    await expect(spinner(page)).toBeVisible();
    await expect(alertCard(page, 'Couldn’t load enquiry')).toBeVisible({ timeout: 16_000 });
  });

  test('Enquiry Chat › unknown id shows “Enquiry not found”', async ({ page }) => {
    await fulfill(page, { method: 'GET', path: '/api/profile', action: 'myEnquiries' }, 200, [
      { id: 'missing', enquiryType: 'Other', status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastMessage: 'x', hasUnread: false },
    ]);
    await openFromProfile(page, 'My Enquiries', 'My Enquiries');
    await T(page, 'Other').click();
    await expectAlert(page, 'Couldn’t load enquiry', 'Enquiry not found');
  });

  test('Enquiry Chat › live refresh: a new club reply appears within the 12 s poll', async ({ page }) => {
    test.setTimeout(45_000);
    let calls = 0;
    await intercept(page, { method: 'GET', path: '/api/profile', action: 'enquiryThread' }, async (route) => {
      calls++;
      const resp = await route.fetch();
      const json = await resp.json();
      if (calls > 1) json.messages.push({ id: 'live', senderType: 'admin', body: 'See you on the first tee.', createdAt: new Date().toISOString() });
      await route.fulfill({ response: resp, json });
    });
    await openFromProfile(page, 'My Enquiries', 'My Enquiries');
    await T(page, 'Bookings').click();
    await expect(T(page, 'Thanks, we have booked your tee time.')).toBeVisible();
    await expect(T(page, 'See you on the first tee.')).toBeVisible({ timeout: 16_000 });
  });

  test('Enquiry Chat › Resolved badge; a Resolved thread can still be replied to', async ({ page }) => {
    await intercept(page, { method: 'GET', path: '/api/profile', action: 'enquiryThread' }, async (route) => {
      const resp = await route.fetch();
      const json = await resp.json();
      await route.fulfill({ response: resp, json: { ...json, status: 'resolved' } });
    });
    await openFromProfile(page, 'My Enquiries', 'My Enquiries');
    await T(page, 'Bookings').click();
    await expect(T(page, 'Resolved')).toBeVisible();
    await page.getByPlaceholder('Type a message…').fill('One more thing');
    await expect(btn(page, 'Send message')).toBeEnabled();
    await btn(page, 'Send message').click();
    await expect(T(page, 'One more thing')).toBeVisible();
  });

  test('Enquiry Chat › replying to a Resolved enquiry reopens it to Pending', async ({ page }) => {
    await scenario(page, { resolvedEnquiry: true });
    await openFromProfile(page, 'My Enquiries', 'My Enquiries');
    await expect(T(page, 'Resolved')).toBeVisible();
    await T(page, 'Bookings').click();
    await expect(heading(page, 'Bookings')).toBeVisible();
    await page.getByPlaceholder('Type a message…').fill('Can we move it to Sunday?');
    await btn(page, 'Send message').click();
    await expect(T(page, 'Can we move it to Sunday?')).toBeVisible();
    expect((await apiGet(page, '/api/profile?action=enquiryThread&id=e1')).status).toBe('pending');
    await back(page);
    await expect(heading(page, 'My Enquiries')).toBeVisible();
    await expect(T(page, 'Pending')).toBeVisible();
    await expect(T(page, 'Resolved')).toHaveCount(0);
  });

  test('Enquiry Chat › reached from a Notifications row that carries an enquiry', async ({ page }) => {
    await openSignedIn(page);
    await page.getByRole('button', { name: /^Notifications/ }).click();
    await T(page, 'Your club replied').click();
    await expect(heading(page, 'Bookings')).toBeVisible();
    await expect(T(page, 'Chat in Progress')).toBeVisible();
  });

  test('Enquiry Chat › push-notification refresh and push-tap entry', async () => {
    test.skip(true, 'native only: foreground push refetch and push tap (web registers no push)');
  });
});

// ================================================================ Give Feedback

test.describe('Give Feedback', () => {
  test('Give Feedback › shows hero, three categories, message box and Send Feedback', async ({ page }) => {
    await openFromProfile(page, 'Give Feedback', 'Give Feedback');
    await expect(T(page, 'Help Us Improve Flagrr')).toBeVisible();
    await expect(T(page, 'What kind of feedback is this?')).toBeVisible();
    for (const c of ['Bug Found', 'General Feedback', 'Improvement Idea']) await expect(T(page, c)).toBeVisible();
    await expect(T(page, 'Your message')).toBeVisible();
    await expect(page.getByPlaceholder("What's on your mind?")).toBeVisible();
    await expect(T(page, 'Send Feedback')).toBeVisible();
  });

  test('Give Feedback › no category → “Choose a category”; then no message → “Add a message”', async ({ page }) => {
    await openFromProfile(page, 'Give Feedback', 'Give Feedback');
    await page.getByPlaceholder("What's on your mind?").fill('Something');
    await T(page, 'Send Feedback').click();
    await expectAlert(page, 'Choose a category', 'Let us know what kind of feedback this is before sending.');
    await tapAlert(page, 'Choose a category', 'OK');
    await T(page, 'Bug Found').click();
    await page.getByPlaceholder("What's on your mind?").fill('   ');
    await T(page, 'Send Feedback').click();
    await expectAlert(page, 'Add a message', 'Tell us more before sending your feedback.');
  });

  test('Give Feedback › success (spinner) shows “Thanks for the feedback!” and Back returns to Profile', async ({ page }) => {
    await openFromProfile(page, 'Give Feedback', 'Give Feedback');
    let sent: any = null;
    page.on('request', (r) => { if (r.url().includes('action=feedbackCreate')) sent = r.postDataJSON(); });
    await T(page, 'Bug Found').click();
    await T(page, 'Improvement Idea').click(); // single choice: last tap wins
    await page.getByPlaceholder("What's on your mind?").fill('  Add a dark scorecard.  ');
    const release = await hold(page, { method: 'POST', path: '/api/profile', action: 'feedbackCreate' });
    await T(page, 'Send Feedback').click();
    await expectBusy(page, 'Send Feedback');
    release();
    await expectAlert(page, 'Thanks for the feedback!', 'The Flagrr team has received it.', ['Back']);
    expect(sent.message).toBe('Add a dark scorecard.');
    expect(sent.category).toBeTruthy();
    await tapAlert(page, 'Thanks for the feedback!', 'Back');
    await expectOnProfile(page);
    // Feedback never appears in My Enquiries.
    await btn(page, 'My Enquiries').click();
    await expect(T(page, 'Add a dark scorecard.')).toHaveCount(0);
  });

  test('Give Feedback › failure shows “Couldn’t send feedback” and keeps the form', async ({ page }) => {
    await scenario(page, { fail: { 'POST /api/profile?action=feedbackCreate': 500 } });
    await openFromProfile(page, 'Give Feedback', 'Give Feedback');
    await T(page, 'General Feedback').click();
    await page.getByPlaceholder("What's on your mind?").fill('Great app');
    await T(page, 'Send Feedback').click();
    await expectAlert(page, 'Couldn’t send feedback', SERVER); // friendly wording (owner decision 24 Nov 2026)
    await tapAlert(page, 'Couldn’t send feedback', 'OK');
    await expect(page.getByPlaceholder("What's on your mind?")).toHaveValue('Great app');
  });

  test('Give Feedback › network failure shows the generic message', async ({ page }) => {
    await intercept(page, { method: 'POST', path: '/api/profile', action: 'feedbackCreate' }, (route) => route.abort('failed'));
    await openFromProfile(page, 'Give Feedback', 'Give Feedback');
    await T(page, 'General Feedback').click();
    await page.getByPlaceholder("What's on your mind?").fill('Great app');
    await T(page, 'Send Feedback').click();
    await expectAlert(page, 'Couldn’t send feedback', NETWORK); // friendly wording (owner decision 24 Nov 2026)
  });
});

// ================================================================ Terms and Privacy

test.describe('Terms and Privacy', () => {
  // Terms | Privacy toggle on one screen (owner decision 24 Nov 2026): one document shows at a time
  // (they were stacked in one scroll with a divider).
  test('Terms › toggle shows Terms of Use or Privacy Policy, each with last updated, all section headings in order and bullets', async ({ page }) => {
    await openFromProfile(page, 'Terms and Privacy', 'Terms and Privacy');
    const terms = ['1. Acceptance of These Terms', '2. What Flagrr Is', '3. Eligibility', '4. Your Account', '5. Flagrr Cash and Rewards', '6. Submitting Receipts', '7. Acceptable Use', '8. Your Relationship With Your Club', '9. Intellectual Property', '10. Suspension and Termination', '11. Disclaimers', '12. Changes to These Terms', '13. Governing Law', '14. Contact'];
    const privacy = ['1. Introduction', '2. Information We Collect', '3. How We Use Your Information', '4. How We Share Your Information', '5. Data Retention', '6. Your Rights and Choices', '7. Push Notifications', '8. Security', '9. Children’s Privacy', '10. Changes to This Policy', '11. Contact Us'];
    const toggle = page.getByRole('radiogroup', { name: 'Document' }).filter({ visible: true });
    await expect(toggle.getByRole('radio')).toHaveText(['Terms of Use', 'Privacy Policy']);
    const docHeadings = () => page.getByRole('heading').filter({ visible: true }).filter({ hasText: /^(\d+\. .+|Terms of Use|Privacy Policy)$/ }).allTextContents();

    // Opens on Terms of Use.
    await expect(T(page, 'Last updated: July 2026')).toBeVisible();
    await expect.poll(docHeadings).toEqual(['Terms of Use', ...terms]);
    // Single-paragraph sections have no bullet; multi-paragraph ones do (5 under Terms §5).
    await expect(page.getByText(/^Welcome to Flagrr\. These Terms of Use/)).toBeVisible();
    expect(await page.getByText(/^• /).filter({ visible: true }).count()).toBe(5);

    await toggle.getByRole('radio', { name: 'Privacy Policy' }).click();
    await expect(T(page, 'Last updated: July 2026')).toBeVisible();
    await expect.poll(docHeadings).toEqual(['Privacy Policy', ...privacy]);
    await expect(T(page, '1. Acceptance of These Terms')).toHaveCount(0);
    expect(await page.getByText(/^• /).filter({ visible: true }).count()).toBe(4 + 4 + 5);

    await toggle.getByRole('radio', { name: 'Terms of Use' }).click();
    await expect.poll(docHeadings).toEqual(['Terms of Use', ...terms]);
    await back(page);
    await expectOnProfile(page);
  });

  // Landing's "Privacy Notice" / "Terms of Use" links and Sign up open TermsPrivacy with { section }; the toggle
  // starts on that side (Terms when absent), signed in and signed out. No control in this area passes the param,
  // so the test opens the route the way those links do, through the screen's own navigation object.
  async function openTermsWith(page: Page, anchorText: string, params?: { section: 'terms' | 'privacy' }) {
    await page.evaluate(
      ([text, p]) => {
        const el = Array.from(document.querySelectorAll('div, span')).find((n) => n.textContent === text && (n as HTMLElement).offsetParent !== null);
        if (!el) throw new Error(`no element with text ${text}`);
        const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'))!;
        let f = (el as any)[key];
        while (f && !f.memoizedProps?.navigation?.navigate) f = f.return;
        if (!f) throw new Error('no navigation in the tree');
        f.memoizedProps.navigation.navigate('TermsPrivacy', p ?? undefined);
      },
      [anchorText, params ?? null] as const,
    );
    await expect(heading(page, 'Terms and Privacy')).toBeVisible();
  }
  // The selected side's label is drawn in ink (as the screen title), the other in muted grey.
  const selectedDoc = async (page: Page) => {
    const ink = await heading(page, 'Terms and Privacy').evaluate((el) => getComputedStyle(el).color);
    return page.getByRole('radiogroup', { name: 'Document' }).filter({ visible: true }).evaluate((g, inkColor) => {
      const radios = Array.from(g.querySelectorAll('[role="radio"]')) as HTMLElement[];
      const on = radios.filter((r) => getComputedStyle(r.querySelector('div[dir], span, div') ?? r).color === inkColor);
      return on.length === 1 ? on[0].textContent : null;
    }, ink);
  };

  test('Terms › section param: { section: "privacy" } opens on Privacy Policy, "terms" or none on Terms of Use (signed in)', async ({ page }) => {
    await openProfile(page);
    await openTermsWith(page, 'Reward Activity', { section: 'privacy' });
    await expect.poll(() => selectedDoc(page)).toBe('Privacy Policy');
    await expect(heading(page, 'Privacy Policy')).toBeVisible();
    await expect(T(page, '1. Introduction')).toBeVisible();
    await back(page);
    await openTermsWith(page, 'Reward Activity', { section: 'terms' });
    await expect.poll(() => selectedDoc(page)).toBe('Terms of Use');
    await expect(T(page, '1. Acceptance of These Terms')).toBeVisible();
    await back(page);
    await openTermsWith(page, 'Reward Activity');
    await expect.poll(() => selectedDoc(page)).toBe('Terms of Use');
  });

  test('Terms › section param works signed out (Auth stack): { section: "privacy" } opens on Privacy Policy', async ({ page }) => {
    await openSignedOut(page);
    await expect(page.getByText('Get Started')).toBeVisible();
    await openTermsWith(page, 'Get Started', { section: 'privacy' });
    await expect.poll(() => selectedDoc(page)).toBe('Privacy Policy');
    await expect(T(page, '1. Introduction')).toBeVisible();
    await back(page);
    await expect(page.getByText('Get Started')).toBeVisible();
  });
});

// ================================================================ My Feedback
// Owner decisions 24 and 25 Nov 2026 (mockup approved 25 Nov): members read the Flagrr team's
// replies to Give Feedback and reply in the thread. Sample data: fb1 "Improvement Idea" (In progress,
// unread team reply) and fb2 "General Feedback" (Resolved, all read).

test.describe('My Feedback', () => {
  const FB1_REPLY = 'Thanks for the idea. We have passed it to the team working on the hole maps.';

  test('Profile row › “My Feedback” under Give Feedback with an unread dot; the dot clears once the thread is read', async ({ page }) => {
    await openProfile(page);
    const row = btn(page, 'My Feedback, unread reply');
    await expect(row).toBeVisible();
    await expect(row.getByRole('img', { name: 'Unread reply' })).toHaveCount(1);
    await row.click();
    await expect(heading(page, 'My Feedback')).toBeVisible();
    await T(page, 'Improvement Idea').click();
    await expect(heading(page, 'Improvement Idea')).toBeVisible();
    await back(page);
    await expect(heading(page, 'My Feedback')).toBeVisible();
    await back(page);
    await expectOnProfile(page);
    await expect(btn(page, 'My Feedback')).toBeVisible();
    await expect(btn(page, 'My Feedback, unread reply')).toHaveCount(0);
    await expect(btn(page, 'My Feedback').getByRole('img', { name: 'Unread reply' })).toHaveCount(0);
  });

  test('List › category, latest message, status words, relative time; newest first; unread dot on the unread row only', async ({ page }) => {
    await openFromProfile(page, 'My Feedback, unread reply', 'My Feedback');
    await expect(page.getByText(/^(Improvement Idea|General Feedback)$/).filter({ visible: true })).toHaveText(['Improvement Idea', 'General Feedback']);
    await expect(T(page, FB1_REPLY)).toBeVisible();
    await expect(T(page, 'In progress')).toBeVisible();
    await expect(T(page, '1d ago')).toBeVisible();
    await expect(T(page, 'Glad you like it, thanks for telling us.')).toBeVisible();
    await expect(T(page, 'Resolved')).toBeVisible();
    await expect(T(page, '21d ago')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Improvement Idea, unread reply. In progress', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'General Feedback. Resolved', exact: true })).toBeVisible();
  });

  test('List › feedback just sent shows first, as “Sent” and “just now”', async ({ page }) => {
    await apiPost(page, '/api/profile?action=feedbackCreate', { category: 'bug', message: 'The scorecard did not save my last hole.' });
    await openFromProfile(page, 'My Feedback, unread reply', 'My Feedback');
    await expect(page.getByText(/^(Bug Found|Improvement Idea|General Feedback)$/).filter({ visible: true })).toHaveText(['Bug Found', 'Improvement Idea', 'General Feedback']);
    await expect(T(page, 'Sent')).toBeVisible();
    await expect(T(page, 'just now')).toBeVisible();
  });

  test('List › “Give Feedback” (+) opens Give Feedback', async ({ page }) => {
    await openFromProfile(page, 'My Feedback, unread reply', 'My Feedback');
    await btn(page, 'Give Feedback').click();
    await expect(heading(page, 'Give Feedback')).toBeVisible();
    await back(page);
    await expect(heading(page, 'My Feedback')).toBeVisible();
  });

  test('List › empty state “No feedback yet” with Give Feedback, which opens Give Feedback', async ({ page }) => {
    await fulfill(page, { method: 'GET', path: '/api/profile', action: 'myFeedback' }, 200, []);
    await openFromProfile(page, 'My Feedback', 'My Feedback');
    await expect(heading(page, 'No feedback yet')).toBeVisible();
    await expect(T(page, 'Ideas, bugs and kind words you send from Give Feedback show up here, with the Flagrr team’s replies.')).toBeVisible();
    await page.getByRole('button', { name: 'Give Feedback', exact: true }).filter({ visible: true }).last().click();
    await expect(heading(page, 'Give Feedback')).toBeVisible();
  });

  test('List › failed load shows “Couldn’t load your feedback” with Try again, which loads the list', async ({ page }) => {
    await scenario(page, { fail: { 'GET /api/profile?action=myFeedback': 500 } });
    await openFromProfile(page, 'My Feedback', 'My Feedback'); // no dot: Profile's own check failed quietly
    await expect(heading(page, 'Couldn’t load your feedback')).toBeVisible();
    await expect(T(page, SERVER)).toBeVisible();
    await noAlert(page);
    await scenario(page, { fail: { 'GET /api/profile?action=myFeedback': 0 } }); // 0 = stop failing
    const loads = page.waitForRequest((r) => r.url().includes('action=myFeedback') && r.method() === 'GET');
    await btn(page, 'Try again').click();
    await loads;
    await expect(T(page, 'Improvement Idea')).toBeVisible();
    await expect(heading(page, 'Couldn’t load your feedback')).toHaveCount(0);
  });

  test('Thread › title, status, member bubble, “Flagrr Support” reply, en-ZA times, message box; opening marks it read', async ({ page }) => {
    const before = await apiGet(page, '/api/profile?action=myFeedback');
    expect(before.find((f: any) => f.id === 'fb1').hasUnread).toBe(true);
    await openFromProfile(page, 'My Feedback, unread reply', 'My Feedback');
    await T(page, 'Improvement Idea').click();
    await expect(heading(page, 'Improvement Idea')).toBeVisible();
    await expect(T(page, 'In progress')).toBeVisible();
    await expect(T(page, 'Could the hole map show the distance to the back of the green too?')).toBeVisible();
    await expect(T(page, FB1_REPLY)).toBeVisible();
    await expect(T(page, 'Flagrr Support')).toHaveCount(1);
    const thread = await apiGet(page, '/api/profile?action=feedbackThread&id=fb1');
    for (const m of thread.messages) {
      const ts = await page.evaluate((iso) => new Date(iso).toLocaleString('en-ZA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), m.createdAt);
      await expect(T(page, ts).first()).toBeVisible();
    }
    await expect(page.getByPlaceholder('Type a message…')).toBeVisible();
    await expect(btn(page, 'Send message')).toBeDisabled();
    const after = await apiGet(page, '/api/profile?action=myFeedback');
    expect(after.find((f: any) => f.id === 'fb1').hasUnread).toBe(false);
  });

  test('Thread › loading shows the “Feedback” title and a spinner', async ({ page }) => {
    await openFromProfile(page, 'My Feedback, unread reply', 'My Feedback');
    const release = await hold(page, { method: 'GET', path: '/api/profile', action: 'feedbackThread' });
    await T(page, 'Improvement Idea').click();
    await expect(heading(page, 'Feedback')).toBeVisible();
    await expect(spinner(page)).toBeVisible();
    release();
    await expect(heading(page, 'Improvement Idea')).toBeVisible();
  });

  test('Thread › reply: spinner while sending, bubble added, draft cleared, sent as { ticketId, message }', async ({ page }) => {
    await openFromProfile(page, 'My Feedback, unread reply', 'My Feedback');
    await T(page, 'Improvement Idea').click();
    const box = page.getByPlaceholder('Type a message…');
    await box.fill('   ');
    await expect(btn(page, 'Send message')).toBeDisabled();
    await box.fill('  Brilliant, thank you!  ');
    let sent: any = null;
    page.on('request', (r) => { if (r.url().includes('action=feedbackReply')) sent = r.postDataJSON(); });
    const release = await hold(page, { method: 'POST', path: '/api/profile', action: 'feedbackReply' });
    await btn(page, 'Send message').click();
    await expect(spinner(btn(page, 'Send message'))).toBeVisible();
    release();
    await expect(T(page, 'Brilliant, thank you!')).toBeVisible();
    await expect(box).toHaveValue('');
    expect(sent).toEqual({ ticketId: 'fb1', message: 'Brilliant, thank you!' });
    await expect(T(page, 'In progress')).toBeVisible();
    const t = await apiGet(page, '/api/profile?action=feedbackThread&id=fb1');
    expect(t.messages.at(-1)).toMatchObject({ senderType: 'requester', body: 'Brilliant, thank you!' });
  });

  test('Thread › a reply on a Resolved thread reopens it (“Sent”), and it moves to the top of the list', async ({ page }) => {
    await openFromProfile(page, 'My Feedback, unread reply', 'My Feedback');
    await T(page, 'General Feedback').click();
    await expect(heading(page, 'General Feedback')).toBeVisible();
    await expect(T(page, 'Resolved')).toBeVisible();
    await page.getByPlaceholder('Type a message…').fill('One more idea: a dark scorecard.');
    await btn(page, 'Send message').click();
    await expect(T(page, 'One more idea: a dark scorecard.')).toBeVisible();
    await expect(T(page, 'Sent')).toBeVisible();
    await expect(T(page, 'Resolved')).toHaveCount(0);
    await back(page);
    await expect(heading(page, 'My Feedback')).toBeVisible();
    await expect(page.getByText(/^(Improvement Idea|General Feedback)$/).filter({ visible: true })).toHaveText(['General Feedback', 'Improvement Idea']);
  });

  test('Thread › send failure shows “Couldn’t send message” and keeps the draft', async ({ page }) => {
    await scenario(page, { fail: { 'POST /api/profile?action=feedbackReply': 500 } });
    await openFromProfile(page, 'My Feedback, unread reply', 'My Feedback');
    await T(page, 'Improvement Idea').click();
    await page.getByPlaceholder('Type a message…').fill('Hello?');
    await btn(page, 'Send message').click();
    await expectAlert(page, 'Couldn’t send message', SERVER);
    await tapAlert(page, 'Couldn’t send message', 'OK');
    await expect(page.getByPlaceholder('Type a message…')).toHaveValue('Hello?');
  });

  test('Thread › load failure shows “Couldn’t load feedback” and the spinner stays', async ({ page }) => {
    await openFromProfile(page, 'My Feedback, unread reply', 'My Feedback');
    await scenario(page, { fail: { 'GET /api/profile?action=feedbackThread': 500 } });
    await T(page, 'Improvement Idea').click();
    await expectAlert(page, 'Couldn’t load feedback', SERVER);
    await tapAlert(page, 'Couldn’t load feedback', 'OK');
    await expect(heading(page, 'Feedback')).toBeVisible();
    await expect(spinner(page)).toBeVisible();
    await expect(page.getByPlaceholder('Type a message…')).toHaveCount(0);
  });

  test('Notification › “Reply to your feedback” opens its thread (no View link) and marks it read', async ({ page }) => {
    const now = new Date().toISOString();
    await fulfill(page, { method: 'GET', path: '/api/notifications' }, 200, [
      { id: 'nf1', title: 'Reply to your feedback', body: `Flagrr Support replied: ${FB1_REPLY}`, date: now, read: false, enquiryId: null, supportTicketId: 'fb1' },
    ]);
    await openSignedIn(page);
    await page.getByRole('button', { name: /^Notifications/ }).filter({ visible: true }).first().click();
    await expect(heading(page, 'Notifications')).toBeVisible();
    await expect(btn(page, 'View, Reply to your feedback')).toHaveCount(0);
    let marked = false;
    page.on('request', (r) => { if (r.url().includes('/api/notifications') && r.method() === 'POST') marked = true; });
    await btn(page, `Reply to your feedback. Flagrr Support replied: ${FB1_REPLY}`).click();
    await expect(heading(page, 'Improvement Idea')).toBeVisible();
    await expect(T(page, 'Flagrr Support')).toBeVisible();
    await expect.poll(() => marked).toBe(true);
  });
});
