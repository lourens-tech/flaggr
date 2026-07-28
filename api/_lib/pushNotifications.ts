import { sql } from './db';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Optional — raises Expo's default (unauthenticated) push rate limit. Not
// required for sends to work at all.
const EXPO_ACCESS_TOKEN = process.env.EXPO_ACCESS_TOKEN;

export type PushPlatform = 'ios' | 'android';

// A member's per-category push opt-out (see migration 037). Doesn't affect
// the in-app notification feed itself — only whether a push actually
// reaches their device — so the bell icon stays a complete record either way.
export type NotificationCategory = 'accountActivity' | 'supportReplies' | 'announcements';

export async function registerPushToken(userId: string, token: string, platform: PushPlatform): Promise<void> {
  await sql`
    insert into push_tokens (user_id, token, platform)
    values (${userId}, ${token}, ${platform})
    on conflict (token) do update set user_id = excluded.user_id, admin_id = null, platform = excluded.platform, last_used_at = now()
  `;
}

// Same idea, for a course_admin account — lets a super_admin's platform-wide
// broadcast (see superAdminBroadcastSend in api/admin/index.ts) reach an
// admin's device, the same way a member broadcast already does.
export async function registerAdminPushToken(adminId: string, token: string, platform: PushPlatform): Promise<void> {
  await sql`
    insert into push_tokens (admin_id, token, platform)
    values (${adminId}, ${token}, ${platform})
    on conflict (token) do update set admin_id = excluded.admin_id, user_id = null, platform = excluded.platform, last_used_at = now()
  `;
}

interface ExpoPushResult {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

// Shared by sendPushToUser/sendPushToAdmin — sends to every given token and
// cleans up any Expo reports as no-longer-registered on the device.
async function deliverPush(tokens: Array<{ token: string }>, message: { title: string; body: string }): Promise<void> {
  if (tokens.length === 0) return;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${EXPO_ACCESS_TOKEN}`;

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(
        tokens.map((t) => ({ to: t.token, title: message.title, body: message.body, sound: 'default' })),
      ),
    });
    const json = (await res.json().catch(() => null)) as { data?: ExpoPushResult[] } | null;
    const results = json?.data ?? [];

    const deadTokens = tokens
      .filter((_, i) => results[i]?.details?.error === 'DeviceNotRegistered')
      .map((t) => t.token);
    if (deadTokens.length > 0) {
      await sql.transaction(deadTokens.map((token) => sql`delete from push_tokens where token = ${token}`));
    }
  } catch {
    // Network/parse failure — never let a push-send problem fail the caller.
  }
}

// Best-effort — this is purely "also ping their phone" on top of the
// in-app notification the caller has already written, so a push failure
// must never fail the action that triggered it (a bonus grant, a
// redemption, a receipt scan). No API key is required for Expo's push
// service to accept sends.
export async function sendPushToUser(
  userId: string,
  message: { title: string; body: string },
  category: NotificationCategory,
): Promise<void> {
  const prefRows = (await sql`
    select notify_account_activity, notify_support_replies, notify_announcements
    from users where id = ${userId}
  `) as Array<{ notify_account_activity: boolean; notify_support_replies: boolean; notify_announcements: boolean }>;
  const prefs = prefRows[0];
  if (!prefs) return;
  const allowed =
    category === 'accountActivity'
      ? prefs.notify_account_activity
      : category === 'supportReplies'
        ? prefs.notify_support_replies
        : prefs.notify_announcements;
  if (!allowed) return;

  const tokens = (await sql`select token from push_tokens where user_id = ${userId}`) as Array<{ token: string }>;
  await deliverPush(tokens, message);
}

// Same idea, for a course_admin account (see registerAdminPushToken above).
export async function sendPushToAdmin(adminId: string, message: { title: string; body: string }): Promise<void> {
  const tokens = (await sql`select token from push_tokens where admin_id = ${adminId}`) as Array<{ token: string }>;
  await deliverPush(tokens, message);
}
