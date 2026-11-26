# 🎮 Salle de Jeux — 16 jeux multijoueur dans le navigateur

## Lancer
```bash
npm install
npm start
```
Puis ouvrir http://localhost:3000 (le port se change avec la variable `PORT`).
Pour mettre en ligne : tout hébergeur Node.js acceptant les WebSocket (Render, Railway, Fly.io, VPS…).

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
| Kart Racing | course de karts, objets (+ bots) | 1–8 | `kart.js` |
| Tower Defense | coopération, 8 tours | 1–6 | `towers.js` |
| Arène Néon | FPS 3D match à mort (+ bots) | 1–16 | `arena.js` |

Chaque jeu = `games/<id>.js` (règles, serveur) + `public/games/<id>.js` (affichage, navigateur).
Avant de lancer, l'hôte règle les **paramètres** de la partie dans le salon (déclarés dans `settings` de chaque jeu).

## Structure
- `server.js` : site, salons, paramètres, WebSocket, chargement automatique des jeux.
- `games/lib/` : outils serveur partagés (`util.js`, `words.js`, moteur FPS `fps.js`).
- `public/lib/` : outils navigateur partagés (`kit.js` : interface, sons, 2D temps réel ; `fps.js` : moteur 3D).
- `public/index.html`, `app.js`, `style.css` : accueil, catalogue, salon d'attente.
