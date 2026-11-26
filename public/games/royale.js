// =====================================================================
//  MINI BATTLE ROYALE — affichage (navigateur)
// =====================================================================
import { shell, endScreen, sfx, esc, css, Stage, Input, InputSender, Interp, Particles, Floaters, loop, D, hud, clamp } from '../lib/kit.js';

const WICON = { pistolet: '🔫', smg: '🔫', pompe: '💥', fusil: '🎯', sniper: '🔭' };
const RARITY = ['#9ca3af', '#22c55e', '#3b82f6', '#a855f7'];
const IICON = { bandage: '🩹', medkit: '🧰', armor1: '🦺', armor2: '🛡️', ammo: '📦' };
css('br-css', `
.br-hud .tl { position:absolute; left:14px; top:62px; display:flex; flex-direction:column; gap:8px; }
.br-hud .feed { position:absolute; right:14px; top:62px; display:flex; flex-direction:column; gap:4px; align-items:flex-end; }
.br-hud .feed div { background:rgba(0,0,0,.6); padding:4px 10px; border-radius:8px; font-size:13px; animation: brin .2s; }
@keyframes brin { from { transform: translateX(20px); opacity:0; } }
.br-big { font-family:'Space Grotesk'; font-size:30px; font-weight:700; }
.br-hud .bl { position:absolute; left:14px; bottom:14px; width:280px; }
.br-hud .br { position:absolute; right:14px; bottom:14px; text-align:right; }
.br-bar { height:16px; border-radius:8px; background:rgba(0,0,0,.6); overflow:hidden; margin-top:6px; position:relative; border:1px solid rgba(255,255,255,.15); }
.br-bar b { display:block; height:100%; transition:width .2s; } .br-bar span { position:absolute; inset:0; display:grid; place-items:center; font-size:11px; font-weight:800; text-shadow:0 1px 2px #000; }
.br-slots { display:flex; gap:8px; justify-content:flex-end; }
.br-slot { width:120px; padding:8px; border-radius:12px; background:rgba(0,0,0,.6); border:2px solid rgba(255,255,255,.12); text-align:left; }
.br-slot.on { border-color:#facc15; } .br-slot b { display:block; font-size:13px; } .br-slot small { color:#cbd5e1; }
.br-ammo { font-family:'Space Grotesk'; font-size:38px; font-weight:700; margin-top:6px; } .br-ammo small { font-size:16px; opacity:.6; }
.br-meds { display:flex; gap:10px; margin-top:8px; font-size:14px; font-weight:700; }
.br-center { position:absolute; left:50%; top:24%; transform:translateX(-50%); text-align:center; text-shadow:0 2px 10px #000; }
.br-center .big { font-family:'Space Grotesk'; font-size:46px; font-weight:700; }
.br-pick { position:absolute; left:50%; bottom:140px; transform:translateX(-50%); background:rgba(0,0,0,.7); padding:8px 16px; border-radius:12px; font-weight:700; }
.br-mini { position:absolute; right:14px; bottom:130px; border-radius:12px; border:1px solid rgba(255,255,255,.25); }
.br-heal { position:absolute; left:50%; top:58%; transform:translateX(-50%); width:160px; height:8px; border-radius:4px; background:rgba(0,0,0,.6); overflow:hidden; }
.br-heal b { display:block; height:100%; background:#22c55e; }
@media (max-width:700px) { .br-mini { display:none; } .br-slot { width:90px; } }
`);

let api, ST, S, sh, stage, input, sender, stop, parts, floats, pint, ui = {}, terrain, endShown = false, feed = [];

