// =====================================================================
//  FALL RACE — affichage (navigateur)
// =====================================================================
import { shell, endScreen, sfx, esc, css, Stage, Input, InputSender, Interp, Particles, loop, D, hud, clamp } from '../lib/kit.js';

const WIDTH = 1000;
css('fr-css', `
.fr-hud .tl { position:absolute; left:14px; top:62px; } .fr-hud .tr { position:absolute; right:14px; top:62px; text-align:right; }
.fr-big { position:absolute; left:50%; top:34%; transform:translate(-50%,-50%); font-family:'Space Grotesk'; font-weight:700; text-align:center; color:#fff; text-shadow:0 6px 0 #be185d, 0 10px 30px rgba(0,0,0,.4); pointer-events:none; animation: frin .45s; }
@keyframes frin { from { transform:translate(-50%,-50%) scale(2.2) rotate(-8deg); opacity:0; } }
.fr-q { font-family:'Space Grotesk'; font-size:30px; font-weight:700; } .fr-prog { width:220px; height:10px; border-radius:5px; background:rgba(0,0,0,.4); overflow:hidden; margin-top:6px; } .fr-prog b { display:block; height:100%; background:linear-gradient(90deg,#f472b6,#facc15); }
.fr-res { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); background:rgba(30,10,40,.9); border-radius:22px; padding:20px 28px; min-width:320px; text-align:center; pointer-events:none; }
.fr-res h2 { margin:0 0 10px; } .fr-res .l { display:flex; flex-wrap:wrap; gap:6px; justify-content:center; max-width:480px; }
.fr-res .l span { padding:4px 10px; border-radius:999px; font-weight:700; font-size:13px; }
.fr-help { position:absolute; left:50%; bottom:14px; transform:translateX(-50%); font-size:12px; background:rgba(0,0,0,.4); padding:6px 12px; border-radius:999px; white-space:nowrap; }
`);

let api, S, C, sh, stage, input, sender, stop, parts, rint, ui = {}, endShown = false, big = { t: 0, html: '' }, clouds = [], floorC = null, myDone = false;

function renderFloor() {
  // pré-rendu du sol du parcours (hors éléments mobiles)
  const L = C.length + 400, top = C.finish - 300;
  floorC = document.createElement('canvas'); floorC.width = WIDTH + 80; floorC.height = Math.ceil(L - top);
  const g = floorC.getContext('2d'); g.translate(40, -top);
  // tuiles colorées par section
  const cols = [['#fde68a', '#fcd34d'], ['#bae6fd', '#7dd3fc'], ['#fbcfe8', '#f9a8d4'], ['#bbf7d0', '#86efac'], ['#ddd6fe', '#c4b5fd'], ['#fed7aa', '#fdba74'], ['#fecaca', '#fca5a5'], ['#a5f3fc', '#67e8f9']];
  for (let y = top; y < C.length + 100; y += 50) {
    const sec = Math.floor((C.start + 100 - y) / 760), [a, b] = cols[((sec % 8) + 8) % 8];
    for (let x = 0; x < WIDTH; x += 50) { g.fillStyle = ((x + y) / 50) % 2 ? a : b; g.fillRect(x, y, 50, 50); }
  }
  // épaisseur du sol (côtés)
  g.fillStyle = '#9d174d'; g.fillRect(-14, top, 14, C.length + 400 - top); g.fillRect(WIDTH, top, 14, C.length + 400 - top);
  // ligne d'arrivée
  for (let x = 0; x < WIDTH; x += 25) for (let k = 0; k < 3; k++) { g.fillStyle = ((x / 25 + k) % 2) ? '#111' : '#fff'; g.fillRect(x, C.finish - 25 + k * 25 - 40, 25, 25); }
  g.font = '800 64px Space Grotesk'; g.textAlign = 'center'; g.fillStyle = '#be185d'; g.fillText('ARRIVÉE', WIDTH / 2, C.finish - 120);
  // trous (vide)
  for (const v of C.voids) { g.clearRect(v.x - 1, v.y, v.w + 2, v.h); }
  for (const b of C.belts) { g.fillStyle = '#475569'; g.fillRect(b.x, b.y, b.w, b.h); g.strokeStyle = '#94a3b8'; g.lineWidth = 3; for (let x = b.x + 20; x < b.x + b.w; x += 60) for (let y = b.y + 20; y < b.y + b.h; y += 40) { g.beginPath(); g.moveTo(x - 10, y - 8); g.lineTo(x, y + 2); g.lineTo(x + 10, y - 8); g.stroke(); } }
  for (const z of C.slime) { g.fillStyle = 'rgba(132,204,22,.75)'; g.beginPath(); g.roundRect(z.x, z.y, z.w, z.h, 30); g.fill(); }
  for (const w of C.walls) if (w.h < 1000) { D.rrect(g, w.x, w.y, w.w, w.h, 6, '#7c3aed', '#4c1d95', 2); }
  // points de passage
  g.strokeStyle = 'rgba(255,255,255,.6)'; g.setLineDash([16, 12]); g.lineWidth = 4;
  for (const cy of C.checkpoints.slice(1)) { g.beginPath(); g.moveTo(0, cy); g.lineTo(WIDTH, cy); g.stroke(); }
  g.setLineDash([]);
  floorC.top = top;
}

