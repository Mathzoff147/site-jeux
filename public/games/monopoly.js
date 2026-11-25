// =====================================================================
//  ARÈNE NÉON — affichage (navigateur)
//  Rendu 3D (Three.js), déplacements locaux avec collisions, armes,
//  effets, sons, interface (vie, munitions, tableau des scores…).
//  Commandes : ZQSD/WASD bouger · Espace sauter · Souris viser/tirer
//              Clic droit zoom · R recharger · 1/2/3 ou molette armes · Tab scores
// =====================================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const NEON = { cyan: 0x22d3ee, magenta: 0xe879f9, yellow: 0xfacc15, lime: 0xa3e635 };
const ORDER = ['rifle', 'shotgun', 'rail'];
const SPREAD = { rifle: 0.012, shotgun: 0.085, rail: 0.004 };
const KICK = { rifle: 0.006, shotgun: 0.05, rail: 0.06 };
const ICON = { rifle: '⚡', shotgun: '💥', rail: '➶', fall: '☠' };
const GRAVITY = 24, SPEED = 8.5, JUMP = 8.2, INTERP = 100;

const CSS = `
.ar { position:fixed; inset:0; overflow:hidden; background:#000; cursor:crosshair; font-family:Inter,system-ui,sans-serif; }
.ar canvas { display:block; }
.ar-hud { position:absolute; inset:0; pointer-events:none; color:#fff; text-shadow:0 1px 3px #000; }
.ar-cross { position:absolute; left:50%; top:50%; width:0; height:0; }
.ar-cross i { position:absolute; background:#fff; box-shadow:0 0 3px #000; transition: all .06s; }
.ar-hitm { position:absolute; left:50%; top:50%; width:28px; height:28px; margin:-14px; opacity:0; transition:opacity .15s; }
.ar-hitm::before, .ar-hitm::after { content:''; position:absolute; left:50%; top:0; width:2px; height:100%; background:currentColor; transform:translateX(-50%) rotate(45deg); }
.ar-hitm::after { transform:translateX(-50%) rotate(-45deg); }
.ar-top { position:absolute; top:14px; left:50%; transform:translateX(-50%); display:flex; gap:12px; align-items:center; }
.ar-pill { background:#0009; border:1px solid #fff2; padding:6px 14px; border-radius:20px; font-weight:700; font-variant-numeric:tabular-nums; }
.ar-feed { position:absolute; top:14px; right:14px; display:flex; flex-direction:column; gap:4px; align-items:flex-end; }
.ar-feed div { background:#000a; padding:4px 10px; border-radius:6px; font-size:14px; animation: arin .2s; }
.ar-feed div.mine { border:1px solid #facc15; }
@keyframes arin { from { transform:translateX(30px); opacity:0 } }
.ar-bl { position:absolute; left:20px; bottom:20px; width:260px; }
.ar-bar { height:12px; background:#0008; border-radius:6px; overflow:hidden; margin-top:6px; border:1px solid #fff3; }
.ar-bar b { display:block; height:100%; transition:width .2s; }
.ar-hp { font-size:42px; font-weight:800; line-height:1; }
.ar-br { position:absolute; right:20px; bottom:20px; text-align:right; }
.ar-ammo { font-size:46px; font-weight:800; line-height:1; font-variant-numeric:tabular-nums; }
.ar-ammo small { font-size:20px; opacity:.6; }
.ar-slots { display:flex; gap:6px; justify-content:flex-end; margin-top:8px; }
.ar-slots span { padding:4px 10px; border-radius:6px; background:#0008; border:1px solid #fff2; font-size:13px; opacity:.6; }
.ar-slots span.on { opacity:1; border-color:#22d3ee; box-shadow:0 0 10px #22d3ee88; }
.ar-vig { position:absolute; inset:0; background:radial-gradient(ellipse at center, transparent 45%, #f00a 100%); opacity:0; transition:opacity .4s; }
.ar-dir { position:absolute; left:50%; top:50%; width:0; height:0; }
.ar-dir i { position:absolute; left:-30px; top:-160px; width:60px; height:30px; background:radial-gradient(ellipse at 50% 100%, #f33, transparent 70%); opacity:0; transition:opacity .6s; transform-origin:30px 160px; }
.ar-msg { position:absolute; left:50%; top:30%; transform:translateX(-50%); text-align:center; font-size:22px; font-weight:800; }
.ar-msg .big { font-size:44px; color:#f87171; }
.ar-pop { position:absolute; left:50%; top:62%; transform:translateX(-50%); font-weight:800; font-size:20px; color:#facc15; opacity:0; transition:opacity .3s; }
.ar-board, .ar-pause, .ar-end { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); background:#0b1020ee; border:1px solid #2c3762;
  border-radius:16px; padding:20px 24px; min-width:420px; max-width:calc(100vw - 32px); pointer-events:auto; }
.ar-board table, .ar-end table { width:100%; border-collapse:collapse; } .ar-board td, .ar-board th, .ar-end td, .ar-end th { padding:6px 10px; text-align:left; }
.ar-board tr.me, .ar-end tr.me { background:#6366f133; } .ar-board th, .ar-end th { color:#93a0c4; font-size:12px; text-transform:uppercase; }
.ar-pause h1, .ar-end h1 { margin:0 0 6px; } .ar-pause p { color:#93a0c4; }
.ar-pause label { display:flex; align-items:center; gap:10px; margin:10px 0; color:#e8ecf8; } .ar-pause input[type=range] { flex:1; } .ar-pause input[type=checkbox] { width:auto; }
.ar-pause kbd { background:#1d2540; border-radius:4px; padding:1px 6px; border:1px solid #3a4570; }
.ar-scope { position:absolute; inset:0; background:radial-gradient(circle at center, transparent 0 26vh, #000 26.3vh); opacity:0; }
.ar-scope::before, .ar-scope::after { content:''; position:absolute; background:#000c; }
.ar-scope::before { left:0; right:0; top:50%; height:1px; } .ar-scope::after { top:0; bottom:0; left:50%; width:1px; }
.ar-reload { position:absolute; left:50%; top:calc(50% + 40px); transform:translateX(-50%); width:120px; height:4px; background:#0008; border-radius:2px; overflow:hidden; opacity:0; }
.ar-reload b { display:block; height:100%; background:#22d3ee; width:0; }
.hide { display:none !important; }
`;

