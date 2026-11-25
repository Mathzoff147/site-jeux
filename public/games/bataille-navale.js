// Affichage : Bataille navale
(function () {
  function grid(s, owner, ctx, clickable) {
    const shots = s.shots[owner];
    const ships = s.ships[owner] || [];
    const shipCells = new Map();
    ships.forEach(sh => sh.cells.forEach(c => shipCells.set(c, sh)));
    const sunk = (sh) => sh.cells.every(c => shots[c] === 'hit');
    let html = `<div class="bn-grid ${clickable ? 'enemy' : ''}">`;
    for (let i = 0; i < 100; i++) {
      const shot = shots[i], sh = shipCells.get(i);
      const cls = ['c', sh ? 'ship' : '', shot === 'hit' ? (sh && sunk(sh) ? 'sunk' : 'hit') : '', shot === 'miss' ? 'miss' : '', s.last && s.last.target === owner && s.last.cell === i ? 'last' : ''].join(' ');
      html += `<button class="${cls}" data-cell="${i}" ${clickable && !shot ? '' : 'disabled'}>${shot === 'hit' ? '💥' : shot === 'miss' ? '•' : ''}</button>`;
    }
    return html + '</div>';
  }

  window.GAME_UI['bataille-navale'] = {
    render(el, s, ctx) {
      const me = ctx.me, enemy = 1 - me;
      let html = '';
      if (s.phase === 'placement') {
        html = `<div class="center"><h3>Place ta flotte</h3>${grid(s, me, ctx, false)}
          <div class="row">${s.ready[me] ? '<span class="muted">✅ Prêt ! En attente de l\'adversaire…</span>'
            : '<button class="btn ghost" data-act="shuffle">🔀 Mélanger</button><button class="btn" data-act="ready">✅ Prêt</button>'}</div></div>`;
      } else {
        const myTurn = !s.over && s.turn === me;
        const left = (p) => (s.ships[p] || []).length;
        html = `<p class="hint" style="text-align:center">${escapeHtml(s.log || '')}</p><div class="bn">
          <div><h3>🎯 Flotte de ${escapeHtml(ctx.names[enemy])}</h3>${grid(s, enemy, ctx, myTurn)}</div>
          <div><h3>🚢 Ta flotte</h3>${grid(s, me, ctx, false)}</div></div>`;
      }
      el.innerHTML = html;
      el.onclick = (e) => {
        const a = e.target.closest('[data-act]');
        if (a) return ctx.send({ type: a.dataset.act });
        const c = e.target.closest('[data-cell]');
        if (c && !c.disabled && s.phase === 'combat') ctx.send({ type: 'fire', cell: Number(c.dataset.cell) });
      };
    },
  };
})();
