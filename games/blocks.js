// =====================================================================
//  BLOCK WORLD — règles (serveur)
//  Monde de cubes partagé : génération procédurale (collines, eau,
//  arbres, minerais), minage, construction, inventaire, fabrication,
//  modes Survie et Créatif, cycle jour/nuit.
// =====================================================================
const U = require('./lib/util');
const TICK = 10;
// Types de blocs (0 = air). hard = secondes pour casser à la main
const BLOCKS = [
  null,
  { id: 1, name: 'Herbe', hard: 0.6, drop: 3 },
  { id: 2, name: 'Pierre', hard: 1.4, drop: 9 },
  { id: 3, name: 'Terre', hard: 0.5 },
  { id: 4, name: 'Sable', hard: 0.5 },
  { id: 5, name: 'Bois', hard: 1.0 },
  { id: 6, name: 'Feuilles', hard: 0.2 },
  { id: 7, name: 'Eau', hard: 0, fluid: true },
  { id: 8, name: 'Planches', hard: 0.8 },
  { id: 9, name: 'Pavé', hard: 1.4 },
  { id: 10, name: 'Charbon', hard: 1.6, item: 'charbon' },
  { id: 11, name: 'Fer', hard: 2.0 },
  { id: 12, name: 'Or', hard: 2.2 },
  { id: 13, name: 'Diamant', hard: 3.0 },
  { id: 14, name: 'Socle', hard: Infinity },
  { id: 15, name: 'Verre', hard: 0.3, craft: true },
  { id: 16, name: 'Briques', hard: 1.6, craft: true },
  { id: 17, name: 'Torche', hard: 0.05, craft: true, light: true },
  { id: 18, name: 'Neige', hard: 0.3 },
  { id: 19, name: 'Laine rouge', hard: 0.4, craft: true },
  { id: 20, name: 'Laine bleue', hard: 0.4, craft: true },
  { id: 21, name: 'Laine jaune', hard: 0.4, craft: true },
  { id: 22, name: 'Bibliothèque', hard: 0.8, craft: true },
  { id: 23, name: 'Bloc d’or', hard: 2.0, craft: true },
  { id: 24, name: 'Bloc de diamant', hard: 3.0, craft: true },
];
// Recettes : ce qu'il faut -> ce qu'on obtient
const RECIPES = [
  { out: [8, 4], need: [[5, 1]] },
  { out: [17, 4], need: [[8, 1], [10, 1]] },
  { out: [15, 2], need: [[4, 2], [10, 1]] },
  { out: [16, 2], need: [[3, 2], [9, 2]] },
  { out: [9, 1], need: [[2, 1]] },
  { out: [19, 2], need: [[6, 4], [12, 1]] },
  { out: [20, 2], need: [[6, 4], [11, 1]] },
  { out: [21, 2], need: [[6, 4], [4, 2]] },
  { out: [22, 1], need: [[8, 3], [6, 3]] },
  { out: [23, 1], need: [[12, 4]] },
  { out: [24, 1], need: [[13, 4]] },
];
const SIZES = { petit: 64, moyen: 96, grand: 128 }, HEIGHT = 40;

