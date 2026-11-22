"""Klucz ma Ola – wieczór nauki: szarpane struny (Karplus–Strong) w Es-dur, ciche odgłosy pokoju
(ołówek, kroki, pukanie, kartki, zegar), klucz z kółkiem i ciepły dzwonek przy przyłożeniu.
Wszystko syntezowane, czasy z timeline.json. Pisze mix.wav."""
import json
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 48000
TL = json.load(open('timeline.json'))
DUR, E = TL['duration'], TL['events']
N = int(SR * DUR)
out = np.zeros((N, 2))
send = np.zeros((N, 2))
rng = np.random.default_rng(23)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def bp(x, lo, hi, o=2):
    return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)


def lp(x, fc, o=2):
    return sosfilt(butter(o, fc, 'low', fs=SR, output='sos'), x, axis=0)


def hp(x, fc, o=2):
    return sosfilt(butter(o, fc, 'high', fs=SR, output='sos'), x, axis=0)


def add(sig, t0, g=1.0, pan=0.0, rev=0.35):
    i = int(t0 * SR)
    if i >= N or i < 0:
        return
    m = min(len(sig), N - i)
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    st = np.stack([sig[:m] * l, sig[:m] * r], 1) * 1.414 * g
    out[i:i + m] += st
    send[i:i + m] += st * rev


def pluck(m, dur=2.6, bright=0.5, damp=0.996):
    """Karplus–Strong: miękka, nylonowa struna. Liczone blokami po długości opóźnienia."""
    f = hz(m)
    d = max(2, int(round(SR / f - 0.5)))
    L = int(dur * SR)
    y = np.zeros(L + d + 2)
    burst = rng.uniform(-1, 1, d)
    burst = lp(burst, 700 + 2400 * bright, 2)
    y[1:d + 1] = burst
    s = d + 1
    while s < L + 1:
        e = min(s + d, L + 1)
        k = e - s
        y[s:e] = damp * 0.5 * (y[s - d:s - d + k] + y[s - d - 1:s - d - 1 + k])
        s = e
    y = y[1:L + 1]
    fade = np.ones(L)
    fl = int(0.25 * SR)
    fade[-fl:] = np.linspace(1, 0, fl)
    return y * fade / (np.max(np.abs(y)) + 1e-9)


def bell(m, dur=2.8, g=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 1.1)
    s += 0.45 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t / 0.35)
    s += 0.2 * np.sin(2 * np.pi * 5.4 * f * t) * np.exp(-t / 0.12)
    s *= np.minimum(1, t / 0.003)
    return s * g


