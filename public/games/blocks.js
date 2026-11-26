// =====================================================================
//  BLOCK WORLD — affichage (navigateur)
//  Rendu voxel par tronçons (faces cachées supprimées), textures pixel
//  générées, physique locale, visée par lancer de rayon, jour/nuit.
// =====================================================================
import * as THREE from 'three';
import { sfx, esc, css, endScreen } from '../lib/kit.js';

const CH = 16, REACH = 6;
const TRANSPARENT = new Set([0, 6, 7, 15, 17]);
css('bw-css', `
.bw { position:fixed; inset:0; background:#000; } .bw canvas { display:block; }
.bw-hud { position:absolute; inset:0; pointer-events:none; color:#fff; font-family:Inter,sans-serif; text-shadow:0 1px 2px #000; }
.bw-cross { position:absolute; left:50%; top:50%; width:22px; height:22px; margin:-11px; }
.bw-cross::before, .bw-cross::after { content:''; position:absolute; background:#fff; mix-blend-mode:difference; }
.bw-cross::before { left:10px; top:0; width:2px; height:22px; } .bw-cross::after { top:10px; left:0; height:2px; width:22px; }
.bw-bar { position:absolute; left:50%; bottom:14px; transform:translateX(-50%); display:flex; gap:4px; background:rgba(0,0,0,.45); padding:5px; border-radius:10px; }
.bw-slot { width:52px; height:52px; border:3px solid rgba(255,255,255,.25); border-radius:6px; position:relative; image-rendering:pixelated; background-size:cover; }
.bw-slot.on { border-color:#fff; transform:scale(1.1); } .bw-slot b { position:absolute; right:3px; bottom:0; font-size:13px; }
.bw-slot i { position:absolute; left:3px; top:1px; font-size:10px; font-style:normal; opacity:.7; }
.bw-name { position:absolute; left:50%; bottom:84px; transform:translateX(-50%); font-weight:700; font-size:15px; transition:opacity .4s; }
.bw-hp { position:absolute; left:50%; bottom:76px; transform:translateX(-50%); font-size:16px; letter-spacing:1px; margin-left:-150px; }
.bw-info { position:absolute; left:12px; top:12px; font-size:13px; background:rgba(0,0,0,.4); padding:6px 10px; border-radius:8px; }
.bw-chat { position:absolute; left:12px; bottom:90px; width:360px; display:flex; flex-direction:column; gap:3px; font-size:14px; }
.bw-chat div { background:rgba(0,0,0,.45); padding:3px 8px; border-radius:6px; }
.bw-chatin { position:absolute; left:12px; bottom:60px; width:360px; pointer-events:auto; display:none; }
.bw-pause, .bw-inv { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); background:rgba(20,20,20,.92); border:3px solid #555; border-radius:12px; padding:20px; pointer-events:auto; width:min(720px,94vw); max-height:88vh; overflow:auto; text-shadow:none; }
.bw-pause h1 { margin:0 0 6px; } .bw-pause p { color:#ccc; }
.bw-inv .grid { display:grid; grid-template-columns:repeat(auto-fill,52px); gap:6px; margin:8px 0 14px; }
.bw-inv .grid .bw-slot { cursor:pointer; pointer-events:auto; } .bw-inv .grid .bw-slot:hover { border-color:#fde047; }
.bw-rec { display:flex; align-items:center; gap:8px; padding:6px; border-radius:8px; background:rgba(255,255,255,.05); margin-bottom:6px; }
.bw-rec .bw-slot { width:36px; height:36px; } .bw-rec .bw-slot b { font-size:11px; }
.bw-rec button { margin-left:auto; } .bw-rec.no { opacity:.45; }
.bw-under { position:absolute; inset:0; background:rgba(30,80,200,.35); pointer-events:none; display:none; }
.hide { display:none !important; }
`);

