// Empire : jeu de plateau immobilier, 2 à 6 joueurs
// Achète des terrains, complète des groupes de couleur, construis et ruine tes adversaires.
const { pick, shuffle } = require('./lib/geo');

const GROUPS = [
  { name: 'Marron', color: '#8b5a3c', house: 50 },
  { name: 'Ciel', color: '#7fd3ff', house: 50 },
  { name: 'Rose', color: '#ff7ac6', house: 100 },
  { name: 'Orange', color: '#ff9f43', house: 100 },
  { name: 'Rouge', color: '#ff4d5e', house: 150 },
  { name: 'Vert', color: '#3ecf7a', house: 150 },
  { name: 'Bleu', color: '#4b6bff', house: 200 },
];

// 24 cases autour du plateau (6 par côté)
const SQUARES = [
  { type: 'start', name: 'Départ' },
  { type: 'prop', name: 'Ruelle des Tanneurs', group: 0, price: 60 },
  { type: 'chance', name: 'Chance' },
  { type: 'prop', name: 'Rue du Moulin', group: 0, price: 70 },
  { type: 'tax', name: 'Impôts', amount: 100 },
  { type: 'gare', name: 'Gare du Nord', price: 200 },
  { type: 'jail', name: 'Prison' },
  { type: 'prop', name: 'Allée des Pins', group: 1, price: 100 },
  { type: 'prop', name: 'Allée des Chênes', group: 1, price: 120 },
  { type: 'chance', name: 'Chance' },
  { type: 'prop', name: 'Quai du Port', group: 2, price: 140 },
  { type: 'prop', name: 'Quai du Phare', group: 2, price: 160 },
  { type: 'park', name: 'Parc gratuit' },
  { type: 'prop', name: 'Place du Marché', group: 3, price: 180 },
  { type: 'prop', name: 'Place des Fontaines', group: 3, price: 200 },
  { type: 'gare', name: 'Gare du Sud', price: 200 },
  { type: 'prop', name: 'Rue des Arts', group: 4, price: 220 },
  { type: 'prop', name: 'Rue des Lettres', group: 4, price: 240 },
  { type: 'gotojail', name: 'Allez en prison' },
  { type: 'prop', name: 'Cours des Lumières', group: 5, price: 280 },
  { type: 'prop', name: 'Cours des Tilleuls', group: 5, price: 300 },
  { type: 'chance', name: 'Chance' },
  { type: 'prop', name: 'Avenue Royale', group: 6, price: 350 },
  { type: 'prop', name: 'Avenue Impériale', group: 6, price: 400 },
];
const JAIL = 6;
const RENT_MULT = [1, 5, 15, 35, 55, 75]; // 0 à 4 maisons, puis hôtel
const MAX_ROUNDS = 40;

const CHANCE = [
  { text: 'Avance jusqu\'au Départ.', go: 0 },
  { text: 'Va directement en prison.', jail: true },
  { text: 'Erreur de la banque en ta faveur : +150.', money: 150 },
  { text: 'Excès de vitesse : -50.', money: -50 },
  { text: 'C\'est ton anniversaire : chaque joueur te donne 20.', birthday: 20 },
  { text: 'Réparations : 25 par maison que tu possèdes.', repairs: 25 },
  { text: 'Recule de 3 cases.', back: 3 },
  { text: 'Avance jusqu\'à la Gare du Nord.', go: 5 },
  { text: 'Tu gagnes au loto : +100.', money: 100 },
  { text: 'Frais de vétérinaire : -80.', money: -80 },
  { text: 'Prime de fin d\'année : +50.', money: 50 },
];

const ownsGroup = (state, p, g) =>
  SQUARES.every((s, i) => s.group !== g || state.props[i].owner === p);

function rentOf(state, i, diceSum) {
  const s = SQUARES[i], pr = state.props[i];
  if (s.type === 'gare') {
    const n = SQUARES.filter((x, k) => x.type === 'gare' && state.props[k].owner === pr.owner).length;
    return 25 * Math.pow(2, n - 1);
  }
  const base = Math.round(s.price / 10);
  if (pr.houses === 0) return ownsGroup(state, pr.owner, s.group) ? base * 2 : base;
  return base * RENT_MULT[pr.houses];
}

const log = (state, text) => { state.log.unshift(text); state.log.length = Math.min(state.log.length, 8); };

function sellHousesToCover(state, p) {
  const pl = state.players[p];
  for (let i = SQUARES.length - 1; i >= 0 && pl.money < 0; i--) {
    while (state.props[i] && state.props[i].owner === p && state.props[i].houses > 0 && pl.money < 0) {
      state.props[i].houses--;
      pl.money += GROUPS[SQUARES[i].group].house / 2;
    }
  }
}

