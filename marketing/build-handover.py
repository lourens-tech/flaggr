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
        # Method 1's email-text.txt isn't copied verbatim — see below.
        "flagrr-announcement.jpg": MARKETING / "strand-flagrr-announcement.jpg",
        # Method 2 — paste the words, place three images in the body.
        "email-text-with-pictures.txt": MARKETING / "strand-email-text-simple.txt",
        "image-1-header.png": ASSETS / "flagrr-email-header.png",
        "image-2-qr-iphone.png": ASSETS / "qr-app-store.png",
        "image-3-qr-android.png": ASSETS / "qr-play-store.png",
        # Method 3 — paste into an editor's HTML/source view, if it has one.
        "flagrr-announcement.html": MAILER,
    }

    # The text version carries "Subject:" and "Preheader:" lines above a ---
    # rule, for whoever sets up the campaign. Someone told to select all and
    # paste would paste those into the message body, so the copy that goes to
    # the club starts below the rule. The subject is on the instruction sheet.
    full_text = (MARKETING / "strand-golf-club-pilot-launch.txt").read_text()
    if "---\n" not in full_text:
        sys.exit("expected a --- rule in the text version; check its format")
    paste_text = full_text.split("---\n", 1)[1].strip() + "\n"

    out = DIST / ZIP_NAME
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for name, src in members.items():
            if not src.exists():
                sys.exit(f"missing {src}")
            z.write(src, name)
        z.writestr("email-text.txt", paste_text)

    print(f"{out.relative_to(ROOT)}  ({out.stat().st_size // 1024} KB)")
    for name in zipfile.ZipFile(out).namelist():
        print(f"  {name}")


if __name__ == "__main__":
    main()
