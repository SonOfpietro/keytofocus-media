"""Po klucz – ciepły, domowy motyw: miękkie FM-pianino, kroki, marimba przy odhaczaniu listy.
Wszystko syntezowane, zsynchronizowane z timeline.json. Pisze mix.wav."""
import json
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
tl = json.load(open('timeline.json'))
DUR = tl['duration']
ev = tl['events']
N = int(SR * DUR)
mix = np.zeros((N, 2))
rng = np.random.default_rng(21)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mix[i:i + len(sig), 0] += sig * gain * l
    mix[i:i + len(sig), 1] += sig * gain * r


def env(n, a, d_tau):
    t = np.arange(n) / SR
    e = np.exp(-t / d_tau)
    na = max(1, int(a * SR))
    e[:na] *= np.linspace(0, 1, na)
    return e


def epiano(m, dur, vel=1.0):
    """Miękkie FM-pianino (Rhodes-podobne)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(m)
    idx = 1.6 * np.exp(-t / 0.35) + 0.15
    s = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t))
    s += 0.25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.5)
    return s * env(n, 0.012, 1.4) * vel


def marimba(m, vel=1.0):
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.32)
    s += 0.35 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t / 0.05)
    s += 0.1 * np.sin(2 * np.pi * 10 * f * t) * np.exp(-t / 0.012)
    return s * env(n, 0.002, 10) * vel


def step(vel=1.0):
    """Kroki: miękki, przytłumiony stuk."""
    n = int(0.18 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    sos = butter(2, [70, 420], btype='band', fs=SR, output='sos')
    s = sosfilt(sos, noise) * np.exp(-t / 0.035)
    s += 0.6 * np.sin(2 * np.pi * 85 * t) * np.exp(-t / 0.04)
    return s / (np.max(np.abs(s)) + 1e-9) * vel


def air(dur, peak, f_lo=900, f_hi=5000):
    """Łagodny podmuch przy zmianie sceny."""
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    sos = butter(2, [f_lo, f_hi], btype='band', fs=SR, output='sos')
    s = sosfilt(sos, rng.standard_normal(n))
    shape = np.where(t < peak, t / peak, (1 - t) / (1 - peak)) ** 2
    return s / (np.max(np.abs(s)) + 1e-9) * shape


def chord(notes, t0, dur, vel=0.5, spread=0.012):
    for k, m in enumerate(notes):
        add(epiano(m, dur, vel), t0 + k * spread, 1.0, pan=(k / max(1, len(notes) - 1) - 0.5) * 0.6)


# 1) Akordy – ciepła, domowa progresja (F-dur)
chord([41, 53, 57, 60, 64], 0.00, 3.4, 0.30)          # Fmaj7
chord([45, 52, 55, 60, 64], 3.00, 3.4, 0.26)          # Am7
chord([43, 50, 55, 59, 62], 6.15, 3.4, 0.26)          # G6/9-ish
chord([38, 50, 53, 57, 64], 9.30, 4.4, 0.32)          # Dm9 – herbata
chord([41, 53, 57, 60, 67, 69], 13.50, 2.2, 0.30)     # Fmaj9 – plansza końcowa

# 2) Kroki w stronę klucza
for i, t in enumerate(np.arange(0.25, 2.6, 0.52)):
    add(step(0.9 - 0.08 * i), t, 0.22, pan=(-0.25 if i % 2 else 0.25))

# 3) Odhaczanie listy – marimba w górę pentatoniki
ticks = [t + 0.45 for t in ev['items']]
for t, m in zip(ticks, [72, 74, 77, 79]):
    add(marimba(m, 0.9), t, 0.32, pan=0.15)
    add(marimba(m + 12, 0.4), t + 0.06, 0.08, pan=-0.2)
add(marimba(67, 0.6), ev['listHead'], 0.18)

# 4) Herbata i „Zapomniałeś” – łagodne opadające dwa dźwięki (sytuacyjny uśmiech)
add(marimba(81, 0.7), ev['forgot'] + 0.1, 0.22, pan=0.2)
add(marimba(76, 0.7), ev['forgot'] + 0.38, 0.22, pan=-0.1)
add(marimba(84, 0.5), ev['standUp'] + 0.1, 0.16)
add(marimba(88, 0.4), ev['standUp'] + 0.25, 0.10)

# 5) Plansza końcowa
for k, m in enumerate([77, 81, 84]):
    add(marimba(m, 0.7), ev['logo'] + k * 0.11, 0.2, pan=(k - 1) * 0.3)
add(marimba(89, 0.5), ev['cta'], 0.14)

# 6) Podmuchy przy zmianach scen
for t in [2.75, 9.05, 13.25]:
    add(air(0.7, 0.6), t, 0.05)

# 7) Delikatne tło „pokoju” (ciche szumy niskie)
room = sosfilt(butter(2, [120, 900], btype='band', fs=SR, output='sos'), rng.standard_normal(N))
room = room / np.max(np.abs(room)) * 0.012
mix[:, 0] += room
mix[:, 1] += np.roll(room, 997)

# Pogłos
ir_n = int(2.2 * SR)
tt = np.arange(ir_n) / SR
ir = rng.standard_normal((ir_n, 2)) * np.exp(-tt / 0.55)[:, None]
ir = sosfilt(butter(1, 5500, fs=SR, output='sos'), ir, axis=0)
ir /= np.sqrt(np.sum(ir ** 2, axis=0))
wet = np.stack([fftconvolve(mix[:, c], ir[:, c])[:N] for c in range(2)], axis=1)
out = mix * 0.82 + wet * 0.42

# Wyciszenie końcówki
fade = int(0.45 * SR)
out[-fade:] *= np.linspace(1, 0, fade)[:, None]
out /= np.max(np.abs(out)) + 1e-9
out *= 0.8
wavfile.write('mix.wav', SR, (out * 32767).astype(np.int16))
print('mix.wav', round(DUR, 2), 's')
