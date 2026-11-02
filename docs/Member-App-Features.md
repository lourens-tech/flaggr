# Member App Features

Everything below describes the app as it exists today for a signed-up member. See [Known Limitations & Future Work](Known-Limitations-and-Future-Work) for what is not built or not finished yet. Admin, staff, and support screens are covered in [Admin Console Features](Admin-Console-Features).

## Onboarding

- **Landing screen** (the opening screen) → **Get Started** (sign-up) or **I already have an account** (login). A **Golf Course Admin Login** button is also shown unless the build is a store build (`EXPO_PUBLIC_STORE_BUILD=1`, set in the `preview` and `production` EAS profiles). The "By continuing, you're accepting our Terms of Use and Privacy Notice" line is plain text, not links.
  - Since 2026-10-30 it uses the same Liquid Glass look as the admin sign-in screen: the Flagrr fairway photo under a dark scrim, the lime Flagrr wordmark, "Play. Earn. *Redeem.* Repeat." in Fraunces 800 with "Redeem." in lime italic, and the three actions on a frosted glass panel in the system font (lime primary button in dark mode, Flag Green in light mode). Phones, foldables and tablets stack it with the panel at the bottom; windows 900 px and wider put the headline left and the panel right. Content scrolls when the screen is short (landscape phones). Elements fade up in turn on open; Reduce Motion skips that, and Reduce Transparency makes the panel solid.
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

## Course and My Golf

The tab bar has three tabs either side of the Scan button: **Home, Course, My Golf** on the left and **Rewards, Activity, Profile** on the right.

### Course tab

- **Your club:** when the member's home club has a live course map, a card with **Start a round**. Until it does, a **Coming soon** card says the club's map is on its way (members of the "My Club Isn't Listed Yet" placeholder are told their club isn't on Flagrr yet).
- **Away courses:** every other live course map, searchable by name or town, most recently played first. Only courses Flagrr has mapped are listed, so every card matches the club's official one. If no course is live at all, the section says maps are coming soon.
- **Round in progress:** a card to resume it or discard it. A member can have one round in progress at a time.

### Starting a round

Choose the **rating** (men's or ladies', where the card rates both), the **tees** (length, Course Rating and Slope shown), and which **holes**: all holes, or the front or back nine when the card has separate nine-hole ratings. Enter the **Handicap Index** as it shows on GolfRSA (`+` for a plus handicap; empty means playing off scratch), the **format** (Stableford or stroke play), the **allowance** (95%, the default, or 100%) and whether to enter **putts and fairways**. The screen shows the Course Handicap and Playing Handicap with the working. Flagrr never calculates a handicap index itself. If a round is already in progress, **Start round** offers to resume it or discard it.

Handicaps follow the World Handicap System: Course Handicap = Index × Slope ÷ 113 + (Course Rating − Par); a nine-hole round uses Index ÷ 2 (to the nearest tenth) with the nine-hole ratings. Playing Handicap = the unrounded Course Handicap × the allowance, rounded. Everything is fixed when the round starts, and the round keeps its own copy of par, stroke index, lengths and ratings, so a later correction to the map never changes a round already played.

### During a round

The hole view opens full screen, without the tab bar:
- The hole is drawn tee at the bottom, green at the top, from the member's tee. Drag to move around, pinch / scroll / + and − to zoom, and the frame button to see the whole hole.
- **Green distances** (front, middle, back) along the line from the ball to the flag. Distance arcs every 50 m and **reach / carry** numbers for bunkers and water can be turned off under the layers button.
- **Suggested shot:** the club from the member's **bag** (their carry distances, saved to their profile; sample distances until they change them), where to aim, what it leaves and the usual miss, with a warning when a hazard is inside that miss. Tap anywhere to aim there instead, and drag the white ball to play from somewhere other than the tee.
- A small **GPS integration coming soon** label: the ball does not follow the member's position yet.
- **Score bar:** tap the number for par, − and + for one under or over, press and hold to clear a hole. It shows the result, net result and Stableford points (or net score), the shots received on the hole, and **Pick up** once a hole is worth 0 points. With putts and fairways on, a row above it takes putts and fairway hit / missed left / missed right (par 4s and 5s).
- **Scorecard** (the card button): every hole with par, stroke index, shots, score, putts and points or net, Out / In / Total, and the round's Stableford, net, gross and handicap score (adjusted gross, each hole capped at net double bogey; a pick-up counts as net double bogey). **Finish round** is enabled once every hole has a score or a pick-up; **Discard round** deletes it.
- Scores save to the server as they are entered, with a copy on the device in case the signal drops ("Not saved yet · will retry" in the header until it goes through). Leaving the screen keeps the round in progress.

### My Golf tab

Built only from rounds the member has finished in the Course tab, at home or away, for the Month, Year or All:
- **Stableford average**, rounds played to handicap (36+ points over 18 holes, 18+ over nine), best round, and the Handicap Index as entered. Round-level numbers use 18-hole rounds when there are any in the period, otherwise nine-hole rounds.
- **Rounds, scoring average** (handicap score), **best score** (lowest gross with no pick-ups) and **doubles or worse per 18 holes**.
- **Points per round** chart (the last 20 rounds; tap a column for that round), **average score by par**, **score mix** per 18 holes and what doubles cost, **toughest holes** at the home course (or the course played most, once played twice), and **front nine against back nine**.
- **Putting and ball striking:** putts and three-putts per 18 holes, greens in regulation (on the green in par minus two or fewer) and fairways hit, from the holes where putts and fairways were entered. Until then the card explains how to turn them on.
- **Recent rounds**, with the best marked; tapping one opens its scorecard, where a score can be corrected on the map or the round deleted.
- Until the member has finished a round: **Coming soon** while their home club has no live map (with a link to play an away course if any is live), or **Play your first round** once it does.

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
- **Export my data** includes the member's golf settings and every round they have kept.
- Public pages `privacy.html`, `support.html`, and `delete-account.html` are served with the web build for app-store listings.

## App-wide UX details

- A branded in-app alert/confirm modal is used everywhere instead of the browser's native `alert`/`confirm`, so every dialog matches the app's look and feel, including on the web build.
- Motion follows one system (`mobile/src/theme/motion.ts`): screens slide in with native iOS-style pushes, the balance and stats roll up, cards and buttons scale under the finger, the selected tab pops, and success screens pop their QR code or trophy. Reduce Motion in the phone's accessibility settings turns all of it off.
- The web build includes a PWA manifest and a minimal service worker (no offline caching).
