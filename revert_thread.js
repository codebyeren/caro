const fs = require('fs');

let scriptContent = fs.readFileSync('c:/Users/Admin/Downloads/caro/script.js', 'utf8');

// Extract GomokuAI class from workerCode
const classMatch = scriptContent.match(/class GomokuAI \{[\s\S]*?getBestMove[\s\S]*?\}\s*\n\s*\}/);

if (!classMatch) {
    console.error("Could not find GomokuAI class");
    process.exit(1);
}

let gomokuClass = classMatch[0];

// Remove worker code entirely
let cleanScript = scriptContent.replace(/const workerCode = `[\s\S]*?`;/, '');
cleanScript = cleanScript.replace(/let aiWorker = null;/g, 'let aiEngine = null;');

// Remove worker error handling and setupWorker
cleanScript = cleanScript.replace(/function setupWorker\(\) \{[\s\S]*?\n\}/, '');
cleanScript = cleanScript.replace(/const errorCatch = [\s\S]*?;/, '');
cleanScript = cleanScript.replace(/self\.onerror = [\s\S]*?\n};/g, '');
cleanScript = cleanScript.replace(/let useWorker = [\s\S]*?;\n/, '');
cleanScript = cleanScript.replace(/let fallbackAI = [\s\S]*?;\n/, '');
cleanScript = cleanScript.replace(/function initFallbackAI\(\) \{[\s\S]*?\n\}/, '');

// Redefine setupWorker to setup engine
const newSetup = `
function setupWorker() {
    // Single threaded mode
    aiEngine = new GomokuAI(SIZE);
}
`;
cleanScript = cleanScript.replace(/setupWorker\(\);/g, newSetup + '\nsetupWorker();');

// Rewrite playAITurn
const newPlayAI = `
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
    else if (aiLevel === 4) { timeLimit = 5000; maxDepth = 30; } // Vô cực nghĩ 5s

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
`;

cleanScript = cleanScript.replace(/function playAITurn\(\) \{[\s\S]*?(?=function showHint\(\))/m, newPlayAI);

// Rewrite showHint
const newShowHint = `
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
`;

cleanScript = cleanScript.replace(/function showHint\(\) \{[\s\S]*?(?=function handleAIResult)/m, newShowHint);

// Inject GomokuAI class at the top
cleanScript = gomokuClass + '\n\n' + cleanScript;

fs.writeFileSync('c:/Users/Admin/Downloads/caro/script.js', cleanScript);
console.log('Successfully reverted to single-threaded script.');
