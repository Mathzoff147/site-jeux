// Tower Defense coopératif : 1 à 4 joueurs, or partagé, 25 vagues.
const G = require('./lib/geo');

const COLS = 24, ROWS = 16, T = 40, W = COLS * T, H = ROWS * T;
const WAVES = 25;
const WAYPOINTS = [[-1, 2], [5, 2], [5, 8], [2, 8], [2, 13], [10, 13], [10, 4], [15, 4], [15, 11], [20, 11], [20, 6], [24, 6]];
const TOWERS = {
  canon:   { name: 'Canon', cost: 100, range: 125, rate: 0.8, dmg: 32, color: '#ffb547' },
  mitrail: { name: 'Mitrailleuse', cost: 80, range: 105, rate: 0.18, dmg: 7, color: '#4da3ff' },
  givre:   { name: 'Givre', cost: 120, range: 100, rate: 1.0, dmg: 6, slow: 0.5, color: '#7fd3ff' },
  mortier: { name: 'Mortier', cost: 180, range: 175, rate: 2.0, dmg: 45, splash: 65, color: '#ff5d6c' },
};

function pathCells() {
  const cells = new Set();
  for (let k = 0; k < WAYPOINTS.length - 1; k++) {
    let [x, y] = WAYPOINTS[k];
    const [tx, ty] = WAYPOINTS[k + 1];
    while (x !== tx || y !== ty) {
      if (x >= 0 && x < COLS) cells.add(y * COLS + x);
      x += Math.sign(tx - x); y += Math.sign(ty - y);
    }
    if (tx >= 0 && tx < COLS) cells.add(ty * COLS + tx);
  }
  return [...cells];
}
const WP_PX = WAYPOINTS.map(([x, y]) => [x * T + T / 2, y * T + T / 2]);

function startWave(state) {
  state.wave++;
  state.phase = 'wave';
  const n = state.wave;
  state.queue = [];
  const count = 8 + n * 2;
  for (let k = 0; k < count; k++) {
    let kind = 'normal';
    if (n >= 3 && k % 4 === 3) kind = 'rapide';
    if (n >= 6 && k % 6 === 5) kind = 'blinde';
    state.queue.push(kind);
  }
  if (n % 5 === 0) state.queue.push('boss');
  state.spawnTimer = 0;
}

function spawn(state, kind) {
  const base = 30 * Math.pow(1.19, state.wave);
  const stats = {
    normal: { hp: base, speed: 60, reward: 6, r: 11 },
    rapide: { hp: base * 0.6, speed: 115, reward: 7, r: 9 },
    blinde: { hp: base * 2.6, speed: 45, reward: 14, r: 14 },
    boss:   { hp: base * 14, speed: 38, reward: 120, r: 20 },
  }[kind];
  state.enemies.push({ id: state.nextId++, kind, x: WP_PX[0][0], y: WP_PX[0][1], wp: 1, slow: 0, maxHp: stats.hp, ...stats });
}

