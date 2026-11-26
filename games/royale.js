// =====================================================================
//  MINI BATTLE ROYALE — règles (serveur)
//  Tout le monde atterrit sur l'île, ramasse armes et soins, et la zone
//  se resserre. Le dernier survivant gagne. Bots optionnels.
// =====================================================================
const U = require('./lib/util');
const TICK = 30;
const WEAPONS = {
  pistolet: { name: 'Pistolet', dmg: 18, rate: 0.28, mag: 12, reload: 1.1, spread: 0.05, pellets: 1, speed: 1400, range: 650, rarity: 0 },
  smg:      { name: 'Mitraillette', dmg: 12, rate: 0.08, mag: 30, reload: 1.6, spread: 0.12, pellets: 1, speed: 1400, range: 550, rarity: 1 },
  pompe:    { name: 'Fusil à pompe', dmg: 13, rate: 0.85, mag: 5, reload: 2.2, spread: 0.28, pellets: 8, speed: 1200, range: 330, rarity: 1 },
  fusil:    { name: "Fusil d'assaut", dmg: 19, rate: 0.12, mag: 30, reload: 1.9, spread: 0.06, pellets: 1, speed: 1700, range: 850, rarity: 2 },
  sniper:   { name: 'Sniper', dmg: 85, rate: 1.3, mag: 4, reload: 2.6, spread: 0.0, pellets: 1, speed: 3000, range: 1500, rarity: 3 },
};
const ITEMS = { bandage: { name: 'Bandage', heal: 20, max: 75 }, medkit: { name: 'Trousse de soin', heal: 100, max: 100 }, armor1: { name: 'Gilet', armor: 50 }, armor2: { name: 'Gilet lourd', armor: 100 }, ammo: { name: 'Munitions', ammo: 60 } };
const ZONE_SPEED = { lent: 1.4, normal: 1, rapide: 0.65 };
const SIZES = { petite: 2200, moyenne: 3000, grande: 3800 };
const BOT_NAMES = ['Bot Rex', 'Bot Luna', 'Bot Kiwi', 'Bot Nova', 'Bot Atlas', 'Bot Zéphyr', 'Bot Pixel', 'Bot Mango', 'Bot Orion', 'Bot Cookie', 'Bot Sushi', 'Bot Tango', 'Bot Volt', 'Bot Neko', 'Bot Bubble', 'Bot Fury', 'Bot Ninja', 'Bot Comète', 'Bot Brindille', 'Bot Galet'];
const BOT_COLORS = ['#94a3b8', '#a3a3a3', '#a8a29e', '#9ca3af'];

function makeMap(S, lootMul) {
  const obs = [], deco = [], loot = [];
  let nid = 1;
  const free = o => !obs.some(p => o.x < p.x + p.w + 40 && o.x + o.w + 40 > p.x && o.y < p.y + p.h + 40 && o.y + o.h + 40 > p.y);
  // maisons (avec butin à l'intérieur… enfin, juste devant)
  const nHouses = Math.round(S * S / 230000);
  for (let k = 0; k < nHouses * 3 && obs.filter(o => o.kind === 'house').length < nHouses; k++) {
    const o = { x: U.rand(100, S - 300), y: U.rand(100, S - 300), w: U.rand(140, 240), h: U.rand(120, 200), kind: 'house', hue: U.randInt(0, 4) };
    if (!free(o)) continue; obs.push(o);
    for (let j = 0; j < Math.round(U.rand(2, 4) * lootMul); j++) loot.push({ x: o.x + U.rand(-50, o.w + 50), y: j % 2 ? o.y - 40 : o.y + o.h + 40 });
  }
  for (let k = 0; k < S * S / 90000; k++) { const s = U.rand(36, 70); const o = { x: U.rand(50, S - 100), y: U.rand(50, S - 100), w: s, h: s, kind: U.chance(0.6) ? 'rock' : 'crate' }; if (free(o)) obs.push(o); }
  for (let k = 0; k < S * S / 40000; k++) deco.push({ kind: U.chance(0.55) ? 'tree' : 'bush', x: U.rand(0, S), y: U.rand(0, S), r: U.rand(30, 60) });
  for (let k = 0; k < S * S / 300000 * lootMul; k++) loot.push({ x: U.rand(80, S - 80), y: U.rand(80, S - 80) });
  // lac et rivière (décor)
  for (let k = 0; k < 3; k++) deco.push({ kind: 'lake', x: U.rand(300, S - 300), y: U.rand(300, S - 300), r: U.rand(120, 220) });
  const items = loot.filter(l => !obs.some(o => U.circleRect({ ...l, r: 20 }, o))).map(l => {
    const r = Math.random();
    let kind, sub;
    if (r < 0.42) { kind = 'weapon'; const rr = Math.random(); sub = rr < 0.3 ? 'pistolet' : rr < 0.55 ? 'smg' : rr < 0.75 ? 'pompe' : rr < 0.93 ? 'fusil' : 'sniper'; }
    else if (r < 0.62) { kind = 'item'; sub = 'ammo'; }
    else if (r < 0.78) { kind = 'item'; sub = 'bandage'; }
    else if (r < 0.86) { kind = 'item'; sub = 'medkit'; }
    else if (r < 0.95) { kind = 'item'; sub = 'armor1'; }
    else { kind = 'item'; sub = 'armor2'; }
    return { id: nid++, x: Math.round(l.x), y: Math.round(l.y), kind, sub, ammo: kind === 'weapon' ? WEAPONS[sub].mag : 0 };
  });
  return { obs, deco, items, nid };
}