// Paiement : to = index joueur, 'bank' ou 'park'
function pay(state, p, to, amount) {
  const pl = state.players[p];
  pl.money -= amount;
  sellHousesToCover(state, p);
  let paid = amount;
  if (pl.money < 0) { paid = amount + pl.money; bankrupt(state, p, to); }
  if (typeof to === 'number') state.players[to].money += paid;
  else if (to === 'park') state.pot += paid;
}

function bankrupt(state, p, creditor) {
  const pl = state.players[p];
  pl.alive = false; pl.money = 0;
  state.props.forEach((pr, i) => {
    if (pr && pr.owner === p) { pr.owner = typeof creditor === 'number' ? creditor : -1; pr.houses = 0; }
  });
  log(state, `💸 ${state.names[p]} fait faillite !`);
  const alive = state.players.filter(x => x.alive);
  if (alive.length === 1) { state.over = true; state.winner = state.players.indexOf(alive[0]); }
}

function sendToJail(state, p) {
  const pl = state.players[p];
  pl.pos = JAIL; pl.jail = 1;
  state.doubles = 0;
  log(state, `🚓 ${state.names[p]} va en prison.`);
}

function moveBy(state, p, steps) {
  const pl = state.players[p];
  const from = pl.pos;
  pl.pos = (pl.pos + steps + SQUARES.length) % SQUARES.length;
  if (steps > 0 && pl.pos < from) { pl.money += 200; log(state, `${state.names[p]} passe par le Départ : +200.`); }
  resolve(state, p);
}

function resolve(state, p) {
  const pl = state.players[p];
  const s = SQUARES[pl.pos];
  const pr = state.props[pl.pos];
  const sum = state.dice[0] + state.dice[1];
  state.card = null;

  if (pr) {
    if (pr.owner === -1) {
      if (pl.money >= s.price) { state.phase = 'buy'; return; }
      log(state, `${state.names[p]} n'a pas assez d'argent pour ${s.name}.`);
    } else if (pr.owner !== p) {
      const rent = rentOf(state, pl.pos, sum);
      log(state, `${state.names[p]} paie ${rent} de loyer à ${state.names[pr.owner]}.`);
      pay(state, p, pr.owner, rent);
    }
  } else if (s.type === 'tax') {
    log(state, `${state.names[p]} paie ${s.amount} d'impôts.`);
    pay(state, p, 'park', s.amount);
  } else if (s.type === 'park' && state.pot > 0) {
    log(state, `🌳 ${state.names[p]} ramasse la cagnotte du parc : +${state.pot} !`);
    pl.money += state.pot; state.pot = 0;
  } else if (s.type === 'gotojail') {
    sendToJail(state, p);
  } else if (s.type === 'chance') {
    const c = pick(CHANCE);
    state.card = c.text;
    log(state, `🎴 ${state.names[p]} : ${c.text}`);
    if (c.money > 0) pl.money += c.money;
    if (c.money < 0) pay(state, p, 'park', -c.money);
    if (c.jail) sendToJail(state, p);
    if (c.birthday) state.players.forEach((o, k) => { if (k !== p && o.alive) pay(state, k, p, c.birthday); });
    if (c.repairs) {
      const houses = state.props.reduce((n, x) => n + (x && x.owner === p ? x.houses : 0), 0);
      if (houses) pay(state, p, 'park', houses * c.repairs);
    }
    if (c.back) { moveBy(state, p, -c.back); return; }
    if (c.go !== undefined) { moveBy(state, p, (c.go - pl.pos + SQUARES.length) % SQUARES.length || SQUARES.length); return; }
  }
  afterAction(state, p);
}

function afterAction(state, p) {
  if (state.over) return;
  const pl = state.players[p];
  state.phase = pl.alive && state.doubles > 0 && !pl.jail ? 'roll' : 'manage';
  if (!pl.alive) endTurn(state);
}

function endTurn(state) {
  if (state.over) return;
  const n = state.players.length;
  let next = state.turn;
  do {
    next = (next + 1) % n;
    if (next === 0) state.round++;
  } while (!state.players[next].alive);
  state.turn = next;
  state.phase = 'roll';
  state.doubles = 0;
  state.card = null;
  if (state.round > MAX_ROUNDS) {
    const worth = state.players.map((pl, k) => !pl.alive ? -1 : pl.money + state.props.reduce((s, pr, i) =>
      s + (pr && pr.owner === k ? SQUARES[i].price + pr.houses * (SQUARES[i].group !== undefined ? GROUPS[SQUARES[i].group].house : 0) : 0), 0));
    const best = Math.max(...worth);
    state.over = true;
    state.winner = worth.filter(w => w === best).length > 1 ? -1 : worth.indexOf(best);
    log(state, `Fin des ${MAX_ROUNDS} tours : la plus grosse fortune gagne !`);
  }
}

