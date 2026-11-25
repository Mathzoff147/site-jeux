// Mini Battle Royale : 2 à 16 joueurs, vue de dessus.
// Ramasse des armes, reste dans la zone qui rétrécit, sois le dernier survivant.
const G = require('./lib/geo');
const S = require('./lib/shooter');

const W = 2400, H = 2400;
const LOOT = ['smg', 'pompe', 'fusil', 'sniper', 'medkit', 'medkit', 'smg', 'fusil', 'pompe', 'medkit'];

module.exports = {
  id: 'battle-royale',
  name: 'Mini Battle Royale',
  description: 'Largage, pillage, zone mortelle : le dernier debout gagne.',
  category: 'Action',
  icon: '🪂',
  color: '#ff9f43',
  order: 10,
  realtime: true,
  rules: "Déplace-toi avec ZQSD ou les flèches, vise à la souris, clic gauche pour tirer. Marche sur les objets pour les ramasser : armes (mitraillette, fusil à pompe, fusil d'assaut, sniper) et trousses de soin (+50 PV). La zone sûre (cercle) rétrécit régulièrement : hors de la zone, tu perds de la vie. Le dernier survivant gagne.",
  minPlayers: 2,
  maxPlayers: 16,

  setup(n) {
    const obstacles = G.makeObstacles(W, H, 55, 50, 160);
    const players = [];
    for (let i = 0; i < n; i++) {
      let x, y;
      do { x = G.rand(150, W - 150); y = G.rand(150, H - 150); }
      while (obstacles.some(o => G.pointInRect(x, y, { x: o.x - 30, y: o.y - 30, w: o.w + 60, h: o.h + 60 }))
        || players.some(p => G.dist(p.x, p.y, x, y) < 500));
      players.push(S.newPlayer(i, x, y));
    }
    const items = [];
    for (let k = 0; k < 60; k++) {
      const x = G.rand(60, W - 60), y = G.rand(60, H - 60);
      if (obstacles.some(o => G.pointInRect(x, y, o))) continue;
      items.push({ id: k, x: Math.round(x), y: Math.round(y), kind: G.pick(LOOT) });
    }
    return {
      W, H, _obstacles: obstacles, players, bullets: [], items,
      zone: { x: W / 2, y: H / 2, r: 1750, tx: W / 2, ty: H / 2, tr: 1750, wait: 25, stage: 0, dmg: 4 },
      feed: [], time: 0, over: false, winner: null, turn: -1, _sent: {},
    };
  },

  move(state, p, move) { S.storeInput(state, p, move); return null; },

  tick(state, dt) {
    state.time += dt;
    S.stepPlayers(state, dt, { W, H, obstacles: state._obstacles });
    S.stepBullets(state, dt, {
      W, H, obstacles: state._obstacles, targets: state.players,
      onHit: (b, t, check) => {
        if (check) return t.i !== b.owner;
        t.hp -= b.dmg;
        if (t.hp <= 0 && t.alive) {
          t.alive = false; t.hp = 0;
          const killer = state.players[b.owner];
          if (killer) killer.kills++;
          state.feed.unshift({ k: b.owner, v: t.i }); state.feed.length = Math.min(state.feed.length, 5);
        }
        return true;
      },
    });

    // Ramassage
    for (const pl of state.players) {
      if (!pl.alive) continue;
      const it = state.items.find(i => G.dist(i.x, i.y, pl.x, pl.y) < pl.r + 14);
      if (!it) continue;
      if (it.kind === 'medkit') { if (pl.hp >= pl.maxHp) continue; pl.hp = Math.min(pl.maxHp, pl.hp + 50); }
      else { if (pl.weapon === it.kind) continue; pl.weapon = it.kind; }
      state.items = state.items.filter(i => i !== it);
    }

    // La zone
    const z = state.zone;
    z.wait -= dt;
    if (z.wait <= 0 && z.r > 60) {
      if (z.r <= z.tr + 0.5) { // nouvelle phase
        z.stage++;
        z.tr = Math.max(60, z.r * 0.6);
        const a = Math.random() * Math.PI * 2, d = Math.random() * (z.r - z.tr);
        z.tx = G.clamp(z.x + Math.cos(a) * d, z.tr, W - z.tr);
        z.ty = G.clamp(z.y + Math.sin(a) * d, z.tr, H - z.tr);
        z.dmg = 4 + z.stage * 3;
        z.shrink = 15; z.from = { x: z.x, y: z.y, r: z.r };
      }
      z.shrink -= dt;
      const t = G.clamp(1 - z.shrink / 15, 0, 1);
      z.x = z.from.x + (z.tx - z.from.x) * t; z.y = z.from.y + (z.ty - z.from.y) * t; z.r = z.from.r + (z.tr - z.from.r) * t;
      if (t >= 1) z.wait = 20;
    }
    for (const pl of state.players) {
      if (pl.alive && G.dist(pl.x, pl.y, z.x, z.y) > z.r) {
        pl.hp -= z.dmg * dt;
        if (pl.hp <= 0) { pl.alive = false; pl.hp = 0; state.feed.unshift({ k: -1, v: pl.i }); state.feed.length = Math.min(state.feed.length, 5); }
      }
    }

    const alive = state.players.filter(p => p.alive);
    if (alive.length <= 1) { state.over = true; state.winner = alive.length ? alive[0].i : -1; }
  },

  view(state, me) {
    const v = {
      ...state, me,
      players: state.players.map(S.slim),
      zone: { x: Math.round(state.zone.x), y: Math.round(state.zone.y), r: Math.round(state.zone.r), tx: Math.round(state.zone.tx), ty: Math.round(state.zone.ty), tr: Math.round(state.zone.tr) },
      alive: state.players.filter(p => p.alive).length,
    };
    if (!state._sent[me]) { v.obstacles = state._obstacles; state._sent[me] = true; }
    return v;
  },
  resync(state, me) { state._sent[me] = false; },
};
