// =============================================================
//  Serveur du site de jeux multijoueur
//  - sert les pages du dossier public/
//  - gère les salons et les parties via WebSocket (/ws)
//  Aucune dépendance externe : seulement Node.js (version 18 ou plus)
// =============================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// ---------- Chargement automatique des jeux (dossier games/) ----------
const GAMES = {};
for (const file of fs.readdirSync(path.join(__dirname, 'games'))) {
  if (!file.endsWith('.js')) continue;
  const game = require(path.join(__dirname, 'games', file));
  GAMES[game.id] = game;
}
console.log('Jeux chargés :', Object.keys(GAMES).join(', '));

// ---------- Serveur HTTP (fichiers statiques + API) ----------
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // Liste des jeux pour la page d'accueil
  if (url.pathname === '/api/games') {
    const list = Object.values(GAMES).map(g => ({
      id: g.id, name: g.name, description: g.description,
      category: g.category, minPlayers: g.minPlayers, maxPlayers: g.maxPlayers,
    }));
    res.writeHead(200, { 'Content-Type': TYPES['.json'] });
    return res.end(JSON.stringify(list));
  }

  // Petit point de contrôle pour l'hébergeur
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }

  // Fichiers statiques (protégés contre les chemins du type ../../)
  let filePath = path.normalize(path.join(PUBLIC_DIR, decodeURIComponent(url.pathname)));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  if (url.pathname.endsWith('/')) filePath = path.join(filePath, 'index.html');

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Page introuvable'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---------- WebSocket minimal (protocole RFC 6455) ----------
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!req.url.startsWith('/ws') || !key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  socket.setNoDelay(true);
  onConnection(createConnection(socket));
});

function createConnection(socket) {
  const conn = { socket, alive: true, open: true, onMessage: () => {}, onClose: () => {} };
  let buffer = Buffer.alloc(0);
  let fragments = [];

  conn.send = (obj) => {
    if (!conn.open) return;
    sendFrame(socket, 0x1, Buffer.from(JSON.stringify(obj)));
  };
  conn.close = () => {
    if (!conn.open) return;
    try { sendFrame(socket, 0x8, Buffer.alloc(0)); } catch (e) {}
    socket.end();
  };

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const fin = (buffer[0] & 0x80) !== 0;
      const opcode = buffer[0] & 0x0f;
      const masked = (buffer[1] & 0x80) !== 0;
      let len = buffer[1] & 0x7f;
      let offset = 2;
      if (len === 126) { if (buffer.length < 4) return; len = buffer.readUInt16BE(2); offset = 4; }
      else if (len === 127) { if (buffer.length < 10) return; len = Number(buffer.readBigUInt64BE(2)); offset = 10; }
      if (len > 1024 * 1024) { socket.destroy(); return; } // message trop gros
      const maskLen = masked ? 4 : 0;
      if (buffer.length < offset + maskLen + len) return; // on attend la suite
      let payload = buffer.subarray(offset + maskLen, offset + maskLen + len);
      if (masked) {
        const mask = buffer.subarray(offset, offset + 4);
        payload = Buffer.from(payload.map((b, i) => b ^ mask[i % 4]));
      }
      buffer = buffer.subarray(offset + maskLen + len);

      if (opcode === 0x8) { conn.close(); return; }                    // fermeture
      if (opcode === 0x9) { sendFrame(socket, 0xA, payload); continue; } // ping -> pong
      if (opcode === 0xA) { conn.alive = true; continue; }               // pong
      if (opcode === 0x1 || opcode === 0x0) {                            // texte
        fragments.push(payload);
        if (fin) {
          const text = Buffer.concat(fragments).toString('utf8');
          fragments = [];
          try { conn.onMessage(JSON.parse(text)); } catch (e) { /* message invalide ignoré */ }
        }
      }
    }
  });

  const finish = () => { if (conn.open) { conn.open = false; conn.onClose(); } };
  socket.on('close', finish);
  socket.on('end', finish);
  socket.on('error', finish);
  return conn;
}

function sendFrame(socket, opcode, payload) {
  const len = payload.length;
  let header;
  if (len < 126) header = Buffer.from([0x80 | opcode, len]);
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
  socket.write(Buffer.concat([header, payload]));
}

// Ping toutes les 25 s : détecte les joueurs déconnectés
// et garde le serveur éveillé pendant une partie
const connections = new Set();
setInterval(() => {
  for (const conn of connections) {
    if (!conn.alive) { conn.socket.destroy(); continue; }
    conn.alive = false;
    try { sendFrame(conn.socket, 0x9, Buffer.alloc(0)); } catch (e) {}
  }
}, 25000);

// ---------- Salons et parties ----------
const rooms = new Map(); // code -> salon

function makeCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sans I ni O (confusion avec 1 et 0)
  let code;
  do { code = Array.from({ length: 4 }, () => letters[crypto.randomInt(letters.length)]).join(''); }
  while (rooms.has(code));
  return code;
}

