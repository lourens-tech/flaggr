#!/usr/bin/env python3
"""Regenerates the App Store / Play Store QR codes used in member mailers.

The PNGs live in mobile/assets/email/ and are copied into the web build by
mobile/scripts/copy-static-assets.sh, so they end up served from
https://app.flagrr.com/<name>.png — hosted, not inlined, because Gmail and
several other major clients strip base64 data URIs out of received HTML.

Usage:
    pip install segno
    python3 marketing/generate-store-qr.py

Edit STORE_URLS below and re-run whenever a store link changes.
"""
import pathlib
import sys

try:
    import segno
except ImportError:
    sys.exit("segno is not installed. Run: pip install segno")

# --- The only thing you normally need to edit -------------------------------
STORE_URLS = {
    "qr-app-store": "https://apps.apple.com/za/app/flagrr/id6796048910",
    "qr-play-store": "https://play.google.com/store/apps/details?id=com.flagrr.loyalty&hl=en",
}
# ---------------------------------------------------------------------------

# Flagrr Dark Green on white. Error correction "H" (~30% recoverable) so the
# code still scans off a printed poster or a phone screen held at an angle.
DARK = "#1F4234"
OUT_DIR = pathlib.Path(__file__).resolve().parent.parent / "mobile" / "assets" / "email"


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, url in STORE_URLS.items():
        path = OUT_DIR / f"{name}.png"
        qr = segno.make(url, error="h")
        # scale=10 with a 2-module quiet zone lands around 600px — rendered at
        # 150px in the mailer, so it stays crisp on retina displays.
        qr.save(path, scale=10, border=2, dark=DARK, light="white")
        print(f"{path.relative_to(OUT_DIR.parents[2])}  <-  {url}")


if __name__ == "__main__":
    main()
