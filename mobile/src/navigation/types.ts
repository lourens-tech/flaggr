import type { NavigatorScreenParams } from '@react-navigation/native';
import type { ScanResult } from '../data/types';
import type { CourseReportKind, StatBreakdownMetric, SuperAdminReportKind } from '../data/adminTypes';

export type AuthStackParamList = {
  Landing: undefined;
  Login: undefined;
  AdminLogin: undefined;
  ForgotPassword: undefined;
  AdminForgotPassword: undefined;
  SignUpStep1: undefined;
  // Readable before signing in (owner decision 24 Nov 2026): Landing and Sign up link here.
  // section: which part to open on (the screen gets a Terms | Privacy toggle in phase 3).
  TermsPrivacy: { section?: 'terms' | 'privacy' } | undefined;
  SignUpStep2: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    courseId: string;
    referralCode?: string;
  };
};

export type AdminTabParamList = {
  AdminDashboard: undefined;
  AdminEnquiries: undefined;
  AdminRewards: undefined;
  AdminPush: undefined;
  AdminVouchers: undefined;
  AdminCourseProfile: undefined;
  AdminStaffProfile: undefined;
  AdminMore: undefined;
};

export type AdminStackParamList = {
  AdminTabs: undefined;
  AdminRewardEdit: { rewardId?: string };
  AdminNotifications: undefined;
  AdminEnquiryChat: { enquiryId: string };
  AdminMemberStats: { memberId: string };
  AdminBroadcastCompose: { title?: string; body?: string; target?: string } | undefined;
  AdminStaffList: undefined;
  AdminClubAdmins: undefined;
  AdminStaffEdit: { staffId?: string } | undefined;
  AdminStaffActivity: undefined;
  AdminSupportTickets: undefined;
  AdminSupportTicketCreate: undefined;
  AdminSupportTicketChat: { ticketId: string };
  AdminMemberList: undefined;
  AdminFraudOversight: undefined;
  AdminCatalog: undefined;
  AdminCatalogItemEdit: { kind: 'product' | 'activity'; itemId?: string };
  AdminReportDetail: { report: CourseReportKind; label: string; period: 'month' | 'year' | 'all' };
  AdminGolf: undefined;
  AdminGolfMember: { userId: string };
  AdminGolfScorecard: { roundId: string };
  TermsPrivacy: undefined;
};

export type SuperAdminTabParamList = {
  SuperAdminCourses: undefined;
  SuperAdminAds: undefined;
  SuperAdminReports: undefined;
  SuperAdminPush: undefined;
  SuperAdminSupport: undefined;
  SuperAdminProfile: undefined;
  SuperAdminMore: undefined;
};

export type SuperAdminStackParamList = {
  SuperAdminTabs: undefined;
  SuperAdminCourseCreate: undefined;
  SuperAdminCourseAds: { courseId: string; courseName: string };
  // courseId is just the launch-context hint used to preselect targeting
  // (a real course id, or 'global') — the create/edit form itself owns the
  // actual target set (isGlobal + selected courses), editable regardless
  // of how the screen was entered. Omit both for a screen-agnostic "New Ad".
  SuperAdminAdEdit: { courseId?: string; adId?: string };
  SuperAdminCourseRewards: { courseId: string; courseName: string; fbPerRand: number };
  SuperAdminRewardEdit: { courseId: string; fbPerRand: number; rewardId?: string };
  SuperAdminCourseCatalog: { courseId: string; courseName: string; fbPerRand: number };
  SuperAdminCatalogItemEdit: {
    courseId: string;
    courseName: string;
    fbPerRand: number;
    kind: 'product' | 'activity';
    itemId?: string;
  };
  SuperAdminStatBreakdown: { metric: StatBreakdownMetric; label: string; period: 'month' | 'year' | 'all' };
  SuperAdminClubMembers: { courseId: string; courseName: string; period: 'month' | 'year' | 'all' };
  SuperAdminReportDetail: { report: SuperAdminReportKind; label: string; period: 'month' | 'year' | 'all' };
  SuperAdminAdDetail: { adId: string; adTitle: string; period: 'month' | 'year' | 'all' };
  SuperAdminSupportTicketChat: { ticketId: string };
  SuperAdminAgents: undefined;
  SuperAdminAgentCreate: undefined;
  SuperAdminBroadcastCompose: { title?: string; body?: string; target?: string } | undefined;
  SuperAdminCourseMemberList: { courseId: string; courseName: string };
  SuperAdminCourseEnquiries: { courseId: string; courseName: string };
  SuperAdminEnquiryChat: { courseId: string; enquiryId: string };
  SuperAdminCourseAdmins: { courseId: string; courseName: string };
  SuperAdminCourseAdminCreate: { courseId: string; courseName: string };
  SuperAdminMemberStats: { memberId: string };
  SuperAdminAuditLog: undefined;
  SuperAdminFraudOversight: undefined;
  SuperAdminCourseMaps: undefined;
  // A club's course map (clubId), or an away-only course map (golfCourseId).
  SuperAdminCourseMap: { clubId?: string; clubName?: string; golfCourseId?: string };
  SuperAdminGolf: undefined;
  SuperAdminGolfClub: { courseId: string; courseName?: string };
  SuperAdminGolfMember: { userId: string };
  SuperAdminGolfScorecard: { roundId: string };
  TermsPrivacy: undefined;
};

// The four Bento tabs. My Golf and Reward Activity are pushed screens (RootStackParamList).
export type MainTabParamList = {
  Home: undefined;
  Course: undefined;
  Rewards: undefined;
  Profile: undefined;
};

// The receipt flow, presented over the app as one modal group.
export type ScanFlowParamList = {
  ScanReceipt: undefined;
  ReviewReceipt: {
    imageUri: string | null;
    imageBase64: string;
    scanResult: ScanResult & { isDuplicate: false; invalid: false };
  };
  ReceiptSuccess: { pointsAwarded: number; flagged?: boolean };
};

export type RootStackParamList = {
  Auth: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  AdminMain: undefined;
  SuperAdminMain: undefined;
  AdminForceChangePassword: undefined;
  AdminStaffWelcome: undefined;
  Voucher: { voucherId: string };
  ScanFlow: NavigatorScreenParams<ScanFlowParamList> | undefined;
  // closeAs 'tab': the tab bar is closing My Golf to switch tabs, so it cross-fades instead of sliding.
  MyGolf: { closeAs?: 'tab' } | undefined;
  Activity: undefined;
  // receiptId: open that receipt straight away (from a "Receipt scanned" row in Reward Activity).
  ReceiptHistory: { receiptId?: string } | undefined;
  MemberTiers: undefined;
  Notifications: undefined;
  HelpCenter: undefined;
  Contact: undefined;
  GiveFeedback: undefined;
  Referral: undefined;
  EditProfile: undefined;
  TermsPrivacy: { section?: 'terms' | 'privacy' } | undefined;
  MyEnquiries: undefined;
  EnquiryChat: { enquiryId: string };
  NotificationPreferences: undefined;
  RoundSetup: { golfCourseId: string };
  CourseGuide: { roundId: string };
  RoundDetail: { roundId: string };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
