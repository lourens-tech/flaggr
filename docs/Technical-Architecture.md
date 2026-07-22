# Technical Architecture

## Stack

- **Mobile app**: Expo (React Native) SDK 57, React Navigation. Currently deployed only as a **web export** (via `expo export --platform web`) — no native iOS/Android build has been produced yet.
- **API**: Vercel serverless functions, written in TypeScript, living under `api/`.
- **Database**: Neon (serverless Postgres), accessed via `@neondatabase/serverless`.
- **Email**: Resend (welcome email, contact form).
- **OCR**: tesseract.js, running server-side inside the receipt-scan function.
- **Deployment**: Vercel, project `flagrr-loyalty`, production domain `flagrr-loyalty.vercel.app`.

## Multi-tenancy

A **course** (golf club) is the tenant. Members belong to one course (their "home club," changeable at any time from Profile); rewards, ads, and merchants are scoped per course. Everything else (points, activity, vouchers, notifications, streaks, tier) belongs to the member and follows them if they switch clubs.

## API structure and the Vercel Hobby function cap

Vercel's Hobby plan caps a deployment at **12 serverless functions**. The API is organized to stay at exactly that limit:

- `api/me.ts`, `api/redeem.ts` — top-level single-purpose endpoints.
- `api/auth/login.ts`, `api/auth/signup.ts`
- `api/courses/index.ts`
- `api/activity/index.ts`
- `api/notifications/index.ts`, `api/notifications/read.ts`
- `api/profile/index.ts` — a shared dispatcher for several unrelated actions via a `?action=` query param: avatar upload (default), `update` (edit profile fields), `contact` (contact form), `adClick` (ad click logging), `changeClub` (home club switch), `registerPushToken` (push token registration).
- `api/receipts/index.ts` — GET (list), POST (confirm a scan), and `?action=scan` (preview a scan without saving).
- `api/rewards/index.ts`, `api/vouchers/index.ts`

Shared logic (not counted against the function cap, since it isn't a route) lives under `api/_lib/`: `db.ts`, `auth.ts`, `http.ts`, `email.ts`, `ocr.ts`, `receiptParser.ts`, `matching.ts`, `pointsEngine.ts`, `scanPipeline.ts`, `fraudChecks.ts`, `imageHash.ts`, `tiers.ts`, `tierRewards.ts`, `streak.ts`, `streakRewards.ts`, `quarter.ts`, `periods.ts`, `ads.ts`, `pushNotifications.ts`, `welcomeEmail.ts`.

**Any new backend capability must be added to an existing file via `?action=` dispatch, not a new file**, unless a function is retired to make room.

## Database schema (high level)

- `courses` — tenants; includes `fb_per_rand` (Flagrr Cash-per-Rand conversion rate) and (unused so far) Stripe billing columns for a future subscribe flow.
- `users`, `sessions` — member accounts and auth tokens.
- `points_accounts`, `user_stats`, `streaks`, `monthly_points` — per-member balances and stats (streaks/monthly points are largely superseded by live computation — see below).
- `rewards`, `reward_variants`, `vouchers` — the redeemable catalog and issued QR vouchers.
- `merchants`, `golf_products`, `golf_activities` — the global matching catalogs used to score a receipt (a merchant optionally has a `course_id` if it's one of our own signed-up clubs).
- `receipts`, `receipt_items` — submitted receipts and their matched line items.
- `activity`, `notifications` — the member-facing earn/redeem timeline and in-app notification feed.
- `birthday_rewards_granted`, `quarterly_tier_vouchers_granted`, `streak_rewards_granted` — idempotency ledgers so automatic bonuses (checked on every app load) are never granted twice.
- `ads`, `ad_clicks` — ad-space content and click tracking.
- `admins`, `admin_sessions` — groundwork for the future course-admin/super-admin side (not yet used by any UI).
- `push_tokens` — groundwork for real device push notifications (not yet populated — see [Known Limitations](Known-Limitations-and-Future-Work)).

Full schema: `db/schema.sql`. Individual migrations (applied in order, by hand, in the Neon Console): `db/migrations/001`–`012`.

## Points computed live, not stored

Several member-facing numbers are **computed on the fly from source data** rather than trusted from a stored counter, so they can never drift out of sync:

- **Tier** — recalculated from the `activity` table's quarter-to-date `earn` entries every time it's needed (and then written back to `users.tier` purely so admin reporting can query it directly).
- **Streak** — recalculated from `receipts`/`receipt_items` every time it's needed.
- **Period stats and their % deltas** (rounds played, Flagrr Cash earned/redeemed) — recalculated from `activity`/`receipts` for whatever period (Month/Year/All) the Home screen requests.

## Notable design decisions

- **Receipt scoring is server-authoritative.** The scan-preview endpoint is a UI convenience; the confirm endpoint re-runs OCR/matching/scoring from the original image rather than trusting anything the client sends back, so a compromised or buggy client can't manipulate its own point total.
- **Automatic bonuses use idempotency ledgers, not a cron job.** There's no scheduled job in this app; every automatic grant (birthday bonus, quarterly bar voucher, streak milestone) is checked on `GET /api/me` (called on every app load) and is a guaranteed no-op once already claimed for that specific period/streak run.
- **Duplicate receipt protection is a database constraint, not a precheck.** Both `receipt_number` and the receipt image's content fingerprint are unique-constrained, so the insert itself is the atomic duplicate check — no race condition between "check" and "save."
