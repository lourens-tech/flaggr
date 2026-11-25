# UAT Checklist — Member App

A practical checklist for manually testing the member-facing app end-to-end at https://flagrr-loyalty.vercel.app. Test on both a desktop and a mobile browser (the live app is a web export; run the native build too once one is available). Check off each item; note anything that fails with enough detail to reproduce it. Admin, staff, and support screens are tested separately — see [Admin Console Features](Admin-Console-Features).

For the Bento store build, use this page together with [Member App Functionality Inventory](Member-App-Functionality-Inventory), which lists every control, state and alert per screen; nothing on it may be lost.

## 0. Store build 1.1.0 (Expo SDK 58) upgrade checks

- [ ] Install 1.0.1, sign in with "Keep me logged in", then install the 1.1.0 build over it: the member is still signed in and the Appearance choice is kept.
- [ ] Screen movement (1.1.0): pushes slide in with the screen behind sliding left and dimming; Scan rises with the screen behind shrinking; swipe-back from anywhere on iPhone, including over Home's reward rail and the Rewards categories (it must not fight horizontal scrolling); no swipe-back during a round. With Reduce Motion on, screens just fade.
- [ ] Haptics (1.1.0, phones): a tick on tab and segment changes, a light tap on main buttons and Scan, a success buzz when a receipt is submitted, a reward redeemed and a round saved.
- [ ] "View My Flagrr Cash" after a scan shows Home and Back does not return to the success screen; "Back to Rewards" on a voucher shows the Rewards tab; "See My Golf" after finishing a round shows My Golf and Back returns to the tabs; "Submit Another Receipt" opens one scanner and Close leaves the flow.
- [ ] On an iPhone with dark mode on and Appearance set to System, the 1.1.0 app is dark; with Light or Dark chosen, it ignores the phone setting.
- [ ] Profile → Export My Data opens the share sheet with a complete `flagrr-my-data.json`.
- [ ] Push notifications still arrive and show while the app is open.
- [ ] Camera scan, photo upload, date picker, video ads and the share sheet all work on iOS and Android.
- [ ] `cd mobile && npm run e2e` is green (545 passed, 44 skipped as of 25 Nov 2026) before the build. It covers the web build only; the items above and the native-only skips need a device.

## 1. Onboarding

