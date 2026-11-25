// Affichage de Conquête
window.GAME_UI = window.GAME_UI || {};
(function () {
  let selected = null; // case sélectionnée par le joueur

  function neighbors(i, size) {
    const x = i % size, y = Math.floor(i / size), out = [];
    if (x > 0) out.push(i - 1);
    if (x < size - 1) out.push(i + 1);
    if (y > 0) out.push(i - size);
    if (y < size - 1) out.push(i + size);
    return out;
  }

  window.GAME_UI.conquete = {
    render(el, state, ctx) {
      const myTurn = !state.over && state.turn === ctx.me;
      const canAct = (i) => myTurn && state.tiles[i].owner === ctx.me && state.tiles[i].troops >= 2 && !state.used.includes(i);
      if (selected !== null && !canAct(selected)) selected = null;
      const targets = selected !== null ? neighbors(selected, state.size).filter(n => !state.tiles[n].mountain) : [];

      let grid = `<div class="cq" style="grid-template-columns:repeat(${state.size},48px)">`;
      state.tiles.forEach((t, i) => {
        const cls = ['tile',
          t.mountain ? 'mountain' : t.owner === -1 ? 'neutral' : 'o' + t.owner,
          state.used.includes(i) ? 'used' : '',
          selected === i ? 'selected' : '',
          targets.includes(i) ? 'target' : ''].join(' ');
        const label = t.mountain ? '▲' : t.troops;
        grid += `<button class="${cls}" data-i="${i}">${t.capital ? '<span class="cap">★</span>' : ''}${label}</button>`;
      });
      grid += '</div>';

      const scores = ctx.names.map((name, p) => {
        const count = state.tiles.filter(t => t.owner === p).length;
        const troops = state.tiles.filter(t => t.owner === p).reduce((s, t) => s + t.troops, 0);
        return `<div class="row"><span class="dot" style="background:var(--p${p})"></span>
          <span class="${state.alive[p] ? '' : 'muted'}">${escapeHtml(name)} : ${count} cases, ${troops} troupes${state.alive[p] ? '' : ' (éliminé)'}</span></div>`;
      }).join('');

      el.innerHTML = `
        <div class="cq-wrap">
          ${grid}
          <div class="cq-side">
            <h3>Tour ${Math.min(state.round, state.maxRounds)} / ${state.maxRounds}</h3>
            ${scores}
            <p class="cq-log">${escapeHtml((state.log || '').replace(/le joueur (\d)/g, (m, n) => ctx.names[n - 1] || m))}</p>
            ${myTurn ? '<button id="cq-end">Fin du tour</button>' : ''}
            <p class="cq-help">Clique sur une de tes cases (2 troupes ou plus), puis sur une case voisine pour y envoyer tes troupes.
              ★ = capitale, ▲ = montagne. Prends la capitale adverse pour l'éliminer.</p>
          </div>
        </div>`;

      el.onclick = (e) => {
        if (e.target.id === 'cq-end') { selected = null; ctx.send({ type: 'end' }); return; }
        const btn = e.target.closest('[data-i]');
        if (!btn || !myTurn) return;
        const i = Number(btn.dataset.i);
        if (selected !== null && targets.includes(i)) {
          ctx.send({ type: 'action', from: selected, to: i });
          selected = null;
        } else if (canAct(i)) {
          selected = selected === i ? null : i;
          this.render(el, state, ctx);
        } else {
          selected = null;
          this.render(el, state, ctx);
        }
      };
    },
  };
})();