// ---------------- Textures pixel ----------------
let atlas, atlasCanvas, tileURL = {};
const TILE = {}; // id -> [haut, côté, bas]
function makeAtlas(blocks) {
  const T = 16, cols = 8, c = document.createElement('canvas'); c.width = T * cols; c.height = T * 8;
  const g = c.getContext('2d'); let n = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const tile = (fn) => { const i = n++, x = (i % cols) * T, y = Math.floor(i / cols) * T; g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, T, T); g.clip(); fn(g); g.restore(); return i; };
  const noise = (base, v, alpha = 1) => g2 => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const k = rnd(-v, v); g2.fillStyle = shade(base, k); g2.globalAlpha = alpha; g2.fillRect(x, y, 1, 1); } g2.globalAlpha = 1; };
  const dots = (base, dot, n2) => g2 => { noise(base, 14)(g2); g2.fillStyle = dot; for (let k = 0; k < n2; k++) { const x = Math.floor(rnd(1, 13)), y = Math.floor(rnd(1, 13)); g2.fillRect(x, y, 2, 2); g2.fillRect(x + 1, y + 1, 1, 1); } };
  const grassTop = tile(noise('#5fa83a', 18)), dirt = tile(noise('#8b5a2b', 16));
  const grassSide = tile(g2 => { noise('#8b5a2b', 16)(g2); for (let x = 0; x < T; x++) { const h = 3 + Math.floor(Math.random() * 3); for (let y = 0; y < h; y++) { g2.fillStyle = shade('#5fa83a', rnd(-15, 15)); g2.fillRect(x, y, 1, 1); } } });
  const stone = tile(noise('#8a8a8a', 18)), sand = tile(noise('#e3d29a', 10));
  const logSide = tile(g2 => { noise('#6b4a2b', 10)(g2); g2.fillStyle = 'rgba(40,25,10,.5)'; for (let x = 1; x < T; x += 4) g2.fillRect(x, 0, 1, T); });
  const logTop = tile(g2 => { noise('#a07a4a', 8)(g2); g2.strokeStyle = '#6b4a2b'; for (let r = 2; r < 8; r += 2) { g2.beginPath(); g2.arc(8, 8, r, 0, 7); g2.stroke(); } });
  const leaves = tile(g2 => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { if (Math.random() < 0.18) continue; g2.fillStyle = shade('#3e8a2a', rnd(-25, 20)); g2.fillRect(x, y, 1, 1); } });
  const water = tile(g2 => { noise('#2f6fd6', 10, 1)(g2); g2.fillStyle = 'rgba(255,255,255,.15)'; for (let k = 0; k < 6; k++) g2.fillRect(Math.floor(rnd(0, 12)), Math.floor(rnd(0, 15)), 4, 1); });
  const planks = tile(g2 => { noise('#b8864f', 8)(g2); g2.fillStyle = 'rgba(70,40,15,.6)'; for (let y = 3; y < T; y += 4) g2.fillRect(0, y, T, 1); g2.fillRect(5, 0, 1, 4); g2.fillRect(11, 4, 1, 4); g2.fillRect(3, 8, 1, 4); g2.fillRect(9, 12, 1, 4); });
  const cobble = tile(g2 => { noise('#7a7a7a', 10)(g2); g2.strokeStyle = 'rgba(40,40,40,.7)'; for (let k = 0; k < 7; k++) { g2.beginPath(); g2.arc(rnd(2, 14), rnd(2, 14), rnd(2, 4), 0, 7); g2.stroke(); } });
  const coal = tile(dots('#8a8a8a', '#1a1a1a', 6)), iron = tile(dots('#8a8a8a', '#d8a47f', 6)), gold = tile(dots('#8a8a8a', '#facc15', 6)), diam = tile(dots('#8a8a8a', '#5ee7e7', 6));
  const bedrock = tile(noise('#333', 30));
  const glass = tile(g2 => { g2.clearRect(0, 0, T, T); g2.fillStyle = 'rgba(200,235,255,.25)'; g2.fillRect(0, 0, T, T); g2.fillStyle = '#e0f2fe'; g2.fillRect(0, 0, T, 1); g2.fillRect(0, 15, T, 1); g2.fillRect(0, 0, 1, T); g2.fillRect(15, 0, 1, T); g2.fillRect(4, 4, 1, 3); g2.fillRect(5, 3, 2, 1); });
  const bricks = tile(g2 => { noise('#a0442e', 10)(g2); g2.fillStyle = '#d6cfc2'; for (let y = 0; y < T; y += 4) { g2.fillRect(0, y, T, 1); for (let x = (y / 4) % 2 ? 0 : 4; x < T; x += 8) g2.fillRect(x, y, 1, 4); } });
  const torch = tile(g2 => { g2.fillStyle = '#3b2a1a'; g2.fillRect(0, 0, T, T); const gr = g2.createRadialGradient(8, 8, 0, 8, 8, 9); gr.addColorStop(0, '#fff7c2'); gr.addColorStop(0.5, '#facc15'); gr.addColorStop(1, '#b45309'); g2.fillStyle = gr; g2.fillRect(2, 2, 12, 12); g2.strokeStyle = '#3b2a1a'; g2.strokeRect(5.5, 2.5, 5, 11); });
  const snow = tile(noise('#f3f7fb', 6));
  const snowSide = tile(g2 => { noise('#8b5a2b', 16)(g2); g2.fillStyle = '#f3f7fb'; g2.fillRect(0, 0, T, 4); });
  const wool = col => tile(g2 => { noise(col, 10)(g2); g2.strokeStyle = 'rgba(0,0,0,.15)'; for (let k = 0; k < 8; k++) { g2.beginPath(); g2.arc(rnd(0, 16), rnd(0, 16), 2, 0, 3); g2.stroke(); } });
  const wr = wool('#c0392b'), wb = wool('#2e5fb8'), wy = wool('#e5c22b');
  const books = tile(g2 => { noise('#b8864f', 6)(g2); const cl = ['#7f1d1d', '#1e3a8a', '#14532d', '#713f12', '#581c87']; for (const y of [1, 9]) for (let x = 1; x < 15; x += 2) { g2.fillStyle = cl[Math.floor(rnd(0, 5))]; g2.fillRect(x, y, 2, 6); } });
  const goldB = tile(g2 => { noise('#f5c518', 10)(g2); g2.strokeStyle = '#fff6b0'; g2.strokeRect(1.5, 1.5, 13, 13); });
  const diamB = tile(g2 => { noise('#4fe3e3', 10)(g2); g2.strokeStyle = '#d4ffff'; g2.strokeRect(1.5, 1.5, 13, 13); });
  Object.assign(TILE, { 1: [grassTop, grassSide, dirt], 2: [stone, stone, stone], 3: [dirt, dirt, dirt], 4: [sand, sand, sand], 5: [logTop, logSide, logTop], 6: [leaves, leaves, leaves], 7: [water, water, water],
    8: [planks, planks, planks], 9: [cobble, cobble, cobble], 10: [coal, coal, coal], 11: [iron, iron, iron], 12: [gold, gold, gold], 13: [diam, diam, diam], 14: [bedrock, bedrock, bedrock],
    15: [glass, glass, glass], 16: [bricks, bricks, bricks], 17: [torch, torch, torch], 18: [snow, snowSide, dirt], 19: [wr, wr, wr], 20: [wb, wb, wb], 21: [wy, wy, wy], 22: [planks, books, planks], 23: [goldB, goldB, goldB], 24: [diamB, diamB, diamB] });
  atlasCanvas = c;
  atlas = new THREE.CanvasTexture(c); atlas.magFilter = THREE.NearestFilter; atlas.minFilter = THREE.NearestFilter; atlas.colorSpace = THREE.SRGBColorSpace; atlas.generateMipmaps = false;
  // vignettes pour l'interface
  for (const b of blocks) if (b) { const t = TILE[b.id][1], x = (t % 8) * 16, y = Math.floor(t / 8) * 16; const cv = document.createElement('canvas'); cv.width = cv.height = 16; cv.getContext('2d').drawImage(c, x, y, 16, 16, 0, 0, 16, 16); tileURL[b.id] = cv.toDataURL(); }
}
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const r = Math.max(0, Math.min(255, (n >> 16) + k)), g = Math.max(0, Math.min(255, ((n >> 8) & 255) + k)), b = Math.max(0, Math.min(255, (n & 255) + k)); return `rgb(${r},${g},${b})`; }

