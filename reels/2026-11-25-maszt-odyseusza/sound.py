"""Maszt Odyseusza – nocne morze: oddychający burdon d–a, szum fal, plusk wioseł, liryczne szarpnięcia
(harfa addytywna, d-dorycka), cicha pieśń syren (formanty „aa”, z lewej strony), skrzypienie liny i węzeł,
łuk decyzji, klucz odkładany na półkę, zwój liny. Wszystko syntezowane, czasy z timeline.json. Pisze mix.wav."""
import json, wave
import numpy as np
from scipy.signal import butter, sosfilt

TL = json.load(open('timeline.json'))
SR, DUR = 48000, TL['duration']
S, E = TL['scenes'], TL['events']
N = int(SR * DUR); T = np.arange(N) / SR
rng = np.random.default_rng(1925)


def lp(x, fc, o=2): return sosfilt(butter(o, fc, 'low', fs=SR, output='sos'), x, axis=0)
def hp(x, fc, o=2): return sosfilt(butter(o, fc, 'high', fs=SR, output='sos'), x, axis=0)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x, axis=0)
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)


out = np.zeros((N, 2)); send = np.zeros((N, 2))


def add(sig, at, g=1.0, pan=0.0, rev=.35):
    i0 = int(at * SR)
    if i0 >= N: return
    if i0 < 0: sig = sig[-i0:]; i0 = 0
    m = min(len(sig), N - i0)
    if m <= 0: return
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        st = np.stack([sig[:m] * l, sig[:m] * r], 1) * 1.414
    else:
        st = sig[:m]
    out[i0:i0 + m] += st * g; send[i0:i0 + m] += st * g * rev


def env_span(a, b, fade=.6):
    e = np.zeros(N); i0, i1 = int(max(0, a) * SR), int(min(DUR, b) * SR); k = i1 - i0
    x = np.arange(k) / SR; e[i0:i1] = np.minimum(1, x / fade) * np.minimum(1, (k / SR - x) / fade)
    return e


# ── burdon: kwinta d–a, powoli oddycha; od decyzji jaśniejszy, na końcu rozwiązanie
def drone(notes, a, b, g):
    e = env_span(a - .3, b + .3, .9); sig = np.zeros((N, 2))
    for j, m in enumerate(notes):
        for side, det in ((0, -.05), (1, .05)):
            f = hz(m) * 2 ** (det / 12)
            tone = np.sin(2 * np.pi * f * T + j) + .3 * np.sin(2 * np.pi * 2 * f * T + .5) + .12 * np.sin(2 * np.pi * 3 * f * T)
            sig[:, side] += tone * (1 / (1 + j * .35))
    sig *= (e * (.8 + .2 * np.sin(2 * np.pi * T / 4.6)))[:, None]
    return lp(sig, 1400) * g
sea_end = S['mast'][1]
out += drone([38, 45, 50], 0, sea_end, .045); send += drone([38, 45, 50], 0, sea_end, .02)
out += drone([41, 48, 53, 57], S['decision'][0], S['decision'][1], .035)
out += drone([43, 50, 55, 59], S['shelf'][0], S['rope'][1], .032)
out += drone([38, 45, 50, 54, 57], S['end'][0], DUR, .04)

# ── morze: szum z powolnymi falami (stereo, dekorelowane); w pokoju cicho, „zza okna”
noise = rng.standard_normal((N, 2))
swell = .55 + .45 * np.sin(2 * np.pi * T[:, None] / 5.2 + np.array([0.0, 1.3])[None, :]) ** 2
sea = lp(hp(noise, 120), 900) * swell
out += sea * (env_span(0, sea_end - .1, 1.0) * .05)[:, None]
out[:int(.02 * SR)] *= 0  # bez trzasku na starcie
room_sea = lp(hp(rng.standard_normal((N, 2)), 150), 500) * swell
out += room_sea * (env_span(S['shelf'][0], S['rope'][1], 1.0) * .018)[:, None]