def soft_note(m, dur=0.9):
    """Okrągła, cicha nuta (dymki rozmowy)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.08)
    return s * np.exp(-t / 0.28) * np.minimum(1, t / 0.006)


def noise_env(dur, a, d, lo, hi):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = bp(rng.standard_normal(n), lo, hi)
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)
    return s / (np.max(np.abs(s)) + 1e-9) * e


def thump(f0=90, dur=0.2, tau=0.04):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f0 * t * (1 - 0.3 * t / dur)) * np.exp(-t / tau)
    s += 0.5 * noise_env(dur, 0.002, tau * 0.6, 80, 600)
    return s / (np.max(np.abs(s)) + 1e-9)


def knock():
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    s = 0.0
    for f, a, tau in [(210, 1.0, 0.05), (395, 0.6, 0.03), (720, 0.35, 0.018), (1340, 0.15, 0.008)]:
        s = s + a * np.sin(2 * np.pi * f * t) * np.exp(-t / tau)
    s = s + 0.4 * noise_env(0.25, 0.001, 0.01, 300, 3000)
    return s / (np.max(np.abs(s)) + 1e-9)


def jingle(dur=0.6, count=5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for _ in range(count):
        t0 = rng.uniform(0, 0.12)
        i0 = int(t0 * SR)
        f = rng.uniform(3200, 7400)
        tt = t[: n - i0]
        s[i0:] += np.sin(2 * np.pi * f * tt + rng.uniform(0, 6)) * np.exp(-tt / rng.uniform(0.05, 0.14)) * rng.uniform(0.4, 1)
    return s / (np.max(np.abs(s)) + 1e-9)


# ---------------------------------------------------------------- 1) muzyka: arpeggio strun
# Es-dur, spokojne ósemki (76 BPM). Akordy (MIDI) i od kiedy brzmią.
EIGHTH = 60 / 76 / 2
CHORDS = [
    (0.00, [51, 58, 62, 67, 70]),     # Esmaj7 – biurko
    (3.40, [48, 55, 58, 62, 63]),     # Cm9 – ręka sięga
    (6.40, [44, 51, 55, 60, 63]),     # Asmaj7 – idę do drzwi
    (9.30, [46, 53, 55, 62, 65]),     # B6 – rozmowa
    (12.30, [43, 50, 53, 58, 62]),    # Gm7 – czas płynie
    (13.70, [48, 55, 58, 63, 67]),    # Cm7
    (15.20, [44, 51, 58, 60, 63]),    # As(add9) – klucz wraca
]
PATTERN = [0, 2, 3, 4, 3, 2, 1, 3]   # indeksy w akordzie (bas na raz)
music_end = E['tap']
t = 0.0
k = 0
while t < music_end - 0.05:
    chord = [c for c in CHORDS if c[0] <= t + 1e-6][-1][1]
    idx = PATTERN[k % len(PATTERN)]
    m = chord[idx]
    vel = 0.55 if idx == 0 else 0.30 + 0.05 * ((k * 7) % 3)
    if 9.0 < t < 11.9:          # pod dymkami ciszej
        vel *= 0.6
    pan = (-0.35 + 0.7 * idx / 4)
    add(pluck(m, 2.8 if idx == 0 else 1.9, 0.35 + 0.1 * idx), t, 0.20 * vel, pan, 0.45)
    t += EIGHTH
    k += 1

# Przyłożenie klucza: pełny akord Esmaj9 szarpnięty w górę + niskie Es
for j, m in enumerate([39, 46, 55, 62, 65, 70]):
    add(pluck(m, 4.2, 0.55, 0.9975), E['tap'] + 0.02 + j * 0.045, 0.16 if j else 0.2, -0.4 + j * 0.16, 0.55)
# plansza końcowa: łagodny pasaż w górę pentatoniki i jedno szarpnięcie przy „link w bio”
for j, m in enumerate([63, 65, 67, 70, 72, 75]):
    add(pluck(m, 2.4, 0.6, 0.9965), E['logo'] + j * 0.09, 0.09, -0.3 + j * 0.12, 0.6)
add(pluck(70, 2.0, 0.6), E['cta'], 0.08, 0.2, 0.6)

# ciepła, cicha podstawa (sinusy), tylko pod sceną kliku i planszą
n0 = int(E['tap'] * SR)
tt = np.arange(N - n0) / SR
drone = (np.sin(2 * np.pi * hz(39) * tt) * 0.6 + np.sin(2 * np.pi * hz(46) * tt) * 0.4)
drone *= np.minimum(1, tt / 0.8) * np.exp(-tt / 4.5)
add(drone, E['tap'], 0.05, 0, 0.2)

# ---------------------------------------------------------------- 2) odgłosy pokoju
# ołówek
for a, b in E['write']:
    tt0 = a
    while tt0 < b:
        d = rng.uniform(0.06, 0.16)
        add(noise_env(d, 0.01, d / 2.5, 2500, 7000), tt0, 0.035, -0.25, 0.15)
        tt0 += d + rng.uniform(0.05, 0.22)

# palec dotyka telefonu, ekran blokady (dwie spokojne nuty w dół)
add(thump(160, 0.12, 0.015), E['touch'], 0.12, 0.2, 0.1)
add(soft_note(79, 0.9), E['screenOn'], 0.10, 0.1, 0.5)
add(soft_note(74, 1.0), E['screenOn'] + 0.16, 0.10, 0.1, 0.5)

# wstaje (krzesło), kroki, pukanie
add(noise_env(0.45, 0.12, 0.12, 150, 900), E['standUp'], 0.07, 0.2, 0.2)
for i, ts in enumerate(E['steps']):
    add(thump(85, 0.2, 0.035), ts + 0.17, 0.16, (-0.1 if i % 2 else 0.1) + 0.05 * i, 0.15)
for i, ts in enumerate(E['knocks']):
    add(knock(), ts, 0.32 - 0.03 * i, 0.35, 0.3)

# dymki: Ola niżej, ja wyżej; po „osiemnaście” dwie nuty w dół (sytuacyjny uśmiech)
add(soft_note(70), E['bubbleOla1'], 0.11, 0.35, 0.5)
add(soft_note(75), E['bubbleMe'], 0.11, -0.25, 0.5)
add(soft_note(70), E['bubbleOla2'], 0.11, 0.35, 0.5)
add(soft_note(74, 1.0), E['bubbleOla2'] + 0.55, 0.09, 0.1, 0.6)
add(soft_note(70, 1.2), E['bubbleOla2'] + 0.85, 0.09, -0.1, 0.6)

# przejście z powrotem do biurka
add(noise_env(0.7, 0.45, 0.15, 600, 4000), E['fadeBack'] - 0.2, 0.035, 0, 0.4)

# zegar: ciche tyknięcia, gęstsze w środku upływu czasu
c0, c1 = E['clock']
tc = c0
while tc < c1:
    x = (tc - c0) / (c1 - c0)
    add(noise_env(0.02, 0.001, 0.004, 3000, 9000), tc, 0.05, 0.3, 0.2)
    tc += 0.32 - 0.2 * np.sin(np.pi * x)

# kartki
for tf in E['pageFlips']:
    add(noise_env(0.35, 0.12, 0.09, 900, 6000), tf, 0.06, -0.15, 0.3)

# zbliżenie: lekki podmuch
add(noise_env(0.6, 0.35, 0.12, 700, 4500), E['closeIn'] - 0.15, 0.03, 0, 0.4)

# klucz sunie po biurku + kółko z kluczem dzwoni
ka, kb = E['keySlide']
add(noise_env(kb - ka, 0.08, (kb - ka) / 2, 250, 1800), ka, 0.05, 0.4, 0.2)
add(jingle(0.6, 6), ka + 0.05, 0.05, 0.45, 0.4)
add(jingle(0.5, 4), kb - 0.05, 0.04, 0.3, 0.4)
add(soft_note(72), E['bubblePlease'], 0.10, 0.35, 0.5)

# przyłożenie: krótki klik NFC + ciepły dzwonek
add(noise_env(0.03, 0.0005, 0.005, 2500, 9000), E['tap'], 0.18, 0, 0.1)
for j, m in enumerate([75, 79, 82, 86]):
    add(bell(m, 3.0), E['tap'] + 0.03 + j * 0.06, 0.07 - j * 0.01, -0.25 + j * 0.17, 0.6)

# plansza końcowa: dzwonek przy logo
add(bell(82, 2.5), E['logo'], 0.05, 0, 0.6)

# cichy szum pokoju
room = lp(hp(rng.standard_normal((N, 2)), 80), 700) * 0.006
out += room

# ---------------------------------------------------------------- pogłos (krótki pokój + ogon)
k = int(2.2 * SR)
x = np.arange(k) / SR
ir = np.stack([rng.standard_normal(k) * np.exp(-x / 0.45), rng.standard_normal(k) * np.exp(-x / 0.42)], 1)
ir = lp(ir, 4800)
ir /= np.sqrt((ir ** 2).sum(0))
nf = 1 << int(np.ceil(np.log2(N + k)))
wet = np.zeros_like(send)
for ch in range(2):
    wet[:, ch] = np.fft.irfft(np.fft.rfft(send[:, ch], nf) * np.fft.rfft(ir[:, ch], nf), nf)[:N]
mix = hp(out + wet * 0.7, 35)
fk = int(0.2 * SR)
mix[:fk] *= np.linspace(0, 1, fk)[:, None] ** 0.5
fe = int(0.5 * SR)
mix[-fe:] *= np.linspace(1, 0, fe)[:, None]
mix = np.tanh(mix / np.abs(mix).max() * 1.05) / np.tanh(1.05) * 0.9
wavfile.write('mix.wav', SR, (mix * 32767).astype(np.int16))
print('mix.wav', DUR, 's')
