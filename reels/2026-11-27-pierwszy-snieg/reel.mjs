// Key to Focus – rolka „Pierwszy śnieg” (format C: ilustrowana mini-scenka, styl v2)
// Tramwaj o zmierzchu. Klucz został w domu, Instagram zablokowany – więc pierwszy śnieg ogląda się przez okno.
// node reel.mjs [--still=0,1.5] [--dir=./stills] [--out=./video_noaudio.mp4]
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const TL = JSON.parse(fs.readFileSync(new URL('./timeline.json', import.meta.url)));
const W = 1080, H = 1920, FPS = TL.fps, DUR = TL.duration, S = TL.scenes, E = TL.events;
const fdir = new URL('../../engine/fonts/', import.meta.url).pathname;
for (const [f, a] of [['Manrope-800.ttf', 'M8'], ['Manrope-600.ttf', 'M6'], ['Manrope-400.ttf', 'M4'], ['JetBrainsMono-500.ttf', 'JB5'], ['JetBrainsMono-700.ttf', 'JB7']]) GlobalFonts.registerFromPath(fdir + f, a);

// ── paleta v2 (stała tożsamość: ciemna zieleń + mięta)
const BG0 = [5, 18, 13], BG1 = [11, 36, 27], MINT = [60, 255, 176], SAGE = [150, 214, 188], INK = [234, 247, 241], DIM = [120, 160, 145];
const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (p, q, u) => [0, 1, 2].map(i => Math.round(p[i] + (q[i] - p[i]) * u));
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eOut = t => 1 - Math.pow(1 - t, 3);
const TAU = Math.PI * 2;
const CX = 470;
const mod = (a, n) => ((a % n) + n) % n;
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }

const main = createCanvas(W, H), ctx = main.getContext('2d');
const glow = createCanvas(270, 480);
const grain = (() => { const g = createCanvas(540, 960), x = g.getContext('2d'), id = x.createImageData(540, 960); let s = 7; for (let i = 0; i < id.data.length; i += 4) { s = (s * 16807) % 2147483647; const v = s % 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); return g; })();

const font = (c, fam, size) => { c.font = `${size}px ${fam}`; };
function fit(c, text, fam, max, maxW) { font(c, fam, max); const w = c.measureText(text).width; return w > maxW ? Math.floor(max * maxW / w) : max; }
function text(c, str, x, y, fam, size, col, a = 1, align = 'center') { c.save(); font(c, fam, size); c.textAlign = align; c.textBaseline = 'alphabetic'; c.fillStyle = rgba(col, a); c.fillText(str, x, y); c.restore(); }
function spaced(c, str, x, y, sp, fam, size, col, a = 1, align = 'center') {
  c.save(); font(c, fam, size); c.fillStyle = rgba(col, a);
  const ws = [...str].map(ch => c.measureText(ch).width), tot = ws.reduce((p, q) => p + q, 0) + sp * (str.length - 1);
  let cx = align === 'center' ? x - tot / 2 : align === 'right' ? x - tot : x;
  [...str].forEach((ch, i) => { c.fillText(ch, cx, y); cx += ws[i] + sp; }); c.restore();
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }

// nagłówek: dwie linie, łagodne wejście i wyjście; druga linia miętowa (narzędzie stylu v2)
function headline(c, t, a0, a1, l1, l2, opt = {}) {
  const d = opt.delay || 0;
  const inP = ease(prog(t, a0 + d, a0 + d + .55)), outP = opt.keep ? 0 : prog(t, a1 - .35, a1);
  const first = opt.instant ? 1 : inP;
  const a = first * (1 - outP); if (a <= 0) return;
  const s1 = fit(c, l1, 'M8', opt.size1 || 84, 760), s2 = fit(c, l2, 'M8', opt.size2 || 84, 760);
  const y0 = 372 + (1 - first) * 26 - outP * 18;
  text(c, l1, CX, y0, 'M8', s1, INK, a);
  const in2 = opt.instant ? 1 : ease(prog(t, a0 + d + .35, a0 + d + .95));
  text(c, l2, CX, y0 + s1 * 1.18 + (1 - in2) * 20, 'M8', s2, MINT, in2 * (1 - outP));
}

// ── ruch tramwaju: pełna prędkość, potem łagodne hamowanie do przystanku (ta sama funkcja w sound.py)
const speed = t => t < E.brakeStart ? 1 : t >= E.stop ? 0 : 1 - ease(prog(t, E.brakeStart, E.stop));
const POS = (() => { const dt = 1 / 600, n = Math.ceil(DUR / dt) + 2, a = new Float64Array(n); for (let i = 1; i < n; i++) a[i] = a[i - 1] + speed((i - .5) * dt) * dt; return a; })();
const pos = t => POS[Math.max(0, Math.min(POS.length - 1, Math.round(t * 600)))];

