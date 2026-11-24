import { test, expect, type Page, type Locator, type Route } from '@playwright/test';
import { API, RESET_CODE, TEST_EMAIL, TEST_PASSWORD, TOKEN, appAlert, openSignedIn, reset, scenario, tab } from './helpers';

// Click-through for inventory section A, sign-in screens: Landing, Login, Sign up
// steps 1 and 2, Forgot / reset password (docs/Member-App-Functionality-Inventory.md).
// Split from signin-home.spec.ts on 24 Nov 2026; home.spec.ts has the rest of section A,
// with the same helpers below.
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
