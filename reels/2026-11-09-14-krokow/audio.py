"""Synthesised sound design for the Key to Focus reel. All timings come from timeline.json."""
import json, wave, sys
import numpy as np

TL = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'timeline.json'))
SR = 48000
DUR = TL['duration']
E, S, N = TL['events'], TL['scenes'], TL['steps']
n = int(SR * DUR)
t = np.arange(n) / SR
rng = np.random.default_rng(7)

dry = np.zeros((n, 2))
send = np.zeros((n, 2))  # reverb send

def place(sig, at, gain=1.0, pan=0.0, rev=0.25):
    """mix a mono (or stereo) signal at time `at`"""
    i0 = int(at * SR)
    if i0 >= n: return
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l, sig * r], 1) * np.sqrt(2)
    if i0 < 0: sig = sig[-i0:]; i0 = 0
    m = min(len(sig), n - i0)
    dry[i0:i0 + m] += sig[:m] * gain
    send[i0:i0 + m] += sig[:m] * gain * rev

def env(length, a=0.002, d=None, curve=6.0):
    k = int(length * SR); x = np.arange(k) / SR
    e = np.exp(-x * curve / (d or length))
    ak = max(1, int(a * SR)); e[:ak] *= np.linspace(0, 1, ak)
    return e

def osc(freq, length, kind='sine', phase=0.0):
    k = int(length * SR)
    f = np.full(k, float(freq)) if np.isscalar(freq) else np.asarray(freq)[:k]
    ph = 2 * np.pi * np.cumsum(f) / SR + phase
    if kind == 'sine': return np.sin(ph)
    if kind == 'saw': return 2 * ((ph / (2 * np.pi)) % 1) - 1
    if kind == 'square': return np.sign(np.sin(ph))
    if kind == 'tri': return 2 * np.abs(2 * ((ph / (2 * np.pi)) % 1) - 1) - 1

def onepole(x, fc, hp=False):
    a = np.exp(-2 * np.pi * np.asarray(fc) / SR)
    y = np.zeros_like(x); prev = 0.0
    if np.isscalar(fc):
        # vectorised via lfilter-like recursion
        for i in range(len(x)):
            prev = (1 - a) * x[i] + a * prev; y[i] = prev
    else:
        for i in range(len(x)):
            prev = (1 - a[i]) * x[i] + a[i] * prev; y[i] = prev
    return x - y if hp else y

def bandnoise(length, f0, f1, q=2.0):
    """noise swept between f0 and f1 through a crude band-pass (two one-poles)"""
    k = int(length * SR)
    w = rng.standard_normal(k)
    fc = np.geomspace(f0, f1, k)
    lp = onepole(w, fc * 1.6)
    return onepole(lp, fc / 1.6, hp=True)

def sweep(f0, f1, length, kind='sine'):
    return osc(np.geomspace(f0, f1, int(length * SR)), length, kind)

# ─────────────────────────── drone bed (continuous, loop-safe)
bed = np.zeros((n, 2))
for f, g, det in [(55, .30, .12), (82.41, .16, .2), (110, .12, .3), (164.8, .05, .4)]:
    for ch, s in enumerate((-1, 1)):
        bed[:, ch] += g * np.sin(2 * np.pi * (f + s * det) * t + ch)
lfo = .75 + .25 * np.sin(2 * np.pi * .23 * t)
bed *= lfo[:, None]
# tension layer (minor second) while blocked
def level(a0, a1, b0, b1):
    return np.clip((t - a0) / max(a1 - a0, 1e-3), 0, 1) * np.clip((b1 - t) / max(b1 - b0, 1e-3), 0, 1)
tens = level(E['slam'], E['slam'] + .05, S['lock'][1] - .3, S['lock'][1]) + level(S['nfc'][0], S['nfc'][0] + .3, E['unlock'] - .05, E['unlock'])
for ch in range(2):
    bed[:, ch] += .12 * tens * np.sin(2 * np.pi * (58.27 + ch * .3) * t) + .05 * tens * osc(116.54 + ch * .5, DUR, 'saw')[:n] * .5
