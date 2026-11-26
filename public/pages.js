// =====================================================================
//  Pages du site : Accueil, Jeux, Nouveautés, Classement, Tournois,
//  Boutique, Amis (messages, clans), Profil, Actualités, Aide.
// =====================================================================
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const ART = {
  cards: ['🟥', '🟨', '🟩', '🟦'], empire: ['🏠', '🏨', '🎲', '💰'], impostor: ['🕵️', '❓', '🗳️', '🤫'], chess: ['♞', '♜', '♛', '♟'],
  fallrace: ['🏁', '🌀', '💨', '🤸'], royale: ['🪂', '🔫', '🌀', '🏆'], tactical: ['🎯', '🛡️', '💣', '⚡'], draw: ['✏️', '🎨', '💡', '🖌️'],
  blocks: ['🧱', '⛏️', '🌲', '💎'], quest: ['⚔️', '🐉', '🧙', '💰'], carball: ['🚗', '⚽', '🥅', '💨'], zombie: ['🧟', '🔫', '💀', '🩸'],
  poker: ['♠️', '♥️', '🪙', '🃏'], blackjack: ['🂡', '🪙', '♦️', '🎰'], kart: ['🏎️', '🍌', '🚀', '🏁'], towers: ['🏰', '👾', '💥', '🪙'], arena: ['⚡', '🎯', '💠', '🔫'],
};
const NEW = [['blackjack', '2026-11-26', 'Le casino s’invite : jusqu’à 7 joueurs contre le croupier.'], ['tactical', '2026-11-25', 'FPS 3D en équipes avec 5 agents et leurs capacités.'], ['blocks', '2026-11-25', 'Un monde de cubes à construire ensemble.'],
  ['quest', '2026-11-25', 'Mini-MMORPG : 4 classes, quêtes et un dragon.'], ['fallrace', '2026-11-25', 'Course d’obstacles éliminatoire au-dessus du vide.'], ['kart', '2026-11-25', 'Dérapages, turbos et objets sur 4 circuits.'],
  ['carball', '2026-11-25', 'Du foot… avec des voitures à turbo.'], ['royale', '2026-11-25', 'Zone qui rétrécit, butin, bots.'], ['towers', '2026-11-25', 'Défendez le château en équipe.'], ['zombie', '2026-11-25', 'La grande version : 9 armes, boss, nuit.']];
const CATS = { cartes: 'Plateau & cartes' };

// ---------------- Avatars ----------------
export function avatarHTML(u, size = 40) {
  const av = u?.avatar || {}, emoji = av.emoji, bg = av.bg || (u?.color) || '#6366f1', frame = u?.frame || av.frame;
  const inner = emoji ? `<span style="font-size:${size * 0.56}px;line-height:1">${emoji}</span>` : `<b style="font-size:${size * 0.42}px">${esc((u?.name || '?')[0])}</b>`;
  return `<span class="uav" style="width:${size}px;height:${size}px;${frame && frame !== 'none' ? `background:${frame};padding:${Math.max(2, size / 14)}px` : ''}"><span style="background:${bg}">${inner}</span></span>`;
}
export function nameHTML(u) { return `${u.clanTag || u.clan?.tag ? `<span class="ctag">[${esc(u.clanTag || u.clan.tag)}]</span> ` : ''}<b style="${u.nameColor ? `color:${u.nameColor}` : ''}">${esc(u.name)}</b>`; }
const ago = t => { const s = (Date.now() - t) / 1000; if (s < 60) return 'à l’instant'; if (s < 3600) return `il y a ${Math.floor(s / 60)} min`; if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`; return `il y a ${Math.floor(s / 86400)} j`; };
const dateFr = d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const left = ms => { const s = Math.max(0, ms / 1000); const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? `${d} j ${h} h` : h ? `${h} h ${m} min` : `${m} min`; };
const loadingHTML = '<div class="loading"><i></i> Chargement…</div>';
const needLogin = (hub, what) => `<div class="empty-rooms"><b>Connectez-vous pour ${what}</b>Créez un compte gratuit en 10 secondes.<div style="margin-top:12px;display:flex;gap:8px;justify-content:center"><button class="btn primary" data-auth="register">Créer un compte</button><button class="btn ghost" data-auth="login">Se connecter</button></div></div>`;

let renderId = 0, H;
export function renderPage(page, param, el, hub) {
  H = hub; const id = ++renderId;
  const P = PAGES[page] || PAGES.accueil;
  el.innerHTML = loadingHTML;
  Promise.resolve(P(el, param, hub, () => id === renderId)).catch(e => { if (id === renderId) el.innerHTML = `<div class="empty-rooms"><b>Oups…</b>${esc(e.message)}</div>`; }).finally(() => wire(el, hub));
}
// liens génériques présents dans les pages
function wire(el, hub) {
  el.querySelectorAll('[data-auth]').forEach(b => { b.onclick = () => hub.openAuth(b.dataset.auth); });
  el.querySelectorAll('[data-create]').forEach(b => { b.onclick = e => { e.stopPropagation(); hub.create(b.dataset.create); }; });
  el.querySelectorAll('[data-quick]').forEach(b => { b.onclick = e => { e.stopPropagation(); hub.quick(b.dataset.quick); }; });
  el.querySelectorAll('[data-joincode]').forEach(b => { b.onclick = () => hub.join(b.dataset.joincode); });
  el.querySelectorAll('[data-fav]').forEach(b => { b.onclick = async e => { e.stopPropagation(); if (!hub.me) return hub.openAuth('register'); hub.me.favorites = await hub.api('favorite', { game: b.dataset.fav }); b.classList.toggle('on', hub.me.favorites.includes(b.dataset.fav)); b.textContent = hub.me.favorites.includes(b.dataset.fav) ? '★' : '☆'; }; });
}

// ---------------- Cartes de jeux ----------------
function gameCard(g, hub, extra = '') {
  const em = ART[g.id] || [g.icon], fav = hub.me?.favorites?.includes(g.id);
  const live = hub.rooms.filter(r => r.game === g.id).reduce((n, r) => n + r.players.length, 0);
  return `<article class="game-card">
    <div class="game-art" style="--c:${g.color}"><div class="art-bg"></div>${em.map((e, i) => `<span class="fl f${i}">${e}</span>`).join('')}<span class="art-icon">${g.icon}</span>
      <span class="badge">${esc(g.category)}</span><button class="fav ${fav ? 'on' : ''}" data-fav="${g.id}" title="Favori">${fav ? '★' : '☆'}</button>${extra}</div>
    <div class="game-body"><h3>${esc(g.name)}</h3><p>${esc(g.desc || '')}</p>
      <div class="tags"><span class="tag">👥 ${g.min === g.max ? g.min : `${g.min}–${g.max}`}</span>${g.tags.slice(0, 2).map(t => `<span class="tag">${esc(t)}</span>`).join('')}${live ? `<span class="tag live-tag">● ${live} en jeu</span>` : ''}</div>
      <div class="game-actions"><button class="btn primary" data-create="${g.id}">Créer</button><button class="btn ghost" data-quick="${g.id}" title="Rejoint un salon ouvert, ou en crée un">⚡ Rapide</button></div></div></article>`;
}
function roomsHTML(hub) {
  if (!hub.rooms.length) return `<div class="empty-rooms"><b>Aucun salon ouvert pour l'instant</b>Créez-en un et invitez vos amis !</div>`;
  return hub.rooms.map(r => { const g = hub.games.find(x => x.id === r.game) || {}; const full = r.players.length >= r.max;
    return `<button class="room" ${full ? 'disabled' : ''} data-joincode="${r.code}"><span class="ico" style="background:${g.color}">${g.icon}</span><span class="info"><b>${esc(r.gameName)}</b>
      <small>Salon ${r.code} · ${r.players.length}/${r.max}${r.started ? ' · en cours' : ' · en attente'}${r.ranked ? ' · ⚔️ classée' : ''}</small><span class="stack">${r.players.slice(0, 6).map(p => avatarHTML(p, 22)).join('')}</span></span>
      <span class="go">${full ? 'Complet' : 'Rejoindre →'}</span></button>`; }).join('');
}
function liveRooms(el, hub, alive) {
  const box = el.querySelector('#roomList'); if (!box) return;
  const draw = () => { if (!alive() || !document.body.contains(box)) return false; box.innerHTML = roomsHTML(hub); el.querySelector('#roomCount') && (el.querySelector('#roomCount').textContent = hub.rooms.length); box.querySelectorAll('[data-joincode]').forEach(b => { b.onclick = () => hub.join(b.dataset.joincode); }); return true; };
  draw(); const t = setInterval(() => { if (!draw()) clearInterval(t); }, 3000);
}

