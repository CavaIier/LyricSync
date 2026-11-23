const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { readAudioTags } = require('../lib/audio-tag-reader');
const { extractSongAliases, parseTitleTokens } = require('../lib/alias-extractor');
const { normalizeTitle } = require('../lib/parser');

const SUPPORTED_EXTS = new Set(['.mp3', '.flac', '.m4a', '.mp4', '.wav']);
const EXCLUDED_DIRS = new Set(['node_modules', '.git', '$recycle.bin', 'system volume information']);

const ERA_SECTION_HEADERS = {
  GBGR: '# --- Goodbye & Good Riddance (GBGR) Era ---',
  DRFL: '# --- Death Race For Love (DRFL) Era ---',
  OUT: '# --- The Outsiders (OUT) Era ---',
  WOD: '# --- Wrld On Drugs (WOD) Era ---',
  OTHER: '# --- Discovered & Unreleased Songs ---'
};

/**
 * Recursively find all audio files in directory
 */
function findAudioFiles(dir, fileList = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name.toLowerCase()) && !entry.name.startsWith('.')) {
          findAudioFiles(fullPath, fileList);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTS.has(ext)) {
          fileList.push(fullPath);
        }
      }
    }
  } catch (err) {
    console.warn(`Warning: Could not read directory ${dir}:`, err.message);
  }
  return fileList;
}

/**
 * Load known songs from workspace tracker and library
 */
function loadKnownCatalog(rootDir) {
  const catalog = {
    // map normalized title -> { canonicalTitle, era }
    byNormTitle: new Map(),
    // map alias normalized -> canonicalTitle
    byAliasNorm: new Map(),
    // existing aliases from aliases.txt: map normalized title -> array of aliases
    existingAliases: new Map()
  };

  const dataDir = path.join(rootDir, 'data');
  const trackerDir = path.join(dataDir, 'tracker');

  // 1. Read existing aliases.txt
  const aliasesTxtFile = path.join(dataDir, 'aliases.txt');
  if (fs.existsSync(aliasesTxtFile)) {
    const lines = fs.readFileSync(aliasesTxtFile, 'utf-8').split(/\r?\n/);
    lines.forEach(l => {
      const clean = l.trim();
      if (!clean || clean.startsWith('#') || clean.startsWith('//')) return;
      const eqIdx = clean.indexOf('=');
      if (eqIdx !== -1) {
        const title = clean.substring(0, eqIdx).trim();
        const alts = clean.substring(eqIdx + 1).split(/[,;\/]/).map(a => a.trim()).filter(Boolean);
        if (title) {
          const norm = normalizeTitle(title);
          catalog.existingAliases.set(norm, alts);
          alts.forEach(alt => {
            catalog.byAliasNorm.set(normalizeTitle(alt), title);
          });
        }
      }
    });
  }

  // 2. Read tracker files
  const trackerEras = ['DRFL', 'OUT', 'GBGR', 'WOD'];
  trackerEras.forEach(era => {
    const tFile = path.join(trackerDir, `${era}.txt`);
    if (fs.existsSync(tFile)) {
      const lines = fs.readFileSync(tFile, 'utf-8').split(/\r?\n/);
      lines.forEach(l => {
        const title = l.split('\t')[0]?.trim();
        if (title) {
          const parsed = parseTitleTokens(title);
          const cleanTitle = parsed.baseTitle || title;
          const normRaw = normalizeTitle(title);
          const normClean = normalizeTitle(cleanTitle);

          const canonical = cleanTitle;
          if (!catalog.byNormTitle.has(normClean)) {
            catalog.byNormTitle.set(normClean, { canonicalTitle: canonical, era });
          }
          if (!catalog.byNormTitle.has(normRaw)) {
            catalog.byNormTitle.set(normRaw, { canonicalTitle: canonical, era });
          }
          parsed.nicknames.forEach(nick => {
            catalog.byAliasNorm.set(normalizeTitle(nick), canonical);
          });
        }
      });
    }
  });

  // 3. Read songs-data.json if exists
  const songsDataFile = path.join(rootDir, 'public', 'songs-data.json');
  if (fs.existsSync(songsDataFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(songsDataFile, 'utf-8'));
      if (data.songs && Array.isArray(data.songs)) {
        data.songs.forEach(s => {
          const parsed = parseTitleTokens(s.title);
          const cleanTitle = parsed.baseTitle || s.title;
          const normClean = normalizeTitle(cleanTitle);
          const normRaw = normalizeTitle(s.title);

          if (!catalog.byNormTitle.has(normClean)) {
            catalog.byNormTitle.set(normClean, { canonicalTitle: cleanTitle, era: s.era });
          }
          if (!catalog.byNormTitle.has(normRaw)) {
            catalog.byNormTitle.set(normRaw, { canonicalTitle: cleanTitle, era: s.era });
          }
          if (s.aliases) {
            s.aliases.forEach(a => {
              catalog.byAliasNorm.set(normalizeTitle(a), cleanTitle);
            });
          }
        });
      }
    } catch (e) {}
  }

  return catalog;
}

