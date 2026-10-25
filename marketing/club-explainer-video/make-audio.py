"""Synthesises the temp soundtrack for video.html: a warm 100bpm music bed plus
sound effects locked to the picture (whooshes on scene changes, keystrokes,
the Send click, the notification chime, tee-sheet fills, the receipt scan...).

Every cue time below mirrors a time in video.html's render(t) — move one, move
the other. Swap the music bed for a licensed track for the final release; the
SFX stem is written separately so it can be laid over any track.

    python3 marketing/club-explainer-video/make-audio.py
"""
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 48000
DUR = 62.0
N = int(SR * DUR)
OUT = Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)
rng = np.random.default_rng(7)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def at(t):
    return int(t * SR)


def env_adsr(n, a, d, s, r):
    e = np.ones(n) * s
    A, D, R = int(a * SR), int(d * SR), int(r * SR)
    A = min(A, n)
    e[:A] = np.linspace(0, 1, A)
    D = min(D, n - A)
    e[A:A + D] = np.linspace(1, s, D)
    if R and R < n:
        e[-R:] *= np.linspace(1, 0, R)
    return e


def add(buf, sig, t, gain=1.0):
    i = at(t)
    if i < 0:  # starts before the film: drop the head
        sig, i = sig[-i:], 0
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def lp(x, hz, order=2):
    return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x)


def hp(x, hz, order=2):
    return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


# ------------------------------------------------------------------ music
BEAT = 0.6  # 100 bpm
BAR = BEAT * 4
GRID0 = 0.2
# C major, I – V/B – vi – IV, two bars per chord: open and optimistic.
CHORDS = [
    [48, 55, 60, 64, 67, 74],  # Cadd9
    [47, 55, 59, 62, 67, 74],  # G/B
    [45, 52, 57, 60, 64, 71],  # Am7(add9)
    [41, 53, 57, 60, 64, 69],  # Fmaj7
]


def chord_at(t):
    return CHORDS[int(max(0, t - GRID0) // (BAR * 2)) % len(CHORDS)]


def pad(dur, notes):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    out = np.zeros(n)
    for note in notes[1:]:
        f = midi(note)
        for det in (-0.07, 0.0, 0.08):
            ff = f * 2 ** (det / 12)
            ph = rng.uniform(0, 2 * np.pi)
            for h in range(1, 7):  # band-limited saw
                out += np.sin(2 * np.pi * ff * h * tt + ph * h) / h * 0.5 ** (h > 3)
    return lp(out, 1600) * env_adsr(n, 1.0, 0.5, 0.85, 1.2)


def pluck(f, dur=0.45):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(4 * np.pi * f * tt) + 0.12 * np.sin(6 * np.pi * f * tt)
    return s * np.exp(-tt * 9) * np.minimum(1, tt / 0.004)


def kick():
    n = int(0.32 * SR)
    tt = np.arange(n) / SR
    f = 45 + 95 * np.exp(-tt * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)


def hat():
    n = int(0.05 * SR)
    return hp(rng.standard_normal(n), 7000) * np.exp(-np.arange(n) / SR * 90)


def bass(f, dur):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(4 * np.pi * f * tt)) * env_adsr(n, 0.01, 0.2, 0.6, 0.12)


music = np.zeros(N)
pads = np.zeros(N)
t = GRID0
while t < 56:
    notes = chord_at(t + 0.01)
    add(pads, pad(BAR * 2 + 1.2, notes), t - 0.3)
    t += BAR * 2
# Intro filter opens as the hook lands; final chord rings out under the CTA.
add(pads, pad(8.5, [36, 48, 55, 60, 64, 67, 72, 76]), 54.0, 0.85)
music += hp(pads, 170) * 0.075

plucks = np.zeros(N)
beats = np.arange(GRID0, 54.0, BEAT / 2)
for i, b in enumerate(beats):
    if b < 4.9 or 33.0 < b < 35.6:
        continue
    notes = chord_at(b)[2:]
    pattern = [0, 2, 1, 3, 2, 1, 3, 2]
    note = notes[pattern[i % 8] % len(notes)] + 12
    add(plucks, pluck(midi(note)), b, 0.9 if i % 2 == 0 else 0.6)
echo = np.zeros(N)
d = int(BEAT * 0.75 * SR)
echo[d:] = plucks[:-d] * 0.35
music += lp(plucks + echo, 5000) * 0.12

drums = np.zeros(N)
for i, b in enumerate(np.arange(GRID0, 54.0, BEAT)):
    if b > 12.8 and not (32.8 < b < 35.6) and not (47.8 < b < 48.4):
        add(drums, kick(), b, 0.9 if i % 2 == 0 else 0.6)
        add(music, bass(midi(chord_at(b)[0]), BEAT * 0.9), b, 0.12)
for b in np.arange(GRID0 + BEAT / 2, 54.0, BEAT):
    if b > 22.9 and not (32.8 < b < 35.6):
        add(drums, hat(), b, 0.18)
music += drums * 0.35

# Gentle fade in and out.
music *= np.minimum(1, np.arange(N) / (SR * 1.2))
music[-at(1.6):] *= np.linspace(1, 0, at(1.6))

# ------------------------------------------------------------------ sfx
def whoosh(dur=0.7, lo=250, hi=3500, peak=0.6):
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    steps = 24
    seg = n // steps
    for k in range(steps):
        f = lo * (hi / lo) ** (k / steps)
        chunk = bp(noise[max(0, k * seg - 2000):(k + 1) * seg], f * 0.6, min(f * 1.6, SR / 2 - 100))
        out[k * seg:(k + 1) * seg] = chunk[-seg:]
    tt = np.linspace(0, 1, n)
    e = np.where(tt < peak, (tt / peak) ** 2, ((1 - tt) / (1 - peak)) ** 1.5)
    return out * e


def tone(f, dur, decay, harm=0.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * tt) + harm * np.sin(4 * np.pi * f * tt)) * np.exp(-tt * decay) * np.minimum(1, tt / 0.003)