// ---------------- Bloc « joueur connecté » (accueil) ----------------
async function playerPanel(hub) {
  if (!hub.me) return `<section class="panel welcome"><h3>🎁 Créez votre compte</h3><p class="muted">Sauvegardez vos records, gagnez de l’XP et des pièces, débloquez des succès, ajoutez des amis et grimpez dans les classements.</p>
    <div class="row"><button class="btn primary" data-auth="register">Créer un compte</button><button class="btn ghost" data-auth="login">Se connecter</button></div></section>`;
  const u = hub.me, ch = await hub.api('challenges').catch(() => []);
  return `<section class="panel welcome">
    <div class="pp-head">${avatarHTML(u, 56)}<div><div class="pp-name">${nameHTML(u)}</div><div class="muted">Niveau ${u.level} · ${u.rank.icon} ${u.rank.name} · 🪙 ${u.coins}</div>
      <div class="xpbar"><b style="width:${u.xpCur / u.xpNext * 100}%"></b></div><small class="muted">${u.xpCur} / ${u.xpNext} XP</small></div></div>
    ${u.dailyReady ? `<button class="btn gold" data-daily>🎁 Récompense du jour (série : ${u.streak})</button>` : `<p class="muted" style="margin:8px 0">✔ Récompense du jour récupérée · série de ${u.streak} jour(s)</p>`}
    <h4>🎯 Défis du jour</h4>${challengesHTML(ch)}</section>`;
}
function challengesHTML(ch) {
  return `<div class="challs">${ch.map(c => `<div class="chall ${c.claimed ? 'done' : ''}"><div><b>${esc(c.name)}</b><small>🪙 ${c.coins} · ⭐ ${c.xp} XP</small><div class="xpbar sm"><b style="width:${c.progress / c.goal * 100}%"></b></div></div>
    ${c.claimed ? '<span class="muted">✔</span>' : c.progress >= c.goal ? `<button class="btn gold small" data-claim="${c.id}">Récupérer</button>` : `<span class="muted">${c.progress}/${c.goal}</span>`}</div>`).join('')}</div>`;
}
function wireDaily(el, hub) {
  el.querySelector('[data-daily]')?.addEventListener('click', async () => { try { const r = await hub.api('daily'); hub.toast(`🎁 +${r.coins} 🪙 · +${r.xp} XP (série de ${r.streak} jour(s))`, 'gold'); hub.refresh(); } catch (e) { hub.toast(e.message, 'err'); } });
  el.querySelectorAll('[data-claim]').forEach(b => { b.onclick = async () => { try { await hub.api('claimChallenge', { id: b.dataset.claim }); hub.toast('✅ Récompense récupérée !', 'gold'); hub.refresh(); } catch (e) { hub.toast(e.message, 'err'); } }; });
}

