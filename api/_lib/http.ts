import type { VercelRequest, VercelResponse } from '@vercel/node';

export function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/** Call first in every handler. Returns true if the request was a preflight
 * OPTIONS request and has already been responded to. */
export function handlePreflight(req: VercelRequest, res: VercelResponse): boolean {
  setCors(res);
  // Every route here returns dynamic, often per-user data — never let the
  // browser/CDN cache it or turn a repeat GET into a bodyless 304 (res.json()
  // auto-generates an ETag, which was silently breaking the client's `res.ok`
  // check on second load).
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns the value if it is a well-formed UUID, otherwise throws a 404.
 * Postgres rejects a malformed id in a `uuid` comparison with an error that
 * would otherwise surface as a 500; a bad or tampered id should just read as
 * "not found". */
export function uuidOrNotFound(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new HttpError(404, `${label} not found`);
  return value;
}

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

/** Wraps a handler with preflight handling and uniform error responses. */
export function withErrorHandling(handler: Handler): Handler {
  return async (req, res) => {
    if (handlePreflight(req, res)) return;
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
