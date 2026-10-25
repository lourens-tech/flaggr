"""Synthesises the soundtrack for video.html: a modern, drop-driven house track
at the film's tempo (warm pad, syncopated chord stabs, glassy FM-bell motif,
swung hats, offbeat bass, risers, impacts) with sound effects locked to the
picture.

Slam hits, colour-card hits and wipe whooshes are read straight from the
SLAMS / CARDS / WIPES lists in video.html, so picture and sound can't drift.
The section map below mirrors the film's structure (see SCRIPT.md).

Writes out/soundtrack.wav plus music-only and sfx-only stems, so a licensed
track can replace the music while keeping the SFX.

    python3 marketing/club-explainer-video/make-audio.py
"""
import re
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sawtooth, sosfilt, sosfilt_zi

HERE = Path(__file__).parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)
SR = 48000
HTML = (HERE / "video.html").read_text()
DUR = float(re.search(r"const DURATION = ([\d.]+)", HTML).group(1))
# Every time in this file is in the film's timeline units (the 0.5s grid the
# cues in video.html are written on); TEMPO converts them to seconds.
TEMPO = float(re.search(r"const TEMPO = ([\d.]+)", HTML).group(1))
END = DUR / TEMPO
N = int(SR * DUR)
TT = np.arange(N) / SR
TL = TT / TEMPO  # timeline time of every sample
rng = np.random.default_rng(11)

BEAT = 0.5  # one beat in timeline units (100bpm at TEMPO 1.2)
BAR = 2.0

# ------------------------------------------------------------------ cues from the picture
def cues(list_name):
    block = re.search(rf"const {list_name} = \[(.*?)\n\];", HTML, re.S).group(1)
    return [dict(t=float(m.group(1)), hit="hit: true" in line)
            for line in block.splitlines() if (m := re.search(r"\{ t: ([\d.]+)", line))]


SLAM_CUES = cues("SLAMS")
CARD_CUES = cues("CARDS")
WIPE_CUES = [float(x) for x in re.findall(r"\{ t: ([\d.]+), color", HTML)]

# ------------------------------------------------------------------ section map
# Where each musical layer plays. (start, end) in seconds.
DROPS = [(8, 40), (52, 58), (66, 74)]
BUILD_A = (2, 8)          # intro build into the first drop
BREAK = (40, 44)          # "you're not alone": drums out
BUILD_B = (44, 52)        # promos -> "why?" -> second drop
SOFT = (58, 66)           # partnership: groove without lead
GAPS = [(7.75, 8.0), (51.75, 52.0)]  # silence before each drop
FINAL_HIT = 74.0


def within(t, spans):
    return any(a <= t < b for a, b in spans)


def mask(spans):
    m = np.zeros(N)
    for a, b in spans:
        m[at(a):at(b)] = 1
    return m


def smooth(x, ms=8):
    k = int(SR * ms / 1000)
    return np.convolve(x, np.ones(k) / k, mode="same")


# ------------------------------------------------------------------ dsp helpers
def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def at(t):
    """Sample index of timeline time t."""
    return int(round(t * TEMPO * SR))


def add(buf, sig, t, gain=1.0):
    i = at(t)
    if i < 0:
        sig, i = sig[-i:], 0
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def filt(x, kind, hz, order=2):
    return sosfilt(butter(order, hz, kind, fs=SR, output="sos"), x)


def sweep_lp(x, cutoff):
    """Lowpass whose cutoff follows the per-sample array `cutoff` (50ms blocks)."""
    out = np.zeros_like(x)
    blk = int(SR * 0.05)
    zi = None
    for i in range(0, len(x), blk):
        sos = butter(2, float(np.clip(cutoff[i], 60, SR / 2 - 500)), "low", fs=SR, output="sos")
        if zi is None:
            zi = sosfilt_zi(sos) * 0
        out[i:i + blk], zi = sosfilt(sos, x[i:i + blk], zi=zi)
    return out


def env(n, a, d):
    tt = np.arange(n) / SR
    return np.minimum(1, tt / max(a, 1e-4)) * np.exp(-tt / d)


