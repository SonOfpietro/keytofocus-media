// Key to Focus — Reel "Do Instagrama mam 14 kroków."
// Deterministic frame renderer: node reel.mjs [--still=2.0,4.1] [--out=file.mp4]
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const TL = JSON.parse(fs.readFileSync(new URL('./timeline.json', import.meta.url)));
const W = 1080, H = 1920, FPS = TL.fps, DUR = TL.duration, N = TL.steps;
const S = TL.scenes, E = TL.events;
const NS = String(N);

const fdir = new URL('../../engine/fonts/', import.meta.url).pathname;
for (const [file, alias] of [
  ['Unbounded-800.ttf', 'UB8'], ['Unbounded-700.ttf', 'UB7'],
  ['ChakraPetch-700.ttf', 'CP7'], ['ChakraPetch-600.ttf', 'CP6'], ['ChakraPetch-500.ttf', 'CP5'],
  ['JetBrainsMono-700.ttf', 'JB7'], ['JetBrainsMono-500.ttf', 'JB5'],
]) GlobalFonts.registerFromPath(fdir + file, alias);

// ───────────────────────── utils
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const eOutC = t => 1 - Math.pow(1 - t, 3);
const eInC = t => t * t * t;
const eInOutC = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eOutExpo = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const eInExpo = t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10));
const eOutBack = t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hr = (i, j = 0) => rng((i * 7919 + j * 104729 + 13) >>> 0)();
const mix = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t)));
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const TAU = Math.PI * 2;

const MINT = [60, 255, 176], CYAN = [56, 225, 255], RED = [255, 46, 99], WHITE = [242, 255, 249], GOLD = [255, 200, 87];
const CX = 470; // centre of the safe zone (x 90..850)

// ───────────────────────── canvases
const main = createCanvas(W, H), ctx = main.getContext('2d');
const tmp = createCanvas(W, H), tctx = tmp.getContext('2d');
const chan = [0, 1, 2].map(() => createCanvas(W, H));
const bloomA = createCanvas(270, 480), bloomB = createCanvas(135, 240);

const scan = createCanvas(W, H); { const s = scan.getContext('2d'); s.fillStyle = 'rgba(0,0,0,0.16)'; for (let y = 0; y < H; y += 4) s.fillRect(0, y, W, 2); }
const vign = createCanvas(W, H); { const v = vign.getContext('2d'); const g = v.createRadialGradient(W / 2, H * .47, H * .22, W / 2, H * .5, H * .78); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.8)'); v.fillStyle = g; v.fillRect(0, 0, W, H); }
const grains = [...Array(6)].map((_, k) => { const g = createCanvas(360, 640), gx = g.getContext('2d'); const id = gx.createImageData(360, 640); const r = rng(k + 99); for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } gx.putImageData(id, 0, 0); return g; });

const particles = [...Array(190)].map((_, i) => { const r = rng(500 + i); return { x: r() * W, y: r() * H, z: .25 + r() * .9, ph: r() * TAU, sp: 20 + r() * 60 }; });

// ───────────────────────── text helpers
const setFont = (c, fam, size) => { c.font = `${size}px ${fam}`; };
function fit(c, text, fam, max, maxW) { setFont(c, fam, max); const w = c.measureText(text).width; return w > maxW ? Math.floor(max * maxW / w) : max; }
function segWidth(c, segs, fam, size) { setFont(c, fam, size); return segs.reduce((s, g) => s + c.measureText(g.t).width, 0); }

// draws one line made of coloured segments; options: fam,size,align,alpha,glow,blur,split
function rich(c, segs, x, y, o) {
  const total = segWidth(c, segs, o.fam, o.size);
  let x0 = o.align === 'center' ? x - total / 2 : x;
  c.save(); setFont(c, o.fam, o.size); c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.globalAlpha = o.alpha ?? 1;
  const pass = (fn) => { let cx = x0; for (const g of segs) { fn(g, cx); cx += c.measureText(g.t).width; } };
  if (o.split) {
    c.globalCompositeOperation = 'lighter';
    pass((g, cx) => { c.fillStyle = 'rgba(255,40,100,0.9)'; c.fillText(g.t, cx - o.split, y); c.fillStyle = 'rgba(40,220,255,0.9)'; c.fillText(g.t, cx + o.split, y); });
    c.globalCompositeOperation = 'source-over';
  }
  pass((g, cx) => { const col = g.c || WHITE; c.shadowColor = rgba(g.glow || col, .9); c.shadowBlur = o.blur ?? 26; c.fillStyle = rgba(col, 1); c.fillText(g.t, cx, y); });
  c.shadowBlur = 0; pass((g, cx) => { c.fillStyle = rgba(g.c || WHITE, 1); c.fillText(g.t, cx, y); });
  c.restore();
  return { x0, x1: x0 + total };
}

const GLYPHS = 'ABCDEFGHIJKLMNOPRSTUWXYZ0123456789#%&@$<>/\\[]{}=+*';
// decode: characters resolve left→right with jitter; layout stays fixed to the final string
function decodeLine(c, str, x, y, o, p, seed, frame) {
  setFont(c, o.fam, o.size);
  const total = c.measureText(str).width;
  const x0 = o.align === 'center' ? x - total / 2 : x;
  c.save(); c.textAlign = 'left'; c.globalAlpha = o.alpha ?? 1;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]; if (ch === ' ') continue;
    const th = (i / str.length) * .65 + hr(seed, i) * .3;
    const px = x0 + c.measureText(str.slice(0, i)).width;
    let out = null, col = o.color || WHITE, glow = o.glow ?? col;
    if (p >= th) out = ch;
    else if (p >= th - .4) { out = GLYPHS[Math.floor(hr(seed * 31 + frame, i) * GLYPHS.length)]; col = MINT; glow = MINT; }
    if (!out) continue;
    c.shadowColor = rgba(glow, .9); c.shadowBlur = o.blur ?? 24; c.fillStyle = rgba(col, 1); c.fillText(out, px, y);
    c.shadowBlur = 0; c.fillText(out, px, y);
  }
  c.restore();
  return { x0, x1: x0 + total };
}

// horizontal wipe with a scanning edge
function wipe(c, p, x0, x1, y0, y1, draw, edge = MINT) {
  if (p <= 0) return;
  const xe = lerp(x0 - 20, x1 + 20, eOutC(p));
  c.save(); c.beginPath(); c.rect(0, y0, xe, y1 - y0); c.clip(); draw(); c.restore();
  if (p < 1) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(xe - 60, 0, xe + 6, 0); g.addColorStop(0, rgba(edge, 0)); g.addColorStop(1, rgba(edge, .55));
    c.fillStyle = g; c.fillRect(xe - 60, y0, 66, y1 - y0);
    c.fillStyle = rgba(WHITE, .95); c.shadowColor = rgba(edge, 1); c.shadowBlur = 30; c.fillRect(xe, y0 - 10, 4, y1 - y0 + 20);
    c.restore();
  }
}

