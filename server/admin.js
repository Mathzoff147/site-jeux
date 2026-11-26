// =====================================================================
//  Administration : rôles (joueur / modérateur / administrateur),
//  bannissements, sourdine, gestion des comptes, des jeux, des
//  actualités, des messages d'aide et journal des actions.
// =====================================================================
const crypto = require('crypto');
const P = require('./platform');
const C = require('./content');
const { db } = P;
const q = sql => db.prepare(sql);
const now = () => Date.now();

// colonnes et tables supplémentaires (ajoutées sans casser une base existante)
for (const col of ["role TEXT DEFAULT 'user'", 'banned INTEGER DEFAULT 0', "ban_reason TEXT DEFAULT ''", 'ban_until INTEGER DEFAULT 0', 'muted_until INTEGER DEFAULT 0'])
  try { db.exec(`ALTER TABLE users ADD COLUMN ${col}`); } catch { }
try { db.exec('ALTER TABLE tickets ADD COLUMN done INTEGER DEFAULT 0'); } catch { }
db.exec(`
CREATE TABLE IF NOT EXISTS admin_log (id INTEGER PRIMARY KEY AUTOINCREMENT, admin_id INTEGER, action TEXT, target TEXT, detail TEXT, at INTEGER);
CREATE TABLE IF NOT EXISTS news (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, tag TEXT, title TEXT, text TEXT, at INTEGER);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
`);
// premières actualités : celles écrites dans content.js
if (!q('SELECT COUNT(*) n FROM news').get().n) for (const n of C.NEWS.slice().reverse()) q('INSERT INTO news (date, tag, title, text, at) VALUES (?, ?, ?, ?, ?)').run(n.date, n.tag, n.title, n.text, now());

const ROLES = { user: 0, mod: 1, admin: 2 };
const ROLE_NAMES = { user: 'Joueur', mod: 'Modérateur', admin: 'Administrateur' };
const roleOf = uid => (uid && q('SELECT role FROM users WHERE id = ?').get(uid)?.role) || 'user';
const can = (uid, need) => ROLES[roleOf(uid)] >= ROLES[need];
function must(uid, need) { if (!can(uid, need)) throw new Error('Action réservée aux ' + (need === 'admin' ? 'administrateurs' : 'modérateurs')); }
function log(adminId, action, target, detail = '') { q('INSERT INTO admin_log (admin_id, action, target, detail, at) VALUES (?, ?, ?, ?, ?)').run(adminId, action, String(target ?? ''), String(detail).slice(0, 300), now()); }

