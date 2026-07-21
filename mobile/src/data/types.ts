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
  dateOfBirth: string | null; // ISO date
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

export type StatsPeriod = 'month' | 'year' | 'all';

export interface Stats {
  period?: StatsPeriod;
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

export type RewardCategory = 'rounds' | 'experiences' | 'pro-shop' | 'practice' | 'dining';

export interface RewardVariant {
  id: string;
  label: string;
  randValue: number | null;
  cost: number;
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: RewardCategory;
  variants: RewardVariant[];
}

export type VoucherStatus = 'active' | 'redeemed' | 'expired';

export interface Voucher {
  id: string;
  rewardId: string;
  rewardTitle: string;
  variantLabel: string;
  cost: number;
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
  receiptNumber: string | null;
  transactionNumber: string | null;
  tillNumber: string | null;
  receiptTime: string | null;
  ocrConfidence: number | null;
  flagged: boolean;
  flagReason: string | null;
}

// A matched receipt line item, as returned by the scan/submit pipeline —
// "matchedName" is the recognized product or golf activity name, if any.
export interface ScannedLineItem {
  description: string;
  quantity: number;
  price: number;
  matchedProductId: string | null;
  matchedActivityId: string | null;
  matchedName: string | null;
  pointsAwarded: number;
}

export interface ScannedMerchant {
  id: string;
  name: string;
  merchantType: string;
  courseId: string | null;
}

// Result of POST /api/receipts/scan — either a duplicate rejection or a
// full structured preview of what will be awarded if confirmed.
export type ScanResult =
  | { isDuplicate: true; reason: string }
  | {
      isDuplicate: false;
      ocrConfidence: number;
      merchantNameGuess: string | null;
      merchant: ScannedMerchant | null;
      receiptNumber: string | null;
      transactionNumber: string | null;
      tillNumber: string | null;
      date: string | null;
      time: string | null;
      items: ScannedLineItem[];
      subtotal: number | null;
      vat: number | null;
      grandTotal: number | null;
      subtotalPoints: number;
      totalPointsAwarded: number;
    };

export type ActivityType = 'earn' | 'redeem';

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  title: string;
  subtitle: string;
  amount: number;
  voucherId: string | null;
  date: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  date: string;
  read: boolean;
}
