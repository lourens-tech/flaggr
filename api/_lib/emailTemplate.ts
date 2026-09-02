// Shared branded shell for every transactional email except the member
// signup welcome (which has its own richer template, see welcomeEmail.ts).
// Table-based layout with inline styles throughout — the only markup that
// renders consistently across Gmail, Apple Mail, and Outlook's Word engine.
const LOGO_URL = 'https://app.flagrr.com/flagrr-logo-white-email.png';

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** A single body paragraph, styled consistently. Pass already-escaped/safe
 * HTML (e.g. built with escapeHtml + your own <strong>/<br/> wrapping). */
export function emailParagraph(html: string): string {
  return `<p style="margin:0 0 16px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#4B5563;">${html}</p>`;
}

export interface EmailCredential {
  label: string;
  value: string;
}

export interface BrandedEmailParams {
  /** Small uppercase label above the heading, e.g. "You're invited". */
  eyebrow?: string;
  /** Serif heading, e.g. "Welcome to the team". */
  heading: string;
  /** Pre-built paragraph HTML — see emailParagraph(). */
  bodyHtml: string;
  /** Rendered as a highlighted mint box, for things like temp passwords or reset codes. */
  credentials?: EmailCredential[];
  /** A large, centered code/value (e.g. a password-reset code) instead of a credentials list. */
  code?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  /** Small text under the divider, e.g. "You're receiving this because...". */
  footerNote?: string;
}

export function renderBrandedEmailHtml({
  eyebrow,
  heading,
  bodyHtml,
  credentials,
  code,
  ctaLabel,
  ctaUrl,
  footerNote,
}: BrandedEmailParams): string {
  const credentialsHtml = credentials?.length
    ? `
        <tr>
          <td style="padding:0 40px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0FFFB;border:1px solid #CCF2E6;border-radius:12px;">
              <tr>
                <td style="padding:20px 24px;">
                  ${credentials
                    .map(
                      (c, i) => `
                    <p style="margin:${i === 0 ? '0' : '10px 0 0'};font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#4B5563;">
                      ${escapeHtml(c.label)}: <strong style="color:#1F1F1F;font-size:15px;">${escapeHtml(c.value)}</strong>
                    </p>`,
                    )
                    .join('')}
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    : '';

  const codeHtml = code
    ? `
        <tr>
          <td align="center" style="padding:0 40px 8px;">
            <p style="margin:0;padding:18px 32px;background:#F0FFFB;border:1px solid #CCF2E6;border-radius:12px;font-family:Helvetica,Arial,sans-serif;font-size:28px;font-weight:bold;letter-spacing:6px;color:#1F4234;">${escapeHtml(code)}</p>
          </td>
        </tr>`
    : '';

  const ctaHtml =
    ctaLabel && ctaUrl
      ? `
        <tr>
          <td align="center" style="padding:28px 40px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="background:#CDDE5C;border-radius:999px;">
                  <a href="${ctaUrl}" style="display:inline-block;padding:15px 36px;font-family:Helvetica,Arial,sans-serif;font-weight:700;font-size:15px;color:#1F4234;text-decoration:none;">${escapeHtml(ctaLabel)} &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
      : '';

  const footerNoteHtml = footerNote
    ? `
        <tr>
          <td style="padding:0 40px;">
            <div style="border-top:1px solid #E5E7EB;margin-top:20px;"></div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 8px;text-align:center;">
            <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#4B5563;line-height:1.7;">${escapeHtml(footerNote)}</p>
          </td>
        </tr>`
    : '';

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#F0FFFB;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0FFFB;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:#1F4234;padding:32px 40px 26px;text-align:center;">
            <img src="${LOGO_URL}" width="150" alt="Flagrr Loyalty" style="display:block;margin:0 auto;border:0;" />
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px 0;text-align:center;">
            ${eyebrow ? `<p style="margin:0 0 12px;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#00805A;font-weight:700;">${escapeHtml(eyebrow)}</p>` : ''}
            <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;color:#1F4234;font-weight:normal;">${escapeHtml(heading)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 8px;">
            ${bodyHtml}
          </td>
        </tr>
        ${credentialsHtml}
        ${codeHtml}
        ${ctaHtml}
        ${footerNoteHtml}
        <tr>
          <td style="background:#1F4234;padding:20px 40px;text-align:center;margin-top:20px;">
            <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.65);line-height:1.6;">Flagrr Loyalty</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
