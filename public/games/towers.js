// =====================================================================
//  TOWER DEFENSE — affichage (navigateur)
// =====================================================================
import { shell, endScreen, sfx, esc, css, Stage, Interp, Particles, Floaters, loop, D, hud, clamp } from '../lib/kit.js';

css('td-css', `
.td-hud .tl { position:absolute; left:12px; top:62px; display:flex; gap:8px; flex-wrap:wrap; align-items:center; pointer-events:auto; }
.td-pill { background:rgba(0,0,0,.65); padding:7px 12px; border-radius:12px; font-weight:800; font-size:15px; }
.td-build { position:absolute; left:50%; bottom:10px; transform:translateX(-50%); display:flex; gap:6px; pointer-events:auto; background:rgba(8,12,20,.85); padding:8px; border-radius:16px; border:1px solid rgba(255,255,255,.1); max-width:calc(100vw - 20px); overflow-x:auto; }
.td-tb { width:84px; flex:none; border:2px solid transparent; background:rgba(255,255,255,.06); color:#fff; border-radius:12px; padding:6px 4px; cursor:pointer; font:inherit; text-align:center; transition: all .12s; }
.td-tb:hover { background:rgba(255,255,255,.12); } .td-tb.on { border-color:#facc15; background:rgba(250,204,21,.15); }
.td-tb.no { opacity:.4; } .td-tb .ic { font-size:24px; display:block; } .td-tb b { font-size:12px; display:block; } .td-tb small { color:#fde047; font-weight:800; }
.td-sel { position:absolute; right:12px; top:62px; width:250px; pointer-events:auto; }
.td-sel h3 { margin:0 0 6px; } .td-sel .row { display:flex; justify-content:space-between; font-size:14px; padding:2px 0; }
.td-sel .acts { display:flex; flex-direction:column; gap:6px; margin-top:10px; } .td-sel .seg { display:flex; gap:4px; flex-wrap:wrap; }
.td-sel .seg button { flex:1; padding:5px; font-size:12px; }
.td-banner { position:absolute; left:50%; top:30%; transform:translateX(-50%); font-family:'Space Grotesk'; font-size:46px; font-weight:700; text-shadow:0 4px 14px #000; animation: tdin .5s; pointer-events:none; }
@keyframes tdin { from { transform:translateX(-50%) scale(1.5); opacity:0; } }
.td-team { position:absolute; left:12px; top:112px; display:flex; flex-direction:column; gap:4px; font-size:13px; }
.td-team div { background:rgba(0,0,0,.5); padding:3px 10px; border-radius:8px; }
`);

let api, ST, S, sh, stage, stop, parts, floats, eint, ui = {}, bg, endShown = false, buildSel = null, selTower = null, mouse = { x: -1, y: -1, in: false }, zaps = [], frosts = [], banner = { t: 0, html: '' }, lastCur = 0;
const set = (k, html) => { const el = ui[k]; if (el._h !== html) { el._h = html; el.innerHTML = html; } };

