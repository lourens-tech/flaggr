import { test, expect, type Page, type Route, type Locator } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { API, TOKEN, appAlert, openSignedIn, reset, scenario, tab } from './helpers';

// Inventory section "B. Receipt scan flow" (docs/Member-App-Functionality-Inventory.md):
// Scan Receipt (permission card, live camera, gallery upload, Reading), Review Receipt in every
// scenario, every scan/submit alert and its buttons, Receipt Success (normal and flagged) and
// Receipt History (statuses, summary, View Photo, photo errors, empty state).
//
// Scenarios the mock has no switch for (sparse slip, between-subscriptions club, home-club total
// basis, pre-paid and already-earned lines, 401/400/409/422 and non-JSON errors, custom history rows)
// are served from this file with page.route, so no mock change is needed.

// Chromium's fake camera lets the live-camera mode and the shutter run on the web build. The
// browser camera permission stays "prompt" unless a test grants it, so the Scan screen opens on the
// permission card by default.
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });

const PHOTO = path.resolve(__dirname, '../assets/images/strand-golf-club-fairway.jpg');
const CLUB_ID = '11111111-1111-4111-8111-111111111111';

test.beforeEach(async ({ page }) => reset(page));

// ---------------------------------------------------------------- helpers

/** First visible element with exactly this text. */
function vis(page: Page | Locator, text: string | RegExp, exact = true) {
  return page.getByText(text, { exact }).filter({ visible: true }).first();
}
async function see(page: Page | Locator, text: string | RegExp, exact = true, timeout?: number) {
  await expect(vis(page, text, exact)).toBeVisible({ timeout });
}
async function notSee(page: Page | Locator, text: string | RegExp, exact = true) {
  await expect(page.getByText(text, { exact }).filter({ visible: true })).toHaveCount(0);
}
function button(page: Page | Locator, name: string) {
  return page.getByRole('button', { name, exact: true }).filter({ visible: true }).first();
}

const PERM_TITLE = 'Camera access needed';
const PERM_BODY = 'Flagrr needs camera access to scan your receipts and award Flagrr Cash.';

/** The tab-bar Scan button (a11y "Scan receipt"). */
function scanTabButton(page: Page) {
  return page.getByRole('button', { name: 'Scan receipt', exact: true }).filter({ visible: true }).first();
}

/** Signed in, tap the tab-bar Scan button: Scan Receipt on its permission card. */
async function openScan(page: Page) {
  await openSignedIn(page);
  await scanTabButton(page).click();
  await see(page, 'Scan Receipt');
  await see(page, PERM_TITLE);
}

/** Pick a photo through the web file chooser opened by a gallery button. */
async function pickPhoto(page: Page, buttonText: string, file: string | { name: string; mimeType: string; buffer: Buffer } = PHOTO) {
  const chooser = page.waitForEvent('filechooser');
  if (buttonText === 'Upload from gallery') await page.getByRole('button', { name: 'Upload from gallery', exact: true }).filter({ visible: true }).first().click();
  else await vis(page, buttonText).click();
  await (await chooser).setFiles(file);
}

/** Scan screen → "Upload from gallery instead" → Review Receipt. */
async function toReview(page: Page) {
  await openScan(page);
  await pickPhoto(page, 'Upload from gallery instead');
  await see(page, 'Review Receipt', true, 30_000);
}

