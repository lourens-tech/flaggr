import { test, expect, type Page, type Locator, type Route } from '@playwright/test';
import { API, RESET_CODE, TEST_EMAIL, TEST_PASSWORD, TOKEN, appAlert, openSignedIn, reset, scenario, tab } from './helpers';

// Click-through for inventory section A, signed in: Home, placeholder-club popup, Ads,
// Notifications, Member Tiers, tab bar, session/logout/URLs, theme and motion
// (docs/Member-App-Functionality-Inventory.md). Split from signin-home.spec.ts on
// 24 Nov 2026; auth.spec.ts has the sign-in screens, with the same helpers below.
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

  // Owner decision 24 Nov 2026 (no silent failures): a failed period switch says so and the previous
  // period stays selected (was: silent, and the year's numbers showed under "Month").
  test('Home › a failed period switch shows “Couldn’t load your stats” and keeps the previous period', async ({ page }) => {
    await patchMe(page, (me, url) => { if (url.searchParams.get('period') === 'month') me.stats.bucksEarned = 1111; });
    await openSignedIn(page);
    await expect(text(page, '9,860')).toBeVisible();
    await scenario(page, { fail: { 'GET /api/me': 500 } });
    await statsRadio(page, 'Month').click();
    await expectAlert(page, 'Couldn’t load your stats', 'Something went wrong on our side. Please try again.');
    await dismissAlert(page);
    await expect(statsRadio(page, 'Year')).toBeChecked();
    await expect(text(page, '−53% vs Last Year')).toBeVisible();
    await expect(text(page, '9,860')).toBeVisible();
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

  test('Placeholder › “Close” dismisses; placeholder Home shows the placeholder club, empty rewards rail and no ad slot', async ({ page }) => {
    await scenario(page, { placeholder: true });
    await openSignedIn(page);
    await expectAlert(page, POPUP_TITLE);
    await dismissAlert(page, 'Close');
    await expect(button(page, "Your Club: My Club Isn't Listed Yet")).toBeVisible();
    await expect(heading(page, 'Rewards')).toBeVisible();
    await expect(page.getByRole('button', { name: /, \d+ Flagrr Cash$/ })).toHaveCount(0);
    // Owner decision 24 Nov 2026: no booked ad means no slot at all (was an “Ad Space” box).
    await expect(vis(page.getByText('Ad Space', { exact: true }))).toHaveCount(0);
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
    // The button's accessible name starts with its visible label (screen readers and voice control).
    await expect(vis(page.getByRole('button', { name: /^View, / }))).toHaveCount(2);
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

  // Bento restyle (owner rule: match the boards): the icons are line SVGs now, not Ionicons glyphs, so the
  // read/unread state is read from the row's status icon label and the chevron is the row's second icon.
  const nRow = (page: Page, id: string) => vis(page.getByTestId(`notification-${id}`));

  test('Notifications › unread rows show a bell icon, read rows a check icon; enquiry rows a chevron', async ({ page }) => {
    await openSignedIn(page);
    await openNotifications(page);
    await expect(nRow(page, 'n1').getByRole('img', { name: 'Unread', exact: true })).toBeVisible(); // restyle: was the bell glyph
    await expect(nRow(page, 'n3').getByRole('img', { name: 'Read', exact: true })).toBeVisible(); // restyle: was the check glyph
    await expect(nRow(page, 'n2')).toHaveAccessibleName('Your club replied. Thanks, we have booked your tee time.');
    await expect(nRow(page, 'n2').locator('svg')).toHaveCount(2); // restyle: status icon + chevron (was the chevron glyph)
    await expect(nRow(page, 'n2')).not.toContainText('View');
  });

  test('Notifications › each row shows its time: clock time today, weekday this week, date earlier (boards)', async ({ page }) => {
    await openSignedIn(page);
    await openNotifications(page);
    const dates = await page.request.get(`${API}/api/notifications`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then((r) => r.json());
    const expected = await page.evaluate((list: Array<{ id: string; date: string }>) => {
      const d = (id: string) => new Date(list.find((n) => n.id === id)!.date);
      return {
        n1: d('n1').toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
        n2: d('n2').toLocaleDateString(undefined, { weekday: 'short' }),
        n3: d('n3').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      };
    }, dates);
    for (const [id, time] of Object.entries(expected)) await expect(nRow(page, id).getByText(time, { exact: true })).toBeVisible();
  });

  test('Notifications › a row exactly 7 days old (still “This Week”) shows its date, not today’s weekday', async ({ page }) => {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    await patchJson(page, /\/api\/notifications(\?|$)/, (list) => list.map((n: any) => (n.id === 'n2' ? { ...n, date: weekAgo } : n)));
    await openSignedIn(page);
    await openNotifications(page);
    const expected = await page.evaluate((iso: string) => ({
      date: new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      weekday: new Date(iso).toLocaleDateString(undefined, { weekday: 'short' }),
    }), weekAgo);
    await expect(nRow(page, 'n2').getByText(expected.date, { exact: true })).toBeVisible();
    await expect(nRow(page, 'n2').getByText(expected.weekday, { exact: true })).toHaveCount(0);
  });

  test('Notifications › the header gear opens Notification Preferences (approved addition)', async ({ page }) => {
    await openSignedIn(page);
    await openNotifications(page);
    await button(page, 'Notification Preferences').click();
    await expect(heading(page, 'Notification Preferences')).toBeVisible();
    await button(page, 'Back').click();
    await expect(heading(page, 'Notifications')).toBeVisible();
  });

  test('Notifications › “View” marks read only (server call, Home badge drops, no navigation)', async ({ page }) => {
    await openSignedIn(page);
    await openNotifications(page);
    const req = page.waitForRequest((r) => r.url().includes('/api/notifications?action=read'));
    const row = nRow(page, 'n1'); // restyle: rows carry a test id (the title's grandparent is no longer the row)
    await row.getByText('View', { exact: true }).click();
    expect((await req).postDataJSON()).toEqual({ id: 'n1' });
    await expect(row.getByRole('img', { name: 'Read', exact: true })).toBeVisible(); // restyle: was the check glyph
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

  // Owner decision 24 Nov 2026 (no silent failures): "View" failing says so and the row is unread
  // again (was: ignored, the badge dropped although the server never marked it read).
  test('Notifications › “View” failing shows “Couldn’t mark as read” and the row stays unread', async ({ page }) => {
    await scenario(page, { fail: { 'POST /api/notifications?action=read': 500 } });
    await openSignedIn(page);
    await openNotifications(page);
    await vis(page.getByText('View', { exact: true })).first().click();
    await expectAlert(page, 'Couldn’t mark as read', 'Something went wrong. Please try again.');
    await dismissAlert(page);
    await button(page, 'Back').click();
    await expect(bell(page)).toHaveAccessibleName('Notifications, 2 unread');
  });

  // Owner decision 24 Nov 2026: the empty list shows the board's empty state (was a blank screen).
  test('Notifications › empty list shows “No notifications yet” (no groups)', async ({ page }) => {
    await scenario(page, { noNotifications: true });
    await openSignedIn(page);
    await openNotifications(page);
    await expect(vis(page.getByText(/^(Today|Yesterday|This Week|Earlier)$/))).toHaveCount(0);
    await expect(vis(page.getByText('View', { exact: true }))).toHaveCount(0);
    await expect(heading(page, 'No notifications yet')).toBeVisible();
    await expect(text(page, 'Updates about your receipts, rewards and enquiries will show here.')).toBeVisible();
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

  // Owner decisions 24 Nov 2026 (Member Tiers): the board's layout wins (quarterly progress, all four tiers
  // as rows instead of the tier tabs); perks keep the multiplier but drop rands; no "points" for Flagrr Cash.
  test('Tiers › balance card: balance, tier and multiplier (board: “Gold · earning ×1.5”)', async ({ page }) => {
    await openSignedIn(page);
    await openTiers(page);
    await expect(vis(page.getByLabel('12,480 Flagrr Cash'))).toHaveText('12,480');
    await expect(text(page, 'Flagrr Cash')).toBeVisible();
    // decision (board layout): was the “Gold Member” badge. Two: the balance card's tier plus the Tier Benefits row.
    await expect(vis(page.getByText('Gold', { exact: true }))).toHaveCount(2);
    await expect(text(page, 'earning ×1.5')).toBeVisible();
  });

  test('Tiers › quarterly progress: “1,786 FC to Platinum”, this quarter’s Flagrr Cash and the Platinum threshold', async ({ page }) => {
    await openSignedIn(page);
    await openTiers(page);
    await expect(text(page, 'How to Reach the Next Tier')).toBeVisible();
    await expect(text(page, '1,786 FC to Platinum')).toBeVisible(); // decision (no “points”, board layout): was “1,786 pts to Platinum”
    await expect(text(page, 'Earn it before this quarter ends.')).toBeVisible();
    await expect(text(page, '13,214 FC this quarter')).toBeVisible(); // 15,000 − 1,786 (api/_lib/tiers.ts)
    await expect(text(page, '15,000')).toBeVisible();
    expect(await tierFill(page)).toBe('64%');
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

  // Decision: perks keep the multiplier, drop rands (was “… per R1 spent”, “R100/R200 bar voucher …”); birthday
  // lines use the AppTiers board's wording (was “Birthday reward (N Flagrr Cash)”).
  const TIERS: Record<string, { mult: string; from: string; perks: string[] }> = {
    Bronze: { mult: '×1', from: 'From 0 FC', perks: ['Flagrr Cash on your receipts', 'Birthday reward of 50 FC'] },
    Silver: { mult: '×1.2', from: 'From 5,000 FC a quarter', perks: ['1.2x Flagrr Cash on your receipts', 'Birthday reward of 100 FC'] },
    Gold: { mult: '×1.5', from: 'From 10,000 FC a quarter', perks: ['1.5x Flagrr Cash on your receipts', 'Birthday reward of 150 FC', 'A bar voucher each quarter you qualify'] },
    Platinum: { mult: '×1.7', from: 'From 15,000 FC a quarter', perks: ['1.7x Flagrr Cash on your receipts', 'Birthday reward of 200 FC', 'A bar voucher each quarter you qualify'] },
  };
  /** The progress bar's fill width (FillBar's accessibilityValue is not rendered as aria-valuenow on web). */
  const tierFill = (page: Page) => vis(page.getByRole('progressbar', { name: 'Tier progress' })).locator('> div').first().evaluate((el) => (el as HTMLElement).style.width);
  const tierRow = (page: Page, name: string) => vis(page.getByTestId(`tier-${name}`));
  async function expectTierRows(page: Page, current: string, next: string | null) {
    await expect(text(page, 'Tier Benefits')).toBeVisible();
    for (const [name, t] of Object.entries(TIERS)) {
      const row = tierRow(page, name);
      await expect(row.getByText(name, { exact: true })).toBeVisible();
      await expect(row.getByText(t.mult, { exact: true })).toBeVisible();
      await expect(row.getByText(t.from, { exact: true })).toBeVisible();
      for (const p of t.perks) await expect(row.getByText(p, { exact: true })).toBeVisible();
      await expect(row.getByText('Current', { exact: true })).toHaveCount(name === current ? 1 : 0);
      await expect(row.getByText('Next', { exact: true })).toHaveCount(name === next ? 1 : 0);
    }
    await expect(vis(page.getByText(/R1\b|R100|R200|per R1/))).toHaveCount(0); // brand kit: no rands
  }

  test('Tiers › “Tier Benefits” lists all four tiers with multiplier, threshold and perks; Gold is Current, Platinum Next', async ({ page }) => {
    await openSignedIn(page);
    await openTiers(page);
    await expectTierRows(page, 'Gold', 'Platinum');
  });

  test('Tiers › a Silver member sees Silver marked Current', async ({ page }) => {
    await patchMe(page, (me) => { me.user.tier = 'Silver'; me.points.nextTier = 'Gold'; });
    await openSignedIn(page);
    await openTiers(page);
    await expect(text(page, 'earning ×1.2')).toBeVisible();
    await expectTierRows(page, 'Silver', 'Gold');
  });

  test('Tiers › unverified banner shows only when membership is not verified; no quarterly figures then', async ({ page }) => {
    const banner = "Your club hasn't verified your membership yet, so tier progress is on hold — you can still earn and redeem Flagrr Cash as normal. Ask your golf club to add you to their member list.";
    await openSignedIn(page);
    await openTiers(page);
    await expect(page.getByText(banner)).toHaveCount(0);
    await scenario(page, { unverified: true });
    await page.reload();
    await openTiers(page);
    await expect(text(page, banner)).toBeVisible();
    // An unverified member is held at Bronze whatever they earn (api/_lib/tiers.ts), so the quarter's figures aren't shown.
    await expect(vis(page.getByText(/FC this quarter$/))).toHaveCount(0);
  });

  // Decision (board G-A-TiersTop): the top tier reads “You’ve reached the top tier” (was the broken “0 pts to ” line).
  test('Tiers › top tier reads “You’ve reached the top tier” with a full bar; Platinum is Current, no Next', async ({ page }) => {
    await scenario(page, { topTier: true });
    await openSignedIn(page);
    await openTiers(page);
    await expect(vis(page.getByText('Platinum', { exact: true }))).toHaveCount(2); // balance card + Tier Benefits row
    await expect(text(page, 'earning ×1.7')).toBeVisible();
    await expect(text(page, 'You’ve reached the top tier')).toBeVisible();
    await expect(vis(page.getByText(/pts to/))).toHaveCount(0);
    expect(await tierFill(page)).toBe('100%');
    await expectTierRows(page, 'Platinum', null);
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
  test('Tab bar › four tabs in order with Scan in the centre (Bento boards)', async ({ page }) => {
    await openSignedIn(page);
    const bar = vis(page.getByRole('tablist')).first();
    await expect(bar.getByRole('tab')).toHaveText(['Home', 'Course', 'Rewards', 'Profile']);
    const labels = await bar.locator('[role="tab"], [role="button"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect(labels).toEqual(['Home', 'Course', 'Scan receipt', 'Rewards', 'Profile']);
  });

  test('Tab bar › every tab opens its screen (My Golf from Home, Reward Activity from Profile) and Home comes back', async ({ page }) => {
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

  test('Tab bar › re-pressing the active tab scrolls it back to the top', async ({ page }) => {
    await openSignedIn(page);
    const viewAll = vis(page.getByRole('link', { name: 'View All' })).first();
    await viewAll.scrollIntoViewIfNeeded();
    const greeting = vis(page.getByRole('heading', { name: /^(Morning|Afternoon|Evening), Sam$/ })).first();
    await expect(greeting).not.toBeInViewport();
    await vis(page.getByRole('tab', { name: 'Home' })).click(); // already selected: a re-press
    await expect(greeting).toBeInViewport();
  });

  test('Tab bar › lights the right tab when a screen switches tabs itself (Home “Redeem” → Rewards)', async ({ page }) => {
    await openSignedIn(page);
    await vis(page.getByRole('button', { name: 'Redeem Flagrr Cash' })).first().click();
    await expect(vis(page.getByRole('tab', { name: 'Rewards' }))).toHaveAttribute('aria-selected', 'true');
    await expect(vis(page.getByRole('tab', { name: 'Home' }))).toHaveAttribute('aria-selected', 'false');
  });

  test('Tab bar › slides away on pushed screens and comes back on the tabs and My Golf (Course lit)', async ({ page }) => {
    await openSignedIn(page);
    await bell(page).click();
    await expect(vis(page.getByRole('tablist'))).toHaveCount(0);
    await vis(page.getByRole('button', { name: 'Back', exact: true })).first().click();
    await expect(vis(page.getByRole('tablist'))).toHaveCount(1);
    await tab(page, 'My Golf');
    await expect(vis(page.getByRole('tab', { name: 'Course' }))).toHaveAttribute('aria-selected', 'true');
  });

  test('Tab bar › the active tab exposes its selected state (aria-selected)', async ({ page }) => {
    await openSignedIn(page);
    await expect(vis(page.getByRole('tab', { name: 'Home' }))).toHaveAttribute('aria-selected', 'true');
  });

  test('Accessibility states › My Stats period exposes the checked option (aria-checked)', async ({ page }) => {
    await openSignedIn(page);
    await expect(statsRadio(page, 'Year')).toBeChecked();
  });

  test('Accessibility states › a submitting PillButton is announced busy (aria-busy)', async ({ page }) => {
    await delay(page, `${API}/api/auth/login`, 1500);
    await gotoLogin(page);
    await loginAs(page);
    await expect(page.getByRole('button', { name: 'Login', exact: true }).and(page.locator('[aria-busy="true"]'))).toHaveCount(1);
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
    // Owner decision 24 Nov 2026 (no silent failures): the failed period switch now says so.
    await expectAlert(page, 'Couldn’t load your stats');
    await dismissAlert(page);
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
