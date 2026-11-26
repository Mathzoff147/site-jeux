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
const P = require('./server/platform');
const C = require('./server/content');
const A = require('./server/admin');
A.autoPromote();

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
    settings: room.settings, ranked: !!room.ranked, rankedAllowed: C.RANKED.includes(room.gameId),
    players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, color: p.color, uid: p.uid || null, ...(p.profile || {}) })),
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
  checkResults(room);
}

// ---------- Enregistrement des résultats (comptes joueurs) ----------
function notify(uid, list) { if (!list?.length) return; for (const c of online.get(uid) || []) send(c.ws, { t: 'notif', list }); }
function checkResults(room) {
  const g = GAMES[room.gameId];
  try {
    const r = g.results?.(room.state);
    if (r && r.key !== room.lastResult) {
      room.lastResult = r.key;
      const byId = id => room.players.get(id);
      const players = r.players.filter(p => byId(p.id)).map(p => ({ ...p, uid: byId(p.id)?.uid || null }));
      const humans = players.filter(p => p.uid).length;
      if (humans) {
        const notes = P.recordResults({ game: room.gameId, total: r.players.length, players, ranked: !!room.ranked && humans >= 2, duration: (Date.now() - (room.startedAt || Date.now())) / 1000,
          records: (r.records || []).map(x => ({ uid: byId(x.id)?.uid, key: x.key, value: x.value })).filter(x => x.uid) });
        for (const [uid, list] of notes) { notify(uid, list); refreshProfile(uid); }
      }
      room.startedAt = Date.now();
    }
    // records continus (jeux sans fin de partie)
    if (g.records && Date.now() - (room.lastRecords || 0) > 10000) {
      room.lastRecords = Date.now();
      for (const x of g.records(room.state) || []) { const uid = room.players.get(x.id)?.uid; if (uid) notify(uid, P.saveRecord(uid, x.key, x.value)); }
    }
  } catch (e) { console.error('résultats', e); }
}
function refreshProfile(uid) { const u = P.me(uid); for (const c of online.get(uid) || []) { c.profile = profileBits(u); send(c.ws, { t: 'me', user: u }); } }
function profileBits(u) { return u ? { role: u.role, avatar: u.avatar, level: u.level, rank: u.rank?.icon, title: u.title, nameColor: u.nameColor, frame: u.frame, clanTag: u.clan?.tag || null } : {}; }

function startGame(room) {
  const g = GAMES[room.gameId];
  room.ctx = makeCtx(room);
  const players = [...room.players.values()].map(p => ({ id: p.id, name: p.name, color: p.color }));
  room.state = g.create(players, room.ctx, { ...room.settings });
  room.startedAt = Date.now(); room.lastResult = null;
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
  voiceLeave(client);
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
  const client = { id: crypto.randomBytes(4).toString('hex'), name: 'Joueur', ws, room: null, uid: null };
  send(ws, { t: 'welcome', id: client.id, games: gameList() });
  if (A.announcement()) send(ws, { t: 'announce', a: A.announcement() });
  clients.add(client);
  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const err = msg => send(ws, { t: 'error', msg });
    switch (m.t) {
      case 'hello': {
        let uid = m.token ? P.byToken(m.token) : null;
        const ban = uid && A.banInfo(uid);
        if (ban) { send(ws, { t: 'kicked', msg: `Compte suspendu : ${ban.reason}` }); uid = null; }
        if (uid) {
          setUser(client, uid);
          const season = P.checkSeason(P.userRow(uid));
          send(ws, { t: 'me', user: P.me(uid), token: m.token });
          if (season) notify(uid, [season]);
        } else {
          if (m.token) send(ws, { t: 'me', user: null });
          if (!client.uid) client.name = String(m.name || 'Joueur').replace(/[<>]/g, '').slice(0, 16) || 'Joueur';
        }
        if (client.room) { client.room.players.set(client.id, client); broadcastRoom(client.room); }
        break;
      }
      case 'api': {
        let data, error;
        try { data = api(client, String(m.m), m.a || {}); } catch (e) { error = e.message || 'Erreur'; if (!(e instanceof Error) || !e.message) console.error(e); }
        send(ws, { t: 'api', id: m.id, ok: !error, data, error });
        break;
      }
      case 'ranked': {
        const room = client.room;
        if (!room || room.hostId !== client.id || room.state || !C.RANKED.includes(room.gameId)) return;
        room.ranked = !!m.on; broadcastRoom(room);
        break;
      }
      case 'voice': voice(client, m); break;
      case 'list':
        send(ws, { t: 'list', rooms: [...rooms.values()].filter(r => !r.state || GAMES[r.gameId].joinInProgress).map(roomInfo) });
        break;
      case 'create': {
        if (!GAMES[m.game]) return err('Jeu inconnu');
        if (A.disabledGames().includes(m.game) && !A.can(client.uid, 'admin')) return err('Ce jeu est temporairement désactivé');
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
        if (A.isMuted(client.uid)) return err('🔇 Vous êtes en sourdine : vous ne pouvez pas écrire pour le moment');
        for (const p of room.players.values()) send(p.ws, { t: 'chat', from: client.name, color: client.profile?.nameColor || client.color, text });
        break;
      }
    }
  });
  ws.on('close', () => { leaveRoom(client); setUser(client, null); clients.delete(client); });
});

