// =====================================================================
//  ARÈNE NÉON — règles (serveur)
//  FPS 3D en match à mort (chacun pour soi). Le moteur commun
//  (games/lib/fps.js) gère tirs, dégâts, bots et réapparitions ;
//  ce fichier décrit la carte et les réglages.
// =====================================================================
const makeFps = require('./lib/fps');

// --- Carte ------------------------------------------------------------
// Boîte : x,z = centre ; y = bas ; w,h,d = tailles ; c = couleur des arêtes
const B = (x, y, z, w, h, d, c = 'cyan') => ({ x, y, z, w, h, d, c });
const SIZE = 80, H = SIZE / 2;
function buildMap() {
  const MAP = { size: SIZE, boxes: [], pads: [], spawns: [], pickups: [] };
  const b = MAP.boxes;
  // murs
  b.push(B(0, 0, -H - 1, SIZE + 4, 8, 2, 'magenta'), B(0, 0, H + 1, SIZE + 4, 8, 2, 'magenta'),
    B(-H - 1, 0, 0, 2, 8, SIZE, 'magenta'), B(H + 1, 0, 0, 2, 8, SIZE, 'magenta'));
  // tour centrale + escaliers nord/sud
  b.push(B(0, 0, 0, 12, 3.5, 12, 'yellow'));
  for (let k = 0; k < 7; k++) {
    const h = 0.5 * (k + 1);
    b.push(B(0, 0, 6 + 6.5 - k, 3, h, 1, 'yellow'), B(0, 0, -6 - 6.5 + k, 3, h, 1, 'yellow'));
  }
  b.push(B(-3, 3.5, 0, 0.6, 1.2, 8, 'yellow'), B(3, 3.5, 0, 0.6, 1.2, 8, 'yellow')); // parapets
  // plateformes d'angle (accès par tremplin)
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    b.push(B(sx * 30, 0, sz * 30, 12, 5, 12, 'magenta'));
    b.push(B(sx * 35.7, 5, sz * 30, 0.6, 1, 12, 'magenta'), B(sx * 30, 5, sz * 35.7, 12, 1, 0.6, 'magenta')); // garde-corps extérieurs
    MAP.pads.push({ x: sx * 20.5, z: sz * 30, r: 1.4, power: 17, push: [sx * 9, 0] });
    MAP.pickups.push({ id: MAP.pickups.length, type: 'armor', x: sx * 30, y: 5, z: sz * 30 });
  }
  // couloirs / murets
  b.push(B(-16, 0, 0, 2, 3, 18), B(16, 0, 0, 2, 3, 18), B(0, 0, -22, 18, 3, 2), B(0, 0, 22, 18, 3, 2));
  // caisses
  const crates = [[-10, -12, 2], [10, 12, 2], [-12, 12, 2.5], [12, -12, 2.5], [-24, 8, 2], [24, -8, 2], [8, -30, 2], [-8, 30, 2],
    [-30, -8, 3], [30, 8, 3], [-22, -20, 1.5], [22, 20, 1.5], [20, -26, 2], [-20, 26, 2]];
  for (const [x, z, s] of crates) if (s) b.push(B(x, 0, z, s, s, s, 'lime'));
  b.push(B(-10, 2, -12, 1.2, 1.2, 1.2, 'lime'), B(10, 2, 12, 1.2, 1.2, 1.2, 'lime'));
  // piliers
  for (const [x, z] of [[-8, 16], [8, -16], [-26, -32], [26, 32], [34, -18], [-34, 18]]) b.push(B(x, 0, z, 1.6, 7, 1.6, 'cyan'));
  MAP.pads.push({ x: 7, z: -17, r: 1.4, power: 14, push: [0, 10] }, { x: -7, z: 17, r: 1.4, power: 14, push: [0, -10] });
  // spawns
  for (const [x, z] of [[-36, 0], [36, 0], [0, -37], [0, 37], [-20, -36], [20, 36], [-36, -20], [36, 20], [-14, 8], [14, -8], [-30, 20], [30, -20], [0, 13.6]])
    MAP.spawns.push({ x, z });
  // soins
  for (const [x, z] of [[0, 0], [-16, -14], [16, 14], [-34, 34], [34, -34]]) MAP.pickups.push({ id: MAP.pickups.length, type: 'health', x, y: x === 0 && z === 0 ? 3.5 : 0, z });
  return MAP;
}

module.exports = makeFps({
  id: 'arena', name: 'Arène Néon', mode: 'ffa', theme: 'neon',
  description: 'FPS 3D en match à mort dans une arène néon. Rejoignable à tout moment.',
  category: 'Action', icon: '⚡', color: '#06b6d4', order: 16,
  tags: ['🎯 FPS 3D', '🤖 Bots'],
  rules: `<ul><li><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> bouger · <kbd>Espace</kbd> sauter · <b>clic</b> tirer · <b>clic droit</b> viser</li>
    <li><kbd>R</kbd> recharger · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> ou molette : armes · <kbd>Tab</kbd> scores</li>
    <li>Tirs à la tête ×2 · Tremplins pour atteindre les plateformes · Soins 💚 et armures 💙 à ramasser.</li>
    <li>Ordinateur avec souris conseillé.</li></ul>`,
  settings: [
    { key: 'fragLimit', label: 'Éliminations pour gagner', type: 'number', default: 25, min: 5, max: 60, step: 5 },
    { key: 'time', label: 'Durée du match', type: 'number', default: 6, min: 2, max: 20, step: 1, unit: ' min' },
    { key: 'bots', label: 'Bots', type: 'select', default: 3, options: [{ v: 0, l: 'Aucun' }, { v: 3, l: '3' }, { v: 6, l: '6' }, { v: 10, l: '10' }] },
    { key: 'botLevel', label: 'Niveau des bots', type: 'select', default: 'normal', options: [{ v: 'facile', l: 'Facile' }, { v: 'normal', l: 'Normal' }, { v: 'fort', l: 'Fort' }] },
    { key: 'dmg', label: 'Dégâts des armes', type: 'select', default: 1, options: [{ v: 0.6, l: 'Réduits' }, { v: 1, l: 'Normaux' }, { v: 1.6, l: 'Instagib' }] },
  ],
  minPlayers: 1, maxPlayers: 16,
  buildMap,
});
