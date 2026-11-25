// Affichage commun aux jeux de tir vue de dessus (Battle Royale, Tactical Strike, Zombie Survival)
window.SHOOTER = (function () {
  const D = RT.draw;
  const WEAPON_NAMES = { pistolet: 'Pistolet', smg: 'Mitraillette', pompe: 'Fusil à pompe', fusil: "Fusil d'assaut", sniper: 'Sniper', minigun: 'Minigun' };

  function drawPlayer(g, p, color, name, isMe) {
    if (!p.alive) {
      D.text(g, '✖', p.x, p.y, { size: 22, color: 'rgba(255,255,255,.35)' });
      return;
    }
    g.save();
    g.translate(p.x, p.y); g.rotate(p.ang);
    D.rrect(g, 6, -4, p.r + 12, 8, 3, '#222', '#000');
    g.restore();
    D.circle(g, p.x, p.y + 3, p.r, 'rgba(0,0,0,.35)');
    D.circle(g, p.x, p.y, p.r, color, isMe ? '#fff' : 'rgba(0,0,0,.6)', isMe ? 3 : 2);
    if (p.shield > 0) D.circle(g, p.x, p.y, p.r + 8, null, '#7fd3ff', 3);
    D.bar(g, p.x - 20, p.y - p.r - 12, 40, 5, p.hp / p.maxHp, p.hp / p.maxHp > .5 ? '#3ecf7a' : p.hp / p.maxHp > .25 ? '#ffb547' : '#ff4d5e');
    D.text(g, name, p.x, p.y - p.r - 24, { size: 12 });
  }

  function create(opts) {
    return RT.game({
      view: { w: 1120, h: 640 },
      bar: opts.bar || '',
      mount: opts.mount,
      onKey: opts.onKey,
      update: opts.update,
      draw(g, s, ctx, h, t) {
        const W = s.W, H = s.H;
        const mine = s.players[ctx.me];
        let focus = mine;
        if (!mine || !mine.alive) {
          const alive = s.players.filter(p => p.alive);
          if (alive.length) { h.spec = h.spec !== undefined && s.players[h.spec] && s.players[h.spec].alive ? h.spec : alive[0].i; focus = s.players[h.spec]; }
        }
        h.follow(focus ? focus.x : W / 2, focus ? focus.y : H / 2, W, H, opts.scale || 1);
        h.applyCam();

        // Sol
        g.fillStyle = opts.floor || '#1b2133'; g.fillRect(0, 0, W, H);
        D.grid(g, h.cam, h.view, h.scale, 80, opts.gridColor || 'rgba(255,255,255,.04)');
        g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 4; g.strokeRect(0, 0, W, H);
        if (opts.drawUnder) opts.drawUnder(g, s, ctx, h, t);

        for (const o of h.cache.obstacles || []) {
          D.rrect(g, o.x + 4, o.y + 6, o.w, o.h, 8, 'rgba(0,0,0,.35)');
          D.rrect(g, o.x, o.y, o.w, o.h, 8, opts.obstacleFill || '#3a4263', opts.obstacleStroke || '#4c567f');
        }
        if (opts.drawMid) opts.drawMid(g, s, ctx, h, t);

        g.lineCap = 'round';
        for (const b of s.bullets) {
          const sp = Math.hypot(b.vx, b.vy) || 1;
          g.strokeStyle = opts.bulletColor ? opts.bulletColor(b, s, ctx) : '#ffe08a'; g.lineWidth = 3;
          g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - b.vx / sp * 14, b.y - b.vy / sp * 14); g.stroke();
        }
        for (const p of s.players) drawPlayer(g, p, opts.playerColor ? opts.playerColor(p, s, ctx) : ctx.colors[p.i], ctx.names[p.i] || '', p.i === ctx.me);
        if (opts.drawOver) opts.drawOver(g, s, ctx, h, t);

        // Viseur
        if (mine && mine.alive) { D.circle(g, h.mouse.x, h.mouse.y, 9, null, 'rgba(255,255,255,.8)', 2); D.circle(g, h.mouse.x, h.mouse.y, 2, '#fff'); }

        // Interface
        h.resetCam();
        if (opts.minimap !== false) {
          const mw = 170, mh = mw * H / W, mx = h.view.w - mw - 14, my = 14;
          D.panel(g, mx - 4, my - 4, mw + 8, mh + 8);
          g.save(); g.translate(mx, my); g.scale(mw / W, mh / H);
          g.beginPath(); g.rect(0, 0, W, H); g.clip();
          g.fillStyle = 'rgba(255,255,255,.18)';
          for (const o of h.cache.obstacles || []) g.fillRect(o.x, o.y, o.w, o.h);
          if (opts.minimapExtra) opts.minimapExtra(g, s, ctx);
          for (const p of s.players) if (p.alive) { g.fillStyle = p.i === ctx.me ? '#fff' : (opts.playerColor ? opts.playerColor(p, s, ctx) : ctx.colors[p.i]); g.fillRect(p.x - 25, p.y - 25, 50, 50); }
          g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = W / mw; g.strokeRect(h.cam.x, h.cam.y, h.view.w / h.scale, h.view.h / h.scale);
          g.restore();
        }
        if (mine) {
          D.panel(g, 14, h.view.h - 70, 300, 56);
          D.bar(g, 26, h.view.h - 58, 200, 14, mine.hp / mine.maxHp, '#3ecf7a');
          D.text(g, `${Math.max(0, Math.round(mine.hp))} PV`, 236, h.view.h - 51, { size: 13, align: 'left' });
          D.text(g, `🔫 ${WEAPON_NAMES[mine.weapon] || ''}   💀 ${mine.kills}`, 26, h.view.h - 30, { size: 14, align: 'left' });
        }
        if (s.feed && s.feed.length) {
          s.feed.slice(0, 4).forEach((f, k) => {
            const txt = f.k === -1 ? `☠ ${ctx.names[f.v]} est mort dans la zone` : `${ctx.names[f.k]} ✖ ${ctx.names[f.v]}`;
            D.text(g, txt, h.view.w - 16, 220 + k * 22, { size: 13, align: 'right', color: '#ffd6db' });
          });
        }
        if (mine && !mine.alive && !s.over) D.text(g, focus ? `Tu es éliminé — tu regardes ${ctx.names[focus.i]}` : 'Tu es éliminé', h.view.w / 2, 40, { size: 18, color: '#ffb3bb' });
        if (opts.hud) opts.hud(g, s, ctx, h, mine, t);
      },
    });
  }

  return { create, drawPlayer, WEAPON_NAMES };
})();
