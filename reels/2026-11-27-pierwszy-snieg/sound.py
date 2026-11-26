"""Pierwszy śnieg – tramwaj o zmierzchu: dzwonek tramwaju, stukot szyn (ta-dam co przęsło, wolniej przy hamowaniu),
szum silnika opadający przy hamowaniu, cichy „tok” blokady, pobrzękiwanie klucza na haczyku, szelest kieszeni.
Gdy bohaterka podnosi wzrok, tramwaj cichnie, a każdy płatek osiadający na szybie to dźwięk celesty (te same czasy
co w reel.mjs). Na przystanku syk hamulca i gong drzwi. Wszystko syntezowane, czasy z timeline.json. Pisze mix.wav."""
import json, wave
import numpy as np
from scipy.signal import butter, sosfilt

TL = json.load(open('timeline.json'))
SR, DUR = 48000, TL['duration']
S, E = TL['scenes'], TL['events']
N = int(SR * DUR); T = np.arange(N) / SR
rnd = np.random.default_rng(2711)


def lp(x, fc, o=2): return sosfilt(butter(o, fc, 'low', fs=SR, output='sos'), x, axis=0)
def hp(x, fc, o=2): return sosfilt(butter(o, fc, 'high', fs=SR, output='sos'), x, axis=0)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x, axis=0)
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
def ease(u): u = np.clip(u, 0, 1); return np.where(u < .5, 4 * u ** 3, 1 - (-2 * u + 2) ** 3 / 2)
def prog(t, a, b): return np.clip((t - a) / (b - a), 0, 1)


out = np.zeros((N, 2)); send = np.zeros((N, 2))


def add(sig, at, g=1.0, pan=0.0, rev=.35):
    i0 = int(at * SR)
    if i0 >= N: return
    if i0 < 0: sig = sig[-i0:]; i0 = 0
    m = min(len(sig), N - i0)
    if m <= 0: return
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    st = np.stack([sig[:m] * l, sig[:m] * r], 1) * 1.414
    out[i0:i0 + m] += st * g; send[i0:i0 + m] += st * g * rev


# ── ruch tramwaju (ta sama funkcja co w reel.mjs)
def speed(t):
    t = np.asarray(t, dtype=float)
    return np.where(t < E['brakeStart'], 1.0, np.where(t >= E['stop'], 0.0, 1 - ease(prog(t, E['brakeStart'], E['stop']))))
V = speed(T); POS = np.cumsum(V) / SR

# „słuchanie” tramwaju: pełne na początku, przycisza się, gdy bohaterka patrzy w okno
focus = ease(prog(T, E['headUp'], E['headUpEnd'] + .8))
tram_g = (1 - .62 * focus) * (1 - prog(T, E['sceneOut'], S['end'][0] + .4))

# ── szum toczenia i wnętrza: brązowy szum, głośniejszy przy prędkości
brown = np.cumsum(rnd.standard_normal((N, 2)), 0); brown = hp(brown, 25); brown /= np.abs(brown).max()
roll = lp(brown, 220) * (.25 + .75 * V)[:, None]
out += roll * (tram_g * .5)[:, None]
cabin = lp(hp(rnd.standard_normal((N, 2)), 300), 1800) * (.15 + .85 * V)[:, None]
out += cabin * (tram_g * .012)[:, None]
out[:int(.03 * SR)] *= np.linspace(0, 1, int(.03 * SR))[:, None]

# ── silnik: cichy buczący ton zależny od prędkości (przy hamowaniu opada)
fm = 70 + 85 * V; ph = 2 * np.pi * np.cumsum(fm) / SR
motor = (np.sin(ph) + .5 * np.sin(2 * ph + .3) + .25 * np.sin(3.01 * ph)) * (.2 + .8 * V)
out += np.stack([motor, motor], 1) * (tram_g * .018)[:, None]
whine = np.sin(2 * np.pi * np.cumsum(420 + 520 * V) / SR) * np.clip((V - .02) * 1.4, 0, 1) * prog(T, E['brakeStart'] - .2, E['brakeStart'] + .4)
out += np.stack([whine * .7, whine], 1) * (tram_g * .006)[:, None]

# ── stukot szyn: dwa uderzenia (przód i tył wózka) co przęsło
def clack(g):
    L = int(.16 * SR); x = np.arange(L) / SR
    thump = np.sin(2 * np.pi * 62 * x) * np.exp(-x / .035)
    tick = bp(rnd.standard_normal(L), 900, 3200) * np.exp(-x / .012)
    return (thump * .9 + tick * .35) * g
rp = TL['railPeriod']; k = 1
while True:
    idx = np.searchsorted(POS, k * rp)
    if idx >= N: break
    t0 = idx / SR; v = V[idx]
    if v < .05: break
    g = float(tram_g[idx]) * (.35 + .65 * v)
    add(clack(g), t0, .32, -.1, .08)
    add(clack(g * .85), t0 + .12 / max(v, .3), .32, .1, .08)
    k += 1

