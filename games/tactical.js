// =====================================================================
//  TACTICAL STRIKE — règles (serveur)
//  FPS 3D en 5 contre 5, manches à élimination ou capture de zone.
//  Chaque agent possède une capacité spéciale. Bots pour compléter.
// =====================================================================
const makeFps = require('./lib/fps');

const B = (x, y, z, w, h, d, c = 'orange') => ({ x, y, z, w, h, d, c });
function buildMap(o) {
  const SIZE = 90, H = SIZE / 2;
  const M = { size: SIZE, boxes: [], pads: [], spawns: [], pickups: [], teamSpawns: [[], []], zone: { x: 0, z: 0, r: 5 } };
  const b = M.boxes;
  b.push(B(0, 0, -H - 1, SIZE + 4, 9, 2, 'steel'), B(0, 0, H + 1, SIZE + 4, 9, 2, 'steel'), B(-H - 1, 0, 0, 2, 9, SIZE, 'steel'), B(H + 1, 0, 0, 2, 9, SIZE, 'steel'));
  // séparations des allées
  for (const s of [-1, 1]) {
    b.push(B(-15, 0, s * 13, 18, 4, 1.2, 'steel'), B(15, 0, s * 13, 18, 4, 1.2, 'steel'));
    b.push(B(-31, 0, s * 20, 1.2, 4, 14, 'steel'), B(31, 0, s * 20, 1.2, 4, 14, 'steel'));
    // bases
    b.push(B(s * 34, 0, -8, 1.2, 3.2, 6, 'steel'), B(s * 34, 0, 8, 1.2, 3.2, 6, 'steel'));
  }
  // zone centrale : caisses basses
  for (const [x, z, sz] of [[-3.5, -3.5, 1.4], [3.5, 3.5, 1.4], [3.5, -3.5, 1.2], [-3.5, 3.5, 1.2], [0, 0, 1.0]]) b.push(B(x, 0, z, sz, sz, sz, 'crate'));
  // allées nord/sud : conteneurs et caisses
  for (const s of [-1, 1]) {
    for (const [x, w] of [[-20, 6], [0, 8], [20, 6]]) b.push(B(x, 0, s * 26, w, 2.6, 2.6, 'container'));
    for (const [x, z] of [[-10, 20], [10, 20], [-10, 33], [10, 33], [-25, 37], [25, 37]]) b.push(B(x, 0, s * z, 2, 2, 2, 'crate'));
    b.push(B(0, 0, s * 38, 3, 3.2, 3, 'container'));
  }
  // couloir central : couverts
  for (const [x, z] of [[-14, 0], [14, 0], [-22, 5], [22, -5], [-22, -6], [22, 6]]) b.push(B(x, 0, z, 2.2, 1.6, 2.2, 'crate'));
  b.push(B(-9, 0, 7, 1, 3, 4, 'steel'), B(9, 0, -7, 1, 3, 4, 'steel'));
  // piliers
  for (const [x, z] of [[-26, 0], [26, 0], [0, -20], [0, 20]]) b.push(B(x, 0, z, 1.4, 8, 1.4, 'steel'));
  for (let k = 0; k < 6; k++) {
    const z = -7.5 + k * 3;
    M.teamSpawns[0].push({ x: -40, z, yaw: -Math.PI / 2 });
    M.teamSpawns[1].push({ x: 40, z, yaw: Math.PI / 2 });
  }
  M.spawns = [...M.teamSpawns[0], ...M.teamSpawns[1]];
  if (o.zone === false) M.zone = null;
  return M;
}

module.exports = makeFps({
  id: 'tactical', name: 'Tactical Strike', mode: 'rounds', theme: 'industrial',
  description: 'FPS 3D en 5 contre 5 : choisissez un agent et sa capacité, éliminez l’équipe adverse ou capturez la zone.',
  category: 'Action', icon: '🎯', color: '#dc2626', order: 7,
  tags: ['👥 5 contre 5', '🦸 Agents'],
  rules: `<ul><li>Deux équipes, <b style="color:#f87171">Rouges</b> contre <b style="color:#60a5fa">Bleus</b>. Pas de réapparition pendant une manche !</li>
    <li>Gagnez la manche en <b>éliminant</b> toute l’équipe adverse ou en <b>capturant la zone</b> centrale (restez-y seuls 8 s).</li>
    <li><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> bouger · <b>clic</b> tirer · <b>clic droit</b> viser · <kbd>R</kbd> recharger · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> armes · <kbd>E</kbd> capacité de l’agent</li>
    <li>Agents : ⚡ Éclair (ruée) · 🛡️ Rempart (mur) · 💉 Infirmière (soin de groupe) · 📡 Éclaireur (radar) · 💣 Grenadier (grenade).</li></ul>`,
  settings: [
    { key: 'teamSize', label: 'Joueurs par équipe (avec bots)', type: 'select', default: 5, options: [{ v: 2, l: '2 contre 2' }, { v: 3, l: '3 contre 3' }, { v: 5, l: '5 contre 5' }] },
    { key: 'toWin', label: 'Manches pour gagner', type: 'select', default: 5, options: [{ v: 3, l: '3' }, { v: 5, l: '5' }, { v: 7, l: '7' }, { v: 9, l: '9' }] },
    { key: 'roundTime', label: 'Durée d’une manche', type: 'select', default: 100, options: [{ v: 60, l: '1 min' }, { v: 100, l: '1 min 40' }, { v: 150, l: '2 min 30' }] },
    { key: 'zone', label: 'Zone de capture', type: 'toggle', default: true },
    { key: 'bots', label: 'Compléter avec des bots', type: 'toggle', default: true },
    { key: 'botLevel', label: 'Niveau des bots', type: 'select', default: 'normal', options: [{ v: 'facile', l: 'Facile' }, { v: 'normal', l: 'Normal' }, { v: 'fort', l: 'Fort' }] },
  ],
  minPlayers: 1, maxPlayers: 10,
  respawn: Infinity,
  buildMap,
});
