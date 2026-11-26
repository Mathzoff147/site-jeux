// =====================================================================
//  Boîte à outils partagée par les jeux (navigateur)
//  - interface : coque de jeu, écran de fin, échappement HTML
//  - sons synthétisés
//  - 2D temps réel : canvas, caméra, entrées (clavier/souris/tactile),
//    interpolation, particules, textes flottants
// =====================================================================
export const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function css(id, text) { if (document.getElementById(id)) return; const s = document.createElement('style'); s.id = id; s.textContent = text; document.head.appendChild(s); }
export function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
export const avatar = (name, color, size = 32) => `<span class="avatar" style="display:inline-grid;vertical-align:middle;background:${color};width:${size}px;height:${size}px;font-size:${size * 0.45}px">${esc((name || '?')[0])}</span>`;

// ---------------- Coque commune : barre du haut + zone de jeu ----------------
// Retourne { el, main, bar } ; bar = zone libre au centre de la barre
export function shell(root, api, { title, icon = '🎮', overlay = false } = {}) {
  const el = h(`<div class="gk-shell ${overlay ? 'overlay' : ''}">
    <header class="gk-top">
      <div class="gk-title">${icon} <b>${esc(title)}</b></div>
      <div class="gk-bar"></div>
      <div class="gk-actions">
        <button class="gk-btn ghost" data-sound title="Son">🔊</button>
        ${api.isHost() ? '<button class="gk-btn ghost" data-lobby title="Revenir au salon pour changer les paramètres">⟲ Salon</button>' : ''}
        <button class="gk-btn ghost" data-quit>Quitter</button>
      </div>
    </header>
    <div class="gk-main"></div></div>`);
  root.appendChild(el);
  el.querySelector('[data-quit]').onclick = () => { if (confirm('Quitter la partie ?')) api.leave(); };
  el.querySelector('[data-lobby]')?.addEventListener('click', () => { if (confirm('Arrêter la partie et revenir au salon ?')) api.backToLobby(); });
  const sb = el.querySelector('[data-sound]');
  const upd = () => { sb.textContent = sfx.muted ? '🔇' : '🔊'; };
  sb.onclick = () => { sfx.muted = !sfx.muted; localStorage.setItem('mute', sfx.muted ? '1' : ''); upd(); };
  upd();
  return { el, main: el.querySelector('.gk-main'), bar: el.querySelector('.gk-bar') };
}

