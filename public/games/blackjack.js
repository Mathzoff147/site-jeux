// =====================================================================
//  BLACKJACK — affichage (navigateur)
//  Table de casino, jetons, animations de cartes, conseil de stratégie.
// =====================================================================
import { shell, endScreen, chatBox, sfx, esc, css, avatar } from '../lib/kit.js';

const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RANK = { 1: 'A', 11: 'V', 12: 'D', 13: 'R' };
const CHIPS = [[5, '#e5e7eb', '#111'], [10, '#2563eb', '#fff'], [25, '#16a34a', '#fff'], [100, '#111827', '#fff'], [500, '#7e22ce', '#fff'], [1000, '#ca8a04', '#111']];
css('bj-css', `
.bj { position:absolute; inset:0; display:grid; grid-template-columns:1fr 300px; background:radial-gradient(ellipse at 50% 0%, #3b0d0d, #120606 70%); }
.bj-room { position:relative; display:flex; flex-direction:column; min-height:0; overflow:hidden; }
.bj-table { position:relative; flex:1; margin:14px 14px 0; border-radius:0 0 50% 50% / 0 0 42% 42%; min-height:0;
  background:radial-gradient(ellipse at 50% 10%, #1b8a5a 0%, #0f6b44 45%, #0a4d31 100%); box-shadow: 0 0 0 14px #5b2d12, 0 0 0 18px #2d1608, inset 0 0 80px rgba(0,0,0,.55), 0 30px 80px #000a; }
.bj-arc { position:absolute; left:50%; top:46%; transform:translate(-50%,-50%); text-align:center; color:rgba(255,236,170,.55); font-family:'Space Grotesk',serif; letter-spacing:.2em; pointer-events:none; }
.bj-arc b { display:block; font-size:clamp(16px,2.4vw,26px); } .bj-arc small { font-size:12px; letter-spacing:.15em; }
.bj-dealer { position:absolute; left:50%; top:16px; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; gap:6px; }
.bj-dealer .lbl { font-weight:800; color:#fde68a; font-size:13px; letter-spacing:.1em; text-transform:uppercase; }
.bj-cards { display:flex; min-height:96px; }
.bj-cards .pc { margin-left:-36px; } .bj-cards .pc:first-child { margin-left:0; }
.pc { width:66px; height:94px; border-radius:9px; background:linear-gradient(160deg,#fff,#eef0f4); color:#111; box-shadow:0 4px 10px rgba(0,0,0,.5); position:relative; font-family:'Space Grotesk',sans-serif; flex:none; animation: bjdeal .35s ease-out both; }
.pc.red { color:#dc2626; } .pc .r { position:absolute; top:4px; left:7px; font-size:21px; font-weight:800; line-height:1; } .pc .s1 { position:absolute; top:27px; left:8px; font-size:15px; }
.pc .s2 { position:absolute; right:7px; bottom:3px; font-size:38px; line-height:1; }
.pc.back { background: repeating-linear-gradient(45deg,#7f1d1d 0 6px,#991b1b 6px 12px); border:3px solid #fff; }
@keyframes bjdeal { from { transform: translate(40px,-80px) rotate(-25deg); opacity:0; } }
.bj-tot { background:rgba(0,0,0,.6); padding:3px 12px; border-radius:999px; font-weight:800; font-size:15px; }
.bj-tot.bust { background:#dc2626; } .bj-tot.bj { background:linear-gradient(90deg,#ca8a04,#facc15); color:#111; } .bj-tot.win { background:#16a34a; }
.bj-shoe { position:absolute; right:26px; top:20px; text-align:center; font-size:11px; color:#d1fae5; }
.bj-shoe i { display:block; width:58px; height:74px; border-radius:8px; background:linear-gradient(135deg,#78350f,#451a03); border:2px solid #a16207; margin-bottom:4px; box-shadow: 4px 4px 0 #1c0d03; }
.bj-seats { position:absolute; left:0; right:0; bottom:22px; display:flex; justify-content:center; gap:14px; padding:0 20px; align-items:flex-end; }
.bj-seat { display:flex; flex-direction:column; align-items:center; gap:6px; min-width:120px; max-width:220px; position:relative; transition: transform .2s; }
.bj-seat.me .plate { border-color:#fde68a; } .bj-seat.turn { transform: translateY(-8px); } .bj-seat.turn .plate { box-shadow:0 0 22px #facc15; border-color:#facc15; }
.bj-seat.out { opacity:.4; }
.bj-hands { display:flex; gap:10px; align-items:flex-end; }
.bj-hand { display:flex; flex-direction:column; align-items:center; gap:4px; padding:4px; border-radius:10px; }
.bj-hand.active { background:rgba(250,204,21,.18); outline:2px dashed #facc15; }
.bj-hand .bj-cards .pc { width:52px; height:74px; margin-left:-30px; } .bj-hand .bj-cards .pc:first-child { margin-left:0; } .bj-hand .bj-cards { min-height:76px; }
.bj-hand .pc .r { font-size:17px; } .bj-hand .pc .s1 { top:22px; font-size:12px; } .bj-hand .pc .s2 { font-size:28px; }
.bj-res { font-size:12px; font-weight:800; padding:2px 8px; border-radius:6px; background:#000a; } .bj-res.g { color:#4ade80; } .bj-res.p { color:#f87171; }
.bj-chipstack { display:flex; align-items:center; gap:5px; font-weight:800; font-size:14px; color:#fde68a; }
.chip { width:22px; height:22px; border-radius:50%; border:3px dashed rgba(255,255,255,.85); box-shadow:0 2px 4px #0009; flex:none; }
.bj-seat .plate { display:flex; align-items:center; gap:8px; background:rgba(0,0,0,.6); border:2px solid #44403c; border-radius:12px; padding:5px 10px; }
.bj-seat .plate .nm { font-weight:700; font-size:13px; max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .bj-seat .plate small { display:block; color:#fde68a; font-weight:800; }
.bj-ready { position:absolute; top:-8px; right:-8px; background:#16a34a; border-radius:999px; font-size:11px; padding:2px 7px; font-weight:800; }
.bj-net { position:absolute; top:-26px; font-weight:800; font-size:16px; animation: bjup 1.2s ease-out both; text-shadow:0 2px 4px #000; }
@keyframes bjup { from { transform: translateY(14px); opacity:0; } 30% { opacity:1; } }
.bj-ctrl { padding:12px 16px 16px; display:flex; flex-direction:column; align-items:center; gap:10px; }
.bj-chips { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; }
.bj-chipbtn { width:58px; height:58px; border-radius:50%; border:4px dashed rgba(255,255,255,.8); font-weight:800; font-size:14px; cursor:pointer; box-shadow:0 4px 0 rgba(0,0,0,.4), 0 6px 14px #0008; transition: transform .1s; font-family:'Space Grotesk'; }
.bj-chipbtn:hover { transform: translateY(-4px); } .bj-chipbtn:active { transform: translateY(1px); } .bj-chipbtn:disabled { opacity:.3; transform:none; cursor:not-allowed; }
.bj-acts { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; } .bj-acts .gk-btn { min-width:110px; padding:12px 14px; font-size:15px; }
.bj-acts .gk-btn kbd { margin-left:6px; opacity:.7; }
.bj-info { color:#e7e5e4; font-size:14px; text-align:center; min-height:20px; } .bj-info b { color:#fde68a; }
.bj-timer { width:min(420px,80%); height:5px; border-radius:3px; background:rgba(255,255,255,.12); overflow:hidden; } .bj-timer b { display:block; height:100%; background:#facc15; }
@keyframes bjtime { from { width:var(--w); } to { width:0; } }
.bj-tip { font-size:13px; background:rgba(250,204,21,.14); border:1px solid rgba(250,204,21,.4); color:#fde68a; padding:5px 12px; border-radius:999px; }
.bj-side { background:rgba(10,4,4,.7); border-left:1px solid rgba(255,255,255,.08); padding:12px; display:flex; flex-direction:column; gap:10px; min-height:0; }
.bj-side h4 { margin:0; font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#fca5a5; }
.bj-log { max-height:36%; overflow:auto; font-size:13px; color:#e7e5e4; display:flex; flex-direction:column; gap:3px; }
.bj-rank > div { display:flex; justify-content:space-between; gap:6px; padding:3px 0; font-size:14px; align-items:center; }
@media (max-width:900px) { .bj { grid-template-columns:1fr; } .bj-side { display:none; } .bj-seat { min-width:90px; } .pc { width:50px; height:72px; } .bj-hand .bj-cards .pc { width:42px; height:60px; margin-left:-24px; } .bj-chipbtn { width:48px; height:48px; } }
`);

