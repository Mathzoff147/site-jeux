// Poker Texas Hold'em, 2 à 8 joueurs. Tapis de départ 1000, blindes qui montent.
const { shuffle } = require('./lib/geo');
const START = 1000;
const HAND_NAMES = ['Carte haute', 'Paire', 'Double paire', 'Brelan', 'Quinte', 'Couleur', 'Full', 'Carré', 'Quinte flush'];

// ---------- Évaluation des mains ----------
function eval5(cards) {
  const ranks = cards.map(c => c.r).sort((a, b) => b - a);
  const flush = cards.every(c => c.s === cards[0].s);
  const uniq = [...new Set(ranks)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (ranks[0] - ranks[4] === 4) straightHigh = ranks[0];
    else if (ranks.join() === '14,5,4,3,2') straightHigh = 5; // quinte blanche A-2-3-4-5
  }
  const counts = {};
  ranks.forEach(r => { counts[r] = (counts[r] || 0) + 1; });
  const groups = Object.entries(counts).map(([r, n]) => [n, Number(r)]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const byGroup = groups.map(g => g[1]);
  if (straightHigh && flush) return [8, straightHigh];
  if (groups[0][0] === 4) return [7, ...byGroup];
  if (groups[0][0] === 3 && groups[1][0] === 2) return [6, ...byGroup];
  if (flush) return [5, ...ranks];
  if (straightHigh) return [4, straightHigh];
  if (groups[0][0] === 3) return [3, ...byGroup];
  if (groups[0][0] === 2 && groups[1][0] === 2) return [2, ...byGroup];
  if (groups[0][0] === 2) return [1, ...byGroup];
  return [0, ...ranks];
}

const compare = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; };

function best7(cards) {
  let best = null;
  for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) {
    const five = cards.filter((_, i) => i !== a && i !== b);
    const v = eval5(five);
    if (!best || compare(v, best) > 0) best = v;
  }
  return best;
}

// ---------- Déroulement d'une main ----------
const seats = (state) => state.players.map((p, i) => i);
const inHand = (state, i) => !state.players[i].out && !state.players[i].folded;
const canAct = (state, i) => inHand(state, i) && !state.players[i].allin;

function nextSeat(state, from, pred) {
  const n = state.players.length;
  for (let k = 1; k <= n; k++) { const i = (from + k) % n; if (pred(i)) return i; }
  return -1;
}

function putChips(state, i, amount) {
  const pl = state.players[i];
  const a = Math.min(amount, pl.chips);
  pl.chips -= a; pl.bet += a; pl.total += a;
  if (pl.chips === 0) pl.allin = true;
  state.pot = state.players.reduce((s, p) => s + p.total, 0);
}

function newHand(state) {
  state.handNo++;
  if (state.handNo > 1 && (state.handNo - 1) % 8 === 0) {
    state.blinds = [Math.round(state.blinds[0] * 1.5 / 5) * 5, Math.round(state.blinds[1] * 1.5 / 10) * 10];
  }
  state._deck = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) state._deck.push({ r, s });
  shuffle(state._deck);
  state.board = [];
  state.results = null;
  state.revealed = {};
  state.players.forEach(p => { p.bet = 0; p.total = 0; p.folded = false; p.allin = false; p.lastAction = ''; });
  state._holes = state.players.map(p => (p.out ? [] : [state._deck.pop(), state._deck.pop()]));

  state.dealer = nextSeat(state, state.dealer, i => !state.players[i].out);
  const active = seats(state).filter(i => !state.players[i].out);
  const sb = active.length === 2 ? state.dealer : nextSeat(state, state.dealer, i => !state.players[i].out);
  const bb = nextSeat(state, sb, i => !state.players[i].out);
  putChips(state, sb, state.blinds[0]); state.players[sb].lastAction = 'Petite blinde';
  putChips(state, bb, state.blinds[1]); state.players[bb].lastAction = 'Grosse blinde';
  state.currentBet = state.blinds[1];
  state.minRaise = state.blinds[1];
  state.phase = 'preflop';
  state._acted = new Set();
  state.turn = nextSeat(state, bb, i => canAct(state, i));
  if (state.turn === -1 || !needsAction(state)) runOut(state);
}

function needsAction(state) {
  const actors = seats(state).filter(i => canAct(state, i));
  const pending = actors.filter(i => !state._acted.has(i) || state.players[i].bet < state.currentBet);
  if (actors.length === 0) return false;
  if (actors.length === 1 && state.players[actors[0]].bet >= state.currentBet) return false;
  return pending.length > 0;
}

function advance(state) {
  if (seats(state).filter(i => inHand(state, i)).length === 1) return finishHand(state);
  if (needsAction(state)) {
    state.turn = nextSeat(state, state.turn, i => canAct(state, i) && (!state._acted.has(i) || state.players[i].bet < state.currentBet));
    return;
  }
  // Tour d'enchères terminé : carte(s) suivante(s)
  state.players.forEach(p => { p.bet = 0; });
  state.currentBet = 0; state.minRaise = state.blinds[1];
  state._acted = new Set();
  if (state.phase === 'river') return finishHand(state);
  dealStreet(state);
  const actors = seats(state).filter(i => canAct(state, i));
  if (actors.length < 2) return runOut(state);
  state.turn = nextSeat(state, state.dealer, i => canAct(state, i));
}

function dealStreet(state) {
  if (state.phase === 'preflop') { state.board.push(state._deck.pop(), state._deck.pop(), state._deck.pop()); state.phase = 'flop'; }
  else if (state.phase === 'flop') { state.board.push(state._deck.pop()); state.phase = 'turn'; }
  else if (state.phase === 'turn') { state.board.push(state._deck.pop()); state.phase = 'river'; }
}

