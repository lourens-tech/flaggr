import type { ScanResult } from '../data/types';
import type { CourseReportKind, StatBreakdownMetric, SuperAdminReportKind } from '../data/adminTypes';

export type AuthStackParamList = {
  Landing: undefined;
  Login: undefined;
  AdminLogin: undefined;
  ForgotPassword: undefined;
  AdminForgotPassword: undefined;
  SignUpStep1: undefined;
  SignUpStep2: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    courseId: string;
  };
};

export type AdminTabParamList = {
  AdminDashboard: undefined;
  AdminEnquiries: undefined;
  AdminRewards: undefined;
  AdminAds: undefined;
  AdminPush: undefined;
  AdminVouchers: undefined;
  AdminCourseProfile: undefined;
  AdminStaffProfile: undefined;
};

export type AdminStackParamList = {
  AdminTabs: undefined;
  AdminRewardEdit: { rewardId?: string };
  AdminAdEdit: { adId?: string };
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
  AdminReportDetail: { report: CourseReportKind; label: string; period: 'month' | 'year' | 'all' };
  TermsPrivacy: undefined;
};

export type SuperAdminTabParamList = {
  SuperAdminCourses: undefined;
  SuperAdminAds: undefined;
  SuperAdminReports: undefined;
  SuperAdminPush: undefined;
  SuperAdminSupport: undefined;
  SuperAdminProfile: undefined;
};

export type SuperAdminStackParamList = {
  SuperAdminTabs: undefined;
  SuperAdminCourseCreate: undefined;
  SuperAdminCourseAds: { courseId: string; courseName: string };
  SuperAdminAdEdit: { courseId: string; adId?: string };
  SuperAdminCourseRewards: { courseId: string; courseName: string; fbPerRand: number };
  SuperAdminRewardEdit: { courseId: string; fbPerRand: number; rewardId?: string };
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
  TermsPrivacy: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Rewards: undefined;
  Activity: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  AdminMain: undefined;
  SuperAdminMain: undefined;
  AdminForceChangePassword: undefined;
  AdminStaffWelcome: undefined;
  Voucher: { voucherId: string };
  ScanReceipt: undefined;
  ReviewReceipt: {
    imageUri: string | null;
    imageBase64: string;
    scanResult: ScanResult & { isDuplicate: false; invalid: false };
  };
  ReceiptSuccess: { pointsAwarded: number; flagged?: boolean };
  ReceiptHistory: undefined;
  MemberTiers: undefined;
  Notifications: undefined;
  HelpCenter: undefined;
  Contact: undefined;
  EditProfile: undefined;
  TermsPrivacy: undefined;
  MyEnquiries: undefined;
  EnquiryChat: { enquiryId: string };
  NotificationPreferences: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
