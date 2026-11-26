// =====================================================================
//  FANTASY QUEST — affichage (navigateur)
// =====================================================================
import { shell, sfx, esc, css, Stage, Input, InputSender, Interp, Particles, Floaters, loop, D, hud, clamp } from '../lib/kit.js';

const ZCOL = { village: ['#6aa84f', '#5e9a45'], forest: ['#2f5d2a', '#2a5325'], plains: ['#a3b65a', '#98aa50'], swamp: ['#4b5a3a', '#435033'], dungeon: ['#4b4f58', '#42464e'], lava: ['#3b2622', '#32201c'] };
css('fq-css', `
.fq-hud .me { position:absolute; left:12px; top:60px; display:flex; gap:10px; align-items:center; }
.fq-hud .portrait { width:58px; height:58px; border-radius:14px; display:grid; place-items:center; font-size:30px; border:3px solid #fde68a; background:#1c1917; position:relative; }
.fq-hud .portrait b { position:absolute; bottom:-8px; right:-8px; background:#b45309; border-radius:999px; font-size:12px; padding:2px 6px; border:2px solid #fde68a; }
.fq-bars { width:220px; } .fq-bar { height:14px; border-radius:7px; background:rgba(0,0,0,.65); overflow:hidden; position:relative; margin-bottom:4px; border:1px solid rgba(255,255,255,.12); }
.fq-bar b { display:block; height:100%; transition:width .2s; } .fq-bar span { position:absolute; inset:0; display:grid; place-items:center; font-size:10px; font-weight:800; text-shadow:0 1px 2px #000; }
.fq-xp { position:absolute; left:0; right:0; bottom:0; height:6px; background:rgba(0,0,0,.6); } .fq-xp b { display:block; height:100%; background:linear-gradient(90deg,#a855f7,#facc15); transition:width .3s; }
.fq-skills { position:absolute; left:50%; bottom:14px; transform:translateX(-50%); display:flex; gap:6px; pointer-events:auto; }
.fq-sk { width:58px; height:58px; border-radius:12px; background:rgba(20,16,12,.85); border:2px solid #78716c; position:relative; display:grid; place-items:center; font-size:24px; cursor:pointer; }
.fq-sk kbd { position:absolute; top:-8px; left:-6px; } .fq-sk small { position:absolute; bottom:1px; right:4px; font-size:11px; font-weight:800; }
.fq-sk .cd { position:absolute; inset:0; background:rgba(0,0,0,.65); border-radius:10px; display:grid; place-items:center; font-size:16px; font-weight:800; }
.fq-sk.nomp { border-color:#1d4ed8; filter:grayscale(.6); }
.fq-quest { position:absolute; right:12px; top:270px; width:230px; font-size:13px; }
.fq-quest h4 { margin:0 0 4px; color:#fde68a; font-size:13px; }
.fq-zone { position:absolute; left:50%; top:90px; transform:translateX(-50%); font-family:'Space Grotesk'; font-size:30px; font-weight:700; color:#fde68a; text-shadow:0 3px 10px #000; pointer-events:none; animation: fqz 3.5s forwards; }
@keyframes fqz { 0% { opacity:0; transform:translateX(-50%) translateY(10px); } 15%,75% { opacity:1; transform:translateX(-50%); } 100% { opacity:0; } }
.fq-mini { position:absolute; right:12px; top:60px; border-radius:12px; border:2px solid #78716c; }
.fq-chat { position:absolute; left:12px; bottom:84px; width:330px; pointer-events:auto; }
.fq-chat .log { max-height:140px; overflow:auto; font-size:13px; background:rgba(0,0,0,.45); border-radius:10px; padding:6px 8px; display:flex; flex-direction:column; gap:2px; }
.fq-chat input { margin-top:4px; padding:7px 10px; font-size:13px; background:rgba(0,0,0,.6); }
.fq-boss { position:absolute; left:50%; top:60px; transform:translateX(-50%); width:min(560px,70vw); text-align:center; font-weight:800; color:#fecaca; text-shadow:0 2px 4px #000; }
.fq-boss .fq-bar { height:16px; } .fq-boss .fq-bar b { background:linear-gradient(90deg,#7f1d1d,#ef4444); }
.fq-modal { position:absolute; inset:0; display:grid; place-items:center; background:rgba(0,0,0,.55); pointer-events:auto; z-index:20; padding:16px; }
.fq-box { background:linear-gradient(#2a2118,#1c1610); border:2px solid #a16207; border-radius:18px; padding:20px; width:min(760px,100%); max-height:90vh; overflow:auto; box-shadow:0 30px 80px #000c; }
.fq-box h2 { margin:0 0 6px; color:#fde68a; } .fq-box p { color:#d6d3d1; }
.fq-classes { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:10px; margin-top:12px; }
.fq-class { background:#292017; border:2px solid #57534e; border-radius:14px; padding:14px; cursor:pointer; text-align:left; color:#fff; font:inherit; transition:all .15s; }
.fq-class:hover { border-color:#fde68a; transform:translateY(-3px); } .fq-class .ic { font-size:40px; } .fq-class > b { display:block; font-size:18px; }
.fq-class small { display:block; color:#a8a29e; margin-top:4px; font-size:12px; line-height:1.4; }
.fq-items { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:10px; }
.fq-item { background:#292017; border:2px solid #57534e; border-radius:12px; padding:12px; text-align:left; color:#fff; cursor:pointer; font:inherit; }
.fq-item:hover { border-color:#fde68a; } .fq-item .p { color:#fde047; font-weight:800; }
.fq-dead { position:absolute; inset:0; background:rgba(60,0,0,.45); display:grid; place-items:center; text-align:center; pointer-events:none; }
.fq-dead h1 { font-size:54px; margin:0; color:#fca5a5; text-shadow:0 4px 14px #000; }
.fq-talk { position:absolute; left:50%; bottom:90px; transform:translateX(-50%); background:rgba(0,0,0,.7); padding:6px 14px; border-radius:10px; font-weight:700; }
@media (max-width:800px) { .fq-chat, .fq-quest { display:none; } .fq-mini { width:120px; height:86px; } }
`);

