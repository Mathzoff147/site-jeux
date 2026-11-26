// =====================================================================
//  ZOMBIE SURVIVAL — règles (serveur)
//  Coopération 1 à 8 joueurs contre des vagues de zombies dans une ville
//  en ruine. 9 armes, atouts, grenades, tourelles, barricades, bonus,
//  8 types de zombies + boss, réanimation des coéquipiers, jour/nuit.
// =====================================================================
const U = require('./lib/util');
const W = 2600, H = 1800, CELL = 40, TICK = 30;

// ---------------- Armes ----------------
// dmg par projectile, rate (s entre tirs), mag, reload (s), spread (rad), pellets, speed (px/s), range (px), pierce, aoe (rayon)
const WEAPONS = {
  pistolet:      { name: 'Pistolet', dmg: 22, rate: 0.22, mag: 12, reload: 1.0, spread: 0.04, pellets: 1, speed: 1500, range: 700, price: 0, ammoPrice: 0, reserve: Infinity, sound: 'shot' },
  smg:           { name: 'Mitraillette', dmg: 16, rate: 0.075, mag: 35, reload: 1.5, spread: 0.10, pellets: 1, speed: 1500, range: 600, price: 200, ammoPrice: 40, reserve: 210, sound: 'smg' },
  pompe:         { name: 'Fusil à pompe', dmg: 18, rate: 0.75, mag: 7, reload: 2.2, spread: 0.30, pellets: 9, speed: 1300, range: 380, price: 350, ammoPrice: 50, reserve: 42, sound: 'shotgun' },
  fusil:         { name: "Fusil d'assaut", dmg: 30, rate: 0.11, mag: 30, reload: 1.8, spread: 0.05, pellets: 1, speed: 1800, range: 900, price: 600, ammoPrice: 60, reserve: 180, sound: 'shot' },
  sniper:        { name: 'Fusil de précision', dmg: 220, rate: 1.1, mag: 5, reload: 2.5, spread: 0.0, pellets: 1, speed: 3200, range: 1500, pierce: 6, price: 800, ammoPrice: 70, reserve: 30, sound: 'sniper' },
  lanceflammes:  { name: 'Lance-flammes', dmg: 9, rate: 0.04, mag: 120, reload: 2.6, spread: 0.25, pellets: 1, speed: 520, range: 260, pierce: 99, burn: 4, flame: true, price: 900, ammoPrice: 80, reserve: 480, sound: 'flame' },
  lancegrenades: { name: 'Lance-grenades', dmg: 160, rate: 0.8, mag: 6, reload: 2.8, spread: 0.03, pellets: 1, speed: 750, range: 650, aoe: 130, grenade: true, price: 1100, ammoPrice: 90, reserve: 30, sound: 'shotgun' },
  laser:         { name: 'Fusil laser', dmg: 70, rate: 0.16, mag: 40, reload: 2.0, spread: 0.0, pellets: 1, speed: 0, range: 900, pierce: 99, beam: true, price: 1400, ammoPrice: 100, reserve: 200, sound: 'laser' },
  minigun:       { name: 'Minigun', dmg: 26, rate: 0.045, mag: 150, reload: 3.5, spread: 0.13, pellets: 1, speed: 1700, range: 750, price: 1800, ammoPrice: 120, reserve: 600, slow: 0.65, sound: 'smg' },
};
const WEAPON_ORDER = Object.keys(WEAPONS);

// ---------------- Boutique ----------------
const SHOP = {
  soin:      { name: 'Soin complet', icon: '❤️', price: 80, desc: 'Remet la santé au maximum' },
  armure:    { name: 'Armure', icon: '🛡️', price: 150, desc: '+50 armure (max 100), absorbe 60 % des dégâts' },
  grenades:  { name: '3 grenades', icon: '💣', price: 120, desc: 'Touche G pour lancer' },
  tourelle:  { name: 'Tourelle', icon: '🗼', price: 450, desc: 'Touche T : tire seule sur les zombies' },
  barricade: { name: '2 barricades', icon: '🧱', price: 120, desc: 'Touche F : pose un mur devant vous' },
  // atouts permanents (niveaux)
  degats:    { name: 'Dégâts +20 %', icon: '💥', price: 300, perk: true, max: 5 },
  vitesse:   { name: 'Vitesse +8 %', icon: '👟', price: 200, perk: true, max: 4 },
  vie:       { name: 'Vie max +25', icon: '💗', price: 250, perk: true, max: 4 },
  recharge:  { name: 'Recharge rapide', icon: '⚡', price: 250, perk: true, max: 3, desc: '-20 % temps de recharge' },
  regen:     { name: 'Régénération', icon: '💚', price: 350, perk: true, max: 3, desc: '+2 PV/s par niveau' },
  explosif:  { name: 'Balles explosives', icon: '🔥', price: 900, perk: true, max: 1, desc: 'Petites explosions à l’impact' },
  aimant:    { name: 'Aimant', icon: '🧲', price: 200, perk: true, max: 2, desc: 'Attire les bonus de plus loin' },
  medic:     { name: 'Infirmier', icon: '🩺', price: 250, perk: true, max: 1, desc: 'Réanime 2× plus vite' },
};

