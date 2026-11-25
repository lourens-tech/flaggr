# Member App Functionality Inventory

_Read from the code on 2026-11-24 (branch `claude/member-store-build`, Expo SDK 58). Built from code reading only: items marked "unverified" need a device or a running app to confirm._

Everything a member can see and do in the app today, screen by screen: where each screen is reached from, what it shows and where the data comes from, every control and what it does, every state (loading, empty, error, offline, permission), every alert with its exact wording, every validation rule and server call, and which design boards cover it.

**Why it exists.** The owner's rule for the exact-match Bento store build is that no functionality may be lost. Before any phase of that work is committed, every item on this page that the phase touches is checked in the app. If a design board leaves something out, the feature stays and is drawn in the board's style (owner decision, 24 Nov 2026). The "Not on any board" list under each area is the list of things still to be designed.

**Keep it current.** When a change adds, removes or alters what a member can see or do, update the matching entry here in the same commit (see `CLAUDE.md`). The admin consoles are not covered; see [Admin Console Features](Admin-Console-Features).

## Contents

1. [Sign-in, Home, Notifications, Member Tiers and app-wide behaviour](#a-sign-in-home-notifications-member-tiers-and-app-wide-behaviour)
2. [Receipt scan flow](#b-receipt-scan-flow)
3. [Rewards, Voucher and Reward Activity](#c-rewards-voucher-and-reward-activity)
4. [Golf](#d-golf)
5. [Profile and support](#e-profile-and-support)

## A. Sign-in, Home, Notifications, Member Tiers and app-wide behaviour
Source: `mobile/src` (branch `claude/member-store-build`, working tree as of 2026-11-24), plus `mobile/App.tsx`, `mobile/app.json`, `mobile/eas.json` and the server handlers the screens call (`api/auth/login.ts`, `api/auth/signup.ts`, `api/courses/index.ts`, `api/_lib/loginThrottle.ts`, `api/_lib/resetThrottle.ts`, `api/_lib/passwordReset.ts`). Read-only; nothing in the repo was changed.

Board files checked: `AppLandingLight/Dark`, `AppLoginLight`, `AppSignUpLight`, `AppSignUpFull`, `AppSignUp2Light`, `AppForgotLight`, `AppHomeLight/Dark/Full`, `AppHomeUnverifiedLight`, `AppNotificationsLight`, `AppTiersLight`, `AdSpec`, `DlgNotListedLight`, `ProtoLight` (explorer list and state machine). `canvas.json` also lists Dark variants of Login, Sign up 1 and 2, Reset password, Notifications, Tiers, Home unverified and DlgNotListed, but those files are not in the local copy. I assume they are colour variants of the Light boards; I did not check them.

Conventions: "copy" is quoted exactly, including curly apostrophes (’) where the code uses them. `t.*` means a Bento theme token. "Board" means a design board on the Bento canvas.

---

### Screen count and route map (my area)

| # | Screen | Route | Navigator |
|---|---|---|---|
| 1 | Landing | `Landing` | AuthNavigator (initial route) |
| 2 | Login | `Login` | AuthNavigator |
| 3 | Sign up step 1 | `SignUpStep1` | AuthNavigator |
| 4 | Sign up step 2 | `SignUpStep2` (params: firstName, lastName, email, phone, dateOfBirth, courseId, referralCode?) | AuthNavigator |
| 5 | Forgot / reset password (two steps inside one screen) | `ForgotPassword` | AuthNavigator |
| 6 | Home | `Main > Home` tab | MainTabNavigator |
| 7 | Notifications | `Notifications` | RootNavigator member stack |
| 8 | Member Tiers | `MemberTiers` | RootNavigator member stack |

Plus app-wide surfaces: the font splash, the session-restore spinner, the tab bar, the alert host, the toast host, the ad slot, the push handling, the theme and the build flags.

---

#### 1. Landing (`screens/onboarding/LandingScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** **Terms of Use** and **Privacy Notice** in the legal line are links to `TermsPrivacy` (`section` 'terms' / 'privacy') in the signed-out stack (owner decision). The web-only Golf Course Admin Login link is 13 pt on its own row with a 44 pt padded target (hitSlop does nothing on web). Shared sign-in parts live in `screens/onboarding/authParts.tsx`. Everything else below is unchanged.

- **Reached from:**
  - Cold start with no stored member token and no admin session: this is the AuthNavigator's first route.
  - Logging out from Profile ("Log Out" row): the root stack swaps to `Auth`, which opens on Landing.
  - Deleting the account (Profile, then `deleteAccount`, which calls `logout()`).
  - A failed session restore at startup (expired token, *or no network*; see App-wide > Session).
  - Back gesture or back chevron from Login or Sign up step 1 when they were opened from Landing.
- **Shows:**
  - Background `AuthBackdrop`: the club photo `strand-golf-club-fairway.jpg`, 560 pt tall, over the ground colour. It has a gradient from `rgba(10,24,17,0.35)` at the top to transparent, then fades into `t.ground`.
  - Status bar: light content.
  - Flagrr logo in white, size 48, centred at the top.
  - A flexible spacer (min 200 pt) that pushes the content to the bottom. The whole screen sits in a ScrollView, so it scrolls on short screens.
  - Headline in Fraunces 700, 52/52, one word per line: "Play." / "Earn." / "Redeem." / "Repeat.". "Repeat." is in the accent colour. Accessibility: a single header element labelled "Play. Earn. Redeem. Repeat.". It is wrapped in `Appear`, so it rises in.
  - Legal line (13 pt, muted): "By continuing, you're accepting our **Terms of Use** and **Privacy Notice**". The two names are bold ink but are **not tappable** in code.
- **Actions:**

| Control | What it does | When available |
|---|---|---|
| "Get Started" (primary BentoButton with arrow nub) | `navigate('SignUpStep1')` | Always |
| "I already have an account" (secondary BentoButton) | `navigate('Login')` | Always |
| "Golf Course Admin Login" (text link, 14 pt muted 600) | `navigate('AdminLogin')`, the admin login (out of scope here) | **Only when `IS_STORE_BUILD` is false**: the web deploy and development builds. Hidden in EAS `preview` and `production` builds. |
| "Terms of Use" / "Privacy Notice" | Nothing (plain text) | — |

- **States:**
  - Store build: the admin link is hidden. Web build: it is shown.
  - Light/dark: ground, ink, muted and accent tokens follow the theme. The photo and logo stay the same.
  - Reduce Motion: `Appear` renders statically, with no rise.
  - No loading, error or empty states.
- **Alerts, sheets, toasts:** none.
- **Validation:** none.
- **Server calls:** none.
- **Board coverage:** AppLandingLight and AppLandingDark show the full screen, including the admin link and the legal line. On the boards, Terms of Use and Privacy Notice are drawn as links. The prototype explorer has "Landing".
  - **Not on a board:** the store-build variant without the admin link. The scroll behaviour on short screens. (The board's link styling for Terms and Privacy has no behaviour in code. The redesign must decide whether they become real links, for example to `TermsPrivacy`, which is only reachable when signed in today.)

---

#### 2. Login (`screens/onboarding/LoginScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** Bento layout per the kept boards: dark glass Back, labelled fields (the field icons and the wordmark are gone, as on the boards), the password eye, keep-me-logged-in as a checkbox. The screen scrolls and avoids the keyboard on iOS. Technical server errors (500 and the like) show "Something went wrong on our side. Please try again."; 401, 429 and 400 texts are unchanged. Shared sign-in parts live in `screens/onboarding/authParts.tsx`. Everything else below is unchanged.

- **Reached from:**
  - Landing: "I already have an account".
  - Sign up step 1: "Already have an account? Login!".
  - Forgot password: the OK button in the "Password reset" success alert (`navigate('Login')`, which returns to the existing Login in the stack).
  - Back gesture or chevron from Forgot password.
- **Shows:**
  - The same `AuthBackdrop` photo (fairway), 280 pt tall. Status bar light content.
  - Glass back button at top-left: a 42 pt circle, `rgba(10,24,17,0.45)` fill, white chevron.
  - Flagrr logo, size 72, centred.
  - Title "Welcome back": Fraunces 34, header role, 110 pt below the logo.
  - Email field: mail icon, placeholder "Email", no auto-capitalise, email keyboard, return key "next". Return does **not** move focus to the password field (there is no handler).
  - Password field: lock icon, placeholder "Password", hidden by default. It has an eye toggle with accessibility labels "Show password" / "Hide password". Return key "done" submits the login.
  - Keep-me-logged-in row: a check-circle icon (filled `checkmark-circle` in club green when on, `ellipse-outline` in muted when off) and the text "Keep me logged in.". **Defaults to on.**
  - Primary button "Login" with an arrow icon.
  - Link row: "Forgot Password? **Recover here.**" ("Recover here." in club green).
  - Bottom row, pinned with `marginTop: auto`: "Don't have an account?" over "**Sign Up!**" in green.
- **Actions:**

| Control | What it does | When available |
|---|---|---|
| Back chevron | `navigation.goBack()` | Always |
| Email / Password fields | Typing clears that field's error | Always |
| Eye icon | Toggles password visibility | Always |
| "Keep me logged in." row | Toggles `keepLoggedIn` | Always |
| "Login" button | Validates, then `login(email.trim(), password, keepLoggedIn)` | Disabled (45% opacity) while email **or** password is empty. Shows a spinner and is disabled while submitting. |
| Password return key | Same as "Login" (runs validation even when empty) | Always |
| "Forgot Password? Recover here." | `navigate('ForgotPassword')` | Always |
| "Don't have an account? Sign Up!" | `navigate('SignUpStep1')` | Always |

- **States:**
  - Submitting: the button spinner (PillButton `loading`), busy state for accessibility.
  - Success: no explicit navigation. `AppContext.login` sets `isAuthenticated`, the RootNavigator swaps the whole stack to `Main` (Home tab), and the Auth stack unmounts, so there is no way back.
  - The push permission prompt can appear right after a successful login (see Push).
  - **Keep-me-logged-in off:** the token is kept in memory only (`setToken(token, false)`). Killing the app, or reloading the web tab, returns the user to Landing.
  - **No KeyboardAvoidingView and no ScrollView:** on short phones the keyboard can cover the button. The redesign should not copy this limitation, but must keep the same fields.
  - Light/dark through the Bento tokens. Store and web builds are identical.
- **Alerts:**
  - Login fails: title "Couldn’t log in". Message: the server's message when it is an `ApiError`, otherwise "Something went wrong. Please try again." (for example, no network). Single "OK" button that only dismisses.
  - Known server messages:
    - "Invalid email or password" (401).
    - "Too many sign-in attempts. Try again in 15 minutes, or reset your password." (429).
    - "email and password are required" (400).
    - "Method not allowed" (405).
    - Generic fallback "Request to /auth/login failed".
  - Edge case: if `/auth/login` succeeds but the follow-up data load (`loadAll`) fails, the same "Couldn’t log in" alert shows. The token has already been stored (when keep-me-logged-in is on), so the next cold start restores the session.
- **Validation (on submit):**

| Field | Rule | Message (under the field, red) |
|---|---|---|
| Email | Empty after trim | "Email is required" |
| Email | Fails `^[^\s@]+@[^\s@]+\.[^\s@]+$` | "Enter a valid email address" |
| Password | Empty | "Password is required" |

  - Errors clear as the user types in that field.
- **Server calls:**
  - `POST /api/auth/login` `{email, password}`, without auth. On success, the token is stored (AsyncStorage key `flagrr_auth_token`, or memory only), then `loadAll()` runs:
    - `GET /me?period=year`, `/rewards`, `/vouchers`, `/activity`, `/receipts` and `/notifications`, in parallel.
    - Then the account theme is applied and push registration starts.
  - Errors produce the alert above.
- **Board coverage:** AppLoginLight (and Dark, per canvas.json) show the default filled form: back, logo, "Welcome back", Email, Password with eye, "Keep me logged in.", Login, "Recover here.", "Don't have an account? Sign Up!". The board text has no "Forgot Password?" prefix. The prototype has "Login" and a "Sign up / log in" flow.
  - **Not on a board:**
    - Inline field errors ("Email is required", "Enter a valid email address", "Password is required").
    - The disabled button.
    - The loading button.
    - The "Couldn’t log in" alert with its server messages, including the 429 throttle message.
    - The keep-me-logged-in **off** state.
    - The keyboard-open layout.

---

#### 3. Sign up step 1 (`screens/onboarding/SignUpStep1Screen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** Labelled fields (no wordmark or field icons). Golf Club opens a `PickerSheet` (radio rows, server order kept). A failed club list shows `LoadError` ("Couldn’t load this", `friendlyError` body) with **Try again**, and the Golf Club field is disabled meanwhile (owner decision: no silent failures). Date of Birth keeps `DateField`. Shared sign-in parts live in `screens/onboarding/authParts.tsx`. Everything else below is unchanged.

- **Reached from:** Landing "Get Started"; Login "Sign Up!"; back from step 2.
- **Shows:**
  - `AuthBackdrop` (fairway photo, 280 pt), back chevron, logo (72).
  - Progress bar: two segments, the first club green and the second track grey (hidden from accessibility).
  - Eyebrow "Step 1 of 2" (12 pt, uppercase, letter-spaced, muted).
  - Title "Create your account" (Fraunces 34, header).
  - Form, inside KeyboardAvoidingView (iOS padding) and ScrollView, with taps persisting:
    1. "Full Name": person icon, return "next".
    2. "Email": mail icon, email keyboard, no auto-capitalise.
    3. "Phone Number": call icon, phone keypad, **optional, no validation**.
    4. "Date of Birth": `DateField` with a calendar icon. It shows the chosen date as e.g. "Jan 1, 2000" (`en-US`, short month). Maximum date is today; there is no minimum age.
       - iOS: a fade modal with an inline calendar and a "Done" button. Tapping the backdrop closes it.
       - Android: the native calendar dialog. Cancel keeps the old value.
       - Web: the browser's `<input type="date">` with `max` = today.
       - The picker opens on 1 Jan 2000 when the field is empty.
    5. Golf club `SelectField`. Placeholder "Loading golf clubs…" (disabled) while loading, then "Golf Club". Tapping opens a bottom sheet (fade modal, 60% max height) titled with the placeholder text ("Golf Club"). It lists every club from `/courses` by name, with a checkmark on the selected one. Tapping a row selects it and closes the sheet; tapping the backdrop closes it. Order comes from the server: real clubs A–Z, then the placeholder club "My Club Isn't Listed Yet" last (`order by is_placeholder, name`).
    6. "Referral Code (optional)": gift icon, auto-capitalise characters, return "done".
  - "Next Step" button (arrow icon).
  - "Already have an account?" / "**Login!**" row at the bottom of the scroll.
- **Actions:**

| Control | What it does | When |
|---|---|---|
| Back chevron | `goBack()` | Always |
| Date field | Opens the platform date picker | Always |
| Golf Club field | Opens the club sheet | Disabled while the club list loads |
| "Next Step" | Validates, then `navigate('SignUpStep2', {firstName, lastName, email, phone, dateOfBirth, courseId, referralCode})`. Name split: first word becomes firstName, the rest (joined by spaces, may be empty) becomes lastName. Email and referral are trimmed; an empty referral is sent as undefined. | Never disabled |
| "Already have an account? Login!" | `navigate('Login')` | Always |

- **States:**
  - Clubs loading: the select is disabled and reads "Loading golf clubs…".
  - **Club list failed to load:** the list silently becomes empty. The field reads "Golf Club" and opens an empty sheet. There is no error message and no retry, so the user cannot proceed and sees "Select your golf club" on Next.
  - No-club-listed path: picking "My Club Isn't Listed Yet" is allowed. It leads to the placeholder-club experience after sign-up (Home popup, empty Rewards).
  - Keyboard open: content scrolls (KeyboardAvoidingView on iOS only).
  - Light/dark tokens. Store and web are the same; web uses the native date input.
- **Alerts:** none on this step.
- **Validation (on Next):**

| Field | Rule | Message |
|---|---|---|
| Full Name | Empty after trim | "Full name is required" |
| Email | Empty after trim | "Email is required" |
| Email | Fails the email regex | "Enter a valid email address" |
| Date of Birth | Not set | "Date of birth is required" |
| Golf Club | Not set | "Select your golf club" (separate red line under the select) |
| Phone, Referral | None | — |

  - Each error clears when its field changes.
- **Server calls:** `GET /api/courses` (no auth) on mount. Success sets the list; failure gives an empty list. Either way the loading flag clears.
- **Board coverage:** AppSignUpLight and AppSignUpFull (and Dark) show the eyebrow, title, Full Name, Email, Phone Number, Date of Birth, Referral Code (optional), Next Step and "Already have an account? Login!". Board placeholders differ: "e.g. 082 123 4567", "DD / MM / YYYY", "Have a code from a mate?". The prototype has "Sign up · step 1". DlgChooseClub is the Profile change-club picker, not this one.
  - **Not on a board:**
    - **The Golf Club picker field itself (missing from every sign-up board).**
    - Its loading placeholder "Loading golf clubs…".
    - The club sheet.
    - The "My Club Isn't Listed Yet" option.
    - The failed or empty club list.
    - The date picker (iOS modal with "Done", Android dialog, web input).
    - All five inline validation errors.
    - The two-segment progress bar (unverified whether the board draws it; the text shows only "Step 1 of 2").

---

#### 4. Sign up step 2 (`screens/onboarding/SignUpStep2Screen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** Labelled fields; a legal line under Sign Up with Terms of Use and Privacy Notice links (owner decision: links for signed-out people on Sign up); coming back keeps the form. Shared sign-in parts live in `screens/onboarding/authParts.tsx`. Everything else below is unchanged.

- **Reached from:** Sign up step 1 "Next Step" only, with route params.
- **Shows:**
  - `AuthBackdrop` with the **tee photo** (`strand-golf-club-tee.jpg`), back chevron, logo (72).
  - Progress bar with both segments green. Eyebrow "Step 2 of 2". Title "Set a password".
  - Form (KeyboardAvoidingView on iOS; **no ScrollView**):
    - "Email": prefilled from step 1 and editable.
    - "Password": lock icon, eye toggle.
    - Hint "At least 8 characters". Shown only while there is no password error; replaced by the error when there is one.
    - "Confirm Password": eye toggle, return "done" submits.
  - "Sign Up" button (arrow icon).
  - No "Already have an account?" link on this step.
- **Actions:**

| Control | What it does | When |
|---|---|---|
| Back chevron | `goBack()` to step 1, whose field values are kept (it stays mounted) | Always |
| "Sign Up" / Confirm return key | Validates, then `signup({firstName, lastName, email (trimmed, from this screen), phone or undefined, dateOfBirth, courseId, referralCode, password})` | Spinner while submitting; otherwise never disabled |

- **States:**
  - Submitting spinner.
  - Success: `isAuthenticated` flips and the root stack swaps to `Main`, landing on the Home tab.
  - Push permission prompt (see Push).
  - The placeholder-club popup on first Home open (see Home).
  - The sign-up token is always persisted; there is no keep-me-logged-in choice at sign-up.
- **Alerts:**
  - Sign-up fails: title "Couldn’t create your account". Message: server message or "Something went wrong. Please try again.". "OK" only.
  - Known server messages:
    - "An account with this email already exists" (409).
    - "Password must be at least 8 characters".
    - "Unknown course".
    - "firstName, email, courseId, and password are required".
  - An invalid or expired referral code is **silently ignored** server-side (the sign-up still succeeds with no message).
- **Validation (on submit):**

| Field | Rule | Message |
|---|---|---|
| Email | Empty | "Email is required" |
| Email | Fails the regex | "Enter a valid email address" |
| Password | Under 8 characters | "Password must be at least 8 characters" |
| Confirm | Differs from Password (checked only when the password itself is valid) | "Passwords do not match" |

  - Typing in Password clears both the password and confirm errors.
- **Server calls:** `POST /api/auth/signup` (no auth). Then the token is stored and `loadAll()` runs, then push registration. Server side, the referral bonus is granted if the code is valid and the welcome email is sent (not visible in the app).
- **Board coverage:** AppSignUp2Light (and Dark) show the eyebrow, title, Email, Password with eye, the text "Password must be at least 8 characters", Confirm Password with eye, and Sign Up. The prototype has "Sign up · step 2".
  - **Not on a board:**
    - The neutral hint "At least 8 characters". The board text reads like the error string; whether the board draws it as a hint or an error is unverified.
    - "Email is required" / "Enter a valid email address" / "Passwords do not match".
    - The loading button.
    - The "Couldn’t create your account" alert, including "An account with this email already exists".
    - The keyboard-open layout.

---

#### 5. Forgot / reset password (`screens/onboarding/ForgotPasswordScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** Labelled fields. **Send it again** shows a "Code sent" / "Check your email for the new code." toast on success (owner-approved copy); the first Send Code shows none; a failed resend keeps the "Couldn’t send code" alert. Update Password keeps the arrow nub (the board's check icon needs a shared button change). Shared sign-in parts live in `screens/onboarding/authParts.tsx`. Everything else below is unchanged.

One screen with two internal steps, `request` and `reset`.

- **Reached from:** Login, "Forgot Password? Recover here." only.
- **Shows (both steps):**
  - `AuthBackdrop` with **no photo**: only the contour lines on the ground colour.
  - Back chevron.
  - Flagrr logo (72): white in dark mode, dark green in light mode.
  - Title "Reset Password" (Fraunces 34).
- **Step "request" shows:**
  - Helper text: "Enter the email address on your account and we'll send you a code to reset your password."
  - "Email" field (return "done" submits).
  - "Send Code" button (arrow icon).
- **Step "reset" shows:**
  - Helper text: "Enter the code we sent to {email} and choose a new password." `{email}` is the untrimmed typed value.
  - "6-digit code" (keypad icon, number pad).
  - "New password" (eye).
  - "Confirm new password" (eye, return "done" submits).
  - "Update Password" button (checkmark icon).
  - "Didn't get a code? **Send it again.**"
- **Actions:**

| Control | What it does | When |
|---|---|---|
| Back chevron (request step) | `goBack()` to Login | — |
| Back chevron (reset step) | Returns to the **request** step; the email is kept | — |
| "Send Code" / email return key | Validates the email, then `api.forgotPassword(email)`; on success switches to the reset step | Disabled when email is empty; spinner while sending |
| "Update Password" / confirm return key | Validates, then `api.resetPassword(email, code, newPassword)` | Disabled until code, new and confirm are all non-empty; spinner while sending |
| "Didn't get a code? Send it again." | Calls the same request handler again (re-sends the code). Stays on the reset step and gives **no** confirmation feedback on success. | Disabled while submitting |

- **States:**
  - Submitting spinners.
  - The OS back gesture or hardware back on the reset step leaves the screen (to Login). It does not go back to the request step; only the on-screen chevron does.
  - No KeyboardAvoidingView or ScrollView.
  - Light/dark (the logo colour switches).
- **Alerts:**
  - Request step, invalid email: "Enter a valid email" / "Please enter the email address on your Flagrr account." / OK.
  - Request fails: "Couldn’t send code" / server message or "Something went wrong. Please try again." / OK.
    - Known server messages:
      - "Too many password reset attempts. Please contact Flagrr support at Swing@flagrr.com or 071 759 9553." (429).
      - "email is required".
    - The request **always succeeds** for unknown emails (no account enumeration), so the user moves to the reset step regardless.
  - Reset step, empty code: "Enter the code" / "Check your email for the 6-digit code we sent you." / OK.
  - New password under 8 characters: "Password too short" / "Your new password must be at least 8 characters." / OK.
  - Mismatch: "Passwords don’t match" / "Make sure both passwords are the same." / OK.
  - Success: "Password reset" / "Your password has been changed. You can now log in with it." / one button "OK" that runs `navigate('Login')`.
  - Reset fails: "Couldn’t reset password" / server message or the generic message / OK.
    - Known server messages:
      - "That code is invalid or has expired".
      - "Too many password reset attempts. Please contact Flagrr support at Swing@flagrr.com or 071 759 9553.".
      - "Email, code, and a new password (min. 8 characters) are required".
- **Validation:** all through alerts (above); there are no inline field errors on this screen. The code is only checked for non-empty; there is no 6-digit length check client-side.
- **Server calls:**
  - `POST /api/auth/login?action=forgotPassword` `{email}`. The server emails a code that "expires in 30 minutes" and is rate-limited per email and IP.
  - `POST /api/auth/login?action=resetPassword` `{email, code, newPassword}`. On success the server **signs the account out of every device** (deletes all sessions).
- **Board coverage:** AppForgotLight (and Dark) show only the **request** step: back, logo, "Reset Password", an extra heading "Forgot your password?" that does not exist in code, the helper text, Email and "Send Code". The prototype has "Reset password".
  - **Not on a board:**
    - **The whole reset step**: code field, New password, Confirm new password, "Update Password", "Didn't get a code? Send it again.", and the "Enter the code we sent to {email}…" helper.
    - The disabled and loading buttons.
    - All seven alerts:
      - "Enter a valid email".
      - "Couldn’t send code".
      - "Enter the code".
      - "Password too short".
      - "Passwords don’t match".
      - "Password reset" (success).
      - "Couldn’t reset password".
    - The rate-limit message.
    - The resend action's lack of feedback, which needs a design (for example, a toast).

---

#### 6. Home (`screens/home/HomeScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** small board-matching sizes (bell badge, ring text, "Play a round", tier line). A failed My Stats period switch now keeps the previous period selected and shows "Couldn’t load your stats" with `friendlyError` (was silent, with the old numbers under the new label; owner decision). No booked ad means no ad slot. Everything else below is unchanged.

- **Reached from:**
  - After login, sign-up or session restore (the first tab of `Main`).
  - The Home tab in the tab bar.
  - Android back from any other tab (default `backBehavior: firstRoute`).
  - "View Current Balance" on ReceiptSuccess and "Back to Rewards" on Voucher both `navigate('Main')`, which returns to the last active tab, not necessarily Home.
- **Layout:** `BentoScreen` with `tabBar`: ground colour, contour lines across the top, 24 pt padding, bottom clearance for the floating tab bar. Content scrolls; the scroll indicator is hidden. No title bar and no back button.
- **Shows (top to bottom):**
  1. **Header row**
     - Eyebrow date line: device-locale weekday and "day month", e.g. "Monday · 23 November" (uppercase eyebrow style).
     - H1 (36/37): "{Morning|Afternoon|Evening},\n{user.firstName}". Morning is before 12:00, Afternoon before 17:00, Evening otherwise, on the device clock. It is computed on every render and does not tick.
     - Bell `GlassIconButton`, with a **numeric** unread badge: a lime pill at top-right showing `unreadNotificationCount`, min width 20, 11 pt bold fairway text. Shown only when the count is above 0. Accessibility label "Notifications, N unread" or "Notifications".
     - Avatar (42 pt): the uploaded photo, or initials (first letters of first and last name, uppercase) in lime Fraunces on fairway. Accessibility label "Profile".
  2. **Unverified banner** (only when `user.verifiedMember === false`): warning background, info icon, "Your club hasn't verified your membership yet — you can still earn Flagrr Cash, but tier progress is on hold."
  3. **Hero grid**, two columns.
     - **Flagrr Cash hero** (left, spans two 168 pt rows, fairway "hero" tone):
       - Label "Flagrr Cash".
       - Balance with `CountUp`, localised digits. Font size 42, or 38 when the balance is 10,000 or more, or 30 when it is 100,000 or more. Accessibility label "{n} Flagrr Cash".
       - "{tier} Member" with the tier in lime.
       - Tier ring (as wide as the tile's content and centred, clamped to 96–148 pt, 9 pt stroke; owner's choice of 24 Nov 2026 to balance the tile), lime on a white 14% track, animated draw. Progress is `points.tierProgress`, or full at top tier. Inside: "{pointsToNextTier}" (localised, or compact like "123k" at 100,000 and above) over "to {nextTier}". **At top tier** (`nextTier === null`) it shows "Top tier" instead.
       - Lime "Redeem" BentoButton with nub (accessibility label "Redeem Flagrr Cash").
     - **Streak tile** (right top):
       - Flame icon and "Streak".
       - `CountUp` of `streak.weeks` with "week" or "weeks".
       - A row of 9 pt dots, one per `streak.weeksPlayed` entry: accent when played, `t.dotOff` when not.
       - "{weeksLeft} more week{s} to a {nextMilestoneAmount} FC bonus", where weeksLeft = max(0, nextMilestoneWeeks − weeks). It can read "0 more weeks…".
       - The "You've played every week since {Month YYYY}" / "Play a round this week to start your streak" sentence is **only in the accessibility label**, never visible.
     - **Round tile** (right bottom), one of two variants:
       - **Resume**, when `golfHome().inProgress` exists (hero tone):
         - White circle with an up-right arrow.
         - "Hole {n}" (next unplayed hole), or "All holes in" when every hole is entered.
         - "{points} pts thru {holesPlayed}".
         - Accessibility label "Resume round at {course}, hole {n}, {pts} points thru {thru}".
       - **Play a round** (otherwise, or if the golf call failed): flag icon, "Play a round", "Hole maps and your scorecard".
  4. **Your Club tile**: club logo (40 pt) or flag icon, "Your Club", `user.homeClub` or "Not specified" (2 lines max), chevron.
  5. **Ad slot `homeTop`** (see AdSpace).
  6. **My Stats tile**
     - Title "My Stats" with a SegmentedControl "Month / Year / All" (accessibility label "Stats period"; the indicator slides).
     - A 2×2 grid with hairlines; each value uses `CountUp`:
       - Rounds (9 Holes) (`roundsPlayed9`).
       - Rounds (18 Holes).
       - Cash Earned (`bucksEarned`).
       - Cash Redeemed.
     - Delta line under each: "+N%" or "−N%" (accent when 0 or more, negative colour when below) followed by "vs Last Month" or "vs Last Year". **Hidden entirely for "All".**
  7. **Points Earned Per Month tile**
     - Title, plus a "My Golf" link on the right.
     - `BentoBarChart`: one bar per `stats.monthly` entry; the latest month is solid accent and the rest are soft accent. A compact value sits above each bar (e.g. "3.1k") and `month` below. Bars grow in with a stagger. Accessibility label "Flagrr Cash earned per month: …".
     - **Empty:** "Scan a receipt to start your chart."
  8. **Ad slot `home`**.
  9. **Rewards preview**
     - Header "Rewards" (Fraunces 22) with a "View All" link.
     - Horizontal rail (no indicator) of the **first 5** `rewards`. Each card (200 pt wide):
       - 112 pt photo, or a rewards icon on fairway when there is no image or it fails to load.
       - Title (2 lines).
       - First variant's cost: "{cost}" and "Flagrr Cash".
     - Empty rewards: the header and "View All" still show, and the rail is empty, with no message.
- **Actions:**

| Control | What it does | When |
|---|---|---|
| Bell | `navigate('Notifications')` | Always |
| Avatar | `navigate('Profile')` (Profile tab) | Always |
| Tier ring | `navigate('MemberTiers')` | Always (also at top tier) |
| "Redeem" | `navigate('Rewards')` tab | Always |
| Resume tile | `navigate('CourseGuide', {roundId})` (slides up full screen, no swipe-back) | When a round is in progress |
| Play a round tile | `navigate('Course')` tab | When no round is in progress, or the golf call failed |
| Your Club tile | `navigate('Profile')` tab | Always |
| Month / Year / All | `setStatsPeriod(p)`: refetches `/me?period=p`, updates only `stats`; keeps the old stats if the call fails. The choice persists in context until logout. | Always |
| "My Golf" link | `navigate('MyGolf')` tab | Always |
| "View All" | `navigate('Rewards')` tab | Always |
| Reward card | `navigate('Rewards')` tab. It does **not** open that reward. | Per card |
| Ad | See AdSpace | When the ad has a target URL |
| Placeholder-club popup buttons | See Alerts | — |

- **States:**
  - Loading: none on screen. Home only mounts after `loadAll` has finished (the restore spinner, login spinner or sign-up spinner covers it). The round tile starts as "Play a round" and swaps to Resume when `golfHome` returns.
  - Refresh:
    - Data comes from the context and is fetched only at restore, login, sign-up and club change, and after a redeem or a receipt submission (points, user, streak, stats, activity, notifications).
    - **There is no pull-to-refresh on Home, and no polling or refresh on app foreground.**
    - `golfHome` re-runs on every focus of Home.
    - `CountUp` numbers re-count every time Home regains focus.
  - Error: `golfHome` failure falls back silently to "Play a round". A stats-period failure silently keeps the old numbers. There is no error UI.
  - Offline: same as the errors above; there is no offline banner.
  - Verification: the unverified banner shows when `verifiedMember` is false.
  - Tier: the "Top tier" ring at Platinum (`nextTier` null). The other tiers show the remaining amount.
  - Placeholder club (`isPlaceholderClub`): the popup on alternate app opens. Rewards is empty, so the rail is empty. "Your Club" shows the placeholder club's name.
  - Balance size steps: 42 / 38 / 30 pt.
  - Streak 0 versus streak 1 or more (singular "week").
  - Chart empty versus filled. Stats period "All" hides the deltas.
  - Inconsistency: `loadAll` (after a club change) always reloads **year** stats even if the segmented control shows Month or All.
  - Light/dark: all Bento tokens. Glass is solid on Android and with Reduce Transparency.
  - Reduce Motion:
    - `Appear` tiles render statically.
    - `CountUp` shows the final value.
    - The ring and bars draw instantly.
    - The segmented indicator and tab indicator jump instead of sliding.
  - Store and web builds are identical.
- **Alerts, sheets, toasts:**
  - **Placeholder-club popup**, when `user.isPlaceholderClub`. It shows on the 1st, 3rd, 5th… Home mount per user. The counter is in AsyncStorage key `flagrr_not_listed_popup_opens_{userId}` and increments once per Home mount (each app launch or login), not per focus.
    - Title "You're Almost In the Family".
    - Message "We couldn't find your golf club on Flagrr yet, so there's no rewards catalogue to show you just yet. Ask your club to join Flagrr, or get in touch with our support team and we'll help make it happen."
    - Buttons side by side:
      - "Contact Support" (accent): `navigate('Contact')`.
      - "Close" (cancel style): dismisses.
    - A storage error skips the popup silently.
    - (The Rewards Shop shows its own version of this popup on every visit; that belongs to another inventory.)
  - No toasts.
- **Validation:** none.
- **Server calls:**
  - `GET /api/courses?action=golfHome` on every focus. Result: `inProgress` round (or null). Errors are ignored.
  - `GET /api/me?period={month|year|all}` on a period change. Only `stats` is used; errors are ignored.
  - Indirectly: the ad impression and click logs (see AdSpace).
- **Board coverage:**
  - AppHomeLight, AppHomeDark and AppHomeFull (full scroll) show the default state: date, greeting, bell, avatar, hero with balance, tier and ring, streak, the **Resume "Hole 7 / 14 pts thru 6"** tile, Your Club, both SPONSORED ads with creative, My Stats on Month with deltas, the chart, the Rewards rail and the tab bar.
  - AppHomeUnverifiedLight (and Dark) show the unverified banner.
  - DlgNotListedLight (and Dark) show the placeholder popup over Home.
  - Prototype: Home, "Home · membership not verified", "Club not on Flagrr yet".
  - Board differences from code:
    - The board hero shows "Gold · ×1.5" (a multiplier) where code shows "Gold Member".
    - The board bell has a **dot** badge; code shows a **number**.
    - The board tab bar has **4 tabs + Scan** (Home, Course, Scan, Rewards, Profile); code has **6 tabs + Scan**.
    - The board dialog copy differs from code: the message is "We couldn’t find your golf club on Flagrr yet, so there’s nothing to earn or redeem there for now." and the second button is "Not now" instead of "Close". The redesign must pick one; code's longer message mentions asking the club to join.
  - **Not on a board:**
    - The "Play a round" round tile (no round in progress).
    - The "All holes in" Resume variant.
    - The "Top tier" ring (Platinum).
    - Balance font-size steps for large balances; compact "k" values in the ring.
    - Streak 0 and streak 1 ("week") states, and "0 more weeks…".
    - The unread-count badge with a number, and the no-unread bell.
    - Stats period "Year" ("vs Last Year") and "All" (no deltas).
    - Negative deltas.
    - Empty chart "Scan a receipt to start your chart.".
    - Empty rewards rail.
    - Reward card without an image (icon fallback).
    - Your Club without a logo (flag icon), and "Not specified".
    - Avatar initials versus photo (the board shows initials only).
    - Morning and Afternoon greetings (boards show "Evening").
    - Ad placeholder "Ad Space" (removed by owner decision 24 Nov 2026: no booked ad, no slot), and ads with no image (title fallback). See AdSpace.
    - The placeholder-club Home with an empty rail.
    - Home with no unread notifications.

---

#### 7. Notifications (`screens/profile/NotificationsScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** Bento screen (`BentoScreen`, no `ScreenHeader`). A gear in the header opens Notification Preferences (approved addition). Group headings are uppercase. Each row has an unread dot, a 40 pt chip with a bell (unread) or check (read), the title, a **time** (clock time for Today/Yesterday, weekday for This Week, date for Earlier and for a row exactly 7 days old; phone locale) and the body. "View" is a button named "View, {title}" (hint "Marks this notification as read"). Empty feed: "No notifications yet" / "Updates about your receipts, rewards and enquiries will show here." (owner-approved copy). Mark-read is still optimistic, but a failed server call now puts the row back to unread, and for "View" an alert "Couldn’t mark as read" / "Something went wrong. Please try again." says so (owner decision: no silent failures). Everything else below is unchanged: grouping rule, enquiry rows, no refetch, push-tap entry.

- **Reached from:**
  - The Home bell.
  - **Tapping any push notification** (native only), through `navigationRef.navigate('Notifications')`.
  - There is no link from Profile.
- **Shows:**
  - `ScreenHeader`: glass back button and the centred title "Notifications". No right-hand control.
  - The list from context `notifications`, grouped by `date` into, in this order:
    - "Today".
    - "Yesterday".
    - "This Week" (7 days or fewer ago).
    - "Earlier".
  - Only non-empty groups render. Each group has a heading (title style) and a card of rows with hairline dividers.
  - Row:
    - Icon: `notifications` (filled bell) when unread, `checkmark-circle-outline` when read; both club green.
    - **Title** (semibold) and **body** (secondary).
    - **No date or time is shown.**
    - Right side: a chevron when the notification links to an enquiry (`enquiryId`), otherwise a "View" text link.
- **Actions:**

| Control | What it does | When |
|---|---|---|
| Back | `goBack()` | Always |
| Row with `enquiryId` | Marks read (if unread), then `navigate('EnquiryChat', {enquiryId})` | Rows linked to an enquiry |
| "View" link | `markNotificationRead(id)` only. No navigation and no detail view. The row itself is disabled. | Rows without an enquiry |

- **States:**
  - **Empty: a blank screen** (no groups, no message).
  - No loading state: data comes from the context and is **not refetched** when the screen opens. No pull-to-refresh; new notifications appear only after the next `loadAll`, redeem or receipt.
  - Read versus unread: icon only. Marking read is optimistic; a server failure is ignored. The Home badge count drops immediately.
  - Light/dark tokens. Reduce Motion: no animations on this screen.
- **Alerts:** none.
- **Validation:** none.
- **Server calls:** `POST /api/notifications?action=read` `{id}` per mark-read. Fire-and-forget; errors are ignored.
- **Board coverage:**
  - AppNotificationsLight (and Dark) show groups "THIS WEEK" and "EARLIER" (uppercase), and rows with title, **time** ("14:05", "Sat", "12 Nov") and body.
  - The board header has a right-hand **"Notification Preferences"** button that code does not have.
  - The board shows no "View" link and no chevron rows (unverified for the icons).
  - Prototype: "Notifications".
  - **Not on a board:**
    - The empty state.
    - The "Today" and "Yesterday" groups.
    - Unread versus read row styling (unverified on the board).
    - The "View" link.
    - Enquiry rows with a chevron, and their navigation to Enquiry chat.
    - The push-tap entry point.

---

#### 8. Member Tiers (`screens/profile/MemberTiersScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below (owner decision: the mockup layout wins; perks keep the multiplier, drop rands):** Bento screen with the board's structure. Balance card: CountUp balance, tier name and "earning ×{multiplier}". Unverified notice (same copy). "How to Reach the Next Tier": "{N} FC to {next tier}", "Earn it before this quarter ends.", a `FillBar` at `tierProgress`, "{earned} FC this quarter" and the next threshold (earned = threshold − `pointsToNextTier`, exact per `api/_lib/tiers.ts`; the quarter line and figures are hidden for unverified members), then the 01/02/03 steps (same copy). Top tier: "You’ve reached the top tier" with a full bar (replaces the "0 pts to " bug). "Tier Benefits": all four tiers as rows with a ×multiplier badge (colours from the board, multipliers copied from `TIER_MULTIPLIERS`), "From N FC a quarter" (Bronze "From 0 FC"), the perks and a Current / Next tag. Perks (`data/mockData.ts`): Bronze "Flagrr Cash on your receipts", "Birthday reward of 50 FC"; Silver "1.2x Flagrr Cash on your receipts", "Birthday reward of 100 FC"; Gold "1.5x …", "Birthday reward of 150 FC", "A bar voucher each quarter you qualify"; Platinum "1.7x …", "Birthday reward of 200 FC", "A bar voucher each quarter you qualify". Removed with the tabs: the tier tab switcher, the "{TIER} MEMBER" crown pills and the per-tier description sentence. `ProgressBar` was deleted (no other user).

- **Reached from:** the Home tier ring only.
- **Shows:**
  - `ScreenHeader` "Member Tiers" with back. The screen background is dark green; the header area uses the ground colour.
  - **Points card** (ground colour, rounded):
    - Cards icon and `CountUp` of the balance, then "Flagrr Cash".
    - Gold-gradient badge "{TIER} MEMBER" (uppercase) with a crown.
    - `ProgressBar` at `tierProgress` (animated fill; static with Reduce Motion).
    - "{pointsToNextTier} pts to {nextTier}". **At top tier this renders "0 pts to "** with nothing after it (`nextTier` is null; a bug to resolve).
  - **Unverified banner** (when `verifiedMember` is false; mint background, alert icon): "Your club hasn't verified your membership yet, so tier progress is on hold — you can still earn and redeem Flagrr Cash as normal. Ask your golf club to add you to their member list."
  - **"How to Reach the Next Tier"** (lime heading on dark green) with three numbered steps:
    - "01" "Play": "Play rounds at your club and stay active on Flagrr."
    - "02" "Earn": "Earn Flagrr Cash through qualifying activities."
    - "03" "Upgrade": "As your activity grows, unlock the next tier and enjoy enhanced benefits."
  - **"Tier Benefits"** sheet (ground colour, rounded top):
    - Underline tabs "Bronze", "Silver", "Gold", "Platinum". The default selection is the user's own tier.
    - Gold pill "{TIER} MEMBER" with a crown.
    - "{Tier} status recognises loyal players and gives them more value every time they play."
    - Perk rows with a check icon. Perks are **hard-coded** in `data/mockData.ts`, not fetched per club:
      - Bronze: "Earn 1 Flagrr Cash per R1 spent", "Birthday reward (50 Flagrr Cash)".
      - Silver: "1.2x Flagrr Cash per R1 spent", "Birthday reward (100 Flagrr Cash)".
      - Gold: "1.5x Flagrr Cash per R1 spent", "Birthday reward (150 Flagrr Cash)", "R100 bar voucher each quarter you qualify".
      - Platinum: "1.7x Flagrr Cash per R1 spent", "Birthday reward (200 Flagrr Cash)", "R200 bar voucher each quarter you qualify".
    - Note: CLAUDE.md says rates are set per club; these fixed perk strings conflict with that, so the redesign needs a decision.
  - A 140 pt bottom spacer.
- **Actions:**

| Control | What it does | When |
|---|---|---|
| Back | `goBack()` | Always |
| Tier tab | Shows that tier's pill, description and perks (local state only) | Always |

- **States:**
  - Unverified banner.
  - Top tier (the broken "0 pts to " line).
  - Each tier tab selected.
  - Light/dark through the legacy tokens.
  - Reduce Motion: no CountUp or progress animation.
  - No loading, error or empty states. There are no server calls; data comes from the context plus the static list.
- **Alerts:** none.
- **Validation:** none.
- **Server calls:** none.
- **Board coverage:**
  - AppTiersLight, AppTiersFull (and Dark), and the prototype "Member tiers", show a **different structure**:
    - A balance card with "Gold · earning ×1.5".
    - A quarterly progress block ("1 786 FC to Platinum", "Earn it before this quarter ends.", "13 214 FC this quarter", "15 000").
    - A "Tier Benefits" list of all four tiers as rows (×multiplier, name, "From N FC a quarter", birthday and voucher lines, "Current" / "Next" tags).
  - **Not on a board:**
    - The tier **tab switcher** and its per-tier detail view (pill, description sentence, perk rows as worded in code).
    - The "How to Reach the Next Tier" 01/02/03 steps.
    - The unverified banner on this screen.
    - The top-tier state.
    - The progress bar as drawn in code.
    - Bronze or Silver as the current tier (the board shows Gold).

---

### App-wide behaviour

#### A. App start (`mobile/App.tsx`)

- **Splash:** the native splash is held (`preventAutoHideAsync`) until fonts load (`useFonts(fontsToLoad)`) or fail. If the fonts fail, the app still renders. Until then `App` renders nothing.
- **Provider order:**
  - `GestureHandlerRootView`, `SafeAreaProvider`, `ThemeProvider`, `AppProvider` (member session), `AdminProvider` (admin session).
  - Inside them: `NavigationContainer(ref=navigationRef)` with `RootNavigator`, plus `AppAlertHost` and `ToastHost` mounted once over everything.
- **Session-restore spinner** (`RootNavigator`): while the member **or** admin context is initialising, a full-screen large `ActivityIndicator` in the accent colour on the ground colour. This avoids a flash of Landing on a warm start. **No board shows it.**
- **Dev-only gallery:** on web with `__DEV__`, `?bento`, `?bento=dark` or `?bento=light` renders the Bento component gallery. Never in exported builds.

#### B. Navigation: every route and how it is reached

**Root stack choice** (`RootNavigator`, in priority order):

1. Admin session (`isAdminAuthenticated`):
   - `AdminForceChangePassword` if `mustChangePassword`.
   - Otherwise `AdminStaffWelcome` if `staffWelcomePending`.
   - Otherwise `SuperAdminMain` for `super_admin` and `support_agent`.
   - Otherwise `AdminMain`.
   - (Out of scope here, but an admin session **takes priority** over a member session on the same device.)
2. Member session (`isAuthenticated`): the member stack below.
3. Otherwise `Auth` (AuthNavigator).

**Auth stack:**
- `Landing` (initial), `Login`, `ForgotPassword`, `SignUpStep1`, `SignUpStep2`.
- `AdminLogin` and `AdminForgotPassword` are registered **only when not a store build**.

**Member stack** (`RootNavigator`, JS stack `@react-navigation/stack` since 1.1.0, all `headerShown: false`; the 1.0.1 store app used the native stack with six tabs):

| Route | Screen | Transition | How it's reached (summary) |
|---|---|---|---|
| `Main` | Tab navigator (Home, Course, Rewards, Profile), ground background | cross-fade (sign in / out) | Login, sign-up, restore; `popTo('Main', {screen:'Home'})` from ReceiptSuccess "View Current Balance"; `popTo('Main', {screen:'Rewards'})` from Voucher "Back to Rewards"; tab presses on My Golf |
| `MyGolf` | My Golf (keeps the tab bar, Course lit; Back button) | push; cross-fade when a tab press closes it | Course "Your game" tile; Home "My Golf" link; CourseGuide "See My Golf" (reset to `[Main, MyGolf]`) |
| `Activity` | Reward Activity (Back button, title "Reward Activity") | push | Profile "Reward Activity" row |
| `Voucher` | Voucher | push | Redeem flow, Activity rows |
| `ScanFlow` | Nested stack: `ScanReceipt` → `ReviewReceipt` → `ReceiptSuccess` | modal rise (screen behind shrinks); push inside | Tab-bar Scan button; "Scan a receipt" on empty Activity and Receipt History |
| `ReceiptHistory` | Receipts | push | Profile |
| `MemberTiers` | Tiers | push | Home tier ring |
| `Notifications` | Notifications | push | Home bell; push tap |
| `HelpCenter`, `Contact`, `GiveFeedback`, `Referral`, `EditProfile`, `TermsPrivacy`, `MyEnquiries`, `EnquiryChat`, `NotificationPreferences` | Profile and support screens | push | Profile rows; `Contact` also from the Home placeholder popup; `EnquiryChat` also from Notifications |
| `RoundSetup` | Start a round | push | Course tab |
| `CourseGuide` | Hole view | push, **no swipe-back** | Home Resume tile; Round setup (replaces itself) |
| `RoundDetail` | Round detail | push | My Golf, Course |

Inside `ScanFlow`: Review replaces itself with Success (Back can't resubmit); "Submit Another Receipt" resets the flow to one fresh scanner (1.0.1 stacked a second scanner); Close on the scanner, or Back on its first screen, closes the whole flow.

**Tabs** (`MainTabNavigator`, order): `Home`, `Course`, `Rewards`, `Profile`. The tab bar (`navigation/MemberTabBar.tsx`) is drawn above the stack and inserts Scan in the centre.

**Transitions** (`navigation/transitions.ts`, from the Bento prototype, curve cubic-bezier(.32,.72,0,1)):
- Push 560 ms: the new screen slides in from the right (shadow); the one behind slides 28% left and dims to 82%. Pop 520 ms.
- Scan flow 620 ms: rises from the bottom, corners 48 → square; the screen behind shrinks to 92%, dims to 60%, corners to 40 over black. Closing 500 ms.
- Sign in / out: 500 ms cross-fade, settling from 98.5% and 6 pt down.
- Animations run on web too. Reduce Motion: every transition is a 200 ms fade.
- Tab switch: 420 ms cross-fade, with the incoming scene settling from scale 0.985 and 6 pt down. Reduce Motion keeps only the fade.

**Deep links:**
- `app.json` declares `scheme: "flagrr"`, but `NavigationContainer` has **no `linking` config**. No `flagrr://` URL routes anywhere, and web URLs do not change per screen.
- The only programmatic routing from outside the tree is the push tap to `Notifications`.
- Web refresh: it restarts the app, which returns to Home if the token was persisted, otherwise Landing. Browser back and forward are not wired to the stack (unverified in a browser).

#### C. Gestures and hardware back

- **Swipe back (iOS):** every pushed screen can be swiped back from anywhere on the screen (`gestureResponseDistance` = screen width on the JS stack; 1.0.1 used `fullScreenGestureEnabled`). The scan flow has no swipe-down; it closes with its Close button.
  - Exception: `CourseGuide`, which has no swipe.
  - Auth screens swipe back through their history (for example, Forgot to Login to Landing).
  - The Forgot screen's reset step swipes back to Login, not to the request step.
  - After login or sign-up the Auth stack is gone, so there is no swipe back to it.
- **Android hardware back:** no custom `BackHandler` anywhere in member code.
  - Stack screens pop.
  - Tabs: back from a non-Home tab goes to Home (default `firstRoute`); back on Home or Landing exits the app.
  - `CourseGuide` still pops on hardware back even though swipe is disabled.
  - Open alerts: hardware back dismisses the alert **without running any button's handler** (`onRequestClose = dismissAlert`).
  - The SelectField and DateField modals close on back.
  - `predictiveBackGestureEnabled: false` in `app.json`.
- **Pull to refresh:** **none** on any screen in this area (Home, Notifications, Tiers). It exists only on CourseHome and MyGolf (other inventories).
- **Tab re-press:** re-pressing the active tab scrolls that tab to the top (`navigation/scrollToTop.ts`; 1.0.1 did nothing). On My Golf, pressing Course pops back to Course if that's where My Golf was opened, and any other tab closes My Golf with the tab cross-fade.
- **Tab bar Scan button:** `navigate('ScanFlow')`, rises as a modal. Haptic: medium (phones).

#### D. Tab bar (`components/bento/BentoTabBar.tsx`)

- **Layout:**
  - A floating glass bar, 22 pt from the bottom, 74 pt tall, at most 560 pt wide minus side margins, centred.
  - It handles any number of tabs. Scan always sits at index `floor(tabs/2)`. Slots are up to 62 pt wide and shrink to share the width (5 slots in 1.1.0).
- **Tabs:** an icon (23 pt; accent and stroke 2 when active, `t.tabOff` and stroke 1.6 otherwise) and a label (max font scale 1.3). Icons: home, course, rewards, profile. A tab press gives a selection haptic.
- **Accessibility:** tablist and tab roles, with selected state (`aria-selected` on web too) and labels.
- **Scan:** a raised fairway square (lifted above the bar) with a lime scan icon and the label "Scan". Press scale 0.9. Accessibility label "Scan receipt".
- **Active indicator:** a soft-accent pill behind the active tab. It slides with an overshoot over 600 ms; Reduce Motion snaps it. It is placed without animation on first render.
- **Glass:**
  - iOS: BlurView with a translucent fill.
  - Web: CSS `backdrop-filter`.
  - **Android, and anywhere with Reduce Transparency: a solid fill.**
- Shown on the four tabs and My Golf (Course lit); on every other screen it slides down out of view over 600 ms and fades (`hidden` prop), and is hidden from screen readers.
- **Board coverage:** every Home board shows **4 tabs + Scan** (Home, Course, Scan, Rewards, Profile), and the prototype uses `TABS = Home, Course, Rewards, Profile`. **The live 6-tab layout (with My Golf and Activity as tabs) is on no board**, and neither is where My Golf and Activity move to. In the prototype, My Golf is reached from Home or Course and Activity from Profile. Before shipping 4 tabs, every entry point to those two screens must exist elsewhere.

#### E. Session, keep-me-logged-in, logout (`context/AppContext.tsx`, `api/client.ts`)

- **Token storage:**
  - The member token is stored under AsyncStorage key `flagrr_auth_token` (localStorage on web) and cached in memory.
  - The admin token is separate (`flagrr_admin_auth_token`).
  - All requests send `Authorization: Bearer` and `cache: 'no-store'`.
- **Restore on launch:**
  - If a token is stored, `loadAll()` runs, then `isAuthenticated` is set.
  - **On any failure** (expired token, server error **or no network**), the stored token is **deleted** and the user lands on Landing. Opening the app offline therefore logs the member out.
- **`loadAll()`:**
  - Runs in parallel: `/me?period=year` (user, points, streak, stats, ads), `/rewards`, `/vouchers`, `/activity`, `/receipts`, `/notifications`.
  - Then calls `theme.hydrateFromAccount(user.themePreference)` and starts push registration (fire-and-forget).
  - Called by: restore, login, sign-up, `changeHomeClub`.
- **Keep me logged in** (Login only; default on):
  - On: the token is persisted.
  - Off: memory only, so the session ends when the app process ends or the web tab reloads.
  - Sign-up always persists.
- **Refreshing data:**
  - There is **no polling, no app-foreground refresh and no global refresh**.
  - Partial refreshes:
    - After redeeming: `/me` (current period), `/activity`, `/notifications`; the new voucher is prepended.
    - After a receipt submission: the same, plus streak; the new receipt is prepended.
    - A stats period change: `/me` stats only.
    - Mark-read: optimistic.
    - Avatar, profile and theme updates patch `user`.
  - `unreadNotificationCount` is derived from the notifications list.
- **Expired token mid-session:** there is no global 401 handling. Individual calls fail (most screens swallow the error); the user is not logged out automatically.
- **Logout** (Profile "Log Out" row):
  - **No confirmation dialog.** Calls `setToken(null)`, which removes the stored token, and resets all member state to empty. The root stack switches to Auth / Landing.
  - **No server call:** the session is not revoked server-side.
  - **The push token is not unregistered.**
  - The local theme preference is kept.
  - The not-listed popup counter (per user id) is kept.
- **Delete account:** server delete, then the same `logout()`.
- **Password reset:** server-side, signs out all devices. The app only notices when a later call fails, and it shows no message about it.

#### F. Push notifications (`utils/pushNotifications.ts`, `App.tsx`, `app.json`)

- **Registration:**
  - After every `loadAll()` on iOS and Android (never on web).
  - Requires `expoConfig.extra.eas.projectId`. **`app.json` now has one** (`12ea4b7f-…`), so registration is live, even though the code comment still says "no EAS project yet".
  - Flow:
    1. Read the current permission.
    2. If it is not granted, **show the OS permission prompt straight away**. There is no in-app pre-prompt; on first login or sign-up the prompt appears over Home. Declining returns null silently.
    3. Android: create a notification channel `default` ("default", default importance).
    4. Get the Expo push token.
    5. `POST /api/profile?action=registerPushToken` `{token, platform}`. Errors are ignored.
  - It re-runs at every restore and login, so the prompt reappears only if the OS allows it.
- **Foreground presentation:** the handler shows the banner, list entry and sound; it does not set a badge.
- **Tap handling:**
  - Any notification tap (native) runs `navigationRef.navigate('Notifications')` if navigation is ready. The payload is **not** used: an enquiry reply, for example, does not open that chat.
  - If the member is not signed in (or an admin session is active), the `Notifications` route does not exist and the tap does nothing (React Navigation warns in development).
  - Cold start from a killed app: the listener is attached before navigation is ready, and `getLastNotificationResponseAsync` is not used, so the tap probably just opens the app on Home. (Unverified on a device.)
- Android permissions in `app.json`: CAMERA and RECORD_AUDIO. There is no explicit POST_NOTIFICATIONS entry; the expo-notifications plugin handles it (unverified).
- Notification preferences (`NotificationPreferences` screen) belong to another inventory.
- **Board coverage:** no board shows the OS permission prompt, a foreground push banner, the tap-to-open behaviour, or a push-denied state.

#### G. Theme, Reduce Motion, Reduce Transparency (`context/ThemeContext.tsx`, `theme/motion.ts`)

- **Theme preference:** `system | light | dark`.
  - Stored locally under `flagrr_theme_preference`.
  - The account preference (from `/me`) is adopted **only if the device has no local choice yet**, and then saved locally.
  - Changed from Profile > Appearance ("Light / Dark / System"): `PUT` to the account, then saved locally.
  - "System" follows the OS live (`useColorScheme`); `userInterfaceStyle: automatic`.
  - Logout keeps the local preference.
- **Tokens:** member screens use Bento tokens (`bentoLight` / `bentoDark`). Older restyled screens (Login, Sign up, Forgot, Notifications, Tiers) get Bento colours through `useBentoLegacy` and `systemFonts`.
- **Status bar:**
  - Auth screens force light content.
  - `BentoScreen`, Notifications and Tiers follow the scheme (dark content in light mode).
- **Reduce Motion** (iOS or Android setting, or the web `prefers-reduced-motion`): read synchronously by `prefersReducedMotion()` and kept current by a listener. Effects:
  - `Appear`: no rise or reveal.
  - `CountUp` and `CountUpText`: show the final value.
  - `Ring`, `ProgressBar` (1.1.0: `FillBar`) and bar chart: drawn instantly.
  - Segmented, tab-bar and toggle indicators jump.
  - `PressableScale`: no spring.
  - `ScreenFade` (web): skipped.
  - Tab scenes: fade only.
  - Alerts: fade 200 ms with no scale pop.
  - Toast: fade only, no grow.
- **Reduce Transparency** (iOS setting, or the web `prefers-reduced-transparency`): `Glass` (tab bar, glass icon buttons, title bars) becomes a solid `t.glassSolid` fill. Android always uses the solid fill.
- **Dark mode on boards:** Dark boards exist for Landing and Home (and are listed for the others in `canvas.json`).

#### H. Alerts (`components/common/AppAlertHost.tsx`, `utils/alert.ts`, `utils/alertStore.ts`)

- **`showAlert(title, message?, buttons?)`:** a module-level store, callable from anywhere. It is the only dialog mechanism in this area.
  - With no buttons, it shows a single "OK".
  - A new alert replaces the current one (no queue).
- **Look:**
  - A centred card, 296 pt wide (or screen width minus 48), 26 pt radius, tile colour, shadow plus ring.
  - Title: 17 pt semibold, centred, header role.
  - Message: 14/20, muted, centred.
  - Buttons run edge to edge under hairlines:
    - **Exactly 2 buttons sit side by side, with the action first and the cancel-style button last** (re-sorted automatically).
    - 1 or 3+ buttons stack.
    - Styles: `default` is accent 600; `cancel` is ink 500; `destructive` is danger 600.
    - The pressed state fills with the segment colour.
- **Motion:**
  - The backdrop fades in over 350 ms (scrim plus a 5 px blur on web).
  - The card scales in from 1.1 with an overshoot over 450 ms.
  - Dismiss fades out over 160 ms.
  - Reduce Motion: a 200 ms fade only.
- **Behaviour:**
  - Tapping the backdrop does **nothing**: the user must pick a button.
  - Android back dismisses without calling any handler.
  - Each button dismisses first, then runs its `onPress`.
  - Accessibility: modal, alert role.
  - While an admin console's own alert host is mounted, this host draws nothing (admin alerts look different).
- **Every alert in this area:**
  - "Couldn’t log in".
  - "Couldn’t create your account".
  - "Enter a valid email".
  - "Couldn’t send code".
  - "Enter the code".
  - "Password too short".
  - "Passwords don’t match".
  - "Password reset".
  - "Couldn’t reset password".
  - "You're Almost In the Family".
  - (Full copy is in each screen section above.)
- **Board coverage:** the alert style is shown by the Dlg* boards (DlgNotListed in this area). Of the alerts listed, only the placeholder-club popup has a board.

#### I. Toast (`components/bento/Toast.tsx`)

- `showToast(title, subtitle?)`, with `ToastHost` mounted at the root.
- **Look:**
  - A dark "island" pill: width min(340, screen − 32), min height 54, radius 27.
  - A lime check in a fairway circle, a white 14 pt semibold title, and a 12 pt 70%-white subtitle.
  - Positioned 11 pt from the top on iPhones with a Dynamic Island (safe-area top 54 or more), otherwise safe-area top + 8.
  - Not tappable (`pointerEvents: none`). It is a polite live region.
- **Motion:**
  - Grows out of the island size (124 × 36) with an overshoot over 600 ms.
  - Holds 3000 ms.
  - Shrinks back over 450 ms.
  - Reduce Motion: 200 ms fades.
  - A new toast replaces the current one.
- **Usage:** **`showToast` is not called anywhere in the shipped app** (only in the dev gallery). The prototype uses toasts for "Reward redeemed" / "Show the voucher at the club" and "Receipt submitted" / "+196 FC once your club approves it"; the code does not show those today.
- **Board coverage:** no static board. The behaviour exists only in ProtoLight. In this area, a toast would be a natural fit for the Forgot password "Send it again" confirmation, which today has no feedback.

#### J. Ads (`components/common/AdSpace.tsx`)

- **Placements:**
  - `homeTop`: Home, under Your Club.
  - `home`: Home, after the monthly chart.
  - `rewardsShop`: Rewards Shop, in the empty state and after the first grid row (other inventory).
- **Data:** `me.ads`, fetched in `loadAll` only. The client filters by placement and keeps the server's order (placement, sort order, created). There is no refresh until the next `loadAll`.
- **Slot:** fixed **180 pt** high, full width, radius `radius.md` (15 pt), cover crop.
- **"SPONSORED" label:** 12 pt, 600, letter-spaced, muted, above every **real** ad. Not shown on the empty placeholder.
- **Placeholder states:**
  - No active ad for the slot: a dark-green box with "Ad Space" in lime Fraunces 700. No label, not tappable (owner decision 24 Nov 2026: from the 1.1.0 store build the empty slot is not shown at all).
  - An ad with no `imageUrl`: the same green box showing the **ad's title** (or "Ad Space"), with the SPONSORED label.
- **Media:**
  - Image or GIF: `Image` with cover crop.
  - Video (`mediaType: 'video'`): `expo-video` `VideoView`, cover crop, **muted, autoplay, no controls**. It **loops** when it is the only ad in the slot; otherwise it plays once and advances at the end.
- **Rotation** (when the slot has more than one ad):
  - Images and GIFs advance every **6 s**.
  - Videos advance on `playToEnd`.
  - Wraps around.
  - Rotation dots: absolute, 8 pt from the bottom, 6 pt dots, 50% white; the active dot is 16 pt wide and solid white. Not interactive.
  - If the ad list shrinks, the index snaps back to 0.
  - Rotation **pauses while the screen is not focused**. A playing video is not paused when the tab loses focus; only its advance listener is removed. (Behaviour from code; the audio is muted anyway.)
- **Tap:**
  - Only when the ad has `targetUrl`. Calls `logAdClick(id)` (fire-and-forget), then `Linking.openURL(targetUrl)`, which opens the external browser. On web it opens a new tab; that is how react-native-web behaves (unverified).
  - Press opacity 0.85. Accessibility: link role, label = ad title or "Advertisement".
  - Ads without a target URL are not tappable.
- **Impressions:** `POST` ad impression once per ad each time it becomes the visible ad **while the screen is focused**. It fires again on rotation and on refocus. Fire-and-forget.
- **Motion:** ads never animate (not wrapped in `Appear`), including with motion on.
- **Board coverage:**
  - AdSpec documents: the 392 × 180 artwork template, the 312 × 156 safe area, fixed height, width per phone, cover fit, the 15 pt corners, export sizes, the three placements, 6 s rotation with videos playing to the end, dots 8 pt from the bottom, and muted autoplay video that loops when alone.
  - The Home boards show two SPONSORED ads with creative.
  - **Not on a board:**
    - The empty-slot "Ad Space" placeholder (removed by owner decision 24 Nov 2026: no booked ad, no slot).
    - The no-image title fallback.
    - Non-tappable ads (no target URL).
    - The external-browser hand-off.
    - The rotation dots drawn on the Home boards (AdSpec only describes them).
    - Impression and click logging rules.
    - Pause-when-unfocused.

#### K. Build flags: store versus web (`config/buildConfig.ts`, `eas.json`)

- `IS_STORE_BUILD = process.env.EXPO_PUBLIC_STORE_BUILD === '1'`.
  - Set in the EAS **`preview` and `production`** profiles.
  - Not set in `development` or the web export.
- **Store build (member-only binary):**
  - No "Golf Course Admin Login" link on Landing.
  - `AdminLogin` and `AdminForgotPassword` are not registered in the Auth stack.
  - An admin session can still be restored if a token exists (theoretical on a store device; unverified whether that can happen).
- **Web build:**
  - Shows the admin link and routes.
  - No push: registration returns null and there is no tap listener.
  - Stack transitions are replaced by `ScreenFade`.
  - Glass uses CSS backdrop-filter.
  - DateField uses `<input type="date">`.
  - Alerts use the same in-app modal (the browser `alert` / `confirm` is never used).
  - Keep-me-logged-in off ends the session on tab reload.
  - Ad links open through `Linking.openURL`.
  - Dev-only `?bento` gallery.
- **Native-only:**
  - Push registration, the tap handler and the Android channel.
  - BlurView glass on iOS (Android uses solid).
  - `ios_from_right` slide on Android.
  - Native date pickers.
- **OTA:** `runtimeVersion` policy `appVersion`; updates come from `u.expo.dev`. `theme/motion.ts` notes that the motion uses only built-in modules so it ships over the air. Native build ids: iOS buildNumber 6, Android versionCode 9, version 1.1.0.

#### L. Other shared bits used by these screens

- **`TextField`** (member, `onLight` variant):
  - Bento field: tile fill, hairline border, accent border when focused, danger border plus a red message on error.
  - Optional leading Ionicon. The password eye toggle has accessibility labels.
  - The web focus outline is removed.
- **`PillButton`:**
  - Default trailing `arrow-forward` icon.
  - `disabled` and `loading` both show 45% opacity, and loading shows a spinner.
  - Accessibility busy and disabled states.
  - Hover state on web.
- **`BentoButton`:** primary, secondary and lime variants, an optional "nub" (round arrow at the end), compact size.
- **`ScreenHeader`:** a glass back button (accessibility label "Back") and a centred 2-line title on the ground colour.

---

### Not on any board

Every part, state, dialog and behaviour in this area that no static board shows. Where the prototype (ProtoLight) covers something, that is noted.

1. Font-loading splash hold, and the app rendering nothing until fonts load or fail.
2. Session-restore full-screen spinner (accent ActivityIndicator on the ground colour).
3. Session restore failing (expired token or offline at launch): the token is deleted and the user lands on Landing with no message.
4. Landing: store-build variant without "Golf Course Admin Login".
5. Landing: Terms of Use and Privacy Notice are not tappable in code. Their destination is undecided; the board draws them as links.
6. Login: inline error "Email is required".
7. Login: inline error "Enter a valid email address".
8. Login: inline error "Password is required".
9. Login: "Login" button disabled (email or password empty).
10. Login: "Login" button loading spinner.
11. Login: "Keep me logged in." in the off state.
12. Login: alert "Couldn’t log in" with a server message ("Invalid email or password").
13. Login: the 429 throttle message "Too many sign-in attempts. Try again in 15 minutes, or reset your password.".
14. Login: the generic network failure "Something went wrong. Please try again.".
15. Login, Sign up step 2 and Forgot: keyboard-open layout (no KeyboardAvoidingView or scroll on Login and Forgot today).
16. Sign up 1: **the Golf Club picker field** (missing from every sign-up board).
17. Sign up 1: club field loading "Loading golf clubs…" (disabled).
18. Sign up 1: club selection bottom sheet (title "Golf Club", list, checkmark on the selected club).
19. Sign up 1: "My Club Isn't Listed Yet" option (sorted last).
20. Sign up 1: club list failed to load (empty sheet, no error, no retry).
21. Sign up 1: date picker on iOS (inline calendar modal with "Done").
22. Sign up 1: date picker on Android (native dialog).
23. Sign up 1: date picker on web (browser date input).
24. Sign up 1: filled date display format ("Jan 1, 2000").
25. Sign up 1: inline error "Full name is required".
26. Sign up 1: inline error "Email is required" / "Enter a valid email address".
27. Sign up 1: inline error "Date of birth is required".
28. Sign up 1: inline error "Select your golf club".
29. Sign up 1: two-segment progress bar (unverified whether the board draws it).
30. Sign up 2: neutral hint "At least 8 characters" versus the error "Password must be at least 8 characters" (only one appears on the board).
31. Sign up 2: inline error "Email is required" / "Enter a valid email address".
32. Sign up 2: inline error "Passwords do not match".
33. Sign up 2: "Sign Up" loading spinner.
34. Sign up 2: alert "Couldn’t create your account" (including "An account with this email already exists").
35. Sign up: an invalid referral code is silently ignored (no feedback state).
36. Forgot: **the whole reset step** (code field "6-digit code", "New password", "Confirm new password", "Update Password" button, and the helper "Enter the code we sent to {email} and choose a new password.").
37. Forgot: "Didn't get a code? Send it again." link, and its missing success feedback.
38. Forgot: on-screen back from the reset step returns to the request step (the OS back gesture leaves the screen instead).
39. Forgot: "Send Code" disabled and loading states.
40. Forgot: "Update Password" disabled and loading states.
41. Forgot: alert "Enter a valid email".
42. Forgot: alert "Couldn’t send code", including the reset rate-limit message with the support email and phone.
43. Forgot: alert "Enter the code".
44. Forgot: alert "Password too short".
45. Forgot: alert "Passwords don’t match".
46. Forgot: success alert "Password reset" (OK goes to Login).
47. Forgot: alert "Couldn’t reset password" ("That code is invalid or has expired").
48. Forgot: the request always succeeds for unknown emails (no account-exists signal).
49. Home: "Play a round" tile (no round in progress, or the golf call failed).
50. Home: Resume tile "All holes in" variant.
51. Home: "Top tier" ring (Platinum, no next tier).
52. Home: balance font-size steps for 10,000+ and 100,000+, and the compact "k" in the ring for 100,000+.
53. Home: streak 0 and streak 1 ("week") states, including "0 more weeks to a … FC bonus".
54. Home: the streak "since" sentence (accessibility label only, never visible).
55. Home: the numeric unread badge (the boards show a dot), and the no-unread bell.
56. Home: stats period "Year" ("vs Last Year").
57. Home: stats period "All" (no deltas).
58. Home: negative-delta styling beyond the single board example. Zero delta shown as "+0%".
59. Home: empty chart "Scan a receipt to start your chart.".
60. Home: empty rewards rail (header and "View All" with no cards).
61. Home: reward card without an image (icon fallback).
62. Home: Your Club without a logo (flag icon), and "Not specified".
63. Home: avatar with an uploaded photo (the boards show initials).
64. Home: "Morning" and "Afternoon" greetings.
65. Home: the placeholder-club Home underneath the popup (empty rewards, placeholder club name).
66. Home: alternate-launch rule for the placeholder popup (every 2nd launch), and its button set. Code has "Contact Support" / "Close" and a longer message; the board has "Not now" and a shorter message.
67. Home: no pull-to-refresh, no refresh on foreground. The data is as of the last full load.
68. Home: `CountUp` re-counting each time the tab regains focus.
69. Home: the 6-tab layout (Home, Course, My Golf, Scan, Rewards, Activity, Profile). Boards show 4 tabs + Scan; where My Golf and Activity live without tabs is undesigned.
70. Notifications: empty state (currently a blank screen).
71. Notifications: "Today" and "Yesterday" group headings.
72. Notifications: unread versus read row icons (unverified on the board).
73. Notifications: the "View" link on rows without an enquiry (marks read only).
74. Notifications: enquiry rows with a chevron that open Enquiry chat.
75. Notifications: opened from a push-notification tap.
76. Notifications: the board's per-row time and "Notification Preferences" header button are not in code (the reverse gap: a decision is needed).
77. Member Tiers: the tier tab switcher (Bronze / Silver / Gold / Platinum) and its per-tier detail (pill, description sentence, perks as worded in code).
78. Member Tiers: "How to Reach the Next Tier" 01 Play / 02 Earn / 03 Upgrade steps.
79. Member Tiers: unverified banner ("…Ask your golf club to add you to their member list.").
80. Member Tiers: top-tier state (today's broken "0 pts to " line).
81. Member Tiers: Bronze or Silver as the current tier, and the progress bar as drawn in code.
82. Push: the OS permission prompt shown right after login, sign-up or restore (no in-app pre-prompt).
83. Push: permission denied or not available (silent; no in-app state).
84. Push: foreground notification banner (shown with sound, no badge).
85. Push: a tap while logged out or in an admin session (does nothing).
86. Push: cold-start tap (probably opens on Home, not Notifications; unverified).
87. Logout: no confirmation; the instant switch to Landing; no server sign-out; the push token is kept.
88. Mid-session expired token or password reset elsewhere (no auto-logout, no message).
89. Alert host generic behaviours:
    - Stacked layout for 1 or 3+ buttons.
    - Destructive button style.
    - Backdrop tap does nothing.
    - Android back dismisses without running a handler.
    - A new alert replaces the current one.
90. Toast: no static board. `showToast` is unused in shipped code; the prototype's "Reward redeemed" and "Receipt submitted" toasts are not implemented.
91. Tab bar: Android and Reduce Transparency solid (non-glass) variant.
92. Tab bar: re-pressing the active tab does nothing (no scroll-to-top).
93. Tab bar: active indicator slide, and Reduce Motion snap.
94. Ads: empty-slot "Ad Space" placeholder (no SPONSORED label) (owner decision 24 Nov 2026: from the 1.1.0 store build the empty slot is not shown at all).
95. Ads: ad without an image (title shown on a green box).
96. Ads: non-tappable ad (no target URL).
97. Ads: tap opens the external browser.
98. Ads: rotation dots on a live slot (described in AdSpec, not drawn on the Home boards).
99. Ads: rotation pauses when the screen is unfocused; impression fires per show while focused.
100. Ads: video that plays once and advances when other ads share the slot.
101. Reduce Motion variants of every animated element (Appear, CountUp, Ring, bars, ProgressBar, indicators, alert, toast, tab fade, web ScreenFade).
102. Reduce Transparency variants of glass (tab bar, glass icon buttons, header title bar).
103. Web build specifics: admin login link and routes present; no push; ScreenFade instead of slides; browser date input; session lost on reload when keep-me-logged-in is off; no URL routing or deep links.
104. Deep links: the `flagrr://` scheme is declared but unrouted (no linking config).
105. Android hardware back:
     - Tab back goes to Home.
     - The app exits from Home or Landing.
     - CourseGuide still pops even though swipe is disabled.
106. Dark variants of Login, Sign up 1 and 2, Reset password, Notifications, Tiers, Home unverified and the NotListed dialog are listed in `canvas.json` but absent from the local board copy, so I could not check them.

---

### Things I could not verify

- The Dark board files for Login, Sign up 1 and 2, Forgot, Notifications, Tiers, Home unverified and DlgNotListed are not in the local project folder (only `AppLandingDark` and `AppHomeDark` are). I assumed they mirror the Light boards.
- Whether the sign-up boards draw the two-segment progress bar, and whether AppSignUp2 shows the password line as a hint or an error.
- Whether the Notifications board distinguishes read and unread rows.
- Push cold-start tap routing, and the Android 13+ POST_NOTIFICATIONS permission handling (from the expo-notifications plugin). Both need a device.
- Web browser back and forward and `Linking.openURL` new-tab behaviour (react-native-web behaviour, not exercised).
- Whether an admin session can exist on a store build (code allows a restore; there is no UI to create one there).

## B. Receipt scan flow
Scope: the member receipt flow in `mobile/src/screens/receipts/` (Scan, Review, Success, History), plus what they call:
`api/client.ts` (`scanReceipt`, `submitReceipt`, `receipts`, `receiptImage`, `request`, `ApiError`), `context/AppContext.tsx` (`receipts`, `submitReceipt`, `getReceiptImage`, `loadAll`), `utils/alert.ts` + `utils/alertStore.ts` + `components/common/AppAlertHost.tsx` (all alerts), `components/bento/BentoTabBar.tsx` (Scan button), `navigation/RootNavigator.tsx`, `navigation/motionOptions.ts`, `mobile/app.json` (OS permission strings). Server read only to list what reaches the app: `api/receipts/index.ts`, `api/_lib/fraudChecks.ts`, `api/_lib/http.ts`, `api/_lib/auth.ts`, `api/_lib/scanPipeline.ts`, `api/_lib/receiptExtraction.ts`, `api/_lib/pointsEngine.ts` (`finalizePoints`).

Verified against code on 2026-11-24 (branch `claude/member-store-build`, working tree). Copy is quoted verbatim, including curly apostrophes (’) and the ellipsis (…) where the code uses them.

---

### Shared behaviour across the flow

#### Navigation and stack
- All four screens are root-stack screens that exist only while a member is signed in (`isAuthenticated`). Admin sessions never see them.
- `ScanReceipt` uses `slideUpOptions` (`animation: 'slide_from_bottom'`). `ReceiptSuccess` uses `fadeUpOptions` (`'fade_from_bottom'`). `ReviewReceipt` and `ReceiptHistory` use the default stack push (iOS native push with full-screen swipe-back; Android `ios_from_right`). On web, screens fade in through `ScreenFade` (`webScreenLayout`).
- None of the four screens shows the floating tab bar. They sit above `Main` in the stack.
- Stack sequence for a normal scan: `Main → ScanReceipt → ReviewReceipt`. Submitting **replaces** Review with Success, giving `Main → ScanReceipt → ReceiptSuccess`. A swipe-back or Android back on Success therefore lands on the **camera**, not on Review.
- "Submit Another Receipt" **replaces** Success with a new `ScanReceipt`, giving `Main → ScanReceipt → ScanReceipt`. Two camera screens end up on the stack.

#### Alerts (every dialog in this flow)
- Every alert goes through `showAlert(title, message?, buttons?)`, which is the app's own branded modal (`AppAlertHost`) on iOS, Android and web. It never uses the native `Alert.alert` or `window.alert`.
- With no buttons passed, the alert gets a single **"OK"** button that only dismisses it.
- With exactly two buttons they sit side by side, the action first and the `cancel`-style button last. Any other count stacks.
- Card is 296 pt wide (or window minus 48), over a dimmed scrim (blurred 5 px on web). It scales in from 1.1 with overshoot. Under Reduce Motion it only fades (200 ms).
- The Android hardware back button / `onRequestClose` dismisses the alert **without running any button handler**.

#### Server error plumbing (`api/client.ts` `request`)
- Every call sends `Authorization: Bearer <token>`, `cache: 'no-store'`, JSON body.
- On a non-2xx response the client throws `ApiError(status, data.error)`. When the body is not JSON (for example a Vercel 504 timeout or a 413 page), the message falls back to `` `Request to ${path} failed` ``, which is "Request to /receipts?action=scan failed" for a scan or "Request to /receipts failed" for a submit.
- A network failure or offline device makes `fetch` throw a non-`ApiError`, so every screen shows its own generic fallback copy instead. **There is no dedicated offline state** anywhere in the flow.
- Server-side, any unexpected exception becomes `500 {"error":"Internal server error"}`. That string reaches the member verbatim inside the screen's alert.
- An expired or invalid session returns `401 "Not authenticated"`. The receipt screens show it verbatim in their alert. Nothing logs the member out automatically from these screens.

#### Theme and motion
- Light/dark: Review, Success and History use Bento theme tokens (`t.*`), so they follow the app theme (light/dark/system). The Success hero tile and the History summary tile use `tone="hero"`, which is always the fairway-green brand colour, with white text in both themes.
- The Scan screen is **always dark** (`#0B0F0D` camera ground, white header text, light status bar) in both themes. Only its permission card and Reading sheet use theme tokens (`t.tile`, `t.ink`, `t.muted`, `t.accent`, `t.accentSoft`, `t.track`).
- Reduce Motion is read through `prefersReducedMotion()`. It stops the scan-line sweep, the Reading shimmer, the Success pulse dot, the `PopIn` badge, the `Appear` tile entrances, and `CountUp` (number shown at once). The alert falls back to fade only.

---

#### Scan Receipt (`mobile/src/screens/receipts/ScanReceiptScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** Bento camera chrome matched to the boards (frame and hint positions, 34 pt Reading ring, blurred Close and hint). Torch button on phones (approved addition; `enableTorch`; off whenever the screen loses focus). Camera access denied for good: **Open Settings** (`Linking.openSettings()`) replaces Continue, and the permission is re-read when the app returns to the foreground (phones; web always reports `canAskAgain`). A failed capture or photo pick now shows an alert (was silent). Error alerts use `friendlyError` (technical text → plain message; member-facing server text kept). Everything else below is unchanged.

One screen with four visual modes: **blank** (permission unknown), **Camera permission card**, **Live camera**, **Reading** (processing).

- **Reached from:**
  1. Tab bar centre **Scan** button (`BentoTabBar`, label "Scan", a11y label "Scan receipt"), available on every member tab: Home, Course, MyGolf, Rewards, Activity, Profile. Calls `navigation.navigate('ScanReceipt')`.
  2. Receipt History empty state, button "Scan a receipt".
  3. Activity tab (`RewardsActivityScreen`) empty state, button "Scan a receipt".
  4. Receipt Success, "Submit Another Receipt" (`navigation.replace('ScanReceipt')`).
  5. Back from Review (header Back or "Rescan"): `goBack()` returns to this screen. The camera is live again, and the previous photo is no longer shown.
  6. Back gesture from Receipt Success (because Review was replaced), see Shared behaviour.
  - No deep link, notification tap or Home tile opens this screen. Home only has the text "Scan a receipt to start your chart." with no action, and that belongs to Home's chart.

- **Shows:**
  - **Top bar** (absolute, at safe-area top + 8): left is a dark frosted circle "Close" button (X icon, 42 pt) in Camera and Permission modes. In Reading mode there is an empty spacer and **no close button**. The centre title "Scan Receipt" is white, `navTitle` style, with header role. The right side is an empty 42 pt spacer (there is no flash or torch control).
  - **Camera mode:**
    - Full-screen `CameraView` with the back camera (`facing="back"`).
    - `ScanFrame` overlay (non-interactive):
      - Four lime corner brackets (34 pt, 4 pt stroke, 14 radius). The frame is (window width − 88) wide, `min(432, 50% of window height)` tall, and placed at 19% of window height.
      - A lime 2 pt scan line with a glow. It sweeps up and down (1.6 s each way, bezier 0.45/0/0.55/1, looping) unless Reduce Motion is on, in which case it stays still at the centre.
      - A hint pill reading "Align receipt or QR code". Note: no QR code reading exists in the code. This is copy only.
    - Bottom controls at safe-area bottom + 28:
      - Left: "Upload from gallery" button (52 pt rounded-square glass tile with gallery icon, plus caption "Upload from gallery", 11 pt).
      - Centre: shutter (82 pt white ring, 64 pt lime core). The core shows a spinner while capturing.
      - Right: empty 72 pt spacer.
  - **Permission mode** (camera not granted): over the dark ground, a centred card (`t.tile`, radius 32) shows:
    - Camera icon in an `accentSoft` 72 pt square.
    - Header "Camera access needed".
    - Body "Flagrr needs camera access to scan your receipts and award Flagrr Cash."
    - Primary button "Continue" (with nub).
    - Text button "Upload from gallery instead".
  - **Reading mode** (processing):
    - The chosen photo fills the screen at 55% opacity, blurred (radius 12), under a `rgba(5,10,8,0.45)` veil.
    - The top bar shows no close button.
    - A bottom sheet (`t.tile`, radius 38) contains:
      - A large `ActivityIndicator` (accent) beside "Reading your receipt…"
      - Body "Extracting items, matching golf products and activities, and calculating your Flagrr Cash."
      - Three pulsing shimmer bars (88%, 64%, 76% wide; opacity 1 ↔ 0.55 every 800 ms; static under Reduce Motion).
    - The sheet is an `accessibilityLiveRegion="polite"`.
  - **Blank mode:** while `useCameraPermissions()` has not resolved (`permission === null`), only the dark ground shows, with no spinner.
  - **Data:** no member data is displayed. Status bar is `light-content`.

- **Actions:**

| Control | What it does | When available / conditions |
|---|---|---|
| Close (X, a11y "Close") | `navigation.goBack()` | Camera and Permission modes. Not shown in Reading mode. |
| Shutter (a11y "Scan receipt", `busy`/`disabled` state while capturing) | `takePictureAsync({ quality: 0.9 })`, then `processImage(uri, width, height)` | Camera mode. Disabled while `capturing`. Does nothing if the camera ref is not ready. |
| "Upload from gallery" (camera, a11y "Upload from gallery") | `ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 })`. If the picker is not cancelled, calls `processImage(asset.uri, asset.width, asset.height)`. No crop/edit step. | Camera mode. **Not** disabled while the shutter is capturing. |
| "Continue" (permission card) | `requestPermission()` (expo-camera). The OS prompt shows the app.json string "Flagrr needs camera access to scan your receipts and award Flagrr Cash." On grant, the screen switches to Camera mode. | Permission mode. If permission was denied permanently (`canAskAgain` false), the press does nothing visible. **There is no "Open Settings" path.** |
| "Upload from gallery instead" (permission card) | Same as the gallery button. Works without camera permission. | Permission mode. |
| OS back / swipe-down / swipe-back | Leaves the screen | Any mode, including Reading. Unverified: whether an in-flight scan still navigates to Review after the member has left. |

  - **Image preparation (`prepareForScan`):**
    1. If the long edge is over **1800 px**, the image is resized so the long edge is 1800 (width for landscape, height for portrait).
    2. It is re-encoded as **JPEG at 0.9** compression with base64.
    3. It is sent as `data:image/jpeg;base64,…`.
    4. If encoding returns no base64, the code throws `Error('Failed to encode image')`, which ends in the generic scan-failure alert.
    - Library used: `ImageManipulator.manipulate(...).renderAsync()`, then `saveAsync`.
  - **Gallery permission:** the code never requests photo-library permission. On iOS the app.json `photosPermission` string "Flagrr needs access to your photos so you can upload a receipt to scan." exists for the OS. Unverified whether the OS ever shows it with the system picker.

- **States:**
  - **Loading/processing:** Reading mode, from `processImage` start until the API returns or fails. During camera capture only, the shutter shows a spinner first.
  - **Empty:** not applicable.
  - **Error:** alerts, listed below. After any alert the screen returns to Camera mode (or to Permission mode if not granted), because `scanning` resets in `finally`.
  - **Offline:** the fetch throws, which shows "Couldn’t scan receipt" / "Something went wrong scanning that receipt." There is no offline banner.
  - **Camera permission:**
    - Unresolved: blank dark screen.
    - Not granted (undetermined or denied): permission card.
    - Granted: live camera.
    - Denied forever: the same permission card, but "Continue" is ineffective. Gallery upload still works.
  - **Web vs native:**
    - Same code on both.
    - On web, `CameraView` and `useCameraPermissions` rely on the browser's camera API, the gallery opens the browser file chooser, and `ImageManipulator` runs in the browser (unverified in this pass).
    - On web the alert scrim is blurred. No platform branches exist in this file.
  - **Flagged / approved / rejected / under review:** not applicable here (decided at submit).
  - **Duplicate:** "Already redeemed" alert.
  - **Invalid (not a receipt):** "This is not a valid slip" alert.
  - **Low confidence, away club, non-participating, items not eligible, already earned today, pre-paid:** not shown here. They are passed to Review in `scanResult`.
  - **Light/dark:** the screen is always dark. The card and sheet follow the theme.
  - **Reduce Motion:** the scan line is static and the shimmer is static.

- **Alerts, sheets, toasts:**

| Trigger | Title | Message | Buttons → effect |
|---|---|---|---|
| Camera or picker returned no URI | "Couldn’t read that image" | "Please try again with a different photo." | "OK" → dismiss and stay on camera |
| Server says duplicate (`isDuplicate: true`) | "Already redeemed" | the server `reason`, which is always "This receipt has already been redeemed." today | "OK" → dismiss and stay on camera |
| Server says invalid (`invalid: true`) | "This is not a valid slip" | "Please scan a valid slip." (the app ignores the server's `reason` text) | "Back" (cancel style) → `navigation.goBack()` (closes the scanner). "Try Again" (default) → dismiss and stay on camera. Laid out side by side with Try Again first. Android back dismisses with no navigation. |
| Any thrown error during prepare or scan | "Couldn’t scan receipt" | the `ApiError` message from the server verbatim. A non-`ApiError` shows "Something went wrong scanning that receipt." | "OK" → dismiss and stay on camera |
| Shutter `takePictureAsync` throws | none | none | **The error is not caught** (`try/finally` only), so the member sees no alert and the shutter just re-enables. Same for the gallery picker throwing. |

  - No sheets or toasts.

- **Server calls:**
  - `api.scanReceipt(imageBase64)` → `POST /api/receipts?action=scan` with body `{ imageBase64 }`, called once per photo. This is a preview: nothing is written to the receipts table, but the server caches its extraction for this member and photo hash so the later submit reuses it.
    - `200 { isDuplicate: false, invalid: true, reason: "We couldn't read a valid receipt from that photo. Please scan a valid receipt or slip." }` when no line items **and** no total were found → invalid-slip alert.
    - `200 { isDuplicate: true, reason: "This receipt has already been redeemed." }` when the receipt number exists anywhere (any member, any club) or the identical image hash exists → "Already redeemed" alert. The server also logs the attempt to `receipt_duplicate_attempts`.
    - `200 { isDuplicate: false, invalid: false, … }` → `navigation.navigate('ReviewReceipt', { imageUri, imageBase64, scanResult })`.
      - Payload: `ocrConfidence`, `merchantNameGuess`, `merchant`, `receiptNumber`, `transactionNumber`, `tillNumber`, `date`, `time`, `items[]`, `subtotal`, `vat`, `grandTotal`, `subtotalPoints`, `totalPointsAwarded`, `awayClub`, `nonParticipatingClub`, `pointsBasis`.
      - It also carries `tier` and `tierMultiplier`, which are not in the app type and are ignored.
    - `400 "imageBase64 must be a jpeg/png/webp data URI"` and `400 "Image is too large"` (base64 over 7,000,000 characters) → "Couldn’t scan receipt" with that text.
    - `401 "Not authenticated"` → "Couldn’t scan receipt" / "Not authenticated".
    - `500 "Internal server error"` → same alert with that text.
    - Platform timeout (60 s Vercel limit) or another non-JSON error → "Couldn’t scan receipt" / "Request to /receipts?action=scan failed".
    - Server extraction: Claude vision when `RECEIPT_EXTRACTOR=claude` (25 s timeout, no retries), falling back to Tesseract on any Claude failure. The member never sees which extractor ran.

- **Board coverage:**
  - **AppScan** (Light/Dark): camera mode with frame, hint "Align receipt or QR code", "Upload from gallery", shutter, Close. The board also shows a **"Flash"** button that the code does not have.
  - **AppScanPerm** (Light/Dark): the permission card with all its copy.
  - **AppReading** (Light/Dark): the Reading sheet with all its copy.
  - **DlgUnreadable** (Light/Dark): "Couldn’t read that image" / "Please try again with a different photo.". The board button is **"Try Again"**, but the code shows **"OK"**.
  - **DlgInvalidSlip** (Light/Dark): "This is not a valid slip" / "Please scan a valid slip.". The board shows only **"Try Again"**. The code also has a **"Back"** button that closes the scanner.
  - **DlgAlreadyRedeemed** (Light/Dark): title "Already redeemed" with button "OK". The board message is "This slip has already earned Flagrr Cash.", but the code shows the server reason "This receipt has already been redeemed.".
  - **DlgPhotoPerm** is the **Edit Profile** photo-permission dialog ("Permission needed / Allow photo access in Settings to change your profile photo."). It does **not** belong to this flow, and the scan flow has no equivalent dialog in code.
  - **No board shows:**
    - the blank permission-unresolved screen;
    - the shutter spinner (capturing);
    - the "Couldn’t scan receipt" alert (any variant: server message, generic, "Not authenticated", "Image is too large", "Request to /receipts?action=scan failed", "Internal server error");
    - offline;
    - permission denied forever (and that Continue does nothing / no Settings link);
    - the OS camera permission prompt and its string;
    - the iOS photos permission string;
    - Reading mode without a preview image;
    - web camera or file chooser;
    - the Reduce Motion static scan line and shimmer;
    - the "Back" action of the invalid-slip alert;
    - the uncaught capture or picker failure (no feedback);
    - leaving mid-scan;
    - the gallery button usable during capture.

---

#### Review Receipt (`mobile/src/screens/receipts/ReviewReceiptScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed:** notices without "R1 = 1 FC": between subscriptions "Your club is between subscriptions right now — this slip earns Flagrr Cash at the standard rate." (accent), away club "Not your home club — Flagrr Cash earned at the standard away-club rate." (warn colours, pin icon). "Not eligible for points" is now "Not eligible for Flagrr Cash" (and its footnote). The "—" amount reads "No Flagrr Cash" to screen readers. Submit errors use `friendlyError`. Everything else below is unchanged.

- **Reached from:** only from Scan Receipt after a successful, non-duplicate, valid scan (`navigation.navigate('ReviewReceipt', { imageUri, imageBase64, scanResult })`). No other entry point. It cannot be reopened later.

- **Shows:** `BentoScreen` (scrolling), with a header titled "Review Receipt" and a Back button (label "Back", `goBack()` → camera).
  1. **Notices** (stacked at top, either or both):
     - Low confidence (`scanResult.ocrConfidence < 55`): `warnBg`/`warnInk` box with info icon. Copy: "This scan wasn’t fully clear — some details below may be inaccurate. It’s still been submitted for review."
       - Note: the copy says "submitted", but nothing is submitted yet.
       - On submit, the server flags it as `low_ocr_confidence` (same threshold 55), so the result lands as Under review.
     - Non-participating club (`nonParticipatingClub`, takes precedence over away): `accentSoft` box. Copy: "Your club is between subscriptions right now — Flagrr Cash earned at the standard rate of R1 = 1 FC."
     - Away club (`awayClub` and not non-participating): `accentSoft` box. Copy: "Not your home club — Flagrr Cash earned at the standard away-club rate of R1 = 1 FC."
  2. **Receipt tile** (`Appear` entrance):
     - Thumbnail 72×92, radius 14: the local `imageUri` photo (a11y "Your receipt photo"), or the text "No image captured" if `imageUri` is null.
     - Details (label column min 104 pt, muted; value bold):
       - "Merchant": `merchant.name` → `merchantNameGuess` → "Unrecognized merchant".
       - "Receipt Number": only if `receiptNumber` is present.
       - "Date": only if date or time is present. Shows `[date, time]` joined with " · ". The **raw extracted strings are not reformatted**: Claude returns `YYYY-MM-DD` and `HH:MM`, while Tesseract returns them as printed, for example `23/11/2026` or `Nov 23, 2026` and `12:48 PM`.
     - Eyebrow "Items".
     - If `items.length === 0`: "No line items were recognized on this receipt."
     - Otherwise, one row per item:
       - Description, prefixed `"{quantity}x "` when quantity > 1.
       - A note under the description.
       - An amount on the right.
       - Rules are given below.
     - Footnote when the slip is on items basis and any item has neither a matched product nor a matched activity: "Some items weren’t recognized as eligible golf products or activities, so no points were awarded for them."
     - Footnote when earning on the total:
       - "Flagrr Cash is earned on the slip total, plus the club value of pre-paid items." if any pre-paid line earned;
       - otherwise "Flagrr Cash is earned on the slip total."
     - "Receipt Total" `R{grandTotal.toFixed(2)}`. This row is shown only when `grandTotal` is not null. With no total, the earned row gets the top hairline instead.
     - "Flagrr Cash Earned" `+{totalPointsAwarded} FC`, accent, 30 pt. There is no thousands separator.
  3. Disclaimer: "Extracted details can’t be edited — if something looks wrong, rescan with a clearer photo."
  4. Primary button "Submit Receipt" (with nub, shows a spinner and is disabled while submitting).
  5. Text button "Rescan".

  - **Earning basis.** `earnsOnTotal` is true when the club is away, the club is non-participating, or `pointsBasis === 'total'`. It is false when `pointsBasis === 'items'`, which means no total could be read at the home club.

  - **Item note and amount rules:**

| Case | Condition | Note under item | Amount (right) | Amount colour |
|---|---|---|---|---|
| Pre-paid earning | earnsOnTotal and price 0 and pointsAwarded > 0 | check icon + "Pre-paid · Matched: {matchedName}" (accent) | `+{pointsAwarded} FC` (serif) | accent |
| Already earned today | home club, total basis, not pre-paid, `matchedName` set, and either (price 0 and 0 FC) or (FC < round(price)) | "Already earned on another slip today" (negative, no icon) | `R{price.toFixed(2)}` (for example "R0.00" for a pre-paid repeat) | ink |
| Total basis, other lines | earnsOnTotal, none of the above | no note | `R{price.toFixed(2)}` | ink |
| Items basis, matched | not earnsOnTotal and `matchedName` | check icon + "Matched: {matchedName}" (accent) | `+{pointsAwarded} FC` if > 0, else "—" | accent for +FC, muted for "—" |
| Items basis, not eligible | not earnsOnTotal and no `matchedName` | "Not eligible for points" (negative) | `+{pts} FC` if > 0, else "—" | negative for "—" |

  - The "already earned today" rule is **only detected on total basis at the home club**. On items basis the server's same-day rule still zeroes repeats (`applySameDay`), but the app shows those lines as "Matched: …" with a muted "—".

- **Actions:**

| Control | What it does | When available |
|---|---|---|
| Header Back | `navigation.goBack()` → camera | Always, including while submitting (not disabled). |
| "Submit Receipt" | `submitReceipt(imageBase64, imageUri)` from AppContext. On success: `navigation.replace('ReceiptSuccess', { pointsAwarded: scanResult.totalPointsAwarded, flagged: receipt.flagged })`. On error: alert. | Always. Disabled and shows a spinner while submitting. |
| "Rescan" | `navigation.goBack()` → camera (the photo is discarded) | Always, including while submitting (not disabled). |
| iOS swipe-back / Android back | goBack → camera | Always. |

  - Success receives the **preview's** `totalPointsAwarded`, not the confirmed `receipt.pointsAwarded`. The server re-runs matching and scoring at submit, and does a fresh OCR if the preview cache has expired, so the two figures could differ in edge cases.

- **States:**
  - **Loading:** the Submit button spinner only. There is no full-screen loader.
  - **Empty items:** "No line items were recognized on this receipt." The slip can still be submitted on its total.
  - **Error:** "Couldn’t submit receipt" alert (see below).
  - **Offline:** generic "Something went wrong. Please try again.".
  - **Low confidence:** warn notice.
  - **Away club:** away notice, total basis, R amounts, total footnote.
  - **Non-participating club / between subscriptions:** "between subscriptions" notice, otherwise the same as away.
  - **Items not eligible:** "Not eligible for points" plus the footnote (items basis only).
  - **Already earned today:** shown per line (home-club total basis only).
  - **Pre-paid lines:** pre-paid note, +FC, and the "plus the club value of pre-paid items" footnote.
  - **Flagged / approved / rejected / under review:** not shown here. They are decided at submit.
  - **Camera permission:** not applicable.
  - **Web vs native:** identical code.
  - **Light/dark:** theme tokens throughout. Notices use `warnBg`/`warnInk` and `accentSoft`.
  - **Reduce Motion:** the `Appear` entrance is skipped.

- **Alerts, sheets, toasts:**

| Trigger | Title | Message | Buttons |
|---|---|---|---|
| Submit throws | "Couldn’t submit receipt" | the `ApiError` message verbatim, else "Something went wrong. Please try again." | "OK" → dismiss and stay on Review |

  - Server messages that can appear here:
    - `409` "This receipt has already been redeemed." (duplicate found at submit, or a unique-key race)
    - `422` "We couldn't read a valid receipt from that photo. Please scan a valid receipt or slip." (the submit re-read found nothing)
    - `400` "imageBase64 must be a jpeg/png/webp data URI" or "Image is too large"
    - `401` "Not authenticated"
    - `500` "Internal server error"
    - non-JSON (timeout) "Request to /receipts failed"
  - **Partial-failure quirk:** `submitReceipt` in AppContext first POSTs the receipt, prepends it to the local list, then refreshes `me`, `activity` and `notifications` with `Promise.all`. If any of those three refresh calls fails, the member gets "Couldn’t submit receipt" **even though the receipt was saved**. If they tap Submit again, they get 409 "This receipt has already been redeemed.".

- **Server calls:**
  - `api.submitReceipt({ imageBase64, imageUri })` → `POST /api/receipts` → `201` with the saved `Receipt`. The server never trusts client data: it reuses its own cached preview extraction for this photo hash, or re-reads the photo, then re-scores and re-checks for duplicates.
  - Fraud checks at submit (`evaluateFraudSignals`) set `flagged` if any of these hold:
    - OCR confidence < 55 (`low_ocr_confidence`)
    - awarded FC > 500 (`unusually_high_points`)
    - 5 or more receipts by this member in the last 10 minutes (`rapid_repeat_submissions`)
  - A flagged receipt is saved as `status: 'pending'` with FC **held**. There is no balance change, activity row, member notification or push. Club admins get the notification "Receipt flagged for review".
  - An unflagged receipt is saved as `approved`. The server then:
    - credits the balance and `total_earned`;
    - adds to the monthly points;
    - writes the activity row "Receipt scanned" (subtitle = merchant);
    - writes the member notification "Flagrr Cash earned" with the body "You earned {N} Flagrr Cash from your receipt[ at {merchant}]." plus " Your club is between subscriptions right now, so this was earned at the standard rate." or " Earned at the standard away-club rate." (brand wording changed 24 Nov 2026, owner decision: no "R1 = 1", no "wallet"/"balance");
    - sends the same push (preference category `accountActivity`).
  - Every submit (flagged or not) increments `user_stats.total_receipts_scanned` and sets `last_scan_date`.
  - The app then calls `GET /api/me?…` (with the current stats period), `GET /api/activity` and `GET /api/notifications`. It updates points, user, streak, stats, activity and notifications in context, and prepends the new receipt to `receipts`.

- **Board coverage:**
  - **AppReview** (Light/Dark): standard items-basis review, with merchant, receipt number, date, matched items with +FC, Receipt Total, Flagrr Cash Earned, disclaimer, Submit, Rescan, and Back.
    - The board shows "Date" as "23 Nov 2026" only, while the code shows raw `date · time`.
    - The board's matched items show "+FC" per line, which the code shows only on items basis (no total read). With a total present, the code shows R prices. So this board depicts a state the code reaches only when no total was read, yet the board also shows a Receipt Total. **The board is inconsistent with the code.**
  - **AppReviewIssues** (Light/Dark): one matched line, one "Already earned on another slip today" with "—", one "Not eligible for points" with "—", the unmatched footnote, and a total.
    - In code, "Already earned…" and "Not eligible…" **cannot appear on the same slip**: the first needs total basis, the second items basis.
    - In code, an "already earned" line shows `R{price}` in ink, not "—".
  - **AppReviewAway** (Light/Dark): the away notice, R-priced lines, "Flagrr Cash is earned on the slip total.", total, earned.
  - **No board shows:**
    - the low-confidence notice;
    - the non-participating "between subscriptions" notice;
    - both notices together;
    - pre-paid lines ("Pre-paid · Matched: …") and the "plus the club value of pre-paid items" footnote;
    - home-club total-basis review (R prices, no notice) and "already earned" shown as an R amount;
    - "Unrecognized merchant";
    - "No image captured" thumbnail;
    - "No line items were recognized on this receipt.";
    - no Receipt Total (earned row with its own hairline);
    - missing receipt number or date rows;
    - date with time ("· 12:48");
    - quantity prefix on a non-board item;
    - items-basis matched line with "—";
    - the Submit loading state;
    - the "Couldn’t submit receipt" alert (all variants, including 409 / 422 / 401 / 500 / "Request to /receipts failed");
    - the partial-failure quirk;
    - Reduce Motion.

---

#### Receipt Success (`mobile/src/screens/receipts/ReceiptSuccessScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed:** the button is **View My Flagrr Cash** (still `popTo` Home), followed 450 ms later by a "Receipt submitted" toast (flagged: "+N FC once your club approves it"); no toast after Submit Another Receipt. Approved copy: "N Flagrr Cash added and ready to spend." and the info tile "Your new Flagrr Cash is ready to redeem on rewards at your club."; flagged copy: "…will be added to your Flagrr Cash — …" (no "wallet" or "balance", kept-board wording). Everything else below is unchanged.

- **Reached from:** only from Review Receipt after a successful submit (`navigation.replace`). Params: `{ pointsAwarded: number; flagged?: boolean }`.

- **Shows:** `BentoScreen` with **no header, title or back button**.
  1. **Hero tile** (fairway green, always dark):
     - **Badge:** a 160 pt "burst" of 16 lime rays (55% opacity), with an 84 pt lime circle holding a fairway check icon. The circle pops in from scale 0.4 after 150 ms (`PopIn`).
     - **Eyebrow:** "Your reward", in lime.
     - **Amount:** `+{pointsAwarded} FC`, white, 64 pt. It animates as a count-up (`CountUp`), which re-runs each time the screen regains focus. A11y label `"{pointsAwarded} Flagrr Cash"`.
     - **Header:** "Submitted successfully!"
     - **If flagged:** a pill with a pulsing lime dot (opacity 1 ↔ 0.45, 1.2 s; static under Reduce Motion) and "Your receipt is being reviewed".
     - **If not flagged:** "+{pointsAwarded} Flagrr Cash have been added to your wallet!"
  2. **Info tile:**
     - Icon square: flagged is an `info` icon on `warnBg`/`warnInk`; not flagged is a `receipt` icon on `accentSoft`/accent.
     - Flagged text: "This receipt was flagged for manual review. Once approved, {pointsAwarded} Flagrr Cash will be added to your balance — no action is needed from you. You can check its status anytime under Profile > Receipt History."
     - Not-flagged text (two paragraphs): "Your new Flagrr Cash balance is now available in your wallet and ready to redeem on rewards." then a blank line, then "Play more rounds, scan your receipts, and redeem rewards to unlock higher membership tiers and exclusive benefits."
  3. Button "View Current Balance" (primary, nub).
  4. Button "Submit Another Receipt" (secondary).

  - The amount is the **preview** figure from Review, not the server-confirmed one.
  - Copy uses "wallet", the word the current code uses. It is not checked here against the Brand Kit.

- **Actions:**

| Control | What it does | When |
|---|---|---|
| "View Current Balance" | `navigation.navigate('Main')`. It pops back to the tab navigator on whichever tab was last active. It does **not** force the Home tab or the balance. | Always |
| "Submit Another Receipt" | `navigation.replace('ScanReceipt')` (new camera screen; the earlier camera screen stays underneath) | Always |
| Swipe-back / Android back | Returns to the earlier Scan Receipt camera screen | Always (no back control is drawn) |

- **States:**
  - **Approved (not flagged)**
  - **Flagged / under review**
  - **Zero FC:** `+0 FC` and "+0 Flagrr Cash have been added to your wallet!", which has no special handling.
  - **Light/dark:** the hero tile is always green. The info tile follows the theme.
  - **Reduce Motion:** no pop, count-up or pulse.
  - **Web vs native:** identical code.
  - No loading, error or offline states, because the screen makes no calls.

- **Alerts, sheets, toasts:** none.
- **Server calls:** none. Context data was already refreshed by `submitReceipt`.

- **Board coverage:**
  - **AppSuccess** (Light/Dark) shows the **flagged** variant: burst, check, "Your reward", "+196 FC", "Submitted successfully!", the "Your receipt is being reviewed" pill, and both buttons.
  - The board **adds a streak element** ("This week counts for your streak", "6 of 8 weeks") that the code does not have.
  - The board **omits the info tile entirely**.
  - **No board shows:**
    - the not-flagged variant ("+N Flagrr Cash have been added to your wallet!");
    - the not-flagged info tile copy (both paragraphs);
    - the flagged info tile copy ("This receipt was flagged for manual review…Profile > Receipt History.");
    - the count-up re-running on refocus;
    - the back-gesture-to-camera behaviour;
    - "View Current Balance" landing on the last-used tab;
    - Reduce Motion.

---

#### Receipt History (`mobile/src/screens/receipts/ReceiptHistoryScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed:** the list is fetched again (`GET /api/receipts`) every time the screen gains focus; the loaded list stays on show while it refreshes and if the refresh fails (no alert). The photo opens **full screen** (was a sheet): X, a tap anywhere or system back closes it. Status pills use `StatusPill`; View Photo has an eye icon with an 18 pt ring while loading. The `receiptId` param still opens that receipt's photo. Everything else below is unchanged.

- **Reached from:**
  1. Profile tab (`MemberProfileScreen`), row "Receipt History" (receipt icon).
  2. Text pointer only (not a link) in the Success flagged copy: "Profile > Receipt History".
  - No notification tap, deep link or other button opens it.

- **Shows:** `BentoScreen` with title "Receipt History" and Back (`goBack()`). Data comes from `receipts` in AppContext, loaded by `GET /api/receipts` in `loadAll` (app start with a stored token, login, signup, home-club change) and prepended locally after each submit. The server orders by `submitted_at desc`, and **all** of the member's receipts are returned and rendered (no paging).
  - **Empty** (`receipts.length === 0`), in a tile:
    - receipt icon in a 64 pt `accentSoft` square;
    - "No receipts yet";
    - "No receipts yet — scan one from the Home screen to get started.";
    - button "Scan a receipt" (compact, nub).
    - Note: the copy says "from the Home screen", but scanning is actually started from the tab-bar Scan button.
  - **Summary tile** (hero green):
    - Left: "Earned from receipts · {Month}", where Month is the current month's full name in the device locale (for example "November"). Below it, `{earned.toLocaleString()} FC` at 30 pt, white.
      - `earned` is the sum of `pointsAwarded` over receipts with `status === 'approved'` whose `submittedAt` falls in the current calendar month **in device-local time**.
    - Right: `{count}` (lime) above "receipt" or "receipts" (singular when exactly 1).
      - `count` is all receipts submitted this month, any status.
  - **List tile**, one row per receipt (hairline between rows):
    - receipt icon in a 40 pt `accentSoft` square;
    - **Title:** `courseName` (merchant name stored at submit), or "Unrecognized merchant"; max 2 lines.
    - **Subline:** `{formatDate(submittedAt)} · R{total.toFixed(2)}`.
      - `formatDate` uses `toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })`. That is device locale and time zone, for example "Nov 23, 2026, 12:48 PM".
      - `total` is the slip grand total, or **0 when no total was read** (server stores `grandTotal ?? 0`), which shows "R0.00".
    - **Right side:**
      - Approved with a non-null `pointsAwarded`: `+{pointsAwarded.toLocaleString()} FC` (serif, accent, tabular).
      - Approved with null points: pill "Approved" (`accentSoft`/accent).
      - Rejected: pill "Rejected" (`seg` background / negative).
      - Pending and flagged: pill "Under review" (`warnBg`/`warnInk`).
      - Pending and not flagged: pill "Pending" (warn colours). Any unknown status shows its raw status string.
    - **Lines under the row** (indented 52):
      - If not approved and `pointsAwarded` is not null: `"{N} FC pending"` when the status is pending, otherwise `"{N} FC earned"`. Note: a **rejected** receipt therefore reads "N FC earned".
      - If flagged and pending: "Flagged for manual review ({reason}) — your Flagrr Cash will be added once it's approved." (straight apostrophe in "it's").
      - If flagged and not pending (approved or rejected): "Flagged for manual review ({reason}) — your Flagrr Cash has already been credited, no action is needed." Note: this is also shown for rejected receipts and for receipts approved after review.
      - The " ({reason})" part is omitted when there is no reason. `reason` is a comma-joined list of "low OCR confidence", "unusually high Flagrr Cash awarded" and "rapid repeat submissions", mapped from the codes in `describeFraudReasons`.
      - "View Photo" link (gallery icon + text, accent, a11y label `"View photo of {courseName || 'receipt'}"`). It is replaced by a small spinner while that row's photo loads, and is disabled during the load.
  - **Photo sheet** (`BentoSheet`):
    - Title "Receipt Photo".
    - Subtitle `"{courseName || 'Unrecognized merchant'} · {formatDate(submittedAt)}"`, then, if `pointsAwarded` is not null, `" · {+ if approved}{pointsAwarded} FC"`. For example "… · 120 FC" for pending or rejected, and "… · +120 FC" for approved.
    - Body: the stored image (server `image_data` data URI) at full width × 55% of window height, `contain`, radius 18, `seg` background, a11y "Receipt photo". If no image is stored, it shows "No photo was saved for this receipt."
    - Closed by the sheet's Close (X) button, by tapping the backdrop (a11y "Close"), or by the system back gesture.

- **Actions:**

| Control | What it does | When |
|---|---|---|
| Header Back | `goBack()` | Always |
| "Scan a receipt" | `navigation.navigate('ScanReceipt')` | Empty state only |
| "View Photo" (per row) | `getReceiptImage(id)` → `GET /api/receipts?action=image&id={id}`, then opens the sheet | Every row. Disabled while that row's photo is loading. |
| Sheet Close / backdrop / back | `setPhotoModal(null)` | While the sheet is open |

  - There is **no pull-to-refresh** and no refetch on focus. A receipt approved or rejected by an admin after submission keeps its old status here until the next `loadAll`: app relaunch, login, or home-club change.
  - There is no tap action on the row itself, no filter, search or paging, and no way to open a receipt's line items. `items`, `receiptNumber`, `transactionNumber`, `tillNumber`, `receiptTime`, `ocrConfidence`, `subtotal` and `tax` are loaded but **not displayed** anywhere in the member app.

- **States:**
  - **Empty**
  - **List**
  - **Per-row:** approved with FC, approved without FC, pending, under review (flagged pending), rejected (with or without flagged note), flagged and approved (credited note), no merchant ("Unrecognized merchant"), no total ("R0.00").
  - **Photo:** loading (row spinner), loaded, no photo saved, error alert.
  - **Offline:** the list shows whatever was last loaded. "View Photo" fails with the alert.
  - **Light/dark:** the summary tile is always green; everything else follows the theme.
  - **Reduce Motion:** tile `Appear` entrances and sheet animation are reduced (sheet behaviour per `BentoSheet`).
  - **Web vs native:** identical code.

- **Alerts, sheets, toasts:**

| Trigger | Title | Message | Buttons |
|---|---|---|---|
| `getReceiptImage` throws (any error: 404 "Receipt not found", 401, 500, offline) | "Couldn’t load photo" | "Something went wrong. Please try again." (server text is never shown) | "OK" → dismiss |

  - Sheet: "Receipt Photo" (as above).

- **Server calls:**
  - `api.receipts()` → `GET /api/receipts`, called in `loadAll` only (not by this screen). Errors there are part of app start or login handling, outside this area.
    - Server serialises each row as `{ id, imageUri, status, courseName, items[{label, amount}], subtotal, tax, total, submittedAt, pointsAwarded, receiptNumber, transactionNumber, tillNumber, receiptTime, ocrConfidence, flagged, flagReason }`, with `flagReason` already converted to readable labels.
  - `api.receiptImage(id)` → `GET /api/receipts?action=image&id=…`, called on "View Photo". Scoped to the member's own receipt: `404 "Receipt not found"` otherwise, and `400 "id is required"` if no id is given. Returns `{ imageData: string | null }`.
  - How status changes happen (server, admin-driven; shown only after reload):
    - An admin approving a held receipt sets it to `approved`, credits FC, and sends the member notification and push "Receipt approved": "Your receipt[ at X] was reviewed and approved. N Flagrr Cash has been added." (brand wording changed 24 Nov 2026, owner decision: no "R1 = 1", no "wallet"/"balance")
    - Confirming fraud sets it to `rejected` and sends "Receipt rejected": "A receipt you submitted[ at X] was confirmed as fraudulent: {admin reason}[ N Flagrr Cash awarded for it has been reversed.]" (brand wording changed 24 Nov 2026, owner decision: no "R1 = 1", no "wallet"/"balance")
    - Those notifications belong to the Notifications area.

- **Board coverage:**
  - **AppReceipts** (Light/Dark): summary ("Earned from receipts · November", "4 210 FC", "5 receipts"), and rows with "Under review" pill, "+FC" rows and "View Photo".
    - The board's date format is "Today" or "21 Nov" without year or time, while the code shows locale `Nov 21, 2026, 4:02 PM`.
    - The board's thousands use a space ("4 210", "R1 450.00"), while the code uses `toLocaleString` for FC (locale-dependent) and **no grouping** for rands (`toFixed(2)`, so "R1450.00").
    - The board omits the flagged explanation line under the "Under review" row.
  - **AppReceiptsEmpty** (Light/Dark): the empty state with all its copy.
  - **DlgPhoto** (Light/Dark): the "Receipt Photo" sheet with an image and the subtitle "Pro Shop · Sat 21 Nov · +1 450 FC". The code's date format differs, as above.
  - **No board shows:**
    - the "Approved" pill (approved with no FC);
    - the "Rejected" pill;
    - the "Pending" pill (unflagged pending);
    - the "{N} FC pending" / "{N} FC earned" sublines;
    - both "Flagged for manual review (…)" explanation lines and the reason labels;
    - "Unrecognized merchant";
    - the "R0.00" no-total row;
    - the per-row photo loading spinner;
    - the "No photo was saved for this receipt." sheet body;
    - the "Couldn’t load photo" alert;
    - the sheet subtitle for non-approved receipts (no "+");
    - "receipt" singular;
    - a 0 FC month;
    - stale status (no refresh);
    - Reduce Motion.

---

### Not on any board

Items appear in roughly flow order. "Board differs" items are included where the board contradicts the code and could cause functionality or copy to be lost.

1. Scan: blank dark screen while camera permission is unresolved.
2. Scan: OS camera permission prompt and its app.json string "Flagrr needs camera access to scan your receipts and award Flagrr Cash."
3. Scan: permission denied forever. "Continue" does nothing and there is no Settings link (behaviour gap).
4. Scan: "Upload from gallery instead" working without camera permission (the board shows the button but not the result path).
5. Scan: iOS photos permission string "Flagrr needs access to your photos so you can upload a receipt to scan."
6. Scan: shutter capturing state (spinner in the lime core, button disabled, `busy` a11y state).
7. Scan: gallery button still usable while the shutter is capturing.
8. Scan: image preparation (resize to 1800 px long edge, JPEG 0.9, base64 data URI). Invisible but must be kept.
9. Scan: no close button during Reading. Leaving mid-scan by gesture has unverified results.
10. Scan: Reading mode without a preview image.
11. Scan: Reduce Motion (scan line static at centre, shimmer static).
12. Scan: the "Align receipt or QR code" hint claims QR support that does not exist in code.
13. Scan: web camera (browser permission) and web file chooser for gallery upload.
14. Scan: board shows a "Flash" control that the code does not have (board differs).
15. Dialog "Couldn’t scan receipt" with the server message verbatim.
16. Dialog "Couldn’t scan receipt" / "Something went wrong scanning that receipt." (network, offline, encode failure).
17. Dialog "Couldn’t scan receipt" / "Not authenticated" (401).
18. Dialog "Couldn’t scan receipt" / "Image is too large" or "imageBase64 must be a jpeg/png/webp data URI" (400).
19. Dialog "Couldn’t scan receipt" / "Internal server error" (500).
20. Dialog "Couldn’t scan receipt" / "Request to /receipts?action=scan failed" (timeout or non-JSON).
21. Invalid-slip dialog "Back" button, which closes the scanner (the board shows only "Try Again").
22. Unreadable-image dialog button is "OK" in code, not "Try Again" (board differs).
23. Already-redeemed dialog message in code is the server's "This receipt has already been redeemed.", not "This slip has already earned Flagrr Cash." (board differs).
24. Android back on any alert dismisses without running a button handler.
25. Uncaught camera capture or picker failure: no feedback to the member.
26. Offline state anywhere in the flow (none is designed or coded beyond the generic alerts).
27. Review: low-confidence notice "This scan wasn’t fully clear — some details below may be inaccurate. It’s still been submitted for review."
28. Review: non-participating club notice "Your club is between subscriptions right now — Flagrr Cash earned at the standard rate of R1 = 1 FC."
29. Review: low-confidence and club notices stacked together.
30. Review: home-club total-basis review (R prices per line, no notice, "Flagrr Cash is earned on the slip total.").
31. Review: pre-paid line "Pre-paid · Matched: {name}" with +FC.
32. Review: footnote "Flagrr Cash is earned on the slip total, plus the club value of pre-paid items."
33. Review: "already earned today" line showing an R amount (code) rather than "—" (board differs). It also never appears on the same slip as "Not eligible".
34. Review: items-basis matched line with 0 FC shown as muted "—" (including same-day repeats on items basis).
35. Review: "Unrecognized merchant" fallback.
36. Review: "No image captured" thumbnail.
37. Review: "No line items were recognized on this receipt."
38. Review: no Receipt Total row (the earned row takes the hairline).
39. Review: Receipt Number row and/or Date row absent.
40. Review: Date row with raw extracted formats and " · time".
41. Review: Submit Receipt loading state (spinner, disabled), with Back and Rescan still active during it.
42. Dialog "Couldn’t submit receipt" with the server message (409 "This receipt has already been redeemed.").
43. Dialog "Couldn’t submit receipt" (422 "We couldn't read a valid receipt from that photo. Please scan a valid receipt or slip.").
44. Dialog "Couldn’t submit receipt" (401 / 400 / 500 / "Request to /receipts failed").
45. Dialog "Couldn’t submit receipt" / "Something went wrong. Please try again." (network or offline).
46. Submit partial failure: receipt saved but a refresh call failed, so the error alert shows and a retry hits 409.
47. Review: Reduce Motion (no Appear entrance).
48. Review data received but not shown: transaction number, till number, subtotal, VAT, subtotalPoints, tier, tierMultiplier.
49. Success: not-flagged variant "+{N} Flagrr Cash have been added to your wallet!"
50. Success: info tile, not-flagged copy (both paragraphs).
51. Success: info tile, flagged copy "This receipt was flagged for manual review. Once approved, {N} Flagrr Cash will be added to your balance — no action is needed from you. You can check its status anytime under Profile > Receipt History."
52. Success: count-up re-runs on refocus. Reduce Motion: no pop, count-up or pulse.
53. Success: back gesture returns to the camera (Review was replaced). "Submit Another Receipt" stacks a second camera screen.
54. Success: "View Current Balance" returns to the last-used tab, not necessarily Home.
55. Success: board's streak element ("This week counts for your streak", "6 of 8 weeks") does not exist in code (board differs).
56. Success: shows the preview FC figure, not the server-confirmed figure.
57. Server side effects of submit: notification and push "Flagrr Cash earned" (with away or between-subscriptions suffix), activity row "Receipt scanned", stats counter. For flagged receipts, admin notification "Receipt flagged for review" and FC held.
58. History: "Approved" pill (approved with no FC value).
59. History: "Rejected" pill.
60. History: "Pending" pill (unflagged pending) and raw-status fallback.
61. History: "{N} FC pending" subline.
62. History: "{N} FC earned" subline (shown even for rejected receipts).
63. History: "Flagged for manual review ({reason}) — your Flagrr Cash will be added once it's approved."
64. History: "Flagged for manual review ({reason}) — your Flagrr Cash has already been credited, no action is needed." (also shown for rejected).
65. History: flag reason labels "low OCR confidence", "unusually high Flagrr Cash awarded", "rapid repeat submissions".
66. History: "Unrecognized merchant" row title.
67. History: "R0.00" row when no total was read.
68. History: actual date format (device locale with year and time) and rand amounts without thousands grouping (board differs).
69. History: summary rules (approved-only FC this calendar month in device time; count of all statuses; "receipt" singular; 0 FC month).
70. History: per-row "View Photo" loading spinner and disabled state.
71. History sheet: "No photo was saved for this receipt."
72. History sheet: subtitle for non-approved receipts ("· N FC" without "+").
73. History sheet: close by backdrop tap and system back (beyond the X button).
74. Dialog "Couldn’t load photo" / "Something went wrong. Please try again."
75. History: no pull-to-refresh and no refetch on focus, so statuses stay stale after admin approval or rejection until relaunch, login or club change.
76. History: unbounded list (all receipts, no paging).
77. History: Reduce Motion.
78. History empty-state copy points to "the Home screen", but scanning starts from the tab-bar Scan button (copy mismatch, on board as-is).
79. Entry points: Activity-tab empty-state "Scan a receipt" button and the Profile "Receipt History" row (they belong to other areas' boards, but neither the link nor the navigation is shown on any scan-flow board).
80. Dark variants: canvas.json lists Dark boards for every scan-flow board, but only Light `.dc.html` files exist locally. Dark-board contents were **not inspected**.

---

### Could not verify (static reading only; nothing was run)
- What happens if the member leaves Scan during Reading: whether `navigation.navigate('ReviewReceipt')` still fires from the unmounted screen.
- Web behaviour of `CameraView`, `useCameraPermissions`, `ImagePicker` and `ImageManipulator` (browser prompts, desktop without a camera).
- Whether iOS ever shows the photos-permission string for `launchImageLibraryAsync` (system picker).
- Dark-variant board contents (files not present locally; titles only, from canvas.json).
- `BentoSheet` Reduce Motion specifics (only its use of `prefersReducedMotion` was confirmed).
- Exact rendered locale output of `toLocaleDateString` and `toLocaleString` on device versus web.

## C. Rewards, Voucher and Reward Activity
Scope: `mobile/src/screens/rewards/RewardsShopScreen.tsx`, `VoucherScreen.tsx`, `RewardsActivityScreen.tsx`, plus what they call: `context/AppContext.tsx` (`rewards`, `vouchers`, `activity`, `points`, `user`, `ads`, `redeemReward`, `logAdClick`, `logAdImpression`), `api/client.ts` (`rewards`, `redeem`, `vouchers`, `activity`, `me`, `notifications`, `logAdClick`, `logAdImpression`), the server handlers `api/rewards/index.ts`, `api/redeem.ts`, `api/vouchers/index.ts`, `api/activity/index.ts`, and the shared parts they render (`components/common/AdSpace.tsx`, `components/common/AppAlertHost.tsx` via `utils/alert.ts`, `components/bento/BentoSheet.tsx`, `BentoScreen.tsx`, `motion.tsx`, `primitives.tsx`).

Verified against the code on branch `claude/member-store-build` (working tree, 2026-11-24). Copy is quoted exactly, including straight vs curly apostrophes. "Board" = the Bento canvas boards named in the brief. Dark board files other than `DlgRedeemDark` are listed in `canvas.json` but are not on disk, so the dark boards' content is **unverified** (assumed to mirror the light board).

### Data that all three screens share (AppContext)

| Data | Loaded by | When | Refreshed |
|---|---|---|---|
| `rewards: Reward[]` | `GET /api/rewards` | `loadAll()` (app start with a stored token, login, signup, `changeHomeClub`) | Only on `loadAll()`. Not refetched on focus, after redeem, or by pull-to-refresh (none of the three screens has a refresh control). |
| `vouchers: Voucher[]` | `GET /api/vouchers` | `loadAll()` | `loadAll()`; after a successful redeem the new voucher is **prepended locally** (list is not refetched). Status changes made by club staff (validated) do not show until the next `loadAll()`. |
| `activity: ActivityEntry[]` | `GET /api/activity` (latest 100, newest first) | `loadAll()` | `loadAll()`, after a redeem, after a receipt submit. |
| `points` (`balance` etc.), `user` (`homeClub`, `isPlaceholderClub`, `verifiedMember`), `ads` | `GET /api/me?period=…` | `loadAll()` (period `year`) | After redeem / receipt submit (with the current stats period). |

- No loading UI exists on these screens: the whole app only becomes authenticated after `loadAll()` resolves, so the screens always render with data present (possibly empty arrays). If `loadAll()` throws on start-up the member is signed out (token cleared); on login the error surfaces on the login screen (outside this area).
- Logout clears rewards, vouchers and activity to `[]`.
- `changeHomeClub` re-runs `loadAll()`, so the catalogue, ads and vouchers list switch to the new club.

#### Server: catalogue (`GET /api/rewards`)
- Auth required (401 "Not authenticated"). Only `GET` (405 "Method not allowed").
- Returns rewards where `course_id` = member's course and `active = true`, joined to **active** variants only; a reward with no active variant is not returned.
- Each reward: `id, title, description, imageUrl (may be null), category, variants[{id, label, randValue, cost}]`, variants ordered by `sort_order`.
- Rewards sorted by **first variant's cost, ascending** (ties keep title order).
- `randValue` is returned but **never displayed** anywhere in the member app.

#### Server: vouchers (`GET /api/vouchers`)
- All of the member's vouchers, newest `issued_at` first: `id, rewardId, rewardTitle ('' if the reward row is gone), variantLabel, cost, code, status ('active'|'redeemed'|'expired'), qrValue, issuedAt, expiresAt`.
- `expires_at` defaults to issue time + 90 days. Nothing ever sets `status = 'expired'` (no job; see Known Limitations "Nothing cleans up"), so in practice only `active` and `redeemed` occur; a past-expiry voucher stays `active` in the app. Staff validation sets `redeemed` (and refuses expired-by-date vouchers server-side with 409 "This voucher has expired").

#### Server: activity (`GET /api/activity`)
- Latest **100** rows, `date desc`: `id, type ('earn'|'redeem'), title, subtitle, amount, voucherId|null, date`.
- Row sources (title / subtitle / amount / voucher):
  - Receipt credited: `earn`, "Receipt scanned", club name, +FC, no voucher.
  - Flagged receipt approved later: `earn`, "Receipt scanned", club name or null, +FC.
  - Streak bonus: `earn`, "Streak bonus", "{n}-week streak", +FC.
  - Birthday: `earn`, "Birthday reward", "{tier} tier birthday bonus", +FC.
  - Gift by admin: `earn`, "Flagrr Cash gifted", reason, +FC. Negative adjustment: `redeem`, "Flagrr Cash adjusted", reason, −FC, no voucher.
  - Fraud reversal: `redeem`, "Receipt rejected", "Flagrr Cash reversed", −FC, no voucher.
  - Shop redeem: `redeem`, "{Title} redeemed" or "{Title} ({Label}) redeemed", "Reward voucher", −cost, voucher id.
  - Quarterly tier bar voucher: `redeem`, "{tier} Tier Bar Voucher (R100|R200)", "Free with your tier", **0**, voucher id.
- `subtitle` is fetched but **not shown** on the Reward Activity screen.

---

#### Rewards Shop (`mobile/src/screens/rewards/RewardsShopScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** Bento styling from the main boards (tags, 40 pt Redeem Now, 38 pt filter pills, all as minimum heights). The header Flagrr Cash is a button that opens Member Tiers (approved addition; label unchanged, hint "Opens Member Tiers"). Option chips are outlined pills that wrap. The sheet says **Left to spend** (was "Balance after"); while redeeming its × is dimmed and disabled (board G-C-RedeemBusy; it was already ignored). After a successful redeem a "Reward redeemed" / "Show the voucher at the club" toast shows (prototype wording, owner-approved toast). A failed redeem shows a "Couldn’t redeem" alert with `friendlyError` (was silent; owner decision); after a partial failure (voucher issued, refresh failed) the voucher opens (was: stayed on the shop). Everything else below is unchanged.

- **Reached from:**
  - Tab bar tab **Rewards** (icon `rewards`, label "Rewards"), in the 4-tab bar (Home, Course | Scan | Rewards, Profile) since 1.1.0 (1.0.1: six tabs). Tab screens stay mounted, so search text, category and per-card option choice persist while switching tabs.
  - Home: the hero **Redeem** button (accessibility label "Redeem Flagrr Cash").
  - Home: Rewards preview header link **View All**.
  - Home: tapping any of the first 5 reward mini-cards in the Rewards preview (opens the shop, not a specific reward).
  - Voucher screen **Back to Rewards** (navigates to `Main`; see Voucher, it lands on whichever tab was last active).
  - No deep link (the app has no linking config; the `flagrr://voucher/…` scheme is only the QR payload).
- **Shows:**
  - Header row:
    - Eyebrow (uppercase, 12 pt, muted, one line): `user.homeClub` (club name); hidden when empty.
    - H1 "Rewards Shop".
    - Right: Flagrr Cash balance `points.balance` as a count-up number (22 pt, locale digit grouping), counting up from 0 on mount and **again every time the tab regains focus**; below it "FC to spend" (13 pt muted). The group is one accessibility element: "{balance with grouping} Flagrr Cash to spend". Not tappable.
  - When the catalogue is **empty** (`rewards.length === 0`): the empty card (see States) then the ad slot. Search and filters are hidden.
  - Otherwise:
    - Search field: placeholder "Search rewards…", accessibility label "Search rewards", search icon on the right (decorative, not a button), keyboard return key "search" (no submit action; filtering is live as you type). No clear (×) button.
    - Category filter pills (horizontal scroller, bleeds to the screen edges, no scroll indicator): "All" first, then one pill per category **that has at least one reward**, in the fixed order Rounds, Dining, Practice, Pro Shop, Experiences (labels from `REWARD_CATEGORY_LABELS`: `rounds` "Rounds", `dining` "Dining", `practice` "Practice", `pro-shop` "Pro Shop", `experiences` "Experiences"). Active pill: accent fill, accent-ink text, no border; inactive: tile fill, hairline border. Accessibility: role button, `selected` state.
    - Results grid: rewards that pass both filters, **two cards per row**, rows equal height; an odd last card gets an empty half-width spacer.
    - Ad slot (`AdSpace placement="rewardsShop"`) **after the first row only** (spans the grid). Not shown when there are no results.
  - Reward card (`ShopCard`):
    - Photo 112 pt tall (`reward.imageUrl`, cover crop) with a parallax drift (±10 pt against scroll). If there is no `imageUrl` or the image fails to load: fairway-green panel with a lime `rewards` line icon (34 pt).
    - Category tag top-left over the photo: pill, `rgba(31,66,52,0.85)` with lime 11 pt text, e.g. "Pro Shop".
    - Title (16 pt semibold, max 2 lines).
    - Description (13 pt muted, max 2 lines), hidden when empty.
    - Option chips only when the reward has **more than one** variant: one chip per variant `label` (e.g. "R1000", "R750"), first selected by default; selected chip accent fill / accent-ink text, others segment fill. Accessibility: group role `radiogroup` labelled "{title} options"; each chip role `radio` with `selected`/`checked`. Selection is per card and local (lost if the card remounts, e.g. when filtering moves it into a different row).
    - Cost of the **selected** variant: number (18 pt, locale grouping) + "FC".
    - **Redeem Now** button (lime fill, fairway text, `arrowUpRight` icon), press-scale feedback. Accessibility label "Redeem {title}" or, for a non-"Standard" variant, "Redeem {title} {label}".
    - A reward with zero variants renders nothing (cannot happen from the API, which only returns rewards with an active variant).
  - Ad slot (`AdSpace`), same component as Home:
    - Ads = `me.ads` filtered to placement `rewardsShop` (club's own + global, server order).
    - No ad: 180 pt box, dark-green fill, lime "Ad Space" text, **no** "SPONSORED" label (owner decision 24 Nov 2026: from the 1.1.0 store build the empty slot is not shown at all).
    - Real ad: "SPONSORED" label (12 pt, muted, letter-spaced) above a 180 pt rounded box. Image/GIF: cover. Video: muted, autoplay, `cover`, no controls; loops only when it is the only ad. Ad with no media: box with the ad's title (or "Ad Space").
    - Several ads: rotate every 6 s (images/GIFs) or at video end; dots at the bottom (active dot wider/white). Rotation and impression logging pause while the tab is not focused.
    - With a `targetUrl`: the whole box is a link (accessibility role link, label = ad title or "Advertisement"); tap logs a click and opens the URL externally. Without a URL: not tappable.
    - The ad never animates (not wrapped in Appear).
- **Actions:**

| Control | What it does | When available / conditions |
|---|---|---|
| Search field (typing) | Filters the grid live: case-insensitive, trimmed substring match on **title only** (not description or category), combined (AND) with the category filter. | Only when the catalogue is not empty. |
| "All" pill | Sets category to All. | Catalogue not empty. |
| Category pill | Sets that category; tapping the **active** pill again toggles back to All. | Only categories with rewards are shown. |
| Option chip | Selects that variant on that card; cost and the Redeem target change. | Reward has 2+ variants. |
| **Redeem Now** (card) | Looks up the selected variant. If `points.balance < variant.cost` (client-side check against the cached balance): shows the **Not enough Flagrr Cash** alert and stops. Otherwise opens the **Redeem reward?** sheet for that reward + variant. No server call yet. | Always enabled (no disabled/greyed state for unaffordable rewards; no verified-member gate). |
| Sheet **Redeem Now** | Shows a spinner in the button and disables it; calls `redeemReward(rewardId, variantId)`; then closes the sheet; if a voucher came back, navigates to `Voucher` with `{ voucherId }` (fade-from-bottom). If `null` (any failure), the sheet just closes: **no error message**. | Sheet open. |
| Sheet **Cancel** (text button) | Closes the sheet. | Disabled while redeeming. |
| Sheet close (×), backdrop tap, Android back | Close the sheet (`onClose`). | Ignored while redeeming. |
| Empty card **Contact Support** | `navigation.navigate('Contact')` (ContactScreen, member enquiry form). | Placeholder club with an empty catalogue only. |
| Popup **Contact Support** | Dismisses the alert, navigates to `Contact`. | Placeholder club, on every focus. |
| Popup **Close** | Dismisses the alert. | Same. |
| Ad tap | `POST /api/profile?action=adClick` (fire-and-forget) then `Linking.openURL(targetUrl)`. | Ad has a target URL. |
| Scroll | Photos drift (parallax); cards below the fold rise in as they scroll into view. | Not with Reduce Motion. |

- **States:**
  - **Loading:** none on this screen (data arrives with sign-in). The only loading indicator is the spinner in the sheet's Redeem Now while the redeem request runs.
  - **Empty catalogue, real club** (`rewards.length === 0`, `isPlaceholderClub` false): card with `rewards` icon in a soft-accent rounded square, title "No Rewards Yet", body "Your club hasn't added any rewards yet — check back soon.", **no button**; then the ad slot.
  - **Empty catalogue, placeholder club** ("My Club Isn't Listed Yet" at sign-up): card title "Nothing Here Yet", body "Your golf club hasn't joined the Flagrr family yet — that's why there's nothing to redeem here.", button **Contact Support** (compact, with arrow nub); then the ad slot. Plus the popup below on every visit.
  - **Placeholder club popup:** fires via `useFocusEffect` on **every** focus of the Rewards tab (unlike Home, which shows the same popup on every second app open). It fires even if the placeholder club somehow has rewards.
  - **No search/filter results:** card with `search` icon, title "No rewards match your search.", body "Try another word, or clear the search to see everything."; no ad; search and pills stay visible.
  - **Error / offline:** no dedicated UI. Catalogue shows whatever was loaded at sign-in. A failed redeem closes the sheet silently. Images that fail fall back to the icon panel. Ad media failures show nothing special.
  - **Not enough Flagrr Cash:** alert (below), checked on the device before the sheet opens. If the server still rejects (balance changed elsewhere), the failure is silent.
  - **Partial failure after redeem:** if `POST /api/redeem` succeeds but the follow-up `me`/`activity`/`notifications` refetch fails, `redeemReward` returns `null`: the voucher **was** issued and FC deducted, the voucher is in the local list, but the app stays on the shop with no message and the balance shown is stale until the next reload.
  - **Unverified member** (`verifiedMember` false): no difference anywhere on this screen; the server does not gate redeeming on verification either.
  - **Vouchers (already redeemed / expired / active):** not shown on this screen.
  - **No home club name:** eyebrow hidden; sheet meta line shows the category only.
  - **Light / dark:** all surfaces use Bento tokens (`t.ground`, `t.tile`, `t.ink`, `t.muted`, `t.accent`, `t.accentInk`, `t.seg`, `t.hair`, `t.shell`, `t.ring`, `t.shadow`). Brand-fixed in both modes: lime **Redeem Now** with fairway text, the category tag on photos, the fairway/lime image fallback, the "Ad Space" placeholder (dark green + lime). Status bar flips light/dark content. Contour line backdrop at the top.
  - **Reduce Motion:** cards and empty cards appear without the rise/reveal; no photo parallax; balance shows its final value (no count-up); Redeem Now press-scale is skipped; the sheet appears without the rise (fades only); alerts fade without the pop. The ad never animates in either mode (video still autoplays; rotation still runs).
  - **Reduce Transparency:** not used on this screen (no glass header).
- **Alerts, sheets, toasts:**
  - **Not enough Flagrr Cash** (alert, `showAlert`): title "Not enough Flagrr Cash"; message `You need ${variant.cost - points.balance} more Flagrr Cash to redeem ${label}.` where `label` is the reward title for a "Standard" variant, else "{title} ({variant label})", e.g. "You need 312 more Flagrr Cash to redeem Pro Shop Voucher (R500)." (shortfall number is **not** locale-grouped). One button **OK** (dismisses).
  - **Placeholder-club popup** (alert): title "You're Almost In the Family"; message "We couldn't find your golf club on Flagrr yet, so there's no rewards catalogue to show you just yet. Ask your club to join Flagrr, or get in touch with our support team and we'll help make it happen."; buttons side by side, action first: **Contact Support** (dismiss + navigate to Contact), **Close** (cancel style, dismiss). Android back also dismisses.
  - **Redeem reward?** (bottom sheet, `BentoSheet`): grab handle; title "Redeem reward?"; round × close button (label "Close"); dimmed, blurred (web) backdrop that closes on tap (label "Close"). Body: reward photo 76×76 (radius 20; icon fallback 28 pt, no parallax); meta line "{homeClub} · {Category}" (club omitted if empty); reward name (24 pt) = "{title}" or "{title} ({label})"; a grey panel with rows **Cost** "{cost, grouped} FC" and **Balance after** "{balance − cost, grouped} FC" (hairline between); **Redeem Now** (full-width primary button, spinner while busy); **Cancel** (centred muted text button).
  - All alerts use the app's branded alert (AppAlertHost): centred card, title 17 pt, message 14 pt, buttons stacked unless exactly two (then side by side, Cancel last).
  - No toasts in this area.
- **Server calls:**
  - None on mount/focus. Data comes from AppContext (`GET /api/rewards`, `GET /api/me` for balance, club, placeholder flag and ads).
  - `POST /api/redeem` body `{ rewardId, variantId }` → when sheet Redeem Now is pressed.
    - 201: voucher `{id, rewardId, rewardTitle, variantLabel, cost, code, status, qrValue, issuedAt, expiresAt, balance}`. Client prepends it to `vouchers`, then in parallel `GET /api/me?period={current stats period}`, `GET /api/activity`, `GET /api/notifications`; sets points, user, stats, activity, notifications; navigates to the voucher.
    - Server side effects: balance decremented only if `balance >= cost` (and `total_redeemed` incremented); voucher code `FLGR-XXXX-XXXX` (alphabet without 0/O/1/I), QR value `flagrr://voucher/{code}`, expiry +90 days; activity row "{display name} redeemed" / "Reward voucher" / −cost; in-app notification "Reward redeemed" with body "Your {display name} voucher is ready — show its QR code at the club to claim it."; push with the same title/body (category `accountActivity`). Deduction and voucher insert are separate steps (not atomic; Known Limitations #7).
    - Errors (all swallowed by `redeemReward` → `null` → sheet closes, nothing shown): 400 "rewardId and variantId are required"; 404 "Reward not found" (reward/variant inactive, deleted or another club's); 400 "Not enough Flagrr Cash"; 401 "Not authenticated"; 405; network failure/offline.
  - `POST /api/profile?action=adImpression {adId}` → each time an ad is shown while the tab is focused (and on each rotation); errors ignored.
  - `POST /api/profile?action=adClick {adId}` → on ad tap; errors ignored.
- **Board coverage:**
  - **AppRewards** (Light; Dark per canvas) and **AppRewardsFull**: header with club eyebrow, "Rewards Shop", balance "12 480" / "FC to spend"; search (empty, placeholder "Search rewards…"); pills All (active), Rounds, Experiences, Pro Shop; four cards (18 Hole Round, 9 Hole Round, Golf Cart Hire, Pro Shop Voucher with chips R1000/R750/R500/R250, interactive chip selection); SPONSORED ad after the first row (a house "Refer a club" image ad linking to Referral); tab bar. Differences: the board's balance links to Member Tiers (code: not tappable); the board's tab bar is the 4-tab layout (no Activity, no My Golf).
  - **AppRewardsEmpty** (Light/Dark): placeholder-club empty card "Nothing Here Yet" with Contact Support, then the ad.
  - **AppRewardsNoResults** (Light/Dark): query "Lesson", "No rewards match your search." card, no ad.
  - **DlgRedeem** (Light/Dark): the sheet for a single-option reward (9 Hole Round): "Strand Golf Club · Rounds", Cost 2 128 FC, Balance after 10 352 FC, Redeem Now, Cancel, ×.
  - **DlgNotEnough** (Light/Dark): alert "Not enough Flagrr Cash" with **generic** copy "You need more Flagrr Cash for this reward. Scan your receipts after your round to earn the rest." and OK. The code's real-shortfall message is not on the board (deliberate, per Known Limitations).
  - **DlgNotListed** (Light/Dark): drawn over **Home**, with a shorter body ("…so there's nothing to earn or redeem there for now.") and buttons "Contact Support" / "Not now". The code's popup over the Rewards Shop, its full body text and its **Close** button are not on any board.
  - **AdSpec**: slot size (180 pt high, cover crop, 15 pt corners), rotation every 6 s with dots, video muted/autoplay/loops when alone, placement `rewardsShop` "after the first row".
  - **Not shown by any board:** "No Rewards Yet" (listed club, empty catalogue, no button); the placeholder-club popup over the shop and its exact copy/Close button; the shortfall-specific Not-enough message; the Dining and Practice pills; an active category pill other than All; tap-active-pill-to-clear behaviour; odd card count with the empty half-width spacer; a card without photo / failed photo (icon fallback); a card without description; long titles/descriptions truncated at 2 lines; a selected option other than the first reflected in the sheet name "{title} ({label})" and accessibility label; the sheet's Redeem Now loading spinner and disabled Cancel/close while redeeming; the sheet with no club name; the silent redeem failure (server 400/404/401/offline) and the partial-failure case; the "Ad Space" placeholder when no ad exists; an ad without a link; an ad without media (title text); video ad; ad rotation dots in the shop; impression/click logging; balance count-up on every focus; card parallax and rise-on-scroll; Reduce Motion variants; the live 6-tab bar with Rewards/Activity tabs.

---

#### Voucher (`mobile/src/screens/rewards/VoucherScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed:** **Left to spend** (was "Balance left"). A **Used** (status `redeemed`) or **Expired** (status `expired`) badge sits in the header's right slot (owner-approved; no board places it). No share button. Everything else below is unchanged.

- **Reached from:**
  - Rewards Shop, automatically after a successful redeem (`navigate('Voucher', { voucherId })`).
  - Reward Activity: tapping a redeem row whose voucher is `active`.
  - Root stack screen (no tab bar), opened with the fade-from-bottom transition. No other entry (not from notifications, not from a deep link, not from Profile; there is no "My vouchers" list).
- **Shows:**
  - Header: sticky glass back button (label "Back") on the left, centred nav title "Voucher"; a glass title bar with "Voucher" fades in after ~40 pt of scroll.
  - Ticket (rounded 28, ring + shadow), rises in:
    - Top panel 176 pt, fairway green: reward photo (looked up in the **current catalogue** by `voucher.rewardId`; cover crop; parallax ±14 pt). If the reward is no longer in the catalogue, has no image, or the image fails: plain fairway panel. A dark gradient fades up from the bottom.
    - Title (white, Fraunces 28, accessibility role header): `voucher.rewardTitle`, plus " — {variantLabel}" when the label is not empty and not "Standard" (e.g. "Pro Shop Voucher — R250"; a quarterly tier bar voucher shows "Bar Voucher — R100" or "— R200", since the title comes from the club's "Bar Voucher" reward). If the reward was deleted, `rewardTitle` is "" (title may be blank or just " — R100").
    - Club line (white 86%, 13 pt): `user.homeClub` (the member's **current** home club, not necessarily the club the voucher was issued at); hidden if empty.
    - Stub (fairway green) with two circular notches cut in the ground colour and a dashed perforation line.
    - Eyebrow (lime, uppercase) "Reward Redeemed".
    - Text (white 88%): "Your reward has been successfully redeemed. Present your QR code or voucher code at the club to claim."
    - QR code: `voucher.qrValue` (`flagrr://voucher/{code}`), 150 pt, near-black `#111412` on a white rounded plate, pops in (delay 220 ms from 0.8 scale). Accessibility: image "Voucher QR code".
    - "Voucher Code" (white 75%, 13 pt), then the code (e.g. `FLGR-8T4K-QX2M`) in monospace (Menlo / monospace / ui-monospace), 20 pt, lime, letter-spaced, **selectable** (long-press to copy on native; text select on web).
  - Details tile (rises in):
    - **Redeemed** — `issuedAt` formatted with the device locale as day numeric, short month, year (e.g. "23 Nov 2026" or "Nov 23, 2026").
    - **Expires** — `expiresAt`, same format; row shown only when `expiresAt` is set (always set by the server today).
    - **Cost** — "{voucher.cost, grouped} FC" ("0 FC" for tier bar vouchers).
    - **Balance left** — "{points.balance, grouped} FC": the member's **current** balance, not the balance at the time of redemption.
  - **Back to Rewards** (primary button with arrow nub).
  - The voucher's **status is not shown**: a voucher already validated at the club, or past its expiry date, looks identical to an active one here (Activity is what blocks opening non-active ones).
- **Actions:**

| Control | What it does | When available / conditions |
|---|---|---|
| Back (glass button, top-left) | `navigation.goBack()` (to the shop or to Reward Activity). | Always (also in the not-found state). |
| System back / swipe back | Same as Back. | Always. |
| **Back to Rewards** | `navigation.navigate('Main')`: returns to the tab navigator on **whichever tab was last active** (Rewards when coming from a redeem, **Activity** when coming from Reward Activity), despite the label. | Voucher found. |
| Voucher code text | Selectable / copyable. | Voucher found. |
| Scroll | Photo parallax; glass title bar fades in. | Parallax off with Reduce Motion. |

- **States:**
  - **Voucher found:** as above.
  - **Voucher not found** (`voucherId` not in the local `vouchers` list): header "Voucher" with Back, and a tile with centred muted text "Voucher not found." Nothing else.
  - **Loading / error / offline:** none (reads local state only; no server call). Photo load failure falls back to the plain panel.
  - **Already redeemed / expired / active:** not distinguished on this screen (see above). Expired-by-date vouchers still show their QR.
  - **Zero-cost tier voucher:** Cost "0 FC".
  - **Reward removed from catalogue:** no photo; title from `rewardTitle` (may be blank if the reward row was deleted).
  - **Placeholder club / unverified member:** no special handling.
  - **Light / dark:** the ticket is brand fairway/lime/white in both modes; notches use `t.ground` so they match the page; details tile, ring/shadow and hairlines use theme tokens; glass header bar becomes a solid fill on Android and with Reduce Transparency.
  - **Reduce Motion:** ticket and tile appear without rising; QR without the pop; no photo parallax.
- **Alerts, sheets, toasts:** none.
- **Server calls:** none. Data: `vouchers` (from `GET /api/vouchers` at sign-in, plus the voucher returned by `POST /api/redeem`), `rewards` (photo), `points.balance`, `user.homeClub`.
- **Board coverage:**
  - **AppVoucher** (Light/Dark) and **AppVoucherFull**: back button, "Voucher", ticket with photo, "9 Hole Round", club, "Reward Redeemed", QR, "Voucher Code" FLGR-8T4K-QX2M, Redeemed 23 Nov 2026, Cost 2 128 FC, Balance left 10 352 FC, Back to Rewards. The board adds a **Share voucher** button the app does not have (Known Limitations notes this).
  - **Not shown by any board:** the **Expires** row; the first sentence "Your reward has been successfully redeemed." (board text starts at "Present your QR code…"); a multi-option voucher title with " — {label}"; a voucher with no photo / removed reward / blank title; a zero-cost tier bar voucher ("0 FC"); the "Voucher not found." state; the glass title bar on scroll; the selectable code; "Back to Rewards" landing on Activity when opened from Activity; QR pop-in and parallax motion and their Reduce Motion variants; that the screen shows no status for validated/expired vouchers.

---

#### Reward Activity (`mobile/src/screens/rewards/RewardsActivityScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed:** Bento rows from the main boards (system-font amounts, earn/redeem chips, "Already redeemed" grey and "Expired" red pills), natural-width filter, `EmptyState`. "Receipt scanned" rows with a `receiptId` (API, migration 052) open `ReceiptHistory` with that `receiptId`, which opens the receipt's photo (owner decision); rows without one stay inert. Every tap and alert below is unchanged.

- **Reached from:**
  - Tab bar tab **Activity** (icon `activity`, label "Activity") in the live 6-tab bar.
  - Profile → Activity section → **Reward Activity** row (`navigate('Activity')`, switches to the tab).
  - Not from Home, notifications or deep links.
- **Shows:**
  - H1 "Reward Activity" (no back button; it is a tab screen with the tab bar).
  - Segmented control (full width, accessibility radiogroup "Show activity"): **All**, **Earned**, **Redeemed**; sliding highlight. Always visible, including in the empty state.
  - When there is activity: groups in fixed order **Today**, **Yesterday**, **This Week**, **Earlier** (eyebrow labels, rendered uppercase), each group only if it has rows after filtering. Rules: same calendar day as now = Today; previous calendar day = Yesterday; otherwise `floor((now − date) / 24 h) <= 7` = This Week (a rolling 7 days, not the calendar week); else Earlier. Within a group, server order (newest first). Only the latest 100 entries exist.
  - Each group is a tile with hairline-separated rows:
    - Icon square 40×40: earn = `receipt` icon in accent on soft-accent; redeem = `rewards` icon in ink on segment grey.
    - Title: `entry.title` verbatim from the server (e.g. "Receipt scanned", "Streak bonus", "Birthday reward", "Flagrr Cash gifted", "Pro Shop Voucher (R250) redeemed", "Gold Tier Bar Voucher (R100)", "Receipt rejected", "Flagrr Cash adjusted").
    - Meta: "Earned · {date}" or "Redeemed · {date}" where date = device-locale short month + day (e.g. "Nov 21" / "21 Nov"); no year, no time. "Redeemed" is used for every non-earn row, including FC adjustments and receipt reversals.
    - Status pill (redeem rows with a voucher that is found and not active): **Expired** (segment grey, muted text) or **Already redeemed** (soft accent, accent text). Nothing for active vouchers or rows without a voucher.
    - Amount (Fraunces 17, tabular figures): positive "+{n} FC" in accent; negative "−{n} FC" (true minus sign U+2212) in ink; zero "0 FC" in ink. Locale digit grouping.
    - Chevron (`chevronRight`, muted) only on tappable rows.
  - The server `subtitle` (club name, "Reward voucher", streak length, reason…) is **not displayed**.
- **Actions:**

| Control | What it does | When available / conditions |
|---|---|---|
| All / Earned / Redeemed | Filters the list on the device (`type === 'earn'` / `'redeem'`). No server call. Since 1.1.0 Reward Activity is a pushed screen, so the filter starts on All each time it opens (1.0.1: it persisted while the tab stayed mounted). | Always visible. |
| Redeem row with a voucher (tappable, role button, pressed opacity 0.7) | Looks up the voucher in the local `vouchers` list. Not found → alert **Voucher not found**. `active` → navigates to `Voucher` with that id. `expired` → alert **Voucher expired**. `redeemed` → alert **Already redeemed**. | `type === 'redeem'` and `voucherId` set (shop redemptions and tier bar vouchers). |
| Earn rows; redeem rows without a voucher | Nothing (disabled, no chevron, no button role). | — |
| **Scan a receipt** (empty card) | `navigation.navigate('ScanReceipt')` (receipt camera, slide-up). | Only when the member has no activity at all. |
| Tab bar | Standard tab switching; Scan in the bar opens ScanReceipt. | Always. |

- **States:**
  - **Loading:** none.
  - **No activity at all** (`activity.length === 0`, any filter): card with `activity` icon, title "No activity yet", body "No activity yet — play a round or scan a receipt to get started.", button **Scan a receipt** (compact, arrow nub). Segmented control still shown above it.
  - **Filter has no rows** (activity exists): centred muted text "Nothing earned yet." (Earned) or "Nothing redeemed yet." (Redeemed). No card, no button.
  - **Voucher already redeemed / expired / active:** pill and tap behaviour as above. Because vouchers load only at sign-in, a voucher validated at the club during the session still shows as active (no pill, opens the QR) until the app reloads. `expired` never occurs today (server never sets it).
  - **Voucher missing locally:** e.g. a tier bar voucher granted by the `GET /api/me` refetch after a redeem has an activity row, but `vouchers` is not refetched then, so tapping it shows **Voucher not found** until reload (code-derived; timing **unverified** in a live run). No pill is shown for such rows.
  - **Error / offline:** no dedicated UI; shows whatever was last loaded.
  - **Placeholder club / unverified member:** no special handling.
  - **Light / dark:** theme tokens throughout (`t.accent`, `t.accentSoft`, `t.seg`, `t.ink`, `t.muted`, `t.hair`); contour backdrop; status bar flips.
  - **Reduce Motion:** groups and the empty card appear without the rise; the segmented highlight jumps instead of sliding; alerts fade without the pop.
- **Alerts, sheets, toasts:** (all via `showAlert`, single **OK** button that dismisses)
  - **Voucher not found** — title "Voucher not found"; message "We couldn’t find this voucher’s details." (curly apostrophes).
  - **Voucher expired** — title "Voucher expired"; message "{rewardTitle}{ — label} has expired." (label part only when the variant label is non-empty and not "Standard", e.g. "Pro Shop Voucher — R250 has expired.").
  - **Already redeemed** — title "Already redeemed"; message "{rewardTitle}{ — label} has already been scanned and redeemed at the club."
- **Server calls:** none from the screen. Data: `activity` (`GET /api/activity`, at sign-in, after redeem, after receipt submit) and `vouchers` (`GET /api/vouchers` at sign-in, plus locally prepended redeems).
- **Board coverage:**
  - **AppActivity** (Light/Dark) and **AppActivityFull**: "Reward Activity", All/Earned/Redeemed (All selected), groups THIS WEEK and EARLIER, earn rows with "+… FC", a redeem row with "Already redeemed" pill and one with "Expired" pill, "−… FC". Differences from code: the board is a pushed screen with a Back button and **no tab bar**; rows use different titles/meta ("Receipt · Halfway House", "Today, 14:05", "Thu 12 Nov · claimed at the club"); the board has an "Under review" pill on an earn row (no such state in the app); board earn rows link to Receipt History and the Already-redeemed/Expired rows link to the Voucher screen (the app makes earn rows inert and shows alerts for those vouchers); the board shows no chevrons.
  - **AppActivityEmpty** (Light/Dark): "No activity yet" card with the exact body and **Scan a receipt**; the board omits the segmented control (the app shows it) and has a Back button.
  - **Not shown by any board:** the Activity tab in the tab bar (boards use the 4-tab bar with no Activity tab; the only board route in is Profile); Today and Yesterday group headers; the "Earned · {date}" / "Redeemed · {date}" meta format; Earned and Redeemed filter selected states; "Nothing earned yet." and "Nothing redeemed yet."; the chevron on tappable rows; inert earn rows; the three alerts (Voucher not found, Voucher expired, Already redeemed); tapping an active voucher row opening the Voucher; "0 FC" rows (tier bar vouchers); redeem-type rows without a voucher (Flagrr Cash adjusted, Receipt rejected); the 100-entry cap; Reduce Motion behaviour.

---

### Not on any board

1. Rewards Shop: "No Rewards Yet" empty state for a listed club with no rewards ("Your club hasn't added any rewards yet — check back soon.", no button).
2. Rewards Shop: placeholder-club popup shown over the Rewards Shop on every focus (boards only show the Home version).
3. Placeholder popup exact copy "We couldn't find your golf club on Flagrr yet, so there's no rewards catalogue to show you just yet. Ask your club to join Flagrr, or get in touch with our support team and we'll help make it happen." (board has different, shorter copy).
4. Placeholder popup **Close** button (board shows "Not now").
5. Not enough Flagrr Cash alert with the real shortfall message "You need {n} more Flagrr Cash to redeem {label}." (board shows generic copy).
6. Dining and Practice category pills, and the fixed category order Rounds, Dining, Practice, Pro Shop, Experiences.
7. A category pill in the active state (other than All).
8. Tapping the active category pill to return to All.
9. Search matching title only (not description); live filtering; no clear button.
10. Odd number of results: last card with an empty half-width spacer.
11. Reward card with no photo or a failed photo (fairway panel with lime rewards icon).
12. Reward card with no description.
13. Title/description truncation at two lines.
14. Redeem sheet for a multi-option reward: name "{title} ({label})".
15. Redeem Now accessibility label including the option ("Redeem {title} {label}").
16. Redeem sheet loading state: spinner in Redeem Now, Cancel disabled, × / backdrop / back ignored.
17. Redeem sheet with no club name (meta shows category only).
18. Silent redeem failure (server 400 "Not enough Flagrr Cash", 404 "Reward not found", 401, offline): sheet closes with no message.
19. Partial redeem failure: voucher issued and FC deducted but the follow-up refetch fails, app stays on the shop with no message and a stale balance.
20. No disabled/unaffordable state on cards (every Redeem Now is tappable; check happens on tap).
21. Rewards Shop ad placeholder "Ad Space" (no ad configured; no SPONSORED label) (owner decision 24 Nov 2026: from the 1.1.0 store build the empty slot is not shown at all).
22. Shop ad without a target URL (not tappable).
23. Shop ad without media (shows the ad title).
24. Shop ad as video, and rotation with dots in the shop slot (spec only in AdSpec, never drawn in the shop).
25. Ad impression logging (per display, paused when unfocused) and click logging.
26. Balance count-up re-running every time the Rewards tab gains focus.
27. Card photo parallax and cards rising in as they scroll into view.
28. Rewards Shop Reduce Motion behaviour (no rise, no parallax, no count-up, no press scale, sheet without rise).
29. The live 6-tab bar (Home, Course, My Golf | Scan | Rewards, Activity, Profile) on the Rewards and Activity screens.
30. Voucher **Expires** row.
31. Voucher text first sentence "Your reward has been successfully redeemed."
32. Voucher title for a multi-option reward "{title} — {label}".
33. Voucher with no photo / reward removed from the catalogue / blank title.
34. Zero-cost tier bar voucher on the Voucher screen ("0 FC").
35. "Voucher not found." state on the Voucher screen.
36. Voucher glass title bar fading in on scroll.
37. Selectable / copyable voucher code.
38. "Back to Rewards" returning to whichever tab was last active (Activity when opened from Activity).
39. Voucher "Balance left" showing the current balance, not the balance at redemption.
40. Voucher club line showing the member's current home club.
41. Voucher screen showing no status for validated or expired-by-date vouchers.
42. Voucher QR pop-in, photo parallax and their Reduce Motion variants.
43. Activity as a tab screen (no back button) reached from the Activity tab.
44. Activity "Today" and "Yesterday" groups; "This Week" as a rolling 7 days.
45. Activity row meta format "Earned · {date}" / "Redeemed · {date}".
46. Activity Earned and Redeemed filters in the selected state.
47. Activity filtered-empty text "Nothing earned yet." / "Nothing redeemed yet."
48. Activity segmented control shown above the empty card.
49. Chevron on tappable activity rows; earn rows inert (not tappable).
50. Tapping an active voucher row opens the Voucher screen.
51. Alert "Voucher not found" / "We couldn’t find this voucher’s details."
52. Alert "Voucher expired" / "{title}{ — label} has expired."
53. Alert "Already redeemed" / "{title}{ — label} has already been scanned and redeemed at the club."
54. Activity rows with amount "0 FC" (tier bar vouchers).
55. Redeem-type activity rows with no voucher (Flagrr Cash adjusted, Receipt rejected), labelled "Redeemed" and inert.
56. Activity limited to the latest 100 entries.
57. Activity Reduce Motion behaviour (no rise; segmented highlight jumps).
58. Voucher statuses refreshed only at sign-in/club change (a validated voucher still shows as active during the session); no pull-to-refresh on any of the three screens.

### Could not verify

- Dark boards other than `DlgRedeemDark` are listed in `canvas.json` but their files are not on disk; assumed to mirror the light boards.
- The "Voucher not found" case for a tier bar voucher granted during the post-redeem `/api/me` refetch is derived from code, not reproduced in a running app.
- Exact date strings depend on the device locale (`toLocaleDateString(undefined, …)`); examples above assume en-ZA/en-GB vs en-US.

## D. Golf
Source of truth: code in `mobile/src` as of 2026-11-24 (branch `claude/member-store-build`, working tree), plus the API it calls (`api/_lib/golf.ts`, reached through `api/courses?action=golf*`). Read-only survey; nothing was run.

Files covered:
- `screens/golf/CourseHomeScreen.tsx` (Course tab)
- `screens/golf/RoundSetupScreen.tsx` (Start a Round)
- `screens/golf/CourseGuideScreen.tsx` (the hole view, with its three sheets and the layers popover)
- `screens/golf/RoundDetailScreen.tsx` (Round)
- `screens/golf/MyGolfScreen.tsx` (My Golf tab)
- `components/golf/GolfHoleMap.tsx`, `components/golf/Scorecard.tsx`, `components/golf/GolfSheet.tsx` (wraps `components/bento/BentoSheet.tsx`)
- `golf/scoring.ts`, `golf/stats.ts`, `golf/holeGeometry.ts`, `golf/courseMap.ts`, `golf/dto.ts` (only what changes what the member sees or can do)
- `api/client.ts` golf functions (lines 275–298) and the save/offline/retry logic in CourseGuideScreen.

Conventions used below: "copy" is quoted verbatim from code, `{x}` marks an interpolated value. All alerts go through `showAlert` (`utils/alert.ts`), which draws the app's own branded modal on every platform (`AppAlertHost`). An alert with no buttons gets one "OK" button. The Android back button (or `onRequestClose`) dismisses an alert without running any button handler.

---

### Shared rules (apply to several screens)

#### Scoring rules (`golf/scoring.ts`, identical on app and API)
- **Course Handicap** = Index × Slope ÷ 113 + (Course Rating − Par), rounded half up. A nine-hole round uses Index ÷ 2 rounded to the nearest tenth, with the nine-hole rating and the nine's par.
- **Playing Handicap** = unrounded Course Handicap × allowance (95% or 100%), rounded half up.
- **Strokes received per hole**: handed out in stroke-index order, ranked among the holes being played (a nine re-ranks its own nine SIs 1–9). A plus handicap gives strokes back starting from the easiest hole (negative strokes received).
- **No Handicap Index** = scratch: no strokes, and the most a hole counts for handicap is par + 5.
- **Net double bogey cap (handicap score / "adjusted")**: par + 2 + strokes from the full Course Handicap (not the playing handicap). A pick-up counts as the cap.
- **Stableford points** per hole = max(0, 2 + par + strokes received − strokes). Pick-up = 0 points.
- **Gross / Net totals** become null ("NR" / "No return") once any hole is a pick-up.
- **Green in regulation** (only when putts entered) = strokes − putts ≤ par − 2.
- **Limits**: strokes 1–20 (`MAX_STROKES`), putts 0–10 (`MAX_PUTTS`), Index +10.0 to 54.0.
- **Entry validation** (`entryProblem`, used by API on every save; app keeps entries valid so these normally never show, but if they do they appear as the save-error alert message): "Hole {n}: score must be 1–20." / "Hole {n}: putts must be 0–10." / "Hole {n}: putts need a score." / "Hole {n}: putts must be fewer than the score." / "Hole {n}: fairway must be hit, left or right." / "Hole {n}: there's no fairway to hit on a par 3." / "Hole {n}: the fairway needs a score." API also: "Send one entry for each of the {n} holes."; on finish (or any save of an already-completed round) with holes missing: "Enter a score (or a pick-up) on every hole before finishing. {n} to go."
- API drops putts and fairway from entries when the round was started with trackStats off.
- **Formatting**: Index shows one decimal, plus handicaps as "+1.4" (`formatIndex`); whole handicaps as "13" or "+2" (`formatWhole`); to-par as "E", "+3", "−2" (true minus sign) (`toParText`).
- **Result names** (`resultName`): score 1 = "Hole in one"; otherwise by score − par: −3 "Albatross", −2 "Eagle", −1 "Birdie", 0 "Par", +1 "Bogey", +2 "Double bogey", +3 "Triple bogey"; anything else "+{d}" or "{d}" (e.g. "+4", "-4" with a hyphen).

#### Stroke play vs Stableford (format is fixed per round at start)
| Where | Stableford | Stroke play |
|---|---|---|
| Hole view score bar result line | "{n} pt" / "{n} pts" | "Net {n}" |
| Score bar tone | green when 3+ pts, warning when 0 pts | green when net under par, warning when net over par |
| Score bar after a pick-up | "Picked up" / "0 pts" | "Picked up" / "No return" (not reachable from UI, see below) |
| "Pick up" link | Offered once the hole is worth 0 points (Rule 21.1b) | Never offered: there is no way to record a pick-up in stroke play |
| Score bar card button total | "{n} pts" | to-par of net ("E", "+5", "−1"), or "NR" after a pick-up |
| Scorecard last column | "Pts" | "Net" ("–" on a pick-up hole) |
| Scorecard subtotal last cell | points | net, or "NR" |
| Your round sheet Format row | "Stableford · {pct}% allowance" | "Stroke play · {pct}% allowance" |
| Finish alert | always "… {points} Stableford points …" (even in stroke play) | same |
| Course tab in-progress tile, Round detail hero, My Golf | always Stableford points | always Stableford points |

#### Nine vs eighteen holes
- Nine-hole rounds exist only when the course card has separate front/back nine ratings for that tee and gender (`playOptions` / `ratingFor`). A 9-hole course plays "full" (its 9 holes).
- Hole pills show the real hole numbers (a back nine shows 10–18).
- Scorecard: 18 holes = holes 1–9, "Out", holes 10–18, "In", "Total"; any other count = all holes then "Total".
- Handicaps for a nine use Index ÷ 2 (shown in the setup calculation note).
- My Golf basis: round-level stats use 18-hole rounds if any exist in the period, otherwise 9-hole rounds; "played to handicap" threshold is 36 points (18) or 18 points (9).

#### Light / dark and Reduce Motion (all golf screens)
- Light/dark come from the app theme (`useTheme`/`useBento`). The hole map has its own two palettes (`LIGHT_MAP`, `DARK_MAP`: rough, semi-rough, fairway, green, fringe, tee, sand, water, trees, shade, scrub, cart path). The hole view's header band is always dark green and the status bar is always light-content.
- Reduce Motion (`prefersReducedMotion`, follows the OS setting live): `Appear` tiles show without rising, `FadeIn` skips, `CountUp` numbers show final values, `PressableScale` doesn't scale, sheets (`BentoSheet`) appear without the rise (fade only). The hole view's slide-up stack transition (`animation: 'slide_from_bottom'`) is native and is not switched off in code (OS may reduce it; unverified).

---

#### Course tab (`screens/golf/CourseHomeScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** Bento layout per the boards; the hero is a fairway-green gradient tile (no club photo: the API returns none). **Your game** is always shown and opens My Golf ("–" with no stats or when the stats read fails) (owner decision: Course must lead to My Golf before the first round). With no away course, no search field and no "Coming soon" chip (as before). Error texts go through `friendlyError`. Everything else below is unchanged.

- **Reached from:**
  - Bottom tab "Course" (6-tab bar: Home, Course, My Golf, Scan, Rewards, Activity, Profile; `MainTabNavigator.tsx`).
  - Home screen tile "Play a round" / "Hole maps and your scorecard" when no round is in progress (`HomeScreen.tsx:265–281`).
  - My Golf: "Play an away course" (coming-soon state) and "Go to Course" (no-rounds state).
  - Back from the hole view when the round was started from here (Round Setup is replaced by the hole view, so back lands on Course).
- **Shows:**
  - Eyebrow: club name (`golfHome.clubName`, one line) when present.
  - H1 "Play a round"; sub "Hole maps, distances and your scorecard".
  - **Round in progress hero tile** (when `golfHome.inProgress`): eyebrow "Round in progress" (lime); big line "Hole {n}" (first hole without a score) or "All holes in"; "{points} pts · thru {holesPlayed} of {holeCount}" (Stableford points, using the round's handicaps); "{courseName} · {teeName} tees".
  - **Your club tile** (when the home club's map is live, `homeCourse`): eyebrow "Your club"; course row (logo image or flag icon, name, "{location} · {holeCount} holes"); "Start a round" button.
  - **Coming soon tile** (no live home map): chip "Coming soon"; title "Your club’s course map" (placeholder club or no club name) or "{clubName}’s course map"; body: placeholder club "Your club isn’t on Flagrr yet. Once it joins, we’ll build its hole maps and scorecard here." otherwise "We build each club’s hole maps and scorecard from its official card. Yours is on the way."; plus " In the meantime you can play any course below." when any live course exists.
  - **Your game tile** (only when `golfStats('year')` succeeds and `totalRounds > 0`; all-time count): "Your game · Stableford average", value = year's points average to 1 decimal or "–", unit "pts", link text "My Golf" + chevron; section "Played recently" with up to 3 most recent rounds this year: "{Sat, 21 Nov} · {courseName}" (device locale, weekday short, day, month short) and "{points} pts" + " · {gross} gross" when no pick-up.
  - Heading "Away courses".
  - Search field (placeholder "Search courses", search icon) when there is at least one live non-home course.
  - Away course list: every live course except the member's home course, filtered by search on name or location (case-insensitive, trimmed); sorted by most recently played first (up to 5 recent course ids from the API), then alphabetically. Each row: logo or flag icon, name, "{location} · {holeCount} holes" + " · Played recently" for recent courses, chevron.
  - No search match: "No mapped course matches “{query}”."
  - No away courses: with home course live "No other courses are mapped yet. More are added as clubs join Flagrr."; without "Course maps are coming soon. We’re adding them as clubs join Flagrr."
  - Footnote (always when loaded): "Only courses Flagrr has mapped are listed, so every scorecard here matches the club’s official card."
- **Actions:**

| Control | What it does | When available |
|---|---|---|
| Pull to refresh | Reloads `golfHome` and `golfStats('year')` | Always |
| "Resume round" (lime button) | Navigate `CourseGuide { roundId }` | Round in progress |
| "Discard" (text button on hero) | Alert "Discard this round?" (see below) | Round in progress |
| Home course row | Same as "Start a round" | Home map live |
| "Start a round" | If a round is in progress: alert "Round in progress"; else navigate `RoundSetup { golfCourseId }` | Home map live |
| Your game tile (whole row, a11y "My Golf") | Navigate `MyGolf` tab | Stats loaded, totalRounds > 0 |
| Played recently row | Navigate `RoundDetail { roundId }` | Up to 3 rows |
| Search field | Filters away list live | At least one away course |
| Away course row (a11y "Play {name}") | Same start rule as above (alert if in progress, else `RoundSetup`) | Each row |
| "Try again" (secondary button) | Re-runs load | Load error |

- **States:**
  - Loading: spinner until `golfHome` returns (first load only; reloads on every focus without a spinner).
  - Error: tile with the error message (API message, or "Could not load courses." when not an Error) + "Try again". Old data, if any, still shows under it.
  - Empty / placeholder club / no home course: Coming soon tile variants above; away list empty texts above.
  - Round in progress: hero tile; starting any round is blocked by an alert.
  - Stats tile missing when the stats call fails (silently) or the member has no completed rounds.
  - Nine vs eighteen: "thru {x} of 9" vs "of 18"; course rows show hole count.
  - Stroke play round in progress: tile still shows Stableford points.
  - Light/dark; Reduce Motion (Appear/CountUp).
  - Offline: `golfHome` fails, error tile shows the fetch error text (e.g. platform "Network request failed"; exact text platform-dependent, unverified).
- **Alerts, sheets, toasts:**
  - "Round in progress" / "Finish or discard your round at {courseName} before starting another." Buttons: "Resume round" → `CourseGuide`; "Close" (cancel) → nothing.
  - "Discard this round?" / "Your scores at {courseName} will be deleted. This can't be undone." Buttons: "Discard round" (destructive) → `golfRoundDelete(id)` then reload; "Keep it" (cancel).
  - On delete failure: "Could not discard the round" / {error message}.
- **Validation:** none (search is free text).
- **Server calls:**
  - `api.golfHome()` → GET `/courses?action=golfHome` on every focus and refresh. Returns clubName, isPlaceholderClub, homeCourse, courses (all live maps), recentCourseIds (5), inProgress round, profile. Error → error tile.
  - `api.golfStats('year')` → same time; failure ignored.
  - `api.golfRoundDelete(id)` → POST `/courses?action=golfRoundDelete`; errors "A round id is required." / "Round not found." surface in the failure alert.
- **Board coverage:** AppCourse (Light, Dark), AppCourseFull: in-progress hero, Your club tile with Start a round, Your game tile with 3 played-recently rows, Away courses with search and the "No other courses are mapped yet…" empty text, footnote. DlgDiscard is drawn over this screen.
  - Board differs from code: hero sub-line on board "Strand Golf Club · Stableford · Middle tees" (code shows "{course} · {tee} tees", no format); board puts "14 pts" and "thru 6" apart (code "14 pts · thru 6 of 18"); board shows a "Coming soon" chip in the away section next to the search field (code has no chip there); the search field and the "no other courses" text appear together on the board (in code they are mutually exclusive); DlgDiscard copy on the board ("All the scores in this round will be deleted." / "Keep playing") is the hole view's copy, not this screen's ("Your scores at {course} will be deleted. This can't be undone." / "Keep it").
  - **Not on any board:** loading spinner; error tile + "Try again"; Coming soon home tile (all 3 copy variants); away course list rows (logo, location, hole count, "Played recently" tag); search no-match text; "Course maps are coming soon…" variant; "All holes in" hero state; "Round in progress" blocking alert (start while a round is open); discard failure alert; pull to refresh; stats tile with "–" average (rounds only outside this year).

---

#### Start a Round (`screens/golf/RoundSetupScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** Bento styling only; every field, rule, alert and the 409 flow below is unchanged; technical errors go through `friendlyError`.

- **Reached from:** Course tab "Start a round" (home course), home course row, any away course row (only when no round is in progress). Stack screen; not reachable from elsewhere.
- **Shows:**
  - Header title "Start a Round" with back button (a11y "Back").
  - Course name (header role), "{location} · {holeCount} holes".
  - **Tees tile:**
    - "Rating" segmented control "Men" / "Ladies", only when the course rates both genders.
    - "Tees": a tile per tee rated for the chosen gender: colour dot, tee name, "{total length, en-ZA grouping} m · CR {cr 1dp} · {slope}" (always the full-course rating).
    - "Holes": segmented "{holeCount} holes" / "Front 9" / "Back 9" when the chosen tee/gender has nine-hole ratings; otherwise plain text "{holeCount} holes".
    - Hint for an 18-hole course with only full ratings: "This course’s card has no separate nine-hole ratings yet, so only full rounds can be scored."
  - **Handicap Index tile:** label "Handicap Index", text field (placeholder "14.2", numbers-and-punctuation keyboard, max 5 chars), error text when invalid, hint "As it shows on GolfRSA. For a plus handicap start with +, like +1.4. Leave it empty to play off scratch."
  - **Format tile:** "Format" segmented "Stableford" / "Stroke play"; "Allowance" segmented "95%" / "100%" with hint "95% is the World Handicap System default for individual Stableford and stroke play. A committee may use 100% for fields under 30."; toggle row "Putts and fairways" / "Add putts and fairway hits on each hole for putting, fairway and greens in regulation stats in My Golf." (toggle a11y "Enter putts and fairways").
  - **Calculation tile** (when the tee/gender/layout is rated and the card exists): row "Rating" = "{tee name} · Men|Ladies · CR {cr} · Slope {slope} · Par {par}". With a valid index: "Course handicap ({9|18} holes)" = whole; "Playing handicap ({95|100}%)" = whole; note: 18 holes "{index} × {slope} ÷ 113 + ({cr} − {par}) = {raw 2dp} → {course}. Playing: {raw} × {pct}% = {raw×allowance 2dp} → {playing}." and nine holes "{index} ÷ 2 = {half}, × {slope} ÷ 113 + …" (negative numbers shown with a true minus). Without an index: "Without a Handicap Index you get no shots, and points are scored against par."
  - Footnote "Flagrr never works out your handicap itself; it uses the index you enter here."
  - Button "Start round".
- **Defaults on load:** gender = profile's rating gender if the course rates it, else the first available, else men; tee = the middle tee for that gender (index floor((n−1)/2)) ("the one most members play"); Index text = profile index formatted (empty if none); format, allowance, Putts and fairways = profile values. Layout defaults to full.
- **Actions:**

| Control | What it does | When available / conditions |
|---|---|---|
| Back | `goBack()` | Always |
| Men / Ladies | Sets gender; keeps the tee if rated for it, else picks the first tee | Course rates both |
| Tee tile | Selects tee | Each rated tee |
| Holes segment | Sets layout; falls back to full if the newly chosen tee lacks that nine | Tee has nine ratings |
| Handicap Index field | Live validation and live recalculation | Always |
| Stableford / Stroke play | Sets format | Always |
| 95% / 100% | Sets allowance; recalculates playing handicap | Always |
| Putts and fairways toggle | Sets trackStats | Always |
| "Start round" | Saves profile, starts round, replaces this screen with the hole view | Disabled when no rated tee option, Index invalid, or already starting (double-tap guarded by a ref); shows loading spinner |

- **States:** loading (spinner); load error (plain error text only: no retry button; e.g. "That course map is not available." or "Could not load this course."); course with one gender (no Rating segment); course with nine ratings vs without; Index valid/empty/invalid; calc tile with/without index; calc tile hidden when the combination is not rated; starting (button spinner); light/dark; no Reduce Motion specifics.
- **Alerts:**
  - Round start returns 409 (one round at a time). App re-reads `golfHome`:
    - If it finds the round: "You have a round in progress" / "{courseName}, {teeName} tees. Pick it up where you left off, or discard it to start this one." Buttons: "Resume round" → replace with `CourseGuide` for that round; "Discard it" (destructive) → `golfRoundDelete` then starts this round again automatically (failure: "Could not discard the round" / {message}); "Cancel" (cancel).
    - If it can't: "Could not start the round" / "You already have a round in progress. Open the Course tab to finish or discard it." (OK).
  - Any other failure: "Could not start the round" / {API message}. Possible API messages: "Choose a course.", "Choose men’s or ladies’ ratings.", "Choose which holes you are playing.", "That course map is not available.", "Those tees are not rated for that choice yet.", "Handicap Index must be from +10.0 to 54.0, to one decimal.", "Rating must be men or ladies.", "Format must be stableford or stroke.", "Allowance must be 95% or 100%.", or a network error text.
- **Validation:**
  - Handicap Index → trimmed, comma accepted as decimal point, must match one or two digits with optional one decimal and optional leading "+" (no "−"), value from +10.0 to 54.0; empty = no index (scratch) → invalid shows red border and "Enter a number from +10.0 to 54.0, like 14.2." and disables Start round.
- **Server calls (in order on Start):**
  1. `api.saveGolfProfile({ handicapIndex, trackStats })` → POST `/courses?action=golfProfile`. Saved even if the round then fails to start.
  2. `api.golfRoundStart({ golfCourseId, teeId, gender, layout, format, allowance })` → POST `/courses?action=golfRoundStart`. Server also saves gender, format and allowance to the profile, recomputes handicaps from the stored index, copies par/SI/length into the round, and stores trackStats from the profile. 409 → in-progress flow; others → alert.
  - On load: `api.golfCourse(id)` and `api.golfProfile()` in parallel.
- **Board coverage:** AppRoundSetup (Light, Dark), AppRoundSetupFull: course name, tee chips (Back/Middle/Front), rating line "71.4 · Slope 127", Holes segment, Handicap Index hint, Format, Allowance, Putts and fairways toggle, footnote, Start round. DlgInProgress drawn over it.
  - Board differs from code: board tees show names only (code shows length · CR · slope per tee); board shows Holes segment "18 holes / Front 9 / Back 9" for Strand (code shows plain "18 holes" + the no-nine-ratings hint because Strand's card has no nine ratings); board allowance shows only "95%"; DlgInProgress board copy "Finish or discard it before you start a new one." with "Resume round" / "Cancel" (code has course/tee message and a third "Discard it" button).
  - **Not on any board:** Men/Ladies Rating segment; tee length/CR/slope meta; no-nine-ratings hint; Handicap Index text field itself and its placeholder; invalid-index error text and red border; allowance hint text; calculation tile (Rating row, Course handicap, Playing handicap, formula note, nine-hole "÷ 2" note); no-index note; loading spinner; load error text; starting spinner/disabled button; "Discard it" option and auto-restart after discard; fallback "Could not start the round / You already have a round in progress. Open the Course tab…" alert; generic start failure alert; discard failure alert.

---

#### Hole view / Course Guide (`screens/golf/CourseGuideScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** The "GPS integration coming soon" chip is gone (owner decision). Header card holds the hole facts and save status; hole pills are six wide; map palettes follow the kept boards; the status bar is dark over a light no-map screen. The **Scorecard** sheet is horizontal (owner decision): per nine a 9-column grid with an Out / In column, rows Hole, m, Par, SI, Shots (left out on scratch rounds), Score with marks, Putts (blank on unplayed holes) and Pts or Net; 18-hole rounds add a Total row; tapping a hole number jumps to it. Scoring, saving, retry, finish, discard and delete logic is unchanged line for line (errors through `friendlyError`).

Full-screen stack screen (no tab bar), presented with a slide-up animation, swipe-back gesture disabled (`gestureEnabled: false`). Layout top to bottom: dark-green header (back, course name and save status, HCP button, Bag button, hole pills) → map area with floating cards → optional Putts/Fairway bar → score bar.

- **Reached from:**
  - Round Setup "Start round" (replaces the setup screen).
  - Round Setup in-progress alert "Resume round" (replace).
  - Course tab hero "Resume round"; Course tab "Round in progress" alert "Resume round".
  - Home screen Resume round tile (`HomeScreen.tsx:248–264`).
  - Round Detail "Correct a score" (completed round) or "Resume round" (in-progress round).
- **Load sequence:** `golfRound(id)` and `golfProfile()` in parallel → if a local copy of the entries exists in AsyncStorage (`flagrr_round_entries_{id}`) with the same hole count, it wins over the server copy and is queued to save at once → profile bag used if present (else sample bag) → opens on the first hole with no score (or hole 1 if all scored) → `golfCourse(golfCourseId)` for the map; if the round has no course id or the map call fails, the map is marked missing (scoring still works).

##### Header
- Back button (chevron; a11y "Back" for a finished round, "Back. Your round stays in progress" otherwise) → `goBack()`. Android hardware back also goes back. Leaving sends any pending save immediately.
- Course name (one line).
- Save status line: "Saving…" / "Not saved yet · will retry" (offline) / "Finished round · changes save" (completed round, saved) / "Saved".
- HCP button (a11y "Your round: tees and handicap"): tee-colour dot, "HCP", the round's Handicap Index (formatted) or "–" → opens **Your round** sheet.
- Bag button (lime, golf-tee icon, "Bag"; a11y "My bag") → opens **My bag** sheet. Only when the course map loaded.
- Hole pills (horizontal scroll): one per hole: number, "P{par}", small dot when the hole has a score (or pick-up); selected pill lime; a11y "Hole {n}, par {par}[, scored]", selected state. Tap → go to hole (resets custom target, closes layers). The strip does not auto-scroll to the current hole.

##### Map (`components/golf/GolfHoleMap.tsx`) — only when the course map is available
- Drawing: hole rotated tee-at-bottom, green-at-top, from OpenStreetMap features within 170 m of the hole: rough, practice range, scrub, woods, fairway (with semi-rough edge), cart paths, tee boxes with a dot per tee colour, water, greens with fringe, bunkers, tree rows with shade.
- Ball start: the chosen tee's box centre, or a point on the centre line at the card length when the box is more than 15 m off the card length. Ball resets to the tee whenever the hole changes.
- Overlays: distance arcs (if on) at 50/100/150/200/250 m from the ball, only up to the pin distance + 15 m, ±35° toward the pin, each labelled with its number; dispersion ellipse ("usual miss") around the target for shots over 30 m when the ball is not on the green; white shot line ball → target with shadow; dashed line target → pin when the target is more than 3 m from the pin; distance pills "{n} m" on the ball→target and target→pin legs when over 12 m; hazard pills "{reach} / {carry}" (metres, if Hazard distances on) for bunkers and water near this hole that are ahead of the ball (reach 8 m to pin+25 m; on long holes, hazards within 28 m of the pin are skipped), placed to avoid overlapping other markers/labels and dropped if no free spot; flag at the pin; target reticle (lime ring) when the target is more than 3 m from the pin; ball; "Drag me" pill next to the ball until the ball has been dragged once (then gone for the rest of the visit, all holes).
- Gestures:

| Gesture | Effect |
|---|---|
| Tap anywhere (moves < 6 px) | Sets a custom target there ("Your target") |
| Drag starting within 26 px of the ball | Moves the ball; hides "Drag me" for good; target follows suggestion unless custom |
| Drag starting within 24 px of the target (only when target is shown) | Moves the custom target |
| Drag elsewhere | Pans the map (after 6 px, marks "user moved" so auto-refit stops) |
| Two-finger pinch | Zooms around the pinch midpoint (0.35–14 px per metre) |
| Mouse wheel (web only) | Zooms at the cursor |
| Any touch on the map | Closes the layers popover |
| Long-press | None (no long-press on the map) |

- Auto framing: fits the whole hole (tee to back of green, ±35 m sideways) inside the space left by the floating cards on every hole change and screen resize; re-fits when the shot card's height changes only if the member hasn't panned/zoomed.
- a11y label: "Hole map. Drag to move around, tap to aim."

##### Floating cards over the map (only with the map)
- **Hole badge** (top left): hole number tile; "Par {par}" + strokes-received dots "●" (1–4, only when receiving shots); "{length} m · SI {si}" + " · {shots}" when the round has handicaps, where shots = "1 shot" / "{n} shots" / "gives back {n}" / "no shots".
- **GPS chip** (under the badge): "GPS integration coming soon" (static; there is no GPS, see GPS below).
- **Green card** (top right): "Back" {n}, big middle {n} with "Middle", "Front" {n} — metres along the line from the ball to the pin (all three = the pin distance if the line misses the green outline). a11y "Green: front {f}, middle {m}, back {b} metres".
- **Map controls** (right): "Zoom in" (+, ×1.35), "Zoom out" (−, ÷1.35), "Show the whole hole" (fit) in one group; "Map layers" button (expanded state; highlighted while open) toggles the layers popover.
- **Layers popover** (card beside the controls, not a sheet): "Distance arcs" / "Every 50 m from your ball" toggle (default on); "Hazard distances" / "Reach / carry, in metres" toggle (default on). Not saved: both reset to on each time the hole view opens. Closes on map touch, hole change, or tapping Map layers again.
- **Shot card** (bottom; a11y live region "polite"):
  - Chip: "Suggested shot" / "Your target" / "Your target · risky" (warning colours when risky).
  - "From the tee" (ball within 1 m of the tee) or "From your ball · {n} m to pin".
  - Collapse/expand button (a11y "Hide shot details" / "Show shot details"); collapsed shows chip, from-line, club and distance only.
  - Club name and distance "{n} m".
  - Stats row: "Leaves" = "–" when putting, "Putt" when the shot finishes on the green or within 3 m of the pin, else "{n} m"; "Next" = "–" when putting, "Putter" when finishing on the green, "Chip" when ≤ 45 m left, the second-longest club when more than the longest carry is left, else the club for that distance; "Usual miss" = "–" when putting or shot < 30 m, else "±{n} m" (3 + 6.5% of distance).
  - Why text (see copy list below).
  - "Show suggested shot" (pill) when a custom target is set → back to suggestion.
  - "Back to the tee" when the ball has moved from the tee → ball to tee and suggestion.
- **Suggestion logic and copy** (`holeGeometry.suggest`), using the member's bag (clubs with carry 0 are ignored):
  - On the green: "Putter", "You are on the green. Read the slope from behind the ball and roll it to the hole."
  - Under 45 m: under 25 m "Chip" with "Land it on the front edge and let it release to the pin."; else the shortest club (or "Wedge") with "Half swing, carry it onto the green and let it settle."
  - Within reach (≤ longest carry + 8 m): club for the distance, "Aim for the middle of the green." plus, when water or a bunker is within 20 m of the pin, " {Water|Bunker} {short of|long of|on the left of|on the right of} the green, so {take enough club|don’t go long|favour the right half|favour the left half}."; plus " This is at the top of your range with {club}." when beyond the longest club; plus " Take a little off {club}." when the club carries more than 12 m past.
  - Lay-up / tee shot: best landing spot over clubs and angles: "Aim at the {left side|right side|middle} of the fairway." plus, near a bunker/water: " Stays {n} m short of the {bunker|water}." / " Carries the {name} on the {left|right}." / " Keeps you clear of the {name} on the {left|right}."; if nothing fits: longest club, "Move it forward and keep it in play."
  - Bag with no clubs (all carries 0): club shows "Club".
  - Custom target (`describeCustom`): "That’s in the {bunker|water|trees}." (risky) or "{Trees are|Water is|A bunker is} inside your usual miss of ±{n} m." (risky) or "Clear of hazards within your usual miss of ±{n} m."; plus "Further than your longest club ({club}, {carry} m)." (risky) when more than 5 m beyond it; plus "Finishes on the green." when it does.

##### No map
- Message in the map area: "The map for this course isn’t available any more, but you can still keep score below." No floating cards, no Bag button; header, hole pills, Putts/Fairway bar and score bar still work.

##### Putts / Fairway bar (only when the round was started with "Putts and fairways" on)
- "Putts" mini stepper: "−" (a11y "One putt fewer"), value ("–" when empty; a11y "Enter two putts" or "{n} putts. Tap to clear"), "+" ("One putt more").
- Par 4/5: "Fairway" with three toggles "← L" (a11y "Missed left"), "Hit" ("Fairway hit"), "R →" ("Missed right"); selected state; tapping the selected one clears it.
- Par 3: text "Par 3: no fairway".

##### Score bar
- Left label (small line + result line):
  - No score: small "Hole {n} · {shots}" when the round has handicaps, else "Hole {n} score"; result "Tap {par} for par".
  - Pick-up: "Picked up" / "0 pts" (Stableford) or "No return"; warning tone.
  - Score: small "{result name}" + " · net {par|birdie|bogey|…}" (lower case) when the member receives or gives back shots on that hole; result "{n} pt(s)" or "Net {n}"; tone as in the format table.
  - When every hole is in and the round is not finished, the small line reads "Every hole is in · open the card to finish".
  - When Stableford and the hole is worth 0 points: the small line is replaced by an underlined "Pick up" link (role button).
- Score stepper: "−" (a11y "One shot fewer"), value, "+" ("One shot more"). Value shows the par in a dashed empty style when no score (a11y "Enter par, {par}"), the score in a filled style otherwise ("Score {n}"), or "P" for a pick-up ("Picked up. Tap to clear"); hint "Press and hold to clear this hole" when set.
- Card button (a11y "Open scorecard"; grid icon): total ("–" before any score; "{n} pts"; or to-par / "NR") and "thru {n}"; when every hole is in and the round is in progress it turns lime and reads "Finish" (still opens the Scorecard sheet; finishing happens there).

##### Score entry rules
| Input | Rule |
|---|---|
| Tap empty score value | Enters par |
| Tap a pick-up | Clears the hole |
| Tap a numeric score | Nothing |
| Long-press the score value | Clears the hole (score, putts, fairway) |
| "−" / "+" on an empty hole | par − 1 / par + 1 |
| "−" / "+" on a pick-up | from net double bogey under the playing handicap (par + strokes received + 2) ± 1 |
| "−" / "+" on a score | ± 1, clamped to 1–20 (buttons never disable) |
| "Pick up" | Records "P" (Stableford only, when the hole is worth 0 points) |
| Score cleared or set to pick-up | Putts and fairway are cleared |
| Score lowered to ≤ putts | Putts reduced to score − 1 |
| Putts "−" | Disabled without a numeric score or when putts empty or 0 |
| Putts value tap | Empty → 2 (or score − 1 if lower, e.g. 0 on a hole-in-one); set → clear |
| Putts "+" | Empty → 2; then +1 up to min(10, score − 1); disabled without a numeric score or at the max |
| Fairway buttons | Disabled without a numeric score; par 4/5 only; tap toggles |

##### Finish rules
- Finish is only in the Scorecard sheet: "Finish round" is disabled until every hole has a score or pick-up; under it "{n} holes to go".
- On finish: pending autosave cancelled → `golfRoundFinish(id, entries)` → local copy removed → sheet closes → round becomes completed → alert "Round saved" / "{courseName}: {points} Stableford points[, {gross} gross]. Your stats are in My Golf." Buttons: "See My Golf" → `Main` → `MyGolf` tab; "Close" (cancel) → `goBack()`. (Dismissing with Android back leaves you on the finished round.)
- Failure: "Could not finish the round" / {message} (e.g. the API's "Enter a score (or a pick-up) on every hole before finishing. {n} to go." or a network error). The cancelled autosave is not re-queued; the local copy remains.
- A completed round reopened from Round Detail: status "Finished round · changes save"; edits autosave and the round stays completed; Scorecard footer shows only "Done"; no Discard.

##### Save, offline and retry
- Every change writes the full entries array to AsyncStorage (`flagrr_round_entries_{id}`) at once and schedules a server save 700 ms after the last change (debounced).
- Save success: if nothing changed meanwhile, local copy removed and status "Saved"; round status picked up if it changed.
- Save fails with HTTP 400: status goes back to "Saved" (even though the server rejected it) and alert "Could not save that score" / {API message}. Local copy is kept, so reopening the round re-sends it (and shows the alert again). Known case: clearing a hole on a completed round → "Enter a score (or a pick-up) on every hole before finishing. {n} to go."
- Any other failure (network, 5xx, 401, 404): status "Not saved yet · will retry", retry every 15 s until it succeeds. Retries keep running after leaving the screen (no cleanup), while the app process lives.
- Leaving the screen with a save pending sends it immediately.
- Reopening: a local copy with the right hole count always wins over the server and is re-saved.
- Opening the round while offline fails entirely (the round is fetched from the server first): load-error state, even if a local copy exists.
- Map fetch failure while online-but-flaky: falls back to the no-map state for the visit.

##### GPS
- No GPS or location code exists in the app (no `expo-location`). There is no permission prompt, no "far from course" state, no accuracy indicator and no live position. The only GPS element is the static chip "GPS integration coming soon". The ball is placed by dragging.

##### Handicap display (where it appears in the hole view)
- Header HCP button: Handicap Index used for the round (not the course or playing handicap), "–" with no index.
- Hole badge and score bar: strokes received on this hole ("1 shot", "gives back 1", "no shots"), dots.
- Scorecard sheet subtitle: "Playing handicap {p} · {pct}% of course handicap {c}" or "No handicap: scratch".
- Your round sheet rows (below).

##### Sheets (one open at a time; tapping the backdrop, the close "X" (a11y "Close") or Android back closes it; bottom sheet with grab handle, max 90% height, scrolls)
- **Scorecard** (title "Scorecard"): subtitle "{teeName} tees ({men|ladies}) · Playing handicap {p} · {pct}% of course handicap {c}" or "{teeName} tees ({men|ladies}) · No handicap: scratch". Body = Scorecard component (below) with the current hole highlighted and each hole cell tappable (a11y "Go to hole {n}") → closes sheet and goes to that hole. Footer, in progress: "Discard round" (secondary) and "Finish round" (+ "{n} holes to go"); completed: "Done".
  - "Discard round" → alert "Discard this round?" / "All the scores in this round will be deleted." Buttons "Discard round" (destructive: cancels pending autosave, `golfRoundDelete`, removes local copy, closes sheet, `goBack()`), "Keep playing" (cancel). Failure: "Could not discard the round" / {message}.
- **Your round** (title "Your round"; footer "Done"): rows "Course" {name}; "Tees" "{tee name} · Men|Ladies · CR {cr} · Slope {slope} · Par {par}"; "Holes" "{count} ({first}–{last})"; "Format" "Stableford|Stroke play · {pct}% allowance"; "Handicap Index" {index} or "None (scratch)"; when handicapped also "Course handicap" and "Playing handicap". Note: "These were fixed when the round started, so your shots and points can’t change mid-round. Change your Handicap Index or format before your next round." Read-only.
- **My bag** (title "My bag"; subtitle "How far you carry each club, in metres. The suggested shot uses these."): two-column list of clubs (sample bag: Driver 230, 3 Wood 210, 5 Hybrid 192, 5 Iron 178, 6 Iron 167, 7 Iron 156, 8 Iron 145, 9 Iron 133, PW 120, GW 106, SW 92, LW 75) with a number field per club ("{carry}", unit "m"; a11y "{club} carry in metres"). Footer "Reset to sample distances" (restores sample bag) and "Done". Closing by any route saves.
  - Validation: digits only (other characters stripped), max 3 characters, clamped 0–350; an empty field = 0 and shows blank; a club at 0 is left out of suggestions. Club names can't be edited; clubs can't be added or removed.
  - Save: on close, only if changed, `saveGolfProfile({ bag })`; failure is silent (bag still used this visit; not retried). Suggestions update live while typing.

##### Scorecard component (`components/golf/Scorecard.tsx`) — used in the Scorecard sheet and Round Detail
- Header row: "Hole", "Par", "SI", "Shots", "Score", "Putts" (only when the round tracks stats), "Pts" (Stableford) or "Net" (stroke).
- Hole rows: hole number + "{length} m"; par; SI; shots received as "●" ×1–4 or "+{n}" for strokes given back; score ("–" if not played, "P" for pick-up) with a mark: double circle eagle or better, circle birdie, square bogey, thick square double bogey or worse; putts or "–"; points, or net ("–" on a pick-up), blank if not played.
- Subtotal rows ("Out", "In", "Total" for 18; "Total" otherwise): par; blank; total strokes received (only with handicaps); gross, "NR" after a pick-up, "–" if none played; putts sum or "–"; points or net / "NR".
- Key: circle "Birdie or better", square "Bogey or worse", "●" "Shot received".
- Summary grid: "Stableford" "{pts} pts" + " thru {n}" until complete; "Net" "{net} ({to-par})" or "No return"; "Gross" "{gross} ({to-par})" or "No return"; "Handicap score" {adjusted}; each "–" before any hole.
- Note: "Handicap score is your adjusted gross: each hole is capped at net double bogey, the way the World Handicap System counts a round. A pick-up counts as net double bogey."

- **Actions (hole view summary):**

| Control | What it does | When available / conditions |
|---|---|---|
| Back | goBack, flush pending save | Always |
| HCP button | Your round sheet | Always (after load) |
| Bag | My bag sheet | Map loaded |
| Hole pill | Go to hole | Always |
| Map tap / drag / pinch / wheel | Target, ball, pan, zoom | Map loaded |
| Zoom in / Zoom out / Show the whole hole | Map zoom / fit | Map loaded |
| Map layers + 2 toggles | Show/hide arcs and hazard pills | Map loaded |
| Shot card collapse | Hide/show details | Map loaded |
| Show suggested shot | Drop custom target | Custom target set |
| Back to the tee | Ball to tee | Ball off the tee |
| Putts −/value/+ | Edit putts | Track stats on; numeric score |
| Fairway L / Hit / R | Toggle fairway | Track stats on; par 4/5; numeric score |
| Pick up | Record pick-up | Stableford; hole worth 0 points |
| Score − / value / + / long-press | Score entry rules | Always |
| Card button | Scorecard sheet | Always |
| Scorecard hole cell | Go to hole | In sheet |
| Discard round | Alert → delete | In progress |
| Finish round | Finish | In progress; all holes in |
| Done (scorecard) | Close | Completed |
| Bag field / Reset / Done | Edit/save bag | Bag sheet |

- **States:** loading (full-screen spinner); load error ("Could not load the round." or API message such as "Round not found." / network text, with outline "Back" button); map missing; round in progress vs completed; save states (Saved / Saving… / Not saved yet · will retry / Finished round · changes save); hole with no score / score / pick-up; all holes in (lime Finish card button, small-line hint); handicapped vs scratch (shots text, dots, subtitle); plus handicap (gives back); nine vs eighteen; stroke vs Stableford; trackStats on/off (extra bar, Putts column); par 3 vs par 4/5; ball on tee / off tee / on green; suggested vs custom vs risky target; shot card collapsed; layers open; arcs/hazards off; "Drag me" shown until first drag; light/dark map palette; Reduce Motion (sheet rise only); GPS: none.
- **Server calls:** `golfRound(id)` (load), `golfProfile()` (load, bag), `golfCourse(golfCourseId)` (map; failure → no-map), `golfRoundSave(id, entries)` (debounced autosave; 400 alert vs retry), `golfRoundFinish(id, entries)` (finish), `golfRoundDelete(id)` (discard), `saveGolfProfile({ bag })` (bag, silent failure). The API rejects saves for a round that isn't the member's ("Round not found.").
- **Board coverage:** AppHole (Light, Dark): hole pills 5–10, hole badge "Hole 7 / Par 4 · 362 m · SI 3", HCP button, Bag, GPS chip, green card, zoom/fit/layers controls, distance arcs, hazard pills, shot card (Suggested shot, Driver 230 m, Leaves/Next/Usual miss, why, Back to the tee, Hide shot details), score bar with result line, Pick up, score stepper, Putts stepper, Fairway Hit, scorecard total, Finish round. Dialog boards over it: DlgScorecard, DlgBag, DlgYourRound, DlgLayers, DlgFinish ("Round saved").
  - Board differs from code: board HCP shows "13" (code shows the Handicap Index with one decimal, e.g. "12.4", plus a tee-colour dot); board header has no course name or save-status line; hazard pills read "reach 261 m" / "carry 214 m" (code "{reach} / {carry}" in one pill); score bar shows Pick up, "12 holes to go" and a "Finish round" button together (code: Pick up only at 0 points, "holes to go" and Finish only inside the Scorecard sheet; the card button just says "Finish"); score result line "1 shot received · Par · net birdie · 3 pts" combines what code splits over two lines; DlgLayers is a bottom sheet with a third toggle "Suggested shot / Club and target from the tee" (code: small popover with two toggles, no suggested-shot toggle); DlgBag lists 10 clubs with different names (3 wood, 4 hybrid, Pitching wedge, Sand wedge) and different distances, and no Done button; DlgYourRound shows Tees "Middle · 71.4 / 127", Format, Handicap Index, Course handicap, Playing handicap (no Course, Holes, gender, Par rows, no Done); DlgScorecard subtitle "Strand Golf Club · Middle tees · Stableford", horizontal 9-column front-nine grid, "Out · thru 6 | 14 pts", "Hole 7 (in play)", Discard round, no Finish/Done (code: vertical table, different subtitle, Finish round in footer); DlgFinish copy "Your scorecard and stats are in My Golf." with "See My Golf" / "Done" (code: course + points + gross message, "See My Golf" / "Close").
  - **Not on any board:** loading spinner; load-error state + Back; no-map state and its message (and hidden Bag/cards); save-status line in all four variants; offline/retry behaviour; 400 "Could not save that score" alert; finish-failure alert; Discard round alert as raised from the hole view on a hole-view background (the DlgDiscard board shows it over the Course tab); discard-failure alert; completed-round mode ("Finished round · changes save", Done-only scorecard footer, no Discard); empty-score state ("Tap {par} for par", dashed par value); picked-up state ("Picked up", "P", "0 pts"/"No return"); "Every hole is in · open the card to finish" hint and lime "Finish" card button; long-press to clear; custom target chip "Your target" and risky "Your target · risky" with its why texts; "Show suggested shot" button; "From your ball · {n} m to pin"; collapsed shot card; on-green / chip shot suggestions; target reticle and miss ellipse; "Drag me" pill; ball drag and target drag; tap-to-aim; pinch/wheel zoom; layers popover open state on the map (as opposed to sheet); arcs/hazards turned off; Fairway "← L" / "R →" selected states; "Par 3: no fairway"; trackStats-off layout (no Putts/Fairway bar); stroke-play score bar ("Net {n}", to-par total, "NR"); scratch round (no shots text, "No handicap: scratch", "None (scratch)"); plus-handicap "gives back {n}"; nine-hole round (9 pills, Total-only scorecard); Scorecard In and Total rows, summary grid, WHS note, Putts/Net columns, score marks; tapping a scorecard hole to jump; bag field validation and silent save; Reset to sample distances result; dark map palette (exists only as AppHole Dark, sheets Dark exist for Bag/Layers/Your round/Scorecard/Finish/Discard); GPS chip is shown, but there are no GPS permission/far/accuracy states to board (none exist in code).

---

#### Round (`screens/golf/RoundDetailScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** Uses the same horizontal Scorecard. Everything else below is unchanged; errors through `friendlyError`.

- **Reached from:** My Golf "Recent rounds" rows (up to 8); Course tab "Played recently" rows (up to 3). Both lists contain completed rounds only.
- **Shows:** header "Round" with back. Hero tile: course name (header role); "{date} · {tee} tees ({men|ladies}) · CR {cr 1dp} / {slope}" where date = completedAt (or startedAt) in en-ZA "weekday short, day, month long, year" (e.g. "Sat 21 November 2026"; exact rendering locale-dependent); handicap line "No Handicap Index (scratch)" or "Index {index} · course handicap {c} · playing {p} ({pct}%)"; big "{points}" "pts" (count-up) and "{gross}" "gross" when there was no pick-up. Scorecard tile (full Scorecard component, not tappable, no highlight). Primary button "Correct a score" (completed) or "Resume round" (in progress; not reachable from current lists). Text button "Delete round" (danger colour).
- **Actions:**

| Control | What it does | When |
|---|---|---|
| Back | goBack | Always |
| "Correct a score" / "Resume round" | Navigate `CourseGuide { roundId }` | Loaded |
| "Delete round" | Alert "Delete this round?" | Loaded |

- **States:** loading spinner; error (plain text, e.g. "Round not found." / "Could not load the round."; no retry button); loaded; reloads on every focus (so corrections made in the hole view show on return); stroke-play rounds still show points in the hero; nine-hole rounds (Total-only scorecard); trackStats rounds (Putts column); scratch rounds; light/dark; Reduce Motion (Appear/CountUp).
- **Alerts:** "Delete this round?" / "It will be removed from your scorecards and My Golf stats. This can’t be undone." Buttons "Delete round" (destructive) → `golfRoundDelete` → goBack; "Keep it" (cancel). Failure: "Could not delete the round" / {message}.
- **Validation:** none.
- **Server calls:** `golfRound(id)` on focus; `golfRoundDelete(id)` on confirm.
- **Board coverage:** AppRoundDetail (Light, Dark): course, "Sat 21 Nov · Middle tees · HCP 13", 37 pts / 84 gross, OUT/IN horizontal grids (Hole/Par/Score/Pts), Delete round. DlgDeleteRound (Light, Dark).
  - Board differs from code: board sub-line format and "HCP 13" (code shows gender, CR/slope, and a separate Index/course/playing line); board scorecard is two horizontal grids without SI, Shots, Putts, Net or summary; DlgDeleteRound copy "Its scores come out of your My Golf stats." with "Delete round" / "Cancel" (code: "It will be removed from your scorecards and My Golf stats. This can’t be undone." / "Keep it").
  - **Not on any board:** "Correct a score" button (and the "Resume round" variant); handicap line (index/course/playing/allowance) and "No Handicap Index (scratch)"; CR/slope and gender in sub-line; scorecard SI, Shots, Putts, Net columns, Total row, key, summary grid and WHS note; hero without gross (pick-up round); stroke-play round; nine-hole round; loading; error text; delete-failure alert.

---

#### My Golf tab (`screens/golf/MyGolfScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** Bento layout per the boards; the points chart sits in the hero, keeps its 0/10/20/30/40 values and gridlines, and a tapped bar turns white. Everything else below is unchanged.

- **Reached from:** bottom tab "My Golf"; Home "My Golf" link on the Points Earned Per Month tile (`HomeScreen.tsx:334`); Course tab "Your game" tile; hole view finish alert "See My Golf".
- **Shows:**
  - Eyebrow "Your game", H1 "My Golf", sub "From the scorecards you’ve kept in Flagrr".
  - **Coming soon card** (no completed rounds ever and the home club's map is not live): chip "Coming soon", title "My Golf", body "{clubName}’s course map is on its way." (or "Your club’s course map is on its way.") + " Once you’ve kept a scorecard on a Flagrr course map, your Stableford average, scoring by par, toughest holes and more appear here."; button "Play an away course" (only when any course map is live) → Course tab.
  - **First round card** (no completed rounds, home map live): "Play your first round" / "Keep your scorecard in the Course tab and your stats appear here when you finish." / "Go to Course" → Course tab.
  - **Hero** (any completed round ever): "Stableford average" {avg 1dp or "–"} "pts" (count-up); "{n} {18|9}-hole round(s) {this month|this year|in total}" or "No rounds {period}"; Handicap Index pill "Handicap Index" / {profile index or "–"} / "as entered"; cells "{x} of {n}" / "played to handicap ({36|18}+ pts)" and "{best} pts" / "best · {d Mon}" (or "–" / "best round").
  - **Stats header** "Stats" with segmented control "Month" / "Year" / "All" (a11y "Stats period"; default Year; not remembered).
  - Period with no rounds: "No rounds {period}. Pick Year or All to see earlier rounds."
  - **Tiles:** "Rounds" {n} / "{holes} holes"; "Scoring average" {adjusted avg 1dp or "–"} / "handicap score, {basis} holes"; "Best score" {lowest gross without pick-up or "–"} / {d Mon} or "no round without a pick-up"; "Doubles or worse" {per 18, 1dp} / "per 18 holes".
  - **Points per round** chart: "Stableford, {your last 20 rounds|oldest to newest}. The line at {36|18} is playing to your handicap."; bar per round (basis rounds, last 20), horizontal grid 0/10/20/30/40, reference line, best value labelled, first and last dates; tap a column → highlighted and caption "{pts} pts[ · {gross} gross] · {d Mon} · {course}"; tap again hides; otherwise "Tap a column for that round."
  - **Average score by par**: "Strokes per hole, with pick-ups counted as net double bogey"; row per par 3/4/5 present: "Par {p}", bar (over-par, full at +2), "{avg 2dp}" "{±diff 2dp}"; insight "Par {p}s cost you the most: {x} shots a round over par." when positive.
  - **Score mix**: "Holes per 18"; stacked bar and legend "Birdie or better", "Par", "Bogey", "Double+" with values (fixed chart colours); insight "Doubles cost you {x} shots per 18 more than bogeys would. Turning half of them into bogeys is worth about {x/2} shots." when > 0.
  - **Your toughest holes** (home course if played twice in the period, else the most-played course with 2+ rounds; holes played at least twice; top 3 by average over par): "At {course} · {n} rounds"; rows hole number, "Par {p} · Stroke index {si}", "{x} points on average", "{±over}" / "avg over par".
  - **Front nine and back nine** (18-hole rounds only; average adjusted strokes): "Front nine" {x}, "Back nine" {y}; insight "You score about the same on both nines." (difference < 0.5) or "You average {d} more on the {front|back} nine" + ". A proper warm-up could help." (front higher) / ". Watch for fatigue and a slipping routine late in the round." (back higher).
  - **Putting and ball striking**: with putts entered: "From the {n} holes where you entered putts"; "Putts" {per 18} "per 18 holes"; "Three-putts" {per 18} "per 18 holes"; "Greens in reg." "{n}%" "of holes"; "Fairways" "{n}%" with "missed {l}% left · {r}% right", or "–" with "enter fairways on par 4s and 5s". Without: "Turn on “Putts and fairways” when you start a round to unlock these" and three dashed cells "Putts", "Fairways", "Greens in reg." with "–".
  - **Recent rounds** (up to 8, newest first): date box (day, short month en-ZA); course name + "BEST" badge on the best-points round; tee dot, "{tee} tees · 18 holes" or "holes {a}–{b}" + " · playing {p}" when handicapped; "{pts} pts" and "{gross} gross" or "{adjusted} adj." (pick-up rounds).
  - **Share card** (whenever data loaded and the club is not a placeholder, including empty states): "Share my rounds with {clubName|my club}"; on: "Your club can see the rounds you play on its course, your scorecards and the stats from them. Turn this off to keep them to yourself."; off: "Your rounds are private. Your club can’t see your scorecards or golf stats."; toggle (a11y same as title).
- **Actions:**

| Control | What it does | When |
|---|---|---|
| Pull to refresh | Reload stats for the current period | Always |
| "Try again" (outline) | Reload | Error |
| "Play an away course" | Course tab | Coming soon state with any live map |
| "Go to Course" | Course tab | First-round state |
| Month / Year / All | Changes period, reloads, clears chart caption | Has rounds |
| Chart column tap | Show/hide that round's caption | Chart shown |
| Recent round row | `RoundDetail { roundId }` | Has rounds in period |
| Share toggle | Optimistic flip, `saveGolfProfile({ shareWithClub })`; reverts on failure | Not placeholder club; disabled while saving |

- **States:** loading spinner; error card (message or "Could not load your stats.") with Try again (stale data still shows); coming soon (with/without away button); first round; has rounds but none in period (hero + empty text); full; trackStats never used (locked putting); no fairway data; no toughest holes; no 18-hole rounds (no nines card, 9-hole basis); placeholder club (no share card); share on/off/saving; light/dark; Reduce Motion (FadeIn, CountUp, PressableScale).
- **Alerts:** share save failure: "Couldn’t save that" / {message} or "Try again.".
- **Validation:** none.
- **Server calls:** `api.golfStats(period)` → GET `/courses?action=golfStats&period=` on focus, on period change and refresh (stats computed server-side from completed rounds completed since the period start; `totalRounds` all-time; also returns clubName, isPlaceholderClub, homeMapLive, anyCourseLive, handicapIndex, trackStats, shareWithClub). `api.saveGolfProfile({ shareWithClub })`.
- **Board coverage:** AppMyGolf (Light, Dark), AppMyGolfFull: header, period control, hero (average, played to handicap + best merged into one line, Handicap Index pill), chart with values, tiles, par averages + insight, score mix + insight, toughest holes, nines, putting, recent rounds with BEST, share card (on). AppMyGolfEmpty (Light, Dark): "Play your first round", "Go to Course", "Play an away course", "Coming soon".
  - Board differs from code: board's empty board mixes the first-round card and the coming-soon chip/"Play an away course" (in code they are two separate states that never show together) and shows no share card (code shows it in empty states too); board front/back nine is "avg pts" with "1.0 point more on the front nine. Watch for fatigue…" (code: average adjusted strokes; more on the front gives the warm-up advice, more on the back gives the fatigue advice); board toughest-hole rows "Hole 7 · par 4 / +1.6 avg over par" (code also shows stroke index and points on average, plus an "At {course} · {n} rounds" sub); board recent rows "Strand Golf Club · 84 gross" (code: tee dot, tees, holes, playing handicap; gross/adj. on the right); board tiles carry a shared footnote "Best score: Sat 7 Nov · Doubles or worse: per round" (code: per-tile subs, doubles are per 18 holes); board fairway cell without the missed-left/right line.
  - **Not on any board:** loading; error card + Try again; true coming-soon card (club map on its way, with club name) as its own state; coming-soon without "Play an away course"; period with no rounds text; hero "No rounds {period}" variant; chart caption after tapping a column and the selected bar; "your last 20 rounds" subtitle variant; par-average bars/sign values; insights hidden when not positive; "Double+" legend label; locked putting card; "enter fairways on par 4s and 5s"; "{adjusted} adj." for pick-up rounds; "holes {a}–{b}" and "playing {p}" in recent rows; 9-hole basis (18+ pts); no-index "–" in the pill; share card off copy; share toggle disabled/saving; share failure alert; share card hidden for placeholder clubs; pull to refresh.

---

### Server calls reference (`api/client.ts` lines 275–298)

| Function | Endpoint | Used by |
|---|---|---|
| `golfHome()` | GET `/courses?action=golfHome` | Course tab, Round Setup 409 path, Home |
| `golfCourse(id)` | GET `/courses?action=golfCourse&id=` (live maps, or any map the member has a round on) | Round Setup, hole view |
| `golfProfile()` | GET `/courses?action=golfProfile` | Round Setup, hole view |
| `saveGolfProfile(partial)` | POST `/courses?action=golfProfile` | Round Setup (index, trackStats), hole view (bag), My Golf (shareWithClub) |
| `golfRoundStart(payload)` | POST `/courses?action=golfRoundStart` (409 when a round is in progress) | Round Setup |
| `golfRound(id)` | GET `/courses?action=golfRound&id=` | Hole view, Round Detail |
| `golfRoundSave(id, entries)` | POST `/courses?action=golfRoundSave` | Hole view autosave |
| `golfRoundFinish(id, entries)` | POST `/courses?action=golfRoundFinish` | Hole view finish |
| `golfRoundDelete(id)` | POST `/courses?action=golfRoundDelete` | Course tab, Round Setup, hole view, Round Detail |
| `golfStats(period)` | GET `/courses?action=golfStats&period=` | My Golf, Course tab (year) |

All calls: bearer token, `cache: 'no-store'`; a non-2xx response throws `ApiError(status, data.error || "Request to {path} failed")`; a network failure throws the platform's fetch error (not an `ApiError`). No request timeout and no automatic retry except the hole view's 15 s save retry.

---

### Not on any board

1. Course tab: loading spinner.
2. Course tab: error tile with "Try again".
3. Course tab: Coming soon home-course tile (placeholder club copy).
4. Course tab: Coming soon home-course tile (club named, "Yours is on the way.") and the " In the meantime you can play any course below." suffix.
5. Course tab: away course list rows (logo/flag, location, hole count, "Played recently" tag, chevron).
6. Course tab: search no-match text "No mapped course matches “{query}”."
7. Course tab: "Course maps are coming soon. We’re adding them as clubs join Flagrr." empty text.
8. Course tab: "All holes in" hero state.
9. Course tab: "Round in progress" alert when starting another round ("Resume round" / "Close").
10. Course tab: its own Discard copy ("Your scores at {course} will be deleted. This can't be undone." / "Keep it").
11. Course tab: discard failure alert "Could not discard the round".
12. Course tab: pull to refresh.
13. Course tab: Your game tile with "–" average and no recent rows.
14. Round Setup: Men/Ladies Rating segment.
15. Round Setup: tee meta line (length · CR · slope).
16. Round Setup: "no separate nine-hole ratings yet" hint.
17. Round Setup: Handicap Index text field and placeholder "14.2".
18. Round Setup: invalid Index error "Enter a number from +10.0 to 54.0, like 14.2." and red border.
19. Round Setup: allowance hint (WHS 95% / committee 100%).
20. Round Setup: 100% allowance option.
21. Round Setup: calculation tile (Rating row, Course handicap, Playing handicap, formula note, nine-hole ÷ 2 note).
22. Round Setup: no-index note "Without a Handicap Index you get no shots, and points are scored against par."
23. Round Setup: loading spinner and load-error text.
24. Round Setup: Start button loading/disabled state.
25. Round Setup: "Discard it" option in the in-progress alert, and auto-restart after discarding.
26. Round Setup: fallback alert "You already have a round in progress. Open the Course tab to finish or discard it."
27. Round Setup: generic "Could not start the round" alert with API messages.
28. Round Setup: discard-failure alert.
29. Hole view: loading spinner.
30. Hole view: load-error state with "Back".
31. Hole view: no-map state and message; Bag and cards hidden.
32. Hole view: header course name.
33. Hole view: save-status line ("Saved", "Saving…", "Not saved yet · will retry", "Finished round · changes save").
34. Hole view: offline autosave with 15 s retry, local copy, local copy winning on reopen, background retries after leaving.
35. Hole view: "Could not save that score" (HTTP 400) alert.
36. Hole view: cannot open a round while offline (load fails despite local copy).
37. Hole view: finish failure alert "Could not finish the round".
38. Hole view: Discard alert raised from the Scorecard sheet over the hole view ("Keep playing"), and its failure alert.
39. Hole view: completed-round correction mode (Done-only footer, no Discard, autosave keeps the round completed).
40. Hole view: clearing a hole on a completed round is rejected (400 alert, status still "Saved").
41. Hole view: empty-score state ("Hole {n} · {shots}" / "Hole {n} score", "Tap {par} for par", dashed par value).
42. Hole view: picked-up state ("Picked up", "P", "0 pts" / "No return").
43. Hole view: "Every hole is in · open the card to finish" hint and lime "Finish" card button.
44. Hole view: long-press the score to clear; tap a pick-up to clear; tap empty to enter par.
45. Hole view: stepping from a pick-up (net double bogey ± 1) and the 1–20 clamp.
46. Hole view: putts auto-clamped below the score, and putts/fairway cleared with the score.
47. Hole view: disabled Putts and Fairway controls before a score.
48. Hole view: "Par 3: no fairway".
49. Hole view: Fairway "← L" / "R →" selected states.
50. Hole view: trackStats-off layout (no Putts/Fairway bar).
51. Hole view: stroke-play score bar ("Net {n}", to-par total, "NR") and no Pick up in stroke play.
52. Hole view: scratch round (no shots text, "No handicap: scratch").
53. Hole view: plus handicap "gives back {n}" and "+{n}" in the Shots column.
54. Hole view: nine-hole round (9 pills, back-nine numbering, Total-only scorecard).
55. Hole view: "Your target" and "Your target · risky" chips with custom-target why texts.
56. Hole view: "Show suggested shot" button.
57. Hole view: "From your ball · {n} m to pin".
58. Hole view: collapsed shot card.
59. Hole view: on-green (Putter), chip and short-wedge suggestion copy; "Leaves" = "Putt"/"–"; "Next" = "Putter"/"Chip".
60. Hole view: in-reach suggestion copy (water/bunker near the green, top of range, take a little off).
61. Hole view: target reticle, dispersion ellipse, leg distance pills, dashed target-to-pin line.
62. Hole view: "Drag me" pill.
63. Hole view: dragging the ball, dragging the target, tap to aim.
64. Hole view: pinch zoom and web mouse-wheel zoom; auto-fit and refit rules.
65. Hole view: layers as a popover beside the map controls (board shows a sheet), closing on map touch.
66. Hole view: arcs off / hazard distances off views.
67. Hole view: hole-pill scored dots.
68. Hole view: Scorecard sheet with code's subtitle (tees, gender, playing/course handicap or scratch).
69. Hole view: Scorecard sheet "Finish round" button disabled with "{n} holes to go".
70. Hole view: tapping a scorecard hole to jump to it; current-hole row highlight.
71. Scorecard component: vertical table with Hole length, SI, Shots, Putts, Net columns.
72. Scorecard component: In and Total rows, "NR" subtotals.
73. Scorecard component: summary grid (Stableford, Net, Gross, Handicap score) and WHS note.
74. Scorecard component: score marks (eagle double circle, double-bogey thick square).
75. Your round sheet: Course, Holes, gender and Par rows; "None (scratch)"; Done button.
76. My bag sheet: Done button, code's 12 sample clubs, digits-only/0–350/3-char field rules, blank = 0 = excluded club.
77. My bag sheet: save on any close, silent failure.
78. Finish alert with code copy ("{course}: {pts} Stableford points, {gross} gross. Your stats are in My Golf." / "See My Golf" / "Close") and its Close → back behaviour.
79. Round Detail: "Correct a score" button (and "Resume round" variant).
80. Round Detail: handicap line and "No Handicap Index (scratch)".
81. Round Detail: CR/slope and gender in the sub-line.
82. Round Detail: hero without gross (pick-up round).
83. Round Detail: loading and error text.
84. Round Detail: code's delete copy ("It will be removed from your scorecards and My Golf stats. This can’t be undone." / "Keep it").
85. Round Detail: delete-failure alert.
86. My Golf: loading spinner.
87. My Golf: error card with "Try again".
88. My Golf: coming-soon card as its own state ("{club}’s course map is on its way…").
89. My Golf: coming-soon card without "Play an away course" (no live maps).
90. My Golf: period with no rounds ("No rounds {period}. Pick Year or All…") and hero "No rounds {period}".
91. My Golf: chart caption after tapping a column, selected bar, "your last 20 rounds" subtitle.
92. My Golf: par-average bars and ±values; insights hidden when not positive.
93. My Golf: toughest-holes sub-line "At {course} · {n} rounds", stroke index and points-on-average.
94. My Golf: front/back nine as adjusted strokes with the three insight variants.
95. My Golf: locked putting card ("Turn on “Putts and fairways”…").
96. My Golf: fairway "missed {l}% left · {r}% right" and "enter fairways on par 4s and 5s".
97. My Golf: recent-round tee dot, tees, "holes {a}–{b}", "playing {p}", "{n} adj.".
98. My Golf: 9-hole basis ("18+ pts", "9-hole rounds").
99. My Golf: Handicap Index pill "–" (no index).
100. My Golf: share card off copy, disabled-while-saving toggle, hidden for placeholder clubs, shown on empty states.
101. My Golf: share failure alert "Couldn’t save that".
102. My Golf: pull to refresh.
103. All golf screens: Reduce Motion behaviour (no board shows it).
104. GPS: no permission, far-from-course or accuracy states exist in code, so none can be boarded; only the static "GPS integration coming soon" chip (which is on AppHole).

## E. Profile and support
Scope: member app, Expo SDK 58. Code read on 2026-11-24 from `mobile/src` (branch `claude/member-store-build`, working tree as found) plus the server handlers in `api/profile/index.ts` and `api/_lib/enquiries.ts` to get exact server error strings. Boards checked: the Light `.dc.html` files in the Bento canvas project folder plus `canvas.json` (the Dark board files are listed in `canvas.json` but are not in the local folder, so their content was not read; assumed to mirror Light).

Conventions used below:
- "Generic error" = the client fallback text `Something went wrong. Please try again.` used whenever the thrown error is not an `ApiError` (network failure, offline, JSON parse, file-system error).
- `ApiError.message` = the server's `{ error }` string, or `Request to <path> failed` if the body had none. Every server 500 arrives as `Internal server error`. An expired/missing session arrives as `Not authenticated` (401) and is shown in whatever alert that screen uses; no screen in this area logs the member out on 401.
- All alerts go through `showAlert` (`utils/alert.ts`) → the app's own branded modal (`AppAlertHost`) on every platform, including web. An alert given no buttons shows a single `OK` button.
- "Legacy-bridged screen" = screen still on the old StyleSheet, fed Bento colours through `useBentoLegacy()` + `systemFonts(..., { minFontSize: 12 })` (Poppins mapped to the system font, any font size under 12 lifted to 12, Fraunces 700 kept for hero titles). These screens use `ScreenHeader` (glass back button labelled `Back`, centred title). Only Member Profile is a native Bento screen (`BentoScreen`, `Appear`, `BentoTile`).
- Store build vs web build: `IS_STORE_BUILD` (`config/buildConfig.ts`, `EXPO_PUBLIC_STORE_BUILD=1` in eas `preview`/`production`) is only read by `AuthNavigator` and `LandingScreen`. Nothing in this area changes between the store binary and the web build except the Platform-specific behaviour listed per screen (photo picking, export, date picker, keyboard avoidance, share).
- Unverified member (`user.verifiedMember === false`): no screen in this area reads it. Nothing changes.
- Light/dark: every screen in this area re-themes from Bento tokens (`t.ground`, `t.tile`, `t.ink`, `t.muted`, `t.accent`, `t.hair`, `t.danger`…). StatusBar style flips (`dark-content` light / `light-content` dark).
- Reduce Motion: `prefersReducedMotion()` (OS setting on native, `prefers-reduced-motion` media query on web).

---

#### Member Profile (`screens/profile/MemberProfileScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** Bento layout per the boards: 68 pt avatar with camera badge, an **Edit Profile** header button (as on the boards; opens the same Edit Profile), Phone among the Details rows, Log Out as a secondary button and Delete Account as a red link. Password and Delete sheets use labelled fields with eye toggles; the delete copy says "Flagrr Cash" (was "points"). **Choose Golf Club** has search (approved) and club monograms; a failed list still shows an empty box. Alerts use `friendlyError` (technical text → plain message; member-facing server text kept). Everything else below is unchanged.

- **Reached from:**
  - Bottom tab bar `Profile` tab (`MainTabNavigator`, 6 tabs today: Home, Course, MyGolf, Rewards, Activity, Profile; Scan sits in the custom `BentoTabBar`).
  - Home: avatar button top-right (`accessibilityLabel="Profile"`, `HomeScreen.tsx:164`).
  - Home: "Your Club" tile (`accessibilityLabel="Your Club: <homeClub or 'Not specified'>"`, `HomeScreen.tsx:290`).
  - Help Center FAQ answer text tells members "open My Profile and tap Club" (text only, not a link).
  - Terms text references "Profile > Export My Data", "Profile > Edit Profile", "Profile > Delete Account", "Profile > Notification Preferences" (text only).
- **Shows:** (all from `useApp()` state loaded by `loadAll()` → `GET /api/me?period=year` etc.; screen sits under the floating tab bar, `BentoScreen tabBar`, contour backdrop, no header row/back button)
  1. Avatar 88 pt (`BentoAvatar`): uploaded photo `user.avatarUrl` (a data URI) or, if none, initials (first letter of first + last name, upper-cased) in lime Fraunces on fairway green. Camera badge (30 pt accent circle, `camera` icon) bottom-right; badge shows a spinner while uploading.
  2. Name: `{firstName} {lastName}`, h1 28 pt, header role.
  3. Subline: `{homeClub} · ` (omitted if `homeClub` empty) followed by tier name (`Bronze`/`Silver`/`Gold`/`Platinum`) in accent, semibold.
  4. Stats tile, three columns divided by hairlines, each value animated with `CountUp` (re-counts on every focus):
     - `points.balance` → label `Flagrr Cash`
     - `streak.weeks` → label `Week Streak`
     - `stats.roundsPlayed9 + stats.roundsPlayed18` → label `Rounds Played` (these are the *current stats period* figures, default `year`; if the member changed the stats period elsewhere, this follows it; no period shown).
  5. Hero tile (fairway green) `Refer a Friend` eyebrow (lime) + `Bring your four-ball` (white, 22 pt) + lime circle with `arrowUpRight` icon. Whole tile tappable.
  6. Section `Activity` (eyebrow + tile): rows `Reward Activity` (icon activity), `Receipt History` (icon receipt), each with chevron.
  7. Section `Details` (label/value rows, label 110 pt wide muted, value right-aligned semibold, max 2 lines):
     - `Name` → `{firstName} {lastName}`
     - `Phone` → `user.phone` or `—`
     - `Email` → `user.email`
     - `Birthday` → `user.dateOfBirth` formatted `toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })` (device locale, e.g. `07/03/1990` en-ZA/en-GB, `03/07/1990` en-US), or `—`. Parsed with `new Date(iso)` (UTC midnight for `YYYY-MM-DD`; could show the previous day in timezones west of UTC — unverified in practice, SA is UTC+2).
     - `Club` → `user.homeClub`; shows `Updating…` while a club change is in flight.
     - `Member Since` → `user.memberSince` same dd/mm/yyyy device-locale format. Not tappable (no chevron, 16 pt spacer instead).
     - Accessibility label per row: `<label>: <value>`; tappable rows have role button.
  8. Section `Support`: rows `Help Center` (icon info), `Contact Your Club` (icon golfFlag), `My Enquiries` (icon bell), `Give Feedback` (icon check).
  9. Section `Settings`: `Appearance` label + segmented control (`Light` / `Dark` / `System`, accessibility label `Theme`, radio group) showing the current `ThemeContext.preference`; row `Notification Preferences` (icon bell); row `Security` with sub-line `Change your password` (icon info).
  10. Section `Account`: row `Export My Data` (icon arrowUpRight; spinner replaces chevron while busy); row `Terms and Privacy` (icon info); row `Log Out` (icon back, "plain": no chevron); row `Delete Account` (icon close, danger red text + red-tinted icon chip, no chevron).
  - Not shown although available in state: `unreadNotificationCount` is destructured but unused (no bell/badge on Profile); tier is not tappable (Member Tiers is not reachable from here); `verifiedMember` not shown; `courseLogoUrl` not shown.
- **Actions:**

| Control | What it does | When available / conditions |
|---|---|---|
| Avatar (button, label `Change profile photo`) | `pickAndResizeAvatar()` → media-library permission → system photo picker (images only) → resize to 480 px wide JPEG q0.7 → data URI → `updateAvatar()` → `POST /api/profile` `{ imageBase64 }` → `user.avatarUrl` replaced (updates every `BentoAvatar`, e.g. Home). Picker cancelled = nothing happens. | Disabled while uploading (badge spinner). No crop UI (circle crop is visual only). No "remove photo". |
| Refer a Friend hero tile | `navigate('Referral')` | Always |
| Reward Activity | `navigate('Activity')` (the Activity tab) | Always |
| Receipt History | `navigate('ReceiptHistory')` | Always |
| Name / Phone / Email / Birthday rows | `navigate('EditProfile')` | Always |
| Club row | Opens the **Choose Golf Club** sheet and fetches `GET /api/courses` | Disabled (no onPress, no chevron) while `changingClub` |
| Member Since row | none | — |
| Help Center | `navigate('HelpCenter')` | Always |
| Contact Your Club | `navigate('Contact')` | Always |
| My Enquiries | `navigate('MyEnquiries')` | Always |
| Give Feedback | `navigate('GiveFeedback')` | Always |
| Appearance segment (Light/Dark/System) | `updateThemePreference(v)` → `POST /api/profile?action=themePreference` `{ preference }` → `user.themePreference` set → `ThemeContext.setPreference()` (applies theme, persists to AsyncStorage). Re-tapping the current segment still calls the server. | Whole control ignores touches (`pointerEvents="none"`) while saving; no visible spinner |
| Notification Preferences | `navigate('NotificationPreferences')` | Always |
| Security (`Change your password`) | Opens **Change your password** sheet | Always |
| Export My Data | `exportMyData()` → `downloadMyDataExport()` (see Server calls) | Row disabled + spinner while exporting |
| Terms and Privacy | `navigate('TermsPrivacy')` | Always |
| Log Out | `logout()` immediately: clears token (AsyncStorage), resets all member state, `isAuthenticated=false` → root navigator swaps to Auth stack (Landing). **No confirmation.** | Always |
| Delete Account | Opens **Delete your account?** sheet | Always |

- **States:**
  - Loading: none of its own; data comes from the already-loaded app state. Club picker has its own spinner.
  - Empty values: phone/birthday show `—`; no avatar → initials; empty `homeClub` → subline shows tier only.
  - Placeholder club: Club row shows `My Club Isn't Listed Yet` (the placeholder course name from migration 043); no special treatment. The club picker lists the placeholder course last (server sorts `order by is_placeholder, name`) so a member can switch to or away from it.
  - Error: only via alerts (below). Offline: every action falls into its alert with the generic error.
  - Web vs native:
    - Photo: native shows the OS permission prompt then the photo library; web `requestMediaLibraryPermissionsAsync` resolves granted and opens the browser file chooser (runtime behaviour on web unverified).
    - Export: web downloads `flagrr-my-data.json` via Blob + temporary `<a download>`; native writes `flagrr-my-data.json` to the cache directory and opens the OS share sheet (dialog title `Your Flagrr Data`, mime `application/json`); if `Sharing.isAvailableAsync()` is false → "Not available here" alert.
    - Sheets: `BentoSheet` is an RN `Modal`; on web the backdrop also gets a 5 px backdrop blur.
  - Store build vs web build: identical.
  - Light/dark: Bento tokens; hero tile is fairway green with lime accents in both; danger row uses `t.danger` and a fixed `rgba(200,50,42,0.10)` chip.
  - Reduce Motion: `Appear` tiles render without rise/reveal; `CountUp` shows final values; sheets appear without the rise (fade only); segmented-control thumb jumps instead of sliding.
  - Unverified member: no difference.
- **Alerts, sheets, toasts:**
  - **Avatar permission denied** — title `Permission needed`, message `Photo library access is needed to choose an image.`, button `OK` (closes).
  - **Avatar upload failed** — title `Couldn’t update profile picture`, message = `ApiError.message` (e.g. `imageBase64 must be a jpeg/png/webp data URI`, `Image is too large`) or generic; `OK`.
  - **Choose Golf Club sheet** (`BentoSheet`, title `Choose Golf Club`, no subtitle, close × button, backdrop tap / Android back closes): spinner (accent) while loading; then a bordered list of every course from `/api/courses` (name + radio circle; current club `courseId` shows filled accent radio; role `radio`, `checked` state). No search, no logos, no count. If the fetch fails the list is silently empty (empty bordered box; no message).
    - Tap a row → sheet closes. If it is the current club → nothing else. Otherwise → **Change home club?** alert.
  - **Change home club?** — title `Change home club?`, message `Switch your home club to <course name>? Your rewards and any ads shown in the app will update to match.`, buttons `Cancel` (cancel style, closes) and `Switch` → `changeHomeClub(id)` → `POST /api/profile?action=changeClub` `{ courseId }` then `loadAll()` (refetches me, rewards, vouchers, activity, receipts, notifications; re-hydrates theme). Club row shows `Updating…` meanwhile.
    - Failure → title `Couldn’t change club`, message `ApiError.message` (`courseId is required`, `Unknown course`) or generic; `OK`.
  - **Appearance failure** — title `Couldn’t update appearance`, message `ApiError.message` (`preference must be system, light, or dark`) or generic; `OK`. Segment stays on the previous value.
  - **Change your password sheet** (`BentoSheet`, title `Change your password`, subtitle `Security`):
    - `TextField` placeholder `Current Password` (secure, eye toggle labelled `Show password`/`Hide password`, a11y label `Current password`)
    - `TextField` placeholder `New Password` (secure, eye toggle, a11y label `New password`)
    - helper text `At least 8 characters. Use your new password next time you log in.`
    - `BentoButton` `Update Password` (spinner while saving).
    - Validation fail → alert `Missing info` / `Enter your current password and a new password (min. 8 characters).`
    - Success → fields cleared, sheet closed, alert `Password changed` / `Use your new password next time you log in.` / `OK`. Server also signs out every other device (deletes other sessions); this device stays signed in.
    - Failure → alert `Couldn’t change password` / `ApiError.message` (`Current password is incorrect` 401; `Current password and a new password (min. 8 characters) are required` 400) or generic. Sheet stays open with fields filled.
    - Closing the sheet without saving keeps whatever was typed (state is not cleared until success).
  - **Export results** — no success message on either platform (the download / share sheet is the feedback).
    - Native without sharing → title `Not available here`, message `Data export isn’t available on this device.`, `OK`.
    - Failure → title `Couldn’t export your data`, message `Could not generate your data export` (any non-2xx from the export endpoint, client-side string) or generic; `OK`.
  - **Delete your account? sheet** (`BentoSheet`, title `Delete your account?`, no subtitle):
    - body `Deleting your account permanently removes your profile, points, receipts, and reward history. This can’t be undone. Enter your current password to confirm.`
    - `TextField` placeholder `Current Password` (secure, eye toggle, a11y `Current password`)
    - outlined red pill button `Delete Account` (52 pt, red border + red text; red spinner while deleting; disabled while deleting)
    - text button `Cancel` (closes sheet).
    - Empty password → alert `Missing info` / `Enter your current password to confirm.`
    - Otherwise → second confirmation alert: title `Delete your account?`, message `This permanently removes your profile, points, receipts, vouchers, and message history. This can’t be undone.`, buttons `Cancel` (cancel) and `Delete Account` (destructive) → `deleteAccount(password)` → `POST /api/profile?action=deleteAccount` `{ password }` → on success `logout()` → Auth stack (Landing). No success message.
    - Failure → alert `Couldn’t delete account` / `ApiError.message` (`Current password is incorrect` 401; `Current password is required` 400) or generic; button re-enabled; sheet stays open.
  - Only one sheet can be open at a time (`sheet` state: `'club' | 'password' | 'delete' | null`).
- **Validation:**
  - Current password (change) → non-empty AND new password length ≥ 8 → else `Missing info` / `Enter your current password and a new password (min. 8 characters).` (one combined message, no per-field error). Server repeats the rule.
  - Delete password → non-empty → else `Missing info` / `Enter your current password to confirm.`
- **Server calls:**
  - `api.courses()` → `GET /api/courses` (no auth) → on Club row tap → list; any error → empty list, no message.
  - `api.changeHomeClub` → `POST /api/profile?action=changeClub` → after `Switch` → then `loadAll()`; errors as above. Note: if `loadAll()` fails after a successful change the same `Couldn’t change club` alert shows even though the change saved.
  - `api.updateAvatar` → `POST /api/profile` (no action; default branch) → stores the data URI inline in `users.avatar_url`; 400s as above.
  - `api.updateThemePreference` → `POST /api/profile?action=themePreference`.
  - `api.changePassword` → `POST /api/profile?action=changePassword`.
  - `downloadMyDataExport()` → `GET /api/profile?action=exportMyData` (Bearer token, `no-store`) → JSON attachment `flagrr-my-data.json` containing profile, points, streak, stats, receipts (no photos), activity, vouchers, notifications, enquiry and support-ticket threads, golf profile and rounds.
  - `api.deleteAccount` → `POST /api/profile?action=deleteAccount` → cascade-deletes all member data.
  - Theme is also re-hydrated from `me.user.themePreference` on every `loadAll()`.
- **Board coverage:**
  - Shown: AppProfile Light/Dark, AppProfileFull (layout, stats, referral hero, all sections, Appearance segment with one selected); DlgChooseClub; DlgChangeClub; DlgPassword; DlgExport (only the "Not available here" case); DlgDeleteAcct (the sheet only).
  - Differences between boards and code worth flagging (a redesign built from boards would lose or change these): boards have **no `Phone` row** in Details; boards show `Add your birthday` instead of `—` and `Member Since` as `Sep 2026` (code dd/mm/yyyy); referral hero has an extra line `15 FC per mate · 500 FC per club` (not in code); board header has an `Edit Profile` button (code has none; editing is via the Details rows); DlgChooseClub adds `Search clubs`, a club subtitle (`Strand, Western Cape · your home club`), a club monogram and `More clubs appear here as they join Flagrr.` (none in code); DlgChangeClub copy is `[New club] becomes your home club.` with `Change` / `Cancel` (code: `Switch your home club to …? Your rewards and any ads shown in the app will update to match.` with `Cancel` / `Switch`); DlgPassword helper omits `At least 8 characters.`; DlgExport copy `Export My Data isn’t available in the app yet.` (code: `Data export isn’t available on this device.`); DlgDeleteAcct body differs (board `Enter your current password to confirm. This can’t be undone.`).
  - Not shown by any board: avatar upload in progress (spinner badge); avatar with initials vs photo variants beyond the sample; photo-permission alert *on Profile* (DlgPhotoPerm is drawn over Edit Profile with different copy); `Couldn’t update profile picture`; club picker loading spinner; club picker empty/failed list; tapping the current club (no-op); `Updating…` club row; `Couldn’t change club`; `Couldn’t update appearance`; theme saving lock; password `Missing info`, `Password changed`, `Couldn’t change password`, sign-out-other-devices behaviour; export busy spinner; web download and native share-sheet export success; `Couldn’t export your data`; delete `Missing info`; the second **Delete your account?** confirmation alert (`Cancel` / `Delete Account`); deleting spinner; `Couldn’t delete account`; post-delete/post-logout return to Landing; Log Out having no confirmation; placeholder-club value in Club row; empty-phone `—`; stats re-count on focus; Reduce Motion rendering.

---

#### Edit Profile (`screens/profile/EditProfileScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** Labelled `BentoField`s (errors announced again: live region and `aria-invalid`); a Bento date field (iOS inline calendar card with Done, Android system dialog, web date input). Alerts use `friendlyError` (technical text → plain message; member-facing server text kept). Everything else below is unchanged.

- **Reached from:** Member Profile → Details rows `Name`, `Phone`, `Email`, `Birthday` (four entry points, same destination). Nothing else navigates here.
- **Shows:** legacy-bridged screen; header `Edit Profile` with back button; scrollable form pre-filled from `user`:
  - `TextField` icon person-outline, placeholder `First Name` ← `user.firstName`
  - `TextField` icon person-outline, placeholder `Last Name` ← `user.lastName`
  - `TextField` icon mail-outline, placeholder `Email`, `autoCapitalize="none"`, email keyboard ← `user.email`
  - `TextField` icon call-outline, placeholder `Phone Number`, phone-pad keyboard ← `user.phone ?? ''`
  - `DateField` placeholder `Date of Birth`, `maximumDate = today` ← `user.dateOfBirth`
  - `PillButton` `Save Changes`.
  - No avatar/photo control on this screen (photo is changed from the Profile avatar).
- **Actions:**

| Control | What it does | When available / conditions |
|---|---|---|
| Back (`Back`) | `navigation.goBack()`; edits discarded, no "discard changes?" prompt | Always |
| Text fields | Edit local state; typing in First Name clears its error; typing in Email clears its error | Always |
| Date of Birth field | Native iOS: opens a centred modal with inline calendar (`display="inline"`) + `Done` button; tapping backdrop also closes; date applies live as you pick. Android: system calendar dialog; applies only on OK (`event.type==='set'`). Web: browser `<input type="date">` with `max` = today (UTC date). Picker opens on 2000-01-01 when no date set. | Always. Cannot be cleared on native once set; on web the input can be cleared (sends empty → server stores null). |
| Save Changes | Validates, then `updateProfile({ firstName: trimmed, lastName: trimmed, email: trimmed, phone: trimmed or undefined, dateOfBirth or undefined })` → `POST /api/profile?action=update` → merges returned fields into `user` → `goBack()`. No success toast. | Button shows spinner and is disabled while saving |

- **States:**
  - Loading: none (pre-filled from memory). Saving: button spinner.
  - Display formats: DateField shows the chosen date as `toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })` e.g. `Mar 7, 1990` on native; on web the browser's own date-input format.
  - Clearing phone (empty) → sent as `undefined` → server stores `null` → Profile shows `—`. Last name may be blank. Email is lower-cased server-side.
  - Error states: inline red field error text + red border on First Name / Email; alert for server failure.
  - Offline: generic alert.
  - Web vs native: date picker as above; no `KeyboardAvoidingView` (keyboard may cover lower fields on native — relies on ScrollView).
  - Light/dark: Bento field look (tile fill, hairline border, accent border when focused, danger border on error); iOS date modal sheet uses `colors.background`, `Done` in accent.
  - Reduce Motion: n/a (no custom animation; native stack transition).
  - Placeholder club / unverified / store build: no difference.
- **Alerts, sheets, toasts:**
  - Save failed → title `Couldn’t save changes`, message `ApiError.message` (`firstName and email are required`, `Enter a valid email address`, `An account with this email already exists` 409) or generic; `OK`.
  - iOS date modal (`Done`).
- **Validation:**
  - First Name → trimmed non-empty → inline `First name is required`
  - Email → trimmed matches `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` → inline `Enter a valid email address`
  - Both checked together; both errors can show at once. Phone, last name, date: no client validation (date limited to ≤ today by picker).
- **Server calls:** `api.updateProfile` → `POST /api/profile?action=update` → on Save → success merges `{ firstName, lastName, email, phone, dateOfBirth }` into `user` and goes back; errors → alert above.
- **Board coverage:**
  - Shown: AppEditProfile Light/Dark (form with all five fields and Save Changes); DlgPhotoPerm is drawn over this screen.
  - Board differences: board has an avatar with `Change photo` on this screen (code has no photo control here; photo changes on Profile).
  - Not shown by any board: inline `First name is required` / `Enter a valid email address` errors; focused field state; filled date display; iOS inline date modal with `Done`; Android date dialog; web date input; saving spinner; `Couldn’t save changes` (incl. duplicate-email 409); silent go-back on success; back without saving discards edits.

---

#### Refer a Friend (`screens/profile/ReferralScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** Hero with the code (selectable) and a lime Share button (the phone's own share sheet), a progress tile with a bar. A failed load shows `LoadError` with **Try again** (owner decision; was an alert / endless spinner). Alerts use `friendlyError` (technical text → plain message; member-facing server text kept). Everything else below is unchanged.

- **Reached from:** Member Profile → `Refer a Friend` hero tile (only entry point).
- **Shows:** legacy-bridged; header `Refer a Friend` + back; hero title `Earn Flagrr Cash` (Fraunces 30 pt). Then, once loaded (`GET /api/profile?action=referralInfo`):
  - Code card: label `Your referral code`; the code (`info.code`, 34 pt, letter-spacing 4, fairway green); `PillButton` `Share My Code` with share icon; progress line:
    - not capped: `{redeemedCount} of {maxRedemptions} referral bonuses earned`
    - capped (`redeemedCount >= maxRedemptions`): `You've reached the {maxRedemptions}-referral limit — thank you!`
  - `How it works` label, two explainer rows:
    - icon person-add-outline, title `Refer a friend`, body `When a friend signs up and enters your code, you get ` + bold `{memberBonus} Flagrr Cash` + `.`
    - icon golf-outline, title `Refer a golf club`, body `When a golf club signs up for Flagrr using your code, you get ` + bold `{courseBonus} Flagrr Cash` + `.`
  - Footnote: `Your bonus is credited as soon as your friend's account is created, or once a referred club's first payment clears — you'll see it in your Activity feed and get a notification.`
  - Values come from the server (today `MEMBER_REFERRAL_BONUS = 15`, `COURSE_REFERRAL_BONUS = 500`, `MAX_REFERRALS_PER_MEMBER = 10` in `api/_lib/referrals.ts`); the code is created on first visit (`getOrCreateReferralCode`). Numbers are not formatted (no thousands separators).
- **Actions:**

| Control | What it does | When available / conditions |
|---|---|---|
| Back | `goBack()` | Always |
| Share My Code | RN `Share.share({ message: 'Join me on Flagrr! Use my referral code {code} when you sign up and we both earn Flagrr Cash.' })` → OS share sheet. Dismiss/cancel/error swallowed silently. | Only rendered once info loaded. Still available when capped. |

- **States:**
  - Loading: accent spinner under the hero title.
  - Error: alert, then **blank body** (header and `Earn Flagrr Cash` only; no retry).
  - Capped vs not capped progress copy (above).
  - Web: RN-web `Share.share` uses `navigator.share` where the browser supports it; where it doesn't, the promise rejects and the catch swallows it, so the button appears to do nothing (unverified at runtime).
  - No copy-to-clipboard control.
  - Light/dark: legacy-bridged colours; code text is fixed fairway green (`darkGreen`) in both modes.
  - Offline: generic error alert then blank body.
  - Reduce Motion / placeholder club / unverified / store build: no difference (a placeholder-club member can still share a code).
- **Alerts, sheets, toasts:**
  - Load failure → title `Couldn’t load your referral code`, message `ApiError.message` or generic; `OK`.
  - OS share sheet (system UI).
- **Validation:** none.
- **Server calls:** `api.referralInfo` → `GET /api/profile?action=referralInfo` → once on mount (not on refocus) → sets info; error → alert, body stays empty.
- **Board coverage:**
  - Shown: AppReferral Light/Dark, AppReferralFull, DlgShare (share sheet with the exact message text, `Messages`/`Mail`/`Copy`/`More` targets).
  - Board differences: board adds `Bring your four-ball` and a `+30 FC` earned chip (not in code); board explainer copy differs (`15 FC for every mate who signs up with your code.` / `500 FC once the club’s first payment clears.`); board has no footnote paragraph.
  - Not shown by any board: loading spinner; load-error alert and blank state; capped copy `You've reached the …-referral limit — thank you!`; the footnote; web share fallback.

---

#### Notification Preferences (`screens/profile/NotificationPreferencesScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** One tile of switches with a spinner in place of a switch while saving (revert plus alert on failure, as before). A failed load shows `LoadError` with **Try again** (owner decision). Alerts use `friendlyError` (technical text → plain message; member-facing server text kept). Everything else below is unchanged.

- **Reached from:** Member Profile → Settings → `Notification Preferences` (only entry point; Terms/Privacy text mentions it).
- **Shows:** legacy-bridged; header `Notification Preferences` + back; one card with three rows (label + description + `BentoToggle` switch):
  - `Account Activity` — `Receipts earned, redemptions, tier and streak rewards.`
  - `Support Replies` — `Replies to an enquiry you sent your club.`
  - `Club and Flagrr Announcements` — `Broadcasts from your club or the Flagrr team.`
  - Values from `GET /api/profile?action=notificationPreferences` (`notify_account_activity`, `notify_support_replies`, `notify_announcements`).
- **Actions:**

| Control | What it does | When available / conditions |
|---|---|---|
| Back | `goBack()` | Always |
| Each toggle (role `switch`, label = row label, `checked` state) | Optimistically flips the value, replaces that row's toggle with a small spinner, sends all three values `POST /api/profile?action=updateNotificationPreferences`; on failure reverts and alerts | Only after load. Other rows' toggles stay usable while one saves (rapid taps on two rows can race: second request is built from state before the first returns — unverified edge). |

- **States:**
  - Loading: spinner.
  - Load error: alert, then **spinner forever** (render condition is `loading || !prefs`; no retry).
  - Saving: per-row spinner in place of the toggle.
  - These are server-side push-category preferences; there is no OS-permission prompt or status on this screen, and nothing here detects that OS notifications are off. Web build: push is never registered, but the toggles still save.
  - Light/dark: toggle on = `t.accent`, off = `t.seg`.
  - Reduce Motion: toggle knob jumps instead of the 400 ms overshoot slide.
  - Offline: load → alert + endless spinner; toggle → revert + alert.
  - Placeholder club / unverified / store build: no difference.
- **Alerts:**
  - `Couldn’t load preferences` / `ApiError.message` or generic / `OK`.
  - `Couldn’t update preferences` / `ApiError.message` (`accountActivity, supportReplies, and announcements must all be booleans`) or generic / `OK`.
- **Validation:** none client-side.
- **Server calls:** `api.notificationPreferences` (GET, on mount only) and `api.updateNotificationPreferences` (POST full object, per toggle).
- **Board coverage:**
  - Shown: AppNotifPrefs Light/Dark (three rows, two on / one off, exact copy matches).
  - Not shown by any board: loading spinner; load-error alert and stuck spinner; per-row saving spinner; revert-on-failure + `Couldn’t update preferences`.

---

#### Help Center (`screens/profile/HelpCenterScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** Board layout (greeting, hero, search, Contact Your Club tile, article rows still not tappable, FAQ cards). FAQ text unchanged except the tier answer's brand wording (see `faqData.ts`). Alerts use `friendlyError` (technical text → plain message; member-facing server text kept). Everything else below is unchanged.

- **Reached from:** Member Profile → Support → `Help Center` (only entry point).
- **Shows:** legacy-bridged; fixed header block (does not scroll): header `Help Center` + back; `Hello, {user.firstName}` (muted); hero `How can we help you today?` (Fraunces 30 pt); search `TextField` (icon search, placeholder `Search`).
  Scrolling body:
  1. Support row card: headset icon, title `Contact Your Club`, sub `Send a message and chat with your club's team`, chevron.
  2. `Latest Articles` label + horizontal scroller of article cards (190 pt wide, short accent bar, title max 2 lines, summary max 3 lines). Static data `articles` in `data/faqData.ts`:
     - `How Do I Earn Flagrr Cash?` — `Learn how to earn Flagrr Cash through qualifying...`
     - `How Do I Redeem Rewards?` — `Learn how to redeem your Flagrr Cash for rewards...`
     - `Getting Started With Flagrr` — `Everything you need to know as a new member...`
  3. `Frequently Asked Questions` label + `FaqAccordion` of static `faqs` (8 entries, verbatim in the FaqAccordion section below). First item open by default.
  4. 120 pt bottom spacer.
- **Actions:**

| Control | What it does | When available / conditions |
|---|---|---|
| Back | `goBack()` | Always |
| Search field | Live filter (trimmed, lower-cased, substring) of articles by title or summary and FAQs by question or answer | Always |
| Contact Your Club row | `navigate('Contact')` | Always (not filtered by search) |
| Article cards | **Nothing** (plain `View`, not tappable; no article screens exist) | — |
| FAQ item | Toggle open/closed (one open at a time; tapping the open one closes it) with `LayoutAnimation` easeInEaseOut | Always |

- **States:**
  - No search: all 3 articles, all 8 FAQs, first FAQ open.
  - Search with no article matches: whole `Latest Articles` section (label + scroller) hidden.
  - Search with no FAQ matches: `Frequently Asked Questions` label stays, followed by `No results for "{query trimmed}" — try a different search.`
  - Accordion open state is by index: after filtering, the item now at index 0 is open (whatever was open before, unless the member closed it, in which case none is open).
  - All content static/offline-safe; no loading or error states. Not personalised per club (FAQ copy states fixed tier multipliers, birthday bonuses, R100/R200 vouchers and streak bonuses — note these conflict with the CLAUDE.md brand rule that rates and reward values are set per club; flagged, not changed).
  - Light/dark: legacy-bridged. Reduce Motion: accordion `LayoutAnimation` is **not** suppressed under Reduce Motion. Android: `setLayoutAnimationEnabledExperimental(true)` enabled at import.
  - Placeholder club / unverified / store build: no difference.
- **Alerts:** none. **Validation:** none. **Server calls:** none.
- **Board coverage:**
  - Shown: AppHelp Light/Dark, AppHelpFull (search, Contact Your Club row, Latest Articles, FAQ with first open).
  - Board differences: board has no `Hello, {firstName}` greeting; board articles are different (`How to scan a receipt · 2 min read`, `How member tiers work · 3 min read`, `Redeeming a voucher at the club · 2 min read`) and are links (`href="#"`); board FAQ questions differ from code (`Which receipts earn Flagrr Cash?`, `When does my tier change?`, `Can I earn at another club?`, `How do I redeem a reward?`), so the 8 live FAQ entries are not represented.
  - Not shown by any board: search in use (filtered results); articles section hidden on no match; FAQ `No results for "…" — try a different search.`; the live FAQ/article copy; greeting line.

---

#### Contact Us / Contact Your Club (`screens/profile/ContactScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** Labelled two-column fields (no placeholders). The enquiry type is a bottom sheet (`PickerSheet`, owner decision); "Rewards and Points" is now "Rewards and Flagrr Cash" (stored as text by the server, so older enquiries keep the old label). Alerts use `friendlyError` (technical text → plain message; member-facing server text kept). Everything else below is unchanged.

- **Reached from:**
  - Member Profile → Support → `Contact Your Club`.
  - Help Center → `Contact Your Club` row.
  - Home: placeholder-club popup (title `You're Almost In the Family`, every 1st, 3rd, 5th… Home open) → button `Contact Support`.
  - Rewards Shop: placeholder-club popup on every focus → `Contact Support`; and the placeholder empty state action `Contact Support`.
- **Shows:** legacy-bridged; header `Contact Us` + back; hero `Have Any Questions?`. Scrollable body:
  1. Link `View my previous enquiries` (chat-bubbles icon + chevron, accent).
  2. Form (pre-filled from `user`): two-column row `Name` (← firstName) / `Surname` (← lastName); two-column row `Phone` (phone-pad, ← phone or empty) / `Email` (no auto-capitalise, ← email). All `TextField`s, placeholders only (no labels).
  3. Enquiry type dropdown (52 pt bordered row): shows selected type or placeholder `Choose Type Of Support Enquiry` (muted) + chevron down/up. When open, an inline list below it with the 5 types: `Rewards and Points`, `Receipts`, `Membership`, `Technical Issue`, `Other`. No selected tick in the list.
  4. Multiline message box (min 132 pt), placeholder `Type Your Message Here`.
  5. `PillButton` `Submit Enquiry`.
  6. `Frequently Asked Questions` label + `FaqAccordion` (all 8 FAQs, first open).
  7. 60 pt spacer.
  - Does not show the club name the enquiry goes to.
- **Actions:**

| Control | What it does | When available / conditions |
|---|---|---|
| Back | `goBack()` | Always |
| View my previous enquiries | `navigate('MyEnquiries')` | Always |
| Name / Surname / Phone / Email | Edit local copies (not saved to profile) | Always |
| Type dropdown | Toggles the inline list; tapping a type selects it and closes the list. Cannot be cleared back to none. | Always |
| Message | Free text | Always |
| Submit Enquiry | Validates message, then `sendContactEnquiry({ name, surname, phone, email, enquiryType, message: trimmed })` → `POST /api/profile?action=contact` → `navigation.replace('EnquiryChat', { enquiryId })` (Contact is removed from the stack; Back from the chat returns to whatever was before Contact). | Spinner/disabled while submitting |
| FAQ items | Accordion toggle | Always |

- **States:**
  - Enquiry type optional: if none chosen the server stores type `General`.
  - Server uses only name + surname (for the admin notification title `New enquiry from {name surname}`) and the message/type; **the phone and email fields are not stored or sent anywhere** by the server (`createEnquiry(courseId, userId, enquiryType, message)`).
  - The enquiry is created for the member's current home club (`authed.courseId`) with status `pending`, and every admin of that club is notified (`notifyCourseAdmins`, body `({type}) {message}`).
  - Placeholder club: the enquiry is filed against the placeholder course (`My Club Isn't Listed Yet`); who reads it (super-admin Support Centre per-course enquiries inbox) is unverified. No warning in the UI.
  - Offline/error: alert, form kept.
  - No `KeyboardAvoidingView`.
  - Light/dark: legacy-bridged; dropdown list uses `colors.background` + `inputBorder`.
  - Reduce Motion: FAQ `LayoutAnimation` not suppressed.
  - Unverified / store build: no difference.
- **Alerts:**
  - Empty message → title `Add a message`, message `Let us know what your enquiry is about before sending.`, `OK`.
  - Submit failed → title `Couldn’t send your enquiry`, message `ApiError.message` (`message is required`) or generic, `OK`.
- **Validation:** message → trimmed non-empty → alert above. No validation of name, phone, email or type.
- **Server calls:** `api.sendContactEnquiry` → `POST /api/profile?action=contact` → returns `{ ok, enquiryId }` → replace to chat.
- **Board coverage:**
  - Shown: AppContact Light/Dark, AppContactFull, DlgEnqType.
  - Board differences: board shows the club name (`Strand Golf Club`) under the title and field labels (`Name`, `Surname`, `Phone`, `Email`, `Enquiry type`, `Message`) with a phone placeholder `e.g. 082 123 4567`; DlgEnqType draws the type list as a sheet/picker and shows only `Rewards and Points` and `Technical Issue` (code: inline dropdown with 5 types incl. `Receipts`, `Membership`, `Other`); **no board shows the FAQ section on this screen** (AppContactFull ends at Submit Enquiry).
  - Not shown by any board: FAQ accordion on Contact; selected type displayed in the dropdown; `Add a message` alert; submitting spinner; `Couldn’t send your enquiry`; replace-into-chat after submit; placeholder-club behaviour; entry from Home/Rewards `Contact Support`.

---

#### My Enquiries (`screens/profile/MyEnquiriesScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** One tile of rows (chip, type, unread dot, last message or —, status pill, relative time). **+** in the header opens Contact (approved addition). Empty: "No enquiries" with **Contact Your Club** (approved). A failed load shows `LoadError` ("Couldn’t load this") with **Try again** (owner decision; was an empty-looking list). Alerts use `friendlyError` (technical text → plain message; member-facing server text kept). Everything else below is unchanged.

- **Reached from:** Member Profile → Support → `My Enquiries`; Contact → `View my previous enquiries`.
- **Shows:** legacy-bridged; header `My Enquiries` + back; `FlatList` of the member's enquiries from `GET /api/profile?action=myEnquiries`, newest activity first (server `order by updated_at desc`). Each row (bordered card, 0.5 pt accent border):
  - `enquiryType` (semibold) + red unread dot (8 pt, `t.danger`) when `hasUnread` (any message with `read_by_member = false`, i.e. an unread admin reply).
  - Last message body, 1 line, or `—` if none.
  - Relative time from `updatedAt`: `just now` (<1 min), `{n}m ago`, `{n}h ago`, `{n}d ago` (no absolute dates, no weeks/months).
  - Status badge: `pending` → `Pending` (warning tint), `in_progress` → `Chat in Progress` (accent-soft/accent), `resolved` → `Resolved` (hairline bg, muted text).
  - Chevron.
- **Actions:**

| Control | What it does | When available / conditions |
|---|---|---|
| Back | `goBack()` | Always |
| Row | `navigate('EnquiryChat', { enquiryId })` | Always |

  No new-enquiry button, no pull-to-refresh, no filter, no delete.
- **States:**
  - Loading: spinner **on every focus** (refetch via `useFocusEffect`; the list is replaced by the spinner each time you come back).
  - Empty: `You haven't sent any enquiries yet.` (centred, muted).
  - Error/offline: **no catch** — the promise rejection is unhandled, loading ends, and the screen shows the empty message (indistinguishable from "no enquiries"; no alert).
  - Unread replies: red dot; cleared after opening the chat (server marks read) and returning (refetch on focus).
  - Enquiry statuses: three badges above.
  - Light/dark: badge colours come from theme tokens (`enquiryStatusBadges`).
  - Reduce Motion / placeholder / unverified / store build: no difference.
- **Alerts:** none. **Validation:** none.
- **Server calls:** `api.myEnquiries` → `GET /api/profile?action=myEnquiries` → on each focus.
- **Board coverage:**
  - Shown: AppEnquiries Light/Dark (two rows), AppEnquiriesEmpty Light/Dark.
  - Board differences: board rows show `Pro shop replied · 10:42` / `Closed · 16 Nov` meta and a `New reply` chip instead of a dot + status badge; board empty state has a title `No enquiries` and a `Contact Your Club` button (code: message only, no button).
  - Not shown by any board: `Pending` and `Chat in Progress` badges; unread red dot as built; `—` for missing last message; relative time format (`just now`/`m ago`/`h ago`/`d ago`); loading spinner (and its reappearance on every focus); failed load silently showing the empty message.

---

#### Enquiry Chat (`screens/profile/EnquiryChatScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** Bento title, centred status pill and `ChatBubble`s (member bubbles use the accent colour, lime in dark mode). The message box is unchanged (still the legacy `TextField` composer with its sending spinner). Polling, auto-scroll and alerts are unchanged. Alerts use `friendlyError` (technical text → plain message; member-facing server text kept). Everything else below is unchanged.

- **Reached from:**
  - My Enquiries → row.
  - Contact → `Submit Enquiry` success (`replace`).
  - Notifications screen → any notification row that carries an `enquiryId` (marks the notification read first).
  - Not reachable from a push-notification tap: the app registers no notification-response listener (tapping a push just opens the app).
- **Shows:** legacy-bridged inside a `KeyboardAvoidingView` (iOS `padding`; Android/web none). Header title = `thread.enquiryType`, or `Enquiry` while loading; back button (default `goBack`). Once loaded:
  - Status badge row: `Pending` / `Chat in Progress` / `Resolved` (same palette as My Enquiries).
  - Message list (ScrollView): member messages right-aligned in fairway-green bubbles with white text; club/admin messages left-aligned in tile bubbles with hairline border; max 80 % width. Under each bubble a timestamp `toLocaleString('en-ZA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })` (e.g. `24 Nov, 10:42`). No sender names, no day separators, no read receipts.
  - Composer (top hairline): multiline `TextField` placeholder `Type a message…` + round 44 pt send button (fairway green, white `send` icon, label `Send message`).
- **Actions:**

| Control | What it does | When available / conditions |
|---|---|---|
| Back | `navigation.goBack()` | Always |
| Composer | Edit draft | After load |
| Send | `replyToEnquiry(enquiryId, trimmed)` → `POST /api/profile?action=enquiryReply` → clear draft → reload thread → scroll to end (animated). Server: inserts message, sets `updated_at`, **reopens a `resolved` thread to `pending`**, notifies the club's admins (`{first last} replied to an enquiry`). | Disabled when draft is blank or while sending (spinner replaces icon). Available for every status, including Resolved. |

- **States:**
  - Loading: spinner (title `Enquiry`).
  - Live updates: `useLiveThread` refetches immediately on focus, then every 12 s while the screen is focused, and on every push notification received in the foreground (any push, not only for this thread). Each fetch also marks all of the thread's messages read by the member (server `markThreadReadByMember`), clearing unread dots and Profile/My Enquiries indicators.
  - Auto-scroll: jumps to the bottom (not animated) whenever the message count changes (initial load and new replies).
  - Load error: alert, spinner stays (no retry button); because polling continues, **the error alert repeats every 12 s** while the failure persists. If the thread had loaded before, the old thread stays visible and alerts repeat.
  - Send error: alert, draft kept.
  - Enquiry statuses: three badges; a Resolved thread can still be replied to (reopens it).
  - Bad id: `Enquiry not found` (404) for another member's id; a malformed id (non-UUID) hits Postgres and returns `Internal server error` (500) (no `uuidOrNotFound` on this route).
  - Web vs native: no keyboard avoidance on Android/web; web has no push, so only the 12 s poll updates it.
  - Light/dark: bubbles use fixed fairway green for "mine" in both modes; theirs use tile + hairline.
  - Reduce Motion: post-send scroll is animated regardless.
  - Offline: repeated `Couldn’t load enquiry` alerts every 12 s; send fails with generic alert.
  - Placeholder / unverified / store build: no difference.
- **Alerts:**
  - `Couldn’t load enquiry` / `ApiError.message` (`Enquiry not found`, `Internal server error`) or generic / `OK`.
  - `Couldn’t send message` / `ApiError.message` (`enquiryId and message are required`, `Enquiry not found`) or generic / `OK`.
- **Validation:** draft trimmed non-empty (button disabled otherwise; server repeats the rule).
- **Server calls:** `api.enquiryThread` → `GET /api/profile?action=enquiryThread&id=…` (focus + 12 s poll + push); `api.replyToEnquiry` → `POST /api/profile?action=enquiryReply` (returns the message list, which the client ignores and refetches the thread instead).
- **Board coverage:**
  - Shown: AppChat Light/Dark (three-message conversation, composer, Send).
  - Board differences: board header has a subtitle `Strand Golf Club · Pro shop`, a `TODAY` day separator, and a sender label `Pro shop · 10:42` on club messages; board shows no status badge and the composer placeholder is `Message` (code `Type a message…`).
  - Not shown by any board: status badge (all three states); loading state and `Enquiry` fallback title; sending spinner; disabled send on empty draft; `Couldn’t load enquiry` (and its 12 s repeat); `Couldn’t send message`; resolved-thread reopen on reply; live polling/push refresh; entry from Notifications; arrival via Contact replace.

---

#### Give Feedback (`screens/profile/GiveFeedbackScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** Category pill chips with icons and a labelled message field; checks and alerts unchanged. Alerts use `friendlyError` (technical text → plain message; member-facing server text kept). Everything else below is unchanged.

- **Reached from:** Member Profile → Support → `Give Feedback` (only entry point).
- **Shows:** legacy-bridged; header `Give Feedback` + back; hero `Help Us Improve Flagrr`. Body: label `What kind of feedback is this?`; three full-width category chips with icons — `Bug Found` (bug-outline), `General Feedback` (chatbox-ellipses-outline), `Improvement Idea` (bulb-outline); selected chip turns fairway green with white text and lime icon. Label `Your message`; multiline box (min 140 pt) placeholder `What's on your mind?`; `PillButton` `Send Feedback`.
- **Actions:**

| Control | What it does | When available / conditions |
|---|---|---|
| Back | `goBack()` | Always |
| Category chip | Selects that category (single choice; cannot deselect) | Always |
| Message | Free text | Always |
| Send Feedback | Validates → `sendFeedback({ category, message: trimmed })` → `POST /api/profile?action=feedbackCreate` → success alert whose button goes back | Spinner/disabled while submitting |

- **States:** goes to the Flagrr team, not the club: server creates a Support Centre ticket (`requesterType 'member'`, subject `{Bug Report|General Feedback|Improvement Suggestion} from {name}`) and emails the contact address. The member gets no ticket thread in the app (feedback does not appear in My Enquiries). On error the form is kept. Offline → generic alert. Light/dark legacy-bridged. No Reduce Motion, placeholder, unverified or store-build differences.
- **Alerts:**
  - No category → `Choose a category` / `Let us know what kind of feedback this is before sending.` / `OK`.
  - Empty message → `Add a message` / `Tell us more before sending your feedback.` / `OK`.
  - Success → `Thanks for the feedback!` / `The Flagrr team has received it.` / single button `Back` → `goBack()`. (Dismissing any other way leaves the filled form on screen.)
  - Failure → `Couldn’t send feedback` / `ApiError.message` (`message is required`, `A valid category is required`) or generic / `OK`.
- **Validation:** category required (checked first), then message trimmed non-empty.
- **Server calls:** `api.sendFeedback` → `POST /api/profile?action=feedbackCreate` → `{ ok, ticketId }` (ticketId unused by the UI).
- **Board coverage:**
  - Shown: AppFeedback Light/Dark (one category selected, empty message).
  - Not shown by any board: `Choose a category` / `Add a message` alerts; submitting spinner; `Thanks for the feedback!` success alert with `Back`; `Couldn’t send feedback`.

---

#### Terms and Privacy (`screens/profile/TermsPrivacyScreen.tsx`)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** One screen with a **Terms of Use | Privacy Policy** toggle (owner decision), "Last updated" and a Fraunces title per document. It opens on `route.params.section` ('privacy' or 'terms', Terms when absent), signed in and signed out (Landing and Sign up 2 link to it). The exported copy used by the admin screen is unchanged. Alerts use `friendlyError` (technical text → plain message; member-facing server text kept). Everything else below is unchanged.

- **Reached from:** Member Profile → Account → `Terms and Privacy` (member stack). The same section constants (`LAST_UPDATED`, `TERMS_SECTIONS`, `PRIVACY_SECTIONS`) are imported by `screens/admin/AdminTermsPrivacyScreen.tsx`, which the admin, staff, super-admin and support stacks use — editing the copy here changes it there too. Landing screen's `Terms of Use` / `Privacy Notice` words are plain bold text, not links to this screen.
- **Shows:** legacy-bridged; header `Terms and Privacy` + back; one long scroll:
  - `Last updated: July 2026`
  - `Terms of Use` (display title) then 14 sections, then a hairline divider, `Privacy Policy` then 11 sections. A section with several paragraphs renders each as a `• ` bullet; single-paragraph sections have no bullet.
  - Section headings (body text verbatim in source, `TERMS_SECTIONS` / `PRIVACY_SECTIONS` in the file):
    - Terms: `1. Acceptance of These Terms`, `2. What Flagrr Is`, `3. Eligibility`, `4. Your Account`, `5. Flagrr Cash and Rewards` (5 bullets), `6. Submitting Receipts`, `7. Acceptable Use`, `8. Your Relationship With Your Club`, `9. Intellectual Property`, `10. Suspension and Termination`, `11. Disclaimers`, `12. Changes to These Terms`, `13. Governing Law`, `14. Contact`.
    - Privacy: `1. Introduction`, `2. Information We Collect` (4 bullets), `3. How We Use Your Information`, `4. How We Share Your Information` (4 bullets), `5. Data Retention`, `6. Your Rights and Choices` (5 bullets), `7. Push Notifications`, `8. Security`, `9. Children’s Privacy`, `10. Changes to This Policy`, `11. Contact Us`.
  - Platform-wide copy (no club name or branching). Text references other screens by name ("Contact Us page", "Profile > Export My Data", "Profile > Edit Profile", "Profile > Delete Account", "Profile > Notification Preferences", "Forgot Password") but none are links.
- **Actions:** Back → `goBack()`. Nothing else (no links, no tabs/segment, no search, no share).
- **States:** static and offline-safe; no loading/error. Light/dark legacy-bridged. No other variants.
- **Alerts / Validation / Server calls:** none.
- **Board coverage:**
  - Shown: AppTerms Light/Dark.
  - Board differences: board splits the two documents with a `Terms of Use` / `Privacy Policy` toggle (aria-pressed) instead of one stacked scroll; board section headings are placeholders (`1. Using Flagrr`, `2. Earning Flagrr Cash`, `3. Redeeming rewards`, `4. Your account`) with grey lines, noting "Text comes from the live legal pages"; board has no `Last updated` line.
  - Not shown by any board: `Last updated: July 2026`; the real 25 section headings and bullets; the divider between the two documents; that admin consoles share this copy.

---

### Shared components as used in this area

#### `components/common/TextField.tsx`
- Used by: Member Profile (password + delete sheets), Edit Profile, Help Center (search), Contact (4 fields), Enquiry Chat (composer).
- Member path is the Bento field (`variant` default/`onLight`, not inside an admin scope): 52 pt min height, 16 pt radius, tile fill, 1 pt border hairline → accent on focus → danger on error; optional Ionicon at left (muted); web focus outline removed; `aria-invalid` when error.
- `isPassword`: secure entry + eye toggle (hitSlop 12), labels `Show password` / `Hide password`, icons eye-off-outline / eye-outline.
- `error`: red 13 pt text under the field, `accessibilityLiveRegion="polite"`.
- Other paths (onDark translucent for sign-in screens; admin path) are not used in this area.

#### `components/common/DateField.tsx` (native) and `DateField.web.tsx`
- Used by: Edit Profile (`variant="onLight"`, `maximumDate={new Date()}`).
- Native: touchable row with calendar icon; text = `Mon D, YYYY` (en-US) or the placeholder; Android `DateTimePicker display="calendar"` dialog, applies on set only; iOS `Modal` fade, centred sheet with `display="inline"` calendar + `Done`, backdrop tap closes, changes apply live; default picker date 2000-01-01; `maximumDate` respected; error prop supported (not used here). No accessibility role/label on the member path (only set in admin scope).
- Web: a real `<input type="date">` (`aria-label` = placeholder, `max` = `maximumDate.toISOString().slice(0,10)` i.e. UTC date), system font, `colorScheme: 'light'` for onLight variant (even in dark mode — the native date popup stays light on web dark theme; unverified visually), value `''` when empty; clearing it calls `onChange('')`.

#### `components/common/SelectField.tsx`
- Not used by any screen in this area (used by Sign-up step 1 and admin editors). Contact's enquiry type uses its own inline dropdown, not SelectField.

#### `components/common/FaqAccordion.tsx`
- Used by: Help Center (filtered list, default first open) and Contact (`initialOpenIndex={0}`, full list).
- Card per FAQ (tile, hairline, radius 23); question 15 pt semibold + chevron up/down (accent); answer 14 pt muted when open; single-open accordion; `LayoutAnimation.Presets.easeInEaseOut` on every toggle (ignores Reduce Motion); keyed by question text; no accessibility role/expanded state.

#### `data/faqData.ts` (verbatim)

> **1.1.0 (phase 3, 25 Nov 2026), what changed from the 1.0.1 description below:** The tier answer now says "on your receipts" (was "per R1 spent") and no longer gives the bar voucher's rand value (owner decision: perks drop rands "in Member Tiers and the FAQ"). Every other answer is verbatim as below.
- FAQs:
  1. `How Do I Earn Flagrr Cash?` — `You can earn Flagrr Cash by playing qualifying rounds, scanning eligible receipts, participating in promotions, and completing selected in-app activities.`
  2. `How do I redeem rewards?` — `Open the Rewards Shop, choose a reward you can afford, and tap Redeem Now to receive a QR voucher.`
  3. `How do membership tiers work?` — `Your tier is based on Flagrr Cash earned during the current quarter (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec), not a lifetime total — it recalculates each quarter. A quiet quarter can only drop you one tier below where you finished the previous one, so you won’t fall all the way back to Bronze in one go.`
  4. `What do the tiers actually get me?` — `Your tier sets how much Flagrr Cash you earn per R1 spent: Bronze 1x, Silver 1.2x, Gold 1.5x, Platinum 1.7x. Every member also gets an automatic birthday bonus (50/100/150/200 Flagrr Cash by tier), and Gold and Platinum members get a free bar voucher (R100/R200) each quarter they qualify — no need to redeem it, it appears in your Rewards Activity automatically.`
  5. `What’s the benefit of keeping a streak going?` — `Every 4 weeks of an unbroken weekly streak earns you a Flagrr Cash bonus — 100 for 4 weeks, 200 for 8 weeks, and 300 for 12 weeks and every 4 weeks after that. It’s paid automatically and shows up in your Rewards Activity — no need to redeem it. If a streak breaks, a new one can earn those same milestones again from scratch.`
  6. `Where can I use my reward voucher?` — `Present the QR code or voucher code shown after redemption at your home club to claim your reward.`
  7. `Why was my receipt not approved?` — `Receipts can be declined if the image is unclear, the purchase isn’t eligible, or it was already submitted.`
  8. `Can I change my selected club?` — `Yes — open My Profile and tap Club to switch your home club at any time.`
- Articles: see Help Center (3 entries, summaries end in `...`).

#### `utils/pickAvatar.ts`
- `pickAndResizeAvatar()`: `requestMediaLibraryPermissionsAsync()`; not granted → throws `AvatarPermissionError('Photo library access is needed to choose an image.')`; `launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })` (no editing/crop); cancelled or no asset → `null`; `ImageManipulator.manipulate(uri).resize({ width: 480 }).renderAsync()` → `saveAsync({ base64: true, compress: 0.7, format: JPEG })`; returns `data:image/jpeg;base64,…` or `null`. No camera option. (`pickAndResizeCoverImage` 960 px variant is used by admin screens, not here.)

#### `api/client.ts` functions used in this area
| Function | Endpoint | Used by |
|---|---|---|
| `courses()` | `GET /api/courses` (no auth) | Profile club picker |
| `updateAvatar(imageBase64)` | `POST /api/profile` | Profile avatar |
| `updateProfile(payload)` | `POST /api/profile?action=update` | Edit Profile |
| `changeHomeClub(courseId)` | `POST /api/profile?action=changeClub` (+ `loadAll()`) | Profile |
| `updateThemePreference(pref)` | `POST /api/profile?action=themePreference` | Profile Appearance |
| `changePassword(cur, new)` | `POST /api/profile?action=changePassword` | Profile password sheet |
| `deleteAccount(password)` | `POST /api/profile?action=deleteAccount` (+ `logout()`) | Profile delete sheet |
| `downloadMyDataExport()` | `GET /api/profile?action=exportMyData` (raw fetch; web Blob download / native file + share sheet; returns false if sharing unavailable; non-OK → `ApiError(status, 'Could not generate your data export')`) | Profile Export |
| `referralInfo()` | `GET /api/profile?action=referralInfo` | Referral |
| `notificationPreferences()` | `GET /api/profile?action=notificationPreferences` | Notification Preferences |
| `updateNotificationPreferences(p)` | `POST /api/profile?action=updateNotificationPreferences` | Notification Preferences |
| `sendContactEnquiry(payload)` | `POST /api/profile?action=contact` | Contact |
| `myEnquiries()` | `GET /api/profile?action=myEnquiries` | My Enquiries |
| `enquiryThread(id)` | `GET /api/profile?action=enquiryThread&id=` (id not URL-encoded) | Enquiry Chat |
| `replyToEnquiry(id, message)` | `POST /api/profile?action=enquiryReply` | Enquiry Chat |
| `sendFeedback(payload)` | `POST /api/profile?action=feedbackCreate` | Give Feedback |
| `logout()` (context only) | none (clears token + state) | Profile Log Out, after Delete |
- All requests: JSON, `Authorization: Bearer <token>` (except courses), `cache: 'no-store'`; non-2xx → `ApiError(status, body.error || 'Request to <path> failed')`.

---

### Not on any board

1. Profile: `Phone` row in Details (boards omit it).
2. Profile: `—` for missing phone/birthday (boards show `Add your birthday`).
3. Profile: Birthday and Member Since as device-locale dd/mm/yyyy.
4. Profile: avatar upload in progress (spinner in camera badge).
5. Profile: tapping the avatar to change photo (boards put `Change photo` on Edit Profile instead).
6. Profile: photo-permission alert with live copy `Photo library access is needed to choose an image.` (DlgPhotoPerm uses different copy over Edit Profile).
7. Profile: picker cancelled = silent no-op.
8. Profile: `Couldn’t update profile picture` alert (incl. `Image is too large`).
9. Profile: club picker loading spinner.
10. Profile: club picker empty list when the course fetch fails (no message).
11. Profile: club picker listing the placeholder course `My Club Isn't Listed Yet` (last) and switching to/from it.
12. Profile: tapping the current club closes the picker with no change.
13. Profile: live `Change home club?` copy and `Cancel` / `Switch` buttons (board copy differs).
14. Profile: `Updating…` Club row during a change, row disabled.
15. Profile: full app reload after a club change (rewards, vouchers, ads, activity re-scoped).
16. Profile: `Couldn’t change club` alert.
17. Profile: theme saving lock and `Couldn’t update appearance` alert.
18. Profile: password sheet helper `At least 8 characters.` part.
19. Profile: password `Missing info` alert.
20. Profile: `Password changed` success alert and sheet auto-close.
21. Profile: `Couldn’t change password` (`Current password is incorrect`).
22. Profile: changing password signs out all other devices.
23. Profile: sheets keep typed passwords after closing without saving.
24. Profile: Export busy spinner on the row.
25. Profile: web export = browser download of `flagrr-my-data.json`.
26. Profile: native export = file written to cache + OS share sheet titled `Your Flagrr Data`.
27. Profile: live `Not available here` copy (`Data export isn’t available on this device.`).
28. Profile: `Couldn’t export your data` alert.
29. Profile: delete `Missing info` alert.
30. Profile: second **Delete your account?** confirmation alert (`Cancel` / `Delete Account`) with its own copy.
31. Profile: deleting spinner and `Couldn’t delete account` alert.
32. Profile: after delete or Log Out, return to Landing (Auth stack).
33. Profile: Log Out has no confirmation.
34. Profile: stats `CountUp` re-counts on every focus; `Rounds Played` follows the current stats period.
35. Profile: Reduce Motion rendering (no rise/reveal, no count-up, no sheet rise).
36. Edit Profile: no photo control in the live screen (board shows one).
37. Edit Profile: inline `First name is required` error.
38. Edit Profile: inline `Enter a valid email address` error.
39. Edit Profile: focused field accent border.
40. Edit Profile: iOS inline-calendar modal with `Done`.
41. Edit Profile: Android calendar dialog.
42. Edit Profile: web `<input type="date">` (max today, clearable).
43. Edit Profile: filled date display format `Mon D, YYYY`.
44. Edit Profile: saving spinner.
45. Edit Profile: `Couldn’t save changes` alert (incl. `An account with this email already exists`).
46. Edit Profile: silent go-back on success; Back discards edits without prompting.
47. Referral: loading spinner.
48. Referral: `Couldn’t load your referral code` alert and the blank body after it.
49. Referral: capped copy `You've reached the {max}-referral limit — thank you!`.
50. Referral: footnote about when bonuses are credited.
51. Referral: live explainer copy (`When a friend signs up and enters your code, you get N Flagrr Cash.` etc.).
52. Referral: web share behaviour (navigator.share or silent no-op).
53. Notification Preferences: loading spinner.
54. Notification Preferences: `Couldn’t load preferences` alert and the endless spinner after it.
55. Notification Preferences: per-row saving spinner replacing the toggle.
56. Notification Preferences: revert on failure + `Couldn’t update preferences` alert.
57. Help Center: `Hello, {firstName}` greeting.
58. Help Center: live article cards (3 titles + summaries) and that they are not tappable.
59. Help Center: live 8-question FAQ content.
60. Help Center: search results (filtered articles/FAQs).
61. Help Center: `Latest Articles` section hidden when no article matches.
62. Help Center: `No results for "…" — try a different search.`
63. Help Center / Contact: FAQ accordion animates even under Reduce Motion.
64. Contact: FAQ accordion section below the form.
65. Contact: inline dropdown (not a sheet) with all 5 types incl. `Receipts`, `Membership`, `Other`.
66. Contact: selected enquiry type shown in the dropdown; type optional (server defaults to `General`).
67. Contact: `Add a message` alert.
68. Contact: submitting spinner.
69. Contact: `Couldn’t send your enquiry` alert.
70. Contact: success replaces Contact with the new Enquiry Chat.
71. Contact: phone and email fields are discarded server-side.
72. Contact: enquiry filed against the placeholder course for placeholder-club members.
73. Contact: entry via `Contact Support` from Home/Rewards placeholder-club popups and the Rewards empty state.
74. My Enquiries: `Pending` status badge.
75. My Enquiries: `Chat in Progress` status badge.
76. My Enquiries: red unread dot (as built) and its clearing after opening the thread.
77. My Enquiries: relative time `just now` / `{n}m ago` / `{n}h ago` / `{n}d ago`.
78. My Enquiries: `—` when there is no last message.
79. My Enquiries: loading spinner, shown again on every focus.
80. My Enquiries: failed load silently shows the empty message (no alert).
81. My Enquiries: live empty state has no title and no `Contact Your Club` button (board adds both).
82. Enquiry Chat: status badge (Pending / Chat in Progress / Resolved).
83. Enquiry Chat: loading state with `Enquiry` fallback title.
84. Enquiry Chat: timestamp format `24 Nov, 10:42` under every bubble.
85. Enquiry Chat: send disabled when the draft is blank; sending spinner.
86. Enquiry Chat: `Couldn’t load enquiry` alert, repeating every 12 s while failing.
87. Enquiry Chat: `Couldn’t send message` alert (draft kept).
88. Enquiry Chat: live refresh (12 s poll + any foreground push) and mark-as-read on every fetch.
89. Enquiry Chat: replying to a Resolved enquiry reopens it to Pending.
90. Enquiry Chat: entry from a Notifications row with an enquiry; no entry from tapping a push.
91. Enquiry Chat: auto-scroll to newest message on load/new message.
92. Give Feedback: `Choose a category` alert.
93. Give Feedback: `Add a message` alert.
94. Give Feedback: submitting spinner.
95. Give Feedback: `Thanks for the feedback!` success alert with `Back`.
96. Give Feedback: `Couldn’t send feedback` alert.
97. Give Feedback: feedback goes to Flagrr (ticket + email), not the club, and never appears in My Enquiries.
98. Terms: `Last updated: July 2026` line.
99. Terms: live 14 Terms + 11 Privacy section headings and bullet paragraphs, stacked in one scroll with a divider (board uses a toggle).
100. Terms: copy shared with the admin/staff/super-admin Terms screens.
101. All legacy screens: offline/network failure shows the generic `Something went wrong. Please try again.` message.
102. All screens: an expired session (401 `Not authenticated`) shows in that screen's alert; no auto-logout.
