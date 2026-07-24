import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setToken, type ContactEnquiryPayload, type SignupPayload, type UpdateProfilePayload } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerForPushNotificationsAsync } from '../utils/pushNotifications';
import { useTheme, type ThemePreference } from './ThemeContext';
import type {
  ActivityEntry,
  Ad,
  AppNotification,
  EnquiryMessage,
  MyEnquirySummary,
  MyEnquiryThread,
  PointsAccount,
  Receipt,
  Reward,
  Stats,
  StatsPeriod,
  Streak,
  SupportTicketMessage,
  SupportTicketSummary,
  SupportTicketThread,
  User,
  Voucher,
} from '../data/types';

const TOKEN_KEY = 'flagrr_auth_token';

const EMPTY_USER: User = {
  id: '',
  firstName: '',
  lastName: '',
  email: '',
  dateOfBirth: null,
  homeClub: '',
  courseId: '',
  tier: 'Bronze',
  memberSince: '',
  themePreference: 'system',
  verifiedMember: true,
};
const EMPTY_POINTS: PointsAccount = {
  balance: 0,
  totalEarned: 0,
  totalRedeemed: 0,
  pointsToNextTier: 0,
  nextTier: null,
  tierProgress: 0,
};
const EMPTY_STREAK: Streak = { weeks: 0, activeSince: '', weeksPlayed: [], nextMilestoneWeeks: 4, nextMilestoneAmount: 100 };
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
  ads: Ad[];
}

interface AppContextValue extends AppState {
  login: (email: string, password: string, keepLoggedIn?: boolean) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => Promise<void>;
  redeemReward: (rewardId: string, variantId: string) => Promise<Voucher | null>;
  submitReceipt: (imageBase64: string, imageUri: string | null) => Promise<Receipt>;
  markNotificationRead: (id: string) => Promise<void>;
  updateAvatar: (imageBase64: string) => Promise<void>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<void>;
  updateThemePreference: (preference: ThemePreference) => Promise<void>;
  changeHomeClub: (courseId: string) => Promise<void>;
  sendContactEnquiry: (payload: ContactEnquiryPayload) => Promise<string>;
  listMyEnquiries: () => Promise<MyEnquirySummary[]>;
  getEnquiryThread: (id: string) => Promise<MyEnquiryThread>;
  replyToEnquiry: (enquiryId: string, message: string) => Promise<EnquiryMessage[]>;
  createSupportTicket: (subject: string, message: string) => Promise<string>;
  listMySupportTickets: () => Promise<SupportTicketSummary[]>;
  getSupportTicketThread: (id: string) => Promise<SupportTicketThread>;
  replyToSupportTicket: (ticketId: string, message: string) => Promise<SupportTicketMessage[]>;
  logAdClick: (adId: string) => void;
  statsPeriod: StatsPeriod;
  setStatsPeriod: (period: StatsPeriod) => Promise<void>;
  unreadNotificationCount: number;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
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
  const [ads, setAds] = useState<Ad[]>([]);
  const [statsPeriod, setStatsPeriodState] = useState<StatsPeriod>('year');

