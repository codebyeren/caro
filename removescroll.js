const fs = require('fs');
let scriptContent = fs.readFileSync('c:/Users/Admin/Downloads/caro/script.js', 'utf8');

scriptContent = scriptContent.replace("cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });", "// scroll removed");

fs.writeFileSync('c:/Users/Admin/Downloads/caro/script.js', scriptContent);
console.log('Removed scrollIntoView');
