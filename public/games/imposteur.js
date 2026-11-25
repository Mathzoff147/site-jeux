// Affichage : Imposteur
(function () {
  window.GAME_UI.imposteur = {
    render(el, s, ctx) {
      const me = ctx.me;
      const alive = s.alive[me];
      let html = '<div class="center">';
      html += `<div class="word-card"><div class="hint" style="color:#fff;opacity:.85">Ton mot secret</div><div class="w">${escapeHtml(s.myWord)}</div></div>`;
      html += `<p class="hint">Manche ${s.round} · ${s.alive.filter(Boolean).length} joueurs en jeu${alive ? '' : ' · <b style="color:#ff4d5e">tu es éliminé</b>'}</p>`;
      if (s.log) html += `<p>${s.logBy !== null && s.logBy !== undefined ? `<b style="color:${ctx.colors[s.logBy]}">${escapeHtml(ctx.names[s.logBy])}</b> ` : ''}${escapeHtml(s.log)}</p>`;

      // Indices de la manche
      html += '<div class="clues">' + s.order.map(p => {
        const clue = s.clues.find(c => c.p === p);
        const speaking = s.phase === 'clue' && s.turn === p;
        return `<div class="clue" style="${speaking ? 'outline:2px solid var(--amber)' : ''}"><b style="color:${ctx.colors[p]}">${escapeHtml(ctx.names[p])}</b><span>${clue ? '💬 ' + escapeHtml(clue.text) : speaking ? '✍️ réfléchit…' : '…'}</span></div>`;
      }).join('') + '</div>';

      if (!s.over && s.phase === 'clue' && s.turn === me) {
        html += `<form id="imp-form" class="row"><input id="imp-clue" maxlength="30" placeholder="Ton indice en un mot" autocomplete="off" style="width:260px"><button class="btn">Donner mon indice</button></form>`;
      }
      if (!s.over && s.phase === 'vote') {
        const voted = s.votes[me];
        html += alive ? `<h3>🗳️ Qui est l'imposteur ?</h3><div class="vote-grid">${s.alive.map((a, p) => a && p !== me ? `<button class="${voted === p ? 'voted' : ''}" data-vote="${p}">${escapeHtml(ctx.names[p])}</button>` : '').join('')}</div>
          <p class="hint">${Object.keys(s.votes).length} / ${s.alive.filter(Boolean).length} votes</p>` : '<p class="hint">Les survivants votent…</p>';
      }
      if (s.eliminated.length) html += `<p class="hint">Éliminés : ${s.eliminated.map(e => `${escapeHtml(ctx.names[e.p])} (${e.impostor ? 'imposteur 😈' : 'civil'})`).join(', ')}</p>`;
      if (s.over && s.reveal) {
        html += `<div class="panel" style="text-align:center"><p>Mot des civils : <b>${escapeHtml(s.reveal.civilWord)}</b> · Mot de l'imposteur : <b>${escapeHtml(s.reveal.impostorWord)}</b></p>
          <p>Imposteur${s.reveal.impostors.length > 1 ? 's' : ''} : ${s.reveal.impostors.map(p => `<b style="color:${ctx.colors[p]}">${escapeHtml(ctx.names[p])}</b>`).join(', ')}</p></div>`;
      }
      if (s.history.length) {
        html += `<details class="panel" style="width:100%;max-width:520px"><summary>Manches précédentes</summary>${s.history.map(h => `<p class="hint">Manche ${h.round} : ${h.clues.map(c => `${escapeHtml(ctx.names[c.p])} « ${escapeHtml(c.text)} »`).join(', ')}</p>`).join('')}</details>`;
      }
      html += '</div>';
      el.innerHTML = html;

      const form = el.querySelector('#imp-form');
      if (form) {
        el.querySelector('#imp-clue').focus();
        form.onsubmit = (e) => { e.preventDefault(); ctx.send({ type: 'clue', text: el.querySelector('#imp-clue').value }); };
      }
      el.onclick = (e) => { const b = e.target.closest('[data-vote]'); if (b) ctx.send({ type: 'vote', target: Number(b.dataset.vote) }); };
    },
  };
})();
