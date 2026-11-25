// Kart Racing : course de karts, 3 tours, bonus et pièges. 1 à 8 joueurs.
const G = require('./lib/geo');
const S = require('./lib/shooter');

const LAPS = 3, WIDTH = 190;
// Tracé du circuit (ligne centrale, boucle fermée)
const TRACK = [
  [400, 1300], [400, 700], [550, 380], [900, 260], [1250, 380], [1350, 700], [1650, 800],
  [2000, 600], [2250, 750], [2250, 1150], [2000, 1400], [1500, 1350], [1150, 1150], [800, 1400], [550, 1450],
];
const W = 2600, H = 1750;
const N = TRACK.length;

// Point le plus proche sur le circuit -> progression (numéro de segment + fraction)
function locate(x, y) {
  let best = { d: Infinity, seg: 0, t: 0 };
  for (let i = 0; i < N; i++) {
    const [ax, ay] = TRACK[i], [bx, by] = TRACK[(i + 1) % N];
    const r = G.distToSegment(x, y, ax, ay, bx, by);
    if (r.d < best.d) best = { d: r.d, seg: i, t: r.t, px: r.x, py: r.y };
  }
  return best;
}

function pointAt(f) { // f entre 0 et N
  const i = Math.floor(f) % N, t = f - Math.floor(f);
  const [ax, ay] = TRACK[i], [bx, by] = TRACK[(i + 1) % N];
  return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, ang: Math.atan2(by - ay, bx - ax) };
}

