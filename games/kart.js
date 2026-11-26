// =====================================================================
//  KART RACING — règles (serveur)
//  Course de karts vue du dessus : dérapages avec mini-turbo, raccourcis,
//  boîtes à objets (turbo, huile, missile, bouclier), bots.
// =====================================================================
const U = require('./lib/util');
const TICK = 30, ROAD = 110; // demi-largeur de la route

// Circuits : points de contrôle (lissés en courbe) + raccourcis en terre
const TRACKS = {
  prairie: { name: 'Prairie verte', theme: 'grass', pts: [[600, 1500], [600, 700], [900, 400], [1500, 450], [1800, 800], [2300, 600], [2700, 900], [2600, 1500], [2000, 1700], [1500, 1350], [1100, 1750]], cuts: [[[1550, 520], [1750, 1300]]] },
  desert:  { name: 'Canyon du désert', theme: 'sand', pts: [[500, 1000], [700, 450], [1300, 350], [1600, 800], [2000, 400], [2700, 500], [2800, 1200], [2300, 1700], [1700, 1400], [1200, 1800], [600, 1650]], cuts: [[[1350, 420], [1700, 1350]], [[2700, 1150], [2000, 450]]] },
  neige:   { name: 'Sommet enneigé', theme: 'snow', pts: [[700, 600], [1500, 350], [2400, 500], [2800, 1000], [2300, 1350], [1600, 1100], [1100, 1300], [1500, 1750], [800, 1800], [400, 1300]], cuts: [[[1550, 1120], [1450, 400]]] },
  volcan:  { name: 'Volcan', theme: 'lava', pts: [[600, 1700], [400, 1000], [800, 400], [1400, 700], [1700, 300], [2400, 350], [2700, 1000], [2200, 1300], [2600, 1750], [1600, 1800], [1300, 1300], [1000, 1750]], cuts: [[[1420, 720], [2150, 1280]]] },
};
const ITEMS = ['turbo', 'huile', 'missile', 'bouclier', 'triple'];
const BOT_NAMES = ['Turbo Tom', 'Zoé Zoom', 'Max Vroum', 'Lila Drift', 'Gus Nitro', 'Mia Kart', 'Rico Rapide'];
const CC = { 50: 0.8, 100: 1, 150: 1.22 };

function catmull(pts, n = 24) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[(i - 1 + pts.length) % pts.length], p1 = pts[i], p2 = pts[(i + 1) % pts.length], p3 = pts[(i + 2) % pts.length];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        y: 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      });
    }
  }
  return out;
}
function segDist(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy || 1;
  const t = U.clamp(((px - a.x) * dx + (py - a.y) * dy) / L, 0, 1);
  return { d: Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t)), t };
}
function buildTrack(key) {
  const T = TRACKS[key], line = catmull(T.pts);
  const cuts = T.cuts.map(([a, b]) => ({ a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] } }));
  // boîtes à objets : 4 rangées réparties
  const boxes = []; let id = 1;
  for (const f of [0.18, 0.42, 0.66, 0.88]) {
    const i = Math.floor(line.length * f), p = line[i], q = line[(i + 1) % line.length];
    const a = Math.atan2(q.y - p.y, q.x - p.x), nx = -Math.sin(a), ny = Math.cos(a);
    for (const o of [-60, -20, 20, 60]) boxes.push({ id: id++, x: p.x + nx * o, y: p.y + ny * o, t: 0 });
  }
  return { key, name: T.name, theme: T.theme, line, cuts, boxes };
}
// position sur la piste : index du point le plus proche (recherche locale)
function nearest(line, x, y, hint) {
  let best = Infinity, bi = 0;
  const N = line.length, range = hint == null ? N : 40;
  for (let k = -range; k <= range; k++) {
    const i = hint == null ? k + range : ((hint + k) % N + N) % N;
    if (i < 0 || i >= N) continue;
    const d = (line[i].x - x) ** 2 + (line[i].y - y) ** 2;
    if (d < best) { best = d; bi = i; }
  }
  return { i: bi, d: Math.sqrt(best) };
}
function surface(s, k) {
  const n = nearest(s.track.line, k.x, k.y, k.idx);
  if (n.d < ROAD) return { grip: 1, n };
  for (const c of s.track.cuts) if (segDist(k.x, k.y, c.a, c.b).d < 45) return { grip: 0.9, n, cut: true };
  return { grip: n.d < ROAD + 25 ? 0.8 : 0.5, n, off: true };
}

