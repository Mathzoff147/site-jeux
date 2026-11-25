// Fantasy Quest : mini-RPG coopératif, 1 à 8 joueurs.
// Choisis ta classe, gagne des niveaux en chassant des monstres, puis terrassez le dragon ensemble.
const G = require('./lib/geo');
const S = require('./lib/shooter');

const W = 3200, H = 2000;
const VILLAGE = { x: 120, y: 760, w: 520, h: 480 };
const ARENA = { x: 2500, y: 560, w: 620, h: 880 };
const CLASSES = {
  guerrier: { name: 'Guerrier', hp: 170, speed: 215, dmg: 28, rate: 0.45, ability: 'Tourbillon', cd: 6 },
  mage:     { name: 'Mage', hp: 100, speed: 220, dmg: 32, rate: 0.6, ability: 'Soin de groupe', cd: 10 },
  archer:   { name: 'Archer', hp: 115, speed: 245, dmg: 19, rate: 0.3, ability: 'Volée de flèches', cd: 5 },
};
const MONSTERS = {
  slime:     { name: 'Slime', hp: 45, dmg: 7, speed: 85, xp: 12, r: 14, zone: 'foret' },
  loup:      { name: 'Loup', hp: 70, dmg: 11, speed: 155, xp: 20, r: 16, zone: 'foret' },
  squelette: { name: 'Squelette', hp: 130, dmg: 16, speed: 105, xp: 40, r: 16, zone: 'cimetiere', ranged: true },
  golem:     { name: 'Golem', hp: 320, dmg: 28, speed: 70, xp: 90, r: 26, zone: 'ruines' },
};
const ZONES = {
  foret: { x: 760, y: 500, w: 900, h: 1100, types: ['slime', 'slime', 'loup'], max: 14 },
  cimetiere: { x: 700, y: 60, w: 1500, h: 380, types: ['squelette'], max: 9 },
  ruines: { x: 1750, y: 1450, w: 1350, h: 500, types: ['golem', 'squelette'], max: 7 },
};

function makeObstacles() {
  const obs = [];
  // Murs de l'arène du dragon, avec une entrée à gauche
  obs.push({ x: ARENA.x - 30, y: ARENA.y - 30, w: ARENA.w + 60, h: 30, kind: 'mur' });
  obs.push({ x: ARENA.x - 30, y: ARENA.y + ARENA.h, w: ARENA.w + 60, h: 30, kind: 'mur' });
  obs.push({ x: ARENA.x + ARENA.w, y: ARENA.y - 30, w: 30, h: ARENA.h + 60, kind: 'mur' });
  obs.push({ x: ARENA.x - 30, y: ARENA.y - 30, w: 30, h: ARENA.h / 2 - 60, kind: 'mur' });
  obs.push({ x: ARENA.x - 30, y: ARENA.y + ARENA.h / 2 + 90, w: 30, h: ARENA.h / 2 - 60, kind: 'mur' });
  const keep = [{ x: VILLAGE.x + VILLAGE.w / 2, y: VILLAGE.y + VILLAGE.h / 2, r: 380 }, { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h / 2, r: 520 }];
  const trees = G.makeObstacles(W, H, 70, 40, 70, keep).map(o => ({ ...o, kind: o.y < 440 ? 'tombe' : 'arbre' }));
  return obs.concat(trees);
}

function newBoss(n) {
  const hp = Math.round(2600 * (0.7 + 0.45 * n));
  return { x: ARENA.x + ARENA.w * 0.65, y: ARENA.y + ARENA.h / 2, r: 48, hp, maxHp: hp, atk: 3, charge: 7, vx: 0, vy: 0, awake: false, dashing: 0 };
}

