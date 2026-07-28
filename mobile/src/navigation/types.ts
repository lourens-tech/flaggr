import type { ScanResult } from '../data/types';
import type { StatBreakdownMetric } from '../data/adminTypes';

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
  AdminSupportTickets: undefined;
  AdminSupportTicketCreate: undefined;
  AdminSupportTicketChat: { ticketId: string };
  AdminMemberList: undefined;
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
  SuperAdminSupportTicketChat: { ticketId: string };
  SuperAdminAgents: undefined;
  SuperAdminAgentCreate: undefined;
  SuperAdminBroadcastCompose: { title?: string; body?: string; target?: string } | undefined;
  SuperAdminCourseMemberList: { courseId: string; courseName: string };
  SuperAdminCourseAdmins: { courseId: string; courseName: string };
  SuperAdminCourseAdminCreate: { courseId: string; courseName: string };
  SuperAdminMemberStats: { memberId: string };
  SuperAdminAuditLog: undefined;
  SuperAdminFraudOversight: undefined;
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
  ReviewReceipt: { imageUri: string | null; imageBase64: string; scanResult: ScanResult & { isDuplicate: false } };
  ReceiptSuccess: { pointsAwarded: number };
  MemberTiers: undefined;
  Notifications: undefined;
  HelpCenter: undefined;
  Contact: undefined;
  EditProfile: undefined;
  TermsPrivacy: undefined;
  MyEnquiries: undefined;
  EnquiryChat: { enquiryId: string };
  SupportTickets: undefined;
  SupportTicketCreate: undefined;
  SupportTicketChat: { ticketId: string };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