// ── okno tramwaju (świat za szybą rysowany w tym prostokącie)
const WX0 = 74, WY0 = 664, WX1 = 1006, WY1 = 1226, WW = WX1 - WX0, WH = WY1 - WY0;
const GROUND = WY1 - 92;
const snowAmt = t => lerp(.32, 1, ease(prog(t, E.snowRise, E.snowFull)));

// dalsze bloki z oknami (paralaksa .2) i bliższe kamienice (paralaksa .5)
function makeRow(seed, span, minW, maxW, minH, maxH, winP) {
  const r = rng(seed), out = []; let x = 0;
  while (x < span) {
    const w = minW + r() * (maxW - minW), h = minH + r() * (maxH - minH), wins = [];
    const cols = Math.max(1, Math.floor(w / 46)), rows = Math.max(1, Math.floor(h / 58));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (r() < winP) wins.push([i, j, r()]);
    out.push({ x, w, h, cols, rows, wins, roof: r() < .45 }); x += w + 6 + r() * 30;
  }
  return { list: out, span: x };
}
const FAR = makeRow(11, 3200, 110, 240, 120, 300, .32), MID = makeRow(29, 3600, 200, 330, 190, 330, .26);
function rowLayer(c, row, off, base, col, winCol, winA, t) {
  for (const b of row.list) {
    for (const rep of [0, row.span]) {
      const x = WX0 + mod(b.x - off, row.span) - row.span + rep; if (x > WX1 + 10 || x + b.w < WX0 - 10) continue;
      const top = base - b.h;
      c.fillStyle = rgba(col); c.beginPath();
      if (b.roof) { c.moveTo(x, base); c.lineTo(x, top + 30); c.lineTo(x + b.w / 2, top - 10); c.lineTo(x + b.w, top + 30); c.lineTo(x + b.w, base); }
      else c.rect(x, top, b.w, b.h);
      c.fill();
      // śnieg zbiera się na dachach w miarę opadów
      const roofSnow = .5 * ease(prog(t, 4, 15));
      if (roofSnow > 0) { c.strokeStyle = rgba(INK, roofSnow * .55); c.lineWidth = 3; c.beginPath(); if (b.roof) { c.moveTo(x + 2, top + 30); c.lineTo(x + b.w / 2, top - 9); c.lineTo(x + b.w - 2, top + 30); } else { c.moveTo(x + 2, top + 1); c.lineTo(x + b.w - 2, top + 1); } c.stroke(); }
      const cw = b.w / b.cols;
      for (const [i, j, v] of b.wins) {
        const wx = x + i * cw + cw * .3, wy = top + 40 + j * 58; if (wy > base - 30) continue;
        c.fillStyle = rgba(v > .7 ? INK : winCol, winA * (.55 + .45 * v)); c.fillRect(wx, wy, cw * .4, 22);
      }
    }
  }
}

// latarnie (paralaksa 1) – podają światło płatkom
const LAMP_GAP = 560, PX_PER = 230;
function lampXs(t) { const off = pos(t) * PX_PER, xs = []; for (let k = -1; k < 4; k++) xs.push(WX0 + mod(-off, LAMP_GAP) + k * LAMP_GAP + 120); return xs; }
function lamps(c, t, xs) {
  for (const x of xs) {
    if (x < WX0 - 200 || x > WX1 + 200) continue;
    const top = WY0 + 150;
    c.strokeStyle = rgba([4, 15, 11]); c.lineWidth = 9; c.beginPath(); c.moveTo(x, GROUND + 6); c.lineTo(x, top); c.quadraticCurveTo(x, top - 22, x + 40, top - 22); c.stroke();
    const g = c.createRadialGradient(x + 46, top - 12, 4, x + 46, top - 12, 210); g.addColorStop(0, rgba(MINT, .36)); g.addColorStop(.35, rgba(MINT, .1)); g.addColorStop(1, rgba(MINT, 0));
    c.fillStyle = g; c.fillRect(x - 200, top - 230, 500, 470);
    // stożek światła na ziemię
    const cg = c.createLinearGradient(0, top, 0, GROUND); cg.addColorStop(0, rgba(MINT, .1)); cg.addColorStop(1, rgba(MINT, .02));
    c.fillStyle = cg; c.beginPath(); c.moveTo(x + 36, top - 8); c.lineTo(x + 56, top - 8); c.lineTo(x + 170, GROUND); c.lineTo(x - 70, GROUND); c.fill();
    rr(c, x + 30, top - 20, 32, 12, 5); c.fillStyle = rgba(INK, .9); c.fill();
  }
}

