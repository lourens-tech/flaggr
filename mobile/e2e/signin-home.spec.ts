import { test, expect, type Page, type Locator, type Route } from '@playwright/test';
import { API, RESET_CODE, TEST_EMAIL, TEST_PASSWORD, TOKEN, appAlert, openSignedIn, reset, scenario, tab } from './helpers';

// Click-through for inventory section A: Sign-in, Home, Notifications, Member
// Tiers and app-wide behaviour (docs/Member-App-Functionality-Inventory.md).
//
// Where the sample-data mock cannot produce a state (an empty chart, a one-week
// streak, an ad with a link…), the test patches that one response in the browser
// with page.route; the app code and the mock stay untouched.

test.describe.configure({ timeout: 30_000 });
test.beforeEach(async ({ page }) => reset(page));

// ---------------------------------------------------------------- helpers

const USER_ID = '33333333-3333-4333-8333-333333333333';
const PLACEHOLDER_ID = '99999999-9999-4999-8999-999999999999';
const OTHER_CLUB_ID = '44444444-4444-4444-8444-444444444444';
const POPUP_KEY = `flagrr_not_listed_popup_opens_${USER_ID}`;
const POPUP_TITLE = "You're Almost In the Family";
const POPUP_BODY =
  "We couldn't find your golf club on Flagrr yet, so there's no rewards catalogue to show you just yet. Ask your club to join Flagrr, or get in touch with our support team and we'll help make it happen.";

// Ionicons render as private-use glyphs on web. Only used where the icon itself
// is the state (keep-me-logged-in, read/unread, selected club, the back chevron
// on the auth screens, which has no accessibility label).
const GLYPH = {
  chevronBack: '',
  checkmarkCircle: '',
  ellipseOutline: '',
  checkmark: '',
  bell: '',
  checkmarkCircleOutline: '',
  chevronForward: '',
};

const vis = (l: Locator) => l.filter({ visible: true });
const text = (page: Page, s: string | RegExp, exact = true) => vis(page.getByText(s, { exact })).first();
// Auth screens stay mounted (hidden) under the one on top, so every lookup is
// limited to what is visible.
const field = (page: Page, placeholder: string) => vis(page.getByPlaceholder(placeholder, { exact: true })).first();
const heading = (page: Page, name: string) => vis(page.getByRole('heading', { name, exact: true })).first();
const button = (page: Page, name: string | RegExp, exact = true) =>
  vis(page.getByRole('button', typeof name === 'string' ? { name, exact } : { name })).first();

/** The back chevron on Login / Sign up / Forgot (no accessibility label in code). */
async function authBack(page: Page) {
  await text(page, GLYPH.chevronBack).click();
}

async function expectAlert(page: Page, title: string, message?: string) {
  const a = appAlert(page);
  await expect(a.getByRole('heading', { name: title, exact: true })).toBeVisible();
  if (message !== undefined) await expect(a.getByText(message, { exact: true })).toBeVisible();
  return a;
}

async function dismissAlert(page: Page, label = 'OK') {
  await appAlert(page).getByRole('button', { name: label, exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
}

/** Authenticated call straight to the mock (to set up rounds and the like). */
async function apiPost(page: Page, path: string, data: unknown) {
  const r = await page.request.post(`${API}${path}`, { headers: { Authorization: `Bearer ${TOKEN}` }, data });
  expect(r.ok()).toBeTruthy();
  return r.json();
}

/** Patch the JSON of every matching API response in the browser. */
async function patchJson(page: Page, match: RegExp, fn: (json: any, url: URL) => any) {
  await page.route(match, async (route: Route) => {
    const res = await route.fetch();
    if (!res.ok()) return route.fulfill({ response: res });
    const json = await res.json();
    const out = fn(json, new URL(route.request().url()));
    await route.fulfill({ response: res, json: out === undefined ? json : out });
  });
}
const ME = /\/api\/me(\?|$)/;
const patchMe = (page: Page, fn: (me: any, url: URL) => void) => patchJson(page, ME, (j, u) => { fn(j, u); });

/** Delay one API path (to observe a loading state). */
async function delay(page: Page, match: RegExp | string, ms: number) {
  await page.route(match, async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

/** Answer one API path with a given status and error body (e.g. the 429 throttle copy). */
async function answer(page: Page, match: RegExp | string, status: number, error: string) {
  await page.route(match, (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error }) }));
}

/** Make one API path fail at the network level (no response). */
async function offline(page: Page, match: RegExp | string) {
  await page.route(match, (route) => route.abort('internetdisconnected'));
}

const storage = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

/** Is the screen's ground colour dark? (theme check that survives a redesign of the layout). */
async function groundIsDark(page: Page) {
  return page.evaluate(() => {
    let el = document.elementFromPoint(4, 300) as HTMLElement | null;
    while (el) {
      const m = getComputedStyle(el).backgroundColor.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const [r, g, b, a = 1] = m[1].split(',').map(Number);
        if (a > 0.5) return 0.299 * r + 0.587 * g + 0.114 * b < 128;
      }
      el = el.parentElement;
    }
    return false;
  });
}

/** Open the app with a stored token but without waiting for Home (restore can fail). */
async function bootWithToken(page: Page, token = TOKEN, theme?: string) {
  await page.addInitScript(([t, th]) => {
    localStorage.setItem('flagrr_auth_token', t);
    if (th) localStorage.setItem('flagrr_theme_preference', th);
  }, [token, theme ?? ''] as const);
  await page.goto('/');
}

/** Open Landing signed out. (helpers.openSignedOut clears the token on every
 *  navigation, which would hide whether a reload restores the session.) */
async function openLanding(page: Page) {
  await page.goto('/');
  await expect(button(page, 'Get Started')).toBeVisible();
}

async function gotoLogin(page: Page) {
  await openLanding(page);
  await page.getByText('I already have an account').click();
  await expect(heading(page, 'Welcome back')).toBeVisible();
}

async function loginAs(page: Page, email = TEST_EMAIL, password = TEST_PASSWORD) {
  await field(page, 'Email').fill(email);
  await field(page, 'Password').fill(password);
  await button(page, 'Login').click();
}

const homeVisible = (page: Page) => expect(text(page, 'Flagrr Cash')).toBeVisible();

async function gotoSignUp1(page: Page) {
  await openLanding(page);
  await page.getByText('Get Started').click();
  await expect(heading(page, 'Create your account')).toBeVisible();
}

async function fillStep1(page: Page, o: { name?: string; email?: string; phone?: string; dob?: string; club?: string; referral?: string } = {}) {
  await field(page, 'Full Name').fill(o.name ?? 'Thandi van der Merwe');
  await field(page, 'Email').fill(o.email ?? 'thandi@flagrr.test');
  if (o.phone !== undefined) await field(page, 'Phone Number').fill(o.phone);
  await page.getByLabel('Date of Birth').fill(o.dob ?? '1990-05-04');
  await expect(button(page, 'Golf Club')).toBeEnabled();
  await button(page, 'Golf Club').click();
  await button(page, o.club ?? 'Strand Golf Club').click();
  if (o.referral !== undefined) await field(page, 'Referral Code (optional)').fill(o.referral);
}

async function gotoSignUp2(page: Page, o: Parameters<typeof fillStep1>[1] = {}) {
  await gotoSignUp1(page);
  await fillStep1(page, o);
  await button(page, 'Next Step').click();
  await expect(heading(page, 'Set a password')).toBeVisible();
}

async function gotoForgot(page: Page) {
  await gotoLogin(page);
  await page.getByText('Recover here.').click();
  await expect(text(page, 'Reset Password')).toBeVisible();
}

async function gotoResetStep(page: Page, email = TEST_EMAIL) {
  await gotoForgot(page);
  await field(page, 'Email').fill(email);
  await button(page, 'Send Code').click();
  await expect(field(page, '6-digit code')).toBeVisible();
}

/** A PillButton while submitting: disabled with a spinner in place of its label.
 *  (aria-busy is not rendered on web; see the fixme in "Accessibility states".) */
async function expectBusy(page: Page, label: string) {
  // The screen underneath (e.g. Landing) can hold a button with the same name, so pick the one showing the spinner.
  // On web the spinner's own box is 0 px wide (flex: 0 maps to 0 1 0%); its graphic overflows it and is drawn centred,
  // so check the graphic, the hidden label and the disabled button: what the member sees.
  const b = vis(page.getByRole('button', { name: label, exact: true }).filter({ has: page.locator('[role="progressbar"]') })).first();
  await expect(b).toBeVisible();
  await expect(b.locator('[role="progressbar"] > *').first()).toBeVisible();
  await expect(b.getByText(label, { exact: true })).toHaveCount(0);
  await expect(b).toBeDisabled();
}

const ringButton = (page: Page) => button(page, /^Member tiers:/);
const bell = (page: Page) => button(page, /^Notifications/);
const statsRadio = (page: Page, name: 'Month' | 'Year' | 'All') => vis(page.getByRole('radiogroup', { name: 'Stats period' })).first().getByRole('radio', { name, exact: true });

// =====================================================================
test.describe('Landing', () => {
  test('Landing › shows headline, legal line and the three ways in (web build shows the admin link)', async ({ page }) => {
    await openLanding(page);
    await expect(heading(page, 'Play. Earn. Redeem. Repeat.')).toBeVisible();
    for (const w of ['Play.', 'Earn.', 'Redeem.', 'Repeat.']) await expect(text(page, w)).toBeVisible();
    await expect(text(page, "By continuing, you're accepting our Terms of Use and Privacy Notice")).toBeVisible();
    await expect(button(page, 'Get Started')).toBeVisible();
    await expect(button(page, 'I already have an account')).toBeVisible();
    await expect(button(page, 'Golf Course Admin Login')).toBeVisible();
  });

  test('Landing › “Get Started” opens Sign up step 1 and back returns to Landing', async ({ page }) => {
    await gotoSignUp1(page);
    await authBack(page);
    await expect(button(page, 'Get Started')).toBeVisible();
  });

  test('Landing › “I already have an account” opens Login and back returns to Landing', async ({ page }) => {
    await gotoLogin(page);
    await authBack(page);
    await expect(button(page, 'Get Started')).toBeVisible();
  });

  test('Landing › “Golf Course Admin Login” opens the admin login (web build only)', async ({ page }) => {
    await openLanding(page);
    await button(page, 'Golf Course Admin Login').click();
    await expect(field(page, 'Admin Email or Staff Username')).toBeVisible();
  });

  test('Landing › “Terms of Use” and “Privacy Notice” are plain text (tapping does nothing)', async ({ page }) => {
    await openLanding(page);
    await expect(page.getByRole('link', { name: /Terms of Use|Privacy Notice/ })).toHaveCount(0);
    await text(page, 'Terms of Use').click();
    await text(page, 'Privacy Notice').click();
    await expect(button(page, 'Get Started')).toBeVisible();
  });

  test.skip('Landing › store build hides “Golf Course Admin Login”', () => {
    // native only: IS_STORE_BUILD is set only in the EAS preview/production profiles; the web export always shows the link.
  });
});