// ---------- Bruit pour le relief ----------
function makeNoise(seed) {
  const perm = new Uint8Array(512); const p = [...Array(256).keys()];
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h, x, y) => ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y), a = perm[X] + Y, b = perm[X + 1] + Y;
    return U.lerp(U.lerp(grad(perm[a], x, y), grad(perm[b], x - 1, y), u), U.lerp(grad(perm[a + 1], x, y - 1), grad(perm[b + 1], x - 1, y - 1), u), v);
  };
}
function generate(N, terrain, seed) {
  const W = new Uint8Array(N * N * HEIGHT), noise = makeNoise(seed), noise2 = makeNoise(seed + 7);
  const idx = (x, y, z) => (y * N + z) * N + x;
  const WATER = 12;
  const heights = [];
  for (let x = 0; x < N; x++) for (let z = 0; z < N; z++) {
    let h;
    const n = noise(x / 40, z / 40) * 0.6 + noise(x / 16, z / 16) * 0.3 + noise(x / 7, z / 7) * 0.1;
    if (terrain === 'plat') h = 14;
    else if (terrain === 'montagnes') h = 16 + n * 22 + Math.max(0, noise2(x / 30, z / 30)) * 14;
    else if (terrain === 'iles') { const d = Math.hypot(x - N / 2, z - N / 2) / (N / 2); h = 8 + n * 14 + (1 - d) * 10 + Math.max(0, noise2(x / 18, z / 18)) * 8 - (d > 0.8 ? 10 : 0); }
    else h = 15 + n * 12;
    h = U.clamp(Math.round(h), 3, HEIGHT - 8);
    heights[x * N + z] = h;
    for (let y = 0; y <= h; y++) {
      let b = 2;
      if (y === 0) b = 14;
      else if (y === h) b = h <= WATER + 1 ? 4 : h > 30 ? 18 : 1;
      else if (y > h - 3) b = h <= WATER + 1 ? 4 : 3;
      else { const r = Math.random(); if (r < 0.012) b = 10; else if (r < 0.018 && y < 20) b = 11; else if (r < 0.021 && y < 12) b = 12; else if (r < 0.0225 && y < 8) b = 13; }
      W[idx(x, y, z)] = b;
    }
    for (let y = h + 1; y <= WATER; y++) W[idx(x, y, z)] = 7;
  }
  // grottes
  for (let k = 0; k < N * N / 600; k++) {
    let x = U.rand(4, N - 4), y = U.rand(4, 14), z = U.rand(4, N - 4), a = U.rand(0, 6), b = U.rand(-0.3, 0.3);
    for (let s = 0; s < 40; s++) { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) { const X = Math.round(x + dx), Y = Math.round(y + dy), Z = Math.round(z + dz); if (X > 0 && Z > 0 && X < N - 1 && Z < N - 1 && Y > 1 && Y < heights[X * N + Z] - 2) W[idx(X, Y, Z)] = 0; } x += Math.cos(a); z += Math.sin(a); y += b; a += U.rand(-0.4, 0.4); }
  }
  // arbres
  for (let k = 0; k < N * N / 90; k++) {
    const x = U.randInt(3, N - 4), z = U.randInt(3, N - 4), h = heights[x * N + z];
    if (W[idx(x, h, z)] !== 1 || h + 7 >= HEIGHT) continue;
    const th = U.randInt(4, 6);
    for (let y = 1; y <= th; y++) W[idx(x, h + y, z)] = 5;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = th - 2; dy <= th + 1; dy++) {
      if (Math.abs(dx) + Math.abs(dz) + Math.max(0, dy - th) * 2 > 3) continue;
      const X = x + dx, Y = h + dy, Z = z + dz; if (W[idx(X, Y, Z)] === 0) W[idx(X, Y, Z)] = 6;
    }
  }
  return { W, heights };
}

function solidAt(s, x, y, z) { if (x < 0 || z < 0 || x >= s.N || z >= s.N || y < 0) return true; if (y >= HEIGHT) return false; const b = s.W[(y * s.N + z) * s.N + x]; return b !== 0 && b !== 7; }
function spawnPos(s) { const c = Math.floor(s.N / 2); for (let r = 0; r < s.N / 2; r += 2) for (let k = 0; k < 8; k++) { const x = U.clamp(c + Math.round(Math.cos(k) * r), 1, s.N - 2), z = U.clamp(c + Math.round(Math.sin(k) * r), 1, s.N - 2); let y = HEIGHT - 2; while (y > 0 && !solidAt(s, x, y, z)) y--; if (s.W[(y * s.N + z) * s.N + x] !== 7 && s.W[((y + 1) * s.N + z) * s.N + x] !== 7) return { x: x + 0.5, y: y + 1, z: z + 0.5 }; } return { x: c, y: HEIGHT - 2, z: c }; }
const inv = () => ({});
function add(p, b, n) { p.inv[b] = (p.inv[b] || 0) + n; }

