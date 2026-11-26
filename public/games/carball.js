// =====================================================================
//  CAR FOOTBALL — affichage (navigateur)
// =====================================================================
import { shell, endScreen, sfx, esc, css, Stage, Input, InputSender, Interp, Particles, loop, D, hud, clamp } from '../lib/kit.js';

const TEAM = [{ name: 'Bleus', c: '#3b82f6', l: '#93c5fd' }, { name: 'Orange', c: '#f97316', l: '#fdba74' }];
css('cb-css', `
.cb-hud .score { position:absolute; left:50%; top:58px; transform:translateX(-50%); display:flex; align-items:stretch; border-radius:14px; overflow:hidden; box-shadow:0 8px 20px #0008; font-family:'Space Grotesk'; }
.cb-hud .score span { padding:6px 18px; font-size:34px; font-weight:700; } .cb-hud .score .b { background:#2563eb; } .cb-hud .score .o { background:#ea580c; }
.cb-hud .score .t { background:#0f172a; font-size:22px; display:grid; place-items:center; min-width:96px; }
.cb-hud .boost { position:absolute; right:22px; bottom:22px; width:110px; height:110px; }
.cb-hud .dash { position:absolute; right:140px; bottom:30px; font-weight:800; background:rgba(0,0,0,.55); padding:6px 12px; border-radius:10px; }
.cb-big { position:absolute; left:50%; top:36%; transform:translate(-50%,-50%); font-family:'Space Grotesk'; font-weight:700; text-align:center; text-shadow:0 6px 0 #000, 0 0 40px rgba(0,0,0,.5); pointer-events:none; animation: cbin .5s; }
@keyframes cbin { from { transform:translate(-50%,-50%) scale(2); opacity:0; } }
.cb-hud .help { position:absolute; left:16px; bottom:16px; font-size:12px; background:rgba(0,0,0,.5); padding:6px 10px; border-radius:10px; color:#cbd5e1; }
`);

let api, ST, S, sh, stage, input, sender, stop, parts, cint, ui = {}, pitch, endShown = false, big = { t: 0, html: '' }, trail = new Map(), ballRot = 0, bpos = { x: 0, y: 0 };

function renderPitch() {
  const { W, H, GOAL } = ST, M = 160;
  pitch = document.createElement('canvas'); pitch.width = W + M * 2; pitch.height = H + M * 2;
  const g = pitch.getContext('2d');
  // tribunes et public
  g.fillStyle = '#1e293b'; g.fillRect(0, 0, pitch.width, pitch.height);
  for (let i = 0; i < 5000; i++) {
    const side = Math.random(); let x, y;
    if (side < 0.5) { x = Math.random() * pitch.width; y = Math.random() < 0.5 ? Math.random() * (M - 40) : pitch.height - Math.random() * (M - 40); }
    else { y = Math.random() * pitch.height; x = Math.random() < 0.5 ? Math.random() * (M - 50) : pitch.width - Math.random() * (M - 50); }
    g.fillStyle = Math.random() < 0.5 ? (x < pitch.width / 2 ? '#60a5fa' : '#fb923c') : ['#f8fafc', '#fde047', '#e2e8f0', '#94a3b8'][i % 4];
    g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill();
  }
  g.translate(M, M);
  // pelouse rayée
  for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? '#2f8f46' : '#38a150'; g.fillRect(i * W / 14, 0, W / 14 + 1, H); }
  for (let i = 0; i < 14000; i++) { g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  // lignes
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 6;
  g.strokeRect(0, 0, W, H); g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
  g.beginPath(); g.arc(W / 2, H / 2, 160, 0, 7); g.stroke(); D.circle(g, W / 2, H / 2, 8, '#fff');
  for (const s of [0, 1]) { const x = s ? W - 300 : 0; g.strokeRect(x, H / 2 - 300, 300, 600); g.strokeRect(s ? W - 110 : 0, H / 2 - 180, 110, 360); g.beginPath(); g.arc(s ? W - 300 : 300, H / 2, 90, s ? Math.PI / 2 : -Math.PI / 2, s ? Math.PI * 1.5 : Math.PI / 2); g.stroke(); }
  // cages
  for (const s of [0, 1]) {
    const x = s ? W : -90, col = TEAM[1 - s].c;
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, H / 2 - GOAL / 2, 90, GOAL);
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5;
    for (let k = 0; k < 90; k += 12) { g.beginPath(); g.moveTo(x + k, H / 2 - GOAL / 2); g.lineTo(x + k, H / 2 + GOAL / 2); g.stroke(); }
    for (let k = 0; k < GOAL; k += 12) { g.beginPath(); g.moveTo(x, H / 2 - GOAL / 2 + k); g.lineTo(x + 90, H / 2 - GOAL / 2 + k); g.stroke(); }
    g.strokeStyle = col; g.lineWidth = 10; g.beginPath(); g.moveTo(s ? W : 0, H / 2 - GOAL / 2); g.lineTo(x + (s ? 90 : 0), H / 2 - GOAL / 2); g.lineTo(x + (s ? 90 : 0), H / 2 + GOAL / 2); g.lineTo(s ? W : 0, H / 2 + GOAL / 2); g.stroke();
  }
  // bandes publicitaires
  g.fillStyle = '#0f172a'; g.fillRect(-30, -30, W + 60, 22); g.fillRect(-30, H + 8, W + 60, 22);
  g.font = 'bold 15px Inter'; g.fillStyle = '#fde047'; for (let x = 40; x < W; x += 320) { g.fillText('SALLE DE JEUX', x, -14); g.fillText('⚽ CAR FOOTBALL', x + 160, H + 24); }
}