const cardHTML = (c, delay = 0) => {
  if (c === '?') return `<div class="pc back" style="animation-delay:${delay}s"></div>`;
  const r = parseInt(c), s = c.slice(-1), red = s === 'h' || s === 'd';
  return `<div class="pc ${red ? 'red' : ''}" style="animation-delay:${delay}s"><span class="r">${RANK[r] || r}</span><span class="s1">${SUIT[s]}</span><span class="s2">${SUIT[s]}</span></div>`;
};
const chipsFor = n => { const out = []; for (const [v, bg] of CHIPS.slice().reverse()) while (n >= v && out.length < 5) { out.push(bg); n -= v; } return out.map((bg, i) => `<span class="chip" style="background:${bg};margin-left:${i ? -14 : 0}px"></span>`).join(''); };

// Conseil : stratégie de base (plusieurs paquets, croupier reste sur 17)
function advice(h, up, canDouble, canSplit, canSurrender) {
  const v = c => { const r = parseInt(c); return r === 1 ? 11 : Math.min(10, r); };
  const d = v(up), cards = h.cards, t = h.total;
  if (canSplit && cards.length === 2 && v(cards[0]) === v(cards[1])) {
    const p = v(cards[0]);
    if (p === 11 || p === 8) return 'Séparer';
    if (p === 9 && ![7, 10, 11].includes(d)) return 'Séparer';
    if ((p === 7 || p === 2 || p === 3) && d <= 7) return 'Séparer';
    if (p === 6 && d <= 6) return 'Séparer';
    if (p === 4 && (d === 5 || d === 6)) return 'Séparer';
  }
  if (canSurrender && cards.length === 2 && !h.soft && ((t === 16 && d >= 9) || (t === 15 && d === 10))) return 'Abandonner';
  if (h.soft && cards.length >= 2) {
    if (t >= 19) return 'Rester';
    if (t === 18) return d >= 3 && d <= 6 && canDouble ? 'Doubler' : d >= 9 ? 'Tirer' : 'Rester';
    if (t === 17) return d >= 3 && d <= 6 && canDouble ? 'Doubler' : 'Tirer';
    if (t >= 15) return d >= 4 && d <= 6 && canDouble ? 'Doubler' : 'Tirer';
    return d >= 5 && d <= 6 && canDouble ? 'Doubler' : 'Tirer';
  }
  if (t >= 17) return 'Rester';
  if (t >= 13) return d <= 6 ? 'Rester' : 'Tirer';
  if (t === 12) return d >= 4 && d <= 6 ? 'Rester' : 'Tirer';
  if (t === 11) return canDouble ? 'Doubler' : 'Tirer';
  if (t === 10) return d <= 9 && canDouble ? 'Doubler' : 'Tirer';
  if (t === 9) return d >= 3 && d <= 6 && canDouble ? 'Doubler' : 'Tirer';
  return 'Tirer';
}

