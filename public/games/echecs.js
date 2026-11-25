// Affichage : Échecs
(function () {
  const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  let selected = null, promo = null;

  window.GAME_UI.echecs = {
    render(el, s, ctx) {
      const flip = ctx.me === 1;
      const myTurn = !s.over && s.turn === ctx.me;
      if (!myTurn) { selected = null; promo = null; }
      const dests = myTurn && selected !== null ? s.moves.filter(m => m.from === selected).map(m => m.to) : [];
      const kingInCheck = s.check ? s.board.findIndex(p => p && p.t === 'k' && p.c === s.turn) : -1;

      let html = '<div class="center"><div class="row" style="align-items:flex-start;gap:22px;justify-content:center">';
      html += '<div><div class="captured">' + s.captured[flip ? 0 : 1].map(t => GLYPH[t]).join('') + '</div><div class="board8" style="--sq:min(68px, 10vw)">';
      for (let k = 0; k < 64; k++) {
        const i = flip ? 63 - k : k;
        const r = Math.floor(i / 8), c = i % 8;
        const p = s.board[i];
        const cls = ['sq', (r + c) % 2 ? 'dark' : 'light', selected === i ? 'sel' : '', dests.includes(i) ? 'dest' + (p ? ' cap' : '') : '', s.last && s.last.includes(i) ? 'last' : '', i === kingInCheck ? 'check' : ''].join(' ');
        const coords = (k % 8 === 0 ? `<span class="coord r">${8 - r}</span>` : '') + (k >= 56 ? `<span class="coord f">${'abcdefgh'[c]}</span>` : '');
        html += `<button class="${cls}" data-i="${i}">${coords}${p ? `<span class="chess-piece ${p.c === 0 ? 'w' : 'b'}">${GLYPH[p.t]}</span>` : ''}</button>`;
      }
      html += '</div><div class="captured">' + s.captured[flip ? 1 : 0].map(t => GLYPH[t]).join('') + '</div></div>';
      html += `<div class="panel" style="min-width:200px;max-height:520px;overflow:auto">
        <p><b>${escapeHtml(ctx.names[0])}</b> : Blancs<br><b>${escapeHtml(ctx.names[1])}</b> : Noirs</p>
        ${s.check && !s.over ? '<p style="color:#ff4d5e;font-weight:700">♚ Échec !</p>' : ''}
        ${promo ? `<p>Promotion :</p><div class="promo">${['q', 'r', 'b', 'n'].map(t => `<button class="ghost" data-promo="${t}">${GLYPH[t]}</button>`).join('')}</div>` : ''}
        <h3 style="margin-top:10px">Coups</h3><ol class="hint" style="padding-left:20px;margin:0">${s.history.reduce((acc, m, k) => (k % 2 ? acc : acc + `<li>${m} ${s.history[k + 1] || ''}</li>`), '')}</ol></div>`;
      html += '</div></div>';
      el.innerHTML = html;

      el.onclick = (e) => {
        const pb = e.target.closest('[data-promo]');
        if (pb && promo) { ctx.send({ ...promo, promo: pb.dataset.promo }); promo = null; selected = null; return; }
        const b = e.target.closest('[data-i]');
        if (!b || !myTurn) return;
        const i = Number(b.dataset.i);
        if (selected !== null && dests.includes(i)) {
          const piece = s.board[selected];
          const lastRow = piece.c === 0 ? 0 : 7;
          if (piece.t === 'p' && Math.floor(i / 8) === lastRow) { promo = { from: selected, to: i }; this.render(el, s, ctx); return; }
          ctx.send({ from: selected, to: i }); selected = null; return;
        }
        const p = s.board[i];
        selected = p && p.c === ctx.me && s.moves.some(m => m.from === i) ? (selected === i ? null : i) : null;
        promo = null;
        this.render(el, s, ctx);
      };
    },
  };
})();
