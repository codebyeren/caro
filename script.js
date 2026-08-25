let SIZE = 25;
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
const btnSize = document.getElementById('btn-size');
const btnHint = document.getElementById('btn-hint');
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
    boardElement.style.gridTemplateColumns = `repeat(${SIZE}, 40px)`;
    boardElement.style.gridTemplateRows = `repeat(${SIZE}, 40px)`;
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

// ===== ADVANCED HINT AI ENGINE =====

// Score table for patterns: key = "count_openEnds"
// count = consecutive same-player pieces in a line
// openEnds = how many ends of that line are open (0, 1, or 2)
const SCORE_TABLE = {
    '5_0': 1000000, '5_1': 1000000, '5_2': 1000000,
    '4_2': 500000,   // Open 4: unstoppable, 2 ways to win
    '4_1': 50000,    // Closed 4: 1 way to win
    '4_0': 0,
    '3_2': 10000,    // Open 3: will become open-4 next turn
    '3_1': 1000,     // Closed 3
    '3_0': 0,
    '2_2': 500,      // Open 2
    '2_1': 100,
    '2_0': 0,
    '1_2': 50,       // Open 1
    '1_1': 10,
    '1_0': 0,
};

function getPatternScore(count, openEnds) {
    if (count >= 5) return SCORE_TABLE['5_2'];
    const key = `${count}_${openEnds}`;
    return SCORE_TABLE[key] || 0;
}

// Analyze a line in one direction from (row, col) for a given player
function analyzeLine(row, col, dr, dc, player) {
    let count = 1;
    let openEnds = 0;

    // Scan positive direction
    let r = row + dr, c = col + dc;
    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && boardState[r][c] === player) {
        count++;
        r += dr;
        c += dc;
    }
    if (r >= 0 && r < SIZE && c >= 0 && c < SIZE && boardState[r][c] === null) openEnds++;

    // Scan negative direction
    r = row - dr;
    c = col - dc;
    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && boardState[r][c] === player) {
        count++;
        r -= dr;
        c -= dc;
    }
    if (r >= 0 && r < SIZE && c >= 0 && c < SIZE && boardState[r][c] === null) openEnds++;

    return { count, openEnds };
}

// Evaluate total score for placing `player` at (row, col)
function evaluatePosition(row, col, player) {
    const directions = [[0,1],[1,0],[1,1],[1,-1]];
    let totalScore = 0;
    for (const [dr, dc] of directions) {
        const { count, openEnds } = analyzeLine(row, col, dr, dc, player);
        totalScore += getPatternScore(count, openEnds);
    }
    return totalScore;
}

function getHint(player) {
    const opponent = player === 'X' ? 'O' : 'X';

    // First move: center
    let hasAny = false;
    for (let r = 0; r < SIZE && !hasAny; r++)
        for (let c = 0; c < SIZE && !hasAny; c++)
            if (boardState[r][c] !== null) hasAny = true;
    if (!hasAny) return { r: Math.floor(SIZE / 2), c: Math.floor(SIZE / 2) };

    // Collect candidate cells (empty cells within radius 2 of any piece)
    const candidateSet = new Set();
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (boardState[r][c] !== null) {
                for (let dr = -2; dr <= 2; dr++) {
                    for (let dc = -2; dc <= 2; dc++) {
                        const nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && boardState[nr][nc] === null) {
                            candidateSet.add(nr * SIZE + nc);
                        }
                    }
                }
            }
        }
    }

    let bestScore = -1;
    let bestCell = null;

    for (const key of candidateSet) {
        const r = Math.floor(key / SIZE);
        const c = key % SIZE;

        // Evaluate attack value
        boardState[r][c] = player;
        const attackScore = evaluatePosition(r, c, player);
        boardState[r][c] = null;

        // Evaluate defense value
        boardState[r][c] = opponent;
        const defenseScore = evaluatePosition(r, c, opponent);
        boardState[r][c] = null;

        // Prefer attacking slightly over defending
        const totalScore = attackScore * 1.1 + defenseScore;

        if (totalScore > bestScore) {
            bestScore = totalScore;
            bestCell = { r, c };
        }
    }

    return bestCell;
}

function showHint() {
    if (!gameActive) return;
    // Clear previous hints
    Array.from(boardElement.children).forEach(c => c.classList.remove('hint-cell'));

    const hint = getHint(currentPlayer);
    if (hint) {
        const index = hint.r * SIZE + hint.c;
        const cell = boardElement.children[index];
        cell.classList.add('hint-cell');
        setTimeout(() => {
            cell.classList.remove('hint-cell');
        }, 2000);
    }
}

btnRestart.addEventListener('click', initGame);
btnUndo.addEventListener('click', undoMove);
btnHint.addEventListener('click', showHint);
btnModalRestart.addEventListener('click', initGame);

btnSize.addEventListener('click', () => {
    if (SIZE === 15) SIZE = 20;
    else if (SIZE === 20) SIZE = 25;
    else SIZE = 15;
    
    btnSize.textContent = `${SIZE}x${SIZE}`;
    initGame();
    
    // Recenter board
    const gameArea = document.querySelector('.game-area');
    const wrapper = document.querySelector('.board-wrapper');
    gameArea.scrollTop = (wrapper.scrollHeight - gameArea.clientHeight) / 2;
    gameArea.scrollLeft = (wrapper.scrollWidth - gameArea.clientWidth) / 2;
});

// Center board on start for big screens
window.addEventListener('load', () => {
    initGame();
    // Scroll to center of the board
    const gameArea = document.querySelector('.game-area');
    const wrapper = document.querySelector('.board-wrapper');
    gameArea.scrollTop = (wrapper.scrollHeight - gameArea.clientHeight) / 2;
    gameArea.scrollLeft = (wrapper.scrollWidth - gameArea.clientWidth) / 2;
});