// réglages du site (jeux désactivés, annonce…)
const getSetting = (k, d) => { const r = q('SELECT value FROM settings WHERE key = ?').get(k); try { return r ? JSON.parse(r.value) : d; } catch { return d; } };
const setSetting = (k, v) => q('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, JSON.stringify(v));
const disabledGames = () => getSetting('disabledGames', []);
const announcement = () => getSetting('announcement', null);

// bannissement : vérifié à la connexion
function banInfo(uid) {
  const u = q('SELECT banned, ban_reason, ban_until FROM users WHERE id = ?').get(uid);
  if (!u?.banned) return null;
  if (u.ban_until && u.ban_until < now()) { q('UPDATE users SET banned = 0, ban_reason = \'\', ban_until = 0 WHERE id = ?').run(uid); return null; }
  return { reason: u.ban_reason, until: u.ban_until };
}
const isMuted = uid => !!uid && (q('SELECT muted_until FROM users WHERE id = ?').get(uid)?.muted_until || 0) > now();

// promotion depuis le terminal ou la variable ADMINS
function promoteByName(name, role = 'admin') {
  if (!ROLES.hasOwnProperty(role)) throw new Error('Rôle inconnu : ' + role);
  const r = q('UPDATE users SET role = ? WHERE name = ?').run(role, String(name));
  return r.changes > 0;
}
// les pseudos listés dans ADMINS deviennent administrateurs (au démarrage ET à la connexion)
const adminNames = () => String(process.env.ADMINS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
function promoteIfListed(uid) { const u = q('SELECT name, role FROM users WHERE id = ?').get(uid); if (u && u.role !== 'admin' && adminNames().includes(u.name.toLowerCase())) q("UPDATE users SET role = 'admin' WHERE id = ?").run(uid); }
function autoPromote() { for (const n of String(process.env.ADMINS || '').split(',').map(s => s.trim()).filter(Boolean)) promoteByName(n, 'admin'); }

function userDetail(id) {
  const u = q('SELECT * FROM users WHERE id = ?').get(id); if (!u) throw new Error('Compte introuvable');
  const pub = P.publicUser(u, true);
  return { ...pub, role: u.role, banned: !!u.banned, banReason: u.ban_reason, banUntil: u.ban_until, mutedUntil: u.muted_until, lastSeen: u.last_seen,
    history: q('SELECT game, at, place, total, win FROM history WHERE user_id = ? ORDER BY at DESC LIMIT 15').all(id),
    sessions: q('SELECT COUNT(*) n FROM sessions WHERE user_id = ?').get(id).n };
}
function listUsers(search = '', page = 0) {
  return q(`SELECT id, name, role, banned, muted_until, xp, coins, games, rating, created, last_seen FROM users WHERE name LIKE ? ORDER BY last_seen DESC LIMIT 50 OFFSET ?`).all(`%${search}%`, page * 50)
    .map(u => ({ ...u, level: P.levelOf(u.xp).level, muted: u.muted_until > now() }));
}

// ---------------- Actions (le serveur appelle ces fonctions) ----------------
// ctx = { online, kick(uid, msg), closeRoom(code), broadcast(msg), rooms(), notify(uid, list) }
function api(uid, m, a, ctx) {
  switch (m) {
    case 'admin.overview': {
      must(uid, 'mod');
      return {
        role: roleOf(uid), stats: P.stats(), online: ctx.online.size,
        users24: q('SELECT COUNT(*) n FROM users WHERE created > ?').get(now() - 864e5).n,
        games24: q('SELECT COUNT(*) n FROM history WHERE at > ?').get(now() - 864e5).n,
        popularity: P.popularity(), rooms: ctx.rooms(), disabled: disabledGames(), announcement: announcement(),
        tickets: q('SELECT COUNT(*) n FROM tickets WHERE COALESCE(done, 0) = 0').get().n,
        log: q('SELECT l.*, u.name admin FROM admin_log l LEFT JOIN users u ON u.id = l.admin_id ORDER BY l.at DESC LIMIT 40').all(),
      };
    }
    case 'admin.users': must(uid, 'mod'); return listUsers(String(a.search || ''), a.page | 0);
    case 'admin.user': must(uid, 'mod'); return userDetail(+a.id);
    case 'admin.edit': { // pièces, XP, cote, pseudo, description
      must(uid, 'admin');
      const u = q('SELECT * FROM users WHERE id = ?').get(+a.id); if (!u) throw new Error('Compte introuvable');
      const f = {};
      for (const k of ['coins', 'xp', 'rating']) if (a[k] !== undefined && a[k] !== '') { const v = Math.max(0, Math.floor(+a[k])); if (!Number.isFinite(v)) throw new Error('Valeur invalide'); f[k] = v; }
      if (a.name && a.name !== u.name) { if (!/^[\p{L}\p{N}_\-. ]{3,16}$/u.test(a.name)) throw new Error('Pseudo invalide'); if (q('SELECT 1 FROM users WHERE name = ? AND id != ?').get(a.name, u.id)) throw new Error('Pseudo déjà pris'); f.name = a.name; }
      if (a.bio !== undefined) f.bio = String(a.bio).slice(0, 200);
      for (const [k, v] of Object.entries(f)) q(`UPDATE users SET ${k} = ? WHERE id = ?`).run(v, u.id);
      log(uid, 'modifier', u.name, JSON.stringify(f)); ctx.refresh(u.id);
      return userDetail(u.id);
    }
    case 'admin.give': { // donner des pièces / de l'XP / un objet
      must(uid, 'admin');
      const u = q('SELECT * FROM users WHERE id = ?').get(+a.id); if (!u) throw new Error('Compte introuvable');
      if (a.item) { const it = C.ITEM[a.item]; if (!it) throw new Error('Objet inconnu'); const owned = JSON.parse(u.owned || '[]'); if (!owned.includes(a.item)) owned.push(a.item); q('UPDATE users SET owned = ? WHERE id = ?').run(JSON.stringify(owned), u.id); log(uid, 'donner objet', u.name, it.name); }
      if (+a.coins) { q('UPDATE users SET coins = MAX(0, coins + ?) WHERE id = ?').run(Math.floor(+a.coins), u.id); log(uid, 'donner pièces', u.name, a.coins); }
      if (+a.xp) { q('UPDATE users SET xp = MAX(0, xp + ?) WHERE id = ?').run(Math.floor(+a.xp), u.id); log(uid, 'donner XP', u.name, a.xp); }
      ctx.refresh(u.id);
      ctx.notify(u.id, [{ type: 'gift', coins: +a.coins || 0, xp: +a.xp || 0, item: a.item ? C.ITEM[a.item]?.name : null }]);
      return userDetail(u.id);
    }
    case 'admin.role': {
      must(uid, 'admin');
      if (!ROLES.hasOwnProperty(a.role)) throw new Error('Rôle inconnu');
      if (+a.id === uid && a.role !== 'admin') throw new Error('Vous ne pouvez pas retirer votre propre rôle d’administrateur');
      q('UPDATE users SET role = ? WHERE id = ?').run(a.role, +a.id);
      log(uid, 'rôle', userDetail(+a.id).name, ROLE_NAMES[a.role]); ctx.refresh(+a.id);
      return userDetail(+a.id);
    }
    case 'admin.ban': {
      must(uid, 'mod');
      const t = q('SELECT * FROM users WHERE id = ?').get(+a.id); if (!t) throw new Error('Compte introuvable');
      if (ROLES[t.role] >= ROLES[roleOf(uid)]) throw new Error('Impossible de bannir un compte de rang égal ou supérieur');
      const until = +a.hours > 0 ? now() + +a.hours * 3600e3 : 0;
      q('UPDATE users SET banned = 1, ban_reason = ?, ban_until = ? WHERE id = ?').run(String(a.reason || 'Non respect des règles').slice(0, 200), until, t.id);
      q('DELETE FROM sessions WHERE user_id = ?').run(t.id);
      ctx.kick(t.id, `Votre compte a été suspendu${until ? ` jusqu’au ${new Date(until).toLocaleString('fr-FR')}` : ''} : ${a.reason || 'non respect des règles'}`);
      log(uid, 'bannir', t.name, `${a.hours > 0 ? a.hours + ' h' : 'définitif'} — ${a.reason || ''}`);
      return userDetail(t.id);
    }
    case 'admin.unban': { must(uid, 'mod'); q("UPDATE users SET banned = 0, ban_reason = '', ban_until = 0 WHERE id = ?").run(+a.id); log(uid, 'débannir', userDetail(+a.id).name); return userDetail(+a.id); }
    case 'admin.mute': {
      must(uid, 'mod');
      const t = q('SELECT * FROM users WHERE id = ?').get(+a.id); if (!t) throw new Error('Compte introuvable');
      if (ROLES[t.role] >= ROLES[roleOf(uid)]) throw new Error('Impossible sur un compte de rang égal ou supérieur');
      const until = +a.minutes > 0 ? now() + +a.minutes * 60e3 : 0;
      q('UPDATE users SET muted_until = ? WHERE id = ?').run(until, t.id);
      if (until) ctx.notify(t.id, [{ type: 'muted', until }]);
      log(uid, until ? 'sourdine' : 'fin de sourdine', t.name, until ? `${a.minutes} min` : '');
      return userDetail(t.id);
    }
    case 'admin.resetPassword': {
      must(uid, 'admin');
      const t = q('SELECT * FROM users WHERE id = ?').get(+a.id); if (!t) throw new Error('Compte introuvable');
      const pass = a.pass && String(a.pass).length >= 6 ? String(a.pass) : crypto.randomBytes(5).toString('hex');
      const salt = crypto.randomBytes(12).toString('hex');
      q('UPDATE users SET pass = ?, salt = ? WHERE id = ?').run(crypto.scryptSync(pass, salt, 32).toString('hex'), salt, t.id);
      q('DELETE FROM sessions WHERE user_id = ?').run(t.id);
      log(uid, 'nouveau mot de passe', t.name);
      return { pass };
    }
    case 'admin.deleteUser': {
      must(uid, 'admin');
      const t = q('SELECT * FROM users WHERE id = ?').get(+a.id); if (!t) throw new Error('Compte introuvable');
      if (t.id === uid) throw new Error('Vous ne pouvez pas supprimer votre propre compte ici');
      if (a.confirm !== t.name) throw new Error('Tapez exactement le pseudo pour confirmer');
      ctx.kick(t.id, 'Votre compte a été supprimé.');
      for (const sql of ['DELETE FROM sessions WHERE user_id = ?', 'DELETE FROM game_stats WHERE user_id = ?', 'DELETE FROM records WHERE user_id = ?', 'DELETE FROM history WHERE user_id = ?', 'DELETE FROM achievements WHERE user_id = ?',
        'DELETE FROM challenges WHERE user_id = ?', 'DELETE FROM tour_entries WHERE user_id = ?', 'DELETE FROM messages WHERE from_id = ? OR to_id = ?', 'DELETE FROM friends WHERE a = ? OR b = ?', 'DELETE FROM clan_msgs WHERE user_id = ?'])
        q(sql).run(...Array(sql.split('?').length - 1).fill(t.id));
      P.leaveClan(t.id);
      q('DELETE FROM users WHERE id = ?').run(t.id);
      log(uid, 'supprimer compte', t.name);
      return true;
    }
    case 'admin.resetStats': {
      must(uid, 'admin');
      const t = q('SELECT * FROM users WHERE id = ?').get(+a.id); if (!t) throw new Error('Compte introuvable');
      for (const sql of ['DELETE FROM game_stats WHERE user_id = ?', 'DELETE FROM records WHERE user_id = ?', 'DELETE FROM history WHERE user_id = ?', 'DELETE FROM tour_entries WHERE user_id = ?']) q(sql).run(t.id);
      q('UPDATE users SET games = 0, wins = 0, rating = 1000, peak = 1000, rated = 0 WHERE id = ?').run(t.id);
      log(uid, 'remise à zéro des stats', t.name);
      return userDetail(t.id);
    }
    // ---- jeux et salons ----
    case 'admin.toggleGame': {
      must(uid, 'admin');
      const set = new Set(disabledGames());
      set.has(a.game) ? set.delete(a.game) : set.add(a.game);
      setSetting('disabledGames', [...set]);
      log(uid, set.has(a.game) ? 'désactiver jeu' : 'activer jeu', C.GAMES[a.game] || a.game);
      ctx.gamesChanged();
      return [...set];
    }
    case 'admin.closeRoom': { must(uid, 'mod'); ctx.closeRoom(String(a.code), a.reason); log(uid, 'fermer salon', a.code, a.reason || ''); return ctx.rooms(); }
    case 'admin.kickFromRoom': { must(uid, 'mod'); ctx.kickFromRoom(String(a.code), String(a.player)); log(uid, 'exclure du salon', a.code, a.player); return ctx.rooms(); }
    // ---- contenu du site ----
    case 'admin.announce': {
      must(uid, 'admin');
      const text = String(a.text || '').trim().slice(0, 300);
      setSetting('announcement', text ? { text, kind: a.kind || 'info', at: now() } : null);
      ctx.broadcast({ t: 'announce', a: announcement() });
      log(uid, text ? 'annonce' : 'retirer annonce', '', text);
      return announcement();
    }
    case 'admin.newsAdd': {
      must(uid, 'admin');
      if (!String(a.title || '').trim() || !String(a.text || '').trim()) throw new Error('Titre et texte obligatoires');
      q('INSERT INTO news (date, tag, title, text, at) VALUES (?, ?, ?, ?, ?)').run(new Date().toISOString().slice(0, 10), String(a.tag || 'Info').slice(0, 30), String(a.title).slice(0, 120), String(a.text).slice(0, 3000), now());
      log(uid, 'publier actu', '', a.title);
      return news();
    }
    case 'admin.newsDelete': { must(uid, 'admin'); q('DELETE FROM news WHERE id = ?').run(+a.id); log(uid, 'supprimer actu', a.id); return news(); }
    case 'admin.tickets': must(uid, 'mod'); return q('SELECT t.*, u.name account FROM tickets t LEFT JOIN users u ON u.id = t.user_id ORDER BY COALESCE(t.done,0), t.at DESC LIMIT 100').all();
    case 'admin.ticketDone': { must(uid, 'mod'); q('UPDATE tickets SET done = 1 - COALESCE(done, 0) WHERE id = ?').run(+a.id); return q('SELECT t.*, u.name account FROM tickets t LEFT JOIN users u ON u.id = t.user_id ORDER BY COALESCE(t.done,0), t.at DESC LIMIT 100').all(); }
    case 'admin.clans': must(uid, 'mod'); return P.clanList('');
    case 'admin.deleteClan': {
      must(uid, 'admin');
      const c = P.clanInfo(+a.id); if (!c) throw new Error('Clan introuvable');
      q('UPDATE users SET clan_id = NULL WHERE clan_id = ?').run(c.id); q('DELETE FROM clan_msgs WHERE clan_id = ?').run(c.id); q('DELETE FROM clans WHERE id = ?').run(c.id);
      log(uid, 'supprimer clan', c.name);
      return P.clanList('');
    }
    case 'admin.items': must(uid, 'admin'); return C.ITEMS.map(i => ({ id: i.id, name: i.name, slot: i.slot }));
  }
  return undefined; // pas une requête d'administration
}
const news = () => q('SELECT * FROM news ORDER BY at DESC, id DESC').all();

module.exports = { promoteIfListed, api, roleOf, can, banInfo, isMuted, disabledGames, announcement, promoteByName, autoPromote, news, ROLE_NAMES };
