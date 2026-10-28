# Known Limitations & Future Work

_Last verified against code on 2026-10-28._

Open issues found by reading the code, grouped by severity. Paths are relative to this repo unless a repo is named. Items marked **unverified** could not be confirmed from the code alone, for example because they depend on settings in Vercel, EAS or DNS.

## Fix before taking real money

1. **PayFast notification never checks the amount paid.** The club is provisioned on any `COMPLETE` status for a matching `m_payment_id`, without comparing `amount_gross` to `pending_club_signups.amount`. With no passphrase set, the checkout signature is not secret. `api/courses/index.ts:221-261`
2. **PayFast signature handling may reject real payments.** Empty fields are skipped when building the signature, and `encodeURIComponent` leaves `'()!*` unencoded where PayFast's reference uses PHP `urlencode`. A club name like "St Andrew's" or an ITN with blank fields could fail verification, leaving a paid club with no account. Needs testing in the PayFast sandbox. `api/_lib/payfast.ts:58`
3. **Club provisioning is not all-or-nothing.** The course insert, admin insert, email and status update are separate steps. If the admin email already exists (409) or the email fails, the course row is left behind, the signup stays `pending`, PayFast retries, and each retry creates another course (`-2`, `-3`, ...). `api/courses/index.ts:77-100, 234-242`
4. **Clubs created through signup get no `merchants` row,** unlike clubs created by a super admin. `api/admin/index.ts:1689`
5. **Production settings may fall back to defaults (unverified, set in Vercel):**
   - Without `PAYFAST_MODE=live` and merchant credentials, payments use PayFast's public sandbox. `api/_lib/payfast.ts:5-18`
   - `APP_URL` defaults to `https://app.flagrr.com`, which does not resolve yet, so PayFast notifications would never arrive. `api/courses/index.ts:18`
   - The marketing site's `SITE_URL` defaults to localhost, which makes club signup return 501. `flagrr-marketing: src/lib/env.ts:15`
6. **VAT.** The site says prices are "ex VAT", but PayFast is charged a flat R2,500.00 first payment and R5,250.00 monthly with no VAT added. `api/courses/index.ts:27-28, 181-182`
7. **Reactivate and Cancel do not match PayFast.** Super-admin Reactivate sets `active` without touching `next_billing_date`, so the daily check flags the club `past_due` again. Cancel changes only the database column and does not cancel the PayFast subscription. `api/admin/index.ts:1755-1800`, `api/courses/index.ts:278-285`
8. **No terms acceptance on club signup,** although it starts a recurring paid subscription. `flagrr-marketing: src/components/clubs/SignupForm.tsx:132`

## Security

1. **No brute-force protection on password resets.** Codes are 6 digits, valid 30 minutes, with unlimited attempts and no rate limiting anywhere in `api/`. This covers members and every admin role, including super admin. A reset or password change does not end existing sessions, and members have no logout endpoint. `api/_lib/passwordReset.ts:40-58`, `api/admin/index.ts:1370-1436`
2. **Club admins can edit and delete super-admin ads.** The Ads tab was removed from the club-admin app, but the API still accepts `ads`, `adSave` and `adDelete`. Saving a multi-club ad runs `syncAdCourses(id, false, [courseId])`, which removes every other club from it. Deleting removes it for all clubs. None of this is audit-logged. `api/admin/index.ts:893-931, 3986-4002`
3. **The temporary-password change is enforced only by the app.** An admin still on a temporary password can call every action. `api/_lib/auth.ts:97-127`
4. **Voucher can be redeemed twice.** The update has no `and status = 'active'` condition, so two simultaneous scans both succeed. `api/admin/index.ts:4283-4286`
5. **Members can move between clubs freely** and keep their balance, tier and verified status. Editing date of birth lets a member claim the birthday bonus on any day. `api/profile/index.ts:491, 510`
6. **Any receipt earns Flagrr Cash.** No merchant match or receipt date check is required, and repeated preview scans can call Claude with no rate limit. `api/_lib/pointsEngine.ts:233-292`
7. **Receipt numbers are unique across all clubs.** Two clubs whose tills both print the same number will collide, and the second member is rejected as a duplicate. `db/schema.sql:401`, `api/_lib/fraudChecks.ts:44`
8. **Redeeming is not atomic.** Points are deducted and the voucher is inserted in separate steps, so points are lost if the second fails. `api/redeem.ts:44`
9. **Smaller items:**
   - Fraud claw-back can push a balance negative. `api/_lib/fraudChecks.ts:203`
   - Signup creates the user before its child rows, so a failure leaves a user whose `/api/me` returns 404.
   - Ad `targetUrl` is not validated, and all media is stored as base64 in Postgres.
   - `xlsx@0.18.5` parses uploaded rosters and has known vulnerabilities. `package.json`
   - Auth tokens on the web build are kept in `localStorage`. `mobile/src/api/client.ts:31-51`
   - With "keep me logged in" off, an older saved token is left in storage and restored on next start. `mobile/src/api/client.ts:44`
   - The public club list includes archived clubs, and `initiateSignup` has no rate limit. `api/courses/index.ts:332`

