// Affichage : Draw & Guess
(function () {
  const COLORS = ['#111111', '#ffffff', '#e8334a', '#ff8a3d', '#f2b705', '#23a35a', '#2ed3c6', '#2f6fd1', '#7c5cff', '#ff5da2', '#8b5a3c', '#9aa3b5'];
  let ui = null;

  function build(el, ctx) {
    el.innerHTML = `
      <div class="dg">
        <div>
          <div class="row" style="justify-content:space-between;margin-bottom:8px">
            <div class="dg-word" id="dg-word"></div>
            <div style="font:800 1.6rem Outfit" id="dg-timer"></div>
          </div>
          <div style="position:relative">
            <canvas id="dg-canvas" width="800" height="560"></canvas>
            <div class="rt-overlay hidden" id="dg-overlay"></div>
          </div>
          <div class="rt-bar" id="dg-tools">
            <div class="palette" id="dg-palette">${COLORS.map((c, i) => `<button data-color="${c}" class="${i === 0 ? 'active' : ''}" style="background:${c}"></button>`).join('')}</div>
            <button data-size="4">Fin</button><button data-size="10" class="active">Moyen</button><button data-size="26">Gros</button>
            <button data-clear="1">🗑 Effacer tout</button>
          </div>
        </div>
        <div class="panel" style="display:flex;flex-direction:column;gap:10px">
          <h3 style="margin:0">Scores</h3>
          <div class="scores" id="dg-scores"></div>
          <h3 style="margin:6px 0 0">Propositions</h3>
          <div class="dg-feed" id="dg-feed"></div>
          <form id="dg-form" class="chat-form"><input id="dg-input" placeholder="Ta proposition…" autocomplete="off" maxlength="60"><button class="btn small">➤</button></form>
        </div>
      </div>`;
    const canvas = el.querySelector('#dg-canvas');
    const g = canvas.getContext('2d');
    g.lineCap = 'round'; g.lineJoin = 'round';
    const u = { el, canvas, g, color: COLORS[0], size: 10, drawing: false, buf: [], last: null, ctx, state: null };

    const pos = (e) => { const r = canvas.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * 800), Math.round((e.clientY - r.top) / r.height * 560)]; };
    const canDraw = () => u.state && u.state.phase === 'draw' && u.ctx.me === u.state.drawer;
    canvas.addEventListener('pointerdown', (e) => { if (!canDraw()) return; u.drawing = true; u.last = pos(e); u.buf = [u.last, u.last]; canvas.setPointerCapture(e.pointerId); stroke({ pts: [u.last, u.last], color: u.color, size: u.size }); });
    canvas.addEventListener('pointermove', (e) => { if (!u.drawing) return; const p = pos(e); stroke({ pts: [u.last, p], color: u.color, size: u.size }); u.buf.push(p); u.last = p; });
    const up = () => { if (!u.drawing) return; u.drawing = false; flush(); };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    function flush() { if (u.buf.length > 1) u.ctx.send({ type: 'stroke', pts: u.buf, color: u.color, size: u.size }); u.buf = u.last ? [u.last] : []; }
    u.timer = setInterval(() => { if (u.drawing && u.buf.length > 1) flush(); }, 80);

    function stroke(s) {
      if (s.clear) { g.fillStyle = '#fff'; g.fillRect(0, 0, 800, 560); return; }
      g.strokeStyle = s.color; g.lineWidth = s.size;
      g.beginPath(); g.moveTo(s.pts[0][0], s.pts[0][1]);
      for (const [x, y] of s.pts.slice(1)) g.lineTo(x, y);
      g.stroke();
    }
    u.stroke = stroke;
    stroke({ clear: true });

    el.querySelector('#dg-tools').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.color) { u.color = b.dataset.color; el.querySelectorAll('[data-color]').forEach(x => x.classList.toggle('active', x === b)); }
      if (b.dataset.size) { u.size = Number(b.dataset.size); el.querySelectorAll('[data-size]').forEach(x => x.classList.toggle('active', x === b)); }
      if (b.dataset.clear && canDraw()) { u.ctx.send({ type: 'clear' }); stroke({ clear: true }); }
    });
    el.querySelector('#dg-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = el.querySelector('#dg-input');
      if (input.value.trim()) u.ctx.send({ type: 'guess', text: input.value.trim() });
      input.value = '';
    });
    el.querySelector('#dg-overlay').addEventListener('click', (e) => { const b = e.target.closest('[data-choice]'); if (b) u.ctx.send({ type: 'choose', index: Number(b.dataset.choice) }); });
    return u;
  }

  window.GAME_UI['draw-guess'] = {
    render(el, s, ctx) {
      if (!ui || !el.contains(ui.canvas)) ui = build(el, ctx);
      ui.ctx = ctx; ui.state = s;
      for (const st of s.strokes || []) ui.stroke(st);
      const isDrawer = ctx.me === s.drawer;
      const $ = (id) => ui.el.querySelector(id);

      $('#dg-word').textContent = s.phase === 'reveal' ? s.lastWord : s.word || s.hint || '';
      $('#dg-timer').textContent = s.phase === 'reveal' ? '' : `⏱ ${Math.max(0, s.timer)}`;
      $('#dg-tools').style.visibility = isDrawer && s.phase === 'draw' ? 'visible' : 'hidden';
      ui.canvas.style.cursor = isDrawer && s.phase === 'draw' ? 'crosshair' : 'default';

      const overlay = $('#dg-overlay');
      let html = '';
      if (s.phase === 'choose') html = isDrawer
        ? `<h2>Choisis un mot à dessiner</h2><div class="row" style="justify-content:center">${(s.choices || []).map((w, i) => `<button class="btn" data-choice="${i}">${escapeHtml(w)}</button>`).join('')}</div><p class="muted">${s.timer} s</p>`
        : `<h2>✏️ ${escapeHtml(ctx.names[s.drawer])} choisit un mot…</h2><p class="muted">Manche ${s.round}/${s.rounds}</p>`;
      if (s.phase === 'reveal') html = `<h2>Le mot était : <span class="grad">${escapeHtml(s.lastWord)}</span></h2>`;
      if (overlay.dataset.v !== html) { overlay.innerHTML = html ? `<div class="box">${html}</div>` : ''; overlay.classList.toggle('hidden', !html); overlay.dataset.v = html; }

      const scores = ctx.names.map((n, i) => [n, s.scores[i], i]).sort((a, b) => b[1] - a[1]);
      const sh = scores.map(([n, sc, i]) => `<div class="row" style="justify-content:space-between"><span>${i === s.drawer ? '✏️' : s.guessed.includes(i) ? '✅' : '•'} <b style="color:${ctx.colors[i]}">${escapeHtml(n)}</b></span><b>${sc}</b></div>`).join('');
      if ($('#dg-scores').dataset.v !== sh) { $('#dg-scores').innerHTML = sh; $('#dg-scores').dataset.v = sh; }

      const fh = s.feed.map(f => {
        if (f.kind === 'sys') return `<div class="sys">${escapeHtml(f.text)}</div>`;
        if (f.kind === 'close') return `<div class="close">${escapeHtml(f.text)}</div>`;
        const name = `<b style="color:${ctx.colors[f.p]}">${escapeHtml(ctx.names[f.p] || '')}</b>`;
        if (f.kind === 'ok') return `<div class="ok">✅ ${name} ${escapeHtml(f.text)}</div>`;
        return `<div${f.secret ? ' class="muted"' : ''}>${name} : ${escapeHtml(f.text)}</div>`;
      }).join('');
      const feed = $('#dg-feed');
      if (feed.dataset.v !== fh) { feed.innerHTML = fh; feed.dataset.v = fh; feed.scrollTop = feed.scrollHeight; }
      $('#dg-input').placeholder = isDrawer ? 'Tu dessines ! (discussion)' : s.guessed.includes(ctx.me) ? 'Trouvé ! (discussion privée)' : 'Ta proposition…';
    },
    unmount() { if (ui) clearInterval(ui.timer); ui = null; },
  };
})();
