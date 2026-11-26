// =====================================================================
//  ÉCHECS — règles complètes (serveur)
//  Roque, prise en passant, promotion, échec/mat/pat, règle des 50 coups,
//  triple répétition, matériel insuffisant, pendules, abandon, nulle.
// =====================================================================
const U = require('./lib/util');
const FILES = 'abcdefgh';
const START = 'rnbqkbnrpppppppp' + '.'.repeat(32) + 'PPPPPPPPRNBQKBNR';
const isW = p => p !== '.' && p === p.toUpperCase();
const colorOf = p => p === '.' ? null : (isW(p) ? 'w' : 'b');
const sq = i => FILES[i % 8] + (8 - Math.floor(i / 8));
const FR = { P: '', N: 'C', B: 'F', R: 'T', Q: 'D', K: 'R' }; // notation française

function attacked(b, i, by) { // la case i est-elle attaquée par la couleur "by" ?
  const r = Math.floor(i / 8), c = i % 8;
  const at = (rr, cc) => rr >= 0 && rr < 8 && cc >= 0 && cc < 8 ? b[rr * 8 + cc] : null;
  const own = p => p && p !== '.' && colorOf(p) === by;
  const pd = by === 'w' ? 1 : -1; // un pion blanc attaque vers le haut (rangée -1), donc il se trouve en r+1
  for (const dc of [-1, 1]) { const p = at(r + pd, c + dc); if (own(p) && p.toUpperCase() === 'P') return true; }
  for (const [dr, dc] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) { const p = at(r + dr, c + dc); if (own(p) && p.toUpperCase() === 'N') return true; }
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const p = at(r + dr, c + dc); if (own(p) && p.toUpperCase() === 'K') return true; }
  for (const [dr, dc, kinds] of [[1, 0, 'RQ'], [-1, 0, 'RQ'], [0, 1, 'RQ'], [0, -1, 'RQ'], [1, 1, 'BQ'], [1, -1, 'BQ'], [-1, 1, 'BQ'], [-1, -1, 'BQ']]) {
    let rr = r + dr, cc = c + dc;
    while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
      const p = b[rr * 8 + cc];
      if (p !== '.') { if (own(p) && kinds.includes(p.toUpperCase())) return true; break; }
      rr += dr; cc += dc;
    }
  }
  return false;
}

function pseudo(s, side) {
  const b = s.board, out = [];
  for (let i = 0; i < 64; i++) {
    const p = b[i]; if (colorOf(p) !== side) continue;
    const r = Math.floor(i / 8), c = i % 8, P = p.toUpperCase();
    const add = (to, extra = {}) => out.push({ from: i, to, ...extra });
    const empty = (rr, cc) => rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === '.';
    const enemy = (rr, cc) => rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && colorOf(b[rr * 8 + cc]) === (side === 'w' ? 'b' : 'w');
    if (P === 'P') {
      const d = side === 'w' ? -1 : 1, startR = side === 'w' ? 6 : 1, lastR = side === 'w' ? 0 : 7;
      const pushPromo = (to, extra = {}) => { if (Math.floor(to / 8) === lastR) for (const pr of 'QRBN') add(to, { ...extra, promo: pr }); else add(to, extra); };
      if (empty(r + d, c)) { pushPromo((r + d) * 8 + c); if (r === startR && empty(r + 2 * d, c)) add((r + 2 * d) * 8 + c, { double: true }); }
      for (const dc of [-1, 1]) {
        if (enemy(r + d, c + dc)) pushPromo((r + d) * 8 + c + dc);
        if (s.ep != null && (r + d) * 8 + c + dc === s.ep && c + dc >= 0 && c + dc < 8) add(s.ep, { ep: true });
      }
    } else if (P === 'N' || P === 'K') {
      const deltas = P === 'N' ? [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (const [dr, dc] of deltas) if (empty(r + dr, c + dc) || enemy(r + dr, c + dc)) add((r + dr) * 8 + c + dc);
      if (P === 'K') {
        const opp = side === 'w' ? 'b' : 'w', row = side === 'w' ? 7 : 0;
        if (i === row * 8 + 4 && !attacked(b, i, opp)) {
          const K = side === 'w' ? 'K' : 'k', Q = side === 'w' ? 'Q' : 'q';
          if (s.castling.includes(K) && b[row * 8 + 5] === '.' && b[row * 8 + 6] === '.' && !attacked(b, row * 8 + 5, opp) && !attacked(b, row * 8 + 6, opp)) add(row * 8 + 6, { castle: 'K' });
          if (s.castling.includes(Q) && b[row * 8 + 3] === '.' && b[row * 8 + 2] === '.' && b[row * 8 + 1] === '.' && !attacked(b, row * 8 + 3, opp) && !attacked(b, row * 8 + 2, opp)) add(row * 8 + 2, { castle: 'Q' });
        }
      }
    } else {
      const dirs = P === 'R' ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : P === 'B' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
          if (empty(rr, cc)) add(rr * 8 + cc);
          else { if (enemy(rr, cc)) add(rr * 8 + cc); break; }
          rr += dr; cc += dc;
        }
      }
    }
  }
  return out;
}

