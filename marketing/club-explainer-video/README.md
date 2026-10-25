# Flagrr for Clubs: explainer video

A 91-second motion-graphics sales video for South African golf clubs. The script, creative
rationale and shot list are in [SCRIPT.md](SCRIPT.md).

Everything here is reproducible from the repo. Nothing is hand-edited in a video tool, so any
line of copy, timing or screen can be changed and the film re-rendered.

| File | What it does |
|---|---|
| `capture-console.mjs` | Renders the real app (course-admin console + member app) against demo data for Strand Golf Club and screenshots it into `plates/`. |
| `make-ad-banners.py` | Builds the two in-app ad banners (platform promo, club competition) used in the member plates and the "not alone" scene. |
| `video.html` | The film. One deterministic timeline: `render(t)` poses every element for time `t`. Open with `?play` to preview in a browser, or `?t=12.5` for a single frame. |
| `make-audio.py` | Synthesises the 100bpm track and picture-locked SFX (cues read from `video.html`) into `out/`. |
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
