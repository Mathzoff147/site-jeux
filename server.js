// =====================================================================
//  Serveur de jeux multijoueur
//  - sert les fichiers du dossier public/ (le site)
//  - charge automatiquement chaque jeu du dossier games/
//  - gère les salons (code à 4 lettres), les joueurs et le WebSocket
//
//  Interface d'un jeu côté serveur (games/monjeu.js) :
//    module.exports = {
//      id, name, minPlayers, maxPlayers,
//      tickRate,             // (optionnel) nb de tick() par seconde
//      joinInProgress,       // (optionnel) on peut rejoindre une partie lancée
//      create(players, ctx)  -> état initial
//      onJoin(state, player, ctx), onLeave(state, playerId, ctx)
//      onAction(state, playerId, action, ctx)
//      tick(state, dt, ctx)  // (optionnel)
//      view(state, playerId) -> ce qu'on envoie à ce joueur
//      staticData(state)     // (optionnel) données envoyées une seule fois
//    }
//  ctx.emit(event, toPlayerId?) envoie un évènement ponctuel (son, effet…)
// =====================================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

// ---------- Chargement des jeux ----------
const GAMES = {};
for (const f of fs.readdirSync(path.join(__dirname, 'games'))) {
  if (!f.endsWith('.js')) continue;
  const g = require(path.join(__dirname, 'games', f));
  GAMES[g.id] = g;
  console.log(`Jeu chargé : ${g.name} (${g.id})`);
}

// Liste envoyée au navigateur (fiche de chaque jeu)
const GAME_LIST = Object.values(GAMES).sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).map(g => ({
  id: g.id, name: g.name, desc: g.description, min: g.minPlayers, max: g.maxPlayers,
  category: g.category || 'Autres', icon: g.icon || '🎮', color: g.color || '#7c6cff',
  tags: g.tags || [], rules: g.rules || '', joinInProgress: !!g.joinInProgress,
  settings: g.settings || [],
}));

// ---------- Paramètres réglables par l'hôte ----------
// Dans un jeu : settings: [{ key, label, type: 'select'|'number'|'toggle', options: [{ v, l }], min, max, step, default, help }]
function defaultSettings(g) { return Object.fromEntries((g.settings || []).map(o => [o.key, o.default])); }
function cleanSettings(g, input, current) {
  const out = { ...current };
  for (const o of g.settings || []) {
    if (!input || !(o.key in input)) continue;
    let v = input[o.key];
    if (o.type === 'toggle') v = !!v;
    else if (o.type === 'number') { v = Number(v); if (!Number.isFinite(v)) continue; v = Math.min(o.max ?? Infinity, Math.max(o.min ?? -Infinity, v)); if (o.step) v = Math.round(v / o.step) * o.step; }
    else if (o.type === 'select') { if (!o.options.some(x => String(x.v) === String(v))) continue; v = o.options.find(x => String(x.v) === String(v)).v; }
    out[o.key] = v;
  }
  return out;
}

// ---------- Serveur HTTP statique ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
};
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  // Three.js (moteur 3D) servi depuis node_modules
  let base = PUBLIC;
  if (url.startsWith('/vendor/three/')) { base = path.join(__dirname, 'node_modules', 'three'); url = url.slice('/vendor/three'.length); }
  const file = path.normalize(path.join(base, url));
  if (!file.startsWith(base)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Introuvable'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---------- Salons ----------
const rooms = new Map(); // code -> room
const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899',
  '#84cc16', '#f43f5e', '#14b8a6', '#8b5cf6', '#facc15', '#fb923c', '#38bdf8', '#e879f9'];

function makeCode() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do { c = Array.from({ length: 4 }, () => L[Math.floor(Math.random() * L.length)]).join(''); } while (rooms.has(c));
  return c;
}

function send(ws, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }

function roomInfo(room) {
  return {
    code: room.code, game: room.gameId, gameName: GAMES[room.gameId].name,
    host: room.hostId, started: !!room.state,
    min: GAMES[room.gameId].minPlayers, max: GAMES[room.gameId].maxPlayers,
    settings: room.settings,
    players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, color: p.color })),
  };
}
function broadcastRoom(room) { const info = roomInfo(room); for (const p of room.players.values()) send(p.ws, { t: 'room', room: info }); }

function makeCtx(room) {
  return {
    emit(e, to) {
      for (const p of room.players.values()) if (to === undefined || to === p.id) send(p.ws, { t: 'event', e });
    },
    now: () => Date.now(),
  };
}

function broadcastState(room) {
  if (!room.state) return;
  const g = GAMES[room.gameId];
  for (const p of room.players.values()) {
    try { send(p.ws, { t: 'state', s: g.view(room.state, p.id) }); } catch (e) { console.error(e); }
  }
}

