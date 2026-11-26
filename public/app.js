// =====================================================================
//  Client du site : accueil (catalogue), salons, invitations, réglages
//  de partie, discussion, et chargement du jeu.
//
//  Interface d'un jeu côté navigateur (public/games/monjeu.js) :
//    export default {
//      mount(root, api)   // api = { myId, room, settings, static, send(action), leave(), backToLobby(),
//                         //         isHost(), chat(text), onChat(fn), toast(msg) }
//      update(state)      // nouvel état reçu du serveur
//      event(e)           // évènement ponctuel (son, effet…)
//      unmount()
//    }
// =====================================================================
const $ = s => document.querySelector(s);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Décor des cartes de jeux (emojis flottants) — le reste vient du serveur
const ART = {
  cards: ['🟥', '🟨', '🟩', '🟦'], empire: ['🏠', '🏨', '🎲', '💰'], impostor: ['🕵️', '❓', '🗳️', '🤫'], chess: ['♞', '♜', '♛', '♟'],
  fallrace: ['🏁', '🌀', '💨', '🤸'], royale: ['🪂', '🔫', '🌀', '🏆'], tactical: ['🎯', '🛡️', '💣', '⚡'], draw: ['✏️', '🎨', '💡', '🖌️'],
  blocks: ['🧱', '⛏️', '🌲', '💎'], quest: ['⚔️', '🐉', '🧙', '💰'], carball: ['🚗', '⚽', '🥅', '💨'], zombie: ['🧟', '🔫', '💀', '🩸'],
  poker: ['♠️', '♥️', '🪙', '🃏'], kart: ['🏎️', '🍌', '🚀', '🏁'], towers: ['🏰', '👾', '💥', '🪙'], arena: ['⚡', '🎯', '💠', '🔫'],
};

// --- Notifications ---
function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2800);
}

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id);
  document.body.classList.toggle('in-game', id === 'game');
  window.scrollTo(0, 0);
}

// --- Pseudo ---
let myName = localStorage.getItem('pseudo') || '';
const avatar = (name, color) => `<span class="avatar" style="${color ? `background:${color}` : ''}">${esc((name || '?').trim()[0] || '?')}</span>`;
function renderProfile() { $('#myName').textContent = myName || 'Choisir un pseudo'; $('#myAvatar').textContent = (myName || '?')[0]; }
function askName() { $('#nameInput').value = myName; $('#nameDialog').showModal(); setTimeout(() => $('#nameInput').select(), 50); }
let pendingAfterName = null;
$('#nameForm').onsubmit = () => {
  const v = $('#nameInput').value.trim().slice(0, 16);
  if (!v) return false;
  myName = v; localStorage.setItem('pseudo', v); renderProfile();
  sendRaw({ t: 'hello', name: v });
  if (pendingAfterName) { const f = pendingAfterName; pendingAfterName = null; f(); }
};
$('#nameDialog').addEventListener('cancel', e => { if (!myName) e.preventDefault(); });
$('#profileBtn').onclick = askName;
function needName(fn) { if (myName) fn(); else { pendingAfterName = fn; askName(); } }

// --- Connexion ---
let ws, myId, room = null, game = null, loading = false, pendingState = null, chatHandlers = [], games = [], rooms = [], wasInRoom = null;
const gameById = id => games.find(g => g.id === id) || { name: id, icon: '🎮', color: '#7c6cff', settings: [], tags: [] };
function sendRaw(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }
function setStatus(ok) { $('#status').classList.toggle('on', ok); $('#status span').textContent = ok ? 'En ligne' : 'Connexion…'; }

function connect() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => {
    setStatus(true);
    if (myName) sendRaw({ t: 'hello', name: myName });
    sendRaw({ t: 'list' });
    const code = new URLSearchParams(location.search).get('salon') || wasInRoom;
    if (code) needName(() => sendRaw({ t: 'join', code }));
  };
  ws.onclose = () => {
    setStatus(false);
    if (room) { wasInRoom = room.code; toast('Connexion perdue… reconnexion', 'err'); }
    room = null; unmountGame(); show('home');
    setTimeout(connect, 1500);
  };
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    switch (m.t) {
      case 'welcome': myId = m.id; games = m.games; renderCatalog(); break;
      case 'list': rooms = m.rooms; renderRooms(); break;
      case 'room': onRoom(m.room); break;
      case 'start': startGame(m); break;
      case 'state': if (game) game.update(m.s); else pendingState = m.s; break;
      case 'event': if (game && game.event) game.event(m.e); break;
      case 'chat': addChat(m); chatHandlers.forEach(h => h(m)); break;
      case 'error':
        toast(m.msg, 'err');
        if (!room) { history.replaceState(null, '', '/'); wasInRoom = null; }
        break;
      case 'left': room = null; wasInRoom = null; history.replaceState(null, '', '/'); unmountGame(); show('home'); sendRaw({ t: 'list' }); break;
    }
  };
}

