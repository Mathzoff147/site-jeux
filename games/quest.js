// =====================================================================
//  FANTASY QUEST — règles (serveur)
//  Mini-MMORPG en coopération : 4 classes, compétences, niveaux,
//  monstres par zones, donjon, dragon, quêtes, boutique, butin.
// =====================================================================
const U = require('./lib/util');
const W = 4200, H = 3000, TICK = 20;

const CLASSES = {
  guerrier: { name: 'Guerrier', icon: '🛡️', hp: 160, mp: 40, atk: 18, def: 8, speed: 200, range: 70, rate: 0.55, kind: 'melee',
    q: { name: 'Tourbillon', mp: 15, cd: 6, desc: 'Frappe tous les ennemis autour' }, e: { name: 'Charge', mp: 10, cd: 5, desc: 'Fonce et étourdit' } },
  mage: { name: 'Mage', icon: '🔮', hp: 95, mp: 140, atk: 24, def: 3, speed: 195, range: 520, rate: 0.6, kind: 'fireball',
    q: { name: 'Nova de givre', mp: 35, cd: 8, desc: 'Gèle les ennemis proches' }, e: { name: 'Téléportation', mp: 20, cd: 6, desc: 'Se téléporte vers la souris' } },
  archer: { name: 'Archère', icon: '🏹', hp: 115, mp: 70, atk: 16, def: 5, speed: 225, range: 620, rate: 0.42, kind: 'arrow',
    q: { name: 'Pluie de flèches', mp: 30, cd: 7, desc: 'Une volée de flèches en éventail' }, e: { name: 'Roulade', mp: 10, cd: 3, desc: 'Esquive rapide' } },
  clerc: { name: 'Clerc', icon: '✨', hp: 120, mp: 120, atk: 14, def: 6, speed: 205, range: 460, rate: 0.6, kind: 'holy',
    q: { name: 'Soin de groupe', mp: 40, cd: 8, desc: 'Soigne les alliés proches' }, e: { name: 'Bouclier sacré', mp: 25, cd: 12, desc: 'Réduit les dégâts reçus de 60 % (5 s)' } },
};
const MONSTERS = {
  slime:    { name: 'Gluant', hp: 40, atk: 6, def: 0, speed: 90, r: 16, xp: 8, gold: [1, 4], aggro: 220, lvl: 1 },
  loup:     { name: 'Loup', hp: 70, atk: 10, def: 2, speed: 170, r: 17, xp: 16, gold: [2, 6], aggro: 300, lvl: 2 },
  gobelin:  { name: 'Gobelin', hp: 110, atk: 14, def: 4, speed: 150, r: 16, xp: 28, gold: [5, 12], aggro: 320, lvl: 4 },
  archerG:  { name: 'Gobelin archer', hp: 80, atk: 12, def: 2, speed: 130, r: 15, xp: 30, gold: [5, 12], aggro: 420, lvl: 4, ranged: 380 },
  squelette:{ name: 'Squelette', hp: 180, atk: 20, def: 8, speed: 140, r: 17, xp: 50, gold: [8, 20], aggro: 340, lvl: 6 },
  orc:      { name: 'Orc', hp: 320, atk: 28, def: 12, speed: 125, r: 22, xp: 80, gold: [15, 30], aggro: 340, lvl: 8 },
  sorcier:  { name: 'Liche', hp: 220, atk: 26, def: 6, speed: 110, r: 18, xp: 90, gold: [20, 40], aggro: 460, lvl: 9, ranged: 400 },
  dragon:   { name: 'Dragon Ancien', hp: 6000, atk: 45, def: 18, speed: 110, r: 64, xp: 1500, gold: [400, 600], aggro: 600, lvl: 12, boss: true },
};
// Zones : rectangle, monstres, nombre
const ZONES = [
  { name: 'Village de Clairval', x: 200, y: 1100, w: 900, h: 800, safe: true, color: 'village' },
  { name: 'Bois des Lucioles', x: 1100, y: 900, w: 1000, h: 1200, mobs: [['slime', 8], ['loup', 6]], color: 'forest' },
  { name: 'Plaines Dorées', x: 1100, y: 100, w: 1700, h: 800, mobs: [['loup', 4], ['gobelin', 8], ['archerG', 5]], color: 'plains' },
  { name: 'Marais Brumeux', x: 1100, y: 2100, w: 1700, h: 800, mobs: [['slime', 6], ['gobelin', 4], ['squelette', 6]], color: 'swamp' },
  { name: 'Crypte Oubliée', x: 2900, y: 1700, w: 1200, h: 1200, mobs: [['squelette', 8], ['orc', 5], ['sorcier', 4]], color: 'dungeon' },
  { name: 'Antre du Dragon', x: 2900, y: 100, w: 1200, h: 1500, mobs: [['orc', 4], ['sorcier', 3], ['dragon', 1]], color: 'lava' },
];
const QUESTS = [
  { id: 'q1', text: 'Éliminer 6 Gluants', target: 'slime', n: 6, xp: 60, gold: 30 },
  { id: 'q2', text: 'Chasser 6 Loups', target: 'loup', n: 6, xp: 120, gold: 50 },
  { id: 'q3', text: 'Repousser 8 Gobelins', target: ['gobelin', 'archerG'], n: 8, xp: 260, gold: 90 },
  { id: 'q4', text: 'Détruire 8 Squelettes', target: 'squelette', n: 8, xp: 450, gold: 150 },
  { id: 'q5', text: 'Vaincre 5 Orcs', target: 'orc', n: 5, xp: 650, gold: 220 },
  { id: 'q6', text: 'Terrasser le Dragon Ancien', target: 'dragon', n: 1, xp: 2000, gold: 1000 },
];
const SHOP = {
  potion:  { name: 'Potion de vie', icon: '🧪', price: 15, desc: '+60 % PV (touche 1)' },
  ether:   { name: 'Potion de mana', icon: '💧', price: 15, desc: '+60 % PM (touche 2)' },
  arme:    { name: 'Améliorer l’arme', icon: '⚔️', base: 60, desc: '+5 attaque', max: 8 },
  armure:  { name: 'Améliorer l’armure', icon: '🛡️', base: 60, desc: '+4 défense, +15 PV', max: 8 },
};
const xpFor = lvl => Math.round(60 * Math.pow(lvl, 1.6));