// The tab navigator keeps visited tabs mounted (and laid out) on web, so the active tab is told
// apart by what is actually on top at the top of the screen: each tab's own title area.
const TAB_MARKERS = {
  Home: /Flagrr Cash/, Course: /Play a round/, 'My Golf': /My Golf/, Rewards: /Rewards Shop/, Activity: /Reward Activity/, Profile: /Receipt History|· (Gold|Silver|Bronze|Platinum)/,
} as const;
type TabLabel = keyof typeof TAB_MARKERS;
async function topText(page: Page) {
  return page.evaluate(() => [60, 110, 160].map((y) => {
    let e = document.elementFromPoint(195, y) as HTMLElement | null;
    for (let k = 0; k < 3 && e && !e.innerText?.trim(); k++) e = e.parentElement;
    return (e?.innerText ?? '').replace(/\s+/g, ' ');
  }).join(' || '));
}
/** Assert the member is looking at this tab (tab bar visible, its title area on top). */
async function expectTab(page: Page, label: TabLabel) {
  await expect(page.getByRole('tab', { name: 'Home' }).filter({ visible: true })).toHaveCount(1);
  await expect.poll(() => topText(page)).toMatch(TAB_MARKERS[label]);
}
/** The floating tab bar is not reachable: the stack screen covers it (or it is not rendered). */
async function expectNoTabBar(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const t = document.querySelector('[role="tab"]');
    if (!t) return true;
    const r = t.getBoundingClientRect();
    if (!r.width) return true;
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !hit?.closest('[role="tab"]');
  })).toBe(true);
}
/** Wait until the browser camera stream is playing, so the shutter can take a photo. */
async function cameraReady(page: Page) {
  await expect.poll(() => page.evaluate(() => (document.querySelector('video') as HTMLVideoElement | null)?.readyState ?? 0), { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type, Authorization', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
async function fulfil(route: Route, status: number, body: unknown, contentType = 'application/json') {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  return route.fulfill({ status, headers: CORS, contentType, body: typeof body === 'string' ? body : JSON.stringify(body) });
}
const isApi = (pathname: string, action: string | null) => (u: URL) =>
  u.pathname === pathname && u.searchParams.get('action') === action;

/** Serve the scan preview from the test (shape of api/receipts?action=scan). */
async function stubScan(page: Page, body: unknown, status = 200, contentType = 'application/json') {
  await page.route(isApi('/api/receipts', 'scan'), (r) => fulfil(r, status, body, contentType));
}
/** Serve the submit response (POST /api/receipts) from the test. */
async function stubSubmit(page: Page, body: unknown, status = 200, contentType = 'application/json') {
  await page.route(isApi('/api/receipts', null), (r) =>
    r.request().method() === 'GET' ? r.fallback() : fulfil(r, status, body, contentType));
}

const it = (description: string, quantity: number, price: number, matchedName: string | null, pointsAwarded: number) => ({
  description, quantity, price, matchedProductId: matchedName ? 'p' : null, matchedActivityId: null, matchedName, pointsAwarded,
});
function scanBody(over: Partial<Record<string, unknown>> & { items?: ReturnType<typeof it>[] } = {}) {
  return {
    isDuplicate: false, invalid: false, ocrConfidence: 92, merchantNameGuess: null,
    merchant: { id: 'm1', name: 'Strand Golf Club', merchantType: 'halfway_house', courseId: CLUB_ID },
    receiptNumber: '004817', transactionNumber: null, tillNumber: null, date: '2026-11-24', time: '12:48',
    items: [it('Castle Lite 330ml', 2, 68, 'Castle Lite 330ml', 68)], subtotal: null, vat: null,
    grandTotal: 68, subtotalPoints: 0, totalPointsAwarded: 68, awayClub: false, nonParticipatingClub: false, pointsBasis: 'items',
    ...over,
  };
}

async function mockState(page: Page) {
  return (await (await page.request.get(`${API}/api/__state`)).json()) as { receipts: number; scenario: { balance: number } };
}

const LOWCONF = 'This scan wasn’t fully clear — some details below may be inaccurate. It’s still been submitted for review.';
// Brand words (owner decision 24 Nov 2026): no "R1 = 1 FC" (away: equation dropped; between: kept board G-B-ReviewNotices).
const AWAY = 'Not your home club — Flagrr Cash earned at the standard away-club rate.';
const BETWEEN = 'Your club is between subscriptions right now — this slip earns Flagrr Cash at the standard rate.';
// Brand words (owner decision 24 Nov 2026): no "points" for Flagrr Cash (kept board G-B-ReviewItemsBasis).
const UNMATCHED = 'Some items weren’t recognized as eligible golf products or activities, so they earned no Flagrr Cash.';
const NOT_ELIGIBLE = 'Not eligible for Flagrr Cash';
// Friendly errors (owner decision 24 Nov 2026): the texts friendlyError (src/utils/errors.ts) shows instead of
// raw technical text; server messages written for members are still shown word for word.
const SERVER_MESSAGE = 'Something went wrong on our side. Please try again.';
const NETWORK_MESSAGE = 'We couldn’t reach Flagrr. Check your connection and try again.';
const ON_TOTAL = 'Flagrr Cash is earned on the slip total.';
const ON_TOTAL_PREPAID = 'Flagrr Cash is earned on the slip total, plus the club value of pre-paid items.';
const DISCLAIMER = 'Extracted details can’t be edited — if something looks wrong, rescan with a clearer photo.';

// ======================================================================== Scan Receipt

test.describe('Scan Receipt', () => {
  test('Entry › tab-bar Scan button opens Scan Receipt from every member tab, and Close returns to that tab', async ({ page }) => {
    await openSignedIn(page);
    for (const label of ['Home', 'Course', 'My Golf', 'Rewards', 'Profile'] as const) {
      await tab(page, label);
      await expectTab(page, label);
      await scanTabButton(page).click();
      await see(page, 'Scan Receipt');
      // No tab bar on the scan screen
      await expectNoTabBar(page);
      await button(page, 'Close').click();
      await notSee(page, 'Scan Receipt');
      await expectTab(page, label);
    }
  });

  test('Entry › Activity tab empty state “Scan a receipt” opens Scan Receipt', async ({ page }) => {
    await scenario(page, { noActivity: true });
    await openSignedIn(page);
    await tab(page, 'Activity');
    await button(page, 'Scan a receipt').click();
    await see(page, 'Scan Receipt');
    await see(page, PERM_TITLE);
  });

  test('Permission card › copy, Continue and “Upload from gallery instead” are shown (camera not granted)', async ({ page }) => {
    await openScan(page);
    await see(page, PERM_BODY);
    await expect(button(page, 'Continue')).toBeVisible();
    await see(page, 'Upload from gallery instead');
    await expect(button(page, 'Close')).toBeVisible();
    // Camera-mode controls are not shown yet
    await notSee(page, 'Align receipt or QR code');
  });

  test('Permission card › Close goes back to Home', async ({ page }) => {
    await openScan(page);
    await button(page, 'Close').click();
    await notSee(page, PERM_TITLE);
    await expectTab(page, 'Home');
  });

  test('Permission card › Continue asks for the camera and switches to live camera mode', async ({ page }) => {
    await openScan(page);
    await button(page, 'Continue').click();
    await see(page, 'Align receipt or QR code');
    await notSee(page, PERM_TITLE);
  });

  test('Permission card › “Upload from gallery instead” works without camera permission and reaches Review', async ({ page }) => {
    await openScan(page);
    await pickPhoto(page, 'Upload from gallery instead');
    await see(page, 'Review Receipt');
    await see(page, 'Strand Golf Club');
  });

  test('Permission card › cancelling the file chooser stays on the permission card with no alert', async ({ page }) => {
    await openScan(page);
    const chooser = page.waitForEvent('filechooser');
    await vis(page, 'Upload from gallery instead').click();
    await (await chooser).setFiles([]);
    await see(page, PERM_TITLE);
    await expect(appAlert(page)).toHaveCount(0);
  });

  test('Image preparation › the scan call sends a JPEG data URI; a small photo keeps its size', async ({ page }) => {
    await openScan(page);
    const req = page.waitForRequest((r) => r.url().includes('/api/receipts?action=scan') && r.method() === 'POST');
    await pickPhoto(page, 'Upload from gallery instead');
    const body = (await req).postDataJSON() as { imageBase64: string };
    expect(body.imageBase64.startsWith('data:image/jpeg;base64,')).toBe(true);
    const dims = await imageSize(page, body.imageBase64);
    expect(dims).toEqual({ w: 1200, h: 799 });
  });

  test('Image preparation › a photo with a long edge over 1800 px is resized to 1800 (landscape and portrait)', async ({ page }) => {
    await openScan(page);
    const src = fs.readFileSync(PHOTO).toString('base64');
    for (const [w, h, expectW, expectH] of [[2400, 1600, 1800, 1200], [1600, 2400, 1200, 1800]] as const) {
      const big = await page.evaluate(async ([b64, w, h]) => {
        const img = new Image();
        img.src = `data:image/jpeg;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d')!.drawImage(img, 0, 0, w, h);
        return c.toDataURL('image/jpeg', 0.9).split(',')[1];
      }, [src, w, h] as const);
      const req = page.waitForRequest((r) => r.url().includes('/api/receipts?action=scan') && r.method() === 'POST');
      await pickPhoto(page, 'Upload from gallery instead', { name: 'big.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(big, 'base64') });
      const body = (await req).postDataJSON() as { imageBase64: string };
      expect(body.imageBase64.startsWith('data:image/jpeg;base64,')).toBe(true);
      const dims = await imageSize(page, body.imageBase64);
      expect(dims.w).toBe(expectW);
      expect(Math.abs(dims.h - expectH)).toBeLessThanOrEqual(1);
      await see(page, 'Review Receipt');
      await button(page, 'Rescan').click();
      await see(page, PERM_TITLE);
    }
  });

  test('Reading › while the receipt is read: photo veil, “Reading your receipt…” sheet, no Close button', async ({ page }) => {
    await scenario(page, { slowScan: true });
    await openScan(page);
    await pickPhoto(page, 'Upload from gallery instead');
    await see(page, 'Reading your receipt…');
    await see(page, 'Extracting items, matching golf products and activities, and calculating your Flagrr Cash.');
    await see(page, 'Scan Receipt');
    await expect(page.getByRole('button', { name: 'Close', exact: true }).filter({ visible: true })).toHaveCount(0);
    await notSee(page, PERM_TITLE);
    // The chosen photo is shown behind the sheet
    await expect(page.locator('img[src^="data:image"], img[src^="blob:"]').filter({ visible: true }).first()).toBeVisible();
    await see(page, 'Review Receipt');
  });

  test('Alert › duplicate: “Already redeemed” with the server reason; OK stays on the scanner', async ({ page }) => {
    await scenario(page, { scan: 'dup' });
    await openScan(page);
    await pickPhoto(page, 'Upload from gallery instead');
    const a = appAlert(page);
    await see(a, 'Already redeemed');
    await see(a, 'This receipt has already been redeemed.');
    await expect(a.getByRole('button')).toHaveCount(1);
    await button(a, 'OK').click();
    await expect(appAlert(page)).toHaveCount(0);
    await see(page, PERM_TITLE);
  });

  test('Alert › invalid slip: “This is not a valid slip” / “Please scan a valid slip.”, Try Again first then Back', async ({ page }) => {
    await scenario(page, { scan: 'invalid' });
    await openScan(page);
    await pickPhoto(page, 'Upload from gallery instead');
    const a = appAlert(page);
    await see(a, 'This is not a valid slip');
    await see(a, 'Please scan a valid slip.');
    // The server's own reason text is ignored
    await notSee(a, /couldn't read a valid receipt/);
    const names = await a.getByRole('button').allInnerTexts();
    expect(names.map((s) => s.trim())).toEqual(['Try Again', 'Back']);
  });

  test('Alert › invalid slip › “Try Again” dismisses and stays on the scanner', async ({ page }) => {
    await scenario(page, { scan: 'invalid' });
    await openScan(page);
    await pickPhoto(page, 'Upload from gallery instead');
    await button(appAlert(page), 'Try Again').click();
    await expect(appAlert(page)).toHaveCount(0);
    await see(page, PERM_TITLE);
    await see(page, 'Scan Receipt');
  });

  test('Alert › invalid slip › “Back” closes the scanner', async ({ page }) => {
    await scenario(page, { scan: 'invalid' });
    await openScan(page);
    await pickPhoto(page, 'Upload from gallery instead');
    await button(appAlert(page), 'Back').click();
    await expect(appAlert(page)).toHaveCount(0);
    await notSee(page, 'Scan Receipt');
    await expectTab(page, 'Home');
  });

  const scanErrors: [string, () => [number, unknown, string?], string][] = [
    ['500 shows the friendly server message', () => [500, { error: 'Internal server error' }], SERVER_MESSAGE], // Friendly errors (owner decision 24 Nov 2026): utils/errors.ts friendlyError.
    ['401 shows “Not authenticated”', () => [401, { error: 'Not authenticated' }], 'Not authenticated'],
    ['400 shows “Image is too large”', () => [400, { error: 'Image is too large' }], 'Image is too large'],
    ['400 shows “imageBase64 must be a jpeg/png/webp data URI”', () => [400, { error: 'imageBase64 must be a jpeg/png/webp data URI' }], 'imageBase64 must be a jpeg/png/webp data URI'],
    ['non-JSON (timeout) shows the friendly server message', () => [504, '<html>An error occurred with your deployment FUNCTION_INVOCATION_TIMEOUT</html>', 'text/html'], SERVER_MESSAGE], // Friendly errors (owner decision 24 Nov 2026): utils/errors.ts friendlyError.
  ];
  for (const [name, res, message] of scanErrors) {
    test(`Alert › “Couldn’t scan receipt” › ${name}; OK stays on the scanner`, async ({ page }) => {
      const [status, body, type] = res();
      await stubScan(page, body, status, type);
      await openScan(page);
      await pickPhoto(page, 'Upload from gallery instead');
      const a = appAlert(page);
      await see(a, 'Couldn’t scan receipt');
      await see(a, message);
      await button(a, 'OK').click();
      await expect(appAlert(page)).toHaveCount(0);
      await see(page, PERM_TITLE);
    });
  }

  test('Alert › “Couldn’t scan receipt” › mock scan error (500 via scenario) shows the friendly server message', async ({ page }) => {
    await scenario(page, { scan: 'error' });
    await openScan(page);
    await pickPhoto(page, 'Upload from gallery instead');
    const a = appAlert(page);
    await see(a, 'Couldn’t scan receipt');
    await see(a, SERVER_MESSAGE); // Friendly errors (owner decision 24 Nov 2026): utils/errors.ts friendlyError.
    await notSee(a, 'Internal server error');
  });

  test('Alert › “Couldn’t scan receipt” › 503 through the mock fail switch shows the friendly server message', async ({ page }) => {
    await scenario(page, { fail: { 'POST /api/receipts?action=scan': 503 } });
    await openScan(page);
    await pickPhoto(page, 'Upload from gallery instead');
    const a = appAlert(page);
    await see(a, 'Couldn’t scan receipt');
    await see(a, SERVER_MESSAGE); // Friendly errors (owner decision 24 Nov 2026): utils/errors.ts friendlyError.
  });

  test('Alert › “Couldn’t scan receipt” › offline / network failure shows the friendly connection message', async ({ page }) => {
    await page.route(isApi('/api/receipts', 'scan'), (r) => r.abort('internetdisconnected'));
    await openScan(page);
    await pickPhoto(page, 'Upload from gallery instead');
    const a = appAlert(page);
    await see(a, 'Couldn’t scan receipt');
    await see(a, NETWORK_MESSAGE); // Friendly errors (owner decision 24 Nov 2026): utils/errors.ts friendlyError.
    await button(a, 'OK').click();
    await see(page, PERM_TITLE);
  });

  test('Alert › “Couldn’t scan receipt” › a file that is not an image (encode failure) shows the generic message', async ({ page }) => {
    await openScan(page);
    await pickPhoto(page, 'Upload from gallery instead', { name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('this is not a jpeg') });
    const a = appAlert(page);
    await see(a, 'Couldn’t scan receipt');
    await see(a, 'Something went wrong scanning that receipt.');
  });

  test.skip('Alert › “Couldn’t read that image” (camera or picker returned no URI) — not reachable on web: the browser picker always returns a URI and the web camera always returns a photo', async () => {});

  test.describe('Live camera (browser camera granted)', () => {
    test.use({ permissions: ['camera'] });

    test('Camera mode › frame hint, “Upload from gallery”, shutter and Close are shown', async ({ page }) => {
      await openSignedIn(page);
      await scanTabButton(page).click();
      await see(page, 'Scan Receipt');
      await see(page, 'Align receipt or QR code');
      await expect(page.getByRole('button', { name: 'Upload from gallery', exact: true }).filter({ visible: true })).toBeVisible();
      await see(page, 'Upload from gallery');
      await expect(page.getByRole('button', { name: 'Scan receipt', exact: true }).filter({ visible: true })).toHaveCount(1);
      await expect(button(page, 'Close')).toBeVisible();
      await notSee(page, PERM_TITLE);
      // The torch (approved addition, 24 Nov 2026) is native only: the web build keeps today's camera, with no flash / torch control
      await expect(page.getByRole('button', { name: /flash|torch/i })).toHaveCount(0);
    });

    test('Camera mode › shutter takes a photo, reads it and opens Review', async ({ page }) => {
      await openSignedIn(page);
      await scanTabButton(page).click();
      await see(page, 'Align receipt or QR code');
      await cameraReady(page);
      const req = page.waitForRequest((r) => r.url().includes('/api/receipts?action=scan') && r.method() === 'POST');
      await page.getByRole('button', { name: 'Scan receipt', exact: true }).filter({ visible: true }).click();
      const body = (await req).postDataJSON() as { imageBase64: string };
      expect(body.imageBase64.startsWith('data:image/jpeg;base64,')).toBe(true);
      await see(page, 'Review Receipt');
    });

    test('Camera mode › “Upload from gallery” opens the file chooser and reaches Review', async ({ page }) => {
      await openSignedIn(page);
      await scanTabButton(page).click();
      await see(page, 'Align receipt or QR code');
      await pickPhoto(page, 'Upload from gallery');
      await see(page, 'Review Receipt');
    });

    test('Camera mode › Close goes back to the tab', async ({ page }) => {
      await openSignedIn(page);
      await scanTabButton(page).click();
      await see(page, 'Align receipt or QR code');
      await button(page, 'Close').click();
      await notSee(page, 'Align receipt or QR code');
      await expectTab(page, 'Home');
    });

    test('Camera mode › after an alert the screen returns to live camera mode', async ({ page }) => {
      await scenario(page, { scan: 'dup' });
      await openSignedIn(page);
      await scanTabButton(page).click();
      await see(page, 'Align receipt or QR code');
      await cameraReady(page);
      await page.getByRole('button', { name: 'Scan receipt', exact: true }).filter({ visible: true }).click();
      await see(appAlert(page), 'Already redeemed');
      await button(appAlert(page), 'OK').click();
      await see(page, 'Align receipt or QR code');
    });

    test('Camera mode › Review Back returns to the live camera and the previous photo is no longer shown', async ({ page }) => {
      await openSignedIn(page);
      await scanTabButton(page).click();
      await pickPhoto(page, 'Upload from gallery');
      await see(page, 'Review Receipt');
      await button(page, 'Back').click();
      await see(page, 'Align receipt or QR code');
      await notSee(page, 'Reading your receipt…');
      await expect(page.getByLabel('Your receipt photo').filter({ visible: true })).toHaveCount(0);
    });
  });

  test.skip('Scan › blank dark screen while camera permission is unresolved — not observable on web (the browser permission query resolves before first paint)', async () => {});
  test.skip('Scan › shutter capturing state (spinner, busy/disabled) and gallery usable during capture — not observable on web (capture finishes in ~100 ms, then Reading replaces the controls)', async () => {});
  // No silent failures (owner decision 24 Nov 2026): a capture or picker failure now shows “Couldn’t scan receipt”.
  test.skip('Scan › camera capture / picker failure shows “Couldn’t scan receipt” — native only: cannot make the web camera or picker throw', async () => {});
  // Owner decision 24 Nov 2026: camera denied for good → the card's button is “Open Settings” (Linking.openSettings).
  test.skip('Scan › OS camera permission prompt and its app.json string; denied-forever card shows “Open Settings” and returning from Settings re-reads the permission — native only (the web never reports denied-for-good)', async () => {});
  test.skip('Scan › torch button toggles the camera torch (lime when on) — native only (approved addition; the web build keeps today’s camera)', async () => {});
  test.skip('Scan › iOS photos permission string — native only', async () => {});
  test.skip('Scan › leaving mid-scan by OS back/swipe — native only (and the inventory marks the outcome unverified)', async () => {});
  test.skip('Alerts › Android hardware back dismisses an alert without running a button handler — native only', async () => {});
  test.skip('Scan › Reduce Motion: static scan line and shimmer — animation only, not assertable through visible text', async () => {});
});

async function imageSize(page: Page, dataUri: string) {
  return page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    return { w: img.naturalWidth, h: img.naturalHeight };
  }, dataUri);
}

// ======================================================================== Review Receipt

test.describe('Review Receipt', () => {
  test('Normal (home club, items basis) › merchant, receipt number, raw date · time, matched items with +FC, total, earned, disclaimer, no notices', async ({ page }) => {
    await toReview(page);
    await expect(page.getByLabel('Your receipt photo').filter({ visible: true })).toBeVisible();
    for (const t of ['Merchant', 'Strand Golf Club', 'Receipt Number', '004817', 'Date', '2026-11-24 · 12:48']) await see(page, t);
    await see(page, /^items$/i);
    await see(page, '2x Castle Lite 330ml');
    await see(page, 'Matched: Castle Lite 330ml');
    await see(page, '+68 FC');
    await see(page, 'Pizza');
    await see(page, 'Matched: Pizza');
    await see(page, '+110 FC');
    await see(page, 'Water Still');
    await see(page, 'Matched: Water Still');
    await see(page, '+18 FC');
    await see(page, 'Receipt Total');
    await see(page, 'R196.00');
    await see(page, 'Flagrr Cash Earned');
    await see(page, '+196 FC');
    await see(page, DISCLAIMER);
    await expect(button(page, 'Submit Receipt')).toBeEnabled();
    await expect(button(page, 'Rescan')).toBeVisible();
    await expect(button(page, 'Back')).toBeVisible();
    for (const n of [LOWCONF, AWAY, BETWEEN, UNMATCHED, ON_TOTAL, ON_TOTAL_PREPAID]) await notSee(page, n);
    // No tab bar on Review
    await expectNoTabBar(page);
  });

  test('Issues › unmatched line shows “Not eligible for Flagrr Cash” and “—”, plus the not-recognized footnote', async ({ page }) => {
    await scenario(page, { scan: 'issues' });
    await toReview(page);
    await see(page, 'Gift card');
    await see(page, NOT_ELIGIBLE); // Brand words (owner decision 24 Nov 2026)
    await see(page, '—');
    await expect(page.getByLabel('No Flagrr Cash', { exact: true }).filter({ visible: true })).toHaveCount(1); // the “—” (kept board G-B-ReviewItemsBasis)
    await see(page, UNMATCHED);
    await see(page, 'Matched: Castle Lite 330ml');
    await see(page, 'R268.00');
    await see(page, '+68 FC');
    await notSee(page, ON_TOTAL);
  });

  test('Away club › away notice, R-priced lines, “earned on the slip total” footnote, total and earned', async ({ page }) => {
    await scenario(page, { scan: 'away' });
    await toReview(page);
    await see(page, AWAY);
    await see(page, 'Away Golf Club');
    await see(page, 'Green fee, 18 holes');
    await expect(page.getByText('R650.00', { exact: true }).filter({ visible: true })).toHaveCount(2); // line + Receipt Total
    await see(page, ON_TOTAL);
    await see(page, '+650 FC');
    await notSee(page, NOT_ELIGIBLE);
    await notSee(page, UNMATCHED);
    await notSee(page, BETWEEN);
  });

  test('Low confidence › warn notice “This scan wasn’t fully clear…” above the slip', async ({ page }) => {
    await scenario(page, { scan: 'lowconf' });
    await toReview(page);
    await see(page, LOWCONF);
    await see(page, '+196 FC');
    await notSee(page, AWAY);
  });

  test('Low confidence + away › both notices stack', async ({ page }) => {
    await stubScan(page, scanBody({ ocrConfidence: 54, awayClub: true, pointsBasis: 'total', items: [it('Green fee', 1, 650, null, 650)], grandTotal: 650, totalPointsAwarded: 650 }));
    await toReview(page);
    await see(page, LOWCONF);
    await see(page, AWAY);
  });

  test('Confidence 55 exactly › no low-confidence notice (threshold is < 55)', async ({ page }) => {
    await stubScan(page, scanBody({ ocrConfidence: 55 }));
    await toReview(page);
    await see(page, '+68 FC');
    await notSee(page, LOWCONF);
  });

  test('Between subscriptions (non-participating) › its notice takes precedence over away; earned on total', async ({ page }) => {
    await stubScan(page, scanBody({ nonParticipatingClub: true, awayClub: true, pointsBasis: 'items', items: [it('Coffee', 1, 32, null, 32)], grandTotal: 32, totalPointsAwarded: 32 }));
    await toReview(page);
    await see(page, BETWEEN);
    await notSee(page, AWAY);
    await see(page, ON_TOTAL);
    await expect(page.getByText('R32.00', { exact: true }).filter({ visible: true })).toHaveCount(2);
    await notSee(page, NOT_ELIGIBLE);
  });

  test('Sparse slip › “Unrecognized merchant”, no receipt number or date rows, “No line items were recognized…”, no Receipt Total, +0 FC', async ({ page }) => {
    await stubScan(page, scanBody({ merchant: null, merchantNameGuess: null, receiptNumber: null, date: null, time: null, items: [], grandTotal: null, totalPointsAwarded: 0, pointsBasis: 'items' }));
    await toReview(page);
    await see(page, 'Merchant');
    await see(page, 'Unrecognized merchant');
    await notSee(page, 'Receipt Number');
    await notSee(page, 'Date');
    await see(page, 'No line items were recognized on this receipt.');
    await notSee(page, 'Receipt Total');
    await see(page, 'Flagrr Cash Earned');
    await see(page, '+0 FC');
    await expect(button(page, 'Submit Receipt')).toBeEnabled();
  });

  test('Merchant fallback › merchantNameGuess is shown when no merchant matched; time-only Date row', async ({ page }) => {
    await stubScan(page, scanBody({ merchant: null, merchantNameGuess: 'Clubhouse Deli', date: null, time: '12:48 PM' }));
    await toReview(page);
    await see(page, 'Clubhouse Deli');
    await see(page, '12:48 PM');
    await notSee(page, 'Unrecognized merchant');
  });

  test('Date row › raw printed date without time is shown as extracted (not reformatted)', async ({ page }) => {
    await stubScan(page, scanBody({ date: '23/11/2026', time: null, receiptNumber: null }));
    await toReview(page);
    await see(page, '23/11/2026');
    await notSee(page, 'Receipt Number');
  });

  test('Home club, total basis › pre-paid line (+FC, “Pre-paid · Matched: …”), already-earned lines (R amount), plain R lines, pre-paid footnote', async ({ page }) => {
    await stubScan(page, scanBody({
      pointsBasis: 'total',
      items: [
        it('Range balls', 1, 0, 'Range balls', 150),        // pre-paid earning
        it('Castle Lite 330ml', 1, 68, 'Castle Lite 330ml', 0), // already earned today (FC < price)
        it('Range tokens', 1, 0, 'Range tokens', 0),         // already earned today (pre-paid repeat)
        it('Sandwich', 1, 55.5, null, 0),                    // other line
      ],
      grandTotal: 123.5, totalPointsAwarded: 274,
    }));
    await toReview(page);
    await see(page, 'Pre-paid · Matched: Range balls');
    await see(page, '+150 FC');
    await expect(page.getByText('Already earned on another slip today', { exact: true }).filter({ visible: true })).toHaveCount(2);
    await see(page, 'R68.00');
    await see(page, 'R0.00');
    await see(page, 'R55.50');
    await see(page, ON_TOTAL_PREPAID);
    await see(page, 'R123.50');
    await see(page, '+274 FC');
    // No club notice at the home club, no items-basis notes
    for (const n of [AWAY, BETWEEN, NOT_ELIGIBLE, UNMATCHED]) await notSee(page, n);
    await notSee(page, 'Matched: Castle Lite 330ml');
  });

  test('Home club, total basis without pre-paid › “Flagrr Cash is earned on the slip total.” and R amounts, no notice', async ({ page }) => {
    await stubScan(page, scanBody({ pointsBasis: 'total', items: [it('Burger', 1, 120, 'Burger', 120)], grandTotal: 120, totalPointsAwarded: 120 }));
    await toReview(page);
    await see(page, ON_TOTAL);
    await expect(page.getByText('R120.00', { exact: true }).filter({ visible: true })).toHaveCount(2);
    await notSee(page, 'Matched: Burger');
    await notSee(page, 'Already earned on another slip today');
  });

  test('Items basis › matched line earning 0 FC shows “Matched: …” with “—” (same-day repeat)', async ({ page }) => {
    await stubScan(page, scanBody({ items: [it('Pizza', 1, 110, 'Pizza', 0)], grandTotal: null, totalPointsAwarded: 0 }));
    await toReview(page);
    await see(page, 'Matched: Pizza');
    await see(page, '—');
    await notSee(page, NOT_ELIGIBLE);
    await notSee(page, UNMATCHED);
    await notSee(page, 'Already earned on another slip today');
  });

  test('Back (header) returns to the scanner and discards the photo', async ({ page }) => {
    await toReview(page);
    await button(page, 'Back').click();
    await see(page, PERM_TITLE);
    await notSee(page, 'Review Receipt');
  });

  test('“Rescan” returns to the scanner', async ({ page }) => {
    await toReview(page);
    await button(page, 'Rescan').click();
    await see(page, PERM_TITLE);
    await notSee(page, 'Review Receipt');
  });

  test('Submit loading › spinner, Submit disabled/busy, Back and Rescan stay active', async ({ page }) => {
    await toReview(page);
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route(isApi('/api/receipts', null), async (r) => {
      if (r.request().method() !== 'POST') return r.fallback();
      await held;
      await r.fallback();
    });
    await button(page, 'Submit Receipt').click();
    const submit = page.getByRole('button', { name: 'Submit Receipt', exact: true }).filter({ visible: true }).first();
    await expect(submit).toBeDisabled();
    await expect(submit.getByRole('progressbar')).toBeVisible(); // label swapped for a spinner
    await expect(submit.getByText('Submit Receipt', { exact: true })).toHaveCount(0);
    await expect(button(page, 'Rescan')).toBeEnabled();
    await expect(button(page, 'Back')).toBeEnabled();
    release();
    await see(page, 'Submitted successfully!');
  });

  const submitErrors: [string, number, unknown, string, string?][] = [
    ['409 duplicate at submit', 409, { error: 'This receipt has already been redeemed.' }, 'This receipt has already been redeemed.'],
    ['422 unreadable at submit', 422, { error: "We couldn't read a valid receipt from that photo. Please scan a valid receipt or slip." }, "We couldn't read a valid receipt from that photo. Please scan a valid receipt or slip."],
    ['400 image too large', 400, { error: 'Image is too large' }, 'Image is too large'],
    ['401 not authenticated', 401, { error: 'Not authenticated' }, 'Not authenticated'],
    ['500 internal error', 500, { error: 'Internal server error' }, SERVER_MESSAGE], // Friendly errors (owner decision 24 Nov 2026): utils/errors.ts friendlyError.
    ['non-JSON timeout', 504, '<html>FUNCTION_INVOCATION_TIMEOUT</html>', SERVER_MESSAGE, 'text/html'], // Friendly errors (owner decision 24 Nov 2026): utils/errors.ts friendlyError.
  ];
  for (const [name, status, body, message, type] of submitErrors) {
    test(`Alert › “Couldn’t submit receipt” › ${name} shows “${message}”; OK stays on Review`, async ({ page }) => {
      await stubSubmit(page, body, status, type);
      await toReview(page);
      await button(page, 'Submit Receipt').click();
      const a = appAlert(page);
      await see(a, 'Couldn’t submit receipt');
      await see(a, message);
      await expect(a.getByRole('button')).toHaveCount(1);
      await button(a, 'OK').click();
      await expect(appAlert(page)).toHaveCount(0);
      await see(page, 'Review Receipt');
      await expect(button(page, 'Submit Receipt')).toBeEnabled();
    });
  }

  test('Alert › “Couldn’t submit receipt” › 500 through the mock fail switch; nothing is saved', async ({ page }) => {
    await scenario(page, { fail: { 'POST /api/receipts': 500 } });
    await toReview(page);
    await button(page, 'Submit Receipt').click();
    const a = appAlert(page);
    await see(a, 'Couldn’t submit receipt');
    await see(a, SERVER_MESSAGE); // Friendly errors (owner decision 24 Nov 2026): utils/errors.ts friendlyError.
    expect((await mockState(page)).receipts).toBe(4);
  });

  test('Alert › “Couldn’t submit receipt” › offline shows the friendly connection message', async ({ page }) => {
    await toReview(page);
    await page.route(isApi('/api/receipts', null), (r) => (r.request().method() === 'POST' ? r.abort('internetdisconnected') : r.fallback()));
    await button(page, 'Submit Receipt').click();
    const a = appAlert(page);
    await see(a, 'Couldn’t submit receipt');
    await see(a, NETWORK_MESSAGE); // Friendly errors (owner decision 24 Nov 2026): utils/errors.ts friendlyError.
    await button(a, 'OK').click();
    await see(page, 'Review Receipt');
  });

  test('Partial failure › receipt saved but a refresh call fails: the error alert shows anyway', async ({ page }) => {
    await toReview(page);
    await scenario(page, { fail: { 'GET /api/activity': 500 } });
    await button(page, 'Submit Receipt').click();
    const a = appAlert(page);
    await see(a, 'Couldn’t submit receipt');
    await see(a, SERVER_MESSAGE); // Friendly errors (owner decision 24 Nov 2026): utils/errors.ts friendlyError.
    expect((await mockState(page)).receipts).toBe(5); // saved on the server
    await button(a, 'OK').click();
    await see(page, 'Review Receipt');
  });

  test('Partial failure › tapping Submit again after the refresh failure gets 409 “This receipt has already been redeemed.”', async ({ page }) => {
    await toReview(page);
    await scenario(page, { fail: { 'GET /api/activity': 500 } });
    await button(page, 'Submit Receipt').click();
    await button(appAlert(page), 'OK').click();
    await button(page, 'Submit Receipt').click();
    await see(appAlert(page), 'This receipt has already been redeemed.');
  });

  test('Submit side effects › an approved submit adds the “Receipt scanned” activity row and the “Flagrr Cash earned” notification', async ({ page }) => {
    await toReview(page);
    await button(page, 'Submit Receipt').click();
    await button(page, 'View My Flagrr Cash').click(); // Brand words (owner decision 24 Nov 2026): kept board wording, no “balance”.
    await tab(page, 'Activity');
    await expect(page.getByText('Receipt scanned', { exact: true }).filter({ visible: true })).toHaveCount(3);
    await tab(page, 'Home');
    await page.getByRole('button', { name: /^Notifications/ }).click();
    await expect(page.getByText('You earned 196 Flagrr Cash from your receipt at Strand Golf Club.').filter({ visible: true })).toBeVisible();
  });

  test.skip('Review › “No image captured” thumbnail — not reachable on web: every web photo has a URI', async () => {});
  test.skip('Review › Reduce Motion (no Appear entrance) — animation only', async () => {});
});

// ======================================================================== Receipt Success

test.describe('Receipt Success', () => {
  test('Approved › hero, “+N FC”, “Submitted successfully!”, added line, info tile copy, both buttons; balance credited', async ({ page }) => {
    await toReview(page);
    const before = await mockState(page);
    await button(page, 'Submit Receipt').click();
    await see(page, 'Submitted successfully!');
    await see(page, 'Your reward');
    await expect(page.getByLabel('196 Flagrr Cash').filter({ visible: true })).toHaveText('+196 FC');
    await see(page, '196 Flagrr Cash added and ready to spend.'); // Brand words (owner decision 24 Nov 2026): kept board G-B-SuccessApproved wording, no “wallet” / “balance”.
    await see(page, 'Your new Flagrr Cash is ready to redeem on rewards at your club.'); // Brand words (owner decision 24 Nov 2026): kept board G-B-SuccessApproved wording, no “wallet” / “balance”.
    await see(page, 'Play more rounds, scan your receipts, and redeem rewards to unlock higher membership tiers and exclusive benefits.');
    await notSee(page, 'Your receipt is being reviewed');
    await notSee(page, 'This receipt was flagged for manual review', false);
    await expect(button(page, 'View My Flagrr Cash')).toBeVisible(); // Brand words (owner decision 24 Nov 2026): kept board wording, no “balance”.
    await expect(button(page, 'Submit Another Receipt')).toBeVisible();
    // No header / back button, no tab bar
    await expect(page.getByRole('button', { name: 'Back', exact: true }).filter({ visible: true })).toHaveCount(0);
    await expectNoTabBar(page);
    const after = await mockState(page);
    expect(after.receipts).toBe(before.receipts + 1);
    expect(after.scenario.balance).toBe(before.scenario.balance + 196);
  });

  test('Flagged › “Your receipt is being reviewed” pill and the flagged info copy; balance held', async ({ page }) => {
    await scenario(page, { flagged: true });
    await toReview(page);
    const before = await mockState(page);
    await button(page, 'Submit Receipt').click();
    await see(page, 'Submitted successfully!');
    await expect(page.getByLabel('196 Flagrr Cash').filter({ visible: true })).toHaveText('+196 FC');
    await see(page, 'Your receipt is being reviewed');
    // Brand words (owner decision 24 Nov 2026): kept board G-B-SuccessFlagged wording, no “balance”.
    await see(page, 'This receipt was flagged for manual review. Once approved, 196 Flagrr Cash will be added to your Flagrr Cash — no action is needed from you. You can check its status anytime under Profile > Receipt History.');
    await notSee(page, '196 Flagrr Cash added and ready to spend.'); // Brand words (owner decision 24 Nov 2026): kept board G-B-SuccessApproved wording, no “wallet” / “balance”.
    await notSee(page, 'Your new Flagrr Cash is ready to redeem', false); // Brand words (owner decision 24 Nov 2026): kept board G-B-SuccessApproved wording, no “wallet” / “balance”.
    const after = await mockState(page);
    expect(after.receipts).toBe(before.receipts + 1);
    expect(after.scenario.balance).toBe(before.scenario.balance);
  });

  test('Shows the preview figure from Review, not the server-confirmed one', async ({ page }) => {
    await stubScan(page, scanBody({ totalPointsAwarded: 250, grandTotal: 250 }));
    await toReview(page);
    await button(page, 'Submit Receipt').click(); // mock confirms 196
    await expect(page.getByLabel('250 Flagrr Cash').filter({ visible: true })).toHaveText('+250 FC');
    await see(page, '250 Flagrr Cash added and ready to spend.'); // Brand words (owner decision 24 Nov 2026): kept board G-B-SuccessApproved wording, no “wallet” / “balance”.
  });

  test('Zero FC › “+0 FC” and “0 Flagrr Cash added and ready to spend.”', async ({ page }) => {
    await stubScan(page, scanBody({ items: [], grandTotal: null, totalPointsAwarded: 0 }));
    await toReview(page);
    await button(page, 'Submit Receipt').click();
    await expect(page.getByLabel('0 Flagrr Cash', { exact: true }).filter({ visible: true })).toHaveText('+0 FC');
    await see(page, '0 Flagrr Cash added and ready to spend.'); // Brand words (owner decision 24 Nov 2026): kept board G-B-SuccessApproved wording, no “wallet” / “balance”.
  });

  test('“View My Flagrr Cash” leaves Success for the tabs, showing the credited balance; the new receipt is first in History', async ({ page }) => {
    await toReview(page);
    await button(page, 'Submit Receipt').click();
    await see(page, 'Submitted successfully!');
    await button(page, 'View My Flagrr Cash').click(); // Brand words (owner decision 24 Nov 2026): kept board wording, no “balance”.
    await notSee(page, 'Submitted successfully!');
    await expectTab(page, 'Home');
    await expect.poll(() => topText(page)).toMatch(/Flagrr Cash 12,676/); // 12,480 + 196
    // The new receipt is first: 5 rows, newest approved +196 FC first
    await tab(page, 'Profile');
    await vis(page, 'Receipt History').click();
    await expect(page.getByRole('button', { name: /^View photo of / }).filter({ visible: true })).toHaveCount(5);
    await see(row(page, 0), '+196 FC');
  });

  test('“View My Flagrr Cash” closes the scan flow and shows Home, even when scanning started on another tab', async ({ page }) => {
    await openSignedIn(page);
    await tab(page, 'Profile');
    await scanTabButton(page).click();
    await pickPhoto(page, 'Upload from gallery instead');
    await button(page, 'Submit Receipt').click();
    await see(page, 'Submitted successfully!');
    await button(page, 'View My Flagrr Cash').click(); // Brand words (owner decision 24 Nov 2026): kept board wording, no “balance”.
    await notSee(page, 'Submitted successfully!');
    // Owner decision 24 Nov 2026: Home, where the Flagrr Cash total is.
    await expectTab(page, 'Home');
  });

  test('“Submit Another Receipt” opens one fresh scanner; Close leaves the whole flow', async ({ page }) => {
    await toReview(page);
    await button(page, 'Submit Receipt').click();
    await button(page, 'Submit Another Receipt').click();
    await see(page, 'Scan Receipt');
    await see(page, PERM_TITLE);
    await notSee(page, 'Submitted successfully!');
    // One scanner only (owner decision 24 Nov 2026: match the prototype): Close returns to the tabs.
    await button(page, 'Close').click();
    await notSee(page, PERM_TITLE);
    await expectTab(page, 'Home');
  });

  test('“Receipt submitted” toast › after “View My Flagrr Cash” (owner-approved copy, prototype wording)', async ({ page }) => {
    await toReview(page);
    await button(page, 'Submit Receipt').click();
    await button(page, 'View My Flagrr Cash').click();
    await expectTab(page, 'Home');
    const toast = page.getByRole('alert').filter({ hasText: 'Receipt submitted' });
    await expect(toast).toBeVisible();
    await expect(toast).not.toContainText('once your club approves it');
  });

  test('“Receipt submitted” toast › flagged: “+N FC once your club approves it”', async ({ page }) => {
    await scenario(page, { flagged: true });
    await toReview(page);
    await button(page, 'Submit Receipt').click();
    await button(page, 'View My Flagrr Cash').click();
    const toast = page.getByRole('alert').filter({ hasText: 'Receipt submitted' });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('+196 FC once your club approves it');
  });

  test('“Receipt submitted” toast › not shown after “Submit Another Receipt”', async ({ page }) => {
    await toReview(page);
    await button(page, 'Submit Receipt').click();
    await button(page, 'Submit Another Receipt').click();
    await see(page, PERM_TITLE);
    await page.waitForTimeout(800); // longer than the 450 ms the toast waits after leaving Success
    await expect(page.getByRole('alert').filter({ hasText: 'Receipt submitted' })).toHaveCount(0);
  });

  test.skip('Success › back gesture returns to the camera (Review was replaced) — native only (swipe-back / Android back; the web build has no browser-history linking)', async () => {});
  test.skip('Success › count-up re-runs on refocus; Reduce Motion (no pop, count-up or pulse) — animation only', async () => {});
});

// ======================================================================== Receipt History

type Rc = { id: string; status: string; courseName: string; total: number; submittedAt: string; pointsAwarded: number | null; flagged: boolean; flagReason: string | null };
const rc = (id: string, status: string, courseName: string, total: number, daysAgo: number, pointsAwarded: number | null, flagged = false, flagReason: string | null = null): Rc => ({
  id, status, courseName, total, submittedAt: new Date(Date.now() - daysAgo * 86400000).toISOString(), pointsAwarded, flagged, flagReason,
});
function full(r: Rc) {
  return { imageUri: null, items: [], subtotal: r.total, tax: 0, receiptNumber: null, transactionNumber: null, tillNumber: null, receiptTime: null, ocrConfidence: 90, ...r };
}
/** Serve the member's receipt list (GET /api/receipts, loaded at app start) from the test. Returns a call counter. */
async function stubReceipts(page: Page, rows: Rc[]) {
  const calls = { n: 0 };
  await page.route(isApi('/api/receipts', null), (r) => {
    if (r.request().method() !== 'GET') return r.fallback();
    calls.n++;
    return fulfil(r, 200, rows.map(full));
  });
  return calls;
}
async function openHistory(page: Page) {
  await openSignedIn(page);
  await tab(page, 'Profile');
  await vis(page, 'Receipt History').click();
  await see(page, 'Receipt History');
}
async function fmtDate(page: Page, iso: string) {
  return page.evaluate((s) => new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }), iso);
}
/** Expected summary computed in the browser with the screen's own rules (device-local month). */
async function expectedSummary(page: Page, rows: { status: string; submittedAt: string; pointsAwarded: number | null }[]) {
  return page.evaluate((rs) => {
    const now = new Date();
    const m = rs.filter((r) => { const d = new Date(r.submittedAt); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
    const earned = m.reduce((s, r) => s + (r.status === 'approved' && r.pointsAwarded ? r.pointsAwarded : 0), 0);
    return { month: now.toLocaleDateString(undefined, { month: 'long' }), earned: earned.toLocaleString(), count: m.length };
  }, rows);
}
/** The block for one receipt row: from its title to its View Photo button. */
function row(page: Page, viewPhotoIndex: number) {
  return page.getByRole('button', { name: /^View photo of / }).filter({ visible: true }).nth(viewPhotoIndex).locator('xpath=../..');
}

test.describe('Receipt History', () => {
  test('Entry › Profile “Receipt History” row opens it; Back returns to Profile', async ({ page }) => {
    await openHistory(page);
    await expectNoTabBar(page);
    await button(page, 'Back').click();
    await notSee(page, 'Earned from receipts', false);
    await expectTab(page, 'Profile');
  });

  test('Seed list › summary (approved FC this month, count, month name), rows, pills, sublines and flagged note', async ({ page }) => {
    const res = await page.request.get(`${API}/api/receipts`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    const seed = (await res.json()) as Rc[];
    await openHistory(page);
    const s = await expectedSummary(page, seed);
    await see(page, `Earned from receipts · ${s.month}`);
    await see(page, `${s.earned} FC`);
    await see(page, String(s.count));
    await see(page, s.count === 1 ? 'receipt' : 'receipts');
    await expect(page.getByRole('button', { name: /^View photo of / }).filter({ visible: true })).toHaveCount(seed.length);
    // rc1: pending + flagged → Under review, "196 FC pending", flagged note with reason
    const r1 = row(page, 0);
    await see(r1, 'Strand Golf Club');
    await see(r1, `${await fmtDate(page, seed[0].submittedAt)} · R196.00`);
    await see(r1, 'Under review');
    await see(r1, '196 FC pending');
    await see(r1, "Flagged for manual review (unusual amount) — your Flagrr Cash will be added once it's approved.");
    // rc2: approved with FC → "+1,450 FC" (locale grouping), rand total without grouping
    const r2 = row(page, 1);
    await see(r2, `+${await page.evaluate(() => (1450).toLocaleString())} FC`);
    await see(r2, `${await fmtDate(page, seed[1].submittedAt)} · R1450.00`);
    await notSee(r2, 'Approved');
    // rc4: rejected, no FC → Rejected pill, no FC subline
    const r4 = row(page, 3);
    await see(r4, 'Rejected');
    await notSee(r4, / FC (earned|pending)$/, false);
  });

  test('Row states › Approved pill, Pending pill, raw status, “N FC pending/earned”, credited note (approved and rejected), no-reason note, Unrecognized merchant, R0.00', async ({ page }) => {
    const rows = [
      rc('a', 'approved', 'Approved Club', 100, 45, null),
      rc('b', 'pending', 'Pending Club', 80, 45, 80),
      rc('c', 'rejected', 'Rejected Club', 60, 45, 60),
      rc('d', 'approved', 'Flagged Approved Club', 700, 45, 700, true, 'unusually high Flagrr Cash awarded'),
      rc('e', 'rejected', 'Flagged Rejected Club', 50, 45, 50, true, null),
      rc('f', 'pending', 'Reasons Club', 30, 45, 30, true, 'low OCR confidence, rapid repeat submissions'),
      rc('g', 'held', '', 0, 45, null),
    ];
    await stubReceipts(page, rows);
    await openHistory(page);
    await see(row(page, 0), 'Approved');
    await notSee(row(page, 0), / FC/, false);
    await see(row(page, 1), 'Pending');
    await see(row(page, 1), '80 FC pending');
    await notSee(row(page, 1), 'Flagged for manual review', false);
    await see(row(page, 2), 'Rejected');
    await see(row(page, 2), '60 FC earned');
    await see(row(page, 3), '+700 FC');
    await see(row(page, 3), 'Flagged for manual review (unusually high Flagrr Cash awarded) — your Flagrr Cash has already been credited, no action is needed.');
    await see(row(page, 4), 'Rejected');
    await see(row(page, 4), '50 FC earned');
    await see(row(page, 4), 'Flagged for manual review — your Flagrr Cash has already been credited, no action is needed.');
    await see(row(page, 5), 'Under review');
    await see(row(page, 5), "Flagged for manual review (low OCR confidence, rapid repeat submissions) — your Flagrr Cash will be added once it's approved.");
    await see(row(page, 6), 'Unrecognized merchant');
    await see(row(page, 6), 'held');
    await see(row(page, 6), `${await fmtDate(page, rows[6].submittedAt)} · R0.00`);
    await expect(page.getByRole('button', { name: 'View photo of receipt', exact: true })).toBeVisible();
  });

  test('Summary › one receipt this month, pending: “0 FC” and singular “receipt”', async ({ page }) => {
    await stubReceipts(page, [rc('x', 'pending', 'Strand Golf Club', 120, 0, 120), rc('y', 'approved', 'Strand Golf Club', 900, 45, 900)]);
    await openHistory(page);
    const s = await expectedSummary(page, [rc('x', 'pending', '', 0, 0, 120)]);
    await see(page, `Earned from receipts · ${s.month}`);
    await see(page, '0 FC');
    await see(page, '1');
    await see(page, 'receipt');
    await notSee(page, 'receipts');
  });

  test('View Photo › opens “Receipt Photo” with subtitle (no “+” for pending) and the image; X closes it', async ({ page }) => {
    const res = await page.request.get(`${API}/api/receipts`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    const seed = (await res.json()) as Rc[];
    await openHistory(page);
    await page.getByRole('button', { name: 'View photo of Strand Golf Club' }).filter({ visible: true }).first().click();
    await see(page, 'Receipt Photo');
    await see(page, `Strand Golf Club · ${await fmtDate(page, seed[0].submittedAt)} · 196 FC`);
    await expect(page.getByLabel('Receipt photo', { exact: true }).filter({ visible: true })).toBeVisible();
    // X button (the last "Close"; the first is the backdrop)
    await page.getByRole('button', { name: 'Close', exact: true }).filter({ visible: true }).last().click();
    await notSee(page, 'Receipt Photo');
  });

  test('View Photo › approved subtitle has “+N FC” (no grouping); backdrop tap closes the sheet', async ({ page }) => {
    const res = await page.request.get(`${API}/api/receipts`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    const seed = (await res.json()) as Rc[];
    await openHistory(page);
    await page.getByRole('button', { name: 'View photo of Strand Golf Club' }).filter({ visible: true }).nth(1).click();
    await see(page, `Strand Golf Club · ${await fmtDate(page, seed[1].submittedAt)} · +1450 FC`);
    await page.mouse.click(195, 30); // backdrop, above the sheet
    await notSee(page, 'Receipt Photo');
  });

  test('View Photo › rejected receipt with no FC: subtitle has no FC part; unnamed merchant shows “Unrecognized merchant”', async ({ page }) => {
    const rows = [rc('n', 'rejected', '', 40, 45, null)];
    await stubReceipts(page, rows);
    await openHistory(page);
    await page.getByRole('button', { name: 'View photo of receipt', exact: true }).click();
    await see(page, `Unrecognized merchant · ${await fmtDate(page, rows[0].submittedAt)}`);
  });

  test('View Photo › no stored image shows “No photo was saved for this receipt.”', async ({ page }) => {
    await page.route(isApi('/api/receipts', 'image'), (r) => fulfil(r, 200, { imageData: null }));
    await openHistory(page);
    await page.getByRole('button', { name: /^View photo of / }).filter({ visible: true }).first().click();
    await see(page, 'Receipt Photo');
    await see(page, 'No photo was saved for this receipt.');
    await expect(page.getByLabel('Receipt photo', { exact: true }).filter({ visible: true })).toHaveCount(0);
  });

  test('View Photo › loading: that row’s link shows a spinner and is disabled until the photo arrives', async ({ page }) => {
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route(isApi('/api/receipts', 'image'), async (r) => { await held; await r.fallback(); });
    await openHistory(page);
    const link = page.getByRole('button', { name: /^View photo of / }).filter({ visible: true }).first();
    await link.click();
    await expect(link).toBeDisabled();
    await expect(link.getByText('View Photo', { exact: true })).toHaveCount(0);
    // Other rows stay enabled
    await expect(page.getByRole('button', { name: /^View photo of / }).filter({ visible: true }).nth(1)).toBeEnabled();
    release();
    await see(page, 'Receipt Photo');
  });

  for (const status of [500, 404, 401]) {
    test(`View Photo › error ${status} shows “Couldn’t load photo” / “Something went wrong. Please try again.” (server text hidden); OK dismisses`, async ({ page }) => {
      await page.route(isApi('/api/receipts', 'image'), (r) => fulfil(r, status, { error: status === 404 ? 'Receipt not found' : status === 401 ? 'Not authenticated' : 'Internal server error' }));
      await openHistory(page);
      await page.getByRole('button', { name: /^View photo of / }).filter({ visible: true }).first().click();
      const a = appAlert(page);
      await see(a, 'Couldn’t load photo');
      await see(a, 'Something went wrong. Please try again.');
      await notSee(a, /Receipt not found|Not authenticated|Internal server error/);
      await button(a, 'OK').click();
      await expect(appAlert(page)).toHaveCount(0);
      await notSee(page, 'Receipt Photo');
      await see(page, 'Receipt History');
    });
  }

  test('View Photo › mock fail switch on the image call shows “Couldn’t load photo”', async ({ page }) => {
    await scenario(page, { fail: { 'GET /api/receipts?action=image': 500 } });
    await openHistory(page);
    await page.getByRole('button', { name: /^View photo of / }).filter({ visible: true }).first().click();
    await see(appAlert(page), 'Couldn’t load photo');
  });

  test('View Photo › offline shows “Couldn’t load photo”', async ({ page }) => {
    await page.route(isApi('/api/receipts', 'image'), (r) => r.abort('internetdisconnected'));
    await openHistory(page);
    await page.getByRole('button', { name: /^View photo of / }).filter({ visible: true }).first().click();
    await see(appAlert(page), 'Couldn’t load photo');
    await see(appAlert(page), 'Something went wrong. Please try again.');
  });

  test('Empty › “No receipts yet” tile with copy; “Scan a receipt” opens Scan Receipt', async ({ page }) => {
    await scenario(page, { noReceipts: true });
    await openHistory(page);
    await see(page, 'No receipts yet');
    await see(page, 'No receipts yet — scan one from the Home screen to get started.');
    await notSee(page, 'Earned from receipts', false);
    await button(page, 'Scan a receipt').click();
    await see(page, 'Scan Receipt');
    await see(page, PERM_TITLE);
  });

  // Owner decision 24 Nov 2026 ("Refresh on open"): History calls GET /api/receipts each time it opens.
  test('Refresh on open › each opening of History calls GET /api/receipts again', async ({ page }) => {
    const calls = await stubReceipts(page, [rc('a', 'approved', 'Strand Golf Club', 100, 1, 100)]);
    await openSignedIn(page);
    await tab(page, 'Profile');
    await expect.poll(() => calls.n).toBeGreaterThanOrEqual(1); // loaded once at app start
    const start = calls.n;
    await vis(page, 'Receipt History').click();
    await see(page, '+100 FC');
    await expect.poll(() => calls.n).toBe(start + 1); // a fresh GET on open (owner decision 24 Nov 2026)
    await button(page, 'Back').click();
    await vis(page, 'Receipt History').click();
    await see(page, '+100 FC');
    await expect.poll(() => calls.n).toBe(start + 2); // and again on the next open (owner decision 24 Nov 2026)
  });

  test('Refresh on open › the list stays on screen while it refreshes, then shows the new status', async ({ page }) => {
    // App start: the receipt is under review. The refresh on open answers later with it approved.
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    const before = [rc('a', 'pending', 'Strand Golf Club', 100, 1, 100, true, 'low OCR confidence')];
    const after = [rc('a', 'approved', 'Strand Golf Club', 100, 1, 100, true, 'low OCR confidence')];
    let n = 0;
    await page.route(isApi('/api/receipts', null), async (r) => {
      if (r.request().method() !== 'GET') return r.fallback();
      n++;
      if (n === 1) return fulfil(r, 200, before.map(full));
      await held;
      return fulfil(r, 200, after.map(full));
    });
    await openHistory(page);
    // While the refresh is held: the app-start list is shown (no blank flash, no empty state)
    await expect.poll(() => n).toBe(2);
    await see(row(page, 0), 'Under review');
    await see(row(page, 0), '100 FC pending');
    await notSee(page, 'No receipts yet');
    release();
    // The refreshed list replaces it: approved, +100 FC, credited note
    await see(row(page, 0), '+100 FC');
    await notSee(row(page, 0), 'Under review');
    await see(row(page, 0), 'Flagged for manual review (low OCR confidence) — your Flagrr Cash has already been credited, no action is needed.');
  });

  test('Refresh on open › a failed refresh keeps the list loaded at app start (no alert)', async ({ page }) => {
    let n = 0;
    await page.route(isApi('/api/receipts', null), (r) => {
      if (r.request().method() !== 'GET') return r.fallback();
      n++;
      return n === 1 ? fulfil(r, 200, [rc('a', 'approved', 'Strand Golf Club', 100, 1, 100)].map(full)) : fulfil(r, 500, { error: 'Internal server error' });
    });
    await openHistory(page);
    await expect.poll(() => n).toBe(2);
    await see(row(page, 0), '+100 FC');
    await expect(appAlert(page)).toHaveCount(0);
  });

  test('View Photo › the photo opens full screen (owner decision: mockup layout) with its caption at the bottom', async ({ page }) => {
    await openHistory(page);
    await page.getByRole('button', { name: /^View photo of / }).filter({ visible: true }).first().click();
    await see(page, 'Receipt Photo');
    const img = page.getByLabel('Receipt photo', { exact: true }).filter({ visible: true });
    await expect(img).toBeVisible();
    const vp = page.viewportSize()!;
    const box = (await img.boundingBox())!;
    // Spans the screen width less the 20 pt side margins, and most of its height
    expect(Math.round(box.width)).toBe(vp.width - 40);
    expect(box.height).toBeGreaterThan(vp.height * 0.6);
    // Tapping on the photo itself also closes it (only the X is a control; taps fall through to the backdrop)
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await notSee(page, 'Receipt Photo');
  });

  test.skip('History › opening with a receiptId (a “Receipt scanned” row in Reward Activity) shows that receipt’s photo — not reachable yet: the Activity rows are wired in the rewards area', async () => {});

  test.skip('History sheet › closed by the system back gesture — native only', async () => {});
  test.skip('History › Reduce Motion — animation only', async () => {});
});

