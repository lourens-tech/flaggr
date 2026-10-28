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
npm test            # tsx --test api/_lib/*.test.ts  (31 tests)
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
Read the Expo SDK 57 docs (`https://docs.expo.dev/versions/v57.0.0/`) before changing code. Set `EXPO_PUBLIC_API_URL` to point the app at a local backend; otherwise it calls `https://flagrr-loyalty.vercel.app`.

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
| Version | 1.0.1 |
| iOS bundle ID / build number | `com.flagrr.loyalty` / 6 |
| Android package / version code | `com.flagrr.loyalty` / 9 |
| EAS project ID | `12ea4b7f-59dd-490e-8286-443a03ab9b6b`, owner `ewo-solutions` |
| OTA updates | `expo-updates`, runtime version policy `appVersion` |
| Profiles | `development` (dev client, internal), `preview` and `production` (channels of the same names, `EXPO_PUBLIC_STORE_BUILD=1`) |
| `appVersionSource` | `local` (the production profile auto-increments) |
| iOS submit | Apple team `KGZPMLYFZQ`, App Store Connect app `6796048910` |
| Android | `google-services.json` committed (Firebase project `flagrr-8b915`); no Android submit block in `eas.json` |
| Orientation / theme | Portrait; `userInterfaceStyle` is `light` (this stops the app following the phone's dark mode) |

Push notifications need working credentials in EAS (an Apple APNs key and Android FCM v1). These cannot be checked from the repository.

Known issues in `app.json`: it requests `android.permission.RECORD_AUDIO`, which the app never uses, and has no splash configuration.

## Database

- `db/schema.sql` is a **partial, older** snapshot. It does not include about 13 tables and many columns that later migrations added. Do not treat it as the current schema.
- `db/migrations/001` to `047` are plain SQL files. There is **no migration runner and no tracking table**: apply them in numeric order by hand against Neon, and keep a record of which have been applied.
- Migration `018_admin_broadcasts.sql` uses `create table` without `if not exists`, so it fails if the table already exists. Migrations `003` and `017` are destructive; read them before running on a database with data.
- `db/seed.sql` no longer works as written: it inserts `golf_products` without `course_id`, which became `NOT NULL` in migration `042`, and uses `on conflict` on a table without a matching unique constraint.
- Any new schema change needs a new numbered file in `db/migrations/`.

## Domains and DNS

- `app.flagrr.com` is registered in Vercel but its DNS does not resolve publicly yet.
- Because of that, `mobile/src/api/client.ts` hard-codes `https://flagrr-loyalty.vercel.app` as the API base (overridable with `EXPO_PUBLIC_API_URL`), and the Strand pilot email loads its images from the same domain.
- The pilot email's "Get Flagrr" button points at `https://flagrr.com`, which has not been confirmed to serve the marketing site.
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

**Not confirmed from here:** whether any update has actually been published, and which Expo plan the `ewo-solutions` account is on. EAS Update is available on every plan; paid plans allow more users, bandwidth and storage, so check the plan limits in the Expo dashboard.

Rules and gotchas:

- `runtimeVersion` uses the `appVersion` policy. An update only reaches builds with the **same app version** (currently 1.0.1). Bumping `version` in `app.json` creates a new runtime that existing installs will not receive updates for; they stay on the old runtime until the user installs the new store build.
- Anything native needs a new build and store submission: a new native module or Expo plugin, permission changes, an Expo SDK upgrade, icon or splash changes.
- **`EXPO_PUBLIC_STORE_BUILD` is set only in the `eas.json` build profiles.** From SDK 55, `eas update` ignores local `.env` files and uses variables stored on EAS servers for the chosen `--environment`. If `EXPO_PUBLIC_STORE_BUILD=1` is not also defined in the EAS `production` environment, an update would be bundled with it unset, which re-enables the admin-login links in the store apps (`mobile/src/config/buildConfig.ts`). Define it once in the EAS dashboard (Environment variables, production) before publishing the first update.
- The web app on Vercel is separate: it updates on every Vercel deploy and needs no store step.