IR_T = np.arange(int(SR * 2.2)) / SR
IR = filt(rng.standard_normal(len(IR_T)), "low", 6000) * np.exp(-IR_T / 0.55)
IR /= np.sqrt(np.sum(IR ** 2))


def reverb(x):
    return fftconvolve(x, IR)[:len(x)]


# ------------------------------------------------------------------ instruments
PROG = [  # Am – F – C – G, one bar each
    (45, [57, 60, 64, 69]),
    (41, [53, 57, 60, 65]),
    (48, [55, 60, 64, 67]),
    (43, [55, 59, 62, 67]),
]


def chord_at(t):
    return PROG[int(t // BAR) % 4]


def kick():
    n = int(0.42 * SR)
    tt = np.arange(n) / SR
    f = 46 + 130 * np.exp(-tt * 32)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7.5)
    click = filt(rng.standard_normal(n), "high", 3000) * np.exp(-tt * 400) * 0.35
    return np.tanh((body + click) * 1.8)


def clap():
    n = int(0.35 * SR)
    noise = filt(rng.standard_normal(n), "band", [900, 5200])
    tt = np.arange(n) / SR
    e = np.zeros(n)
    for o in (0, 0.009, 0.018):
        i = int(o * SR)
        e[i:] = np.maximum(e[i:], np.exp(-(tt[: n - i]) * 70))
    e += np.exp(-tt * 14) * 0.35 * (tt > 0.02)
    return noise * e


def hat(open_=False):
    n = int((0.16 if open_ else 0.045) * SR)
    tt = np.arange(n) / SR
    return filt(rng.standard_normal(n), "high", 7500) * np.exp(-tt * (22 if open_ else 110))


def bass_note(f, dur):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    s = sawtooth(2 * np.pi * f * tt) * 0.6 + np.sin(2 * np.pi * f * tt)
    return filt(s, "low", 700) * env(n, 0.004, 0.16)


def sub_note(f, dur):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    return np.sin(2 * np.pi * f * tt) * np.minimum(1, tt / 0.01) * np.minimum(1, (dur - tt) / 0.02)


def warm_pad(notes, dur):
    """Soft rounded pad: two slightly detuned near-triangle voices per note."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    out = np.zeros(n)
    for note in notes:
        for det in (-0.06, 0.06):
            f = midi(note + det)
            for h, a in ((1, 1.0), (3, 0.11), (5, 0.04)):
                out += a * np.sin(2 * np.pi * f * h * tt + rng.uniform(0, 6.28))
    return out / (len(notes) * 2)


def stab(notes):
    """Short, bright house chord stab."""
    n = int(0.32 * SR)
    tt = np.arange(n) / SR
    out = np.zeros(n)
    for note in notes + [notes[-1] + 12]:
        for det in (-0.05, 0.05):
            f = midi(note + det)
            out += sawtooth(2 * np.pi * f * tt) * 0.6 + np.sign(np.sin(2 * np.pi * f * tt)) * 0.25
    return filt(out / len(notes), "low", 3200) * env(n, 0.003, 0.11)


def fm_bell(f, dur=0.7):
    """Glassy FM pluck: the modulation index decays faster than the note."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    index = 2.4 * np.exp(-tt * 14)
    return np.sin(2 * np.pi * f * tt + index * np.sin(2 * np.pi * 2 * f * tt)) * env(n, 0.002, 0.2)


def pluck(f, dur=0.22):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    s = np.sign(np.sin(2 * np.pi * f * tt)) * 0.5 + np.sin(2 * np.pi * f * tt)
    return filt(s, "low", 6500) * env(n, 0.002, 0.08)


def bell(f, dur=1.6):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * f * 2.01 * tt) + 0.15 * np.sin(2 * np.pi * f * 3.98 * tt)) * env(n, 0.003, 0.5)


def riser(dur):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    k = tt / dur
    noise = sweep_lp(rng.standard_normal(n), 300 * (40 ** k)) * k ** 2
    tone = np.sin(2 * np.pi * np.cumsum(220 * 4 ** k) / SR) * k ** 3 * 0.25
    return noise + tone