// =====================================================================
const PAGES = {
  // -------------------- ACCUEIL --------------------
  async accueil(el, _, hub, alive) {
    const home = await hub.api('home').catch(() => ({ stats: {}, popularity: {}, news: [], tournaments: [], top: [] }));
    if (!alive()) return;
    const pop = hub.games.slice().sort((a, b) => (home.popularity[b.id] || 0) - (home.popularity[a.id] || 0)).slice(0, 4);
    const fresh = NEW.slice(0, 4).map(([id]) => hub.games.find(g => g.id === id)).filter(Boolean);
    const favs = (hub.me?.favorites || []).map(id => hub.games.find(g => g.id === id)).filter(Boolean);
    el.innerHTML = `
      <section class="hero">
        <div class="hero-text"><span class="kicker">Gratuit · ${hub.games.length} jeux · dans le navigateur</span>
          <h1>Jouez entre amis,<br><span class="grad">en un clic.</span></h1>
          <p>Créez un salon, envoyez le lien à vos amis, c'est parti. Progressez, débloquez des succès et grimpez dans les classements.</p>
          <div class="hero-stats"><span><b>${home.stats.users || 0}</b> joueurs inscrits</span><span><b>${home.stats.games || 0}</b> parties jouées</span><span><b>${home.online || 0}</b> en ligne</span></div></div>
        <form class="join-card" id="joinForm" autocomplete="off"><label for="code">Vous avez un code ?</label>
          <div class="code-input"><input id="code" maxlength="4" placeholder="ABCD" spellcheck="false"><button class="btn primary">Rejoindre →</button></div>
          <small>Le code à 4 lettres que votre ami vous a donné.</small></form>
      </section>
      <div class="home-grid">
        <div>
          ${favs.length ? `<section class="section"><div class="section-head"><h2>⭐ Vos favoris</h2></div><div class="games">${favs.map(g => gameCard(g, hub)).join('')}</div></section>` : ''}
          <section class="section"><div class="section-head"><h2>🔥 Jeux populaires</h2><a href="#/jeux" class="muted">Tous les jeux →</a></div><div class="games">${pop.map(g => gameCard(g, hub)).join('')}</div></section>
          <section class="section"><div class="section-head"><h2>✨ Nouveautés</h2><a href="#/nouveautes" class="muted">Voir tout →</a></div><div class="games">${fresh.map(g => gameCard(g, hub, '<span class="newb">NOUVEAU</span>')).join('')}</div></section>
          <section class="section"><div class="section-head"><h2>Salons ouverts <span class="count" id="roomCount">0</span></h2><span class="muted live"><i></i> en direct</span></div><div id="roomList" class="rooms"></div></section>
        </div>
        <aside class="home-side">
          ${await playerPanel(hub)}
          ${home.tournaments.map(t => `<a class="panel tcard" href="#/tournois"><span class="kicker">${t.kind === 'week' ? '🏆 Tournoi de la semaine' : '⚡ Tournoi éclair'}</span><b>${esc(hub.games.find(g => g.id === t.game)?.name || '')}</b><span class="muted">${esc(t.label)} · fin dans ${left(t.end - Date.now())}</span>
            <span>${t.rows[0] ? `🥇 ${esc(t.rows[0].name)} — ${esc(t.rows[0].shown)}` : 'Aucun participant : à vous de jouer !'}</span><span class="muted">Prix : ${t.prizes.join(' / ')} 🪙</span></a>`).join('')}
          <section class="panel"><h3>🏅 Meilleurs joueurs</h3>${home.top.map((u, i) => `<a class="mini-row" href="#/profil/${encodeURIComponent(u.name)}"><b>${i + 1}</b>${avatarHTML(u, 28)}<span>${nameHTML(u)}</span><small class="muted">Nv ${u.level}</small></a>`).join('') || '<p class="muted">Soyez le premier !</p>'}</section>
          <section class="panel"><h3>📰 Actualités</h3>${home.news.map(n => `<a class="news-mini" href="#/actus"><span class="tag">${esc(n.tag)}</span><b>${esc(n.title)}</b><small class="muted">${dateFr(n.date)}</small></a>`).join('')}</section>
        </aside>
      </div>`;
    const ci = el.querySelector('#code');
    ci.oninput = () => { ci.value = ci.value.toUpperCase().replace(/[^A-Z]/g, ''); };
    el.querySelector('#joinForm').onsubmit = e => { e.preventDefault(); if (ci.value.length !== 4) return hub.toast('Le code fait 4 lettres', 'err'); hub.join(ci.value); };
    wireDaily(el, hub); liveRooms(el, hub, alive);
  },

  // -------------------- TOUS LES JEUX --------------------
  async jeux(el, _, hub, alive) {
    let cat = 'Tous', search = '';
    el.innerHTML = `<section class="section"><div class="section-head wrap"><h1 class="ptitle">🎮 Tous les jeux <span class="count">${hub.games.length}</span></h1>
      <div class="search"><span>🔎</span><input id="search" placeholder="Rechercher un jeu…" autocomplete="off"></div></div>
      <div class="chips" id="cats"></div><div id="gameList" class="games"></div></section>
      <section class="section"><div class="section-head"><h2>Salons ouverts <span class="count" id="roomCount">0</span></h2><span class="muted live"><i></i> en direct</span></div><div id="roomList" class="rooms"></div></section>`;
    const draw = () => {
      const cats = ['Tous', ...(hub.me?.favorites?.length ? ['⭐ Favoris'] : []), ...new Set(hub.games.map(g => g.category))];
      el.querySelector('#cats').innerHTML = cats.map(c => `<button class="chip ${c === cat ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
      el.querySelectorAll('[data-cat]').forEach(b => { b.onclick = () => { cat = b.dataset.cat; draw(); }; });
      const n = s => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
      const list = hub.games.filter(g => (cat === 'Tous' || g.category === cat || (cat === '⭐ Favoris' && hub.me?.favorites?.includes(g.id))) && (!search || n(`${g.name} ${g.desc} ${g.category}`).includes(n(search))));
      el.querySelector('#gameList').innerHTML = list.map(g => gameCard(g, hub)).join('') || '<div class="empty-rooms"><b>Aucun jeu trouvé</b>Essayez un autre mot.</div>';
      wire(el.querySelector('#gameList'), hub);
    };
    el.querySelector('#search').oninput = e => { search = e.target.value; draw(); };
    draw(); liveRooms(el, hub, alive);
  },

  // -------------------- NOUVEAUTÉS --------------------
  async nouveautes(el, _, hub) {
    el.innerHTML = `<h1 class="ptitle">✨ Nouveautés</h1><p class="muted">Les derniers jeux ajoutés à la Salle de Jeux.</p>
      <div class="timeline">${NEW.map(([id, d, txt]) => { const g = hub.games.find(x => x.id === id); if (!g) return ''; return `<div class="tl-item"><div class="tl-date">${dateFr(d)}</div>
        <div class="tl-card panel"><span class="tl-ico" style="background:${g.color}">${g.icon}</span><div><h3>${esc(g.name)}</h3><p class="muted">${esc(txt)}</p><div class="row"><button class="btn primary small" data-create="${g.id}">Créer un salon</button><button class="btn ghost small" data-quick="${g.id}">⚡ Partie rapide</button></div></div></div></div>`; }).join('')}</div>`;
  },

  // -------------------- CLASSEMENT --------------------
  async classement(el, param, hub, alive) {
    const L = await hub.api('leaderboards'); if (!alive()) return;
    let tab = param || 'niveau';
    const row = (u, i, val) => `<a class="lb-row ${hub.me?.id === u.id ? 'me' : ''}" href="#/profil/${encodeURIComponent(u.name)}"><b class="pos">${['🥇', '🥈', '🥉'][i] || i + 1}</b>${avatarHTML(u, 36)}<span class="nm">${nameHTML(u)}${u.title ? `<small>${esc(u.title)}</small>` : ''}</span><span class="val">${val}</span></a>`;
    const draw = () => {
      let body = '';
      if (tab === 'niveau') body = L.xp.map((u, i) => row(u, i, `Nv ${u.level} <small>${u.xp} XP</small>`)).join('');
      if (tab === 'classe') body = `<div class="ranks">${L.ranks.map(r => `<span style="border-color:${r.color}">${r.icon} ${r.name}<small>${r.min}+</small></span>`).join('')}</div><p class="muted">Saison ${L.season} · la cote évolue lors des parties classées. Récompense de fin de saison selon votre rang.</p>`
        + (L.ranked.map((u, i) => row(u, i, `<span style="color:${u.rank.color}">${u.rank.icon} ${u.rating}</span> <small>${u.rated} parties</small>`)).join('') || '<div class="empty-rooms"><b>Aucune partie classée cette saison</b>Cochez « Partie classée » dans un salon !</div>');
      if (tab === 'records') body = L.records.length ? `<div class="recgrid">${L.records.map(r => `<div class="panel"><h3>${esc(r.game)}</h3><p class="muted">${esc(r.label)}</p>${r.rows.map((x, i) => `<a class="mini-row" href="#/profil/${encodeURIComponent(x.name)}"><b>${['🥇', '🥈', '🥉'][i] || i + 1}</b>${avatarHTML(x, 24)}<span>${esc(x.name)}</span><b class="ml">${esc(x.shown)}</b></a>`).join('')}</div>`).join('')}</div>` : '<div class="empty-rooms"><b>Aucun record pour l’instant</b>Jouez connecté pour inscrire les vôtres.</div>';
      if (tab === 'clans') body = L.clans.map((c, i) => `<div class="lb-row"><b class="pos">${['🥇', '🥈', '🥉'][i] || i + 1}</b><span class="uav" style="width:36px;height:36px"><span style="background:#334155">${c.emblem || '🛡️'}</span></span><span class="nm"><b>[${esc(c.tag)}] ${esc(c.name)}</b><small>${c.members} membre(s)</small></span><span class="val">${c.xp} XP</span></div>`).join('') || '<div class="empty-rooms"><b>Aucun clan</b>Créez le premier dans la page Amis !</div>';
      if (tab === 'riches') body = L.coins.map((u, i) => row(u, i, `🪙 ${u.coins ?? ''}`)).join('');
      el.innerHTML = `<h1 class="ptitle">🏆 Classements</h1><div class="chips">${[['niveau', '⭐ Niveau'], ['classe', '⚔️ Classé'], ['records', '📈 Records'], ['clans', '🛡️ Clans']].map(([k, l]) => `<button class="chip ${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div><div class="lb">${body}</div>`;
      el.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => { tab = b.dataset.tab; history.replaceState(null, '', location.pathname + location.search + '#/classement/' + tab); draw(); }; });
    };
    draw();
  },

  // -------------------- TOURNOIS --------------------
  async tournois(el, _, hub, alive) {
    const T = await hub.api('tournaments'); if (!alive()) return;
    const card = t => { const g = hub.games.find(x => x.id === t.game) || {};
      return `<div class="panel tour ${t.past ? 'past' : ''}"><div class="tour-head"><span class="tl-ico" style="background:${g.color}">${g.icon}</span><div><span class="kicker">${t.past ? 'Terminé' : t.kind === 'week' ? 'Tournoi de la semaine' : 'Tournoi éclair (24 h)'}</span><h3>${esc(g.name)}</h3><p class="muted">${esc(t.label)} · ${t.dir === 'min' ? 'le plus petit gagne' : 'le plus grand gagne'}</p></div>
        <div class="tour-time">${t.past ? `Fini ${ago(t.end)}` : `⏱ ${left(t.end - Date.now())}`}<small>🥇 ${t.prizes[0]} · 🥈 ${t.prizes[1]} · 🥉 ${t.prizes[2]} 🪙</small></div></div>
        <div class="lb">${t.rows.map((r, i) => `<a class="lb-row ${hub.me?.id === r.id ? 'me' : ''}" href="#/profil/${encodeURIComponent(r.name)}"><b class="pos">${['🥇', '🥈', '🥉'][i] || i + 1}</b>${avatarHTML(r, 30)}<span class="nm"><b>${esc(r.name)}</b></span><span class="val">${esc(r.shown)}</span></a>`).join('') || '<p class="muted">Aucun participant pour le moment.</p>'}</div>
        ${t.past ? '' : `<div class="row"><button class="btn primary" data-create="${t.game}">Participer : créer un salon</button><button class="btn ghost" data-quick="${t.game}">⚡ Partie rapide</button></div>`}</div>`; };
    el.innerHTML = `<h1 class="ptitle">🏆 Tournois</h1><p class="muted">Chaque jour et chaque semaine, un nouveau défi ! Votre <b>meilleur résultat</b> pendant la période compte. Les 3 premiers remportent des pièces et un succès. ${hub.me ? '' : '<b>Connectez-vous pour participer.</b>'}</p>
      <h2>En cours</h2><div class="tours">${T.list.filter(t => !t.past).map(card).join('')}</div>
      <h2>Derniers résultats</h2><div class="tours">${T.list.filter(t => t.past && t.rows.length).map(card).join('') || '<p class="muted">Pas encore de résultats.</p>'}</div>`;
  },

  // -------------------- BOUTIQUE --------------------
  async boutique(el, param, hub, alive) {
    const S = await hub.api('shop'); if (!alive()) return;
    let slot = param || 'color';
    const SLOTS = [['color', '🎨 Couleurs en jeu'], ['frame', '🖼️ Cadres'], ['emoji', '😺 Avatars'], ['title', '🏷️ Titres'], ['namecolor', '✒️ Pseudo']];
    const draw = () => {
      const me = hub.me, owned = new Set(me?.owned || []), eq = me?.equipped || {};
      const preview = it => it.slot === 'color' ? `<span class="swatch" style="background:${it.value || 'conic-gradient(#ef4444,#3b82f6,#22c55e,#eab308,#ef4444)'}"></span>`
        : it.slot === 'frame' ? avatarHTML({ ...me, avatar: me?.avatar || { emoji: '😎' }, frame: it.value }, 64)
        : it.slot === 'emoji' ? avatarHTML({ avatar: { emoji: it.value, bg: me?.avatar?.bg || '#6366f1' } }, 64)
        : it.slot === 'namecolor' ? `<b style="color:${it.value};font-size:20px">${esc(me?.name || 'Pseudo')}</b>` : `<span class="titleprev">${esc(it.name)}</span>`;
      el.innerHTML = `<div class="shop-head"><h1 class="ptitle">🛍️ Boutique</h1>${me ? `<span class="coinbig">🪙 ${me.coins}</span>${me.dailyReady ? '<button class="btn gold" data-daily>🎁 Récompense du jour</button>' : ''}` : ''}</div>
        <p class="muted">Gagnez des pièces en jouant, avec les défis du jour, les succès et les tournois. Les couleurs s’appliquent à votre personnage dans tous les jeux !</p>
        ${me ? '' : needLogin(hub, 'acheter des objets')}
        <div class="chips">${SLOTS.map(([k, l]) => `<button class="chip ${slot === k ? 'on' : ''}" data-slot="${k}">${l}</button>`).join('')}</div>
        <div class="shopgrid">${S.items.filter(i => i.slot === slot).map(it => { const own = owned.has(it.id), on = eq[it.slot] === it.id, lock = it.level && (me?.level || 0) < it.level;
          return `<div class="item ${own ? 'own' : ''} ${on ? 'on' : ''}"><div class="prev">${preview(it)}</div><b>${esc(it.name)}</b>
            ${it.level ? `<small class="${lock ? 'lock' : 'muted'}">${lock ? '🔒' : '✔'} Niveau ${it.level}</small>` : '<small class="muted">&nbsp;</small>'}
            ${!me ? `<span class="price">🪙 ${it.price}</span>` : own ? (on ? `<button class="btn small" data-unequip="${it.slot}">✔ Équipé</button>` : `<button class="btn primary small" data-equip="${it.id}">Équiper</button>`)
              : `<button class="btn gold small" data-buy="${it.id}" ${lock || me.coins < it.price ? 'disabled' : ''}>🪙 ${it.price}</button>`}</div>`; }).join('')}</div>`;
      el.querySelectorAll('[data-slot]').forEach(b => { b.onclick = () => { slot = b.dataset.slot; draw(); }; });
      el.querySelectorAll('[data-buy]').forEach(b => { b.onclick = async () => { try { hub.me = await hub.api('buy', { id: b.dataset.buy }); hub.toast('🛍️ Acheté !', 'gold'); draw(); } catch (e) { hub.toast(e.message, 'err'); } }; });
      el.querySelectorAll('[data-equip]').forEach(b => { b.onclick = async () => { try { hub.me = await hub.api('equip', { id: b.dataset.equip }); const it = S.items.find(i => i.id === b.dataset.equip); if (it.slot === 'emoji') { await hub.api('updateProfile', { avatar: { emoji: it.value } }); } hub.toast('✔ Équipé', 'ok'); draw(); } catch (e) { hub.toast(e.message, 'err'); } }; });
      el.querySelectorAll('[data-unequip]').forEach(b => { b.onclick = async () => { hub.me = await hub.api('equip', { slot: b.dataset.unequip }); draw(); }; });
      wireDaily(el, hub); wire(el, hub);
    };
    hub.on('me', () => { if (hub.page === 'boutique' && alive()) draw(); });
    draw();
  },

  // -------------------- AMIS / MESSAGES / CLANS --------------------
  async amis(el, param, hub, alive) {
    if (!hub.me) { el.innerHTML = `<h1 class="ptitle">👥 Amis</h1>${needLogin(hub, 'ajouter des amis, discuter en privé et rejoindre un clan')}`; return; }
    let F = await hub.api('friends'); if (!alive()) return;
    hub.friends = F;
    let tab = param === 'clan' ? 'clan' : 'amis';
    const draw = async () => {
      if (tab === 'clan') return drawClan();
      el.innerHTML = `<h1 class="ptitle">👥 Amis et social</h1><div class="chips"><button class="chip on">👥 Amis</button><button class="chip" data-tab="clan">🛡️ Clan</button></div>
        <div class="social">
          <div class="panel">
            <form class="row" id="addF"><input id="addName" placeholder="Pseudo d’un joueur…" maxlength="16" autocomplete="off"><button class="btn primary">Ajouter</button></form>
            <div id="sugg"></div>
            ${F.incoming.length ? `<h4>Demandes reçues</h4>${F.incoming.map(u => `<div class="mini-row">${avatarHTML(u, 30)}<span>${nameHTML(u)}</span><button class="btn ok small" data-acc="${u.id}">Accepter</button><button class="btn ghost small" data-ref="${u.id}">Refuser</button></div>`).join('')}` : ''}
            ${F.outgoing.length ? `<h4>Demandes envoyées</h4>${F.outgoing.map(u => `<div class="mini-row">${avatarHTML(u, 30)}<span>${esc(u.name)}</span><small class="muted">en attente…</small></div>`).join('')}` : ''}
            <h4>Mes amis (${F.friends.length})</h4>
            ${F.friends.map(u => `<div class="mini-row friend ${hub.openChat === u.id ? 'sel' : ''}" data-chat="${u.id}">${avatarHTML(u, 34)}<span><a href="#/profil/${encodeURIComponent(u.name)}">${nameHTML(u)}</a><small class="${u.online ? 'on' : 'muted'}">${u.online ? '● En ligne' : `Vu ${ago(u.lastSeen)}`}</small></span>
              ${u.unread ? `<b class="badge">${u.unread}</b>` : ''}${u.online && hub.room ? `<button class="btn primary small" data-inv="${u.id}">Inviter</button>` : ''}<button class="btn ghost small" data-chatbtn="${u.id}">💬</button></div>`).join('') || '<p class="muted">Ajoutez vos amis avec leur pseudo !</p>'}
          </div>
          <div class="panel dm" id="dm">${hub.openChat ? '' : '<div class="empty-rooms" style="border:0"><b>💬 Messages privés</b>Choisissez un ami pour discuter.</div>'}</div>
        </div>`;
      el.querySelector('[data-tab]').onclick = () => { tab = 'clan'; draw(); };
      const inp = el.querySelector('#addName');
      inp.oninput = async () => { const v = inp.value.trim(); const box = el.querySelector('#sugg'); if (v.length < 2) { box.innerHTML = ''; return; } const res = await hub.api('search', { q: v }); box.innerHTML = res.filter(u => u.id !== hub.me.id).slice(0, 5).map(u => `<div class="mini-row">${avatarHTML(u, 26)}<span>${nameHTML(u)} <small class="muted">Nv ${u.level}</small></span><button class="btn small" data-addn="${esc(u.name)}">+ Ajouter</button></div>`).join(''); box.querySelectorAll('[data-addn]').forEach(b => { b.onclick = () => add(b.dataset.addn); }); };
      const add = async name => { try { F = await hub.api('addFriend', { name }); hub.friends = F; hub.toast('Demande envoyée ✔', 'ok'); draw(); } catch (e) { hub.toast(e.message, 'err'); } };
      el.querySelector('#addF').onsubmit = e => { e.preventDefault(); if (inp.value.trim()) add(inp.value.trim()); };
      el.querySelectorAll('[data-acc]').forEach(b => { b.onclick = async () => { F = await hub.api('answerFriend', { id: +b.dataset.acc, accept: true }); hub.friends = F; draw(); }; });
      el.querySelectorAll('[data-ref]').forEach(b => { b.onclick = async () => { F = await hub.api('answerFriend', { id: +b.dataset.ref, accept: false }); hub.friends = F; draw(); }; });
      el.querySelectorAll('[data-inv]').forEach(b => { b.onclick = async e => { e.stopPropagation(); try { await hub.api('invite', { to: +b.dataset.inv }); hub.toast('Invitation envoyée ✔', 'ok'); } catch (er) { hub.toast(er.message, 'err'); } }; });
      el.querySelectorAll('[data-chat], [data-chatbtn]').forEach(b => { b.onclick = e => { if (e.target.closest('a,[data-inv]')) return; openChat(+(b.dataset.chat || b.dataset.chatbtn)); }; });
      if (hub.openChat) openChat(hub.openChat);
      hub.unread = F.friends.reduce((a, f) => a + f.unread, 0) + F.incoming.length; hub.badge();
    };
    const openChat = async id => {
      hub.openChat = id; const f = F.friends.find(x => x.id === id); if (!f) return;
      el.querySelectorAll('.friend').forEach(r => r.classList.toggle('sel', +r.dataset.chat === id));
      const msgs = await hub.api('conversation', { with: id }); f.unread = 0;
      const box = el.querySelector('#dm'); if (!box) return;
      box.innerHTML = `<div class="dm-head">${avatarHTML(f, 36)}<div>${nameHTML(f)}<small class="${f.online ? 'on' : 'muted'}">${f.online ? '● En ligne' : 'Hors ligne'}</small></div>
        <button class="btn ghost small" data-rm="${id}" title="Retirer des amis">Retirer</button></div><div class="dm-log"></div>
        <form class="chat-form"><input maxlength="500" placeholder="Message à ${esc(f.name)}…" autocomplete="off"><button class="btn primary">➤</button></form>`;
      const log = box.querySelector('.dm-log');
      const addMsg = m => { log.insertAdjacentHTML('beforeend', `<div class="bubble ${m.from === hub.me.id ? 'mine' : ''}">${esc(m.text)}<small>${ago(m.at)}</small></div>`); log.scrollTop = 1e9; };
      msgs.forEach(addMsg);
      box.querySelector('form').onsubmit = async e => { e.preventDefault(); const i = box.querySelector('input'); if (!i.value.trim()) return; try { addMsg(await hub.api('dm', { to: id, text: i.value })); i.value = ''; } catch (er) { hub.toast(er.message, 'err'); } };
      box.querySelector('[data-rm]').onclick = async () => { if (!confirm(`Retirer ${f.name} de vos amis ?`)) return; F = await hub.api('removeFriend', { id }); hub.friends = F; hub.openChat = null; draw(); };
      hub._dmAdd = m => { if (m.msg.from === id && document.body.contains(log)) addMsg(m.msg); };
      box.querySelector('input').focus();
      hub.unread = F.friends.reduce((a, x) => a + x.unread, 0) + F.incoming.length; hub.badge();
    };
    const drawClan = async () => {
      const c = await hub.api('clan');
      if (!alive()) return;
      if (c) {
        el.innerHTML = `<h1 class="ptitle">🛡️ Mon clan</h1><div class="chips"><button class="chip" data-tab="amis">👥 Amis</button><button class="chip on">🛡️ Clan</button></div>
          <div class="social"><div class="panel"><div class="clan-head"><span class="clan-emb">${c.emblem}</span><div><h2>[${esc(c.tag)}] ${esc(c.name)}</h2><p class="muted">${esc(c.descr || '')}</p><small class="muted">${c.members.length} membre(s) · ${c.xp} XP au total</small></div></div>
            <h4>Membres</h4>${c.members.map(u => `<a class="mini-row" href="#/profil/${encodeURIComponent(u.name)}">${avatarHTML(u, 30)}<span>${nameHTML(u)}${u.id === c.owner ? ' 👑' : ''}</span><small class="muted">Nv ${u.level}</small></a>`).join('')}
            <button class="btn danger small" data-leave style="margin-top:12px">Quitter le clan</button></div>
          <div class="panel dm"><h3>💬 Discussion du clan</h3><div class="dm-log">${c.msgs.map(m => `<div class="bubble ${m.name === hub.me.name ? 'mine' : ''}"><b>${esc(m.name)}</b> ${esc(m.text)}<small>${ago(m.at)}</small></div>`).join('')}</div>
            <form class="chat-form"><input maxlength="300" placeholder="Message au clan…"><button class="btn primary">➤</button></form></div></div>`;
        const log = el.querySelector('.dm-log'); log.scrollTop = 1e9;
        el.querySelector('form').onsubmit = async e => { e.preventDefault(); const i = el.querySelector('form input'); if (!i.value.trim()) return; try { await hub.api('clanSay', { text: i.value }); i.value = ''; } catch (er) { hub.toast(er.message, 'err'); } };
        hub._clanAdd = m => { if (document.body.contains(log)) { log.insertAdjacentHTML('beforeend', `<div class="bubble ${m.name === hub.me.name ? 'mine' : ''}"><b>${esc(m.name)}</b> ${esc(m.text)}<small>${ago(m.at)}</small></div>`); log.scrollTop = 1e9; } };
        el.querySelector('[data-leave]').onclick = async () => { if (confirm('Quitter le clan ?')) { await hub.api('leaveClan'); drawClan(); } };
      } else {
        const list = await hub.api('clans', { search: '' });
        el.innerHTML = `<h1 class="ptitle">🛡️ Clans</h1><div class="chips"><button class="chip" data-tab="amis">👥 Amis</button><button class="chip on">🛡️ Clan</button></div>
          <div class="social"><div class="panel"><h3>Rejoindre un clan</h3>${list.map(c => `<div class="mini-row"><span class="uav" style="width:32px;height:32px"><span style="background:#334155">${c.emblem}</span></span><span><b>[${esc(c.tag)}] ${esc(c.name)}</b><small class="muted">${c.members}/30 · ${c.xp} XP</small></span><button class="btn primary small" data-join="${c.id}">Rejoindre</button></div>`).join('') || '<p class="muted">Aucun clan pour l’instant.</p>'}</div>
          <form class="panel" id="newClan"><h3>Créer un clan <small class="muted">(500 🪙)</small></h3>
            <label class="fld"><span>Nom</span><input name="name" maxlength="20" required></label><label class="fld"><span>Tag (2 à 4 caractères)</span><input name="tag" maxlength="4" required style="text-transform:uppercase"></label>
            <label class="fld"><span>Description</span><input name="descr" maxlength="200"></label>
            <div class="emopick">${['🛡️', '⚔️', '🐉', '👑', '🔥', '🦁', '🐺', '🦅', '💀', '⭐', '🌙', '⚡'].map((e, i) => `<label><input type="radio" name="emblem" value="${e}" ${i ? '' : 'checked'}><span>${e}</span></label>`).join('')}</div>
            <button class="btn primary">Créer le clan</button></form></div>`;
        el.querySelectorAll('[data-join]').forEach(b => { b.onclick = async () => { try { await hub.api('joinClan', { id: +b.dataset.join }); drawClan(); } catch (e) { hub.toast(e.message, 'err'); } }; });
        el.querySelector('#newClan').onsubmit = async e => { e.preventDefault(); const f = new FormData(e.target); try { await hub.api('createClan', Object.fromEntries(f)); hub.toast('🛡️ Clan créé !', 'gold'); drawClan(); } catch (er) { hub.toast(er.message, 'err'); } };
      }
      el.querySelector('[data-tab]').onclick = () => { tab = 'amis'; draw(); };
    };
    if (!hub._socialWired) {
      hub._socialWired = true;
      hub.on('dm', m => { hub._dmAdd?.(m); });
      hub.on('clan', m => { hub._clanAdd?.(m); });
      hub.on('presence', () => { if (hub.page === 'amis' && tab === 'amis') hub.api('friends').then(f => { F = f; hub.friends = f; }); });
    }
    draw();
  },

  // -------------------- PROFIL --------------------
  async profil(el, name, hub, alive) {
    if (!name && !hub.me) { el.innerHTML = `<h1 class="ptitle">👤 Profil</h1>${needLogin(hub, 'avoir un profil, des statistiques et des succès')}`; return; }
    const P = await hub.api('profile', { name: name || hub.me.name }); if (!alive()) return;
    const u = P.user, mine = hub.me?.id === u.id, gname = id => P.games[id] || id;
    const unlocked = new Map(P.achievements.map(a => [a.ach, a.at]));
    const ch = mine ? await hub.api('challenges').catch(() => []) : [];
    let tab = 'stats';
    const winrate = u.games ? Math.round(u.wins / u.games * 100) : 0;
    const draw = () => {
      let body = '';
      if (tab === 'stats') body = `<div class="statgrid"><div class="stat"><b>${u.games}</b>parties</div><div class="stat"><b>${u.wins}</b>victoires</div><div class="stat"><b>${winrate} %</b>de victoires</div><div class="stat"><b>${Math.round(u.playtime / 3600 * 10) / 10} h</b>de jeu</div><div class="stat"><b>${unlocked.size}</b>succès</div><div class="stat"><b>${u.rank.icon} ${u.rating}</b>cote (max ${u.peak})</div></div>
        <h3>Par jeu</h3><div class="lb">${P.stats.map(s => `<div class="lb-row"><span class="nm"><b>${esc(gname(s.game))}</b><small>${s.played} partie(s)</small></span><span class="val">${s.wins} victoire(s) · ${Math.round(s.wins / s.played * 100)} %</span></div>`).join('') || '<p class="muted">Aucune partie terminée.</p>'}</div>
        ${u.favorites.length ? `<h3>⭐ Jeux favoris</h3><div class="chips">${u.favorites.map(f => `<a class="chip" href="#/jeux">${esc(gname(f))}</a>`).join('')}</div>` : ''}`;
      if (tab === 'records') body = `<div class="lb">${P.records.map(r => `<div class="lb-row"><span class="nm"><b>${esc(r.game)}</b><small>${esc(r.label)}</small></span><span class="val">${esc(fmtRec(r))}</span><small class="muted">${ago(r.at)}</small></div>`).join('') || '<p class="muted">Aucun record enregistré. Jouez connecté pour en établir !</p>'}</div>`;
      if (tab === 'history') body = `<div class="lb">${P.history.map(h => `<div class="lb-row"><b class="pos">${h.win ? '🏆' : h.place === 1 ? '🥇' : '🎮'}</b><span class="nm"><b>${esc(gname(h.game))}</b><small>${ago(h.at)} · ${h.place}e / ${h.total}${h.ranked ? ` · ⚔️ classée ${h.delta >= 0 ? '+' : ''}${h.delta}` : ''}</small></span><span class="val">${esc(h.score)}<small>+${h.xp} XP · +${h.coins} 🪙</small></span></div>`).join('') || '<p class="muted">Aucune partie pour le moment.</p>'}</div>`;
      if (tab === 'ach') body = `<p class="muted">${unlocked.size} / ${P.allAch.length} succès débloqués</p><div class="achgrid">${P.allAch.map(a => `<div class="ach ${unlocked.has(a.id) ? 'got' : ''}"><span>${a.icon}</span><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>${unlocked.has(a.id) ? `<small class="on">✔ ${ago(unlocked.get(a.id))}</small>` : a.coins ? `<small class="muted">🪙 ${a.coins}</small>` : ''}</div>`).join('')}</div>`;
      if (tab === 'defis') body = `${hub.me.dailyReady ? `<button class="btn gold" data-daily>🎁 Récompense du jour (série : ${hub.me.streak})</button>` : `<p class="muted">✔ Récompense du jour récupérée · série de ${hub.me.streak} jour(s)</p>`}${challengesHTML(ch)}<p class="muted">Nouveaux défis chaque jour à minuit (heure UTC).</p>`;
      el.innerHTML = `<div class="prof-head panel">${avatarHTML(u, 110)}
        <div class="prof-main"><h1>${nameHTML(u)} ${P.online ? '<span class="onl">● en ligne</span>' : ''}</h1>${u.title ? `<span class="titleprev">${esc(u.title)}</span>` : ''}
          <p class="muted">${u.clan ? `🛡️ <b>[${esc(u.clan.tag)}] ${esc(u.clan.name)}</b> · ` : ''}Inscrit le ${dateFr(u.created)}</p><p class="bio">${esc(u.bio || (mine ? 'Ajoutez une description…' : ''))}</p>
          <div class="lvl"><span class="lvlb">${u.level}</span><div style="flex:1"><div class="xpbar"><b style="width:${u.xpCur / u.xpNext * 100}%"></b></div><small class="muted">Niveau ${u.level} · ${u.xpCur} / ${u.xpNext} XP</small></div><span class="rankb" style="border-color:${u.rank.color}">${u.rank.icon} ${u.rank.name}</span></div>
          <div class="row">${mine ? '<button class="btn ghost small" data-edit>✏️ Modifier le profil</button><button class="btn ghost small" data-logout>Se déconnecter</button>' : hub.me ? `<button class="btn primary small" data-addf="${esc(u.name)}">+ Ajouter en ami</button>` : ''}</div></div></div>
        <div class="chips">${[['stats', '📊 Statistiques'], ['records', '📈 Records'], ['history', '🕘 Historique'], ['ach', '🏆 Succès'], ...(mine ? [['defis', '🎯 Défis du jour']] : [])].map(([k, l]) => `<button class="chip ${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
        <div class="panel">${body}</div>`;
      el.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => { tab = b.dataset.tab; draw(); }; });
      el.querySelector('[data-logout]')?.addEventListener('click', () => hub.logout());
      el.querySelector('[data-addf]')?.addEventListener('click', async e => { try { await hub.api('addFriend', { name: e.target.dataset.addf }); hub.toast('Demande d’ami envoyée ✔', 'ok'); } catch (er) { hub.toast(er.message, 'err'); } });
      el.querySelector('[data-edit]')?.addEventListener('click', () => editProfile(el, u, hub));
      wireDaily(el, hub);
    };
    draw();
  },

  // -------------------- ACTUALITÉS --------------------
  async actus(el, _, hub) {
    const N = await hub.api('news');
    el.innerHTML = `<h1 class="ptitle">📰 Actualités</h1><div class="news">${N.news.map(n => `<article class="panel"><span class="tag">${esc(n.tag)}</span> <small class="muted">${dateFr(n.date)}</small><h2>${esc(n.title)}</h2><p>${esc(n.text)}</p></article>`).join('')}</div>`;
  },

  // -------------------- AIDE --------------------
  async support(el, _, hub) {
    const N = await hub.api('news');
    el.innerHTML = `<h1 class="ptitle">🛟 Aide et contact</h1><div class="support"><div><h2>Questions fréquentes</h2>${N.faq.map(([q, a]) => `<details class="panel faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
      <form class="panel" id="ticket"><h2>Nous contacter</h2><p class="muted">Un bug, une idée de jeu, un problème de compte ? Écrivez-nous.</p>
        <label class="fld"><span>Votre nom</span><input name="name" maxlength="40" value="${esc(hub.me?.name || '')}"></label>
        <label class="fld"><span>E-mail ou Discord (pour vous répondre)</span><input name="contact" maxlength="80"></label>
        <label class="fld"><span>Sujet</span><select name="subject"><option>Bug</option><option>Idée / suggestion</option><option>Problème de compte</option><option>Signaler un joueur</option><option>Autre</option></select></label>
        <label class="fld"><span>Message</span><textarea name="text" rows="6" maxlength="2000" required></textarea></label>
        <button class="btn primary">Envoyer</button></form></div>`;
    el.querySelector('#ticket').onsubmit = async e => { e.preventDefault(); try { await hub.api('ticket', Object.fromEntries(new FormData(e.target))); e.target.reset(); hub.toast('Merci ! Message envoyé ✔', 'ok'); } catch (er) { hub.toast(er.message, 'err'); } };
  },
};
PAGES.profile = PAGES.profil;

function fmtRec(r) {
  if (r.key.startsWith('kart:time:')) { const s = r.value; return `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`; }
  const f = { 'zombie:wave': v => `Vague ${v}`, 'towers:wave': v => `Vague ${v}`, 'quest:level': v => `Niveau ${v}`, 'blackjack:chips': v => `🪙 ${v}`, 'poker:chips': v => `🪙 ${v}`, 'carball:goals': v => `${v} ⚽`, 'empire:worth': v => `${v} €` }[r.key];
  return f ? f(r.value) : String(r.value);
}

// Éditeur d'avatar et de description
const FREE = ['😎', '🦊', '🐼', '🐸', '🦁', '🐙', '🤖', '👾', '🐱', '🐶', '🐵', '🦄', '🐲', '👻', '🎃', '🧙', '🥷', '🧛', '🧜', '🦖', '🐧', '🦉', '🐯', '🐨', '🍕', '⚽', '🎮', '🚀', '🌈', '🔥', '⭐', '💀', '🛡️', '⚔️', '🏰', '🐉', '👑'];
const PREMIUM = { emoji_dragon: '🐲', emoji_unicorn: '🦄', emoji_ninja: '🥷', emoji_crown: '👑', emoji_alien: '👽', emoji_wizard: '🧙‍♂️', emoji_vampire: '🧛', emoji_robot: '🦾', emoji_ghost: '👻', emoji_phoenix: '🐦‍🔥' };
const BGS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#ef4444', '#22c55e', '#0ea5e9', '#a855f7', '#64748b', '#111827', '#f97316', '#84cc16'];
function editProfile(el, u, hub) {
  const premium = ['🐲', '🦄', '🥷', '👑', '👽', '🧙‍♂️', '🧛', '🦾', '👻', '🐦‍🔥'];
  const ownedEm = (hub.me.owned || []).filter(i => i.startsWith('emoji_'));
  let av = { ...u.avatar };
  const d = document.createElement('div'); d.className = 'modal';
  const draw = () => {
    d.innerHTML = `<div class="panel modal-box"><h2>✏️ Modifier mon profil</h2><div class="row" style="align-items:center">${avatarHTML({ ...u, avatar: av }, 90)}<div class="muted">Choisissez un personnage et une couleur de fond. Plus d’avatars et de cadres dans la <a href="#/boutique/emoji">boutique</a> !</div></div>
      <h4>Personnage</h4><div class="emogrid">${[...new Set([...FREE.filter(e => !premium.includes(e)), ...ownedEm.map(i => PREMIUM[i]).filter(Boolean)])].map(e => `<button class="${av.emoji === e ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div>
      <h4>Fond</h4><div class="emogrid">${BGS.map(c => `<button class="${av.bg === c ? 'on' : ''}" data-bg="${c}" style="background:${c}"></button>`).join('')}</div>
      <h4>Description</h4><textarea id="bio" maxlength="200" rows="3">${esc(u.bio || '')}</textarea>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-x>Annuler</button><button class="btn primary" data-save>Enregistrer</button></div></div>`;
    d.querySelectorAll('[data-e]').forEach(b => { b.onclick = () => { av.emoji = b.dataset.e; draw(); }; });
    d.querySelectorAll('[data-bg]').forEach(b => { b.onclick = () => { av.bg = b.dataset.bg; draw(); }; });
    d.querySelector('[data-x]').onclick = () => d.remove();
    d.querySelector('[data-save]').onclick = async () => { try { await hub.api('updateProfile', { avatar: av, bio: d.querySelector('#bio').value }); d.remove(); hub.toast('Profil enregistré ✔', 'ok'); hub.refresh(); } catch (e) { hub.toast(e.message, 'err'); } };
  };
  draw(); document.body.appendChild(d);
}