function drawBean(g, r, t) {
  const h = r.air ? Math.sin((0.55 - r.air) / 0.55 * Math.PI) * 26 : 0;
  D.shadow(g, r.x, r.y + 12, 16 - h * 0.15, 8, 0.3);
  const y = r.y - h;
  const wob = Math.sin(t * 14 + r.x * 0.1) * (Math.abs(r.vx) + Math.abs(r.vy) > 40 ? 2 : 0.5);
  g.save(); g.translate(r.x, y); if (r.dive) g.rotate(Math.atan2(r.vy, r.vx) + Math.PI / 2);
  if (r.stun) g.rotate(Math.sin(t * 30) * 0.3);
  D.rrect(g, -14, -22 + wob * 0.3, 28, 38, 14, r.color, 'rgba(0,0,0,.35)', 2);
  D.rrect(g, -10, -14, 20, 13, 6, '#fff');
  D.circle(g, -4, -8, 2.6, '#111'); D.circle(g, 5, -8, 2.6, '#111');
  D.circle(g, -10, 12 + wob, 4, r.color, 'rgba(0,0,0,.35)', 1); D.circle(g, 10, 12 - wob, 4, r.color, 'rgba(0,0,0,.35)', 1);
  g.restore();
  if (r.stun) D.text(g, '💫', r.x, y - 32, { size: 14, stroke: false });
  D.text(g, r.name, r.x, y - 36 - (r.stun ? 12 : 0), { size: 11, color: r.id === api.myId ? '#fde047' : '#fff' });
}

