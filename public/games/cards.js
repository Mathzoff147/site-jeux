// =====================================================================
//  COULEURS EXPRESS — affichage (navigateur)
// =====================================================================
import { shell, endScreen, chatBox, sfx, esc, css, avatar } from '../lib/kit.js';

const COL = { r: '#ef4444', y: '#facc15', g: '#22c55e', b: '#3b82f6', w: '#111827' };
const CNAME = { r: 'Rouge', y: 'Jaune', g: 'Vert', b: 'Bleu' };
const SYM = { skip: '⊘', rev: '⇄', '+2': '+2', wild: '★', '+4': '+4' };

css('cards-css', `
.ce { position:absolute; inset:0; display:grid; grid-template-columns: 1fr 300px; background:
  radial-gradient(ellipse at 50% 45%, #1f5f4a 0%, #0f3b2f 45%, #071a16 100%); }
.ce-table { position:relative; display:flex; flex-direction:column; min-height:0; overflow:hidden; }
.ce-opps { display:flex; flex-wrap:wrap; justify-content:center; gap:14px; padding:16px; }
.ce-opp { display:flex; flex-direction:column; align-items:center; gap:6px; padding:10px 14px; border-radius:16px; background:rgba(0,0,0,.25); border:2px solid transparent; transition:all .25s; min-width:110px; position:relative; }
.ce-opp.turn { border-color:#facc15; box-shadow:0 0 24px rgba(250,204,21,.35); background:rgba(0,0,0,.4); }
.ce-opp.out { opacity:.35; }
.ce-opp .nm { font-weight:700; font-size:14px; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ce-opp small { color:#cfe; opacity:.8; }
.ce-fan { display:flex; height:46px; }
.ce-fan i { width:30px; height:44px; border-radius:6px; margin-left:-20px; background:linear-gradient(135deg,#1e1b4b,#4c1d95); border:2px solid #fff; box-shadow:0 2px 6px #0006; }
.ce-fan i:first-child { margin-left:0; }
.ce-fan i::after { content:''; display:block; margin:9px auto; width:14px; height:22px; border-radius:50%; background:conic-gradient(#ef4444 0 25%,#facc15 0 50%,#22c55e 0 75%,#3b82f6 0); transform:rotate(25deg); }
.ce-last { position:absolute; top:-10px; right:-10px; background:#ef4444; color:#fff; font-size:11px; font-weight:800; padding:3px 8px; border-radius:999px; animation:cepulse 1s infinite; }
@keyframes cepulse { 50% { transform:scale(1.12); } }
.ce-center { flex:1; display:flex; align-items:center; justify-content:center; gap:40px; position:relative; min-height:200px; }
.ce-ring { position:absolute; width:340px; height:340px; border-radius:50%; border:3px dashed; opacity:.35; animation: cespin 12s linear infinite; }
.ce-ring.ccw { animation-direction: reverse; }
@keyframes cespin { to { transform: rotate(360deg); } }
.ce-pile { position:relative; width:110px; height:160px; }
.ce-pile .card { position:absolute; inset:0; }
.ce-deck { cursor:pointer; }
.ce-deck .card { transition:transform .15s; } .ce-deck:hover .card:last-child { transform:translateY(-6px); }
.ce-deck.glow .card:last-child { box-shadow:0 0 0 3px #facc15, 0 0 30px #facc15; }
.ce-info { position:absolute; bottom:12px; left:50%; transform:translateX(-50%); display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
.ce-pill { background:rgba(0,0,0,.45); padding:6px 14px; border-radius:999px; font-weight:700; font-size:14px; }
.ce-pill.warn { background:#dc2626; animation:cepulse .8s infinite; }
.card { width:110px; height:160px; border-radius:14px; background:#fff; padding:6px; box-shadow:0 6px 16px rgba(0,0,0,.45); user-select:none; position:relative; }
.card .in { position:absolute; inset:6px; border-radius:10px; background:var(--cc); overflow:hidden; display:grid; place-items:center; }
.card .in::before { content:''; position:absolute; inset:14% 10%; border-radius:50%; background:rgba(255,255,255,.95); transform:rotate(-20deg) scaleY(1.05); clip-path: polygon(50% 0,100% 50%,50% 100%,0 50%); }
.card .big { position:relative; font-family:'Space Grotesk',sans-serif; font-weight:800; font-size:46px; color:var(--cc); text-shadow: 2px 2px 0 rgba(0,0,0,.15); }
.card .cn { position:absolute; font-weight:800; font-size:17px; color:#fff; text-shadow:1px 1px 0 rgba(0,0,0,.4); font-family:'Space Grotesk',sans-serif; }
.card .cn.tl { top:6px; left:8px; } .card .cn.br { bottom:6px; right:8px; transform:rotate(180deg); }
.card.wild .in { background:conic-gradient(#ef4444 0 25%, #3b82f6 0 50%, #22c55e 0 75%, #facc15 0); }
.card.wild .in::before { background:#111827; }
.card.wild .big { color:#fff; }
.card.back .in { background:linear-gradient(135deg,#1e1b4b,#4c1d95); }
.card.back .in::before { background:conic-gradient(#ef4444 0 25%,#facc15 0 50%,#22c55e 0 75%,#3b82f6 0); }
.card.back .big { color:#fff; font-size:22px; }
.ce-hand { display:flex; justify-content:center; padding:10px 16px 18px; min-height:190px; align-items:flex-end; overflow-x:auto; overflow-y:visible; }
.ce-hand .card { flex:none; margin-left:-42px; cursor:pointer; transition:transform .18s, filter .18s, margin .18s; }
.ce-hand .card:first-child { margin-left:0; }
.ce-hand .card.ok { transform:translateY(-14px); box-shadow:0 0 0 3px #fff, 0 10px 26px rgba(0,0,0,.5); }
.ce-hand .card.ok:hover { transform:translateY(-34px) scale(1.06); z-index:5; }
.ce-hand .card.no { filter:brightness(.55) saturate(.6); cursor:not-allowed; }
.ce-hand.myturn::before { content:'À vous de jouer !'; position:absolute; bottom:200px; left:50%; transform:translateX(-50%); font-weight:800; color:#fde68a; text-shadow:0 2px 6px #000; }
.ce-bar { display:flex; gap:10px; justify-content:center; padding:0 16px; flex-wrap:wrap; }
.ce-side { background:rgba(5,10,10,.55); border-left:1px solid rgba(255,255,255,.08); display:flex; flex-direction:column; padding:12px; gap:10px; min-height:0; }
.ce-side h4 { margin:0; font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#9fb; }
.ce-log { max-height:30%; overflow:auto; font-size:13px; color:#cde; display:flex; flex-direction:column; gap:3px; }
.ce-picker { position:absolute; inset:0; background:rgba(0,0,0,.6); display:grid; place-items:center; z-index:20; }
.ce-picker .box { background:#111827; padding:22px; border-radius:20px; text-align:center; }
.ce-picker .cols { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:12px; }
.ce-picker button { width:120px; height:80px; border-radius:14px; border:0; color:#fff; font-weight:800; font-size:18px; cursor:pointer; transition:transform .1s; }
.ce-picker button:hover { transform:scale(1.06); }
.ce-fly { position:absolute; z-index:30; pointer-events:none; transition: all .35s cubic-bezier(.3,.7,.3,1); }
.ce-timer { position:absolute; left:0; bottom:0; height:4px; background:#facc15; }
@keyframes cetime { from { width:var(--w); } to { width:0; } }
@media (max-width:900px) { .ce { grid-template-columns:1fr; } .ce-side { display:none; } .card { width:84px; height:122px; } .card .big { font-size:34px; } .ce-pile { width:84px; height:122px; } .ce-hand .card { margin-left:-34px; } .ce-hand { min-height:150px; } }
`);

