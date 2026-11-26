// =====================================================================
//  DRAW & GUESS — affichage (navigateur)
// =====================================================================
import { shell, endScreen, sfx, esc, css, avatar } from '../lib/kit.js';

const PALETTE = ['#111827', '#ffffff', '#9ca3af', '#ef4444', '#f97316', '#facc15', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#92400e', '#fecaca', '#bbf7d0', '#bfdbfe', '#fde68a'];
const SIZES = [3, 7, 14, 28];
const W = 1000, H = 750;

css('draw-css', `
.dg { position:absolute; inset:0; display:grid; grid-template-columns: 220px 1fr 320px; gap:12px; padding:12px; background: radial-gradient(circle at 50% 0%, #4a1942, #0f0a1a 65%); }
.dg-col { background:rgba(10,8,20,.7); border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:12px; display:flex; flex-direction:column; gap:8px; min-height:0; }
.dg-col h4 { margin:0; font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#f9a8d4; }
.dg-pl { display:flex; align-items:center; gap:8px; padding:8px; border-radius:10px; background:rgba(255,255,255,.04); }
.dg-pl.drawing { background:rgba(236,72,153,.2); } .dg-pl.found { background:rgba(34,197,94,.18); }
.dg-pl .nm { flex:1; min-width:0; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dg-pl .sc { font-weight:800; } .dg-pl .g { color:#4ade80; font-size:12px; font-weight:700; }
.dg-center { display:flex; flex-direction:column; gap:10px; min-height:0; min-width:0; }
.dg-word { display:flex; align-items:center; justify-content:center; gap:14px; background:rgba(10,8,20,.7); border-radius:14px; padding:10px; min-height:58px; }
.dg-word .w { font-family:'Space Grotesk',monospace; font-size:26px; font-weight:700; letter-spacing:.12em; }
.dg-word .t { font-family:'Space Grotesk',monospace; font-size:20px; font-weight:700; background:#ec4899; padding:4px 12px; border-radius:999px; min-width:70px; text-align:center; }
.dg-word .t.low { background:#dc2626; animation: dgp .6s infinite; } @keyframes dgp { 50% { transform:scale(1.1); } }
.dg-canvaswrap { flex:1; min-height:0; display:grid; place-items:center; position:relative; }
.dg-canvas { background:#fff; border-radius:14px; box-shadow:0 20px 50px #000a; max-width:100%; max-height:100%; aspect-ratio: 4/3; touch-action:none; cursor:crosshair; }
.dg-tools { display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:center; background:rgba(10,8,20,.7); border-radius:14px; padding:8px; }
.dg-pal { display:grid; grid-template-columns:repeat(8, 24px); gap:4px; }
.dg-pal button { width:24px; height:24px; border-radius:6px; border:2px solid rgba(255,255,255,.2); cursor:pointer; }
.dg-pal button.on { border-color:#fff; transform:scale(1.15); box-shadow:0 0 0 2px #ec4899; }
.dg-sz button { width:36px; height:36px; border-radius:10px; border:0; background:rgba(255,255,255,.08); cursor:pointer; display:inline-grid; place-items:center; }
.dg-sz button.on { background:#ec4899; } .dg-sz i { background:#fff; border-radius:50%; display:block; }
.dg-tool { border:0; border-radius:10px; padding:8px 12px; background:rgba(255,255,255,.08); color:#fff; font-weight:600; cursor:pointer; }
.dg-tool.on { background:#ec4899; }
.dg-overlay { position:absolute; inset:0; display:grid; place-items:center; background:rgba(15,10,26,.82); border-radius:14px; text-align:center; z-index:3; }
.dg-overlay h2 { margin:0 0 14px; } .dg-choices { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
.dg-choices button { font-size:20px; padding:14px 22px; border-radius:14px; border:0; background:linear-gradient(135deg,#ec4899,#8b5cf6); color:#fff; font-weight:800; cursor:pointer; transition: transform .1s; }
.dg-choices button:hover { transform:scale(1.06); }
.dg-msgs { flex:1; overflow:auto; display:flex; flex-direction:column; gap:4px; font-size:14px; }
.dg-msgs .sys { color:#a5b4fc; font-style:italic; } .dg-msgs .ok { color:#4ade80; font-weight:700; } .dg-msgs .reveal { color:#facc15; font-weight:700; }
.dg-msgs .round { text-align:center; color:#f9a8d4; font-weight:700; margin:6px 0; } .dg-msgs .secret { color:#86efac; }
.dg-guess { display:flex; gap:6px; } .dg-guess input { padding:10px 12px; }
@media (max-width:1000px) { .dg { grid-template-columns:1fr; grid-template-rows:auto 1fr auto; overflow:auto; } .dg-col.players { display:none; } .dg-col.chat { min-height:260px; } .dg-center { min-height:70vh; } }
`);

let api, S, sh, ui = {}, g, endShown = false, tool = 'pen', color = '#111827', size = 7, drawing = null, last = new Map(), lastMsg = 0, sendTimer, synced = false;

// --- dessin sur le canvas ---
function seg(st, from) {
  g.strokeStyle = st.c; g.fillStyle = st.c; g.lineWidth = st.w; g.lineCap = 'round'; g.lineJoin = 'round';
  const p = st.p;
  if (st.fill) return flood(p[0], p[1], st.c);
  if (p.length === 2 && from == null) { g.beginPath(); g.arc(p[0], p[1], st.w / 2, 0, 7); g.fill(); return; }
  g.beginPath();
  if (from) g.moveTo(from[0], from[1]); else g.moveTo(p[0], p[1]);
  for (let i = from ? 0 : 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
  g.stroke();
}
function addStroke(st) { const prev = st.id != null ? last.get(st.id) : null; seg(st, prev); const n = st.p.length; if (st.id != null && n >= 2) last.set(st.id, [st.p[n - 2], st.p[n - 1]]); }
function redraw(strokes) { g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); last.clear(); for (const st of strokes) { seg(st, null); } }
function flood(x, y, hex) {
  x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return;
  const img = g.getImageData(0, 0, W, H), d = img.data;
  const c = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const i0 = (y * W + x) * 4, t = [d[i0], d[i0 + 1], d[i0 + 2]];
  if (Math.abs(t[0] - c[0]) + Math.abs(t[1] - c[1]) + Math.abs(t[2] - c[2]) < 10) return;
  const same = i => Math.abs(d[i] - t[0]) + Math.abs(d[i + 1] - t[1]) + Math.abs(d[i + 2] - t[2]) < 90;
  const stack = [x, y];
  while (stack.length) {
    const yy = stack.pop(), xx0 = stack.pop();
    let xx = xx0; while (xx >= 0 && same((yy * W + xx) * 4)) xx--;
    xx++; let up = false, dn = false;
    while (xx < W && same((yy * W + xx) * 4)) {
      const i = (yy * W + xx) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      if (yy > 0) { const s2 = same(((yy - 1) * W + xx) * 4); if (s2 && !up) { stack.push(xx, yy - 1); up = true; } else if (!s2) up = false; }
      if (yy < H - 1) { const s2 = same(((yy + 1) * W + xx) * 4); if (s2 && !dn) { stack.push(xx, yy + 1); dn = true; } else if (!s2) dn = false; }
      xx++;
    }
  }
  g.putImageData(img, 0, 0);
}

const isDrawer = () => S?.drawer === api.myId && S?.phase === 'draw';
function canvasPt(e) { const r = ui.canvas.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * W), Math.round((e.clientY - r.top) / r.height * H)]; }
function flush() {
  if (!drawing || drawing.buf.length === 0) return;
  api.send({ type: 'stroke', id: drawing.id, c: drawing.c, w: drawing.w, p: drawing.buf });
  drawing.buf = [];
}
function bindCanvas() {
  ui.canvas.addEventListener('pointerdown', e => {
    if (!isDrawer()) return;
    sfx.init();
    const p = canvasPt(e);
    if (tool === 'fill') { const st = { c: color, w: 1, p, fill: true }; addStroke(st); api.send({ type: 'stroke', ...st }); return; }
    ui.canvas.setPointerCapture(e.pointerId);
    drawing = { id: Math.random().toString(36).slice(2, 9), c: tool === 'eraser' ? '#ffffff' : color, w: tool === 'eraser' ? size * 2 : size, buf: [...p] };
    addStroke({ id: drawing.id, c: drawing.c, w: drawing.w, p });
    clearInterval(sendTimer); sendTimer = setInterval(flush, 60);
  });
  ui.canvas.addEventListener('pointermove', e => {
    if (!drawing) return;
    const p = canvasPt(e), lp = last.get(drawing.id);
    if (lp && Math.hypot(p[0] - lp[0], p[1] - lp[1]) < 2) return;
    addStroke({ id: drawing.id, c: drawing.c, w: drawing.w, p });
    drawing.buf.push(...p);
  });
  const end = () => { if (!drawing) return; flush(); clearInterval(sendTimer); drawing = null; };
  ui.canvas.addEventListener('pointerup', end); ui.canvas.addEventListener('pointercancel', end);
}