function renderBg() {
  const { C, COLS, ROWS, W, H } = ST;
  bg = document.createElement('canvas'); bg.width = W; bg.height = H;
  const g = bg.getContext('2d'); const cells = new Set(ST.cells);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const path = cells.has(`${x},${y}`);
    g.fillStyle = path ? ((x + y) % 2 ? '#a8946c' : '#b39f75') : ((x + y) % 2 ? '#4a7c3a' : '#528a40');
    g.fillRect(x * C, y * C, C, C);
    for (let k = 0; k < 14; k++) { g.fillStyle = path ? 'rgba(80,60,30,.25)' : 'rgba(20,50,10,.25)'; g.fillRect(x * C + Math.random() * C, y * C + Math.random() * C, 3, 3); }
    if (!path && Math.random() < 0.08) { g.fillStyle = ['#fde047', '#f9a8d4', '#fff'][k3(x, y)]; for (let k = 0; k < 4; k++) g.fillRect(x * C + 10 + Math.random() * 30, y * C + 10 + Math.random() * 30, 4, 4); }
  }
  // bord du chemin
  g.strokeStyle = 'rgba(60,45,20,.5)'; g.lineWidth = 3;
  for (const c of cells) { const [x, y] = c.split(',').map(Number); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!cells.has(`${x + dx},${y + dy}`) && x + dx >= 0 && y + dy >= 0 && x + dx < COLS && y + dy < ROWS) { g.beginPath(); if (dx) { const xx = (dx > 0 ? x + 1 : x) * C; g.moveTo(xx, y * C); g.lineTo(xx, y * C + C); } else { const yy = (dy > 0 ? y + 1 : y) * C; g.moveTo(x * C, yy); g.lineTo(x * C + C, yy); } g.stroke(); } }
  // entrée / sortie
  const P = ST.path, a = P[0], b = P[P.length - 1];
  const clampP = p => ({ x: clamp(p.x, C / 2, W - C / 2), y: clamp(p.y, C / 2, H - C / 2) });
  D.text(g, '🚩', clampP(a).x, clampP(a).y, { size: 28, stroke: false });
  D.text(g, '🏰', clampP(b).x, clampP(b).y, { size: 34, stroke: false });
}
const k3 = (x, y) => (x * 7 + y * 13) % 3;

function drawTower(g, t, t0) {
  const T = ST.towers[t.type], C = ST.C;
  D.shadow(g, t.x + 3, t.y + 8, 22, 10);
  D.rrect(g, t.x - 22, t.y - 22, 44, 44, 9, '#334155', t.color, 3);
  D.rrect(g, t.x - 16, t.y - 16, 32, 32, 7, T.color);
  g.save(); g.translate(t.x, t.y); g.rotate(t.a);
  switch (t.type) {
    case 'canon': D.rrect(g, 0, -6, 24, 12, 4, '#1f2937'); D.circle(g, 0, 0, 10, '#475569'); break;
    case 'mitrail': D.rrect(g, 0, -7, 22, 5, 2, '#1f2937'); D.rrect(g, 0, 2, 22, 5, 2, '#1f2937'); D.circle(g, 0, 0, 9, '#a16207'); break;
    case 'mortier': D.circle(g, 0, 0, 12, '#1f2937'); D.circle(g, 4, 0, 7, '#000'); break;
    case 'sniper': D.rrect(g, 0, -3, 34, 6, 2, '#0f172a'); D.circle(g, 0, 0, 8, '#14532d'); D.rrect(g, 6, -6, 10, 4, 2, '#334155'); break;
    case 'tesla': g.rotate(-t.a); D.circle(g, 0, 0, 12, '#4c1d95'); D.circle(g, 0, 0, 6 + Math.sin(t0 * 8) * 1.5, '#c4b5fd'); break;
    case 'laser': D.rrect(g, 0, -4, 26, 8, 3, '#7f1d1d'); D.circle(g, 0, 0, 10, '#991b1b'); D.circle(g, 22, 0, 3, '#fecaca'); break;
    case 'givre': g.rotate(t0 - t.a); for (let k = 0; k < 6; k++) { g.rotate(Math.PI / 3); g.fillStyle = '#e0f2fe'; g.fillRect(0, -2, 13, 4); } break;
    case 'banque': g.rotate(-t.a); D.text(g, '💰', 0, 0, { size: 20, stroke: false }); break;
  }
  g.restore();
  for (let k = 0; k < t.level; k++) D.circle(g, t.x - 10 + k * 10, t.y + 26, 3.5, '#facc15', '#000', 1);
}
function drawEnemy(g, e, t0) {
  const E = ST.enemies[e.t], r = E.r;
  if (E.stealth) g.globalAlpha = 0.45 + Math.sin(t0 * 4 + e.id) * 0.15;
  D.shadow(g, e.x + 2, e.y + r * 0.8, r, r * 0.4);
  const bob = Math.sin(t0 * 10 + e.id) * 1.5;
  D.circle(g, e.x, e.y + bob, r, E.color, 'rgba(0,0,0,.5)', 2);
  if (e.t === 'tank' || e.t === 'boss') { D.rrect(g, e.x - r * 0.7, e.y - r * 0.7 + bob, r * 1.4, r * 1.4, 4, null, '#000a', 3); }
  if (e.t === 'regen') D.text(g, '+', e.x, e.y + bob, { size: 14, color: '#bbf7d0' });
  if (e.t === 'essaim') for (let k = 0; k < 4; k++) D.circle(g, e.x + Math.cos(k * 1.57 + t0) * r * 0.5, e.y + Math.sin(k * 1.57 + t0) * r * 0.5 + bob, 3, '#e9d5ff');
  if (e.t === 'boss') D.text(g, '👑', e.x, e.y - r - 6, { size: 18, stroke: false });
  D.circle(g, e.x - r * 0.3, e.y - r * 0.15 + bob, r * 0.18, '#fff'); D.circle(g, e.x + r * 0.3, e.y - r * 0.15 + bob, r * 0.18, '#fff');
  D.circle(g, e.x - r * 0.3, e.y - r * 0.1 + bob, r * 0.09, '#000'); D.circle(g, e.x + r * 0.3, e.y - r * 0.1 + bob, r * 0.09, '#000');
  if (e.sh) D.circle(g, e.x, e.y + bob, r + 4, null, 'rgba(96,165,250,.9)', 3);
  if (e.sl) D.circle(g, e.x, e.y + bob, r + 2, 'rgba(125,211,252,.3)');
  g.globalAlpha = 1;
  if (e.hp < 100) D.bar(g, e.x - r, e.y - r - 8, r * 2, 4, e.hp / 100, e.hp > 50 ? '#22c55e' : '#ef4444');
}

