// =====================================================================
//  EMPIRE IMMOBILIER — règles (serveur)
//  Jeu de plateau d'achat/vente de propriétés, 2 à 8 joueurs.
//  Le serveur est seul maître : dés, argent, loyers, cartes, enchères,
//  constructions, hypothèques, échanges, prison, faillite et victoire.
// =====================================================================

const START_MONEY = 1500, GO_SALARY = 200, JAIL = 10, JAIL_FINE = 50, AUCTION_TIME = 12000;

// --- Plateau (40 cases) ---------------------------------------------
// type: go | prop | station | utility | tax | chance | chest | jail | park | gotojail
const P = (name, group, price, rents, house) => ({ type: 'prop', name, group, price, rents, house });
const BOARD = [
  { type: 'go', name: 'Départ' },
  P('Impasse des Glycines', 'brown', 60, [2, 10, 30, 90, 160, 250], 50),
  { type: 'chest', name: 'Caisse Commune' },
  P('Ruelle du Moulin', 'brown', 60, [4, 20, 60, 180, 320, 450], 50),
  { type: 'tax', name: 'Impôt sur le revenu', amount: 200 },
  { type: 'station', name: 'Gare des Brumes', price: 200 },
  P('Rue des Tisserands', 'sky', 100, [6, 30, 90, 270, 400, 550], 50),
  { type: 'chance', name: 'Destin' },
  P('Rue des Potiers', 'sky', 100, [6, 30, 90, 270, 400, 550], 50),
  P('Avenue des Peupliers', 'sky', 120, [8, 40, 100, 300, 450, 600], 50),
  { type: 'jail', name: 'Prison' },
  P('Boulevard des Arts', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  { type: 'utility', name: 'Centrale Électrique', price: 150 },
  P("Rue de l'Observatoire", 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  P('Avenue du Théâtre', 'pink', 160, [12, 60, 180, 500, 700, 900], 100),
  { type: 'station', name: 'Gare des Collines', price: 200 },
  P('Quai des Pêcheurs', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  { type: 'chest', name: 'Caisse Commune' },
  P('Rue du Phare', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  P('Place des Marins', 'orange', 200, [16, 80, 220, 600, 800, 1000], 100),
  { type: 'park', name: 'Jardin Public' },
  P('Avenue du Volcan', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  { type: 'chance', name: 'Destin' },
  P('Rue des Braises', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  P('Boulevard du Soleil', 'red', 240, [20, 100, 300, 750, 925, 1100], 150),
  { type: 'station', name: 'Gare Centrale', price: 200 },
  P('Rue des Orfèvres', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  P('Place de la Bourse', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  { type: 'utility', name: 'Compagnie des Eaux', price: 150 },
  P('Allée des Banquiers', 'yellow', 280, [24, 120, 360, 850, 1025, 1200], 150),
  { type: 'gotojail', name: 'Allez en prison' },
  P('Avenue des Cèdres', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  P('Rue des Ambassades', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200),
  { type: 'chest', name: 'Caisse Commune' },
  P('Boulevard Émeraude', 'green', 320, [28, 150, 450, 1000, 1200, 1400], 200),
  { type: 'station', name: "Gare de l'Aéroport", price: 200 },
  { type: 'chance', name: 'Destin' },
  P('Promenade des Étoiles', 'navy', 350, [35, 175, 500, 1100, 1300, 1500], 200),
  { type: 'tax', name: 'Taxe de luxe', amount: 100 },
  P('Colline Impériale', 'navy', 400, [50, 200, 600, 1400, 1700, 2000], 200),
];
BOARD.forEach((s, i) => { s.i = i; });
const GROUPS = {};
BOARD.forEach(s => { if (s.type === 'prop') (GROUPS[s.group] ||= []).push(s.i); });
const STATIONS = BOARD.filter(s => s.type === 'station').map(s => s.i);
const UTILITIES = BOARD.filter(s => s.type === 'utility').map(s => s.i);
const BUYABLE = s => ['prop', 'station', 'utility'].includes(BOARD[s].type);

// --- Cartes ---------------------------------------------------------
const CHANCE = [
  { text: 'Avancez jusqu’à la case Départ. Recevez 200 €.', moveTo: 0 },
  { text: 'Rendez-vous à la Colline Impériale.', moveTo: 39 },
  { text: 'Rendez-vous au Boulevard du Soleil. Si vous passez par Départ, recevez 200 €.', moveTo: 24 },
  { text: 'Rendez-vous au Boulevard des Arts. Si vous passez par Départ, recevez 200 €.', moveTo: 11 },
  { text: 'Avancez jusqu’à la gare la plus proche. Payez le double du loyer.', nearest: 'station' },
  { text: 'Avancez jusqu’à la gare la plus proche. Payez le double du loyer.', nearest: 'station' },
  { text: 'Avancez jusqu’à la compagnie la plus proche. Payez 10× les dés.', nearest: 'utility' },
  { text: 'La banque vous verse un dividende de 50 €.', money: 50 },
  { text: 'Carte « Sortie de prison ». Conservez-la.', jailCard: true },
  { text: 'Reculez de 3 cases.', back: 3 },
  { text: 'Allez directement en prison.', jail: true },
  { text: 'Travaux : 25 € par maison, 100 € par hôtel.', repairs: [25, 100] },
  { text: 'Excès de vitesse : amende de 15 €.', money: -15 },
  { text: 'Voyage à la Gare des Brumes. Si vous passez par Départ, recevez 200 €.', moveTo: 5 },
  { text: 'Vous êtes élu président du quartier. Versez 50 € à chaque joueur.', payEach: 50 },
  { text: 'Votre prêt immobilier arrive à échéance. Recevez 150 €.', money: 150 },
];
const CHEST = [
  { text: 'Avancez jusqu’à la case Départ. Recevez 200 €.', moveTo: 0 },
  { text: 'Erreur de la banque en votre faveur : recevez 200 €.', money: 200 },
  { text: 'Honoraires du médecin : payez 50 €.', money: -50 },
  { text: 'Vente de vos actions : recevez 50 €.', money: 50 },
  { text: 'Carte « Sortie de prison ». Conservez-la.', jailCard: true },
  { text: 'Allez directement en prison.', jail: true },
  { text: 'Fonds de vacances : recevez 100 €.', money: 100 },
  { text: 'Remboursement d’impôts : recevez 20 €.', money: 20 },
  { text: 'C’est votre anniversaire : chaque joueur vous offre 10 €.', collectEach: 10 },
  { text: 'Assurance-vie : recevez 100 €.', money: 100 },
  { text: 'Frais d’hôpital : payez 100 €.', money: -100 },
  { text: 'Frais de scolarité : payez 50 €.', money: -50 },
  { text: 'Prime de conseil : recevez 25 €.', money: 25 },
  { text: 'Rénovation de voirie : 40 € par maison, 115 € par hôtel.', repairs: [40, 115] },
  { text: 'Deuxième prix d’un concours de beauté : recevez 10 €.', money: 10 },
  { text: 'Héritage : recevez 100 €.', money: 100 },
];

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const die = () => 1 + Math.floor(Math.random() * 6);

// --- Outils ---------------------------------------------------------
const player = (s, id) => s.players.find(p => p.id === id);
const cur = s => s.players[s.turn];
const alive = s => s.players.filter(p => !p.bankrupt);
const log = (s, msg) => { s.log.push(msg); if (s.log.length > 80) s.log.shift(); };
const owned = (s, ownerId) => Object.keys(s.props).map(Number).filter(i => s.props[i].owner === ownerId);
const ownsGroup = (s, id, g) => GROUPS[g].every(i => s.props[i]?.owner === id);
const groupHasBuildings = (s, g) => GROUPS[g].some(i => s.props[i]?.houses > 0);

function rent(s, idx, diceSum, mult = 1) {
  const sq = BOARD[idx], pr = s.props[idx];
  if (!pr || pr.mortgaged) return 0;
  if (sq.type === 'prop') {
    if (pr.houses > 0) return sq.rents[pr.houses];
    return sq.rents[0] * (ownsGroup(s, pr.owner, sq.group) ? 2 : 1);
  }
  if (sq.type === 'station') {
    const n = STATIONS.filter(i => s.props[i]?.owner === pr.owner).length;
    return 25 * 2 ** (n - 1) * mult;
  }
  if (sq.type === 'utility') {
    if (mult === 10) return diceSum * 10;
    const n = UTILITIES.filter(i => s.props[i]?.owner === pr.owner).length;
    return diceSum * (n === 2 ? 10 : 4);
  }
  return 0;
}

// Paiement : si le joueur ne peut pas payer, il entre en phase "dette"
// et doit vendre/hypothéquer ou déclarer faillite.
function charge(s, p, amount, toId) {
  if (amount <= 0) return true;
  if (p.money >= amount) {
    p.money -= amount;
    if (toId) player(s, toId).money += amount;
    else if (s.freeParking) s.pot += amount;
    return true;
  }
  s.debt = { id: p.id, amount, to: toId || null, resume: s.phase };
  s.phase = 'debt';
  log(s, `⚠️ ${p.name} doit ${amount} € mais n'a que ${p.money} € : il doit trouver des fonds.`);
  return false;
}

function sendToJail(s, p) {
  p.pos = JAIL; p.inJail = true; p.jailTurns = 0;
  s.doubles = 0;
  log(s, `🚔 ${p.name} va en prison !`);
}

function moveTo(s, p, dest, collectGo = true) {
  if (collectGo && dest < p.pos) { p.money += GO_SALARY; log(s, `${p.name} passe par Départ : +${GO_SALARY} €`); }
  p.pos = dest;
}

// Résolution de la case d'arrivée
function land(s, p, diceSum, opts = {}) {
  const sq = BOARD[p.pos];
  switch (sq.type) {
    case 'prop': case 'station': case 'utility': {
      const pr = s.props[p.pos];
      if (!pr) { s.phase = 'buy'; s.pending = { idx: p.pos }; return; }
      if (pr.owner === p.id) return;
      if (pr.mortgaged) { log(s, `${sq.name} est hypothéquée : pas de loyer.`); return; }
      const owner = player(s, pr.owner);
      if (owner.bankrupt) return;
      if (owner.inJail && s.noRentInJail) return;
      const r = rent(s, p.pos, diceSum, opts.mult || 1);
      log(s, `💸 ${p.name} paie ${r} € de loyer à ${owner.name} (${sq.name}).`);
      charge(s, p, r, owner.id);
      return;
    }
    case 'tax':
      log(s, `${p.name} paie ${sq.name} : ${sq.amount} €.`);
      charge(s, p, sq.amount, null);
      return;
    case 'park':
      if (s.freeParking && s.pot > 0) { log(s, `🌳 ${p.name} ramasse la cagnotte du Jardin Public : ${s.pot} € !`); p.money += s.pot; s.pot = 0; }
      return;
    case 'gotojail': sendToJail(s, p); return;
    case 'chance': case 'chest': drawCard(s, p, sq.type, diceSum); return;
  }
}

function drawCard(s, p, deck, diceSum) {
  const d = s.decks[deck];
  const card = d.shift();
  if (!card.jailCard) d.push(card);
  s.lastCard = { deck, text: card.text, by: p.id, n: (s.lastCard?.n || 0) + 1 };
  log(s, `🃏 ${p.name} (${deck === 'chance' ? 'Destin' : 'Caisse Commune'}) : ${card.text}`);
  if (card.money > 0) p.money += card.money;
  else if (card.money < 0) charge(s, p, -card.money, null);
  else if (card.jailCard) p.jailCards.push(deck);
  else if (card.jail) sendToJail(s, p);
  else if (card.back) { p.pos = (p.pos + 40 - card.back) % 40; land(s, p, diceSum); }
  else if (card.moveTo !== undefined) { moveTo(s, p, card.moveTo); land(s, p, diceSum); }
  else if (card.nearest) {
    const list = card.nearest === 'station' ? STATIONS : UTILITIES;
    const dest = list.find(i => i > p.pos) ?? list[0];
    moveTo(s, p, dest);
    const roll = card.nearest === 'utility' ? die() + die() : diceSum;
    land(s, p, roll, { mult: card.nearest === 'station' ? 2 : 10 });
  } else if (card.repairs) {
    let total = 0;
    for (const i of owned(s, p.id)) { const h = s.props[i].houses; total += h === 5 ? card.repairs[1] : h * card.repairs[0]; }
    if (total) charge(s, p, total, null);
  } else if (card.payEach) {
    const others = alive(s).filter(o => o.id !== p.id);
    const total = card.payEach * others.length;
    if (p.money >= total) others.forEach(o => { o.money += card.payEach; }), p.money -= total;
    else charge(s, p, total, null); // en cas de dette, l'argent va à la banque
  } else if (card.collectEach) {
    for (const o of alive(s)) if (o.id !== p.id) { const a = Math.min(o.money, card.collectEach); o.money -= a; p.money += a; }
  }
}

// Que se passe-t-il après la résolution d'un déplacement ?
function afterMove(s) {
  if (s.phase === 'buy' || s.phase === 'debt' || s.phase === 'auction') return;
  const p = cur(s);
  if (p.bankrupt) return nextTurn(s);
  s.phase = (s.rolledDouble && !p.inJail && !p.bankrupt) ? 'roll' : 'end';
}

function nextTurn(s) {
  if (alive(s).length <= 1) return endGame(s);
  s.doubles = 0; s.rolledDouble = false;
  do { s.turn = (s.turn + 1) % s.players.length; } while (cur(s).bankrupt);
  s.phase = 'roll';
  s.turnNo++;
  log(s, `— Au tour de ${cur(s).name} —`);
}

function endGame(s) {
  s.phase = 'over';
  const winner = alive(s)[0] || s.players.slice().sort((a, b) => worth(s, b) - worth(s, a))[0];
  s.winner = winner?.id;
  log(s, `🏆 ${winner?.name} remporte la partie !`);
}

function worth(s, p) {
  let w = p.money;
  for (const i of owned(s, p.id)) {
    const pr = s.props[i], sq = BOARD[i];
    w += pr.mortgaged ? sq.price / 2 : sq.price;
    if (sq.house) w += pr.houses * sq.house;
  }
  return w;
}

function bankrupt(s, p, toId) {
  const creditor = toId ? player(s, toId) : null;
  log(s, `💀 ${p.name} fait faillite${creditor ? ` au profit de ${creditor.name}` : ''} !`);
  for (const i of owned(s, p.id)) {
    const pr = s.props[i];
    if (pr.houses) { p.money += pr.houses * BOARD[i].house / 2; pr.houses = 0; }
    if (creditor) pr.owner = creditor.id;
    else delete s.props[i];
  }
  if (creditor) { creditor.money += Math.max(0, p.money); creditor.jailCards.push(...p.jailCards); }
  else p.jailCards.forEach(d => s.decks[d].push((d === 'chance' ? CHANCE : CHEST).find(c => c.jailCard)));
  p.money = 0; p.jailCards = []; p.bankrupt = true; p.inJail = false;
  if (s.trade && (s.trade.from === p.id || s.trade.to === p.id)) s.trade = null;
  if (s.auction) s.auction.active = s.auction.active.filter(id => id !== p.id);
}

// --- Enchères -------------------------------------------------------
function startAuction(s, idx) {
  s.auction = { idx, bid: 0, bidder: null, active: alive(s).map(p => p.id), deadline: Date.now() + AUCTION_TIME, resume: 'after' };
  s.phase = 'auction';
  log(s, `🔨 Enchères pour ${BOARD[idx].name} !`);
}
function checkAuctionEnd(s) {
  const a = s.auction;
  if (!a) return;
  const others = a.active.filter(id => id !== a.bidder);
  if (Date.now() < a.deadline && (others.length > 0 || !a.bidder) && a.active.length > 0) return;
  if (a.bidder && player(s, a.bidder).money < a.bid) { a.bidder = null; }
  if (a.bidder) {
    const w = player(s, a.bidder);
    w.money -= a.bid;
    s.props[a.idx] = { owner: w.id, houses: 0, mortgaged: false };
    log(s, `🔨 ${w.name} remporte ${BOARD[a.idx].name} pour ${a.bid} €.`);
  } else log(s, `🔨 Personne n'a enchéri sur ${BOARD[a.idx].name}.`);
  s.auction = null;
  s.phase = 'move';
  afterMove(s);
}

// --- Constructions / hypothèques -------------------------------------
function canBuild(s, p, i) {
  const sq = BOARD[i], pr = s.props[i];
  if (sq.type !== 'prop' || pr?.owner !== p.id) return 'Ce terrain ne vous appartient pas';
  if (!ownsGroup(s, p.id, sq.group)) return 'Il faut posséder tout le groupe de couleur';
  if (GROUPS[sq.group].some(j => s.props[j].mortgaged)) return 'Un terrain du groupe est hypothéqué';
  if (pr.houses >= 5) return 'Déjà un hôtel';
  const min = Math.min(...GROUPS[sq.group].map(j => s.props[j].houses));
  if (pr.houses > min) return 'Construisez de manière uniforme sur le groupe';
  if (pr.houses === 4 ? s.hotels <= 0 : s.houses <= 0) return 'La banque n’a plus de bâtiments disponibles';
  if (p.money < sq.house) return 'Pas assez d’argent';
  return null;
}
function canSell(s, p, i) {
  const sq = BOARD[i], pr = s.props[i];
  if (pr?.owner !== p.id || !pr.houses) return 'Rien à vendre ici';
  const max = Math.max(...GROUPS[sq.group].map(j => s.props[j].houses));
  if (pr.houses < max) return 'Vendez de manière uniforme sur le groupe';
  if (pr.houses === 5 && s.houses < 4) return 'Pas assez de maisons en banque pour démonter l’hôtel';
  return null;
}

// Actions de gestion autorisées : pendant son tour, ou pendant sa dette.
function canManage(s, p) {
  if (p.bankrupt || s.phase === 'over') return false;
  if (s.phase === 'debt') return s.debt.id === p.id;
  return cur(s).id === p.id && ['roll', 'end', 'buy'].includes(s.phase);
}

// --- Échanges -------------------------------------------------------
function validOffer(s, p, side) {
  const money = Math.max(0, Math.floor(Number(side.money) || 0));
  const props = [...new Set((side.props || []).map(Number))];
  const cards = Math.max(0, Math.floor(Number(side.cards) || 0));
  if (money > p.money) return null;
  if (cards > p.jailCards.length) return null;
  for (const i of props) {
    const pr = s.props[i];
    if (!pr || pr.owner !== p.id) return null;
    if (BOARD[i].type === 'prop' && groupHasBuildings(s, BOARD[i].group)) return null;
  }
  return { money, props, cards };
}

// =====================================================================
module.exports = {
  id: 'empire',
  name: 'Empire Immobilier',
  description: 'Achetez, construisez, ruinez vos adversaires',
  minPlayers: 2,
  maxPlayers: 8,
  tickRate: 2, // pour le minuteur des enchères

  create(players) {
    const s = {
      board: BOARD,
      players: shuffle(players.slice()).map(p => ({
        id: p.id, name: p.name, color: p.color, money: START_MONEY, pos: 0,
        inJail: false, jailTurns: 0, jailCards: [], bankrupt: false,
      })),
      props: {}, turn: 0, turnNo: 1, phase: 'roll', dice: [1, 1], rollN: 0,
      doubles: 0, rolledDouble: false, pending: null, auction: null, debt: null, trade: null,
      decks: { chance: shuffle(CHANCE.slice()), chest: shuffle(CHEST.slice()) },
      lastCard: null, houses: 32, hotels: 12, freeParking: true, pot: 0, noRentInJail: false,
      log: [], winner: null, version: 0,
    };
    log(s, `La partie commence ! ${s.players[0].name} joue en premier.`);
    return s;
  },

  onJoin() {},

  onLeave(s, id) {
    const p = player(s, id);
    if (!p || p.bankrupt || s.phase === 'over') return;
    const wasTurn = cur(s).id === id;
    if (s.debt?.id === id) { const d = s.debt; s.debt = null; bankrupt(s, p, d.to); }
    else bankrupt(s, p, null);
    log(s, `${p.name} a quitté la partie.`);
    if (alive(s).length <= 1) return endGame(s);
    if (s.auction) checkAuctionEnd(s);
    if (wasTurn && s.phase !== 'auction') nextTurn(s);
  },

  tick(s) {
    if (s.phase === 'auction') checkAuctionEnd(s);
  },
  broadcastOnAction: true,

  onAction(s, id, a) {
    const p = player(s, id);
    if (!p || p.bankrupt || s.phase === 'over') return;
    const myTurn = cur(s).id === id;
    const err = e => ({ error: e });

    switch (a.type) {
      // ---------- Lancer les dés ----------
      case 'roll': {
        if (!myTurn || s.phase !== 'roll') return err("Ce n'est pas le moment de lancer");
        const d1 = die(), d2 = die(), sum = d1 + d2, dbl = d1 === d2;
        s.dice = [d1, d2]; s.rollN++;
        if (p.inJail) {
          if (dbl) { p.inJail = false; p.jailTurns = 0; log(s, `🎲 ${p.name} fait un double (${d1}+${d2}) et sort de prison !`); }
          else if (++p.jailTurns >= 3) {
            log(s, `🎲 ${p.name} (${d1}+${d2}) : 3e échec, paie ${JAIL_FINE} € et sort.`);
            p.inJail = false; p.jailTurns = 0;
            if (!charge(s, p, JAIL_FINE, null)) { s.debt.resume = 'jailmove'; s.debt.sum = sum; return; }
          } else { log(s, `🎲 ${p.name} (${d1}+${d2}) reste en prison.`); s.phase = 'end'; return; }
          s.rolledDouble = false; // pas de rejouer après une sortie de prison
        } else {
          s.rolledDouble = dbl;
          if (dbl && ++s.doubles >= 3) { log(s, `🎲 ${p.name} fait 3 doubles d'affilée !`); sendToJail(s, p); s.rolledDouble = false; s.phase = 'end'; return; }
          log(s, `🎲 ${p.name} lance ${d1} + ${d2} = ${sum}${dbl ? ' (double !)' : ''}`);
        }
        moveTo(s, p, (p.pos + sum) % 40);
        s.phase = 'move';
        land(s, p, sum);
        afterMove(s);
        return;
      }

      // ---------- Prison ----------
      case 'payJail': {
        if (!myTurn || s.phase !== 'roll' || !p.inJail) return;
        if (p.money < JAIL_FINE) return err('Pas assez d’argent');
        p.money -= JAIL_FINE; if (s.freeParking) s.pot += JAIL_FINE;
        p.inJail = false; p.jailTurns = 0;
        log(s, `${p.name} paie ${JAIL_FINE} € et sort de prison.`);
        return;
      }
      case 'useCard': {
        if (!myTurn || s.phase !== 'roll' || !p.inJail || !p.jailCards.length) return;
        const d = p.jailCards.pop();
        s.decks[d].push((d === 'chance' ? CHANCE : CHEST).find(c => c.jailCard));
        p.inJail = false; p.jailTurns = 0;
        log(s, `${p.name} utilise sa carte et sort de prison.`);
        return;
      }

      // ---------- Achat ----------
      case 'buy': {
        if (!myTurn || s.phase !== 'buy') return;
        const idx = s.pending.idx, sq = BOARD[idx];
        if (p.money < sq.price) return err('Pas assez d’argent — vendez/hypothéquez ou passez aux enchères');
        p.money -= sq.price;
        s.props[idx] = { owner: p.id, houses: 0, mortgaged: false };
        log(s, `🏠 ${p.name} achète ${sq.name} pour ${sq.price} €.`);
        s.pending = null; s.phase = 'move'; afterMove(s);
        return;
      }
      case 'decline': {
        if (!myTurn || s.phase !== 'buy') return;
        const idx = s.pending.idx; s.pending = null;
        startAuction(s, idx);
        return;
      }
      case 'bid': {
        const A = s.auction;
        if (s.phase !== 'auction' || !A.active.includes(id)) return;
        const amount = Math.floor(Number(a.amount));
        if (!(amount > A.bid)) return err('L’enchère doit être plus haute');
        if (amount > p.money) return err('Pas assez d’argent');
        A.bid = amount; A.bidder = id;
        A.deadline = Math.max(A.deadline, Date.now() + 5000);
        log(s, `🔨 ${p.name} enchérit ${amount} €`);
        checkAuctionEnd(s);
        return;
      }
      case 'pass': {
        const A = s.auction;
        if (s.phase !== 'auction' || !A.active.includes(id) || A.bidder === id) return;
        A.active = A.active.filter(x => x !== id);
        log(s, `${p.name} se retire des enchères.`);
        checkAuctionEnd(s);
        return;
      }

      // ---------- Gestion ----------
      case 'build': {
        if (!canManage(s, p) || s.phase === 'debt') return err('Pas maintenant');
        const i = Number(a.idx), e = canBuild(s, p, i);
        if (e) return err(e);
        const pr = s.props[i];
        p.money -= BOARD[i].house;
        if (pr.houses === 4) { s.hotels--; s.houses += 4; } else s.houses--;
        pr.houses++;
        log(s, `🏗️ ${p.name} construit ${pr.houses === 5 ? 'un hôtel' : 'une maison'} sur ${BOARD[i].name}.`);
        return;
      }
      case 'sell': {
        if (!canManage(s, p)) return err('Pas maintenant');
        const i = Number(a.idx), e = canSell(s, p, i);
        if (e) return err(e);
        const pr = s.props[i];
        if (pr.houses === 5) { s.hotels++; s.houses -= 4; } else s.houses++;
        pr.houses--;
        p.money += BOARD[i].house / 2;
        log(s, `${p.name} revend un bâtiment sur ${BOARD[i].name} (+${BOARD[i].house / 2} €).`);
        return;
      }
      case 'mortgage': {
        if (!canManage(s, p)) return err('Pas maintenant');
        const i = Number(a.idx), pr = s.props[i], sq = BOARD[i];
        if (pr?.owner !== id || pr.mortgaged) return;
        if (sq.type === 'prop' && groupHasBuildings(s, sq.group)) return err('Vendez d’abord les bâtiments du groupe');
        pr.mortgaged = true; p.money += sq.price / 2;
        log(s, `${p.name} hypothèque ${sq.name} (+${sq.price / 2} €).`);
        return;
      }
      case 'unmortgage': {
        if (!canManage(s, p) || s.phase === 'debt') return err('Pas maintenant');
        const i = Number(a.idx), pr = s.props[i], sq = BOARD[i];
        if (pr?.owner !== id || !pr.mortgaged) return;
        const cost = Math.ceil(sq.price / 2 * 1.1);
        if (p.money < cost) return err('Pas assez d’argent');
        p.money -= cost; pr.mortgaged = false;
        log(s, `${p.name} lève l’hypothèque de ${sq.name} (-${cost} €).`);
        return;
      }

      // ---------- Dette / faillite ----------
      case 'payDebt': {
        const d = s.debt;
        if (s.phase !== 'debt' || d.id !== id) return;
        if (p.money < d.amount) return err('Toujours pas assez d’argent');
        p.money -= d.amount;
        if (d.to) player(s, d.to).money += d.amount; else if (s.freeParking) s.pot += d.amount;
        log(s, `${p.name} règle sa dette de ${d.amount} €.`);
        s.debt = null;
        if (d.resume === 'jailmove') { moveTo(s, p, (p.pos + d.sum) % 40); s.phase = 'move'; land(s, p, d.sum); }
        else s.phase = 'move';
        afterMove(s);
        return;
      }
      case 'bankrupt': {
        if (s.phase !== 'debt' || s.debt.id !== id) return;
        const d = s.debt; s.debt = null;
        bankrupt(s, p, d.to);
        nextTurn(s);
        return;
      }

      // ---------- Fin du tour ----------
      case 'end': {
        if (!myTurn || s.phase !== 'end') return;
        nextTurn(s);
        return;
      }

      // ---------- Échanges ----------
      case 'proposeTrade': {
        if (s.trade) return err('Un échange est déjà en cours');
        const target = player(s, a.to);
        if (!target || target.bankrupt || target.id === id) return err('Joueur invalide');
        const give = validOffer(s, p, a.give || {}), get = validOffer(s, target, a.get || {});
        if (!give || !get) return err('Offre invalide (argent, cartes ou terrains bâtis ?)');
        if (!give.money && !give.props.length && !give.cards && !get.money && !get.props.length && !get.cards) return err('Offre vide');
        s.trade = { from: id, to: target.id, give, get };
        log(s, `🤝 ${p.name} propose un échange à ${target.name}.`);
        return;
      }
      case 'cancelTrade': {
        if (!s.trade || (s.trade.from !== id && s.trade.to !== id)) return;
        log(s, `🤝 Échange ${s.trade.to === id ? 'refusé' : 'annulé'}.`);
        s.trade = null;
        return;
      }
      case 'acceptTrade': {
        const t = s.trade;
        if (!t || t.to !== id) return;
        const from = player(s, t.from), to = p;
        // re-validation (la situation a pu changer)
        if (!validOffer(s, from, t.give) || !validOffer(s, to, t.get)) { s.trade = null; return err('L’échange n’est plus valide'); }
        from.money += t.get.money - t.give.money;
        to.money += t.give.money - t.get.money;
        t.give.props.forEach(i => { s.props[i].owner = to.id; });
        t.get.props.forEach(i => { s.props[i].owner = from.id; });
        to.jailCards.push(...from.jailCards.splice(0, t.give.cards));
        from.jailCards.push(...to.jailCards.splice(0, t.get.cards));
        log(s, `🤝 Échange conclu entre ${from.name} et ${to.name} !`);
        s.trade = null;
        return;
      }
    }
  },

  view(s) {
    // On n'envoie pas l'ordre des cartes (secret).
    const { decks, board, ...rest } = s;
    return {
      ...rest,
      auction: s.auction && { ...s.auction, left: Math.max(0, s.auction.deadline - Date.now()) },
      worth: Object.fromEntries(s.players.map(p => [p.id, worth(s, p)])),
    };
  },

  staticData() { return { board: BOARD, groups: GROUPS }; },
};
