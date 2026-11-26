// =====================================================================
//  Contenu de la plateforme : rangs, boutique, succès, défis, records,
//  tournois, actualités et aide.
// =====================================================================
const pick = a => a[Math.floor(Math.random() * a.length)];
const hashStr = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

const GAMES = { cards: 'Couleurs Express', empire: 'Empire Immobilier', impostor: 'Imposteur', chess: 'Échecs', fallrace: 'Fall Race', royale: 'Mini Battle Royale', tactical: 'Tactical Strike',
  draw: 'Draw & Guess', blocks: 'Block World', quest: 'Fantasy Quest', carball: 'Car Football', zombie: 'Zombie Survival', poker: 'Poker Hold’em', blackjack: 'Blackjack', kart: 'Kart Racing', towers: 'Tower Defense', arena: 'Arène Néon' };
const CATEGORY = { cards: 'cartes', empire: 'cartes', poker: 'cartes', blackjack: 'cartes', impostor: 'fete', draw: 'fete', chess: 'reflexion', towers: 'reflexion', fallrace: 'course', kart: 'course',
  royale: 'action', tactical: 'action', zombie: 'action', arena: 'action', blocks: 'monde', quest: 'monde', carball: 'sport' };
const RANKED = ['chess', 'cards', 'poker', 'blackjack', 'carball', 'tactical', 'royale', 'kart', 'fallrace', 'arena', 'impostor', 'draw', 'empire'];

const RANKS = [
  { id: 'bronze', name: 'Bronze', icon: '🥉', min: 0, color: '#b45309', reward: 100 },
  { id: 'argent', name: 'Argent', icon: '🥈', min: 1050, color: '#94a3b8', reward: 250 },
  { id: 'or', name: 'Or', icon: '🥇', min: 1150, color: '#eab308', reward: 500 },
  { id: 'platine', name: 'Platine', icon: '💠', min: 1250, color: '#2dd4bf', reward: 800 },
  { id: 'diamant', name: 'Diamant', icon: '💎', min: 1400, color: '#60a5fa', reward: 1200 },
  { id: 'maitre', name: 'Maître', icon: '👑', min: 1600, color: '#c084fc', reward: 2000 },
];

// ---------------- Boutique ----------------
const EMOJIS = ['😎', '🦊', '🐼', '🐸', '🦁', '🐙', '🤖', '👾', '🐱', '🐶', '🐵', '🦄', '🐲', '👻', '🎃', '🧙', '🥷', '🧛', '🧜', '🦖', '🐧', '🦉', '🐯', '🐨', '🍕', '⚽', '🎮', '🚀', '🌈', '🔥', '⭐', '💀', '🛡️', '⚔️', '🏰', '🐉', '👑'];
const ITEMS = [
  // couleurs en jeu (skin du personnage)
  ...[['default', 'Couleur auto', null, 0], ['crimson', 'Cramoisi', '#dc2626', 150], ['ocean', 'Océan', '#0284c7', 150], ['emerald', 'Émeraude', '#059669', 150], ['sun', 'Soleil', '#eab308', 150],
    ['violet', 'Violet royal', '#7c3aed', 200], ['rose', 'Rose bonbon', '#ec4899', 200], ['cyan', 'Néon cyan', '#06b6d4', 250], ['orange', 'Orange volcan', '#ea580c', 250], ['snow', 'Blanc neige', '#f1f5f9', 400], ['shadow', 'Ombre', '#1f2937', 400], ['gold', 'Or massif', '#d4a017', 1200, 15]]
    .map(([id, name, value, price, level]) => ({ id: 'color_' + id, slot: 'color', name, value, price, level, icon: '🎨' })),
  // cadres d'avatar
  ...[['bronze', 'Cadre bronze', 'linear-gradient(135deg,#b45309,#fcd34d)', 200], ['silver', 'Cadre argent', 'linear-gradient(135deg,#94a3b8,#f8fafc)', 400], ['gold', 'Cadre doré', 'linear-gradient(135deg,#ca8a04,#fef08a,#ca8a04)', 900, 10],
    ['neon', 'Cadre néon', 'linear-gradient(135deg,#22d3ee,#a855f7,#ec4899)', 700], ['fire', 'Cadre de feu', 'linear-gradient(0deg,#dc2626,#f97316,#fde047)', 800], ['nature', 'Cadre nature', 'linear-gradient(135deg,#166534,#84cc16)', 400],
    ['galaxy', 'Cadre galaxie', 'conic-gradient(#1e1b4b,#7c3aed,#ec4899,#1e1b4b)', 1500, 20], ['rainbow', 'Cadre arc-en-ciel', 'conic-gradient(#ef4444,#f59e0b,#22c55e,#3b82f6,#a855f7,#ef4444)', 2500, 30]]
    .map(([id, name, value, price, level]) => ({ id: 'frame_' + id, slot: 'frame', name, value, price, level, icon: '🖼️' })),
  // couleur du pseudo
  ...[['gold', 'Pseudo doré', '#fbbf24', 600], ['cyan', 'Pseudo cyan', '#22d3ee', 400], ['pink', 'Pseudo rose', '#f472b6', 400], ['lime', 'Pseudo citron', '#a3e635', 400], ['red', 'Pseudo rubis', '#f87171', 400]]
    .map(([id, name, value, price]) => ({ id: 'name_' + id, slot: 'namecolor', name, value, price, icon: '✒️' })),
  // titres
  ...[['rookie', 'Le Débutant', 50], ['strategist', 'Le Stratège', 300], ['sniper', 'L’Œil de lynx', 400], ['lucky', 'Main chanceuse', 400], ['pilot', 'As du volant', 400], ['legend', 'La Légende', 3000, 25], ['zombie', 'Chasseur de zombies', 500], ['artist', 'L’Artiste', 300], ['king', 'Roi de la salle', 5000, 40]]
    .map(([id, name, price, level]) => ({ id: 'title_' + id, slot: 'title', name, price, level, icon: '🏷️' })),
  // avatars premium
  ...[['dragon', '🐲', 300], ['unicorn', '🦄', 300], ['ninja', '🥷', 300], ['crown', '👑', 1000, 12], ['alien', '👽', 250], ['wizard', '🧙‍♂️', 300], ['vampire', '🧛', 300], ['robot', '🦾', 400], ['ghost', '👻', 200], ['phoenix', '🐦‍🔥', 1500, 18]]
    .map(([id, value, price, level]) => ({ id: 'emoji_' + id, slot: 'emoji', name: 'Avatar ' + value, value, price, level, icon: value })),
];
const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));
EMOJIS.push(...ITEMS.filter(i => i.slot === 'emoji').map(i => i.value));

