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
| `send-via-resend.mjs` | Sends a mailer through Resend, the service the app already uses. |
| `club-handover-instructions.txt` | The send instructions that go in that zip, written for a club secretary rather than a developer. |
| `strand-email-text-simple.txt` | The mailer as plain words plus image markers, for a club whose email editor has no HTML view. |

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

Strand sends through **ClubMaster**, its club management system, and systems
like it vary in whether the bulk-email editor exposes an HTML/source view. So
the pack carries both routes and the instruction sheet opens by telling the
reader which one they have:

- **Method A** — editor has a `< >` / "Source code" button: paste
  `flagrr-announcement.html` into it. Best result.
- **Method B** — ordinary rich-text editor: paste `email-text.txt` and insert
  the three numbered images where the text marks them.

Method B exists because a rich-text editor re-serialises whatever it is given
from its own DOM, which flattens a table-based design (see below). Words plus
inserted images survive that, because they are the things such editors are
built to hold.

Note `image-1-header.png`: a pre-rendered green banner with the logo on it.
The plain `flagrr-logo-white-email.png` is white, drawn to sit on the dark
green header band, so on a white editor background it would be invisible.

## Don't send it from a mail client's compose window

Gmail and Outlook compose windows rewrite the HTML you paste into them: they
strip background colours and re-serialise the markup from their own editor
DOM. A table-based mailer pasted into Gmail loses the green header band and
the tinted panels, and what gets sent is the flattened version, not the file.

Send it through something that transmits the HTML unchanged:

```sh
RESEND_API_KEY=re_xxx \
RESEND_FROM_EMAIL='Strand Golf Club <noreply@flagrr.com>' \
node marketing/send-via-resend.mjs you@example.com
```

Or paste the HTML into a campaign platform's "Custom HTML" campaign. Both
preserve the design; a compose window does not.

Note the sending domain: `api/_lib/email.ts` falls back to Resend's shared
`onboarding@resend.dev`, which only delivers to the Resend account owner's own
verified address. That's fine for a test send, but the member list needs a
verified sending domain configured in Resend.
