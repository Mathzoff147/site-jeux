// =============================================================
//  Logique du site côté navigateur : connexion, salons, affichage
// =============================================================

window.GAME_UI = window.GAME_UI || {};
const $ = (id) => document.getElementById(id);

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};

let ws = null;
let catalog = [];
let me = null;        // mon identifiant de joueur
let room = null;      // infos du salon
let state = null;     // état de la partie
let pending = null;   // action à envoyer dès que la connexion est prête

// ---------- Connexion WebSocket (avec reconnexion automatique) ----------
function connect() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${protocol}://${location.host}/ws`);

  ws.onopen = () => {
    setConnection(true);
    const saved = JSON.parse(store.get('session') || 'null');
    if (saved) send({ type: 'rejoin', code: saved.code, token: saved.token });
    if (pending) { send(pending); pending = null; }
  };
  ws.onclose = () => {
    setConnection(false);
    setTimeout(connect, 2000);
  };
  ws.onmessage = (e) => handle(JSON.parse(e.data));
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  else pending = msg;
}

function setConnection(ok) {
  const el = $('connection');
  el.textContent = ok ? 'En ligne' : 'Reconnexion…';
  el.className = 'status ' + (ok ? 'ok' : 'ko');
}

// ---------- Messages reçus du serveur ----------
function handle(msg) {
  switch (msg.type) {
    case 'joined':
      me = msg.you;
      store.set('session', JSON.stringify({ code: msg.code, token: msg.token }));
      history.replaceState(null, '', `/?code=${msg.code}`);
      $('chat-log').innerHTML = '';
      break;
    case 'rejoin-failed':
      store.del('session');
      break;
    case 'room':
      room = msg;
      if (!room.started) state = null;
      showRoom();
      break;
    case 'state':
      state = msg.state;
      renderGame();
      break;
    case 'chat':
      addChat(`<strong>${escapeHtml(msg.name)} :</strong> ${escapeHtml(msg.text)}`);
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
  const categories = ['Tous', ...new Set(catalog.map(g => g.category))];
  $('filters').innerHTML = categories
    .map((c, i) => `<button class="${i === 0 ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('');
  $('filters').onclick = (e) => {
    const cat = e.target.dataset.cat;
    if (!cat) return;
    [...$('filters').children].forEach(b => b.classList.toggle('active', b === e.target));
    renderCatalog(cat);
  };
  renderCatalog('Tous');
}

function renderCatalog(cat) {
  $('catalog').innerHTML = catalog
    .filter(g => cat === 'Tous' || g.category === cat)
    .map(g => `
      <div class="card">
        <span class="tag">${g.category}</span>
        <h3>${g.name}</h3>
        <p>${g.description}</p>
        <span class="meta">${g.minPlayers === g.maxPlayers ? g.minPlayers : g.minPlayers + ' à ' + g.maxPlayers} joueurs</span>
        <button data-game="${g.id}">Créer une partie</button>
      </div>`).join('');
}

$('catalog').onclick = (e) => {
  const gameId = e.target.dataset.game;
  if (gameId) send({ type: 'create', game: gameId, name: getName() });
};

$('join-form').onsubmit = (e) => {
  e.preventDefault();
  const code = $('join-code').value.trim().toUpperCase();
  if (code.length === 4) send({ type: 'join', code, name: getName() });
  else toast('Le code fait 4 lettres.');
};

function getName() {
  const name = $('name').value.trim() || 'Joueur';
  store.set('name', name);
  return name;
}

// ---------- Salon ----------
function showRoom() {
  $('view-home').classList.add('hidden');
  $('view-room').classList.remove('hidden');

  const game = catalog.find(g => g.id === room.game);
  $('room-game-name').textContent = game ? game.name : room.game;
  $('room-code').textContent = room.code;

  $('players').innerHTML = room.players.map((p, i) => `
    <li class="${p.connected ? '' : 'off'}">
      <span class="dot" style="background:var(--p${i % 4})"></span>
      ${escapeHtml(p.name)}${p.id === me ? ' (toi)' : ''}${p.id === room.hostId ? ' 👑' : ''}
      ${p.connected ? '' : '<span class="muted">— déconnecté</span>'}
    </li>`).join('');

  const isHost = room.hostId === me;
  if (!room.started) {
    $('lobby').classList.remove('hidden');
    $('game').classList.add('hidden');
    const min = game ? game.minPlayers : 2;
    const max = game ? game.maxPlayers : 2;
    const missing = min - room.players.length;
    $('lobby-text').textContent = missing > 0
      ? `En attente de joueurs… Partage le code ${room.code} (encore ${missing} joueur${missing > 1 ? 's' : ''} minimum).`
      : isHost ? `Tout le monde est là ? Lance la partie (${room.players.length}/${max} joueurs).`
               : "En attente que l'hôte lance la partie…";
    $('start').classList.toggle('hidden', !isHost || missing > 0);
  } else {
    $('lobby').classList.add('hidden');
    $('game').classList.remove('hidden');
    renderGame();
  }
}

function renderGame() {
  if (!room || !state) return;
  const ui = window.GAME_UI[room.game];
  const myIndex = room.players.findIndex(p => p.id === me);
  const ctx = {
    me: myIndex,
    names: room.players.map(p => p.name),
    send: (move) => send({ type: 'move', move }),
  };

  let status;
  if (state.over) {
    status = state.winner === -1 ? 'Match nul !'
      : state.winner === myIndex ? '🏆 Tu as gagné !'
      : `${ctx.names[state.winner]} a gagné.`;
  } else {
    status = state.turn === myIndex ? "C'est ton tour !" : `Au tour de ${ctx.names[state.turn]}…`;
  }
  $('game-status').innerHTML = `<span class="p${state.over ? state.winner : state.turn}">${escapeHtml(status)}</span>`;

  ui.render($('board'), state, ctx);
  $('end-actions').classList.toggle('hidden', !state.over || room.hostId !== me);
}

$('start').onclick = () => send({ type: 'start' });
$('rematch').onclick = () => send({ type: 'rematch' });
$('to-lobby').onclick = () => send({ type: 'lobby' });
$('leave').onclick = () => {
  send({ type: 'leave' });
  store.del('session');
  location.href = '/';
};
$('copy-link').onclick = async () => {
  const link = `${location.origin}/?code=${room.code}`;
  try { await navigator.clipboard.writeText(link); toast('Lien copié !'); }
  catch (e) { prompt('Copie ce lien :', link); }
};
$('chat-form').onsubmit = (e) => {
  e.preventDefault();
  const text = $('chat-input').value.trim();
  if (text) send({ type: 'chat', text });
  $('chat-input').value = '';
};

// ---------- Outils ----------
function addChat(html, system = false) {
  const div = document.createElement('div');
  if (system) div.className = 'sys';
  div.innerHTML = html;
  $('chat-log').appendChild(div);
  $('chat-log').scrollTop = $('chat-log').scrollHeight;
}

let toastTimer;
function toast(text) {
  $('toast').textContent = text;
  $('toast').classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 3000);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
window.escapeHtml = escapeHtml;

// ---------- Démarrage ----------
$('name').value = store.get('name') || '';
const codeInUrl = new URLSearchParams(location.search).get('code');
if (codeInUrl) {
  $('join-code').value = codeInUrl;
  // Lien vers un autre salon que celui mémorisé : on oublie l'ancien
  const saved = JSON.parse(store.get('session') || 'null');
  if (saved && saved.code !== codeInUrl.toUpperCase()) store.del('session');
}
loadCatalog();
connect();
