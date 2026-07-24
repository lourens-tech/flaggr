export type AdminRole = 'super_admin' | 'course_admin' | 'staff';

export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string | null;
  role: AdminRole;
  mustChangePassword: boolean;
  themePreference: 'system' | 'light' | 'dark';
}

export interface AdminStaff {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  mustChangePassword: boolean;
  revoked: boolean;
  createdAt: string;
}

export interface AdminCourse {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  fbPerRand: number;
  onboardingCompletedAt: string | null;
  staffOnboardingCompletedAt: string | null;
}

// A super_admin isn't scoped to any single course, so it works with a list
// of these summaries rather than the single AdminCourse a course_admin/staff
// account gets.
export interface SuperAdminCourseSummary {
  id: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  subscriptionStatus: 'trialing' | 'active' | 'past_due' | 'canceled' | null;
  onboardingCompletedAt: string | null;
  staffOnboardingCompletedAt: string | null;
  createdAt: string;
  adminCount: number;
  memberCount: number;
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

export interface MonthlyCount {
  month: string;
  value: number;
}

export interface DashboardReport {
  period: 'month' | 'year' | 'all';
  totals: DashboardTotals;
  tierDistribution: TierCount[];
  topRewards: TopReward[];
  signupsByMonth: MonthlyCount[];
}

// Same shape as DashboardReport, plus a clubs total — a super_admin's
// dashboard is aggregated across every club instead of just one.
export interface SuperAdminDashboardReport extends DashboardReport {
  totals: DashboardTotals & { clubs: number };
}

export interface AdPerformanceRow {
  adId: string;
  courseId: string;
  courseName: string;
  title: string;
  placement: 'home' | 'rewards_shop';
  active: boolean;
  clicks: number;
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

export interface MembersPage {
  members: AdminMember[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MemberStats {
  member: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    tier: string;
    memberSince: string;
    balance: number;
    totalEarned: number;
    totalRedeemed: number;
  };
  stats: {
    period: 'month' | 'year' | 'all';
    roundsPlayed9: number;
    roundsPlayed9DeltaPct: number;
    roundsPlayed18: number;
    roundsPlayed18DeltaPct: number;
    bucksEarned: number;
    bucksEarnedDeltaPct: number;
    bucksRedeemed: number;
    bucksRedeemedDeltaPct: number;
    receiptsScanned: number;
    receiptsScannedDeltaPct: number;
    monthly: MonthlyCount[];
  };
}

export interface AdminNotification {
  id: string;
  title: string;
  body: string;
  receiptId: string | null;
  enquiryId: string | null;
  date: string;
  read: boolean;
}

export type BroadcastTarget = 'all' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface AdminBroadcast {
  id: string;
  title: string;
  body: string;
  target: BroadcastTarget;
  recipientCount: number;
  sentAt: string;
}

export type EnquiryStatus = 'pending' | 'in_progress' | 'resolved';

export interface EnquiryMessage {
  id: string;
  senderType: 'member' | 'admin';
  body: string;
  createdAt: string;
}

export interface AdminEnquirySummary {
  id: string;
  enquiryType: string;
  status: EnquiryStatus;
  createdAt: string;
  updatedAt: string;
  memberName: string;
  memberEmail: string;
  lastMessage: string | null;
  hasUnread: boolean;
}

export interface AdminEnquiryThread {
  id: string;
  status: EnquiryStatus;
  enquiryType: string;
  memberName: string;
  memberEmail: string;
  messages: EnquiryMessage[];
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
