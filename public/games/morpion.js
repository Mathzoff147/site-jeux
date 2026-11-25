// Affichage du Morpion
window.GAME_UI = window.GAME_UI || {};
window.GAME_UI.morpion = {
  render(el, state, ctx) {
    const symbols = ['✕', '◯'];
    const myTurn = !state.over && state.turn === ctx.me;
    el.innerHTML = '<div class="ttt">' + state.board.map((v, i) => `
      <button data-cell="${i}" class="${v !== null ? 'p' + v : ''} ${state.line && state.line.includes(i) ? 'win' : ''}"
        ${myTurn && v === null ? '' : 'disabled'}>${v !== null ? symbols[v] : ''}</button>`).join('') + '</div>';
    el.onclick = (e) => {
      const cell = e.target.dataset.cell;
      if (cell !== undefined && !e.target.disabled) ctx.send({ cell: Number(cell) });
    };
  },
};
