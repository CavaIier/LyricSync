const fs = require('fs');
const path = require('path');
const parser = require('../lib/parser');

const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

console.log('Scanning songs from workspace...');
const data = parser.scanWorkspace(path.join(__dirname, '..'));

const outputPath = path.join(publicDir, 'songs-data.json');
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');

console.log(`Successfully built songs database:`);
console.log(` - Total songs: ${data.totalSongs}`);
console.log(` - Eras found: ${data.eras.map(e => `${e.name} (${e.count})`).join(', ')}`);
console.log(` - Saved to: ${outputPath}`);