function apply(s, m) { // modifie l'état ; retourne la pièce capturée
  const b = s.board, p = b[m.from], side = colorOf(p);
  let cap = b[m.to];
  b[m.to] = m.promo ? (side === 'w' ? m.promo : m.promo.toLowerCase()) : p; b[m.from] = '.';
  if (m.ep) { const ci = m.to + (side === 'w' ? 8 : -8); cap = b[ci]; b[ci] = '.'; }
  if (m.castle) { const row = side === 'w' ? 7 : 0; if (m.castle === 'K') { b[row * 8 + 5] = b[row * 8 + 7]; b[row * 8 + 7] = '.'; } else { b[row * 8 + 3] = b[row * 8]; b[row * 8] = '.'; } }
  s.ep = m.double ? (m.from + m.to) / 2 : null;
  const strip = chars => { s.castling = s.castling.split('').filter(x => !chars.includes(x)).join(''); };
  if (p === 'K') strip('KQ'); if (p === 'k') strip('kq');
  for (const [idx, ch] of [[63, 'K'], [56, 'Q'], [7, 'k'], [0, 'q']]) if (m.from === idx || m.to === idx) strip(ch);
  s.half = (p.toUpperCase() === 'P' || cap !== '.') ? 0 : s.half + 1;
  s.turn = side === 'w' ? 'b' : 'w';
  return cap;
}
const clone = s => ({ board: s.board.slice(), castling: s.castling, ep: s.ep, half: s.half, turn: s.turn });
const kingIdx = (b, side) => b.indexOf(side === 'w' ? 'K' : 'k');
function legal(s, side = s.turn) {
  return pseudo(s, side).filter(m => { const t = clone(s); apply(t, m); return !attacked(t.board, kingIdx(t.board, side), side === 'w' ? 'b' : 'w'); });
}
const inCheck = (s, side) => attacked(s.board, kingIdx(s.board, side), side === 'w' ? 'b' : 'w');
const posKey = s => s.board.join('') + s.turn + s.castling + (s.ep ?? '-');
function insufficient(b) {
  const pcs = b.filter(p => p !== '.' && p.toUpperCase() !== 'K').map(p => p.toUpperCase());
  return pcs.length === 0 || (pcs.length === 1 && 'BN'.includes(pcs[0]));
}
function san(s, m, moves) {
  const p = s.board[m.from], P = p.toUpperCase();
  if (m.castle) return m.castle === 'K' ? 'O-O' : 'O-O-O';
  const cap = s.board[m.to] !== '.' || m.ep;
  let t = FR[P];
  if (P === 'P') { if (cap) t += FILES[m.from % 8]; }
  else {
    const others = moves.filter(o => o.to === m.to && o.from !== m.from && s.board[o.from] === p);
    if (others.length) t += others.some(o => o.from % 8 === m.from % 8) ? sq(m.from)[1] : FILES[m.from % 8];
  }
  return t + (cap ? 'x' : '') + sq(m.to) + (m.promo ? '=' + FR[m.promo] : '');
}

function finish(s, result, reason) { s.result = result; s.reason = reason; s.phase = 'over'; }

