// =====================================================================
//  DRAW & GUESS — règles (serveur)
//  Un joueur dessine un mot, les autres devinent dans la discussion.
//  Plus on trouve vite, plus on marque. Le dessinateur marque aussi.
// =====================================================================
const U = require('./lib/util');
const { CATS, ALL, norm, lev } = require('./lib/words');

const sysMsg = (s, text, kind = 'sys') => { s.msgs.push({ kind, text, n: ++s.msgN }); if (s.msgs.length > 80) s.msgs.shift(); };
const active = s => s.players.filter(p => !p.gone);

function nextTurn(s) {
  // ordre : chaque joueur dessine une fois par manche
  if (!s.queue.length) {
    s.round++;
    if (s.round > s.rounds) { s.phase = 'over'; return; }
    s.queue = active(s).map(p => p.id);
    sysMsg(s, `— Manche ${s.round} / ${s.rounds} —`, 'round');
  }
  s.drawer = s.queue.shift();
  if (!active(s).some(p => p.id === s.drawer)) return nextTurn(s);
  const pool = s.category === 'mix' ? ALL : CATS[s.category];
  s.choices = U.shuffle(pool.slice()).slice(0, 3);
  s.word = null; s.strokes = []; s.found = []; s.hintIdx = [];
  for (const p of s.players) { p.found = false; p.gained = 0; }
  s.phase = 'choose'; s.until = Date.now() + 15000;
  s.needSync = new Set(s.players.map(p => p.id));
}
function startDraw(s, word) {
  s.word = word; s.phase = 'draw'; s.start = Date.now(); s.until = s.start + s.time * 1000;
  const d = s.players.find(p => p.id === s.drawer);
  sysMsg(s, `✏️ ${d?.name} dessine !`);
}
function endTurn(s, why) {
  const d = s.players.find(p => p.id === s.drawer);
  if (d && s.found.length) { const g = Math.round(s.found.length / Math.max(1, active(s).length - 1) * 120 + 20); d.score += g; d.gained = g; }
  sysMsg(s, `${why} Le mot était « ${s.word} ».`, 'reveal');
  s.phase = 'reveal'; s.until = Date.now() + 5000; s.lastWord = s.word;
}
function hint(s) {
  if (!s.hints || !s.word) return '';
  const w = s.word, n = [...w].filter(c => /[\p{L}]/u.test(c)).length;
  const frac = (Date.now() - s.start) / (s.time * 1000);
  const want = Math.min(Math.floor(n * 0.45), Math.floor(frac * n * 0.6));
  while (s.hintIdx.length < want) { const free = [...w].map((c, i) => i).filter(i => /[\p{L}]/u.test(w[i]) && !s.hintIdx.includes(i)); if (!free.length) break; s.hintIdx.push(U.pick(free)); }
  return [...w].map((c, i) => /[\p{L}]/u.test(c) ? (s.hintIdx.includes(i) ? c : '_') : c).join(' ');
}