// ---------------- Records ----------------
const REC = {
  'zombie:wave': ['Zombie Survival', 'Vague atteinte', 'max', v => `Vague ${v}`],
  'towers:wave': ['Tower Defense', 'Vague atteinte', 'max', v => `Vague ${v}`],
  'royale:kills': ['Mini Battle Royale', 'Éliminations en une partie', 'max', v => `${v} élim.`],
  'arena:kills': ['Arène Néon', 'Éliminations en un match', 'max', v => `${v} élim.`],
  'tactical:kills': ['Tactical Strike', 'Éliminations en un match', 'max', v => `${v} élim.`],
  'blackjack:chips': ['Blackjack', 'Jetons en fin de partie', 'max', v => `🪙 ${v}`],
  'poker:chips': ['Poker Hold’em', 'Plus gros tapis', 'max', v => `🪙 ${v}`],
  'carball:goals': ['Car Football', 'Buts en un match', 'max', v => `${v} ⚽`],
  'quest:level': ['Fantasy Quest', 'Niveau du héros', 'max', v => `Niveau ${v}`],
  'blocks:placed': ['Block World', 'Blocs posés en une session', 'max', v => `${v} blocs`],
  'draw:score': ['Draw & Guess', 'Points en une partie', 'max', v => `${v} pts`],
  'impostor:score': ['Imposteur', 'Points en une partie', 'max', v => `${v} pts`],
  'empire:worth': ['Empire Immobilier', 'Patrimoine final', 'max', v => `${v} €`],
  'fallrace:crowns': ['Fall Race', 'Couronnes gagnées (total)', 'max', v => `${v} 👑`],
};
const fmtTime = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
function recordInfo(key) {
  if (key.startsWith('kart:time:')) { const t = key.split(':')[2]; return { game: 'Kart Racing', label: `Meilleur temps — ${{ prairie: 'Prairie verte', desert: 'Canyon du désert', neige: 'Sommet enneigé', volcan: 'Volcan' }[t] || t}`, dir: 'min', fmt: fmtTime }; }
  const r = REC[key] || [key, key, 'max', String];
  return { game: r[0], label: r[1], dir: r[2], fmt: r[3] };
}

