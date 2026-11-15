"""Original futuristic synth score for the Key to Focus reel (150 BPM, A minor -> A major).
Writes music.wav, then mix.wav = music under the existing sfx.wav."""
import json, wave
import numpy as np
from scipy.signal import butter, sosfilt

TL = json.load(open('timeline.json'))
SR, DUR = 48000, TL['duration']
E, S = TL['events'], TL['scenes']
n = int(SR * DUR); t = np.arange(n) / SR
rng = np.random.default_rng(3)
BEAT, S16 = 0.4, 0.1

def mf(m): return 440.0 * 2 ** ((m - 69) / 12)
def lp(x, fc, order=2): return sosfilt(butter(order, min(fc, SR / 2.2), 'low', fs=SR, output='sos'), x)
def hp(x, fc, order=2): return sosfilt(butter(order, fc, 'high', fs=SR, output='sos'), x)
def saw(f, k, ph=0.0): return 2 * ((f * np.arange(k) / SR + ph) % 1) - 1
def sqr(f, k, pw=.5): return np.where((f * np.arange(k) / SR) % 1 < pw, 1.0, -1.0)

CH = {'Am': [57, 60, 64], 'F': [53, 57, 60], 'C': [55, 60, 64], 'G': [55, 59, 62], 'Dm': [53, 57, 62],
      'E': [52, 56, 59], 'A': [57, 61, 64], 'D': [54, 57, 62]}
BASS = {'Am': 45, 'F': 41, 'C': 48, 'G': 43, 'Dm': 50, 'E': 40, 'A': 45, 'D': 50}
SEG = [(0.0, 2.8, 'Am'), (2.8, 4.4, 'Am'), (4.4, 6.0, 'F'), (6.0, 7.6, 'C'), (7.6, 9.2, 'G'), (9.2, 10.8, 'Dm'),
       (10.8, 11.6, 'E'), (11.6, 13.2, 'A'), (13.2, 14.4, 'F'), (14.4, 15.2, 'C'), (15.2, 16.0, 'G'), (16.0, 16.6, 'Am'),
       (16.6, 18.0, 'A'), (18.0, 19.35, 'D'), (19.35, 20.0, 'E')]
def chord_at(x):
    for a, b, c in SEG:
        if a <= x < b: return c
    return SEG[-1][2]

out = np.zeros((n, 2))
def add(sig, at, gain, pan=0.0):
    i0 = int(round(at * SR)); m = min(len(sig), n - i0)
    if m <= 0: return
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    out[i0:i0 + m, 0] += sig[:m] * gain * l * 1.414
    out[i0:i0 + m, 1] += sig[:m] * gain * r * 1.414

# sidechain from the kick grid that sfx.wav already plays (every beat from scene 2 to the end of the payoff,
# half-time on the end card)
kicks = list(np.arange(S['lock'][0], S['payoff'][1] - .05, BEAT)) + list(np.arange(S['end'][0], E['outro'], 2 * BEAT))
duck = np.ones(n)
for kt in kicks:
    i0 = int(kt * SR); k = min(int(.35 * SR), n - i0)
    duck[i0:i0 + k] = np.minimum(duck[i0:i0 + k], 1 - .72 * np.exp(-np.arange(k) / SR / .07))

def section(x):
    if x < S['lock'][0]: return 'intro'
    if x < S['nfc'][0]: return 'drive'
    if x < E['unlock']: return 'break'
    if x < S['end'][0]: return 'lift'
    return 'outro'

# ── arpeggio (16ths, two octaves, ping-pong delay)
arp = np.zeros((n, 2))
PAT = [0, 2, 4, 5, 3, 1, 4, 2]
for k in range(int(DUR / S16)):
    x = k * S16; sec = section(x)
    tones = CH[chord_at(x)]; pool = tones + [m + 12 for m in tones]
    m = pool[PAT[k % 8]] + 12
    if sec == 'break' and x >= E['contact']: m += 12 * (k % 2)
    L = .16; kk = int(L * SR)
    f = mf(m)
    s = .6 * saw(f, kk) + .4 * sqr(f * 1.005, kk, .3)
    envl = np.exp(-np.arange(kk) / SR / (.05 if sec != 'outro' else .08))
    if sec == 'intro': fc = 500 + 3000 * (x / S['lock'][0]) ** 2
    elif sec == 'break': fc = 1400 + 2600 * ((x - S['nfc'][0]) / (E['unlock'] - S['nfc'][0])) ** 2
    elif sec == 'outro': fc = 2200 + 3000 * max(0, (x - E['outro']) / (DUR - E['outro']))
    else: fc = 3200
    s = lp(s * envl, fc)
    acc = 1.0 if k % 4 == 0 else .72
    i0 = int(round(x * SR)); mm = min(kk, n - i0)
    pan = .35 if k % 2 else -.35
    arp[i0:i0 + mm, 0] += s[:mm] * acc * (1 - pan) / 2 * 2
    arp[i0:i0 + mm, 1] += s[:mm] * acc * (1 + pan) / 2 * 2
d = int(3 * S16 * SR)
wet = np.zeros_like(arp)
for tap, g in enumerate([.42, .26, .15, .08], 1):
    sh = np.zeros_like(arp); sh[d * tap:] = arp[:-d * tap]
    if tap % 2: sh = sh[:, ::-1]
    wet += sh * g
