// =====================================================================
//  COULEURS EXPRESS — règles (serveur)
//  Jeu de cartes « débarrassez-vous de vos cartes » : même couleur ou
//  même valeur, cartes spéciales (+2, passe, inversion, joker, joker +4).
// =====================================================================
const U = require('./lib/util');
const COLORS = ['r', 'y', 'g', 'b'];
const CNAME = { r: 'rouge', y: 'jaune', g: 'vert', b: 'bleu' };

function makeDeck() {
  const d = []; let id = 0;
  for (const c of COLORS) {
    d.push({ id: id++, c, v: '0' });
    for (let k = 0; k < 2; k++) {
      for (let n = 1; n <= 9; n++) d.push({ id: id++, c, v: String(n) });
      for (const v of ['+2', 'skip', 'rev']) d.push({ id: id++, c, v });
    }
  }
  for (let k = 0; k < 4; k++) { d.push({ id: id++, c: 'w', v: 'wild' }); d.push({ id: id++, c: 'w', v: '+4' }); }
  return U.shuffle(d);
}
const points = c => c.v === 'wild' || c.v === '+4' ? 50 : ['+2', 'skip', 'rev'].includes(c.v) ? 20 : Number(c.v);
const label = c => ({ '+2': '+2', skip: 'Passe', rev: 'Inversion', wild: 'Joker', '+4': 'Joker +4' }[c.v] || c.v) + (c.c !== 'w' ? ' ' + CNAME[c.c] : '');

const log = (s, m) => { s.log.push(m); if (s.log.length > 60) s.log.shift(); };
const cur = s => s.players[s.turn];
const nextIdx = (s, from = s.turn, steps = 1) => { let i = from; for (let k = 0; k < steps; k++) { do { i = (i + s.dir + s.players.length) % s.players.length; } while (s.players[i].out); } return i; };

function draw(s, p, n) {
  const got = [];
  for (let k = 0; k < n; k++) {
    if (!s.deck.length) {
      const top = s.discard.pop();
      s.deck = U.shuffle(s.discard.map(c => (c.v === 'wild' || c.v === '+4') ? { ...c, c: 'w' } : c));
      s.discard = [top];
      if (!s.deck.length) break;
    }
    const c = s.deck.pop(); p.hand.push(c); got.push(c);
  }
  return got;
}

function canPlay(s, c) {
  const top = s.discard[s.discard.length - 1];
  if (s.pending > 0) {
    if (!s.stacking) return false;
    return c.v === '+4' || (c.v === '+2' && top.v === '+2');
  }
  return c.c === 'w' || c.c === s.color || c.v === top.v;
}

function startRound(s) {
  s.deck = makeDeck(); s.discard = []; s.dir = 1; s.pending = 0; s.drawn = null; s.callout = null;
  for (const p of s.players) { p.hand = []; p.declared = false; if (!p.out) draw(s, p, s.handSize); }
  let first; do { first = s.deck.pop(); if (first.c === 'w') s.deck.unshift(first); } while (first.c === 'w');
  s.discard.push(first); s.color = first.c;
  s.turn = s.dealer % s.players.length; while (s.players[s.turn].out) s.turn = (s.turn + 1) % s.players.length;
  // effet de la première carte
  if (first.v === 'skip') s.turn = nextIdx(s);
  if (first.v === 'rev') { s.dir = -1; if (activeCount(s) > 2) s.turn = nextIdx(s, s.turn); }
  if (first.v === '+2') s.pending = 2;
  s.phase = 'play'; s.turnStart = Date.now();
  log(s, `— Manche ${s.roundNo} : ${s.players[s.turn].name} commence —`);
}
const activeCount = s => s.players.filter(p => !p.out).length;

function endTurn(s, skip = 0) {
  s.drawn = null;
  s.turn = nextIdx(s, s.turn, 1 + skip);
  s.turnStart = Date.now();
}

function finishRound(s, winner) {
  let pts = 0;
  for (const p of s.players) if (p !== winner) pts += p.hand.reduce((a, c) => a + points(c), 0);
  winner.score += pts;
  log(s, `🏆 ${winner.name} vide sa main et marque ${pts} points !`);
  s.lastRound = { winner: winner.id, pts };
  if (!s.target || winner.score >= s.target) { s.phase = 'over'; s.winner = winner.id; return; }
  s.phase = 'roundEnd'; s.nextRoundAt = Date.now() + 6000;
}

