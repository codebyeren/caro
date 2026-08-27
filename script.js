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

self.onerror = function(msg, url, line, col, error) {
    self.postMessage({ type: 'WORKER_ERROR', error: msg + ' ' + (error ? error.stack : '') });
    return true;
};

let SIZE = 25;
const WIN_CONDITION = 5;

let boardState = [];
let currentPlayer = 'X';
let gameActive = true;
let moveHistory = [];
let gameMode = 'PvP';
let aiPlayer = null;

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

let aiLevel = 2; 
let isAIThinking = false;
let aiEngine = null;

function initGame() {
    boardState = Array(SIZE).fill(null).map(() => Array(SIZE).fill(''));
    currentPlayer = 'X';
    gameActive = true;
    moveHistory = [];
    isAIThinking = false;
    document.body.style.cursor = 'default';
    btnDifficulty.classList.remove('thinking-pulse');

    boardElement.style.gridTemplateColumns = `repeat(${SIZE}, 30px)`;
    boardElement.style.gridTemplateRows = `repeat(${SIZE}, 30px)`;
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

    winnerModal.style.display = 'none';
    btnUndo.style.opacity = '0.5';
    btnUndo.style.pointerEvents = 'none';
    btnHint.style.opacity = '1';
    btnHint.style.pointerEvents = 'auto';

    if (gameMode === 'PvP') {
        aiPlayer = null;
    } else if (gameMode === 'PvE_Human') {
        aiPlayer = 'O';
    } else if (gameMode === 'PvE_Machine') {
        aiPlayer = 'X';
        playAITurn();
    }
}

function handleCellClick(e) {
    if (!gameActive || isAIThinking) return;
    if (aiPlayer && currentPlayer === aiPlayer) return;

    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);

    if (boardState[row][col] !== '') return;

    makeMoveOnBoard(row, col, currentPlayer, e.target);

    if (gameActive && aiPlayer && currentPlayer === aiPlayer) {
        playAITurn();
    }
}

function makeMoveOnBoard(row, col, player, cellElement) {
    boardState[row][col] = player;
    cellElement.textContent = player;
    cellElement.classList.add(player);
    cellElement.classList.add('pop');

    if (moveHistory.length > 0) {
        const lastMove = moveHistory[moveHistory.length - 1];
        const lastCellIndex = lastMove.r * SIZE + lastMove.c;
        const lastCell = boardElement.children[lastCellIndex];
        if (lastCell) lastCell.classList.remove('last-move');
    }

    cellElement.classList.add('last-move');
    moveHistory.push({ r: row, c: col, player: player });

    btnUndo.style.opacity = '1';
    btnUndo.style.pointerEvents = 'auto';
    btnHint.style.opacity = '1';
    btnHint.style.pointerEvents = 'auto';

    if (checkWin(row, col, player)) {
        gameActive = false;
        showWinner(player);
        return;
    }

    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
}

function checkWin(row, col, player) {
    return checkDirection(row, col, player, 1, 0) || 
           checkDirection(row, col, player, 0, 1) || 
           checkDirection(row, col, player, 1, 1) || 
           checkDirection(row, col, player, 1, -1);
}

function checkDirection(row, col, player, rowDir, colDir) {
    let count = 1;
    let winningCells = [{ r: row, c: col }];

    for (let i = 1; i < WIN_CONDITION; i++) {
        let r = row + i * rowDir;
        let c = col + i * colDir;
        if (r < 0 || r >= SIZE || c < 0 || c >= SIZE || boardState[r][c] !== player) break;
        count++;
        winningCells.push({ r, c });
    }

    for (let i = 1; i < WIN_CONDITION; i++) {
        let r = row - i * rowDir;
        let c = col - i * colDir;
        if (r < 0 || r >= SIZE || c < 0 || c >= SIZE || boardState[r][c] !== player) break;
        count++;
        winningCells.push({ r, c });
    }

    if (count >= WIN_CONDITION) {
        highlightWinningCells(winningCells);
        return true;
    }
    return false;
}

function highlightWinningCells(cells) {
    cells.forEach(cell => {
        const index = cell.r * SIZE + cell.c;
        boardElement.children[index].classList.add('winning-cell');
    });
}

