// =====================================================================
//  BLACKJACK — règles (serveur)
//  Jusqu'à 7 joueurs contre le croupier. Mises, assurance, doubler,
//  séparer (jusqu'à 4 mains), abandon, sabot de plusieurs paquets.
// =====================================================================
const U = require('./lib/util');

function shoe(decks) {
  const d = [];
  for (let k = 0; k < decks; k++) for (const s of 'shdc') for (let r = 1; r <= 13; r++) d.push(r + s);
  return U.shuffle(d);
}
const val = c => { const r = parseInt(c); return r === 1 ? 11 : Math.min(10, r); };
function total(cards) {
  let t = 0, aces = 0;
  for (const c of cards) { t += val(c); if (parseInt(c) === 1) aces++; }
  while (t > 21 && aces) { t -= 10; aces--; }
  return { t, soft: aces > 0 && t <= 21 };
}
const isBJ = h => h.cards.length === 2 && total(h.cards).t === 21 && !h.fromSplit;
const log = (s, m) => { s.log.push(m); if (s.log.length > 40) s.log.shift(); };

function draw(s) {
  if (s.shoe.length < 15) { s.shoe = shoe(s.decks); s.reshuffled = true; }
  return s.shoe.pop();
}
const seated = s => s.players.filter(p => !p.out && !p.left);

function startBetting(s) {
  s.round++;
  if (s.maxRounds && s.round > s.maxRounds) return finish(s);
  if (!seated(s).length) return finish(s);
  s.phase = 'bet'; s.until = Date.now() + s.timer * 1000;
  s.dealer = { cards: [], hidden: true };
  for (const p of s.players) { p.hands = []; p.bet = 0; p.ready = false; p.insurance = 0; p.net = 0; }
  log(s, `— Manche ${s.round}${s.maxRounds ? ` / ${s.maxRounds}` : ''} : faites vos jeux —`);
}
function deal(s) {
  const players = seated(s).filter(p => p.bet > 0);
  // ceux qui n'ont pas misé sautent la manche
  if (!players.length) { s.until = Date.now() + s.timer * 1000; return; }
  for (const p of players) { p.chips -= p.bet; p.hands = [{ cards: [], bet: p.bet, done: false }]; }
  for (let k = 0; k < 2; k++) { for (const p of players) p.hands[0].cards.push(draw(s)); s.dealer.cards.push(draw(s)); }
  s.order = players.map(p => p.id); s.turn = 0; s.hand = 0;
  const up = s.dealer.cards[0];
  if (parseInt(up) === 1 && s.insuranceOn) { s.phase = 'insurance'; s.until = Date.now() + 10000; log(s, 'Le croupier montre un As : assurance ?'); return; }
  afterInsurance(s);
}
function afterInsurance(s) {
  const dealerBJ = total(s.dealer.cards).t === 21;
  // le croupier vérifie son blackjack si sa carte visible vaut 10 ou As
  if (dealerBJ && val(s.dealer.cards[0]) >= 10) { log(s, '😱 Le croupier a un Blackjack !'); return dealerPlay(s, true); }
  for (const id of s.order) { const p = s.players.find(q => q.id === id); if (p && isBJ(p.hands[0])) { p.hands[0].done = true; log(s, `🎉 ${p.name} : BLACKJACK !`); } }
  s.phase = 'play'; s.turn = -1; nextHand(s);
}
function current(s) { const p = s.players.find(q => q.id === s.order[s.turn]); return p && { p, h: p.hands[s.hand] }; }
function nextHand(s) {
  // passe à la prochaine main non terminée
  while (true) {
    const c = current(s);
    if (c && !c.p.left) { const i = c.p.hands.findIndex(h => !h.done); if (i >= 0) { s.hand = i; s.until = Date.now() + s.timer * 1000; return; } }
    s.turn++; s.hand = 0;
    if (s.turn >= s.order.length) return dealerPlay(s);
  }
}
function dealerPlay(s, dealerBJ) {
  s.phase = 'dealer'; s.dealer.hidden = false;
  const live = s.order.some(id => s.players.find(q => q.id === id)?.hands.some(h => !h.bust && !h.surrendered && !isBJ(h)));
  if (!dealerBJ && live) {
    while (true) { const { t, soft } = total(s.dealer.cards); if (t < 17 || (t === 17 && soft && s.h17)) s.dealer.cards.push(draw(s)); else break; }
  }
  s.dealerSteps = s.dealer.cards.length; s.phase = 'reveal'; s.until = Date.now() + 900 + (s.dealer.cards.length - 2) * 700;
}
function payout(s) {
  const d = total(s.dealer.cards).t, dBJ = s.dealer.cards.length === 2 && d === 21, dBust = d > 21;
  log(s, `Croupier : ${dBJ ? 'Blackjack' : dBust ? `${d}, il saute !` : d}`);
  for (const id of s.order) {
    const p = s.players.find(q => q.id === id); if (!p) continue;
    if (p.insurance) { if (dBJ) { p.chips += p.insurance * 3; p.net += p.insurance * 2; } else p.net -= p.insurance; }
    for (const h of p.hands) {
      const t = total(h.cards).t; let win = 0;
      if (h.surrendered) { win = h.bet / 2; h.result = 'Abandon'; }
      else if (h.bust) { h.result = 'Sauté'; }
      else if (isBJ(h) && !dBJ) { win = h.bet + Math.floor(h.bet * s.bjPay); h.result = 'Blackjack !'; }
      else if (dBJ && !isBJ(h)) { h.result = 'Perdu'; }
      else if (dBust || t > d) { win = h.bet * 2; h.result = 'Gagné'; }
      else if (t === d) { win = h.bet; h.result = 'Égalité'; }
      else h.result = 'Perdu';
      p.chips += win; h.win = win - h.bet; p.net += win - h.bet;
    }
    p.best = Math.max(p.best, p.chips);
    if (p.net) log(s, `${p.name} ${p.net > 0 ? 'gagne' : 'perd'} ${Math.abs(p.net)}`);
    if (p.chips < s.minBet) { p.out = true; log(s, `💸 ${p.name} n'a plus assez de jetons.`); }
  }
  s.phase = 'payout'; s.until = Date.now() + 5000;
}
function finish(s) { s.phase = 'over'; s.over = true; }