// ---------------- Succès ----------------
const ACHIEVEMENTS = [
  { id: 'first_game', icon: '🎮', name: 'Premiers pas', desc: 'Terminer une partie', coins: 50, test: f => f.games >= 1 },
  { id: 'games_10', icon: '🕹️', name: 'Habitué', desc: 'Terminer 10 parties', coins: 100, test: f => f.games >= 10 },
  { id: 'games_50', icon: '🏟️', name: 'Pilier de la salle', desc: 'Terminer 50 parties', coins: 300, test: f => f.games >= 50 },
  { id: 'games_200', icon: '🏛️', name: 'Légende vivante', desc: 'Terminer 200 parties', coins: 1000, test: f => f.games >= 200 },
  { id: 'first_win', icon: '🏆', name: 'Première victoire', desc: 'Gagner une partie', coins: 75, test: f => f.wins >= 1 },
  { id: 'wins_10', icon: '🥇', name: 'Gagnant', desc: 'Gagner 10 parties', coins: 200, test: f => f.wins >= 10 },
  { id: 'wins_50', icon: '👑', name: 'Champion de la salle', desc: 'Gagner 50 parties', coins: 600, test: f => f.wins >= 50 },
  { id: 'explorer', icon: '🧭', name: 'Explorateur', desc: 'Jouer à 5 jeux différents', coins: 150, test: f => f.distinct >= 5 },
  { id: 'collector', icon: '📚', name: 'Touche-à-tout', desc: 'Jouer à 12 jeux différents', coins: 500, test: f => f.distinct >= 12 },
  { id: 'level_5', icon: '⭐', name: 'Niveau 5', desc: 'Atteindre le niveau 5', coins: 100, test: f => f.level >= 5 },
  { id: 'level_10', icon: '🌟', name: 'Niveau 10', desc: 'Atteindre le niveau 10', coins: 250, test: f => f.level >= 10 },
  { id: 'level_25', icon: '💫', name: 'Niveau 25', desc: 'Atteindre le niveau 25', coins: 800, test: f => f.level >= 25 },
  { id: 'rich', icon: '💰', name: 'Fortuné', desc: 'Posséder 2 000 pièces', coins: 0, test: f => f.coins >= 2000 },
  { id: 'friend_1', icon: '🤝', name: 'Sociable', desc: 'Avoir un ami', coins: 50, test: f => f.friends >= 1 },
  { id: 'friend_5', icon: '👥', name: 'Populaire', desc: 'Avoir 5 amis', coins: 200, test: f => f.friends >= 5 },
  { id: 'clan', icon: '🛡️', name: 'Esprit de clan', desc: 'Rejoindre un clan', coins: 100, test: f => f.clan },
  { id: 'shopper', icon: '🛍️', name: 'Fashion', desc: 'Posséder 5 objets cosmétiques', coins: 150, test: f => f.owned >= 6 },
  { id: 'ranked_1', icon: '⚔️', name: 'Compétiteur', desc: 'Jouer une partie classée', coins: 75, test: f => f.lastRanked },
  { id: 'gold_rank', icon: '🥇', name: 'Rang Or', desc: 'Atteindre le rang Or en classé', coins: 400, test: f => f.rating >= 1150 },
  { id: 'diamond_rank', icon: '💎', name: 'Rang Diamant', desc: 'Atteindre le rang Diamant', coins: 1000, test: f => f.rating >= 1400 },
  { id: 'streak_7', icon: '📅', name: 'Fidèle', desc: '7 jours de récompense quotidienne d’affilée', coins: 300, test: f => f.streak >= 7 },
  { id: 'daily_all', icon: '✅', name: 'Journée parfaite', desc: 'Réussir les 3 défis du jour', coins: 100 },
  { id: 'zombie_10', icon: '🧟', name: 'Survivant', desc: 'Atteindre la vague 10 à Zombie Survival', coins: 200, test: f => f.record?.key === 'zombie:wave' && f.record.value >= 10 },
  { id: 'zombie_25', icon: '☣️', name: 'Apocalypse', desc: 'Atteindre la vague 25 à Zombie Survival', coins: 600, test: f => f.record?.key === 'zombie:wave' && f.record.value >= 25 },
  { id: 'towers_30', icon: '🏰', name: 'Forteresse', desc: 'Tenir 30 vagues au Tower Defense', coins: 400, test: f => f.record?.key === 'towers:wave' && f.record.value >= 30 },
  { id: 'chess_win', icon: '♞', name: 'Échec et mat', desc: 'Gagner une partie d’échecs', coins: 100, test: f => f.lastGame === 'chess' && f.lastWin },
  { id: 'royale_win', icon: '🪂', name: 'Dernier debout', desc: 'Gagner une Battle Royale', coins: 150, test: f => f.lastGame === 'royale' && f.lastWin },
  { id: 'crown', icon: '👑', name: 'Couronné', desc: 'Gagner une finale de Fall Race', coins: 150, test: f => f.lastGame === 'fallrace' && f.lastWin },
  { id: 'blackjack_5k', icon: '🎰', name: 'Fait sauter la banque', desc: 'Finir une partie de Blackjack avec 5 000 jetons', coins: 300, test: f => f.record?.key === 'blackjack:chips' && f.record.value >= 5000 },
  { id: 'hattrick', icon: '⚽', name: 'Coup du chapeau', desc: 'Marquer 3 buts en un match de Car Football', coins: 150, test: f => f.record?.key === 'carball:goals' && f.record.value >= 3 },
  { id: 'dragon', icon: '🐉', name: 'Tueur de dragon', desc: 'Atteindre le niveau 12 dans Fantasy Quest', coins: 400, test: f => f.record?.key === 'quest:level' && f.record.value >= 12 },
  { id: 'builder', icon: '🧱', name: 'Bâtisseur', desc: 'Poser 500 blocs en une session de Block World', coins: 200, test: f => f.record?.key === 'blocks:placed' && f.record.value >= 500 },
  { id: 'podium', icon: '🎖️', name: 'Sur le podium', desc: 'Finir dans le top 3 d’un tournoi', coins: 0 },
  { id: 'champion', icon: '🏅', name: 'Champion de tournoi', desc: 'Gagner un tournoi', coins: 0 },
];

