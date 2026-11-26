// =====================================================================
//  IMPOSTEUR — affichage (navigateur)
// =====================================================================
import { shell, endScreen, sfx, esc, css, avatar } from '../lib/kit.js';

css('imp-css', `
.im { position:absolute; inset:0; display:grid; grid-template-columns: 1fr 340px; background: radial-gradient(circle at 50% 0%, #3f1d38, #0c0a14 65%); }
.im-main { padding:20px; overflow:auto; display:flex; flex-direction:column; gap:16px; align-items:center; }
.im-secret { width:min(560px,100%); border-radius:22px; padding:20px; text-align:center; background:linear-gradient(135deg,#312e81,#1e1b4b); box-shadow:0 20px 50px #0008; position:relative; overflow:hidden; cursor:pointer; user-select:none; }
.im-secret.imp { background:linear-gradient(135deg,#991b1b,#450a0a); }
.im-secret small { text-transform:uppercase; letter-spacing:.12em; color:#c7d2fe; font-weight:700; font-size:12px; }
.im-secret .w { font-family:'Space Grotesk',sans-serif; font-size:clamp(32px,6vw,54px); font-weight:700; margin:6px 0; }
.im-secret.hidden-word .w { filter: blur(14px); }
.im-secret .hint { color:#c7d2fe; font-size:13px; }
.im-phase { display:flex; align-items:center; gap:12px; font-size:18px; font-weight:700; text-align:center; flex-wrap:wrap; justify-content:center; }
.im-time { font-family:'Space Grotesk',monospace; background:rgba(0,0,0,.4); padding:4px 12px; border-radius:999px; }
.im-grid { width:min(860px,100%); display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:12px; }
.im-card { background:rgba(255,255,255,.05); border:2px solid rgba(255,255,255,.08); border-radius:16px; padding:12px; display:flex; flex-direction:column; gap:8px; transition:all .2s; position:relative; }
.im-card.turn { border-color:#facc15; box-shadow:0 0 22px rgba(250,204,21,.35); }
.im-card.votable { cursor:pointer; } .im-card.votable:hover { border-color:#f87171; transform:translateY(-2px); }
.im-card.myvote { border-color:#f87171; background:rgba(248,113,113,.12); }
.im-card.isimp { border-color:#ef4444; background:rgba(239,68,68,.18); }
.im-card .top { display:flex; align-items:center; gap:8px; font-weight:700; }
.im-card .clues { display:flex; flex-wrap:wrap; gap:6px; min-height:28px; }
.im-card .clue { background:#fef3c7; color:#422006; padding:4px 10px; border-radius:8px; font-weight:700; font-size:14px; animation: imin .3s; transform: rotate(-2deg); }
.im-card .clue:nth-child(2n) { transform: rotate(2deg); background:#dbeafe; color:#172554; }
@keyframes imin { from { transform: scale(0) rotate(-20deg); } }
.im-card .badge { position:absolute; top:-10px; right:10px; font-size:12px; font-weight:800; padding:3px 8px; border-radius:999px; background:#ef4444; }
.im-card .votes { font-size:12px; color:#fca5a5; font-weight:700; }
.im-input { display:flex; gap:8px; width:min(560px,100%); } .im-input input { font-size:18px; }
.im-result { width:min(560px,100%); text-align:center; padding:18px; border-radius:18px; background:rgba(0,0,0,.35); }
.im-result h2 { margin:0 0 6px; font-size:28px; }
.im-side { background:rgba(8,6,14,.7); border-left:1px solid rgba(255,255,255,.08); display:flex; flex-direction:column; padding:12px; gap:10px; min-height:0; }
.im-side h4 { margin:0; font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#f9a8d4; }
.im-chat { flex:1; overflow:auto; display:flex; flex-direction:column; gap:5px; font-size:14px; }
.im-scores > div { display:flex; justify-content:space-between; align-items:center; gap:6px; padding:3px 0; }
@media (max-width:900px) { .im { grid-template-columns:1fr; overflow:auto; } .im-side { border:0; min-height:360px; } }
`);

let api, S, sh, ui = {}, endShown = false, peek = false, lastPhase = '', lastChat = '';
const fmt = ms => `${Math.ceil(ms / 1000)} s`;