function spaced(c, text, x, y, sp, fam, size, col, alpha = 1, align = 'left', glow = true) {
  c.save(); setFont(c, fam, size); c.globalAlpha = alpha;
  const ws = [...text].map(ch => c.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + sp * (text.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  c.fillStyle = rgba(col, 1); if (glow) { c.shadowColor = rgba(col, .8); c.shadowBlur = 12; }
  [...text].forEach((ch, i) => { c.fillText(ch, cx, y); cx += ws[i] + sp; });
  c.restore(); return total;
}

// slam-in for a whole rich line: scale from big, RGB split decays
function slamLine(c, segs, x, y, o, lt) {
  if (lt < 0) return;
  const p = clamp(lt / .28), s = lerp(1.45, 1, eOutExpo(p));
  const split = (1 - eOutC(clamp(lt / .5))) * 18;
  c.save(); c.translate(x, y); c.scale(s, s);
  rich(c, segs, 0, 0, { ...o, alpha: (o.alpha ?? 1) * clamp(lt / .08), split });
  c.restore();
}

// ───────────────────────── geometry helpers
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function line(c, x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
function glowStroke(c, col, a, w, blur, fn) { c.save(); c.strokeStyle = rgba(col, a); c.lineWidth = w; c.shadowColor = rgba(col, 1); c.shadowBlur = blur; fn(); c.restore(); }

function drawKeyGlyph(c, x, y, s, col, a = 1, draw = 1) { // circle bow + shaft + teeth, s = size
  c.save(); c.translate(x, y); c.rotate(-Math.PI / 4); c.globalAlpha = a;
  c.strokeStyle = rgba(col, 1); c.lineWidth = s * .13; c.lineCap = 'round'; c.lineJoin = 'round';
  c.shadowColor = rgba(col, 1); c.shadowBlur = s * .35;
  const L = s * 3.2; c.setLineDash([L * draw, L]);
  c.beginPath(); c.arc(-s * .55, 0, s * .32, Math.PI * .15, Math.PI * 2.15);
  c.moveTo(-s * .23, 0); c.lineTo(s * .75, 0); c.moveTo(s * .45, 0); c.lineTo(s * .45, s * .26); c.moveTo(s * .7, 0); c.lineTo(s * .7, s * .2);
  c.stroke(); c.restore();
}

function drawPadlock(c, x, y, s, col, open = 0, a = 1) {
  c.save(); c.translate(x, y); c.globalAlpha = a; c.strokeStyle = rgba(col, 1); c.lineWidth = s * .12; c.lineCap = 'round';
  c.shadowColor = rgba(col, 1); c.shadowBlur = s * .4;
  c.save(); c.translate(s * .28, -s * .05 - open * s * .28); c.rotate(-open * .5); c.translate(-s * .28, 0);
  c.beginPath(); c.moveTo(-s * .28, 0); c.lineTo(-s * .28, -s * .22); c.arc(0, -s * .22, s * .28, Math.PI, 0); c.lineTo(s * .28, 0); c.stroke(); c.restore();
  rr(c, -s * .45, -s * .05, s * .9, s * .7, s * .12); c.fillStyle = rgba(col, .18); c.fill(); c.stroke();
  c.beginPath(); c.arc(0, s * .25, s * .07, 0, TAU); c.fillStyle = rgba(col, 1); c.fill();
  c.restore();
}

function drawCheck(c, x, y, s, col, p = 1) {
  c.save(); c.strokeStyle = rgba(col, 1); c.lineWidth = s * .16; c.lineCap = 'round'; c.lineJoin = 'round'; c.shadowColor = rgba(col, 1); c.shadowBlur = 16;
  c.setLineDash([s * 2.2 * p, s * 3]); c.beginPath(); c.moveTo(x - s * .45, y); c.lineTo(x - s * .1, y + s * .35); c.lineTo(x + s * .5, y - s * .35); c.stroke(); c.restore();
}

function reticle(c, x, y, R, t, a, col = MINT, scale = 1) {
  c.save(); c.translate(x, y); c.scale(scale, scale); c.globalAlpha = a; c.lineCap = 'butt';
  c.shadowColor = rgba(col, 1); c.shadowBlur = 14;
  c.strokeStyle = rgba(col, .55); c.lineWidth = 3; c.setLineDash([22, 14]); c.lineDashOffset = -t * 60;
  c.beginPath(); c.arc(0, 0, R, 0, TAU); c.stroke(); c.setLineDash([]);
  for (let i = 0; i < 72; i++) { const an = i / 72 * TAU + t * .15, l = i % 6 === 0 ? 26 : 10; c.strokeStyle = rgba(col, i % 6 === 0 ? .8 : .3); c.lineWidth = i % 6 === 0 ? 3 : 2; line(c, Math.cos(an) * (R - 18), Math.sin(an) * (R - 18), Math.cos(an) * (R - 18 - l), Math.sin(an) * (R - 18 - l)); }
  c.strokeStyle = rgba(col, .9); c.lineWidth = 7;
  for (let k = 0; k < 3; k++) { const a0 = -t * .9 + k * TAU / 3; c.beginPath(); c.arc(0, 0, R + 26, a0, a0 + .55); c.stroke(); }
  c.strokeStyle = rgba(col, .35); c.lineWidth = 2; c.beginPath(); c.arc(0, 0, R * .78, t * .5, t * .5 + 4.6); c.stroke();
  c.restore();
}

// ───────────────────────── background
function background(c, t, f) {
  const alert = alertLevel(t);
  const g = c.createRadialGradient(CX, 860, 40, CX, 900, 1300);
  g.addColorStop(0, rgba(mix([7, 44, 30], [78, 4, 28], alert), 1)); g.addColorStop(.55, rgba(mix([2, 16, 11], [26, 2, 10], alert), 1)); g.addColorStop(1, 'rgb(1,5,4)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);

  const gp = gridParams(t), gcol = mix(MINT, RED, clamp(alert * 1.7));
  // ceiling grid (faint)
  c.save(); c.lineWidth = 2;
  const ch = 520;
  for (let i = -18; i <= 18; i++) { c.strokeStyle = rgba(gcol, .05 * gp.a * (1 - Math.abs(i) / 20)); line(c, CX + i * 10, ch, CX + i * 160, 0); }
  // floor grid
  const hy = gp.hy;
  const hg = c.createLinearGradient(0, hy - 200, 0, hy + 80); hg.addColorStop(0, rgba(gcol, 0)); hg.addColorStop(.72, rgba(gcol, .2 * gp.a)); hg.addColorStop(1, rgba(gcol, 0));
  c.fillStyle = hg; c.fillRect(0, hy - 200, W, 280);
  for (let i = -26; i <= 26; i++) { const a = gp.a * .32 * (1 - Math.abs(i) / 28); c.strokeStyle = rgba(gcol, a); line(c, CX + i * 9, hy, CX + i * 170, H + 40); }
  const n = 24, off = gp.travel;
  for (let k = 0; k < n; k++) {
    const zz = n - ((k + off) % n);
    const y = hy + (H - hy) / zz * 1.15; if (y > H + 10) continue;
    const a = gp.a * clamp(.75 / zz * 3) * .55;
    c.strokeStyle = rgba(gcol, a); c.lineWidth = zz < 2 ? 3 : 2; line(c, 0, y, W, y);
  }
  c.restore();

  // particles
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    const y = ((p.y - t * p.sp * p.z * gp.pspeed) % H + H) % H;
    const x = p.x + Math.sin(t * .6 + p.ph) * 24 * p.z;
    const tw = .45 + .55 * Math.sin(t * 3 + p.ph * 5);
    const r = 1.2 + p.z * 2.6;
    c.fillStyle = rgba(mix(MINT, RED, clamp(alert * 1.7)), .5 * tw * p.z);
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  c.restore();

  // moving scan band
  const sy = ((t * 520) % (H + 600)) - 300;
  const sg = c.createLinearGradient(0, sy - 120, 0, sy + 120); sg.addColorStop(0, rgba(MINT, 0)); sg.addColorStop(.5, rgba(MINT, .045)); sg.addColorStop(1, rgba(MINT, 0));
  c.fillStyle = sg; c.fillRect(0, sy - 120, W, 240);
}

function gridParams(t) {
  // travel is the integral of speed so the grid never jumps
  const keys = [[0, 2.2], [2.8, .7], [5.8, .35], [9.8, .5], [13.4, 1.0], [16.6, .45], [19.3, .6], [20, 3.2]];
  let travel = 0, speed = keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, s0] = keys[i], [t1, s1] = keys[i + 1];
    if (t <= t0) break;
    const tt = Math.min(t, t1), u = (tt - t0) / (t1 - t0);
    travel += (t1 - t0) * (s0 * u + (s1 - s0) * u * u / 2);
    speed = lerp(s0, s1, u);
  }
  const hy = 1330 + Math.sin(t * .4) * 14;
  const a = t > 19.35 ? lerp(1, 1.3, prog(t, 19.35, 20)) : 1;
  return { travel, hy, a, pspeed: .6 + speed * .6 };
}

function alertLevel(t) {
  let a = 0;
  if (t >= E.slam && t < S.lock[1]) a = lerp(1, .55, prog(t, E.slam, E.slam + .8));
  if (t >= S.lock[1] - .1 && t < S.lock[1] + .2) a = .55 * (1 - prog(t, S.lock[1] - .1, S.lock[1] + .2));
  if (t >= S.nfc[0] && t < E.unlock + .4) a = .45 * (1 - prog(t, E.unlock, E.unlock + .4)) * prog(t, S.nfc[0], S.nfc[0] + .3);
  return a;
}

// ───────────────────────── HUD (decorative frame, mostly outside the safe zone)
function hud(c, t, f) {
  const alert = alertLevel(t), col = mix(MINT, RED, clamp(alert * 1.7));
  const fade = t > 19.5 ? 1 - prog(t, 19.5, 20) * .5 : 1;
  c.save(); c.globalAlpha = .75 * fade;
  const L = 70, m = 38;
  glowStroke(c, col, .8, 3, 10, () => {
    for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { c.beginPath(); c.moveTo(x, y + sy * L); c.lineTo(x, y); c.lineTo(x + sx * L, y); c.stroke(); }
  });
  spaced(c, 'KEY TO FOCUS', 62, 196, 6, 'JB7', 22, col, .8);
  spaced(c, '// SYS 0.17', 300, 196, 4, 'JB5', 22, col, .5);
  const sec = t.toFixed(2).padStart(5, '0');
  spaced(c, `T+00:${sec}`, W - 62, 196, 3, 'JB5', 22, col, .6, 'right');
  // left ruler
  c.strokeStyle = rgba(col, .35); c.lineWidth = 2;
  for (let i = 0; i < 40; i++) { const y = 260 + ((i * 30 + t * 40) % 1200); const l = i % 5 === 0 ? 18 : 8; line(c, 44, y, 44 + l, y); }
  // bottom data line
  const scene = Object.entries(S).findIndex(([, v]) => t >= v[0] && t < v[1]);
  spaced(c, `SCENA ${String(scene + 1).padStart(2, '0')}/06`, 62, 1560, 4, 'JB5', 22, col, .55);
  spaced(c, alert > .3 ? 'STATUS: BLOKADA' : 'STATUS: TRYB SKUPIENIA', 330, 1560, 4, 'JB5', 22, col, .55);
  // segmented progress
  for (let i = 0; i < 6; i++) { const [a, b] = Object.values(S)[i]; const x = 62 + i * 128, p = prog(t, a, b); c.fillStyle = rgba(col, .18); c.fillRect(x, 1590, 112, 4); c.fillStyle = rgba(col, .85); c.fillRect(x, 1590, 112 * p, 4); }
  c.restore();
}

// ───────────────────────── scene A: hook
function sceneHook(c, t, f) {
  const [a0, a1] = S.hook, lt = t - a0;
  const out = prog(t, a1 - .3, a1 + .05), sc = 1 + eInExpo(out) * .35, al = 1 - eInC(out);
  c.save(); c.translate(CX, 900); c.scale(sc, sc); c.translate(-CX, -900); c.globalAlpha = al;

  const rIn = eOutExpo(prog(lt, -.1, .5));
  reticle(c, CX, 880, 300, t, .9 * rIn, MINT, lerp(1.5, 1, rIn));

  // counter 00 → 14
  const cp = eOutC(prog(t, E.countStart, E.countEnd));
  const val = Math.round(cp * N), str = String(val).padStart(2, '0');
  const lockIn = prog(t, E.countEnd, E.countEnd + .45);
  const size = fit(c, '88', 'UB8', 470, 640);
  const flick = val < N ? (hr(f, 3) > .5 ? 1 : .75) : 1;
  rich(c, [{ t: str, c: MINT }], CX, 880 + size * .36, { fam: 'UB8', size, align: 'center', blur: 60, alpha: flick, split: (1 - lockIn) * (val === N ? 22 : 6) });
  if (lockIn > 0 && lockIn < 1) { // shock ring at lock-in
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba(MINT, 1 - lockIn); c.lineWidth = 8 * (1 - lockIn) + 1; c.shadowColor = rgba(MINT, 1); c.shadowBlur = 30;
    c.beginPath(); c.arc(CX, 880, 300 + eOutC(lockIn) * 260, 0, TAU); c.stroke(); c.restore();
  }

  const s1 = fit(c, 'Do Instagrama mam', 'CP6', 80, 760);
  decodeLine(c, 'Do Instagrama mam', CX, 470, { fam: 'CP6', size: s1, align: 'center', color: WHITE, glow: MINT, blur: 18 }, prog(lt, -.45, .3), 11, f);
  const s2 = fit(c, 'KROKÓW.', 'UB8', 150, 720);
  decodeLine(c, 'KROKÓW.', CX, 1318, { fam: 'UB8', size: s2, align: 'center', color: WHITE, glow: MINT, blur: 30 }, prog(lt, -.2, .55), 23, f);

  // footsteps row lights up with the counter
  for (let i = 0; i < N; i++) {
    const x = 150 + i * (640 / (N - 1)), y = 1392 + (i % 2 ? 10 : -10);
    const on = i < val, a = on ? 1 : .18;
    c.save(); c.translate(x, y); c.rotate(i % 2 ? .18 : -.18); c.fillStyle = rgba(on ? MINT : WHITE, a); if (on) { c.shadowColor = rgba(MINT, 1); c.shadowBlur = 14; }
    c.beginPath(); c.ellipse(0, -7, 11, 17, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(0, 15, 8, 9, 0, 0, TAU); c.fill(); c.restore();
  }
  // side labels on the reticle
  const la = prog(lt, .3, .7);
  spaced(c, 'CEL: INSTAGRAM', 130, 620, 4, 'JB7', 24, MINT, .85 * la);
  spaced(c, 'DYSTANS', 810, 1150, 4, 'JB5', 22, MINT, .6 * la, 'right');
  c.restore();
}

// ───────────────────────── scene B: lock
function phoneFrame(c, x, y, w, h, col, a, drawP = 1, t = 0) {
  c.save(); c.globalAlpha = a;
  rr(c, x, y, w, h, 58); c.fillStyle = 'rgba(4,22,16,0.72)'; c.fill();
  const per = 2 * (w + h);
  c.setLineDash([per * drawP, per]); c.strokeStyle = rgba(col, .95); c.lineWidth = 5; c.shadowColor = rgba(col, 1); c.shadowBlur = 28; rr(c, x, y, w, h, 58); c.stroke();
  c.setLineDash([]); c.shadowBlur = 0; c.strokeStyle = rgba(col, .35); c.lineWidth = 2; rr(c, x + 14, y + 14, w - 28, h - 28, 46); c.stroke();
  c.restore();
}

const TILE_GLYPHS = ['circle', 'chat', 'play', 'note', 'globe', 'grid', 'mail', 'map', 'cart', 'cam', 'star', 'bolt'];
function tileGlyph(c, kind, x, y, s, col) {
  c.save(); c.translate(x, y); c.strokeStyle = rgba(col, .9); c.lineWidth = 3; c.lineJoin = 'round';
  c.beginPath();
  switch (kind) {
    case 'circle': c.arc(0, 0, s * .28, 0, TAU); break;
    case 'chat': c.roundRect(-s * .3, -s * .22, s * .6, s * .38, 8); c.moveTo(-s * .1, s * .16); c.lineTo(-s * .2, s * .3); c.lineTo(0, s * .16); break;
    case 'play': c.moveTo(-s * .15, -s * .25); c.lineTo(s * .25, 0); c.lineTo(-s * .15, s * .25); c.closePath(); break;
    case 'note': c.moveTo(s * .1, s * .2); c.lineTo(s * .1, -s * .28); c.lineTo(s * .28, -s * .2); c.moveTo(s * .1, s * .2); c.arc(0, s * .2, s * .1, 0, TAU); break;
    case 'globe': c.arc(0, 0, s * .28, 0, TAU); c.moveTo(-s * .28, 0); c.lineTo(s * .28, 0); c.ellipse(0, 0, s * .12, s * .28, 0, 0, TAU); break;
    case 'grid': for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c.rect(-s * .27 + i * s * .19, -s * .27 + j * s * .19, s * .14, s * .14); break;
    case 'mail': c.rect(-s * .3, -s * .2, s * .6, s * .4); c.moveTo(-s * .3, -s * .2); c.lineTo(0, s * .05); c.lineTo(s * .3, -s * .2); break;
    case 'map': c.moveTo(0, s * .3); c.lineTo(-s * .2, 0); c.arc(0, -s * .08, s * .2, Math.PI * .85, Math.PI * .15); c.closePath(); break;
    case 'cart': c.moveTo(-s * .3, -s * .2); c.lineTo(-s * .2, -s * .2); c.lineTo(-s * .1, s * .15); c.lineTo(s * .25, s * .15); c.lineTo(s * .3, -s * .1); c.lineTo(-s * .15, -s * .1); break;
    case 'cam': c.roundRect(-s * .3, -s * .18, s * .6, s * .4, 6); c.moveTo(s * .1, 0); c.arc(0, 0, s * .1, 0, TAU); break;
    case 'star': for (let i = 0; i < 10; i++) { const r = i % 2 ? s * .12 : s * .3, an = i / 10 * TAU - Math.PI / 2; i ? c.lineTo(Math.cos(an) * r, Math.sin(an) * r) : c.moveTo(Math.cos(an) * r, Math.sin(an) * r); } c.closePath(); break;
    case 'bolt': c.moveTo(s * .05, -s * .3); c.lineTo(-s * .15, s * .03); c.lineTo(s * .02, s * .03); c.lineTo(-s * .05, s * .3); c.lineTo(s * .18, -s * .05); c.lineTo(0, -s * .05); c.closePath(); break;
  }
  c.stroke(); c.restore();
}

function sceneLock(c, t, f) {
  const [b0, b1] = S.lock, lt = t - b0;
  const out = prog(t, b1 - .25, b1 + .05);
  const pw = 400, ph = 820, px = CX - pw / 2, py = 560;
  const sway = Math.sin(t * 1.3) * .035;
  c.save(); c.globalAlpha = 1 - out;
  c.translate(CX, py + ph / 2); c.transform(1, sway * .3, 0, 1, 0, 0); c.scale(1 - out * .2, 1 - out * .2); c.translate(-CX, -(py + ph / 2));

  const slam = t - E.slam, locked = slam >= 0;
  const col = locked ? RED : CYAN;
  const draw = eOutC(prog(lt, 0, .45));
  phoneFrame(c, px, py, pw, ph, col, 1, draw, t);

  // app grid (fades away once locked)
  const tileS = 70, gx = px + 52, gy = py + 120, gap = (pw - 104 - tileS * 4) / 3;
  const zoom = eInOutC(prog(t, E.tap + .02, E.slam + .02));
  const igI = 6; // tile index of the target app
  if (zoom < 1) {
    for (let i = 0; i < 12; i++) {
      const r = Math.floor(i / 4), cI = i % 4, x = gx + cI * (tileS + gap), y = gy + r * (tileS + 64);
      const pop = eOutBack(prog(lt, .15 + i * .025, .45 + i * .025));
      if (pop <= 0) continue;
      const isT = i === igI;
      c.save(); c.globalAlpha = (isT ? 1 : 1 - zoom) * clamp(pop);
      c.translate(x + tileS / 2, y + tileS / 2); c.scale(pop, pop);
      rr(c, -tileS / 2, -tileS / 2, tileS, tileS, 20);
      c.fillStyle = rgba(isT ? CYAN : MINT, isT ? .22 : .08); c.fill();
      c.strokeStyle = rgba(isT ? CYAN : MINT, isT ? 1 : .45); c.lineWidth = isT ? 4 : 2; if (isT) { c.shadowColor = rgba(CYAN, 1); c.shadowBlur = 20; } c.stroke(); c.shadowBlur = 0;
      tileGlyph(c, TILE_GLYPHS[i], 0, 0, tileS, isT ? CYAN : MINT);
      c.restore();
      if (isT) { setFont(c, 'JB7', 19); c.save(); c.globalAlpha = 1 - zoom; c.fillStyle = rgba(CYAN, 1); c.textAlign = 'center'; c.fillText('Instagram', x + tileS / 2, y + tileS + 30); c.restore(); }
    }
    // tap ripple
    const tp = t - E.tap;
    if (tp > -.25 && tp < .5) {
      const ti = igI, x = gx + (ti % 4) * (tileS + gap) + tileS / 2, y = gy + Math.floor(ti / 4) * (tileS + 64) + tileS / 2;
      const fx = x + 40 * (1 - eOutC(prog(tp, -.25, 0))), fy = y + 60 * (1 - eOutC(prog(tp, -.25, 0)));
      c.save(); c.globalCompositeOperation = 'lighter';
      c.fillStyle = rgba(WHITE, .5 * (1 - prog(tp, .1, .45))); c.beginPath(); c.arc(fx, fy, 26, 0, TAU); c.fill();
      for (let k = 0; k < 3; k++) { const rp = prog(tp, k * .08, .4 + k * .08); if (rp <= 0 || rp >= 1) continue; c.strokeStyle = rgba(CYAN, 1 - rp); c.lineWidth = 4; c.beginPath(); c.arc(x, y, 20 + rp * 120, 0, TAU); c.stroke(); }
      c.restore();
    }
    // zooming tile → screen
    if (zoom > 0) {
      const ti = igI, x0 = gx + (ti % 4) * (tileS + gap), y0 = gy + Math.floor(ti / 4) * (tileS + 64);
      const x = lerp(x0, px + 14, zoom), y = lerp(y0, py + 14, zoom), w = lerp(tileS, pw - 28, zoom), h = lerp(tileS, ph - 28, zoom);
      rr(c, x, y, w, h, lerp(20, 46, zoom)); c.fillStyle = rgba(CYAN, .25 + zoom * .2); c.fill();
    }
  }

  if (locked) {
    const sp = clamp(slam / .35), jitter = slam < .35 ? (hr(f, 1) - .5) * 26 * (1 - sp) : 0;
    c.save(); c.translate(jitter, 0);
    // red screen
    c.save(); rr(c, px + 14, py + 14, pw - 28, ph - 28, 46); c.clip();
    c.fillStyle = rgba(RED, .14 + .25 * (1 - sp)); c.fillRect(px, py, pw, ph);
    // moving warning stripes
    c.strokeStyle = rgba(RED, .28); c.lineWidth = 18;
    for (let i = -10; i < 20; i++) { const o = (t * 60) % 60; line(c, px + i * 60 + o - 120, py + ph - 40, px + i * 60 + o, py + ph - 130); }
    c.fillStyle = 'rgba(6,0,3,0.6)'; c.fillRect(px, py + 548, pw, 136);
    c.fillStyle = rgba(RED, .8); c.fillRect(px + 14, py + 548, pw - 28, 3); c.fillRect(px + 14, py + 681, pw - 28, 3);
    c.restore();
    // hex shield
    const hs = lerp(1.6, 1, eOutExpo(sp)), cxp = CX, cyp = py + 330;
    c.save(); c.translate(cxp, cyp); c.scale(hs, hs); c.rotate(t * .3);
    c.strokeStyle = rgba(RED, .9); c.lineWidth = 4; c.shadowColor = rgba(RED, 1); c.shadowBlur = 24; c.setLineDash([30, 12]);
    c.beginPath(); for (let i = 0; i <= 6; i++) { const an = i / 6 * TAU; i ? c.lineTo(Math.cos(an) * 150, Math.sin(an) * 150) : c.moveTo(150, 0); } c.stroke();
    c.restore();
    drawPadlock(c, cxp, cyp - 10, 150 * hs, RED, 0, clamp(slam / .1));
    spaced(c, 'ZABLOKOWANE', CX, py + 600, 7, 'JB7', 36, RED, clamp(slam / .2), 'center');
    spaced(c, 'WYMAGANY KLUCZ NFC', CX, py + 650, 4, 'JB5', 22, WHITE, .75 * clamp((slam - .2) / .3), 'center');
    c.restore();
  }
  c.restore();

  // text card
  const ta = 1 - out;
  const sz = fit(c, 'Zablokowany.', 'UB8', 96, 760);
  if (slam >= 0) slamLine(c, [{ t: 'Zablokowany.', c: WHITE, glow: RED }], CX, 380, { fam: 'UB8', size: sz, align: 'center', alpha: ta, blur: 34 }, slam);
  const segs = [{ t: 'Klucz leży ', c: WHITE }, { t: 'w kuchni.', c: MINT }];
  const s2 = fit(c, 'Klucz leży w kuchni.', 'CP7', 70, 760), w2 = segWidth(c, segs, 'CP7', s2);
  c.save(); c.globalAlpha = ta;
  wipe(c, prog(t, E.slam + .3, E.slam + .7), CX - w2 / 2, CX + w2 / 2, 410, 500, () => rich(c, segs, CX, 478, { fam: 'CP7', size: s2, align: 'center', blur: 20 }));
  c.restore();
}

// ───────────────────────── scene C: holographic floor plan
const ROOMS = [
  { name: 'SALON', x: [-4.6, -0.6], z: [-1.0, 3.0] },
  { name: 'KORYTARZ', x: [-0.6, 1.4], z: [-0.1, 1.2], hideLabel: true },
  { name: 'KUCHNIA', x: [1.4, 4.6], z: [-2.6, 1.2] },
];
const SOFA = { x: [-4.3, -2.7], z: [2.3, 2.9], h: .42 };
const COUNTER = { x: [3.75, 4.45], z: [-2.45, .7], h: .9 };
const TABLE = { x: [-2.6, -1.6], z: [-.4, .5], h: .45 };
const PATH = [[-3.4, 1.95], [-2.2, 1.0], [-.9, .55], [.6, .55], [2.2, -.5], [3.3, -1.55]];
const KEYP = [4.1, .9, -1.55];
const pathLen = (() => { let L = 0; const segs = []; for (let i = 0; i < PATH.length - 1; i++) { const d = Math.hypot(PATH[i + 1][0] - PATH[i][0], PATH[i + 1][1] - PATH[i][1]); segs.push(d); L += d; } return { L, segs }; })();
function pathAt(s) { let acc = 0; for (let i = 0; i < pathLen.segs.length; i++) { const d = pathLen.segs[i]; if (s <= acc + d || i === pathLen.segs.length - 1) { const u = clamp((s - acc) / d); const [x0, z0] = PATH[i], [x1, z1] = PATH[i + 1]; return { x: lerp(x0, x1, u), z: lerp(z0, z1, u), a: Math.atan2(z1 - z0, x1 - x0) }; } acc += d; } }
const STEPS = [...Array(N)].map((_, i) => { const p = pathAt((i + .5) / N * pathLen.L); const side = i % 2 ? 1 : -1; return { x: p.x + Math.cos(p.a + Math.PI / 2) * .14 * side, z: p.z + Math.sin(p.a + Math.PI / 2) * .14 * side, a: p.a }; });

function makeProj(cx, cy, s, th, ph, D = 16) {
  const ct = Math.cos(th), st = Math.sin(th), cp = Math.cos(ph), sp = Math.sin(ph);
  return (x, y, z) => { const x1 = x * ct - z * st, z1 = x * st + z * ct; const y2 = y * cp + z1 * sp, z2 = -y * sp + z1 * cp; const f = D / (D + z2); return [cx + x1 * s * f, cy - y2 * s * f, z2]; };
}
function poly(c, P, pts) { c.beginPath(); pts.forEach((p, i) => { const [x, y] = P(...p); i ? c.lineTo(x, y) : c.moveTo(x, y); }); }
function box3(c, P, b, col, a, hScale = 1) {
  const h = b.h * hScale, [x0, x1] = b.x, [z0, z1] = b.z;
  const bot = [[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], top = bot.map(([x, , z]) => [x, h, z]);
  c.save(); c.strokeStyle = rgba(col, a); c.lineWidth = 2.5; c.shadowColor = rgba(col, 1); c.shadowBlur = 10;
  poly(c, P, [...top, top[0]]); c.fillStyle = rgba(col, a * .12); c.fill(); c.stroke();
  for (let i = 0; i < 4; i++) { const p0 = P(...bot[i]), p1 = P(...top[i]); line(c, p0[0], p0[1], p1[0], p1[1]); }
  poly(c, P, [...bot, bot[0]]); c.stroke(); c.restore();
}

function scenePlan(c, t, f) {
  const [c0, c1] = S.plan, lt = t - c0;
  const inP = eOutExpo(prog(lt, 0, .7));
  const th = lerp(-1.05, -.62, eInOutC(prog(lt, 0, 4))) + (1 - inP) * -.6;
  const phi = lerp(.95, .66, inP);
  const s0 = 80 * lerp(.6, 1, inP);
  const baseP = makeProj(CX + 10, 890, s0, th, phi);
  // zoom-through into the key at the end
  const zp = eInExpo(prog(t, E.planZoom, c1));
  const [kx, ky] = baseP(KEYP[0], KEYP[1] + .6, KEYP[2]);
  const zoom = 1 + zp * 9;
  const P = (x, y, z) => { const [sx, sy, sz] = baseP(x, y, z); return [(sx - kx) * zoom + lerp(kx, CX, Math.min(1, zp * 3)), (sy - ky) * zoom + lerp(ky, 930, Math.min(1, zp * 3)), sz]; };
  const fadeOut = 1 - prog(t, c1 - .12, c1);
  c.save(); c.globalAlpha = fadeOut;

  // floor grid swept in
  const sweep = lerp(-5.5, 5.5, eInOutC(prog(lt, 0, .8)));
  c.save(); c.lineWidth = 1.5;
  for (let x = -4.5; x <= 4.51; x += .5) { if (x > sweep) break; c.strokeStyle = rgba(MINT, .12); const a = P(x, 0, -2.6), b = P(x, 0, 3.0); line(c, a[0], a[1], b[0], b[1]); }
  for (let z = -2.5; z <= 3.01; z += .5) { const xe = Math.min(4.6, sweep); if (xe < -4.6) break; c.strokeStyle = rgba(MINT, .12); const a = P(-4.6, 0, z), b = P(xe, 0, z); line(c, a[0], a[1], b[0], b[1]); }
  c.restore();
  if (sweep > -5 && sweep < 5) { // sweep plane edge
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba(WHITE, .9); c.lineWidth = 4; c.shadowColor = rgba(MINT, 1); c.shadowBlur = 30;
    const a = P(sweep, 0, -2.8), b = P(sweep, 0, 3.2); line(c, a[0], a[1], b[0], b[1]); c.restore();
  }

  // rooms: floor outline + low translucent walls
  ROOMS.forEach((r, i) => {
    const rp = eOutC(prog(lt, .15 + i * .12, .7 + i * .12)); if (rp <= 0) return;
    const wh = .55 * rp, [x0, x1] = r.x, [z0, z1] = r.z;
    const bot = [[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]];
    c.save(); c.globalAlpha *= rp;
    poly(c, P, [...bot, bot[0]]); c.fillStyle = rgba(MINT, .05); c.fill();
    for (let k = 0; k < 4; k++) {
      const a = bot[k], b = bot[(k + 1) % 4];
      poly(c, P, [a, b, [b[0], wh, b[2]], [a[0], wh, a[2]]]); c.fillStyle = rgba(MINT, .06); c.fill();
      c.strokeStyle = rgba(MINT, .9); c.lineWidth = 3; c.shadowColor = rgba(MINT, 1); c.shadowBlur = 14;
      const ta = P(a[0], wh, a[2]), tb = P(b[0], wh, b[2]); line(c, ta[0], ta[1], tb[0], tb[1]);
      c.strokeStyle = rgba(MINT, .5); c.lineWidth = 2; const ba = P(...a), bb = P(...b); line(c, ba[0], ba[1], bb[0], bb[1]);
      const va = P(a[0], 0, a[2]); line(c, va[0], va[1], ta[0], ta[1]);
    }
    c.restore();
    if (!r.hideLabel && zp < .3) {
      const [lx, ly] = r.name === 'SALON' ? P(-3.7, 0, -.55) : P(2.3, 0, -2.15);
      spaced(c, r.name, lx, ly, 6, 'JB7', 26, MINT, prog(lt, .6 + i * .1, 1 + i * .1) * (1 - zp * 3), 'center');
    }
  });
  const fp = prog(lt, .5, 1.1);
  if (fp > 0) { box3(c, P, SOFA, CYAN, .8 * fp, eOutC(fp)); box3(c, P, TABLE, CYAN, .5 * fp, eOutC(fp)); box3(c, P, COUNTER, CYAN, .8 * fp, eOutC(fp)); }

  // path guide (dashed, drawn ahead)
  const pathP = eInOutC(prog(lt, .4, .9));
  if (pathP > 0) {
    c.save(); c.setLineDash([10, 14]); c.lineDashOffset = -t * 40; c.strokeStyle = rgba(WHITE, .35 * pathP); c.lineWidth = 3;
    const pts = []; for (let k = 0; k <= 60 * pathP; k++) { const p = pathAt(k / 60 * pathLen.L); pts.push([p.x, 0, p.z]); }
    poly(c, P, pts); c.stroke(); c.restore();
  }

  // key beacon in the kitchen
  const kb = eOutC(prog(lt, .7, 1.2));
  if (kb > 0) {
    const [bx, by] = P(KEYP[0], KEYP[1], KEYP[2]), [tx, ty] = P(KEYP[0], 3.4, KEYP[2]);
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(bx, by, tx, ty); g.addColorStop(0, rgba(MINT, .9 * kb)); g.addColorStop(1, rgba(MINT, 0));
    c.strokeStyle = g; c.lineWidth = 14; c.shadowColor = rgba(MINT, 1); c.shadowBlur = 40; line(c, bx, by, tx, ty);
    c.strokeStyle = rgba(WHITE, .9 * kb); c.lineWidth = 3; line(c, bx, by, lerp(bx, tx, .7), lerp(by, ty, .7));
    for (let k = 0; k < 2; k++) {
      const rr0 = .32 + k * .22 + ((t * .5 + k * .5) % 1) * .3, pts = [];
      for (let j = 0; j <= 40; j++) { const an = j / 40 * TAU; pts.push([KEYP[0] + Math.cos(an) * rr0, KEYP[1] + .01, KEYP[2] + Math.sin(an) * rr0]); }
      c.setLineDash([12, 10]); c.lineDashOffset = t * 50 * (k ? -1 : 1); c.strokeStyle = rgba(MINT, (.9 - k * .35) * kb); c.lineWidth = 3; poly(c, P, pts); c.stroke();
    }
    c.restore();
    const [ix, iy] = P(KEYP[0], 2.2 + Math.sin(t * 3) * .08, KEYP[2]);
    drawKeyGlyph(c, ix, iy, 64 * Math.min(zoom, 3), MINT, kb, 1);
    if (zp < .2) spaced(c, 'KLUCZ NFC', ix - 10, iy - 92, 5, 'JB7', 26, MINT, kb * (1 - zp * 5), 'center');
  }

  // start marker
  const sm = prog(lt, .5, .9);
  if (sm > 0 && zp < .5) {
    const [sx, sy] = P(PATH[0][0], 0, PATH[0][1]);
    c.save(); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = rgba(CYAN, sm * (1 - ((t * 1.5) % 1))); c.lineWidth = 3; c.beginPath(); c.ellipse(sx, sy, 20 + ((t * 1.5) % 1) * 50, (20 + ((t * 1.5) % 1) * 50) * .55, 0, 0, TAU); c.stroke();
    c.restore();
    spaced(c, 'TY', sx, sy + 56, 4, 'JB7', 26, CYAN, sm, 'center');
  }

  // footsteps
  let lit = 0;
  STEPS.forEach((st, i) => {
    const ts = E.stepFirst + i * E.stepInterval, sp = t - ts;
    if (sp < 0) return; lit = i + 1;
    const pop = eOutBack(clamp(sp / .18)), age = clamp(sp / 2.5);
    const col = mix(WHITE, MINT, clamp(sp / .3));
    const ca = Math.cos(st.a), sa = Math.sin(st.a);
    const shape = (fx, fz, rx, rz) => { const pts = []; for (let k = 0; k < 16; k++) { const an = k / 16 * TAU, u = Math.cos(an) * rx * pop, v = Math.sin(an) * rz * pop; pts.push([st.x + (u + fx) * ca - (v + fz) * sa, .005, st.z + (u + fx) * sa + (v + fz) * ca]); } return pts; };
    c.save(); c.fillStyle = rgba(col, lerp(1, .6, age)); c.shadowColor = rgba(MINT, 1); c.shadowBlur = 18;
    poly(c, P, shape(.08, 0, .19, .11)); c.fill(); poly(c, P, shape(-.19, 0, .1, .09)); c.fill(); c.restore();
    if (sp < .55) { // ripple
      const rp = sp / .55, pts = []; for (let k = 0; k <= 30; k++) { const an = k / 30 * TAU; pts.push([st.x + Math.cos(an) * (.1 + rp * .55), 0, st.z + Math.sin(an) * (.1 + rp * .55)]); }
      c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba(MINT, 1 - rp); c.lineWidth = 3; poly(c, P, pts); c.stroke(); c.restore();
    }
  });
  // walker orb
  const wp = prog(t, E.stepFirst - .1, E.stepFirst + (N - 1) * E.stepInterval + .15);
  if (wp > 0 && zp < .6) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let k = 12; k >= 0; k--) { const q = pathAt(clamp(wp - k * .012) * pathLen.L), [ox, oy] = P(q.x, .25, q.z); c.fillStyle = rgba(CYAN, (1 - k / 13) * .5); c.beginPath(); c.arc(ox, oy, 12 - k * .6, 0, TAU); c.fill(); }
    const q = pathAt(wp * pathLen.L), [ox, oy] = P(q.x, .25, q.z);
    c.fillStyle = rgba(WHITE, 1); c.shadowColor = rgba(CYAN, 1); c.shadowBlur = 30; c.beginPath(); c.arc(ox, oy, 10, 0, TAU); c.fill();
    c.restore();
  }
  c.restore();

  // step counter panel
  const pa = eOutC(prog(lt, .3, .7)) * fadeOut * (1 - zp);
  if (pa > 0) {
    c.save(); c.globalAlpha = pa;
    const x = 90, y = 1262, w = 760, h = 150;
    rr(c, x, y, w, h, 18); c.fillStyle = 'rgba(2,20,14,0.7)'; c.fill(); c.strokeStyle = rgba(MINT, .55); c.lineWidth = 2; c.stroke();
    spaced(c, 'KROKI', x + 32, y + 52, 6, 'JB7', 24, MINT, .9);
    spaced(c, 'DO KLUCZA', x + 32, y + 84, 4, 'JB5', 20, WHITE, .55);
    const big = String(lit).padStart(2, '0');
    rich(c, [{ t: big, c: WHITE, glow: MINT }, { t: '/' + NS, c: MINT }], x + w - 34 - segWidth(c, [{ t: big }, { t: '/' + NS }], 'UB8', 88), y + 108, { fam: 'UB8', size: 88, blur: 26 });
    c.fillStyle = rgba(MINT, .15); c.fillRect(x + 32, y + h - 26, w - 64, 6);
    c.fillStyle = rgba(MINT, 1); c.shadowColor = rgba(MINT, 1); c.shadowBlur = 16; c.fillRect(x + 32, y + h - 26, (w - 64) * lit / N, 6);
    c.restore();
  }

  // text card
  const ta = fadeOut * (1 - zp);
  const s1 = fit(c, 'Żeby wejść,', 'UB8', 96, 760);
  c.save(); c.globalAlpha = ta;
  decodeLine(c, 'Żeby wejść,', CX, 380, { fam: 'UB8', size: s1, align: 'center', color: WHITE, glow: MINT, blur: 28 }, prog(lt, .05, .5), 41, f);
  const segs = [{ t: 'muszę po niego ', c: WHITE }, { t: 'iść.', c: MINT }];
  const s2 = fit(c, 'muszę po niego iść.', 'CP7', 70, 760), w2 = segWidth(c, segs, 'CP7', s2);
  wipe(c, prog(lt, .4, .8), CX - w2 / 2, CX + w2 / 2, 410, 500, () => rich(c, segs, CX, 478, { fam: 'CP7', size: s2, align: 'center', blur: 20 }));
  c.restore();
}

// ───────────────────────── scene D: NFC tap
function sceneNfc(c, t, f) {
  const [d0, d1] = S.nfc, lt = t - d0;
  const inP = eOutExpo(prog(lt, 0, .45)), out = prog(t, d1 - .22, d1 + .05);
  const ok = t >= E.unlock, okP = prog(t, E.unlock, E.unlock + .5);
  const col = ok ? MINT : RED;
  const pw = 360, ph = 700, px = CX - pw / 2, py = 560 + (1 - inP) * 120;
  c.save(); c.globalAlpha = (1 - out) * clamp(lt / .2);
  c.translate(CX, py + ph / 2); c.scale(lerp(.85, 1, inP) * (1 + out * .15), lerp(.85, 1, inP) * (1 + out * .15)); c.translate(-CX, -(py + ph / 2));

  // phone back
  phoneFrame(c, px, py, pw, ph, mix(RED, MINT, okP), 1, 1, t);
  rr(c, px + 28, py + 28, 140, 150, 34); c.strokeStyle = rgba(CYAN, .7); c.lineWidth = 3; c.stroke();
  for (const [lx, ly, r] of [[px + 68, py + 70, 24], [px + 68, py + 136, 24], [px + 128, py + 70, 14]]) { c.beginPath(); c.arc(lx, ly, r, 0, TAU); c.stroke(); }
  // NFC coil
  const coilC = [CX, py + 380];
  const wait = !ok && t < E.contact;
  for (let k = 0; k < 4; k++) {
    const s = 210 - k * 36, a = wait ? .25 + .25 * Math.sin(t * 6 - k) : ok ? .5 : .8;
    c.save(); c.strokeStyle = rgba(ok ? MINT : CYAN, a); c.lineWidth = 3; c.shadowColor = rgba(CYAN, 1); c.shadowBlur = 12;
    rr(c, coilC[0] - s / 2, coilC[1] - s / 2, s, s, 26 - k * 4); c.stroke(); c.restore();
  }
  if (wait) spaced(c, 'NFC', coilC[0], coilC[1] + 12, 6, 'JB7', 30, CYAN, .7 + .3 * Math.sin(t * 6), 'center');

  // key fob flight
  const kp = eOutC(prog(t, E.keyIn, E.contact - .05));
  const kx = lerp(-160, CX + 18, kp), ky = lerp(1720, coilC[1] + 40, kp), kr = lerp(-1.0, .22, kp);
  const hover = (1 - prog(t, E.contact - .25, E.contact)) * 26;
  const tap = t >= E.contact ? 1 - .03 * Math.sin(clamp((t - E.contact) / .15) * Math.PI) : 1;

  // waves + burst + data (under the key)
  const ct = t - E.contact;
  if (ct >= 0) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 6; k++) {
      const r = (ct - k * .16) * 640; if (r <= 0 || r > 700) continue;
      const a = (1 - r / 700) * (ok ? .7 : 1), wc = k % 2 ? CYAN : (ok ? MINT : WHITE);
      c.strokeStyle = rgba(wc, a); c.lineWidth = k % 2 ? 3 : 6; c.shadowColor = rgba(wc, 1); c.shadowBlur = 20;
      c.beginPath(); c.arc(coilC[0], coilC[1], r, 0, TAU); c.stroke();
      c.lineWidth = 12; for (let j = 0; j < 3; j++) { const a0 = j * TAU / 3 + ct * 2 * (k % 2 ? -1 : 1); c.beginPath(); c.arc(coilC[0], coilC[1], r + 14, a0, a0 + .35); c.stroke(); }
    }
    for (let i = 0; i < 90; i++) {
      const r = rng(900 + i), an = r() * TAU, sp = 300 + r() * 900, life = .6 + r() * .6, q = ct / life;
      if (q > 1) continue; const d = sp * (1 - Math.pow(1 - q, 3)) * .9;
      c.fillStyle = rgba(r() > .5 ? CYAN : WHITE, 1 - q); c.beginPath(); c.arc(coilC[0] + Math.cos(an) * d, coilC[1] + Math.sin(an) * d, 2 + r() * 3, 0, TAU); c.fill();
    }
    c.restore();
    // hex streams on both sides
    const da = clamp(ct / .2) * (1 - prog(t, E.unlock + .4, E.unlock + 1.0));
    if (da > 0) {
      setFont(c, 'JB5', 22);
      for (let s = 0; s < 8; s++) {
        const sx = s < 4 ? 110 + s * 34 : 730 + (s - 4) * 34;
        for (let k = 0; k < 18; k++) {
          const y = 1300 - ((k * 44 + ct * 420 + s * 37) % 800);
          const ch = '0123456789ABCDEF'[Math.floor(hr(s * 97 + k, Math.floor(t * 20)) * 16)];
          c.fillStyle = rgba(k % 5 === 0 ? WHITE : CYAN, da * (.25 + .6 * (1 - Math.abs(y - 900) / 420)));
          c.fillText(ch, sx, y);
        }
      }
    }
    // verification ring
    const vp = eInOutC(prog(t, E.contact + .05, E.verifyEnd));
    c.save(); c.lineCap = 'round';
    c.strokeStyle = rgba(WHITE, .15); c.lineWidth = 10; c.beginPath(); c.arc(coilC[0], coilC[1], 165, 0, TAU); c.stroke();
    c.strokeStyle = rgba(ok ? MINT : CYAN, 1); c.shadowColor = rgba(ok ? MINT : CYAN, 1); c.shadowBlur = 26; c.lineWidth = 10;
    c.beginPath(); c.arc(coilC[0], coilC[1], 165, -Math.PI / 2, -Math.PI / 2 + TAU * vp); c.stroke();
    c.setLineDash([6, 12]); c.lineDashOffset = -t * 80; c.lineWidth = 3; c.beginPath(); c.arc(coilC[0], coilC[1], 196, 0, TAU); c.stroke();
    c.restore();
  }

  // key fob
  c.save(); c.translate(kx, ky - hover); c.rotate(kr); c.scale(tap, tap);
  c.save(); c.translate(hover * .8, hover * 1.6); rr(c, -58, -150, 116, 300, 30); c.fillStyle = 'rgba(0,0,0,0.45)'; c.filter = 'blur(10px)'; c.fill(); c.restore();
  rr(c, -58, -150, 116, 300, 30);
  const kg = c.createLinearGradient(-58, -150, 58, 150); kg.addColorStop(0, '#16302a'); kg.addColorStop(1, '#07120f'); c.fillStyle = kg; c.fill();
  c.strokeStyle = rgba(MINT, .9); c.lineWidth = 4; c.shadowColor = rgba(MINT, 1); c.shadowBlur = 18; c.stroke();
  c.shadowBlur = 0; c.beginPath(); c.arc(0, -108, 20, 0, TAU); c.fillStyle = '#020806'; c.fill(); c.strokeStyle = rgba(MINT, .6); c.lineWidth = 3; c.stroke();
  const gg = c.createRadialGradient(-8, 30, 4, 0, 40, 40); gg.addColorStop(0, '#fff3c4'); gg.addColorStop(.5, rgba(GOLD, 1)); gg.addColorStop(1, '#9a6a12');
  c.beginPath(); c.arc(0, 40, 36, 0, TAU); c.fillStyle = gg; c.shadowColor = rgba(GOLD, 1); c.shadowBlur = ct >= 0 ? 40 : 14; c.fill();
  c.shadowBlur = 0; c.strokeStyle = 'rgba(80,50,0,0.6)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 40, 24, 0, TAU); c.stroke();
  c.restore();

  // unlock burst
  if (ok) {
    const bp = prog(t, E.unlock, E.unlock + .7);
    c.save(); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = rgba(MINT, 1 - bp); c.lineWidth = 10 * (1 - bp) + 1; c.shadowColor = rgba(MINT, 1); c.shadowBlur = 40;
    c.beginPath(); for (let i = 0; i <= 6; i++) { const an = i / 6 * TAU + .3, r = 120 + eOutC(bp) * 600; i ? c.lineTo(coilC[0] + Math.cos(an) * r, coilC[1] + Math.sin(an) * r) : c.moveTo(coilC[0] + Math.cos(an) * r, coilC[1] + Math.sin(an) * r); } c.stroke();
    c.restore();
  }
  c.restore();

  // status panel
  const pa = clamp(lt / .3) * (1 - out);
  c.save(); c.globalAlpha = pa;
  const x = 90, y = 1290, w = 760, h = 128;
  rr(c, x, y, w, h, 18); c.fillStyle = 'rgba(2,14,10,0.78)'; c.fill(); c.strokeStyle = rgba(col, .6); c.lineWidth = 2; c.stroke();
  drawPadlock(c, x + 70, y + 60, 62, mix(RED, MINT, okP), eOutBack(okP), 1);
  let label, sub;
  if (t < E.contact) { label = 'OCZEKUJĘ NA KLUCZ'; sub = Math.floor(t * 3) % 2 ? '● ● ●' : '● ●'; }
  else if (!ok) { const pct = Math.round(eInOutC(prog(t, E.contact + .05, E.verifyEnd)) * 100); label = 'WERYFIKACJA KLUCZA'; sub = `${String(pct).padStart(3, ' ')}%`; }
  else if (t < E.unlock + .9) { label = 'KLUCZ ROZPOZNANY'; sub = ''; }
  else { label = 'DOSTĘP CZASOWY'; sub = ''; }
  spaced(c, label, x + 140, y + 60, 4, 'JB7', 30, ok ? MINT : (t < E.contact ? RED : CYAN), 1);
  if (sub) spaced(c, sub, x + 140, y + 98, 4, 'JB5', 24, WHITE, .75);
  if (ok && t < E.unlock + .9) drawCheck(c, x + w - 60, y + 62, 46, MINT, eOutC(prog(t, E.unlock, E.unlock + .3)));
  if (t >= E.unlock + .9) { const dp = prog(t, E.unlock + .9, d1 + 2.5); c.fillStyle = rgba(MINT, .15); c.fillRect(x + 140, y + 88, w - 180, 8); c.fillStyle = rgba(MINT, 1); c.shadowColor = rgba(MINT, 1); c.shadowBlur = 14; c.fillRect(x + 140, y + 88, (w - 180) * (1 - dp), 8); }
  c.restore();

  // text card
  const ta = 1 - out;
  c.save(); c.globalAlpha = ta;
  const s1 = fit(c, 'Przykładam klucz.', 'UB8', 96, 760);
  decodeLine(c, 'Przykładam klucz.', CX, 380, { fam: 'UB8', size: s1, align: 'center', color: WHITE, glow: MINT, blur: 28 }, prog(lt, .1, .6), 53, f);
  const segs = [{ t: 'Dostęp ', c: WHITE }, { t: 'na chwilę.', c: MINT }];
  const s2 = fit(c, 'Dostęp na chwilę.', 'CP7', 70, 760), w2 = segWidth(c, segs, 'CP7', s2);
  wipe(c, prog(t, E.unlock + .1, E.unlock + .5), CX - w2 / 2, CX + w2 / 2, 410, 500, () => rich(c, segs, CX, 478, { fam: 'CP7', size: s2, align: 'center', blur: 20 }));
  c.restore();
}