let pickSent = false;
let api, ST, S, sh, stage, input, sender, stop, parts, floats, hint, mint, ui = {}, ground, lastZone = '', modal = null, typing = false;

function renderGround() {
  const k = 0.5, { W, H } = ST;
  ground = document.createElement('canvas'); ground.width = W * k; ground.height = H * k;
  const g = ground.getContext('2d'); g.scale(k, k);
  g.fillStyle = '#5b8c45'; g.fillRect(0, 0, W, H);
  for (const z of ST.zones) {
    const [a, b] = ZCOL[z.color];
    g.fillStyle = a; g.fillRect(z.x, z.y, z.w, z.h);
    for (let i = 0; i < z.w * z.h / 900; i++) { g.fillStyle = Math.random() < 0.5 ? b : 'rgba(255,255,255,.05)'; g.fillRect(z.x + Math.random() * z.w, z.y + Math.random() * z.h, 6, 6); }
    if (z.color === 'dungeon') { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3; for (let x = z.x; x < z.x + z.w; x += 60) for (let y = z.y; y < z.y + z.h; y += 60) g.strokeRect(x + ((y / 60) % 2) * 30, y, 60, 60); }
    if (z.color === 'lava') for (let i = 0; i < 40; i++) { const x = z.x + Math.random() * z.w, y = z.y + Math.random() * z.h; const gr = g.createRadialGradient(x, y, 0, x, y, 60); gr.addColorStop(0, 'rgba(253,186,116,.9)'); gr.addColorStop(0.3, 'rgba(234,88,12,.7)'); gr.addColorStop(1, 'rgba(127,29,29,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 60, 0, 7); g.fill(); }
    if (z.color === 'swamp') for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(56,72,60,.8)'; g.beginPath(); g.ellipse(z.x + Math.random() * z.w, z.y + Math.random() * z.h, 60 + Math.random() * 60, 30 + Math.random() * 30, 0, 0, 7); g.fill(); }
    if (z.color === 'village') { g.fillStyle = '#b8a07a'; g.beginPath(); g.arc(640, 1520, 190, 0, 7); g.fill(); for (let i = 0; i < 400; i++) { g.fillStyle = 'rgba(0,0,0,.12)'; const a = Math.random() * 6.28, r = Math.random() * 185; g.fillRect(640 + Math.cos(a) * r, 1520 + Math.sin(a) * r, 10, 6); } }
  }
  // chemins de terre entre les zones
  g.strokeStyle = '#a58a5f'; g.lineWidth = 60; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const pts of [[[640, 1520], [1100, 1500], [1600, 1400], [2000, 900], [2600, 800], [2900, 800], [3400, 700]], [[1600, 1400], [1900, 2300], [2700, 2300], [2900, 2050], [3500, 2200]], [[640, 1520], [640, 900], [1300, 600]]]) { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); }
  g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 50; g.stroke();
  for (const d of ST.world.deco) { if (d.kind === 'forest' || d.kind === 'plains' || d.kind === 'village') { g.fillStyle = ['#fde047', '#f472b6', '#fff', '#60a5fa'][Math.floor(Math.random() * 4)]; g.beginPath(); g.arc(d.x, d.y, 4, 0, 7); g.fill(); } }
}

