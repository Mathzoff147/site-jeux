// =====================================================================
//  KART RACING — affichage (navigateur)
// =====================================================================
import { shell, endScreen, sfx, esc, css, Stage, Input, InputSender, Interp, Particles, loop, D, hud, clamp } from '../lib/kit.js';

const THEMES = {
  grass: { ground: '#4a8a3a', dark: '#3d7530', road: '#4b5563', deco: ['tree', 'flower', 'bush'] },
  sand: { ground: '#d4a55a', dark: '#c2914a', road: '#57534e', deco: ['cactus', 'rock', 'skull'] },
  snow: { ground: '#e8eef5', dark: '#cfd9e6', road: '#52525b', deco: ['pine', 'snowman', 'rock'] },
  lava: { ground: '#3b2a2a', dark: '#2a1d1d', road: '#44403c', deco: ['lava', 'rock', 'crystal'] },
};
const ITEM_ICON = { turbo: '🚀', huile: '🛢️', missile: '🎯', bouclier: '🛡️' };
const ORD = n => n === 1 ? '1er' : `${n}e`;
css('kart-css', `
.kt-hud .pos { position:absolute; left:16px; bottom:16px; font-family:'Space Grotesk'; font-size:72px; font-weight:700; line-height:1; text-shadow:0 4px 0 #000, 0 0 30px rgba(0,0,0,.6); }
.kt-hud .pos small { font-size:26px; opacity:.8; }
.kt-hud .lap { position:absolute; left:16px; top:62px; } .kt-hud .lap b { font-family:'Space Grotesk'; font-size:30px; }
.kt-hud .item { position:absolute; left:50%; top:60px; transform:translateX(-50%); width:84px; height:84px; border-radius:18px; background:rgba(0,0,0,.6); border:3px solid rgba(255,255,255,.35); display:grid; place-items:center; font-size:46px; }
.kt-hud .item.roll { animation: ktroll .12s infinite; } @keyframes ktroll { 50% { transform:translateX(-50%) scale(1.08); } }
.kt-hud .item small { position:absolute; right:6px; bottom:2px; font-size:16px; font-weight:800; }
.kt-hud .speed { position:absolute; right:16px; bottom:16px; font-family:'Space Grotesk'; font-size:34px; font-weight:700; text-shadow:0 2px 6px #000; text-align:right; }
.kt-hud .speed small { font-size:14px; opacity:.7; display:block; }
.kt-hud .rank { position:absolute; right:16px; top:62px; display:flex; flex-direction:column; gap:3px; font-size:13px; }
.kt-hud .rank div { background:rgba(0,0,0,.5); padding:3px 10px; border-radius:8px; display:flex; gap:8px; } .kt-hud .rank .me { background:rgba(250,204,21,.35); }
.kt-count { position:absolute; left:50%; top:40%; transform:translate(-50%,-50%); font-family:'Space Grotesk'; font-size:140px; font-weight:700; text-shadow:0 8px 0 #000; animation: ktc .9s; pointer-events:none; }
@keyframes ktc { from { transform:translate(-50%,-50%) scale(2); opacity:0; } 30% { opacity:1; } }
.kt-mini { position:absolute; right:16px; bottom:80px; }
.kt-msg { position:absolute; left:50%; top:30%; transform:translateX(-50%); font-family:'Space Grotesk'; font-size:40px; font-weight:700; text-shadow:0 4px 10px #000; pointer-events:none; }
`);

let api, ST, S, sh, stage, input, sender, stop, parts, kint, ui = {}, trackC, skid, sctx, endShown = false, rolling = 0, msg = { t: 0, html: '' }, prev = new Map(), engineT = 0;

