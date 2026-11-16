// Key to Focus — Reel "Idę do łazienki na 2 minuty."
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
  c.save(); setFont(c, o.fam, o.size); c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.globalAlpha *= o.alpha ?? 1;
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
  c.save(); c.textAlign = 'left'; c.globalAlpha *= o.alpha ?? 1;
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
  c.save(); setFont(c, fam, size); c.globalAlpha *= alpha;
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
  c.save(); c.translate(x, y); c.rotate(-Math.PI / 4); c.globalAlpha *= a;
  c.strokeStyle = rgba(col, 1); c.lineWidth = s * .13; c.lineCap = 'round'; c.lineJoin = 'round';
  c.shadowColor = rgba(col, 1); c.shadowBlur = s * .35;
  const L = s * 3.2; c.setLineDash([L * draw, L]);
  c.beginPath(); c.arc(-s * .55, 0, s * .32, Math.PI * .15, Math.PI * 2.15);
  c.moveTo(-s * .23, 0); c.lineTo(s * .75, 0); c.moveTo(s * .45, 0); c.lineTo(s * .45, s * .26); c.moveTo(s * .7, 0); c.lineTo(s * .7, s * .2);
  c.stroke(); c.restore();
}

function drawPadlock(c, x, y, s, col, open = 0, a = 1) {
  c.save(); c.translate(x, y); c.globalAlpha *= a; c.strokeStyle = rgba(col, 1); c.lineWidth = s * .12; c.lineCap = 'round';
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
  c.save(); c.translate(x, y); c.scale(scale, scale); c.globalAlpha *= a; c.lineCap = 'butt';
  c.shadowColor = rgba(col, 1); c.shadowBlur = 14;
  c.strokeStyle = rgba(col, .55); c.lineWidth = 3; c.setLineDash([22, 14]); c.lineDashOffset = -t * 60;
  c.beginPath(); c.arc(0, 0, R, 0, TAU); c.stroke(); c.setLineDash([]);
  for (let i = 0; i < 72; i++) { const an = i / 72 * TAU + t * .15, l = i % 6 === 0 ? 26 : 10; c.strokeStyle = rgba(col, i % 6 === 0 ? .8 : .3); c.lineWidth = i % 6 === 0 ? 3 : 2; line(c, Math.cos(an) * (R - 18), Math.sin(an) * (R - 18), Math.cos(an) * (R - 18 - l), Math.sin(an) * (R - 18 - l)); }
  c.strokeStyle = rgba(col, .9); c.lineWidth = 7;
  for (let k = 0; k < 3; k++) { const a0 = -t * .9 + k * TAU / 3; c.beginPath(); c.arc(0, 0, R + 26, a0, a0 + .55); c.stroke(); }
  c.strokeStyle = rgba(col, .35); c.lineWidth = 2; c.beginPath(); c.arc(0, 0, R * .78, t * .5, t * .5 + 4.6); c.stroke();
  c.restore();
}

// ───────────────────────── reel: "Idę do łazienki na 2 minuty."
const VIOLET = [150, 96, 255], AMBER = [255, 196, 70], HOT = [255, 84, 120], ORANGE = [255, 138, 52];
const TAPS = E.taps, NT = TAPS.length;
const SAMPLES = Number(process.env.SAMPLES || 1), SHUTTER = .6;
const acc = createCanvas(W, H), actx = acc.getContext('2d');
const VP0 = [CX, 880];
const PLAN = 120, FINAL = 25 * 60 + 47; // bathroom timer, seconds: the plan and the reality

