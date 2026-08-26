const fs = require('fs');
let scriptContent = fs.readFileSync('c:/Users/Admin/Downloads/caro/script.js', 'utf8');
const workerContent = fs.readFileSync('c:/Users/Admin/Downloads/caro/worker.js', 'utf8');

// Strip out the broken Blob logic that I inserted
scriptContent = scriptContent.replace(/const workerCode = [^]*?URL\.createObjectURL\(workerBlob\);\r?\n/, '');

// Escape backticks and dollars in workerContent
const escaped = workerContent.replace(/`/g, '\\`').replace(/\$/g, '\\$');

const blobLogic = `const workerCode = \`${escaped}\`;
const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(workerBlob);
`;

scriptContent = scriptContent.replace('function setupWorker() {', blobLogic + 'function setupWorker() {');

// Also update where the worker is instantiated
scriptContent = scriptContent.replace(/aiWorker = new Worker\('worker\.js'\);/g, 'aiWorker = new Worker(workerUrl);');

fs.writeFileSync('c:/Users/Admin/Downloads/caro/script.js', scriptContent);
console.log('Fixed script.js successfully');
