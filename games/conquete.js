// Conquête : jeu de stratégie au tour par tour, 2 à 4 joueurs
//
// Règles :
// - Chaque joueur commence avec une capitale (★) dans un coin de la carte.
// - Au début de ton tour, ta capitale reçoit des renforts : 2 troupes,
//   ou 1 troupe pour 3 territoires possédés si c'est plus.
// - Action : depuis une de tes cases (au moins 2 troupes), envoie toutes
//   les troupes sauf une vers une case voisine (haut, bas, gauche, droite).
//     * case à toi : les troupes s'additionnent
//     * case neutre ou ennemie : si tu envoies plus de troupes qu'il n'y en a,
//       tu la prends avec la différence ; sinon tu affaiblis la défense.
// - Chaque case ne peut agir qu'une fois par tour (et les troupes arrivées
//   ne peuvent plus bouger ce tour-ci).
// - Prendre la capitale d'un joueur l'élimine : tous ses territoires sont à toi.
// - Les montagnes (▲) sont infranchissables.
// - Victoire : dernier joueur en vie, ou le plus de territoires après 30 tours.

const SIZE = 9;
const MAX_ROUNDS = 30;
const CORNERS = [[0, 0], [SIZE - 1, SIZE - 1], [SIZE - 1, 0], [0, SIZE - 1]]; // [x, y]

const idx = (x, y) => y * SIZE + x;
const neighbors = (i) => {
  const x = i % SIZE, y = Math.floor(i / SIZE), out = [];
  if (x > 0) out.push(i - 1);
  if (x < SIZE - 1) out.push(i + 1);
  if (y > 0) out.push(i - SIZE);
  if (y < SIZE - 1) out.push(i + SIZE);
  return out;
};

function connected(tiles, capitals) {
  const seen = new Set([capitals[0]]);
  const queue = [capitals[0]];
  while (queue.length) {
    const i = queue.shift();
    for (const n of neighbors(i)) if (!seen.has(n) && !tiles[n].mountain) { seen.add(n); queue.push(n); }
  }
  return capitals.every(c => seen.has(c));
}

function beginTurn(state) {
  const p = state.turn;
  const owned = state.tiles.filter(t => t.owner === p).length;
  const reinforcements = Math.max(2, Math.floor(owned / 3));
  state.tiles[state.capitals[p]].troops += reinforcements;
  state.used = [];
  state.log = `${reinforcements} troupes de renfort pour le joueur ${p + 1}.`;
}

function tilesOf(state, p) {
  return state.tiles.filter(t => t.owner === p).length;
}

module.exports = {
  id: 'conquete',
  name: 'Conquête',
  description: 'Stratégie au tour par tour : étends ton territoire et prends les capitales ennemies.',
  category: 'Stratégie',
  minPlayers: 2,
  maxPlayers: 4,

  setup(playerCount) {
    let tiles, capitals;
    do {
      capitals = CORNERS.slice(0, playerCount).map(([x, y]) => idx(x, y));
      tiles = Array.from({ length: SIZE * SIZE }, () => ({
        owner: -1, troops: 1 + Math.floor(Math.random() * 3), capital: false, mountain: false,
      }));
      for (let i = 0; i < tiles.length; i++) {
        const nearCapital = capitals.some(c => c === i || neighbors(c).includes(i));
        if (!nearCapital && Math.random() < 0.12) { tiles[i].mountain = true; tiles[i].troops = 0; }
      }
    } while (!connected(tiles, capitals));

    capitals.forEach((c, p) => { tiles[c] = { owner: p, troops: 5, capital: true, mountain: false }; });

    const state = {
      size: SIZE, tiles, capitals,
      alive: Array(playerCount).fill(true),
      turn: 0, round: 1, maxRounds: MAX_ROUNDS,
      used: [], over: false, winner: null, log: '',
    };
    beginTurn(state);
    return state;
  },

  move(state, player, move) {
    if (state.over) return 'La partie est terminée.';
    if (player !== state.turn) return "Ce n'est pas ton tour.";

    if (move.type === 'end') {
      // Joueur suivant encore en vie
      let next = state.turn;
      do {
        next = (next + 1) % state.alive.length;
        if (next === 0) state.round++;
      } while (!state.alive[next]);

      if (state.round > state.maxRounds) {
        // Fin au nombre de tours : le plus de territoires gagne
        let best = -1, bestCount = -1, tie = false;
        state.alive.forEach((alive, p) => {
          if (!alive) return;
          const n = tilesOf(state, p);
          if (n > bestCount) { best = p; bestCount = n; tie = false; }
          else if (n === bestCount) tie = true;
        });
        state.over = true; state.winner = tie ? -1 : best;
        state.log = 'Fin des 30 tours !';
        return null;
      }
      state.turn = next;
      beginTurn(state);
      return null;
    }

    if (move.type === 'action') {
      const from = Number(move.from), to = Number(move.to);
      const A = state.tiles[from], B = state.tiles[to];
      if (!A || !B) return 'Case invalide.';
      if (A.owner !== player) return "Cette case n'est pas à toi.";
      if (state.used.includes(from)) return 'Cette case a déjà agi ce tour-ci.';
      if (A.troops < 2) return 'Il faut au moins 2 troupes pour bouger.';
      if (!neighbors(from).includes(to)) return 'Tu ne peux aller que sur une case voisine.';
      if (B.mountain) return 'Les montagnes sont infranchissables.';

      const moving = A.troops - 1;
      A.troops = 1;
      state.used.push(from);

      if (B.owner === player) {
        B.troops += moving;
        state.used.push(to);
        state.log = `Renfort de ${moving} troupes.`;
        return null;
      }

      if (moving > B.troops) {
        const previousOwner = B.owner;
        const wasCapital = B.capital;
        B.owner = player;
        B.troops = moving - B.troops;
        B.capital = false;
        state.used.push(to);
        state.log = 'Case conquise !';

        if (wasCapital && previousOwner >= 0) {
          state.alive[previousOwner] = false;
          for (const t of state.tiles) if (t.owner === previousOwner) t.owner = player;
          state.log = `Capitale prise ! Le joueur ${previousOwner + 1} est éliminé.`;
          const remaining = state.alive.filter(Boolean).length;
          if (remaining === 1) { state.over = true; state.winner = player; }
        }
      } else {
        B.troops = Math.max(1, B.troops - moving);
        state.log = `Attaque repoussée, il reste ${B.troops} défenseur(s).`;
      }
      return null;
    }

    return 'Action inconnue.';
  },
};
