// Key to Focus – rolka „Maszt Odyseusza” (format A: spokojna animacja-wyjaśnienie, styl v2)
// Myśl: decyzję podejmujesz, gdy jesteś spokojny (Homer, Odyseja XII; J. Elster, Ulysses and the Sirens, 1979).
// node reel.mjs [--still=0,1.5] [--dir=./stills] [--out=./video_noaudio.mp4]
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const TL = JSON.parse(fs.readFileSync(new URL('./timeline.json', import.meta.url)));
const W = 1080, H = 1920, FPS = TL.fps, DUR = TL.duration, S = TL.scenes, E = TL.events;
const fdir = new URL('../../engine/fonts/', import.meta.url).pathname;
for (const [f, a] of [['Manrope-800.ttf', 'M8'], ['Manrope-600.ttf', 'M6'], ['Manrope-400.ttf', 'M4'], ['JetBrainsMono-500.ttf', 'JB5'], ['JetBrainsMono-700.ttf', 'JB7']]) GlobalFonts.registerFromPath(fdir + f, a);

// ── narzędzia stylu v2 (paleta, fonty, tekst) – jak we wzorcu petla-nawyku
const BG0 = [5, 18, 13], BG1 = [11, 36, 27], HULL = [9, 30, 22], MINT = [60, 255, 176], SAGE = [150, 214, 188], INK = [234, 247, 241], DIM = [120, 160, 145];
const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eOut = t => 1 - Math.pow(1 - t, 3);
const TAU = Math.PI * 2;
const CX = 470;

const main = createCanvas(W, H), ctx = main.getContext('2d');
const glow = createCanvas(270, 480);
const grain = (() => { const g = createCanvas(540, 960), x = g.getContext('2d'), id = x.createImageData(540, 960); let s = 11; for (let i = 0; i < id.data.length; i += 4) { s = (s * 16807) % 2147483647; const v = s % 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); return g; })();

const font = (c, fam, size) => { c.font = `${size}px ${fam}`; };
function fit(c, str, fam, max, maxW) { font(c, fam, max); const w = c.measureText(str).width; return w > maxW ? Math.floor(max * maxW / w) : max; }
function text(c, str, x, y, fam, size, col, a = 1, align = 'center') { if (a <= 0) return; c.save(); font(c, fam, size); c.textAlign = align; c.textBaseline = 'alphabetic'; c.fillStyle = rgba(col, a); c.fillText(str, x, y); c.restore(); }
function spaced(c, str, x, y, sp, fam, size, col, a = 1, align = 'center') {
  if (a <= 0) return;
  c.save(); font(c, fam, size); c.fillStyle = rgba(col, a);
  const ws = [...str].map(ch => c.measureText(ch).width), tot = ws.reduce((p, q) => p + q, 0) + sp * ([...str].length - 1);
  let cx = align === 'center' ? x - tot / 2 : align === 'right' ? x - tot : x;
  [...str].forEach((ch, i) => { c.fillText(ch, cx, y); cx += ws[i] + sp; }); c.restore();
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }

// nagłówek: dwie linie, łagodne wejście i wyjście; druga linia miętowa
function headline(c, t, a0, a1, l1, l2, opt = {}) {
  const d = opt.delay || 0;
  const inP = opt.instant ? 1 : ease(prog(t, a0 + d, a0 + d + .55)), outP = prog(t, a1 - .35, a1);
  const a = inP * (1 - outP); if (a <= 0) return;
  const s1 = fit(c, l1, 'M8', opt.size1 || 86, 760), s2 = l2 ? fit(c, l2, 'M8', opt.size2 || 86, 760) : 0;
  const y0 = (opt.y || 400) + (1 - inP) * 24 - outP * 16;
  text(c, l1, CX, y0, 'M8', s1, INK, a);
  if (!l2) return;
  const in2 = opt.instant ? 1 : ease(prog(t, a0 + d + .35, a0 + d + .95));
  text(c, l2, CX, y0 + s1 * 1.18 + (1 - in2) * 18, 'M8', s2, MINT, in2 * (1 - outP));
}

// ── tło: noc nad morzem (nowe dla tej rolki)
function background(c) {
  c.fillStyle = rgba(BG0); c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(CX, 1150, 80, CX, 1150, 1150); g.addColorStop(0, rgba(BG1)); g.addColorStop(1, rgba(BG0, 0));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}
