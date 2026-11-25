// Bataille navale : 2 joueurs, grilles 10x10
// Phase 1 "placement" : chacun mélange sa flotte puis clique "Prêt".
// Phase 2 "combat" : on tire chacun son tour. Touché = tu rejoues.
const N = 10;
const FLEET = [
  { name: 'Porte-avions', size: 5 },
  { name: 'Croiseur', size: 4 },
  { name: 'Contre-torpilleur', size: 3 },
  { name: 'Sous-marin', size: 3 },
  { name: 'Torpilleur', size: 2 },
];

function randomFleet() {
  const taken = new Set();
  const ships = [];
  for (const model of FLEET) {
    for (;;) {
      const horizontal = Math.random() < 0.5;
      const r = Math.floor(Math.random() * (horizontal ? N : N - model.size + 1));
      const c = Math.floor(Math.random() * (horizontal ? N - model.size + 1 : N));
      const cells = Array.from({ length: model.size }, (_, k) => horizontal ? r * N + c + k : (r + k) * N + c);
      if (cells.some(x => taken.has(x))) continue;
      cells.forEach(x => taken.add(x));
      ships.push({ name: model.name, cells });
      break;
    }
  }
  return ships;
}

const isSunk = (ship, shots) => ship.cells.every(c => shots[c] === 'hit');

module.exports = {
  id: 'bataille-navale',
  name: 'Bataille navale',
  description: 'Cache ta flotte et coule celle de ton adversaire, case par case.',
  category: 'Stratégie',
  icon: '🚢',
  color: '#4da3ff',
  order: 7,
  rules: "Chaque joueur a 5 navires cachés sur sa grille. Avant le combat, clique sur « Mélanger » jusqu'à ce que ta flotte te plaise, puis sur « Prêt ». Ensuite, clique sur une case de la grille adverse pour tirer. Touché : tu rejoues. À l'eau : la main passe. Le premier qui coule toute la flotte adverse gagne.",
  minPlayers: 2,
  maxPlayers: 2,

  setup() {
    return {
      phase: 'placement',
      ships: [randomFleet(), randomFleet()],
      shots: [Array(N * N).fill(null), Array(N * N).fill(null)], // shots[p] = tirs reçus PAR p
      ready: [false, false],
      turn: -1, over: false, winner: null, last: null, log: '', statusText: '⚓ Placez vos navires, puis cliquez sur Prêt',
    };
  },

  move(state, player, move) {
    if (state.over) return 'La partie est terminée.';

    if (state.phase === 'placement') {
      if (move.type === 'shuffle') {
        if (state.ready[player]) return 'Tu es déjà prêt.';
        state.ships[player] = randomFleet();
        return null;
      }
      if (move.type === 'ready') {
        state.ready[player] = true;
        if (state.ready[0] && state.ready[1]) { state.phase = 'combat'; state.turn = 0; state.statusText = null; state.log = 'Que le combat commence !'; }
        return null;
      }
      return 'Place ta flotte puis clique sur Prêt.';
    }

    if (move.type !== 'fire') return 'Action inconnue.';
    if (player !== state.turn) return "Ce n'est pas ton tour.";
    const cell = Number(move.cell);
    const enemy = 1 - player;
    if (!Number.isInteger(cell) || cell < 0 || cell >= N * N) return 'Case invalide.';
    if (state.shots[enemy][cell]) return 'Tu as déjà tiré ici.';

    const ship = state.ships[enemy].find(s => s.cells.includes(cell));
    state.shots[enemy][cell] = ship ? 'hit' : 'miss';
    state.last = { target: enemy, cell };

    if (!ship) { state.log = 'À l\'eau !'; state.turn = enemy; return null; }
    if (isSunk(ship, state.shots[enemy])) {
      state.log = `Coulé : ${ship.name} !`;
      if (state.ships[enemy].every(s => isSunk(s, state.shots[enemy]))) { state.over = true; state.winner = player; }
    } else state.log = 'Touché ! Tu rejoues.';
    return null;
  },

  // Chaque joueur ne voit que sa propre flotte + les navires adverses déjà coulés
  view(state, me) {
    const fleets = state.ships.map((ships, p) =>
      p === me || state.over ? ships : ships.filter(s => isSunk(s, state.shots[p])));
    return { ...state, ships: fleets, me };
  },
};
