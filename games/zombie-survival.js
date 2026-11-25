// Zombie Survival : coopération 1 à 8 joueurs contre des vagues de zombies.
// Gagne de l'argent en tuant, améliore ton équipement, tiens le plus de vagues possible.
const G = require('./lib/geo');
const S = require('./lib/shooter');

const W = 1700, H = 1100;
const WEAPON_PATH = ['pistolet', 'smg', 'pompe', 'fusil', 'minigun'];
const WEAPON_PRICE = { smg: 150, pompe: 300, fusil: 500, minigun: 900 };
const SHOP = {
  arme: { name: 'Arme suivante' },
  soin: { name: 'Soin complet', price: 60 },
  degats: { name: '+25 % de dégâts', price: 250 },
  vitesse: { name: '+10 % de vitesse', price: 150 },
};

function startWave(state) {
  state.wave++;
  state.phase = 'wave';
  state.toSpawn = 6 + state.wave * 4;
  state.spawnTimer = 0;
  // Les joueurs morts reviennent au début de chaque vague
  for (const pl of state.players) if (!pl.alive) Object.assign(pl, { alive: true, hp: 60, x: W / 2 + G.rand(-60, 60), y: H / 2 + G.rand(-60, 60) });
}

function spawnZombie(state) {
  const side = G.randInt(0, 3);
  const x = side === 0 ? -20 : side === 1 ? W + 20 : G.rand(0, W);
  const y = side === 2 ? -20 : side === 3 ? H + 20 : G.rand(0, H);
  const n = state.wave, count = state.spawned++;
  let z = { kind: 'normal', hp: 40 + n * 8, speed: 70 + n * 3, r: 15, dmg: 10 };
  if (count % 3 === 2) z = { kind: 'rapide', hp: 25 + n * 5, speed: 135 + n * 3, r: 12, dmg: 8 };
  if (count % 10 === 9) z = { kind: 'brute', hp: 300 + n * 40, speed: 55, r: 26, dmg: 25 };
  state.zombies.push({ id: state.nextId++, x, y, ...z, maxHp: z.hp, atk: 0 });
}

module.exports = {
  id: 'zombie-survival',
  name: 'Zombie Survival',
  description: 'Vagues de zombies, argent, armes améliorées : survivez ensemble.',
  category: 'Action',
  icon: '🧟',
  color: '#7ddf64',
  order: 12,
  realtime: true,
  rules: "Coopération : ZQSD/flèches pour bouger, souris pour viser, clic gauche pour tirer. Chaque zombie tué rapporte de l'argent. Achète à tout moment : 1 = arme suivante (mitraillette → pompe → fusil → minigun), 2 = soin complet, 3 = +25 % de dégâts, 4 = +10 % de vitesse. Les zombies rapides sont fragiles, les brutes très résistantes. Les joueurs morts reviennent à la vague suivante. La partie s'arrête quand toute l'équipe est à terre.",
  minPlayers: 1,
  maxPlayers: 8,

  setup(n) {
    const obstacles = G.makeObstacles(W, H, 14, 60, 140, [{ x: W / 2, y: H / 2, r: 220 }]);
    const players = Array.from({ length: n }, (_, i) => S.newPlayer(i, W / 2 + (i % 4) * 40 - 60, H / 2 + Math.floor(i / 4) * 40, { money: 0 }));
    const state = {
      W, H, _obstacles: obstacles, players, bullets: [], zombies: [], shop: SHOP, prices: WEAPON_PRICE, path: WEAPON_PATH,
      wave: 0, phase: 'pause', timer: 5, toSpawn: 0, spawned: 0, spawnTimer: 0, nextId: 1,
      over: false, winner: null, turn: -1, _sent: {},
    };
    return state;
  },

  move(state, p, move) {
    const pl = state.players[p];
    if (move.type === 'buy') {
      if (move.item === 'arme') {
        const next = WEAPON_PATH[WEAPON_PATH.indexOf(pl.weapon) + 1];
        if (!next) return 'Tu as déjà la meilleure arme.';
        if (pl.money < WEAPON_PRICE[next]) return "Pas assez d'argent.";
        pl.money -= WEAPON_PRICE[next]; pl.weapon = next;
      } else if (SHOP[move.item] && pl.money >= SHOP[move.item].price && pl.alive) {
        pl.money -= SHOP[move.item].price;
        if (move.item === 'soin') pl.hp = pl.maxHp;
        if (move.item === 'degats') pl.dmgMul = (pl.dmgMul || 1) + 0.25;
        if (move.item === 'vitesse') pl.speed *= 1.1;
      }
      return null;
    }
    S.storeInput(state, p, move);
    return null;
  },

  tick(state, dt) {
    if (state.phase === 'pause') {
      state.timer -= dt;
      if (state.timer <= 0) startWave(state);
    } else if (state.toSpawn > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) { spawnZombie(state); state.toSpawn--; state.spawnTimer = Math.max(0.25, 1.2 - state.wave * 0.06); }
    } else if (!state.zombies.length) {
      state.phase = 'pause'; state.timer = 12;
      state.players.forEach(p => { if (p.alive) p.money += 50; });
    }

    S.stepPlayers(state, dt, { W, H, obstacles: state._obstacles });

    // Zombies : marchent vers le joueur vivant le plus proche
    const alive = state.players.filter(p => p.alive);
    for (const z of state.zombies) {
      let target = null, best = Infinity;
      for (const pl of alive) { const d = G.dist(z.x, z.y, pl.x, pl.y); if (d < best) { best = d; target = pl; } }
      if (!target) continue;
      const a = Math.atan2(target.y - z.y, target.x - z.x);
      z.x += Math.cos(a) * z.speed * dt; z.y += Math.sin(a) * z.speed * dt;
      for (const o of state._obstacles) G.pushOutOfRect(z, o);
      z.atk -= dt;
      if (best < z.r + target.r + 2 && z.atk <= 0) {
        z.atk = 0.8;
        target.hp -= z.dmg;
        if (target.hp <= 0) { target.alive = false; target.hp = 0; target.deaths++; }
      }
    }
    for (let a = 0; a < state.zombies.length; a++) for (let b = a + 1; b < state.zombies.length; b++) G.separate(state.zombies[a], state.zombies[b]);

    S.stepBullets(state, dt, {
      W, H, obstacles: state._obstacles, targets: state.zombies,
      onHit: (b, z, check) => {
        if (check) return z.hp > 0;
        z.hp -= b.dmg;
        if (z.hp <= 0) {
          const shooter = state.players[b.owner];
          shooter.kills++; shooter.money += z.kind === 'brute' ? 60 : z.kind === 'rapide' ? 15 : 10;
        }
        return true;
      },
    });
    state.zombies = state.zombies.filter(z => z.hp > 0);

    if (state.wave > 0 && !state.players.some(p => p.alive)) {
      state.over = true; state.winner = -2;
      state.resultText = `💀 L'équipe est tombée à la vague ${state.wave} !`;
    }
  },

  view(state, me) {
    const v = {
      ...state, me, players: state.players.map(S.slim),
      zombies: state.zombies.map(z => ({ id: z.id, x: Math.round(z.x), y: Math.round(z.y), r: z.r, kind: z.kind, hp: Math.round(z.hp), maxHp: z.maxHp })),
    };
    if (!state._sent[me]) { v.obstacles = state._obstacles; state._sent[me] = true; }
    return v;
  },
  resync(state, me) { state._sent[me] = false; },
};