function spawnMonster(state, zoneId) {
  const z = ZONES[zoneId];
  for (let tries = 0; tries < 20; tries++) {
    const x = G.rand(z.x, z.x + z.w), y = G.rand(z.y, z.y + z.h);
    if (state._obstacles.some(o => G.pointInRect(x, y, { x: o.x - 30, y: o.y - 30, w: o.w + 60, h: o.h + 60 }))) continue;
    if (state.players.some(p => G.dist(p.x, p.y, x, y) < 350)) continue;
    const type = G.pick(z.types), m = MONSTERS[type];
    state.monsters.push({ id: state.nextId++, type, zone: zoneId, x, y, r: m.r, hp: m.hp, maxHp: m.hp, atk: 0, shoot: G.rand(1, 2), wx: x, wy: y, hit: 0 });
    return;
  }
}

function gainXp(state, pl, xp) {
  pl.xp += xp;
  while (pl.xp >= pl.level * 60 && pl.level < 20) {
    pl.xp -= pl.level * 60; pl.level++;
    pl.maxHp = Math.round(CLASSES[pl.cls].hp * (1 + 0.12 * (pl.level - 1)));
    pl.hp = pl.maxHp;
    state.effects.push({ kind: 'level', x: Math.round(pl.x), y: Math.round(pl.y), t: 1.2, r: 60 });
  }
}

function damageMonster(state, m, dmg, pl) {
  m.hp -= dmg; m.hit = 0.15;
  if (m.isBoss) { pl.bossDmg = (pl.bossDmg || 0) + dmg; return; }
  if (m.hp <= 0 && !m.dead) {
    m.dead = true;
    // XP partagée avec les alliés proches
    state.players.forEach(o => { if (o.alive && o.cls && (o === pl || G.dist(o.x, o.y, m.x, m.y) < 500)) gainXp(state, o, MONSTERS[m.type].xp); });
    pl.kills++;
  }
}

const playerDmg = (pl) => CLASSES[pl.cls].dmg * (1 + 0.12 * (pl.level - 1));

