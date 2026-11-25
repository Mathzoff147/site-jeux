// Affichage du Puissance 4
window.GAME_UI = window.GAME_UI || {};
window.GAME_UI.puissance4 = {
  render(el, state, ctx) {
    const inLine = (r, c) => state.line && state.line.some(([lr, lc]) => lr === r && lc === c);
    const isLast = (r, c) => state.last && state.last[0] === r && state.last[1] === c;
    let html = '<div class="c4">';
    state.board.forEach((row, r) => row.forEach((v, c) => {
      const cls = ['slot', v !== null ? 'p' + v : '', inLine(r, c) ? 'win' : '', isLast(r, c) ? 'last' : ''].join(' ');
      html += `<button class="${cls}" data-col="${c}" aria-label="Colonne ${c + 1}"></button>`;
    }));
    el.innerHTML = html + '</div><p class="muted">Clique sur une colonne pour y faire tomber ton jeton.</p>';
    el.onclick = (e) => {
      const col = e.target.dataset.col;
      if (col !== undefined && !state.over && state.turn === ctx.me) ctx.send({ col: Number(col) });
    };
  },
};
