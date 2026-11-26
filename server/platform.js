// =====================================================================
//  Plateforme : comptes, profils, progression, succès, défis, économie,
//  boutique, amis, messages privés, clans, classements, tournois,
//  parties classées et saisons. Données dans data/salle.db (SQLite).
// =====================================================================
process.removeAllListeners('warning');
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const C = require('./content');

const DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DIR, { recursive: true });
const db = new DatabaseSync(path.join(DIR, 'salle.db'));
db.exec(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE COLLATE NOCASE, pass TEXT, salt TEXT, created INTEGER,
  bio TEXT DEFAULT '', avatar TEXT DEFAULT '{}', xp INTEGER DEFAULT 0, coins INTEGER DEFAULT 200, games INTEGER DEFAULT 0, wins INTEGER DEFAULT 0,
  last_daily TEXT DEFAULT '', streak INTEGER DEFAULT 0, rating INTEGER DEFAULT 1000, peak INTEGER DEFAULT 1000, season TEXT DEFAULT '', rated INTEGER DEFAULT 0,
  favorites TEXT DEFAULT '[]', owned TEXT DEFAULT '[]', equipped TEXT DEFAULT '{}', clan_id INTEGER, last_seen INTEGER, playtime INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER, created INTEGER);
CREATE TABLE IF NOT EXISTS game_stats (user_id INTEGER, game TEXT, played INTEGER DEFAULT 0, wins INTEGER DEFAULT 0, PRIMARY KEY (user_id, game));
CREATE TABLE IF NOT EXISTS records (user_id INTEGER, key TEXT, value REAL, at INTEGER, PRIMARY KEY (user_id, key));
CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, game TEXT, at INTEGER, place INTEGER, total INTEGER, win INTEGER, score TEXT, ranked INTEGER DEFAULT 0, delta INTEGER DEFAULT 0, xp INTEGER DEFAULT 0, coins INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS achievements (user_id INTEGER, ach TEXT, at INTEGER, PRIMARY KEY (user_id, ach));
CREATE TABLE IF NOT EXISTS challenges (user_id INTEGER, day TEXT, cid TEXT, progress INTEGER DEFAULT 0, claimed INTEGER DEFAULT 0, PRIMARY KEY (user_id, day, cid));
CREATE TABLE IF NOT EXISTS friends (a INTEGER, b INTEGER, status TEXT, at INTEGER, PRIMARY KEY (a, b));
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, from_id INTEGER, to_id INTEGER, text TEXT, at INTEGER, read INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS clans (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE COLLATE NOCASE, tag TEXT, owner INTEGER, descr TEXT, emblem TEXT, created INTEGER);
CREATE TABLE IF NOT EXISTS clan_msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, clan_id INTEGER, user_id INTEGER, text TEXT, at INTEGER);
CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT, contact TEXT, subject TEXT, text TEXT, at INTEGER);
CREATE TABLE IF NOT EXISTS tour_entries (tid TEXT, user_id INTEGER, value REAL, at INTEGER, PRIMARY KEY (tid, user_id));
CREATE TABLE IF NOT EXISTS tour_done (tid TEXT PRIMARY KEY, at INTEGER);
CREATE TABLE IF NOT EXISTS game_counts (game TEXT PRIMARY KEY, played INTEGER DEFAULT 0);
CREATE INDEX IF NOT EXISTS hist_user ON history(user_id, at);
CREATE INDEX IF NOT EXISTS msg_pair ON messages(from_id, to_id, at);
`);
const q = sql => db.prepare(sql);
const now = () => Date.now();
const today = () => new Date().toISOString().slice(0, 10);
const seasonId = () => new Date().toISOString().slice(0, 7);
const J = (s, d) => { try { return JSON.parse(s); } catch { return d; } };

// ---------------- Niveaux, rangs ----------------
const xpForLevel = l => Math.round(100 * Math.pow(l, 1.5));
function levelOf(xp) { let l = 1, need = xpForLevel(1); while (xp >= need) { xp -= need; l++; need = xpForLevel(l); } return { level: l, cur: xp, next: need }; }
function rankOf(r) { return C.RANKS.slice().reverse().find(k => r >= k.min) || C.RANKS[0]; }

// ---------------- Comptes ----------------
const hash = (pass, salt) => crypto.scryptSync(String(pass), salt, 32).toString('hex');
function register(name, pass) {
  name = String(name || '').trim();
  if (!/^[\p{L}\p{N}_\-. ]{3,16}$/u.test(name)) throw new Error('Pseudo : 3 à 16 caractères (lettres, chiffres, _ - .)');
  if (String(pass || '').length < 6) throw new Error('Mot de passe : 6 caractères minimum');
  if (q('SELECT 1 FROM users WHERE name = ?').get(name)) throw new Error('Ce pseudo est déjà pris');
  const salt = crypto.randomBytes(12).toString('hex');
  const avatar = JSON.stringify({ emoji: C.pick(['😎', '🦊', '🐼', '🐸', '🦁', '🐙', '🤖', '👾']), bg: C.pick(['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#ef4444']), frame: 'none' });
  const r = q('INSERT INTO users (name, pass, salt, created, avatar, season, last_seen, owned, equipped) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(name, hash(pass, salt), salt, now(), avatar, seasonId(), now(), '["color_default"]', '{"color":"color_default"}');
  return session(Number(r.lastInsertRowid));
}
function login(name, pass) {
  const u = q('SELECT * FROM users WHERE name = ?').get(String(name || '').trim());
  if (!u || hash(pass, u.salt) !== u.pass) throw new Error('Pseudo ou mot de passe incorrect');
  return session(u.id);
}
function session(uid) { const token = crypto.randomBytes(24).toString('hex'); q('INSERT INTO sessions VALUES (?, ?, ?)').run(token, uid, now()); return { token, user: me(uid) }; }
function byToken(token) { const s = token && q('SELECT user_id FROM sessions WHERE token = ?').get(String(token)); return s ? s.user_id : null; }
function logout(token) { q('DELETE FROM sessions WHERE token = ?').run(String(token)); }
const userRow = id => q('SELECT * FROM users WHERE id = ?').get(id);
const userByName = n => q('SELECT * FROM users WHERE name = ?').get(String(n));

// Saison : réinitialisation douce du classement + récompense
function checkSeason(u) {
  const cur = seasonId();
  if (u.season === cur) return null;
  const rank = rankOf(u.rating);
  const reward = u.rated ? rank.reward : 0;
  q('UPDATE users SET season = ?, rating = ?, rated = 0, coins = coins + ? WHERE id = ?').run(cur, Math.round(1000 + (u.rating - 1000) / 2), reward, u.id);
  return reward ? { type: 'season', rank: rank.name, coins: reward } : null;
}

// Profil public (et privé pour soi)
function publicUser(u, full) {
  if (!u) return null;
  const lv = levelOf(u.xp), clan = u.clan_id ? q('SELECT id, name, tag, emblem FROM clans WHERE id = ?').get(u.clan_id) : null;
  const eq = J(u.equipped, {});
  const out = { id: u.id, name: u.name, role: u.role || 'user', bio: u.bio, avatar: J(u.avatar, {}), level: lv.level, xp: u.xp, xpCur: lv.cur, xpNext: lv.next, games: u.games, wins: u.wins,
    rating: u.rating, peak: u.peak, rank: rankOf(u.rating), rated: u.rated, clan, title: eq.title ? C.ITEM[eq.title]?.name : null, nameColor: eq.namecolor ? C.ITEM[eq.namecolor]?.value : null,
    frame: eq.frame ? C.ITEM[eq.frame]?.value : null, color: C.ITEM[eq.color]?.value || null, created: u.created, lastSeen: u.last_seen, playtime: u.playtime, favorites: J(u.favorites, []) };
  if (full) Object.assign(out, { coins: u.coins, owned: J(u.owned, []), equipped: eq, streak: u.streak, dailyReady: u.last_daily !== today() });
  return out;
}
function me(uid) { return publicUser(userRow(uid), true); }

function profile(name) {
  const u = userByName(name); if (!u) throw new Error('Joueur introuvable');
  const stats = q('SELECT game, played, wins FROM game_stats WHERE user_id = ? ORDER BY played DESC').all(u.id);
  const recs = q('SELECT key, value, at FROM records WHERE user_id = ?').all(u.id);
  const hist = q('SELECT * FROM history WHERE user_id = ? ORDER BY at DESC LIMIT 25').all(u.id);
  const ach = q('SELECT ach, at FROM achievements WHERE user_id = ?').all(u.id);
  return { user: publicUser(u), stats, records: recs.map(r => ({ ...r, ...C.recordInfo(r.key) })), history: hist, achievements: ach, allAch: C.ACHIEVEMENTS.map(a => ({ id: a.id, name: a.name, desc: a.desc, icon: a.icon, coins: a.coins })) };
}
function updateProfile(uid, a) {
  const u = userRow(uid);
  const bio = String(a.bio ?? u.bio).slice(0, 200);
  const av = J(u.avatar, {});
  if (a.avatar) { const prem = C.ITEMS.find(i => i.slot === 'emoji' && i.value === a.avatar.emoji); if (C.EMOJIS.includes(a.avatar.emoji) && (!prem || J(u.owned, []).includes(prem.id))) av.emoji = a.avatar.emoji; if (/^#[0-9a-f]{6}$/i.test(a.avatar.bg || '')) av.bg = a.avatar.bg; }
  q('UPDATE users SET bio = ?, avatar = ? WHERE id = ?').run(bio, JSON.stringify(av), uid);
  return me(uid);
}
function toggleFavorite(uid, game) {
  const f = new Set(J(userRow(uid).favorites, []));
  f.has(game) ? f.delete(game) : f.add(game);
  q('UPDATE users SET favorites = ? WHERE id = ?').run(JSON.stringify([...f].slice(0, 30)), uid);
  return [...f];
}

// ---------------- Économie ----------------
function addCoins(uid, n) { q('UPDATE users SET coins = coins + ? WHERE id = ?').run(n, uid); }
function claimDaily(uid) {
  const u = userRow(uid); if (u.last_daily === today()) throw new Error('Déjà récupérée aujourd’hui');
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const streak = u.last_daily === y ? u.streak + 1 : 1;
  const coins = 50 + Math.min(streak, 7) * 25, xp = 25 + Math.min(streak, 7) * 10;
  q('UPDATE users SET last_daily = ?, streak = ?, coins = coins + ?, xp = xp + ? WHERE id = ?').run(today(), streak, coins, xp, uid);
  const notes = checkAchievements(uid);
  return { coins, xp, streak, notes, user: me(uid) };
}
function buy(uid, itemId) {
  const it = C.ITEM[itemId]; if (!it) throw new Error('Objet inconnu');
  const u = userRow(uid), owned = J(u.owned, []);
  if (owned.includes(itemId)) throw new Error('Déjà possédé');
  if (it.level && levelOf(u.xp).level < it.level) throw new Error(`Niveau ${it.level} requis`);
  if (u.coins < it.price) throw new Error('Pas assez de pièces');
  owned.push(itemId);
  q('UPDATE users SET coins = coins - ?, owned = ? WHERE id = ?').run(it.price, JSON.stringify(owned), uid);
  checkAchievements(uid);
  return me(uid);
}
function equip(uid, itemId, slot) {
  const u = userRow(uid), owned = J(u.owned, []), eq = J(u.equipped, {});
  if (itemId) { const it = C.ITEM[itemId]; if (!it || !owned.includes(itemId)) throw new Error('Objet non possédé'); eq[it.slot] = itemId; if (it.slot === 'frame') { const av = J(u.avatar, {}); av.frame = it.value; q('UPDATE users SET avatar = ? WHERE id = ?').run(JSON.stringify(av), uid); } }
  else if (slot) delete eq[slot];
  q('UPDATE users SET equipped = ? WHERE id = ?').run(JSON.stringify(eq), uid);
  return me(uid);
}

// ---------------- Succès ----------------
function unlock(uid, id) {
  const a = C.ACHIEVEMENTS.find(x => x.id === id); if (!a) return null;
  const r = q('INSERT OR IGNORE INTO achievements VALUES (?, ?, ?)').run(uid, id, now());
  if (!r.changes) return null;
  q('UPDATE users SET coins = coins + ?, xp = xp + ? WHERE id = ?').run(a.coins || 0, a.xp || 50, uid);
  return { type: 'achievement', id, name: a.name, icon: a.icon, coins: a.coins };
}
function checkAchievements(uid, ctx = {}) {
  const u = userRow(uid), lv = levelOf(u.xp).level, out = [];
  const friends = q("SELECT COUNT(*) n FROM friends WHERE (a = ? OR b = ?) AND status = 'ok'").get(uid, uid).n;
  const distinct = q('SELECT COUNT(*) n FROM game_stats WHERE user_id = ? AND played > 0').get(uid).n;
  const owned = J(u.owned, []).length;
  const facts = { games: u.games, wins: u.wins, level: lv, coins: u.coins, friends, distinct, owned, clan: !!u.clan_id, rating: u.rating, streak: u.streak, ...ctx };
  for (const a of C.ACHIEVEMENTS) if (a.test && a.test(facts)) { const n = unlock(uid, a.id); if (n) out.push(n); }
  return out;
}

// ---------------- Défis quotidiens ----------------
function dailyChallenges(uid) {
  const day = today(), list = C.challengesFor(day);
  return list.map(c => { const r = q('SELECT progress, claimed FROM challenges WHERE user_id = ? AND day = ? AND cid = ?').get(uid, day, c.id) || { progress: 0, claimed: 0 }; return { ...c, test: undefined, progress: Math.min(c.goal, r.progress), claimed: !!r.claimed }; });
}
function bumpChallenges(uid, ev) {
  const day = today(), done = [];
  for (const c of C.challengesFor(day)) {
    const inc = c.test(ev); if (!inc) continue;
    q('INSERT INTO challenges (user_id, day, cid, progress) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, day, cid) DO UPDATE SET progress = progress + excluded.progress').run(uid, day, c.id, inc);
    const r = q('SELECT progress FROM challenges WHERE user_id = ? AND day = ? AND cid = ?').get(uid, day, c.id);
    if (r.progress >= c.goal && r.progress - inc < c.goal) done.push({ type: 'challenge', name: c.name });
  }
  return done;
}
function claimChallenge(uid, cid) {
  const day = today(), c = C.challengesFor(day).find(x => x.id === cid); if (!c) throw new Error('Défi inconnu');
  const r = q('SELECT progress, claimed FROM challenges WHERE user_id = ? AND day = ? AND cid = ?').get(uid, day, cid);
  if (!r || r.progress < c.goal) throw new Error('Défi pas encore réussi');
  if (r.claimed) throw new Error('Déjà récupéré');
  q('UPDATE challenges SET claimed = 1 WHERE user_id = ? AND day = ? AND cid = ?').run(uid, day, cid);
  q('UPDATE users SET coins = coins + ?, xp = xp + ? WHERE id = ?').run(c.coins, c.xp, uid);
  const all = C.challengesFor(day).every(x => q('SELECT claimed FROM challenges WHERE user_id = ? AND day = ? AND cid = ?').get(uid, day, x.id)?.claimed);
  const notes = all ? [unlock(uid, 'daily_all')].filter(Boolean) : [];
  return { user: me(uid), challenges: dailyChallenges(uid), notes };
}

// ---------------- Résultats de parties ----------------
// r = { game, key, players: [{ uid, place, win, score, stats }], total, ranked, records: [{ uid, key, value, dir }] }
function recordResults(r) {
  const notes = new Map(), push = (uid, n) => { if (!n) return; if (!notes.has(uid)) notes.set(uid, []); notes.get(uid).push(n); };
  q('INSERT INTO game_counts (game, played) VALUES (?, 1) ON CONFLICT(game) DO UPDATE SET played = played + 1').run(r.game);
  const rated = r.ranked ? r.players.filter(p => p.uid) : [];
  const deltas = new Map();
  if (rated.length >= 2) {
    // Elo multijoueur selon le classement
    const K = 40 / (rated.length - 1);
    for (const a of rated) {
      let d = 0; const ra = userRow(a.uid).rating;
      for (const b of rated) { if (a === b) continue; const rb = userRow(b.uid).rating; const exp = 1 / (1 + Math.pow(10, (rb - ra) / 400)); const score = a.place < b.place ? 1 : a.place === b.place ? 0.5 : 0; d += K * (score - exp); }
      deltas.set(a.uid, Math.round(d));
    }
  }
  for (const p of r.players) {
    if (!p.uid) continue;
    const u0 = userRow(p.uid); if (!u0) continue;
    const lvBefore = levelOf(u0.xp).level;
    const xp = 20 + (p.win ? 40 : 0) + Math.max(0, (r.total - p.place) * 5);
    const coins = 10 + (p.win ? 30 : 0) + (r.ranked && p.win ? 20 : 0);
    const d = deltas.get(p.uid) || 0;
    q('UPDATE users SET xp = xp + ?, coins = coins + ?, games = games + 1, wins = wins + ?, rating = MAX(0, rating + ?), peak = MAX(peak, rating + ?), rated = rated + ?, playtime = playtime + ? WHERE id = ?')
      .run(xp, coins, p.win ? 1 : 0, d, d, deltas.has(p.uid) ? 1 : 0, Math.round(r.duration || 0), p.uid);
    q('INSERT INTO game_stats (user_id, game, played, wins) VALUES (?, ?, 1, ?) ON CONFLICT(user_id, game) DO UPDATE SET played = played + 1, wins = wins + excluded.wins').run(p.uid, r.game, p.win ? 1 : 0);
    q('INSERT INTO history (user_id, game, at, place, total, win, score, ranked, delta, xp, coins) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(p.uid, r.game, now(), p.place, r.total, p.win ? 1 : 0, String(p.score ?? ''), deltas.has(p.uid) ? 1 : 0, d, xp, coins);
    push(p.uid, { type: 'result', game: r.game, win: !!p.win, place: p.place, total: r.total, xp, coins, delta: deltas.has(p.uid) ? d : null });
    const lvAfter = levelOf(userRow(p.uid).xp).level;
    if (lvAfter > lvBefore) { const bonus = lvAfter * 20; addCoins(p.uid, bonus); push(p.uid, { type: 'level', level: lvAfter, coins: bonus }); }
    for (const n of bumpChallenges(p.uid, { game: r.game, win: !!p.win, place: p.place, total: r.total, ranked: deltas.has(p.uid), category: C.CATEGORY[r.game] })) push(p.uid, n);
    for (const n of checkAchievements(p.uid, { lastGame: r.game, lastWin: !!p.win, lastRanked: deltas.has(p.uid) })) push(p.uid, n);
  }
  for (const rec of r.records || []) for (const n of saveRecord(rec.uid, rec.key, rec.value)) push(rec.uid, n);
  return notes;
}
function saveRecord(uid, key, value) {
  if (!uid || !Number.isFinite(value)) return [];
  const info = C.recordInfo(key), old = q('SELECT value FROM records WHERE user_id = ? AND key = ?').get(uid, key), out = [];
  const better = !old || (info.dir === 'min' ? value < old.value : value > old.value);
  if (better) {
    q('INSERT INTO records (user_id, key, value, at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, at = excluded.at').run(uid, key, value, now());
    if (old) out.push({ type: 'record', label: info.label, value: info.fmt(value) });
    for (const n of checkAchievements(uid, { record: { key, value } })) out.push(n);
  }
  // tournois en cours
  for (const t of C.activeTournaments()) if (t.key === key || (t.key && key.startsWith(t.key + ':') && t.prefix)) {
    const e = q('SELECT value FROM tour_entries WHERE tid = ? AND user_id = ?').get(t.id, uid);
    if (!e || (t.dir === 'min' ? value < e.value : value > e.value)) q('INSERT INTO tour_entries (tid, user_id, value, at) VALUES (?, ?, ?, ?) ON CONFLICT(tid, user_id) DO UPDATE SET value = excluded.value, at = excluded.at').run(t.id, uid, value, now());
  }
  return out;
}

// ---------------- Classements ----------------
function leaderboards(game) {
  const xp = q('SELECT * FROM users ORDER BY xp DESC LIMIT 50').all().map(u => publicUser(u));
  const ranked = q('SELECT * FROM users WHERE season = ? AND rated > 0 ORDER BY rating DESC LIMIT 50').all(seasonId()).map(u => publicUser(u));
  const coins = q('SELECT * FROM users ORDER BY coins DESC LIMIT 20').all().map(u => publicUser(u));
  const clans = q('SELECT c.*, COUNT(u.id) members, COALESCE(SUM(u.xp),0) xp FROM clans c LEFT JOIN users u ON u.clan_id = c.id GROUP BY c.id ORDER BY xp DESC LIMIT 30').all();
  const recKeys = q('SELECT DISTINCT key FROM records').all().map(r => r.key);
  const records = recKeys.map(key => { const info = C.recordInfo(key); const rows = q(`SELECT r.value, r.at, u.name, u.avatar FROM records r JOIN users u ON u.id = r.user_id WHERE r.key = ? ORDER BY r.value ${info.dir === 'min' ? 'ASC' : 'DESC'} LIMIT 10`).all(key); return { key, ...info, fmt: undefined, rows: rows.map(x => ({ ...x, avatar: J(x.avatar, {}), shown: info.fmt(x.value) })) }; });
  return { xp, ranked, coins, clans, records, season: seasonId(), ranks: C.RANKS };
}

// ---------------- Tournois ----------------
function tournaments() {
  finalizeTournaments();
  const list = [...C.activeTournaments(), ...C.pastTournaments(3)];
  return list.map(t => {
    const rows = q(`SELECT e.value, u.name, u.avatar, u.id FROM tour_entries e JOIN users u ON u.id = e.user_id WHERE e.tid = ? ORDER BY e.value ${t.dir === 'min' ? 'ASC' : 'DESC'} LIMIT 20`).all(t.id);
    return { ...t, fmt: undefined, rows: rows.map(r => ({ ...r, avatar: J(r.avatar, {}), shown: C.recordInfo(t.key).fmt(r.value) })) };
  });
}
function finalizeTournaments() {
  for (const t of C.pastTournaments(6)) {
    if (q('SELECT 1 FROM tour_done WHERE tid = ?').get(t.id)) continue;
    q('INSERT INTO tour_done VALUES (?, ?)').run(t.id, now());
    const rows = q(`SELECT user_id FROM tour_entries WHERE tid = ? ORDER BY value ${t.dir === 'min' ? 'ASC' : 'DESC'} LIMIT 3`).all(t.id);
    rows.forEach((r, i) => { addCoins(r.user_id, t.prizes[i]); if (i === 0) unlock(r.user_id, 'champion'); unlock(r.user_id, 'podium'); });
  }
}

// ---------------- Amis ----------------
function friendList(uid, online) {
  const rows = q('SELECT * FROM friends WHERE a = ? OR b = ?').all(uid, uid);
  const out = { friends: [], incoming: [], outgoing: [] };
  for (const r of rows) {
    const other = r.a === uid ? r.b : r.a, u = publicUser(userRow(other)); if (!u) continue;
    u.online = online(other); u.unread = q('SELECT COUNT(*) n FROM messages WHERE from_id = ? AND to_id = ? AND read = 0').get(other, uid).n;
    if (r.status === 'ok') out.friends.push(u); else if (r.b === uid) out.incoming.push(u); else out.outgoing.push(u);
  }
  out.friends.sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || a.name.localeCompare(b.name));
  return out;
}
function addFriend(uid, name) {
  const o = userByName(name); if (!o) throw new Error('Joueur introuvable'); if (o.id === uid) throw new Error('C’est vous !');
  const ex = q('SELECT * FROM friends WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)').get(uid, o.id, o.id, uid);
  if (ex?.status === 'ok') throw new Error('Déjà amis');
  if (ex && ex.a === o.id) { q("UPDATE friends SET status = 'ok' WHERE a = ? AND b = ?").run(o.id, uid); checkAchievements(uid); checkAchievements(o.id); return { accepted: true, other: o.id }; }
  if (ex) throw new Error('Demande déjà envoyée');
  q("INSERT INTO friends VALUES (?, ?, 'pending', ?)").run(uid, o.id, now());
  return { requested: true, other: o.id };
}
function answerFriend(uid, otherId, accept) {
  const r = q("SELECT * FROM friends WHERE a = ? AND b = ? AND status = 'pending'").get(otherId, uid); if (!r) throw new Error('Demande introuvable');
  if (accept) { q("UPDATE friends SET status = 'ok' WHERE a = ? AND b = ?").run(otherId, uid); checkAchievements(uid); checkAchievements(otherId); }
  else q('DELETE FROM friends WHERE a = ? AND b = ?').run(otherId, uid);
}
function removeFriend(uid, otherId) { q('DELETE FROM friends WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)').run(uid, otherId, otherId, uid); }
const areFriends = (a, b) => !!q("SELECT 1 FROM friends WHERE ((a = ? AND b = ?) OR (a = ? AND b = ?)) AND status = 'ok'").get(a, b, b, a);

// ---------------- Messages privés ----------------
function sendDm(uid, to, text) {
  text = String(text || '').trim().slice(0, 500); if (!text) throw new Error('Message vide');
  if (!areFriends(uid, to)) throw new Error('Vous devez être amis');
  const r = q('INSERT INTO messages (from_id, to_id, text, at) VALUES (?, ?, ?, ?)').run(uid, to, text, now());
  return { id: Number(r.lastInsertRowid), from: uid, to, text, at: now() };
}
function conversation(uid, other) {
  q('UPDATE messages SET read = 1 WHERE from_id = ? AND to_id = ?').run(other, uid);
  return q('SELECT id, from_id "from", to_id "to", text, at FROM messages WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?) ORDER BY at DESC LIMIT 80').all(uid, other, other, uid).reverse();
}

// ---------------- Clans ----------------
function clanInfo(id) {
  const c = q('SELECT * FROM clans WHERE id = ?').get(id); if (!c) return null;
  const members = q('SELECT * FROM users WHERE clan_id = ? ORDER BY xp DESC').all(id).map(u => publicUser(u));
  const msgs = q('SELECT m.text, m.at, u.name FROM clan_msgs m JOIN users u ON u.id = m.user_id WHERE m.clan_id = ? ORDER BY m.at DESC LIMIT 60').all(id).reverse();
  return { ...c, members, msgs, xp: members.reduce((a, m) => a + m.xp, 0) };
}
function createClan(uid, name, tag, descr, emblem) {
  const u = userRow(uid); if (u.clan_id) throw new Error('Quittez d’abord votre clan');
  name = String(name || '').trim(); tag = String(tag || '').trim().toUpperCase();
  if (!/^.{3,20}$/.test(name)) throw new Error('Nom : 3 à 20 caractères');
  if (!/^[A-Z0-9]{2,4}$/.test(tag)) throw new Error('Tag : 2 à 4 lettres/chiffres');
  if (u.coins < 500) throw new Error('Créer un clan coûte 500 pièces');
  if (q('SELECT 1 FROM clans WHERE name = ?').get(name)) throw new Error('Nom déjà pris');
  const r = q('INSERT INTO clans (name, tag, owner, descr, emblem, created) VALUES (?, ?, ?, ?, ?, ?)').run(name, tag, uid, String(descr || '').slice(0, 200), C.EMOJIS.includes(emblem) ? emblem : '🛡️', now());
  q('UPDATE users SET clan_id = ?, coins = coins - 500 WHERE id = ?').run(Number(r.lastInsertRowid), uid);
  checkAchievements(uid);
  return clanInfo(Number(r.lastInsertRowid));
}
function joinClan(uid, id) {
  const u = userRow(uid); if (u.clan_id) throw new Error('Vous êtes déjà dans un clan');
  if (!q('SELECT 1 FROM clans WHERE id = ?').get(id)) throw new Error('Clan introuvable');
  if (q('SELECT COUNT(*) n FROM users WHERE clan_id = ?').get(id).n >= 30) throw new Error('Clan complet');
  q('UPDATE users SET clan_id = ? WHERE id = ?').run(id, uid); checkAchievements(uid);
  return clanInfo(id);
}
function leaveClan(uid) {
  const u = userRow(uid); if (!u.clan_id) return;
  q('UPDATE users SET clan_id = NULL WHERE id = ?').run(uid);
  const c = q('SELECT * FROM clans WHERE id = ?').get(u.clan_id);
  const left = q('SELECT id FROM users WHERE clan_id = ? ORDER BY xp DESC').all(u.clan_id);
  if (!left.length) { q('DELETE FROM clans WHERE id = ?').run(u.clan_id); q('DELETE FROM clan_msgs WHERE clan_id = ?').run(u.clan_id); }
  else if (c.owner === uid) q('UPDATE clans SET owner = ? WHERE id = ?').run(left[0].id, u.clan_id);
}
function clanSay(uid, text) {
  const u = userRow(uid); if (!u.clan_id) throw new Error('Pas de clan');
  text = String(text || '').trim().slice(0, 300); if (!text) throw new Error('Message vide');
  q('INSERT INTO clan_msgs (clan_id, user_id, text, at) VALUES (?, ?, ?, ?)').run(u.clan_id, uid, text, now());
  return { clan: u.clan_id, msg: { name: u.name, text, at: now() } };
}
function clanList(search) { return q("SELECT c.*, COUNT(u.id) members, COALESCE(SUM(u.xp),0) xp FROM clans c LEFT JOIN users u ON u.clan_id = c.id WHERE c.name LIKE ? OR c.tag LIKE ? GROUP BY c.id ORDER BY xp DESC LIMIT 40").all(`%${search || ''}%`, `%${search || ''}%`); }

// ---------------- Divers ----------------
function searchUsers(s) { return q('SELECT * FROM users WHERE name LIKE ? ORDER BY xp DESC LIMIT 15').all(`%${String(s || '')}%`).map(u => publicUser(u)); }
function popularity() { return Object.fromEntries(q('SELECT game, played FROM game_counts').all().map(r => [r.game, r.played])); }
function ticket(uid, a) {
  if (!String(a.text || '').trim()) throw new Error('Écrivez votre message');
  q('INSERT INTO tickets (user_id, name, contact, subject, text, at) VALUES (?, ?, ?, ?, ?, ?)').run(uid, String(a.name || '').slice(0, 40), String(a.contact || '').slice(0, 80), String(a.subject || '').slice(0, 80), String(a.text).slice(0, 2000), now());
}
function seen(uid) { q('UPDATE users SET last_seen = ? WHERE id = ?').run(now(), uid); }
function stats() { return { users: q('SELECT COUNT(*) n FROM users').get().n, games: q('SELECT COALESCE(SUM(played),0) n FROM game_counts').get().n }; }

module.exports = { db, register, login, logout, byToken, me, userRow, checkSeason, profile, updateProfile, toggleFavorite, claimDaily, buy, equip, dailyChallenges, claimChallenge,
  recordResults, saveRecord, leaderboards, tournaments, friendList, addFriend, answerFriend, removeFriend, areFriends, sendDm, conversation, clanInfo, createClan, joinClan, leaveClan, clanSay, clanList,
  searchUsers, popularity, ticket, seen, stats, publicUser, levelOf, rankOf, seasonId };
