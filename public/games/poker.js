// Affichage : Poker
(function () {
  const RANK = { 11: 'V', 12: 'D', 13: 'R', 14: 'A' };
  const SUIT = ['♠', '♥', '♦', '♣'];
  const cardHtml = (c) => c ? `<span class="pcard ${c.s === 1 || c.s === 2 ? 'red' : ''}">${RANK[c.r] || c.r}<span class="suit">${SUIT[c.s]}</span></span>` : '<span class="pcard back"></span>';
  const PHASES = { preflop: 'Avant le flop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Abattage' };

  window.GAME_UI.poker = {
    render(el, s, ctx) {
      const me = s.players[ctx.me];
      const myTurn = !s.over && s.turn === ctx.me;
      const toCall = s.currentBet - me.bet;
      const board = [0, 1, 2, 3, 4].map(i => s.board[i] ? cardHtml(s.board[i]) : '<span class="pcard" style="opacity:.15"></span>').join('');

      const seats = s.players.map((p, i) => {
        const cards = i === ctx.me ? s.hand : s.revealed[i];
        const result = s.results && s.results.find(r => r.p === i);
        return `<div class="seat ${s.turn === i ? 'turn' : ''} ${p.folded || p.out ? 'folded' : ''}">
          <b style="color:${ctx.colors[i]}">${escapeHtml(ctx.names[i] || '')}</b>${s.dealer === i ? ' <span title="Donneur">🔘</span>' : ''}
          <div class="chips">🪙 ${p.chips}</div>
          <div>${p.out ? 'Éliminé' : cards && cards.length ? cards.map(cardHtml).join('') : p.folded ? '' : cardHtml(null) + cardHtml(null)}</div>
          <div class="hint">${p.bet ? `Mise : ${p.bet}` : ''} ${escapeHtml(p.lastAction || '')}</div>
          ${result ? `<div style="color:#ffe08a;font-weight:700">+${result.amount}${result.hand ? ' · ' + result.hand : ''}</div>` : ''}
        </div>`;
      }).join('');

      let actions = '';
      if (myTurn) {
        const minTo = s.currentBet + s.minRaise;
        actions = `<div class="row" style="justify-content:center;margin-top:14px">
          <button class="btn danger" data-a="fold">Se coucher</button>
          ${toCall > 0 ? `<button class="btn ghost" data-a="call">Suivre ${Math.min(toCall, me.chips)}</button>` : '<button class="btn ghost" data-a="check">Check</button>'}
          ${me.chips > toCall ? `<input id="pk-amount" type="number" min="${minTo}" max="${me.bet + me.chips}" step="${s.blinds[1]}" value="${Math.min(minTo, me.bet + me.chips)}" style="width:110px">
          <button class="btn" data-a="raise">${s.currentBet ? 'Relancer à' : 'Miser'}</button>` : ''}
          <button class="btn" data-a="allin" style="background:linear-gradient(100deg,#ff4d5e,#ff8a3d)">Tapis (${me.bet + me.chips})</button>
        </div>`;
      } else if (s.phase === 'showdown' && !s.over) {
        actions = `<div class="row" style="justify-content:center;margin-top:14px"><button class="btn" data-a="next">▶ Main suivante</button></div>`;
      }

      el.innerHTML = `
        <div class="poker-table">
          <div class="center">
            <span class="hint" style="color:#cfe">Main n°${s.handNo} · ${PHASES[s.phase]} · Blindes ${s.blinds[0]}/${s.blinds[1]}</span>
            <div>${board}</div>
            <div class="chip-pot">Pot : ${s.pot || (s.results ? s.results.reduce((a, r) => a + r.amount, 0) : 0)}</div>
          </div>
        </div>
        ${actions}
        <div class="seats">${seats}</div>
        <p class="hint" style="text-align:center">Mains, de la plus faible à la plus forte : ${s.handNames.join(' · ')}</p>`;

      el.onclick = (e) => {
        const b = e.target.closest('[data-a]');
        if (!b) return;
        const a = b.dataset.a;
        if (a === 'raise') return ctx.send({ type: 'raise', amount: Number(el.querySelector('#pk-amount').value) });
        ctx.send({ type: a });
      };
    },
  };
})();