// ---------------- Zombies ----------------
const ZTYPES = {
  normal:     { hp: 60, speed: 78, r: 16, dmg: 12, money: 10, color: 0 },
  rapide:     { hp: 38, speed: 165, r: 13, dmg: 8, money: 14 },
  rampant:    { hp: 25, speed: 120, r: 11, dmg: 6, money: 8 },
  brute:      { hp: 520, speed: 58, r: 28, dmg: 30, money: 60, knock: 1 },
  cracheur:   { hp: 70, speed: 70, r: 15, dmg: 8, money: 25, ranged: true },
  kamikaze:   { hp: 45, speed: 150, r: 15, dmg: 45, money: 20, explode: 110 },
  blinde:     { hp: 240, speed: 68, r: 19, dmg: 18, money: 40, armor: 0.55 },
  invocateur: { hp: 180, speed: 60, r: 18, dmg: 10, money: 50, summon: true },
  boss:       { hp: 4500, speed: 72, r: 46, dmg: 45, money: 600, boss: true },
};
const DIFF = { facile: { hp: 0.7, dmg: 0.6, count: 0.75 }, normal: { hp: 1, dmg: 1, count: 1 }, difficile: { hp: 1.35, dmg: 1.3, count: 1.25 }, cauchemar: { hp: 1.8, dmg: 1.7, count: 1.6 } };

// ---------------- Carte : ville en ruine ----------------
function makeMap() {
  const obs = [], decor = [];
  const spawnSafe = [{ x: W / 2, y: H / 2, r: 260 }];
  // pâtés de maisons sur une grille avec des rues
  const BX = 420, BY = 380;
  for (let gx = 0; gx < W / BX; gx++) for (let gy = 0; gy < H / BY; gy++) {
    const x0 = gx * BX + 70, y0 = gy * BY + 70, bw = BX - 140, bh = BY - 140;
    if (Math.abs(x0 + bw / 2 - W / 2) < 300 && Math.abs(y0 + bh / 2 - H / 2) < 260) continue; // place centrale
    const roll = Math.random();
    if (roll < 0.62) { // bâtiment (parfois coupé en deux)
      if (Math.random() < 0.45) { const cut = U.rand(0.35, 0.65) * bw; obs.push({ x: x0, y: y0, w: cut - 30, h: bh, kind: 'building', hue: U.randInt(0, 5) }, { x: x0 + cut + 30, y: y0, w: bw - cut - 30, h: bh, kind: 'building', hue: U.randInt(0, 5) }); }
      else obs.push({ x: x0, y: y0, w: bw, h: bh, kind: 'building', hue: U.randInt(0, 5) });
    } else if (roll < 0.8) { // parc avec arbres
      decor.push({ kind: 'park', x: x0, y: y0, w: bw, h: bh });
      for (let k = 0; k < 4; k++) obs.push({ x: x0 + U.rand(20, bw - 60), y: y0 + U.rand(20, bh - 60), w: 40, h: 40, kind: 'tree' });
    } else { // parking
      decor.push({ kind: 'lot', x: x0, y: y0, w: bw, h: bh });
    }
  }
  // voitures abandonnées et caisses dans les rues
  for (let k = 0; k < 34; k++) {
    const horiz = Math.random() < 0.5;
    const o = horiz ? { w: 84, h: 42 } : { w: 42, h: 84 };
    o.x = U.rand(40, W - 120); o.y = U.rand(40, H - 120); o.kind = Math.random() < 0.75 ? 'car' : 'crate'; o.hue = U.randInt(0, 6);
    if (o.kind === 'crate') { o.w = o.h = 40; }
    if (spawnSafe.some(z => U.circleRect(z, o)) || obs.some(p => o.x < p.x + p.w + 30 && o.x + o.w + 30 > p.x && o.y < p.y + p.h + 30 && o.y + o.h + 30 > p.y)) continue;
    obs.push(o);
  }
  // décor non bloquant
  for (let k = 0; k < 40; k++) decor.push({ kind: U.pick(['crack', 'puddle', 'trash', 'blood']), x: U.rand(0, W), y: U.rand(0, H), r: U.rand(10, 40), a: U.rand(0, 6.28) });
  for (let x = 140; x < W; x += 420) for (let y = 140; y < H; y += 380) decor.push({ kind: 'lamp', x: x - 70, y: y - 70 });
  return { obs, decor };
}

// Grille de navigation (champ de flux vers les joueurs)
function buildGrid(obs) {
  const cols = Math.ceil(W / CELL), rows = Math.ceil(H / CELL), block = new Uint8Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    const c = { x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2, r: 14 };
    if (obs.some(o => U.circleRect(c, o))) block[cy * cols + cx] = 1;
  }
  return { cols, rows, block, dist: new Int32Array(cols * rows) };
}
function flowField(s) {
  const G = s._grid, { cols, rows, block, dist } = G;
  dist.fill(-1);
  const q = new Int32Array(cols * rows); let qh = 0, qt = 0;
  for (const p of s.players) {
    if (!p.alive || p.down) continue;
    const cx = U.clamp(Math.floor(p.x / CELL), 0, cols - 1), cy = U.clamp(Math.floor(p.y / CELL), 0, rows - 1), i = cy * cols + cx;
    if (dist[i] < 0) { dist[i] = 0; q[qt++] = i; }
  }
  while (qh < qt) {
    const i = q[qh++], cx = i % cols, cy = (i / cols) | 0, d = dist[i] + 1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const j = ny * cols + nx; if (block[j] || dist[j] >= 0) continue;
      dist[j] = d; q[qt++] = j;
    }
  }
}
function flowDir(s, x, y) {
  const { cols, rows, dist } = s._grid;
  const cx = U.clamp(Math.floor(x / CELL), 0, cols - 1), cy = U.clamp(Math.floor(y / CELL), 0, rows - 1);
  let best = dist[cy * cols + cx], bx = 0, by = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
    const d = dist[ny * cols + nx]; if (d < 0) continue;
    if (dx && dy && (dist[cy * cols + nx] < 0 || dist[ny * cols + cx] < 0)) continue; // pas de coupe de coin
    if (best < 0 || d < best) { best = d; bx = dx; by = dy; }
  }
  if (!bx && !by) return null;
  return { x: (cx + bx) * CELL + CELL / 2 - x, y: (cy + by) * CELL + CELL / 2 - y };
}

