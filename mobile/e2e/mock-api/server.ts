// Sample-data stand-in for the Flagrr API, used only by the automated
// click-through tests (mobile/e2e). It answers every call the member app makes
// (mobile/src/api/client.ts) with fixed sample data, and lets a test switch
// scenarios (duplicate slip, empty shop, failures…) through POST /api/__scenario.
// Golf uses the app's own course map, scoring and stats code, like the real API.
//
// Test-only credentials (not a real account): demo@flagrr.test / Golf2026!x
// Password reset code: 123456
//
// Run: npx tsx e2e/mock-api/server.ts   (from mobile/, port 4010, or E2E_API_PORT)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { layoutHoleIndexes, ratingFor, type CourseMapFile, type Gender, type Layout } from '../../src/golf/courseMap';
import { computeHandicaps, type RoundHole } from '../../src/golf/scoring';
import { computeGolfStats, type CompletedRound } from '../../src/golf/stats';
import type { GolfProfileDto, RoundDto } from '../../src/golf/dto';
import { periodWindow } from '../../../api/_lib/periods';

const PORT = Number(process.env.E2E_API_PORT ?? 4010);
const ROOT = path.resolve(__dirname, '../../..');
const IMG = path.join(ROOT, 'mobile/assets/images');
const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'course-maps/strand-golf-club.json'), 'utf8')) as CourseMapFile;

export const TEST_EMAIL = 'demo@flagrr.test';
export const TEST_PASSWORD = 'Golf2026!x';
export const RESET_CODE = '123456';
const TOKEN = 'e2e-demo-token';
const CLUB_ID = '11111111-1111-4111-8111-111111111111';
const PLACEHOLDER_ID = '99999999-9999-4999-8999-999999999999';
const OTHER_CLUB_ID = '44444444-4444-4444-8444-444444444444';
const COURSE_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const img = (f: string) => `http://localhost:${PORT}/img/${f}`;
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

// ---------------- scenario switches (POST /api/__scenario merges, /api/__reset restores) ----------------
type Scenario = {
  scan: 'normal' | 'dup' | 'invalid' | 'lowconf' | 'away' | 'issues' | 'error';
  slowScan: boolean; flagged: boolean; noReceipts: boolean; noRewards: boolean; noActivity: boolean; noNotifications: boolean;
  noEnquiries: boolean; placeholder: boolean; unverified: boolean; balance: number; topTier: boolean; noRounds: boolean;
  manyActivity: boolean; // seed 120 activity rows so the server's latest-100 cap shows
  resolvedEnquiry: boolean; // the seeded enquiry e1 is Resolved
  fail: Record<string, number>; // "METHOD /api/path?action=x" (or "/api/path") -> HTTP status to return
};
const DEFAULT_SCENARIO: Scenario = {
  scan: 'normal', slowScan: false, flagged: false, noReceipts: false, noRewards: false, noActivity: false, noNotifications: false,
  noEnquiries: false, placeholder: false, unverified: false, balance: 12480, topTier: false, noRounds: false, manyActivity: false, resolvedEnquiry: false, fail: {},
};
let scenario: Scenario = structuredClone(DEFAULT_SCENARIO);