function makeWorld() {
  const obs = [], deco = [];
  // arbres de la forêt (obstacles), rochers, ruines
  const add = (o) => { if (!obs.some(p => U.dist(p.x + p.w / 2, p.y + p.h / 2, o.x + o.w / 2, o.y + o.h / 2) < 90)) obs.push(o); };
  for (let k = 0; k < 140; k++) add({ x: U.rand(1150, 2050), y: U.rand(950, 2050), w: 46, h: 46, kind: 'tree' });
  for (let k = 0; k < 30; k++) add({ x: U.rand(1150, 2750), y: U.rand(150, 850), w: 50, h: 40, kind: 'rock' });
  for (let k = 0; k < 40; k++) add({ x: U.rand(1150, 2750), y: U.rand(2150, 2850), w: 44, h: 44, kind: 'deadtree' });
  for (let k = 0; k < 26; k++) add({ x: U.rand(2950, 4050), y: U.rand(1750, 2850), w: U.rand(50, 110), h: U.rand(40, 90), kind: 'ruin' });
  for (let k = 0; k < 20; k++) add({ x: U.rand(2950, 4050), y: U.rand(150, 1500), w: 60, h: 50, kind: 'lavarock' });
  // maisons du village
  for (const [x, y] of [[300, 1200], [600, 1200], [300, 1650], [800, 1650], [850, 1250]]) obs.push({ x, y, w: 150, h: 120, kind: 'house' });
  // murs entre zones (passages laissés)
  obs.push({ x: 2850, y: 0, w: 50, h: 700 }, { x: 2850, y: 900, w: 50, h: 1050 }, { x: 2850, y: 2150, w: 50, h: 850 });
  obs.forEach(o => { if (!o.kind) o.kind = 'wall'; });
  // décor non bloquant
  for (let k = 0; k < 400; k++) { const z = U.pick(ZONES); deco.push({ x: U.rand(z.x, z.x + z.w), y: U.rand(z.y, z.y + z.h), kind: z.color, r: U.rand(4, 14) }); }
  const npcs = [
    { id: 'shop', name: 'Marchande Rose', x: 520, y: 1480, icon: '🧙‍♀️', role: 'shop' },
    { id: 'quest', name: 'Capitaine Aldric', x: 760, y: 1480, icon: '💂', role: 'quest' },
    { id: 'well', name: 'Fontaine de vie', x: 640, y: 1560, icon: '⛲', role: 'heal' },
  ];
  return { obs: obs.filter(o => !npcs.some(n => U.circleRect({ x: n.x, y: n.y, r: 50 }, o))), deco, npcs };
}