// =====================================================================
test.describe('Login', () => {
  test('Login › shows title, fields, keep-me-logged-in (on by default) and links', async ({ page }) => {
    await gotoLogin(page);
    await expect(field(page, 'Email')).toBeVisible();
    await expect(field(page, 'Password')).toHaveAttribute('type', 'password');
    await expect(text(page, 'Keep me logged in.', false)).toBeVisible();
    await expect(text(page, GLYPH.checkmarkCircle)).toBeVisible(); // on
    await expect(text(page, 'Forgot Password? Recover here.')).toBeVisible();
    await expect(text(page, "Don't have an account?")).toBeVisible();
    await expect(text(page, 'Sign Up!')).toBeVisible();
  });

  test('Login › “Login” is disabled until both email and password are filled', async ({ page }) => {
    await gotoLogin(page);
    const login = button(page, 'Login');
    await expect(login).toBeDisabled();
    await field(page, 'Email').fill(TEST_EMAIL);
    await expect(login).toBeDisabled();
    await field(page, 'Password').fill('x');
    await expect(login).toBeEnabled();
    await field(page, 'Email').fill('');
    await expect(login).toBeDisabled();
  });

  test('Login › blank email shows “Email is required”, cleared by typing', async ({ page }) => {
    // On web the email input drops whitespace, so a blank email can only be submitted with the password return key.
    await gotoLogin(page);
    await field(page, 'Password').fill('whatever1');
    await field(page, 'Password').press('Enter');
    await expect(text(page, 'Email is required')).toBeVisible();
    await field(page, 'Email').pressSequentially('a');
    await expect(page.getByText('Email is required')).toHaveCount(0);
  });

  test('Login › malformed email shows “Enter a valid email address”', async ({ page }) => {
    await gotoLogin(page);
    await loginAs(page, 'not-an-email', 'whatever1');
    await expect(text(page, 'Enter a valid email address')).toBeVisible();
  });

  test('Login › password return key validates: “Password is required”, cleared by typing', async ({ page }) => {
    await gotoLogin(page);
    await field(page, 'Email').fill(TEST_EMAIL);
    await field(page, 'Password').press('Enter');
    await expect(text(page, 'Password is required')).toBeVisible();
    await field(page, 'Password').pressSequentially('a');
    await expect(page.getByText('Password is required')).toHaveCount(0);
  });

  test('Login › password return key with both fields empty shows both errors', async ({ page }) => {
    await gotoLogin(page);
    await field(page, 'Password').press('Enter');
    await expect(text(page, 'Email is required')).toBeVisible();
    await expect(text(page, 'Password is required')).toBeVisible();
  });

  test('Login › eye icon toggles password visibility (Show password / Hide password)', async ({ page }) => {
    await gotoLogin(page);
    const pw = field(page, 'Password');
    await pw.fill('secret123');
    await expect(pw).toHaveAttribute('type', 'password');
    await button(page, 'Show password').click();
    await expect(pw).not.toHaveAttribute('type', 'password');
    await button(page, 'Hide password').click();
    await expect(pw).toHaveAttribute('type', 'password');
  });

  test('Login › wrong password shows ‘Couldn’t log in’ / ‘Invalid email or password’, OK dismisses and stays on Login', async ({ page }) => {
    await gotoLogin(page);
    await loginAs(page, TEST_EMAIL, 'wrong-password');
    await expectAlert(page, 'Couldn’t log in', 'Invalid email or password');
    await dismissAlert(page);
    await expect(heading(page, 'Welcome back')).toBeVisible();
    expect(await storage(page, 'flagrr_auth_token')).toBeNull();
  });

  test('Login › 429 shows the throttle message', async ({ page }) => {
    await answer(page, `${API}/api/auth/login`, 429, 'Too many sign-in attempts. Try again in 15 minutes, or reset your password.');
    await gotoLogin(page);
    await loginAs(page);
    await expectAlert(page, 'Couldn’t log in', 'Too many sign-in attempts. Try again in 15 minutes, or reset your password.');
  });

  test('Login › no network shows ‘Something went wrong. Please try again.’', async ({ page }) => {
    await offline(page, `${API}/api/auth/login`);
    await gotoLogin(page);
    await loginAs(page);
    await expectAlert(page, 'Couldn’t log in', 'Something went wrong. Please try again.');
  });

  test('Login › server error shows the server message', async ({ page }) => {
    await scenario(page, { fail: { 'POST /api/auth/login': 500 } });
    await gotoLogin(page);
    await loginAs(page);
    await expectAlert(page, 'Couldn’t log in', 'Internal server error');
  });

  test('Login › data load failing after login shows ‘Couldn’t log in’ but the token is already stored', async ({ page }) => {
    await scenario(page, { fail: { 'GET /api/me': 500 } });
    await gotoLogin(page);
    await loginAs(page);
    await expectAlert(page, 'Couldn’t log in', 'Internal server error');
    expect(await storage(page, 'flagrr_auth_token')).toBe(TOKEN);
  });

  test('Login › “Login” shows a busy spinner while submitting', async ({ page }) => {
    await delay(page, `${API}/api/auth/login`, 1500);
    await gotoLogin(page);
    await loginAs(page);
    await expectBusy(page, 'Login');
    await homeVisible(page);
  });

  test('Login › success lands on Home, persists the token (keep me logged in on) and survives a reload', async ({ page }) => {
    await gotoLogin(page);
    await loginAs(page);
    await homeVisible(page);
    await expect(page.getByText('Welcome back')).toHaveCount(0); // the Auth stack is gone
    expect(await storage(page, 'flagrr_auth_token')).toBe(TOKEN);
    await page.reload();
    await homeVisible(page);
  });

  test('Login › password return key submits the login', async ({ page }) => {
    await gotoLogin(page);
    await field(page, 'Email').fill(TEST_EMAIL);
    await field(page, 'Password').fill(TEST_PASSWORD);
    await field(page, 'Password').press('Enter');
    await homeVisible(page);
  });

  test('Login › keep me logged in OFF: token kept in memory only, a reload returns to Landing', async ({ page }) => {
    await gotoLogin(page);
    await text(page, 'Keep me logged in.', false).click();
    await expect(text(page, GLYPH.ellipseOutline)).toBeVisible();
    await loginAs(page);
    await homeVisible(page);
    expect(await storage(page, 'flagrr_auth_token')).toBeNull();
    await page.reload();
    await expect(button(page, 'Get Started')).toBeVisible();
  });

  test('Login › keep-me-logged-in row toggles back on', async ({ page }) => {
    await gotoLogin(page);
    const row = text(page, 'Keep me logged in.', false);
    await row.click();
    await expect(text(page, GLYPH.ellipseOutline)).toBeVisible();
    await row.click();
    await expect(text(page, GLYPH.checkmarkCircle)).toBeVisible();
  });

  test('Login › “Recover here.” opens Reset Password; back returns to Login', async ({ page }) => {
    await gotoForgot(page);
    await authBack(page);
    await expect(heading(page, 'Welcome back')).toBeVisible();
  });

  test('Login › “Sign Up!” opens Sign up step 1', async ({ page }) => {
    await gotoLogin(page);
    await text(page, 'Sign Up!').click();
    await expect(heading(page, 'Create your account')).toBeVisible();
  });

  test.skip('Login › email return key does not move focus; keyboard-open layout', () => {
    // native only: software keyboard behaviour (return-key focus, keyboard covering the button) is not observable on the web build.
  });
});