// ---------------- sample data ----------------
// Golf settings are part of the seed: /api/__reset restores them so no test leaks an edited Index or format into the next.
const PROFILE_SEED: GolfProfileDto = { handicapIndex: 12.4, ratingGender: 'men', format: 'stableford', allowance: 0.95, bag: null, trackStats: false, shareWithClub: true };
let profile: GolfProfileDto = structuredClone(PROFILE_SEED);
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRound(teeId: string, gender: Gender, layout: Layout): RoundDto {
  const tee = map.tees.find((t) => t.id === teeId) ?? map.tees[0];
  const card = map.card[gender]!;
  const rating = ratingFor(map, tee.id, gender, layout)!;
  const idx = layoutHoleIndexes(map.holeCount, layout);
  const holes: RoundHole[] = idx.map((i) => ({ n: i + 1, par: card.par[i], si: card.si[i] as number, length: tee.lengths[i] as number }));
  const par = holes.reduce((s, h) => s + h.par, 0);
  const hc = profile.handicapIndex == null ? null : computeHandicaps(profile.handicapIndex, rating, par, holes.length, profile.allowance);
  return {
    id: randomUUID(), golfCourseId: COURSE_ID, courseName: map.name, teeId: tee.id, teeName: tee.name, teeColor: tee.color,
    ratingGender: gender, layout, format: profile.format, allowance: profile.allowance, handicapIndex: profile.handicapIndex,
    courseRating: rating.cr, slope: rating.slope, par, courseHandicap: hc?.course ?? null, playingHandicap: hc?.playing ?? null,
    holes, entries: holes.map(() => ({ s: null, putts: null, fw: null })), trackStats: profile.trackStats,
    status: 'in_progress', startedAt: new Date().toISOString(), completedAt: null,
  };
}
function seedRounds(): RoundDto[] {
  const out: RoundDto[] = [];
  const r = rng(20261109);
  for (let k = 0; k < 16; k++) {
    const round = makeRound(map.tees[0].id, 'men', 'full');
    const form = k === 15 ? -0.42 : (r() - 0.5) * 0.4 + 0.08 - k * 0.022;
    round.entries = round.holes.map((h) => {
      const hard = (19 - h.si) / 18;
      const x = r() + form + hard * 0.35;
      const over = x < 0.12 ? -1 : x < 0.45 ? 0 : x < 0.85 ? 1 : x < 1.1 ? 2 : 3;
      return { s: Math.max(2, h.par + over), putts: null, fw: null };
    });
    const done = new Date(Date.now() - (Math.round((15 - k) * 9.5 + r() * 3) + 1) * 86400000);
    done.setUTCHours(13, 30, 0, 0);
    round.startedAt = new Date(done.getTime() - 4.2 * 3600000).toISOString();
    round.completedAt = done.toISOString();
    round.status = 'completed';
    out.push(round);
  }
  return out;
}
const summary = { id: COURSE_ID, name: map.name, location: map.location, holeCount: map.holeCount, isHome: true, logoUrl: null };

const rewardsSeed = [
  { id: 'r18', title: '18 Hole Round', description: 'A round of 18 holes at your club.', imageUrl: img('rewards/18-hole-round.jpg'), category: 'rounds', variants: [{ id: 'v18', label: 'Standard', randValue: null, cost: 4200 }] },
  { id: 'r9', title: '9 Hole Round', description: 'A round of 9 holes at your club.', imageUrl: img('rewards/9-hole-round.jpg'), category: 'rounds', variants: [{ id: 'v9', label: 'Standard', randValue: null, cost: 2128 }] },
  { id: 'rc', title: 'Golf Cart Hire', description: 'One cart for a round.', imageUrl: img('rewards/golf-cart-hire.jpg'), category: 'experiences', variants: [{ id: 'vc', label: 'Standard', randValue: null, cost: 1540 }] },
  { id: 'rp', title: 'Pro Shop Voucher', description: 'Spend it in the pro shop.', imageUrl: img('rewards/pro-shop-voucher.jpg'), category: 'pro-shop',
    variants: [{ id: 'p250', label: 'Option A', randValue: null, cost: 1260 }, { id: 'p500', label: 'Option B', randValue: null, cost: 28000 }] },
];
const voucher = (id: string, rewardId: string, rewardTitle: string, variantLabel: string, cost: number, status: string, days: number) => ({
  id, rewardId, rewardTitle, variantLabel, cost, code: `FLGR-${id.toUpperCase()}-QX2M`, status, qrValue: `flagrr://voucher/${id}`, issuedAt: daysAgo(days), expiresAt: daysAgo(days - 90),
});
const receipt = (id: string, courseName: string, total: number, days: number, status: string, pts: number | null, flagged = false, flagReason: string | null = null) => ({
  id, imageUri: null, status, courseName, items: [], subtotal: total, tax: 0, total, submittedAt: daysAgo(days), pointsAwarded: pts,
  receiptNumber: null, transactionNumber: null, tillNumber: null, receiptTime: null, ocrConfidence: 90, flagged, flagReason,
});
// receiptId mirrors activity.receipt_id (migration 052): set on "Receipt scanned" rows the server links to their receipt.
const act = (id: string, type: string, title: string, amount: number, days: number, voucherId: string | null = null, receiptId: string | null = null) => ({ id, type, title, subtitle: 'Strand Golf Club', amount, voucherId, receiptId, date: daysAgo(days) });