// ---------------- Géométrie partagée avec le serveur ----------------
function rayBox(o, d, mn, mx) {
  let t0 = 0, t1 = Infinity;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) { if (o[a] < mn[a] || o[a] > mx[a]) return Infinity; continue; }
    let ta = (mn[a] - o[a]) / d[a], tb = (mx[a] - o[a]) / d[a];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return Infinity;
  }
  return t0;
}

// ---------------- Sons synthétisés ----------------
let actx, master, noiseBuf;
function audio() {
  if (!actx) {
    actx = new AudioContext(); master = actx.createGain(); master.gain.value = 0.5; master.connect(actx.destination);
    noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return actx;
}
function sfx(kind, vol = 1) {
  if (!actx || vol < 0.02) return;
  const t = actx.currentTime;
  const env = (node, a, dur) => { const g = actx.createGain(); g.gain.setValueAtTime(a * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); node.connect(g).connect(master); return g; };
  const noise = (freq, q, a, dur) => { const n = actx.createBufferSource(); n.buffer = noiseBuf; const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; n.connect(f); env(f, a, dur); n.start(t); n.stop(t + dur); };
  const tone = (type, f0, f1, a, dur) => { const o = actx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); env(o, a, dur); o.start(t); o.stop(t + dur); };
  switch (kind) {
    case 'rifle': noise(1800, 0.8, 0.5, 0.09); tone('square', 420, 90, 0.12, 0.08); break;
    case 'shotgun': noise(700, 0.5, 0.9, 0.35); tone('sawtooth', 160, 40, 0.35, 0.25); break;
    case 'rail': tone('sawtooth', 1800, 120, 0.25, 0.5); noise(3000, 2, 0.4, 0.4); tone('sine', 90, 40, 0.5, 0.4); break;
    case 'hit': tone('square', 1700, 1500, 0.12, 0.05); break;
    case 'head': tone('square', 2400, 2200, 0.15, 0.08); break;
    case 'kill': tone('triangle', 880, 880, 0.25, 0.12); setTimeout(() => sfx('killb', vol), 90); break;
    case 'killb': tone('triangle', 1320, 1320, 0.25, 0.18); break;
    case 'hurt': tone('sine', 140, 60, 0.6, 0.2); noise(400, 1, 0.3, 0.12); break;
    case 'pad': tone('sine', 200, 900, 0.3, 0.35); break;
    case 'pickup': tone('triangle', 660, 1320, 0.3, 0.25); break;
    case 'reload': noise(2500, 4, 0.2, 0.05); setTimeout(() => noise(2000, 4, 0.25, 0.06), 300); break;
    case 'empty': tone('square', 300, 280, 0.08, 0.03); break;
    case 'jump': noise(600, 1, 0.08, 0.1); break;
    case 'death': tone('sawtooth', 400, 40, 0.4, 0.8); break;
  }
}

// ---------------- État ----------------
let api, root, hud, ST, S = null, raf, renderer, scene, camera, composer, bloomPass, clock;
let boxes = [], solidMeshes = [], padMeshes = [], pickupMeshes = {};
const remotes = new Map();
const keys = {};
const me = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, onGround: false, alive: false };
let weapon = 'rifle', ammo = { rifle: 30, shotgun: 6, rail: 5 }, reloadEnd = 0, reloadStart = 0, lastShot = 0, mouseDown = false, zoom = false;
let lastSpawnN = -1, lastCorrN = -1, lastSend = 0, lastPing = 0, rtt = 80, bob = 0, recoil = 0, shake = 0;
let sens = +(localStorage.getItem('ar-sens') || 1), quality = localStorage.getItem('ar-q') || 'high';
const fx = []; // effets temporaires { obj, life, max, update }
let viewModels = {}, muzzleLight, muzzleFlash, vmRoot;
const listeners = [];
const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); listeners.push([el, ev, fn, opt]); };