function newPlayer(p, x, y, bot) {
  return { id: p.id, name: p.name, color: p.color, bot: !!bot, x, y, r: 16, a: 0, hp: 100, armor: 0, alive: true, kills: 0, place: 0,
    slots: [null, null], cur: 0, ammo: 30, reloadT: 0, shotT: 0, healT: 0, healItem: null, meds: { bandage: 0, medkit: 0 }, input: {}, spawnProt: 3, killer: null,
    ai: bot ? { t: 0, tx: x, ty: y, target: null, strafe: 1, aim: 0 } : null };
}

function alivePlayers(s) { return s.players.filter(p => p.alive); }
function zoneAt(s) { // interpolation de la zone actuelle
  const z = s.zone;
  if (z.state === 'shrink') { const f = U.clamp(1 - z.t / z.dur, 0, 1); return { x: U.lerp(z.from.x, z.to.x, f), y: U.lerp(z.from.y, z.to.y, f), r: U.lerp(z.from.r, z.to.r, f) }; }
  return z.from;
}
function nextZone(s) {
  const z = s.zone, cur = zoneAt(s);
  z.stage++;
  const r = z.stage >= 6 ? 0 : cur.r * 0.55;
  const a = Math.random() * 6.28, d = Math.random() * (cur.r - r);
  z.from = cur; z.to = { x: cur.x + Math.cos(a) * d, y: cur.y + Math.sin(a) * d, r };
  z.state = 'wait'; z.t = (z.stage === 1 ? 45 : Math.max(12, 35 - z.stage * 4)) * s.speedMul; z.dur = (25 + 5 * Math.max(0, 4 - z.stage)) * s.speedMul;
  z.dps = [1, 2, 4, 7, 10, 15, 25][Math.min(6, z.stage - 1)];
}

