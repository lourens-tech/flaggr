import AsyncStorage from '@react-native-async-storage/async-storage';
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
  ScanResult,
  Stats,
  StatsPeriod,
  Streak,
  SupportTicketMessage,
  SupportTicketSummary,
  SupportTicketThread,
  User,
  Voucher,
} from '../data/types';

// Points at the deployed backend by default so the app works out of the box
// (Expo Go, standalone builds). Override with EXPO_PUBLIC_API_URL for local
// backend development.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://flagrr-loyalty.vercel.app';
const TOKEN_KEY = 'flagrr_auth_token';

let cachedToken: string | null | undefined;

async function getToken(): Promise<string | null> {
  if (cachedToken === undefined) {
    cachedToken = await AsyncStorage.getItem(TOKEN_KEY);
  }
  return cachedToken;
}

export async function setToken(token: string | null, persist: boolean = true): Promise<void> {
  cachedToken = token;
  if (!persist) return; // "keep me logged in" off — session lives in memory only
  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

export class ApiError extends Error {
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

  const res = await fetch(`${API_BASE_URL}/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    // Every route returns dynamic data — never let the browser serve a
    // cached/conditional response (a bodyless 304 fails the res.ok check below).
    cache: 'no-store',
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, (data && data.error) || `Request to ${path} failed`);
  }
  return data as T;
}

export interface Course {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface SignupPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  courseId: string;
  password: string;
}

export interface MeResponse {
  user: User;
  points: PointsAccount;
  streak: Streak;
  stats: Stats;
  ads: Ad[];
}

export interface SubmitReceiptPayload {
  imageBase64: string;
  imageUri: string | null;
}

export interface UpdateProfilePayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
}

export interface ContactEnquiryPayload {
  name: string;
  surname: string;
  phone: string;
  email: string;
  enquiryType: string;
  message: string;
}

export interface ContactEnquiryResponse {
  ok: boolean;
  enquiryId: string;
}

export const api = {
  courses: () => request<Course[]>('/courses', { auth: false }),

  signup: (payload: SignupPayload) =>
    request<AuthResponse>('/auth/signup', { method: 'POST', body: payload, auth: false }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: { email, password }, auth: false }),

  forgotPassword: (email: string) =>
    request<{ ok: boolean }>('/auth/login?action=forgotPassword', { method: 'POST', body: { email }, auth: false }),

  resetPassword: (email: string, code: string, newPassword: string) =>
    request<{ ok: boolean }>('/auth/login?action=resetPassword', {
      method: 'POST',
      body: { email, code, newPassword },
      auth: false,
    }),

  me: (period: StatsPeriod = 'year') => request<MeResponse>(`/me?period=${period}`),

  rewards: () => request<Reward[]>('/rewards'),

  redeem: (rewardId: string, variantId: string) =>
    request<Voucher & { balance: number }>('/redeem', { method: 'POST', body: { rewardId, variantId } }),

  vouchers: () => request<Voucher[]>('/vouchers'),

  activity: () => request<ActivityEntry[]>('/activity'),

  notifications: () => request<AppNotification[]>('/notifications'),

  markNotificationRead: (id: string) =>
    request<{ ok: boolean }>('/notifications?action=read', { method: 'POST', body: { id } }),

  receipts: () => request<Receipt[]>('/receipts'),

  scanReceipt: (imageBase64: string) =>
    request<ScanResult>('/receipts?action=scan', { method: 'POST', body: { imageBase64 } }),

  submitReceipt: (payload: SubmitReceiptPayload) =>
    request<Receipt>('/receipts', { method: 'POST', body: payload }),

  updateAvatar: (imageBase64: string) =>
    request<{ avatarUrl: string }>('/profile', { method: 'POST', body: { imageBase64 } }),

  updateProfile: (payload: UpdateProfilePayload) =>
    request<User>('/profile?action=update', { method: 'POST', body: payload }),

  changeHomeClub: (courseId: string) =>
    request<{ courseId: string; homeClub: string }>('/profile?action=changeClub', {
      method: 'POST',
      body: { courseId },
    }),

  sendContactEnquiry: (payload: ContactEnquiryPayload) =>
    request<ContactEnquiryResponse>('/profile?action=contact', { method: 'POST', body: payload }),

  myEnquiries: () => request<MyEnquirySummary[]>('/profile?action=myEnquiries'),

  enquiryThread: (id: string) => request<MyEnquiryThread>(`/profile?action=enquiryThread&id=${id}`),

  replyToEnquiry: (enquiryId: string, message: string) =>
    request<EnquiryMessage[]>('/profile?action=enquiryReply', { method: 'POST', body: { enquiryId, message } }),

  createSupportTicket: (subject: string, message: string) =>
    request<{ ok: boolean; ticketId: string }>('/profile?action=supportTicketCreate', {
      method: 'POST',
      body: { subject, message },
    }),

  supportTickets: () => request<SupportTicketSummary[]>('/profile?action=supportTickets'),

  supportTicketThread: (id: string) => request<SupportTicketThread>(`/profile?action=supportTicketThread&id=${id}`),

  replyToSupportTicket: (ticketId: string, message: string) =>
    request<SupportTicketMessage[]>('/profile?action=supportTicketReply', {
      method: 'POST',
      body: { ticketId, message },
    }),

  logAdClick: (adId: string) =>
    request<{ ok: boolean }>('/profile?action=adClick', { method: 'POST', body: { adId } }),

  registerPushToken: (token: string, platform: 'ios' | 'android') =>
    request<{ ok: boolean }>('/profile?action=registerPushToken', { method: 'POST', body: { token, platform } }),

  updateThemePreference: (preference: 'system' | 'light' | 'dark') =>
    request<{ themePreference: 'system' | 'light' | 'dark' }>('/profile?action=themePreference', {
      method: 'POST',
      body: { preference },
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>('/profile?action=changePassword', { method: 'POST', body: { currentPassword, newPassword } }),
};
