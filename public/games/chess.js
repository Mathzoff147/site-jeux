// =====================================================================
//  ÉCHECS — affichage (navigateur)
// =====================================================================
import { shell, endScreen, chatBox, sfx, esc, css, avatar } from '../lib/kit.js';

const GLYPH = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
const VAL = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
css('chess-css', `
.ch { position:absolute; inset:0; display:grid; grid-template-columns: 1fr 320px; background: radial-gradient(circle at 30% 20%, #3b2a17, #120d08 70%); }
.ch-left { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:14px; min-height:0; }
.ch-player { width: var(--bs); display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:12px; background:rgba(0,0,0,.35); }
.ch-player.turn { box-shadow: inset 0 0 0 2px #facc15; }
.ch-player .nm { font-weight:700; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ch-player .cap { font-size:18px; letter-spacing:-3px; color:#e7e5e4; opacity:.85; }
.ch-clock { font-family:'Space Grotesk',monospace; font-size:22px; font-weight:700; padding:4px 12px; border-radius:8px; background:#1c1917; min-width:92px; text-align:center; }
.ch-clock.run { background:#f5f5f4; color:#111; } .ch-clock.low { background:#dc2626; color:#fff; }
.ch-board { --bs: min(calc(100vh - 210px), calc(100vw - 380px), 720px); width:var(--bs); height:var(--bs); display:grid; grid-template:repeat(8,1fr)/repeat(8,1fr);
  border-radius:8px; overflow:hidden; box-shadow:0 0 0 10px #3f2a14, 0 0 0 12px #1c1208, 0 30px 70px #000c; user-select:none; touch-action:none; }
.ch-left { --bs: min(calc(100vh - 210px), calc(100vw - 380px), 720px); }
.ch-sq { position:relative; display:grid; place-items:center; }
.ch-sq.l { background:#ecd9b6; } .ch-sq.d { background:#a9794e; }
.ch-sq.last.l { background:#f3e28a; } .ch-sq.last.d { background:#c9a53f; }
.ch-sq.sel { box-shadow: inset 0 0 0 4px #22d3ee; }
.ch-sq.check { background: radial-gradient(circle, #ff3b30 0%, #ff3b3088 45%, transparent 75%) !important; }
.ch-sq .dot { position:absolute; width:30%; height:30%; border-radius:50%; background:rgba(20,20,20,.28); pointer-events:none; }
.ch-sq .ring { position:absolute; inset:4%; border-radius:50%; border:5px solid rgba(20,20,20,.28); pointer-events:none; }
.ch-sq .crd { position:absolute; font-size:11px; font-weight:700; opacity:.7; pointer-events:none; }
.ch-sq .crd.f { right:3px; bottom:1px; } .ch-sq .crd.r { left:3px; top:1px; }
.ch-sq.l .crd { color:#a9794e; } .ch-sq.d .crd { color:#ecd9b6; }
.ch-pc { font-size: calc(var(--bs) / 8 * .78); line-height:1; cursor:grab; transition: transform .12s; z-index:1; }
.ch-pc.w { color:#fffaf0; text-shadow: 0 0 1px #000, 0 0 1px #000, 0 0 2px #000, 0 3px 4px rgba(0,0,0,.5); -webkit-text-stroke: 1px #3b2a17; }
.ch-pc.b { color:#1c1917; text-shadow: 0 0 1px #fff8, 0 3px 4px rgba(0,0,0,.5); }
.ch-pc.drag { position:fixed; pointer-events:none; z-index:100; transform:translate(-50%,-55%) scale(1.15); }
.ch-side { background:rgba(10,8,5,.6); border-left:1px solid rgba(255,255,255,.08); padding:14px; display:flex; flex-direction:column; gap:12px; min-height:0; }
.ch-side h4 { margin:0; font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#d6b98c; }
.ch-moves { display:grid; grid-template-columns: 36px 1fr 1fr; gap:2px 6px; font-family:'Space Grotesk',monospace; font-size:14px; max-height:34vh; overflow:auto; align-content:start; }
.ch-moves .n { color:#a8a29e; } .ch-moves .m { padding:2px 6px; border-radius:4px; } .ch-moves .m.cur { background:#facc1533; }
.ch-acts { display:flex; gap:8px; flex-wrap:wrap; } .ch-acts .gk-btn { flex:1; }
.ch-status { text-align:center; font-weight:700; }
.ch-promo { position:absolute; inset:0; background:rgba(0,0,0,.6); display:grid; place-items:center; z-index:20; }
.ch-promo .box { background:#1c1917; padding:18px; border-radius:16px; display:flex; gap:10px; }
.ch-promo button { width:80px; height:80px; font-size:56px; border-radius:12px; border:0; background:#ecd9b6; cursor:pointer; }
.ch-bar-eval { width: var(--bs); height:6px; border-radius:3px; background:#1c1917; overflow:hidden; }
.ch-bar-eval b { display:block; height:100%; background:#f5f5f4; transition:width .4s; }
@media (max-width:900px) { .ch { grid-template-columns:1fr; overflow:auto; } .ch-left, .ch-board { --bs: min(calc(100vw - 40px), calc(100vh - 250px)); } .ch-side { border:0; } }
`);

