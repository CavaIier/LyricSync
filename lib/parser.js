const fs = require('fs');
const path = require('path');

const ERA_LABELS = {
  DRFL: {
    name: 'Death Race For Love',
    badge: 'DRFL',
    color: '#8b5cf6', // purple
    gradient: 'from-purple-600 to-indigo-600',
    description: 'Death Race For Love Era (2019)'
  },
  OUT: {
    name: 'The Outsiders',
    badge: 'OUT',
    color: '#06b6d4', // cyan / teal
    gradient: 'from-cyan-600 to-blue-600',
    description: 'The Outsiders Planned Era (2019-2020)'
  },
  GBGR: {
    name: 'Goodbye & Good Riddance',
    badge: 'GBGR',
    color: '#f59e0b',
    gradient: 'from-amber-500 to-orange-600',
    description: 'Goodbye & Good Riddance Era (2018)'
  },
  WOD: {
    name: 'Wrld On Drugs',
    badge: 'WOD',
    color: '#10b981',
    gradient: 'from-emerald-500 to-teal-600',
    description: 'Wrld On Drugs with Future (2018)'
  },
  JW3: {
    name: 'Juice WRLD 3',
    badge: 'JW3',
    color: '#ec4899',
    gradient: 'from-pink-500 to-rose-600',
    description: 'Juice WRLD Era 3'
  }
};

const EXCLUDED_DIRS = new Set([
  'node_modules',
  'public',
  'scripts',
  'lib',
  'dist',
  'data',
  '.git',
  '.gemini',
  '.vscode',
  'scratch'
]);

/**
 * Remove accents, punctuation, and extra whitespace for fuzzy matching
 */
