// Seeds the fixtures folder with real receipts from the database: each
// photo plus a draft <id>.expected.json pre-filled from what the scanner
// stored at the time. Those drafts are the OLD scanner's output, not the
// truth — correct every field against the photo, then set "verified": true.
//
//   DATABASE_URL=... npm run eval:export -- --limit 40
//   DATABASE_URL=... npm run eval:export -- --limit 20 --flagged-only
//
// Existing files are never overwritten, so re-running it won't clobber
// fixtures you've already checked.

import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import type { ExpectedReceipt } from './score';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const dir = path.resolve(arg('dir') ?? 'scripts/receipt-eval/fixtures');
const limit = Number(arg('limit') ?? 40);
const flaggedOnly = process.argv.includes('--flagged-only');

const EXTENSIONS: Record<string, string> = { jpeg: 'jpg', jpg: 'jpg', png: 'png', webp: 'webp' };

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Set DATABASE_URL to the database to export from.');
    process.exit(1);
  }
  const sql = neon(url);
  fs.mkdirSync(dir, { recursive: true });

  const receipts = (await sql`
    select id, image_data, course_name, subtotal, tax, total, receipt_number, receipt_time, flagged, status
    from receipts
    where image_data is not null
      and (${!flaggedOnly} or flagged or status = 'rejected')
    order by submitted_at desc
    limit ${limit}
  `) as Array<{
    id: string;
    image_data: string;
    course_name: string;
    subtotal: string;
    tax: string;
    total: string;
    receipt_number: string | null;
    receipt_time: string | null;
    flagged: boolean;
    status: string;
  }>;

  let written = 0;
  for (const r of receipts) {
    const m = r.image_data.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/s);
    if (!m) continue;
    const imagePath = path.join(dir, `${r.id}.${EXTENSIONS[m[1]]}`);
    const expectedPath = path.join(dir, `${r.id}.expected.json`);
    if (fs.existsSync(imagePath) || fs.existsSync(expectedPath)) continue;

    const items = (await sql`
      select description, quantity, price from receipt_items where receipt_id = ${r.id}
    `) as Array<{ description: string; quantity: string; price: string }>;

    const draft: ExpectedReceipt = {
      verified: false,
      notes: `Draft from the old scanner's stored output (status: ${r.status}${r.flagged ? ', flagged' : ''}). Check every field against the photo, add the date, then set verified to true.`,
      merchantName: r.course_name || null,
      receiptNumber: r.receipt_number,
      date: null,
      time: r.receipt_time,
      items: items.map((i) => ({ description: i.description, quantity: Number(i.quantity), price: Number(i.price) })),
      subtotal: Number(r.subtotal) || null,
      vat: Number(r.tax) || null,
      grandTotal: Number(r.total) || null,
    };

    fs.writeFileSync(imagePath, Buffer.from(m[2], 'base64'));
    fs.writeFileSync(expectedPath, `${JSON.stringify(draft, null, 2)}\n`);
    written++;
  }
  console.log(`Wrote ${written} new fixture(s) to ${dir} (${receipts.length - written} already present or unreadable).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
