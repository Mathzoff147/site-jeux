// =====================================================================
//  Client du site : connexion au serveur, comptes, navigation entre
//  pages, salons (paramètres, partie classée, invitations, vocal),
//  lancement des jeux et notifications.
//
//  Interface d'un jeu côté navigateur (public/games/monjeu.js) :
//    export default { mount(root, api), update(state), event(e), unmount() }
//    api = { myId, room, settings, static, send, leave, backToLobby, isHost, chat, onChat, toast }
// =====================================================================
import { renderPage, ART, avatarHTML, nameHTML } from './pages.js';
import { Voice } from './voice.js';

const $ = s => document.querySelector(s);
export const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------- État partagé avec les pages ----------------
export const hub = {
  me: null, games: [], rooms: [], room: null, myId: null, friends: null, unread: 0, page: 'accueil',
  api: (m, a = {}) => callApi(m, a), toast, navigate: h => { location.hash = h; }, create: g => needName(() => sendRaw({ t: 'create', game: g })),
  join: code => needName(() => sendRaw({ t: 'join', code })), quick: g => quickPlay(g), openAuth: mode => openAuth(mode), refresh: () => route(), listeners: {},
  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }, emit(ev, d) { (this.listeners[ev] || []).forEach(f => f(d)); },
};

// ---------------- Notifications ----------------
export function toast(msg, kind = '', html = false, ms = 3200) {
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t[html ? 'innerHTML' : 'textContent'] = msg;
  $('#toasts').appendChild(t);
  const close = () => { t.classList.add('out'); setTimeout(() => t.remove(), 300); };
  t.addEventListener('click', e => { if (!e.target.closest('button')) close(); });
  setTimeout(close, ms);
  return t;
}
const ORD = n => n === 1 ? '1er' : `${n}e`;
function showNotifs(list) {
  if (list.some(n => n.type === 'friend' || n.type === 'friendOk')) hub.loadFriends?.();
  for (const n of list) {
    if (n.type === 'result') toast(`🏁 <b>${esc(hub.games.find(g => g.id === n.game)?.name || '')}</b> : ${n.win ? 'Victoire ! ' : ''}${ORD(n.place)}/${n.total} · <b>+${n.xp} XP</b> · <b>+${n.coins} 🪙</b>${n.delta != null ? ` · cote ${n.delta >= 0 ? '+' : ''}${n.delta}` : ''}`, 'ok', true, 6000);
    if (n.type === 'level') toast(`⭐ <b>Niveau ${n.level} !</b> +${n.coins} 🪙`, 'gold', true, 6000);
    if (n.type === 'achievement') toast(`🏆 Succès débloqué : <b>${n.icon} ${esc(n.name)}</b>${n.coins ? ` (+${n.coins} 🪙)` : ''}`, 'gold', true, 7000);
    if (n.type === 'challenge') toast(`✅ Défi réussi : <b>${esc(n.name)}</b> — récupérez la récompense dans votre profil !`, 'ok', true, 7000);
    if (n.type === 'record') toast(`📈 Nouveau record ! <b>${esc(n.label)}</b> : ${esc(n.value)}`, 'gold', true, 7000);
    if (n.type === 'friend') toast(`👋 <b>${esc(n.name)}</b> vous demande en ami <button class="btn primary small" data-go="#/amis">Voir</button>`, '', true, 9000);
    if (n.type === 'friendOk') toast(`🤝 <b>${esc(n.name)}</b> est maintenant votre ami !`, 'ok', true);
    if (n.type === 'season') toast(`🏅 Nouvelle saison ! Récompense du rang <b>${esc(n.rank)}</b> : +${n.coins} 🪙`, 'gold', true, 9000);
  }
  document.querySelectorAll('#toasts [data-go]').forEach(b => { b.onclick = () => { location.hash = b.dataset.go; }; });
}

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id);
  document.body.classList.toggle('in-game', id === 'game');
  $('#roombar').classList.toggle('hidden', !(id === 'pages' && hub.room && !hub.room.started));
  if (hub.room && id === 'pages') $('#roombarText').innerHTML = `🎮 Vous êtes dans le salon <b>${hub.room.code}</b> (${esc(hub.room.gameName)})`;
  voiceFab();
}

