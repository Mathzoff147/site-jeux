// =============================================================
//  Salle de Jeux — logique du site (navigateur)
// =============================================================
window.GAME_UI = window.GAME_UI || {};
const $ = (id) => document.getElementById(id);

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};

const AVATAR_COLORS = ['#7c5cff', '#ff5da2', '#ffb547', '#3ecf7a', '#4da3ff', '#ff4d5e', '#2ed3c6', '#c58cff', '#ff8a3d', '#9be15d'];

let ws = null;
let catalog = [];
let me = null;          // mon identifiant de joueur
let room = null;        // infos du salon
let state = null;       // état de la partie (vue reçue du serveur)
let pending = [];       // messages à envoyer dès que la connexion est prête
let currentUI = null;   // affichage du jeu en cours
let stateQueue = [];    // états reçus pas encore affichés (aucun n'est sauté)
let myColor = store.get('color') || AVATAR_COLORS[0];

// ---------- Connexion WebSocket (reconnexion automatique) ----------
function connect() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${protocol}://${location.host}/ws`);
  ws.onopen = () => {
    setConnection(true);
    const saved = JSON.parse(store.get('session') || 'null');
    if (saved) ws.send(JSON.stringify({ type: 'rejoin', code: saved.code, token: saved.token }));
    pending.forEach(m => ws.send(JSON.stringify(m)));
    pending = [];
  };
  ws.onclose = () => { setConnection(false); setTimeout(connect, 2000); };
  ws.onmessage = (e) => handle(JSON.parse(e.data));
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  else if (msg.type !== 'move') pending.push(msg);
}
window.sendRaw = send;

function setConnection(ok) {
  const el = $('connection');
  el.textContent = ok ? 'En ligne' : 'Reconnexion…';
  el.className = 'status ' + (ok ? 'ok' : 'ko');
}

// ---------- Messages du serveur ----------
function handle(msg) {
  switch (msg.type) {
    case 'joined':
      me = msg.you;
      store.set('session', JSON.stringify({ code: msg.code, token: msg.token }));
      history.replaceState(null, '', `/?code=${msg.code}`);
      $('chat-log').innerHTML = '';
      addChat('Bienvenue dans le salon ! Partage le code à tes amis.', true);
      break;
    case 'rejoin-failed':
      store.del('session');
      break;
    case 'room': {
      const wasStarted = room && room.started;
      const prevGame = room && room.game;
      room = msg;
      if (!room.started) { state = null; unmountGame(); }
      if (prevGame && prevGame !== room.game) unmountGame();
      if (room.started && !wasStarted) unmountGame();
      showRoom();
      break;
    }
    case 'state':
      state = msg.state;
      stateQueue.push(msg.state);
      renderGame();
      break;
    case 'chat':
      addChat(`<strong style="color:${colorOfName(msg.name)}">${escapeHtml(msg.name)}</strong> ${escapeHtml(msg.text)}`);
      break;
    case 'info':
      addChat(escapeHtml(msg.message), true);
      break;
    case 'error':
      toast(msg.message);
      break;
  }
}

