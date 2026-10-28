# UAT Checklist — Member App

A practical checklist for manually testing the member-facing app end-to-end at https://flagrr-loyalty.vercel.app. Test on both a desktop and a mobile browser (the live app is a web export; run the native build too once one is available). Check off each item; note anything that fails with enough detail to reproduce it. Admin, staff, and support screens are tested separately — see [Admin Console Features](Admin-Console-Features).

## 1. Onboarding

- [ ] Sign up as a brand-new member: full name, email, phone, date of birth, pick a golf club, set a password (at least 8 characters).
- [ ] Golf club list on sign-up loads and shows every signed-up club.
- [ ] A password shorter than 8 characters is rejected with a clear message.
- [ ] Sign-up rejects a duplicate email with a clear error, not a silent failure.
- [ ] Welcome email arrives after sign-up (check spam folder) and shows the correct club name.
- [ ] Sign up with a name and email that are on the club's uploaded roster: the account is verified (tier can climb). Sign up with details not on the roster: the account stays Bronze.
- [ ] Log out, then log back in with the new account's email/password.
- [ ] Log in with a wrong password shows a clear error (no crash, no silent hang).
- [ ] "Keep me logged in" unchecked: closing and reopening the app requires login again.
- [ ] "Keep me logged in" checked (default): reopening the app stays logged in.
- [ ] On a store build (`EXPO_PUBLIC_STORE_BUILD=1`), the Landing and Login screens do not show an Admin Login option. On the web build they do.

## 2. Forgot Password

- [ ] From Login, tap Forgot Password, enter the account email: a 6-digit code arrives by email.
- [ ] Enter the code and a new password (at least 8 characters): the reset succeeds and the new password works at login.
- [ ] A wrong code is rejected with a clear error.
- [ ] A code used once cannot be used a second time.
- [ ] Request a second code: the first code no longer works, only the newest does.
- [ ] A code older than 30 minutes is rejected.

## 3. Home Screen

- [ ] Flagrr Cash balance, tier badge, and "X pts to next tier" all show real numbers, not placeholders.
- [ ] Month / Year / All toggle on My Stats actually changes the numbers shown.
- [ ] Streak card shows the current streak length and "N more weeks to a Y Flagrr Cash bonus."
- [ ] Points Earned Per Month chart renders (even if empty for a new account).
- [ ] "View All" under Rewards navigates to the full Rewards Shop.
- [ ] Notification bell shows an unread badge when there are unread notifications.

## 4. Ad Space and Impressions

- [ ] Home shows the top-banner ad and the second Home ad when the club has them configured; the Rewards Shop shows its own slot.
- [ ] An ad shows real creative (image or video) and tapping it opens the advertiser's link.
- [ ] A slot with no ad configured shows the "Ad Space" placeholder without looking broken.
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
- [ ] Receipt History lists the submitted receipt with the right status, amount, and an image that loads on demand.

## 6. Receipts Held for Review

Use test receipts that trigger a flag: a very unclear photo (low OCR confidence), a receipt worth more than 500 FC, or 5 or more submissions within 10 minutes.

- [ ] The success screen says "Your receipt is being reviewed" and explains the Flagrr Cash will be added once approved.
- [ ] The balance does not increase while the receipt is pending.
- [ ] Receipt History shows the receipt as Pending with an "Under review" badge and the reason.
- [ ] After a club admin approves the receipt: the Flagrr Cash is credited, an activity entry and a notification appear, and Receipt History shows Approved.
- [ ] After a club admin confirms the receipt as fraud: the status becomes Rejected, no Flagrr Cash is kept (any credited amount is reversed), and the member gets a "Receipt rejected" notification.

## 7. Tiers

- [ ] Member Tiers screen lists all four tiers with their correct thresholds and perks copy.
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
- [ ] Terms & Privacy content loads.

## 15. Export and Delete Account

- [ ] Profile → Export My Data downloads a file containing the member's profile, balance, receipts, activity, vouchers, notifications, enquiries, and support tickets, and nothing belonging to another member. (On a device that can't download files, the app says the export isn't available.)
- [ ] Delete account asks for the current password; a wrong password is rejected and the account is kept.
- [ ] Deleting with the correct password logs the member out, and logging in with that email and password then fails.
- [ ] The deleted member no longer appears in the club admin's member list.
- [ ] The public delete-account page (`/delete-account.html`) loads and its instructions match the in-app flow.

## 15a. Course and My Golf

Needs migration `048` applied and at least one live course map.

