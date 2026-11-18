"""Spokojna oprawa dźwiękowa (styl v2): miękki pad, delikatne plucki na wejściach tekstu, ciepły dzwonek przy kluczu.
Pisze mix.wav. Wszystkie czasy z timeline.json."""
import json, wave
import numpy as np
from scipy.signal import butter, sosfilt

TL = json.load(open('timeline.json'))
SR, DUR = 48000, TL['duration']
S, E, CUES = TL['scenes'], TL['events'], TL['cues']
n = int(SR * DUR); t = np.arange(n) / SR
rng = np.random.default_rng(5)
def lp(x, fc, o=2): return sosfilt(butter(o, fc, 'low', fs=SR, output='sos'), x, axis=0)
def hp(x, fc, o=2): return sosfilt(butter(o, fc, 'high', fs=SR, output='sos'), x, axis=0)
def mf(m): return 440 * 2 ** ((m - 69) / 12)
out = np.zeros((n, 2)); send = np.zeros((n, 2))
def add(sig, at, g, pan=0.0, rev=.4):
    i0 = int(at * SR); m = min(len(sig), n - i0)
    if m <= 0: return
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    st = np.stack([sig[:m] * l, sig[:m] * r], 1) * 1.414 * g
    out[i0:i0 + m] += st; send[i0:i0 + m] += st * rev

# pad: one chord per scene, slow crossfades
CH = [('reach', [50, 57, 61, 64, 66]), ('loop', [47, 54, 57, 61, 64]), ('friction', [43, 50, 54, 59, 62]), ('key', [45, 52, 57, 61, 64]), ('end', [50, 57, 62, 64, 66])]
pad = np.zeros((n, 2))
for name, notes in CH:
    a, b = S[name]; a = max(0, a - .4); b = min(DUR, b + .4)
    i0, i1 = int(a * SR), int(b * SR); k = i1 - i0; x = np.arange(k) / SR
    env = np.minimum(1, x / .6) * np.minimum(1, (k / SR - x) / .6)
    for j, m in enumerate(notes):
        for d, side in ((-.06, 0), (.06, 1)):
            f = mf(m) * 2 ** (d / 12)
            tone = np.sin(2 * np.pi * f * x + j) * .6 + np.sin(2 * np.pi * 2 * f * x) * .12
            pad[i0:i1, side] += tone * env * (1.0 if j else .8)
pad = lp(pad, 1800) * (.75 + .25 * np.sin(2 * np.pi * .12 * t))[:, None]
out += pad * .05; send += pad * .03

# soft sub swell under scene changes
for c in CUES[1:]:
    L = 1.6; x = np.arange(int(L * SR)) / SR
    add(np.sin(2 * np.pi * 55 * x) * np.sin(np.pi * x / L) ** 2, c - .5, .18, 0, .05)

def pluck(at, m, g=.25, pan=0.0, L=1.8):
    x = np.arange(int(L * SR)) / SR; f = mf(m)
    s = (np.sin(2 * np.pi * f * x) + .35 * np.sin(2 * np.pi * 2 * f * x) * np.exp(-x * 6) + .15 * np.sin(2 * np.pi * 3 * f * x) * np.exp(-x * 9))
    s *= np.exp(-x * 3.2) * np.minimum(1, x / .004)
    add(lp(s, 3500), at, g, pan, .55)
# headline entries: short rising motif per scene
MOT = [[74, 78, 81], [71, 74, 78], [67, 71, 74], [69, 73, 76], [74, 78, 81, 86]]
for c, mot in zip(CUES, MOT):
    for j, m in enumerate(mot): pluck(c + .05 + j * .16, m, .16 - j * .02, -.3 + j * .3)
# reflex reaches the phone: a soft tick + glassy note
pluck(E['reachEnd'], 86, .12, .2, 1.2)
# key slides into the loop: warm two-note chime
pluck(E['keyIn'] + .6, 81, .2, 0); pluck(E['keyIn'] + .75, 88, .12, .2)
# NFC tap: soft click + chime + gentle shimmer
L = .03; add(hp(rng.standard_normal(int(L * SR)), 2500) * np.exp(-np.arange(int(L * SR)) / SR / .006), E['tap'], .35, 0, .1)
for j, m in enumerate([74, 81, 86, 90]): pluck(E['tap'] + .04 + j * .07, m, .2 - j * .03, -.2 + j * .15, 2.4)
# airy texture
air = lp(hp(rng.standard_normal((n, 2)), 400), 3000) * .012
out += air

# reverb
k = int(2.6 * SR); x = np.arange(k) / SR
ir = np.stack([rng.standard_normal(k) * np.exp(-x * 2.0), rng.standard_normal(k) * np.exp(-x * 1.9)], 1); ir = lp(ir, 5000); ir /= np.sqrt((ir ** 2).sum(0))
nf = 1 << int(np.ceil(np.log2(n + k))); wet = np.zeros_like(send)
for ch in range(2): wet[:, ch] = np.fft.irfft(np.fft.rfft(send[:, ch], nf) * np.fft.rfft(ir[:, ch], nf), nf)[:n]
mix = hp(out + wet * .8, 30)
fk = int(.25 * SR); mix[:fk] *= np.linspace(0, 1, fk)[:, None] ** .5; fe = int(.45 * SR); mix[-fe:] *= np.linspace(1, 0, fe)[:, None]
mix = np.tanh(mix / np.abs(mix).max() * 1.1) / np.tanh(1.1) * .9
with wave.open('mix.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes())
print('mix.wav ok')
