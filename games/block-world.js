// Block World : monde de blocs en 2D (vue de côté), 1 à 8 joueurs.
// Creuse, récolte, construis, fabrique… et survis aux slimes la nuit.
const G = require('./lib/geo');
const S = require('./lib/shooter');

const COLS = 220, ROWS = 90, T = 20;
const B = { AIR: 0, HERBE: 1, TERRE: 2, PIERRE: 3, BOIS: 4, FEUILLES: 5, PLANCHES: 6, CHARBON: 7, OR: 8, SABLE: 9, VERRE: 11, SOCLE: 12, BRIQUE: 13 };
const HARDNESS = { 1: 0.3, 2: 0.3, 3: 0.9, 4: 0.6, 5: 0.12, 6: 0.5, 7: 1.0, 8: 1.3, 9: 0.25, 11: 0.2, 13: 1.0 };
const DROPS = { 1: 2, 5: 0 }; // l'herbe donne de la terre, les feuilles ne donnent rien
const SLOTS = [B.TERRE, B.PIERRE, B.BOIS, B.PLANCHES, B.VERRE, B.SABLE, B.BRIQUE];
const DAY = 240; // durée d'un cycle jour/nuit (s)
const SOLID = (v) => v !== B.AIR && v !== B.FEUILLES;

function generate() {
  const w = new Uint8Array(COLS * ROWS);
  const set = (x, y, v) => { if (x >= 0 && x < COLS && y >= 0 && y < ROWS) w[y * COLS + x] = v; };
  const heights = [];
  const seed = Math.random() * 1000;
  for (let x = 0; x < COLS; x++) {
    const h = 34 + Math.sin((x + seed) / 17) * 6 + Math.sin((x + seed) / 7) * 2 + Math.sin((x + seed * 2) / 41) * 8;
    heights.push(Math.round(h));
  }
  for (let x = 0; x < COLS; x++) {
    const h = heights[x];
    const beach = h > 43;
    for (let y = h; y < ROWS; y++) {
      let v = y === h ? (beach ? B.SABLE : B.HERBE) : y < h + 4 ? (beach ? B.SABLE : B.TERRE) : B.PIERRE;
      if (v === B.PIERRE) { const r = Math.random(); if (r < 0.03) v = B.CHARBON; else if (r < 0.04 && y > 60) v = B.OR; }
      set(x, y, v);
    }
    set(x, ROWS - 1, B.SOCLE);
  }
  // Grottes (marches aléatoires)
  for (let k = 0; k < 14; k++) {
    let x = G.randInt(10, COLS - 10), y = G.randInt(48, ROWS - 8);
    for (let s = 0; s < 120; s++) {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (y + dy < ROWS - 1) set(x + dx, y + dy, B.AIR);
      x += G.randInt(-1, 1); y += G.randInt(-1, 1);
      y = G.clamp(y, 44, ROWS - 4);
    }
  }
  // Arbres
  for (let x = 4; x < COLS - 4; x += G.randInt(5, 11)) {
    const h = heights[x];
    if (w[h * COLS + x] !== B.HERBE) continue;
    const trunk = G.randInt(4, 6);
    for (let k = 1; k <= trunk; k++) set(x, h - k, B.BOIS);
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 1; dy++) {
      if (Math.abs(dx) + Math.abs(dy) < 4 && w[(h - trunk + dy) * COLS + x + dx] === B.AIR) set(x + dx, h - trunk + dy, B.FEUILLES);
    }
  }
  return { w, heights };
}

const tileAt = (state, tx, ty) => (tx < 0 || tx >= COLS || ty >= ROWS ? B.SOCLE : ty < 0 ? B.AIR : state._world[ty * COLS + tx]);
const solidAt = (state, tx, ty) => SOLID(tileAt(state, tx, ty));

function setTile(state, tx, ty, v) {
  state._world[ty * COLS + tx] = v;
  state._edits.push([ty * COLS + tx, v]);
}

