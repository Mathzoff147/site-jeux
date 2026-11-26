// =====================================================================
//  EMPIRE IMMOBILIER — affichage (navigateur)
//  Dessine le plateau, les pions, les panneaux d'action ; envoie les clics.
// =====================================================================
const GROUP_COLORS = {
  brown: '#8b5a2b', sky: '#7dd3fc', pink: '#f472b6', orange: '#fb923c',
  red: '#ef4444', yellow: '#facc15', green: '#22c55e', navy: '#2563eb',
};
const ICONS = { go: '🏁', chest: '📦', chance: '❓', tax: '💰', station: '🚉', utility: '⚡', jail: '🚔', park: '🌳', gotojail: '👮' };
const CSS = `
.em { display:flex; gap:14px; padding:14px; min-height:100vh; align-items:flex-start; justify-content:center;
  background: radial-gradient(1000px 600px at 30% 10%, #1e293b, #0b1020); }
.em-board { --s: min(calc(100vh - 28px), calc(100vw - 420px)); width:var(--s); height:var(--s); flex:none;
  display:grid; grid-template-columns:1.6fr repeat(9,1fr) 1.6fr; grid-template-rows:1.6fr repeat(9,1fr) 1.6fr;
  gap:2px; background:#0f172a; padding:2px; border-radius:12px; box-shadow:0 30px 80px #000a, 0 0 0 2px #334155;
  font-size: calc(var(--s) / 95); user-select:none; }
.em-sq { position:relative; background:#f1ead7; color:#1f2937; display:flex; flex-direction:column; align-items:center;
  justify-content:space-between; text-align:center; overflow:hidden; cursor:pointer; border-radius:3px; transition: box-shadow .2s; }
.em-sq:hover { box-shadow: inset 0 0 0 2px #6366f1; }
.em-sq .band { flex:none; width:100%; height:22%; }
.em-sq.left { flex-direction:row-reverse; } .em-sq.left .band, .em-sq.right .band { width:22%; height:100%; }
.em-sq.right { flex-direction:row; } .em-sq.top { flex-direction:column-reverse; }
.em-sq .body { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:2px; gap:2px; line-height:1.1; }
.em-sq .nm { font-weight:700; font-size:1em; } .em-sq .pr { font-size:.95em; opacity:.75; }
.em-sq .ic { font-size:2.2em; line-height:1; }
.em-sq.corner .ic { font-size:3.6em; } .em-sq.corner .nm { font-size:1.2em; }
.em-sq .own { position:absolute; inset:0; pointer-events:none; border:3px solid transparent; border-radius:3px; }
.em-sq .mort { position:absolute; inset:0; background:repeating-linear-gradient(45deg,#0004 0 6px,transparent 6px 12px); pointer-events:none; }
.em-sq .houses { position:absolute; display:flex; gap:1px; font-size:1.1em; }
.em-sq.bottom .houses { top:1px; } .em-sq.top .houses { bottom:1px; }
.em-sq.left .houses { right:1px; flex-direction:column; } .em-sq.right .houses { left:1px; flex-direction:column; }
.em-tokens { position:absolute; inset:0; display:flex; flex-wrap:wrap; align-content:center; justify-content:center; gap:2px; pointer-events:none; }
.em-tok { width:2.3em; height:2.3em; border-radius:50%; border:2px solid #fff; box-shadow:0 2px 6px #0008; transition: transform .15s; }
.em-tok.me { outline:2px solid #fff; outline-offset:1px; }
.em-center { grid-column:2/11; grid-row:2/11; background:linear-gradient(135deg,#14532d,#064e3b); border-radius:6px;
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1.2em; color:#ecfdf5; padding:2em; position:relative; }
.em-title { font-size:4.2em; font-weight:800; letter-spacing:.05em; transform:rotate(-8deg); text-shadow:0 4px 0 #0005; color:#fde68a; }
.em-dice { display:flex; gap:1.2em; } .em-die { width:5em; height:5em; background:#fff; border-radius:1em; display:grid;
  grid-template:repeat(3,1fr)/repeat(3,1fr); padding:.6em; box-shadow:0 .4em 0 #cbd5e1, 0 .8em 1.6em #0006; }
.em-die i { width:1em; height:1em; border-radius:50%; background:#111; margin:auto; visibility:hidden; }
.em-die.roll { animation: emroll .5s ease-out; }
@keyframes emroll { 0%{transform:rotate(0) scale(.6)} 60%{transform:rotate(320deg) scale(1.15)} 100%{transform:rotate(360deg) scale(1)} }
.em-card { background:#fffbeb; color:#422006; border-radius:.8em; padding:1em 1.4em; max-width:70%; font-size:1.3em; box-shadow:0 1em 2em #0006; text-align:center; animation: emcard .4s; }
.em-card b { display:block; font-size:.8em; text-transform:uppercase; letter-spacing:.1em; margin-bottom:.3em; }
@keyframes emcard { from{transform:scale(.3) rotate(-20deg); opacity:0} }
.em-side { width:380px; flex:none; display:flex; flex-direction:column; gap:10px; max-height:calc(100vh - 28px); }
.em-panel { background:#151b30; border:1px solid #262f52; border-radius:14px; padding:12px; }
.em-panel h3 { margin:0 0 8px; font-size:13px; text-transform:uppercase; letter-spacing:.08em; color:#93a0c4; }
.em-pl { display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:8px; }
.em-pl.turn { background:#1d2540; box-shadow: inset 3px 0 0 #6366f1; } .em-pl.dead { opacity:.35; text-decoration:line-through; }
.em-pl .money { margin-left:auto; font-weight:800; font-variant-numeric:tabular-nums; }
.em-pl small { color:#93a0c4; }
.em-actions { display:flex; flex-wrap:wrap; gap:8px; } .em-actions button { flex:1 1 auto; }
.em-actions .info { width:100%; color:#cbd5e1; font-size:14px; margin-bottom:4px; }
.em-log { overflow:auto; font-size:13px; color:#cbd5e1; flex:1; min-height:120px; display:flex; flex-direction:column; gap:3px; }
.em-chat { display:flex; gap:6px; margin-top:8px; } .em-chat input { padding:6px 10px; }
.em-modal { position:fixed; inset:0; background:#000a; display:flex; align-items:center; justify-content:center; z-index:50; padding:16px; }
.em-modal .box { background:#151b30; border:1px solid #2c3762; border-radius:16px; padding:18px; width:100%; max-width:440px; max-height:90vh; overflow:auto; }
.em-deed { border-radius:10px; overflow:hidden; background:#f8fafc; color:#111; margin-bottom:12px; }
.em-deed .hd { padding:12px; text-align:center; font-weight:800; font-size:18px; color:#111; }
.em-deed table { width:100%; border-collapse:collapse; font-size:14px; } .em-deed td { padding:4px 12px; } .em-deed td:last-child { text-align:right; font-weight:600; }
.em-deed tr.cur { background:#fde68a; }
.em-tr { display:grid; grid-template-columns:1fr 1fr; gap:12px; } .em-tr label { font-size:13px; }
.em-tr .lst { display:flex; flex-direction:column; gap:4px; max-height:220px; overflow:auto; margin:6px 0; }
.em-tr .lst label { display:flex; gap:6px; align-items:center; color:#e8ecf8; } .em-tr .lst input { width:auto; }
.em-chip { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:4px; vertical-align:middle; }
.em-over { position:fixed; inset:0; background:#000c; display:flex; align-items:center; justify-content:center; z-index:60; flex-direction:column; gap:16px; text-align:center; }
.em-over h1 { font-size:48px; }
@media (max-width: 900px) { .em { flex-direction:column; align-items:center; } .em-board { --s: calc(100vw - 28px); } .em-side { width:100%; max-height:none; } }
`;

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Petits sons synthétisés
let actx;
function beep(f = 440, d = 0.08, type = 'sine', v = 0.06) {
  try {
    actx ||= new AudioContext();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = f; g.gain.value = v;
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + d);
    o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + d);
  } catch { }
}

