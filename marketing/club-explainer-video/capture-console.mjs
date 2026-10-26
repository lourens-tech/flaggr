// Renders the real course-admin console (and a couple of member screens)
// against mocked API data and screenshots them as source plates for the club
// explainer video. Same approach as mobile/scripts/capture-store-screenshots.mjs:
// the sandbox can't drive an authenticated session on the live API.
//
// Usage: (cd mobile && npx expo start --web --port 8081) then
//   node marketing/club-explainer-video/capture-console.mjs <outDir>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.argv[2] || path.join(HERE, 'plates');
fs.mkdirSync(OUT_DIR, { recursive: true });

const REWARD_IMG_DIR = path.join(HERE, '../../mobile/assets/images/rewards');
const AD_DIR = path.join(HERE, 'assets/ads');
const adImg = (f) => `data:image/png;base64,${fs.readFileSync(path.join(AD_DIR, f)).toString('base64')}`;
const img = (f) => `data:image/jpeg;base64,${fs.readFileSync(path.join(REWARD_IMG_DIR, f)).toString('base64')}`;

const course = {
  id: 'course_strand',
  name: 'Strand Golf Club',
  slug: 'strand',
  logoUrl: null,
  coverImageUrl: null,
  contactEmail: 'office@strandgolfclub.co.za',
  contactPhone: '+27 21 853 6268',
  address: 'Beach Road, Strand, 7140',
  fbPerRand: 1,
  onboardingCompletedAt: '2026-08-01T08:00:00Z',
  staffOnboardingCompletedAt: '2026-08-01T08:00:00Z',
  subscriptionStatus: 'active',
};

const admin = {
  id: 'adm_demo',
  firstName: 'Annelie',
  lastName: 'Botha',
  email: 'annelie@strandgolfclub.co.za',
  username: 'annelie',
  role: 'course_admin',
  mustChangePassword: false,
  themePreference: 'light',
};

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
const dashboard = {
  period: 'month',
  totals: {
    members: 642,
    newMembers: 58,
    fcEarned: 184350,
    fcEarnedDeltaPct: 23,
    fcRedeemed: 96200,
    fcRedeemedDeltaPct: 31,
    receiptsScanned: 1874,
    receiptsScannedDeltaPct: 19,
  },
  tierDistribution: [
    { tier: 'Bronze', count: 318 },
    { tier: 'Silver', count: 176 },
    { tier: 'Gold', count: 101 },
    { tier: 'Platinum', count: 47 },
  ],
  topRewards: [
    { rewardId: 'r1', title: '18-Hole Round', redemptions: 142, fcSpent: 63900 },
    { rewardId: 'r2', title: 'Halfway House Voucher', redemptions: 118, fcSpent: 17700 },
    { rewardId: 'r3', title: 'Pro Shop Voucher', redemptions: 74, fcSpent: 22200 },
    { rewardId: 'r4', title: 'Coaching Session', redemptions: 31, fcSpent: 15500 },
  ],
  signupsByMonth: months.map((month, i) => ({ month, value: [0, 0, 0, 0, 0, 0, 0, 212, 236, 194][i] })),
};

