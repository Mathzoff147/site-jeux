// Échecs : règles complètes (roque, prise en passant, promotion, échec et mat, pat)
// Joueur 1 = Blancs (en bas), joueur 2 = Noirs.
const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK_D = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP_D = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const on = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const sq = (r, c) => r * 8 + c;

function initialBoard() {
  const b = Array(64).fill(null);
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let c = 0; c < 8; c++) {
    b[sq(0, c)] = { t: back[c], c: 1 }; b[sq(1, c)] = { t: 'p', c: 1 };
    b[sq(6, c)] = { t: 'p', c: 0 }; b[sq(7, c)] = { t: back[c], c: 0 };
  }
  return b;
}

// La case "target" est-elle attaquée par la couleur "by" ?
function attacked(b, target, by) {
  const r0 = Math.floor(target / 8), c0 = target % 8;
  const pawnRow = by === 0 ? r0 + 1 : r0 - 1;
  for (const dc of [-1, 1]) {
    if (on(pawnRow, c0 + dc)) { const x = b[sq(pawnRow, c0 + dc)]; if (x && x.c === by && x.t === 'p') return true; }
  }
  for (const [dr, dc] of KNIGHT) if (on(r0 + dr, c0 + dc)) { const x = b[sq(r0 + dr, c0 + dc)]; if (x && x.c === by && x.t === 'n') return true; }
  for (const [dr, dc] of KING) if (on(r0 + dr, c0 + dc)) { const x = b[sq(r0 + dr, c0 + dc)]; if (x && x.c === by && x.t === 'k') return true; }
  for (const [dirs, types] of [[ROOK_D, 'rq'], [BISHOP_D, 'bq']]) {
    for (const [dr, dc] of dirs) {
      let r = r0 + dr, c = c0 + dc;
      while (on(r, c)) {
        const x = b[sq(r, c)];
        if (x) { if (x.c === by && types.includes(x.t)) return true; break; }
        r += dr; c += dc;
      }
    }
  }
  return false;
}

const kingSquare = (b, color) => b.findIndex(x => x && x.t === 'k' && x.c === color);

function pseudoMoves(state, color) {
  const b = state.board, moves = [];
  for (let i = 0; i < 64; i++) {
    const pc = b[i];
    if (!pc || pc.c !== color) continue;
    const r0 = Math.floor(i / 8), c0 = i % 8;
    const add = (r, c) => { if (on(r, c) && (!b[sq(r, c)] || b[sq(r, c)].c !== color)) moves.push({ from: i, to: sq(r, c) }); };

    if (pc.t === 'p') {
      const dir = color === 0 ? -1 : 1, start = color === 0 ? 6 : 1;
      if (on(r0 + dir, c0) && !b[sq(r0 + dir, c0)]) {
        moves.push({ from: i, to: sq(r0 + dir, c0) });
        if (r0 === start && !b[sq(r0 + 2 * dir, c0)]) moves.push({ from: i, to: sq(r0 + 2 * dir, c0) });
      }
      for (const dc of [-1, 1]) {
        const r = r0 + dir, c = c0 + dc;
        if (!on(r, c)) continue;
        const t = sq(r, c);
        if ((b[t] && b[t].c !== color) || t === state.ep) moves.push({ from: i, to: t });
      }
    } else if (pc.t === 'n') {
      for (const [dr, dc] of KNIGHT) add(r0 + dr, c0 + dc);
    } else if (pc.t === 'k') {
      for (const [dr, dc] of KING) add(r0 + dr, c0 + dc);
      // Roque
      const row = color === 0 ? 7 : 0;
      if (i === sq(row, 4) && !attacked(b, i, 1 - color)) {
        const [kSide, qSide] = state.castle[color];
        if (kSide && !b[sq(row, 5)] && !b[sq(row, 6)] && !attacked(b, sq(row, 5), 1 - color)) moves.push({ from: i, to: sq(row, 6), castle: 'k' });
        if (qSide && !b[sq(row, 3)] && !b[sq(row, 2)] && !b[sq(row, 1)] && !attacked(b, sq(row, 3), 1 - color)) moves.push({ from: i, to: sq(row, 2), castle: 'q' });
      }
    } else {
      const dirs = pc.t === 'r' ? ROOK_D : pc.t === 'b' ? BISHOP_D : ROOK_D.concat(BISHOP_D);
      for (const [dr, dc] of dirs) {
        let r = r0 + dr, c = c0 + dc;
        while (on(r, c)) {
          const x = b[sq(r, c)];
          if (x) { if (x.c !== color) moves.push({ from: i, to: sq(r, c) }); break; }
          moves.push({ from: i, to: sq(r, c) });
          r += dr; c += dc;
        }
      }
    }
  }
  return moves;
}

