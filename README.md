# Salle de Jeux

Site de jeux multijoueur : chaque joueur sur son PC, une partie = un code à 4 lettres.

Jeux inclus : **Morpion**, **Puissance 4**, **Conquête** (stratégie, 2 à 4 joueurs).

## Lancer en local

Il faut Node.js 18 ou plus. Aucune bibliothèque à installer.

```
npm start
```

Ouvre ensuite http://localhost:3000

## Structure

```
server.js            serveur : pages, salons, WebSocket
games/               règles de chaque jeu (côté serveur)
public/index.html    la page du site
public/app.js        connexion, salons, chat
public/style.css     l'apparence
public/games/        affichage de chaque jeu (côté navigateur)
```

## Ajouter un jeu

1. Crée `games/monjeu.js` avec `id`, `name`, `description`, `category`,
   `minPlayers`, `maxPlayers`, `setup(nbJoueurs)` et `move(state, joueur, coup)`
   (renvoie un message d'erreur ou `null`). Copie `games/morpion.js` comme modèle.
2. Crée `public/games/monjeu.js` qui définit `window.GAME_UI.monjeu = { render(el, state, ctx) { ... } }`.
3. Ajoute `<script src="/games/monjeu.js"></script>` dans `public/index.html`.
4. Redémarre le serveur : le jeu apparaît dans le catalogue.

## Déployer sur Render

- Build command : `npm install`
- Start command : `npm start`