// ---------------- Connexion / comptes ----------------
let ws, game = null, loading = false, pendingState = null, chatHandlers = [], wasInRoom = null, reqN = 0;
const pending = new Map();
let guestName = localStorage.getItem('pseudo') || '';
const token = () => localStorage.getItem('token');
function sendRaw(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }
hub.send = sendRaw;
function callApi(m, a) {
  return new Promise((res, rej) => {
    const id = ++reqN; pending.set(id, { res, rej });
    sendRaw({ t: 'api', id, m, a });
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('Le serveur ne répond pas')); } }, 10000);
  });
}
function setMe(u) {
  hub.me = u;
  const box = $('#profileBtn');
  $('#loginBtn').classList.toggle('hidden', !!u || !!guestName);
  $('#coins').classList.toggle('hidden', !u);
  if (u) { $('#coins b').textContent = u.coins; $('#myName').innerHTML = `${esc(u.name)} <small>Nv ${u.level}</small>`; $('#myAvatar').innerHTML = avatarHTML(u, 30); box.classList.remove('hidden'); }
  else if (guestName) { $('#myName').innerHTML = `${esc(guestName)} <small>invité</small>`; $('#myAvatar').innerHTML = avatarHTML({ name: guestName }, 30); box.classList.remove('hidden'); }
  else box.classList.add('hidden');
  hub.emit('me', u);
}
$('#profileBtn').onclick = () => { if (hub.me) location.hash = '#/profil'; else openAuth('login'); };
$('#loginBtn').onclick = () => openAuth('login');

