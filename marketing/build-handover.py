#!/usr/bin/env python3
"""Packs a mailer into a zip a club can be handed directly.

Clubs don't have the repo, and shouldn't need it. Strand sends through
ClubMaster's bulk email, and club management systems differ in whether their
editor exposes an HTML/source view, so the pack carries both routes: the
mailer itself for a source view, and the words plus three insertable images
for an ordinary rich-text editor. The instruction sheet starts by telling the
reader which of the two they have.

Usage:
    python3 marketing/build-handover.py
    -> marketing/dist/strand-flagrr-announcement.zip
"""
import pathlib
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

    members = {
        "HOW-TO-SEND.txt": MARKETING / "club-handover-instructions.txt",
        # Method A: pasted into an editor's HTML/source view.
        "flagrr-announcement.html": MAILER,
        # Method B: typed into an ordinary rich-text editor, with the three
        # images inserted by hand where the text marks them.
        "email-text.txt": MARKETING / "strand-email-text-simple.txt",
        "image-1-header.png": ASSETS / "flagrr-email-header.png",
        "image-2-qr-iphone.png": ASSETS / "qr-app-store.png",
        "image-3-qr-android.png": ASSETS / "qr-play-store.png",
    }

    out = DIST / ZIP_NAME
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for name, src in members.items():
            if not src.exists():
                sys.exit(f"missing {src}")
            z.write(src, name)

    print(f"{out.relative_to(ROOT)}  ({out.stat().st_size // 1024} KB)")
    for name in members:
        print(f"  {name}")


if __name__ == "__main__":
    main()
