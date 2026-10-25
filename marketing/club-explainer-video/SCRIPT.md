# Flagrr for Clubs — 60-second explainer

**Purpose:** cold sales pitch sent to South African golf clubs (GM, club manager, committee).
**One job:** get the club to book a 30-minute walkthrough.
**Format:** 16:9, 1920×1080, 30fps, 62 seconds. Text-led motion graphics (like the Workly and
Zelios references), so it works muted — which is how most people will first play it in an email,
WhatsApp or LinkedIn. The voiceover below is optional and matches the on-screen text.

## Creative approach

- **Say it plain.** Every line is something a club manager would say out loud. No slogans.
- **Lead with the club's problem, not our product.** The first thing on screen is an empty tee
  sheet on a weekday afternoon — every GM has stared at one.
- **Show the real product.** Every console and phone screen in the cut is the actual Flagrr app,
  rendered from the codebase with demo data for Strand Golf Club. Nothing is mocked up in a
  design tool.
- **Real South African course.** Strand Golf Club, Western Cape (Helderberg in the background),
  the pilot club.
- **Brand:** Flagrr Dark Green `#1F4234`, Club Green `#00805A`, Lime `#CDDE5C`; Fraunces headings,
  Poppins body — same system as the app and mailers.

## Script

| # | Time | On screen | Voiceover (optional) | Visual |
|---|---|---|---|---|
| 1 | 0:00–0:05 | **Tuesday, 2pm.** / **Half your tee sheet is empty.** | It's Tuesday afternoon. Half your tee sheet is empty. | Strand fairway, slow push-in. A tee sheet slides up — most slots read "Open". |
| 2 | 0:05–0:13 | **Send a push notification to every member's phone.** / **Fill quiet tee times the same day.** | Send a push notification straight to your members' phones, and fill quiet tee times the same day. | Admin types *"Quiet course this afternoon — tee off before 3pm and earn double Flagrr Cash"* → Send. The notification lands on a phone. The empty slots fill with names one by one. |
| 3 | 0:13–0:23 | **Members scan their slip.** Green fees · Pro shop · Halfway house · Bar / **They earn Flagrr Cash they spend back at your club.** / **Streaks, tiers and birthday bonuses bring them back every week.** | Members scan their slip — green fees, pro shop, halfway house, the bar — and earn Flagrr Cash they spend back at your club. Weekly streaks, tiers and birthday bonuses give them a reason to come back. | A receipt flies into the phone, "+340 Flagrr Cash" pops. Real member Home screen: balance, Gold tier, 7-week streak. |
| 4 | 0:23–0:33 | **One admin dashboard.** / **Rewards. Members. Notifications. Fraud review.** / **See what's working, live.** | One admin dashboard. Manage your rewards, members, notifications and fraud review — and see what's working, live. | Real course-admin console in a browser, 3D tilt. Stat cards count up. Cuts to the Rewards catalogue, then Fraud Review. |
| 5 | 0:33–0:43 | **You're not doing this alone.** / **Flagrr runs platform-wide and club-specific promos and competitions.** / **A member with something to win plays more — and spends where they earn: at your club.** | You're not doing this alone. Flagrr runs platform-wide and club-specific promotions and competitions — because a member with something to win plays more often, and spends where they earn: at your club. | Flagrr icon at the centre, promo cards orbit in: *Double Flagrr Cash Weekend · every partner club*, *October Medal · Strand Golf Club*. The real in-app banners on the phone. |
| 6 | 0:43–0:48 | ✓ No new hardware ✓ No POS integration ✓ Members never pay a cent ✓ Live within days | No new hardware. No POS integration. Your members never pay a cent, and you can be live within days. | Four checks tick in on dark green. |
| 7 | 0:48–0:54 | **We're building South Africa's number one loyalty and value app for golfers.** / **With the clubs that join us.** | We're building South Africa's number one loyalty and value app for golfers — together with the clubs that join us. | Sunset swing at Strand, slow drift. |
| 8 | 0:54–1:02 | Flagrr logo / **Book a 30-minute walkthrough** / hello@flagrr.co.za / *R2 500 for your first month · No lock-in* | Book a thirty-minute walkthrough at hello@flagrr.co.za. | Logo resolves, lime CTA button, contact line. |

Voiceover is ~140 words — a comfortable 60-second read at a conversational pace.

### Why the "not alone" beat is worded that way