function hurt(s, p, dmg, by, ctx, weapon) {
  if (!p.alive || p.spawnProt > 0) return;
  const ab = Math.min(p.armor, dmg * 0.5); p.armor -= ab; p.hp -= dmg - ab;
  if (by) ctx.emit({ type: 'hit', id: p.id, dmg: Math.round(dmg) }, by.id);
  ctx.emit({ type: 'hurt' }, p.id);
  p.healT = 0;
  if (p.hp <= 0) kill(s, p, by, ctx, weapon);
}
function kill(s, p, by, ctx, weapon) {
  p.alive = false; p.hp = 0; p.place = alivePlayers(s).length + 1; p.killer = by?.id || null;
  if (by && by !== p) by.kills++;
  ctx.emit({ type: 'kill', killer: by?.id || null, victim: p.id, weapon: weapon || 'zone', x: p.x, y: p.y, left: alivePlayers(s).length });
  // il lâche son équipement
  for (const w of p.slots) if (w) s.items.push({ id: s.nid++, x: p.x + U.rand(-30, 30), y: p.y + U.rand(-30, 30), kind: 'weapon', sub: w.k, ammo: w.mag });
  if (p.ammo > 0) s.items.push({ id: s.nid++, x: p.x + U.rand(-30, 30), y: p.y + U.rand(-30, 30), kind: 'item', sub: 'ammo', amount: p.ammo });
  for (const [k, n] of Object.entries(p.meds)) for (let i = 0; i < n; i++) s.items.push({ id: s.nid++, x: p.x + U.rand(-35, 35), y: p.y + U.rand(-35, 35), kind: 'item', sub: k });
  const left = alivePlayers(s);
  if (left.length <= 1 && !s.over) { s.over = true; s.winner = left[0]?.id || null; if (left[0]) left[0].place = 1; s.endAt = Date.now(); ctx.emit({ type: 'win', id: s.winner }); }
}

function pickup(s, p, item, ctx) {
  if (item.kind === 'weapon') {
    const slot = p.slots[0] == null ? 0 : p.slots[1] == null ? 1 : p.cur;
    const old = p.slots[slot];
    if (old) s.items.push({ id: s.nid++, x: p.x + 20, y: p.y + 20, kind: 'weapon', sub: old.k, ammo: old.mag });
    p.slots[slot] = { k: item.sub, mag: item.ammo ?? WEAPONS[item.sub].mag };
    p.cur = slot; p.reloadT = 0;
  } else {
    const it = ITEMS[item.sub];
    if (item.sub === 'ammo') p.ammo += item.amount || it.ammo;
    else if (it.armor) { if (p.armor >= it.armor) return false; p.armor = it.armor; }
    else p.meds[item.sub]++;
  }
  ctx.emit({ type: 'pick', sub: item.sub }, p.id);
  return true;
}

function fire(s, p, ctx) {
  const w = p.slots[p.cur]; if (!w) return;
  const W = WEAPONS[w.k];
  if (p.reloadT > 0 || p.shotT > 0) return;
  if (w.mag <= 0) { reload(p); return; }
  w.mag--; p.shotT = W.rate; p.healT = 0; p.spawnProt = 0;
  const ox = p.x + Math.cos(p.a) * 24, oy = p.y + Math.sin(p.a) * 24;
  const moving = p.moving ? 1.6 : 1;
  for (let k = 0; k < W.pellets; k++) {
    const a = p.a + (Math.random() - 0.5) * W.spread * 2 * moving + (p.bot ? (Math.random() - 0.5) * p.ai.aim : 0);
    s.bullets.push({ id: s.nid++, x: ox, y: oy, vx: Math.cos(a) * W.speed, vy: Math.sin(a) * W.speed, life: W.range / W.speed, dmg: W.dmg, owner: p.id, w: w.k });
  }
  ctx.emit({ type: 'shot', id: p.id, w: w.k, x: ox, y: oy, a: p.a });
  if (w.mag <= 0) reload(p);
}
function reload(p) {
  const w = p.slots[p.cur]; if (!w || p.reloadT > 0) return;
  const W = WEAPONS[w.k]; if (w.mag >= W.mag || p.ammo <= 0) return;
  p.reloadT = W.reload;
}