  // Fetches everything needed to render the authenticated app in one go.
  // Always loads the default ('year') period — the period toggle's own
  // lightweight refetch (setStatsPeriod) handles switching later, so this
  // doesn't need statsPeriod in its closure/deps.
  const loadAll = useCallback(async () => {
    const [me, rewardsRes, vouchersRes, activityRes, receiptsRes, notificationsRes] = await Promise.all([
      api.me('year'),
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
    setAds(me.ads);
    theme.hydrateFromAccount(me.user.themePreference);

    // Fire-and-forget — no EAS project exists yet, so this is a silent
    // no-op until one is set up; never block the app load on it.
    registerForPushNotificationsAsync().then((result) => {
      if (result) api.registerPushToken(result.token, result.platform).catch(() => {});
    });
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
    setAds([]);
    setStatsPeriodState('year');
  };

  const redeemReward = async (rewardId: string, variantId: string): Promise<Voucher | null> => {
    try {
      const voucher = await api.redeem(rewardId, variantId);
      setVouchers((prev) => [voucher, ...prev]);
      const [me, activityRes, notificationsRes] = await Promise.all([
        api.me(statsPeriod),
        api.activity(),
        api.notifications(),
      ]);
      setPoints(me.points);
      setUser(me.user);
      setStats(me.stats);
      setActivity(activityRes);
      setNotifications(notificationsRes);
      return voucher;
    } catch {
      return null;
    }
  };

  const submitReceipt: AppContextValue['submitReceipt'] = async (imageBase64, imageUri) => {
    const receipt = await api.submitReceipt({ imageBase64, imageUri });
    setReceipts((prev) => [receipt, ...prev]);
    const [me, activityRes, notificationsRes] = await Promise.all([
      api.me(statsPeriod),
      api.activity(),
      api.notifications(),
    ]);
    setPoints(me.points);
    setUser(me.user);
    setStreak(me.streak);
    setStats(me.stats);
    setActivity(activityRes);
    setNotifications(notificationsRes);
    return receipt;
  };

  const updateAvatar = async (imageBase64: string) => {
    const res = await api.updateAvatar(imageBase64);
    setUser((prev) => ({ ...prev, avatarUrl: res.avatarUrl }));
  };

  const updateProfile = async (payload: UpdateProfilePayload) => {
    const updated = await api.updateProfile(payload);
    setUser((prev) => ({ ...prev, ...updated }));
  };

  const updateThemePreference = async (preference: ThemePreference) => {
    const res = await api.updateThemePreference(preference);
    setUser((prev) => ({ ...prev, themePreference: res.themePreference }));
    await theme.setPreference(res.themePreference);
  };

  const sendContactEnquiry = async (payload: ContactEnquiryPayload): Promise<string> => {
    const res = await api.sendContactEnquiry(payload);
    return res.enquiryId;
  };

  const listMyEnquiries = async () => api.myEnquiries();
  const getEnquiryThread = async (id: string) => api.enquiryThread(id);
  const replyToEnquiry = async (enquiryId: string, message: string) => api.replyToEnquiry(enquiryId, message);

  const createSupportTicket = async (subject: string, message: string): Promise<string> => {
    const res = await api.createSupportTicket(subject, message);
    return res.ticketId;
  };
  const listMySupportTickets = async () => api.supportTickets();
  const getSupportTicketThread = async (id: string) => api.supportTicketThread(id);
  const replyToSupportTicket = async (ticketId: string, message: string) => api.replyToSupportTicket(ticketId, message);

  // Rewards, ads, and vouchers are all scoped to the member's home club, so
  // switching clubs re-fetches everything rather than patching just the
  // user's homeClub/courseId fields.
  const changeHomeClub = async (courseId: string) => {
    await api.changeHomeClub(courseId);
    await loadAll();
  };

  const logAdClick = (adId: string) => {
    api.logAdClick(adId).catch(() => {
      // Best-effort — a failed click log should never block the ad from opening.
    });
  };

  const setStatsPeriod = async (period: StatsPeriod) => {
    setStatsPeriodState(period);
    try {
      const me = await api.me(period);
      setStats(me.stats);
    } catch {
      // Keep showing the previous period's stats if the refetch fails.
    }
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
    ads,
    login,
    signup,
    logout,
    redeemReward,
    submitReceipt,
    markNotificationRead,
    updateAvatar,
    updateProfile,
    updateThemePreference,
    changeHomeClub,
    sendContactEnquiry,
    listMyEnquiries,
    getEnquiryThread,
    replyToEnquiry,
    createSupportTicket,
    listMySupportTickets,
    getSupportTicketThread,
    replyToSupportTicket,
    logAdClick,
    statsPeriod,
    setStatsPeriod,
    unreadNotificationCount,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
