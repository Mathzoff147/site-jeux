// Tactical Strike : tir en équipes (jusqu'à 5 contre 5), vue de dessus.
// Chaque classe a une arme et une capacité spéciale. Première équipe à 5 manches gagnées.
const G = require('./lib/geo');
const S = require('./lib/shooter');

const W = 1800, H = 1000;
const ROUNDS_TO_WIN = 5;
const CLASSES = {
  assaut: { name: 'Assaut', weapon: 'fusil', hp: 100, speed: 235, ability: 'Ruée', cd: 6 },
  medic:  { name: 'Médic', weapon: 'smg', hp: 90, speed: 240, ability: 'Soin de zone', cd: 12 },
  sniper: { name: 'Sniper', weapon: 'sniper', hp: 80, speed: 215, ability: 'Sprint', cd: 10 },
  tank:   { name: 'Tank', weapon: 'pompe', hp: 160, speed: 200, ability: 'Bouclier', cd: 14 },
};

// Carte symétrique : la moitié gauche est dessinée, la droite est son miroir
function makeMap() {
  const half = [
    { x: 300, y: 150, w: 60, h: 220 }, { x: 300, y: 630, w: 60, h: 220 },
    { x: 520, y: 430, w: 140, h: 140 }, { x: 600, y: 80, w: 200, h: 50 }, { x: 600, y: 870, w: 200, h: 50 },
    { x: 760, y: 260, w: 50, h: 140 }, { x: 760, y: 600, w: 50, h: 140 },
  ];
  const mirror = half.map(o => ({ x: W - o.x - o.w, y: o.y, w: o.w, h: o.h }));
  return half.concat(mirror, [{ x: 870, y: 440, w: 60, h: 120 }]);
}

function spawnTeam(state) {
  const byTeam = [0, 1].map(t => state.players.filter(p => p.team === t));
  byTeam.forEach((list, t) => list.forEach((pl, k) => {
    const c = CLASSES[pl.cls];
    Object.assign(pl, {
      x: t === 0 ? 120 : W - 120, y: H / 2 + (k - (list.length - 1) / 2) * 90,
      hp: c.hp, maxHp: c.hp, speed: c.speed, weapon: c.weapon, alive: true, ang: t === 0 ? 0 : Math.PI,
      abilityCd: 0, shield: 0, boost: 0, speedMul: 1, cd: 0,
    });
  }));
  state.bullets = [];
  state.effects = [];
}

module.exports = {
  id: 'tactical-strike',
  name: 'Tactical Strike',
  description: 'Équipes, classes, capacités spéciales : le 5 contre 5 tactique.',
  category: 'Action',
  icon: '🎯',
  color: '#ff5d6c',
  order: 11,
  realtime: true,
  rules: "Deux équipes s'affrontent en manches. Avant chaque manche, choisis ta classe (touches 1 à 4) : Assaut (fusil d'assaut, Ruée), Médic (mitraillette, soigne les alliés proches), Sniper (gros dégâts, Sprint), Tank (fusil à pompe, Bouclier qui bloque les dégâts 3 s). ZQSD/flèches pour bouger, souris pour viser, clic gauche pour tirer, clic droit ou Maj pour la capacité. L'équipe qui élimine l'autre gagne la manche. Première équipe à 5 manches.",
  minPlayers: 2,
  maxPlayers: 10,

  setup(n) {
    const players = Array.from({ length: n }, (_, i) => S.newPlayer(i, 0, 0, { team: i % 2, cls: 'assaut' }));
    const state = {
      W, H, _obstacles: makeMap(), players, bullets: [], effects: [], classes: CLASSES,
      phase: 'pick', timer: 8, score: [0, 0], round: 1, roundWinner: null,
      over: false, winner: null, turn: -1, feed: [], _sent: {},
    };
    spawnTeam(state);
    return state;
  },

  move(state, p, move) {
    if (move.type === 'class' && CLASSES[move.cls] && state.phase === 'pick') {
      state.players[p].cls = move.cls;
      spawnTeam(state);
      return null;
    }
    S.storeInput(state, p, move);
    return null;
  },

  tick(state, dt) {
    state.timer -= dt;
    state.effects = state.effects.filter(e => (e.t -= dt) > 0);

    if (state.phase === 'pick') {
      if (state.timer <= 0) { state.phase = 'fight'; state.timer = 120; }
      return;
    }
    if (state.phase === 'end') {
      if (state.timer <= 0) {
        if (state.score.some(s => s >= ROUNDS_TO_WIN)) {
          state.over = true; state.winner = -2;
          state.winnerTeam = state.score[0] > state.score[1] ? 0 : 1;
          state.resultText = `Victoire de l'équipe ${state.winnerTeam === 0 ? 'Bleue' : 'Rouge'} (${state.score[0]} - ${state.score[1]}) !`;
          return;
        }
        state.round++; state.phase = 'pick'; state.timer = 6; spawnTeam(state);
      }
      return;
    }

    // Capacités spéciales
    for (const pl of state.players) {
      if (!pl.alive) continue;
      pl.abilityCd = Math.max(0, pl.abilityCd - dt);
      pl.shield = Math.max(0, pl.shield - dt);
      pl.boost = Math.max(0, pl.boost - dt);
      pl.speedMul = pl.boost > 0 ? (pl.cls === 'assaut' ? 3 : 1.6) : 1;
      const input = S.inputOf(state, pl.i);
      if (input.alt && pl.abilityCd <= 0) {
        pl.abilityCd = CLASSES[pl.cls].cd;
        if (pl.cls === 'assaut') pl.boost = 0.25;
        if (pl.cls === 'sniper') pl.boost = 3;
        if (pl.cls === 'tank') pl.shield = 3;
        if (pl.cls === 'medic') {
          state.players.forEach(o => { if (o.alive && o.team === pl.team && G.dist(o.x, o.y, pl.x, pl.y) < 170) o.hp = Math.min(o.maxHp, o.hp + 45); });
          state.effects.push({ kind: 'heal', x: Math.round(pl.x), y: Math.round(pl.y), r: 170, t: 0.6 });
        }
      }
    }

    S.stepPlayers(state, dt, { W, H, obstacles: state._obstacles });
    S.stepBullets(state, dt, {
      W, H, obstacles: state._obstacles, targets: state.players,
      onHit: (b, t, check) => {
        if (check) return t.team !== b.team;
        if (t.shield > 0) return true;
        t.hp -= b.dmg;
        if (t.hp <= 0 && t.alive) {
          t.alive = false; t.hp = 0;
          state.players[b.owner].kills++;
          state.feed.unshift({ k: b.owner, v: t.i }); state.feed.length = Math.min(state.feed.length, 5);
        }
        return true;
      },
    });

    const aliveTeams = [0, 1].map(t => state.players.filter(p => p.team === t && p.alive).length);
    let rw = null;
    if (aliveTeams[0] === 0 && aliveTeams[1] === 0) rw = -1;
    else if (aliveTeams[1] === 0) rw = 0;
    else if (aliveTeams[0] === 0) rw = 1;
    else if (state.timer <= 0) rw = aliveTeams[0] === aliveTeams[1] ? -1 : aliveTeams[0] > aliveTeams[1] ? 0 : 1;
    if (rw !== null) {
      if (rw >= 0) state.score[rw]++;
      state.roundWinner = rw; state.phase = 'end'; state.timer = 4;
    }
  },

  view(state, me) {
    const v = { ...state, me, players: state.players.map(S.slim) };
    if (!state._sent[me]) { v.obstacles = state._obstacles; state._sent[me] = true; }
    return v;
  },
  resync(state, me) { state._sent[me] = false; },
};
