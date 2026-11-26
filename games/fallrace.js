// =====================================================================
//  FALL RACE — règles (serveur)
//  Course d'obstacles délirante au-dessus du vide : barres tournantes,
//  portes piégées, plateformes mobiles, pousseurs, bumpers, tapis.
//  Manches éliminatoires : seuls les premiers se qualifient.
// =====================================================================
const U = require('./lib/util');
const TICK = 30, WIDTH = 1000, SEC = 760;
const BOT_NAMES = ['Gélatine', 'Bonbon', 'Patate', 'Nuage', 'Biscotte', 'Cornichon', 'Guimauve', 'Tartine', 'Radis', 'Brioche', 'Pistache', 'Noisette', 'Cookie', 'Praline', 'Sorbet', 'Fondue', 'Kiwi', 'Mangue', 'Litchi', 'Myrtille'];
const PASTEL = ['#f472b6', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#f87171', '#2dd4bf', '#c084fc', '#facc15'];

// ---------- Génération du parcours ----------
function genCourse(nSec) {
  const C = { walls: [], voids: [], plats: [], sweepers: [], bumpers: [], pushers: [], belts: [], doors: [], checkpoints: [], slime: [] };
  const types = U.shuffle(['sweep', 'doors', 'plats', 'bumpers', 'pushers', 'belts', 'sweep2', 'gaps']).slice(0, nSec);
  const L = (nSec + 1) * SEC + 400;
  let y = L - 300; // départ en bas
  C.start = y; C.checkpoints.push(y + 100);
  for (const t of types) {
    const y0 = y - SEC; // la section s'étend de y0 à y
    C.checkpoints.push(y - 40);
    if (t === 'sweep' || t === 'sweep2') {
      const n = t === 'sweep' ? 2 : 3;
      for (let k = 0; k < n; k++) C.sweepers.push({ x: t === 'sweep' ? 250 + k * 500 : 170 + k * 330, y: y0 + SEC / 2 + (k % 2 ? 120 : -120), len: t === 'sweep' ? 230 : 160, w: U.rand(1, 1.8) * (k % 2 ? 1 : -1), a: U.rand(0, 6) });
      if (t === 'sweep') C.bumpers.push({ x: 500, y: y0 + SEC / 2, r: 45 });
    }
    if (t === 'doors') {
      for (const row of [y0 + 220, y0 + 540]) {
        const n = 5, w = WIDTH / n, real = new Set(U.shuffle([0, 1, 2, 3, 4]).slice(0, 3));
        for (let k = 0; k < n; k++) C.doors.push({ id: C.doors.length, x: k * w + 8, y: row, w: w - 16, h: 40, real: real.has(k), open: false });
        for (let k = 0; k <= n; k++) C.walls.push({ x: k * w - 8, y: row - 10, w: 16, h: 60 });
      }
    }
    if (t === 'plats' || t === 'gaps') {
      const rows = t === 'plats' ? [y0 + 140, y0 + 420] : [y0 + 120, y0 + 330, y0 + 540];
      rows.forEach((ry, i) => {
        const h = t === 'plats' ? 220 : 120;
        C.voids.push({ x: 0, y: ry, w: WIDTH, h });
        const n = t === 'plats' ? 3 : 2;
        for (let k = 0; k < n; k++) C.plats.push({ x0: U.rand(40, WIDTH - 220), y: ry, w: 180, h, amp: U.rand(150, 350), sp: U.rand(0.5, 1.1) * (k % 2 ? 1 : -1), ph: U.rand(0, 6), x: 0 });
      });
    }
    if (t === 'bumpers') for (let k = 0; k < 14; k++) C.bumpers.push({ x: U.rand(80, WIDTH - 80), y: U.rand(y0 + 80, y - 80), r: U.rand(26, 46) });
    if (t === 'pushers') for (let k = 0; k < 4; k++) C.pushers.push({ y: y0 + 100 + k * 160, h: 60, gap: 220, ph: U.rand(0, 6), sp: U.rand(0.8, 1.4), x: 0 });
    if (t === 'belts') {
      for (let k = 0; k < 3; k++) C.belts.push({ x: 0, y: y0 + 60 + k * 240, w: WIDTH, h: 160, vy: 170 + k * 30, vx: k % 2 ? 90 : -90 });
      for (let k = 0; k < 5; k++) C.bumpers.push({ x: 100 + k * 200, y: y0 + 200 + (k % 2) * 240, r: 30 });
      C.slime.push({ x: 300, y: y0 + 640, w: 400, h: 80 });
    }
    y = y0;
  }
  C.finish = y - 60; C.length = L;
  // murs extérieurs
  C.walls.push({ x: -40, y: C.finish - 300, w: 40, h: L + 600 }, { x: WIDTH, y: C.finish - 300, w: 40, h: L + 600 }, { x: 0, y: L + 60, w: WIDTH, h: 40 });
  C.types = types;
  return C;
}

function plat(p, t) { return U.clamp(p.x0 + Math.sin(t * p.sp + p.ph) * p.amp * 0.5, 0, WIDTH - p.w); }
function pusherX(pu, t) { return (Math.sin(t * pu.sp + pu.ph) * 0.5 + 0.5) * (WIDTH - pu.gap); }

function startRace(s) {
  s.course = genCourse(s.sections);
  s.round++;
  const alive = s.racers.filter(r => !r.out);
  U.shuffle(alive).forEach((r, i) => Object.assign(r, { x: 60 + (i % 12) * 75, y: s.course.start + Math.floor(i / 12) * 60, vx: 0, vy: 0, air: 0, fall: 0, cp: 0, done: false, place: 0, dive: 0, stun: 0, input: r.bot ? {} : r.input, botT: 0, tx: null }));
  s.phase = 'countdown'; s.timer = 4; s.t = 0; s.qualified = 0;
  const n = alive.length;
  s.quota = s.round >= s.rounds ? 1 : Math.max(1, Math.round(n * (s.rounds - s.round === 1 ? 0.5 : 0.65)));
  s.raceTime = 0;
}

module.exports = {
  id: 'fallrace',
  name: 'Fall Race',
  description: 'Course d’obstacles au-dessus du vide ! Évitez les pièges, qualifiez-vous manche après manche.',
  category: 'Course', icon: '🏃', color: '#f472b6', order: 5,
  tags: ['🤸 Fun', '👑 Éliminatoire'],
  rules: `<ul><li><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> courir · <kbd>Espace</kbd> sauter (au-dessus du vide et des barres) · <kbd>Maj</kbd> ou clic : plongeon</li>
    <li>Évitez les barres tournantes, les pousseurs, les bumpers… et ne tombez pas dans le vide !</li>
    <li>Certaines portes sont <b>fausses</b> : foncez dedans pour les découvrir.</li>
    <li>Seuls les premiers arrivés se qualifient pour la manche suivante. Le gagnant de la finale remporte la couronne 👑</li></ul>`,
  settings: [
    { key: 'rounds', label: 'Manches', type: 'select', default: 3, options: [{ v: 1, l: '1 (course simple)' }, { v: 2, l: '2' }, { v: 3, l: '3' }] },
    { key: 'sections', label: 'Longueur du parcours', type: 'select', default: 5, options: [{ v: 3, l: 'Courte' }, { v: 5, l: 'Moyenne' }, { v: 7, l: 'Longue' }] },
    { key: 'bots', label: 'Bots', type: 'select', default: 12, options: [{ v: 0, l: 'Aucun' }, { v: 6, l: '6' }, { v: 12, l: '12' }, { v: 20, l: '20' }] },
    { key: 'chaos', label: 'Obstacles', type: 'select', default: 1, options: [{ v: 0.7, l: 'Calmes' }, { v: 1, l: 'Normaux' }, { v: 1.5, l: 'Chaos' }] },
  ],
  minPlayers: 1, maxPlayers: 16, tickRate: TICK,

  create(players, ctx, o) {
    const s = { rounds: o.rounds || 3, sections: o.sections || 5, chaos: o.chaos || 1, round: 0, racers: [], over: false, winner: null, log: [] };
    players.forEach(p => s.racers.push({ id: p.id, name: p.name, color: p.color, bot: false, out: false, r: 16, input: {}, wins: 0 }));
    for (let i = 0; i < (o.bots ?? 12); i++) s.racers.push({ id: 'bot' + i, name: BOT_NAMES[i % BOT_NAMES.length], color: PASTEL[i % PASTEL.length], bot: true, out: false, r: 16, input: {}, skill: U.rand(0.6, 1) });
    startRace(s);
    return s;
  },
  onJoin() {},
  onLeave(s, id) { const r = s.racers.find(x => x.id === id); if (r) { r.out = true; r.left = true; } },

  onAction(s, id, a) {
    if (a.type === 'sync') { if (s._sentRound) delete s._sentRound[id]; return; }
    const r = s.racers.find(x => x.id === id); if (!r) return;
    if (a.type === 'in') { const prev = r.input || {}; r.input = { ...U.readInput(a), jump: !!a.jump, dive: !!a.dive }; r.jumpPress = r.jumpPress || (a.jump && !prev.jump); r.divePress = r.divePress || (a.dive && !prev.dive); }
  },

  tick(s, dt, ctx) {
    if (s.over) return;
    const C = s.course;
    if (s.phase === 'countdown') { const b = Math.ceil(s.timer); s.timer -= dt; if (Math.ceil(s.timer) !== b && s.timer > 0 && s.timer < 3.5) ctx.emit({ type: 'count', n: Math.ceil(s.timer) }); if (s.timer <= 0) { s.phase = 'race'; ctx.emit({ type: 'go' }); } }
    if (s.phase === 'results') { s.timer -= dt; if (s.timer <= 0) { if (s.round >= s.rounds || s.racers.filter(r => !r.out).length <= 1) { s.over = true; s.winner = s.racers.find(r => !r.out)?.id || null; ctx.emit({ type: 'crown', id: s.winner }); } else startRace(s); } return; }
    s.t += dt * s.chaos;
    const T = s.t;
    for (const p of C.plats) p.x = plat(p, T);
    for (const pu of C.pushers) pu.x = pusherX(pu, T);
    for (const sw of C.sweepers) sw.a += sw.w * dt * s.chaos;
    const racing = s.phase === 'race';
    if (racing) s.raceTime += dt;
    for (const r of s.racers) {
      if (r.out || r.done) continue;
      if (r.bot) botRun(s, r, dt);
      const inp = r.input || {};
      if (r.fall > 0) { r.fall -= dt; if (r.fall <= 0) { const cy = C.checkpoints[r.cp]; Object.assign(r, { x: U.rand(100, WIDTH - 100), y: cy, vx: 0, vy: 0, air: 0, stun: 0.4 }); } continue; }
      const mv = U.moveVec(inp);
      const slimy = C.slime.some(z => U.circleRect({ x: r.x, y: r.y, r: 1 }, z));
      const sp = (r.dive > 0 ? 0 : 300) * (slimy ? 0.45 : 1);
      r.stun -= dt;
      if (racing && r.stun <= 0) {
        const ax = r.air > 0 ? 3 : 12;
        r.vx += (mv.x * sp - r.vx) * Math.min(1, ax * dt);
        r.vy += (mv.y * sp - r.vy) * Math.min(1, ax * dt);
        if (r.jumpPress && r.air <= 0) { r.air = 0.55; ctx.emit({ type: 'jump', id: r.id }, r.id); }
        if (r.divePress && r.dive <= 0 && r.air <= 0) { r.dive = 0.7; const dx = mv.x || mv.y ? mv.x : 0, dy = mv.x || mv.y ? mv.y : -1; r.vx = dx * 520; r.vy = dy * 520; ctx.emit({ type: 'dive', id: r.id }, r.id); }
      } else { r.vx *= Math.pow(0.1, dt); r.vy *= Math.pow(0.1, dt); }
      r.jumpPress = false; r.divePress = false;
      if (r.dive > 0) { r.dive -= dt; r.vx *= Math.pow(0.3, dt); r.vy *= Math.pow(0.3, dt); }
      if (r.air > 0) r.air -= dt;
      // tapis roulants
      if (r.air <= 0) for (const b of C.belts) if (U.circleRect({ x: r.x, y: r.y, r: 1 }, b)) { r.x += b.vx * dt * s.chaos; r.y += b.vy * dt * s.chaos; }
      // plateformes mobiles (on est transporté)
      let onPlat = null;
      for (const p of C.plats) if (r.x > p.x && r.x < p.x + p.w && r.y > p.y && r.y < p.y + p.h) { onPlat = p; break; }
      if (onPlat && r.air <= 0) { const nx = plat(onPlat, T + dt * s.chaos); r.x += nx - onPlat.x; }
      r.x += r.vx * dt; r.y += r.vy * dt;
      // murs, portes, pousseurs
      for (const w of C.walls) U.pushOutRect(r, w);
      for (const d of C.doors) if (!d.open && U.circleRect(r, d)) { if (d.real && Math.hypot(r.vx, r.vy) > 120) { d.open = true; ctx.emit({ type: 'door', x: d.x + d.w / 2, y: d.y + d.h / 2 }); } else { U.pushOutRect(r, d); if (!d.real && !d.shown) { d.shown = true; } } }
      for (const pu of C.pushers) { const L = { x: -10, y: pu.y, w: pu.x + 10, h: pu.h }, R = { x: pu.x + pu.gap, y: pu.y, w: WIDTH - pu.x - pu.gap + 10, h: pu.h }; for (const z of [L, R]) if (U.pushOutRect(r, z)) { r.stun = Math.max(r.stun, 0.1); } }
      // barres tournantes (on les saute)
      if (r.air <= 0) for (const sw of C.sweepers) {
        const dx = Math.cos(sw.a), dy = Math.sin(sw.a), rx = r.x - sw.x, ry = r.y - sw.y;
        const t = U.clamp(rx * dx + ry * dy, -sw.len, sw.len), px = sw.x + dx * t, py = sw.y + dy * t, d = Math.hypot(r.x - px, r.y - py);
        if (d < r.r + 10) { const nx = (r.x - px) / (d || 1), ny = (r.y - py) / (d || 1), push = 500 + Math.abs(sw.w * t) * 2.2; r.vx = nx * push; r.vy = ny * push; r.stun = 0.45; r.x = px + nx * (r.r + 11); r.y = py + ny * (r.r + 11); ctx.emit({ type: 'whack', x: r.x, y: r.y }); }
      }
      for (const b of C.bumpers) { const d = Math.hypot(r.x - b.x, r.y - b.y); if (d < b.r + r.r) { const nx = (r.x - b.x) / (d || 1), ny = (r.y - b.y) / (d || 1); r.x = b.x + nx * (b.r + r.r); r.y = b.y + ny * (b.r + r.r); r.vx = nx * 560; r.vy = ny * 560; r.stun = 0.25; b.hit = 0.2; ctx.emit({ type: 'boing', x: b.x, y: b.y }); } }
      // collisions entre coureurs
      // chute dans le vide
      if (r.air <= 0 && !onPlat && C.voids.some(v => r.x > v.x && r.x < v.x + v.w && r.y > v.y + 6 && r.y < v.y + v.h - 6)) { r.fall = 1.2; ctx.emit({ type: 'fall', id: r.id, x: r.x, y: r.y }); continue; }
      // points de passage
      while (r.cp + 1 < C.checkpoints.length && r.y < C.checkpoints[r.cp + 1]) r.cp++;
      // arrivée
      if (r.y < C.finish && racing) { r.done = true; r.place = ++s.qualified; ctx.emit({ type: 'finish', id: r.id, place: r.place, name: r.name }); }
    }
    for (const b of C.bumpers) if (b.hit > 0) b.hit -= dt;
    const live = s.racers.filter(r => !r.out && !r.done && r.fall <= 0);
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) if (Math.abs(live[i].y - live[j].y) < 40) U.separate(live[i], live[j]);
    // fin de manche
    const alive = s.racers.filter(r => !r.out);
    if (racing && (s.qualified >= s.quota || alive.every(r => r.done) || s.raceTime > 150)) {
      // temps écoulé : on complète le quota avec ceux qui sont allés le plus loin
      if (s.qualified < s.quota) for (const r of alive.filter(r => !r.done).sort((a, b) => a.y - b.y)) { if (s.qualified >= s.quota) break; r.done = true; r.place = ++s.qualified; }
      for (const r of alive) if (!r.done || r.place > s.quota) r.out = true;
      for (const r of alive) if (r.done && r.place <= s.quota) r.wins++;
      s.phase = 'results'; s.timer = 6;
      ctx.emit({ type: 'roundEnd', round: s.round, quota: s.quota });
    }
  },

  view(s, id) {
    const C = s.course;
    return {
      phase: s.phase, timer: Math.ceil(s.timer), round: s.round, rounds: s.rounds, quota: s.quota, qualified: s.qualified, over: s.over, winner: s.winner, raceTime: Math.round(s.raceTime),
      racers: s.racers.filter(r => !r.left).map(r => ({ id: r.id, name: r.name, color: r.color, bot: r.bot, out: r.out, done: r.done, place: r.place, x: U.r1(r.x ?? 0), y: U.r1(r.y ?? 0), air: r.air > 0 ? U.r2(r.air) : 0, fall: r.fall > 0 ? 1 : 0, dive: r.dive > 0 ? 1 : 0, stun: r.stun > 0 ? 1 : 0, vx: Math.round(r.vx || 0), vy: Math.round(r.vy || 0) })),
      dyn: { plats: C.plats.map(p => Math.round(p.x)), pushers: C.pushers.map(p => Math.round(p.x)), sweepers: C.sweepers.map(w => U.r2(w.a)), doors: C.doors.map(d => (d.open ? 1 : 0)), bumps: C.bumpers.map(b => (b.hit > 0 ? 1 : 0)) },
      course: s.round !== s._sentRound?.[id] ? (((s._sentRound ||= {})[id] = s.round), { walls: C.walls, voids: C.voids, plats: C.plats.map(p => ({ y: p.y, w: p.w, h: p.h })), sweepers: C.sweepers.map(w => ({ x: w.x, y: w.y, len: w.len })), bumpers: C.bumpers.map(b => ({ x: b.x, y: b.y, r: b.r })), pushers: C.pushers.map(p => ({ y: p.y, h: p.h, gap: p.gap })), belts: C.belts, doors: C.doors.map(d => ({ x: d.x, y: d.y, w: d.w, h: d.h })), slime: C.slime, start: C.start, finish: C.finish, length: C.length, checkpoints: C.checkpoints, types: C.types }) : undefined,
    };
  },
};

