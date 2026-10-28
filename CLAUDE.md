# Flagrr (flaggr repo)

Golf-club loyalty platform: members scan receipts and earn Flagrr Cash (FC), then redeem it for rewards at their club. This repo holds the whole product except the marketing website (`ewo-solutions/flagrr-marketing`, a separate Next.js repo).

| Path | What it is |
|---|---|
| `api/` | Vercel serverless functions (TypeScript). One folder per function, sub-actions via `?action=`. Shared logic in `api/_lib/`. 12 functions is the Hobby plan cap: add actions to an existing router instead of adding a file. |
| `db/` | `schema.sql`, `seed.sql`, numbered migrations in `db/migrations/` (no runner; apply in order). |
| `mobile/` | Expo / React Native app (member, club-admin, staff, support, super-admin) exported to web for Vercel. Read `mobile/AGENTS.md` first. |
| `marketing/` | Club-launch mailers and scripts. |
| `scripts/receipt-eval/` | Receipt-scan accuracy evaluation. |
| `docs/` | The project wiki. Keep it true (see below). |

## Commands

- API tests: `npm test` (root). Type-check: `npx tsc --noEmit` (root) and in `mobile/`.
- Web build: `cd mobile && npx expo export --platform web`.

## Documentation must stay current (mandatory)

Every change to behaviour, data, config, pricing, copy rules or build setup ships with its documentation update **in the same commit/PR**. Before finishing any task, walk this table and update every doc the change touches. If nothing needed changing, say so in the PR description.

| If you change... | Update |
|---|---|
| Member screens, earn/redeem rules, tiers, streaks, referrals, notifications | `docs/Member-App-Features.md`, `docs/UAT-Checklist.md` |
| Admin / super-admin / staff / support screens or permissions | `docs/Admin-Console-Features.md`, `docs/UAT-Checklist.md` |
| PayFast, club signup, subscription states, pricing, cron | `docs/Billing-and-Club-Signup.md` |
| Endpoints, auth, DB schema or migrations, env vars, build/deploy config, native build ids | `docs/Technical-Architecture.md`, `docs/Environment-and-Setup.md` (and keep `db/schema.sql` in step with new migrations) |
| An open issue is fixed, found or deliberately deferred | `docs/Known-Limitations-and-Future-Work.md` (update its "last verified" date) |
| Colours, fonts, logo use, voice, claims | `docs/Brand-Kit.md` (and the published brand-kit artifact) |
| Anything that adds, removes or renames a doc page | `docs/Home.md` page list |

Rules for doc edits: describe what the code does today, verified against the code, not what was planned. Never put secrets or key values in docs (names and purposes only). If a claim cannot be verified, mark it "unverified" instead of guessing.

## Brand and claims

Follow `docs/Brand-Kit.md` for anything user-facing. Never frame Flagrr Cash as money or convertible to rands, never state member/club counts or pilot results, and rates and reward values are set per club.