let api, S, sh, ui = {}, sel = null, flip = false, endShown = false, drag = null, lastMovesLen = 0;
const fmt = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const colorOf = p => p === '.' ? null : (p === p.toUpperCase() ? 'w' : 'b');

function render() {
  flip = S.me === 'b';
  const b = S.board;
  const targets = sel != null ? S.legal.filter(m => m[0] === sel).map(m => m[1]) : [];
  let html = '';
  for (let k = 0; k < 64; k++) {
    const i = flip ? 63 - k : k, r = Math.floor(i / 8), c = i % 8, p = b[i];
    const light = (r + c) % 2 === 0;
    const cls = ['ch-sq', light ? 'l' : 'd', S.last && (S.last.from === i || S.last.to === i) ? 'last' : '', sel === i ? 'sel' : '', S.check === i ? 'check' : ''].join(' ');
    const showR = flip ? c === 7 : c === 0, showF = flip ? r === 0 : r === 7;
    html += `<div class="${cls}" data-i="${i}">
      ${showR ? `<span class="crd r">${8 - r}</span>` : ''}${showF ? `<span class="crd f">${'abcdefgh'[c]}</span>` : ''}
      ${p !== '.' ? `<span class="ch-pc ${colorOf(p)}" data-i="${i}">${GLYPH[p.toUpperCase()]}</span>` : ''}
      ${targets.includes(i) ? (p !== '.' ? '<i class="ring"></i>' : '<i class="dot"></i>') : ''}</div>`;
  }
  ui.board.innerHTML = html;
  // joueurs (moi en bas)
  const bottom = flip ? 'b' : 'w', top = bottom === 'w' ? 'b' : 'w';
  renderPlayer(ui.top, top); renderPlayer(ui.bottom, bottom);
  // matériel
  const mat = b.split('').reduce((a, p) => a + (p === '.' ? 0 : (colorOf(p) === 'w' ? 1 : -1) * VAL[p.toUpperCase()]), 0);
  ui.eval.style.width = `${50 + Math.max(-40, Math.min(40, mat * 4)) * (flip ? -1 : 1)}%`;
  // coups
  if (S.moves.length !== lastMovesLen) {
    lastMovesLen = S.moves.length;
    let mh = '';
    for (let n = 0; n < S.moves.length; n += 2) mh += `<span class="n">${n / 2 + 1}.</span><span class="m ${n === S.moves.length - 1 ? 'cur' : ''}">${esc(S.moves[n])}</span><span class="m ${n + 1 === S.moves.length - 1 ? 'cur' : ''}">${esc(S.moves[n + 1] || '')}</span>`;
    ui.moves.innerHTML = mh || '<span class="gk-muted" style="grid-column:1/-1">Aucun coup joué</span>';
    ui.moves.scrollTop = ui.moves.scrollHeight;
  }
  // statut & actions
  const turnName = S.turn === 'w' ? S.white.name : S.black.name;
  ui.status.innerHTML = S.phase === 'over' ? `${esc(S.reason)} · ${S.result}` : S.me === S.turn ? '<span style="color:#fde68a">À vous de jouer</span>' : `Trait aux ${S.turn === 'w' ? 'Blancs' : 'Noirs'} (${esc(turnName)})`;
  sh.bar.innerHTML = S.me ? `Vous jouez les <b>${S.me === 'w' ? 'Blancs' : 'Noirs'}</b>` : `👁 Spectateur · ${esc(S.white.name)} contre ${esc(S.black.name)}`;
  let acts = '';
  if (S.me && S.phase === 'play') {
    if (S.drawOffer && S.drawOffer !== S.me) acts += `<button class="gk-btn ok" data-a="acceptDraw">✔ Accepter la nulle</button><button class="gk-btn" data-a="declineDraw">Refuser</button>`;
    else acts += `<button class="gk-btn" data-a="offerDraw" ${S.drawOffer === S.me ? 'disabled' : ''}>${S.drawOffer === S.me ? 'Nulle proposée…' : '½ Proposer nulle'}</button>`;
    acts += `<button class="gk-btn danger" data-a="resign">🏳 Abandonner</button>`;
  }
  ui.acts.innerHTML = acts;
  ui.acts.querySelectorAll('[data-a]').forEach(bt => { bt.onclick = () => { if (bt.dataset.a === 'resign' && !confirm('Abandonner la partie ?')) return; api.send({ type: bt.dataset.a }); }; });
  ui.spec.textContent = S.spectators.length ? `👁 Spectateurs : ${S.spectators.join(', ')}` : '';
  if (S.phase === 'over' && !endShown) {
    endShown = true;
    const winner = S.result === '1-0' ? S.white : S.result === '0-1' ? S.black : null;
    setTimeout(() => endScreen(sh.main, api, { title: winner ? `🏆 ${esc(winner.name)} gagne !` : '🤝 Partie nulle', sub: `${esc(S.reason)} · ${S.result} · ${Math.ceil(S.moves.length / 2)} coups` }), 900);
  }
}
function renderPlayer(el, side) {
  const p = side === 'w' ? S.white : S.black;
  const caps = S.captured[side].map(c => GLYPH[c.toUpperCase()]).join('');
  const t = S.clock ? S.clock[side] : null;
  el.className = `ch-player ${S.turn === side && S.phase === 'play' ? 'turn' : ''}`;
  el.innerHTML = `${avatar(p.name, p.color, 30)}<span class="nm">${esc(p.name)} <small class="gk-muted">${side === 'w' ? '♔ Blancs' : '♚ Noirs'}</small></span><span class="cap">${caps}</span>
    ${t != null ? `<span class="ch-clock ${S.turn === side && S.phase === 'play' ? 'run' : ''} ${t < 20000 ? 'low' : ''}" data-side="${side}">${fmt(t)}</span>` : ''}`;
}

