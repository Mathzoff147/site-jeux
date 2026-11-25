// =====================================================================
//  Client du site : accueil, salons, invitations, discussion, et
//  chargement du jeu.
//
//  Interface d'un jeu côté navigateur (public/games/monjeu.js) :
//    export default {
//      mount(root, api)   // api = { myId, room, static, send(action), leave(), chat(text), onChat, toast }
//      update(state)      // nouvel état reçu du serveur
//      event(e)           // évènement ponctuel (son, effet…)
//      unmount()
//    }
// =====================================================================
const $ = s => document.querySelector(s);
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// --- Présentation des jeux (illustrations, règles résumées) ---
const GAME_INFO = {
  empire: {
    icon: '🏙️', color: 'linear-gradient(135deg,#f59e0b,#ef4444)', badge: 'Plateau · tour par tour',
    tags: ['👥 2–8 joueurs', '⏱ 45–90 min', '🎲 Stratégie'],
    rules: `<ul>
      <li>Lancez les dés et achetez les terrains où vous arrivez.</li>
      <li>Réunissez un groupe de couleur pour construire maisons et hôtels.</li>
      <li>Les autres paient un loyer quand ils s'arrêtent chez vous.</li>
      <li>Échangez, hypothéquez, enchérissez… Le dernier non ruiné gagne !</li></ul>`,
    art: `<svg viewBox="0 0 400 190" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="ea" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14532d"/><stop offset="1" stop-color="#064e3b"/></linearGradient></defs>
      <rect width="400" height="190" fill="url(#ea)"/>
      <g transform="translate(200 120) rotate(-12) skewX(18)">
        <rect x="-150" y="-80" width="300" height="160" rx="8" fill="#f1ead7" opacity=".95"/>
        <rect x="-118" y="-50" width="236" height="100" fill="#166534"/>
        ${['#8b5a2b', '#7dd3fc', '#f472b6', '#fb923c', '#ef4444', '#facc15', '#22c55e', '#2563eb'].map((c, i) => `<rect x="${-118 + i * 29.5}" y="-80" width="28" height="10" fill="${c}"/><rect x="${-118 + i * 29.5}" y="70" width="28" height="10" fill="${c}"/>`).join('')}
      </g>
      <g font-size="30"><text x="80" y="70">🏠</text><text x="290" y="60">🏨</text><text x="250" y="160">🎲</text><text x="105" y="160">💰</text></g>
      <text x="200" y="112" text-anchor="middle" font-family="Space Grotesk,sans-serif" font-weight="700" font-size="34" fill="#fde68a" transform="rotate(-8 200 112)">EMPIRE</text></svg>`,
  },
  arena: {
    icon: '⚡', color: 'linear-gradient(135deg,#7c3aed,#06b6d4)', badge: 'Action 3D · temps réel',
    tags: ['👥 1–16 joueurs', '⏱ 6 min / match', '🎯 Tir', '🚪 Rejoindre en cours'],
    rules: `<ul>
      <li>Chacun pour soi : le premier à 25 éliminations gagne.</li>
      <li><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> bouger · <kbd>Espace</kbd> sauter · <kbd>Clic</kbd> tirer · <kbd>Clic droit</kbd> viser</li>
      <li><kbd>R</kbd> recharger · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> armes · <kbd>Tab</kbd> scores</li>
      <li>Ramassez soins 💚 et armures 💙, utilisez les tremplins.</li>
      <li>Ordinateur avec souris conseillé.</li></ul>`,
    art: `<svg viewBox="0 0 400 190" preserveAspectRatio="xMidYMid slice"><defs>
        <linearGradient id="as" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020617"/><stop offset=".55" stop-color="#3b0764"/><stop offset=".62" stop-color="#a21caf"/><stop offset=".63" stop-color="#0b0a24"/><stop offset="1" stop-color="#020617"/></linearGradient>
        <filter id="gl"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <rect width="400" height="190" fill="url(#as)"/>
      <g stroke="#6366f1" stroke-width="1" opacity=".7">${Array.from({ length: 17 }, (_, i) => `<line x1="200" y1="118" x2="${-200 + i * 50}" y2="190"/>`).join('')}
        ${[124, 132, 144, 160, 182].map(y => `<line x1="0" y1="${y}" x2="400" y2="${y}"/>`).join('')}</g>
      <g fill="none" stroke-width="2" filter="url(#gl)">
        <rect x="60" y="80" width="50" height="40" stroke="#22d3ee"/><rect x="290" y="70" width="60" height="50" stroke="#e879f9"/>
        <rect x="170" y="88" width="60" height="30" stroke="#facc15"/><rect x="130" y="100" width="22" height="18" stroke="#a3e635"/></g>
      <g filter="url(#gl)" stroke="#67e8f9" stroke-width="3"><line x1="320" y1="190" x2="205" y2="100"/></g>
      <g stroke="#fff" stroke-width="2"><line x1="200" y1="84" x2="200" y2="92"/><line x1="200" y1="108" x2="200" y2="116"/><line x1="184" y1="100" x2="192" y2="100"/><line x1="208" y1="100" x2="216" y2="100"/></g></svg>`,
  },
};
const info = id => GAME_INFO[id] || { icon: '🎮', color: 'var(--grad)', badge: 'Jeu', tags: [], rules: '', art: '<svg viewBox="0 0 400 190"><rect width="400" height="190" fill="#1e1b4b"/></svg>' };