const STARS = (() => { let s = 97; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; const out = []; for (let i = 0; i < 46; i++) out.push({ x: 50 + r() * 980, y: 610 + r() * 520, s: 1.2 + r() * 1.6, ph: r() * TAU, a: .12 + r() * .25 }); return out; })();
function sky(c, t, a) {
  if (a <= 0) return;
  c.save(); c.globalAlpha *= a;
  for (const st of STARS) { c.fillStyle = rgba(SAGE, st.a * (.7 + .3 * Math.sin(t * 1.3 + st.ph))); c.beginPath(); c.arc(st.x, st.y, st.s, 0, TAU); c.fill(); }
  crescent(c, 800, 700, 40, .75);
  c.restore();
}
function crescent(c, x, y, r, a) {
  c.save(); c.fillStyle = rgba(SAGE, a);
  c.beginPath(); c.arc(x, y, r, -Math.PI / 2, Math.PI / 2, false); c.ellipse(x, y, r * .42, r, 0, Math.PI / 2, -Math.PI / 2, true); c.fill();
  const g = c.createRadialGradient(x, y, r * .6, x, y, r * 3); g.addColorStop(0, rgba(SAGE, .08 * a)); g.addColorStop(1, rgba(SAGE, 0));
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 3, 0, TAU); c.fill(); c.restore();
}

// morze: linie fal gęstnieją ku horyzontowi
const HY = 1180, WATER = 1244;
const seaY = k => HY + 6 + Math.pow(k, 1.45) * 16;
function seaLine(c, t, k) {
  const y = seaY(k), amp = 1.4 + k * 1.25, lam = 90 + k * 32, sp = .55 + k * .06;
  c.strokeStyle = rgba(SAGE, k === 0 ? .5 : .09 + k * .032); c.lineWidth = k === 0 ? 2.5 : 2 + k * .14;
  c.beginPath();
  for (let x = -20; x <= W + 20; x += 12) { const yy = y + Math.sin(x / lam * TAU + t * sp * TAU * .25 + k * 1.7) * amp; x === -20 ? c.moveTo(x, yy) : c.lineTo(x, yy); }
  c.stroke();
}
function seaBack(c, t) { for (let k = 0; k <= 10; k++) if (seaY(k) < WATER - 6) seaLine(c, t, k); }
function seaFront(c, t) { for (let k = 0; k <= 10; k++) if (seaY(k) >= WATER - 6) seaLine(c, t, k); }

// skały syren na horyzoncie
const ROCKS = [[24, 1183], [52, 1146], [88, 1154], [126, 1104], [168, 1132], [206, 1116], [242, 1150], [276, 1183]];
const SIREN = [168, 1100];
function rocks(c, t, a, pulse) {
  if (a <= 0) return;
  c.save(); c.globalAlpha *= a;
  c.beginPath(); ROCKS.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
  c.fillStyle = rgba(HULL); c.fill(); c.strokeStyle = rgba(SAGE, .6); c.lineWidth = 3; c.lineJoin = 'round'; c.stroke();
  for (const [x, y, ph] of [[126, 1090, 0], [206, 1102, 1.9]]) {
    const b = .55 + .25 * Math.sin(t * 1.6 + ph) + .4 * pulse;
    const g = c.createRadialGradient(x, y, 0, x, y, 34); g.addColorStop(0, rgba(MINT, .35 * b)); g.addColorStop(1, rgba(MINT, 0));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, 34, 0, TAU); c.fill();
    c.fillStyle = rgba(MINT, .9 * clamp(b)); c.beginPath(); c.arc(x, y, 5.5, 0, TAU); c.fill();
  }
  c.restore();
}
// pieśń: każda nuta wysyła łuk w stronę statku
function songArcs(c, t, a) {
  if (a <= 0) return 0;
  let near = 0; const dir = Math.atan2(1060 - SIREN[1], 470 - SIREN[0]);
  c.save(); c.globalAlpha *= a; c.lineCap = 'round';
  for (const tn of TL.sirenNotes) {
    const dt = t - tn; if (dt < 0 || dt > 2.2) continue;
    const r = 26 + dt * 280, al = .75 * Math.pow(1 - dt / 2.2, 1.4) * prog(dt, 0, .12);
    for (const [w, k] of [[3, 1], [10, .18]]) { c.strokeStyle = rgba(MINT, al * k); c.lineWidth = w; c.beginPath(); c.arc(SIREN[0], SIREN[1], r, dir - .4, dir + .4); c.stroke(); }
    near = Math.max(near, al * Math.exp(-Math.pow((r - 305) / 70, 2)));
  }
  c.restore();
  return near;
}

