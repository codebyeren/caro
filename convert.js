const fs = require('fs');

let content = fs.readFileSync('c:/Users/Admin/Downloads/caro/script.js', 'utf8');

// 1. Extract GomokuAI class code
const workerCodeMatch = content.match(/const workerCode = `([\s\S]*?)`;/);
if (!workerCodeMatch) process.exit(1);

let aiClassCode = workerCodeMatch[1].split('self.onmessage')[0];

// 2. Remove workerCode string declaration
content = content.replace(/const workerCode = `[\s\S]*?`;/, '');

// 3. Remove worker initialization and fallback logic
content = content.replace(/function setupWorker\(\) \{[\s\S]*?\n\}/, 'function setupWorker() { aiEngine = new GomokuAI(SIZE); }');
content = content.replace(/const errorCatch = [\s\S]*?;\n/, '');
content = content.replace(/self\.onerror = [\s\S]*?};\n/, '');
content = content.replace(/let fallbackLogic = `[\s\S]*?`;/, '');
content = content.replace(/let useWorker = true;\nlet fallbackAI = null;\n/, '');
content = content.replace(/function initFallbackAI\(\) \{[\s\S]*?\n\}\n/g, '');

// 4. Replace playAITurn completely
const playAIReplacement = `
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
        } catch (e) {
            alert("Lỗi AI: " + e.message);
            isAIThinking = false;
            document.body.style.cursor = 'default';
            btnDifficulty.classList.remove('thinking-pulse');
        }
    }, 100);
}
`;
content = content.replace(/function playAITurn\(\) \{[\s\S]*?\n\}(?=\n\nfunction showHint\(\))/m, playAIReplacement.trim());

// 5. Replace showHint completely
const hintReplacement = `
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
        } catch (e) {
            alert("Lỗi AI: " + e.message);
            isAIThinking = false;
            document.body.style.cursor = 'default';
            btnDifficulty.classList.remove('thinking-pulse');
        }
    }, 100);
}
`;
content = content.replace(/function showHint\(\) \{[\s\S]*?\n\}(?=\n\nfunction handleAIResult)/m, hintReplacement.trim());

// Replace aiWorker variable with aiEngine
content = content.replace(/let aiWorker = null;/, 'let aiEngine = null;');

// Strip out any aiWorker.onmessage stuff in main thread
content = content.replace(/aiWorker\.onmessage = function\(e\) \{[\s\S]*?return;\n        \}[\s\S]*?\n\s*\};/, '');

// Put class at the top
content = aiClassCode + '\n\n' + content;

fs.writeFileSync('c:/Users/Admin/Downloads/caro/script.js', content);
console.log('Conversion to single-thread complete.');
