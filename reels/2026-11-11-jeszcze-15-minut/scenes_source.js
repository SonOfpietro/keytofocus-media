// ───────────────────────── REEL 2: „Limit: 30 minut. Jest 01:30.”
const VIOLET = [150, 96, 255], AMBER = [255, 196, 70], HOT = [255, 84, 120];
const TAPS = E.taps, NT = TAPS.length;
const SAMPLES = Number(process.env.SAMPLES || 1), SHUTTER = .6;
const acc = createCanvas(W, H), actx = acc.getContext('2d');
const VP0 = [CX, 880];

function tapInfo(t) { let n = 0; while (n < NT && TAPS[n] <= t) n++; return { n, last: n ? TAPS[n - 1] : -9, next: n < NT ? TAPS[n] : null }; }
function minutesAt(t) { const { n, last, next } = tapInfo(t); if (!n) return 0; const gap = next ? next - last : .3; return 15 * (n - 1 + eOutC(prog(t, last, last + Math.min(.22, gap * .7)))); }
function heatAt(t) { return t < S.twist[0] ? clamp(minutesAt(t) / (15 * NT)) : 1 - prog(t, S.twist[0], S.twist[0] + .45); }
function worldAt(t) { return prog(t, E.morphStart + .5, E.keyFormed); }
function accent(t) { return mix(mix(VIOLET, RED, heatAt(t) * .92), MINT, worldAt(t)); }
function fmtClock(min) { const m = Math.floor(21 * 60 + min + .001) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }

// camera travel down the corridor = integral of speed, so nothing ever jumps
const SPEED_KEYS = [[0, .45], [3.1, 2.6], [3.3, .12], [3.75, .12], [3.8, .5], [6.0, .35], [6.3, 3.0], [7.2, 2.0], [7.4, .5], [7.5, 1.5], [9.4, .9], [11.25, 1.1], [13.1, .7], [16.3, .6], [16.875, 3.4]];
function travelAt(t) { let tr = 0, sp = SPEED_KEYS[0][1]; for (let i = 0; i < SPEED_KEYS.length - 1; i++) { const [t0, s0] = SPEED_KEYS[i], [t1, s1] = SPEED_KEYS[i + 1]; if (t <= t0) break; const tt = Math.min(t, t1), u = (tt - t0) / (t1 - t0); tr += (t1 - t0) * (s0 * u + (s1 - s0) * u * u / 2); sp = lerp(s0, s1, u); } return { tr, sp }; }
function vpAt(t) { const e = t >= S.lock[0] && t < S.lock[1] ? eInOutC(prog(t, E.reveal, E.reveal + .55)) : 0; return [lerp(CX, 624, e), lerp(880, 800, e)]; }
function keyZ(t) { if (t < E.flyStart) return 1; const u = prog(t, E.flyStart, E.flyEnd); const pull = u < .16 ? -Math.sin(u / .16 * Math.PI) * .1 : 0; return 1 + pull + 9 * eInOutC(clamp((u - .1) / .9)); }

// ───────────────────────── background: neon corridor
const CW = 640, CHH = 1150, ZN = 14;
function background(c, t, f) {
  const heat = heatAt(t), world = worldAt(t), col = accent(t), [vx, vy] = vpAt(t), { tr, sp } = travelAt(t);
  const c0 = mix(mix([40, 18, 78], [86, 6, 30], heat), [8, 50, 34], world), c1 = mix(mix([14, 6, 30], [28, 3, 12], heat), [2, 17, 12], world);
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
    // floor marker in the middle of each frame
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
  spaced(c, '// SYS 0.17', 300, 196, 4, 'JB5', 22, col, .5);
  spaced(c, `T+00:${t.toFixed(2).padStart(5, '0')}`, W - 62, 196, 3, 'JB5', 22, col, .6, 'right');
  c.strokeStyle = rgba(col, .35); c.lineWidth = 2;
  for (let i = 0; i < 40; i++) { const y = 260 + ((i * 30 + t * 40) % 1200), l = i % 5 === 0 ? 18 : 8; line(c, 44, y, 44 + l, y); }
  const status = si === 0 ? (n ? `LIMIT ZIGNOROWANY ×${n}` : 'LIMIT CZASU: 30 MIN') : ['', 'PRZYCISK » KLUCZ NFC', 'BLOKADA AKTYWNA', 'TRYB SKUPIENIA', 'TRYB SKUPIENIA'][si];
  spaced(c, `SCENA ${String(si + 1).padStart(2, '0')}/05`, 62, 1560, 4, 'JB5', 22, col, .55);
  spaced(c, 'STATUS: ' + status, 330, 1560, 4, 'JB5', 22, col, .55);
  keys.forEach((k, i) => { const [a, b] = S[k], x = 62 + i * 154, p = prog(t, a, b); c.fillStyle = rgba(col, .18); c.fillRect(x, 1590, 138, 4); c.fillStyle = rgba(col, .85); c.fillRect(x, 1590, 138 * p, 4); });
  c.restore();
}