// płatki: głębia 0 (daleko, drobne) … 1 (blisko, duże, rozmyte)
const FLAKES = (() => { const r = rng(77), a = []; for (let i = 0; i < 340; i++) { const d = Math.pow(r(), 1.6); a.push({ x: r() * 1400, y: r() * 900, d, ph: r() * TAU, sw: 6 + r() * 16, fr: .5 + r() * .9, rank: r() }); } return a; })();
function snow(c, t, xs, amt, front) {
  const p = pos(t);
  for (const f of FLAKES) {
    if (f.rank > amt) continue;
    if (front !== (f.d > .72)) continue;
    const fall = 46 + f.d * 120, drift = (60 + f.d * 300);
    const x = WX0 - 120 + mod(f.x - p * drift + Math.sin(t * f.fr + f.ph) * f.sw, 1300);
    const y = WY0 - 40 + mod(f.y + t * fall, WH + 80);
    const r = .9 + f.d * 5.5;
    let lit = 0; for (const lx of xs) { const dx = x - (lx + 46), dy = y - (WY0 + 140); lit = Math.max(lit, Math.exp(-(dx * dx + dy * dy) / (2 * 170 * 170))); }
    const a = (.28 + .55 * f.d) * (.55 + .7 * lit) * Math.min(1, (f.rank < amt - .05 ? 1 : (amt - f.rank) / .05));
    c.fillStyle = rgba(mix(SAGE, INK, .4 + .6 * lit), clamp(a));
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    if (f.d > .72) { c.fillStyle = rgba(INK, a * .18); c.beginPath(); c.arc(x, y, r * 2.2, 0, TAU); c.fill(); }
  }
}
// płatki osiadające na szybie – pojawiają się i powoli topnieją
const GLASS = (() => { const r = rng(5), a = []; for (let i = 0; i < 70; i++) a.push({ x: WX0 + 20 + r() * (WW - 40), y: WY0 + 30 + r() * (WH - 60), t0: E.glassFlakes + r() * 7.5, life: 2.6 + r() * 3, s: 1.6 + r() * 2.6, k: r() }); return a; })();
function glassFlakes(c, t) {
  for (const g of GLASS) {
    const u = (t - g.t0) / g.life; if (u <= 0 || u >= 1) continue;
    const a = Math.min(1, u * 8) * (1 - u) * .8, s = g.s * (1 - .4 * u);
    c.strokeStyle = rgba(INK, a); c.lineWidth = 1.3; c.beginPath();
    for (let k = 0; k < 3; k++) { const an = g.k * 3 + k * Math.PI / 3; c.moveTo(g.x - Math.cos(an) * s * 1.6, g.y - Math.sin(an) * s * 1.6); c.lineTo(g.x + Math.cos(an) * s * 1.6, g.y + Math.sin(an) * s * 1.6); }
    c.stroke(); c.fillStyle = rgba(INK, a * .7); c.beginPath(); c.arc(g.x, g.y, s * .55, 0, TAU); c.fill();
  }
}

function outside(c, t) {
  const amt = snowAmt(t), bob = Math.sin(t * 5.4) * 1.2 * speed(t);
  c.save(); rr(c, WX0, WY0, WW, WH, 34); c.clip();
  c.translate(0, bob);
  const sky = c.createLinearGradient(0, WY0, 0, GROUND); sky.addColorStop(0, rgba([7, 24, 18])); sky.addColorStop(1, rgba([22, 64, 49])); c.fillStyle = sky; c.fillRect(WX0, WY0 - 10, WW, WH + 20);
  // niebo za śniegiem lekko się rozjaśnia
  c.fillStyle = rgba(SAGE, .05 * amt); c.fillRect(WX0, WY0 - 10, WW, WH + 20);
  rowLayer(c, FAR, pos(t) * PX_PER * .2, GROUND - 40, [13, 42, 32], SAGE, .22, t);
  snow(c, t, [], amt * .8, false);
  rowLayer(c, MID, pos(t) * PX_PER * .5, GROUND, [8, 28, 21], MINT, .2, t);
  // ulica: z czasem bieleje
  c.fillStyle = rgba([6, 20, 15]); c.fillRect(WX0, GROUND, WW, WY1 - GROUND + 10);
  const g = c.createLinearGradient(0, GROUND, 0, GROUND + 40); g.addColorStop(0, rgba(INK, .06 + .3 * ease(prog(t, 6, 16)))); g.addColorStop(1, rgba(INK, 0)); c.fillStyle = g; c.fillRect(WX0, GROUND, WW, 40);
  const xs = lampXs(t);
  lamps(c, t, xs);
  snow(c, t, xs, amt, false);
  snow(c, t, xs, amt, true);
  c.restore();
}

