const fs = require('fs');
let scriptContent = fs.readFileSync('c:/Users/Admin/Downloads/caro/script.js', 'utf8');

scriptContent = scriptContent.replace(
    /aiWorker\.onerror = function\(e\) \{[\s\S]*?\};/,
    `aiWorker.onerror = function(e) {
            console.warn('Worker error (CORS/Blob blocked). Falling back to main thread.');
            useWorker = false;
            initFallbackAI();
            if (isAIThinking) {
                isAIThinking = false;
                if (gameActive) {
                    setTimeout(() => {
                        const evt = new CustomEvent('forceAI');
                        window.dispatchEvent(evt);
                    }, 500);
                }
            }
        };`
);

if (!scriptContent.includes('forceAI')) {
    scriptContent += `
window.addEventListener('forceAI', () => {
    playAITurn();
});
`;
}

fs.writeFileSync('c:/Users/Admin/Downloads/caro/script.js', scriptContent);
