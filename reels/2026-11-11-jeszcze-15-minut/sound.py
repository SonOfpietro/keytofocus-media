"""Sound for reel 2 ("Jeszcze 15 minut"): SFX + original 128 BPM score, all timed from timeline2.json.
Writes sfx2.wav, music2.wav, mix2.wav."""
import json, wave
import numpy as np
from scipy.signal import butter, sosfilt

TL = json.load(open('timeline.json'))
SR, DUR = 48000, TL['duration']
E, S = TL['events'], TL['scenes']
n = int(SR * DUR); t = np.arange(n) / SR
rng = np.random.default_rng(11)
BEAT = 60 / TL['bpm']; S16 = BEAT / 4

def lp(x, fc, o=2): return sosfilt(butter(o, min(fc, SR / 2.2), 'low', fs=SR, output='sos'), x, axis=0)
def hp(x, fc, o=2): return sosfilt(butter(o, fc, 'high', fs=SR, output='sos'), x, axis=0)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, min(hi, SR / 2.2)], 'band', fs=SR, output='sos'), x, axis=0)
def mf(m): return 440.0 * 2 ** ((m - 69) / 12)
def osc(f, L, kind='sine', ph0=0.0):
    k = int(L * SR); f = np.full(k, float(f)) if np.isscalar(f) else np.asarray(f, float)[:k]
    ph = np.cumsum(f) / SR + ph0
    if kind == 'sine': return np.sin(2 * np.pi * ph)
    if kind == 'saw': return 2 * (ph % 1) - 1
    if kind == 'square': return np.where(ph % 1 < .5, 1.0, -1.0)
    if kind == 'tri': return 2 * np.abs(2 * (ph % 1) - 1) - 1
def env(L, a=.002, d=None, curve=6.0):
    k = int(L * SR); x = np.arange(k) / SR; e = np.exp(-x * curve / (d or L))
    ak = max(1, int(a * SR)); e[:ak] *= np.linspace(0, 1, ak); return e
def gsweep(f0, f1, L): return np.geomspace(f0, f1, int(L * SR))

class Bus:
    def __init__(s): s.dry = np.zeros((n, 2)); s.send = np.zeros((n, 2))
    def add(s, sig, at, g=1.0, pan=0.0, rev=.25):
        i0 = int(round(at * SR))
        if i0 >= n: return
        if sig.ndim == 1:
            l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            sig = np.stack([sig * l, sig * r], 1) * 1.414
        if i0 < 0: sig = sig[-i0:]; i0 = 0
        m = min(len(sig), n - i0)
        s.dry[i0:i0 + m] += sig[:m] * g; s.send[i0:i0 + m] += sig[:m] * g * rev
def reverb(x, secs=1.8, decay=3.0):
    k = int(secs * SR); xx = np.arange(k) / SR
    ir = np.stack([rng.standard_normal(k) * np.exp(-xx * decay), rng.standard_normal(k) * np.exp(-xx * (decay * .93))], 1)
    ir = lp(ir, 6500); ir /= np.sqrt((ir ** 2).sum(0))
    nf = 1 << int(np.ceil(np.log2(n + k))); out = np.zeros_like(x)
    for c in range(2): out[:, c] = np.fft.irfft(np.fft.rfft(x[:, c], nf) * np.fft.rfft(ir[:, c], nf), nf)[:n]
    return out
def noise(L): return rng.standard_normal(int(L * SR))

# ═════════════════════════ SFX
fx = Bus()
def boom(at, g=1.0, f0=95, f1=30, L=1.6):
    s = osc(gsweep(f0, f1, L), L) * env(L, .002, 1.2, 4) + lp(noise(L), 1800) * env(L, .001, .45, 6) * .6
    fx.add(np.tanh(1.7 * s), at, g, 0, .35)
def whoosh(at, before=.5, after=.25, g=.5, f0=300, f1=6000):
    L = before + after; k = int(L * SR); x = np.arange(k) / SR
    s = bp(noise(L), 200, 7000); fc = np.geomspace(f0, f1, k)
    s = lp(s, 4000) * 0 + s  # keep broadband
    e = np.where(x < before, (x / before) ** 2.2, np.exp(-(x - before) * 14))
    s = s * e / (np.abs(s).max() + 1e-9)
    fx.add(np.stack([s * np.linspace(1, .4, k), s * np.linspace(.4, 1, k)], 1), at - before, g, rev=.4)
def blip(at, f, g=.25, L=.05, kind='sine', pan=0.0, rev=.25):
    fx.add(osc(f, L, kind) * env(L, .001, L, 6), at, g, pan, rev)
