// Affichage : Car Football
(function () {
  const D = RT.draw;
  const TEAM = ['#4da3ff', '#ff4d5e'];

  function car(g, c, color, isMe, name) {
    g.save(); g.translate(c.x, c.y); g.rotate(c.ang);
    if (c.boosting) { g.fillStyle = 'rgba(255,170,50,.8)'; g.beginPath(); g.moveTo(-22, -7); g.lineTo(-44 - Math.random() * 10, 0); g.lineTo(-22, 7); g.fill(); }
    D.rrect(g, -24, -15, 48, 30, 8, 'rgba(0,0,0,.35)');
    D.rrect(g, -22, -14, 44, 28, 8, color, isMe ? '#fff' : '#0008');
    D.rrect(g, -2, -11, 14, 22, 4, 'rgba(180,220,255,.85)');
    g.fillStyle = '#111'; [[-14, -16], [8, -16], [-14, 12], [8, 12]].forEach(([x, y]) => g.fillRect(x, y, 10, 4));
    g.restore();
    D.text(g, name, c.x, c.y - 30, { size: 12 });
  }

  window.GAME_UI['car-football'] = RT.game({
    view: { w: 1400, h: 800 },
    bar: RT.keysHelp('<kbd>Z</kbd>/<kbd>↑</kbd> accélérer · <kbd>S</kbd>/<kbd>↓</kbd> freiner · <kbd>Q</kbd><kbd>D</kbd>/<kbd>←</kbd><kbd>→</kbd> tourner · <kbd>Espace</kbd> turbo'),
    draw(g, s, ctx, h) {
      h.follow(s.W / 2, s.H / 2, s.W, s.H, 1);
      h.applyCam();
      // Pelouse rayée
      for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? '#2f8a4a' : '#2a7d43'; g.fillRect(i * s.W / 14, 0, s.W / 14 + 1, s.H); }
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 4;
      g.strokeRect(4, 4, s.W - 8, s.H - 8);
      g.beginPath(); g.moveTo(s.W / 2, 0); g.lineTo(s.W / 2, s.H); g.stroke();
      D.circle(g, s.W / 2, s.H / 2, 90, null, 'rgba(255,255,255,.75)', 4);
      g.strokeRect(4, s.H / 2 - 170, 170, 340); g.strokeRect(s.W - 174, s.H / 2 - 170, 170, 340);
      // Buts
      g.fillStyle = 'rgba(77,163,255,.45)'; g.fillRect(-2, s.H / 2 - s.GOAL / 2, 14, s.GOAL);
      g.fillStyle = 'rgba(255,77,94,.45)'; g.fillRect(s.W - 12, s.H / 2 - s.GOAL / 2, 14, s.GOAL);
      // Ballon
      const b = s.ball;
      D.circle(g, b.x + 4, b.y + 6, b.r, 'rgba(0,0,0,.3)');
      D.circle(g, b.x, b.y, b.r, '#fff', '#222', 3);
      D.circle(g, b.x, b.y, b.r * .35, '#222');
      for (const c of s.players) car(g, c, TEAM[c.team], c.i === ctx.me, ctx.names[c.i] || '');
      // Interface
      h.resetCam();
      const cx = h.view.w / 2;
      D.panel(g, cx - 150, 10, 300, 56);
      D.text(g, String(s.score[0]), cx - 95, 38, { size: 34, color: TEAM[0] });
      D.text(g, String(s.score[1]), cx + 95, 38, { size: 34, color: TEAM[1] });
      const m = Math.floor(s.time / 60), sec = String(s.time % 60).padStart(2, '0');
      D.text(g, s.overtime ? 'BUT EN OR' : `${m}:${sec}`, cx, 38, { size: 20 });
      const mine = s.players[ctx.me];
      if (mine) {
        D.panel(g, 14, h.view.h - 50, 220, 36);
        D.text(g, 'TURBO', 26, h.view.h - 32, { size: 13, align: 'left' });
        D.bar(g, 84, h.view.h - 40, 136, 16, mine.boost / 100, '#ffb547');
        D.text(g, `Équipe ${mine.team === 0 ? 'Bleue' : 'Rouge'}`, 250, h.view.h - 32, { size: 14, align: 'left', color: TEAM[mine.team] });
      }
      if (s.goalFlash > 0) D.text(g, `⚽ BUT pour l'équipe ${s.lastGoal === 0 ? 'Bleue' : 'Rouge'} !`, cx, h.view.h / 2, { size: 54, color: TEAM[s.lastGoal] });
      else if (s.freeze > 0) D.text(g, String(Math.ceil(s.freeze)), cx, h.view.h / 2 - 80, { size: 60 });
    },
  });
})();
