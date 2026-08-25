const SIZE = 25;
const WIN_CONDITION = 5; // 5 in a row to win

let boardState = [];
let currentPlayer = 'X';
let gameActive = true;
let moveHistory = [];

const boardElement = document.getElementById('board');
const winnerModal = document.getElementById('winner-modal');
const winnerMessage = document.getElementById('winner-message');
const btnRestart = document.getElementById('btn-restart');
const btnUndo = document.getElementById('btn-undo');
const btnModalRestart = document.getElementById('btn-modal-restart');

function initGame() {
    boardState = Array(SIZE).fill(null).map(() => Array(SIZE).fill(null));
    currentPlayer = 'X';
    gameActive = true;
    moveHistory = [];
    winnerModal.classList.add('hidden');
    renderBoard();
}

function renderBoard() {
    boardElement.innerHTML = '';
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.addEventListener('click', handleCellClick);
            boardElement.appendChild(cell);
        }
    }
}

function handleCellClick(e) {
    if (!gameActive) return;

    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);

    if (boardState[row][col] !== null) return;

    boardState[row][col] = currentPlayer;
    e.target.textContent = currentPlayer;
    e.target.classList.add(currentPlayer.toLowerCase());
    
    moveHistory.push({row, col, player: currentPlayer});

    const winningCells = checkWin(row, col, currentPlayer);
    
    if (winningCells) {
        highlightWinningCells(winningCells);
        endGame(`Người chơi ${currentPlayer} chiến thắng!`);
    } else {
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    }
}

function undoMove() {
    if (moveHistory.length === 0) return;
    
    const lastMove = moveHistory.pop();
    boardState[lastMove.row][lastMove.col] = null;
    
    // Update DOM
    const index = lastMove.row * SIZE + lastMove.col;
    const cell = boardElement.children[index];
    cell.textContent = '';
    cell.classList.remove('x', 'o', 'winning-cell');
    
    // Reset state if game was won
    if (!gameActive) {
        gameActive = true;
        winnerModal.classList.add('hidden');
        // Clear winning cells styles
        Array.from(boardElement.children).forEach(c => c.classList.remove('winning-cell'));
    }
    
    currentPlayer = lastMove.player;
}

function checkWin(row, col, player) {
    const directions = [
        [0, 1],  // horizontal
        [1, 0],  // vertical
        [1, 1],  // diagonal right-down
        [1, -1]  // diagonal left-down
    ];

    for (let [dr, dc] of directions) {
        let count = 1;
        let cells = [{r: row, c: col}];

        // Check positive direction
        let r = row + dr;
        let c = col + dc;
        while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && boardState[r][c] === player) {
            count++;
            cells.push({r, c});
            r += dr;
            c += dc;
        }

        // Check negative direction
        r = row - dr;
        c = col - dc;
        while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && boardState[r][c] === player) {
            count++;
            cells.push({r, c});
            r -= dr;
            c -= dc;
        }

        if (count >= WIN_CONDITION) {
            return cells;
        }
    }
    return null;
}

function highlightWinningCells(cells) {
    cells.forEach(({r, c}) => {
        const index = r * SIZE + c;
        boardElement.children[index].classList.add('winning-cell');
    });
}

function endGame(message) {
    gameActive = false;
    winnerMessage.textContent = message;
    winnerModal.classList.remove('hidden');
}

btnRestart.addEventListener('click', initGame);
btnUndo.addEventListener('click', undoMove);
btnModalRestart.addEventListener('click', initGame);

// Center board on start for big screens
window.addEventListener('load', () => {
    initGame();
    // Scroll to center of the board
    const gameArea = document.querySelector('.game-area');
    gameArea.scrollTop = (boardElement.scrollHeight - gameArea.clientHeight) / 2;
    gameArea.scrollLeft = (boardElement.scrollWidth - gameArea.clientWidth) / 2;
});
