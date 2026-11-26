// =====================================================================
//  ZOMBIE SURVIVAL — affichage (navigateur)
//  Ville en ruine pré-rendue, éclairage jour/nuit avec lampes torches,
//  sang persistant, particules, interface complète et boutique.
// =====================================================================
import { shell, endScreen, sfx, esc, css, Stage, Input, InputSender, Interp, Particles, Floaters, loop, D, hud, clamp } from '../lib/kit.js';

const ZCOL = { normal: ['#6b8f4e', '#3f5a2c'], rapide: ['#9fb84a', '#5d7024'], rampant: ['#7d6b4f', '#4a3d2a'], brute: ['#4e6b3a', '#2a3b1f'], cracheur: ['#5fae6b', '#2f6b3a'], kamikaze: ['#c2410c', '#7c2d12'], blinde: ['#64748b', '#334155'], invocateur: ['#7e22ce', '#3b0764'], boss: ['#7f1d1d', '#450a0a'] };
const DROP = { soin: ['❤️', '#ef4444'], munitions: ['📦', '#eab308'], rage: ['😡', '#f97316'], bombe: ['☢️', '#22c55e'], argent: ['💰', '#facc15'] };
const BCOL = ['#475569', '#57534e', '#52525b', '#4b5563', '#5b4a3a', '#3f4f5f'];
const CARCOL = ['#b91c1c', '#1d4ed8', '#e5e7eb', '#111827', '#15803d', '#a16207', '#6b21a8'];
const WICON = { pistolet: '🔫', smg: '🔫', pompe: '💥', fusil: '🎯', sniper: '🔭', lanceflammes: '🔥', lancegrenades: '💣', laser: '⚡', minigun: '⚙️' };

css('zs-css', `
.zs-hud .tl { position:absolute; left:14px; top:62px; } .zs-hud .tr { position:absolute; right:14px; top:62px; display:flex; flex-direction:column; gap:6px; align-items:flex-end; }
.zs-hud .bl { position:absolute; left:14px; bottom:14px; width:270px; } .zs-hud .br { position:absolute; right:14px; bottom:14px; text-align:right; }
.zs-wave { font-family:'Space Grotesk'; font-size:26px; font-weight:700; } .zs-sub { color:#cbd5e1; font-size:14px; }
.zs-bars .bar { height:14px; border-radius:7px; background:rgba(0,0,0,.6); overflow:hidden; margin-top:6px; border:1px solid rgba(255,255,255,.15); position:relative; }
.zs-bars .bar b { display:block; height:100%; transition:width .2s; } .zs-bars .bar span { position:absolute; inset:0; font-size:10px; font-weight:800; display:grid; place-items:center; text-shadow:0 1px 2px #000; }
.zs-money { font-size:24px; font-weight:800; color:#fde047; margin-bottom:4px; text-shadow:0 2px 6px #000; }
.zs-inv { display:flex; gap:10px; font-size:14px; font-weight:700; margin-top:6px; }
.zs-ammo { font-family:'Space Grotesk'; font-size:42px; font-weight:700; line-height:1; text-shadow:0 2px 8px #000; } .zs-ammo small { font-size:18px; opacity:.6; }
.zs-wname { font-weight:700; font-size:15px; color:#e2e8f0; }
.zs-slots { display:flex; gap:4px; justify-content:flex-end; margin-top:8px; flex-wrap:wrap; max-width:360px; }
.zs-slots span { background:rgba(0,0,0,.6); border:1px solid rgba(255,255,255,.15); border-radius:8px; padding:3px 7px; font-size:12px; font-weight:700; }
.zs-slots span.on { border-color:#fde047; box-shadow:0 0 10px #fde04788; }
.zs-team { background:rgba(0,0,0,.55); border-radius:10px; padding:5px 10px; font-size:13px; display:flex; gap:8px; align-items:center; min-width:180px; }
.zs-team .hp { flex:1; height:6px; border-radius:3px; background:rgba(255,255,255,.15); overflow:hidden; } .zs-team .hp b { display:block; height:100%; background:#22c55e; }
.zs-center { position:absolute; left:50%; top:22%; transform:translateX(-50%); text-align:center; pointer-events:none; }
.zs-center .big { font-family:'Space Grotesk'; font-size:54px; font-weight:700; text-shadow:0 4px 20px #000; animation: zsin .5s; }
@keyframes zsin { from { transform:scale(1.6); opacity:0; } }
.zs-boss { position:absolute; left:50%; top:62px; transform:translateX(-50%); width:min(520px,70vw); text-align:center; font-weight:800; color:#fecaca; text-shadow:0 2px 4px #000; }
.zs-boss .bar { height:14px; border-radius:7px; background:rgba(0,0,0,.6); overflow:hidden; border:1px solid #7f1d1d; margin-top:4px; } .zs-boss .bar b { display:block; height:100%; background:linear-gradient(90deg,#991b1b,#ef4444); transition:width .2s; }
.zs-shop { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:min(860px,94vw); max-height:84vh; overflow:auto; background:rgba(12,14,20,.96); border:1px solid #3f3f46; border-radius:20px; padding:18px; pointer-events:auto; box-shadow:0 30px 80px #000c; }
.zs-shop h2 { margin:0; display:flex; justify-content:space-between; align-items:center; }
.zs-shop .tabs { display:flex; gap:6px; margin:12px 0; }
.zs-shop .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:10px; }
.zs-item { border:1px solid #3f3f46; background:#18181b; border-radius:14px; padding:12px; text-align:left; color:#fff; cursor:pointer; display:flex; flex-direction:column; gap:4px; transition: border-color .15s, transform .1s; font:inherit; }
.zs-item:hover { border-color:#fde047; transform:translateY(-2px); } .zs-item.no { opacity:.45; } .zs-item.own { border-color:#16a34a; }
.zs-item .ic { font-size:26px; } .zs-item b { font-size:15px; } .zs-item small { color:#a1a1aa; font-size:12px; } .zs-item .pr { color:#fde047; font-weight:800; margin-top:auto; }
.zs-stats { font-size:11px; color:#a1a1aa; }
.zs-keys { position:absolute; left:50%; bottom:14px; transform:translateX(-50%); font-size:12px; color:#cbd5e1; background:rgba(0,0,0,.5); padding:6px 12px; border-radius:999px; white-space:nowrap; }
.zs-mini { position:absolute; right:14px; bottom:120px; border-radius:10px; border:1px solid rgba(255,255,255,.2); background:rgba(0,0,0,.5); }
.zs-ready { pointer-events:auto; margin-top:10px; }
.zs-vig { position:absolute; inset:0; pointer-events:none; background:radial-gradient(ellipse at center, transparent 50%, rgba(200,0,0,.55)); opacity:0; transition:opacity .3s; }
@media (max-width:700px) { .zs-keys, .zs-mini { display:none; } .zs-hud .bl { width:200px; } .zs-ammo { font-size:30px; } }
`);

