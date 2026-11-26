// =====================================================================
//  Moteur FPS commun (serveur) — utilisé par Arène Néon et Tactical Strike
//  - joueurs humains (déplacements validés) et bots (IA serveur)
//  - tirs instantanés avec compensation de latence, têtes, armure
//  - modes : match à mort libre ('ffa') ou manches en équipes ('rounds')
//  - capacités d'agents (dash, mur, soin, radar, grenade)
// =====================================================================
const U = require('./util');
const EYE = 1.6, RADIUS = 0.4, HEIGHT = 1.8;

const WEAPONS = {
  rifle:   { name: 'Fusil à impulsion', dmg: 20, head: 2,   rate: 100,  mag: 30, reload: 1600, pellets: 1, range: 200, spread: 0.012 },
  shotgun: { name: 'Fragmenteur',       dmg: 11, head: 1.5, rate: 850,  mag: 6,  reload: 2000, pellets: 9, range: 60,  spread: 0.085 },
  rail:    { name: 'Canon à rail',      dmg: 85, head: 2.5, rate: 1300, mag: 5,  reload: 2400, pellets: 1, range: 400, spread: 0.004 },
};
const AGENTS = {
  eclair:   { name: 'Éclair', icon: '⚡', color: '#facc15', ability: 'Ruée', desc: 'Fonce en avant à toute vitesse', cd: 9 },
  rempart:  { name: 'Rempart', icon: '🛡️', color: '#60a5fa', ability: 'Mur', desc: 'Dresse un mur d’énergie devant vous (10 s)', cd: 18 },
  medic:    { name: 'Infirmière', icon: '💉', color: '#4ade80', ability: 'Soin', desc: 'Soigne vous et vos alliés proches (+50)', cd: 16 },
  radar:    { name: 'Éclaireur', icon: '📡', color: '#c084fc', ability: 'Radar', desc: 'Révèle les ennemis à travers les murs (5 s)', cd: 20 },
  grenade:  { name: 'Grenadier', icon: '💣', color: '#fb923c', ability: 'Grenade', desc: 'Lance une grenade explosive', cd: 12 },
};
const BOT_NAMES = ['Viper', 'Orion', 'Nova', 'Spectre', 'Raptor', 'Echo', 'Falcon', 'Ghost', 'Blaze', 'Titan', 'Onyx', 'Lynx', 'Comet', 'Jinx', 'Raven'];

// ---------------- Géométrie ----------------
function rayBox(o, d, mn, mx) {
  let t0 = 0, t1 = Infinity;
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
  const b = ox * d[0] + oy * d[1] + oz * d[2], cc = ox * ox + oy * oy + oz * oz - r * r, h = b * b - cc;
  if (h < 0) return Infinity;
  const t = -b - Math.sqrt(h);
  return t >= 0 ? t : Infinity;
}
const boxMM = b => [[b.x - b.w / 2, b.y, b.z - b.d / 2], [b.x + b.w / 2, b.y + b.h, b.z + b.d / 2]];
function allBoxes(s) { return s.walls.length ? s.map.boxes.concat(s.walls) : s.map.boxes; }
function rayWorld(s, o, d) {
  let t = rayBox(o, d, [-1e4, -1e4, -1e4], [1e4, 0, 1e4]);
  for (const b of allBoxes(s)) { const [mn, mx] = boxMM(b); t = Math.min(t, rayBox(o, d, mn, mx)); }
  return t;
}
function insideBox(s, x, y, z) {
  return allBoxes(s).some(b => x > b.x - b.w / 2 + 0.05 && x < b.x + b.w / 2 - 0.05 && z > b.z - b.d / 2 + 0.05 && z < b.z + b.d / 2 - 0.05 && y + 0.5 > b.y && y + 0.5 < b.y + b.h);
}
function boxTop(map, x, z) { let top = 0; for (const b of map.boxes) if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) top = Math.max(top, b.y + b.h); return top; }
function los(s, a, b) { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d); return rayWorld(s, a, d.map(v => v / L)) >= L - 0.3; }

