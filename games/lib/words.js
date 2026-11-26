// Listes de mots français partagées (Imposteur, Draw & Guess)
const CATS = {
  animaux: 'chat chien lion tigre éléphant girafe zèbre singe ours loup renard lapin souris cheval vache cochon mouton poule canard pingouin dauphin requin baleine poisson pieuvre crabe tortue serpent crocodile grenouille papillon abeille fourmi araignée escargot hibou aigle perroquet chameau kangourou koala panda hérisson écureuil castor flamant chauve-souris licorne dragon'.split(' '),
  nourriture: 'pizza burger frite pâtes sushi croissant baguette fromage pomme banane fraise cerise ananas pastèque citron orange carotte tomate brocoli champignon oignon gâteau crêpe glace chocolat bonbon biscuit sandwich soupe salade œuf poulet saucisse popcorn donut tarte café thé lait yaourt miel raisin'.split(' '),
  objets: 'chaise table lampe téléphone ordinateur clavier télévision horloge montre lunettes parapluie ciseaux crayon livre sac valise clé bouteille verre tasse fourchette couteau cuillère marteau tournevis échelle bougie miroir oreiller lit canapé guitare piano tambour ballon vélo trottinette voiture avion bateau fusée robot appareil-photo casque bague couronne'.split(' '),
  lieux: 'plage montagne forêt désert île volcan château école hôpital bibliothèque musée cinéma restaurant boulangerie piscine stade aéroport gare port ferme zoo cirque prison église pyramide phare grotte jungle cascade parc supermarché'.split(' '),
  metiers: 'pompier policier médecin infirmier boulanger cuisinier pilote astronaute professeur facteur coiffeur dentiste vétérinaire jardinier plombier électricien peintre chanteur danseur magicien pirate chevalier sorcier clown détective juge agriculteur pêcheur photographe'.split(' '),
  actions: 'dormir courir nager sauter danser chanter manger cuisiner lire écrire dessiner peindre conduire voler pleurer rire crier pêcher skier surfer grimper jongler bâiller éternuer applaudir'.split(' '),
  nature: 'soleil lune étoile nuage pluie neige arc-en-ciel éclair tornade arbre fleur rose cactus feuille herbe rivière océan vague sable caillou'.split(' '),
};
// Paires proches pour le mode « mot voisin » de l'Imposteur
const PAIRS = [
  ['chat', 'chien'], ['lion', 'tigre'], ['loup', 'renard'], ['dauphin', 'requin'], ['abeille', 'guêpe'], ['cheval', 'âne'], ['grenouille', 'crapaud'], ['hibou', 'aigle'], ['poule', 'canard'], ['vache', 'chèvre'],
  ['pizza', 'tarte'], ['burger', 'sandwich'], ['croissant', 'brioche'], ['fraise', 'framboise'], ['citron', 'orange'], ['café', 'thé'], ['glace', 'sorbet'], ['crêpe', 'gaufre'], ['pâtes', 'riz'], ['beurre', 'confiture'],
  ['plage', 'piscine'], ['montagne', 'colline'], ['forêt', 'jungle'], ['château', 'palais'], ['école', 'université'], ['cinéma', 'théâtre'], ['hôpital', 'pharmacie'], ['gare', 'aéroport'], ['zoo', 'ferme'], ['île', 'désert'],
  ['guitare', 'violon'], ['piano', 'orgue'], ['vélo', 'trottinette'], ['voiture', 'camion'], ['avion', 'hélicoptère'], ['bateau', 'sous-marin'], ['téléphone', 'tablette'], ['chaise', 'tabouret'], ['lampe', 'bougie'], ['montre', 'horloge'],
  ['pompier', 'policier'], ['médecin', 'infirmier'], ['boulanger', 'pâtissier'], ['pirate', 'corsaire'], ['magicien', 'sorcier'], ['chanteur', 'rappeur'], ['astronaute', 'pilote'], ['professeur', 'directeur'], ['détective', 'espion'], ['clown', 'mime'],
  ['football', 'rugby'], ['tennis', 'badminton'], ['ski', 'snowboard'], ['natation', 'plongée'], ['Noël', 'Pâques'], ['été', 'printemps'], ['soleil', 'lune'], ['pluie', 'neige'], ['océan', 'lac'], ['rose', 'tulipe'],
];
const ALL = [...new Set(Object.values(CATS).flat())];
const norm = w => String(w).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]/g, '');
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
module.exports = { CATS, PAIRS, ALL, norm, lev };