// ---------------- État ----------------
let api, ST, S, root, hud = {}, renderer, scene, camera, raf, clock, N, H, W, chunks = new Map(), matOpaque, matWater, sun, hemi, highlight, crack, stars, clouds, torchLights = [];
const remotes = new Map(), keys = {}, listeners = [];
const me = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, ground: false, fly: false };
let held = 0, breaking = null, mouseL = false, lastSend = 0, lastSpace = 0, lastSpawnN = -1, lastCorrN = -1, typing = false, invOpen = false, chatMsgs = [], nameT = 0, ready = false;
const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); listeners.push([el, ev, fn, o]); };
const idx = (x, y, z) => (y * N + z) * N + x;
const get = (x, y, z) => (x < 0 || z < 0 || x >= N || z >= N || y < 0) ? 14 : y >= H ? 0 : W[idx(x, y, z)];
const solid = (x, y, z) => { const b = get(x, y, z); return b !== 0 && b !== 7 && b !== 17; };

// ---------------- Maillage ----------------
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], s: 0.8, t: 1 }, { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], s: 0.8, t: 1 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1, t: 0 }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.5, t: 2 },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], s: 0.65, t: 1 }, { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], s: 0.65, t: 1 },
];
function buildChunk(cx, cz) {
  const key = cx + ',' + cz, old = chunks.get(key);
  if (old) { for (const m of old) { scene.remove(m); m.geometry.dispose(); } }
  const out = [];
  for (const water of [false, true]) {
    const pos = [], uv = [], col = [], ind = [];
    for (let y = 0; y < H; y++) for (let z = cz * CH; z < cz * CH + CH; z++) for (let x = cx * CH; x < cx * CH + CH; x++) {
      const b = W[idx(x, y, z)]; if (!b || (b === 7) !== water) continue;
      for (const f of FACES) {
        const nb = get(x + f.n[0], y + f.n[1], z + f.n[2]);
        if (water) { if (nb === 7 || (nb && !TRANSPARENT.has(nb))) continue; }
        else if (!TRANSPARENT.has(nb) || (nb === b && b !== 17)) continue;
        // lumière approximative : à l'ombre si un bloc est au-dessus
        let light = f.s;
        if (y + 1 < H) { let covered = false; for (let yy = y + 1; yy < Math.min(H, y + 14); yy++) { const a = W[idx(x, yy, z)]; if (a && a !== 7 && a !== 6 && a !== 15) { covered = true; break; } } if (covered) light *= 0.62; }
        if (b === 17) light = 1.6;
        const t = TILE[b][f.t], u0 = (t % 8) / 8, v0 = 1 - Math.floor(t / 8) / 8, du = 1 / 8;
        const base = pos.length / 3;
        const wy = water && f.n[1] === 1 && get(x, y + 1, z) !== 7 ? -0.12 : 0;
        f.c.forEach(([a, bb, cc], i) => { pos.push(x + a, y + bb + (bb ? wy : 0), z + cc); col.push(light, light, light); });
        uv.push(u0 + 0.001, v0 - du + 0.001, u0 + 0.001, v0 - 0.001, u0 + du - 0.001, v0 - 0.001, u0 + du - 0.001, v0 - du + 0.001);
        ind.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    if (!ind.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(ind); geo.computeVertexNormals(); geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, water ? matWater : matOpaque);
    mesh.renderOrder = water ? 2 : 0;
    scene.add(mesh); out.push(mesh);
  }
  chunks.set(key, out);
}
function rebuildAround(x, z) {
  const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
  buildChunk(cx, cz);
  if (x % CH === 0 && cx > 0) buildChunk(cx - 1, cz); if (x % CH === CH - 1 && cx < N / CH - 1) buildChunk(cx + 1, cz);
  if (z % CH === 0 && cz > 0) buildChunk(cx, cz - 1); if (z % CH === CH - 1 && cz < N / CH - 1) buildChunk(cx, cz + 1);
  refreshTorches();
}
function setBlock(x, y, z, b) { if (x < 0 || z < 0 || y < 0 || x >= N || z >= N || y >= H) return; W[idx(x, y, z)] = b; rebuildAround(x, z); }
function refreshTorches() {
  for (const l of torchLights) scene.remove(l);
  torchLights = [];
  const list = [];
  for (let i = 0; i < W.length; i++) if (W[i] === 17) { const x = i % N, z = Math.floor(i / N) % N, y = Math.floor(i / (N * N)); list.push([x, y, z]); }
  list.sort((a, b) => Math.hypot(a[0] - me.pos.x, a[2] - me.pos.z) - Math.hypot(b[0] - me.pos.x, b[2] - me.pos.z));
  for (const [x, y, z] of list.slice(0, 8)) { const l = new THREE.PointLight(0xffc56b, 2.2, 12, 1.5); l.position.set(x + 0.5, y + 0.6, z + 0.5); scene.add(l); torchLights.push(l); }
}

// ---------------- Scène ----------------
function buildScene() {
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight);
  root.prepend(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 400); camera.rotation.order = 'YXZ';
  scene.fog = new THREE.Fog(0x87ceeb, 40, 110);
  hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 1.1); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff2d0, 1.4); scene.add(sun);
  matOpaque = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, alphaTest: 0.5, side: THREE.FrontSide });
  matWater = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide });
  for (let cx = 0; cx < N / CH; cx++) for (let cz = 0; cz < N / CH; cz++) buildChunk(cx, cz);
  highlight = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.7 }));
  scene.add(highlight);
  crack = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
  scene.add(crack);
  // étoiles
  const sp = []; for (let i = 0; i < 800; i++) { const a = Math.random() * 6.28, b = Math.random() * 1.4 + 0.1, r = 250; sp.push(Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r, Math.sin(a) * Math.cos(b) * r); }
  stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, transparent: true, opacity: 0, fog: false }));
  scene.add(stars);
  // nuages
  clouds = new THREE.Group();
  const cm = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (let k = 0; k < 40; k++) { const c = new THREE.Mesh(new THREE.BoxGeometry(6 + Math.random() * 14, 1.5, 4 + Math.random() * 10), cm); c.position.set(Math.random() * N * 2 - N / 2, H + 12, Math.random() * N * 2 - N / 2); clouds.add(c); }
  scene.add(clouds);
}
function makeRemote(p) {
  const g = new THREE.Group(), skin = new THREE.MeshLambertMaterial({ color: 0xf1c27d }), shirt = new THREE.MeshLambertMaterial({ color: new THREE.Color(p.color) }), pants = new THREE.MeshLambertMaterial({ color: 0x1e3a8a });
  const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };
  const head = box(0.5, 0.5, 0.5, skin, 0, 1.55, 0); head.add(box(0.52, 0.14, 0.52, new THREE.MeshLambertMaterial({ color: 0x3f2a1d }), 0, 0.2, 0)); head.add(box(0.08, 0.08, 0.02, new THREE.MeshBasicMaterial({ color: 0x111111 }), -0.12, 0.02, -0.26)); head.add(box(0.08, 0.08, 0.02, new THREE.MeshBasicMaterial({ color: 0x111111 }), 0.12, 0.02, -0.26));
  const body = box(0.5, 0.7, 0.28, shirt, 0, 0.95, 0);
  const la = box(0.2, 0.7, 0.2, shirt, -0.36, 0.95, 0), ra = box(0.2, 0.7, 0.2, shirt, 0.36, 0.95, 0);
  const ll = box(0.22, 0.6, 0.22, pants, -0.13, 0.3, 0), rl = box(0.22, 0.6, 0.22, pants, 0.13, 0.3, 0);
  for (const o of [la, ra, ll, rl]) o.geometry.translate(0, -o.geometry.parameters.height / 2 + 0.05, 0), o.position.y += o.geometry.parameters.height / 2 - 0.05;
  g.add(head, body, la, ra, ll, rl);
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.font = 'bold 30px Inter'; x.textAlign = 'center'; x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(128 - x.measureText(p.name).width / 2 - 8, 10, x.measureText(p.name).width + 16, 42); x.fillStyle = '#fff'; x.fillText(p.name, 128, 42);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); label.scale.set(1.6, 0.4, 1); label.position.y = 2.15; g.add(label);
  scene.add(g);
  return { g, head, la, ra, ll, rl, buf: [], walk: 0 };
}