// ===================== Catalogue =====================
let filterCat = 'Tous', search = '';
function cardArt(g) {
  const em = ART[g.id] || [g.icon];
  return `<div class="game-art" style="--c:${g.color}">
    <div class="art-bg"></div>
    ${em.map((e, i) => `<span class="fl f${i}">${e}</span>`).join('')}
    <span class="art-icon">${g.icon}</span>
    <span class="badge">${esc(g.category)}</span>
  </div>`;
}
function renderCatalog() {
  const cats = ['Tous', ...new Set(games.map(g => g.category))];
  $('#cats').innerHTML = cats.map(c => `<button class="chip ${c === filterCat ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}${c !== 'Tous' ? ` <small>${games.filter(g => g.category === c).length}</small>` : ''}</button>`).join('');
  $('#cats').querySelectorAll('.chip').forEach(b => { b.onclick = () => { filterCat = b.dataset.cat; renderCatalog(); }; });
  const q = search.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const list = games.filter(g => (filterCat === 'Tous' || g.category === filterCat) &&
    (!q || `${g.name} ${g.desc} ${g.category}`.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(q)));
  $('#gameCount').textContent = games.length;
  const el = $('#gameList'); el.innerHTML = '';
  if (!list.length) { el.innerHTML = '<div class="empty-rooms"><b>Aucun jeu trouvé</b>Essayez un autre mot.</div>'; return; }
  for (const g of list) {
    const open = rooms.filter(r => r.game === g.id).reduce((n, r) => n + r.players.length, 0);
    const card = document.createElement('article');
    card.className = 'game-card';
    card.innerHTML = `${cardArt(g)}
      <div class="game-body">
        <h3>${esc(g.name)}</h3>
        <p>${esc(g.desc || '')}</p>
        <div class="tags"><span class="tag">👥 ${g.min === g.max ? g.min : `${g.min}–${g.max}`}</span>${g.tags.slice(0, 2).map(t => `<span class="tag">${esc(t)}</span>`).join('')}${open ? `<span class="tag live-tag">● ${open} en jeu</span>` : ''}</div>
        <div class="game-actions">
          <button class="btn primary" data-create>Créer</button>
          <button class="btn ghost" data-quick title="Rejoint un salon ouvert, ou en crée un">⚡ Rapide</button>
        </div>
      </div>`;
    card.querySelector('[data-create]').onclick = () => needName(() => sendRaw({ t: 'create', game: g.id }));
    card.querySelector('[data-quick]').onclick = () => needName(() => {
      const r = rooms.filter(x => x.game === g.id && x.players.length < x.max).sort((a, b) => b.players.length - a.players.length)[0];
      sendRaw(r ? { t: 'join', code: r.code } : { t: 'create', game: g.id });
    });
    el.appendChild(card);
  }
}
$('#search').oninput = e => { search = e.target.value; renderCatalog(); };

function renderRooms() {
  const el = $('#roomList');
  $('#roomCount').textContent = rooms.length;
  const players = rooms.reduce((n, r) => n + r.players.length, 0);
  $('#online').textContent = players ? `${players} joueur${players > 1 ? 's' : ''} en ligne` : '';
  if (!rooms.length) { el.innerHTML = `<div class="empty-rooms"><b>Aucun salon ouvert pour l'instant</b>Créez-en un et invitez vos amis !</div>`; return; }
  el.innerHTML = '';
  for (const r of rooms) {
    const g = gameById(r.game), full = r.players.length >= r.max;
    const b = document.createElement('button');
    b.className = 'room'; b.disabled = full;
    b.innerHTML = `<span class="ico" style="background:${g.color}">${g.icon}</span>
      <span class="info"><b>${esc(r.gameName)}</b>
        <small>Salon ${r.code} · ${r.players.length}/${r.max}${r.started ? ' · en cours' : ' · en attente'}</small>
        <span class="stack">${r.players.slice(0, 6).map(p => avatar(p.name, p.color)).join('')}</span></span>
      <span class="go">${full ? 'Complet' : 'Rejoindre →'}</span>`;
    b.onclick = () => needName(() => sendRaw({ t: 'join', code: r.code }));
    el.appendChild(b);
  }
}
setInterval(() => { if (!room) sendRaw({ t: 'list' }); }, 3000);
let lastRoomsKey = '';
setInterval(() => { const k = rooms.map(r => r.game + r.players.length).join(); if (k !== lastRoomsKey && !room) { lastRoomsKey = k; renderCatalog(); } }, 3000);