// ---------------- IA des bots ----------------
function botThink(s, p, dt) {
  const ai = p.ai, z = zoneAt(s);
  ai.t -= dt;
  const inp = { u: 0, d: 0, l: 0, r: 0, f: 0, a: p.a };
  // cible visible la plus proche
  let tgt = null, best = 620;
  for (const q of s.players) { if (q === p || !q.alive) continue; const d = U.dist(p.x, p.y, q.x, q.y); if (d < best && U.los(p.x, p.y, q.x, q.y, s.map.obs)) { best = d; tgt = q; } }
  let mx = 0, my = 0;
  const outside = U.dist(p.x, p.y, z.x, z.y) > z.r * 0.85;
  if (tgt && p.slots.some(Boolean)) {
    if (!p.slots[p.cur]) p.cur = p.slots[0] ? 0 : 1;
    const want = Math.atan2(tgt.y - p.y, tgt.x - p.x);
    p.a += U.clamp(U.angDiff(p.a, want), -5 * dt, 5 * dt);
    inp.f = Math.abs(U.angDiff(p.a, want)) < 0.25 && Math.random() < 0.85;
    if (ai.t <= 0) { ai.strafe = U.chance(0.5) ? 1 : -1; ai.t = U.rand(0.6, 1.6); }
    const range = WEAPONS[p.slots[p.cur].k].range * 0.6;
    mx = Math.cos(want + Math.PI / 2) * ai.strafe + (best > range ? Math.cos(want) : best < 150 ? -Math.cos(want) : 0);
    my = Math.sin(want + Math.PI / 2) * ai.strafe + (best > range ? Math.sin(want) : best < 150 ? -Math.sin(want) : 0);
  } else {
    // va vers le butin le plus proche, ou vers la zone
    if (ai.t <= 0 || U.dist(p.x, p.y, ai.tx, ai.ty) < 30) {
      ai.t = U.rand(3, 6);
      const needWeapon = !p.slots.some(Boolean), needAmmo = p.ammo < 30, needHeal = p.hp < 60;
      let goal = null, gd = needWeapon ? 1500 : 500;
      for (const it of s.items) {
        const useful = it.kind === 'weapon' ? (needWeapon || WEAPONS[it.sub].rarity > Math.max(...p.slots.filter(Boolean).map(w => WEAPONS[w.k].rarity), -1)) : it.sub === 'ammo' ? needAmmo : (it.sub === 'bandage' || it.sub === 'medkit') ? needHeal || p.meds.bandage + p.meds.medkit < 2 : ITEMS[it.sub].armor > p.armor;
        if (!useful) continue;
        const d = U.dist(p.x, p.y, it.x, it.y); if (d < gd && U.dist(it.x, it.y, z.x, z.y) < z.r) { gd = d; goal = it; }
      }
      if (goal && !outside) { ai.tx = goal.x; ai.ty = goal.y; }
      else { const a = Math.random() * 6.28, d = Math.random() * z.r * 0.6; ai.tx = z.x + Math.cos(a) * d; ai.ty = z.y + Math.sin(a) * d; }
    }
    if (s.zone.state === 'shrink' || outside) { const to = s.zone.to; if (U.dist(p.x, p.y, to.x, to.y) > to.r * 0.8) { ai.tx = to.x; ai.ty = to.y; } }
    const d = U.dist(p.x, p.y, ai.tx, ai.ty) || 1;
    mx = (ai.tx - p.x) / d; my = (ai.ty - p.y) / d;
    p.a = Math.atan2(my, mx);
    // soins
    if (p.hp < 70 && (p.meds.bandage || p.meds.medkit) && !p.healT) startHeal(p, p.meds.medkit && p.hp < 40 ? 'medkit' : p.meds.bandage ? 'bandage' : 'medkit');
    if (p.slots[p.cur] && p.slots[p.cur].mag < WEAPONS[p.slots[p.cur].k].mag / 2) reload(p);
  }
  // contourne les obstacles grossièrement
  const ahead = { x: p.x + mx * 40, y: p.y + my * 40, r: 18 };
  if (s.map.obs.some(o => U.circleRect(ahead, o))) { const t = mx; mx = -my * ai.strafe; my = t * ai.strafe; }
  inp.r = mx > 0.3; inp.l = mx < -0.3; inp.d = my > 0.3; inp.u = my < -0.3; inp.a = p.a;
  // ramasse ce qui est à portée
  for (const it of s.items) if (!it.taken && U.dist(p.x, p.y, it.x, it.y) < 40) {
    const better = it.kind !== 'weapon' || !p.slots[0] || !p.slots[1] || WEAPONS[it.sub].rarity > WEAPONS[p.slots[p.cur].k].rarity;
    if (better && pickup(s, p, it, { emit() {} })) it.taken = true;
  }
  p.input = inp;
}
function startHeal(p, kind) { if (!p.meds[kind]) return; const it = ITEMS[kind]; if (p.hp >= it.max) return; p.healT = kind === 'medkit' ? 4 : 2; p.healItem = kind; }