function tryMove(from, to) {
  const ms = S.legal.filter(m => m[0] === from && m[1] === to);
  if (!ms.length) return false;
  if (ms.some(m => m[2])) { promo(from, to); return true; }
  api.send({ type: 'move', from, to });
  return true;
}
function promo(from, to) {
  const isWhite = S.me === 'w';
  const el = document.createElement('div'); el.className = 'ch-promo';
  el.innerHTML = `<div class="box">${'QRBN'.split('').map(p => `<button data-p="${p}" style="color:${isWhite ? '#fff' : '#111'};text-shadow:0 0 2px #000">${GLYPH[p]}</button>`).join('')}</div>`;
  el.querySelectorAll('button').forEach(b => { b.onclick = () => { api.send({ type: 'move', from, to, promo: b.dataset.p }); el.remove(); }; });
  el.onclick = e => { if (e.target === el) el.remove(); };
  ui.left.appendChild(el);
}
function squareAt(x, y) { const el = document.elementFromPoint(x, y)?.closest('.ch-sq'); return el ? +el.dataset.i : null; }

function bindBoard() {
  ui.board.addEventListener('pointerdown', e => {
    const sqEl = e.target.closest('.ch-sq'); if (!sqEl || !S) return;
    const i = +sqEl.dataset.i, p = S.board[i];
    if (sel != null && sel !== i && tryMove(sel, i)) { sel = null; render(); return; }
    if (p !== '.' && colorOf(p) === S.me && S.turn === S.me && S.phase === 'play') {
      sel = i; render(); sfx.play('click');
      const pc = ui.board.querySelector(`.ch-pc[data-i="${i}"]`);
      if (pc) { const g = pc.cloneNode(true); g.classList.add('drag'); g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px'; document.body.appendChild(g); pc.style.opacity = .3; drag = { g, from: i }; }
    } else { sel = null; render(); }
  });
  window.addEventListener('pointermove', ui.pm = e => { if (drag) { drag.g.style.left = e.clientX + 'px'; drag.g.style.top = e.clientY + 'px'; } });
  window.addEventListener('pointerup', ui.pu = e => {
    if (!drag) return;
    const to = squareAt(e.clientX, e.clientY); const from = drag.from;
    drag.g.remove(); drag = null;
    if (to != null && to !== from && tryMove(from, to)) sel = null;
    render();
  });
}

export default {
  mount(r, a) {
    api = a; endShown = false; sel = null; lastMovesLen = -1;
    sh = shell(r, api, { title: 'Échecs', icon: '♞' });
    const el = document.createElement('div'); el.className = 'ch';
    el.innerHTML = `<div class="ch-left"><div class="ch-player top"></div><div class="ch-board"></div><div class="ch-bar-eval"><b style="width:50%"></b></div><div class="ch-player bottom"></div></div>
      <aside class="ch-side"><div class="ch-status"></div><div class="ch-acts"></div><h4>Coups</h4><div class="ch-moves"></div><small class="gk-muted ch-spec"></small><h4>Discussion</h4></aside>`;
    sh.main.appendChild(el);
    const q = s => el.querySelector(s);
    ui = { left: q('.ch-left'), board: q('.ch-board'), top: q('.ch-player.top'), bottom: q('.ch-player.bottom'), moves: q('.ch-moves'), status: q('.ch-status'), acts: q('.ch-acts'), eval: q('.ch-bar-eval b'), spec: q('.ch-spec') };
    q('.ch-side').appendChild(chatBox(api).el);
    bindBoard();
    ui.clockTimer = setInterval(() => { // pendule fluide entre deux mises à jour
      if (!S?.clock || S.phase !== 'play') return;
      const c = ui.board.parentElement.querySelector(`.ch-clock[data-side="${S.turn}"]`);
      if (c) { S.clock[S.turn] = Math.max(0, S.clock[S.turn] - 200); c.textContent = fmt(S.clock[S.turn]); }
    }, 200);
  },
  update(s) {
    const changed = !S || S.board !== s.board || S.phase !== s.phase || S.drawOffer !== s.drawOffer || S.spectators.length !== s.spectators.length;
    S = s;
    if (changed && !drag) render();
  },
  event(e) { if (e.type === 'moved') sfx.play(e.check ? 'bad' : e.cap ? 'break' : 'place'); },
  unmount() { clearInterval(ui.clockTimer); window.removeEventListener('pointermove', ui.pm); window.removeEventListener('pointerup', ui.pu); drag?.g.remove(); S = null; },
};