function tapInfo(t) { let n = 0; while (n < NT && TAPS[n] <= t) n++; return { n, last: n ? TAPS[n - 1] : -9, next: n < NT ? TAPS[n] : null }; }
function secAt(t) {
  const { n, last, next } = tapInfo(t), pre = 14 * clamp(t / TAPS[0]);
  if (!n) return pre;
  const gap = next ? next - last : .3, per = (FINAL - 14) / NT;
  return 14 + per * (n - 1 + eOutC(prog(t, last, last + Math.min(.22, gap * .7))));
}
function heatAt(t) { return t < S.twist[0] ? Math.pow(clamp((secAt(t) - PLAN) / (FINAL - PLAN)), .6) : 1 - prog(t, S.twist[0], S.twist[0] + .45); }
function worldAt(t) { return prog(t, E.morphStart + .5, E.keyFormed); }
function accent(t) { return mix(mix(VIOLET, ORANGE, heatAt(t) * .9), MINT, worldAt(t)); }
const fmtTimer = s => { s = Math.floor(s + .001); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
function fmtClock(sec) { const m = Math.floor(21 * 60 + 30 + sec / 60 + .001) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }

// camera travel down the corridor = integral of speed, so nothing ever jumps
const SPEED_KEYS = [[0, .45], [3.1, 2.6], [3.3, .12], [3.75, .12], [3.8, .5], [6.0, .35], [6.3, 3.0], [7.2, 2.0], [7.4, .5], [7.5, 1.5], [9.4, .9], [11.25, 1.1], [14.0, .7], [17.2, .6], [17.8125, 3.4]];
function travelAt(t) { let tr = 0, sp = SPEED_KEYS[0][1]; for (let i = 0; i < SPEED_KEYS.length - 1; i++) { const [t0, s0] = SPEED_KEYS[i], [t1, s1] = SPEED_KEYS[i + 1]; if (t <= t0) break; const tt = Math.min(t, t1), u = (tt - t0) / (t1 - t0); tr += (t1 - t0) * (s0 * u + (s1 - s0) * u * u / 2); sp = lerp(s0, s1, u); } return { tr, sp }; }
function vpAt(t) { const e = t >= S.lock[0] && t < S.lock[1] ? eInOutC(prog(t, E.reveal, E.reveal + .55)) : 0; return [lerp(CX, 624, e), lerp(880, 800, e)]; }
function keyZ(t) { if (t < E.flyStart) return 1; const u = prog(t, E.flyStart, E.flyEnd); const pull = u < .16 ? -Math.sin(u / .16 * Math.PI) * .1 : 0; return 1 + pull + 9 * eInOutC(clamp((u - .1) / .9)); }

// ───────────────────────── background: neon corridor
const CW = 640, CHH = 1150, ZN = 14;
function background(c, t, f) {
  const heat = heatAt(t), world = worldAt(t), col = accent(t), [vx, vy] = vpAt(t), { tr, sp } = travelAt(t);
  const c0 = mix(mix([40, 18, 78], [74, 32, 8], heat), [8, 50, 34], world), c1 = mix(mix([14, 6, 30], [24, 10, 3], heat), [2, 17, 12], world);
  const g = c.createRadialGradient(vx, vy, 30, vx, vy + 40, 1350);
  g.addColorStop(0, rgba(c0, 1)); g.addColorStop(.5, rgba(c1, 1)); g.addColorStop(1, 'rgb(2,3,5)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const fg = c.createRadialGradient(vx, vy, 0, vx, vy, 320); fg.addColorStop(0, rgba(col, .3)); fg.addColorStop(1, rgba(col, 0));
  c.fillStyle = fg; c.fillRect(vx - 320, vy - 320, 640, 640);
  const flying = t >= E.flyStart && t < S.twist[1], kz = flying ? keyZ(t) : -99;
  c.save();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const x0 = vx + sx * CW / (ZN + 1), y0 = vy + sy * CHH / (ZN + 1), x1 = vx + sx * CW, y1 = vy + sy * CHH;
    const lg = c.createLinearGradient(x0, y0, x1, y1); lg.addColorStop(0, rgba(col, 0)); lg.addColorStop(.12, rgba(col, .32)); lg.addColorStop(1, rgba(col, .06));
    c.strokeStyle = lg; c.lineWidth = 2; line(c, x0, y0, x1, y1);
  }
  for (let k = 0; k < ZN; k++) {
    const z = 1 + (((k - tr) % ZN) + ZN) % ZN, hw = CW / z, hh = CHH / z;
    let a = .24 * clamp((z - 1) / .7) * clamp((ZN + 1 - z) / 3);
    const boost = Math.exp(-(((z - kz) / .8) ** 2));
    a = Math.min(1, a * (1 + boost * 5));
    c.strokeStyle = rgba(mix(col, WHITE, boost * .6), a); c.lineWidth = clamp(6 / z, 1.5, 6);
    if (boost > .2) { c.shadowColor = rgba(col, 1); c.shadowBlur = 26 * boost; } else c.shadowBlur = 0;
    c.strokeRect(vx - hw, vy - hh, hw * 2, hh * 2);
    c.shadowBlur = 0; c.fillStyle = rgba(col, a * .9); const mw = 90 / z; c.fillRect(vx - mw, vy + hh - 3 / z, mw * 2, clamp(6 / z, 1.5, 6));
  }
  c.restore();
  c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
  for (const p of particles) {
    const X = (p.x - W / 2) * 2.4, Y = (p.y - H / 2) * 2.4;
    const z = 1 + ((((p.ph / TAU) * ZN - tr) % ZN) + ZN) % ZN, z2 = z + .08 + sp * .3;
    const a = clamp((z - 1) / .5) * clamp((ZN + 1 - z) / 3) * .6 * p.z; if (a <= .01) continue;
    c.strokeStyle = rgba(col, a); c.lineWidth = clamp(3.2 / z, 1, 3.2); line(c, vx + X / z, vy + Y / z, vx + X / z2, vy + Y / z2);
  }
  c.restore();
  const sy2 = ((t * 520) % (H + 600)) - 300;
  const sg = c.createLinearGradient(0, sy2 - 120, 0, sy2 + 120); sg.addColorStop(0, rgba(col, 0)); sg.addColorStop(.5, rgba(col, .04)); sg.addColorStop(1, rgba(col, 0));
  c.fillStyle = sg; c.fillRect(0, sy2 - 120, W, 240);
}

// ───────────────────────── HUD
function hud(c, t, f) {
  const col = accent(t), keys = Object.keys(S), { n } = tapInfo(t);
  let si = keys.findIndex(k => t >= S[k][0] && t < S[k][1]); if (si < 0) si = keys.length - 1;
  c.save(); c.globalAlpha = .72;
  const L = 70, m = 38;
  glowStroke(c, col, .8, 3, 10, () => { for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { c.beginPath(); c.moveTo(x, y + sy * L); c.lineTo(x, y); c.lineTo(x + sx * L, y); c.stroke(); } });
  spaced(c, 'KEY TO FOCUS', 62, 196, 6, 'JB7', 22, col, .8);
  spaced(c, '// SYS 0.18', 300, 196, 4, 'JB5', 22, col, .5);
  spaced(c, `T+00:${t.toFixed(2).padStart(5, '0')}`, W - 62, 196, 3, 'JB5', 22, col, .6, 'right');
  c.strokeStyle = rgba(col, .35); c.lineWidth = 2;
  for (let i = 0; i < 40; i++) { const y = 260 + ((i * 30 + t * 40) % 1200), l = i % 5 === 0 ? 18 : 8; line(c, 44, y, 44 + l, y); }
  const status = si === 0 ? (n ? `ROLKI W ŁAZIENCE ×${n}` : 'PLAN: 2 MINUTY') : ['', 'INSTAGRAM » KLUCZ NFC', 'BLOKADA AKTYWNA', 'TRYB SKUPIENIA', 'TRYB SKUPIENIA'][si];
  spaced(c, `SCENA ${String(si + 1).padStart(2, '0')}/05`, 62, 1560, 4, 'JB5', 22, col, .55);
  spaced(c, 'STATUS: ' + status, 330, 1560, 4, 'JB5', 22, col, .55);
  keys.forEach((k, i) => { const [a, b] = S[k], x = 62 + i * 154, p = prog(t, a, b); c.fillStyle = rgba(col, .18); c.fillRect(x, 1590, 138, 4); c.fillStyle = rgba(col, .85); c.fillRect(x, 1590, 138 * p, 4); });
  c.restore();
}

// ───────────────────────── shared pieces
const PH = { w: 440, h: 790, cx: CX, cy: 935 }, PSC = .9;

function phone(c, cx, cy, w, h, o, drawScreen) {
  const ti = o.tilt || 0, r = 56;
  c.save(); c.translate(cx, cy); c.rotate(o.rot || 0); c.scale(o.scale || 1, o.scale || 1);
  c.transform(Math.cos(ti), Math.sin(ti) * .22, 0, 1, 0, 0);
  c.globalAlpha *= o.alpha ?? 1;
  const dx = -Math.sin(ti) * 30;
  rr(c, -w / 2 + dx, -h / 2 + 5, w, h, r); c.fillStyle = rgba(mix(o.col, [0, 0, 0], .74), 1); c.fill(); c.strokeStyle = rgba(o.col, .4); c.lineWidth = 2; c.stroke();
  rr(c, -w / 2, -h / 2, w, h, r); c.fillStyle = '#05060b'; c.fill();
  c.strokeStyle = rgba(o.col, .95); c.lineWidth = 5; c.shadowColor = rgba(o.col, 1); c.shadowBlur = 32; c.stroke(); c.shadowBlur = 0;
  c.save(); rr(c, -w / 2 + 12, -h / 2 + 12, w - 24, h - 24, r - 10); c.clip();
  drawScreen(c, w - 24, h - 24);
  const sh = c.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); sh.addColorStop(0, 'rgba(255,255,255,.07)'); sh.addColorStop(.38, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,.03)');
  c.fillStyle = sh; c.fillRect(-w / 2, -h / 2, w, h);
  c.restore();
  c.fillStyle = '#000'; c.beginPath(); c.arc(0, -h / 2 + 40, 9, 0, TAU); c.fill(); c.strokeStyle = rgba(o.col, .5); c.lineWidth = 2; c.stroke();
  c.restore();
}
function phonePt(cx, cy, o, lx, ly) {
  const s = o.scale || 1, ti = o.tilt || 0, r = o.rot || 0;
  const x = Math.cos(ti) * lx * s, y = (Math.sin(ti) * .22 * lx + ly) * s, cr = Math.cos(r), sr = Math.sin(r);
  return [cx + x * cr - y * sr, cy + x * sr + y * cr];
}
function finger(c, x, y, press, a) {
  if (a <= 0) return;
  c.save(); c.globalAlpha *= a; c.translate(x, y); const s = 1 - press * .2; c.scale(s, s);
  const g = c.createRadialGradient(-8, -10, 4, 0, 0, 44); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,.3)');
  c.fillStyle = g; c.shadowColor = 'rgba(255,255,255,.9)'; c.shadowBlur = 24; c.beginPath(); c.arc(0, 0, 40, 0, TAU); c.fill(); c.shadowBlur = 0;
  c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 3; c.stroke(); c.restore();
}
function fingerState(t, taps) {
  let k = 0, press = 0;
  for (const T of taps) { const d = t - T; if (d < 0) k = Math.max(k, eInOutC(prog(t, T - .22, T - .02))); else { k = Math.max(k, 1 - eOutC(prog(d, .06, .32))); press = Math.max(press, 1 - prog(d, 0, .1)); } }
  return { k, press };
}
function monoDigits(c, str, xRight, y, fam, size, col, glow, blur = 22) {
  c.save(); setFont(c, fam, size); const cw = c.measureText('0').width * .93, sw = c.measureText(':').width * 1.1;
  let x = xRight; c.textAlign = 'center'; c.fillStyle = rgba(col, 1);
  for (let i = str.length - 1; i >= 0; i--) { const w = str[i] === ':' ? sw : cw; c.shadowColor = rgba(glow, .9); c.shadowBlur = blur; c.fillText(str[i], x - w / 2, y); c.shadowBlur = 0; c.fillText(str[i], x - w / 2, y); x -= w; }
  c.restore(); return xRight - x;
}
function panel(c, col, a, draw) {
  if (a <= 0) return;
  c.save(); c.globalAlpha *= a; rr(c, 90, 1322, 760, 106, 18); c.fillStyle = 'rgba(4,6,10,.76)'; c.fill(); c.strokeStyle = rgba(col, .6); c.lineWidth = 2; c.stroke(); draw(); c.restore();
}
function footGlyph(c, x, y, s, ang, col, a) {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s); c.globalAlpha *= a; c.fillStyle = rgba(col, 1); c.shadowColor = rgba(col, 1); c.shadowBlur = 14;
  c.beginPath(); c.ellipse(0, -7, 11, 17, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(0, 15, 8, 9, 0, 0, TAU); c.fill(); c.restore();
}
function keyFob(c, x, y, s, rot, glow = 14, a = 1, flat = false) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.globalAlpha *= a;
  rr(c, -58, -150, 116, 300, 30);
  const kg = c.createLinearGradient(-58, -150, 58, 150); kg.addColorStop(0, '#16302a'); kg.addColorStop(1, '#07120f'); c.fillStyle = kg; c.fill();
  c.strokeStyle = rgba(MINT, .95); c.lineWidth = flat ? 7 : 4; if (!flat) { c.shadowColor = rgba(MINT, 1); c.shadowBlur = 18; } c.stroke();
  c.shadowBlur = 0; c.beginPath(); c.arc(0, -108, 20, 0, TAU); c.fillStyle = '#020806'; c.fill(); c.strokeStyle = rgba(MINT, flat ? 1 : .6); c.lineWidth = flat ? 5 : 3; c.stroke();
  const gg = c.createRadialGradient(-8, 30, 4, 0, 40, 40); gg.addColorStop(0, '#fff3c4'); gg.addColorStop(.5, rgba(GOLD, 1)); gg.addColorStop(1, '#9a6a12');
  c.beginPath(); c.arc(0, 40, 36, 0, TAU); c.fillStyle = flat ? rgba(GOLD, 1) : gg; if (!flat) { c.shadowColor = rgba(GOLD, 1); c.shadowBlur = glow; } c.fill();
  c.shadowBlur = 0; if (!flat) { c.strokeStyle = 'rgba(80,50,0,0.6)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 40, 24, 0, TAU); c.stroke(); }
  c.strokeStyle = rgba(MINT, flat ? 1 : .55); c.lineWidth = flat ? 5 : 3; c.lineCap = 'round';
  for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(0, 128, 10 + k * 9, -Math.PI * .78, -Math.PI * .22); c.stroke(); }
  c.restore();
}
// dark band behind the top text so the hook always reads first
function textShade(c, a = 1, y0 = 230, y1 = 640) {
  if (a <= 0) return;
  const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, `rgba(2,2,6,${.62 * a})`); g.addColorStop(.7, `rgba(2,2,6,${.45 * a})`); g.addColorStop(1, 'rgba(2,2,6,0)');
  c.fillStyle = g; c.fillRect(-80, y0 - 60, W + 160, y1 - y0 + 60);
}

