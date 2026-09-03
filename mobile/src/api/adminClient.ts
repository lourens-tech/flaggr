import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
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
  ClubAdminSummary,
  CourseAdminAccount,
  AdminUser,
  AdminVoucherLookup,
  AuditLogEntry,
  BroadcastTarget,
  CatalogActivity,
  CatalogActivitySavePayload,
  CatalogProduct,
  CatalogProductSavePayload,
  CourseReportKind,
  DashboardReport,
  DuplicateReceiptAttempt,
  EnquiryMessage,
  EnquiryStatus,
  FlaggedReceipt,
  MemberReportRow,
  MemberRosterStatus,
  MemberRosterUploadResult,
  MemberStats,
  MembersPage,
  RedemptionReportRow,
  ReceiptReportRow,
  SuperAdminMemberReportRow,
  SuperAdminRedemptionReportRow,
  SuperAdminReportKind,
  SuperAdminBroadcast,
  SuperAdminBroadcastTarget,
  SuperAdminCourseSummary,
  SuperAdminDashboardReport,
  SuperAdminMemberSearchResult,
  SuperAdminMemberStats,
  AdClickLogRow,
  AdPerformanceRow,
  AdTrendPoint,
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

// Deliberately separate from api/client.ts's token/base logic — a
// course-admin session is a completely different identity from a member
// session (separate admins/admin_sessions tables server-side), and keeping
// the client-side storage/token isolated means the two can never bleed
// into each other on a shared device.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://app.flagrr.com';
const ADMIN_TOKEN_KEY = 'flagrr_admin_auth_token';

let cachedToken: string | null | undefined;

async function getToken(): Promise<string | null> {
  if (cachedToken === undefined) {
    cachedToken = await AsyncStorage.getItem(ADMIN_TOKEN_KEY);
  }
  return cachedToken;
}

export async function setAdminToken(token: string | null): Promise<void> {
  cachedToken = token;
  if (token) {
    await AsyncStorage.setItem(ADMIN_TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(ADMIN_TOKEN_KEY);
  }
}

export class AdminApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  auth?: boolean; // defaults to true
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.auth !== false) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}/api/admin${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new AdminApiError(res.status, (data && data.error) || `Request to ${path} failed`);
  }
  return data as T;
}

export interface AdminLoginResponse {
  token: string;
  admin: AdminUser;
  course: AdminCourse;
}

export interface RewardVariantPayload {
  id?: string;
  label: string;
  randValue: number | null;
  cost?: number;
  sortOrder: number;
  active: boolean;
}

export interface RewardSavePayload {
  id?: string;
  title: string;
  description: string;
  category: string;
  imageBase64?: string;
  active: boolean;
  variants: RewardVariantPayload[];
}

