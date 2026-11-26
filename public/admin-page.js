// =====================================================================
//  Page d'administration (administrateurs et modérateurs)
// =====================================================================
import { avatarHTML, nameHTML } from './pages.js';

const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = t => { if (!t) return '—'; const s = (Date.now() - t) / 1000; if (s < 60) return 'à l’instant'; if (s < 3600) return `${Math.floor(s / 60)} min`; if (s < 86400) return `${Math.floor(s / 3600)} h`; return `${Math.floor(s / 86400)} j`; };
const ROLE = { user: 'Joueur', mod: 'Modérateur', admin: 'Administrateur' };

export async function adminPage(el, param, hub, alive) {
  if (!hub.me || !['admin', 'mod'].includes(hub.me.role)) {
    el.innerHTML = `<h1 class="ptitle">🛡️ Administration</h1><div class="empty-rooms"><b>Accès réservé</b>Cette page est réservée aux administrateurs et modérateurs.</div>`;
    return;
  }
  const isAdmin = hub.me.role === 'admin';
  let tab = param || 'tableau', O = await hub.api('admin.overview');
  if (!alive()) return;
  const TABS = [['tableau', '📊 Tableau de bord'], ['comptes', '👤 Comptes'], ['salons', '🎮 Salons'], ...(isAdmin ? [['jeux', '🕹️ Jeux'], ['contenu', '📢 Annonce & actus']] : []), ['aide', `🛟 Messages${O.tickets ? ` (${O.tickets})` : ''}`], ['clans', '🛡️ Clans'], ['journal', '📜 Journal']];
  const go = t => { tab = t; history.replaceState(null, '', location.pathname + location.search + '#/admin/' + t); draw(); };
  const act = async (m, a, ok) => { try { const r = await hub.api(m, a); if (ok) hub.toast(ok, 'ok'); return r; } catch (e) { hub.toast(e.message, 'err'); throw e; } };

  async function draw() {
    el.innerHTML = `<h1 class="ptitle">🛡️ Administration <span class="rbadge ${hub.me.role}">${ROLE[hub.me.role]}</span></h1>
      <div class="chips">${TABS.map(([k, l]) => `<button class="chip ${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div><div id="adm"></div>`;
    el.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => go(b.dataset.tab); });
    const box = el.querySelector('#adm');
    await (VIEWS[tab] || VIEWS.tableau)(box);
  }

  const VIEWS = {
    // ---------- Tableau de bord ----------
    async tableau(box) {
      O = await hub.api('admin.overview');
      const pop = Object.entries(O.popularity).sort((a, b) => b[1] - a[1]);
      const max = Math.max(1, ...pop.map(p => p[1]));
      box.innerHTML = `<div class="statgrid">
        <div class="stat"><b>${O.stats.users}</b>comptes</div><div class="stat"><b>${O.online}</b>en ligne</div><div class="stat"><b>${O.users24}</b>inscrits (24 h)</div>
        <div class="stat"><b>${O.stats.games}</b>parties jouées</div><div class="stat"><b>${O.games24}</b>parties (24 h)</div><div class="stat"><b>${O.rooms.length}</b>salons ouverts</div><div class="stat"><b>${O.tickets}</b>messages à traiter</div></div>
        <div class="adm-cols"><div class="panel"><h3>Parties par jeu</h3>${pop.map(([g, n]) => `<div class="barrow"><span>${esc(hub.games.find(x => x.id === g)?.name || g)}</span><div><b style="width:${n / max * 100}%"></b></div><small>${n}</small></div>`).join('') || '<p class="muted">Aucune partie pour l’instant.</p>'}</div>
        <div class="panel"><h3>Dernières actions</h3>${logHTML(O.log.slice(0, 10))}</div></div>`;
    },
    // ---------- Comptes ----------
    async comptes(box) {
      box.innerHTML = `<div class="adm-cols wide"><div class="panel"><input id="us" placeholder="🔎 Rechercher un pseudo…" autocomplete="off"><div id="ul" class="adm-list"></div></div><div class="panel" id="ud"><p class="muted">Choisissez un compte.</p></div></div>`;
      const list = async () => {
        const users = await hub.api('admin.users', { search: box.querySelector('#us').value.trim() });
        box.querySelector('#ul').innerHTML = users.map(u => `<button class="adm-u" data-u="${u.id}"><span><b>${esc(u.name)}</b> ${u.role !== 'user' ? `<span class="rbadge ${u.role}">${ROLE[u.role]}</span>` : ''}${u.banned ? ' <span class="rbadge ban">BANNI</span>' : ''}${u.muted ? ' 🔇' : ''}</span><small class="muted">Nv ${u.level} · 🪙 ${u.coins} · ${u.games} parties · vu il y a ${ago(u.last_seen)}</small></button>`).join('') || '<p class="muted">Aucun compte.</p>';
        box.querySelectorAll('[data-u]').forEach(b => { b.onclick = () => detail(+b.dataset.u); });
      };
      let t; box.querySelector('#us').oninput = () => { clearTimeout(t); t = setTimeout(list, 250); };
      const detail = async id => {
        const u = await hub.api('admin.user', { id });
        const d = box.querySelector('#ud');
        d.innerHTML = `<div class="pp-head">${avatarHTML(u, 64)}<div><div class="pp-name">${nameHTML(u)}</div><small class="muted">#${u.id} · Nv ${u.level} · ${u.rank.icon} ${u.rating} · ${u.games} parties, ${u.wins} victoires · ${u.sessions} session(s)</small>
          <div><a href="#/profil/${encodeURIComponent(u.name)}">Voir le profil public →</a></div></div></div>
          ${u.banned ? `<div class="alert">⛔ Banni${u.banUntil ? ` jusqu’au ${new Date(u.banUntil).toLocaleString('fr-FR')}` : ' définitivement'} — ${esc(u.banReason)}</div>` : ''}
          ${u.mutedUntil > Date.now() ? `<div class="alert">🔇 En sourdine jusqu’à ${new Date(u.mutedUntil).toLocaleString('fr-FR')}</div>` : ''}
          <h4>🔨 Modération</h4>
          <div class="row"><select id="banH"><option value="1">1 heure</option><option value="24">24 heures</option><option value="168">7 jours</option><option value="0">Définitif</option></select><input id="banR" placeholder="Raison" maxlength="200">
            ${u.banned ? '<button class="btn ok small" data-a="unban">Débannir</button>' : '<button class="btn danger small" data-a="ban">Bannir</button>'}</div>
          <div class="row"><select id="muteM"><option value="10">10 min</option><option value="60">1 heure</option><option value="1440">24 heures</option></select>
            <button class="btn small" data-a="mute">🔇 Mettre en sourdine</button>${u.mutedUntil > Date.now() ? '<button class="btn ghost small" data-a="unmute">Retirer la sourdine</button>' : ''}</div>
          ${isAdmin ? `<h4>✏️ Modifier le compte</h4>
          <div class="adm-form"><label>Pseudo<input id="eName" value="${esc(u.name)}" maxlength="16"></label><label>Pièces<input id="eCoins" type="number" value="${u.coins}"></label><label>XP<input id="eXp" type="number" value="${u.xp}"></label><label>Cote<input id="eRating" type="number" value="${u.rating}"></label>
            <label class="full">Description<input id="eBio" value="${esc(u.bio)}" maxlength="200"></label><button class="btn primary small" data-a="edit">Enregistrer</button></div>
          <h4>🎁 Donner</h4><div class="row"><input id="gC" type="number" placeholder="Pièces" style="width:110px"><input id="gX" type="number" placeholder="XP" style="width:110px"><select id="gI"><option value="">— objet de la boutique —</option></select><button class="btn gold small" data-a="give">Donner</button></div>
          <h4>👑 Rôle</h4><div class="row"><select id="role">${Object.entries(ROLE).map(([k, l]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="btn small" data-a="role">Changer le rôle</button></div>
          <h4>⚠️ Zone dangereuse</h4><div class="row"><button class="btn ghost small" data-a="pass">Nouveau mot de passe</button><button class="btn ghost small" data-a="reset">Remettre les stats à zéro</button><button class="btn danger small" data-a="delete">Supprimer le compte</button></div>` : ''}
          <h4>Dernières parties</h4>${u.history.map(h => `<div class="mini-row"><span>${esc(hub.games.find(g => g.id === h.game)?.name || h.game)}<small class="muted">${h.place}e/${h.total} · il y a ${ago(h.at)}</small></span>${h.win ? '🏆' : ''}</div>`).join('') || '<p class="muted">Aucune.</p>'}`;
        if (isAdmin) hub.api('admin.items').then(items => { const s = d.querySelector('#gI'); if (s) s.innerHTML += items.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join(''); });
        const v = s => d.querySelector(s)?.value;
        d.querySelectorAll('[data-a]').forEach(b => {
          b.onclick = async () => {
            const a = b.dataset.a;
            try {
              if (a === 'ban') await act('admin.ban', { id, hours: +v('#banH'), reason: v('#banR') }, 'Compte banni');
              if (a === 'unban') await act('admin.unban', { id }, 'Compte débanni');
              if (a === 'mute') await act('admin.mute', { id, minutes: +v('#muteM') }, 'Sourdine appliquée');
              if (a === 'unmute') await act('admin.mute', { id, minutes: 0 }, 'Sourdine retirée');
              if (a === 'edit') await act('admin.edit', { id, name: v('#eName'), coins: v('#eCoins'), xp: v('#eXp'), rating: v('#eRating'), bio: v('#eBio') }, 'Compte modifié');
              if (a === 'give') await act('admin.give', { id, coins: +v('#gC') || 0, xp: +v('#gX') || 0, item: v('#gI') || null }, 'Cadeau envoyé 🎁');
              if (a === 'role') { if (!confirm(`Donner le rôle « ${ROLE[v('#role')]} » à ${u.name} ?`)) return; await act('admin.role', { id, role: v('#role') }, 'Rôle modifié'); }
              if (a === 'pass') { const p = prompt('Nouveau mot de passe (6 caractères min.) — laissez vide pour en générer un :', ''); if (p === null) return; const r = await act('admin.resetPassword', { id, pass: p }); alert(`Nouveau mot de passe de ${u.name} : ${r.pass}\nTransmettez-le-lui ; ses sessions ont été déconnectées.`); }
              if (a === 'reset') { if (!confirm(`Effacer statistiques, records, historique et cote de ${u.name} ?`)) return; await act('admin.resetStats', { id }, 'Statistiques remises à zéro'); }
              if (a === 'delete') { const c = prompt(`Suppression DÉFINITIVE. Tapez le pseudo « ${u.name} » pour confirmer :`); if (c === null) return; await act('admin.deleteUser', { id, confirm: c }, 'Compte supprimé'); d.innerHTML = '<p class="muted">Compte supprimé.</p>'; list(); return; }
              detail(id); list();
            } catch { }
          };
        });
      };
      list();
      if (param && /^\d+$/.test(param)) detail(+param);
    },
    // ---------- Salons ----------
    async salons(box) {
      const O2 = await hub.api('admin.overview');
      box.innerHTML = O2.rooms.length ? `<div class="lb">${O2.rooms.map(r => `<div class="panel adm-room"><div class="row"><b>${esc(r.gameName)}</b><span class="tag">${r.code}</span>${r.started ? '<span class="tag live-tag">en cours</span>' : '<span class="tag">en attente</span>'}${r.ranked ? '<span class="tag">⚔️ classée</span>' : ''}
          <span style="flex:1"></span><button class="btn ghost small" data-join="${r.code}">Rejoindre</button><button class="btn danger small" data-close="${r.code}">Fermer le salon</button></div>
          <div class="row">${r.players.map(p => `<span class="chip">${p.id === r.host ? '👑 ' : ''}${esc(p.name)}${p.uid ? '' : ' (invité)'} <button class="x" data-kick="${r.code}|${p.id}" title="Exclure">✕</button></span>`).join('')}</div></div>`).join('')}</div>`
        : '<div class="empty-rooms"><b>Aucun salon ouvert</b>Les salons apparaîtront ici en direct.</div>';
      box.querySelectorAll('[data-close]').forEach(b => { b.onclick = async () => { const r = prompt('Raison de la fermeture (facultatif) :', ''); if (r === null) return; await act('admin.closeRoom', { code: b.dataset.close, reason: r }, 'Salon fermé'); VIEWS.salons(box); }; });
      box.querySelectorAll('[data-kick]').forEach(b => { b.onclick = async () => { const [code, player] = b.dataset.kick.split('|'); await act('admin.kickFromRoom', { code, player }, 'Joueur exclu'); VIEWS.salons(box); }; });
      box.querySelectorAll('[data-join]').forEach(b => { b.onclick = () => hub.join(b.dataset.join); });
    },
    // ---------- Jeux ----------
    async jeux(box) {
      O = await hub.api('admin.overview');
      box.innerHTML = `<p class="muted">Un jeu désactivé disparaît du catalogue et plus personne ne peut créer de salon (sauf les administrateurs, pour tester). Les parties en cours continuent.</p>
        <div class="lb">${hub.games.map(g => { const off = O.disabled.includes(g.id); return `<div class="lb-row"><span class="tl-ico" style="background:${g.color};width:40px;height:40px;font-size:22px">${g.icon}</span><span class="nm"><b>${esc(g.name)}</b><small>${esc(g.category)} · ${O.popularity[g.id] || 0} parties jouées</small></span>
          <span class="${off ? 'muted' : 'on'}">${off ? '⏸ Désactivé' : '● Actif'}</span><button class="btn small ${off ? 'ok' : 'danger'}" data-g="${g.id}">${off ? 'Activer' : 'Désactiver'}</button></div>`; }).join('')}</div>`;
      box.querySelectorAll('[data-g]').forEach(b => { b.onclick = async () => { await act('admin.toggleGame', { game: b.dataset.g }, 'Jeu mis à jour'); VIEWS.jeux(box); }; });
    },
    // ---------- Annonce et actualités ----------
    async contenu(box) {
      const N = await hub.api('news');
      box.innerHTML = `<div class="adm-cols"><div class="panel"><h3>📢 Annonce en haut du site</h3><p class="muted">Affichée à tous les joueurs connectés, tout de suite.</p>
          <textarea id="ann" rows="3" maxlength="300" placeholder="Ex. : Maintenance ce soir à 22 h !">${esc(O.announcement?.text || '')}</textarea>
          <div class="row" style="margin-top:8px"><select id="annK"><option value="info">Information</option><option value="warn">Attention</option><option value="event">Évènement</option></select><button class="btn primary small" data-ann>Publier</button><button class="btn ghost small" data-annoff>Retirer</button></div></div>
        <form class="panel" id="newsF"><h3>📰 Publier une actualité</h3><label class="fld"><span>Étiquette</span><input name="tag" value="Info" maxlength="30"></label><label class="fld"><span>Titre</span><input name="title" maxlength="120" required></label>
          <label class="fld"><span>Texte</span><textarea name="text" rows="5" maxlength="3000" required></textarea></label><button class="btn primary">Publier</button></form></div>
        <h3>Actualités publiées</h3><div class="lb">${N.news.map(n => `<div class="lb-row"><span class="tag">${esc(n.tag)}</span><span class="nm"><b>${esc(n.title)}</b><small>${esc(n.date)}</small></span><button class="btn danger small" data-del="${n.id}">Supprimer</button></div>`).join('')}</div>`;
      box.querySelector('[data-ann]').onclick = async () => { O.announcement = await act('admin.announce', { text: box.querySelector('#ann').value, kind: box.querySelector('#annK').value }, 'Annonce publiée'); };
      box.querySelector('[data-annoff]').onclick = async () => { await act('admin.announce', { text: '' }, 'Annonce retirée'); box.querySelector('#ann').value = ''; };
      box.querySelector('#newsF').onsubmit = async e => { e.preventDefault(); await act('admin.newsAdd', Object.fromEntries(new FormData(e.target)), 'Actualité publiée'); VIEWS.contenu(box); };
      box.querySelectorAll('[data-del]').forEach(b => { b.onclick = async () => { if (!confirm('Supprimer cette actualité ?')) return; await act('admin.newsDelete', { id: +b.dataset.del }, 'Supprimée'); VIEWS.contenu(box); }; });
    },
    // ---------- Messages d'aide ----------
    async aide(box) {
      const T = await hub.api('admin.tickets');
      box.innerHTML = T.length ? T.map(t => `<div class="panel ticket ${t.done ? 'done' : ''}"><div class="row"><span class="tag">${esc(t.subject)}</span><b>${esc(t.name || t.account || 'Anonyme')}</b>${t.account ? `<a href="#/profil/${encodeURIComponent(t.account)}" class="muted">(compte ${esc(t.account)})</a>` : ''}
        <small class="muted">${new Date(t.at).toLocaleString('fr-FR')}</small><span style="flex:1"></span><button class="btn small ${t.done ? 'ghost' : 'ok'}" data-t="${t.id}">${t.done ? 'Rouvrir' : '✔ Traité'}</button></div>
        <p>${esc(t.text)}</p>${t.contact ? `<small class="muted">Contact : ${esc(t.contact)}</small>` : ''}</div>`).join('') : '<div class="empty-rooms"><b>Aucun message</b>Les messages du formulaire d’aide arriveront ici.</div>';
      box.querySelectorAll('[data-t]').forEach(b => { b.onclick = async () => { await act('admin.ticketDone', { id: +b.dataset.t }); VIEWS.aide(box); }; });
    },
    // ---------- Clans ----------
    async clans(box) {
      const L = await hub.api('admin.clans');
      box.innerHTML = `<div class="lb">${L.map(c => `<div class="lb-row"><span style="font-size:24px">${c.emblem}</span><span class="nm"><b>[${esc(c.tag)}] ${esc(c.name)}</b><small>${c.members} membre(s) · ${c.xp} XP</small></span>${isAdmin ? `<button class="btn danger small" data-c="${c.id}">Supprimer</button>` : ''}</div>`).join('') || '<p class="muted">Aucun clan.</p>'}</div>`;
      box.querySelectorAll('[data-c]').forEach(b => { b.onclick = async () => { if (!confirm('Supprimer ce clan ? Ses membres seront libérés.')) return; await act('admin.deleteClan', { id: +b.dataset.c }, 'Clan supprimé'); VIEWS.clans(box); }; });
    },
    // ---------- Journal ----------
    async journal(box) { O = await hub.api('admin.overview'); box.innerHTML = `<div class="panel">${logHTML(O.log)}</div>`; },
  };
  draw();
}
function logHTML(list) {
  return list.length ? `<div class="adm-log">${list.map(l => `<div><small class="muted">${new Date(l.at).toLocaleString('fr-FR')}</small> <b>${esc(l.admin || '?')}</b> — ${esc(l.action)} ${l.target ? `<b>${esc(l.target)}</b>` : ''} <span class="muted">${esc(l.detail)}</span></div>`).join('')}</div>` : '<p class="muted">Aucune action pour le moment.</p>';
}