function renderTrack() {
  const T = THEMES[ST.track.theme], L = ST.track.line, R = ST.ROAD;
  trackC = document.createElement('canvas'); trackC.width = 3400; trackC.height = 2200;
  const g = trackC.getContext('2d');
  g.fillStyle = T.ground; g.fillRect(0, 0, 3400, 2200);
  for (let i = 0; i < 26000; i++) { g.fillStyle = Math.random() < 0.5 ? T.dark : 'rgba(255,255,255,.08)'; g.fillRect(Math.random() * 3400, Math.random() * 2200, 3, 3); }
  const path = () => { g.beginPath(); L.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
  g.lineJoin = 'round'; g.lineCap = 'round';
  // raccourcis
  for (const c of ST.track.cuts) { g.strokeStyle = '#8b6b43'; g.lineWidth = 92; g.beginPath(); g.moveTo(c.a.x, c.a.y); g.lineTo(c.b.x, c.b.y); g.stroke(); g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 4; g.setLineDash([10, 16]); g.stroke(); g.setLineDash([]); }
  // ombre + bordures rouge/blanc
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = R * 2 + 40; path(); g.stroke();
  g.strokeStyle = '#fff'; g.lineWidth = R * 2 + 22; path(); g.stroke();
  g.strokeStyle = '#dc2626'; g.setLineDash([30, 30]); path(); g.stroke(); g.setLineDash([]);
  g.strokeStyle = T.road; g.lineWidth = R * 2; path(); g.stroke();
  for (let i = 0; i < 9000; i++) { const p = L[Math.floor(Math.random() * L.length)]; g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(p[0] + (Math.random() - 0.5) * R * 2, p[1] + (Math.random() - 0.5) * R * 2, 2, 2); }
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 5; g.setLineDash([40, 40]); path(); g.stroke(); g.setLineDash([]);
  // ligne de départ (damier)
  const [x0, y0] = L[0], [x1, y1] = L[1], a = Math.atan2(y1 - y0, x1 - x0);
  g.save(); g.translate(x0, y0); g.rotate(a);
  for (let i = -R; i < R; i += 16) for (let j = 0; j < 2; j++) { g.fillStyle = ((i / 16 + j) & 1) ? '#000' : '#fff'; g.fillRect(j * 16 - 16, i, 16, 16); }
  g.restore();
  // décor hors piste
  const offRoad = (x, y) => L.every(([px, py]) => (px - x) ** 2 + (py - y) ** 2 > (R + 70) ** 2) && ST.track.cuts.every(c => { const dx = c.b.x - c.a.x, dy = c.b.y - c.a.y, t = clamp(((x - c.a.x) * dx + (y - c.a.y) * dy) / (dx * dx + dy * dy), 0, 1); return Math.hypot(x - c.a.x - dx * t, y - c.a.y - dy * t) > 80; });
  for (let k = 0; k < 260; k++) {
    const x = Math.random() * 3400, y = Math.random() * 2200; if (!offRoad(x, y)) continue;
    const kind = T.deco[k % T.deco.length];
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + 8, y + 10, 26, 14, 0, 0, 7); g.fill();
    if (kind === 'tree') { D.circle(g, x, y, 28, '#166534'); D.circle(g, x - 6, y - 6, 18, '#15803d'); }
    if (kind === 'pine') { for (const [r, c] of [[28, '#14532d'], [18, '#166534'], [8, '#f8fafc']]) D.circle(g, x, y, r, c); }
    if (kind === 'bush') D.circle(g, x, y, 16, '#3f6212');
    if (kind === 'flower') for (let f = 0; f < 6; f++) D.circle(g, x + Math.cos(f) * 14, y + Math.sin(f * 2) * 10, 4, ['#f472b6', '#fde047', '#fff'][f % 3]);
    if (kind === 'cactus') { D.rrect(g, x - 7, y - 26, 14, 52, 7, '#15803d'); D.rrect(g, x - 22, y - 10, 10, 22, 5, '#15803d'); D.rrect(g, x + 12, y - 16, 10, 20, 5, '#15803d'); }
    if (kind === 'rock') D.circle(g, x, y, 20, '#78716c', '#57534e', 3);
    if (kind === 'skull') D.text(g, '💀', x, y, { size: 22, stroke: false });
    if (kind === 'snowman') { D.circle(g, x, y + 8, 16, '#fff', '#cbd5e1', 2); D.circle(g, x, y - 12, 10, '#fff', '#cbd5e1', 2); D.circle(g, x + 3, y - 13, 2, '#f97316'); }
    if (kind === 'lava') { const gr = g.createRadialGradient(x, y, 0, x, y, 40); gr.addColorStop(0, '#fde047'); gr.addColorStop(0.4, '#f97316'); gr.addColorStop(1, 'rgba(127,29,29,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 40, 0, 7); g.fill(); }
    if (kind === 'crystal') { g.fillStyle = '#c084fc'; g.beginPath(); g.moveTo(x, y - 26); g.lineTo(x + 10, y); g.lineTo(x, y + 12); g.lineTo(x - 10, y); g.fill(); }
  }
  skid = document.createElement('canvas'); skid.width = 1700; skid.height = 1100; sctx = skid.getContext('2d');
}

function drawKart(g, k, t) {
  g.save(); g.translate(k.x, k.y); g.rotate(k.a + (k.drift ? k.dd * 0.35 : 0));
  D.shadow(g, 3, 6, 26, 16, 0.35);
  for (const [wx, wy] of [[-14, -15], [14, -15], [-14, 15], [14, 15]]) D.rrect(g, wx - 7, wy - 4, 14, 8, 3, '#111');
  D.rrect(g, -22, -12, 44, 24, 9, k.color, 'rgba(0,0,0,.5)', 2);
  D.rrect(g, 12, -10, 12, 20, 5, '#1f2937'); // pare-chocs
  D.rrect(g, -24, -11, 6, 22, 3, '#374151'); // aileron
  D.circle(g, -3, 0, 9, '#f8fafc', '#0006', 1.5); D.rrect(g, 0, -6, 6, 12, 3, '#0ea5e9'); // casque + visière
  if (k.boost) { const f = 10 + Math.random() * 10; g.fillStyle = 'rgba(251,146,60,.9)'; g.beginPath(); g.moveTo(-24, -6); g.lineTo(-24 - f, 0); g.lineTo(-24, 6); g.fill(); g.fillStyle = 'rgba(254,240,138,.9)'; g.beginPath(); g.moveTo(-24, -3); g.lineTo(-24 - f * 0.6, 0); g.lineTo(-24, 3); g.fill(); }
  g.restore();
  if (k.shield) D.circle(g, k.x, k.y, 32, 'rgba(96,165,250,.18)', `rgba(147,197,253,${0.6 + Math.sin(t * 8) * 0.3})`, 3);
  if (k.drift) { const col = ['#e5e7eb', '#60a5fa', '#fb923c'][k.drift - 1]; const bx = k.x - Math.cos(k.a) * 18, by = k.y - Math.sin(k.a) * 18; parts.burst(bx + Math.sin(k.a) * 12, by - Math.cos(k.a) * 12, { n: 2, color: col, speed: 120, life: 0.25, size: 3, glow: true }); parts.burst(bx - Math.sin(k.a) * 12, by + Math.cos(k.a) * 12, { n: 2, color: col, speed: 120, life: 0.25, size: 3, glow: true }); }
  if (k.spin) D.text(g, '💫', k.x, k.y - 34, { size: 20, stroke: false });
  D.text(g, k.name, k.x, k.y - 30, { size: 12, color: k.id === api.myId ? '#fde047' : '#fff' });
}

function frame(dt, now) {
  if (!S) return;
  const t = now / 1000, karts = kint.all(), me = karts.find(k => k.id === api.myId) || karts[0];
  if (me) {
    const sp = Math.hypot(me.x - (prev.get(me.id)?.x ?? me.x), me.y - (prev.get(me.id)?.y ?? me.y)) / Math.max(dt, 0.001);
    stage.follow(me.x + Math.cos(me.a) * 120, me.y + Math.sin(me.a) * 120, dt, 5, 1.05 - clamp(sp / 2600, 0, 0.25));
  }
  // traces de pneus
  for (const k of karts) {
    const p = prev.get(k.id);
    if (p && (k.drift || k.off) && Math.hypot(k.x - p.x, k.y - p.y) < 40) { sctx.strokeStyle = k.off ? 'rgba(60,40,20,.25)' : 'rgba(20,20,20,.35)'; sctx.lineWidth = 3; for (const s of [-1, 1]) { const ox = Math.sin(k.a) * 12 * s, oy = -Math.cos(k.a) * 12 * s; sctx.beginPath(); sctx.moveTo((p.x + ox) / 2, (p.y + oy) / 2); sctx.lineTo((k.x + ox) / 2, (k.y + oy) / 2); sctx.stroke(); } }
    if (k.off && Math.random() < 0.4) parts.burst(k.x, k.y, { n: 1, color: ST.track.theme === 'snow' ? '#fff' : '#a16207', speed: 60, life: 0.4, size: 4 });
    prev.set(k.id, { x: k.x, y: k.y });
  }
  if (S.phase === 'race' && input) {
    const st = input.state(me?.x || 0, me?.y || 0);
    sender.push({ u: st.u || input.raw.KeyW || input.raw.ArrowUp || false, d: st.d, l: st.l, r: st.r, drift: !!(input.raw.Space || input.raw.ShiftLeft), use: !!(input.mouse.down || input.raw.KeyE), a: 0 });
  }
  engineT -= dt; if (engineT <= 0 && me && Math.abs(me.v) > 30) { engineT = 0.12; sfx.play('engine', 0.15, 0.6 + Math.abs(me.v) / 500); }
  parts.update(dt);
  const g = stage.g;
  stage.begin(dt);
  g.drawImage(trackC, 0, 0);
  g.drawImage(skid, 0, 0, 3400, 2200);
  // boîtes à objets
  for (const b of ST.track.boxes) {
    if (!S.boxes.includes(b.id)) continue;
    g.save(); g.translate(b.x, b.y + Math.sin(t * 3 + b.id) * 3); g.rotate(t * 1.5 + b.id);
    const hue = (t * 120 + b.id * 40) % 360;
    D.rrect(g, -16, -16, 32, 32, 6, `hsla(${hue},90%,60%,.75)`, '#fff', 2.5);
    g.rotate(-(t * 1.5 + b.id)); D.text(g, '?', 0, 1, { size: 20, color: '#fff' });
    g.restore();
  }
  for (const [, x, y] of S.oils) { g.fillStyle = 'rgba(15,15,15,.85)'; g.beginPath(); g.ellipse(x, y, 28, 20, 0.4, 0, 7); g.fill(); g.fillStyle = 'rgba(147,51,234,.35)'; g.beginPath(); g.ellipse(x - 6, y - 4, 10, 6, 0.4, 0, 7); g.fill(); }
  for (const [, x, y, a] of S.missiles) { g.save(); g.translate(x, y); g.rotate(a); D.rrect(g, -12, -5, 24, 10, 5, '#dc2626', '#fff', 1.5); g.restore(); parts.burst(x - Math.cos(a) * 14, y - Math.sin(a) * 14, { n: 2, color: ['#fde047', '#9ca3af'], speed: 40, life: 0.4, size: 5 }); }
  for (const k of karts.slice().sort((a, b) => a.y - b.y)) drawKart(g, k, t);
  parts.draw(g);
  stage.screen();
  renderHud(me);
  drawMini(karts);
}

const set = (k, html) => { const el = ui[k]; if (el._h !== html) { el._h = html; el.innerHTML = html; } };
function renderHud(me) {
  const mine = S.karts.find(k => k.id === api.myId);
  if (mine) {
    set('pos', `${mine.pos || '-'}<small>${mine.pos === 1 ? 'er' : 'e'} / ${S.karts.length}</small>`);
    set('lap', `<div class="gk-panel"><b>Tour ${mine.lap} / ${S.laps}</b><div>⏱ ${fmt(mine.finished && mine.time ? mine.time : S.t)}</div></div>`);
    const it = mine.item;
    if (rolling > 0) { rolling -= 1 / 60; ui.item.classList.add('roll'); set('item', Object.values(ITEM_ICON)[Math.floor(performance.now() / 90) % 4]); }
    else { ui.item.classList.remove('roll'); set('item', it ? `${ITEM_ICON[it]}${mine.itemN > 1 ? `<small>×${mine.itemN}</small>` : ''}` : ''); }
    set('speed', `${Math.round(Math.abs(mine.v) / 4)}<small>km/h</small>`);
  }
  set('rank', S.karts.slice().sort((a, b) => a.pos - b.pos).map(k => `<div class="${k.id === api.myId ? 'me' : ''}"><b>${k.pos}</b><span class="dot" style="background:${k.color}"></span>${esc(k.name)}${k.finished ? ' 🏁' : ''}</div>`).join(''));
  if (S.phase === 'countdown') set('count', `<div class="kt-count" data-n="${S.timer}">${S.timer > 3 ? '' : S.timer || ''}</div>`);
  else if (msg.t > 0) { msg.t -= 1 / 60; set('count', msg.html); } else set('count', '');
}
const fmt = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
function drawMini(karts) {
  const c = ui.mini, g = c.getContext('2d'), k = c.width / 3400;
  if (!ui.miniBg) { ui.miniBg = document.createElement('canvas'); ui.miniBg.width = c.width; ui.miniBg.height = c.height; const m = ui.miniBg.getContext('2d'); m.strokeStyle = 'rgba(255,255,255,.85)'; m.lineWidth = 5; m.lineJoin = 'round'; m.beginPath(); ST.track.line.forEach(([x, y], i) => i ? m.lineTo(x * k, y * k) : m.moveTo(x * k, y * k)); m.closePath(); m.stroke(); m.strokeStyle = 'rgba(161,98,7,.8)'; m.lineWidth = 3; for (const cc of ST.track.cuts) { m.beginPath(); m.moveTo(cc.a.x * k, cc.a.y * k); m.lineTo(cc.b.x * k, cc.b.y * k); m.stroke(); } }
  g.clearRect(0, 0, c.width, c.height); g.drawImage(ui.miniBg, 0, 0);
  for (const kk of karts) { g.fillStyle = kk.color; g.beginPath(); g.arc(kk.x * k, kk.y * k, kk.id === api.myId ? 5 : 3.5, 0, 7); g.fill(); if (kk.id === api.myId) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); } }
}

