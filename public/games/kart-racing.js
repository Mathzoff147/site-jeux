// Affichage : Kart Racing
(function () {
  const D = RT.draw;
  const ITEMS = { turbo: '🚀', banane: '🍌', missile: '🎯' };

  function trackPath(g, track) {
    g.beginPath();
    track.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
  }

  window.GAME_UI['kart-racing'] = RT.game({
    view: { w: 1120, h: 640 },
    bar: RT.keysHelp('<kbd>Z</kbd>/<kbd>↑</kbd> accélérer · <kbd>S</kbd> freiner · <kbd>Q</kbd><kbd>D</kbd> tourner · <kbd>Espace</kbd> utiliser l\'objet'),
    draw(g, s, ctx, h, t) {
      const mine = s.players[ctx.me] || s.players[0];
      h.follow(mine.x, mine.y, s.W, s.H, 0.95);
      h.applyCam();
      // Herbe
      g.fillStyle = '#3d8f3a'; g.fillRect(0, 0, s.W, s.H);
      D.grid(g, h.cam, h.view, h.scale, 60, 'rgba(0,0,0,.05)');
      // Piste : bordures rouges et blanches, asphalte
      g.lineJoin = 'round'; g.lineCap = 'round';
      trackPath(g, s.track); g.strokeStyle = '#fff'; g.lineWidth = s.width + 24; g.stroke();
      g.setLineDash([30, 30]); trackPath(g, s.track); g.strokeStyle = '#e8334a'; g.lineWidth = s.width + 24; g.stroke(); g.setLineDash([]);
      trackPath(g, s.track); g.strokeStyle = '#4a4d57'; g.lineWidth = s.width; g.stroke();
      g.setLineDash([24, 24]); trackPath(g, s.track); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 4; g.stroke(); g.setLineDash([]);
      // Ligne d'arrivée (damier) au premier point
      const [ax, ay] = s.track[0], [bx, by] = s.track[1];
      const ang = Math.atan2(by - ay, bx - ax);
      g.save(); g.translate(ax, ay); g.rotate(ang);
      for (let i = 0; i < 2; i++) for (let j = -s.width / 2; j < s.width / 2; j += 12) { g.fillStyle = ((j / 12 | 0) + i) % 2 ? '#111' : '#fff'; g.fillRect(i * 12 - 12, j, 12, 12); }
      g.restore();
      // Turbos au sol
      for (const p of s.pads) {
        g.save(); g.translate(p.x, p.y); g.rotate(p.ang);
        for (let k = 0; k < 3; k++) { g.fillStyle = `rgba(255,212,71,${0.5 + 0.5 * Math.sin(t * 6 - k)})`; g.beginPath(); g.moveTo(-20 + k * 14, -18); g.lineTo(-8 + k * 14, 0); g.lineTo(-20 + k * 14, 18); g.lineTo(-14 + k * 14, 0); g.fill(); }
        g.restore();
      }
      // Boîtes
      for (const b of s.boxes) if (b.wait <= 0) {
        g.save(); g.translate(b.x, b.y); g.rotate(t * 1.5);
        D.rrect(g, -13, -13, 26, 26, 6, 'rgba(124,92,255,.85)', '#fff');
        g.restore();
        D.text(g, '?', b.x, b.y + 1, { size: 16 });
      }
      for (const b of s.bananas) D.text(g, '🍌', b.x, b.y, { size: 22, shadow: false });
      for (const m of s.missiles) { g.save(); g.translate(m.x, m.y); g.rotate(Math.atan2(m.vy, m.vx)); D.rrect(g, -12, -5, 24, 10, 4, '#ff4d5e', '#fff'); g.restore(); }
      // Karts
      for (const k of s.players) {
        g.save(); g.translate(k.x, k.y); g.rotate(k.ang);
        if (k.turbo > 0) { g.fillStyle = 'rgba(80,200,255,.8)'; g.beginPath(); g.moveTo(-16, -6); g.lineTo(-36 - Math.random() * 10, 0); g.lineTo(-16, 6); g.fill(); }
        D.rrect(g, -18, -12, 36, 24, 7, ctx.colors[k.i], k.i === ctx.me ? '#fff' : '#0009');
        g.fillStyle = '#111'; [[-14, -15], [6, -15], [-14, 11], [6, 11]].forEach(([x, y]) => g.fillRect(x, y, 9, 4));
        D.circle(g, -2, 0, 6, '#ffe0c2', '#0006', 1);
        g.restore();
        D.text(g, `${ctx.names[k.i] || ''}${k.finished ? ' 🏁' : ''}`, k.x, k.y - 26, { size: 12 });
      }
      // Interface
      h.resetCam();
      if (mine) {
        D.panel(g, 14, 14, 200, 92);
        D.text(g, `${mine.rank || 1}${mine.rank === 1 ? 'er' : 'e'}`, 30, 46, { size: 40, align: 'left', color: '#ffd447' });
        D.text(g, `/ ${s.players.length}`, 100, 54, { size: 16, align: 'left', color: '#cfd4f2' });
        D.text(g, `Tour ${Math.min(mine.lap + 1, s.laps)} / ${s.laps}`, 30, 88, { size: 16, align: 'left' });
        D.panel(g, h.view.w - 90, h.view.h - 90, 76, 76);
        D.text(g, mine.item ? ITEMS[mine.item] : '·', h.view.w - 52, h.view.h - 50, { size: 38, shadow: false, color: '#666' });
      }
      // Mini-carte
      const mw = 190, sc = mw / s.W, mh = s.H * sc, mx = h.view.w - mw - 14, my = 14;
      D.panel(g, mx - 4, my - 4, mw + 8, mh + 8);
      g.save(); g.translate(mx, my); g.scale(sc, sc);
      trackPath(g, s.track); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 60; g.stroke();
      for (const k of s.players) { g.fillStyle = ctx.colors[k.i]; g.beginPath(); g.arc(k.x, k.y, k.i === ctx.me ? 60 : 40, 0, 7); g.fill(); }
      g.restore();
      // Classement
      [...s.players].sort((a, b) => a.rank - b.rank).forEach((k, i) => D.text(g, `${i + 1}. ${ctx.names[k.i]}`, h.view.w - 16, my + mh + 26 + i * 20, { size: 13, align: 'right', color: k.i === ctx.me ? '#ffd447' : '#fff' }));
      if (s.countdown > 0) D.text(g, s.countdown > 0.5 ? String(Math.ceil(s.countdown - 0.5)) : 'GO !', h.view.w / 2, h.view.h / 2 - 60, { size: 90, color: '#ffd447' });
      if (mine && mine.finished && !s.over) D.text(g, `🏁 Arrivé ${mine.place}${mine.place === 1 ? 'er' : 'e'} en ${mine.time} s !`, h.view.w / 2, 60, { size: 26 });
      if (s.endTimer !== null && s.endTimer > 0 && !s.over) D.text(g, `Fin de la course dans ${Math.ceil(s.endTimer)} s`, h.view.w / 2, h.view.h - 30, { size: 16, color: '#ffb547' });
    },
  });
})();