def impact(big=True):
    n = int((2.4 if big else 0.7) * SR)
    tt = np.arange(n) / SR
    f = 30 + 60 * np.exp(-tt * 6)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * (1.6 if big else 6))
    crash = filt(rng.standard_normal(n), "low", 9000 if big else 4000) * np.exp(-tt * (2.2 if big else 14))
    return np.tanh(boom * 1.6) + crash * (0.5 if big else 0.35)


def hit():
    """Short punchy accent under every text slam."""
    n = int(0.5 * SR)
    tt = np.arange(n) / SR
    f = 55 + 120 * np.exp(-tt * 30)
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)
    snap = filt(rng.standard_normal(n), "band", [1200, 7000]) * np.exp(-tt * 45) * 0.6
    return np.tanh((thump + snap) * 1.4)


def whoosh(dur=0.55):
    n = int(dur * SR)
    k = np.linspace(0, 1, n)
    x = sweep_lp(rng.standard_normal(n), 400 * (25 ** k))
    return x * np.where(k < 0.65, (k / 0.65) ** 2, ((1 - k) / 0.35) ** 1.5)


def reverse_cymbal(dur):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    return filt(rng.standard_normal(n), "high", 4000) * np.exp(-(dur - tt) * 3.5)


def tone(f, dur, decay):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    return np.sin(2 * np.pi * f * tt) * env(n, 0.002, 1 / decay)


def key_click():
    n = int(0.025 * SR)
    tt = np.arange(n) / SR
    return filt(rng.standard_normal(n), "high", 2500) * np.exp(-tt * 300)


# ------------------------------------------------------------------ music
SWING = 0.03  # timeline units
kick_t, clap_t, hat_t, ohat_t = [], [], [], []
for i in range(int(END / BEAT)):
    b = i * BEAT
    on_beat_2_4 = i % 2 == 1
    drop = within(b, DROPS)
    if drop or within(b, [(2, 7.0), (44, 51.0), SOFT]):
        kick_t.append(b)
    if drop or within(b, [(46, 50), SOFT]):
        if on_beat_2_4:
            clap_t.append(b)
    if drop:
        # Swung 16ths: the 2nd and 4th sixteenth of each beat land late.
        hat_t += [(b, 0.16), (b + 0.125 + SWING, 0.07), (b + 0.25, 0.12), (b + 0.375 + SWING, 0.07)]
        ohat_t.append(b + 0.25)
    elif within(b, [(4, 7.5), (48, 51.5), SOFT]):
        hat_t += [(b, 0.12), (b + 0.25, 0.1)]

drums = np.zeros(N)
for b in kick_t:
    add(drums, kick(), b, 1.0)
claps = np.zeros(N)
for b in clap_t:
    add(claps, clap(), b, 0.55)
hats = np.zeros(N)
for b, g in hat_t:
    add(hats, hat(), b, g)
for b in ohat_t:
    add(hats, hat(True), b, 0.09)

# Snare rolls into each drop: 8ths -> 16ths -> 32nds, rising.
for start, end in ((6.0, 7.75), (50.0, 51.75), (64.0, 65.75)):
    t = start
    while t < end:
        k = (t - start) / (end - start)
        step = 0.25 if k < 0.4 else 0.125 if k < 0.75 else 0.0625
        add(claps, clap(), t, 0.15 + 0.45 * k)
        t += step

# Sidechain pump from the kicks.
pump = np.ones(N)
for b in kick_t:
    i = at(b)
    n = min(int(0.45 * SR), N - i)
    pump[i:i + n] = np.minimum(pump[i:i + n], 1 - 0.8 * np.exp(-np.arange(n) / SR * 9))

