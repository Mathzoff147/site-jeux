// Affichage : Block World
(function () {
  const D = RT.draw;
  const COLORS = {
    1: ['#5fb34a', '#7a5133'], 2: ['#8b5a3c', '#8b5a3c'], 3: ['#7d8290', '#7d8290'], 4: ['#7a5133', '#6a4529'],
    5: ['#3f9a3a', '#3f9a3a'], 6: ['#c69a5b', '#b38749'], 7: ['#7d8290', '#222'], 8: ['#7d8290', '#ffd447'],
    9: ['#e8d38f', '#e8d38f'], 11: ['rgba(190,230,255,.45)', 'rgba(190,230,255,.45)'], 12: ['#2a2a33', '#2a2a33'], 13: ['#a8513b', '#8c4130'],
  };
  const NAMES = { 2: 'Terre', 3: 'Pierre', 4: 'Bois', 6: 'Planches', 11: 'Verre', 9: 'Sable', 13: 'Brique', 7: 'Charbon', 8: 'Or' };

  function decode(b64) {
    const bin = atob(b64), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function drawTile(g, v, x, y, T) {
    const [top, body] = COLORS[v] || ['#f0f', '#f0f'];
    g.fillStyle = body; g.fillRect(x, y, T, T);
    if (v === 1) { g.fillStyle = top; g.fillRect(x, y, T, 6); }
    else if (v === 7 || v === 8) { g.fillStyle = body; g.fillRect(x + 4, y + 5, 4, 4); g.fillRect(x + 12, y + 11, 4, 4); g.fillRect(x + 6, y + 13, 3, 3); g.fillStyle = top === '#7d8290' ? '#7d8290' : top; }
    else if (v === 6) { g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x, y + 9, T, 2); }
    else if (v === 13) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, y + 9, T, 2); g.fillRect(x + 9, y, 2, 9); }
    else if (v === 5) { g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x + 3, y + 3, 5, 5); g.fillRect(x + 12, y + 10, 5, 5); }
    if (v === 7 || v === 8) { g.fillStyle = v === 7 ? '#222' : '#ffd447'; g.fillRect(x + 4, y + 5, 4, 4); g.fillRect(x + 12, y + 11, 4, 4); g.fillRect(x + 6, y + 13, 3, 3); }
    g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x, y, T, 2);
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x, y + T - 2, T, 2);
  }

  window.GAME_UI['block-world'] = RT.game({
    view: { w: 1120, h: 640 },
    bar: `<button data-craft="planches">🪵 1 bois → 4 planches</button><button data-craft="verre">🔷 2 sable → 1 verre</button><button data-craft="brique">🧱 2 pierres → 1 brique</button>`
      + RT.keysHelp('<kbd>Q</kbd><kbd>D</kbd> marcher · <kbd>Z</kbd>/<kbd>Espace</kbd> sauter · clic gauche creuser/frapper · clic droit poser · <kbd>1</kbd>–<kbd>7</kbd> choisir le bloc'),
    mount(h) { h.bar.addEventListener('click', (e) => { const b = e.target.closest('[data-craft]'); if (b && h.ctx) h.ctx.send({ type: 'craft', recipe: b.dataset.craft }); }); },
    onKey(k, h) { const n = Number(k); if (n >= 1 && n <= 7 && h.ctx) h.ctx.send({ type: 'select', slot: n - 1 }); },
    update(s, ctx, h) {
      if (s.world) h.world = decode(s.world);
      if (h.world) for (const [i, v] of s.edits || []) h.world[i] = v;
    },
    draw(g, s, ctx, h, t) {
      if (!h.world) return;
      const T = s.T, W = s.COLS * T, H = s.ROWS * T;
      const mine = s.players[ctx.me] || s.players[0];
      h.follow(mine.x, mine.y, W, H, 1);
      // Ciel selon l'heure
      const phase = s.time / s.day; // 0 → 1
      const night = phase > 0.55;
      const sky = g.createLinearGradient(0, 0, 0, h.view.h);
      sky.addColorStop(0, night ? '#0b1030' : phase > 0.45 ? '#ff9a5c' : '#6fb8ff');
      sky.addColorStop(1, night ? '#1a1f45' : phase > 0.45 ? '#ffd29a' : '#bfe3ff');
      g.fillStyle = sky; g.fillRect(0, 0, h.view.w, h.view.h);
      if (night) for (let k = 0; k < 60; k++) { g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect((k * 197) % h.view.w, (k * 73) % 260, 2, 2); }
      const sunX = h.view.w * ((phase % 0.55) / 0.55);
      D.circle(g, night ? h.view.w * ((phase - 0.55) / 0.45) : sunX, 90, 34, night ? '#f2f2ff' : '#ffe27a');

      h.applyCam();
      const x0 = Math.max(0, Math.floor(h.cam.x / T)), x1 = Math.min(s.COLS - 1, Math.ceil((h.cam.x + h.view.w) / T));
      const y0 = Math.max(0, Math.floor(h.cam.y / T)), y1 = Math.min(s.ROWS - 1, Math.ceil((h.cam.y + h.view.h) / T));
      // Fond des grottes (sous la surface)
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const v = h.world[y * s.COLS + x];
        if (v) drawTile(g, v, x * T, y * T, T);
        else if (y > 40) { g.fillStyle = 'rgba(30,25,20,.55)'; g.fillRect(x * T, y * T, T, T); }
      }
      // Progression du minage
      for (const p of s.players) if (p.mine) { g.fillStyle = `rgba(0,0,0,${0.15 + p.mine.p * 0.5})`; g.fillRect(p.mine.tx * T, p.mine.ty * T, T, T); g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.moveTo(p.mine.tx * T + 4, p.mine.ty * T + 4); g.lineTo(p.mine.tx * T + 4 + 12 * p.mine.p, p.mine.ty * T + 16); g.stroke(); }
      // Case visée
      const tx = Math.floor(h.mouse.x / T), ty = Math.floor(h.mouse.y / T);
      if (Math.hypot(h.mouse.x - mine.x, h.mouse.y - mine.y) < 5.5 * T) { g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; g.strokeRect(tx * T + 1, ty * T + 1, T - 2, T - 2); }
      // Monstres
      for (const m of s.monsters) {
        const squash = 1 + Math.sin(t * 10 + m.id) * 0.08;
        D.rrect(g, m.x - m.w / 2 * squash, m.y - m.h / 2 / squash, m.w * squash, m.h / squash, 7, 'rgba(90,220,90,.85)', '#1d5c1d');
        g.fillStyle = '#000'; g.fillRect(m.x - 5, m.y - 3, 3, 3); g.fillRect(m.x + 2, m.y - 3, 3, 3);
      }
      // Joueurs
      for (const p of s.players) {
        if (p.dead) continue;
        const c = ctx.colors[p.i];
        D.rrect(g, p.x - p.w / 2, p.y - p.h / 2 + 10, p.w, p.h - 10, 3, c, '#0007');
        D.rrect(g, p.x - 7, p.y - p.h / 2 - 2, 14, 14, 3, '#ffd9b3', '#0007');
        g.fillStyle = '#222'; g.fillRect(p.x + (p.face > 0 ? 2 : -5), p.y - p.h / 2 + 2, 3, 3);
        D.text(g, ctx.names[p.i] || '', p.x, p.y - p.h / 2 - 14, { size: 12 });
        if (p.hp < 100) D.bar(g, p.x - 16, p.y - p.h / 2 - 6, 32, 3, p.hp / 100, '#ff4d5e');
      }
      // Assombrissement de nuit
      h.resetCam();
      if (night) { g.fillStyle = 'rgba(5,8,30,.35)'; g.fillRect(0, 0, h.view.w, h.view.h); }

      // Barre d'objets
      const slots = s.slots, size = 50, bx = h.view.w / 2 - slots.length * (size + 6) / 2;
      slots.forEach((v, i) => {
        const x = bx + i * (size + 6), y = h.view.h - size - 14;
        D.rrect(g, x, y, size, size, 8, 'rgba(8,10,22,.75)', i === mine.sel ? '#ffd447' : 'rgba(255,255,255,.25)');
        drawTile(g, v, x + 13, y + 9, 24);
        D.text(g, String(mine.inv[v] || 0), x + size - 8, y + size - 9, { size: 12, align: 'right' });
        D.text(g, String(i + 1), x + 8, y + 9, { size: 10, color: '#aaa' });
      });
      D.text(g, NAMES[slots[mine.sel]] || '', h.view.w / 2, h.view.h - size - 28, { size: 14 });
      // Vie + heure
      D.panel(g, 14, 14, 230, 46);
      D.bar(g, 28, 28, 140, 16, mine.hp / 100, '#ff4d5e');
      D.text(g, night ? '🌙 Nuit' : '☀️ Jour', 180, 37, { size: 15, align: 'left' });
      const other = Object.entries(mine.inv).filter(([k, n]) => n > 0 && !slots.includes(Number(k)));
      if (other.length) D.text(g, other.map(([k, n]) => `${NAMES[k] || k} : ${n}`).join('  ·  '), 14, 80, { size: 13, align: 'left' });
      if (mine.dead) D.text(g, 'Tu es mort… réapparition !', h.view.w / 2, h.view.h / 2, { size: 30, color: '#ffb3bb' });
    },
  });
})();
