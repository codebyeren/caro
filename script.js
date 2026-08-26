let SIZE = 25;
const WIN_CONDITION = 5; // 5 in a row to win

let boardState = [];
let currentPlayer = 'X';
let gameActive = true;
let moveHistory = [];
let gameMode = 'PvP'; // 'PvP', 'PvE_Human', 'PvE_Machine'
let aiPlayer = null;  // 'O' when PvE_Human, 'X' when PvE_Machine

const boardElement = document.getElementById('board');
const winnerModal = document.getElementById('winner-modal');
const winnerMessage = document.getElementById('winner-message');
const btnRestart = document.getElementById('btn-restart');
const btnUndo = document.getElementById('btn-undo');
const btnSize = document.getElementById('btn-size');
const btnHint = document.getElementById('btn-hint');
const btnDifficulty = document.getElementById('btn-difficulty');
const btnMode = document.getElementById('btn-mode');
const btnModalRestart = document.getElementById('btn-modal-restart');

const iconPvP = document.getElementById('icon-pvp');
const iconPvEHuman = document.getElementById('icon-pve-human');
const iconPvEMachine = document.getElementById('icon-pve-machine');

let aiLevel = 2; // 1: Dễ, 2: Vừa, 3: Khó

let aiWorker = null;
let isAIThinking = false;

function setupWorker() {
    if (aiWorker) aiWorker.terminate();
    aiWorker = new Worker('worker.js');
    aiWorker.onmessage = function(e) {
        if (e.data.type === 'MOVE_RESULT') {
            isAIThinking = false;
            document.body.style.cursor = 'default';
            btnDifficulty.classList.remove('thinking-pulse');
            
            const hint = e.data.move;
            
            if (e.data.action === 'PLAY' && gameActive) {
                if (hint) {
                    const index = hint.r * SIZE + hint.c;
                    const cell = boardElement.children[index];
                    makeMoveOnBoard(hint.r, hint.c, aiPlayer, cell);
                    cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                }
            } else if (e.data.action === 'HINT' && gameActive) {
                btnHint.style.opacity = '1';
                btnHint.style.pointerEvents = 'auto';
                if (hint) {
                    const index = hint.r * SIZE + hint.c;
                    const cell = boardElement.children[index];
                    cell.classList.add('hint-cell');
                    cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                    setTimeout(() => cell.classList.remove('hint-cell'), 2500);
                }
            }
        }
    };
}
setupWorker();

function initGame() {
    if (isAIThinking) {
        setupWorker();
        isAIThinking = false;
        document.body.style.cursor = 'default';
        btnDifficulty.classList.remove('thinking-pulse');
        btnHint.style.opacity = '1';
        btnHint.style.pointerEvents = 'auto';
    }

    boardState = Array(SIZE).fill(null).map(() => Array(SIZE).fill(null));
    currentPlayer = 'X';
    gameActive = true;
    moveHistory = [];
    winnerModal.classList.add('hidden');
    renderBoard();
    
    aiWorker.postMessage({ type: 'INIT', size: SIZE });
    
    if (gameMode === 'PvE_Machine' && aiPlayer === 'X') {
        setTimeout(playAITurn, 100);
    }
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
    if (!gameActive || isAIThinking) return;
    
    if (aiPlayer !== null && currentPlayer === aiPlayer) return;

    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);

    if (boardState[row][col] !== null) return;

    makeMoveOnBoard(row, col, currentPlayer, e.target);
}

function makeMoveOnBoard(row, col, player, cellElement) {
    boardState[row][col] = player;
    cellElement.textContent = player;
    cellElement.classList.add(player.toLowerCase());
    
    moveHistory.push({row, col, player});

    const winningCells = checkWin(row, col, player);
    
    if (winningCells) {
        highlightWinningCells(winningCells);
        endGame(`Người chơi ${player} chiến thắng!`);
    } else {
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        
        if (gameActive && aiPlayer !== null && currentPlayer === aiPlayer) {
            setTimeout(playAITurn, 10);
        }
    }
}

function playAITurn() {
    if (!gameActive || aiPlayer === null || currentPlayer !== aiPlayer || isAIThinking) return;
    
    isAIThinking = true;
    document.body.style.cursor = 'wait';
    btnDifficulty.classList.add('thinking-pulse');
    
    let timeLimit = 1500;
    let maxDepth = 12;
    if (aiLevel === 1) { timeLimit = 500; maxDepth = 6; }
    else if (aiLevel === 3) { timeLimit = 5000; maxDepth = 20; }
    else if (aiLevel === 4) { timeLimit = 300000; maxDepth = 30; } // Unlimited: 5 mins, depth 30
    
    aiWorker.postMessage({
        type: 'GET_MOVE',
        boardState: boardState,
        size: SIZE,
        player: aiPlayer,
        timeLimit: timeLimit,
        maxDepth: maxDepth,
        action: 'PLAY'
    });
}