let state = fresh();
function fresh() {
  return {
    rounds: seedRounds(),
    imageHashes: new Set<string>(), // like receipts.image_hash: an identical image is a duplicate
    rewards: structuredClone(rewardsSeed),
    vouchers: [
      voucher('v1', 'r9', '9 Hole Round', 'Standard', 2128, 'active', 1),
      voucher('v2', 'r18', '18 Hole Round', 'Standard', 4200, 'redeemed', 12),
      voucher('v3', 'rp', 'Pro Shop Voucher', 'Option A', 1260, 'expired', 120),
    ] as any[],
    receipts: [
      receipt('rc1', 'Strand Golf Club', 196, 0, 'pending', 196, true, 'unusual amount'),
      receipt('rc2', 'Strand Golf Club', 1450, 3, 'approved', 1450),
      receipt('rc3', 'Strand Golf Club', 890, 6, 'approved', 890),
      receipt('rc4', 'Strand Golf Club', 312, 10, 'rejected', null),
    ] as any[],
    activity: [
      act('a1', 'earn', 'Receipt scanned', 196, 0, null, 'rc1'),
      act('a2', 'redeem', '9 Hole Round redeemed', -2128, 1, 'v1'),
      act('a3', 'earn', 'Receipt scanned', 1450, 3, null, 'rc2'),
      act('a5', 'redeem', '18 Hole Round redeemed', -4200, 12, 'v2'),
      act('a6', 'redeem', 'Pro Shop Voucher redeemed', -1260, 120, 'v3'),
    ] as any[],
    notifications: [
      { id: 'n1', title: 'Flagrr Cash earned', body: 'Your receipt from Strand Golf Club earned Flagrr Cash.', date: daysAgo(0), read: false, enquiryId: null },
      { id: 'n2', title: 'Your club replied', body: 'Thanks, we have booked your tee time.', date: daysAgo(2), read: false, enquiryId: 'e1' },
      { id: 'n3', title: 'Welcome to Flagrr', body: 'Scan your receipts after your round to earn Flagrr Cash.', date: daysAgo(30), read: true, enquiryId: null },
    ] as any[],
    // Give Feedback submissions (support tickets, requester_type 'member') with the Flagrr team's replies,
    // as api/profile ?action=myFeedback / feedbackThread return them (owner decision 24 Nov 2026).
    feedback: [
      {
        id: 'fb1', category: 'improvement', status: 'in_progress', createdAt: daysAgo(4), updatedAt: daysAgo(1),
        messages: [
          { id: 'fm1', senderType: 'requester', body: 'Could the hole map show the distance to the back of the green too?', createdAt: daysAgo(4), readByRequester: true },
          { id: 'fm2', senderType: 'agent', body: 'Thanks for the idea. We have passed it to the team working on the hole maps.', createdAt: daysAgo(1), readByRequester: false },
        ],
      },
      {
        id: 'fb2', category: 'general_feedback', status: 'resolved', createdAt: daysAgo(25), updatedAt: daysAgo(21),
        messages: [
          { id: 'fm3', senderType: 'requester', body: 'Love the new scorecard.', createdAt: daysAgo(25), readByRequester: true },
          { id: 'fm4', senderType: 'agent', body: 'Glad you like it, thanks for telling us.', createdAt: daysAgo(21), readByRequester: true },
        ],
      },
    ] as any[],
    enquiries: [
      { id: 'e1', enquiryType: 'Bookings', status: 'in_progress', createdAt: daysAgo(3), updatedAt: daysAgo(2), lastMessage: 'Thanks, we have booked your tee time.', hasUnread: true,
        messages: [
          { id: 'm1', senderType: 'member', body: 'Can I book a tee time for Saturday morning?', createdAt: daysAgo(3) },
          { id: 'm2', senderType: 'admin', body: 'Thanks, we have booked your tee time.', createdAt: daysAgo(2) },
        ] },
    ] as any[],
    prefs: { accountActivity: true, supportReplies: true, announcements: false },
    user: {
      id: USER_ID, firstName: 'Sam', lastName: 'Mokoena', email: TEST_EMAIL, phone: '0820000000', dateOfBirth: '1990-05-04',
      homeClub: 'Strand Golf Club', courseLogoUrl: null, courseId: CLUB_ID, tier: 'Gold', memberSince: '2026-08-01',
      themePreference: 'light', verifiedMember: true, isPlaceholderClub: false,
    } as any,
    password: TEST_PASSWORD,
    resetRequested: false,
  };
}