arp = arp + lp(wet.T, 4500).T
arp_gain = np.interp(t, [0, 2.8, 2.8, 9.8, 11.6, 13.4, 16.6, 20], [.55, .7, .62, .62, .75, .62, .6, .7])
out += arp * arp_gain[:, None] * .5

# ── supersaw pad
pad = np.zeros((n, 2))
for a, b, c in SEG:
    i0, i1 = int(a * SR), int(b * SR); k = i1 - i0
    seg = np.zeros((k, 2))
    for j, m in enumerate(CH[c] + [CH[c][0] + 12]):
        for v, det in enumerate([-.12, -.05, 0, .05, .12]):
            f = mf(m) * 2 ** (det / 12)
            s = saw(f, k, rng.random())
            p = (v - 2) / 2.5
            seg[:, 0] += s * (1 - p) / 2; seg[:, 1] += s * (1 + p) / 2
    a_k, r_k = int(.12 * SR), int(.06 * SR)
    e = np.ones(k); e[:a_k] = np.linspace(0, 1, a_k); e[-r_k:] *= np.linspace(1, 0, r_k)
    pad[i0:i1] += seg * e[:, None]
pad = lp(pad.T, 1700).T / 20
pad_gain = np.interp(t, [0, 2.8, 2.8, 9.8, 10.8, 11.6, 11.6, 16.6, 19.35, 20], [.35, .5, .55, .55, .8, 1.0, .7, .7, .85, .9])
out += pad * (pad_gain * duck)[:, None] * .55

# ── bass (8ths, saw + sub, pumping)
bass = np.zeros(n)
for k in range(int(DUR / (2 * S16))):
    x = k * 2 * S16; sec = section(x)
    if sec in ('intro', 'break'): continue
    if sec == 'outro' and k % 2: continue
    m = BASS[chord_at(x)]
    L = .19 if sec != 'outro' else .38; kk = int(L * SR)
    f = mf(m)
    s = .7 * saw(f, kk) + .6 * np.sin(2 * np.pi * f / 2 * np.arange(kk) / SR) + .3 * saw(f * 2.003, kk)
    envl = np.minimum(1, np.arange(kk) / (.004 * SR)) * np.exp(-np.arange(kk) / SR / .25)
    s = lp(s * envl, 900 if k % 2 else 650)
    i0 = int(round(x * SR)); mm = min(kk, n - i0)
    bass[i0:i0 + mm] += s[:mm] * (1.0 if k % 2 else .8)
bass = np.tanh(bass * 1.4) * duck
out[:, 0] += bass * .42; out[:, 1] += bass * .42

# ── lead melody over the unlock and payoff
LEAD = [(11.6, .4, 69), (12.0, .2, 73), (12.2, .2, 76), (12.4, .8, 81), (13.2, .4, 72), (13.6, .2, 69), (13.8, .6, 72),
        (14.4, .6, 76), (15.0, .2, 74), (15.2, .4, 74), (15.6, .4, 71), (16.0, .2, 72), (16.2, .2, 71), (16.4, .2, 69),
        (16.6, 1.2, 76), (18.0, .8, 74), (18.8, .55, 73)]
lead = np.zeros(n)
for st, du, m in LEAD:
    kk = int((du + .25) * SR); x = np.arange(kk) / SR
    f = mf(m) * (1 + .006 * np.sin(2 * np.pi * 5.5 * x) * np.minimum(1, x / .15))
    ph = np.cumsum(f) / SR
    s = .55 * (2 * (ph % 1) - 1) + .45 * np.where((ph * 1.002) % 1 < .5, 1, -1)
    envl = np.minimum(1, x / .01) * np.where(x < du, 1, np.exp(-(x - du) / .08)) * (.85 + .15 * np.exp(-x / .1))
    s = lp(s * envl, 2600)
    i0 = int(st * SR); mm = min(kk, n - i0)
    lead[i0:i0 + mm] += s[:mm]
dl = int(.3 * SR); lw = np.zeros((n, 2)); lw[dl:, 0] = lead[:-dl] * .35; lw[2 * dl:, 1] = lead[:-2 * dl] * .25
out[:, 0] += lead * .2 + lw[:, 0] * .2; out[:, 1] += lead * .2 + lw[:, 1] * .2

# ── master music bus
out = hp(out.T, 35).T
fk = int(.03 * SR); out[:fk] *= np.linspace(0, 1, fk)[:, None]; out[-fk:] *= np.linspace(1, 0, fk)[:, None]
out /= np.abs(out).max() / .9

def write(name, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(name, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
write('music.wav', out)

with wave.open('sfx.wav') as w:
    sfx = np.frombuffer(w.readframes(w.getnframes()), '<i2').reshape(-1, 2) / 32767.0
mix = sfx[:n] * .8 + out * .62
mix = np.tanh(mix * 1.15) / np.tanh(1.15)
mix /= np.abs(mix).max() / .9
write('mix.wav', mix)
rms = lambda x: 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-12)
print('music rms', round(rms(out), 1), 'mix rms', round(rms(mix), 1))