def chime(at, f0, g=.5, L=2.2):
    k = int(L * SR)
    s = sum(a * np.sin(2 * np.pi * f0 * r * np.arange(k) / SR) * env(L, .001, L / (1 + r * .6), 5) for r, a in [(1, 1), (2.76, .5), (5.4, .25), (8.9, .12)])
    fx.add(s / 1.9, at, g, 0, .6)
def glitch(a, b, g=.35):
    L = b - a; k = int(L * SR); nz = noise(L); hold = np.repeat(nz[::64], 64)[:k]; ch = np.zeros(k)
    for _ in range(int(L * 50)):
        i0 = rng.integers(0, max(1, k - 1500)); seg = osc(rng.uniform(300, 3200), .03, 'square') * env(.03, .0005, .03, 4); ch[i0:i0 + len(seg)] += seg[:k - i0]
    s = (hold * .5 + ch * .5) * np.sin(np.pi * np.arange(k) / k) ** .6
    p = np.sin(np.arange(k) / SR * 37)
    fx.add(np.stack([s * (1 - p) / 2, s * (1 + p) / 2], 1) * 1.4, a, g, rev=.2)
def click(at, g=.5, pan=0.0, bright=1.0):
    L = .035; s = hp(noise(L), 2500) * env(L, .0003, .012, 5) + osc(1800 * bright, L, 'sine') * env(L, .0005, .01, 5) * .5
    fx.add(s, at, g, pan, .12)

# scene 1: taps accelerate, clock races
taps = E['taps']
for i, T in enumerate(taps):
    pr = i / (len(taps) - 1)
    click(T, .85, pan=(-.25 if i % 2 else .25), bright=1 + pr * .5)
    blip(T + .012, mf(76 + round(pr * 14)), .26 + .16 * pr, .07, 'tri', pan=(.2 if i % 2 else -.2), rev=.35)
    blip(T + .03, mf(88 + round(pr * 10)), .07, .05, 'sine', rev=.4)
# clock ticks: interval shrinks with the tap rate
tk, tt = 0, 0.0
while tt < E['bigClock'] - .02:
    rate = .25 if tt < taps[0] else max(.035, .25 * (1 - (tt - taps[0]) / (E['bigClock'] - taps[0])) ** 1.6)
    L = .02; fx.add(hp(noise(L), 4000) * env(L, .0002, .01, 5), tt, .22 + .12 * (tt / E['bigClock']), (-.3 if tk % 2 else .3), .1)
    tt += rate; tk += 1
Lr = E['bigClock'] - .3
riser = bp(noise(Lr), 300, 6000) * np.linspace(0, 1, int(Lr * SR)) ** 2.6
fx.add(riser / (np.abs(riser).max() + 1e-9), .3, .3, 0, .3)
fx.add(osc(gsweep(60, 240, Lr), Lr, 'saw') * np.linspace(0, 1, int(Lr * SR)) ** 3 * .5, .3, .12, 0, .2)
boom(E['bigClock'], 1.0)
alarm = (osc(mf(69), .9, 'square') + osc(mf(70), .9, 'square')) * env(.9, .002, .7, 4)
fx.add(lp(alarm, 2500), E['bigClock'], .14, 0, .5)
glitch(E['bigClock'] - .03, E['bigClock'] + .11, .5)
# scene 2: rip, morph into key, fly away
glitch(3.68, 3.85, .45); whoosh(E['rip'], .35, .35, .5)
Lm = E['morphEnd'] - E['morphStart']
for j in range(140):
    tt = E['morphStart'] + Lm * (j / 140) ** .8 + rng.uniform(-.02, .02)
    blip(tt, rng.uniform(1800, 4500) * (1 + j / 200), .05 + .05 * j / 140, .06, 'sine', pan=rng.uniform(-.9, .9), rev=.7)
sw = bp(noise(Lm), 500, 9000) * np.linspace(0, 1, int(Lm * SR)) ** 2
fx.add(sw / (np.abs(sw).max() + 1e-9), E['morphStart'], .22, 0, .5)
boom(E['keyFormed'], .55, 120, 40, 1.0); chime(E['keyFormed'], 1318.5, .5, 2.2)
Lf = E['flyEnd'] - E['flyStart']
fly = bp(noise(Lf), 300, 5000) * np.concatenate([np.linspace(.2, 1, int(Lf * SR * .25)), np.linspace(1, 0, int(Lf * SR) - int(Lf * SR * .25))]) ** 1.5
fx.add(fly / (np.abs(fly).max() + 1e-9), E['flyStart'], .4, 0, .5)
fx.add(osc(gsweep(900, 160, Lf), Lf, 'sine') * env(Lf, .02, Lf, 2.5), E['flyStart'], .15, 0, .6)
# scene 3: drop, denials, reveal
boom(E['drop'], 1.0); glitch(7.38, 7.6, .4)
for T in E['deny']:
    L = .26; bz = (osc(110, L, 'square') + osc(116.5, L, 'square') * .8 + osc(220, L, 'saw') * .3) * env(L, .002, .24, 2.5)
    fx.add(lp(bz, 1800), T, .22, 0, .2); click(T - .02, .4)
