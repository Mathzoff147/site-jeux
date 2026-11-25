// Affichage : Tower Defense
(function () {
  const D = RT.draw;
  const ORDER = ['canon', 'mitrail', 'givre', 'mortier'];
  const ICON = { canon: '💣', mitrail: '🔫', givre: '❄️', mortier: '🎇' };
  const ECOL = { normal: '#ff8a3d', rapide: '#ffd447', blinde: '#9aa3b5', boss: '#c8344a' };

  window.GAME_UI['tower-defense'] = RT.game({
    view: { w: 960, h: 640 },
    noInput: true,
    bar: '<span id="td-bar"></span>' + RT.keysHelp('<kbd>1</kbd>–<kbd>4</kbd> choisir une tour · clic sur l\'herbe : construire · clic sur une tour : améliorer · clic droit : vendre'),
    mount(h) {
      h.sel = 'canon';
      h.bar.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.tower) h.sel = b.dataset.tower;
        if (b.dataset.start) h.ctx.send({ type: 'start' });
        h.refreshBar = true;
      });
    },
    onKey(k, h) { const i = Number(k) - 1; if (ORDER[i]) { h.sel = ORDER[i]; h.refreshBar = true; } },
    onClick(h, button) {
      const s = h.state; if (!s) return;
      const tx = Math.floor(h.mouse.x / s.T), ty = Math.floor(h.mouse.y / s.T);
      const tower = s.towers.find(t => t.tx === tx && t.ty === ty);
      if (button === 2) { if (tower) h.ctx.send({ type: 'sell', tx, ty }); return; }
      if (tower) h.ctx.send({ type: 'upgrade', tx, ty });
      else h.ctx.send({ type: 'build', tx, ty, tower: h.sel });
    },
    update(s, ctx, h) {
      const html = ORDER.map((k, i) => {
        const t = s.towerTypes[k];
        return `<button data-tower="${k}" class="${h.sel === k ? 'active' : ''}" ${s.gold < t.cost ? 'style="opacity:.55"' : ''}>${i + 1}. ${ICON[k]} ${t.name} · ${t.cost} or</button>`;
      }).join(' ') + (s.phase === 'build' ? ' <button data-start="1">▶ Lancer la vague</button>' : '');
      const el = h.bar.querySelector('#td-bar');
      if (el.dataset.v !== html) { el.innerHTML = html; el.dataset.v = html; }
    },
    draw(g, s, ctx, h, t) {
      h.follow(s.W / 2, s.H / 2, s.W, s.H, 1);
      h.applyCam();
      const T = s.T;
      // Herbe en damier
      for (let y = 0; y < s.ROWS; y++) for (let x = 0; x < s.COLS; x++) { g.fillStyle = (x + y) % 2 ? '#3f8f48' : '#459a4e'; g.fillRect(x * T, y * T, T, T); }
      // Chemin
      g.fillStyle = '#c8a46a';
      for (const c of s.path) g.fillRect((c % s.COLS) * T, Math.floor(c / s.COLS) * T, T, T);
      g.fillStyle = 'rgba(0,0,0,.08)';
      for (const c of s.path) g.fillRect((c % s.COLS) * T + 4, Math.floor(c / s.COLS) * T + 4, T - 8, T - 8);
      // Entrée / sortie
      const end = s.waypoints[s.waypoints.length - 1];
      D.text(g, '🏰', (end[0] - 0.6) * T, end[1] * T + T / 2, { size: 30, shadow: false });
      // Survol
      const hx = Math.floor(h.mouse.x / T), hy = Math.floor(h.mouse.y / T);
      if (hx >= 0 && hy >= 0 && hx < s.COLS && hy < s.ROWS) {
        const blocked = s.path.includes(hy * s.COLS + hx);
        const existing = s.towers.find(tw => tw.tx === hx && tw.ty === hy);
        g.fillStyle = blocked ? 'rgba(255,77,94,.3)' : 'rgba(255,255,255,.25)'; g.fillRect(hx * T, hy * T, T, T);
        const type = s.towerTypes[existing ? existing.type : h.sel];
        if (!blocked) D.circle(g, hx * T + T / 2, hy * T + T / 2, type.range + (existing ? (existing.level - 1) * 15 : 0), 'rgba(255,255,255,.07)', 'rgba(255,255,255,.4)', 1);
      }
      // Tours
      for (const tw of s.towers) {
        const cx = tw.tx * T + T / 2, cy = tw.ty * T + T / 2, type = s.towerTypes[tw.type];
        D.rrect(g, tw.tx * T + 3, tw.ty * T + 3, T - 6, T - 6, 8, '#2b3044', type.color);
        g.save(); g.translate(cx, cy); g.rotate(tw.ang); D.rrect(g, 0, -4, 18, 8, 3, type.color); g.restore();
        D.circle(g, cx, cy, 9, type.color, '#0008', 2);
        for (let k = 0; k < tw.level; k++) D.circle(g, tw.tx * T + 9 + k * 8, tw.ty * T + T - 7, 3, '#ffd447');
      }
      // Ennemis
      for (const e of s.enemies) {
        D.circle(g, e.x, e.y + 3, e.r, 'rgba(0,0,0,.3)');
        D.circle(g, e.x, e.y, e.r, ECOL[e.kind], e.slow ? '#7fd3ff' : '#0008', e.slow ? 3 : 2);
        if (e.kind === 'boss') D.text(g, '👹', e.x, e.y + 1, { size: 22, shadow: false });
        D.bar(g, e.x - e.r, e.y - e.r - 7, e.r * 2, 4, e.hp / e.maxHp, '#3ecf7a');
      }
      // Tirs
      for (const sh of s.shots) {
        if (sh.kind === 'boom') { D.circle(g, sh.x2, sh.y2, 60 * (1 - sh.t / 0.25) + 10, 'rgba(255,120,60,.35)', '#ff8a3d', 2); continue; }
        g.strokeStyle = s.towerTypes[sh.kind] ? s.towerTypes[sh.kind].color : '#fff'; g.lineWidth = sh.kind === 'canon' ? 4 : 2;
        g.beginPath(); g.moveTo(sh.x1, sh.y1); g.lineTo(sh.x2, sh.y2); g.stroke();
      }
      // Interface
      h.resetCam();
      D.panel(g, 10, 10, 420, 44);
      D.text(g, `💰 ${s.gold}    ❤️ ${s.lives}    🌊 Vague ${s.wave}/${s.waves}`, 26, 32, { size: 18, align: 'left' });
      if (s.phase === 'build') D.text(g, s.wave === 0 ? `Construisez vos défenses ! Vague 1 dans ${Math.ceil(s.timer)} s` : `Vague ${s.wave + 1} dans ${Math.ceil(s.timer)} s`, h.view.w / 2, h.view.h - 30, { size: 18, color: '#ffd447' });
    },
  });
})();
