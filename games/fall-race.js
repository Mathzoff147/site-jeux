// Fall Race : course d'obstacles délirante, 2 à 12 joueurs.
// Évite les barres qui tournent, les murs mobiles et les trous. Saute avec Espace !
const G = require('./lib/geo');
const S = require('./lib/shooter');

const W = 800, H = 4200, FINISH = 160;
const CHECKPOINTS = [4000, 3050, 2150, 1150];

function buildCourse() {
  const o = [];
  // Murs mobiles
  for (const [y, speed] of [[3550, 1.4], [3400, -1.8], [3250, 1.1]]) o.push({ type: 'wall', x: 300, y, w: 220, h: 30, range: 260, speed, base: 300 });
  // Barres tournantes
  o.push({ type: 'sweep', x: 250, y: 2850, len: 210, ang: 0, speed: 1.6 });
  o.push({ type: 'sweep', x: 550, y: 2650, len: 210, ang: 1.5, speed: -1.9 });
  // Champ de trous
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
    if ((row + col) % 2) continue;
    o.push({ type: 'hole', x: 40 + col * 190, y: 2450 - row * 110, w: 150, h: 80 });
  }
  // Bumpers + barre
  for (const [x, y] of [[200, 1950], [400, 1850], [600, 1950], [300, 1720], [520, 1700]]) o.push({ type: 'bumper', x, y, r: 34 });
  o.push({ type: 'sweep', x: 400, y: 2050, len: 320, ang: 0, speed: 1.2 });
  // Trous + murs
  o.push({ type: 'hole', x: 0, y: 1450, w: 330, h: 120 }, { type: 'hole', x: 470, y: 1450, w: 330, h: 120 });
  o.push({ type: 'wall', x: 330, y: 1300, w: 140, h: 30, range: 300, speed: 2.2, base: 330 });
  o.push({ type: 'hole', x: 150, y: 1220, w: 500, h: 60 });
  // Le grand final
  o.push({ type: 'sweep', x: 400, y: 900, len: 380, ang: 0, speed: 1.3 });
  o.push({ type: 'sweep', x: 400, y: 650, len: 380, ang: Math.PI / 2, speed: -1.5 });
  for (const [y, speed] of [[420, 2.4], [300, -2.0]]) o.push({ type: 'wall', x: 300, y, w: 200, h: 30, range: 290, speed, base: 300 });
  return o;
}

function respawn(state, pl) {
  const y = CHECKPOINTS[pl.cp];
  Object.assign(pl, { x: G.rand(150, W - 150), y, vx: 0, vy: 0, fall: 0, air: 0 });
}

