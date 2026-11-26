// =====================================================================
//  TOWER DEFENSE — règles (serveur)
//  Coopération : placez et améliorez des tours pour empêcher les vagues
//  d'ennemis d'atteindre la sortie. 8 tours × 3 niveaux, 8 ennemis, boss.
// =====================================================================
const U = require('./lib/util');
const C = 56, COLS = 22, ROWS = 13, W = COLS * C, H = ROWS * C, TICK = 20;

const MAPS = {
  serpent: { name: 'Serpent', pts: [[-1, 2], [17, 2], [17, 6], [3, 6], [3, 10], [22, 10]] },
  spirale: { name: 'Spirale', pts: [[-1, 1], [20, 1], [20, 11], [2, 11], [2, 4], [16, 4], [16, 8], [7, 8]] },
  double:  { name: 'Croisement', pts: [[10, -1], [10, 3], [3, 3], [3, 9], [18, 9], [18, 3], [13, 3], [13, 13]] },
  zigzag:  { name: 'Zigzag', pts: [[-1, 6], [4, 6], [4, 1], [9, 1], [9, 11], [14, 11], [14, 1], [19, 1], [19, 6], [22, 6]] },
};
// dmg, rate (s), range (px), cost, upgrades multiplient
const TOWERS = {
  canon:   { name: 'Canon', icon: '💣', cost: 100, dmg: 22, rate: 0.9, range: 150, color: '#64748b', desc: 'Polyvalent' },
  mitrail: { name: 'Mitrailleuse', icon: '🔫', cost: 160, dmg: 7, rate: 0.12, range: 130, color: '#ca8a04', desc: 'Tire très vite' },
  mortier: { name: 'Mortier', icon: '💥', cost: 260, dmg: 45, rate: 2.0, range: 230, splash: 70, color: '#7c2d12', desc: 'Dégâts de zone' },
  givre:   { name: 'Givre', icon: '❄️', cost: 180, dmg: 4, rate: 0.6, range: 120, slow: 0.45, aura: true, color: '#0ea5e9', desc: 'Ralentit tous les ennemis proches' },
  sniper:  { name: 'Sniper', icon: '🎯', cost: 300, dmg: 120, rate: 2.2, range: 380, color: '#166534', desc: 'Très longue portée, vise les plus forts' },
  tesla:   { name: 'Tesla', icon: '⚡', cost: 380, dmg: 30, rate: 1.1, range: 150, chain: 4, color: '#7c3aed', desc: 'Éclair qui rebondit' },
  laser:   { name: 'Laser', icon: '🔆', cost: 520, dmg: 90, rate: 0.1, range: 170, beam: true, color: '#dc2626', desc: 'Rayon continu, perce les blindés' },
  banque:  { name: 'Banque', icon: '🏦', cost: 250, income: 40, range: 0, color: '#eab308', desc: '+40 $ à chaque vague (par niveau)' },
};
const ENEMIES = {
  soldat:   { hp: 60, speed: 60, reward: 6, r: 12, color: '#ef4444' },
  rapide:   { hp: 35, speed: 120, reward: 6, r: 10, color: '#f59e0b' },
  tank:     { hp: 380, speed: 36, reward: 22, r: 18, armor: 0.4, color: '#525252' },
  regen:    { hp: 160, speed: 55, reward: 14, r: 14, regen: 12, color: '#22c55e' },
  bouclier: { hp: 140, speed: 50, reward: 16, r: 14, shield: 120, color: '#3b82f6' },
  essaim:   { hp: 120, speed: 58, reward: 10, r: 15, split: 4, color: '#a855f7' },
  mini:     { hp: 30, speed: 95, reward: 2, r: 8, color: '#c084fc' },
  furtif:   { hp: 90, speed: 85, reward: 14, r: 12, stealth: true, color: '#0f172a' },
  boss:     { hp: 5000, speed: 30, reward: 400, r: 28, armor: 0.3, boss: true, color: '#991b1b' },
};
const DIFF = { facile: 0.75, normal: 1, difficile: 1.35, extreme: 1.8 };