function newKart(p, i, s, bot) {
  const L = s.track.line, N = L.length, gi = (N - 4 - Math.floor(i / 2) * 3 + N) % N, a = L[gi], b = L[(gi + 1) % N];
  const ang = Math.atan2(b.y - a.y, b.x - a.x), side = i % 2 ? 1 : -1;
  return { id: p.id, name: p.name, color: p.color, bot: !!bot, x: a.x - Math.sin(ang) * side * 45, y: a.y + Math.cos(ang) * side * 45, a: ang, v: 0, vx: 0, vy: 0, r: 18,
    idx: gi, lap: -1, prog: 0, finished: false, time: 0, place: 0, item: null, itemN: 0, boost: 0, spin: 0, shield: 0, drift: 0, driftDir: 0, input: {}, lastIdx: gi, botLook: U.rand(10, 16), botErr: 0 };
}

module.exports = {
  id: 'kart',
  name: 'Kart Racing',
  description: 'Course de karts déjantée : dérapages, turbos, objets et raccourcis. 4 circuits.',
  category: 'Course', icon: '🏎️', color: '#e11d48', order: 14,
  tags: ['🏁 Course', '🍌 Objets'],
  rules: `<ul><li><kbd>Z</kbd>/<kbd>↑</kbd> accélérer · <kbd>S</kbd>/<kbd>↓</kbd> freiner/reculer · <kbd>Q</kbd><kbd>D</kbd> tourner</li>
    <li>Maintenez <kbd>Espace</kbd> dans un virage pour <b>déraper</b> : relâchez quand les étincelles sont orange pour un mini-turbo !</li>
    <li>Roulez sur les <b>boîtes ❓</b> puis utilisez l’objet avec <kbd>Clic</kbd> ou <kbd>E</kbd> : 🚀 turbo, 🛢️ huile, 🎯 missile, 🛡️ bouclier.</li>
    <li>Cherchez les <b>raccourcis</b> en terre ! L’herbe vous ralentit.</li></ul>`,
  settings: [
    { key: 'track', label: 'Circuit', type: 'select', default: 'prairie', options: Object.entries(TRACKS).map(([v, t]) => ({ v, l: t.name })) },
    { key: 'laps', label: 'Tours', type: 'select', default: 3, options: [{ v: 1, l: '1' }, { v: 2, l: '2' }, { v: 3, l: '3' }, { v: 5, l: '5' }] },
    { key: 'cc', label: 'Cylindrée', type: 'select', default: 100, options: [{ v: 50, l: '50cc' }, { v: 100, l: '100cc' }, { v: 150, l: '150cc' }] },
    { key: 'bots', label: 'Bots', type: 'select', default: 4, options: [{ v: 0, l: 'Aucun' }, { v: 2, l: '2' }, { v: 4, l: '4' }, { v: 7, l: '7' }] },
    { key: 'botLevel', label: 'Niveau des bots', type: 'select', default: 'normal', options: [{ v: 'facile', l: 'Facile' }, { v: 'normal', l: 'Normal' }, { v: 'expert', l: 'Expert' }] },
    { key: 'items', label: 'Objets', type: 'toggle', default: true },
  ],
  minPlayers: 1, maxPlayers: 8, tickRate: TICK,

  create(players, ctx, o) {
    const track = buildTrack(TRACKS[o.track] ? o.track : 'prairie');
    const s = { track, laps: o.laps || 3, cc: CC[o.cc] || 1, items: o.items !== false, karts: [], projectiles: [], oils: [], nid: 1, phase: 'countdown', timer: 4, time: 0, finishT: null, over: false };
    const all = [...players, ...Array.from({ length: o.bots ?? 4 }, (_, i) => ({ id: 'bot' + i, name: BOT_NAMES[i], color: ['#64748b', '#78716c', '#71717a', '#6b7280', '#57534e', '#52525b', '#737373'][i], bot: true }))];
    U.shuffle(all).forEach((p, i) => { const k = newKart(p, i, s, p.bot); if (p.bot) k.skill = { facile: 0.8, normal: 0.9, expert: 0.99 }[o.botLevel || 'normal']; s.karts.push(k); });
    return s;
  },
  onJoin() {},
  onLeave(s, id) { s.karts = s.karts.filter(k => k.id !== id); },

  onAction(s, id, a, ctx) {
    const k = s.karts.find(q => q.id === id); if (!k) return;
    if (a.type === 'in') { const prev = k.input; k.input = { ...U.readInput(a), drift: !!a.drift, use: !!a.use }; if (a.use && !prev.use) useItem(s, k, ctx); }
    if (a.type === 'use') useItem(s, k, ctx);
  },

  tick(s, dt, ctx) {
    s.time += dt;
    if (s.phase === 'countdown') { const before = Math.ceil(s.timer); s.timer -= dt; if (Math.ceil(s.timer) !== before) ctx.emit({ type: 'count', n: Math.ceil(s.timer) }); if (s.timer <= 0) { s.phase = 'race'; s.start = s.time; ctx.emit({ type: 'go' }); } }
    const racing = s.phase === 'race';
    const L = s.track.line, N = L.length;
    for (const k of s.karts) {
      if (k.bot) botDrive(s, k, dt);
      const inp = k.input || {};
      const sf = surface(s, k); k.idx = sf.n.i; k.off = !!sf.off;
      const maxV = 520 * s.cc * (k.boost > 0 ? 1.45 : 1) * sf.grip * (k.finished ? 0.6 : 1);
      let acc = 0;
      if (racing && k.spin <= 0) { if (inp.u) acc = 600 * s.cc; if (inp.d) acc = k.v > 20 ? -1100 : -380; }
      if (k.boost > 0) { acc = Math.max(acc, 900); k.boost -= dt; }
      k.v += acc * dt;
      if (!inp.u && !inp.d) k.v *= Math.pow(0.35, dt);
      k.v = U.clamp(k.v, -180, Math.max(maxV, k.v * Math.pow(0.3, dt)));
      if (k.v > maxV) k.v = U.lerp(k.v, maxV, Math.min(1, dt * 3));
      // direction
      const steer = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
      if (k.spin > 0) { k.spin -= dt; k.a += 12 * dt; k.v *= Math.pow(0.2, dt); }
      else {
        const sp = U.clamp(Math.abs(k.v) / 250, 0, 1);
        // dérapage
        if (inp.drift && steer && k.v > 200 && !k.drift) { k.drift = 0.001; k.driftDir = steer; ctx.emit({ type: 'hop', id: k.id }); }
        if (k.drift) {
          if (!inp.drift || k.v < 120) { const lvl = k.drift > 1.8 ? 2 : k.drift > 0.9 ? 1 : 0; if (lvl) { k.boost = Math.max(k.boost, lvl === 2 ? 1.2 : 0.6); ctx.emit({ type: 'miniturbo', id: k.id, lvl }); } k.drift = 0; }
          else { k.drift += dt; k.a += (k.driftDir * 2.4 + steer * 1.0) * dt * sp; }
        } else k.a += steer * 2.9 * dt * sp * Math.sign(k.v || 1);
      }
      // adhérence : la vitesse s'aligne sur l'orientation (moins en dérapage)
      const tx = Math.cos(k.a) * k.v, ty = Math.sin(k.a) * k.v, grip = k.drift ? 3.5 : 9;
      k.vx += (tx - k.vx) * Math.min(1, grip * dt); k.vy += (ty - k.vy) * Math.min(1, grip * dt);
      k.x += k.vx * dt; k.y += k.vy * dt;
      k.x = U.clamp(k.x, 20, 3380); k.y = U.clamp(k.y, 20, 2180);
      k.shield -= dt;
      // progression (tours)
      if (racing && !k.finished) {
        const di = ((k.idx - k.lastIdx) % N + N) % N;
        if (di > 0 && di < N / 4) { if (k.idx < k.lastIdx) { k.lap++; if (k.lap >= s.laps) { k.finished = true; k.time = s.time - s.start; k.place = s.karts.filter(q => q.finished).length; ctx.emit({ type: 'finish', id: k.id, place: k.place }); if (!s.finishT) s.finishT = s.time; } else ctx.emit({ type: 'lap', id: k.id, lap: k.lap + 1 }, k.id); } k.lastIdx = k.idx; }
        else if (di > N * 3 / 4) { if (k.idx > k.lastIdx) k.lap = Math.max(-1, k.lap - 1); k.lastIdx = k.idx; } // marche arrière
        k.prog = k.lap * N + k.idx;
      }
      // boîtes à objets
      if (s.items) for (const b of s.track.boxes) if (b.t <= 0 && Math.hypot(b.x - k.x, b.y - k.y) < 30) { b.t = 4; if (!k.item) { k.item = pickItem(s, k); k.itemN = k.item === 'triple' ? 3 : 1; if (k.item === 'triple') k.item = 'turbo'; } ctx.emit({ type: 'box', x: b.x, y: b.y }, k.id); }
      // huile
      for (const o of s.oils) if (!o.used && Math.hypot(o.x - k.x, o.y - k.y) < 28) { o.used = true; hitKart(s, k, ctx, 'huile'); }
    }
    for (const b of s.track.boxes) b.t -= dt;
    s.oils = s.oils.filter(o => !o.used && (o.life -= dt) > 0);
    // collisions entre karts
    for (let i = 0; i < s.karts.length; i++) for (let j = i + 1; j < s.karts.length; j++) {
      const a = s.karts[i], b = s.karts[j];
      if (U.separate(a, b)) { const rel = Math.hypot(a.vx - b.vx, a.vy - b.vy); const avx = a.vx, avy = a.vy; a.vx = b.vx * 0.8; a.vy = b.vy * 0.8; b.vx = avx * 0.8; b.vy = avy * 0.8; a.v *= 0.9; b.v *= 0.9; if (rel > 160) ctx.emit({ type: 'bump', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }); }
    }
    // missiles
    for (const m of s.projectiles) {
      const tgt = s.karts.find(k => k.id === m.target);
      if (tgt) { const want = Math.atan2(tgt.y - m.y, tgt.x - m.x); m.a += U.clamp(U.angDiff(m.a, want), -4 * dt, 4 * dt); }
      m.x += Math.cos(m.a) * 760 * dt; m.y += Math.sin(m.a) * 760 * dt; m.life -= dt;
      for (const k of s.karts) if (k.id !== m.owner && Math.hypot(k.x - m.x, k.y - m.y) < 26) { hitKart(s, k, ctx, 'missile'); m.life = 0; ctx.emit({ type: 'boom', x: m.x, y: m.y }); break; }
    }
    s.projectiles = s.projectiles.filter(m => m.life > 0);
    // classement
    const order = s.karts.slice().sort((a, b) => (b.finished - a.finished) || (a.finished ? a.place - b.place : b.prog - a.prog || distAhead(s, b) - distAhead(s, a)));
    order.forEach((k, i) => { if (!k.finished) k.pos = i + 1; else k.pos = k.place; });
    const humans = s.karts.filter(k => !k.bot);
    if (s.phase === 'race' && ((humans.length ? humans : s.karts).every(k => k.finished) || (s.finishT && s.time - s.finishT > 30))) {
      s.phase = 'over'; s.over = true;
      order.forEach((k, i) => { if (!k.finished) { k.place = i + 1; k.time = null; } });
      ctx.emit({ type: 'end' });
    }
  },

  view(s, id) {
    return {
      phase: s.phase, timer: Math.ceil(s.timer), t: s.start != null ? s.time - s.start : 0, laps: s.laps, over: s.over,
      karts: s.karts.map(k => ({ id: k.id, name: k.name, color: k.color, bot: k.bot, x: U.r1(k.x), y: U.r1(k.y), a: U.r2(k.a), v: Math.round(k.v), lap: U.clamp(k.lap + 1, 1, s.laps), pos: k.pos, finished: k.finished, time: k.time, place: k.place, item: k.id === id ? k.item : undefined, itemN: k.id === id ? k.itemN : undefined, boost: k.boost > 0, spin: k.spin > 0, shield: k.shield > 0, drift: k.drift ? (k.drift > 1.8 ? 2 : k.drift > 0.9 ? 1 : 0) + 1 : 0, dd: k.driftDir, off: k.off })),
      boxes: s.track.boxes.filter(b => b.t <= 0).map(b => b.id),
      oils: s.oils.map(o => [o.id, Math.round(o.x), Math.round(o.y)]),
      missiles: s.projectiles.map(m => [m.id, Math.round(m.x), Math.round(m.y), U.r2(m.a)]),
    };
  },
  staticData(s) { return { track: { name: s.track.name, theme: s.track.theme, line: s.track.line.map(p => [Math.round(p.x), Math.round(p.y)]), cuts: s.track.cuts, boxes: s.track.boxes.map(b => ({ id: b.id, x: b.x, y: b.y })) }, ROAD }; },
};

