// =====================================================================
//  Client du site : accueil, salons, et chargement du jeu.
//
//  Interface d'un jeu côté navigateur (public/games/monjeu.js) :
//    export default {
//      mount(root, api)   // api = { myId, room, static, send(action), leave(), chat(text), onChat }
//      update(state)      // nouvel état reçu du serveur
//      event(e)           // évènement ponctuel (son, effet…)
//      unmount()
//    }
// =====================================================================
const $ = s => document.querySelector(s);
const show = id => { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id); };
const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600); };

let ws, myId, room = null, game = null, loading = false, pendingState = null, chatHandlers = [];
const name = $('#name');
name.value = localStorage.getItem('pseudo') || 'Joueur' + Math.floor(Math.random() * 1000);
name.onchange = () => { localStorage.setItem('pseudo', name.value); sendRaw({ t: 'hello', name: name.value }); };

function sendRaw(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }

function connect() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => { sendRaw({ t: 'hello', name: name.value }); sendRaw({ t: 'list' }); };
  ws.onclose = () => { toast('Connexion perdue… reconnexion'); unmountGame(); show('home'); setTimeout(connect, 1500); };
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    switch (m.t) {
      case 'welcome': myId = m.id; renderGames(m.games); break;
      case 'list': renderRooms(m.rooms); break;
      case 'room': room = m.room; if (!room.started) { unmountGame(); renderLobby(); } break;
      case 'start': startGame(m); break;
      case 'state': if (game) game.update(m.s); else pendingState = m.s; break;
      case 'event': if (game && game.event) game.event(m.e); break;
      case 'chat': chatHandlers.forEach(h => h(m)); break;
      case 'error': toast(m.msg); break;
      case 'left': room = null; unmountGame(); show('home'); sendRaw({ t: 'list' }); break;
    }
  };
}

function renderGames(games) {
  const el = $('#gameList'); el.innerHTML = '';
  for (const g of games) {
    const b = document.createElement('button');
    b.className = 'gameBtn';
    b.innerHTML = `<b>${g.name}</b><span>${g.desc || ''} · ${g.min}–${g.max} joueurs</span>`;
    b.onclick = () => sendRaw({ t: 'create', game: g.id });
    el.appendChild(b);
  }
}
function renderRooms(list) {
  const el = $('#roomList'); el.innerHTML = '';
  for (const r of list) {
    const b = document.createElement('button');
    b.textContent = `${r.code} — ${r.gameName} (${r.players.length}/${r.max})${r.started ? ' · en cours' : ''}`;
    b.onclick = () => sendRaw({ t: 'join', code: r.code });
    el.appendChild(b);
  }
}
setInterval(() => { if (!room) sendRaw({ t: 'list' }); }, 4000);

$('#joinBtn').onclick = () => sendRaw({ t: 'join', code: $('#code').value });
$('#code').onkeydown = e => { if (e.key === 'Enter') $('#joinBtn').click(); };
$('#startBtn').onclick = () => sendRaw({ t: 'start' });
$('#leaveBtn').onclick = () => sendRaw({ t: 'leave' });

function renderLobby() {
  show('lobby');
  $('#lobbyGame').textContent = room.gameName;
  $('#lobbyCode').textContent = room.code;
  $('#lobbyPlayers').innerHTML = room.players.map(p =>
    `<li><span class="dot" style="background:${p.color}"></span>${p.name}${p.id === room.host ? ' 👑' : ''}${p.id === myId ? ' (vous)' : ''}</li>`).join('');
  const host = room.host === myId;
  $('#startBtn').classList.toggle('hidden', !host);
  $('#startBtn').disabled = room.players.length < room.min;
  $('#lobbyInfo').textContent = host
    ? (room.players.length < room.min ? `En attente d'au moins ${room.min} joueurs…` : 'Prêt ! Lancez quand vous voulez.')
    : "En attente de l'hôte…";
}

async function startGame(m) {
  if (game || loading) return;
  loading = true;
  const mod = await import(`./games/${m.game}.js`);
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
  game = null; pendingState = null; $('#game').innerHTML = '';
}

connect();