The objection behind it is *"so we have to run the promotions ourselves?"* The answer has to be
both **what** (Flagrr runs platform-wide and club-specific promos and competitions) and **why it
helps the club**: a reason to play is a reason to visit, and Flagrr Cash is redeemed at the
member's home club, so the extra spend lands at the club and not anywhere else.

### Why the partnership beat is worded that way

"We're building South Africa's number one loyalty and value app for golfers" is a statement of
intent, not a request. "With the clubs that join us" makes the club a co-builder rather than a
customer being asked for a favour. It sits after the product proof (not before), so it reads as
ambition backed by a working product.

## Production notes

- **Plates:** `capture-console.mjs` renders the real app (course-admin console at 1600×1000 @2x,
  member app at 400×860 @3x) against mocked API data and screenshots it into `plates/`.
- **Ad banners:** `make-ad-banners.py` builds the two in-app banners shown in the member app.
- **Animation:** `video.html` is the whole film as one deterministic timeline (`render(t)`), so
  any frame can be re-rendered exactly.
- **Render:** `render.mjs` steps through every frame with Playwright, then ffmpeg encodes H.264.
- **Music/SFX:** `make-audio.py` synthesises a temp music bed plus whooshes, ticks and the
  notification chime, synced to the timeline cues. Swap in a licensed track for the final
  release (see questions).

## Image and footage scouting

**In this cut:** three real photographs of Strand Golf Club (fairway with the Helderberg behind,
tee shot at golden hour, sunset swing), already used in the app and mailers.

**Wanted for v2:** moving footage. A half-day drone and handheld shoot at Strand (the pilot club)
would give us footage we own outright and can reuse in every club pitch. Shot list:

1. Drone push-in over the 1st tee at golden hour, Helderberg in frame (opens the film)
2. Empty tee box, weekday afternoon, locked-off (the "half your tee sheet is empty" beat)
3. A member pulling a phone out at the halfway house and scanning a slip (close-up, hands only)
4. Pro-shop counter: staff scanning a voucher QR on a member's phone
5. A fourball walking off the 18th green, laughing (the "back every week" beat)
6. Sunset swing, silhouette, slow motion 60fps+ (the partnership beat)

If buying stock instead, search for SA-specific courses so the landscape reads as home:
Fancourt (George), Arabella (Kleinmond), Pinnacle Point (Mossel Bay), Leopard Creek (Malelane),
Steenberg and Royal Cape (Cape Town), Pearl Valley (Paarl), Durban Country Club, Zimbali.
Check every clip's licence allows paid advertising.

## Suggestions

1. **Personalise it per prospect.** The console and phone plates are rendered from code, so the
   club name in the console, tee sheet, notification and banners can be swapped for the
   prospect's own club in minutes. A GM seeing *their* club in the dashboard converts far
   better than a generic demo.
2. **Cut-downs.** 9:16 (WhatsApp status, Reels) and 1:1 (LinkedIn feed) versions of the same
   timeline, plus a 15-second teaser built from scenes 1, 2 and 8.
3. **Add one proof point once Strand has data** (for example "+X% rounds on weekday afternoons in
   the first month"). One real number from a real SA club beats every feature line.
4. **Voiceover:** a warm, unhurried South African English voice (not a radio-ad read). The VO
   column above is timed to the cut.
5. **Music:** replace the synthesised temp bed with a licensed track at ~100 bpm, light and
   optimistic (acoustic guitar/marimba plucks, no vocals). `out/sfx-only.wav` lays over any track.

## Questions before final release

1. **Double Flagrr Cash.** The push example and the platform promo banner both say "double Flagrr
   Cash". There's no automatic multiplier or competition feature in the codebase today. Is this
   something Flagrr runs manually (gifted Flagrr Cash), or should the example be reworded?
2. **Pricing on screen.** The end card shows "R2 500 for your first month · No lock-in contract"
   (from the sales deck). Keep it, or hold pricing for the walkthrough?
3. **"Live within days."** Comfortable promising that on camera?
4. **Strand Golf Club.** Do we have the club's OK to feature its name and photos in a sales video
   sent to other clubs?
5. **Call to action.** Email only, or a booking link / WhatsApp number as well?
6. **Who funds competition prizes** — Flagrr, the club, or sponsors? The current wording avoids
   saying, which is safe but less persuasive if Flagrr is paying.