function showHint() {
    if (!gameActive || isAIThinking) return;
    
    isAIThinking = true;
    btnHint.style.opacity = '0.5';
    btnHint.style.pointerEvents = 'none';
    
    let timeLimit = 1500;
    let maxDepth = 12;
    if (aiLevel === 1) { timeLimit = 500; maxDepth = 6; }
    else if (aiLevel === 3) { timeLimit = 5000; maxDepth = 20; }
    else if (aiLevel === 4) { timeLimit = 300000; maxDepth = 30; }
    
    aiWorker.postMessage({
        type: 'GET_MOVE',
        boardState: boardState,
        size: SIZE,
        player: currentPlayer,
        timeLimit: timeLimit,
        maxDepth: maxDepth,
        action: 'HINT'
    });
}

function undoMove() {
    if (moveHistory.length === 0) return;
    
    if (isAIThinking) {
        setupWorker(); // kill current worker and restart
        isAIThinking = false;
        document.body.style.cursor = 'default';
        btnDifficulty.classList.remove('thinking-pulse');
        btnHint.style.opacity = '1';
        btnHint.style.pointerEvents = 'auto';
        aiWorker.postMessage({ type: 'INIT', size: SIZE }); // Make sure new worker has size
    }
    
    let movesToUndo = 1;
    if (aiPlayer !== null && currentPlayer !== aiPlayer && moveHistory.length >= 2) {
        movesToUndo = 2;
    }
    
    for (let i = 0; i < movesToUndo; i++) {
        if (moveHistory.length === 0) break;
        const lastMove = moveHistory.pop();
        boardState[lastMove.row][lastMove.col] = null;
        
        const index = lastMove.row * SIZE + lastMove.col;
        const cell = boardElement.children[index];
        cell.textContent = '';
        cell.classList.remove('x', 'o', 'winning-cell');
        currentPlayer = lastMove.player;
    }
    
    if (!gameActive) {
        gameActive = true;
        winnerModal.classList.add('hidden');
        Array.from(boardElement.children).forEach(c => c.classList.remove('winning-cell'));
    }
    
    if (gameMode === 'PvE_Machine' && currentPlayer === 'X' && moveHistory.length === 0) {
        setTimeout(playAITurn, 100);
    }
}

btnRestart.addEventListener('click', initGame);
btnUndo.addEventListener('click', undoMove);
btnHint.addEventListener('click', showHint);
btnModalRestart.addEventListener('click', initGame);

btnDifficulty.addEventListener('click', () => {
    aiLevel = aiLevel === 1 ? 2 : (aiLevel === 2 ? 3 : (aiLevel === 3 ? 4 : 1));
    btnDifficulty.textContent = `LV ${aiLevel}`;
    if (aiLevel === 1) btnDifficulty.title = "Độ khó AI: Dễ (Suy nghĩ nhanh)";
    if (aiLevel === 2) btnDifficulty.title = "Độ khó AI: Vừa (Suy nghĩ tiêu chuẩn)";
    if (aiLevel === 3) btnDifficulty.title = "Độ khó AI: Siêu Khó (Suy nghĩ rất lâu)";
    if (aiLevel === 4) btnDifficulty.title = "Độ khó AI: Vô Hạn (Nghĩ không giới hạn - Có thể dừng bằng nút Undo)";
});

btnMode.addEventListener('click', () => {
    iconPvP.style.display = 'none';
    iconPvEHuman.style.display = 'none';
    iconPvEMachine.style.display = 'none';

    if (gameMode === 'PvP') {
        gameMode = 'PvE_Human';
        aiPlayer = 'O';
        iconPvEHuman.style.display = 'block';
        btnMode.title = 'Chế độ chơi (Đang: Máy vs Người - Bạn đánh trước)';
    } else if (gameMode === 'PvE_Human') {
        gameMode = 'PvE_Machine';
        aiPlayer = 'X';
        iconPvEMachine.style.display = 'block';
        btnMode.title = 'Chế độ chơi (Đang: Máy vs Người - Máy đánh trước)';
    } else {
        gameMode = 'PvP';
        aiPlayer = null;
        iconPvP.style.display = 'block';
        btnMode.title = 'Chế độ chơi (Đang: Người vs Người)';
    }
    // Restart game when switching modes
    initGame();
});

btnSize.addEventListener('click', () => {
    if (SIZE === 15) SIZE = 20;
    else if (SIZE === 20) SIZE = 25;
    else SIZE = 15;
    
    btnSize.textContent = `${SIZE}x${SIZE}`;
    aiEngine = new GomokuAI(SIZE); // Reset AI for new size
    initGame();
    
    // Recenter board
    const gameArea = document.querySelector('.game-area');
    const wrapper = document.querySelector('.board-wrapper');
    gameArea.scrollTop = (wrapper.scrollHeight - gameArea.clientHeight) / 2;
    gameArea.scrollLeft = (wrapper.scrollWidth - gameArea.clientWidth) / 2;
});

// Center board on start for big screens
window.addEventListener('load', () => {
    aiEngine = new GomokuAI(SIZE);
    initGame();
    // Scroll to center of the board
    const gameArea = document.querySelector('.game-area');
    const wrapper = document.querySelector('.board-wrapper');
    gameArea.scrollTop = (wrapper.scrollHeight - gameArea.clientHeight) / 2;
    gameArea.scrollLeft = (wrapper.scrollWidth - gameArea.clientWidth) / 2;
});