function render() {
  const me = S.players.find(p => p.id === api.myId);
  // secret
  const sec = S.secret;
  ui.secret.className = `im-secret ${sec?.imp ? 'imp' : ''} ${!peek && S.phase !== 'reveal' ? 'hidden-word' : ''}`;
  ui.secret.innerHTML = !sec ? '<small>Spectateur</small>' : sec.imp
    ? `<small>Votre rôle</small><div class="w">🕵️ IMPOSTEUR</div><div class="hint">Vous ne connaissez pas le mot. Écoutez les indices et fondez-vous dans la masse !</div>`
    : `<small>Le mot secret</small><div class="w">${esc(sec.word)}</div><div class="hint">${S.phase === 'reveal' ? 'Mémorisez-le !' : 'Maintenez appuyé pour revoir le mot'}${S.mode === 'pair' ? ' · Attention : l’imposteur a peut-être un mot proche… et c’est peut-être vous !' : ''}</div>`;
  // phase
  const turnP = S.players.find(p => p.id === S.turn);
  const phaseTxt = {
    reveal: '👀 Découvrez votre mot…',
    clues: turnP ? (turnP.id === api.myId ? '✍️ À vous de donner un indice !' : `✍️ ${esc(turnP.name)} cherche un indice…`) : '',
    discuss: '💬 Débat : qui est l’imposteur ?',
    vote: '🗳️ Cliquez sur le joueur que vous accusez',
    guess: '🎯 L’imposteur tente de deviner le mot…',
    result: 'Résultat de la manche', over: 'Partie terminée',
  }[S.phase];
  ui.phase.innerHTML = `<span>${phaseTxt}</span>${S.left && S.phase !== 'over' ? `<span class="im-time">⏱ ${fmt(S.left)}</span>` : ''}${S.phase === 'clues' ? `<span class="im-time">Tour ${S.clueRound}/${S.clueRounds}</span>` : ''}`;
  sh.bar.textContent = `Manche ${S.round} / ${S.rounds}`;
  // joueurs
  const ordered = S.order.map(id => S.players.find(p => p.id === id)).filter(Boolean).concat(S.players.filter(p => !S.order.includes(p.id)));
  const showRes = !!S.result;
  ui.grid.innerHTML = ordered.map(p => {
    const votes = S.tally?.[p.id] || 0;
    const cls = ['im-card', p.id === S.turn ? 'turn' : '', S.phase === 'vote' && p.id !== api.myId && !p.gone ? 'votable' : '', S.myVote === p.id ? 'myvote' : '', showRes && p.imp ? 'isimp' : ''].join(' ');
    return `<div class="${cls}" data-id="${p.id}" style="${p.gone ? 'opacity:.35' : ''}">
      ${showRes && p.imp ? '<span class="badge">IMPOSTEUR</span>' : S.phase === 'vote' && p.voted ? '<span class="badge" style="background:#475569">a voté</span>' : ''}
      <div class="top">${avatar(p.name, p.color, 28)} ${esc(p.name)}${p.id === api.myId ? ' <small class="gk-muted">(vous)</small>' : ''}</div>
      <div class="clues">${p.clues.map(c => `<span class="clue">${esc(c)}</span>`).join('') || '<span class="gk-muted" style="font-size:13px">—</span>'}</div>
      ${showRes && votes ? `<div class="votes">🗳️ ${votes} vote${votes > 1 ? 's' : ''}</div>` : ''}
    </div>`;
  }).join('');
  ui.grid.querySelectorAll('.votable').forEach(c => { c.onclick = () => { api.send({ type: 'vote', target: c.dataset.id }); sfx.play('click'); }; });
  // saisie
  let input = '';
  if (S.phase === 'clues' && S.turn === api.myId) input = `<form class="im-input"><input maxlength="30" placeholder="Votre indice (un mot ou deux)" autofocus><button class="gk-btn primary">Donner</button></form>`;
  else if (S.phase === 'guess' && me && S.result?.imps?.includes(api.myId)) input = `<form class="im-input"><input maxlength="30" placeholder="Quel était le mot ?" autofocus><button class="gk-btn primary">Deviner</button></form>`;
  else if (S.phase === 'discuss' && me) input = `<button class="gk-btn ${me.ready ? '' : 'primary'}" data-skip ${me.ready ? 'disabled' : ''}>${me.ready ? 'En attente des autres…' : '⏭ Passer au vote'}</button>`;
  if (ui.input.dataset.k !== S.phase + S.turn + (me?.ready)) {
    ui.input.dataset.k = S.phase + S.turn + (me?.ready);
    ui.input.innerHTML = input;
    const f = ui.input.querySelector('form');
    if (f) { f.querySelector('input').focus(); f.onsubmit = e => { e.preventDefault(); const v = f.querySelector('input').value.trim(); if (v) api.send({ type: S.phase === 'guess' ? 'guess' : 'clue', text: v }); }; }
    ui.input.querySelector('[data-skip]')?.addEventListener('click', () => api.send({ type: 'skip' }));
  }
  // résultat
  if (S.result && (S.phase === 'result' || S.phase === 'over')) {
    const r = S.result, impNames = r.imps.map(id => S.players.find(p => p.id === id)?.name).join(' et ');
    const crewWin = r.caught && !r.stolen;
    ui.result.innerHTML = `<h2>${r.cancelled ? 'Manche annulée' : crewWin ? '🎉 Imposteur démasqué !' : '🕵️ L’imposteur gagne !'}</h2>
      <p>L’imposteur était <b>${esc(impNames)}</b>. Le mot était <b>« ${esc(r.word)} »</b>${r.fake ? ` (l’imposteur avait « ${esc(r.fake)} »)` : ''}.</p>
      ${r.stolen ? '<p>Il a deviné le mot et vole la victoire !</p>' : ''}`;
    ui.result.style.display = '';
  } else ui.result.style.display = 'none';
  // scores
  ui.scores.innerHTML = S.players.slice().sort((a, b) => b.score - a.score).map(p => `<div><span>${avatar(p.name, p.color, 20)} ${esc(p.name)}</span><b>${p.score}</b></div>`).join('');
  // discussion
  const ck = JSON.stringify(S.chat);
  if (ck !== lastChat) { lastChat = ck; ui.chat.innerHTML = S.chat.map(m => `<div><b style="color:${m.color}">${esc(m.name)}</b> ${esc(m.text)}</div>`).join(''); ui.chat.scrollTop = ui.chat.scrollHeight; }
  if (S.phase !== lastPhase) {
    if (S.phase === 'clues' || S.phase === 'vote') sfx.play('tick');
    if (S.phase === 'result') sfx.play(S.result?.caught && !S.result?.stolen ? 'good' : 'bad');
    lastPhase = S.phase;
  }
  if (S.phase === 'over' && !endShown) {
    endShown = true;
    const rows = S.players.slice().sort((a, b) => b.score - a.score).map(p => ({ name: p.name, color: p.color, value: `${p.score} pts`, me: p.id === api.myId }));
    setTimeout(() => endScreen(sh.main, api, { title: `🏆 ${esc(rows[0]?.name)} gagne !`, sub: `${S.rounds} manches jouées`, rows, valueLabel: 'Points' }), 1500);
  }
}