chime(E['reveal'], 1760, .4, 2.0); whoosh(E['reveal'], .3, .3, .3)
for j, f in enumerate([880, 1108.7, 1318.5]): blip(E['reveal'] + .08 + j * .07, f, .12, .3, 'tri', pan=-.3 + j * .3, rev=.6)
# scene 4: payoff
click(E['payoff1'] + .2, .6); blip(E['payoff1'] + .21, 1500, .2, .05)
Lp = E['payoffSlam'] - E['payoff1'] - .1
rs = lp(noise(Lp), 6000) * np.linspace(0, 1, int(Lp * SR)) ** 3
fx.add(rs / (np.abs(rs).max() + 1e-9), E['payoff1'] + .1, .4, 0, .3)
boom(E['payoffSlam'], 1.0); glitch(11.15, 11.33, .35)
# scene 5: end card
glitch(13.025, 13.225, .35); whoosh(E['logo'], .3, .2, .35)
for j in range(40): blip(E['logo'] + rng.uniform(0, 1.0), rng.uniform(2400, 6000), .045, .08, 'sine', pan=rng.uniform(-.8, .8), rev=.7)
for k_, f in enumerate([880, 1320]): fx.add(lp(osc(f, 1.2, 'tri'), 4000) * env(1.2, .001, .6, 5), E['pill'] + k_ * .06, .2 - k_ * .06, k_ * .2, .5)
Lo = DUR - E['outro']
ro = bp(noise(Lo), 400, 7000) * np.linspace(0, 1, int(Lo * SR)) ** 2
fx.add(ro / (np.abs(ro).max() + 1e-9), E['outro'], .5, 0, .3)
glitch(16.615, DUR, .4)

sfx = fx.dry + reverb(fx.send) * .9

# ═════════════════════════ MUSIC (A minor -> A major)
mu = Bus()
CH = {'Am': [57, 60, 64], 'F': [53, 57, 60], 'C': [55, 60, 64], 'G': [55, 59, 62], 'Esus': [52, 57, 59], 'E': [52, 56, 59],
      'Dm': [53, 57, 62], 'A': [57, 61, 64], 'D': [54, 57, 62]}
ROOT = {'Am': 45, 'F': 41, 'C': 48, 'G': 43, 'Esus': 40, 'E': 40, 'Dm': 50, 'A': 45, 'D': 50}
b = BEAT
SEG = [(0, 8 * b, 'Am'), (E['bigClock'], E['rip'], None),
       (S['twist'][0], S['twist'][0] + 2 * b, 'F'), (S['twist'][0] + 2 * b, S['twist'][0] + 4 * b, 'C'),
       (S['twist'][0] + 4 * b, S['twist'][0] + 6 * b, 'G'), (S['twist'][0] + 6 * b, S['twist'][1], 'Esus'),
       (S['lock'][0], S['lock'][0] + 2 * b, 'Am'), (S['lock'][0] + 2 * b, S['lock'][0] + 4 * b, 'F'),
       (S['lock'][0] + 4 * b, S['lock'][0] + 6 * b, 'Dm'), (S['lock'][0] + 6 * b, S['lock'][1], 'E'),
       (S['payoff'][0], E['payoffSlam'], 'E'), (E['payoffSlam'], S['payoff'][1], 'A'),
       (S['end'][0], S['end'][0] + 4 * b, 'A'), (S['end'][0] + 4 * b, S['end'][0] + 6 * b, 'D'), (S['end'][0] + 6 * b, DUR, 'E')]
def chord_at(x):
    best = None
    for a, c, ch in SEG:
        if a <= x < c: best = ch
    return best
def section(x):
    if x < E['bigClock']: return 'build'
    if x < E['rip']: return 'stop'
    if x < S['lock'][0]: return 'dream'
    if x < S['payoff'][0]: return 'drive'
    if x < E['payoffSlam']: return 'pre'
    if x < S['end'][0]: return 'lift'
    return 'outro'

