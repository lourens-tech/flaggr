import { test, expect, type Page, type Route } from '@playwright/test';
import { API, TOKEN, appAlert, openSignedIn, reset, scenario, tab } from './helpers';

// friendlyError's text for a 5xx or a technical message (src/utils/errors.ts SERVER_MESSAGE).
const SERVER_MESSAGE = 'Something went wrong on our side. Please try again.';

// Click-through of inventory section "D. Golf" (docs/Member-App-Functionality-Inventory.md):
// Course tab, Start a Round, the hole view (score bar, putts/fairway, sheets, layers,
// map controls, save/offline), Round detail and My Golf.
//
// The mock keeps the golf profile in a module variable that /api/__reset does not
// restore, so every test also puts the sample profile back (restoreProfile).
// A few states the mock cannot produce (away courses, nine-hole ratings, the share
// flag in golfStats) are reached by rewriting one mock response in the page with
// page.route; those tests say so in a comment.

const COURSE_ID = '22222222-2222-4222-8222-222222222222';
const SAMPLE_PROFILE = { handicapIndex: 12.4, ratingGender: 'men', format: 'stableford', allowance: 0.95, bag: null, trackStats: false, shareWithClub: true };
const AUTH = { Authorization: `Bearer ${TOKEN}` };

type Entry = { s: number | 'P' | null; putts: number | null; fw: 'left' | 'hit' | 'right' | null };
type Round = { id: string; holes: Array<{ n: number; par: number; si: number; length: number }>; entries: Entry[]; status: string; teeId: string; format: string; allowance: number; trackStats: boolean; handicapIndex: number | null };

// ---------------- helpers (mock API) ----------------
async function golfGet(page: Page, action: string, query = '') {
  const res = await page.request.get(`${API}/api/courses?action=${action}${query}`, { headers: AUTH });
  return res.json();
}
async function golfPost(page: Page, action: string, body: unknown) {
  const res = await page.request.post(`${API}/api/courses?action=${action}`, { headers: AUTH, data: body });
  return { status: res.status(), json: await res.json() };
}
async function restoreProfile(page: Page) {
  await golfPost(page, 'golfProfile', SAMPLE_PROFILE);
}
/** Start a round through the API (as Round Setup would), with optional profile changes first. */
async function startRound(page: Page, opts: { teeId?: string; format?: 'stableford' | 'stroke'; allowance?: 0.95 | 1; profile?: Record<string, unknown> } = {}): Promise<Round> {
  if (opts.profile) await golfPost(page, 'golfProfile', opts.profile);
  const { json } = await golfPost(page, 'golfRoundStart', {
    golfCourseId: COURSE_ID, teeId: opts.teeId ?? 'white', gender: 'men', layout: 'full', format: opts.format ?? 'stableford', allowance: opts.allowance ?? 0.95,
  });
  return json as Round;
}
const parEntries = (r: Round, n: number, extra: Partial<Entry> = {}): Entry[] =>
  r.holes.map((h, i) => (i < n ? { s: h.par, putts: null, fw: null, ...extra } : { s: null, putts: null, fw: null }));
async function saveEntries(page: Page, r: Round, entries: Entry[]) {
  await golfPost(page, 'golfRoundSave', { id: r.id, entries });
}
async function getRound(page: Page, id: string): Promise<Round> {
  return golfGet(page, 'golfRound', `&id=${id}`);
}
async function mockState(page: Page) {
  return (await page.request.get(`${API}/api/__state`)).json();
}
const failKey = (method: 'GET' | 'POST', action: string) => `${method} /api/courses?action=${action}`;
async function fail(page: Page, method: 'GET' | 'POST', action: string, status: number) {
  await scenario(page, { fail: { [failKey(method, action)]: status } });
}
async function unfail(page: Page, method: 'GET' | 'POST', action: string) {
  await scenario(page, { fail: { [failKey(method, action)]: 0 } });
}

