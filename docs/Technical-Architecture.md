# Technical Architecture

_Last verified against code on 2026-10-28._

## Stack

- **Client**: one Expo (React Native) SDK 57 codebase in `mobile/`, using React Navigation. It renders the member app, the club-admin console and the super-admin console, chosen by who is logged in (see `mobile/src/navigation/RootNavigator.tsx`). It is deployed as a **web export** (`expo export --platform web`) to Vercel. Native iOS/Android builds are configured (`mobile/app.json`, `mobile/eas.json`, bundle id `com.flagrr.loyalty`) but push notifications are not yet running end to end (see [Known Limitations](Known-Limitations-and-Future-Work)).
- **API**: Vercel serverless functions in TypeScript under `api/`.
- **Database**: Neon serverless Postgres via `@neondatabase/serverless` (HTTP driver, tagged-template queries, so every query is parameterised).
- **Receipt reading**: `tesseract.js` by default; Claude vision optionally (`@anthropic-ai/sdk`).
- **Email**: Resend HTTP API (`api/_lib/email.ts`, no SDK).
- **Push**: Expo push service (`api/_lib/pushNotifications.ts`).
- **Billing**: PayFast subscriptions (`api/_lib/payfast.ts`, `api/courses/index.ts`).
- **Spreadsheets**: `xlsx` for report exports and member-roster uploads.
- **Deployment**: Vercel project `flagrr-loyalty`, served at `flagrr-loyalty.vercel.app`. The marketing site is a separate Next.js project (`ewo-solutions/flagrr-marketing`).

## Build and deploy (`vercel.json`)

- `installCommand`: `npm install && cd mobile && npm install`
- `buildCommand`: `cd mobile && npx expo export --platform web && sh scripts/copy-static-assets.sh`
- `outputDirectory`: `mobile/dist`
- `functions`: `api/receipts/index.ts` gets `maxDuration: 60` and bundles `node_modules/tesseract.js-core/**`. No other function sets a duration.
- `crons`: one job, `GET /api/courses?action=payfastGracePeriodCheck` at `0 6 * * *` (06:00 UTC), protected by `CRON_SECRET`.
- `copy-static-assets.sh` copies email images, reward images, store QR codes, the standalone `privacy.html`, `support.html` and `delete-account.html` pages, and the PWA manifest and service worker into `dist/`.

## Motion and transitions

All animation uses React Native's built-in `Animated` API plus native modules the store binary already ships (`react-native-screens` transitions), so motion changes can go out as an EAS Update with no new store build. No `react-native-reanimated`, `expo-haptics` or Lottie.

