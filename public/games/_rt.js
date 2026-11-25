// =============================================================
//  Outils pour les jeux en temps réel : canvas, caméra, clavier, souris
// =============================================================
window.RT = (function () {
  const KEYMAP = {
    u: ['z', 'w', 'arrowup'], d: ['s', 'arrowdown'], l: ['q', 'a', 'arrowleft'], r: ['d', 'arrowright'],
  };

  function mount(el, opts) {
    const h = {
      cam: { x: 0, y: 0 }, scale: 1, view: opts.view, state: null, ctx: null, cache: {},
      keys: new Set(), mouse: { x: 0, y: 0, down: false, right: false }, lastSent: '', lastTime: 0,
    };
    el.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'rt-wrap';
    const canvas = document.createElement('canvas');
    wrap.appendChild(canvas);
    el.appendChild(wrap);
    if (opts.bar) { const bar = document.createElement('div'); bar.className = 'rt-bar'; bar.innerHTML = opts.bar; el.appendChild(bar); h.bar = bar; }
    const overlay = document.createElement('div');
    overlay.className = 'rt-overlay hidden';
    wrap.appendChild(overlay);
    h.canvas = canvas; h.wrap = wrap; h.overlay = overlay;
    const g = canvas.getContext('2d');
    h.g = g;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = h.view.w * dpr; canvas.height = h.view.h * dpr;
      h.dpr = dpr;
    }
    resize();

    const typing = (e) => /input|textarea/i.test((e.target || {}).tagName || '');
    const onKey = (down) => (e) => {
      if (typing(e)) return;
      const k = e.key.toLowerCase();
      if (down) h.keys.add(k); else h.keys.delete(k);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (down && opts.onKey) opts.onKey(k, h);
      pushInput();
    };
    const kd = onKey(true), ku = onKey(false);
    const blur = () => { h.keys.clear(); h.mouse.down = false; h.mouse.right = false; pushInput(); };
    const toWorld = (e) => {
      const r = canvas.getBoundingClientRect();
      const sx = (e.clientX - r.left) / r.width * h.view.w, sy = (e.clientY - r.top) / r.height * h.view.h;
      h.mouse.sx = sx; h.mouse.sy = sy;
      h.mouse.x = sx / h.scale + h.cam.x; h.mouse.y = sy / h.scale + h.cam.y;
    };
    const mm = (e) => { toWorld(e); if (opts.onMouseMove) opts.onMouseMove(h); };
    const md = (e) => {
      toWorld(e);
      if (e.button === 2) h.mouse.right = true; else h.mouse.down = true;
      if (opts.onClick) opts.onClick(h, e.button);
      pushInput();
    };
    const mu = (e) => { if (e.button === 2) h.mouse.right = false; else h.mouse.down = false; if (opts.onMouseUp) opts.onMouseUp(h); pushInput(); };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    canvas.addEventListener('mousemove', mm);
    canvas.addEventListener('mousedown', md);
    window.addEventListener('mouseup', mu);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    const has = (list) => list.some(k => h.keys.has(k));
    function pushInput(force) {
      if (!h.ctx || opts.noInput) return;
      const input = {
        type: 'input',
        u: has(KEYMAP.u), d: has(KEYMAP.d), l: has(KEYMAP.l), r: has(KEYMAP.r),
        jump: h.keys.has(' '), alt: h.mouse.right || h.keys.has('shift'), fire: h.mouse.down,
        ax: Math.round(h.mouse.x), ay: Math.round(h.mouse.y),
      };
      const sig = JSON.stringify(input);
      const now = performance.now();
      if (sig === h.lastSent && !force) return;
      if (!force && now - h.lastTime < 40 && input.fire === JSON.parse(h.lastSent || '{}').fire) return;
      h.lastSent = sig; h.lastTime = now;
      h.ctx.send(input);
    }
    h.pushInput = pushInput;
    const timer = setInterval(() => { h.mouse.x = (h.mouse.sx || 0) / h.scale + h.cam.x; h.mouse.y = (h.mouse.sy || 0) / h.scale + h.cam.y; pushInput(); }, 60);

    let raf;
    function frame(t) {
      raf = requestAnimationFrame(frame);
      if (!h.state) return;
      g.setTransform(h.dpr, 0, 0, h.dpr, 0, 0);
      g.clearRect(0, 0, h.view.w, h.view.h);
      try { opts.draw(g, h.state, h.ctx, h, t / 1000); } catch (e) { console.error(e); }
    }
    raf = requestAnimationFrame(frame);

    h.update = (state, ctx) => {
      h.state = state; h.ctx = ctx;
      if (opts.update) opts.update(state, ctx, h);
    };
    h.destroy = () => {
      cancelAnimationFrame(raf); clearInterval(timer);
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur); window.removeEventListener('mouseup', mu);
    };
    h.setOverlay = (html) => {
      if (html === h.overlayHtml) return;
      h.overlayHtml = html;
      overlay.innerHTML = html ? `<div class="box">${html}</div>` : '';
      overlay.classList.toggle('hidden', !html);
    };
    // Place la caméra centrée sur (x, y) en restant dans le monde
    h.follow = (x, y, worldW, worldH, scale = 1) => {
      h.scale = scale;
      const vw = h.view.w / scale, vh = h.view.h / scale;
      h.cam.x = Math.max(0, Math.min(worldW - vw, x - vw / 2));
      h.cam.y = Math.max(0, Math.min(worldH - vh, y - vh / 2));
      if (worldW < vw) h.cam.x = (worldW - vw) / 2;
      if (worldH < vh) h.cam.y = (worldH - vh) / 2;
    };
    h.applyCam = () => { h.g.setTransform(h.dpr * h.scale, 0, 0, h.dpr * h.scale, -h.cam.x * h.dpr * h.scale, -h.cam.y * h.dpr * h.scale); };
    h.resetCam = () => { h.g.setTransform(h.dpr, 0, 0, h.dpr, 0, 0); };
    return h;
  }

  // Fabrique un "GAME_UI" pour un jeu en temps réel
  function game(opts) {
    return {
      h: null,
      render(el, state, ctx) {
        if (!this.h || !el.contains(this.h.canvas)) {
          if (this.h) this.h.destroy();
          this.h = mount(el, opts);
          if (opts.mount) opts.mount(this.h, el, ctx);
        }
        if (state.obstacles) this.h.cache.obstacles = state.obstacles;
        this.h.update(state, ctx);
      },
      unmount() { if (this.h) { this.h.destroy(); this.h = null; } },
    };
  }

  // ---------- Petites aides de dessin ----------
  const draw = {
    circle(g, x, y, r, fill, stroke, lw = 2) {
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
    },
    rrect(g, x, y, w, h, r, fill, stroke) {
      g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h);
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2; g.stroke(); }
    },
    bar(g, x, y, w, h, ratio, color, back = 'rgba(0,0,0,.55)') {
      g.fillStyle = back; g.fillRect(x, y, w, h);
      g.fillStyle = color; g.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
    },
    text(g, s, x, y, { size = 14, color = '#fff', align = 'center', weight = 700, shadow = true, font = 'Outfit, Inter, sans-serif' } = {}) {
      g.font = `${weight} ${size}px ${font}`;
      g.textAlign = align; g.textBaseline = 'middle';
      if (shadow) { g.fillStyle = 'rgba(0,0,0,.65)'; g.fillText(s, x + 1, y + 2); }
      g.fillStyle = color; g.fillText(s, x, y);
    },
    grid(g, cam, view, scale, size, color) {
      g.strokeStyle = color; g.lineWidth = 1;
      const x0 = Math.floor(cam.x / size) * size, y0 = Math.floor(cam.y / size) * size;
      g.beginPath();
      for (let x = x0; x < cam.x + view.w / scale + size; x += size) { g.moveTo(x, cam.y); g.lineTo(x, cam.y + view.h / scale); }
      for (let y = y0; y < cam.y + view.h / scale + size; y += size) { g.moveTo(cam.x, y); g.lineTo(cam.x + view.w / scale, y); }
      g.stroke();
    },
    // Panneau HUD semi-transparent
    panel(g, x, y, w, h) { draw.rrect(g, x, y, w, h, 10, 'rgba(8,10,22,.72)', 'rgba(140,155,255,.25)'); },
  };

  const keysHelp = (list) => `<div class="keys">${list}</div>`;
  return { mount, game, draw, keysHelp };
})();