// ---------- Dessin des héros, monstres, décor ----------
function drawObs(g, o, t) {
  if (o.kind === 'tree') { D.shadow(g, o.x + 30, o.y + 40, 30, 14); D.rrect(g, o.x + 18, o.y + 20, 10, 26, 3, '#78350f'); D.circle(g, o.x + 23, o.y + 14, 28, '#166534'); D.circle(g, o.x + 16, o.y + 6, 18, '#15803d'); D.circle(g, o.x + 30, o.y + 4, 12, '#22c55e'); }
  else if (o.kind === 'deadtree') { D.shadow(g, o.x + 26, o.y + 40, 22, 10); g.strokeStyle = '#44403c'; g.lineWidth = 7; g.beginPath(); g.moveTo(o.x + 22, o.y + 44); g.lineTo(o.x + 22, o.y); g.moveTo(o.x + 22, o.y + 14); g.lineTo(o.x + 4, o.y - 4); g.moveTo(o.x + 22, o.y + 8); g.lineTo(o.x + 40, o.y - 6); g.stroke(); }
  else if (o.kind === 'rock' || o.kind === 'lavarock') { D.shadow(g, o.x + o.w / 2 + 6, o.y + o.h, o.w / 2, 10); D.rrect(g, o.x, o.y, o.w, o.h, 14, o.kind === 'lavarock' ? '#292524' : '#78716c', o.kind === 'lavarock' ? '#ea580c' : '#57534e', 3); }
  else if (o.kind === 'ruin') { D.rrect(g, o.x, o.y, o.w, o.h, 4, '#57534e', '#292524', 3); g.fillStyle = 'rgba(0,0,0,.2)'; for (let x = o.x + 6; x < o.x + o.w - 10; x += 20) g.fillRect(x, o.y + 6, 12, 8); }
  else if (o.kind === 'house') { D.shadow(g, o.x + o.w / 2 + 10, o.y + o.h + 4, o.w / 2, 14); D.rrect(g, o.x, o.y + 40, o.w, o.h - 40, 4, '#e7d3b0', '#78350f', 3); g.fillStyle = '#991b1b'; g.beginPath(); g.moveTo(o.x - 12, o.y + 46); g.lineTo(o.x + o.w / 2, o.y - 6); g.lineTo(o.x + o.w + 12, o.y + 46); g.fill(); D.rrect(g, o.x + o.w / 2 - 14, o.y + o.h - 40, 28, 40, 4, '#78350f'); D.rrect(g, o.x + 16, o.y + 60, 24, 20, 3, '#fde68a', '#78350f', 2); D.rrect(g, o.x + o.w - 40, o.y + 60, 24, 20, 3, '#fde68a', '#78350f', 2); }
  else D.rrect(g, o.x, o.y, o.w, o.h, 6, '#44403c', '#1c1917', 4);
}
function drawHero(g, h, t, chat) {
  if (h.dead) { D.text(g, '🪦', h.x, h.y, { size: 30, stroke: false }); return; }
  const bob = h.moving ? Math.abs(Math.sin(t * 10)) * 3 : 0, face = Math.cos(h.a) >= 0 ? 1 : -1;
  D.shadow(g, h.x, h.y + 16, 16, 7);
  if (h.shield) D.circle(g, h.x, h.y - 6, 28, 'rgba(253,230,138,.15)', `rgba(253,230,138,${0.6 + Math.sin(t * 6) * 0.3})`, 3);
  g.save(); g.translate(h.x, h.y - bob);
  // arme (derrière ou devant selon l'orientation)
  const wa = h.atk ? h.a + Math.sin(t * 30) * 0.8 : h.a;
  const weapon = () => { g.save(); g.rotate(wa); if (h.cls === 'guerrier') { D.rrect(g, 10, -3, 34, 6, 2, '#cbd5e1', '#475569', 1); D.rrect(g, 8, -8, 4, 16, 2, '#a16207'); } else if (h.cls === 'mage') { D.rrect(g, 6, -2, 36, 4, 2, '#78350f'); D.circle(g, 44, 0, 6, '#c084fc'); D.circle(g, 44, 0, 10, 'rgba(192,132,252,.3)'); } else if (h.cls === 'archer') { g.strokeStyle = '#92400e'; g.lineWidth = 3; g.beginPath(); g.arc(14, 0, 18, -1.2, 1.2); g.stroke(); g.strokeStyle = '#e5e7eb'; g.lineWidth = 1; g.beginPath(); g.moveTo(14 + Math.cos(-1.2) * 18, Math.sin(-1.2) * 18); g.lineTo(h.atk ? 2 : 10, 0); g.lineTo(14 + Math.cos(1.2) * 18, Math.sin(1.2) * 18); g.stroke(); } else { D.rrect(g, 8, -2, 24, 4, 2, '#a16207'); D.circle(g, 32, 0, 6, '#fde047', '#a16207', 2); } g.restore(); };
  if (Math.sin(h.a) < 0) weapon();
  // corps
  D.rrect(g, -12, -8, 24, 26, 9, h.cls === 'clerc' ? '#f8fafc' : h.color, 'rgba(0,0,0,.4)', 2);
  if (h.cls === 'clerc') D.rrect(g, -3, -6, 6, 22, 2, h.color);
  if (h.armor >= 3) D.rrect(g, -10, -6, 20, 12, 5, '#94a3b8');
  D.circle(g, 0, -16, 11, '#f1c27d', 'rgba(0,0,0,.35)', 1.5);
  D.circle(g, 4 * face, -17, 1.8, '#111'); D.circle(g, -1 * face, -17, 1.8, '#111');
  // couvre-chef de classe
  if (h.cls === 'guerrier') { g.fillStyle = '#94a3b8'; g.beginPath(); g.arc(0, -19, 12, Math.PI, 0); g.fill(); D.rrect(g, -2, -32, 4, 8, 2, '#dc2626'); }
  if (h.cls === 'mage') { g.fillStyle = '#6d28d9'; g.beginPath(); g.moveTo(-15, -20); g.lineTo(15, -20); g.lineTo(3, -46); g.fill(); D.circle(g, 3, -46, 3, '#fde047'); }
  if (h.cls === 'archer') { g.fillStyle = '#15803d'; g.beginPath(); g.arc(0, -18, 13, Math.PI * 1.05, -0.05); g.lineTo(-12 * face, -6); g.fill(); }
  if (h.cls === 'clerc') D.circle(g, 0, -32, 9, null, '#fde047', 2.5);
  if (Math.sin(h.a) >= 0) weapon();
  g.restore();
  D.text(g, `${h.name} · Nv ${h.lvl}`, h.x, h.y - 58, { size: 12, color: h.id === api.myId ? '#fde68a' : '#fff' });
  D.bar(g, h.x - 22, h.y - 50, 44, 5, h.hp / h.maxHp, '#22c55e');
  const c = chat.find(m => m.id === h.id);
  if (c) { g.font = '600 13px Inter'; const w = Math.min(240, g.measureText(c.text).width + 18); g.globalAlpha = c.age > 6 ? Math.max(0, 1 - (c.age - 6) / 2) : 1; if (g.globalAlpha > 0) { D.rrect(g, h.x - w / 2, h.y - 92, w, 26, 10, 'rgba(255,255,255,.95)'); D.text(g, c.text.length > 32 ? c.text.slice(0, 31) + '…' : c.text, h.x, h.y - 79, { size: 13, color: '#111', stroke: false, weight: 600 }); } g.globalAlpha = 1; }
}
function drawMob(g, m, t) {
  const M = ST.monsters[m.t], r = M.r;
  if (m.t === 'dragon') return drawDragon(g, m, t);
  const bob = Math.sin(t * 8 + m.id) * 2, face = Math.cos(m.a) >= 0 ? 1 : -1;
  D.shadow(g, m.x, m.y + r * 0.8, r, r * 0.4);
  g.save(); g.translate(m.x, m.y + bob); g.scale(face, 1);
  if (m.t === 'slime') { const sq = 1 + Math.sin(t * 6 + m.id) * 0.1; g.scale(1 / sq, sq); D.circle(g, 0, 0, r, 'rgba(74,222,128,.85)', '#166534', 2); D.circle(g, -5, -6, r * 0.3, 'rgba(255,255,255,.5)'); D.circle(g, 4, -2, 2.5, '#111'); D.circle(g, 10, -2, 2.5, '#111'); }
  else if (m.t === 'loup') { D.rrect(g, -r, -r * 0.5, r * 2, r, r * 0.5, '#6b7280', '#374151', 2); D.circle(g, r * 0.9, -r * 0.5, r * 0.55, '#6b7280', '#374151', 2); g.fillStyle = '#6b7280'; g.beginPath(); g.moveTo(r * 0.7, -r); g.lineTo(r * 0.85, -r * 1.4); g.lineTo(r, -r); g.fill(); D.circle(g, r * 1.1, -r * 0.6, 2, '#facc15'); D.rrect(g, -r * 1.5, -r * 0.4, r * 0.7, 6, 3, '#6b7280'); }
  else if (m.t === 'gobelin' || m.t === 'archerG') { D.rrect(g, -9, -4, 18, 20, 7, '#4d7c0f', '#1a2e05', 2); D.circle(g, 0, -12, 10, '#65a30d', '#1a2e05', 2); g.fillStyle = '#65a30d'; g.beginPath(); g.moveTo(-8, -14); g.lineTo(-18, -20); g.lineTo(-6, -8); g.fill(); g.beginPath(); g.moveTo(8, -14); g.lineTo(18, -20); g.lineTo(6, -8); g.fill(); D.circle(g, 4, -13, 2, '#ef4444'); if (m.t === 'archerG') { g.strokeStyle = '#92400e'; g.lineWidth = 2.5; g.beginPath(); g.arc(12, 4, 12, -1.2, 1.2); g.stroke(); } else D.rrect(g, 8, 2, 14, 4, 2, '#d4d4d8'); }
  else if (m.t === 'squelette') { D.rrect(g, -8, -4, 16, 20, 5, '#e7e5e4', '#57534e', 2); for (let k = 0; k < 3; k++) g.fillRect(-6, k * 5, 12, 1.5); D.circle(g, 0, -13, 10, '#f5f5f4', '#57534e', 2); D.circle(g, 3, -14, 2.5, '#111'); D.circle(g, -3, -14, 2.5, '#111'); D.rrect(g, 8, -6, 4, 22, 2, '#a8a29e'); }
  else if (m.t === 'orc') { D.rrect(g, -r * 0.8, -r * 0.5, r * 1.6, r * 1.5, 10, '#57534e', '#1c1917', 2); D.circle(g, 0, -r * 0.7, r * 0.6, '#4d7c0f', '#1a2e05', 2); D.circle(g, 5, -r * 0.75, 2.5, '#fde047'); g.fillStyle = '#fff'; g.fillRect(2, -r * 0.45, 3, 5); g.fillRect(-5, -r * 0.45, 3, 5); D.rrect(g, r * 0.6, -r, 6, r * 1.6, 2, '#78350f'); D.rrect(g, r * 0.6 - 6, -r, 18, 12, 3, '#9ca3af'); }
  else if (m.t === 'sorcier') { g.fillStyle = '#3b0764'; g.beginPath(); g.moveTo(-14, 18); g.lineTo(14, 18); g.lineTo(6, -10); g.lineTo(-6, -10); g.fill(); D.circle(g, 0, -14, 10, '#e7e5e4'); D.circle(g, 3, -15, 2.5, '#a855f7'); D.circle(g, -3, -15, 2.5, '#a855f7'); D.circle(g, 0, -14, 18, `rgba(168,85,247,${0.15 + Math.sin(t * 4) * 0.1})`); }
  g.restore();
  if (m.frozen) D.circle(g, m.x, m.y, r + 4, 'rgba(186,230,253,.4)', '#e0f2fe', 2);
  if (m.stun) D.text(g, '💫', m.x, m.y - r - 22, { size: 14, stroke: false });
  if (m.hp < 100 || m.aggro) { D.bar(g, m.x - r, m.y - r - 12, r * 2, 4, m.hp / 100, '#ef4444'); D.text(g, `${M.name} ${M.lvl}`, m.x, m.y - r - 20, { size: 10, color: m.aggro ? '#fca5a5' : '#e7e5e4' }); }
}
function drawDragon(g, m, t) {
  const r = 64, flap = Math.sin(t * 4) * 0.4;
  D.shadow(g, m.x, m.y + 60, 90, 30, 0.4);
  g.save(); g.translate(m.x, m.y); g.rotate(m.a);
  for (const s of [-1, 1]) { g.save(); g.scale(1, s); g.rotate(flap); g.fillStyle = '#7f1d1d'; g.beginPath(); g.moveTo(-10, 20); g.lineTo(-60, 130); g.lineTo(10, 100); g.lineTo(40, 120); g.lineTo(30, 20); g.fill(); g.restore(); }
  g.strokeStyle = '#991b1b'; g.lineWidth = 22; g.lineCap = 'round'; g.beginPath(); g.moveTo(-40, 0); g.quadraticCurveTo(-110, Math.sin(t * 3) * 40, -150, 0); g.stroke();
  D.circle(g, 0, 0, r * 0.8, '#b91c1c', '#450a0a', 3);
  D.circle(g, 60, 0, 30, '#dc2626', '#450a0a', 3);
  for (const s of [-1, 1]) { g.fillStyle = '#fde68a'; g.beginPath(); g.moveTo(60, s * 18); g.lineTo(52, s * 42); g.lineTo(70, s * 20); g.fill(); D.circle(g, 72, s * 10, 4, '#fde047'); }
  g.restore();
  if (m.frozen) D.circle(g, m.x, m.y, 80, 'rgba(186,230,253,.3)');
}