function drawCar(g, c, t) {
  if (c.demo) return;
  const team = TEAM[c.team];
  g.save(); g.translate(c.x, c.y); g.rotate(c.a);
  D.shadow(g, 4, 8, 34, 20, 0.35);
  for (const [wx, wy] of [[-18, -20], [18, -20], [-18, 20], [18, 20]]) D.rrect(g, wx - 9, wy - 5, 18, 10, 4, '#0b0b0b');
  D.rrect(g, -30, -18, 60, 36, 10, team.c, 'rgba(0,0,0,.55)', 2.5);
  D.rrect(g, -6, -14, 24, 28, 7, '#0f172a');
  D.rrect(g, 0, -11, 14, 22, 5, '#38bdf8');
  D.rrect(g, -28, -5, 22, 10, 4, team.l);
  D.rrect(g, 24, -15, 6, 9, 2, '#fef9c3'); D.rrect(g, 24, 6, 6, 9, 2, '#fef9c3');
  if (c.boosting) { const f = 18 + Math.random() * 16; g.fillStyle = 'rgba(251,146,60,.9)'; g.beginPath(); g.moveTo(-30, -9); g.lineTo(-30 - f, 0); g.lineTo(-30, 9); g.fill(); g.fillStyle = '#fef08a'; g.beginPath(); g.moveTo(-30, -4); g.lineTo(-30 - f * 0.6, 0); g.lineTo(-30, 4); g.fill(); }
  g.restore();
  if (c.dash) D.circle(g, c.x, c.y, 38, null, 'rgba(255,255,255,.7)', 3);
  D.text(g, c.name, c.x, c.y - 40, { size: 13, color: c.id === api.myId ? '#fde047' : '#fff' });
}