# ── dzwonek tramwaju: metaliczne, nieharmoniczne partie (dwa uderzenia)
def bell(f, dur=1.6):
    L = int(dur * SR); x = np.arange(L) / SR; s = np.zeros(L)
    for r_, a_, d_ in [(1, 1, .9), (2.76, .5, .45), (5.40, .28, .25), (8.93, .15, .14)]:
        s += a_ * np.sin(2 * np.pi * f * r_ * x) * np.exp(-x / d_)
    return s * np.minimum(1, x / .002)
add(bell(1180), E['bell'], .1, .35, .3); add(bell(1180), E['bell'] + .2, .085, .35, .3)

# ── celesta: szklisty dźwięk z szybko gasnącym alikwotem
def celesta(m, dur=2.2, g=1.0):
    L = int(dur * SR); x = np.arange(L) / SR; f = hz(m)
    s = np.sin(2 * np.pi * f * x) * np.exp(-x / .7) + .35 * np.sin(2 * np.pi * 4 * f * x) * np.exp(-x / .09) + .12 * np.sin(2 * np.pi * 2 * f * x) * np.exp(-x / .3)
    return s * np.minimum(1, x / .003) * g

# płatki na szybie: ten sam generator (mulberry32) co w reel.mjs → te same czasy
def mulberry(seed):
    s = [seed & 0xffffffff]
    def f():
        s[0] = (s[0] + 0x6D2B79F5) & 0xffffffff; a = s[0]
        x = ((a ^ (a >> 15)) * (1 | a)) & 0xffffffff
        x = ((x + (((x ^ (x >> 7)) * (61 | x)) & 0xffffffff)) & 0xffffffff) ^ x
        return ((x ^ (x >> 14)) & 0xffffffff) / 4294967296
    return f
r = mulberry(5); WX0, WW = 74, 932; glass = []
for i in range(70):
    gx = WX0 + 20 + r() * (WW - 40); r(); t0 = E['glassFlakes'] + r() * 7.5; r(); r(); kk = r()
    glass.append((t0, gx, kk))
SCALE = [74, 76, 78, 81, 83, 86, 88, 90]  # D-dur pentatonika, wysoko
for t0, gx, kk in sorted(glass):
    if kk > .3: continue
    m = SCALE[int(kk / .3 * len(SCALE)) % len(SCALE)]
    add(celesta(m, 2.0, .05 + .03 * (1 - kk)), t0, 1, float(np.clip((gx - 540) / 470, -.8, .8)), .6)

# ── harmonia: przytłumiony akord przy telefonie, potem otwiera się na D-dur, gdy patrzy w okno
def pad(notes, a, b, g, cutoff):
    e = np.zeros(N); i0, i1 = int(max(0, a) * SR), int(min(DUR, b) * SR); kx = i1 - i0
    x = np.arange(kx) / SR; e[i0:i1] = np.minimum(1, x / .9) * np.minimum(1, (kx / SR - x) / .9)
    sig = np.zeros((N, 2))
    for j, m in enumerate(notes):
        for side, det in ((0, -.07), (1, .07)):
            f = hz(m) * 2 ** (det / 12)
            sig[:, side] += (np.sin(2 * np.pi * f * T + j) + .2 * np.sin(4 * np.pi * f * T)) / (1 + j * .3)
    sig *= (e * (.85 + .15 * np.sin(2 * np.pi * T / 5.3)))[:, None]
    return lp(sig, cutoff) * g
p1 = pad([47, 54, 59, 62], 0, S['window'][0] + .3, .028, 700)          # h-moll, ciemno
p2 = pad([50, 57, 62, 66, 69], S['window'][0] - .2, S['joke'][0] + .4, .03, 1600)   # D-dur, jaśniej
p3 = pad([43, 50, 55, 59, 66], S['joke'][0] - .2, S['end'][0] + .4, .028, 1500)     # G-dur maj7
p4 = pad([50, 57, 62, 64, 69], S['end'][0] - .2, DUR, .032, 1800)                 # D add9
for p_ in (p1, p2, p3, p4): out += p_; send += p_ * .5

# łagodne nuty na każde wejście tekstu (miękkie basowe uderzenie + celesta)
for c_, m_ in zip(TL['cues'][1:], [59, 62, 66, 69, 67, 74]):
    L = int(1.4 * SR); x = np.arange(L) / SR
    add(np.sin(2 * np.pi * hz(m_ - 24) * x) * np.exp(-x / .5) * np.minimum(1, x / .01), c_, .1, 0, .2)
    add(celesta(m_ + 12, 1.6, .08), c_ + .04, 1, -.2, .5)

