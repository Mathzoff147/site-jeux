// Imposteur : jeu de déduction, 3 à 12 joueurs
// Tous les civils ont le même mot secret. L'imposteur a un mot proche… sans savoir qu'il est l'imposteur !
// Chacun donne un indice, puis tout le monde vote pour éliminer un suspect.
const { shuffle, pick } = require('./lib/geo');

const PAIRS = [
  ['Chat', 'Chien'], ['Plage', 'Piscine'], ['Pizza', 'Burger'], ['Football', 'Rugby'], ['Avion', 'Hélicoptère'],
  ['Café', 'Thé'], ['Guitare', 'Violon'], ['Hiver', 'Automne'], ['Lion', 'Tigre'], ['Train', 'Métro'],
  ['Pomme', 'Poire'], ['Montagne', 'Colline'], ['Docteur', 'Infirmier'], ['Vampire', 'Zombie'], ['Netflix', 'YouTube'],
  ['Lune', 'Soleil'], ['Crêpe', 'Gaufre'], ['Mer', 'Lac'], ['Château', 'Palais'], ['Pirate', 'Viking'],
  ['Ski', 'Snowboard'], ['Banane', 'Mangue'], ['Police', 'Pompier'], ['Cinéma', 'Théâtre'], ['Robot', 'Cyborg'],
  ['Sushi', 'Ramen'], ['Mariage', 'Anniversaire'], ['Moto', 'Scooter'], ['Fourchette', 'Cuillère'], ['Désert', 'Savane'],
  ['Chocolat', 'Caramel'], ['Requin', 'Dauphin'], ['Professeur', 'Directeur'], ['Fusée', 'Satellite'], ['Fantôme', 'Squelette'],
  ['Tennis', 'Badminton'], ['Hôpital', 'Pharmacie'], ['Clavier', 'Souris'], ['Neige', 'Grêle'], ['Roi', 'Prince'],
];

const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

function startRound(state) {
  state.phase = 'clue';
  state.statusText = null;
  state.clues = [];
  state.votes = {};
  state.order = state.order.filter(p => state.alive[p]);
  state.turn = state.order[0];
  state.round++;
}

function checkEnd(state) {
  const impostorsAlive = state._impostors.filter(p => state.alive[p]).length;
  const civilsAlive = state.alive.filter((a, p) => a && !state._impostors.includes(p)).length;
  if (impostorsAlive === 0) {
    state.over = true; state.winner = -2; state.winners = 'civils';
    state.resultText = '🎉 Les civils ont démasqué l\'imposteur !';
  } else if (impostorsAlive >= civilsAlive) {
    state.over = true; state.winner = -2; state.winners = 'imposteur';
    state.resultText = '😈 L\'imposteur a gagné !';
  }
  if (state.over) {
    state.reveal = { impostors: state._impostors, civilWord: state._pair[0], impostorWord: state._pair[1] };
    state.turn = -1;
  }
}

module.exports = {
  id: 'imposteur',
  name: 'Imposteur',
  description: 'Un mot secret, un indice chacun… et un imposteur parmi vous. Démasquez-le !',
  category: 'Ambiance',
  icon: '🕵️',
  color: '#ff9f43',
  order: 3,
  rules: "Chaque joueur reçoit un mot secret. Tous les civils ont le même, mais l'imposteur a un mot proche (et il ne sait pas qu'il est l'imposteur !). Chacun son tour, donne un indice en un mot sur ton mot, sans le dire. Ensuite, tout le monde vote pour éliminer la personne la plus suspecte. Si l'imposteur est éliminé, les civils gagnent. S'il reste autant d'imposteurs que de civils, l'imposteur gagne. À partir de 7 joueurs, il y a 2 imposteurs.",
  minPlayers: 3,
  maxPlayers: 12,

  setup(n) {
    const pair = pick(PAIRS);
    if (Math.random() < 0.5) pair.reverse();
    const impostors = shuffle([...Array(n).keys()]).slice(0, n >= 7 ? 2 : 1);
    const state = {
      _pair: pair, _impostors: impostors,
      _words: Array.from({ length: n }, (_, p) => (impostors.includes(p) ? pair[1] : pair[0])),
      alive: Array(n).fill(true), order: shuffle([...Array(n).keys()]),
      phase: 'clue', clues: [], history: [], votes: {}, eliminated: [], round: 0,
      turn: 0, over: false, winner: null, log: '',
    };
    startRound(state);
    return state;
  },

  move(state, p, move) {
    if (state.over) return 'La partie est terminée.';
    if (!state.alive[p]) return 'Tu as été éliminé : observe la suite !';

    if (move.type === 'clue') {
      if (state.phase !== 'clue') return "Ce n'est pas le moment des indices.";
      if (p !== state.turn) return "Ce n'est pas ton tour de parler.";
      const text = String(move.text || '').trim().slice(0, 30);
      if (!text) return 'Écris un indice.';
      if (norm(text).includes(norm(state._words[p]))) return 'Tu ne peux pas dire ton mot !';
      state.clues.push({ p, text });
      const idx = state.order.indexOf(p);
      if (idx + 1 < state.order.length) state.turn = state.order[idx + 1];
      else { state.phase = 'vote'; state.turn = -1; state.statusText = '🗳️ Votez pour éliminer le suspect !'; }
      return null;
    }

    if (move.type === 'vote') {
      if (state.phase !== 'vote') return "Ce n'est pas le moment de voter.";
      const target = Number(move.target);
      if (!state.alive[target] || target === p) return 'Vote invalide.';
      state.votes[p] = target;
      const voters = state.alive.filter(Boolean).length;
      if (Object.keys(state.votes).length < voters) return null;

      // Dépouillement
      const tally = {};
      Object.values(state.votes).forEach(t => { tally[t] = (tally[t] || 0) + 1; });
      const max = Math.max(...Object.values(tally));
      const top = Object.keys(tally).filter(t => tally[t] === max).map(Number);
      state.history.push({ round: state.round, clues: state.clues, votes: state.votes });
      if (top.length > 1) {
        state.log = 'Égalité : personne n\'est éliminé.';
        state.logBy = null;
      } else {
        const out = top[0];
        state.alive[out] = false;
        const wasImpostor = state._impostors.includes(out);
        state.eliminated.push({ p: out, impostor: wasImpostor });
        state.log = `est éliminé… ${wasImpostor ? "et c'était l'imposteur !" : "et c'était un civil."}`;
        state.logBy = out;
      }
      checkEnd(state);
      if (!state.over) startRound(state);
      return null;
    }
    return 'Action inconnue.';
  },

  view(state, me) {
    return { ...state, myWord: state._words[me], me };
  },
};
