#!/usr/bin/env python3
"""Synthesises a reel's soundtrack: the music bed plus every sound effect.

Two styles, picked by the page (window.FLAGRR.AUDIO.style):
  trap   the member reel: 80 BPM half-time, saturated 808s, hat rolls, builds
  house  the club reel: 120 BPM four-on-the-floor, warm electric-piano chords

Nothing is sampled or licensed. Every sound is built here from oscillators and
noise, so the track is royalty-free and can be posted anywhere.

The timing comes from the animation. render.cjs reads window.FLAGRR.AUDIO
out of flagrr-explainer.html and passes it here as JSON:
  - kicks / snares: the drum hits, which the picture also punches on
  - groove / builds / gaps / tapeStop / finalHit: the arrangement
    (tapeStop is trap-only)
  - cues: one entry per sound effect (hit, swipe, glitch, shutter...)
Retime the animation and the beat moves with it.

Usage:
    python3 marketing/explainer/audio.py audio.json out.wav

Needs numpy only.
"""
import json
import sys
import wave

import numpy as np

SR = 48000
RNG = np.random.default_rng(7)


# ----------------------------------------------------------------- helpers
def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def secs(n):
    return np.arange(n) / SR


def ns(dur):
    return max(1, int(round(dur * SR)))


def noise(n):
    return RNG.uniform(-1, 1, n)


def spec(x, gain_of_f):
    """Zero-phase filtering in the frequency domain (fine for whole buffers)."""
    n = len(x)
    size = 1 << (n + 1024).bit_length()
    f = np.fft.rfftfreq(size, 1 / SR)
    return np.fft.irfft(np.fft.rfft(x, size) * gain_of_f(f), size)[:n]


def lp(x, fc, order=2):
    return spec(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)))


def hp(x, fc, order=2):
    return spec(x, lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order)))


def bp(x, lo, hi, order=2):
    return hp(lp(x, hi, order), lo, order)


def sweep(x, fc_of_t, kind="lp", width=0.7, frame=2048, hop=512):
    """Time-varying filter via STFT: fc_of_t(seconds) -> cutoff/centre in Hz."""
    n = len(x)
    win = np.hanning(frame)
    pad = np.concatenate([np.zeros(frame), x, np.zeros(frame)])
    out = np.zeros_like(pad)
    wsum = np.zeros_like(pad)
    f = np.fft.rfftfreq(frame, 1 / SR)
    for start in range(0, len(pad) - frame, hop):
        fc = max(20.0, float(fc_of_t(max(0.0, (start + frame / 2 - frame) / SR))))
        if kind == "lp":
            g = 1 / np.sqrt(1 + (f / fc) ** 4)
        else:  # band-pass, gaussian in octaves
            g = np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) / width) ** 2)
        seg = np.fft.irfft(np.fft.rfft(pad[start:start + frame] * win) * g, frame) * win
        out[start:start + frame] += seg
        wsum[start:start + frame] += win ** 2
    return (out / np.maximum(wsum, 1e-6))[frame:frame + n]


def saw(f, n, maxf=5000.0, phase=0.0):
    """Band-limited sawtooth by additive synthesis; f may be a scalar."""
    t = secs(n)
    y = np.zeros(n)
    for k in range(1, max(1, int(min(maxf, SR * 0.45) / f)) + 1):
        y += np.sin(2 * np.pi * k * f * t + k * phase) / k
    return y * (2 / np.pi)


def adsr(n, a, d, s, r):
    t = secs(n)
    dur = n / SR
    e = np.full(n, s, dtype=float)
    e = np.where(t < a, t / max(a, 1e-6), e)
    m = (t >= a) & (t < a + d)
    e[m] = 1 - (1 - s) * (t[m] - a) / d
    m = t > dur - r
    e[m] *= np.clip((dur - t[m]) / r, 0, 1)
    return e


def osc(freq):
    """Sine from a per-sample frequency array."""
    return np.sin(2 * np.pi * np.cumsum(freq) / SR)


def glide(f0, f1, n, rate):
    t = secs(n)
    return osc(f1 + (f0 - f1) * np.exp(-t * rate))


def within(t, ranges):
    return any(a <= t < b for a, b in ranges)


