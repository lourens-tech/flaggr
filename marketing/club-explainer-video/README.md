# Flagrr for Clubs: explainer video

An 80-second motion-graphics sales video for South African golf clubs. The script, creative
rationale and shot list are in [SCRIPT.md](SCRIPT.md).

Everything here is reproducible from the repo. Nothing is hand-edited in a video tool, so any
line of copy, timing or screen can be changed and the film re-rendered.

| File | What it does |
|---|---|
| `capture-console.mjs` | Renders the real app (course-admin console + member app) against demo data for Strand Golf Club and screenshots it into `plates/`. |
| `make-ad-banners.py` | Builds the two in-app ad banners (platform promo, club competition) used in the member plates and the "not alone" scene. |
| `video.html` | The film. One deterministic timeline: `render(t)` poses every element for time `t`. Open with `?play` to preview in a browser, or `?t=12.5` for a single frame. |
| `make-audio.py` | Synthesises the ~114bpm track and picture-locked SFX (cues read from `video.html`) into `out/`. |
| `render.mjs` | Steps `video.html` frame by frame (30fps) into `out/flagrr-for-clubs-silent.mp4`. `--workers 4` renders in parallel; `--stills 1,8.9` renders single frames instead. |
| `assets/` | Brand fonts (Fraunces, Poppins; OFL), logos, Strand Golf Club photography, ad banners, film-grain texture. |
| `plates/` | Captured app screens used in the film. |

## Rebuild

```sh
# 1. App plates (only needed if the app UI changed)
(cd mobile && npm ci && npx expo start --web --port 8081) &
node marketing/club-explainer-video/capture-console.mjs

# 2. Picture, sound, mux
node marketing/club-explainer-video/render.mjs --workers 4
python3 marketing/club-explainer-video/make-audio.py      # needs numpy + scipy
cd marketing/club-explainer-video/out
ffmpeg -i soundtrack.wav -af "loudnorm=I=-14.5:TP=-3:LRA=11,alimiter=limit=0.66:attack=1:release=40:level=disabled" master.wav
# re-encode for delivery: the film grain makes the lossless-ish render ~100 MB; CRF 21 keeps it clean at ~30 MB
ffmpeg -i flagrr-for-clubs-silent.mp4 -i master.wav -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -shortest -movflags +faststart flagrr-for-clubs.mp4
```

`out/` is git-ignored. Rendered videos are delivered separately.

## Drone footage

The hook (0:02–0:06) and partnership (1:01–1:09) scenes use the Strand Golf Club photos unless
a clip is present in `assets/footage/`. A clip replaces the photo and is seeked frame-accurately,
so the render stays deterministic. Playwright's Chromium only decodes open codecs, so convert
each clip to 1080p VP9 WebM first:

```sh
ffmpeg -ss <start> -t <seconds> -i raw-clip.mp4 \
  -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30" \
  -c:v libvpx-vp9 -b:v 6M -an marketing/club-explainer-video/assets/footage/hook.webm
```

| Slot | File | Needs at least | Shot |
|---|---|---|---|
| Hook | `assets/footage/hook.webm` | 5 s | Slow drone push over an empty fairway or tee box, weekday light |
| Partnership | `assets/footage/partner.webm` | 9 s | Golden-hour drone reveal over the course, ideally with mountains |

`assets/footage/` is git-ignored: licensed footage stays out of the repo.