// ---------------- Construction de la scène ----------------
function gridTexture(base, line, n = 8) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = line; g.lineWidth = 2;
  for (let i = 0; i <= n; i++) { const p = i * 512 / n; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 512); g.moveTo(0, p); g.lineTo(512, p); g.stroke(); }
  g.globalAlpha = 0.25; g.lineWidth = 1;
  for (let i = 0; i < n * 4; i++) { const p = i * 512 / (n * 4); g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 512); g.moveTo(0, p); g.lineTo(512, p); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function skyTexture() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 1024);
  grd.addColorStop(0, '#020617'); grd.addColorStop(0.42, '#1e1b4b'); grd.addColorStop(0.5, '#7e22ce'); grd.addColorStop(0.53, '#0f172a'); grd.addColorStop(1, '#020617');
  g.fillStyle = grd; g.fillRect(0, 0, 2048, 1024);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.7})`; g.beginPath(); g.arc(Math.random() * 2048, 60 + Math.random() * 380, Math.random() < 0.08 ? 1.2 : 0.6, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function labelSprite(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 34px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = '#000a'; g.strokeText(text, 128, 32); g.fillStyle = color; g.fillText(text, 128, 32);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false, transparent: true }));
  s.scale.set(1.8, 0.45, 1);
  return s;
}

function buildScene() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 2 : 1));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = quality === 'high';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  root.prepend(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = skyTexture();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  scene.fog = new THREE.Fog(0x0b0a24, 40, 140);
  camera = new THREE.PerspectiveCamera(80, innerWidth / innerHeight, 0.05, 500);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  scene.add(new THREE.HemisphereLight(0x9aa8ff, 0x2a1840, 1.4));
  const sun = new THREE.DirectionalLight(0xffe2c4, 1.6);
  sun.position.set(30, 60, 20); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 150 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const size = ST.map.size;
  const floorTex = gridTexture('#0d1026', '#3b3f8f', 4); floorTex.repeat.set(size / 4, size / 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size + 4, size + 4), new THREE.MeshStandardMaterial({ map: floorTex, color: 0x6a7090, roughness: 0.7, metalness: 0.1, envMapIntensity: 0.3 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor); solidMeshes.push(floor);

  for (const b of ST.map.boxes) {
    const col = NEON[b.c] || NEON.cyan;
    const tex = gridTexture('#2b3266', '#' + new THREE.Color(col).multiplyScalar(0.35).getHexString(), 2);
    tex.repeat.set(Math.max(1, Math.round(Math.max(b.w, b.d) / 2)), Math.max(1, Math.round(b.h / 2)));
    const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.2 }));
    mesh.position.set(b.x, b.y + b.h / 2, b.z);
    mesh.castShadow = mesh.receiveShadow = true;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: col }));
    mesh.add(edges);
    scene.add(mesh); solidMeshes.push(mesh);
    boxes.push({ mn: [b.x - b.w / 2, b.y, b.z - b.d / 2], mx: [b.x + b.w / 2, b.y + b.h, b.z + b.d / 2] });
  }

  for (const p of ST.map.pads) {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, 0.12, 32), new THREE.MeshStandardMaterial({ color: 0x111827, emissive: 0x22d3ee, emissiveIntensity: 0.6 }));
    disc.position.y = 0.06; g.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(p.r * 0.8, 0.05, 8, 40), new THREE.MeshBasicMaterial({ color: 0x67e8f9 }));
    ring.rotation.x = Math.PI / 2; g.add(ring);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 4), new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.8 }));
    arrow.position.y = 1; g.add(arrow);
    g.position.set(p.x, 0, p.z);
    scene.add(g); padMeshes.push({ g, ring, arrow, p });
  }

  for (const pk of ST.map.pickups) {
    const g = new THREE.Group();
    const color = pk.type === 'health' ? 0x4ade80 : 0x60a5fa;
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2 });
    if (pk.type === 'health') { g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.22), mat), new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), mat)); }
    else g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.4), mat));
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.1, 24), new THREE.MeshStandardMaterial({ color: 0x1f2937, emissive: color, emissiveIntensity: 0.25 }));
    base.position.y = -0.95;
    const holder = new THREE.Group(); holder.add(g, base);
    holder.position.set(pk.x, pk.y + 1, pk.z);
    scene.add(holder); pickupMeshes[pk.id] = { holder, g, base };
  }

  buildViewModels();
  setupComposer();
}

function setupComposer() {
  composer = null;
  if (quality !== 'high') return;
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.45, 0.85);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
}

function buildViewModels() {
  vmRoot = new THREE.Group(); camera.add(vmRoot);
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a4262, roughness: 0.35, metalness: 0.6 });
  const glow = c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9 });
  const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };
  const cyl = (r, l, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 12), m); o.rotation.x = Math.PI / 2; o.position.set(x, y, z); return o; };

  const rifle = new THREE.Group();
  rifle.add(box(0.08, 0.1, 0.5, dark), box(0.085, 0.02, 0.38, glow(0x22d3ee), 0, 0.05, -0.02), cyl(0.02, 0.28, dark, 0, 0.01, -0.38),
    box(0.05, 0.14, 0.07, dark, 0, -0.1, 0.02), box(0.06, 0.12, 0.06, dark, 0, -0.09, 0.18), box(0.04, 0.05, 0.12, glow(0x22d3ee), 0, 0.09, 0.05));
  rifle.userData.muzzle = new THREE.Vector3(0, 0.01, -0.53);
  const shotgun = new THREE.Group();
  shotgun.add(box(0.13, 0.12, 0.46, dark), cyl(0.03, 0.3, dark, -0.03, 0.02, -0.36), cyl(0.03, 0.3, dark, 0.03, 0.02, -0.36),
    box(0.135, 0.025, 0.3, glow(0xfb923c), 0, -0.04, -0.02), box(0.07, 0.13, 0.08, dark, 0, -0.11, 0.12));
  shotgun.userData.muzzle = new THREE.Vector3(0, 0.02, -0.52);
  const rail = new THREE.Group();
  rail.add(box(0.07, 0.09, 0.72, dark), cyl(0.025, 0.3, dark, 0, 0.0, -0.5), cyl(0.035, 0.2, dark, 0, 0.08, 0.02), box(0.05, 0.13, 0.08, dark, 0, -0.1, 0.16));
  for (let k = 0; k < 4; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 20), glow(0xe879f9)); t.position.z = -0.12 - k * 0.09; rail.add(t); }
  rail.userData.muzzle = new THREE.Vector3(0, 0, -0.66);
  viewModels = { rifle, shotgun, rail };
  for (const k of ORDER) { vmRoot.add(viewModels[k]); viewModels[k].visible = false; viewModels[k].traverse(o => { o.renderOrder = 10; }); }

  muzzleLight = new THREE.PointLight(0xffd27a, 0, 8);
  muzzleFlash = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.25), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  vmRoot.add(muzzleLight, muzzleFlash);
  vmRoot.position.set(0.26, -0.24, -0.5);
  selectWeapon('rifle', true);
}

function makeRemote(p) {
  const g = new THREE.Group();
  const col = new THREE.Color(p.color);
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.3, emissive: col, emissiveIntensity: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1f2333, roughness: 0.5, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.68, 4, 12), mat); body.position.y = 0.76; body.castShadow = true;
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.04, 6, 20), new THREE.MeshBasicMaterial({ color: col })); belt.rotation.x = Math.PI / 2; belt.position.y = 0.8;
  const upper = new THREE.Group(); upper.position.y = 1.35;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), mat); head.position.y = 0.25; head.castShadow = true;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.12), new THREE.MeshBasicMaterial({ color: 0x67e8f9 })); visor.position.set(0, 0.28, -0.24);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.6), dark); gun.position.set(0.3, -0.15, -0.35); gun.castShadow = true;
  const gunGlow = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.02, 0.4), new THREE.MeshBasicMaterial({ color: col })); gunGlow.position.set(0.3, -0.08, -0.35);
  upper.add(head, visor, gun, gunGlow);
  g.add(body, belt, upper);
  const label = labelSprite(p.name, p.color); label.position.y = 2.25; g.add(label);
  scene.add(g);
  return { g, upper, body, buf: [], alive: true, color: p.color, name: p.name, x: 0, y: 0, z: 0 };
}

// ---------------- Armes ----------------
function selectWeapon(w, silent) {
  if (!ST.weapons[w]) return;
  weapon = w; reloadEnd = 0; zoom = false;
  for (const k of ORDER) viewModels[k].visible = k === w;
  const m = viewModels[w].userData.muzzle;
  muzzleLight.position.copy(m); muzzleFlash.position.copy(m);
  recoil = 0.35; // animation de sortie
  if (!silent) api.send({ type: 'weapon', w });
  renderWeaponHud();
}
function startReload() {
  const w = ST.weapons[weapon];
  if (reloadEnd || ammo[weapon] >= w.mag || !me.alive) return;
  reloadStart = performance.now(); reloadEnd = reloadStart + w.reload;
  api.send({ type: 'reload' }); sfx('reload', 0.8); zoom = false;
}

function eyePos() { return [me.pos.x, me.pos.y + ST.eye, me.pos.z]; }
function forward(yaw, pitch) { return [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)]; }

function castLocal(o, d, maxT) {
  let t = rayBox(o, d, [-1e4, -1e4, -1e4], [1e4, 0, 1e4]), hit = null;
  for (const b of boxes) t = Math.min(t, rayBox(o, d, b.mn, b.mx));
  t = Math.min(t, maxT);
  for (const r of remotes.values()) {
    if (!r.alive) continue;
    const tr = rayBox(o, d, [r.x - 0.4, r.y, r.z - 0.4], [r.x + 0.4, r.y + 1.9, r.z + 0.4]);
    if (tr < t) { t = tr; hit = r; }
  }
  return { t, hit };
}

function tryFire(now) {
  const w = ST.weapons[weapon];
  if (!me.alive || reloadEnd || now - lastShot < w.rate || S?.phase !== 'play') return;
  if (ammo[weapon] <= 0) { lastShot = now; sfx('empty'); startReload(); return; }
  lastShot = now; ammo[weapon]--;
  const moving = Math.hypot(me.vel.x, me.vel.z) > 1;
  const spread = SPREAD[weapon] * (moving ? 1.6 : 1) * (me.onGround ? 1 : 2.2) * (zoom ? (weapon === 'rail' ? 0 : 0.5) : 1);
  const o = eyePos();
  const f = new THREE.Vector3(...forward(me.yaw, me.pitch));
  const right = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, f).normalize();
  const dirs = [];
  for (let k = 0; k < w.pellets; k++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
    const d = f.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
    dirs.push([+d.x.toFixed(5), +d.y.toFixed(5), +d.z.toFixed(5)]);
  }
  api.send({ type: 'shoot', o, dirs });
  // effets locaux
  const muzzleWorld = viewModels[weapon].userData.muzzle.clone(); vmRoot.localToWorld(muzzleWorld);
  for (const d of dirs) {
    const { t, hit } = castLocal(o, d, w.range);
    const end = new THREE.Vector3(o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t);
    tracer(zoom && weapon === 'rail' ? new THREE.Vector3(o[0], o[1] - 0.15, o[2]) : muzzleWorld, end, weapon);
    if (!hit && t < w.range) sparks(end, weapon === 'rail' ? 0xe879f9 : 0xfde68a, weapon === 'shotgun' ? 3 : 8);
  }
  muzzleFlash.material.opacity = 1; muzzleFlash.rotation.z = Math.random() * 3; muzzleLight.intensity = 6;
  recoil = Math.min(1, recoil + (weapon === 'rifle' ? 0.25 : 0.9));
  me.pitch = Math.min(1.5, me.pitch + KICK[weapon] * (zoom ? 0.5 : 1));
  me.yaw += (Math.random() - 0.5) * KICK[weapon] * 0.5;
  shake = Math.max(shake, weapon === 'rifle' ? 0.02 : 0.08);
  sfx(weapon);
  renderWeaponHud();
  if (ammo[weapon] === 0) setTimeout(startReload, 250);
}

// ---------------- Effets ----------------
function addFx(obj, max, update) { scene.add(obj); fx.push({ obj, life: max, max, update }); }
function tracer(a, b, w) {
  if (w === 'rail') {
    const len = a.distanceTo(b);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xf0abfc, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.copy(a).add(b).multiplyScalar(0.5);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    addFx(beam, 0.6, (f, k) => { f.obj.material.opacity = k; f.obj.scale.set(1 + (1 - k) * 4, 1, 1 + (1 - k) * 4); });
    // spirale
    const pts = []; const dir = b.clone().sub(a); const n = Math.min(400, Math.floor(len * 6));
    const side = new THREE.Vector3(0, 1, 0).cross(dir).normalize(); const up2 = dir.clone().cross(side).normalize();
    for (let i = 0; i <= n; i++) { const t = i / n, ang = t * len * 4; pts.push(a.clone().addScaledVector(dir, t).addScaledVector(side, Math.cos(ang) * 0.12).addScaledVector(up2, Math.sin(ang) * 0.12)); }
    const sp = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xe879f9, transparent: true, blending: THREE.AdditiveBlending }));
    addFx(sp, 0.9, (f, k) => { f.obj.material.opacity = k; });
    return;
  }
  const geo = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: w === 'shotgun' ? 0xfdba74 : 0x67e8f9, transparent: true, blending: THREE.AdditiveBlending }));
  addFx(line, w === 'shotgun' ? 0.12 : 0.07, (f, k) => { f.obj.material.opacity = k; });
}
const sparkGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
function sparks(pos, color, n = 8, speed = 6, life = 0.4) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(sparkGeo, mat);
    m.position.copy(pos);
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.3 + Math.random()));
    addFx(m, life * (0.6 + Math.random() * 0.6), (f, k, dt) => { v.y -= 15 * dt; f.obj.position.addScaledVector(v, dt); f.obj.material.opacity = k; f.obj.scale.setScalar(k); });
  }
}

// ---------------- Mouvements & collisions ----------------
function overlaps(b, x, y, z) {
  const R = ST.radius;
  return x + R > b.mn[0] && x - R < b.mx[0] && z + R > b.mn[2] && z - R < b.mx[2] && y + ST.height > b.mn[1] && y < b.mx[1];
}
function moveAxis(axis, amount) {
  if (!amount) return;
  const p = me.pos, R = ST.radius;
  p.setComponent(axis, p.getComponent(axis) + amount);
  for (const b of boxes) {
    if (!overlaps(b, p.x, p.y, p.z)) continue;
    if (axis === 1) {
      if (amount < 0) { p.y = b.mx[1]; me.vel.y = 0; me.onGround = true; } else { p.y = b.mn[1] - ST.height - 0.001; me.vel.y = Math.min(0, me.vel.y); }
    } else {
      const step = b.mx[1] - p.y;
      if (step > 0 && step <= 0.55 && !boxes.some(o => o !== b && overlaps(o, p.x, b.mx[1] + 0.001, p.z))) { p.y = b.mx[1] + 0.001; continue; }
      const ci = axis === 0 ? 0 : 2;
      p.setComponent(axis, amount > 0 ? b.mn[ci] - R - 0.001 : b.mx[ci] + R + 0.001);
      me.vel.setComponent(axis, 0);
    }
  }
}
function physics(dt) {
  const fw = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), st = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const sin = Math.sin(me.yaw), cos = Math.cos(me.yaw);
  let wx = -sin * fw + cos * st, wz = -cos * fw - sin * st;
  const L = Math.hypot(wx, wz); if (L) { wx /= L; wz /= L; }
  const speed = SPEED * (zoom ? 0.55 : 1) * (reloadEnd ? 0.9 : 1);
  if (me.onGround) {
    const k = Math.min(1, 14 * dt);
    me.vel.x += (wx * speed - me.vel.x) * k; me.vel.z += (wz * speed - me.vel.z) * k;
    if (keys.Space) { me.vel.y = JUMP; me.onGround = false; sfx('jump', 0.5); }
  } else {
    const cur = Math.hypot(me.vel.x, me.vel.z);
    me.vel.x += wx * 22 * dt; me.vel.z += wz * 22 * dt;
    const nv = Math.hypot(me.vel.x, me.vel.z), max = Math.max(cur, speed);
    if (nv > max) { me.vel.x *= max / nv; me.vel.z *= max / nv; }
  }
  // tremplins
  if (me.onGround) for (const { p } of padMeshes) {
    if (Math.hypot(me.pos.x - p.x, me.pos.z - p.z) < p.r && me.pos.y < 0.3) {
      me.vel.y = p.power; me.vel.x += p.push[0]; me.vel.z += p.push[1]; me.onGround = false; sfx('pad'); shake = 0.05;
    }
  }
  me.vel.y -= GRAVITY * dt;
  // sous-pas pour éviter de traverser les murs
  const steps = Math.ceil(Math.max(Math.abs(me.vel.x), Math.abs(me.vel.y), Math.abs(me.vel.z)) * dt / 0.3) || 1;
  const wasGround = me.onGround;
  me.onGround = false;
  for (let i = 0; i < steps; i++) {
    moveAxis(0, me.vel.x * dt / steps);
    moveAxis(2, me.vel.z * dt / steps);
    moveAxis(1, me.vel.y * dt / steps);
    if (me.pos.y < 0) { me.pos.y = 0; me.vel.y = 0; me.onGround = true; }
  }
  // coller au sol en descendant les marches
  if (wasGround && !me.onGround && me.vel.y <= 0) {
    const y0 = me.pos.y;
    let top = 0;
    for (const b of boxes) if (me.pos.x + ST.radius > b.mn[0] && me.pos.x - ST.radius < b.mx[0] && me.pos.z + ST.radius > b.mn[2] && me.pos.z - ST.radius < b.mx[2] && b.mx[1] <= y0 + 0.01) top = Math.max(top, b.mx[1]);
    if (y0 - top < 0.55) { me.pos.y = top; me.vel.y = 0; me.onGround = true; }
  }
}

// ---------------- Boucle ----------------
function loop() {
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  const now = performance.now();
  const t = now / 1000;

  if (me.alive) {
    physics(dt);
    if (mouseDown && document.pointerLockElement && (weapon === 'rifle' || now - lastShot > ST.weapons[weapon].rate)) tryFire(now);
    if (reloadEnd && now >= reloadEnd) { ammo[weapon] = ST.weapons[weapon].mag; reloadEnd = 0; renderWeaponHud(); }
    if (now - lastSend > 50) { lastSend = now; api.send({ type: 'move', x: +me.pos.x.toFixed(3), y: +me.pos.y.toFixed(3), z: +me.pos.z.toFixed(3), yaw: +me.yaw.toFixed(4), pitch: +me.pitch.toFixed(4) }); }
  }
  if (now - lastPing > 2000) { lastPing = now; api.send({ type: 'ping', c: now, rtt }); }

  // caméra
  const speedH = Math.hypot(me.vel.x, me.vel.z);
  if (me.onGround && speedH > 1) bob += dt * speedH * 1.3;
  shake *= Math.pow(0.002, dt);
  camera.position.set(me.pos.x + (Math.random() - 0.5) * shake, me.pos.y + ST.eye + Math.sin(bob * 2) * 0.04 * Math.min(1, speedH / SPEED) + (Math.random() - 0.5) * shake, me.pos.z);
  camera.rotation.set(me.pitch, me.yaw, 0);
  const targetFov = zoom ? (weapon === 'rail' ? 22 : 55) : 80;
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 14); camera.updateProjectionMatrix();

  // arme en main
  recoil *= Math.pow(0.0005, dt);
  const aim = zoom && weapon !== 'rail';
  const tx = aim ? 0 : 0.26, ty = aim ? -0.15 : -0.24;
  vmRoot.position.x += (tx + Math.cos(bob) * 0.012 - vmRoot.position.x) * Math.min(1, dt * 16);
  vmRoot.position.y += (ty + Math.abs(Math.sin(bob)) * 0.014 - recoil * 0.03 - (reloadEnd ? 0.12 : 0) - vmRoot.position.y) * Math.min(1, dt * 16);
  vmRoot.position.z = -0.5 + recoil * 0.09;
  vmRoot.rotation.x = recoil * 0.12 + (reloadEnd ? -0.5 : 0) * 0.6;
  vmRoot.visible = me.alive && !(zoom && weapon === 'rail' && camera.fov < 35);
  muzzleFlash.material.opacity *= Math.pow(0.0001, dt); muzzleLight.intensity *= Math.pow(0.00001, dt);
  hud.scope.style.opacity = zoom && weapon === 'rail' && camera.fov < 35 ? 1 : 0;

  // joueurs distants (interpolation 100 ms dans le passé)
  const rt = now - INTERP;
  for (const r of remotes.values()) {
    const b = r.buf;
    while (b.length > 2 && b[1].t <= rt) b.shift();
    let s0 = b[0], s1 = b[1] || b[0];
    if (!s0) continue;
    const f = s1.t === s0.t ? 1 : Math.max(0, Math.min(1, (rt - s0.t) / (s1.t - s0.t)));
    r.x = s0.x + (s1.x - s0.x) * f; r.y = s0.y + (s1.y - s0.y) * f; r.z = s0.z + (s1.z - s0.z) * f;
    let dy = s1.yaw - s0.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const yaw = s0.yaw + dy * f, pitch = s0.pitch + (s1.pitch - s0.pitch) * f;
    const moving = Math.hypot(s1.x - s0.x, s1.z - s0.z) > 0.05;
    r.walk = (r.walk || 0) + (moving ? dt * 10 : 0);
    r.g.position.set(r.x, r.y + (moving ? Math.abs(Math.sin(r.walk)) * 0.06 : 0), r.z);
    r.g.rotation.y = yaw; r.upper.rotation.x = pitch * 0.8;
    r.body.rotation.z = moving ? Math.sin(r.walk) * 0.05 : 0;
    r.g.visible = r.alive;
  }

  // décor animé
  for (const { ring, arrow } of padMeshes) { const k = (t * 1.5) % 1; ring.position.y = k * 1.5; ring.scale.setScalar(1 - k * 0.4); ring.material.opacity = 1 - k; ring.material.transparent = true; arrow.position.y = 0.8 + Math.sin(t * 4) * 0.15; arrow.rotation.y = t * 2; }
  for (const pm of Object.values(pickupMeshes)) { pm.g.rotation.y = t * 2; pm.g.position.y = Math.sin(t * 3) * 0.12; }

  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.life -= dt;
    if (f.life <= 0) { scene.remove(f.obj); f.obj.geometry?.dispose?.(); fx.splice(i, 1); continue; }
    f.update(f, f.life / f.max, dt);
  }

  // recharge
  hud.reload.style.opacity = reloadEnd ? 1 : 0;
  if (reloadEnd) hud.reload.firstChild.style.width = Math.min(100, (now - reloadStart) / (reloadEnd - reloadStart) * 100) + '%';
  updateCrosshair(speedH);

  if (composer) composer.render(); else renderer.render(scene, camera);
}

// ---------------- Interface ----------------
function buildHud() {
  hud = {};
  const h = document.createElement('div'); h.className = 'ar-hud';
  h.innerHTML = `
    <div class="ar-scope"></div>
    <div class="ar-vig"></div>
    <div class="ar-cross"><i></i><i></i><i></i><i></i></div>
    <div class="ar-hitm"></div>
    <div class="ar-reload"><b></b></div>
    <div class="ar-dir"><i></i></div>
    <div class="ar-top"><span class="ar-pill ar-timer">--:--</span><span class="ar-pill ar-lead"></span><span class="ar-pill ar-ping"></span></div>
    <div class="ar-feed"></div>
    <div class="ar-msg"></div>
    <div class="ar-pop"></div>
    <div class="ar-bl"><div class="ar-hp">100</div><div class="ar-bar"><b class="hpb" style="background:#4ade80;width:100%"></b></div><div class="ar-bar"><b class="arb" style="background:#60a5fa;width:0"></b></div></div>
    <div class="ar-br"><div class="ar-wname"></div><div class="ar-ammo"></div><div class="ar-slots"></div></div>
    <div class="ar-board hide"></div>
    <div class="ar-end hide"></div>
    <div class="ar-pause">
      <h1>⚡ Arène Néon</h1>
      <p>Cliquez pour jouer · premier à <b class="fl"></b> éliminations</p>
      <p><kbd>ZQSD</kbd>/<kbd>WASD</kbd> bouger · <kbd>Espace</kbd> sauter · <kbd>Clic</kbd> tirer · <kbd>Clic droit</kbd> viser<br>
      <kbd>R</kbd> recharger · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>/molette armes · <kbd>Tab</kbd> scores · <kbd>Échap</kbd> pause</p>
      <label>Sensibilité <input type="range" min="0.2" max="3" step="0.05" class="sens"><span class="sensv"></span></label>
      <label><input type="checkbox" class="q"> Haute qualité (lueurs néon, ombres)</label>
      <div style="display:flex;gap:10px;margin-top:14px"><button class="play" style="flex:1">▶ Jouer</button><button class="ghost quit">Quitter</button></div>
    </div>`;
  root.appendChild(h);
  const q = s => h.querySelector(s);
  Object.assign(hud, {
    el: h, cross: q('.ar-cross'), hitm: q('.ar-hitm'), vig: q('.ar-vig'), dir: q('.ar-dir i'), timer: q('.ar-timer'), lead: q('.ar-lead'), ping: q('.ar-ping'),
    feed: q('.ar-feed'), msg: q('.ar-msg'), pop: q('.ar-pop'), hp: q('.ar-hp'), hpb: q('.hpb'), arb: q('.arb'), wname: q('.ar-wname'), ammo: q('.ar-ammo'),
    slots: q('.ar-slots'), board: q('.ar-board'), end: q('.ar-end'), pause: q('.ar-pause'), scope: q('.ar-scope'), reload: q('.ar-reload'),
  });
  const sl = q('.sens'), sv = q('.sensv');
  sl.value = sens; sv.textContent = sens.toFixed(2);
  sl.oninput = () => { sens = +sl.value; sv.textContent = sens.toFixed(2); localStorage.setItem('ar-sens', sens); };
  const qc = q('.q'); qc.checked = quality === 'high';
  qc.onchange = () => {
    quality = qc.checked ? 'high' : 'low'; localStorage.setItem('ar-q', quality);
    renderer.shadowMap.enabled = quality === 'high'; renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 2 : 1));
    scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    setupComposer();
  };
  q('.play').onclick = e => { e.stopPropagation(); lock(); };
  q('.quit').onclick = e => { e.stopPropagation(); api.leave(); };
  hud.pause.onclick = e => { if (e.target === hud.pause) lock(); };
}
function lock() { audio(); actx.resume?.(); renderer.domElement.requestPointerLock?.(); }

function updateCrosshair(speedH) {
  const gap = 6 + (SPREAD[weapon] * 400) * (speedH > 1 ? 1.6 : 1) * (me.onGround ? 1 : 2.2) * (zoom ? 0.4 : 1) + recoil * 10;
  const [a, b, c, d] = hud.cross.children, L = weapon === 'shotgun' ? 6 : 9;
  Object.assign(a.style, { width: '2px', height: L + 'px', left: '-1px', top: -gap - L + 'px' });
  Object.assign(b.style, { width: '2px', height: L + 'px', left: '-1px', top: gap + 'px' });
  Object.assign(c.style, { width: L + 'px', height: '2px', top: '-1px', left: -gap - L + 'px' });
  Object.assign(d.style, { width: L + 'px', height: '2px', top: '-1px', left: gap + 'px' });
  hud.cross.style.opacity = me.alive && !(zoom && weapon === 'rail') ? 1 : 0;
}
function renderWeaponHud() {
  const w = ST.weapons[weapon];
  hud.wname.textContent = `${ICON[weapon]} ${w.name}`;
  hud.ammo.innerHTML = `${ammo[weapon]}<small> / ${w.mag}</small>`;
  hud.ammo.style.color = ammo[weapon] <= Math.ceil(w.mag / 5) ? '#f87171' : '#fff';
  hud.slots.innerHTML = ORDER.map((k, i) => `<span class="${k === weapon ? 'on' : ''}">${i + 1} ${ICON[k]}</span>`).join('');
}
function feed(html, mine) {
  const d = document.createElement('div'); d.innerHTML = html; if (mine) d.className = 'mine';
  hud.feed.prepend(d);
  while (hud.feed.children.length > 6) hud.feed.lastChild.remove();
  setTimeout(() => d.remove(), 6000);
}
function pop(text, color = '#facc15') {
  hud.pop.textContent = text; hud.pop.style.color = color; hud.pop.style.opacity = 1;
  clearTimeout(pop.h); pop.h = setTimeout(() => { hud.pop.style.opacity = 0; }, 1600);
}
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nameOf = id => { const p = S?.players.find(q => q.id === id); return p ? `<b style="color:${p.color}">${esc(p.name)}</b>` : '?'; };
function scoreTable() {
  const rows = S.players.slice().sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  return `<table><tr><th>#</th><th>Joueur</th><th>Élim.</th><th>Morts</th><th>Ping</th></tr>${rows.map((p, i) =>
    `<tr class="${p.id === api.myId ? 'me' : ''}"><td>${i + 1}</td><td><span class="dot" style="background:${p.color}"></span> ${esc(p.name)}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${Math.round(p.ping)}</td></tr>`).join('')}</table>`;
}
const fmt = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// ---------------- Entrées ----------------
function bindInput() {
  const cv = renderer.domElement;
  on(cv, 'click', () => { if (!document.pointerLockElement) lock(); });
  on(document, 'pointerlockchange', () => {
    const locked = document.pointerLockElement === cv;
    hud.pause.classList.toggle('hide', locked);
    if (!locked) { mouseDown = false; zoom = false; for (const k in keys) keys[k] = false; }
  });
  on(document, 'mousemove', e => {
    if (document.pointerLockElement !== cv) return;
    const k = 0.0022 * sens * (zoom ? (weapon === 'rail' ? 0.3 : 0.65) : 1);
    me.yaw -= e.movementX * k; me.pitch = Math.max(-1.55, Math.min(1.55, me.pitch - e.movementY * k));
  });
  on(document, 'mousedown', e => {
    if (document.pointerLockElement !== cv) return;
    if (e.button === 0) { mouseDown = true; tryFire(performance.now()); }
    if (e.button === 2 && !reloadEnd) zoom = true;
  });
  on(document, 'mouseup', e => { if (e.button === 0) mouseDown = false; if (e.button === 2) zoom = false; });
  on(document, 'contextmenu', e => e.preventDefault());
  on(document, 'wheel', e => {
    if (document.pointerLockElement !== cv) return;
    const i = ORDER.indexOf(weapon); selectWeapon(ORDER[(i + (e.deltaY > 0 ? 1 : 2)) % 3]);
  });
  on(document, 'keydown', e => {
    if (e.code === 'Tab') { e.preventDefault(); hud.board.innerHTML = scoreTable(); hud.board.classList.remove('hide'); return; }
    if (document.pointerLockElement !== cv) return;
    keys[e.code] = true;
    if (e.code === 'KeyR') startReload();
    if (e.code === 'Digit1') selectWeapon('rifle');
    if (e.code === 'Digit2') selectWeapon('shotgun');
    if (e.code === 'Digit3') selectWeapon('rail');
    if (e.code === 'Space') e.preventDefault();
  });
  on(document, 'keyup', e => { keys[e.code] = false; if (e.code === 'Tab') hud.board.classList.add('hide'); });
  on(window, 'resize', () => {
    renderer.setSize(innerWidth, innerHeight); composer?.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  });
}

// =====================================================================
export default {
  mount(r, a) {
    api = a; ST = a.static;
    boxes = []; solidMeshes = []; padMeshes = []; pickupMeshes = {}; remotes.clear(); fx.length = 0;
    lastSpawnN = -1; lastCorrN = -1; S = null;
    if (!document.getElementById('ar-css')) { const st = document.createElement('style'); st.id = 'ar-css'; st.textContent = CSS; document.head.appendChild(st); }
    root = document.createElement('div'); root.className = 'ar'; r.appendChild(root);
    clock = new THREE.Clock();
    buildHud();
    buildScene();
    bindInput();
    hud.el.querySelector('.fl').textContent = '?';
    renderWeaponHud();
    loop();
  },

  update(s) {
    const prev = S; S = s;
    const now = performance.now();
    hud.el.querySelector('.fl').textContent = s.fragLimit;
    // joueurs distants
    const seen = new Set();
    for (const p of s.players) {
      if (p.id === api.myId) { me.alive = p.alive; continue; }
      seen.add(p.id);
      let rm = remotes.get(p.id);
      if (!rm) { rm = makeRemote(p); remotes.set(p.id, rm); }
      if (!p.alive || !rm.alive) rm.buf = [];
      rm.alive = p.alive;
      rm.buf.push({ t: now, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch });
      if (rm.buf.length > 30) rm.buf.shift();
    }
    for (const [id, rm] of remotes) if (!seen.has(id)) { scene.remove(rm.g); remotes.delete(id); }
    // moi
    const m = s.me;
    if (m) {
      if (m.spawnN !== lastSpawnN) {
        lastSpawnN = m.spawnN;
        me.pos.set(m.x, m.y, m.z); me.vel.set(0, 0, 0); me.yaw = m.yaw; me.pitch = 0;
        ammo = { ...m.ammo }; reloadEnd = 0; renderWeaponHud();
      } else if (m.corrN !== lastCorrN && lastCorrN !== -1) { me.pos.set(m.x, m.y, m.z); me.vel.set(0, 0, 0); }
      lastCorrN = m.corrN;
      hud.hp.textContent = Math.max(0, m.hp);
      hud.hp.style.color = m.hp <= 30 ? '#f87171' : '#fff';
      hud.hpb.style.width = Math.max(0, m.hp) + '%';
      hud.arb.style.width = m.armor + '%';
      if (!me.alive && s.phase === 'play') {
        hud.msg.innerHTML = `<div class="big">ÉLIMINÉ</div>${m.killer && m.killer !== api.myId ? `par ${nameOf(m.killer)}<br>` : ''}Réapparition dans ${Math.ceil(m.respawnIn / 1000)} s`;
      } else hud.msg.innerHTML = m.protected ? '<span style="color:#67e8f9">🛡 Protection d’apparition</span>' : '';
    }
    for (const [id, pm] of Object.entries(pickupMeshes)) pm.g.visible = s.pickups.includes(+id);
    // en-tête
    hud.timer.textContent = s.phase === 'play' ? '⏱ ' + fmt(s.left) : 'Prochain match ' + fmt(s.left);
    const lead = s.players.slice().sort((a, b) => b.kills - a.kills)[0];
    const mine = s.players.find(p => p.id === api.myId);
    hud.lead.innerHTML = lead ? `👑 ${esc(lead.name)} ${lead.kills}/${s.fragLimit}${mine && lead !== mine ? ` · vous ${mine.kills}` : ''}` : '';
    hud.ping.textContent = `${Math.round(rtt)} ms`;
    if (!hud.board.classList.contains('hide')) hud.board.innerHTML = scoreTable();
    // fin de match
    if (s.phase === 'end') {
      hud.end.classList.remove('hide');
      hud.end.innerHTML = `<h1>🏆 ${s.winner ? nameOf(s.winner) : '—'} gagne le match !</h1><p style="color:#93a0c4">Nouveau match dans ${Math.ceil(s.left / 1000)} s</p>${scoreTable()}`;
      hud.msg.innerHTML = '';
    } else if (prev?.phase === 'end' || !hud.end.classList.contains('hide')) hud.end.classList.add('hide');
  },

  event(e) {
    switch (e.type) {
      case 'shot': {
        if (e.by === api.myId) return;
        const r = remotes.get(e.by);
        const o = new THREE.Vector3(...e.o);
        if (r) { const side = new THREE.Vector3(Math.cos(r.g.rotation.y), 0, -Math.sin(r.g.rotation.y)); o.addScaledVector(side, 0.3).y -= 0.3; }
        for (const end of e.ends) { const v = new THREE.Vector3(end[0], end[1], end[2]); tracer(o, v, e.w); if (!end[3]) sparks(v, 0xfde68a, 3); }
        const dist = o.distanceTo(camera.position);
        sfx(e.w, Math.max(0, 1 - dist / 70) * 0.7);
        break;
      }
      case 'hit':
        hud.hitm.style.color = e.kill ? '#f87171' : e.head ? '#facc15' : '#fff';
        hud.hitm.style.opacity = 1; hud.hitm.style.transform = `scale(${e.kill ? 1.5 : 1})`;
        clearTimeout(hud.hitm._h); hud.hitm._h = setTimeout(() => { hud.hitm.style.opacity = 0; }, 160);
        sfx(e.kill ? 'kill' : e.head ? 'head' : 'hit');
        break;
      case 'hurt': {
        hud.vig.style.opacity = Math.min(1, 0.4 + e.dmg / 60);
        clearTimeout(hud.vig._h); hud.vig._h = setTimeout(() => { hud.vig.style.opacity = 0; }, 250);
        const ang = Math.atan2(e.from[0] - me.pos.x, e.from[2] - me.pos.z);
        const rel = -(ang - Math.atan2(-Math.sin(me.yaw), -Math.cos(me.yaw)));
        hud.dir.style.transform = `rotate(${rel}rad)`; hud.dir.style.opacity = 1;
        clearTimeout(hud.dir._h); hud.dir._h = setTimeout(() => { hud.dir.style.opacity = 0; }, 700);
        shake = Math.max(shake, 0.06); sfx('hurt');
        break;
      }
      case 'kill': {
        const wIcon = (e.head ? '🎯 ' : '') + (ICON[e.weapon] || '');
        const mine = e.killer === api.myId || e.victim === api.myId;
        feed(e.killer ? `${nameOf(e.killer)} ${wIcon} ${nameOf(e.victim)}` : `${nameOf(e.victim)} ${ICON.fall}`, mine);
        const r = remotes.get(e.victim);
        const col = r ? r.color : '#ffffff';
        sparks(new THREE.Vector3(e.x, e.y + 1, e.z), new THREE.Color(col).getHex(), 30, 7, 1.0);
        if (e.victim === api.myId) { sfx('death'); zoom = false; mouseDown = false; }
        if (e.killer === api.myId && e.victim !== api.myId) {
          const streak = { 3: 'SÉRIE DE 3 !', 5: 'IMPARABLE !', 8: 'LÉGENDAIRE !', 12: 'DIVIN !' }[e.streak];
          pop(streak || `${e.head ? '🎯 TIR À LA TÊTE · ' : ''}Vous avez éliminé ${S?.players.find(p => p.id === e.victim)?.name || ''}`);
        }
        break;
      }
      case 'pickup':
        sfx('pickup'); pop(e.kind === 'health' ? '+50 ❤️ Santé' : '+50 🛡 Armure', e.kind === 'health' ? '#4ade80' : '#60a5fa');
        break;
      case 'pong': rtt = rtt * 0.6 + (performance.now() - e.c) * 0.4; break;
      case 'info': feed(esc(e.text)); break;
      case 'matchStart': pop('⚔️ NOUVEAU MATCH !', '#22d3ee'); break;
      case 'matchEnd': zoom = false; break;
    }
  },

  unmount() {
    cancelAnimationFrame(raf);
    for (const [el, ev, fn, opt] of listeners) el.removeEventListener(ev, fn, opt);
    listeners.length = 0;
    if (document.pointerLockElement) document.exitPointerLock();
    renderer?.dispose(); composer = null;
    root?.remove();
  },
};