// ── wnętrze tramwaju
function interior(c, t) {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, rgba([8, 27, 20])); g.addColorStop(.35, rgba(BG1)); g.addColorStop(1, rgba(BG0)); c.fillStyle = g; c.fillRect(0, 0, W, H);
  // drążek pod sufitem i uchwyt (bujają się, przy hamowaniu wychylają do przodu)
  const brake = Math.sin(Math.PI * prog(t, E.brakeStart + .6, E.stop + 1.4)) * .16 * (1 - prog(t, E.stop + .4, E.stop + 1.4) * .4);
  c.strokeStyle = rgba(SAGE, .32); c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(-10, 150); c.lineTo(W + 10, 150); c.stroke();
  for (const [x, ph, len] of [[905, 0, 250], [1045, 1.7, 230]]) {
    const ang = .05 * Math.sin(t * 1.35 + ph) * (.4 + .6 * speed(t)) + brake;
    c.save(); c.translate(x, 150); c.rotate(ang);
    c.strokeStyle = rgba([24, 66, 51]); c.lineWidth = 14; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, len - 30); c.stroke();
    c.strokeStyle = rgba(SAGE, .55); c.lineWidth = 9; c.beginPath(); c.arc(0, len, 30, 0, TAU); c.stroke();
    c.restore();
  }
  // tablica przystanków nad oknem
  const st = t >= E.stop ? 'PRZYSTANEK OGRODOWA' : 'NASTĘPNY: OGRODOWA';
  rr(c, CX - 250, 566, 500, 58, 12); c.fillStyle = rgba([3, 12, 9]); c.fill(); c.strokeStyle = rgba(SAGE, .25); c.lineWidth = 2; c.stroke();
  font(c, 'JB7', 25); c.fillStyle = rgba(MINT, .85); c.textAlign = 'left'; c.fillText('16:40', CX - 228, 604);
  c.textAlign = 'right'; c.fillStyle = rgba(MINT, .75); font(c, 'JB5', 24); c.fillText(st, CX + 228, 604); c.textAlign = 'left';
  // ściana pod oknem
  c.fillStyle = rgba([9, 31, 23]); c.fillRect(0, WY1 + 10, W, H - WY1);
}
function windowFrame(c, t) {
  // odbicie światła na szybie + lekka mgiełka u dołu
  c.save(); rr(c, WX0, WY0, WW, WH, 34); c.clip();
  const fog = c.createLinearGradient(0, WY1 - 160, 0, WY1); fog.addColorStop(0, rgba(SAGE, 0)); fog.addColorStop(1, rgba(SAGE, .1)); c.fillStyle = fog; c.fillRect(WX0, WY1 - 160, WW, 160);
  c.fillStyle = rgba(INK, .035); c.beginPath(); c.moveTo(WX0 + 520, WY0); c.lineTo(WX0 + 640, WY0); c.lineTo(WX0 + 380, WY1); c.lineTo(WX0 + 260, WY1); c.fill();
  c.fillStyle = rgba(INK, .02); c.beginPath(); c.moveTo(WX0 + 680, WY0); c.lineTo(WX0 + 712, WY0); c.lineTo(WX0 + 452, WY1); c.lineTo(WX0 + 420, WY1); c.fill();
  glassFlakes(c, t);
  c.restore();
  c.strokeStyle = rgba([20, 56, 43]); c.lineWidth = 22; rr(c, WX0, WY0, WW, WH, 34); c.stroke();
  c.strokeStyle = rgba(SAGE, .22); c.lineWidth = 2; rr(c, WX0 - 11, WY0 - 11, WW + 22, WH + 22, 44); c.stroke();
  // górny uchylny lufcik i słupek
  c.fillStyle = rgba([20, 56, 43]); c.fillRect(WX0, WY0 + 118, WW, 12); c.fillRect(WX0 + 590, WY0, 14, WH);
}

