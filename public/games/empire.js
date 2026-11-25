// Affichage : Empire
(function () {
  const DICE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const CORNER_ICON = { start: '🏁<br>Départ<br><small>+200</small>', jail: '🚓<br>Prison', park: '🌳<br>Parc gratuit', gotojail: '👮<br>Allez en prison' };

  function gridPos(i) {
    if (i <= 6) return [7, 7 - i];
    if (i <= 12) return [7 - (i - 6), 1];
    if (i <= 18) return [1, 1 + (i - 12)];
    return [1 + (i - 18), 7];
  }

  window.GAME_UI.empire = {
    render(el, s, ctx) {
      const me = ctx.me, pl = s.players[me];
      const myTurn = !s.over && s.turn === me;
      const ownsGroup = (g) => s.squares.every((q, i) => q.group !== g || s.props[i].owner === me);

      let board = '<div class="empire">';
      s.squares.forEach((q, i) => {
        const [r, c] = gridPos(i);
        const pr = s.props[i];
        const tokens = s.players.map((p, k) => (p.alive && p.pos === i ? `<span class="tok" style="background:${ctx.colors[k]}" title="${escapeHtml(ctx.names[k])}"></span>` : '')).join('');
        if (CORNER_ICON[q.type]) {
          board += `<div class="sqr corner" style="grid-row:${r};grid-column:${c}">${CORNER_ICON[q.type]}${q.type === 'park' && s.pot ? `<small>💰 ${s.pot}</small>` : ''}<div class="tokens">${tokens}</div></div>`;
          return;
        }
        const band = q.group !== undefined ? `<div class="band" style="background:${s.groups[q.group].color}"></div>` : '';
        const icon = q.type === 'chance' ? '❓' : q.type === 'tax' ? '💸' : q.type === 'gare' ? '🚂' : '';
        const houses = pr && pr.houses ? (pr.houses === 5 ? '🏨' : '🏠'.repeat(pr.houses)) : '';
        board += `<div class="sqr" style="grid-row:${r};grid-column:${c}" title="${escapeHtml(q.name)}">${band}
          <span class="nm">${icon} ${escapeHtml(q.name)}</span><span class="houses">${houses}</span>
          <span class="pr">${q.price ? q.price + ' €' : q.amount ? '-' + q.amount : ''}</span>
          ${pr && pr.owner >= 0 ? `<span class="owner" style="background:${ctx.colors[pr.owner]}"></span>` : ''}
          <div class="tokens">${tokens}</div></div>`;
      });

      // Centre du plateau
      let actions = '';
      if (myTurn) {
        if (s.phase === 'roll') actions = (pl.jail ? `<button class="btn ghost" data-a="payJail">Payer 50 pour sortir</button>` : '') + `<button class="btn" data-a="roll">🎲 Lancer les dés</button>`;
        if (s.phase === 'buy') { const q = s.squares[pl.pos]; actions = `<button class="btn" data-a="buy">Acheter ${escapeHtml(q.name)} (${q.price} €)</button><button class="btn ghost" data-a="skip">Ne pas acheter</button>`; }
        if (s.phase === 'manage') actions = `<button class="btn" data-a="end">Fin du tour ➜</button>`;
      }
      board += `<div class="empire-center">
        <div class="row" style="justify-content:space-between"><b style="font-family:Outfit;font-size:1.3rem">🏙️ EMPIRE</b><span class="hint" style="color:#b8dcc7">Tour ${s.round}/${s.maxRounds}</span></div>
        <div class="dice"><div class="die">${DICE[s.dice[0]]}</div><div class="die">${DICE[s.dice[1]]}</div></div>
        ${s.card ? `<div class="card-chance">🎴 ${escapeHtml(s.card)}</div>` : ''}
        <div class="row" style="justify-content:center">${actions}</div>
        <div class="empire-log">${s.log.map(l => `<div>${escapeHtml(l)}</div>`).join('')}</div>
      </div></div>`;

      // Panneau joueurs + propriétés
      const money = s.players.map((p, k) => `<div class="row" style="justify-content:space-between;${p.alive ? '' : 'opacity:.4'}">
        <span><span class="dot" style="background:${ctx.colors[k]}"></span> ${escapeHtml(ctx.names[k])}${p.jail ? ' 🚓' : ''}${s.turn === k ? ' 🎲' : ''}</span><b>${p.alive ? p.money + ' €' : 'Ruiné'}</b></div>`).join('');
      const mine = s.squares.map((q, i) => ({ q, i, pr: s.props[i] })).filter(x => x.pr && x.pr.owner === me);
      const props = mine.length ? mine.map(({ q, i, pr }) => {
        const can = q.type === 'prop' && ownsGroup(q.group);
        return `<div class="row" style="justify-content:space-between;font-size:.85rem">
          <span><span class="dot" style="background:${q.group !== undefined ? s.groups[q.group].color : '#888'}"></span> ${escapeHtml(q.name)} ${pr.houses === 5 ? '🏨' : '🏠'.repeat(pr.houses)}</span>
          ${can && myTurn ? `<span><button class="btn small ghost" data-sell="${i}" ${pr.houses ? '' : 'disabled'}>−</button> <button class="btn small" data-build="${i}" ${pr.houses < 5 ? '' : 'disabled'}>+ ${s.groups[q.group].house}</button></span>` : ''}
        </div>`;
      }).join('') : '<p class="hint">Aucune propriété pour l\'instant.</p>';

      el.innerHTML = `<div class="row" style="align-items:flex-start;gap:18px">
        <div style="flex:1 1 520px;max-width:680px">${board}</div>
        <div class="panel money-list" style="flex:1 1 240px;display:flex;flex-direction:column;gap:6px">
          <h3 style="margin:0">💰 Fortunes</h3>${money}
          <h3 style="margin:10px 0 0">🏠 Mes propriétés</h3>${props}
          <p class="hint">Complète une couleur pour construire (bouton +). Les maisons se construisent pendant ton tour.</p>
        </div></div>`;

      el.onclick = (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.a) ctx.send({ type: b.dataset.a });
        if (b.dataset.build) ctx.send({ type: 'build', square: Number(b.dataset.build) });
        if (b.dataset.sell) ctx.send({ type: 'sell', square: Number(b.dataset.sell) });
      };
    },
  };
})();