function runOut(state) {
  while (state.board.length < 5) dealStreet(state);
  state.phase = 'river';
  finishHand(state);
}

function finishHand(state) {
  const contenders = seats(state).filter(i => inHand(state, i));
  const results = {};
  const give = (i, amount, hand) => {
    state.players[i].chips += amount;
    results[i] = results[i] || { p: i, amount: 0, hand };
    results[i].amount += amount;
  };

  if (contenders.length === 1) {
    give(contenders[0], state.pot, null);
  } else {
    while (state.board.length < 5) state.board.push(state._deck.pop());
    const scores = {};
    contenders.forEach(i => { scores[i] = best7(state._holes[i].concat(state.board)); state.revealed[i] = state._holes[i]; });
    // Pots principaux et pots secondaires
    const levels = [...new Set(state.players.map(p => p.total).filter(t => t > 0))].sort((a, b) => a - b);
    let prev = 0;
    for (const level of levels) {
      const amount = state.players.reduce((s, p) => s + Math.max(0, Math.min(p.total, level) - prev), 0);
      let eligible = contenders.filter(i => state.players[i].total >= level);
      if (!eligible.length) eligible = contenders;
      let winners = [];
      for (const i of eligible) {
        if (!winners.length || compare(scores[i], scores[winners[0]]) > 0) winners = [i];
        else if (compare(scores[i], scores[winners[0]]) === 0) winners.push(i);
      }
      const share = Math.floor(amount / winners.length);
      winners.forEach((w, k) => give(w, share + (k === 0 ? amount - share * winners.length : 0), HAND_NAMES[scores[w][0]]));
      prev = level;
    }
  }
  state.results = Object.values(results).filter(r => r.amount > 0);
  state.pot = 0;
  state.phase = 'showdown';
  state.turn = -1;
  state.players.forEach(p => { if (p.chips === 0) p.out = true; });
  const left = state.players.filter(p => !p.out);
  if (left.length === 1) { state.over = true; state.winner = state.players.indexOf(left[0]); }
}

module.exports = {
  id: 'poker',
  name: 'Poker',
  description: "Texas Hold'em entre amis : bluff, relances et tapis.",
  category: 'Cartes',
  icon: '♠️',
  color: '#3ecf7a',
  order: 5,
  rules: "Chaque joueur reçoit 2 cartes cachées, puis 5 cartes communes sont révélées (flop, turn, river). À chaque étape : suis (call), parie/relance, check ou passe (fold). La meilleure combinaison de 5 cartes parmi tes 2 cartes et les 5 communes remporte le pot. Ordre des mains : carte haute, paire, double paire, brelan, quinte, couleur, full, carré, quinte flush. Les blindes augmentent toutes les 8 mains. Le dernier joueur avec des jetons gagne.",
  minPlayers: 2,
  maxPlayers: 8,

  setup(n) {
    const state = {
      players: Array.from({ length: n }, () => ({ chips: START, bet: 0, total: 0, folded: false, allin: false, out: false, lastAction: '' })),
      board: [], pot: 0, dealer: -1, turn: 0, phase: 'preflop', blinds: [5, 10], currentBet: 0, minRaise: 10,
      handNo: 0, results: null, revealed: {}, over: false, winner: null,
    };
    newHand(state);
    return state;
  },

  move(state, p, move) {
    if (state.over) return 'La partie est terminée.';
    if (move.type === 'next') {
      if (state.phase !== 'showdown') return 'La main est en cours.';
      newHand(state);
      return null;
    }
    if (p !== state.turn) return "Ce n'est pas ton tour.";
    const pl = state.players[p];
    const toCall = state.currentBet - pl.bet;

    switch (move.type) {
      case 'fold': pl.folded = true; pl.lastAction = 'Se couche'; break;
      case 'check':
        if (toCall > 0) return 'Tu dois suivre, relancer ou te coucher.';
        pl.lastAction = 'Check'; break;
      case 'call':
        if (toCall <= 0) return 'Rien à suivre : fais check.';
        putChips(state, p, toCall); pl.lastAction = pl.allin ? 'Tapis' : `Suit ${toCall}`; break;
      case 'raise': case 'allin': {
        const target = move.type === 'allin' ? pl.bet + pl.chips : Math.floor(Number(move.amount));
        if (move.type === 'allin' && target <= state.currentBet) { // tapis pour suivre (moins que la mise)
          putChips(state, p, pl.chips); pl.lastAction = 'Tapis'; break;
        }
        if (!(target > state.currentBet)) return 'La relance doit dépasser la mise actuelle.';
        if (target - pl.bet > pl.chips) return "Tu n'as pas assez de jetons.";
        const isFullRaise = target - state.currentBet >= state.minRaise;
        if (!isFullRaise && target - pl.bet < pl.chips) return `Relance minimum : ${state.currentBet + state.minRaise}.`;
        putChips(state, p, target - pl.bet);
        if (isFullRaise) { state.minRaise = target - state.currentBet; state._acted = new Set(); }
        state.currentBet = target;
        pl.lastAction = pl.allin ? 'Tapis !' : `Relance à ${target}`;
        break;
      }
      default: return 'Action inconnue.';
    }
    state._acted.add(p);
    advance(state);
    return null;
  },

  view(state, me) {
    return { ...state, hand: state._holes[me], me, handNames: HAND_NAMES };
  },
};

module.exports._test = { eval5, best7, compare };
