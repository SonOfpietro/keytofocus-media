// Key to Focus – rolka „Pętla nawyku” (styl v2: spokojny, estetyczny, edukacyjny)
// node reel.mjs [--still=0,1.5] [--dir=./stills] [--out=./video_noaudio.mp4]
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const TL = JSON.parse(fs.readFileSync(new URL('./timeline.json', import.meta.url)));
const W = 1080, H = 1920, FPS = TL.fps, DUR = TL.duration, S = TL.scenes, E = TL.events;
const fdir = new URL('../../engine/fonts/', import.meta.url).pathname;
for (const [f, a] of [['Manrope-800.ttf', 'M8'], ['Manrope-600.ttf', 'M6'], ['Manrope-400.ttf', 'M4'], ['JetBrainsMono-500.ttf', 'JB5'], ['JetBrainsMono-700.ttf', 'JB7']]) GlobalFonts.registerFromPath(fdir + f, a);

// ── palette v2 (stała tożsamość: ciemna zieleń + mięta)
const BG0 = [5, 18, 13], BG1 = [11, 36, 27], MINT = [60, 255, 176], SAGE = [150, 214, 188], INK = [234, 247, 241], DIM = [120, 160, 145];
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

// headline: two lines, soft rise + fade in, fade out; line 2 in mint
function headline(c, t, a0, a1, l1, l2, opt = {}) {
  const inP = ease(prog(t, a0 + (opt.delay || 0), a0 + (opt.delay || 0) + .55)), outP = prog(t, a1 - .35, a1);
  const first = opt.instant ? 1 : inP;
  const a = first * (1 - outP); if (a <= 0) return;
  const s1 = fit(c, l1, 'M8', opt.size1 || 84, 760), s2 = fit(c, l2, 'M8', opt.size2 || 84, 760);
  const y0 = 392 + (1 - first) * 26 - outP * 18;
  text(c, l1, CX, y0, 'M8', s1, INK, a);
  const in2 = opt.instant ? 1 : ease(prog(t, a0 + (opt.delay || 0) + .35, a0 + (opt.delay || 0) + .95));
  text(c, l2, CX, y0 + s1 * 1.18 + (1 - in2) * 20, 'M8', s2, MINT, in2 * (1 - outP));
}

function background(c, t) {
  c.fillStyle = rgba(BG0); c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(CX, 980, 60, CX, 980, 1100); g.addColorStop(0, rgba(BG1)); g.addColorStop(1, rgba(BG0, 0));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // calm dotted grid that drifts slowly
  c.save(); c.fillStyle = rgba(SAGE, .07); const off = (t * 6) % 60;
  for (let y = -60; y < H + 60; y += 60) for (let x = 30; x < W; x += 60) { c.beginPath(); c.arc(x, y + off, 1.6, 0, TAU); c.fill(); }
  c.restore();
}