// ---------- Accueil ----------
async function loadCatalog() {
  catalog = await (await fetch('/api/games')).json();
  const cats = ['Tous', ...new Set(catalog.map(g => g.category))];
  $('filters').innerHTML = cats.map((c, i) => `<button class="${i === 0 ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('');
  $('filters').onclick = (e) => {
    if (!e.target.dataset.cat) return;
    [...$('filters').children].forEach(b => b.classList.toggle('active', b === e.target));
    renderCatalog();
  };
  $('search').oninput = renderCatalog;
  renderCatalog();
  if (room) showRoom();
}

function renderCatalog() {
  const cat = ($('filters').querySelector('.active') || {}).dataset?.cat || 'Tous';
  const q = $('search').value.trim().toLowerCase();
  const list = catalog.filter(g => (cat === 'Tous' || g.category === cat) && (!q || (g.name + g.description + g.category).toLowerCase().includes(q)));
  $('catalog').innerHTML = list.map(g => `
    <article class="card glass" style="--card-color:${g.color}">
      <div class="card-art">${g.realtime ? '<span class="badge-rt">⚡ Temps réel</span>' : ''}<span class="big-icon">${g.icon}</span></div>
      <div class="card-body">
        <span class="tag">${g.category}</span>
        <h3>${g.name}</h3>
        <p>${g.description}</p>
        <div class="card-foot">
          <span class="meta">👥 ${g.minPlayers === g.maxPlayers ? g.minPlayers : g.minPlayers + '–' + g.maxPlayers} joueurs</span>
          <div class="card-buttons">
            <button class="btn small ghost" data-rules="${g.id}" title="Règles">?</button>
            <button class="btn small" data-game="${g.id}">Jouer</button>
          </div>
        </div>
      </div>
    </article>`).join('') || '<p class="muted">Aucun jeu ne correspond à ta recherche.</p>';
}

$('catalog').onclick = (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.rules) return showRules(btn.dataset.rules);
  if (btn.dataset.game) send({ type: 'create', game: btn.dataset.game, name: getName(), color: myColor });
};

async function refreshRooms() {
  if (!$('view-room').classList.contains('hidden')) return;
  try {
    const data = await (await fetch('/api/rooms')).json();
    $('online').textContent = `🟢 ${data.online} en ligne · ${data.playing} partie${data.playing > 1 ? 's' : ''} en cours`;
    $('open-rooms-section').classList.toggle('hidden', !data.rooms.length);
    $('open-rooms').innerHTML = data.rooms.map(r => {
      const g = catalog.find(x => x.id === r.game) || { icon: '🎲', name: r.game };
      return `<div class="room-chip glass"><span class="ic">${g.icon}</span>
        <div style="flex:1"><strong>${g.name}</strong><span class="muted">${escapeHtml(r.host || '')} · ${r.players}/${r.max}</span></div>
        <button class="btn small" data-join="${r.code}">Rejoindre</button></div>`;
    }).join('');
  } catch (e) {}
}
$('open-rooms').onclick = (e) => {
  const code = e.target.dataset.join;
  if (code) send({ type: 'join', code, name: getName(), color: myColor });
};

$('join-form').onsubmit = (e) => {
  e.preventDefault();
  const code = $('join-code').value.trim().toUpperCase();
  if (code.length === 4) send({ type: 'join', code, name: getName(), color: myColor });
  else toast('Le code fait 4 lettres.');
};

function getName() {
  const name = $('name').value.trim() || 'Joueur';
  store.set('name', name);
  return name;
}

function renderAvatarPicker() {
  $('swatches').innerHTML = AVATAR_COLORS.map(c => `<button class="swatch ${c === myColor ? 'active' : ''}" style="background:${c}" data-color="${c}" aria-label="Couleur ${c}"></button>`).join('');
  const prev = $('avatar-preview');
  prev.style.background = myColor; prev.style.color = myColor;
  prev.innerHTML = `<span style="color:#fff">${escapeHtml(($('name').value.trim()[0] || '?').toUpperCase())}</span>`;
}
$('swatches').onclick = (e) => {
  if (!e.target.dataset.color) return;
  myColor = e.target.dataset.color; store.set('color', myColor); renderAvatarPicker();
};
$('name').oninput = renderAvatarPicker;

// ---------- Règles ----------
function showRules(id) {
  const g = catalog.find(x => x.id === id);
  if (!g) return;
  $('modal-content').innerHTML = `<h2><span>${g.icon}</span>${g.name}</h2>
    <p class="muted">${g.category} · ${g.minPlayers === g.maxPlayers ? g.minPlayers : g.minPlayers + ' à ' + g.maxPlayers} joueurs${g.realtime ? ' · temps réel' : ''}</p>
    <p>${g.rules}</p>`;
  $('modal').classList.remove('hidden');
}
$('modal-close').onclick = () => $('modal').classList.add('hidden');
$('modal').onclick = (e) => { if (e.target.id === 'modal') $('modal').classList.add('hidden'); };
$('show-rules').onclick = () => room && showRules(room.game);

// ---------- Salon ----------
function showRoom() {
  $('view-home').classList.add('hidden');
  $('view-room').classList.remove('hidden');
  const game = catalog.find(g => g.id === room.game) || { name: room.game, icon: '🎲', minPlayers: 2, maxPlayers: 2, color: '#7c5cff' };
  $('room-game-name').textContent = game.name;
  $('room-icon').textContent = game.icon;
  $('room-icon').style.background = `radial-gradient(circle at 30% 20%, ${game.color}, #1d2342 75%)`;
  $('room-code').textContent = room.code;
  $('lobby-art').textContent = game.icon;
  $('player-count').textContent = `${room.players.length}/${game.maxPlayers}`;
  document.title = `${game.name} — Salle de Jeux`;

  $('players').innerHTML = room.players.map(p => `
    <li class="${p.connected ? '' : 'off'}">
      <span class="avatar" style="background:${p.color}">${escapeHtml((p.name[0] || '?').toUpperCase())}</span>
      <span style="flex:1">${escapeHtml(p.name)} ${p.id === room.hostId ? '👑' : ''}</span>
      ${p.id === me ? '<span class="you">toi</span>' : ''}${p.connected ? '' : '<span class="muted">⏳</span>'}
    </li>`).join('');

  const isHost = room.hostId === me;
  $('stop-game').classList.toggle('hidden', !isHost || !room.started);
  $('fullscreen').classList.toggle('hidden', !room.started || !game.realtime);

  if (!room.started) {
    $('lobby').classList.remove('hidden');
    $('game').classList.add('hidden');
    const missing = game.minPlayers - room.players.length;
    $('lobby-text').innerHTML = missing > 0
      ? `En attente de joueurs… Donne le code <strong class="code">${room.code}</strong> à tes amis (encore ${missing} joueur${missing > 1 ? 's' : ''} minimum).`
      : isHost ? `Tout le monde est là ? Lance la partie ! (${room.players.length}/${game.maxPlayers} joueurs)`
               : "En attente que l'hôte 👑 lance la partie…";
    $('start').classList.toggle('hidden', !isHost || missing > 0);
  } else {
    $('lobby').classList.add('hidden');
    $('game').classList.remove('hidden');
    renderGame();
  }
}

// Charge le fichier d'affichage d'un jeu à la demande
const loading = {};
function loadUI(id) {
  if (window.GAME_UI[id]) return Promise.resolve(window.GAME_UI[id]);
  if (!loading[id]) loading[id] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `/games/${id}.js`;
    s.onload = () => resolve(window.GAME_UI[id]);
    s.onerror = reject;
    document.body.appendChild(s);
  });
  return loading[id];
}