// ───────────────────────── scene 1: two minutes in the bathroom
function feedYAt(t) { let y = 0; for (let i = 0; i < NT; i++) { const T = TAPS[i]; if (t <= T) break; const gap = i + 1 < NT ? TAPS[i + 1] - T : .35; y += 540 * eOutC(prog(t, T, T + Math.min(.5, gap * .95))); } return y; }
const FEED_COLS = [VIOLET, [255, 64, 170], CYAN, AMBER, [255, 120, 80], [90, 200, 255]];
function feedCard(c, x, y, w, h, k) {
  const r = rng(700 + k * 13), a = FEED_COLS[Math.floor(r() * 6)], b = FEED_COLS[Math.floor(r() * 6)];
  c.fillStyle = rgba(a, .95); c.beginPath(); c.arc(x + 22, y + 24, 16, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,255,255,.6)'; rr(c, x + 48, y + 13, 110 + r() * 70, 10, 5); c.fill();
  c.fillStyle = 'rgba(255,255,255,.28)'; rr(c, x + 48, y + 30, 76, 8, 4); c.fill();
  const iy = y + 52, ih = h - 106;
  const g = c.createLinearGradient(x, iy, x + w, iy + ih); g.addColorStop(0, rgba(a, .9)); g.addColorStop(1, rgba(b, .6));
  c.save(); rr(c, x, iy, w, ih, 18); c.fillStyle = g; c.fill(); c.clip();
  c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(x + w * (.25 + r() * .5), iy + ih * (.3 + r() * .3), 34 + r() * 40, 0, TAU); c.fill();
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.moveTo(x, iy + ih); c.lineTo(x + w * (.3 + r() * .3), iy + ih * .45); c.lineTo(x + w, iy + ih); c.fill();
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3;
  for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x + 18 + i * 44, y + h - 30, 11, 0, TAU); c.stroke(); }
  c.fillStyle = 'rgba(255,255,255,.3)'; rr(c, x + 150, y + h - 36, w - 170, 10, 5); c.fill();
}
function feedPhone(c, t, f, o = {}) {
  const tt = o.freezeT ?? t, heat = heatAt(tt), { n } = tapInfo(tt);
  const kick = n ? Math.exp(-(tt - TAPS[n - 1]) * 14) : 0;
  const po = { tilt: Math.sin(t * 1.15) * .1 + (o.tilt || 0), rot: Math.sin(t * .8) * .012 + (o.rot || 0), scale: (1 + kick * .03) * PSC, col: mix(VIOLET, ORANGE, heat * .9), alpha: o.alpha ?? 1 };
  const cx = PH.cx + (o.dx || 0), cy = PH.cy + (o.dy || 0);
  phone(c, cx, cy, PH.w, PH.h, po, (c2, sw, sh) => {
    c2.fillStyle = '#0b0714'; c2.fillRect(-sw / 2, -sh / 2, sw, sh);
    const fy = feedYAt(tt), per = 352, top = -sh / 2 + 96, k0 = Math.floor(fy / per) - 1;
    for (let k = k0; k < k0 + 5; k++) feedCard(c2, -sw / 2 + 18, top + k * per - fy, sw - 36, 330, k);
    c2.fillStyle = 'rgba(9,6,18,.95)'; c2.fillRect(-sw / 2, -sh / 2, sw, 80);
    setFont(c2, 'JB7', 27); c2.fillStyle = rgba(mix(WHITE, AMBER, heat), 1); c2.textAlign = 'left'; c2.fillText(fmtClock(secAt(tt)), -sw / 2 + 34, -sh / 2 + 58);
    c2.strokeStyle = 'rgba(255,255,255,.7)'; c2.lineWidth = 2.5; rr(c2, sw / 2 - 78, -sh / 2 + 38, 42, 20, 5); c2.stroke();
    c2.fillStyle = rgba(mix(WHITE, AMBER, heat), .8); c2.fillRect(sw / 2 - 74, -sh / 2 + 42, 34 * (1 - heat * .82), 12);
  });
  return { cx, cy, po };
}
// thumb flicks the feed upward on every tap
function swipeAt(t) {
  const { n, last, next } = tapInfo(t);
  if (!n) return { ly: 200, press: 0, a: prog(t, .08, .3) };
  const gap = next ? next - last : .35, s = Math.min(.17, gap * .6), d = t - last;
  if (d < s) return { ly: lerp(200, -150, eOutC(d / s)), press: 1, a: 1 };
  return { ly: lerp(-150, 200, eInOutC(clamp((d - s) / Math.max(.02, gap - s)))), press: 0, a: 1 };
}
const DSZ = (() => fit(ctx, '00:00', 'UB8', 300, 740))();
const DIG = (() => { setFont(ctx, 'UB8', DSZ); const m = ctx.measureText(fmtTimer(FINAL)); return { w: m.width, asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent }; })();
const DIG_Y = 1010; // baseline of the big timer
function sceneTaps(c, t, f) {
  const { n } = tapInfo(t), heat = heatAt(t), big = t - E.bigClock, sec = secAt(t);
  const ph = feedPhone(c, t, f);
  const sw = swipeAt(t), [fx, fy] = phonePt(ph.cx, ph.cy, ph.po, 70, sw.ly);
  finger(c, fx, fy, sw.press, sw.a * (1 - clamp(big / .08)));
  for (let i = 0; i < n; i++) {
    const age = t - TAPS[i]; if (age > 1.1) continue;
    const [bx, by] = phonePt(ph.cx, ph.cy, ph.po, 0, -60);
    const r = rng(40 + i * 7), dir = (i % 2 ? 1 : -1) * (.3 + r() * .7), e = eOutC(clamp(age / 1.1));
    const x = bx + dir * 330 * e, y = by - 40 - 300 * e + 150 * age * age, a = (1 - prog(age, .55, 1.1)) * (1 - clamp(big / .1)), sz = (38 + r() * 20) * lerp(.5, 1, eOutBack(clamp(age / .16)));
    c.save(); c.translate(x, y); c.rotate(dir * .2); rich(c, [{ t: '+1 rolka', c: AMBER }], 0, 0, { fam: 'UB7', size: sz, align: 'center', blur: 18, alpha: a }); c.restore();
  }

  // bottom panel: the bathroom timer
  const over = sec > PLAN;
  panel(c, accent(t), 1, () => {
    spaced(c, 'CZAS W ŁAZIENCE', 122, 1370, 4, 'JB7', 26, accent(t), 1);
    spaced(c, over ? 'PLAN: 02:00  ✕' : 'PLAN: 02:00', 122, 1404, 3, 'JB5', 21, over ? AMBER : WHITE, over ? .9 : .6);
    monoDigits(c, fmtTimer(sec), 820, 1402, 'UB8', 72, mix(WHITE, ORANGE, heat), mix(VIOLET, ORANGE, heat));
  });

  if (big >= 0) {
    c.fillStyle = `rgba(3,1,6,${.76 * clamp(big / .08)})`; c.fillRect(-80, -80, W + 160, H + 160);
    slamLine(c, [{ t: fmtTimer(FINAL), c: ORANGE, glow: ORANGE }], CX, DIG_Y, { fam: 'UB8', size: DSZ, align: 'center', blur: 60 }, big);
    spaced(c, 'W ŁAZIENCE', CX, 790, 10, 'JB7', 36, WHITE, .9 * clamp(big / .15), 'center');
    rich(c, [{ t: 'Nogi ', c: WHITE }, { t: 'zdrętwiały.', c: AMBER }], CX, 1130, { fam: 'CP7', size: 60, align: 'center', blur: 18, alpha: clamp((big - .1) / .12) });
  }

  // hook — fully drawn on frame 0, no intro animation
  textShade(c);
  const s1 = fit(c, 'Idę do łazienki', 'UB8', 104, 760);
  rich(c, [{ t: 'Idę do łazienki', c: WHITE, glow: mix(VIOLET, ORANGE, heat) }], CX, 372, { fam: 'UB8', size: s1, align: 'center', blur: 28 });
  const s2 = fit(c, 'na 2 minuty.', 'UB8', s1, 760);
  rich(c, [{ t: 'na ', c: WHITE, glow: mix(VIOLET, ORANGE, heat) }, { t: '2 minuty.', c: AMBER }], CX, 372 + Math.round(s1 * 1.28), { fam: 'UB8', size: s2, align: 'center', blur: 28 });
}

