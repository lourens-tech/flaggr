# Known Limitations & Future Work

_Last verified against code on 2026-11-25._

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

1. **Members have no logout endpoint**, so signing out of the member app leaves that session valid on the server until it expires (30 days). Since 2026-11-20 a password reset or change does end sessions, sign-in is locked after repeated wrong passwords (`api/_lib/loginThrottle.ts`), and reset codes are rate-limited (`api/_lib/resetThrottle.ts`). The sign-in lockout is counted per email/username, so anyone who knows an address can keep that account locked out by entering wrong passwords (10 every 15 minutes); the owner can get back in by resetting their password. A Vercel Firewall rule (since 2026-11-20) also caps sign-in and reset requests at 10 per IP per minute, but nothing here stops an attacker who spreads slow guesses across many IP addresses and accounts. Session tokens are stored in plain text in `sessions` and `admin_sessions`. The reset limits are counted in the database per email/username and per IP address, so someone rotating IP addresses can still request up to 3 codes per account every 30 minutes, and anyone can lock an account out of resetting for 30 minutes by entering 5 wrong codes.
2. **Club admins can edit and delete super-admin ads.** The Ads tab was removed from the club-admin app, but the API still accepts `ads`, `adSave` and `adDelete`. Saving a multi-club ad runs `syncAdCourses(id, false, [courseId])`, which removes every other club from it. Deleting removes it for all clubs. None of this is audit-logged. `api/admin/index.ts:893-931, 3986-4002`
3. **Voucher can be redeemed twice.** The update has no `and status = 'active'` condition, so two simultaneous scans both succeed. `api/admin/index.ts:4283-4286`
4. **Members can move between clubs freely** and keep their balance, tier and verified status. Editing date of birth lets a member claim the birthday bonus on any day. `api/profile/index.ts:491, 510`
5. **Any receipt earns Flagrr Cash.** No merchant match or receipt date check is required, and repeated preview scans can call Claude with no rate limit. `api/_lib/pointsEngine.ts:233-292`
6. **Receipt numbers are unique across all clubs.** Two clubs whose tills both print the same number will collide, and the second member is rejected as a duplicate. `db/schema.sql:401`, `api/_lib/fraudChecks.ts:44`
7. **Redeeming is not atomic.** Points are deducted and the voucher is inserted in separate steps, so points are lost if the second fails. `api/redeem.ts:44`
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
2. **No 18+ check at sign-up,** although the terms require it. `mobile/src/screens/onboarding/SignUpStep1Screen.tsx:150`
3. **Fixed in the 1.1.0 code (25 Nov 2026): the terms could not be read before sign-up.** Landing's acceptance line and Sign up step 2 now link to Terms and Privacy in the signed-out stack. Still in the 1.0.1 store app.
4. **Dead `#` links on the marketing site:** Terms and Privacy on the signup, success and cancel pages, "Club login" and "Contact". `flagrr-marketing: src/app/clubs/signup/page.tsx:87-88`, `src/content/home.ts:152,161`
5. **No privacy contact.** The privacy and delete-account pages point only to in-app Contact Us. `mobile/static/privacy.html:97`, `delete-account.html:75`
6. **A personal email address** is the fallback contact in code and on a public page. `api/profile/index.ts:19`, `api/admin/index.ts:69`, `mobile/static/support.html:73`
7. **App store badges** on current marketing assets are placeholders and must be replaced with official artwork before paid or printed use (see `docs/Brand-Kit.md`).
8. **Google Analytics** on the marketing site is off by default and needs a cookie notice before it is switched on. `flagrr-marketing/.env.example:16-22`
9. **The privacy notice does not yet say that a member's club can see their golf rounds** (the admin Golf pages, added 2026-11-17, on by default with a switch in My Golf). Update the in-app terms and privacy text and `privacy.html` (and the marketing site's privacy page) before relying on the default under POPIA. `mobile/static/privacy.html`

## Marketing claims that conflict with the app or the brand kit