// ---------------- Joueurs ----------------
function newPlayer(p, i, money) {
  return {
    id: p.id, name: p.name, color: p.color, x: W / 2 + (i % 4) * 44 - 66, y: H / 2 + Math.floor(i / 4) * 44, r: 16, a: 0,
    hp: 100, maxHp: 100, armor: 0, alive: true, down: false, downT: 0, revive: 0, money, kills: 0, deaths: 0, dmgDone: 0,
    owned: ['pistolet'], weapon: 'pistolet', ammo: { pistolet: { mag: 12, res: Infinity } }, reloadT: 0, shotT: 0, perks: {},
    grenades: 2, turrets: 0, barricades: 1, input: { u: 0, d: 0, l: 0, r: 0, a: 0, f: 0 }, hurtT: 0, rage: 0,
  };
}
const perk = (p, k) => p.perks[k] || 0;
const speedOf = p => 210 * (1 + 0.08 * perk(p, 'vitesse')) * (WEAPONS[p.weapon].slow || 1) * (p.reloadT > 0 ? 0.9 : 1);

function hurtPlayer(s, p, dmg, ctx, from) {
  if (!p.alive || p.down || dmg <= 0) return;
  dmg *= s.diff.dmg;
  const ab = Math.min(p.armor, dmg * 0.6); p.armor -= ab; p.hp -= dmg - ab; p.hurtT = 0.3;
  ctx.emit({ type: 'hurt', id: p.id, x: from?.x, y: from?.y }, p.id);
  if (p.hp <= 0) {
    p.hp = 0;
    const others = s.players.filter(q => q !== p && q.alive && !q.down);
    if (s.revive && others.length) { p.down = true; p.downT = 30; p.revive = 0; ctx.emit({ type: 'down', id: p.id, x: p.x, y: p.y }); }
    else { p.alive = false; p.deaths++; ctx.emit({ type: 'dead', id: p.id, x: p.x, y: p.y }); }
  }
}

// ---------------- Vagues ----------------
function waveComposition(s) {
  const n = s.wave, players = Math.max(1, s.players.length);
  const total = Math.round((8 + n * 4.5) * (0.6 + 0.4 * players) * s.diff.count);
  const list = [];
  for (let i = 0; i < total; i++) {
    const r = Math.random();
    let t = 'normal';
    if (n >= 2 && r < 0.22) t = 'rapide';
    if (n >= 3 && r > 0.88) t = 'rampant';
    if (n >= 4 && r > 0.82 && r <= 0.88) t = 'cracheur';
    if (n >= 5 && r > 0.76 && r <= 0.82) t = 'kamikaze';
    if (n >= 6 && r > 0.72 && r <= 0.76) t = 'blinde';
    if (n >= 3 && i % 14 === 13) t = 'brute';
    if (n >= 8 && i % 25 === 24) t = 'invocateur';
    list.push(t);
  }
  if (n % s.bossEvery === 0) list.splice(Math.floor(list.length / 2), 0, 'boss');
  return U.shuffle(list.slice(0, -1)).concat(list.slice(-1));
}
function startWave(s, ctx) {
  s.wave++; s.phase = 'wave'; s.queue = waveComposition(s); s.spawnT = 0; s.waveKills = 0; s.waveTotal = s.queue.length;
  for (const p of s.players) if (!p.alive || p.down) { Object.assign(p, { alive: true, down: false, hp: Math.round(p.maxHp * 0.6), x: W / 2 + U.rand(-60, 60), y: H / 2 + U.rand(-60, 60) }); }
  ctx.emit({ type: 'wave', n: s.wave, boss: s.wave % s.bossEvery === 0 });
}
function spawnZombie(s, type, at) {
  const T = ZTYPES[type], n = s.wave;
  let x, y;
  if (at) { x = at.x + U.rand(-30, 30); y = at.y + U.rand(-30, 30); }
  else {
    // apparaît loin des joueurs, sur un bord ou dans une rue libre
    for (let k = 0; k < 30; k++) {
      const side = U.randInt(0, 3);
      x = side === 0 ? 20 : side === 1 ? W - 20 : U.rand(20, W - 20);
      y = side === 2 ? 20 : side === 3 ? H - 20 : U.rand(20, H - 20);
      if (!s._map.obs.some(o => U.circleRect({ x, y, r: T.r + 4 }, o)) && s.players.every(p => U.dist(p.x, p.y, x, y) > 500)) break;
    }
  }
  const scale = (1 + n * 0.09) * s.diff.hp * (T.boss ? 0.6 + 0.4 * s.players.length : 1);
  const hp = Math.round(T.hp * scale);
  s.zombies.push({ id: s.nid++, type, x, y, r: T.r, hp, maxHp: hp, speed: T.speed * (1 + Math.min(0.5, n * 0.015)) * U.rand(0.9, 1.1), atk: 0, a: 0, burn: 0, burnBy: null, slowT: 0, special: U.rand(1, 3), stun: 0 });
}

function killZombie(s, z, killer, ctx, how) {
  if (z.dead) return;
  z.dead = true;
  const T = ZTYPES[z.type];
  if (killer) { killer.kills++; const m = Math.round(T.money * (1 + s.wave * 0.04)); killer.money += m; ctx.emit({ type: 'money', id: killer.id, n: m, x: z.x, y: z.y }, killer.id); }
  s.waveKills++; s.totalKills++;
  ctx.emit({ type: 'zdie', x: z.x, y: z.y, z: z.type, how });
  if (T.explode) explode(s, z.x, z.y, T.explode, 60, null, ctx, true);
  // butin
  const r = Math.random();
  const drop = T.boss ? 'bombe' : r < 0.035 ? 'soin' : r < 0.07 ? 'munitions' : r < 0.08 ? 'rage' : r < 0.084 ? 'bombe' : r < 0.1 ? 'argent' : null;
  if (drop) s.drops.push({ id: s.nid++, kind: drop, x: z.x, y: z.y, t: 25 });
}

