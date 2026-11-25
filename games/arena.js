// =====================================================================
//  ARÈNE NÉON — règles (serveur)
//  FPS 3D en match à mort (chacun pour soi), 1 à 16 joueurs.
//  Le serveur est l'arbitre : il valide les déplacements, calcule les
//  tirs (avec compensation de latence), les dégâts, les éliminations,
//  les bonus, la réapparition et le score.
// =====================================================================

const TICK = 20, FRAG_LIMIT = 25, MATCH_TIME = 6 * 60 * 1000, END_PAUSE = 12000, RESPAWN = 3000;
const EYE = 1.6, RADIUS = 0.4, HEIGHT = 1.8;

const WEAPONS = {
  rifle:   { name: 'Fusil à impulsion', dmg: 20, head: 2,   rate: 100,  mag: 30, reload: 1600, pellets: 1, range: 200 },
  shotgun: { name: 'Fragmenteur',       dmg: 11, head: 1.5, rate: 850,  mag: 6,  reload: 2000, pellets: 9, range: 60 },
  rail:    { name: 'Canon à rail',      dmg: 85, head: 2.5, rate: 1300, mag: 5,  reload: 2400, pellets: 1, range: 400 },
};

// --- Carte ------------------------------------------------------------
// Boîte : x,z = centre ; y = bas ; w,h,d = tailles ; c = couleur des arêtes
const B = (x, y, z, w, h, d, c = 'cyan') => ({ x, y, z, w, h, d, c });
const SIZE = 80, H = SIZE / 2;
const MAP = { size: SIZE, boxes: [], pads: [], spawns: [], pickups: [] };
{
  const b = MAP.boxes;
  // murs
  b.push(B(0, 0, -H - 1, SIZE + 4, 8, 2, 'magenta'), B(0, 0, H + 1, SIZE + 4, 8, 2, 'magenta'),
    B(-H - 1, 0, 0, 2, 8, SIZE, 'magenta'), B(H + 1, 0, 0, 2, 8, SIZE, 'magenta'));
  // tour centrale + escaliers nord/sud
  b.push(B(0, 0, 0, 12, 3.5, 12, 'yellow'));
  for (let k = 0; k < 7; k++) {
    const h = 0.5 * (k + 1);
    b.push(B(0, 0, 6 + 6.5 - k, 3, h, 1, 'yellow'), B(0, 0, -6 - 6.5 + k, 3, h, 1, 'yellow'));
  }
  b.push(B(-3, 3.5, 0, 0.6, 1.2, 8, 'yellow'), B(3, 3.5, 0, 0.6, 1.2, 8, 'yellow')); // parapets
  // plateformes d'angle (accès par tremplin)
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    b.push(B(sx * 30, 0, sz * 30, 12, 5, 12, 'magenta'));
    b.push(B(sx * 35.7, 5, sz * 30, 0.6, 1, 12, 'magenta'), B(sx * 30, 5, sz * 35.7, 12, 1, 0.6, 'magenta')); // garde-corps extérieurs
    MAP.pads.push({ x: sx * 20.5, z: sz * 30, r: 1.4, power: 17, push: [sx * 9, 0] });
    MAP.pickups.push({ id: MAP.pickups.length, type: 'armor', x: sx * 30, y: 5, z: sz * 30 });
  }
  // couloirs / murets
  b.push(B(-16, 0, 0, 2, 3, 18), B(16, 0, 0, 2, 3, 18), B(0, 0, -22, 18, 3, 2), B(0, 0, 22, 18, 3, 2));
  // caisses
  const crates = [[-10, -12, 2], [10, 12, 2], [-12, 12, 2.5], [12, -12, 2.5], [-24, 8, 2], [24, -8, 2], [8, -30, 2], [-8, 30, 2],
    [-30, -8, 3], [30, 8, 3], [-22, -20, 1.5], [22, 20, 1.5], [20, -26, 2], [-20, 26, 2]];
  for (const [x, z, s] of crates) if (s) b.push(B(x, 0, z, s, s, s, 'lime'));
  b.push(B(-10, 2, -12, 1.2, 1.2, 1.2, 'lime'), B(10, 2, 12, 1.2, 1.2, 1.2, 'lime'));
  // piliers
  for (const [x, z] of [[-8, 16], [8, -16], [-26, -32], [26, 32], [34, -18], [-34, 18]]) b.push(B(x, 0, z, 1.6, 7, 1.6, 'cyan'));
  MAP.pads.push({ x: 7, z: -17, r: 1.4, power: 14, push: [0, 10] }, { x: -7, z: 17, r: 1.4, power: 14, push: [0, -10] });
  // spawns
  for (const [x, z] of [[-36, 0], [36, 0], [0, -37], [0, 37], [-20, -36], [20, 36], [-36, -20], [36, 20], [-14, 8], [14, -8], [-30, 20], [30, -20], [0, 13.6]])
    MAP.spawns.push({ x, z });
  // soins
  for (const [x, z] of [[0, 0], [-16, -14], [16, 14], [-34, 34], [34, -34]]) MAP.pickups.push({ id: MAP.pickups.length, type: 'health', x, y: x === 0 && z === 0 ? 3.5 : 0, z });
}

