# Flagrr Brand Kit

Condensed from the published brand kit (v1.0, 24 September 2026, maintained by Lourens Vorster): https://claude.ai/artifact/8hTJ3j1tCzVgiqugdwkb5q
The artifact is the source of truth and carries the artwork and specimens; this page keeps the rules in the repo so every contributor (and Claude) works from the same values.


## Colour (six values, no others)
- Fairway Green #1F4234 (ground, default for whole surfaces)
- Flag Green #00805A (interface: links, states, in-product; not a marketing ground)
- Lime #CDDE5C (signal; one lime idea per frame; never text on cream/white, 1.38:1)
- Cream #FAF7EE (light ground; never pure white)
- Ink #1F1F1F (body text on cream and lime)
- Slate #4B5563 (captions, disclaimers; only on cream/white)
Key pairings: lime on fairway 7.52, lime on ink 11.14, white on fairway 11.13, fairway on cream 10.39, slate on cream 7.05, flag green on cream 4.63.
No Pantone assigned yet. CMYK values are unprofiled sRGB conversions.
Tier colours (approved 2026-10-29; used only to mark a tier, never as a ground or for text): Bronze #B9773E, Silver #AEB8BF, Gold #E2B93B, Platinum #E8ECEF.

## Type
- Fraunces 800 for display (second line italic + lime, line-height .88-.92, tracking -0.02em); Fraunces 600 italic for handwritten captions; never below 20px on screen; never letterspace display.
- Poppins: 500 lead/body, 700 uppercase labels (tracking .14em), 600 micro.
- No substitute serifs; wait for font or use Poppins 700. Tabular figures for tiers/FC/dashboards.

## Mark
Script wordmark with LOYALTY beneath, one locked piece. Allowed: lime on fairway (primary), lime on ink (over scrim), fairway on cream, fairway on lime.
Min size: 140px screen, 30mm print. Clear space 15% of wordmark width.
The Flagrr icon mark on its own (`mobile/assets/images/flagrr-icon-lime.png`, used in the admin sidebar): minimum 24px on screen (approved 2026-10-29).
Never: recolour, stroke/shadow/glow/box, stretch/skew/rotate/arch, busy photo without scrim, rebuild in a font. Vector masters (SVG/AI/EPS) not yet supplied.

## Photography
Real SA golf: light, dust, movement, people mid-action, from behind/mid-stride, golden hour, aerials for club-facing. Four scrims only: bottom-anchored (default), diagonal, fade to cream, flat wash. No image repeats within a campaign; no posed grins, heavy filters, clubhouse interiors, non-customer courses. Licensed stock only.

## Motifs (1-2 per frame)
Tape (lime strip, three-beat phrase), sticker (lime disc, 10-14 deg, never over a face), polaroid (white frame, lowercase Fraunces italic caption, two lime tape strips), outline numeral (Fraunces 800, 2.5-3px lime stroke, 12-35% opacity).

## Voice
Fun, warm, quick, cheeky, South African golf vernacular. Use: earn, stack, redeem, Flagrr Cash (then FC), four-ball, the 19th, halfway house, arvo, say less, sorted. Golfers: second person, present tense, short; never explain the business model. Clubs: plain and specific, club is the hero, tag "FOR CLUBS".
Never: cash it in, cash back, wallet, withdraw, balance, "points" for Flagrr Cash, leverage/seamless/solution/empower/revolutionise/game-changer, meaningless golf puns. FC is never framed as money or convertible to money.

## Claims
Never state: member/club counts, redemption volumes, growth, pilot results; unreal testimonials; a club's name/crest without written agreement; universal earn rates or reward values (set per club); any FC = rand equivalence.
Safe: tiers Bronze 1x, Silver 1.2x @5,000 FC/qtr, Gold 1.5x @10,000, Platinum 1.7x @15,000; referral 15 FC per member, 500 FC per club after first payment, max 10 bonuses per member; dashboard/tiers/catalogue/notifications/segmentation included in one price; sample figures with "shown with sample data".

## Clubs / co-branding
Club crest leads, Flagrr follows (1px rule or clear space). Club keeps its own colours; lime only on Flagrr elements. Wording: "Club is piloting Flagrr" / "powered by Flagrr", never "Flagrr presents". Rewards are the club's. Regenerate club artwork per club.

## Outstanding (blockers)
Vector masters; Pantone for Fairway Green and Lime; official App Store/Google Play badges (placeholder pill in use); generic dashboard screenshot.
Contact: flagrr.com, @flagrrgolf.

## Where the app and the marketing site differ from this kit

Keep this list current; fix items here or record why the exception stands.

- The marketing-site wording that equated Flagrr Cash with rands ("R1 = 1", "on every rand") was removed on 2026-10-28. The season calculator and the R100 / R200 bar voucher amounts still conflict with the kit; see `docs/Known-Limitations-and-Future-Work.md`.
- **Admin consoles ("Liquid Glass", 2026-10-29).** The course-admin, staff, super-admin and support-agent consoles use their own palette (`mobile/src/theme/admin.ts`), applied by `AdminThemeScope`; member screens are unchanged. The exceptions this kit allows there:
  - Interface text and numbers use the system font (SF Pro, Segoe UI, Roboto) instead of Poppins, for dense tables and forms. Fraunces 800 stays for page titles.
  - Dark mode uses near-black greens (window #0B1511, tiles #152019) and off-white text #F4F5F0; light mode uses a #ECEEE6 window and white tiles. Translucent glass appears only on navigation (sidebar, toolbar, tab bar, sheets), over a heavily blurred club cover photo, or the Flagrr photo for the Flagrr team and sign-in.
  - Lime is the accent in dark mode; in light mode the accent is Flag Green (#00805A, text #00704F) because lime on light fails contrast. One accent idea per screen; selection is neutral.
  - Status colours outside the six: red #C8322A (count badges), plus muted red, amber and green tints for status pills.
- The app theme (`mobile/src/theme/colors.ts`) uses the same hex values under older names: `darkGreen` = Fairway Green, `clubGreen` = Flag Green, `lime` = Lime. The emails and mailers use these older names too. Confirm against the values above when changing any of them.