// ───────────────────────── scene 2: the timer becomes a key and leaves the room
const BC = [CX, DIG_Y - (DIG.asc - DIG.desc) / 2], KC = [CX, 930], KSC = 1.5;
function samplePoints(w, h, draw, step) {
  const cv = createCanvas(w, h), x = cv.getContext('2d'); draw(x);
  const d = x.getImageData(0, 0, w, h).data, pts = [];
  for (let yy = 0; yy < h; yy += step) for (let xx = 0; xx < w; xx += step) { const i = (yy * w + xx) * 4; if (d[i + 3] > 110) pts.push([xx - w / 2, yy - h / 2, d[i], d[i + 1], d[i + 2]]); }
  return pts;
}
const MORPH = (() => {
  const NP = 5200, r = rng(4242), cw = Math.ceil(DIG.w) + 40, ch = Math.ceil(DIG.asc + DIG.desc) + 40;
  const src = samplePoints(cw, ch, x => { setFont(x, 'UB8', DSZ); x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText(fmtTimer(FINAL), cw / 2, ch / 2 + (DIG.asc - DIG.desc) / 2); }, 3);
  const dstAll = samplePoints(560, 660, x => { keyFob(x, 280, 330, KSC, .22, 0, 1, true); }, 2);
  const wts = dstAll.map(p => .05 + (.3 * p[2] + .6 * p[3] + .1 * p[4]) / 255); let tot = 0; const cum = wts.map(w => (tot += w));
  const pick = () => { const v = r() * tot; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < v) lo = m + 1; else hi = m; } return dstAll[lo]; };
  const S1 = [...Array(NP)].map(() => src[Math.floor(r() * src.length)]).sort((a, b) => a[0] - b[0]);
  const D1 = [...Array(NP)].map(pick).sort((a, b) => a[0] - b[0]);
  return S1.map((s, i) => { const d = D1[i]; return {
    sx: BC[0] + s[0], sy: BC[1] + s[1], dx: KC[0] + d[0], dy: KC[1] + d[1], col: [Math.max(40, d[2]), Math.max(60, d[3]), Math.max(50, d[4])],
    d: (s[0] / cw + .5) * .3 + r() * .15, a0: r() * TAU, w: (r() - .5) * 7, r: 30 + r() * 170, lift: r() * 120, sz: 2 + r() * 2.2 }; });
})();
function morphPos(P, u) { const e = eInOutC(u), s = Math.sin(Math.PI * u), ang = P.a0 + u * P.w, rad = s * P.r; return [lerp(P.sx, P.dx, e) + Math.cos(ang) * rad, lerp(P.sy, P.dy, e) + Math.sin(ang) * rad * .8 - s * P.lift]; }
function keyAt(t) { const z = keyZ(t), u = prog(t, E.flyStart, E.flyEnd), hover = t < E.flyStart ? Math.sin(t * 3.2) * 8 : 0; return { x: VP0[0] + (KC[0] - VP0[0]) / z, y: VP0[1] + (KC[1] - VP0[1]) / z + hover, sc: KSC / z, rot: .22 + eInOutC(u) * TAU + (t < E.flyStart ? Math.sin(t * 2) * .05 : 0), z, u }; }