function frame(dt, now) {
  if (!S || !C) return;
  const t = now / 1000, rs = rint.all(), me = rs.find(r => r.id === api.myId);
  const focus = me && !me.out && !me.done ? me : rs.filter(r => !r.out).sort((a, b) => a.y - b.y)[0] || me;
  if (focus) stage.follow(WIDTH / 2 + (focus.x - WIDTH / 2) * 0.3, focus.y - 120, dt, 5, Math.min(1.1, stage.w / 1150));
  if (input && me && !me.out && !me.done && S.phase !== 'results') {
    const st = input.state(0, 0);
    sender.push({ u: st.u, d: st.d, l: st.l, r: st.r, jump: !!input.raw.Space, dive: !!(input.raw.ShiftLeft || input.mouse.down), a: 0 });
  }
  parts.update(dt);
  const g = stage.g;
  stage.begin(dt);
  // ciel et nuages (sous le parcours)
  const v = stage.view();
  const sky = g.createLinearGradient(0, v.y0, 0, v.y1); sky.addColorStop(0, '#7dd3fc'); sky.addColorStop(1, '#c4b5fd');
  g.fillStyle = sky; g.fillRect(v.x0 - 10, v.y0 - 10, v.x1 - v.x0 + 20, v.y1 - v.y0 + 20);
  for (const c of clouds) { const x = ((c.x + t * c.s) % 2400) - 700, y = c.y + stage.cam.y * 0.6; g.globalAlpha = 0.7; for (let k = 0; k < 4; k++) D.circle(g, x + k * c.r * 0.7, y + Math.sin(k) * 10, c.r * (0.7 + (k % 2) * 0.3), '#fff'); g.globalAlpha = 1; }
  g.drawImage(floorC, -40, floorC.top);
  const dyn = S.dyn;
  // plateformes mobiles
  C.plats.forEach((p, i) => { const x = dyn.plats[i]; D.rrect(g, x + 6, p.y + 10, p.w, p.h, 16, 'rgba(0,0,0,.2)'); D.rrect(g, x, p.y, p.w, p.h, 16, '#fef3c7', '#d97706', 4); g.strokeStyle = 'rgba(217,119,6,.35)'; g.lineWidth = 2; for (let y = p.y + 20; y < p.y + p.h; y += 22) { g.beginPath(); g.moveTo(x + 10, y); g.lineTo(x + p.w - 10, y); g.stroke(); } });
  // portes
  C.doors.forEach((d, i) => { if (dyn.doors[i]) { D.rrect(g, d.x, d.y + d.h - 6, d.w, 6, 3, '#a16207'); return; } D.rrect(g, d.x, d.y, d.w, d.h, 8, '#fde047', '#a16207', 3); D.text(g, '?', d.x + d.w / 2, d.y + d.h / 2, { size: 20, color: '#a16207', stroke: false }); });
  // pousseurs
  C.pushers.forEach((p, i) => { const x = dyn.pushers[i]; for (const [x0, w] of [[-10, x + 10], [x + p.gap, WIDTH - x - p.gap + 10]]) { D.rrect(g, x0 + 6, p.y + 10, w, p.h, 10, 'rgba(0,0,0,.2)'); D.rrect(g, x0, p.y, w, p.h, 10, '#ef4444', '#991b1b', 3); g.fillStyle = 'rgba(255,255,255,.3)'; for (let k = x0 + 10; k < x0 + w - 20; k += 40) g.fillRect(k, p.y + 8, 20, 8); } });
  // bumpers
  C.bumpers.forEach((b, i) => { const k = dyn.bumps[i] ? 1.18 : 1; D.shadow(g, b.x + 4, b.y + 8, b.r, b.r * 0.5); D.circle(g, b.x, b.y, b.r * k, '#ec4899', '#9d174d', 4); D.circle(g, b.x, b.y, b.r * 0.55 * k, '#f9a8d4'); D.circle(g, b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.18, 'rgba(255,255,255,.7)'); });
  // personnages (triés par profondeur)
  for (const r of rs.filter(r => !r.out && !r.fall).sort((a, b) => a.y - b.y)) drawBean(g, r, t);
  // barres tournantes (au-dessus : elles sont hautes)
  C.sweepers.forEach((sw, i) => { const a = dyn.sweepers[i]; g.save(); g.translate(sw.x, sw.y); g.rotate(a); D.rrect(g, -sw.len + 6, -6, sw.len * 2, 24, 12, 'rgba(0,0,0,.2)'); D.rrect(g, -sw.len, -12, sw.len * 2, 24, 12, '#8b5cf6', '#4c1d95', 3); for (let k = -sw.len + 20; k < sw.len - 20; k += 40) D.rrect(g, k, -12, 18, 24, 4, '#fde047'); g.restore(); D.circle(g, sw.x, sw.y, 22, '#4c1d95', '#fff', 3); });
  parts.draw(g);
  stage.screen();
  renderHud(me);
}
const set = (k, html) => { const el = ui[k]; if (el._h !== html) { el._h = html; el.innerHTML = html; } };
function renderHud(me) {
  const alive = S.racers.filter(r => !r.out).length;
  set('tl', `<div class="gk-panel"><div class="fr-q">Manche ${S.round} / ${S.rounds}</div><div>${S.round >= S.rounds ? '👑 FINALE : 1 seul gagnant !' : `✅ ${S.qualified} / ${S.quota} qualifiés`}</div><div>👥 ${alive} en course · ⏱ ${S.raceTime}s</div></div>`);
  if (me && C) { const k = clamp((C.start - me.y) / (C.start - C.finish), 0, 1); set('tr', `<div class="gk-panel"><b>${me.done ? `🏁 ${me.place}e !` : me.out ? '❌ Éliminé' : 'Progression'}</b><div class="fr-prog"><b style="width:${k * 100}%"></b></div></div>`); }
  if (S.phase === 'countdown') set('big', S.timer <= 3 ? `<div class="fr-big" style="font-size:120px">${S.timer || 'GO'}</div>` : `<div class="fr-big" style="font-size:46px">Manche ${S.round}<br><small style="font-size:22px">${S.round >= S.rounds ? 'Finale' : `${S.quota} places qualificatives`}</small></div>`);
  else if (S.phase === 'results') {
    const q = S.racers.filter(r => r.done && !r.out).sort((a, b) => a.place - b.place);
    set('big', `<div class="fr-res"><h2>${S.round >= S.rounds ? '👑 Finale terminée' : `Fin de la manche ${S.round}`}</h2><div class="l">${q.map(r => `<span style="background:${r.color};color:#111">${r.place}. ${esc(r.name)}</span>`).join('')}</div>
      <p>${me && !me.out ? '🎉 Vous êtes qualifié !' : me ? '😢 Vous êtes éliminé… vous pouvez regarder la suite.' : ''}</p></div>`);
  } else if (big.t > 0) { big.t -= 1 / 60; set('big', big.html); } else set('big', '');
}

