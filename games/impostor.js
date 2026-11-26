// =====================================================================
//  IMPOSTEUR — règles (serveur)
//  Tous les joueurs reçoivent le même mot secret… sauf l'imposteur.
//  Chacun donne un indice, on discute, on vote. Démasquez-le !
// =====================================================================
const U = require('./lib/util');
const { CATS, PAIRS, ALL, norm, lev } = require('./lib/words');

const log = (s, m) => { s.log.push(m); if (s.log.length > 80) s.log.shift(); };
const alive = s => s.players.filter(p => !p.gone);

function newRound(s) {
  s.round++;
  const ps = alive(s);
  const nImp = Math.min(s.impostors, Math.max(1, Math.floor((ps.length - 1) / 2)));
  const imps = new Set(U.shuffle(ps.map(p => p.id)).slice(0, nImp));
  let word, fake = null;
  if (s.mode === 'pair') { const pair = U.shuffle(U.pick(PAIRS).slice()); word = pair[0]; fake = pair[1]; }
  else word = U.pick(s.category === 'mix' ? ALL : CATS[s.category]);
  s.word = word; s.fake = fake;
  for (const p of ps) { p.imp = imps.has(p.id); p.clues = []; p.vote = null; }
  s.order = U.shuffle(ps.map(p => p.id));
  s.clueRound = 1; s.clueTurn = 0;
  s.phase = 'reveal'; s.until = Date.now() + 7000;
  s.result = null; s.guess = null;
  log(s, `— Manche ${s.round} / ${s.rounds} —`);
}
function nextClue(s) {
  s.clueTurn++;
  if (s.clueTurn >= s.order.length) { s.clueTurn = 0; s.clueRound++; }
  if (s.clueRound > s.clueRounds) { s.phase = 'discuss'; s.until = Date.now() + s.discussTime * 1000; log(s, '💬 Place au débat ! Qui est l’imposteur ?'); return; }
  s.until = Date.now() + s.clueTime * 1000;
}
function clueTurnId(s) { return s.order[s.clueTurn]; }
function startVote(s) { s.phase = 'vote'; s.until = Date.now() + 30000; log(s, '🗳️ Votez !'); }
function countVotes(s) {
  const tally = {};
  for (const p of alive(s)) if (p.vote) tally[p.vote] = (tally[p.vote] || 0) + 1;
  const max = Math.max(0, ...Object.values(tally));
  const top = Object.keys(tally).filter(k => tally[k] === max);
  const imps = alive(s).filter(p => p.imp);
  const accused = top.length === 1 && max > 0 ? top[0] : null;
  const caught = accused && imps.some(p => p.id === accused);
  s.tally = tally;
  s.result = { accused, caught, imps: imps.map(p => p.id), word: s.word, fake: s.fake, tie: top.length > 1 };
  const accName = accused ? s.players.find(p => p.id === accused)?.name : null;
  if (caught && s.mode === 'blank') { s.phase = 'guess'; s.until = Date.now() + 25000; log(s, `🎯 ${accName} était bien l'imposteur ! Dernière chance : il peut deviner le mot.`); return; }
  scoreRound(s, caught, false);
  log(s, caught ? `🎯 ${accName} était l'imposteur !` : accused ? `😱 ${accName} était innocent… l'imposteur gagne !` : '🤷 Égalité : personne n’est éliminé, l’imposteur gagne !');
}
function scoreRound(s, caught, stolen) {
  for (const p of alive(s)) {
    if (p.imp) { if (!caught || stolen) p.score += 3; }
    else { if (caught && !stolen) p.score += 2; if (s.result.imps.includes(p.vote)) p.score += 1; }
  }
  s.result.stolen = stolen;
  s.phase = 'result'; s.until = Date.now() + 9000;
}