// Joue un coup sur un état (sans vérification)
function apply(state, m, promo = 'q') {
  const b = state.board;
  const pc = b[m.from];
  const color = pc.c;
  let captured = b[m.to];
  // Prise en passant
  if (pc.t === 'p' && m.to === state.ep && !b[m.to]) {
    const capSq = m.to + (color === 0 ? 8 : -8);
    captured = b[capSq]; b[capSq] = null;
  }
  b[m.to] = pc; b[m.from] = null;
  // Roque : on déplace aussi la tour
  if (pc.t === 'k' && Math.abs(m.to - m.from) === 2) {
    const row = Math.floor(m.from / 8);
    if (m.to % 8 === 6) { b[sq(row, 5)] = b[sq(row, 7)]; b[sq(row, 7)] = null; }
    else { b[sq(row, 3)] = b[sq(row, 0)]; b[sq(row, 0)] = null; }
  }
  // Promotion
  const lastRow = color === 0 ? 0 : 7;
  if (pc.t === 'p' && Math.floor(m.to / 8) === lastRow) b[m.to] = { t: 'qrbn'.includes(promo) ? promo : 'q', c: color };
  // Droits de roque
  if (pc.t === 'k') state.castle[color] = [false, false];
  for (const [s, c, side] of [[63, 0, 0], [56, 0, 1], [7, 1, 0], [0, 1, 1]]) if (m.from === s || m.to === s) state.castle[c][side] = false;
  // Case de prise en passant
  state.ep = pc.t === 'p' && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : null;
  state.halfmove = pc.t === 'p' || captured ? 0 : state.halfmove + 1;
  return captured;
}

function clone(state) {
  return { board: state.board.slice(), castle: state.castle.map(x => x.slice()), ep: state.ep, halfmove: state.halfmove };
}

function legalMoves(state, color) {
  return pseudoMoves(state, color).filter(m => {
    const s = clone(state);
    apply(s, m);
    return !attacked(s.board, kingSquare(s.board, color), 1 - color);
  }).map(m => ({ from: m.from, to: m.to }));
}

function insufficient(b) {
  const pieces = b.filter(x => x && x.t !== 'k');
  return pieces.length === 0 || (pieces.length === 1 && 'bn'.includes(pieces[0].t));
}

module.exports = {
  id: 'echecs',
  name: 'Échecs',
  description: 'Le roi des jeux de stratégie, avec toutes les règles officielles.',
  category: 'Stratégie',
  icon: '♟️',
  color: '#e9ecf8',
  order: 4,
  rules: "Le joueur 1 a les Blancs et commence. Clique sur une pièce pour voir ses déplacements possibles, puis sur la case d'arrivée. Toutes les règles sont gérées : roque, prise en passant, promotion (tu choisis la pièce), échec, échec et mat, pat et matériel insuffisant. Le but : mettre le roi adverse échec et mat.",
  minPlayers: 2,
  maxPlayers: 2,

  setup() {
    const state = {
      board: initialBoard(), castle: [[true, true], [true, true]], ep: null, halfmove: 0,
      turn: 0, check: false, over: false, winner: null, last: null, captured: [[], []], moves: [], history: [],
    };
    state.moves = legalMoves(state, 0);
    return state;
  },

  move(state, p, move) {
    if (state.over) return 'La partie est terminée.';
    if (p !== state.turn) return "Ce n'est pas ton tour.";
    const m = state.moves.find(x => x.from === Number(move.from) && x.to === Number(move.to));
    if (!m) return 'Coup impossible.';
    const pc = state.board[m.from];
    const captured = apply(state, m, move.promo);
    if (captured) state.captured[p].push(captured.t);
    state.last = [m.from, m.to];
    const files = 'abcdefgh';
    state.history.push(`${pc.t === 'p' ? '' : pc.t.toUpperCase()}${files[m.from % 8]}${8 - Math.floor(m.from / 8)}${captured ? 'x' : '-'}${files[m.to % 8]}${8 - Math.floor(m.to / 8)}`);

    const next = 1 - p;
    state.turn = next;
    state.moves = legalMoves(state, next);
    state.check = attacked(state.board, kingSquare(state.board, next), p);
    if (!state.moves.length) {
      state.over = true;
      state.winner = state.check ? p : -1;
      state.resultText = state.check ? null : 'Pat : match nul !';
    } else if (insufficient(state.board) || state.halfmove >= 100) {
      state.over = true; state.winner = -1;
    }
    return null;
  },
};