// --- Notifications ---
function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2800);
}

// --- Écrans ---
function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id);
  document.body.classList.toggle('in-game', id === 'game');
  window.scrollTo(0, 0);
}

// --- Pseudo ---
let myName = localStorage.getItem('pseudo') || '';
function avatar(name, color) { return `<span class="avatar" style="${color ? `background:${color}` : ''}">${esc((name || '?').trim()[0] || '?')}</span>`; }
function renderProfile() { $('#myName').textContent = myName || 'Choisir un pseudo'; $('#myAvatar').textContent = (myName || '?')[0]; }
function askName() {
  const d = $('#nameDialog');
  $('#nameInput').value = myName;
  d.showModal();
  setTimeout(() => $('#nameInput').select(), 50);
}
$('#nameForm').onsubmit = () => {
  const v = $('#nameInput').value.trim().slice(0, 16);
  if (!v) return false;
  myName = v; localStorage.setItem('pseudo', v); renderProfile();
  sendRaw({ t: 'hello', name: v });
  if (pendingAfterName) { const f = pendingAfterName; pendingAfterName = null; f(); }
};
$('#nameDialog').addEventListener('cancel', e => { if (!myName) e.preventDefault(); });
$('#profileBtn').onclick = () => askName();
let pendingAfterName = null;
function needName(fn) { if (myName) fn(); else { pendingAfterName = fn; askName(); } }

// --- Connexion ---
let ws, myId, room = null, game = null, loading = false, pendingState = null, chatHandlers = [], games = [], rooms = [], wasInRoom = null;
function sendRaw(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }
function setStatus(ok) { $('#status').classList.toggle('on', ok); $('#status span').textContent = ok ? 'En ligne' : 'Connexion…'; }

function connect() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => {
    setStatus(true);
    if (myName) sendRaw({ t: 'hello', name: myName });
    sendRaw({ t: 'list' });
    // lien d'invitation (?salon=CODE) ou reconnexion
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
      case 'welcome': myId = m.id; games = m.games; renderGames(); break;
      case 'list': rooms = m.rooms; renderRooms(); break;
      case 'room': onRoom(m.room); break;
      case 'start': startGame(m); break;
      case 'state': if (game) game.update(m.s); else pendingState = m.s; break;
      case 'event': if (game && game.event) game.event(m.e); break;
      case 'chat': addChat(m); chatHandlers.forEach(h => h(m)); break;
      case 'error':
        toast(m.msg, 'err');
        if (!room && new URLSearchParams(location.search).get('salon')) history.replaceState(null, '', '/');
        wasInRoom = null;
        break;
      case 'left': room = null; wasInRoom = null; history.replaceState(null, '', '/'); unmountGame(); show('home'); sendRaw({ t: 'list' }); break;
    }
  };
}

// --- Accueil ---
function renderGames() {
  const el = $('#gameList'); el.innerHTML = '';
  for (const g of games) {
    const gi = info(g.id);
    const card = document.createElement('article');
    card.className = 'game-card';
    card.innerHTML = `
      <div class="game-art">${gi.art}<span class="badge">${gi.badge}</span></div>
      <div class="game-body">
        <h3>${gi.icon} ${esc(g.name)}</h3>
        <p>${esc(g.desc || '')}</p>
        <div class="tags">${gi.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
        <div class="game-actions">
          <button class="btn primary" data-create>＋ Créer un salon</button>
          <button class="btn ghost" data-quick title="Rejoint un salon ouvert, ou en crée un">⚡ Partie rapide</button>
        </div>
      </div>`;
    card.querySelector('[data-create]').onclick = () => needName(() => sendRaw({ t: 'create', game: g.id }));
    card.querySelector('[data-quick]').onclick = () => needName(() => {
      const open = rooms.filter(r => r.game === g.id && r.players.length < r.max).sort((a, b) => b.players.length - a.players.length)[0];
      sendRaw(open ? { t: 'join', code: open.code } : { t: 'create', game: g.id });
    });
    el.appendChild(card);
  }
}
function renderRooms() {
  const el = $('#roomList');
  $('#roomCount').textContent = rooms.length;
  const players = rooms.reduce((n, r) => n + r.players.length, 0);
  $('#online').textContent = players ? `${players} joueur${players > 1 ? 's' : ''} dans les salons` : '';
  if (!rooms.length) {
    el.innerHTML = `<div class="empty-rooms"><b>Aucun salon ouvert pour l'instant</b>Créez-en un et invitez vos amis !</div>`;
    return;
  }
  el.innerHTML = '';
  for (const r of rooms) {
    const gi = info(r.game), full = r.players.length >= r.max;
    const b = document.createElement('button');
    b.className = 'room'; b.disabled = full;
    b.innerHTML = `<span class="ico" style="background:${gi.color}">${gi.icon}</span>
      <span class="info"><b>${esc(r.gameName)}</b>
        <small>Salon ${r.code} · ${r.players.length}/${r.max}${r.started ? ' · en cours' : ' · en attente'}</small>
        <span class="stack">${r.players.slice(0, 6).map(p => avatar(p.name, p.color)).join('')}</span></span>
      <span class="go">${full ? 'Complet' : 'Rejoindre →'}</span>`;
    b.onclick = () => needName(() => sendRaw({ t: 'join', code: r.code }));
    el.appendChild(b);
  }
}
setInterval(() => { if (!room) sendRaw({ t: 'list' }); }, 3000);