const cardHTML = (c, cls = '') => {
  if (!c) return '';
  const wild = c.v === 'wild' || c.v === '+4';
  const col = COL[c.c] || COL.w;
  const sym = SYM[c.v] || c.v;
  return `<div class="card ${wild && c.c === 'w' ? 'wild' : ''} ${cls}" data-id="${c.id}" style="--cc:${wild && c.c !== 'w' ? col : col}">
    <div class="in" style="${wild && c.c !== 'w' ? `background:conic-gradient(${col} 0 75%, #111827 0)` : ''}"><span class="big">${sym}</span><span class="cn tl">${sym}</span><span class="cn br">${sym}</span></div></div>`;
};
const backHTML = () => `<div class="card back"><div class="in"><span class="big">✦</span></div></div>`;

let api, S, root, sh, chat, ui = {}, lastPlayN = 0, lastLog = '', endShown = false, picking = null;

function render() {
  const me = S.players.find(p => p.id === api.myId);
  const myIdx = S.players.indexOf(me);
  const turnP = S.players[S.turn];
  const myTurn = turnP?.id === api.myId && S.phase === 'play';
  // adversaires (dans l'ordre du jeu, à partir de moi)
  const order = S.players.map((_, k) => S.players[(myIdx + 1 + k) % S.players.length]).filter(p => p.id !== api.myId);
  ui.opps.innerHTML = order.map(p => `
    <div class="ce-opp ${p.id === turnP?.id ? 'turn' : ''} ${p.out ? 'out' : ''}">
      ${S.callout?.id === p.id ? '<span class="ce-last">Contrez-le !</span>' : p.count === 1 ? '<span class="ce-last">1 carte !</span>' : ''}
      <div style="display:flex;align-items:center;gap:8px">${avatar(p.name, p.color, 28)}<span class="nm">${esc(p.name)}</span></div>
      <div class="ce-fan">${'<i></i>'.repeat(Math.min(p.count, 12))}</div>
      <small>${p.count} carte${p.count > 1 ? 's' : ''}${S.target ? ` · ${p.score} pts` : ''}</small>
    </div>`).join('');
  // centre
  ui.ring.style.borderColor = COL[S.color] || '#fff';
  ui.ring.classList.toggle('ccw', S.dir < 0);
  ui.discard.innerHTML = cardHTML(S.top);
  ui.deck.classList.toggle('glow', myTurn && !me.out && (S.pending > 0 || !S.hand.some(c => c.ok)));
  ui.info.innerHTML = `
    <span class="ce-pill" style="background:${COL[S.color]};color:${S.color === 'y' ? '#000' : '#fff'}">Couleur : ${CNAME[S.color] || '?'}</span>
    <span class="ce-pill">${S.dir > 0 ? '↻ Sens horaire' : '↺ Sens inverse'}</span>
    ${S.pending ? `<span class="ce-pill warn">À piocher : +${S.pending}</span>` : ''}
    <span class="ce-pill">🂠 ${S.deckCount}</span>
    ${S.target ? `<span class="ce-pill">Manche ${S.roundNo} · objectif ${S.target} pts</span>` : ''}`;
  ui.status.innerHTML = S.phase === 'play' ? (myTurn ? '<b style="color:#fde68a">À vous de jouer !</b>' : `Au tour de <b style="color:${turnP.color}">${esc(turnP.name)}</b>`) : '';
  // ma main
  const hand = S.hand.slice().sort((a, b) => 'rygbw'.indexOf(a.c) - 'rygbw'.indexOf(b.c) || String(a.v).localeCompare(String(b.v)));
  ui.hand.innerHTML = hand.map(c => cardHTML(c, c.ok ? 'ok' : (myTurn ? 'no' : ''))).join('');
  ui.hand.querySelectorAll('.card').forEach(el => { el.onclick = () => clickCard(Number(el.dataset.id)); });
  ui.hand.style.setProperty('--n', hand.length);
  // boutons
  const btns = [];
  if (myTurn && S.drawn != null) btns.push('<button class="gk-btn" data-act="pass">Garder la carte et passer</button>');
  if (myTurn && S.pending) btns.push(`<button class="gk-btn danger" data-act="draw">Piocher ${S.pending} cartes</button>`);
  if (S.hand.length <= 2 && S.hand.length > 0 && !me.declared && S.phase === 'play') btns.push('<button class="gk-btn primary" data-act="declare">📣 Dernière !</button>');
  if (S.callout && S.callout.id !== api.myId) btns.push(`<button class="gk-btn danger" data-act="callout">🚨 Contrer ${esc(S.players.find(p => p.id === S.callout.id)?.name || '')}</button>`);
  ui.bar.innerHTML = btns.join('');
  ui.bar.querySelectorAll('[data-act]').forEach(b => { b.onclick = () => { sfx.play('click'); api.send({ type: b.dataset.act }); }; });
  // minuteur
  ui.timer.style.animation = 'none'; void ui.timer.offsetWidth;
  if (S.timer && S.phase === 'play') { ui.timer.style.setProperty('--w', `${S.timeLeft / (S.timer * 1000) * 100}%`); ui.timer.style.animation = `cetime ${S.timeLeft}ms linear forwards`; } else ui.timer.style.width = '0';
  // journal
  const lg = S.log.join('\n');
  if (lg !== lastLog) { lastLog = lg; ui.log.innerHTML = S.log.map(l => `<div>${esc(l)}</div>`).join(''); ui.log.scrollTop = ui.log.scrollHeight; }
  // scores
  ui.scores.innerHTML = S.players.map(p => `<div style="display:flex;justify-content:space-between;gap:8px"><span>${avatar(p.name, p.color, 20)} ${esc(p.name)}</span><b>${S.target ? p.score + ' pts' : p.count + ' 🂠'}</b></div>`).join('');
  // fin
  if (S.phase === 'roundEnd' && S.lastRound) ui.status.innerHTML = `🏆 ${esc(S.players.find(p => p.id === S.lastRound.winner)?.name)} gagne la manche (+${S.lastRound.pts} pts). Manche suivante…`;
  if (S.phase === 'over' && !endShown) {
    endShown = true;
    const w = S.players.find(p => p.id === S.winner);
    endScreen(sh.main, api, {
      title: `🏆 ${esc(w?.name || '?')} gagne !`, sub: S.target ? `Premier à ${S.target} points` : 'Main vidée en premier',
      rows: S.players.slice().sort((a, b) => S.target ? b.score - a.score : a.count - b.count).map(p => ({ name: p.name, color: p.color, value: S.target ? `${p.score} pts` : `${p.count} carte(s)`, me: p.id === api.myId })),
      valueLabel: S.target ? 'Points' : 'Cartes restantes',
    });
  }
}

function clickCard(id) {
  const c = S.hand.find(x => x.id === id);
  if (!c) return;
  if (!c.ok) { sfx.play('bad'); return; }
  if (c.v === 'wild' || c.v === '+4') { openPicker(id); return; }
  api.send({ type: 'play', card: id });
}
function openPicker(id) {
  picking = id;
  const p = document.createElement('div'); p.className = 'ce-picker';
  p.innerHTML = `<div class="box"><h2 style="margin:0">Choisissez une couleur</h2><div class="cols">${['r', 'y', 'g', 'b'].map(c => `<button data-c="${c}" style="background:${COL[c]};${c === 'y' ? 'color:#000' : ''}">${CNAME[c]}</button>`).join('')}</div>
    <button style="margin-top:12px;width:100%;height:auto;padding:10px;background:#374151" data-x>Annuler</button></div>`;
  p.querySelectorAll('[data-c]').forEach(b => { b.onclick = () => { api.send({ type: 'play', card: picking, color: b.dataset.c }); p.remove(); }; });
  p.querySelector('[data-x]').onclick = () => p.remove();
  ui.table.appendChild(p);
}

export default {
  mount(r, a) {
    api = a; root = r; endShown = false; lastLog = ''; lastPlayN = 0;
    sh = shell(r, api, { title: 'Couleurs Express', icon: '🃏' });
    const el = document.createElement('div'); el.className = 'ce';
    el.innerHTML = `<div class="ce-table">
        <div class="ce-opps"></div>
        <div class="ce-center"><div class="ce-ring"></div>
          <div class="ce-pile ce-deck" title="Piocher">${backHTML()}${backHTML()}${backHTML()}</div>
          <div class="ce-pile ce-discard"></div>
          <div class="ce-info"></div></div>
        <div class="ce-bar"></div>
        <div class="ce-hand"></div>
        <div class="ce-timer"></div>
      </div>
      <aside class="ce-side"><h4>Joueurs</h4><div class="ce-scores"></div><h4>Journal</h4><div class="ce-log"></div><h4>Discussion</h4></aside>`;
    sh.main.appendChild(el);
    const q = s => el.querySelector(s);
    ui = { table: q('.ce-table'), opps: q('.ce-opps'), ring: q('.ce-ring'), deck: q('.ce-deck'), discard: q('.ce-discard'), info: q('.ce-info'), bar: q('.ce-bar'), hand: q('.ce-hand'), timer: q('.ce-timer'), log: q('.ce-log'), scores: q('.ce-scores'), status: sh.bar };
    [...q('.ce-deck').children].forEach((c, i) => { c.style.transform = `translate(${i * 2}px,${-i * 2}px)`; });
    ui.deck.onclick = () => { if (S?.players[S.turn]?.id === api.myId) { sfx.play('card'); api.send({ type: 'draw' }); } };
    chat = chatBox(api); q('.ce-side').appendChild(chat.el);
  },
  update(s) {
    const key = JSON.stringify({ ...s, timeLeft: 0 });
    if (this._k === key) return; this._k = key;
    const prevTurn = S?.players[S.turn]?.id;
    S = s;
    if (s.lastPlay && s.lastPlay.n !== lastPlayN) { lastPlayN = s.lastPlay.n; sfx.play('card'); ui.discard.animate([{ transform: 'scale(1.25) rotate(-8deg)' }, { transform: 'none' }], { duration: 250, easing: 'ease-out' }); }
    if (s.players[s.turn]?.id === api.myId && prevTurn !== api.myId && s.phase === 'play') sfx.play('tick');
    render();
  },
  event(e) {
    if (e.type === 'draw') sfx.play('deal');
    if (e.type === 'declare') sfx.play('good');
    if (e.type === 'callout') sfx.play('bad');
  },
  unmount() { S = null; this._k = null; },
};
