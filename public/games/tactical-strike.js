// Affichage : Tactical Strike
(function () {
  const D = RT.draw;
  const TEAM = ['#4da3ff', '#ff4d5e'];
  const ICONS = { assaut: '🪖', medic: '⛑️', sniper: '🔭', tank: '🛡️' };
  const KEYS = ['assaut', 'medic', 'sniper', 'tank'];

  window.GAME_UI['tactical-strike'] = SHOOTER.create({
    floor: '#2a2620', gridColor: 'rgba(255,255,255,.04)', obstacleFill: '#6b5a42', obstacleStroke: '#857055',
    playerColor: (p) => TEAM[p.team],
    bar: RT.keysHelp('<kbd>1</kbd>–<kbd>4</kbd> classe (avant la manche) · <kbd>ZQSD</kbd> bouger · clic tirer · clic droit / <kbd>Maj</kbd> capacité'),
    onKey(k, h) { const i = Number(k) - 1; if (KEYS[i] && h.ctx) h.ctx.send({ type: 'class', cls: KEYS[i] }); },
    update(s, ctx, h) {
      const mine = s.players[ctx.me];
      if (s.phase === 'pick' && mine) {
        h.setOverlay(`<h2>Manche ${s.round} — choisis ta classe</h2>
          <p class="muted">Équipe <b style="color:${TEAM[mine.team]}">${mine.team === 0 ? 'Bleue' : 'Rouge'}</b> · départ dans ${Math.ceil(s.timer)} s</p>
          <div class="class-pick">${KEYS.map((k, i) => {
            const c = s.classes[k];
            return `<button data-cls="${k}" class="${mine.cls === k ? 'active' : ''}" style="${mine.cls === k ? 'background:var(--grad)' : ''}"><span class="e">${ICONS[k]}</span><b>${i + 1}. ${c.name}</b><small>${c.hp} PV · ${SHOOTER.WEAPON_NAMES[c.weapon]}<br>Capacité : ${c.ability}</small></button>`;
          }).join('')}</div>`);
        h.overlay.onclick = (e) => { const b = e.target.closest('[data-cls]'); if (b) ctx.send({ type: 'class', cls: b.dataset.cls }); };
      } else h.setOverlay('');
    },
    drawUnder(g, s) {
      g.fillStyle = 'rgba(77,163,255,.12)'; g.fillRect(0, 0, 220, s.H);
      g.fillStyle = 'rgba(255,77,94,.12)'; g.fillRect(s.W - 220, 0, 220, s.H);
      for (const e of s.effects || []) if (e.kind === 'heal') { D.circle(g, e.x, e.y, e.r, 'rgba(62,207,122,.18)', '#3ecf7a', 2); }
    },
    drawOver(g, s) {
      for (const p of s.players) if (p.alive) D.text(g, ICONS[p.cls], p.x, p.y + 1, { size: 14, shadow: false });
    },
    hud(g, s, ctx, h, mine) {
      const cx = h.view.w / 2;
      D.panel(g, cx - 130, 12, 260, 52);
      D.text(g, String(s.score[0]), cx - 70, 38, { size: 30, color: TEAM[0] });
      D.text(g, String(s.score[1]), cx + 70, 38, { size: 30, color: TEAM[1] });
      D.text(g, s.phase === 'fight' ? `${Math.max(0, Math.ceil(s.timer))} s` : `Manche ${s.round}`, cx, 38, { size: 15, color: '#cfd4f2' });
      if (s.phase === 'end') {
        const w = s.roundWinner;
        D.text(g, w === -1 ? 'Manche nulle' : `Manche pour l'équipe ${w === 0 ? 'Bleue' : 'Rouge'} !`, cx, h.view.h / 2 - 40, { size: 34, color: w === -1 ? '#fff' : TEAM[w] });
      }
      if (mine && mine.alive && s.classes[mine.cls]) {
        const c = s.classes[mine.cls];
        const ready = mine.abilityCd <= 0;
        D.panel(g, 324, h.view.h - 70, 230, 56);
        D.text(g, `${ICONS[mine.cls]} ${c.ability}`, 338, h.view.h - 52, { size: 14, align: 'left' });
        D.text(g, ready ? 'PRÊT (clic droit)' : `${Math.ceil(mine.abilityCd)} s`, 338, h.view.h - 30, { size: 13, align: 'left', color: ready ? '#3ecf7a' : '#ffb547' });
      }
    },
  });
})();