# brighter major layer after unlock and on the end card
bright = level(E['unlock'], E['unlock'] + .6, S['nfc'][1] - .2, S['nfc'][1]) + level(S['end'][0], S['end'][0] + .8, DUR - .6, DUR - .05)
for ch, f in enumerate((138.59, 220.0)):
    bed[:, ch] += .07 * bright * np.sin(2 * np.pi * f * t) + .05 * bright * np.sin(2 * np.pi * 329.63 * t + ch)
# noise air
air = onepole(rng.standard_normal(n), 900) * .05
bed += np.stack([air, np.roll(air, 2400)], 1)
bed *= .55
dry += bed; send += bed * .15

# ─────────────────────────── percussion
def kick(gain=1.0, at=0.0, rev=.1):
    L = .45
    s = osc(np.geomspace(150, 42, int(L * SR)), L) * env(L, .001, .35, 5)
    s += .3 * np.tanh(4 * s)
    place(s, at, gain, 0, rev)

def hat(at, gain=.25, pan=0.0):
    L = .06
    s = onepole(rng.standard_normal(int(L * SR)), 7000, hp=True) * env(L, .0005, .06, 7)
    place(s, at, gain, pan, .15)

def boom(at, gain=1.0):
    L = 1.6
    s = osc(np.geomspace(90, 30, int(L * SR)), L) * env(L, .002, 1.2, 4)
    nz = onepole(rng.standard_normal(int(L * SR)), 1800) * env(L, .001, .5, 6) * .6
    place(np.tanh(1.6 * (s + nz)), at, gain, 0, .35)

def whoosh(at, before=.5, after=.25, gain=.5):
    L = before + after
    s = bandnoise(L, 300, 6000)
    k = int(L * SR); x = np.arange(k) / SR
    e = np.where(x < before, (x / before) ** 2.2, np.exp(-(x - before) * 14))
    s = s * e / (np.abs(s).max() + 1e-9)
    st = np.stack([s * np.linspace(1, .4, k), s * np.linspace(.4, 1, k)], 1)
    place(st, at - before, gain, rev=.4)

def blip(at, f, gain=.25, L=.05, kind='sine', pan=0.0, rev=.25):
    place(osc(f, L, kind) * env(L, .001, L, 6), at, gain, pan, rev)

def chime(at, f0, gain=.5, L=2.2):
    s = sum(a * np.sin(2 * np.pi * f0 * r * np.arange(int(L * SR)) / SR) * env(L, .001, L / (1 + r * .6), 5)
            for r, a in [(1, 1), (2.76, .5), (5.4, .25), (8.9, .12)])
    place(s / 1.9, at, gain, 0, .6)

def glitch_burst(a, b, gain=.35):
    L = b - a; k = int(L * SR)
    nz = rng.standard_normal(k)
    hold = np.repeat(nz[::64], 64)[:k]          # sample-and-hold = bitcrush
    chirps = np.zeros(k)
    for j in range(int(L * 40)):
        i0 = rng.integers(0, max(1, k - 2400)); f = rng.uniform(300, 3000)
        seg = osc(f, .03, 'square') * env(.03, .0005, .03, 4); chirps[i0:i0 + len(seg)] += seg[:k - i0]
    x = np.arange(k) / k
    e = np.sin(np.pi * x) ** .6
    s = (hold * .5 + chirps * .5) * e
    pans = np.sin(np.arange(k) / SR * 37)
    st = np.stack([s * (1 - pans) / 2, s * (1 + pans) / 2], 1) * 1.4
    place(st, a, gain, rev=.2)

# hook: counter blips, one per increment
fps = TL['fps']
def eoutc(p): return 1 - (1 - p) ** 3
prev = 0
for fr in range(int(E['countEnd'] * fps) + 2):
    tt = fr / fps; p = min(1, max(0, (tt - E['countStart']) / (E['countEnd'] - E['countStart'])))
    v = round(eoutc(p) * N)
    for k in range(prev + 1, v + 1):
        blip(tt, 500 * 2 ** (k / 8), .42, .05, 'tri', pan=(k % 2) * .4 - .2)
    prev = max(prev, v)
