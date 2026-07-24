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
  courseId: string;
  tier: TierName;
  memberSince: string; // ISO date
  avatarUrl?: string;
  themePreference: 'system' | 'light' | 'dark';
  // False when the member's club hasn't matched them against its uploaded
  // roster (or hasn't uploaded one at all) — they can still use the app
  // fully, but stay capped at Bronze tier until their club verifies them.
  verifiedMember: boolean;
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
  nextMilestoneWeeks: number;
  nextMilestoneAmount: number;
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
      // true when the receipt matched a merchant tied to another Flagrr club
      // (not the member's home club) — points were earned at the flat
      // standard rate (R1 = 1 FC), not this club's catalog/tier multiplier.
      awayClub: boolean;
    };

export type AdPlacement = 'home' | 'rewardsShop';

// Ad space creative — currently seeded/edited directly in the ads table;
// a future super-admin panel will manage these via the same shape.
export interface Ad {
  id: string;
  placement: AdPlacement;
  title: string;
  imageUrl: string | null;
  targetUrl: string | null;
}

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
  enquiryId: string | null;
}

export type EnquiryStatus = 'pending' | 'in_progress' | 'resolved';

export interface EnquiryMessage {
  id: string;
  senderType: 'member' | 'admin';
  body: string;
  createdAt: string;
}

export interface MyEnquirySummary {
  id: string;
  enquiryType: string;
  status: EnquiryStatus;
  createdAt: string;
  updatedAt: string;
  lastMessage: string | null;
  hasUnread: boolean;
}

export interface MyEnquiryThread {
  id: string;
  status: EnquiryStatus;
  enquiryType: string;
  messages: EnquiryMessage[];
}

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved';

export interface SupportTicketMessage {
  id: string;
  senderType: 'requester' | 'agent';
  body: string;
  createdAt: string;
}

// A ticket to the Flagrr team itself — distinct from the Enquiry types
// above, which go to this member's own club's admins.
export interface SupportTicketSummary {
  id: string;
  subject: string;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
  lastMessage: string | null;
  hasUnread: boolean;
}

export interface SupportTicketThread {
  id: string;
  subject: string;
  status: SupportTicketStatus;
  messages: SupportTicketMessage[];
}
