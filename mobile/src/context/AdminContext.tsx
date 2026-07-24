import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  adminApi,
  setAdminToken,
  type CourseProfilePayload,
  type AdSavePayload,
  type RewardSavePayload,
  type StaffCreatePayload,
  type StaffUpdatePayload,
  type SuperAdminCourseCreatePayload,
  type SuperAdminCourseCreateResponse,
} from '../api/adminClient';
import type {
  AdminAd,
  AdminBroadcast,
  AdminCourse,
  AdminEnquirySummary,
  AdminEnquiryThread,
  AdminMember,
  AdminNotification,
  AdminReward,
  AdminStaff,
  AdminUser,
  AdminVoucherLookup,
  BroadcastTarget,
  DashboardReport,
  EnquiryMessage,
  EnquiryStatus,
  MemberStats,
  MembersPage,
  SuperAdminCourseSummary,
} from '../data/adminTypes';
import { useTheme, type ThemePreference } from './ThemeContext';

const ADMIN_TOKEN_KEY = 'flagrr_admin_auth_token';
type DashboardPeriod = 'month' | 'year' | 'all';

const EMPTY_ADMIN: AdminUser = {
  id: '',
  firstName: '',
  lastName: '',
  email: '',
  username: null,
  role: 'course_admin',
  mustChangePassword: false,
  themePreference: 'system',
};
const EMPTY_COURSE: AdminCourse = {
  id: '',
  name: '',
  slug: '',
  logoUrl: null,
  coverImageUrl: null,
  contactEmail: null,
  contactPhone: null,
  address: null,
  fbPerRand: 2.8,
  onboardingCompletedAt: null,
  staffOnboardingCompletedAt: null,
};

