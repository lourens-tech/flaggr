#!/usr/bin/env node
/**
 * Sends a mailer through Resend — the same service the app already uses for
 * welcome and transactional email (see api/_lib/email.ts).
 *
 * Use this instead of pasting into Gmail or Outlook. A mail client's compose
 * window rewrites the HTML it is given: it strips background colours and
 * re-serialises the markup from its own editor, so a table-based design
 * arrives flattened. Resend transmits the HTML byte for byte.
 *
 * Usage:
 *   RESEND_API_KEY=re_xxx \
 *   RESEND_FROM_EMAIL='Strand Golf Club <noreply@flagrr.com>' \
 *   node marketing/send-via-resend.mjs you@example.com
 *
 * Pass one or more recipients. With several, each gets its own send, so
 * nobody sees anybody else's address.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SUBJECT = 'Strand Golf Club is piloting Flagrr — your rounds start paying you back';

const recipients = process.argv.slice(2);
if (recipients.length === 0) {
  console.error('Usage: node marketing/send-via-resend.mjs <email> [email...]');
  process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error('RESEND_API_KEY is not set. Pull it from the Vercel project env.');
  process.exit(1);
}

// Resend's shared test domain only delivers to the Resend account owner's own
// verified address — fine for a test send, not for the member list. Sending
// to members needs a verified sending domain.
const from = process.env.RESEND_FROM_EMAIL || 'Flagrr Loyalty <onboarding@resend.dev>';

const html = readFileSync(join(HERE, 'strand-golf-club-pilot-launch.html'), 'utf8');
const text = readFileSync(join(HERE, 'strand-golf-club-pilot-launch.txt'), 'utf8')
  .split('---\n')
  .slice(1)
  .join('---\n')
  .trim();

let failures = 0;

for (const to of recipients) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject: SUBJECT, html, text }),
  });

  if (res.ok) {
    const { id } = await res.json();
    console.log(`sent to ${to}  (${id})`);
  } else {
    failures += 1;
    console.error(`FAILED for ${to} (${res.status}): ${await res.text().catch(() => '')}`);
  }
}

process.exit(failures > 0 ? 1 : 0);