export default {
  mount(r, a) {
    api = a; endShown = false; lastPhase = ''; lastChat = '';
    sh = shell(r, api, { title: 'Imposteur', icon: '🕵️' });
    const el = document.createElement('div'); el.className = 'im';
    el.innerHTML = `<div class="im-main"><div class="im-secret"></div><div class="im-phase"></div><div class="im-input"></div><div class="im-result"></div><div class="im-grid"></div></div>
      <aside class="im-side"><h4>Scores</h4><div class="im-scores"></div><h4>Débat</h4><div class="im-chat"></div>
      <form class="gk-chat" style="flex:none"><form></form></form></aside>`;
    sh.main.appendChild(el);
    const q = s => el.querySelector(s);
    ui = { secret: q('.im-secret'), phase: q('.im-phase'), input: q('.im-input'), result: q('.im-result'), grid: q('.im-grid'), scores: q('.im-scores'), chat: q('.im-chat') };
    const f = document.createElement('form'); f.style.cssText = 'display:flex;gap:6px';
    f.innerHTML = '<input maxlength="160" placeholder="Accusez, défendez-vous…"><button class="gk-btn primary">➤</button>';
    f.onsubmit = e => { e.preventDefault(); const i = f.querySelector('input'); if (i.value.trim()) api.send({ type: 'say', text: i.value }); i.value = ''; };
    q('.im-side .gk-chat').replaceWith(f);
    const show = v => () => { peek = v; if (S) render(); };
    ui.secret.addEventListener('pointerdown', show(true)); ['pointerup', 'pointerleave'].forEach(ev => ui.secret.addEventListener(ev, show(false)));
  },
  update(s) { S = s; render(); },
  event(e) { if (e.type === 'clue') sfx.play('pop'); if (e.type === 'voted') sfx.play('click'); },
  unmount() { S = null; },
};