function sceneTwist(c, t, f) {
  const [b0, b1] = S.twist, r = t - E.rip, tm = prog(t, E.morphStart, E.morphEnd), out = prog(t, b1 - .1, b1);
  // the phone falls away under the fading dark overlay
  if (r < .45) feedPhone(c, t, f, { freezeT: E.rip - .002, dy: eInC(prog(r, 0, .45)) * 1000, rot: -prog(r, 0, .45) * .3, alpha: 1 - prog(r, 0, .35) });
  const ov = .76 * (1 - prog(r, .25, .7)); if (ov > 0) { c.fillStyle = `rgba(3,1,6,${ov})`; c.fillRect(-80, -80, W + 160, H + 160); }
  // the big timer shakes, then dissolves into particles
  const dA = 1 - prog(t, E.morphStart, E.morphStart + .3);
  if (dA > 0) {
    const jit = (1 - prog(r, 0, .4)) * 10 + prog(t, E.morphStart - .2, E.morphStart) * 6;
    c.save(); c.translate(Math.sin(t * 83) * jit, Math.cos(t * 71) * jit * .5);
    rich(c, [{ t: fmtTimer(FINAL), c: ORANGE, glow: ORANGE }], CX, DIG_Y, { fam: 'UB8', size: DSZ, align: 'center', blur: 60, alpha: dA, split: 4 + jit * .6 });
    c.restore();
    rich(c, [{ t: 'Nogi ', c: WHITE }, { t: 'zdrętwiały.', c: AMBER }], CX, 1130, { fam: 'CP7', size: 60, align: 'center', blur: 18, alpha: 1 - prog(t, E.morphStart - .05, E.morphStart + .2) });
  }
  if (t >= E.morphStart - .05 && t < E.keyFormed + .25) {
    const aKey = .5 * (1 - prog(t, E.keyFormed - .06, E.keyFormed + .2)), aBtn = .55 * prog(t, E.morphStart - .05, E.morphStart + .1);
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'butt';
    for (const P of MORPH) {
      const u = clamp((tm - P.d) / .55), [x, y] = morphPos(P, u), s = Math.sin(Math.PI * u);
      const hot = mix(ORANGE, WHITE, s * .2), col = u < .5 ? hot : mix(hot, P.col, (u - .5) * 2), sz = P.sz * (1 + s * .5);
      if (u > 0 && u < 1) { const [x0, y0] = morphPos(P, Math.max(0, u - .07)); c.strokeStyle = rgba(col, .22); c.lineWidth = Math.max(1, sz * .45); line(c, x0, y0, x, y); }
      const a = u <= 0 ? aBtn : u >= 1 ? aKey : .7; if (a <= .01) continue;
      c.fillStyle = rgba(col, a); c.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    }
    c.restore();
  }
  // the key
  const kA = prog(t, E.morphEnd - .1, E.keyFormed);
  if (kA > 0) {
    const K = keyAt(t), kf = t - E.keyFormed;
    const hg = c.createRadialGradient(K.x, K.y, 0, K.x, K.y, 420 * K.sc / KSC + 40); hg.addColorStop(0, rgba(MINT, .35 * kA)); hg.addColorStop(1, rgba(MINT, 0));
    c.fillStyle = hg; c.fillRect(K.x - 500, K.y - 500, 1000, 1000);
    if (kf >= 0 && kf < .7) { c.save(); c.globalCompositeOperation = 'lighter'; const rp = kf / .7; c.strokeStyle = rgba(MINT, 1 - rp); c.lineWidth = 10 * (1 - rp) + 1; c.shadowColor = rgba(MINT, 1); c.shadowBlur = 40; c.beginPath(); c.arc(K.x, K.y, 150 + eOutC(rp) * 560, 0, TAU); c.stroke(); c.restore(); }
    if (K.u > 0 && K.u < 1) for (let j = 8; j >= 1; j--) { const G = keyAt(t - j * .022); keyFob(c, G.x, G.y, G.sc, G.rot, 0, (1 - j / 9) * .32 * kA); }
    keyFob(c, K.x, K.y, K.sc, K.rot, 34, kA);
    if (kf > 0 && t < E.flyStart + .1) { const la = prog(kf, .05, .2) * (1 - prog(t, E.flyStart - .05, E.flyStart + .1)); reticle(c, KC[0], KC[1], 280, t, .5 * la, MINT, lerp(1.25, 1, eOutExpo(prog(kf, 0, .4)))); spaced(c, 'KLUCZ NFC', CX, KC[1] + 280, 8, 'JB7', 34, MINT, la, 'center'); }
    if (K.u > .6) { const da = prog(K.u, .6, 1); c.save(); c.globalAlpha *= da; c.strokeStyle = rgba(MINT, 1); c.lineWidth = 3; c.shadowColor = rgba(MINT, 1); c.shadowBlur = 26; c.strokeRect(VP0[0] - 64, VP0[1] - 112, 128, 216);
      const bg = c.createLinearGradient(0, VP0[1] - 520, 0, VP0[1] - 112); bg.addColorStop(0, rgba(MINT, 0)); bg.addColorStop(1, rgba(MINT, .7)); c.shadowBlur = 0; c.fillStyle = bg; c.fillRect(VP0[0] - 3, VP0[1] - 520, 6, 408);
      spaced(c, 'PRZEDPOKÓJ', VP0[0], VP0[1] + 150, 6, 'JB7', 28, MINT, 1, 'center'); c.restore(); }
    if (t > E.flyEnd - .1) { c.save(); c.globalCompositeOperation = 'lighter'; for (let k = 0; k < 3; k++) { const rp = ((t - E.flyEnd) * 2.2 + k / 3) % 1; if (rp < 0) continue; c.strokeStyle = rgba(MINT, (1 - rp) * .7); c.lineWidth = 3; c.beginPath(); c.arc(VP0[0], VP0[1], 20 + rp * 240, 0, TAU); c.stroke(); } c.restore(); }
  }
  // bottom panel
  panel(c, accent(t), prog(t, E.morphStart - .1, E.morphStart + .15) * (1 - out), () => {
    const fly = t >= E.flyStart, label = fly ? 'KLUCZ » PRZEDPOKÓJ' : t >= E.keyFormed ? 'KLUCZ NFC GOTOWY' : 'INSTAGRAM » KLUCZ NFC';
    const pr = fly ? prog(t, E.flyStart, E.flyEnd) : tm;
    spaced(c, label, 122, 1374, 4, 'JB7', 27, accent(t), 1);
    spaced(c, Math.round(pr * 100) + '%', 818, 1374, 2, 'JB7', 27, WHITE, .9, 'right');
    c.fillStyle = rgba(accent(t), .16); c.fillRect(122, 1394, 696, 8); c.fillStyle = rgba(accent(t), 1); c.shadowColor = rgba(accent(t), 1); c.shadowBlur = 14; c.fillRect(122, 1394, 696 * pr, 8); c.shadowBlur = 0;
  });
  // text boards
  textShade(c, 1 - out, 230, 600);
  const aA = 1 - prog(t, E.flyStart - .12, E.flyStart);
  if (aA > 0) { // board 2a: "A gdyby Instagram otwierał się kluczem?"
    c.save(); c.globalAlpha *= aA;
    const s1 = fit(c, 'otwierał się tylko', 'CP7', 66, 760);
    const l1 = [{ t: 'A gdyby ', c: WHITE }, { t: 'Instagram', c: WHITE }], w1 = segWidth(c, l1, 'CP7', s1);
    wipe(c, prog(r, .05, .26), CX - w1 / 2, CX + w1 / 2, 290, 380, () => rich(c, l1, CX, 352, { fam: 'CP7', size: s1, align: 'center', blur: 20 }), ORANGE);
    const l2 = [{ t: 'otwierał się tylko', c: WHITE }], w2 = segWidth(c, l2, 'CP7', s1);
    wipe(c, prog(r, .3, .5), CX - w2 / 2, CX + w2 / 2, 370, 460, () => rich(c, l2, CX, 432, { fam: 'CP7', size: s1, align: 'center', blur: 20 }), ORANGE);
    const s3 = fit(c, 'kluczem?', 'UB8', 116, 760);
    slamLine(c, [{ t: 'kluczem?', c: MINT }], CX, 552, { fam: 'UB8', size: s3, align: 'center', blur: 36 }, t - E.line2);
    c.restore();
  }
  const bt = t - E.flyStart;
  if (bt >= 0) { // board 2b: "A klucz leżał w przedpokoju?"
    c.save(); c.globalAlpha *= 1 - out;
    const l1 = [{ t: 'A klucz ', c: MINT }, { t: 'leżał', c: WHITE }];
    const s1 = fit(c, 'A klucz leżał', 'CP7', 72, 760), w1 = segWidth(c, l1, 'CP7', s1);
    wipe(c, prog(bt, 0, .2), CX - w1 / 2, CX + w1 / 2, 300, 400, () => rich(c, l1, CX, 374, { fam: 'CP7', size: s1, align: 'center', blur: 20 }));
    const s2 = fit(c, 'w przedpokoju?', 'UB8', 96, 760);
    slamLine(c, [{ t: 'w przedpokoju?', c: WHITE, glow: MINT }], CX, 490, { fam: 'UB8', size: s2, align: 'center', blur: 30 }, bt - .22);
    c.restore();
  }
}

