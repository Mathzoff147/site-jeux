// Affichage : Fantasy Quest
(function () {
  const D = RT.draw;
  const CLS_ICON = { guerrier: '⚔️', mage: '🔮', archer: '🏹' };
  const MON_ICON = { slime: '🟢', loup: '🐺', squelette: '💀', golem: '🗿' };
  const ZONE_COL = { foret: '#24502a', cimetiere: '#3a3550', ruines: '#6b5a3a' };
  const ZONE_NAME = { foret: '🌲 Forêt', cimetiere: '🪦 Cimetière', ruines: '🏛️ Ruines' };

  window.GAME_UI['fantasy-quest'] = RT.game({
    view: { w: 1120, h: 640 },
    bar: RT.keysHelp('<kbd>ZQSD</kbd> bouger · souris viser · clic gauche attaquer · clic droit / <kbd>Maj</kbd> capacité · le village 🏠 soigne'),
    update(s, ctx, h) {
      const mine = s.players[ctx.me];
      if (mine && !mine.cls) {
        h.setOverlay(`<h2>Choisis ta classe</h2><p class="muted">Ensemble, montez en niveau et terrassez le dragon à l'est !</p>
          <div class="class-pick">${Object.entries(s.classes).map(([k, c]) => `<button data-cls="${k}"><span class="e">${CLS_ICON[k]}</span><b>${c.name}</b><small>${c.hp} PV · ${k === 'guerrier' ? 'corps à corps' : k === 'mage' ? 'boules de feu' : 'flèches rapides'}<br>Capacité : ${c.ability}</small></button>`).join('')}</div>`);
        h.overlay.onclick = (e) => { const b = e.target.closest('[data-cls]'); if (b) ctx.send({ type: 'class', cls: b.dataset.cls }); };
      } else h.setOverlay('');
    },
    draw(g, s, ctx, h, t) {
      const mine = s.players[ctx.me] || s.players[0];
      h.follow(mine.x, mine.y, s.W, s.H, 1);
      h.applyCam();
      // Terrain
      g.fillStyle = '#3c6b35'; g.fillRect(0, 0, s.W, s.H);
      D.grid(g, h.cam, h.view, h.scale, 64, 'rgba(0,0,0,.06)');
      for (const [id, z] of Object.entries(s.zones)) { D.rrect(g, z.x, z.y, z.w, z.h, 40, ZONE_COL[id]); D.text(g, ZONE_NAME[id], z.x + z.w / 2, z.y + 30, { size: 20, color: 'rgba(255,255,255,.55)' }); }
      const v = s.village;
      D.rrect(g, v.x, v.y, v.w, v.h, 30, '#b59a6a', '#8a7248');
      for (const [hx, hy] of [[60, 60], [300, 70], [80, 300], [330, 320]]) { D.rrect(g, v.x + hx, v.y + hy, 90, 70, 6, '#d9c6a0', '#6b4a2b'); g.fillStyle = '#b5433a'; g.beginPath(); g.moveTo(v.x + hx - 8, v.y + hy); g.lineTo(v.x + hx + 45, v.y + hy - 35); g.lineTo(v.x + hx + 98, v.y + hy); g.fill(); }
      D.text(g, '🏠 Village (soins)', v.x + v.w / 2, v.y + v.h / 2, { size: 18 });
      const a = s.arena;
      D.rrect(g, a.x, a.y, a.w, a.h, 10, '#3a1a1a');
      D.text(g, '🔥 Antre du dragon', a.x + a.w / 2, a.y + 40, { size: 22, color: '#ff8a3d' });
      // Obstacles
      for (const o of h.cache.obstacles || []) {
        if (o.kind === 'arbre') { D.circle(g, o.x + o.w / 2 + 4, o.y + o.h / 2 + 6, o.w / 2, 'rgba(0,0,0,.25)'); D.circle(g, o.x + o.w / 2, o.y + o.h / 2, o.w / 2, '#2c7a34', '#1d5223', 3); D.circle(g, o.x + o.w / 2 - 6, o.y + o.h / 2 - 6, o.w / 5, 'rgba(255,255,255,.12)'); }
        else if (o.kind === 'tombe') D.rrect(g, o.x + o.w / 4, o.y, o.w / 2, o.h, 12, '#8d8aa0', '#5d5a70');
        else D.rrect(g, o.x, o.y, o.w, o.h, 4, '#5a4a4a', '#3a2a2a');
      }
      // Effets
      for (const e of s.effects) {
        if (e.kind === 'slash') { g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 6; g.beginPath(); g.arc(e.x, e.y, e.r, e.ang - 1, e.ang + 1); g.stroke(); }
        if (e.kind === 'whirl') D.circle(g, e.x, e.y, e.r, 'rgba(255,255,255,.15)', '#fff', 4);
        if (e.kind === 'heal') D.circle(g, e.x, e.y, e.r, 'rgba(62,207,122,.2)', '#3ecf7a', 3);
        if (e.kind === 'boom') D.circle(g, e.x, e.y, e.r, 'rgba(255,120,40,.45)');
        if (e.kind === 'level') D.text(g, '⬆ NIVEAU !', e.x, e.y - 40 - (1.2 - e.t) * 30, { size: 20, color: '#ffd447' });
      }
      // Monstres
      for (const m of s.monsters) {
        D.circle(g, m.x, m.y + 4, m.r, 'rgba(0,0,0,.3)');
        D.circle(g, m.x, m.y, m.r, m.hit ? '#fff' : 'rgba(30,20,30,.6)');
        D.text(g, MON_ICON[m.type], m.x, m.y + 1, { size: m.r * 1.6, shadow: false });
        if (m.hp < m.maxHp) D.bar(g, m.x - m.r, m.y - m.r - 8, m.r * 2, 4, m.hp / m.maxHp, '#ff4d5e');
      }
      // Dragon
      const b = s.boss;
      if (b.hp > 0) {
        D.circle(g, b.x, b.y + 8, b.r, 'rgba(0,0,0,.35)');
        D.circle(g, b.x, b.y, b.r + Math.sin(t * 4) * 3, b.hit ? '#fff' : 'rgba(200,40,40,.5)');
        D.text(g, '🐉', b.x, b.y, { size: b.r * 1.8, shadow: false });
      }
      // Projectiles
      for (const p of s.projectiles) {
        if (p.kind === 'fleche') { g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = '#e9d8b0'; g.fillRect(-10, -1.5, 20, 3); g.restore(); }
        else if (p.kind === 'feu') D.circle(g, p.x, p.y, 8, '#ff8a3d', '#ffd447', 2);
        else if (p.kind === 'feu-dragon') D.circle(g, p.x, p.y, 10, '#ff3b30', '#ff8a3d', 3);
        else D.circle(g, p.x, p.y, 5, '#eee');
      }
      // Joueurs
      for (const p of s.players) {
        if (!p.cls) continue;
        if (!p.alive) { D.text(g, '👻', p.x, p.y, { size: 24, shadow: false }); continue; }
        D.circle(g, p.x, p.y + 3, p.r, 'rgba(0,0,0,.3)');
        D.circle(g, p.x, p.y, p.r, ctx.colors[p.i], p.i === ctx.me ? '#fff' : '#0008', p.i === ctx.me ? 3 : 2);
        D.text(g, CLS_ICON[p.cls], p.x, p.y + 1, { size: 15, shadow: false });
        D.bar(g, p.x - 20, p.y - p.r - 10, 40, 5, p.hp / p.maxHp, '#3ecf7a');
        D.text(g, `${ctx.names[p.i] || ''} · niv ${p.level}`, p.x, p.y - p.r - 22, { size: 12 });
      }
      if (mine.alive && mine.cls) D.circle(g, h.mouse.x, h.mouse.y, 8, null, 'rgba(255,255,255,.8)', 2);

      // Interface
      h.resetCam();
      if (mine.cls) {
        const c = s.classes[mine.cls];
        D.panel(g, 14, h.view.h - 96, 330, 82);
        D.text(g, `${CLS_ICON[mine.cls]} ${c.name} — niveau ${mine.level}`, 28, h.view.h - 78, { size: 16, align: 'left' });
        D.bar(g, 28, h.view.h - 62, 300, 12, mine.hp / mine.maxHp, '#3ecf7a');
        D.bar(g, 28, h.view.h - 44, 300, 6, mine.xp / (mine.level * 60), '#7c5cff');
        D.text(g, mine.abilityCd > 0 ? `${c.ability} : ${Math.ceil(mine.abilityCd)} s` : `${c.ability} : PRÊT (clic droit)`, 28, h.view.h - 26, { size: 13, align: 'left', color: mine.abilityCd > 0 ? '#ffb547' : '#3ecf7a' });
        if (!mine.alive) D.text(g, `Tu es K.O. — retour au village dans ${mine.respawn} s`, h.view.w / 2, 60, { size: 22, color: '#ffb3bb' });
      }
      if (b.awake || b.hp < b.maxHp) {
        D.panel(g, h.view.w / 2 - 210, 12, 420, 40);
        D.text(g, '🐉 Dragon', h.view.w / 2 - 196, 32, { size: 15, align: 'left' });
        D.bar(g, h.view.w / 2 - 110, 24, 306, 16, b.hp / b.maxHp, '#ff4d5e');
      }
      // Mini-carte
      const mw = 200, sc = mw / s.W, mh = s.H * sc, mx = h.view.w - mw - 14, my = 14;
      D.panel(g, mx - 4, my - 4, mw + 8, mh + 8);
      g.save(); g.translate(mx, my); g.scale(sc, sc);
      g.fillStyle = '#3c6b35'; g.fillRect(0, 0, s.W, s.H);
      for (const [id, z] of Object.entries(s.zones)) { g.fillStyle = ZONE_COL[id]; g.fillRect(z.x, z.y, z.w, z.h); }
      g.fillStyle = '#b59a6a'; g.fillRect(v.x, v.y, v.w, v.h);
      g.fillStyle = '#7a2020'; g.fillRect(a.x, a.y, a.w, a.h);
      for (const p of s.players) if (p.cls && p.alive) { g.fillStyle = p.i === ctx.me ? '#fff' : ctx.colors[p.i]; g.beginPath(); g.arc(p.x, p.y, 45, 0, 7); g.fill(); }
      g.restore();
    },
  });
})();