let lastKey = '';
let api, root, board, S, cells = [], disp = {}, stepTimer, lastRoll = 0, lastCardN = 0, lastLogLen = 0, cardTimeout;

function cellPos(i) {
  if (i <= 10) return { r: 11, c: 11 - i, side: i === 0 || i === 10 ? 'corner' : 'bottom' };
  if (i <= 20) return { r: 11 - (i - 10), c: 1, side: i === 20 ? 'corner' : 'left' };
  if (i <= 30) return { r: 1, c: 1 + (i - 20), side: i === 30 ? 'corner' : 'top' };
  return { r: 1 + (i - 30), c: 11, side: 'right' };
}

function buildBoard() {
  const el = root.querySelector('.em-board');
  cells = board.map((sq, i) => {
    const { r, c, side } = cellPos(i);
    const d = document.createElement('div');
    d.className = `em-sq ${side}`;
    d.style.gridRow = r; d.style.gridColumn = c;
    const band = sq.type === 'prop' ? `<div class="band" style="background:${GROUP_COLORS[sq.group]}"></div>` : '';
    const icon = sq.type !== 'prop' ? `<div class="ic">${ICONS[sq.type]}</div>` : '';
    const price = sq.price ? `<div class="pr">${sq.price} €</div>` : sq.amount ? `<div class="pr">${sq.amount} €</div>` : '';
    d.innerHTML = `${band}<div class="body">${icon}<div class="nm">${esc(sq.name)}</div>${price}</div>
      <div class="own"></div><div class="houses"></div><div class="em-tokens"></div>`;
    d.onclick = () => openDeed(i);
    el.appendChild(d);
    return d;
  });
  const center = document.createElement('div');
  center.className = 'em-center';
  center.innerHTML = `<div class="em-title">EMPIRE</div><div class="em-round"></div>
    <div class="em-dice"><div class="em-die"></div><div class="em-die"></div></div>
    <div class="em-cardslot"></div><div class="em-pot"></div>`;
  el.appendChild(center);
  for (const die of center.querySelectorAll('.em-die')) die.innerHTML = '<i></i>'.repeat(9);
}

