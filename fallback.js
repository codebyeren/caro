const fs = require('fs');
let scriptContent = fs.readFileSync('c:/Users/Admin/Downloads/caro/script.js', 'utf8');

const fallbackLogic = `
let useWorker = true;
let fallbackAI = null;

function initFallbackAI() {
    if (typeof GomokuAI !== 'undefined') return;
    const safeCode = workerCode.split('self.onmessage')[0];
    const script = document.createElement('script');
    script.textContent = safeCode;
    document.head.appendChild(script);
}

function setupWorker() {
    const isLocal = window.location.protocol === 'file:' || window.location.protocol === 'content:';
    if (isLocal) {
        useWorker = false;
        initFallbackAI();
        return;
    }

    try {
        if (aiWorker) aiWorker.terminate();
        const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(workerBlob);
        aiWorker = new Worker(workerUrl);
        
        aiWorker.onmessage = function(e) {
            if (e.data.type === 'MOVE_RESULT') {
                handleAIResult(e.data.move, e.data.action);
            }
        };
        
        aiWorker.onerror = function(e) {
            console.warn('Worker error (CORS/Blob blocked). Falling back to main thread.');
            useWorker = false;
            initFallbackAI();
        };
    } catch (e) {
        console.warn('Worker construction failed. Falling back to main thread.');
        useWorker = false;
        initFallbackAI();
    }
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
            cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    } else if (action === 'HINT' && gameActive) {
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
`;

// Replace setupWorker
scriptContent = scriptContent.replace(/function setupWorker\(\) \{[\s\S]*?setupWorker\(\);/, fallbackLogic + '\nsetupWorker();');

const dispatchLogic = `
    if (!useWorker) {
        setTimeout(() => {
            if (!fallbackAI) fallbackAI = new GomokuAI(SIZE);
            fallbackAI.syncFromState(boardState);
            const move = fallbackAI.getBestMove(player, timeLimit, maxDepth);
            handleAIResult(move, action);
        }, 100);
        return;
    }
    
    aiWorker.postMessage({
`;

scriptContent = scriptContent.replace(/aiWorker\.postMessage\(\{\s*type: 'GET_MOVE',[\s\S]*?action: 'PLAY'\s*\}\);/g, 
    `const action = 'PLAY'; const player = aiPlayer;` + dispatchLogic + 
    `        type: 'GET_MOVE',
        boardState: boardState,
        size: SIZE,
        player: player,
        timeLimit: timeLimit,
        maxDepth: maxDepth,
        action: action
    });`);
    
scriptContent = scriptContent.replace(/aiWorker\.postMessage\(\{\s*type: 'GET_MOVE',[\s\S]*?action: 'HINT'\s*\}\);/g, 
    `const action = 'HINT'; const player = currentPlayer;` + dispatchLogic + 
    `        type: 'GET_MOVE',
        boardState: boardState,
        size: SIZE,
        player: player,
        timeLimit: timeLimit,
        maxDepth: maxDepth,
        action: action
    });`);

scriptContent = scriptContent.replace(/aiWorker\.postMessage\(\{ type: 'INIT', size: SIZE \}\);/g, 
    `if (useWorker && aiWorker) aiWorker.postMessage({ type: 'INIT', size: SIZE });`);

fs.writeFileSync('c:/Users/Admin/Downloads/caro/script.js', scriptContent);