module.exports = {
  id: 'fall-race',
  name: 'Fall Race',
  description: "Course d'obstacles survoltée : barres, trous, bumpers. Premier à l'arrivée !",
  category: 'Course',
  icon: '🏃',
  color: '#ff7ac6',
  order: 15,
  realtime: true,
  rules: "Cours jusqu'à la ligne d'arrivée tout en haut ! ZQSD/flèches pour bouger, Espace pour sauter. En l'air, tu passes au-dessus des trous et des barres tournantes. Les bumpers te projettent. Si tu tombes dans un trou, tu repars du dernier drapeau (point de passage). Le premier arrivé gagne, la course s'arrête 30 secondes plus tard.",
  minPlayers: 1,
  maxPlayers: 12,

  setup(n) {
    const players = Array.from({ length: n }, (_, i) => ({
      i, r: 15, x: 120 + (i % 6) * 110, y: 4080 + Math.floor(i / 6) * 50, vx: 0, vy: 0,
      air: 0, jumpCd: 0, fall: 0, cp: 0, finished: false, place: 0,
    }));
    return { W, H, FINISH, checkpoints: CHECKPOINTS, obstacles: buildCourse(), players, countdown: 3.5, time: 0, finishers: [], endTimer: null, over: false, winner: null, turn: -1 };
  },

  move(state, p, move) { S.storeInput(state, p, move); return null; },

  tick(state, dt) {
    const t = state.time;
    for (const o of state.obstacles) {
      if (o.type === 'wall') o.x = o.base + Math.sin(t * o.speed) * o.range / 2 + 0 * 0;
      if (o.type === 'sweep') o.ang += o.speed * dt;
    }
    if (state.countdown > 0) { state.countdown -= dt; return; }
    state.time += dt;

    for (const pl of state.players) {
      if (pl.finished) continue;
      if (pl.fall > 0) { pl.fall -= dt; if (pl.fall <= 0) respawn(state, pl); continue; }
      const input = S.inputOf(state, pl.i);
      pl.air = Math.max(0, pl.air - dt);
      pl.jumpCd = Math.max(0, pl.jumpCd - dt);
      if (input.jump && pl.jumpCd <= 0 && pl.air <= 0) { pl.air = 0.55; pl.jumpCd = 1.0; }

      let ax = (input.r ? 1 : 0) - (input.l ? 1 : 0), ay = (input.d ? 1 : 0) - (input.u ? 1 : 0);
      const len = Math.hypot(ax, ay); if (len) { ax /= len; ay /= len; }
      pl.vx += ax * 1600 * dt; pl.vy += ay * 1600 * dt;
      pl.vx *= Math.pow(0.02, dt); pl.vy *= Math.pow(0.02, dt);
      const sp = Math.hypot(pl.vx, pl.vy), max = 900;
      if (sp > max) { pl.vx *= max / sp; pl.vy *= max / sp; }
      pl.x += pl.vx * dt; pl.y += pl.vy * dt;
      pl.x = G.clamp(pl.x, pl.r, W - pl.r); pl.y = G.clamp(pl.y, 0, H - pl.r);

      for (const o of state.obstacles) {
        if (o.type === 'wall') {
          if (G.pushOutOfRect(pl, o)) { /* bloqué */ }
        } else if (o.type === 'bumper') {
          const d = G.dist(pl.x, pl.y, o.x, o.y);
          if (d < pl.r + o.r) {
            const nx = (pl.x - o.x) / (d || 1), ny = (pl.y - o.y) / (d || 1);
            pl.x = o.x + nx * (pl.r + o.r); pl.y = o.y + ny * (pl.r + o.r);
            pl.vx = nx * 750; pl.vy = ny * 750;
          }
        } else if (o.type === 'sweep' && pl.air <= 0) {
          const ex = Math.cos(o.ang) * o.len, ey = Math.sin(o.ang) * o.len;
          const r = G.distToSegment(pl.x, pl.y, o.x - ex, o.y - ey, o.x + ex, o.y + ey);
          if (r.d < pl.r + 9) {
            const nx = (pl.x - r.x) / (r.d || 1), ny = (pl.y - r.y) / (r.d || 1);
            const tangent = Math.sign(o.speed) * ((r.t - 0.5) * 2);
            pl.vx = nx * 500 + -Math.sin(o.ang) * tangent * 700;
            pl.vy = ny * 500 + Math.cos(o.ang) * tangent * 700;
            pl.x = r.x + nx * (pl.r + 10); pl.y = r.y + ny * (pl.r + 10);
          }
        } else if (o.type === 'hole' && pl.air <= 0 && G.pointInRect(pl.x, pl.y, o)) {
          pl.fall = 1;
        }
      }
      for (let k = CHECKPOINTS.length - 1; k > pl.cp; k--) if (pl.y < CHECKPOINTS[k]) { pl.cp = k; break; }
      if (pl.y < FINISH) {
        pl.finished = true; state.finishers.push(pl.i); pl.place = state.finishers.length;
        if (state.endTimer === null) state.endTimer = 30;
      }
    }
    const active = state.players.filter(p => !p.finished && p.fall <= 0);
    for (let a = 0; a < active.length; a++) for (let b = a + 1; b < active.length; b++) G.separate(active[a], active[b]);

    if (state.endTimer !== null) {
      state.endTimer -= dt;
      if (state.endTimer <= 0 || state.players.every(p => p.finished)) { state.over = true; state.winner = state.finishers[0]; }
    }
  },

  view(state, me) {
    return {
      ...state, me,
      players: state.players.map(p => ({ ...p, x: Math.round(p.x), y: Math.round(p.y), vx: 0, vy: 0 })),
      obstacles: state.obstacles.map(o => ({ ...o, x: Math.round(o.x), ang: o.ang !== undefined ? Math.round(o.ang * 100) / 100 : undefined })),
    };
  },
};
