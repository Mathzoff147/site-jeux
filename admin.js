// =====================================================================
//  Donner un rôle à un compte depuis le terminal (le serveur peut tourner).
//    node admin.js MonPseudo            -> administrateur
//    node admin.js MonPseudo mod        -> modérateur
//    node admin.js MonPseudo user       -> joueur normal
//    node admin.js --liste              -> affiche les comptes de cette base
//  Ou au démarrage : ADMINS="Pseudo1,Pseudo2" npm start
// =====================================================================
process.removeAllListeners('warning');
const path = require('path');
const A = require('./server/admin');
const P = require('./server/platform');
const dbFile = path.join(P.DIR, 'salle.db');
const all = () => P.db.prepare('SELECT name, role FROM users ORDER BY created DESC').all();

const [name, role = 'admin'] = process.argv.slice(2);
console.log(`📁 Base de données utilisée : ${dbFile}`);
if (!name || name === '--liste') {
  const list = all();
  console.log(list.length ? `👤 ${list.length} compte(s) : ${list.map(u => u.name + (u.role !== 'user' ? ` (${u.role})` : '')).join(', ')}` : '👤 Aucun compte dans cette base.');
  if (!name) console.log('Utilisation : npm run admin -- <pseudo> [admin|mod|user]');
  process.exit(0);
}
try {
  const clean = name.trim();
  if (A.promoteByName(clean, role)) { console.log(`✔ ${clean} est maintenant : ${A.ROLE_NAMES[role]}. Rechargez la page du site.`); process.exit(0); }
  const list = all();
  console.log(`✖ Aucun compte nommé « ${clean} » dans cette base.`);
  if (!list.length) {
    console.log('   Cette base ne contient AUCUN compte. Le site sur lequel vous avez créé votre compte utilise donc une autre base :');
    console.log('   • lancez cette commande dans le MÊME dossier que celui où vous faites « npm start » ;');
    console.log('   • si le site est chez un hébergeur (Render, Railway…), lancez-la dans la console de l’hébergeur,');
    console.log(`     ou ajoutez la variable d’environnement ADMINS=${clean} puis redémarrez le site.`);
  } else {
    const close = list.filter(u => u.name.toLowerCase().includes(clean.toLowerCase().slice(0, 3)));
    console.log(`   Comptes présents : ${list.slice(0, 30).map(u => u.name).join(', ')}${list.length > 30 ? '…' : ''}`);
    if (close.length) console.log(`   Vouliez-vous dire : ${close.map(u => u.name).join(', ')} ?`);
  }
  process.exit(1);
} catch (e) { console.log('✖ ' + e.message); process.exit(1); }
