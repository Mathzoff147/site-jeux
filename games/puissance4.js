// Puissance 4 : 2 joueurs, aligner 4 jetons (ligne, colonne ou diagonale)
const ROWS = 6;
const COLS = 7;

module.exports = {
  id: 'puissance4',
  name: 'Puissance 4',
  description: 'Fais tomber tes jetons et aligne-en 4 pour gagner.',
  category: 'Jeu de société',
  icon: '🔴',
  color: '#ffd447',
  order: 4,
  rules: 'Chacun son tour, choisis une colonne : ton jeton tombe tout en bas. Le premier qui aligne 4 jetons (horizontal, vertical ou diagonal) gagne.',
  minPlayers: 2,
  maxPlayers: 2,

  setup() {
    return {
      board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)), // board[ligne][colonne], ligne 0 = haut
      turn: 0, over: false, winner: null, last: null, line: null,
    };
  },

  move(state, player, move) {
    if (state.over) return 'La partie est terminée.';
    if (player !== state.turn) return "Ce n'est pas ton tour.";
    const col = Number(move.col);
    if (!Number.isInteger(col) || col < 0 || col >= COLS) return 'Colonne invalide.';

    let row = -1;
    for (let r = ROWS - 1; r >= 0; r--) if (state.board[r][col] === null) { row = r; break; }
    if (row === -1) return 'Colonne pleine.';

    state.board[row][col] = player;
    state.last = [row, col];

    // Vérifie les 4 directions autour du jeton posé
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const cells = [[row, col]];
      for (const s of [1, -1]) {
        let r = row + dr * s, c = col + dc * s;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS && state.board[r][c] === player) {
          cells.push([r, c]); r += dr * s; c += dc * s;
        }
      }
      if (cells.length >= 4) { state.over = true; state.winner = player; state.line = cells; return null; }
    }

    if (state.board[0].every(c => c !== null)) { state.over = true; state.winner = -1; }
    else state.turn = 1 - player;
    return null;
  },
};
