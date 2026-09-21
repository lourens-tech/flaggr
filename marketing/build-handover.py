#!/usr/bin/env python3
"""Packs a mailer into a zip a club can be handed directly.

Clubs don't have the repo, and shouldn't need it. This bundles the mailer,
the plain-text version, an images-inlined copy they can paste straight into
Gmail or Outlook, the QR codes as standalone PNGs (they print), and the
plain-language instruction sheet.

Usage:
    python3 marketing/build-handover.py
    -> marketing/dist/strand-flagrr-announcement.zip
"""
import pathlib
import subprocess
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
MARKETING = ROOT / "marketing"
ASSETS = ROOT / "mobile" / "assets" / "email"
DIST = MARKETING / "dist"

MAILER = MARKETING / "strand-golf-club-pilot-launch.html"
ZIP_NAME = "strand-flagrr-announcement.zip"


def main() -> None:
    DIST.mkdir(exist_ok=True)
    inline = DIST / "flagrr-announcement-INLINE.html"

    # Regenerate the inlined copy so it can never lag behind the mailer.
    subprocess.run(
        [sys.executable, str(MARKETING / "make-preview.py"), str(MAILER), str(inline)],
        check=True,
        stdout=subprocess.DEVNULL,
    )

    members = {
        "HOW-TO-SEND-THIS.txt": MARKETING / "club-handover-instructions.txt",
        "flagrr-announcement.html": MAILER,
        "flagrr-announcement.txt": MARKETING / "strand-golf-club-pilot-launch.txt",
        "flagrr-announcement-INLINE.html": inline,
        "qr-app-store.png": ASSETS / "qr-app-store.png",
        "qr-play-store.png": ASSETS / "qr-play-store.png",
    }

    out = DIST / ZIP_NAME
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for name, src in members.items():
            if not src.exists():
                sys.exit(f"missing {src}")
            z.write(src, name)

    inline.unlink()
    print(f"{out.relative_to(ROOT)}  ({out.stat().st_size // 1024} KB)")
    for name in members:
        print(f"  {name}")


if __name__ == "__main__":
    main()