const variant = (id, label, randValue, cost) => ({ id, label, randValue, cost, sortOrder: 0, active: true });
const rewards = [
  { id: 'r1', title: '18-Hole Round', description: 'A full round on the Strand course.', imageUrl: img('18-hole-round.jpg'), category: 'Golf', active: true, variants: [variant('v1', 'Standard', null, 450)] },
  { id: 'r2', title: '9-Hole Round', description: 'Nine holes, any weekday.', imageUrl: img('9-hole-round.jpg'), category: 'Golf', active: true, variants: [variant('v2', 'Standard', null, 250)] },
  { id: 'r3', title: 'Pro Shop Voucher', description: 'Spend it on anything in the pro shop.', imageUrl: img('pro-shop-voucher.jpg'), category: 'Pro Shop', active: true, variants: [variant('v3', 'R100', 100, 100), variant('v4', 'R250', 250, 250), variant('v5', 'R500', 500, 500)] },
  { id: 'r4', title: 'Halfway House Voucher', description: 'Breakfast at the turn.', imageUrl: img('kitchen-voucher.jpg'), category: 'Kitchen', active: true, variants: [variant('v6', 'R150', 150, 150)] },
  { id: 'r5', title: 'Bar Voucher', description: 'A round on us at the 19th.', imageUrl: img('bar-voucher.jpg'), category: 'Bar', active: true, variants: [variant('v7', 'R100', 100, 100), variant('v8', 'R200', 200, 200)] },
  { id: 'r6', title: 'Coaching Session', description: '45 minutes with the club pro.', imageUrl: img('coaching-session.jpg'), category: 'Coaching', active: true, variants: [variant('v9', 'Standard', null, 500)] },
  { id: 'r7', title: 'Golf Cart Hire', description: 'Cart for one round.', imageUrl: img('golf-cart-hire.jpg'), category: 'Golf', active: true, variants: [variant('v10', 'Standard', null, 300)] },
  { id: 'r8', title: 'Driving Range Bucket', description: 'A large bucket of range balls.', imageUrl: img('driving-range.jpg'), category: 'Practice', active: true, variants: [variant('v11', 'Standard', null, 60)] },
];

const daysAgo = (d, h = 9) => new Date(Date.UTC(2026, 9, 25 - d, h, 15)).toISOString();
const broadcasts = [
  { id: 'b1', title: 'Tuesday tee times open', body: 'Slow afternoon on the course. Book a 9-hole round before 3pm and earn double Flagrr Cash.', target: 'all', recipientCount: 642, sentAt: daysAgo(1, 7) },
  { id: 'b2', title: 'Gold & Platinum: your bar voucher is waiting', body: 'Your quarterly R100 bar voucher has landed in the app.', target: 'Gold', recipientCount: 101, sentAt: daysAgo(4) },
  { id: 'b3', title: 'Club Championship entries close Friday', body: 'Enter at the pro shop. Every entry earns 200 Flagrr Cash.', target: 'all', recipientCount: 630, sentAt: daysAgo(9) },
];

const flagged = [
  { id: 'f1', courseId: course.id, courseName: course.name, memberId: 'm4', memberName: 'Megan Jacobs', memberEmail: 'megan@example.co.za', merchantName: 'Strand Golf Club Pro Shop', total: 4890, pointsAwarded: 4890, submittedAt: daysAgo(0, 8), flagReason: 'Unusually high points for one receipt', pointsCredited: false, memberFlagCount: 1, fraudConfirmedCount: 0 },
  { id: 'f2', courseId: course.id, courseName: course.name, memberId: 'm10', memberName: 'Charl Swart', memberEmail: 'charl@example.co.za', merchantName: 'Strand GC Halfway House', total: 186, pointsAwarded: 186, submittedAt: daysAgo(1, 13), flagReason: 'Low scan confidence', pointsCredited: true, memberFlagCount: 1, fraudConfirmedCount: 0 },
  { id: 'f3', courseId: course.id, courseName: course.name, memberId: 'm7', memberName: 'Johan du Plessis', memberEmail: 'johan@example.co.za', merchantName: 'Strand Golf Club', total: 620, pointsAwarded: 620, submittedAt: daysAgo(2, 16), flagReason: 'Rapid repeat submissions', pointsCredited: false, memberFlagCount: 2, fraudConfirmedCount: 0 },
];

function adminResponse(action) {
  switch (action) {
    case 'me': return { admin, course };
    case 'dashboard': return dashboard;
    case 'notifications': return [];
    case 'broadcasts': return broadcasts;
    case 'rewards': return rewards;
    case 'ads': return [];
    case 'catalogProducts': return [];
    case 'catalogActivities': return [];
    case 'flaggedReceipts': return flagged;
    case 'duplicateReceiptAttempts': return [];
    case 'enquiries': return [];
    case 'staffList': return [];
    case 'courseAdmins': return [];
    case 'staffRedemptions': return [];
    default: return [];
  }
}

const shots = [
  { name: 'console-dashboard', nav: null },
  { name: 'console-push', nav: 'Push Notifications' },
  { name: 'console-rewards', nav: 'Rewards' },
  { name: 'console-fraud', nav: 'Fraud Review' },
];

