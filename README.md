# 🎮 Salle de Jeux — 17 jeux multijoueur dans le navigateur

## Lancer
```bash
npm install
npm start
```
Puis ouvrir http://localhost:3000 (le port se change avec la variable `PORT`).
Pour mettre en ligne : tout hébergeur Node.js acceptant les WebSocket (Render, Railway, Fly.io, VPS…).

## Plateforme joueurs
- **Comptes** (pseudo + mot de passe chiffré) ou jeu en invité. Données dans `data/salle.db` (SQLite intégré à Node ≥ 22.13).
- **Profil** : avatar personnalisable, description, statistiques par jeu, historique, records, succès, jeux favoris.
- **Progression** : niveaux et XP, 34 succès, 3 défis quotidiens, récompense journalière avec série, records sauvegardés automatiquement.
- **Social** : amis, messages privés, clans (discussion de clan), invitations en partie, salon vocal (WebRTC) dans chaque salon.
- **Économie** : pièces, boutique (couleurs du personnage en jeu, cadres, avatars, titres, couleur du pseudo).
- **Compétition** : parties classées (cote Elo, rangs Bronze → Maître), saisons mensuelles avec récompenses, tournois quotidiens et hebdomadaires.
- **Pages** : Accueil, Jeux, Nouveautés, Classement, Tournois, Boutique, Amis, Profil, Actualités, Aide.

⚠️ Hébergement : le fichier `data/salle.db` doit être sur un disque **persistant** (sinon les comptes sont effacés au redémarrage).

## Administration
Créez votre compte sur le site, puis dans un terminal (dans le dossier du projet) :
```bash
npm run admin -- MonPseudo
```
Rechargez la page : le lien **🛡️ Admin** apparaît. Autres rôles : `npm run admin -- Pseudo mod` (modérateur) ou `user`.
Variante au démarrage : `ADMINS="Pseudo1,Pseudo2" npm start`.

- **Modérateur** : bannir (temporaire ou définitif), mettre en sourdine, fermer un salon, exclure un joueur, lire les messages d'aide.
- **Administrateur** : tout cela, plus modifier un compte (pseudo, pièces, XP, cote), donner des pièces/objets, changer les rôles, réinitialiser un mot de passe ou des statistiques, supprimer un compte ou un clan, activer/désactiver un jeu, publier une annonce et des actualités. Toutes les actions sont notées dans le journal.

## Les jeux
| Jeu | Genre | Joueurs | Fichiers |
|---|---|---|---|
| Couleurs Express | cartes (même couleur / même chiffre) | 2–10 | `cards.js` |
| Empire Immobilier | plateau, achat de propriétés | 2–8 | `empire.js` |
| Imposteur | déduction, mot secret | 3–12 | `impostor.js` |
| Échecs | règles complètes + pendule | 2 (+ spectateurs) | `chess.js` |
| Fall Race | course d'obstacles éliminatoire (+ bots) | 1–16 | `fallrace.js` |
| Mini Battle Royale | survie, zone qui rétrécit (+ bots) | 1–16 | `royale.js` |
| Tactical Strike | FPS 3D 5 contre 5, agents et capacités (+ bots) | 1–10 | `tactical.js` |
| Draw & Guess | dessin et devinettes | 2–12 | `draw.js` |
| Block World | monde de cubes 3D, construction | 1–12 | `blocks.js` |
| Fantasy Quest | mini-MMORPG, classes, dragon | 1–12 | `quest.js` |
| Car Football | foot en voitures (+ bots) | 1–8 | `carball.js` |
| Zombie Survival | coopération, vagues, 9 armes | 1–8 | `zombie.js` |
| Poker Hold'em | Texas Hold'em sans limite | 2–9 | `poker.js` |
| Blackjack | casino contre le croupier, conseils de stratégie | 1–7 | `blackjack.js` |
| Kart Racing | course de karts, objets (+ bots) | 1–8 | `kart.js` |
| Tower Defense | coopération, 8 tours | 1–6 | `towers.js` |
| Arène Néon | FPS 3D match à mort (+ bots) | 1–16 | `arena.js` |

Chaque jeu = `games/<id>.js` (règles, serveur) + `public/games/<id>.js` (affichage, navigateur).
Avant de lancer, l'hôte règle les **paramètres** de la partie dans le salon (déclarés dans `settings` de chaque jeu).

## Structure
- `server.js` : site, salons, paramètres, WebSocket, comptes, relais vocal.
- `server/platform.js` : base de données et règles de la plateforme ; `server/content.js` : boutique, succès, défis, tournois, actualités.
- Chaque jeu peut exposer `results(state)` (fin de partie) et `records(state)` pour enregistrer la progression.
- `games/lib/` : outils serveur partagés (`util.js`, `words.js`, moteur FPS `fps.js`).
- `public/lib/` : outils navigateur partagés (`kit.js` : interface, sons, 2D temps réel ; `fps.js` : moteur 3D).
- `public/index.html`, `app.js`, `pages.js`, `voice.js`, `style.css`, `platform.css` : site, pages, salon d'attente, vocal.