- [ ] The tab bar shows Home, Course, My Golf, Scan, Rewards, Activity, Profile and fits a 360-wide phone.
- [ ] A member whose club has no live map sees **Coming soon** on the Course tab (and the away courses below it) and on My Golf until they finish a round.
- [ ] Away courses: search by name and by town; a recently played course is listed first.
- [ ] Start a round: men's / ladies' and tees change the lengths and ratings; the Course and Playing Handicap match the working shown (for example index 14.2, White men's 70.0 / 120, par 72: course 13, playing 12 at 95%). A plus index like +1.4 is accepted; 55 or 14.25 is refused.
- [ ] Only full rounds are offered on a card without nine-hole ratings.
- [ ] Starting a second round while one is in progress (from the Course tab or Start round) offers Resume round or Discard it, and every alert with a single OK button can be closed on a phone.
- [ ] Hole view: drag, pinch / scroll and the zoom buttons work; the frame button fits the hole; tapping sets a target and the card says when it's risky; dragging the ball moves the start; distance arcs and hazard numbers turn off under layers. The "GPS integration coming soon" label shows.
- [ ] The tee distance on the green card matches the card length within 15 m from every tee.
- [ ] Score bar: tap for par, − / +, press and hold to clear; Stableford points and net results are right on a hole with a shot; **Pick up** appears once a hole is worth 0 points.
- [ ] Putts and fairways (when turned on): putts can't reach the score; fairway buttons only on par 4s and 5s.
- [ ] Scorecard: Out / In / Total add up; Finish round only when every hole is in; Discard round deletes it.
- [ ] Turn off the network, enter a score, see "Not saved yet · will retry", turn it back on and see it save; leave and resume the round and the scores are still there.
- [ ] My Golf after a few rounds: the Month / Year / All toggle changes the numbers; tapping a chart column shows that round; Recent rounds opens the scorecard; Correct a score saves; Delete round removes it from the stats.
- [ ] Export my data includes the golf profile and rounds.

## 15b. Club admin: Course map panel

- [ ] Dashboard shows the Course map panel with "Send your scorecard"; upload several photos at once; the stage changes to "Photos received" and the Flagrr team gets one email for the batch.
- [ ] Tap a photo to view it; delete it; the 12-photo limit is enforced.
- [ ] Super admin: Course Maps lists the club; its photos show and download (web); importing `course-maps/strand-golf-club.json` creates a draft with no blockers; a file with a bad stroke index is saved as a draft with the blocker listed and Publish disabled; Publish makes the club's Course tab show **Start a round**; Unpublish brings back Coming soon.

## 16. Cross-cutting

- [ ] Every confirm/alert dialog in the app (redeem confirmation, change-club confirmation, error messages) uses the branded in-app modal — no native browser `alert()`/`confirm()` popups anywhere.
- [ ] Refreshing the browser mid-session keeps the member logged in and on a sensible screen (not dumped back to login unnecessarily).
- [ ] No console errors in the browser dev tools during a normal walkthrough of sections 1–15.
- [ ] The public pages `/privacy.html` and `/support.html` load.

## 17. Motion

- [ ] Home: the Flagrr Cash balance rolls up from 0, the tier bar fills from the left, and the cards rise in one after another. After a scan is approved, the balance rolls from the old value to the new one.
- [ ] Tab bar: the selected tab's icon switches to its filled version, pops slightly and gets a dot underneath; switching tabs crossfades.
- [ ] Buttons and reward cards shrink slightly under the finger and spring back on release (no dimming).
- [ ] iPhone: pushed screens slide in and can be swiped back from anywhere on the screen. Android: pushed screens slide in from the right.
- [ ] The scan camera slides up from the bottom; Voucher and Receipt Success fade up. On Voucher the QR code pops in; on Receipt Success the trophy pops and the Flagrr Cash amount rolls up.
- [ ] Alerts and confirmations spring in over a fading backdrop.
- [ ] With Reduce Motion turned on (iOS Settings > Accessibility > Motion, or Android remove animations), everything appears instantly with no movement.
- [ ] Admin dashboard (desktop browser): stat cards and panels rise in, numbers roll up, chart bars grow, table rows cascade in; the sidebar stays still while the content fades, and the lime marker springs in beside the current section.

## Known-not-yet-testable

These are real code paths but can't be fully exercised in UAT until the infrastructure behind them is confirmed — don't file these as bugs:

- Real phone push notifications: needs a native build with the Apple push key and Android FCM credentials configured in EAS. Whether this is in place is unverified from the repo.
- The away-club flat-rate scanning path, until a second club's merchant is configured in the database.
- Club-signup referral bonuses (the 500 FC bonus), until PayFast live or sandbox payments are configured and a test club completes its first payment.