// ---------------- Physique ----------------
function collide(axis, amt) {
  const p = me.pos; p.setComponent(axis, p.getComponent(axis) + amt);
  const r = 0.3, h = 1.75;
  const x0 = Math.floor(p.x - r), x1 = Math.floor(p.x + r), y0 = Math.floor(p.y), y1 = Math.floor(p.y + h), z0 = Math.floor(p.z - r), z1 = Math.floor(p.z + r);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    if (!solid(x, y, z)) continue;
    if (axis === 1) { if (amt < 0) { p.y = y + 1; me.ground = true; } else p.y = y - h - 0.001; me.vel.y = 0; return; }
    if (axis === 0) p.x = amt > 0 ? x - r - 0.001 : x + 1 + r + 0.001;
    else p.z = amt > 0 ? z - r - 0.001 : z + 1 + r + 0.001;
    me.vel.setComponent(axis, 0); return;
  }
}
const inWater = () => get(Math.floor(me.pos.x), Math.floor(me.pos.y + 0.5), Math.floor(me.pos.z)) === 7;
const headWater = () => get(Math.floor(me.pos.x), Math.floor(me.pos.y + 1.6), Math.floor(me.pos.z)) === 7;
function physics(dt) {
  const fw = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), st = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const sin = Math.sin(me.yaw), cos = Math.cos(me.yaw);
  let wx = -sin * fw + cos * st, wz = -cos * fw - sin * st; const L = Math.hypot(wx, wz); if (L) { wx /= L; wz /= L; }
  const water = inWater();
  const speed = (me.fly ? 11 : keys.ShiftLeft ? 6.2 : 4.4) * (water && !me.fly ? 0.55 : 1);
  const k = Math.min(1, (me.ground || me.fly ? 12 : 3) * dt);
  me.vel.x += (wx * speed - me.vel.x) * k; me.vel.z += (wz * speed - me.vel.z) * k;
  if (me.fly) { me.vel.y = ((keys.Space ? 1 : 0) - (keys.ShiftLeft || keys.KeyC ? 1 : 0)) * 8; }
  else if (water) { me.vel.y = Math.max(me.vel.y - 6 * dt, -2.5); if (keys.Space) me.vel.y = 3.2; }
  else { me.vel.y -= 26 * dt; if (keys.Space && me.ground) { me.vel.y = 8.4; } }
  me.ground = false;
  collide(0, me.vel.x * dt); collide(2, me.vel.z * dt); collide(1, me.vel.y * dt);
  if (me.pos.y < -10) { me.pos.set(N / 2, H, N / 2); me.vel.set(0, 0, 0); }
}