function explode(s, x, y, radius, dmg, owner, ctx, hurtsPlayers) {
  ctx.emit({ type: 'boom', x, y, r: radius });
  for (const z of s.zombies) {
    const d = U.dist(x, y, z.x, z.y);
    if (d < radius + z.r) damageZombie(s, z, dmg * (1 - d / (radius + z.r) * 0.5), owner, ctx, 'boom', true);
  }
  if (hurtsPlayers) for (const p of s.players) { const d = U.dist(x, y, p.x, p.y); if (d < radius) hurtPlayer(s, p, dmg * 0.6 * (1 - d / radius), ctx, { x, y }); }
  for (const b of s.barricades) if (U.dist(x, y, b.x, b.y) < radius && hurtsPlayers) b.hp -= dmg;
}

function damageZombie(s, z, dmg, owner, ctx, how, explosive) {
  if (z.dead) return;
  const T = ZTYPES[z.type];
  if (T.armor && !explosive && how !== 'flame') dmg *= 1 - T.armor;
  if (owner) { dmg *= (1 + 0.2 * perk(owner, 'degats')) * (owner.rage > 0 ? 2 : 1); owner.dmgDone += dmg; }
  z.hp -= dmg;
  if (z.hp <= 0) killZombie(s, z, owner, ctx, how);
}

// ---------------- Tirs ----------------
function fire(s, p, ctx) {
  const w = WEAPONS[p.weapon], am = p.ammo[p.weapon];
  if (p.reloadT > 0 || p.shotT > 0) return;
  if (am.mag <= 0) { startReload(p, ctx); return; }
  am.mag--; p.shotT = w.rate;
  const ox = p.x + Math.cos(p.a) * 22, oy = p.y + Math.sin(p.a) * 22;
  if (w.beam) {
    // rayon instantané qui traverse tout jusqu'au premier mur
    const dx = Math.cos(p.a), dy = Math.sin(p.a);
    let len = w.range;
    for (const o of s._map.obs) len = Math.min(len, U.rayRect(ox, oy, dx, dy, o));
    for (const z of s.zombies) { const t = U.rayCircle(ox, oy, dx, dy, z.x, z.y, z.r); if (t < len) { damageZombie(s, z, w.dmg, p, ctx, 'laser'); z.slowT = 0.3; } }
    ctx.emit({ type: 'beam', id: p.id, x: ox, y: oy, x2: ox + dx * len, y2: oy + dy * len });
  } else {
    for (let k = 0; k < w.pellets; k++) {
      const a = p.a + (Math.random() - 0.5) * w.spread * 2;
      s.bullets.push({ id: s.nid++, x: ox, y: oy, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, life: w.range / w.speed, dmg: w.dmg, owner: p.id, pierce: w.pierce || 1, hit: [], kind: w.flame ? 'flame' : w.grenade ? 'gl' : p.weapon === 'sniper' ? 'sniper' : 'b', w: p.weapon });
    }
    ctx.emit({ type: 'shot', id: p.id, w: p.weapon, x: ox, y: oy, a: p.a });
  }
  if (am.mag <= 0 && am.res > 0) startReload(p, ctx);
}
function startReload(p, ctx) {
  const w = WEAPONS[p.weapon], am = p.ammo[p.weapon];
  if (p.reloadT > 0 || am.mag >= w.mag || am.res <= 0) { if (am.res <= 0 && am.mag <= 0) { ctx.emit({ type: 'empty' }, p.id); p.shotT = 0.5; } return; }
  p.reloadT = w.reload * Math.pow(0.8, perk(p, 'recharge')); p.reloadW = p.weapon;
  ctx.emit({ type: 'reload', id: p.id }, p.id);
}