module.exports = {
  id: 'tower-defense',
  name: 'Tower Defense',
  description: 'Construisez vos tours ensemble et repoussez 25 vagues d\'ennemis.',
  category: 'Stratégie',
  icon: '🗼',
  color: '#7fd3ff',
  order: 16,
  realtime: true,
  sendEvery: 2,
  rules: "Coopération : l'or est partagé entre tous les joueurs. Choisis une tour (touches 1 à 4 ou boutons), puis clique sur une case d'herbe pour la construire. Canon : polyvalent. Mitrailleuse : tir rapide. Givre : ralentit. Mortier : gros dégâts de zone. Clique sur une tour existante pour l'améliorer (3 niveaux), clic droit pour la vendre. Chaque ennemi qui atteint la sortie coûte une vie (et 5 pour un boss). Tenez 25 vagues !",
  minPlayers: 1,
  maxPlayers: 4,

  setup() {
    return {
      W, H, T, COLS, ROWS, path: pathCells(), waypoints: WAYPOINTS, towerTypes: TOWERS, waves: WAVES,
      towers: [], enemies: [], shots: [], gold: 260, lives: 20, wave: 0, phase: 'build', timer: 20,
      queue: [], spawnTimer: 0, nextId: 1, over: false, winner: null, turn: -1,
    };
  },

  move(state, p, move) {
    if (state.over) return null;
    const tx = move.tx | 0, ty = move.ty | 0;
    const existing = state.towers.find(t => t.tx === tx && t.ty === ty);
    if (move.type === 'start' && state.phase === 'build') { state.timer = 0; return null; }
    if (move.type === 'build') {
      const type = TOWERS[move.tower];
      if (!type || tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return 'Case invalide.';
      if (existing || state.path.includes(ty * COLS + tx)) return 'Impossible de construire ici.';
      if (state.gold < type.cost) return "Pas assez d'or.";
      state.gold -= type.cost;
      state.towers.push({ tx, ty, type: move.tower, level: 1, cd: 0, spent: type.cost, by: p, ang: 0 });
      return null;
    }
    if (move.type === 'upgrade') {
      if (!existing) return 'Aucune tour ici.';
      if (existing.level >= 3) return 'Niveau maximum atteint.';
      const cost = TOWERS[existing.type].cost * existing.level;
      if (state.gold < cost) return "Pas assez d'or.";
      state.gold -= cost; existing.spent += cost; existing.level++;
      return null;
    }
    if (move.type === 'sell') {
      if (!existing) return 'Aucune tour ici.';
      state.gold += Math.floor(existing.spent * 0.6);
      state.towers = state.towers.filter(t => t !== existing);
      return null;
    }
    return null;
  },

  tick(state, dt) {
    state.shots = state.shots.filter(s => (s.t -= dt) > 0);
    if (state.phase === 'build') {
      state.timer -= dt;
      if (state.timer <= 0) startWave(state);
      return;
    }
    // Apparition des ennemis
    if (state.queue.length) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) { spawn(state, state.queue.shift()); state.spawnTimer = Math.max(0.35, 0.9 - state.wave * 0.02); }
    }
    // Déplacement le long du chemin
    for (const e of state.enemies) {
      e.slow = Math.max(0, e.slow - dt);
      let move = e.speed * (e.slow > 0 ? 0.5 : 1) * dt;
      while (move > 0 && e.wp < WP_PX.length) {
        const [wx, wy] = WP_PX[e.wp];
        const d = G.dist(e.x, e.y, wx, wy);
        if (d <= move) { e.x = wx; e.y = wy; e.wp++; move -= d; }
        else { e.x += (wx - e.x) / d * move; e.y += (wy - e.y) / d * move; move = 0; }
      }
      if (e.wp >= WP_PX.length) { e.hp = 0; e.escaped = true; state.lives -= e.kind === 'boss' ? 5 : 1; }
    }
    // Tirs des tours
    for (const t of state.towers) {
      const type = TOWERS[t.type];
      const mult = Math.pow(1.6, t.level - 1), range = type.range + (t.level - 1) * 15;
      const cx = t.tx * T + T / 2, cy = t.ty * T + T / 2;
      t.cd -= dt;
      if (t.cd > 0) continue;
      const inRange = state.enemies.filter(e => e.hp > 0 && G.dist(cx, cy, e.x, e.y) <= range);
      if (!inRange.length) continue;
      const target = inRange.reduce((a, b) => (b.wp > a.wp || (b.wp === a.wp && G.dist(b.x, b.y, ...WP_PX[b.wp] || [0, 0]) < G.dist(a.x, a.y, ...WP_PX[a.wp] || [0, 0])) ? b : a));
      t.cd = type.rate;
      t.ang = Math.round(Math.atan2(target.y - cy, target.x - cx) * 100) / 100;
      const dmg = type.dmg * mult;
      if (type.splash) {
        state.enemies.forEach(e => { if (G.dist(e.x, e.y, target.x, target.y) < type.splash) e.hp -= dmg; });
        state.shots.push({ x1: cx, y1: cy, x2: Math.round(target.x), y2: Math.round(target.y), kind: 'boom', t: 0.25 });
      } else {
        target.hp -= dmg;
        if (type.slow) target.slow = 2;
        state.shots.push({ x1: cx, y1: cy, x2: Math.round(target.x), y2: Math.round(target.y), kind: t.type, t: 0.08 });
      }
    }
    for (const e of state.enemies) if (e.hp <= 0 && !e.escaped && !e.paid) { e.paid = true; state.gold += e.reward; }
    state.enemies = state.enemies.filter(e => e.hp > 0);

    if (state.lives <= 0) {
      state.lives = 0; state.over = true; state.winner = -2;
      state.resultText = `💥 La base est tombée à la vague ${state.wave}.`;
    } else if (!state.queue.length && !state.enemies.length) {
      if (state.wave >= WAVES) {
        state.over = true; state.winner = -2;
        state.resultText = `🏆 Victoire ! Les ${WAVES} vagues ont été repoussées.`;
      } else {
        state.gold += 40 + state.wave * 5;
        state.phase = 'build'; state.timer = 10;
      }
    }
  },

  view(state, me) {
    return { ...state, me, enemies: state.enemies.map(e => ({ id: e.id, kind: e.kind, x: Math.round(e.x), y: Math.round(e.y), r: e.r, hp: Math.round(e.hp), maxHp: Math.round(e.maxHp), slow: e.slow > 0 })) };
  },
};
