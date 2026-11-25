// Morpion (tic-tac-toe) : 2 joueurs, aligner 3 symboles
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

module.exports = {
  id: 'morpion',
  name: 'Morpion',
  description: 'Le classique : aligne 3 symboles avant ton adversaire.',
  category: 'Jeu de société',
  icon: '❌',
  color: '#ff6b8b',
  order: 5,
  rules: 'Chacun son tour, place ton symbole dans une case vide. Le premier qui aligne 3 symboles (ligne, colonne ou diagonale) gagne. Grille pleine sans alignement : match nul.',
  minPlayers: 2,
  maxPlayers: 2,

  setup() {
    return { board: Array(9).fill(null), turn: 0, over: false, winner: null, line: null };
  },

  // Renvoie un message d'erreur, ou null si le coup est valide
  move(state, player, move) {
    if (state.over) return 'La partie est terminée.';
    if (player !== state.turn) return "Ce n'est pas ton tour.";
    const cell = Number(move.cell);
    if (!Number.isInteger(cell) || cell < 0 || cell > 8) return 'Case invalide.';
    if (state.board[cell] !== null) return 'Case déjà prise.';

    state.board[cell] = player;
    const line = LINES.find(l => l.every(i => state.board[i] === player));
    if (line) { state.over = true; state.winner = player; state.line = line; }
    else if (state.board.every(c => c !== null)) { state.over = true; state.winner = -1; } // match nul
    else state.turn = 1 - player;
    return null;
  },
};