export default {
  mount(r, a) {
    api = a; endShown = false; C = null;
    sh = shell(r, api, { title: 'Fall Race', icon: '🏃', overlay: true });
    stage = new Stage(sh.main, { bg: '#a5b4fc' });
    parts = new Particles(); rint = new Interp(60); sender = new InputSender(api, 30);
    clouds = Array.from({ length: 14 }, () => ({ x: Math.random() * 2400, y: Math.random() * 3000 - 1500, r: 30 + Math.random() * 40, s: 10 + Math.random() * 20 }));
    ui.hud = hud(sh.main, `<div class="tl"></div><div class="tr"></div><div class="bigw"></div><div class="fr-help"><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> courir · <kbd>Espace</kbd> sauter · <kbd>Maj</kbd>/clic plonger</div>`);
    ui.hud.classList.add('fr-hud');
    const q = s => ui.hud.querySelector(s);
    Object.assign(ui, { tl: q('.tl'), tr: q('.tr'), big: q('.bigw') });
    input = new Input(stage);
    api.send({ type: 'sync' }); // demande le parcours
    stop = loop(frame);
  },
  update(s) {
    if (s.course) { C = s.course; renderFloor(); rint = new Interp(60); }
    S = s; rint.push(s.racers.filter(r => !r.out || r.done), ['x', 'y']);
    if (s.over && !endShown) {
      endShown = true;
      const w = s.racers.find(r => r.id === s.winner);
      setTimeout(() => endScreen(sh.main, api, { title: s.winner === api.myId ? '👑 VOUS AVEZ LA COURONNE !' : `👑 ${esc(w?.name || 'Personne')} remporte la couronne !`, sub: `${s.rounds} manche(s)`,
        rows: s.racers.filter(r => !r.bot || r.id === s.winner).map(r => ({ name: r.name, color: r.color, value: r.id === s.winner ? '👑 Vainqueur' : r.out ? 'Éliminé' : '—', me: r.id === api.myId })), valueLabel: 'Résultat' }), 1200);
    }
  },
  event(e) {
    const mine = e.id === api.myId;
    switch (e.type) {
      case 'count': sfx.play('countdown'); break;
      case 'go': sfx.play('go'); big = { t: 1, html: '<div class="fr-big" style="font-size:110px">GO !</div>' }; break;
      case 'jump': sfx.play('jump', 0.5); break;
      case 'dive': sfx.play('swing', 0.5); break;
      case 'whack': sfx.play('bump', 0.5); parts.burst(e.x, e.y, { n: 10, color: ['#fde047', '#fff'], speed: 220, life: 0.35, size: 4 }); break;
      case 'boing': if (Math.random() < 0.5) sfx.play('pop', 0.4); break;
      case 'door': sfx.play('break', 0.5); parts.burst(e.x, e.y, { n: 16, color: ['#fde047', '#a16207'], speed: 200, life: 0.5, size: 5 }); break;
      case 'fall': parts.burst(e.x, e.y, { n: 12, color: '#fff', speed: 100, life: 0.6, size: 6 }); if (mine) { sfx.play('bad'); api.toast('😱 Chute ! Retour au dernier point de passage'); } break;
      case 'finish': if (mine) { sfx.play('win'); big = { t: 2.5, html: `<div class="fr-big" style="font-size:60px">🏁 QUALIFIÉ !<br><small style="font-size:28px">${e.place}e</small></div>` }; } parts.burst(WIDTH / 2, C?.finish || 0, { n: 30, color: ['#f472b6', '#facc15', '#60a5fa', '#4ade80'], speed: 400, life: 1.2, size: 5, grav: 300 }); break;
      case 'roundEnd': sfx.play('whistle'); break;
      case 'crown': sfx.play('win'); break;
    }
  },
  unmount() { stop?.(); input?.destroy(); stage?.destroy(); S = null; C = null; ui = {}; },
};