- [ ] Sign up as a brand-new member: full name, email, phone, date of birth, pick a golf club, set a password (at least 8 characters).
- [ ] Golf club list on sign-up loads and shows every signed-up club (a bottom sheet). With no connection, the field shows "Couldn’t load this" with Try again, and Try again loads the list once the connection is back.
- [ ] A password shorter than 8 characters is rejected with a clear message.
- [ ] Sign-up rejects a duplicate email with a clear error, not a silent failure.
- [ ] Welcome email arrives after sign-up (check spam folder) and shows the correct club name.
- [ ] Sign up with a name and email that are on the club's uploaded roster: the account is verified (tier can climb). Sign up with details not on the roster: the account stays Bronze.
- [ ] Log out, then log back in with the new account's email/password.
- [ ] Log in with a wrong password shows a clear error (no crash, no silent hang).
- [ ] "Keep me logged in" unchecked: closing and reopening the app requires login again.
- [ ] "Keep me logged in" checked (default): reopening the app stays logged in.
- [ ] On a store build (`EXPO_PUBLIC_STORE_BUILD=1`), the Landing and Login screens do not show an Admin Login option. On the web build they do.
- [ ] Signed out, Landing's **Terms of Use** and **Privacy Notice** open Terms and Privacy on that part, and Back returns to Landing; the same links under Sign Up on step 2 keep the form filled when you come back.
- [ ] The opening screen (Landing, Bento) shows the photo fading into the ground, the wordmark, the headline with "Repeat." in the accent colour and the buttons without clipping or sideways scrolling at phone width (375 px), on a foldable's cover and inner screens, on a landscape phone (it scrolls) and on desktop web, in both light and dark mode (it follows the member's Appearance setting). Get Started opens sign-up, Golf Course Admin Login opens the admin sign-in and I already have an account opens member login.
- [ ] With Reduce Motion on, the opening screen's headline appears without rising in.
- [ ] Bento sign-in screens, light and dark: Login shows "Welcome back" under the photo; sign-up step 1 shows "Step 1 of 2", the progress bar and "Create your account", and step 2 "Step 2 of 2" and "Set a password"; Forgot password shows the wordmark and "Reset Password" on the contour background. The back button, password eye, Keep me logged in, Golf Club picker, Date of Birth picker, Recover here, Sign Up! and Login! links all work, and validation messages (missing name or email, passwords that don't match, password under 8 characters) still show under the right field. When the step 1 form scrolls, the fields pass under a clear gap below the title.
- [ ] An error alert on member Login or Sign-up (reached from the opening screen) keeps the member style, not the admin one.

## 2. Forgot Password

- [ ] From Login, tap Forgot Password, enter the account email: a 6-digit code arrives by email.
- [ ] Enter the code and a new password (at least 8 characters): the reset succeeds and the new password works at login.
- [ ] A wrong code is rejected with a clear error.
- [ ] A code used once cannot be used a second time.
- [ ] Request a second code (Send it again): a "Code sent" toast appears; the first code no longer works, only the newest does.
- [ ] A code older than 30 minutes is rejected.
- [ ] Request a code 4 times within 30 minutes for the same email: the 4th shows “Too many password reset attempts. Please contact Flagrr support at Swing@flagrr.com or 071 759 9553.”
- [ ] Enter a wrong code 5 times: the 5th shows the same support message, and even the correct code is then refused until 30 minutes pass.
- [ ] An email with no account gets the same responses (code “sent”, then the support message on the 4th request).
- [ ] Each request and wrong code adds a row to `password_reset_events` with the IP address and device, and no email address.
- [ ] Sign in on two devices, reset the password on one: the other is signed out at its next request or launch.
- [ ] Change the password in Profile: the current device stays signed in, a second device is signed out.
- [ ] Enter a wrong password 10 times for one email: the next attempt (and any within 15 minutes) shows “Too many sign-in attempts. Try again in 15 minutes, or reset your password.”, and even the right password is refused. Resetting the password lets the member sign in straight away.
- [ ] An email with no account gets the same “Invalid email or password” and, after 10 tries, the same lockout message.
- [ ] Each sign-in attempt adds a row to `login_events` with the IP address and device, and no email address.

## 3. Home Screen

- [ ] Flagrr Cash balance, tier name, and the tier ring's "N to {next tier}" all show real numbers, not placeholders; a Platinum member sees "Top tier". Tapping the ring opens Member Tiers; Redeem opens the Rewards Shop.
- [ ] Month / Year / All on My Stats changes the numbers shown; Month and Year show "+/−N% vs Last Month/Year" (falls in the muted red), All shows no change line.
- [ ] Streak tile shows the current streak length, one dot per recent week, and "N more weeks to a Y FC bonus."
- [ ] With a round in progress, the Resume tile shows the next hole and "N pts thru M" and opens the hole view; with none, it reads "Play a round" and opens the Course tab.
- [ ] An unverified member sees the amber "Your club hasn't verified your membership yet…" notice above the tiles.
- [ ] Points Earned Per Month chart renders (even if empty for a new account); "My Golf" opens My Golf, with the tab bar still showing and Course lit.
- [ ] "View All" and each reward card under Rewards open the full Rewards Shop.
- [ ] Notification bell shows the unread count when there are unread notifications; the avatar and Your Club open Profile.
- [ ] Home matches the Home board in light and dark at 375, 390 and 430 pt wide, and a 6-digit balance still fits the hero tile.

## 4. Ad Space and Impressions

- [ ] Home shows the top-banner ad and the second Home ad when the club has them configured, each with "SPONSORED" above it; the Rewards Shop shows its own slot. Ads don't animate when Home opens or scrolls.
- [ ] An ad shows real creative (image or video) and tapping it opens the advertiser's link.
- [ ] A slot with no ad booked is not shown at all: no "Ad Space" box, no SPONSORED label, no empty gap (Home and Rewards Shop, including a club not yet on Flagrr).
- [ ] Viewing an ad is recorded as an impression and tapping it as a click (check the ad's performance figures in the super-admin console after a few views and taps).
- [ ] An ad set to "all clubs" shows for members of different clubs; an ad targeted at one club does not show for a member of another club.
- [ ] An ad outside its start/end dates, or switched off, does not show.

## 5. Scanning a Receipt

- [ ] Scan a real, clear receipt from the member's home club — camera capture works.
- [ ] Upload a photo of a receipt instead of using the camera — also works.
- [ ] Review Receipt screen shows merchant, items, and a Flagrr Cash total that looks right before confirming.
- [ ] Confirming awards the Flagrr Cash — balance updates, an activity entry appears, a notification appears.
- [ ] Re-scanning the exact same receipt (same photo or same receipt number) is rejected as a duplicate.
- [ ] Scanning a blurry/unclear photo still reaches the Review screen and shows the "wasn't fully clear" warning.
- [ ] **If a second participating club's merchant exists in the system**: scanning a receipt from that other club shows the away-club note and awards the flat rate (1 FC per R1 of the receipt total) regardless of tier.
- [ ] Scanning a receipt from an unrelated/generic retailer behaves the same as a home-club receipt (catalog match + tier multiplier), not the away-club flat rate.
- [ ] Receipt History lists the submitted receipt with the right status, amount, and an image that loads on demand (View Photo opens it full screen; X, a tap anywhere and system back close it). Leaving and reopening Receipt History shows a status an admin just changed.
- [ ] Receipt History's summary shows the Flagrr Cash from receipts approved this month and the number of receipts submitted this month; with no receipts, the empty card's **Scan a receipt** opens the camera.
- [ ] Camera permission card reads "Flagrr needs camera access…" (not "Flaggr"); Continue asks for access; "Upload from gallery instead" works; the close button leaves the screen. After denying access for good, the card shows **Open Settings**; granting access there and coming back opens the camera.
- [ ] Torch (phones): the button lights the torch, and the torch is off again after moving on to Review or closing the scanner.
- [ ] While a receipt is read, the photo shows dimmed behind the "Reading your receipt…" sheet.
- [ ] Review Receipt: the back button and Rescan both return to the camera; Submit Receipt still submits.
- [ ] Receipt submitted: a normal receipt shows "+N FC" and "N Flagrr Cash added and ready to spend."; a flagged one shows "Your receipt is being reviewed" and the manual-review note. View My Flagrr Cash goes Home and shows a "Receipt submitted" toast; Submit Another Receipt opens the camera (no toast).
- [ ] Duplicate ("Already redeemed"), "This is not a valid slip" (Back / Try Again) and "Couldn’t read that image" alerts appear in the Bento alert style with the same wording and buttons.

## 6. Receipts Held for Review

Use test receipts that trigger a flag: a very unclear photo (low OCR confidence), a receipt worth more than 500 FC, or 5 or more submissions within 10 minutes.

- [ ] The success screen says "Your receipt is being reviewed" and explains the Flagrr Cash will be added once approved.
- [ ] The balance does not increase while the receipt is pending.
- [ ] Receipt History shows the receipt with an "Under review" label, the FC pending, and the reason.
- [ ] After a club admin approves the receipt: the Flagrr Cash is credited, an activity entry and a notification appear, and Receipt History shows "+N FC" for it.
- [ ] After a club admin confirms the receipt as fraud: the status becomes Rejected, no Flagrr Cash is kept (any credited amount is reversed), and the member gets a "Receipt rejected" notification.

## 7. Tiers

- [ ] Member Tiers lists all four tiers as rows with the correct multiplier, threshold and perks (no rands), marks the member's tier Current and the next one Next, shows "N FC to {next tier}" with this quarter's FC (verified members) or "You’ve reached the top tier" with a full bar (Platinum), then the three steps 01 Scan, 02 Earn, 03 Upgrade (no "Play rounds" or "qualifying activities" wording), in light and dark.
- [ ] Notifications: groups and row times look right in the phone's own time format; the header gear opens Notification Preferences; an account with no notifications shows "No notifications yet"; VoiceOver reads the View button as "View, {title}".
- [ ] Scanning a receipt applies the correct earning multiplier for the member's current tier (verify the awarded FC = base points × multiplier, rounded).
- [ ] An unverified member (not on the club roster) stays at Bronze however much they earn; once the club verifies them, the tier updates.
- [ ] On a test account's birthday (or with date of birth set to today for testing), opening the app grants the birthday bonus exactly once — reopening the app again the same day does not grant it a second time.
- [ ] For a Gold/Platinum test account at a club that has a Bar Voucher reward with R100/R200 variants, opening the app once in a qualifying quarter grants the bar voucher exactly once for that quarter.
- [ ] For a Gold/Platinum test account at a club with no matching Bar Voucher variant, note what happens (no voucher is issued — see Known Limitations).
- [ ] Help Center FAQ answers about tiers/perks match the actual thresholds and amounts above.

## 8. Streaks

- [ ] Play (submit a qualifying round receipt) in 4 consecutive weeks on a test account — confirm a 100 FC "Streak bonus" activity entry and notification appear.
- [ ] Continue to 8 weeks — confirm a 200 FC bonus; to 12 weeks — confirm a 300 FC bonus; 16 weeks — confirm another 300 FC bonus (repeating, not escalating further).
- [ ] Break a streak (skip a week), then start a new one — confirm the 4-week milestone can be earned again.
- [ ] A week that is still in progress and not yet played does not reset a running streak.

## 9. Referrals

- [ ] Profile → Refer a Friend shows the member's 6-character code, and it stays the same on every visit.
- [ ] Sign up a new test member using that code: the referrer receives 15 FC, an activity entry, and a notification.
- [ ] Sign up with an invalid code: the sign-up still succeeds and nobody is credited.
- [ ] After 10 referral bonuses, a further sign-up with the code still succeeds but the referrer is not credited.
- [ ] Sign up a golf club through the marketing site's club signup using the code: the referrer receives 500 FC only after the club's first payment is confirmed, not when the form is submitted.
- [ ] The Referral screen's counts match the bonuses actually received.

## 10. Rewards Shop & Vouchers

- [ ] Rewards Shop loads the club's actual reward catalog with images (or a sensible icon fallback if an image is missing).
- [ ] A reward with multiple Rand denominations shows a selector; the cost updates when a different denomination is picked.
- [ ] Redeeming a reward the member can afford deducts the correct Flagrr Cash and shows a QR voucher with a code in the `FLGR-XXXX-XXXX` format.
- [ ] Attempting to redeem a reward the member can't afford is blocked with a clear message (not a silent failure or a negative balance).
- [ ] Reward Activity timeline shows the redemption; tapping it opens the voucher's QR code.
- [ ] When club staff redeem the voucher at the counter, the member gets a "Reward validated" notification and the voucher then shows as used.
- [ ] A used/expired voucher, when tapped from Reward Activity, explains its state instead of opening a QR code.
- [ ] Redeem Now opens the "Redeem reward?" sheet showing the right option, Cost and Left to spend; Cancel, the close button and the backdrop all close it without redeeming; Redeem Now redeems once, opens the voucher and shows the "Reward redeemed" toast. Tapping the Flagrr Cash at the top of the shop opens Member Tiers. A reward with four options shows every option chip on a 360-wide phone.
- [ ] Rewards Shop search and category filters work (tapping the active filter returns to All); a search with no matches shows "No rewards match your search."
- [ ] A member at a club not on Flagrr sees "Nothing Here Yet" with Contact Support (opens Contact Your Club), the ad, and the "You're Almost In the Family" alert on every visit.
- [ ] Voucher shows the ticket with QR code, voucher code, Redeemed and Expires dates, Cost and Left to spend; Back to Rewards and the back button both work.
- [ ] Reward Activity's All / Earned / Redeemed filter works; used and expired vouchers are labelled in the list; an empty account sees the empty card with Scan a receipt.

## 11. Profile

- [ ] Edit name, phone, email, and birthday from My Profile — changes save and persist after reloading the app.
- [ ] Editing email to one already in use by another account is rejected with a clear error.
- [ ] Editing email to an invalid address is rejected with a clear error.
- [ ] Upload a new profile photo — it appears immediately in every place the avatar shows (header, profile card).
- [ ] Switch theme between system, light, and dark — the choice applies immediately and is still applied after logging out and back in.
- [ ] Change password: with the correct current password and a new password of at least 8 characters, it succeeds and the new password works at next login. A wrong current password is rejected.
- [ ] Log out and confirm the app returns to the login/landing screen and clears session data (logging back in shows the right account, not a stale one).

## 12. Changing Club

- [ ] Tap the Club field, pick a different club, confirm the dialog — home club updates, and the Rewards Shop and ad space now reflect the new club.
- [ ] Switching clubs does **not** change the member's Flagrr Cash balance, tier, or activity history.
- [ ] After switching, scanning a receipt from the new club is treated as a home-club receipt, and one from the old club as an away-club receipt (if both clubs' merchants are configured).
- [ ] Cancelling the confirmation dialog leaves the club unchanged.

## 13. Notifications and Preferences

- [ ] The notification bell's unread badge appears/disappears correctly as notifications are read.
- [ ] Every automatic event in this checklist (receipt scan, approval or rejection, redemption, voucher validation, birthday bonus, bar voucher, streak bonus, referral bonus) produces a matching in-app notification with sensible copy.
- [ ] Tapping a notification marks it read; tapping an enquiry reply opens that chat.
- [ ] Profile → Notification Preferences shows three switches (Account activity, Support replies, Announcements) and the saved values are still there after reloading the app.
- [ ] With a switch turned off, the matching events still appear in the in-app feed but no phone push is sent (native build with push set up only).

## 14. Help & Support

- [ ] Help Center FAQ search actually filters results.
- [ ] Contact Your Club form submission creates an enquiry and shows a confirmation; required-field validation catches an empty message.
- [ ] My Enquiries lists the enquiry; opening it shows the thread, a club admin's reply appears, and the member can reply back.
- [ ] Give Feedback submits a bug / feedback / improvement ticket successfully.
- [ ] My Feedback (Profile → Support): the new submission shows first as **Sent**. After an agent replies in the Support Centre, the member gets "Reply to your feedback" (in-app, and a push if Support replies is on), the Profile row and the list show a red dot, the notification opens the thread with the reply under "Flagrr Support", and the dot clears after opening it. The member replies from the thread; the reply shows in the Support Centre as unread, and a reply on a Resolved ticket reopens it (Sent in the app). With no connection the list shows "Couldn’t load your feedback" with Try again. Light and dark.
- [ ] Terms & Privacy content loads.

## 15. Export and Delete Account

- [ ] Profile → Export My Data downloads a file containing the member's profile, balance, receipts, activity, vouchers, notifications, enquiries, and support tickets, and nothing belonging to another member. (On a device that can't download files, the app says the export isn't available.)
- [ ] Delete account asks for the current password; a wrong password is rejected and the account is kept.
- [ ] Deleting with the correct password logs the member out, and logging in with that email and password then fails.
- [ ] The deleted member no longer appears in the club admin's member list.
- [ ] The public delete-account page (`/delete-account.html`) loads and its instructions match the in-app flow.

## 15a. Course and My Golf

Needs migration `048` applied and at least one live course map.

- [ ] The tab bar shows Home, Course, Scan, Rewards, Profile and fits a 360-wide phone (1.1.0; the 1.0.1 store app has six tabs). My Golf opens from Course's Your game tile and from Home; Reward Activity opens from Profile.
- [ ] A member whose club has no live map sees **Coming soon** on the Course tab (and the away courses below it) and on My Golf until they finish a round.
- [ ] Away courses: search by name and by town; a recently played course is listed first.
- [ ] Start a round: men's / ladies' and tees change the lengths and ratings; the Course and Playing Handicap match the working shown (for example index 14.2, White men's 70.0 / 120, par 72: course 13, playing 12 at 95%). A plus index like +1.4 is accepted; 55 or 14.25 is refused.
- [ ] Only full rounds are offered on a card without nine-hole ratings.
- [ ] Starting a second round while one is in progress (from the Course tab or Start round) offers Resume round or Discard it, and every alert with a single OK button can be closed on a phone.
- [ ] Hole view: drag, pinch / scroll and the zoom buttons work; the frame button fits the hole; tapping sets a target and the card says when it's risky; dragging the ball moves the start; distance arcs and hazard numbers turn off under layers. The "GPS integration coming soon" label shows.
- [ ] The tee distance on the green card matches the card length within 15 m from every tee.
- [ ] Score bar: tap for par, − / +, press and hold to clear; Stableford points and net results are right on a hole with a shot; **Pick up** appears once a hole is worth 0 points.
- [ ] Putts and fairways (when turned on): putts can't reach the score; fairway buttons only on par 4s and 5s.
- [ ] Scorecard (horizontal grid per nine): Out / In / Total add up; every hole's par, SI, shots, score marks, putts and points show; tapping a hole number goes to that hole; it fits a 360-wide phone; Finish round only when every hole is in; Discard round deletes it.
- [ ] Course always shows Your game ("–" before the first finished round) and it opens My Golf; no "GPS integration coming soon" label anywhere; with no map, the hole view's status bar is readable in light mode.
- [ ] My Golf's points chart shows its 0 / 10 / 20 / 30 / 40 values.
- [ ] Turn off the network, enter a score, see "Not saved yet · will retry", turn it back on and see it save; leave and resume the round and the scores are still there.
- [ ] My Golf after a few rounds: the Month / Year / All toggle changes the numbers; tapping a chart column shows that round; Recent rounds opens the scorecard; Correct a score saves; Delete round removes it from the stats.
- [ ] Reward Activity: tapping a used voucher opens it with a grey **Used** badge, an expired one with a red **Expired** badge (no alert); a voucher past its expiry date shows **Expired** in Activity and on the voucher.
- [ ] Scan: the camera hint reads "Align your receipt in the frame".
- [ ] Push (phone build): redeem a reward with the app open; only the "Reward redeemed" toast shows, no push banner. With the app closed, the push still arrives. Other pushes (for example "Flagrr Cash earned") still show a banner while the app is open.
- [ ] iPhone Duo (real device, closed and open): the Bento tab bar sits vertically at the bottom of the right-hand strip (Scan on top, then Home, Course, Rewards, Profile) from the first launch, never moves to the bottom when folding, unfolding or changing screens, and slides away on pushed screens; Home's bell and avatar, the hole view's top card (Bag, Saved), distance card, map buttons and score bar, bottom sheets, alerts, toasts and the scan camera are never under the camera or the strip. Other iPhones keep the Bento tab bar.
- [ ] Ads are never cropped: each slot takes its picture's shape (a rotating slot takes its tallest picture's shape and shows the others whole on a band), on a phone, the opened Duo and an iPad.
- [ ] Bento Profile: every row opens the same screen as before (Reward Activity, Receipt History, each Details field → Edit Profile, Club → Choose Golf Club sheet → "Change home club?"); Appearance switches Light / Dark / System and saves; Security opens the Change your password sheet (an empty or short password shows "Missing info" above the sheet; a correct change closes the sheet and shows "Password changed"); Export My Data still exports (or says it isn't available); Delete Account opens its sheet and still asks for confirmation; Log Out works.
- [ ] Support screens in light and dark: Help Center search and FAQ, Contact Your Club (enquiry type sheet, Submit Enquiry), My Enquiries (+ opens Contact; empty list offers Contact Your Club) and the chat, Give Feedback, Notification Preferences toggles, Notifications, Member Tiers, Edit Profile, Refer a Friend (Share My Code opens the phone's share sheet) and Terms (Terms of Use | Privacy Policy toggle) all work and are readable. Choose Golf Club's search narrows the list. With no connection, Choose Golf Club ("Couldn’t load clubs"), My Enquiries, Notification Preferences and Refer a Friend show an error with Try again that recovers once the connection is back.
- [ ] An alert raised while a sheet is open draws above the sheet (web and phone).
- [ ] Bento golf screens: the Course tab shows the in-progress tile (next hole, points, thru), Your club with Start a round, and Your game with My Golf and Played recently (each opens its scorecard); Start a Round's tiles, toggles and Start round work; in the hole view the header buttons are at least 44 pt, the Scorecard, Your round and My bag sheets open and close (close button, backdrop, Done), and the map layers toggles switch arcs and hazard distances; Round detail shows points and gross; all of it in light and dark.
- [ ] Bento polish: the Course average, Round detail points and gross, My Golf's average and tiles, and the Member Tiers, Profile, Rewards and Home balances count up each time the screen opens and end on the exact value (decimals keep one place, e.g. 30.0); switching My Golf between Month / Year / All rolls them to the new values. Reward card photos and the Voucher photo drift slightly as the page scrolls; the ad never moves. With Reduce Motion on, numbers show their final value at once and photos don't move. In dark mode, switching tabs never flashes a light background. Help Center article cards and support-screen timestamps and badges are readable (no text under 12 pt).
- [ ] Export my data includes the golf profile and rounds.

## 15b. Club admin: Course map panel

- [ ] Dashboard shows the Course map panel with "Send your scorecard"; upload several photos at once; the stage changes to "Photos received" and the Flagrr team gets one email for the batch.
- [ ] Tap a photo to view it; delete it; the 12-photo limit is enforced.
- [ ] Super admin: Course Maps lists the club; its photos show and download (web); importing `course-maps/strand-golf-club.json` creates a draft with no blockers; a file with a bad stroke index is saved as a draft with the blocker listed and Publish disabled; Publish makes the club's Course tab show **Start a round**; Unpublish brings back Coming soon.

## 15c. Golf on the admin dashboards

- [ ] Member: My Golf shows **Share my rounds with {club}**, on. Turn it off: the club's Golf page no longer lists the member or their rounds, and opening their page or a scorecard says the member keeps their rounds private. Turn it back on: they reappear.
- [ ] Course admin: Members › Golf (sidebar, ⌘K, or More on a phone). Before the map is live the page says so. With rounds: the totals, rounds chart, scoring mix, toughest holes, latest rounds and members table match the members' own My Golf numbers for the same period; Month / Year / All changes them.
- [ ] Only the club's own members' rounds on the club's own course appear: a member's away rounds and other clubs' members playing the course do not.
- [ ] Open a member: their numbers match their My Golf screen. Open a round: the scorecard's shots received, points, putts and fairways match the round in the member app; a picked-up hole shows a dash and the gross shows a dash; Previous / Next round step through their rounds.
- [ ] Staff accounts have no Golf entry, and the API refuses the Golf actions for them.
- [ ] Super admin: Insights › Golf lists every active club with its map status; open a club, a member and a scorecard; the sidebar keeps Golf selected throughout.
- [ ] All Golf pages at desktop, 900-wide, phone and landscape sizes, light and dark.

## 16. Cross-cutting

- [ ] Every confirm/alert dialog in the app (redeem confirmation, change-club confirmation, error messages) uses the branded in-app modal — no native browser `alert()`/`confirm()` popups anywhere.
- [ ] Refreshing the browser mid-session keeps the member logged in and on a sensible screen (not dumped back to login unnecessarily).
- [ ] No console errors in the browser dev tools during a normal walkthrough of sections 1–15.
- [ ] The public pages `/privacy.html` and `/support.html` load.
- [ ] Super admin on a phone (or a browser window under 900px wide): every tab and pushed screen shows the large-title header over the photo, not a solid green bar; on Courses the filter is fully visible; on Push a club-scoped notification's badge truncates instead of running off the card; nothing runs off the right edge of the screen.

## 16a. Admin consoles (all four roles)

Test each role (course admin, staff, super admin, support agent) at three widths: desktop (1440px), a foldable or small laptop (about 960px) and a phone (375px), in both light and dark mode.

- [ ] Sign-in, forgot password, forced password change and staff welcome show the admin look (Flagrr photo behind glass), not the member look.
- [ ] Desktop: glass sidebar with the club crest (or the Flagrr mark for super admin and support), grouped sections, account button; content on solid tiles over the blurred club photo. Between 900 and 1100px the sidebar becomes an icon rail. At 1280px and wider, course admins see the Activity inspector (All / Enquiries / Receipts, Mark all as read), super admins the audit log, support agents their tickets; staff see no bell and no inspector.
- [ ] ⌘K (Mac) or Ctrl K (Windows), or clicking the search pill, opens search. Typing a section name and pressing Enter goes there; for course admins and super admins, typing two or more letters of a member's name lists members and opening one shows their stats. Esc closes it.
- [ ] Phone: floating tab bar with the role's tabs (course admin Home, Enquiries, Vouchers, Rewards, More; staff Vouchers, Support, Profile; super admin Courses, Reports, Support, Ads, More; support agent Inbox, Profile). More lists every other section; the More tab shows the unread count for course admins.
- [ ] Every list shows a skeleton while loading, a calm empty state, and an error state with Retry when the network is off.
- [ ] Turning on Reduce Transparency (iOS Accessibility, or the browser setting) replaces glass with solid fills.
- [ ] Alerts and confirms inside the admin consoles use the admin style, and the member app's alerts are unchanged.
- [ ] Products and activities: each active row has Deactivate (confirm, then the item shows Inactive and the scanner stops matching it) and a separate red "Delete permanently…" with its own confirm. The edit screen's red button says Deactivate.
- [ ] Push: sending a new notification asks "Send to <audience>?" first; Cancel sends nothing.
- [ ] Vouchers: after Look Up, Confirm Redeem asks "Redeem this voucher?" naming the reward and member; Cancel leaves the voucher active.
- [ ] Reward edit on desktop opens inside the sidebar layout with the breadcrumb "Rewards › …".
- [ ] Fraud Review on desktop: list on the left, selected receipt on the right; View Photo shows the receipt image inline. With no member name, the fraud reason hint reads "…already awarded. The member will be sent the reason below." (with a space).
- [ ] Staff and Admins: the Staff / Club Admins / Activity switch at the top moves between the three screens.
- [ ] Home: the hero shows the club's cover photo and a greeting with the admin's first name in lime italic (a club with no cover shows Fairway green with an outline 18). "Needs you" lists pending enquiries and flagged receipts only when there are some, and each opens the right screen. Coming back to Home refreshes the numbers.
- [ ] Activity (course admin): search and filters work, tapping an enquiry or receipt notification opens it, and Mark all as read clears every unread dot (and the More / bell count).
- [ ] Club Settings: cover photo with Change cover photo…, logo with Change logo…, club name as the title; editing a detail and pressing Save changes (toolbar on desktop, under Details on phones) saves it; Change password… opens a sheet, an empty submit shows "Missing info" on top of the sheet, a valid change closes it; the subscription card shows the status; a past-due club sees the red "Your last payment failed." banner.
- [ ] Super admin Reports (desktop): six KPI tiles in one row (three and three on narrower screens), the tier bar with legend, top rewards with photo and club name, the member search field and button on one line, and readable ad charts (every few days labelled, no overlapping numbers).
- [ ] Sign-in: a wrong password shows a red banner on the card (no pop-up); forgot password and forced change show their errors the same way; the reset success message still returns to sign-in. Too many reset requests or wrong codes show the support message (Swing@flagrr.com or 071 759 9553) in the banner. 10 wrong passwords in 15 minutes show “Too many sign-in attempts. Try again in 15 minutes, or reset your password.” in the banner.
- [ ] Temporary password: a new or reset admin account can only reach the forced-change screen, and calling any other action with its token (for example `?action=dashboard`) returns 403 “Choose a new password before continuing.” until the password is changed.
- [ ] Sessions: a super admin resetting a course admin's password, or a course admin revoking a staff member, signs that account out on its next request. Changing your own admin password keeps you signed in and signs out your other devices.
- [ ] Super admin / support agent: after 12 hours without use (or 7 days after signing in) the next app launch shows sign-in. Course admin and staff stay signed in.
- [ ] Super admin Courses (desktop): the photo header and counts show; the table sorts by Club, Status, Members and Admins; filters and search work; each Manage link opens that club's page; the ⋯ menu archives, unarchives, cancels and reactivates, and Reactivate and Unarchive now ask first. Creating a club ends with "{club} has been created, and {admin} has been emailed their login details."
- [ ] Super admin per-club pages show `Courses › {club} › {section}` in the breadcrumb, and the club catalogue offers Deactivate and a separate Delete permanently….
- [ ] Super admin Push: sending asks "Send to <audience> — <club scope>?" first; Cancel sends nothing.
- [ ] Support inbox (super admin and support agent): status, priority and assignee filters work; in a ticket, Claim / Release / Take Over and the Status and Priority menus update the ticket; replies send. Support agents see only Inbox and Profile, with their own tickets in the desktop inspector.
- [ ] Audit log: catalogue and fraud-decision entries show readable labels, not codes.

## 17. Motion

- [ ] Home: the tiles on screen rise in one after another and tiles further down rise in as you scroll to them; the Flagrr Cash balance and stats count up every time you come back to Home; the tier ring draws and the chart bars grow. After a scan is approved, the balance rolls from the old value to the new one.
- [ ] Tab bar (Bento, member app): a floating glass bar 14 pt in from each side; every tab has a line icon and a label; the selected tab turns green (lime in dark mode) and its soft highlight slides across with a slight overshoot; switching tabs cross-fades with the new screen settling up into place. Scan is the raised green button in the middle and opens the receipt camera. All labels fit unclipped on a 360-wide phone. 1.1.0: the bar slides away on pushed screens and comes back on the tabs and My Golf; tapping the current tab scrolls it to the top.
- [ ] Alerts (member app): a centred card that scales in from slightly larger over a dimmed backdrop; buttons run full width under hairlines, two side by side with Cancel on the right; destructive actions are red. Every alert still runs the same action as before (spot-check Redeem, Delete round, Change home club, Delete account).
- [ ] Hole view sheets (Scorecard, Your round, My bag): rise from the bottom as a rounded card with a close button; tapping the backdrop, the close button or Android back closes them; Done and every control inside still work.
- [ ] Buttons and reward cards shrink slightly under the finger and spring back on release (no dimming).
- [ ] iPhone: pushed screens slide in and can be swiped back from anywhere on the screen. Android: pushed screens slide in from the right.
- [ ] The scan camera slides up from the bottom; Voucher and Receipt Success fade up. On Voucher the QR code pops in; on Receipt Success the lime check badge pops and the "+N FC" amount counts up.
- [ ] Alerts and confirmations spring in over a fading backdrop (member: scale in from 1.1 with a slight overshoot).
- [ ] With Reduce Motion turned on (iOS Settings > Accessibility > Motion, or Android remove animations), everything appears instantly with no movement.
- [ ] Admin dashboard (desktop browser): stat cards and panels rise in, numbers roll up, chart bars grow, table rows cascade in; the sidebar stays still while the content fades.

## Known-not-yet-testable

These are real code paths but can't be fully exercised in UAT until the infrastructure behind them is confirmed — don't file these as bugs:

- Real phone push notifications: needs a native build with the Apple push key and Android FCM credentials configured in EAS. Whether this is in place is unverified from the repo.
- The away-club flat-rate scanning path, until a second club's merchant is configured in the database.
- Club-signup referral bonuses (the 500 FC bonus), until PayFast live or sandbox payments are configured and a test club completes its first payment.