function spawnMob(s, type, zone) {
  const M = MONSTERS[type];
  let x, y;
  for (let k = 0; k < 30; k++) { x = U.rand(zone.x + 60, zone.x + zone.w - 60); y = U.rand(zone.y + 60, zone.y + zone.h - 60); if (!s.world.obs.some(o => U.circleRect({ x, y, r: M.r + 6 }, o))) break; }
  if (M.boss) { x = 3500; y = 500; }
  const hp = Math.round(M.hp * s.diff * (M.boss ? (0.6 + 0.4 * Math.max(1, s.players.length)) * s.bossMul : 1));
  s.mobs.push({ id: s.nid++, type, x, y, hx: x, hy: y, r: M.r, hp, maxHp: hp, a: 0, target: null, atkT: 0, stun: 0, frozen: 0, zone: zone.name, sp1: 4, sp2: 9, phase: 0 });
}

function newHero(p, cls, s) {
  const C = CLASSES[cls];
  const h = { id: p.id, name: p.name, color: p.color, cls, x: 640 + U.rand(-60, 60), y: 1620 + U.rand(-30, 30), r: 16, a: 0, lvl: 1, xp: 0, gold: 20, potions: 3, ethers: 2,
    weapon: 0, armor: 0, hp: 0, mp: 0, input: {}, atkT: 0, cdQ: 0, cdE: 0, shield: 0, dead: 0, quest: 0, qprog: 0, kills: 0, dash: 0, deaths: 0 };
  for (let l = 1; l < s.startLvl; l++) levelUp(h, null, true);
  recalc(h); h.hp = h.maxHp; h.mp = h.maxMp;
  return h;
}
function recalc(h) {
  const C = CLASSES[h.cls], L = h.lvl - 1;
  h.maxHp = Math.round(C.hp * (1 + L * 0.14) + h.armor * 15); h.maxMp = Math.round(C.mp * (1 + L * 0.08));
  h.atk = Math.round(C.atk * (1 + L * 0.12) + h.weapon * 5); h.def = Math.round(C.def + L * 1.2 + h.armor * 4);
}
function levelUp(h, ctx, silent) { h.lvl++; recalc(h); h.hp = h.maxHp; h.mp = h.maxMp; if (!silent && ctx) ctx.emit({ type: 'level', id: h.id, lvl: h.lvl, x: h.x, y: h.y }); }
function giveXp(s, h, xp, ctx) { h.xp += Math.round(xp * s.xpMul); while (h.xp >= xpFor(h.lvl)) { h.xp -= xpFor(h.lvl); levelUp(h, ctx); } }

function damageMob(s, m, dmg, h, ctx, extra = {}) {
  if (m.hp <= 0) return;
  const M = MONSTERS[m.type];
  const crit = Math.random() < 0.1;
  const d = Math.max(1, Math.round((dmg * (crit ? 1.8 : 1)) * U.rand(0.9, 1.1) - M.def * 0.5));
  m.hp -= d; m.target = m.target || h?.id;
  if (extra.stun) m.stun = Math.max(m.stun, extra.stun);
  if (extra.freeze) m.frozen = Math.max(m.frozen, extra.freeze);
  ctx.emit({ type: 'dmg', x: Math.round(m.x), y: Math.round(m.y - m.r), n: d, crit });
  if (m.hp <= 0) {
    const gold = U.randInt(...M.gold);
    // xp partagée avec le groupe proche
    const near = s.players.filter(p => !p.dead && U.dist(p.x, p.y, m.x, m.y) < 700);
    for (const p of near.length ? near : (h ? [h] : [])) {
      giveXp(s, p, M.xp / Math.sqrt(Math.max(1, near.length)), ctx);
      const q = QUESTS[p.quest];
      if (q && (Array.isArray(q.target) ? q.target.includes(m.type) : q.target === m.type)) { p.qprog++; if (p.qprog >= q.n) { giveXp(s, p, q.xp, ctx); p.gold += q.gold; ctx.emit({ type: 'questDone', id: p.id, text: q.text, xp: q.xp, gold: q.gold }, p.id); p.quest++; p.qprog = 0; } }
    }
    if (h) { h.gold += gold; h.kills++; }
    if (Math.random() < 0.12 || M.boss) s.drops.push({ id: s.nid++, x: m.x + U.rand(-20, 20), y: m.y + U.rand(-20, 20), kind: Math.random() < 0.6 ? 'potion' : 'ether', t: 40 });
    ctx.emit({ type: 'mobDie', x: Math.round(m.x), y: Math.round(m.y), t: m.type, gold, by: h?.id });
    if (M.boss) { s.bossKills++; ctx.emit({ type: 'boss', name: M.name }); }
    m.respawn = M.boss ? 180 : U.rand(15, 30);
  }
}
function damageHero(s, h, dmg, ctx, from) {
  if (h.dead || h.safe) return;
  const d = Math.max(1, Math.round((dmg * s.diff * U.rand(0.9, 1.1) - h.def * 0.6) * (h.shield > 0 ? 0.4 : 1)));
  h.hp -= d;
  ctx.emit({ type: 'hurt', id: h.id, n: d, x: Math.round(h.x), y: Math.round(h.y - 20) });
  if (h.hp <= 0) { h.hp = 0; h.dead = 6; h.deaths++; const lost = Math.floor(h.gold * 0.1); h.gold -= lost; ctx.emit({ type: 'heroDie', id: h.id, name: h.name, x: h.x, y: h.y, lost }); }
}

