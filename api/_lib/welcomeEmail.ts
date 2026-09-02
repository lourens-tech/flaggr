// Hosted, not inlined as base64 — Gmail and several other major clients
// strip/block base64 data URIs in received HTML email, so a real HTTPS URL
// is the only reliably compatible option. Served as a static file copied
// into the web build output (see vercel.json's buildCommand).
const LOGO_URL = 'https://flagrr-loyalty.vercel.app/flagrr-logo-white-email.png';

export interface WelcomeEmailParams {
  firstName: string;
  homeClub: string;
  appUrl: string;
}

// Escapes the only two pieces of user-controlled text that land in this
// template (first name, club name) — both are already validated at signup,
// but this is free insurance against a stray "<" breaking the layout.
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderWelcomeEmailSubject(firstName: string): string {
  return `Welcome to Flagrr, ${firstName}! Your loyalty account is ready \u{1F3CC}\u{FE0F}`;
}

// Table-based layout with inline styles throughout — the only markup that
// renders consistently across Gmail, Apple Mail, and Outlook's Word engine.
export function renderWelcomeEmailHtml({ firstName, homeClub, appUrl }: WelcomeEmailParams): string {
  const safeFirstName = escapeHtml(firstName);
  const safeHomeClub = escapeHtml(homeClub);

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#F0FFFB;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0FFFB;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:#1F4234;padding:36px 40px 30px;text-align:center;">
            <img src="${LOGO_URL}" width="170" alt="Flagrr Loyalty" style="display:block;margin:0 auto;border:0;" />
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 0;text-align:center;">
            <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#00805A;font-weight:700;">Welcome to the club</p>
            <h1 style="margin:14px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.3;color:#1F4234;font-weight:normal;">Hi ${safeFirstName}, you&rsquo;re in.</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 48px 0;text-align:center;">
            <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#4B5563;">
              Your Flagrr Loyalty account at <strong style="color:#1F1F1F;">${safeHomeClub}</strong> is ready. Every round, receipt, and reward starts earning you Flagrr Cash from here.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="33.33%" valign="top" align="center" style="padding:0 10px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                    <tr><td width="40" height="40" align="center" valign="middle" style="background:#CCF2E6;border-radius:20px;font-family:Georgia,serif;font-size:16px;color:#00805A;">1</td></tr>
                  </table>
                  <p style="margin:12px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#1F1F1F;">Play &amp; Scan</p>
                  <p style="margin:5px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#4B5563;line-height:1.5;">Snap a photo of any round, pro shop, or range receipt.</p>
                </td>
                <td width="33.33%" valign="top" align="center" style="padding:0 10px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                    <tr><td width="40" height="40" align="center" valign="middle" style="background:#CCF2E6;border-radius:20px;font-family:Georgia,serif;font-size:16px;color:#00805A;">2</td></tr>
                  </table>
                  <p style="margin:12px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#1F1F1F;">Earn Flagrr Cash</p>
                  <p style="margin:5px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#4B5563;line-height:1.5;">We match it against eligible products and rounds, automatically.</p>
                </td>
                <td width="33.33%" valign="top" align="center" style="padding:0 10px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                    <tr><td width="40" height="40" align="center" valign="middle" style="background:#CCF2E6;border-radius:20px;font-family:Georgia,serif;font-size:16px;color:#00805A;">3</td></tr>
                  </table>
                  <p style="margin:12px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#1F1F1F;">Redeem Rewards</p>
                  <p style="margin:5px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#4B5563;line-height:1.5;">Trade Flagrr Cash for tee times, gear, and more.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:36px 40px 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="background:#CDDE5C;border-radius:999px;">
                  <a href="${appUrl}" style="display:inline-block;padding:15px 36px;font-family:Helvetica,Arial,sans-serif;font-weight:700;font-size:15px;color:#1F4234;text-decoration:none;">Open Flagrr &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px;">
            <div style="border-top:1px solid #E5E7EB;"></div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px 32px;text-align:center;">
            <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#4B5563;line-height:1.7;">
              BRONZE MEMBER &middot; ${safeHomeClub}<br />
              Questions? Just reply to this email or visit Help Center in the app.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#1F4234;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.65);line-height:1.6;">
              You&rsquo;re receiving this because you created a Flagrr Loyalty account.<br />
              Flagrr Loyalty
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