/**
 * Merge newly found aliases into data/aliases.txt preserving existing sections
 */
function mergeAliasesIntoFile(aliasesFilePath, discoveredMap) {
  let content = '';
  if (fs.existsSync(aliasesFilePath)) {
    content = fs.readFileSync(aliasesFilePath, 'utf-8');
    // Create backup
    fs.writeFileSync(`${aliasesFilePath}.bak`, content, 'utf-8');
  }

  const lines = content ? content.split(/\r?\n/) : [];
  const updatedLines = [];
  const handledSongs = new Set();
  let addedCount = 0;

  // Process existing lines in aliases.txt
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      updatedLines.push(line);
      return;
    }

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) {
      updatedLines.push(line);
      return;
    }

    const title = trimmed.substring(0, eqIdx).trim();
    const existingAlts = trimmed.substring(eqIdx + 1).split(/[,;\/]/).map(a => a.trim()).filter(Boolean);
    const norm = normalizeTitle(title);

    if (discoveredMap.has(norm)) {
      handledSongs.add(norm);
      const disc = discoveredMap.get(norm);
      const mergedList = [...existingAlts];

      disc.nicknames.forEach(newNick => {
        const cleanNew = newNick.trim();
        const alreadyHas = mergedList.some(ex => ex.toLowerCase() === cleanNew.toLowerCase());
        if (!alreadyHas && cleanNew.toLowerCase() !== title.toLowerCase()) {
          mergedList.push(cleanNew);
          addedCount++;
        }
      });

      updatedLines.push(`${title} = ${mergedList.join(', ')}`);
    } else {
      updatedLines.push(line);
    }
  });

  // Group unhandled new songs by era
  const unhandledByEra = {
    GBGR: [],
    DRFL: [],
    OUT: [],
    WOD: [],
    OTHER: []
  };

  discoveredMap.forEach((info, norm) => {
    if (handledSongs.has(norm)) return;
    if (!info.nicknames || info.nicknames.length === 0) return;

    const eraKey = (info.era && unhandledByEra[info.era]) ? info.era : 'OTHER';
    const cleanNicks = [];
    info.nicknames.forEach(n => {
      const clean = n.trim();
      if (!cleanNicks.some(ex => ex.toLowerCase() === clean.toLowerCase()) && clean.toLowerCase() !== info.canonicalTitle.toLowerCase()) {
        cleanNicks.push(clean);
      }
    });

    if (cleanNicks.length > 0) {
      unhandledByEra[eraKey].push({
        title: info.canonicalTitle,
        nicknames: cleanNicks
      });
      addedCount += cleanNicks.length;
    }
  });

  // Insert unhandled songs into their respective era sections
  Object.keys(unhandledByEra).forEach(eraKey => {
    const songList = unhandledByEra[eraKey];
    if (songList.length === 0) return;

    const header = ERA_SECTION_HEADERS[eraKey] || ERA_SECTION_HEADERS.OTHER;
    let headerIdx = updatedLines.findIndex(l => l.trim().toLowerCase() === header.trim().toLowerCase());

    if (headerIdx === -1) {
      // Add section at end if not found
      if (updatedLines.length > 0 && updatedLines[updatedLines.length - 1].trim() !== '') {
        updatedLines.push('');
      }
      updatedLines.push(header);
      songList.sort((a, b) => a.title.localeCompare(b.title)).forEach(s => {
        updatedLines.push(`${s.title} = ${s.nicknames.join(', ')}`);
      });
      updatedLines.push('');
    } else {
      // Find the end of this era section (next header or end of file)
      let insertIdx = headerIdx + 1;
      while (insertIdx < updatedLines.length) {
        const nextLine = updatedLines[insertIdx].trim();
        if (nextLine.startsWith('# ---') && nextLine.endsWith('---')) {
          break;
        }
        insertIdx++;
      }
      // Insert new songs before the next section
      const formattedLines = songList
        .sort((a, b) => a.title.localeCompare(b.title))
        .map(s => `${s.title} = ${s.nicknames.join(', ')}`);

      updatedLines.splice(insertIdx, 0, ...formattedLines);
    }
  });

  fs.writeFileSync(aliasesFilePath, updatedLines.join('\n'), 'utf-8');
  return addedCount;
}

/**
 * Main scanner execution
 */