module.exports = {
  id: 'draw',
  name: 'Draw & Guess',
  description: 'Dessinez le mot secret, devinez celui des autres. Le plus rapide marque le plus de points !',
  category: 'Fête', icon: '🎨', color: '#ec4899', order: 8, joinInProgress: true,
  tags: ['✏️ Dessin', '😂 Ambiance'],
  rules: `<ul><li>À tour de rôle, un joueur choisit un mot parmi 3 et le <b>dessine</b>.</li>
    <li>Les autres tapent leurs propositions : plus vous trouvez <b>vite</b>, plus vous marquez.</li>
    <li>Le dessinateur gagne des points pour chaque joueur qui trouve.</li>
    <li>Interdit d’écrire le mot sur le dessin 😉</li></ul>`,
  settings: [
    { key: 'rounds', label: 'Manches', type: 'select', default: 3, options: [{ v: 1, l: '1' }, { v: 2, l: '2' }, { v: 3, l: '3' }, { v: 5, l: '5' }] },
    { key: 'time', label: 'Temps pour dessiner', type: 'number', default: 80, min: 30, max: 180, step: 10, unit: ' s' },
    { key: 'category', label: 'Thème des mots', type: 'select', default: 'mix', options: [{ v: 'mix', l: 'Tout' }, { v: 'animaux', l: 'Animaux' }, { v: 'nourriture', l: 'Nourriture' }, { v: 'objets', l: 'Objets' }, { v: 'metiers', l: 'Métiers' }, { v: 'actions', l: 'Actions' }] },
    { key: 'hints', label: 'Indices (lettres révélées)', type: 'toggle', default: true },
  ],
  minPlayers: 2, maxPlayers: 12, tickRate: 2,

  create(players, ctx, o) {
    const s = {
      players: players.map(p => ({ ...p, score: 0, found: false, gained: 0, gone: false })),
      rounds: o.rounds || 3, time: o.time || 80, category: o.category || 'mix', hints: o.hints !== false,
      round: 0, queue: [], msgs: [], msgN: 0, strokes: [], phase: 'choose', needSync: new Set(),
    };
    nextTurn(s);
    return s;
  },
  onJoin(s, p) { s.players.push({ ...p, score: 0, found: false, gained: 0, gone: false }); s.queue.push(p.id); s.needSync.add(p.id); sysMsg(s, `${p.name} nous rejoint !`); },
  onLeave(s, id) {
    const p = s.players.find(q => q.id === id); if (!p) return;
    p.gone = true; s.queue = s.queue.filter(x => x !== id); sysMsg(s, `${p.name} est parti.`);
    if (active(s).length < 2) { s.phase = 'over'; return; }
    if (s.drawer === id && (s.phase === 'draw' || s.phase === 'choose')) { if (s.word) endTurn(s, 'Le dessinateur est parti.'); else nextTurn(s); }
  },
  tick(s) {
    const now = Date.now();
    if (s.phase === 'choose' && now >= s.until) startDraw(s, U.pick(s.choices));
    else if (s.phase === 'draw' && now >= s.until) endTurn(s, '⏱ Temps écoulé !');
    else if (s.phase === 'reveal' && now >= s.until) nextTurn(s);
  },

  onAction(s, id, a, ctx) {
    const p = s.players.find(q => q.id === id); if (!p) return;
    const isDrawer = s.drawer === id;
    switch (a.type) {
      case 'choose': if (isDrawer && s.phase === 'choose' && s.choices.includes(a.word)) startDraw(s, a.word); return;
      case 'stroke': { // { c: couleur, w: épaisseur, p: [x,y,x,y…] en 0..1000 }
        if (!isDrawer || s.phase !== 'draw' || !Array.isArray(a.p)) return;
        const st = { c: String(a.c || '#000').slice(0, 9), w: U.clamp(+a.w || 4, 1, 60), p: a.p.slice(0, 400).map(v => U.clamp(Math.round(+v) || 0, 0, 1000)), id: a.id, fill: !!a.fill };
        // un même trait peut arriver en plusieurs morceaux (id identique)
        const prev = s.strokes.find(x => x.id === st.id && st.id != null);
        if (prev && !st.fill) prev.p.push(...st.p); else s.strokes.push(st);
        if (s.strokes.length > 3000) s.strokes.shift();
        ctx.emit({ type: 'stroke', s: st });
        return;
      }
      case 'clear': if (isDrawer && s.phase === 'draw') { s.strokes = []; ctx.emit({ type: 'clear' }); } return;
      case 'undo': if (isDrawer && s.phase === 'draw' && s.strokes.length) { s.strokes.pop(); ctx.emit({ type: 'redraw', strokes: s.strokes }); } return;
      case 'sync': s.needSync.add(id); return;
      case 'guess': {
        const text = String(a.text || '').trim().slice(0, 80); if (!text) return;
        if (s.phase === 'draw' && !isDrawer && !p.found) {
          const g = norm(text), w = norm(s.word);
          if (g === w) {
            p.found = true; s.found.push(id);
            const frac = Math.max(0, (s.until - Date.now()) / (s.time * 1000));
            const pts = Math.round(50 + 250 * frac) + (s.found.length === 1 ? 50 : 0);
            p.score += pts; p.gained = pts;
            sysMsg(s, `✅ ${p.name} a trouvé ! (+${pts})`, 'ok');
            ctx.emit({ type: 'found', id });
            if (s.found.length >= active(s).length - 1) endTurn(s, '🎉 Tout le monde a trouvé !');
            else if (s.until - Date.now() > 20000 && s.found.length >= Math.ceil((active(s).length - 1) / 2)) s.until = Math.min(s.until, Date.now() + 20000);
            return;
          }
          if (w.length > 3 && lev(g, w) === 1) ctx.emit({ type: 'close', text }, id);
        }
        // les joueurs qui ont trouvé ne parlent qu'entre eux
        const secret = s.phase === 'draw' && (p.found || isDrawer);
        s.msgs.push({ kind: secret ? 'secret' : 'chat', id, name: p.name, color: p.color, text, n: ++s.msgN }); if (s.msgs.length > 80) s.msgs.shift();
        return;
      }
    }
  },

  view(s, id) {
    const me = s.players.find(p => p.id === id);
    const isDrawer = s.drawer === id;
    const canSecret = s.phase !== 'draw' || isDrawer || me?.found;
    const v = {
      phase: s.phase, round: s.round, rounds: s.rounds, drawer: s.drawer, left: Math.max(0, (s.until || 0) - Date.now()), time: s.time,
      word: isDrawer || me?.found || s.phase === 'reveal' || s.phase === 'over' ? s.word : null,
      hint: s.phase === 'draw' ? hint(s) : '', wordLen: s.word ? s.word.length : 0,
      choices: isDrawer && s.phase === 'choose' ? s.choices : null, lastWord: s.lastWord,
      msgs: s.msgs.filter(m => m.kind !== 'secret' || canSecret).slice(-50),
      players: s.players.filter(p => !p.gone).map(p => ({ id: p.id, name: p.name, color: p.color, score: p.score, found: p.found, gained: p.gained })),
    };
    if (s.needSync.has(id)) { v.strokes = s.strokes; s.needSync.delete(id); }
    return v;
  },
};