// ───────────────────────── scene E: payoff
function scenePayoff(c, t, f) {
  const [e0, e1] = S.payoff, lt = t - e0;
  const out = prog(t, e1 - .22, e1 + .05);
  c.save(); c.globalAlpha = 1 - out;
  const sl = t - E.payoffSlam;
  reticle(c, CX, 960, 330, t, .35 * eOutC(prog(lt, 0, .5)) + (sl > 0 ? .4 * (1 - prog(sl, 0, .8)) : 0), MINT, lerp(1.3, 1, eOutExpo(prog(lt, 0, .6))) + (sl > 0 ? .08 * (1 - prog(sl, 0, .5)) : 0));

  const l1 = [{ t: NS + ' ', c: MINT }, { t: 'kroków', c: WHITE }];
  const s1 = fit(c, NS + ' kroków', 'UB8', 112, 760), w1 = segWidth(c, l1, 'UB8', s1);
  wipe(c, prog(lt, .02, .35), CX - w1 / 2, CX + w1 / 2, 560, 700, () => rich(c, l1, CX, 680, { fam: 'UB8', size: s1, align: 'center', blur: 34 }));
  const s2 = fit(c, 'na decyzję:', 'CP6', 84, 760);
  decodeLine(c, 'na decyzję:', CX, 800, { fam: 'CP6', size: s2, align: 'center', color: WHITE, glow: MINT, blur: 18 }, prog(lt, .3, .75), 67, f);

  const s3 = fit(c, 'naprawdę', 'UB8', 132, 760), s4 = fit(c, 'chcesz?', 'UB8', 170, 760);
  if (sl >= 0) {
    slamLine(c, [{ t: 'naprawdę', c: WHITE, glow: MINT }], CX, 1060, { fam: 'UB8', size: s3, align: 'center', blur: 36 }, sl);
    slamLine(c, [{ t: 'chcesz?', c: MINT }], CX, 1250, { fam: 'UB8', size: s4, align: 'center', blur: 60 }, sl - .07);
    // shockwave
    const sp = prog(sl, 0, .7);
    if (sp < 1) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba(MINT, 1 - sp); c.lineWidth = 14 * (1 - sp) + 1; c.shadowColor = rgba(MINT, 1); c.shadowBlur = 40; c.beginPath(); c.ellipse(CX, 1150, 100 + eOutC(sp) * 700, (100 + eOutC(sp) * 700) * .5, 0, 0, TAU); c.stroke(); c.restore(); }
  }
  // footsteps callback
  for (let i = 0; i < N; i++) {
    const on = prog(lt, .2 + i * .045, .3 + i * .045); if (on <= 0) continue;
    const x = 150 + i * (640 / (N - 1)), y = 1392 + (i % 2 ? 10 : -10);
    c.save(); c.translate(x, y); c.rotate(i % 2 ? .18 : -.18); c.globalAlpha *= on; c.fillStyle = rgba(MINT, 1); c.shadowColor = rgba(MINT, 1); c.shadowBlur = 14;
    c.beginPath(); c.ellipse(0, -7, 11, 17, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(0, 15, 8, 9, 0, 0, TAU); c.fill(); c.restore();
  }
  c.restore();
}

