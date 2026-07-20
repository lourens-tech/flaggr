import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ActivityEntry,
  AppNotification,
  PointsAccount,
  Receipt,
  ReceiptLineItem,
  Reward,
  Stats,
  Streak,
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

export async function setToken(token: string | null): Promise<void> {
  cachedToken = token;
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
  courseId: string;
  password: string;
}

export interface MeResponse {
  user: User;
  points: PointsAccount;
  streak: Streak;
  stats: Stats;
}

export interface SubmitReceiptPayload {
  imageUri: string | null;
  courseName: string;
  items: ReceiptLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  pointsAwarded: number;
}

export const api = {
  courses: () => request<Course[]>('/courses', { auth: false }),

  signup: (payload: SignupPayload) =>
    request<AuthResponse>('/auth/signup', { method: 'POST', body: payload, auth: false }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: { email, password }, auth: false }),

  me: () => request<MeResponse>('/me'),

  rewards: () => request<Reward[]>('/rewards'),

  redeem: (rewardId: string) =>
    request<Voucher & { balance: number }>('/redeem', { method: 'POST', body: { rewardId } }),

  vouchers: () => request<Voucher[]>('/vouchers'),

  activity: () => request<ActivityEntry[]>('/activity'),

  notifications: () => request<AppNotification[]>('/notifications'),

  markNotificationRead: (id: string) =>
    request<{ ok: boolean }>('/notifications/read', { method: 'POST', body: { id } }),

  receipts: () => request<Receipt[]>('/receipts'),

  submitReceipt: (payload: SubmitReceiptPayload) =>
    request<Receipt>('/receipts', { method: 'POST', body: payload }),
};