Fixed in `flagrr-marketing` on 2026-10-28 (commit `5f230aa`): the "R1 = 1" and "on every rand" wording, the desktop-app claim, the "paid automatically" bar voucher claim, the roster note for tier climbing, the claim that flagged receipts credit immediately (they are held until reviewed), "balance" wording, the invented partner club list, the invented advertiser reach figures, and the dead Terms/Privacy links on the club signup pages.

Updated in `flagrr-marketing` on 2026-11-02 (PR ewo-solutions/flagrr-marketing#2, merged and live on flagrr.com): the golfers page shows Course and My Golf, the clubs page shows the Liquid Glass console and the four Course map stages, every phone mock-up has the app's seven-slot tab bar, and two wrong claims are gone: that staff handle enquiries and tickets (they only redeem vouchers and raise Flagrr support tickets), and that admin tools run in the app (admin login is web-only in store builds). The Course copy says courses go live as their maps are built, which stays true while no map is published (see [Course Guide and My Golf](#course-guide-and-my-golf)).

Still open:

- **The season calculator still converts rand spend to Flagrr Cash and then to "rounds of 18"** (`flagrr-marketing: src/components/home/CalculatorSection.tsx`, 900 FC per round). That is an FC-to-reward equivalence the brand kit says not to state, since reward values are set per club. Needs a product decision: reword, caveat, or remove.
- **Bar voucher amounts (R100 / R200)** are still shown in the tier tables (`flagrr-marketing: PhoneScreen.tsx:30-31`, `golfers.ts:13-14`, `home.ts:86-87`). They are set per club, so these should be dropped or caveated.
- **Placeholders and dead links that need a real value from you:** `[ SUPPORT@DOMAIN ]` (footer, terms, privacy), the footer "Club login" and "[ Contact ]" links (`home.ts:144, 153`), and "Web app" pointing at a section that has no web-app link.
- **Pricing is duplicated by hand** in several places and must be kept in step: `flagrr-marketing: src/content/home.ts:104`, `clubs/signup/page.tsx:56-60`, `DemoSection.tsx:48-55`, and the constants in `api/courses/index.ts:27-28`.

## Push notifications and native builds

- A native build is configured (`mobile/app.json` version 1.1.0 since the SDK 58 upgrade on 24 Nov 2026, not built yet; the store apps are 1.0.1; iOS build 6, Android versionCode 9; EAS project id present), but whether builds have been submitted to the stores is **unverified**.
- Android FCM v1 credentials and the iOS APNs key in EAS cannot be checked from the repo. **Unverified.**
- Logging out does not unregister the device token, so a logged-out phone can keep receiving the previous member's pushes until someone else logs in on it. `mobile/src/context/AppContext.tsx:197`, `api/_lib/pushNotifications.ts:15`
- The permission prompt appears on the first load with no explanation first. `mobile/src/context/AppContext.tsx:162`
- Push does nothing on the web build, which is the only deployed target today.
- `android.permission.RECORD_AUDIO` is requested though nothing records audio, and the camera plugin has no microphone usage string. `mobile/app.json:37`
- Fixed in code, ships with the 1.1.0 store build: `userInterfaceStyle` was `"light"`, so on iPhones the System appearance setting always gave light. It is now `"automatic"`. `mobile/app.json:8`
- No `splash` entry in `app.json`, although `assets/splash-icon.png` exists.
- `eas.json` has no Android `submit` configuration.
- Comments that say "no EAS project exists yet" are out of date. `mobile/src/context/AppContext.tsx:159`, `mobile/src/utils/pushNotifications.ts:21,29`, `mobile/App.tsx:33`

## Motion: deferred until the next store build

These need native code, so they wait for a new App Store / Play Store build (everything else in the motion system ships over the air; see [Technical Architecture](Technical-Architecture)):

- Haptic feedback on taps. The Bento brief asks for a light haptic on primary actions. `expo-haptics` is installed in the 1.1.0 code (24 Nov 2026) but no screen uses it yet; it is wired in phase 2 of the store-build plan.
- Bento motion uses `Animated` with the native driver instead of Reanimated (owner's decision, 2026-11-24). Transforms and opacity run off the JS thread; the tier ring's stroke and the segmented-control thumb width run on the JS thread.
- **Bento Home (2026-11-24) differs from its board where the app has no data for it:** the Resume round tile is fairway green instead of a course photo (rounds carry no photo); the hero shows the tier name without a multiplier ("Gold · ×1.5" on the board), because tier multipliers are not in the member data; the bell shows the unread count rather than only a dot, so the count isn't lost.
- **Bento scan flow (2026-11-24) differs from its boards where the app has no such feature or rule:** a torch button was added in 1.1.0 (approved); "This week counts for your streak" on Receipt submitted is left out (the app has no rule tying a receipt to the streak); a non-flagged receipt shows the kept board's "added and ready to spend" message (1.1.0; "wallet" removed), not the main board's "being reviewed", because only flagged receipts are held. The live camera view was checked only in code; the web preview had no camera.
- **Bento Rewards and Voucher (2026-11-24) differ from their boards where the app has no such feature:** no Share button on the Voucher (sharing a voucher isn't a feature today); the "Not enough Flagrr Cash" alert keeps the app's real-shortfall message, not the board's generic text. The Rewards Shop and Reward Activity headers no longer carry their own notification bell and avatar (Notifications is still on Home; the board drops them).
- **Bento golf screens (2026-11-24) are re-skinned in place**, not rebuilt to the boards' exact layouts: the hole view keeps its existing layout (fairway header with hole pills, floating map cards, score bar) in Bento colours, type, tiles and controls; My Golf keeps its charts. They go through `components/bento/legacy.tsx`, which maps the old colour names to Bento tokens. The hole board's photo-free "whole hole" header and some spacing differ.
- **Bento profile and support screens (1.1.0, 25 Nov 2026)** are rebuilt to the boards. Left as before: the enquiry chat keeps its previous message box (the Bento composer has no sending spinner yet); a failed Choose Golf Club list still shows an empty box with no message (not on the decided list); Refer a Friend's hero uses the app's Strand fairway photo for every member (question for the owner).
- Receipt History now draws every receipt in one scrolling list (it was a virtualised `FlatList`). Fine at today's volumes; revisit if members end up with hundreds of receipts.
- **Bento sign-in screens (1.1.0, 25 Nov 2026)** are rebuilt to the boards (labels above fields, no wordmark on Login, sign-up and Forgot, as the boards draw them). Differences left: Date of Birth keeps the phone's own picker (no Bento calendar); where the main and kept boards differ on Login and Reset the kept boards are followed; a no-network failure on Login still says "Something went wrong. Please try again." (as the kept board does).
- **Bento motion (polish pass, 2026-11-24) differs from the brief's motion table where it would need native work or change behaviour:** push and pop use the platform's native slide (iOS's own push, `ios_from_right` on Android, a fade on the web), not a custom 0.56 s slide with the old screen dimmed to 82%; the receipt camera keeps its full-screen slide up, so the screen behind doesn't shrink to 92% (that needs a modal presentation, which changes how it is dismissed); no haptics. The hole view's map and hole-pill labels and My Golf's chart labels stay below 12 pt because of the space they sit in.
- Bento glass is a solid fill on Android (a real blur needs a `BlurTargetView` behind every screen and is costly on mid-range phones).
- Gesture-driven 120Hz motion such as swipe-to-dismiss sheets (`react-native-reanimated`).
- Apple's real Liquid Glass material on iOS 26 (`expo-glass-effect`).
- Skeleton loaders while lists load are not built yet; screens still show a spinner.

## Course Guide and My Golf

- **Not live until migration `048` is applied and Strand's map is imported and published** (see [Course Maps](Course-Maps)). Strand's card and map are built and pass every check. The marketing site already describes the feature (with "on courses Flagrr has mapped" and "GPS coming soon" caveats), so publish a map before promoting it.
- **No GPS yet.** The ball starts on the tee and the member drags it; the hole view says "GPS integration coming soon". Club distances are typed in, not learned from shots.
- **No satellite imagery:** holes are drawn from OpenStreetMap outlines.
- **Nine-hole rounds need nine-hole ratings on the card.** Strand's card has none, so only 18-hole rounds can be scored there.
- **Map geometry is only as good as OpenStreetMap.** Tee boxes more than 15 m off the card length are placed from the card length instead; the builder lists them.
- **Scores are not submitted to GolfRSA,** and Flagrr never calculates a Handicap Index; members type theirs in.
- **Away courses are only courses Flagrr has mapped.** A member cannot add an unmapped course.
- **A map stays live if its club's subscription is cancelled**; unpublish it from the super admin console if it should go.
- **Admin Golf pages count only rounds on the club's own course** by its own members (owner's decision, 2026-11-17). Away rounds and visitors from other clubs are not shown to any club. There is no Excel export of golf data yet.
- **Fixed on 2026-11-17, then reverted with the change that caused it:** the iPhone Duo edge-to-edge change (PR #21) put hooks inside the admin and web screen layouts, which React flagged as a change in hook order when screens were pushed or popped. The owner asked for that whole Duo change to be undone, so the layouts are back to their earlier hook-free form (`adminScreenLayout` in `AdminScope.tsx`, `webScreenLayout` in `motionOptions.tsx`). React Navigation calls a `screenLayout` as a plain function, so keep hooks out of it.
- **Deferred on purpose:** the Flagrr Amateur Cup teaser from the mockup was left out; strokes gained, scrambling and handicap history are not built.

## Database and migrations

- **`db/schema.sql` is stale.** It still has Stripe columns, an `admins` role check limited to `super_admin|course_admin`, `ads.placement` without `home_top`, `golf_products` without `course_id` and `rand_value`, and it is missing about 13 tables (roster, support, audit log, reset codes, pending signups, referrals, ad courses, ad impressions, scan cache, duplicate attempts, super-admin broadcasts) and many columns. The `048` golf tables are in it.
- **Migrations cannot be replayed cleanly.** `018` uses `create table` without `if not exists`, `003` and `017` are destructive, and there is no migration runner or tracking table.
- **`db/seed.sql` fails on a current database:** it inserts `golf_products` without `course_id` (made NOT NULL by `042`), and its merchants insert uses `on conflict` with no unique constraint.
- **Unused columns and tables:** `admins.invite_token` and `invite_expires_at` (the invite flow was never built), `golf_products.sku`, `barcode` and `points_value`, `golf_activities.points_value`, legacy `user_stats` counters, the `streaks` table (created at signup, never updated, so `exportMyData` returns stale zeros), `receipts.image_uri`, and `ads.course_id`.
- **Timezones differ:** `monthly_points` buckets by server-local month, same-day dedupe uses South African time, and quarters use UTC.
- **Nothing cleans up:** vouchers are never marked `expired`, and expired sessions, reset codes, `password_reset_events` and `login_events` rows are never purged. The billing check is the only scheduled job.

## Admin and reporting gaps

- **iPhone Duo and phones in landscape (web app):** the admin consoles show white bars down the sides where the screen has side insets, and the unfolded Duo uses the phone layout with a bottom tab bar. Two attempts (an edge-to-edge layout with a vertical menu, PR #21, and a see-through status bar with a right-hand menu when folded, PR #22) were tried and reverted at the owner's request on 2026-11-17. Deliberately deferred.

- Archiving a club only hides it in the admin list. Members can still sign up to it and its staff can still log in. `api/courses/index.ts:332`
- Flagrr Cash per Rand (`fb_per_rand`) cannot be changed from any screen, only directly in the database. `api/admin/index.ts:3522-3526`
- Most club-admin actions (staff, rewards, catalogue, broadcasts, roster upload, co-admin changes) are not written to the audit log. Only fraud decisions are. `api/admin/index.ts:3287`
- A super admin can create or reactivate course admins past the 2-active limit, and two course admins can revoke each other. `api/admin/index.ts:2381, 2504, 3633, 3698`
- The super-admin enquiry chat is read-only, and there is no course-admin screen for duplicate receipt attempts although a comment says there is. `api/admin/index.ts:2065`
- Super admin, support agent and staff have no change-password option in Profile.
- Fixed on 2026-10-29 in the admin redesign: the unreachable course-admin ads screens were deleted, the desktop search now works (⌘K / Ctrl K: sections and, for course and super admins, members), and staff no longer get a bell that opened a 403 screen.
- The admin enquiry thread keeps showing its loading skeleton if the first load fails, until the 12-second refresh succeeds (an alert is shown). `mobile/src/screens/admin/AdminEnquiryChatScreen.tsx`
- When a course admin sets a staff member's password, `must_change_password` is cleared. `api/admin/index.ts:3866`
- Report downloads are web-only, and `memberActivity` ignores its period. `api/admin/index.ts:4373-4390`

## Logic and scale

- The quarterly bar voucher grant is recorded before checking the club has a matching reward, so a missing reward silently costs the member that quarter. `api/_lib/tierRewards.ts:107-123`
- Streaks count rejected receipts, contrary to the comment. `api/_lib/streak.ts:30-36`
- Broadcast fan-out sends one push per member in sequence and `api/admin/index.ts` has no `maxDuration`. Ad analytics queries join users, clicks and impressions and multiply rows. `api/admin/index.ts:2297, 4227`, `api/_lib/adAnalytics.ts:64`
- Tier numbers are written out in three places that must be kept in step: `api/_lib/tiers.ts`, `mobile/src/data/mockData.ts` (despite its name this is real tier copy) and `mobile/src/data/faqData.ts:24`.
- The Claude receipt settings (default model `claude-opus-5`, beta flag and `fallbacks` parameter) should be checked against the current API, and the silent fallback to Tesseract hides failures. `api/_lib/claudeReceipt.ts:10,121-129`
- **Multi-club scanning needs setup per club.** The away-club rate only applies once a receipt is matched to a `merchants` row with its own `course_id`. A club created without that row is treated as having no merchant of its own.

## Member app: found by the click-through tests (2026-11-24)

Two of these are still `test.fixme` in the Playwright suite in `mobile/e2e/`: the unreachable "Voucher not found." state and starting a nine-hole round at Strand. The others are fixed or covered by passing tests.

- **Fixed in the 1.1.0 code (25 Nov 2026), web build only: pushed screens could not be scrolled** (My Golf, Round detail, Start a Round, Sign up in a short window). The JS stack's web "page" mode expects the browser page to scroll, which Expo's web page does not. It came in with the JS stack in the 1.1.0 navigation work and was never in a store build. The stacks now use `headerMode: 'float'`; `e2e/smoke.spec.ts` checks it. Phones are not expected to be affected (CardContent's page mode is web only; unverified on a device).
- **Web build only: `hitSlop` does nothing on `Pressable`** (react-native-web 0.21.4 reads it only in the legacy `Touchable`), so on the web the touch area of small controls is their drawn size. Phones are not affected. The web-only admin link on Landing uses padding instead.
- **Fixed in the 1.1.0 code (24 Nov 2026), still in the 1.0.1 store app:** "View Current Balance", "Back to Rewards" and "See My Golf" stacked a second copy of the tabs (React Navigation 7's `navigate` pushes rather than going back), landing on Home and leaving Back pointing at the old screen. They now close what was opened and show Home, the Rewards tab and My Golf (owner's choice).
- **The Voucher screen's "Voucher not found." state cannot be reached.** Every way in passes a voucher id from the member's own list. Harmless, but untestable without a deep link.
- **Fixed (24 Nov 2026): web screen-reader states.** The tab bar now sets `aria-selected`, segments and toggles `aria-checked`, and busy buttons `aria-busy`; react-native-web did not map `accessibilityState` for these.
- **Fixed in the 1.1.0 code (25 Nov 2026), web build only: the button spinner's box was 0 px wide** (`flex: 0` became `0 1 0%`). The spinner now has no flex style and is centred by its row; while a button is busy its arrow nub is hidden, as every busy-button board draws it.
- **iPhone Duo, closed (found on TestFlight build 7, 24 Nov 2026):** the outer screen's camera cutout in the top-right corner covers Home's notifications bell and profile picture; iOS's safe area does not keep content clear of it. The 1.1.0 code now keeps Bento screens and the tab bar inside the left and right safe areas; whether iOS reports the Duo's camera strip as a safe area is **unverified** until it is checked in the iPhone Duo simulator (and the older screens restyled in phase 3 get the same treatment). The full Duo layout (native tab bar in the strip) is phase 4.
- **With no finished rounds, Course has no way into My Golf** (the Your game tile appears only once there are rounds); Home's My Golf link always works. The Course rebuild in phase 3 follows the board, which shows the way in.
- **Hole view: a press-and-hold on the score started while the course map is still loading can be cancelled** when the map appears and the screen re-lays out (seen on web; the member simply presses again). Check on a phone over a slow connection.
- **Nine-hole rounds cannot be started at Strand Golf Club** because its card has no nine-hole ratings (the setup screen says so). The nine-hole hole view and scorecard are tested by rewriting a round's response; starting a nine needs a course with nine ratings.

## Accessibility and content

- About 110 touchable elements in member screens and 2 accessibility labels. Icon-only buttons (notification bells, avatars) have none, and the unread badge count is not announced. `mobile/src/screens/home/HomeScreen.tsx:161`, `rewards/RewardsActivityScreen.tsx:84`
- The first FAQ answer describes ways to earn (promotions, in-app activities) that the backend does not implement, and the three help articles are stubs ending in "...". `mobile/src/data/faqData.ts:9, 46-50`
- **Fixed in the 1.1.0 code (24 Nov 2026):** with no ad configured, the ad slot showed a plain "Ad Space" box; it is now not shown at all (owner decision). `mobile/src/components/common/AdSpace.tsx`
- The PWA manifest describes the app as admin tools only, though members use the same web export. `mobile/static/manifest.json`
- Pilot launch email images and links use `flagrr.com` (which does serve the marketing site, verified 2026-11-02), and the QR script docstrings still mention `app.flagrr.com`. `marketing/strand-golf-club-pilot-launch.html:223`
- `app.flagrr.com` DNS is not configured, so the API base URL is pinned to `flagrr-loyalty.vercel.app`. `mobile/src/api/client.ts:26-30`
- Stale comments to refresh: "No live billing/Stripe wiring yet" (`api/admin/index.ts:1755`), "only 'canceled' is ever set" (`api/_lib/pointsEngine.ts:314-318`), PDF support mentioned in `api/_lib/memberRoster.ts`, and a reference to a nonexistent `itemsForBasis` in `api/_lib/pointsEngine.test.ts`.

## Not applicable to the audit, but still true

Flagrr Cash has no cash value and is never convertible to rands. Rates and the rewards catalogue are set per club. Do not state member counts, club counts or pilot results in marketing.

## Verified production settings gaps (2026-10-28)

See the table in `docs/Environment-and-Setup.md`. Open items from that check:

- **`APP_URL` is not set in Vercel**, so PayFast's notification URL points at `app.flagrr.com`, which does not resolve. A paid club signup would never be provisioned. Fix before taking any real club payment.
- **`ANTHROPIC_API_KEY` is not set** while `RECEIPT_EXTRACTOR=claude`, so receipt scans silently use Tesseract instead of Claude.
- **`PAYFAST_MODE` cannot be read** (sensitive variable), so confirm in the Vercel dashboard that it is live and that the merchant ID and key are the live ones.
- **`CONTACT_EMAIL` is not set**; the hard-coded personal address fallback is in use.
- **Push credentials** (Apple key, Android FCM v1) still need checking in the Expo dashboard; the API cannot show them.
- **Export My Data** has not been run on a physical phone.

## Support: replies to member feedback tickets are not visible to the member (2026-11-17)

A member's Give Feedback submission becomes a ticket in the support inbox, and agents can reply to it, but the member app has no screen or endpoint that shows ticket replies (only course admins and staff can read their ticket threads), and no notification or email is sent when an agent replies. Agents should not expect a member to see a reply. Fixing it needs a member-side "my feedback" thread view and a notification on reply.
