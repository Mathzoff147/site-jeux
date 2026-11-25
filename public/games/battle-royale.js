// Affichage : Mini Battle Royale
(function () {
  const D = RT.draw;
  const ITEM = { smg: ['🔫', '#4da3ff'], pompe: ['💥', '#ff9f43'], fusil: ['🎯', '#c58cff'], sniper: ['🔭', '#ff5da2'], medkit: ['➕', '#3ecf7a'] };
  window.GAME_UI['battle-royale'] = SHOOTER.create({
    floor: '#24402c', gridColor: 'rgba(255,255,255,.05)', obstacleFill: '#5b6372', obstacleStroke: '#737c8e',
    bar: RT.keysHelp('<kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> bouger · souris viser · clic tirer · marche sur les objets pour les ramasser'),
    drawUnder(g, s) {
      for (const it of s.items) {
        const [ic, col] = ITEM[it.kind];
        D.circle(g, it.x, it.y, 16, col + '44', col, 2);
        D.text(g, ic, it.x, it.y + 1, { size: 16, shadow: false });
      }
    },
    drawOver(g, s, ctx, h) {
      const z = s.zone;
      // Assombrit tout ce qui est hors de la zone
      g.save();
      g.beginPath(); g.rect(h.cam.x - 10, h.cam.y - 10, h.view.w + 20, h.view.h + 20);
      g.arc(z.x, z.y, z.r, 0, Math.PI * 2, true);
      g.fillStyle = 'rgba(120, 30, 200, .28)'; g.fill();
      g.restore();
      D.circle(g, z.x, z.y, z.r, null, '#c58cff', 4);
      g.setLineDash([12, 10]); D.circle(g, z.tx, z.ty, z.tr, null, 'rgba(255,255,255,.7)', 2); g.setLineDash([]);
    },
    minimapExtra(g, s) {
      g.strokeStyle = '#c58cff'; g.lineWidth = 30; g.beginPath(); g.arc(s.zone.x, s.zone.y, s.zone.r, 0, Math.PI * 2); g.stroke();
    },
    hud(g, s, ctx, h) {
      D.panel(g, 14, 14, 190, 40);
      D.text(g, `👤 ${s.alive} survivant${s.alive > 1 ? 's' : ''}`, 28, 34, { size: 16, align: 'left' });
    },
  });
})();