# ----------------------------------------------------------------- mixer
class Bus:
    def __init__(self, n):
        self.x = np.zeros((2, n))

    def add(self, t, mono, gain=1.0, pan=0.0):
        i = int(round(t * SR))
        if i >= self.x.shape[1] or len(mono) == 0:
            return
        if i < 0:
            mono, i = mono[-i:], 0
        m = mono[: self.x.shape[1] - i]
        a = (pan + 1) * np.pi / 4
        self.x[0, i:i + len(m)] += m * gain * np.cos(a)
        self.x[1, i:i + len(m)] += m * gain * np.sin(a)


def reverb_ir(dur=1.8, decay=3.4, damp=6000):
    n = ns(dur)
    t = secs(n)
    ir = np.stack([noise(n), noise(n)]) * np.exp(-t * decay)
    ir = np.stack([lp(ir[0], damp), lp(ir[1], damp)])
    ir[:, : ns(0.01)] = 0
    return ir / np.sqrt(np.sum(ir ** 2) / 2) * 0.3


def convolve(x, ir):
    n = x.shape[1] + ir.shape[1]
    size = 1 << n.bit_length()
    return np.stack([np.fft.irfft(np.fft.rfft(x[c], size) * np.fft.rfft(ir[c], size), size)[: x.shape[1]] for c in range(2)])


# ----------------------------------------------------------------- drums
def kick_click():
    """The punch on top of every 808."""
    n = ns(0.12)
    t = secs(n)
    body = glide(190, 60, n, 40) * np.exp(-t * 28)
    body[: ns(0.003)] += lp(noise(ns(0.003)), 6000) * 0.9
    return np.tanh(body * 2.0) * 0.8


def eight08(f0, f1, dur, glide_at=None):
    """808: saturated sine with a pitch drop on the attack, optional slide to f1."""
    n = ns(dur)
    t = secs(n)
    f = np.full(n, f0)
    if glide_at is not None and f1 != f0:
        k = np.clip((t - glide_at) / 0.09, 0, 1)
        f = f0 * (f1 / f0) ** k
    f = f * (1 + 0.6 * np.exp(-t * 45))
    y = osc(f)
    env = np.minimum(1, t / 0.003) * np.exp(-t * 1.1) * np.minimum(1, (dur - t) / 0.04)
    # drive it so the harmonics carry on phone speakers that can't play the fundamental
    return np.tanh(y * env * 3.2) / np.tanh(3.2)


def snare():
    n = ns(0.32)
    t = secs(n)
    crack = bp(noise(n), 1800, 9000) * np.exp(-t * 26)
    body = osc(np.full(n, 195.0) * (1 + 0.3 * np.exp(-t * 60))) * np.exp(-t * 30) * 0.55
    clap = np.zeros(n)
    nz = bp(noise(n), 900, 5000)
    for off in (0, 0.009, 0.019):
        i = ns(off)
        clap[i:] += nz[: n - i] * np.exp(-secs(n - i) * 70) * 0.6
    return np.tanh((crack + body + clap) * 1.4) * 0.85


def hat(open_=False, tone=1.0):
    n = ns(0.28 if open_ else 0.045)
    y = hp(noise(n), 7500 * tone, 3)
    # a little metallic ring
    t = secs(n)
    y += sum(np.sign(np.sin(2 * np.pi * f * tone * t)) for f in (3200, 4570, 6230)) * 0.05
    return hp(y, 6000, 2) * np.exp(-t * (8 if open_ else 85))


def crash():
    n = ns(1.6)
    return hp(noise(n), 5000, 2) * np.exp(-secs(n) * 2.8) * 0.4


# ----------------------------------------------------------------- sound effects
def sfx_hit(**_):
    """Trailer impact: sub boom, transient snap, noise body, crash tail."""
    n = ns(2.0)
    t = secs(n)
    boom = np.tanh(glide(95, 32, n, 5) * np.exp(-t * 2.4) * 2.5)
    snap = hp(noise(ns(0.03)), 2000) * np.exp(-secs(ns(0.03)) * 120)
    body = lp(noise(n), 1800) * np.exp(-t * 10) * 0.5
    y = boom * 0.85 + body
    y[: len(snap)] += snap * 0.8
    y += np.pad(crash(), (0, n - ns(1.6))) * 0.7
    return y