boom(E['countEnd'], .55)
chime(E['countEnd'], 880, .25, 1.5)
glitch_burst(0.0, .3, .55)
boom(0.0, .8)
Lh = S['hook'][1] - .9
hr_ = bandnoise(Lh, 250, 5000) * np.linspace(0, 1, int(Lh * SR)) ** 2.5
place(hr_ / (np.abs(hr_).max() + 1e-9), .9, .32, 0, .3)
place(sweep(38, 90, Lh) * np.linspace(0, 1, int(Lh * SR)) ** 2, .9, .35, 0, .05)

# glitch transitions + whooshes
for a, b in TL['glitch']:
    glitch_burst(a, b, .32)
    whoosh((a + b) / 2, .45, .3, .45)

# beat grid 150 BPM from scene B to end of payoff
beat = .4
k = 0
while True:
    tb = S['lock'][0] + k * beat
    if tb >= S['payoff'][1] - .05: break
    in_plan = S['plan'][0] <= tb < S['plan'][1]
    kick(.5 if in_plan else .62, tb)
    if not in_plan: hat(tb + beat / 2, .16, .3)
    k += 1

# lock scene
blip(E['tap'], 1400, .3, .04, 'sine')
blip(E['tap'] + .03, 2100, .18, .05, 'sine')
boom(E['slam'], 1.0)
metal = sum(np.sin(2 * np.pi * f * np.arange(int(1.2 * SR)) / SR) * env(1.2, .001, .8 / (i + 1), 5) for i, f in enumerate([311, 467, 733, 1091, 1520]))
place(metal / 3, E['slam'], .35, 0, .5)
for j in range(4):
    blip(E['slam'] + .25 + j * .2, 880 if j % 2 == 0 else 660, .1, .12, 'square', pan=.3 if j % 2 else -.3, rev=.3)

# plan: scan sweep + room blips + footsteps
place(bandnoise(.9, 200, 4000) * np.linspace(0, 1, int(.9 * SR)) ** 2 * .6, S['plan'][0], .35, -.2, .4)
for j in range(3): blip(S['plan'][0] + .15 + j * .12, 1200 + j * 300, .14, .06, 'sine', pan=-.4 + j * .4)
for i in range(N):
    ts = E['stepFirst'] + i * E['stepInterval']
    pan = -.35 if i % 2 == 0 else .35
    L = .12
    thump = osc(np.geomspace(140, 70, int(L * SR)), L) * env(L, .001, .1, 6)
    place(thump, ts, .55, pan, .1)
    hat(ts, .22 + i * .012, pan)
    blip(ts, 700 * 2 ** (i / 14), .1 + i * .006, .04, 'tri', pan=pan)
chime(E['stepFirst'] + (N - 1) * E['stepInterval'] + .02, 1318.5, .3, 1.6)
whoosh(S['plan'][1], .4, .2, .6)

# nfc: sonar pings while waiting, flight whoosh, contact chime, data chatter, unlock arpeggio
for j in range(3): blip(S['nfc'][0] + .1 + j * .3, 1046, .12, .25, 'sine', rev=.6)
whoosh(E['contact'], .8, .15, .4)
chime(E['contact'], 1760, .45, 2.0)
kick(.8, E['contact'])
ch_t = E['contact'] + .05
while ch_t < E['verifyEnd']:
    pr = (ch_t - E['contact']) / (E['verifyEnd'] - E['contact'])
    blip(ch_t, rng.uniform(1500, 3500) * (1 + pr), .07, .018, 'square', pan=rng.uniform(-.7, .7), rev=.1)
    ch_t += rng.uniform(.015, .035)