module.exports = {
  id: 'kart-racing',
  name: 'Kart Racing',
  description: '3 tours de folie : turbos, bananes et missiles. Le premier à franchir la ligne gagne.',
  category: 'Course',
  icon: '🏎️',
  color: '#ffd447',
  order: 14,
  realtime: true,
  rules: "Z/↑ accélérer, S/↓ freiner, Q/D ou ←/→ tourner. Hors de la piste (dans l'herbe), tu ralentis beaucoup. Roule sur les boîtes ❓ pour gagner un objet, puis utilise-le avec Espace ou clic : Turbo (accélération), Banane (posée derrière toi, fait déraper), Missile (tiré devant toi). Les flèches jaunes au sol donnent un petit turbo. Premier à finir les 3 tours gagne !",
  minPlayers: 1,
  maxPlayers: 8,

  setup(n) {
    const start = pointAt(0.15);
    const players = Array.from({ length: n }, (_, i) => {
      const row = Math.floor(i / 2), col = i % 2;
      const back = 60 + row * 55, side = col === 0 ? -40 : 40;
      return {
        i, r: 16, ang: start.ang, vx: 0, vy: 0,
        x: start.x - Math.cos(start.ang) * back - Math.sin(start.ang) * side,
        y: start.y - Math.sin(start.ang) * back + Math.cos(start.ang) * side,
        lap: 0, lastSeg: 0, progress: 0, item: null, spin: 0, turbo: 0, finished: false, place: 0, time: 0,
      };
    });
    const boxes = [2.5, 5.5, 8.4, 11.5, 13.6].flatMap((f, k) => {
      const p = pointAt(f);
      return [-55, 0, 55].map((o, j) => ({ id: k * 3 + j, x: Math.round(p.x - Math.sin(p.ang) * o), y: Math.round(p.y + Math.cos(p.ang) * o), wait: 0 }));
    });
    const pads = [1.4, 6.5, 9.6].map(f => { const p = pointAt(f); return { x: Math.round(p.x), y: Math.round(p.y), ang: G.r1(p.ang) }; });
    return {
      W, H, track: TRACK, width: WIDTH, laps: LAPS, players, boxes, pads, bananas: [], missiles: [],
      countdown: 3.5, time: 0, finishers: [], endTimer: null, over: false, winner: null, turn: -1,
    };
  },

  move(state, p, move) { S.storeInput(state, p, move); return null; },

  tick(state, dt) {
    if (state.countdown > 0) { state.countdown -= dt; return; }
    state.time += dt;

    for (const k of state.players) {
      const input = S.inputOf(state, k.i);
      const loc = locate(k.x, k.y);
      const onTrack = loc.d < WIDTH / 2;
      k.spin = Math.max(0, k.spin - dt);
      k.turbo = Math.max(0, k.turbo - dt);

      if (!k.finished && k.spin <= 0) {
        const fwd = Math.cos(k.ang) * k.vx + Math.sin(k.ang) * k.vy;
        const turn = (input.r ? 1 : 0) - (input.l ? 1 : 0);
        k.ang += turn * 3 * dt * G.clamp(Math.abs(fwd) / 120, 0.25, 1) * (fwd < 0 ? -1 : 1);
        const acc = (input.u ? 600 : 0) - (input.d ? 450 : 0) + (k.turbo > 0 ? 900 : 0);
        k.vx += Math.cos(k.ang) * acc * dt; k.vy += Math.sin(k.ang) * acc * dt;
        // Utiliser l'objet
        if ((input.jump || input.fire) && k.item && !k.usedHeld) {
          if (k.item === 'turbo') k.turbo = 1.6;
          if (k.item === 'banane') state.bananas.push({ x: Math.round(k.x - Math.cos(k.ang) * 40), y: Math.round(k.y - Math.sin(k.ang) * 40) });
          if (k.item === 'missile') state.missiles.push({ x: k.x + Math.cos(k.ang) * 30, y: k.y + Math.sin(k.ang) * 30, vx: Math.cos(k.ang) * 1000, vy: Math.sin(k.ang) * 1000, life: 2, owner: k.i });
          k.item = null;
        }
        k.usedHeld = input.jump || input.fire;
      } else if (k.spin > 0) {
        k.ang += 12 * dt;
      }

      const f = Math.cos(k.ang) * k.vx + Math.sin(k.ang) * k.vy;
      const s = -Math.sin(k.ang) * k.vx + Math.cos(k.ang) * k.vy;
      const grip = k.spin > 0 ? 0.3 : 0.015;
      const forward = f * Math.pow(onTrack ? 0.5 : 0.12, dt), side = s * Math.pow(grip, dt);
      k.vx = Math.cos(k.ang) * forward - Math.sin(k.ang) * side;
      k.vy = Math.sin(k.ang) * forward + Math.cos(k.ang) * side;
      const max = (k.turbo > 0 ? 700 : 480) * (onTrack ? 1 : 0.4);
      const sp = Math.hypot(k.vx, k.vy);
      if (sp > max) { k.vx *= max / sp; k.vy *= max / sp; }
      k.x = G.clamp(k.x + k.vx * dt, 20, W - 20);
      k.y = G.clamp(k.y + k.vy * dt, 20, H - 20);

      // Tours : on avance segment par segment (pas de raccourci possible)
      const seg = loc.seg;
      if (seg === (k.lastSeg + 1) % N) {
        if (seg === 0) k.lap++;
        k.lastSeg = seg;
      } else if (seg === k.lastSeg - 1 && seg >= 0) {
        // marche arrière : on ne compte pas
      }
      k.progress = k.lap * N + (k.lastSeg === seg ? seg + loc.t : k.lastSeg + 1);
      if (!k.finished && k.lap >= LAPS) {
        k.finished = true; k.time = Math.round(state.time * 10) / 10;
        state.finishers.push(k.i); k.place = state.finishers.length;
        if (state.endTimer === null) state.endTimer = 25;
      }
    }
    for (let a = 0; a < state.players.length; a++) for (let b = a + 1; b < state.players.length; b++) G.separate(state.players[a], state.players[b]);

    // Boîtes à objets
    for (const box of state.boxes) {
      if (box.wait > 0) { box.wait -= dt; continue; }
      const k = state.players.find(k => !k.item && !k.finished && G.dist(k.x, k.y, box.x, box.y) < 30);
      if (k) { k.item = G.pick(['turbo', 'turbo', 'banane', 'missile']); box.wait = 4; }
    }
    for (const pad of state.pads) for (const k of state.players) if (G.dist(k.x, k.y, pad.x, pad.y) < 40) k.turbo = Math.max(k.turbo, 0.7);
    state.bananas = state.bananas.filter(b => {
      const k = state.players.find(k => G.dist(k.x, k.y, b.x, b.y) < 24);
      if (k) { k.spin = 1.1; k.vx *= 0.3; k.vy *= 0.3; return false; }
      return true;
    });
    state.missiles = state.missiles.filter(m => {
      m.x += m.vx * dt; m.y += m.vy * dt; m.life -= dt;
      const k = state.players.find(k => k.i !== m.owner && G.dist(k.x, k.y, m.x, m.y) < 26);
      if (k) { k.spin = 1.5; k.vx *= 0.2; k.vy *= 0.2; return false; }
      return m.life > 0 && m.x > 0 && m.y > 0 && m.x < W && m.y < H;
    });

    // Classement
    const ranking = [...state.players].sort((a, b) => (a.finished && b.finished ? a.place - b.place : a.finished ? -1 : b.finished ? 1 : b.progress - a.progress));
    ranking.forEach((k, idx) => { k.rank = idx + 1; });

    if (state.endTimer !== null) {
      state.endTimer -= dt;
      if (state.endTimer <= 0 || state.players.every(k => k.finished)) { state.over = true; state.winner = state.finishers[0]; }
    }
  },

  view(state, me) {
    return {
      ...state, me,
      players: state.players.map(k => ({ ...k, x: Math.round(k.x), y: Math.round(k.y), ang: G.r1(k.ang), progress: G.r1(k.progress) })),
      missiles: state.missiles.map(m => ({ x: Math.round(m.x), y: Math.round(m.y), vx: m.vx, vy: m.vy })),
    };
  },
};
