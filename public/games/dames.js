// Affichage : Dames
(function () {
  let selected = null;
  window.GAME_UI.dames = {
    render(el, s, ctx) {
      const flip = ctx.me === 1;
      const myTurn = !s.over && s.turn === ctx.me;
      const moves = myTurn ? s.moves : [];
      if (s.chain !== null && myTurn) selected = s.chain;
      if (selected !== null && !moves.some(m => m.from === selected)) selected = null;
      const dests = moves.filter(m => m.from === selected);
      const movable = new Set(moves.map(m => m.from));

      let html = '<div class="center"><div class="board8" style="--sq:min(64px, 10vw)">';
      for (let k = 0; k < 64; k++) {
        const i = flip ? 63 - k : k;
        const r = Math.floor(i / 8), c = i % 8;
        const dark = (r + c) % 2 === 1;
        const p = s.board[i];
        const d = dests.find(m => m.to === i);
        const cls = ['sq', dark ? 'dark' : 'light', selected === i ? 'sel' : '', d ? 'dest' + (d.cap !== null ? ' cap' : '') : '', s.last && s.last.includes(i) ? 'last' : ''].join(' ');
        html += `<button class="${cls}" data-i="${i}" ${dark ? '' : 'disabled'}>${p ? `<span class="piece-d p${p.p}" ${movable.has(i) && selected === null ? 'style="box-shadow:0 0 0 3px #ffb547, inset 0 -5px 0 rgba(0,0,0,.3)"' : ''}>${p.king ? '♛' : ''}</span>` : ''}</button>`;
      }
      html += '</div>';
      const count = (pl) => s.board.filter(x => x && x.p === pl).length;
      html += `<div class="row"><span class="piece-d p0" style="width:22px;height:22px"></span> ${escapeHtml(ctx.names[0])} : ${count(0)}
        &nbsp;&nbsp; <span class="piece-d p1" style="width:22px;height:22px"></span> ${escapeHtml(ctx.names[1])} : ${count(1)}</div>`;
      if (myTurn && moves.some(m => m.cap !== null)) html += `<p class="hint">⚠️ Prise obligatoire${s.chain !== null ? ' — continue ta rafle !' : ''}</p>`;
      html += '</div>';
      el.innerHTML = html;
      el.onclick = (e) => {
        const b = e.target.closest('[data-i]');
        if (!b || !myTurn) return;
        const i = Number(b.dataset.i);
        if (selected !== null && dests.some(m => m.to === i)) { ctx.send({ from: selected, to: i }); selected = null; return; }
        selected = movable.has(i) && s.chain === null ? (selected === i ? null : i) : selected;
        this.render(el, s, ctx);
      };
    },
  };
})();
