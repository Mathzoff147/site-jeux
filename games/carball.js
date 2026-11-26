// =====================================================================
//  CAR FOOTBALL — règles (serveur)
//  Deux équipes de voitures, un ballon géant. Turbo, dash, pastilles de
//  boost, prolongation « but en or ». Bots pour compléter les équipes.
// =====================================================================
const U = require('./lib/util');
const W = 2200, H = 1300, GOAL = 340, TICK = 30;
const PADS = [
  ...[[110, 110], [W - 110, 110], [110, H - 110], [W - 110, H - 110], [W / 2, 90], [W / 2, H - 90]].map(([x, y]) => ({ x, y, big: true })),
  ...[[500, 350], [500, H - 350], [W - 500, 350], [W - 500, H - 350], [800, H / 2], [W - 800, H / 2], [W / 2, 400], [W / 2, H - 400], [300, H / 2], [W - 300, H / 2]].map(([x, y]) => ({ x, y, big: false })),
].map((p, i) => ({ ...p, id: i, t: 0 }));
const BOT_NAMES = ['Robo Rapide', 'Bolide', 'Nitro', 'Piston', 'Turbine', 'Châssis', 'Volant', 'Jante'];

function kickoffPositions(s) {
  const spots = [[-1, 0, 0], [-1, -250, 300], [-1, 250, 300], [-1, 0, 650]];
  for (const team of [0, 1]) {
    const cars = s.cars.filter(c => c.team === team);
    cars.forEach((c, i) => {
      const [, dy, back] = spots[i % spots.length];
      const dir = team === 0 ? 1 : -1;
      c.x = W / 2 - dir * (300 + back * 0.6 + Math.floor(i / 4) * 80); c.y = H / 2 + dy;
      c.a = team === 0 ? 0 : Math.PI; c.v = 0; c.vx = 0; c.vy = 0; c.boost = Math.max(c.boost, 34);
    });
  }
  Object.assign(s.ball, { x: W / 2, y: H / 2, vx: 0, vy: 0, spin: 0 });
  s.phase = 'kickoff'; s.timer = 3;
}

