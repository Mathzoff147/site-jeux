// =====================================================================
//  Donner un rôle à un compte depuis le terminal (le serveur peut tourner).
//    node admin.js MonPseudo            -> administrateur
//    node admin.js MonPseudo mod        -> modérateur
//    node admin.js MonPseudo user       -> joueur normal
//  Ou au démarrage : ADMINS="Pseudo1,Pseudo2" npm start
// =====================================================================
process.removeAllListeners('warning');
const A = require('./server/admin');
const [name, role = 'admin'] = process.argv.slice(2);
if (!name) { console.log('Utilisation : node admin.js <pseudo> [admin|mod|user]'); process.exit(1); }
try {
  if (A.promoteByName(name, role)) console.log(`✔ ${name} est maintenant : ${A.ROLE_NAMES[role]}. Rechargez la page du site.`);
  else console.log(`✖ Aucun compte nommé « ${name} ». Créez-le d'abord sur le site.`);
} catch (e) { console.log('✖ ' + e.message); }