// ── bohaterka od tyłu: czapka z pomponem, szalik, płaszcz
function heroine(c, t) {
  const up = ease(prog(t, E.headUp, E.headUpEnd)), lean = ease(prog(t, E.headUpEnd + 1.6, E.headUpEnd + 3.4));
  const breathe = Math.sin(t * 1.6) * 2.5;
  const hx = 432 + up * 10 + lean * 14, hy = 1148 + (1 - up) * 34 + breathe * .4, tilt = (1 - up) * .04 + up * .07 + lean * .05;
  // poświata telefonu przed nią
  const ph = 1 - ease(prog(t, E.pocket, E.pocket + .5));
  if (ph > 0) { const g = c.createRadialGradient(440, 1300, 10, 440, 1300, 260); g.addColorStop(0, rgba(MINT, .34 * ph)); g.addColorStop(1, rgba(MINT, 0)); c.fillStyle = g; c.fillRect(160, 1020, 560, 560); }
  // płaszcz
  c.save(); c.translate(0, breathe);
  c.fillStyle = rgba([6, 21, 16]);
  c.beginPath(); c.moveTo(200, H); c.lineTo(214, 1420); c.bezierCurveTo(222, 1330, 280, 1290, 370, 1262); c.lineTo(500, 1262); c.bezierCurveTo(590, 1290, 646, 1330, 654, 1420); c.lineTo(668, H); c.closePath(); c.fill();
  c.strokeStyle = rgba(SAGE, .28); c.lineWidth = 4; c.beginPath(); c.moveTo(216, 1430); c.bezierCurveTo(224, 1336, 282, 1294, 372, 1266); c.moveTo(498, 1266); c.bezierCurveTo(588, 1294, 644, 1336, 652, 1430); c.stroke();
  c.strokeStyle = rgba([12, 36, 28]); c.lineWidth = 3; c.beginPath(); c.moveTo(434, 1300); c.lineTo(438, H); c.stroke();
  // szalik: owinięty + koniec opadający na plecy
  c.fillStyle = rgba([34, 104, 80]);
  rr(c, 334, 1226, 208, 66, 32); c.fill();
  c.beginPath(); c.moveTo(350, 1262); c.bezierCurveTo(336, 1330, 328, 1390, 336, 1452); c.lineTo(384, 1446); c.bezierCurveTo(380, 1390, 380, 1330, 392, 1270); c.fill();
  c.strokeStyle = rgba(SAGE, .3); c.lineWidth = 3;
  for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(352 + k * 40, 1230); c.lineTo(348 + k * 40, 1288); c.stroke(); }
  c.beginPath(); c.moveTo(334, 1420); c.lineTo(384, 1414); c.stroke();
  c.strokeStyle = rgba(SAGE, .5); c.lineWidth = 3; for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(340 + k * 10, 1450); c.lineTo(340 + k * 10, 1470); c.stroke(); }
  c.restore();
  // głowa (tył): włosy gładko zaczesane do warkocza, czapka z wywiniętym ściągaczem
  c.save(); c.translate(hx, hy); c.rotate(tilt);
  const HAIR = [17, 44, 35];
  const hairPath = () => { c.beginPath(); c.moveTo(-84, 0); c.bezierCurveTo(-90, 44, -74, 82, -34, 98); c.quadraticCurveTo(0, 108, 34, 98); c.bezierCurveTo(74, 82, 90, 44, 84, 0); c.closePath(); };
  hairPath(); c.fillStyle = rgba(HAIR); c.fill();
  c.save(); hairPath(); c.clip();
  // pasma zbiegające się do warkocza + miękkie światło od okna z góry
  const hg = c.createLinearGradient(0, 0, 0, 100); hg.addColorStop(0, rgba(SAGE, .16)); hg.addColorStop(1, rgba(SAGE, 0)); c.fillStyle = hg; c.fillRect(-90, 0, 180, 100);
  c.strokeStyle = rgba(SAGE, .22); c.lineWidth = 2; c.lineCap = 'round';
  for (const k of [-70, -50, -30, -12, 12, 30, 50, 70]) { c.beginPath(); c.moveTo(k, 4); c.quadraticCurveTo(k * .75, 60, k * .12, 102); c.stroke(); }
  c.restore();
  hairPath(); c.strokeStyle = rgba(SAGE, .3); c.lineWidth = 2.5; c.stroke();
  // czapka
  c.fillStyle = rgba([30, 78, 61]); c.beginPath(); c.moveTo(-86, -4); c.bezierCurveTo(-84, -96, 84, -96, 86, -4); c.closePath(); c.fill();
  c.strokeStyle = rgba(SAGE, .18); c.lineWidth = 2; for (const k of [-50, -25, 0, 25, 50]) { c.beginPath(); c.moveTo(k * 1.3, -6); c.quadraticCurveTo(k * 1.1, -50, k * .4, -78); c.stroke(); }
  c.fillStyle = rgba(INK, .07); c.beginPath(); c.ellipse(-30, -52, 34, 18, -.5, 0, TAU); c.fill();
  rr(c, -92, -18, 184, 44, 20); c.fillStyle = rgba([42, 102, 80]); c.fill();
  c.save(); rr(c, -92, -18, 184, 44, 20); c.clip();
  c.strokeStyle = rgba([24, 66, 51]); c.lineWidth = 3; for (let k = -84; k <= 84; k += 12) { c.beginPath(); c.moveTo(k, -18); c.lineTo(k, 26); c.stroke(); }
  c.fillStyle = rgba(INK, .08); c.fillRect(-92, -18, 184, 10);
  c.restore();
  // pompon
  const pp = Math.sin(t * 1.35) * 2;
  c.fillStyle = rgba([52, 120, 95]); c.beginPath(); c.arc(pp, -88, 30, 0, TAU); c.fill();
  c.fillStyle = rgba(SAGE, .35); const r = rng(3); for (let k = 0; k < 26; k++) { const a = r() * TAU, d = r() * 24; c.beginPath(); c.arc(pp + Math.cos(a) * d, -88 + Math.sin(a) * d, 2.2, 0, TAU); c.fill(); }
  c.restore();
  // warkocz opada na szalik i plecy (lekko kołysze się z tramwajem)
  const sway = Math.sin(t * 1.35 + .6) * .025 * (.4 + .6 * speed(t));
  c.save(); c.translate(hx + Math.sin(tilt) * -100, hy + 96); c.rotate(-tilt * .5 + sway);
  for (let k = 0; k < 8; k++) {
    const y = 10 + k * 26, w = 24 - k * 1.4, side = k % 2 ? 1 : -1;
    c.save(); c.translate(side * 5, y); c.rotate(side * .45);
    c.beginPath(); c.ellipse(0, 0, w, 19, 0, 0, TAU); c.fillStyle = rgba(HAIR); c.fill();
    c.strokeStyle = rgba(SAGE, .3); c.lineWidth = 2; c.stroke();
    c.beginPath(); c.moveTo(-w * .6, -4); c.quadraticCurveTo(0, 6, w * .6, -2); c.strokeStyle = rgba(SAGE, .18); c.stroke();
    c.restore();
  }
  rr(c, -12, 204, 24, 12, 5); c.fillStyle = rgba(MINT, .8); c.fill();
  c.fillStyle = rgba(HAIR); c.beginPath(); c.moveTo(-12, 214); c.quadraticCurveTo(-18, 244, -4, 260); c.lineTo(4, 260); c.quadraticCurveTo(18, 244, 12, 214); c.fill();
  c.strokeStyle = rgba(SAGE, .25); c.lineWidth = 2; c.beginPath(); c.moveTo(-12, 216); c.quadraticCurveTo(-18, 244, -4, 260); c.moveTo(12, 216); c.quadraticCurveTo(18, 244, 4, 260); c.stroke();
  c.restore();
}
// oparcie siedzenia na pierwszym planie
function seat(c) {
  c.fillStyle = rgba([10, 33, 25]); rr(c, -40, 1590, 1160, 420, 70); c.fill();
  c.strokeStyle = rgba(SAGE, .2); c.lineWidth = 3; rr(c, -20, 1612, 1120, 380, 56); c.setLineDash([10, 12]); c.stroke(); c.setLineDash([]);
  c.strokeStyle = rgba(SAGE, .3); c.lineWidth = 4; c.beginPath(); c.moveTo(30, 1594); c.lineTo(1050, 1594); c.stroke();
}

