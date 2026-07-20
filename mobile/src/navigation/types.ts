export type AuthStackParamList = {
  Landing: undefined;
  Login: undefined;
  SignUpStep1: undefined;
  SignUpStep2: { firstName: string; lastName: string; email: string };
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
  ReviewReceipt: { imageUri: string | null };
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
