#!/usr/bin/env python3
"""Builds a self-contained preview of a mailer, with every image inlined.

The mailers reference images by their hosted https://app.flagrr.com/... URLs,
because that's the only thing that renders reliably in a real inbox. That
makes them awkward to eyeball locally before the assets are deployed, so this
rewrites those URLs to base64 data URIs and writes a *.preview.html you can
open in a browser.

Preview only — never send the output. Gmail and others strip data URIs.

Usage:
    python3 marketing/make-preview.py marketing/<mailer>.html [out.html]
"""
import base64
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "mobile" / "assets" / "email"
HOSTED = re.compile(r"https://app\.flagrr\.com/([A-Za-z0-9._-]+\.png)")


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = pathlib.Path(sys.argv[1])
    out = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else src.with_suffix(".preview.html")

    def inline(match: re.Match) -> str:
        asset = ASSETS / match.group(1)
        if not asset.exists():
            print(f"  ! no local copy of {match.group(1)}, left as a hosted URL")
            return match.group(0)
        data = base64.b64encode(asset.read_bytes()).decode()
        return f"data:image/png;base64,{data}"

    out.write_text(HOSTED.sub(inline, src.read_text()))
    print(f"{out}")


if __name__ == "__main__":
    main()
