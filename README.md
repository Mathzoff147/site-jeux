# Salle de Jeux

Site de jeux multijoueur : chaque joueur sur son PC, une partie = un code à 4 lettres.
Aucune bibliothèque à installer : seulement Node.js 18 ou plus.

## Les 20 jeux

| Catégorie | Jeux |
| --- | --- |
| Cartes | Kolor (façon jeu de cartes à 4 couleurs), Poker Texas Hold'em |
| Jeu de société | Empire (jeu immobilier), Puissance 4, Morpion, Dames |
| Stratégie | Échecs, Conquête, Bataille navale, Tower Defense |
| Ambiance | Imposteur, Draw & Guess |
| Action (temps réel) | Mini Battle Royale, Tactical Strike, Zombie Survival |
| Sport / Course (temps réel) | Car Football, Kart Racing, Fall Race |
| Aventure (temps réel) | Block World, Fantasy Quest |

## Lancer en local

```
node server.js
```
(ou `npm start`). Ouvre ensuite http://localhost:3000

## Structure

```
server.js              serveur : pages, salons, WebSocket, boucle temps réel
games/                 règles de chaque jeu (côté serveur, impossible de tricher)
games/lib/             outils partagés (géométrie, moteur de tir)
public/index.html      la page du site
public/app.js          connexion, salons, discussion, chargement des jeux
public/style.css       le design
public/games/          affichage de chaque jeu (côté navigateur)
public/games/_rt.js    outils des jeux temps réel (canvas, clavier, souris, caméra)
```

## Ajouter un jeu

1. Crée `games/monjeu.js` (copie `games/morpion.js` comme modèle) avec `id`, `name`,
   `description`, `rules`, `category`, `icon`, `color`, `minPlayers`, `maxPlayers`,
   `setup(nbJoueurs, pseudos)` et `move(state, joueur, coup)` (renvoie une erreur ou `null`).
   - Infos cachées (cartes en main…) : ajoute `view(state, joueur)` et préfixe les champs secrets par `_`.
   - Temps réel : ajoute `realtime: true` et `tick(state, dt)` (appelé 30 fois par seconde).
2. Crée `public/games/monjeu.js` qui définit `window.GAME_UI.monjeu = { render(el, state, ctx) { ... } }`.
   Pour un jeu temps réel, utilise `RT.game({ view, draw })` (voir `car-football.js`).
3. Redémarre le serveur : le jeu apparaît tout seul dans le catalogue.

## Déployer sur Render

- Build command : `npm install`
- Start command : `npm start`