// ── wstawki: ekran blokady i dymek „klucz w domu”
function phoneCard(c, t) {
  const inP = eOut(prog(t, E.cardIn, E.cardIn + .55)), outP = ease(prog(t, E.cardOut, E.cardOut + .4));
  const a = inP * (1 - outP); if (a <= 0) return;
  const cx = CX, cy = 1060 + (1 - inP) * 70 + outP * 60, w = 330, h = 600, sc = 1 - outP * .12;
  c.save(); c.fillStyle = rgba(BG0, .55 * a); c.fillRect(0, WY0 - 30, W, H); c.restore();
  c.save(); c.globalAlpha *= a; c.translate(cx, cy); c.scale(sc, sc);
  const g = c.createRadialGradient(0, 0, 40, 0, 0, 420); g.addColorStop(0, rgba(MINT, .14)); g.addColorStop(1, rgba(MINT, 0)); c.fillStyle = g; c.fillRect(-420, -420, 840, 840);
  rr(c, -w / 2, -h / 2, w, h, 50); c.fillStyle = rgba([7, 26, 19]); c.fill(); c.strokeStyle = rgba(SAGE, .75); c.lineWidth = 3; c.stroke();
  rr(c, -32, -h / 2 + 20, 64, 11, 6); c.fillStyle = rgba(SAGE, .35); c.fill();
  spaced(c, 'INSTAGRAM', 0, -170, 4, 'JB5', 22, DIM, .9);
  const pulse = 1 + .07 * Math.sin(Math.PI * prog(t, E.lockPulse, E.lockPulse + .45));
  c.save(); c.translate(0, -50); c.scale(pulse, pulse);
  const s = 120; c.strokeStyle = rgba(SAGE); c.lineWidth = s * .1; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-s * .26, -s * .02); c.lineTo(-s * .26, -s * .22); c.arc(0, -s * .22, s * .26, Math.PI, 0); c.lineTo(s * .26, -s * .02); c.stroke();
  rr(c, -s * .42, -s * .04, s * .84, s * .62, s * .12); c.fillStyle = rgba(SAGE, .14); c.fill(); c.stroke();
  c.restore();
  text(c, 'zablokowane', 0, 80, 'M6', 36, INK, 1);
  // klucz NFC: małe fale przy podpowiedzi
  c.strokeStyle = rgba(MINT, .8); c.lineWidth = 3; c.lineCap = 'round';
  for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(-118, 160, 8 + k * 9, -Math.PI * .3, Math.PI * .3); c.stroke(); }
  text(c, 'przyłóż klucz', -78, 170, 'M6', 30, MINT, 1, 'left');
  c.restore();
}
function hookBubble(c, t) {
  const inP = eOut(prog(t, E.bubbleIn, E.bubbleIn + .55)), outP = ease(prog(t, E.bubbleOut, E.bubbleOut + .4));
  const a = inP * (1 - outP); if (a <= 0) return;
  const bx = CX + 160, by = 960, R = 200 * (.86 + .14 * inP);
  c.save(); c.globalAlpha *= a;
  // małe kółka myśli od głowy do dymka
  for (const [k, x, y, r] of [[0, 482, 1022, 8], [1, 500, 986, 12]]) { c.fillStyle = rgba(SAGE, .5 * prog(t, E.bubbleIn + k * .12, E.bubbleIn + .3 + k * .12)); c.beginPath(); c.arc(x, y + 30, r, 0, TAU); c.fill(); }
  c.save(); c.beginPath(); c.arc(bx, by - 120, R, 0, TAU); c.clip();
  const cy = by - 120;
  c.fillStyle = rgba([13, 42, 32]); c.fillRect(bx - R, cy - R, 2 * R, 2 * R);
  // drzwi wejściowe z prawej
  c.fillStyle = rgba([9, 30, 23]); c.fillRect(bx + 96, cy - R, 200, 2 * R);
  c.strokeStyle = rgba(SAGE, .3); c.lineWidth = 4; c.strokeRect(bx + 96, cy - R - 10, 200, 2 * R + 20);
  c.fillStyle = rgba(SAGE, .6); rr(c, bx + 116, cy + 10, 44, 12, 6); c.fill();
  // listwa z haczykami
  rr(c, bx - 200, cy - 100, 270, 24, 8); c.fillStyle = rgba([40, 92, 72]); c.fill();
  c.fillStyle = rgba(SAGE, .8); for (const hx of [bx - 150, bx - 60, bx + 30]) { c.beginPath(); c.arc(hx, cy - 88, 7, 0, TAU); c.fill(); }
  c.strokeStyle = rgba(SAGE, .85); c.lineWidth = 6; c.lineCap = 'round';
  for (const hx of [bx - 150, bx - 60, bx + 30]) { c.beginPath(); c.moveTo(hx, cy - 88); c.lineTo(hx, cy - 64); c.quadraticCurveTo(hx, cy - 52, hx + 12, cy - 58); c.stroke(); }
  // kurtka na pierwszym haczyku
  c.fillStyle = rgba([36, 88, 69]); c.beginPath(); c.moveTo(bx - 150, cy - 62); c.bezierCurveTo(bx - 210, cy - 40, bx - 214, cy + 60, bx - 200, cy + 190); c.lineTo(bx - 104, cy + 190); c.bezierCurveTo(bx - 92, cy + 60, bx - 96, cy - 40, bx - 150, cy - 62); c.fill();
  c.strokeStyle = rgba(SAGE, .25); c.lineWidth = 3; c.beginPath(); c.moveTo(bx - 152, cy - 40); c.lineTo(bx - 152, cy + 186); c.stroke();
  // brelok z kluczem NFC – kołysze się na środkowym haczyku
  const swing = .22 * Math.sin((t - E.bubbleIn) * 3.1) * Math.exp(-(t - E.bubbleIn) * .7) + .02 * Math.sin(t * 2);
  c.save(); c.translate(bx - 54, cy - 58); c.rotate(swing);
  c.strokeStyle = rgba(SAGE, .9); c.lineWidth = 4; c.beginPath(); c.arc(0, 14, 13, 0, TAU); c.stroke();
  rr(c, -30, 28, 60, 128, 18); c.fillStyle = rgba([10, 36, 27]); c.fill(); c.strokeStyle = rgba(MINT, .95); c.lineWidth = 3.5; c.stroke();
  c.beginPath(); c.arc(0, 46, 7, 0, TAU); c.strokeStyle = rgba(SAGE, .6); c.lineWidth = 2.5; c.stroke();
  c.strokeStyle = rgba(MINT, .85); c.lineWidth = 3; c.lineCap = 'round';
  for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(0, 128, 6 + k * 7, -Math.PI * .8, -Math.PI * .2); c.stroke(); }
  c.restore();
  c.restore();
  c.strokeStyle = rgba(MINT, .7); c.lineWidth = 3.5; c.beginPath(); c.arc(bx, by - 120, R, 0, TAU); c.stroke();
  rr(c, bx - 72, by + 44, 144, 46, 23); c.fillStyle = rgba(BG0, .92); c.fill(); c.strokeStyle = rgba(SAGE, .4); c.lineWidth = 2; c.stroke();
  spaced(c, 'W DOMU', bx, by + 76, 4, 'JB7', 22, SAGE, .95);
  c.restore();
}