function renderTools() {
  ui.tools.innerHTML = `<div class="dg-pal">${PALETTE.map(c => `<button data-c="${c}" style="background:${c}" class="${c === color && tool !== 'eraser' ? 'on' : ''}"></button>`).join('')}</div>
    <div class="dg-sz">${SIZES.map(s => `<button data-s="${s}" class="${s === size ? 'on' : ''}"><i style="width:${Math.min(26, s)}px;height:${Math.min(26, s)}px"></i></button>`).join(' ')}</div>
    <button class="dg-tool ${tool === 'pen' ? 'on' : ''}" data-t="pen">✏️ Crayon</button><button class="dg-tool ${tool === 'fill' ? 'on' : ''}" data-t="fill">🪣 Remplir</button>
    <button class="dg-tool ${tool === 'eraser' ? 'on' : ''}" data-t="eraser">🧽 Gomme</button><button class="dg-tool" data-a="undo">↶ Annuler</button><button class="dg-tool" data-a="clear">🗑️ Effacer</button>`;
  ui.tools.querySelectorAll('[data-c]').forEach(b => { b.onclick = () => { color = b.dataset.c; if (tool === 'eraser') tool = 'pen'; renderTools(); }; });
  ui.tools.querySelectorAll('[data-s]').forEach(b => { b.onclick = () => { size = +b.dataset.s; renderTools(); }; });
  ui.tools.querySelectorAll('[data-t]').forEach(b => { b.onclick = () => { tool = b.dataset.t; renderTools(); }; });
  ui.tools.querySelectorAll('[data-a]').forEach(b => { b.onclick = () => { if (b.dataset.a === 'clear' && !confirm('Tout effacer ?')) return; api.send({ type: b.dataset.a }); }; });
}

