# Member App Features

Everything below describes the app as it exists today for a signed-up member. See [Known Limitations & Future Work](Known-Limitations-and-Future-Work) for what is not built or not finished yet. Admin, staff, and support screens are covered in [Admin Console Features](Admin-Console-Features).

## Onboarding

- **Landing screen** (the opening screen) → **Get Started** (sign-up) or **I already have an account** (login). A **Golf Course Admin Login** button is also shown unless the build is a store build (`EXPO_PUBLIC_STORE_BUILD=1`, set in the `preview` and `production` EAS profiles). The "By continuing, you're accepting our Terms of Use and Privacy Notice" line is plain text, not links.
  - Since 2026-11-24 it is the Bento Landing board: a club photo across the top that fades into the ground colour, the white Flagrr wordmark, "Play. Earn. Redeem. Repeat." in Fraunces 700 with "Repeat." in the accent colour (Flag Green in light mode, lime in dark), then **Get Started** (green button with an arrow nub), **I already have an account** (white / dark button), the Golf Course Admin Login link and the terms line, all in the system font. It follows the member's Light / Dark / System setting and no longer uses the admin console's theme. The content scrolls when the screen is short. The headline rises in on open; Reduce Motion skips that.
- **Sign-up** is a two-step flow:
  1. Full name, email, phone, date of birth, and a **Golf Club** picker (the list of all clubs, fetched live — this is the member's "home club"), plus an optional **referral code**.
  2. Password (at least 8 characters).
- Email must be unique; a duplicate returns a clear "account already exists" error.
- If the club has uploaded a **member roster** and the new member's name and email match it, the account is marked **verified**. Unverified members can scan and redeem normally but stay at Bronze (see [Membership tiers](#membership-tiers)).
- On successful sign-up the member is logged in immediately and receives a branded welcome email (club name, a short "how it works" summary, and a link back into the app).
- If a valid referral code was entered, the referrer is credited (see [Referrals](#referrals)). An invalid code or a referrer at their cap never blocks the sign-up.
- **Login** is email + password, with a "keep me logged in" option. The session token is a bearer token stored on-device (AsyncStorage, which is `localStorage` on the web build); unchecking the option keeps the session in memory for that app run only. Sessions last 30 days. After 10 wrong passwords for one email within 15 minutes (or 30 from one IP address), sign-in is refused for 15 minutes with “Too many sign-in attempts. Try again in 15 minutes, or reset your password.”; resetting the password clears it. Resetting the password signs the member out on every device; changing it in Profile signs out every other device.
- **Sign-in screens look** (Bento, 2026-11-24): Login, both sign-up steps and Forgot password use the Bento ground with the same club photo fading in at the top (contour lines only on Forgot password), the Flagrr wordmark, a glass back button, Bento fields and buttons, and a large Fraunces title: "Welcome back" on Login, "Create your account" with "Step 1 of 2" and a two-part progress bar on sign-up step 1, "Set a password" with "Step 2 of 2" on step 2, and "Reset Password" on Forgot password. The Golf Club and Date of Birth pickers use the Bento field style. Fields, placeholders, validation messages and every action are unchanged.
- **Forgot password**: the member enters their email, receives a 6-digit code (valid 30 minutes, only the latest code works), then enters the code and a new password. Limits (`api/_lib/resetThrottle.ts`): at most 3 code requests per email or username in 30 minutes and 10 per IP address in an hour; 5 wrong codes for an account in 30 minutes locks it out of resetting for that window and cancels any open codes; 20 wrong codes from one IP address in an hour blocks code checks from that IP. A blocked request or code shows “Too many password reset attempts. Please contact Flagrr support at Swing@flagrr.com or 071 759 9553.” Blocks lift on their own when the window passes. Limits apply whether or not the email has an account, so they don’t reveal which emails are registered.

## Home Screen

The member's dashboard, shown after login. Since 2026-11-24 it uses the Bento design (tiles in the order of the Home board):

- **Header** — today's date, a time-of-day greeting with the member's first name ("Morning, / Afternoon, / Evening,"), a notification bell with the unread count (opens Notifications) and the member's avatar or initials (opens Profile).
- **Membership not verified** — an amber notice above the tiles: "Your club hasn't verified your membership yet — you can still earn Flagrr Cash, but tier progress is on hold."
- **Flagrr Cash hero** — the balance (counts up each time Home opens), the tier name, a ring showing progress to the next tier with the FC still needed (since 24 Nov 2026 the ring is as wide as the tile, 96–148 pt depending on the phone, and centred under the balance) (tap for Member Tiers; "Top tier" at Platinum), and **Redeem** (opens the Rewards Shop).
- **Streak tile** — weeks in the streak, a dot per recent week, and "N more weeks to a Y FC bonus". See [Streaks](#streaks).
- **Resume round tile** — when a round is in progress: the next hole to play and the Stableford points so far ("14 pts thru 6"); tap to reopen the hole view. Read from the same `golfHome` call as the Course tab, refreshed each time Home opens. With no round in progress (or if that call fails) the tile is **Play a round**, which opens the Course tab.
- **Your Club** — the home club name and crest; opens Profile.
- **Ad space** (top banner) — see [Ad Space](#ad-space).
- **My Stats** — Rounds (9 Holes), Rounds (18 Holes), Cash Earned, Cash Redeemed, each with a period-over-period % change ("+50% vs Last Month"; none for All). A Month / Year / All control re-fetches these live.
- **Points Earned Per Month** bar chart (the latest month highlighted), with a **My Golf** link to the My Golf tab.
- **Ad space** (second slot).
- **Rewards preview** — the first 5 rewards with photo, name and the first option's Flagrr Cash cost; tapping a card or "View All" opens the Rewards Shop.

## Course and My Golf

The tab bar has three tabs either side of the Scan button: **Home, Course, My Golf** on the left and **Rewards, Activity, Profile** on the right. It is the Bento floating glass bar (2026-11-24): each tab shows a line icon and a label, the active tab is green (lime in dark mode) with a soft highlight that slides between tabs, and Scan is a raised fairway-green button with a lime icon and a "Scan" label. The same bar also lays out the redesign's 4-tab layout (Home, Course, Rewards, Profile) if the tabs change; that change has not been made.

### Course tab

- **Your club:** when the member's home club has a live course map, a card with **Start a round**. Until it does, a **Coming soon** card says the club's map is on its way (members of the "My Club Isn't Listed Yet" placeholder are told their club isn't on Flagrr yet).
- **Away courses:** every other live course map, searchable by name or town, most recently played first. Only courses Flagrr has mapped are listed, so every card matches the club's official one. If no course is live at all, the section says maps are coming soon.
- **Round in progress:** a card to resume it or discard it. A member can have one round in progress at a time. Since 2026-11-24 (Bento) it is a fairway-green tile showing the next hole to play and the Stableford points so far ("Hole 2 · 2 pts · thru 1 of 18").
- **Your game** (Bento, 2026-11-24): when the member has finished rounds, a tile with their Stableford average for the year, a **My Golf** link, and the three latest rounds under **Played recently** (each opens its scorecard). It uses the same stats read as My Golf and is left out if that read fails.
- The tab's screens (Course, Start a Round, the hole view, its Scorecard / Your round / My bag sheets and the map layers, Round detail and My Golf) use the Bento look since 2026-11-24. Start a Round groups its choices into tiles (tees and holes; Handicap Index; format, allowance and putts and fairways; the handicap working). Round detail adds a header tile with the round's points and gross. The Stableford average on Course, Round detail's points and gross, and My Golf's average and stat tiles count up when the screen opens (My Golf's roll from the old to the new value when you change Month / Year / All). Nothing about scoring, saving or the order of steps changed.

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
- **Share my rounds with {club}** (a switch at the bottom of My Golf, on by default): while it is on, the member's club sees the rounds they finish on the club's own course, the scorecards and the stats from them on its admin Golf page. Turning it off hides all of them from the club straight away; rounds elsewhere are never shown to the club. Not shown for the placeholder club. The setting is in the member's data export.
- Until the member has finished a round: **Coming soon** while their home club has no live map (with a link to play an away course if any is live), or **Play your first round** once it does.

## Earning Flagrr Cash

### Scanning a receipt

- Tap the scan action in the centre of the tab bar → camera capture or photo upload. The image is resized to 1800px on the device before upload.
- Screens (Bento design since 2026-11-24):
  - **Scan**: full-screen camera with a close button, lime corner frame with a sweeping scan line (still with Reduce Motion), the "Align receipt or QR code" hint, an **Upload from gallery** button and a round shutter.
  - **Camera permission**: a card reading "Camera access needed — Flagrr needs camera access to scan your receipts and award Flagrr Cash." with **Continue** (asks for access) and **Upload from gallery instead**, plus a close button.
  - **Reading**: the chosen photo dimmed behind a sheet saying "Reading your receipt…" while the scan runs.
  - **Review Receipt**: a back button and **Rescan** both return to the camera; a photo thumbnail with Merchant, Receipt Number and Date; each item with "Matched: …", "Pre-paid · Matched: …", "Already earned on another slip today" or "Not eligible for points" and its FC or price; Receipt Total; Flagrr Cash Earned; **Submit Receipt**.
  - **Receipt submitted**: "+N FC", "Submitted successfully!" and either the added-to-balance message or, for a flagged receipt, "Your receipt is being reviewed" with the manual-review note; **View Current Balance** (Home) and **Submit Another Receipt** (camera).
  - **Receipt History** (from Profile): a summary of Flagrr Cash from approved receipts submitted this calendar month and how many receipts were submitted this month; each receipt with its date and total, then "+N FC" when approved or a Pending / Under review / Rejected label, any flag note, and **View Photo** (opens the photo in a sheet). With no receipts, an empty card with **Scan a receipt**.
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
- Screen (Bento design since 2026-11-24): the club name and "Rewards Shop" with the Flagrr Cash to spend; a search field; All plus one filter per category that has rewards; reward cards two to a row with photo, category, title, description, option chips (when there are several), cost in FC and **Redeem Now**. The ad sits after the first row.
- **Redeem confirmation** is a sheet (it was an alert): the reward photo, club and category, the chosen option, **Cost** and **Balance after**, **Redeem Now** and Cancel. Redeem Now does exactly what the alert's Redeem did and opens the voucher.
- **Not enough Flagrr Cash** stays an alert with the real shortfall ("You need N more Flagrr Cash to redeem …").
- **No search results**: a card with "No rewards match your search." and "Try another word, or clear the search to see everything."
- **Club not on Flagrr**: the "Nothing Here Yet" card with **Contact Support** (opens Contact Your Club) and the ad below it; the "You're Almost In the Family" alert still shows on every visit. A listed club with no rewards shows "No Rewards Yet" with no button.

### Vouchers & Reward Activity

- **Voucher** screen: a ticket with the reward photo, title, club, "Reward Redeemed", the QR code and voucher code, then Redeemed date, Expires date, Cost and Balance left; **Back to Rewards**, plus a back button.
- **Reward Activity** is a chronological timeline of earn and redeem events (the most recent 100), grouped Today / Yesterday / This Week / Earlier. An All / Earned / Redeemed control filters the list on the device. Redeem entries show their FC with a minus sign and an "Already redeemed" or "Expired" label when the voucher is used or expired. With no activity, an empty card offers **Scan a receipt**.
- Tapping a redeem entry opens that voucher's QR code if it is still active, or explains if it has already been used or has expired.

## Ad Space

- Three placements exist: a top banner on Home, a second slot on Home, and a slot in the Rewards Shop.
- Ads are data-driven (stored in the database) and are managed by the Flagrr super-admin team: an ad can target one or more specific clubs, or all clubs. Each has an image or video, target URL, active window (start/end dates), and display order.
- Each ad is tappable and opens its target URL. Taps and impressions are both logged for ad-performance reporting.
- A slot with no ad configured falls back to an inert "Ad Space" placeholder, so nothing looks broken before an ad is set up.
- A small "SPONSORED" label sits above every slot that is showing a real ad (not above the placeholder). Ads never animate: no rise, reveal, parallax or press scaling.

## Profile

- **My Profile** shows name, phone, email, birthday, home club, and member-since date. Name, phone, email, and birthday are editable on the Edit Profile screen (email must be valid and unique).
- **Avatar**: tap the profile photo to pick a new one from the photo library (resized on the device before upload).
- **Change home club**: tap the Club field to open a picker of every club and switch at any time, with a confirmation dialog (the reward catalog and ads change to match the new club). Flagrr Cash balance, tier, and history belong to the member, not the club, so they carry over. Note that roster verification status also carries over (see [Known Limitations](Known-Limitations-and-Future-Work)).
- **Theme**: system, light, or dark, saved to the account. On iPhones, "System" follows the phone's dark mode only from version 1.1.0; the 1.0.1 store build always resolves it to light.
- **Receipt History**: every submitted receipt with its status (Pending, Approved, or Rejected), the Flagrr Cash earned or pending, and the receipt image on demand.
- **Refer a Friend**: see [Referrals](#referrals).
- **Change password**: enter the current password and a new one (at least 8 characters) on the Profile screen.
- **Export My Data**: downloads a copy of the member's own data — profile, balance, receipts, activity, vouchers, notifications, enquiries, and support tickets. Where the device can't download a file, the app says the export isn't available there.
- **Delete account**: requires the current password, then permanently deletes the account and its data.
- **Log out** returns to the landing screen.
- Layout (Bento, 2026-11-24): photo (tap to change), name, club and tier; a strip with Flagrr Cash, week streak and rounds played; a **Refer a Friend** tile; then **Activity** (Reward Activity, Receipt History), **Details** (each field opens Edit Profile; Club opens the club picker), **Support** (Help Center, Contact Your Club, My Enquiries, Give Feedback), **Settings** (Appearance Light / Dark / System, Notification Preferences, Security) and **Account** (Export My Data, Terms and Privacy, Log Out, Delete Account). The Profile header no longer has its own notification bell; Notifications stays on Home.
- **Change password** now opens from Security in a sheet (current and new password, Update Password); the checks and messages are unchanged and the sheet closes when the password changes. **Delete account** opens a sheet with the explanation and the current-password field; Delete Account still asks "Delete your account?" before anything is deleted. **Choose Golf Club** is a sheet listing every club with the home club marked; picking another still asks "Change home club?".
- The support screens (Help Center, Contact Your Club, My Enquiries, enquiry chat, Give Feedback, Notification Preferences, Notifications, Member Tiers, Edit Profile, Refer a Friend, Terms and Privacy) use the Bento header (glass back button, centred title), Bento fields, buttons and toggles. Their content, wording and actions are unchanged, except the 👋 in Help Center's greeting, which was removed. Since the polish pass (2026-11-24), text on these screens is at least 12 pt, Help Center's article cards are larger tiles, and the Member Tiers balance counts up (its tier badge moves under the balance when the line is too narrow).

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

- A branded in-app alert/confirm modal is used everywhere instead of the browser's native `alert`/`confirm`, so every dialog matches the app's look and feel, including on the web build. Since 2026-11-24 it is the Bento alert: a centred card with the title and message in the system font, and full-width buttons under hairlines (two side by side with Cancel on the right, otherwise stacked). The default action is green (lime in dark mode), destructive actions are red, Cancel is plain. Titles, messages, buttons and what each button does are unchanged.
- The round sheets in the hole view (Scorecard, Your round, My bag) are Bento sheets: a rounded card inset from the screen edges with a close button, rising from the bottom over a dimmed backdrop. Their content is unchanged.
- Motion follows one system (`mobile/src/theme/motion.ts`): screens slide in with native iOS-style pushes, the balance and stats roll up, cards and buttons scale under the finger, the tab highlight slides to the selected tab, switching tabs cross-fades with the new screen settling into place, alerts scale in and sheets rise, and success screens pop their QR code or trophy. Reduce Motion in the phone's accessibility settings turns all of it off (tabs and alerts then only fade).
- The web build includes a PWA manifest and a minimal service worker (no offline caching).