function attack(s, h, ctx) {
  const C = CLASSES[h.cls];
  if (h.atkT > 0) return;
  h.atkT = C.rate;
  if (C.kind === 'melee') {
    for (const m of s.mobs) { if (m.hp <= 0) continue; const d = U.dist(h.x, h.y, m.x, m.y); if (d < C.range + m.r && Math.abs(U.angDiff(h.a, Math.atan2(m.y - h.y, m.x - h.x))) < 1.1) damageMob(s, m, h.atk, h, ctx); }
    if (s.pvp) for (const o of s.players) if (o !== h && !o.dead && U.dist(h.x, h.y, o.x, o.y) < C.range + 16) damageHero(s, o, h.atk * 0.5, ctx);
    ctx.emit({ type: 'swing', id: h.id, x: h.x, y: h.y, a: h.a });
  } else {
    const sp = C.kind === 'arrow' ? 900 : C.kind === 'holy' ? 650 : 560;
    s.shots.push({ id: s.nid++, x: h.x + Math.cos(h.a) * 20, y: h.y + Math.sin(h.a) * 20, vx: Math.cos(h.a) * sp, vy: Math.sin(h.a) * sp, life: C.range / sp, dmg: h.atk, owner: h.id, kind: C.kind, aoe: C.kind === 'fireball' ? 55 : 0 });
    ctx.emit({ type: 'cast', id: h.id, k: C.kind });
  }
}
function ability(s, h, which, ctx, tx, ty) {
  const C = CLASSES[h.cls], ab = C[which], cdKey = which === 'q' ? 'cdQ' : 'cdE';
  if (h[cdKey] > 0 || h.mp < ab.mp || h.dead) return;
  h.mp -= ab.mp; h[cdKey] = ab.cd;
  const near = r => s.mobs.filter(m => m.hp > 0 && U.dist(h.x, h.y, m.x, m.y) < r + m.r);
  const key = `${h.cls}_${which}`;
  if (key === 'guerrier_q') near(130).forEach(m => damageMob(s, m, h.atk * 1.8, h, ctx));
  if (key === 'guerrier_e') { h.dash = 0.25; h.dashA = h.a; h.dashSp = 900; h.chargeHit = true; }
  if (key === 'mage_q') near(200).forEach(m => damageMob(s, m, h.atk * 1.2, h, ctx, { freeze: 3 }));
  if (key === 'mage_e') { const d = Math.min(320, U.dist(h.x, h.y, tx, ty)), a = Math.atan2(ty - h.y, tx - h.x); const nx = h.x + Math.cos(a) * d, ny = h.y + Math.sin(a) * d; if (!s.world.obs.some(o => U.circleRect({ x: nx, y: ny, r: 16 }, o))) { ctx.emit({ type: 'blink', x: h.x, y: h.y }); h.x = nx; h.y = ny; } }
  if (key === 'archer_q') for (let k = -4; k <= 4; k++) { const a = h.a + k * 0.09; s.shots.push({ id: s.nid++, x: h.x, y: h.y, vx: Math.cos(a) * 950, vy: Math.sin(a) * 950, life: 0.7, dmg: h.atk * 1.1, owner: h.id, kind: 'arrow', pierce: 2 }); }
  if (key === 'archer_e') { h.dash = 0.2; h.dashA = Math.atan2((h.input.d ? 1 : 0) - (h.input.u ? 1 : 0), (h.input.r ? 1 : 0) - (h.input.l ? 1 : 0)) || h.a; if (!h.input.u && !h.input.d && !h.input.l && !h.input.r) h.dashA = h.a + Math.PI; h.dashSp = 800; }
  if (key === 'clerc_q') for (const p of s.players) if (!p.dead && U.dist(h.x, h.y, p.x, p.y) < 260) { const heal = Math.round(p.maxHp * 0.35 + h.atk); p.hp = Math.min(p.maxHp, p.hp + heal); ctx.emit({ type: 'heal', x: Math.round(p.x), y: Math.round(p.y - 20), n: heal }); }
  if (key === 'clerc_e') for (const p of s.players) if (!p.dead && U.dist(h.x, h.y, p.x, p.y) < 260) p.shield = 5;
  ctx.emit({ type: 'ability', id: h.id, key, x: Math.round(h.x), y: Math.round(h.y), a: h.a });
}