// Grille de navigation au sol pour les bots
function buildNav(map) {
  const half = map.size / 2, N = map.size, block = new Uint8Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = -half + i + 0.5, z = -half + j + 0.5;
    if (map.boxes.some(b => b.y < 1 && b.h > 0.6 && Math.abs(x - b.x) < b.w / 2 + 0.55 && Math.abs(z - b.z) < b.d / 2 + 0.55)) block[i * N + j] = 1;
  }
  return { N, half, block };
}
function navPath(nav, from, to) {
  const { N, half, block } = nav;
  const ci = v => U.clamp(Math.floor(v + half), 0, N - 1);
  const s = ci(from.x) * N + ci(from.z), g = ci(to.x) * N + ci(to.z);
  const prev = new Int32Array(N * N).fill(-1), q = new Int32Array(N * N); let qh = 0, qt = 0;
  q[qt++] = s; prev[s] = s;
  while (qh < qt) {
    const c = q[qh++]; if (c === g) break;
    const i = (c / N) | 0, j = c % N;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const n = ni * N + nj; if (prev[n] >= 0 || (block[n] && n !== g)) continue;
      if (di && dj && (block[ni * N + j] || block[i * N + nj])) continue;
      prev[n] = c; q[qt++] = n;
    }
  }
  if (prev[g] < 0) return null;
  const path = []; let c = g;
  while (c !== s) { path.push({ x: -half + ((c / N) | 0) + 0.5, z: -half + (c % N) + 0.5 }); c = prev[c]; }
  return path.reverse().filter((_, i, a) => i % 2 === 1 || i === a.length - 1);
}

