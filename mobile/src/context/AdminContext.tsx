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
  type SuperAdminAdSavePayload,
  type SuperAdminRewardSavePayload,
  type SupportAgentCreatePayload,
} from '../api/adminClient';
import { registerForPushNotificationsAsync } from '../utils/pushNotifications';
import type {
  AdminAd,
  AdminBroadcast,
  ClubAdminSummary,
  CourseAdminAccount,
  AdminCourse,
  AdminEnquirySummary,
  AdminEnquiryThread,
  AdminMember,
  AdminNotification,
  AdminReward,
  AdminStaff,
  AdminUser,
  AdminVoucherLookup,
  AuditLogEntry,
  BroadcastTarget,
  DashboardReport,
  DuplicateReceiptAttempt,
  EnquiryMessage,
  EnquiryStatus,
  FlaggedReceipt,
  MemberRosterStatus,
  MemberRosterUploadResult,
  MemberStats,
  MembersPage,
  SuperAdminBroadcast,
  SuperAdminBroadcastTarget,
  SuperAdminCourseSummary,
  SuperAdminDashboardReport,
  SuperAdminMemberSearchResult,
  SuperAdminMemberStats,
  AdPerformanceRow,
  StatBreakdownMetric,
  StatBreakdownRow,
  StaffRedemption,
  SupportAgent,
  SupportInboxTicket,
  SupportInboxTicketThread,
  SupportTicketMessage,
  SupportTicketPriority,
  SupportTicketStatus,
  SupportTicketSummary,
  SupportTicketThread,
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
  subscriptionStatus: null,
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
  registerPushToken: (token: string, platform: 'ios' | 'android') => Promise<void>;
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
  // super_admin only — cross-club member lookup (see comments near
  // getSuperAdminMemberRosterStatus for the general pattern this follows).
  searchSuperAdminMembers: (search: string) => Promise<SuperAdminMemberSearchResult[]>;
  getSuperAdminMemberStats: (id: string, period: DashboardPeriod) => Promise<SuperAdminMemberStats>;
  lookupVoucher: (code: string) => Promise<AdminVoucherLookup>;
  redeemVoucher: (code: string) => Promise<AdminVoucherLookup>;
  listEnquiries: (status?: EnquiryStatus) => Promise<AdminEnquirySummary[]>;
  getEnquiryThread: (id: string) => Promise<AdminEnquiryThread>;
  replyToEnquiry: (enquiryId: string, message: string) => Promise<EnquiryMessage[]>;
  setEnquiryStatus: (enquiryId: string, status: EnquiryStatus) => Promise<void>;
  updateCourseProfile: (payload: CourseProfilePayload) => Promise<void>;
  // Member roster (course_admin side) — used to validate signups are
  // actually members of this club. See tiers.ts for the effect on tier
  // progress when a member never matches.
  getMemberRosterStatus: () => Promise<MemberRosterStatus>;
  uploadMemberRoster: (fileName: string, fileBase64: string) => Promise<MemberRosterUploadResult>;
  updateCourseLogo: (imageBase64: string) => Promise<void>;
  updateCourseCover: (imageBase64: string) => Promise<void>;
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
  getStaffRedemptions: () => Promise<StaffRedemption[]>;
  // course_admin's own read-only view of who administers their club, plus
  // the ability to add exactly one more themselves (capped server-side at
  // MAX_COURSE_ADMINS_PER_CLUB) — no reset/revoke/delete (super_admin only).
  getClubAdmins: () => Promise<ClubAdminSummary[]>;
  inviteClubAdmin: (payload: { firstName: string; lastName: string; email: string }) => Promise<ClubAdminSummary>;
  // super_admin only — cross-club course/course-admin management. Not scoped
  // to `course`, since a super_admin has no single course of its own.
  superAdminCourses: SuperAdminCourseSummary[];
  loadSuperAdminCourses: () => Promise<void>;
  createSuperAdminCourse: (payload: SuperAdminCourseCreatePayload) => Promise<SuperAdminCourseCreateResponse>;
  // Per-course, fetched on demand rather than cached globally — mirrors
  // getMemberStats's pattern of a thin passthrough whose caller owns the
  // resulting list in its own local state.
  getSuperAdminAds: (courseId: string) => Promise<AdminAd[]>;
  saveSuperAdminAd: (payload: SuperAdminAdSavePayload) => Promise<{ id: string }>;
  deleteSuperAdminAd: (courseId: string, id: string) => Promise<void>;
  getSuperAdminRewards: (courseId: string) => Promise<AdminReward[]>;
  saveSuperAdminReward: (payload: SuperAdminRewardSavePayload) => Promise<{ id: string }>;
  deleteSuperAdminReward: (courseId: string, id: string) => Promise<void>;
  cancelSuperAdminCourseSubscription: (courseId: string) => Promise<void>;
  reactivateSuperAdminCourseSubscription: (courseId: string) => Promise<void>;
  archiveSuperAdminCourse: (courseId: string) => Promise<void>;
  unarchiveSuperAdminCourse: (courseId: string) => Promise<void>;
  // A super_admin can upload a club's member roster on its behalf, same
  // effect as the course_admin action above but with an explicit courseId.
  getSuperAdminMemberRosterStatus: (courseId: string) => Promise<MemberRosterStatus>;
  uploadSuperAdminMemberRoster: (courseId: string, fileName: string, fileBase64: string) => Promise<MemberRosterUploadResult>;
  // Push notifications — same idea as broadcasts above, but platform-wide
  // (member/tier targets reach every club, 'course_admins' reaches every
  // course_admin account) rather than scoped to one club's own members.
  superAdminBroadcasts: SuperAdminBroadcast[];
  loadSuperAdminBroadcasts: () => Promise<void>;
  sendSuperAdminBroadcast: (payload: { title: string; body: string; target: SuperAdminBroadcastTarget; courseId?: string | null }) => Promise<void>;
  deleteSuperAdminBroadcast: (id: string) => Promise<void>;
  // Per-course, fetched on demand — mirrors getSuperAdminAds/getSuperAdminRewards's
  // pattern of a thin passthrough whose caller owns the resulting list.
  getSuperAdminCourseAdmins: (courseId: string) => Promise<CourseAdminAccount[]>;
  createSuperAdminCourseAdmin: (payload: { courseId: string; firstName: string; lastName: string; email: string }) => Promise<CourseAdminAccount>;
  resetSuperAdminCourseAdminPassword: (id: string) => Promise<void>;
  revokeSuperAdminCourseAdmin: (id: string) => Promise<void>;
  reactivateSuperAdminCourseAdmin: (id: string) => Promise<void>;
  deleteSuperAdminCourseAdmin: (id: string) => Promise<void>;
  getSuperAdminDashboard: (period: DashboardPeriod) => Promise<SuperAdminDashboardReport>;
  getSuperAdminAdPerformance: () => Promise<AdPerformanceRow[]>;
  getSuperAdminStatBreakdown: (metric: StatBreakdownMetric, period: DashboardPeriod) => Promise<StatBreakdownRow[]>;
  // Support Centre (course_admin/staff requester side — a ticket to the
  // Flagrr team, distinct from the per-club 'enquiries' above).
  createSupportTicket: (subject: string, message: string) => Promise<string>;
  listSupportTickets: () => Promise<SupportTicketSummary[]>;
  getSupportTicketThread: (id: string) => Promise<SupportTicketThread>;
  replyToSupportTicket: (ticketId: string, message: string) => Promise<SupportTicketMessage[]>;
  // Support Centre (super_admin/support_agent inbox side)
  getSupportInbox: (
    status?: SupportTicketStatus,
    priority?: SupportTicketPriority,
    assigned?: 'mine' | 'unassigned',
  ) => Promise<SupportInboxTicket[]>;
  getSupportInboxThread: (id: string) => Promise<SupportInboxTicketThread>;
  replyToSupportInboxTicket: (ticketId: string, message: string) => Promise<SupportTicketMessage[]>;
  setSupportTicketStatus: (ticketId: string, status: SupportTicketStatus) => Promise<void>;
  setSupportTicketPriority: (ticketId: string, priority: SupportTicketPriority) => Promise<void>;
  claimSupportTicket: (ticketId: string) => Promise<void>;
  unassignSupportTicket: (ticketId: string) => Promise<void>;
  // Support agent account management (super_admin only)
  supportAgents: SupportAgent[];
  loadSupportAgents: () => Promise<void>;
  createSupportAgent: (payload: SupportAgentCreatePayload) => Promise<SupportAgent>;
  resetSupportAgentPassword: (id: string) => Promise<void>;
  revokeSupportAgent: (id: string) => Promise<void>;
  reactivateSupportAgent: (id: string) => Promise<void>;
  deleteSupportAgent: (id: string) => Promise<void>;
  // Audit log (super_admin only) — thin passthrough, same as getClubAdmins/
  // getSuperAdminCourseAdmins; the caller owns the resulting list.
  getAuditLog: () => Promise<AuditLogEntry[]>;
  // Cross-club fraud oversight (super_admin only) — same thin-passthrough pattern.
  getSuperAdminFlaggedReceipts: () => Promise<FlaggedReceipt[]>;
  confirmSuperAdminReceiptFraud: (id: string) => Promise<void>;
  clearSuperAdminReceiptFlag: (id: string) => Promise<void>;
  getSuperAdminDuplicateAttempts: () => Promise<DuplicateReceiptAttempt[]>;
  getSuperAdminReceiptImage: (id: string) => Promise<string | null>;
  // This club's own flagged-receipts review queue (course_admin only).
  getFlaggedReceipts: () => Promise<FlaggedReceipt[]>;
  confirmReceiptFraud: (id: string) => Promise<void>;
  clearReceiptFlag: (id: string) => Promise<void>;
  getReceiptImage: (id: string) => Promise<string | null>;
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
  const [supportAgents, setSupportAgents] = useState<SupportAgent[]>([]);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [staffWelcomePending, setStaffWelcomePending] = useState(false);
  const [staffOnboardingDismissed, setStaffOnboardingDismissed] = useState(false);
  const [superAdminCourses, setSuperAdminCourses] = useState<SuperAdminCourseSummary[]>([]);
  const [superAdminBroadcasts, setSuperAdminBroadcasts] = useState<SuperAdminBroadcast[]>([]);

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
          registerPushTokenIfCourseAdmin(me.admin.role);
        }
      } catch {
        await setAdminToken(null);
      } finally {
        setIsInitializing(false);
      }
    })();
  }, [loadNotifications]);

  const registerPushToken = async (token: string, platform: 'ios' | 'android') => {
    await adminApi.registerPushToken(token, platform);
  };

  // Only a course_admin can currently be targeted by a super_admin broadcast
  // (see superAdminBroadcastSend in api/admin/index.ts) — fire-and-forget,
  // same as the member app's own registration, and a silent no-op until a
  // native build with an EAS project exists.
  const registerPushTokenIfCourseAdmin = (role: string) => {
    if (role !== 'course_admin') return;
    registerForPushNotificationsAsync().then((result) => {
      if (result) registerPushToken(result.token, result.platform).catch(() => {});
    });
  };

  const login = async (identifier: string, password: string) => {
    const res = await adminApi.login(identifier, password);
    await setAdminToken(res.token);
    setAdmin(res.admin);
    setCourse(res.course);
    setIsAdminAuthenticated(true);
    theme.hydrateFromAccount(res.admin.themePreference);
    loadNotifications().catch(() => {});
    registerPushTokenIfCourseAdmin(res.admin.role);
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
    setSuperAdminBroadcasts([]);
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
  const searchSuperAdminMembers = async (search: string) => adminApi.superAdminMembers(search);
  const getSuperAdminMemberStats = async (id: string, period: DashboardPeriod) => adminApi.superAdminMemberStats(id, period);

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

  const getMemberRosterStatus = async () => adminApi.memberRosterStatus();
  const uploadMemberRoster = async (fileName: string, fileBase64: string) => adminApi.uploadMemberRoster(fileName, fileBase64);

  const updateCourseLogo = async (imageBase64: string) => {
    const res = await adminApi.updateCourseLogo(imageBase64);
    setCourse((prev) => ({ ...prev, logoUrl: res.logoUrl }));
  };

  const updateCourseCover = async (imageBase64: string) => {
    const res = await adminApi.updateCourseCover(imageBase64);
    setCourse((prev) => ({ ...prev, coverImageUrl: res.coverImageUrl }));
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

  const getClubAdmins = async () => adminApi.courseAdmins();
  const inviteClubAdmin = async (payload: { firstName: string; lastName: string; email: string }) =>
    adminApi.inviteCourseAdmin(payload);

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

  const getStaffRedemptions = async (): Promise<StaffRedemption[]> => adminApi.staffRedemptions();

  const loadSuperAdminCourses = useCallback(async () => {
    setSuperAdminCourses(await adminApi.superAdminCourses());
  }, []);

  const createSuperAdminCourse = async (payload: SuperAdminCourseCreatePayload) => {
    const created = await adminApi.createSuperAdminCourse(payload);
    await loadSuperAdminCourses();
    return created;
  };

  const getSuperAdminAds = async (courseId: string) => adminApi.superAdminAds(courseId);
  const saveSuperAdminAd = async (payload: SuperAdminAdSavePayload) => adminApi.saveSuperAdminAd(payload);
  const deleteSuperAdminAd = async (courseId: string, id: string) => {
    await adminApi.deleteSuperAdminAd(courseId, id);
  };

  const getSuperAdminRewards = async (courseId: string) => adminApi.superAdminRewards(courseId);
  const saveSuperAdminReward = async (payload: SuperAdminRewardSavePayload) => adminApi.saveSuperAdminReward(payload);
  const deleteSuperAdminReward = async (courseId: string, id: string) => {
    await adminApi.deleteSuperAdminReward(courseId, id);
  };

  const cancelSuperAdminCourseSubscription = async (courseId: string) => {
    await adminApi.cancelSuperAdminCourseSubscription(courseId);
    await loadSuperAdminCourses();
  };

  const reactivateSuperAdminCourseSubscription = async (courseId: string) => {
    await adminApi.reactivateSuperAdminCourseSubscription(courseId);
    await loadSuperAdminCourses();
  };

  const archiveSuperAdminCourse = async (courseId: string) => {
    await adminApi.archiveSuperAdminCourse(courseId);
    await loadSuperAdminCourses();
  };

  const unarchiveSuperAdminCourse = async (courseId: string) => {
    await adminApi.unarchiveSuperAdminCourse(courseId);
    await loadSuperAdminCourses();
  };

  const getSuperAdminMemberRosterStatus = async (courseId: string) => adminApi.superAdminMemberRosterStatus(courseId);
  const uploadSuperAdminMemberRoster = async (courseId: string, fileName: string, fileBase64: string) =>
    adminApi.uploadSuperAdminMemberRoster(courseId, fileName, fileBase64);

  const loadSuperAdminBroadcasts = useCallback(async () => {
    setSuperAdminBroadcasts(await adminApi.superAdminBroadcasts());
  }, []);

  const sendSuperAdminBroadcast = async (payload: { title: string; body: string; target: SuperAdminBroadcastTarget; courseId?: string | null }) => {
    await adminApi.sendSuperAdminBroadcast(payload);
    await loadSuperAdminBroadcasts();
  };

  const deleteSuperAdminBroadcast = async (id: string) => {
    await adminApi.deleteSuperAdminBroadcast(id);
    setSuperAdminBroadcasts((prev) => prev.filter((b) => b.id !== id));
  };

  const getSuperAdminCourseAdmins = async (courseId: string) => adminApi.superAdminCourseAdmins(courseId);
  const createSuperAdminCourseAdmin = async (payload: { courseId: string; firstName: string; lastName: string; email: string }) =>
    adminApi.createSuperAdminCourseAdmin(payload);
  const resetSuperAdminCourseAdminPassword = async (id: string) => {
    await adminApi.resetSuperAdminCourseAdminPassword(id);
  };
  const revokeSuperAdminCourseAdmin = async (id: string) => {
    await adminApi.revokeSuperAdminCourseAdmin(id);
  };
  const reactivateSuperAdminCourseAdmin = async (id: string) => {
    await adminApi.reactivateSuperAdminCourseAdmin(id);
  };
  const deleteSuperAdminCourseAdmin = async (id: string) => {
    await adminApi.deleteSuperAdminCourseAdmin(id);
  };

  const getSuperAdminDashboard = async (period: DashboardPeriod) => adminApi.superAdminDashboard(period);
  const getSuperAdminAdPerformance = async () => adminApi.superAdminAdPerformance();

  const getSuperAdminStatBreakdown = async (metric: StatBreakdownMetric, period: DashboardPeriod) =>
    adminApi.superAdminStatBreakdown(metric, period);

  const createSupportTicket = async (subject: string, message: string) => {
    const res = await adminApi.createSupportTicket(subject, message);
    return res.ticketId;
  };
  const listSupportTickets = async () => adminApi.supportTickets();
  const getSupportTicketThread = async (id: string) => adminApi.supportTicketThread(id);
  const replyToSupportTicket = async (ticketId: string, message: string) => adminApi.replyToSupportTicket(ticketId, message);

  const getSupportInbox = async (
    status?: SupportTicketStatus,
    priority?: SupportTicketPriority,
    assigned?: 'mine' | 'unassigned',
  ) => adminApi.supportInbox(status, priority, assigned);
  const getSupportInboxThread = async (id: string) => adminApi.supportInboxThread(id);
  const replyToSupportInboxTicket = async (ticketId: string, message: string) =>
    adminApi.replyToSupportInboxTicket(ticketId, message);
  const setSupportTicketStatus = async (ticketId: string, status: SupportTicketStatus) => {
    await adminApi.setSupportTicketStatus(ticketId, status);
  };
  const claimSupportTicket = async (ticketId: string) => {
    await adminApi.claimSupportTicket(ticketId);
  };
  const unassignSupportTicket = async (ticketId: string) => {
    await adminApi.unassignSupportTicket(ticketId);
  };
  const setSupportTicketPriority = async (ticketId: string, priority: SupportTicketPriority) => {
    await adminApi.setSupportTicketPriority(ticketId, priority);
  };

  const loadSupportAgents = useCallback(async () => {
    setSupportAgents(await adminApi.supportAgents());
  }, []);
  const createSupportAgent = async (payload: SupportAgentCreatePayload) => {
    const created = await adminApi.createSupportAgent(payload);
    await loadSupportAgents();
    return created;
  };
  const resetSupportAgentPassword = async (id: string) => {
    await adminApi.resetSupportAgentPassword(id);
  };
  const revokeSupportAgent = async (id: string) => {
    await adminApi.revokeSupportAgent(id);
    await loadSupportAgents();
  };
  const reactivateSupportAgent = async (id: string) => {
    await adminApi.reactivateSupportAgent(id);
    await loadSupportAgents();
  };
  const deleteSupportAgent = async (id: string) => {
    await adminApi.deleteSupportAgent(id);
    setSupportAgents((prev) => prev.filter((a) => a.id !== id));
  };

  const getAuditLog = async (): Promise<AuditLogEntry[]> => adminApi.auditLog();

  const getSuperAdminFlaggedReceipts = async (): Promise<FlaggedReceipt[]> => adminApi.superAdminFlaggedReceipts();
  const confirmSuperAdminReceiptFraud = async (id: string) => {
    await adminApi.superAdminConfirmReceiptFraud(id);
  };
  const clearSuperAdminReceiptFlag = async (id: string) => {
    await adminApi.superAdminClearReceiptFlag(id);
  };
  const getSuperAdminDuplicateAttempts = async (): Promise<DuplicateReceiptAttempt[]> => adminApi.superAdminDuplicateAttempts();
  const getSuperAdminReceiptImage = async (id: string): Promise<string | null> =>
    (await adminApi.superAdminReceiptImage(id)).imageData;

  const getFlaggedReceipts = async (): Promise<FlaggedReceipt[]> => adminApi.flaggedReceipts();
  const confirmReceiptFraud = async (id: string) => {
    await adminApi.confirmReceiptFraud(id);
  };
  const clearReceiptFlag = async (id: string) => {
    await adminApi.clearReceiptFlag(id);
  };
  const getReceiptImage = async (id: string): Promise<string | null> => (await adminApi.receiptImage(id)).imageData;

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
    registerPushToken,
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
    searchSuperAdminMembers,
    getSuperAdminMemberStats,
    lookupVoucher,
    redeemVoucher,
    listEnquiries,
    getEnquiryThread,
    replyToEnquiry,
    setEnquiryStatus,
    updateCourseProfile,
    getMemberRosterStatus,
    uploadMemberRoster,
    updateCourseLogo,
    updateCourseCover,
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
    getClubAdmins,
    inviteClubAdmin,
    loadStaff,
    createStaff,
    updateStaff,
    revokeStaff,
    reactivateStaff,
    deleteStaff,
    getStaffRedemptions,
    changePassword,
    superAdminCourses,
    loadSuperAdminCourses,
    createSuperAdminCourse,
    getSuperAdminAds,
    saveSuperAdminAd,
    deleteSuperAdminAd,
    getSuperAdminRewards,
    saveSuperAdminReward,
    deleteSuperAdminReward,
    cancelSuperAdminCourseSubscription,
    reactivateSuperAdminCourseSubscription,
    archiveSuperAdminCourse,
    unarchiveSuperAdminCourse,
    getSuperAdminMemberRosterStatus,
    uploadSuperAdminMemberRoster,
    superAdminBroadcasts,
    loadSuperAdminBroadcasts,
    sendSuperAdminBroadcast,
    deleteSuperAdminBroadcast,
    getSuperAdminCourseAdmins,
    createSuperAdminCourseAdmin,
    resetSuperAdminCourseAdminPassword,
    revokeSuperAdminCourseAdmin,
    reactivateSuperAdminCourseAdmin,
    deleteSuperAdminCourseAdmin,
    getSuperAdminDashboard,
    getSuperAdminAdPerformance,
    getSuperAdminStatBreakdown,
    createSupportTicket,
    listSupportTickets,
    getSupportTicketThread,
    replyToSupportTicket,
    getSupportInbox,
    getSupportInboxThread,
    replyToSupportInboxTicket,
    setSupportTicketStatus,
    setSupportTicketPriority,
    claimSupportTicket,
    unassignSupportTicket,
    supportAgents,
    loadSupportAgents,
    createSupportAgent,
    resetSupportAgentPassword,
    revokeSupportAgent,
    reactivateSupportAgent,
    deleteSupportAgent,
    getAuditLog,
    getSuperAdminFlaggedReceipts,
    confirmSuperAdminReceiptFraud,
    clearSuperAdminReceiptFlag,
    getSuperAdminDuplicateAttempts,
    getSuperAdminReceiptImage,
    getFlaggedReceipts,
    confirmReceiptFraud,
    clearReceiptFlag,
    getReceiptImage,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
