# Marketing mailers

Member-facing campaign emails, kept alongside the transactional templates in
`api/_lib/` so they share one brand system (Flagrr Dark Green `#1F4234`,
Club Green `#00805A`, Lime `#CDDE5C`, Georgia headings, Helvetica body).

Unlike the transactional templates these are plain HTML, not TypeScript —
they're pasted into whatever ESP sends the campaign rather than rendered by
the API.

| File | What it is |
|---|---|
| `strand-golf-club-pilot-launch.html` | Pilot announcement to Strand Golf Club members: what Flagrr is, how it works, download QR codes. |
| `strand-golf-club-pilot-launch.txt` | Plain-text alternative (subject line at the top). Send it as the multipart text part — it keeps the campaign out of spam filters that penalise HTML-only mail. |
| `generate-store-qr.py` | Regenerates the App Store / Play Store QR codes. |
| `make-preview.py` | Builds a self-contained `*.preview.html` for eyeballing in a browser. |
| `build-handover.py` | Packs the mailer into a zip the club can be handed directly. |
| `club-handover-instructions.txt` | The send instructions that go in that zip, written for a club secretary rather than a developer. |

## Before you send

1. **Nothing to fill in.** The mailer has no merge fields — it addresses
   members collectively rather than by name, the pilot date is written in,
   and opting out is "reply to this email" rather than a tokenised link. If
   your ESP requires its own unsubscribe token, swap that footer line for the
   tag it expects (Mailchimp `*|UNSUB|*`, Campaign Monitor `<unsubscribe>`,
   and so on).
2. **Deploy first.** The mailer loads its logo and QR codes from
   `https://flagrr-loyalty.vercel.app/...`, served by the web build (see
   `mobile/scripts/copy-static-assets.sh`). The QR codes 404 until a deploy
   carrying them has gone out — send a test to yourself and confirm all three
   images render.

   It deliberately does *not* use `app.flagrr.com`: that domain is registered
   in Vercel but its DNS doesn't resolve publicly yet (same reason
   `mobile/src/api/client.ts` falls back to the vercel.app domain). Once DNS
   is configured, both work and either is fine.
3. **Send a test to a real iPhone and a real Android phone.** Scan both codes
   off a screen, and tap both buttons.

## Regenerating the QR codes

The PNGs are committed (`mobile/assets/email/qr-app-store.png`,
`qr-play-store.png`) so the mailer isn't dependent on a build step, but
they're generated, not hand-made. If a store URL changes, edit `STORE_URLS`
in `generate-store-qr.py` and re-run:

```sh
pip install segno
python3 marketing/generate-store-qr.py
```

They're written at error-correction level H (~30% of the code recoverable),
so they still scan off a printed poster or a phone held at an angle — the
same PNGs work for clubhouse signage and scorecards, not just email.

## Previewing locally

```sh
python3 marketing/make-preview.py marketing/strand-golf-club-pilot-launch.html
```

That writes `strand-golf-club-pilot-launch.preview.html` next to it with the
images inlined as base64 so it renders before anything is deployed. Preview
only — never send that file. Gmail and several other major clients strip
base64 data URIs out of received mail, which is why the mailer itself uses
hosted URLs.

## Writing another one

Copy the Strand mailer and keep the structure: table-based layout, inline
styles on every element, 600px max width, no external CSS and no background
images. That's the intersection of what Gmail, Apple Mail and Outlook's Word
rendering engine all handle. Keep the QR codes paired with a tappable button —
about half of members read the mail on the phone they'd be scanning with.

## Handing a mailer to a club

Clubs don't have the repo and shouldn't need it.

```sh
python3 marketing/build-handover.py
```

That writes `marketing/dist/strand-flagrr-announcement.zip` (gitignored, it's
a build output) containing the mailer, the text version, an images-inlined
copy, both QR codes as standalone PNGs, and `HOW-TO-SEND-THIS.txt`.

The inlined copy is there for a club that sends from Gmail or Outlook rather
than a campaign platform: opened in a browser and copy-pasted into a compose
window, the mail client re-hosts the images on its own, so that route works
even before a deploy has published them. The instruction sheet covers both
routes.