// ───────────────────────── scene 3: no Instagram in here
function lockScreen(c, sw, sh, t, deny) {
  const col = mix(MINT, RED, deny);
  c.fillStyle = '#04100c'; c.fillRect(-sw / 2, -sh / 2, sw, sh);
  c.strokeStyle = rgba(col, .07); c.lineWidth = 1;
  for (let y = -sh / 2; y < sh / 2; y += 36) line(c, -sw / 2, y, sw / 2, y);
  for (let x = -sw / 2 + 10; x < sw / 2; x += 36) line(c, x, -sh / 2, x, sh / 2);
  if (deny > 0) { c.fillStyle = rgba(RED, .24 * deny); c.fillRect(-sw / 2, -sh / 2, sw, sh); }
  spaced(c, 'KEY TO FOCUS', 0, -sh / 2 + 122, 5, 'JB7', 25, col, .95, 'center');
  c.save(); c.translate(0, -56); c.rotate(t * .35); c.strokeStyle = rgba(col, .95); c.lineWidth = 4; c.shadowColor = rgba(col, 1); c.shadowBlur = 22; c.setLineDash([30, 12]);
  c.beginPath(); for (let i = 0; i <= 6; i++) { const an = i / 6 * TAU; i ? c.lineTo(Math.cos(an) * 138, Math.sin(an) * 138) : c.moveTo(138, 0); } c.stroke(); c.restore();
  c.save(); c.translate(0, -56); c.rotate(-t * .2); c.strokeStyle = rgba(col, .3); c.lineWidth = 2;
  c.beginPath(); for (let i = 0; i <= 6; i++) { const an = i / 6 * TAU; i ? c.lineTo(Math.cos(an) * 112, Math.sin(an) * 112) : c.moveTo(112, 0); } c.stroke(); c.restore();
  drawPadlock(c, Math.sin(deny * 44) * 7 * deny, -62, 138, col, 0, 1);
  spaced(c, 'ZABLOKOWANE', 0, 152, 6, 'JB7', 35, col, 1, 'center');
  setFont(c, 'CP5', 30); c.fillStyle = 'rgba(255,255,255,.72)'; c.textAlign = 'center'; c.fillText('Instagram', 0, 200);
  rr(c, -158, sh / 2 - 124, 316, 58, 29); if (deny > .15) { c.fillStyle = rgba(RED, .22); c.fill(); } c.strokeStyle = rgba(col, .7); c.lineWidth = 2; c.stroke();
  spaced(c, deny > .15 ? 'WYMAGANY KLUCZ NFC' : 'PRZYŁÓŻ KLUCZ NFC', 0, sh / 2 - 87, 2, 'JB7', 22, col, deny > .15 ? 1 : .65 + .35 * Math.sin(t * 6), 'center', false);
}
function bez(u, P0, C, P1) { const v = 1 - u; return [v * v * P0[0] + 2 * v * u * C[0] + u * u * P1[0], v * v * P0[1] + 2 * v * u * C[1] + u * u * P1[1]]; }
function revealKey(c, t, f, rev) {
  const [vx, vy] = vpAt(t), rv = t - E.reveal;
  c.save(); c.globalAlpha *= rev;
  const dw = 176, dh = 300, dx = vx - dw / 2, dy = vy - dh / 2 - 10;
  const g = c.createLinearGradient(0, dy, 0, dy + dh); g.addColorStop(0, rgba(MINT, .26)); g.addColorStop(1, rgba(MINT, .06)); c.fillStyle = g; c.fillRect(dx, dy, dw, dh);
  c.strokeStyle = rgba(MINT, 1); c.lineWidth = 4; c.shadowColor = rgba(MINT, 1); c.shadowBlur = 30; c.strokeRect(dx, dy, dw, dh); c.shadowBlur = 0;
  const fl = c.createLinearGradient(0, dy + dh, 0, dy + dh + 260); fl.addColorStop(0, rgba(MINT, .22)); fl.addColorStop(1, rgba(MINT, 0));
  c.fillStyle = fl; c.beginPath(); c.moveTo(dx, dy + dh); c.lineTo(dx + dw, dy + dh); c.lineTo(dx + dw + 150, dy + dh + 260); c.lineTo(dx - 150, dy + dh + 260); c.closePath(); c.fill();
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) { const rp = (t * .8 + k / 3) % 1; c.strokeStyle = rgba(MINT, (1 - rp) * .55); c.lineWidth = 3; c.beginPath(); c.arc(vx, vy - 10, 70 + rp * 230, 0, TAU); c.stroke(); }
  c.restore();
  keyFob(c, vx, vy - 12 + Math.sin(t * 3) * 6, .54 * lerp(.4, 1, eOutBack(clamp(rev))), .22 + Math.sin(t * 1.5) * .08, 30, 1);
  spaced(c, 'KLUCZ NFC', vx, dy - 60, 5, 'JB7', 30, MINT, prog(rv, .2, .4), 'center');
  spaced(c, 'W PRZEDPOKOJU', vx, dy - 24, 5, 'JB7', 24, WHITE, .85 * prog(rv, .3, .5), 'center');
  // the walk out of the bathroom
  const P0 = [452, 1278], C = [770, 1215], P1 = [vx + 4, dy + dh + 18];
  c.save(); c.setLineDash([12, 14]); c.lineDashOffset = -t * 60; c.strokeStyle = rgba(WHITE, .4 * prog(rv, .15, .5)); c.lineWidth = 3;
  c.beginPath(); c.moveTo(...P0); c.quadraticCurveTo(...C, ...P1); c.stroke(); c.restore();
  for (let i = 0; i < 7; i++) {
    const u = (i + .6) / 7.4, [x, y] = bez(u, P0, C, P1), [x2, y2] = bez(u + .02, P0, C, P1), ang = Math.atan2(y2 - y, x2 - x) + Math.PI / 2, on = prog(rv, .3 + i * .08, .4 + i * .08);
    if (on <= 0) continue; const sc = lerp(1.25, .42, u), off = (i % 2 ? 1 : -1) * 15 * sc;
    footGlyph(c, x + Math.cos(ang) * off, y + Math.sin(ang) * off, sc * lerp(.4, 1, eOutBack(on)), ang, MINT, on);
  }
  c.restore();
}
function sceneLock(c, t, f) {
  const [l0, l1] = S.lock, lt = t - l0, out = prog(t, l1 - .1, l1);
  const inP = eOutBack(prog(lt, 0, .38)), rev = eInOutC(prog(t, E.reveal, E.reveal + .55)), rv = t - E.reveal;
  let deny = 0, shakeX = 0, nd = 0;
  for (const T of E.deny) { const d = t - T; if (d < 0) continue; nd++; deny = Math.max(deny, 1 - prog(d, 0, .42)); if (d < .5) shakeX += Math.sin(d * 62) * 26 * Math.exp(-d * 9); }
  const cx = lerp(PH.cx, 292, rev) + shakeX, cy = lerp(PH.cy, 1052, rev) + (1 - inP) * 760;
  const po = { tilt: lerp(Math.sin(t * 1.1) * .08, .34, rev), rot: lerp(0, -.05, rev), scale: lerp(PSC, .66, rev), col: mix(MINT, RED, deny), alpha: 1 };
  c.save(); c.globalAlpha *= 1 - out;
  if (rev > 0) revealKey(c, t, f, rev);
  phone(c, cx, cy, PH.w, PH.h, po, (c2, sw, sh) => lockScreen(c2, sw, sh, t, deny));
  const [lx, ly] = phonePt(cx, cy, po, 0, -56);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const T of E.deny) { const d = t - T; if (d < 0 || d > .5) continue; const rp = d / .5; c.strokeStyle = rgba(RED, (1 - rp) * .95); c.lineWidth = 7 * (1 - rp) + 1; c.beginPath(); c.arc(lx, ly, 40 + rp * 260, 0, TAU); c.stroke(); }
  c.restore();
  E.deny.forEach((T, i) => {
    const d = t - T; if (d < 0 || d > .9) return;
    const dir = i % 2 ? 1 : -1, e = eOutC(d / .9), x = lx + dir * (150 + 150 * e), y = ly - 60 - 160 * e, a = 1 - prog(d, .5, .9), sz = 46 * lerp(.5, 1, eOutBack(clamp(d / .15)));
    c.save(); c.translate(x, y); c.rotate(dir * .14); rich(c, [{ t: 'ODMOWA', c: HOT, glow: RED }], 0, 0, { fam: 'UB7', size: sz, align: 'center', blur: 18, alpha: a }); c.restore();
  });
  const fs = fingerState(t, E.deny), fa = prog(lt, .2, .4) * (1 - prog(t, E.deny[2] + .22, E.deny[2] + .45));
  finger(c, lx + 30 + (1 - fs.k) * 110, ly + 40 + (1 - fs.k) * 150, fs.press, fa);

  panel(c, mix(MINT, RED, deny), prog(lt, .2, .4), () => {
    drawPadlock(c, 150, 1380, 52, mix(MINT, RED, deny), 0, 1);
    spaced(c, rv >= 0 ? 'KLUCZ: PRZEDPOKÓJ' : 'DOSTĘP ZABLOKOWANY', 206, 1370, 4, 'JB7', 27, mix(MINT, RED, deny), 1);
    spaced(c, `PRÓBY: ${nd}  ·  EFEKT: 0`, 206, 1404, 3, 'JB5', 22, WHITE, .7);
  });

  textShade(c, 1, 230, 600);
  const d1a = 1 - prog(t, E.reveal - .08, E.reveal);
  if (d1a > 0) { // board 3a
    const s1 = fit(c, 'Instagram?', 'UB8', 112, 760);
    slamLine(c, [{ t: 'Instagram?', c: WHITE, glow: MINT }], CX, 392, { fam: 'UB8', size: s1, align: 'center', blur: 28, alpha: d1a }, lt - .06);
    const s2 = fit(c, 'Zablokowany.', 'UB8', 84, 760), w2 = segWidth(c, [{ t: 'Zablokowany.' }], 'UB8', s2);
    c.save(); c.globalAlpha *= d1a;
    wipe(c, prog(lt, .32, .55), CX - w2 / 2, CX + w2 / 2, 420, 530, () => rich(c, [{ t: 'Zablokowany.', c: HOT, glow: RED }], CX, 500, { fam: 'UB8', size: s2, align: 'center', blur: 24 }), RED);
    c.restore();
  }
  if (rv >= 0) { // board 3b
    const s1 = fit(c, 'Po klucz', 'UB8', 112, 760);
    slamLine(c, [{ t: 'Po klucz', c: MINT }], CX, 392, { fam: 'UB8', size: s1, align: 'center', blur: 36 }, rv);
    const segs = [{ t: 'trzeba wyjść ', c: WHITE }, { t: 'z łazienki.', c: MINT }];
    const s2 = fit(c, 'trzeba wyjść z łazienki.', 'CP7', 66, 760), w2 = segWidth(c, segs, 'CP7', s2);
    wipe(c, prog(rv, .2, .44), CX - w2 / 2, CX + w2 / 2, 420, 510, () => rich(c, segs, CX, 482, { fam: 'CP7', size: s2, align: 'center', blur: 20 }));
  }
  c.restore();
}