// =====================================================================
module.exports = function makeFps(cfg) {
  const TICK = 20;
  const teams = cfg.mode === 'rounds';

  function fullAmmo() { return Object.fromEntries(Object.entries(WEAPONS).map(([k, w]) => [k, w.mag])); }
  function newPlayer(s, p, team) {
    return { id: p.id, name: p.name, color: p.color, bot: !!p.bot, team, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, hp: 100, armor: 0, alive: false, respawnAt: 0,
      kills: 0, deaths: 0, streak: 0, assists: 0, weapon: p.bot ? U.pick(['rifle', 'rifle', 'shotgun', 'rail']) : 'rifle', ammo: fullAmmo(), reloadUntil: 0, lastShot: 0,
      spawnN: 0, corrN: 0, lastMove: 0, protectUntil: 0, ping: 80, hist: [], killer: null, agent: p.bot ? U.pick(Object.keys(AGENTS)) : null, abilityAt: 0, dashUntil: 0,
      ai: p.bot ? { path: null, pathT: 0, target: null, seenAt: 0, react: 0, strafe: 1, strafeT: 0, goal: null, jitter: 0 } : null };
  }
  function spawnPoint(s, p) {
    if (teams) { const list = s.map.teamSpawns[p.team]; const used = s.players.filter(q => q.alive && q.team === p.team).length; return list[used % list.length]; }
    const enemies = s.players.filter(o => o.alive && o.id !== p.id);
    let best = s.map.spawns[0], bestD = -1;
    for (const sp of s.map.spawns) { const d = (enemies.length ? Math.min(...enemies.map(e => Math.hypot(e.x - sp.x, e.z - sp.z))) : 50) + Math.random() * 6; if (d > bestD) { bestD = d; best = sp; } }
    return best;
  }
  function spawn(s, p, now) {
    const sp = spawnPoint(s, p);
    Object.assign(p, { x: sp.x + (teams ? U.rand(-0.6, 0.6) : 0), z: sp.z + (teams ? U.rand(-0.6, 0.6) : 0), y: boxTop(s.map, sp.x, sp.z), yaw: sp.yaw ?? Math.atan2(sp.x, sp.z), pitch: 0, hp: 100, armor: teams ? 50 : 0, alive: true,
      ammo: fullAmmo(), reloadUntil: 0, lastMove: now, protectUntil: now + (teams ? 0 : 1500), hist: [], killer: null, abilityAt: teams ? 0 : p.abilityAt });
    if (p.ai) Object.assign(p.ai, { path: null, target: null, react: 0 });
    p.spawnN++;
  }
  function kill(s, victim, killer, weapon, head, ctx) {
    victim.alive = false; victim.hp = 0; victim.deaths++; victim.streak = 0;
    victim.respawnAt = Date.now() + (cfg.respawn ?? 3000);
    victim.killer = killer ? killer.id : null;
    if (killer && killer !== victim) { killer.kills++; killer.streak++; if (!teams && killer.kills >= s.fragLimit) endMatch(s, ctx); }
    else if (!teams) victim.kills = Math.max(0, victim.kills - 1);
    ctx.emit({ type: 'kill', killer: killer?.id || null, victim: victim.id, weapon, head, streak: killer?.streak || 0, x: victim.x, y: victim.y, z: victim.z });
  }
  function damage(s, victim, attacker, amount, weapon, head, ctx) {
    const now = Date.now();
    if (!victim.alive || now < victim.protectUntil) return false;
    if (teams && attacker && attacker !== victim && attacker.team === victim.team) return false;
    const absorbed = Math.min(victim.armor, Math.round(amount * 0.6));
    victim.armor -= absorbed; victim.hp -= amount - absorbed;
    if (attacker && victim.ai) { victim.ai.target = attacker.id; victim.ai.seenAt = now; }
    if (attacker) ctx.emit({ type: 'hurt', from: [attacker.x, attacker.y + EYE, attacker.z], dmg: amount }, victim.id);
    if (victim.hp <= 0) { kill(s, victim, attacker, weapon, head, ctx); return true; }
    return false;
  }
  function endMatch(s, ctx) {
    if (s.phase === 'end' || s.phase === 'over') return;
    if (teams) { s.phase = 'over'; s.over = true; s.winnerTeam = s.score[0] > s.score[1] ? 0 : 1; ctx.emit({ type: 'matchEnd', winnerTeam: s.winnerTeam }); return; }
    s.phase = 'end'; s.restartAt = Date.now() + 12000; s.matchNo = (s.matchNo || 0) + 1;
    const ranking = s.players.slice().sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    s.winner = ranking[0]?.id || null;
    ctx.emit({ type: 'matchEnd', winner: s.winner });
  }
  function restartFfa(s, ctx) {
    s.phase = 'play'; s.endsAt = Date.now() + s.matchTime; s.winner = null;
    for (const p of s.players) { p.kills = 0; p.deaths = 0; p.streak = 0; spawn(s, p, Date.now()); }
    s.pickups.forEach(pk => { pk.active = true; });
    ctx.emit({ type: 'matchStart' });
  }
  // ---- manches ----
  function startRound(s, ctx) {
    s.round++; s.phase = 'buy'; s.phaseEnd = Date.now() + s.buyTime * 1000; s.capture = { team: null, k: 0 }; s.walls = []; s.nades = [];
    for (const p of s.players) spawn(s, p, Date.now());
    ctx.emit({ type: 'round', n: s.round });
  }
  function endRound(s, winnerTeam, why, ctx) {
    if (s.phase !== 'live') return;
    if (winnerTeam != null) s.score[winnerTeam]++;
    s.lastRound = { team: winnerTeam, why };
    ctx.emit({ type: 'roundEnd', team: winnerTeam, why, score: s.score });
    if (s.score[0] >= s.toWin || s.score[1] >= s.toWin) { endMatch(s, ctx); return; }
    s.phase = 'post'; s.phaseEnd = Date.now() + 5000;
  }

  function rewind(p, t) {
    const h = p.hist; if (!h.length) return p;
    for (let k = h.length - 1; k >= 0; k--) if (h[k].t <= t) { const a = h[k], b = h[k + 1]; if (!b) return a; const f = (t - a.t) / (b.t - a.t); return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f }; }
    return h[0];
  }
  function shoot(s, p, o, dirs, ctx) {
    const now = Date.now(), w = WEAPONS[p.weapon];
    const t = p.bot ? now : now - Math.min(350, 100 + p.ping / 2);
    const targets = s.players.filter(q => q.alive && q.id !== p.id && !(teams && q.team === p.team)).map(q => ({ q, pos: p.bot ? q : rewind(q, t) }));
    const dmgBy = new Map(), ends = [];
    for (let d of dirs) {
      if (!Array.isArray(d) || d.length !== 3 || !d.every(Number.isFinite)) continue;
      const L = Math.hypot(...d); if (L < 1e-6) continue; d = d.map(v => v / L);
      let best = Math.min(rayWorld(s, o, d), w.range), hit = null, head = false;
      for (const { q, pos } of targets) {
        const th = raySphere(o, d, [pos.x, pos.y + 1.6, pos.z], 0.32);
        const tb = rayBox(o, d, [pos.x - RADIUS, pos.y, pos.z - RADIUS], [pos.x + RADIUS, pos.y + 1.42, pos.z + RADIUS]);
        if (th < best) { best = th; hit = q; head = true; }
        if (tb < best) { best = tb; hit = q; head = false; }
      }
      ends.push([U.r2(o[0] + d[0] * best), U.r2(o[1] + d[1] * best), U.r2(o[2] + d[2] * best), hit ? 1 : 0]);
      if (hit) { const e = dmgBy.get(hit) || { dmg: 0, head: false }; e.dmg += w.dmg * (head ? w.head : 1) * s.dmgMul; e.head ||= head; dmgBy.set(hit, e); }
    }
    ctx.emit({ type: 'shot', by: p.id, w: p.weapon, o: o.map(U.r2), ends });
    for (const [q, e] of dmgBy) { const killed = damage(s, q, p, Math.round(e.dmg), p.weapon, e.head, ctx); if (!p.bot) ctx.emit({ type: 'hit', dmg: Math.round(e.dmg), head: e.head, kill: killed }, p.id); }
  }
  function canFire(s, p, now) { const w = WEAPONS[p.weapon]; return p.alive && !p.reloadUntil && p.ammo[p.weapon] > 0 && now - p.lastShot >= w.rate - 40 && (s.phase === 'play' || s.phase === 'live'); }

  function useAbility(s, p, ctx, now) {
    if (!teams || !p.agent || !p.alive || s.phase !== 'live') return;
    const A = AGENTS[p.agent]; if (now < p.abilityAt) return;
    p.abilityAt = now + A.cd * 1000;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    if (p.agent === 'eclair') { p.dashUntil = now + 450; if (p.bot) { p.x += fx * 4; p.z += fz * 4; } }
    if (p.agent === 'rempart') { const alongX = Math.abs(fx) < Math.abs(fz); s.walls.push({ id: s.nid++, x: p.x + fx * 2.2, y: 0, z: p.z + fz * 2.2, w: alongX ? 4 : 0.4, h: 2.6, d: alongX ? 0.4 : 4, c: 'cyan', until: now + 10000, team: p.team, wall: true }); }
    if (p.agent === 'medic') for (const q of s.players) if (q.alive && q.team === p.team && Math.hypot(q.x - p.x, q.z - p.z) < 8) { q.hp = Math.min(100, q.hp + 50); ctx.emit({ type: 'healed', id: q.id }); }
    if (p.agent === 'radar') s.reveal[1 - p.team] = now + 5000;
    if (p.agent === 'grenade') { const sp = 18, cp = Math.cos(p.pitch); s.nades.push({ id: s.nid++, x: p.x + fx, y: p.y + EYE, z: p.z + fz, vx: fx * cp * sp, vy: Math.sin(p.pitch) * sp + 4, vz: fz * cp * sp, t: 1.8, owner: p.id }); }
    ctx.emit({ type: 'ability', id: p.id, agent: p.agent, x: p.x, y: p.y, z: p.z });
  }

  // ---------------- IA des bots ----------------
  function botThink(s, p, dt, now, ctx) {
    const ai = p.ai, eye = [p.x, p.y + EYE, p.z];
    if (s.phase === 'buy') return;
    // cible visible la plus proche
    let tgt = null, best = 70;
    for (const q of s.players) {
      if (!q.alive || q === p || (teams && q.team === p.team)) continue;
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < best && los(s, eye, [q.x, q.y + 1.2, q.z])) { best = d; tgt = q; }
    }
    if (tgt) { if (ai.target !== tgt.id) { ai.target = tgt.id; ai.react = now + U.rand(250, 650) / s.botSkill; } ai.seenAt = now; }
    else if (now - ai.seenAt > 2500) ai.target = null;
    const t = s.players.find(q => q.id === ai.target && q.alive);
    let moveTo = null;
    if (t) {
      const dx = t.x - p.x, dz = t.z - p.z, dy = (t.y + 1.25) - (p.y + EYE), d = Math.hypot(dx, dz);
      const wantYaw = Math.atan2(-dx, -dz), wantPitch = Math.atan2(dy, d);
      const turn = 6 * s.botSkill * dt;
      p.yaw += U.clamp(U.angDiff(p.yaw, wantYaw), -turn, turn); p.pitch += U.clamp(wantPitch - p.pitch, -turn, turn);
      if (tgt && now > ai.react && Math.abs(U.angDiff(p.yaw, wantYaw)) < 0.12 && canFire(s, p, now)) {
        const w = WEAPONS[p.weapon]; p.lastShot = now; p.ammo[p.weapon]--;
        const err = (0.06 / s.botSkill) * (1 + d / 40), dirs = [];
        for (let k = 0; k < w.pellets; k++) {
          const yaw = p.yaw + (Math.random() - 0.5) * (err + w.spread * 2), pitch = p.pitch + (Math.random() - 0.5) * (err + w.spread * 2);
          dirs.push([-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)]);
        }
        shoot(s, p, eye, dirs, ctx);
      }
      if (p.ammo[p.weapon] <= 0 && !p.reloadUntil) p.reloadUntil = now + WEAPONS[p.weapon].reload;
      // déplacement de combat
      ai.strafeT -= dt; if (ai.strafeT <= 0) { ai.strafe = U.chance(0.5) ? 1 : -1; ai.strafeT = U.rand(0.5, 1.5); }
      const ideal = p.weapon === 'shotgun' ? 6 : p.weapon === 'rail' ? 30 : 15;
      const fw = d > ideal + 4 ? 1 : d < ideal - 4 ? -1 : 0;
      const yaw = Math.atan2(-dx, -dz), fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      moveTo = { x: p.x + (fx * fw + fz * ai.strafe) * 3, z: p.z + (fz * fw - fx * ai.strafe) * 3, direct: true };
      if (teams && p.agent && now > p.abilityAt && U.chance(0.02)) useAbility(s, p, ctx, now);
    } else {
      // objectif : zone (équipes) ou errance
      if (!ai.goal || Math.hypot(ai.goal.x - p.x, ai.goal.z - p.z) < 2 || U.chance(dt * 0.05)) {
        if (teams && s.map.zone) { const a = Math.random() * 6.28, r = Math.random() * s.map.zone.r; ai.goal = { x: s.map.zone.x + Math.cos(a) * r, z: s.map.zone.z + Math.sin(a) * r }; }
        else { const sp = U.pick(s.map.spawns); ai.goal = { x: sp.x, z: sp.z }; }
        ai.path = null;
      }
      moveTo = ai.goal;
      if (p.agent === 'medic' && p.hp < 60 && now > p.abilityAt) useAbility(s, p, ctx, now);
    }
    // suivi de chemin
    let dir = null;
    if (moveTo.direct) dir = { x: moveTo.x - p.x, z: moveTo.z - p.z };
    else {
      ai.pathT -= dt;
      if (!ai.path || ai.pathT <= 0) { ai.path = navPath(s.nav, p, moveTo) || []; ai.pathT = 1.5; }
      while (ai.path.length && Math.hypot(ai.path[0].x - p.x, ai.path[0].z - p.z) < 0.8) ai.path.shift();
      const n = ai.path[0] || moveTo; dir = { x: n.x - p.x, z: n.z - p.z };
      if (!t) { const yaw = Math.atan2(-dir.x, -dir.z); p.yaw += U.clamp(U.angDiff(p.yaw, yaw), -4 * dt, 4 * dt); p.pitch *= 0.9; }
    }
    const L = Math.hypot(dir.x, dir.z);
    if (L > 0.2) {
      const sp = 7.5 * (p.dashUntil > now ? 2.4 : 1) * dt;
      const nx = p.x + dir.x / L * sp, nz = p.z + dir.z / L * sp;
      const blocked = allBoxes(s).some(b => b.y < 1 && b.h > 0.6 && Math.abs(nx - b.x) < b.w / 2 + RADIUS && Math.abs(nz - b.z) < b.d / 2 + RADIUS);
      const lim = s.map.size / 2 - 1;
      if (!blocked) { p.x = U.clamp(nx, -lim, lim); p.z = U.clamp(nz, -lim, lim); } else if (ai) { ai.path = null; ai.strafe *= -1; }
    }
    p.y = 0; p.lastMove = now;
  }

  // ---------------- Module de jeu ----------------
  return {
    id: cfg.id, name: cfg.name, description: cfg.description, category: cfg.category, icon: cfg.icon, color: cfg.color, order: cfg.order,
    tags: cfg.tags, rules: cfg.rules, settings: cfg.settings,
    minPlayers: cfg.minPlayers ?? 1, maxPlayers: cfg.maxPlayers ?? 16, tickRate: TICK, joinInProgress: true,

    create(players, ctx, o) {
      const map = cfg.buildMap(o);
      const s = { map, nav: buildNav(map), players: [], phase: teams ? 'buy' : 'play', nid: 1, walls: [], nades: [], reveal: [0, 0],
        fragLimit: o.fragLimit || 25, matchTime: (o.time || 6) * 60000, endsAt: Date.now() + (o.time || 6) * 60000, winner: null, restartAt: 0,
        pickups: (map.pickups || []).map(pk => ({ ...pk, active: true, respawnAt: 0 })), dmgMul: o.dmg || 1, botSkill: { facile: 0.6, normal: 1, fort: 1.5 }[o.botLevel || 'normal'],
        score: [0, 0], round: 0, toWin: o.toWin || 5, buyTime: 8, roundTime: (o.roundTime || 100), capture: { team: null, k: 0 }, captureTime: 8, over: false };
      players.forEach((p, i) => s.players.push(newPlayer(s, p, teams ? i % 2 : 0)));
      const size = teams ? Math.max(o.teamSize || 5, Math.ceil(players.length / 2)) : 0;
      let nb = 0;
      if (teams) { if (o.bots !== false) for (const t of [0, 1]) while (s.players.filter(p => p.team === t).length < size) s.players.push(newPlayer(s, { id: 'bot' + (nb), name: BOT_NAMES[nb++ % BOT_NAMES.length], color: '#94a3b8', bot: true }, t)); }
      else for (let i = 0; i < (o.bots || 0); i++) s.players.push(newPlayer(s, { id: 'bot' + i, name: BOT_NAMES[i % BOT_NAMES.length], color: ['#94a3b8', '#a8a29e', '#9ca3af'][i % 3], bot: true }, 0));
      if (teams) startRound(s, ctx); else for (const p of s.players) spawn(s, p, Date.now());
      return s;
    },
    onJoin(s, p, ctx) {
      let team = 0;
      if (teams) { team = s.players.filter(q => q.team === 0).length <= s.players.filter(q => q.team === 1).length ? 0 : 1; const bot = s.players.find(q => q.bot && q.team === team); if (bot) s.players = s.players.filter(q => q !== bot); }
      const np = newPlayer(s, p, team); s.players.push(np);
      if (!teams || s.phase === 'buy') spawn(s, np, Date.now()); else { np.alive = false; np.respawnAt = Infinity; }
      ctx.emit({ type: 'info', text: `${p.name} rejoint la partie` });
    },
    onLeave(s, id, ctx) { const p = s.players.find(q => q.id === id); if (!p) return; s.players = s.players.filter(q => q.id !== id); ctx.emit({ type: 'info', text: `${p.name} est parti` }); },

    onAction(s, id, a, ctx) {
      const p = s.players.find(q => q.id === id); if (!p) return;
      const now = Date.now();
      switch (a.type) {
        case 'move': {
          if (!p.alive || !(s.phase === 'play' || s.phase === 'live' || s.phase === 'buy')) return;
          const x = +a.x, y = +a.y, z = +a.z;
          if (![x, y, z, +a.yaw, +a.pitch].every(Number.isFinite)) return;
          const dt = Math.min(1, Math.max(0.016, (now - p.lastMove) / 1000));
          const horiz = Math.hypot(x - p.x, z - p.z), vert = Math.abs(y - p.y), H = s.map.size / 2;
          const speedCap = (p.dashUntil > now - 200 ? 40 : 17);
          let ok = horiz <= speedCap * dt + 1.2 && vert <= 20 * dt + 1.5 && Math.abs(x) < H && Math.abs(z) < H && y > -1 && y < 30 && !insideBox(s, x, y, z);
          if (s.phase === 'buy' && horiz > 0.05) ok = false; // figé pendant la préparation
          if (!ok) { p.corrN++; p.lastMove = now; return; }
          Object.assign(p, { x, y, z, yaw: +a.yaw, pitch: U.clamp(+a.pitch, -1.6, 1.6), lastMove: now });
          return;
        }
        case 'weapon': if (WEAPONS[a.w] && a.w !== p.weapon) { p.weapon = a.w; p.reloadUntil = 0; } return;
        case 'reload': { const w = WEAPONS[p.weapon]; if (p.alive && !p.reloadUntil && p.ammo[p.weapon] < w.mag) p.reloadUntil = now + w.reload - 80; return; }
        case 'ping': p.ping = U.clamp(+a.rtt || 80, 0, 400); ctx.emit({ type: 'pong', c: a.c }, id); return;
        case 'agent': if (teams && AGENTS[a.agent] && (s.phase === 'buy' || !p.agent)) p.agent = a.agent; return;
        case 'ability': useAbility(s, p, ctx, now); return;
        case 'shoot': {
          if (!canFire(s, p, now)) return;
          p.lastShot = now; p.ammo[p.weapon]--; p.protectUntil = 0;
          let o = [p.x, p.y + EYE, p.z];
          if (Array.isArray(a.o) && a.o.length === 3 && a.o.every(Number.isFinite) && Math.hypot(a.o[0] - o[0], a.o[1] - o[1], a.o[2] - o[2]) < 2) o = a.o;
          shoot(s, p, o, (Array.isArray(a.dirs) ? a.dirs : []).slice(0, WEAPONS[p.weapon].pellets), ctx);
          return;
        }
      }
    },

    tick(s, dt, ctx) {
      const now = Date.now();
      if (s.over) return;
      if (!teams) {
        if (s.phase === 'play' && now >= s.endsAt) endMatch(s, ctx);
        if (s.phase === 'end' && now >= s.restartAt) restartFfa(s, ctx);
      } else {
        if (s.phase === 'buy' && now >= s.phaseEnd) { s.phase = 'live'; s.phaseEnd = now + s.roundTime * 1000; ctx.emit({ type: 'live' }); }
        else if (s.phase === 'post' && now >= s.phaseEnd) startRound(s, ctx);
        else if (s.phase === 'live') {
          const alive = [0, 1].map(t => s.players.filter(p => p.team === t && p.alive).length);
          if (!alive[0] || !alive[1]) endRound(s, alive[0] ? 0 : alive[1] ? 1 : null, 'elimination', ctx);
          else if (now >= s.phaseEnd) endRound(s, alive[0] === alive[1] ? null : alive[0] > alive[1] ? 0 : 1, 'time', ctx);
          else if (s.map.zone) {
            const z = s.map.zone, inZ = [0, 1].map(t => s.players.filter(p => p.team === t && p.alive && Math.hypot(p.x - z.x, p.z - z.z) < z.r).length);
            const c = s.capture;
            if (inZ[0] && !inZ[1]) { if (c.team !== 0) { c.team = 0; c.k = 0; } c.k += dt / s.captureTime; }
            else if (inZ[1] && !inZ[0]) { if (c.team !== 1) { c.team = 1; c.k = 0; } c.k += dt / s.captureTime; }
            else if (!inZ[0] && !inZ[1]) c.k = Math.max(0, c.k - dt / s.captureTime / 2);
            if (c.k >= 1) endRound(s, c.team, 'zone', ctx);
          }
        }
      }
      for (const p of s.players) {
        if (!p.alive) { if (!teams && s.phase === 'play' && now >= p.respawnAt) spawn(s, p, now); continue; }
        if (p.bot) botThink(s, p, dt, now, ctx);
        p.hist.push({ t: now, x: p.x, y: p.y, z: p.z });
        while (p.hist.length && p.hist[0].t < now - 1000) p.hist.shift();
        if (p.reloadUntil && now >= p.reloadUntil) { p.ammo[p.weapon] = WEAPONS[p.weapon].mag; p.reloadUntil = 0; }
        if (p.y < -5) kill(s, p, null, 'fall', false, ctx);
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
      // grenades
      for (const n of s.nades) {
        n.vy -= 22 * dt; n.x += n.vx * dt; n.y += n.vy * dt; n.z += n.vz * dt; n.t -= dt;
        if (n.y < 0.15) { n.y = 0.15; n.vy *= -0.4; n.vx *= 0.7; n.vz *= 0.7; }
        if (insideBox(s, n.x, n.y - 0.5, n.z)) { n.x -= n.vx * dt; n.z -= n.vz * dt; n.vx *= -0.5; n.vz *= -0.5; }
        if (n.t <= 0) {
          n.done = true; ctx.emit({ type: 'boom', x: n.x, y: n.y, z: n.z });
          const owner = s.players.find(q => q.id === n.owner);
          for (const q of s.players) { const d = Math.hypot(q.x - n.x, q.y + 1 - n.y, q.z - n.z); if (q.alive && d < 6 && los(s, [n.x, n.y + 0.3, n.z], [q.x, q.y + 1, q.z])) damage(s, q, owner, Math.round(95 * (1 - d / 6)), 'grenade', false, ctx); }
        }
      }
      s.nades = s.nades.filter(n => !n.done);
      s.walls = s.walls.filter(w => w.until > now);
    },

    results(s) {
      const key = teams ? (s.over ? 'over' : null) : (s.phase === 'end' ? 'm' + s.matchNo : null);
      if (!key) return null;
      const players = teams ? s.players.map(p => ({ id: p.id, place: p.team === s.winnerTeam ? 1 : 2, win: p.team === s.winnerTeam, score: `${p.kills}/${p.deaths}` }))
        : U.rank(s.players.map(p => ({ id: p.id, score: p.kills, win: p.id === s.winner })));
      return { key, players, records: s.players.map(p => ({ id: p.id, key: (cfg.id) + ':kills', value: p.kills })) };
    },
    view(s, id) {
      const me = s.players.find(p => p.id === id), now = Date.now();
      const left = teams ? Math.max(0, (s.phaseEnd || 0) - now) : Math.max(0, (s.phase === 'play' ? s.endsAt : s.restartAt) - now);
      return {
        mode: cfg.mode, phase: s.phase, left, fragLimit: s.fragLimit, winner: s.winner, score: s.score, round: s.round, toWin: s.toWin, over: s.over, winnerTeam: s.winnerTeam,
        capture: s.capture, lastRound: s.lastRound,
        players: s.players.map(p => ({ id: p.id, name: p.name, color: p.color, team: p.team, bot: p.bot, alive: p.alive, kills: p.kills, deaths: p.deaths, ping: p.bot ? 0 : p.ping, weapon: p.weapon, agent: p.agent, hp: teams && me && p.team === me.team ? p.hp : undefined,
          revealed: teams && me && p.team !== me.team && s.reveal[p.team] > now,
          x: U.r2(p.x), y: U.r2(p.y), z: U.r2(p.z), yaw: U.r2(p.yaw), pitch: U.r2(p.pitch) })),
        pickups: s.pickups.filter(pk => pk.active).map(pk => pk.id),
        walls: s.walls.map(w => ({ id: w.id, x: w.x, z: w.z, w: w.w, h: w.h, d: w.d, team: w.team })),
        nades: s.nades.map(n => [n.id, U.r2(n.x), U.r2(n.y), U.r2(n.z)]),
        me: me && { hp: me.hp, armor: me.armor, ammo: me.ammo, reloading: !!me.reloadUntil, spawnN: me.spawnN, corrN: me.corrN, team: me.team, agent: me.agent,
          x: me.x, y: me.y, z: me.z, yaw: me.yaw, killer: me.killer, respawnIn: me.alive ? 0 : Math.max(0, Math.min(99999, me.respawnAt - now)), protected: now < me.protectUntil,
          abilityIn: Math.max(0, me.abilityAt - now), dash: me.dashUntil > now },
      };
    },
    staticData(s) { return { map: s.map, weapons: WEAPONS, agents: AGENTS, eye: EYE, radius: RADIUS, height: HEIGHT, mode: cfg.mode, theme: cfg.theme || 'neon' }; },
  };
};
module.exports.WEAPONS = WEAPONS;
module.exports.AGENTS = AGENTS;
