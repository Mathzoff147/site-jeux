// =====================================================================
//  POKER HOLD'EM — affichage (navigateur)
// =====================================================================
import { shell, endScreen, chatBox, sfx, esc, css, avatar } from '../lib/kit.js';

const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RANK = { 11: 'V', 12: 'D', 13: 'R', 14: 'A' };
css('poker-css', `
.pk { position:absolute; inset:0; display:grid; grid-template-columns:1fr 290px; background: radial-gradient(ellipse at 50% 40%, #1f2937, #0b0f17 70%); }
.pk-room { position:relative; min-height:0; display:flex; flex-direction:column; }
.pk-tablewrap { flex:1; position:relative; min-height:0; }
.pk-table { position:absolute; left:50%; top:46%; transform:translate(-50%,-50%); width:min(86%, 900px); aspect-ratio: 2.1; border-radius:999px;
  background: radial-gradient(ellipse at 50% 40%, #1aa36b 0%, #0f7a4f 55%, #0a5a3a 100%);
  box-shadow: 0 0 0 14px #5b3a1e, 0 0 0 18px #2d1b0d, inset 0 0 60px rgba(0,0,0,.55), 0 40px 80px #000c; }
.pk-table::after { content:''; position:absolute; inset:18px; border-radius:999px; border:2px solid rgba(255,255,255,.12); }
.pk-mid { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); display:flex; flex-direction:column; align-items:center; gap:10px; z-index:1; }
.pk-board { display:flex; gap:8px; min-height:92px; }
.pk-pot { background:rgba(0,0,0,.45); padding:6px 16px; border-radius:999px; font-weight:800; font-size:18px; display:flex; gap:8px; align-items:center; }
.pk-street { font-size:12px; text-transform:uppercase; letter-spacing:.1em; color:#bbf7d0; }
.pc { width:64px; height:90px; border-radius:9px; background:linear-gradient(160deg,#fff,#eef0f4); color:#111; box-shadow:0 4px 10px rgba(0,0,0,.45); position:relative; font-family:'Space Grotesk',sans-serif; animation: pkdeal .35s ease-out both; }
.pc.red { color:#dc2626; }
.pc .r { position:absolute; top:4px; left:7px; font-size:22px; font-weight:800; line-height:1; }
.pc .s1 { position:absolute; top:28px; left:8px; font-size:16px; }
.pc .s2 { position:absolute; right:7px; bottom:3px; font-size:36px; line-height:1; }
.pc.back { background: repeating-linear-gradient(45deg,#1e3a8a 0 6px,#1d4ed8 6px 12px); border:3px solid #fff; }
.pc.hl { box-shadow:0 0 0 3px #facc15, 0 0 20px #facc15; transform: translateY(-6px); }
.pc.dim { filter:brightness(.55); }
.pc.sm { width:46px; height:66px; } .pc.sm .r { font-size:17px; } .pc.sm .s1 { top:21px; font-size:12px; } .pc.sm .s2 { font-size:24px; }
@keyframes pkdeal { from { transform: translateY(-30px) rotate(-10deg); opacity:0; } }
.pk-seat { position:absolute; transform:translate(-50%,-50%); display:flex; flex-direction:column; align-items:center; gap:4px; z-index:2; width:150px; }
.pk-seat .cards { display:flex; gap:3px; height:66px; }
.pk-seat .plate { background:rgba(10,12,20,.88); border:2px solid #334155; border-radius:14px; padding:6px 10px; display:flex; align-items:center; gap:8px; width:100%; transition:all .2s; }
.pk-seat.turn .plate { border-color:#facc15; box-shadow:0 0 20px rgba(250,204,21,.5); }
.pk-seat.folded { opacity:.45; } .pk-seat.out { opacity:.25; }
.pk-seat .info { min-width:0; flex:1; } .pk-seat .nm { font-weight:700; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pk-seat .ch { font-weight:800; color:#fde68a; font-size:14px; }
.pk-seat .act { font-size:11px; color:#a5b4fc; height:14px; }
.pk-seat .hand { font-size:12px; font-weight:700; color:#bbf7d0; background:rgba(0,0,0,.6); padding:2px 8px; border-radius:6px; }
.pk-seat .win { position:absolute; top:-26px; background:#facc15; color:#111; font-weight:800; padding:3px 10px; border-radius:999px; font-size:13px; animation: pkpop .5s; }
@keyframes pkpop { from { transform:scale(0); } }
.pk-bet { position:absolute; transform:translate(-50%,-50%); display:flex; align-items:center; gap:4px; font-weight:800; font-size:13px; z-index:1; }
.chip { width:20px; height:20px; border-radius:50%; background:#dc2626; border:3px dashed #fff; box-shadow:0 2px 4px #0008; }
.pk-btn { position:absolute; transform:translate(-50%,-50%); width:26px; height:26px; border-radius:50%; background:#fff; color:#111; font-weight:900; display:grid; place-items:center; font-size:13px; box-shadow:0 2px 6px #0008; z-index:2; }
.pk-controls { padding:12px 16px 16px; display:flex; flex-direction:column; gap:10px; align-items:center; background:linear-gradient(transparent, rgba(0,0,0,.5)); }
.pk-mine { display:flex; align-items:center; gap:14px; }
.pk-acts { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; }
.pk-acts .gk-btn { min-width:110px; padding:12px 16px; font-size:15px; }
.pk-raise { display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:center; }
.pk-raise input[type=range] { width:220px; accent-color:#facc15; padding:0; border:0; background:none; }
.pk-raise .amt { font-weight:800; min-width:70px; text-align:center; color:#fde68a; }
.pk-raise .gk-btn { padding:6px 10px; font-size:12px; }
.pk-side { background:rgba(5,8,14,.7); border-left:1px solid rgba(255,255,255,.08); padding:12px; display:flex; flex-direction:column; gap:10px; min-height:0; }
.pk-side h4 { margin:0; font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#86efac; }
.pk-log { max-height:34%; overflow:auto; font-size:13px; color:#cbd5e1; display:flex; flex-direction:column; gap:3px; }
.pk-timer { width:100%; height:4px; background:rgba(255,255,255,.1); border-radius:2px; overflow:hidden; margin-top:3px; } .pk-timer b { display:block; height:100%; background:#facc15; }
@keyframes pktime { from { width:var(--w); } to { width:0; } }
.pk-ranks { font-size:12px; color:#94a3b8; line-height:1.6; }
@media (max-width:900px) { .pk { grid-template-columns:1fr; } .pk-side { display:none; } .pk-seat { width:110px; } .pc { width:48px; height:68px; } .pc .r{font-size:17px} .pc .s1{top:21px;font-size:12px} .pc .s2{font-size:26px} .pk-seat .cards{height:52px} .pc.sm{width:36px;height:52px} }
`);

