// Kolor : jeu de cartes de défausse (même principe que le célèbre jeu à 4 couleurs)
// 2 à 8 joueurs. Débarrasse-toi de toutes tes cartes en premier.
const { shuffle } = require('./lib/geo');
const COLORS = ['rouge', 'jaune', 'vert', 'bleu'];

function makeDeck() {
  const deck = [];
  let id = 0;
  for (const color of COLORS) {
    deck.push({ id: id++, color, value: '0' });
    for (let n = 1; n <= 9; n++) for (let k = 0; k < 2; k++) deck.push({ id: id++, color, value: String(n) });
    for (const v of ['passe', 'inverse', '+2']) for (let k = 0; k < 2; k++) deck.push({ id: id++, color, value: v });
  }
  for (let k = 0; k < 4; k++) {
    deck.push({ id: id++, color: 'noir', value: 'joker' });
    deck.push({ id: id++, color: 'noir', value: '+4' });
  }
  return shuffle(deck);
}

function draw(state, p, n) {
  for (let k = 0; k < n; k++) {
    if (!state._deck.length) { // on remélange la défausse
      const top = state.discard.pop();
      state._deck = shuffle(state.discard.map(c => c));
      state.discard = [top];
    }
    if (!state._deck.length) return;
    state._hands[p].push(state._deck.pop());
  }
}

const playable = (state, card) =>
  card.color === 'noir' || card.color === state.color || card.value === state.discard[state.discard.length - 1].value;

function nextPlayer(state, skip = 0) {
  const n = state.counts.length;
  return ((state.turn + state.dir * (1 + skip)) % n + n) % n;
}

function refreshCounts(state) {
  state.counts = state._hands.map(h => h.length);
  state.deckCount = state._deck.length;
}

module.exports = {
  id: 'kolor',
  name: 'Kolor',
  description: 'Le jeu de cartes culte : couleurs, +2, +4, inversions… vide ta main en premier !',
  category: 'Cartes',
  icon: '🃏',
  color: '#ff5d6c',
  order: 1,
  rules: "Pose une carte de la même couleur ou du même symbole que la carte du dessus. Passe : le joueur suivant saute son tour. Inverse : le sens change. +2 : le suivant pioche 2 cartes et passe son tour. Joker : tu choisis la couleur. +4 : tu choisis la couleur, le suivant pioche 4 et passe. Si tu ne peux (ou ne veux) pas jouer, pioche une carte : tu peux la poser si elle va, sinon passe. Le premier sans carte gagne.",
  minPlayers: 2,
  maxPlayers: 8,

  setup(n) {
    const state = { _deck: makeDeck(), _hands: [], discard: [], color: null, dir: 1, turn: 0, drew: false, over: false, winner: null, log: '', counts: [], deckCount: 0 };
    for (let p = 0; p < n; p++) { state._hands.push([]); draw(state, p, 7); }
    let first;
    do { first = state._deck.pop(); if (first.color === 'noir') state._deck.unshift(first); } while (first.color === 'noir');
    state.discard.push(first);
    state.color = first.color;
    refreshCounts(state);
    return state;
  },

  move(state, p, move) {
    if (state.over) return 'La partie est terminée.';
    if (p !== state.turn) return "Ce n'est pas ton tour.";
    const hand = state._hands[p];
    state.logBy = p;

    if (move.type === 'draw') {
      if (state.drew) return 'Tu as déjà pioché : joue la carte ou passe.';
      draw(state, p, 1);
      state.drew = true;
      state.log = 'pioche une carte.';
      refreshCounts(state);
      return null;
    }

    if (move.type === 'pass') {
      if (!state.drew) return "Pioche d'abord une carte.";
      state.drew = false;
      state.turn = nextPlayer(state);
      state.log = 'passe son tour.';
      return null;
    }

    if (move.type === 'play') {
      const idx = hand.findIndex(c => c.id === Number(move.card));
      if (idx === -1) return "Tu n'as pas cette carte.";
      const card = hand[idx];
      if (state.drew && idx !== hand.length - 1) return 'Après une pioche, seule la carte piochée peut être posée.';
      if (!playable(state, card)) return 'Cette carte ne peut pas être posée.';
      if (card.color === 'noir' && !COLORS.includes(move.color)) return 'Choisis une couleur.';

      hand.splice(idx, 1);
      state.discard.push(card);
      if (state.discard.length > 30) state.discard.splice(0, state.discard.length - 30);
      state.color = card.color === 'noir' ? move.color : card.color;
      state.drew = false;
      state.log = `pose ${card.value}${card.color === 'noir' ? ' (' + state.color + ')' : ''}.`;

      if (!hand.length) { state.over = true; state.winner = p; refreshCounts(state); return null; }

      const n = state.counts.length;
      if (card.value === 'inverse') {
        state.dir *= -1;
        state.turn = n === 2 ? state.turn : nextPlayer(state);
      } else if (card.value === 'passe') {
        state.turn = nextPlayer(state, 1);
      } else if (card.value === '+2' || card.value === '+4') {
        const victim = nextPlayer(state);
        draw(state, victim, card.value === '+2' ? 2 : 4);
        state.turn = nextPlayer(state, 1);
      } else {
        state.turn = nextPlayer(state);
      }
      refreshCounts(state);
      return null;
    }
    return 'Action inconnue.';
  },

  view(state, me) {
    return { ...state, hand: state._hands[me], me };
  },
};
