"""Synthesises the soundtrack for video.html: a modern house track at the film's
tempo, built like a real arrangement rather than a loop — a sung vocal-chop
hook, two chord progressions, a moving bassline, fills at every phrase end, a
bell counter-melody, a half-time build with a vocal stutter, and a key change
into the final drop — with sound effects locked to the picture.

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


# ------------------------------------------------------------------ harmony
# Am – F – C – G for the first drop, F – C – G – Am for its second half (same
# hook, new harmony underneath), and the final drop lifts a whole tone.
P1 = [(45, [57, 60, 64, 69]), (41, [53, 57, 60, 65]), (48, [55, 60, 64, 67]), (43, [55, 59, 62, 67])]
P2 = [(41, [53, 57, 60, 65]), (48, [55, 60, 64, 67]), (43, [55, 59, 62, 67]), (45, [57, 60, 64, 69])]
SECOND_HALF = (24, 40)
KEY_CHANGE = 66.0


def key_at(t):
    return 2 if t >= KEY_CHANGE else 0


def chord_at(t):
    prog = P2 if within(t, [SECOND_HALF]) else P1
    root, notes = prog[int(t // BAR) % 4]
    k = key_at(t)
    return root + k, [n + k for n in notes]


# ------------------------------------------------------------------ instruments
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


def shaker():
    n = int(0.06 * SR)
    tt = np.arange(n) / SR
    return filt(rng.standard_normal(n), "band", [5000, 11000]) * np.minimum(1, tt / 0.012) * np.exp(-tt * 60)


def rim():
    n = int(0.06 * SR)
    tt = np.arange(n) / SR
    return (filt(rng.standard_normal(n), "band", [1500, 3500]) * 0.6 + np.sin(2 * np.pi * 1750 * tt)) * np.exp(-tt * 90)


def tom(f):
    n = int(0.35 * SR)
    tt = np.arange(n) / SR
    sweep = f * (1 + 0.6 * np.exp(-tt * 25))
    return np.sin(2 * np.pi * np.cumsum(sweep) / SR) * np.exp(-tt * 9) + filt(rng.standard_normal(n), "low", 3000) * np.exp(-tt * 40) * 0.2


def bass_note(f, dur):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    s = sawtooth(2 * np.pi * f * tt) * 0.6 + np.sin(2 * np.pi * f * tt)
    return filt(s, "low", 750) * np.minimum(1, tt / 0.004) * np.exp(-tt / max(dur, 0.12))


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


FORMANTS = {"a": (800, 1150, 2900), "o": (450, 800, 2830), "e": (500, 1750, 2600)}


def vox(f0, f1, dur, vowel):
    """Vocal-chop synth: a gliding saw shaped by three vowel formants."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    glide = np.minimum(1, tt / 0.045)
    f = f0 * (f1 / f0) ** glide
    f = f * 2 ** (0.18 / 12 * np.sin(2 * np.pi * 5.5 * tt) * np.clip((tt - 0.12) / 0.1, 0, 1))
    phase = np.cumsum(f) / SR
    src = 2 * (phase % 1) - 1
    out = np.zeros(n)
    for fc, g in zip(FORMANTS[vowel], (1.0, 0.65, 0.25)):
        out += filt(src, "band", [fc * 0.88, fc * 1.12]) * g
    e = np.minimum(1, tt / 0.008) * np.minimum(1, (dur - tt) / 0.04)
    return out * e * 2.2


