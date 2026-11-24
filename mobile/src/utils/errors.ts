import { ApiError } from '../api/client';

// Plain wording for failures (owner decision 24 Nov 2026): members never see
// raw technical text. Messages the server writes for members (a wrong
// password, a duplicate receipt, "Round not found.", "Handicap Index must be
// …") are kept word for word.
//
// What counts as technical, from an audit of every 4xx message the member
// endpoints can return (api/auth, me, receipts, profile, redeem, rewards,
// vouchers, activity, notifications, courses, _lib/auth, _lib/golf), redone on
// 25 Nov 2026 after the first version (24 Nov) missed some:
// - api/_lib/http.ts withErrorHandling: any unexpected error → 500 "Internal server error".
// - Handlers answering the wrong method → 405 "Method not allowed".
// - api/client.ts request(): a response with no JSON body (e.g. a gateway
//   error page) → ApiError(status, "Request to <path> failed").
// - Developer validation messages that name code fields in camelCase
//   ("imageBase64 must be a jpeg/png/webp data URI", "rewardId and variantId
//   are required", "courseId is required", "accountActivity, supportReplies,
//   and announcements must all be booleans"), or say "data URI" / "https URLs",
//   and the router's "Unknown action" / "Not authorized for this action".
// - 401 "Not authenticated" (api/_lib/auth.ts): the session has expired or was
//   ended, so the member is told to log in again (wording not yet approved by
//   the owner).
// Plain lowercase validation texts such as "email and password are required"
// are left as they are: the app checks those fields itself first.
// - fetch() throws a TypeError when there is no connection: React Native
//   "Network request failed", Chrome "Failed to fetch", Safari "Load failed",
//   Firefox "NetworkError when attempting to fetch resource."

export const NETWORK_MESSAGE = 'We couldn’t reach Flagrr. Check your connection and try again.';
export const SERVER_MESSAGE = 'Something went wrong on our side. Please try again.';
export const SESSION_MESSAGE = 'Your session has ended. Please log in again.';

const TECHNICAL =
  /^(Internal server error|Method not allowed|Unknown action|Not authorized for this action)$|^Request to \/.* failed$|[a-z][A-Z]|\bdata URI\b|\bhttps URLs\b|\bbooleans\b/;
const NETWORK = /^(Network request failed|Failed to fetch|Load failed)$|^NetworkError when attempting to fetch resource/;

export function friendlyError(err: unknown, fallback = SERVER_MESSAGE): string {
  if (err instanceof ApiError) {
    if (err.status >= 500) return SERVER_MESSAGE;
    const m = err.message?.trim();
    if (err.status === 401 && m === 'Not authenticated') return SESSION_MESSAGE;
    if (!m || TECHNICAL.test(m)) return fallback;
    return m;
  }
  if (err instanceof Error && NETWORK.test(err.message.trim())) return NETWORK_MESSAGE;
  return fallback;
}