const ads = [
  { id: 'ad1', placement: 'homeTop', title: 'Sample advert', imageUrl: img('strand-golf-club-fairway.jpg'), mediaType: 'image', targetUrl: null },
  { id: 'ad2', placement: 'home', title: 'Sample advert 2', imageUrl: img('strand-golf-club-fairway.jpg'), mediaType: 'image', targetUrl: null },
  { id: 'ad3', placement: 'rewardsShop', title: 'Sample advert 3', imageUrl: img('strand-golf-club-fairway.jpg'), mediaType: 'image', targetUrl: null },
];
const monthly = [
  { month: 'J', value: 3150 }, { month: 'J', value: 4020 }, { month: 'A', value: 3480 },
  { month: 'S', value: 5260 }, { month: 'O', value: 9004 }, { month: 'N', value: 4210 },
];

function item(description: string, quantity: number, price: number, matchedName: string | null, pointsAwarded: number) {
  return { description, quantity, price, matchedProductId: matchedName ? 'p' : null, matchedActivityId: null, matchedName, pointsAwarded };
}
function scanResult(): [number, unknown] {
  const kind = scenario.scan;
  if (kind === 'error') return [500, { error: 'Internal server error' }];
  if (kind === 'dup') return [200, { isDuplicate: true, reason: 'This receipt has already been redeemed.' }];
  if (kind === 'invalid') return [200, { isDuplicate: false, invalid: true, reason: "We couldn't read a valid receipt from that photo. Please scan a valid receipt or slip." }];
  const base = { isDuplicate: false, invalid: false, ocrConfidence: kind === 'lowconf' ? 40 : 92, merchantNameGuess: null, receiptNumber: '004817', transactionNumber: null, tillNumber: null, date: '2026-11-24', time: '12:48', subtotal: null, vat: null, subtotalPoints: 0, nonParticipatingClub: false };
  if (kind === 'away') return [200, { ...base, merchant: { id: 'm2', name: 'Away Golf Club', merchantType: 'golf_shop', courseId: OTHER_CLUB_ID }, items: [item('Green fee, 18 holes', 1, 650, null, 650)], grandTotal: 650, totalPointsAwarded: 650, awayClub: true, pointsBasis: 'total' }];
  if (kind === 'issues') return [200, { ...base, merchant: { id: 'm1', name: 'Strand Golf Club', merchantType: 'halfway_house', courseId: CLUB_ID }, items: [item('Castle Lite 330ml', 2, 68, 'Castle Lite 330ml', 68), item('Gift card', 1, 200, null, 0)], grandTotal: 268, totalPointsAwarded: 68, awayClub: false, pointsBasis: 'items' }];
  return [200, { ...base, merchant: { id: 'm1', name: 'Strand Golf Club', merchantType: 'halfway_house', courseId: CLUB_ID }, items: [item('Castle Lite 330ml', 2, 68, 'Castle Lite 330ml', 68), item('Pizza', 1, 110, 'Pizza', 110), item('Water Still', 1, 18, 'Water Still', 18)], grandTotal: 196, totalPointsAwarded: 196, awayClub: false, pointsBasis: 'items' }];
}