function frame(dt, now) {
  if (!S) return;
  const t = now / 1000, heroes = hint.all(), me = heroes.find(h => h.id === api.myId);
  if (me) stage.follow(me.x, me.y, dt, 6, 1);
  if (me && !typing && !modal) sender.push(input.state(me.x, me.y));
  else if (me) sender.push({ u: false, d: false, l: false, r: false, a: 0, f: false, f2: false, x: 0, y: 0 });
  parts.update(dt); floats.update(dt);
  const g = stage.g;
  stage.begin(dt);
  g.fillStyle = '#1f2d17'; const v = stage.view(); g.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  g.drawImage(ground, 0, 0, ST.W, ST.H);
  // PNJ
  for (const n of ST.world.npcs) { D.shadow(g, n.x, n.y + 18, 18, 7); D.text(g, n.icon, n.x, n.y, { size: 38, stroke: false }); D.text(g, n.name, n.x, n.y - 34, { size: 12, color: '#fde68a' }); if (n.role !== 'heal') D.text(g, '❗', n.x, n.y - 54 + Math.sin(t * 3) * 3, { size: 18, stroke: false }); }
  for (const [, x, y, k] of S.drops) { D.circle(g, x, y, 14, 'rgba(255,255,255,.2)'); D.text(g, k === 'potion' ? '🧪' : '💧', x, y + Math.sin(t * 4) * 2, { size: 18, stroke: false }); }
  // tri en profondeur : obstacles + personnages
  const list = [];
  for (const o of ST.world.obs) if (o.x + o.w > v.x0 - 60 && o.x < v.x1 + 60 && o.y + o.h > v.y0 - 60 && o.y < v.y1 + 60) list.push({ y: o.y + o.h, d: () => drawObs(g, o, t) });
  for (const m of mint.all()) list.push({ y: m.y + 10, d: () => drawMob(g, m, t) });
  for (const h of heroes) list.push({ y: h.y + 10, d: () => drawHero(g, h, t, S.chat) });
  list.sort((a, b) => a.y - b.y).forEach(o => o.d());
  // projectiles
  for (const [, x, y, k, a] of S.shots) {
    if (k === 'arrow' || k === 'arrowE') { g.strokeStyle = k === 'arrow' ? '#fef3c7' : '#a3e635'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - Math.cos(a) * 16, y - Math.sin(a) * 16); g.lineTo(x, y); g.stroke(); }
    else { const col = { fireball: ['#fde047', '#f97316'], holy: ['#fffbeb', '#facc15'], shadow: ['#e9d5ff', '#7e22ce'], fire: ['#fde047', '#dc2626'] }[k] || ['#fff', '#999']; const gr = g.createRadialGradient(x, y, 0, x, y, 14); gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1] + '00'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 14, 0, 7); g.fill(); if (Math.random() < 0.5) parts.burst(x, y, { n: 1, color: col, speed: 30, life: 0.3, size: 4, glow: true }); }
  }
  parts.draw(g); floats.draw(g);
  // obscurité de la crypte et de l'antre
  stage.screen();
  if (me) { const z = ST.zones.find(z => me.x > z.x && me.x < z.x + z.w && me.y > z.y && me.y < z.y + z.h); if (z && (z.color === 'dungeon' || z.color === 'swamp')) { const sc = stage.toScreen(me.x, me.y); D.darkness(g, stage.w, stage.h, z.color === 'dungeon' ? 0.6 : 0.3, [{ x: sc.x, y: sc.y, r: 330 * stage.cam.zoom }]); } }
  renderHud(me);
  drawMini(me);
}

