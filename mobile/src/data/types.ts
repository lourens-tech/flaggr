export type TierName = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface MemberTier {
  name: TierName;
  minPoints: number;
  perks: string[];
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  homeClub: string;
  tier: TierName;
  memberSince: string; // ISO date
  avatarUrl?: string;
}

export interface PointsAccount {
  balance: number;
  totalEarned: number;
  totalRedeemed: number;
  pointsToNextTier: number;
  nextTier: TierName | null;
  tierProgress: number; // 0-1
}

export interface Streak {
  weeks: number;
  activeSince: string; // ISO date
  weeksPlayed: boolean[]; // last N weeks, most recent last
}

export interface MonthlyPoint {
  month: string; // 'J', 'F', ...
  value: number;
}

export interface Stats {
  roundsPlayed9: number;
  roundsPlayed9DeltaPct: number;
  roundsPlayed18: number;
  roundsPlayed18DeltaPct: number;
  bucksEarned: number;
  bucksEarnedDeltaPct: number;
  bucksRedeemed: number;
  bucksRedeemedDeltaPct: number;
  monthly: MonthlyPoint[];
}

export type RewardCategory = 'rounds' | 'experiences' | 'pro-shop' | 'practice';

export interface Reward {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  cost: number;
  category: RewardCategory;
}

export type VoucherStatus = 'active' | 'redeemed' | 'expired';

export interface Voucher {
  id: string;
  rewardId: string;
  code: string;
  status: VoucherStatus;
  qrValue: string;
  issuedAt: string;
  expiresAt: string;
}

export type ReceiptStatus = 'pending' | 'approved' | 'rejected';

export interface ReceiptLineItem {
  label: string;
  amount: number;
}

export interface Receipt {
  id: string;
  imageUri: string | null;
  status: ReceiptStatus;
  courseName: string;
  items: ReceiptLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  submittedAt: string;
  pointsAwarded: number | null;
}

export type ActivityType = 'earn' | 'redeem';

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  title: string;
  subtitle: string;
  amount: number;
  date: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  date: string;
  read: boolean;
}