function me(period: string) {
  const s = state;
  const top = scenario.topTier;
  return {
    user: { ...s.user, tier: top ? 'Platinum' : s.user.tier, isPlaceholderClub: scenario.placeholder, verifiedMember: !scenario.unverified,
            homeClub: scenario.placeholder ? "My Club Isn't Listed Yet" : s.user.homeClub, courseId: scenario.placeholder ? PLACEHOLDER_ID : s.user.courseId },
    points: { balance: scenario.balance, totalEarned: 24800, totalRedeemed: 12320, pointsToNextTier: top ? 0 : 1786, nextTier: top ? null : 'Platinum', tierProgress: top ? 1 : 0.64 },
    streak: { weeks: 4, activeSince: '2026-10-12', weeksPlayed: [true, false, true, true, true, true, true, true], nextMilestoneWeeks: 6, nextMilestoneAmount: 100 },
    stats: { period, roundsPlayed9: 2, roundsPlayed9DeltaPct: 50, roundsPlayed18: 16, roundsPlayed18DeltaPct: 22, bucksEarned: 9860, bucksEarnedDeltaPct: -53, bucksRedeemed: 6320, bucksRedeemedDeltaPct: 100, monthly },
    ads: scenario.placeholder ? [] : ads,
  };
}

function golf(action: string, method: string, q: URLSearchParams, body: any): [number, unknown] {
  const rounds = scenario.noRounds ? [] : state.rounds;
  const inProgress = state.rounds.find((x) => x.status === 'in_progress') ?? null;
  if (action === 'golfHome') return [200, { clubName: 'Strand Golf Club', isPlaceholderClub: scenario.placeholder, homeCourse: scenario.placeholder ? null : summary, courses: [summary], recentCourseIds: [COURSE_ID], inProgress, profile }];
  if (action === 'golfCourse') return [200, { ...summary, map }];
  if (action === 'golfProfile') { if (method === 'POST') Object.assign(profile, body); return [200, profile]; }
  if (action === 'golfRoundStart') {
    if (inProgress) return [409, { error: 'You already have a round in progress. Finish or discard it first.' }];
    if (body.format) profile.format = body.format;
    if (body.allowance) profile.allowance = body.allowance;
    if (body.gender) profile.ratingGender = body.gender;
    const round = makeRound(body.teeId, body.gender ?? 'men', body.layout ?? 'full');
    state.rounds.push(round);
    return [200, round];
  }
  if (action === 'golfRound') { const x = state.rounds.find((r) => r.id === q.get('id')); return x ? [200, x] : [404, { error: 'Round not found.' }]; }
  if (action === 'golfRoundSave' || action === 'golfRoundFinish') {
    const x = state.rounds.find((r) => r.id === body.id); if (!x) return [404, { error: 'Round not found.' }];
    const complete = action === 'golfRoundFinish' || x.status === 'completed';
    const played = (body.entries as Array<{ s: number | null }>).filter((e) => e?.s != null).length;
    if (complete && played !== x.holes.length) return [400, { error: `Enter a score (or a pick-up) on every hole before finishing. ${x.holes.length - played} to go.` }];
    x.entries = body.entries;
    if (action === 'golfRoundFinish') { x.status = 'completed'; x.completedAt = new Date().toISOString(); }
    return [200, x];
  }
  if (action === 'golfRoundDelete') { const i = state.rounds.findIndex((r) => r.id === body.id); if (i >= 0) state.rounds.splice(i, 1); return [200, { ok: true }]; }
  if (action === 'golfStats') {
    const period = (q.get('period') as 'month' | 'year' | 'all') ?? 'year';
    const { currentStart } = periodWindow(period);
    const done = rounds.filter((r) => r.status === 'completed' && new Date(r.completedAt!) >= currentStart);
    const cr: CompletedRound[] = done.map((r) => ({
      id: r.id, completedAt: r.completedAt!, golfCourseId: r.golfCourseId, courseName: r.courseName, teeName: r.teeName, teeColor: r.teeColor,
      holes: r.holes, entries: r.entries,
      handicaps: r.courseHandicap == null || r.playingHandicap == null ? null : { course: r.courseHandicap, playing: r.playingHandicap },
    }));
    return [200, { period, clubName: 'Strand Golf Club', homeMapLive: true, anyCourseLive: true, isPlaceholderClub: scenario.placeholder, totalRounds: rounds.filter((r) => r.status === 'completed').length, handicapIndex: profile.handicapIndex, trackStats: profile.trackStats, shareWithClub: profile.shareWithClub, stats: computeGolfStats(cr, COURSE_ID) }];
  }
  return [404, { error: 'Unknown action' }];
}