let authMode = 'login', afterAuth = null;
function openAuth(mode = 'login', then) {
  authMode = mode; afterAuth = then || null;
  const d = $('#authDialog');
  d.querySelectorAll('.tabs2 button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  $('.fld.pw').classList.toggle('hidden', mode === 'guest');
  $('#authPass').required = mode !== 'guest';
  $('#authPass').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
  $('#authSubmit').textContent = { login: 'Se connecter', register: 'Créer mon compte', guest: 'Jouer en invité' }[mode];
  $('#authHelp').textContent = { login: 'Retrouvez votre progression, vos amis et vos pièces.', register: 'Gratuit : sauvegardez vos records, gagnez de l’XP, des pièces et des succès !', guest: 'Jouez tout de suite. Votre progression ne sera pas sauvegardée.' }[mode];
  $('#authErr').textContent = '';
  if (!d.open) d.showModal();
  if (!$('#authName').value) $('#authName').value = guestName;
  setTimeout(() => $('#authName').focus(), 50);
}
$('#authDialog').querySelectorAll('.tabs2 button').forEach(b => { b.onclick = () => openAuth(b.dataset.mode, afterAuth); });
$('#authCancel').onclick = () => { $('#authDialog').close(); pendingAfterName = null; };
$('#authForm').onsubmit = async e => {
  e.preventDefault();
  const name = $('#authName').value.trim(), pass = $('#authPass').value;
  if (!name) return;
  if (authMode === 'guest') {
    guestName = name.slice(0, 16); localStorage.setItem('pseudo', guestName); sendRaw({ t: 'hello', name: guestName });
    $('#authDialog').close(); setMe(hub.me); runAfter(); return;
  }
  try {
    const r = await callApi(authMode, { name, pass });
    localStorage.setItem('token', r.token); setMe(r.user);
    $('#authDialog').close(); $('#authPass').value = '';
    toast(authMode === 'register' ? `🎉 Bienvenue ${r.user.name} ! 200 pièces offertes.` : `Content de vous revoir, ${r.user.name} !`, 'ok');
    runAfter(); route();
  } catch (err) { $('#authErr').textContent = err.message; }
};
export async function logout() { try { await callApi('logout', { token: token() }); } catch { } localStorage.removeItem('token'); setMe(null); toast('Vous êtes déconnecté.'); location.hash = '#/'; }
hub.logout = logout;
let pendingAfterName = null;
function runAfter() { const f = pendingAfterName || afterAuth; pendingAfterName = null; afterAuth = null; f?.(); }
function needName(fn) { if (hub.me || guestName) fn(); else { pendingAfterName = fn; openAuth('register'); } }

function setStatus(ok) { $('#status').classList.toggle('on', ok); $('#status span').textContent = ok ? 'En ligne' : 'Connexion…'; }
function connect() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => {
    setStatus(true);
    sendRaw({ t: 'hello', token: token(), name: guestName || 'Invité' });
    sendRaw({ t: 'list' });
    const code = new URLSearchParams(location.search).get('salon') || wasInRoom;
    if (code) needName(() => sendRaw({ t: 'join', code }));
  };
  ws.onclose = () => {
    setStatus(false);
    if (hub.room) { wasInRoom = hub.room.code; toast('Connexion perdue… reconnexion', 'err'); }
    voice.leave(true); hub.room = null; unmountGame(); show('pages');
    for (const p of pending.values()) p.rej(new Error('Connexion perdue')); pending.clear();
    setTimeout(connect, 1500);
  };
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    switch (m.t) {
      case 'welcome': hub.myId = m.id; hub.games = m.games; route(); break;
      case 'me': if (!m.user && token()) localStorage.removeItem('token'); setMe(m.user); if (hub.me && !hub.friends) loadFriends(); break;
      case 'api': { const p = pending.get(m.id); if (p) { pending.delete(m.id); m.ok ? p.res(m.data) : p.rej(new Error(m.error)); } break; }
      case 'list': hub.rooms = m.rooms; hub.emit('rooms', m.rooms); break;
      case 'room': onRoom(m.room); break;
      case 'start': startGame(m); break;
      case 'state': if (game) game.update(m.s); else pendingState = m.s; break;
      case 'event': if (game && game.event) game.event(m.e); break;
      case 'chat': addChat(m); chatHandlers.forEach(h => h(m)); break;
      case 'error': toast(m.msg, 'err'); if (!hub.room) { history.replaceState(null, '', location.pathname + location.hash); wasInRoom = null; } break;
      case 'left': hub.room = null; wasInRoom = null; voice.leave(true); history.replaceState(null, '', location.pathname + location.hash); unmountGame(); show('pages'); sendRaw({ t: 'list' }); route(); break;
      case 'notif': showNotifs(m.list); break;
      case 'invite': {
        const t = toast(`✉️ <b>${esc(m.from)}</b> vous invite à jouer à ${m.icon} <b>${esc(m.game)}</b> <button class="btn primary small" data-join>Rejoindre</button>`, '', true, 15000);
        t.querySelector('[data-join]').onclick = () => { sendRaw({ t: 'join', code: m.code }); t.remove(); };
        break;
      }
      case 'dm': hub.emit('dm', m); if (!(hub.page === 'amis' && hub.openChat === m.msg.from)) { hub.unread++; badge(); toast(`💬 <b>${esc(m.name)}</b> : ${esc(m.msg.text)}`, '', true, 5000); } break;
      case 'clan': hub.emit('clan', m.msg); break;
      case 'presence': hub.emit('presence', m); if (hub.friends) { const f = hub.friends.friends.find(x => x.id === m.id); if (f) { f.online = m.on; renderInviteList(); } } break;
      case 'voice': voice.onSignal(m); break;
    }
  };
}
async function loadFriends() { try { hub.friends = await callApi('friends'); hub.unread = hub.friends.friends.reduce((a, f) => a + f.unread, 0) + hub.friends.incoming.length; badge(); renderInviteList(); } catch { } }
hub.loadFriends = loadFriends;
function badge() { const b = $('#friendBadge'); b.textContent = hub.unread; b.classList.toggle('hidden', !hub.unread); }
hub.badge = badge;