// --- Géométrie ----------------------------------------------------------
function rayBox(o, d, minX, minY, minZ, maxX, maxY, maxZ) {
  let t0 = 0, t1 = Infinity;
  const mn = [minX, minY, minZ], mx = [maxX, maxY, maxZ];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) { if (o[a] < mn[a] || o[a] > mx[a]) return Infinity; continue; }
    let ta = (mn[a] - o[a]) / d[a], tb = (mx[a] - o[a]) / d[a];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return Infinity;
  }
  return t0;
}
function raySphere(o, d, c, r) {
  const ox = o[0] - c[0], oy = o[1] - c[1], oz = o[2] - c[2];
  const b = ox * d[0] + oy * d[1] + oz * d[2], cc = ox * ox + oy * oy + oz * oz - r * r;
  const h = b * b - cc;
  if (h < 0) return Infinity;
  const t = -b - Math.sqrt(h);
  return t >= 0 ? t : Infinity;
}
function rayWorld(o, d) {
  let t = rayBox(o, d, -1e4, -1e4, -1e4, 1e4, 0, 1e4); // sol
  for (const b of MAP.boxes) t = Math.min(t, rayBox(o, d, b.x - b.w / 2, b.y, b.z - b.d / 2, b.x + b.w / 2, b.y + b.h, b.z + b.d / 2));
  return t;
}
function insideBox(x, y, z) {
  return MAP.boxes.some(b => x > b.x - b.w / 2 + 0.05 && x < b.x + b.w / 2 - 0.05 && z > b.z - b.d / 2 + 0.05 && z < b.z + b.d / 2 - 0.05 && y + 0.5 > b.y && y + 0.5 < b.y + b.h);
}
function boxTop(x, z) { // hauteur du sol sous un point (pour les spawns)
  let top = 0;
  for (const b of MAP.boxes) if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) top = Math.max(top, b.y + b.h);
  return top;
}

// --- Joueurs ------------------------------------------------------------
function fullAmmo() { return Object.fromEntries(Object.entries(WEAPONS).map(([k, w]) => [k, w.mag])); }

function newPlayer(p) {
  return {
    id: p.id, name: p.name, color: p.color, x: 0, y: 0, z: 0, yaw: 0, pitch: 0,
    hp: 100, armor: 0, alive: false, respawnAt: 0, kills: 0, deaths: 0, streak: 0,
    weapon: 'rifle', ammo: fullAmmo(), reloadUntil: 0, lastShot: 0, spawnN: 0, corrN: 0,
    lastMove: 0, protectUntil: 0, ping: 80, hist: [], killer: null, lastDamager: null,
  };
}