function showWinner(player) {
    let message = `Người chơi ${player} chiến thắng!`;
    if (aiPlayer) {
        if (player === aiPlayer) {
            message = "Máy tính chiến thắng!";
        } else {
            message = "Bạn đã chiến thắng xuất sắc!";
        }
    }
    winnerMessage.textContent = message;
    winnerModal.style.display = 'flex';
}

function playAITurn() {
    if (!gameActive || isAIThinking) return;
    
    isAIThinking = true;
    document.body.style.cursor = 'wait';
    btnDifficulty.classList.add('thinking-pulse');

    const player = aiPlayer;
    let timeLimit = 1500;
    let maxDepth = 20;

    if (aiLevel === 1) { timeLimit = 500; maxDepth = 3; }
    else if (aiLevel === 2) { timeLimit = 1500; maxDepth = 4; }
    else if (aiLevel === 3) { timeLimit = 3000; maxDepth = 6; }
    else if (aiLevel === 4) { timeLimit = 5000; maxDepth = 30; }

    setTimeout(() => {
        try {
            if (!aiEngine || aiEngine.size !== SIZE) aiEngine = new GomokuAI(SIZE);
            aiEngine.syncFromState(boardState);
            const move = aiEngine.getBestMove(player, timeLimit, maxDepth);
            handleAIResult(move, 'PLAY');
        } catch(e) {
            alert('Lỗi AI: ' + e.message);
            isAIThinking = false;
            document.body.style.cursor = 'default';
            btnDifficulty.classList.remove('thinking-pulse');
        }
    }, 100);
}

function showHint() {
    if (!gameActive || isAIThinking) return;
    if (moveHistory.length === 0 && gameMode !== 'PvE_Machine') {
        const center = Math.floor(SIZE / 2);
        highlightHint(center, center);
        return;
    }

    isAIThinking = true;
    btnDifficulty.classList.add('thinking-pulse');
    document.body.style.cursor = 'wait';

    const player = currentPlayer;
    let timeLimit = 1500;
    let maxDepth = 20;

    if (aiLevel === 1) { timeLimit = 500; maxDepth = 3; }
    else if (aiLevel === 2) { timeLimit = 1500; maxDepth = 4; }
    else if (aiLevel === 3) { timeLimit = 3000; maxDepth = 6; }
    else if (aiLevel === 4) { timeLimit = 5000; maxDepth = 30; }

    setTimeout(() => {
        try {
            if (!aiEngine || aiEngine.size !== SIZE) aiEngine = new GomokuAI(SIZE);
            aiEngine.syncFromState(boardState);
            const move = aiEngine.getBestMove(player, timeLimit, maxDepth);
            handleAIResult(move, 'HINT');
        } catch(e) {
            alert('Lỗi AI: ' + e.message);
            isAIThinking = false;
            document.body.style.cursor = 'default';
            btnDifficulty.classList.remove('thinking-pulse');
        }
    }, 100);
}

function handleAIResult(hint, action) {
    isAIThinking = false;
    document.body.style.cursor = 'default';
    btnDifficulty.classList.remove('thinking-pulse');
    
    if (action === 'PLAY' && gameActive) {
        if (hint) {
            const index = hint.r * SIZE + hint.c;
            const cell = boardElement.children[index];
            makeMoveOnBoard(hint.r, hint.c, aiPlayer, cell);
        }
    } else if (action === 'HINT' && gameActive) {
        btnHint.style.opacity = '1';
        btnHint.style.pointerEvents = 'auto';
        if (hint) {
            highlightHint(hint.r, hint.c);
        }
    }
}

function highlightHint(r, c) {
    const index = r * SIZE + c;
    const cell = boardElement.children[index];
    cell.classList.add('hint-cell');
    setTimeout(() => cell.classList.remove('hint-cell'), 2500);
}

