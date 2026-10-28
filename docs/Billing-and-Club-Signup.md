# Billing and Club Signup

Clubs pay a monthly subscription through **PayFast**. Signup starts on the marketing site (`ewo-solutions/flagrr-marketing`) and is completed by the app backend (`api/courses/index.ts`, `api/_lib/payfast.ts`).

## Pricing

| | Amount |
|---|---|
| First payment | R2,500 (`INTRO_FIRST_PAYMENT_AMOUNT`) |
| Recurring, monthly, no end date | R5,250 (`RECURRING_SUBSCRIPTION_AMOUNT`) |

PayFast subscriptions have a first-payment amount and then one flat recurring amount, so the intro rate applies to the first payment only.

The same figures are repeated by hand in the marketing site (`src/content/home.ts`, `src/app/clubs/signup/page.tsx`, `src/components/clubs/DemoSection.tsx`). Change all of them together.

## Flow

1. The club fills in the form on `/clubs/signup` (`SignupForm.tsx`) and the browser POSTs to the marketing site's `/api/club-signup`.
2. That route validates the input. If `SITE_URL` is not an `https://` address it returns 501. Otherwise it calls the app backend at `POST {FLAGRR_APP_URL}/api/courses?action=initiateSignup` with the return URL (`/clubs/signup/success?course=...`) and cancel URL (`/clubs/signup/cancel`).
3. The backend inserts a row in `pending_club_signups` (keyed by a random `m_payment_id`) and returns the PayFast form URL and signed subscription fields.
4. The browser is sent to PayFast's hosted payment page.
5. On payment, PayFast posts an ITN to `{APP_URL}/api/courses?action=payfastNotify`. The backend accepts it only if the signature matches, the source IP is in PayFast's published ranges, PayFast's own validate endpoint confirms it, and the merchant ID matches.
6. On `payment_status = COMPLETE` for a pending signup, the backend creates the course and its first `course_admin` (`provisionCourseFromSignup`), sets `subscription_status = 'active'`, stores the PayFast token and next billing date, marks the signup `completed`, and emails the admin their login with a **temporary password**. The admin must choose their own password at first login.
7. If the signup carried a club referral code, the referrer receives **500 Flagrr Cash** (`COURSE_REFERRAL_BONUS`, max 10 referral bonuses per member).
8. Later `COMPLETE` notifications with a token are renewals: they reset the club to `active` and update the next billing date. A `CANCELLED` notification sets `canceled`.

## Subscription states

| State | Meaning |
|---|---|
| `active` | Paid up. |
| `past_due` | Renewal overdue. Club keeps working while reminders go out. |
| `canceled` | Locked out: the club's course admins and staff get 403 on every request, and its members earn at the standard non-participating-club rate until reactivated. |

### Grace period and the daily cron

- `vercel.json` runs `GET /api/courses?action=payfastGracePeriodCheck` daily at 06:00 UTC. The request must carry `Authorization: Bearer $CRON_SECRET`; without `CRON_SECRET` set it returns 401.
- An `active` club whose `next_billing_date` is more than 3 days in the past becomes `past_due`.
- Reminder emails go to the club's active course admins at day 0, 14 and 25 of being past due.
- At 30 days past due the club becomes `canceled`.
- PayFast does not send a "payment failed" notification, so overdue is detected by comparing the next billing date to today.

## What super-admin Cancel and Reactivate do

They only change `courses.subscription_status` (`api/admin/index.ts`, `superAdminCourseCancelSubscription` / `superAdminCourseReactivateSubscription`), and are written to the audit log. **Cancel does not cancel the PayFast subscription.** Reactivate does not touch `next_billing_date`.

## Environment

Backend: `PAYFAST_MODE` (`live`, anything else means sandbox), `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `APP_URL`, `CRON_SECRET`, plus the email settings. Marketing site: `SITE_URL`, `FLAGRR_APP_URL`. See [Environment and Setup](Environment-and-Setup).

**Fallbacks to be aware of:**
- With no PayFast settings, the backend uses PayFast's public **sandbox** merchant ID and key, no passphrase, and the sandbox host. Subscriptions need a passphrase.
- `APP_URL` defaults to `https://app.flagrr.com`, which does not resolve yet. If it is not set in Vercel, PayFast's notifications never arrive and no club is created.
- `SITE_URL` on the marketing site defaults to localhost, which makes signup return 501.

## Open issues

These are real defects in the current code, not planned work:

1. **The paid amount is never checked.** `payfastNotify` creates a club on any `COMPLETE` status for a matching `m_payment_id`, without comparing `amount_gross` with the expected amount (`api/courses/index.ts:221-261`). With no passphrase set, the signature can be forged by anyone who has the checkout fields.
2. **Signature encoding may be wrong.** Empty fields are skipped when building the signature (`api/_lib/payfast.ts:58`), whereas PayFast's reference includes every ITN field except `signature`. `encodeURIComponent` also leaves `'()!*` unencoded where PayFast expects them encoded, so a club name like "St Andrew's" could break the checkout signature. Needs testing in the PayFast sandbox.
3. **A failed provisioning leaves an orphan club.** Course insert, admin insert, email and status update are separate steps (`api/courses/index.ts:77-100, 234-242`). If one fails (for example the admin email already exists), the course row stays, the signup stays `pending`, PayFast retries, and each retry creates another course (`-2`, `-3` slug). Clubs created this way also get no `merchants` row, unlike clubs made by a super admin.
4. **VAT.** All copy says "ex VAT", but PayFast is charged a flat R2,500.00 / R5,250.00 with no VAT added.
5. **Reactivate is undone by the cron.** The daily check flags any `active` club with an overdue `next_billing_date` as `past_due` again.
6. **No terms checkbox** on the signup form for a recurring paid subscription.
7. `pending_club_signups.status` is never set to `failed`.