const set = (k, html) => { const el = ui[k]; if (el && el._h !== html) { el._h = html; el.innerHTML = html; } };
function renderHud(meI) {
  const m = S.me;
  if (!S.picking) pickSent = false;
  if (S.picking && !modal && !pickSent) openClassPick();
  if (!m) return;
  const C = ST.classes[m.cls];
  set('me', `<div class="portrait">${C.icon}<b>${m.lvl}</b></div><div class="fq-bars">
    <div class="fq-bar"><b style="width:${m.hp / m.maxHp * 100}%;background:linear-gradient(90deg,#b91c1c,#ef4444)"></b><span>${m.hp} / ${m.maxHp}</span></div>
    <div class="fq-bar"><b style="width:${m.mp / m.maxMp * 100}%;background:linear-gradient(90deg,#1d4ed8,#60a5fa)"></b><span>${m.mp} / ${m.maxMp}</span></div>
    <div style="font-size:12px;font-weight:700">💰 ${m.gold} · ⚔️ ${m.atk} · 🛡️ ${m.def}</div></div>`);
  ui.xp.firstChild.style.width = `${m.xp / m.next * 100}%`;
  const sk = (key, icon, label, cd, mp, nomp) => `<div class="fq-sk ${nomp ? 'nomp' : ''}" data-sk="${key}" title="${esc(label)}"><kbd>${key === 'atk' ? 'Clic' : key === 'q' ? 'A' : key === 'e' ? 'E' : key}</kbd>${icon}${mp ? `<small style="color:#93c5fd">${mp}</small>` : ''}${cd > 0 ? `<div class="cd">${Math.ceil(cd)}</div>` : ''}</div>`;
  const kicon = { guerrier: ['⚔️', '🌀', '💨'], mage: ['🔥', '❄️', '✨'], archer: ['🏹', '🌧️', '🤸'], clerc: ['☀️', '💚', '🛡️'] }[m.cls];
  set('skills', sk('atk', kicon[0], 'Attaque', 0) + sk('q', kicon[1], C.q.name + ' : ' + C.q.desc, m.cdQ, C.q.mp, m.mp < C.q.mp) + sk('e', kicon[2], C.e.name + ' : ' + C.e.desc, m.cdE, C.e.mp, m.mp < C.e.mp)
    + `<div class="fq-sk" data-sk="1" title="Potion de vie"><kbd>1</kbd>🧪<small>${m.potions}</small></div><div class="fq-sk" data-sk="2" title="Potion de mana"><kbd>2</kbd>💧<small>${m.ethers}</small></div>`);
  set('quest', `<div class="gk-panel"><h4>📜 Quête</h4>${m.quest ? `${esc(m.quest.text)}<div class="fq-bar" style="margin-top:6px"><b style="width:${m.quest.p / m.quest.n * 100}%;background:#ca8a04"></b><span>${m.quest.p} / ${m.quest.n}</span></div>` : '🏆 Toutes les quêtes sont terminées !'}
    <h4 style="margin-top:8px">👥 Groupe</h4>${S.heroes.map(h => `<div>${ST.classes[h.cls].icon} ${esc(h.name)} <small>Nv ${h.lvl}</small>${h.dead ? ' 🪦' : ''}</div>`).join('')}</div>`);
  if (m.zone !== lastZone) { lastZone = m.zone; const z = ST.zones.find(z => z.name === m.zone); ui.zone.innerHTML = `<div class="fq-zone">${esc(m.zone)}${z?.lvl ? `<div style="font-size:14px">Niveau ${z.lvl}</div>` : ''}</div>`; }
  ui.boss.style.display = S.boss?.alive && S.boss.near ? '' : 'none';
  if (S.boss?.alive && S.boss.near) set('boss', `🐉 DRAGON ANCIEN<div class="fq-bar"><b style="width:${S.boss.hp / S.boss.max * 100}%"></b><span>${Math.ceil(S.boss.hp)} / ${S.boss.max}</span></div>`);
  ui.dead.style.display = m.dead ? '' : 'none';
  if (m.dead) set('dead', `<div><h1>Vous êtes tombé…</h1><p>Retour au village dans ${m.dead} s</p></div>`);
  // interaction PNJ
  const npc = meI && ST.world.npcs.find(n => n.role !== 'heal' && Math.hypot(n.x - meI.x, n.y - meI.y) < 140);
  ui.talk.style.display = npc && !modal ? '' : 'none';
  if (npc) set('talk', `<kbd>F</kbd> Parler à ${esc(npc.name)}`);
  if (modal === 'shop') renderShop();
}
function drawMini(me) {
  const c = ui.mini, g = c.getContext('2d'), k = c.width / ST.W;
  g.drawImage(ground, 0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(255,255,255,.3)'; for (const z of ST.zones) g.strokeRect(z.x * k, z.y * k, z.w * k, z.h * k);
  if (S.boss?.alive) D.text(g, '🐉', 3500 * k, 500 * k, { size: 12, stroke: false });
  for (const h of S.heroes) { g.fillStyle = h.color; g.beginPath(); g.arc(h.x * k, h.y * k, h.id === api.myId ? 4 : 3, 0, 7); g.fill(); }
  if (me) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(me.x * k, me.y * k, 5, 0, 7); g.stroke(); }
}

