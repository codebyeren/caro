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

const workerCode = `// ================================================================
//  CARO AI ENGINE v5 — Professional Grade (Web Worker Edition)
// ================================================================

class GomokuAI {
    constructor(size) {
        this.size = size;
        const totalCells = size * size;
        this.board = new Uint8Array(totalCells);
        this.neighborCount = new Int32Array(totalCells);
        this.globalScore = 0;
        
        // Zobrist Hashing
        this.zobrist = new Int32Array(totalCells * 4); 
        this.hashHigh = 0;
        this.hashLow = 0;
        for (let i = 0; i < this.zobrist.length; i++) {
            this.zobrist[i] = (Math.random() * 0x100000000) | 0;
        }
        
        // Transposition Table (TT)
        this.TT_SIZE = 1000003;
        this.ttHashesHigh = new Int32Array(this.TT_SIZE);
        this.ttHashesLow = new Int32Array(this.TT_SIZE);
        this.ttScores = new Float64Array(this.TT_SIZE);
        this.ttDepths = new Int8Array(this.TT_SIZE);
        this.ttFlags = new Int8Array(this.TT_SIZE);
        this.ttBestMove = new Int16Array(this.TT_SIZE);
        
        // Base-10 exponential window scoring
        this.WINDOW_SCORES = [0, 1, 10, 1000, 100000, 10000000000];
        
        this.startTime = 0;
        this.timeLimit = 1500;
        this.timeOut = false;
        
        this.maxDepth = 20; 
    }
    
    syncFromState(boardState) {
        this.board.fill(0);
        this.neighborCount.fill(0);
        this.globalScore = 0;
        this.hashHigh = 0;
        this.hashLow = 0;
        
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (boardState[r][c] !== null) {
                    this.makeMove(r, c, boardState[r][c] === 'X' ? 1 : 2);
                }
            }
        }
    }

    evaluateWindow(startR, startC, dr, dc, sign) {
        let xCount = 0, oCount = 0;
        let idx = startR * this.size + startC;
        const step = dr * this.size + dc;
        
        for (let i = 0; i < 5; i++) {
            const p = this.board[idx];
            if (p === 1) xCount++;
            else if (p === 2) oCount++;
            idx += step;
        }
        
        if (xCount > 0 && oCount > 0) return 0;
        if (xCount === 5) return 10000000000 * sign;
        if (oCount === 5) return -10000000000 * sign;
        if (xCount > 0) return this.WINDOW_SCORES[xCount] * sign;
        if (oCount > 0) return -this.WINDOW_SCORES[oCount] * sign;
        return 0;
    }

    updateScoreForCell(r, c, sign) {
        let scoreDelta = 0;
        const dirs = [[0,1], [1,0], [1,1], [1,-1]];
        
        for (const [dr, dc] of dirs) {
            for (let i = 0; i < 5; i++) {
                const startR = r - i*dr;
                const startC = c - i*dc;
                const endR = startR + 4*dr;
                const endC = startC + 4*dc;
                
                if (startR >= 0 && startR < this.size && startC >= 0 && startC < this.size &&
                    endR >= 0 && endR < this.size && endC >= 0 && endC < this.size) {
                    scoreDelta += this.evaluateWindow(startR, startC, dr, dc, sign);
                }
            }
        }
        return scoreDelta;
    }

    updateNeighbors(r, c, val) {
        for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size) {
                    this.neighborCount[nr * this.size + nc] += val;
                }
            }
        }
    }

    makeMove(r, c, player) {
        this.globalScore += this.updateScoreForCell(r, c, -1);
        const idx = r * this.size + c;
        this.board[idx] = player;
        
        const zIdx = (idx * 2 + (player - 1)) * 2;
        this.hashHigh ^= this.zobrist[zIdx];
        this.hashLow ^= this.zobrist[zIdx + 1];
        
        this.updateNeighbors(r, c, 1);
        this.globalScore += this.updateScoreForCell(r, c, 1);
    }

    undoMove(r, c, player) {
        this.globalScore += this.updateScoreForCell(r, c, -1);
        const idx = r * this.size + c;
        this.board[idx] = 0;
        
        const zIdx = (idx * 2 + (player - 1)) * 2;
        this.hashHigh ^= this.zobrist[zIdx];
        this.hashLow ^= this.zobrist[zIdx + 1];
        
        this.updateNeighbors(r, c, -1);
        this.globalScore += this.updateScoreForCell(r, c, 1);
    }

    getCandidates() {
        const moves = [];
        const max = this.size * this.size;
        for (let i = 0; i < max; i++) {
            if (this.board[i] === 0 && this.neighborCount[i] > 0) moves.push(i);
        }
        return moves;
    }

    evaluateMoveDelta(idx, player) {
        const r = Math.floor(idx / this.size);
        const c = idx % this.size;
        const scoreBefore = this.updateScoreForCell(r, c, 1);
        this.board[idx] = player;
        const scoreAfter = this.updateScoreForCell(r, c, 1);
        this.board[idx] = 0;
        return Math.abs(scoreAfter - scoreBefore);
    }

    getTT(depth, alpha, beta) {
        const index = (this.hashLow >>> 0) % this.TT_SIZE;
        if (this.ttHashesHigh[index] === this.hashHigh && this.ttHashesLow[index] === this.hashLow) {
            if (this.ttDepths[index] >= depth) {
                const flag = this.ttFlags[index];
                const score = this.ttScores[index];
                if (flag === 0) return score;
                if (flag === 1 && score <= alpha) return score;
                if (flag === 2 && score >= beta) return score;
            }
        }
        return null;
    }

    storeTT(depth, score, flag, bestMoveIdx) {
        const index = (this.hashLow >>> 0) % this.TT_SIZE;
        this.ttHashesHigh[index] = this.hashHigh;
        this.ttHashesLow[index] = this.hashLow;
        this.ttScores[index] = score;
        this.ttDepths[index] = depth;
        this.ttFlags[index] = flag;
        this.ttBestMove[index] = bestMoveIdx;
    }

    minimax(depth, alpha, beta, isMaximizing) {
        if (this.timeOut) return 0;
        if (Date.now() - this.startTime > this.timeLimit) {
            this.timeOut = true;
            return 0;
        }

        if (this.globalScore > 9000000000) return 9000000000 + depth;
        if (this.globalScore < -9000000000) return -9000000000 - depth;
        if (depth === 0) return this.globalScore;

        const ttVal = this.getTT(depth, alpha, beta);
        if (ttVal !== null) return ttVal;

        const moves = this.getCandidates();
        if (moves.length === 0) return 0;

        const index = (this.hashLow >>> 0) % this.TT_SIZE;
        let ttBest = -1;
        if (this.ttHashesHigh[index] === this.hashHigh && this.ttHashesLow[index] === this.hashLow) {
            ttBest = this.ttBestMove[index];
        }

        const currentPlayer = isMaximizing ? 1 : 2;
        const currentOpponent = isMaximizing ? 2 : 1;

        const scoredMoves = [];
        for (let i = 0; i < moves.length; i++) {
            const m = moves[i];
            if (m === ttBest) {
                scoredMoves.push({ idx: m, score: Infinity });
            } else {
                const myDelta = this.evaluateMoveDelta(m, currentPlayer);
                const oppDelta = this.evaluateMoveDelta(m, currentOpponent);
                scoredMoves.push({ idx: m, score: myDelta + oppDelta });
            }
        }
        scoredMoves.sort((a, b) => b.score - a.score);

        let MAX_BRANCHES = depth > 2 ? 15 : 20;
        let branches = Math.min(scoredMoves.length, MAX_BRANCHES);

        if (scoredMoves.length > 0) {
            const bestScore = scoredMoves[0].score;
            if (bestScore >= 10000000000) {
                let forcedCount = 0;
                while (forcedCount < scoredMoves.length && scoredMoves[forcedCount].score >= 10000000000) forcedCount++;
                branches = forcedCount;
            } else if (bestScore >= 100000) {
                let forcedCount = 0;
                while (forcedCount < scoredMoves.length && scoredMoves[forcedCount].score >= 100000) forcedCount++;
                branches = Math.min(branches, forcedCount + 2);
            }
        }

        let bestMoveIdx = -1;
        let origAlpha = alpha;

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (let i = 0; i < branches; i++) {
                const m = scoredMoves[i].idx;
                const r = Math.floor(m / this.size);
                const c = m % this.size;

                this.makeMove(r, c, 1);
                const ev = this.minimax(depth - 1, alpha, beta, false);
                this.undoMove(r, c, 1);

                if (ev > maxEval) {
                    maxEval = ev;
                    bestMoveIdx = m;
                }
                alpha = Math.max(alpha, ev);
                if (beta <= alpha) break;
            }

            let flag = 0;
            if (maxEval <= origAlpha) flag = 1;
            else if (maxEval >= beta) flag = 2;

            this.storeTT(depth, maxEval, flag, bestMoveIdx);
            return maxEval;
        } else {
            let minEval = Infinity;
            for (let i = 0; i < branches; i++) {
                const m = scoredMoves[i].idx;
                const r = Math.floor(m / this.size);
                const c = m % this.size;

                this.makeMove(r, c, 2);
                const ev = this.minimax(depth - 1, alpha, beta, true);
                this.undoMove(r, c, 2);

                if (ev < minEval) {
                    minEval = ev;
                    bestMoveIdx = m;
                }
                beta = Math.min(beta, ev);
                if (beta <= alpha) break;
            }

            let flag = 0;
            if (minEval >= beta) flag = 2;
            else if (minEval <= origAlpha) flag = 1;

            this.storeTT(depth, minEval, flag, bestMoveIdx);
            return minEval;
        }
    }

    getBestMove(playerSymbol, timeLimitMs = 1500, maxDepth = 20) {
        const isMaximizing = playerSymbol === 'X';
        const aiPlayer = isMaximizing ? 1 : 2;
        const opponent = isMaximizing ? 2 : 1;

        this.startTime = Date.now();
        this.timeLimit = timeLimitMs;
        this.timeOut = false;
        this.maxDepth = maxDepth;

        let bestMove = -1;
        let finalDepthReached = 0;

        for (let depth = 1; depth <= this.maxDepth; depth++) {
            let currentBestMove = -1;
            let bestScore = isMaximizing ? -Infinity : Infinity;
            let alpha = -Infinity;
            let beta = Infinity;

            const moves = this.getCandidates();
            if (moves.length === 0) return { r: Math.floor(this.size / 2), c: Math.floor(this.size / 2) };

            const index = (this.hashLow >>> 0) % this.TT_SIZE;
            let ttBest = -1;
            if (this.ttHashesHigh[index] === this.hashHigh && this.ttHashesLow[index] === this.hashLow) {
                ttBest = this.ttBestMove[index];
            }

            const scoredMoves = [];
            for (let m of moves) {
                if (m === ttBest) scoredMoves.push({ idx: m, score: Infinity });
                else {
                    const myDelta = this.evaluateMoveDelta(m, aiPlayer);
                    const oppDelta = this.evaluateMoveDelta(m, opponent);
                    scoredMoves.push({ idx: m, score: myDelta + oppDelta });
                }
            }
            scoredMoves.sort((a, b) => b.score - a.score);

            let MAX_BRANCHES = depth === 1 ? 30 : 15;
            let branches = Math.min(scoredMoves.length, MAX_BRANCHES);
            
            if (scoredMoves.length > 0) {
                const topScore = scoredMoves[0].score;
                if (topScore >= 10000000000) {
                    let forcedCount = 0;
                    while (forcedCount < scoredMoves.length && scoredMoves[forcedCount].score >= 10000000000) forcedCount++;
                    branches = forcedCount;
                }
            }

            for (let i = 0; i < branches; i++) {
                const m = scoredMoves[i].idx;
                const r = Math.floor(m / this.size);
                const c = m % this.size;

                this.makeMove(r, c, aiPlayer);
                const ev = this.minimax(depth - 1, alpha, beta, !isMaximizing);
                this.undoMove(r, c, aiPlayer);

                if (this.timeOut) break;

                if (isMaximizing) {
                    if (ev > bestScore) { bestScore = ev; currentBestMove = m; }
                    alpha = Math.max(alpha, ev);
                } else {
                    if (ev < bestScore) { bestScore = ev; currentBestMove = m; }
                    beta = Math.min(beta, ev);
                }
            }

            if (this.timeOut) break;
            if (currentBestMove !== -1) {
                bestMove = currentBestMove;
                finalDepthReached = depth;
            }

            if (Math.abs(bestScore) > 9000000000) break;
        }

        if (bestMove === -1) {
            const moves = this.getCandidates();
            if (moves.length > 0) bestMove = moves[0];
            else return { r: Math.floor(this.size / 2), c: Math.floor(this.size / 2) };
        }

        return { r: Math.floor(bestMove / this.size), c: bestMove % this.size, depthReached: finalDepthReached };
    }
}

let aiEngine = null;

self.onmessage = function(e) {
    const data = e.data;
    
    if (data.type === 'INIT') {
        aiEngine = new GomokuAI(data.size);
    } else if (data.type === 'GET_MOVE') {
        if (!aiEngine || aiEngine.size !== data.size) {
            aiEngine = new GomokuAI(data.size);
        }
        aiEngine.syncFromState(data.boardState);
        const move = aiEngine.getBestMove(data.player, data.timeLimit, data.maxDepth);
        self.postMessage({ type: 'MOVE_RESULT', move, action: data.action });
    }
};
`;
const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(workerBlob);
function setupWorker() {
    if (aiWorker) aiWorker.terminate();
    aiWorker = new Worker(workerUrl);
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