## Launch and legal

1. **Terms and privacy pages are drafts** ("Draft — pending legal review") and `[ SUPPORT@DOMAIN ]` still appears in the footer and both pages. `flagrr-marketing: src/components/legal/LegalPage.tsx:32`, `Footer.tsx:59`, `content/terms.ts:72`, `content/privacy.ts:64,87`
2. **No 18+ check at sign-up,** although the terms require it. `mobile/src/screens/onboarding/SignUpStep1Screen.tsx:152`
3. **The terms cannot be read before sign-up.** The acceptance line is plain text and the terms screen exists only in the logged-in stack. `mobile/src/screens/onboarding/LandingScreen.tsx:65-69`
4. **Dead `#` links on the marketing site:** Terms and Privacy on the signup, success and cancel pages, "Club login" and "Contact". `flagrr-marketing: src/app/clubs/signup/page.tsx:87-88`, `src/content/home.ts:152,161`
5. **No privacy contact.** The privacy and delete-account pages point only to in-app Contact Us. `mobile/static/privacy.html:97`, `delete-account.html:75`
6. **A personal email address** is the fallback contact in code and on a public page. `api/profile/index.ts:19`, `api/admin/index.ts:69`, `mobile/static/support.html:73`
7. **App store badges** on current marketing assets are placeholders and must be replaced with official artwork before paid or printed use (see `docs/Brand-Kit.md`).
8. **Google Analytics** on the marketing site is off by default and needs a cookie notice before it is switched on. `flagrr-marketing/.env.example:16-22`

## Marketing claims that conflict with the app or the brand kit

- **Flagrr Cash must not be equated with rands.** The brand kit forbids it, but the marketing site shows "R1 = 1" and "Platinum earns 1.7 Flagrr Cash on every rand". `flagrr-marketing: src/content/home.ts:14, 26`. The backend itself earns at R1 = 1 FC when a receipt is away-club or has no tier rate, so the copy needs rewording rather than the rule changing.
- **"Desktop app":** the console copy mentions a downloadable desktop app, but only a web app that can be installed as a PWA exists. `flagrr-marketing: ConsoleSection.tsx:20`, `home.ts:108`
- **Bar voucher "paid automatically":** it is issued only if the club has a reward with a matching R100 or R200 variant. Otherwise the quarter is marked claimed and nothing is issued. `flagrr-marketing: TiersSection.tsx:34`, `api/_lib/tierRewards.ts:105-124`
- **Tier climbing** needs the member to be verified against the club roster, which the tier copy does not say. `api/_lib/tiers.ts:56-69`
- **The tier multiplier** applies only at the member's home club, so "on every rand" overstates it. `api/_lib/pointsEngine.ts:233-237`
- **Advertiser page:** "all three placements" versus "4 ad placements", and illustrative prices and reach figures. `flagrr-marketing: src/content/advertisers.ts:9, 50-80`
- **Pricing is duplicated by hand** in several places and must be kept in step: `flagrr-marketing: src/content/home.ts:111`, `clubs/signup/page.tsx:56-60`, `DemoSection.tsx:48-55`, and the constants in `api/courses/index.ts:27-28`.

## Push notifications and native builds

- A native build is configured (`mobile/app.json` version 1.0.1, iOS build 6, Android versionCode 9; EAS project id present), but whether builds have been submitted to the stores is **unverified**.
- Android FCM v1 credentials and the iOS APNs key in EAS cannot be checked from the repo. **Unverified.**
- Logging out does not unregister the device token, so a logged-out phone can keep receiving the previous member's pushes until someone else logs in on it. `mobile/src/context/AppContext.tsx:197`, `api/_lib/pushNotifications.ts:15`
- The permission prompt appears on the first load with no explanation first. `mobile/src/context/AppContext.tsx:162`
- Push does nothing on the web build, which is the only deployed target today.
- `android.permission.RECORD_AUDIO` is requested though nothing records audio, and the camera plugin has no microphone usage string. `mobile/app.json:37`
- `userInterfaceStyle: "light"` stops the app following the phone's dark mode. `mobile/app.json:8`
- No `splash` entry in `app.json`, although `assets/splash-icon.png` exists.
- `eas.json` has no Android `submit` configuration.
- Comments that say "no EAS project exists yet" are out of date. `mobile/src/context/AppContext.tsx:159`, `mobile/src/utils/pushNotifications.ts:21,29`, `mobile/App.tsx:33`

## Database and migrations

