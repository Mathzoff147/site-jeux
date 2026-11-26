// =====================================================================
//  POKER (Texas Hold'em, sans limite) — règles (serveur)
//  Blindes, 4 tours d'enchères, tapis, pots secondaires, abattage avec
//  évaluation des mains, élimination jusqu'au dernier joueur.
// =====================================================================
const U = require('./lib/util');
const RN = { 11: 'Valet', 12: 'Dame', 13: 'Roi', 14: 'As' };
const HAND_NAMES = ['Carte haute', 'Paire', 'Double paire', 'Brelan', 'Quinte', 'Couleur', 'Full', 'Carré', 'Quinte flush', 'Quinte flush royale'];

function deck() { const d = []; for (const s of 'shdc') for (let r = 2; r <= 14; r++) d.push(r + s); return U.shuffle(d); }
const rank = c => parseInt(c), suit = c => c.slice(-1);

// Évalue 5 cartes -> tableau comparable [catégorie, départages…]
function eval5(cards) {
  const rs = cards.map(rank).sort((a, b) => b - a), ss = cards.map(suit);
  const flush = ss.every(s => s === ss[0]);
  const uniq = [...new Set(rs)];
  let straightHigh = 0;
  if (uniq.length === 5) { if (rs[0] - rs[4] === 4) straightHigh = rs[0]; else if (rs.join() === '14,5,4,3,2') straightHigh = 5; }
  const cnt = {}; rs.forEach(r => { cnt[r] = (cnt[r] || 0) + 1; });
  const groups = Object.entries(cnt).map(([r, n]) => [n, +r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const byGroup = groups.map(g => g[1]);
  if (straightHigh && flush) return [straightHigh === 14 ? 9 : 8, straightHigh];
  if (groups[0][0] === 4) return [7, ...byGroup];
  if (groups[0][0] === 3 && groups[1][0] === 2) return [6, ...byGroup];
  if (flush) return [5, ...rs];
  if (straightHigh) return [4, straightHigh];
  if (groups[0][0] === 3) return [3, ...byGroup];
  if (groups[0][0] === 2 && groups[1][0] === 2) return [2, ...byGroup];
  if (groups[0][0] === 2) return [1, ...byGroup];
  return [0, ...rs];
}
const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; };
function best(cards) {
  let top = null, topCards = null;
  const n = cards.length, pick = [];
  const rec = start => {
    if (pick.length === 5) { const five = pick.map(i => cards[i]); const e = eval5(five); if (!top || cmp(e, top) > 0) { top = e; topCards = five; } return; }
    for (let i = start; i <= n - (5 - pick.length); i++) { pick.push(i); rec(i + 1); pick.pop(); }
  };
  rec(0);
  return { score: top, cards: topCards, name: HAND_NAMES[top[0]] };
}

const log = (s, m) => { s.log.push(m); if (s.log.length > 50) s.log.shift(); };
const seated = s => s.players.filter(p => !p.out);
const inHand = s => s.players.filter(p => p.inHand);
const canAct = s => s.players.filter(p => p.inHand && !p.allIn);
function nextSeat(s, from, pred) { const n = s.players.length; for (let k = 1; k <= n; k++) { const i = (from + k) % n; if (pred(s.players[i])) return i; } return -1; }

function newHand(s) {
  if (seated(s).length < 2) { s.phase = 'over'; s.winner = seated(s)[0]?.id; return; }
  s.handNo++;
  if (s.blindUp && s.handNo > 1 && (s.handNo - 1) % s.blindUp === 0) { s.sb *= 2; s.bb *= 2; log(s, `⬆️ Les blindes montent : ${s.sb}/${s.bb}`); }
  s.deck = deck(); s.board = []; s.pot = 0; s.showdown = null; s.winners = null;
  for (const p of s.players) Object.assign(p, { cards: [], bet: 0, total: 0, inHand: !p.out, allIn: false, acted: false, folded: false, show: false, lastAction: '' });
  s.dealer = nextSeat(s, s.dealer, p => !p.out);
  const heads = seated(s).length === 2;
  const sbI = heads ? s.dealer : nextSeat(s, s.dealer, p => !p.out), bbI = nextSeat(s, sbI, p => !p.out);
  for (const p of seated(s)) p.cards = [s.deck.pop(), s.deck.pop()];
  post(s, s.players[sbI], s.sb, 'Petite blinde'); post(s, s.players[bbI], s.bb, 'Grosse blinde');
  s.sbI = sbI; s.bbI = bbI;
  s.currentBet = s.bb; s.minRaise = s.bb; s.street = 'preflop'; s.phase = 'bet';
  s.turn = nextSeat(s, bbI, p => p.inHand && !p.allIn);
  s.turnStart = Date.now();
  log(s, `— Main n°${s.handNo} (blindes ${s.sb}/${s.bb}) —`);
  if (s.turn < 0 || canAct(s).length === 0 || (canAct(s).length === 1 && s.players[s.turn].bet >= s.currentBet)) runOut(s);
}
function post(s, p, amt, what) { const a = Math.min(amt, p.chips); p.chips -= a; p.bet += a; p.total += a; if (!p.chips) p.allIn = true; p.lastAction = `${what} ${a}`; }

function act(s, p, kind, amount) {
  const toCall = s.currentBet - p.bet;
  if (kind === 'fold') { p.inHand = false; p.folded = true; p.lastAction = 'Se couche'; log(s, `${p.name} se couche.`); }
  else if (kind === 'check') { if (toCall > 0) return 'Vous devez suivre ou relancer'; p.lastAction = 'Parole'; log(s, `${p.name} parle.`); }
  else if (kind === 'call') { const a = Math.min(toCall, p.chips); p.chips -= a; p.bet += a; p.total += a; if (!p.chips) p.allIn = true; p.lastAction = p.allIn ? `Tapis ${p.bet}` : `Suit ${a}`; log(s, `${p.name} suit (${a}).`); }
  else if (kind === 'raise' || kind === 'allin') {
    let target = kind === 'allin' ? p.bet + p.chips : Math.floor(amount);
    if (target > p.bet + p.chips) return 'Pas assez de jetons';
    const raiseBy = target - s.currentBet;
    if (target < p.bet + p.chips && raiseBy < s.minRaise) return `Relance minimum : ${s.currentBet + s.minRaise}`;
    if (target <= s.currentBet && target < p.bet + p.chips) return 'Montant trop faible';
    const a = target - p.bet; p.chips -= a; p.bet += a; p.total += a; if (!p.chips) p.allIn = true;
    if (p.bet > s.currentBet) { if (raiseBy >= s.minRaise) { s.minRaise = raiseBy; for (const q of s.players) if (q !== p) q.acted = false; } s.currentBet = p.bet; }
    p.lastAction = p.allIn ? `Tapis ${p.bet}` : `Relance à ${p.bet}`;
    log(s, `${p.name} ${p.allIn ? 'fait tapis' : 'relance'} à ${p.bet}.`);
  } else return 'Action inconnue';
  p.acted = true;
  advance(s);
  return null;
}

function advance(s) {
  if (inHand(s).length === 1) return award(s, true);
  const pending = s.players.filter(p => p.inHand && !p.allIn && (!p.acted || p.bet < s.currentBet));
  if (pending.length) { s.turn = nextSeat(s, s.turn, p => p.inHand && !p.allIn && (!p.acted || p.bet < s.currentBet)); s.turnStart = Date.now(); return; }
  nextStreet(s);
}
function collect(s) { for (const p of s.players) { s.pot += p.bet; p.bet = 0; p.acted = false; } s.currentBet = 0; s.minRaise = s.bb; }
function nextStreet(s) {
  collect(s);
  if (s.street === 'river') return award(s);
  if (s.street === 'preflop') { s.board.push(s.deck.pop(), s.deck.pop(), s.deck.pop()); s.street = 'flop'; }
  else if (s.street === 'flop') { s.board.push(s.deck.pop()); s.street = 'turn'; }
  else { s.board.push(s.deck.pop()); s.street = 'river'; }
  log(s, `${{ flop: 'Flop', turn: 'Turn', river: 'River' }[s.street]} : ${s.board.join(' ')}`);
  if (canAct(s).length <= 1) return runOut(s);
  s.turn = nextSeat(s, s.dealer, p => p.inHand && !p.allIn); s.turnStart = Date.now();
}
function runOut(s) { // plus personne ne peut miser : on dévoile tout
  collect(s);
  for (const p of inHand(s)) p.show = true;
  while (s.board.length < 5) s.board.push(s.deck.pop());
  s.street = 'river';
  award(s);
}

function award(s, noShow) {
  collect(s);
  const contenders = inHand(s);
  s.winners = [];
  if (noShow) {
    const w = contenders[0]; w.chips += s.pot;
    s.winners.push({ id: w.id, amount: s.pot, hand: '' });
    log(s, `💰 ${w.name} remporte ${s.pot} (tout le monde s'est couché).`);
  } else {
    const ev = new Map(contenders.map(p => [p.id, best([...p.cards, ...s.board])]));
    for (const p of contenders) { p.show = true; p.hand = ev.get(p.id).name; }
    // pots secondaires selon les mises totales
    const levels = [...new Set(s.players.filter(p => p.total > 0).map(p => p.total))].sort((a, b) => a - b);
    let prev = 0;
    for (const lv of levels) {
      const amount = s.players.reduce((a, p) => a + Math.max(0, Math.min(p.total, lv) - prev), 0);
      const elig = contenders.filter(p => p.total >= lv);
      prev = lv;
      if (!amount) continue;
      if (!elig.length) { // personne d'éligible : rendu au plus gros contributeur restant
        const back = s.players.filter(p => p.total >= lv)[0]; if (back) back.chips += amount; continue;
      }
      let top = null, ws = [];
      for (const p of elig) { const c = top ? cmp(ev.get(p.id).score, top) : 1; if (c > 0) { top = ev.get(p.id).score; ws = [p]; } else if (c === 0) ws.push(p); }
      const share = Math.floor(amount / ws.length); let rest = amount - share * ws.length;
      for (const w of ws) { const g = share + (rest-- > 0 ? 1 : 0); w.chips += g; const e = s.winners.find(x => x.id === w.id); if (e) e.amount += g; else s.winners.push({ id: w.id, amount: g, hand: ev.get(w.id).name, best: ev.get(w.id).cards }); }
    }
    for (const w of s.winners) log(s, `🏆 ${s.players.find(p => p.id === w.id).name} gagne ${w.amount} avec ${w.hand}.`);
  }
  s.pot = 0;
  for (const p of s.players) if (!p.out && p.chips <= 0) { p.out = true; log(s, `💀 ${p.name} est éliminé.`); }
  s.phase = 'showdown'; s.nextAt = Date.now() + (noShow ? 3500 : 7000);
  if (seated(s).length < 2) { s.phase = 'over'; s.winner = seated(s)[0]?.id; }
}

module.exports = {
  id: 'poker',
  name: 'Poker Hold’em',
  description: 'Texas Hold’em sans limite : bluffez, relancez, faites tapis. Le dernier avec des jetons gagne.',
  category: 'Plateau & cartes', icon: '🂡', color: '#059669', order: 13,
  tags: ['🃏 Bluff', '💰 Jetons'],
  rules: `<ul><li>Chacun reçoit 2 cartes cachées ; 5 cartes communes sont dévoilées en 3 temps (flop, turn, river).</li>
    <li>À chaque tour : <b>parole</b>, <b>suivre</b>, <b>relancer</b>, <b>tapis</b> ou <b>se coucher</b>.</li>
    <li>La meilleure combinaison de 5 cartes gagne le pot (paire, double paire, brelan, quinte, couleur, full, carré…).</li>
    <li>Sans jetons, vous êtes éliminé. Le dernier joueur gagne.</li></ul>`,
  settings: [
    { key: 'chips', label: 'Jetons de départ', type: 'select', default: 1000, options: [{ v: 500, l: '500' }, { v: 1000, l: '1 000' }, { v: 2000, l: '2 000' }, { v: 5000, l: '5 000' }] },
    { key: 'blinds', label: 'Blindes', type: 'select', default: 10, options: [{ v: 5, l: '5 / 10' }, { v: 10, l: '10 / 20' }, { v: 25, l: '25 / 50' }, { v: 50, l: '50 / 100' }] },
    { key: 'blindUp', label: 'Blindes doublées toutes les', type: 'select', default: 10, options: [{ v: 0, l: 'Jamais' }, { v: 5, l: '5 mains' }, { v: 10, l: '10 mains' }, { v: 20, l: '20 mains' }] },
    { key: 'timer', label: 'Temps pour jouer', type: 'select', default: 30, options: [{ v: 0, l: 'Illimité' }, { v: 15, l: '15 s' }, { v: 30, l: '30 s' }, { v: 60, l: '60 s' }] },
  ],
  minPlayers: 2, maxPlayers: 9, tickRate: 2,

  create(players, ctx, o) {
    const s = {
      players: U.shuffle(players.slice()).map(p => ({ ...p, chips: o.chips || 1000, cards: [], bet: 0, total: 0, inHand: false, out: false })),
      sb: o.blinds || 10, bb: (o.blinds || 10) * 2, blindUp: o.blindUp || 0, timer: o.timer || 0,
      dealer: -1, handNo: 0, log: [], board: [], pot: 0, phase: 'bet', winner: null,
    };
    s.dealer = Math.floor(Math.random() * s.players.length) - 1;
    newHand(s);
    return s;
  },
  onJoin() {},
  onLeave(s, id) {
    const i = s.players.findIndex(p => p.id === id); if (i < 0) return;
    const p = s.players[i];
    log(s, `${p.name} a quitté la table.`);
    const wasTurn = s.phase === 'bet' && s.turn === i;
    if (p.inHand) { p.inHand = false; p.folded = true; }
    p.out = true; p.chips = 0;
    if (s.phase === 'bet') { if (inHand(s).length <= 1) award(s, true); else if (wasTurn) advance(s); }
    if (seated(s).length < 2 && s.phase !== 'over') { s.phase = 'over'; s.winner = seated(s)[0]?.id; }
  },
  tick(s) {
    const now = Date.now();
    if (s.phase === 'showdown' && now >= s.nextAt) newHand(s);
    if (s.phase === 'bet' && s.timer && now - s.turnStart > s.timer * 1000) {
      const p = s.players[s.turn];
      act(s, p, s.currentBet - p.bet > 0 ? 'fold' : 'check');
    }
  },
  broadcastOnAction: true,

  onAction(s, id, a, ctx) {
    if (s.phase !== 'bet') return;
    const p = s.players[s.turn];
    if (!p || p.id !== id) return { error: "Ce n'est pas votre tour" };
    const e = act(s, p, a.type, a.amount);
    if (e) return { error: e };
    ctx.emit({ type: 'act', kind: a.type });
  },

  view(s, id) {
    const reveal = s.phase === 'showdown' || s.phase === 'over';
    const me = s.players.find(p => p.id === id);
    const turnP = s.phase === 'bet' ? s.players[s.turn] : null;
    return {
      phase: s.phase, street: s.street, board: s.board, pot: s.pot + s.players.reduce((a, p) => a + p.bet, 0), handNo: s.handNo,
      sb: s.sb, bb: s.bb, dealer: s.dealer, sbI: s.sbI, bbI: s.bbI, turn: s.phase === 'bet' ? s.turn : -1, currentBet: s.currentBet, minRaise: s.minRaise,
      timer: s.timer, timeLeft: s.timer && s.phase === 'bet' ? Math.max(0, s.timer * 1000 - (Date.now() - s.turnStart)) : 0,
      winners: s.winners, winner: s.winner, log: s.log.slice(-25),
      players: s.players.map(p => ({
        id: p.id, name: p.name, color: p.color, chips: p.chips, bet: p.bet, inHand: p.inHand, allIn: p.allIn, out: p.out, folded: p.folded, lastAction: p.lastAction,
        cards: p.id === id || (reveal && p.show) ? p.cards : p.cards.length ? ['?', '?'] : [], hand: reveal && p.show ? p.hand : null,
      })),
      myHand: me && me.cards.length === 2 && s.board.length >= 3 ? best([...me.cards, ...s.board]).name : null,
      toCall: me && turnP?.id === id ? s.currentBet - me.bet : 0,
    };
  },
  _test: { best, eval5 },
};
