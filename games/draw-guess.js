// Draw & Guess : un joueur dessine, les autres devinent. 2 à 12 joueurs.
const G = require('./lib/geo');

const WORDS = ('chat chien maison voiture arbre soleil lune étoile pizza banane pomme fraise bateau avion fusée vélo ' +
  'guitare piano tambour lunettes chapeau chaussure parapluie montre téléphone ordinateur clavier souris télévision lampe ' +
  'canapé lit chaise table fourchette couteau cuillère assiette verre bouteille gâteau glace bonbon chocolat hamburger frites ' +
  'poisson requin baleine pieuvre tortue grenouille serpent lion tigre girafe éléphant singe ours lapin cheval vache cochon ' +
  'mouton poule canard hibou papillon abeille araignée escargot dragon licorne fantôme robot sorcière pirate princesse roi ' +
  'château pont tour église école hôpital plage montagne volcan île désert forêt cascade arc-en-ciel nuage pluie neige éclair ' +
  'tornade bonhomme-de-neige sapin cadeau ballon football basket tennis piscine skateboard trottinette train métro camion tracteur ' +
  'hélicoptère sous-marin ancre boussole carte trésor clé cadenas porte fenêtre escalier échelle marteau tournevis scie ' +
  'pinceau crayon livre journal enveloppe horloge réveil bougie feu fumée squelette crâne zombie vampire momie alien soucoupe ' +
  'planète astronaute télescope microscope aimant batterie ampoule prise câble casque micro caméra appareil-photo cinéma ' +
  'popcorn hot-dog sandwich spaghetti sushi croissant baguette fromage œuf lait café thé citron carotte tomate champignon').split(' ');

const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function mask(word, revealed) {
  return [...word].map((ch, i) => (/[- ]/.test(ch) || revealed.includes(i) ? ch : '_')).join('');
}

function feed(state, item) { state.feed.push(item); if (state.feed.length > 40) state.feed.shift(); }

function nextTurn(state) {
  state.turnIndex++;
  if (state.turnIndex >= state.order.length * state.rounds) {
    state.over = true;
    const best = Math.max(...state.scores);
    state.winner = state.scores.filter(s => s === best).length > 1 ? -1 : state.scores.indexOf(best);
    return;
  }
  state.drawer = state.order[state.turnIndex % state.order.length];
  state.round = Math.floor(state.turnIndex / state.order.length) + 1;
  state.phase = 'choose';
  state.timer = 15;
  state._choices = G.shuffle(WORDS.slice()).slice(0, 3);
  state._word = null;
  state.hint = '';
  state.revealed = [];
  state.guessed = [];
  state._strokes.push({ clear: true });
}

function startDrawing(state, word) {
  state._word = word;
  state.phase = 'draw';
  state.timer = state.drawTime;
  state.hint = mask(word, []);
  feed(state, { kind: 'sys', text: `${'✏️'} C'est parti ! Le mot fait ${[...word].filter(c => !/[- ]/.test(c)).length} lettres.` });
}

