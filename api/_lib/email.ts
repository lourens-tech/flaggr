// Thin wrapper over the Resend HTTP API — no SDK dependency needed for a
// single "send one email" call. Requires RESEND_API_KEY to be set as a
// Vercel environment variable; RESEND_FROM_EMAIL is optional (defaults to
// Resend's shared test domain, which only delivers to the account owner's
// own verified address until a custom sending domain is verified).
const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Flagrr Loyalty <onboarding@resend.dev>';
const SEND_TIMEOUT_MS = 8000;

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('RESEND_API_KEY is not set — skipping email send');
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
        to: [to],
        subject,
        html,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`Resend send failed (${res.status}): ${body}`);
    }
  } catch (err) {
    console.error('Resend send threw', err);
  } finally {
    clearTimeout(timeout);
  }
}
