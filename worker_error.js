const fs = require('fs');
let scriptContent = fs.readFileSync('c:/Users/Admin/Downloads/caro/script.js', 'utf8');

const errorCatch = `self.onerror = function(msg, url, line, col, error) {
    self.postMessage({ type: 'WORKER_ERROR', error: msg + ' ' + (error ? error.stack : '') });
    return true;
};
`;

if (!scriptContent.includes('self.onerror =')) {
    scriptContent = scriptContent.replace('let aiEngine = null;', errorCatch + '\\nlet aiEngine = null;');
}

const mainThreadCatch = `
    aiWorker.onmessage = function(e) {
        if (e.data.type === 'WORKER_ERROR') {
            alert("Lỗi bên trong Worker: " + e.data.error);
            isAIThinking = false;
            document.body.style.cursor = 'default';
            btnDifficulty.classList.remove('thinking-pulse');
            return;
        }
`;

if (!scriptContent.includes('WORKER_ERROR')) {
    scriptContent = scriptContent.replace('aiWorker.onmessage = function(e) {', mainThreadCatch);
}

fs.writeFileSync('c:/Users/Admin/Downloads/caro/script.js', scriptContent);
console.log('Added worker inner error handling');
