import { ApiError } from '../api/client';

// Plain wording for failures (owner decision 24 Nov 2026): members never see
// raw technical text. Messages the server writes for members (a wrong
// password, a duplicate receipt, "Round not found.") are kept word for word.
//
// The technical texts below are the only ones the member app can receive,
// checked against the code on 24 Nov 2026:
// - api/_lib/http.ts withErrorHandling: any unexpected error → 500 "Internal server error".
// - Handlers answering the wrong method → 405 "Method not allowed".
// - api/client.ts request(): a response with no JSON body (e.g. a gateway
//   error page) → ApiError(status, "Request to <path> failed").
// - fetch() throws a TypeError when there is no connection: React Native
//   "Network request failed", Chrome "Failed to fetch", Safari "Load failed",
//   Firefox "NetworkError when attempting to fetch resource."

export const NETWORK_MESSAGE = 'We couldn’t reach Flagrr. Check your connection and try again.';
export const SERVER_MESSAGE = 'Something went wrong on our side. Please try again.';

const TECHNICAL = /^(Internal server error|Method not allowed)$|^Request to \/.* failed$/;
const NETWORK = /^(Network request failed|Failed to fetch|Load failed)$|^NetworkError when attempting to fetch resource/;

export function friendlyError(err: unknown, fallback = SERVER_MESSAGE): string {
  if (err instanceof ApiError) {
    if (err.status >= 500) return SERVER_MESSAGE;
    const m = err.message?.trim();
    if (!m || TECHNICAL.test(m)) return fallback;
    return m;
  }
  if (err instanceof Error && NETWORK.test(err.message.trim())) return NETWORK_MESSAGE;
  return fallback;
}