// React Navigation keeps earlier screens (and the hidden mobile tab bar)
// mounted, so most labels match more than once — act on the visible one.
async function visible(locator, { maxX = Infinity } = {}) {
  for (let i = 0; i < (await locator.count()); i++) {
    const el = locator.nth(i);
    const box = await el.boundingBox();
    if (box && box.width > 0 && box.x < maxX && (await el.isVisible())) return el;
  }
  throw new Error(`no visible match for ${locator}`);
}
async function clickVisible(page, locator, opts) {
  const box = await (await visible(locator, opts)).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
const page = await context.newPage();

page.on('pageerror', (e) => console.error('pageerror:', e.message));
await page.route('**/api/**', (route) => {
  const url = new URL(route.request().url());
  const action = url.searchParams.get('action') || '';
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(adminResponse(action)) });
});
await page.addInitScript(() => {
  localStorage.setItem('flagrr_admin_auth_token', 'demo-admin-token');
});
await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

for (const shot of shots) {
  if (shot.nav) {
    await clickVisible(page, page.getByText(shot.nav, { exact: true }), { maxX: 300 });
    await page.waitForTimeout(1800);
  }
  await page.screenshot({ path: path.join(OUT_DIR, `${shot.name}.png`) });
  console.log('captured', shot.name);
}

await context.close();

// Member side: the phone a golfer actually carries.
const member = {
  user: {
    id: 'usr_demo', firstName: 'Sipho', lastName: 'Dlamini', email: 'sipho@example.co.za', phone: '+27821234567',
    dateOfBirth: '1988-04-12', homeClub: course.name, courseLogoUrl: null, courseId: course.id, tier: 'Gold',
    memberSince: '2026-08-02', themePreference: 'light', verifiedMember: true,
  },
  points: { balance: 2240, totalEarned: 6180, totalRedeemed: 3940, pointsToNextTier: 3820, nextTier: 'Platinum', tierProgress: 0.62 },
  streak: { weeks: 7, activeSince: '2026-09-07', weeksPlayed: [true, true, true, true, true, true, true], nextMilestoneWeeks: 8, nextMilestoneAmount: 200 },
  stats: {
    period: 'year', roundsPlayed9: 9, roundsPlayed9DeltaPct: 12, roundsPlayed18: 14, roundsPlayed18DeltaPct: 22,
    bucksEarned: 6180, bucksEarnedDeltaPct: 18, bucksRedeemed: 3940, bucksRedeemedDeltaPct: 9,
    monthly: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((month, i) => ({ month, value: [0, 0, 0, 0, 0, 0, 0, 1650, 2210, 2320, 0, 0][i] })),
  },
  // Banners from make-ad-banners.py — a platform-wide Flagrr promo on Home,
  // a club competition in the Rewards Shop.
  ads: [
    { id: 'ad_home', placement: 'homeTop', title: 'Double Flagrr Cash Weekend', imageUrl: adImg('ad-platform-promo.png'), mediaType: 'image', targetUrl: null },
    { id: 'ad_rewards', placement: 'rewardsShop', title: 'October Medal', imageUrl: adImg('ad-club-competition.png'), mediaType: 'image', targetUrl: null },
  ],
};
const memberRewards = rewards.map(({ active, ...r }) => r);
const memberContext = await browser.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 3 });
const mpage = await memberContext.newPage();
await mpage.route('**/api/**', (route) => {
  const p = new URL(route.request().url()).pathname;
  const body = p.endsWith('/me') ? member : p.endsWith('/rewards') ? memberRewards : [];
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
});
await mpage.addInitScript(() => localStorage.setItem('flagrr_auth_token', 'demo-member-token'));
await mpage.goto('http://localhost:8081', { waitUntil: 'networkidle' });
await mpage.waitForTimeout(2500);
await mpage.screenshot({ path: path.join(OUT_DIR, 'member-home.png') });
console.log('captured member-home');
// The tab bar is icon-only; Rewards (gift) is the second icon.
await mpage.mouse.click(145, 803);
await mpage.waitForTimeout(1800);
await mpage.screenshot({ path: path.join(OUT_DIR, 'member-rewards.png') });
console.log('captured member-rewards');

await browser.close();