function frame(dt, now) {
  if (!S) return;
  const t0 = now / 1000, { W, H, C } = ST;
  // cadrage : toute la carte visible au-dessus de la barre de construction
  const zoom = Math.min(stage.w / (W + 20), (stage.h - 170) / (H + 10));
  stage.cam.zoom = zoom; stage.cam.x = W / 2; stage.cam.y = H / 2 - 40 / zoom + 20;
  parts.update(dt); floats.update(dt);
  const g = stage.g;
  g.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0); g.fillStyle = '#0f1a0d'; g.fillRect(0, 0, stage.w, stage.h);
  g.translate(stage.w / 2, stage.h / 2); g.scale(zoom, zoom); g.translate(-stage.cam.x, -stage.cam.y);
  g.drawImage(bg, 0, 0);
  g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1; for (let x = 0; x <= W; x += C) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y <= H; y += C) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  // survol
  const w = mouse.in ? stage.toWorld(mouse.x, mouse.y) : null;
  const cx = w ? Math.floor(w.x / C) : -1, cy = w ? Math.floor(w.y / C) : -1;
  const sel = S.towers.find(x => x.id === selTower);
  if (sel) { D.circle(g, sel.x, sel.y, sel.range, 'rgba(255,255,255,.08)', 'rgba(255,255,255,.5)', 2); }
  for (const f of frosts) { f.t -= dt; D.circle(g, f.x, f.y, f.r * (1 - f.t * 0.6), null, `rgba(186,230,253,${f.t})`, 3); } frosts = frosts.filter(f => f.t > 0);
  for (const t of S.towers) drawTower(g, t, t0);
  const ens = eint.all();
  for (const e of ens) drawEnemy(g, e, t0);
  // rayons laser
  for (const t of S.towers) if (t.beam) { const e = ens.find(x => x.id === t.beam); if (e) { g.strokeStyle = 'rgba(254,202,202,.95)'; g.lineWidth = 4 + t.level; g.beginPath(); g.moveTo(t.x + Math.cos(t.a) * 22, t.y + Math.sin(t.a) * 22); g.lineTo(e.x, e.y); g.stroke(); g.strokeStyle = 'rgba(239,68,68,.5)'; g.lineWidth = 10 + t.level * 2; g.stroke(); parts.burst(e.x, e.y, { n: 1, color: '#fca5a5', speed: 60, life: 0.2, size: 3, glow: true }); } }
  for (const s of S.shots) {
    if (s[1] === 'shell') { const k = s[4], h = Math.sin(k * Math.PI) * 50; D.shadow(g, s[2], s[3], 6, 3); D.circle(g, s[2], s[3] - h, 7, '#1f2937', '#000', 1); }
    else if (s[1] === 'bullet') D.circle(g, s[2], s[3], 2.5, '#fde047');
    else if (s[1] === 'snipe') D.circle(g, s[2], s[3], 3, '#bbf7d0');
    else D.circle(g, s[2], s[3], 5, '#111827', '#64748b', 1.5);
  }
  for (const z of zaps) { z.t -= dt; g.strokeStyle = `rgba(196,181,253,${z.t * 4})`; g.lineWidth = 3; g.beginPath(); z.pts.forEach(([x, y], i) => { if (!i) g.moveTo(x, y); else { const [px, py] = z.pts[i - 1]; for (let k = 1; k <= 4; k++) g.lineTo(px + (x - px) * k / 4 + (k < 4 ? (Math.random() - 0.5) * 16 : 0), py + (y - py) * k / 4 + (k < 4 ? (Math.random() - 0.5) * 16 : 0)); } }); g.stroke(); }
  zaps = zaps.filter(z => z.t > 0);
  parts.draw(g); floats.draw(g);
  // fantôme de construction
  if (buildSel && cx >= 0 && cy >= 0 && cx < ST.COLS && cy < ST.ROWS) {
    const T = ST.towers[buildSel], ok = !ST.cells.includes(`${cx},${cy}`) && !S.towers.some(t => t.cx === cx && t.cy === cy) && myMoney() >= T.cost;
    D.circle(g, cx * C + C / 2, cy * C + C / 2, T.range, ok ? 'rgba(255,255,255,.08)' : 'rgba(239,68,68,.1)', ok ? 'rgba(255,255,255,.4)' : 'rgba(239,68,68,.5)', 2);
    D.rrect(g, cx * C + 4, cy * C + 4, C - 8, C - 8, 8, ok ? 'rgba(250,204,21,.35)' : 'rgba(239,68,68,.35)');
    D.text(g, T.icon, cx * C + C / 2, cy * C + C / 2, { size: 24, stroke: false });
  }
  // curseurs des coéquipiers
  for (const p of S.players) if (p.id !== api.myId && p.cur) { D.circle(g, p.cur[0], p.cur[1], 6, p.color, '#fff', 2); D.text(g, p.name, p.cur[0] + 10, p.cur[1] - 10, { size: 11, align: 'left', color: p.color }); }
  if (w && now - lastCur > 120) { lastCur = now; api.send({ type: 'cur', x: Math.round(w.x), y: Math.round(w.y) }); }
  renderHud();
}
const myMoney = () => S.players.find(p => p.id === api.myId)?.money ?? 0;

