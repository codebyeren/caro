const fs = require('fs');

let indexHtml = fs.readFileSync('c:/Users/Admin/Downloads/caro/index.html', 'utf8');
indexHtml = indexHtml.replace(/<title>.*?<\/title>/, '<title>Cờ Caro 25x25 (v17)</title>');
indexHtml = indexHtml.replace(/script\.js\?v=\d+/, 'script.js?v=17');
fs.writeFileSync('c:/Users/Admin/Downloads/caro/index.html', indexHtml);

let scriptContent = fs.readFileSync('c:/Users/Admin/Downloads/caro/script.js', 'utf8');
if (!scriptContent.includes('alert(')) {
    scriptContent = scriptContent.replace('setupWorker();', 'setupWorker();\nsetTimeout(() => alert("Đã cập nhật v17! Web Worker: " + useWorker), 500);');
    fs.writeFileSync('c:/Users/Admin/Downloads/caro/script.js', scriptContent);
}

let swContent = fs.readFileSync('c:/Users/Admin/Downloads/caro/sw.js', 'utf8');
swContent = swContent.replace(/caro-v\d+/, 'caro-v17');
fs.writeFileSync('c:/Users/Admin/Downloads/caro/sw.js', swContent);

console.log('Updated to v17 with alert');