function drawDie(el, n) { [...el.children].forEach((pip, k) => { pip.style.visibility = PIPS[n].includes(k) ? 'visible' : 'hidden'; }); }

function playerById(id) { return S.players.find(p => p.id === id); }
const me = () => playerById(api.myId);
const isMyTurn = () => S.players[S.turn]?.id === api.myId;

// --- Animation des pions case par case ---
function animateTokens() {
  clearInterval(stepTimer);
  stepTimer = setInterval(() => {
    let moving = false;
    for (const p of S.players) {
      if (disp[p.id] === undefined) disp[p.id] = p.pos;
      if (disp[p.id] !== p.pos) {
        const fwd = (p.pos - disp[p.id] + 40) % 40;
        // gros saut (prison, recul) : téléportation
        if (fwd > 12 || p.inJail) disp[p.id] = p.pos; else { disp[p.id] = (disp[p.id] + 1) % 40; beep(660 + disp[p.id] * 4, 0.04, 'triangle', 0.03); }
        moving = true;
      }
    }
    renderTokens();
    if (!moving) clearInterval(stepTimer);
  }, 140);
}
function renderTokens() {
  cells.forEach(c => { c.querySelector('.em-tokens').innerHTML = ''; });
  for (const p of S.players) {
    if (p.bankrupt) continue;
    const t = document.createElement('div');
    t.className = 'em-tok' + (p.id === api.myId ? ' me' : '');
    t.style.background = p.color; t.title = p.name;
    cells[disp[p.id] ?? p.pos].querySelector('.em-tokens').appendChild(t);
  }
}

function renderCells() {
  board.forEach((sq, i) => {
    const pr = S.props[i], c = cells[i];
    const owner = pr && playerById(pr.owner);
    c.querySelector('.own').style.borderColor = owner ? owner.color : 'transparent';
    c.querySelector('.houses').innerHTML = pr?.houses === 5 ? '🏨' : '🏠'.repeat(pr?.houses || 0);
    const m = c.querySelector('.mort');
    if (pr?.mortgaged && !m) c.insertAdjacentHTML('beforeend', '<div class="mort"></div>');
    if (!pr?.mortgaged && m) m.remove();
  });
}