const codeInput = $('#code');
codeInput.oninput = () => { codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, ''); };
$('#joinForm').onsubmit = e => {
  e.preventDefault();
  const code = codeInput.value.trim();
  if (code.length !== 4) { toast('Le code fait 4 lettres', 'err'); codeInput.focus(); return; }
  needName(() => sendRaw({ t: 'join', code }));
};

// ===================== Salon d'attente =====================
const inviteLink = () => `${location.origin}/?salon=${room.code}`;
async function copy(text, okMsg) { try { await navigator.clipboard.writeText(text); toast(okMsg, 'ok'); } catch { prompt('Copiez ce texte :', text); } }
$('#copyLink').onclick = () => copy(inviteLink(), 'Lien copié ! Envoyez-le à vos amis 🎉');
$('#copyCode').onclick = () => copy(room.code, 'Code copié');
if (navigator.share) {
  $('#shareBtn').classList.remove('hidden');
  $('#shareBtn').onclick = () => navigator.share({ title: room.gameName, text: `Rejoins-moi sur ${room.gameName} !`, url: inviteLink() }).catch(() => {});
}
$('#startBtn').onclick = () => sendRaw({ t: 'start' });
$('#leaveBtn').onclick = () => sendRaw({ t: 'leave' });

function onRoom(r) {
  const prev = room;
  room = r; wasInRoom = r.code;
  history.replaceState(null, '', `/?salon=${r.code}`);
  if (r.started) { if (game) game.room = r; return; }
  if (game) unmountGame();
  if (!prev || prev.code !== r.code) $('#chatLog').innerHTML = '<p class="muted empty">Dites bonjour 👋</p>';
  else {
    const before = new Set(prev.players.map(p => p.id)), after = new Set(r.players.map(p => p.id));
    r.players.filter(p => !before.has(p.id)).forEach(p => sysChat(`${p.name} a rejoint le salon`));
    prev.players.filter(p => !after.has(p.id)).forEach(p => sysChat(`${p.name} est parti`));
    if (prev.host !== r.host && r.host === myId) toast('Vous êtes maintenant l’hôte 👑', 'ok');
  }
  renderLobby(!prev || prev.code !== r.code || prev.started);
}

function renderLobby(full) {
  const g = gameById(room.game);
  show('lobby');
  $('#lobbyBanner').style.background = `linear-gradient(135deg, ${g.color}, #1b1f4a)`;
  $('#lobbyGame').textContent = `${g.icon} ${room.gameName}`;
  $('#lobbyCode').textContent = room.code;
  $('#rules').innerHTML = g.rules || '<p class="muted">Amusez-vous bien !</p>';
  $('#playerCount').textContent = `${room.players.length}/${room.max}`;
  const slots = Math.max(0, Math.min(room.max, Math.max(room.min, 4)) - room.players.length);
  $('#lobbyPlayers').innerHTML = room.players.map(p => `
    <li class="${p.id === myId ? 'me' : ''}">${avatar(p.name, p.color)}
      <span class="who"><b>${esc(p.name)}</b><small>${p.id === room.host ? '👑 Hôte' : 'Joueur'}${p.id === myId ? ' · vous' : ''}</small></span></li>`).join('')
    + Array.from({ length: slots }, () => '<li class="slot">En attente…</li>').join('');
  renderSettings(g, full);
  const host = room.host === myId, enough = room.players.length >= room.min;
  const start = $('#startBtn');
  start.classList.toggle('hidden', !host);
  start.disabled = !enough;
  const msg = $('#lobbyInfo');
  msg.className = '';
  if (host && !enough) { msg.textContent = `Il faut au moins ${room.min} joueurs. Invitez vos amis avec le lien`; msg.className = 'waiting'; }
  else if (host) msg.textContent = 'Réglez les paramètres puis lancez la partie !';
  else { msg.textContent = `En attente que ${room.players.find(p => p.id === room.host)?.name || "l'hôte"} lance la partie`; msg.className = 'waiting'; }
}