function renderHud() {
  const m = myMoney();
  set('tl', `<span class="td-pill">🌊 Vague ${S.wave}${S.goal ? ` / ${S.goal}` : ''}</span><span class="td-pill" style="color:${S.lives <= S.maxLives * 0.3 ? '#f87171' : '#fff'}">❤️ ${S.lives}</span><span class="td-pill" style="color:#fde047">💰 ${m} $</span>
    ${S.phase === 'build' ? `<span class="td-pill">⏳ ${S.timer}s</span><button class="gk-btn primary" data-go>▶ Lancer la vague</button>` : ''}
    <button class="gk-btn" data-speed>⏩ ×${S.speed}</button>`);
  set('team', S.players.length > 1 ? S.players.map(p => `<div><span class="dot" style="background:${p.color}"></span> ${esc(p.name)} · ${p.money} $</div>`).join('') : '');
  set('build', Object.entries(ST.towers).map(([k, T]) => `<button class="td-tb ${buildSel === k ? 'on' : ''} ${m < T.cost ? 'no' : ''}" data-t="${k}" title="${esc(T.desc)}"><span class="ic">${T.icon}</span><b>${esc(T.name)}</b><small>${T.cost} $</small></button>`).join(''));
  const t = S.towers.find(x => x.id === selTower);
  ui.sel.style.display = t ? '' : 'none';
  if (t) {
    const T = ST.towers[t.type], owner = S.players.find(p => p.id === t.owner);
    set('sel', `<h3>${T.icon} ${esc(T.name)} <small>niv. ${t.level}</small></h3><small class="gk-muted">${esc(T.desc)}</small>
      ${!T.income ? `<div class="row"><span>Dégâts</span><b>${t.dmg}${T.beam ? '/s' : ''}</b></div><div class="row"><span>Portée</span><b>${Math.round(t.range)}</b></div><div class="row"><span>Éliminations</span><b>${t.kills}</b></div>` : `<div class="row"><span>Revenu / vague</span><b>${T.income * t.level} $</b></div>`}
      <div class="row"><span>Propriétaire</span><b style="color:${owner?.color}">${esc(owner?.name || '—')}</b></div>
      <div class="acts">${t.upCost ? `<button class="gk-btn primary" data-up ${m < t.upCost ? 'disabled' : ''}>⬆ Améliorer (${t.upCost} $)</button>` : '<span class="gk-muted">Niveau maximum</span>'}
      <button class="gk-btn danger" data-sell>Vendre (+${Math.round(t.spent * 0.7)} $)</button>
      ${!T.aura && !T.income ? `<div class="seg">${[['first', 'Premier'], ['last', 'Dernier'], ['strong', 'Fort'], ['close', 'Proche']].map(([k, l]) => `<button class="gk-btn ${t.target === k ? 'primary' : ''}" data-tg="${k}">${l}</button>`).join('')}</div>` : ''}</div>`);
    ui.sel.querySelector('[data-up]')?.addEventListener('click', () => api.send({ type: 'upgrade', id: t.id }));
    ui.sel.querySelector('[data-sell]')?.addEventListener('click', () => { api.send({ type: 'sell', id: t.id }); selTower = null; });
    ui.sel.querySelectorAll('[data-tg]').forEach(b => { b.onclick = () => api.send({ type: 'target', id: t.id, mode: b.dataset.tg }); });
  }
  if (banner.t > 0) { banner.t -= 1 / 60; set('banner', banner.html); } else set('banner', '');
}