module.exports = {
  id: 'draw-guess',
  name: 'Draw & Guess',
  description: 'Dessine, devine, rigole : le plus rapide à trouver marque le plus de points.',
  category: 'Ambiance',
  icon: '🎨',
  color: '#ff7ac6',
  order: 6,
  realtime: true,
  sendEvery: 3,
  rules: "Chacun son tour, un joueur choisit un mot parmi 3 et le dessine (souris, couleurs, gomme, effacer). Les autres tapent leurs propositions dans la zone de saisie. Plus tu trouves vite, plus tu marques de points, et le dessinateur gagne des points pour chaque joueur qui trouve. Des lettres se dévoilent au fil du temps. Chaque joueur dessine 2 fois, le meilleur score gagne.",
  minPlayers: 2,
  maxPlayers: 12,

  setup(n) {
    const state = {
      order: G.shuffle([...Array(n).keys()]), rounds: 2, turnIndex: -1, round: 1, drawer: 0, drawTime: 80,
      phase: 'choose', timer: 0, hint: '', revealed: [], guessed: [], scores: Array(n).fill(0), feed: [],
      _strokes: [], _cursor: {}, _choices: [], _word: null, over: false, winner: null, turn: -1,
    };
    nextTurn(state);
    return state;
  },

  move(state, p, move) {
    if (state.over) return null;
    if (move.type === 'choose' && p === state.drawer && state.phase === 'choose') {
      const w = state._choices[move.index | 0];
      if (w) startDrawing(state, w);
      return null;
    }
    if ((move.type === 'stroke' || move.type === 'clear') && p === state.drawer && state.phase === 'draw') {
      if (move.type === 'clear') { state._strokes.push({ clear: true }); return null; }
      const pts = Array.isArray(move.pts) ? move.pts.slice(0, 300).map(([x, y]) => [G.clamp(x | 0, 0, 800), G.clamp(y | 0, 0, 560)]) : [];
      if (pts.length) state._strokes.push({ pts, color: String(move.color || '#000').slice(0, 9), size: G.clamp(move.size | 0, 2, 40) });
      return null;
    }
    if (move.type === 'guess') {
      const text = String(move.text || '').trim().slice(0, 60);
      if (!text) return null;
      const canSpoil = p === state.drawer || state.guessed.includes(p);
      if (state.phase !== 'draw' || canSpoil) { feed(state, { kind: 'chat', p, text, secret: state.phase === 'draw' && canSpoil }); return null; }
      if (norm(text) === norm(state._word)) {
        const gain = Math.max(40, Math.round(300 * state.timer / state.drawTime));
        state.scores[p] += gain;
        state.scores[state.drawer] += 40;
        state.guessed.push(p);
        feed(state, { kind: 'ok', p, text: `a trouvé le mot ! (+${gain})` });
        const guessers = state.order.length - 1;
        if (state.guessed.length >= guessers) state.timer = Math.min(state.timer, 0.01);
      } else {
        feed(state, { kind: 'chat', p, text });
        if (lev(norm(text), norm(state._word)) === 1) feed(state, { kind: 'close', to: p, text: `« ${text} » : tu chauffes !` });
      }
      return null;
    }
    return null;
  },

  tick(state, dt) {
    if (state.over) return;
    state.timer -= dt;
    if (state.phase === 'choose' && state.timer <= 0) startDrawing(state, G.pick(state._choices));
    else if (state.phase === 'draw') {
      // Indices : une lettre dévoilée à 50 % et 75 % du temps
      const word = state._word;
      const letters = [...word].map((c, i) => i).filter(i => !/[- ]/.test(word[i]) && !state.revealed.includes(i));
      const wanted = state.timer < state.drawTime * 0.25 ? 2 : state.timer < state.drawTime * 0.5 ? 1 : 0;
      if (state.revealed.length < wanted && letters.length > 2) { state.revealed.push(G.pick(letters)); state.hint = mask(word, state.revealed); }
      if (state.timer <= 0) {
        state.phase = 'reveal'; state.timer = 5; state.lastWord = word;
        feed(state, { kind: 'sys', text: `Le mot était : ${word}` });
      }
    } else if (state.phase === 'reveal' && state.timer <= 0) nextTurn(state);
  },

  view(state, me) {
    const from = state._cursor[me] || 0;
    state._cursor[me] = state._strokes.length;
    const isDrawer = me === state.drawer;
    return {
      ...state, me,
      timer: Math.ceil(state.timer),
      strokes: state._strokes.slice(from),
      choices: isDrawer && state.phase === 'choose' ? state._choices : null,
      word: (isDrawer || state.guessed.includes(me)) && state._word ? state._word : null,
      feed: state.feed.filter(f => (f.to === undefined || f.to === me) && (!f.secret || isDrawer || state.guessed.includes(me))).slice(-25),
    };
  },
  resync(state, me) {
    // On renvoie tout depuis le dernier "effacer"
    let k = state._strokes.length - 1;
    while (k > 0 && !state._strokes[k].clear) k--;
    state._cursor[me] = Math.max(0, k);
  },
};