// ── plansza końcowa (styl v2) – za nią dalej prószy
function endCard(c, t) {
  const [a0] = S.end, lt = t - a0, out = prog(t, DUR - .45, DUR);
  const a = ease(prog(lt, 0, .6)) * (1 - out);
  if (a <= 0) return;
  c.save(); c.globalAlpha *= a;
  c.fillStyle = rgba(BG0); c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(CX, 980, 60, CX, 980, 1100); g.addColorStop(0, rgba(BG1)); g.addColorStop(1, rgba(BG0, 0)); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const r = rng(91); for (let i = 0; i < 70; i++) { const x = mod(r() * W - t * (8 + r() * 14), W), y = mod(r() * H + t * (30 + r() * 50), H), s = 1 + r() * 3; c.fillStyle = rgba(SAGE, .1 + r() * .18); c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill(); }
  const L = 200, cx = CX, cy = 760, R = L / 2, arm = L * .3, rad = L * .15;
  c.strokeStyle = rgba(MINT); c.lineWidth = 12; c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { c.beginPath(); c.moveTo(cx + sx * R, cy + sy * (R - arm)); c.lineTo(cx + sx * R, cy + sy * (R - rad)); c.quadraticCurveTo(cx + sx * R, cy + sy * R, cx + sx * (R - rad), cy + sy * R); c.lineTo(cx + sx * (R - arm), cy + sy * R); c.stroke(); }
  keyGlyph(c, cx + 4, cy + 4, 72, MINT, 1);
  text(c, 'Key to Focus', CX, 990, 'M8', 84, INK, 1);
  text(c, 'Szukam testerów', CX, 1110, 'M8', 62, MINT, ease(prog(lt, .3, .9)));
  text(c, 'Android 8+ · bezpłatnie', CX, 1180, 'M4', 40, SAGE, ease(prog(lt, .5, 1.1)));
  text(c, 'NFC albo kod kreskowy', CX, 1240, 'M4', 40, SAGE, ease(prog(lt, .65, 1.25)));
  const pp = ease(prog(lt, .9, 1.4));
  rr(c, CX - 170, 1296, 340, 88, 44); c.fillStyle = rgba(MINT, .12 * pp); c.fill(); c.strokeStyle = rgba(MINT, pp); c.lineWidth = 3; c.stroke();
  text(c, 'link w bio', CX, 1353, 'M6', 40, INK, pp);
  c.restore();
}
function keyGlyph(c, x, y, s, col, a = 1) {
  c.save(); c.translate(x, y); c.rotate(-Math.PI / 4); c.globalAlpha *= a; c.strokeStyle = rgba(col); c.lineWidth = s * .14; c.lineCap = 'round';
  c.beginPath(); c.arc(-s * .55, 0, s * .32, 0, TAU); c.moveTo(-s * .23, 0); c.lineTo(s * .75, 0); c.moveTo(s * .45, 0); c.lineTo(s * .45, s * .26); c.moveTo(s * .7, 0); c.lineTo(s * .7, s * .2); c.stroke(); c.restore();
}

