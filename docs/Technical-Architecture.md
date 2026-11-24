# Technical Architecture

_Last verified against code on 2026-10-28._

## Stack

- **Client**: one Expo SDK 58 (React Native 0.88, React 19.3) codebase in `mobile/`, using React Navigation. It renders the member app, the club-admin console and the super-admin console, chosen by who is logged in (see `mobile/src/navigation/RootNavigator.tsx`). It is deployed as a **web export** (`expo export --platform web`) to Vercel. Native iOS/Android builds are configured (`mobile/app.json`, `mobile/eas.json`, bundle id `com.flagrr.loyalty`) but push notifications are not yet running end to end (see [Known Limitations](Known-Limitations-and-Future-Work)).
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

All animation uses React Native's built-in `Animated` API plus native modules the store binary already ships (`react-native-screens` transitions), so motion changes can go out as an EAS Update with no new store build. No `react-native-reanimated` or Lottie. `expo-haptics` is installed from version 1.1.0 (the SDK 58 store build) but not used by any screen yet.

- **Tokens**: `mobile/src/theme/motion.ts` holds every duration, easing curve and spring, the shared stagger (`nextStaggerDelay`: things that mount together cascade 40ms apart, max 8 steps) and the Reduce Motion check (`prefersReducedMotion`, from the OS accessibility setting or the browser's `prefers-reduced-motion`). With Reduce Motion on, every animation jumps to its end state.
- **Components** (`mobile/src/components/motion/`): `FadeIn` (rise + fade on mount), `PopIn` (spring scale for success moments), `PressableScale` (press-in scale instead of opacity dimming, optional hover scale on web), `CountUpText` (numbers roll to their value and from old to new on change; with `allowDecimals`, which the Bento `CountUp` passes, strings with one or two decimals such as "30.0" roll too, while admin stat cards keep showing amounts with decimals as-is), `ScreenFade` (screen/content fade).
- **Where they are used**: `PillButton`, `RewardCard`, `StatCard`, `AdminStatCard`, `DesktopStatCard`, `DesktopPanel`, `DesktopDataTable` (first 20 rows), `ProgressBar` (fills), `BarChart` (bars grow), `BentoTabBar` (sliding tab highlight), `AdminTabBar` (phone tabs), `AppAlertHost` (Bento alert scales in from 1.1), `BentoSheet` (rises with overshoot), `DesktopShell` (content area fades), Home (balance roll-up, section cascade), Voucher (QR pops in, photo parallax), Receipt Success (trophy pops, Flagrr Cash rolls up), Rewards Shop (balance roll-up, card photos parallax; never the ad), Course (Stableford average), Round detail (points and gross), My Golf (average and stat tiles, rolling from the old to the new value when the period changes), Member Tiers and Profile (balance).
- **Navigation, member app (1.1.0)**: the root and sign-in stacks use React Navigation's JS stack (`@react-navigation/stack`) so the Bento prototype's transitions are exact (`mobile/src/navigation/transitions.ts`): push 0.56 s (the screen behind slides 28% left and dims to 82%), pop 0.52 s, the receipt flow as a modal 0.62 s (rises with its corners squaring off; the screen behind shrinks to 92%, dims to 60% and rounds to 40) and closes in 0.5 s, sign-in / sign-out a 0.5 s cross-fade, all on cubic-bezier(.32,.72,0,1). The covered screen takes the covering screen's interpolator. Animations are switched on for web too (`animation: 'default'`). Reduce Motion turns every transition into a 200 ms fade. Swipe-back follows the JS stack's gesture on iOS (off on the hole view). Tabs (`MainTabNavigator`): Home, Course, Rewards, Profile; `MyGolf` and `Activity` are root-stack screens; the receipt screens are a nested stack, `ScanFlow` (`ScanFlowNavigator`), so `navigate('ScanFlow')` opens it and closing its first screen dismisses the group. The tab bar is drawn once above the stack (`MemberTabBar`, through the stack's `layout` prop; it reads the full navigation tree from `navigationRef` because the stack's own state doesn't carry the open tab): it shows on the tab screens and My Golf (Course lit), slides away (0.6 s) elsewhere, re-taps scroll to the top (`navigation/scrollToTop.ts`, registered by `BentoScreen`), and tapping a tab on My Golf pops back or closes My Golf with the tab cross-fade (`closeAs: 'tab'`). Admin consoles keep the native stack (`motionOptions.tsx`). Known differences from the prototype, because one transition drives both screens from a single progress value: the leaving screen of a cross-fade follows the same curve as the entering one (prototype: CSS ease-out), the screen behind the scan flow returns in 0.5 s (prototype 0.55 s), and a tab switch fades the old tab out over 0.42 s (prototype 0.3 s).
- **Haptics** (`mobile/src/utils/haptics.ts`, `expo-haptics`): selection on tab, segment and toggle changes; a light impact on primary and lime `BentoButton`s; medium on Scan; success when Receipt Success opens, after a redeem and when a round is saved. iOS and Android only.
- **Scroll-linked chrome** (`BentoScreen`): a pushed screen's header row (Back, title, right button) sticks and turns into a floating glass pill over the first 70 pt of scroll; tab screens pass `scrollTitle` for a full-width glass title bar that fades and slides in between 40 and 120 pt. Parallax: reward photos on Home and Rewards, and the Voucher photo. Ads stay still, as in the prototype (its ad images have no parallax).

## Store build 1.1.0 (in progress)

The exact-match Bento store build (plan agreed with the owner on 24 Nov 2026) is being built on branch `claude/member-store-build`. Phase 1, the native upgrade, is in:

- Expo SDK 57 → 58: React Native 0.86 → 0.88.1, React 19.3, every `expo-*` module on its SDK 58 version (`npx expo install expo@^58.0.0 --fix`, `expo-doctor` 20/20). The installer also listed the config plugins of installed modules in `app.json` (`@react-native-community/datetimepicker`, `expo-font`, `expo-sharing`, `expo-splash-screen`, `expo-status-bar`, `expo-video`).
- `@react-native-async-storage/async-storage` stays on 3.1.1, the version the app has always used, although SDK 58 recommends 2.2.0: moving back a major version risks losing stored sign-in sessions and theme choices. `package.json` lists it under `expo.install.exclude` so `expo install --fix` leaves it alone.
- React Native 0.87 made its strict TypeScript API the default, so component refs are typed with the new instance types (`ScrollViewInstance`, `ViewInstance`, `TextInputInstance`). Types only; nothing changes at run time.
- `expo-file-system`'s `File.write()` is async from SDK 58, so the member data export (`api/client.ts`) now waits for the write before sharing the file.
- `app.json`: `version` 1.1.0 (a new runtime under the `appVersion` policy), `userInterfaceStyle` `automatic` (so the System appearance setting can pick dark on iPhones), and `expo-haptics` added.

### Owner decisions for the store build (24 Nov 2026)

These are decided but not built yet; each lands in a later phase with its doc and test updates.

- **Navigation.** "View Current Balance" closes the scan screens and shows Home; "Back to Rewards" closes the voucher and shows the Rewards tab; "See My Golf" goes back to the existing tabs. None of them stacks a second copy of the tabs any more (`popTo`). "Receipt scanned" rows in Reward Activity open that receipt in Receipt History; bonus rows stay plain.
- **Errors.** Raw technical text ("Internal server error", "Network request failed") is replaced by plain messages; server messages written for members are kept. Messages are added where failures are silent today: a failed redeem, the club list at sign-up, loading My Enquiries, Notification Preferences and Refer a Friend (with Try again), and an Open Settings button when camera access was denied for good.
- **Empty states and new copy.** No booked ad means no ad slot at all. New: an empty Notifications state, a "Code sent" toast after Send it again, Used / Expired badges on vouchers, and "Receipt submitted" / "Reward redeemed" toasts. Receipt History refreshes each time it opens.
- **Brand wording** (the brand kit wins). No "R1 = 1 FC" in the away-club or between-subscriptions notices; tier perks keep the multiplier but drop rands ("1.5x Flagrr Cash on your receipts", "A bar voucher each quarter you qualify"), in Member Tiers and the FAQ; "wallet", "balance" and "points" for Flagrr Cash are replaced everywhere.
- **Layouts: the mockup wins** for the scorecard (9-column grid per nine with Out / In), the receipt photo (full screen), Terms and Privacy (a toggle), Member Tiers (quarterly progress plus all four tiers as rows) and the enquiry type picker (bottom sheet).
- **Extras.** No voucher share. Terms and Privacy links on Landing and Sign up for signed-out people. The FAQ's first answer and the three Help Center articles are rewritten (owner approves the text first). Web screen readers get the selected / checked / busy states. The "GPS integration coming soon" chip is hidden until GPS exists. Members can read support's replies to Give Feedback (a "My Feedback" list and thread plus a reply notification; two new API actions; screens drawn before they are built). Strand Golf Club's nine-hole ratings will be added when the owner sends them.
- **Builds.** A preview now to check the SDK 58 upgrade on phones (iOS through TestFlight internal testing, Android as an internal build), and a final one after every phase. iPhone Duo screens are checked in the Xcode iPhone Duo simulator against the Duo mockups.

## Member app Bento redesign (in progress)

The member app is being restyled to the Bento design in phases (brief: Bento UI redesign; design canvas "Flagrr design canvas"). UI only: no API, data, navigation route or business rule changes. Phase 1 (foundation) is in:

- **Tokens**: `mobile/src/theme/bento.ts` (`bentoLight` / `bentoDark` colour tokens, brand constants, layout sizes, type roles). Components read them through `useBento()` in `ThemeContext.tsx`, which follows the existing System / Light / Dark preference and also reports Reduce Transparency. Shadows and inset highlights use React Native's `boxShadow` style (New Architecture), so they match the boards on iOS, Android and web.
- **Fonts**: interface text in Bento components uses the platform system font; titles and big numbers use Fraunces 700 (`Fraunces_700Bold`, added to `fontsToLoad`).
- **Components** (`mobile/src/components/bento/`): `BentoTile` (double-bezel tile, `tone="hero"` for fairway green), `BentoScreen` (ground, contour lines, 24 pt padding, sticky glass back button and a glass title bar that fades in after 40 pt of scroll), `BentoButton` (primary / secondary / lime, optional arrow nub), `GlassIconButton`, `SegmentedControl`, `BentoField`, `BentoToggle`, `Glass`, `BentoIcon` (line icons from the boards), `BentoSheet`, `BentoTabBar`, `showToast` / `ToastHost` (Dynamic Island toast; mounted in `App.tsx`, not used by any screen yet), text roles (`H1`, `Eyebrow`, `NavTitle`, `Body`, `Label`).
- **Motion** (`components/bento/motion.tsx`, curves in `theme/motion.ts` as `bentoEasing` / `bentoDuration`): `Appear` (tiles on screen at open rise in 50 ms apart; tiles below the fold reveal as they scroll in), `Parallax`, `CountUp` (replays on every screen focus, ~1.15 s), `FillBar`, `Ring`. Built on `Animated` with the native driver, so it ships over the air; no Reanimated or haptics (see Known Limitations). Reduce Motion turns movement off. Ads are never wrapped in these.
- **Glass**: CSS `backdrop-filter` on the web, `expo-blur` on iOS, and a solid fill on Android and with Reduce Transparency.
- **Wired in so far**: the member tab bar (`MainTabNavigator` uses `BentoTabBar` and `bentoTabScreenOptions`, replacing `FloatingTabBar`), the app-wide `AppAlertHost`, `GolfSheet` (now a `BentoSheet`), and Home (Phase 2: `screens/home/HomeScreen.tsx` on `BentoScreen`, with `BentoAvatar` and `BentoBarChart`; it also calls `api.golfHome()` on focus for the Resume round tile), and the scan flow (Phase 3: `ScanReceiptScreen`, `ReviewReceiptScreen`, `ReceiptSuccessScreen`, `ReceiptHistoryScreen`; same API calls and navigation, the receipt photo opens in a `BentoSheet`), and Rewards (Phase 4: `RewardsShopScreen` with the redeem confirmation as a `BentoSheet`, `VoucherScreen`, `RewardsActivityScreen` with an on-device All / Earned / Redeemed filter; `RewardCard` stays for the super-admin catalogue screen), and the golf screens (Phase 5: `CourseHomeScreen` and `RoundDetailScreen` rebuilt on Bento components; `RoundSetupScreen`, `CourseGuideScreen`, `MyGolfScreen` and `components/golf/Scorecard` re-skinned in place through `components/bento/legacy.tsx`, which supplies `bentoAsThemeColors` (old colour names → Bento tokens), `systemFonts` (Poppins → the system font at the same weight), `bentoTileStyle` / `bentoHeroStyle` (the double bezel on one view, using spread box shadows) and a `PillButton` stand-in). Course home also reads `api.golfStats('year')` for its Your game tile. Phase 6 (profile and support): `MemberProfileScreen` rebuilt on Bento components (password, delete-account and club picker as `BentoSheet`s); the shared `ScreenHeader`, `PillButton` (member branch) and `TextField` (`onLight`, member branch) now draw the Bento header, button and field, and the other profile screens and `FaqAccordion` go through the legacy bridge. `AppAlertHost` and `BentoSheet` mount their `Modal` only while showing, so on the web a later alert draws above an open sheet. `AdSpace` draws a "SPONSORED" label above real ads. The admin consoles keep their own alert host and theme. Phase 7 (sign-in screens): `LandingScreen` rebuilt on Bento components and no longer wrapped in `AdminThemeScope`; `LoginScreen`, `SignUpStep1Screen`, `SignUpStep2Screen` and `ForgotPasswordScreen` go through the legacy bridge with `components/bento/AuthBackdrop.tsx` (the ground with a club photo fading in at the top, or the contour lines when no photo is passed). `SelectField` and `DateField` (`onLight`) now draw the Bento field. Same auth calls, validation and navigation. Phase 8 (polish): count-ups, photo parallax and the list above; the root stack's `Main` screen and the start-up spinner use the Bento ground (`contentStyle`), so the tab cross-fade never shows the navigation default light grey in dark mode; `TextField`, `SelectField`, `DateField` and the round-sheet text (`sheetText`) go through `systemFonts`, so member fields use the system font (admin fields still override it); `systemFonts` takes an opt-in `minFontSize`, set to 12 on the profile and support screens to lift 9–10 pt legacy text (the hole view and My Golf keep their small map and chart labels).
- **Dev gallery**: `mobile/src/dev/BentoGallery.tsx`, shown only in a dev web build with `?bento`, `?bento=light` or `?bento=dark` in the URL (`App.tsx`, guarded by `__DEV__`; not in exported builds).

## Admin console theme ("Liquid Glass")

- The course-admin, staff, super-admin and support-agent stacks, and the admin sign-in screens, render inside `AdminThemeScope` (`mobile/src/context/ThemeContext.tsx`). It re-provides `ThemeContext` with the admin palette's neutrals (so existing `useThemeColors()` calls pick them up) and adds the full palette through `useAdminTheme()`. Shared components (`PillButton`, `TextField`, `SelectField`, `DateField`, `AdMediaField`, `ThemeToggleRow`, `BarChart`) switch to the admin look only when `useOptionalAdminTheme()` returns a value, so member screens are unchanged.
- Tokens: `mobile/src/theme/admin.ts` (`adminDark` / `adminLight`, `adminRadius`, `adminFont` with the system font for interface text and Fraunces for titles, `tabularNums`). Fraunces 800 italic is loaded for the lime second line (`fontsToLoad` in `theme/typography.ts`).
- Kit: `mobile/src/components/admin/ui` (`Glass`, `Tile`, `AdminButton`, `Segmented`, `StatusPill`, `Banner`, `EmptyState`, `ErrorState`, `SkeletonRows`, `AdminBackdrop`, …). `Glass` blurs with `backdrop-filter` on the web and `expo-blur` on iOS, and is a solid fill on Android or when Reduce Transparency is on.
- Admin screens are transparent. The admin navigators paint the blurred photo once per stack screen through `screenLayout` (`adminScreenLayout` in `components/admin/AdminScope.tsx`). Tab scenes share one backdrop, so unfocused tabs are hidden (`tabSceneStyle`).
- Alerts: `AdminAlertHost` (mounted by `AdminThemeScope`) registers with `utils/alertStore.ts`; while one is mounted, the app-wide `AppAlertHost` stands aside. Its Modal mounts only while an alert is showing, so on the web it draws above any sheet already open (password, fraud reason, gift Flagrr Cash).
- The super admin dashboard report (`getSuperAdminDashboardReport` in `api/_lib/adminReports.ts`) also returns each top reward's `imageUrl` and `courseName`; the course-admin report doesn't.
- Desktop search: `components/admin/desktop/CommandPalette.tsx`, opened by ⌘K / Ctrl K or the toolbar pill. Member results come from the existing `searchMembers` (course admin) and `searchSuperAdminMembers` (super admin) calls; no new endpoint.

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
| `api/activity/index.ts` | Earn/redeem ledger (last 100); each row has `voucherId` and `receiptId` (null when not linked) |
| `api/notifications/index.ts` | In-app notifications, `?action=read`; each has `enquiryId` and `supportTicketId` (null when not linked) |
| `api/receipts/index.ts` | List, `?action=scan` (preview), POST (confirm), `?action=image` |
| `api/profile/index.ts` | Avatar upload (default), plus actions: `update`, `changeClub`, `contact`, `feedbackCreate`, `enquiryReply`, `myEnquiries`, `enquiryThread`, `adClick`, `adImpression`, `registerPushToken`, `themePreference`, `notificationPreferences`, `updateNotificationPreferences`, `changePassword`, `deleteAccount`, `exportMyData`, `referralInfo`, `myFeedback`, `feedbackThread` |
| `api/courses/index.ts` | Public club list (GET), `?action=initiateSignup`, `?action=payfastNotify`, `?action=payfastGracePeriodCheck`, and the member Course / My Golf actions in `api/_lib/golf.ts`: `golfHome`, `golfCourse`, `golfProfile` (GET and POST), `golfRoundStart`, `golfRound`, `golfRoundSave`, `golfRoundFinish`, `golfRoundDelete`, `golfStats` |
| `api/admin/index.ts` | Every admin, staff, support-agent and super-admin action (about 4,400 lines), dispatched by `?action=`. Course map actions live in `api/_lib/golfAdmin.ts`: course admin `courseMapStatus`, `scorecardPhoto`, `scorecardPhotoUpload`, `scorecardPhotoDelete`; super admin `superAdminGolfCourses`, `superAdminGolfCourse`, `superAdminScorecardPhotos`, `superAdminScorecardPhoto`, `superAdminGolfCourseImport`, `superAdminGolfCoursePublish`, `superAdminGolfCourseDelete`. The admin Golf pages live in `api/_lib/golfClub.ts` (read-only, GET): course admin `golfOverview`, `golfMember` (`userId`), `golfScorecard` (`id`); super admin `superAdminGolf`, `superAdminGolfClub` (`courseId`), `superAdminGolfMember`, `superAdminGolfScorecard`. They count completed rounds on a club's own course map by members of that club whose `golf_profiles.share_with_club` is not false; staff are refused |

**New backend capability must go into an existing file via `?action=` dispatch**, unless a function is retired to make room.

Shared logic that is not a route lives in `api/_lib/`: `db`, `auth`, `http`, `email`, `emailTemplate`, `welcomeEmail`, `passwordReset`, `ocr`, `receiptParser`, `receiptExtraction`, `claudeReceipt`, `scanPipeline`, `scanCache`, `matching`, `pointsEngine`, `fraudChecks`, `imageHash`, `tiers`, `tierRewards`, `streak`, `streakRewards`, `quarter`, `periods`, `monthly`, `referrals`, `ads`, `adAnalytics`, `pushNotifications`, `payfast`, `memberRoster`, `memberRosterFileParsing`, `xlsx`, `enquiries`, `supportTickets`, `adminNotifications`, `adminReports`, `auditLog`, `giftFlagrrCash`, `golf`, `golfAdmin`, `golfClub`.

**Shared with the app:** the golf scoring and stats code lives in `mobile/src/golf/` (`courseMap.ts` the map file format and its checks, `scoring.ts` the World Handicap System handicaps, strokes and Stableford, `stats.ts` My Golf, `clubStats.ts` a club's Golf page (built on `stats.ts`), `holeGeometry.ts` the hole view and shot suggestion, `dto.ts` / `adminDto.ts` the response shapes). It has no React Native imports, and `api/_lib/golf.ts`, `golfAdmin.ts` and `golfClub.ts` import it directly, so the totals the API stores always match what the member saw.

The member app has Playwright click-through tests in `mobile/e2e/` (`npm run e2e` in `mobile/`): they run the web export against a sample-data mock of the API (`e2e/mock-api/server.ts`, which reuses the app's own golf scoring and stats code) and walk the flows listed in [Member App Functionality Inventory](Member-App-Functionality-Inventory). See [Environment and Setup](Environment-and-Setup) for how to run them. The tests have their own `e2e/tsconfig.json`; the app's `tsconfig.json` excludes them. 545 tests, 503 run on the web build (24 Nov 2026); the rest are native-only skips or known differences marked `test.fixme`.

Unit tests (`npm test`, which runs `tsx --test api/_lib/*.test.ts`) cover `matching`, `pointsEngine`, `receiptParser` and the golf scoring, stats, club Golf numbers and map checks (`golfScoring.test.ts`).

## Authentication and roles

- **Tokens**: opaque UUID bearer tokens stored in the database, valid for 30 days (`sessions.expires_at` and `admin_sessions.expires_at` default to `now() + interval '30 days'`). `super_admin` and `support_agent` sessions are created with a 12-hour expiry that each request pushes out again (written at most once an hour), and are refused once 7 days old (`createAdminSession` / `getAuthedAdmin` in `api/_lib/auth.ts`).
- **Ending sessions**: a member password reset deletes all that member's sessions; a member or admin changing their own password deletes every other session for the account; admin password resets (self-service or by another admin) and revoking an admin, support agent or staff account delete all of that account's sessions (`endAdminSessions`).
- **Members**: `users` / `sessions`, checked in `api/_lib/auth.ts`.
- **Admins**: a separate identity in `admins` / `admin_sessions`. A request is rejected if the account is not activated, is revoked, or its club's subscription is `canceled` (403).
- **Roles**:
  - `super_admin`: no course, sees every club.
  - `support_agent`: no course, support inbox only.
  - `course_admin`: one club, up to 2 active per club.
  - `staff`: one club, voucher redemption and support tickets only. Staff log in with a username, because several can share one email address.
- Per-role action allow-lists are in `api/admin/index.ts` (`STAFF_ALLOWED_ACTIONS`, `SUPPORT_AGENT_ALLOWED_ACTIONS`, and the super-admin set).
- Passwords are hashed with bcrypt (`bcryptjs`, cost 10). Admin accounts created by another admin start with a temporary password and `must_change_password`. Password resets use a 6-digit emailed code valid for 30 minutes (`api/_lib/passwordReset.ts`). Requests and wrong codes are rate-limited per email/username and per IP address and recorded in `password_reset_events` (`api/_lib/resetThrottle.ts` holds the limits); a block returns HTTP 429 with a message pointing to Flagrr support. Each event also writes one `[password-reset]` log line with the event, account id (if any), IP address and user agent, never the email address.
- **Sign-in lockout** (`api/_lib/loginThrottle.ts` for the limits, `api/_lib/loginGuard.ts` for the database side), for `api/auth/login` and `api/admin?action=login`: 10 wrong passwords per email/username in 15 minutes (counted since the account's last successful sign-in or completed password reset, if later) or 30 per IP address in 15 minutes returns HTTP 429 without checking the password. Every attempt is stored in `login_events` and logged as one `[login]` line. A sign-in for an email with no account still runs a bcrypt check, so response time doesn't reveal which emails are registered. If migration `051` is missing, sign-in is allowed and an error is logged rather than failing. In front of this, a Vercel Firewall rule allows 10 sign-in and password-reset requests per IP per minute (see [Environment and Setup](Environment-and-Setup)).
- **Forced password change**: an admin with `must_change_password` gets 403 on every action except `me`, `changePassword`, `logout` and `themePreference` (`api/admin/index.ts`).

## Database

Full schema: `db/schema.sql`. Migrations are `db/migrations/001`–`053`, applied by hand in the Neon console. There is no migration runner or tracking table.

**Important:** `db/schema.sql` is behind the migrations and cannot rebuild the current database on its own (see [Known Limitations](Known-Limitations-and-Future-Work)). Treat the migrations, applied in order, as the source of truth.

Main groups of tables (some are created only by migrations):

- **Members**: `users`, `sessions`, `points_accounts`, `user_stats`, `streaks`, `monthly_points`, `push_tokens`, notification preferences.
- **Clubs and billing**: `courses` (includes `fb_per_rand`, PayFast token, subscription status, next billing date, past-due tracking), `pending_club_signups`, `member_roster` entries, `is_placeholder` club.
- **Admins**: `admins`, `admin_sessions`, `password_reset_codes`, `admin_notifications`, `admin_broadcasts`, `audit_log`.
- **Sign-in audit** (`051`): `login_events` (members and admins: `login_succeeded`, `login_failed` or `login_blocked`, SHA-256 hash of the email/username typed, matched `user_id` or `admin_id`, IP address, user agent, time). Used for the sign-in lockout and to trace where sign-ins came from.
- **Password-reset audit** (`050`): `password_reset_events` (members and admins: event, SHA-256 hash of the email/username typed, matched `user_id` or `admin_id`, IP address, user agent, time). Used for the reset limits and to trace who requested a reset.
- **Catalogue and vouchers**: `rewards`, `reward_variants`, `vouchers` (code format `FLGR-XXXX-XXXX`, 90-day expiry), `merchants`, `golf_products`, `golf_activities`.
- **Receipts**: `receipts`, `receipt_items`, `receipt_scan_cache`, duplicate-attempt records.
- **Earning**: `activity` (`receipt_id`, from `052`, links a "Receipt scanned" row to its receipt; set by the member's scan and by an admin approving a flagged receipt; null for every other row and for rows written before it), ledgers `birthday_rewards_granted`, `quarterly_tier_vouchers_granted`, `streak_rewards_granted`, `referrals`.
- **Ads**: `ads`, `ad_courses`, `ad_clicks`, `ad_impressions`.
- **Support**: `enquiries`, `enquiry_messages`, support tickets.
- **Course Guide and My Golf** (`048`): `golf_courses` (one course map per row, `club_id` linking it to a Flagrr club or null for an away-only course, `status` draft or live, the whole map file in `map` jsonb), `scorecard_photos`, `golf_profiles` (Handicap Index as entered, rating gender, format, allowance, bag, putts-and-fairways setting, and `share_with_club` from `049`, default true), `golf_rounds` (a snapshot of holes, ratings and handicaps, the per-hole `entries`, and totals recomputed on every save; one in progress per member, enforced by a partial unique index; `049` adds an index on course and completion date for the admin Golf pages).

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

- **My Feedback (API only so far, 24 Nov 2026)**: `api/profile?action=myFeedback` lists the member's own Give Feedback tickets (`support_tickets` with `requester_type = 'member'`), newest activity first, with the last message and whether a reply is unread; `?action=feedbackThread&id=` returns one thread and marks the team's replies read. Read only: members cannot reply in the thread. When an agent replies (`supportAgentReply`), `notifyMemberOfAgentReply` (`api/_lib/supportTickets.ts`) adds a notification with `support_ticket_id` (migration `053`) and sends a `supportReplies` push. The member screens are drawn for the owner's approval before they are built; until then the app shows the notification but has nowhere to open it.
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
| `EXPO_PUBLIC_E2E` | Mobile build | `1` only in `npm run e2e:build` (click-through tests): screen pushes, tab switches and tile entrances happen at once. Never set for real builds |
| `SITE_URL` | Marketing site | Public https URL of the marketing site. Club signup returns 501 unless it is https |
| `FLAGRR_APP_URL` | Marketing site | Backend base URL used by club signup. Defaults to `https://flagrr-loyalty.vercel.app` |

The marketing site also has optional analytics variables, listed in its `.env.example`.
