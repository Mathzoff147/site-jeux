// Outils partagés par les jeux (serveur). Ce dossier n'est pas chargé comme un jeu.
const U = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  chance: p => Math.random() < p,
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  angDiff: (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a)),
  r1: v => Math.round(v * 10) / 10,
  r2: v => Math.round(v * 100) / 100,

  // Pousse un cercle {x,y,r} hors d'un rectangle {x,y,w,h}. Retourne true s'il y avait contact.
  pushOutRect(c, o) {
    const nx = U.clamp(c.x, o.x, o.x + o.w), ny = U.clamp(c.y, o.y, o.y + o.h);
    let dx = c.x - nx, dy = c.y - ny, d = Math.hypot(dx, dy);
    if (d >= c.r) return false;
    if (d === 0) { // centre à l'intérieur : sortir par le côté le plus proche
      const l = c.x - o.x, r = o.x + o.w - c.x, t = c.y - o.y, b = o.y + o.h - c.y, m = Math.min(l, r, t, b);
      if (m === l) c.x = o.x - c.r; else if (m === r) c.x = o.x + o.w + c.r; else if (m === t) c.y = o.y - c.r; else c.y = o.y + o.h + c.r;
      return true;
    }
    c.x = nx + dx / d * c.r; c.y = ny + dy / d * c.r;
    return true;
  },
  circleRect: (c, o) => Math.hypot(c.x - U.clamp(c.x, o.x, o.x + o.w), c.y - U.clamp(c.y, o.y, o.y + o.h)) < c.r,
  // Sépare deux cercles (masses égales, ou a immobile si fixedA)
  separate(a, b, fixedA) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, o = a.r + b.r - d;
    if (o <= 0) return false;
    const nx = dx / d, ny = dy / d;
    if (fixedA) { b.x += nx * o; b.y += ny * o; } else { a.x -= nx * o / 2; a.y -= ny * o / 2; b.x += nx * o / 2; b.y += ny * o / 2; }
    return true;
  },
  // Distance le long d'un rayon (ox,oy)+(dx,dy)*t vers un cercle ; Infinity si raté
  rayCircle(ox, oy, dx, dy, cx, cy, r) {
    const fx = ox - cx, fy = oy - cy, b = fx * dx + fy * dy, c = fx * fx + fy * fy - r * r, h = b * b - c;
    if (h < 0) return Infinity;
    const t = -b - Math.sqrt(h);
    return t >= 0 ? t : (c < 0 ? 0 : Infinity);
  },
  rayRect(ox, oy, dx, dy, o) {
    let t0 = 0, t1 = Infinity;
    for (const [p, d, mn, mx] of [[ox, dx, o.x, o.x + o.w], [oy, dy, o.y, o.y + o.h]]) {
      if (Math.abs(d) < 1e-9) { if (p < mn || p > mx) return Infinity; continue; }
      let a = (mn - p) / d, b = (mx - p) / d; if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return Infinity;
    }
    return t0;
  },
  // Ligne de vue entre deux points (aucun obstacle)
  los(ax, ay, bx, by, obstacles) {
    const L = Math.hypot(bx - ax, by - ay) || 1, dx = (bx - ax) / L, dy = (by - ay) / L;
    return !obstacles.some(o => U.rayRect(ax, ay, dx, dy, o) < L);
  },

  // Obstacles rectangulaires aléatoires qui ne chevauchent pas les zones protégées {x,y,r}
  makeObstacles(W, H, n, minS, maxS, keepOut = [], margin = 40) {
    const out = [];
    for (let tries = 0; out.length < n && tries < n * 60; tries++) {
      const w = U.rand(minS, maxS), h = U.rand(minS, maxS) * U.rand(0.4, 1);
      const o = { x: U.rand(margin, W - w - margin), y: U.rand(margin, H - h - margin), w, h };
      if (keepOut.some(k => U.circleRect({ x: k.x, y: k.y, r: k.r }, o))) continue;
      if (out.some(p => o.x < p.x + p.w + 50 && o.x + o.w + 50 > p.x && o.y < p.y + p.h + 50 && o.y + o.h + 50 > p.y)) continue;
      out.push(o);
    }
    return out;
  },

  // Entrées temps réel envoyées par le client : { type:'in', u,d,l,r, a, f, f2, seq }
  readInput(a) {
    return { u: !!a.u, d: !!a.d, l: !!a.l, r: !!a.r, a: Number.isFinite(+a.a) ? +a.a : 0, f: !!a.f, f2: !!a.f2, x: +a.x || 0, y: +a.y || 0 };
  },
  // Vecteur de déplacement normalisé à partir des touches
  moveVec(inp) {
    let x = (inp.r ? 1 : 0) - (inp.l ? 1 : 0), y = (inp.d ? 1 : 0) - (inp.u ? 1 : 0);
    const L = Math.hypot(x, y); if (L) { x /= L; y /= L; }
    return { x, y };
  },
};
// Classement générique pour la fin de partie : list = [{ id, score, win? }]
U.rank = (list, desc = true) => {
  const sorted = list.slice().sort((a, b) => (b.win ? 1 : 0) - (a.win ? 1 : 0) || (desc ? b.score - a.score : a.score - b.score));
  let place = 0, prev;
  return sorted.map((p, i) => { if (i === 0 || p.score !== prev || p.win) place = i + 1; prev = p.score; return { ...p, place, win: !!p.win || (place === 1 && p.win === undefined) }; });
};
module.exports = U;