pad = np.zeros(N)
for bar in range(int(END // BAR) + 1):
    t0 = bar * BAR
    _, notes = chord_at(t0 + 0.01)
    seg = warm_pad(notes, BAR * TEMPO + 0.4)
    seg *= np.minimum(1, np.arange(len(seg)) / (SR * 0.25)) * np.minimum(1, (len(seg) - np.arange(len(seg))) / (SR * 0.4))
    add(pad, seg, t0 - 0.1)

# Syncopated house stabs (16th steps 2, 6, 10, 13 of each bar).
stabs = np.zeros(N)
for bar in range(int(END // BAR) + 1):
    for step in (2, 6, 10, 13):
        t = bar * BAR + step * 0.125
        if within(t, DROPS + [SOFT, (48, 51.75)]) and not within(t, [(23.75, 25.9)]):
            _, notes = chord_at(t)
            add(stabs, stab(notes), t, 1.0 if step != 13 else 0.7)
chords = pad * 0.7 + stabs * 1.15
cut = np.full(N, 8000.0)
ka = np.clip((TL - BUILD_A[0]) / (8 - BUILD_A[0]), 0, 1)
cut = np.where(TL < 8, 250 + 4500 * ka ** 2, cut)
cut = np.where((TL >= BREAK[0]) & (TL < BREAK[1]), 900, cut)
kb = np.clip((TL - BUILD_B[0]) / (52 - BUILD_B[0]), 0, 1)
cut = np.where((TL >= BUILD_B[0]) & (TL < BUILD_B[1]), 700 + 4500 * kb ** 1.5, cut)
cut = np.where((TL >= SOFT[0]) & (TL < SOFT[1]), 2600, cut)
chords = sweep_lp(chords, cut)
chord_gain = np.interp(TL, [0, 2, 8, 40, 40.01, 44, 52, 58, 66, 74, 76], [0, .55, 1, 1, .8, .9, 1, .85, 1, 1, 1])
chords *= chord_gain * pump

bass = np.zeros(N)
for i in range(int(END / BEAT)):
    b = i * BEAT + 0.25  # offbeat
    if within(b, DROPS + [SOFT, (46, 51.5)]):
        root, _ = chord_at(b)
        add(bass, bass_note(midi(root - 12), 0.22), b, 1.0)
sub = np.zeros(N)
for bar in range(int(END // BAR) + 1):
    t0 = bar * BAR
    if within(t0, DROPS + [SOFT, BUILD_B, BREAK, (2, 8)]):
        root, _ = chord_at(t0 + 0.01)
        add(sub, sub_note(midi(root - 12), BAR), t0, 1.0)
sub *= pump

# Lead hook: a sparse two-bar FM-bell motif in 8ths, in the drops only.
lead = np.zeros(N)
MOTIF = [3, None, 2, 3, None, 1, 2, None, 3, None, 2, 1, None, 0, 1, None]
for i in range(int(END / 0.25)):
    t = i * 0.25
    idx = MOTIF[i % 16]
    if idx is None:
        continue
    if within(t, [(8, 40), (52, 58), (66, 74)]) and not within(t, [(15, 17.5), (23.75, 25.9)]):
        _, notes = chord_at(t)
        add(lead, fm_bell(midi(notes[idx] + 12)), t, 0.9 if i % 4 == 0 else 0.65)
lead_delay = np.zeros(N)
d = int(SR * 0.375 * TEMPO)  # dotted-8th delay
lead_delay[d:] = lead[:-d] * 0.35

# Breakdown bells.
bells = np.zeros(N)
for i, t in enumerate(np.arange(BREAK[0], BREAK[1], 0.5)):
    _, notes = chord_at(t)
    add(bells, bell(midi(notes[[3, 2, 1, 2, 3, 1, 2, 0][i % 8]] + 12)), t, 0.5)

fx = np.zeros(N)
add(fx, riser(2.0 * TEMPO), 6.0, 0.5)
add(fx, riser(4.0 * TEMPO), 47.75, 0.45)
add(fx, riser(1.75 * TEMPO), 64.0, 0.4)
add(fx, riser(1.0 * TEMPO), 29.0, 0.35)
for t_drop in (8.0, 52.0, 66.0):
    add(fx, reverse_cymbal(1.5 * TEMPO), t_drop - 1.5, 0.35)
    add(fx, impact(True), t_drop, 0.9)
for t_hit in (18.0, 30.0, 44.0):
    add(fx, impact(True), t_hit, 0.55)
add(fx, reverse_cymbal(1.0 * TEMPO), 43.0, 0.3)

# Final chord hit and ring-out.
add(fx, impact(True), FINAL_HIT, 1.0)
final_chord = warm_pad([45, 57, 60, 64, 69, 72], DUR - FINAL_HIT * TEMPO)
final_chord *= np.exp(-np.arange(len(final_chord)) / SR * 0.9)
add(chords, final_chord * 0.9, FINAL_HIT)
add(chords, stab([57, 60, 64, 69]), FINAL_HIT, 0.9)

# Centre: drums, bass, fx. Wide: chords, hats, lead, bells, reverb — the right
# channel gets them 11ms late (Haas) so the track opens up in stereo.
center = drums * 0.7 + claps * 1.25 + bass * 0.34 + sub * 0.09 + fx * 0.55
wide = (hats * 1.9 + chords * 0.6 + lead * 0.26 + lead_delay * 0.22 + bells * 0.3
        + reverb(claps * 0.5 + lead * 0.25 + bells * 0.6 + chords * 0.05 + fx * 0.2) * 0.35)
haas = int(SR * 0.011)
wide_r = np.concatenate([np.zeros(haas), wide[:-haas]])
music = np.stack([center + wide, center + wide_r], axis=1)

# Hard gaps before the drops, and the final fade.
gate = 1 - smooth(mask(GAPS), 3)
music *= gate[:, None]
music[: at(0.3)] *= np.linspace(0, 1, at(0.3))[:, None]
music[-at(1.2):] *= np.linspace(1, 0, at(1.2))[:, None]

# ------------------------------------------------------------------ picture-locked sfx
sfx = np.zeros(N)
for c in SLAM_CUES:
    add(sfx, hit(), c["t"], 0.6 if c["hit"] else 0.3)
for c in CARD_CUES:
    add(sfx, hit(), c["t"], 0.75)
for w in WIPE_CUES:
    add(sfx, whoosh(), w - 0.36, 0.5)

# Typing, Send, notification chime.
for a, b in ((10.35, 10.9), (10.95, 11.65)):
    for tk in np.arange(a, b, 0.04):
        add(sfx, key_click(), tk + rng.uniform(-0.008, 0.008), rng.uniform(0.12, 0.22))
add(sfx, hit(), 12.0, 0.5)
add(sfx, tone(midi(88), 0.9, 6), 12.25, 0.35)
add(sfx, tone(midi(93), 1.2, 5), 12.37, 0.35)
# Tee slots filling, rising.
for k in range(6):
    add(sfx, tone(midi(76 + [0, 2, 4, 7, 9, 12][k]), 0.25, 18), 13.15 + k * 0.2, 0.3)
# Scan beeps and the Flagrr Cash "ka-ching".
add(sfx, tone(1320, 0.1, 40), 18.9, 0.25)
add(sfx, tone(1760, 0.1, 40), 19.45, 0.25)
add(sfx, tone(midi(91), 0.6, 8), 20.0, 0.3)
add(sfx, tone(midi(96), 0.8, 7), 20.08, 0.3)
# Screen swaps on the dashboard.
for t in (32.0, 34.0, 35.0, 36.0, 37.0):
    add(sfx, whoosh(0.35), t - 0.22, 0.3)

# ------------------------------------------------------------------ mix
def peak_norm(x, db=-1.0):
    return x / np.max(np.abs(x)) * 10 ** (db / 20)


def master(x):
    x = np.stack([filt(x[:, c], "high", 28) for c in range(2)], axis=1)
    x = x + 0.45 * np.stack([filt(x[:, c], "high", 2500) for c in range(2)], axis=1)  # presence/air tilt
    x = np.tanh(peak_norm(x, 0) * 1.6)  # glue + loudness
    return peak_norm(x, -1.0)


sfx2 = np.stack([sfx, sfx], axis=1)
mix = master(music + sfx2 * 0.8)
for name, sig in (("soundtrack.wav", mix), ("music-only.wav", master(music)), ("sfx-only.wav", peak_norm(sfx2, -1))):
    wavfile.write(OUT / name, SR, (sig * 32767).astype(np.int16))
    print("wrote", OUT / name)