function route(p: string, method: string, q: URLSearchParams, body: any, authed: boolean): [number, unknown] {
  const action = q.get('action') ?? '';
  const s = state;
  // test controls
  if (p === '/api/__reset') { profile = structuredClone(PROFILE_SEED); state = fresh(); scenario = structuredClone(DEFAULT_SCENARIO); return [200, { ok: true }]; }
  if (p === '/api/__scenario') {
    scenario = { ...scenario, ...body, fail: { ...scenario.fail, ...(body?.fail ?? {}) } };
    if (body?.resolvedEnquiry) { const e = state.enquiries.find((x) => x.id === 'e1'); if (e) e.status = 'resolved'; }
    return [200, scenario];
  }
  if (p === '/api/__state') return [200, { scenario, rounds: s.rounds.length, vouchers: s.vouchers.length, receipts: s.receipts.length }];

  // signed-out calls
  if (p === '/api/courses' && !action) return [200, [
    { id: CLUB_ID, name: 'Strand Golf Club', slug: 'strand-golf-club', logoUrl: null, isPlaceholder: false },
    { id: OTHER_CLUB_ID, name: 'Sample Links Golf Club', slug: 'sample-links', logoUrl: null, isPlaceholder: false },
    { id: PLACEHOLDER_ID, name: "My Club Isn't Listed Yet", slug: 'not-listed', logoUrl: null, isPlaceholder: true },
  ]];
  if (p === '/api/auth/login' && !action) {
    if (String(body.email ?? '').toLowerCase() !== TEST_EMAIL || body.password !== s.password) return [401, { error: 'Invalid email or password' }];
    return [200, { token: TOKEN, user: me('year').user }];
  }
  if (p === '/api/auth/login' && action === 'forgotPassword') { s.resetRequested = true; return [200, { ok: true }]; }
  if (p === '/api/auth/login' && action === 'resetPassword') {
    if (body.code !== RESET_CODE) return [400, { error: 'That code is invalid or has expired' }];
    s.password = body.newPassword; return [200, { ok: true }];
  }
  if (p === '/api/auth/signup') {
    if (String(body.email ?? '').toLowerCase() === TEST_EMAIL) return [409, { error: 'An account with this email already exists' }];
    s.user = { ...s.user, firstName: body.firstName, lastName: body.lastName, email: body.email, phone: body.phone ?? '', dateOfBirth: body.dateOfBirth ?? null, tier: 'Bronze' };
    s.password = body.password;
    return [200, { token: TOKEN, user: me('year').user }];
  }
  if (!authed) return [401, { error: 'Not authenticated' }];

  if (p === '/api/me') return [200, me(q.get('period') ?? 'year')];
  if (p === '/api/rewards') return [200, scenario.noRewards || scenario.placeholder ? [] : s.rewards];
  if (p === '/api/redeem') {
    const r = s.rewards.find((x) => x.id === body.rewardId); const v = r?.variants.find((x: any) => x.id === body.variantId);
    if (!r || !v) return [404, { error: 'Reward not found' }];
    if (v.cost > scenario.balance) return [400, { error: 'Not enough Flagrr Cash' }];
    const nv = voucher(`n${s.vouchers.length + 1}`, r.id, r.title, v.label, v.cost, 'active', 0);
    s.vouchers.unshift(nv); scenario.balance -= v.cost;
    s.activity.unshift(act(`a${Date.now()}`, 'redeem', `${r.title} redeemed`, -v.cost, 0, nv.id));
    return [200, { ...nv, balance: scenario.balance }];
  }
  if (p === '/api/vouchers') return [200, s.vouchers];
  if (p === '/api/activity') {
    if (scenario.noActivity) return [200, []];
    const extra = scenario.manyActivity ? Array.from({ length: 120 }, (_, i) => act(`ax${i}`, 'earn', 'Receipt scanned', 100 + i, 200 + i)) : [];
    return [200, [...s.activity, ...extra].slice(0, 100)]; // api/activity: newest first, limit 100
  }
  if (p === '/api/notifications' && action === 'read') { const n = s.notifications.find((x) => x.id === body.id); if (n) n.read = true; return [200, { ok: true }]; }
  if (p === '/api/notifications') return [200, scenario.noNotifications ? [] : s.notifications];
  if (p === '/api/receipts') {
    if (action === 'image') return [200, { imageData: `data:image/jpeg;base64,${fs.readFileSync(path.join(IMG, 'rewards/pro-shop-voucher.jpg')).toString('base64')}` }];
    if (action === 'scan') return scanResult();
    if (method === 'POST') {
      // api/receipts: an image already submitted is a duplicate (image hash), 409.
      const hash = createHash('sha256').update(String(body.imageBase64 ?? '')).digest('hex');
      if (s.imageHashes.has(hash)) return [409, { error: 'This receipt has already been redeemed.' }];
      s.imageHashes.add(hash);
      const r = receipt(`rc${s.receipts.length + 1}`, 'Strand Golf Club', 196, 0, scenario.flagged ? 'pending' : 'approved', 196, scenario.flagged, scenario.flagged ? 'unusual amount' : null);
      s.receipts.unshift(r);
      if (!scenario.flagged) {
        // Unflagged: balance, a "Receipt scanned" activity row and a "Flagrr Cash earned" notification, as the server does.
        scenario.balance += 196;
        s.activity.unshift(act(`a${Date.now()}`, 'earn', 'Receipt scanned', 196, 0, null, r.id));
        s.notifications.unshift({ id: `n${Date.now()}`, title: 'Flagrr Cash earned', body: 'You earned 196 Flagrr Cash from your receipt at Strand Golf Club.', date: daysAgo(0), read: false, enquiryId: null });
      }
      return [200, r];
    }
    return [200, scenario.noReceipts ? [] : s.receipts];
  }
  if (p === '/api/courses' && action.startsWith('golf')) return golf(action, method, q, body);
  if (p === '/api/profile') {
    if (!action && method === 'POST') { s.user.avatarUrl = img('strand-golf-club-fairway.jpg'); return [200, { avatarUrl: s.user.avatarUrl }]; }
    if (action === 'update') { Object.assign(s.user, body, { phone: body.phone?.trim() || null, dateOfBirth: body.dateOfBirth?.trim() || null }); return [200, me('year').user]; }
    if (action === 'changeClub') {
      const name = body.courseId === OTHER_CLUB_ID ? 'Sample Links Golf Club' : body.courseId === PLACEHOLDER_ID ? "My Club Isn't Listed Yet" : 'Strand Golf Club';
      s.user.courseId = body.courseId; s.user.homeClub = name; return [200, { courseId: body.courseId, homeClub: name }];
    }
    if (action === 'contact') {
      const e = { id: `e${s.enquiries.length + 1}`, enquiryType: body.enquiryType || 'General', status: 'pending', createdAt: daysAgo(0), updatedAt: daysAgo(0), lastMessage: body.message, hasUnread: false,
        messages: [{ id: randomUUID(), senderType: 'member', body: body.message, createdAt: daysAgo(0) }] };
      s.enquiries.unshift(e); return [200, { ok: true, enquiryId: e.id }];
    }
    if (action === 'feedbackCreate') {
      const id = `fb${s.feedback.length + 1}`;
      s.feedback.unshift({ id, category: body.category, status: 'open', createdAt: daysAgo(0), updatedAt: daysAgo(0), messages: [{ id: `${id}m1`, senderType: 'requester', body: String(body.message ?? '').trim(), createdAt: daysAgo(0), readByRequester: true }] });
      return [200, { ok: true, ticketId: id }];
    }
    if (action === 'myFeedback') {
      return [200, s.feedback.map((f) => ({
        id: f.id, category: f.category, status: f.status, createdAt: f.createdAt, updatedAt: f.updatedAt,
        lastMessage: f.messages[f.messages.length - 1]?.body ?? null, hasUnread: f.messages.some((m: any) => !m.readByRequester),
      }))];
    }
    if (action === 'feedbackThread') {
      const f = s.feedback.find((x) => x.id === q.get('id'));
      if (!f) return [404, { error: 'Feedback not found' }];
      f.messages.forEach((m: any) => { m.readByRequester = true; }); // opening the thread marks replies read, as the server does
      return [200, { id: f.id, category: f.category, status: f.status, createdAt: f.createdAt, messages: f.messages.map(({ readByRequester, ...m }: any) => m) }];
    }
    if (action === 'feedbackReply') {
      // The member's reply (owner decision 25 Nov 2026); a resolved thread reopens ('open'), as the server does.
      const f = s.feedback.find((x) => x.id === body.ticketId);
      const text = String(body.message ?? '').trim();
      if (!text) return [400, { error: 'message is required' }];
      if (!f) return [404, { error: 'Feedback not found' }];
      f.messages.push({ id: `${f.id}r${f.messages.length + 1}`, senderType: 'requester', body: text, createdAt: daysAgo(0), readByRequester: true });
      f.updatedAt = daysAgo(0);
      if (f.status === 'resolved') f.status = 'open';
      s.feedback = [f, ...s.feedback.filter((x) => x !== f)];
      return [200, { id: f.id, category: f.category, status: f.status, createdAt: f.createdAt, messages: f.messages.map(({ readByRequester, ...m }: any) => m) }];
    }
    if (action === 'referralInfo') return [200, { code: 'FLG7K2', memberBonus: 15, courseBonus: 500, redeemedCount: 2, maxRedemptions: 10 }];
    if (action === 'myEnquiries') return [200, scenario.noEnquiries ? [] : s.enquiries.map(({ messages, ...rest }) => rest)];
    if (action === 'enquiryThread') { const e = s.enquiries.find((x) => x.id === q.get('id')); if (e) e.hasUnread = false; return e ? [200, { id: e.id, status: e.status, enquiryType: e.enquiryType, messages: e.messages }] : [404, { error: 'Enquiry not found' }]; }
    if (action === 'enquiryReply') {
      const e = s.enquiries.find((x) => x.id === body.enquiryId); if (!e) return [404, { error: 'Enquiry not found' }];
      e.messages.push({ id: randomUUID(), senderType: 'member', body: body.message, createdAt: new Date().toISOString() }); e.lastMessage = body.message;
      e.updatedAt = new Date().toISOString(); if (e.status === 'resolved') e.status = 'pending'; // _lib/enquiries.ts: a member reply reopens a resolved enquiry
      return [200, e.messages];
    }
    if (action === 'adClick' || action === 'adImpression' || action === 'registerPushToken') return [200, { ok: true }];
    if (action === 'themePreference') { s.user.themePreference = body.preference; return [200, { themePreference: body.preference }]; }
    if (action === 'notificationPreferences') return [200, s.prefs];
    if (action === 'updateNotificationPreferences') { s.prefs = { ...s.prefs, ...body }; return [200, s.prefs]; }
    if (action === 'changePassword') {
      if (body.currentPassword !== s.password) return [401, { error: 'Current password is incorrect' }];
      s.password = body.newPassword; return [200, { ok: true }];
    }
    if (action === 'deleteAccount') { if (body.password !== s.password) return [401, { error: 'Current password is incorrect' }]; return [200, { ok: true }]; }
    if (action === 'exportMyData') return [200, { user: s.user, receipts: s.receipts, vouchers: s.vouchers, activity: s.activity }];
  }
  return [404, { error: `Mock has no route for ${method} ${p}?action=${action}` }];
}

http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (url.pathname.startsWith('/img/')) {
    const f = path.normalize(path.join(IMG, url.pathname.slice(5)));
    if (!f.startsWith(IMG) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': f.endsWith('.png') ? 'image/png' : 'image/jpeg' });
    fs.createReadStream(f).pipe(res);
    return;
  }
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', async () => {
    let body: any = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { /* ignore */ }
    const method = req.method ?? 'GET';
    const key = `${method} ${url.pathname}${url.searchParams.get('action') ? `?action=${url.searchParams.get('action')}` : ''}`;
    const failStatus = scenario.fail[key] ?? scenario.fail[url.pathname];
    if (failStatus) { res.writeHead(failStatus, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Internal server error' })); return; }
    if (scenario.slowScan && url.searchParams.get('action') === 'scan') await new Promise((r) => setTimeout(r, 4000));
    const authed = req.headers.authorization === `Bearer ${TOKEN}`;
    const [status, data] = route(url.pathname, method, url.searchParams, body, authed);
    if (process.env.E2E_API_LOG) console.log(method, url.pathname + url.search, status);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  });
}).listen(PORT, () => console.log(`flagrr e2e mock api on http://localhost:${PORT}`));