// Écran de fin : rows = [{ name, color, value, me }]
export function endScreen(root, api, { title, sub = '', rows = [], valueLabel = 'Score' }) {
  root.querySelector('.gk-end')?.remove();
  const el = h(`<div class="gk-end"><div class="gk-end-box">
    <h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}
    ${rows.length ? `<table><tr><th>#</th><th>Joueur</th><th>${esc(valueLabel)}</th></tr>${rows.map((r, i) => `<tr class="${r.me ? 'me' : ''}"><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td>${avatar(r.name, r.color, 24)} ${esc(r.name)}</td><td>${esc(r.value)}</td></tr>`).join('')}</table>` : ''}
    <div class="gk-end-actions">
      ${api.isHost() ? '<button class="gk-btn primary" data-again>🔁 Rejouer</button>' : '<p class="gk-muted">L’hôte peut relancer une partie.</p>'}
      <button class="gk-btn ghost" data-quit>Quitter</button>
    </div></div></div>`);
  el.querySelector('[data-again]')?.addEventListener('click', () => api.backToLobby());
  el.querySelector('[data-quit]').onclick = () => api.leave();
  root.appendChild(el);
  sfx.play('win');
  return el;
}

// Panneau de discussion réutilisable
export function chatBox(api, { placeholder = 'Message…' } = {}) {
  const el = h(`<div class="gk-chat"><div class="gk-chat-log"></div><form><input maxlength="200" placeholder="${placeholder}"><button class="gk-btn primary">➤</button></form></div>`);
  const log = el.querySelector('.gk-chat-log');
  el.querySelector('form').onsubmit = e => { e.preventDefault(); const i = el.querySelector('input'); if (i.value.trim()) api.chat(i.value); i.value = ''; };
  const add = html => { log.insertAdjacentHTML('beforeend', `<div>${html}</div>`); log.scrollTop = log.scrollHeight; while (log.children.length > 120) log.firstChild.remove(); };
  api.onChat(m => { add(`<b style="color:${m.color || '#c4bcff'}">${esc(m.from)}</b> ${esc(m.text)}`); });
  return { el, add, sys: t => add(`<i class="gk-muted">${esc(t)}</i>`) };
}

// ---------------- Sons synthétisés ----------------
export const sfx = {
  muted: localStorage.getItem('mute') === '1', ctx: null, master: null, noise: null,
  init() {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = new AudioContext(); this.master = this.ctx.createGain(); this.master.gain.value = 0.45; this.master.connect(this.ctx.destination);
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { }
    return this.ctx;
  },
  play(kind, vol = 1, pitch = 1) {
    if (this.muted || vol < 0.02 || !this.init()) return;
    const a = this.ctx, t = a.currentTime;
    if (a.state === 'suspended') a.resume();
    const env = (node, g0, dur, delay = 0) => { const g = a.createGain(); g.gain.setValueAtTime(0.0001, t + delay); g.gain.exponentialRampToValueAtTime(g0 * vol, t + delay + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur); node.connect(g).connect(this.master); };
    const tone = (type, f0, f1, g0, dur, delay = 0) => { const o = a.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0 * pitch, t + delay); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * pitch), t + delay + dur); env(o, g0, dur, delay); o.start(t + delay); o.stop(t + delay + dur + 0.02); };
    const noise = (freq, q, g0, dur, delay = 0, type = 'bandpass') => { const n = a.createBufferSource(); n.buffer = this.noise; const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq * pitch; f.Q.value = q; n.connect(f); env(f, g0, dur, delay); n.start(t + delay); n.stop(t + delay + dur + 0.02); };
    const S = {
      click: () => tone('triangle', 900, 700, 0.15, 0.05),
      card: () => noise(3000, 1.5, 0.3, 0.08),
      deal: () => { noise(2600, 2, 0.25, 0.05); noise(2600, 2, 0.2, 0.05, 0.07); },
      coin: () => { tone('square', 990, 990, 0.08, 0.06); tone('square', 1320, 1320, 0.08, 0.12, 0.06); },
      chips: () => { for (let i = 0; i < 4; i++) noise(4500, 6, 0.2, 0.03, i * 0.035); },
      good: () => { tone('triangle', 660, 660, 0.2, 0.1); tone('triangle', 880, 880, 0.2, 0.15, 0.08); },
      bad: () => { tone('sawtooth', 300, 140, 0.15, 0.3); },
      win: () => [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.2, 0.25, i * 0.12)),
      tick: () => tone('sine', 1400, 1400, 0.1, 0.03),
      pop: () => tone('sine', 400, 900, 0.2, 0.08),
      shot: () => { noise(1500, 0.8, 0.5, 0.1); tone('square', 300, 80, 0.12, 0.08); },
      smg: () => { noise(2200, 1, 0.35, 0.06); tone('square', 380, 120, 0.08, 0.05); },
      shotgun: () => { noise(800, 0.6, 0.9, 0.3); tone('sawtooth', 150, 40, 0.3, 0.2); },
      sniper: () => { noise(1200, 0.5, 0.8, 0.35); tone('sawtooth', 600, 60, 0.3, 0.3); },
      laser: () => tone('sawtooth', 1800, 200, 0.18, 0.18),
      flame: () => noise(500, 0.4, 0.25, 0.12, 0, 'lowpass'),
      boom: () => { noise(200, 0.4, 1, 0.7, 0, 'lowpass'); tone('sine', 120, 30, 0.6, 0.6); },
      hit: () => tone('square', 1700, 1400, 0.1, 0.04),
      hurt: () => { tone('sine', 160, 60, 0.5, 0.2); noise(500, 1, 0.3, 0.12); },
      zombie: () => { tone('sawtooth', 90 + Math.random() * 40, 60, 0.15, 0.5); noise(300, 2, 0.1, 0.4); },
      die: () => tone('sawtooth', 400, 40, 0.3, 0.7),
      pickup: () => tone('triangle', 660, 1320, 0.25, 0.2),
      buy: () => { tone('triangle', 784, 784, 0.2, 0.08); tone('triangle', 1175, 1175, 0.2, 0.18, 0.08); },
      reload: () => { noise(2500, 4, 0.2, 0.05); noise(1800, 4, 0.25, 0.06, 0.25); },
      empty: () => tone('square', 300, 280, 0.08, 0.03),
      jump: () => tone('sine', 300, 700, 0.15, 0.15),
      boost: () => { noise(900, 1, 0.3, 0.4, 0, 'lowpass'); tone('sawtooth', 200, 600, 0.12, 0.4); },
      engine: () => tone('sawtooth', 80, 90, 0.05, 0.1),
      bump: () => { tone('sine', 200, 80, 0.4, 0.15); noise(400, 1, 0.2, 0.1); },
      kick: () => { tone('sine', 180, 60, 0.5, 0.15); noise(1200, 1, 0.3, 0.06); },
      goal: () => { [392, 523, 659, 784].forEach((f, i) => tone('square', f, f, 0.12, 0.3, i * 0.1)); noise(2000, 0.3, 0.4, 1.2, 0.2); },
      whistle: () => { tone('sine', 2200, 2300, 0.2, 0.5); },
      level: () => [523, 659, 784, 988, 1046].forEach((f, i) => tone('triangle', f, f, 0.18, 0.2, i * 0.07)),
      magic: () => { tone('sine', 600, 1500, 0.2, 0.3); tone('triangle', 900, 2000, 0.1, 0.3, 0.05); },
      swing: () => noise(1000, 1, 0.3, 0.12, 0, 'highpass'),
      arrow: () => { noise(3000, 3, 0.2, 0.1); tone('triangle', 800, 400, 0.08, 0.1); },
      place: () => { tone('square', 200, 150, 0.15, 0.06); noise(800, 2, 0.2, 0.05); },
      break: () => { noise(600, 1, 0.4, 0.12); noise(300, 1, 0.3, 0.1, 0.05); },
      countdown: () => tone('square', 660, 660, 0.15, 0.12),
      go: () => tone('square', 1320, 1320, 0.2, 0.3),
      splash: () => noise(700, 0.5, 0.5, 0.4, 0, 'lowpass'),
    };
    (S[kind] || S.click)();
  },
};

// =====================================================================
//  2D temps réel
// =====================================================================
export class Stage {
  constructor(parent, { bg = '#0b0d16' } = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'gk-canvas';
    parent.appendChild(this.canvas);
    this.g = this.canvas.getContext('2d');
    this.bg = bg;
    this.cam = { x: 0, y: 0, zoom: 1, shake: 0 };
    this.resize = () => {
      const r = this.canvas.getBoundingClientRect();
      this.dpr = Math.min(2, devicePixelRatio || 1);
      this.w = r.width; this.h = r.height;
      this.canvas.width = Math.round(r.width * this.dpr); this.canvas.height = Math.round(r.height * this.dpr);
    };
    this.ro = new ResizeObserver(this.resize); this.ro.observe(this.canvas);
    this.resize();
  }
  // vise la caméra sur (x,y) avec lissage ; zoom auto selon la taille d'écran
  follow(x, y, dt, k = 8, baseZoom = 1) {
    this.cam.zoom = baseZoom * clamp(Math.min(this.w / 1100, this.h / 700), 0.55, 1.4);
    this.cam.x += (x - this.cam.x) * Math.min(1, dt * k);
    this.cam.y += (y - this.cam.y) * Math.min(1, dt * k);
  }
  // commence une image : fond + transformation monde
  begin(dt) {
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = this.bg; g.fillRect(0, 0, this.w, this.h);
    this.cam.shake *= Math.pow(0.001, dt);
    const sx = (Math.random() - 0.5) * this.cam.shake, sy = (Math.random() - 0.5) * this.cam.shake;
    g.translate(this.w / 2 + sx, this.h / 2 + sy); g.scale(this.cam.zoom, this.cam.zoom); g.translate(-this.cam.x, -this.cam.y);
  }
  screen() { this.g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }
  toWorld(sx, sy) { return { x: (sx - this.w / 2) / this.cam.zoom + this.cam.x, y: (sy - this.h / 2) / this.cam.zoom + this.cam.y }; }
  toScreen(x, y) { return { x: (x - this.cam.x) * this.cam.zoom + this.w / 2, y: (y - this.cam.y) * this.cam.zoom + this.h / 2 }; }
  view() { const hw = this.w / 2 / this.cam.zoom, hh = this.h / 2 / this.cam.zoom; return { x0: this.cam.x - hw, y0: this.cam.y - hh, x1: this.cam.x + hw, y1: this.cam.y + hh }; }
  shake(v) { this.cam.shake = Math.max(this.cam.shake, v); }
  destroy() { this.ro.disconnect(); this.canvas.remove(); }
}

// codes physiques : ZQSD (AZERTY) et WASD (QWERTY) occupent les mêmes touches
const KEYMAP = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
export class Input {
  constructor(stage, { onKey, onWheel, touch = true } = {}) {
    this.stage = stage; this.k = {}; this.raw = {}; this.mouse = { sx: 0, sy: 0, down: false, down2: false }; this.onKey = onKey;
    this.joy = { x: 0, y: 0 }; this.touchAim = null;
    const cv = stage.canvas, L = this.listeners = [];
    const on = (t, e, f, o) => { t.addEventListener(e, f, o); L.push([t, e, f, o]); };
    on(window, 'keydown', e => {
      if (e.target.closest?.('input,textarea')) return;
      if (KEYMAP[e.code]) { this.k[KEYMAP[e.code]] = true; e.preventDefault(); }
      if (e.code === 'Space') e.preventDefault();
      if (!this.raw[e.code]) onKey?.(e.code, e.key);
      this.raw[e.code] = true;
    });
    on(window, 'keyup', e => { if (KEYMAP[e.code]) this.k[KEYMAP[e.code]] = false; this.raw[e.code] = false; });
    on(window, 'blur', () => { this.k = {}; this.raw = {}; this.mouse.down = this.mouse.down2 = false; });
    on(cv, 'mousemove', e => { const r = cv.getBoundingClientRect(); this.mouse.sx = e.clientX - r.left; this.mouse.sy = e.clientY - r.top; });
    on(cv, 'mousedown', e => { sfx.init(); if (e.button === 0) this.mouse.down = true; if (e.button === 2) this.mouse.down2 = true; });
    on(window, 'mouseup', e => { if (e.button === 0) this.mouse.down = false; if (e.button === 2) this.mouse.down2 = false; });
    on(cv, 'contextmenu', e => e.preventDefault());
    on(cv, 'wheel', e => { e.preventDefault(); onWheel?.(Math.sign(e.deltaY)); }, { passive: false });
    if (touch && matchMedia('(pointer: coarse)').matches) this.addTouch(stage.canvas.parentElement, on);
  }
  addTouch(parent, on) {
    const pad = h(`<div class="gk-touch"><div class="gk-joy"><i></i></div><div class="gk-fire">🎯</div></div>`);
    parent.appendChild(pad); this.pad = pad;
    const joy = pad.querySelector('.gk-joy'), knob = joy.querySelector('i'), fire = pad.querySelector('.gk-fire');
    let jid = null, fid = null, c0;
    on(joy, 'touchstart', e => { e.preventDefault(); sfx.init(); const t = e.changedTouches[0]; jid = t.identifier; const r = joy.getBoundingClientRect(); c0 = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, { passive: false });
    on(fire, 'touchstart', e => { e.preventDefault(); sfx.init(); fid = e.changedTouches[0].identifier; this.mouse.down = true; this.fire0 = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }; }, { passive: false });
    on(window, 'touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === jid) {
          let dx = t.clientX - c0.x, dy = t.clientY - c0.y; const L = Math.hypot(dx, dy), m = 45;
          if (L > m) { dx *= m / L; dy *= m / L; }
          knob.style.transform = `translate(${dx}px,${dy}px)`;
          this.joy = { x: dx / m, y: dy / m };
        }
        if (t.identifier === fid) { const dx = t.clientX - this.fire0.x, dy = t.clientY - this.fire0.y; if (Math.hypot(dx, dy) > 10) this.touchAim = Math.atan2(dy, dx); }
      }
    }, { passive: false });
    on(window, 'touchend', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === jid) { jid = null; this.joy = { x: 0, y: 0 }; knob.style.transform = ''; }
        if (t.identifier === fid) { fid = null; this.mouse.down = false; }
      }
    });
  }
  world() { return this.stage.toWorld(this.mouse.sx, this.mouse.sy); }
  // état à envoyer au serveur, la visée étant calculée depuis (px,py)
  state(px, py) {
    const w = this.world();
    const j = this.joy, t = 0.35;
    let a = Math.atan2(w.y - py, w.x - px);
    if (this.touchAim != null) a = this.touchAim; else if (this.pad && (j.x || j.y)) a = Math.atan2(j.y, j.x);
    return { u: !!this.k.u || j.y < -t, d: !!this.k.d || j.y > t, l: !!this.k.l || j.x < -t, r: !!this.k.r || j.x > t, a: +a.toFixed(3), f: this.mouse.down, f2: this.mouse.down2, x: Math.round(w.x), y: Math.round(w.y) };
  }
  destroy() { for (const [t, e, f, o] of this.listeners) t.removeEventListener(e, f, o); this.pad?.remove(); }
}

// Envoie les entrées au serveur quand elles changent (et régulièrement)
export class InputSender {
  constructor(api, every = 33) { this.api = api; this.every = every; this.last = 0; this.lastStr = ''; }
  push(st, now = performance.now()) {
    const s = JSON.stringify(st);
    if ((s !== this.lastStr && now - this.last > this.every) || now - this.last > 150) { this.api.send({ type: 'in', ...st }); this.last = now; this.lastStr = s; }
  }
}

// Interpolation d'entités reçues du serveur (rendu légèrement dans le passé)
export class Interp {
  constructor(delay = 70) { this.delay = delay; this.map = new Map(); }
  push(list, keys = ['x', 'y']) {
    const t = performance.now(), seen = new Set();
    for (const e of list) {
      seen.add(e.id);
      let b = this.map.get(e.id); if (!b) { b = { snaps: [], cur: { ...e } }; this.map.set(e.id, b); }
      b.snaps.push({ t, e }); if (b.snaps.length > 12) b.snaps.shift();
      b.keys = keys;
    }
    for (const id of this.map.keys()) if (!seen.has(id)) this.map.delete(id);
  }
  // retourne la liste des entités interpolées
  all() {
    const rt = performance.now() - this.delay, out = [];
    for (const [id, b] of this.map) {
      const s = b.snaps; while (s.length > 2 && s[1].t <= rt) s.shift();
      const a = s[0], c = s[1] || s[0];
      const f = c.t === a.t ? 1 : clamp((rt - a.t) / (c.t - a.t), 0, 1);
      const o = { ...c.e };
      for (const k of b.keys) {
        const va = a.e[k], vc = c.e[k];
        if (typeof va !== 'number' || typeof vc !== 'number') continue;
        // angle : chemin le plus court
        o[k] = (k === 'a' || k === 'angle' || k === 'dir') ? va + Math.atan2(Math.sin(vc - va), Math.cos(vc - va)) * f : (Math.abs(vc - va) > 400 ? vc : va + (vc - va) * f);
      }
      out.push(o);
    }
    return out;
  }
  get(id) { return this.all().find(e => e.id === id); }
}

// Particules
export class Particles {
  constructor() { this.list = []; }
  burst(x, y, { n = 10, color = '#fff', speed = 150, life = 0.5, size = 3, grav = 0, drag = 2, spread = Math.PI * 2, dir = 0, glow = false, shrink = true } = {}) {
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - 0.5) * spread, v = speed * (0.3 + Math.random() * 0.9);
      this.list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.6), max: life, size: size * (0.6 + Math.random() * 0.8), color: Array.isArray(color) ? color[i % color.length] : color, grav, drag, glow, shrink });
    }
    if (this.list.length > 1500) this.list.splice(0, this.list.length - 1500);
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i]; p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.vy += p.grav * dt; const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }
  draw(g) {
    for (const p of this.list) {
      const k = p.life / p.max;
      g.globalAlpha = Math.min(1, k * 1.5);
      if (p.glow) { g.globalCompositeOperation = 'lighter'; }
      g.fillStyle = p.color;
      const s = p.shrink ? p.size * k : p.size;
      g.beginPath(); g.arc(p.x, p.y, Math.max(0.3, s), 0, 6.283); g.fill();
      g.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = 1;
  }
}

// Textes flottants (dégâts, argent…)
export class Floaters {
  constructor() { this.list = []; }
  add(x, y, text, color = '#fff', size = 16) { this.list.push({ x, y, text, color, size, life: 1 }); }
  update(dt) { for (let i = this.list.length - 1; i >= 0; i--) { const f = this.list[i]; f.life -= dt; f.y -= 40 * dt; if (f.life <= 0) this.list.splice(i, 1); } }
  draw(g) {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const f of this.list) {
      g.globalAlpha = Math.min(1, f.life * 2);
      g.font = `800 ${f.size}px Inter, sans-serif`;
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(f.text, f.x, f.y);
      g.fillStyle = f.color; g.fillText(f.text, f.x, f.y);
    }
    g.globalAlpha = 1;
  }
}

// Boucle d'animation
export function loop(fn) {
  let raf, last = performance.now(), alive = true;
  const step = now => { if (!alive) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; try { fn(dt, now); } catch (e) { console.error(e); } raf = requestAnimationFrame(step); };
  raf = requestAnimationFrame(step);
  return () => { alive = false; cancelAnimationFrame(raf); };
}

// Dessin
export const D = {
  circle(g, x, y, r, fill, stroke, lw = 2) { g.beginPath(); g.arc(x, y, r, 0, 6.283); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } },
  rrect(g, x, y, w, h, r, fill, stroke, lw = 2) { g.beginPath(); g.roundRect(x, y, w, h, r); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } },
  bar(g, x, y, w, h, k, color, bg = 'rgba(0,0,0,.55)') { D.rrect(g, x, y, w, h, h / 2, bg); if (k > 0) D.rrect(g, x, y, w * clamp(k, 0, 1), h, h / 2, color); },
  text(g, t, x, y, { size = 14, color = '#fff', align = 'center', weight = 700, stroke = true, base = 'middle', font = 'Inter' } = {}) {
    g.font = `${weight} ${size}px ${font}, sans-serif`; g.textAlign = align; g.textBaseline = base;
    if (stroke) { g.lineWidth = Math.max(2, size / 5); g.strokeStyle = 'rgba(0,0,0,.65)'; g.lineJoin = 'round'; g.strokeText(t, x, y); }
    g.fillStyle = color; g.fillText(t, x, y);
  },
  shadow(g, x, y, rx, ry = rx * 0.5, a = 0.3) { g.fillStyle = `rgba(0,0,0,${a})`; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 6.283); g.fill(); },
  // éclairage : assombrit l'écran sauf des cercles lumineux (en coordonnées écran)
  darkness(g, w, h, alpha, lights) {
    if (alpha <= 0.01) return;
    if (!D._dk) D._dk = document.createElement('canvas');
    const c = D._dk; if (c.width !== Math.ceil(w) || c.height !== Math.ceil(h)) { c.width = Math.ceil(w); c.height = Math.ceil(h); }
    const x = c.getContext('2d');
    x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, w, h);
    x.fillStyle = `rgba(4,6,18,${alpha})`; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'destination-out';
    for (const l of lights) {
      const gr = x.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      gr.addColorStop(0, `rgba(0,0,0,${l.k ?? 1})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.beginPath(); x.arc(l.x, l.y, l.r, 0, 6.283); x.fill();
    }
    g.drawImage(c, 0, 0, w, h);
  },
};

// Petit HUD DOM par-dessus le canvas
export function hud(parent, html) { const el = h(`<div class="gk-hud">${html}</div>`); parent.appendChild(el); return el; }