// ---------------- Navigation ----------------
function route() {
  const [, page = '', param = ''] = location.hash.split('/');
  hub.page = page || 'accueil';
  document.querySelectorAll('#links a').forEach(a => a.classList.toggle('on', a.dataset.page === hub.page || (hub.page === 'profil' && false)));
  document.body.classList.remove('menu-open');
  if (game) return; // en jeu : on ne quitte pas l'écran de jeu
  show('pages');
  renderPage(hub.page, decodeURIComponent(param), $('#pages'), hub);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
$('#burger').onclick = () => document.body.classList.toggle('menu-open');
$('#roombarBack').onclick = () => { if (hub.room) { show('lobby'); renderLobby(true); } };

function quickPlay(gid) {
  needName(() => {
    const r = hub.rooms.filter(x => x.game === gid && x.players.length < x.max).sort((a, b) => b.players.length - a.players.length)[0];
    sendRaw(r ? { t: 'join', code: r.code } : { t: 'create', game: gid });
  });
}
setInterval(() => { if (!hub.room) sendRaw({ t: 'list' }); }, 3000);

// ===================== Salon d'attente =====================
const inviteLink = () => `${location.origin}/?salon=${hub.room.code}`;
async function copy(text, okMsg) { try { await navigator.clipboard.writeText(text); toast(okMsg, 'ok'); } catch { prompt('Copiez ce texte :', text); } }
$('#copyLink').onclick = () => copy(inviteLink(), 'Lien copié ! Envoyez-le à vos amis 🎉');
$('#copyCode').onclick = () => copy(hub.room.code, 'Code copié');
if (navigator.share) { $('#shareBtn').classList.remove('hidden'); $('#shareBtn').onclick = () => navigator.share({ title: hub.room.gameName, text: `Rejoins-moi sur ${hub.room.gameName} !`, url: inviteLink() }).catch(() => {}); }
$('#startBtn').onclick = () => sendRaw({ t: 'start' });
$('#leaveBtn').onclick = () => sendRaw({ t: 'leave' });

function onRoom(r) {
  const prev = hub.room;
  hub.room = r; wasInRoom = r.code;
  history.replaceState(null, '', `/?salon=${r.code}${location.hash}`);
  if (r.started) { if (game) game.room = r; voiceFab(); return; }
  if (game) unmountGame();
  if (!prev || prev.code !== r.code) { $('#chatLog').innerHTML = '<p class="muted empty">Dites bonjour 👋</p>'; voice.leave(true); }
  else {
    const before = new Set(prev.players.map(p => p.id)), after = new Set(r.players.map(p => p.id));
    r.players.filter(p => !before.has(p.id)).forEach(p => sysChat(`${p.name} a rejoint le salon`));
    prev.players.filter(p => !after.has(p.id)).forEach(p => sysChat(`${p.name} est parti`));
    if (prev.host !== r.host && r.host === hub.myId) toast('Vous êtes maintenant l’hôte 👑', 'ok');
  }
  const onPages = !$('#pages').classList.contains('hidden') && prev && prev.code === r.code && !prev.started;
  if (onPages) { show('pages'); return; }
  renderLobby(!prev || prev.code !== r.code || prev.started);
}
const gameById = id => hub.games.find(g => g.id === id) || { name: id, icon: '🎮', color: '#7c6cff', settings: [], tags: [] };

function renderLobby(full) {
  const r = hub.room, g = gameById(r.game);
  show('lobby');
  $('#lobbyBanner').style.background = `linear-gradient(135deg, ${g.color}, #1b1f4a)`;
  $('#lobbyGame').textContent = `${g.icon} ${r.gameName}`;
  $('#lobbyCode').textContent = r.code;
  $('#rules').innerHTML = g.rules || '<p class="muted">Amusez-vous bien !</p>';
  $('#playerCount').textContent = `${r.players.length}/${r.max}`;
  const slots = Math.max(0, Math.min(r.max, Math.max(r.min, 4)) - r.players.length);
  $('#lobbyPlayers').innerHTML = r.players.map(p => `
    <li class="${p.id === hub.myId ? 'me' : ''}">${avatarHTML(p, 42)}
      <span class="who">${p.uid ? `<a href="#/profil/${encodeURIComponent(p.name)}">${nameHTML(p)}</a>` : `<b>${esc(p.name)}</b>`}
      <small>${p.id === r.host ? '👑 Hôte · ' : ''}${p.uid ? `Nv ${p.level} ${p.rank || ''}${p.title ? ` · ${esc(p.title)}` : ''}` : 'Invité'}${p.id === hub.myId ? ' · vous' : ''}</small></span>
      ${voice.members.has(p.id) ? `<span class="vbadge ${voice.speaking.has(p.id) ? 'talk' : ''}" title="Dans le vocal">🎙️</span>` : ''}</li>`).join('')
    + Array.from({ length: slots }, () => '<li class="slot">En attente…</li>').join('');
  renderSettings(g, full);
  if (full && hub.me) loadFriends();
  const host = r.host === hub.myId, enough = r.players.length >= r.min;
  // partie classée
  const rw = $('#rankedWrap');
  rw.classList.toggle('hidden', !r.rankedAllowed);
  if (r.rankedAllowed) {
    const logged = r.players.filter(p => p.uid).length;
    rw.innerHTML = `<div class="setting toggle"><div class="set-lbl"><span>⚔️ Partie classée</span><small>${r.ranked ? (logged >= 2 ? `La cote des ${logged} joueurs connectés évoluera selon le classement.` : 'Il faut au moins 2 joueurs connectés pour que la partie compte.') : 'La partie ne modifie pas la cote.'}</small></div>
      ${host ? `<label class="switch"><input type="checkbox" id="rankedChk" ${r.ranked ? 'checked' : ''}><i></i></label>` : `<b class="set-val">${r.ranked ? 'Oui' : 'Non'}</b>`}</div>`;
    $('#rankedChk')?.addEventListener('change', e => sendRaw({ t: 'ranked', on: e.target.checked }));
  }
  const start = $('#startBtn');
  start.classList.toggle('hidden', !host);
  start.disabled = !enough;
  const msg = $('#lobbyInfo'); msg.className = '';
  if (host && !enough) { msg.textContent = `Il faut au moins ${r.min} joueurs. Invitez vos amis !`; msg.className = 'waiting'; }
  else if (host) msg.textContent = 'Réglez les paramètres puis lancez la partie !';
  else { msg.textContent = `En attente que ${r.players.find(p => p.id === r.host)?.name || "l'hôte"} lance la partie`; msg.className = 'waiting'; }
  renderInviteList(); voice.render();
}

function renderInviteList() {
  const box = $('#inviteList'); if (!box) return;
  if (!hub.me) { box.innerHTML = `<p class="muted">Connectez-vous pour inviter vos amis.</p><button class="btn ghost small" data-login>Se connecter</button>`; box.querySelector('[data-login]').onclick = () => openAuth('login'); return; }
  const fr = (hub.friends?.friends || []).filter(f => f.online && !hub.room?.players.some(p => p.uid === f.id));
  box.innerHTML = fr.length ? fr.map(f => `<div class="mini-row">${avatarHTML(f, 28)}<span>${esc(f.name)}</span><button class="btn primary small" data-inv="${f.id}">Inviter</button></div>`).join('') : '<p class="muted">Aucun ami en ligne pour le moment. Partagez le lien du salon !</p>';
  box.querySelectorAll('[data-inv]').forEach(b => { b.onclick = async () => { try { await callApi('invite', { to: +b.dataset.inv }); b.textContent = 'Envoyé ✔'; b.disabled = true; } catch (e) { toast(e.message, 'err'); } }; });
}

// --- Paramètres réglables par l'hôte ---
function settingValueLabel(o, v) {
  if (o.type === 'toggle') return v ? 'Oui' : 'Non';
  if (o.type === 'select') return o.options.find(x => String(x.v) === String(v))?.l ?? v;
  return `${v}${o.unit || ''}`;
}
function renderSettings(g, full) {
  const wrap = $('#settingsWrap'), box = $('#settings'), r = hub.room;
  const opts = g.settings || [];
  wrap.classList.toggle('hidden', !opts.length);
  if (!opts.length) return;
  const host = r.host === hub.myId, S = r.settings || {};
  $('#settingsNote').textContent = host ? 'Vous pouvez les modifier' : 'Choisis par l’hôte';
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
  box.querySelectorAll('.seg button').forEach(b => { b.onclick = () => { b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); const o = opts.find(x => x.key === b.dataset.k); sendSet(b.dataset.k, o.options.find(x => String(x.v) === b.dataset.v).v); }; });
  box.querySelectorAll('input[type=range]').forEach(i => { const o = opts.find(x => x.key === i.dataset.k); i.oninput = () => { box.querySelector(`[data-out="${o.key}"]`).textContent = settingValueLabel(o, +i.value); }; i.onchange = () => sendSet(i.dataset.k, +i.value); });
}