// ───────────────────────── shared pieces
const PH = { w: 440, h: 790, cx: CX, cy: 915 };
const BTN = { x: 0, y: 106, w: 328, h: 90 };   // „Jeszcze 15 minut” in phone-local coordinates

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

// ───────────────────────── scene 1: the limit and the button
function feedYAt(t) { let y = 0; for (let i = 0; i < NT; i++) { const T = TAPS[i]; if (t <= T) break; const gap = i + 1 < NT ? TAPS[i + 1] - T : .35; y += 540 * eOutC(prog(t, T, T + Math.min(.5, gap * .95))); } return y; }
function dialogState(t) {
  const { n, last, next } = tapInfo(t); let p, exit = 1;
  if (!n) p = prog(t, -.14, .14);
  else { const gap = next ? next - last : .12, app = last + gap * .5; p = prog(t, app, app + Math.min(.16, gap * .35)); exit = prog(t, last, last + Math.min(.12, gap * .3)); }
  return { p, exit, n };
}
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
function hourglass(c, x, y, s, t) {
  c.save(); c.translate(x, y); c.rotate(Math.sin(t * 2.2) * .12); c.strokeStyle = rgba(VIOLET, 1); c.fillStyle = rgba(VIOLET, .35); c.lineWidth = 3.5; c.lineJoin = 'round'; c.shadowColor = rgba(VIOLET, 1); c.shadowBlur = 14;
  c.beginPath(); c.moveTo(-s * .7, -s); c.lineTo(s * .7, -s); c.lineTo(0, 0); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-s * .7, s); c.lineTo(s * .7, s); c.lineTo(0, 0); c.closePath(); c.stroke();
  line(c, -s * .9, -s, s * .9, -s); line(c, -s * .9, s, s * .9, s); c.restore();
}
function goldButton(c, x, y, w, h, press = 0, glow = 1, textA = 1) {
  c.save(); c.translate(x, y); const s = 1 - press * .06; c.scale(s, s);
  rr(c, -w / 2, -h / 2, w, h, h / 2);
  const g = c.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#ffe59a'); g.addColorStop(.5, rgba(AMBER, 1)); g.addColorStop(1, '#e9981a');
  c.fillStyle = g; c.shadowColor = rgba(AMBER, 1); c.shadowBlur = 24 * glow + press * 30; c.fill(); c.shadowBlur = 0;
  if (press > 0) { c.fillStyle = `rgba(255,255,255,${press * .6})`; c.fill(); }
  c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2; c.stroke();
  if (textA > 0) { const fs = fit(c, 'Jeszcze 15 minut', 'CP7', h * .46, w - 40); setFont(c, 'CP7', fs); c.fillStyle = `rgba(34,18,2,${textA})`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Jeszcze 15 minut', 0, 2); }
  c.restore();
}
function limitDialog(c, sw, p, exit, press, t, hideBtn) {
  const s = lerp(.72, 1, eOutBack(clamp(p))) * (1 + exit * .1), a = clamp(p * 4) * (1 - exit);
  if (a <= 0) return;
  const dw = sw - 44, dh = 380;
  c.save(); c.globalAlpha *= a; c.translate(0, 40 - exit * 50); c.scale(s, s);
  rr(c, -dw / 2, -dh / 2, dw, dh, 32); c.fillStyle = 'rgba(22,15,40,.98)'; c.fill();
  c.strokeStyle = rgba(VIOLET, .9); c.lineWidth = 3; c.shadowColor = rgba(VIOLET, 1); c.shadowBlur = 26; c.stroke(); c.shadowBlur = 0;
  hourglass(c, 0, -dh / 2 + 62, 24, t);
  spaced(c, 'LIMIT CZASU MINĄŁ', 0, -dh / 2 + 138, 2.5, 'JB7', 28, WHITE, 1, 'center', false);
  setFont(c, 'CP5', 25); c.fillStyle = 'rgba(255,255,255,.62)'; c.textAlign = 'center'; c.fillText('Instagram · limit 30 min', 0, -dh / 2 + 178);
  if (!hideBtn) goldButton(c, BTN.x, BTN.y - 40, BTN.w, BTN.h, press, .6 + .4 * Math.sin(t * 9));
  else { rr(c, -BTN.w / 2, BTN.y - 40 - BTN.h / 2, BTN.w, BTN.h, BTN.h / 2); c.setLineDash([10, 8]); c.strokeStyle = rgba(AMBER, .55); c.lineWidth = 2; c.stroke(); c.setLineDash([]); }
  setFont(c, 'CP5', 24); c.fillStyle = 'rgba(255,255,255,.36)'; c.textAlign = 'center'; c.fillText('Zamknij aplikację', 0, dh / 2 - 34);
  c.restore();
}
function tapPhone(c, t, f, o = {}) {
  const tt = o.freezeT ?? t, { p, exit, n } = dialogState(tt), heat = heatAt(tt);
  const kick = n ? Math.exp(-(tt - TAPS[n - 1]) * 14) : 0;
  const po = { tilt: Math.sin(t * 1.15) * .1 + (o.tilt || 0), rot: Math.sin(t * .8) * .012 + (o.rot || 0), scale: (1 + kick * .03) * (o.scale || 1), col: mix(VIOLET, RED, heat * .9), alpha: o.alpha ?? 1 };
  const cx = PH.cx + (o.dx || 0), cy = PH.cy + (o.dy || 0);
  phone(c, cx, cy, PH.w, PH.h, po, (c2, sw, sh) => {
    c2.fillStyle = '#0b0714'; c2.fillRect(-sw / 2, -sh / 2, sw, sh);
    const fy = feedYAt(tt), per = 352, top = -sh / 2 + 96, k0 = Math.floor(fy / per) - 1;
    for (let k = k0; k < k0 + 5; k++) feedCard(c2, -sw / 2 + 18, top + k * per - fy, sw - 36, 330, k);
    c2.fillStyle = 'rgba(9,6,18,.95)'; c2.fillRect(-sw / 2, -sh / 2, sw, 80);
    setFont(c2, 'JB7', 27); c2.fillStyle = rgba(mix(WHITE, HOT, heat), 1); c2.textAlign = 'left'; c2.fillText(fmtClock(minutesAt(tt)), -sw / 2 + 34, -sh / 2 + 58);
    c2.strokeStyle = 'rgba(255,255,255,.7)'; c2.lineWidth = 2.5; rr(c2, sw / 2 - 78, -sh / 2 + 38, 42, 20, 5); c2.stroke();
    c2.fillStyle = rgba(mix(WHITE, HOT, heat), .8); c2.fillRect(sw / 2 - 74, -sh / 2 + 42, 34 * (1 - heat * .82), 12);
    const dimA = Math.max(n ? 1 - exit : 0, clamp(p));
    c2.fillStyle = `rgba(4,2,10,${.64 * dimA})`; c2.fillRect(-sw / 2, -sh / 2 + 80, sw, sh);
    if (n && exit < 1) limitDialog(c2, sw, 1, exit, 1, tt, false);
    if (p > 0) limitDialog(c2, sw, p, 0, 0, tt, o.hideBtn);
  });
  return { cx, cy, po };
}
const L2_FULL = '„Jeszcze 15 minut” ×18';
function sceneTaps(c, t, f) {
  const { n } = tapInfo(t), heat = heatAt(t), big = t - E.bigClock;
  const ph = tapPhone(c, t, f);
  const [bx, by] = phonePt(ph.cx, ph.cy, ph.po, BTN.x, BTN.y);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = Math.max(0, n - 6); i < n; i++) { const age = t - TAPS[i]; if (age > .5) continue; const rp = age / .5; c.strokeStyle = rgba(AMBER, (1 - rp) * .9); c.lineWidth = 6 * (1 - rp) + 1; c.beginPath(); c.arc(bx, by, 30 + rp * 200, 0, TAU); c.stroke(); }
  c.restore();
  for (let i = 0; i < n; i++) {
    const age = t - TAPS[i]; if (age > 1.1) continue;
    const r = rng(40 + i * 7), dir = (i % 2 ? 1 : -1) * (.3 + r() * .7), e = eOutC(clamp(age / 1.1));
    const x = bx + dir * 330 * e, y = by - 60 - 420 * e + 150 * age * age, a = (1 - prog(age, .55, 1.1)) * (1 - clamp(big / .1)), sz = (38 + r() * 20) * lerp(.5, 1, eOutBack(clamp(age / .16)));
    c.save(); c.translate(x, y); c.rotate(dir * .2); rich(c, [{ t: '+15 min', c: AMBER }], 0, 0, { fam: 'UB7', size: sz, align: 'center', blur: 18, alpha: a }); c.restore();
  }
  const fs = fingerState(t, TAPS);
  finger(c, bx + 34 + (1 - fs.k) * 120, by + 28 + (1 - fs.k) * 150, fs.press, 1 - clamp(big / .08));

  // bottom panel: the racing clock
  panel(c, accent(t), 1, () => {
    spaced(c, 'GODZINA', 122, 1370, 5, 'JB7', 26, accent(t), 1);
    spaced(c, 'LIMIT: 30 MIN', 122, 1404, 3, 'JB5', 21, WHITE, .6);
    monoDigits(c, fmtClock(minutesAt(t)), 820, 1402, 'UB8', 72, mix(WHITE, HOT, heat), mix(VIOLET, RED, heat));
  });

  if (big >= 0) {
    c.fillStyle = `rgba(3,1,6,${.74 * clamp(big / .08)})`; c.fillRect(-80, -80, W + 160, H + 160);
    const sz = fit(c, '01:30', 'UB8', 300, 740);
    slamLine(c, [{ t: fmtClock(15 * NT), c: HOT, glow: RED }], CX, 1010, { fam: 'UB8', size: sz, align: 'center', blur: 60 }, big);
    spaced(c, 'GODZINA', CX, 800, 10, 'JB7', 34, WHITE, .9 * clamp(big / .15), 'center');
    spaced(c, 'A LIMIT BYŁ NA 30 MINUT', CX, 1100, 4, 'JB7', 30, WHITE, .9 * clamp((big - .12) / .15), 'center');
  }

  // text card
  const s1 = fit(c, 'Limit: 30 minut.', 'UB8', 96, 760), sc = lerp(1.08, 1, eOutC(prog(t, -.1, .25)));
  c.save(); c.translate(CX, 380); c.scale(sc, sc);
  rich(c, [{ t: 'Limit: 30 minut.', c: WHITE, glow: mix(VIOLET, RED, heat) }], 0, 0, { fam: 'UB8', size: s1, align: 'center', blur: 28 });
  c.restore();
  if (n) {
    const s2 = fit(c, L2_FULL, 'CP7', 64, 760), wFull = segWidth(c, [{ t: L2_FULL }], 'CP7', s2), x0 = CX - wFull / 2;
    const wq = segWidth(c, [{ t: '„Jeszcze 15 minut” ' }], 'CP7', s2), a2 = prog(t, TAPS[0], TAPS[0] + .12);
    rich(c, [{ t: '„Jeszcze 15 minut” ', c: AMBER }], x0, 476, { fam: 'CP7', size: s2, blur: 20, alpha: a2 });
    const pop = 1 + .35 * Math.exp(-(t - TAPS[n - 1]) * 16);
    c.save(); c.translate(x0 + wq, 476); c.scale(pop, pop); rich(c, [{ t: '×' + n, c: WHITE, glow: AMBER }], 0, 0, { fam: 'CP7', size: s2, blur: 20, alpha: a2 }); c.restore();
  }
}