// =====================================================================
test.describe('Sign up step 1', () => {
  test('Sign up 1 › shows step, title, every field, Next Step and the Login link', async ({ page }) => {
    await gotoSignUp1(page);
    await expect(text(page, 'Step 1 of 2', false)).toBeVisible();
    for (const p of ['Full Name', 'Email', 'Phone Number', 'Referral Code (optional)']) await expect(field(page, p)).toBeVisible();
    await expect(page.getByLabel('Date of Birth')).toBeVisible();
    await expect(button(page, 'Golf Club')).toBeVisible();
    await expect(button(page, 'Next Step')).toBeEnabled();
    await expect(text(page, 'Already have an account?')).toBeVisible();
    await expect(text(page, 'Login!')).toBeVisible();
  });

  test('Sign up 1 › club field reads “Loading golf clubs…” and is disabled while the list loads', async ({ page }) => {
    await delay(page, `${API}/api/courses`, 2000);
    await gotoSignUp1(page);
    const loading = button(page, 'Loading golf clubs…');
    await expect(loading).toBeVisible();
    await expect(loading).toBeDisabled();
    await expect(button(page, 'Golf Club')).toBeEnabled();
  });

  test('Sign up 1 › club sheet titled “Golf Club” lists clubs in server order with “My Club Isn\'t Listed Yet” last', async ({ page }) => {
    await gotoSignUp1(page);
    await button(page, 'Golf Club').click();
    const sheet = appAlert(page);
    await expect(sheet.getByText('Golf Club', { exact: true })).toBeVisible();
    await expect(sheet.getByRole('button')).toHaveText(['Strand Golf Club', 'Sample Links Golf Club', "My Club Isn't Listed Yet"]);
  });

  test('Sign up 1 › picking a club closes the sheet, shows it in the field, and marks it with a checkmark', async ({ page }) => {
    await gotoSignUp1(page);
    await button(page, 'Golf Club').click();
    await button(page, 'Sample Links Golf Club').click();
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);
    const field = button(page, 'Golf Club: Sample Links Golf Club');
    await expect(field).toBeVisible();
    await field.click();
    const sheet = appAlert(page);
    await expect(sheet.getByRole('button', { name: 'Sample Links Golf Club' })).toContainText(GLYPH.checkmark);
    await expect(sheet.getByRole('button', { name: 'Strand Golf Club', exact: true })).not.toContainText(GLYPH.checkmark);
  });

  test('Sign up 1 › tapping the sheet backdrop closes it without choosing', async ({ page }) => {
    await gotoSignUp1(page);
    await button(page, 'Golf Club').click();
    await expect(appAlert(page).getByRole('button', { name: 'Strand Golf Club' })).toBeVisible();
    await page.mouse.click(195, 60);
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);
    await expect(button(page, 'Golf Club')).toBeVisible();
  });

  test('Sign up 1 › club list failing to load gives an empty sheet and “Select your golf club” on Next', async ({ page }) => {
    await scenario(page, { fail: { 'GET /api/courses': 500 } });
    await gotoSignUp1(page);
    const field = button(page, 'Golf Club');
    await expect(field).toBeEnabled();
    await field.click();
    const sheet = appAlert(page);
    await expect(sheet.getByText('Golf Club', { exact: true })).toBeVisible();
    await expect(sheet.getByRole('button')).toHaveCount(0);
    await page.mouse.click(195, 60);
    await button(page, 'Next Step').click();
    await expect(text(page, 'Select your golf club')).toBeVisible();
  });

  test('Sign up 1 › Next with everything empty shows all four required errors', async ({ page }) => {
    await gotoSignUp1(page);
    await expect(button(page, 'Golf Club')).toBeEnabled();
    await button(page, 'Next Step').click();
    for (const m of ['Full name is required', 'Email is required', 'Date of birth is required', 'Select your golf club']) {
      await expect(text(page, m)).toBeVisible();
    }
    await expect(heading(page, 'Create your account')).toBeVisible();
  });

  test('Sign up 1 › malformed email shows “Enter a valid email address”', async ({ page }) => {
    await gotoSignUp1(page);
    await fillStep1(page, { email: 'thandi@nowhere' });
    await button(page, 'Next Step').click();
    await expect(text(page, 'Enter a valid email address')).toBeVisible();
  });

  test('Sign up 1 › each error clears when its field changes', async ({ page }) => {
    await gotoSignUp1(page);
    await expect(button(page, 'Golf Club')).toBeEnabled();
    await button(page, 'Next Step').click();
    await expect(text(page, 'Select your golf club')).toBeVisible();
    await field(page, 'Full Name').fill('Thandi');
    await expect(page.getByText('Full name is required')).toHaveCount(0);
    await field(page, 'Email').fill('t');
    await expect(page.getByText('Email is required')).toHaveCount(0);
    await page.getByLabel('Date of Birth').fill('1990-05-04');
    await expect(page.getByText('Date of birth is required')).toHaveCount(0);
    await button(page, 'Golf Club').click();
    await button(page, 'Strand Golf Club').click();
    await expect(page.getByText('Select your golf club')).toHaveCount(0);
  });

  test('Sign up 1 › Date of Birth on web is the browser date input, max = today', async ({ page }) => {
    await gotoSignUp1(page);
    const dob = page.getByLabel('Date of Birth');
    await expect(dob).toHaveAttribute('type', 'date');
    const today = await page.evaluate(() => new Date().toISOString().slice(0, 10));
    await expect(dob).toHaveAttribute('max', today);
    await dob.fill('2000-01-01');
    await expect(dob).toHaveValue('2000-01-01');
  });

  test.skip('Sign up 1 › iOS calendar modal with “Done”, Android dialog, “Jan 1, 2000” display, opens on 1 Jan 2000', () => {
    // native only: the native date pickers and their display format are not used on web (browser <input type="date">).
  });

  test('Sign up 1 › Next passes the split name, trimmed email, phone, date, club and referral to step 2 and on to sign-up', async ({ page }) => {
    await gotoSignUp1(page);
    await fillStep1(page, { name: '  Thandi van der Merwe ', email: '  thandi@flagrr.test ', phone: '0821234567', club: 'Sample Links Golf Club', referral: ' FLG7K2 ' });
    await button(page, 'Next Step').click();
    await expect(heading(page, 'Set a password')).toBeVisible();
    await expect(field(page, 'Email')).toHaveValue('thandi@flagrr.test');
    await field(page, 'Password').fill('Fairway2026');
    await field(page, 'Confirm Password').fill('Fairway2026');
    const req = page.waitForRequest((r) => r.url().endsWith('/api/auth/signup'));
    await button(page, 'Sign Up').click();
    const body = (await req).postDataJSON();
    expect(body).toMatchObject({
      firstName: 'Thandi', lastName: 'van der Merwe', email: 'thandi@flagrr.test', phone: '0821234567',
      dateOfBirth: '1990-05-04', courseId: OTHER_CLUB_ID, referralCode: 'FLG7K2', password: 'Fairway2026',
    });
    await homeVisible(page);
  });

  test('Sign up 1 › phone and referral are optional (empty referral and phone are not sent)', async ({ page }) => {
    await gotoSignUp2(page);
    await field(page, 'Password').fill('Fairway2026');
    await field(page, 'Confirm Password').fill('Fairway2026');
    const req = page.waitForRequest((r) => r.url().endsWith('/api/auth/signup'));
    await button(page, 'Sign Up').click();
    const body = (await req).postDataJSON();
    expect(body.referralCode).toBeUndefined();
    expect(body.phone).toBeUndefined();
    expect(body.lastName).toBe('van der Merwe');
    await homeVisible(page);
  });

  test('Sign up 1 › one-word name gives an empty last name', async ({ page }) => {
    await gotoSignUp2(page, { name: 'Thandi' });
    await field(page, 'Password').fill('Fairway2026');
    await field(page, 'Confirm Password').fill('Fairway2026');
    const req = page.waitForRequest((r) => r.url().endsWith('/api/auth/signup'));
    await button(page, 'Sign Up').click();
    expect((await req).postDataJSON()).toMatchObject({ firstName: 'Thandi', lastName: '' });
  });

  test('Sign up 1 › “Already have an account? Login!” opens Login', async ({ page }) => {
    await gotoSignUp1(page);
    await text(page, 'Login!').click();
    await expect(heading(page, 'Welcome back')).toBeVisible();
  });

  test('Sign up 1 › back from step 2 keeps the step 1 values', async ({ page }) => {
    await gotoSignUp2(page, { phone: '0821234567', referral: 'FLG7K2' });
    await authBack(page);
    await expect(heading(page, 'Create your account')).toBeVisible();
    await expect(field(page, 'Full Name')).toHaveValue('Thandi van der Merwe');
    await expect(field(page, 'Email')).toHaveValue('thandi@flagrr.test');
    await expect(field(page, 'Phone Number')).toHaveValue('0821234567');
    await expect(page.getByLabel('Date of Birth')).toHaveValue('1990-05-04');
    await expect(button(page, 'Golf Club: Strand Golf Club')).toBeVisible();
    await expect(field(page, 'Referral Code (optional)')).toHaveValue('FLG7K2');
  });
});

