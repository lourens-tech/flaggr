import type { ScanResult } from '../data/types';

export type AuthStackParamList = {
  Landing: undefined;
  Login: undefined;
  AdminLogin: undefined;
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
  AdminStaffEdit: { staffId?: string } | undefined;
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
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
