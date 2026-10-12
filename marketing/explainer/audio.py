#!/usr/bin/env python3
"""Synthesises the explainer soundtrack: an original music bed plus every sound effect.

Nothing is sampled or licensed. Every sound is built here from oscillators and
noise, so the track is royalty-free and can be posted anywhere.

The timing comes from the animation itself. render.cjs reads
window.FLAGRR.AUDIO out of flagrr-explainer.html (the BPM, where the groove
runs, the scene cuts, and a cue for every hit, pop, coin and whoosh) and
passes it here as JSON. Retiming the animation retimes the sound with it.

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
    """Band-limited sawtooth by additive synthesis."""
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


def fm_bell(f, dur, ratio=3.5, index=2.2, decay=4.0):
    t = secs(ns(dur))
    mod = index * np.exp(-t * decay * 1.5) * np.sin(2 * np.pi * f * ratio * t)
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t * decay)


def pluck_tone(f, dur, bright=1.0, decay=6.0):
    t = secs(ns(dur))
    y = np.zeros_like(t)
    for k in range(1, 9):
        y += np.sin(2 * np.pi * k * f * t) * np.exp(-t * (decay + k * 3 / bright)) / k ** 1.3
    return y * np.minimum(1, t / 0.002)


def glide(f0, f1, n, rate):
    """Sine whose frequency eases exponentially from f0 to f1."""
    t = secs(n)
    f = f1 + (f0 - f1) * np.exp(-t * rate)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


# ----------------------------------------------------------------- mixer
class Bus:
    def __init__(self, n):
        self.x = np.zeros((2, n))

    def add(self, t, mono, gain=1.0, pan=0.0):
        """Equal-power pan; pan in -1..1."""
        i = int(round(t * SR))
        if i >= self.x.shape[1] or len(mono) == 0:
            return
        if i < 0:
            mono, i = mono[-i:], 0
        m = mono[: self.x.shape[1] - i]
        a = (pan + 1) * np.pi / 4
        self.x[0, i:i + len(m)] += m * gain * np.cos(a)
        self.x[1, i:i + len(m)] += m * gain * np.sin(a)

    def add_stereo(self, t, lr, gain=1.0):
        i = int(round(t * SR))
        m = lr[:, : self.x.shape[1] - i]
        self.x[:, i:i + m.shape[1]] += m * gain


def reverb_ir(dur=2.4, decay=2.6, damp=5000):
    n = ns(dur)
    t = secs(n)
    ir = np.stack([noise(n), noise(n)]) * np.exp(-t * decay)
    ir = np.stack([lp(ir[0], damp), lp(ir[1], damp)])
    ir[:, : ns(0.012)] = 0  # pre-delay
    return ir / np.sqrt(np.sum(ir ** 2) / 2) * 0.35


def convolve(x, ir):
    n = x.shape[1] + ir.shape[1]
    size = 1 << n.bit_length()
    return np.stack([np.fft.irfft(np.fft.rfft(x[c], size) * np.fft.rfft(ir[c], size), size)[: x.shape[1]] for c in range(2)])


# ----------------------------------------------------------------- drums
def kick():
    n = ns(0.45)
    t = secs(n)
    body = glide(170, 46, n, 28) * np.exp(-t * 7.5)
    click = lp(noise(ns(0.004)), 4000) * 0.6
    body[: len(click)] += click
    return np.tanh(body * 1.6)


def clap():
    n = ns(0.35)
    y = np.zeros(n)
    nz = bp(noise(n), 900, 4200)
    for off in (0, 0.011, 0.023):
        i = ns(off)
        y[i:] += nz[: n - i] * np.exp(-secs(n - i) * 55)
    y += nz * np.exp(-secs(n) * 11) * 0.35
    return y * 0.9


def hat(open_=False):
    n = ns(0.32 if open_ else 0.06)
    return hp(noise(n), 7000, 3) * np.exp(-secs(n) * (9 if open_ else 70)) * (0.5 if open_ else 0.6)


def crash():
    n = ns(1.8)
    return hp(noise(n), 4500, 2) * np.exp(-secs(n) * 2.6) * 0.45


def reverse_cymbal(dur=0.8):
    c = hp(noise(ns(dur)), 4000) * np.linspace(0, 1, ns(dur)) ** 2.5
    return c * 0.5


def snare():
    n = ns(0.18)
    t = secs(n)
    return bp(noise(n), 1200, 7000) * np.exp(-t * 22) * 0.7 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.4


# ----------------------------------------------------------------- sound effects
def sfx_thud(pitch=0, **_):
    n = ns(0.3)
    t = secs(n)
    y = glide(150 * 2 ** (pitch / 12), 58, n, 30) * np.exp(-t * 14)
    y[: ns(0.004)] += lp(noise(ns(0.004)), 3000) * 0.5
    return np.tanh(y * 1.4)


def sfx_impact(**_):
    n = ns(2.2)
    t = secs(n)
    boom = glide(75, 34, n, 4) * np.exp(-t * 2.2)
    burst = lp(noise(n), 1500) * np.exp(-t * 9) * 0.6
    return np.tanh(boom * 1.8) * 0.9 + burst + np.pad(crash(), (0, n - ns(1.8))) * 0.6


def sfx_punch(pitch=0, **_):
    k = kick()[: ns(0.25)] * 0.8
    tone = pluck_tone(hz(74 + pitch), 0.25, bright=1.5, decay=10) * 0.5
    s = snare()
    y = np.zeros(ns(0.25))
    y += k[: len(y)]
    y[: len(tone)] += tone[: len(y)]
    y[: len(s)] += s[: len(y)] * 0.5
    return y


def sfx_whoosh(pitch=0, dur=0.55, **_):
    n = ns(dur)
    peak = 2200 * 2 ** (pitch / 12)
    y = sweep(noise(n), lambda tt: 250 + (peak - 250) * np.sin(np.pi * min(1, tt / dur) ** 0.8) ** 1.5, kind="bp", width=0.9, frame=1024, hop=256)
    env = np.sin(np.pi * np.clip(secs(n) / dur, 0, 1) ** 0.75) ** 2
    return y * env * 2.2


def sfx_swish(pitch=0, **_):
    return sfx_whoosh(pitch=pitch + 10, dur=0.26) * 0.8


def sfx_pop(pitch=0, **_):
    n = ns(0.16)
    t = secs(n)
    f0 = hz(81 + pitch)
    f = f0 * (1 + 0.6 * (1 - np.exp(-t * 60)))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 28)
    y[: ns(0.003)] += noise(ns(0.003)) * 0.3
    return y * 0.9


def sfx_tick(pitch=0, **_):
    n = ns(0.05)
    t = secs(n)
    y = np.sin(2 * np.pi * 2400 * 2 ** (pitch / 12) * t) * np.exp(-t * 90)
    y[: ns(0.002)] += noise(ns(0.002)) * 0.5
    return y * 0.7


def sfx_snap(**_):
    y = np.zeros(ns(0.08))
    for off in (0, 0.03):
        c = bp(noise(ns(0.012)), 2000, 6000) * np.exp(-secs(ns(0.012)) * 300)
        i = ns(off)
        y[i:i + len(c)] += c
    return y * 1.4


def sfx_scan(dur=2.0, **_):
    n = ns(dur)
    t = secs(n)
    f = 900 + 500 * (t / dur)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.55 + 0.45 * np.sin(2 * np.pi * 14 * t))
    hum = bp(noise(n), 2000, 6000) * 0.25
    env = np.minimum(1, t / 0.1) * np.minimum(1, (dur - t) / 0.3)
    return (tone * 0.18 + hum * 0.4) * env


def sfx_chime(pitch=0, **_):
    notes = [86, 90, 93, 98]  # D6 F#6 A6 D7
    y = np.zeros(ns(1.6))
    for i, m in enumerate(notes):
        b = fm_bell(hz(m + pitch), 1.3, decay=3.5) * (0.9 - i * 0.12)
        s = ns(i * 0.065)
        y[s:s + len(b)] += b[: len(y) - s]
    return y * 0.45


def sfx_coin(pitch=0, **_):
    y = np.zeros(ns(0.45))
    for i, m in enumerate((95, 100)):  # B6 then E7: the classic two-note coin
        n = ns(0.38)
        t = secs(n)
        f = hz(m + pitch)
        tone = (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 3 * f * t)) * np.exp(-t * (14 if i == 0 else 7))
        s = ns(i * 0.07)
        y[s:s + n] += tone[: len(y) - s]
    return y * 0.35


def sparkle_grains(dur=1.2, count=26, seed=3):
    r = np.random.default_rng(seed)
    out = np.zeros((2, ns(dur + 0.1)))
    for _ in range(count):
        f = r.uniform(3000, 8000)
        n = ns(0.06)
        g = np.sin(2 * np.pi * f * secs(n)) * np.exp(-secs(n) * 70) * r.uniform(0.3, 1)
        i = ns(r.uniform(0, dur) ** 1.4 / dur ** 0.4)
        p = r.uniform(-1, 1)
        a = (p + 1) * np.pi / 4
        out[0, i:i + n] += g * np.cos(a)
        out[1, i:i + n] += g * np.sin(a)
    return out * 0.35


def sfx_confetti(**_):
    pop = bp(noise(ns(0.05)), 800, 4000) * np.exp(-secs(ns(0.05)) * 60) * 1.2
    g = sparkle_grains(1.4, 40, seed=11)
    g[:, : len(pop)] += pop
    return g


def sfx_sparkle(**_):
    g = sparkle_grains(1.2, 30, seed=5)
    shimmer = sum(fm_bell(hz(m), 1.2, ratio=2.0, index=1.0, decay=3) for m in (98, 102, 105)) * 0.12
    g[:, : len(shimmer)] += shimmer
    return g


def sfx_rise(pitch=0, **_):
    n = ns(0.35)
    t = secs(n)
    f1 = hz(74 + pitch)
    f = f1 * 2 ** (-7 / 12 * np.exp(-t * 25))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
    return y * 0.5 + pluck_tone(f1, 0.35) * 0.25


def sfx_pluck(note=0, **_):
    return pluck_tone(hz(74 + note), 0.7, bright=1.2, decay=4.5) * 0.55


def sfx_tap(**_):
    n = ns(0.04)
    t = secs(n)
    return (np.sin(2 * np.pi * 1300 * t) * np.exp(-t * 120) + noise(n) * np.exp(-t * 400) * 0.4) * 0.8


def sfx_stamp(**_):
    n = ns(0.3)
    t = secs(n)
    y = glide(110, 55, n, 25) * np.exp(-t * 16) * 0.8
    y += bp(noise(n), 500, 2500) * np.exp(-t * 40) * 0.6
    return y


def sfx_shine(**_):
    n = ns(0.9)
    t = secs(n)
    y = np.zeros(n)
    for i, m in enumerate((93, 98, 102, 105, 110)):
        f = hz(m) * (1 + 0.004 * np.sin(2 * np.pi * 6 * t))
        env = np.clip((t - i * 0.05) / 0.05, 0, 1) * np.exp(-np.maximum(0, t - i * 0.05) * 5)
        y += np.sin(2 * np.pi * np.cumsum(f) / SR) * env
    return y * 0.13 + sweep(noise(n), lambda tt: 3000 + 6000 * tt / 0.9, kind="bp", width=0.5, frame=1024, hop=256) * np.exp(-t * 4) * 0.3


def sfx_roll(dur=0.5, **_):
    n = ns(dur)
    t = secs(n)
    rumble = lp(noise(n), 220) * (0.6 + 0.4 * np.sin(2 * np.pi * 13 * t)) * np.minimum(1, (dur - t) / 0.15)
    return rumble * 1.6


SFX = {name[4:]: fn for name, fn in globals().items() if name.startswith("sfx_")}


# ----------------------------------------------------------------- the music
# I  V  vi  IV in D major, one chord per bar
PROG = [
    {"root": 38, "pad": [50, 57, 62, 66], "arp": [74, 78, 81, 86]},  # D
    {"root": 33, "pad": [52, 57, 61, 64], "arp": [73, 76, 81, 85]},  # A
    {"root": 35, "pad": [54, 59, 62, 66], "arp": [71, 74, 78, 83]},  # Bm
    {"root": 31, "pad": [50, 55, 59, 62], "arp": [71, 74, 79, 83]},  # G
]
# lead hook: eighth notes per chord, None = rest
LEAD_HOOK = [
    [78, None, 76, 78, None, 81, None, 78],
    [76, None, 73, 76, None, 78, 76, None],
    [74, None, 73, 74, None, 78, None, 76],
    [74, None, None, 71, None, 74, 76, None],
]
ARP_PATTERN = [0, 1, 2, 3, 2, 1, 2, 3]


def within(t, ranges):
    return any(a <= t < b for a, b in ranges)


def compose(spec_, n):
    bpm = spec_["bpm"]
    beat = 60 / bpm
    bar = beat * 4
    groove = spec_["groove"]
    brk = spec_["breakdown"]
    end = spec_["musicEnd"]
    lead_secs = spec_["lead"]
    cuts = spec_["cuts"]
    plucks = [c["t"] for c in spec_["cues"] if c["type"] == "pluck"]
    arp_mute = [(min(plucks) - 0.2, max(plucks) + 0.5)] if plucks else []

    drums, bass, pad, arp, lead = Bus(n), Bus(n), Bus(n), Bus(n), Bus(n)
    K, CL, HC, HO, CR, SN = kick(), clap(), hat(), hat(True), crash(), snare()

    # --- drums
    kicks = []
    nbeats = int(end / beat)
    for b in range(nbeats):
        t = b * beat
        if within(t, groove):
            drums.add(t, K, 0.95)
            kicks.append(t)
            if b % 2 == 1:
                drums.add(t, CL, 0.55, 0.05)
        for s in range(4):  # sixteenths
            ts = t + s * beat / 4
            if within(ts, groove):
                if s == 2:
                    drums.add(ts, HC, 0.42, 0.25)
                elif ts >= 12:
                    drums.add(ts, HC, 0.13 + 0.05 * (s == 0), -0.3)
        if within(t, groove) and t >= 30 and b % 4 == 3:
            drums.add(t + beat / 2, HO, 0.32, 0.3)
    # crashes on the cuts that land on the groove, reverse cymbals into the big ones
    for c in cuts:
        if 0 < c < end and (within(c, groove) or c == brk[1]):
            drums.add(c, CR, 0.55, -0.2)
    for c in (cuts[1], 30, brk[1]):
        drums.add(c - 0.8, reverse_cymbal(0.8), 0.7, 0.2)
    # little snare fills into each groove cut
    for c in cuts:
        if within(c - 0.01, groove):
            for i, off in enumerate((-0.375, -0.25, -0.125)):
                drums.add(c + off, SN, 0.25 + i * 0.1, 0.1)
    # riser + accelerating snare roll out of the breakdown
    rs, re_ = brk[1] - 4, brk[1]
    rn = ns(re_ - rs)
    riser = sweep(noise(rn), lambda tt: 300 * (20 ** (tt / (re_ - rs))), kind="bp", width=0.8)
    riser *= np.linspace(0, 1, rn) ** 2
    drums.add(rs, riser, 0.55)
    t = brk[1] - 2
    while t < brk[1] - 0.05:
        k = (t - (brk[1] - 2)) / 2
        drums.add(t, SN, 0.15 + 0.45 * k, 0.1)
        t += beat / 4 if k < 0.5 else beat / 8

    # --- bass: offbeat eighths, house bounce, root of the bar's chord
    note_cache = {}

    def bass_note(m):
        if m not in note_cache:
            nn = ns(0.22)
            f = hz(m)
            tone = np.sin(2 * np.pi * f * secs(nn)) * 0.8 + lp(saw(f, nn, 1500), 700) * 0.5
            note_cache[m] = tone * adsr(nn, 0.004, 0.08, 0.6, 0.05)
        return note_cache[m]

    for b in range(int(end / bar)):
        ch = PROG[b % 4]
        for e in range(8):
            t = b * bar + e * beat / 2
            if within(t, groove) and e % 2 == 1:
                bass.add(t, bass_note(ch["root"] + (12 if e == 7 and b % 2 else 0)), 0.75)

    # --- pads: detuned saw stacks, swelling; filter opens through the intro, closes in the breakdown
    voice_cache = {}

    def pad_voice(m, det, length):
        key = (m, det, round(length, 3))
        if key not in voice_cache:
            nn = ns(length)
            voice_cache[key] = saw(hz(m) * 2 ** (det / 1200), nn, 3500, phase=RNG.uniform(0, 6)) * adsr(nn, 0.35, 0.3, 0.8, 0.6)
        return voice_cache[key]

    nbars = int(end / bar)
    for b in range(nbars + 1):
        ch = PROG[b % 4]
        last = b == nbars
        length = 4.5 if last else bar + 0.6
        for m in ch["pad"]:
            for det, pan in ((-9, -0.7), (0, 0), (9, 0.7)):
                pad.add(b * bar, pad_voice(m, det, length), 0.085 * (1.4 if last else 1), pan)
    def pad_cut(tt):
        if tt < cuts[1]:
            return 250 + 2000 * (tt / cuts[1]) ** 2
        if brk[0] <= tt < brk[1]:
            k = (tt - brk[0]) / (brk[1] - brk[0])
            return 450 + 3500 * k ** 3
        return 2400
    pad.x = np.stack([sweep(pad.x[c], pad_cut, frame=4096, hop=1024) for c in range(2)])

    # --- arpeggio: plucked chord tones in eighths with ping-pong delay
    for b in range(nbars):
        ch = PROG[b % 4]
        for e in range(8):
            t = b * bar + e * beat / 2
            if t < 2.0 or within(t, arp_mute):
                continue
            m = ch["arp"][ARP_PATTERN[e]]
            vel = 0.55 if e % 2 == 0 else 0.4
            arp.add(t, pluck_tone(hz(m), 0.4, bright=0.8, decay=7), 0.16 * vel, (-0.35, 0.35)[e % 2])
    arp.x = np.stack([sweep(arp.x[c], lambda tt: 900 + 4000 * min(1, max(0, tt - 2) / 6) if tt < brk[0] or tt >= brk[1] else 800 + 3000 * ((tt - brk[0]) / 6) ** 2, frame=4096, hop=1024) for c in range(2)])
    d = int(0.375 * SR)
    echo = np.zeros_like(arp.x)
    echo[0, d:] += arp.x[1, :-d] * 0.35
    echo[1, 2 * d:] += arp.x[0, : -2 * d] * 0.25
    arp.x += echo

    # --- lead hook: soft square with vibrato, doubled an octave down
    def lead_note(m, length=0.24):
        nn = ns(length)
        t = secs(nn)
        f = hz(m) * (1 + 0.006 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.12))
        ph = 2 * np.pi * np.cumsum(f) / SR
        y = sum(np.sin(k * ph) / k for k in (1, 3, 5, 7)) * 0.8
        y += np.sin(ph / 2) * 0.3
        return lp(y, 3500) * adsr(nn, 0.008, 0.1, 0.65, 0.07)

    for b in range(nbars):
        for e, m in enumerate(LEAD_HOOK[b % 4]):
            t = b * bar + e * beat / 2
            if m is not None and within(t, lead_secs):
                lead.add(t, lead_note(m), 0.12, 0.1)
    de = int(0.5 * SR)
    lead.x[:, de:] += lead.x[:, :-de] * 0.28

    # --- sidechain: pads, bass and arp duck under every kick
    tt = secs(n)
    duck = np.ones(n)
    for k in kicks:
        i = int(k * SR)
        m = min(n - i, ns(0.32))
        duck[i:i + m] = np.minimum(duck[i:i + m], 1 - 0.65 * np.exp(-secs(m) / 0.08))
    for bus in (pad, bass, arp):
        bus.x *= duck

    # a sub swell under the intro, and the final chord's root under the end card
    sub = Bus(n)
    sn = ns(cuts[1])
    sub.add(0, np.sin(2 * np.pi * hz(38) * secs(sn)) * np.linspace(0, 1, sn) ** 2 * np.minimum(1, (cuts[1] - secs(sn)) / 0.3), 0.25)
    fn = ns(4.5)
    sub.add(end, np.sin(2 * np.pi * hz(38) * secs(fn)) * np.exp(-secs(fn) * 0.9), 0.3)

    music = drums.x * 0.8 + bass.x * 0.7 + pad.x + arp.x + lead.x + sub.x
    sends = pad.x * 0.5 + arp.x * 0.6 + lead.x * 0.5 + drums.x * 0.08
    return music, sends


# ----------------------------------------------------------------- render
def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    spec_ = json.load(open(sys.argv[1]))
    dur = spec_["duration"]
    n = ns(dur)

    music, music_send = compose(spec_, n)

    fx = Bus(n)
    fx_send = Bus(n)
    send_amt = {"impact": 0.5, "chime": 0.5, "coin": 0.3, "pluck": 0.45, "sparkle": 0.6, "shine": 0.5, "punch": 0.25, "pop": 0.2}
    level = {"thud": 0.8, "impact": 0.9, "punch": 0.7, "whoosh": 0.42, "swish": 0.35, "pop": 0.45, "tick": 0.3, "snap": 0.45,
             "scan": 0.6, "chime": 0.55, "coin": 0.55, "confetti": 0.7, "sparkle": 0.6, "rise": 0.5, "pluck": 0.7,
             "tap": 0.5, "stamp": 0.7, "shine": 0.55, "roll": 0.45}
    for i, c in enumerate(spec_["cues"]):
        kind = c["type"]
        fn = SFX.get(kind)
        if fn is None:
            print(f"warning: no sound for cue type {kind!r}", file=sys.stderr)
            continue
        params = {k: v for k, v in c.items() if k not in ("t", "type", "gain")}
        buf = fn(**params)
        g = level[kind] * c.get("gain", 1.0)
        pan = ((i * 0.37) % 0.6) - 0.3  # gentle spread so stacked effects don't pile up dead centre
        if buf.ndim == 2:
            fx.add_stereo(c["t"], buf, g)
            fx_send.add_stereo(c["t"], buf, g * send_amt.get(kind, 0.15))
        else:
            fx.add(c["t"], buf, g, pan)
            fx_send.add(c["t"], buf, g * send_amt.get(kind, 0.15), pan)

    wet = convolve(music_send * 0.6 + fx_send.x, reverb_ir())
    mix = music * 0.62 + fx.x + wet

    # master: high-pass the rumble, gentle glue, soft-clip, -1 dBFS ceiling, fade the tail
    mix = np.stack([hp(mix[c], 28, 2) for c in range(2)])
    mix /= np.percentile(np.abs(mix), 99.97) + 1e-9
    mix = np.tanh(mix * 1.25) / np.tanh(1.25)
    t = secs(n)
    mix *= np.clip((dur - t) / 1.6, 0, 1)
    mix *= 10 ** (-1 / 20) / (np.max(np.abs(mix)) + 1e-9)

    pcm = (mix.T * 32767).astype("<i2")
    with wave.open(sys.argv[2], "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    rms = 20 * np.log10(np.sqrt(np.mean(mix ** 2)) + 1e-12)
    print(f"Wrote {sys.argv[2]}  ({dur:.1f}s, {len(spec_['cues'])} cues, RMS {rms:.1f} dBFS)")


if __name__ == "__main__":
    main()
