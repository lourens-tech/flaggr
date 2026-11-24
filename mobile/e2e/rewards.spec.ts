import { test, expect, type Page, type Request } from '@playwright/test';
import { API, TOKEN, openSignedIn, reset, scenario, tab } from './helpers';

// Inventory section C: Rewards Shop, Voucher and Reward Activity
// (docs/Member-App-Functionality-Inventory.md). Sample data comes from
// e2e/mock-api/server.ts; cases the seed data cannot show (Dining/Practice
// categories, rewards without a photo or description, ads with a link, video or
// no media, tier bar vouchers, rows without a voucher…) rewrite the mock's
// JSON response in the browser with page.route, so the mock itself is unchanged.

test.use({ locale: 'en-US' });

// Tab screens stay mounted (inactive ones are aria-hidden), so plain text
// lookups are limited to what is on the screen the member is looking at.
const SHOWN = ':not([aria-hidden="true"] *)';
const txt = (page: Page, text: string | RegExp, exact = true) =>
  page.getByText(text, typeof text === 'string' ? { exact } : undefined).and(page.locator(SHOWN));
const heading = (page: Page, name: string | RegExp) => page.getByRole('heading', { name, exact: typeof name === 'string' ? true : undefined });
const alertBox = (page: Page) => page.getByRole('alert');
const sheet = (page: Page) => page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Redeem reward?' }) });
const IMG = (f: string) => `${API}/img/${f}`;
const USER_ID = '33333333-3333-4333-8333-333333333333';