function cleanName(name) {
  const n = String(name || '').trim().slice(0, 20);
  return n || 'Joueur';
}

function roomInfo(room) {
  return {
    type: 'room',
    code: room.code,
    game: room.gameId,
    hostId: room.hostId,
    started: room.started,
    players: room.players.map(p => ({ id: p.id, name: p.name, connected: !!p.conn })),
  };
}

function broadcast(room, msg) {
  for (const p of room.players) if (p.conn) p.conn.send(msg);
}

function sendState(room) {
  broadcast(room, { type: 'state', state: room.state });
}

function startGame(room) {
  const game = GAMES[room.gameId];
  room.state = game.setup(room.players.length);
  room.started = true;
  broadcast(room, roomInfo(room));
  sendState(room);
}

function removePlayer(room, player) {
  room.players = room.players.filter(p => p !== player);
  if (room.players.length === 0) { rooms.delete(room.code); return; }
  if (room.hostId === player.id) room.hostId = room.players[0].id;
  if (room.started) {
    // Un joueur quitte une partie en cours : la partie s'arrête
    room.started = false;
    room.state = null;
    broadcast(room, { type: 'info', message: `${player.name} a quitté la partie. Retour au salon.` });
  }
  broadcast(room, roomInfo(room));
}

function onConnection(conn) {
  connections.add(conn);
  let room = null;
  let player = null;

  const error = (message) => conn.send({ type: 'error', message });

  const enter = (r, p) => {
    room = r; player = p; p.conn = conn;
    conn.send({ type: 'joined', code: r.code, you: p.id, token: p.token });
    broadcast(r, roomInfo(r));
    if (r.started) conn.send({ type: 'state', state: r.state });
  };

  conn.onMessage = (msg) => {
    if (!msg || typeof msg.type !== 'string') return;

    switch (msg.type) {
      case 'create': {
        if (room) return error('Tu es déjà dans un salon.');
        const game = GAMES[msg.game];
        if (!game) return error('Jeu inconnu.');
        const r = { code: makeCode(), gameId: game.id, players: [], hostId: null, started: false, state: null };
        const p = { id: crypto.randomUUID(), token: crypto.randomUUID(), name: cleanName(msg.name), conn: null };
        r.players.push(p); r.hostId = p.id;
        rooms.set(r.code, r);
        enter(r, p);
        break;
      }

      case 'join': {
        if (room) return error('Tu es déjà dans un salon.');
        const r = rooms.get(String(msg.code || '').toUpperCase().trim());
        if (!r) return error('Aucune partie avec ce code.');
        if (r.started) return error('La partie a déjà commencé.');
        if (r.players.length >= GAMES[r.gameId].maxPlayers) return error('Le salon est complet.');
        const p = { id: crypto.randomUUID(), token: crypto.randomUUID(), name: cleanName(msg.name), conn: null };
        r.players.push(p);
        enter(r, p);
        break;
      }

      case 'rejoin': { // après un rafraîchissement de page ou une coupure
        if (room) return;
        const r = rooms.get(String(msg.code || ''));
        const p = r && r.players.find(x => x.token === msg.token);
        if (!p) return conn.send({ type: 'rejoin-failed' });
        if (p.conn && p.conn !== conn) p.conn.close();
        clearTimeout(p.leaveTimer);
        enter(r, p);
        break;
      }

      case 'start': {
        if (!room || room.hostId !== player.id) return error("Seul l'hôte peut lancer la partie.");
        const game = GAMES[room.gameId];
        if (room.players.length < game.minPlayers) return error(`Il faut au moins ${game.minPlayers} joueurs.`);
        startGame(room);
        break;
      }

      case 'move': {
        if (!room || !room.started || !room.state) return;
        const index = room.players.indexOf(player);
        const err = GAMES[room.gameId].move(room.state, index, msg.move || {});
        if (err) return error(err);
        sendState(room);
        break;
      }

      case 'rematch': {
        if (!room || room.hostId !== player.id) return;
        startGame(room);
        break;
      }

      case 'lobby': { // l'hôte ramène tout le monde au salon
        if (!room || room.hostId !== player.id) return;
        room.started = false; room.state = null;
        broadcast(room, roomInfo(room));
        break;
      }

      case 'chat': {
        if (!room) return;
        const text = String(msg.text || '').trim().slice(0, 200);
        if (text) broadcast(room, { type: 'chat', name: player.name, text });
        break;
      }

      case 'leave': {
        if (!room) return;
        const r = room; const p = player;
        room = null; player = null; p.conn = null;
        removePlayer(r, p);
        break;
      }
    }
  };

  conn.onClose = () => {
    connections.delete(conn);
    if (!room || !player || player.conn !== conn) return;
    const r = room; const p = player;
    p.conn = null;
    broadcast(r, roomInfo(r));
    // On laisse 60 s au joueur pour revenir (rafraîchissement, coupure Wi-Fi...)
    p.leaveTimer = setTimeout(() => { if (!p.conn && r.players.includes(p)) removePlayer(r, p); }, 60000);
  };
}

server.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