module.exports = {
  id: 'impostor',
  name: 'Imposteur',
  description: 'Tout le monde connaît le mot secret… sauf l’imposteur. Donnez des indices, débattez, votez !',
  category: 'Fête', icon: '🕵️', color: '#dc2626', order: 3,
  tags: ['🗣️ Bluff', '⏱ 10–20 min'],
  rules: `<ul><li>Chaque joueur reçoit le <b>mot secret</b>, sauf l’<b>imposteur</b> qui ne le connaît pas (ou reçoit un mot voisin).</li>
    <li>Chacun son tour, donnez <b>un indice</b> : assez précis pour prouver que vous savez, assez vague pour ne pas aider l’imposteur.</li>
    <li>Débattez, puis <b>votez</b> contre le suspect.</li>
    <li>Imposteur démasqué : +2 pour l’équipe. Il s’en sort (ou devine le mot) : +3 pour lui.</li></ul>`,
  settings: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'blank', options: [{ v: 'blank', l: 'Imposteur sans mot' }, { v: 'pair', l: 'Mot voisin (il ne sait pas qu’il est imposteur)' }] },
    { key: 'category', label: 'Thème des mots', type: 'select', default: 'mix', options: [{ v: 'mix', l: 'Tout' }, { v: 'animaux', l: 'Animaux' }, { v: 'nourriture', l: 'Nourriture' }, { v: 'objets', l: 'Objets' }, { v: 'lieux', l: 'Lieux' }, { v: 'metiers', l: 'Métiers' }], help: 'Ignoré en mode « mot voisin ».' },
    { key: 'impostors', label: 'Imposteurs', type: 'select', default: 1, options: [{ v: 1, l: '1' }, { v: 2, l: '2' }] },
    { key: 'rounds', label: 'Manches', type: 'select', default: 5, options: [{ v: 3, l: '3' }, { v: 5, l: '5' }, { v: 8, l: '8' }] },
    { key: 'clueRounds', label: 'Tours d’indices', type: 'select', default: 2, options: [{ v: 1, l: '1' }, { v: 2, l: '2' }, { v: 3, l: '3' }] },
    { key: 'clueTime', label: 'Temps par indice', type: 'number', default: 30, min: 10, max: 90, step: 5, unit: ' s' },
    { key: 'discussTime', label: 'Temps de débat', type: 'number', default: 60, min: 20, max: 180, step: 10, unit: ' s' },
  ],
  minPlayers: 3, maxPlayers: 12, tickRate: 2,

  create(players, ctx, o) {
    const s = {
      players: players.map(p => ({ ...p, score: 0, imp: false, clues: [], vote: null, gone: false })),
      mode: o.mode || 'blank', category: o.category || 'mix', impostors: o.impostors || 1, rounds: o.rounds || 5,
      clueRounds: o.clueRounds || 2, clueTime: o.clueTime || 30, discussTime: o.discussTime || 60,
      round: 0, log: [], phase: 'reveal', chat: [],
    };
    newRound(s);
    return s;
  },
  onJoin() {},
  onLeave(s, id) {
    const p = s.players.find(q => q.id === id); if (!p) return;
    p.gone = true; log(s, `${p.name} est parti.`);
    if (alive(s).length < 3) { s.phase = 'over'; return; }
    if (s.phase === 'clues') { s.order = s.order.filter(x => x !== id); if (s.clueTurn >= s.order.length) { s.clueTurn = s.order.length - 1; nextClue(s); } }
    if (p.imp && ['reveal', 'clues', 'discuss', 'vote'].includes(s.phase)) { log(s, 'L’imposteur est parti : manche annulée.'); s.phase = 'result'; s.result = { accused: null, caught: true, imps: [id], word: s.word, fake: s.fake, cancelled: true }; s.until = Date.now() + 5000; }
  },
  tick(s) {
    const now = Date.now();
    if (now < s.until || s.phase === 'over') return;
    if (s.phase === 'reveal') { s.phase = 'clues'; s.until = now + s.clueTime * 1000; log(s, '✍️ Tour des indices !'); }
    else if (s.phase === 'clues') { const p = s.players.find(q => q.id === clueTurnId(s)); if (p) { p.clues.push('…'); log(s, `${p.name} n’a rien dit.`); } nextClue(s); }
    else if (s.phase === 'discuss') startVote(s);
    else if (s.phase === 'vote') countVotes(s);
    else if (s.phase === 'guess') { log(s, '⏱ Trop tard pour deviner !'); scoreRound(s, true, false); }
    else if (s.phase === 'result') { if (s.round >= s.rounds) s.phase = 'over'; else newRound(s); }
  },
  broadcastOnAction: true,

  onAction(s, id, a, ctx) {
    const p = s.players.find(q => q.id === id);
    if (!p || p.gone) return;
    switch (a.type) {
      case 'clue': {
        if (s.phase !== 'clues' || clueTurnId(s) !== id) return { error: "Ce n'est pas votre tour" };
        const w = String(a.text || '').trim().slice(0, 30);
        if (!w) return { error: 'Écrivez un indice' };
        if (norm(w) === norm(s.word) || (s.fake && norm(w) === norm(s.fake))) return { error: 'Vous ne pouvez pas dire le mot !' };
        p.clues.push(w); log(s, `💡 ${p.name} : « ${w} »`); ctx.emit({ type: 'clue' });
        nextClue(s); return;
      }
      case 'skip': if (s.phase === 'discuss') { p.ready = true; if (alive(s).every(q => q.ready)) { alive(s).forEach(q => { q.ready = false; }); startVote(s); } } return;
      case 'vote': {
        if (s.phase !== 'vote' || a.target === id || !alive(s).some(q => q.id === a.target)) return;
        p.vote = a.target; ctx.emit({ type: 'voted' });
        if (alive(s).every(q => q.vote)) countVotes(s);
        return;
      }
      case 'guess': {
        if (s.phase !== 'guess' || !p.imp) return;
        const ok = norm(a.text) === norm(s.word) || lev(norm(a.text), norm(s.word)) <= 1;
        log(s, `${p.name} propose « ${String(a.text).slice(0, 30)} » : ${ok ? 'BONNE RÉPONSE ! Il vole la victoire !' : 'raté !'}`);
        scoreRound(s, true, ok); return;
      }
      case 'say': { // message pendant le débat
        const t = String(a.text || '').trim().slice(0, 160);
        if (t) { s.chat.push({ id, name: p.name, color: p.color, text: t }); if (s.chat.length > 60) s.chat.shift(); }
        return;
      }
    }
  },

  results(s) {
    if (s.phase !== 'over') return null;
    const top = Math.max(...s.players.map(p => p.score));
    return { key: 'over', players: U.rank(s.players.filter(p => !p.gone).map(p => ({ id: p.id, score: p.score, win: p.score === top }))), records: s.players.map(p => ({ id: p.id, key: 'impostor:score', value: p.score })) };
  },
  view(s, id) {
    const me = s.players.find(p => p.id === id);
    const showAll = s.phase === 'result' || s.phase === 'over' || s.phase === 'guess';
    let secret = null;
    if (me && !me.gone) {
      if (s.mode === 'blank') secret = me.imp ? { imp: true } : { word: s.word };
      else secret = { word: me.imp ? s.fake : s.word }; // en mode voisin, l'imposteur ne sait pas qu'il l'est
    }
    return {
      phase: s.phase, round: s.round, rounds: s.rounds, mode: s.mode, left: Math.max(0, s.until - Date.now()),
      turn: s.phase === 'clues' ? clueTurnId(s) : null, clueRound: s.clueRound, clueRounds: s.clueRounds,
      secret, result: showAll ? (s.phase === 'guess' ? { ...s.result, word: null, fake: null } : s.result) : null, tally: showAll ? s.tally : null, log: s.log.slice(-20), chat: s.chat.slice(-40),
      players: s.players.map(p => ({ id: p.id, name: p.name, color: p.color, score: p.score, clues: p.clues, gone: p.gone, voted: !!p.vote, ready: !!p.ready, imp: showAll ? p.imp : undefined, vote: showAll ? p.vote : undefined })),
      myVote: me?.vote || null, order: s.order,
    };
  },
};
