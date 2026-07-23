export type AdminRole = 'super_admin' | 'course_admin';

export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: AdminRole;
}

export interface AdminCourse {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  fbPerRand: number;
}

export interface DashboardTotals {
  members: number;
  newMembers: number;
  fcEarned: number;
  fcEarnedDeltaPct: number;
  fcRedeemed: number;
  fcRedeemedDeltaPct: number;
  receiptsScanned: number;
  receiptsScannedDeltaPct: number;
}

export interface TierCount {
  tier: string;
  count: number;
}

export interface TopReward {
  rewardId: string;
  title: string;
  redemptions: number;
  fcSpent: number;
}

export interface AdPerformance {
  adId: string;
  title: string;
  placement: string;
  clicks: number;
}

export interface MonthlyCount {
  month: string;
  value: number;
}

export interface DashboardReport {
  period: 'month' | 'year' | 'all';
  totals: DashboardTotals;
  tierDistribution: TierCount[];
  topRewards: TopReward[];
  adPerformance: AdPerformance[];
  signupsByMonth: MonthlyCount[];
}

export interface AdminRewardVariant {
  id: string;
  label: string;
  randValue: number | null;
  cost: number | null;
  sortOrder: number | null;
  active: boolean | null;
}

export interface AdminReward {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  category: string;
  active: boolean;
  variants: AdminRewardVariant[];
}

export interface AdminAd {
  id: string;
  placement: 'home' | 'rewards_shop';
  title: string;
  imageUrl: string | null;
  targetUrl: string | null;
  sortOrder: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  clicks: number;
}

export interface AdminMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  tier: string;
  memberSince: string;
  balance: number;
}

export interface AdminNotification {
  id: string;
  title: string;
  body: string;
  receiptId: string | null;
  date: string;
  read: boolean;
}

export interface AdminVoucherLookup {
  id: string;
  code: string;
  variantLabel: string;
  cost: number;
  status: 'active' | 'redeemed' | 'expired';
  issuedAt: string;
  expiresAt: string;
  rewardTitle: string;
  memberName: string;
  memberEmail: string;
}