async function run() {
  const rootDir = path.resolve(__dirname, '..');
  console.log('\n======================================================');
  console.log('🎵 LyricSync Audio Nickname & Alias Scanner');
  console.log('======================================================\n');

  let targetDir = process.argv[2] ? process.argv[2].trim() : process.env.MUSIC_DIR;

  if (!targetDir) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    targetDir = await new Promise(resolve => {
      rl.question('📂 Enter the full path to your audio music folder:\n> ', answer => {
        rl.close();
        resolve(answer.trim().replace(/^["']|["']$/g, ''));
      });
    });
  }

  if (!targetDir || !fs.existsSync(targetDir)) {
    console.error(`\n❌ Error: Directory not found: "${targetDir}"`);
    console.log('Usage: npm run scan-aliases -- "C:\\path\\to\\your\\music"');
    process.exit(1);
  }

  console.log(`\n🔍 Scanning folder: "${targetDir}"...`);
  const audioFiles = findAudioFiles(targetDir);
  console.log(`📁 Found ${audioFiles.length} audio file(s) (.mp3, .flac, .m4a, .wav).`);

  if (audioFiles.length === 0) {
    console.log('⚠️ No audio files found in specified directory.');
    process.exit(0);
  }

  console.log('📚 Loading LyricSync master tracker and catalog...');
  const catalog = loadKnownCatalog(rootDir);

  const discoveredMap = new Map(); // normTitle -> { canonicalTitle, era, nicknames: [] }
  let withTagsCount = 0;
  let genericFilenameCount = 0;
  let songsWithNicknamesCount = 0;

  audioFiles.forEach(filePath => {
    const filename = path.basename(filePath);
    const tags = readAudioTags(filePath);
    if (tags && tags.title) withTagsCount++;

    const analyzed = extractSongAliases(filename, tags);
    if (analyzed.isGenericFilename) genericFilenameCount++;

    if (analyzed.nicknames.length === 0) return;

    let canonicalTitle = analyzed.baseTitle;
    let era = analyzed.detectedEra || null;

    // Check if title or any alias matches known songs in catalog
    const norm = normalizeTitle(canonicalTitle);
    if (catalog.byNormTitle.has(norm)) {
      const match = catalog.byNormTitle.get(norm);
      canonicalTitle = match.canonicalTitle;
      if (!era) era = match.era;
    } else if (catalog.byAliasNorm.has(norm)) {
      canonicalTitle = catalog.byAliasNorm.get(norm);
      const match = catalog.byNormTitle.get(normalizeTitle(canonicalTitle));
      if (match && !era) era = match.era;
    }

    const finalNorm = normalizeTitle(canonicalTitle);
    if (!discoveredMap.has(finalNorm)) {
      discoveredMap.set(finalNorm, {
        canonicalTitle,
        era,
        nicknames: []
      });
    }

    const entry = discoveredMap.get(finalNorm);
    analyzed.nicknames.forEach(nick => {
      const normN = normalizeTitle(nick);
      const normT = normalizeTitle(canonicalTitle);
      if (normN && normN !== normT && !entry.nicknames.some(ex => ex.toLowerCase() === nick.toLowerCase())) {
        entry.nicknames.push(nick);
      }
    });
  });

  // Filter out any entries that ended up with no new nicknames
  const validEntries = Array.from(discoveredMap.values()).filter(e => e.nicknames.length > 0);
  songsWithNicknamesCount = validEntries.length;

  console.log(`\n📊 Scan Results:`);
  console.log(` - Audio files processed: ${audioFiles.length}`);
  console.log(` - Files with internal metadata tags: ${withTagsCount}`);
  console.log(` - Generic / numbered filenames resolved: ${genericFilenameCount}`);
  console.log(` - Songs with discovered nicknames: ${songsWithNicknamesCount}`);

  if (songsWithNicknamesCount === 0) {
    console.log('\n✨ No new nicknames detected in the specified files.');
    process.exit(0);
  }

  // Preview sample of discovered aliases
  console.log(`\n🔎 Sample Discovered Nicknames:`);
  validEntries.slice(0, 8).forEach(s => {
    console.log(`  • ${s.canonicalTitle} (${s.era || 'Era Unknown'}) = ${s.nicknames.join(', ')}`);
  });
  if (validEntries.length > 8) {
    console.log(`    ... and ${validEntries.length - 8} more song(s)`);
  }

  // Merge into data/aliases.txt
  const aliasesFilePath = path.join(rootDir, 'data', 'aliases.txt');
  console.log(`\n💾 Merging into ${path.relative(rootDir, aliasesFilePath)}...`);
  const addedCount = mergeAliasesIntoFile(aliasesFilePath, discoveredMap);
  console.log(`✅ Saved! Added/merged ${addedCount} nickname(s) to aliases.txt (backup saved as aliases.txt.bak).`);

  // Automatically rebuild static catalog
  console.log('\n⚡ Rebuilding static catalog (songs-data.json)...');
  try {
    const buildScript = path.join(rootDir, 'scripts', 'build-static.js');
    require(buildScript);
  } catch (err) {
    console.warn('⚠️ Could not rebuild static catalog automatically:', err.message);
  }

  console.log('\n======================================================');
  console.log('🎉 Done! Search on LyricSync is now updated with all nicknames.');
  console.log('======================================================\n');
}

if (require.main === module) {
  run().catch(err => {
    console.error('Fatal scanner error:', err);
    process.exit(1);
  });
}

module.exports = {
  findAudioFiles,
  loadKnownCatalog,
  mergeAliasesIntoFile
};