// =====================================================================
test.describe('Sign up step 2', () => {
  test('Sign up 2 › shows step, title, prefilled email, both passwords, hint and Sign Up (no Login link)', async ({ page }) => {
    await gotoSignUp2(page);
    await expect(text(page, 'Step 2 of 2', false)).toBeVisible();
    await expect(field(page, 'Email')).toHaveValue('thandi@flagrr.test');
    await expect(field(page, 'Password')).toHaveAttribute('type', 'password');
    await expect(field(page, 'Confirm Password')).toHaveAttribute('type', 'password');
    await expect(text(page, 'At least 8 characters')).toBeVisible();
    await expect(button(page, 'Sign Up')).toBeVisible();
    await expect(vis(page.getByText('Already have an account?'))).toHaveCount(0);
  });

  test('Sign up 2 › both eye toggles show and hide their password', async ({ page }) => {
    await gotoSignUp2(page);
    const shows = vis(page.getByRole('button', { name: 'Show password' }));
    await expect(shows).toHaveCount(2);
    await shows.nth(1).click();
    await expect(field(page, 'Confirm Password')).not.toHaveAttribute('type', 'password');
    await shows.first().click();
    await expect(field(page, 'Password')).not.toHaveAttribute('type', 'password');
    await vis(page.getByRole('button', { name: 'Hide password' })).first().click();
    await expect(field(page, 'Password')).toHaveAttribute('type', 'password');
  });

  test('Sign up 2 › empty email shows “Email is required”', async ({ page }) => {
    await gotoSignUp2(page);
    await field(page, 'Email').fill('');
    await field(page, 'Password').fill('Fairway2026');
    await field(page, 'Confirm Password').fill('Fairway2026');
    await button(page, 'Sign Up').click();
    await expect(text(page, 'Email is required')).toBeVisible();
  });

  test('Sign up 2 › edited malformed email shows “Enter a valid email address”', async ({ page }) => {
    await gotoSignUp2(page);
    await field(page, 'Email').fill('thandi@');
    await field(page, 'Password').fill('Fairway2026');
    await field(page, 'Confirm Password').fill('Fairway2026');
    await button(page, 'Sign Up').click();
    await expect(text(page, 'Enter a valid email address')).toBeVisible();
  });

  test('Sign up 2 › short password replaces the hint with “Password must be at least 8 characters”; mismatch not checked yet', async ({ page }) => {
    await gotoSignUp2(page);
    await field(page, 'Password').fill('short');
    await field(page, 'Confirm Password').fill('different');
    await button(page, 'Sign Up').click();
    await expect(text(page, 'Password must be at least 8 characters')).toBeVisible();
    await expect(page.getByText('At least 8 characters', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Passwords do not match')).toHaveCount(0);
  });

  test('Sign up 2 › mismatched confirmation shows “Passwords do not match”; typing in Password clears it', async ({ page }) => {
    await gotoSignUp2(page);
    await field(page, 'Password').fill('Fairway2026');
    await field(page, 'Confirm Password').fill('Fairway2027');
    await button(page, 'Sign Up').click();
    await expect(text(page, 'Passwords do not match')).toBeVisible();
    await field(page, 'Password').pressSequentially('x');
    await expect(page.getByText('Passwords do not match')).toHaveCount(0);
  });

  test('Sign up 2 › typing in Password clears the password error and brings the hint back', async ({ page }) => {
    await gotoSignUp2(page);
    await field(page, 'Password').fill('short');
    await button(page, 'Sign Up').click();
    await expect(text(page, 'Password must be at least 8 characters')).toBeVisible();
    await field(page, 'Password').pressSequentially('er');
    await expect(page.getByText('Password must be at least 8 characters')).toHaveCount(0);
    await expect(text(page, 'At least 8 characters')).toBeVisible();
  });

  test('Sign up 2 › existing email shows ‘Couldn’t create your account’ / ‘An account with this email already exists’', async ({ page }) => {
    await gotoSignUp2(page, { email: TEST_EMAIL });
    await field(page, 'Password').fill('Fairway2026');
    await field(page, 'Confirm Password').fill('Fairway2026');
    await button(page, 'Sign Up').click();
    await expectAlert(page, 'Couldn’t create your account', 'An account with this email already exists');
    await dismissAlert(page);
    await expect(heading(page, 'Set a password')).toBeVisible();
  });

  test('Sign up 2 › no network shows ‘Something went wrong. Please try again.’', async ({ page }) => {
    await offline(page, `${API}/api/auth/signup`);
    await gotoSignUp2(page);
    await field(page, 'Password').fill('Fairway2026');
    await field(page, 'Confirm Password').fill('Fairway2026');
    await button(page, 'Sign Up').click();
    await expectAlert(page, 'Couldn’t create your account', 'Something went wrong. Please try again.');
  });

  test('Sign up 2 › “Sign Up” shows a busy spinner while submitting', async ({ page }) => {
    await delay(page, `${API}/api/auth/signup`, 1500);
    await gotoSignUp2(page);
    await field(page, 'Password').fill('Fairway2026');
    await field(page, 'Confirm Password').fill('Fairway2026');
    await button(page, 'Sign Up').click();
    await expectBusy(page, 'Sign Up');
    await homeVisible(page);
  });

  test('Sign up 2 › confirm return key submits; success lands on Home and always persists the token', async ({ page }) => {
    await gotoSignUp2(page);
    await field(page, 'Password').fill('Fairway2026');
    await field(page, 'Confirm Password').fill('Fairway2026');
    await field(page, 'Confirm Password').press('Enter');
    await homeVisible(page);
    await expect(vis(page.getByRole('heading', { name: /, Thandi$/ })).first()).toBeVisible();
    expect(await storage(page, 'flagrr_auth_token')).toBe(TOKEN);
    await page.reload();
    await homeVisible(page);
  });

  test('Sign up 2 › an invalid referral code is silently ignored (sign-up succeeds, no alert)', async ({ page }) => {
    await gotoSignUp2(page, { referral: 'NOPE99' });
    await field(page, 'Password').fill('Fairway2026');
    await field(page, 'Confirm Password').fill('Fairway2026');
    await button(page, 'Sign Up').click();
    await homeVisible(page);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('Sign up 2 › choosing “My Club Isn\'t Listed Yet” sends the placeholder club and leads to the placeholder Home', async ({ page }) => {
    await scenario(page, { placeholder: true });
    await gotoSignUp2(page, { club: "My Club Isn't Listed Yet" });
    await field(page, 'Password').fill('Fairway2026');
    await field(page, 'Confirm Password').fill('Fairway2026');
    const req = page.waitForRequest((r) => r.url().endsWith('/api/auth/signup'));
    await button(page, 'Sign Up').click();
    expect((await req).postDataJSON().courseId).toBe(PLACEHOLDER_ID);
    await expectAlert(page, POPUP_TITLE, POPUP_BODY);
  });

  test.skip('Sign up 2 › push permission prompt after sign-up', () => {
    // native only: push registration never runs on web.
  });
});

// =====================================================================
test.describe('Forgot / reset password', () => {
  test('Forgot › request step shows title, helper, Email and “Send Code” (disabled while empty)', async ({ page }) => {
    await gotoForgot(page);
    await expect(text(page, "Enter the email address on your account and we'll send you a code to reset your password.")).toBeVisible();
    await expect(field(page, 'Email')).toBeVisible();
    const send = button(page, 'Send Code');
    await expect(send).toBeDisabled();
    await field(page, 'Email').fill('a');
    await expect(send).toBeEnabled();
  });

  test('Forgot › malformed email shows ‘Enter a valid email’ alert; OK dismisses', async ({ page }) => {
    await gotoForgot(page);
    await field(page, 'Email').fill('not-an-email');
    await button(page, 'Send Code').click();
    await expectAlert(page, 'Enter a valid email', 'Please enter the email address on your Flagrr account.');
    await dismissAlert(page);
    await expect(button(page, 'Send Code')).toBeVisible();
  });

  test('Forgot › request failure shows ‘Couldn’t send code’ with the server message', async ({ page }) => {
    await scenario(page, { fail: { 'POST /api/auth/login?action=forgotPassword': 500 } });
    await gotoForgot(page);
    await field(page, 'Email').fill(TEST_EMAIL);
    await button(page, 'Send Code').click();
    await expectAlert(page, 'Couldn’t send code', 'Internal server error');
    await dismissAlert(page);
    await expect(button(page, 'Send Code')).toBeVisible();
  });

  test('Forgot › 429 shows the reset rate-limit message with support contacts', async ({ page }) => {
    const msg = 'Too many password reset attempts. Please contact Flagrr support at Swing@flagrr.com or 071 759 9553.';
    await answer(page, /\/api\/auth\/login\?action=forgotPassword/, 429, msg);
    await gotoForgot(page);
    await field(page, 'Email').fill(TEST_EMAIL);
    await button(page, 'Send Code').click();
    await expectAlert(page, 'Couldn’t send code', msg);
  });

  test('Forgot › no network shows ‘Something went wrong. Please try again.’', async ({ page }) => {
    await offline(page, /\/api\/auth\/login\?action=forgotPassword/);
    await gotoForgot(page);
    await field(page, 'Email').fill(TEST_EMAIL);
    await button(page, 'Send Code').click();
    await expectAlert(page, 'Couldn’t send code', 'Something went wrong. Please try again.');
  });

  test('Forgot › “Send Code” shows a busy spinner while sending', async ({ page }) => {
    await delay(page, /\/api\/auth\/login\?action=forgotPassword/, 1500);
    await gotoForgot(page);
    await field(page, 'Email').fill(TEST_EMAIL);
    await button(page, 'Send Code').click();
    await expectBusy(page, 'Send Code');
    await expect(field(page, '6-digit code')).toBeVisible();
  });

  test('Forgot › email return key sends the code; reset step shows helper with the email, three fields and buttons', async ({ page }) => {
    await gotoForgot(page);
    await field(page, 'Email').fill(TEST_EMAIL);
    const req = page.waitForRequest((r) => r.url().includes('action=forgotPassword'));
    await field(page, 'Email').press('Enter');
    expect((await req).postDataJSON()).toEqual({ email: TEST_EMAIL });
    await expect(text(page, `Enter the code we sent to ${TEST_EMAIL} and choose a new password.`)).toBeVisible();
    await expect(field(page, '6-digit code')).toBeVisible();
    await expect(field(page, 'New password')).toHaveAttribute('type', 'password');
    await expect(field(page, 'Confirm new password')).toHaveAttribute('type', 'password');
    await expect(button(page, 'Update Password')).toBeVisible();
    await expect(text(page, "Didn't get a code? Send it again.")).toBeVisible();
  });

  test('Forgot › an unknown email still moves on to the reset step', async ({ page }) => {
    await gotoResetStep(page, 'nobody@flagrr.test');
    await expect(text(page, 'Enter the code we sent to nobody@flagrr.test and choose a new password.')).toBeVisible();
  });

  test('Forgot › “Update Password” is disabled until code, new and confirm are all filled', async ({ page }) => {
    await gotoResetStep(page);
    const upd = button(page, 'Update Password');
    await expect(upd).toBeDisabled();
    await field(page, '6-digit code').fill(RESET_CODE);
    await expect(upd).toBeDisabled();
    await field(page, 'New password').fill('NewPass2026');
    await expect(upd).toBeDisabled();
    await field(page, 'Confirm new password').fill('NewPass2026');
    await expect(upd).toBeEnabled();
  });

  test('Forgot › blank code shows ‘Enter the code’', async ({ page }) => {
    await gotoResetStep(page);
    await field(page, '6-digit code').fill('   ');
    await field(page, 'New password').fill('NewPass2026');
    await field(page, 'Confirm new password').fill('NewPass2026');
    await button(page, 'Update Password').click();
    await expectAlert(page, 'Enter the code', 'Check your email for the 6-digit code we sent you.');
    await dismissAlert(page);
  });

  test('Forgot › short new password shows ‘Password too short’', async ({ page }) => {
    await gotoResetStep(page);
    await field(page, '6-digit code').fill(RESET_CODE);
    await field(page, 'New password').fill('short');
    await field(page, 'Confirm new password').fill('short');
    await button(page, 'Update Password').click();
    await expectAlert(page, 'Password too short', 'Your new password must be at least 8 characters.');
  });

  test('Forgot › mismatch shows ‘Passwords don’t match’', async ({ page }) => {
    await gotoResetStep(page);
    await field(page, '6-digit code').fill(RESET_CODE);
    await field(page, 'New password').fill('NewPass2026');
    await field(page, 'Confirm new password').fill('NewPass2027');
    await button(page, 'Update Password').click();
    await expectAlert(page, 'Passwords don’t match', 'Make sure both passwords are the same.');
  });

  test('Forgot › wrong code shows ‘Couldn’t reset password’ / ‘That code is invalid or has expired’', async ({ page }) => {
    await gotoResetStep(page);
    await field(page, '6-digit code').fill('000000');
    await field(page, 'New password').fill('NewPass2026');
    await field(page, 'Confirm new password').fill('NewPass2026');
    await button(page, 'Update Password').click();
    await expectAlert(page, 'Couldn’t reset password', 'That code is invalid or has expired');
    await dismissAlert(page);
    await expect(button(page, 'Update Password')).toBeVisible();
  });

  test('Forgot › reset with no network shows the generic message', async ({ page }) => {
    await offline(page, /\/api\/auth\/login\?action=resetPassword/);
    await gotoResetStep(page);
    await field(page, '6-digit code').fill(RESET_CODE);
    await field(page, 'New password').fill('NewPass2026');
    await field(page, 'Confirm new password').fill('NewPass2026');
    await button(page, 'Update Password').click();
    await expectAlert(page, 'Couldn’t reset password', 'Something went wrong. Please try again.');
  });

  test('Forgot › success: ‘Password reset’ alert, OK returns to Login, and the new password works (old one does not)', async ({ page }) => {
    await gotoResetStep(page);
    await field(page, '6-digit code').fill(RESET_CODE);
    await field(page, 'New password').fill('NewPass2026');
    await field(page, 'Confirm new password').fill('NewPass2026');
    const req = page.waitForRequest((r) => r.url().includes('action=resetPassword'));
    await field(page, 'Confirm new password').press('Enter'); // confirm return key submits
    expect((await req).postDataJSON()).toEqual({ email: TEST_EMAIL, code: RESET_CODE, newPassword: 'NewPass2026' });
    await expectAlert(page, 'Password reset', 'Your password has been changed. You can now log in with it.');
    await expect(appAlert(page).getByRole('button')).toHaveText(['OK']);
    await dismissAlert(page);
    await expect(heading(page, 'Welcome back')).toBeVisible();
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD);
    await expectAlert(page, 'Couldn’t log in', 'Invalid email or password');
    await dismissAlert(page);
    await loginAs(page, TEST_EMAIL, 'NewPass2026');
    await homeVisible(page);
  });

  test('Forgot › “Update Password” shows a busy spinner while sending', async ({ page }) => {
    await delay(page, /\/api\/auth\/login\?action=resetPassword/, 1500);
    await gotoResetStep(page);
    await field(page, '6-digit code').fill(RESET_CODE);
    await field(page, 'New password').fill('NewPass2026');
    await field(page, 'Confirm new password').fill('NewPass2026');
    await button(page, 'Update Password').click();
    await expectBusy(page, 'Update Password');
    await expectAlert(page, 'Password reset');
  });

  test('Forgot › “Send it again.” re-sends the code, stays on the reset step, with no feedback', async ({ page }) => {
    await gotoResetStep(page);
    const req = page.waitForRequest((r) => r.url().includes('action=forgotPassword'));
    await text(page, "Didn't get a code? Send it again.").click();
    expect((await req).postDataJSON()).toEqual({ email: TEST_EMAIL });
    await expect(field(page, '6-digit code')).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('Forgot › back chevron on the reset step returns to the request step with the email kept; again returns to Login', async ({ page }) => {
    await gotoResetStep(page);
    await authBack(page);
    await expect(button(page, 'Send Code')).toBeVisible();
    await expect(field(page, 'Email')).toHaveValue(TEST_EMAIL);
    await authBack(page);
    await expect(heading(page, 'Welcome back')).toBeVisible();
  });

  test.skip('Forgot › OS back gesture / hardware back on the reset step leaves for Login', () => {
    // native only: swipe-back and Android hardware back.
  });
});

// =====================================================================
test.describe('Home', () => {
  test('Home › header: date line, greeting with first name, bell with unread count, avatar initials', async ({ page }) => {
    await openSignedIn(page);
    const expected = await page.evaluate(() => {
      const n = new Date();
      return `${n.toLocaleDateString(undefined, { weekday: 'long' })} · ${n.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`;
    });
    await expect(text(page, expected)).toBeVisible();
    await expect(vis(page.getByRole('heading', { name: /^(Morning|Afternoon|Evening), Sam$/ })).first()).toBeVisible();
    await expect(bell(page)).toHaveAccessibleName('Notifications, 2 unread');
    await expect(bell(page).locator('xpath=..')).toContainText('2');
    await expect(button(page, 'Profile')).toHaveText('SM');
  });

  for (const [hour, word] of [[8, 'Morning'], [14, 'Afternoon'], [19, 'Evening']] as const) {
    test(`Home › greeting “${word}” at ${hour}:00`, async ({ page }) => {
      await page.clock.setFixedTime(new Date(2026, 10, 24, hour, 0, 0));
      await openSignedIn(page);
      await expect(vis(page.getByRole('heading', { name: `${word}, Sam` })).first()).toBeVisible();
    });
  }

  test('Home › bell with no unread notifications has no count', async ({ page }) => {
    await scenario(page, { noNotifications: true });
    await openSignedIn(page);
    await expect(bell(page)).toHaveAccessibleName('Notifications');
  });

  test('Home › bell opens Notifications; avatar opens the Profile tab', async ({ page }) => {
    await openSignedIn(page);
    await bell(page).click();
    await expect(heading(page, 'Notifications')).toBeVisible();
    await button(page, 'Back').click();
    await button(page, 'Profile').click();
    await expect(heading(page, 'Sam Mokoena')).toBeVisible();
  });

  test('Home › avatar shows the uploaded photo instead of initials', async ({ page }) => {
    await patchMe(page, (me) => { me.user.avatarUrl = `${API}/img/strand-golf-club-fairway.jpg`; });
    await openSignedIn(page);
    await expect(button(page, 'Profile')).not.toHaveText('SM');
  });

  test('Home › unverified banner shows only when membership is not verified', async ({ page }) => {
    const banner = 'Your club hasn\'t verified your membership yet — you can still earn Flagrr Cash, but tier progress is on hold.';
    await openSignedIn(page);
    await expect(page.getByText(banner)).toHaveCount(0);
    await scenario(page, { unverified: true });
    await page.reload();
    await expect(text(page, banner)).toBeVisible();
  });

  test('Home › Flagrr Cash hero: label, balance, tier, ring “1,786 to Platinum”, Redeem', async ({ page }) => {
    await openSignedIn(page);
    await expect(vis(page.getByLabel('12,480 Flagrr Cash'))).toHaveText('12,480');
    await expect(text(page, 'Gold Member', false)).toBeVisible();
    const ring = ringButton(page);
    await expect(ring).toHaveAccessibleName('Member tiers: 1,786 to Platinum');
    await expect(ring).toContainText('1,786');
    await expect(ring).toContainText('to Platinum');
    await expect(button(page, 'Redeem Flagrr Cash')).toHaveText(/Redeem/);
  });

  test('Home › “Redeem” opens the Rewards tab', async ({ page }) => {
    await openSignedIn(page);
    await button(page, 'Redeem Flagrr Cash').click();
    await expect(heading(page, 'Rewards Shop')).toBeVisible();
  });

  test('Home › tier ring opens Member Tiers', async ({ page }) => {
    await openSignedIn(page);
    await ringButton(page).click();
    await expect(heading(page, 'Member Tiers')).toBeVisible();
  });

  test('Home › top tier: ring reads “Top tier” and still opens Member Tiers', async ({ page }) => {
    await scenario(page, { topTier: true });
    await openSignedIn(page);
    const ring = ringButton(page);
    await expect(ring).toHaveAccessibleName('Member tiers: Platinum, top tier');
    await expect(ring).toContainText('Top tier');
    await expect(text(page, 'Platinum Member', false)).toBeVisible();
    await ring.click();
    await expect(heading(page, 'Member Tiers')).toBeVisible();
  });

  test('Home › large balance (100,000+) and compact ring value (“123k to Platinum”)', async ({ page }) => {
    await scenario(page, { balance: 150000 });
    await patchMe(page, (me) => { me.points.pointsToNextTier = 123456; });
    await openSignedIn(page);
    await expect(vis(page.getByLabel('150,000 Flagrr Cash'))).toHaveText('150,000');
    await expect(ringButton(page)).toContainText('123k');
  });

  test('Home › streak tile: weeks, played-weeks dots, milestone line and the “since” accessibility sentence', async ({ page }) => {
    await openSignedIn(page);
    await expect(text(page, 'Streak')).toBeVisible();
    await expect(text(page, 'weeks')).toBeVisible();
    await expect(vis(page.getByRole('img', { name: 'Played 7 of the last 8 weeks' }))).toBeVisible();
    await expect(text(page, '2 more weeks to a 100 FC bonus')).toBeVisible();
    await expect(vis(page.getByLabel("4-week streak. You've played every week since October 2026."))).toBeVisible();
    await expect(page.getByText("You've played every week since", { exact: false })).toHaveCount(0); // never visible as text
  });

  test('Home › streak of 1 week reads “week” and “1 more week to a … FC bonus”', async ({ page }) => {
    await patchMe(page, (me) => { me.streak = { ...me.streak, weeks: 1, nextMilestoneWeeks: 2 }; });
    await openSignedIn(page);
    await expect(text(page, 'week')).toBeVisible();
    await expect(text(page, '1 more week to a 100 FC bonus')).toBeVisible();
  });

  test('Home › streak 0 reads “weeks” and the start-your-streak sentence; milestone reached reads “0 more weeks…”', async ({ page }) => {
    await patchMe(page, (me) => { me.streak = { ...me.streak, weeks: 0, nextMilestoneWeeks: 0, weeksPlayed: [false, false] }; });
    await openSignedIn(page);
    await expect(vis(page.getByLabel('0-week streak. Play a round this week to start your streak.'))).toBeVisible();
    await expect(text(page, '0 more weeks to a 100 FC bonus')).toBeVisible();
    await expect(vis(page.getByRole('img', { name: 'Played 0 of the last 2 weeks' }))).toBeVisible();
  });

  test('Home › “Play a round” tile when no round is in progress opens the Course tab', async ({ page }) => {
    await openSignedIn(page);
    const tile = button(page, 'Play a round: open the Course tab');
    await expect(tile).toContainText('Play a round');
    await expect(tile).toContainText('Hole maps and your scorecard');
    await tile.click();
    await expect(heading(page, 'Play a round')).toBeVisible();
  });

  test('Home › golf call failing falls back silently to “Play a round”', async ({ page }) => {
    await apiPost(page, '/api/courses?action=golfRoundStart', { teeId: 'x', gender: 'men', layout: 'full' });
    await scenario(page, { fail: { 'GET /api/courses?action=golfHome': 500 } });
    await openSignedIn(page);
    await expect(button(page, 'Play a round: open the Course tab')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('Home › Resume tile for a round in progress (“Hole 1”, “0 pts thru 0”) opens the hole view', async ({ page }) => {
    await apiPost(page, '/api/courses?action=golfRoundStart', { teeId: 'x', gender: 'men', layout: 'full' });
    await openSignedIn(page);
    const tile = button(page, 'Resume round at Strand Golf Club, hole 1, 0 points thru 0');
    await expect(tile).toContainText('Hole 1');
    await expect(tile).toContainText('0 pts thru 0');
    await tile.click();
    await expect(text(page, /SI 12/, false)).toBeVisible();
    await expect(vis(page.getByRole('tablist'))).toHaveCount(0);
  });

  test('Home › Resume tile reads “All holes in” when every hole is entered', async ({ page }) => {
    const round = await apiPost(page, '/api/courses?action=golfRoundStart', { teeId: 'x', gender: 'men', layout: 'full' });
    await apiPost(page, '/api/courses?action=golfRoundSave', { id: round.id, entries: round.holes.map((h: any) => ({ s: h.par, putts: null, fw: null })) });
    await openSignedIn(page);
    const tile = button(page, /^Resume round at Strand Golf Club, \d+ points thru 18$/);
    await expect(tile).toContainText('All holes in');
    await expect(tile).toContainText('thru 18');
  });

  test('Home › round tile is re-read on every focus of Home', async ({ page }) => {
    await openSignedIn(page);
    await expect(button(page, 'Play a round: open the Course tab')).toBeVisible();
    await apiPost(page, '/api/courses?action=golfRoundStart', { teeId: 'x', gender: 'men', layout: 'full' });
    await tab(page, 'Rewards');
    await expect(heading(page, 'Rewards Shop')).toBeVisible();
    await tab(page, 'Home');
    await expect(button(page, /^Resume round at Strand Golf Club, hole 1/)).toBeVisible();
  });

  test('Home › Your Club tile shows the home club and opens the Profile tab', async ({ page }) => {
    await openSignedIn(page);
    const tile = button(page, 'Your Club: Strand Golf Club');
    await expect(tile).toContainText('Your Club');
    await tile.click();
    await expect(heading(page, 'Sam Mokoena')).toBeVisible();
  });

  test('Home › Your Club reads “Not specified” without a home club', async ({ page }) => {
    await patchMe(page, (me) => { me.user.homeClub = ''; });
    await openSignedIn(page);
    await expect(button(page, 'Your Club: Not specified')).toContainText('Not specified');
  });

  test('Home › Your Club shows the club logo when there is one', async ({ page }) => {
    await patchMe(page, (me) => { me.user.courseLogoUrl = `${API}/img/strand-golf-club-fairway.jpg`; });
    await openSignedIn(page);
    await expect(button(page, 'Your Club: Strand Golf Club').locator('img')).toHaveCount(1);
  });

  test('Home › My Stats defaults to Year with four values and “vs Last Year” deltas (+ and −)', async ({ page }) => {
    await openSignedIn(page);
    await expect(text(page, 'My Stats')).toBeVisible();
    for (const l of ['Rounds (9 Holes)', 'Rounds (18 Holes)', 'Cash Earned', 'Cash Redeemed']) await expect(text(page, l)).toBeVisible();
    for (const v of ['9,860', '6,320', '16']) await expect(text(page, v)).toBeVisible();
    await expect(text(page, '+50% vs Last Year')).toBeVisible();
    await expect(text(page, '+22% vs Last Year')).toBeVisible();
    await expect(text(page, '−53% vs Last Year')).toBeVisible();
    await expect(text(page, '+100% vs Last Year')).toBeVisible();
  });

  test('Home › Month refetches /me?period=month and shows “vs Last Month”', async ({ page }) => {
    await patchMe(page, (me, url) => { if (url.searchParams.get('period') === 'month') me.stats.roundsPlayed18 = 3; });
    await openSignedIn(page);
    const req = page.waitForRequest((r) => r.url().includes('/api/me?period=month'));
    await statsRadio(page, 'Month').click();
    await req;
    await expect(text(page, '+50% vs Last Month')).toBeVisible();
    await expect(text(page, '3')).toBeVisible();
  });

  test('Home › All hides every delta', async ({ page }) => {
    await openSignedIn(page);
    await expect(text(page, '+50% vs Last Year')).toBeVisible();
    await statsRadio(page, 'All').click();
    await expect(vis(page.getByText(/vs Last (Year|Month)/))).toHaveCount(0);
    await expect(text(page, 'Cash Earned')).toBeVisible();
  });

  test('Home › a failed period refetch keeps the old numbers silently', async ({ page }) => {
    await patchMe(page, (me, url) => { if (url.searchParams.get('period') === 'month') me.stats.bucksEarned = 1111; });
    await openSignedIn(page);
    await expect(text(page, '9,860')).toBeVisible();
    await scenario(page, { fail: { 'GET /api/me': 500 } });
    await statsRadio(page, 'Month').click();
    await expect(text(page, '−53% vs Last Month')).toBeVisible();
    await expect(text(page, '9,860')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('Home › the chosen period persists across tab switches', async ({ page }) => {
    await openSignedIn(page);
    await statsRadio(page, 'All').click();
    await tab(page, 'Course');
    await expect(heading(page, 'Play a round')).toBeVisible();
    await tab(page, 'Home');
    await expect(text(page, 'Cash Earned')).toBeVisible();
    await expect(vis(page.getByText(/vs Last (Year|Month)/))).toHaveCount(0);
  });

  test('Home › chart: one bar per month with compact values and month letters; “My Golf” link opens My Golf', async ({ page }) => {
    await openSignedIn(page);
    await expect(text(page, 'Points Earned Per Month')).toBeVisible();
    const chart = vis(page.getByRole('img', { name: 'Flagrr Cash earned per month: J 3150, J 4020, A 3480, S 5260, O 9004, N 4210' }));
    await expect(chart).toBeVisible();
    for (const v of ['3.2k', '4k', '3.5k', '5.3k', '9k', '4.2k']) await expect(chart).toContainText(v);
    await vis(page.getByRole('link', { name: 'My Golf' })).first().click();
    await expect(heading(page, 'My Golf')).toBeVisible();
  });

  test('Home › empty chart reads “Scan a receipt to start your chart.”', async ({ page }) => {
    await patchMe(page, (me) => { me.stats.monthly = []; });
    await openSignedIn(page);
    await expect(text(page, 'Scan a receipt to start your chart.')).toBeVisible();
  });

  test('Home › Rewards rail: header, “View All” and cards with title and cost', async ({ page }) => {
    await openSignedIn(page);
    await expect(heading(page, 'Rewards')).toBeVisible();
    for (const [t, c] of [['18 Hole Round', '4,200'], ['9 Hole Round', '2,128'], ['Golf Cart Hire', '1,540'], ['Pro Shop Voucher', '1,260']]) {
      const card = button(page, `${t}, ${c.replace(',', '')} Flagrr Cash`);
      await expect(card).toContainText(t);
      await expect(card).toContainText(c);
      await expect(card).toContainText('Flagrr Cash');
    }
  });

  test('Home › “View All” opens the Rewards tab', async ({ page }) => {
    await openSignedIn(page);
    await vis(page.getByRole('link', { name: 'View All' })).first().click();
    await expect(heading(page, 'Rewards Shop')).toBeVisible();
  });

  test('Home › a reward card opens the Rewards tab (not that reward)', async ({ page }) => {
    await openSignedIn(page);
    await button(page, 'Golf Cart Hire, 1540 Flagrr Cash').click();
    await expect(heading(page, 'Rewards Shop')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('Home › the rail shows only the first 5 rewards', async ({ page }) => {
    await patchJson(page, /\/api\/rewards(\?|$)/, (list: any[]) => [...list, ...list.map((r) => ({ ...r, id: r.id + 'b', title: r.title + ' II' }))]);
    await openSignedIn(page);
    await expect(button(page, 'Pro Shop Voucher, 1260 Flagrr Cash')).toBeVisible();
    await expect(button(page, '18 Hole Round II, 4200 Flagrr Cash')).toBeVisible();
    await expect(page.getByRole('button', { name: '9 Hole Round II, 2128 Flagrr Cash' })).toHaveCount(0);
  });

  test('Home › empty rewards keeps header and “View All” with no cards', async ({ page }) => {
    await scenario(page, { noRewards: true });
    await openSignedIn(page);
    await expect(heading(page, 'Rewards')).toBeVisible();
    await expect(vis(page.getByRole('link', { name: 'View All' }))).toBeVisible();
    await expect(page.getByRole('button', { name: /Flagrr Cash$/ }).filter({ hasNotText: 'Redeem' })).toHaveCount(0);
  });

  test('Home › reward card without a loadable image falls back to an icon but keeps title and cost', async ({ page }) => {
    await page.route(/\/img\/rewards\//, (r) => r.abort());
    await openSignedIn(page);
    const card = button(page, '18 Hole Round, 4200 Flagrr Cash');
    await expect(card).toContainText('4,200');
    await expect(card.locator('img')).toHaveCount(0);
  });

  test('Home › data is not refreshed on refocus (no polling): balance stays as loaded', async ({ page }) => {
    await openSignedIn(page);
    await expect(vis(page.getByLabel('12,480 Flagrr Cash'))).toBeVisible();
    await scenario(page, { balance: 99999 });
    await tab(page, 'Course');
    await tab(page, 'Home');
    await expect(vis(page.getByLabel('12,480 Flagrr Cash'))).toBeVisible();
  });

  test.skip('Home › no pull-to-refresh; CountUp re-counts on refocus; balance font-size steps 42/38/30', () => {
    // not covered on web: pull-to-refresh is a touch gesture (absence only); re-count animation and font sizes are visual-only.
  });
});

// =====================================================================
test.describe('Home: placeholder-club popup', () => {
  test('Placeholder › popup on first Home open with exact copy; “Contact Support” first, “Close” last', async ({ page }) => {
    await scenario(page, { placeholder: true });
    await openSignedIn(page);
    const a = await expectAlert(page, POPUP_TITLE, POPUP_BODY);
    await expect(a.getByRole('button')).toHaveText(['Contact Support', 'Close']);
    expect(await storage(page, POPUP_KEY)).toBe('1');
  });

  test('Placeholder › “Close” dismisses; placeholder Home shows the placeholder club, empty rewards rail and “Ad Space”', async ({ page }) => {
    await scenario(page, { placeholder: true });
    await openSignedIn(page);
    await expectAlert(page, POPUP_TITLE);
    await dismissAlert(page, 'Close');
    await expect(button(page, "Your Club: My Club Isn't Listed Yet")).toBeVisible();
    await expect(heading(page, 'Rewards')).toBeVisible();
    await expect(page.getByRole('button', { name: /, \d+ Flagrr Cash$/ })).toHaveCount(0);
    await expect(vis(page.getByText('Ad Space', { exact: true }))).toHaveCount(2);
    await expect(vis(page.getByText('SPONSORED', { exact: true }))).toHaveCount(0);
  });

  test('Placeholder › “Contact Support” opens Contact Us', async ({ page }) => {
    await scenario(page, { placeholder: true });
    await openSignedIn(page);
    await expectAlert(page, POPUP_TITLE);
    await appAlert(page).getByRole('button', { name: 'Contact Support' }).click();
    await expect(heading(page, 'Contact Us')).toBeVisible();
  });

  test('Placeholder › popup shows on the 1st, 3rd, 5th… open only (counter per user)', async ({ page }) => {
    await scenario(page, { placeholder: true });
    await openSignedIn(page);
    await expectAlert(page, POPUP_TITLE);
    await page.reload(); // 2nd open
    await homeVisible(page);
    await page.waitForTimeout(800);
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(await storage(page, POPUP_KEY)).toBe('2');
    await page.reload(); // 3rd open
    await expectAlert(page, POPUP_TITLE);
    expect(await storage(page, POPUP_KEY)).toBe('3');
  });

  test('Placeholder › a verified club never shows the popup', async ({ page }) => {
    await openSignedIn(page);
    await page.waitForTimeout(800);
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(await storage(page, POPUP_KEY)).toBeNull();
  });

  test('Alerts › tapping the backdrop does nothing (a button must be picked)', async ({ page }) => {
    await scenario(page, { placeholder: true });
    await openSignedIn(page);
    await expectAlert(page, POPUP_TITLE);
    await page.mouse.click(20, 820);
    await page.waitForTimeout(400);
    await expect(appAlert(page).getByRole('heading', { name: POPUP_TITLE })).toBeVisible();
  });
});

// =====================================================================
test.describe('Ads (Home)', () => {
  test('Ads › both Home slots show a SPONSORED ad, are not tappable without a link, and log an impression', async ({ page }) => {
    const impressions: string[] = [];
    page.on('request', (r) => { if (r.url().includes('action=adImpression')) impressions.push(r.postDataJSON().adId); });
    await openSignedIn(page);
    await expect(vis(page.getByText('SPONSORED', { exact: true }))).toHaveCount(2);
    await expect(page.getByRole('link', { name: /Sample advert|Advertisement/ })).toHaveCount(0);
    await expect.poll(() => impressions.sort().join(',')).toContain('ad1');
    await expect.poll(() => impressions.sort().join(',')).toContain('ad2');
  });

  test('Ads › an ad without an image shows its title on the placeholder box, with SPONSORED', async ({ page }) => {
    await patchMe(page, (me) => { me.ads = me.ads.map((a: any) => (a.id === 'ad1' ? { ...a, imageUrl: null } : a)); });
    await openSignedIn(page);
    await expect(text(page, 'Sample advert')).toBeVisible();
    await expect(vis(page.getByText('SPONSORED', { exact: true }))).toHaveCount(2);
  });

  test('Ads › an ad with a target URL is a link: tap logs a click and opens the URL in a new tab', async ({ page, context }) => {
    await context.route('https://example.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<p>ad landing</p>' }));
    await patchMe(page, (me) => { me.ads = me.ads.map((a: any) => (a.id === 'ad1' ? { ...a, targetUrl: 'https://example.com/promo' } : a)); });
    await openSignedIn(page);
    const click = page.waitForRequest((r) => r.url().includes('action=adClick'));
    const popup = context.waitForEvent('page');
    await vis(page.getByRole('link', { name: 'Sample advert' })).first().click();
    expect((await click).postDataJSON()).toEqual({ adId: 'ad1' });
    expect((await popup).url()).toContain('https://example.com/promo');
  });

  test('Ads › a slot with two ads rotates to the next after 6 s', async ({ page }) => {
    await patchMe(page, (me) => {
      me.ads = [
        { id: 'r1', placement: 'homeTop', title: 'Rotating ad one', imageUrl: null, mediaType: 'image', targetUrl: null },
        { id: 'r2', placement: 'homeTop', title: 'Rotating ad two', imageUrl: null, mediaType: 'image', targetUrl: null },
      ];
    });
    await openSignedIn(page);
    await expect(text(page, 'Rotating ad one')).toBeVisible();
    await expect(text(page, 'Rotating ad two')).toBeVisible({ timeout: 9000 });
    await expect(vis(page.getByText('Rotating ad one', { exact: true }))).toHaveCount(0);
  });

  test.skip('Ads › video ads (muted autoplay, loop when alone, advance on end) and pause-when-unfocused', () => {
    // not covered: the mock has no video ad and video playback timing is not reliable headless; unfocused pause has no visible signal.
  });
});

// =====================================================================
test.describe('Notifications', () => {
  async function openNotifications(page: Page) {
    await bell(page).click();
    await expect(heading(page, 'Notifications')).toBeVisible();
  }

  test('Notifications › header with Back and title; groups in order Today, This Week, Earlier; rows with title and body', async ({ page }) => {
    await openSignedIn(page);
    await openNotifications(page);
    const groups = vis(page.getByText(/^(Today|Yesterday|This Week|Earlier)$/));
    await expect(groups).toHaveText(['Today', 'This Week', 'Earlier']);
    await expect(text(page, 'Flagrr Cash earned')).toBeVisible();
    await expect(text(page, 'Your receipt from Strand Golf Club earned Flagrr Cash.')).toBeVisible();
    await expect(text(page, 'Your club replied')).toBeVisible();
    await expect(text(page, 'Welcome to Flagrr')).toBeVisible();
    await expect(text(page, 'Scan your receipts after your round to earn Flagrr Cash.')).toBeVisible();
    await expect(vis(page.getByText('View', { exact: true }))).toHaveCount(2); // rows without an enquiry
  });

  test('Notifications › “Yesterday” group appears for yesterday’s notifications', async ({ page }) => {
    await patchJson(page, /\/api\/notifications(\?|$)/, (list: any[]) => [
      ...list,
      { id: 'ny', title: 'Yesterday note', body: 'From yesterday.', date: new Date(Date.now() - 86400000).toISOString(), read: true, enquiryId: null },
    ]);
    await openSignedIn(page);
    await openNotifications(page);
    await expect(vis(page.getByText(/^(Today|Yesterday|This Week|Earlier)$/))).toHaveText(['Today', 'Yesterday', 'This Week', 'Earlier']);
    await expect(text(page, 'Yesterday note')).toBeVisible();
  });

  test('Notifications › unread rows show a bell icon, read rows a check icon; enquiry rows a chevron', async ({ page }) => {
    await openSignedIn(page);
    await openNotifications(page);
    const row = (title: string) => vis(page.getByText(title, { exact: true })).first().locator('xpath=../..');
    await expect(row('Flagrr Cash earned')).toContainText(GLYPH.bell);
    await expect(row('Welcome to Flagrr')).toContainText(GLYPH.checkmarkCircleOutline);
    await expect(row('Your club replied')).toContainText(GLYPH.chevronForward);
    await expect(row('Your club replied')).not.toContainText('View');
  });

  test('Notifications › “View” marks read only (server call, Home badge drops, no navigation)', async ({ page }) => {
    await openSignedIn(page);
    await openNotifications(page);
    const req = page.waitForRequest((r) => r.url().includes('/api/notifications?action=read'));
    const row = vis(page.getByText('Flagrr Cash earned', { exact: true })).first().locator('xpath=../..');
    await row.getByText('View', { exact: true }).click();
    expect((await req).postDataJSON()).toEqual({ id: 'n1' });
    await expect(row).toContainText(GLYPH.checkmarkCircleOutline);
    await expect(heading(page, 'Notifications')).toBeVisible();
    await button(page, 'Back').click();
    await expect(bell(page)).toHaveAccessibleName('Notifications, 1 unread');
    await page.reload(); // persisted on the server
    await expect(bell(page)).toHaveAccessibleName('Notifications, 1 unread');
  });

  test('Notifications › a row without an enquiry is not tappable (only “View” acts)', async ({ page }) => {
    await openSignedIn(page);
    await openNotifications(page);
    let calls = 0;
    page.on('request', (r) => { if (r.url().includes('action=read')) calls++; });
    await text(page, 'Flagrr Cash earned').click();
    await page.waitForTimeout(400);
    expect(calls).toBe(0);
    await expect(heading(page, 'Notifications')).toBeVisible();
  });

  test('Notifications › enquiry row marks read and opens that Enquiry chat', async ({ page }) => {
    await openSignedIn(page);
    await openNotifications(page);
    const req = page.waitForRequest((r) => r.url().includes('/api/notifications?action=read'));
    await text(page, 'Your club replied').click();
    expect((await req).postDataJSON()).toEqual({ id: 'n2' });
    await expect(text(page, 'Can I book a tee time for Saturday morning?')).toBeVisible();
  });

  test('Notifications › mark-read failure is ignored (optimistic: badge still drops)', async ({ page }) => {
    await scenario(page, { fail: { 'POST /api/notifications?action=read': 500 } });
    await openSignedIn(page);
    await openNotifications(page);
    await vis(page.getByText('View', { exact: true })).first().click();
    await button(page, 'Back').click();
    await expect(bell(page)).toHaveAccessibleName('Notifications, 1 unread');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('Notifications › empty list is a blank screen (no groups, no message)', async ({ page }) => {
    await scenario(page, { noNotifications: true });
    await openSignedIn(page);
    await openNotifications(page);
    await expect(vis(page.getByText(/^(Today|Yesterday|This Week|Earlier)$/))).toHaveCount(0);
    await expect(vis(page.getByText('View', { exact: true }))).toHaveCount(0);
  });

  test('Notifications › list is not refetched when the screen opens', async ({ page }) => {
    await openSignedIn(page);
    await scenario(page, { noNotifications: true });
    await openNotifications(page);
    await expect(text(page, 'Flagrr Cash earned')).toBeVisible();
  });

  test('Notifications › Back returns to Home; no tab bar on this screen', async ({ page }) => {
    await openSignedIn(page);
    await openNotifications(page);
    await expect(vis(page.getByRole('tablist'))).toHaveCount(0);
    await button(page, 'Back').click();
    await homeVisible(page);
    await expect(vis(page.getByRole('tablist'))).toHaveCount(1);
  });

  test.skip('Notifications › opened from a push-notification tap', () => {
    // native only: push taps (navigationRef.navigate("Notifications")) never happen on web.
  });
});

// =====================================================================
test.describe('Member Tiers', () => {
  async function openTiers(page: Page) {
    await ringButton(page).click();
    await expect(heading(page, 'Member Tiers')).toBeVisible();
  }

  test('Tiers › points card: balance, “Gold Member”, progress line “1,786 pts to Platinum”', async ({ page }) => {
    await openSignedIn(page);
    await openTiers(page);
    await expect(text(page, '12,480')).toBeVisible();
    await expect(text(page, 'Flagrr Cash')).toBeVisible();
    await expect(text(page, 'Gold Member')).toBeVisible();
    await expect(text(page, '1,786 pts to Platinum')).toBeVisible();
  });

  test('Tiers › “How to Reach the Next Tier” with 01 Play / 02 Earn / 03 Upgrade', async ({ page }) => {
    await openSignedIn(page);
    await openTiers(page);
    await expect(text(page, 'How to Reach the Next Tier')).toBeVisible();
    for (const s of ['01', 'Play', 'Play rounds at your club and stay active on Flagrr.', '02', 'Earn', 'Earn Flagrr Cash through qualifying activities.',
      '03', 'Upgrade', 'As your activity grows, unlock the next tier and enjoy enhanced benefits.']) {
      await expect(text(page, s)).toBeVisible();
    }
  });

  const PERKS: Record<string, string[]> = {
    Bronze: ['Earn 1 Flagrr Cash per R1 spent', 'Birthday reward (50 Flagrr Cash)'],
    Silver: ['1.2x Flagrr Cash per R1 spent', 'Birthday reward (100 Flagrr Cash)'],
    Gold: ['1.5x Flagrr Cash per R1 spent', 'Birthday reward (150 Flagrr Cash)', 'R100 bar voucher each quarter you qualify'],
    Platinum: ['1.7x Flagrr Cash per R1 spent', 'Birthday reward (200 Flagrr Cash)', 'R200 bar voucher each quarter you qualify'],
  };
  async function expectTier(page: Page, name: string) {
    await expect(text(page, `${name.toUpperCase()} MEMBER`)).toBeVisible();
    await expect(text(page, `${name} status recognises loyal players and gives them more value every time they play.`)).toBeVisible();
    for (const p of PERKS[name]) await expect(text(page, p)).toBeVisible();
    for (const other of Object.keys(PERKS).filter((n) => n !== name)) {
      for (const p of PERKS[other].filter((x) => !PERKS[name].includes(x))) await expect(vis(page.getByText(p, { exact: true }))).toHaveCount(0);
    }
  }

  test('Tiers › “Tier Benefits” defaults to the member’s own tier (Gold) with its perks', async ({ page }) => {
    await openSignedIn(page);
    await openTiers(page);
    await expect(text(page, 'Tier Benefits')).toBeVisible();
    for (const n of Object.keys(PERKS)) await expect(text(page, n)).toBeVisible();
    await expectTier(page, 'Gold');
  });

  test('Tiers › each tier tab shows that tier’s pill, description and perks', async ({ page }) => {
    await openSignedIn(page);
    await openTiers(page);
    for (const n of ['Bronze', 'Silver', 'Platinum', 'Gold']) {
      await text(page, n).click();
      await expectTier(page, n);
    }
  });

  test('Tiers › a Silver member sees Silver selected by default', async ({ page }) => {
    await patchMe(page, (me) => { me.user.tier = 'Silver'; });
    await openSignedIn(page);
    await openTiers(page);
    await expect(text(page, 'Silver Member')).toBeVisible();
    await expectTier(page, 'Silver');
  });

  test('Tiers › unverified banner shows only when membership is not verified', async ({ page }) => {
    const banner = "Your club hasn't verified your membership yet, so tier progress is on hold — you can still earn and redeem Flagrr Cash as normal. Ask your golf club to add you to their member list.";
    await openSignedIn(page);
    await openTiers(page);
    await expect(page.getByText(banner)).toHaveCount(0);
    await scenario(page, { unverified: true });
    await page.reload();
    await openTiers(page);
    await expect(text(page, banner)).toBeVisible();
  });

  test('Tiers › top tier renders today’s “0 pts to ” line (nextTier null; known bug)', async ({ page }) => {
    await scenario(page, { topTier: true });
    await openSignedIn(page);
    await openTiers(page);
    await expect(text(page, 'Platinum Member')).toBeVisible();
    await expect(text(page, /^0 pts to\s*$/)).toBeVisible();
    await expectTier(page, 'Platinum');
  });

  test('Tiers › Back returns to Home', async ({ page }) => {
    await openSignedIn(page);
    await openTiers(page);
    await button(page, 'Back').click();
    await homeVisible(page);
  });
});

// =====================================================================
test.describe('Tab bar', () => {
  test('Tab bar › six tabs in order with Scan in the centre', async ({ page }) => {
    await openSignedIn(page);
    const bar = vis(page.getByRole('tablist')).first();
    await expect(bar.getByRole('tab')).toHaveText(['Home', 'Course', 'My Golf', 'Rewards', 'Activity', 'Profile']);
    const labels = await bar.locator('[role="tab"], [role="button"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect(labels).toEqual(['Home', 'Course', 'My Golf', 'Scan receipt', 'Rewards', 'Activity', 'Profile']);
  });

  test('Tab bar › every tab opens its screen and Home comes back', async ({ page }) => {
    await openSignedIn(page);
    const dest: Array<[Parameters<typeof tab>[1], string]> = [
      ['Course', 'Play a round'], ['My Golf', 'My Golf'], ['Rewards', 'Rewards Shop'], ['Activity', 'Reward Activity'], ['Profile', 'Sam Mokoena'],
    ];
    for (const [t, h] of dest) {
      await tab(page, t);
      await expect(heading(page, h)).toBeVisible();
    }
    await tab(page, 'Home');
    await homeVisible(page);
  });

  test('Tab bar › Scan opens the receipt camera screen (no tab bar there)', async ({ page }) => {
    await openSignedIn(page);
    await button(page, 'Scan receipt').click();
    await expect(text(page, 'Scan Receipt')).toBeVisible();
    await expect(vis(page.getByRole('tablist'))).toHaveCount(0);
  });

  test('Tab bar › re-pressing the active tab does nothing (no scroll-to-top)', async ({ page }) => {
    await openSignedIn(page);
    const viewAll = vis(page.getByRole('link', { name: 'View All' })).first();
    await viewAll.scrollIntoViewIfNeeded();
    const before = (await viewAll.boundingBox())!.y;
    await tab(page, 'Home');
    await page.waitForTimeout(600);
    expect(Math.round((await viewAll.boundingBox())!.y)).toBe(Math.round(before));
  });

  test.fixme('Tab bar › the active tab exposes its selected state — web renders role="tab" without aria-selected', async ({ page }) => {
    await openSignedIn(page);
    await expect(vis(page.getByRole('tab', { name: 'Home' }))).toHaveAttribute('aria-selected', 'true');
  });

  test.fixme('Accessibility states › My Stats period exposes the checked option — web renders role="radio" without aria-checked', async ({ page }) => {
    await openSignedIn(page);
    await expect(statsRadio(page, 'Year')).toBeChecked();
  });

  test.fixme('Accessibility states › a submitting PillButton is announced busy — web renders no aria-busy', async ({ page }) => {
    await delay(page, `${API}/api/auth/login`, 1500);
    await gotoLogin(page);
    await loginAs(page);
    await expect(button(page, 'Login')).toHaveAttribute('aria-busy', 'true');
  });

  test.skip('Tab bar › indicator slide / Reduce Motion snap; Android & Reduce Transparency solid glass; hardware back to Home', () => {
    // visual / native only: indicator animation and glass fill are styling; Android hardware back is native.
  });
});

// =====================================================================
test.describe('Session, logout and URLs', () => {
  test('Session › stored token restores straight to Home, with the restore spinner while loading', async ({ page }) => {
    await delay(page, ME, 1500);
    await bootWithToken(page);
    await expect(vis(page.getByRole('progressbar')).first()).toBeVisible();
    await expect(page.getByText('Get Started')).toHaveCount(0);
    await homeVisible(page);
  });

  test('Session › restore failure (server error) deletes the token and lands on Landing with no message', async ({ page }) => {
    await scenario(page, { fail: { 'GET /api/me': 500 } });
    await bootWithToken(page);
    await expect(button(page, 'Get Started')).toBeVisible();
    expect(await storage(page, 'flagrr_auth_token')).toBeNull();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('Session › restore with an expired token lands on Landing and deletes it', async ({ page }) => {
    await bootWithToken(page, 'expired-token');
    await expect(button(page, 'Get Started')).toBeVisible();
    expect(await storage(page, 'flagrr_auth_token')).toBeNull();
  });

  test('Session › restore while offline logs the member out', async ({ page }) => {
    await offline(page, ME);
    await bootWithToken(page);
    await expect(button(page, 'Get Started')).toBeVisible();
    expect(await storage(page, 'flagrr_auth_token')).toBeNull();
  });

  test('Session › Log Out: no confirmation, straight to Landing, token removed, no server call, theme kept', async ({ page }) => {
    await openSignedIn(page, { theme: 'dark' });
    await tab(page, 'Profile');
    await expect(heading(page, 'Sam Mokoena')).toBeVisible();
    const calls: string[] = [];
    page.on('request', (r) => { if (r.url().startsWith(API)) calls.push(`${r.method()} ${r.url()}`); });
    await button(page, 'Log Out').click();
    await expect(button(page, 'Get Started')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(await storage(page, 'flagrr_auth_token')).toBeNull();
    expect(await storage(page, 'flagrr_theme_preference')).toBe('dark');
    expect(calls).toEqual([]);
  });

  test('Session › logout keeps the placeholder popup counter', async ({ page }) => {
    await scenario(page, { placeholder: true });
    await openSignedIn(page);
    await dismissAlert(page, 'Close');
    await tab(page, 'Profile');
    await button(page, 'Log Out').click();
    await expect(button(page, 'Get Started')).toBeVisible();
    expect(await storage(page, POPUP_KEY)).toBe('1');
  });

  test('Session › an expired token mid-session does not log the member out', async ({ page }) => {
    await openSignedIn(page);
    await scenario(page, { fail: { 'GET /api/me': 401 } });
    await statsRadio(page, 'Month').click();
    await tab(page, 'Course');
    await tab(page, 'Home');
    await homeVisible(page);
    expect(await storage(page, 'flagrr_auth_token')).toBe(TOKEN);
  });

  test('Session › the web URL never changes per screen and a refresh returns to Home', async ({ page, baseURL }) => {
    await openSignedIn(page);
    await bell(page).click();
    await expect(heading(page, 'Notifications')).toBeVisible();
    expect(page.url()).toBe(`${baseURL}/`);
    await page.reload();
    await homeVisible(page);
  });

  test.skip('Session › push registration, OS permission prompt, foreground banner and tap routing', () => {
    // native only: registerForPushNotificationsAsync returns null on web.
  });

  test.skip('Session › font splash hold; Android hardware back exits from Home/Landing; flagrr:// deep links', () => {
    // native only.
  });
});

// =====================================================================
test.describe('Theme and motion', () => {
  test('Theme › light preference gives a light ground; dark preference a dark ground', async ({ page, context }) => {
    await openSignedIn(page, { theme: 'light' });
    expect(await groundIsDark(page)).toBe(false);
    const p2 = await context.newPage();
    await openSignedIn(p2, { theme: 'dark' });
    expect(await groundIsDark(p2)).toBe(true);
  });

  test('Theme › “system” follows the OS colour scheme live', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await openSignedIn(page, { theme: 'system' });
    expect(await groundIsDark(page)).toBe(true);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(() => groundIsDark(page)).toBe(false);
  });

  test('Theme › with no local choice, the account preference is adopted and saved locally', async ({ page }) => {
    await patchMe(page, (me) => { me.user.themePreference = 'dark'; });
    await page.addInitScript(() => localStorage.removeItem('flagrr_theme_preference'));
    await openSignedIn(page);
    await expect.poll(() => storage(page, 'flagrr_theme_preference')).toBe('dark');
    await expect.poll(() => groundIsDark(page)).toBe(true);
  });

  test('Theme › a local choice wins over the account preference', async ({ page }) => {
    await patchMe(page, (me) => { me.user.themePreference = 'dark'; });
    await openSignedIn(page, { theme: 'light' });
    await page.waitForTimeout(300);
    expect(await storage(page, 'flagrr_theme_preference')).toBe('light');
    expect(await groundIsDark(page)).toBe(false);
  });

  test('Motion › Reduce Motion shows final CountUp values straight away', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('flagrr_auth_token', 'e2e-demo-token'));
    await page.goto('/');
    const bal = vis(page.getByLabel('12,480 Flagrr Cash')).first();
    await bal.waitFor();
    expect(await bal.textContent()).toBe('12,480');
  });
});