// ───────────────────────── scene 2: the button becomes a key and leaves the room
const BC = [CX, 800], KC = [CX, 850], BSC = 1.85, KSC = 1.5;
function samplePoints(w, h, draw, step) {
  const cv = createCanvas(w, h), x = cv.getContext('2d'); draw(x);
  const d = x.getImageData(0, 0, w, h).data, pts = [];
  for (let yy = 0; yy < h; yy += step) for (let xx = 0; xx < w; xx += step) { const i = (yy * w + xx) * 4; if (d[i + 3] > 110) pts.push([xx - w / 2, yy - h / 2, d[i], d[i + 1], d[i + 2]]); }
  return pts;
}
const MORPH = (() => {
  const NP = 5200, r = rng(4242), bw = BTN.w * BSC, bh = BTN.h * BSC, cw = Math.ceil(bw) + 8, ch = Math.ceil(bh) + 8;
  const src = samplePoints(cw, ch, x => { x.translate(cw / 2, ch / 2); x.beginPath(); x.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2); x.fillStyle = '#fff'; x.fill(); }, 3);
  const dstAll = samplePoints(560, 660, x => { keyFob(x, 280, 330, KSC, .22, 0, 1, true); }, 2);
  const wts = dstAll.map(p => .05 + (.3 * p[2] + .6 * p[3] + .1 * p[4]) / 255); let tot = 0; const cum = wts.map(w => (tot += w));
  const pick = () => { const v = r() * tot; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < v) lo = m + 1; else hi = m; } return dstAll[lo]; };
  const S1 = [...Array(NP)].map(() => src[Math.floor(r() * src.length)]).sort((a, b) => a[0] - b[0]);
  const D1 = [...Array(NP)].map(pick).sort((a, b) => a[0] - b[0]);
  return S1.map((s, i) => { const d = D1[i]; return {
    sx: BC[0] + s[0], sy: BC[1] + s[1], dx: KC[0] + d[0], dy: KC[1] + d[1], col: [Math.max(40, d[2]), Math.max(60, d[3]), Math.max(50, d[4])],
    d: (s[0] / bw + .5) * .3 + r() * .15, a0: r() * TAU, w: (r() - .5) * 7, r: 30 + r() * 170, lift: r() * 120, sz: 2 + r() * 2.2 }; });
})();
function morphPos(P, u) { const e = eInOutC(u), s = Math.sin(Math.PI * u), ang = P.a0 + u * P.w, rad = s * P.r; return [lerp(P.sx, P.dx, e) + Math.cos(ang) * rad, lerp(P.sy, P.dy, e) + Math.sin(ang) * rad * .8 - s * P.lift]; }
function keyAt(t) { const z = keyZ(t), u = prog(t, E.flyStart, E.flyEnd), hover = t < E.flyStart ? Math.sin(t * 3.2) * 8 : 0; return { x: VP0[0] + (KC[0] - VP0[0]) / z, y: VP0[1] + (KC[1] - VP0[1]) / z + hover, sc: KSC / z, rot: .22 + eInOutC(u) * TAU + (t < E.flyStart ? Math.sin(t * 2) * .05 : 0), z, u }; }