- **`db/schema.sql` is stale.** It still has Stripe columns, an `admins` role check limited to `super_admin|course_admin`, `ads.placement` without `home_top`, `golf_products` without `course_id` and `rand_value`, and it is missing about 13 tables (roster, support, audit log, reset codes, pending signups, referrals, ad courses, ad impressions, scan cache, duplicate attempts, super-admin broadcasts) and many columns.
- **Migrations cannot be replayed cleanly.** `018` uses `create table` without `if not exists`, `003` and `017` are destructive, and there is no migration runner or tracking table.
- **`db/seed.sql` fails on a current database:** it inserts `golf_products` without `course_id` (made NOT NULL by `042`), and its merchants insert uses `on conflict` with no unique constraint.
- **Unused columns and tables:** `admins.invite_token` and `invite_expires_at` (the invite flow was never built), `golf_products.sku`, `barcode` and `points_value`, `golf_activities.points_value`, legacy `user_stats` counters, the `streaks` table (created at signup, never updated, so `exportMyData` returns stale zeros), `receipts.image_uri`, and `ads.course_id`.
- **Timezones differ:** `monthly_points` buckets by server-local month, same-day dedupe uses South African time, and quarters use UTC.
- **Nothing cleans up:** vouchers are never marked `expired`, and expired sessions and reset codes are never purged. The billing check is the only scheduled job.

## Admin and reporting gaps

- Archiving a club only hides it in the admin list. Members can still sign up to it and its staff can still log in. `api/courses/index.ts:332`
- Flagrr Cash per Rand (`fb_per_rand`) cannot be changed from any screen, only directly in the database. `api/admin/index.ts:3522-3526`
- Most club-admin actions (staff, rewards, catalogue, broadcasts, roster upload, co-admin changes) are not written to the audit log. Only fraud decisions are. `api/admin/index.ts:3287`
- A super admin can create or reactivate course admins past the 2-active limit, and two course admins can revoke each other. `api/admin/index.ts:2381, 2504, 3633, 3698`
- The super-admin enquiry chat is read-only, and there is no course-admin screen for duplicate receipt attempts although a comment says there is. `api/admin/index.ts:2065`
- Orphaned code: `AdminAdsListScreen` is in no navigator, and `AdminAdEdit` is reachable only from it. `mobile/src/screens/admin/AdminAdsListScreen.tsx`
- The desktop shell's search box stores text but does nothing, and the desktop bell links to a notifications screen that returns 403 for staff. `mobile/src/components/admin/desktop/DesktopShell.tsx:115,184`, `AdminDesktopFrame.tsx:110`
- Super admin, support agent and staff have no change-password option in Profile.
- When a course admin sets a staff member's password, `must_change_password` is cleared. `api/admin/index.ts:3866`
- Report downloads are web-only, and `memberActivity` ignores its period. `api/admin/index.ts:4373-4390`

## Logic and scale

- The quarterly bar voucher grant is recorded before checking the club has a matching reward, so a missing reward silently costs the member that quarter. `api/_lib/tierRewards.ts:107-123`
- Streaks count rejected receipts, contrary to the comment. `api/_lib/streak.ts:30-36`
- Broadcast fan-out sends one push per member in sequence and `api/admin/index.ts` has no `maxDuration`. Ad analytics queries join users, clicks and impressions and multiply rows. `api/admin/index.ts:2297, 4227`, `api/_lib/adAnalytics.ts:64`
- Tier numbers are written out in three places that must be kept in step: `api/_lib/tiers.ts`, `mobile/src/data/mockData.ts` (despite its name this is real tier copy) and `mobile/src/data/faqData.ts:24`.
- The Claude receipt settings (default model `claude-opus-5`, beta flag and `fallbacks` parameter) should be checked against the current API, and the silent fallback to Tesseract hides failures. `api/_lib/claudeReceipt.ts:10,121-129`
- **Multi-club scanning needs setup per club.** The away-club rate only applies once a receipt is matched to a `merchants` row with its own `course_id`. A club created without that row is treated as having no merchant of its own.

## Accessibility and content

- About 110 touchable elements in member screens and 2 accessibility labels. Icon-only buttons (notification bells, avatars) have none, and the unread badge count is not announced. `mobile/src/screens/home/HomeScreen.tsx:161`, `rewards/RewardsActivityScreen.tsx:84`
- The first FAQ answer describes ways to earn (promotions, in-app activities) that the backend does not implement, and the three help articles are stubs ending in "...". `mobile/src/data/faqData.ts:9, 46-50`
- With no ad configured, the ad slot shows a plain "Ad Space" box. `mobile/src/components/common/AdSpace.tsx:93`
- The PWA manifest describes the app as admin tools only, though members use the same web export. `mobile/static/manifest.json`
- Pilot launch email images and links use `flagrr.com`, which was not confirmed to serve anything, and the QR script docstrings still mention `app.flagrr.com`. `marketing/strand-golf-club-pilot-launch.html:223`
- `app.flagrr.com` DNS is not configured, so the API base URL is pinned to `flagrr-loyalty.vercel.app`. `mobile/src/api/client.ts:26-30`
- Stale comments to refresh: "No live billing/Stripe wiring yet" (`api/admin/index.ts:1755`), "only 'canceled' is ever set" (`api/_lib/pointsEngine.ts:314-318`), PDF support mentioned in `api/_lib/memberRoster.ts`, and a reference to a nonexistent `itemsForBasis` in `api/_lib/pointsEngine.test.ts`.

## Not applicable to the audit, but still true

Flagrr Cash has no cash value and is never convertible to rands. Rates and the rewards catalogue are set per club. Do not state member counts, club counts or pilot results in marketing.
