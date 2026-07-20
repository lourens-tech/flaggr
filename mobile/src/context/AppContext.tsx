import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  mockActivity,
  mockNotifications,
  mockPointsAccount,
  mockReceipts,
  mockRewards,
  mockStats,
  mockStreak,
  mockUser,
  mockVouchers,
} from '../data/mockData';
import type {
  ActivityEntry,
  AppNotification,
  PointsAccount,
  Receipt,
  Reward,
  Stats,
  Streak,
  User,
  Voucher,
} from '../data/types';

interface AppState {
  isAuthenticated: boolean;
  user: User;
  points: PointsAccount;
  streak: Streak;
  stats: Stats;
  rewards: Reward[];
  vouchers: Voucher[];
  activity: ActivityEntry[];
  receipts: Receipt[];
  notifications: AppNotification[];
}

interface AppContextValue extends AppState {
  login: () => void;
  logout: () => void;
  redeemReward: (rewardId: string) => Voucher | null;
  submitReceipt: (receipt: Omit<Receipt, 'id' | 'status' | 'pointsAwarded'>, pointsAwarded: number) => void;
  markNotificationRead: (id: string) => void;
  unreadNotificationCount: number;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user] = useState<User>(mockUser);
  const [points, setPoints] = useState<PointsAccount>(mockPointsAccount);
  const [streak] = useState<Streak>(mockStreak);
  const [stats] = useState<Stats>(mockStats);
  const [rewards] = useState<Reward[]>(mockRewards);
  const [vouchers, setVouchers] = useState<Voucher[]>(mockVouchers);
  const [activity, setActivity] = useState<ActivityEntry[]>(mockActivity);
  const [receipts, setReceipts] = useState<Receipt[]>(mockReceipts);
  const [notifications, setNotifications] = useState<AppNotification[]>(mockNotifications);

  const login = () => setIsAuthenticated(true);
  const logout = () => setIsAuthenticated(false);

  const redeemReward = (rewardId: string): Voucher | null => {
    const reward = rewards.find((r) => r.id === rewardId);
    if (!reward || points.balance < reward.cost) return null;

    const voucher: Voucher = {
      id: `v_${Date.now()}`,
      rewardId: reward.id,
      code: `FLGR-${reward.id.slice(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'active',
      qrValue: `flaggr://voucher/v_${Date.now()}`,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    };

    setVouchers((prev) => [voucher, ...prev]);
    setPoints((prev) => ({
      ...prev,
      balance: prev.balance - reward.cost,
      totalRedeemed: prev.totalRedeemed + reward.cost,
    }));
    setActivity((prev) => [
      {
        id: `a_${Date.now()}`,
        type: 'redeem',
        title: `${reward.title} redeemed`,
        subtitle: 'Reward voucher',
        amount: -reward.cost,
        date: new Date().toISOString(),
      },
      ...prev,
    ]);

    return voucher;
  };

  const submitReceipt: AppContextValue['submitReceipt'] = (receiptDraft, pointsAwarded) => {
    const receipt: Receipt = {
      ...receiptDraft,
      id: `rc_${Date.now()}`,
      status: 'approved',
      pointsAwarded,
    };
    setReceipts((prev) => [receipt, ...prev]);
    setPoints((prev) => ({
      ...prev,
      balance: prev.balance + pointsAwarded,
      totalEarned: prev.totalEarned + pointsAwarded,
    }));
    setActivity((prev) => [
      {
        id: `a_${Date.now()}`,
        type: 'earn',
        title: 'Receipt scanned',
        subtitle: receiptDraft.courseName,
        amount: pointsAwarded,
        date: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const value: AppContextValue = {
    isAuthenticated,
    user,
    points,
    streak,
    stats,
    rewards,
    vouchers,
    activity,
    receipts,
    notifications,
    login,
    logout,
    redeemReward,
    submitReceipt,
    markNotificationRead,
    unreadNotificationCount,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
