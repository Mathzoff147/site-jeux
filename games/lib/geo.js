// Outils de géométrie et de physique partagés par les jeux en temps réel
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
};

// Repousse un cercle {x, y, r} hors d'un rectangle {x, y, w, h}. Renvoie true si contact.
function pushOutOfRect(c, rect) {
  const nx = clamp(c.x, rect.x, rect.x + rect.w);
  const ny = clamp(c.y, rect.y, rect.y + rect.h);
  let dx = c.x - nx, dy = c.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= c.r * c.r) return false;
  if (d2 === 0) { // centre dans le rectangle : sortie par le côté le plus proche
    const left = c.x - rect.x, right = rect.x + rect.w - c.x, top = c.y - rect.y, bottom = rect.y + rect.h - c.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) c.x = rect.x - c.r; else if (m === right) c.x = rect.x + rect.w + c.r;
    else if (m === top) c.y = rect.y - c.r; else c.y = rect.y + rect.h + c.r;
    return true;
  }
  const d = Math.sqrt(d2);
  c.x = nx + (dx / d) * c.r;
  c.y = ny + (dy / d) * c.r;
  return true;
}

const pointInRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Distance d'un point à un segment
function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1);
  return { d: dist(px, py, ax + t * vx, ay + t * vy), x: ax + t * vx, y: ay + t * vy, t };
}

// Sépare deux cercles qui se chevauchent
function separate(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 0.01;
  const overlap = a.r + b.r - d;
  if (overlap <= 0) return false;
  const ux = dx / d, uy = dy / d;
  a.x -= ux * overlap / 2; a.y -= uy * overlap / 2;
  b.x += ux * overlap / 2; b.y += uy * overlap / 2;
  return true;
}

// Mouvement "vue de dessus" à partir des touches (u, d, l, r)
function moveTopDown(e, input, speed, dt) {
  let mx = (input.r ? 1 : 0) - (input.l ? 1 : 0);
  let my = (input.d ? 1 : 0) - (input.u ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len) { mx /= len; my /= len; }
  e.x += mx * speed * dt;
  e.y += my * speed * dt;
  return len > 0;
}

// Génère des obstacles rectangulaires qui ne touchent pas les zones protégées
function makeObstacles(W, H, count, minS, maxS, keepOut = []) {
  const obs = [];
  let tries = 0;
  while (obs.length < count && tries++ < count * 30) {
    const w = randInt(minS, maxS), h = randInt(minS, maxS);
    const o = { x: randInt(40, W - w - 40), y: randInt(40, H - h - 40), w, h };
    const bad = keepOut.some(k => o.x < k.x + k.r && o.x + o.w > k.x - k.r && o.y < k.y + k.r && o.y + o.h > k.y - k.r)
      || obs.some(p => o.x < p.x + p.w + 30 && o.x + o.w + 30 > p.x && o.y < p.y + p.h + 30 && o.y + o.h + 30 > p.y);
    if (!bad) obs.push(o);
  }
  return obs;
}

// Arrondit les nombres pour alléger les messages envoyés
const r1 = (v) => Math.round(v * 10) / 10;

module.exports = { clamp, dist, rand, randInt, pick, shuffle, pushOutOfRect, pointInRect, distToSegment, separate, moveTopDown, makeObstacles, r1 };
