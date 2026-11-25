# Environment and Setup

How to run and deploy each piece, which services and variables it needs, and the build facts for the native apps. Values are never recorded here, only names and purpose.

## Repositories

| Repo | What |
|---|---|
| `lourens-tech/flaggr` | The app: `api/` (backend), `db/` (schema and migrations), `mobile/` (Expo app: member, club admin, super admin), `docs/`, `marketing/` (club launch material), `scripts/receipt-eval/`. |
| `ewo-solutions/flagrr-marketing` | The public marketing site (Next.js 16). Note its `AGENTS.md`: this Next.js version has breaking changes, so read `node_modules/next/dist/docs/` before changing code. |

## Running things locally

**Backend tests** (repo root):
```sh
npm ci
npm test            # tsx --test api/_lib/*.test.ts  (63 tests)
npx tsc --noEmit -p .
```

**Receipt extractor evaluation** (needs `DATABASE_URL`; see `scripts/receipt-eval/README.md`):
```sh
npm run eval:export -- --limit 40
npm run eval:receipts
```

**Mobile app** (`mobile/`):
```sh
cd mobile && npm ci
npx expo start                      # dev server
npx expo export --platform web      # production web export to mobile/dist
npx tsc --noEmit
```
**Member app click-through tests** (`mobile/`, added 24 Nov 2026):
```sh
cd mobile && npx playwright install chromium   # once per machine
npm run e2e                                    # web export against the mock API, then every spec in e2e/
npx playwright test e2e/smoke.spec.ts          # one spec (after npm run e2e:build)
npx tsc --noEmit -p e2e                        # type-check the tests
```
They run the production web export against `e2e/mock-api/server.ts`, a sample-data stand-in that answers every call in `src/api/client.ts` (port 4020; web on 8090). Tests switch scenarios through `POST /api/__scenario` and restore seed data with `POST /api/__reset`. The mock's test-only sign-in and reset code are written at the top of `server.ts`; they are not a real account. `E2E_API_PORT`, `E2E_WEB_PORT` and `E2E_WEB_DIR` let several runs work side by side. Output folders (`e2e/.web*`, `e2e/.results*`, `e2e/.report*`) are git-ignored. Run the suite before every member-app commit: it checks the [functionality inventory](Member-App-Functionality-Inventory) still works. It covers what the web build can do; camera, push, haptics and other native-only items need a device.