function joinRoom(client, room) {
  const used = new Set([...room.players.values()].map(p => p.color));
  const skin = client.uid ? P.me(client.uid)?.color : null; // couleur achetée en boutique
  client.color = skin && !used.has(skin) ? skin : COLORS.find(c => !used.has(c)) || COLORS[0];
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

// ---------- Présence ----------
const online = new Map(); // uid -> Set(client)
function setUser(client, uid) {
  if (client.uid) { const set = online.get(client.uid); set?.delete(client); if (set && !set.size) { online.delete(client.uid); presence(client.uid, false); } }
  client.uid = uid;
  if (uid) {
    const u = P.me(uid); client.name = u.name; client.profile = profileBits(u);
    if (!online.has(uid)) { online.set(uid, new Set()); presence(uid, true); }
    online.get(uid).add(client); P.seen(uid);
  } else client.profile = null;
}
function presence(uid, on) { try { for (const f of P.friendList(uid, () => false).friends) notifyRaw(f.id, { t: 'presence', id: uid, on }); } catch { } }
function notifyRaw(uid, msg) { for (const c of online.get(uid) || []) send(c.ws, msg); }
const isOnline = uid => online.has(uid);

// ---------- Requêtes de la plateforme ----------
function api(client, m, a) {
  const uid = client.uid;
  const need = () => { if (!uid) throw new Error('Connectez-vous pour utiliser cette fonction'); return uid; };
  if (m.startsWith('admin.')) { need(); return A.api(uid, m, a, adminCtx); }
  if (['dm', 'clanSay'].includes(m) && A.isMuted(uid)) throw new Error('🔇 Vous êtes en sourdine : vous ne pouvez pas écrire pour le moment');
  switch (m) {
    case 'register': case 'login': {
      const r = m === 'register' ? P.register(a.name, a.pass) : P.login(a.name, a.pass);
      const ban = A.banInfo(r.user.id);
      if (ban) { P.logout(r.token); throw new Error(`Compte suspendu${ban.until ? ` jusqu’au ${new Date(ban.until).toLocaleString('fr-FR')}` : ''} : ${ban.reason}`); }
      setUser(client, r.user.id);
      if (client.room) broadcastRoom(client.room);
      const season = P.checkSeason(P.userRow(r.user.id)); if (season) notify(r.user.id, [season]);
      return { token: r.token, user: P.me(r.user.id) };
    }
    case 'logout': if (a.token) P.logout(a.token); setUser(client, null); client.name = 'Invité'; return true;
    case 'me': return uid ? P.me(uid) : null;
    case 'home': return { stats: P.stats(), popularity: P.popularity(), news: A.news().slice(0, 3), tournaments: P.tournaments().filter(t => !t.past), online: online.size, top: P.leaderboards().xp.slice(0, 5) };
    case 'profile': { const pr = P.profile(a.name || P.userRow(need()).name); return { ...pr, online: isOnline(pr.user.id), games: C.GAMES }; }
    case 'updateProfile': { const u = P.updateProfile(need(), a); refreshProfile(uid); return u; }
    case 'favorite': return P.toggleFavorite(need(), String(a.game));
    case 'daily': { const r = P.claimDaily(need()); notify(uid, r.notes); refreshProfile(uid); return r; }
    case 'challenges': return P.dailyChallenges(need());
    case 'claimChallenge': { const r = P.claimChallenge(need(), String(a.id)); notify(uid, r.notes); refreshProfile(uid); return r; }
    case 'shop': return { items: C.ITEMS, me: uid ? P.me(uid) : null };
    case 'buy': { const u = P.buy(need(), String(a.id)); refreshProfile(uid); return u; }
    case 'equip': { const u = P.equip(need(), a.id || null, a.slot); refreshProfile(uid); if (client.room) broadcastRoom(client.room); return u; }
    case 'leaderboards': return { ...P.leaderboards(), games: C.GAMES };
    case 'tournaments': return { list: P.tournaments(), games: C.GAMES };
    case 'friends': return P.friendList(need(), isOnline);
    case 'addFriend': { const r = P.addFriend(need(), a.name); notify(r.other, [{ type: r.accepted ? 'friendOk' : 'friend', name: client.name }]); return P.friendList(uid, isOnline); }
    case 'answerFriend': { P.answerFriend(need(), +a.id, !!a.accept); if (a.accept) notify(+a.id, [{ type: 'friendOk', name: client.name }]); return P.friendList(uid, isOnline); }
    case 'removeFriend': P.removeFriend(need(), +a.id); return P.friendList(uid, isOnline);
    case 'dm': { const msg = P.sendDm(need(), +a.to, a.text); notifyRaw(+a.to, { t: 'dm', msg, name: client.name }); return msg; }
    case 'conversation': return P.conversation(need(), +a.with);
    case 'clan': { const id = a.id || P.userRow(need()).clan_id; return id ? P.clanInfo(+id) : null; }
    case 'clans': return P.clanList(a.search);
    case 'createClan': { const c = P.createClan(need(), a.name, a.tag, a.descr, a.emblem); refreshProfile(uid); return c; }
    case 'joinClan': { const c = P.joinClan(need(), +a.id); refreshProfile(uid); return c; }
    case 'leaveClan': P.leaveClan(need()); refreshProfile(uid); return true;
    case 'clanSay': { const r = P.clanSay(need(), a.text); for (const mb of P.clanInfo(r.clan).members) notifyRaw(mb.id, { t: 'clan', msg: r.msg }); return r.msg; }
    case 'search': return P.searchUsers(a.q).map(u => ({ ...u, online: isOnline(u.id) }));
    case 'news': return { news: A.news(), faq: C.FAQ };
    case 'ticket': P.ticket(uid, a); return true;
    case 'invite': {
      need(); if (!client.room) throw new Error('Créez ou rejoignez d’abord un salon');
      if (!P.areFriends(uid, +a.to)) throw new Error('Vous ne pouvez inviter que vos amis');
      if (!isOnline(+a.to)) throw new Error('Cet ami n’est pas en ligne');
      notifyRaw(+a.to, { t: 'invite', from: client.name, code: client.room.code, game: GAMES[client.room.gameId].name, icon: GAMES[client.room.gameId].icon });
      return true;
    }
    default: throw new Error('Requête inconnue');
  }
}

// ---------- Outils pour l'administration ----------
const clients = new Set();
function gameList() { const off = A.disabledGames(); return GAME_LIST.map(g => ({ ...g, disabled: off.includes(g.id) })); }
const adminCtx = {
  online,
  notify,
  refresh: uid => refreshProfile(uid),
  rooms: () => [...rooms.values()].map(r => ({ code: r.code, game: r.gameId, gameName: GAMES[r.gameId].name, started: !!r.state, ranked: !!r.ranked, host: r.hostId,
    players: [...r.players.values()].map(p => ({ id: p.id, name: p.name, uid: p.uid })) })),
  kick(uid, msg) { for (const c of [...(online.get(uid) || [])]) { send(c.ws, { t: 'kicked', msg }); leaveRoom(c); setUser(c, null); } },
  closeRoom(code, reason) {
    const r = rooms.get(code); if (!r) throw new Error('Salon introuvable');
    for (const c of [...r.players.values()]) { send(c.ws, { t: 'error', msg: `Salon fermé par la modération${reason ? ' : ' + reason : ''}` }); leaveRoom(c); send(c.ws, { t: 'left' }); }
  },
  kickFromRoom(code, pid) {
    const r = rooms.get(code); const c = r?.players.get(pid); if (!c) throw new Error('Joueur introuvable');
    send(c.ws, { t: 'error', msg: 'Vous avez été exclu du salon par la modération' }); leaveRoom(c); send(c.ws, { t: 'left' });
  },
  broadcast(msg) { for (const c of clients) send(c.ws, msg); },
  gamesChanged() { const list = gameList(); for (const c of clients) send(c.ws, { t: 'games', games: list }); },
};

// ---------- Chat vocal (relais de signalisation WebRTC, par salon) ----------
function voice(client, m) {
  const room = client.room; if (!room) return;
  room.voice ||= new Set();
  if (m.a === 'join') {
    send(client.ws, { t: 'voice', a: 'peers', peers: [...room.voice].map(id => ({ id, name: room.players.get(id)?.name })) });
    room.voice.add(client.id);
    for (const id of room.voice) if (id !== client.id) send(room.players.get(id)?.ws, { t: 'voice', a: 'joined', id: client.id, name: client.name });
    broadcastVoice(room);
  } else if (m.a === 'leave') voiceLeave(client);
  else if (m.a === 'signal' && room.voice.has(client.id) && room.voice.has(m.to)) send(room.players.get(m.to)?.ws, { t: 'voice', a: 'signal', from: client.id, data: m.data });
  else if (m.a === 'speaking') for (const p of room.players.values()) send(p.ws, { t: 'voice', a: 'speaking', id: client.id, on: !!m.on });
}
function voiceLeave(client) {
  const room = client.room; if (!room?.voice?.has(client.id)) return;
  room.voice.delete(client.id);
  for (const id of room.voice) send(room.players.get(id)?.ws, { t: 'voice', a: 'left', id: client.id });
  broadcastVoice(room);
}
function broadcastVoice(room) { const list = [...room.voice]; for (const p of room.players.values()) send(p.ws, { t: 'voice', a: 'members', ids: list }); }

server.listen(PORT, () => console.log(`Serveur prêt : http://localhost:${PORT}`));