// ---------------- Défis quotidiens ----------------
function challengesFor(day) {
  const h = hashStr(day), games = Object.keys(GAMES).filter(g => !['blocks', 'quest'].includes(g)), gameOfDay = games[h % games.length];
  const pool = [
    { id: 'play3', name: 'Jouer 3 parties', goal: 3, coins: 80, xp: 60, test: () => 1 },
    { id: 'play5', name: 'Jouer 5 parties', goal: 5, coins: 120, xp: 100, test: () => 1 },
    { id: 'win1', name: 'Gagner une partie', goal: 1, coins: 80, xp: 80, test: e => e.win ? 1 : 0 },
    { id: 'win3', name: 'Gagner 3 parties', goal: 3, coins: 150, xp: 150, test: e => e.win ? 1 : 0 },
    { id: 'cards2', name: 'Jouer 2 jeux de cartes ou de plateau', goal: 2, coins: 90, xp: 70, test: e => e.category === 'cartes' ? 1 : 0 },
    { id: 'action2', name: 'Jouer 2 parties d’action', goal: 2, coins: 90, xp: 70, test: e => e.category === 'action' ? 1 : 0 },
    { id: 'race1', name: 'Terminer une course', goal: 1, coins: 70, xp: 60, test: e => e.category === 'course' ? 1 : 0 },
    { id: 'podium', name: 'Finir sur le podium (3 joueurs ou plus)', goal: 1, coins: 100, xp: 80, test: e => e.total >= 3 && e.place <= 3 ? 1 : 0 },
    { id: 'ranked', name: 'Jouer une partie classée', goal: 1, coins: 120, xp: 100, test: e => e.ranked ? 1 : 0 },
    { id: 'god', name: `Jouer 2 parties de ${GAMES[gameOfDay]}`, goal: 2, coins: 110, xp: 90, test: e => e.game === gameOfDay ? 1 : 0 },
  ];
  const out = [], used = new Set(); let x = h;
  while (out.length < 3) { x = Math.imul(x ^ (x >>> 13), 1103515245) >>> 0; const c = pool[x % pool.length]; if (used.has(c.id) || (c.id.startsWith('play') && [...used].some(u => u.startsWith('play'))) || (c.id.startsWith('win') && [...used].some(u => u.startsWith('win')))) continue; used.add(c.id); out.push(c); }
  return out;
}