function spawn(s, p, now) {
  const enemies = Object.values(s.players).filter(o => o.alive && o.id !== p.id);
  let best = MAP.spawns[0], bestD = -1;
  for (const sp of MAP.spawns) {
    const d = enemies.length ? Math.min(...enemies.map(e => Math.hypot(e.x - sp.x, e.z - sp.z))) : Math.random() * 100;
    const score = d + Math.random() * 6;
    if (score > bestD) { bestD = score; best = sp; }
  }
  Object.assign(p, {
    x: best.x, z: best.z, y: boxTop(best.x, best.z), yaw: Math.atan2(best.x, best.z), pitch: 0,
    hp: 100, armor: 0, alive: true, ammo: fullAmmo(), reloadUntil: 0, weapon: p.weapon || 'rifle',
    lastMove: now, protectUntil: now + 1500, hist: [], killer: null, lastDamager: null,
  });
  p.spawnN++;
}

function kill(s, victim, killer, weapon, head, ctx) {
  victim.alive = false; victim.hp = 0; victim.deaths++; victim.streak = 0;
  victim.respawnAt = Date.now() + RESPAWN;
  victim.killer = killer ? killer.id : null;
  if (killer && killer !== victim) {
    killer.kills++; killer.streak++;
    if (killer.kills >= s.fragLimit) endMatch(s, ctx);
  } else victim.kills = Math.max(0, victim.kills - 1);
  ctx.emit({ type: 'kill', killer: killer?.id || null, victim: victim.id, weapon, head, streak: killer?.streak || 0, x: victim.x, y: victim.y, z: victim.z });
}

function damage(s, victim, attacker, amount, weapon, head, ctx) {
  const now = Date.now();
  if (!victim.alive || now < victim.protectUntil) return false;
  const absorbed = Math.min(victim.armor, Math.round(amount * 0.6));
  victim.armor -= absorbed;
  victim.hp -= amount - absorbed;
  victim.lastDamager = attacker.id;
  ctx.emit({ type: 'hurt', from: [attacker.x, attacker.y + EYE, attacker.z], dmg: amount }, victim.id);
  if (victim.hp <= 0) { kill(s, victim, attacker, weapon, head, ctx); return true; }
  return false;
}

function endMatch(s, ctx) {
  if (s.phase !== 'play') return;
  s.phase = 'end';
  s.restartAt = Date.now() + END_PAUSE;
  const ranking = Object.values(s.players).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  s.winner = ranking[0]?.id || null;
  ctx.emit({ type: 'matchEnd', winner: s.winner });
}

function restart(s, ctx) {
  s.phase = 'play';
  s.endsAt = Date.now() + MATCH_TIME;
  s.winner = null;
  for (const p of Object.values(s.players)) { p.kills = 0; p.deaths = 0; p.streak = 0; spawn(s, p, Date.now()); }
  s.pickups.forEach(pk => { pk.active = true; });
  ctx.emit({ type: 'matchStart' });
}

// position d'un joueur il y a "ago" ms (compensation de latence)
function rewind(p, t) {
  const h = p.hist;
  if (!h.length) return p;
  for (let k = h.length - 1; k >= 0; k--) if (h[k].t <= t) {
    const a = h[k], b = h[k + 1];
    if (!b) return a;
    const f = (t - a.t) / (b.t - a.t);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f };
  }
  return h[0];
}