// ── objects
function phone(c, cx, cy, w, h, a, screen) {
  c.save(); c.globalAlpha *= a;
  rr(c, cx - w / 2, cy - h / 2, w, h, 54); c.fillStyle = rgba([7, 26, 19], .9); c.fill();
  c.strokeStyle = rgba(SAGE, .75); c.lineWidth = 3; c.stroke();
  rr(c, cx - 36, cy - h / 2 + 22, 72, 12, 6); c.fillStyle = rgba(SAGE, .35); c.fill();
  if (screen) { c.save(); rr(c, cx - w / 2 + 14, cy - h / 2 + 50, w - 28, h - 70, 40); c.clip(); screen(c); c.restore(); }
  c.restore();
}
function appGrid(c, cx, cy, a, hi) {
  for (let i = 0; i < 12; i++) {
    const col = i % 3, row = Math.floor(i / 3), x = cx - 105 + col * 105, y = cy - 200 + row * 110, p = clamp(a * 3 - i * .12);
    if (p <= 0) continue;
    rr(c, x - 34, y - 34, 68, 68, 20); c.fillStyle = rgba(i === hi ? MINT : SAGE, (i === hi ? .55 : .16) * p); c.fill();
  }
}
function padlock(c, x, y, s, col, open = 0, a = 1) {
  c.save(); c.translate(x, y); c.globalAlpha *= a; c.strokeStyle = rgba(col); c.lineWidth = s * .11; c.lineCap = 'round';
  c.save(); c.translate(s * .26, -open * s * .22); c.rotate(-open * .45); c.translate(-s * .26, 0);
  c.beginPath(); c.moveTo(-s * .26, -s * .02); c.lineTo(-s * .26, -s * .22); c.arc(0, -s * .22, s * .26, Math.PI, 0); c.lineTo(s * .26, -s * .02); c.stroke(); c.restore();
  rr(c, -s * .42, -s * .04, s * .84, s * .62, s * .12); c.fillStyle = rgba(col, .14); c.fill(); c.stroke(); c.restore();
}
function keyFob(c, x, y, s, rot, a = 1) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.globalAlpha *= a;
  rr(c, -52, -132, 104, 264, 30); c.fillStyle = rgba([12, 40, 30]); c.fill(); c.strokeStyle = rgba(MINT, .9); c.lineWidth = 3.5; c.stroke();
  c.beginPath(); c.arc(0, -96, 15, 0, TAU); c.strokeStyle = rgba(SAGE, .6); c.lineWidth = 3; c.stroke();
  c.beginPath(); c.arc(0, 30, 30, 0, TAU); c.fillStyle = rgba([255, 205, 110], .95); c.fill();
  c.strokeStyle = rgba(MINT, .8); c.lineWidth = 3; c.lineCap = 'round';
  for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(0, 108, 8 + k * 8, -Math.PI * .78, -Math.PI * .22); c.stroke(); }
  c.restore();
}
function keyGlyph(c, x, y, s, col, a = 1) {
  c.save(); c.translate(x, y); c.rotate(-Math.PI / 4); c.globalAlpha *= a; c.strokeStyle = rgba(col); c.lineWidth = s * .14; c.lineCap = 'round';
  c.beginPath(); c.arc(-s * .55, 0, s * .32, 0, TAU); c.moveTo(-s * .23, 0); c.lineTo(s * .75, 0); c.moveTo(s * .45, 0); c.lineTo(s * .45, s * .26); c.moveTo(s * .7, 0); c.lineTo(s * .7, s * .2); c.stroke(); c.restore();
}