// statek (układ lokalny: środek pokładu = 0,0; linia wody ≈ y 48)
function ship(c, t, a, opt = {}) {
  if (a <= 0) return;
  const bob = Math.sin(t * 1.25) * 5, rot = Math.sin(t * 1.05 + .6) * .012;
  c.save(); c.globalAlpha *= a;
  // kadłub i wszystko nad wodą – przycięte do linii wody
  c.save(); c.beginPath(); c.rect(0, 0, W, WATER + Math.sin(t * 1.4) * 2); c.clip();
  c.translate(470, 1196 + bob); c.rotate(rot);
  c.lineJoin = 'round'; c.lineCap = 'round';
  // olinowanie
  c.strokeStyle = rgba(SAGE, .35); c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, -436); c.lineTo(236, -26); c.moveTo(0, -436); c.lineTo(-228, -12); c.stroke();
  // kadłub
  c.beginPath(); c.moveTo(-232, -8); c.quadraticCurveTo(-205, 58, -120, 64); c.lineTo(130, 64); c.quadraticCurveTo(212, 58, 244, -22); c.quadraticCurveTo(10, 8, -232, -8); c.closePath();
  c.fillStyle = rgba(HULL); c.fill(); c.strokeStyle = rgba(MINT, .95); c.lineWidth = 4; c.stroke();
  // rufa zawinięta, dziób z okiem
  c.beginPath(); c.moveTo(-232, -8); c.quadraticCurveTo(-266, -40, -252, -80); c.arc(-238, -80, 14, Math.PI, Math.PI * 2.2); c.stroke();
  c.beginPath(); c.moveTo(244, -22); c.lineTo(262, -58); c.stroke();
  c.beginPath(); c.ellipse(204, 14, 11, 6, -.25, 0, TAU); c.strokeStyle = rgba(SAGE, .8); c.lineWidth = 2.5; c.stroke();
  c.fillStyle = rgba(SAGE, .8); c.beginPath(); c.arc(205, 14, 2.6, 0, TAU); c.fill();
  // otwory na wiosła
  for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(-150 + i * 60, 28, 7, 0, TAU); c.strokeStyle = rgba(SAGE, .55); c.lineWidth = 2.5; c.stroke(); }
  // maszt, reja, zwinięty żagiel
  c.strokeStyle = rgba(MINT, .95); c.lineWidth = 6; c.beginPath(); c.moveTo(0, 2); c.lineTo(0, -440); c.stroke();
  c.beginPath(); c.arc(0, -446, 7, 0, TAU); c.lineWidth = 3; c.stroke();
  c.strokeStyle = rgba(SAGE, .8); c.lineWidth = 4; c.beginPath(); c.moveTo(-165, -384); c.quadraticCurveTo(0, -396, 165, -384); c.stroke();
  c.strokeStyle = rgba(SAGE, .28); c.lineWidth = 15; c.beginPath(); c.moveTo(-150, -374); c.quadraticCurveTo(0, -385, 150, -374); c.stroke();
  // lina – tylne odcinki
  const rp = opt.rope || 0, glowR = opt.ropeGlow || 0;
  if (rp > 0) ropeHelix(c, rp, false, glowR);
  // Odyseusz przy maszcie
  const look = opt.look || 0;
  c.save();
  // nogi stykają się, więc maszt za nimi nie udaje trzeciej nogi
  for (const lx of [-14, 0]) { rr(c, lx, -92, 14, 90, 6); c.fillStyle = rgba(BG1); c.fill(); c.strokeStyle = rgba(SAGE, .95); c.lineWidth = 3; c.stroke(); }
  // tunika do kolan
  c.beginPath(); c.moveTo(-17, -238); c.lineTo(17, -238); c.quadraticCurveTo(22, -238, 22, -228); c.lineTo(26, -86); c.quadraticCurveTo(0, -80, -26, -86); c.lineTo(-22, -228); c.quadraticCurveTo(-22, -238, -17, -238); c.closePath();
  c.fillStyle = rgba(BG1); c.fill(); c.strokeStyle = rgba(SAGE, .95); c.lineWidth = 3; c.stroke();
  c.translate(0, -259); c.rotate(-look * .18);
  c.beginPath(); c.arc(0, 0, 19, 0, TAU); c.fillStyle = rgba(SAGE, .95); c.fill();
  c.restore();
  if (rp > 0) ropeHelix(c, rp, true, glowR);
  if (opt.knot > 0) {
    const k = opt.knot, [ex, ey] = helixPt(ROPE.turns * TAU);
    c.strokeStyle = rgba(MINT, k); c.lineWidth = 5;
    c.beginPath(); c.arc(ex, ey + 2, 6, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(ex - 3, ey + 7); c.quadraticCurveTo(ex - 8, ey + 20, ex - 6, ey + 22 + 18 * k); c.moveTo(ex + 3, ey + 7); c.quadraticCurveTo(ex + 9, ey + 18, ex + 8, ey + 20 + 14 * k); c.stroke();
  }
  c.restore();
  // wiosła (wychodzą pod wodę)
  c.save(); c.translate(470, 1196 + bob); c.rotate(rot); c.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const ph = t / TL.oarPeriod * TAU + i * .25, x0 = -150 + i * 60, y0 = 28;
    const x1 = x0 - 46 + Math.cos(ph) * 26, y1 = 104 + Math.sin(ph) * 10;
    c.strokeStyle = rgba(SAGE, .5); c.lineWidth = 3; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    // zmarszczka w miejscu wejścia do wody
    const u = (48 - y0) / (y1 - y0), wx = x0 + (x1 - x0) * u;
    c.strokeStyle = rgba(SAGE, .22 + .12 * Math.sin(ph)); c.lineWidth = 2; c.beginPath(); c.ellipse(wx, 50, 14, 3, 0, 0, TAU); c.stroke();
  }
  c.restore();
  c.restore();
}
const ROPE = { rx: 33, ry: 8, y0: -222, y1: -140, turns: 3.75 };
function helixPt(th) { const slope = (ROPE.y1 - ROPE.y0) / (ROPE.turns * TAU); return [ROPE.rx * Math.cos(th + Math.PI), ROPE.y0 + slope * th + ROPE.ry * Math.sin(th + Math.PI)]; }
function ropeHelix(c, p, front, glowR) {
  const max = ROPE.turns * TAU * p, step = .08;
  c.save(); c.lineCap = 'round';
  c.strokeStyle = front ? rgba(MINT, .85 + .15 * glowR) : rgba(SAGE, .4); c.lineWidth = front ? 6 : 5;
  if (front && glowR > 0) { c.shadowColor = rgba(MINT, .8); c.shadowBlur = 18 * glowR; }
  let drawing = false; c.beginPath();
  for (let th = 0; th <= max + 1e-6; th += step) {
    const isFront = Math.sin(th + Math.PI) > 0, [x, y] = helixPt(Math.min(th, max));
    if (isFront === front) { drawing ? c.lineTo(x, y) : c.moveTo(x, y); drawing = true; } else drawing = false;
  }
  c.stroke(); c.restore();
}

