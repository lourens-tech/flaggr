# Member App Features

Everything below describes the app as it exists today for a signed-up member. See [Known Limitations & Future Work](Known-Limitations-and-Future-Work) for what is not built or not finished yet. Admin, staff, and support screens are covered in [Admin Console Features](Admin-Console-Features).

## Onboarding

- **Landing screen** → "Get Started" (sign-up) or Login. An "Admin Login" entry is also shown unless the build is a store build (`EXPO_PUBLIC_STORE_BUILD=1`, set in the `preview` and `production` EAS profiles).
- **Sign-up** is a two-step flow:
  1. Full name, email, phone, date of birth, and a **Golf Club** picker (the list of all clubs, fetched live — this is the member's "home club"), plus an optional **referral code**.
  2. Password (at least 8 characters).
- Email must be unique; a duplicate returns a clear "account already exists" error.
- If the club has uploaded a **member roster** and the new member's name and email match it, the account is marked **verified**. Unverified members can scan and redeem normally but stay at Bronze (see [Membership tiers](#membership-tiers)).
- On successful sign-up the member is logged in immediately and receives a branded welcome email (club name, a short "how it works" summary, and a link back into the app).
- If a valid referral code was entered, the referrer is credited (see [Referrals](#referrals)). An invalid code or a referrer at their cap never blocks the sign-up.
- **Login** is email + password, with a "keep me logged in" option. The session token is a bearer token stored on-device (AsyncStorage, which is `localStorage` on the web build); unchecking the option keeps the session in memory for that app run only. Sessions last 30 days.
- **Forgot password**: the member enters their email, receives a 6-digit code (valid 30 minutes, only the latest code works), then enters the code and a new password.

## Home Screen

The member's dashboard, shown after login:

- **Flagrr Cash balance** and current **tier badge** (Bronze/Silver/Gold/Platinum), with a progress bar toward the next tier and how many FC are needed.
- **Streak card** — see [Streaks](#streaks) below.
- **My Stats** — Rounds Played (9 holes), Rounds Played (18 holes), Flagrr Cash Earned, Flagrr Cash Redeemed, each with a period-over-period % change. A Month / Year / All toggle re-fetches these live.
- **Points Earned Per Month** bar chart (current calendar year).
- **Ad space** — see [Ad Space](#ad-space) below.
- **Rewards preview** — the first 3 rewards, with a "View All" link into the full Rewards Shop.
- A notification bell with an unread badge, and the member's avatar, in the header.

## Earning Flagrr Cash

### Scanning a receipt

- Tap the scan action in the centre of the tab bar → camera capture or photo upload. The image is resized to 1800px on the device before upload.
- The server reads the image (Tesseract OCR by default; Claude vision when `RECEIPT_EXTRACTOR=claude` is set, falling back to Tesseract) and parses merchant name, receipt/transaction/till number, date/time, line items, subtotal, VAT, and grand total.
- Line items are matched against the club's product/activity catalog (exact, alias, or fuzzy match) to work out the Flagrr Cash the receipt is worth. The basis is the slip's grand total, else the subtotal, else the sum of items.
- The preview result is cached for 30 minutes, and confirming a scan reuses it. The confirm step re-checks everything server-side rather than trusting the client.
- The **Review Receipt** screen shows the parsed details and the Flagrr Cash total before the member confirms. Nothing here can be hand-edited; a low-confidence scan shows a warning banner but can still be submitted.
- **Duplicate protection:** a receipt number can only be redeemed once, by anyone, across the whole platform, and an identical image (by content fingerprint) is rejected too. Rejected duplicates are logged for admin fraud oversight.

### Receipts held for review

Three signals flag a receipt for manual review:

- OCR confidence below 55 (out of 100).
- More than 500 Flagrr Cash awarded for a single receipt.
- 5 or more receipts submitted within 10 minutes.

A flagged receipt is saved with status **Pending** and its Flagrr Cash is **held** — it is not credited until a club admin (or super admin) approves it. If the admin confirms it as fraud, the receipt becomes **Rejected**, any Flagrr Cash already credited is reversed, and the member is notified. The member sees:

- a "Your receipt is being reviewed" notice on the success screen;
- an **Under review** badge and an explanatory note in **Receipt History** ("your Flagrr Cash will be added once it's approved").

Receipts that are not flagged are approved and credited immediately, with an activity entry, an in-app notification, and a push notification where push is set up.

### Home club vs. other clubs

- Scanning a receipt from the member's **home club** applies the full catalog match plus their **tier earning multiplier** (see below).
- Scanning a receipt from a **different Flagrr-partnered club** earns at a flat internal rate of **1 FC per R1 of the receipt total**, ignoring that other club's catalog and the member's tier multiplier. The Review Receipt screen shows a plain-language note when this applies. This only engages once the other club's `merchants` row has its own `course_id` set.
- A receipt from an unaffiliated/generic retailer, or one that cannot be matched to any club, is treated the same as a home-club receipt (catalog match plus tier multiplier, no merchant match required).
- A cancelled home club also falls back to the flat rate.

### Membership tiers

Tier is based on **Flagrr Cash earned in the current calendar quarter** (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec, UTC) — not a lifetime total, and redemptions don't count against it. A quiet quarter can only drop a member **one tier** below where they finished the previous quarter.

| Tier | Threshold (FC earned this quarter) | Earning multiplier | Birthday bonus | Quarterly bar voucher |
|---|---|---|---|---|
| Bronze | 0 | 1x | 50 FC | — |
| Silver | 5,000 | 1.2x | 100 FC | — |
| Gold | 10,000 | 1.5x | 150 FC | R100, once per qualifying quarter |
| Platinum | 15,000 | 1.7x | 200 FC | R200, once per qualifying quarter |

- **Roster verification gates tier climbing.** A member who is not verified against their home club's roster stays at Bronze (same earn rate, no tier perks) until the club verifies them.
- The **earning multiplier** applies to every home-club receipt scan, based on the tier as of *before* that scan.
- The **birthday bonus** is granted automatically, once a year, the first time the app is opened on the member's birthday.
- The **Gold/Platinum bar voucher** is granted automatically once per qualifying quarter, as a free (zero-cost) voucher with its own QR code. It is only issued if the member's club has a reward named "Bar Voucher" with a matching R100/R200 variant; otherwise the quarter is marked as granted and nothing is issued (see [Known Limitations](Known-Limitations-and-Future-Work)).
- All of this is checked every time the app loads (`GET /api/me`) rather than by a scheduled job, and nothing is ever granted twice.

### Streaks

- A "week" (Mon–Sun, UTC) counts toward a streak if the member has a receipt with a matched round (9 or 18 holes) that week. The query does not currently filter by receipt status (see [Known Limitations](Known-Limitations-and-Future-Work)). The streak length is computed live from receipt history, not a stored counter.
- A week still in progress that has not been played yet does not break an otherwise unbroken streak.
- Every **4 weeks** of an unbroken streak earns an automatic Flagrr Cash bonus:

  | Streak length | Bonus |
  |---|---|
  | 4 weeks | 100 FC |
  | 8 weeks | 200 FC |
  | 12 weeks and every 4 weeks after | 300 FC (repeats indefinitely) |

- The Home screen's streak card shows how many weeks remain to the next bonus and how much it is worth.
- If a streak breaks and a new one starts later, the same milestones can be earned again from scratch.

### Referrals

- Every member has one permanent referral code (6 characters, no ambiguous characters), created the first time they open **Refer a Friend** in Profile.
- A member earns **15 FC** when someone signs up using their code. When a **golf club** signs up with their code, they earn **500 FC** once that club's first payment is confirmed (not at form submission).
- Each member can receive at most **10** referral bonuses in total (member and club referrals combined).
- The Referral screen shows the member's code, how many bonuses they have used, and the amounts.

## Rewards Shop

- The reward catalog is scoped to the member's home club (each club curates its own).
- Rewards with multiple redemption options (e.g. a Pro Shop, Kitchen, or Bar voucher) show a Rand-denomination selector; simple rewards (a round of golf, a coaching session) have a single option.
- Redeeming a reward deducts the Flagrr Cash cost and issues a **QR code voucher** (code format `FLGR-XXXX-XXXX`, 90-day expiry) to present at the club. Redeeming a reward the member cannot afford is blocked.
- Club staff validate the voucher by code or QR; the member then receives a "Reward validated" notification.
- The Rewards Shop also has its own **ad space** slot (see below).

### Vouchers & Reward Activity

- **Reward Activity** is a chronological timeline of earn and redeem events (the most recent 100), grouped Today / Yesterday / This Week / Earlier.
- Tapping a redeem entry opens that voucher's QR code if it is still active, or explains if it has already been used or has expired.

## Ad Space

- Three placements exist: a top banner on Home, a second slot on Home, and a slot in the Rewards Shop.
- Ads are data-driven (stored in the database) and are managed by the Flagrr super-admin team: an ad can target one or more specific clubs, or all clubs. Each has an image or video, target URL, active window (start/end dates), and display order.
- Each ad is tappable and opens its target URL. Taps and impressions are both logged for ad-performance reporting.
- A slot with no ad configured falls back to an inert "Ad Space" placeholder, so nothing looks broken before an ad is set up.

## Profile

- **My Profile** shows name, phone, email, birthday, home club, and member-since date. Name, phone, email, and birthday are editable on the Edit Profile screen (email must be valid and unique).
- **Avatar**: tap the profile photo to pick a new one from the photo library (resized on the device before upload).
- **Change home club**: tap the Club field to open a picker of every club and switch at any time, with a confirmation dialog (the reward catalog and ads change to match the new club). Flagrr Cash balance, tier, and history belong to the member, not the club, so they carry over. Note that roster verification status also carries over (see [Known Limitations](Known-Limitations-and-Future-Work)).
- **Theme**: system, light, or dark, saved to the account.
- **Receipt History**: every submitted receipt with its status (Pending, Approved, or Rejected), the Flagrr Cash earned or pending, and the receipt image on demand.
- **Refer a Friend**: see [Referrals](#referrals).
- **Change password**: enter the current password and a new one (at least 8 characters) on the Profile screen.
- **Export My Data**: downloads a copy of the member's own data — profile, balance, receipts, activity, vouchers, notifications, enquiries, and support tickets. Where the device can't download a file, the app says the export isn't available there.
- **Delete account**: requires the current password, then permanently deletes the account and its data.
- **Log out** returns to the landing screen.

## Notifications

- An in-app notification feed (with an unread-count badge) covers every automatic event: receipt scans and approvals, redemptions and voucher validation, birthday bonuses, quarterly bar vouchers, streak bonuses, referral bonuses, club announcements, and support/enquiry replies. Tapping an enquiry notification opens that chat.
- **Notification Preferences** has three switches that control which categories also send a phone push: **Account activity**, **Support replies**, and **Announcements**. The in-app feed is unaffected.
- Real phone push is wired end-to-end in the code (the app requests permission and registers an Expo push token on native builds; the server sends through Expo). It does nothing on the web build, and whether it works on real devices depends on the EAS credentials (Apple APNs key, Android FCM) being configured — unverified from the repo. See [Known Limitations](Known-Limitations-and-Future-Work).

## Help & Support

- **Help Center**: searchable FAQ (how Flagrr Cash is earned, redeeming rewards, tiers and what they give, streaks, using a voucher, why a receipt might not be approved, changing club) plus three short help articles.
- **Contact Your Club**: a form (name, phone, email, enquiry type, message) that opens an **enquiry** with the club. **My Enquiries** lists them, and each opens a chat thread where club admins reply.
- **Give Feedback**: submit a bug, feedback, or improvement ticket to the Flagrr team.
- **Terms & Privacy**: in-app legal text.
- Public pages `privacy.html`, `support.html`, and `delete-account.html` are served with the web build for app-store listings.

## App-wide UX details

- A branded in-app alert/confirm modal is used everywhere instead of the browser's native `alert`/`confirm`, so every dialog matches the app's look and feel, including on the web build.
- The web build includes a PWA manifest and a minimal service worker (no offline caching).