// ── scene 1: the hand reaches before you think
const PH = { cx: CX, cy: 1010, w: 380, h: 720 };
function scene1(c, t) {
  const [a0, a1] = S.reach, out = prog(t, a1 - .35, a1);
  const reach = ease(prog(t, E.reachStart, E.reachEnd)), lit = prog(t, E.reachEnd - .05, E.reachEnd + .5);
  phone(c, PH.cx, PH.cy, PH.w, PH.h, 1 - out, c2 => {
    c2.fillStyle = rgba(MINT, .05 * lit); c2.fillRect(0, 0, W, H);
    appGrid(c2, PH.cx, PH.cy, lit, 7);
  });
  // the reflex path: bottom-left into the phone
  const P0 = [120, 1560], C = [120, 1060], P1 = [PH.cx - 40, PH.cy + 150];
  const bez = u => [(1 - u) * (1 - u) * P0[0] + 2 * (1 - u) * u * C[0] + u * u * P1[0], (1 - u) * (1 - u) * P0[1] + 2 * (1 - u) * u * C[1] + u * u * P1[1]];
  if (reach > 0) {
    c.save(); c.globalAlpha *= 1 - out; c.setLineDash([2, 14]); c.lineCap = 'round'; c.strokeStyle = rgba(MINT, .7); c.lineWidth = 5;
    c.beginPath(); for (let k = 0; k <= 60; k++) { const u = k / 60 * reach, [x, y] = bez(u); k ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.setLineDash([]);
    const [hx, hy] = bez(reach); c.fillStyle = rgba(MINT); c.beginPath(); c.arc(hx, hy, 13, 0, TAU); c.fill();
    c.fillStyle = rgba(MINT, .18); c.beginPath(); c.arc(hx, hy, 30, 0, TAU); c.fill();
    c.restore();
    spaced(c, 'ODRUCH', 150, 1300, 6, 'JB7', 26, MINT, .8 * prog(t, E.reachStart + .3, E.reachStart + .7) * (1 - out), 'left');
  }
  const th = prog(t, E.reachEnd + .2, E.reachEnd + .6);
  spaced(c, 'MYŚL', 812, 1300, 6, 'JB7', 26, DIM, .8 * th * (1 - out), 'right');
  if (th > 0) { c.save(); c.globalAlpha *= th * (1 - out); c.strokeStyle = rgba(DIM, .6); c.lineWidth = 2; c.setLineDash([6, 10]); c.beginPath(); c.moveTo(790, 1270); c.lineTo(PH.cx + PH.w / 2 + 14, 1180); c.stroke(); c.restore(); }
  headline(c, t, a0, a1, 'Ręka sięga po telefon,', 'zanim pomyślisz.', { instant: true });
}

// ── loop diagram used in scenes 2 and 3
const LOOP = { cx: CX, cy: 1030, r: 250 };
const NODES = [{ label: 'nuda', ang: -Math.PI / 2 }, { label: 'ręka', ang: Math.PI / 6 }, { label: 'scroll', ang: Math.PI * 5 / 6 }];
function loopDiagram(c, t, a, gap) {
  if (a <= 0) return;
  c.save(); c.globalAlpha *= a;
  const nr = 78, angW = Math.asin(nr / LOOP.r) * 1.15;
  for (let i = 0; i < 3; i++) {
    const s0 = NODES[i].ang + angW, s1 = NODES[(i + 1) % 3].ang - angW + (i === 2 ? TAU : 0);
    const isGap = i === 1;
    c.strokeStyle = rgba(SAGE, .45); c.lineWidth = 4; c.lineCap = 'round';
    if (isGap && gap > 0) {
      const span = s1 - s0, cut = span * .42 * gap;
      c.strokeStyle = rgba(SAGE, .45); c.beginPath(); c.arc(LOOP.cx, LOOP.cy, LOOP.r, s0, s0 + span / 2 - cut); c.stroke();
      c.beginPath(); c.arc(LOOP.cx, LOOP.cy, LOOP.r, s0 + span / 2 + cut, s1); c.stroke();
    } else { c.beginPath(); c.arc(LOOP.cx, LOOP.cy, LOOP.r, s0, s1); c.stroke(); }
    // arrow head
    const ah = s1, ax = LOOP.cx + Math.cos(ah) * LOOP.r, ay = LOOP.cy + Math.sin(ah) * LOOP.r, tx = -Math.sin(ah), ty = Math.cos(ah);
    if (!(isGap && gap > .5)) { c.fillStyle = rgba(SAGE, .6); c.beginPath(); c.moveTo(ax + tx * 14, ay + ty * 14); c.lineTo(ax - tx * 8 + Math.cos(ah) * 12, ay - ty * 8 + Math.sin(ah) * 12); c.lineTo(ax - tx * 8 - Math.cos(ah) * 12, ay - ty * 8 - Math.sin(ah) * 12); c.fill(); }
    // flowing dots
    for (let k = 0; k < 4; k++) {
      const u = ((t * .45 + k / 4 + i * .13) % 1), ang = s0 + (s1 - s0) * u;
      if (isGap && gap > 0) { const span = s1 - s0, mid = s0 + span / 2, cut = span * .42 * gap; if (Math.abs(ang - mid) < cut) continue; if (ang > mid && gap > .5) continue; }
      c.fillStyle = rgba(MINT, .85 * Math.sin(Math.PI * u)); c.beginPath(); c.arc(LOOP.cx + Math.cos(ang) * LOOP.r, LOOP.cy + Math.sin(ang) * LOOP.r, 7, 0, TAU); c.fill();
    }
  }
  NODES.forEach((n, i) => {
    const x = LOOP.cx + Math.cos(n.ang) * LOOP.r, y = LOOP.cy + Math.sin(n.ang) * LOOP.r, pulse = 1 + .04 * Math.sin(t * 2.2 + i * 2);
    c.save(); c.translate(x, y); c.scale(pulse, pulse);
    c.beginPath(); c.arc(0, 0, nr, 0, TAU); c.fillStyle = rgba([9, 32, 24]); c.fill(); c.strokeStyle = rgba(MINT, .8); c.lineWidth = 3; c.stroke();
    text(c, n.label, 0, 12, 'M6', 34, INK, 1); c.restore();
  });
  c.restore();
}
function scene2(c, t) {
  const [a0, a1] = S.loop;
  const a = ease(prog(t, a0, a0 + .6));
  loopDiagram(c, t, a, 0);
  headline(c, t, a0, a1 + .4, 'To nie słaba wola.', 'To nawyk.', { size2: 96 });
}
function scene3(c, t) {
  const [a0, a1] = S.friction, out = prog(t, a1 - .35, a1);
  const gap = ease(prog(t, E.gap, E.gap + .8));
  c.save(); c.globalAlpha *= 1 - out; loopDiagram(c, t, 1, gap);
  // key slides into the gap
  const span = (NODES[2].ang - NODES[1].ang), mid = NODES[1].ang + span / 2;
  const kx = LOOP.cx + Math.cos(mid) * LOOP.r, ky = LOOP.cy + Math.sin(mid) * LOOP.r;
  const kp = ease(prog(t, E.keyIn, E.keyIn + .7));
  if (kp > 0) {
    const ringP = prog(t, E.keyIn + .6, E.keyIn + 1.5);
    if (ringP > 0 && ringP < 1) { c.strokeStyle = rgba(MINT, .5 * (1 - ringP)); c.lineWidth = 3; c.beginPath(); c.arc(kx, ky, 40 + ringP * 110, 0, TAU); c.stroke(); }
    c.beginPath(); c.arc(kx, ky + (1 - kp) * 160, 52, 0, TAU); c.fillStyle = rgba([9, 32, 24], kp); c.fill(); c.strokeStyle = rgba(MINT, kp); c.lineWidth = 3; c.stroke();
    keyGlyph(c, kx + 4, ky + (1 - kp) * 160, 46, MINT, kp);
    spaced(c, 'DYSTANS', kx, ky + 100 + (1 - kp) * 160, 6, 'JB7', 26, MINT, .9 * kp);
  }
  c.restore();
  spaced(c, 'WENDY WOOD, BADANIA NAD NAWYKAMI', CX, 1450, 3, 'JB5', 25, DIM, .85 * prog(t, a0 + .6, a0 + 1.1) * (1 - out));
  headline(c, t, a0 + .05, a1, 'Pętlę łatwiej przerwać', 'otoczeniem niż siłą woli.', { size1: 70, size2: 66 });
}

// ── scene 4: the key lives elsewhere
function scene4(c, t) {
  const [a0, a1] = S.key, out = prog(t, a1 - .35, a1), inP = ease(prog(t, a0, a0 + .6));
  const tap = t - E.tap, open = ease(prog(t, E.tap + .1, E.tap + .5));
  const pcx = CX - 40, pcy = 1030;
  c.save(); c.globalAlpha *= inP * (1 - out);
  phone(c, pcx, pcy, 340, 640, 1, c2 => {
    c2.fillStyle = rgba(MINT, .06 * open); c2.fillRect(0, 0, W, H);
    padlock(c2, pcx, pcy - 40, 120, open > .5 ? MINT : SAGE, open, 1);
    text(c2, open > .5 ? 'dostęp: 15 min' : 'zablokowane', pcx, pcy + 110, 'M6', 30, open > .5 ? MINT : SAGE, 1);
  });
  // key path: from the right edge into the phone
  const kp = ease(prog(t, E.keyMove, E.tap));
  const kx = lerp(990, pcx + 190, kp), ky = lerp(1420, pcy + 250, kp), rot = lerp(.5, .32, kp);
  if (tap >= 0 && tap < 1.2) { const rp = tap / 1.2; c.strokeStyle = rgba(MINT, .6 * (1 - rp)); c.lineWidth = 3; c.beginPath(); c.arc(pcx + 150, pcy + 230, 60 + rp * 300, 0, TAU); c.stroke(); }
  keyFob(c, kx, ky, .9, rot, 1);
  c.restore();
  headline(c, t, a0 + .05, a1, 'Dlatego klucz leży', 'z dala od kanapy.');
}

// ── scene 5: end card
function scene5(c, t) {
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
  c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = .28; c.drawImage(glow, 0, 0, W, H); c.restore();
}

function frame(f) {
  const t = f / FPS;
  ctx.save(); ctx.globalAlpha = 1; ctx.setLineDash([]);
  background(ctx, t);
  if (t < S.reach[1]) scene1(ctx, t);
  if (t >= S.loop[0] && t < S.loop[1] + .45) scene2(ctx, t);
  if (t >= S.friction[0] && t < S.friction[1]) scene3(ctx, t);
  if (t >= S.key[0] && t < S.key[1]) scene4(ctx, t);
  if (t >= S.end[0]) scene5(ctx, t);
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
