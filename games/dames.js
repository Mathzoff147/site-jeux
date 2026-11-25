// Jeu de dames (8x8) : 2 joueurs
// - Les pions avancent en diagonale et prennent dans les deux sens.
// - La prise est obligatoire, et les rafles (prises en chaîne) aussi.
// - Un pion qui finit son tour sur la dernière rangée devient une dame :
//   elle se déplace et prend à n'importe quelle distance en diagonale.
const N = 8;
const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const inside = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
const at = (b, r, c) => b[r * N + c];

// Liste des coups possibles d'une pièce : [{ from, to, cap }]
function pieceMoves(board, i, capturesOnly) {
  const piece = board[i];
  const r0 = Math.floor(i / N), c0 = i % N;
  const forward = piece.p === 0 ? -1 : 1;
  const moves = [];

  for (const [dr, dc] of DIRS) {
    if (piece.king) {
      let r = r0 + dr, c = c0 + dc;
      while (inside(r, c) && !at(board, r, c)) {
        if (!capturesOnly) moves.push({ from: i, to: r * N + c, cap: null });
        r += dr; c += dc;
      }
      if (inside(r, c) && at(board, r, c).p !== piece.p) {
        const cap = r * N + c;
        r += dr; c += dc;
        while (inside(r, c) && !at(board, r, c)) {
          moves.push({ from: i, to: r * N + c, cap });
          r += dr; c += dc;
        }
      }
    } else {
      const r1 = r0 + dr, c1 = c0 + dc, r2 = r0 + 2 * dr, c2 = c0 + 2 * dc;
      if (inside(r2, c2) && at(board, r1, c1) && at(board, r1, c1).p !== piece.p && !at(board, r2, c2)) {
        moves.push({ from: i, to: r2 * N + c2, cap: r1 * N + c1 });
      }
      if (!capturesOnly && dr === forward && inside(r1, c1) && !at(board, r1, c1)) {
        moves.push({ from: i, to: r1 * N + c1, cap: null });
      }
    }
  }
  return moves;
}

function legalMoves(state, p) {
  const sources = state.chain !== null ? [state.chain]
    : state.board.map((x, i) => (x && x.p === p ? i : -1)).filter(i => i >= 0);
  let all = [];
  for (const i of sources) all = all.concat(pieceMoves(state.board, i, state.chain !== null));
  const captures = all.filter(m => m.cap !== null);
  return captures.length ? captures : all;
}

module.exports = {
  id: 'dames',
  name: 'Dames',
  description: 'Le grand classique : prises obligatoires, rafles et dames volantes.',
  category: 'Jeu de société',
  icon: '⚫',
  color: '#c58cff',
  order: 6,
  rules: "Les pions avancent d'une case en diagonale. Pour prendre, saute par-dessus une pièce adverse (aussi en arrière). La prise est obligatoire, et si tu peux reprendre avec la même pièce, tu continues (rafle). Un pion qui termine sur la dernière rangée devient une dame (♛), qui se déplace d'autant de cases qu'elle veut en diagonale. Tu gagnes si l'adversaire n'a plus de pièces ou ne peut plus bouger.",
  minPlayers: 2,
  maxPlayers: 2,

  setup() {
    const board = Array(N * N).fill(null);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if ((r + c) % 2 === 0) continue;
      if (r < 3) board[r * N + c] = { p: 1, king: false };
      if (r > 4) board[r * N + c] = { p: 0, king: false };
    }
    const state = { board, turn: 0, chain: null, over: false, winner: null, last: null, plies: 0, moves: [] };
    state.moves = legalMoves(state, 0);
    return state;
  },

  move(state, player, move) {
    if (state.over) return 'La partie est terminée.';
    if (player !== state.turn) return "Ce n'est pas ton tour.";
    const m = legalMoves(state, player).find(x => x.from === Number(move.from) && x.to === Number(move.to));
    if (!m) return state.moves.some(x => x.cap !== null) ? 'La prise est obligatoire !' : 'Coup impossible.';

    const piece = state.board[m.from];
    state.board[m.to] = piece;
    state.board[m.from] = null;
    if (m.cap !== null) state.board[m.cap] = null;
    state.last = [m.from, m.to];
    state.plies++;

    // Rafle : la même pièce doit continuer si elle peut encore prendre
    if (m.cap !== null && pieceMoves(state.board, m.to, true).length) {
      state.chain = m.to;
      state.moves = legalMoves(state, player);
      return null;
    }

    state.chain = null;
    const row = Math.floor(m.to / N);
    if (!piece.king && ((piece.p === 0 && row === 0) || (piece.p === 1 && row === N - 1))) piece.king = true;

    const next = 1 - player;
    state.turn = next;
    state.moves = legalMoves(state, next);
    if (!state.moves.length) { state.over = true; state.winner = player; }
    else if (state.plies >= 200) { state.over = true; state.winner = -1; }
    return null;
  },
};