const codeInput = $('#code');
codeInput.oninput = () => { codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, ''); };
$('#joinForm').onsubmit = e => {
  e.preventDefault();
  const code = codeInput.value.trim();
  if (code.length !== 4) { toast('Le code fait 4 lettres', 'err'); codeInput.focus(); return; }
  needName(() => sendRaw({ t: 'join', code }));
};

// --- Salon d'attente ---
const inviteLink = () => `${location.origin}/?salon=${room.code}`;
async function copy(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg, 'ok'); }
  catch { prompt('Copiez ce texte :', text); }
}
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
  room = r;
  wasInRoom = r.code;
  history.replaceState(null, '', `/?salon=${r.code}`);
  if (r.started) return;
  if (game) unmountGame();
  if (!prev || prev.code !== r.code) { $('#chatLog').innerHTML = '<p class="muted empty">Dites bonjour 👋</p>'; }
  else {
    const before = new Set(prev.players.map(p => p.id));
    const after = new Set(r.players.map(p => p.id));
    r.players.filter(p => !before.has(p.id)).forEach(p => sysChat(`${p.name} a rejoint le salon`));
    prev.players.filter(p => !after.has(p.id)).forEach(p => sysChat(`${p.name} est parti`));
  }
  renderLobby();
}

function renderLobby() {
  const gi = info(room.game);
  show('lobby');
  $('#lobbyBanner').style.background = gi.color;
  $('#lobbyGame').textContent = `${gi.icon} ${room.gameName}`;
  $('#lobbyCode').textContent = room.code;
  $('#rules').innerHTML = gi.rules || '<p class="muted">Amusez-vous bien !</p>';
  $('#playerCount').textContent = `${room.players.length}/${room.max}`;
  const slots = Math.max(0, Math.min(room.max, Math.max(room.min, 4)) - room.players.length);
  $('#lobbyPlayers').innerHTML = room.players.map(p => `
    <li class="${p.id === myId ? 'me' : ''}">${avatar(p.name, p.color)}
      <span class="who"><b>${esc(p.name)}</b><small>${p.id === room.host ? '👑 Hôte' : 'Joueur'}${p.id === myId ? ' · vous' : ''}</small></span></li>`).join('')
    + Array.from({ length: slots }, () => '<li class="slot">En attente…</li>').join('');
  const host = room.host === myId, enough = room.players.length >= room.min;
  const start = $('#startBtn');
  start.classList.toggle('hidden', !host);
  start.disabled = !enough;
  const msg = $('#lobbyInfo');
  msg.className = '';
  if (host && !enough) { msg.textContent = `Il faut au moins ${room.min} joueurs. Invitez vos amis avec le lien`; msg.className = 'waiting'; }
  else if (host) msg.textContent = 'Tout le monde est là ? Lancez la partie !';
  else { msg.textContent = `En attente que ${room.players.find(p => p.id === room.host)?.name || "l'hôte"} lance la partie`; msg.className = 'waiting'; }
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
$('#chatForm').onsubmit = e => {
  e.preventDefault();
  const i = $('#chatInput');
  if (i.value.trim()) sendRaw({ t: 'chat', text: i.value });
  i.value = '';
};

// --- Jeu ---
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
  game.mount(root, {
    myId, room, static: m.static,
    send: a => sendRaw({ t: 'action', a }),
    leave: () => sendRaw({ t: 'leave' }),
    chat: text => sendRaw({ t: 'chat', text }),
    onChat: h => chatHandlers.push(h),
    toast,
  });
  if (pendingState) { game.update(pendingState); pendingState = null; }
}
function unmountGame() {
  if (!game) return;
  try { game.unmount(); } catch (e) { console.error(e); }
  game = null; pendingState = null; chatHandlers = []; $('#game').innerHTML = '';
}

// --- Démarrage ---
renderProfile();
$('#brand').onclick = e => { e.preventDefault(); if (room) { if (confirm('Quitter le salon ?')) sendRaw({ t: 'leave' }); } else window.scrollTo({ top: 0 }); };
connect();