function render() {
  const drawer = S.players.find(p => p.id === S.drawer);
  sh.bar.textContent = `Manche ${S.round} / ${S.rounds}`;
  ui.players.innerHTML = S.players.slice().sort((a, b) => b.score - a.score).map((p, i) => `
    <div class="dg-pl ${p.id === S.drawer ? 'drawing' : ''} ${p.found ? 'found' : ''}"><b>#${i + 1}</b>${avatar(p.name, p.color, 28)}<span class="nm">${esc(p.name)}${p.id === api.myId ? ' (vous)' : ''}</span>
    ${p.id === S.drawer ? '✏️' : p.found ? '✅' : ''}${p.gained && (S.phase === 'reveal' || p.found) ? `<span class="g">+${p.gained}</span>` : ''}<span class="sc">${p.score}</span></div>`).join('');
  // mot / indice
  const t = Math.ceil(S.left / 1000);
  let word = '';
  if (S.phase === 'draw') word = S.word ? `<span class="w">${esc(S.word)}</span>` : `<span class="w">${esc(S.hint)}</span><small class="gk-muted">${S.wordLen} lettres</small>`;
  else if (S.phase === 'choose') word = `<span>${drawer?.id === api.myId ? 'Choisissez un mot…' : `${esc(drawer?.name || '')} choisit un mot…`}</span>`;
  else if (S.phase === 'reveal') word = `<span>Le mot était <b style="color:#facc15">${esc(S.lastWord)}</b></span>`;
  ui.word.innerHTML = `${word}${S.phase !== 'over' ? `<span class="t ${S.phase === 'draw' && t <= 10 ? 'low' : ''}">${t}</span>` : ''}`;
  ui.tools.style.display = isDrawer() ? '' : 'none';
  ui.canvas.style.cursor = isDrawer() ? (tool === 'fill' ? 'cell' : 'crosshair') : 'default';
  // superposition
  let ov = '';
  if (S.phase === 'choose' && S.choices) ov = `<div><h2>Choisissez le mot à dessiner</h2><div class="dg-choices">${S.choices.map(w => `<button data-w="${esc(w)}">${esc(w)}</button>`).join('')}</div></div>`;
  else if (S.phase === 'choose') ov = `<div><h2>${avatar(drawer?.name, drawer?.color, 40)}</h2><h2>${esc(drawer?.name || '')} choisit un mot…</h2></div>`;
  else if (S.phase === 'reveal') ov = `<div><h2>Le mot était</h2><h1 style="font-size:46px;color:#facc15;margin:0">${esc(S.lastWord)}</h1></div>`;
  if (ui.ov.dataset.k !== ov) { ui.ov.dataset.k = ov; ui.ov.innerHTML = ov; ui.ov.style.display = ov ? '' : 'none'; ui.ov.querySelectorAll('[data-w]').forEach(b => { b.onclick = () => api.send({ type: 'choose', word: b.dataset.w }); }); }
  // messages
  const lastN = S.msgs.length ? S.msgs[S.msgs.length - 1].n : 0;
  if (lastN !== lastMsg) {
    lastMsg = lastN;
    ui.msgs.innerHTML = S.msgs.map(m => m.kind === 'chat' || m.kind === 'secret' ? `<div class="${m.kind}"><b style="color:${m.color}">${esc(m.name)}</b> ${esc(m.text)}</div>` : `<div class="${m.kind}">${esc(m.text)}</div>`).join('');
    ui.msgs.scrollTop = ui.msgs.scrollHeight;
  }
  const me = S.players.find(p => p.id === api.myId);
  ui.input.placeholder = isDrawer() ? 'Discutez avec ceux qui ont trouvé…' : me?.found ? 'Bravo ! Discutez avec ceux qui ont trouvé…' : S.phase === 'draw' ? 'Tapez votre proposition…' : 'Message…';
  if (S.phase === 'over' && !endShown) {
    endShown = true;
    const rows = S.players.slice().sort((a, b) => b.score - a.score).map(p => ({ name: p.name, color: p.color, value: `${p.score} pts`, me: p.id === api.myId }));
    endScreen(sh.main, api, { title: `🎨 ${esc(rows[0]?.name)} gagne !`, sub: 'Quel talent artistique…', rows, valueLabel: 'Points' });
  }
}