// ───────────────────────── scene F: end card
function logo(c, x, y, s, p, t) {
  c.save(); c.translate(x, y);
  const R = s / 2, L = s * .32, rad = s * .16;
  c.strokeStyle = rgba(MINT, 1); c.lineWidth = s * .075; c.lineCap = 'round'; c.lineJoin = 'round'; c.shadowColor = rgba(MINT, 1); c.shadowBlur = 30;
  const per = L * 2 + rad * 1.6;
  c.setLineDash([per * p, per * 2]);
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    c.beginPath(); c.moveTo(sx * R, sy * (R - L)); c.lineTo(sx * R, sy * (R - rad)); c.quadraticCurveTo(sx * R, sy * R, sx * (R - rad), sy * R); c.lineTo(sx * (R - L), sy * R); c.stroke();
  }
  c.setLineDash([]); c.restore();
  drawKeyGlyph(c, x + s * .02, y + s * .02, s * .36, MINT, 1, clamp(p * 1.2 - .2));
}

function sceneEnd(c, t, f) {
  const [f0, f1] = S.end, lt = t - f0;
  const outro = prog(t, E.outro, f1 - .05);
  c.save(); c.globalAlpha = 1 - eInC(outro);
  c.translate(CX, 900); c.scale(1 + eInExpo(outro) * .2, 1 + eInExpo(outro) * .2); c.translate(-CX, -900);

  // converging particles
  const cv = prog(lt, 0, .7);
  if (cv < 1) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 70; i++) { const r = rng(1200 + i), an = r() * TAU, d0 = 300 + r() * 600, d = d0 * (1 - eInOutC(cv)); c.fillStyle = rgba(r() > .4 ? MINT : CYAN, .8 * (1 - cv)); c.beginPath(); c.arc(CX + Math.cos(an) * d, 620 + Math.sin(an) * d, 2 + r() * 3, 0, TAU); c.fill(); }
    c.restore();
  }
  const lp = eInOutC(prog(lt, .05, .75));
  const pulse = 1 + .04 * Math.sin(t * 4) * prog(lt, .9, 1.2);
  c.save(); c.translate(CX, 620); c.scale(pulse, pulse); c.translate(-CX, -620);
  if (lp > 0) {
    rr(c, CX - 165, 455, 330, 330, 70); c.fillStyle = rgba(MINT, .07 * lp); c.fill();
    logo(c, CX, 620, 240, lp, t);
  }
  c.restore();
  const s1 = fit(c, 'KEY TO FOCUS', 'UB8', 92, 720);
  decodeLine(c, 'KEY TO FOCUS', CX, 930, { fam: 'UB8', size: s1, align: 'center', color: WHITE, glow: MINT, blur: 30 }, prog(lt, .3, .85), 79, f);
  // divider
  const dv = eOutC(prog(lt, .7, 1.1));
  c.save(); c.strokeStyle = rgba(MINT, .8); c.lineWidth = 3; c.shadowColor = rgba(MINT, 1); c.shadowBlur = 16; line(c, CX - 330 * dv, 985, CX + 330 * dv, 985); c.restore();

  const s2 = fit(c, 'SZUKAM TESTERÓW', 'CP7', 82, 760);
  const w2 = segWidth(c, [{ t: 'SZUKAM TESTERÓW' }], 'CP7', s2);
  wipe(c, prog(lt, .8, 1.15), CX - w2 / 2, CX + w2 / 2, 1010, 1110, () => rich(c, [{ t: 'SZUKAM TESTERÓW', c: MINT }], CX, 1088, { fam: 'CP7', size: s2, align: 'center', blur: 26 }));
  const s3 = fit(c, 'Android 8+  ·  NFC  ·  bezpłatnie', 'CP6', 50, 760);
  decodeLine(c, 'Android 8+  ·  NFC  ·  bezpłatnie', CX, 1170, { fam: 'CP6', size: s3, align: 'center', color: WHITE, glow: MINT, blur: 14 }, prog(lt, 1.0, 1.45), 83, f);

  // pill: LINK W BIO
  const pp = eOutBack(prog(t, E.pill, E.pill + .4));
  if (pp > 0) {
    const pw = 520, ph = 104, px = CX - pw / 2, py = 1232;
    c.save(); c.translate(CX, py + ph / 2); c.scale(pp, pp); c.translate(-CX, -(py + ph / 2));
    const glowP = .6 + .4 * Math.sin(t * 5);
    rr(c, px, py, pw, ph, ph / 2); c.fillStyle = rgba(MINT, .14 + .08 * glowP); c.fill();
    c.strokeStyle = rgba(MINT, 1); c.lineWidth = 4; c.shadowColor = rgba(MINT, 1); c.shadowBlur = 20 + 20 * glowP; c.stroke(); c.shadowBlur = 0;
    // sheen
    c.save(); rr(c, px, py, pw, ph, ph / 2); c.clip(); const sx = px - 200 + ((t - E.pill) * 500 % (pw + 400));
    const sg = c.createLinearGradient(sx, 0, sx + 160, 0); sg.addColorStop(0, rgba(WHITE, 0)); sg.addColorStop(.5, rgba(WHITE, .35)); sg.addColorStop(1, rgba(WHITE, 0));
    c.fillStyle = sg; c.fillRect(px, py, pw, ph); c.restore();
    rich(c, [{ t: 'LINK W BIO', c: WHITE, glow: MINT }], CX - 40, py + 68, { fam: 'UB8', size: 44, align: 'center', blur: 18 });
    // arrow
    const ax = CX + 186 + Math.sin(t * 6) * 5, ay = py + ph / 2;
    c.strokeStyle = rgba(MINT, 1); c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round'; c.shadowColor = rgba(MINT, 1); c.shadowBlur = 16;
    c.beginPath(); c.moveTo(ax - 18, ay + 18); c.lineTo(ax + 16, ay - 16); c.moveTo(ax - 8, ay - 16); c.lineTo(ax + 16, ay - 16); c.lineTo(ax + 16, ay + 8); c.stroke();
    c.restore();
  }
  c.restore();
}