place(sweep(400, 1600, E['verifyEnd'] - E['contact'], 'saw') * np.linspace(0, .35, int((E['verifyEnd'] - E['contact']) * SR)), E['contact'], .12, 0, .3)
boom(E['unlock'], .6)
for j, f in enumerate([440, 554.37, 659.25, 880, 1108.7]):
    L = 1.4
    s = (osc(f, L, 'saw') * .4 + osc(f, L) * .6) * env(L, .003, 1.0, 4)
    place(onepole(s, 3500), E['unlock'] + j * .055, .2, -.4 + j * .2, .55)

# payoff: reverse swell into the slam
L = .55
rev_sw = onepole(rng.standard_normal(int(L * SR)), 5000) * np.linspace(0, 1, int(L * SR)) ** 3
place(rev_sw, E['payoffSlam'] - L, .4, 0, .3)
boom(E['payoffSlam'], 1.0)
for f in (220, 277.18, 329.63, 440):
    L = 1.6
    place(onepole(osc(f, L, 'saw'), 2200) * env(L, .002, 1.3, 4), E['payoffSlam'], .1, 0, .6)
place(bandnoise(.4, 2000, 400) * env(.4, .001, .4, 3), S['payoff'][0], .25, 0, .3)

# end card: shimmer, pluck on the pill, riser into the loop
for j in range(46):
    tt = S['end'][0] + rng.uniform(0, 1.0)
    blip(tt, rng.uniform(2200, 6000), .045, .08, 'sine', pan=rng.uniform(-.8, .8), rev=.7)
L = 1.2
place(onepole(osc(880, L, 'tri'), 4000) * env(L, .001, .6, 5), E['pill'], .22, 0, .5)
place(onepole(osc(1320, L, 'tri'), 4000) * env(L, .001, .5, 5), E['pill'] + .06, .14, .2, .5)
Lr = DUR - E['outro']
riser = bandnoise(Lr, 400, 7000) * np.linspace(0, 1, int(Lr * SR)) ** 2
place(riser / (np.abs(riser).max() + 1e-9), E['outro'], .55, 0, .3)
tb = S['end'][0]
while tb < E['outro']:
    kick(.38, tb); hat(tb + .4, .1, -.3); tb += .8
for f in (220, 277.18, 329.63):
    Lp = E['outro'] - S['end'][0]
    pad = onepole(osc(f, Lp, 'saw') * .5 + osc(f * 1.003, Lp, 'saw') * .5, 1400)
    pe = np.minimum(1, np.arange(len(pad)) / (SR * .8)) * np.minimum(1, (len(pad) - np.arange(len(pad))) / (SR * .5))
    place(pad * pe, S['end'][0], .07, 0, .6)

# ─────────────────────────── reverb (stereo exponential-noise IR) + master
ir_len = int(1.8 * SR)
x = np.arange(ir_len) / SR
ir = np.stack([rng.standard_normal(ir_len) * np.exp(-x * 3.2), rng.standard_normal(ir_len) * np.exp(-x * 3.0)], 1)
ir[:, 0] = onepole(ir[:, 0], 6000); ir[:, 1] = onepole(ir[:, 1], 6000)
ir /= np.sqrt((ir ** 2).sum(0))
wet = np.zeros_like(send)
nfft = 1 << int(np.ceil(np.log2(n + ir_len)))
for ch in range(2):
    wet[:, ch] = np.fft.irfft(np.fft.rfft(send[:, ch], nfft) * np.fft.rfft(ir[:, ch], nfft), nfft)[:n]
mixd = dry + wet * .9
mixd = np.tanh(mixd * 1.1) / np.tanh(1.1)
# loop-safe edges
fk = int(.03 * SR)
mixd[:fk] *= np.linspace(0, 1, fk)[:, None]; mixd[-fk:] *= np.linspace(1, 0, fk)[:, None]
mixd /= np.abs(mixd).max() / .89
pcm = (mixd * 32767).astype('<i2')
with wave.open('sfx.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('sfx.wav', pcm.shape, 'rms dB', 20 * np.log10(np.sqrt((mixd ** 2).mean())))