function noise(g, x, y, w, h, n, a) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * a})`; g.fillRect(x + Math.random() * w, y + Math.random() * h, 2 + Math.random() * 3, 2 + Math.random() * 3); } }
function renderTerrain() {
  const S = ST.S; terrain = document.createElement('canvas'); terrain.width = S; terrain.height = S;
  const g = terrain.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.75); gr.addColorStop(0, '#4d7c3a'); gr.addColorStop(1, '#3d6b2e');
  g.fillStyle = gr; g.fillRect(0, 0, S, S); noise(g, 0, 0, S, S, S * S / 120, 0.08);
  // touffes d'herbe et fleurs
  for (let i = 0; i < S * S / 6000; i++) { const x = Math.random() * S, y = Math.random() * S; g.fillStyle = Math.random() < 0.1 ? ['#fde047', '#f9a8d4', '#ffffff'][i % 3] : 'rgba(30,60,20,.5)'; g.fillRect(x, y, 3, 3); }
  // chemins
  g.strokeStyle = '#8b7355'; g.lineWidth = 34; g.lineCap = 'round';
  for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(Math.random() * S, 0); g.bezierCurveTo(Math.random() * S, S / 3, Math.random() * S, S * 2 / 3, Math.random() * S, S); g.stroke(); }
  g.strokeStyle = '#a08a66'; g.lineWidth = 20; g.stroke();
  for (const d of ST.deco) if (d.kind === 'lake') {
    g.fillStyle = '#d6c08f'; g.beginPath(); g.ellipse(d.x, d.y, d.r * 1.35 + 18, d.r + 18, 0.3, 0, 7); g.fill();
    const lg = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 1.3); lg.addColorStop(0, '#1e40af'); lg.addColorStop(1, '#3b82f6');
    g.fillStyle = lg; g.beginPath(); g.ellipse(d.x, d.y, d.r * 1.35, d.r, 0.3, 0, 7); g.fill();
  }
  for (const o of ST.obs) {
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(o.x + 10, o.y + 12, o.w, o.h);
    if (o.kind === 'house') {
      const roof = ['#9a3412', '#7c2d12', '#1e3a8a', '#365314', '#57534e'][o.hue];
      g.fillStyle = roof; g.fillRect(o.x, o.y, o.w, o.h);
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2;
      for (let y = o.y + 10; y < o.y + o.h; y += 12) { g.beginPath(); g.moveTo(o.x, y); g.lineTo(o.x + o.w, y); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(o.x, o.y, o.w, o.h / 2);
      g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(o.x, o.y + o.h / 2); g.lineTo(o.x + o.w, o.y + o.h / 2); g.stroke(); g.strokeRect(o.x, o.y, o.w, o.h);
      g.fillStyle = '#57534e'; g.fillRect(o.x + o.w * 0.7, o.y + 8, 18, 22); // cheminée
    } else if (o.kind === 'rock') {
      g.fillStyle = '#78716c'; g.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28, r = o.w / 2 * (0.8 + ((k * 37) % 10) / 40); g.lineTo(o.x + o.w / 2 + Math.cos(a) * r, o.y + o.h / 2 + Math.sin(a) * r); } g.fill();
      g.fillStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.arc(o.x + o.w * 0.4, o.y + o.h * 0.38, o.w * 0.2, 0, 7); g.fill();
    } else { D.rrect(g, o.x, o.y, o.w, o.h, 4, '#a16207'); g.strokeStyle = '#713f12'; g.lineWidth = 4; g.strokeRect(o.x + 4, o.y + 4, o.w - 8, o.h - 8); g.beginPath(); g.moveTo(o.x + 4, o.y + 4); g.lineTo(o.x + o.w - 4, o.y + o.h - 4); g.stroke(); }
  }
}

function drawPlayer(g, p) {
  D.shadow(g, p.x + 4, p.y + 6, 18, 12);
  g.save(); g.translate(p.x, p.y); g.rotate(p.a);
  if (p.w) { const L = { pistolet: 18, smg: 26, pompe: 30, fusil: 34, sniper: 44 }[p.w]; D.rrect(g, 6, -4, L, 8, 3, '#1f2937', '#000', 1); }
  D.rrect(g, -12, -15, 20, 30, 10, p.color, 'rgba(0,0,0,.5)', 2);
  if (p.armor > 0) D.rrect(g, -9, -11, 13, 22, 6, p.armor >= 100 ? '#1e3a8a' : '#475569');
  D.circle(g, 14, 9, 5, '#e2b08a');
  D.circle(g, -1, 0, 9, '#e2b08a', '#0006', 1.5);
  D.circle(g, -3, 0, 7.5, p.bot ? '#525252' : '#3f2a1d');
  g.restore();
  if (p.prot) D.circle(g, p.x, p.y, 24, null, 'rgba(125,211,252,.7)', 2);
  D.text(g, p.name, p.x, p.y - 32, { size: 12, color: p.id === api.myId ? '#fde047' : p.bot ? '#d4d4d8' : '#fff' });
  D.bar(g, p.x - 20, p.y - 25, 40, 5, p.hp / 100, p.hp > 40 ? '#22c55e' : '#ef4444');
  if (p.healing) D.text(g, '✚', p.x + 24, p.y - 24, { size: 14, color: '#4ade80' });
}

function frame(dt, now) {
  if (!S) return;
  const t = now / 1000, players = pint.all();
  const meP = players.find(p => p.id === api.myId);
  const focus = meP || players.find(p => p.id === S.spec) || S.cam;
  stage.follow(focus.x, focus.y, dt, 7, 1.05);
  if (meP && S.me.alive) sender.push(input.state(meP.x, meP.y));
  parts.update(dt); floats.update(dt);
  const g = stage.g;
  stage.begin(dt);
  g.fillStyle = '#1e3a8a'; g.fillRect(-2000, -2000, ST.S + 4000, ST.S + 4000); // mer
  g.drawImage(terrain, 0, 0);
  // objets au sol
  for (const [id, x, y, kind, sub] of S.items) {
    const col = kind === 'weapon' ? RARITY[ST.weapons[sub].rarity] : '#e5e7eb';
    const gr = g.createRadialGradient(x, y, 0, x, y, 26); gr.addColorStop(0, col + 'aa'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 26, 0, 7); g.fill();
    D.circle(g, x, y, 15, 'rgba(0,0,0,.45)', col, 2);
    D.text(g, kind === 'weapon' ? WICON[sub] : IICON[sub], x, y + Math.sin(t * 3 + id) * 2, { size: 16, stroke: false });
  }
  for (const p of players) drawPlayer(g, p);
  g.lineCap = 'round';
  for (const [, x, y, a, sn] of S.bullets) { const L = sn ? 60 : 20; g.strokeStyle = sn ? 'rgba(186,230,253,.95)' : 'rgba(253,224,71,.9)'; g.lineWidth = sn ? 3 : 2; g.beginPath(); g.moveTo(x - Math.cos(a) * L, y - Math.sin(a) * L); g.lineTo(x, y); g.stroke(); }
  parts.draw(g);
  // arbres et buissons PAR-DESSUS (on peut s'y cacher)
  const v = stage.view();
  for (const d of ST.deco) {
    if (d.kind === 'lake' || d.x < v.x0 - 80 || d.x > v.x1 + 80 || d.y < v.y0 - 80 || d.y > v.y1 + 80) continue;
    const under = meP && Math.hypot(meP.x - d.x, meP.y - d.y) < d.r;
    g.globalAlpha = under ? 0.45 : 0.95;
    if (d.kind === 'tree') {
      D.circle(g, d.x + 12, d.y + 14, d.r, 'rgba(0,0,0,.25)');
      D.circle(g, d.x, d.y, d.r, '#14532d'); D.circle(g, d.x - d.r * 0.2, d.y - d.r * 0.2, d.r * 0.75, '#166534'); D.circle(g, d.x - d.r * 0.35, d.y - d.r * 0.35, d.r * 0.4, '#15803d');
    } else {
      for (let k = 0; k < 5; k++) D.circle(g, d.x + Math.cos(k * 1.3) * d.r * 0.45, d.y + Math.sin(k * 1.3) * d.r * 0.45, d.r * 0.55, k % 2 ? '#3f6212' : '#4d7c0f');
    }
    g.globalAlpha = 1;
  }
  floats.draw(g);
  // zone : extérieur teinté
  const z = S.zone;
  g.save(); g.beginPath(); g.rect(v.x0 - 50, v.y0 - 50, v.x1 - v.x0 + 100, v.y1 - v.y0 + 100); g.arc(z.x, z.y, Math.max(1, z.r), 0, 7, true);
  g.fillStyle = 'rgba(124,58,237,.28)'; g.fill('evenodd'); g.restore();
  D.circle(g, z.x, z.y, Math.max(1, z.r), null, 'rgba(196,181,253,.9)', 5);
  if (z.to && z.state === 'wait') { g.setLineDash([18, 14]); D.circle(g, z.to.x, z.to.y, Math.max(1, z.to.r), null, 'rgba(255,255,255,.8)', 3); g.setLineDash([]); }
  stage.screen();
  // dehors de la zone : vignette violette
  if (meP && Math.hypot(meP.x - z.x, meP.y - z.y) > z.r) { g.fillStyle = `rgba(124,58,237,${0.2 + Math.sin(t * 5) * 0.08})`; g.fillRect(0, 0, stage.w, stage.h); }
  renderHud(meP);
  drawMini(meP || focus);
}

const set = (k, html) => { const el = ui[k]; if (el._h !== html) { el._h = html; el.innerHTML = html; } };
function renderHud(meP) {
  const m = S.me, z = S.zone;
  set('tl', `<div class="gk-panel"><div class="br-big">👥 ${S.alive} <small style="font-size:14px">en vie</small></div><div>💀 ${m?.kills ?? 0} élimination(s)</div>
    <div style="margin-top:4px;color:${z.state === 'shrink' ? '#f0abfc' : '#e9d5ff'}">${z.state === 'shrink' ? `⚠️ La zone se resserre ! ${z.t}s` : `🌀 Zone ${z.stage} · rétrécit dans ${z.t}s`}</div></div>`);
  set('feed', feed.map(f => `<div>${f}</div>`).join(''));
  if (!m) return;
  if (m.alive) {
    set('bl', `<div class="br-bar"><b style="width:${m.hp}%;background:linear-gradient(90deg,#16a34a,#4ade80)"></b><span>❤️ ${m.hp}</span></div>
      <div class="br-bar"><b style="width:${m.armor}%;background:linear-gradient(90deg,#1d4ed8,#60a5fa)"></b><span>🛡️ ${m.armor}</span></div>
      <div class="br-meds"><span>🩹 ${m.meds.bandage} <kbd>H</kbd></span><span>🧰 ${m.meds.medkit} <kbd>J</kbd></span><span>📦 ${m.ammo}</span></div>`);
    const w = m.slots[m.cur];
    set('br', `<div class="br-slots">${m.slots.map((s, i) => `<div class="br-slot ${i === m.cur ? 'on' : ''}" style="${s ? `border-bottom:4px solid ${RARITY[ST.weapons[s.k].rarity]}` : ''}"><small>${i + 1}</small><b>${s ? `${WICON[s.k]} ${ST.weapons[s.k].name}` : 'Vide'}</b></div>`).join('')}</div>
      <div class="br-ammo">${w ? (m.reloadT > 0 ? '<span style="font-size:20px">Recharge…</span>' : w.mag) : '—'}<small> / ${m.ammo}</small></div>`);
    // objet ramassable
    let near = null, nd = 60;
    if (meP) for (const it of S.items) { const d = Math.hypot(it[1] - meP.x, it[2] - meP.y); if (d < nd) { nd = d; near = it; } }
    ui.pick.style.display = near ? '' : 'none';
    if (near) set('pick', `<kbd>E</kbd> Ramasser ${near[3] === 'weapon' ? `${WICON[near[4]]} ${ST.weapons[near[4]].name}` : `${IICON[near[4]]} ${ST.items[near[4]].name}`}`);
    ui.heal.style.display = m.healT > 0 ? '' : 'none';
    if (m.healT > 0) ui.heal.firstChild.style.width = `${(1 - m.healT / 4) * 100}%`;
    set('center', '');
  } else {
    set('bl', ''); set('br', ''); ui.pick.style.display = 'none'; ui.heal.style.display = 'none';
    const spec = ST.names[S.spec];
    if (!S.over) set('center', `<div class="big" style="color:#f87171">Éliminé — #${m.place}</div><div>${m.killer ? `par ${esc(ST.names[m.killer]?.name || '?')}` : 'par la zone'} · 👁 Vous regardez ${esc(spec?.name || '…')}</div>`);
  }
}
function drawMini(focus) {
  const c = ui.mini, g = c.getContext('2d'), k = c.width / ST.S;
  if (!ui.miniBg) { ui.miniBg = document.createElement('canvas'); ui.miniBg.width = c.width; ui.miniBg.height = c.height; ui.miniBg.getContext('2d').drawImage(terrain, 0, 0, c.width, c.height); }
  g.drawImage(ui.miniBg, 0, 0);
  const z = S.zone;
  g.save(); g.beginPath(); g.rect(0, 0, c.width, c.height); g.arc(z.x * k, z.y * k, z.r * k, 0, 7, true); g.fillStyle = 'rgba(124,58,237,.45)'; g.fill('evenodd'); g.restore();
  g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(z.x * k, z.y * k, Math.max(0.5, z.r * k), 0, 7); g.stroke();
  if (z.to) { g.setLineDash([4, 3]); g.beginPath(); g.arc(z.to.x * k, z.to.y * k, Math.max(0.5, z.to.r * k), 0, 7); g.stroke(); g.setLineDash([]); }
  g.fillStyle = '#facc15'; g.beginPath(); g.arc(focus.x * k, focus.y * k, 4, 0, 7); g.fill();
}