module.exports = {
  id: 'blocks',
  name: 'Block World',
  description: 'Un monde de cubes à explorer ensemble : minez, récoltez, fabriquez et construisez ce que vous voulez.',
  category: 'Monde ouvert', icon: '🧱', color: '#16a34a', order: 9, joinInProgress: true,
  tags: ['⛏️ Construction', '🌍 3D'],
  rules: `<ul><li><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> marcher · <kbd>Espace</kbd> sauter · <kbd>Maj</kbd> courir · souris : regarder</li>
    <li><b>Clic gauche</b> (maintenu) : casser un bloc · <b>Clic droit</b> : poser · <kbd>1</kbd>–<kbd>9</kbd> / molette : choisir le bloc</li>
    <li><kbd>E</kbd> : inventaire et fabrication (planches, torches, verre, briques, laine…) · <kbd>T</kbd> : discuter</li>
    <li>Mode Créatif : blocs illimités et vol (double <kbd>Espace</kbd>).</li></ul>`,
  settings: [
    { key: 'mode', label: 'Mode de jeu', type: 'select', default: 'survie', options: [{ v: 'survie', l: 'Survie' }, { v: 'creatif', l: 'Créatif' }] },
    { key: 'size', label: 'Taille du monde', type: 'select', default: 'moyen', options: [{ v: 'petit', l: 'Petit' }, { v: 'moyen', l: 'Moyen' }, { v: 'grand', l: 'Grand' }] },
    { key: 'terrain', label: 'Relief', type: 'select', default: 'collines', options: [{ v: 'collines', l: 'Collines' }, { v: 'montagnes', l: 'Montagnes' }, { v: 'iles', l: 'Île' }, { v: 'plat', l: 'Plat' }] },
    { key: 'day', label: 'Durée d’une journée', type: 'select', default: 10, options: [{ v: 0, l: 'Toujours jour' }, { v: 5, l: '5 min' }, { v: 10, l: '10 min' }, { v: 20, l: '20 min' }] },
  ],
  minPlayers: 1, maxPlayers: 12, tickRate: TICK,

  create(players, ctx, o) {
    const N = SIZES[o.size] || 96, seed = Math.floor(Math.random() * 1e9);
    const { W } = generate(N, o.terrain || 'collines', seed);
    const s = { N, W, mode: o.mode || 'survie', dayLen: (o.day ?? 10) * 60, time: (o.day ?? 10) * 60 * 0.08, players: [], edits: 0 };
    for (const p of players) module.exports.onJoin(s, p, ctx);
    return s;
  },
  onJoin(s, p) {
    const sp = spawnPos(s);
    // décale un peu chaque joueur pour ne pas apparaître les uns dans les autres
    for (let k = 0; k < 12; k++) { const x = Math.floor(sp.x + U.randInt(-3, 3)), z = Math.floor(sp.z + U.randInt(-3, 3)); if (x < 1 || z < 1 || x >= s.N - 1 || z >= s.N - 1) continue; let y = HEIGHT - 2; while (y > 0 && !solidAt(s, x, y, z)) y--; if (s.W[(y * s.N + z) * s.N + x] === 7 || s.W[((y + 1) * s.N + z) * s.N + x] === 7) continue; sp.x = x + 0.5; sp.y = y + 1; sp.z = z + 0.5; break; }
    s.players.push({ id: p.id, name: p.name, color: p.color, x: sp.x, y: sp.y, z: sp.z, yaw: 0, pitch: 0, hp: 20, inv: inv(), lastMove: Date.now(), corrN: 0, spawnN: 1, held: 1, fallY: sp.y, fly: false });
  },
  onLeave(s, id) { s.players = s.players.filter(p => p.id !== id); },

  onAction(s, id, a, ctx) {
    const p = s.players.find(q => q.id === id); if (!p) return;
    const now = Date.now();
    switch (a.type) {
      case 'move': {
        const x = +a.x, y = +a.y, z = +a.z; if (![x, y, z].every(Number.isFinite)) return;
        const dt = Math.max(0.05, (now - p.lastMove) / 1000); p.lastMove = now;
        if (Math.hypot(x - p.x, z - p.z) > 16 * dt + 2 || Math.abs(y - p.y) > 40 * dt + 2 || x < 0 || z < 0 || x > s.N || z > s.N) { p.corrN++; return; }
        // dégâts de chute (survie)
        if (s.mode === 'survie' && !a.fly) { if (a.ground) { const fall = p.fallY - y; if (fall > 4) { p.hp -= Math.floor(fall - 3); ctx.emit({ type: 'ouch', n: Math.floor(fall - 3) }, id); if (p.hp <= 0) { const sp = spawnPos(s); Object.assign(p, { x: sp.x, y: sp.y, z: sp.z, hp: 20, fallY: sp.y }); p.spawnN++; ctx.emit({ type: 'died', name: p.name }); return; } } p.fallY = y; } else p.fallY = Math.max(p.fallY, y); }
        else p.fallY = y;
        Object.assign(p, { x, y, z, yaw: +a.yaw || 0, pitch: +a.pitch || 0, fly: !!a.fly, held: a.held | 0 });
        return;
      }
      case 'break': {
        const { x, y, z } = a; if (![x, y, z].every(Number.isInteger) || x < 0 || z < 0 || y < 0 || x >= s.N || z >= s.N || y >= HEIGHT) return;
        if (Math.hypot(x + 0.5 - p.x, y + 0.5 - (p.y + 1.6), z + 0.5 - p.z) > 7) return;
        const i = (y * s.N + z) * s.N + x, b = s.W[i];
        if (!b || b === 7 || b === 14) return;
        s.W[i] = 0; s.edits++;
        // l'eau voisine coule dans le trou
        const nb = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]].some(([dx, dy, dz]) => { const X = x + dx, Y = y + dy, Z = z + dz; return X >= 0 && Z >= 0 && X < s.N && Z < s.N && Y < HEIGHT && s.W[(Y * s.N + Z) * s.N + X] === 7; });
        if (nb) s.W[i] = 7;
        if (s.mode === 'survie') { const drop = BLOCKS[b].drop || b; if (b !== 6 || Math.random() < 0.3) add(p, drop, 1); }
        ctx.emit({ type: 'set', x, y, z, b: s.W[i], old: b });
        return;
      }
      case 'place': {
        const { x, y, z } = a, b = a.b | 0; if (![x, y, z].every(Number.isInteger) || !BLOCKS[b] || b === 14) return;
        if (x < 0 || z < 0 || y < 1 || x >= s.N || z >= s.N || y >= HEIGHT) return;
        if (Math.hypot(x + 0.5 - p.x, y + 0.5 - (p.y + 1.6), z + 0.5 - p.z) > 7) return;
        const i = (y * s.N + z) * s.N + x; if (s.W[i] && s.W[i] !== 7) return;
        // pas dans un joueur
        if (b !== 17 && s.players.some(q => x + 1 > q.x - 0.3 && x < q.x + 0.3 && z + 1 > q.z - 0.3 && z < q.z + 0.3 && y + 1 > q.y && y < q.y + 1.8)) return;
        if (s.mode === 'survie') { if (!p.inv[b]) return { error: 'Vous n’avez pas ce bloc' }; if (--p.inv[b] <= 0) delete p.inv[b]; }
        s.W[i] = b; s.edits++;
        ctx.emit({ type: 'set', x, y, z, b, old: 0 });
        return;
      }
      case 'craft': {
        const r = RECIPES[a.r | 0]; if (!r) return;
        if (s.mode === 'creatif') return;
        if (!r.need.every(([b, n]) => (p.inv[b] || 0) >= n)) return { error: 'Il vous manque des matériaux' };
        for (const [b, n] of r.need) { p.inv[b] -= n; if (p.inv[b] <= 0) delete p.inv[b]; }
        add(p, r.out[0], r.out[1]); ctx.emit({ type: 'crafted', b: r.out[0] }, id); return;
      }
    }
  },
  tick(s, dt) { s.time += dt; for (const p of s.players) if (s.mode === 'survie' && p.hp < 20 && Math.random() < dt * 0.2) p.hp++; },

  view(s, id) {
    const me = s.players.find(p => p.id === id);
    return {
      mode: s.mode, day: s.dayLen ? (s.time % s.dayLen) / s.dayLen : 0.3, edits: s.edits,
      players: s.players.map(p => ({ id: p.id, name: p.name, color: p.color, x: U.r2(p.x), y: U.r2(p.y), z: U.r2(p.z), yaw: U.r2(p.yaw), pitch: U.r2(p.pitch), held: p.held, fly: p.fly })),
      me: me && { inv: me.inv, hp: me.hp, corrN: me.corrN, spawnN: me.spawnN, x: me.x, y: me.y, z: me.z },
    };
  },
  // le monde complet n'est envoyé qu'à l'arrivée (compressé en base64)
  staticData(s) { return { N: s.N, H: HEIGHT, world: Buffer.from(s.W).toString('base64'), blocks: BLOCKS.map(b => b && { id: b.id, name: b.name, hard: b.hard === Infinity ? -1 : b.hard, fluid: !!b.fluid, light: !!b.light }), recipes: RECIPES, mode: s.mode }; },
};