module.exports = {
  id: 'empire',
  name: 'Empire',
  description: 'Achète des rues, construis maisons et hôtels, ruine tes amis. Le jeu de plateau immobilier.',
  category: 'Jeu de société',
  icon: '🏙️',
  color: '#3ecf7a',
  order: 2,
  rules: "Lance les dés et avance. Sur une rue libre, tu peux l'acheter. Sur la rue d'un autre, tu paies un loyer. Possède toutes les rues d'une couleur pour doubler les loyers et construire des maisons (jusqu'à 4, puis un hôtel) : les loyers explosent. Un double = tu rejoues (3 doubles = prison). Les impôts et amendes vont dans la cagnotte du Parc gratuit. Passer par le Départ rapporte 200. En prison : fais un double ou paie 50. Le dernier non ruiné gagne (ou le plus riche après 40 tours).",
  minPlayers: 2,
  maxPlayers: 6,

  setup(n, names = []) {
    return {
      squares: SQUARES, groups: GROUPS,
      props: SQUARES.map(s => (s.type === 'prop' || s.type === 'gare' ? { owner: -1, houses: 0 } : null)),
      players: Array.from({ length: n }, () => ({ money: 1500, pos: 0, jail: 0, alive: true })),
      names: Array.from({ length: n }, (_, i) => names[i] || `Joueur ${i + 1}`),
      turn: 0, phase: 'roll', dice: [1, 1], doubles: 0, pot: 0, round: 1, maxRounds: MAX_ROUNDS,
      card: null, log: ['La partie commence ! Chaque joueur reçoit 1500.'], over: false, winner: null,
    };
  },

  move(state, p, move) {
    if (state.over) return 'La partie est terminée.';
    if (p !== state.turn) return "Ce n'est pas ton tour.";
    const pl = state.players[p];

    switch (move.type) {
      case 'payJail': {
        if (!pl.jail || state.phase !== 'roll') return "Tu n'es pas en prison.";
        if (pl.money < 50) return "Pas assez d'argent.";
        pay(state, p, 'park', 50); pl.jail = 0;
        log(state, `${state.names[p]} paie 50 et sort de prison.`);
        return null;
      }
      case 'roll': {
        if (state.phase !== 'roll') return 'Tu as déjà lancé les dés.';
        const a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6);
        state.dice = [a, b];
        const double = a === b;
        if (pl.jail) {
          if (double) { pl.jail = 0; log(state, `🎲 Double ! ${state.names[p]} sort de prison.`); state.doubles = 0; moveBy(state, p, a + b); return null; }
          pl.jail++;
          if (pl.jail > 3) { pl.jail = 0; pay(state, p, 'park', 50); log(state, `${state.names[p]} paie 50 et sort de prison.`); state.doubles = 0; if (pl.alive) moveBy(state, p, a + b); else afterAction(state, p); return null; }
          log(state, `${state.names[p]} reste en prison (${a} + ${b}).`);
          state.phase = 'manage';
          return null;
        }
        state.doubles = double ? state.doubles + 1 : 0;
        if (state.doubles === 3) { sendToJail(state, p); state.phase = 'manage'; return null; }
        log(state, `🎲 ${state.names[p]} fait ${a} + ${b}${double ? ' (double !)' : ''}.`);
        moveBy(state, p, a + b);
        return null;
      }
      case 'buy':
      case 'skip': {
        if (state.phase !== 'buy') return 'Rien à acheter.';
        const s = SQUARES[pl.pos];
        if (move.type === 'buy') {
          pl.money -= s.price;
          state.props[pl.pos].owner = p;
          log(state, `🏠 ${state.names[p]} achète ${s.name} pour ${s.price}.`);
        }
        afterAction(state, p);
        return null;
      }
      case 'build':
      case 'sell': {
        const i = Number(move.square);
        const s = SQUARES[i], pr = state.props[i];
        if (!pr || s.type !== 'prop' || pr.owner !== p) return "Ce n'est pas ta rue.";
        const cost = GROUPS[s.group].house;
        const groupHouses = SQUARES.map((x, k) => (x.group === s.group ? state.props[k].houses : null)).filter(h => h !== null);
        if (move.type === 'build') {
          if (!ownsGroup(state, p, s.group)) return 'Il te faut toutes les rues de cette couleur.';
          if (pr.houses >= 5) return 'Déjà un hôtel ici.';
          if (pr.houses > Math.min(...groupHouses)) return 'Construis de façon équilibrée sur le groupe.';
          if (pl.money < cost) return "Pas assez d'argent.";
          pl.money -= cost; pr.houses++;
          log(state, `🔨 ${state.names[p]} construit ${pr.houses === 5 ? 'un hôtel' : 'une maison'} sur ${s.name}.`);
        } else {
          if (!pr.houses) return 'Aucune maison à vendre.';
          pr.houses--; pl.money += cost / 2;
          log(state, `${state.names[p]} vend une maison sur ${s.name}.`);
        }
        return null;
      }
      case 'end': {
        if (state.phase !== 'manage') return state.phase === 'buy' ? "Décide d'abord si tu achètes." : 'Lance les dés.';
        endTurn(state);
        return null;
      }
    }
    return 'Action inconnue.';
  },
};