// ---------------- Visée (DDA) ----------------
function raycast() {
  const o = camera.position, d = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
  const tdx = Math.abs(1 / d.x), tdy = Math.abs(1 / d.y), tdz = Math.abs(1 / d.z);
  let tx = (sx > 0 ? x + 1 - o.x : o.x - x) * tdx, ty = (sy > 0 ? y + 1 - o.y : o.y - y) * tdy, tz = (sz > 0 ? z + 1 - o.z : o.z - z) * tdz;
  let n = [0, 0, 0], t = 0;
  while (t < REACH) {
    const b = get(x, y, z);
    if (b && b !== 7 && !(x < 0 || z < 0 || x >= N || z >= N)) return { x, y, z, n, b };
    if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; n = [-sx, 0, 0]; }
    else if (ty < tz) { y += sy; t = ty; ty += tdy; n = [0, -sy, 0]; }
    else { z += sz; t = tz; tz += tdz; n = [0, 0, -sz]; }
  }
  return null;
}

// ---------------- Inventaire / barre ----------------
function hotbarItems() {
  if (S?.mode === 'creatif') return ST.blocks.filter(b => b && b.id !== 7 && b.id !== 14).map(b => [b.id, Infinity]);
  return Object.entries(S?.me?.inv || {}).map(([b, n]) => [+b, n]).filter(([, n]) => n > 0).sort((a, b) => a[0] - b[0]);
}
function slotHTML(b, n, on, i) { return `<div class="bw-slot ${on ? 'on' : ''}" data-b="${b}" style="background-image:url(${tileURL[b]})">${i != null ? `<i>${i}</i>` : ''}${n !== Infinity && n != null ? `<b>${n}</b>` : ''}</div>`; }
function renderBar() {
  const items = hotbarItems(); if (held >= items.length) held = Math.max(0, items.length - 1);
  const start = Math.max(0, Math.min(held - 4, items.length - 9));
  hud.bar.innerHTML = items.slice(start, start + 9).map(([b, n], i) => slotHTML(b, n, start + i === held, start + i + 1 <= 9 ? start + i + 1 : null)).join('') || '<span style="padding:12px;font-size:13px">Cassez des blocs pour les ramasser !</span>';
  const cur = items[held];
  hud.name.textContent = cur ? ST.blocks[cur[0]].name : '';
}
function renderInv() {
  const items = hotbarItems();
  const inv = S?.me?.inv || {};
  hud.inv.innerHTML = `<h2 style="margin:0">🎒 Inventaire</h2><div class="grid">${items.map(([b, n], i) => slotHTML(b, n, i === held)).join('') || '<p>Vide</p>'}</div>
    ${S.mode === 'survie' ? `<h3 style="margin:6px 0">🔨 Fabrication</h3>${ST.recipes.map((r, i) => { const ok = r.need.every(([b, n]) => (inv[b] || 0) >= n); return `<div class="bw-rec ${ok ? '' : 'no'}">${r.need.map(([b, n]) => slotHTML(b, n)).join(' + ')} ➜ ${slotHTML(r.out[0], r.out[1])} <span>${esc(ST.blocks[r.out[0]].name)}</span><button class="gk-btn ${ok ? 'primary' : ''}" data-r="${i}" ${ok ? '' : 'disabled'}>Fabriquer</button></div>`; }).join('')}` : '<p>Mode créatif : tous les blocs sont illimités.</p>'}
    <div style="text-align:right"><button class="gk-btn" data-x>Fermer (E)</button></div>`;
  hud.inv.querySelectorAll('[data-r]').forEach(b => { b.onclick = () => api.send({ type: 'craft', r: +b.dataset.r }); });
  hud.inv.querySelectorAll('.grid .bw-slot').forEach((el, i) => { el.onclick = () => { held = i; renderBar(); renderInv(); }; });
  hud.inv.querySelector('[data-x]').onclick = toggleInv;
}
function toggleInv() { invOpen = !invOpen; hud.inv.classList.toggle('hide', !invOpen); if (invOpen) { document.exitPointerLock?.(); renderInv(); } else lock(); }
function lock() { sfx.init(); renderer.domElement.requestPointerLock?.(); }

