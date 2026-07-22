# Known Limitations & Future Work

Things deliberately not built yet, and what groundwork already exists so they integrate cleanly when they are.

## Golf-course-admin and super-admin sides

Not built. Planned shape (agreed but not implemented):

- One app, role-gated navigation — the same codebase renders a different screen set depending on whether the logged-in identity is a member, a course admin, or a super admin.
- Course admins and super admins are a **separate identity** from members (`admins` table — `course_id` required for a course admin, null for a super admin who oversees every club), with their own session table (`admin_sessions`), deliberately not mixed into the member `users` table.
- Admin accounts are **not self-serve** — a super admin creates a course admin (or a future marketing-site subscribe-and-pay flow does), and the new admin activates via a one-time, time-limited email link (set a password, then log in normally) rather than a standing "magic link."
- **Database groundwork already in place**: the `admins`/`admin_sessions` tables, and billing columns on `courses` (`stripe_customer_id`, `stripe_subscription_id`, `subscription_status`) for the future "subscribe your golf club" marketing-site flow (Stripe Checkout + webhook). None of this is wired to any UI yet.

## Marketing site / paid subscription flow

Not built. The plan: a page on the marketing website where a golf course signs up and pays a subscription (Stripe), and on successful payment gets emailed a course-admin activation link. Requires the admin side above to exist first.

## Real phone push notifications

Fully wired up in code, but **dormant**:

- Every automatic notification (receipt scan, redemption, birthday bonus, quarterly bar voucher, streak bonus) already attempts a push send in addition to the in-app notification.
- The client already requests permission and registers a device token when one is available.
- **What's missing**: an EAS (Expo) project and, for iOS, an Apple Developer Program account ($99/yr) — required for `expo-notifications` to produce a real device push token at all, and for iOS push credentials specifically. Until those exist, the app can only ever be a web export; a **native build (EAS Build)** is what needs to happen before this can be tested on a real device.
- Once those accounts exist and a native build is produced, this activates automatically — no further backend changes are needed.

## Reporting readiness

An audit of the schema ahead of the future admin panel found and closed three gaps: `users.tier` is now kept in sync (previously it was written once at signup and never updated), ad taps are now logged (`ad_clicks`) for future performance reporting, and `receipts.course_id` now has an index for per-club reporting queries. No further gaps are known, but this hasn't been re-audited since.

## Multi-club receipt scanning needs merchant setup per club

The "away club" flat-rate earning logic (see [Member App Features](Member-App-Features)) only engages once a receipt is matched to a `merchants` row that has its own `course_id` set. Today only one club (Strand Golf Club) is signed up, so every scan is currently treated as home-club. Onboarding a second participating club requires adding it as a `merchants` row with its `course_id` pointed at that club — not yet done for any second club.

## App store distribution

The app has never been built as a native iOS/Android binary — only the Expo web export, deployed to Vercel. Getting onto the App Store / Play Store requires the EAS project and Apple Developer account mentioned above, plus a Play Store developer account for Android distribution.