module.exports = {
  id: 'carball',
  name: 'Car Football',
  description: 'Du football… avec des voitures à turbo ! Deux équipes, un ballon géant, des buts spectaculaires.',
  category: 'Sport', icon: '🚗', color: '#2563eb', order: 11,
  tags: ['⚽ Équipes', '🤖 Bots'],
  rules: `<ul><li><kbd>Z</kbd>/<kbd>↑</kbd> accélérer · <kbd>S</kbd>/<kbd>↓</kbd> reculer · <kbd>Q</kbd><kbd>D</kbd> tourner</li>
    <li><kbd>Maj</kbd> ou <b>clic droit</b> : turbo (ramassez les pastilles orange) · <kbd>Espace</kbd> ou <b>clic</b> : dash (frappe puissante)</li>
    <li>Poussez le ballon dans le but adverse ! L’équipe <b style="color:#60a5fa">bleue</b> attaque à droite, l’<b style="color:#fb923c">orange</b> à gauche.</li>
    <li>Égalité à la fin ? Prolongation : le prochain but gagne !</li></ul>`,
  settings: [
    { key: 'time', label: 'Durée du match', type: 'select', default: 180, options: [{ v: 120, l: '2 min' }, { v: 180, l: '3 min' }, { v: 300, l: '5 min' }, { v: 600, l: '10 min' }] },
    { key: 'teamSize', label: 'Joueurs par équipe (avec bots)', type: 'select', default: 3, options: [{ v: 1, l: '1 contre 1' }, { v: 2, l: '2 contre 2' }, { v: 3, l: '3 contre 3' }, { v: 4, l: '4 contre 4' }] },
    { key: 'bots', label: 'Compléter avec des bots', type: 'toggle', default: true },
    { key: 'botLevel', label: 'Niveau des bots', type: 'select', default: 'normal', options: [{ v: 'facile', l: 'Facile' }, { v: 'normal', l: 'Normal' }, { v: 'pro', l: 'Pro' }] },
    { key: 'ball', label: 'Ballon', type: 'select', default: 'normal', options: [{ v: 'petit', l: 'Petit et rapide' }, { v: 'normal', l: 'Normal' }, { v: 'geant', l: 'Géant' }] },
    { key: 'infinite', label: 'Turbo illimité', type: 'toggle', default: false },
  ],
  minPlayers: 1, maxPlayers: 8, tickRate: TICK, joinInProgress: true,

  create(players, ctx, o) {
    const size = Math.max(o.teamSize || 3, Math.ceil(players.length / 2));
    const s = { cars: [], ball: { x: W / 2, y: H / 2, vx: 0, vy: 0, r: { petit: 22, normal: 32, geant: 52 }[o.ball || 'normal'], spin: 0 }, ballSpeed: o.ball === 'petit' ? 1.25 : o.ball === 'geant' ? 0.8 : 1,
      score: [0, 0], time: o.time || 180, phase: 'kickoff', timer: 3, overtime: false, over: false, pads: PADS.map(p => ({ ...p })), infinite: !!o.infinite, botLevel: o.botLevel || 'normal', size, useBots: o.bots !== false, lastTouch: null, stats: {} };
    U.shuffle(players.slice()).forEach((p, i) => s.cars.push(newCar(p, i % 2)));
    fillBots(s);
    kickoffPositions(s);
    return s;
  },
  onJoin(s, p) {
    const bot = s.cars.find(c => c.bot && c.team === (countTeam(s, 0) <= countTeam(s, 1) ? 0 : 1)) || s.cars.find(c => c.bot);
    const team = bot ? bot.team : countTeam(s, 0) <= countTeam(s, 1) ? 0 : 1;
    if (bot) s.cars = s.cars.filter(c => c !== bot);
    const c = newCar(p, team); c.x = team ? W - 200 : 200; c.y = H / 2; s.cars.push(c);
  },
  onLeave(s, id) { const c = s.cars.find(x => x.id === id); s.cars = s.cars.filter(x => x.id !== id); if (c) fillBots(s); },

  onAction(s, id, a) {
    const c = s.cars.find(x => x.id === id); if (!c) return;
    if (a.type === 'in') c.input = { ...U.readInput(a), boost: !!a.boost, dash: !!a.dash };
    if (a.type === 'team' && s.phase === 'kickoff') { c.team = 1 - c.team; c.color = c.team ? '#fb923c' : '#60a5fa'; }
  },

  tick(s, dt, ctx) {
    if (s.over) return;
    if (s.phase === 'kickoff') { const b = Math.ceil(s.timer); s.timer -= dt; if (Math.ceil(s.timer) !== b && s.timer > 0) ctx.emit({ type: 'count', n: Math.ceil(s.timer) }); if (s.timer <= 0) { s.phase = 'play'; ctx.emit({ type: 'go' }); } }
    else if (s.phase === 'goal') { s.timer -= dt; if (s.timer <= 0) { if (s.overtime) { s.over = true; ctx.emit({ type: 'end' }); return; } kickoffPositions(s); } }
    else if (s.phase === 'play') {
      if (!s.overtime) { s.time -= dt; if (s.time <= 0) { s.time = 0; if (s.score[0] !== s.score[1]) { s.over = true; ctx.emit({ type: 'end' }); return; } s.overtime = true; ctx.emit({ type: 'overtime' }); kickoffPositions(s); } }
    }
    const play = s.phase !== 'kickoff';
    const b = s.ball;
    for (const c of s.cars) {
      if (c.bot) botDrive(s, c, dt);
      const inp = c.input || {};
      const boosting = inp.boost && (c.boost > 0 || s.infinite) && play;
      if (boosting && !s.infinite) c.boost = Math.max(0, c.boost - 33 * dt);
      c.boosting = boosting;
      const maxV = boosting ? 760 : 470;
      let acc = 0;
      if (play) { if (inp.u) acc = 700; if (inp.d) acc = c.v > 30 ? -1200 : -420; if (boosting) acc = Math.max(acc, 1100); }
      c.v += acc * dt; if (!acc) c.v *= Math.pow(0.4, dt);
      c.v = U.clamp(c.v, -260, Math.max(maxV, c.v * Math.pow(0.4, dt))); if (c.v > maxV) c.v = U.lerp(c.v, maxV, dt * 2);
      const steer = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
      c.a += steer * 3.2 * dt * U.clamp(Math.abs(c.v) / 200, 0.25, 1) * Math.sign(c.v || 1);
      c.dashCd -= dt; c.dashT -= dt;
      if (inp.dash && c.dashCd <= 0 && play) { c.dashCd = 1.6; c.dashT = 0.3; c.v = Math.max(c.v, 0) + 500; ctx.emit({ type: 'dash', id: c.id }); }
      const tx = Math.cos(c.a) * c.v, ty = Math.sin(c.a) * c.v;
      c.vx += (tx - c.vx) * Math.min(1, 8 * dt); c.vy += (ty - c.vy) * Math.min(1, 8 * dt);
      c.x += c.vx * dt; c.y += c.vy * dt;
      // murs
      if (c.x < c.r) { c.x = c.r; c.vx *= -0.4; c.v *= 0.5; } if (c.x > W - c.r) { c.x = W - c.r; c.vx *= -0.4; c.v *= 0.5; }
      if (c.y < c.r) { c.y = c.r; c.vy *= -0.4; c.v *= 0.5; } if (c.y > H - c.r) { c.y = H - c.r; c.vy *= -0.4; c.v *= 0.5; }
      // pastilles
      for (const p of s.pads) if (p.t <= 0 && Math.hypot(p.x - c.x, p.y - c.y) < (p.big ? 40 : 28) && c.boost < 100) { p.t = p.big ? 10 : 4; c.boost = Math.min(100, c.boost + (p.big ? 100 : 15)); ctx.emit({ type: 'pad', big: p.big }, c.id); }
      // contact avec le ballon
      const dx = b.x - c.x, dy = b.y - c.y, d = Math.hypot(dx, dy), minD = b.r + c.r;
      if (d < minD && d > 0) {
        const nx = dx / d, ny = dy / d;
        b.x = c.x + nx * minD; b.y = c.y + ny * minD;
        const rel = (c.vx - b.vx) * nx + (c.vy - b.vy) * ny;
        if (rel > 0) {
          const power = (c.dashT > 0 ? 2.1 : 1.35) * s.ballSpeed;
          b.vx += nx * rel * power + c.vx * 0.15; b.vy += ny * rel * power + c.vy * 0.15;
          b.spin = (c.vx * ny - c.vy * nx) * 0.002;
          s.lastTouch = c.id; c.touches = (c.touches || 0) + 1;
          if (rel > 250) ctx.emit({ type: 'kick', x: b.x, y: b.y, p: Math.min(1, rel / 900) });
        }
      }
    }
    for (const p of s.pads) p.t -= dt;
    // voitures entre elles
    for (let i = 0; i < s.cars.length; i++) for (let j = i + 1; j < s.cars.length; j++) {
      const A = s.cars[i], B = s.cars[j];
      if (U.separate(A, B)) {
        const rel = Math.hypot(A.vx - B.vx, A.vy - B.vy);
        // démolition : un turbo à pleine vitesse contre un adversaire
        for (const [X, Y] of [[A, B], [B, A]]) if (X.boosting && X.team !== Y.team && Math.hypot(X.vx, X.vy) > 650 && !Y.demo) { Y.demo = 3; Y.x = Y.team ? W - 100 : 100; Y.y = H / 2; Y.v = 0; Y.vx = Y.vy = 0; ctx.emit({ type: 'demo', x: B.x, y: B.y, by: X.id, victim: Y.id }); }
        const t = A.vx; A.vx = B.vx * 0.7; B.vx = t * 0.7; const t2 = A.vy; A.vy = B.vy * 0.7; B.vy = t2 * 0.7;
        if (rel > 300) ctx.emit({ type: 'bump', x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 });
      }
    }
    for (const c of s.cars) if (c.demo > 0) c.demo -= dt;
    // ballon
    b.vx *= Math.pow(0.55, dt); b.vy *= Math.pow(0.55, dt);
    const sp = Math.hypot(b.vx, b.vy), maxB = 1700 * s.ballSpeed; if (sp > maxB) { b.vx *= maxB / sp; b.vy *= maxB / sp; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    const inGoalY = Math.abs(b.y - H / 2) < GOAL / 2 - b.r * 0.3;
    if (s.phase === 'play' && inGoalY && (b.x < -b.r * 0.2 || b.x > W + b.r * 0.2)) {
      const team = b.x > W ? 0 : 1; // bleu marque à droite
      s.score[team]++;
      const scorer = s.cars.find(c => c.id === s.lastTouch);
      if (scorer) { scorer.goals = (scorer.goals || 0) + 1; }
      ctx.emit({ type: 'goal', team, scorer: scorer?.name, own: scorer && scorer.team !== team, x: b.x, y: b.y });
      s.phase = 'goal'; s.timer = 3.5;
    }
    if (!inGoalY || s.phase !== 'play') {
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.8; if (Math.abs(b.vx) > 200) ctx.emit({ type: 'wall' }); }
      if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.8; if (Math.abs(b.vx) > 200) ctx.emit({ type: 'wall' }); }
    } else { // dans la cage : les poteaux et le fond
      b.x = U.clamp(b.x, -80, W + 80);
      if (Math.abs(b.y - H / 2) > GOAL / 2 - b.r) { b.y = H / 2 + Math.sign(b.y - H / 2) * (GOAL / 2 - b.r); b.vy *= -0.6; }
    }
    if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * 0.8; } if (b.y > H - b.r) { b.y = H - b.r; b.vy = -Math.abs(b.vy) * 0.8; }
  },

  results(s) {
    if (!s.over) return null;
    const win = s.score[0] > s.score[1] ? 0 : 1;
    return { key: 'over', players: s.cars.map(c => ({ id: c.id, place: c.team === win ? 1 : 2, win: c.team === win, score: `${s.score[c.team]}–${s.score[1 - c.team]}` })),
      records: s.cars.map(c => ({ id: c.id, key: 'carball:goals', value: c.goals || 0 })) };
  },
  view(s) {
    return {
      phase: s.phase, timer: U.r1(s.timer), time: Math.ceil(s.time), overtime: s.overtime, score: s.score, over: s.over,
      ball: { x: U.r1(s.ball.x), y: U.r1(s.ball.y), r: s.ball.r, vx: Math.round(s.ball.vx), vy: Math.round(s.ball.vy) },
      cars: s.cars.map(c => ({ id: c.id, name: c.name, color: c.color, team: c.team, bot: c.bot, x: U.r1(c.x), y: U.r1(c.y), a: U.r2(c.a), boost: Math.round(c.boost), boosting: !!c.boosting, dash: c.dashT > 0, dashCd: U.r1(Math.max(0, c.dashCd)), goals: c.goals || 0, touches: c.touches || 0, demo: c.demo > 0 })),
      pads: s.pads.filter(p => p.t <= 0).map(p => p.id), infinite: s.infinite,
    };
  },
  staticData() { return { W, H, GOAL, pads: PADS }; },
};