// ── sceny 1–3: morze
function seaWorld(c, t) {
  const out = prog(t, S.mast[1] - .45, S.mast[1]); if (out >= 1) return;
  const z = lerp(1, 1.28, ease(prog(t, E.zoomStart, E.zoomEnd)));
  const rocksA = ease(prog(t, E.rocksIn, E.rocksIn + 1.0));
  const rope = ease(prog(t, E.ropeStart, E.ropeEnd)), knot = eOut(prog(t, E.knot, E.knot + .45));
  c.save(); c.globalAlpha *= 1 - out;
  c.translate(470, 1060); c.scale(z, z); c.translate(-470, -1060);
  sky(c, t, 1);
  seaBack(c, t);
  rocks(c, t, rocksA, 0);
  const near = songArcs(c, t, 1);
  // pieśń dociera do statku: głowa lekko w stronę skał, lina mocniej świeci
  const look = clamp(near * 1.6) * .8 + .2 * rocksA * prog(t, 4.2, 5.2);
  ship(c, t, 1, { rope, knot, look, ropeGlow: clamp(near * 1.8) });
  seaFront(c, t);
  c.restore();
}
function sceneText1(c, t) {
  const [a0, a1] = S.hook;
  const out = prog(t, a1 - .35, a1);
  spaced(c, 'HOMER · ODYSEJA, PIEŚŃ XII', CX, 278, 4, 'JB5', 26, SAGE, .8 * (1 - out));
  headline(c, t, a0, a1, 'Odyseusz też', 'nie ufał sobie.', { instant: true, size1: 98, size2: 98, y: 410 });
}
function sceneText2(c, t) {
  const [a0, a1] = S.sirens;
  headline(c, t, a0, a1, 'Wiedział, że syreny', 'zaczną śpiewać.', { size1: 82, size2: 82 });
}
function sceneText3(c, t) {
  const [a0, a1] = S.mast;
  headline(c, t, a0, a1, 'Więc kazał się', 'przywiązać do masztu.', { size1: 82, size2: 78 });
  const cap = prog(t, E.ropeStart + .2, E.ropeStart + .7) * (1 - prog(t, a1 - .4, a1));
  spaced(c, 'ZANIM ZACZĘŁY', CX, 1420, 5, 'JB7', 26, MINT, .85 * cap);
}

