import type {
  ActivityEntry,
  AppNotification,
  MemberTier,
  PointsAccount,
  Receipt,
  Reward,
  Stats,
  Streak,
  User,
  Voucher,
} from './types';

export const mockUser: User = {
  id: 'u_001',
  firstName: 'Rory',
  lastName: 'Kirby',
  email: 'roryk@gmail.com',
  phone: '082 764 5563',
  homeClub: 'Strand Golf Club',
  tier: 'Gold',
  memberSince: '1988-06-10',
};

export const mockPointsAccount: PointsAccount = {
  balance: 15240,
  totalEarned: 5730,
  totalRedeemed: 3260,
  pointsToNextTier: 4760,
  nextTier: 'Platinum',
  tierProgress: 0.61,
};

export const mockStreak: Streak = {
  weeks: 9,
  activeSince: '2026-03-01',
  weeksPlayed: [true, true, true, true, true, true, true, true, true],
};

export const mockStats: Stats = {
  roundsPlayed9: 38,
  roundsPlayed9DeltaPct: 5,
  roundsPlayed18: 24,
  roundsPlayed18DeltaPct: 3,
  bucksEarned: 5730,
  bucksEarnedDeltaPct: 12,
  bucksRedeemed: 3260,
  bucksRedeemedDeltaPct: -3,
  monthly: [
    { month: 'J', value: 380 },
    { month: 'F', value: 210 },
    { month: 'M', value: 490 },
    { month: 'A', value: 620 },
    { month: 'M', value: 580 },
    { month: 'J', value: 150 },
  ],
};

export const memberTiers: MemberTier[] = [
  {
    name: 'Bronze',
    minPoints: 0,
    perks: ['Earn 1 Flagrr Buck per $1 spent', 'Birthday reward', 'Member pricing on pro-shop items'],
  },
  {
    name: 'Silver',
    minPoints: 5000,
    perks: ['1.1x Flagrr Bucks on every round', 'Early access to tee times', 'Member-only clinics'],
  },
  {
    name: 'Gold',
    minPoints: 10480,
    perks: [
      'Enhanced Earning — Earn 25% more Flagrr Bucks on qualifying rounds, promotions, and in-app activities.',
      'Premium Rewards Access — Get early access to limited rewards and seasonal promotions before they become available to other players.',
      'Guest Reward Voucher — Receive special guest vouchers that can be redeemed for selected club benefits or shared with friends.',
    ],
  },
  {
    name: 'Platinum',
    minPoints: 20000,
    perks: ['1.5x Flagrr Bucks on every round', 'Complimentary cart hire', 'Unlimited guest rounds', 'Dedicated concierge line'],
  },
];

export const mockRewards: Reward[] = [
  {
    id: 'r_guest_round',
    title: 'Guest Round',
    description: 'Enjoy exclusive cinema screening for members.',
    imageUrl: 'https://images.unsplash.com/photo-1587174786738-5699a41ba0c2?w=600',
    cost: 300,
    category: 'rounds',
  },
  {
    id: 'r_18_hole',
    title: '18-Hole Round',
    description: 'Redeem a full complimentary 18-hole round.',
    imageUrl: 'https://images.unsplash.com/photo-1592919505780-303950717480?w=600',
    cost: 200,
    category: 'rounds',
  },
  {
    id: 'r_cart_hire',
    title: 'Cart Hire',
    description: 'Enjoy one complimentary golf cart rental for your next round.',
    imageUrl: 'https://images.unsplash.com/photo-1600275669439-14e40452d20b?w=600',
    cost: 500,
    category: 'rounds',
  },
  {
    id: 'r_bucket_balls',
    title: 'Bucket of Balls',
    description: 'Practice session reward at the driving range.',
    imageUrl: 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=600',
    cost: 100,
    category: 'practice',
  },
  {
    id: 'r_club_fitting',
    title: 'Club Fitting Session',
    description: 'Book a complimentary custom club fitting session.',
    imageUrl: 'https://images.unsplash.com/photo-1622396481328-9c2d1c495a01?w=600',
    cost: 500,
    category: 'practice',
  },
  {
    id: 'r_golf_lesson',
    title: 'Golf Lesson',
    description: 'One lesson with club professional.',
    imageUrl: 'https://images.unsplash.com/photo-1591491634026-3b8fd18de4a2?w=600',
    cost: 100,
    category: 'practice',
  },
];

export const mockVouchers: Voucher[] = [
  {
    id: 'v_001',
    rewardId: 'r_18_hole',
    code: 'FLGR-18HR-4821',
    status: 'active',
    qrValue: 'flaggr://voucher/v_001',
    issuedAt: '2026-07-10',
    expiresAt: '2026-10-10',
  },
];

export const mockActivity: ActivityEntry[] = [
  { id: 'a_1', type: 'earn', title: 'Round played', subtitle: 'Vancouver Fairways · 18 holes', amount: 620, date: '2026-07-18' },
  { id: 'a_2', type: 'redeem', title: 'Cart Hire redeemed', subtitle: 'Reward voucher', amount: -500, date: '2026-07-12' },
  { id: 'a_3', type: 'earn', title: 'Pro shop purchase', subtitle: 'Receipt #4821', amount: 145, date: '2026-07-09' },
  { id: 'a_4', type: 'earn', title: 'Round played', subtitle: 'Vancouver Fairways · 9 holes', amount: 210, date: '2026-06-28' },
  { id: 'a_5', type: 'redeem', title: 'Bucket of Balls redeemed', subtitle: 'Reward voucher', amount: -100, date: '2026-06-20' },
];

export const mockReceipts: Receipt[] = [
  {
    id: 'rc_1',
    imageUri: null,
    status: 'pending',
    courseName: 'Vancouver Fairways Golf Club',
    items: [
      { label: 'Ceramic Mug', amount: 18 },
      { label: 'Linen Napkins Set', amount: 32.5 },
      { label: 'Wood Serving Tray', amount: 55 },
    ],
    subtotal: 105.5,
    tax: 12.66,
    total: 118.16,
    submittedAt: '2026-07-19',
    pointsAwarded: null,
  },
];

export const mockNotifications: AppNotification[] = [
  { id: 'n_1', title: 'Receipt approved', body: 'Your receipt from Vancouver Fairways earned you 145 Flagrr Bucks.', date: '2026-07-19', read: false },
  { id: 'n_2', title: "You're on a 9-week streak!", body: "Keep it going — play this week to make it 10.", date: '2026-07-18', read: false },
  { id: 'n_3', title: 'New reward available', body: 'Club Fitting Session is now redeemable for 500 Flagrr Bucks.', date: '2026-07-15', read: true },
  { id: 'n_4', title: 'Voucher expiring soon', body: 'Your 18-Hole Round voucher expires in 30 days.', date: '2026-07-11', read: true },
];