# drums (beat grid)
def kick(at, g):
    L = .42; s = osc(gsweep(150, 42, L), L) * env(L, .001, .32, 5); mu.add(np.tanh(1.3 * s + .3 * np.tanh(4 * s)), at, g, 0, .08)
def hat(at, g, pan=0.0, L=.05):
    mu.add(hp(noise(L), 7500) * env(L, .0005, L, 7), at, g, pan, .12)
def clap(at, g):
    L = .25; s = bp(noise(L), 900, 5000) * (env(L, .001, .18, 5) + .5 * np.concatenate([np.zeros(int(.012 * SR)), env(L - .012, .0005, .05, 5)]))
    mu.add(s, at, g, 0, .45)
kicks = []
x = 0.0
while x < DUR - .01:
    sec = section(x); i = round(x / b)
    if sec == 'build':
        if i % 2 == 0: kick(x, .3); kicks.append(x)
        hat(x + b / 2, .08 + .1 * x / E['bigClock'], .3)
    elif sec == 'drive':
        kick(x, .75); kicks.append(x); hat(x + b / 2, .16, .25); hat(x + b * .75, .07, -.25)
        if i % 2 == 1: clap(x, .3)
    elif sec == 'lift':
        kick(x, .7); kicks.append(x); hat(x + b / 2, .15, .25)
        if i % 2 == 1: clap(x, .28)
    elif sec == 'outro' and x < E['outro'] - .05:
        if i % 2 == 0: kick(x, .45); kicks.append(x)
        hat(x + b / 2, .1, .3)
    x += b
# snare roll into the drop
for j in range(16):
    T = S['twist'][1] - 2 * b + j * (2 * b / 16)
    clap(T, .05 + .2 * (j / 15) ** 2)
duck = np.ones(n)
for kt in kicks + [E['bigClock'], E['drop'], E['payoffSlam']]:
    i0 = int(kt * SR); k = min(int(.35 * SR), n - i0)
    duck[i0:i0 + k] = np.minimum(duck[i0:i0 + k], 1 - .7 * np.exp(-np.arange(k) / SR / .07))

# pad (supersaw)
pad = np.zeros((n, 2))
for a, c, ch in SEG:
    if ch is None: continue
    i0, i1 = int(a * SR), int(c * SR); k = i1 - i0; seg = np.zeros((k, 2))
    for m in CH[ch] + [CH[ch][0] + 12]:
        for v, det in enumerate([-.12, -.05, 0, .05, .12]):
            s = 2 * ((mf(m) * 2 ** (det / 12) * np.arange(k) / SR + rng.random()) % 1) - 1; p = (v - 2) / 2.5
            seg[:, 0] += s * (1 - p) / 2; seg[:, 1] += s * (1 + p) / 2
    e = np.ones(k); ak, rk = int(.08 * SR), int(.05 * SR); e[:ak] = np.linspace(0, 1, ak); e[-rk:] *= np.linspace(1, 0, rk)
    pad[i0:i1] += seg * e[:, None]
pad = lp(pad, 1600) / 20
pg = np.interp(t, [0, E['bigClock'], E['bigClock'] + .01, E['rip'], E['rip'] + .01, S['lock'][0] - .01, S['lock'][0], S['payoff'][0], E['payoffSlam'], E['payoffSlam'] + .01, DUR],
               [.3, .7, 0, 0, .55, 1.0, .65, .65, .9, .8, .85])
mu.dry += pad * (pg * duck)[:, None] * .55; mu.send += pad * .1

# arpeggio
arp = np.zeros((n, 2)); PAT = [0, 2, 4, 5, 3, 1, 4, 2]
for k_ in range(int(DUR / S16)):
    x = k_ * S16; sec = section(x); ch = chord_at(x)
    if ch is None or sec in ('stop', 'pre'): continue
    tones = CH[ch]; pool = tones + [m + 12 for m in tones]; m = pool[PAT[k_ % 8]] + 12
    if sec == 'dream' and k_ % 2: continue
    L = .18; kk = int(L * SR); f = mf(m)
    s = .6 * (2 * ((f * np.arange(kk) / SR) % 1) - 1) + .4 * np.where((f * 1.005 * np.arange(kk) / SR) % 1 < .3, 1., -1.)
    if sec == 'build': fc = 600 + 3400 * (x / E['bigClock']) ** 2
    elif sec == 'dream': fc = 2400 + 2500 * ((x - E['rip']) / (S['lock'][0] - E['rip']))
    else: fc = 3600
    s = lp(s * np.exp(-np.arange(kk) / SR / (.06 if sec != 'dream' else .12)), fc)
    i0 = int(round(x * SR)); mm = min(kk, n - i0); pan = .35 if k_ % 2 else -.35; acc = 1.0 if k_ % 4 == 0 else .7
    arp[i0:i0 + mm, 0] += s[:mm] * acc * (1 - pan); arp[i0:i0 + mm, 1] += s[:mm] * acc * (1 + pan)