// ── scena 4: decyzja zapada w spokoju
const AX = { y: 1060, x0: 110, x1: 830, L: 235, R: 705 };
function axisY(x, t) { const w = clamp((x - 430) / 300); return AX.y + Math.sin(x / 34 + t * 2.2) * 26 * w * w; }
function sceneDecision(c, t) {
  const [a0, a1] = S.decision, out = prog(t, a1 - .4, a1);
  const fin = ease(prog(t, a0, a0 + .5));
  c.save(); c.globalAlpha *= fin * (1 - out);
  // oś czasu: spokojna woda po lewej, fale pokusy po prawej
  const draw = ease(prog(t, E.axisStart, E.axisStart + .9)), xe = lerp(AX.x0, AX.x1, draw);
  c.strokeStyle = rgba(SAGE, .7); c.lineWidth = 4; c.lineCap = 'round'; c.beginPath();
  for (let x = AX.x0; x <= xe; x += 6) { const y = axisY(x, t); x === AX.x0 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke();
  // lewy węzeł: SPOKÓJ
  const nl = eOut(prog(t, E.nodeL, E.nodeL + .5));
  if (nl > 0) {
    c.save(); c.translate(AX.L, AX.y); c.scale(lerp(.6, 1, nl), lerp(.6, 1, nl)); c.globalAlpha *= nl;
    c.beginPath(); c.arc(0, 0, 58, 0, TAU); c.fillStyle = rgba(HULL); c.fill(); c.strokeStyle = rgba(MINT, .9); c.lineWidth = 3.5; c.stroke();
    c.strokeStyle = rgba(SAGE, .9); c.lineWidth = 4; c.beginPath(); c.moveTo(-26, 10); c.lineTo(26, 10); c.stroke();
    c.beginPath(); c.arc(0, 4, 16, Math.PI, 0); c.stroke();
    c.restore();
    spaced(c, 'SPOKÓJ', AX.L, AX.y + 112, 5, 'JB7', 26, SAGE, .9 * nl);
  }
  // prawy węzeł: POKUSA
  const nrIn = eOut(prog(t, E.nodeL + .25, E.nodeL + .75));
  if (nrIn > 0) {
    const ry = axisY(AX.R, t);
    c.save(); c.translate(AX.R, ry); c.globalAlpha *= nrIn;
    c.beginPath(); c.arc(0, 0, 58, 0, TAU); c.fillStyle = rgba(HULL); c.fill(); c.strokeStyle = rgba(SAGE, .8); c.lineWidth = 3.5; c.stroke();
    c.strokeStyle = rgba(MINT, .8); c.lineWidth = 3.5; c.lineCap = 'round';
    for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(-22, 0, 12 + k * 13, -.6, .6); c.stroke(); }
    c.restore();
    spaced(c, 'POKUSA', AX.R, AX.y + 112, 5, 'JB7', 26, SAGE, .9 * nrIn);
  }
  // łuk decyzji z lewa na prawo
  const ap = ease(prog(t, E.arcDraw, E.arcEnd));
  if (ap > 0) {
    const P0 = [AX.L + 30, AX.y - 66], C = [CX, 800], P1 = [AX.R - 30, AX.y - 66];
    const bz = u => [(1 - u) ** 2 * P0[0] + 2 * (1 - u) * u * C[0] + u * u * P1[0], (1 - u) ** 2 * P0[1] + 2 * (1 - u) * u * C[1] + u * u * P1[1]];
    c.save(); c.strokeStyle = rgba(MINT, .9); c.lineWidth = 5; c.lineCap = 'round'; c.setLineDash([3, 15]);
    c.beginPath(); for (let k = 0; k <= 80; k++) { const [x, y] = bz(k / 80 * ap); k ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.setLineDash([]);
    const [hx, hy] = bz(ap), [px, py] = bz(Math.max(0, ap - .02)), an = Math.atan2(hy - py, hx - px);
    c.fillStyle = rgba(MINT); c.beginPath(); c.moveTo(hx + Math.cos(an) * 16, hy + Math.sin(an) * 16); c.lineTo(hx + Math.cos(an + 2.5) * 16, hy + Math.sin(an + 2.5) * 16); c.lineTo(hx + Math.cos(an - 2.5) * 16, hy + Math.sin(an - 2.5) * 16); c.fill();
    c.restore();
    spaced(c, 'DECYZJA', CX, 862, 6, 'JB7', 28, MINT, .95 * prog(t, E.arcDraw + .3, E.arcDraw + .8));
  }
  // decyzja dociera: prawy węzeł się uspokaja (pierścień)
  const hit = t - E.nodeR;
  if (hit > 0 && hit < 1.4) { const p = hit / 1.4; c.strokeStyle = rgba(MINT, .55 * (1 - p)); c.lineWidth = 3; c.beginPath(); c.arc(AX.R, axisY(AX.R, t), 60 + p * 120, 0, TAU); c.stroke(); }
  c.restore();
  const src = prog(t, E.source, E.source + .6) * (1 - out);
  spaced(c, 'ZOBOWIĄZANIE Z WYPRZEDZENIEM', CX, 1340, 3, 'JB7', 26, MINT, .85 * src);
  spaced(c, 'J. ELSTER · ULYSSES AND THE SIRENS · 1979', CX, 1392, 1, 'JB5', 23, DIM, .95 * src);
  headline(c, t, a0 + .05, a1, 'Decyzja zapadła,', 'gdy był spokojny.', { size1: 84, size2: 84 });
}

// ── sceny 5–6: dziś – półka, klucz, telefon
function phone(c, cx, cy, w, h, a, screen) {
  c.save(); c.globalAlpha *= a;
  rr(c, cx - w / 2, cy - h / 2, w, h, 50); c.fillStyle = rgba([7, 26, 19], .92); c.fill();
  c.strokeStyle = rgba(SAGE, .75); c.lineWidth = 3; c.stroke();
  rr(c, cx - 32, cy - h / 2 + 20, 64, 11, 5); c.fillStyle = rgba(SAGE, .35); c.fill();
  if (screen) { c.save(); rr(c, cx - w / 2 + 13, cy - h / 2 + 46, w - 26, h - 64, 36); c.clip(); screen(c); c.restore(); }
  c.restore();
}
function padlock(c, x, y, s, col, a = 1) {
  c.save(); c.translate(x, y); c.globalAlpha *= a; c.strokeStyle = rgba(col); c.lineWidth = s * .11; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-s * .26, -s * .02); c.lineTo(-s * .26, -s * .22); c.arc(0, -s * .22, s * .26, Math.PI, 0); c.lineTo(s * .26, -s * .02); c.stroke();
  rr(c, -s * .42, -s * .04, s * .84, s * .62, s * .12); c.fillStyle = rgba(col, .14); c.fill(); c.stroke(); c.restore();
}
function keyFob(c, x, y, s, rot, a = 1) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.globalAlpha *= a;
  rr(c, -52, -132, 104, 264, 30); c.fillStyle = rgba([12, 40, 30]); c.fill(); c.strokeStyle = rgba(MINT, .9); c.lineWidth = 4; c.stroke();
  c.beginPath(); c.arc(0, -96, 15, 0, TAU); c.strokeStyle = rgba(SAGE, .6); c.lineWidth = 3.5; c.stroke();
  c.beginPath(); c.arc(0, 30, 30, 0, TAU); c.fillStyle = rgba([255, 205, 110], .95); c.fill();
  c.strokeStyle = rgba(MINT, .8); c.lineWidth = 3.5; c.lineCap = 'round';
  for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(0, 108, 8 + k * 8, -Math.PI * .78, -Math.PI * .22); c.stroke(); }
  c.restore();
}
function keyGlyph(c, x, y, s, col, a = 1) {
  c.save(); c.translate(x, y); c.rotate(-Math.PI / 4); c.globalAlpha *= a; c.strokeStyle = rgba(col); c.lineWidth = s * .14; c.lineCap = 'round';
  c.beginPath(); c.arc(-s * .55, 0, s * .32, 0, TAU); c.moveTo(-s * .23, 0); c.lineTo(s * .75, 0); c.moveTo(s * .45, 0); c.lineTo(s * .45, s * .26); c.moveTo(s * .7, 0); c.lineTo(s * .7, s * .2); c.stroke(); c.restore();
}
const WIN = { x: 566, y: 690, w: 268, h: 250 }, SHELF = { y: 1012, x0: 548, x1: 858 }, PHN = { cx: 292, cy: 1090, w: 300, h: 540 };
function room(c, t, a) {
  if (a <= 0) return;
  c.save(); c.globalAlpha *= a; c.lineCap = 'round';
  // okno z tym samym morzem (nawiązanie)
  rr(c, WIN.x, WIN.y, WIN.w, WIN.h, 22); c.fillStyle = rgba([7, 24, 18]); c.fill();
  c.save(); rr(c, WIN.x, WIN.y, WIN.w, WIN.h, 22); c.clip();
  crescent(c, WIN.x + 196, WIN.y + 64, 22, .7);
  for (let k = 0; k < 4; k++) {
    const y = WIN.y + 168 + k * 20; c.strokeStyle = rgba(SAGE, .18 + k * .06); c.lineWidth = 2; c.beginPath();
    for (let x = WIN.x; x <= WIN.x + WIN.w; x += 8) { const yy = y + Math.sin(x / (40 + k * 10) + t * 1.2 + k) * (1 + k * .8); x === WIN.x ? c.moveTo(x, yy) : c.lineTo(x, yy); } c.stroke();
  }
  // maleńki statek na horyzoncie za oknem
  c.save(); c.translate(WIN.x + 78, WIN.y + 166 + Math.sin(t * 1.2) * 1.5); c.scale(.16, .16);
  c.strokeStyle = rgba(MINT, .8); c.lineWidth = 9; c.beginPath(); c.moveTo(-232, -8); c.quadraticCurveTo(-205, 58, -120, 64); c.lineTo(130, 64); c.quadraticCurveTo(212, 58, 244, -22); c.stroke();
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -420); c.stroke(); c.restore();
  c.restore();
  rr(c, WIN.x, WIN.y, WIN.w, WIN.h, 22); c.strokeStyle = rgba(SAGE, .6); c.lineWidth = 3; c.stroke();
  c.strokeStyle = rgba(SAGE, .3); c.lineWidth = 2.5; c.beginPath(); c.moveTo(WIN.x + WIN.w / 2, WIN.y); c.lineTo(WIN.x + WIN.w / 2, WIN.y + WIN.h); c.moveTo(WIN.x, WIN.y + 120); c.lineTo(WIN.x + WIN.w, WIN.y + 120); c.stroke();
  // półka
  c.strokeStyle = rgba(SAGE, .75); c.lineWidth = 6; c.beginPath(); c.moveTo(SHELF.x0, SHELF.y); c.lineTo(SHELF.x1, SHELF.y); c.stroke();
  c.lineWidth = 4; c.strokeStyle = rgba(SAGE, .45);
  for (const x of [SHELF.x0 + 40, SHELF.x1 - 40]) { c.beginPath(); c.moveTo(x, SHELF.y + 3); c.lineTo(x, SHELF.y + 38); c.lineTo(x - 26, SHELF.y + 3); c.stroke(); }
  c.restore();
}
function sceneShelf(c, t) {
  const a0 = S.shelf[0], a1 = S.rope[1], out = prog(t, a1 - .4, a1);
  const fin = ease(prog(t, a0, a0 + .6));
  c.save(); c.globalAlpha *= fin * (1 - out);
  room(c, t, 1);
  // telefon: zablokowane
  const pin = ease(prog(t, a0 + .15, a0 + .8));
  phone(c, PHN.cx, PHN.cy + (1 - pin) * 30, PHN.w, PHN.h, pin, c2 => {
    padlock(c2, PHN.cx, PHN.cy - 50, 110, SAGE, 1);
    text(c2, 'zablokowane', PHN.cx, PHN.cy + 80, 'M6', 32, SAGE, .95);
  });
  // klucz łagodnie ląduje na półce
  const kp = eOut(prog(t, E.keyIn, E.keyIn + .6)), kx = 694, ky = SHELF.y - 30;
  if (kp > 0) {
    keyFob(c, kx, ky - (1 - kp) * 40, .5, -Math.PI / 2, kp);
    const rp = prog(t, E.keyIn + .5, E.keyIn + 1.9);
    if (rp > 0 && rp < 1) { c.strokeStyle = rgba(MINT, .45 * (1 - rp)); c.lineWidth = 3; c.beginPath(); c.ellipse(kx, ky, 80 + rp * 120, 34 + rp * 50, 0, 0, TAU); c.stroke(); }
  }
  // zwój liny – nieużywany
  const cp = ease(prog(t, E.coil, E.coil + .8));
  if (cp > 0) {
    c.save(); c.strokeStyle = rgba(SAGE, .85); c.lineWidth = 5; c.lineCap = 'round';
    const cx = 800, cy = SHELF.y - 20, turns = 3.2, max = turns * TAU * cp;
    c.beginPath();
    for (let th = 0; th <= max; th += .07) { const r = 9 + th * 1.55, x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r * .42; th ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke();
    // luźny koniec zwisa za krawędź
    const tail = prog(t, E.coil + .6, E.coil + 1.1);
    if (tail > 0) { c.beginPath(); c.moveTo(cx + 40, cy + 6); c.quadraticCurveTo(cx + 58, cy + 22, cx + 52, cy + 24 + 48 * tail); c.stroke(); }
    c.restore();
  }
  c.restore();
  const capA = prog(t, a0 + .9, a0 + 1.4) * (1 - prog(t, S.shelf[1] - .35, S.shelf[1]));
  spaced(c, 'BLOKADĘ USTAWIASZ, GDY JESTEŚ SPOKOJNY', CX, 1430, 1, 'JB5', 24, DIM, .95 * capA);
  headline(c, t, a0 + .05, S.shelf[1], 'Dziś wystarczy', 'klucz na półce.', { size1: 88, size2: 88 });
  headline(c, t, S.rope[0], a1, 'Lina', 'opcjonalna.', { size1: 96, size2: 96 });
}

// ── plansza końcowa (wzorzec v2)
function sceneEnd(c, t) {
  const [a0] = S.end, lt = t - a0, out = prog(t, DUR - .45, DUR);
  const a = ease(prog(lt, 0, .6)) * (1 - out);
  if (a <= 0) return;
  c.save(); c.globalAlpha *= a;
  const L = 200, cx = CX, cy = 760, R = L / 2, arm = L * .3, rad = L * .15;
  c.strokeStyle = rgba(MINT); c.lineWidth = 12; c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { c.beginPath(); c.moveTo(cx + sx * R, cy + sy * (R - arm)); c.lineTo(cx + sx * R, cy + sy * (R - rad)); c.quadraticCurveTo(cx + sx * R, cy + sy * R, cx + sx * (R - rad), cy + sy * R); c.lineTo(cx + sx * (R - arm), cy + sy * R); c.stroke(); }
  keyGlyph(c, cx + 4, cy + 4, 72, MINT, 1);
  text(c, 'Key to Focus', CX, 990, 'M8', 84, INK, 1);
  text(c, 'Szukam testerów', CX, 1110, 'M8', 62, MINT, ease(prog(lt, .3, .9)));
  text(c, 'Android 8+ z NFC · bezpłatnie', CX, 1180, 'M4', 40, SAGE, ease(prog(lt, .5, 1.1)));
  const pp = ease(prog(lt, .8, 1.3));
  rr(c, CX - 170, 1240, 340, 88, 44); c.fillStyle = rgba(MINT, .12 * pp); c.fill(); c.strokeStyle = rgba(MINT, pp); c.lineWidth = 3; c.stroke();
  text(c, 'link w bio', CX, 1297, 'M6', 40, INK, pp);
  c.restore();
}

function softGlow(c) {
  const g = glow.getContext('2d'); g.clearRect(0, 0, 270, 480); g.filter = 'blur(6px)'; g.drawImage(main, 0, 0, 270, 480); g.filter = 'none';
  c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = .26; c.drawImage(glow, 0, 0, W, H); c.restore();
}

function frame(f) {
  const t = f / FPS;
  ctx.save(); ctx.globalAlpha = 1; ctx.setLineDash([]);
  background(ctx);
  if (t < S.mast[1]) seaWorld(ctx, t);
  if (t < S.hook[1]) sceneText1(ctx, t);
  if (t >= S.sirens[0] && t < S.sirens[1]) sceneText2(ctx, t);
  if (t >= S.mast[0] && t < S.mast[1]) sceneText3(ctx, t);
  if (t >= S.decision[0] && t < S.decision[1]) sceneDecision(ctx, t);
  if (t >= S.shelf[0] && t < S.rope[1]) sceneShelf(ctx, t);
  if (t >= S.end[0]) sceneEnd(ctx, t);
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