// Physique d'une entité rectangulaire {x, y (centre), w, h, vx, vy}
function physics(state, e, dt) {
  e.vy = Math.min(e.vy + 1700 * dt, 950);
  e.x += e.vx * dt;
  const top = Math.floor((e.y - e.h / 2) / T), bottom = Math.floor((e.y + e.h / 2 - 0.01) / T);
  if (e.vx > 0) { const cx = Math.floor((e.x + e.w / 2) / T); for (let ty = top; ty <= bottom; ty++) if (solidAt(state, cx, ty)) { e.x = cx * T - e.w / 2 - 0.01; e.vx = 0; e.blocked = true; break; } }
  if (e.vx < 0) { const cx = Math.floor((e.x - e.w / 2) / T); for (let ty = top; ty <= bottom; ty++) if (solidAt(state, cx, ty)) { e.x = (cx + 1) * T + e.w / 2 + 0.01; e.vx = 0; e.blocked = true; break; } }
  e.y += e.vy * dt;
  e.onGround = false;
  const left = Math.floor((e.x - e.w / 2) / T), right = Math.floor((e.x + e.w / 2 - 0.01) / T);
  if (e.vy > 0) { const cy = Math.floor((e.y + e.h / 2) / T); for (let tx = left; tx <= right; tx++) if (solidAt(state, tx, cy)) { e.y = cy * T - e.h / 2 - 0.01; e.vy = 0; e.onGround = true; break; } }
  if (e.vy < 0) { const cy = Math.floor((e.y - e.h / 2) / T); for (let tx = left; tx <= right; tx++) if (solidAt(state, tx, cy)) { e.y = (cy + 1) * T + e.h / 2 + 0.01; e.vy = 0; break; } }
}

function spawnPoint(state) {
  const x = Math.floor(COLS / 2) + G.randInt(-3, 3);
  let y = 0;
  while (y < ROWS - 1 && !solidAt(state, x, y)) y++;
  return { x: x * T + T / 2, y: y * T - 20 };
}