function playCard(s, p, cardId, color) {
  const idx = p.hand.findIndex(c => c.id === cardId);
  if (idx < 0) return 'Carte introuvable';
  const c = p.hand[idx];
  if (s.drawn && s.drawn !== c.id) return 'Vous ne pouvez jouer que la carte piochée';
  if (!canPlay(s, c)) return s.pending ? `Piochez ${s.pending} cartes ou cumulez` : 'Cette carte ne peut pas être jouée';
  if (c.c === 'w' && !COLORS.includes(color)) return 'Choisissez une couleur';
  p.hand.splice(idx, 1);
  const played = c.c === 'w' ? { ...c, c: color } : c;
  s.discard.push(played); s.color = played.c;
  s.lastPlay = { by: p.id, card: played, n: (s.lastPlay?.n || 0) + 1 };
  log(s, `${p.name} joue ${label(c)}${c.c === 'w' ? ` → ${CNAME[color]}` : ''}`);
  // « Dernière ! »
  if (p.hand.length === 1) { if (!p.declared && s.callRule) s.callout = { id: p.id, until: Date.now() + 4000 }; }
  else p.declared = false;
  if (!p.hand.length) return finishRound(s, p) || null;
  let skip = 0;
  if (c.v === 'skip') skip = 1;
  if (c.v === 'rev') { s.dir *= -1; if (activeCount(s) === 2) skip = 1; }
  if (c.v === '+2') s.pending += 2;
  if (c.v === '+4') s.pending += 4;
  if (s.pending && !s.stacking) { // pas de cumul : le suivant pioche et passe
    const n = nextIdx(s), victim = s.players[n];
    draw(s, victim, s.pending); log(s, `${victim.name} pioche ${s.pending} cartes et passe son tour.`);
    s.pending = 0; skip = 1;
  }
  endTurn(s, skip);
  return null;
}

function timeoutTurn(s) {
  const p = cur(s);
  if (s.pending) { draw(s, p, s.pending); log(s, `⏱ ${p.name} pioche ${s.pending} cartes.`); s.pending = 0; }
  else if (!s.drawn) { draw(s, p, 1); log(s, `⏱ ${p.name} pioche et passe.`); }
  endTurn(s);
}

