const fs = require('fs');
const path = require('path');
const parser = require('../lib/parser');

const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

console.log('Scanning songs and tracker data from workspace...');
const data = parser.scanWorkspace(path.join(__dirname, '..'));

const outputPath = path.join(publicDir, 'songs-data.json');
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');

console.log(`\n===========================================`);
console.log(`🎉 LyricSync Static Build Summary:`);
console.log(` - Library Songs: ${data.totalSongs}`);
console.log(` - Eras in Library: ${data.eras.map(e => `${e.name} (${e.count})`).join(', ')}`);
console.log(` - Total Tracker Songs: ${data.trackerStats.totalTracked}`);
console.log(` - Synced in Tracker: ${data.trackerStats.syncedCount} (${data.trackerStats.overallPercentage}%)`);
console.log(` - Unsynced in Tracker: ${data.trackerStats.unsyncedCount}`);
console.log(` - Crypto Wallets Configured: ${data.donations ? data.donations.wallets.length : 0}`);
console.log(` - Aliases Mapped: ${Object.keys(data.aliases || {}).length}`);
console.log(` - Saved Database: ${outputPath}`);
console.log(`===========================================\n`);
