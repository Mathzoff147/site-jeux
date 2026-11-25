// Moteur de tir vue de dessus, partagé par Battle Royale, Tactical Strike et Zombie Survival
const G = require('./geo');

const WEAPONS = {
  pistolet:  { name: 'Pistolet',          dmg: 18, rate: 0.32, speed: 750,  spread: 0.04, pellets: 1, life: 0.8 },
  smg:       { name: 'Mitraillette',      dmg: 9,  rate: 0.08, speed: 750,  spread: 0.13, pellets: 1, life: 0.6 },
  pompe:     { name: 'Fusil à pompe',     dmg: 11, rate: 0.85, speed: 700,  spread: 0.32, pellets: 7, life: 0.45 },
  fusil:     { name: "Fusil d'assaut",    dmg: 16, rate: 0.12, speed: 900,  spread: 0.05, pellets: 1, life: 0.9 },
  sniper:    { name: 'Sniper',            dmg: 85, rate: 1.4,  speed: 1600, spread: 0,    pellets: 1, life: 1.0 },
  minigun:   { name: 'Minigun',           dmg: 8,  rate: 0.05, speed: 850,  spread: 0.18, pellets: 1, life: 0.7 },
};

function newPlayer(i, x, y, extra = {}) {
  return Object.assign({
    i, x, y, r: 16, hp: 100, maxHp: 100, alive: true, ang: 0, cd: 0,
    weapon: 'pistolet', speed: 230, kills: 0, deaths: 0, team: 0, respawn: 0,
  }, extra);
}

// Mémorise les touches envoyées par un joueur (champ secret "_in")
function storeInput(state, p, move) {
  if (move.type !== 'input') return false;
  state._in = state._in || {};
  state._in[p] = {
    u: !!move.u, d: !!move.d, l: !!move.l, r: !!move.r,
    fire: !!move.fire, alt: !!move.alt, jump: !!move.jump,
    ax: Number(move.ax) || 0, ay: Number(move.ay) || 0, key: move.key | 0,
  };
  return true;
}
const inputOf = (state, p) => (state._in && state._in[p]) || {};

// Déplace et fait tirer tous les joueurs vivants
function stepPlayers(state, dt, { W, H, obstacles = [], canFire = () => true }) {
  for (const pl of state.players) {
    if (!pl.alive) continue;
    const input = inputOf(state, pl.i);
    G.moveTopDown(pl, input, pl.speed * (pl.speedMul || 1), dt);
    pl.x = G.clamp(pl.x, pl.r, W - pl.r);
    pl.y = G.clamp(pl.y, pl.r, H - pl.r);
    for (const o of obstacles) G.pushOutOfRect(pl, o);
    if (input.ax || input.ay) pl.ang = Math.atan2(input.ay - pl.y, input.ax - pl.x);
    pl.cd -= dt;
    if (input.fire && pl.cd <= 0 && canFire(pl)) fire(state, pl);
  }
  // Les joueurs ne se traversent pas
  const alive = state.players.filter(p => p.alive);
  for (let a = 0; a < alive.length; a++) for (let b = a + 1; b < alive.length; b++) G.separate(alive[a], alive[b]);
}

function fire(state, pl, weaponId) {
  const w = WEAPONS[weaponId || pl.weapon];
  pl.cd = w.rate * (pl.rateMul || 1);
  for (let k = 0; k < w.pellets; k++) {
    const a = pl.ang + (Math.random() - 0.5) * w.spread * 2;
    state.bullets.push({
      x: pl.x + Math.cos(pl.ang) * (pl.r + 4), y: pl.y + Math.sin(pl.ang) * (pl.r + 4),
      vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
      dmg: w.dmg * (pl.dmgMul || 1), owner: pl.i, team: pl.team, life: w.life,
    });
  }
}

// Fait avancer les balles. targets = cercles touchables. onHit(balle, cible)
function stepBullets(state, dt, { W, H, obstacles = [], targets = [], onHit }) {
  const keep = [];
  for (const b of state.bullets) {
    const steps = 2; // deux sous-étapes pour ne pas traverser les cibles
    let dead = false;
    for (let s = 0; s < steps && !dead; s++) {
      b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
      if (b.x < 0 || b.y < 0 || b.x > W || b.y > H) dead = true;
      else if (obstacles.some(o => G.pointInRect(b.x, b.y, o))) dead = true;
      else {
        const t = targets.find(t => t.alive !== false && G.dist(b.x, b.y, t.x, t.y) < t.r + 3 && onHit(b, t, true));
        if (t) { onHit(b, t, false); dead = true; }
      }
    }
    b.life -= dt;
    if (!dead && b.life > 0) { b.x = G.r1(b.x); b.y = G.r1(b.y); keep.push(b); }
  }
  state.bullets = keep;
}

// Version allégée d'un joueur pour l'envoi réseau
const slim = (p) => ({ ...p, x: Math.round(p.x), y: Math.round(p.y), ang: G.r1(p.ang) });

module.exports = { WEAPONS, newPlayer, storeInput, inputOf, stepPlayers, stepBullets, fire, slim };
