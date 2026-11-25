// Affichage : Fall Race
(function () {
  const D = RT.draw;
  window.GAME_UI['fall-race'] = RT.game({
    view: { w: 1000, h: 640 },
    bar: RT.keysHelp('<kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> / flèches pour courir · <kbd>Espace</kbd> pour sauter (au-dessus des trous et des barres)'),
    draw(g, s, ctx, h, t) {
      const mine = s.players[ctx.me] || s.players[0];
      h.follow(s.W / 2, mine.y - 80, s.W, s.H, 1);
      h.applyCam();
      // Vide coloré autour du parcours
      g.fillStyle = '#ff9ad5'; g.fillRect(h.cam.x - 200, h.cam.y - 50, h.view.w + 400, h.view.h + 100);
      // Sol du parcours (bandes pastel)
      for (let y = 0; y < s.H; y += 200) { g.fillStyle = (y / 200) % 2 ? '#7fd3ff' : '#9fe0ff'; g.fillRect(0, y, s.W, 200); }
      // Arrivée
      for (let x = 0; x < s.W; x += 40) for (let k = 0; k < 2; k++) { g.fillStyle = ((x / 40) + k) % 2 ? '#111' : '#fff'; g.fillRect(x, s.FINISH - 40 + k * 20, 40, 20); }
      D.text(g, '🏁 ARRIVÉE', s.W / 2, s.FINISH - 70, { size: 34, color: '#ffd447' });
      // Drapeaux de passage
      s.checkpoints.forEach((y, i) => { if (!i) return; g.fillStyle = 'rgba(62,207,122,.5)'; g.fillRect(0, y - 4, s.W, 8); D.text(g, '🚩', 20, y - 14, { size: 22, shadow: false }); });
      // Obstacles
      for (const o of s.obstacles) {
        if (o.type === 'hole') { D.rrect(g, o.x, o.y, o.w, o.h, 16, '#ff9ad5'); D.rrect(g, o.x + 6, o.y + 6, o.w - 12, o.h - 12, 12, '#ff7ac6'); }
      }
      for (const o of s.obstacles) {
        if (o.type === 'wall') { D.rrect(g, o.x, o.y + 6, o.w, o.h, 8, 'rgba(0,0,0,.25)'); D.rrect(g, o.x, o.y, o.w, o.h, 8, '#ffb547', '#c47a12'); }
        if (o.type === 'bumper') { D.circle(g, o.x, o.y, o.r + 4 + Math.sin(t * 6) * 2, '#fff'); D.circle(g, o.x, o.y, o.r, '#7c5cff'); D.circle(g, o.x, o.y, o.r * .5, '#c58cff'); }
        if (o.type === 'sweep') {
          const ex = Math.cos(o.ang) * o.len, ey = Math.sin(o.ang) * o.len;
          g.lineCap = 'round';
          g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 20; g.beginPath(); g.moveTo(o.x - ex, o.y - ey + 8); g.lineTo(o.x + ex, o.y + ey + 8); g.stroke();
          g.strokeStyle = '#ff4d5e'; g.lineWidth = 18; g.beginPath(); g.moveTo(o.x - ex, o.y - ey); g.lineTo(o.x + ex, o.y + ey); g.stroke();
          g.strokeStyle = '#fff'; g.lineWidth = 4; g.setLineDash([14, 14]); g.beginPath(); g.moveTo(o.x - ex, o.y - ey); g.lineTo(o.x + ex, o.y + ey); g.stroke(); g.setLineDash([]);
          D.circle(g, o.x, o.y, 16, '#333', '#fff', 3);
        }
      }
      // Joueurs (petits bonshommes ronds)
      for (const p of [...s.players].sort((a, b) => a.air - b.air)) {
        if (p.finished) continue;
        const lift = p.air > 0 ? Math.sin((0.55 - p.air) / 0.55 * Math.PI) * 18 : 0;
        const shrink = p.fall > 0 ? Math.max(0.1, p.fall) : 1;
        D.circle(g, p.x, p.y + 6, p.r * (1 - lift / 50) * shrink, 'rgba(0,0,0,.25)');
        D.circle(g, p.x, p.y - lift, p.r * shrink, ctx.colors[p.i], p.i === ctx.me ? '#fff' : '#0007', p.i === ctx.me ? 3 : 2);
        D.circle(g, p.x - 4 * shrink, p.y - lift - 3, 3 * shrink, '#fff'); D.circle(g, p.x + 4 * shrink, p.y - lift - 3, 3 * shrink, '#fff');
        D.text(g, ctx.names[p.i] || '', p.x, p.y - lift - 26, { size: 12 });
      }
      // Interface
      h.resetCam();
      const progress = 1 - (mine.y - s.FINISH) / (s.H - 200 - s.FINISH);
      D.panel(g, 14, 14, 36, h.view.h - 28);
      D.bar(g, 24, 24, 16, h.view.h - 48, 1, 'rgba(255,255,255,.1)');
      for (const p of s.players) {
        const pr = Math.max(0, Math.min(1, p.finished ? 1 : 1 - (p.y - s.FINISH) / (s.H - 200 - s.FINISH)));
        D.circle(g, 32, 24 + (h.view.h - 48) * (1 - pr), p.i === ctx.me ? 8 : 6, ctx.colors[p.i], '#fff', 1);
      }
      D.panel(g, 62, 14, 230, 40);
      D.text(g, `⏱ ${Math.floor(s.time)} s · ${s.finishers.length} arrivé${s.finishers.length > 1 ? 's' : ''}`, 76, 34, { size: 15, align: 'left' });
      if (s.countdown > 0) D.text(g, s.countdown > 0.5 ? String(Math.ceil(s.countdown - 0.5)) : 'GO !', h.view.w / 2, h.view.h / 2, { size: 100, color: '#ffd447' });
      if (mine.fall > 0) D.text(g, 'Oups ! Retour au drapeau…', h.view.w / 2, h.view.h / 2 - 100, { size: 28, color: '#fff' });
      if (mine.finished) D.text(g, `🏁 Arrivé ${mine.place}${mine.place === 1 ? 'er' : 'e'} !`, h.view.w / 2, 70, { size: 34, color: '#ffd447' });
      if (s.endTimer !== null && !s.over) D.text(g, `Fin dans ${Math.ceil(s.endTimer)} s`, h.view.w / 2, h.view.h - 30, { size: 16, color: '#fff' });
    },
  });
})();
