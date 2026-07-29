// One-off tool to render the app against mocked API data and capture
// Play Store screenshots at phone/7"/10" tablet sizes, since this sandbox
// can't reach the live deployed API to drive a real authenticated session.
// Not part of the build — run manually, not wired into any npm script.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = process.argv[2] || '/tmp/store-screenshots';
fs.mkdirSync(OUT_DIR, { recursive: true });

const BANNER_DIR = '/tmp/claude-0/-home-user-flaggr/4772bb9d-f3b9-59a0-af89-9ee75510a9e5/scratchpad/adbanners';
const toDataUri = (p) => `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
const homeTopAd = toDataUri(path.join(BANNER_DIR, 'home-top.png'));
const homeAd = toDataUri(path.join(BANNER_DIR, 'home.png'));
const rewardsAd = toDataUri(path.join(BANNER_DIR, 'rewards.png'));

const user = {
  id: 'usr_demo',
  firstName: 'Jordan',
  lastName: 'van der Merwe',
  email: 'jordan@example.com',
  phone: '+27821234567',
  dateOfBirth: '1990-04-12',
  homeClub: 'Stellenbosch Golf Club',
  courseLogoUrl: null,
  courseId: 'course_demo',
  tier: 'Gold',
  memberSince: '2023-03-15',
  themePreference: 'light',
  verifiedMember: true,
};

const points = {
  balance: 2450,
  totalEarned: 5200,
  totalRedeemed: 2750,
  pointsToNextTier: 550,
  nextTier: 'Platinum',
  tierProgress: 0.82,
};

const streak = {
  weeks: 6,
  activeSince: '2026-06-01',
  weeksPlayed: [true, true, true, true, true, true],
  nextMilestoneWeeks: 8,
  nextMilestoneAmount: 100,
};

const stats = {
  period: 'year',
  roundsPlayed9: 14,
  roundsPlayed9DeltaPct: 12,
  roundsPlayed18: 9,
  roundsPlayed18DeltaPct: 8,
  bucksEarned: 5200,
  bucksEarnedDeltaPct: 18,
  bucksRedeemed: 2750,
  bucksRedeemedDeltaPct: 5,
  monthly: [
    { month: 'J', value: 320 }, { month: 'F', value: 410 }, { month: 'M', value: 380 },
    { month: 'A', value: 460 }, { month: 'M', value: 510 }, { month: 'J', value: 590 },
    { month: 'J', value: 640 }, { month: 'A', value: 470 }, { month: 'S', value: 520 },
    { month: 'O', value: 400 }, { month: 'N', value: 300 }, { month: 'D', value: 200 },
  ],
};

const ads = [
  { id: 'ad_top', placement: 'homeTop', title: 'Double Cash Weekend', imageUrl: homeTopAd, mediaType: 'image', targetUrl: null },
  { id: 'ad_home', placement: 'home', title: 'New Titleist Arrivals', imageUrl: homeAd, mediaType: 'image', targetUrl: null },
  { id: 'ad_rewards', placement: 'rewardsShop', title: 'Weekend Golf Special', imageUrl: rewardsAd, mediaType: 'image', targetUrl: null },
];

const rewardImg = (seed, hex) =>
  `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#${hex}"/></svg>`,
  ).toString('base64')}`;

const rewards = [
  { id: 'rw_1', title: '9 Hole Round', description: 'A round on the front nine', imageUrl: rewardImg(1, '1F4234'), category: 'rounds', variants: [{ id: 'v1', label: 'Weekday', randValue: 250, cost: 250 }] },
  { id: 'rw_2', title: 'Sleeve of Titleist Pro V1', description: '3-ball sleeve from the Pro Shop', imageUrl: rewardImg(2, '00805A'), category: 'pro-shop', variants: [{ id: 'v2', label: 'Standard', randValue: 180, cost: 180 }] },
  { id: 'rw_3', title: 'Halfway House Breakfast', description: 'Full breakfast at the halfway house', imageUrl: rewardImg(3, 'CDDE5C'), category: 'dining', variants: [{ id: 'v3', label: 'Combo', randValue: 120, cost: 120 }] },
  { id: 'rw_4', title: 'Bucket of Range Balls', description: 'Large bucket at the driving range', imageUrl: rewardImg(4, '1F4234'), category: 'practice', variants: [{ id: 'v4', label: 'Large', randValue: 60, cost: 60 }] },
  { id: 'rw_5', title: 'Guest Green Fee', description: 'Bring a guest around for 18 holes', imageUrl: rewardImg(5, '00805A'), category: 'experiences', variants: [{ id: 'v5', label: '18 Holes', randValue: 400, cost: 400 }] },
];

const vouchers = [
  { id: 'vc_1', rewardId: 'rw_2', rewardTitle: 'Sleeve of Titleist Pro V1', variantLabel: 'Standard', cost: 180, code: 'FLG-8421', status: 'active', qrValue: 'FLG-8421', issuedAt: '2026-07-20T10:00:00Z', expiresAt: '2026-08-20T10:00:00Z' },
];

const activity = [
  { id: 'a1', type: 'earn', title: 'Receipt scanned', subtitle: 'Stellenbosch Golf Club', amount: 340, voucherId: null, date: '2026-07-27T09:30:00Z' },
  { id: 'a2', type: 'redeem', title: 'Reward redeemed', subtitle: 'Sleeve of Titleist Pro V1', amount: -180, voucherId: 'vc_1', date: '2026-07-25T16:45:00Z' },
  { id: 'a3', type: 'earn', title: 'Receipt scanned', subtitle: 'Stellenbosch Golf Club', amount: 210, voucherId: null, date: '2026-07-22T14:12:00Z' },
  { id: 'a4', type: 'earn', title: 'Streak bonus', subtitle: '6-week streak milestone', amount: 100, voucherId: null, date: '2026-07-20T08:00:00Z' },
  { id: 'a5', type: 'redeem', title: 'Reward redeemed', subtitle: 'Bucket of Range Balls', amount: -60, voucherId: 'vc_2', date: '2026-07-17T11:20:00Z' },
  { id: 'a6', type: 'earn', title: 'Receipt scanned', subtitle: 'Stellenbosch Golf Club', amount: 480, voucherId: null, date: '2026-07-13T09:05:00Z' },
  { id: 'a7', type: 'earn', title: 'Receipt scanned', subtitle: 'Stellenbosch Golf Club', amount: 150, voucherId: null, date: '2026-07-08T15:40:00Z' },
  { id: 'a8', type: 'redeem', title: 'Reward redeemed', subtitle: 'Halfway House Breakfast', amount: -120, voucherId: 'vc_3', date: '2026-07-02T12:10:00Z' },
  { id: 'a9', type: 'earn', title: 'Receipt scanned', subtitle: 'Stellenbosch Golf Club', amount: 290, voucherId: null, date: '2026-06-28T10:30:00Z' },
];

const receipts = [
  { id: 'r1', imageUri: null, status: 'approved', courseName: 'Stellenbosch Golf Club', items: [{ label: 'Green Fee', amount: 340 }], subtotal: 340, tax: 0, total: 340, submittedAt: '2026-07-27T09:30:00Z', pointsAwarded: 340, receiptNumber: 'R-88213', transactionNumber: null, tillNumber: null, receiptTime: null, ocrConfidence: 92, flagged: false, flagReason: null },
];

const notifications = [
  { id: 'n1', title: 'Flagrr Cash earned', body: 'You earned 340 Flagrr Cash from your receipt at Stellenbosch Golf Club.', date: '2026-07-27T09:30:00Z', read: false, enquiryId: null },
];

function jsonRoute(route, body) {
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

async function setupMocks(page) {
  await page.route('**/api/**', (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const action = url.searchParams.get('action');

    if (p.endsWith('/auth/login') && req.method() === 'POST') {
      return jsonRoute(route, { token: 'demo-token', user });
    }
    if (p.endsWith('/me')) return jsonRoute(route, { user, points, streak, stats, ads });
    if (p.endsWith('/rewards')) return jsonRoute(route, rewards);
    if (p.endsWith('/vouchers')) return jsonRoute(route, vouchers);
    if (p.endsWith('/activity')) return jsonRoute(route, activity);
    if (p.endsWith('/receipts') && !action) return jsonRoute(route, receipts);
    if (p.endsWith('/notifications')) return jsonRoute(route, notifications);
    if (p.endsWith('/courses')) return jsonRoute(route, []);
    return jsonRoute(route, {});
  });
}

const DEVICES = [
  { name: 'phone', width: 1080, height: 1920 },
  { name: 'tablet7', width: 1200, height: 1920 },
  { name: 'tablet10', width: 1600, height: 2560 },
];

async function run() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  for (const device of DEVICES) {
    const context = await browser.newContext({ viewport: { width: device.width, height: device.height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await setupMocks(page);
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });

    await page.getByText('I already have an account').click();
    await page.getByPlaceholder('Email').fill('jordan@example.com');
    await page.getByPlaceholder('Password').fill('password123');
    await page.locator('text="Login"').last().click();

    await page.waitForSelector('text=Flagrr Cash', { timeout: 15000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, `${device.name}-1-home.png`) });

    await page.locator('[aria-label="Rewards"]').click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, `${device.name}-2-rewards.png`) });

    await page.locator('[aria-label="Activity"]').click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, `${device.name}-3-activity.png`) });

    await page.locator('[aria-label="Profile"]').click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, `${device.name}-4-profile.png`) });

    await context.close();
    console.log(`done: ${device.name}`);
  }
  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