let api, S, sh, ui = {}, endShown = false, lastLog = '', tips = localStorage.getItem('bj-tips') !== '0', lastPhase = '', lastKey = '';

function render() {
  const me = S.players.find(p => p.id === api.myId);
  sh.bar.innerHTML = `Manche ${S.round}${S.maxRounds ? ` / ${S.maxRounds}` : ''} · mise min. ${S.minBet}`;
  // croupier
  const dc = S.dealer.cards, dHidden = dc.includes('?');
  const dTot = dc.length ? (dHidden ? `${S.dealer.total} + ?` : S.dealer.total) : '';
  ui.dealer.innerHTML = `<div class="lbl">Croupier</div><div class="bj-cards">${dc.map((c, i) => cardHTML(c, i * 0.15)).join('')}</div>${dc.length ? `<span class="bj-tot ${!dHidden && S.dealer.total > 21 ? 'bust' : !dHidden && dc.length === 2 && S.dealer.total === 21 ? 'bj' : ''}">${dTot}</span>` : ''}`;
  ui.shoe.innerHTML = `<i></i>${S.shoeLeft} cartes`;
  ui.arc.innerHTML = `<b>BLACKJACK PAIE ${S.bjPay === 1.5 ? '3 POUR 2' : '6 POUR 5'}</b><small>LE CROUPIER RESTE SUR 17 · ASSURANCE PAIE 2 POUR 1</small>`;
  // sièges (moi au milieu)
  const list = S.players.slice(); const mi = list.findIndex(p => p.id === api.myId);
  if (mi >= 0) { const [m] = list.splice(mi, 1); list.splice(Math.floor(list.length / 2), 0, m); }
  ui.seats.innerHTML = list.map(p => {
    const turnMe = S.turn === p.id;
    const hands = p.hands.length ? p.hands.map((h, hi) => `<div class="bj-hand ${turnMe && S.hand === hi ? 'active' : ''}">
        <div class="bj-cards">${h.cards.map((c, i) => cardHTML(c, i < 2 ? i * 0.2 : 0)).join('')}</div>
        <span class="bj-tot ${h.bust ? 'bust' : h.bj ? 'bj' : h.result === 'Gagné' ? 'win' : ''}">${h.bj ? 'BJ' : h.total}${h.soft && !h.bj && h.total < 21 ? ' souple' : ''}</span>
        <span class="bj-chipstack">${chipsFor(h.bet)} ${h.bet}${h.doubled ? ' ×2' : ''}</span>
        ${h.result ? `<span class="bj-res ${h.win > 0 ? 'g' : h.win < 0 ? 'p' : ''}">${esc(h.result)}${h.win ? ` ${h.win > 0 ? '+' : ''}${h.win}` : ''}</span>` : ''}</div>`).join('')
      : p.bet ? `<span class="bj-chipstack">${chipsFor(p.bet)} ${p.bet}</span>` : '';
    return `<div class="bj-seat ${p.id === api.myId ? 'me' : ''} ${turnMe ? 'turn' : ''} ${p.out ? 'out' : ''}">
      ${S.phase === 'payout' && p.net ? `<span class="bj-net" style="color:${p.net > 0 ? '#4ade80' : '#f87171'}">${p.net > 0 ? '+' : ''}${p.net}</span>` : ''}
      <div class="bj-hands">${hands}</div>
      ${p.insurance ? '<span class="bj-res">🛡️ Assuré</span>' : ''}
      <div class="plate">${S.phase === 'bet' && p.ready ? '<span class="bj-ready">✔ Prêt</span>' : ''}${avatar(p.name, p.color, 28)}<div><div class="nm">${esc(p.name)}</div><small>🪙 ${p.chips}</small></div></div></div>`;
  }).join('');
  renderControls(me);
  // classement
  ui.rank.innerHTML = S.players.slice().sort((a, b) => b.chips + (b.bet || 0) - a.chips - (a.bet || 0)).map((p, i) => `<div><span>${['🥇', '🥈', '🥉'][i] || i + 1 + '.'} ${esc(p.name)}</span><b style="color:#fde68a">🪙 ${p.chips}</b></div>`).join('');
  const lg = S.log.join('\n'); if (lg !== lastLog) { lastLog = lg; ui.log.innerHTML = S.log.map(l => `<div>${esc(l)}</div>`).join(''); ui.log.scrollTop = 1e6; }
  if (S.over && !endShown) {
    endShown = true;
    const rows = S.players.slice().sort((a, b) => b.chips - a.chips).map(p => ({ name: p.name, color: p.color, value: `🪙 ${p.chips}`, me: p.id === api.myId }));
    setTimeout(() => endScreen(sh.main, api, { title: `🏆 ${esc(rows[0]?.name)} fait sauter la banque !`, sub: `${S.round - 1} manches jouées`, rows, valueLabel: 'Jetons' }), 800);
  }
}

