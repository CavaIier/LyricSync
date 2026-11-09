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
 * Parse a lyrics file into structured lines, plain text, and clean LRC
 */
function parseLyricsFile(filePath, era, aliasesMap = {}, newSongIds = new Set()) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const filename = path.basename(filePath);
  const rawBaseName = filename.replace(/\.(txt|lrc)$/i, '').trim();

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

    const idTagMatch = line.match(/^\[(ar|ti|al|by|offset):([^\]]*)\]/i);
    if (idTagMatch) {
      const key = idTagMatch[1].toLowerCase();
      const val = idTagMatch[2].trim();
      if (key === 'ar' && val) metadataArtist = val;
      if (key === 'ti' && val) metadataTitle = val;
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
  const aliases = [];
  const normT = normalizeTitle(title);
  if (aliasesMap[title]) aliases.push(...aliasesMap[title]);
  Object.entries(aliasesMap).forEach(([k, list]) => {
    if (normalizeTitle(k) === normT) {
      list.forEach(a => { if (!aliases.includes(a)) aliases.push(a); });
    }
  });

  const isNew = newSongIds.has(id);

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
    isNew,
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
 * Scan workspace and compile tracker, donations, updates, and aliases
 */
function scanWorkspace(baseDir = process.cwd()) {
  const dataDir = path.join(baseDir, 'data');
  const trackerDir = path.join(dataDir, 'tracker');

  // Load aliases
  let aliasesMap = {};
  const aliasesFile = path.join(dataDir, 'aliases.json');
  if (fs.existsSync(aliasesFile)) {
    try {
      aliasesMap = JSON.parse(fs.readFileSync(aliasesFile, 'utf-8'));
    } catch (e) {
      console.warn('Could not parse aliases.json:', e.message);
    }
  }

  // Load updates
  let updatesData = { latestUpdateDate: new Date().toISOString(), newSongIds: [], changelog: [] };
  const updatesFile = path.join(dataDir, 'updates.json');
  if (fs.existsSync(updatesFile)) {
    try {
      updatesData = JSON.parse(fs.readFileSync(updatesFile, 'utf-8'));
    } catch (e) {
      console.warn('Could not parse updates.json:', e.message);
    }
  }
  const newSongIds = new Set(updatesData.newSongIds || []);

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
      const files = fs.readdirSync(eraDir).filter(f => f.endsWith('.txt') || f.endsWith('.lrc'));

      if (files.length > 0) {
        const eraCode = entry.name;
        const eraMeta = ERA_LABELS[eraCode] || {
          name: `${eraCode} Era`,
          badge: eraCode,
          color: '#6366f1',
          gradient: 'from-indigo-600 to-purple-600',
          description: `${eraCode} Era`
        };

        eraMap[eraCode] = {
          code: eraCode,
          name: eraMeta.name,
          badge: eraMeta.badge,
          color: eraMeta.color,
          gradient: eraMeta.gradient,
          description: eraMeta.description,
          count: files.length
        };

        files.sort().forEach(file => {
          const filePath = path.join(eraDir, file);
          const songData = parseLyricsFile(filePath, eraCode, aliasesMap, newSongIds);
          songs.push(songData);
        });
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
      const eraMeta = ERA_LABELS[eraCode] || { badge: eraCode, name: `${eraCode} Era`, color: '#6366f1' };

      // Find matched library song
      let matched = songs.find(s => {
        if (s.era !== eraCode) return false;
        const sNorm = normalizeTitle(s.title);
        if (sNorm === normT) return true;
        if (aliasNormMap.get(sNorm) === normT || aliasNormMap.get(normT) === sNorm) return true;
        return false;
      });

      // Cross-era fallback
      if (!matched) {
        matched = songs.find(s => {
          const sNorm = normalizeTitle(s.title);
          if (sNorm === normT) return true;
          if (aliasNormMap.get(sNorm) === normT || aliasNormMap.get(normT) === sNorm) return true;
          return false;
        });
      }

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

  // Ensure any library song not in tracker text files is added so 100% of library songs are tracked
  songs.forEach((s, sIdx) => {
    if (!matchedSongIds.has(s.id)) {
      matchedSongIds.add(s.id);
      trackerSongs.unshift({
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
    updates: updatesData,
    aliases: aliasesMap,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  ERA_LABELS,
  normalizeTitle,
  parseTimestamp,
  formatDuration,
  parseLyricsFile,
  scanWorkspace
};
