# Flagrr for Clubs — 84-second explainer

**Purpose:** cold sales pitch sent to South African golf clubs (GM, club manager, committee).
**One job:** get the club to book a 30-minute walkthrough.
**Format:** 16:9, 1920×1080, 30fps, 84 seconds. Modern kinetic type cut to a ~109bpm
house track, so it works with the sound on or muted (as most people will first play it in
an email, WhatsApp or LinkedIn). The voiceover below is optional.

## Creative approach

- **Modern and tech-forward.** Dark, deep canvas (near-black green) with a slow aurora glow, a
  faint dot grid, a soft light beam and film grain. Sentence-case headlines in tight-tracked
  Poppins, with a lime-to-mint gradient on the key word. Words rise out of a blur one by one,
  sections change with a soft blur-dissolve, and lists become glass "bento" tiles with glowing
  borders. Product pieces are pulled out of the UI: a live stat card counting up, glass label
  pills, a cursor click ripple, a glowing notification.
- **On the beat, easy to read.** ~109bpm (one beat = 0.55s). The key lines land word by word on the
  beat, and every line holds long enough to read. No camera shake. The track drops where the
  film turns: "One push notification", "No new hardware", the logo.
- **Say it plain.** Every line is something a club manager would say out loud. No slogans.
- **Lead with the club's problem, not our product.** The film opens on an empty tee sheet on a
  weekday afternoon. Every GM has stared at one.
- **Show the real product.** Every console and phone screen in the cut is the actual Flagrr app,
  rendered from the codebase with demo data for Strand Golf Club.
- **Real South African course.** Strand Golf Club, Western Cape (Helderberg in the background),
  the pilot club.
- **Brand:** Flagrr Dark Green `#1F4234`, Club Green `#00805A`, Lime `#CDDE5C`, deepened for the
  canvas, with Poppins for type and the Flagrr script logo, the same system as the app.

## Script

| # | Time | On screen | Voiceover (optional) | Visual / music |
|---|---|---|---|---|
| 1 | 0:00–0:09 | **Tuesday, 2pm.** / **Half your tee sheet is empty.** / **Let's fill it.** | It's Tuesday afternoon, and half your tee sheet is empty. | Words rise out of the dark, then the Strand fairway with a tee sheet showing "6 open". "Let's fill it." lands a word per beat. Filtered build, snare roll, riser, a half-beat of silence. |
| 2 | 0:09–0:20 | **One push notification.** / **One push. Every member's phone.** / **Fully booked. Same day.** | Send one push notification to every member's phone, and fill the tee sheet the same day. | **Drop.** Admin types *"Quiet course this afternoon — tee off before 3pm and earn double Flagrr Cash"*, clicks Send (ripple). The notification lands on a phone with a glow; the slots fill on 8th notes and the badge flips to "Fully booked ✓". |
| 3 | 0:20–0:33 | **Scan. Earn. Spend.** *At your club.* / **Reasons to come back, built in.** (Weekly streaks · Member tiers · Birthday bonuses) / **They keep coming back.** | Members scan their slip, earn Flagrr Cash, and spend it at your club. Weekly streaks, tiers and birthday bonuses keep them coming back. | A slip is scanned into the phone; a glass "+510 Flagrr Cash" pill counts up. Three glass tiles with glowing borders. Real member Home screen with streak, tier and birthday chips. |
| 4 | 0:33–0:44 | **One admin dashboard.** / Rewards · Member comms · Fraud review · Live stats / **All in one place.** | One admin dashboard: rewards, member comms, fraud review and live stats, all in one place. | The real console rises on a 3D tilt; a glass stat card pulled out of it counts up to 184,350. Screens change every bar under a glass label pill. |
| 5 | 0:44–0:57 | **You're not alone.** / **Flagrr runs promos & competitions** (Platform-wide · At your club) / **Why?** / Something to win → More rounds played → More spend → **At your club.** | You're not doing this alone. Flagrr runs promotions and competitions, platform-wide and at your club. Why? A member with something to win plays more rounds, and spends more, at your club. | **Breakdown**: drums drop out, bells. Promo cards (*Double Flagrr Cash Weekend*, *October Medal*) rise in, then three glass icons joined by drawn arrows, building to the second drop. |
| 6 | 0:57–1:04 | ✓ No new hardware · ✓ No POS integration · ✓ Members pay nothing · ✓ Live in days / **Simple to start.** | No new hardware, no POS integration, members pay nothing, and you're live in days. | **Second drop.** A 2×2 glass bento grid, one tile lighting up per bar with its tick drawing in. |
| 7 | 1:04–1:13 | **We're building South Africa's no.1 loyalty & value app for golfers.** / **Build it with us.** | We're building South Africa's number one loyalty and value app for golfers. Build it with us. | Sunset swing at Strand. Lighter groove, then a roll into the last drop. |
| 8 | 1:13–1:24 | Flagrr logo / **Book a 30-minute walkthrough** / www.flagrr.com / *R2 500 for your first month · No lock-in contract* | Book a thirty-minute walkthrough at flagrr.com. | **Final drop.** Logo resolves out of a blur with a light sweep; the CTA button gets a glowing animated border. Final chord and ring-out. |

### Why the "not alone" beat is worded that way

The objection behind it is *"so we have to run the promotions ourselves?"* The answer has to be
both **what** (Flagrr runs platform-wide and club-specific promos and competitions) and **why it
helps the club**: a reason to play is a reason to visit, and Flagrr Cash is redeemed at the
member's home club, so the extra spend lands at the club and not anywhere else.

### Why the partnership beat is worded that way

"We're building South Africa's number one loyalty and value app for golfers" is a statement of
intent, not a request. "Build it with us" is an invitation from a team that's already moving:
it makes the club a co-builder rather than a customer being asked for a favour. It sits after the product proof (not before), so it reads as
ambition backed by a working product.

## Production notes

- **Plates:** `capture-console.mjs` renders the real app (course-admin console at 1600×1000 @2x,
  member app at 400×860 @3x) against mocked API data and screenshots it into `plates/`.
- **Ad banners:** `make-ad-banners.py` builds the two in-app banners shown in the member app.
- **Animation:** `video.html` is the whole film as one deterministic timeline (`render(t)`), so
  any frame can be re-rendered exactly.
- **Render:** `render.mjs` steps through every frame with Playwright (in parallel workers), then
  ffmpeg encodes H.264.
- **Music/SFX:** `make-audio.py` synthesises a ~109bpm house track arranged like a real song:
  a sung vocal-chop hook with glides, two chord progressions (the second half of the first drop
  re-harmonises the hook), a moving bassline, drum fills at every phrase end, shaker and
  rimshots, a bell counter-melody, a breakdown where bells carry the hook, a half-time build
  with a vocal stutter, and a whole-tone key change into the final drop. Plus picture-locked
  SFX. Slam hits,
  card hits and wipe whooshes are read straight from the cue lists in `video.html`, so sound and
  picture can't drift. Stems are written separately so a licensed track can replace the music.

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
5. **Music:** the synthesised track is built to the cut and works as-is. For a release-grade
   version, license a ~109bpm modern house track with drops at 0:09, 0:57 and 1:13 and
   lay `out/sfx-only.wav` over it.

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