d = int(3 * S16 * SR); wet = np.zeros_like(arp)
for tap, g in enumerate([.42, .26, .15, .08], 1):
    sh = np.zeros_like(arp); sh[d * tap:] = arp[:-d * tap]
    wet += (sh[:, ::-1] if tap % 2 else sh) * g
arp = arp + lp(wet, 4500)
ag = np.interp(t, [0, E['bigClock'], S['lock'][0], S['end'][0], DUR], [.45, .75, .65, .6, .65])
mu.dry += arp * (ag * (.6 + .4 * duck))[:, None] * .35

# bass
bass = np.zeros(n)
for k_ in range(int(DUR / (2 * S16))):
    x = k_ * 2 * S16; sec = section(x); ch = chord_at(x)
    if ch is None or sec in ('stop', 'dream', 'pre'): continue
    if sec in ('build', 'outro') and k_ % 2: continue
    L = .21 if sec not in ('build', 'outro') else .42; kk = int(L * SR); f = mf(ROOT[ch])
    s = .7 * (2 * ((f * np.arange(kk) / SR) % 1) - 1) + .6 * np.sin(np.pi * f * np.arange(kk) / SR) + .3 * (2 * ((f * 2.003 * np.arange(kk) / SR) % 1) - 1)
    s = lp(s * np.minimum(1, np.arange(kk) / (.004 * SR)) * np.exp(-np.arange(kk) / SR / .25), 900 if k_ % 2 else 650)
    i0 = int(round(x * SR)); mm = min(kk, n - i0); bass[i0:i0 + mm] += s[:mm] * (1 if k_ % 2 else .8)
bass = np.tanh(bass * 1.4) * duck
mu.dry[:, 0] += bass * .42; mu.dry[:, 1] += bass * .42
# dream-section sub swell
Ld = S['lock'][0] - E['rip']
mu.add(np.sin(2 * np.pi * mf(40) * np.arange(int(Ld * SR)) / SR) * np.linspace(0, 1, int(Ld * SR)) ** 2, E['rip'], .25, 0, 0)

# lead hook over the lift + end card
LEAD = [(E['payoffSlam'], 2 * b, 76), (E['payoffSlam'] + 2 * b, b, 73), (E['payoffSlam'] + 3 * b, b, 69),
        (S['end'][0], 2 * b, 81), (S['end'][0] + 2 * b, b, 80), (S['end'][0] + 3 * b, b, 76), (S['end'][0] + 4 * b, 2 * b, 78), (S['end'][0] + 6 * b, 2 * b, 76)]
lead = np.zeros(n)
for st, du, m in LEAD:
    kk = int((du + .25) * SR); x = np.arange(kk) / SR
    f = mf(m) * (1 + .006 * np.sin(2 * np.pi * 5.5 * x) * np.minimum(1, x / .15)); ph = np.cumsum(f) / SR
    s = .55 * (2 * (ph % 1) - 1) + .45 * np.where((ph * 1.002) % 1 < .5, 1, -1)
    s = lp(s * np.minimum(1, x / .01) * np.where(x < du, 1, np.exp(-(x - du) / .08)), 2600)
    i0 = int(st * SR); mm = min(kk, n - i0); lead[i0:i0 + mm] += s[:mm]
mu.add(lead, 0, .2, 0, .5)

music = mu.dry + reverb(mu.send, 2.2, 2.6) * .8
music = hp(music, 35)

def norm(x, peak=.9):
    fk = int(.03 * SR); x = x.copy(); x[:fk] *= np.linspace(0, 1, fk)[:, None]; x[-fk:] *= np.linspace(1, 0, fk)[:, None]
    return x / (np.abs(x).max() / peak)
def write(name, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(name, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
sfx, music = norm(sfx), norm(music)
write('sfx2.wav', sfx); write('music2.wav', music)
mix = sfx * .95 + music * .55
mix = np.tanh(mix * 1.15) / np.tanh(1.15)
write('mix2.wav', norm(mix))
rms = lambda x: round(20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-12), 1)
print('sfx', rms(sfx), 'music', rms(music), 'mix', rms(norm(mix)))