function softGlow(c) {
  const g = glow.getContext('2d'); g.clearRect(0, 0, 270, 480); g.filter = 'blur(6px)'; g.drawImage(main, 0, 0, 270, 480); g.filter = 'none';
  c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = .26; c.drawImage(glow, 0, 0, W, H); c.restore();
}

function frame(f) {
  const t = f / FPS;
  ctx.save(); ctx.globalAlpha = 1; ctx.setLineDash([]);
  if (t < S.end[0] + .7) {
    // powolny najazd na okno od chwili, gdy podnosi wzrok
    const z = 1 + .055 * ease(prog(t, E.pocket, E.sceneOut + .3));
    ctx.save(); ctx.translate(CX, 1000); ctx.scale(z, z); ctx.translate(-CX, -1000);
    interior(ctx, t); outside(ctx, t); windowFrame(ctx, t); heroine(ctx, t); seat(ctx);
    ctx.restore();
    phoneCard(ctx, t); hookBubble(ctx, t);
    headline(ctx, t, S.hook[0], S.hook[1], 'Zapomniałam klucza.', 'Zobaczyłam pierwszy śnieg.', { instant: true, size2: 78 });
    headline(ctx, t, S.lock[0], S.lock[1], 'Odruchowo: Instagram.', 'Zablokowany.');
    headline(ctx, t, S.home[0], S.home[1], 'Klucz został w domu.', 'Na haczyku.');
    headline(ctx, t, S.window[0], S.window[1], 'Telefon do kieszeni.', 'Patrzę w okno.');
    headline(ctx, t, S.snow[0], S.snow[1], 'Pierwszy śnieg.', 'Na żywo, nie w relacji.');
    headline(ctx, t, S.joke[0], S.joke[1] - .1, 'Relacja będzie.', 'Jak dojadę do klucza.');
    const so = prog(t, E.sceneOut, S.end[0] + .3); if (so > 0) { ctx.fillStyle = rgba(BG0, so); ctx.fillRect(0, 0, W, H); }
  }
  endCard(ctx, t);
  softGlow(ctx);
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .05; ctx.drawImage(grain, 0, 0, W, H); ctx.restore();
  ctx.restore();
}

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
if (args.still) {
  const dir = args.dir || './stills'; fs.mkdirSync(dir, { recursive: true });
  for (const s of String(args.still).split(',')) { frame(Math.round(parseFloat(s) * FPS)); fs.writeFileSync(path.join(dir, `f_${s}.png`), main.toBuffer('image/png')); }
  console.log('stills ok');
} else {
  const out = args.out || './video_noaudio.mp4', total = Math.round(DUR * FPS);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < total; f++) { frame(f); if (!ff.stdin.write(main.data())) await new Promise(r => ff.stdin.once('drain', r)); }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log('done', out);
}
