import { sql } from './db';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Optional — raises Expo's default (unauthenticated) push rate limit. Not
// required for sends to work at all.
const EXPO_ACCESS_TOKEN = process.env.EXPO_ACCESS_TOKEN;

export type PushPlatform = 'ios' | 'android';

export async function registerPushToken(userId: string, token: string, platform: PushPlatform): Promise<void> {
  await sql`
    insert into push_tokens (user_id, token, platform)
    values (${userId}, ${token}, ${platform})
    on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, last_used_at = now()
  `;
}

interface ExpoPushResult {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

// Best-effort — this is purely "also ping their phone" on top of the
// in-app notification the caller has already written, so a push failure
// must never fail the action that triggered it (a bonus grant, a
// redemption, a receipt scan). No API key is required for Expo's push
// service to accept sends.
export async function sendPushToUser(userId: string, message: { title: string; body: string }): Promise<void> {
  try {
    const tokens = (await sql`select token from push_tokens where user_id = ${userId}`) as Array<{ token: string }>;
    if (tokens.length === 0) return;

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