function frame(dt, now) {
  if (!S) return;
  const t = now / 1000, { W, H } = ST, M = 160;
  const cars = cint.all(), me = cars.find(c => c.id === api.myId);
  // ballon : extrapolation légère
  const b = S.ball; bpos.x += (b.x - bpos.x) * Math.min(1, dt * 18); bpos.y += (b.y - bpos.y) * Math.min(1, dt * 18);
  ballRot += Math.hypot(b.vx, b.vy) * dt / b.r;
  const fx = me ? me.x * 0.55 + bpos.x * 0.45 : bpos.x, fy = me ? me.y * 0.55 + bpos.y * 0.45 : bpos.y;
  stage.follow(clamp(fx, 300, W - 300), clamp(fy, 200, H - 200), dt, 5, 0.82);
  if (input) {
    const st = input.state(0, 0);
    sender.push({ u: st.u, d: st.d, l: st.l, r: st.r, boost: !!(input.raw.ShiftLeft || input.raw.ShiftRight || input.mouse.down2), dash: !!(input.raw.Space || input.mouse.down), a: 0 });
  }
  parts.update(dt);
  const g = stage.g;
  stage.begin(dt);
  g.drawImage(pitch, -M, -M);
  // pastilles de turbo
  for (const p of ST.pads) {
    const on = S.pads.includes(p.id), r = p.big ? 30 : 16;
    D.circle(g, p.x, p.y, r + 6, 'rgba(0,0,0,.25)');
    if (on) { const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 1.6); gr.addColorStop(0, 'rgba(253,186,116,1)'); gr.addColorStop(0.5, 'rgba(249,115,22,.7)'); gr.addColorStop(1, 'rgba(249,115,22,0)'); g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r * 1.6 + Math.sin(t * 5) * 3, 0, 7); g.fill(); D.circle(g, p.x, p.y, r * 0.6, '#fff7ed'); }
    else D.circle(g, p.x, p.y, r * 0.6, null, 'rgba(255,255,255,.25)', 2);
  }
  // traînées de turbo
  for (const c of cars) {
    const tr = trail.get(c.id) || []; if (c.boosting) tr.push({ x: c.x - Math.cos(c.a) * 30, y: c.y - Math.sin(c.a) * 30, t: 0.5 });
    for (const p of tr) p.t -= dt; const live = tr.filter(p => p.t > 0); trail.set(c.id, live);
    g.lineCap = 'round';
    for (let i = 1; i < live.length; i++) { g.strokeStyle = `rgba(253,186,116,${live[i].t})`; g.lineWidth = 14 * live[i].t * 2; g.beginPath(); g.moveTo(live[i - 1].x, live[i - 1].y); g.lineTo(live[i].x, live[i].y); g.stroke(); }
  }
  // ballon
  D.shadow(g, bpos.x + 6, bpos.y + b.r * 0.7, b.r, b.r * 0.45, 0.35);
  g.save(); g.translate(bpos.x, bpos.y); g.rotate(ballRot);
  D.circle(g, 0, 0, b.r, '#f8fafc', '#1f2937', 2.5);
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; g.fillStyle = '#1f2937'; g.beginPath(); for (let j = 0; j < 5; j++) { const aa = a + j / 5 * Math.PI * 2; g.lineTo(Math.cos(a) * b.r * 0.62 + Math.cos(aa) * b.r * 0.2, Math.sin(a) * b.r * 0.62 + Math.sin(aa) * b.r * 0.2); } g.fill(); }
  g.fillStyle = '#1f2937'; g.beginPath(); for (let j = 0; j < 5; j++) { const aa = j / 5 * Math.PI * 2; g.lineTo(Math.cos(aa) * b.r * 0.25, Math.sin(aa) * b.r * 0.25); } g.fill();
  g.restore();
  const gr = g.createRadialGradient(bpos.x - b.r * 0.4, bpos.y - b.r * 0.4, 0, bpos.x, bpos.y, b.r); gr.addColorStop(0, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(0,0,0,.15)'); g.fillStyle = gr; g.beginPath(); g.arc(bpos.x, bpos.y, b.r, 0, 7); g.fill();
  for (const c of cars) drawCar(g, c, t);
  // indicateur du ballon hors écran
  parts.draw(g);
  stage.screen();
  const sc = stage.toScreen(bpos.x, bpos.y);
  if (sc.x < 0 || sc.y < 0 || sc.x > stage.w || sc.y > stage.h) { const x = clamp(sc.x, 30, stage.w - 30), y = clamp(sc.y, 70, stage.h - 30); D.circle(g, x, y, 14, '#fff', '#000', 2); D.text(g, '⚽', x, y, { size: 16, stroke: false }); }
  renderHud();
}
const set = (k, html) => { const el = ui[k]; if (el._h !== html) { el._h = html; el.innerHTML = html; } };
function renderHud() {
  const m = Math.floor(S.time / 60), s = String(S.time % 60).padStart(2, '0');
  set('score', `<span class="b">${S.score[0]}</span><span class="t">${S.overtime ? '+ PROLONG.' : `${m}:${s}`}</span><span class="o">${S.score[1]}</span>`);
  const me = S.cars.find(c => c.id === api.myId);
  if (me) {
    const k = S.infinite ? 1 : me.boost / 100;
    set('boost', `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="rgba(0,0,0,.55)" stroke="rgba(255,255,255,.15)" stroke-width="8"/><circle cx="50" cy="50" r="42" fill="none" stroke="#fb923c" stroke-width="8" stroke-dasharray="${264 * k} 264" transform="rotate(-90 50 50)" stroke-linecap="round"/><text x="50" y="57" text-anchor="middle" font-size="26" font-weight="800" fill="#fff" font-family="Space Grotesk">${S.infinite ? '∞' : me.boost}</text></svg>`);
    set('dash', me.dashCd > 0 ? `Dash ${me.dashCd.toFixed(1)}s` : '⚡ Dash prêt');
  }
  if (S.phase === 'kickoff' && S.timer > 0) set('big', `<div class="cb-big" style="font-size:110px">${Math.ceil(S.timer)}</div>`);
  else if (big.t > 0) { big.t -= 1 / 60; set('big', big.html); } else set('big', '');
}