def sfx_thump(pitch=0, **_):
    n = ns(0.3)
    t = secs(n)
    y = glide(150 * 2 ** (pitch / 12), 62, n, 32) * np.exp(-t * 15)
    y[: ns(0.003)] += hp(noise(ns(0.003)), 3000) * 0.6
    return np.tanh(y * 1.8) * 0.9


def sfx_whoosh(pitch=0, dur=0.5, **_):
    n = ns(dur)
    peak = 2600 * 2 ** (pitch / 12)
    y = sweep(noise(n), lambda tt: 300 + (peak - 300) * min(1, tt / dur) ** 1.6, kind="bp", width=1.0, frame=1024, hop=256)
    env = np.clip(secs(n) / dur, 0, 1) ** 2.2 * np.minimum(1, (dur - secs(n)) / 0.03)
    return y * env * 2.4


def sfx_swipe(pitch=0, **_):
    n = ns(0.2)
    y = sweep(noise(n), lambda tt: 1500 * 2 ** (pitch / 12) + 9000 * tt / 0.2, kind="bp", width=0.6, frame=512, hop=128)
    env = np.sin(np.pi * np.clip(secs(n) / 0.2, 0, 1)) ** 1.5
    return y * env * 2.2


def sfx_glitch(dur=0.15, **_):
    """Stuttered digital garbage: sample-and-hold squares and crushed noise."""
    n = ns(dur + 0.05)
    y = np.zeros(n)
    i = 0
    r = np.random.default_rng(int(dur * 1000))
    while i < n:
        seg = int(r.uniform(0.008, 0.03) * SR)
        f = r.choice([180, 360, 720, 1440, 2880]) * r.uniform(0.9, 1.1)
        tt = secs(min(seg, n - i))
        if r.random() < 0.5:
            s = np.sign(np.sin(2 * np.pi * f * tt))
        else:
            s = np.repeat(r.uniform(-1, 1, len(tt) // 40 + 1), 40)[: len(tt)]
        y[i:i + len(tt)] = s * r.uniform(0.3, 1) * (r.random() > 0.15)
        i += seg
    return lp(y, 7000) * np.minimum(1, (n / SR - secs(n)) / 0.02) * 0.5


def sfx_click(pitch=0, **_):
    n = ns(0.03)
    t = secs(n)
    return (np.sin(2 * np.pi * 1800 * 2 ** (pitch / 12) * t) * np.exp(-t * 180) + hp(noise(n), 3000) * np.exp(-t * 600) * 0.6) * 0.7


def sfx_tick(pitch=0, **_):
    n = ns(0.025)
    t = secs(n)
    return np.sin(2 * np.pi * 3000 * 2 ** (pitch / 24) * t) * np.exp(-t * 260) * 0.6 + hp(noise(n), 6000) * np.exp(-t * 900) * 0.4


def sfx_type(dur=0.4, **_):
    n = ns(dur + 0.05)
    y = np.zeros(n)
    r = np.random.default_rng(int(dur * 997))
    tt = 0.0
    while tt < dur:
        c = sfx_click(pitch=r.uniform(-3, 5)) * r.uniform(0.35, 0.7)
        i = ns(tt)
        y[i:i + len(c)] += c[: n - i]
        tt += r.uniform(0.028, 0.05)
    return y * 0.8


def sfx_scan(dur=1.5, **_):
    n = ns(dur)
    t = secs(n)
    sw = sweep(noise(n), lambda tt: 500 * (8 ** (min(1, tt / dur))), kind="bp", width=0.35, frame=1024, hop=256)
    hum = np.sin(2 * np.pi * 60 * t) * 0.3 + np.sign(np.sin(2 * np.pi * 120 * t)) * 0.04
    env = np.minimum(1, t / 0.05) * np.minimum(1, (dur - t) / 0.15)
    return (sw * 1.2 + hum) * env * 0.5


def sfx_zip(**_):
    n = ns(0.1)
    t = secs(n)
    return osc(300 + 2200 * (t / 0.1) ** 2) * np.sin(np.pi * t / 0.1) * 0.35


def sfx_morph(pitch=0, **_):
    n = ns(0.35)
    t = secs(n)
    f = 420 * 2 ** (pitch / 12) * np.exp(-t * 7) + 70
    y = np.tanh(osc(f) * 3) * np.exp(-t * 6)
    return lp(y, 2500) * 0.5


def sfx_shutter(**_):
    y = np.zeros(ns(0.12))
    for off, g in ((0, 1.0), (0.045, 0.7)):
        c = bp(noise(ns(0.018)), 1500, 7000) * np.exp(-secs(ns(0.018)) * 200)
        i = ns(off)
        y[i:i + len(c)] += c * g
    t = secs(len(y))
    y += np.sin(2 * np.pi * 140 * t) * np.exp(-t * 60) * 0.3
    return y * 1.3


def sfx_shine(**_):
    n = ns(0.7)
    t = secs(n)
    rise = hp(noise(n), 6000) * (t / 0.7) ** 3 * np.minimum(1, (0.7 - t) / 0.01)
    return rise * 0.9


def sfx_ping(pitch=0, **_):
    """Soft two-note notification, sine only so it never turns into a slot machine."""
    y = np.zeros(ns(0.4))
    for i, m in enumerate((81, 88)):
        n = ns(0.3)
        t = secs(n)
        tone = np.sin(2 * np.pi * hz(m + pitch) * t) * np.exp(-t * 14) * np.minimum(1, t / 0.004)
        s = ns(i * 0.08)
        y[s:s + n] += tone[: len(y) - s] * (0.8 if i else 0.6)
    return y * 0.5


def sfx_rise(pitch=0, **_):
    """Short upward swell for bars that grow."""
    n = ns(0.35)
    t = secs(n)
    f = hz(62 + pitch) * 2 ** (-5 / 12 * np.exp(-t * 18))
    return np.tanh(osc(f) * 1.5) * np.exp(-t * 7) * 0.5


SFX = {name[4:]: fn for name, fn in globals().items() if name.startswith("sfx_")}


# ----------------------------------------------------------------- the music
# i  VI  iv  V in D minor, one chord per bar; the V is major for the tension
CHORDS = [
    {"root": 38, "pad": [50, 53, 57, 62]},  # Dm   (808 on D2)
    {"root": 34, "pad": [46, 50, 53, 58]},  # Bb   (808 on Bb1)
    {"root": 31, "pad": [43, 50, 55, 58]},  # Gm   (808 on G1)
    {"root": 33, "pad": [45, 49, 52, 57]},  # A    (808 on A1)
]
# dark pluck hook, (sixteenth step, midi) per bar
HOOK = [
    [(0, 69), (3, 65), (6, 74), (8, 72), (10, 69), (13, 65)],
    [(0, 70), (3, 65), (6, 74), (8, 72), (10, 70), (13, 65)],
    [(0, 67), (3, 62), (6, 70), (8, 69), (10, 67), (13, 62)],
    [(0, 69), (3, 64), (6, 73), (8, 76), (10, 73), (13, 69)],
]


def compose_trap(spec_, n):
    bar = spec_["bar"]
    s16 = bar / 16
    groove, builds, gaps = spec_["groove"], spec_["builds"], spec_["gaps"]
    tape = spec_["tapeStop"]
    final = spec_["finalHit"]
    kicks = spec_["kicks"]
    snares = spec_["snares"]
    nbars = int(np.ceil(final / bar))

    drums, bass, pad, keys = Bus(n), Bus(n), Bus(n), Bus(n)
    KC, SN, CR = kick_click(), snare(), crash()

    # --- 808s: each one rings until the next kick, sliding into it when the root changes
    for i, k in enumerate(kicks):
        t = k["t"]
        b = k["bar"] % 4
        root = CHORDS[b]["root"]
        if k.get("last"):
            drums.add(t, KC, 1.0)
            bass.add(t, eight08(hz(root), hz(root), 2.2), 0.95)
            continue
        nxt = kicks[i + 1]["t"] if i + 1 < len(kicks) else t + 1.0
        dur = min(1.4, max(0.18, nxt - t))
        nb = kicks[i + 1]["bar"] % 4 if i + 1 < len(kicks) else b
        nroot = CHORDS[nb]["root"]
        # every fourth hit jumps up an octave for bounce
        note = root + (12 if (i % 7 == 5) else 0)
        slide = (nroot != root or note != root) and dur > 0.3
        drums.add(t, KC, 0.9)
        bass.add(t, eight08(hz(note), hz(nroot if nroot != root else root), dur, glide_at=dur - 0.12 if slide else None), 0.9)

    for t in snares:
        drums.add(t, SN, 0.85, 0.05)

    # --- hats: sixteenths at 80 (eighths at 160), with rolls on the last beat of some bars
    for b in range(nbars):
        t0 = b * bar
        if not within(t0, groove):
            continue
        for s in range(16):
            ts = t0 + s * s16
            roll = (b % 2 == 1 and s >= 14) or (b % 4 == 3 and s >= 12)
            if roll and b % 4 == 3 and s >= 12:
                if s == 12:  # triplet roll across the last beat, pitching up
                    for j in range(6):
                        drums.add(t0 + 12 * s16 + j * (4 * s16 / 6), hat(tone=1 + j * 0.05), 0.32 + j * 0.03, 0.3)
                continue
            if roll:
                for j in range(2):  # thirty-seconds
                    drums.add(ts + j * s16 / 2, hat(tone=1 + (s - 14) * 0.08 + j * 0.04), 0.3, 0.3)
                continue
            vel = 0.42 if s % 4 == 0 else (0.3 if s % 2 == 0 else 0.22)
            drums.add(ts, hat(), vel, 0.3 if s % 2 else -0.15)
        if b % 2 == 0:
            drums.add(t0 + 6 * s16, hat(True), 0.22, -0.3)

    # crash on every groove downbeat that starts a section, and on the final hit
    for t in sorted({g[0] for g in groove} | {final}):
        drums.add(t, CR, 0.6, -0.2)

    # --- builds: accelerating snare roll + noise riser + pitch siren, then a hard gap
    for a, b_ in builds:
        dur = b_ - a
        t = a
        while t < b_ - s16 * 0.5:
            k = (t - a) / dur
            step = s16 * 2 if k < 0.35 else (s16 if k < 0.7 else s16 / 2)
            hit = snare() * (0.25 + 0.6 * k)
            drums.add(t, hit, 1.0, 0.0)
            t += step
        rn = ns(dur)
        riser = sweep(noise(rn), lambda tt, d=dur: 250 * (40 ** (tt / d)), kind="bp", width=0.7)
        riser *= np.linspace(0, 1, rn) ** 2.2
        drums.add(a, riser, 0.5)
        siren = np.tanh(osc(hz(50) * 2 ** (24 * (secs(rn) / dur) ** 2 / 12)) * 2) * np.linspace(0, 1, rn) ** 3
        drums.add(a, lp(siren, 3000), 0.18)

    # --- pads: dark detuned stacks, quiet under everything
    voice_cache = {}

    def pad_voice(m, det, length):
        key = (m, det, round(length, 3))
        if key not in voice_cache:
            nn = ns(length)
            voice_cache[key] = saw(hz(m) * 2 ** (det / 1200), nn, 2500, phase=RNG.uniform(0, 6)) * adsr(nn, 0.25, 0.4, 0.7, 0.5)
        return voice_cache[key]

    for b in range(nbars + 1):
        ch = CHORDS[b % 4]
        last = b == nbars
        length = (spec_["duration"] - final) if last else bar + 0.5
        for m in ch["pad"]:
            for det, pn in ((-12, -0.8), (12, 0.8)):
                pad.add(b * bar, pad_voice(m, det, length), 0.07, pn)
    pad.x = np.stack([lp(pad.x[c], 1100) for c in range(2)])

    # --- dark pluck hook: two detuned saws through a snapping filter
    pluck_cache = {}

    def pluck(m):
        if m not in pluck_cache:
            nn = ns(0.45)
            t = secs(nn)
            y = saw(hz(m) * 1.004, nn, 6000) + saw(hz(m) * 0.996, nn, 6000)
            y = sweep(y, lambda tt: 600 + 3400 * np.exp(-tt * 14), frame=512, hop=128)
            pluck_cache[m] = y * np.exp(-t * 6) * np.minimum(1, t / 0.002)
        return pluck_cache[m]

    for b in range(nbars):
        t0 = b * bar
        if not (within(t0, groove) or within(t0, builds) or t0 < 3):
            continue
        for s, m in HOOK[b % 4]:
            ts = t0 + s * s16
            gain = 0.22 if within(ts, groove) else 0.12
            keys.add(ts, pluck(m), gain, (-0.25, 0.25)[s % 2])
    # intro: the hook is muffled, opening up through the first build
    keys.x = np.stack([sweep(keys.x[c], lambda tt: 500 if tt < 3 else (500 + 3500 * min(1, (tt - 3) / 3) ** 2 if tt < 6 else 4000), frame=2048, hop=512) for c in range(2)])
    d = int(0.375 * SR)
    echo = np.zeros_like(keys.x)
    echo[0, d:] += keys.x[1, :-d] * 0.3
    echo[1, 2 * d:] += keys.x[0, : -2 * d] * 0.2
    keys.x += echo

    # --- sidechain: pads and keys duck under the 808s
    duck = np.ones(n)
    for k in kicks:
        i = int(k["t"] * SR)
        m = min(n - i, ns(0.4))
        if m > 0:
            duck[i:i + m] = np.minimum(duck[i:i + m], 1 - 0.55 * np.exp(-secs(m) / 0.1))
    pad.x *= duck
    keys.x *= duck

    music = drums.x + bass.x * 0.95 + pad.x + keys.x
    sends = pad.x * 0.4 + keys.x * 0.6 + drums.x * 0.06

    # --- tape stop: the whole track winds down before the last drop
    a, b_ = int(tape[0] * SR), int(tape[1] * SR)
    seg_len = b_ - a
    rate = np.linspace(1, 0.05, seg_len) ** 1.3
    pos = a + np.cumsum(rate)
    for arr in (music, sends):
        for c in range(2):
            arr[c, a:b_] = np.interp(pos, np.arange(arr.shape[1]), arr[c]) * np.linspace(1, 0.3, seg_len)

    # --- the gaps: a beat of silence right before each drop
    gate = np.ones(n)
    for ga, gb in gaps:
        i, j = int(ga * SR), int(gb * SR)
        gate[i:j] = 0
        r = ns(0.006)
        gate[max(0, i - r):i] = np.linspace(1, 0, min(r, i))
    music *= gate
    sends *= gate

    # after the final hit only its 808, the crash and the pad tail ring out
    return music, sends


# ----------------------------------------------------------------- house (club reel)
# I  vi  IV  V-ish in D major, warm and open; one chord per bar
HOUSE_CHORDS = [
    {"root": 38, "ep": [54, 57, 61, 64]},  # Dmaj9  (F# A C# E)
    {"root": 35, "ep": [50, 54, 57, 61]},  # Bm7    (D F# A C#)
    {"root": 31, "ep": [50, 54, 55, 59]},  # Gmaj7  (D F# G B)
    {"root": 33, "ep": [52, 56, 59, 61]},  # A6     (E G# B C#)
]
STAB_STEPS = [0, 3, 6, 10, 13]          # syncopated electric-piano stabs, in sixteenths
ARP = [0, 1, 2, 3, 2, 1, 3, 2]          # chord-tone arpeggio, eighths


def house_kick():
    n = ns(0.32)
    t = secs(n)
    y = glide(120, 50, n, 30) * np.exp(-t * 9)
    y[: ns(0.002)] += hp(noise(ns(0.002)), 4000) * 0.6
    return np.tanh(y * 2.2) * 0.9


def clap():
    n = ns(0.3)
    y = np.zeros(n)
    nz = bp(noise(n), 1000, 6000)
    for off in (0, 0.01, 0.021):
        i = ns(off)
        y[i:] += nz[: n - i] * np.exp(-secs(n - i) * 55)
    return y * 0.6 + nz * np.exp(-secs(n) * 14) * 0.25


def e_piano(m, dur):
    """FM electric piano: warm body, a touch of tine on the attack."""
    n = ns(dur)
    t = secs(n)
    f = hz(m)
    idx = 1.4 * np.exp(-t * 5) + 0.25
    body = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t))
    tine = np.sin(2 * np.pi * f * 7 * t) * np.exp(-t * 40) * 0.08
    return (body + tine) * adsr(n, 0.004, 0.25, 0.45, 0.12)


