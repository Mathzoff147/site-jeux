// Car Football : des voitures, un ballon géant, deux buts. 2 à 8 joueurs en 2 équipes.
const G = require('./lib/geo');
const S = require('./lib/shooter');

const W = 1400, H = 800, GOAL = 220, MATCH = 180;

function kickoff(state) {
  const teams = [0, 1].map(t => state.players.filter(p => p.team === t));
  teams.forEach((list, t) => list.forEach((c, k) => Object.assign(c, {
    x: t === 0 ? 200 : W - 200, y: H / 2 + (k - (list.length - 1) / 2) * 110,
    ang: t === 0 ? 0 : Math.PI, vx: 0, vy: 0, speed: 0,
  })));
  Object.assign(state.ball, { x: W / 2, y: H / 2, vx: 0, vy: 0 });
  state.freeze = 2.5;
}

module.exports = {
  id: 'car-football',
  name: 'Car Football',
  description: 'Du foot… avec des voitures et un turbo. Marque plus de buts que les autres !',
  category: 'Sport',
  icon: '🚗',
  color: '#4da3ff',
  order: 13,
  realtime: true,
  rules: "Deux équipes (Bleue à gauche, Rouge à droite). Z/↑ pour accélérer, S/↓ pour freiner ou reculer, Q/D ou ←/→ pour tourner, Espace ou Maj pour le turbo (la jauge se recharge toute seule). Fonce dans le ballon pour le pousser dans le but adverse. Le match dure 3 minutes. En cas d'égalité, but en or !",
  minPlayers: 2,
  maxPlayers: 8,

  setup(n) {
    const players = Array.from({ length: n }, (_, i) => ({ i, team: i % 2, x: 0, y: 0, ang: 0, vx: 0, vy: 0, r: 22, boost: 100, goals: 0 }));
    const state = { W, H, GOAL, players, ball: { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 30 }, score: [0, 0], time: MATCH, freeze: 0, goalFlash: 0, lastTouch: -1, overtime: false, over: false, winner: null, turn: -1 };
    kickoff(state);
    return state;
  },

  move(state, p, move) { S.storeInput(state, p, move); return null; },

  tick(state, dt) {
    state.goalFlash = Math.max(0, state.goalFlash - dt);
    if (state.freeze > 0) { state.freeze -= dt; return; }
    if (!state.overtime) state.time = Math.max(0, state.time - dt);

    for (const c of state.players) {
      const input = S.inputOf(state, c.i);
      const turn = (input.r ? 1 : 0) - (input.l ? 1 : 0);
      const fwd = Math.cos(c.ang) * c.vx + Math.sin(c.ang) * c.vy;
      c.ang += turn * 3.2 * dt * G.clamp(Math.abs(fwd) / 150, 0.3, 1) * (fwd < 0 ? -1 : 1);
      let acc = (input.u ? 520 : 0) - (input.d ? 380 : 0);
      const boosting = (input.jump || input.alt) && c.boost > 0;
      if (boosting) { acc += 700; c.boost = Math.max(0, c.boost - 45 * dt); } else c.boost = Math.min(100, c.boost + 12 * dt);
      c.vx += Math.cos(c.ang) * acc * dt; c.vy += Math.sin(c.ang) * acc * dt;
      // Adhérence : la voiture glisse peu sur le côté
      const f = Math.cos(c.ang) * c.vx + Math.sin(c.ang) * c.vy;
      const s = -Math.sin(c.ang) * c.vx + Math.cos(c.ang) * c.vy;
      const side = s * Math.pow(0.02, dt), forward = f * Math.pow(0.45, dt);
      c.vx = Math.cos(c.ang) * forward - Math.sin(c.ang) * side;
      c.vy = Math.sin(c.ang) * forward + Math.cos(c.ang) * side;
      const sp = Math.hypot(c.vx, c.vy), max = boosting ? 640 : 430;
      if (sp > max) { c.vx *= max / sp; c.vy *= max / sp; }
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.x < c.r) { c.x = c.r; c.vx *= -0.4; } if (c.x > W - c.r) { c.x = W - c.r; c.vx *= -0.4; }
      if (c.y < c.r) { c.y = c.r; c.vy *= -0.4; } if (c.y > H - c.r) { c.y = H - c.r; c.vy *= -0.4; }
      c.boosting = boosting;
    }
    // Chocs entre voitures
    for (let a = 0; a < state.players.length; a++) for (let b = a + 1; b < state.players.length; b++) {
      const A = state.players[a], B = state.players[b];
      if (G.separate(A, B)) { const tx = A.vx; A.vx = B.vx * 0.8; B.vx = tx * 0.8; const ty = A.vy; A.vy = B.vy * 0.8; B.vy = ty * 0.8; }
    }

    // Ballon
    const ball = state.ball;
    for (const c of state.players) {
      const d = G.dist(c.x, c.y, ball.x, ball.y);
      if (d < c.r + ball.r) {
        const nx = (ball.x - c.x) / (d || 1), ny = (ball.y - c.y) / (d || 1);
        ball.x = c.x + nx * (c.r + ball.r); ball.y = c.y + ny * (c.r + ball.r);
        const rel = (c.vx - ball.vx) * nx + (c.vy - ball.vy) * ny;
        const impulse = Math.max(rel, 0) * 1.5 + 90;
        ball.vx += nx * impulse; ball.vy += ny * impulse;
        state.lastTouch = c.i;
      }
    }
    ball.vx *= Math.pow(0.6, dt); ball.vy *= Math.pow(0.6, dt);
    const bs = Math.hypot(ball.vx, ball.vy); if (bs > 1100) { ball.vx *= 1100 / bs; ball.vy *= 1100 / bs; }
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    const inGoalMouth = ball.y > H / 2 - GOAL / 2 && ball.y < H / 2 + GOAL / 2;
    if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy) * 0.85; }
    if (ball.y > H - ball.r) { ball.y = H - ball.r; ball.vy = -Math.abs(ball.vy) * 0.85; }
    if (!inGoalMouth) {
      if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx) * 0.85; }
      if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx) * 0.85; }
    }

    // But !
    let scorer = null;
    if (ball.x < -ball.r) scorer = 1;
    if (ball.x > W + ball.r) scorer = 0;
    if (scorer !== null) {
      state.score[scorer]++;
      state.goalFlash = 2.5; state.lastGoal = scorer;
      const toucher = state.players[state.lastTouch];
      if (toucher && toucher.team === scorer) toucher.goals++;
      if (state.overtime) return this.finish(state);
      kickoff(state);
    }
    if (state.time <= 0 && !state.overtime) {
      if (state.score[0] === state.score[1]) { state.overtime = true; kickoff(state); }
      else this.finish(state);
    }
  },

  finish(state) {
    state.over = true; state.winner = -2;
    state.winnerTeam = state.score[0] > state.score[1] ? 0 : 1;
    state.resultText = `Victoire de l'équipe ${state.winnerTeam === 0 ? 'Bleue' : 'Rouge'} ${state.score[0]} - ${state.score[1]} !`;
  },

  view(state, me) {
    const round = (o) => ({ ...o, x: Math.round(o.x), y: Math.round(o.y), ang: G.r1(o.ang), vx: Math.round(o.vx), vy: Math.round(o.vy) });
    return { ...state, me, players: state.players.map(round), ball: round(state.ball), time: Math.ceil(state.time) };
  },
};