// --- Paramètres réglables par l'hôte ---
function settingValueLabel(o, v) {
  if (o.type === 'toggle') return v ? 'Oui' : 'Non';
  if (o.type === 'select') return o.options.find(x => String(x.v) === String(v))?.l ?? v;
  return `${v}${o.unit || ''}`;
}
function renderSettings(g, full) {
  const wrap = $('#settingsWrap'), box = $('#settings');
  const opts = g.settings || [];
  wrap.classList.toggle('hidden', !opts.length);
  if (!opts.length) return;
  const host = room.host === myId, S = room.settings || {};
  $('#settingsNote').textContent = host ? 'Vous pouvez les modifier' : 'Choisis par l’hôte';
  // évite de reconstruire les champs pendant que l'hôte les modifie
  if (!full && host && box.dataset.host === '1' && box.dataset.game === g.id) {
    for (const o of opts) { const out = box.querySelector(`[data-out="${o.key}"]`); if (out) out.textContent = settingValueLabel(o, S[o.key]); }
    return;
  }
  box.dataset.host = host ? '1' : '0'; box.dataset.game = g.id;
  box.innerHTML = opts.map(o => {
    const v = S[o.key];
    let ctrl;
    if (!host) ctrl = `<b class="set-val">${esc(settingValueLabel(o, v))}</b>`;
    else if (o.type === 'toggle') ctrl = `<label class="switch"><input type="checkbox" data-k="${o.key}" ${v ? 'checked' : ''}><i></i></label>`;
    else if (o.type === 'select') ctrl = `<div class="seg">${o.options.map(x => `<button type="button" data-k="${o.key}" data-v="${esc(x.v)}" class="${String(x.v) === String(v) ? 'on' : ''}">${esc(x.l)}</button>`).join('')}</div>`;
    else ctrl = `<div class="range"><input type="range" data-k="${o.key}" min="${o.min}" max="${o.max}" step="${o.step || 1}" value="${v}"><output data-out="${o.key}">${esc(settingValueLabel(o, v))}</output></div>`;
    return `<div class="setting ${o.type}"><div class="set-lbl"><span>${esc(o.label)}</span>${o.help ? `<small>${esc(o.help)}</small>` : ''}</div>${ctrl}</div>`;
  }).join('');
  if (!host) return;
  const sendSet = (k, v) => sendRaw({ t: 'settings', settings: { [k]: v } });
  box.querySelectorAll('input[type=checkbox]').forEach(i => { i.onchange = () => sendSet(i.dataset.k, i.checked); });
  box.querySelectorAll('.seg button').forEach(b => {
    b.onclick = () => { b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); const o = opts.find(x => x.key === b.dataset.k); sendSet(b.dataset.k, o.options.find(x => String(x.v) === b.dataset.v).v); };
  });
  box.querySelectorAll('input[type=range]').forEach(i => {
    const o = opts.find(x => x.key === i.dataset.k);
    i.oninput = () => { box.querySelector(`[data-out="${o.key}"]`).textContent = settingValueLabel(o, +i.value); };
    i.onchange = () => sendSet(i.dataset.k, +i.value);
  });
}

// --- Discussion du salon ---
function chatEl() { const l = $('#chatLog'); l.querySelector('.empty')?.remove(); return l; }
function addChat(m) {
  if (!room || room.started) return;
  const l = chatEl();
  l.insertAdjacentHTML('beforeend', `<div class="msg"><b style="color:${m.color || '#c4bcff'}">${esc(m.from)}</b>${esc(m.text)}</div>`);
  l.scrollTop = l.scrollHeight;
}
function sysChat(text) { const l = chatEl(); l.insertAdjacentHTML('beforeend', `<div class="sys">${esc(text)}</div>`); l.scrollTop = l.scrollHeight; }
$('#chatForm').onsubmit = e => { e.preventDefault(); const i = $('#chatInput'); if (i.value.trim()) sendRaw({ t: 'chat', text: i.value }); i.value = ''; };

// ===================== Jeu =====================
async function startGame(m) {
  if (game || loading) return;
  loading = true;
  let mod;
  try { mod = await import(`./games/${m.game}.js`); }
  catch (e) { console.error(e); toast('Impossible de charger le jeu', 'err'); loading = false; return; }
  loading = false;
  if (!room) return;
  game = mod.default;
  show('game');
  const root = $('#game'); root.innerHTML = '';
  chatHandlers = [];
  const api = {
    myId, room, settings: { ...(room.settings || {}) }, static: m.static,
    send: a => sendRaw({ t: 'action', a }),
    leave: () => sendRaw({ t: 'leave' }),
    backToLobby: () => sendRaw({ t: 'lobby' }),
    isHost: () => room?.host === myId,
    chat: text => sendRaw({ t: 'chat', text }),
    onChat: h => chatHandlers.push(h),
    toast,
  };
  game.mount(root, api);
  if (pendingState) { game.update(pendingState); pendingState = null; }
}
function unmountGame() {
  if (!game) return;
  try { game.unmount(); } catch (e) { console.error(e); }
  game = null; pendingState = null; chatHandlers = []; $('#game').innerHTML = '';
}

renderProfile();
$('#brand').onclick = e => { e.preventDefault(); if (room) { if (confirm('Quitter le salon ?')) sendRaw({ t: 'leave' }); } else window.scrollTo({ top: 0 }); };
connect();
