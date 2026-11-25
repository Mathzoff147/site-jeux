// Affichage : Kolor
(function () {
  const LABEL = { passe: '⊘', inverse: '⇄', joker: '★', '+2': '+2', '+4': '+4' };
  const HEX = { rouge: '#e8334a', jaune: '#f2b705', vert: '#23a35a', bleu: '#2f6fd1' };
  let pendingWild = null;

  const card = (c, extra = '', attrs = '') =>
    `<button class="kcard ${c.color} ${extra}" ${attrs}><span class="corner">${LABEL[c.value] || c.value}</span><span>${LABEL[c.value] || c.value}</span></button>`;

  window.GAME_UI.kolor = {
    render(el, s, ctx) {
      const top = s.discard[s.discard.length - 1];
      const myTurn = !s.over && s.turn === ctx.me;
      const canPlay = (c) => myTurn && (c.color === 'noir' || c.color === s.color || c.value === top.value) && (!s.drew || c.id === s.hand[s.hand.length - 1].id);
      if (!myTurn) pendingWild = null;

      const opps = s.counts.map((n, i) => i === ctx.me ? '' : `<div class="opp ${s.turn === i ? 'turn' : ''}">
        <span class="avatar" style="width:28px;height:28px;font-size:.8rem;background:${ctx.colors[i]}">${escapeHtml((ctx.names[i] || '?')[0].toUpperCase())}</span>
        <b>${escapeHtml(ctx.names[i] || '')}</b><span class="kcard back small" style="width:22px;height:32px;border-width:2px"></span> × ${n}${n === 1 ? ' <b style="color:var(--amber)">KOLOR !</b>' : ''}</div>`).join('');

      let html = `<div class="kolor-table">
        <div class="opponents">${opps}</div>
        <div class="pile">
          <div class="center"><button class="kcard back" data-draw="1" ${myTurn && !s.drew ? '' : 'disabled'}><span>🂠</span></button><span class="hint">Pioche (${s.deckCount})</span></div>
          <div class="center">${card(top, '', 'disabled')}<span class="hint">Couleur : <span class="current-color" style="background:${HEX[s.color]}"></span> ${s.color} ${s.dir === 1 ? '↻' : '↺'}</span></div>
        </div>
        <p class="hint">${s.logBy !== undefined && s.log ? `<b style="color:${ctx.colors[s.logBy]}">${escapeHtml(ctx.names[s.logBy] || '')}</b> ${escapeHtml(s.log)}` : ''}</p>`;
      if (pendingWild !== null) html += `<div class="center"><b>Choisis la couleur :</b><div class="color-choice">${Object.entries(HEX).map(([n, h]) => `<button data-color="${n}" style="background:${h}" aria-label="${n}"></button>`).join('')}</div></div>`;
      if (myTurn && s.drew) html += `<button class="btn ghost" data-pass="1">Passer mon tour</button>`;
      html += `<div class="hand">${s.hand.map(c => card(c, canPlay(c) ? 'ok' : myTurn ? 'no' : '', `data-card="${c.id}"`)).join('')}</div></div>`;
      el.innerHTML = html;

      el.onclick = (e) => {
        const b = e.target.closest('button');
        if (!b || !myTurn) return;
        if (b.dataset.draw) return ctx.send({ type: 'draw' });
        if (b.dataset.pass) return ctx.send({ type: 'pass' });
        if (b.dataset.color && pendingWild !== null) { ctx.send({ type: 'play', card: pendingWild, color: b.dataset.color }); pendingWild = null; return; }
        if (b.dataset.card) {
          const c = s.hand.find(x => x.id === Number(b.dataset.card));
          if (!c || !canPlay(c)) return;
          if (c.color === 'noir') { pendingWild = c.id; this.render(el, s, ctx); return; }
          ctx.send({ type: 'play', card: c.id });
        }
      };
    },
  };
})();