// ---------- Fenêtres ----------
function closeModal() { modal = null; ui.modal.innerHTML = ''; ui.modal.style.display = 'none'; }
function openClassPick() {
  modal = 'class'; ui.modal.style.display = '';
  ui.modal.innerHTML = `<div class="fq-modal"><div class="fq-box"><h2>⚔️ Choisissez votre classe</h2><p>Votre aventure commence au village de Clairval. Un dragon menace le royaume…</p>
    <div class="fq-classes">${Object.entries(ST.classes).map(([k, c]) => `<button class="fq-class" data-c="${k}"><span class="ic">${c.icon}</span><b>${c.name}</b>
      <small>❤️ ${c.hp} · 💧 ${c.mp} · ⚔️ ${c.atk} · 🛡️ ${c.def}<br>${c.kind === 'melee' ? 'Corps à corps' : 'À distance'}<br><b style="font-size:12px;color:#fde68a">A</b> ${c.q.name}<br><b style="font-size:12px;color:#fde68a">E</b> ${c.e.name}</small></button>`).join('')}</div></div></div>`;
  ui.modal.querySelectorAll('[data-c]').forEach(b => { b.onclick = () => { api.send({ type: 'pick', cls: b.dataset.c }); pickSent = true; sfx.play('level'); closeModal(); }; });
}
function renderShop() {
  const m = S.me, SH = ST.shop;
  const html = `<div class="fq-modal"><div class="fq-box"><h2>🧙‍♀️ Marchande Rose</h2><p>« Bienvenue, aventurier ! Que puis-je pour vous ? » — 💰 ${m.gold} or</p>
    <div class="fq-items">${Object.entries(SH).map(([k, it]) => { const lvl = k === 'arme' ? m.weapon : k === 'armure' ? m.armor : 0; const price = it.base ? Math.round(it.base * Math.pow(1.7, lvl)) : it.price; const max = it.max && lvl >= it.max;
      return `<button class="fq-item" data-b="${k}" ${max || m.gold < price ? 'style="opacity:.5"' : ''}><div style="font-size:28px">${it.icon}</div><b>${esc(it.name)}</b><div style="font-size:12px;color:#a8a29e">${esc(it.desc)}${it.max ? ` · niv. ${lvl}/${it.max}` : ''}</div><div class="p">${max ? 'MAX' : price + ' or'}</div></button>`; }).join('')}</div>
    <div style="margin-top:12px;text-align:right"><button class="gk-btn" data-x>Fermer (Échap)</button></div></div></div>`;
  if (ui.modal._h === html) return; ui.modal._h = html; ui.modal.innerHTML = html;
  ui.modal.querySelectorAll('[data-b]').forEach(b => { b.onclick = () => api.send({ type: 'buy', item: b.dataset.b }); });
  ui.modal.querySelector('[data-x]').onclick = closeModal;
}
function openQuest() {
  modal = 'quest'; ui.modal.style.display = '';
  const q = S.me.quest;
  ui.modal.innerHTML = `<div class="fq-modal"><div class="fq-box"><h2>💂 Capitaine Aldric</h2>
    <p>${q ? `« Le royaume a besoin de vous. Votre mission : <b>${esc(q.text)}</b>. Progression : ${q.p} / ${q.n}. Revenez plus fort ! »` : '« Vous avez sauvé le royaume ! Les bardes chanteront votre nom pour l’éternité. »'}</p>
    <p style="color:#a8a29e;font-size:13px">Les quêtes se valident automatiquement. Zones : Bois des Lucioles (Nv 1-2) → Plaines Dorées (Nv 2-4) → Marais (Nv 1-6) → Crypte (Nv 6-9) → Antre du Dragon (Nv 8-12).</p>
    <div style="text-align:right"><button class="gk-btn primary" data-x>En route !</button></div></div></div>`;
  ui.modal.querySelector('[data-x]').onclick = closeModal;
}