def click():
    n = int(0.03 * SR)
    tt = np.arange(n) / SR
    return (hp(rng.standard_normal(n), 2500) * 0.6 + np.sin(2 * np.pi * 1800 * tt)) * np.exp(-tt * 260)


def pop(f):
    n = int(0.18 * SR)
    tt = np.arange(n) / SR
    sweep = f * (1 + 0.5 * np.exp(-tt * 60))
    return np.sin(2 * np.pi * np.cumsum(sweep) / SR) * np.exp(-tt * 22) * np.minimum(1, tt / 0.002)


sfx = np.zeros(N)
# Scene transitions (each whoosh peaks on the cut).
for tc in (5.0, 13.0, 23.0, 33.0, 43.0, 48.0, 54.0):
    add(sfx, whoosh(), tc - 0.42, 0.35)
add(sfx, whoosh(1.0, 120, 1500, 0.7), 2.0, 0.22)  # tee sheet swings in

# Typing the title and message.
for a, b in ((6.3, 7.1), (7.2, 8.4)):
    for tk in np.arange(a, b, 0.055):
        add(sfx, click(), tk + rng.uniform(-0.01, 0.01), rng.uniform(0.05, 0.1))
add(sfx, click(), 8.78, 0.5)  # Send
add(sfx, lp(click(), 900), 8.78, 0.8)

# Notification chime.
add(sfx, tone(midi(88), 0.9, 6, 0.1), 9.05, 0.32)
add(sfx, tone(midi(93), 1.2, 5, 0.1), 9.17, 0.32)

# Tee slots filling: rising pops.
for k in range(6):
    add(sfx, pop(520 * 2 ** (k * 2 / 12)), 10.3 + k * 0.32, 0.4)

# Chips, scan, earn.
for i in range(4):
    add(sfx, pop(700 + i * 90), 14.0 + i * 0.16, 0.22)
add(sfx, whoosh(0.6, 400, 2500, 0.5), 14.5, 0.2)
add(sfx, tone(1320, 0.12, 30), 15.45, 0.18)
add(sfx, tone(1760, 0.12, 30), 16.05, 0.18)
add(sfx, whoosh(0.5, 600, 4000, 0.8), 16.2, 0.18)
add(sfx, tone(midi(91), 0.5, 9, 0.2), 16.72, 0.3)
add(sfx, tone(midi(96), 0.7, 8, 0.2), 16.8, 0.3)
for i in range(3):
    add(sfx, pop(880 + i * 120), 20.5 + i * 0.3, 0.25)

# Dashboard screens sliding.
for tc in (23.4, 27.4, 28.65, 29.9, 31.1):
    add(sfx, whoosh(0.45, 500, 3000, 0.6), tc - 0.2, 0.12)
# Promo cards and the flow nodes.
add(sfx, pop(640), 36.5, 0.3)
add(sfx, pop(760), 36.85, 0.3)
for i in range(3):
    add(sfx, pop(600 * 2 ** (i * 4 / 12)), 40.0 + i * 0.45, 0.3)
# Checks.
for i in range(4):
    add(sfx, pop(660 * 2 ** (i * 2 / 12)), 44.1 + i * 0.55, 0.35)
# Logo shimmer + CTA.
add(sfx, tone(midi(84), 2.0, 2.2, 0.15), 54.35, 0.18)
add(sfx, tone(midi(91), 2.0, 2.2, 0.15), 54.5, 0.15)
add(sfx, pop(880), 55.5, 0.3)

# ------------------------------------------------------------------ mix
def peak_norm(x, db=-1.0):
    return x / np.max(np.abs(x)) * 10 ** (db / 20)


mix = music + sfx * 0.9
mix = peak_norm(np.tanh(peak_norm(mix, 0) * 1.1), -1.0)
for name, sig in (("soundtrack.wav", mix), ("music-only.wav", peak_norm(music, -1)), ("sfx-only.wav", peak_norm(sfx, -1))):
    stereo = np.stack([sig, sig], axis=1)
    wavfile.write(OUT / name, SR, (stereo * 32767).astype(np.int16))
    print("wrote", OUT / name)