// =====================================================================
module.exports = {
  id: 'zombie',
  name: 'Zombie Survival',
  description: 'Survivez ensemble à des vagues de zombies dans une ville en ruine. Armes, atouts, tourelles, boss.',
  category: 'Action', icon: '🧟', color: '#65a30d', order: 12, joinInProgress: true,
  tags: ['🤝 Coopération', '🔫 9 armes'],
  rules: `<ul><li><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> bouger · <b>souris</b> viser · <b>clic</b> tirer · <kbd>R</kbd> recharger · <kbd>1</kbd>–<kbd>9</kbd> / molette : armes</li>
    <li><kbd>B</kbd> ou <kbd>Tab</kbd> : boutique (armes, munitions, soins, atouts…) · <kbd>G</kbd> grenade · <kbd>T</kbd> tourelle · <kbd>F</kbd> barricade</li>
    <li>Chaque zombie tué rapporte de l’argent. Ramassez les bonus : ❤️ soin, 📦 munitions, 😡 dégâts ×2, ☢️ bombe.</li>
    <li>Un coéquipier à terre ? Restez près de lui pour le <b>réanimer</b>. Boss toutes les 5 vagues !</li></ul>`,
  settings: [
    { key: 'difficulty', label: 'Difficulté', type: 'select', default: 'normal', options: [{ v: 'facile', l: 'Facile' }, { v: 'normal', l: 'Normal' }, { v: 'difficile', l: 'Difficile' }, { v: 'cauchemar', l: 'Cauchemar' }] },
    { key: 'money', label: 'Argent de départ', type: 'select', default: 0, options: [{ v: 0, l: '0 $' }, { v: 300, l: '300 $' }, { v: 800, l: '800 $' }, { v: 2000, l: '2 000 $' }] },
    { key: 'goal', label: 'Objectif', type: 'select', default: 0, options: [{ v: 0, l: 'Survie infinie' }, { v: 10, l: 'Tenir 10 vagues' }, { v: 20, l: 'Tenir 20 vagues' }, { v: 30, l: 'Tenir 30 vagues' }] },
    { key: 'bossEvery', label: 'Boss toutes les', type: 'select', default: 5, options: [{ v: 3, l: '3 vagues' }, { v: 5, l: '5 vagues' }, { v: 10, l: '10 vagues' }] },
    { key: 'light', label: 'Éclairage', type: 'select', default: 'cycle', options: [{ v: 'cycle', l: 'Jour / nuit' }, { v: 'day', l: 'Toujours jour' }, { v: 'night', l: 'Toujours nuit' }] },
    { key: 'pause', label: 'Pause entre les vagues', type: 'number', default: 15, min: 5, max: 45, step: 5, unit: ' s' },
    { key: 'revive', label: 'Réanimation', type: 'toggle', default: true, help: 'Un joueur à terre peut être relevé par un coéquipier.' },
  ],
  minPlayers: 1, maxPlayers: 8, tickRate: TICK,

  create(players, ctx, o) {
    const map = makeMap();
    const s = {
      _map: map, _grid: buildGrid(map.obs), flowT: 0,
      players: players.map((p, i) => newPlayer(p, i, o.money || 0)),
      zombies: [], bullets: [], spit: [], nades: [], turrets: [], barricades: [], drops: [],
      wave: 0, phase: 'pause', timer: 8, queue: [], spawnT: 0, nid: 1, totalKills: 0, waveKills: 0, waveTotal: 0, time: 0,
      diff: DIFF[o.difficulty] || DIFF.normal, difficulty: o.difficulty || 'normal', goal: o.goal || 0, bossEvery: o.bossEvery || 5,
      light: o.light || 'cycle', pauseLen: o.pause || 15, revive: o.revive !== false, over: false, win: false,
    };
    return s;
  },
  onJoin(s, p) { const np = newPlayer(p, s.players.length, 300 + s.wave * 100); if (s.phase === 'wave') { np.alive = false; } s.players.push(np); },
  onLeave(s, id) { s.players = s.players.filter(p => p.id !== id); s.turrets = s.turrets.filter(t => t.owner !== id); },

  onAction(s, id, a, ctx) {
    const p = s.players.find(q => q.id === id); if (!p) return;
    switch (a.type) {
      case 'in': p.input = U.readInput(a); return;
      case 'weapon': { const w = a.w ?? p.owned[(p.owned.indexOf(p.weapon) + (a.dir || 1) + p.owned.length) % p.owned.length]; if (p.owned.includes(w) && w !== p.weapon) { p.weapon = w; p.reloadT = 0; p.shotT = 0.2; } return; }
      case 'reload': if (p.alive && !p.down) startReload(p, ctx); return;
      case 'buy': {
        if (!p.alive || p.down) return { error: 'Vous êtes hors combat' };
        const item = a.item;
        if (WEAPONS[item]) {
          const w = WEAPONS[item];
          if (!p.owned.includes(item)) {
            if (p.money < w.price) return { error: "Pas assez d'argent" };
            p.money -= w.price; p.owned.push(item); p.ammo[item] = { mag: w.mag, res: w.reserve }; p.weapon = item; p.reloadT = 0;
          } else { // munitions
            if (!w.ammoPrice) return { error: 'Munitions illimitées' };
            if (p.money < w.ammoPrice) return { error: "Pas assez d'argent" };
            p.money -= w.ammoPrice; p.ammo[item].res += w.reserve === Infinity ? 0 : Math.ceil(w.reserve / 2);
          }
        } else if (SHOP[item]) {
          const it = SHOP[item], lvl = perk(p, item);
          if (it.perk && lvl >= it.max) return { error: 'Niveau maximum atteint' };
          const price = it.perk ? Math.round(it.price * (1 + lvl * 0.6)) : it.price;
          if (p.money < price) return { error: "Pas assez d'argent" };
          if (item === 'soin' && p.hp >= p.maxHp) return { error: 'Santé déjà au maximum' };
          if (item === 'armure' && p.armor >= 100) return { error: 'Armure déjà au maximum' };
          p.money -= price;
          if (it.perk) { p.perks[item] = lvl + 1; if (item === 'vie') { p.maxHp += 25; p.hp += 25; } }
          if (item === 'soin') p.hp = p.maxHp;
          if (item === 'armure') p.armor = Math.min(100, p.armor + 50);
          if (item === 'grenades') p.grenades += 3;
          if (item === 'tourelle') p.turrets++;
          if (item === 'barricade') p.barricades += 2;
        } else return;
        ctx.emit({ type: 'bought', item }, id);
        return;
      }
      case 'grenade': {
        if (!p.alive || p.down || p.grenades <= 0) return;
        p.grenades--;
        const tx = U.clamp(+a.x || p.x, p.x - 450, p.x + 450), ty = U.clamp(+a.y || p.y, p.y - 450, p.y + 450);
        const d = Math.max(60, U.dist(p.x, p.y, tx, ty)), t = Math.min(1.1, d / 600);
        s.nades.push({ id: s.nid++, x: p.x, y: p.y, vx: (tx - p.x) / t, vy: (ty - p.y) / t, t, max: t, owner: p.id });
        ctx.emit({ type: 'throw' });
        return;
      }
      case 'turret': {
        if (!p.alive || p.down || p.turrets <= 0) return;
        const pos = { x: p.x + Math.cos(p.a) * 40, y: p.y + Math.sin(p.a) * 40, r: 18 };
        if (s._map.obs.some(o => U.circleRect(pos, o))) return { error: 'Pas de place ici' };
        p.turrets--; s.turrets.push({ id: s.nid++, x: pos.x, y: pos.y, a: p.a, hp: 400, ammo: 400, cd: 0, owner: p.id, color: p.color });
        ctx.emit({ type: 'place' }); return;
      }
      case 'barricade': {
        if (!p.alive || p.down || p.barricades <= 0) return;
        const bx = p.x + Math.cos(p.a) * 50, by = p.y + Math.sin(p.a) * 50;
        p.barricades--; s.barricades.push({ id: s.nid++, x: bx, y: by, a: p.a + Math.PI / 2, hp: 600, max: 600 });
        ctx.emit({ type: 'place' }); return;
      }
      case 'skip': if (s.phase === 'pause' && s.wave > 0) { p.ready = true; if (s.players.every(q => q.ready || !q.alive)) s.timer = Math.min(s.timer, 1); } return;
    }
  },

  tick(s, dt, ctx) {
    if (s.over) return;
    s.time += dt;
    // ---- vagues ----
    if (s.phase === 'pause') {
      s.timer -= dt;
      if (s.timer <= 0) { s.players.forEach(p => { p.ready = false; }); startWave(s, ctx); }
    } else {
      if (s.queue.length) {
        s.spawnT -= dt;
        const maxAlive = 40 + s.players.length * 10;
        if (s.spawnT <= 0 && s.zombies.length < maxAlive) { spawnZombie(s, s.queue.shift()); s.spawnT = Math.max(0.18, 1.1 - s.wave * 0.05) / Math.sqrt(s.players.length); }
      } else if (!s.zombies.length) {
        s.phase = 'pause'; s.timer = s.pauseLen;
        for (const p of s.players) if (p.alive) p.money += 50 + s.wave * 10;
        ctx.emit({ type: 'waveDone', n: s.wave });
        if (s.goal && s.wave >= s.goal) { s.over = true; s.win = true; ctx.emit({ type: 'end', win: true }); return; }
      }
    }
    // ---- flux de navigation ----
    s.flowT -= dt; if (s.flowT <= 0) { flowField(s); s.flowT = 0.4; }

    // ---- joueurs ----
    for (const p of s.players) {
      if (!p.alive) continue;
      if (p.down) {
        p.downT -= dt;
        const helper = s.players.find(q => q !== p && q.alive && !q.down && U.dist(p.x, p.y, q.x, q.y) < 55);
        if (helper) { p.revive += dt * (perk(helper, 'medic') ? 2 : 1); if (p.revive >= 3) { p.down = false; p.hp = Math.round(p.maxHp * 0.4); ctx.emit({ type: 'revived', id: p.id, by: helper.id }); } }
        else p.revive = Math.max(0, p.revive - dt);
        if (p.downT <= 0) { p.down = false; p.alive = false; p.deaths++; ctx.emit({ type: 'dead', id: p.id, x: p.x, y: p.y }); }
        continue;
      }
      const inp = p.input, mv = U.moveVec(inp), sp = speedOf(p);
      p.x += mv.x * sp * dt; p.y += mv.y * sp * dt; p.a = inp.a;
      p.x = U.clamp(p.x, p.r, W - p.r); p.y = U.clamp(p.y, p.r, H - p.r);
      for (const o of s._map.obs) U.pushOutRect(p, o);
      for (const b of s.barricades) U.separate(b._c || (b._c = { x: b.x, y: b.y, r: 26 }), p, true);
      p.shotT -= dt; p.hurtT -= dt; p.rage -= dt;
      if (p.reloadT > 0) {
        p.reloadT -= dt;
        if (p.reloadT <= 0 && p.reloadW === p.weapon) { const w = WEAPONS[p.weapon], am = p.ammo[p.weapon], need = w.mag - am.mag, take = Math.min(need, am.res); am.mag += take; if (am.res !== Infinity) am.res -= take; }
      }
      if (inp.f) fire(s, p, ctx);
      if (perk(p, 'regen') && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 2 * perk(p, 'regen') * dt);
      // bonus au sol
      const reach = 30 + perk(p, 'aimant') * 70;
      for (const d of s.drops) {
        const dd = U.dist(p.x, p.y, d.x, d.y);
        if (dd < reach + 60 && dd > 20 && perk(p, 'aimant')) { d.x += (p.x - d.x) / dd * 300 * dt; d.y += (p.y - d.y) / dd * 300 * dt; }
        if (dd > 30 || d.taken) continue;
        d.taken = true;
        if (d.kind === 'soin') for (const q of s.players) if (q.alive && !q.down) q.hp = q.maxHp;
        if (d.kind === 'munitions') for (const q of s.players) for (const k of q.owned) { const w = WEAPONS[k]; if (w.reserve !== Infinity) q.ammo[k].res += Math.ceil(w.reserve / 2); }
        if (d.kind === 'rage') for (const q of s.players) q.rage = 15;
        if (d.kind === 'argent') for (const q of s.players) q.money += 100 + s.wave * 15;
        if (d.kind === 'bombe') { for (const z of s.zombies) if (!ZTYPES[z.type].boss) damageZombie(s, z, 99999, p, ctx, 'boom', true); else damageZombie(s, z, z.maxHp * 0.15, p, ctx, 'boom', true); ctx.emit({ type: 'nuke' }); }
        ctx.emit({ type: 'pickup', kind: d.kind, by: p.id, x: d.x, y: d.y });
      }
    }
    for (let a = 0; a < s.players.length; a++) for (let b = a + 1; b < s.players.length; b++) if (s.players[a].alive && s.players[b].alive) U.separate(s.players[a], s.players[b]);
    s.drops = s.drops.filter(d => !d.taken && (d.t -= dt) > 0);

    // ---- zombies ----
    const targets = s.players.filter(p => p.alive && !p.down);
    for (const z of s.zombies) {
      const T = ZTYPES[z.type];
      if (z.burn > 0) { z.burn -= dt; damageZombie(s, z, 18 * dt, s.players.find(p => p.id === z.burnBy), ctx, 'flame'); }
      if (z.dead) continue;
      z.stun -= dt; z.slowT -= dt;
      let tgt = null, best = Infinity;
      for (const p of targets) { const d = U.dist(z.x, z.y, p.x, p.y); if (d < best) { best = d; tgt = p; } }
      if (!tgt) { z.a += dt; continue; }
      let dirx = tgt.x - z.x, diry = tgt.y - z.y;
      // contourne les obstacles grâce au champ de flux si pas de ligne directe
      if (best > 90 && !U.los(z.x, z.y, tgt.x, tgt.y, s._map.obs)) { const f = flowDir(s, z.x, z.y); if (f) { dirx = f.x; diry = f.y; } }
      const L = Math.hypot(dirx, diry) || 1;
      let speed = z.speed * (z.slowT > 0 ? 0.5 : 1) * (z.stun > 0 ? 0 : 1);
      // cracheur : garde ses distances et crache
      if (T.ranged) {
        if (best < 260) speed *= -0.6; else if (best < 380) speed = 0;
        z.special -= dt;
        if (z.special <= 0 && best < 520 && U.los(z.x, z.y, tgt.x, tgt.y, s._map.obs)) {
          z.special = U.rand(2, 3.2);
          const a = Math.atan2(tgt.y - z.y, tgt.x - z.x);
          s.spit.push({ id: s.nid++, x: z.x, y: z.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, life: 1.6, dmg: T.dmg * (1 + s.wave * 0.03) });
          ctx.emit({ type: 'spit', x: z.x, y: z.y });
        }
      }
      if (T.summon) { z.special -= dt; if (z.special <= 0) { z.special = 6; for (let k = 0; k < 3; k++) spawnZombie(s, 'rampant', z); ctx.emit({ type: 'summon', x: z.x, y: z.y }); } }
      if (T.boss) { // charge et onde de choc
        z.special -= dt;
        if (z.special <= 0) { z.special = U.rand(5, 8); z.charge = 1.2; ctx.emit({ type: 'roar', x: z.x, y: z.y }); }
        if (z.charge > 0) { z.charge -= dt; speed *= 3; if (z.charge <= 0) { explode(s, z.x, z.y, 170, 0, null, ctx, false); for (const p of targets) if (U.dist(p.x, p.y, z.x, z.y) < 170) hurtPlayer(s, p, 25, ctx, z); for (let k = 0; k < 2; k++) spawnZombie(s, 'rapide', z); } }
      }
      z.x += dirx / L * speed * dt; z.y += diry / L * speed * dt; z.a = Math.atan2(diry, dirx);
      for (const o of s._map.obs) U.pushOutRect(z, o);
      for (const b of s.barricades) { const c = b._c || (b._c = { x: b.x, y: b.y, r: 26 }); if (U.separate(c, z, true)) { b.hp -= T.dmg * 1.5 * dt; } }
      for (const t of s.turrets) if (U.separate({ x: t.x, y: t.y, r: 18 }, z, true)) t.hp -= T.dmg * dt;
      // attaque au contact
      z.atk -= dt;
      if (best < z.r + tgt.r + 4) {
        if (T.explode) { killZombie(s, z, null, ctx, 'self'); continue; }
        if (z.atk <= 0) { z.atk = T.boss ? 1.2 : 0.8; hurtPlayer(s, tgt, T.dmg * (1 + s.wave * 0.03), ctx, z); ctx.emit({ type: 'bite', x: tgt.x, y: tgt.y }); }
      }
    }
    for (let a = 0; a < s.zombies.length; a++) {
      const za = s.zombies[a];
      for (let b = a + 1; b < s.zombies.length; b++) { const zb = s.zombies[b]; if (Math.abs(za.x - zb.x) < 60 && Math.abs(za.y - zb.y) < 60) U.separate(za, zb); }
    }

    // ---- projectiles ----
    for (const b of s.bullets) {
      const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 14));
      const owner = s.players.find(p => p.id === b.owner);
      for (let k = 0; k < steps && b.life > 0; k++) {
        b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
        if (b.kind === 'flame') { b.vx *= 0.985; b.vy *= 0.985; }
        if (b.x < 0 || b.y < 0 || b.x > W || b.y > H || s._map.obs.some(o => b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h)) {
          if (b.kind === 'gl') explode(s, b.x, b.y, WEAPONS.lancegrenades.aoe, b.dmg, owner, ctx, false);
          else if (b.kind !== 'flame') ctx.emit({ type: 'spark', x: b.x, y: b.y });
          b.life = 0; break;
        }
        for (const z of s.zombies) {
          if (z.dead || b.hit.includes(z.id)) continue;
          if ((z.x - b.x) ** 2 + (z.y - b.y) ** 2 > (z.r + (b.kind === 'flame' ? 10 : 3)) ** 2) continue;
          b.hit.push(z.id);
          if (b.kind === 'gl') { explode(s, b.x, b.y, WEAPONS.lancegrenades.aoe, b.dmg, owner, ctx, false); b.life = 0; break; }
          if (b.kind === 'flame') { z.burn = 3; z.burnBy = b.owner; }
          damageZombie(s, z, b.dmg, owner, ctx, b.w);
          if (b.kind !== 'flame') ctx.emit({ type: 'blood', x: b.x, y: b.y, a: Math.atan2(b.vy, b.vx) });
          if (owner && perk(owner, 'explosif') && b.kind === 'b' || owner && perk(owner, 'explosif') && b.kind === 'sniper') explode(s, b.x, b.y, 45, b.dmg * 0.5, owner, ctx, false);
          if (!ZTYPES[z.type].boss && b.kind === 'sniper') z.stun = 0.15;
          if (--b.pierce <= 0) { b.life = 0; break; }
        }
      }
      b.life -= dt;
    }
    s.bullets = s.bullets.filter(b => b.life > 0);
    for (const sp of s.spit) {
      sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.life -= dt;
      if (s._map.obs.some(o => sp.x > o.x && sp.x < o.x + o.w && sp.y > o.y && sp.y < o.y + o.h)) sp.life = 0;
      for (const p of targets) if (U.dist(sp.x, sp.y, p.x, p.y) < p.r + 6) { hurtPlayer(s, p, sp.dmg, ctx, sp); sp.life = 0; ctx.emit({ type: 'acid', x: sp.x, y: sp.y }); break; }
    }
    s.spit = s.spit.filter(sp => sp.life > 0);
    for (const n of s.nades) {
      n.t -= dt; n.x += n.vx * dt; n.y += n.vy * dt;
      if (s._map.obs.some(o => n.x > o.x && n.x < o.x + o.w && n.y > o.y && n.y < o.y + o.h)) { n.x -= n.vx * dt; n.y -= n.vy * dt; n.vx *= -0.4; n.vy *= -0.4; }
      if (n.t <= -0.6) { explode(s, n.x, n.y, 160, 220, s.players.find(p => p.id === n.owner), ctx, false); n.done = true; }
      else if (n.t <= 0) { n.vx *= 0.8; n.vy *= 0.8; }
    }
    s.nades = s.nades.filter(n => !n.done);
    // tourelles
    for (const t of s.turrets) {
      t.cd -= dt;
      let tgt = null, best = 520;
      for (const z of s.zombies) { const d = U.dist(t.x, t.y, z.x, z.y); if (d < best && U.los(t.x, t.y, z.x, z.y, s._map.obs)) { best = d; tgt = z; } }
      if (tgt) {
        const want = Math.atan2(tgt.y - t.y, tgt.x - t.x); t.a += U.clamp(U.angDiff(t.a, want), -8 * dt, 8 * dt);
        if (t.cd <= 0 && Math.abs(U.angDiff(t.a, want)) < 0.2) {
          t.cd = 0.12; t.ammo--;
          s.bullets.push({ id: s.nid++, x: t.x + Math.cos(t.a) * 20, y: t.y + Math.sin(t.a) * 20, vx: Math.cos(t.a) * 1600, vy: Math.sin(t.a) * 1600, life: 0.4, dmg: 20 + s.wave, owner: t.owner, pierce: 1, hit: [], kind: 'b', w: 'turret' });
          ctx.emit({ type: 'tshot', x: t.x, y: t.y, a: t.a });
        }
      }
    }
    s.turrets = s.turrets.filter(t => t.hp > 0 && t.ammo > 0);
    s.barricades = s.barricades.filter(b => { if (b.hp <= 0) ctx.emit({ type: 'boom', x: b.x, y: b.y, r: 40 }); return b.hp > 0; });
    s.zombies = s.zombies.filter(z => !z.dead);

    // ---- défaite ----
    if (s.players.length && s.players.every(p => !p.alive || p.down) && s.wave > 0) {
      if (s.players.every(p => !p.alive)) { s.over = true; s.win = false; ctx.emit({ type: 'end', win: false }); }
    }
  },

  view(s, id) {
    const me = s.players.find(p => p.id === id);
    const cyc = s.light === 'day' ? 0 : s.light === 'night' ? 1 : (Math.sin(s.time / 240 * Math.PI * 2 - Math.PI / 2) + 1) / 2;
    return {
      t: s.time, phase: s.phase, wave: s.wave, timer: s.timer, left: s.queue.length + s.zombies.length, waveTotal: s.waveTotal, over: s.over, win: s.win,
      night: cyc, goal: s.goal, totalKills: s.totalKills, difficulty: s.difficulty,
      players: s.players.map(p => ({ id: p.id, name: p.name, color: p.color, x: U.r1(p.x), y: U.r1(p.y), a: U.r2(p.a), hp: Math.ceil(p.hp), maxHp: p.maxHp, armor: Math.round(p.armor), alive: p.alive, down: p.down, revive: U.r1(p.revive), downT: Math.ceil(p.downT), kills: p.kills, deaths: p.deaths, money: p.money, weapon: p.weapon, rage: p.rage > 0, ready: !!p.ready })),
      zombies: s.zombies.map(z => [z.id, Math.round(z.x), Math.round(z.y), z.type, Math.round(z.hp / z.maxHp * 100), U.r2(z.a), z.burn > 0 ? 1 : 0, z.charge > 0 ? 1 : 0]),
      bullets: s.bullets.map(b => [b.id, Math.round(b.x), Math.round(b.y), b.kind, U.r2(Math.atan2(b.vy, b.vx))]),
      spit: s.spit.map(p => [p.id, Math.round(p.x), Math.round(p.y)]),
      nades: s.nades.map(n => [n.id, Math.round(n.x), Math.round(n.y), U.r2(n.t)]),
      turrets: s.turrets.map(t => ({ id: t.id, x: t.x, y: t.y, a: U.r2(t.a), hp: t.hp, ammo: t.ammo, color: t.color })),
      barricades: s.barricades.map(b => ({ id: b.id, x: b.x, y: b.y, a: b.a, k: b.hp / b.max })),
      drops: s.drops.map(d => ({ id: d.id, kind: d.kind, x: Math.round(d.x), y: Math.round(d.y), t: d.t })),
      boss: (() => { const b = s.zombies.find(z => ZTYPES[z.type].boss); return b ? { hp: b.hp, max: b.maxHp } : null; })(),
      me: me && { owned: me.owned, ammo: Object.fromEntries(Object.entries(me.ammo).map(([k, v]) => [k, { mag: v.mag, res: v.res === Infinity ? -1 : v.res }])), reloadT: U.r2(Math.max(0, me.reloadT)), reloadMax: WEAPONS[me.weapon].reload * Math.pow(0.8, perk(me, 'recharge')), perks: me.perks, grenades: me.grenades, turrets: me.turrets, barricades: me.barricades },
    };
  },
  staticData(s) { return { W, H, map: s._map, weapons: Object.fromEntries(Object.entries(WEAPONS).map(([k, w]) => [k, { ...w, reserve: w.reserve === Infinity ? -1 : w.reserve }])), order: WEAPON_ORDER, shop: SHOP }; },
};