let api, ST, S, sh, stage, input, sender, stop, parts, floats, zint, pint, ui = {}, ground, decals, dctx, endShown = false, shopOpen = false, shopTab = 'armes', lastWave = 0, me, msgT = 0, msgHTML = '';

// ---------------- Pré-rendu de la ville ----------------
function noiseFill(g, x, y, w, h, base, amount, n) {
  g.fillStyle = base; g.fillRect(x, y, w, h);
  for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * amount})`; g.fillRect(x + Math.random() * w, y + Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3); }
}
function renderGround() {
  const { W, H, map } = ST;
  ground = document.createElement('canvas'); ground.width = W; ground.height = H;
  const g = ground.getContext('2d');
  noiseFill(g, 0, 0, W, H, '#2b2d31', 0.12, 60000);
  // trottoirs autour des pâtés
  for (let x = 0; x < W; x += 420) for (let y = 0; y < H; y += 380) { g.fillStyle = '#4a4b50'; g.fillRect(x + 50, y + 50, 320, 280); g.fillStyle = '#3a3b40'; g.fillRect(x + 62, y + 62, 296, 256); }
  // marquages de rue
  g.strokeStyle = 'rgba(250,204,21,.55)'; g.lineWidth = 4; g.setLineDash([26, 22]);
  for (let x = 0; x <= W; x += 420) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y <= H; y += 380) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.setLineDash([]);
  // passages piétons
  g.fillStyle = 'rgba(255,255,255,.35)';
  for (let x = 420; x < W; x += 420) for (let y = 380; y < H; y += 380) for (let k = -3; k <= 3; k++) { g.fillRect(x - 70 + 4, y + k * 10 - 3, 16, 6); g.fillRect(x + k * 10 - 3, y - 70 + 4, 6, 16); }
  for (const d of map.decor) {
    if (d.kind === 'park') { noiseFill(g, d.x, d.y, d.w, d.h, '#2f4a24', 0.15, 3000); g.strokeStyle = '#6b5b3e'; g.lineWidth = 10; g.beginPath(); g.moveTo(d.x, d.y + d.h / 2); g.quadraticCurveTo(d.x + d.w / 2, d.y, d.x + d.w, d.y + d.h / 2); g.stroke(); }
    if (d.kind === 'lot') { g.fillStyle = '#26282c'; g.fillRect(d.x, d.y, d.w, d.h); g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 2; for (let x = d.x + 10; x < d.x + d.w; x += 44) { g.beginPath(); g.moveTo(x, d.y); g.lineTo(x, d.y + 60); g.moveTo(x, d.y + d.h); g.lineTo(x, d.y + d.h - 60); g.stroke(); } }
    if (d.kind === 'crack') { g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2; g.beginPath(); let x = d.x, y = d.y; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += Math.cos(d.a + k) * d.r * 0.5; y += Math.sin(d.a + k * 0.7) * d.r * 0.5; g.lineTo(x, y); } g.stroke(); }
    if (d.kind === 'puddle') { const gr = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r); gr.addColorStop(0, 'rgba(90,110,140,.5)'); gr.addColorStop(1, 'rgba(90,110,140,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(d.x, d.y, d.r * 1.4, d.r, d.a, 0, 7); g.fill(); }
    if (d.kind === 'blood') { g.fillStyle = 'rgba(90,10,10,.55)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(d.x + Math.cos(k * 1.3) * d.r * 0.5, d.y + Math.sin(k * 2.1) * d.r * 0.4, d.r * (0.2 + Math.random() * 0.3), 0, 7); g.fill(); } }
    if (d.kind === 'trash') { g.fillStyle = ['#78716c', '#a8a29e', '#57534e'][Math.floor(Math.random() * 3)]; for (let k = 0; k < 5; k++) g.fillRect(d.x + Math.random() * 30, d.y + Math.random() * 20, 6, 4); }
  }
  // obstacles (avec ombres portées)
  for (const o of map.obs) {
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(o.x + 10, o.y + 12, o.w, o.h);
    if (o.kind === 'building') {
      const c = BCOL[o.hue];
      noiseFill(g, o.x, o.y, o.w, o.h, c, 0.15, o.w * o.h / 60);
      g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 6; g.strokeRect(o.x + 3, o.y + 3, o.w - 6, o.h - 6);
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 2; g.strokeRect(o.x + 10, o.y + 10, o.w - 20, o.h - 20);
      // climatiseurs, trappes
      for (let k = 0; k < Math.floor(o.w * o.h / 9000); k++) { const ax = o.x + 20 + Math.random() * (o.w - 60), ay = o.y + 20 + Math.random() * (o.h - 50); g.fillStyle = '#9ca3af'; g.fillRect(ax, ay, 26, 20); g.fillStyle = '#6b7280'; g.beginPath(); g.arc(ax + 13, ay + 10, 7, 0, 7); g.fill(); }
      if (Math.random() < 0.5) { g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(o.x + o.w * Math.random(), o.y + o.h * Math.random(), 18 + Math.random() * 20, 0, 7); g.fill(); } // trou / brûlure
    } else if (o.kind === 'car') {
      const c = CARCOL[o.hue], horiz = o.w > o.h;
      g.save(); g.translate(o.x + o.w / 2, o.y + o.h / 2); if (!horiz) g.rotate(Math.PI / 2);
      const L = Math.max(o.w, o.h), Wd = Math.min(o.w, o.h);
      D.rrect(g, -L / 2, -Wd / 2, L, Wd, 10, c); D.rrect(g, -L / 2 + 4, -Wd / 2 + 4, L - 8, Wd - 8, 8, null, 'rgba(0,0,0,.3)', 2);
      D.rrect(g, -L * 0.18, -Wd / 2 + 5, L * 0.42, Wd - 10, 6, 'rgba(15,23,42,.85)');
      D.rrect(g, -L * 0.12, -Wd / 2 + 8, L * 0.28, Wd - 16, 4, c);
      g.fillStyle = '#fef9c3'; g.fillRect(L / 2 - 5, -Wd / 2 + 5, 4, 8); g.fillRect(L / 2 - 5, Wd / 2 - 13, 4, 8);
      if (Math.random() < 0.5) { g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.arc(-L * 0.3, 0, 12, 0, 7); g.fill(); }
      g.restore();
    } else if (o.kind === 'crate') {
      D.rrect(g, o.x, o.y, o.w, o.h, 3, '#92400e'); g.strokeStyle = '#78350f'; g.lineWidth = 3; g.strokeRect(o.x + 3, o.y + 3, o.w - 6, o.h - 6); g.beginPath(); g.moveTo(o.x + 3, o.y + 3); g.lineTo(o.x + o.w - 3, o.y + o.h - 3); g.stroke();
    } else if (o.kind === 'tree') {
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(cx + 10, cy + 12, 34, 0, 7); g.fill();
      for (const [r, c] of [[34, '#14532d'], [28, '#166534'], [18, '#15803d']]) { g.fillStyle = c; g.beginPath(); g.arc(cx - (34 - r) * 0.3, cy - (34 - r) * 0.3, r, 0, 7); g.fill(); }
    }
  }
  for (const d of map.decor) if (d.kind === 'lamp') { g.fillStyle = '#1f2937'; g.beginPath(); g.arc(d.x, d.y, 7, 0, 7); g.fill(); g.fillStyle = '#fef3c7'; g.beginPath(); g.arc(d.x, d.y, 3, 0, 7); g.fill(); }
  decals = document.createElement('canvas'); decals.width = W / 2; decals.height = H / 2; dctx = decals.getContext('2d');
}
function splat(x, y, r, color = 'rgba(110,10,10,.7)', n = 6) {
  dctx.fillStyle = color;
  for (let k = 0; k < n; k++) { const a = Math.random() * 6.28, d = Math.random() * r; dctx.beginPath(); dctx.arc((x + Math.cos(a) * d) / 2, (y + Math.sin(a) * d) / 2, (2 + Math.random() * r * 0.35) / 2, 0, 7); dctx.fill(); }
}

// ---------------- Personnages ----------------
function drawPlayer(g, p, t) {
  if (!p.alive) return;
  D.shadow(g, p.x + 4, p.y + 6, 18, 12);
  g.save(); g.translate(p.x, p.y);
  if (p.down) { g.globalAlpha = 0.7; g.rotate(0.9); }
  g.rotate(p.a);
  // arme
  const w = p.weapon, long = { pistolet: 18, smg: 24, pompe: 30, fusil: 34, sniper: 44, lanceflammes: 32, lancegrenades: 30, laser: 36, minigun: 36 }[w] || 24;
  const wcol = { lanceflammes: '#b45309', laser: '#0891b2', lancegrenades: '#4d7c0f', minigun: '#52525b' }[w] || '#1f2937';
  D.rrect(g, 6, -4, long, 8, 3, wcol, '#000', 1);
  if (w === 'minigun') { D.rrect(g, long - 4, -6, 10, 12, 3, '#3f3f46'); }
  if (w === 'laser') { g.fillStyle = '#67e8f9'; g.fillRect(10, -1.5, long - 8, 3); }
  // corps : épaules + tête
  D.rrect(g, -12, -15, 20, 30, 10, p.color, 'rgba(0,0,0,.5)', 2);
  D.circle(g, 14, 9, 5, '#e2b08a', '#0006', 1); // main
  D.circle(g, -1, 0, 9.5, '#e2b08a', 'rgba(0,0,0,.4)', 1.5);
  D.circle(g, -3, 0, 8, '#3f2a1d'); // cheveux
  g.restore();
  if (p.rage) D.circle(g, p.x, p.y, 24, null, `rgba(249,115,22,${0.5 + Math.sin(t * 10) * 0.3})`, 3);
  D.text(g, p.name, p.x, p.y - 32, { size: 12, color: p.id === api.myId ? '#fde047' : '#fff' });
  if (!p.down) D.bar(g, p.x - 20, p.y - 25, 40, 5, p.hp / p.maxHp, p.hp / p.maxHp > 0.4 ? '#22c55e' : '#ef4444');
  else {
    D.text(g, `🆘 ${p.downT}s`, p.x, p.y + 32, { size: 13, color: '#fca5a5' });
    if (p.revive > 0) { g.strokeStyle = '#4ade80'; g.lineWidth = 4; g.beginPath(); g.arc(p.x, p.y, 26, -Math.PI / 2, -Math.PI / 2 + p.revive / 3 * Math.PI * 2); g.stroke(); }
  }
}
function drawZombie(g, z, t) {
  const [id, x, y, type, hp, a, burn, charge] = z;
  const r = ST.zr[type], [c1, c2] = ZCOL[type];
  const wob = Math.sin(t * 7 + id) * 0.18;
  D.shadow(g, x + 4, y + 6, r * 1.1, r * 0.7);
  g.save(); g.translate(x, y); g.rotate(a + wob * 0.4);
  if (type === 'rampant') {
    g.fillStyle = c2; g.beginPath(); g.ellipse(-2, 0, r * 1.2, r * 0.8, 0, 0, 7); g.fill();
    for (const s of [-1, 1]) { g.strokeStyle = c1; g.lineWidth = 4; g.beginPath(); g.moveTo(0, s * 5); g.lineTo(r + 4, s * (r + Math.sin(t * 12 + id) * 4)); g.stroke(); }
    D.circle(g, r * 0.7, 0, r * 0.6, c1);
  } else {
    // bras tendus
    const arm = r * (type === 'brute' || type === 'boss' ? 1.1 : 1.3);
    for (const s of [-1, 1]) { g.strokeStyle = c2; g.lineWidth = r * 0.42; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, s * r * 0.6); g.lineTo(arm + Math.sin(t * 9 + id + s) * 3, s * r * 0.45); g.stroke(); D.circle(g, arm + Math.sin(t * 9 + id + s) * 3, s * r * 0.45, r * 0.24, c1); }
    D.rrect(g, -r * 0.75, -r, r * 1.3, r * 2, r * 0.6, c2, 'rgba(0,0,0,.45)', 2);
    D.circle(g, r * 0.1, 0, r * 0.62, c1, 'rgba(0,0,0,.4)', 1.5);
    if (type === 'blinde') { g.fillStyle = '#94a3b8'; g.fillRect(-r * 0.6, -r * 0.9, r * 0.5, r * 1.8); g.strokeStyle = '#1e293b'; g.lineWidth = 2; g.strokeRect(-r * 0.6, -r * 0.9, r * 0.5, r * 1.8); }
    if (type === 'kamikaze') { g.fillStyle = '#fbbf24'; g.fillRect(-r * 0.7, -r * 0.5, r * 0.5, r); D.circle(g, -r * 0.45, 0, 3, Math.sin(t * 20) > 0 ? '#ef4444' : '#7f1d1d'); }
    if (type === 'invocateur') { g.strokeStyle = `rgba(192,132,252,${0.5 + Math.sin(t * 5) * 0.3})`; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r * 1.5, 0, 7); g.stroke(); }
    if (type === 'cracheur') D.circle(g, r * 0.55, 0, r * 0.28, '#a3e635');
    if (type === 'boss') { for (const s of [-1, 1]) { g.fillStyle = '#e5e7eb'; g.beginPath(); g.moveTo(r * 0.2, s * r * 0.4); g.lineTo(r * 0.5, s * r * 0.95); g.lineTo(r * 0.45, s * r * 0.35); g.fill(); } }
  }
  // yeux
  for (const s of [-1, 1]) D.circle(g, r * 0.45, s * r * 0.22, Math.max(1.6, r * 0.1), type === 'invocateur' ? '#e9d5ff' : '#ff2d2d');
  g.restore();
  if (burn) parts.burst(x + (Math.random() - 0.5) * r, y + (Math.random() - 0.5) * r, { n: 1, color: ['#f97316', '#facc15'], speed: 30, life: 0.4, size: 5, grav: -60, glow: true });
  if (charge) D.circle(g, x, y, r + 8, null, `rgba(239,68,68,${0.5 + Math.sin(t * 25) * 0.5})`, 4);
  if (hp < 100 && type !== 'boss') D.bar(g, x - r, y - r - 10, r * 2, 4, hp / 100, '#ef4444');
}

// ---------------- Rendu principal ----------------
function frame(dt, now) {
  if (!S) return;
  const t = now / 1000;
  me = S.players.find(p => p.id === api.myId);
  const players = pint.all(), zs = zint.all().map(z => { const r = z.raw.slice(); r[1] = z.x; r[2] = z.y; r[5] = z.a; return r; });
  const meI = players.find(p => p.id === api.myId) || me;
  if (meI) stage.follow(meI.x, meI.y, dt, 6, 1);
  // entrées
  if (me && !shopOpen) sender.push(input.state(meI.x, meI.y));
  else if (shopOpen) sender.push({ u: 0, d: 0, l: 0, r: 0, a: me?.a || 0, f: false, f2: false, x: 0, y: 0 });
  parts.update(dt); floats.update(dt);
  const g = stage.g;
  stage.begin(dt);
  g.drawImage(ground, 0, 0);
  g.drawImage(decals, 0, 0, ST.W, ST.H);
  // barricades
  for (const b of S.barricades) { g.save(); g.translate(b.x, b.y); g.rotate(b.a); D.shadow(g, 4, 6, 36, 12); for (let k = -2; k <= 2; k++) D.rrect(g, -38, k * 5 - 2, 76, 6, 2, k % 2 ? '#a16207' : '#854d0e', '#451a03', 1); g.fillStyle = '#525252'; g.fillRect(-30, -12, 5, 24); g.fillRect(25, -12, 5, 24); g.restore(); D.bar(g, b.x - 24, b.y - 22, 48, 4, b.k, '#eab308'); }
  // bonus
  for (const d of S.drops) {
    const [ic, col] = DROP[d.kind], by = Math.sin(t * 4 + d.id) * 4;
    if (d.t < 5 && Math.sin(t * 20) > 0) continue;
    const gr = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, 28); gr.addColorStop(0, col + 'aa'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.beginPath(); g.arc(d.x, d.y, 28, 0, 7); g.fill();
    D.text(g, ic, d.x, d.y + by, { size: 24, stroke: false });
  }
  // tourelles
  for (const tu of S.turrets) { D.shadow(g, tu.x + 3, tu.y + 5, 20, 12); D.circle(g, tu.x, tu.y, 18, '#374151', tu.color, 3); g.save(); g.translate(tu.x, tu.y); g.rotate(tu.a); D.rrect(g, 0, -4, 28, 8, 3, '#111827'); D.rrect(g, -8, -9, 18, 18, 5, '#4b5563'); g.restore(); D.bar(g, tu.x - 18, tu.y - 28, 36, 4, tu.ammo / 400, '#38bdf8'); }
  for (const z of zs) drawZombie(g, z, t);
  for (const p of players) drawPlayer(g, p, t);
  // projectiles
  g.lineCap = 'round';
  for (const [, x, y, kind, a] of S.bullets) {
    if (kind === 'flame') { g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, y, 0, x, y, 16); gr.addColorStop(0, 'rgba(255,220,120,.9)'); gr.addColorStop(0.5, 'rgba(249,115,22,.5)'); gr.addColorStop(1, 'rgba(220,38,38,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 16, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; continue; }
    if (kind === 'gl') { D.circle(g, x, y, 6, '#4d7c0f', '#000', 1); continue; }
    const L = kind === 'sniper' ? 60 : 22;
    g.strokeStyle = kind === 'sniper' ? 'rgba(186,230,253,.95)' : 'rgba(253,224,71,.9)'; g.lineWidth = kind === 'sniper' ? 3 : 2.2;
    g.beginPath(); g.moveTo(x - Math.cos(a) * L, y - Math.sin(a) * L); g.lineTo(x, y); g.stroke();
  }
  for (const [, x, y] of S.spit) { D.circle(g, x, y, 7, '#84cc16', '#365314', 2); parts.burst(x, y, { n: 1, color: '#a3e635', speed: 10, life: 0.3, size: 3 }); }
  for (const [, x, y, nt] of S.nades) { const h = nt > 0 ? Math.sin((1 - nt / 1.1) * Math.PI) * 18 : 0; D.shadow(g, x, y + 4, 6, 3); D.circle(g, x, y - h, 6, '#3f6212', '#000', 1.5); if (Math.sin(t * 30) > 0) D.circle(g, x, y - h - 3, 2, '#ef4444'); }
  parts.draw(g);
  floats.draw(g);
  // lumière
  stage.screen();
  const night = S.night;
  const dark = clamp(night * 0.88, 0, 0.88);
  if (dark > 0.02) {
    const lights = [];
    for (const p of players) if (p.alive) { const sc = stage.toScreen(p.x, p.y), k = stage.cam.zoom; lights.push({ x: sc.x, y: sc.y, r: 120 * k }); lights.push({ x: sc.x + Math.cos(p.a) * 170 * k, y: sc.y + Math.sin(p.a) * 170 * k, r: 200 * k, k: 0.9 }); }
    for (const d of ST.map.decor) if (d.kind === 'lamp') { const sc = stage.toScreen(d.x, d.y); if (sc.x > -200 && sc.y > -200 && sc.x < stage.w + 200 && sc.y < stage.h + 200) lights.push({ x: sc.x, y: sc.y, r: 150 * stage.cam.zoom, k: 0.8 }); }
    for (const p of parts.list) if (p.glow && p.size > 4 && Math.random() < 0.3) { const sc = stage.toScreen(p.x, p.y); lights.push({ x: sc.x, y: sc.y, r: 60 * stage.cam.zoom, k: 0.5 }); }
    for (const tu of S.turrets) { const sc = stage.toScreen(tu.x, tu.y); lights.push({ x: sc.x, y: sc.y, r: 70, k: 0.6 }); }
    D.darkness(g, stage.w, stage.h, dark, lights);
  }
  // pluie la nuit
  if (night > 0.5) { g.strokeStyle = 'rgba(180,200,255,.25)'; g.lineWidth = 1; g.beginPath(); for (let k = 0; k < 120; k++) { const x = (k * 97 + t * 600) % stage.w, y = (k * 173 + t * 1400) % stage.h; g.moveTo(x, y); g.lineTo(x - 4, y + 14); } g.stroke(); }
  renderHud();
  drawMini();
}

function renderHud() {
  if (!me) return;
  const W = ST.weapons, w = W[me.weapon], am = S.me?.ammo[me.weapon];
  // vague
  const phase = S.phase === 'pause' ? (S.wave ? `Prochaine vague dans <b>${Math.ceil(S.timer)}</b> s` : `Préparez-vous… <b>${Math.ceil(S.timer)}</b> s`) : `🧟 ${S.left} zombies restants`;
  set('tl', `<div class="gk-panel"><div class="zs-wave">Vague ${S.wave}${S.goal ? ` / ${S.goal}` : ''}</div><div class="zs-sub">${phase}</div><div class="zs-sub">☠️ ${S.totalKills} tués · ${S.night > 0.6 ? '🌙 Nuit' : S.night > 0.3 ? '🌆 Crépuscule' : '☀️ Jour'}</div>
    ${S.phase === 'pause' && S.wave ? `<button class="gk-btn primary zs-ready pe" data-ready ${me.ready ? 'disabled' : ''}>${me.ready ? 'Prêt ✔' : '⏭ Je suis prêt (Entrée)'}</button>` : ''}</div>`);
  // équipe
  set('tr', S.players.filter(p => p.id !== api.myId).map(p => `<div class="zs-team"><span class="dot" style="background:${p.color}"></span><span>${esc(p.name)}</span>${!p.alive ? '💀' : p.down ? '🆘' : `<span class="hp"><b style="width:${p.hp / p.maxHp * 100}%"></b></span>`}<small>${p.kills}☠️</small></div>`).join(''));
  // vie / argent
  set('bl', `<div class="zs-money">💰 ${me.money} $</div><div class="zs-bars">
    <div class="bar"><b style="width:${me.hp / me.maxHp * 100}%;background:linear-gradient(90deg,#16a34a,#4ade80)"></b><span>❤️ ${me.hp} / ${me.maxHp}</span></div>
    ${me.armor ? `<div class="bar"><b style="width:${me.armor}%;background:linear-gradient(90deg,#2563eb,#60a5fa)"></b><span>🛡️ ${me.armor}</span></div>` : ''}</div>
    <div class="zs-inv"><span>💣 ${S.me.grenades}</span><span>🗼 ${S.me.turrets}</span><span>🧱 ${S.me.barricades}</span>${me.rage ? '<span style="color:#fb923c">😡 Rage ×2</span>' : ''}</div>`);
  // arme
  const res = am ? (am.res < 0 ? '∞' : am.res) : 0;
  set('br', `<div class="zs-wname">${WICON[me.weapon]} ${esc(w.name)}</div><div class="zs-ammo" style="color:${am && am.mag <= w.mag * 0.2 ? '#f87171' : '#fff'}">${S.me.reloadT > 0 ? '<span style="font-size:22px">Recharge…</span>' : am?.mag ?? 0}<small> / ${res}</small></div>
    <div class="zs-slots">${S.me.owned.map(k => `<span class="${k === me.weapon ? 'on' : ''}">${ST.order.indexOf(k) + 1} ${WICON[k]}</span>`).join('')}</div>`);
  ui.hud.querySelector('[data-ready]')?.addEventListener('click', () => api.send({ type: 'skip' }));
  // boss
  ui.boss.style.display = S.boss ? '' : 'none';
  if (S.boss) ui.boss.innerHTML = `☠️ ABOMINATION<div class="bar"><b style="width:${S.boss.hp / S.boss.max * 100}%"></b></div>`;
  // message central
  if (msgT > 0) { msgT -= 1 / 60; if (ui.center.innerHTML !== msgHTML) ui.center.innerHTML = msgHTML; } else if (ui.center.innerHTML) ui.center.innerHTML = '';
  if (!me.alive && !S.over) { ui.center.innerHTML = `<div class="big" style="color:#f87171">💀 Vous êtes mort</div><div class="zs-sub">Vous reviendrez au début de la prochaine vague</div>`; }
  else if (me.down) ui.center.innerHTML = `<div class="big" style="color:#fca5a5">🆘 À terre !</div><div class="zs-sub">Un coéquipier doit rester près de vous pour vous relever (${me.downT} s)</div>`;
  ui.vig.style.opacity = me.alive && me.hp / me.maxHp < 0.3 ? 0.5 + Math.sin(performance.now() / 200) * 0.2 : 0;
  if (shopOpen) renderShop();
}
const set = (k, html) => { const el = ui[k]; if (el._h !== html) { el._h = html; el.innerHTML = html; } };

function drawMini() {
  const c = ui.mini, g = c.getContext('2d'), k = c.width / ST.W;
  if (!ui.miniBg) { ui.miniBg = document.createElement('canvas'); ui.miniBg.width = c.width; ui.miniBg.height = c.height; const mg = ui.miniBg.getContext('2d'); mg.fillStyle = '#1f2937'; mg.fillRect(0, 0, c.width, c.height); mg.fillStyle = '#4b5563'; for (const o of ST.map.obs) mg.fillRect(o.x * k, o.y * k, Math.max(1, o.w * k), Math.max(1, o.h * k)); }
  g.drawImage(ui.miniBg, 0, 0);
  g.fillStyle = '#ef4444'; for (const z of S.zombies) g.fillRect(z[1] * k - 1, z[2] * k - 1, z[3] === 'boss' ? 5 : 2, z[3] === 'boss' ? 5 : 2);
  for (const p of S.players) if (p.alive) { g.fillStyle = p.color; g.beginPath(); g.arc(p.x * k, p.y * k, p.id === api.myId ? 3.5 : 2.5, 0, 7); g.fill(); }
}

// ---------------- Boutique ----------------
function renderShop() {
  const W = ST.weapons, SH = ST.shop, mine = S.me;
  let items = '';
  if (shopTab === 'armes') items = ST.order.map((k, i) => {
    const w = W[k], own = mine.owned.includes(k);
    const price = own ? w.ammoPrice : w.price, label = own ? (w.ammoPrice ? `Munitions : ${w.ammoPrice} $` : 'Possédé') : `${w.price} $`;
    return `<button class="zs-item ${own ? 'own' : ''} ${me.money < price ? 'no' : ''}" data-buy="${k}"><span class="ic">${WICON[k]}</span><b>${i + 1}. ${esc(w.name)}</b>
      <span class="zs-stats">Dégâts ${w.dmg}${w.pellets > 1 ? '×' + w.pellets : ''} · Cadence ${Math.round(1 / w.rate)}/s · Chargeur ${w.mag}${w.pierce > 1 ? ' · Perforant' : ''}${w.aoe ? ' · Explosif' : ''}</span><span class="pr">${label}</span></button>`;
  }).join('');
  else items = Object.entries(SH).filter(([, it]) => shopTab === 'atouts' ? it.perk : !it.perk).map(([k, it]) => {
    const lvl = mine.perks[k] || 0, price = it.perk ? Math.round(it.price * (1 + lvl * 0.6)) : it.price, maxed = it.perk && lvl >= it.max;
    return `<button class="zs-item ${me.money < price || maxed ? 'no' : ''} ${lvl ? 'own' : ''}" data-buy="${k}"><span class="ic">${it.icon}</span><b>${esc(it.name)}</b><small>${esc(it.desc || '')}</small>
      ${it.perk ? `<small>Niveau ${lvl} / ${it.max}</small>` : ''}<span class="pr">${maxed ? 'MAX' : price + ' $'}</span></button>`;
  }).join('');
  const html = `<h2><span>🛒 Boutique</span><span style="color:#fde047">💰 ${me.money} $</span></h2>
    <div class="tabs">${[['armes', '🔫 Armes'], ['equipement', '🎒 Équipement'], ['atouts', '⭐ Atouts']].map(([k, l]) => `<button class="gk-btn ${shopTab === k ? 'primary' : ''}" data-tab="${k}">${l}</button>`).join('')}<span style="flex:1"></span><button class="gk-btn ghost" data-close>Fermer (B)</button></div>
    <div class="grid">${items}</div>`;
  if (ui.shop._h === html) return;
  ui.shop._h = html; ui.shop.innerHTML = html;
  ui.shop.querySelectorAll('[data-buy]').forEach(b => { b.onclick = () => api.send({ type: 'buy', item: b.dataset.buy }); });
  ui.shop.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => { shopTab = b.dataset.tab; renderShop(); }; });
  ui.shop.querySelector('[data-close]').onclick = toggleShop;
}
function toggleShop() { shopOpen = !shopOpen; ui.shop.style.display = shopOpen ? '' : 'none'; ui.shop._h = ''; if (shopOpen) renderShop(); }
function bigMsg(html, dur = 3) { msgHTML = `<div class="big">${html}</div>`; msgT = dur * 60; }

export default {
  mount(r, a) {
    api = a; ST = a.static; endShown = false; shopOpen = false; lastWave = 0;
    ST.zr = { normal: 16, rapide: 13, rampant: 11, brute: 28, cracheur: 15, kamikaze: 15, blinde: 19, invocateur: 18, boss: 46 };
    sh = shell(r, api, { title: 'Zombie Survival', icon: '🧟', overlay: true });
    stage = new Stage(sh.main, { bg: '#111' });
    parts = new Particles(); floats = new Floaters();
    zint = new Interp(70); pint = new Interp(70);
    sender = new InputSender(api);
    renderGround();
    ui.hud = hud(sh.main, `<div class="zs-vig"></div><div class="tl"></div><div class="tr"></div><div class="bl"></div><div class="br"></div><div class="zs-boss" style="display:none"></div><div class="zs-center"></div>
      <canvas class="zs-mini" width="208" height="144"></canvas><div class="zs-keys"><kbd>B</kbd> boutique · <kbd>R</kbd> recharger · <kbd>G</kbd> grenade · <kbd>T</kbd> tourelle · <kbd>F</kbd> barricade · <kbd>1-9</kbd> armes</div>
      <div class="zs-shop pe" style="display:none"></div>`);
    ui.hud.classList.add('zs-hud');
    for (const k of ['tl', 'tr', 'bl', 'br', 'center', 'shop', 'vig', 'mini']) ui[k] = ui.hud.querySelector(k === 'center' ? '.zs-center' : k === 'shop' ? '.zs-shop' : k === 'vig' ? '.zs-vig' : k === 'mini' ? '.zs-mini' : '.' + k);
    ui.boss = ui.hud.querySelector('.zs-boss');
    input = new Input(stage, {
      onKey: (code) => {
        if (code === 'KeyB' || code === 'Tab') { toggleShop(); return; }
        if (code === 'Escape' && shopOpen) { toggleShop(); return; }
        if (code === 'KeyR') api.send({ type: 'reload' });
        if (code === 'KeyG') { const w = input.world(); api.send({ type: 'grenade', x: w.x, y: w.y }); }
        if (code === 'KeyT') api.send({ type: 'turret' });
        if (code === 'KeyF') api.send({ type: 'barricade' });
        if (code === 'Enter') api.send({ type: 'skip' });
        const m = code.match(/^Digit([1-9])$/);
        if (m) { const k = ST.order[+m[1] - 1]; if (S?.me?.owned.includes(k)) api.send({ type: 'weapon', w: k }); else if (shopOpen) api.send({ type: 'buy', item: k }); }
      },
      onWheel: d => api.send({ type: 'weapon', dir: d }),
    });
    window.addEventListener('keydown', ui.tabBlock = e => { if (e.code === 'Tab') e.preventDefault(); });
    stop = loop(frame);
    bigMsg('Préparez-vous !', 3);
  },
  update(s) {
    S = s;
    pint.push(s.players, ['x', 'y', 'a']);
    zint.push(s.zombies.map(z => ({ id: z[0], x: z[1], y: z[2], a: z[5], raw: z })), ['x', 'y', 'a']);
    if (s.over && !endShown) {
      endShown = true;
      endScreen(sh.main, api, { title: s.win ? '🏆 Victoire ! La ville est sauvée' : `💀 L’équipe est tombée à la vague ${s.wave}`, sub: `${s.totalKills} zombies éliminés · difficulté ${s.difficulty}`,
        rows: s.players.slice().sort((a, b) => b.kills - a.kills).map(p => ({ name: p.name, color: p.color, value: `${p.kills} ☠️ · ${p.deaths} morts`, me: p.id === api.myId })), valueLabel: 'Éliminations' });
    }
  },
  event(e) {
    const near = (x, y) => { if (x == null || !stage) return 1; const d = Math.hypot(x - stage.cam.x, y - stage.cam.y); return clamp(1 - d / 1100, 0, 1); };
    switch (e.type) {
      case 'shot': {
        sfx.play(ST.weapons[e.w].sound, near(e.x, e.y) * (e.w === 'lanceflammes' ? 0.5 : 0.6));
        if (e.w === 'lanceflammes') { parts.burst(e.x, e.y, { n: 4, color: ['#fde047', '#f97316', '#ef4444'], speed: 380, life: 0.45, size: 9, dir: e.a, spread: 0.5, drag: 3, glow: true }); break; }
        parts.burst(e.x + Math.cos(e.a) * 6, e.y + Math.sin(e.a) * 6, { n: 5, color: ['#fff7ae', '#fbbf24'], speed: 220, life: 0.08, size: 5, dir: e.a, spread: 0.7, glow: true });
        parts.burst(e.x, e.y, { n: 1, color: '#d4a017', speed: 120, life: 0.6, size: 2, dir: e.a + Math.PI / 2, spread: 0.6, drag: 4, shrink: false });
        if (e.id === api.myId) stage.shake(e.w === 'pompe' || e.w === 'sniper' || e.w === 'lancegrenades' ? 7 : 1.5);
        break;
      }
      case 'tshot': sfx.play('smg', near(e.x, e.y) * 0.3); parts.burst(e.x + Math.cos(e.a) * 26, e.y + Math.sin(e.a) * 26, { n: 3, color: '#fde68a', speed: 200, life: 0.06, size: 4, dir: e.a, spread: 0.6, glow: true }); break;
      case 'beam': {
        sfx.play('laser', near(e.x, e.y) * 0.6);
        const n = Math.hypot(e.x2 - e.x, e.y2 - e.y) / 14;
        for (let k = 0; k < n; k++) { const f = k / n; parts.burst(e.x + (e.x2 - e.x) * f, e.y + (e.y2 - e.y) * f, { n: 1, color: ['#67e8f9', '#e0f2fe'], speed: 20, life: 0.25, size: 4, glow: true }); }
        break;
      }
      case 'spark': parts.burst(e.x, e.y, { n: 4, color: '#fde68a', speed: 160, life: 0.2, size: 2 }); break;
      case 'blood': parts.burst(e.x, e.y, { n: 6, color: ['#7f1d1d', '#b91c1c'], speed: 160, life: 0.4, size: 3, dir: e.a, spread: 1 }); splat(e.x + Math.cos(e.a) * 14, e.y + Math.sin(e.a) * 14, 14, 'rgba(110,10,10,.5)', 3); break;
      case 'zdie': {
        const big = e.z === 'boss' ? 4 : e.z === 'brute' ? 2 : 1;
        parts.burst(e.x, e.y, { n: 16 * big, color: ['#7f1d1d', '#991b1b', '#4d7c0f'], speed: 220, life: 0.6, size: 4 });
        splat(e.x, e.y, 26 * big, e.z === 'cracheur' ? 'rgba(77,124,15,.55)' : 'rgba(100,8,8,.65)', 10 * big);
        if (Math.random() < 0.3) sfx.play('zombie', near(e.x, e.y) * 0.5);
        if (e.z === 'boss') { bigMsg('☠️ Abomination vaincue !', 3); sfx.play('win'); }
        break;
      }
      case 'boom': {
        sfx.play('boom', near(e.x, e.y));
        parts.burst(e.x, e.y, { n: Math.round(e.r / 3), color: ['#fde047', '#f97316', '#ef4444', '#fff7ae'], speed: e.r * 4, life: 0.55, size: 9, glow: true, drag: 4 });
        parts.burst(e.x, e.y, { n: Math.round(e.r / 5), color: ['#3f3f46', '#52525b', '#27272a'], speed: e.r * 2, life: 1.2, size: 12, grav: -30, drag: 2 });
        splat(e.x, e.y, e.r * 0.6, 'rgba(20,20,20,.5)', 8);
        stage.shake(clamp(e.r / 8 * near(e.x, e.y), 2, 18));
        break;
      }
      case 'money': floats.add(e.x, e.y - 20, `+${e.n} $`, '#fde047', 15); break;
      case 'hurt': sfx.play('hurt', 0.6); stage.shake(5); ui.vig.style.opacity = 0.8; break;
      case 'bite': parts.burst(e.x, e.y, { n: 6, color: '#b91c1c', speed: 120, life: 0.3, size: 3 }); break;
      case 'acid': parts.burst(e.x, e.y, { n: 10, color: ['#a3e635', '#65a30d'], speed: 140, life: 0.4, size: 4 }); splat(e.x, e.y, 16, 'rgba(101,163,13,.45)', 5); break;
      case 'spit': sfx.play('splash', near(e.x, e.y) * 0.3); break;
      case 'down': { const p = S?.players.find(q => q.id === e.id); bigMsg(`🆘 ${esc(p?.name || '')} est à terre !`, 2.5); sfx.play('bad'); break; }
      case 'revived': { const p = S?.players.find(q => q.id === e.id); floats.add(p?.x || 0, (p?.y || 0) - 30, '✚ Relevé !', '#4ade80', 18); sfx.play('good'); break; }
      case 'dead': sfx.play('die'); parts.burst(e.x, e.y, { n: 30, color: '#991b1b', speed: 200, life: 0.8, size: 4 }); splat(e.x, e.y, 40, 'rgba(120,10,10,.7)', 14); break;
      case 'wave': bigMsg(e.boss ? `☠️ Vague ${e.n} — BOSS !` : `🧟 Vague ${e.n}`, 3); sfx.play(e.boss ? 'bad' : 'countdown'); sfx.play('zombie'); break;
      case 'waveDone': bigMsg(`✔ Vague ${e.n} repoussée !`, 3); sfx.play('good'); break;
      case 'pickup': { const [ic, col] = DROP[e.kind]; floats.add(e.x, e.y - 20, { soin: 'Soin pour tous !', munitions: 'Munitions !', rage: 'RAGE ×2 !', bombe: 'BOMBE !', argent: 'Jackpot !' }[e.kind] + ' ' + ic, col, 18); sfx.play('pickup'); break; }
      case 'nuke': { stage.shake(25); sfx.play('boom'); const f = document.createElement('div'); f.style.cssText = 'position:absolute;inset:0;background:#fff;pointer-events:none;z-index:9;transition:opacity 1s'; sh.main.appendChild(f); requestAnimationFrame(() => { f.style.opacity = 0; }); setTimeout(() => f.remove(), 1100); break; }
      case 'bought': sfx.play('buy'); break;
      case 'reload': sfx.play('reload', 0.6); break;
      case 'empty': sfx.play('empty'); break;
      case 'throw': sfx.play('swing', 0.5); break;
      case 'place': sfx.play('place'); break;
      case 'roar': sfx.play('zombie', 1, 0.5); stage.shake(10); break;
      case 'summon': parts.burst(e.x, e.y, { n: 20, color: ['#c084fc', '#7e22ce'], speed: 150, life: 0.6, size: 4, glow: true }); break;
      case 'end': break;
    }
  },
  unmount() { stop?.(); input?.destroy(); stage?.destroy(); window.removeEventListener('keydown', ui.tabBlock); S = null; ui = {}; },
};