function renderPlayers() {
  root.querySelector('.em-players').innerHTML = S.players.map((p, k) => `
    <div class="em-pl ${k === S.turn ? 'turn' : ''} ${p.bankrupt ? 'dead' : ''}">
      <span class="dot" style="background:${p.color}"></span>
      <div><b>${esc(p.name)}</b>${p.id === api.myId ? ' <small>(vous)</small>' : ''}<br>
      <small>${p.inJail ? '🚔 en prison · ' : ''}${p.jailCards.length ? `🎫×${p.jailCards.length} · ` : ''}patrimoine ${S.worth[p.id]} €</small></div>
      <span class="money">${p.money} €</span>
      ${p.id !== api.myId && !p.bankrupt && !me()?.bankrupt ? `<button class="ghost" data-trade="${p.id}" title="Proposer un échange">🤝</button>` : ''}
    </div>`).join('');
  root.querySelectorAll('[data-trade]').forEach(b => { b.onclick = () => openTrade(b.dataset.trade); });
}

function btn(label, action, opts = {}) {
  const b = document.createElement('button');
  b.innerHTML = label;
  if (opts.ghost) b.className = 'ghost';
  if (opts.disabled) b.disabled = true;
  b.onclick = () => { beep(520, .05); typeof action === 'function' ? action() : api.send(action); };
  return b;
}

function renderActions() {
  const el = root.querySelector('.em-actions'); el.innerHTML = '';
  const info = t => el.insertAdjacentHTML('beforeend', `<div class="info">${t}</div>`);
  const p = me(), turnP = S.players[S.turn];
  if (S.phase === 'over') return info('Partie terminée.');
  if (!p || p.bankrupt) { info('Vous êtes en faillite — vous regardez la partie.'); }

  // Échange reçu
  if (S.trade && S.trade.to === api.myId) {
    const t = S.trade, from = playerById(t.from);
    info(`🤝 <b>${esc(from.name)}</b> vous propose :<br>Il donne : ${describe(t.give)}<br>Il demande : ${describe(t.get)}`);
    el.append(btn('✅ Accepter', { type: 'acceptTrade' }), btn('❌ Refuser', { type: 'cancelTrade' }, { ghost: true }));
    el.insertAdjacentHTML('beforeend', '<div style="width:100%;height:6px"></div>');
  } else if (S.trade && S.trade.from === api.myId) {
    info(`🤝 Échange proposé à ${esc(playerById(S.trade.to).name)}… en attente.`);
    el.append(btn('Annuler l’échange', { type: 'cancelTrade' }, { ghost: true }));
  }

  if (S.phase === 'auction') {
    const A = S.auction, sq = board[A.idx];
    const bidder = A.bidder ? playerById(A.bidder).name : 'personne';
    info(`🔨 Enchères : <b>${esc(sq.name)}</b> (valeur ${sq.price} €)<br>Meilleure offre : <b>${A.bid} €</b> par ${esc(bidder)} · ⏱ ${Math.ceil(A.left / 1000)} s`);
    if (A.active.includes(api.myId)) {
      for (const inc of [10, 50, 100]) el.append(btn(`+${inc}`, { type: 'bid', amount: A.bid + inc }, { disabled: A.bid + inc > p.money }));
      if (A.bidder !== api.myId) el.append(btn('Je passe', { type: 'pass' }, { ghost: true }));
    } else info('Vous ne participez plus.');
    return;
  }
  if (S.phase === 'debt') {
    const d = S.debt, dp = playerById(d.id);
    if (d.id !== api.myId) return info(`⏳ ${esc(dp.name)} doit trouver ${d.amount} €…`);
    info(`⚠️ Vous devez <b>${d.amount} €</b> ${d.to ? 'à ' + esc(playerById(d.to).name) : 'à la banque'}. Vendez des bâtiments ou hypothéquez (cliquez sur vos terrains).`);
    el.append(btn(`Payer ${d.amount} €`, { type: 'payDebt' }, { disabled: p.money < d.amount }), btn('💀 Déclarer faillite', { type: 'bankrupt' }, { ghost: true }));
    return;
  }
  if (!isMyTurn()) return info(`⏳ C'est au tour de <b style="color:${turnP.color}">${esc(turnP.name)}</b>.`);

  if (S.phase === 'roll') {
    if (p.inJail) {
      info(`🚔 Vous êtes en prison (tentative ${p.jailTurns + 1}/3). Faites un double, payez ou utilisez une carte.`);
      el.append(btn('🎲 Tenter le double', { type: 'roll' }), btn('Payer 50 €', { type: 'payJail' }, { disabled: p.money < 50 }));
      if (p.jailCards.length) el.append(btn('🎫 Utiliser la carte', { type: 'useCard' }));
    } else {
      info(S.rolledDouble ? 'Double ! Relancez les dés.' : 'À vous de jouer !');
      el.append(btn('🎲 Lancer les dés', { type: 'roll' }));
    }
  } else if (S.phase === 'buy') {
    const sq = board[S.pending.idx];
    info(`Vous êtes sur <b>${esc(sq.name)}</b>. L’acheter pour <b>${sq.price} €</b> ?`);
    el.append(btn(`🏠 Acheter (${sq.price} €)`, { type: 'buy' }, { disabled: p.money < sq.price }), btn(S.auctions ? 'Mettre aux enchères' : 'Ne pas acheter', { type: 'decline' }, { ghost: true }));
    el.append(btn('🔎 Voir la carte', () => openDeed(S.pending.idx), { ghost: true }));
  } else if (S.phase === 'end') {
    info('Construisez, hypothéquez ou échangez (cliquez sur vos terrains), puis terminez votre tour.');
    el.append(btn('✔ Fin du tour', { type: 'end' }));
  }
}