# ── wiosła: miękki plusk przy każdym wejściu pióra w wodę
period = TL['oarPeriod']; tt = .35
while tt < sea_end - .4:
    L = int(.35 * SR); x = np.arange(L) / SR
    sp = bp(rng.standard_normal(L), 500, 2600) * np.exp(-x / .07) * np.minimum(1, x / .01)
    add(sp, tt, .09, -.15 + .3 * rng.random(), .25)
    tt += period

# ── harfa: addytywne szarpnięcie, lekko nieharmoniczne
def harp(m, dur=2.6, bright=1.0):
    L = int(dur * SR); x = np.arange(L) / SR; f = hz(m); s = np.zeros(L)
    for k, (amp, dec) in enumerate([(1, 1.4), (.45, .7), (.22, .4), (.12, .25), (.06, .16)], 1):
        s += amp * bright ** (k - 1) * np.sin(2 * np.pi * f * k * (1 + .0007 * k * k) * x) * np.exp(-x / dec)
    return s * np.minimum(1, x / .003) / 1.6
def arp(at, notes, gap=.14, g=.16, pan=-.1, step=.1):
    for j, m in enumerate(notes): add(harp(m), at + j * gap, g * (1 - .08 * j), pan + j * step, .5)

# D dorycka: D E F G A B C
arp(0.05, [62, 69], .22, .15)                       # hasło
arp(S['sirens'][0] + .05, [65, 64, 62], .2, .13)    # syreny „zaczną…”
arp(S['mast'][0] + .05, [57, 62, 64], .16, .14)     # maszt
arp(S['decision'][0] + .05, [62], .2, .12)
arp(E['nodeL'], [69], .2, .11, -.4)
arp(E['nodeL'] + .25, [72], .2, .09, .4)
arp(S['shelf'][0] + .05, [67, 71, 74], .15, .13)    # dziś
arp(S['rope'][0] + .05, [69, 74], .12, .12, .1)     # lina opcjonalna
arp(S['end'][0] + .05, [50, 57, 62, 66, 69, 74], .11, .15, -.3, .12)  # plansza końcowa

# ── pieśń syren: dwa głosy „aa” przez formanty, z lewej (od skał), cicho i łagodnie
def voice(m, dur, g=1.0, glide_from=None):
    L = int(dur * SR); x = np.arange(L) / SR
    f0 = hz(m) * (1 + .012 * np.sin(2 * np.pi * 5.2 * x) * np.minimum(1, x / .35))
    if glide_from is not None: f0 = f0 * (1 + (2 ** ((glide_from - m) / 12) - 1) * np.exp(-x / .08))
    ph = 2 * np.pi * np.cumsum(f0) / SR
    src = sum(np.sin(k * ph) / k for k in range(1, 18))
    v = bp(src, 600, 900) * 1.0 + bp(src, 1000, 1350) * .55 + bp(src, 2400, 2900) * .18
    e = np.minimum(1, x / .18) * np.minimum(1, (dur - x) / .35)
    return v * e * g
mel = [69, 72, 74, 72, 69]
for j, (tn, m) in enumerate(zip(TL['sirenNotes'], mel)):
    prev = mel[j - 1] if j else None
    add(voice(m, .95, 1.0, prev), tn, .07, -.6, .8)
    add(voice(m - 3 if m != 74 else 69, .95, .8, (prev - 3) if prev else None), tn + .03, .045, -.45, .8)

# ── lina: cztery świsty owinięć + skrzypienie, węzeł
wrap = (E['ropeEnd'] - E['ropeStart']) / 3.75
for k in range(4):
    at = E['ropeStart'] + k * wrap; L = int(.3 * SR); x = np.arange(L) / SR
    sw = bp(rng.standard_normal(L), 900 + 300 * k, 3200) * np.sin(np.pi * np.clip(x / .3, 0, 1)) ** 2
    add(sw, at, .05, .1, .2)