function renderControls(me) {
  const timerBar = S.left && ['bet', 'play', 'insurance'].includes(S.phase) ? `<div class="bj-timer"><b style="--w:${Math.min(100, S.left / (S.phase === 'insurance' ? 10000 : S.timer * 1000) * 100)}%;animation:bjtime ${S.left}ms linear forwards"></b></div>` : '';
  let info = '', body = '';
  if (!me || me.out) { info = me?.out ? 'Vous n’avez plus de jetons — vous regardez la table.' : ''; }
  else if (S.phase === 'bet') {
    info = me.ready ? `Mise de <b>${me.bet}</b> validée — en attente des autres joueurs…` : `Placez votre mise (minimum <b>${S.minBet}</b>) — mise actuelle : <b>${me.bet}</b>`;
    if (!me.ready) body = `<div class="bj-chips">${CHIPS.map(([v, bg, fg]) => `<button class="bj-chipbtn" data-chip="${v}" style="background:${bg};color:${fg}" ${me.bet + v > me.chips ? 'disabled' : ''}>${v >= 1000 ? '1K' : v}</button>`).join('')}</div>
      <div class="bj-acts"><button class="gk-btn ghost" data-a="clear">Effacer</button><button class="gk-btn ghost" data-a="repeat">↺ Même mise (${Math.min(me.lastBet, me.chips)})</button><button class="gk-btn ghost" data-a="allin">Tapis</button>
      <button class="gk-btn primary" data-a="ready" ${me.bet < S.minBet ? 'disabled' : ''}>🂠 Distribuer <kbd>Entrée</kbd></button></div>`;
  } else if (S.phase === 'insurance') {
    const h = me.hands[0];
    info = 'Le croupier montre un <b>As</b>. Prendre une assurance (la moitié de votre mise) ?';
    if (h && !me.insurance) body = `<div class="bj-acts"><button class="gk-btn primary" data-a="insure" ${me.chips < Math.floor(h.bet / 2) ? 'disabled' : ''}>🛡️ Assurance (${Math.floor(h.bet / 2)})</button></div>`;
  } else if (S.phase === 'play' && S.turn === api.myId) {
    const h = me.hands[S.hand];
    const canDouble = h.cards.length === 2 && me.chips >= h.bet;
    const canSplit = h.cards.length === 2 && val(h.cards[0]) === val(h.cards[1]) && me.hands.length < 4 && me.chips >= h.bet;
    const canSurr = S.surrender && h.cards.length === 2 && me.hands.length === 1;
    info = `À vous ! Main ${me.hands.length > 1 ? `${S.hand + 1}/${me.hands.length} ` : ''}: <b>${h.total}${h.soft ? ' (souple)' : ''}</b>`;
    body = `<div class="bj-acts"><button class="gk-btn ok" data-a="hit">Tirer <kbd>T</kbd></button><button class="gk-btn danger" data-a="stand">Rester <kbd>R</kbd></button>
      <button class="gk-btn primary" data-a="double" ${canDouble ? '' : 'disabled'}>Doubler <kbd>D</kbd></button><button class="gk-btn primary" data-a="split" ${canSplit ? '' : 'disabled'}>Séparer <kbd>S</kbd></button>
      ${S.surrender ? `<button class="gk-btn ghost" data-a="surrender" ${canSurr ? '' : 'disabled'}>Abandonner</button>` : ''}</div>`;
    if (tips) body += `<span class="bj-tip">💡 Conseil : ${advice(h, S.dealer.cards[0], canDouble, canSplit, canSurr)}</span>`;
  } else if (S.phase === 'play') { const tp = S.players.find(p => p.id === S.turn); info = `⏳ ${esc(tp?.name || '')} réfléchit…`; }
  else if (S.phase === 'reveal') info = 'Le croupier joue…';
  else if (S.phase === 'payout') info = me.net > 0 ? `🎉 Vous gagnez <b>${me.net}</b> !` : me.net < 0 ? `Vous perdez ${-me.net}.` : 'Manche suivante…';
  const key = info + body + S.phase + S.turn + S.hand + (S.phase === 'bet' ? '' : S.left > 0);
  if (key === lastKey) return; lastKey = key;
  ui.ctrl.innerHTML = `<div class="bj-info">${info}</div>${timerBar}${body}<label style="font-size:12px;color:#a8a29e;display:flex;gap:6px;align-items:center"><input type="checkbox" data-tips ${tips ? 'checked' : ''} style="width:auto"> Afficher les conseils de stratégie</label>`;
  ui.ctrl.querySelectorAll('[data-chip]').forEach(b => { b.onclick = () => api.send({ type: 'chip', n: +b.dataset.chip }); });
  ui.ctrl.querySelectorAll('[data-a]').forEach(b => { b.onclick = () => { sfx.play('click'); api.send({ type: b.dataset.a }); }; });
  ui.ctrl.querySelector('[data-tips]').onchange = e => { tips = e.target.checked; localStorage.setItem('bj-tips', tips ? '1' : '0'); lastKey = ''; render(); };
}
const val = c => { const r = parseInt(c); return r === 1 ? 11 : Math.min(10, r); };