// ---------------- Boucle ----------------
function loop() {
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta()), now = performance.now(), t = now / 1000;
  if (ready && S) {
    if (!typing && !invOpen) physics(dt); else { me.vel.set(0, me.vel.y, 0); physics(dt); }
    camera.position.set(me.pos.x, me.pos.y + 1.62, me.pos.z); camera.rotation.set(me.pitch, me.yaw, 0);
    if (now - lastSend > 80) { lastSend = now; api.send({ type: 'move', x: +me.pos.x.toFixed(2), y: +me.pos.y.toFixed(2), z: +me.pos.z.toFixed(2), yaw: +me.yaw.toFixed(3), pitch: +me.pitch.toFixed(3), fly: me.fly, ground: me.ground, held: hotbarItems()[held]?.[0] || 0 }); }
    // visée et minage
    const hit = document.pointerLockElement ? raycast() : null;
    highlight.visible = !!hit;
    if (hit) highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    if (mouseL && hit) {
      const key = `${hit.x},${hit.y},${hit.z}`;
      if (!breaking || breaking.key !== key) breaking = { key, t: 0, hit };
      const hard = S.mode === 'creatif' ? 0.12 : Math.max(0.05, ST.blocks[hit.b].hard);
      if (hard >= 0) { breaking.t += dt; if (Math.floor(breaking.t * 6) !== Math.floor((breaking.t - dt) * 6)) sfx.play('break', 0.15); }
      crack.visible = true; crack.position.copy(highlight.position); crack.material.opacity = Math.min(0.6, breaking.t / hard * 0.6);
      if (hard >= 0 && breaking.t >= hard) { api.send({ type: 'break', x: hit.x, y: hit.y, z: hit.z }); setBlock(hit.x, hit.y, hit.z, 0); sfx.play('break'); breaking = null; }
    } else { breaking = null; crack.visible = false; }
    // jour / nuit
    const day = S.day, ang = day * Math.PI * 2, light = Math.max(0.18, Math.min(1, Math.sin(ang) * 1.6 + 0.4));
    sun.position.set(Math.cos(ang) * 100 + N / 2, Math.sin(ang) * 100, N / 2); sun.intensity = 1.4 * light; hemi.intensity = 0.3 + 0.8 * light;
    const sky = new THREE.Color(0x0b1026).lerp(new THREE.Color(0x87ceeb), light);
    if (Math.sin(ang) < 0.3 && Math.sin(ang) > -0.1) sky.lerp(new THREE.Color(0xf59e0b), 0.25);
    const under = headWater();
    scene.background = under ? new THREE.Color(0x1e3a8a) : sky; scene.fog.color.copy(under ? new THREE.Color(0x1e3a8a) : sky); scene.fog.far = under ? 18 : 110;
    hud.under.style.display = under ? 'block' : 'none';
    stars.material.opacity = Math.max(0, 1 - light * 1.6); stars.position.copy(camera.position);
    clouds.position.x = (t * 0.8) % N;
    // joueurs distants
    for (const r of remotes.values()) {
      const b = r.buf, rt = now - 120; while (b.length > 2 && b[1].t <= rt) b.shift();
      const s0 = b[0], s1 = b[1] || b[0]; if (!s0) continue;
      const f = s1.t === s0.t ? 1 : Math.max(0, Math.min(1, (rt - s0.t) / (s1.t - s0.t)));
      const x = s0.x + (s1.x - s0.x) * f, y = s0.y + (s1.y - s0.y) * f, z = s0.z + (s1.z - s0.z) * f;
      const moving = Math.hypot(s1.x - s0.x, s1.z - s0.z) > 0.02; r.walk += moving ? dt * 9 : 0;
      r.g.position.set(x, y, z); r.g.rotation.y = s1.yaw; r.head.rotation.x = s1.pitch;
      const sw = moving ? Math.sin(r.walk) * 0.7 : 0; r.la.rotation.x = sw; r.ra.rotation.x = -sw; r.ll.rotation.x = -sw; r.rl.rotation.x = sw;
    }
    if (nameT > 0) { nameT -= dt; hud.name.style.opacity = Math.min(1, nameT); }
    hud.info.innerHTML = `🧭 ${Math.floor(me.pos.x)}, ${Math.floor(me.pos.y)}, ${Math.floor(me.pos.z)} · ${S.mode === 'creatif' ? 'Créatif' + (me.fly ? ' · ✈️ vol' : '') : 'Survie'} · ${S.day < 0.5 ? '☀️ Jour' : '🌙 Nuit'} · 👥 ${S.players.length}`;
  }
  renderer.render(scene, camera);
}