function describe(side) {
  const parts = [];
  if (side.money) parts.push(`${side.money} €`);
  side.props.forEach(i => parts.push(`<span class="em-chip" style="background:${GROUP_COLORS[board[i].group] || '#94a3b8'}"></span>${esc(board[i].name)}`));
  if (side.cards) parts.push(`🎫×${side.cards}`);
  return parts.join(', ') || 'rien';
}

function renderLog() {
  const el = root.querySelector('.em-log');
  if (S.log.length === lastLogLen && el.childElementCount) return;
  lastLogLen = S.log.length;
  el.innerHTML = S.log.map(l => `<div>${esc(l)}</div>`).join('');
  el.scrollTop = el.scrollHeight;
}

function renderCenter() {
  const dice = root.querySelectorAll('.em-die');
  if (S.rollN !== lastRoll) {
    lastRoll = S.rollN;
    dice.forEach(d => { d.classList.remove('roll'); void d.offsetWidth; d.classList.add('roll'); });
    for (let k = 0; k < 4; k++) setTimeout(() => beep(200 + Math.random() * 300, .03, 'square', .03), k * 90);
  }
  drawDie(dice[0], S.dice[0]); drawDie(dice[1], S.dice[1]);
  if (S.lastCard && S.lastCard.n !== lastCardN) {
    lastCardN = S.lastCard.n;
    const slot = root.querySelector('.em-cardslot');
    slot.innerHTML = `<div class="em-card"><b>${S.lastCard.deck === 'chance' ? '❓ Destin' : '📦 Caisse Commune'}</b>${esc(S.lastCard.text)}</div>`;
    clearTimeout(cardTimeout); cardTimeout = setTimeout(() => { slot.innerHTML = ''; }, 6000);
    beep(880, .15, 'sine', .05);
  }
  root.querySelector('.em-round').textContent = S.maxTurns ? `Tour ${Math.min(S.round, S.maxTurns)} / ${S.maxTurns}` : '';
  root.querySelector('.em-pot').textContent = S.freeParking && S.pot ? `🌳 Cagnotte du Jardin : ${S.pot} €` : '';
}

// --- Fenêtres ---
function modal(html) {
  closeModal();
  const m = document.createElement('div');
  m.className = 'em-modal'; m.innerHTML = `<div class="box">${html}</div>`;
  m.onclick = e => { if (e.target === m) closeModal(); };
  root.appendChild(m);
  return m;
}
function closeModal() { root.querySelector('.em-modal')?.remove(); openDeed.idx = null; }