- **Tokens**: `mobile/src/theme/motion.ts` holds every duration, easing curve and spring, the shared stagger (`nextStaggerDelay`: things that mount together cascade 40ms apart, max 8 steps) and the Reduce Motion check (`prefersReducedMotion`, from the OS accessibility setting or the browser's `prefers-reduced-motion`). With Reduce Motion on, every animation jumps to its end state.
- **Components** (`mobile/src/components/motion/`): `FadeIn` (rise + fade on mount), `PopIn` (spring scale for success moments), `PressableScale` (press-in scale instead of opacity dimming, optional hover scale on web), `CountUpText` (numbers roll to their value and from old to new on change), `ScreenFade` (screen/content fade).
- **Where they are used**: `PillButton`, `RewardCard`, `StatCard`, `AdminStatCard`, `DesktopStatCard`, `DesktopPanel`, `DesktopDataTable` (first 20 rows), `ProgressBar` (fills), `BarChart` (bars grow), `FloatingTabBar` (filled icon + dot spring on the selected tab), `AdminTabBar` (phone tabs), `AppAlertHost` (alert springs in), `DesktopShell` (content area fades, active sidebar marker springs in), Home (balance roll-up, section cascade), Voucher (QR pops in), Receipt Success (trophy pops, Flagrr Cash rolls up).
- **Navigation** (`mobile/src/navigation/motionOptions.tsx`): stacks use the native iOS push with full-screen swipe-back, and the same iOS-style slide on Android (`ios_from_right`). The receipt camera slides up; Voucher and Receipt Success fade up. Tab navigators crossfade on phones. Native-stack doesn't animate on web, so web screens fade in through `screenLayout`; on desktop admin only the content area fades, so the sidebar never flickers.

## Multi-tenancy

A **course** (golf club) is the tenant. A member belongs to one course (their home club, changeable from Profile). Rewards, ads (global or targeted), merchants, the roster and staff are scoped per course. Points, activity, vouchers, notifications, streaks and tier belong to the member.

## API structure and the Vercel Hobby function cap

Vercel's Hobby plan allows **12 serverless functions**, and the API uses exactly 12. Routing is by file path (there are no rewrites):

| File | Purpose |
|---|---|
| `api/auth/login.ts` | Member login, plus `?action=forgotPassword` and `?action=resetPassword` |
| `api/auth/signup.ts` | Member signup (roster check, referral bonus, welcome email) |
| `api/me.ts` | Member profile, stats and ads. Also grants birthday, quarterly bar-voucher and streak bonuses as a side effect |
| `api/rewards/index.ts` | Reward catalogue |
| `api/redeem.ts` | Redeem a reward for a voucher |
| `api/vouchers/index.ts` | A member's vouchers |
| `api/activity/index.ts` | Earn/redeem ledger (last 100) |
| `api/notifications/index.ts` | In-app notifications, `?action=read` |
| `api/receipts/index.ts` | List, `?action=scan` (preview), POST (confirm), `?action=image` |
| `api/profile/index.ts` | Avatar upload (default), plus actions: `update`, `changeClub`, `contact`, `feedbackCreate`, `enquiryReply`, `myEnquiries`, `enquiryThread`, `adClick`, `adImpression`, `registerPushToken`, `themePreference`, `notificationPreferences`, `updateNotificationPreferences`, `changePassword`, `deleteAccount`, `exportMyData`, `referralInfo` |
| `api/courses/index.ts` | Public club list (GET), `?action=initiateSignup`, `?action=payfastNotify`, `?action=payfastGracePeriodCheck` |
| `api/admin/index.ts` | Every admin, staff, support-agent and super-admin action (about 4,400 lines), dispatched by `?action=` |

**New backend capability must go into an existing file via `?action=` dispatch**, unless a function is retired to make room.

Shared logic that is not a route lives in `api/_lib/`: `db`, `auth`, `http`, `email`, `emailTemplate`, `welcomeEmail`, `passwordReset`, `ocr`, `receiptParser`, `receiptExtraction`, `claudeReceipt`, `scanPipeline`, `scanCache`, `matching`, `pointsEngine`, `fraudChecks`, `imageHash`, `tiers`, `tierRewards`, `streak`, `streakRewards`, `quarter`, `periods`, `monthly`, `referrals`, `ads`, `adAnalytics`, `pushNotifications`, `payfast`, `memberRoster`, `memberRosterFileParsing`, `xlsx`, `enquiries`, `supportTickets`, `adminNotifications`, `adminReports`, `auditLog`, `giftFlagrrCash`.

Unit tests (`npm test`, which runs `tsx --test api/_lib/*.test.ts`) cover `matching`, `pointsEngine` and `receiptParser`.

## Authentication and roles

- **Tokens**: opaque UUID bearer tokens stored in the database, valid for 30 days (`sessions.expires_at` and `admin_sessions.expires_at` default to `now() + interval '30 days'`).
- **Members**: `users` / `sessions`, checked in `api/_lib/auth.ts`.
- **Admins**: a separate identity in `admins` / `admin_sessions`. A request is rejected if the account is not activated, is revoked, or its club's subscription is `canceled` (403).
- **Roles**:
  - `super_admin`: no course, sees every club.
  - `support_agent`: no course, support inbox only.
  - `course_admin`: one club, up to 2 active per club.
  - `staff`: one club, voucher redemption and support tickets only. Staff log in with a username, because several can share one email address.
- Per-role action allow-lists are in `api/admin/index.ts` (`STAFF_ALLOWED_ACTIONS`, `SUPPORT_AGENT_ALLOWED_ACTIONS`, and the super-admin set).
- Passwords are hashed with bcrypt (`bcryptjs`, cost 10). Admin accounts created by another admin start with a temporary password and `must_change_password`. Password resets use a 6-digit emailed code valid for 30 minutes (`api/_lib/passwordReset.ts`).

## Database

Full schema: `db/schema.sql`. Migrations are `db/migrations/001`–`047`, applied by hand in the Neon console. There is no migration runner or tracking table.

**Important:** `db/schema.sql` is behind the migrations and cannot rebuild the current database on its own (see [Known Limitations](Known-Limitations-and-Future-Work)). Treat the migrations, applied in order, as the source of truth.

Main groups of tables (some are created only by migrations):

- **Members**: `users`, `sessions`, `points_accounts`, `user_stats`, `streaks`, `monthly_points`, `push_tokens`, notification preferences.
- **Clubs and billing**: `courses` (includes `fb_per_rand`, PayFast token, subscription status, next billing date, past-due tracking), `pending_club_signups`, `member_roster` entries, `is_placeholder` club.
- **Admins**: `admins`, `admin_sessions`, `password_reset_codes`, `admin_notifications`, `admin_broadcasts`, `audit_log`.
- **Catalogue and vouchers**: `rewards`, `reward_variants`, `vouchers` (code format `FLGR-XXXX-XXXX`, 90-day expiry), `merchants`, `golf_products`, `golf_activities`.
- **Receipts**: `receipts`, `receipt_items`, `receipt_scan_cache`, duplicate-attempt records.
- **Earning**: `activity`, ledgers `birthday_rewards_granted`, `quarterly_tier_vouchers_granted`, `streak_rewards_granted`, `referrals`.
- **Ads**: `ads`, `ad_courses`, `ad_clicks`, `ad_impressions`.
- **Support**: `enquiries`, `enquiry_messages`, support tickets.

## Receipt scan pipeline

`api/_lib/scanPipeline.ts`, called from `api/receipts/index.ts`:

1. **Extraction**: Tesseract OCR plus regex parsing (`ocr.ts`, `receiptParser.ts`) by default. Setting `RECEIPT_EXTRACTOR=claude` switches to Claude vision (`claudeReceipt.ts`), falling back to Tesseract on failure.
2. **Scan cache**: the preview result is stored in `receipt_scan_cache` for 30 minutes so the confirm step reuses it rather than reading the image again.
3. **Matching** (`matching.ts`): exact or alias match, then fuzzy match (Levenshtein, threshold 0.72, minimum text length 6) against the club's own catalogue and all merchants.
4. **Duplicate check**: the receipt number or the SHA-256 image hash, checked across the whole platform (not per club).
5. **Fraud checks** (`fraudChecks.ts`): OCR confidence below 55, more than 500 points, or 5 or more receipts within 10 minutes.
6. **Outcome**: a flagged receipt is saved as `pending` with points held (`points_credited = false`) for club admin review. Otherwise points are credited, an `activity` row and a monthly points row are written, and an in-app notification and push are sent.

## Points engine (`api/_lib/pointsEngine.ts`)

- The basis is the slip's grand total, else the subtotal, else the sum of its items.
- Pre-paid catalogue lines (R0) earn their catalogue value, deduplicated per day in South African time (`Africa/Johannesburg`).
- The result is multiplied by the merchant bonus and the member's tier multiplier.
- At an away club, or when the home club is cancelled, the member earns a flat R1 = 1 FC with no tier multiplier.

## Tiers, streaks, referrals, vouchers

- **Tiers** (`tiers.ts`): Bronze 0, Silver 5,000, Gold 10,000, Platinum 15,000 FC earned in the calendar quarter (UTC). Multipliers are 1, 1.2, 1.5 and 1.7. A member can drop at most one tier per quarter. Members not verified against the club roster stay Bronze. Tier is recalculated from `activity` when needed and written back to `users.tier` for reporting.
- **Birthday bonus**: 50, 100, 150 or 200 FC by tier. **Quarterly bar voucher**: R100 (Gold) or R200 (Platinum), issued only if the club has a matching reward variant.
- **Streaks** (`streak.ts`, `streakRewards.ts`): consecutive weeks with a matched rounds activity. Bonuses at 4, 8 and 12 or more weeks are 100, 200 and 300 FC.
- **Automatic grants** have no scheduled job. They run when `GET /api/me` is called and are guarded by the `*_granted` ledger tables so they cannot be granted twice.
- **Referrals** (`referrals.ts`): 15 FC per member who signs up with a member's code, 500 FC per club once its first PayFast payment clears, at most 10 referral bonuses per referrer.
- **Vouchers**: `FLGR-XXXX-XXXX` codes, 90-day expiry. Staff redeem them by code. Nothing automatically marks a voucher `expired`.

## Member roster verification

Clubs upload a member list (CSV or XLSX, parsed with `xlsx`). A member who matches the roster is marked verified. Only verified members can rise above Bronze.

## Ads and analytics

Ads have a placement (including `home_top`), image or video media, a date range, and either global or per-club targeting through `ad_courses`. Taps go to `adClick` and views to `adImpression`. `adAnalytics.ts` builds per-slot, per-club and trend reports for the super admin.

## Notifications and email

- **Push**: sent through the Expo push service, filtered by the member's notification preferences (`accountActivity`, `supportReplies`, `announcements`). Real delivery on a phone needs a native build, an EAS project, and the platform credentials (see Known Limitations).
- **Email** (Resend): welcome email, password reset codes, club login emails, past-due billing reminders, and enquiry notifications. HTML is built with `emailTemplate.ts`.

## PayFast billing

1. The marketing site posts to `POST /api/club-signup`, which calls `POST /api/courses?action=initiateSignup`.
2. The backend inserts a `pending_club_signups` row and returns signed PayFast checkout fields: R2,500 for the first payment, then R5,250 monthly with no end date.
3. PayFast calls `?action=payfastNotify`. The backend checks the signature, the source IP and PayFast's validation endpoint. On `COMPLETE` for a pending signup it creates the course and the first course admin, emails a temporary password, sets the club `active` and pays any club referral bonus.
4. Renewals update `next_billing_date`. A `CANCELLED` notice sets the club `canceled`.
5. The daily cron flags a club `past_due` once `next_billing_date` is more than 3 days overdue, sends reminder emails at 0, 14 and 25 days, and cancels the club at 30 days.
6. Without `PAYFAST_MODE=live`, and without merchant credentials set, the code uses PayFast's public sandbox values.

## Audit log

`api/_lib/auditLog.ts` records super-admin changes and fraud decisions in `audit_log`, shown on the super-admin Audit Log screen. Most club-admin actions are not logged yet.

## Environment variables

Names only. Values live in Vercel (API and Expo web build) or the marketing project, never in the repo.

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | API | Neon connection string. Required; the API fails at import without it |
| `APP_URL` | API | Public base URL used in emails and PayFast return and notify URLs. Defaults to `https://app.flagrr.com` |
| `CONTACT_EMAIL` | API | Support contact address for the contact form. Falls back to a hard-coded address |
| `CRON_SECRET` | API | Bearer secret that protects the billing cron |
| `PAYFAST_MODE` | API | `live` for production, anything else means sandbox |
| `PAYFAST_MERCHANT_ID` | API | PayFast merchant ID. Defaults to the public sandbox ID |
| `PAYFAST_MERCHANT_KEY` | API | PayFast merchant key. Defaults to the public sandbox key |
| `PAYFAST_PASSPHRASE` | API | PayFast signature passphrase (required for subscriptions) |
| `RESEND_API_KEY` | API | Resend API key |
| `RESEND_FROM_EMAIL` | API | Verified sender address |
| `EXPO_ACCESS_TOKEN` | API | Expo push service token |
| `RECEIPT_EXTRACTOR` | API | `claude` switches receipt reading to Claude vision. Otherwise Tesseract |
| `RECEIPT_EXTRACTION_MODEL` | API | Claude model for receipt reading |
| `RECEIPT_EXTRACTION_EFFORT` | API | `low`, `medium` or `high`. Defaults to `medium` |
| `ANTHROPIC_API_KEY` | API | Read by the Anthropic SDK when Claude extraction is on |
| `EXPO_PUBLIC_API_URL` | Mobile build | Overrides the API base URL. Defaults to `https://flagrr-loyalty.vercel.app` |
| `EXPO_PUBLIC_STORE_BUILD` | Mobile build | `1` hides the admin login in store builds |
| `SITE_URL` | Marketing site | Public https URL of the marketing site. Club signup returns 501 unless it is https |
| `FLAGRR_APP_URL` | Marketing site | Backend base URL used by club signup. Defaults to `https://flagrr-loyalty.vercel.app` |

The marketing site also has optional analytics variables, listed in its `.env.example`.
