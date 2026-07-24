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
  AdminUser,
  AdminVoucherLookup,
  BroadcastTarget,
  DashboardReport,
  EnquiryMessage,
  EnquiryStatus,
  MemberStats,
  MembersPage,
  SuperAdminCourseSummary,
  SuperAdminDashboardReport,
  AdPerformanceRow,
} from '../data/adminTypes';

// Deliberately separate from api/client.ts's token/base logic — a
// course-admin session is a completely different identity from a member
// session (separate admins/admin_sessions tables server-side), and keeping
// the client-side storage/token isolated means the two can never bleed
// into each other on a shared device.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://flagrr-loyalty.vercel.app';
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
  placement: 'home' | 'rewards_shop';
  title: string;
  imageBase64?: string;
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

export const adminApi = {
  // `identifier` is a course_admin/super_admin's email, or a staff
  // account's generated username — one login screen serves both, and the
  // server checks whichever applies to the matched account's role.
  login: (identifier: string, password: string) =>
    request<AdminLoginResponse>('?action=login', { method: 'POST', body: { identifier, password }, auth: false }),

  logout: () => request<{ ok: boolean }>('?action=logout', { method: 'POST' }),

  me: () => request<{ admin: AdminUser; course: AdminCourse }>('?action=me'),

  dashboard: (period: 'month' | 'year' | 'all') =>
    request<DashboardReport>(`?action=dashboard&period=${period}`),

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

  completeOnboarding: () => request<AdminCourse>('?action=completeOnboarding', { method: 'POST' }),
  completeStaffOnboarding: () => request<AdminCourse>('?action=completeStaffOnboarding', { method: 'POST' }),

  contactSupport: () => request<{ ok: boolean }>('?action=contactSupport', { method: 'POST' }),

  staffList: () => request<AdminStaff[]>('?action=staffList'),

  createStaff: (payload: StaffCreatePayload) =>
    request<AdminStaff>('?action=staffCreate', { method: 'POST', body: payload }),

  updateStaff: (payload: StaffUpdatePayload) =>
    request<AdminStaff>('?action=staffUpdate', { method: 'POST', body: payload }),

  revokeStaff: (id: string) => request<{ ok: boolean }>('?action=staffRevoke', { method: 'POST', body: { id } }),

  reactivateStaff: (id: string) => request<{ ok: boolean }>('?action=staffReactivate', { method: 'POST', body: { id } }),

  deleteStaff: (id: string) => request<{ ok: boolean }>('?action=staffDelete', { method: 'POST', body: { id } }),

  rewards: () => request<AdminReward[]>('?action=rewards'),

  saveReward: (payload: RewardSavePayload) =>
    request<{ id: string }>('?action=rewardSave', { method: 'POST', body: payload }),

  deleteReward: (id: string) => request<{ ok: boolean }>('?action=rewardDelete', { method: 'POST', body: { id } }),

  ads: () => request<AdminAd[]>('?action=ads'),

  saveAd: (payload: AdSavePayload) => request<{ id: string }>('?action=adSave', { method: 'POST', body: payload }),

  deleteAd: (id: string) => request<{ ok: boolean }>('?action=adDelete', { method: 'POST', body: { id } }),

  members: (search: string) =>
    request<AdminMember[]>(`?action=members&search=${encodeURIComponent(search)}`),

  membersList: (page: number, pageSize: number) =>
    request<MembersPage>(`?action=membersList&page=${page}&pageSize=${pageSize}`),

  memberStats: (id: string, period: 'month' | 'year' | 'all') =>
    request<MemberStats>(`?action=memberStats&id=${id}&period=${period}`),

  broadcasts: () => request<AdminBroadcast[]>('?action=broadcasts'),

  sendBroadcast: (payload: { title: string; body: string; target: BroadcastTarget }) =>
    request<AdminBroadcast>('?action=broadcastSend', { method: 'POST', body: payload }),

  deleteBroadcast: (id: string) =>
    request<{ ok: boolean }>('?action=broadcastDelete', { method: 'POST', body: { id } }),

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

  saveSuperAdminAd: (payload: SuperAdminAdSavePayload) =>
    request<{ id: string }>('?action=superAdminAdSave', { method: 'POST', body: payload }),

  deleteSuperAdminAd: (courseId: string, id: string) =>
    request<{ ok: boolean }>('?action=superAdminAdDelete', { method: 'POST', body: { courseId, id } }),

  superAdminDashboard: (period: 'month' | 'year' | 'all') =>
    request<SuperAdminDashboardReport>(`?action=superAdminDashboard&period=${period}`),

  superAdminAdPerformance: () => request<AdPerformanceRow[]>('?action=superAdminAdPerformance'),

  superAdminRewards: (courseId: string) =>
    request<AdminReward[]>(`?action=superAdminRewards&courseId=${encodeURIComponent(courseId)}`),

  saveSuperAdminReward: (payload: SuperAdminRewardSavePayload) =>
    request<{ id: string }>('?action=superAdminRewardSave', { method: 'POST', body: payload }),

  deleteSuperAdminReward: (courseId: string, id: string) =>
    request<{ ok: boolean }>('?action=superAdminRewardDelete', { method: 'POST', body: { courseId, id } }),
};

/** Downloads a CSV report. Only works on the web build (the only build that
 * exists today) — triggers a browser file download via a Blob + temporary
 * anchor, since a plain <a href> can't carry the Authorization header. */
export async function downloadCsvReport(
  report: 'redemptions' | 'receipts' | 'members' | 'memberActivity',
  period: 'month' | 'year' | 'all',
  options?: { userId?: string; filename?: string },
): Promise<boolean> {
  if (Platform.OS !== 'web') return false;

  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const params = new URLSearchParams({ action: 'exportCsv', report, period });
  if (options?.userId) params.set('userId', options.userId);

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
  link.download = options?.filename ?? `${report}-${period}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}