// ───────────────────────── scene 4: payoff
function scenePayoff(c, t, f) {
  const [p0, p1] = S.payoff, lt = t - p0, out = prog(t, p1 - .1, p1), sl = t - E.payoffSlam, kk = t - E.kicker;
  c.save(); c.globalAlpha *= 1 - out;
  reticle(c, CX, 960, 340, t, .3 * eOutC(prog(lt, 0, .3)) + (sl > 0 ? .4 * (1 - prog(sl, 0, .8)) : 0), MINT, lerp(1.25, 1, eOutExpo(prog(lt, 0, .4))) + (sl > 0 ? .08 * (1 - prog(sl, 0, .5)) : 0));
  const s1 = fit(c, 'Wychodzę po', 'UB8', 96, 720), w1 = segWidth(c, [{ t: 'Wychodzę po' }], 'UB8', s1);
  wipe(c, prog(lt, 0, .16), CX - w1 / 2, CX + w1 / 2, 690, 820, () => rich(c, [{ t: 'Wychodzę po', c: WHITE, glow: MINT }], CX, 792, { fam: 'UB8', size: s1, align: 'center', blur: 28 }));
  if (sl >= 0) {
    const s3 = fit(c, '2 minutach.', 'UB8', 170, 760);
    slamLine(c, [{ t: '2 minutach.', c: MINT }], CX, 1010, { fam: 'UB8', size: s3, align: 'center', blur: 56 }, sl);
    const sp = prog(sl, 0, .7);
    if (sp < 1) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba(MINT, 1 - sp); c.lineWidth = 14 * (1 - sp) + 1; c.shadowColor = rgba(MINT, 1); c.shadowBlur = 40; c.beginPath(); c.ellipse(CX, 960, 100 + eOutC(sp) * 720, (100 + eOutC(sp) * 720) * .5, 0, 0, TAU); c.stroke(); c.restore(); }
    // timer chip: 02:00 ✓
    const ca = prog(sl, .15, .35);
    if (ca > 0) { c.save(); c.globalAlpha *= ca; rr(c, CX - 170, 1090, 340, 76, 38); c.fillStyle = rgba(MINT, .12); c.fill(); c.strokeStyle = rgba(MINT, .9); c.lineWidth = 3; c.shadowColor = rgba(MINT, 1); c.shadowBlur = 16; c.stroke(); c.shadowBlur = 0;
      monoDigits(c, '02:00', CX + 70, 1146, 'UB8', 46, WHITE, MINT, 14); drawCheck(c, CX + 118, 1128, 34, MINT, prog(sl, .3, .5)); c.restore(); }
  }
  if (kk >= 0) {
    const segs = [{ t: 'Nogi ', c: WHITE }, { t: 'dziękują.', c: MINT }], s4 = 72, w4 = segWidth(c, segs, 'CP7', s4);
    wipe(c, prog(kk, 0, .2), CX - w4 / 2, CX + w4 / 2, 1215, 1310, () => rich(c, segs, CX, 1286, { fam: 'CP7', size: s4, align: 'center', blur: 20 }));
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

// ───────────────────────── flashes, shake, frame
function flashes(c, t) {
  const fl = [[E.bigClock, ORANGE, .42, .28], [E.rip, ORANGE, .5, .3], [E.keyFormed, MINT, .3, .35], [E.drop, MINT, .5, .3], [E.reveal, MINT, .28, .3], [E.payoffSlam, MINT, .45, .32], [E.kicker, MINT, .12, .2]];
  for (const T of TAPS) fl.push([T, AMBER, .07, .1]);
  for (const T of E.deny) fl.push([T, RED, .2, .2]);
  for (const [t0, col, a, d] of fl) { const p = (t - t0) / d; if (p >= 0 && p < 1) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = rgba(col, a * Math.pow(1 - p, 2)); c.fillRect(0, 0, W, H); c.restore(); } }
}
function shake(t) {
  let x = 0, y = 0;
  for (const [t0, amp] of [[E.bigClock, 28], [E.rip, 20], [E.keyFormed, 10], [E.drop, 26], [E.reveal, 8], [E.payoffSlam, 32]]) {
    const d = t - t0; if (d < 0 || d > .45) continue;
    const k = amp * Math.exp(-d * 9); x += Math.sin(d * 95) * k; y += Math.cos(d * 77) * k * .7;
  }
  const { n, last } = tapInfo(t);
  if (n && t < E.bigClock) { const d = t - last, k = (3 + n * .7) * Math.exp(-d * 12); x += Math.sin(d * 110 + n) * k; y += Math.cos(d * 90 + n * 2) * k * .7; }
  return [x, y];
}
function drawScene(t, f) {
  ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0; ctx.setLineDash([]); ctx.textBaseline = 'alphabetic';
  background(ctx, t, f);
  const [sx, sy] = shake(t);
  ctx.save(); ctx.translate(sx, sy);
  if (t < S.taps[1]) sceneTaps(ctx, t, f);
  else if (t < S.twist[1]) sceneTwist(ctx, t, f);
  else if (t < S.lock[1]) sceneLock(ctx, t, f);
  else if (t < S.payoff[1]) scenePayoff(ctx, t, f);
  else sceneEnd(ctx, t, f);
  ctx.restore();
  hud(ctx, t, f);
  ctx.restore();
}
function frame(f) {
  const t = f / FPS;
  if (SAMPLES > 1) {
    for (let s = 0; s < SAMPLES; s++) { drawScene(t + s / SAMPLES * SHUTTER / FPS, f); actx.globalAlpha = 1 / (s + 1); actx.drawImage(main, 0, 0); }
    ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(acc, 0, 0); ctx.restore();
  } else drawScene(t, f);
  ctx.save();
  bloom(ctx);
  const ca = t < S.taps[1] ? Math.round(Math.max(0, heatAt(t) - .3) * 9) : 0;
  if (ca > 0) rgbSplit(ctx, ca);
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
  const t0 = Date.now(); let cnt = 0;
  for (const s of String(args.still).split(',')) { const f = Math.round(parseFloat(s) * FPS); frame(f); fs.writeFileSync(path.join(dir, `f_${s}.png`), main.toBuffer('image/png')); cnt++; }
  console.log('stills written', cnt, ((Date.now() - t0) / cnt).toFixed(0) + ' ms/frame incl. png');
} else {
  const out = args.out || './video_noaudio.mp4';
  const total = Math.round(DUR * FPS);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
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