function buildPath(m) {
  const pts = MAPS[m].pts.map(([x, y]) => ({ x: x * C + C / 2, y: y * C + C / 2 }));
  const cells = new Set();
  const P = MAPS[m].pts;
  for (let i = 0; i < P.length - 1; i++) {
    let [x, y] = P[i]; const [x2, y2] = P[i + 1];
    while (x !== x2 || y !== y2) { cells.add(`${x},${y}`); x += Math.sign(x2 - x); y += Math.sign(y2 - y); }
    cells.add(`${x2},${y2}`);
  }
  let len = 0; const segs = [];
  for (let i = 0; i < pts.length - 1; i++) { const l = U.dist(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y); segs.push({ a: pts[i], b: pts[i + 1], l, s: len }); len += l; }
  return { pts, cells, segs, len };
}
function posAt(path, d) {
  for (const sg of path.segs) if (d <= sg.s + sg.l) { const f = (d - sg.s) / sg.l; return { x: U.lerp(sg.a.x, sg.b.x, f), y: U.lerp(sg.a.y, sg.b.y, f) }; }
  return path.pts[path.pts.length - 1];
}
const stat = (t, k) => { const T = TOWERS[t.type], L = t.level; if (k === 'dmg') return T.dmg * [1, 1.7, 2.8][L - 1]; if (k === 'range') return T.range * [1, 1.15, 1.3][L - 1]; if (k === 'rate') return T.rate * [1, 0.85, 0.7][L - 1]; if (k === 'slow') return Math.min(0.7, (T.slow || 0) + (L - 1) * 0.1); if (k === 'chain') return (T.chain || 0) + (L - 1) * 2; if (k === 'income') return T.income * L; return T[k]; };
const upCost = t => Math.round(TOWERS[t.type].cost * [0.8, 1.4][t.level - 1]);

function waveList(s) {
  const n = s.wave, out = [];
  const count = Math.round((6 + n * 2.2) * Math.sqrt(s.players.length));
  for (let i = 0; i < count; i++) {
    let t = 'soldat'; const r = Math.random();
    if (n >= 2 && r < 0.3) t = 'rapide';
    if (n >= 4 && r > 0.8) t = 'tank';
    if (n >= 6 && r > 0.7 && r <= 0.8) t = 'regen';
    if (n >= 8 && r > 0.6 && r <= 0.7) t = 'bouclier';
    if (n >= 7 && r > 0.52 && r <= 0.6) t = 'essaim';
    if (n >= 11 && r > 0.45 && r <= 0.52) t = 'furtif';
    out.push({ t, at: i * Math.max(0.35, 1.1 - n * 0.03) });
  }
  if (n % 10 === 0) out.push({ t: 'boss', at: out.length * 0.5 + 2 });
  return out;
}
function spawn(s, type, dist = 0) {
  const E = ENEMIES[type], hp = Math.round(E.hp * Math.pow(1.12, s.wave - 1) * s.diff * (E.boss ? s.players.length : 1));
  s.enemies.push({ id: s.nid++, type, d: dist, hp, maxHp: hp, shield: E.shield ? E.shield * (1 + s.wave * 0.1) : 0, slow: 0, speed: E.speed * (1 + Math.min(0.6, s.wave * 0.012)), x: 0, y: 0 });
}
function reward(s, ownerId, amount) {
  if (s.shared) { const each = Math.ceil(amount / s.players.length); for (const p of s.players) p.money += each; }
  else { const p = s.players.find(q => q.id === ownerId) || s.players[0]; if (p) p.money += amount; }
}
function hit(s, e, dmg, tower, ctx, pierce) {
  if (e.hp <= 0) return;
  const E = ENEMIES[e.type];
  if (e.shield > 0) { const a = Math.min(e.shield, dmg); e.shield -= a; dmg -= a; }
  if (E.armor && !pierce) dmg *= 1 - E.armor;
  e.hp -= dmg;
  if (tower) tower.dmgDone += dmg;
  if (e.hp <= 0) {
    if (tower) tower.kills++;
    reward(s, tower?.owner, Math.round(E.reward * (1 + s.wave * 0.03)));
    ctx.emit({ type: 'die', x: Math.round(e.x), y: Math.round(e.y), t: e.type });
    if (E.split) for (let k = 0; k < E.split; k++) spawn(s, 'mini', Math.max(0, e.d - k * 12));
  }
}