module.exports = {
  id: 'cards',
  name: 'Couleurs Express',
  description: 'Même couleur ou même chiffre : soyez le premier à vous débarrasser de toutes vos cartes !',
  category: 'Plateau & cartes', icon: '🃏', color: '#ef4444', order: 1,
  tags: ['⏱ 10–30 min', '🎉 Ambiance'],
  rules: `<ul><li>Posez une carte de la <b>même couleur</b> ou de la <b>même valeur</b> que celle du dessus.</li>
    <li><b>+2</b> : le suivant pioche 2 · <b>Passe</b> : le suivant saute son tour · <b>Inversion</b> : change le sens.</li>
    <li><b>Joker</b> : choisissez la couleur · <b>Joker +4</b> : en plus, le suivant pioche 4.</li>
    <li>Plus qu'une carte ? Cliquez vite sur <b>« Dernière ! »</b> sinon on peut vous contrer (+2).</li>
    <li>Pas de carte jouable : piochez.</li></ul>`,
  settings: [
    { key: 'handSize', label: 'Cartes au départ', type: 'select', default: 7, options: [{ v: 5, l: '5' }, { v: 7, l: '7' }, { v: 10, l: '10' }] },
    { key: 'target', label: 'Fin de partie', type: 'select', default: 0, options: [{ v: 0, l: '1 manche' }, { v: 100, l: '100 pts' }, { v: 250, l: '250 pts' }, { v: 500, l: '500 pts' }] },
    { key: 'stacking', label: 'Cumul des +2 / +4', type: 'toggle', default: true, help: 'Répondre à un +2 par un +2 pour le renvoyer.' },
    { key: 'callRule', label: 'Règle « Dernière ! »', type: 'toggle', default: true },
    { key: 'drawPlay', label: 'Jouer la carte piochée', type: 'toggle', default: true },
    { key: 'timer', label: 'Temps par tour', type: 'select', default: 30, options: [{ v: 0, l: 'Illimité' }, { v: 15, l: '15 s' }, { v: 30, l: '30 s' }, { v: 60, l: '60 s' }] },
  ],
  minPlayers: 2, maxPlayers: 10, tickRate: 2,

  create(players, ctx, o) {
    const s = {
      players: players.map(p => ({ ...p, hand: [], score: 0, declared: false, out: false })),
      handSize: o.handSize || 7, target: o.target || 0, stacking: !!o.stacking, callRule: !!o.callRule, drawPlay: o.drawPlay !== false, timer: o.timer || 0,
      dealer: Math.floor(Math.random() * players.length), roundNo: 1, log: [], winner: null, lastPlay: null, lastRound: null,
    };
    startRound(s);
    return s;
  },
  onJoin() {},
  onLeave(s, id) {
    const i = s.players.findIndex(p => p.id === id); if (i < 0) return;
    const p = s.players[i]; p.out = true;
    s.deck.unshift(...p.hand); p.hand = [];
    log(s, `${p.name} a quitté la partie.`);
    const left = s.players.filter(q => !q.out);
    if (left.length < 2 && s.phase !== 'over') { s.phase = 'over'; s.winner = left[0]?.id; return; }
    if (s.turn === i) endTurn(s);
  },
  tick(s) {
    const now = Date.now();
    if (s.phase === 'roundEnd' && now >= s.nextRoundAt) { s.roundNo++; s.dealer++; startRound(s); }
    if (s.phase === 'play' && s.timer && now - s.turnStart > s.timer * 1000) timeoutTurn(s);
    if (s.callout && now > s.callout.until) s.callout = null;
  },
  broadcastOnAction: true,

  onAction(s, id, a, ctx) {
    const p = s.players.find(q => q.id === id);
    if (!p || p.out || s.phase !== 'play') return;
    const mine = cur(s).id === id;
    switch (a.type) {
      case 'play': {
        if (!mine) return { error: "Ce n'est pas votre tour" };
        const e = playCard(s, p, a.card, a.color);
        if (e) return { error: e };
        ctx.emit({ type: 'play', by: id });
        return;
      }
      case 'draw': {
        if (!mine) return { error: "Ce n'est pas votre tour" };
        if (s.pending) { draw(s, p, s.pending); log(s, `${p.name} pioche ${s.pending} cartes.`); s.pending = 0; endTurn(s); ctx.emit({ type: 'draw', by: id, n: 2 }); return; }
        if (s.drawn) return;
        const [c] = draw(s, p, 1);
        ctx.emit({ type: 'draw', by: id, n: 1 });
        if (c && s.drawPlay && canPlay(s, c)) { s.drawn = c.id; log(s, `${p.name} pioche une carte jouable.`); return; }
        log(s, `${p.name} pioche et passe.`); endTurn(s);
        return;
      }
      case 'pass': if (mine && s.drawn) { log(s, `${p.name} garde sa carte.`); endTurn(s); } return;
      case 'declare':
        if (p.hand.length <= 2) { p.declared = true; if (s.callout?.id === id) s.callout = null; log(s, `📣 ${p.name} : « Dernière ! »`); ctx.emit({ type: 'declare', by: id }); }
        return;
      case 'callout': {
        const c = s.callout; if (!c || c.id === id) return;
        const t = s.players.find(q => q.id === c.id);
        if (t && t.hand.length === 1) { draw(s, t, 2); log(s, `🚨 ${p.name} contre ${t.name} qui a oublié « Dernière ! » : +2 cartes.`); ctx.emit({ type: 'callout', by: id, target: t.id }); }
        s.callout = null;
        return;
      }
    }
  },

  results(s) {
    if (s.phase !== 'over') return null;
    return { key: 'over', players: U.rank(s.players.filter(p => !p.out).map(p => ({ id: p.id, score: s.target ? p.score : -p.hand.length, win: p.id === s.winner }))) };
  },
  view(s, id) {
    return {
      phase: s.phase, turn: s.turn, dir: s.dir, color: s.color, top: s.discard[s.discard.length - 1], pending: s.pending,
      deckCount: s.deck.length, drawn: s.drawn, callout: s.callout && { id: s.callout.id }, target: s.target, roundNo: s.roundNo,
      timer: s.timer, timeLeft: s.timer ? Math.max(0, s.timer * 1000 - (Date.now() - s.turnStart)) : 0,
      winner: s.winner, lastRound: s.lastRound, lastPlay: s.lastPlay, stacking: s.stacking, log: s.log.slice(-30),
      players: s.players.map(p => ({ id: p.id, name: p.name, color: p.color, count: p.hand.length, score: p.score, out: p.out, declared: p.declared })),
      hand: (s.players.find(p => p.id === id)?.hand || []).map(c => ({ ...c, ok: s.phase === 'play' && cur(s).id === id && canPlay(s, c) && (!s.drawn || s.drawn === c.id) })),
    };
  },
};