// ---------------- Tournois (calendrier automatique) ----------------
const WEEKLY = ['zombie:wave', 'kart:time:prairie', 'royale:kills', 'blackjack:chips', 'towers:wave', 'arena:kills', 'carball:goals', 'kart:time:volcan'];
const DAILY = ['royale:kills', 'blackjack:chips', 'zombie:wave', 'kart:time:desert', 'carball:goals', 'tactical:kills', 'draw:score'];
function weekStart(d) { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x; }
function tourAt(kind, start) {
  const days = kind === 'week' ? 7 : 1, end = new Date(start.getTime() + days * 864e5), idx = Math.floor(start.getTime() / (days * 864e5));
  const list = kind === 'week' ? WEEKLY : DAILY, key = list[idx % list.length], info = recordInfo(key);
  return { id: (kind === 'week' ? 'W' : 'D') + start.toISOString().slice(0, 10), kind, name: kind === 'week' ? `Tournoi de la semaine — ${info.game}` : `Tournoi éclair — ${info.game}`,
    key, label: info.label, dir: info.dir, start: start.getTime(), end: end.getTime(), prizes: kind === 'week' ? [2000, 1000, 500] : [500, 250, 100], game: Object.keys(GAMES).find(g => key.startsWith(g + ':')) };
}
function activeTournaments() { const n = new Date(); return [tourAt('week', weekStart(n)), tourAt('day', new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())))]; }
function pastTournaments(k) {
  const n = new Date(), out = [];
  for (let i = 1; i <= k; i++) out.push(tourAt('day', new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() - i))));
  for (let i = 1; i <= Math.ceil(k / 3); i++) out.push(tourAt('week', new Date(weekStart(n).getTime() - i * 7 * 864e5)));
  return out.map(t => ({ ...t, past: true }));
}

const NEWS = [
  { date: '2026-11-26', tag: 'Nouveauté', title: 'Comptes joueurs, progression et classements !', text: 'Créez un compte pour sauvegarder vos records, gagner de l’XP et des pièces, débloquer des succès, ajouter des amis et grimper dans les classements. Les parties classées et les tournois sont ouverts !' },
  { date: '2026-11-26', tag: 'Nouveau jeu', title: 'Blackjack débarque', text: 'Jusqu’à 7 joueurs contre le croupier, avec doubler, séparer, assurance et un conseil de stratégie intégré.' },
  { date: '2026-11-25', tag: 'Mise à jour', title: '16 jeux disponibles', text: 'Fall Race, Battle Royale, Tactical Strike, Block World, Fantasy Quest, Car Football, Kart Racing, Tower Defense… et bien d’autres. L’hôte peut régler chaque partie avant de la lancer.' },
  { date: '2026-11-25', tag: 'Boutique', title: 'Cosmétiques et cadres', text: 'Dépensez vos pièces en couleurs de personnage, cadres d’avatar, titres et avatars exclusifs. Certains objets demandent un niveau minimum !' },
];
const FAQ = [
  ['Faut-il un compte pour jouer ?', 'Non : vous pouvez jouer en invité. Mais sans compte, vos records, votre XP, vos pièces et vos succès ne sont pas sauvegardés.'],
  ['Comment gagner des pièces et de l’XP ?', 'En terminant des parties (bonus en cas de victoire), avec la récompense quotidienne, les défis du jour, les succès, les montées de niveau et les tournois.'],
  ['Comment fonctionnent les parties classées ?', 'L’hôte coche « Partie classée » dans le salon. S’il y a au moins 2 joueurs connectés, votre cote évolue selon votre classement. Les rangs vont de Bronze à Maître et sont remis à zéro (en douceur) chaque mois.'],
  ['Comment marchent les tournois ?', 'Chaque jour et chaque semaine, un tournoi porte sur un record (vague atteinte, meilleur temps…). Votre meilleur résultat pendant la période compte. Les 3 premiers gagnent des pièces.'],
  ['Comment inviter un ami ?', 'Ajoutez-le dans la page Amis. Depuis un salon, cliquez sur « Inviter » à côté de son nom : il reçoit une notification pour vous rejoindre.'],
  ['Le chat vocal ne marche pas ?', 'Autorisez l’accès au micro dans votre navigateur. Le vocal fonctionne de navigateur à navigateur ; certains réseaux d’entreprise ou d’école peuvent le bloquer.'],
  ['J’ai oublié mon mot de passe', 'Écrivez-nous via le formulaire de contact ci-dessous en indiquant votre pseudo.'],
];

module.exports = { pick, GAMES, CATEGORY, RANKED, RANKS, ITEMS, ITEM, EMOJIS, ACHIEVEMENTS, recordInfo, challengesFor, activeTournaments, pastTournaments, NEWS, FAQ };