module.exports = {
  id: 'towers',
  name: 'Tower Defense',
  description: 'En équipe, construisez et améliorez des tours pour stopper les vagues d’ennemis.',
  category: 'Réflexion', icon: '🏰', color: '#0d9488', order: 15, joinInProgress: true,
  tags: ['🤝 Coopération', '🧠 Stratégie'],
  rules: `<ul><li>Choisissez une tour en bas puis cliquez sur une case libre (pas sur le chemin) pour la construire.</li>
    <li>Cliquez sur une tour pour l’<b>améliorer</b> (3 niveaux) ou la <b>vendre</b>.</li>
    <li>Chaque ennemi éliminé rapporte de l’argent. S’il atteint la sortie, l’équipe perd des vies.</li>
    <li>Attention : les ennemis <b>furtifs</b> ne sont vus que par le Sniper, la Tesla et le Laser !</li></ul>`,
  settings: [
    { key: 'map', label: 'Carte', type: 'select', default: 'serpent', options: Object.entries(MAPS).map(([v, m]) => ({ v, l: m.name })) },
    { key: 'difficulty', label: 'Difficulté', type: 'select', default: 'normal', options: [{ v: 'facile', l: 'Facile' }, { v: 'normal', l: 'Normal' }, { v: 'difficile', l: 'Difficile' }, { v: 'extreme', l: 'Extrême' }] },
    { key: 'lives', label: 'Vies', type: 'select', default: 20, options: [{ v: 1, l: '1' }, { v: 10, l: '10' }, { v: 20, l: '20' }, { v: 50, l: '50' }] },
    { key: 'money', label: 'Argent de départ (par joueur)', type: 'select', default: 400, options: [{ v: 250, l: '250 $' }, { v: 400, l: '400 $' }, { v: 800, l: '800 $' }, { v: 2000, l: '2 000 $' }] },
    { key: 'waves', label: 'Vagues pour gagner', type: 'select', default: 30, options: [{ v: 20, l: '20' }, { v: 30, l: '30' }, { v: 50, l: '50' }, { v: 0, l: 'Infini' }] },
    { key: 'shared', label: 'Argent partagé', type: 'toggle', default: false, help: 'Les gains sont répartis entre tous les joueurs.' },
  ],
  minPlayers: 1, maxPlayers: 6, tickRate: TICK,

  create(players, ctx, o) {
    const map = MAPS[o.map] ? o.map : 'serpent';
    return {
      map, path: buildPath(map), towers: [], enemies: [], shots: [], nid: 1,
      players: players.map(p => ({ ...p, money: o.money || 400, cur: null })),
      lives: o.lives || 20, maxLives: o.lives || 20, wave: 0, goal: o.waves ?? 30, diff: DIFF[o.difficulty] || 1, difficulty: o.difficulty || 'normal', shared: !!o.shared,
      phase: 'build', timer: 25, queue: [], qt: 0, speed: 1, over: false, win: false, startMoney: o.money || 400,
    };
  },
  onJoin(s, p) { s.players.push({ ...p, money: s.startMoney + s.wave * 40, cur: null }); },
  onLeave(s, id) { const p = s.players.find(q => q.id === id); s.players = s.players.filter(q => q.id !== id); const heir = s.players[0]; for (const t of s.towers) if (t.owner === id && heir) t.owner = heir.id; },

  onAction(s, id, a, ctx) {
    const p = s.players.find(q => q.id === id); if (!p || s.over) return;
    switch (a.type) {
      case 'build': {
        const T = TOWERS[a.tower], cx = a.cx | 0, cy = a.cy | 0;
        if (!T || cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return;
        if (s.path.cells.has(`${cx},${cy}`) || s.towers.some(t => t.cx === cx && t.cy === cy)) return { error: 'Case occupée' };
        if (p.money < T.cost) return { error: "Pas assez d'argent" };
        p.money -= T.cost;
        s.towers.push({ id: s.nid++, type: a.tower, cx, cy, x: cx * C + C / 2, y: cy * C + C / 2, level: 1, cd: 0, a: 0, owner: id, color: p.color, spent: T.cost, kills: 0, dmgDone: 0, target: 'first' });
        ctx.emit({ type: 'built', x: cx * C + C / 2, y: cy * C + C / 2 });
        return;
      }
      case 'upgrade': {
        const t = s.towers.find(x => x.id === a.id); if (!t || t.level >= 3) return;
        const c = upCost(t); if (p.money < c) return { error: "Pas assez d'argent" };
        p.money -= c; t.level++; t.spent += c; ctx.emit({ type: 'upgraded', x: t.x, y: t.y }); return;
      }
      case 'sell': {
        const i = s.towers.findIndex(x => x.id === a.id); if (i < 0) return;
        p.money += Math.round(s.towers[i].spent * 0.7); s.towers.splice(i, 1); ctx.emit({ type: 'sold' }); return;
      }
      case 'target': { const t = s.towers.find(x => x.id === a.id); if (t && ['first', 'last', 'strong', 'close'].includes(a.mode)) t.target = a.mode; return; }
      case 'go': if (s.phase === 'build') s.timer = 0; return;
      case 'speed': s.speed = s.speed === 1 ? 2 : s.speed === 2 ? 3 : 1; return;
      case 'cur': p.cur = [U.clamp(+a.x || 0, 0, W), U.clamp(+a.y || 0, 0, H)]; return;
      case 'give': { const q = s.players.find(x => x.id === a.to); const n = Math.min(p.money, Math.max(0, a.n | 0)); if (q && q !== p && n) { p.money -= n; q.money += n; ctx.emit({ type: 'gift', from: p.name, n }, q.id); } return; }
    }
  },

  tick(s, rdt, ctx) {
    if (s.over) return;
    const dt = rdt * s.speed;
    if (s.phase === 'build') {
      s.timer -= rdt;
      if (s.timer <= 0) { s.wave++; s.phase = 'wave'; s.queue = waveList(s); s.qt = 0; ctx.emit({ type: 'wave', n: s.wave, boss: s.wave % 10 === 0 }); }
    } else {
      s.qt += dt;
      while (s.queue.length && s.queue[0].at <= s.qt) spawn(s, s.queue.shift().t);
      if (!s.queue.length && !s.enemies.length) {
        const bonus = 60 + s.wave * 8;
        for (const p of s.players) p.money += bonus;
        for (const t of s.towers) if (t.type === 'banque') reward(s, t.owner, stat(t, 'income'));
        ctx.emit({ type: 'waveDone', n: s.wave, bonus });
        if (s.goal && s.wave >= s.goal) { s.over = true; s.win = true; return; }
        s.phase = 'build'; s.timer = 15;
      }
    }
    // ennemis
    for (const e of s.enemies) {
      const E = ENEMIES[e.type];
      let slow = 0;
      for (const t of s.towers) if (TOWERS[t.type].aura && U.dist(t.x, t.y, e.x, e.y) < stat(t, 'range')) slow = Math.max(slow, stat(t, 'slow'));
      e.slowed = slow > 0;
      e.d += e.speed * (1 - slow) * dt;
      if (E.regen && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + E.regen * Math.pow(1.1, s.wave / 3) * dt);
      const p = posAt(s.path, e.d); e.x = p.x; e.y = p.y;
      if (e.d >= s.path.len) { e.hp = 0; e.leaked = true; s.lives -= E.boss ? 10 : e.type === 'tank' ? 3 : 1; ctx.emit({ type: 'leak' }); }
    }
    if (s.lives <= 0) { s.lives = 0; s.over = true; s.win = false; return; }
    // tours
    const visible = (t, e) => !ENEMIES[e.type].stealth || ['sniper', 'tesla', 'laser'].includes(t.type);
    for (const t of s.towers) {
      const T = TOWERS[t.type]; if (T.income) continue;
      t.cd -= dt;
      const R = stat(t, 'range');
      const inRange = s.enemies.filter(e => e.hp > 0 && visible(t, e) && U.dist(t.x, t.y, e.x, e.y) < R);
      if (T.aura) { if (t.cd <= 0 && inRange.length) { t.cd = stat(t, 'rate'); for (const e of inRange) hit(s, e, stat(t, 'dmg'), t, ctx); ctx.emit({ type: 'frost', x: t.x, y: t.y, r: R }); } continue; }
      if (!inRange.length) { t.beam = null; continue; }
      const mode = t.type === 'sniper' && t.target === 'first' ? 'strong' : t.target;
      const e = inRange.sort((a, b) => mode === 'last' ? a.d - b.d : mode === 'strong' ? b.hp - a.hp : mode === 'close' ? U.dist(t.x, t.y, a.x, a.y) - U.dist(t.x, t.y, b.x, b.y) : b.d - a.d)[0];
      t.a = Math.atan2(e.y - t.y, e.x - t.x);
      if (T.beam) { t.beam = e.id; hit(s, e, stat(t, 'dmg') * dt, t, ctx, true); continue; }
      if (t.cd > 0) continue;
      t.cd = stat(t, 'rate');
      if (T.chain) {
        const chain = [e]; let cur = e;
        for (let k = 1; k < stat(t, 'chain'); k++) { const nx = s.enemies.filter(x => x.hp > 0 && !chain.includes(x) && U.dist(cur.x, cur.y, x.x, x.y) < 110).sort((a, b) => U.dist(cur.x, cur.y, a.x, a.y) - U.dist(cur.x, cur.y, b.x, b.y))[0]; if (!nx) break; chain.push(nx); cur = nx; }
        chain.forEach((x, i) => hit(s, x, stat(t, 'dmg') * Math.pow(0.85, i), t, ctx, true));
        ctx.emit({ type: 'zap', pts: [[t.x, t.y], ...chain.map(x => [Math.round(x.x), Math.round(x.y)])] });
      } else if (T.splash) {
        s.shots.push({ id: s.nid++, kind: 'shell', x: t.x, y: t.y, tx: e.x, ty: e.y, t: 0, dur: 0.7, dmg: stat(t, 'dmg'), r: T.splash * (1 + (t.level - 1) * 0.15), tower: t.id });
        ctx.emit({ type: 'fire', k: t.type, x: t.x, y: t.y });
      } else {
        const sp = t.type === 'sniper' ? 2500 : 700;
        s.shots.push({ id: s.nid++, kind: t.type === 'sniper' ? 'snipe' : t.type === 'mitrail' ? 'bullet' : 'ball', x: t.x, y: t.y, target: e.id, sp, dmg: stat(t, 'dmg'), tower: t.id });
        if (t.type !== 'mitrail' || Math.random() < 0.25) ctx.emit({ type: 'fire', k: t.type, x: t.x, y: t.y, a: U.r2(t.a) });
      }
    }
    for (const sh of s.shots) {
      const tower = s.towers.find(x => x.id === sh.tower);
      if (sh.kind === 'shell') {
        sh.t += dt;
        if (sh.t >= sh.dur) { sh.done = true; for (const e of s.enemies) if (e.hp > 0 && !ENEMIES[e.type].stealth && U.dist(sh.tx, sh.ty, e.x, e.y) < sh.r) hit(s, e, sh.dmg, tower, ctx); ctx.emit({ type: 'boom', x: Math.round(sh.tx), y: Math.round(sh.ty), r: sh.r }); }
        continue;
      }
      const e = s.enemies.find(x => x.id === sh.target && x.hp > 0);
      if (!e) { sh.done = true; continue; }
      const d = U.dist(sh.x, sh.y, e.x, e.y), step = sh.sp * dt;
      if (d <= step + 6) { hit(s, e, sh.dmg, tower, ctx); sh.done = true; continue; }
      sh.x += (e.x - sh.x) / d * step; sh.y += (e.y - sh.y) / d * step;
    }
    s.shots = s.shots.filter(x => !x.done);
    s.enemies = s.enemies.filter(e => e.hp > 0);
  },

  results(s) {
    if (!s.over) return null;
    return { key: 'over', players: s.players.map(p => ({ id: p.id, place: 1, win: !!s.win, score: `Vague ${s.wave}` })), records: s.players.map(p => ({ id: p.id, key: 'towers:wave', value: s.win ? s.wave : s.wave - 1 })) };
  },
  view(s) {
    return {
      map: s.map, wave: s.wave, goal: s.goal, lives: s.lives, maxLives: s.maxLives, phase: s.phase, timer: Math.ceil(s.timer), speed: s.speed, over: s.over, win: s.win, shared: s.shared, difficulty: s.difficulty,
      players: s.players.map(p => ({ id: p.id, name: p.name, color: p.color, money: p.money, cur: p.cur })),
      towers: s.towers.map(t => ({ id: t.id, type: t.type, cx: t.cx, cy: t.cy, x: t.x, y: t.y, level: t.level, a: U.r2(t.a), owner: t.owner, color: t.color, beam: t.beam, kills: t.kills, spent: t.spent, target: t.target, upCost: t.level < 3 ? upCost(t) : null, range: stat(t, 'range'), dmg: Math.round(stat(t, 'dmg')) })),
      enemies: s.enemies.map(e => ({ id: e.id, t: e.type, x: U.r1(e.x), y: U.r1(e.y), hp: Math.round(e.hp / e.maxHp * 100), sh: e.shield > 0 ? 1 : 0, sl: e.slowed ? 1 : 0 })),
      shots: s.shots.map(x => x.kind === 'shell' ? [x.id, 'shell', Math.round(x.x + (x.tx - x.x) * x.t / x.dur), Math.round(x.y + (x.ty - x.y) * x.t / x.dur), U.r2(x.t / x.dur)] : [x.id, x.kind, Math.round(x.x), Math.round(x.y)]),
    };
  },
  staticData(s) { return { C, COLS, ROWS, W, H, path: s.path.pts, cells: [...s.path.cells], towers: TOWERS, enemies: ENEMIES, maps: Object.fromEntries(Object.entries(MAPS).map(([k, m]) => [k, { name: m.name, pts: m.pts.map(([x, y]) => ({ x: x * C + C / 2, y: y * C + C / 2 })), cells: [...buildPath(k).cells] }])) }; },
};