// =====================================================================
module.exports = {
  id: 'royale',
  name: 'Mini Battle Royale',
  description: 'Atterrissez, ramassez des armes, la zone rétrécit… Soyez le dernier survivant !',
  category: 'Action', icon: '🪂', color: '#7c3aed', order: 6,
  tags: ['👑 Dernier survivant', '🤖 Bots'],
  rules: `<ul><li><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> bouger · souris viser · clic tirer · <kbd>R</kbd> recharger</li>
    <li><kbd>E</kbd> ramasser · <kbd>1</kbd>/<kbd>2</kbd> ou molette : arme · <kbd>H</kbd> bandage · <kbd>J</kbd> trousse de soin</li>
    <li>Restez dans la <b>zone</b> (cercle blanc) : dehors, vous perdez de la vie, de plus en plus vite.</li>
    <li>Cachez-vous dans les buissons et sous les arbres ! Le dernier en vie gagne.</li></ul>`,
  settings: [
    { key: 'bots', label: 'Bots', type: 'select', default: 8, options: [{ v: 0, l: 'Aucun' }, { v: 4, l: '4' }, { v: 8, l: '8' }, { v: 14, l: '14' }, { v: 20, l: '20' }], help: 'Adversaires contrôlés par l’ordinateur.' },
    { key: 'botLevel', label: 'Niveau des bots', type: 'select', default: 'normal', options: [{ v: 'facile', l: 'Facile' }, { v: 'normal', l: 'Normal' }, { v: 'fort', l: 'Fort' }] },
    { key: 'size', label: 'Taille de l’île', type: 'select', default: 'moyenne', options: [{ v: 'petite', l: 'Petite' }, { v: 'moyenne', l: 'Moyenne' }, { v: 'grande', l: 'Grande' }] },
    { key: 'zone', label: 'Vitesse de la zone', type: 'select', default: 'normal', options: [{ v: 'lent', l: 'Lente' }, { v: 'normal', l: 'Normale' }, { v: 'rapide', l: 'Rapide' }] },
    { key: 'loot', label: 'Butin', type: 'select', default: 1, options: [{ v: 0.6, l: 'Rare' }, { v: 1, l: 'Normal' }, { v: 1.6, l: 'Abondant' }] },
    { key: 'start', label: 'Arme de départ', type: 'select', default: 'none', options: [{ v: 'none', l: 'Aucune' }, { v: 'pistolet', l: 'Pistolet' }, { v: 'smg', l: 'Mitraillette' }] },
  ],
  minPlayers: 1, maxPlayers: 16, tickRate: TICK,

  create(players, ctx, o) {
    const S = SIZES[o.size] || 3000;
    const map = makeMap(S, o.loot || 1);
    const s = { S, map, items: map.items, nid: map.nid, bullets: [], players: [], over: false, winner: null, time: 0, speedMul: ZONE_SPEED[o.zone] || 1, feed: [] };
    const all = [...players.map(p => ({ ...p })), ...Array.from({ length: o.bots ?? 8 }, (_, i) => ({ id: 'bot' + i, name: BOT_NAMES[i % BOT_NAMES.length], color: BOT_COLORS[i % 4], bot: true }))];
    for (const p of all) {
      let x, y;
      for (let k = 0; k < 50; k++) { x = U.rand(150, S - 150); y = U.rand(150, S - 150); if (!map.obs.some(ob => U.circleRect({ x, y, r: 30 }, ob)) && s.players.every(q => U.dist(q.x, q.y, x, y) > 350)) break; }
      const np = newPlayer(p, x, y, p.bot);
      if (p.bot) np.ai.aim = { facile: 0.5, normal: 0.25, fort: 0.08 }[o.botLevel || 'normal'];
      if (o.start && o.start !== 'none') { np.slots[0] = { k: o.start, mag: WEAPONS[o.start].mag }; np.ammo = 60; }
      s.players.push(np);
    }
    s.zone = { stage: 0, from: { x: S / 2, y: S / 2, r: S * 0.75 }, to: null, state: 'wait', t: 0, dur: 0, dps: 1 };
    nextZone(s);
    return s;
  },
  onJoin() {},
  onLeave(s, id, ctx) { const p = s.players.find(q => q.id === id); if (p && p.alive && !s.over) kill(s, p, null, ctx, 'leave'); },

  onAction(s, id, a, ctx) {
    const p = s.players.find(q => q.id === id); if (!p || !p.alive) return;
    switch (a.type) {
      case 'in': p.input = U.readInput(a); return;
      case 'slot': { const i = a.i ?? (p.cur + 1) % 2; if (p.slots[i]) { p.cur = i; p.reloadT = 0; p.shotT = Math.max(p.shotT, 0.25); } return; }
      case 'reload': reload(p); return;
      case 'heal': startHeal(p, a.item === 'medkit' ? 'medkit' : 'bandage'); return;
      case 'pick': {
        let best = null, bd = 60;
        for (const it of s.items) { if (it.taken) continue; const d = U.dist(p.x, p.y, it.x, it.y); if (d < bd) { bd = d; best = it; } }
        if (best && pickup(s, p, best, ctx)) best.taken = true;
        return;
      }
    }
  },

  tick(s, dt, ctx) {
    s.time += dt;
    if (s.over) return;
    // zone
    const z = s.zone; z.t -= dt;
    if (z.t <= 0) { if (z.state === 'wait') { z.state = 'shrink'; z.t = z.dur; ctx.emit({ type: 'zone', state: 'shrink' }); } else { z.from = z.to; z.state = 'wait'; nextZone(s); ctx.emit({ type: 'zone', state: 'wait' }); } }
    const zc = zoneAt(s);
    for (const p of s.players) {
      if (!p.alive) continue;
      if (p.bot) botThink(s, p, dt);
      const inp = p.input || {}, mv = U.moveVec(inp);
      const sp = 230 * (p.healT > 0 ? 0.45 : 1) * (p.slots[p.cur]?.k === 'sniper' ? 0.9 : 1);
      p.moving = !!(mv.x || mv.y);
      p.x = U.clamp(p.x + mv.x * sp * dt, 20, s.S - 20); p.y = U.clamp(p.y + mv.y * sp * dt, 20, s.S - 20);
      if (!p.bot) p.a = inp.a || 0;
      for (const o of s.map.obs) U.pushOutRect(p, o);
      p.shotT -= dt; p.spawnProt -= dt;
      if (p.reloadT > 0) { p.reloadT -= dt; if (p.reloadT <= 0) { const w = p.slots[p.cur]; if (w) { const need = WEAPONS[w.k].mag - w.mag, take = Math.min(need, p.ammo); w.mag += take; p.ammo -= take; } } }
      if (p.healT > 0) { p.healT -= dt; if (p.healT <= 0 && p.meds[p.healItem] > 0) { const it = ITEMS[p.healItem]; p.meds[p.healItem]--; p.hp = Math.min(Math.max(p.hp, it.max), p.hp + it.heal); p.hp = Math.min(p.hp, 100); if (!p.bot) ctx.emit({ type: 'healed' }, p.id); } }
      if (inp.f) fire(s, p, ctx);
      // dégâts de zone
      if (U.dist(p.x, p.y, zc.x, zc.y) > zc.r) { p.zoneDmg = (p.zoneDmg || 0) + z.dps * dt; if (p.zoneDmg >= 1) { const d = Math.floor(p.zoneDmg); p.zoneDmg -= d; p.hp -= d; if (p.hp <= 0) kill(s, p, null, ctx, 'zone'); } }
    }
    for (let a = 0; a < s.players.length; a++) for (let b = a + 1; b < s.players.length; b++) { const A = s.players[a], B = s.players[b]; if (A.alive && B.alive) U.separate(A, B); }
    // balles
    for (const b of s.bullets) {
      const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 14));
      for (let k = 0; k < steps && b.life > 0; k++) {
        b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
        if (s.map.obs.some(o => b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h)) { ctx.emit({ type: 'spark', x: b.x, y: b.y }); b.life = 0; break; }
        for (const p of s.players) {
          if (!p.alive || p.id === b.owner) continue;
          if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 < (p.r + 3) ** 2) {
            hurt(s, p, b.dmg, s.players.find(q => q.id === b.owner), ctx, b.w);
            ctx.emit({ type: 'blood', x: b.x, y: b.y, a: Math.atan2(b.vy, b.vx) });
            b.life = 0; break;
          }
        }
      }
      b.life -= dt;
    }
    s.bullets = s.bullets.filter(b => b.life > 0);
    s.items = s.items.filter(i => !i.taken);
  },

  results(s) {
    if (!s.over) return null;
    return { key: 'over', players: s.players.map(p => ({ id: p.id, place: p.place || s.players.length, win: p.id === s.winner, score: `#${p.place} · ${p.kills} élim.` })),
      records: s.players.map(p => ({ id: p.id, key: 'royale:kills', value: p.kills })) };
  },
  view(s, id) {
    const me = s.players.find(p => p.id === id);
    const zc = zoneAt(s), z = s.zone;
    // on n'envoie que ce qui est proche (anti-triche et bande passante)
    const cx = me?.alive ? me.x : (s.players.find(p => p.id === me?.spec) || s.players.find(p => p.alive) || me || { x: s.S / 2 }).x;
    const cy = me?.alive ? me.y : (s.players.find(p => p.id === me?.spec) || s.players.find(p => p.alive) || me || { y: s.S / 2 }).y;
    const near = (x, y, m = 1100) => Math.abs(x - cx) < m && Math.abs(y - cy) < m * 0.75;
    if (me && !me.alive) { const sp = s.players.find(p => p.id === me.spec && p.alive) || s.players.find(p => p.id === me.killer && p.alive) || s.players.find(p => p.alive); me.spec = sp?.id; }
    return {
      S: s.S, over: s.over, winner: s.winner, alive: alivePlayers(s).length, total: s.players.length, time: s.time,
      zone: { x: Math.round(zc.x), y: Math.round(zc.y), r: Math.round(zc.r), to: z.to && { x: Math.round(z.to.x), y: Math.round(z.to.y), r: Math.round(z.to.r) }, state: z.state, t: Math.ceil(z.t), stage: z.stage, dps: z.dps },
      players: s.players.filter(p => p.alive && near(p.x, p.y)).map(p => ({ id: p.id, name: p.name, color: p.color, x: U.r1(p.x), y: U.r1(p.y), a: U.r2(p.a), hp: Math.ceil(p.hp), armor: Math.round(p.armor), w: p.slots[p.cur]?.k || null, healing: p.healT > 0, bot: p.bot, prot: p.spawnProt > 0 })),
      bullets: s.bullets.filter(b => near(b.x, b.y)).map(b => [b.id, Math.round(b.x), Math.round(b.y), U.r2(Math.atan2(b.vy, b.vx)), b.w === 'sniper' ? 1 : 0]),
      items: s.items.filter(i => near(i.x, i.y, 1300)).map(i => [i.id, i.x, i.y, i.kind, i.sub]),
      spec: me && !me.alive ? me.spec : null, cam: { x: cx, y: cy },
      me: me && { alive: me.alive, hp: Math.ceil(me.hp), armor: Math.round(me.armor), kills: me.kills, place: me.place, slots: me.slots, cur: me.cur, ammo: me.ammo, reloadT: U.r2(Math.max(0, me.reloadT)), healT: U.r2(Math.max(0, me.healT)), meds: me.meds, killer: me.killer },
      board: s.over ? s.players.map(p => ({ id: p.id, name: p.name, color: p.color, kills: p.kills, place: p.place, bot: p.bot })) : null,
    };
  },
  staticData(s) { return { S: s.S, obs: s.map.obs, deco: s.map.deco, weapons: WEAPONS, items: ITEMS, names: Object.fromEntries(s.players.map(p => [p.id, { name: p.name, color: p.color }])) }; },
};