function unmountGame() {
  stateQueue = [];
  if (currentUI && currentUI.unmount) currentUI.unmount();
  currentUI = null;
  $('board').innerHTML = '';
  $('board').onclick = null;
}

function gameCtx() {
  const myIndex = room.players.findIndex(p => p.id === me);
  return {
    me: myIndex,
    names: room.players.map(p => p.name),
    colors: room.players.map(p => p.color),
    isHost: room.hostId === me,
    send: (move) => send({ type: 'move', move }),
    toast,
  };
}

async function renderGame() {
  if (!room || !state || !room.started) return;
  const gameId = room.game;
  const ui = await loadUI(gameId);
  if (!room || !state || room.game !== gameId) return;
  currentUI = ui;
  const ctx = gameCtx();

  let status = '';
  if (state.over) {
    status = state.resultText || (state.winner === -1 ? '🤝 Match nul !'
      : state.winner === ctx.me ? '🏆 Tu as gagné !'
      : state.winner >= 0 ? `🏆 ${ctx.names[state.winner]} a gagné !` : 'Partie terminée');
  } else if (state.statusText) status = state.statusText;
  else if (typeof state.turn === 'number' && state.turn >= 0) status = state.turn === ctx.me ? "👉 C'est ton tour !" : `⏳ Au tour de ${ctx.names[state.turn]}…`;
  const color = state.turn >= 0 ? ctx.colors[state.turn] : 'var(--text)';
  $('game-status').innerHTML = status ? `<span style="color:${state.over ? 'var(--amber)' : color}">${escapeHtml(status)}</span>` : '';

  // On affiche chaque état reçu, dans l'ordre (certains jeux envoient des différences)
  const batch = stateQueue.length ? stateQueue.splice(0) : [state];
  for (const s of batch) { try { ui.render($('board'), s, ctx); } catch (e) { console.error(e); } }
  $('end-actions').classList.toggle('hidden', !state.over || room.hostId !== me);
}

$('start').onclick = () => send({ type: 'start' });
$('rematch').onclick = () => { unmountGame(); send({ type: 'rematch' }); };
$('to-lobby').onclick = () => send({ type: 'lobby' });
$('stop-game').onclick = () => { if (confirm('Terminer la partie pour tout le monde ?')) send({ type: 'lobby' }); };
$('leave').onclick = () => {
  send({ type: 'leave' });
  store.del('session');
  location.href = '/';
};
$('fullscreen').onclick = () => {
  const el = $('room-main');
  if (document.fullscreenElement) document.exitFullscreen();
  else if (el.requestFullscreen) el.requestFullscreen();
};
$('copy-link').onclick = async () => {
  const link = `${location.origin}/?code=${room.code}`;
  try { await navigator.clipboard.writeText(link); toast('Lien copié ! Envoie-le à tes amis.', true); }
  catch (e) { prompt('Copie ce lien :', link); }
};
$('chat-form').onsubmit = (e) => {
  e.preventDefault();
  const text = $('chat-input').value.trim();
  if (text) send({ type: 'chat', text });
  $('chat-input').value = '';
};

// ---------- Outils ----------
function colorOfName(name) {
  const p = room && room.players.find(x => x.name === name);
  return p ? p.color : 'var(--text)';
}

function addChat(html, system = false) {
  const div = document.createElement('div');
  if (system) div.className = 'sys';
  div.innerHTML = html;
  $('chat-log').appendChild(div);
  $('chat-log').scrollTop = $('chat-log').scrollHeight;
}

let toastTimer;
function toast(text, good = false) {
  $('toast').textContent = text;
  $('toast').className = 'toast' + (good ? ' good' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 3000);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
window.escapeHtml = escapeHtml;

// ---------- Démarrage ----------
$('name').value = store.get('name') || '';
renderAvatarPicker();
const codeInUrl = new URLSearchParams(location.search).get('code');
if (codeInUrl) {
  $('join-code').value = codeInUrl;
  const saved = JSON.parse(store.get('session') || 'null');
  if (saved && saved.code !== codeInUrl.toUpperCase()) store.del('session');
}
loadCatalog();
refreshRooms();
setInterval(refreshRooms, 5000);
connect();