// --- Discussion du salon ---
function chatEl() { const l = $('#chatLog'); l.querySelector('.empty')?.remove(); return l; }
function addChat(m) { if (!hub.room || hub.room.started) return; const l = chatEl(); l.insertAdjacentHTML('beforeend', `<div class="msg"><b style="color:${m.color || '#c4bcff'}">${esc(m.from)}</b>${esc(m.text)}</div>`); l.scrollTop = l.scrollHeight; }
function sysChat(text) { const l = chatEl(); l.insertAdjacentHTML('beforeend', `<div class="sys">${esc(text)}</div>`); l.scrollTop = l.scrollHeight; }
$('#chatForm').onsubmit = e => { e.preventDefault(); const i = $('#chatInput'); if (i.value.trim()) sendRaw({ t: 'chat', text: i.value }); i.value = ''; };

// ---------------- Chat vocal ----------------
const voice = new Voice({ send: m => sendRaw({ t: 'voice', ...m }), myId: () => hub.myId, toast, onChange: () => { voice.render(); voiceFab(); if (hub.room && !hub.room.started && !$('#lobby').classList.contains('hidden')) renderLobbyPlayersOnly(); } });
voice.render = () => {
  const box = $('#voiceBox'); if (!box) return;
  const names = [...voice.members].map(id => hub.room?.players.find(p => p.id === id)?.name).filter(Boolean);
  box.innerHTML = `${voice.active ? `<div class="vrow"><button class="btn danger small" data-vleave>Quitter le vocal</button><button class="btn ghost small" data-vmute>${voice.muted ? '🔇 Réactiver le micro' : '🎙️ Couper le micro'}</button></div>`
    : '<button class="btn primary small" data-vjoin>🎙️ Rejoindre le vocal</button>'}
    <p class="muted" style="margin:8px 0 0;font-size:13px">${names.length ? `Dans le vocal : ${names.map(esc).join(', ')}` : 'Personne dans le vocal.'}</p>`;
  box.querySelector('[data-vjoin]')?.addEventListener('click', () => voice.join());
  box.querySelector('[data-vleave]')?.addEventListener('click', () => voice.leave());
  box.querySelector('[data-vmute]')?.addEventListener('click', () => voice.toggleMute());
};
function renderLobbyPlayersOnly() { if (hub.room) renderLobby(false); }
function voiceFab() {
  const f = $('#voiceFab');
  const on = !!hub.room && (voice.active || voice.members.size > 0) && document.body.classList.contains('in-game');
  f.classList.toggle('hidden', !on);
  if (!on) return;
  f.innerHTML = voice.active ? `<button data-m title="Micro">${voice.muted ? '🔇' : '🎙️'}</button><span>${voice.members.size}</span><button data-l title="Quitter le vocal">✖</button>` : `<button data-j title="Rejoindre le vocal">🎙️ ${voice.members.size}</button>`;
  f.querySelector('[data-m]')?.addEventListener('click', () => voice.toggleMute());
  f.querySelector('[data-l]')?.addEventListener('click', () => voice.leave());
  f.querySelector('[data-j]')?.addEventListener('click', () => voice.join());
}

