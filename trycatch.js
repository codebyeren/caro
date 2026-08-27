const fs = require('fs');

let scriptContent = fs.readFileSync('c:/Users/Admin/Downloads/caro/script.js', 'utf8');

scriptContent = scriptContent.replace(
    /if \(!useWorker\) \{[\s\S]*?setTimeout\(\(\) => \{[\s\S]*?if \(!fallbackAI\) fallbackAI = new GomokuAI\(SIZE\);[\s\S]*?fallbackAI\.syncFromState\(boardState\);[\s\S]*?const move = fallbackAI\.getBestMove\(player, timeLimit, maxDepth\);[\s\S]*?handleAIResult\(move, action\);[\s\S]*?\}, 100\);[\s\S]*?return;[\s\S]*?\}/g,
    `if (!useWorker) {
        setTimeout(() => {
            try {
                if (!fallbackAI) fallbackAI = new GomokuAI(SIZE);
                fallbackAI.syncFromState(boardState);
                const move = fallbackAI.getBestMove(player, timeLimit, maxDepth);
                handleAIResult(move, action);
            } catch (e) {
                alert("Lỗi AI trên máy của bạn: " + e.message);
                isAIThinking = false;
                document.body.style.cursor = 'default';
                btnDifficulty.classList.remove('thinking-pulse');
            }
        }, 100);
        return;
    }`
);

fs.writeFileSync('c:/Users/Admin/Downloads/caro/script.js', scriptContent);
console.log('Added try-catch to fallbackAI');