// ---------------- helpers (page) ----------------
const isAction = (action: string) => (url: URL) => url.pathname === '/api/courses' && url.searchParams.get('action') === action;
/** Rewrite one mock JSON response in the page (for states the mock has no switch for). */
async function patch(page: Page, action: string, edit: (json: any) => void) {
  await page.route(isAction(action), async (route: Route) => {
    const res = await route.fetch();
    const json = await res.json();
    if (res.ok()) edit(json);
    await route.fulfill({ response: res, json });
  });
}
/** Hold one mock call for a while, to see loading states. */
async function delay(page: Page, action: string, ms: number) {
  await page.route(isAction(action), async (route: Route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}
const sheet = (page: Page, title: string) => page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
const scoreValue = (page: Page) => page.getByLabel(/^(Enter par, \d+|Score \d+|Picked up\. Tap to clear)$/);
const cardBtn = (page: Page) => page.getByLabel('Open scorecard');
const shotCard = (page: Page) => page.locator('[aria-live="polite"]');
const holeMap = (page: Page) => page.getByLabel('Hole map. Drag to move around, tap to aim.');
const greenCard = (page: Page) => page.getByLabel(/^Green: front \d+, middle \d+, back \d+ metres$/);
const status = (page: Page) => page.getByText(/^(Saved|Saving…|Not saved yet · will retry|Finished round · changes save)$/);

async function openCourse(page: Page, opts: { theme?: 'light' | 'dark' } = {}) {
  await openSignedIn(page, opts);
  await tab(page, 'Course');
  await expect(page.getByRole('heading', { name: 'Away courses' })).toBeVisible();
}
/** Open the in-progress round from the Course tab hero. */
async function openRound(page: Page, opts: { map?: boolean } = {}) {
  await openCourse(page);
  await page.getByRole('button', { name: 'Resume round' }).click();
  await expect(status(page)).toBeVisible();
  if (opts.map !== false) await expect(greenCard(page)).toBeVisible(); // Owner decision 24 Nov 2026: GPS is not wanted, the "GPS integration coming soon" chip is gone; the green card shows the map has loaded.
}
async function openMyGolf(page: Page) {
  await openSignedIn(page);
  await tab(page, 'My Golf');
  await expect(page.getByRole('heading', { name: 'My Golf' })).toBeVisible();
}
async function longPress(page: Page, el: ReturnType<Page['getByLabel']>) {
  // Wait until the control has stopped moving (entrances ease in): a press whose target slides
  // out from under a still pointer is cancelled, as it would be under a finger.
  let last = -1;
  await expect.poll(async () => {
    const y = Math.round((await el.boundingBox())?.y ?? -1);
    const still = y === last;
    last = y;
    return still;
  }, { intervals: [250] }).toBe(true);
  await el.hover();
  await page.mouse.down();
  await page.waitForTimeout(900);
  await page.mouse.up();
}
const fmt1 = (x: number) => x.toFixed(1);
const sign = (x: number) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test.beforeEach(async ({ page }) => {
  await reset(page);
  await restoreProfile(page);
  onlyVisible(page);
});

/**
 * The web build keeps earlier stack screens and tabs mounted (hidden) under the
 * current one, so the same copy can exist twice in the DOM. Page-level getBy*
 * locators in this file only match what the member can see.
 */
function onlyVisible(page: Page) {
  for (const m of ['getByText', 'getByRole', 'getByLabel', 'getByPlaceholder'] as const) {
    const orig = (page[m] as (...a: unknown[]) => ReturnType<Page['getByText']>).bind(page);
    (page as unknown as Record<string, unknown>)[m] = (...a: unknown[]) => orig(...a).filter({ visible: true });
  }
}

// =====================================================================
test.describe('Course tab', () => {
  test('Course › header, Your club tile, Your game tile with Played recently, empty away list and footnote', async ({ page }) => {
    const year = await golfGet(page, 'golfStats', '&period=year');
    await openCourse(page);
    await expect(page.getByText('Strand Golf Club', { exact: true }).first()).toBeVisible(); // eyebrow
    await expect(page.getByRole('heading', { name: 'Play a round' })).toBeVisible();
    await expect(page.getByText('Hole maps, distances and your scorecard')).toBeVisible();
    await expect(page.getByText('Your club', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play Strand Golf Club' })).toContainText('Strand, Western Cape · 18 holes');
    await expect(page.getByRole('button', { name: 'Start a round' })).toBeVisible();
    const game = page.getByRole('button', { name: 'My Golf' });
    await expect(game).toContainText('Your game · Stableford average');
    await expect(game).toContainText(`${fmt1(year.stats.pointsAverage)}pts`);
    await expect(page.getByText('Played recently')).toBeVisible();
    const rows = page.getByRole('button', { name: /· Strand Golf Club \d+ pts/ });
    await expect(rows).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const r = year.stats.recent[i];
      await expect(rows.nth(i)).toContainText(`${r.points} pts · ${r.gross} gross`);
    }
    await expect(page.getByText('No other courses are mapped yet. More are added as clubs join Flagrr.')).toBeVisible();
    await expect(page.getByPlaceholder('Search courses')).toHaveCount(0);
    await expect(page.getByText('Only courses Flagrr has mapped are listed, so every scorecard here matches the club’s official card.')).toBeVisible();
    await expect(page.getByText('Round in progress')).toHaveCount(0);
  });

  test('Course › reached from Home “Play a round” tile', async ({ page }) => {
    await openSignedIn(page);
    await page.getByLabel('Play a round: open the Course tab').click();
    await expect(page.getByRole('heading', { name: 'Away courses' })).toBeVisible();
    await expect(page.getByText('Hole maps, distances and your scorecard')).toBeVisible();
  });

  test('Course › loading spinner on first load', async ({ page }) => {
    await delay(page, 'golfHome', 2500);
    await openSignedIn(page);
    await tab(page, 'Course');
    await expect(page.getByRole('progressbar')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Away courses' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('progressbar')).toHaveCount(0);
  });

  test('Course › load error shows the message and “Try again” reloads', async ({ page }) => {
    await fail(page, 'GET', 'golfHome', 500);
    await openSignedIn(page);
    await tab(page, 'Course');
    await expect(page.getByText(SERVER_MESSAGE)).toBeVisible(); // Owner decision 24 Nov 2026 (friendly wording): a 5xx or technical message shows the friendly text.
    await expect(page.getByRole('heading', { name: 'Away courses' })).toHaveCount(0);
    await unfail(page, 'GET', 'golfHome');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: 'Away courses' })).toBeVisible();
    await expect(page.getByText(SERVER_MESSAGE)).toHaveCount(0); // Owner decision 24 Nov 2026 (friendly wording): a 5xx or technical message shows the friendly text.
  });

  // Area decision (phase 3): Course always offers the way into My Golf, so the Your game
  // tile now shows "–" when the stats fail or there are no finished rounds (it used to be left out).
  test('Course › Your game tile shows “–” and still opens My Golf when stats fail or there are no completed rounds', async ({ page }) => {
    await fail(page, 'GET', 'golfStats', 500);
    await openCourse(page);
    await expect(page.getByRole('button', { name: 'Start a round' })).toBeVisible();
    const game = page.getByRole('button', { name: 'My Golf' });
    await expect(game).toContainText('Your game · Stableford average');
    await expect(game).toContainText('–pts');
    await expect(page.getByText('Played recently')).toHaveCount(0);
    await unfail(page, 'GET', 'golfStats');
    await scenario(page, { noRounds: true });
    await tab(page, 'Home');
    await tab(page, 'Course');
    await expect(page.getByRole('heading', { name: 'Away courses' })).toBeVisible();
    await expect(game).toContainText('–pts');
    await expect(page.getByText('Played recently')).toHaveCount(0);
    await game.click();
    await expect(page.getByText('Play your first round')).toBeVisible();
  });

  test('Course › Your game tile opens My Golf; a Played recently row opens the Round', async ({ page }) => {
    await openCourse(page);
    await page.getByRole('button', { name: 'My Golf' }).click();
    await expect(page.getByRole('heading', { name: 'My Golf' })).toBeVisible();
    await tab(page, 'Course');
    await page.getByRole('button', { name: /· Strand Golf Club \d+ pts/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Round', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Correct a score' })).toBeVisible();
  });

  test('Course › “Start a round” and the home course row open Start a Round', async ({ page }) => {
    await openCourse(page);
    await page.getByRole('button', { name: 'Start a round' }).click();
    await expect(page.getByRole('heading', { name: 'Start a Round' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { name: 'Away courses' })).toBeVisible();
    await page.getByRole('button', { name: 'Play Strand Golf Club' }).click();
    await expect(page.getByRole('heading', { name: 'Start a Round' }).first()).toBeVisible();
  });

  test('Course › round in progress hero: next hole, points thru, course and tees; Resume round opens the hole view', async ({ page }) => {
    const r = await startRound(page);
    await saveEntries(page, r, parEntries(r, 3));
    await openCourse(page);
    await expect(page.getByText('Round in progress')).toBeVisible();
    await expect(page.getByText('Hole 4', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('7 pts · thru 3 of 18')).toBeVisible();
    await expect(page.getByText('Strand Golf Club · White tees')).toBeVisible();
    await page.getByRole('button', { name: 'Resume round' }).click();
    await expect(page.getByLabel('Back. Your round stays in progress')).toBeVisible();
    await expect(page.getByLabel('Hole 4, par 4')).toBeVisible();
  });

  test('Course › hero reads “All holes in” when every hole has a score', async ({ page }) => {
    const r = await startRound(page);
    await saveEntries(page, r, parEntries(r, 18));
    await openCourse(page);
    await expect(page.getByText('All holes in').first()).toBeVisible();
    await expect(page.getByText(/\d+ pts · thru 18 of 18/)).toBeVisible();
  });

  test('Course › stroke-play round in progress still shows Stableford points on the hero', async ({ page }) => {
    const r = await startRound(page, { format: 'stroke' });
    await saveEntries(page, r, parEntries(r, 3));
    await openCourse(page);
    await expect(page.getByText('7 pts · thru 3 of 18')).toBeVisible();
  });

  test('Course › Home “Resume round” tile opens the hole view', async ({ page }) => {
    const r = await startRound(page);
    await saveEntries(page, r, parEntries(r, 3));
    await openSignedIn(page);
    await page.getByLabel(/^Resume round at Strand Golf Club, hole 4, 7 points thru 3$/).click();
    await expect(page.getByLabel('Hole 4, par 4')).toBeVisible();
  });

  test('Course › Discard on the hero: “Keep it” keeps the round, “Discard round” deletes it', async ({ page }) => {
    await startRound(page);
    await openCourse(page);
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    const a = appAlert(page);
    await expect(a).toContainText('Discard this round?');
    await expect(a).toContainText("Your scores at Strand Golf Club will be deleted. This can't be undone.");
    await a.getByRole('button', { name: 'Keep it' }).click();
    await expect(page.getByText('Round in progress')).toBeVisible();
    expect((await golfGet(page, 'golfHome')).inProgress).not.toBeNull();
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await appAlert(page).getByRole('button', { name: 'Discard round' }).click();
    await expect(page.getByText('Round in progress')).toHaveCount(0);
    expect((await golfGet(page, 'golfHome')).inProgress).toBeNull();
  });

  test('Course › discard failure shows “Could not discard the round”', async ({ page }) => {
    await startRound(page);
    await openCourse(page);
    await fail(page, 'POST', 'golfRoundDelete', 500);
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await appAlert(page).getByRole('button', { name: 'Discard round' }).click();
    const a = appAlert(page);
    await expect(a).toContainText('Could not discard the round');
    await expect(a).toContainText(SERVER_MESSAGE); // Owner decision 24 Nov 2026 (friendly wording): a 5xx or technical message shows the friendly text.
    await a.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByText('Round in progress')).toBeVisible();
  });

  test('Course › starting another round while one is in progress: “Round in progress” alert, Close and Resume round', async ({ page }) => {
    await startRound(page);
    await openCourse(page);
    await page.getByRole('button', { name: 'Start a round' }).click();
    let a = appAlert(page);
    await expect(a).toContainText('Round in progress');
    await expect(a).toContainText('Finish or discard your round at Strand Golf Club before starting another.');
    await a.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('heading', { name: 'Away courses' })).toBeVisible();
    await expect(page.getByText('Start a Round', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Play Strand Golf Club' }).click();
    a = appAlert(page);
    await expect(a).toContainText('Finish or discard your round at Strand Golf Club before starting another.');
    await a.getByRole('button', { name: 'Resume round' }).click();
    await expect(page.getByLabel('Back. Your round stays in progress')).toBeVisible();
  });

  test('Course › placeholder club: Coming soon tile with placeholder copy and “Course maps are coming soon”', async ({ page }) => {
    await scenario(page, { placeholder: true });
    await openSignedIn(page);
    await appAlert(page).getByRole('button', { name: 'Close' }).click(); // Home's "club not listed" popup
    await tab(page, 'Course');
    await expect(page.getByText('Coming soon', { exact: true })).toBeVisible();
    await expect(page.getByText('Your club’s course map')).toBeVisible();
    await expect(page.getByText('Your club isn’t on Flagrr yet. Once it joins, we’ll build its hole maps and scorecard here. In the meantime you can play any course below.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start a round' })).toHaveCount(0);
    await expect(page.getByText('Course maps are coming soon. We’re adding them as clubs join Flagrr.')).toBeVisible();
    await expect(page.getByText('Only courses Flagrr has mapped are listed, so every scorecard here matches the club’s official card.')).toBeVisible();
  });

  test('Course › named club without a live map: “{club}’s course map … Yours is on the way.” (response rewritten)', async ({ page }) => {
    // Mock has no switch for "home club not mapped yet" (only placeholder): drop homeCourse from golfHome.
    await patch(page, 'golfHome', (j) => { j.homeCourse = null; j.courses = []; });
    await openCourse(page);
    await expect(page.getByText('Strand Golf Club’s course map')).toBeVisible();
    await expect(page.getByText('We build each club’s hole maps and scorecard from its official card. Yours is on the way.', { exact: true })).toBeVisible();
    await expect(page.getByText('Course maps are coming soon. We’re adding them as clubs join Flagrr.')).toBeVisible();
  });

  test('Course › away courses: list order, Played recently tag, search by name and location, no-match text, row opens setup (response rewritten)', async ({ page }) => {
    // Mock maps only the home course: add three away courses to golfHome.
    await patch(page, 'golfHome', (j) => {
      j.courses.push(
        { id: 'away-z', name: 'Zwartkop Country Club', location: 'Centurion, Gauteng', holeCount: 18, isHome: false, logoUrl: null },
        { id: 'away-m', name: 'Milnerton Golf Club', location: 'Milnerton, Western Cape', holeCount: 18, isHome: false, logoUrl: null },
        { id: 'away-a', name: 'Atlantic Beach Links', location: 'Melkbosstrand, Western Cape', holeCount: 9, isHome: false, logoUrl: null },
      );
      j.recentCourseIds = [...j.recentCourseIds, 'away-z'];
    });
    await openCourse(page);
    const search = page.getByPlaceholder('Search courses');
    await expect(search).toBeVisible();
    const away = page.getByRole('button', { name: /^Play (?!Strand)/ });
    await expect(away).toHaveCount(3);
    await expect(away.nth(0)).toHaveAccessibleName('Play Zwartkop Country Club');
    await expect(away.nth(0)).toContainText('Centurion, Gauteng · 18 holes · Played recently');
    await expect(away.nth(1)).toHaveAccessibleName('Play Atlantic Beach Links');
    await expect(away.nth(1)).toContainText('Melkbosstrand, Western Cape · 9 holes');
    await expect(away.nth(1)).not.toContainText('Played recently');
    await expect(away.nth(2)).toHaveAccessibleName('Play Milnerton Golf Club');
    await expect(page.getByText('No other courses are mapped yet.')).toHaveCount(0);
    await search.fill('  ATLANTIC ');
    await expect(away).toHaveCount(1);
    await expect(away.first()).toHaveAccessibleName('Play Atlantic Beach Links');
    await search.fill('gauteng');
    await expect(away).toHaveCount(1);
    await expect(away.first()).toHaveAccessibleName('Play Zwartkop Country Club');
    await search.fill(' nowhere ');
    await expect(away).toHaveCount(0);
    await expect(page.getByText('No mapped course matches “nowhere”.')).toBeVisible();
    await search.fill('');
    await page.getByRole('button', { name: 'Play Milnerton Golf Club' }).click();
    await expect(page.getByRole('heading', { name: 'Start a Round' }).first()).toBeVisible();
  });

  test('Course › away course row while a round is in progress shows the “Round in progress” alert (response rewritten)', async ({ page }) => {
    await startRound(page);
    await patch(page, 'golfHome', (j) => {
      j.courses.push({ id: 'away-m', name: 'Milnerton Golf Club', location: 'Milnerton, Western Cape', holeCount: 18, isHome: false, logoUrl: null });
    });
    await openCourse(page);
    await page.getByRole('button', { name: 'Play Milnerton Golf Club' }).click();
    await expect(appAlert(page)).toContainText('Finish or discard your round at Strand Golf Club before starting another.');
  });

  test.skip('native only: Course tab pull to refresh (RefreshControl gesture)', async () => {});
});

// =====================================================================
test.describe('Start a Round', () => {
  async function openSetup(page: Page) {
    await openCourse(page);
    await page.getByRole('button', { name: 'Start a round' }).click();
    await expect(page.getByRole('button', { name: 'Start round' })).toBeVisible();
  }
  const calcNote = (page: Page, text: string) => page.getByText(text);

  test('Setup › shows course, Rating, tees with length/CR/slope, Holes, no-nine hint, Index, Format, Allowance, toggle, calculation and footnote', async ({ page }) => {
    await openSetup(page);
    await expect(page.getByRole('heading', { name: 'Strand Golf Club' })).toBeVisible();
    await expect(page.getByText('Strand, Western Cape · 18 holes')).toBeVisible();
    await expect(page.getByText('Rating', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Men' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Ladies' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Yellow 5\s997 m · CR 72\.0 · 123$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^White 5\s605 m · CR 70\.0 · 120$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Red 4\s977 m · CR 67\.2 · 110$/ })).toBeVisible();
    await expect(page.getByText('18 holes', { exact: true })).toBeVisible();
    await expect(page.getByText('This course’s card has no separate nine-hole ratings yet, so only full rounds can be scored.')).toBeVisible();
    const idx = page.getByRole('textbox', { name: 'Handicap Index' });
    await expect(idx).toHaveValue('12.4');
    await expect(idx).toHaveAttribute('placeholder', '14.2');
    await expect(page.getByText('As it shows on GolfRSA. For a plus handicap start with +, like +1.4. Leave it empty to play off scratch.')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Stableford' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Stroke play' })).toBeVisible();
    await expect(page.getByRole('radio', { name: '95%' })).toBeVisible();
    await expect(page.getByRole('radio', { name: '100%' })).toBeVisible();
    await expect(page.getByText('95% is the World Handicap System default for individual Stableford and stroke play. A committee may use 100% for fields under 30.')).toBeVisible();
    await expect(page.getByText('Putts and fairways', { exact: true })).toBeVisible();
    await expect(page.getByText('Add putts and fairway hits on each hole for putting, fairway and greens in regulation stats in My Golf.')).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Enter putts and fairways' })).toBeVisible();
    // Defaults: middle tee (White), men, profile index; calculation tile.
    await expect(page.getByText('White · Men · CR 70.0 · Slope 120 · Par 72')).toBeVisible();
    await expect(page.getByText('Course handicap (18 holes)')).toBeVisible();
    await expect(page.getByText('Playing handicap (95%)')).toBeVisible();
    await expect(calcNote(page, '12.4 × 120 ÷ 113 + (70.0 − 72) = 11.17 → 11. Playing: 11.17 × 95% = 10.61 → 11.')).toBeVisible();
    await expect(page.getByText('Flagrr never works out your handicap itself; it uses the index you enter here.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start round' })).toBeEnabled();
  });

  test('Setup › loading spinner while the course loads', async ({ page }) => {
    await openCourse(page);
    await delay(page, 'golfCourse', 2500);
    await page.getByRole('button', { name: 'Start a round' }).click();
    await expect(page.getByRole('progressbar')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start round' })).toBeVisible({ timeout: 15_000 });
  });

  test('Setup › load error shows the plain error text (no retry)', async ({ page }) => {
    await openCourse(page);
    await fail(page, 'GET', 'golfCourse', 500);
    await page.getByRole('button', { name: 'Start a round' }).click();
    await expect(page.getByText(SERVER_MESSAGE)).toBeVisible(); // Owner decision 24 Nov 2026 (friendly wording): a 5xx or technical message shows the friendly text.
    await expect(page.getByRole('button', { name: 'Start round' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  });

  test('Setup › choosing a tee recalculates (Yellow: CR 72.0 / 123, course handicap 13)', async ({ page }) => {
    await openSetup(page);
    await page.getByRole('button', { name: /^Yellow/ }).click();
    await expect(page.getByText('Yellow · Men · CR 72.0 · Slope 123 · Par 72')).toBeVisible();
    await expect(calcNote(page, '12.4 × 123 ÷ 113 + (72.0 − 72) = 13.50 → 13. Playing: 13.50 × 95% = 12.82 → 13.')).toBeVisible();
  });

  test('Setup › Ladies ratings keep the tee and change the tee meta and calculation', async ({ page }) => {
    await openSetup(page);
    await page.getByRole('radio', { name: 'Ladies' }).click();
    await expect(page.getByRole('button', { name: /^White 5\s605 m · CR 75\.8 · 136$/ })).toBeVisible();
    await expect(page.getByText('White · Ladies · CR 75.8 · Slope 136 · Par 72')).toBeVisible();
    await expect(calcNote(page, '12.4 × 136 ÷ 113 + (75.8 − 72) = 18.72 → 19. Playing: 18.72 × 95% = 17.79 → 18.')).toBeVisible();
    await page.getByRole('radio', { name: 'Men' }).click();
    await expect(page.getByText('White · Men · CR 70.0 · Slope 120 · Par 72')).toBeVisible();
  });

  test('Setup › 100% allowance recalculates the playing handicap', async ({ page }) => {
    await openSetup(page);
    await page.getByRole('radio', { name: '100%' }).click();
    await expect(page.getByText('Playing handicap (100%)')).toBeVisible();
    await expect(calcNote(page, 'Playing: 11.17 × 100% = 11.17 → 11.')).toBeVisible();
    await page.getByRole('radio', { name: '95%' }).click();
    await expect(page.getByText('Playing handicap (95%)')).toBeVisible();
  });

  test('Setup › Handicap Index validation: invalid shows the error and disables Start; plus, comma and empty are valid', async ({ page }) => {
    await openSetup(page);
    const idx = page.getByRole('textbox', { name: 'Handicap Index' });
    const err = page.getByText('Enter a number from +10.0 to 54.0, like 14.2.');
    const start = page.getByRole('button', { name: 'Start round' });
    for (const bad of ['abc', '54.1', '-2', '+10.1', '12.45', '1.2.3']) {
      await idx.fill(bad);
      await expect(err).toBeVisible();
      await expect(start).toBeDisabled();
    }
    await idx.fill('+1.4');
    await expect(err).toHaveCount(0);
    await expect(start).toBeEnabled();
    await expect(calcNote(page, '+1.4 × 120 ÷ 113 + (70.0 − 72) = −3.49 → +3. Playing: −3.49 × 95% = −3.31 → +3.')).toBeVisible();
    await idx.fill('12,4');
    await expect(err).toHaveCount(0);
    await expect(calcNote(page, '12.4 × 120 ÷ 113 + (70.0 − 72) = 11.17 → 11.')).toBeVisible();
    await idx.fill('54');
    await expect(err).toHaveCount(0);
    await idx.fill('');
    await expect(err).toHaveCount(0);
    await expect(page.getByText('Without a Handicap Index you get no shots, and points are scored against par.')).toBeVisible();
    await expect(page.getByText('Course handicap (18 holes)')).toHaveCount(0);
    await expect(start).toBeEnabled();
  });

  test('Setup › Start round (defaults) saves the profile, starts the round and replaces setup with the hole view', async ({ page }) => {
    await openSetup(page);
    await page.getByRole('textbox', { name: 'Handicap Index' }).fill('15.0');
    await page.getByRole('button', { name: 'Start round' }).click();
    await expect(page.getByLabel('Back. Your round stays in progress')).toBeVisible();
    await expect(page.getByLabel('Your round: tees and handicap')).toContainText('15.0');
    const home = await golfGet(page, 'golfHome');
    expect(home.inProgress).toMatchObject({ teeId: 'white', ratingGender: 'men', format: 'stableford', allowance: 0.95, handicapIndex: 15, trackStats: false });
    expect((await golfGet(page, 'golfProfile')).handicapIndex).toBe(15);
    // Setup was replaced: back lands on the Course tab.
    await page.getByLabel('Back. Your round stays in progress').click();
    await expect(page.getByRole('heading', { name: 'Away courses' })).toBeVisible();
    await expect(page.getByText('Round in progress')).toBeVisible();
  });

  test('Setup › Stroke play, 100% and Putts and fairways are used for the round', async ({ page }) => {
    await openSetup(page);
    await page.getByRole('radio', { name: 'Stroke play' }).click();
    await page.getByRole('radio', { name: '100%' }).click();
    const toggle = page.getByRole('switch', { name: 'Enter putts and fairways' });
    await toggle.click();
    await page.getByRole('button', { name: 'Start round' }).click();
    await expect(page.getByText('Putts', { exact: true })).toBeVisible();
    const home = await golfGet(page, 'golfHome');
    expect(home.inProgress).toMatchObject({ format: 'stroke', allowance: 1, trackStats: true });
    await page.getByLabel('Your round: tees and handicap').click();
    await expect(sheet(page, 'Your round')).toContainText('Stroke play · 100% allowance');
  });

  test('Setup › empty Handicap Index starts a scratch round', async ({ page }) => {
    await openSetup(page);
    await page.getByRole('textbox', { name: 'Handicap Index' }).fill('');
    await page.getByRole('button', { name: 'Start round' }).click();
    await expect(page.getByLabel('Your round: tees and handicap')).toContainText('HCP–');
    expect((await golfGet(page, 'golfProfile')).handicapIndex).toBeNull();
    expect((await golfGet(page, 'golfHome')).inProgress.courseHandicap).toBeNull();
  });

  test('Setup › Start round shows a spinner/disabled button while starting, and a double tap starts one round', async ({ page }) => {
    await openSetup(page);
    await delay(page, 'golfRoundStart', 1500);
    const start = page.getByRole('button', { name: 'Start round' });
    await start.dblclick();
    await expect(start).toBeDisabled();
    await expect(page.getByLabel('Back. Your round stays in progress')).toBeVisible({ timeout: 15_000 });
    expect((await mockState(page)).rounds).toBe(17);
  });

  test('Setup › 409: “You have a round in progress” alert — Cancel stays, Resume round opens that round', async ({ page }) => {
    await openSetup(page);
    await startRound(page, { teeId: 'yellow' }); // a round started elsewhere meanwhile
    await page.getByRole('button', { name: 'Start round' }).click();
    let a = appAlert(page);
    await expect(a).toContainText('You have a round in progress');
    await expect(a).toContainText('Strand Golf Club, Yellow tees. Pick it up where you left off, or discard it to start this one.');
    await a.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: 'Start round' })).toBeEnabled();
    await page.getByRole('button', { name: 'Start round' }).click();
    a = appAlert(page);
    await a.getByRole('button', { name: 'Resume round' }).click();
    await expect(greenCard(page)).toBeVisible(); // Owner decision 24 Nov 2026: GPS is not wanted, the "GPS integration coming soon" chip is gone; the green card shows the map has loaded.
    await expect(page.getByText('344 m · SI 12 · 1 shot')).toBeVisible(); // Yellow hole 1
    await page.getByLabel('Back. Your round stays in progress').click();
    await expect(page.getByRole('heading', { name: 'Away courses' })).toBeVisible(); // setup was replaced
  });

  test('Setup › 409: “Discard it” deletes the old round and starts this one', async ({ page }) => {
    await openSetup(page);
    const old = await startRound(page, { teeId: 'yellow' });
    await page.getByRole('button', { name: 'Start round' }).click();
    await appAlert(page).getByRole('button', { name: 'Discard it' }).click();
    await expect(page.getByText('328 m · SI 12 · no shots')).toBeVisible(); // White hole 1
    const home = await golfGet(page, 'golfHome');
    expect(home.inProgress.id).not.toBe(old.id);
    expect(home.inProgress.teeId).toBe('white');
    expect((await mockState(page)).rounds).toBe(17);
  });

  test('Setup › 409: discard failure shows “Could not discard the round”', async ({ page }) => {
    await openSetup(page);
    await startRound(page, { teeId: 'yellow' });
    await page.getByRole('button', { name: 'Start round' }).click();
    await fail(page, 'POST', 'golfRoundDelete', 500);
    await appAlert(page).getByRole('button', { name: 'Discard it' }).click();
    const a = appAlert(page);
    await expect(a).toContainText('Could not discard the round');
    await expect(a).toContainText(SERVER_MESSAGE); // Owner decision 24 Nov 2026 (friendly wording): a 5xx or technical message shows the friendly text.
  });

  test('Setup › 409 when the in-progress round cannot be read: fallback “Could not start the round” alert', async ({ page }) => {
    await openSetup(page);
    await startRound(page);
    await fail(page, 'GET', 'golfHome', 500);
    await page.getByRole('button', { name: 'Start round' }).click();
    const a = appAlert(page);
    await expect(a).toContainText('Could not start the round');
    await expect(a).toContainText('You already have a round in progress. Open the Course tab to finish or discard it.');
    await a.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByRole('button', { name: 'Start round' })).toBeVisible();
  });

  test('Setup › other start failure: “Could not start the round” with the API message; profile was still saved', async ({ page }) => {
    await openSetup(page);
    await fail(page, 'POST', 'golfRoundStart', 500);
    await page.getByRole('textbox', { name: 'Handicap Index' }).fill('18.3');
    await page.getByRole('button', { name: 'Start round' }).click();
    const a = appAlert(page);
    await expect(a).toContainText('Could not start the round');
    await expect(a).toContainText(SERVER_MESSAGE); // Owner decision 24 Nov 2026 (friendly wording): a 5xx or technical message shows the friendly text.
    expect((await golfGet(page, 'golfProfile')).handicapIndex).toBe(18.3);
    expect((await golfGet(page, 'golfHome')).inProgress).toBeNull();
  });

  test('Setup › Back returns to the Course tab', async ({ page }) => {
    await openSetup(page);
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { name: 'Away courses' })).toBeVisible();
  });

  test('Setup › nine-hole ratings: Holes segment, Front 9 “÷ 2” calculation, fallback to full on a tee without nines (response rewritten)', async ({ page }) => {
    // Mock's Strand card has no nine-hole ratings: add them to the White men's tee in golfCourse.
    await patch(page, 'golfCourse', (j) => {
      const white = j.map.tees.find((t: any) => t.id === 'white');
      white.ratings.men.front9 = { cr: 35, slope: 118 };
      white.ratings.men.back9 = { cr: 35.4, slope: 122 };
    });
    await openSetup(page);
    await expect(page.getByRole('radio', { name: '18 holes' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Front 9' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Back 9' })).toBeVisible();
    await expect(page.getByText('This course’s card has no separate nine-hole ratings yet', { exact: false })).toHaveCount(0);
    await page.getByRole('radio', { name: 'Front 9' }).click();
    await expect(page.getByText('Course handicap (9 holes)')).toBeVisible();
    await expect(page.getByText('White · Men · CR 35.0 · Slope 118 · Par 36')).toBeVisible();
    await expect(calcNote(page, '12.4 ÷ 2 = 6.2, × 118 ÷ 113 + (35.0 − 36) = 5.47 → 5. Playing: 5.47 × 95% = 5.20 → 5.')).toBeVisible();
    // Yellow has no nine ratings: layout falls back to full.
    await page.getByRole('button', { name: /^Yellow/ }).click();
    await expect(page.getByRole('radio', { name: 'Front 9' })).toHaveCount(0);
    await expect(page.getByText('Course handicap (18 holes)')).toBeVisible();
    await expect(page.getByText('This course’s card has no separate nine-hole ratings yet, so only full rounds can be scored.')).toBeVisible();
  });

  test('Setup › a course rated for one gender has no Rating segment (response rewritten)', async ({ page }) => {
    await patch(page, 'golfCourse', (j) => { for (const t of j.map.tees) delete t.ratings.ladies; });
    await openSetup(page);
    await expect(page.getByRole('radio', { name: 'Ladies' })).toHaveCount(0);
    await expect(page.getByRole('radio', { name: 'Men' })).toHaveCount(0);
    await expect(page.getByText('White · Men · CR 70.0 · Slope 120 · Par 72')).toBeVisible();
  });

  test.fixme('Setup › start a nine-hole round (Front 9 / Back 9) — mock map has no nine-hole ratings and golfRoundStart cannot build a nine (mock change: add men front9/back9 ratings to a tee in the mock course map)', async () => {});
});