function startGame(room) {
  const g = GAMES[room.gameId];
  room.ctx = makeCtx(room);
  const players = [...room.players.values()].map(p => ({ id: p.id, name: p.name, color: p.color }));
  room.state = g.create(players, room.ctx, { ...room.settings });
  const stat = g.staticData ? g.staticData(room.state) : null;
  for (const p of room.players.values()) send(p.ws, { t: 'start', game: room.gameId, static: stat });
  broadcastRoom(room);
  broadcastState(room);
  if (g.tickRate) {
    let last = Date.now();
    room.timer = setInterval(() => {
      const now = Date.now(); const dt = (now - last) / 1000; last = now;
      try { g.tick(room.state, dt, room.ctx); } catch (e) { console.error(e); }
      broadcastState(room);
    }, 1000 / g.tickRate);
  }
}

function leaveRoom(client) {
  const room = client.room;
  if (!room) return;
  room.players.delete(client.id);
  client.room = null;
  if (room.players.size === 0) {
    clearInterval(room.timer);
    rooms.delete(room.code);
    return;
  }
  if (room.hostId === client.id) room.hostId = room.players.keys().next().value;
  if (room.state) {
    try { GAMES[room.gameId].onLeave(room.state, client.id, room.ctx); } catch (e) { console.error(e); }
    broadcastState(room);
  }
  broadcastRoom(room);
}

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server });
wss.on('connection', ws => {
  const client = { id: crypto.randomBytes(4).toString('hex'), name: 'Joueur', ws, room: null };
  send(ws, { t: 'welcome', id: client.id, games: GAME_LIST });
  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const err = msg => send(ws, { t: 'error', msg });
    switch (m.t) {
      case 'hello':
        client.name = String(m.name || 'Joueur').replace(/[<>]/g, '').slice(0, 16) || 'Joueur';
        break;
      case 'list':
        send(ws, { t: 'list', rooms: [...rooms.values()].filter(r => !r.state || GAMES[r.gameId].joinInProgress).map(roomInfo) });
        break;
      case 'create': {
        if (!GAMES[m.game]) return err('Jeu inconnu');
        leaveRoom(client);
        const room = { code: makeCode(), gameId: m.game, hostId: client.id, players: new Map(), state: null, settings: defaultSettings(GAMES[m.game]) };
        rooms.set(room.code, room);
        joinRoom(client, room);
        break;
      }
      case 'join': {
        const room = rooms.get(String(m.code || '').toUpperCase());
        if (!room) return err('Salon introuvable');
        const g = GAMES[room.gameId];
        if (room.players.size >= g.maxPlayers) return err('Salon complet');
        if (room.state && !g.joinInProgress) return err('La partie a déjà commencé');
        leaveRoom(client);
        joinRoom(client, room);
        break;
      }
      case 'start': {
        const room = client.room;
        if (!room || room.hostId !== client.id || room.state) return;
        const g = GAMES[room.gameId];
        if (room.players.size < g.minPlayers) return err(`Il faut au moins ${g.minPlayers} joueurs`);
        startGame(room);
        break;
      }
      case 'settings': {
        const room = client.room;
        if (!room || room.hostId !== client.id || room.state) return;
        room.settings = cleanSettings(GAMES[room.gameId], m.settings, room.settings);
        broadcastRoom(room);
        break;
      }
      case 'lobby': { // l'hôte ramène tout le monde au salon (rejouer)
        const room = client.room;
        if (!room || room.hostId !== client.id || !room.state) return;
        clearInterval(room.timer); room.timer = null; room.state = null;
        broadcastRoom(room);
        break;
      }
      case 'leave':
        leaveRoom(client);
        send(ws, { t: 'left' });
        break;
      case 'action': {
        const room = client.room;
        if (!room || !room.state || !m.a || typeof m.a !== 'object') return;
        const g = GAMES[room.gameId];
        let r;
        try { r = g.onAction(room.state, client.id, m.a, room.ctx); } catch (e) { console.error(e); return; }
        if (r && r.error) err(r.error);
        // Les jeux "temps réel" diffusent l'état à chaque tick ; les autres à chaque action.
        if (!g.tickRate || g.broadcastOnAction) broadcastState(room);
        break;
      }
      case 'chat': {
        const room = client.room;
        if (!room) return;
        const text = String(m.text || '').slice(0, 200);
        if (!text.trim()) return;
        for (const p of room.players.values()) send(p.ws, { t: 'chat', from: client.name, color: client.color, text });
        break;
      }
    }
  });
  ws.on('close', () => leaveRoom(client));
});

function joinRoom(client, room) {
  const used = new Set([...room.players.values()].map(p => p.color));
  client.color = COLORS.find(c => !used.has(c)) || COLORS[0];
  room.players.set(client.id, client);
  client.room = room;
  broadcastRoom(room);
  if (room.state) { // arrivée en cours de partie
    const g = GAMES[room.gameId];
    g.onJoin(room.state, { id: client.id, name: client.name, color: client.color }, room.ctx);
    send(client.ws, { t: 'start', game: room.gameId, static: g.staticData ? g.staticData(room.state) : null });
    broadcastState(room);
  }
}

server.listen(PORT, () => console.log(`Serveur prêt : http://localhost:${PORT}`));
