export type AdminRole = 'super_admin' | 'course_admin' | 'staff' | 'support_agent';

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

// A course_admin's own view of who else administers their club — read-only,
// no reset/revoke/delete ability (that stays super_admin-only, see
// CourseAdminAccount / SuperAdminCourseAdminsScreen).
export interface ClubAdminSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
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
  // Never 'canceled' by the time this reaches a course_admin/staff device —
  // that state blocks the session entirely server-side (see getAuthedAdmin).
  subscriptionStatus: 'trialing' | 'active' | 'past_due' | null;
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
  archivedAt: string | null;
  createdAt: string;
  adminCount: number;
  memberCount: number;
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
  courseId: string | null;
  courseName: string;
  title: string;
  placement: 'home' | 'rewards_shop';
  active: boolean;
  clicks: number;
}

export type StatBreakdownMetric = 'members' | 'newMembers' | 'fcEarned' | 'fcRedeemed' | 'receiptsScanned';

// Per-club breakdown behind a single stat card on the super-admin Reports
// screen (e.g. tapping "Members" shows every club's own member count).
export interface StatBreakdownRow {
  courseId: string;
  courseName: string;
  value: number;
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

// Cross-club version of AdminMember/MemberStats — a super_admin isn't
// scoped to one course, so every result carries which club the member
// belongs to (implicit for a course_admin's own search, but not here).
export interface SuperAdminMemberSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  tier: string;
  memberSince: string;
  balance: number;
  courseId: string;
  courseName: string;
}

export interface SuperAdminMemberStats {
  member: MemberStats['member'] & { courseName: string };
  stats: MemberStats['stats'];
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

// Same tier targets as a club's own broadcast, plus 'course_admins' — a
// super_admin isn't scoped to one course, so member/tier targets reach
// every club platform-wide, and 'course_admins' reaches every course_admin
// account instead of members at all.
export type SuperAdminBroadcastTarget = 'all' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'course_admins';

export interface SuperAdminBroadcast {
  id: string;
  title: string;
  body: string;
  target: SuperAdminBroadcastTarget;
  recipientCount: number;
  sentAt: string;
  // Null means platform-wide (every club) — set when this broadcast was
  // scoped to one specific club instead.
  courseId: string | null;
  courseName: string | null;
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

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved';
export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type SupportRequesterType = 'member' | 'course_admin' | 'staff';

export interface SupportTicketMessage {
  id: string;
  senderType: 'requester' | 'agent';
  body: string;
  createdAt: string;
}

// A member/course_admin/staff's own view of a ticket they logged — a
// platform-level ticket to the Flagrr team itself, distinct from the
// existing per-club Enquiry (member <-> that club's own admins).
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

// The support-team (super_admin/support_agent) view of the same tickets —
// every club/member is visible, so it also carries who's asking.
export interface SupportInboxTicket extends SupportTicketSummary {
  requesterType: SupportRequesterType;
  requesterName: string;
  requesterEmail: string;
  priority: SupportTicketPriority;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
}

export interface SupportInboxTicketThread extends SupportTicketThread {
  requesterType: SupportRequesterType;
  requesterName: string;
  requesterEmail: string;
  priority: SupportTicketPriority;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
}

export interface SupportAgent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mustChangePassword: boolean;
  revoked: boolean;
  createdAt: string;
}

export interface CourseAdminAccount {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mustChangePassword: boolean;
  revoked: boolean;
  createdAt: string;
}

export interface MemberRosterStatus {
  count: number;
  lastUploadedAt: string | null;
}

export interface MemberRosterUploadResult {
  rosterCount: number;
  verifiedCount: number;
}

export interface AuditLogEntry {
  id: string;
  adminId: string | null;
  adminName: string;
  adminRole: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  createdAt: string;
}

export interface FlaggedReceipt {
  id: string;
  courseId: string;
  courseName: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  merchantName: string;
  total: number;
  pointsAwarded: number | null;
  submittedAt: string;
  flagReason: string | null;
  memberFlagCount: number;
  fraudConfirmedCount: number;
}

export interface DuplicateReceiptAttempt {
  id: string;
  attemptedAt: string;
  matchType: 'receipt_number' | 'image_hash';
  memberId: string;
  memberName: string;
  memberEmail: string;
  attemptedCourseId: string;
  attemptedCourseName: string;
  originalCourseId: string | null;
  originalCourseName: string | null;
  originalSubmittedAt: string | null;
  crossClub: boolean;
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