## Reels (video)

`explainer/` holds two motion-design reels in the same design language: flat
Flagrr colour fields cut on the beat, extra-wide Archivo type, Fraunces
italic for the talking lines, and small monospace labels. Each has its
own synthesised soundtrack and renders in two formats:
`?format=landscape` (1920×1080) and `?format=portrait` (1080×1920, for
Instagram, TikTok and LinkedIn stories).

| Reel | Audience | Length | Music |
|---|---|---|---|
| `member-reel.html` | Members: why to download and use the app | 44s | 80 BPM half-time trap, 808s, hat rolls, hard drops |
| `club-reel.html` | Club managers and committees: why to run Flagrr | 50s | 120 BPM house, electric-piano chords |

**Member reel:** the hook ("Your golf is about to start paying you back"),
Snap a receipt → +170 FC, the four tiers as morphing shapes, the balance
rolling up to Silver, streaks, the three perks, a rewards photo montage,
the QR voucher, and an end card with App Store / Google Play pills.

**Club reel:** the opportunity (members already spend at the club), then
one benefit per section, each backed by something built in the app:

- no new hardware (members photograph receipts, so there's no POS integration)
- more rounds, more often (weekly streak bonuses)
- a reason to keep spending (quarterly tiers, Gold/Platinum bar vouchers)
- spend stays at your club (your reward catalogue, redeemed by staff scanning a QR)
- know your members (the club dashboard and Excel export; the numbers are
  labelled on screen as illustrative)
- talk to them directly (push notifications by tier)
- fraud-checked receipts
- sponsor ad space with reporting

It ends on "Bring Flagrr to your club" and flagrr.com. If a claim stops
being true in the product, take it out of the reel.

| File | What it is |
|---|---|
| `reel-engine.js` | The shared engine: canvas, type helpers, generative pieces (dot-sphere golf ball, morphing shapes, truchet tiles), punch/glitch/grain post, transitions, playback, and a `?textlog=1` mode that records every text box so collisions can be checked. |
| `member-reel.html`, `club-reel.html` | Each reel's timeline: its tempo, drum pattern, shots and sound cues. |
| `audio.py` | Synthesises the soundtrack for either reel (`trap` or `house` style, picked by the page) plus every sound effect from the page's cue sheet. Every sound is generated, so nothing needs licensing. Needs numpy. |
| `render.cjs` | Screenshots every frame, builds the soundtrack, and muxes the two into an MP4. |

Open a reel's HTML in a browser to preview it. Space plays/pauses, ←/→ jump
1s, `?t=12` starts at 12s, and the link in the control bar switches format.
Once that reel's soundtrack has been rendered (`--audio-only`), the preview
plays it in sync. Preview from inside the repo, because the pages pull images
from `mobile/assets`.

To render (needs Playwright with Chromium, ffmpeg, and python3 with numpy):

```sh
node marketing/explainer/render.cjs                                # member, 16:9 -> marketing/dist/flagrr-member-reel-16x9.mp4
node marketing/explainer/render.cjs --format portrait              # member, 9:16
node marketing/explainer/render.cjs --reel club                    # club,   16:9 -> marketing/dist/flagrr-club-reel-16x9.mp4
node marketing/explainer/render.cjs --reel club --format portrait  # club,   9:16
node marketing/explainer/render.cjs --reel club --audio-only       # just marketing/dist/club-reel.wav, for the preview
```

How picture and sound stay locked:

- **Every frame is a pure function of time**, so the renderer can seek to
  any frame and the output is frame-perfect however slow the machine is.
- **The drum pattern lives in each reel's HTML** because the picture
  punches on the kicks. `audio.py` gets the same kick and snare times, plus
  a cue for every effect the shots fire, and builds the music around them.
- **Cuts land on the beat grid** of each reel's tempo.

When you change copy, check that no two pieces of text collide. Open a reel
with `?render=1&textlog=1`: `window.FLAGRR.seek(t)` returns the screen box
of every visible piece of text at time `t`, so a short Playwright loop over
the timeline can flag any pair that intersects. Both reels currently pass in
both formats at every frame.