function distAhead(s, k) { const L = s.track.line, n = L[(k.idx + 1) % L.length]; return -Math.hypot(n.x - k.x, n.y - k.y); }
function pickItem(s, k) {
  const back = (k.pos || 1) / Math.max(1, s.karts.length);
  const r = Math.random();
  if (back > 0.6) return r < 0.35 ? 'triple' : r < 0.65 ? 'missile' : r < 0.85 ? 'turbo' : 'bouclier';
  if (back < 0.3) return r < 0.45 ? 'huile' : r < 0.75 ? 'bouclier' : 'turbo';
  return U.pick(['turbo', 'huile', 'missile', 'bouclier']);
}
function useItem(s, k, ctx) {
  if (!k.item || s.phase !== 'race') return;
  const it = k.item;
  if (it === 'turbo') { k.boost = 1.3; ctx.emit({ type: 'boost', id: k.id }); }
  if (it === 'huile') { s.oils.push({ id: s.nid++, x: k.x - Math.cos(k.a) * 36, y: k.y - Math.sin(k.a) * 36, life: 25, owner: k.id }); ctx.emit({ type: 'drop' }); }
  if (it === 'bouclier') { k.shield = 6; ctx.emit({ type: 'shield', id: k.id }); }
  if (it === 'missile') {
    const ahead = s.karts.filter(q => q !== k && (q.pos || 99) < (k.pos || 99) && !q.finished).sort((a, b) => b.pos - a.pos)[0];
    s.projectiles.push({ id: s.nid++, x: k.x + Math.cos(k.a) * 30, y: k.y + Math.sin(k.a) * 30, a: k.a, target: ahead?.id, owner: k.id, life: 5 });
    ctx.emit({ type: 'missile' });
  }
  if (--k.itemN <= 0) k.item = null;
}
function hitKart(s, k, ctx, why) {
  if (k.shield > 0) { k.shield = 0; ctx.emit({ type: 'blocked', id: k.id }); return; }
  k.spin = why === 'missile' ? 1.3 : 0.9; k.drift = 0; k.boost = 0;
  ctx.emit({ type: 'spin', id: k.id, why, x: k.x, y: k.y });
}
function botDrive(s, k, dt) {
  const L = s.track.line, N = L.length;
  const look = L[(k.idx + Math.round(k.botLook + k.v / 80)) % N];
  const want = Math.atan2(look.y - k.y, look.x - k.x), diff = U.angDiff(k.a, want);
  k.botErr += (Math.random() - 0.5) * dt * 2; k.botErr = U.clamp(k.botErr, -0.3, 0.3);
  const d = diff + k.botErr * (1 - k.skill) * 3;
  const sharp = Math.abs(d) > 0.5;
  k.input = { u: !(sharp && k.v > 380), d: false, l: d < -0.06, r: d > 0.06, drift: Math.abs(d) > 0.35 && k.v > 260 && k.skill > 0.85 };
  // l'IA ralentit un peu selon son niveau
  if (k.skill < 1 && Math.random() > k.skill + 0.05) k.input.u = false;
  if (k.item && Math.random() < dt * 0.5) useItem(s, k, { emit() {} });
}