export default {
  mount(r, a) {
    api = a; ST = a.static; endShown = false; buildSel = null; selTower = null;
    sh = shell(r, api, { title: 'Tower Defense', icon: '🏰', overlay: true });
    stage = new Stage(sh.main, { bg: '#0f1a0d' });
    parts = new Particles(); floats = new Floaters(); eint = new Interp(60);
    renderBg();
    ui.hud = hud(sh.main, `<div class="tl"></div><div class="td-team"></div><div class="td-build"></div><div class="td-sel gk-panel" style="display:none"></div><div class="td-banner"></div>`);
    ui.hud.classList.add('td-hud');
    const q = s => ui.hud.querySelector(s);
    Object.assign(ui, { tl: q('.tl'), team: q('.td-team'), build: q('.td-build'), sel: q('.td-sel'), banner: q('.td-banner') });
    ui.hud.addEventListener('click', e => {
      if (e.target.closest('[data-go]')) api.send({ type: 'go' });
      if (e.target.closest('[data-speed]')) api.send({ type: 'speed' });
      const tb = e.target.closest('[data-t]'); if (tb) { buildSel = buildSel === tb.dataset.t ? null : tb.dataset.t; selTower = null; sfx.play('click'); }
    });
    const cv = stage.canvas;
    cv.addEventListener('mousemove', e => { const rc = cv.getBoundingClientRect(); mouse = { x: e.clientX - rc.left, y: e.clientY - rc.top, in: true }; });
    cv.addEventListener('mouseleave', () => { mouse.in = false; });
    cv.addEventListener('contextmenu', e => { e.preventDefault(); buildSel = null; selTower = null; });
    cv.addEventListener('click', e => {
      sfx.init();
      const rc = cv.getBoundingClientRect(), w = stage.toWorld(e.clientX - rc.left, e.clientY - rc.top);
      const cx = Math.floor(w.x / ST.C), cy = Math.floor(w.y / ST.C);
      const t = S?.towers.find(x => x.cx === cx && x.cy === cy);
      if (t) { selTower = t.id; buildSel = null; return; }
      if (buildSel) { api.send({ type: 'build', tower: buildSel, cx, cy }); if (!e.shiftKey && myMoney() < ST.towers[buildSel].cost * 2) buildSel = null; return; }
      selTower = null;
    });
    window.addEventListener('keydown', ui.kd = e => {
      if (e.target.closest?.('input')) return;
      const keys = Object.keys(ST.towers), n = +e.key;
      if (n >= 1 && n <= keys.length) { buildSel = keys[n - 1]; selTower = null; }
      if (e.key === 'Escape') { buildSel = null; selTower = null; }
      if (e.code === 'Space') { e.preventDefault(); api.send({ type: 'go' }); }
      if ((e.key === 'u' || e.key === 'U') && selTower) api.send({ type: 'upgrade', id: selTower });
    });
    stop = loop(frame);
  },
  update(s) {
    S = s; eint.push(s.enemies);
    if (selTower && !s.towers.some(t => t.id === selTower)) selTower = null;
    if (s.over && !endShown) {
      endShown = true;
      endScreen(sh.main, api, { title: s.win ? '🏆 Le château est sauvé !' : `💥 Défaite à la vague ${s.wave}`, sub: `Carte ${ST.maps[s.map].name} · difficulté ${s.difficulty}`,
        rows: s.players.map(p => ({ name: p.name, color: p.color, value: `${s.towers.filter(t => t.owner === p.id).reduce((a, t) => a + t.kills, 0)} élim.`, me: p.id === api.myId })), valueLabel: 'Éliminations' });
    }
  },
  event(e) {
    const vol = 0.35;
    switch (e.type) {
      case 'fire': sfx.play(e.k === 'sniper' ? 'sniper' : e.k === 'mortier' ? 'shotgun' : e.k === 'mitrail' ? 'smg' : 'shot', vol * 0.6); if (e.a != null) parts.burst(e.x + Math.cos(e.a) * 24, e.y + Math.sin(e.a) * 24, { n: 3, color: '#fde68a', speed: 150, life: 0.08, size: 4, dir: e.a, spread: 0.6, glow: true }); break;
      case 'die': parts.burst(e.x, e.y, { n: e.t === 'boss' ? 60 : 12, color: [ST.enemies[e.t].color, '#fff'], speed: 160, life: 0.5, size: 3 }); floats.add(e.x, e.y - 10, `+${ST.enemies[e.t].reward}`, '#fde047', 12); if (Math.random() < 0.3) sfx.play('pop', 0.3); break;
      case 'boom': parts.burst(e.x, e.y, { n: 18, color: ['#fde047', '#f97316', '#78716c'], speed: e.r * 3, life: 0.5, size: 6, glow: true }); sfx.play('boom', 0.35); stage.shake(3); break;
      case 'zap': zaps.push({ pts: e.pts, t: 0.25 }); sfx.play('laser', 0.3); break;
      case 'frost': frosts.push({ x: e.x, y: e.y, r: e.r, t: 0.6 }); break;
      case 'leak': sfx.play('bad', 0.6); stage.shake(6); break;
      case 'built': sfx.play('place'); parts.burst(e.x, e.y, { n: 14, color: '#d6d3d1', speed: 120, life: 0.4, size: 4 }); break;
      case 'upgraded': sfx.play('level'); parts.burst(e.x, e.y, { n: 20, color: '#facc15', speed: 140, life: 0.6, size: 3, glow: true }); break;
      case 'sold': sfx.play('coin'); break;
      case 'wave': banner = { t: 2.5, html: e.boss ? `👑 Vague ${e.n} — BOSS !` : `🌊 Vague ${e.n}` }; sfx.play(e.boss ? 'bad' : 'countdown'); break;
      case 'waveDone': banner = { t: 2.5, html: `✔ Vague ${e.n} terminée · +${e.bonus} $` }; sfx.play('good'); break;
      case 'gift': api.toast(`🎁 ${e.from} vous donne ${e.n} $`); break;
    }
  },
  unmount() { stop?.(); stage?.destroy(); window.removeEventListener('keydown', ui.kd); S = null; ui = {}; },
};