// ───────────────────────── post effects
function bloom(c) {
  const a = bloomA.getContext('2d'), b = bloomB.getContext('2d');
  a.filter = 'none'; a.clearRect(0, 0, 270, 480); a.filter = 'blur(5px)'; a.drawImage(main, 0, 0, 270, 480); a.filter = 'none';
  b.clearRect(0, 0, 135, 240); b.filter = 'blur(6px)'; b.drawImage(bloomA, 0, 0, 135, 240); b.filter = 'none';
  c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = .42; c.drawImage(bloomA, 0, 0, W, H); c.globalAlpha = .38; c.drawImage(bloomB, 0, 0, W, H); c.restore();
}

function rgbSplit(c, d) {
  const cols = ['#ff0000', '#00ff00', '#0000ff'], offs = [-d, 0, d];
  chan.forEach((cv, i) => { const x = cv.getContext('2d'); x.globalCompositeOperation = 'source-over'; x.drawImage(main, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = cols[i]; x.fillRect(0, 0, W, H); });
  c.save(); c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'lighter';
  chan.forEach((cv, i) => c.drawImage(cv, offs[i], 0)); c.restore();
}

function glitch(c, t, f) {
  let I = 0;
  for (const [a, b] of TL.glitch) if (t >= a && t <= b) { const m = (a + b) / 2; I = Math.max(I, 1 - Math.abs(t - m) / ((b - a) / 2)); }
  if (I <= 0) return 0;
  rgbSplit(c, Math.round(4 + I * 22));
  tctx.drawImage(main, 0, 0);
  const n = Math.floor(5 + I * 16);
  for (let i = 0; i < n; i++) {
    const y = Math.floor(hr(f, i * 3) * H), h = Math.floor(6 + hr(f, i * 3 + 1) * 90 * I), dx = Math.round((hr(f, i * 3 + 2) - .5) * 260 * I);
    c.drawImage(tmp, 0, y, W, h, dx, y, W, h);
    if (hr(f, i + 50) > .7) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = rgba(hr(f, i + 60) > .5 ? MINT : RED, .18 * I); c.fillRect(0, y, W, h); c.restore(); }
  }
  // blocky dropout
  for (let i = 0; i < 6 * I; i++) { c.fillStyle = rgba(hr(f, i + 90) > .5 ? MINT : WHITE, .5 * I); c.fillRect(hr(f, i + 70) * W, hr(f, i + 80) * H, 30 + hr(f, i + 85) * 160, 6 + hr(f, i + 95) * 18); }
  return I;
}