def fm_bell(f, dur=0.7):
    """Glassy FM pluck: the modulation index decays faster than the note."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    index = 2.4 * np.exp(-tt * 14)
    return np.sin(2 * np.pi * f * tt + index * np.sin(2 * np.pi * 2 * f * tt)) * env(n, 0.002, 0.2)


def riser(dur):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    k = tt / dur
    noise = sweep_lp(rng.standard_normal(n), 300 * (40 ** k)) * k ** 2
    tone_ = np.sin(2 * np.pi * np.cumsum(220 * 4 ** k) / SR) * k ** 3 * 0.25
    return noise + tone_


def downlifter(dur):
    n = int(dur * SR)
    k = np.linspace(0, 1, n)
    return sweep_lp(rng.standard_normal(n), 9000 * (0.03 ** k)) * (1 - k) ** 2


def impact(big=True):
    n = int((2.4 if big else 0.7) * SR)
    tt = np.arange(n) / SR
    f = 30 + 60 * np.exp(-tt * 6)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * (1.6 if big else 6))
    crash = filt(rng.standard_normal(n), "low", 9000 if big else 4000) * np.exp(-tt * (2.2 if big else 14))
    return np.tanh(boom * 1.6) + crash * (0.5 if big else 0.35)


def hit():
    """Short punchy accent under every headline."""
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


# ------------------------------------------------------------------ arrangement
S16 = BEAT / 4  # one 16th note
FULL = DROPS                                    # four-on-the-floor, everything in
HALF_TIME = [(44, 48), SOFT]                    # kick on 1 and 3, clap on 3
NO_HOOK = [(15, 17.5), (23.75, 25.9)]           # let these headlines land alone

# Two-bar hook phrases: (16th step, length in 16ths, midi note). A answers over
# the first two chords of the progression, B over the last two.
HOOK_A = [(0, 2, 76), (2, 2, 74), (4, 3, 72), (8, 2, 69), (10, 2, 72), (12, 4, 74),
          (16, 2, 76), (18, 2, 79), (20, 3, 76), (24, 2, 74), (26, 2, 72), (28, 4, 69)]
HOOK_B = [(0, 2, 72), (2, 2, 74), (4, 3, 76), (8, 2, 79), (10, 2, 81), (12, 4, 79),
          (16, 2, 76), (18, 2, 74), (20, 3, 72), (24, 2, 74), (26, 4, 76), (30, 2, 74)]
VOWELS = "aoae"

# Bass per bar: (16th step, length in 16ths, interval above the root).
BASSLINE = [(0, 2, 0), (3, 1, 0), (4, 2, 12), (7, 1, 0), (8, 2, 0), (10, 1, 7), (11, 1, 0), (12, 2, 12), (14, 2, 10)]

drums, claps, hats, perc = (np.zeros(N) for _ in range(4))
kick_t = []
for i in range(int(END / BEAT)):
    b = i * BEAT
    beat_in_bar = i % 4
    if within(b, FULL) or within(b, [(2, 7.0), (48, 51.0)]):
        kick_t.append(b)
    elif within(b, HALF_TIME) and beat_in_bar in (0, 2):
        kick_t.append(b)
    if within(b, FULL + [(46, 50)]) and beat_in_bar in (1, 3):
        add(claps, clap(), b, 0.55)
    elif within(b, HALF_TIME) and beat_in_bar == 2:
        add(claps, clap(), b, 0.6)
    if within(b, FULL):
        swing = 0.03
        for k, (o, g) in enumerate(((0, 0.15), (S16 + swing, 0.07), (2 * S16, 0.12), (3 * S16 + swing, 0.07))):
            add(hats, hat(), b + o, g)
            add(perc, shaker(), b + o, 0.05 + 0.03 * (k % 2))
        add(hats, hat(True), b + 2 * S16, 0.08)
    elif within(b, [(4, 7.5), (48, 51.5), SOFT]):
        add(hats, hat(), b, 0.12)
        add(hats, hat(), b + 2 * S16, 0.1)
for b in kick_t:
    add(drums, kick(), b, 1.0)

# Syncopated rimshots and a drum fill on the last beat of every phrase.
for bar in range(int(END // BAR) + 1):
    t0 = bar * BAR
    if within(t0, FULL):
        for step in (3, 7, 10, 14):
            add(perc, rim(), t0 + step * S16, 0.12)
for t_fill in (15.5, 23.5, 31.5, 39.5, 57.5, 73.5):
    for k, f in enumerate((240, 200, 165, 135)):
        add(perc, tom(f), t_fill + k * S16, 0.5)
    add(claps, clap(), t_fill + 3 * S16, 0.35)

# Snare rolls into each drop: 8ths -> 16ths -> 32nds, rising.
for start, end in ((6.0, 7.75), (50.0, 51.75), (64.0, 65.75)):
    t = start
    while t < end:
        k = (t - start) / (end - start)
        step = 0.25 if k < 0.4 else 0.125 if k < 0.75 else 0.0625
        add(claps, clap(), t, 0.15 + 0.45 * k)
        t += step

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

stabs = np.zeros(N)
for bar in range(int(END // BAR) + 1):
    for step in (2, 6, 10, 13):
        t = bar * BAR + step * S16
        if within(t, FULL + [SOFT, (44, 51.75)]) and not within(t, [(23.75, 25.9)]):
            _, notes = chord_at(t)
            add(stabs, stab(notes), t, 1.0 if step != 13 else 0.7)
chords = pad * 0.7 + stabs * 1.15
cut = np.full(N, 8000.0)
ka = np.clip((TL - 2) / 6, 0, 1)
cut = np.where(TL < 8, 250 + 4500 * ka ** 2, cut)
cut = np.where((TL >= BREAK[0]) & (TL < BREAK[1]), 1200, cut)
kb = np.clip((TL - BUILD_B[0]) / (52 - BUILD_B[0]), 0, 1)
cut = np.where((TL >= BUILD_B[0]) & (TL < BUILD_B[1]), 700 + 5000 * kb ** 1.5, cut)
cut = np.where((TL >= SOFT[0]) & (TL < SOFT[1]), 3000, cut)
chords = sweep_lp(chords, cut)
chords *= np.interp(TL, [0, 2, 8, 40, 40.01, 44, 52, 58, 66, 76], [0, .55, 1, 1, .8, .9, 1, .85, 1, 1]) * pump

bass, sub = np.zeros(N), np.zeros(N)
for bar in range(int(END // BAR) + 1):
    t0 = bar * BAR
    root, _ = chord_at(t0 + 0.01)
    if within(t0, FULL + [(46, 52)]):
        for step, length, iv in BASSLINE:
            add(bass, bass_note(midi(root - 12 + iv), length * S16 * TEMPO), t0 + step * S16, 1.0)
    elif within(t0, [SOFT, (44, 46)]):
        add(bass, bass_note(midi(root - 12), BEAT * 1.8 * TEMPO), t0, 0.9)
        add(bass, bass_note(midi(root - 12), BEAT * 1.8 * TEMPO), t0 + 2 * BEAT, 0.8)
    if within(t0, FULL + [SOFT, BUILD_B, BREAK, (2, 8)]):
        add(sub, sub_note(midi(root - 12), BAR * TEMPO), t0, 1.0)
sub *= pump


def play_hook(buf, start, end, gain=1.0, octave=0, voice="vox"):
    """Lay the hook over [start, end) in two-bar phrases that follow the chords."""
    prev = None
    for t0 in np.arange(start, end, 2 * BAR):
        # A sits over the first two chords of the cycle, B over the last two.
        phrase = HOOK_A if int(t0 // BAR) % 4 < 2 else HOOK_B
        for i, (step, length, note) in enumerate(phrase):
            t = t0 + step * S16
            if t >= end or within(t, NO_HOOK):
                prev = None
                continue
            n = note + key_at(t) + octave
            dur = length * S16 * TEMPO
            if voice == "vox":
                f0 = midi(prev) if prev is not None else midi(n)
                add(buf, vox(f0, midi(n), dur, VOWELS[i % 4]), t, gain)
            else:
                add(buf, fm_bell(midi(n), 1.2), t, gain)
            prev = n


hook = np.zeros(N)
play_hook(hook, 4.0, 8.0, 0.6)               # teaser under the build (filtered below)
play_hook(hook, 8.0, 40.0, 1.0)
play_hook(hook, 52.0, 58.0, 1.0)
play_hook(hook, 58.0, 64.0, 0.55)
play_hook(hook, 66.0, 74.0, 1.0)
hook_hi = np.zeros(N)
play_hook(hook_hi, 66.0, 74.0, 0.45, octave=12)  # final drop: doubled an octave up
hook_cut = np.where(TL < 8, 500 + 3500 * ka ** 2, np.where((TL >= SOFT[0]) & (TL < SOFT[1]), 2800, 9000))
hook = sweep_lp(hook + hook_hi, hook_cut)

# Counter-melody bells answer the hook in the second half of the first drop,
# and carry the hook alone through the breakdown.
bells = np.zeros(N)
for i, t in enumerate(np.arange(SECOND_HALF[0], SECOND_HALF[1], 1.0)):
    if within(t, NO_HOOK):
        continue
    _, notes = chord_at(t + 0.75)
    add(bells, fm_bell(midi(notes[[3, 2, 3, 1][i % 4]] + 12)), t + 0.75, 0.6)
play_hook(bells, BREAK[0], BREAK[1], 0.8, voice="bell")

# Vocal stutter into the second drop: the last hook note retriggered in 32nds.
stutter = np.zeros(N)
for k, t in enumerate(np.arange(51.0, 51.75, S16 / 2)):
    add(stutter, vox(midi(76), midi(76), S16 / 2 * TEMPO * 0.9, "a"), t, 0.4 + 0.6 * k / 12)

fx = np.zeros(N)
add(fx, riser(2.0 * TEMPO), 6.0, 0.5)
add(fx, riser(4.0 * TEMPO), 47.75, 0.45)
add(fx, riser(1.75 * TEMPO), 64.0, 0.45)
add(fx, riser(1.0 * TEMPO), 29.0, 0.3)
for t_drop in (8.0, 52.0, 66.0):
    add(fx, reverse_cymbal(1.5 * TEMPO), t_drop - 1.5, 0.35)
    add(fx, impact(True), t_drop, 0.9)
    add(fx, downlifter(1.5 * TEMPO), t_drop, 0.25)
for t_hit in (16.0, 24.0, 32.0, 44.0, 70.0):
    add(fx, impact(False), t_hit, 0.4)
add(fx, reverse_cymbal(1.0 * TEMPO), 43.0, 0.3)

FINAL_HIT = 74.0
add(fx, impact(True), FINAL_HIT, 1.0)
final_notes = [n + key_at(FINAL_HIT) for n in (45, 57, 60, 64, 69, 72)]
final_chord = warm_pad(final_notes, DUR - FINAL_HIT * TEMPO)
final_chord *= np.exp(-np.arange(len(final_chord)) / SR * 0.9)
add(chords, final_chord * 0.9, FINAL_HIT)
add(chords, stab(final_notes[1:5]), FINAL_HIT, 0.9)
add(hook, vox(midi(81 + 2), midi(81 + 2), 1.2 * TEMPO, "a"), FINAL_HIT, 0.5)

# Centre: drums, bass, hook, fx. Wide: chords, hats, perc, bells, reverb — the
# right channel gets them 11ms late (Haas) so the track opens up in stereo.
hook_delay = np.zeros(N)
d = int(SR * 0.375 * TEMPO)  # dotted-8th echo
hook_delay[d:] = hook[:-d] * 0.3
center = drums * 0.7 + claps * 1.2 + bass * 0.36 + sub * 0.09 + fx * 0.55 + hook * 0.28 + stutter * 0.24
wide = (hats * 1.9 + perc * 1.4 + chords * 0.48 + bells * 0.22 + hook_delay * 0.18
        + reverb(claps * 0.5 + hook * 0.35 + bells * 0.6 + chords * 0.05 + fx * 0.2) * 0.35)
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