function sceneTwist(c, t, f) {
  const [b0, b1] = S.twist, r = t - E.rip, tm = prog(t, E.morphStart, E.morphEnd), out = prog(t, b1 - .1, b1);
  // the old phone falls away
  if (r < .62) tapPhone(c, t, f, { freezeT: E.rip - .002, hideBtn: true, dy: eInC(prog(r, 0, .62)) * 1000, rot: -prog(r, 0, .62) * .3, alpha: 1 - prog(r, .2, .62) });
  // the button tears out
  const frozen = { tilt: Math.sin(E.rip * 1.15) * .1, rot: Math.sin(E.rip * .8) * .012, scale: 1 };
  const [bx0, by0] = phonePt(PH.cx, PH.cy, frozen, BTN.x, BTN.y), fl = eOutBack(prog(r, 0, .42));
  const bx = lerp(bx0, BC[0], fl), by = lerp(by0, BC[1], fl), bs = lerp(1, BSC, fl), bAlpha = 1 - prog(t, E.morphStart, E.morphStart + .3);
  if (r < .6) { c.save(); c.globalCompositeOperation = 'lighter'; for (let k = 0; k < 3; k++) { const rp = prog(r, k * .07, .45 + k * .07); if (rp <= 0 || rp >= 1) continue; c.strokeStyle = rgba(AMBER, 1 - rp); c.lineWidth = 8 * (1 - rp) + 1; c.beginPath(); c.arc(bx0, by0, 40 + rp * 520, 0, TAU); c.stroke(); } c.restore(); }
  if (bAlpha > 0) { c.save(); c.globalAlpha *= bAlpha; c.translate(bx, by); c.rotate(Math.sin(r * 9) * .05 * (1 - prog(r, 0, .5))); c.scale(bs, bs); goldButton(c, 0, 0, BTN.w, BTN.h, 0, 1.6, 1 - prog(t, E.morphStart - .05, E.morphStart + .15)); c.restore(); }
  // particles: button → key
  if (t >= E.morphStart - .05 && t < E.keyFormed + .25) {
    const aKey = .5 * (1 - prog(t, E.keyFormed - .06, E.keyFormed + .2)), aBtn = .55 * prog(t, E.morphStart - .05, E.morphStart + .1);
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'butt';
    for (const P of MORPH) {
      const u = clamp((tm - P.d) / .55), [x, y] = morphPos(P, u), s = Math.sin(Math.PI * u);
      const hot = mix(AMBER, WHITE, s * .2), col = u < .5 ? hot : mix(hot, P.col, (u - .5) * 2), sz = P.sz * (1 + s * .5);
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
    if (kf > 0 && t < E.flyStart + .1) { const la = prog(kf, .05, .2) * (1 - prog(t, E.flyStart - .05, E.flyStart + .1)); reticle(c, KC[0], KC[1], 300, t, .5 * la, MINT, lerp(1.25, 1, eOutExpo(prog(kf, 0, .4)))); spaced(c, 'KLUCZ NFC', CX, 1138, 8, 'JB7', 34, MINT, la, 'center'); }
    if (K.u > .6) { const da = prog(K.u, .6, 1); c.save(); c.globalAlpha *= da; c.strokeStyle = rgba(MINT, 1); c.lineWidth = 3; c.shadowColor = rgba(MINT, 1); c.shadowBlur = 26; c.strokeRect(VP0[0] - 64, VP0[1] - 112, 128, 216);
      const bg = c.createLinearGradient(0, VP0[1] - 520, 0, VP0[1] - 112); bg.addColorStop(0, rgba(MINT, 0)); bg.addColorStop(1, rgba(MINT, .7)); c.shadowBlur = 0; c.fillStyle = bg; c.fillRect(VP0[0] - 3, VP0[1] - 520, 6, 408);
      spaced(c, 'DRUGI POKÓJ', VP0[0], VP0[1] + 150, 5, 'JB7', 26, MINT, 1, 'center'); c.restore(); }
    if (t > E.flyEnd - .1) { c.save(); c.globalCompositeOperation = 'lighter'; for (let k = 0; k < 3; k++) { const rp = ((t - E.flyEnd) * 2.2 + k / 3) % 1; if (rp < 0) continue; c.strokeStyle = rgba(MINT, (1 - rp) * .7); c.lineWidth = 3; c.beginPath(); c.arc(VP0[0], VP0[1], 20 + rp * 240, 0, TAU); c.stroke(); } c.restore(); }
  }
  // bottom panel
  panel(c, accent(t), prog(t, E.morphStart - .1, E.morphStart + .15) * (1 - out), () => {
    const fly = t >= E.flyStart, label = fly ? 'KLUCZ » DRUGI POKÓJ' : t >= E.keyFormed ? 'KLUCZ NFC GOTOWY' : 'PRZYCISK » KLUCZ NFC';
    const pr = fly ? prog(t, E.flyStart, E.flyEnd) : tm;
    spaced(c, label, 122, 1374, 4, 'JB7', 27, accent(t), 1);
    spaced(c, Math.round(pr * 100) + '%', 818, 1374, 2, 'JB7', 27, WHITE, .9, 'right');
    c.fillStyle = rgba(accent(t), .16); c.fillRect(122, 1394, 696, 8); c.fillStyle = rgba(accent(t), 1); c.shadowColor = rgba(accent(t), 1); c.shadowBlur = 14; c.fillRect(122, 1394, 696 * pr, 8); c.shadowBlur = 0;
  });
  // text card
  c.save(); c.globalAlpha *= 1 - out;
  const l1 = [{ t: 'A gdyby ', c: WHITE }, { t: 'przycisk', c: AMBER }, { t: ' leżał', c: WHITE }];
  const s1 = fit(c, 'A gdyby przycisk leżał', 'CP7', 72, 760), w1 = segWidth(c, l1, 'CP7', s1);
  wipe(c, prog(r, .05, .28), CX - w1 / 2, CX + w1 / 2, 300, 400, () => rich(c, l1, CX, 374, { fam: 'CP7', size: s1, align: 'center', blur: 20 }), AMBER);
  const s2 = fit(c, 'w drugim pokoju?', 'UB8', 96, 760);
  slamLine(c, [{ t: 'w drugim pokoju?', c: WHITE, glow: accent(t) }], CX, 470, { fam: 'UB8', size: s2, align: 'center', blur: 30 }, t - E.line2);
  c.restore();
}

// ───────────────────────── scene 3: here there is no button
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
  setFont(c, 'CP5', 28); c.fillStyle = 'rgba(255,255,255,.72)'; c.textAlign = 'center'; c.fillText('Instagram', 0, 198);
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
  spaced(c, 'DRUGI POKÓJ', vx, dy - 24, 5, 'JB7', 24, WHITE, .85 * prog(rv, .3, .5), 'center');
  // the walk nobody wants to take
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
  const po = { tilt: lerp(Math.sin(t * 1.1) * .08, .34, rev), rot: lerp(0, -.05, rev), scale: lerp(1, .66, rev), col: mix(MINT, RED, deny), alpha: 1 };
  c.save(); c.globalAlpha *= 1 - out;
  if (rev > 0) revealKey(c, t, f, rev);
  phone(c, cx, cy, PH.w, PH.h, po, (c2, sw, sh) => lockScreen(c2, sw, sh, t, deny));
  const [lx, ly] = phonePt(cx, cy, po, 0, -56);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const T of E.deny) { const d = t - T; if (d < 0 || d > .5) continue; const rp = d / .5; c.strokeStyle = rgba(RED, (1 - rp) * .95); c.lineWidth = 7 * (1 - rp) + 1; c.beginPath(); c.arc(lx, ly, 40 + rp * 260, 0, TAU); c.stroke(); }
  c.restore();
  E.deny.forEach((T, i) => {
    const d = t - T; if (d < 0 || d > .9) return;
    const dir = i % 2 ? 1 : -1, e = eOutC(d / .9), x = lx + dir * (150 + 150 * e), y = ly - 120 - 200 * e, a = 1 - prog(d, .5, .9), sz = 46 * lerp(.5, 1, eOutBack(clamp(d / .15)));
    c.save(); c.translate(x, y); c.rotate(dir * .14); rich(c, [{ t: 'ODMOWA', c: HOT, glow: RED }], 0, 0, { fam: 'UB7', size: sz, align: 'center', blur: 18, alpha: a }); c.restore();
  });
  const fs = fingerState(t, E.deny), fa = prog(lt, .2, .4) * (1 - prog(t, E.deny[2] + .22, E.deny[2] + .45));
  finger(c, lx + 30 + (1 - fs.k) * 110, ly + 40 + (1 - fs.k) * 150, fs.press, fa);

  panel(c, mix(MINT, RED, deny), prog(lt, .2, .4), () => {
    drawPadlock(c, 150, 1380, 52, mix(MINT, RED, deny), 0, 1);
    spaced(c, rv >= 0 ? 'KLUCZ: DRUGI POKÓJ' : 'DOSTĘP ZABLOKOWANY', 206, 1370, 4, 'JB7', 27, mix(MINT, RED, deny), 1);
    spaced(c, `KLIKNIĘCIA: ${nd}  ·  EFEKT: 0`, 206, 1404, 3, 'JB5', 22, WHITE, .7);
  });

  const d1a = 1 - prog(t, E.reveal - .08, E.reveal);
  if (d1a > 0) {
    const s1 = fit(c, 'Tu przycisku nie ma.', 'UB8', 96, 760);
    slamLine(c, [{ t: 'Tu przycisku nie ma.', c: WHITE, glow: MINT }], CX, 384, { fam: 'UB8', size: s1, align: 'center', blur: 28, alpha: d1a }, lt - .06);
    const s2 = fit(c, 'Klikaj, ile chcesz.', 'CP7', 64, 760), w2 = segWidth(c, [{ t: 'Klikaj, ile chcesz.' }], 'CP7', s2);
    c.save(); c.globalAlpha *= d1a;
    wipe(c, prog(t, E.deny[0] - .1, E.deny[0] + .12), CX - w2 / 2, CX + w2 / 2, 410, 500, () => rich(c, [{ t: 'Klikaj, ', c: WHITE }, { t: 'ile chcesz.', c: MINT }], CX, 474, { fam: 'CP7', size: s2, align: 'center', blur: 20 }));
    c.restore();
  }
  if (rv >= 0) {
    const s1 = fit(c, 'Jest klucz.', 'UB8', 112, 760);
    slamLine(c, [{ t: 'Jest klucz.', c: MINT }], CX, 388, { fam: 'UB8', size: s1, align: 'center', blur: 36 }, rv);
    const segs = [{ t: 'Fizyczny. ', c: WHITE }, { t: 'W drugim pokoju.', c: MINT }];
    const s2 = fit(c, 'Fizyczny. W drugim pokoju.', 'CP7', 64, 760), w2 = segWidth(c, segs, 'CP7', s2);
    wipe(c, prog(rv, .22, .46), CX - w2 / 2, CX + w2 / 2, 410, 500, () => rich(c, segs, CX, 476, { fam: 'CP7', size: s2, align: 'center', blur: 20 }));
  }
  c.restore();
}

