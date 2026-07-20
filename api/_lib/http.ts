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