function openDeed(i) {
  const sq = board[i];
  if (!['prop', 'station', 'utility'].includes(sq.type)) return;
  const render = () => {
    const pr = S.props[i], owner = pr && playerById(pr.owner);
    let rows = '';
    if (sq.type === 'prop') {
      const labels = ['Terrain nu', '1 maison', '2 maisons', '3 maisons', '4 maisons', 'Hôtel'];
      rows = sq.rents.map((r, k) => `<tr class="${pr && pr.houses === k ? 'cur' : ''}"><td>${labels[k]}</td><td>${r} €</td></tr>`).join('')
        + `<tr><td><i>Groupe complet (nu)</i></td><td>${sq.rents[0] * 2} €</td></tr><tr><td>Prix d’une maison</td><td>${sq.house} €</td></tr>`;
    } else if (sq.type === 'station') rows = [1, 2, 3, 4].map(n => `<tr><td>${n} gare${n > 1 ? 's' : ''}</td><td>${25 * 2 ** (n - 1)} €</td></tr>`).join('');
    else rows = '<tr><td>1 compagnie</td><td>4 × dés</td></tr><tr><td>2 compagnies</td><td>10 × dés</td></tr>';
    rows += `<tr><td>Hypothèque</td><td>${sq.price / 2} €</td></tr>`;
    const head = sq.type === 'prop' ? GROUP_COLORS[sq.group] : '#cbd5e1';
    const m = modal(`<div class="em-deed"><div class="hd" style="background:${head}">${ICONS[sq.type] || ''} ${esc(sq.name)}</div><table>${rows}</table></div>
      <p style="color:#93a0c4">${owner ? `Propriétaire : <b style="color:${owner.color}">${esc(owner.name)}</b>${pr.mortgaged ? ' · <b>hypothéquée</b>' : ''}` : `À vendre : ${sq.price} €`}</p>
      <div class="em-actions"></div>`);
    const acts = m.querySelector('.em-actions');
    if (pr?.owner === api.myId) {
      if (sq.type === 'prop') {
        acts.append(btn(`🏗️ Construire (${sq.house} €)`, { type: 'build', idx: i }), btn(`Vendre un bâtiment (+${sq.house / 2} €)`, { type: 'sell', idx: i }, { ghost: true }));
      }
      if (pr.mortgaged) acts.append(btn(`Lever l’hypothèque (${Math.ceil(sq.price / 2 * 1.1)} €)`, { type: 'unmortgage', idx: i }));
      else acts.append(btn(`Hypothéquer (+${sq.price / 2} €)`, { type: 'mortgage', idx: i }, { ghost: true }));
    }
    acts.append(btn('Fermer', closeModal, { ghost: true }));
  };
  openDeed.idx = i; openDeed.render = render;
  render();
}

function openTrade(targetId) {
  const target = playerById(targetId), mine = me();
  const list = (ownerId, name) => Object.keys(S.props).map(Number).filter(i => S.props[i].owner === ownerId).sort((a, b) => a - b)
    .map(i => `<label><input type="checkbox" name="${name}" value="${i}"><span class="em-chip" style="background:${GROUP_COLORS[board[i].group] || '#94a3b8'}"></span>${esc(board[i].name)}${S.props[i].houses ? ' 🏠' : ''}${S.props[i].mortgaged ? ' (hyp.)' : ''}</label>`).join('') || '<i style="color:#93a0c4">aucun terrain</i>';
  const m = modal(`<h3 style="margin-top:0">🤝 Échange avec ${esc(target.name)}</h3>
    <div class="em-tr">
      <div><b>Vous donnez</b><div class="lst">${list(mine.id, 'give')}</div>
        <label>Argent (max ${mine.money}) <input type="number" min="0" max="${mine.money}" value="0" class="gm"></label>
        ${mine.jailCards.length ? `<label>Cartes prison <input type="number" min="0" max="${mine.jailCards.length}" value="0" class="gc"></label>` : ''}</div>
      <div><b>Vous recevez</b><div class="lst">${list(target.id, 'get')}</div>
        <label>Argent (max ${target.money}) <input type="number" min="0" max="${target.money}" value="0" class="tm"></label>
        ${target.jailCards.length ? `<label>Cartes prison <input type="number" min="0" max="${target.jailCards.length}" value="0" class="tc"></label>` : ''}</div>
    </div>
    <p style="color:#93a0c4;font-size:13px">Les terrains d’un groupe avec des bâtiments ne peuvent pas être échangés.</p>
    <div class="em-actions"></div>`);
  const val = sel => Number(m.querySelector(sel)?.value || 0);
  const checked = n => [...m.querySelectorAll(`input[name=${n}]:checked`)].map(x => Number(x.value));
  m.querySelector('.em-actions').append(
    btn('Proposer', () => { api.send({ type: 'proposeTrade', to: targetId, give: { money: val('.gm'), props: checked('give'), cards: val('.gc') }, get: { money: val('.tm'), props: checked('get'), cards: val('.tc') } }); closeModal(); }),
    btn('Annuler', closeModal, { ghost: true }));
}