export default {
  mount(r, a) {
    api = a; endShown = false; lastLog = ''; lastKey = ''; lastPhase = '';
    sh = shell(r, api, { title: 'Blackjack', icon: '🂱' });
    const el = document.createElement('div'); el.className = 'bj';
    el.innerHTML = `<div class="bj-room"><div class="bj-table"><div class="bj-arc"></div><div class="bj-dealer"></div><div class="bj-shoe"></div><div class="bj-seats"></div></div><div class="bj-ctrl"></div></div>
      <aside class="bj-side"><h4>Classement</h4><div class="bj-rank"></div><h4>Journal</h4><div class="bj-log"></div><h4>Discussion</h4></aside>`;
    sh.main.appendChild(el);
    const q = s => el.querySelector(s);
    ui = { dealer: q('.bj-dealer'), shoe: q('.bj-shoe'), seats: q('.bj-seats'), arc: q('.bj-arc'), ctrl: q('.bj-ctrl'), rank: q('.bj-rank'), log: q('.bj-log') };
    q('.bj-side').appendChild(chatBox(api).el);
    window.addEventListener('keydown', ui.kd = e => {
      if (e.target.closest('input')) return;
      const k = e.key.toLowerCase();
      const map = { t: 'hit', h: 'hit', r: 'stand', d: 'double', s: 'split' };
      if (S?.phase === 'play' && S.turn === api.myId && map[k]) api.send({ type: map[k] });
      if (S?.phase === 'bet' && e.key === 'Enter') api.send({ type: 'ready' });
    });
  },
  update(s) {
    const k = JSON.stringify({ ...s, left: 0 });
    if (k === this._k) return; this._k = k;
    const prev = S; S = s;
    if (prev && s.phase !== prev.phase) {
      if (s.phase === 'play' || s.phase === 'insurance') sfx.play('deal');
      if (s.phase === 'payout') { const me = s.players.find(p => p.id === api.myId); if (me?.net > 0) sfx.play(me.hands.some(h => h.bj) ? 'win' : 'chips'); else if (me?.net < 0) sfx.play('bad'); }
      if (s.phase === 'reveal') sfx.play('card');
    }
    if (prev && s.turn === api.myId && prev.turn !== api.myId) sfx.play('tick');
    if (prev && s.dealer.cards.length > prev.dealer.cards.length && s.phase === 'reveal') sfx.play('card');
    render();
  },
  event(e) { if (e.type === 'chip') sfx.play('chips', 0.5); if (e.type === 'card') sfx.play('card'); },
  unmount() { window.removeEventListener('keydown', ui.kd); S = null; this._k = null; },
};
