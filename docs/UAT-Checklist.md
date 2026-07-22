# UAT Checklist — Member App

A practical checklist for manually testing the member-facing app end-to-end at https://flagrr-loyalty.vercel.app. Test on both a desktop and a mobile browser (the app is currently a web export). Check off each item; note anything that fails with enough detail to reproduce it.

## 1. Onboarding

- [ ] Sign up as a brand-new member: full name, email, phone, date of birth, pick a golf club, set a password.
- [ ] Golf club list on sign-up loads and shows every signed-up club.
- [ ] Sign-up rejects a duplicate email with a clear error, not a silent failure.
- [ ] Welcome email arrives after sign-up (check spam folder) and shows the correct club name.
- [ ] Log out, then log back in with the new account's email/password.
- [ ] Log in with a wrong password shows a clear error (no crash, no silent hang).
- [ ] "Keep me logged in" unchecked: closing and reopening the app requires login again.
- [ ] "Keep me logged in" checked (default): reopening the app stays logged in.

## 2. Home Screen

- [ ] Flagrr Cash balance, tier badge, and "X pts to next tier" all show real numbers, not placeholders.
- [ ] Month / Year / All toggle on My Stats actually changes the numbers shown.
- [ ] Streak card shows the current streak length and "N more weeks to a Y Flagrr Cash bonus."
- [ ] Points Earned Per Month chart renders (even if empty for a new account).
- [ ] Ad space (if a club has one configured) shows real creative and is tappable, opening the advertiser's link; if none is configured, shows the placeholder without looking broken.
- [ ] "View All" under Rewards navigates to the full Rewards Shop.

## 3. Scanning a Receipt

- [ ] Scan a real, clear receipt from the member's home club — camera capture works.
- [ ] Upload a photo of a receipt instead of using the camera — also works.
- [ ] Review Receipt screen shows merchant, items, and a Flagrr Cash total that looks right before confirming.
- [ ] Confirming awards the Flagrr Cash — balance updates, an activity entry appears, a notification appears.
- [ ] Re-scanning the exact same receipt (same photo or same receipt number) is rejected as a duplicate.
- [ ] Scanning a blurry/unclear photo still submits, but shows the "wasn't fully clear" warning.
- [ ] **If a second participating club's merchant exists in the system**: scanning a receipt from that other club shows the away-club rate note and awards exactly 1 FC per R1 of the receipt total, regardless of tier.
- [ ] Scanning a receipt from an unrelated/generic retailer behaves the same as a home-club receipt (catalog match + tier multiplier), not the away-club flat rate.

## 4. Tiers

- [ ] Member Tiers screen lists all four tiers with their correct thresholds and perks copy.
- [ ] Scanning a receipt applies the correct earning multiplier for the member's current tier (verify the awarded FC = base points × multiplier, rounded).
- [ ] On a test account's birthday (or with date_of_birth set to today for testing), opening the app grants the birthday bonus exactly once — reopening the app again the same day does not grant it a second time.
- [ ] For a Gold/Platinum test account, opening the app once in a qualifying quarter grants the bar voucher exactly once for that quarter.
- [ ] Help Center FAQ answers about tiers/perks match the actual thresholds and amounts above.

## 5. Streaks

- [ ] Play (submit a qualifying round receipt) in 4 consecutive weeks on a test account — confirm a 100 FC "Streak bonus" activity entry and notification appear.
- [ ] Continue to 8 weeks — confirm a 200 FC bonus; to 12 weeks — confirm a 300 FC bonus; 16 weeks — confirm another 300 FC bonus (repeating, not escalating further).
- [ ] Break a streak (skip a week), then start a new one — confirm the 4-week milestone can be earned again.

## 6. Rewards Shop & Vouchers

- [ ] Rewards Shop loads the club's actual reward catalog with images (or a sensible icon fallback if an image is missing).
- [ ] A reward with multiple Rand denominations shows a selector; the cost updates when a different denomination is picked.
- [ ] Redeeming a reward the member can afford deducts the correct Flagrr Cash and shows a QR voucher.
- [ ] Attempting to redeem a reward the member can't afford is blocked with a clear message (not a silent failure or a negative balance).
- [ ] Reward Activity timeline shows the redemption; tapping it opens the voucher's QR code.
- [ ] A used/expired voucher, when tapped from Reward Activity, explains its state instead of opening a QR code.
- [ ] Rewards Shop's own ad slot behaves the same as the Home screen's (see section 2).

## 7. Profile

- [ ] Edit name, phone, email, and birthday from My Profile — changes save and persist after reloading the app.
- [ ] Editing email to one already in use by another account is rejected with a clear error.
- [ ] Upload a new profile photo — it appears immediately in every place the avatar shows (header, profile card).
- [ ] Tap the Club field, pick a different club, confirm the dialog — home club updates, and the Rewards Shop/ad space now reflect the new club.
- [ ] Switching clubs does **not** change the member's Flagrr Cash balance, tier, or activity history.
- [ ] Log out and confirm the app returns to the login/landing screen and clears session data (logging back in shows the right account, not a stale one).

## 8. Notifications

- [ ] The notification bell's unread badge appears/disappears correctly as notifications are read.
- [ ] Every automatic event in this checklist (receipt scan, redemption, birthday bonus, bar voucher, streak bonus) produces a matching in-app notification with sensible copy.
- [ ] Tapping a notification marks it read.

## 9. Help & Support

- [ ] Help Center FAQ search actually filters results.
- [ ] Contact Us form submission sends successfully and shows a confirmation; required-field validation catches an empty message.
- [ ] Terms & Privacy content loads.

## 10. Cross-cutting

- [ ] Every confirm/alert dialog in the app (redeem confirmation, change-club confirmation, error messages) uses the branded in-app modal — no native browser `alert()`/`confirm()` popups anywhere.
- [ ] Refreshing the browser mid-session keeps the member logged in and on a sensible screen (not dumped back to login unnecessarily).
- [ ] No console errors in the browser dev tools during a normal walkthrough of sections 1–9.

## Known-not-yet-testable

These are real, working code paths but can't be exercised in UAT yet because they depend on infrastructure that doesn't exist — don't file these as bugs:

- Real phone push notifications (needs an EAS project + native build).
- Anything on the golf-course-admin or super-admin side (not built).
- The away-club flat-rate scanning path, until a second club's merchant is configured in the database.