// =====================================================================
test.describe('Hole view', () => {
  test('Hole › header, hole pills, hole badge, GPS chip, green card, shot card and empty score bar', async ({ page }) => {
    const r = await startRound(page);
    await saveEntries(page, r, parEntries(r, 2));
    await openRound(page);
    await expect(page.getByText('Strand Golf Club', { exact: true })).toBeVisible();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Back. Your round stays in progress')).toBeVisible();
    await expect(page.getByLabel('Your round: tees and handicap')).toContainText('HCP12.4');
    await expect(page.getByLabel('My bag')).toContainText('Bag');
    for (let n = 1; n <= 18; n++) await expect(page.getByLabel(new RegExp(`^Hole ${n}, par [345](, scored)?$`))).toHaveCount(1);
    await expect(page.getByLabel('Hole 1, par 4, scored')).toBeVisible();
    await expect(page.getByLabel('Hole 2, par 5, scored')).toBeVisible();
    // Opens on the first hole without a score.
    await expect(page.getByText('145 m · SI 14 · no shots')).toBeVisible(); // hole 3
    await expect(page.getByText('GPS integration coming soon')).toHaveCount(0); // Owner decision 24 Nov 2026: GPS is not wanted, the "GPS integration coming soon" chip is gone; the green card shows the map has loaded.
    await expect(page.getByLabel(/^Green: front \d+, middle \d+, back \d+ metres$/)).toBeVisible();
    await expect(page.getByLabel('Zoom in')).toBeVisible();
    await expect(page.getByLabel('Zoom out')).toBeVisible();
    await expect(page.getByLabel('Show the whole hole')).toBeVisible();
    await expect(page.getByLabel('Map layers')).toBeVisible();
    const shot = shotCard(page);
    await expect(shot).toContainText('Suggested shot');
    await expect(shot).toContainText('From the tee');
    await expect(shot).toContainText('Leaves');
    await expect(shot).toContainText('Next');
    await expect(shot).toContainText('Usual miss');
    await expect(holeMap(page)).toContainText('Drag me');
    await expect(page.getByText('Hole 3 · no shots')).toBeVisible();
    await expect(page.getByText('Tap 3 for par')).toBeVisible();
    await expect(page.getByLabel('Enter par, 3')).toHaveText('3');
    // Par on holes 1 and 2 off White (playing handicap 10): 2 + 3 Stableford points (hole 2, SI 6, gets a stroke).
    await expect(cardBtn(page)).toContainText('5 pts');
    await expect(cardBtn(page)).toContainText('thru 2');
  });

  test('Hole › loading spinner while the round loads', async ({ page }) => {
    await startRound(page);
    await openCourse(page);
    await delay(page, 'golfRound', 2500);
    await page.getByRole('button', { name: 'Resume round' }).click();
    await expect(page.getByRole('progressbar')).toBeVisible();
    await expect(status(page)).toBeVisible({ timeout: 15_000 });
  });

  test('Hole › load error (also with a local copy, i.e. offline): message and Back', async ({ page }) => {
    const r = await startRound(page);
    await page.addInitScript(([key, val]) => { try { localStorage.setItem(key, val); } catch { /* ignore */ } }, [`flagrr_round_entries_${r.id}`, JSON.stringify(parEntries(r, 1))] as const);
    await openCourse(page);
    await fail(page, 'GET', 'golfRound', 503);
    await page.getByRole('button', { name: 'Resume round' }).click();
    await expect(page.getByText(SERVER_MESSAGE)).toBeVisible(); // Owner decision 24 Nov 2026 (friendly wording): a 5xx or technical message shows the friendly text.
    await page.getByText('Back', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Away courses' })).toBeVisible();
  });

  test('Hole › no map: message, no Bag or floating cards, scoring still works', async ({ page }) => {
    await startRound(page);
    await openCourse(page);
    await fail(page, 'GET', 'golfCourse', 500);
    await page.getByRole('button', { name: 'Resume round' }).click();
    await expect(page.getByText('The map for this course isn’t available any more, but you can still keep score below.')).toBeVisible();
    await expect(page.getByLabel('My bag')).toHaveCount(0);
    await expect(page.getByText('GPS integration coming soon')).toHaveCount(0);
    await expect(page.getByLabel('Map layers')).toHaveCount(0);
    await page.getByLabel('Enter par, 4').click();
    await expect(page.getByLabel('Score 4')).toBeVisible();
    await expect.poll(async () => (await golfGet(page, 'golfHome')).inProgress.entries[0].s).toBe(4);
  });

  test('Hole › score entry: tap empty enters par, −/+ step, tap numeric does nothing, long-press clears; pill gets “scored”', async ({ page }) => {
    const r = await startRound(page);
    await openRound(page);
    await page.getByLabel('Enter par, 4').click();
    await expect(page.getByLabel('Score 4')).toBeVisible();
    await expect(page.getByText('Par', { exact: true })).toBeVisible();
    await expect(page.getByText('2 pts', { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel('Hole 1, par 4, scored')).toBeVisible();
    await expect(cardBtn(page)).toContainText('2 pts');
    await expect(cardBtn(page)).toContainText('thru 1');
    await page.getByLabel('Score 4').click(); // numeric: nothing
    await expect(page.getByLabel('Score 4')).toBeVisible();
    await page.getByLabel('One shot more').click();
    await expect(page.getByLabel('Score 5')).toBeVisible();
    await expect(page.getByText('Bogey', { exact: true })).toBeVisible();
    await expect(page.getByText('1 pt', { exact: true }).first()).toBeVisible();
    await expect.poll(async () => (await getRound(page, r.id)).entries[0].s).toBe(5);
    await longPress(page, page.getByLabel('Score 5'));
    await expect(page.getByLabel('Enter par, 4')).toBeVisible();
    await expect(page.getByText('Tap 4 for par')).toBeVisible();
    await expect(page.getByLabel('Hole 1, par 4')).toBeVisible();
    await expect(cardBtn(page)).toContainText('–');
    await expect.poll(async () => (await getRound(page, r.id)).entries[0].s).toBeNull();
    // − / + on an empty hole: par − 1 / par + 1.
    await page.getByLabel('One shot fewer').click();
    await expect(page.getByLabel('Score 3')).toBeVisible();
    await expect(page.getByText('Birdie', { exact: true })).toBeVisible();
    await expect(page.getByText('3 pts', { exact: true }).first()).toBeVisible();
    await longPress(page, page.getByLabel('Score 3'));
    await page.getByLabel('One shot more').click();
    await expect(page.getByLabel('Score 5')).toBeVisible();
  });

  test('Hole › score clamps to 1–20 (hole in one at 1)', async ({ page }) => {
    await startRound(page);
    await openRound(page);
    await page.getByLabel('One shot fewer').click(); // 3
    await page.getByLabel('One shot fewer').click(); // 2
    await page.getByLabel('One shot fewer').click(); // 1
    await page.getByLabel('One shot fewer').click(); // stays 1
    await expect(page.getByLabel('Score 1')).toBeVisible();
    await expect(page.getByText('Hole in one', { exact: true })).toBeVisible();
    for (let i = 0; i < 21; i++) await page.getByLabel('One shot more').click();
    await expect(page.getByLabel('Score 20')).toBeVisible();
  });

  test('Hole › shots received: badge dots and “1 shot”, “Par · net birdie”', async ({ page }) => {
    await startRound(page);
    await openRound(page);
    await page.getByLabel('Hole 2, par 5').click();
    await expect(page.getByText('408 m · SI 6 · 1 shot')).toBeVisible();
    await expect(page.getByText('Par 5 ●')).toBeVisible();
    await expect(page.getByText('Hole 2 · 1 shot')).toBeVisible();
    await page.getByLabel('Enter par, 5').click();
    await expect(page.getByText('Par · net birdie')).toBeVisible();
    await expect(page.getByText('3 pts', { exact: true }).first()).toBeVisible();
  });

  test('Hole › pick up: offered at 0 points, records P, tap clears, −/+ from a pick-up use net double bogey', async ({ page }) => {
    const r = await startRound(page);
    await openRound(page);
    await page.getByLabel('One shot more').click(); // 5
    await expect(page.getByText('1 pt', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pick up' })).toHaveCount(0);
    await page.getByLabel('One shot more').click(); // 6 → 0 pts
    await expect(page.getByText('0 pts', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Pick up' }).click();
    await expect(page.getByLabel('Picked up. Tap to clear')).toHaveText('P');
    await expect(page.getByText('Picked up', { exact: true })).toBeVisible();
    await expect(page.getByText('0 pts', { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel('Hole 1, par 4, scored')).toBeVisible();
    await expect.poll(async () => (await getRound(page, r.id)).entries[0].s).toBe('P');
    // Scorecard: gross becomes No return / NR.
    await cardBtn(page).click();
    const card = sheet(page, 'Scorecard');
    await expect(card.getByText('No return').first()).toBeVisible();
    await expect(card.getByText('NR', { exact: true }).first()).toBeVisible();
    await card.getByRole('button', { name: 'Close' }).last().click();
    await expect(card).toHaveCount(0);
    // Tap a pick-up clears the hole.
    await page.getByLabel('Picked up. Tap to clear').click();
    await expect(page.getByLabel('Enter par, 4')).toBeVisible();
    // + from a pick-up: par + strokes received + 2, + 1 = 7; − gives 5.
    await page.getByLabel('One shot more').click();
    await page.getByLabel('One shot more').click();
    await page.getByRole('button', { name: 'Pick up' }).click();
    await page.getByLabel('One shot more').click();
    await expect(page.getByLabel('Score 7')).toBeVisible();
    await page.getByLabel('One shot more').click(); // 8: still 0 pts
    await page.getByRole('button', { name: 'Pick up' }).click();
    await page.getByLabel('One shot fewer').click();
    await expect(page.getByLabel('Score 5')).toBeVisible();
  });

  test('Hole › stroke play: “Net {n}”, to-par total, no Pick up even at a high score', async ({ page }) => {
    await startRound(page, { format: 'stroke' });
    await openRound(page);
    await page.getByLabel('Enter par, 4').click();
    await expect(page.getByText('Net 4', { exact: true })).toBeVisible();
    await expect(cardBtn(page)).toContainText('E');
    await page.getByLabel('Hole 2, par 5').click();
    await page.getByLabel('Enter par, 5').click();
    await expect(page.getByText('Par · net birdie')).toBeVisible();
    await expect(page.getByText('Net 4', { exact: true })).toBeVisible();
    await expect(cardBtn(page)).toContainText('−1');
    for (let i = 0; i < 5; i++) await page.getByLabel('One shot more').click();
    await expect(page.getByLabel('Score 10')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pick up' })).toHaveCount(0);
    await cardBtn(page).click();
    const card = sheet(page, 'Scorecard');
    await expect(card.getByText('Net', { exact: true }).first()).toBeVisible();
    await expect(card.getByText('Pts', { exact: true })).toHaveCount(0);
  });

  test('Hole › scratch round: “Hole {n} score”, no shots text, HCP “–”, scratch subtitle and “None (scratch)”', async ({ page }) => {
    await startRound(page, { profile: { handicapIndex: null } });
    await openRound(page);
    await expect(page.getByLabel('Your round: tees and handicap')).toContainText('HCP–');
    await expect(page.getByText('Hole 1 score')).toBeVisible();
    await expect(page.getByText('328 m · SI 12', { exact: true })).toBeVisible();
    await cardBtn(page).click();
    await expect(sheet(page, 'Scorecard')).toContainText('White tees (men) · No handicap: scratch');
    await sheet(page, 'Scorecard').getByRole('button', { name: 'Close' }).last().click();
    await page.getByLabel('Your round: tees and handicap').click();
    const yr = sheet(page, 'Your round');
    await expect(yr).toContainText('None (scratch)');
    await expect(yr.getByText('Course handicap')).toHaveCount(0);
  });

  test('Hole › plus handicap: “gives back 1” and “+1” in the Shots column', async ({ page }) => {
    await startRound(page, { profile: { handicapIndex: -1.4 } });
    await openRound(page);
    await expect(page.getByLabel('Your round: tees and handicap')).toContainText('+1.4');
    await page.getByLabel('Hole 4, par 4').click();
    await expect(page.getByText('214 m · SI 18 · gives back 1')).toBeVisible();
    await expect(page.getByText('Hole 4 · gives back 1')).toBeVisible();
    await cardBtn(page).click();
    const card = sheet(page, 'Scorecard');
    await expect(card).toContainText('Playing handicap +3 · 95% of course handicap +3');
    await expect(card.getByText('+1', { exact: true }).first()).toBeVisible();
  });

  test('Hole › Putts and fairways bar: disabled before a score, putts stepper rules, fairway toggles, clears with the score', async ({ page }) => {
    const r = await startRound(page, { profile: { trackStats: true } });
    await openRound(page);
    await expect(page.getByLabel('Enter two putts')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByLabel('One putt more')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByLabel('One putt fewer')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByLabel('Fairway hit')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByLabel('Missed left')).toHaveText('← L');
    await expect(page.getByLabel('Missed right')).toHaveText('R →');
    await page.getByLabel('Enter par, 4').click();
    await page.getByLabel('Enter two putts').click();
    await expect(page.getByLabel('2 putts. Tap to clear')).toHaveText('2');
    await page.getByLabel('One putt more').click();
    await expect(page.getByLabel('3 putts. Tap to clear')).toBeVisible();
    await expect(page.getByLabel('One putt more')).toHaveAttribute('aria-disabled', 'true'); // max = score − 1
    await page.getByLabel('One putt fewer').click();
    await expect(page.getByLabel('2 putts. Tap to clear')).toBeVisible();
    await page.getByLabel('2 putts. Tap to clear').click();
    await expect(page.getByLabel('Enter two putts')).toHaveText('–');
    await expect(page.getByLabel('One putt fewer')).toHaveAttribute('aria-disabled', 'true');
    await page.getByLabel('One putt more').click();
    await expect(page.getByLabel('2 putts. Tap to clear')).toBeVisible();
    await page.getByLabel('One putt more').click(); // 3
    // Lowering the score to ≤ putts pulls putts to score − 1.
    await page.getByLabel('One shot fewer').click();
    await expect(page.getByLabel('Score 3')).toBeVisible();
    await expect(page.getByLabel('2 putts. Tap to clear')).toBeVisible();
    // Fairway toggles.
    // (Selected state is not exposed on web; checked through what is saved.)
    const fw = async () => (await getRound(page, r.id)).entries[0].fw;
    await page.getByLabel('Fairway hit').click();
    await expect.poll(fw).toBe('hit');
    await page.getByLabel('Fairway hit').click(); // tapping the selected one clears it
    await expect.poll(fw).toBeNull();
    await page.getByLabel('Missed left').click();
    await expect.poll(async () => (await getRound(page, r.id)).entries[0]).toEqual({ s: 3, putts: 2, fw: 'left' });
    await page.getByLabel('Missed right').click();
    await expect.poll(fw).toBe('right');
    // Clearing the score clears putts and fairway.
    await longPress(page, page.getByLabel('Score 3'));
    await expect(page.getByLabel('Enter two putts')).toBeVisible();
    await expect.poll(async () => (await getRound(page, r.id)).entries[0]).toEqual({ s: null, putts: null, fw: null });
    // Par 3: no fairway; putts on a hole in one go to 0.
    await page.getByLabel('Hole 3, par 3').click();
    await expect(page.getByText('Par 3: no fairway')).toBeVisible();
    await expect(page.getByLabel('Fairway hit')).toHaveCount(0);
    await page.getByLabel('One shot fewer').click();
    await page.getByLabel('One shot fewer').click(); // 1
    await page.getByLabel('Enter two putts').click();
    await expect(page.getByLabel('0 putts. Tap to clear')).toBeVisible();
    await cardBtn(page).click();
    await expect(sheet(page, 'Scorecard').getByText('Putts', { exact: true }).first()).toBeVisible(); // Owner decision 24 Nov 2026 (horizontal scorecard): each nine and the Total row label their own rows, so the label appears more than once.
  });

  test('Hole › no Putts/Fairway bar when the round does not track stats', async ({ page }) => {
    await startRound(page);
    await openRound(page);
    await expect(page.getByLabel('Enter two putts')).toHaveCount(0);
    await expect(page.getByText('Putts', { exact: true })).toHaveCount(0);
  });

  test('Hole › hole navigation: pills and scorecard hole cells', async ({ page }) => {
    await startRound(page);
    await openRound(page);
    await page.getByLabel('Hole 5, par 5').click();
    await expect(page.getByText('429 m · SI 8 · 1 shot')).toBeVisible();
    await cardBtn(page).click();
    await sheet(page, 'Scorecard').getByLabel('Go to hole 7').click();
    await expect(sheet(page, 'Scorecard')).toHaveCount(0);
    await expect(page.getByText('302 m · SI 4 · 1 shot')).toBeVisible();
  });

  test('Hole › save status “Saving…” then “Saved”', async ({ page }) => {
    const r = await startRound(page);
    await openRound(page);
    await delay(page, 'golfRoundSave', 2000);
    await page.getByLabel('Enter par, 4').click();
    await expect(page.getByText('Saving…')).toBeVisible();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 });
    expect((await getRound(page, r.id)).entries[0].s).toBe(4);
  });

  test('Hole › offline save: “Not saved yet · will retry”, keeps retrying after leaving, then reaches the server', async ({ page }) => {
    test.setTimeout(60_000);
    const r = await startRound(page);
    await openRound(page);
    await fail(page, 'POST', 'golfRoundSave', 503);
    await page.getByLabel('Enter par, 4').click();
    await expect(page.getByText('Not saved yet · will retry')).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), `flagrr_round_entries_${r.id}`)).toContain('"s":4');
    await page.getByLabel('Back. Your round stays in progress').click(); // leaving flushes (fails again) and keeps retrying
    await expect(page.getByRole('heading', { name: 'Away courses' })).toBeVisible();
    expect((await getRound(page, r.id)).entries[0].s).toBeNull();
    await unfail(page, 'POST', 'golfRoundSave');
    await expect.poll(async () => (await getRound(page, r.id)).entries[0].s, { timeout: 25_000, intervals: [1000] }).toBe(4);
  });

  test('Hole › save rejected with 400: “Could not save that score” alert, status back to “Saved”, local copy kept', async ({ page }) => {
    const r = await startRound(page);
    await openRound(page);
    await fail(page, 'POST', 'golfRoundSave', 400);
    await page.getByLabel('Enter par, 4').click();
    const a = appAlert(page);
    await expect(a).toContainText('Could not save that score');
    await expect(a).toContainText(SERVER_MESSAGE); // Owner decision 24 Nov 2026 (friendly wording): a 5xx or technical message shows the friendly text.
    await a.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), `flagrr_round_entries_${r.id}`)).toContain('"s":4');
  });

  test('Hole › leaving with a save pending sends it at once', async ({ page }) => {
    const r = await startRound(page);
    await openRound(page);
    await page.getByLabel('Enter par, 4').click();
    await page.getByLabel('Back. Your round stays in progress').click();
    await expect.poll(async () => (await getRound(page, r.id)).entries[0].s, { timeout: 3000 }).toBe(4);
  });

  test('Hole › reopening: a local copy wins over the server and is saved', async ({ page }) => {
    const r = await startRound(page);
    const local = parEntries(r, 0);
    local[0] = { s: 6, putts: null, fw: null };
    await page.addInitScript(([key, val]) => { try { localStorage.setItem(key, val); } catch { /* ignore */ } }, [`flagrr_round_entries_${r.id}`, JSON.stringify(local)] as const);
    await openRound(page);
    await expect(page.getByLabel('Hole 1, par 4, scored')).toBeVisible();
    await expect(page.getByText('408 m · SI 6 · 1 shot')).toBeVisible(); // opens on hole 2
    await expect.poll(async () => (await getRound(page, r.id)).entries[0].s).toBe(6);
  });

  test('Hole › Scorecard sheet: subtitle, table, Out/In/Total, key, summary, WHS note, Discard and disabled Finish with “holes to go”; closes by X and backdrop', async ({ page }) => {
    const r = await startRound(page);
    await saveEntries(page, r, parEntries(r, 2));
    await openRound(page);
    await cardBtn(page).click();
    const card = sheet(page, 'Scorecard');
    await expect(card).toContainText('White tees (men) · Playing handicap 11 · 95% of course handicap 11');
    for (const h of ['Hole', 'Par', 'SI', 'Shots', 'Score', 'Pts']) await expect(card.getByText(h, { exact: true }).first()).toBeVisible();
    await expect(card.getByText('Putts', { exact: true })).toHaveCount(0);
    for (const s of ['Out', 'In', 'Total']) await expect(card.getByText(s, { exact: true })).toBeVisible();
    await expect(card.getByText('m', { exact: true }).first()).toBeVisible(); // Owner decision 24 Nov 2026 (horizontal scorecard): lengths sit in an "m" row, without the unit on each hole.
    await expect(card.getByText('328', { exact: true })).toBeVisible();
    for (const k of ['Birdie or better', 'Bogey or worse', 'Shot received']) await expect(card.getByText(k, { exact: true })).toBeVisible();
    await expect(card.getByText('Stableford', { exact: true })).toBeVisible();
    await expect(card.getByText('5 pts thru 2')).toBeVisible();
    await expect(card.getByText('Gross', { exact: true })).toBeVisible();
    await expect(card.getByText('9 (E)')).toBeVisible();
    await expect(card.getByText('8 (−1)')).toBeVisible(); // net
    await expect(card.getByText('Handicap score', { exact: true })).toBeVisible();
    await expect(card.getByText('Handicap score is your adjusted gross: each hole is capped at net double bogey, the way the World Handicap System counts a round. A pick-up counts as net double bogey.')).toBeVisible();
    await expect(card.getByText('Discard round')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Finish round' })).toBeDisabled();
    await expect(card.getByText('16 holes to go')).toBeVisible();
    await card.getByRole('button', { name: 'Close' }).last().click(); // the X
    await expect(card).toHaveCount(0);
    await cardBtn(page).click();
    await expect(card).toBeVisible();
    await page.mouse.click(195, 20); // backdrop
    await expect(card).toHaveCount(0);
  });

  test('Hole › every hole in: hint, lime “Finish” card button, Finish round → “Round saved” → See My Golf', async ({ page }) => {
    const r = await startRound(page);
    await saveEntries(page, r, parEntries(r, 17));
    await openRound(page);
    await expect(page.getByText('473 m · SI 5 · 1 shot')).toBeVisible(); // opens on hole 18
    await page.getByLabel('Enter par, 5').click();
    await expect(page.getByText('Every hole is in · open the card to finish')).toBeVisible();
    await expect(cardBtn(page)).toContainText('Finish');
    await cardBtn(page).click();
    const card = sheet(page, 'Scorecard');
    await expect(card.getByText(/holes to go/)).toHaveCount(0);
    await card.getByRole('button', { name: 'Finish round' }).click();
    const a = appAlert(page);
    await expect(a).toContainText('Round saved');
    await expect(a).toContainText('Strand Golf Club: 47 Stableford points, 72 gross. Your stats are in My Golf.');
    const saved = await getRound(page, r.id);
    expect(saved.status).toBe('completed');
    expect(await page.evaluate((k) => localStorage.getItem(k), `flagrr_round_entries_${r.id}`)).toBeNull();
    await a.getByRole('button', { name: 'See My Golf' }).click();
    await expect(page.getByRole('heading', { name: 'My Golf' })).toBeVisible();
  });

  test('Hole › finish alert “Close” goes back; the round is no longer in progress', async ({ page }) => {
    const r = await startRound(page);
    await saveEntries(page, r, parEntries(r, 18));
    await openRound(page);
    await cardBtn(page).click();
    await sheet(page, 'Scorecard').getByRole('button', { name: 'Finish round' }).click();
    // Target the alert by its text: the Scorecard sheet underneath also has Close buttons.
    const a = page.getByRole('alertdialog').or(page.locator('[aria-modal="true"]')).filter({ hasText: 'Round saved' }).last();
    await expect(a).toBeVisible();
    await a.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Away courses' })).toBeVisible();
    await expect(page.getByText('Round in progress')).toHaveCount(0);
  });

  test('Hole › finish failure: “Could not finish the round”', async ({ page }) => {
    const r = await startRound(page);
    await saveEntries(page, r, parEntries(r, 18));
    await openRound(page);
    await fail(page, 'POST', 'golfRoundFinish', 500);
    await cardBtn(page).click();
    await sheet(page, 'Scorecard').getByRole('button', { name: 'Finish round' }).click();
    const a = appAlert(page);
    await expect(a).toContainText('Could not finish the round');
    await expect(a).toContainText(SERVER_MESSAGE); // Owner decision 24 Nov 2026 (friendly wording): a 5xx or technical message shows the friendly text.
    expect((await getRound(page, r.id)).status).toBe('in_progress');
  });

  test('Hole › Discard round from the Scorecard: “Keep playing” stays, “Discard round” deletes and goes back', async ({ page }) => {
    await startRound(page);
    await openRound(page);
    await cardBtn(page).click();
    await sheet(page, 'Scorecard').getByText('Discard round').click();
    let a = appAlert(page);
    await expect(a).toContainText('Discard this round?');
    await expect(a).toContainText('All the scores in this round will be deleted.');
    await a.getByRole('button', { name: 'Keep playing' }).click();
    await expect(sheet(page, 'Scorecard')).toBeVisible();
    await sheet(page, 'Scorecard').getByText('Discard round').click();
    a = appAlert(page);
    await a.getByRole('button', { name: 'Discard round' }).click();
    await expect(page.getByRole('heading', { name: 'Away courses' })).toBeVisible();
    await expect(page.getByText('Round in progress')).toHaveCount(0);
    expect((await mockState(page)).rounds).toBe(16);
  });

  test('Hole › Discard round failure: “Could not discard the round”', async ({ page }) => {
    await startRound(page);
    await openRound(page);
    await fail(page, 'POST', 'golfRoundDelete', 500);
    await cardBtn(page).click();
    await sheet(page, 'Scorecard').getByText('Discard round').click();
    await appAlert(page).getByRole('button', { name: 'Discard round' }).click();
    const a = appAlert(page);
    await expect(a).toContainText('Could not discard the round');
    await expect(a).toContainText(SERVER_MESSAGE); // Owner decision 24 Nov 2026 (friendly wording): a 5xx or technical message shows the friendly text.
  });

  test('Hole › Your round sheet: rows, note and Done', async ({ page }) => {
    await startRound(page);
    await openRound(page);
    await page.getByLabel('Your round: tees and handicap').click();
    const yr = sheet(page, 'Your round');
    for (const [k, v] of [
      ['Course', 'Strand Golf Club'], ['Tees', 'White · Men · CR 70.0 · Slope 120 · Par 72'], ['Holes', '18 (1–18)'],
      ['Format', 'Stableford · 95% allowance'], ['Handicap Index', '12.4'], ['Course handicap', '11'], ['Playing handicap', '11'],
    ]) {
      await expect(yr).toContainText(`${k}${v}`);
    }
    await expect(yr.getByText('These were fixed when the round started, so your shots and points can’t change mid-round. Change your Handicap Index or format before your next round.')).toBeVisible();
    await yr.getByText('Done', { exact: true }).click();
    await expect(yr).toHaveCount(0);
  });

  test('Hole › My bag sheet: sample clubs, digits-only 0–350 fields, blank = 0, live suggestion, save on Done, Reset, save on X', async ({ page }) => {
    await startRound(page);
    await openRound(page);
    await expect(shotCard(page)).toContainText('Driver');
    await page.getByLabel('My bag').click();
    const bag = sheet(page, 'My bag');
    await expect(bag).toContainText('How far you carry each club, in metres. The suggested shot uses these.');
    const sample: Array<[string, number]> = [['Driver', 230], ['3 Wood', 210], ['5 Hybrid', 192], ['5 Iron', 178], ['6 Iron', 167], ['7 Iron', 156], ['8 Iron', 145], ['9 Iron', 133], ['PW', 120], ['GW', 106], ['SW', 92], ['LW', 75]];
    for (const [club, carry] of sample) await expect(bag.getByLabel(`${club} carry in metres`)).toHaveValue(String(carry));
    const driver = bag.getByLabel('Driver carry in metres');
    await driver.fill('9x9');
    await expect(driver).toHaveValue('99');
    await driver.fill('999');
    await expect(driver).toHaveValue('350');
    await driver.fill('');
    await expect(driver).toHaveValue('');
    // Driver at 0 is left out of suggestions (live).
    await expect(shotCard(page)).not.toContainText('Driver');
    await driver.fill('245');
    await bag.getByText('Done', { exact: true }).click();
    await expect(bag).toHaveCount(0);
    await expect.poll(async () => (await golfGet(page, 'golfProfile')).bag?.[0]).toEqual({ name: 'Driver', carry: 245 });
    await page.getByLabel('My bag').click();
    await expect(bag.getByLabel('Driver carry in metres')).toHaveValue('245');
    await bag.getByText('Reset to sample distances').click();
    await expect(bag.getByLabel('Driver carry in metres')).toHaveValue('230');
    await bag.getByRole('button', { name: 'Close' }).last().click();
    await expect(bag).toHaveCount(0);
    await expect.poll(async () => (await golfGet(page, 'golfProfile')).bag?.[0]).toEqual({ name: 'Driver', carry: 230 });
  });

  test('Hole › My bag save failure is silent', async ({ page }) => {
    await startRound(page);
    await openRound(page);
    await fail(page, 'POST', 'golfProfile', 500);
    await page.getByLabel('My bag').click();
    const bag = sheet(page, 'My bag');
    await bag.getByLabel('Driver carry in metres').fill('240');
    await bag.getByText('Done', { exact: true }).click();
    await expect(bag).toHaveCount(0);
    await page.waitForTimeout(800);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText('Couldn’t save that')).toHaveCount(0);
  });

  test('Hole › layers popover: two toggles hide arcs and hazard pills; closes on Map layers, hole change and map touch; resets on reopen', async ({ page }) => {
    await startRound(page);
    await openRound(page);
    const layers = page.getByLabel('Map layers');
    const arcLabels = holeMap(page).locator('text', { hasText: /^150$/ });
    const hazardPills = holeMap(page).locator('text', { hasText: /^\d+ \/ \d+$/ });
    await expect(arcLabels.first()).toBeAttached();
    await expect(hazardPills.first()).toBeAttached();
    await layers.click();
    await expect(page.getByText('Every 50 m from your ball')).toBeVisible();
    await expect(page.getByText('Reach / carry, in metres')).toBeVisible();
    const arcs = page.getByRole('switch', { name: 'Distance arcs' });
    const hazards = page.getByRole('switch', { name: 'Hazard distances' });
    await arcs.click();
    await expect(arcLabels).toHaveCount(0);
    await expect(hazardPills.first()).toBeAttached();
    await hazards.click();
    await expect(hazardPills).toHaveCount(0);
    await layers.click();
    await expect(page.getByText('Every 50 m from your ball')).toHaveCount(0);
    await layers.click();
    await page.getByLabel('Hole 2, par 5').click();
    await expect(page.getByText('Every 50 m from your ball')).toHaveCount(0);
    await layers.click();
    const box = (await holeMap(page).boundingBox())!;
    // Owner rule 1 (boards G-D-Hole*): the map now fills the screen and the layers card sits over its middle,
    // so the map is touched to the left, between the header card and the layers card.
    await page.mouse.click(box.x + box.width * 0.08, box.y + box.height * 0.3);
    await expect(page.getByText('Every 50 m from your ball')).toHaveCount(0);
    // Not saved: reopening the hole view turns both back on.
    await page.getByLabel('Back. Your round stays in progress').click();
    await page.getByRole('button', { name: 'Resume round' }).click();
    await expect(greenCard(page)).toBeVisible(); // Owner decision 24 Nov 2026: GPS is not wanted, the "GPS integration coming soon" chip is gone; the green card shows the map has loaded.
    await expect(arcLabels.first()).toBeAttached();
    await expect(hazardPills.first()).toBeAttached();
  });

  test('Hole › Zoom in, Zoom out, Show the whole hole and mouse-wheel zoom change the map view', async ({ page }) => {
    await startRound(page);
    await openRound(page);
    const world = holeMap(page).locator('svg > g').first();
    await page.waitForTimeout(300);
    const fitted = await world.getAttribute('transform');
    await page.getByLabel('Zoom in').click();
    await expect.poll(() => world.getAttribute('transform')).not.toBe(fitted);
    const zoomed = await world.getAttribute('transform');
    await page.getByLabel('Zoom out').click();
    await expect.poll(() => world.getAttribute('transform')).not.toBe(zoomed);
    await page.getByLabel('Zoom in').click();
    await page.getByLabel('Show the whole hole').click();
    await expect.poll(() => world.getAttribute('transform')).toBe(fitted);
    const box = (await holeMap(page).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -300);
    await expect.poll(() => world.getAttribute('transform')).not.toBe(fitted);
  });

  test('Hole › shot card collapse and expand', async ({ page }) => {
    await startRound(page);
    await openRound(page);
    await page.getByLabel('Hide shot details').click();
    await expect(shotCard(page)).not.toContainText('Usual miss');
    await expect(shotCard(page)).toContainText('Suggested shot');
    await expect(shotCard(page)).toContainText('Driver');
    await page.getByLabel('Show shot details').click();
    await expect(shotCard(page)).toContainText('Usual miss');
  });

  test('Hole › tap to aim sets “Your target”, “Show suggested shot” goes back', async ({ page }) => {
    await startRound(page);
    await openRound(page);
    const box = (await holeMap(page).boundingBox())!;
    const p = { x: box.x + box.width * 0.42, y: box.y + box.height * 0.5 };
    await page.mouse.click(p.x, p.y);
    const shot = shotCard(page);
    await expect(shot).toContainText(/Your target/);
    await expect(shot).toContainText(/That’s in the (bunker|water|trees)\.|inside your usual miss of ±\d+ m\.|Clear of hazards within your usual miss of ±\d+ m\./);
    await shot.getByText('Show suggested shot').click();
    await expect(shot).toContainText('Suggested shot');
    await expect(shot.getByText('Show suggested shot')).toHaveCount(0);
  });

  test('Hole › drag the ball: “Drag me” goes, “From your ball · {n} m to pin”, “Back to the tee” resets', async ({ page }) => {
    await startRound(page);
    await openRound(page);
    const dragMe = holeMap(page).locator('text', { hasText: /^Drag me$/ });
    const pill = (await dragMe.boundingBox())!;
    const ball = { x: pill.x + pill.width / 2 - 50, y: pill.y + pill.height / 2 };
    await page.mouse.move(ball.x, ball.y);
    await page.mouse.down();
    await page.mouse.move(ball.x, ball.y - 30, { steps: 6 });
    await page.mouse.move(ball.x, ball.y - 90, { steps: 10 });
    await page.mouse.up();
    const shot = shotCard(page);
    await expect(shot).toContainText(/From your ball · \d+ m to pin/);
    await expect(dragMe).toHaveCount(0);
    await shot.getByText('Back to the tee').click();
    await expect(shot).toContainText('From the tee');
    await expect(shot.getByText('Back to the tee')).toHaveCount(0);
    // "Drag me" stays gone for the rest of the visit.
    await page.getByLabel('Hole 2, par 5').click();
    await expect(shotCard(page)).toContainText('From the tee');
    await expect(dragMe).toHaveCount(0);
  });

  test('Hole › Back leaves the round in progress', async ({ page }) => {
    await startRound(page);
    await openRound(page);
    await page.getByLabel('Back. Your round stays in progress').click();
    await expect(page.getByText('Round in progress')).toBeVisible();
  });

  test('Hole › finished round reopened: “Finished round · changes save”, Done-only scorecard, edits save and keep it completed', async ({ page }) => {
    const year = await golfGet(page, 'golfStats', '&period=year');
    const id = year.stats.recent[0].id;
    const before = await getRound(page, id);
    await openMyGolf(page);
    await page.getByRole('button', { name: /Yellow tees · 18 holes/ }).first().click();
    await page.getByRole('button', { name: 'Correct a score' }).click();
    await expect(page.getByText('Finished round · changes save')).toBeVisible();
    await expect(page.getByLabel('Back', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Hole 1, par 4, scored')).toBeVisible();
    await expect(page.getByText('344 m · SI 12 · 1 shot')).toBeVisible(); // opens on hole 1 when all are in
    await cardBtn(page).click();
    const card = sheet(page, 'Scorecard');
    await expect(card.getByText('Done', { exact: true })).toBeVisible();
    await expect(card.getByText('Discard round')).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Finish round' })).toHaveCount(0);
    await card.getByText('Done', { exact: true }).click();
    await expect(card).toHaveCount(0);
    const s0 = before.entries[0].s as number;
    await page.getByLabel('One shot more').click();
    await expect(page.getByLabel(`Score ${s0 + 1}`)).toBeVisible();
    await expect.poll(async () => (await getRound(page, id)).entries[0].s).toBe(s0 + 1);
    expect((await getRound(page, id)).status).toBe('completed');
    await expect(page.getByText('Finished round · changes save')).toBeVisible();
    // Round detail reloads on focus and shows the correction.
    const gross = before.entries.reduce((t, e) => t + (e.s as number), 0) + 1;
    await page.getByLabel('Back', { exact: true }).click();
    await expect(page.getByText(`${gross} (+${gross - 72})`)).toBeVisible();
  });

  test('Hole › clearing a hole on a finished round is rejected: “Could not save that score” with the server message', async ({ page }) => {
    const year = await golfGet(page, 'golfStats', '&period=year');
    const id = year.stats.recent[0].id;
    const before = await getRound(page, id);
    await openMyGolf(page);
    await page.getByRole('button', { name: /Yellow tees · 18 holes/ }).first().click();
    await page.getByRole('button', { name: 'Correct a score' }).click();
    await expect(page.getByText('Finished round · changes save')).toBeVisible();
    const s0 = before.entries[0].s as number;
    // Let the round, profile and course map finish loading: the map arriving re-lays out the screen.
    await page.waitForLoadState('networkidle');
    await longPress(page, page.getByLabel(`Score ${s0}`));
    const a = appAlert(page);
    await expect(a).toContainText('Could not save that score');
    await expect(a).toContainText('Enter a score (or a pick-up) on every hole before finishing. 1 to go.');
    const after = await getRound(page, id);
    expect(after.entries[0].s).toBe(s0); // the server kept the score
    expect(after.status).toBe('completed');
  });

  test('Hole › nine-hole round: 9 pills with back-nine numbers and a Total-only scorecard (response rewritten)', async ({ page }) => {
    // The mock cannot start a nine: present the started round as a back nine.
    const r = await startRound(page);
    await patch(page, 'golfRound', (j) => {
      j.holes = j.holes.slice(9);
      j.entries = j.entries.slice(9);
      j.layout = 'back9';
      j.par = j.holes.reduce((s: number, h: any) => s + h.par, 0);
    });
    await openRound(page);
    await expect(page.getByLabel(/^Hole \d+, par \d/)).toHaveCount(9);
    await expect(page.getByText(/^368 m · SI 3 · \d shots?$/)).toBeVisible(); // opens on hole 10
    await expect(page.getByLabel('Hole 1, par 4')).toHaveCount(0);
    await cardBtn(page).click();
    const card = sheet(page, 'Scorecard');
    await expect(card.getByText('Total', { exact: true })).toBeVisible();
    await expect(card.getByText('Out', { exact: true })).toHaveCount(0);
    await expect(card.getByText('In', { exact: true })).toHaveCount(0);
    await expect(card.getByText('9 holes to go')).toBeVisible();
    await card.getByRole('button', { name: 'Close' }).last().click();
    await page.getByLabel('Your round: tees and handicap').click();
    await expect(sheet(page, 'Your round').getByText('9 (10–18)')).toBeVisible();
    void r;
  });

  test.skip('native only: two-finger pinch zoom on the hole map', async () => {});
  test.skip('native only: Android hardware back (closes sheets, leaves the hole view, dismisses alerts without running a button)', async () => {});
  test.skip('native only: light-content status bar, slide-up transition and disabled swipe-back gesture', async () => {});
});

// =====================================================================
test.describe('Round detail', () => {
  async function openFirstRecent(page: Page) {
    await openMyGolf(page);
    await page.getByRole('button', { name: /tees · (18 holes|holes)/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Round', exact: true }).first()).toBeVisible();
  }

  test('Round › hero (course, date · tees (gender) · CR/slope, handicap line, pts and gross), scorecard, Correct a score, Delete round', async ({ page }) => {
    const year = await golfGet(page, 'golfStats', '&period=year');
    const rec = year.stats.recent[0];
    await openFirstRecent(page);
    await expect(page.getByRole('heading', { name: 'Strand Golf Club' })).toBeVisible();
    await expect(page.getByText(/^\S.* · Yellow tees \(men\) · CR 72\.0 \/ 123$/)).toBeVisible();
    await expect(page.getByText('Index 12.4 · course handicap 13 · playing 13 (95%)')).toBeVisible();
    await expect(page.getByText(String(rec.points), { exact: true }).first()).toBeVisible();
    await expect(page.getByText('pts', { exact: true })).toBeVisible();
    await expect(page.getByText(String(rec.gross), { exact: true }).first()).toBeVisible();
    await expect(page.getByText('gross', { exact: true })).toBeVisible();
    for (const s of ['Out', 'In', 'Total', 'Handicap score']) await expect(page.getByText(s, { exact: true })).toBeVisible();
    await expect(page.getByLabel('Go to hole 1')).toHaveCount(0); // not tappable
    await expect(page.getByRole('button', { name: 'Correct a score' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete round' })).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { name: 'My Golf' })).toBeVisible();
  });

  test('Round › loading spinner and error text', async ({ page }) => {
    await openMyGolf(page);
    await delay(page, 'golfRound', 2000);
    await page.getByRole('button', { name: /Yellow tees · 18 holes/ }).first().click();
    await expect(page.getByRole('progressbar')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Correct a score' })).toBeVisible({ timeout: 15_000 });
    await page.unroute(isAction('golfRound'));
    await page.getByRole('button', { name: 'Back' }).click();
    await fail(page, 'GET', 'golfRound', 500);
    await page.getByRole('button', { name: /Yellow tees · 18 holes/ }).first().click();
    await expect(page.getByText(SERVER_MESSAGE)).toBeVisible(); // Owner decision 24 Nov 2026 (friendly wording): a 5xx or technical message shows the friendly text.
    await expect(page.getByRole('button', { name: 'Correct a score' })).toHaveCount(0);
  });

  test('Round › Delete round: “Keep it” stays; “Delete round” deletes and goes back', async ({ page }) => {
    await openFirstRecent(page);
    await page.getByRole('button', { name: 'Delete round' }).click();
    let a = appAlert(page);
    await expect(a).toContainText('Delete this round?');
    await expect(a).toContainText('It will be removed from your scorecards and My Golf stats. This can’t be undone.');
    await a.getByRole('button', { name: 'Keep it' }).click();
    await expect(appAlert(page)).toBeHidden();
    await expect(page.getByRole('button', { name: 'Correct a score' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete round' }).click();
    a = appAlert(page);
    await a.getByRole('button', { name: 'Delete round' }).click();
    await expect(page.getByRole('heading', { name: 'My Golf' })).toBeVisible();
    expect((await mockState(page)).rounds).toBe(15);
  });

  test('Round › delete failure: “Could not delete the round”', async ({ page }) => {
    await openFirstRecent(page);
    await fail(page, 'POST', 'golfRoundDelete', 500);
    await page.getByRole('button', { name: 'Delete round' }).click();
    await appAlert(page).getByRole('button', { name: 'Delete round' }).click();
    const a = appAlert(page);
    await expect(a).toContainText('Could not delete the round');
    await expect(a).toContainText(SERVER_MESSAGE); // Owner decision 24 Nov 2026 (friendly wording): a 5xx or technical message shows the friendly text.
  });

  test('Round › pick-up round: hero without gross; My Golf row shows “{n} adj.”', async ({ page }) => {
    const r = await startRound(page);
    const entries = parEntries(r, 18);
    entries[0] = { s: 'P', putts: null, fw: null };
    await golfPost(page, 'golfRoundFinish', { id: r.id, entries });
    await openMyGolf(page);
    const row = page.getByRole('button', { name: /White tees · 18 holes/ }).first();
    await expect(row).toContainText('45 pts');
    await expect(row).toContainText('74 adj.');
    await row.click();
    await expect(page.getByText('pts', { exact: true })).toBeVisible();
    await expect(page.getByText('45', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('gross', { exact: true })).toHaveCount(0);
  });

  test('Round › scratch stroke-play round with putts: “No Handicap Index (scratch)”, Putts and Net columns, still points in the hero', async ({ page }) => {
    const r = await startRound(page, { format: 'stroke', profile: { handicapIndex: null, trackStats: true } });
    await golfPost(page, 'golfRoundFinish', { id: r.id, entries: parEntries(r, 18, { putts: 2 }) });
    await openMyGolf(page);
    const row = page.getByRole('button', { name: /White tees · 18 holes/ }).first();
    await expect(row).not.toContainText('playing');
    await row.click();
    await expect(page.getByText('No Handicap Index (scratch)')).toBeVisible();
    await expect(page.getByText(/· White tees \(men\) · CR 70\.0 \/ 120$/)).toBeVisible();
    await expect(page.getByText('Putts', { exact: true }).first()).toBeVisible(); // Owner decision 24 Nov 2026 (horizontal scorecard): each nine and the Total row label their own rows, so the label appears more than once.
    await expect(page.getByText('Net', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Pts', { exact: true })).toHaveCount(0);
    await expect(page.getByText('36', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('pts', { exact: true })).toBeVisible();
  });
});

// =====================================================================
test.describe('My Golf', () => {
  test('My Golf › full state (Year): hero, tiles, chart, par averages, score mix, toughest holes, nines, locked putting, recent rounds, share card', async ({ page }) => {
    const { stats: s, totalRounds } = await golfGet(page, 'golfStats', '&period=year');
    expect(totalRounds).toBeGreaterThan(0);
    await openMyGolf(page);
    await expect(page.getByText('Your game', { exact: true })).toBeVisible();
    await expect(page.getByText('From the scorecards you’ve kept in Flagrr')).toBeVisible();
    await expect(page.getByText('Stableford average')).toBeVisible();
    await expect(page.getByText(fmt1(s.pointsAverage), { exact: true })).toBeVisible();
    await expect(page.getByText(`${s.basisRounds} 18-hole round${s.basisRounds === 1 ? '' : 's'} this year`)).toBeVisible();
    await expect(page.getByText('Handicap Index', { exact: true })).toBeVisible();
    await expect(page.getByText('12.4', { exact: true })).toBeVisible();
    await expect(page.getByText('as entered')).toBeVisible();
    await expect(page.getByText(`${s.playedToHandicap} of ${s.basisRounds}`, { exact: true })).toBeVisible();
    await expect(page.getByText('played to handicap (36+ pts)')).toBeVisible();
    await expect(page.getByText(`${s.bestPoints.points} pts`, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/^best · \d+ \S+$/)).toBeVisible();
    // Tiles
    await expect(page.getByText('Rounds', { exact: true })).toBeVisible();
    await expect(page.getByText(`${s.holesPlayed} holes`, { exact: true })).toBeVisible();
    await expect(page.getByText('Scoring average', { exact: true })).toBeVisible();
    await expect(page.getByText(fmt1(s.scoringAverage), { exact: true })).toBeVisible();
    await expect(page.getByText('handicap score, 18 holes')).toBeVisible();
    await expect(page.getByText('Best score', { exact: true })).toBeVisible();
    await expect(page.getByText(String(s.bestGross.gross), { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Doubles or worse', { exact: true })).toBeVisible();
    await expect(page.getByText('per 18 holes', { exact: true }).first()).toBeVisible();
    // Chart
    await expect(page.getByText('Points per round')).toBeVisible();
    await expect(page.getByText(`Stableford, ${s.pointsTrend.length >= 20 ? 'your last 20 rounds' : 'oldest to newest'}. The line at 36 is playing to your handicap.`)).toBeVisible();
    await expect(page.getByLabel(`Stableford points for ${s.pointsTrend.length} rounds`)).toBeVisible();
    await expect(page.getByText('Tap a column for that round.')).toBeVisible();
    // Average score by par
    await expect(page.getByText('Average score by par')).toBeVisible();
    await expect(page.getByText('Strokes per hole, with pick-ups counted as net double bogey')).toBeVisible();
    for (const p of s.parAverages) {
      await expect(page.getByText(`Par ${p.par}`, { exact: true })).toBeVisible();
      await expect(page.getByText(`${p.average.toFixed(2)} ${sign(p.average - p.par)}`)).toBeVisible();
    }
    const worst = s.parAverages.reduce((a: any, b: any) => (b.overParPerRound > a.overParPerRound ? b : a));
    await expect(page.getByText(`Par ${worst.par}s cost you the most: ${fmt1(worst.overParPerRound)} shots a round over par.`)).toBeVisible();
    // Score mix
    await expect(page.getByText('Score mix')).toBeVisible();
    await expect(page.getByText('Holes per 18')).toBeVisible();
    for (const l of ['Birdie or better', 'Par', 'Bogey', 'Double+']) await expect(page.getByText(l, { exact: true })).toBeVisible();
    await expect(page.getByText(`Doubles cost you ${fmt1(s.doubleCostPer18)} shots per 18 more than bogeys would. Turning half of them into bogeys is worth about ${fmt1(s.doubleCostPer18 / 2)} shots.`)).toBeVisible();
    // Toughest holes
    await expect(page.getByText('Your toughest holes')).toBeVisible();
    await expect(page.getByText(`At ${s.toughestHoles.courseName} · ${s.toughestHoles.rounds} rounds`)).toBeVisible();
    for (const h of s.toughestHoles.holes) {
      await expect(page.getByText(`Par ${h.par} · Stroke index ${h.si}`)).toBeVisible();
      await expect(page.getByText(`${fmt1(h.points)} points on average`).first()).toBeVisible();
    }
    await expect(page.getByText('avg over par').first()).toBeVisible();
    // Nines
    await expect(page.getByText('Front nine and back nine')).toBeVisible();
    await expect(page.getByText(fmt1(s.nines.front), { exact: true })).toBeVisible();
    await expect(page.getByText(fmt1(s.nines.back), { exact: true })).toBeVisible();
    const d = s.nines.front - s.nines.back;
    const nineText = Math.abs(d) < 0.5
      ? 'You score about the same on both nines.'
      : `You average ${fmt1(Math.abs(d))} more on the ${d > 0 ? 'front' : 'back'} nine${d > 0 ? '. A proper warm-up could help.' : '. Watch for fatigue and a slipping routine late in the round.'}`;
    await expect(page.getByText(nineText)).toBeVisible();
    // Putting locked (no putts entered in the sample rounds)
    await expect(page.getByText('Putting and ball striking')).toBeVisible();
    await expect(page.getByText('Turn on “Putts and fairways” when you start a round to unlock these')).toBeVisible();
    // Recent rounds
    await expect(page.getByText('Recent rounds')).toBeVisible();
    const rows = page.getByRole('button', { name: /Strand Golf Club.*tees · 18 holes/ });
    await expect(rows).toHaveCount(Math.min(8, s.recent.length));
    await expect(rows.first()).toContainText(`Yellow tees · 18 holes · playing 13`);
    await expect(rows.first()).toContainText(`${s.recent[0].points} pts`);
    await expect(rows.first()).toContainText(`${s.recent[0].gross} gross`);
    const bestIdx = s.recent.slice(0, 8).findIndex((r: any) => r.isBest);
    if (bestIdx >= 0) await expect(rows.nth(bestIdx)).toContainText('BEST');
    // Share card
    await expect(page.getByText('Share my rounds with Strand Golf Club')).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Share my rounds with Strand Golf Club' })).toBeVisible();
  });

  test('My Golf › reached from the Home “My Golf” link', async ({ page }) => {
    await openSignedIn(page);
    await page.getByRole('link', { name: 'My Golf' }).click();
    await expect(page.getByRole('heading', { name: 'My Golf' })).toBeVisible();
  });

  test('My Golf › loading spinner, then error card with “Try again”', async ({ page }) => {
    await delay(page, 'golfStats', 2500);
    await openSignedIn(page);
    await tab(page, 'My Golf');
    await expect(page.getByRole('progressbar')).toBeVisible();
    await expect(page.getByText('Stableford average')).toBeVisible({ timeout: 15_000 });
    await page.unroute(isAction('golfStats'));
    await fail(page, 'GET', 'golfStats', 500);
    await page.getByRole('radio', { name: 'All' }).click();
    await expect(page.getByText(SERVER_MESSAGE)).toBeVisible(); // Owner decision 24 Nov 2026 (friendly wording): a 5xx or technical message shows the friendly text.
    await expect(page.getByText('Stableford average')).toBeVisible(); // stale data still shows
    await unfail(page, 'GET', 'golfStats');
    await page.getByText('Try again', { exact: true }).click();
    await expect(page.getByText(SERVER_MESSAGE)).toHaveCount(0); // Owner decision 24 Nov 2026 (friendly wording): a 5xx or technical message shows the friendly text.
    await expect(page.getByText(/18-hole rounds? in total/)).toBeVisible();
  });

  test('My Golf › Month / Year / All change the period and clear the chart caption', async ({ page }) => {
    const month = (await golfGet(page, 'golfStats', '&period=month')).stats;
    const all = (await golfGet(page, 'golfStats', '&period=all')).stats;
    await openMyGolf(page);
    const hit = page.getByLabel(/^Stableford points for \d+ rounds$/).locator('rect[fill="transparent"]');
    await hit.first().click();
    await expect(page.getByText('Tap a column for that round.')).toHaveCount(0);
    await page.getByRole('radio', { name: 'All' }).click();
    await expect(page.getByText(`${all.basisRounds} 18-hole round${all.basisRounds === 1 ? '' : 's'} in total`)).toBeVisible();
    await expect(page.getByText('Tap a column for that round.')).toBeVisible();
    await page.getByRole('radio', { name: 'Month' }).click();
    if (month.rounds > 0) {
      await expect(page.getByText(`${month.basisRounds} 18-hole round${month.basisRounds === 1 ? '' : 's'} this month`)).toBeVisible();
      await expect(page.getByText(`${month.holesPlayed} holes`, { exact: true })).toBeVisible();
    } else {
      await expect(page.getByText('No rounds this month. Pick Year or All to see earlier rounds.')).toBeVisible();
    }
  });

  test('My Golf › a period with no rounds: hero “No rounds this month” and the empty text', async ({ page }) => {
    const month = (await golfGet(page, 'golfStats', '&period=month')).stats;
    for (const r of month.recent) await golfPost(page, 'golfRoundDelete', { id: r.id });
    await openMyGolf(page);
    await page.getByRole('radio', { name: 'Month' }).click();
    await expect(page.getByText('No rounds this month. Pick Year or All to see earlier rounds.')).toBeVisible();
    await expect(page.getByText('No rounds this month', { exact: true })).toBeVisible();
    await expect(page.getByText('Recent rounds')).toHaveCount(0);
    await expect(page.getByText('–', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('best round')).toBeVisible();
  });

  test('My Golf › chart: tapping a column shows that round, tapping again hides it', async ({ page }) => {
    const { stats: s } = await golfGet(page, 'golfStats', '&period=year');
    await openMyGolf(page);
    const hit = page.getByLabel(/^Stableford points for \d+ rounds$/).locator('rect[fill="transparent"]');
    await expect(hit).toHaveCount(s.pointsTrend.length);
    const last = s.pointsTrend.length - 1;
    const t = s.pointsTrend[last];
    await hit.nth(last).click();
    await expect(page.getByText(new RegExp(`^${t.points} pts${t.gross != null ? ` · ${t.gross} gross` : ''} · \\d+ \\S+ · ${esc(t.courseName)}$`))).toBeVisible();
    await hit.nth(last).click();
    await expect(page.getByText('Tap a column for that round.')).toBeVisible();
  });

  test('My Golf › a recent round row opens the Round', async ({ page }) => {
    await openMyGolf(page);
    await page.getByRole('button', { name: /Yellow tees · 18 holes/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Round', exact: true }).first()).toBeVisible();
  });

  test('My Golf › first-round state: “Play your first round” and “Go to Course”; share card still shown', async ({ page }) => {
    await scenario(page, { noRounds: true });
    await openMyGolf(page);
    await expect(page.getByText('Play your first round')).toBeVisible();
    await expect(page.getByText('Keep your scorecard in the Course tab and your stats appear here when you finish.')).toBeVisible();
    await expect(page.getByText('Stableford average')).toHaveCount(0);
    await expect(page.getByText('Share my rounds with Strand Golf Club')).toBeVisible();
    await page.getByText('Go to Course', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Away courses' })).toBeVisible();
  });

  test('My Golf › coming-soon card with “Play an away course” (response rewritten)', async ({ page }) => {
    // Mock always reports homeMapLive: true.
    await scenario(page, { noRounds: true });
    await patch(page, 'golfStats', (j) => { j.homeMapLive = false; });
    await openMyGolf(page);
    await expect(page.getByText('Coming soon', { exact: true })).toBeVisible();
    await expect(page.getByText('Strand Golf Club’s course map is on its way. Once you’ve kept a scorecard on a Flagrr course map, your Stableford average, scoring by par, toughest holes and more appear here.')).toBeVisible();
    await expect(page.getByText('Play your first round')).toHaveCount(0);
    await page.getByText('Play an away course', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Away courses' })).toBeVisible();
  });

  test('My Golf › coming-soon card without a club name and no live maps: no away button (response rewritten)', async ({ page }) => {
    await scenario(page, { noRounds: true });
    await patch(page, 'golfStats', (j) => { j.homeMapLive = false; j.anyCourseLive = false; j.clubName = ''; });
    await openMyGolf(page);
    await expect(page.getByText(/^Your club’s course map is on its way\. Once you’ve kept/)).toBeVisible();
    await expect(page.getByText('Play an away course')).toHaveCount(0);
    await expect(page.getByText('Share my rounds with my club')).toBeVisible();
  });

  test('My Golf › putting and ball striking unlocked, with fairway misses', async ({ page }) => {
    const r = await startRound(page, { profile: { trackStats: true } });
    const entries = parEntries(r, 18, { putts: 2 });
    r.holes.forEach((h, i) => { if (h.par >= 4) entries[i].fw = i % 3 === 0 ? 'left' : i % 3 === 1 ? 'hit' : 'right'; });
    await golfPost(page, 'golfRoundFinish', { id: r.id, entries });
    const { stats: s } = await golfGet(page, 'golfStats', '&period=year');
    await openMyGolf(page);
    await expect(page.getByText(`From the ${s.putting.holes} holes where you entered putts`)).toBeVisible();
    await expect(page.getByText('Three-putts', { exact: true })).toBeVisible();
    await expect(page.getByText('Greens in reg.', { exact: true })).toBeVisible();
    await expect(page.getByText(`${Math.round(s.putting.girPct)}%`, { exact: true })).toBeVisible();
    await expect(page.getByText(`${Math.round(s.putting.fairwayPct)}%`, { exact: true })).toBeVisible();
    await expect(page.getByText(`missed ${Math.round(s.putting.missLeftPct)}% left · ${Math.round(s.putting.missRightPct)}% right`)).toBeVisible();
    await expect(page.getByText(fmt1(s.putting.puttsPer18), { exact: true }).first()).toBeVisible();
  });

  test('My Golf › putts without fairways: Fairways “–” with “enter fairways on par 4s and 5s”; no index shows “–” in the pill', async ({ page }) => {
    const r = await startRound(page, { profile: { trackStats: true, handicapIndex: null } });
    await golfPost(page, 'golfRoundFinish', { id: r.id, entries: parEntries(r, 18, { putts: 2 }) });
    await openMyGolf(page);
    await expect(page.getByText('enter fairways on par 4s and 5s')).toBeVisible();
    await expect(page.getByText('as entered')).toBeVisible();
    await expect(page.getByText('Handicap Index', { exact: true }).locator('..')).toContainText('–');
  });

  test('My Golf › nine-hole basis and “holes {a}–{b}” recent rows (response rewritten)', async ({ page }) => {
    // Mock cannot store nine-hole rounds: present the stats as a nine-hole basis.
    await patch(page, 'golfStats', (j) => {
      j.stats.basis = 9;
      for (const r of j.stats.recent) { r.holeCount = 9; r.firstHole = 10; }
    });
    await openMyGolf(page);
    await expect(page.getByText(/^\d+ 9-hole rounds? this year$/)).toBeVisible();
    await expect(page.getByText('played to handicap (18+ pts)')).toBeVisible();
    await expect(page.getByText(/The line at 18 is playing to your handicap\./)).toBeVisible();
    await expect(page.getByText('handicap score, 9 holes')).toBeVisible();
    await expect(page.getByRole('button', { name: /Yellow tees · holes 10–18/ }).first()).toBeVisible();
  });

  test('My Golf › share toggle: on/off copy, saves shareWithClub, reverts with “Couldn’t save that” on failure (response rewritten)', async ({ page }) => {
    // Mock golfStats omits shareWithClub: report the saved profile value.
    await patch(page, 'golfStats', (j) => { j.shareWithClub = true; j.isPlaceholderClub = false; });
    await openMyGolf(page);
    const toggle = page.getByRole('switch', { name: 'Share my rounds with Strand Golf Club' });
    const onCopy = page.getByText('Your club can see the rounds you play on its course, your scorecards and the stats from them. Turn this off to keep them to yourself.');
    const offCopy = page.getByText('Your rounds are private. Your club can’t see your scorecards or golf stats.');
    await expect(onCopy).toBeVisible();
    await delay(page, 'golfProfile', 1200);
    await toggle.click();
    await expect(offCopy).toBeVisible();
    await expect(toggle).toBeDisabled(); // while saving
    await expect(toggle).toBeEnabled({ timeout: 10_000 });
    expect((await golfGet(page, 'golfProfile')).shareWithClub).toBe(false);
    await page.unroute(isAction('golfProfile'));
    await fail(page, 'POST', 'golfProfile', 500);
    await toggle.click();
    const a = appAlert(page);
    await expect(a).toContainText('Couldn’t save that');
    await expect(a).toContainText(SERVER_MESSAGE); // Owner decision 24 Nov 2026 (friendly wording): a 5xx or technical message shows the friendly text.
    await a.getByRole('button', { name: 'OK' }).click();
    await expect(offCopy).toBeVisible();
    await expect(onCopy).toHaveCount(0);
  });

  test('My Golf › share card hidden for a placeholder club (response rewritten)', async ({ page }) => {
    await patch(page, 'golfStats', (j) => { j.isPlaceholderClub = true; });
    await openMyGolf(page);
    await expect(page.getByText('Stableford average')).toBeVisible();
    await expect(page.getByText(/^Share my rounds with/)).toHaveCount(0);
  });

  test('My Golf › share card reflects the saved share setting', async ({ page }) => {
    await openMyGolf(page);
    await expect(page.getByText('Your club can see the rounds you play on its course, your scorecards and the stats from them. Turn this off to keep them to yourself.')).toBeVisible();
    await golfPost(page, 'golfProfile', { shareWithClub: false });
    await openMyGolf(page);
    await expect(page.getByText('Your rounds are private. Your club can’t see your scorecards or golf stats.')).toBeVisible();
  });

  test.skip('native only: My Golf pull to refresh (RefreshControl gesture)', async () => {});
});

// =====================================================================
test.describe('Golf appearance', () => {
  test('Golf › dark mode: Course, hole view and My Golf render', async ({ page }) => {
    await startRound(page);
    await openCourse(page, { theme: 'dark' });
    await expect(page.getByText('Round in progress')).toBeVisible();
    await page.getByRole('button', { name: 'Resume round' }).click();
    await expect(greenCard(page)).toBeVisible(); // Owner decision 24 Nov 2026: GPS is not wanted, the "GPS integration coming soon" chip is gone; the green card shows the map has loaded.
    await page.getByLabel('Back. Your round stays in progress').click();
    await tab(page, 'My Golf');
    await expect(page.getByText('Stableford average', { exact: true })).toBeVisible();
  });

  test('Golf › Reduce Motion: tiles, numbers and sheets show without animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { stats: s } = await golfGet(page, 'golfStats', '&period=year');
    await startRound(page);
    await openMyGolf(page);
    await expect(page.getByText(fmt1(s.pointsAverage), { exact: true })).toBeVisible({ timeout: 2000 });
    await tab(page, 'Course');
    await page.getByRole('button', { name: 'Resume round' }).click();
    await expect(greenCard(page)).toBeVisible(); // Owner decision 24 Nov 2026: GPS is not wanted, the "GPS integration coming soon" chip is gone; the green card shows the map has loaded.
    await cardBtn(page).click();
    await expect(sheet(page, 'Scorecard')).toBeVisible({ timeout: 2000 });
  });
});