def compose_house(spec_, n):
    bar = spec_["bar"]
    s16 = bar / 16
    groove, builds, gaps = spec_["groove"], spec_["builds"], spec_["gaps"]
    final = spec_["finalHit"]
    claps_from = spec_.get("claps_from", 0)
    kicks, snares = spec_["kicks"], spec_["snares"]
    nbars = int(np.ceil(final / bar))

    drums, bass, keys, pad = Bus(n), Bus(n), Bus(n), Bus(n)
    K, CL = house_kick(), clap()

    for k in kicks:
        drums.add(k["t"], K, 1.0 if not k.get("last") else 1.1)
    for t in snares:
        drums.add(t, CL, 0.7, 0.05)
    for b in range(nbars):
        t0 = b * bar
        if not within(t0, groove):
            continue
        for s in range(16):
            ts = t0 + s * s16
            if s % 4 == 2:
                drums.add(ts, hat(True, 1.05)[: ns(0.12)] * np.linspace(1, 0, ns(0.12)), 0.45, 0.25)  # offbeat open hat
            elif ts >= claps_from:
                drums.add(ts, hat(), 0.14 + 0.06 * (s % 2 == 0), -0.3)  # shaker-ish sixteenths
    for t in sorted({g_[0] for g_ in groove} | {claps_from, final}):
        if t > 0:
            drums.add(t, crash(), 0.4, -0.2)
    # build: snare roll and riser, then the gap
    for a, b_ in builds:
        dur = b_ - a
        t = a
        while t < b_ - s16 * 0.5:
            k = (t - a) / dur
            drums.add(t, snare() * (0.2 + 0.5 * k), 1.0)
            t += s16 * 2 if k < 0.5 else s16
        rn = ns(dur)
        riser = sweep(noise(rn), lambda tt, d=dur: 300 * (25 ** (tt / d)), kind="bp", width=0.8) * np.linspace(0, 1, rn) ** 2
        drums.add(a, riser, 0.4)

    # bass: offbeat eighths on the root, plus a held sub on the downbeat
    for b in range(nbars):
        ch = HOUSE_CHORDS[b % 4]
        t0 = b * bar
        if not within(t0, groove):
            continue
        for e in range(8):
            if e % 2 == 1:
                nn = ns(0.2)
                f = hz(ch["root"])
                tone = np.sin(2 * np.pi * f * secs(nn)) * 0.8 + lp(saw(f, nn, 1200), 600) * 0.45
                bass.add(t0 + e * bar / 8, tone * adsr(nn, 0.004, 0.06, 0.7, 0.05), 0.7)

    # electric-piano stabs + soft pad; muffled through the intro, open from the first downbeat
    cache = {}

    def ep(m, d):
        key = (m, d)
        if key not in cache:
            cache[key] = e_piano(m, d)
        return cache[key]

    for b in range(nbars + 1):
        ch = HOUSE_CHORDS[b % 4]
        t0 = b * bar
        last = b == nbars
        if last:
            for m in ch["ep"]:
                keys.add(t0, ep(m, 2.4), 0.12)
            continue
        for s in STAB_STEPS:
            for m in ch["ep"]:
                keys.add(t0 + s * s16, ep(m, 0.32), 0.075, (-0.3, 0.3)[m % 2])
        for m in ch["ep"]:
            nn = ns(bar + 0.4)
            pad.add(t0, saw(hz(m), nn, 2000, phase=RNG.uniform(0, 6)) * adsr(nn, 0.3, 0.3, 0.6, 0.4), 0.04, (-0.6, 0.6)[m % 2])
        # high arpeggio once the story starts
        if t0 >= claps_from and within(t0, groove):
            for e, ix in enumerate(ARP):
                m = ch["ep"][ix] + 12
                nn = ns(0.25)
                tt = secs(nn)
                pl = (np.sin(2 * np.pi * hz(m) * tt) + 0.3 * np.sin(4 * np.pi * hz(m) * tt)) * np.exp(-tt * 12)
                keys.add(t0 + e * bar / 8, pl, 0.05, (-0.4, 0.4)[e % 2])
    keys.x = np.stack([sweep(keys.x[c], lambda tt: 700 + 3300 * min(1, tt / 4) ** 2, frame=2048, hop=512) for c in range(2)])
    pad.x = np.stack([lp(pad.x[c], 1500) for c in range(2)])
    d = int(0.375 * SR)
    echo = np.zeros_like(keys.x)
    echo[0, d:] += keys.x[1, :-d] * 0.25
    echo[1, 2 * d:] += keys.x[0, : -2 * d] * 0.15
    keys.x += echo

    # the house pump: everything melodic breathes around the kick
    duck = np.ones(n)
    for k in kicks:
        i = int(k["t"] * SR)
        m = min(n - i, ns(0.3))
        if m > 0:
            duck[i:i + m] = np.minimum(duck[i:i + m], 1 - 0.5 * np.exp(-secs(m) / 0.09))
    for bus in (bass, keys, pad):
        bus.x *= duck

    music = drums.x * 0.9 + bass.x + keys.x + pad.x
    sends = keys.x * 0.5 + pad.x * 0.4 + drums.x * 0.05
    gate = np.ones(n)
    for ga, gb in gaps:
        i, j = int(ga * SR), int(gb * SR)
        gate[i:j] = 0
        r = ns(0.006)
        gate[max(0, i - r):i] = np.linspace(1, 0, min(r, i))
    return music * gate, sends * gate