function newCar(p, team) { return { id: p.id, name: p.name, color: team ? '#fb923c' : '#60a5fa', pcolor: p.color, team, bot: !!p.bot, x: 0, y: 0, a: 0, v: 0, vx: 0, vy: 0, r: 26, boost: 34, dashCd: 0, dashT: 0, input: {}, goals: 0 }; }
function countTeam(s, t) { return s.cars.filter(c => c.team === t).length; }
function fillBots(s) {
  if (!s.useBots) return;
  let n = 0;
  for (const team of [0, 1]) while (countTeam(s, team) < s.size) { const c = newCar({ id: 'bot' + team + '_' + (n++) + Math.random().toString(36).slice(2, 5), name: BOT_NAMES[s.cars.filter(x => x.bot).length % BOT_NAMES.length], bot: true }, team); c.x = team ? W - 300 : 300; c.y = H / 2; s.cars.push(c); }
}
function botDrive(s, c, dt) {
  const b = s.ball, dir = c.team === 0 ? 1 : -1, goalX = c.team === 0 ? W + 60 : -60, ownX = c.team === 0 ? -60 : W + 60;
  const lvl = { facile: 0.6, normal: 0.8, pro: 1 }[s.botLevel];
  const mates = s.cars.filter(x => x.team === c.team).sort((a, z) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(z.x - b.x, z.y - b.y));
  const role = mates.indexOf(c); // 0 = attaquant, dernier = gardien
  let tx, ty;
  const lead = 0.25 * lvl;
  const bx = b.x + b.vx * lead, by = b.y + b.vy * lead;
  if (role === mates.length - 1 && mates.length > 1) { tx = ownX + dir * 160; ty = U.clamp(by, H / 2 - GOAL / 2, H / 2 + GOAL / 2); if (Math.abs(bx - ownX) < 600) { tx = bx - dir * 40; ty = by; } }
  else {
    // se placer derrière le ballon par rapport au but adverse
    const ga = Math.atan2(H / 2 - by, goalX - bx);
    tx = bx - Math.cos(ga) * (b.r + 40); ty = by - Math.sin(ga) * (b.r + 40);
    if ((c.x - bx) * dir > 0) { ty += (c.y < by ? -1 : 1) * 120; } // contourne s'il est du mauvais côté
    if (role === 1) { tx -= dir * 250; }
  }
  const want = Math.atan2(ty - c.y, tx - c.x), d = U.angDiff(c.a, want), dist = Math.hypot(tx - c.x, ty - c.y);
  const reverse = Math.abs(d) > 2.4 && dist < 250;
  c.input = { u: !reverse && (Math.abs(d) < 1.4 || dist > 300), d: reverse, l: reverse ? d > 0 : d < -0.08, r: reverse ? d < 0 : d > 0.08,
    boost: Math.abs(d) < 0.3 && dist > 350 && c.boost > 20 && Math.random() < lvl, dash: Math.hypot(b.x - c.x, b.y - c.y) < b.r + 90 && Math.abs(d) < 0.4 && Math.random() < lvl * 0.15 };
  if (lvl < 1 && Math.random() > lvl + 0.15) c.input.u = false;
}