function flashes(c, t) {
  const fl = [[E.slam, RED, .55, .25], [E.contact, CYAN, .25, .25], [E.unlock, MINT, .45, .35], [E.payoffSlam, MINT, .4, .3], [S.plan[1] - .08, WHITE, .5, .25]];
  for (const [t0, col, a, d] of fl) { const p = (t - t0) / d; if (p >= 0 && p < 1) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = rgba(col, a * Math.pow(1 - p, 2)); c.fillRect(0, 0, W, H); c.restore(); } }
}

function shake(t) {
  let x = 0, y = 0;
  for (const [t0, amp] of [[E.slam, 26], [E.contact, 10], [E.unlock, 12], [E.payoffSlam, 30]]) {
    const d = t - t0; if (d < 0 || d > .45) continue;
    const k = amp * Math.exp(-d * 9); x += Math.sin(d * 95) * k; y += Math.cos(d * 77) * k * .7;
  }
  return [x, y];
}

// ───────────────────────── frame
function frame(f) {
  const t = f / FPS;
  ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0; ctx.setLineDash([]);
  background(ctx, t, f);
  const [sx, sy] = shake(t);
  ctx.save(); ctx.translate(sx, sy);
  if (t < S.hook[1] + .05) sceneHook(ctx, t, f);
  if (t >= S.lock[0] && t < S.lock[1] + .05) sceneLock(ctx, t, f);
  if (t >= S.plan[0] && t < S.plan[1] + .02) scenePlan(ctx, t, f);
  if (t >= S.nfc[0] && t < S.nfc[1] + .05) sceneNfc(ctx, t, f);
  if (t >= S.payoff[0] && t < S.payoff[1] + .05) scenePayoff(ctx, t, f);
  if (t >= S.end[0]) sceneEnd(ctx, t, f);
  ctx.restore();
  hud(ctx, t, f);
  bloom(ctx);
  glitch(ctx, t, f);
  flashes(ctx, t);
  ctx.drawImage(scan, 0, 0);
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .09; ctx.imageSmoothingEnabled = false; ctx.drawImage(grains[f % 6], 0, 0, W, H); ctx.restore();
  ctx.drawImage(vign, 0, 0);
  ctx.restore();
}

// ───────────────────────── main
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
if (args.still) {
  const dir = args.dir || './stills'; fs.mkdirSync(dir, { recursive: true });
  for (const s of String(args.still).split(',')) { const f = Math.round(parseFloat(s) * FPS); frame(f); fs.writeFileSync(path.join(dir, `f_${s}.png`), main.toBuffer('image/png')); }
  console.log('stills written');
} else {
  const out = args.out || './video_noaudio.mp4';
  const total = Math.round(DUR * FPS);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = 0; f < total; f++) {
    frame(f);
    if (!ff.stdin.write(main.data())) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 60 === 0) process.stdout.write(`frame ${f}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('done', out, ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