As of 25 Nov 2026 (after phase 3, the owner's morning answers and My Feedback) the suite has 589 tests in seven files (`auth`, `home`, `scan`, `rewards`, `golf`, `profile`, `smoke`), one `test.describe` per inventory screen. `auth` and `home` were one `signin-home` file until 24 Nov 2026, split so each part of the app has its own test file. A full run takes about 11 minutes and ends with 531 passed and 44 skipped: 42 are marked native only (live camera, OS permission prompts, push taps, haptics, gestures, Reduce Motion) and 2 are `test.fixme` for known differences listed in [Known Limitations](Known-Limitations-and-Future-Work). The mock copies the real server's rules where a screen depends on them (duplicate image → 409, an approved receipt adds the activity row and notification, the latest-100 activity cap, "General" enquiry type, member replies reopening a resolved enquiry, finished-round save validation); `/api/__reset` also restores the golf settings so no test leaks into the next. The test build sets `EXPO_PUBLIC_E2E=1` (only in `npm run e2e:build`; read as `E2E_INSTANT_MOTION` in `mobile/src/theme/motion.ts`), which makes screen pushes, tab switches and tile entrances (`Appear`) instant, so a test never meets two screens mid-slide or clicks a tile that is still sliding into place (seen once under load: a click on Home's My Golf link landed while its tile was rising 46 pt and was lost); real web and phone builds never set it. The transitions themselves were measured separately in headless Chromium against `navigation/transitions.ts`.

Read the Expo SDK 58 docs (`https://docs.expo.dev/versions/v58.0.0/`) before changing code. Set `EXPO_PUBLIC_API_URL` to point the app at a local backend; otherwise it calls `https://flagrr-loyalty.vercel.app`.

**Marketing site** (separate repo):
```sh
npm ci
npm run dev        # next dev
npm run build
npm run lint
npx tsc --noEmit
```

There is no local runner for the Vercel functions in this repo. Use `vercel dev` with the Vercel CLI if you need them locally.

## Deployment (Vercel)

`vercel.json` in the app repo:
- Install: `npm install && cd mobile && npm install`
- Build: `cd mobile && npx expo export --platform web && sh scripts/copy-static-assets.sh`
- Output: `mobile/dist`
- `api/receipts/index.ts` gets `maxDuration: 60` and includes `node_modules/tesseract.js-core/**`.
- One cron: `GET /api/courses?action=payfastGracePeriodCheck` daily at 06:00 UTC.

The Hobby plan caps a project at 12 serverless functions, and this project uses all 12 (`activity`, `admin`, `auth/login`, `auth/signup`, `courses`, `me`, `notifications`, `profile`, `receipts`, `redeem`, `rewards`, `vouchers`). New backend behaviour goes in as an `?action=` on an existing function, not a new file. `api/admin/index.ts` is one very large router.

The Vercel project is `flagrr-loyalty` (production URL `https://flagrr-loyalty.vercel.app`). The marketing site is its own Vercel project.

### Firewall (Vercel dashboard, not in the repo)

One custom rule, **Login and password reset rate limit**, set up and published on 2026-11-20 (Vercel → `flagrr-loyalty` → Firewall → Rules). Changes apply without a redeploy.

- **Matches** a request whose path is `/api/auth/login` (member sign-in, `forgotPassword` and `resetPassword`), **or** whose path is `/api/admin` and whose `action` query parameter is `login`, `adminForgotPassword` or `adminResetPassword`. Every other admin action is untouched.
- **Limit**: fixed window, 10 requests per 60 seconds per IP address, then HTTP 429 until the window ends. Matching requests count together, so member and admin attempts from one IP share the 10.
- Checked after publishing: from one IP, the 11th and 12th requests to `/api/auth/login` returned 429, `/api/admin?action=login` was then also 429, and `/api/admin?action=dashboard` and `/api/courses` still answered normally.
- It sits in front of the API's own per-account and per-IP lockout (`api/_lib/loginThrottle.ts`). The firewall stops fast scripts; the API lockout stops slow guessing.

## Services and environment variables

### Backend (Vercel project environment)

| Variable | Service | Purpose |
|---|---|---|
| `DATABASE_URL` | Neon Postgres | Required. The API fails at import without it. |
| `APP_URL` | | Public base URL used in emails and as the PayFast notify URL. Defaults to `https://app.flagrr.com`, which does not resolve yet. |
| `CRON_SECRET` | Vercel cron | Bearer token for the daily billing check. |
| `PAYFAST_MODE` | PayFast | `live` for production; anything else is sandbox. |
| `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY` | PayFast | Default to PayFast's public sandbox values if unset. |
| `PAYFAST_PASSPHRASE` | PayFast | Required for subscriptions. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Resend | Transactional email. The sending domain must be verified. |
| `CONTACT_EMAIL` | | Where contact-form messages go. Falls back to a hard-coded address in code. |
| `EXPO_ACCESS_TOKEN` | Expo push | Sending push notifications. |
| `RECEIPT_EXTRACTOR` | | `claude` to use Claude vision; otherwise Tesseract plus regex. |
| `RECEIPT_EXTRACTION_MODEL`, `RECEIPT_EXTRACTION_EFFORT` | Anthropic | Model and effort for the Claude extractor. |
| `ANTHROPIC_API_KEY` | Anthropic | Read by the SDK when the Claude extractor is on. |

Other services in use: Tesseract language data is fetched from the tesseract.js CDN at run time.

### Marketing site

| Variable | Purpose |
|---|---|
| `SITE_URL` | The site's own public `https://` URL. Must be set for club signup to work (otherwise 501). Also used for metadata, sitemap and robots. |
| `FLAGRR_APP_URL` | App backend base URL. Defaults to `https://flagrr-loyalty.vercel.app`. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Optional Google Analytics. Off by default; needs a cookie notice and a reviewed privacy policy before it is enabled. |

### Mobile (build time)

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | Override the API base URL. |
| `EXPO_PUBLIC_STORE_BUILD` | `1` in the EAS `preview` and `production` profiles. Hides the admin login entry points so store builds are member-only. |

## Native builds (EAS)

From `mobile/app.json` and `mobile/eas.json`:

| | |
|---|---|
| App name / slug | Flagrr / `flagrr` |
| Version | 1.1.0 (Expo SDK 58). First 1.1.0 builds on 24 Nov 2026: iOS build 7 (production profile, sent to TestFlight for internal testing) and an Android internal preview. The store apps are 1.0.1 (SDK 57). |
| iOS bundle ID / build number | `com.flagrr.loyalty` / 7 |
| Android package / version code | `com.flagrr.loyalty` / 9 |
| EAS project ID | `12ea4b7f-59dd-490e-8286-443a03ab9b6b`, owner `ewo-solutions` |
| OTA updates | `expo-updates`, runtime version policy `appVersion` |
| Profiles | `development` (dev client, internal), `preview` and `production` (channels of the same names, `EXPO_PUBLIC_STORE_BUILD=1`) |
| `appVersionSource` | `local` (the production profile auto-increments) |
| Build upload | `/.easignore` (repo root) decides what EAS Build uploads. While it exists EAS ignores every `.gitignore`, so it repeats their rules (above all `scripts/receipt-eval/fixtures/`, real member receipts) and adds folders the app build doesn't need (`reels/`, `refresh-assets/`, `marketing/`, `scripts/`, `docs/`). Add new ignore rules to both files. |
| iOS submit | Apple team `KGZPMLYFZQ`, App Store Connect app `6796048910` |
| Android | `google-services.json` committed (Firebase project `flagrr-8b915`); no Android submit block in `eas.json` |
| Orientation / theme | Portrait; `userInterfaceStyle` is `automatic` from 1.1.0 (1.0.1 builds had `light`, which stopped the app following the phone's dark mode) |

Push notifications need working credentials in EAS (an Apple APNs key and Android FCM v1). These cannot be checked from the repository.

Known issues in `app.json`: it requests `android.permission.RECORD_AUDIO`, which the app never uses, and has no splash configuration.

## Database

- `db/schema.sql` is a **partial, older** snapshot. It does not include about 13 tables and many columns that later migrations added. Do not treat it as the current schema.
- `db/migrations/001` to `053` are plain SQL files. There is **no migration runner and no tracking table**: apply them in numeric order by hand against Neon, and keep a record of which have been applied.
- Migration `018_admin_broadcasts.sql` uses `create table` without `if not exists`, so it fails if the table already exists. Migrations `003` and `017` are destructive; read them before running on a database with data.
- `db/seed.sql` no longer works as written: it inserts `golf_products` without `course_id`, which became `NOT NULL` in migration `042`, and uses `on conflict` on a table without a matching unique constraint.
- Any new schema change needs a new numbered file in `db/migrations/`.
- `048_course_guide_and_my_golf.sql` adds the Course Guide and My Golf tables. Until it is applied, the Course and My Golf tabs and the dashboard's Course map panel show load errors.
- `049_golf_share_with_club.sql` adds `golf_profiles.share_with_club` (default true) and an index for the admin Golf pages. Apply it **before** deploying the code that uses it: until it is applied, the member Course and My Golf tabs, the member data export and the admin Golf pages fail with a missing-column error. It is additive and safe to run more than once.
- `050_password_reset_events.sql` adds the `password_reset_events` table used to rate-limit and log password resets. Apply it **before** deploying the code that uses it: until it is applied, member and admin forgot password and reset fail with a server error. It is additive and safe to run more than once.
- `051_login_events.sql` adds the `login_events` table used for the sign-in lockout and audit trail, and cuts existing super admin and support agent sessions to at most 12 hours. Apply it **before** deploying the code that uses it. If the code ships first, sign-in still works but has no lockout, and each sign-in logs `login_events table missing`. Safe to run more than once (running it again only shortens super admin and support sessions again).
- `052_activity_receipt_id.sql` adds `activity.receipt_id`, so a "Receipt scanned" row in Reward Activity can open its receipt (1.1.0 member app). It can be applied before or after the deploy: until it is applied the API leaves the link out and logs `[schema] activity.receipt_id missing` (`api/_lib/schemaColumns.ts`), and rows written in that time stay unlinked. Rows from before the migration are not linked.
- `053_notification_support_ticket.sql` adds `notifications.support_ticket_id`, so a "Reply to your feedback" notification can open the member's feedback thread. Like 052 it can be applied before or after the deploy: until then the notification is sent without the link and the API logs `[schema] notifications.support_ticket_id missing` (`api/_lib/schemaColumns.ts`).

## Course maps

`npx tsx scripts/course-maps/build.ts <slug> [--refresh]` builds `course-maps/<slug>.json` from `course-maps/cards/<slug>.card.json` and OpenStreetMap (Overpass API, no key needed). Import the result in the super admin console. Full steps: [Course Maps](Course-Maps). No new environment variables; the GM upload email goes to `CONTACT_EMAIL`.

## Domains and DNS

- `app.flagrr.com` is registered in Vercel but its DNS does not resolve publicly yet.
- Because of that, `mobile/src/api/client.ts` hard-codes `https://flagrr-loyalty.vercel.app` as the API base (overridable with `EXPO_PUBLIC_API_URL`), and the Strand pilot email loads its images from the same domain.
- `flagrr.com` and `www.flagrr.com` serve the marketing site's production deployment (verified 2026-11-02), so the pilot email's "Get Flagrr" button works.
- Once DNS is set up, switch `APP_URL`, the mobile API base URL and the email links together.

## Production settings check (Vercel project `flagrr-loyalty`, 2026-10-28)

Checked by listing variable **names** only; no values were read. Sensitive variables show as present but their values are hidden, so whether `PAYFAST_MODE` is live or sandbox is **not** known.

| Variable | Status |
|---|---|
| `PAYFAST_MODE`, `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE` | Set (production only). Live vs sandbox unconfirmed. |
| `CRON_SECRET` | Set (production). |
| `RESEND_API_KEY` | Set (production and preview). |
| `RESEND_FROM_EMAIL` | Set (production). |
| `DATABASE_URL` (and the other Postgres/Neon variables from the Vercel Neon integration) | Set (all environments). |
| `RECEIPT_EXTRACTOR` | Set to `claude` (production and preview). |
| `APP_URL` | **Not set.** The backend falls back to `https://app.flagrr.com`, which does not resolve, so the PayFast notification URL (`api/courses/index.ts:190`) is wrong and a paid club signup would never be provisioned. |
| `ANTHROPIC_API_KEY` | **Not set.** With `RECEIPT_EXTRACTOR=claude` the Claude path cannot authenticate, so scans fall back to Tesseract silently. |
| `EXPO_ACCESS_TOKEN` | Not set. Push sending still works without it; it is only used as an optional auth header (`api/_lib/pushNotifications.ts:46`). |
| `CONTACT_EMAIL` | Not set. The hard-coded personal address fallback is in use. |
| `RECEIPT_EXTRACTION_MODEL`, `RECEIPT_EXTRACTION_EFFORT` | Not set (code defaults apply). |

Other findings from the check:

- Vercel flags several Neon integration variables (for example `DATABASE_URL`, `POSTGRES_URL`, `PGPASSWORD`) as readable secrets. They can be converted to sensitive variables in the Vercel dashboard.
- EAS shows finished store builds for both platforms (iOS build 6 and Android build 8, version 1.0.1, production profile). Whether the Apple and Android push credentials are uploaded cannot be seen through the API and still needs checking in the Expo dashboard.
- Export My Data is implemented for phones (writes a JSON file and opens the share sheet, `mobile/src/api/client.ts`) but has not been run on a real device.

## Shipping updates without a new store build (EAS Update)

Checked 2026-10-28 against `mobile/app.json`, `mobile/eas.json`, `mobile/package.json` and Expo's EAS Update docs.

**Configured:** `expo-updates` is installed, `updates.url` points at the EAS project, and the `production` build profile uses the `production` channel (EAS shows the store builds on that channel). JavaScript and asset changes can be published with `eas update --channel production --message "..." --environment production` and installed apps download them in the background on launch (apply after one or two restarts).

**Verified 2026-10-28:** updates have been published to the `production` branch on runtime 1.0.1 (latest, 2026-10-30: the opening screen in the Liquid Glass look, PR #17, group `17bb7657-581f-4313-ae27-5ff8392fd56f`, from commit `a19a369`; before it the one-button alert fix and resume-or-discard on round start, group `b27bec33-b1e2-4f76-b078-cbf88466eaf1`, from commit `afeb298`; before that Course, My Golf and course maps, group `1180913e-9375-421a-a0ad-35ad1009e82b`; and before that the motion-system update, group `5963f513-7682-4859-a822-ba9428dabc97`), and `EXPO_PUBLIC_STORE_BUILD=1` is now defined in the EAS `production` environment. Updates published before that date may have been bundled without it. **Not confirmed from here:** which Expo plan the `ewo-solutions` account is on. EAS Update is available on every plan; paid plans allow more users, bandwidth and storage, so check the plan limits in the Expo dashboard.

Rules and gotchas:

- `runtimeVersion` uses the `appVersion` policy. An update only reaches builds with the **same app version**. The store apps are 1.0.1; the code on `claude/member-store-build` is 1.1.0 (SDK 58). An update for today's 1.0.1 installs must be published from a commit before the SDK 58 upgrade (the last is `ff32192`); an update published from 1.1.0 code reaches only 1.1.0 builds. Node.js for SDK 58: 22.13+ on the 22 line or 24.3+ on the 24 line (odd-numbered releases unsupported). Bumping `version` in `app.json` creates a new runtime that existing installs will not receive updates for; they stay on the old runtime until the user installs the new store build.
- Anything native needs a new build and store submission: a new native module or Expo plugin, permission changes, an Expo SDK upgrade, icon or splash changes.
- **`EXPO_PUBLIC_STORE_BUILD` is set only in the `eas.json` build profiles.** From SDK 55, `eas update` ignores local `.env` files and uses variables stored on EAS servers for the chosen `--environment`. If `EXPO_PUBLIC_STORE_BUILD=1` is not also defined in the EAS `production` environment, an update would be bundled with it unset, which re-enables the admin-login links in the store apps (`mobile/src/config/buildConfig.ts`). It is now defined there (2026-10-28); keep it if the environment is ever recreated.
- The web app on Vercel is separate: it updates on every Vercel deploy and needs no store step.

## Production database migration status (checked 2026-11-17)

A marker check for every migration from 025 to 048 was run against the production database. All were present except `035_support_ticket_priority.sql`, which had been skipped (036 had been applied). The missing `support_tickets.priority` column made the super-admin Support Centre fail to load ("Couldn't load this"; server error `column t.priority does not exist`). It was added on 2026-11-17 with the idempotent form of migration 035. Production is now up to date through migration 048. Migration `049_golf_share_with_club.sql` was applied to production (Neon branch `main`) on 2026-11-17, before the admin Golf pages shipped; a check afterwards found the column and index present.

Because migrations are applied by hand, run the same marker check after applying a batch of migrations, and add a row for each new migration to it. The check query is in `db/checks/migration-status.sql`.