// ---------- IA des bots ----------
function botRun(s, r, dt) {
  const C = s.course, inp = { u: true, d: false, l: false, r: false };
  r.botT -= dt;
  // cible horizontale selon l'obstacle devant
  const ahead = r.y - 160;
  let tx = r.tx ?? r.x;
  const door = C.doors.filter(d => d.y > ahead - 60 && d.y < r.y && (d.open || !d.tried?.includes(r.id)));
  if (door.length) {
    const open = door.filter(d => d.open);
    const pick = (open.length ? open : door).sort((a, b) => Math.abs(a.x + a.w / 2 - r.x) - Math.abs(b.x + b.w / 2 - r.x))[0];
    tx = pick.x + pick.w / 2;
    if (!pick.open && Math.abs(r.y - (pick.y + pick.h)) < 30 && Math.abs(r.vy) < 40 && r.botT <= 0) { (pick.tried ||= []).push(r.id); r.botT = 0.6; }
  }
  for (const pu of C.pushers) if (pu.y < r.y && pu.y > r.y - 260) tx = pu.x + pu.gap / 2;
  const v = C.voids.find(v => r.y > v.y && r.y < v.y + v.h + 60);
  if (v) {
    const p = C.plats.find(p => p.y >= v.y - 5 && p.y <= v.y + 20);
    if (p) tx = p.x + p.w / 2;
    if (r.y < v.y + v.h + 40 && r.y > v.y + v.h && (v.h <= 130 || Math.random() < 0.02) && Math.random() < r.skill) r.jumpPress = true;
    // attend la plateforme au bord
    const onP = C.plats.some(q => r.x > q.x && r.x < q.x + q.w && r.y > q.y && r.y < q.y + q.h);
    if (v.h > 130 && !onP && r.y > v.y + v.h && Math.abs(tx - r.x) > 60) inp.u = false;
  }
  for (const sw of C.sweepers) { const d = Math.hypot(sw.x - r.x, sw.y - r.y); if (d < sw.len + 40 && Math.random() < r.skill * 0.08) r.jumpPress = true; }
  if (Math.random() < dt * 0.2) r.tx = U.rand(80, WIDTH - 80); else r.tx = tx;
  inp.l = tx < r.x - 20; inp.r = tx > r.x + 20;
  if (Math.random() > r.skill + 0.25) inp.u = false;
  r.input = inp;
}
