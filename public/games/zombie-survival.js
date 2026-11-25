// Affichage : Zombie Survival
(function () {
  const D = RT.draw;
  const ZCOL = { normal: '#6fae4a', rapide: '#b5d65a', brute: '#4d7a33' };
  const SHOP_KEYS = ['arme', 'soin', 'degats', 'vitesse'];

  window.GAME_UI['zombie-survival'] = SHOOTER.create({
    floor: '#1d1f1a', gridColor: 'rgba(255,255,255,.035)', obstacleFill: '#4a3f33', obstacleStroke: '#5f5243',
    bar: `<span id="zs-shop"></span>` + RT.keysHelp('<kbd>ZQSD</kbd> bouger · clic tirer · <kbd>1</kbd>–<kbd>4</kbd> acheter'),
    onKey(k, h) { const i = Number(k) - 1; if (SHOP_KEYS[i] && h.ctx) h.ctx.send({ type: 'buy', item: SHOP_KEYS[i] }); },
    mount(h) {
      h.bar.addEventListener('click', (e) => { const b = e.target.closest('[data-buy]'); if (b && h.ctx) h.ctx.send({ type: 'buy', item: b.dataset.buy }); });
    },
    update(s, ctx, h) {
      const mine = s.players[ctx.me];
      if (!mine) return;
      const next = s.path[s.path.indexOf(mine.weapon) + 1];
      const items = [
        ['arme', next ? `1 · ${SHOOTER.WEAPON_NAMES[next]} (${s.prices[next]} $)` : '1 · Arme max'],
        ['soin', `2 · Soin (${s.shop.soin.price} $)`],
        ['degats', `3 · Dégâts +25 % (${s.shop.degats.price} $)`],
        ['vitesse', `4 · Vitesse +10 % (${s.shop.vitesse.price} $)`],
      ];
      const html = items.map(([id, label]) => `<button data-buy="${id}">${label}</button>`).join(' ');
      const el = h.bar.querySelector('#zs-shop');
      if (el && el.dataset.v !== html) { el.innerHTML = html; el.dataset.v = html; }
    },
    drawMid(g, s, ctx, h, t) {
      for (const z of s.zombies) {
        const wob = Math.sin(t * 8 + z.id) * 2;
        D.circle(g, z.x, z.y + 3, z.r, 'rgba(0,0,0,.35)');
        D.circle(g, z.x, z.y + wob * .3, z.r, ZCOL[z.kind], '#1e2b14', 2);
        D.circle(g, z.x - z.r * .35, z.y - z.r * .2, z.r * .18, '#ff3b30');
        D.circle(g, z.x + z.r * .35, z.y - z.r * .2, z.r * .18, '#ff3b30');
        if (z.hp < z.maxHp) D.bar(g, z.x - z.r, z.y - z.r - 8, z.r * 2, 4, z.hp / z.maxHp, '#ff4d5e');
      }
    },
    minimapExtra(g, s) { g.fillStyle = '#ff4d5e'; for (const z of s.zombies) g.fillRect(z.x - 15, z.y - 15, 30, 30); },
    hud(g, s, ctx, h, mine) {
      D.panel(g, 14, 14, 250, 64);
      D.text(g, `🧟 Vague ${s.wave}`, 28, 34, { size: 20, align: 'left' });
      D.text(g, s.phase === 'pause' ? `Prochaine vague dans ${Math.ceil(s.timer)} s` : `${s.zombies.length + s.toSpawn} zombies restants`, 28, 60, { size: 13, align: 'left', color: '#cfd4f2' });
      if (mine) { D.panel(g, 324, h.view.h - 70, 130, 56); D.text(g, `💰 ${mine.money} $`, 338, h.view.h - 42, { size: 20, align: 'left', color: '#ffd447' }); }
      if (s.phase === 'pause' && s.wave > 0) D.text(g, `Vague ${s.wave} repoussée ! Achète des améliorations (1–4)`, h.view.w / 2, 110, { size: 22, color: '#9be15d' });
    },
  });
})();