export default {
  mount(r, a) {
    api = a; ST = a.static; endShown = false; prev.clear();
    sh = shell(r, api, { title: 'Kart Racing', icon: '🏎️', overlay: true });
    stage = new Stage(sh.main, { bg: THEMES[ST.track.theme].ground });
    parts = new Particles(); kint = new Interp(60); sender = new InputSender(api, 30);
    renderTrack();
    ui.hud = hud(sh.main, `<div class="pos"></div><div class="lap"></div><div class="item"></div><div class="speed"></div><div class="rank"></div><div class="countwrap"></div><canvas class="kt-mini" width="220" height="142"></canvas>`);
    ui.hud.classList.add('kt-hud');
    const q = s => ui.hud.querySelector(s);
    Object.assign(ui, { pos: q('.pos'), lap: q('.lap'), item: q('.item'), speed: q('.speed'), rank: q('.rank'), count: q('.countwrap'), mini: q('.kt-mini') });
    input = new Input(stage, { touch: true });
    stop = loop(frame);
  },
  update(s) {
    S = s; kint.push(s.karts, ['x', 'y', 'a']);
    if (s.over && !endShown) {
      endShown = true;
      const me = s.karts.find(k => k.id === api.myId);
      setTimeout(() => endScreen(sh.main, api, { title: me ? (me.place === 1 ? '🏆 Victoire !' : `🏁 Vous finissez ${ORD(me.place)}`) : '🏁 Course terminée', sub: ST.track.name,
        rows: s.karts.slice().sort((a, b) => a.place - b.place).map(k => ({ name: k.name, color: k.color, value: k.time ? fmt(k.time) : 'Abandon', me: k.id === api.myId })), valueLabel: 'Temps' }), 1500);
    }
  },
  event(e) {
    const mine = e.id === api.myId;
    switch (e.type) {
      case 'count': if (e.n <= 3 && e.n > 0) sfx.play('countdown'); break;
      case 'go': sfx.play('go'); msg = { t: 1.2, html: '<div class="kt-count" style="color:#4ade80">GO !</div>' }; break;
      case 'box': rolling = 0.9; sfx.play('pickup', 0.6); parts.burst(e.x, e.y, { n: 16, color: ['#f472b6', '#60a5fa', '#facc15', '#4ade80'], speed: 200, life: 0.5, size: 4 }); break;
      case 'boost': case 'miniturbo': if (mine) { sfx.play('boost'); stage.shake(4); } break;
      case 'hop': if (mine) sfx.play('jump', 0.4); break;
      case 'spin': sfx.play(mine ? 'bad' : 'bump', mine ? 1 : 0.4); parts.burst(e.x, e.y, { n: 20, color: ['#fde047', '#fff'], speed: 200, life: 0.5, size: 4, glow: true }); if (mine) stage.shake(8); break;
      case 'boom': sfx.play('boom', 0.6); parts.burst(e.x, e.y, { n: 30, color: ['#fde047', '#f97316', '#ef4444'], speed: 300, life: 0.5, size: 7, glow: true }); break;
      case 'bump': sfx.play('bump', 0.4); parts.burst(e.x, e.y, { n: 6, color: '#fde68a', speed: 150, life: 0.2, size: 3 }); break;
      case 'shield': if (mine) sfx.play('magic'); break;
      case 'blocked': sfx.play('hit'); break;
      case 'missile': sfx.play('boost', 0.5); break;
      case 'drop': sfx.play('splash', 0.4); break;
      case 'lap': msg = { t: 2, html: e.lap === S?.laps ? '<div class="kt-msg" style="color:#f87171">🏁 DERNIER TOUR !</div>' : `<div class="kt-msg">Tour ${e.lap}</div>` }; sfx.play('good'); break;
      case 'finish': if (mine) { msg = { t: 3, html: `<div class="kt-msg" style="color:#fde047">🏁 ${ORD(e.place)} !</div>` }; sfx.play('win'); } break;
    }
  },
  unmount() { stop?.(); input?.destroy(); stage?.destroy(); S = null; ui = {}; },
};
