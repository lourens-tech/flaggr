# Member App Features

Everything below describes the app as it exists today for a signed-up member. See [Known Limitations & Future Work](Known-Limitations-and-Future-Work) for what's intentionally out of scope so far.

## Onboarding

- **Landing screen** → "I already have an account" (login) or sign-up.
- **Sign-up** is a two-step flow:
  1. Full name, email, phone, date of birth, and a **Golf Club** picker (the list of all signed-up clubs, fetched live — this is the member's "home club").
  2. Password.
- On successful sign-up, the member is logged in immediately and receives a branded welcome email (club name, a 3-step "how it works" summary, and a link back into the app).
- **Login** is email + password, with a "keep me logged in" option (session token stored on-device; unchecking it keeps the session in memory only for that app run).

## Home Screen

The member's dashboard, shown after login:

- **Flagrr Cash balance** and current **tier badge** (Bronze/Silver/Gold/Platinum), with a progress bar toward the next tier and how many FC are needed.
- **Streak card** — see [Streaks](#streaks) below.
- **My Stats** — Rounds Played (9 holes), Rounds Played (18 holes), Flagrr Cash Earned, Flagrr Cash Redeemed, each with a period-over-period % change. A Month / Year / All toggle re-fetches these live.
- **Points Earned Per Month** bar chart (current calendar year).
- **Ad space** — see [Ad Space](#ad-space) below.
- **Rewards preview** — the first 3 rewards, with a "View All" link into the full Rewards Shop.

## Earning Flagrr Cash

### Scanning a receipt

- Tap the scan action → camera capture or photo upload → the image is OCR'd server-side (tesseract.js) and parsed for merchant name, receipt/transaction/till number, date/time, line items, subtotal, VAT, and grand total.
- Line items are matched against the club's product/activity catalog (exact, alias, or fuzzy match) to work out how many Flagrr Cash the receipt is worth.
- The **Review Receipt** screen shows the parsed details and the Flagrr Cash total before the member confirms submission — nothing here can be hand-edited; a low-confidence scan shows a warning banner but is still submitted.
- Duplicate protection: the same receipt number or the same image (by content fingerprint) can never be redeemed twice.
- Fraud signals (low OCR confidence, unusually high points, rapid repeat submissions) flag a receipt for later review, but the member still gets their points immediately rather than being blocked over a false positive.

### Home club vs. other clubs

- Scanning a receipt from the member's **home club** applies the full catalog match plus their **tier earning multiplier** (see below).
- Scanning a receipt from a **different Flagrr-partnered club** (not an error — members play away from home all the time) earns Flagrr Cash at a flat **1 FC per R1 spent**, ignoring that other club's catalog and the member's tier multiplier. The Review Receipt screen shows a plain-language note when this rate applies.
- A receipt from an unaffiliated/generic retailer, or one that can't be matched to any club, is treated the same as a home-club receipt.

### Membership tiers

Tier is based on **Flagrr Cash earned in the current calendar quarter** (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec) — not a lifetime total, and redemptions don't count against it. A quiet quarter can only drop a member **one tier** below where they finished the previous quarter (so a Platinum member having a slow quarter lands at Gold, never straight to Bronze).

| Tier | Threshold (FC earned this quarter) | Earning multiplier | Birthday bonus | Quarterly bar voucher |
|---|---|---|---|---|
| Bronze | 0 | 1x | 50 FC | — |
| Silver | 5,000 | 1.2x | 100 FC | — |
| Gold | 10,000 | 1.5x | 150 FC | R100, once per qualifying quarter |
| Platinum | 15,000 | 1.7x | 200 FC | R200, once per qualifying quarter |

- The **earning multiplier** applies to every home-club receipt scan, based on the tier as of *before* that scan (so a receipt's own points can never retroactively inflate its own multiplier).
- The **birthday bonus** is granted automatically, once a year, the first time the app is opened on the member's birthday.
- The **Gold/Platinum bar voucher** is granted automatically once per qualifying quarter — delivered as a free (zero-cost) voucher with its own QR code, no redemption needed.
- All of this is checked every time the app loads (`GET /api/me`) rather than by a scheduled job, and is safe to check repeatedly — nothing is ever granted twice.

### Streaks

- A "week" (Mon–Sun) counts toward a streak if the member had an approved receipt for a round played (9 or 18 holes) that week. The streak length is computed live from receipt history, not a stored counter, so it can never drift.
- Every **4 weeks** of an unbroken streak earns an automatic Flagrr Cash bonus:

  | Streak length | Bonus |
  |---|---|
  | 4 weeks | 100 FC |
  | 8 weeks | 200 FC |
  | 12 weeks and every 4 weeks after | 300 FC (repeats indefinitely) |

- The Home screen's streak card shows how many weeks remain to the next bonus and how much it's worth.
- If a streak breaks and a new one starts later, the same milestones can be earned again from scratch.

## Rewards Shop

- The reward catalog is scoped to the member's home club (each club curates its own).
- Rewards with multiple redemption options (e.g. a Pro Shop, Kitchen, or Bar voucher) show a Rand-denomination selector; simple rewards (a round of golf, a coaching session) have a single option.
- Redeeming a reward deducts the Flagrr Cash cost and issues a **QR code voucher** (90-day expiry) to present at the club.
- The Rewards Shop also has its own **ad space** slot (see below).

### Vouchers & Reward Activity

- **Reward Activity** is a chronological timeline of every earn and redeem event, grouped Today / Yesterday / This Week / Earlier.
- Tapping a redeem entry opens that voucher's QR code if it's still active, or explains if it's already been used or has expired.

## Ad Space

- Two ad slots exist today: one on the Home screen, one in the Rewards Shop.
- Ads are data-driven (stored in the database, scoped per club and per placement) so a future admin panel can manage creative without an app release — image, target URL, active window (start/end dates), and display order.
- Each ad is tappable and opens its target URL; taps are logged for future ad-performance reporting.
- A slot with no ad configured falls back to an inert placeholder — nothing looks broken before a club sets up its first ad.

## Profile

- **My Profile** shows name, phone, email, birthday, home club, and member-since date; name/phone/email/birthday are editable.
- **Avatar**: tap the profile photo to pick a new one from the photo library (resized client-side before upload).
- **Change home club**: tap the Club field to open a picker of every signed-up club and switch at any time, with a confirmation dialog (since the reward catalog and ads shown will change to match the new club). Flagrr Cash balance, tier progress, and history are tied to the member, not the club, so switching never affects them.

## Notifications

- An in-app notification feed (with an unread-count badge) covers every automatic event: receipt scans, redemptions, birthday bonuses, quarterly bar vouchers, and streak bonuses.
- Real phone push notifications are wired up end-to-end in the code, but **dormant** until an EAS project and (for iOS) an Apple Developer account exist — see [Known Limitations](Known-Limitations-and-Future-Work).

## Help & Support

- **Help Center**: searchable FAQ (how Flagrr Cash is earned, how tiers/streaks work and what they're worth, redeeming rewards, changing home club, why a receipt might not be approved, and more) plus a couple of longer help articles.
- **Contact Us**: a form (name, phone, email, enquiry type, message) that emails the club/Flagrr team directly.
- **Terms & Privacy**: static legal content.

## App-wide UX details

- A branded, in-app alert/confirm modal is used everywhere instead of the browser's native `alert`/`confirm`, so every dialog matches the app's look and feel — including on the web build, where the native versions don't render usefully at all.