// ---------------- Entrées ----------------
function bindInput() {
  const cv = renderer.domElement;
  on(cv, 'click', () => { if (!document.pointerLockElement && !invOpen) lock(); });
  on(document, 'pointerlockchange', () => { const l = document.pointerLockElement === cv; hud.pause.classList.toggle('hide', l || invOpen || typing); if (!l) { mouseL = false; for (const k in keys) keys[k] = false; } });
  on(document, 'mousemove', e => { if (document.pointerLockElement !== cv) return; me.yaw -= e.movementX * 0.0024; me.pitch = Math.max(-1.55, Math.min(1.55, me.pitch - e.movementY * 0.0024)); });
  on(document, 'mousedown', e => {
    if (document.pointerLockElement !== cv) return;
    if (e.button === 0) mouseL = true;
    if (e.button === 2) {
      const hit = raycast(), items = hotbarItems(), cur = items[held]; if (!hit || !cur) return;
      const x = hit.x + hit.n[0], y = hit.y + hit.n[1], z = hit.z + hit.n[2];
      const inMe = x + 1 > me.pos.x - 0.3 && x < me.pos.x + 0.3 && z + 1 > me.pos.z - 0.3 && z < me.pos.z + 0.3 && y + 1 > me.pos.y && y < me.pos.y + 1.8;
      if (inMe && cur[0] !== 17) return;
      if (get(x, y, z) && get(x, y, z) !== 7) return;
      api.send({ type: 'place', x, y, z, b: cur[0] }); setBlock(x, y, z, cur[0]); sfx.play('place');
    }
  });
  on(document, 'mouseup', e => { if (e.button === 0) mouseL = false; });
  on(document, 'contextmenu', e => e.preventDefault());
  on(document, 'wheel', e => { if (document.pointerLockElement !== cv) return; const n = hotbarItems().length; if (n) { held = (held + (e.deltaY > 0 ? 1 : -1) + n) % n; renderBar(); nameT = 2; } });
  on(document, 'keydown', e => {
    if (typing) return;
    if (e.code === 'KeyE') { toggleInv(); return; }
    if (e.code === 'KeyT' || e.code === 'Enter') { if (document.pointerLockElement === cv) { e.preventDefault(); typing = true; document.exitPointerLock(); hud.chatin.style.display = 'block'; hud.chatin.focus(); } return; }
    if (document.pointerLockElement !== cv) return;
    keys[e.code] = true;
    if (e.code === 'Space') { e.preventDefault(); if (S?.mode === 'creatif' && performance.now() - lastSpace < 300) { me.fly = !me.fly; me.vel.y = 0; } lastSpace = performance.now(); }
    const m = e.code.match(/^Digit([1-9])$/); if (m) { const n = hotbarItems().length; const start = Math.max(0, Math.min(held - 4, n - 9)); held = Math.min(n - 1, +m[1] - 1); renderBar(); nameT = 2; void start; }
  });
  on(document, 'keyup', e => { keys[e.code] = false; });
  on(window, 'resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
  hud.chatin.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') { if (e.key === 'Enter' && hud.chatin.value.trim()) api.chat(hud.chatin.value); hud.chatin.value = ''; hud.chatin.style.display = 'none'; typing = false; lock(); } });
}

export default {
  mount(r, a) {
    api = a; ST = a.static; N = ST.N; H = ST.H; ready = false; chunks = new Map(); remotes.clear(); held = 0; invOpen = false; typing = false; chatMsgs = [];
    W = Uint8Array.from(atob(ST.world), c => c.charCodeAt(0));
    makeAtlas(ST.blocks);
    root = document.createElement('div'); root.className = 'bw'; r.appendChild(root);
    const h = document.createElement('div'); h.className = 'bw-hud';
    h.innerHTML = `<div class="bw-under"></div><div class="bw-cross"></div><div class="bw-info"></div><div class="bw-chat"></div><input class="bw-chatin" maxlength="200" placeholder="Message… (Entrée)">
      <div class="bw-name"></div><div class="bw-hp"></div><div class="bw-bar"></div><div class="bw-inv hide"></div>
      <div class="bw-pause"><h1>🧱 Block World</h1><p>Cliquez pour jouer.</p><p><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> marcher · <kbd>Espace</kbd> sauter · <kbd>Maj</kbd> courir · clic gauche maintenu : casser · clic droit : poser<br><kbd>1</kbd>–<kbd>9</kbd>/molette : bloc · <kbd>E</kbd> inventaire et fabrication · <kbd>T</kbd> discuter${ST.mode === 'creatif' ? ' · double <kbd>Espace</kbd> : voler (<kbd>Maj</kbd> pour descendre)' : ''}</p>
      <div style="display:flex;gap:10px"><button class="gk-btn primary" data-play style="flex:1">▶ Jouer</button>${a.isHost() ? '<button class="gk-btn" data-lobby>⟲ Salon</button>' : ''}<button class="gk-btn ghost" data-quit>Quitter</button></div></div>`;
    root.appendChild(h);
    const q = s => h.querySelector(s);
    hud = { el: h, info: q('.bw-info'), chat: q('.bw-chat'), chatin: q('.bw-chatin'), name: q('.bw-name'), hp: q('.bw-hp'), bar: q('.bw-bar'), inv: q('.bw-inv'), pause: q('.bw-pause'), under: q('.bw-under') };
    q('[data-play]').onclick = () => lock();
    q('[data-quit]').onclick = () => api.leave();
    q('[data-lobby]')?.addEventListener('click', () => { if (confirm('Arrêter la partie et revenir au salon ? Le monde sera perdu.')) api.backToLobby(); });
    clock = new THREE.Clock();
    buildScene(); bindInput();
    api.onChat(m => { chatMsgs.push(m); if (chatMsgs.length > 6) chatMsgs.shift(); hud.chat.innerHTML = chatMsgs.map(c => `<div><b style="color:${c.color}">${esc(c.from)}</b> ${esc(c.text)}</div>`).join(''); });
    loop();
  },
  update(s) {
    const prev = S; S = s;
    const m = s.me;
    if (m && (m.spawnN !== lastSpawnN)) { lastSpawnN = m.spawnN; me.pos.set(m.x, m.y, m.z); me.vel.set(0, 0, 0); ready = true; refreshTorches(); }
    if (m && m.corrN !== lastCorrN) { if (lastCorrN !== -1) me.pos.set(m.x, m.y, m.z); lastCorrN = m.corrN; }
    const now = performance.now(), seen = new Set();
    for (const p of s.players) {
      if (p.id === api.myId) continue; seen.add(p.id);
      let r = remotes.get(p.id); if (!r) { r = makeRemote(p); remotes.set(p.id, r); }
      r.buf.push({ t: now, ...p }); if (r.buf.length > 20) r.buf.shift();
    }
    for (const [id, r] of remotes) if (!seen.has(id)) { scene.remove(r.g); remotes.delete(id); }
    if (JSON.stringify(prev?.me?.inv) !== JSON.stringify(m?.inv) || prev?.mode !== s.mode) { renderBar(); if (invOpen) renderInv(); }
    if (s.mode === 'survie' && m) hud.hp.textContent = '❤️'.repeat(Math.ceil(m.hp / 2)) + '🖤'.repeat(10 - Math.ceil(m.hp / 2));
    else hud.hp.textContent = '';
  },
  event(e) {
    if (e.type === 'set') { if (get(e.x, e.y, e.z) !== e.b) { setBlock(e.x, e.y, e.z, e.b); sfx.play(e.b ? 'place' : 'break', 0.3); } }
    if (e.type === 'crafted') { sfx.play('buy'); api.toast(`🔨 ${ST.blocks[e.b].name} fabriqué !`); }
    if (e.type === 'ouch') sfx.play('hurt');
    if (e.type === 'died') api.toast(`💀 ${e.name} est mort`);
  },
  unmount() { cancelAnimationFrame(raf); for (const [el, ev, fn, o] of listeners) el.removeEventListener(ev, fn, o); listeners.length = 0; if (document.pointerLockElement) document.exitPointerLock(); renderer?.dispose(); root?.remove(); S = null; },
};