export default {
  mount(r, a) {
    api = a; ST = a.static; endShown = false; feed = [];
    sh = shell(r, api, { title: 'Mini Battle Royale', icon: '🪂', overlay: true });
    stage = new Stage(sh.main, { bg: '#1e3a8a' });
    parts = new Particles(); floats = new Floaters(); pint = new Interp(70); sender = new InputSender(api);
    renderTerrain();
    ui.hud = hud(sh.main, `<div class="tl"></div><div class="feed"></div><div class="bl"></div><div class="br"></div><div class="br-center"></div><div class="br-pick" style="display:none"></div>
      <div class="br-heal" style="display:none"><b></b></div><canvas class="br-mini" width="190" height="190"></canvas>`);
    ui.hud.classList.add('br-hud');
    const q = s => ui.hud.querySelector(s);
    Object.assign(ui, { tl: q('.tl'), feed: q('.feed'), bl: q('.bl'), br: q('.br'), center: q('.br-center'), pick: q('.br-pick'), heal: q('.br-heal'), mini: q('.br-mini') });
    input = new Input(stage, {
      onKey: c => {
        if (c === 'KeyE') api.send({ type: 'pick' });
        if (c === 'KeyR') api.send({ type: 'reload' });
        if (c === 'Digit1') api.send({ type: 'slot', i: 0 });
        if (c === 'Digit2') api.send({ type: 'slot', i: 1 });
        if (c === 'KeyH') api.send({ type: 'heal', item: 'bandage' });
        if (c === 'KeyJ') api.send({ type: 'heal', item: 'medkit' });
      },
      onWheel: () => api.send({ type: 'slot' }),
    });
    stop = loop(frame);
  },
  update(s) {
    S = s; pint.push(s.players, ['x', 'y', 'a']);
    if (s.over && !endShown) {
      endShown = true;
      const w = ST.names[s.winner];
      setTimeout(() => endScreen(sh.main, api, {
        title: s.winner === api.myId ? '🏆 VICTOIRE ROYALE !' : `👑 ${esc(w?.name || 'Personne')} gagne !`, sub: `${s.total} combattants`,
        rows: s.board.filter(p => !p.bot || p.place <= 5).sort((a, b) => a.place - b.place).map(p => ({ name: p.name, color: p.color, value: `#${p.place} · ${p.kills} élim.`, me: p.id === api.myId })), valueLabel: 'Classement',
      }), 1200);
    }
  },
  event(e) {
    const near = (x, y) => x == null ? 1 : clamp(1 - Math.hypot(x - stage.cam.x, y - stage.cam.y) / 1000, 0, 1);
    switch (e.type) {
      case 'shot': sfx.play(e.w === 'pompe' ? 'shotgun' : e.w === 'sniper' ? 'sniper' : e.w === 'smg' ? 'smg' : 'shot', near(e.x, e.y) * 0.6); parts.burst(e.x, e.y, { n: 4, color: ['#fff7ae', '#fbbf24'], speed: 200, life: 0.08, size: 5, dir: e.a, spread: 0.7, glow: true }); break;
      case 'spark': parts.burst(e.x, e.y, { n: 4, color: '#fde68a', speed: 150, life: 0.2, size: 2 }); break;
      case 'blood': parts.burst(e.x, e.y, { n: 8, color: ['#991b1b', '#dc2626'], speed: 160, life: 0.4, size: 3, dir: e.a, spread: 1 }); break;
      case 'hit': floats.add(stage.cam.x, stage.cam.y - 60, `${e.dmg}`, '#fde047', 16); sfx.play('hit', 0.6); break;
      case 'hurt': sfx.play('hurt', 0.5); stage.shake(5); break;
      case 'kill': {
        const k = ST.names[e.killer], v = ST.names[e.victim];
        feed.unshift(e.killer ? `<b style="color:${k?.color}">${esc(k?.name)}</b> ${WICON[e.weapon] || '💀'} <b style="color:${v?.color}">${esc(v?.name)}</b>` : `<b style="color:${v?.color}">${esc(v?.name)}</b> 🌀 ${e.weapon === 'leave' ? 'a quitté' : 'zone'}`);
        feed = feed.slice(0, 5); setTimeout(() => { feed.pop(); }, 7000);
        parts.burst(e.x, e.y, { n: 24, color: ['#991b1b', '#dc2626'], speed: 220, life: 0.7, size: 4 });
        if (e.killer === api.myId) { sfx.play('good'); floats.add(e.x, e.y - 30, '💀 Éliminé !', '#f87171', 20); }
        if (e.victim === api.myId) sfx.play('die');
        break;
      }
      case 'pick': sfx.play('pickup', 0.6); break;
      case 'healed': sfx.play('good'); break;
      case 'zone': sfx.play(e.state === 'shrink' ? 'bad' : 'tick'); api.toast(e.state === 'shrink' ? '⚠️ La zone se resserre !' : '🌀 Nouvelle zone affichée'); break;
      case 'win': sfx.play('win'); break;
    }
  },
  unmount() { stop?.(); input?.destroy(); stage?.destroy(); S = null; ui = {}; },
};