module.exports = {
  id: 'block-world',
  name: 'Block World',
  description: 'Un monde de blocs à creuser et construire ensemble. Gare aux slimes la nuit !',
  category: 'Aventure',
  icon: '⛏️',
  color: '#3ecf7a',
  order: 17,
  realtime: true,
  rules: "Q/D ou ←/→ pour marcher, Z/↑/Espace pour sauter. Clic gauche maintenu sur un bloc pour le creuser (il va dans ton inventaire) ou pour frapper un monstre. Clic droit pour poser le bloc sélectionné. Touches 1 à 7 pour choisir le bloc. Fabrication : 1 bois = 4 planches, 2 sable = 1 verre, 2 pierres = 1 brique. Le jour et la nuit alternent : la nuit, des slimes apparaissent. C'est un monde libre : construisez ce que vous voulez !",
  minPlayers: 1,
  maxPlayers: 8,

  setup(n) {
    const { w } = generate();
    const state = {
      COLS, ROWS, T, slots: SLOTS, _world: w, _edits: [], _cur: {},
      players: [], monsters: [], time: 30, day: DAY, nextId: 1, over: false, winner: null, turn: -1,
    };
    for (let i = 0; i < n; i++) {
      const sp = spawnPoint(state);
      state.players.push({ i, x: sp.x + i * 6, y: sp.y, w: 12, h: 30, vx: 0, vy: 0, hp: 100, hurt: 0, inv: {}, sel: 0, mine: null, cd: 0, face: 1, dead: 0 });
    }
    return state;
  },

  move(state, p, move) {
    const pl = state.players[p];
    if (move.type === 'select') { pl.sel = G.clamp(move.slot | 0, 0, SLOTS.length - 1); return null; }
    if (move.type === 'craft') {
      const inv = pl.inv;
      const recipes = { planches: [B.BOIS, 1, B.PLANCHES, 4], verre: [B.SABLE, 2, B.VERRE, 1], brique: [B.PIERRE, 2, B.BRIQUE, 1] };
      const r = recipes[move.recipe];
      if (!r || (inv[r[0]] || 0) < r[1]) return 'Pas assez de matériaux.';
      inv[r[0]] -= r[1]; inv[r[2]] = (inv[r[2]] || 0) + r[3];
      return null;
    }
    S.storeInput(state, p, move);
    return null;
  },

  tick(state, dt) {
    state.time = (state.time + dt) % DAY;
    const night = state.time > DAY * 0.55;

    for (const pl of state.players) {
      if (pl.dead > 0) { pl.dead -= dt; if (pl.dead <= 0) { const sp = spawnPoint(state); Object.assign(pl, { x: sp.x, y: sp.y, vx: 0, vy: 0, hp: 100 }); } continue; }
      const input = S.inputOf(state, pl.i);
      const dir = (input.r ? 1 : 0) - (input.l ? 1 : 0);
      pl.vx = dir * 170;
      if (dir) pl.face = dir;
      if ((input.u || input.jump) && pl.onGround) pl.vy = -540;
      physics(state, pl, dt);
      pl.hurt = Math.max(0, pl.hurt - dt);
      if (pl.hurt <= 0 && pl.hp < 100) pl.hp = Math.min(100, pl.hp + 3 * dt);
      pl.cd -= dt;

      const tx = Math.floor(input.ax / T), ty = Math.floor(input.ay / T);
      const inReach = G.dist(input.ax, input.ay, pl.x, pl.y) < 5.5 * T;

      if (input.fire && inReach) {
        // Frapper un monstre ?
        const m = state.monsters.find(m => Math.abs(m.x - input.ax) < m.w && Math.abs(m.y - input.ay) < m.h);
        if (m) {
          if (pl.cd <= 0) { pl.cd = 0.35; m.hp -= 12; m.vx = Math.sign(m.x - pl.x) * 300; m.vy = -250; }
          pl.mine = null;
        } else {
          const v = tileAt(state, tx, ty);
          if (v !== B.AIR && v !== B.SOCLE && ty >= 0) {
            if (!pl.mine || pl.mine.tx !== tx || pl.mine.ty !== ty) pl.mine = { tx, ty, p: 0 };
            pl.mine.p += dt / (HARDNESS[v] || 0.5);
            if (pl.mine.p >= 1) {
              setTile(state, tx, ty, B.AIR);
              const drop = DROPS[v] !== undefined ? DROPS[v] : v;
              if (drop) pl.inv[drop] = (pl.inv[drop] || 0) + 1;
              pl.mine = null;
            }
          } else pl.mine = null;
        }
      } else pl.mine = null;

      if (input.alt && inReach && pl.cd <= 0) {
        const block = SLOTS[pl.sel];
        const target = tileAt(state, tx, ty);
        const touchesBody = state.players.some(o => o.dead <= 0 && Math.abs(o.x - (tx * T + T / 2)) < (o.w + T) / 2 && Math.abs(o.y - (ty * T + T / 2)) < (o.h + T) / 2);
        const hasNeighbor = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tileAt(state, tx + dx, ty + dy) !== B.AIR);
        if ((pl.inv[block] || 0) > 0 && (target === B.AIR || target === B.FEUILLES) && !touchesBody && hasNeighbor && ty >= 0) {
          setTile(state, tx, ty, block);
          pl.inv[block]--;
          pl.cd = 0.15;
        }
      }
    }

    // Monstres : apparaissent la nuit, fondent au soleil
    if (night && state.monsters.length < state.players.length * 4 && Math.random() < dt * 0.6) {
      const target = G.pick(state.players);
      const x = G.clamp(Math.floor((target.x + G.pick([-1, 1]) * G.rand(300, 600)) / T), 2, COLS - 3);
      let y = 0; while (y < ROWS - 1 && !solidAt(state, x, y)) y++;
      state.monsters.push({ id: state.nextId++, x: x * T + T / 2, y: y * T - 10, w: 18, h: 16, vx: 0, vy: 0, hp: 36, jump: 0, atk: 0 });
    }
    for (const m of state.monsters) {
      if (!night) m.hp -= 6 * dt;
      let target = null, best = Infinity;
      for (const pl of state.players) { if (pl.dead > 0) continue; const d = G.dist(m.x, m.y, pl.x, pl.y); if (d < best) { best = d; target = pl; } }
      m.jump -= dt;
      if (m.onGround) m.vx *= Math.pow(0.01, dt);
      if (target && best < 700 && m.onGround && m.jump <= 0) { m.vx = Math.sign(target.x - m.x) * 150; m.vy = -420; m.jump = G.rand(0.6, 1.4); }
      physics(state, m, dt);
      m.atk -= dt;
      if (target && Math.abs(target.x - m.x) < (target.w + m.w) / 2 && Math.abs(target.y - m.y) < (target.h + m.h) / 2 && m.atk <= 0) {
        m.atk = 1; target.hp -= 12; target.hurt = 5; target.vx = Math.sign(target.x - m.x) * 200;
        if (target.hp <= 0) { target.hp = 0; target.dead = 3; }
      }
    }
    state.monsters = state.monsters.filter(m => m.hp > 0 && m.y < ROWS * T);
  },

  view(state, me) {
    const v = {
      ...state, me,
      players: state.players.map(p => ({ i: p.i, x: Math.round(p.x), y: Math.round(p.y), w: p.w, h: p.h, hp: Math.round(p.hp), sel: p.sel, face: p.face, dead: p.dead > 0, inv: p.inv, mine: p.mine ? { tx: p.mine.tx, ty: p.mine.ty, p: Math.round(p.mine.p * 10) / 10 } : null })),
      monsters: state.monsters.map(m => ({ id: m.id, x: Math.round(m.x), y: Math.round(m.y), w: m.w, h: m.h, hp: Math.round(m.hp) })),
      time: Math.round(state.time),
    };
    const cur = state._cur[me];
    if (cur === undefined || cur < 0) {
      v.world = Buffer.from(state._world).toString('base64');
      v.edits = [];
    } else v.edits = state._edits.slice(cur);
    state._cur[me] = state._edits.length;
    return v;
  },
  resync(state, me) { state._cur[me] = -1; },
};
