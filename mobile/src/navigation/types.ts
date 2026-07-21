import type { ScanResult } from '../data/types';

export type AuthStackParamList = {
  Landing: undefined;
  Login: undefined;
  SignUpStep1: undefined;
  SignUpStep2: { firstName: string; lastName: string; email: string; phone: string; courseId: string };
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
  Voucher: { voucherId: string };
  ScanReceipt: undefined;
  ReviewReceipt: { imageUri: string | null; imageBase64: string; scanResult: ScanResult & { isDuplicate: false } };
  ReceiptSuccess: { pointsAwarded: number };
  MemberTiers: undefined;
  Notifications: undefined;
  HelpCenter: undefined;
  Contact: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