export default {
  mount(r, a) {
    api = a; ST = a.static; endShown = false; trail.clear();
    sh = shell(r, api, { title: 'Car Football', icon: '🚗', overlay: true });
    stage = new Stage(sh.main, { bg: '#0f172a' });
    parts = new Particles(); cint = new Interp(60); sender = new InputSender(api, 30);
    renderPitch();
    ui.hud = hud(sh.main, `<div class="score"></div><div class="boost"></div><div class="dash"></div><div class="bigwrap"></div><div class="help"><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> conduire · <kbd>Maj</kbd>/clic droit turbo · <kbd>Espace</kbd>/clic dash</div>`);
    ui.hud.classList.add('cb-hud');
    const q = s => ui.hud.querySelector(s);
    Object.assign(ui, { score: q('.score'), boost: q('.boost'), dash: q('.dash'), big: q('.bigwrap') });
    input = new Input(stage);
    stop = loop(frame);
  },
  update(s) {
    if (!S) { bpos = { x: s.ball.x, y: s.ball.y }; }
    S = s; cint.push(s.cars, ['x', 'y', 'a']);
    if (Math.hypot(s.ball.x - bpos.x, s.ball.y - bpos.y) > 300) bpos = { x: s.ball.x, y: s.ball.y };
    if (s.over && !endShown) {
      endShown = true;
      const me = s.cars.find(c => c.id === api.myId), win = s.score[0] > s.score[1] ? 0 : 1;
      setTimeout(() => endScreen(sh.main, api, { title: me ? (me.team === win ? '🏆 Victoire !' : '😢 Défaite…') : `Les ${TEAM[win].name} gagnent !`, sub: `Score final : ${s.score[0]} – ${s.score[1]}`,
        rows: s.cars.filter(c => !c.bot || c.goals).sort((a, b) => b.goals - a.goals || b.touches - a.touches).map(c => ({ name: c.name, color: TEAM[c.team].c, value: `${c.goals} ⚽ · ${c.touches} touches`, me: c.id === api.myId })), valueLabel: 'Buts' }), 1500);
    }
  },
  event(e) {
    switch (e.type) {
      case 'count': sfx.play('countdown'); break;
      case 'go': sfx.play('whistle'); big = { t: 1, html: '<div class="cb-big" style="font-size:90px;color:#4ade80">GO !</div>' }; break;
      case 'kick': sfx.play('kick', 0.4 + e.p * 0.6); parts.burst(e.x, e.y, { n: Math.round(6 + e.p * 14), color: ['#fff', '#d1fae5'], speed: 150 + e.p * 250, life: 0.35, size: 3 }); if (e.p > 0.6) stage.shake(e.p * 8); break;
      case 'goal': {
        sfx.play('goal'); stage.shake(22);
        const T = TEAM[e.team];
        parts.burst(e.x, e.y, { n: 140, color: [T.c, T.l, '#fff', '#fde047'], speed: 700, life: 1.4, size: 6, glow: true, drag: 1.5 });
        big = { t: 3, html: `<div class="cb-big" style="font-size:96px;color:${T.l}">BUUUT !</div><div class="cb-big" style="top:50%;font-size:26px">${e.scorer ? `${esc(e.scorer)}${e.own ? ' (contre son camp 😅)' : ''}` : ''}</div>` };
        break;
      }
      case 'pad': sfx.play('pickup', e.big ? 0.7 : 0.35); break;
      case 'dash': if (e.id === api.myId) sfx.play('jump'); break;
      case 'bump': sfx.play('bump', 0.4); parts.burst(e.x, e.y, { n: 8, color: '#fde68a', speed: 180, life: 0.25, size: 3 }); break;
      case 'demo': sfx.play('boom'); parts.burst(e.x, e.y, { n: 50, color: ['#fde047', '#f97316', '#ef4444', '#52525b'], speed: 400, life: 0.8, size: 7, glow: true }); stage.shake(10); if (e.victim === api.myId) api.toast('💥 Démoli ! Réapparition…'); if (e.by === api.myId) api.toast('💥 Démolition !'); break;
      case 'wall': sfx.play('bump', 0.25); break;
      case 'overtime': big = { t: 3, html: '<div class="cb-big" style="font-size:64px;color:#fde047">PROLONGATION !</div><div class="cb-big" style="top:50%;font-size:24px">Le prochain but gagne</div>' }; sfx.play('whistle'); break;
      case 'end': sfx.play('whistle'); break;
    }
  },
  unmount() { stop?.(); input?.destroy(); stage?.destroy(); S = null; ui = {}; },
};