function normalizeTitle(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics / accents
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, '')   // remove (v1), (feat...)
    .replace(/\s*\[[^\]]*\]/g, '') // remove [v1], [feat...]
    .replace(/\s*\{[^}]*\}/g, '') // remove {v1}
    .replace(/^juice wrld\s*[-&]?\s*/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function extractVersion(str) {
  if (!str) return null;
  const match = str.match(/\b(v\d+|version\s*\d+)\b/i);
  return match ? match[1].toLowerCase().replace(/\s+/, '') : null;
}

function normalizeTitleExact(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^juice wrld\s*[-&]?\s*/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Parse an LRC timestamp tag into seconds and standard [mm:ss.xx]
 */
function parseTimestamp(raw) {
  if (!raw) return null;
  const clean = raw.trim();

  if (clean.includes('.')) {
    const parts = clean.split(/[:.]/);
    if (parts.length >= 3) {
      const min = parseInt(parts[0], 10) || 0;
      const sec = parseInt(parts[1], 10) || 0;
      const msStr = (parts[2] || '00').padEnd(2, '0').slice(0, 2);
      const cs = parseInt(msStr, 10) || 0;
      const totalSec = min * 60 + sec + cs / 100;
      const formatted = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${msStr}`;
      return { totalSec, formatted };
    }
  } else {
    const parts = clean.split(':');
    if (parts.length === 3) {
      const p0 = parseInt(parts[0], 10) || 0;
      const p1 = parseInt(parts[1], 10) || 0;
      const p2 = parseInt(parts[2], 10) || 0;

      if (parts[0] === '00' && p1 < 60 && p2 < 60) {
        const totalSec = p1 * 60 + p2;
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        const formatted = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.00`;
        return { totalSec, formatted };
      } else {
        const msStr = (parts[2] || '00').padEnd(2, '0').slice(0, 2);
        const totalSec = p0 * 60 + p1 + p2 / 100;
        const formatted = `${String(p0).padStart(2, '0')}:${String(p1).padStart(2, '0')}.${msStr}`;
        return { totalSec, formatted };
      }
    } else if (parts.length === 2) {
      const min = parseInt(parts[0], 10) || 0;
      const sec = parseInt(parts[1], 10) || 0;
      const totalSec = min * 60 + sec;
      const formatted = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.00`;
      return { totalSec, formatted };
    }
  }
  return null;
}

function formatDuration(totalSec) {
  if (!totalSec || isNaN(totalSec)) return '0:00';
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

/**
 * Parse a single lyrics text content into structured lines, plain text, and clean LRC
 */
function parseLyricsText(content, rawName, era, aliasesMap = {}, sourceFilename = null) {
  const filename = sourceFilename || (rawName.endsWith('.txt') || rawName.endsWith('.lrc') ? rawName : `${rawName}.txt`);
  let rawBaseName = rawName.replace(/\.(txt|lrc)$/i, '').trim();
  const fileAliases = [];

  // 1. Detect (aka Alternate Name) or [aka Alternate Name] in the filename
  const akaMatch = rawBaseName.match(/[\(\[]aka\s+([^\)\]]+)[\)\]]/i);
  if (akaMatch) {
    akaMatch[1].split(/[,;\/]/).map(a => a.trim()).filter(Boolean).forEach(a => {
      if (!fileAliases.includes(a)) fileAliases.push(a);
    });
    rawBaseName = rawBaseName.replace(/[\(\[]aka\s+[^\)\]]+[\)\]]/i, '').trim();
  }

  const splitIdx = rawBaseName.indexOf(' - ');
  let artist = 'Juice WRLD';
  let title = rawBaseName;

  if (splitIdx !== -1) {
    artist = rawBaseName.substring(0, splitIdx).trim();
    title = rawBaseName.substring(splitIdx + 3).trim();
  }

  const rawLines = content.split(/\r?\n/);
  const lines = [];
  const plainTextLines = [];
  const cleanLrcLines = [];

  let metadataArtist = artist;
  let metadataTitle = title;
  let maxTime = 0;
  let hasTimestamps = false;

  rawLines.forEach((rawLine, idx) => {
    let line = rawLine.replace(/^[a-z]{2,3}\|\|/i, '').trim();
    if (!line) {
      plainTextLines.push('');
      return;
    }

    // 2. Detect [aka: Name] or [alias: Name1, Name2] tags in the lyrics file header
    const idTagMatch = line.match(/^\[(ar|ti|al|by|offset|aka|alias):([^\]]*)\]/i);
    if (idTagMatch) {
      const key = idTagMatch[1].toLowerCase();
      const val = idTagMatch[2].trim();
      if (key === 'ar' && val) metadataArtist = val;
      if (key === 'ti' && val) metadataTitle = val;
      if ((key === 'aka' || key === 'alias') && val) {
        val.split(/[,;\/]/).map(a => a.trim()).filter(Boolean).forEach(a => {
          if (!fileAliases.includes(a)) fileAliases.push(a);
        });
      }
      return;
    }

    const timeMatch = line.match(/^\[([^\]]+)\](.*)/);
    if (timeMatch) {
      const parsed = parseTimestamp(timeMatch[1]);
      if (parsed) {
        hasTimestamps = true;
        const text = timeMatch[2].trim();
        if (parsed.totalSec > maxTime) {
          maxTime = parsed.totalSec;
        }

        lines.push({
          id: idx,
          seconds: parsed.totalSec,
          timestamp: `[${parsed.formatted}]`,
          displayTime: formatDuration(parsed.totalSec),
          text: text
        });

        cleanLrcLines.push(`[${parsed.formatted}] ${text}`.trimEnd());
        plainTextLines.push(text || '');
        return;
      }
    }

    lines.push({
      id: idx,
      seconds: null,
      timestamp: null,
      displayTime: null,
      text: line
    });
    plainTextLines.push(line);
    cleanLrcLines.push(line);
  });

  const eraInfo = ERA_LABELS[era] || {
    name: `${era} Era`,
    badge: era,
    color: '#6366f1',
    gradient: 'from-indigo-600 to-purple-600',
    description: `${era} Era`
  };

  const lrcHeader = [
    `[ti:${metadataTitle}]`,
    `[ar:${metadataArtist}]`,
    `[al:${eraInfo.name}]`,
    `[by:LyricSync]`,
    ''
  ].join('\n');

  const fullLrc = lrcHeader + cleanLrcLines.join('\n');
  const fullPlain = plainTextLines.join('\n');

  const id = `${era.toLowerCase()}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

  // Find song aliases
  const aliases = [...fileAliases];
  const normT = normalizeTitle(title);
  if (aliasesMap[title]) {
    aliasesMap[title].forEach(a => { if (!aliases.includes(a)) aliases.push(a); });
  }
  Object.entries(aliasesMap).forEach(([k, list]) => {
    if (normalizeTitle(k) === normT) {
      list.forEach(a => { if (!aliases.includes(a)) aliases.push(a); });
    }
  });

  return {
    id,
    era,
    eraName: eraInfo.name,
    eraBadge: eraInfo.badge,
    eraColor: eraInfo.color,
    filename,
    rawName: rawBaseName,
    title,
    artist,
    aliases,
    hasTimestamps,
    durationSec: Math.round(maxTime),
    durationFormatted: formatDuration(maxTime),
    lineCount: lines.filter(l => l.text && l.text.trim().length > 0).length,
    lines,
    plainText: fullPlain,
    lrcContent: fullLrc
  };
}

/**
 * Check if a file's content is an Mp3tag bulk export file containing multiple songs
 */
function isBulkLyricsContent(content) {
  if (!content) return false;
  return content.includes('===START===') && content.includes('===END===');
}

/**
 * Parse an Mp3tag bulk export file containing multiple songs delimited by ===START=== ... ===END===
 */
function parseBulkLyricsContent(content, era, aliasesMap = {}, sourceFilename = 'all_lyrics.txt') {
  const songs = [];
  const rawBlocks = content.split('===START===');

  for (const block of rawBlocks) {
    if (!block.trim()) continue;

    const endPos = block.indexOf('===END===');
    const itemContent = endPos !== -1 ? block.substring(0, endPos) : block;

    const match = itemContent.match(/FILENAME:\s*([^\r\n]+)/i);
    if (!match) continue;

    const rawFilename = match[1].trim();
    const afterFilenamePos = match.index + match[0].length;
    const lyricsBody = itemContent.substring(afterFilenamePos);

    // Skip empty tracks: check if there are meaningful lyric lines (beyond empty lines or ID tags)
    const meaningfulLines = lyricsBody
      .split(/\r?\n/)
      .map(l => l.replace(/^[a-z]{2,3}\|\|/i, '').trim())
      .filter(l => l.length > 0 && !/^\[(ar|ti|al|by|offset|aka|alias):/i.test(l));

    if (meaningfulLines.length === 0) {
      continue;
    }

    const song = parseLyricsText(lyricsBody, rawFilename, era, aliasesMap, rawFilename);
    if (song && song.lineCount > 0) {
      songs.push(song);
    }
  }

  return songs;
}

/**
 * Parse a lyrics file into structured lines, plain text, and clean LRC
 */
function parseLyricsFile(filePath, era, aliasesMap = {}) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const filename = path.basename(filePath);
  return parseLyricsText(content, filename, era, aliasesMap, filename);
}

/**
 * Scan workspace and compile tracker, donations, updates, and aliases
 */
function scanWorkspace(baseDir = process.cwd()) {
  const dataDir = path.join(baseDir, 'data');
  const trackerDir = path.join(dataDir, 'tracker');

  // Load aliases exclusively from data/aliases.txt (Single source of truth)
  let aliasesMap = {};
  const aliasesTxtFile = path.join(dataDir, 'aliases.txt');
  if (fs.existsSync(aliasesTxtFile)) {
    try {
      const txtLines = fs.readFileSync(aliasesTxtFile, 'utf-8').split(/\r?\n/);
      txtLines.forEach(l => {
        const cleanL = l.trim();
        if (!cleanL || cleanL.startsWith('#') || cleanL.startsWith('//')) return;
        const eqIdx = cleanL.indexOf('=');
        if (eqIdx !== -1) {
          const mainT = cleanL.substring(0, eqIdx).trim();
          const alts = cleanL.substring(eqIdx + 1).split(/[,;\/]/).map(a => a.trim()).filter(Boolean);
          if (mainT && alts.length > 0) {
            if (!aliasesMap[mainT]) aliasesMap[mainT] = [];
            alts.forEach(a => {
              // Deduplicate automatically: adding the same alias multiple times is completely safe
              if (!aliasesMap[mainT].includes(a)) aliasesMap[mainT].push(a);
              // Automatic bidirectional alias
              if (!aliasesMap[a]) aliasesMap[a] = [];
              if (!aliasesMap[a].includes(mainT)) aliasesMap[a].push(mainT);
            });
          }
        }
      });
    } catch (e) {
      console.warn('Could not parse aliases.txt:', e.message);
    }
  }

  // Load donations
  let donationsData = null;
  const donationsFile = path.join(dataDir, 'donations.json');
  if (fs.existsSync(donationsFile)) {
    try {
      donationsData = JSON.parse(fs.readFileSync(donationsFile, 'utf-8'));
    } catch (e) {
      console.warn('Could not parse donations.json:', e.message);
    }
  }

  // Scan physical song folders in workspace
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  const eras = [];
  const songs = [];
  const eraMap = {};

  for (const entry of entries) {
    if (entry.isDirectory() && !EXCLUDED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
      const eraDir = path.join(baseDir, entry.name);
      // Read directory entries and filter for files ending in .txt or .lrc (ignoring subdirectories like _archive)
      const eraEntries = fs.readdirSync(eraDir, { withFileTypes: true });
      const files = eraEntries
        .filter(f => f.isFile() && (f.name.endsWith('.txt') || f.name.endsWith('.lrc')))
        .map(f => f.name);

      if (files.length > 0) {
        const eraCode = entry.name;
        const eraMeta = ERA_LABELS[eraCode] || {
          name: `${eraCode} Era`,
          badge: eraCode,
          color: '#6366f1',
          gradient: 'from-indigo-600 to-purple-600',
          description: `${eraCode} Era`
        };

        const bulkFiles = [];
        const singleFiles = [];

        files.sort().forEach(file => {
          const filePath = path.join(eraDir, file);
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (isBulkLyricsContent(content)) {
              bulkFiles.push({ file, filePath, content });
            } else {
              singleFiles.push({ file, filePath, content });
            }
          } catch (e) {
            console.warn(`Could not read ${filePath}:`, e.message);
          }
        });

        const eraSongsMap = new Map();

        // 1. Process bulk files first
        bulkFiles.forEach(b => {
          const parsedBulkSongs = parseBulkLyricsContent(b.content, eraCode, aliasesMap, b.file);
          parsedBulkSongs.forEach(s => {
            eraSongsMap.set(s.id, s);
          });
        });

        // 2. Process individual song files (overriding bulk files if duplicate)
        singleFiles.forEach(sFile => {
          const songData = parseLyricsText(sFile.content, sFile.file, eraCode, aliasesMap, sFile.file);
          eraSongsMap.set(songData.id, songData);
        });

        const eraSongs = Array.from(eraSongsMap.values());
        if (eraSongs.length > 0) {
          eraMap[eraCode] = {
            code: eraCode,
            name: eraMeta.name,
            badge: eraMeta.badge,
            color: eraMeta.color,
            gradient: eraMeta.gradient,
            description: eraMeta.description,
            count: eraSongs.length
          };

          eraSongs.forEach(s => songs.push(s));
        }
      }
    }
  }

  // Build Tracker Master Catalog
  const trackerSongs = [];
  const trackerEras = ['DRFL', 'OUT', 'GBGR', 'WOD'];

  // Helper alias map for tracker matching
  const aliasNormMap = new Map();
  Object.entries(aliasesMap).forEach(([mainTitle, altList]) => {
    const mainNorm = normalizeTitle(mainTitle);
    altList.forEach(alt => {
      const altNorm = normalizeTitle(alt);
      aliasNormMap.set(altNorm, mainNorm);
      aliasNormMap.set(mainNorm, altNorm);
    });
  });

  const matchedSongIds = new Set();

  trackerEras.forEach(eraCode => {
    const filePath = path.join(trackerDir, `${eraCode}.txt`);
    if (!fs.existsSync(filePath)) return;

    const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      const parts = line.split('\t');
      const rawTitle = parts[0] ? parts[0].trim() : '';
      const notes = parts[1] && parts[1] !== '#N/A' ? parts[1].trim() : '';
      if (!rawTitle) return;

      const normT = normalizeTitle(rawTitle);
      const normTExact = normalizeTitleExact(rawTitle);
      const tVer = extractVersion(rawTitle);
      const eraMeta = ERA_LABELS[eraCode] || { badge: eraCode, name: `${eraCode} Era`, color: '#6366f1' };

      // Find matched library song STRICTLY IN THIS ERA ONLY (No cross-era bleeding!)
      let matched = songs.find(s => {
        if (s.era !== eraCode) return false;

        // Version safety: if tracker item specifies v1/v2, song title must not mismatch
        const sVer = extractVersion(s.title);
        if (tVer && sVer && tVer !== sVer) return false;

        const sNormExact = normalizeTitleExact(s.title);
        if (sNormExact === normTExact) return true;

        const sNorm = normalizeTitle(s.title);
        if (sNorm === normT) {
          // If tracker specifies a version but file doesn't, only match if it's v1
          if (tVer && !sVer && tVer !== 'v1') return false;
          return true;
        }

        // Check alias matching (strictly within this era)
        if (aliasNormMap.get(sNorm) === normT || aliasNormMap.get(normT) === sNorm) {
          return true;
        }

        return false;
      });

      if (matched) {
        matchedSongIds.add(matched.id);
      }

      // Extract aliases for this tracker item
      const itemAliases = [];
      if (aliasesMap[rawTitle]) itemAliases.push(...aliasesMap[rawTitle]);
      Object.entries(aliasesMap).forEach(([k, list]) => {
        if (normalizeTitle(k) === normT) {
          list.forEach(a => { if (!itemAliases.includes(a)) itemAliases.push(a); });
        }
      });

      trackerSongs.push({
        id: `trk-${eraCode.toLowerCase()}-${idx}`,
        era: eraCode,
        eraName: eraMeta.name,
        eraColor: eraMeta.color,
        title: rawTitle,
        notes: notes,
        aliases: itemAliases,
        status: matched ? 'synced' : 'unsynced',
        songId: matched ? matched.id : null,
        durationFormatted: matched ? matched.durationFormatted : null,
        hasTimestamps: matched ? matched.hasTimestamps : false
      });
    });
  });

  // Ensure any library song not in tracker text files is added to its era so 100% of library songs are tracked
  songs.forEach((s, sIdx) => {
    if (!matchedSongIds.has(s.id)) {
      matchedSongIds.add(s.id);
      trackerSongs.push({
        id: `trk-lib-${s.era.toLowerCase()}-${sIdx}`,
        era: s.era,
        eraName: s.eraName,
        eraColor: s.eraColor,
        title: s.title,
        notes: 'Included from Library',
        aliases: s.aliases || [],
        status: 'synced',
        songId: s.id,
        durationFormatted: s.durationFormatted,
        hasTimestamps: s.hasTimestamps
      });
    }
  });

  // Calculate Tracker Statistics
  const totalTracked = trackerSongs.length;
  const syncedCount = trackerSongs.filter(t => t.status === 'synced').length;
  const unsyncedCount = totalTracked - syncedCount;
  const overallPercentage = totalTracked > 0 ? ((syncedCount / totalTracked) * 100).toFixed(1) : '0.0';

  const eraBreakdown = {};
  trackerEras.forEach(eCode => {
    const eraTracks = trackerSongs.filter(t => t.era === eCode);
    const eraSynced = eraTracks.filter(t => t.status === 'synced').length;
    const eraPct = eraTracks.length > 0 ? ((eraSynced / eraTracks.length) * 100).toFixed(1) : '0.0';
    eraBreakdown[eCode] = {
      code: eCode,
      name: (ERA_LABELS[eCode] || {}).name || eCode,
      color: (ERA_LABELS[eCode] || {}).color || '#6366f1',
      total: eraTracks.length,
      synced: eraSynced,
      unsynced: eraTracks.length - eraSynced,
      percentage: eraPct
    };
  });

  const trackerStats = {
    totalTracked,
    syncedCount,
    unsyncedCount,
    overallPercentage,
    eraBreakdown
  };

  // Sort eras
  const eraOrder = ['DRFL', 'OUT', 'GBGR', 'WOD', 'JW3'];
  const sortedEras = Object.values(eraMap).sort((a, b) => {
    const idxA = eraOrder.indexOf(a.code);
    const idxB = eraOrder.indexOf(b.code);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.code.localeCompare(b.code);
  });

  return {
    eras: sortedEras,
    songs: songs.sort((a, b) => a.title.localeCompare(b.title)),
    totalSongs: songs.length,
    tracker: trackerSongs,
    trackerStats,
    donations: donationsData,
    aliases: aliasesMap,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  ERA_LABELS,
  normalizeTitle,
  parseTimestamp,
  formatDuration,
  parseLyricsText,
  parseLyricsFile,
  isBulkLyricsContent,
  parseBulkLyricsContent,
  scanWorkspace
};