export default {
  mount(r, a) {
    api = a; endShown = false; lastMsg = 0; synced = false; last.clear();
    sh = shell(r, api, { title: 'Draw & Guess', icon: '🎨' });
    const el = document.createElement('div'); el.className = 'dg';
    el.innerHTML = `<div class="dg-col players"><h4>Joueurs</h4><div class="dg-players" style="display:flex;flex-direction:column;gap:6px;overflow:auto"></div></div>
      <div class="dg-center"><div class="dg-word"></div><div class="dg-canvaswrap"><canvas class="dg-canvas" width="${W}" height="${H}"></canvas><div class="dg-overlay" style="display:none"></div></div><div class="dg-tools"></div></div>
      <div class="dg-col chat"><h4>Propositions</h4><div class="dg-msgs"></div><form class="dg-guess"><input maxlength="80" autocomplete="off"><button class="gk-btn primary">➤</button></form></div>`;
    sh.main.appendChild(el);
    const q = s => el.querySelector(s);
    ui = { players: q('.dg-players'), word: q('.dg-word'), canvas: q('.dg-canvas'), ov: q('.dg-overlay'), tools: q('.dg-tools'), msgs: q('.dg-msgs'), input: q('.dg-guess input') };
    // la zone de dessin garde ses proportions dans l'espace disponible
    const wrap = q('.dg-canvaswrap');
    ui.ro = new ResizeObserver(() => { const r2 = wrap.getBoundingClientRect(); const k = Math.min(r2.width / W, r2.height / H); ui.canvas.style.width = `${W * k}px`; ui.canvas.style.height = `${H * k}px`; });
    ui.ro.observe(wrap);
    g = ui.canvas.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    q('.dg-guess').onsubmit = e => { e.preventDefault(); if (ui.input.value.trim()) api.send({ type: 'guess', text: ui.input.value }); ui.input.value = ''; };
    renderTools(); bindCanvas();
  },
  update(s) {
    const prev = S; S = s;
    if (s.strokes) { redraw(s.strokes); synced = true; }
    if (prev && prev.drawer !== s.drawer) { redraw([]); sfx.play('tick'); }
    if (prev && prev.phase !== s.phase && s.phase === 'reveal') sfx.play('good');
    render();
  },
  event(e) {
    if (e.type === 'stroke' && !(isDrawer())) addStroke(e.s);
    if (e.type === 'clear') redraw([]);
    if (e.type === 'redraw') redraw(e.strokes);
    if (e.type === 'found') sfx.play(e.id === api.myId ? 'win' : 'coin');
    if (e.type === 'close') api.toast(`« ${e.text} » : vous y êtes presque !`);
  },
  unmount() { ui.ro?.disconnect(); clearInterval(sendTimer); S = null; },
};