interface AdminContextValue {
  isAdminAuthenticated: boolean;
  isInitializing: boolean;
  admin: AdminUser;
  course: AdminCourse;
  dashboard: DashboardReport | null;
  dashboardPeriod: DashboardPeriod;
  dashboardLoading: boolean;
  rewards: AdminReward[];
  ads: AdminAd[];
  notifications: AdminNotification[];
  unreadNotificationCount: number;
  loadNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  broadcasts: AdminBroadcast[];
  loadBroadcasts: () => Promise<void>;
  sendBroadcast: (payload: { title: string; body: string; target: BroadcastTarget }) => Promise<void>;
  deleteBroadcast: (id: string) => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setDashboardPeriod: (period: DashboardPeriod) => Promise<void>;
  refreshDashboard: () => Promise<void>;
  loadRewards: () => Promise<void>;
  saveReward: (payload: RewardSavePayload) => Promise<void>;
  deleteReward: (id: string) => Promise<void>;
  loadAds: () => Promise<void>;
  saveAd: (payload: AdSavePayload) => Promise<void>;
  deleteAd: (id: string) => Promise<void>;
  searchMembers: (query: string) => Promise<AdminMember[]>;
  listAllMembers: (page: number, pageSize: number) => Promise<MembersPage>;
  getMemberStats: (id: string, period: DashboardPeriod) => Promise<MemberStats>;
  lookupVoucher: (code: string) => Promise<AdminVoucherLookup>;
  redeemVoucher: (code: string) => Promise<AdminVoucherLookup>;
  listEnquiries: (status?: EnquiryStatus) => Promise<AdminEnquirySummary[]>;
  getEnquiryThread: (id: string) => Promise<AdminEnquiryThread>;
  replyToEnquiry: (enquiryId: string, message: string) => Promise<EnquiryMessage[]>;
  setEnquiryStatus: (enquiryId: string, status: EnquiryStatus) => Promise<void>;
  updateCourseProfile: (payload: CourseProfilePayload) => Promise<void>;
  updateCourseLogo: (imageBase64: string) => Promise<void>;
  updateCourseCover: (imageBase64: string) => Promise<void>;
  contactSupport: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateThemePreference: (preference: ThemePreference) => Promise<void>;
  // First-login setup wizard for a course_admin (course details, logo, cover
  // photo). Gated by course.onboardingCompletedAt (server-side, survives
  // reinstalls) — showOnboardingWizard also respects a session-only
  // "skip for now" dismissal so it doesn't reappear on every screen nav.
  showOnboardingWizard: boolean;
  dismissOnboardingWizard: () => void;
  reopenOnboardingWizard: () => void;
  completeOnboarding: () => Promise<void>;
  // A one-time welcome screen shown to a staff account right after they
  // complete their forced first-login password change (RootNavigator swaps
  // AdminForceChangePasswordScreen for this before the normal admin tabs).
  staffWelcomePending: boolean;
  dismissStaffWelcome: () => void;
  // A second wizard, chained right after the course-details wizard closes
  // (whether finished or skipped), walking a course_admin through inviting
  // their first staff member. Gated the same way: server-side
  // course.staffOnboardingCompletedAt plus a session-only dismissal.
  showStaffOnboardingWizard: boolean;
  dismissStaffOnboardingWizard: () => void;
  reopenStaffOnboardingWizard: () => void;
  completeStaffOnboarding: () => Promise<void>;
  staff: AdminStaff[];
  loadStaff: () => Promise<void>;
  createStaff: (payload: StaffCreatePayload) => Promise<AdminStaff>;
  updateStaff: (payload: StaffUpdatePayload) => Promise<AdminStaff>;
  revokeStaff: (id: string) => Promise<void>;
  reactivateStaff: (id: string) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  // super_admin only — cross-club course/course-admin management. Not scoped
  // to `course`, since a super_admin has no single course of its own.
  superAdminCourses: SuperAdminCourseSummary[];
  loadSuperAdminCourses: () => Promise<void>;
  createSuperAdminCourse: (payload: SuperAdminCourseCreatePayload) => Promise<SuperAdminCourseCreateResponse>;
}

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [admin, setAdmin] = useState<AdminUser>(EMPTY_ADMIN);
  const [course, setCourse] = useState<AdminCourse>(EMPTY_COURSE);
  const [dashboard, setDashboard] = useState<DashboardReport | null>(null);
  const [dashboardPeriod, setDashboardPeriodState] = useState<DashboardPeriod>('month');
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [ads, setAds] = useState<AdminAd[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [broadcasts, setBroadcasts] = useState<AdminBroadcast[]>([]);
  const [staff, setStaff] = useState<AdminStaff[]>([]);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [staffWelcomePending, setStaffWelcomePending] = useState(false);
  const [staffOnboardingDismissed, setStaffOnboardingDismissed] = useState(false);
  const [superAdminCourses, setSuperAdminCourses] = useState<SuperAdminCourseSummary[]>([]);

  const refreshDashboard = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const report = await adminApi.dashboard(dashboardPeriod);
      setDashboard(report);
    } finally {
      setDashboardLoading(false);
    }
  }, [dashboardPeriod]);

  const loadNotifications = useCallback(async () => {
    setNotifications(await adminApi.notifications());
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem(ADMIN_TOKEN_KEY);
        if (token) {
          await setAdminToken(token);
          const me = await adminApi.me();
          setAdmin(me.admin);
          setCourse(me.course);
          setIsAdminAuthenticated(true);
          theme.hydrateFromAccount(me.admin.themePreference);
          loadNotifications().catch(() => {});
        }
      } catch {
        await setAdminToken(null);
      } finally {
        setIsInitializing(false);
      }
    })();
  }, [loadNotifications]);

  const login = async (identifier: string, password: string) => {
    const res = await adminApi.login(identifier, password);
    await setAdminToken(res.token);
    setAdmin(res.admin);
    setCourse(res.course);
    setIsAdminAuthenticated(true);
    theme.hydrateFromAccount(res.admin.themePreference);
    loadNotifications().catch(() => {});
  };

  const logout = async () => {
    try {
      await adminApi.logout();
    } catch {
      // Best-effort — clear local state regardless of whether the server call succeeds.
    }
    await setAdminToken(null);
    setIsAdminAuthenticated(false);
    setAdmin(EMPTY_ADMIN);
    setCourse(EMPTY_COURSE);
    setDashboard(null);
    setRewards([]);
    setAds([]);
    setNotifications([]);
    setBroadcasts([]);
    setStaff([]);
    setOnboardingDismissed(false);
    setStaffWelcomePending(false);
    setStaffOnboardingDismissed(false);
    setSuperAdminCourses([]);
  };

  const markNotificationRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await adminApi.markNotificationRead(id);
    } catch {
      // Best-effort — the optimistic update stands even if the request fails.
    }
  };

  const unreadNotificationCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const loadBroadcasts = useCallback(async () => {
    setBroadcasts(await adminApi.broadcasts());
  }, []);

  const sendBroadcast = async (payload: { title: string; body: string; target: BroadcastTarget }) => {
    await adminApi.sendBroadcast(payload);
    await loadBroadcasts();
  };

  const deleteBroadcast = async (id: string) => {
    await adminApi.deleteBroadcast(id);
    setBroadcasts((prev) => prev.filter((b) => b.id !== id));
  };

  const setDashboardPeriod = async (period: DashboardPeriod) => {
    setDashboardPeriodState(period);
    setDashboardLoading(true);
    try {
      const report = await adminApi.dashboard(period);
      setDashboard(report);
    } finally {
      setDashboardLoading(false);
    }
  };

  const loadRewards = useCallback(async () => {
    setRewards(await adminApi.rewards());
  }, []);

  const saveReward = async (payload: RewardSavePayload) => {
    await adminApi.saveReward(payload);
    await loadRewards();
  };

  const deleteReward = async (id: string) => {
    await adminApi.deleteReward(id);
    await loadRewards();
  };

  const loadAds = useCallback(async () => {
    setAds(await adminApi.ads());
  }, []);

  const saveAd = async (payload: AdSavePayload) => {
    await adminApi.saveAd(payload);
    await loadAds();
  };

  const deleteAd = async (id: string) => {
    await adminApi.deleteAd(id);
    await loadAds();
  };

  const searchMembers = async (query: string) => adminApi.members(query);
  const listAllMembers = async (page: number, pageSize: number) => adminApi.membersList(page, pageSize);
  const getMemberStats = async (id: string, period: DashboardPeriod) => adminApi.memberStats(id, period);

  const lookupVoucher = async (code: string) => adminApi.lookupVoucher(code);
  const redeemVoucher = async (code: string) => adminApi.redeemVoucher(code);

  const listEnquiries = async (status?: EnquiryStatus) => adminApi.enquiries(status);
  const getEnquiryThread = async (id: string) => adminApi.enquiryThread(id);
  const replyToEnquiry = async (enquiryId: string, message: string) => adminApi.replyToEnquiry(enquiryId, message);
  const setEnquiryStatus = async (enquiryId: string, status: EnquiryStatus) => {
    await adminApi.setEnquiryStatus(enquiryId, status);
  };

  const updateCourseProfile = async (payload: CourseProfilePayload) => {
    const updated = await adminApi.updateCourseProfile(payload);
    setCourse(updated);
  };

  const updateCourseLogo = async (imageBase64: string) => {
    const res = await adminApi.updateCourseLogo(imageBase64);
    setCourse((prev) => ({ ...prev, logoUrl: res.logoUrl }));
  };

  const updateCourseCover = async (imageBase64: string) => {
    const res = await adminApi.updateCourseCover(imageBase64);
    setCourse((prev) => ({ ...prev, coverImageUrl: res.coverImageUrl }));
  };

  const contactSupport = async () => {
    await adminApi.contactSupport();
  };

  const showOnboardingWizard =
    isAdminAuthenticated && admin.role === 'course_admin' && !admin.mustChangePassword && !onboardingDismissed && course.onboardingCompletedAt === null;

  const dismissOnboardingWizard = () => setOnboardingDismissed(true);
  const reopenOnboardingWizard = () => setOnboardingDismissed(false);

  const completeOnboarding = async () => {
    const updated = await adminApi.completeOnboarding();
    setCourse(updated);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const wasFirstLogin = admin.mustChangePassword;
    await adminApi.changePassword(currentPassword, newPassword);
    setAdmin((prev) => ({ ...prev, mustChangePassword: false }));
    // Staff only ever have mustChangePassword true right after their
    // system-generated temp password is issued — this transition happens
    // exactly once per account, so it doubles as the "show the welcome
    // screen" trigger without needing a separate server-side flag.
    if (wasFirstLogin && admin.role === 'staff') {
      setStaffWelcomePending(true);
    }
  };

  const dismissStaffWelcome = () => setStaffWelcomePending(false);

  // Chained right after the course-details wizard closes (showOnboardingWizard
  // false), whether it was finished or skipped — a fresh course_admin isn't
  // interrupted by both wizards stacked at once.
  const showStaffOnboardingWizard =
    isAdminAuthenticated &&
    admin.role === 'course_admin' &&
    !admin.mustChangePassword &&
    !showOnboardingWizard &&
    !staffOnboardingDismissed &&
    course.staffOnboardingCompletedAt === null;

  const dismissStaffOnboardingWizard = () => setStaffOnboardingDismissed(true);
  const reopenStaffOnboardingWizard = () => setStaffOnboardingDismissed(false);

  const completeStaffOnboarding = async () => {
    const updated = await adminApi.completeStaffOnboarding();
    setCourse(updated);
  };

  const updateThemePreference = async (preference: ThemePreference) => {
    const res = await adminApi.updateThemePreference(preference);
    setAdmin((prev) => ({ ...prev, themePreference: res.themePreference }));
    await theme.setPreference(res.themePreference);
  };

  const loadStaff = useCallback(async () => {
    setStaff(await adminApi.staffList());
  }, []);

  const createStaff = async (payload: StaffCreatePayload) => {
    const created = await adminApi.createStaff(payload);
    await loadStaff();
    return created;
  };

  const updateStaff = async (payload: StaffUpdatePayload) => {
    const updated = await adminApi.updateStaff(payload);
    await loadStaff();
    return updated;
  };

  const revokeStaff = async (id: string) => {
    await adminApi.revokeStaff(id);
    await loadStaff();
  };

  const reactivateStaff = async (id: string) => {
    await adminApi.reactivateStaff(id);
    await loadStaff();
  };

  const deleteStaff = async (id: string) => {
    await adminApi.deleteStaff(id);
    setStaff((prev) => prev.filter((s) => s.id !== id));
  };

  const loadSuperAdminCourses = useCallback(async () => {
    setSuperAdminCourses(await adminApi.superAdminCourses());
  }, []);

  const createSuperAdminCourse = async (payload: SuperAdminCourseCreatePayload) => {
    const created = await adminApi.createSuperAdminCourse(payload);
    await loadSuperAdminCourses();
    return created;
  };

  const value: AdminContextValue = {
    isAdminAuthenticated,
    isInitializing,
    admin,
    course,
    dashboard,
    dashboardPeriod,
    dashboardLoading,
    rewards,
    ads,
    notifications,
    unreadNotificationCount,
    loadNotifications,
    markNotificationRead,
    broadcasts,
    loadBroadcasts,
    sendBroadcast,
    deleteBroadcast,
    login,
    logout,
    setDashboardPeriod,
    refreshDashboard,
    loadRewards,
    saveReward,
    deleteReward,
    loadAds,
    saveAd,
    deleteAd,
    searchMembers,
    listAllMembers,
    getMemberStats,
    lookupVoucher,
    redeemVoucher,
    listEnquiries,
    getEnquiryThread,
    replyToEnquiry,
    setEnquiryStatus,
    updateCourseProfile,
    updateCourseLogo,
    updateCourseCover,
    contactSupport,
    updateThemePreference,
    showOnboardingWizard,
    dismissOnboardingWizard,
    reopenOnboardingWizard,
    completeOnboarding,
    staffWelcomePending,
    dismissStaffWelcome,
    showStaffOnboardingWizard,
    dismissStaffOnboardingWizard,
    reopenStaffOnboardingWizard,
    completeStaffOnboarding,
    staff,
    loadStaff,
    createStaff,
    updateStaff,
    revokeStaff,
    reactivateStaff,
    deleteStaff,
    changePassword,
    superAdminCourses,
    loadSuperAdminCourses,
    createSuperAdminCourse,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