for k in range(7):  # skrzypienie: krótkie trzaski drewna/konopi
    at = E['ropeStart'] + .1 + k * .17 + .03 * rng.random(); L = int(.09 * SR); x = np.arange(L) / SR
    rate = 90 + 60 * rng.random(); cl = (np.sin(2 * np.pi * rate * x) > .92).astype(float)
    add(bp(cl * rng.standard_normal(L), 400, 1800) * np.exp(-x / .05), at, .07, .05, .15)
L = int(.5 * SR); x = np.arange(L) / SR
add(np.sin(2 * np.pi * 70 * x) * np.exp(-x / .12) * np.minimum(1, x / .004), E['knot'], .2, 0, .1)
add(harp(57, 2.0, .7), E['knot'] + .02, .07, 0, .4)

# ── łuk decyzji: łagodny wznoszący ton + dzwonek przy dotarciu
L = int((E['arcEnd'] - E['arcDraw']) * SR); x = np.arange(L) / SR
f = hz(62) * 2 ** (7 / 12 * (x / x[-1]) ** .8)
gl = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * x / x[-1]) ** 1.5
add(lp(gl, 2000), E['arcDraw'], .05, -.3, .6)
def bell(m, dur=3.0):
    L = int(dur * SR); x = np.arange(L) / SR; f = hz(m)
    s = np.sin(2 * np.pi * f * x) * np.exp(-x / 1.2) + .4 * np.sin(2 * np.pi * 2.76 * f * x) * np.exp(-x / .35) + .15 * np.sin(2 * np.pi * 5.4 * f * x) * np.exp(-x / .12)
    return s * np.minimum(1, x / .003)
add(bell(81), E['nodeR'], .08, .35, .6)
add(bell(76), E['nodeR'] + .12, .05, .2, .6)

# ── klucz kładziony na półce: drewniane „tok” + krótki błysk
kl = E['keyIn'] + .55; L = int(.25 * SR); x = np.arange(L) / SR
tok = (np.sin(2 * np.pi * 420 * x) * .7 + np.sin(2 * np.pi * 980 * x) * .3) * np.exp(-x / .03) + bp(rng.standard_normal(L), 1500, 5000) * np.exp(-x / .008) * .4
add(tok, kl, .16, .35, .2)
add(bell(86, 2.0), kl + .05, .045, .4, .6)

# ── zwój liny: miękkie szuranie + dwa figlarne szarpnięcia
L = int(.8 * SR); x = np.arange(L) / SR
add(bp(rng.standard_normal(L), 700, 2400) * np.sin(np.pi * x / .8) ** 2, E['coil'], .03, .45, .2)
add(harp(74, 1.6), E['coil'] + .75, .08, .4, .4); add(harp(69, 1.6), E['coil'] + .95, .06, .4, .4)

# ── pogłos
k = int(2.8 * SR); x = np.arange(k) / SR
ir = np.stack([rng.standard_normal(k) * np.exp(-x * 1.8), rng.standard_normal(k) * np.exp(-x * 1.75)], 1); ir = lp(ir, 4500); ir /= np.sqrt((ir ** 2).sum(0))
nf = 1 << int(np.ceil(np.log2(N + k))); wet = np.zeros_like(send)
for ch in range(2): wet[:, ch] = np.fft.irfft(np.fft.rfft(send[:, ch], nf) * np.fft.rfft(ir[:, ch], nf), nf)[:N]
mix = hp(out + wet * .75, 30)
fk = int(.08 * SR); mix[:fk] *= np.linspace(0, 1, fk)[:, None]
fe = int(.5 * SR); mix[-fe:] *= np.linspace(1, 0, fe)[:, None]
mix = np.tanh(mix / np.abs(mix).max() * 1.1) / np.tanh(1.1) * .9
with wave.open('mix.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes())
print('mix.wav ok')