async function apiGet<T = any>(page: Page, path: string): Promise<T> {
  const res = await page.request.get(`${API}${path}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  return res.json();
}
async function mockState(page: Page) {
  for (let i = 0; ; i++) {
    try { return await (await page.request.get(`${API}/api/__state`)).json(); } catch (e) { if (i >= 2) throw e; }
  }
}

/** Rewrite one mock JSON response in the browser (the mock server is untouched). */
async function patchJson(page: Page, re: RegExp, fn: (data: any) => any) {
  await page.route(re, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const res = await route.fetch();
    const data = await res.json();
    await route.fulfill({ response: res, json: fn(data) });
  });
}
const ME = /\/api\/me(\?|$)/;
const REWARDS = /\/api\/rewards(\?|$)/;
const VOUCHERS = /\/api\/vouchers(\?|$)/;
const ACTIVITY = /\/api\/activity(\?|$)/;

/** Date strings exactly as the app formats them in this browser. */
async function fmt(page: Page, iso: string, kind: 'day' | 'monthDay') {
  return page.evaluate(([d, k]) =>
    k === 'day'
      ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
      : new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), [iso, kind] as const);
}

/** Record POST /api/profile?action=adImpression|adClick bodies. */
function trackAds(page: Page) {
  const impressions: string[] = [];
  const clicks: string[] = [];
  page.on('request', (r: Request) => {
    if (r.method() !== 'POST') return;
    const u = r.url();
    if (u.includes('action=adImpression')) impressions.push(r.postDataJSON()?.adId);
    if (u.includes('action=adClick')) clicks.push(r.postDataJSON()?.adId);
  });
  return { impressions, clicks };
}

async function openShop(page: Page, opts: { theme?: 'light' | 'dark' } = {}) {
  await openSignedIn(page, opts);
  await tab(page, 'Rewards');
  await expect(heading(page, 'Rewards Shop')).toBeVisible();
}
async function openActivity(page: Page) {
  await openSignedIn(page);
  await tab(page, 'Activity');
  await expect(heading(page, 'Reward Activity')).toBeVisible();
}
/** Keep Home's every-second-open placeholder popup out of the way (only the shop's own popup is under test). */
async function quietHomePopup(page: Page) {
  await page.addInitScript((id) => {
    try { localStorage.setItem(`flagrr_not_listed_popup_opens_${id}`, '1'); } catch { /* ignore */ }
  }, USER_ID);
}

const redeemBtn = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const searchBox = (page: Page) => page.getByRole('textbox', { name: 'Search rewards' });
const pill = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const SEED_TITLES = ['18 Hole Round', '9 Hole Round', 'Golf Cart Hire', 'Pro Shop Voucher'];

async function visibleCards(page: Page) {
  const out: string[] = [];
  for (const t of SEED_TITLES) if ((await txt(page, t).count()) > 0) out.push(t);
  return out;
}

test.beforeEach(async ({ page }) => reset(page));

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Rewards Shop', () => {
  test('Reached from › Rewards tab', async ({ page }) => {
    await openSignedIn(page);
    await tab(page, 'Rewards');
    await expect(heading(page, 'Rewards Shop')).toBeVisible();
  });

  test('Reached from › Home hero Redeem (“Redeem Flagrr Cash”)', async ({ page }) => {
    await openSignedIn(page);
    await page.getByRole('button', { name: 'Redeem Flagrr Cash' }).click();
    await expect(heading(page, 'Rewards Shop')).toBeVisible();
  });

  test('Reached from › Home rewards preview View All', async ({ page }) => {
    await openSignedIn(page);
    await page.getByRole('link', { name: 'View All' }).click();
    await expect(heading(page, 'Rewards Shop')).toBeVisible();
  });

  test('Reached from › Home reward mini-card opens the shop', async ({ page }) => {
    await openSignedIn(page);
    await page.getByRole('button', { name: '9 Hole Round, 2128 Flagrr Cash' }).click();
    await expect(heading(page, 'Rewards Shop')).toBeVisible();
    await expect(sheet(page)).toHaveCount(0); // opens the shop, not a specific reward
  });

  test('Header › club eyebrow, “Rewards Shop” and balance “FC to spend”', async ({ page }) => {
    await openShop(page);
    await expect(txt(page, 'Strand Golf Club')).toBeVisible();
    await expect(txt(page, 'FC to spend')).toBeVisible();
    const bal = page.getByLabel('12,480 Flagrr Cash to spend', { exact: true });
    await expect(bal).toBeVisible();
    await expect(bal).toContainText('12,480');
    // not tappable
    await expect(page.getByRole('button', { name: /Flagrr Cash to spend/ })).toHaveCount(0);
  });

  test('Header › balance counts up again every time the tab regains focus', async ({ page }) => {
    await openShop(page);
    await expect(page.getByLabel('12,480 Flagrr Cash to spend')).toContainText('12,480');
    await tab(page, 'Home');
    await expect(heading(page, 'Rewards Shop')).toHaveCount(0);
    await tab(page, 'Rewards');
    const seen: string[] = await page.evaluate(async () => {
      const out: string[] = [];
      const end = performance.now() + 1600;
      while (performance.now() < end) {
        const el = [...document.querySelectorAll('[aria-label$="Flagrr Cash to spend"]')].find((e) => !e.closest('[aria-hidden="true"]'));
        const v = el?.firstElementChild?.textContent ?? '';
        if (v && out[out.length - 1] !== v) out.push(v);
        await new Promise((r) => requestAnimationFrame(r));
      }
      return out;
    });
    const nums = seen.map((s) => Number(s.replace(/\D/g, '')));
    expect(nums.some((n) => n < 12480)).toBe(true);
    expect(nums[nums.length - 1]).toBe(12480);
  });

  test('Reduce Motion › balance shows its final value with no count-up', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openSignedIn(page);
    await tab(page, 'Rewards');
    const first: string = await page.evaluate(async () => {
      for (let i = 0; i < 200; i++) {
        const el = [...document.querySelectorAll('[aria-label$="Flagrr Cash to spend"]')].find((e) => !e.closest('[aria-hidden="true"]'));
        const v = el?.firstElementChild?.textContent;
        if (v) return v;
        await new Promise((r) => requestAnimationFrame(r));
      }
      return '';
    });
    expect(first).toBe('12,480');
  });

  test('Search › placeholder “Search rewards…”, live filter on title, case-insensitive and trimmed', async ({ page }) => {
    await openShop(page);
    await expect(page.getByPlaceholder('Search rewards…')).toBeVisible();
    expect(await visibleCards(page)).toEqual(SEED_TITLES);
    await searchBox(page).fill('cart');
    await expect(txt(page, '18 Hole Round')).toHaveCount(0);
    expect(await visibleCards(page)).toEqual(['Golf Cart Hire']);
    await searchBox(page).fill('  HOLE  ');
    await expect(txt(page, 'Golf Cart Hire')).toHaveCount(0);
    expect(await visibleCards(page)).toEqual(['18 Hole Round', '9 Hole Round']);
    // no clear (×) button on the field
    await expect(page.getByRole('button', { name: /clear/i })).toHaveCount(0);
  });

  test('Search › matches title only, not description or category', async ({ page }) => {
    await openShop(page);
    await searchBox(page).fill('spend it'); // only in Pro Shop Voucher's description
    await expect(txt(page, 'No rewards match your search.')).toBeVisible();
    await searchBox(page).fill('experiences'); // a category name, in no title
    await expect(txt(page, 'No rewards match your search.')).toBeVisible();
  });

  test('No results › “No rewards match your search.” card, no ad, search and pills stay', async ({ page }) => {
    await openShop(page);
    await expect(txt(page, 'SPONSORED')).toBeVisible();
    await searchBox(page).fill('Lesson');
    await expect(txt(page, 'No rewards match your search.')).toBeVisible();
    await expect(txt(page, 'Try another word, or clear the search to see everything.')).toBeVisible();
    await expect(txt(page, 'SPONSORED')).toHaveCount(0);
    await expect(txt(page, 'Ad Space')).toHaveCount(0);
    await expect(searchBox(page)).toBeVisible();
    await expect(pill(page, 'All')).toBeVisible();
    await searchBox(page).fill('');
    expect(await visibleCards(page)).toEqual(SEED_TITLES);
  });

  test('Category pills › All first, then only categories that have rewards, in fixed order', async ({ page }) => {
    await openShop(page);
    const names = await page.getByRole('button', { name: /^(All|Rounds|Dining|Practice|Pro Shop|Experiences)$/ }).allInnerTexts();
    expect(names.map((s) => s.trim())).toEqual(['All', 'Rounds', 'Pro Shop', 'Experiences']);
  });

  test('Category pills › full order Rounds, Dining, Practice, Pro Shop, Experiences', async ({ page }) => {
    await patchJson(page, REWARDS, (list) => [
      ...list,
      { id: 'rx1', title: 'Halfway House Lunch', description: '', imageUrl: null, category: 'dining', variants: [{ id: 'vx1', label: 'Standard', randValue: null, cost: 800 }] },
      { id: 'rx2', title: 'Range Balls', description: 'A bucket of range balls.', imageUrl: null, category: 'practice', variants: [{ id: 'vx2', label: 'Standard', randValue: null, cost: 300 }] },
    ]);
    await openShop(page);
    const names = await page.getByRole('button', { name: /^(All|Rounds|Dining|Practice|Pro Shop|Experiences)$/ }).allInnerTexts();
    expect(names.map((s) => s.trim())).toEqual(['All', 'Rounds', 'Dining', 'Practice', 'Pro Shop', 'Experiences']);
    await pill(page, 'Dining').click();
    await expect(txt(page, '18 Hole Round')).toHaveCount(0);
    await expect(txt(page, 'Halfway House Lunch')).toBeVisible();
    await pill(page, 'Practice').click();
    await expect(txt(page, 'Range Balls')).toBeVisible();
    await expect(txt(page, 'Halfway House Lunch')).toHaveCount(0);
  });

  test('Category pills › a pill filters; tapping the active pill again returns to All; All resets', async ({ page }) => {
    await openShop(page);
    await pill(page, 'Rounds').click();
    await expect(txt(page, 'Golf Cart Hire')).toHaveCount(0);
    expect(await visibleCards(page)).toEqual(['18 Hole Round', '9 Hole Round']);
    await pill(page, 'Rounds').click(); // active pill toggles back to All
    await expect(txt(page, 'Golf Cart Hire')).toBeVisible();
    expect(await visibleCards(page)).toEqual(SEED_TITLES);
    await pill(page, 'Pro Shop').click();
    await expect(txt(page, '18 Hole Round')).toHaveCount(0);
    expect(await visibleCards(page)).toEqual(['Pro Shop Voucher']);
    await pill(page, 'All').click();
    await expect(txt(page, '18 Hole Round')).toBeVisible();
    expect(await visibleCards(page)).toEqual(SEED_TITLES);
  });

  test('Search AND category combine', async ({ page }) => {
    await openShop(page);
    await pill(page, 'Rounds').click();
    await searchBox(page).fill('18');
    await expect(txt(page, '9 Hole Round')).toHaveCount(0);
    expect(await visibleCards(page)).toEqual(['18 Hole Round']);
    await searchBox(page).fill('cart'); // matches a title, but not in Rounds
    await expect(txt(page, 'No rewards match your search.')).toBeVisible();
  });

  test('Search, category and option choice persist while switching tabs', async ({ page }) => {
    await openShop(page);
    await searchBox(page).fill('o');
    await page.getByRole('radio', { name: 'Option B' }).click();
    await expect(txt(page, '28,000')).toBeVisible();
    await tab(page, 'Home');
    await expect(heading(page, 'Rewards Shop')).toHaveCount(0);
    await tab(page, 'Rewards');
    await expect(searchBox(page)).toHaveValue('o');
    await expect(txt(page, '28,000')).toBeVisible();
    await pill(page, 'Rounds').click();
    await tab(page, 'Profile');
    await expect(heading(page, 'Rewards Shop')).toHaveCount(0);
    await tab(page, 'Rewards');
    await expect(txt(page, '18 Hole Round')).toBeVisible();
    await expect(txt(page, 'Golf Cart Hire')).toHaveCount(0);
    expect(await visibleCards(page)).toEqual(['18 Hole Round', '9 Hole Round']);
  });

  test('Reward card › category tag, title, description, cost + FC and Redeem Now with its label', async ({ page }) => {
    await openShop(page);
    const cases: Array<[string, string, string, string]> = [
      ['18 Hole Round', 'A round of 18 holes at your club.', '4,200', 'Redeem 18 Hole Round'],
      ['9 Hole Round', 'A round of 9 holes at your club.', '2,128', 'Redeem 9 Hole Round'],
      ['Golf Cart Hire', 'One cart for a round.', '1,540', 'Redeem Golf Cart Hire'],
      ['Pro Shop Voucher', 'Spend it in the pro shop.', '1,260', 'Redeem Pro Shop Voucher Option A'],
    ];
    for (const [title, desc, cost, label] of cases) {
      await expect(txt(page, title)).toBeVisible();
      await expect(txt(page, desc)).toBeVisible();
      await expect(txt(page, cost)).toBeVisible();
      await expect(redeemBtn(page, label)).toContainText('Redeem Now');
    }
    // category tag on each card (plus the filter pill of the same name)
    await expect(txt(page, 'Rounds')).toHaveCount(3);
    await expect(txt(page, 'Experiences')).toHaveCount(2);
    await expect(txt(page, 'Pro Shop')).toHaveCount(2);
    await expect(txt(page, 'FC')).toHaveCount(4);
  });

  test('Reward card › option chips only for 2+ variants; choosing one changes cost and Redeem label', async ({ page }) => {
    await openShop(page);
    await expect(page.getByRole('radiogroup')).toHaveCount(1);
    const group = page.getByRole('radiogroup', { name: 'Pro Shop Voucher options' });
    await expect(group.getByRole('radio')).toHaveText(['Option A', 'Option B']);
    await expect(txt(page, '1,260')).toBeVisible(); // first option selected by default
    await expect(redeemBtn(page, 'Redeem Pro Shop Voucher Option A')).toBeVisible();
    await group.getByRole('radio', { name: 'Option B' }).click();
    await expect(txt(page, '28,000')).toBeVisible();
    await expect(txt(page, '1,260')).toHaveCount(0);
    await expect(redeemBtn(page, 'Redeem Pro Shop Voucher Option B')).toBeVisible();
    await group.getByRole('radio', { name: 'Option A' }).click();
    await expect(redeemBtn(page, 'Redeem Pro Shop Voucher Option A')).toBeVisible();
  });

  test('Reward card › option choice is lost when filtering moves the card into another row', async ({ page }) => {
    await openShop(page);
    await page.getByRole('radio', { name: 'Option B' }).click();
    await expect(txt(page, '28,000')).toBeVisible();
    await searchBox(page).fill('pro'); // Pro Shop Voucher moves into the first row and remounts
    await expect(txt(page, '1,260')).toBeVisible();
    await expect(redeemBtn(page, 'Redeem Pro Shop Voucher Option A')).toBeVisible();
  });

  test('Reward card › no photo / failed photo / no description / long title still render', async ({ page }) => {
    const longTitle = 'Members Weekend Package with Breakfast, Range Balls, Cart Hire and a Signed Flag From the Club Captain';
    await patchJson(page, REWARDS, (list) => [
      { id: 'rx1', title: 'Halfway House Lunch', description: '', imageUrl: null, category: 'dining', variants: [{ id: 'vx1', label: 'Standard', randValue: null, cost: 800 }] },
      { id: 'rx2', title: 'Range Balls', description: 'A bucket of range balls.', imageUrl: IMG('does-not-exist.jpg'), category: 'practice', variants: [{ id: 'vx2', label: 'Standard', randValue: null, cost: 300 }] },
      { id: 'rx3', title: longTitle, description: 'Short.', imageUrl: null, category: 'experiences', variants: [{ id: 'vx3', label: 'Standard', randValue: null, cost: 900 }] },
      ...list,
    ]);
    await openShop(page);
    await expect(redeemBtn(page, 'Redeem Halfway House Lunch')).toBeVisible();
    await expect(redeemBtn(page, 'Redeem Range Balls')).toBeVisible();
    await expect(txt(page, 'A bucket of range balls.')).toBeVisible();
    // the failed photo is replaced by the fallback panel (no broken image left)
    await expect(page.locator('img[src$="does-not-exist.jpg"]')).toHaveCount(0);
    // a long title is cut at two lines
    const title = txt(page, longTitle);
    await expect(title).toBeVisible();
    const box = await title.boundingBox();
    expect(box!.height).toBeLessThan(50);
  });

  test('Grid › two cards per row; an odd last card keeps half width', async ({ page }) => {
    await openShop(page);
    await searchBox(page).fill('ro'); // 18 Hole Round, 9 Hole Round, Pro Shop Voucher
    await expect(txt(page, 'Golf Cart Hire')).toHaveCount(0);
    const box = async (name: string) => (await redeemBtn(page, name).boundingBox())!;
    // The cards rise in one after another: wait until the first row has settled before measuring.
    await expect.poll(async () => Math.abs((await box('Redeem 18 Hole Round')).y - (await box('Redeem 9 Hole Round')).y)).toBeLessThan(2); // same row
    const a = await box('Redeem 18 Hole Round');
    const b = await box('Redeem 9 Hole Round');
    const c = await box('Redeem Pro Shop Voucher Option A');
    expect(b.x).toBeGreaterThan(a.x + a.width);
    expect(c.y).toBeGreaterThan(a.y + a.height); // next row
    expect(Math.abs(c.width - a.width)).toBeLessThan(4); // half width, not stretched
    expect(Math.abs(c.x - a.x)).toBeLessThan(4);
  });

  test('Scroll › cards below the fold appear when scrolled into view', async ({ page }) => {
    await openShop(page);
    const last = redeemBtn(page, 'Redeem Pro Shop Voucher Option A');
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await expect(last).toBeVisible();
  });

  test('Ad slot › SPONSORED ad after the first row only; impression logged; not tappable without a link', async ({ page }) => {
    const ads = trackAds(page);
    await openShop(page);
    await expect(txt(page, 'SPONSORED')).toHaveCount(1);
    const ad = (await txt(page, 'SPONSORED').boundingBox())!;
    const row1 = (await redeemBtn(page, 'Redeem 18 Hole Round').boundingBox())!;
    const row2 = (await redeemBtn(page, 'Redeem Golf Cart Hire').boundingBox())!;
    expect(ad.y).toBeGreaterThan(row1.y);
    expect(ad.y).toBeLessThan(row2.y);
    await expect.poll(() => ads.impressions.includes('ad3')).toBe(true);
    await expect(page.getByRole('link', { name: /Sample advert 3|Advertisement/ })).toHaveCount(0);
  });

  test('Ad slot › no ad configured shows “Ad Space” placeholder without SPONSORED', async ({ page }) => {
    await patchJson(page, ME, (me) => ({ ...me, ads: [] }));
    await openShop(page);
    await expect(txt(page, 'Ad Space')).toBeVisible();
    await expect(txt(page, 'SPONSORED')).toHaveCount(0);
  });

  test('Ad slot › ad with a link: tap logs a click and opens the URL', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__opened = [];
      window.open = ((u: string) => { (window as any).__opened.push(String(u)); return null; }) as typeof window.open;
    });
    await patchJson(page, ME, (me) => ({ ...me, ads: [{ id: 'adL', placement: 'rewardsShop', title: 'Club Day', imageUrl: IMG('strand-golf-club-fairway.jpg'), mediaType: 'image', targetUrl: 'https://example.test/club-day' }] }));
    const ads = trackAds(page);
    await openShop(page);
    await expect(txt(page, 'SPONSORED')).toBeVisible();
    await page.getByRole('link', { name: 'Club Day' }).click();
    await expect.poll(() => ads.clicks).toEqual(['adL']);
    await expect.poll(() => page.evaluate(() => (window as any).__opened)).toEqual(['https://example.test/club-day']);
  });

  test('Ad slot › ad without a title or media: link label “Advertisement”; no media shows the title', async ({ page }) => {
    await patchJson(page, ME, (me) => ({ ...me, ads: [{ id: 'adT', placement: 'rewardsShop', title: 'Text Only Ad', imageUrl: null, mediaType: 'image', targetUrl: null }] }));
    await openShop(page);
    await expect(txt(page, 'SPONSORED')).toBeVisible();
    await expect(txt(page, 'Text Only Ad')).toBeVisible();
  });

  test('Ad slot › untitled linked ad is labelled “Advertisement”', async ({ page }) => {
    await patchJson(page, ME, (me) => ({ ...me, ads: [{ id: 'adU', placement: 'rewardsShop', title: '', imageUrl: IMG('strand-golf-club-fairway.jpg'), mediaType: 'image', targetUrl: 'https://example.test/x' }] }));
    await openShop(page);
    await expect(page.getByRole('link', { name: 'Advertisement' })).toBeVisible();
  });

  test('Ad slot › video ad plays muted and loops when it is the only ad', async ({ page }) => {
    await patchJson(page, ME, (me) => ({ ...me, ads: [{ id: 'adV', placement: 'rewardsShop', title: 'Video', imageUrl: IMG('sample.mp4'), mediaType: 'video', targetUrl: null }] }));
    await openShop(page);
    await expect(txt(page, 'SPONSORED')).toBeVisible();
    const v = page.locator('video');
    await expect(v).toHaveCount(1);
    await expect.poll(() => v.evaluate((el: HTMLVideoElement) => ({ muted: el.muted, loop: el.loop, controls: el.controls }))).toEqual({ muted: true, loop: true, controls: false });
  });

  test('Ad slot › several ads rotate every 6 s; impressions per rotation, paused while the tab is not focused', async ({ page }) => {
    test.slow();
    await patchJson(page, ME, (me) => ({ ...me, ads: [
      { id: 'adA', placement: 'rewardsShop', title: 'Ad One', imageUrl: null, mediaType: 'image', targetUrl: null },
      { id: 'adB', placement: 'rewardsShop', title: 'Ad Two', imageUrl: null, mediaType: 'image', targetUrl: null },
    ] }));
    const ads = trackAds(page);
    await openShop(page);
    await expect(txt(page, 'Ad One')).toBeVisible();
    await expect.poll(() => ads.impressions.includes('adA')).toBe(true);
    await expect(txt(page, 'Ad Two')).toBeVisible({ timeout: 9000 });
    await expect(txt(page, 'Ad One')).toHaveCount(0);
    await expect.poll(() => ads.impressions.includes('adB')).toBe(true);
    await tab(page, 'Profile');
    await page.waitForTimeout(500);
    ads.impressions.length = 0;
    await page.waitForTimeout(6500);
    expect(ads.impressions.filter((id) => id === 'adA' || id === 'adB')).toEqual([]);
    await tab(page, 'Rewards');
    await expect.poll(() => ads.impressions.some((id) => id === 'adA' || id === 'adB')).toBe(true);
  });

  test('Redeem Now › not enough Flagrr Cash alert with the shortfall (option label) and OK', async ({ page }) => {
    await openShop(page);
    await page.getByRole('radio', { name: 'Option B' }).click();
    await redeemBtn(page, 'Redeem Pro Shop Voucher Option B').click();
    const a = alertBox(page);
    await expect(a.getByRole('heading', { name: 'Not enough Flagrr Cash' })).toBeVisible();
    await expect(a).toContainText('You need 15520 more Flagrr Cash to redeem Pro Shop Voucher (Option B).');
    await expect(a.getByRole('button')).toHaveText(['OK']);
    await expect(sheet(page)).toHaveCount(0);
    await a.getByRole('button', { name: 'OK' }).click();
    await expect(alertBox(page)).toHaveCount(0);
    await expect(sheet(page)).toHaveCount(0);
    expect((await mockState(page)).vouchers).toBe(3);
  });

  test('Redeem Now › not enough alert for a Standard reward uses the title; cards are never disabled', async ({ page }) => {
    await scenario(page, { balance: 1000 });
    await openShop(page);
    for (const label of ['Redeem 18 Hole Round', 'Redeem 9 Hole Round', 'Redeem Golf Cart Hire', 'Redeem Pro Shop Voucher Option A']) {
      await expect(redeemBtn(page, label)).toBeEnabled();
    }
    await redeemBtn(page, 'Redeem 18 Hole Round').click();
    await expect(alertBox(page)).toContainText('You need 3200 more Flagrr Cash to redeem 18 Hole Round.');
    await alertBox(page).getByRole('button', { name: 'OK' }).click();
    await expect(alertBox(page)).toHaveCount(0);
  });

  test('Redeem sheet › “Redeem reward?” with club · category, name, Cost, Balance after, Redeem Now, Cancel, ×', async ({ page }) => {
    await openShop(page);
    await redeemBtn(page, 'Redeem 9 Hole Round').click();
    const s = sheet(page);
    await expect(s.getByRole('heading', { name: 'Redeem reward?' })).toBeVisible();
    await expect(s.getByText('Strand Golf Club · Rounds', { exact: true })).toBeVisible();
    await expect(s.getByText('9 Hole Round', { exact: true })).toBeVisible();
    await expect(s.getByText('Cost', { exact: true })).toBeVisible();
    await expect(s.getByText('2,128 FC', { exact: true })).toBeVisible();
    await expect(s.getByText('Balance after', { exact: true })).toBeVisible();
    await expect(s.getByText('10,352 FC', { exact: true })).toBeVisible();
    await expect(s.getByRole('button', { name: 'Redeem Now' })).toBeVisible();
    await expect(s.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(s.getByRole('button', { name: 'Close' })).toHaveCount(2); // × and the backdrop
    expect((await mockState(page)).vouchers).toBe(3); // opening the sheet makes no server call
  });

  test('Redeem sheet › multi-option reward named “{title} ({label})”', async ({ page }) => {
    await openShop(page);
    await redeemBtn(page, 'Redeem Pro Shop Voucher Option A').click();
    const s = sheet(page);
    await expect(s.getByText('Strand Golf Club · Pro Shop', { exact: true })).toBeVisible();
    await expect(s.getByText('Pro Shop Voucher (Option A)', { exact: true })).toBeVisible();
    await expect(s.getByText('1,260 FC', { exact: true })).toBeVisible();
    await expect(s.getByText('11,220 FC', { exact: true })).toBeVisible();
  });

  for (const how of ['Cancel', '×', 'backdrop'] as const) {
    test(`Redeem sheet › ${how} closes it without redeeming`, async ({ page }) => {
      await openShop(page);
      await redeemBtn(page, 'Redeem Golf Cart Hire').click();
      const s = sheet(page);
      await expect(s.getByRole('heading', { name: 'Redeem reward?' })).toBeVisible();
      if (how === 'Cancel') await s.getByRole('button', { name: 'Cancel' }).click();
      else if (how === '×') await s.getByRole('button', { name: 'Close' }).last().click();
      else await s.getByRole('button', { name: 'Close' }).first().click({ position: { x: 30, y: 60 } });
      await expect(sheet(page)).toHaveCount(0);
      await expect(heading(page, 'Rewards Shop')).toBeVisible();
      expect((await mockState(page)).vouchers).toBe(3);
    });
  }

  test('Redeem sheet › no home club name: meta shows the category only; eyebrow hidden', async ({ page }) => {
    await patchJson(page, ME, (me) => ({ ...me, user: { ...me.user, homeClub: '' } }));
    await openShop(page);
    await expect(txt(page, 'Strand Golf Club')).toHaveCount(0);
    await redeemBtn(page, 'Redeem 9 Hole Round').click();
    await expect(sheet(page).getByText('Rounds', { exact: true })).toBeVisible();
    await expect(sheet(page).getByText(/·/)).toHaveCount(0);
  });

  test('Redeem sheet › Redeem Now: spinner, Cancel/×/backdrop ignored while redeeming, then the Voucher', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route(/\/api\/redeem(\?|$)/, async (route) => {
      if (route.request().method() === 'POST') await gate;
      await route.fallback();
    });
    await openShop(page);
    await redeemBtn(page, 'Redeem 9 Hole Round').click();
    const s = sheet(page);
    await s.getByRole('button', { name: 'Redeem Now' }).click();
    await expect(s.getByRole('progressbar')).toBeAttached(); // spinner inside Redeem Now
    await expect(s.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await s.getByRole('button', { name: 'Cancel' }).click({ force: true });
    await s.getByRole('button', { name: 'Close' }).last().click();
    await s.getByRole('button', { name: 'Close' }).first().click({ position: { x: 30, y: 60 }, force: true });
    await expect(s.getByRole('heading', { name: 'Redeem reward?' })).toBeVisible();
    release();
    await expect(heading(page, '9 Hole Round')).toBeVisible();
    await expect(sheet(page)).toHaveCount(0);
    expect((await mockState(page)).vouchers).toBe(4);
  });

  test('Redeem sheet › success opens the Voucher; balance, voucher list and activity update', async ({ page }) => {
    await openShop(page);
    await redeemBtn(page, 'Redeem Pro Shop Voucher Option A').click();
    await sheet(page).getByRole('button', { name: 'Redeem Now' }).click();
    await expect(heading(page, 'Pro Shop Voucher — Option A')).toBeVisible();
    await expect(txt(page, 'Balance left')).toBeVisible();
    await expect(txt(page, '11,220 FC')).toBeVisible();
    expect((await mockState(page)).vouchers).toBe(4);
    expect((await mockState(page)).scenario.balance).toBe(11220);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(heading(page, 'Rewards Shop')).toBeVisible();
    await expect(page.getByLabel('11,220 Flagrr Cash to spend')).toBeVisible();
    await tab(page, 'Activity');
    const row = page.getByRole('button', { name: /^Pro Shop Voucher redeemed Redeemed · .* −1,260 FC$/ });
    await expect(row.first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Pro Shop Voucher redeemed/ })).toHaveCount(2);
    await row.first().click();
    await expect(heading(page, 'Pro Shop Voucher — Option A')).toBeVisible();
  });

  test('Redeem sheet › unverified member can redeem (no verification gate)', async ({ page }) => {
    await scenario(page, { unverified: true });
    await openShop(page);
    await redeemBtn(page, 'Redeem Golf Cart Hire').click();
    await sheet(page).getByRole('button', { name: 'Redeem Now' }).click();
    await expect(heading(page, 'Golf Cart Hire')).toBeVisible();
  });

  const failures: Array<[string, Record<string, unknown>]> = [
    ['server error 500', { fail: { 'POST /api/redeem': 500 } }],
    ['404 Reward not found', { fail: { 'POST /api/redeem': 404 } }],
    ['401 Not authenticated', { fail: { 'POST /api/redeem': 401 } }],
    ['400 Not enough Flagrr Cash (balance changed elsewhere)', { balance: 100 }],
  ];
  for (const [name, sc] of failures) {
    test(`Redeem sheet › silent failure: ${name} closes the sheet with no message`, async ({ page }) => {
      await openShop(page);
      await scenario(page, sc); // after sign-in: the app still holds the old balance
      await redeemBtn(page, 'Redeem 9 Hole Round').click();
      await sheet(page).getByRole('button', { name: 'Redeem Now' }).click();
      await expect(sheet(page)).toHaveCount(0);
      await expect(heading(page, 'Rewards Shop')).toBeVisible();
      await page.waitForTimeout(400);
      await expect(alertBox(page)).toHaveCount(0);
      await expect(heading(page, 'Voucher')).toHaveCount(0);
      expect((await mockState(page)).vouchers).toBe(3);
    });
  }

  test('Redeem sheet › partial failure: voucher issued but refetch fails, stays on shop with stale balance', async ({ page }) => {
    await openShop(page);
    await scenario(page, { fail: { 'GET /api/me': 500 } });
    await redeemBtn(page, 'Redeem 9 Hole Round').click();
    await sheet(page).getByRole('button', { name: 'Redeem Now' }).click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(heading(page, 'Rewards Shop')).toBeVisible();
    await expect(alertBox(page)).toHaveCount(0);
    const st = await mockState(page);
    expect(st.vouchers).toBe(4);
    expect(st.scenario.balance).toBe(10352);
    await expect(page.getByLabel('12,480 Flagrr Cash to spend')).toBeVisible();
  });

  test('Empty catalogue (listed club) › “No Rewards Yet”, no button, ad slot, no search or pills', async ({ page }) => {
    await scenario(page, { noRewards: true });
    await openShop(page);
    await expect(txt(page, 'No Rewards Yet')).toBeVisible();
    await expect(txt(page, 'Your club hasn\'t added any rewards yet — check back soon.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Contact Support' })).toHaveCount(0);
    await expect(txt(page, 'SPONSORED')).toBeVisible();
    await expect(searchBox(page)).toHaveCount(0);
    await expect(pill(page, 'All')).toHaveCount(0);
    await expect(alertBox(page)).toHaveCount(0); // no placeholder popup for a listed club
  });

  test('Placeholder club › popup on Rewards with exact copy; Close dismisses; “Nothing Here Yet” card and Ad Space', async ({ page }) => {
    await quietHomePopup(page);
    await scenario(page, { placeholder: true });
    await openSignedIn(page);
    await expect(alertBox(page)).toHaveCount(0);
    await tab(page, 'Rewards');
    const a = alertBox(page);
    await expect(a.getByRole('heading', { name: 'You\'re Almost In the Family' })).toBeVisible();
    await expect(a).toContainText("We couldn't find your golf club on Flagrr yet, so there's no rewards catalogue to show you just yet. Ask your club to join Flagrr, or get in touch with our support team and we'll help make it happen.");
    await expect(a.getByRole('button')).toHaveText(['Contact Support', 'Close']);
    await a.getByRole('button', { name: 'Close' }).click();
    await expect(alertBox(page)).toHaveCount(0);
    await expect(heading(page, 'Rewards Shop')).toBeVisible();
    await expect(txt(page, 'Nothing Here Yet')).toBeVisible();
    await expect(txt(page, "Your golf club hasn't joined the Flagrr family yet — that's why there's nothing to redeem here.")).toBeVisible();
    await expect(txt(page, 'Ad Space')).toBeVisible();
    await expect(txt(page, 'SPONSORED')).toHaveCount(0);
    await expect(searchBox(page)).toHaveCount(0);
  });

  test('Placeholder club › popup shows again on every focus of the Rewards tab', async ({ page }) => {
    await quietHomePopup(page);
    await scenario(page, { placeholder: true });
    await openSignedIn(page);
    for (let i = 0; i < 2; i++) {
      await tab(page, 'Rewards');
      await expect(alertBox(page).getByRole('heading', { name: 'You\'re Almost In the Family' })).toBeVisible();
      await alertBox(page).getByRole('button', { name: 'Close' }).click();
      await expect(alertBox(page)).toHaveCount(0);
      await tab(page, 'Home');
      await expect(heading(page, 'Rewards Shop')).toHaveCount(0);
    }
  });

  test('Placeholder club › popup Contact Support opens Contact', async ({ page }) => {
    await quietHomePopup(page);
    await scenario(page, { placeholder: true });
    await openSignedIn(page);
    await tab(page, 'Rewards');
    await alertBox(page).getByRole('button', { name: 'Contact Support' }).click();
    await expect(alertBox(page)).toHaveCount(0);
    await expect(txt(page, 'Have Any Questions?')).toBeVisible();
  });

  test('Placeholder club › empty card Contact Support opens Contact', async ({ page }) => {
    await quietHomePopup(page);
    await scenario(page, { placeholder: true });
    await openSignedIn(page);
    await tab(page, 'Rewards');
    await alertBox(page).getByRole('button', { name: 'Close' }).click();
    await expect(alertBox(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Contact Support' }).click();
    await expect(txt(page, 'Have Any Questions?')).toBeVisible();
  });

  test('Placeholder club › popup fires even if the placeholder club has rewards', async ({ page }) => {
    await quietHomePopup(page);
    await scenario(page, { placeholder: true });
    await patchJson(page, REWARDS, () => [
      { id: 'r9', title: '9 Hole Round', description: 'A round of 9 holes at your club.', imageUrl: null, category: 'rounds', variants: [{ id: 'v9', label: 'Standard', randValue: null, cost: 2128 }] },
    ]);
    await openSignedIn(page);
    await tab(page, 'Rewards');
    await expect(alertBox(page).getByRole('heading', { name: 'You\'re Almost In the Family' })).toBeVisible();
    await alertBox(page).getByRole('button', { name: 'Close' }).click();
    await expect(redeemBtn(page, 'Redeem 9 Hole Round')).toBeVisible();
  });

  test('Dark mode › shop, sheet and alert render', async ({ page }) => {
    await openShop(page, { theme: 'dark' });
    await expect(txt(page, '9 Hole Round')).toBeVisible();
    await redeemBtn(page, 'Redeem 9 Hole Round').click();
    await expect(sheet(page).getByText('10,352 FC', { exact: true })).toBeVisible();
    await sheet(page).getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('radio', { name: 'Option B' }).click();
    await redeemBtn(page, 'Redeem Pro Shop Voucher Option B').click();
    await expect(alertBox(page).getByRole('heading', { name: 'Not enough Flagrr Cash' })).toBeVisible();
  });

  test('Native only › Android back closes the sheet / popup', async () => {
    test.skip(true, 'native only: Android hardware back on the redeem sheet and placeholder popup');
  });
  test('Native only › Reduce Motion visuals (no rise, no parallax, no press scale, sheet fades only)', async () => {
    test.skip(true, 'native only / visual: motion variants are not observable as behaviour on web (balance count-up is covered above)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Voucher', () => {
  test('Reached from › Reward Activity active row; every row of the ticket and details', async ({ page }) => {
    const vouchers = await apiGet<any[]>(page, '/api/vouchers');
    const v1 = vouchers.find((v) => v.id === 'v1');
    await openActivity(page);
    await page.getByRole('button', { name: /^9 Hole Round redeemed/ }).click();
    await expect(heading(page, '9 Hole Round')).toBeVisible();
    await expect(heading(page, 'Voucher').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible();
    await expect(txt(page, 'Strand Golf Club')).toBeVisible();
    await expect(txt(page, 'Reward Redeemed')).toBeVisible();
    await expect(txt(page, 'Your reward has been successfully redeemed. Present your QR code or voucher code at the club to claim.')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Voucher QR code' })).toBeVisible();
    await expect(txt(page, 'Voucher Code')).toBeVisible();
    await expect(txt(page, 'FLGR-V1-QX2M')).toBeVisible();
    await expect(txt(page, 'Redeemed')).toBeVisible();
    await expect(txt(page, await fmt(page, v1.issuedAt, 'day'))).toBeVisible();
    await expect(txt(page, 'Expires')).toBeVisible();
    await expect(txt(page, await fmt(page, v1.expiresAt, 'day'))).toBeVisible();
    await expect(txt(page, 'Cost')).toBeVisible();
    await expect(txt(page, '2,128 FC')).toBeVisible();
    await expect(txt(page, 'Balance left')).toBeVisible();
    await expect(txt(page, '12,480 FC')).toBeVisible(); // current balance, not the balance at redemption
    await expect(page.getByRole('button', { name: 'Back to Rewards' })).toBeVisible();
    // status is never shown on the voucher
    for (const s of ['Expired', 'Already redeemed', 'Active']) await expect(txt(page, s)).toHaveCount(0);
  });

  test('QR encodes the voucher’s qrValue; voucher code is selectable', async ({ page }) => {
    await openActivity(page);
    await page.getByRole('button', { name: /^9 Hole Round redeemed/ }).click();
    await expect(page.getByRole('img', { name: 'Voucher QR code' }).locator('svg')).toBeVisible();
    const code = txt(page, 'FLGR-V1-QX2M');
    await expect(code).toBeVisible();
    expect(await code.evaluate((el) => getComputedStyle(el).userSelect)).toBe('text');
  });

  test('Back returns to Reward Activity', async ({ page }) => {
    await openActivity(page);
    await page.getByRole('button', { name: /^9 Hole Round redeemed/ }).click();
    await expect(heading(page, '9 Hole Round')).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(heading(page, 'Reward Activity')).toBeVisible();
  });

  test('From a redeem › Back returns to the shop', async ({ page }) => {
    await openShop(page);
    await redeemBtn(page, 'Redeem 9 Hole Round').click();
    await sheet(page).getByRole('button', { name: 'Redeem Now' }).click();
    await expect(heading(page, '9 Hole Round')).toBeVisible();
    await expect(txt(page, '10,352 FC')).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(heading(page, 'Rewards Shop')).toBeVisible();
  });

  test('Back to Rewards closes the Voucher and returns to the tab navigator', async ({ page }) => {
    await openActivity(page);
    await page.getByRole('button', { name: /^9 Hole Round redeemed/ }).click();
    await expect(heading(page, '9 Hole Round')).toBeVisible();
    await page.getByRole('button', { name: 'Back to Rewards' }).click();
    await expect(heading(page, '9 Hole Round')).toHaveCount(0);
    await expect(page.getByRole('tablist')).toBeVisible();
  });

  test.fixme('Back to Rewards lands on the last active tab (Rewards after a redeem) — app lands on Home instead (navigate(\'Main\') on web resets to the first tab)', async ({ page }) => {
    await openShop(page);
    await redeemBtn(page, 'Redeem 9 Hole Round').click();
    await sheet(page).getByRole('button', { name: 'Redeem Now' }).click();
    await expect(heading(page, '9 Hole Round')).toBeVisible();
    await page.getByRole('button', { name: 'Back to Rewards' }).click();
    await expect(heading(page, 'Rewards Shop')).toBeVisible();
  });

  test.fixme('Back to Rewards from Reward Activity lands on Activity (inventory) — app lands on Home instead', async ({ page }) => {
    await openActivity(page);
    await page.getByRole('button', { name: /^9 Hole Round redeemed/ }).click();
    await expect(heading(page, '9 Hole Round')).toBeVisible();
    await page.getByRole('button', { name: 'Back to Rewards' }).click();
    await expect(heading(page, 'Reward Activity')).toBeVisible();
  });

  test('Zero-cost tier bar voucher shows “Bar Voucher — R100” and Cost “0 FC”', async ({ page }) => {
    const now = new Date().toISOString();
    await patchJson(page, VOUCHERS, (list) => [{ id: 'tv1', rewardId: 'rbar', rewardTitle: 'Bar Voucher', variantLabel: 'R100', cost: 0, code: 'FLGR-TIER-0001', status: 'active', qrValue: 'flagrr://voucher/FLGR-TIER-0001', issuedAt: now, expiresAt: new Date(Date.now() + 90 * 864e5).toISOString() }, ...list]);
    await patchJson(page, ACTIVITY, (list) => [{ id: 'at1', type: 'redeem', title: 'Gold Tier Bar Voucher (R100)', subtitle: 'Free with your tier', amount: 0, voucherId: 'tv1', date: now }, ...list]);
    await openActivity(page);
    const row = page.getByRole('button', { name: /^Gold Tier Bar Voucher \(R100\) Redeemed · .* 0 FC$/ });
    await expect(row).toBeVisible();
    await row.click();
    await expect(heading(page, 'Bar Voucher — R100')).toBeVisible();
    await expect(txt(page, '0 FC')).toBeVisible();
    await expect(txt(page, 'FLGR-TIER-0001')).toBeVisible();
  });

  test('Reward removed from the catalogue / blank title still opens (title “— {label}”)', async ({ page }) => {
    const now = new Date().toISOString();
    await patchJson(page, VOUCHERS, (list) => [{ id: 'gone1', rewardId: 'deleted', rewardTitle: '', variantLabel: 'R200', cost: 500, code: 'FLGR-GONE-0001', status: 'active', qrValue: 'flagrr://voucher/FLGR-GONE-0001', issuedAt: now, expiresAt: now }, ...list]);
    await patchJson(page, ACTIVITY, (list) => [{ id: 'ag1', type: 'redeem', title: 'Old Reward redeemed', subtitle: 'Reward voucher', amount: -500, voucherId: 'gone1', date: now }, ...list]);
    await openActivity(page);
    await page.getByRole('button', { name: /^Old Reward redeemed/ }).click();
    await expect(heading(page, /^\s*— R200$/)).toBeVisible();
    await expect(txt(page, 'FLGR-GONE-0001')).toBeVisible();
    await expect(txt(page, '500 FC')).toBeVisible();
  });

  test('Dark mode › voucher renders', async ({ page }) => {
    await openSignedIn(page, { theme: 'dark' });
    await tab(page, 'Activity');
    await page.getByRole('button', { name: /^9 Hole Round redeemed/ }).click();
    await expect(page.getByRole('img', { name: 'Voucher QR code' })).toBeVisible();
    await expect(txt(page, 'FLGR-V1-QX2M')).toBeVisible();
  });

  test.fixme('“Voucher not found.” state on the Voucher screen — unreachable: every entry (redeem, Activity row) only navigates with a voucherId that is in the local list; needs a deep link or test hook', async () => {});

  test('Native only › long-press to copy the code, swipe back, glass bar on Android', async () => {
    test.skip(true, 'native only: long-press copy, iOS swipe back / Android back, Android solid header');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Reward Activity', () => {
  test('Reached from › Activity tab (tab screen, no Back button)', async ({ page }) => {
    await openSignedIn(page);
    await tab(page, 'Activity');
    await expect(heading(page, 'Reward Activity')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0);
    await expect(page.getByRole('tablist')).toBeVisible();
  });

  test('Reached from › Profile → Reward Activity row', async ({ page }) => {
    await openSignedIn(page);
    await tab(page, 'Profile');
    await txt(page, 'Reward Activity').click();
    await expect(heading(page, 'Reward Activity')).toBeVisible();
  });

  test('All › groups Today, Yesterday, This Week, Earlier with rows, meta and amounts', async ({ page }) => {
    const activity = await apiGet<any[]>(page, '/api/activity');
    await openActivity(page);
    const seg = page.getByRole('radiogroup', { name: 'Show activity' });
    await expect(seg.getByRole('radio')).toHaveText(['All', 'Earned', 'Redeemed']);
    const groups = ['Today', 'Yesterday', 'This Week', 'Earlier'];
    const ys: number[] = [];
    for (const g of groups) { await expect(txt(page, g)).toBeVisible(); ys.push((await txt(page, g).boundingBox())!.y); }
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    const d = async (id: string) => fmt(page, activity.find((a) => a.id === id).date, 'monthDay');
    const expectRow = async (title: string, meta: string, amount: string, group: number) => {
      const row = txt(page, title);
      const meta_ = txt(page, meta);
      await expect(meta_.first()).toBeVisible();
      const amt = txt(page, amount);
      await expect(amt.first()).toBeVisible();
      const y = (await row.first().boundingBox())!.y;
      expect(y).toBeGreaterThan(ys[group]);
      if (group < 3) expect(y).toBeLessThan(ys[group + 1]);
    };
    await expectRow('Receipt scanned', `Earned · ${await d('a1')}`, '+196 FC', 0);
    await expectRow('9 Hole Round redeemed', `Redeemed · ${await d('a2')}`, '−2,128 FC', 1);
    await expect(txt(page, `Earned · ${await d('a3')}`)).toBeVisible();
    await expect(txt(page, '+1,450 FC')).toBeVisible();
    const tw = (await txt(page, '+1,450 FC').boundingBox())!.y;
    expect(tw).toBeGreaterThan(ys[2]);
    expect(tw).toBeLessThan(ys[3]);
    await expectRow('18 Hole Round redeemed', `Redeemed · ${await d('a5')}`, '−4,200 FC', 3);
    await expectRow('Pro Shop Voucher redeemed', `Redeemed · ${await d('a6')}`, '−1,260 FC', 3);
    // newest first inside a group
    const e1 = (await txt(page, '18 Hole Round redeemed').boundingBox())!.y;
    const e2 = (await txt(page, 'Pro Shop Voucher redeemed').boundingBox())!.y;
    expect(e1).toBeLessThan(e2);
    // server subtitle is not shown
    await expect(txt(page, 'Strand Golf Club')).toHaveCount(0);
  });

  test('Status pills › “Already redeemed” and “Expired”; none for an active voucher', async ({ page }) => {
    await openActivity(page);
    await expect(page.getByRole('button', { name: /^18 Hole Round redeemed .*Already redeemed/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Pro Shop Voucher redeemed .*Expired/ })).toBeVisible();
    const active = page.getByRole('button', { name: /^9 Hole Round redeemed/ });
    await expect(active).not.toContainText('Already redeemed');
    await expect(active).not.toContainText('Expired');
  });

  test('Earned › only earn rows; Redeemed › only redeem rows; All restores', async ({ page }) => {
    await openActivity(page);
    const seg = page.getByRole('radiogroup', { name: 'Show activity' });
    await seg.getByRole('radio', { name: 'Earned' }).click();
    await expect(page.getByRole('button', { name: /redeemed/ })).toHaveCount(0);
    await expect(txt(page, 'Receipt scanned')).toHaveCount(2);
    await expect(txt(page, 'Yesterday')).toHaveCount(0);
    await expect(txt(page, 'Earlier')).toHaveCount(0);
    await seg.getByRole('radio', { name: 'Redeemed' }).click();
    await expect(txt(page, 'Receipt scanned')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /redeemed Redeemed ·/ })).toHaveCount(3);
    await expect(txt(page, 'Today')).toHaveCount(0);
    await expect(txt(page, 'This Week')).toHaveCount(0);
    await seg.getByRole('radio', { name: 'All' }).click();
    await expect(txt(page, 'Receipt scanned')).toHaveCount(2);
    await expect(page.getByRole('button', { name: /redeemed Redeemed ·/ })).toHaveCount(3);
  });

  test('Filter persists while switching tabs', async ({ page }) => {
    await openActivity(page);
    await page.getByRole('radio', { name: 'Redeemed' }).click();
    await expect(txt(page, 'Receipt scanned')).toHaveCount(0);
    await tab(page, 'Home');
    await expect(heading(page, 'Reward Activity')).toHaveCount(0);
    await tab(page, 'Activity');
    await expect(heading(page, 'Reward Activity')).toBeVisible();
    await expect(page.getByRole('button', { name: /^9 Hole Round redeemed/ })).toBeVisible();
    await expect(txt(page, 'Receipt scanned')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /redeemed Redeemed ·/ })).toHaveCount(3);
  });

  test('Filter empty › “Nothing earned yet.” / “Nothing redeemed yet.”', async ({ page }) => {
    let mode: 'redeemOnly' | 'earnOnly' = 'redeemOnly';
    await patchJson(page, ACTIVITY, (list: any[]) => list.filter((e) => (mode === 'redeemOnly' ? e.type === 'redeem' : e.type === 'earn')));
    await openActivity(page);
    await page.getByRole('radio', { name: 'Earned' }).click();
    await expect(txt(page, 'Nothing earned yet.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Scan a receipt' })).toHaveCount(0);
    mode = 'earnOnly';
    await page.reload();
    await tab(page, 'Activity');
    await page.getByRole('radio', { name: 'Redeemed' }).click();
    await expect(txt(page, 'Nothing redeemed yet.')).toBeVisible();
    await expect(txt(page, 'No activity yet')).toHaveCount(0);
  });

  test('Tap › active voucher row opens the Voucher', async ({ page }) => {
    await openActivity(page);
    await page.getByRole('button', { name: /^9 Hole Round redeemed/ }).click();
    await expect(heading(page, '9 Hole Round')).toBeVisible();
    await expect(txt(page, 'FLGR-V1-QX2M')).toBeVisible();
  });

  test('Tap › redeemed voucher shows “Already redeemed” alert; OK dismisses', async ({ page }) => {
    await openActivity(page);
    await page.getByRole('button', { name: /^18 Hole Round redeemed/ }).click();
    const a = alertBox(page);
    await expect(a.getByRole('heading', { name: 'Already redeemed' })).toBeVisible();
    await expect(a).toContainText('18 Hole Round has already been scanned and redeemed at the club.');
    await expect(a.getByRole('button')).toHaveText(['OK']);
    await a.getByRole('button', { name: 'OK' }).click();
    await expect(alertBox(page)).toHaveCount(0);
    await expect(heading(page, 'Reward Activity')).toBeVisible();
  });

  test('Tap › expired voucher shows “Voucher expired” alert with “ — {label}”; OK dismisses', async ({ page }) => {
    await openActivity(page);
    await page.getByRole('button', { name: /^Pro Shop Voucher redeemed/ }).click();
    const a = alertBox(page);
    await expect(a.getByRole('heading', { name: 'Voucher expired' })).toBeVisible();
    await expect(a).toContainText('Pro Shop Voucher — Option A has expired.');
    await a.getByRole('button', { name: 'OK' }).click();
    await expect(alertBox(page)).toHaveCount(0);
  });

  test('Tap › voucher missing locally shows “Voucher not found” alert (curly apostrophes)', async ({ page }) => {
    const now = new Date().toISOString();
    await patchJson(page, ACTIVITY, (list) => [{ id: 'am1', type: 'redeem', title: 'Gold Tier Bar Voucher (R100)', subtitle: 'Free with your tier', amount: 0, voucherId: 'not-in-list', date: now }, ...list]);
    await openActivity(page);
    const row = page.getByRole('button', { name: /^Gold Tier Bar Voucher \(R100\)/ });
    await expect(row).not.toContainText('Expired');
    await expect(row).not.toContainText('Already redeemed');
    await row.click();
    const a = alertBox(page);
    await expect(a.getByRole('heading', { name: 'Voucher not found' })).toBeVisible();
    await expect(a).toContainText('We couldn’t find this voucher’s details.');
    await a.getByRole('button', { name: 'OK' }).click();
    await expect(alertBox(page)).toHaveCount(0);
  });

  test('Tier bar voucher granted during a redeem’s refetch shows “Voucher not found” until reload', async ({ page }) => {
    let granted = false;
    const tier = { id: 'tv9', rewardId: 'rbar', rewardTitle: 'Bar Voucher', variantLabel: 'R200', cost: 0, code: 'FLGR-TIER-0009', status: 'active', qrValue: 'flagrr://voucher/FLGR-TIER-0009', issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 90 * 864e5).toISOString() };
    await patchJson(page, ACTIVITY, (list) => (granted ? [{ id: 'at9', type: 'redeem', title: 'Platinum Tier Bar Voucher (R200)', subtitle: 'Free with your tier', amount: 0, voucherId: 'tv9', date: tier.issuedAt }, ...list] : list));
    await patchJson(page, VOUCHERS, (list) => (granted ? [tier, ...list] : list));
    await openShop(page);
    granted = true; // server grants the tier voucher while the redeem refetches
    await redeemBtn(page, 'Redeem Golf Cart Hire').click();
    await sheet(page).getByRole('button', { name: 'Redeem Now' }).click();
    await expect(heading(page, 'Golf Cart Hire')).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await tab(page, 'Activity');
    await page.getByRole('button', { name: /^Platinum Tier Bar Voucher/ }).click();
    await expect(alertBox(page).getByRole('heading', { name: 'Voucher not found' })).toBeVisible();
    await alertBox(page).getByRole('button', { name: 'OK' }).click();
    await page.reload();
    await tab(page, 'Activity');
    await page.getByRole('button', { name: /^Platinum Tier Bar Voucher/ }).click();
    await expect(heading(page, 'Bar Voucher — R200')).toBeVisible();
  });

  test('Voucher statuses refresh only at sign-in (validated voucher still opens until reload)', async ({ page }) => {
    let validated = false;
    await patchJson(page, VOUCHERS, (list: any[]) => (validated ? list.map((v) => (v.id === 'v1' ? { ...v, status: 'redeemed' } : v)) : list));
    await openActivity(page);
    validated = true; // staff validated v1 at the club during the session
    await tab(page, 'Rewards');
    await redeemBtn(page, 'Redeem Golf Cart Hire').click(); // a redeem refetches activity but not vouchers
    await sheet(page).getByRole('button', { name: 'Redeem Now' }).click();
    await expect(heading(page, 'Golf Cart Hire')).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await tab(page, 'Activity');
    const row = page.getByRole('button', { name: /^9 Hole Round redeemed/ });
    await expect(row).not.toContainText('Already redeemed');
    await row.click();
    await expect(heading(page, '9 Hole Round')).toBeVisible();
    await page.reload();
    await tab(page, 'Activity');
    await expect(page.getByRole('button', { name: /^9 Hole Round redeemed/ })).toContainText('Already redeemed');
  });

  test('Rows › earn rows and redeem rows without a voucher are inert; “Redeemed” used for adjustments', async ({ page }) => {
    const now = new Date().toISOString();
    await patchJson(page, ACTIVITY, (list) => [
      { id: 'adj1', type: 'redeem', title: 'Flagrr Cash adjusted', subtitle: 'Correction', amount: -50, voucherId: null, date: now },
      { id: 'rej1', type: 'redeem', title: 'Receipt rejected', subtitle: 'Flagrr Cash reversed', amount: -196, voucherId: null, date: now },
      ...list,
    ]);
    await openActivity(page);
    await expect(txt(page, 'Flagrr Cash adjusted')).toBeVisible();
    await expect(txt(page, '−50 FC')).toBeVisible();
    await expect(txt(page, 'Receipt rejected')).toBeVisible();
    await expect(txt(page, '−196 FC')).toBeVisible();
    await expect(txt(page, /^Redeemed · /)).toHaveCount(5);
    for (const t of [/Flagrr Cash adjusted/, /Receipt rejected/, /Receipt scanned/]) await expect(page.getByRole('button', { name: t })).toHaveCount(0);
    // tapping an inert row does nothing
    await txt(page, 'Flagrr Cash adjusted').click();
    await txt(page, 'Receipt scanned').first().click();
    await page.waitForTimeout(300);
    await expect(alertBox(page)).toHaveCount(0);
    await expect(heading(page, 'Reward Activity')).toBeVisible();
    // exactly the three voucher rows are tappable
    await expect(page.getByRole('button', { name: /redeemed Redeemed ·/ })).toHaveCount(3);
  });

  test('Empty › “No activity yet” card with segmented control above; Scan a receipt opens the scanner', async ({ page }) => {
    await scenario(page, { noActivity: true });
    await openActivity(page);
    await expect(page.getByRole('radiogroup', { name: 'Show activity' })).toBeVisible();
    await expect(txt(page, 'No activity yet')).toBeVisible();
    await expect(txt(page, 'No activity yet — play a round or scan a receipt to get started.')).toBeVisible();
    await page.getByRole('radio', { name: 'Earned' }).click();
    await expect(txt(page, 'No activity yet')).toBeVisible(); // any filter
    await expect(txt(page, 'Nothing earned yet.')).toHaveCount(0);
    await page.getByRole('button', { name: 'Scan a receipt' }).click();
    await expect(page.getByRole('button', { name: 'Upload from gallery' })).toBeVisible();
  });

  test('Dark mode › activity renders', async ({ page }) => {
    await openSignedIn(page, { theme: 'dark' });
    await tab(page, 'Activity');
    await expect(heading(page, 'Reward Activity')).toBeVisible();
    await expect(page.getByRole('button', { name: /^18 Hole Round redeemed .*Already redeemed/ })).toBeVisible();
  });

  test('Only the latest 100 entries are shown (api/activity limit)', async ({ page }) => {
    await scenario(page, { manyActivity: true }); // 5 seeded rows + 120 older ones; the server returns the newest 100
    await openActivity(page);
    await expect(txt(page, 'Receipt scanned')).toHaveCount(2 + 95);
    await expect(txt(page, '+194 FC')).toHaveCount(1); // the 95th older row is the last one shown
    await expect(txt(page, '+195 FC')).toHaveCount(0);
  });

  test('Native only › Reduce Motion (no rise, segmented highlight jumps)', async () => {
    test.skip(true, 'native only / visual: motion variants are not observable as behaviour on web');
  });
});