module.exports = {
  id: 'fantasy-quest',
  name: 'Fantasy Quest',
  description: 'Mini-RPG en coopération : classes, niveaux, monstres et un dragon à abattre.',
  category: 'Aventure',
  icon: '🐉',
  color: '#c58cff',
  order: 18,
  realtime: true,
  rules: "Choisis ta classe : Guerrier (corps à corps, Tourbillon), Mage (boules de feu, soigne le groupe) ou Archer (tir rapide, Volée de flèches). ZQSD/flèches pour bouger, souris pour viser, clic gauche pour attaquer, clic droit ou Maj pour la capacité spéciale. Tuer des monstres donne de l'expérience et fait monter de niveau (plus de vie et de dégâts). Au village, tu te soignes. Forêt (facile), cimetière (moyen), ruines (difficile)… et à l'est, l'antre du dragon. Battez-le ensemble pour gagner !",
  minPlayers: 1,
  maxPlayers: 8,

  setup(n) {
    const state = {
      W, H, village: VILLAGE, arena: ARENA, zones: ZONES, classes: CLASSES, monsterTypes: MONSTERS,
      _obstacles: makeObstacles(), _sent: {},
      players: Array.from({ length: n }, (_, i) => ({
        i, cls: null, x: VILLAGE.x + 150 + (i % 4) * 60, y: VILLAGE.y + 200 + Math.floor(i / 4) * 60, r: 16,
        hp: 100, maxHp: 100, level: 1, xp: 0, alive: true, respawn: 0, ang: 0, cd: 0, abilityCd: 0, kills: 0, bossDmg: 0, speed: 220,
      })),
      monsters: [], projectiles: [], effects: [], boss: newBoss(n), nextId: 1, time: 0,
      over: false, winner: null, turn: -1,
    };
    for (const z of Object.keys(ZONES)) for (let k = 0; k < ZONES[z].max - 2; k++) spawnMonster(state, z);
    return state;
  },

  move(state, p, move) {
    const pl = state.players[p];
    if (move.type === 'class' && CLASSES[move.cls] && !pl.cls) {
      const c = CLASSES[move.cls];
      Object.assign(pl, { cls: move.cls, hp: c.hp, maxHp: c.hp, speed: c.speed });
      return null;
    }
    S.storeInput(state, p, move);
    return null;
  },

  tick(state, dt) {
    state.time += dt;
    state.effects = state.effects.filter(e => (e.t -= dt) > 0);
    const allTargets = () => state.monsters.concat(state.boss.hp > 0 ? [Object.assign(state.boss, { isBoss: true })] : []);

    // Joueurs
    for (const pl of state.players) {
      if (!pl.cls) continue;
      if (!pl.alive) {
        pl.respawn -= dt;
        if (pl.respawn <= 0) Object.assign(pl, { alive: true, hp: pl.maxHp, x: VILLAGE.x + G.rand(100, 400), y: VILLAGE.y + G.rand(100, 380) });
        continue;
      }
      const input = S.inputOf(state, pl.i);
      G.moveTopDown(pl, input, pl.speed, dt);
      pl.x = G.clamp(pl.x, pl.r, W - pl.r); pl.y = G.clamp(pl.y, pl.r, H - pl.r);
      for (const o of state._obstacles) G.pushOutOfRect(pl, o);
      if (input.ax || input.ay) pl.ang = Math.atan2(input.ay - pl.y, input.ax - pl.x);
      if (G.pointInRect(pl.x, pl.y, VILLAGE)) pl.hp = Math.min(pl.maxHp, pl.hp + 20 * dt);
      pl.cd -= dt; pl.abilityCd = Math.max(0, pl.abilityCd - dt);
      const dmg = playerDmg(pl);

      if (input.fire && pl.cd <= 0) {
        pl.cd = CLASSES[pl.cls].rate;
        if (pl.cls === 'guerrier') {
          state.effects.push({ kind: 'slash', x: Math.round(pl.x), y: Math.round(pl.y), ang: G.r1(pl.ang), r: 75, t: 0.15 });
          for (const m of allTargets()) {
            const d = G.dist(pl.x, pl.y, m.x, m.y);
            let diff = Math.abs(Math.atan2(m.y - pl.y, m.x - pl.x) - pl.ang); if (diff > Math.PI) diff = 2 * Math.PI - diff;
            if (d < 75 + m.r && diff < 1) damageMonster(state, m, dmg, pl);
          }
        } else {
          const speed = pl.cls === 'mage' ? 560 : 850;
          state.projectiles.push({ x: pl.x, y: pl.y, vx: Math.cos(pl.ang) * speed, vy: Math.sin(pl.ang) * speed, dmg, from: 'p', owner: pl.i, life: 0.9, kind: pl.cls === 'mage' ? 'feu' : 'fleche', splash: pl.cls === 'mage' ? 45 : 0 });
        }
      }
      if (input.alt && pl.abilityCd <= 0) {
        pl.abilityCd = CLASSES[pl.cls].cd;
        if (pl.cls === 'guerrier') {
          state.effects.push({ kind: 'whirl', x: Math.round(pl.x), y: Math.round(pl.y), r: 120, t: 0.35 });
          for (const m of allTargets()) if (G.dist(pl.x, pl.y, m.x, m.y) < 120 + m.r) damageMonster(state, m, dmg * 1.8, pl);
        } else if (pl.cls === 'mage') {
          state.effects.push({ kind: 'heal', x: Math.round(pl.x), y: Math.round(pl.y), r: 220, t: 0.6 });
          state.players.forEach(o => { if (o.alive && o.cls && G.dist(o.x, o.y, pl.x, pl.y) < 220) o.hp = Math.min(o.maxHp, o.hp + 45 + pl.level * 4); });
        } else {
          for (let k = -3; k <= 3; k++) {
            const a = pl.ang + k * 0.12;
            state.projectiles.push({ x: pl.x, y: pl.y, vx: Math.cos(a) * 850, vy: Math.sin(a) * 850, dmg, from: 'p', owner: pl.i, life: 0.9, kind: 'fleche' });
          }
        }
      }
    }
    const living = state.players.filter(p => p.alive && p.cls);
    const separateAll = state.players.filter(p => p.alive && p.cls);
    for (let a = 0; a < separateAll.length; a++) for (let b = a + 1; b < separateAll.length; b++) G.separate(separateAll[a], separateAll[b]);

    const hurtPlayer = (pl, dmg) => {
      if (!pl.alive) return;
      pl.hp -= dmg;
      if (pl.hp <= 0) { pl.hp = 0; pl.alive = false; pl.respawn = 5; }
    };

    // Monstres
    for (const z of Object.keys(ZONES)) if (state.monsters.filter(m => m.zone === z).length < ZONES[z].max && Math.random() < dt * 0.4) spawnMonster(state, z);
    for (const m of state.monsters) {
      const type = MONSTERS[m.type];
      m.hit = Math.max(0, m.hit - dt);
      let target = null, best = 320;
      for (const pl of living) { if (G.pointInRect(pl.x, pl.y, VILLAGE)) continue; const d = G.dist(pl.x, pl.y, m.x, m.y); if (d < best) { best = d; target = pl; } }
      let tx = m.wx, ty = m.wy, speed = type.speed * 0.5;
      if (target) {
        tx = target.x; ty = target.y; speed = type.speed;
        if (type.ranged && best > 140) speed = type.speed * 0.4;
      } else if (G.dist(m.x, m.y, m.wx, m.wy) < 10) { const z = ZONES[m.zone]; m.wx = G.rand(z.x, z.x + z.w); m.wy = G.rand(z.y, z.y + z.h); }
      const a = Math.atan2(ty - m.y, tx - m.x);
      const d = G.dist(m.x, m.y, tx, ty);
      if (d > m.r + 18) { m.x += Math.cos(a) * speed * dt; m.y += Math.sin(a) * speed * dt; }
      for (const o of state._obstacles) G.pushOutOfRect(m, o);
      if (G.pointInRect(m.x, m.y, VILLAGE)) { m.x -= Math.cos(a) * speed * dt * 2; m.y -= Math.sin(a) * speed * dt * 2; }
      m.atk -= dt; m.shoot -= dt;
      if (target && best < m.r + target.r + 6 && m.atk <= 0) { m.atk = 1; hurtPlayer(target, type.dmg); }
      if (target && type.ranged && m.shoot <= 0 && best < 420) {
        m.shoot = 2;
        state.projectiles.push({ x: m.x, y: m.y, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, dmg: type.dmg * 0.8, from: 'e', life: 1.4, kind: 'os' });
      }
    }
    for (let a = 0; a < state.monsters.length; a++) for (let b = a + 1; b < state.monsters.length; b++) G.separate(state.monsters[a], state.monsters[b]);
    state.monsters = state.monsters.filter(m => !m.dead);

    // Le dragon
    const boss = state.boss;
    if (boss.hp > 0) {
      const inArena = living.filter(p => G.pointInRect(p.x, p.y, ARENA));
      boss.awake = inArena.length > 0;
      if (boss.awake) {
        boss.atk -= dt; boss.charge -= dt;
        const target = inArena.reduce((a, b) => (G.dist(b.x, b.y, boss.x, boss.y) < G.dist(a.x, a.y, boss.x, boss.y) ? b : a));
        if (boss.atk <= 0) {
          boss.atk = boss.hp < boss.maxHp / 2 ? 1.8 : 2.6;
          const n = boss.hp < boss.maxHp / 2 ? 14 : 10, off = Math.random();
          for (let k = 0; k < n; k++) {
            const a = off + k * Math.PI * 2 / n;
            state.projectiles.push({ x: boss.x, y: boss.y, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, dmg: 22, from: 'e', life: 2.5, kind: 'feu-dragon' });
          }
        }
        if (boss.charge <= 0) {
          boss.charge = 6; boss.dashing = 0.7;
          const a = Math.atan2(target.y - boss.y, target.x - boss.x);
          boss.vx = Math.cos(a) * 650; boss.vy = Math.sin(a) * 650;
        }
        if (boss.dashing > 0) {
          boss.dashing -= dt;
          boss.x = G.clamp(boss.x + boss.vx * dt, ARENA.x + boss.r, ARENA.x + ARENA.w - boss.r);
          boss.y = G.clamp(boss.y + boss.vy * dt, ARENA.y + boss.r, ARENA.y + ARENA.h - boss.r);
          for (const pl of inArena) if (G.dist(pl.x, pl.y, boss.x, boss.y) < boss.r + pl.r && !pl.bumped) { hurtPlayer(pl, 35); pl.bumped = true; }
        } else living.forEach(p => { p.bumped = false; });
      } else if (boss.hp < boss.maxHp) boss.hp = Math.min(boss.maxHp, boss.hp + 40 * dt); // il se régénère si on fuit
      boss.hit = Math.max(0, (boss.hit || 0) - dt);
    }

    // Projectiles
    state.projectiles = state.projectiles.filter(pr => {
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
      if (pr.life <= 0 || state._obstacles.some(o => G.pointInRect(pr.x, pr.y, o))) {
        if (pr.splash) state.effects.push({ kind: 'boom', x: Math.round(pr.x), y: Math.round(pr.y), r: pr.splash, t: 0.2 });
        return false;
      }
      if (pr.from === 'p') {
        const hit = allTargets().find(m => !m.dead && G.dist(m.x, m.y, pr.x, pr.y) < m.r + 4);
        if (hit) {
          const owner = state.players[pr.owner];
          if (pr.splash) {
            state.effects.push({ kind: 'boom', x: Math.round(pr.x), y: Math.round(pr.y), r: pr.splash, t: 0.2 });
            allTargets().forEach(m => { if (!m.dead && G.dist(m.x, m.y, pr.x, pr.y) < pr.splash + m.r) damageMonster(state, m, pr.dmg, owner); });
          } else damageMonster(state, hit, pr.dmg, owner);
          return false;
        }
      } else {
        const hit = living.find(p => G.dist(p.x, p.y, pr.x, pr.y) < p.r + 5);
        if (hit) { hurtPlayer(hit, pr.dmg); return false; }
      }
      return true;
    });
    state.monsters = state.monsters.filter(m => !m.dead);

    if (boss.hp <= 0 && !state.over) {
      state.over = true; state.winner = -2;
      const mvp = state.players.reduce((a, b) => (b.bossDmg > a.bossDmg ? b : a));
      state.mvp = mvp.i;
      state.resultText = '🐉 Le dragon est vaincu ! Victoire de toute l\'équipe !';
    }
  },

  view(state, me) {
    const v = {
      ...state, me,
      players: state.players.map(p => ({ i: p.i, cls: p.cls, x: Math.round(p.x), y: Math.round(p.y), r: p.r, hp: Math.round(p.hp), maxHp: p.maxHp, level: p.level, xp: p.xp, alive: p.alive, respawn: Math.ceil(p.respawn), ang: G.r1(p.ang), abilityCd: G.r1(p.abilityCd), kills: p.kills })),
      monsters: state.monsters.map(m => ({ id: m.id, type: m.type, x: Math.round(m.x), y: Math.round(m.y), r: m.r, hp: Math.round(m.hp), maxHp: m.maxHp, hit: m.hit > 0 })),
      projectiles: state.projectiles.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), kind: p.kind, a: G.r1(Math.atan2(p.vy, p.vx)) })),
      boss: { x: Math.round(state.boss.x), y: Math.round(state.boss.y), r: state.boss.r, hp: Math.max(0, Math.round(state.boss.hp)), maxHp: state.boss.maxHp, awake: state.boss.awake, hit: state.boss.hit > 0 },
    };
    if (!state._sent[me]) { v.obstacles = state._obstacles; state._sent[me] = true; }
    return v;
  },
  resync(state, me) { state._sent[me] = false; },
};