module.exports = {
  id: 'blackjack',
  name: 'Blackjack',
  description: 'Battez le croupier sans dépasser 21 ! Doublez, séparez, assurez-vous… jusqu’à 7 joueurs autour de la table.',
  category: 'Plateau & cartes', icon: '🂱', color: '#0f766e', order: 13.5,
  tags: ['🃏 Casino', '💰 Jetons'],
  rules: `<ul><li>Approchez-vous de <b>21</b> sans le dépasser. Figures = 10, As = 1 ou 11.</li>
    <li><b>Tirer</b> une carte, <b>Rester</b>, <b>Doubler</b> (mise ×2, une seule carte), <b>Séparer</b> une paire, <b>Abandonner</b> (récupère la moitié).</li>
    <li>Le croupier tire jusqu’à 17. Blackjack (As + 10 d’entrée) payé 3 pour 2.</li>
    <li>Le joueur avec le plus de jetons à la fin gagne. Plus de jetons ? Vous êtes éliminé.</li></ul>`,
  settings: [
    { key: 'chips', label: 'Jetons de départ', type: 'select', default: 1000, options: [{ v: 500, l: '500' }, { v: 1000, l: '1 000' }, { v: 5000, l: '5 000' }] },
    { key: 'minBet', label: 'Mise minimum', type: 'select', default: 10, options: [{ v: 5, l: '5' }, { v: 10, l: '10' }, { v: 25, l: '25' }, { v: 100, l: '100' }] },
    { key: 'rounds', label: 'Nombre de manches', type: 'select', default: 15, options: [{ v: 10, l: '10' }, { v: 15, l: '15' }, { v: 25, l: '25' }, { v: 0, l: 'Illimité' }] },
    { key: 'decks', label: 'Paquets dans le sabot', type: 'select', default: 6, options: [{ v: 1, l: '1' }, { v: 2, l: '2' }, { v: 6, l: '6' }, { v: 8, l: '8' }] },
    { key: 'bjPay', label: 'Paiement du Blackjack', type: 'select', default: 1.5, options: [{ v: 1.5, l: '3 pour 2' }, { v: 1.2, l: '6 pour 5' }] },
    { key: 'h17', label: 'Le croupier tire sur 17 souple', type: 'toggle', default: false },
    { key: 'surrender', label: 'Abandon autorisé', type: 'toggle', default: true },
    { key: 'insurance', label: 'Assurance', type: 'toggle', default: true },
    { key: 'timer', label: 'Temps pour jouer', type: 'select', default: 20, options: [{ v: 10, l: '10 s' }, { v: 20, l: '20 s' }, { v: 40, l: '40 s' }] },
  ],
  minPlayers: 1, maxPlayers: 7, tickRate: 4, joinInProgress: true, broadcastOnAction: true,

  create(players, ctx, o) {
    const s = { decks: o.decks || 6, minBet: o.minBet || 10, maxRounds: o.rounds ?? 15, bjPay: o.bjPay || 1.5, h17: !!o.h17, surrender: o.surrender !== false, insuranceOn: o.insurance !== false,
      timer: o.timer || 20, startChips: o.chips || 1000, round: 0, log: [], players: [], over: false };
    s.shoe = shoe(s.decks);
    for (const p of players) s.players.push({ id: p.id, name: p.name, color: p.color, chips: s.startChips, best: s.startChips, hands: [], bet: 0, lastBet: s.minBet * 5, net: 0 });
    startBetting(s);
    return s;
  },
  onJoin(s, p) { s.players.push({ id: p.id, name: p.name, color: p.color, chips: s.startChips, best: s.startChips, hands: [], bet: 0, lastBet: s.minBet * 5, net: 0 }); },
  onLeave(s, id) {
    const p = s.players.find(q => q.id === id); if (!p) return;
    p.left = true; p.hands.forEach(h => { h.done = true; });
    if (s.phase === 'play' && s.order[s.turn] === id) nextHand(s);
    if (!s.players.some(q => !q.left)) finish(s);
  },

  tick(s) {
    const now = Date.now();
    if (s.over || now < s.until) return;
    if (s.phase === 'bet') { if (seated(s).some(p => p.bet > 0)) deal(s); else s.until = now + s.timer * 1000; }
    else if (s.phase === 'insurance') afterInsurance(s);
    else if (s.phase === 'play') { const c = current(s); if (c) { c.h.done = true; log(s, `⏱ ${c.p.name} reste (temps écoulé).`); } nextHand(s); }
    else if (s.phase === 'reveal') payout(s);
    else if (s.phase === 'payout') startBetting(s);
  },

  onAction(s, id, a, ctx) {
    const p = s.players.find(q => q.id === id); if (!p || p.out || s.over) return;
    if (s.phase === 'bet') {
      if (a.type === 'chip') { const n = Math.floor(+a.n); if (!(n > 0)) return; if (p.bet + n > p.chips) return { error: 'Pas assez de jetons' }; p.bet += n; p.ready = false; ctx.emit({ type: 'chip' }); return; }
      if (a.type === 'clear') { p.bet = 0; p.ready = false; return; }
      if (a.type === 'repeat') { p.bet = Math.min(p.chips, p.lastBet); return; }
      if (a.type === 'allin') { p.bet = p.chips; return; }
      if (a.type === 'ready') {
        if (p.bet < s.minBet) return { error: `Mise minimum : ${s.minBet}` };
        p.ready = true; p.lastBet = p.bet;
        if (seated(s).every(q => q.ready || q.bet === 0) && seated(s).some(q => q.ready)) { if (seated(s).every(q => q.ready)) deal(s); else s.until = Math.min(s.until, Date.now() + 4000); }
        return;
      }
      return;
    }
    if (s.phase === 'insurance' && a.type === 'insure') {
      const h = p.hands[0]; if (!h || p.insurance) return;
      const cost = Math.floor(h.bet / 2); if (p.chips < cost) return { error: 'Pas assez de jetons' };
      p.chips -= cost; p.insurance = cost; log(s, `${p.name} prend l'assurance.`); return;
    }
    if (s.phase !== 'play') return;
    const c = current(s); if (!c || c.p.id !== id) return { error: "Ce n'est pas votre tour" };
    const h = c.h, t = () => total(h.cards).t;
    switch (a.type) {
      case 'hit':
        h.cards.push(draw(s)); ctx.emit({ type: 'card' });
        if (t() > 21) { h.bust = true; h.done = true; log(s, `${p.name} saute avec ${t()} !`); }
        else if (t() === 21) h.done = true;
        break;
      case 'stand': h.done = true; break;
      case 'double':
        if (h.cards.length !== 2 || p.chips < h.bet) return { error: 'Impossible de doubler' };
        p.chips -= h.bet; h.bet *= 2; h.doubled = true; h.cards.push(draw(s)); h.done = true; ctx.emit({ type: 'card' });
        if (t() > 21) h.bust = true;
        log(s, `${p.name} double (${t()}).`);
        break;
      case 'split': {
        if (h.cards.length !== 2 || val(h.cards[0]) !== val(h.cards[1]) || p.hands.length >= 4 || p.chips < h.bet) return { error: 'Impossible de séparer' };
        p.chips -= h.bet;
        const aces = parseInt(h.cards[0]) === 1;
        const h2 = { cards: [h.cards.pop(), draw(s)], bet: h.bet, done: aces, fromSplit: true };
        h.cards.push(draw(s)); h.fromSplit = true; if (aces) h.done = true;
        p.hands.splice(s.hand + 1, 0, h2); ctx.emit({ type: 'card' });
        log(s, `${p.name} sépare sa paire.`);
        break;
      }
      case 'surrender':
        if (!s.surrender || h.cards.length !== 2 || p.hands.length > 1) return { error: 'Abandon impossible' };
        h.surrendered = true; h.done = true; log(s, `${p.name} abandonne.`); break;
      default: return;
    }
    if (h.done) nextHand(s);
  },

  view(s, id) {
    const c = s.phase === 'play' ? current(s) : null;
    const revealed = s.phase === 'reveal' ? Math.min(s.dealer.cards.length, 2 + Math.floor((Date.now() - (s.until - 900 - (s.dealer.cards.length - 2) * 700)) / 700)) : s.dealer.cards.length;
    const dCards = s.dealer.hidden && s.dealer.cards.length ? [s.dealer.cards[0], '?'] : s.dealer.cards.slice(0, revealed);
    return {
      phase: s.phase, round: s.round, maxRounds: s.maxRounds, minBet: s.minBet, left: Math.max(0, s.until - Date.now()), timer: s.timer, over: s.over, surrender: s.surrender, bjPay: s.bjPay,
      dealer: { cards: dCards, total: dCards.includes('?') ? total([dCards[0]]).t : total(dCards).t },
      turn: c ? c.p.id : null, hand: c ? s.hand : null, shoeLeft: s.shoe.length, log: s.log.slice(-14),
      players: s.players.filter(p => !p.left).map(p => ({ id: p.id, name: p.name, color: p.color, chips: p.chips, bet: p.bet, ready: p.ready, out: p.out, insurance: p.insurance, net: p.net, best: p.best, lastBet: p.lastBet,
        hands: p.hands.map(h => ({ cards: h.cards, bet: h.bet, total: total(h.cards).t, soft: total(h.cards).soft, bust: !!h.bust, done: h.done, doubled: !!h.doubled, bj: isBJ(h), result: s.phase === 'payout' || s.phase === 'over' ? h.result : null, win: h.win, surrendered: !!h.surrendered })) })),
    };
  },
  _test: { total },
};