module.exports = {
  id: 'chess',
  name: 'Échecs',
  description: 'Le grand classique : mettez le roi adverse échec et mat. Les autres joueurs regardent.',
  category: 'Réflexion', icon: '♞', color: '#a16207', order: 4,
  tags: ['🧠 Stratégie', '⏱ Pendule'],
  rules: `<ul><li>Cliquez sur une pièce puis sur une case en surbrillance (ou glissez-la).</li>
    <li>Toutes les règles officielles : roque, prise en passant, promotion, pat, nulle…</li>
    <li>Les 2 premiers joueurs du salon jouent, les suivants regardent la partie.</li>
    <li>Vous pouvez proposer la nulle ou abandonner.</li></ul>`,
  settings: [
    { key: 'time', label: 'Cadence', type: 'select', default: '10+0', options: [{ v: '0', l: 'Sans pendule' }, { v: '3+2', l: 'Blitz 3+2' }, { v: '5+0', l: '5 min' }, { v: '10+0', l: '10 min' }, { v: '15+10', l: '15+10' }, { v: '30+0', l: '30 min' }] },
    { key: 'white', label: 'Blancs pour', type: 'select', default: 'random', options: [{ v: 'random', l: 'Au hasard' }, { v: 'host', l: 'L’hôte' }, { v: 'guest', l: 'L’invité' }] },
  ],
  minPlayers: 2, maxPlayers: 12, tickRate: 2, joinInProgress: true,

  create(players, ctx, o) {
    let [a, b] = players;
    if (o.white === 'guest' || (o.white === 'random' && Math.random() < 0.5)) [a, b] = [b, a];
    const [base, inc] = String(o.time || '0').split('+').map(Number);
    const s = {
      board: START.split(''), turn: 'w', castling: 'KQkq', ep: null, half: 0,
      white: { id: a.id, name: a.name, color: a.color }, black: { id: b.id, name: b.name, color: b.color },
      spectators: players.slice(2).map(p => p.name),
      moves: [], last: null, captured: { w: [], b: [] }, reps: {}, drawOffer: null,
      clock: base ? { w: base * 60000, b: base * 60000, inc: (inc || 0) * 1000, last: null } : null,
      phase: 'play', result: null, reason: '',
    };
    s.reps[posKey(s)] = 1;
    return s;
  },
  onJoin(s, p) { s.spectators.push(p.name); },
  onLeave(s, id) {
    if (s.phase !== 'play') return;
    if (s.white.id === id) finish(s, '0-1', `${s.white.name} a quitté la partie`);
    if (s.black.id === id) finish(s, '1-0', `${s.black.name} a quitté la partie`);
  },
  tick(s) {
    if (s.phase !== 'play' || !s.clock || s.clock.last == null) return;
    const now = Date.now(), side = s.turn, left = s.clock[side] - (now - s.clock.last);
    if (left <= 0) {
      s.clock[side] = 0;
      const other = side === 'w' ? 'b' : 'w';
      const mat = s.board.some(p => colorOf(p) === other && p.toUpperCase() !== 'K');
      finish(s, mat ? (side === 'w' ? '0-1' : '1-0') : '½-½', mat ? 'Temps écoulé' : 'Temps écoulé, matériel insuffisant');
    }
  },
  broadcastOnAction: true,

  onAction(s, id, a, ctx) {
    if (s.phase !== 'play') return;
    const side = s.white.id === id ? 'w' : s.black.id === id ? 'b' : null;
    if (!side) return { error: 'Vous regardez la partie' };
    switch (a.type) {
      case 'move': {
        if (s.turn !== side) return { error: "Ce n'est pas votre tour" };
        const moves = legal(s);
        const m = moves.find(x => x.from === +a.from && x.to === +a.to && (!x.promo || x.promo === (a.promo || 'Q')));
        if (!m) return { error: 'Coup illégal' };
        const now = Date.now();
        if (s.clock) {
          if (s.clock.last != null) s.clock[side] -= now - s.clock.last;
          s.clock[side] += s.clock.inc; s.clock.last = now;
        }
        let txt = san(s, m, moves);
        const cap = apply(s, m);
        if (cap !== '.') s.captured[side].push(cap);
        const opp = s.turn, oppMoves = legal(s), chk = inCheck(s, opp);
        txt += !oppMoves.length && chk ? '#' : chk ? '+' : '';
        s.moves.push(txt); s.last = { from: m.from, to: m.to }; s.drawOffer = null;
        const k = posKey(s); s.reps[k] = (s.reps[k] || 0) + 1;
        ctx.emit({ type: 'moved', cap: cap !== '.', check: chk, castle: !!m.castle });
        if (!oppMoves.length) finish(s, chk ? (side === 'w' ? '1-0' : '0-1') : '½-½', chk ? 'Échec et mat' : 'Pat');
        else if (s.half >= 100) finish(s, '½-½', 'Règle des 50 coups');
        else if (s.reps[k] >= 3) finish(s, '½-½', 'Triple répétition');
        else if (insufficient(s.board)) finish(s, '½-½', 'Matériel insuffisant');
        return;
      }
      case 'resign': finish(s, side === 'w' ? '0-1' : '1-0', `${side === 'w' ? s.white.name : s.black.name} abandonne`); return;
      case 'offerDraw': s.drawOffer = side; return;
      case 'acceptDraw': if (s.drawOffer && s.drawOffer !== side) finish(s, '½-½', 'Nulle par accord mutuel'); return;
      case 'declineDraw': if (s.drawOffer && s.drawOffer !== side) s.drawOffer = null; return;
    }
  },

  view(s, id) {
    const side = s.white.id === id ? 'w' : s.black.id === id ? 'b' : null;
    let clock = null;
    if (s.clock) {
      clock = { w: s.clock.w, b: s.clock.b };
      if (s.phase === 'play' && s.clock.last != null) clock[s.turn] = Math.max(0, clock[s.turn] - (Date.now() - s.clock.last));
    }
    const legalMoves = side && s.turn === side && s.phase === 'play' ? legal(s).map(m => [m.from, m.to, m.promo || '']) : [];
    return {
      board: s.board.join(''), turn: s.turn, me: side, white: s.white, black: s.black, spectators: s.spectators,
      moves: s.moves, last: s.last, captured: s.captured, check: s.phase === 'play' && inCheck(s, s.turn) ? kingIdx(s.board, s.turn) : null,
      clock, drawOffer: s.drawOffer, phase: s.phase, result: s.result, reason: s.reason, legal: legalMoves,
    };
  },
};