# ── telefon: cichy szklany „wjazd” karty, „tok” blokady i dwie opadające nuty
L = int(.5 * SR); x = np.arange(L) / SR
add(bp(rnd.standard_normal(L), 1500, 6000) * np.sin(np.pi * x / .5) ** 2, E['cardIn'] - .1, .03, 0, .3)
L = int(.25 * SR); x = np.arange(L) / SR
add((np.sin(2 * np.pi * 180 * x) * np.exp(-x / .04) + .4 * bp(rnd.standard_normal(L), 600, 2400) * np.exp(-x / .01)), E['lockPulse'], .22, 0, .15)
add(celesta(69, 1.4, .1), E['lockPulse'] + .08, 1, 0, .4); add(celesta(66, 1.6, .09), E['lockPulse'] + .3, 1, 0, .4)

# ── klucz na haczyku: drobne metaliczne brzęki w rytmie kołysania
def tink(f, g):
    L = int(.5 * SR); x = np.arange(L) / SR; s = np.zeros(L)
    for r_, a_, d_ in [(1, 1, .12), (2.3, .6, .07), (4.1, .4, .04), (6.7, .25, .025)]: s += a_ * np.sin(2 * np.pi * f * r_ * x) * np.exp(-x / d_)
    return s * g
for j, dt in enumerate([.05, .11, .5, .56, 1.0, 1.52]):
    add(tink(2300 + 400 * rnd.random(), .05 * np.exp(-dt * .9)), E['bubbleIn'] + dt, 1, .3, .3)

# ── telefon do kieszeni: szelest materiału
L = int(.45 * SR); x = np.arange(L) / SR
add(bp(rnd.standard_normal(L), 300, 2500) * np.sin(np.pi * x / .45) ** 1.5 * (1 + .5 * np.sin(2 * np.pi * 23 * x)), E['pocket'], .05, -.2, .1)
# podniesienie wzroku: miękkie wezbranie
L = int(2.0 * SR); x = np.arange(L) / SR
add(np.sin(2 * np.pi * 55 * x) * np.sin(np.pi * x / 2.0) ** 2, E['headUp'] - .3, .12, 0, .05)

# ── przystanek: syk hamulca pneumatycznego i gong drzwi
L = int(1.1 * SR); x = np.arange(L) / SR
add(hp(rnd.standard_normal(L), 2500) * np.minimum(1, x / .03) * np.exp(-x / .35), E['stop'] - .05, .04, .5, .2)
def gong(m, g):
    L = int(1.8 * SR); x = np.arange(L) / SR; f = hz(m)
    return (np.sin(2 * np.pi * f * x) + .25 * np.sin(2 * np.pi * 2.01 * f * x) * np.exp(-x / .3)) * np.exp(-x / .6) * np.minimum(1, x / .004) * g
add(gong(76, .07), E['doorChime'], 1, .25, .4); add(gong(72, .07), E['doorChime'] + .38, 1, .25, .4)

# ── plansza końcowa: trzy wznoszące się nuty celesty i niski ton D
for j, m in enumerate([74, 78, 81, 86]): add(celesta(m, 2.4, .1 - j * .015), S['end'][0] + .15 + j * .18, 1, -.3 + j * .2, .6)
L = int(3.0 * SR); x = np.arange(L) / SR
add(np.sin(2 * np.pi * hz(38) * x) * np.minimum(1, x / .3) * np.exp(-x / 1.6), S['end'][0] + .1, .16, 0, .1)

# ── powietrze
out += lp(hp(rnd.standard_normal((N, 2)), 500), 4000) * .004

# ── pogłos
k_ = int(2.4 * SR); x = np.arange(k_) / SR
ir = np.stack([rnd.standard_normal(k_) * np.exp(-x * 2.2), rnd.standard_normal(k_) * np.exp(-x * 2.1)], 1); ir = lp(ir, 5200); ir /= np.sqrt((ir ** 2).sum(0))
nf = 1 << int(np.ceil(np.log2(N + k_))); wet = np.zeros_like(send)
for ch in range(2): wet[:, ch] = np.fft.irfft(np.fft.rfft(send[:, ch], nf) * np.fft.rfft(ir[:, ch], nf), nf)[:N]
mixd = hp(out + wet * .7, 28)
fe = int(.45 * SR); mixd[-fe:] *= np.linspace(1, 0, fe)[:, None]
mixd = np.tanh(mixd / np.abs(mixd).max() * 1.1) / np.tanh(1.1) * .9
with wave.open('mix.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mixd * 32767).astype('<i2').tobytes())
print('mix.wav ok', len(glass), 'płatków,', sum(1 for g in glass if g[2] <= .3), 'nut celesty,', k - 1, 'stuków')