module.exports = {
  id: 'quest',
  name: 'Fantasy Quest',
  description: 'Mini-MMORPG fantastique : choisissez une classe, explorez, montez de niveau et terrassez le dragon ensemble.',
  category: 'Monde ouvert', icon: '🐉', color: '#b45309', order: 10, joinInProgress: true,
  tags: ['⚔️ RPG', '🤝 Coopération'],
  rules: `<ul><li><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> se déplacer · <b>clic</b> attaquer · <kbd>A</kbd> et <kbd>E</kbd> (ou clic droit) : compétences · <kbd>1</kbd> potion de vie · <kbd>2</kbd> potion de mana</li>
    <li><kbd>F</kbd> parler aux personnages du village : la <b>marchande</b> (équipement, potions) et le <b>capitaine</b> (quêtes). La fontaine soigne.</li>
    <li>Gagnez de l’expérience, montez de niveau, explorez les zones de plus en plus dangereuses…</li>
    <li>Objectif final : vaincre le <b>Dragon Ancien</b> au nord-est ! L’expérience est partagée entre alliés proches.</li></ul>`,
  settings: [
    { key: 'difficulty', label: 'Difficulté', type: 'select', default: 1, options: [{ v: 0.7, l: 'Facile' }, { v: 1, l: 'Normale' }, { v: 1.4, l: 'Difficile' }, { v: 2, l: 'Héroïque' }] },
    { key: 'xp', label: 'Vitesse d’expérience', type: 'select', default: 1.5, options: [{ v: 1, l: '×1' }, { v: 1.5, l: '×1,5' }, { v: 2.5, l: '×2,5' }, { v: 4, l: '×4' }] },
    { key: 'startLvl', label: 'Niveau de départ', type: 'select', default: 1, options: [{ v: 1, l: '1' }, { v: 3, l: '3' }, { v: 5, l: '5' }, { v: 8, l: '8' }] },
    { key: 'boss', label: 'Puissance du dragon', type: 'select', default: 1, options: [{ v: 0.6, l: 'Faible' }, { v: 1, l: 'Normale' }, { v: 1.8, l: 'Légendaire' }] },
    { key: 'pvp', label: 'Combat entre joueurs', type: 'toggle', default: false },
  ],
  minPlayers: 1, maxPlayers: 12, tickRate: TICK,

  create(players, ctx, o) {
    const s = { world: makeWorld(), players: [], pending: players.map(p => ({ ...p })), mobs: [], shots: [], drops: [], nid: 1, time: 0, diff: o.difficulty || 1, xpMul: o.xp || 1.5, startLvl: o.startLvl || 1, bossMul: o.boss || 1, pvp: !!o.pvp, bossKills: 0, chat: [] };
    for (const z of ZONES) for (const [t, n] of z.mobs || []) for (let k = 0; k < n; k++) spawnMob(s, t, z);
    return s;
  },
  onJoin(s, p) { s.pending.push({ ...p }); },
  onLeave(s, id) { s.players = s.players.filter(p => p.id !== id); s.pending = s.pending.filter(p => p.id !== id); },

  onAction(s, id, a, ctx) {
    if (a.type === 'pick') { const p = s.pending.find(x => x.id === id); if (p && CLASSES[a.cls]) { s.pending = s.pending.filter(x => x.id !== id); s.players.push(newHero(p, a.cls, s)); ctx.emit({ type: 'joined', name: p.name, cls: a.cls }); } return; }
    const h = s.players.find(p => p.id === id); if (!h) return;
    switch (a.type) {
      case 'in': h.input = U.readInput(a); return;
      case 'ab': ability(s, h, a.k === 'e' ? 'e' : 'q', ctx, +a.x || h.x, +a.y || h.y); return;
      case 'potion': {
        if (h.dead) return;
        if (a.k === 'mp' && h.ethers > 0 && h.mp < h.maxMp) { h.ethers--; h.mp = Math.min(h.maxMp, h.mp + h.maxMp * 0.6); ctx.emit({ type: 'drink', id: h.id, k: 'mp' }); }
        if (a.k !== 'mp' && h.potions > 0 && h.hp < h.maxHp) { h.potions--; h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.6); ctx.emit({ type: 'drink', id: h.id, k: 'hp' }); }
        return;
      }
      case 'buy': {
        const it = SHOP[a.item]; if (!it) return;
        if (!s.world.npcs.some(n => n.role === 'shop' && U.dist(n.x, n.y, h.x, h.y) < 160)) return { error: 'Allez voir la marchande au village' };
        const lvl = a.item === 'arme' ? h.weapon : a.item === 'armure' ? h.armor : 0;
        if (it.max && lvl >= it.max) return { error: 'Déjà au maximum' };
        const price = it.base ? Math.round(it.base * Math.pow(1.7, lvl)) : it.price;
        if (h.gold < price) return { error: "Pas assez d'or" };
        h.gold -= price;
        if (a.item === 'potion') h.potions++; if (a.item === 'ether') h.ethers++;
        if (a.item === 'arme') h.weapon++; if (a.item === 'armure') { h.armor++; }
        recalc(h); ctx.emit({ type: 'bought' }, id); return;
      }
      case 'say': { const t = String(a.text || '').trim().slice(0, 140); if (t) { s.chat.push({ name: h.name, color: h.color, text: t, x: h.x, y: h.y, t: s.time, id: h.id }); if (s.chat.length > 40) s.chat.shift(); } return; }
    }
  },

  tick(s, dt, ctx) {
    s.time += dt;
    const obs = s.world.obs;
    for (const h of s.players) {
      if (h.dead > 0) { h.dead -= dt; if (h.dead <= 0) { Object.assign(h, { dead: 0, x: 640, y: 1620, hp: h.maxHp, mp: h.maxMp }); } continue; }
      const inp = h.input;
      h.a = inp.a ?? h.a;
      if (h.dash > 0) { h.dash -= dt; h.x += Math.cos(h.dashA) * h.dashSp * dt; h.y += Math.sin(h.dashA) * h.dashSp * dt;
        if (h.chargeHit) for (const m of s.mobs) if (m.hp > 0 && U.dist(h.x, h.y, m.x, m.y) < m.r + 24) { damageMob(s, m, h.atk * 1.3, h, ctx, { stun: 1.5 }); h.chargeHit = false; h.dash = 0; }
      } else { const mv = U.moveVec(inp), C = CLASSES[h.cls]; h.x += mv.x * C.speed * dt; h.y += mv.y * C.speed * dt; h.moving = !!(mv.x || mv.y); }
      h.x = U.clamp(h.x, 20, W - 20); h.y = U.clamp(h.y, 20, H - 20);
      for (const o of obs) U.pushOutRect(h, o);
      h.atkT -= dt; h.cdQ -= dt; h.cdE -= dt; h.shield -= dt;
      if (inp.f) attack(s, h, ctx);
      if (inp.f2) ability(s, h, 'e', ctx, inp.x, inp.y);
      // régénération (plus rapide au village)
      const village = ZONES[0], inV = h.x > village.x && h.x < village.x + village.w && h.y > village.y && h.y < village.y + village.h;
      h.safe = inV;
      const nearWell = U.dist(h.x, h.y, 640, 1560) < 140;
      h.hp = Math.min(h.maxHp, h.hp + h.maxHp * (nearWell ? 0.12 : inV ? 0.03 : 0.006) * dt);
      h.mp = Math.min(h.maxMp, h.mp + h.maxMp * (nearWell ? 0.12 : 0.02) * dt);
      for (const d of s.drops) if (!d.taken && U.dist(h.x, h.y, d.x, d.y) < 30) { d.taken = true; if (d.kind === 'potion') h.potions++; else h.ethers++; ctx.emit({ type: 'loot', kind: d.kind }, h.id); }
    }
    s.drops = s.drops.filter(d => !d.taken && (d.t -= dt) > 0);
    // monstres
    for (const m of s.mobs) {
      const M = MONSTERS[m.type];
      if (m.hp <= 0) { m.respawn -= dt; if (m.respawn <= 0) { const z = ZONES.find(z => z.name === m.zone); m.hp = m.maxHp; m.x = m.hx; m.y = m.hy; m.target = null; m.phase = 0; } continue; }
      m.stun -= dt; m.frozen -= dt; m.atkT -= dt;
      let tgt = s.players.find(p => p.id === m.target && !p.dead && !p.safe);
      if (tgt && U.dist(m.x, m.y, m.hx, m.hy) > (M.boss ? 900 : 700)) { tgt = null; m.target = null; } // laisse tomber trop loin
      if (!tgt) { let best = M.aggro; for (const p of s.players) { if (p.dead || p.safe) continue; const d = U.dist(m.x, m.y, p.x, p.y); if (d < best) { best = d; tgt = p; } } m.target = tgt?.id || null; }
      if (m.stun > 0 || m.frozen > 0) continue;
      let mx = 0, my = 0;
      if (tgt) {
        const d = U.dist(m.x, m.y, tgt.x, tgt.y), a = Math.atan2(tgt.y - m.y, tgt.x - m.x); m.a = a;
        const reach = M.ranged || (M.r + tgt.r + 10);
        if (d > reach * 0.85) { mx = Math.cos(a); my = Math.sin(a); }
        else if (M.ranged && d < 160) { mx = -Math.cos(a); my = -Math.sin(a); }
        if (d < reach && m.atkT <= 0) {
          m.atkT = M.boss ? 1.6 : 1.1;
          if (M.ranged) { s.shots.push({ id: s.nid++, x: m.x, y: m.y, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480, life: 1.2, dmg: M.atk, enemy: true, kind: m.type === 'sorcier' ? 'shadow' : 'arrowE' }); }
          else { damageHero(s, tgt, M.atk, ctx, m); ctx.emit({ type: 'bite', x: Math.round(tgt.x), y: Math.round(tgt.y), t: m.type }); }
        }
        if (M.boss) { // dragon : souffle de feu et invocations
          m.sp1 -= dt; m.sp2 -= dt;
          if (m.sp1 <= 0) { m.sp1 = U.rand(5, 7); for (let k = -6; k <= 6; k++) { const aa = a + k * 0.07; s.shots.push({ id: s.nid++, x: m.x + Math.cos(a) * 60, y: m.y + Math.sin(a) * 60, vx: Math.cos(aa) * 420, vy: Math.sin(aa) * 420, life: 1.1, dmg: M.atk * 0.5, enemy: true, kind: 'fire' }); } ctx.emit({ type: 'roar', x: m.x, y: m.y }); }
          if (m.sp2 <= 0) { m.sp2 = 14; for (let k = 0; k < 2; k++) { spawnMob(s, 'orc', ZONES[5]); const nm = s.mobs[s.mobs.length - 1]; nm.x = m.x + U.rand(-120, 120); nm.y = m.y + U.rand(80, 160); nm.hx = nm.x; nm.hy = nm.y; nm.summoned = true; } }
        }
      } else if (U.dist(m.x, m.y, m.hx, m.hy) > 30) { const a = Math.atan2(m.hy - m.y, m.hx - m.x); mx = Math.cos(a) * 0.6; my = Math.sin(a) * 0.6; m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.1 * dt); }
      else if (Math.random() < dt * 0.3) { m.wx = U.rand(-1, 1); m.wy = U.rand(-1, 1); }
      else if (m.wx) { mx = m.wx * 0.3; my = m.wy * 0.3; }
      m.x += mx * M.speed * dt; m.y += my * M.speed * dt;
      for (const o of obs) U.pushOutRect(m, o);
      // les monstres ne vont pas au village
      const v = ZONES[0]; if (m.x < v.x + v.w + 20 && m.y > v.y && m.y < v.y + v.h) m.x = v.x + v.w + 20;
    }
    s.mobs = s.mobs.filter(m => !(m.summoned && m.hp <= 0));
    for (let i = 0; i < s.mobs.length; i++) for (let j = i + 1; j < s.mobs.length; j++) { const a = s.mobs[i], b = s.mobs[j]; if (a.hp > 0 && b.hp > 0 && Math.abs(a.x - b.x) < 120 && Math.abs(a.y - b.y) < 120) U.separate(a, b); }
    // projectiles
    for (const p of s.shots) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (obs.some(o => p.x > o.x && p.x < o.x + o.w && p.y > o.y && p.y < o.y + o.h)) p.life = 0;
      if (p.enemy) { for (const h of s.players) if (!h.dead && U.dist(p.x, p.y, h.x, h.y) < h.r + 6) { damageHero(s, h, p.dmg, ctx); p.life = 0; break; } }
      else {
        const owner = s.players.find(h => h.id === p.owner);
        for (const m of s.mobs) if (m.hp > 0 && U.dist(p.x, p.y, m.x, m.y) < m.r + 6 && !(p.hit ||= []).includes(m.id)) {
          p.hit.push(m.id);
          if (p.aoe) { for (const m2 of s.mobs) if (m2.hp > 0 && U.dist(p.x, p.y, m2.x, m2.y) < p.aoe + m2.r) damageMob(s, m2, p.dmg, owner, ctx); ctx.emit({ type: 'boom', x: Math.round(p.x), y: Math.round(p.y) }); p.life = 0; break; }
          damageMob(s, m, p.dmg, owner, ctx); if (!(p.pierce > 0 && p.pierce--)) { p.life = 0; break; }
        }
        if (s.pvp && p.life > 0) for (const h of s.players) if (h.id !== p.owner && !h.dead && U.dist(p.x, p.y, h.x, h.y) < h.r + 6) { damageHero(s, h, p.dmg * 0.5, ctx); p.life = 0; break; }
      }
    }
    s.shots = s.shots.filter(p => p.life > 0);
  },

  records(s) { return s.players.map(h => ({ id: h.id, key: 'quest:level', value: h.lvl })); },
  view(s, id) {
    const me = s.players.find(p => p.id === id);
    const cx = me?.x ?? 640, cy = me?.y ?? 1500;
    const near = (x, y, m = 1100) => Math.abs(x - cx) < m && Math.abs(y - cy) < m * 0.8;
    return {
      t: s.time, picking: s.pending.some(p => p.id === id), bossKills: s.bossKills, pvp: s.pvp,
      heroes: s.players.map(h => ({ id: h.id, name: h.name, color: h.color, cls: h.cls, x: U.r1(h.x), y: U.r1(h.y), a: U.r2(h.a), lvl: h.lvl, hp: Math.ceil(h.hp), maxHp: h.maxHp, dead: h.dead > 0, moving: !!h.moving, shield: h.shield > 0, atk: h.atkT > CLASSES[h.cls].rate - 0.2, weapon: h.weapon, armor: h.armor })),
      mobs: s.mobs.filter(m => m.hp > 0 && near(m.x, m.y)).map(m => ({ id: m.id, t: m.type, x: U.r1(m.x), y: U.r1(m.y), a: U.r2(m.a), hp: Math.round(m.hp / m.maxHp * 100), frozen: m.frozen > 0, stun: m.stun > 0, aggro: !!m.target })),
      shots: s.shots.filter(p => near(p.x, p.y)).map(p => [p.id, Math.round(p.x), Math.round(p.y), p.kind, U.r2(Math.atan2(p.vy, p.vx))]),
      drops: s.drops.filter(d => near(d.x, d.y)).map(d => [d.id, Math.round(d.x), Math.round(d.y), d.kind]),
      boss: (() => { const b = s.mobs.find(m => MONSTERS[m.type].boss); return b ? { hp: Math.max(0, b.hp), max: b.maxHp, alive: b.hp > 0, near: U.dist(b.x, b.y, cx, cy) < 900, respawn: Math.ceil(Math.max(0, b.respawn || 0)) } : null; })(),
      chat: s.chat.filter(c => s.time - c.t < 30).map(c => ({ name: c.name, color: c.color, text: c.text, id: c.id, age: s.time - c.t })),
      me: me && { hp: Math.ceil(me.hp), maxHp: me.maxHp, mp: Math.floor(me.mp), maxMp: me.maxMp, lvl: me.lvl, xp: me.xp, next: xpFor(me.lvl), gold: me.gold, potions: me.potions, ethers: me.ethers, atk: me.atk, def: me.def, weapon: me.weapon, armor: me.armor,
        cdQ: U.r1(Math.max(0, me.cdQ)), cdE: U.r1(Math.max(0, me.cdE)), dead: Math.ceil(Math.max(0, me.dead)), cls: me.cls, kills: me.kills, quest: QUESTS[me.quest] ? { text: QUESTS[me.quest].text, n: QUESTS[me.quest].n, p: me.qprog } : null, safe: me.safe,
        zone: (ZONES.find(z => me.x > z.x && me.x < z.x + z.w && me.y > z.y && me.y < z.y + z.h) || { name: 'Terres sauvages' }).name },
    };
  },
  staticData(s) {
    return { W, H, world: s.world, zones: ZONES.map(z => ({ name: z.name, x: z.x, y: z.y, w: z.w, h: z.h, color: z.color, lvl: z.mobs ? Math.min(...z.mobs.map(([t]) => MONSTERS[t].lvl)) + '-' + Math.max(...z.mobs.map(([t]) => MONSTERS[t].lvl)) : null })),
      classes: CLASSES, monsters: MONSTERS, shop: SHOP, quests: QUESTS };
  },
};