const cardHTML = (c, cls = '') => {
  if (!c || c === '?') return `<div class="pc back ${cls}"></div>`;
  const r = parseInt(c), s = c.slice(-1), red = s === 'h' || s === 'd';
  return `<div class="pc ${red ? 'red' : ''} ${cls}"><span class="r">${RANK[r] || r}</span><span class="s1">${SUIT[s]}</span><span class="s2">${SUIT[s]}</span></div>`;
};

let api, S, sh, ui = {}, endShown = false, lastLog = '', raiseVal = 0, lastBoard = 0;

function seatPos(k, n) { // k=0 : moi en bas
  const a = Math.PI / 2 + (k / n) * Math.PI * 2;
  return { x: 50 + Math.cos(a) * 46, y: 47 + Math.sin(a) * 40 };
}

function render() {
  const n = S.players.length, myI = Math.max(0, S.players.findIndex(p => p.id === api.myId));
  const me = S.players[myI];
  const winIds = new Map((S.winners || []).map(w => [w.id, w]));
  const bestSet = new Set((S.winners || []).flatMap(w => w.best || []));
  let seats = '';
  S.players.forEach((p, i) => {
    const k = (i - myI + n) % n, pos = seatPos(k, n);
    const bp = { x: 50 + (pos.x - 50) * 0.62, y: 47 + (pos.y - 47) * 0.55 };
    const w = winIds.get(p.id);
    seats += `<div class="pk-seat ${i === S.turn ? 'turn' : ''} ${p.folded ? 'folded' : ''} ${p.out ? 'out' : ''}" style="left:${pos.x}%;top:${pos.y}%">
      ${w ? `<span class="win">+${w.amount}</span>` : ''}
      <div class="cards">${p.cards.map(c => cardHTML(c, `sm ${bestSet.has(c) ? 'hl' : ''}`)).join('')}</div>
      ${p.hand ? `<span class="hand">${esc(p.hand)}</span>` : ''}
      <div class="plate">${avatar(p.name, p.color, 30)}<div class="info"><div class="nm">${esc(p.name)}${p.id === api.myId ? ' (vous)' : ''}</div>
        <div class="ch">${p.out ? 'Éliminé' : `🪙 ${p.chips}`}${p.allIn ? ' · TAPIS' : ''}</div><div class="act">${esc(p.lastAction || '')}</div>
        ${i === S.turn && S.timer ? `<div class="pk-timer"><b style="--w:${S.timeLeft / (S.timer * 1000) * 100}%;animation:pktime ${S.timeLeft}ms linear forwards"></b></div>` : ''}</div></div>
    </div>`;
    if (p.bet > 0) seats += `<div class="pk-bet" style="left:${bp.x}%;top:${bp.y}%"><span class="chip"></span>${p.bet}</div>`;
    if (i === S.dealer) seats += `<div class="pk-btn" style="left:${50 + (pos.x - 50) * 0.75 + 4}%;top:${47 + (pos.y - 47) * 0.72}%">D</div>`;
  });
  ui.seats.innerHTML = seats;
  ui.board.innerHTML = S.board.map((c, i) => cardHTML(c, `${bestSet.has(c) ? 'hl' : ''}`).replace('class="pc', `style="animation-delay:${i >= lastBoard ? (i - lastBoard) * 0.12 : 0}s;${i < lastBoard ? 'animation:none' : ''}" class="pc`)).join('');
  if (S.board.length !== lastBoard) { if (S.board.length > lastBoard) sfx.play('deal'); lastBoard = S.board.length; }
  ui.pot.innerHTML = `<span class="chip"></span> Pot : ${S.pot}`;
  ui.street.textContent = { preflop: 'Pré-flop', flop: 'Flop', turn: 'Turn', river: 'River' }[S.street] || '';
  sh.bar.innerHTML = `Main n°${S.handNo} · Blindes ${S.sb}/${S.bb}`;
  // commandes
  const myTurn = S.turn >= 0 && S.players[S.turn]?.id === api.myId;
  ui.myhand.textContent = S.myHand ? `Votre main : ${S.myHand}` : '';
  if (!myTurn || !me || me.out) {
    ui.acts.innerHTML = me?.out ? '<span class="gk-muted">Vous êtes éliminé — vous regardez la partie.</span>' : S.phase === 'showdown' ? '<span class="gk-muted">Main suivante dans quelques secondes…</span>' : `<span class="gk-muted">⏳ ${esc(S.players[S.turn]?.name || '')} réfléchit…</span>`;
    ui.raise.innerHTML = '';
  } else {
    const toCall = S.toCall, max = me.chips + me.bet, min = Math.min(max, S.currentBet + S.minRaise);
    if (raiseVal < min || raiseVal > max) raiseVal = min;
    ui.acts.innerHTML = `<button class="gk-btn danger" data-a="fold">Se coucher</button>
      ${toCall > 0 ? `<button class="gk-btn ok" data-a="call">Suivre ${Math.min(toCall, me.chips)}</button>` : '<button class="gk-btn ok" data-a="check">Parole</button>'}
      ${max > S.currentBet ? `<button class="gk-btn primary" data-a="raise">${S.currentBet ? 'Relancer' : 'Miser'} <b class="rv">${raiseVal}</b></button>` : ''}
      <button class="gk-btn" style="background:#7c2d12;color:#fff" data-a="allin">TAPIS (${me.chips})</button>`;
    ui.raise.innerHTML = max > min ? `<button class="gk-btn" data-q="min">Min</button><button class="gk-btn" data-q="half">½ pot</button><button class="gk-btn" data-q="pot">Pot</button>
      <input type="range" min="${min}" max="${max}" step="${S.bb / 2}" value="${raiseVal}"><span class="amt">${raiseVal}</span>` : '';
    const rng = ui.raise.querySelector('input');
    const setV = v => { raiseVal = Math.max(min, Math.min(max, Math.round(v))); if (rng) rng.value = raiseVal; ui.raise.querySelector('.amt').textContent = raiseVal; const rv = ui.acts.querySelector('.rv'); if (rv) rv.textContent = raiseVal; };
    rng?.addEventListener('input', () => setV(+rng.value));
    ui.raise.querySelectorAll('[data-q]').forEach(b => { b.onclick = () => setV(b.dataset.q === 'min' ? min : S.currentBet + (b.dataset.q === 'pot' ? S.pot + toCall : (S.pot + toCall) / 2)); });
    ui.acts.querySelectorAll('[data-a]').forEach(b => { b.onclick = () => { const t = b.dataset.a; if (t === 'allin' && !confirm('Faire tapis ?')) return; api.send({ type: t, amount: raiseVal }); }; });
  }
  const lg = S.log.join('\n');
  if (lg !== lastLog) { lastLog = lg; ui.log.innerHTML = S.log.map(l => `<div>${esc(l)}</div>`).join(''); ui.log.scrollTop = ui.log.scrollHeight; }
  if (S.phase === 'over' && !endShown) {
    endShown = true;
    const w = S.players.find(p => p.id === S.winner);
    endScreen(sh.main, api, { title: `🏆 ${esc(w?.name || '?')} rafle tout !`, sub: `${S.handNo} mains jouées`, valueLabel: 'Jetons',
      rows: S.players.slice().sort((a, b) => b.chips - a.chips).map(p => ({ name: p.name, color: p.color, value: p.chips, me: p.id === api.myId })) });
  }
}

