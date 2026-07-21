import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setToken, type SignupPayload } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const TOKEN_KEY = 'flagrr_auth_token';

const EMPTY_USER: User = {
  id: '',
  firstName: '',
  lastName: '',
  email: '',
  homeClub: '',
  tier: 'Bronze',
  memberSince: '',
};
const EMPTY_POINTS: PointsAccount = {
  balance: 0,
  totalEarned: 0,
  totalRedeemed: 0,
  pointsToNextTier: 0,
  nextTier: null,
  tierProgress: 0,
};
const EMPTY_STREAK: Streak = { weeks: 0, activeSince: '', weeksPlayed: [] };
const EMPTY_STATS: Stats = {
  roundsPlayed9: 0,
  roundsPlayed9DeltaPct: 0,
  roundsPlayed18: 0,
  roundsPlayed18DeltaPct: 0,
  bucksEarned: 0,
  bucksEarnedDeltaPct: 0,
  bucksRedeemed: 0,
  bucksRedeemedDeltaPct: 0,
  monthly: [],
};

interface AppState {
  isAuthenticated: boolean;
  isInitializing: boolean;
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
  login: (email: string, password: string, keepLoggedIn?: boolean) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => Promise<void>;
  redeemReward: (rewardId: string) => Promise<Voucher | null>;
  submitReceipt: (
    receipt: Omit<Receipt, 'id' | 'status' | 'pointsAwarded'>,
    pointsAwarded: number,
  ) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  updateAvatar: (imageBase64: string) => Promise<void>;
  unreadNotificationCount: number;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [user, setUser] = useState<User>(EMPTY_USER);
  const [points, setPoints] = useState<PointsAccount>(EMPTY_POINTS);
  const [streak, setStreak] = useState<Streak>(EMPTY_STREAK);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Fetches everything needed to render the authenticated app in one go.
  const loadAll = useCallback(async () => {
    const [me, rewardsRes, vouchersRes, activityRes, receiptsRes, notificationsRes] = await Promise.all([
      api.me(),
      api.rewards(),
      api.vouchers(),
      api.activity(),
      api.receipts(),
      api.notifications(),
    ]);
    setUser(me.user);
    setPoints(me.points);
    setStreak(me.streak);
    setStats(me.stats);
    setRewards(rewardsRes);
    setVouchers(vouchersRes);
    setActivity(activityRes);
    setReceipts(receiptsRes);
    setNotifications(notificationsRes);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (token) {
          await loadAll();
          setIsAuthenticated(true);
        }
      } catch {
        // Stored token is missing/expired — fall back to a logged-out state.
        await setToken(null);
      } finally {
        setIsInitializing(false);
      }
    })();
  }, [loadAll]);

  const login = async (email: string, password: string, keepLoggedIn: boolean = true) => {
    const res = await api.login(email, password);
    await setToken(res.token, keepLoggedIn);
    await loadAll();
    setIsAuthenticated(true);
  };

  const signup = async (payload: SignupPayload) => {
    const res = await api.signup(payload);
    await setToken(res.token);
    await loadAll();
    setIsAuthenticated(true);
  };

  const logout = async () => {
    await setToken(null);
    setIsAuthenticated(false);
    setUser(EMPTY_USER);
    setPoints(EMPTY_POINTS);
    setStreak(EMPTY_STREAK);
    setStats(EMPTY_STATS);
    setRewards([]);
    setVouchers([]);
    setActivity([]);
    setReceipts([]);
    setNotifications([]);
  };

  const redeemReward = async (rewardId: string): Promise<Voucher | null> => {
    try {
      const voucher = await api.redeem(rewardId);
      setVouchers((prev) => [voucher, ...prev]);
      const [me, activityRes] = await Promise.all([api.me(), api.activity()]);
      setPoints(me.points);
      setUser(me.user);
      setActivity(activityRes);
      return voucher;
    } catch {
      return null;
    }
  };

  const submitReceipt: AppContextValue['submitReceipt'] = async (receiptDraft, pointsAwarded) => {
    const receipt = await api.submitReceipt({
      imageUri: receiptDraft.imageUri,
      courseName: receiptDraft.courseName,
      items: receiptDraft.items,
      subtotal: receiptDraft.subtotal,
      tax: receiptDraft.tax,
      total: receiptDraft.total,
      pointsAwarded,
    });
    setReceipts((prev) => [receipt, ...prev]);
    const [me, activityRes] = await Promise.all([api.me(), api.activity()]);
    setPoints(me.points);
    setUser(me.user);
    setActivity(activityRes);
  };

  const updateAvatar = async (imageBase64: string) => {
    const res = await api.updateAvatar(imageBase64);
    setUser((prev) => ({ ...prev, avatarUrl: res.avatarUrl }));
  };

  const markNotificationRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await api.markNotificationRead(id);
    } catch {
      // Best-effort — the optimistic update stands even if the request fails.
    }
  };

  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const value: AppContextValue = {
    isAuthenticated,
    isInitializing,
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
    signup,
    logout,
    redeemReward,
    submitReceipt,
    markNotificationRead,
    updateAvatar,
    unreadNotificationCount,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