export interface AdSavePayload {
  id?: string;
  placement: 'home' | 'home_top' | 'rewards_shop';
  title: string;
  imageBase64?: string;
  mediaType?: 'image' | 'gif' | 'video';
  targetUrl: string | null;
  sortOrder: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

export interface CourseProfilePayload {
  name: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
}

export interface StaffCreatePayload {
  firstName: string;
  lastName: string;
  email: string;
}

export interface StaffUpdatePayload {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
}

export interface SuperAdminCourseCreatePayload {
  courseName: string;
  contactEmail?: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
}

export interface SuperAdminCourseCreateResponse {
  course: SuperAdminCourseSummary;
  admin: { id: string; firstName: string; lastName: string; email: string };
}

export interface SuperAdminAdSavePayload extends AdSavePayload {
  courseId: string;
}

export interface SuperAdminRewardSavePayload extends RewardSavePayload {
  courseId: string;
}

export interface SuperAdminCatalogProductSavePayload extends CatalogProductSavePayload {
  courseId: string;
}

export interface SuperAdminCatalogActivitySavePayload extends CatalogActivitySavePayload {
  courseId: string;
}

export interface SupportAgentCreatePayload {
  firstName: string;
  lastName: string;
  email: string;
}

export const adminApi = {
  // `identifier` is a course_admin/super_admin's email, or a staff
  // account's generated username — one login screen serves both, and the
  // server checks whichever applies to the matched account's role.
  login: (identifier: string, password: string) =>
    request<AdminLoginResponse>('?action=login', { method: 'POST', body: { identifier, password }, auth: false }),

  forgotPassword: (identifier: string) =>
    request<{ ok: boolean }>('?action=adminForgotPassword', { method: 'POST', body: { identifier }, auth: false }),

  resetPassword: (identifier: string, code: string, newPassword: string) =>
    request<{ ok: boolean }>('?action=adminResetPassword', {
      method: 'POST',
      body: { identifier, code, newPassword },
      auth: false,
    }),

  logout: () => request<{ ok: boolean }>('?action=logout', { method: 'POST' }),

  me: () => request<{ admin: AdminUser; course: AdminCourse }>('?action=me'),

  dashboard: (period: 'month' | 'year' | 'all') =>
    request<DashboardReport>(`?action=dashboard&period=${period}`),

  // Backs each Overview stat card's detail table — same underlying rows as
  // downloadReport's Excel file for that report, just as JSON.
  reportRows: <K extends CourseReportKind>(report: K, period: 'month' | 'year' | 'all') =>
    request<K extends 'redemptions' ? RedemptionReportRow[] : K extends 'receipts' ? ReceiptReportRow[] : MemberReportRow[]>(
      `?action=reportRows&report=${report}&period=${period}`,
    ),

  // --- This club's own flagged-receipts review queue (course_admin only) ---
  flaggedReceipts: () => request<FlaggedReceipt[]>('?action=flaggedReceipts'),
  confirmReceiptFraud: (id: string, reason: string) =>
    request<{ ok: boolean }>('?action=confirmReceiptFraud', { method: 'POST', body: { id, reason } }),
  approveReceipt: (id: string) => request<{ ok: boolean }>('?action=approveReceipt', { method: 'POST', body: { id } }),
  receiptImage: (id: string) => request<{ imageData: string | null }>(`?action=receiptImage&id=${encodeURIComponent(id)}`),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>('?action=changePassword', { method: 'POST', body: { currentPassword, newPassword } }),

  updateThemePreference: (preference: 'system' | 'light' | 'dark') =>
    request<{ themePreference: 'system' | 'light' | 'dark' }>('?action=themePreference', {
      method: 'POST',
      body: { preference },
    }),

  updateCourseProfile: (payload: CourseProfilePayload) =>
    request<AdminCourse>('?action=courseProfile', { method: 'POST', body: payload }),

  updateCourseLogo: (imageBase64: string) =>
    request<{ logoUrl: string }>('?action=courseLogo', { method: 'POST', body: { imageBase64 } }),

  updateCourseCover: (imageBase64: string) =>
    request<{ coverImageUrl: string }>('?action=courseCover', { method: 'POST', body: { imageBase64 } }),

  memberRosterStatus: () => request<MemberRosterStatus>('?action=memberRosterStatus'),

  uploadMemberRoster: (fileName: string, fileBase64: string) =>
    request<MemberRosterUploadResult>('?action=memberRosterUpload', { method: 'POST', body: { fileName, fileBase64 } }),

  completeOnboarding: () => request<AdminCourse>('?action=completeOnboarding', { method: 'POST' }),
  completeStaffOnboarding: () => request<AdminCourse>('?action=completeStaffOnboarding', { method: 'POST' }),


  courseAdmins: () => request<ClubAdminSummary[]>('?action=courseAdmins'),

  inviteCourseAdmin: (payload: { firstName: string; lastName: string; email: string }) =>
    request<ClubAdminSummary>('?action=courseAdminInvite', { method: 'POST', body: payload }),

  revokeCourseAdmin: (id: string) => request<{ ok: boolean }>('?action=courseAdminRevoke', { method: 'POST', body: { id } }),

  reactivateCourseAdmin: (id: string) =>
    request<{ ok: boolean }>('?action=courseAdminReactivate', { method: 'POST', body: { id } }),

  deleteCourseAdmin: (id: string) => request<{ ok: boolean }>('?action=courseAdminDelete', { method: 'POST', body: { id } }),

  staffList: () => request<AdminStaff[]>('?action=staffList'),

  createStaff: (payload: StaffCreatePayload) =>
    request<AdminStaff>('?action=staffCreate', { method: 'POST', body: payload }),

  updateStaff: (payload: StaffUpdatePayload) =>
    request<AdminStaff>('?action=staffUpdate', { method: 'POST', body: payload }),

  revokeStaff: (id: string) => request<{ ok: boolean }>('?action=staffRevoke', { method: 'POST', body: { id } }),

  reactivateStaff: (id: string) => request<{ ok: boolean }>('?action=staffReactivate', { method: 'POST', body: { id } }),

  deleteStaff: (id: string) => request<{ ok: boolean }>('?action=staffDelete', { method: 'POST', body: { id } }),

  staffRedemptions: () => request<StaffRedemption[]>('?action=staffRedemptions'),

  rewards: () => request<AdminReward[]>('?action=rewards'),

  saveReward: (payload: RewardSavePayload) =>
    request<{ id: string }>('?action=rewardSave', { method: 'POST', body: payload }),

  deleteReward: (id: string) => request<{ ok: boolean }>('?action=rewardDelete', { method: 'POST', body: { id } }),

  catalogProducts: () => request<CatalogProduct[]>('?action=catalogProducts'),

  saveCatalogProduct: (payload: CatalogProductSavePayload) =>
    request<{ id: string }>('?action=catalogProductSave', { method: 'POST', body: payload }),

  deleteCatalogProduct: (id: string) =>
    request<{ ok: boolean }>('?action=catalogProductDelete', { method: 'POST', body: { id } }),

  catalogActivities: () => request<CatalogActivity[]>('?action=catalogActivities'),

  saveCatalogActivity: (payload: CatalogActivitySavePayload) =>
    request<{ id: string }>('?action=catalogActivitySave', { method: 'POST', body: payload }),

  deleteCatalogActivity: (id: string) =>
    request<{ ok: boolean }>('?action=catalogActivityDelete', { method: 'POST', body: { id } }),

  ads: () => request<AdminAd[]>('?action=ads'),

  saveAd: (payload: AdSavePayload) => request<{ id: string }>('?action=adSave', { method: 'POST', body: payload }),

  deleteAd: (id: string) => request<{ ok: boolean }>('?action=adDelete', { method: 'POST', body: { id } }),

  members: (search: string) =>
    request<AdminMember[]>(`?action=members&search=${encodeURIComponent(search)}`),

  membersList: (page: number, pageSize: number) =>
    request<MembersPage>(`?action=membersList&page=${page}&pageSize=${pageSize}`),

  memberStats: (id: string, period: 'month' | 'year' | 'all') =>
    request<MemberStats>(`?action=memberStats&id=${id}&period=${period}`),

  superAdminMembers: (search: string) =>
    request<SuperAdminMemberSearchResult[]>(`?action=superAdminMembers&search=${encodeURIComponent(search)}`),

  superAdminMemberStats: (id: string, period: 'month' | 'year' | 'all') =>
    request<SuperAdminMemberStats>(`?action=superAdminMemberStats&id=${encodeURIComponent(id)}&period=${period}`),

  superAdminGiftFlagrrCash: (userId: string, amount: number, reason: string) =>
    request<{ ok: boolean; newBalance: number }>('?action=superAdminGiftFlagrrCash', {
      method: 'POST',
      body: { userId, amount, reason },
    }),

  broadcasts: () => request<AdminBroadcast[]>('?action=broadcasts'),

  sendBroadcast: (payload: { title: string; body: string; target: BroadcastTarget }) =>
    request<AdminBroadcast>('?action=broadcastSend', { method: 'POST', body: payload }),

  deleteBroadcast: (id: string) =>
    request<{ ok: boolean }>('?action=broadcastDelete', { method: 'POST', body: { id } }),

  registerPushToken: (token: string, platform: 'ios' | 'android') =>
    request<{ ok: boolean }>('?action=registerPushToken', { method: 'POST', body: { token, platform } }),

  notifications: () => request<AdminNotification[]>('?action=notifications'),

  markNotificationRead: (id: string) =>
    request<{ ok: boolean }>('?action=notificationRead', { method: 'POST', body: { id } }),

  enquiries: (status?: EnquiryStatus) =>
    request<AdminEnquirySummary[]>(`?action=enquiries${status ? `&status=${status}` : ''}`),

  enquiryThread: (id: string) => request<AdminEnquiryThread>(`?action=enquiryThread&id=${id}`),

  replyToEnquiry: (enquiryId: string, message: string) =>
    request<EnquiryMessage[]>('?action=enquiryReply', { method: 'POST', body: { enquiryId, message } }),

  setEnquiryStatus: (enquiryId: string, status: EnquiryStatus) =>
    request<{ ok: boolean }>('?action=enquiryStatus', { method: 'POST', body: { enquiryId, status } }),

  lookupVoucher: (code: string) =>
    request<AdminVoucherLookup>(`?action=voucherLookup&code=${encodeURIComponent(code)}`),

  redeemVoucher: (code: string) =>
    request<AdminVoucherLookup>('?action=voucherRedeem', { method: 'POST', body: { code } }),

  superAdminCourses: () => request<SuperAdminCourseSummary[]>('?action=superAdminCourses'),

  createSuperAdminCourse: (payload: SuperAdminCourseCreatePayload) =>
    request<SuperAdminCourseCreateResponse>('?action=superAdminCourseCreate', { method: 'POST', body: payload }),

  superAdminAds: (courseId: string) =>
    request<AdminAd[]>(`?action=superAdminAds&courseId=${encodeURIComponent(courseId)}`),

  // Read-only oversight into any club's own enquiries inbox (member <->
  // course_admin) — a super_admin can't reply here, that stays with the club.
  superAdminCourseEnquiries: (courseId: string, status?: EnquiryStatus) =>
    request<AdminEnquirySummary[]>(
      `?action=superAdminCourseEnquiries&courseId=${encodeURIComponent(courseId)}${status ? `&status=${status}` : ''}`,
    ),

  superAdminEnquiryThread: (courseId: string, id: string) =>
    request<AdminEnquiryThread>(
      `?action=superAdminEnquiryThread&courseId=${encodeURIComponent(courseId)}&id=${encodeURIComponent(id)}`,
    ),

  saveSuperAdminAd: (payload: SuperAdminAdSavePayload) =>
    request<{ id: string }>('?action=superAdminAdSave', { method: 'POST', body: payload }),

  deleteSuperAdminAd: (courseId: string, id: string) =>
    request<{ ok: boolean }>('?action=superAdminAdDelete', { method: 'POST', body: { courseId, id } }),

  superAdminDashboard: (period: 'month' | 'year' | 'all') =>
    request<SuperAdminDashboardReport>(`?action=superAdminDashboard&period=${period}`),

  superAdminAdPerformance: (period: 'month' | 'year' | 'all') =>
    request<AdPerformanceRow[]>(`?action=superAdminAdPerformance&period=${period}`),

  superAdminAdTrend: (period: 'month' | 'year' | 'all', adId?: string) =>
    request<AdTrendPoint[]>(`?action=superAdminAdTrend&period=${period}${adId ? `&adId=${encodeURIComponent(adId)}` : ''}`),

  superAdminAdClickLog: (adId: string, period: 'month' | 'year' | 'all') =>
    request<AdClickLogRow[]>(`?action=superAdminAdClickLog&adId=${encodeURIComponent(adId)}&period=${period}`),

  superAdminRewards: (courseId: string) =>
    request<AdminReward[]>(`?action=superAdminRewards&courseId=${encodeURIComponent(courseId)}`),

  saveSuperAdminReward: (payload: SuperAdminRewardSavePayload) =>
    request<{ id: string }>('?action=superAdminRewardSave', { method: 'POST', body: payload }),

  deleteSuperAdminReward: (courseId: string, id: string) =>
    request<{ ok: boolean }>('?action=superAdminRewardDelete', { method: 'POST', body: { courseId, id } }),

  superAdminCatalogProducts: (courseId: string) =>
    request<CatalogProduct[]>(`?action=superAdminCatalogProducts&courseId=${encodeURIComponent(courseId)}`),

  saveSuperAdminCatalogProduct: (payload: SuperAdminCatalogProductSavePayload) =>
    request<{ id: string }>('?action=superAdminCatalogProductSave', { method: 'POST', body: payload }),

  deleteSuperAdminCatalogProduct: (courseId: string, id: string) =>
    request<{ ok: boolean }>('?action=superAdminCatalogProductDelete', { method: 'POST', body: { courseId, id } }),

  superAdminCatalogActivities: (courseId: string) =>
    request<CatalogActivity[]>(`?action=superAdminCatalogActivities&courseId=${encodeURIComponent(courseId)}`),

  saveSuperAdminCatalogActivity: (payload: SuperAdminCatalogActivitySavePayload) =>
    request<{ id: string }>('?action=superAdminCatalogActivitySave', { method: 'POST', body: payload }),

  deleteSuperAdminCatalogActivity: (courseId: string, id: string) =>
    request<{ ok: boolean }>('?action=superAdminCatalogActivityDelete', { method: 'POST', body: { courseId, id } }),

  superAdminStatBreakdown: (metric: StatBreakdownMetric, period: 'month' | 'year' | 'all') =>
    request<StatBreakdownRow[]>(`?action=superAdminStatBreakdown&metric=${metric}&period=${period}`),

  // Backs the per-club member table opened from a row on
  // SuperAdminStatBreakdownScreen ('members'/'newMembers' cards).
  superAdminClubMembers: (courseId: string, period: 'month' | 'year' | 'all') =>
    request<MemberReportRow[]>(`?action=superAdminClubMembers&courseId=${encodeURIComponent(courseId)}&period=${period}`),

  // Backs super_admin's Tier Distribution / Top Redeemed Rewards detail
  // tables — cross-club counterpart of reportRows above.
  superAdminReportRows: <K extends SuperAdminReportKind>(report: K, period: 'month' | 'year' | 'all') =>
    request<K extends 'crossClubMembers' ? SuperAdminMemberReportRow[] : SuperAdminRedemptionReportRow[]>(
      `?action=superAdminReportRows&report=${report}&period=${period}`,
    ),

  cancelSuperAdminCourseSubscription: (courseId: string) =>
    request<{ ok: boolean }>('?action=superAdminCourseCancelSubscription', { method: 'POST', body: { courseId } }),

  reactivateSuperAdminCourseSubscription: (courseId: string) =>
    request<{ ok: boolean }>('?action=superAdminCourseReactivateSubscription', { method: 'POST', body: { courseId } }),

  archiveSuperAdminCourse: (courseId: string) =>
    request<{ ok: boolean }>('?action=superAdminCourseArchive', { method: 'POST', body: { courseId } }),

  unarchiveSuperAdminCourse: (courseId: string) =>
    request<{ ok: boolean }>('?action=superAdminCourseUnarchive', { method: 'POST', body: { courseId } }),

  superAdminMemberRosterStatus: (courseId: string) =>
    request<MemberRosterStatus>(`?action=superAdminMemberRosterStatus&courseId=${encodeURIComponent(courseId)}`),

  uploadSuperAdminMemberRoster: (courseId: string, fileName: string, fileBase64: string) =>
    request<MemberRosterUploadResult>('?action=superAdminMemberRosterUpload', {
      method: 'POST',
      body: { courseId, fileName, fileBase64 },
    }),

  superAdminBroadcasts: () => request<SuperAdminBroadcast[]>('?action=superAdminBroadcasts'),

  sendSuperAdminBroadcast: (payload: { title: string; body: string; target: SuperAdminBroadcastTarget; courseId?: string | null }) =>
    request<SuperAdminBroadcast>('?action=superAdminBroadcastSend', { method: 'POST', body: payload }),

  deleteSuperAdminBroadcast: (id: string) =>
    request<{ ok: boolean }>('?action=superAdminBroadcastDelete', { method: 'POST', body: { id } }),

  // --- Course admin account management — add/reset/revoke/reactivate/
  // delete a course_admin at a specific club. ---
  superAdminCourseAdmins: (courseId: string) =>
    request<CourseAdminAccount[]>(`?action=superAdminCourseAdmins&courseId=${encodeURIComponent(courseId)}`),

  createSuperAdminCourseAdmin: (payload: { courseId: string; firstName: string; lastName: string; email: string }) =>
    request<CourseAdminAccount>('?action=superAdminCourseAdminCreate', { method: 'POST', body: payload }),

  resetSuperAdminCourseAdminPassword: (id: string) =>
    request<{ ok: boolean }>('?action=superAdminCourseAdminResetPassword', { method: 'POST', body: { id } }),

  revokeSuperAdminCourseAdmin: (id: string) =>
    request<{ ok: boolean }>('?action=superAdminCourseAdminRevoke', { method: 'POST', body: { id } }),

  reactivateSuperAdminCourseAdmin: (id: string) =>
    request<{ ok: boolean }>('?action=superAdminCourseAdminReactivate', { method: 'POST', body: { id } }),

  deleteSuperAdminCourseAdmin: (id: string) =>
    request<{ ok: boolean }>('?action=superAdminCourseAdminDelete', { method: 'POST', body: { id } }),

  // --- Support Centre: requester side (course_admin/staff logging a ticket
  // to the Flagrr team — separate from the per-club 'enquiries' actions
  // above, which stay member <-> this club's own admins). ---
  createSupportTicket: (subject: string, message: string) =>
    request<{ ok: boolean; ticketId: string }>('?action=supportTicketCreate', { method: 'POST', body: { subject, message } }),

  supportTickets: () => request<SupportTicketSummary[]>('?action=supportTickets'),

  supportTicketThread: (id: string) => request<SupportTicketThread>(`?action=supportTicketThread&id=${id}`),

  replyToSupportTicket: (ticketId: string, message: string) =>
    request<SupportTicketMessage[]>('?action=supportTicketReply', { method: 'POST', body: { ticketId, message } }),

  // --- Support Centre: agent side (super_admin or support_agent) ---
  supportInbox: (status?: SupportTicketStatus, priority?: SupportTicketPriority, assigned?: 'mine' | 'unassigned') =>
    request<SupportInboxTicket[]>(
      `?action=supportInbox${status ? `&status=${status}` : ''}${priority ? `&priority=${priority}` : ''}${assigned ? `&assigned=${assigned}` : ''}`,
    ),

  supportInboxThread: (id: string) => request<SupportInboxTicketThread>(`?action=supportInboxThread&id=${id}`),

  replyToSupportInboxTicket: (ticketId: string, message: string) =>
    request<SupportTicketMessage[]>('?action=supportAgentReply', { method: 'POST', body: { ticketId, message } }),

  setSupportTicketStatus: (ticketId: string, status: SupportTicketStatus) =>
    request<{ ok: boolean }>('?action=supportTicketStatus', { method: 'POST', body: { ticketId, status } }),

  claimSupportTicket: (ticketId: string) =>
    request<{ ok: boolean }>('?action=supportTicketClaim', { method: 'POST', body: { ticketId } }),

  unassignSupportTicket: (ticketId: string) =>
    request<{ ok: boolean }>('?action=supportTicketUnassign', { method: 'POST', body: { ticketId } }),

  setSupportTicketPriority: (ticketId: string, priority: SupportTicketPriority) =>
    request<{ ok: boolean }>('?action=supportTicketPriority', { method: 'POST', body: { ticketId, priority } }),

  // --- Support agent account management (super_admin only) ---
  supportAgents: () => request<SupportAgent[]>('?action=supportAgents'),

  createSupportAgent: (payload: SupportAgentCreatePayload) =>
    request<SupportAgent>('?action=supportAgentCreate', { method: 'POST', body: payload }),

  resetSupportAgentPassword: (id: string) =>
    request<{ ok: boolean }>('?action=supportAgentResetPassword', { method: 'POST', body: { id } }),

  revokeSupportAgent: (id: string) => request<{ ok: boolean }>('?action=supportAgentRevoke', { method: 'POST', body: { id } }),

  reactivateSupportAgent: (id: string) =>
    request<{ ok: boolean }>('?action=supportAgentReactivate', { method: 'POST', body: { id } }),

  deleteSupportAgent: (id: string) => request<{ ok: boolean }>('?action=supportAgentDelete', { method: 'POST', body: { id } }),

  // --- Audit log (super_admin only) ---
  auditLog: () => request<AuditLogEntry[]>('?action=auditLog'),

  // --- Cross-club fraud oversight (super_admin only) ---
  superAdminFlaggedReceipts: () => request<FlaggedReceipt[]>('?action=superAdminFlaggedReceipts'),
  superAdminConfirmReceiptFraud: (id: string, reason: string) =>
    request<{ ok: boolean }>('?action=superAdminConfirmReceiptFraud', { method: 'POST', body: { id, reason } }),
  superAdminApproveReceipt: (id: string) =>
    request<{ ok: boolean }>('?action=superAdminApproveReceipt', { method: 'POST', body: { id } }),
  superAdminDuplicateAttempts: () => request<DuplicateReceiptAttempt[]>('?action=superAdminDuplicateAttempts'),
  superAdminReceiptImage: (id: string) =>
    request<{ imageData: string | null }>(`?action=superAdminReceiptImage&id=${encodeURIComponent(id)}`),
};

/** Fetches a report action's response and triggers a browser file download
 * via a Blob + temporary anchor (a plain <a href> can't carry the
 * Authorization header). Only works on the web build (the only build that
 * exists today) — shared by every "download this report" button below. */
async function downloadFile(params: URLSearchParams, filename: string): Promise<boolean> {
  if (Platform.OS !== 'web') return false;

  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/api/admin?${params.toString()}`, {
    headers,
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new AdminApiError(res.status, 'Could not generate the report');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

/** Downloads a course_admin report as a .xlsx workbook. */
export async function downloadReport(
  report: 'redemptions' | 'receipts' | 'members' | 'memberActivity',
  period: 'month' | 'year' | 'all',
  options?: { userId?: string; filename?: string },
): Promise<boolean> {
  const params = new URLSearchParams({ action: 'exportReport', report, period });
  if (options?.userId) params.set('userId', options.userId);
  return downloadFile(params, options?.filename ?? `${report}-${period}.xlsx`);
}

/** Downloads the super_admin ads report for one course as a .xlsx workbook. */
export async function downloadSuperAdminAdsReport(courseId: string, filename: string): Promise<boolean> {
  const params = new URLSearchParams({ action: 'superAdminExportReport', report: 'ads', courseId });
  return downloadFile(params, filename);
}

/** Downloads a per-club stat breakdown (the same rows shown on
 * SuperAdminStatBreakdownScreen) as a .xlsx workbook. */
export async function downloadSuperAdminStatBreakdown(
  metric: StatBreakdownMetric,
  period: 'month' | 'year' | 'all',
  filename: string,
): Promise<boolean> {
  const params = new URLSearchParams({ action: 'superAdminExportReport', report: metric, period });
  return downloadFile(params, filename);
}

/** Downloads one club's own member list (the same rows shown on
 * SuperAdminClubMembersScreen) as a .xlsx workbook. */
export async function downloadSuperAdminClubMembers(
  courseId: string,
  period: 'month' | 'year' | 'all',
  filename: string,
): Promise<boolean> {
  const params = new URLSearchParams({ action: 'superAdminExportReport', report: 'clubMembers', courseId, period });
  return downloadFile(params, filename);
}

/** Downloads a cross-club report (the same rows shown on
 * SuperAdminReportDetailScreen) as a .xlsx workbook. */
export async function downloadSuperAdminReport(
  report: SuperAdminReportKind,
  period: 'month' | 'year' | 'all',
  filename: string,
): Promise<boolean> {
  const params = new URLSearchParams({ action: 'superAdminExportReport', report, period });
  return downloadFile(params, filename);
}

/** Downloads the cross-club Ad Performance summary as a .xlsx workbook. */
export async function downloadSuperAdminAdPerformance(period: 'month' | 'year' | 'all', filename: string): Promise<boolean> {
  const params = new URLSearchParams({ action: 'superAdminExportReport', report: 'adPerformance', period });
  return downloadFile(params, filename);
}

/** Downloads one ad's individual click log as a .xlsx workbook. */
export async function downloadSuperAdminAdClickLog(
  adId: string,
  period: 'month' | 'year' | 'all',
  filename: string,
): Promise<boolean> {
  const params = new URLSearchParams({ action: 'superAdminExportReport', report: 'adClickLog', adId, period });
  return downloadFile(params, filename);
}