function undoMove() {
    if (moveHistory.length === 0 || isAIThinking) return;

    if (gameMode.startsWith('PvE')) {
        if (moveHistory.length < 2 && gameMode === 'PvE_Machine') return;
        
        let movesToUndo = 1;
        if (currentPlayer !== aiPlayer) {
            movesToUndo = 2; 
        } else {
            movesToUndo = 1; 
        }

        if (moveHistory.length < movesToUndo) return;

        for (let i = 0; i < movesToUndo; i++) {
            const lastMove = moveHistory.pop();
            boardState[lastMove.r][lastMove.c] = '';
            const index = lastMove.r * SIZE + lastMove.c;
            const cell = boardElement.children[index];
            cell.textContent = '';
            cell.classList.remove('X', 'O', 'pop', 'last-move');
            currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        }
    } else {
        const lastMove = moveHistory.pop();
        boardState[lastMove.r][lastMove.c] = '';
        const index = lastMove.r * SIZE + lastMove.c;
        const cell = boardElement.children[index];
        cell.textContent = '';
        cell.classList.remove('X', 'O', 'pop', 'last-move');
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    }

    if (moveHistory.length > 0) {
        const previousMove = moveHistory[moveHistory.length - 1];
        const prevIndex = previousMove.r * SIZE + previousMove.c;
        boardElement.children[prevIndex].classList.add('last-move');
    }

    gameActive = true;
    winnerModal.style.display = 'none';

    if (moveHistory.length === 0) {
        btnUndo.style.opacity = '0.5';
        btnUndo.style.pointerEvents = 'none';
    }
    
    document.querySelectorAll('.winning-cell').forEach(c => c.classList.remove('winning-cell'));
}

btnRestart.addEventListener('click', initGame);
btnModalRestart.addEventListener('click', initGame);
btnUndo.addEventListener('click', undoMove);
btnHint.addEventListener('click', () => {
    btnHint.style.opacity = '0.5';
    btnHint.style.pointerEvents = 'none';
    showHint();
});

btnMode.addEventListener('click', () => {
    if (gameMode === 'PvP') {
        gameMode = 'PvE_Human';
        iconPvP.style.display = 'none';
        iconPvEHuman.style.display = 'inline';
        iconPvEMachine.style.display = 'none';
        btnMode.innerHTML = iconPvEHuman.outerHTML + ' Người Đánh Trước';
    } else if (gameMode === 'PvE_Human') {
        gameMode = 'PvE_Machine';
        iconPvP.style.display = 'none';
        iconPvEHuman.style.display = 'none';
        iconPvEMachine.style.display = 'inline';
        btnMode.innerHTML = iconPvEMachine.outerHTML + ' Máy Đánh Trước';
    } else {
        gameMode = 'PvP';
        iconPvP.style.display = 'inline';
        iconPvEHuman.style.display = 'none';
        iconPvEMachine.style.display = 'none';
        btnMode.innerHTML = iconPvP.outerHTML + ' Chơi 2 Người';
    }
    initGame();
});

btnDifficulty.addEventListener('click', () => {
    aiLevel++;
    if (aiLevel > 4) aiLevel = 1;
    
    let text = 'Dễ';
    let icon = 'fa-baby';
    if (aiLevel === 2) { text = 'Vừa'; icon = 'fa-child'; }
    else if (aiLevel === 3) { text = 'Khó'; icon = 'fa-robot'; }
    else if (aiLevel === 4) { text = 'Vô cực'; icon = 'fa-brain'; }
    
    btnDifficulty.innerHTML = `<i class="fas ${icon}"></i> Máy: ${text}`;
});

btnSize.addEventListener('click', () => {
    if (SIZE === 15) SIZE = 20;
    else if (SIZE === 20) SIZE = 25;
    else SIZE = 15;
    
    btnSize.innerHTML = `<i class="fas fa-expand"></i> ${SIZE}x${SIZE}`;
    aiEngine = new GomokuAI(SIZE);
    initGame();
    
    const gameArea = document.querySelector('.game-area');
    const wrapper = document.querySelector('.board-wrapper');
    gameArea.scrollTop = (wrapper.scrollHeight - gameArea.clientHeight) / 2;
    gameArea.scrollLeft = (wrapper.scrollWidth - gameArea.clientWidth) / 2;
});

window.addEventListener('load', () => {
    setTimeout(() => alert("Đã cập nhật bản CHẠY ĐƠN LUỒNG siêu mượt!"), 500);
    aiEngine = new GomokuAI(SIZE);
    initGame();
    const gameArea = document.querySelector('.game-area');
    const wrapper = document.querySelector('.board-wrapper');
    gameArea.scrollTop = (wrapper.scrollHeight - gameArea.clientHeight) / 2;
    gameArea.scrollLeft = (wrapper.scrollWidth - gameArea.clientWidth) / 2;
});