# ----------------------------------------------------------------- render
def true_peak(x, over=4):
    peak = 0.0
    for c in range(x.shape[0]):
        n = x.shape[1]
        up = np.fft.irfft(np.fft.rfft(x[c]), n * over) * over
        peak = max(peak, float(np.max(np.abs(up))))
    return peak


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    spec_ = json.load(open(sys.argv[1]))
    dur = spec_["duration"]
    n = ns(dur)

    style = spec_.get("style", "trap")
    music, music_send = (compose_house if style == "house" else compose_trap)(spec_, n)

    fx, fx_send = Bus(n), Bus(n)
    level = {"hit": 0.85, "thump": 0.55, "whoosh": 0.35, "swipe": 0.32, "glitch": 0.38, "click": 0.3, "tick": 0.28,
             "type": 0.3, "scan": 0.4, "zip": 0.3, "morph": 0.4, "shutter": 0.45, "shine": 0.3, "ping": 0.4, "rise": 0.35}
    send_amt = {"hit": 0.35, "thump": 0.15, "shutter": 0.1, "shine": 0.4}
    for i, c in enumerate(spec_["cues"]):
        kind = c["type"]
        fn = SFX.get(kind)
        if fn is None:
            print(f"warning: no sound for cue type {kind!r}", file=sys.stderr)
            continue
        params = {k: v for k, v in c.items() if k not in ("t", "type", "gain")}
        buf = fn(**params)
        g = level[kind] * c.get("gain", 1.0)
        pan = ((i * 0.37) % 0.6) - 0.3
        fx.add(c["t"], buf, g, pan)
        fx_send.add(c["t"], buf, g * send_amt.get(kind, 0.08), pan)

    wet = convolve(music_send + fx_send.x, reverb_ir())
    mix = music * 0.8 + fx.x + wet

    # master: clean up the sub-rumble, glue, soft-clip, -1 dBTP ceiling, fade the tail
    mix = np.stack([hp(mix[c], 25, 2) for c in range(2)])
    mix /= np.percentile(np.abs(mix), 99.95) + 1e-9
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    t = secs(n)
    mix *= np.clip((dur - t) / 1.2, 0, 1)
    # normalise on the 4x-oversampled (true) peak so nothing overs between samples
    mix *= 10 ** (-1.0 / 20) / (true_peak(mix) + 1e-9)

    pcm = (mix.T * 32767).astype("<i2")
    with wave.open(sys.argv[2], "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    rms = 20 * np.log10(np.sqrt(np.mean(mix ** 2)) + 1e-12)
    print(f"Wrote {sys.argv[2]}  ({style}, {dur:.1f}s, {len(spec_['cues'])} cues, {len(spec_['kicks'])} kicks, RMS {rms:.1f} dBFS)")


if __name__ == "__main__":
    main()