export default {
  mount(r, a) {
    api = a; ST = a.static; lastZone = ''; modal = null; typing = false;
    sh = shell(r, api, { title: 'Fantasy Quest', icon: '🐉', overlay: true });
    stage = new Stage(sh.main, { bg: '#1f2d17' });
    parts = new Particles(); floats = new Floaters(); hint = new Interp(80); mint = new Interp(80); sender = new InputSender(api);
    renderGround();
    ui.hud = hud(sh.main, `<div class="me"></div><div class="fq-xp"><b></b></div><div class="fq-skills"></div><div class="fq-quest"></div><div class="zonew"></div><canvas class="fq-mini" width="200" height="143"></canvas>
      <div class="fq-boss" style="display:none"></div><div class="fq-dead" style="display:none"></div><div class="fq-talk" style="display:none"></div>
      <div class="fq-chat"><div class="log"></div><input placeholder="Entrée pour discuter…" maxlength="140"></div><div class="modalw" style="display:none"></div>`);
    ui.hud.classList.add('fq-hud');
    const q = s => ui.hud.querySelector(s);
    Object.assign(ui, { me: q('.me'), xp: q('.fq-xp'), skills: q('.fq-skills'), quest: q('.fq-quest'), zone: q('.zonew'), mini: q('.fq-mini'), boss: q('.fq-boss'), dead: q('.fq-dead'), talk: q('.fq-talk'), modal: q('.modalw'), chatLog: q('.fq-chat .log'), chatIn: q('.fq-chat input') });
    ui.chatIn.addEventListener('focus', () => { typing = true; });
    ui.chatIn.addEventListener('blur', () => { typing = false; });
    ui.chatIn.addEventListener('keydown', e => { if (e.key === 'Enter') { if (ui.chatIn.value.trim()) api.send({ type: 'say', text: ui.chatIn.value }); ui.chatIn.value = ''; ui.chatIn.blur(); } if (e.key === 'Escape') ui.chatIn.blur(); e.stopPropagation(); });
    ui.skills.addEventListener('click', e => { const k = e.target.closest('[data-sk]')?.dataset.sk; if (k === 'q' || k === 'e') { const w = input.world(); api.send({ type: 'ab', k, x: w.x, y: w.y }); } if (k === '1') api.send({ type: 'potion', k: 'hp' }); if (k === '2') api.send({ type: 'potion', k: 'mp' }); });
    input = new Input(stage, {
      onKey: (code) => {
        if (typing) return;
        if (code === 'Enter') { ui.chatIn.focus(); return; }
        if (code === 'Escape' && modal && modal !== 'class') { closeModal(); return; }
        if (modal) return;
        const w = input.world();
        if (code === 'KeyQ') api.send({ type: 'ab', k: 'q', x: w.x, y: w.y });
        if (code === 'KeyE') api.send({ type: 'ab', k: 'e', x: w.x, y: w.y });
        if (code === 'Digit1') api.send({ type: 'potion', k: 'hp' });
        if (code === 'Digit2') api.send({ type: 'potion', k: 'mp' });
        if (code === 'KeyF') { const me = S?.heroes.find(h => h.id === api.myId); const npc = me && ST.world.npcs.find(n => n.role !== 'heal' && Math.hypot(n.x - me.x, n.y - me.y) < 140); if (npc?.role === 'shop') { modal = 'shop'; ui.modal.style.display = ''; ui.modal._h = ''; renderShop(); } if (npc?.role === 'quest') openQuest(); sfx.play('click'); }
      },
    });
    stop = loop(frame);
  },
  update(s) {
    S = s; hint.push(s.heroes, ['x', 'y']); mint.push(s.mobs, ['x', 'y']);
    const lg = s.chat.map(c => `<div><b style="color:${c.color}">${esc(c.name)}</b> ${esc(c.text)}</div>`).join('');
    if (ui.chatLog && ui.chatLog._h !== lg) { ui.chatLog._h = lg; ui.chatLog.innerHTML = lg; ui.chatLog.scrollTop = 1e6; }
  },
  event(e) {
    const mine = e.id === api.myId;
    switch (e.type) {
      case 'dmg': floats.add(e.x + (Math.random() - 0.5) * 20, e.y, e.crit ? `${e.n}!` : `${e.n}`, e.crit ? '#fde047' : '#fff', e.crit ? 20 : 15); parts.burst(e.x, e.y + 10, { n: 4, color: '#fca5a5', speed: 100, life: 0.3, size: 3 }); sfx.play('hit', 0.25); break;
      case 'hurt': floats.add(e.x, e.y, `-${e.n}`, '#f87171', 15); if (mine) { sfx.play('hurt', 0.5); stage.shake(4); } break;
      case 'heal': floats.add(e.x, e.y, `+${e.n}`, '#4ade80', 16); parts.burst(e.x, e.y + 20, { n: 12, color: ['#bbf7d0', '#fde047'], speed: 60, life: 0.8, size: 3, grav: -80, glow: true }); sfx.play('magic', 0.5); break;
      case 'mobDie': parts.burst(e.x, e.y, { n: e.t === 'dragon' ? 120 : 16, color: e.t === 'slime' ? ['#4ade80', '#bbf7d0'] : e.t === 'squelette' ? ['#f5f5f4', '#a8a29e'] : ['#7f1d1d', '#dc2626'], speed: 180, life: 0.6, size: 4 }); if (e.by === api.myId) floats.add(e.x, e.y - 30, `+${e.gold} or`, '#fde047', 14); break;
      case 'swing': sfx.play('swing', mine ? 0.6 : 0.2); parts.burst(e.x + Math.cos(e.a) * 40, e.y + Math.sin(e.a) * 40, { n: 6, color: '#e2e8f0', speed: 160, life: 0.15, size: 3, dir: e.a, spread: 1.6 }); break;
      case 'cast': if (mine) sfx.play(e.k === 'arrow' ? 'arrow' : 'magic', 0.4); break;
      case 'boom': parts.burst(e.x, e.y, { n: 22, color: ['#fde047', '#f97316', '#dc2626'], speed: 220, life: 0.45, size: 6, glow: true }); sfx.play('boom', 0.3); break;
      case 'ability': {
        sfx.play('magic', mine ? 0.8 : 0.3);
        const col = { guerrier_q: ['#e2e8f0', '#94a3b8'], mage_q: ['#e0f2fe', '#7dd3fc'], clerc_q: ['#bbf7d0', '#fde047'], clerc_e: ['#fef3c7', '#fde047'] }[e.key];
        if (col) parts.burst(e.x, e.y, { n: 40, color: col, speed: 320, life: 0.5, size: 5, glow: true });
        if (e.key === 'guerrier_e' || e.key === 'archer_e') parts.burst(e.x, e.y, { n: 12, color: '#d6d3d1', speed: 100, life: 0.4, size: 5 });
        break;
      }
      case 'blink': parts.burst(e.x, e.y, { n: 24, color: ['#c084fc', '#f0abfc'], speed: 160, life: 0.5, size: 4, glow: true }); break;
      case 'level': parts.burst(e.x, e.y, { n: 60, color: ['#fde047', '#facc15', '#fff'], speed: 260, life: 1, size: 4, grav: -100, glow: true }); floats.add(e.x, e.y - 60, `NIVEAU ${e.lvl} !`, '#fde047', 24); if (mine) sfx.play('level'); break;
      case 'questDone': api.toast(`📜 Quête accomplie : ${e.text} (+${e.xp} XP, +${e.gold} or)`); sfx.play('win'); break;
      case 'heroDie': if (mine) { sfx.play('die'); } else api.toast(`🪦 ${e.name} est tombé au combat`); break;
      case 'boss': api.toast(`🐉 Le ${e.name} a été terrassé ! Gloire aux héros !`); sfx.play('win'); stage.shake(20); break;
      case 'roar': sfx.play('zombie', 1, 0.5); stage.shake(10); break;
      case 'bite': if (Math.random() < 0.5) sfx.play('bump', 0.25); break;
      case 'loot': sfx.play('pickup', 0.5); break;
      case 'drink': if (mine) sfx.play('good', 0.6); break;
      case 'bought': sfx.play('buy'); break;
      case 'joined': api.toast(`⚔️ ${e.name} rejoint l’aventure !`); break;
    }
  },
  unmount() { stop?.(); input?.destroy(); stage?.destroy(); S = null; ui = {}; },
};