// ===================== Jeu =====================
async function startGame(m) {
  if (game || loading) return;
  loading = true;
  let mod;
  try { mod = await import(`./games/${m.game}.js`); }
  catch (e) { console.error(e); toast('Impossible de charger le jeu', 'err'); loading = false; return; }
  loading = false;
  if (!hub.room) return;
  game = mod.default;
  show('game');
  const root = $('#game'); root.innerHTML = '';
  chatHandlers = [];
  game.mount(root, {
    myId: hub.myId, room: hub.room, settings: { ...(hub.room.settings || {}) }, static: m.static,
    send: a => sendRaw({ t: 'action', a }), leave: () => sendRaw({ t: 'leave' }), backToLobby: () => sendRaw({ t: 'lobby' }),
    isHost: () => hub.room?.host === hub.myId, chat: text => sendRaw({ t: 'chat', text }), onChat: h => chatHandlers.push(h), toast,
  });
  if (pendingState) { game.update(pendingState); pendingState = null; }
  voiceFab();
}
function unmountGame() {
  if (!game) return;
  try { game.unmount(); } catch (e) { console.error(e); }
  game = null; pendingState = null; chatHandlers = []; $('#game').innerHTML = '';
  document.body.classList.remove('in-game'); voiceFab();
}

hub.ART = ART;
setMe(null);
connect();