// =====================================================================
module.exports = {
  id: 'arena',
  name: 'Arène Néon',
  description: 'FPS 3D en match à mort, rejoignable à tout moment',
  minPlayers: 1,
  maxPlayers: 16,
  tickRate: TICK,
  joinInProgress: true,

  create(players, ctx) {
    const s = {
      players: {}, phase: 'play', endsAt: Date.now() + MATCH_TIME, fragLimit: FRAG_LIMIT, winner: null, restartAt: 0,
      pickups: MAP.pickups.map(pk => ({ ...pk, active: true, respawnAt: 0 })),
    };
    for (const p of players) { s.players[p.id] = newPlayer(p); spawn(s, s.players[p.id], Date.now()); }
    return s;
  },

  onJoin(s, p, ctx) {
    s.players[p.id] = newPlayer(p);
    spawn(s, s.players[p.id], Date.now());
    ctx.emit({ type: 'info', text: `${p.name} rejoint l'arène` });
  },
  onLeave(s, id, ctx) {
    const p = s.players[id];
    if (!p) return;
    delete s.players[id];
    ctx.emit({ type: 'info', text: `${p.name} a quitté l'arène` });
  },

  onAction(s, id, a, ctx) {
    const p = s.players[id];
    if (!p) return;
    const now = Date.now();
    switch (a.type) {
      case 'move': {
        if (!p.alive || s.phase !== 'play') return;
        const x = +a.x, y = +a.y, z = +a.z;
        if (![x, y, z, +a.yaw, +a.pitch].every(Number.isFinite)) return;
        const dt = Math.min(1, Math.max(0.016, (now - p.lastMove) / 1000));
        const horiz = Math.hypot(x - p.x, z - p.z), vert = Math.abs(y - p.y);
        const ok = horiz <= 17 * dt + 1.2 && vert <= 20 * dt + 1.5 && Math.abs(x) < H && Math.abs(z) < H && y > -1 && y < 30 && !insideBox(x, y, z);
        if (!ok) { p.corrN++; p.lastMove = now; return; } // le client sera recalé
        Object.assign(p, { x, y, z, yaw: +a.yaw, pitch: Math.max(-1.6, Math.min(1.6, +a.pitch)), lastMove: now });
        return;
      }
      case 'weapon':
        if (WEAPONS[a.w] && a.w !== p.weapon) { p.weapon = a.w; p.reloadUntil = 0; }
        return;
      case 'reload': {
        const w = WEAPONS[p.weapon];
        if (p.alive && !p.reloadUntil && p.ammo[p.weapon] < w.mag) { p.reloadUntil = now + w.reload - 80; p.reloading = p.weapon; }
        return;
      }
      case 'ping':
        p.ping = Math.max(0, Math.min(400, +a.rtt || 80));
        ctx.emit({ type: 'pong', c: a.c }, id);
        return;
      case 'shoot': {
        if (!p.alive || s.phase !== 'play') return;
        const w = WEAPONS[p.weapon];
        if (p.reloadUntil || p.ammo[p.weapon] <= 0 || now - p.lastShot < w.rate - 40) return;
        p.lastShot = now; p.ammo[p.weapon]--;
        p.protectUntil = 0; // tirer annule la protection d'apparition
        // origine : celle du client si elle est cohérente avec la position connue
        let o = [p.x, p.y + EYE, p.z];
        if (Array.isArray(a.o) && a.o.length === 3 && a.o.every(Number.isFinite) && Math.hypot(a.o[0] - o[0], a.o[1] - o[1], a.o[2] - o[2]) < 2) o = a.o;
        const dirs = (Array.isArray(a.dirs) ? a.dirs : []).slice(0, w.pellets);
        const t = now - Math.min(350, 100 + p.ping / 2); // instant vu par le tireur
        const targets = Object.values(s.players).filter(q => q.alive && q.id !== id).map(q => ({ q, pos: rewind(q, t) }));
        const dmgBy = new Map(); const ends = [];
        for (let d of dirs) {
          if (!Array.isArray(d) || d.length !== 3 || !d.every(Number.isFinite)) continue;
          const L = Math.hypot(...d); if (L < 1e-6) continue;
          d = d.map(v => v / L);
          let best = Math.min(rayWorld(o, d), w.range), hit = null, head = false;
          for (const { q, pos } of targets) {
            const th = raySphere(o, d, [pos.x, pos.y + 1.6, pos.z], 0.32);
            const tb = rayBox(o, d, pos.x - RADIUS, pos.y, pos.z - RADIUS, pos.x + RADIUS, pos.y + 1.42, pos.z + RADIUS);
            if (th < best) { best = th; hit = q; head = true; }
            if (tb < best) { best = tb; hit = q; head = false; }
          }
          ends.push([o[0] + d[0] * best, o[1] + d[1] * best, o[2] + d[2] * best, hit ? 1 : 0]);
          if (hit) {
            const e = dmgBy.get(hit) || { dmg: 0, head: false };
            e.dmg += w.dmg * (head ? w.head : 1); e.head ||= head;
            dmgBy.set(hit, e);
          }
        }
        ctx.emit({ type: 'shot', by: id, w: p.weapon, o, ends });
        for (const [q, e] of dmgBy) {
          const killed = damage(s, q, p, Math.round(e.dmg), p.weapon, e.head, ctx);
          ctx.emit({ type: 'hit', dmg: Math.round(e.dmg), head: e.head, kill: killed }, id);
        }
        return;
      }
    }
  },

  tick(s, dt, ctx) {
    const now = Date.now();
    if (s.phase === 'play' && now >= s.endsAt) endMatch(s, ctx);
    if (s.phase === 'end' && now >= s.restartAt) restart(s, ctx);
    for (const p of Object.values(s.players)) {
      if (!p.alive) { if (s.phase === 'play' && now >= p.respawnAt) spawn(s, p, now); continue; }
      p.hist.push({ t: now, x: p.x, y: p.y, z: p.z });
      while (p.hist.length && p.hist[0].t < now - 1000) p.hist.shift();
      if (p.reloadUntil && now >= p.reloadUntil) {
        if (p.reloading === p.weapon) p.ammo[p.weapon] = WEAPONS[p.weapon].mag;
        p.reloadUntil = 0;
      }
      if (p.y < -5) kill(s, p, null, 'fall', false, ctx);
      // bonus
      for (const pk of s.pickups) {
        if (!pk.active || Math.hypot(p.x - pk.x, p.z - pk.z) > 1.4 || Math.abs(p.y - pk.y) > 2) continue;
        if (pk.type === 'health' && p.hp < 100) p.hp = Math.min(100, p.hp + 50);
        else if (pk.type === 'armor' && p.armor < 100) p.armor = Math.min(100, p.armor + 50);
        else continue;
        pk.active = false; pk.respawnAt = now + 20000;
        ctx.emit({ type: 'pickup', id: pk.id, kind: pk.type }, p.id);
      }
    }
    for (const pk of s.pickups) if (!pk.active && now >= pk.respawnAt) pk.active = true;
  },

  view(s, id) {
    const me = s.players[id];
    return {
      phase: s.phase, left: Math.max(0, (s.phase === 'play' ? s.endsAt : s.restartAt) - Date.now()),
      fragLimit: s.fragLimit, winner: s.winner,
      players: Object.values(s.players).map(p => ({
        id: p.id, name: p.name, color: p.color, alive: p.alive, kills: p.kills, deaths: p.deaths, ping: p.ping, weapon: p.weapon,
        x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(3), pitch: +p.pitch.toFixed(3),
      })),
      pickups: s.pickups.filter(pk => pk.active).map(pk => pk.id),
      me: me && {
        hp: me.hp, armor: me.armor, ammo: me.ammo, reloading: !!me.reloadUntil, spawnN: me.spawnN, corrN: me.corrN,
        x: me.x, y: me.y, z: me.z, yaw: me.yaw, killer: me.killer, respawnIn: me.alive ? 0 : Math.max(0, me.respawnAt - Date.now()),
        protected: Date.now() < me.protectUntil,
      },
    };
  },

  staticData() { return { map: MAP, weapons: WEAPONS, eye: EYE, radius: RADIUS, height: HEIGHT }; },
};