function renderOver() {
  if (S.phase !== 'over' || root.querySelector('.em-over')) return;
  const w = playerById(S.winner);
  const o = document.createElement('div'); o.className = 'em-over';
  o.innerHTML = `<h1>🏆 ${esc(w?.name || '?')} gagne !</h1><p>Classement :</p>
    <ol style="text-align:left">${S.players.slice().sort((a, b) => S.worth[b.id] - S.worth[a.id]).map(p => `<li>${esc(p.name)} — ${S.worth[p.id]} €</li>`).join('')}</ol>`;
  if (api.isHost()) o.append(btn('🔁 Rejouer', () => api.backToLobby()));
  o.append(btn('Quitter', () => api.leave(), { ghost: true }));
  root.appendChild(o);
  [523, 659, 784, 1046].forEach((f, k) => setTimeout(() => beep(f, .25, 'triangle', .06), k * 160));
}

export default {
  mount(r, a) {
    api = a; board = a.static.board;
    disp = {}; lastKey = ''; lastRoll = 0; lastCardN = 0; lastLogLen = 0;
    if (!document.getElementById('em-css')) { const st = document.createElement('style'); st.id = 'em-css'; st.textContent = CSS; document.head.appendChild(st); }
    root = document.createElement('div'); root.className = 'em';
    root.innerHTML = `<div class="em-board"></div>
      <div class="em-side">
        <div class="em-panel"><h3>Joueurs</h3><div class="em-players"></div></div>
        <div class="em-panel"><h3>Actions</h3><div class="em-actions"></div></div>
        <div class="em-panel" style="flex:1;display:flex;flex-direction:column;min-height:0"><h3>Journal & discussion</h3>
          <div class="em-log"></div>
          <form class="em-chat"><input placeholder="Message…" maxlength="200"><button>➤</button></form>
          <div style="display:flex;gap:8px;margin-top:8px">${a.isHost() ? '<button class="ghost" style="flex:1" data-lobby>⟲ Salon</button>' : ''}<button class="ghost" style="flex:1" data-quit>Quitter la partie</button></div></div>
      </div>`;
    r.appendChild(root);
    buildBoard();
    const form = root.querySelector('.em-chat');
    form.onsubmit = e => { e.preventDefault(); const i = form.querySelector('input'); if (i.value.trim()) api.chat(i.value); i.value = ''; };
    root.querySelector('[data-lobby]')?.addEventListener('click', () => { if (confirm('Arrêter la partie et revenir au salon ?')) api.backToLobby(); });
    root.querySelector('[data-quit]').onclick = () => { if (confirm('Quitter ? Vous serez déclaré en faillite.')) api.leave(); };
    api.onChat(m => {
      const el = root.querySelector('.em-log');
      el.insertAdjacentHTML('beforeend', `<div><b style="color:${m.color}">${esc(m.from)} :</b> ${esc(m.text)}</div>`);
      el.scrollTop = el.scrollHeight; beep(990, .05);
    });
  },
  update(s) {
    // Le serveur renvoie l'état 2×/s : on ne redessine que s'il a changé.
    const key = JSON.stringify({ ...s, auction: s.auction && { ...s.auction, left: Math.ceil(s.auction.left / 1000) } });
    if (key === lastKey) return;
    lastKey = key;
    const prevMoney = S && me()?.money;
    S = s;
    renderCells(); renderPlayers(); renderActions(); renderLog(); renderCenter(); animateTokens(); renderOver();
    if (openDeed.idx != null && openDeed.render && root.querySelector('.em-deed')) openDeed.render();
    const m = me()?.money;
    if (prevMoney !== undefined && m !== prevMoney) beep(m > prevMoney ? 1200 : 300, .1, 'sine', .04);
  },
  event() {},
  unmount() { clearInterval(stepTimer); clearTimeout(cardTimeout); S = null; root?.remove(); },
};