// ───────────────────────── scene 4: payoff
function scenePayoff(c, t, f) {
  const [p0, p1] = S.payoff, lt = t - p0, out = prog(t, p1 - .1, p1), sl = t - E.payoffSlam;
  c.save(); c.globalAlpha *= 1 - out;
  reticle(c, CX, 960, 340, t, .3 * eOutC(prog(lt, 0, .3)) + (sl > 0 ? .4 * (1 - prog(sl, 0, .8)) : 0), MINT, lerp(1.25, 1, eOutExpo(prog(lt, 0, .4))) + (sl > 0 ? .08 * (1 - prog(sl, 0, .5)) : 0));
  const s1 = fit(c, 'Kliknąć łatwo.', 'UB8', 92, 720), w1 = segWidth(c, [{ t: 'Kliknąć łatwo.' }], 'UB8', s1);
  wipe(c, prog(lt, 0, .16), CX - w1 / 2, CX + w1 / 2, 610, 730, () => rich(c, [{ t: 'Kliknąć łatwo.', c: WHITE, glow: MINT }], CX, 704, { fam: 'UB8', size: s1, align: 'center', blur: 28 }));
  const tp = lt - .2;
  if (tp > -.2 && sl < .1) { const k = eInOutC(prog(tp, -.2, 0)), fx = CX + w1 / 2 - 60, fy = 770; finger(c, fx + (1 - k) * 70, fy + (1 - k) * 90, 1 - prog(tp, 0, .1), prog(lt, 0, .1) * (1 - prog(sl, -.1, .05))); if (tp > 0 && tp < .4) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba(WHITE, 1 - tp / .4); c.lineWidth = 4; c.beginPath(); c.arc(fx, fy, 30 + tp / .4 * 110, 0, TAU); c.stroke(); c.restore(); } }
  if (sl >= 0) {
    const s3 = fit(c, 'Wstać –', 'UB8', 178, 760), s4 = fit(c, 'już nie.', 'UB8', 178, 760);
    slamLine(c, [{ t: 'Wstać –', c: WHITE, glow: MINT }], CX, 960, { fam: 'UB8', size: s3, align: 'center', blur: 40 }, sl);
    slamLine(c, [{ t: 'już nie.', c: MINT }], CX, 1150, { fam: 'UB8', size: s4, align: 'center', blur: 60 }, sl - .07);
    const sp = prog(sl, 0, .7);
    if (sp < 1) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba(MINT, 1 - sp); c.lineWidth = 14 * (1 - sp) + 1; c.shadowColor = rgba(MINT, 1); c.shadowBlur = 40; c.beginPath(); c.ellipse(CX, 1050, 100 + eOutC(sp) * 720, (100 + eOutC(sp) * 720) * .5, 0, 0, TAU); c.stroke(); c.restore(); }
    for (let i = 0; i < N; i++) { const on = prog(sl, .12 + i * .05, .2 + i * .05); if (on <= 0) continue; footGlyph(c, 190 + i * (560 / (N - 1)), 1262 + (i % 2 ? 10 : -10), lerp(.5, 1.15, eOutBack(on)), i % 2 ? .18 : -.18, MINT, on); }
  }
  c.restore();
}