export default {
  mount(r, a) {
    api = a; endShown = false; lastLog = ''; lastBoard = 0;
    sh = shell(r, api, { title: 'Poker Hold’em', icon: '🂡' });
    const el = document.createElement('div'); el.className = 'pk';
    el.innerHTML = `<div class="pk-room"><div class="pk-tablewrap"><div class="pk-table"><div class="pk-mid"><div class="pk-street"></div><div class="pk-board"></div><div class="pk-pot"></div></div></div><div class="pk-seats"></div></div>
      <div class="pk-controls"><div class="pk-myhand" style="font-weight:700;color:#bbf7d0"></div><div class="pk-raise"></div><div class="pk-acts"></div></div></div>
      <aside class="pk-side"><h4>Journal</h4><div class="pk-log"></div>
      <h4>Combinaisons (de la + forte)</h4><div class="pk-ranks">Quinte flush royale · Quinte flush · Carré · Full · Couleur · Quinte · Brelan · Double paire · Paire · Carte haute</div>
      <h4>Discussion</h4></aside>`;
    sh.main.appendChild(el);
    const q = s => el.querySelector(s);
    ui = { seats: q('.pk-seats'), board: q('.pk-board'), pot: q('.pk-pot'), street: q('.pk-street'), acts: q('.pk-acts'), raise: q('.pk-raise'), myhand: q('.pk-myhand'), log: q('.pk-log') };
    q('.pk-side').appendChild(chatBox(api).el);
  },
  update(s) {
    const prevTurn = S && S.turn, prevHand = S?.handNo;
    const key = JSON.stringify({ ...s, timeLeft: 0 });
    if (this._k === key) return; this._k = key;
    S = s;
    if (s.handNo !== prevHand) { lastBoard = 0; sfx.play('deal'); }
    if (s.turn !== prevTurn && s.players[s.turn]?.id === api.myId) sfx.play('tick');
    if (s.winners && s.phase === 'showdown' && prevTurn !== -1 && s.turn === -1) sfx.play('chips');
    render();
  },
  event(e) { if (e.type === 'act') sfx.play(e.kind === 'fold' ? 'card' : e.kind === 'check' ? 'click' : 'chips'); },
  unmount() { S = null; this._k = null; },
};
