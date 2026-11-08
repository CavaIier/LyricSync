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
  JW3: {
    name: 'Juice WRLD 3',
    badge: 'JW3',
    color: '#ec4899',
    gradient: 'from-pink-500 to-rose-600',
    description: 'Juice WRLD Era 3'
  },
  WOD: {
    name: 'Wrld On Drugs',
    badge: 'WOD',
    color: '#10b981',
    gradient: 'from-emerald-500 to-teal-600',
    description: 'Wrld On Drugs with Future (2018)'
  }
};

const EXCLUDED_DIRS = new Set([
  'node_modules',
  'public',
  'scripts',
  'lib',
  'dist',
  '.git',
  '.gemini',
  '.vscode'
]);

/**
 * Parse an LRC timestamp tag into seconds and standard [mm:ss.xx]
 * Handles:
 * - [00:02.06] or [0:09.30] -> standard mm:ss.xx
 * - [0:15:50] or [1:16:50] -> mm:ss:cs (colon centiseconds)
 * - [00:00:03] or [00:01:01] -> hh:mm:ss
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

      // Check if hh:mm:ss (like [00:01:04])
      if (parts[0] === '00' && p1 < 60 && p2 < 60) {
        const totalSec = p1 * 60 + p2;
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        const formatted = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.00`;
        return { totalSec, formatted };
      } else {
        // mm:ss:cs (like [1:16:50])
        const msStr = (parts[2] || '00').padEnd(2, '0').slice(0, 2);
        const totalSec = p0 * 60 + p1 + p2 / 100;
        const formatted = `${String(p0).padStart(2, '0')}:${String(p1).padStart(2, '0')}.${msStr}`;
        return { totalSec, formatted };
      }
    } else if (parts.length === 2) {
      // mm:ss without milliseconds
      const min = parseInt(parts[0], 10) || 0;
      const sec = parseInt(parts[1], 10) || 0;
      const totalSec = min * 60 + sec;
      const formatted = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.00`;
      return { totalSec, formatted };
    }
  }
  return null;
}

/**
 * Format seconds to MM:SS display
 */
function formatDuration(totalSec) {
  if (!totalSec || isNaN(totalSec)) return '0:00';
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

/**
 * Parse a single lyrics file into structured lines, plain text, and clean LRC
 */
function parseLyricsFile(filePath, era) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const filename = path.basename(filePath);
  const rawBaseName = filename.replace(/\.(txt|lrc)$/i, '').trim();

  // Parse artist and title from filename
  // Examples:
  // "Juice WRLD - Rental.txt" -> Artist: Juice WRLD, Title: Rental
  // "Juice WRLD & Trippie Redd - Both Sides (with Trippie Redd).txt"
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
    // Strip language code prefix (e.g. eng||)
    let line = rawLine.replace(/^[a-z]{2,3}\|\|/i, '').trim();
    if (!line) {
      // Empty line / stanza break
      plainTextLines.push('');
      return;
    }

    // Check for ID tags like [ar:...], [ti:...]
    const idTagMatch = line.match(/^\[(ar|ti|al|by|offset):([^\]]*)\]/i);
    if (idTagMatch) {
      const key = idTagMatch[1].toLowerCase();
      const val = idTagMatch[2].trim();
      if (key === 'ar' && val) metadataArtist = val;
      if (key === 'ti' && val) metadataTitle = val;
      return;
    }

    // Check for timestamp tag: [00:00.00] or [0:00:00]
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
        if (text) {
          plainTextLines.push(text);
        } else {
          plainTextLines.push('');
        }
        return;
      }
    }

    // Non-timestamped lyric line
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

  // Prepare standard LRC header
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

  // Slug id
  const id = `${era.toLowerCase()}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

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
 * Scan workspace to find all era folders and songs
 */
function scanWorkspace(baseDir = process.cwd()) {
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
          const songData = parseLyricsFile(filePath, eraCode);
          songs.push(songData);
        });
      }
    }
  }

  // Sort eras so DRFL and OUT come in logical order
  const eraOrder = ['DRFL', 'OUT', 'GBGR', 'JW3', 'WOD'];
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
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  ERA_LABELS,
  parseTimestamp,
  formatDuration,
  parseLyricsFile,
  scanWorkspace
};
