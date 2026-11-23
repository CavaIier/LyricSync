const { normalizeTitle } = require('./parser');

// Patterns for version tokens
const VERSION_REGEX = /^(v\d+(\.\d+)?|version\s*\d+|v\d+[a-z]?|v\s*\d+)$/i;

// Patterns for featured artists
const FEATURE_REGEX = /^(feat\.?|ft\.?|featuring|with)\s+(.+)$/i;

// Patterns for producers
const PRODUCER_REGEX = /^(prod\.?|produced\s+by)\s+(.+)$/i;

// Patterns for non-alias audio/mix descriptors
const DESCRIPTOR_REGEX = /^(og|hq|lq|cdq|snippet|session|studio\s*session|demo|stem|stems|instrumental|acapella|remix|slowed|speed\s*up|reverb|shortened|extended|clean|explicit|unreleased|leak|master|mix\s*\d*|interlude|intro|outro|live|acoustic|radio\s*edit)$/i;

// Generic filename patterns (e.g. "01", "01 Track", "Track 01", "Audio_1", "1284920", etc.)
const GENERIC_FILENAME_REGEX = /^(\d+|track[\s._-]*\d+|\d+[\s._-]*track|audio[\s._-]*\d+|\d+[\s._-]*audio|untitled|juice[\s._-]*unreleased|unreleased|unknown|song[\s._-]*\d*|\d+[\s._-]*song)$/i;

/**
 * Checks if a filename (without extension) is generic
 */
function isGenericFilename(rawName) {
  if (!rawName) return true;
  let clean = rawName.trim().replace(/^juice\s+wrld\s*[-_]?\s*/i, '');
  // Remove brackets for generic check
  clean = clean.replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '').trim();
  if (!clean || clean.length <= 1) return true;
  return GENERIC_FILENAME_REGEX.test(clean) || /^\d+$/.test(clean) || /^\d+[\s._-]+[a-z0-9]{0,4}$/i.test(clean);
}

/**
 * Clean a string from artist prefix and leading track numbers
 */
function stripArtistAndTrackNumber(str) {
  if (!str) return '';
  return str
    // Remove artist prefix
    .replace(/^juice\s+wrld\s*[-&]?\s*/i, '')
    .replace(/^juice\s+wrld\s+&\s+[^-\n\r]+-\s*/i, '')
    // Remove leading track number e.g. "01 - ", "01. ", "01 ", "1-01 - "
    .replace(/^(\d{1,2}[-_]\d{1,2}|\d{1,3})[\s._-]+/, '')
    .trim();
}

/**
 * Parse tokens inside parentheses or brackets in a title string
 */
function parseTitleTokens(rawStr) {
  if (!rawStr) {
    return { baseTitle: '', nicknames: [], versions: [], features: [], descriptors: [] };
  }

  let working = stripArtistAndTrackNumber(rawStr);

  const nicknames = [];
  const versions = [];
  const features = [];
  const descriptors = [];

  // Find all (bracketed) or [bracketed] segments
  const tokenRegex = /[\(\[\{]([^\)\]\}]+)[\)\]\}]/g;
  let match;
  const tokens = [];

  while ((match = tokenRegex.exec(working)) !== null) {
    tokens.push({
      full: match[0],
      content: match[1].trim()
    });
  }

  // Remove the brackets from working string to find base title
  let baseTitle = working.replace(/[\(\[\{][^\)\]\}]+[\)\]\}]/g, '').trim();
  // Remove trailing/leading hyphens or punctuation
  baseTitle = baseTitle.replace(/^[-_\s\.,]+|[-_\s\.,]+$/g, '').trim();

  tokens.forEach(tok => {
    let text = tok.content.trim();
    if (!text) return;

    // 1. Check aka prefix e.g. "aka Cha-Ching"
    const akaMatch = text.match(/^aka\s+(.+)$/i);
    if (akaMatch) {
      text = akaMatch[1].trim();
      if (text && !nicknames.includes(text)) nicknames.push(text);
      return;
    }

    // 2. Check version e.g. "v1", "version 2"
    if (VERSION_REGEX.test(text)) {
      versions.push(text.toLowerCase().replace(/\s+/, ''));
      return;
    }

    // 3. Check feature e.g. "feat. Young Thug", "with Trippie Redd"
    const featMatch = text.match(FEATURE_REGEX);
    if (featMatch) {
      features.push(featMatch[2].trim());
      return;
    }

    // 4. Check producer
    const prodMatch = text.match(PRODUCER_REGEX);
    if (prodMatch) {
      return;
    }

    // 5. Check audio/mix descriptors
    if (DESCRIPTOR_REGEX.test(text)) {
      descriptors.push(text);
      return;
    }

    // 6. Check if multiple nicknames are separated by slash or comma e.g. "Cha-Ching / Cha Ching"
    if (/[,;\/]/.test(text)) {
      const parts = text.split(/[,;\/]/).map(p => p.trim()).filter(Boolean);
      parts.forEach(p => {
        if (!VERSION_REGEX.test(p) && !DESCRIPTOR_REGEX.test(p) && p.length > 1) {
          if (!nicknames.includes(p)) nicknames.push(p);
        }
      });
      return;
    }

    // 7. Otherwise, genuine nickname / alternate title
    if (text.length > 1 && !nicknames.includes(text)) {
      nicknames.push(text);
    }
  });

  // Filter out any nickname that is identical to the base title
  const normBase = normalizeTitle(baseTitle);
  const filteredNicknames = nicknames.filter(n => {
    const normN = normalizeTitle(n);
    return normN && normN !== normBase;
  });

  return {
    baseTitle,
    nicknames: filteredNicknames,
    versions,
    features,
    descriptors
  };
}

/**
 * Extract clean song metadata and nicknames by analyzing both filename and audio ID3 tags
 * @param {string} filename - Filename with or without extension
 * @param {object|null} tags - Audio tags from readAudioTags()
 * @returns {object} - Analyzed song information
 */
function extractSongAliases(filename, tags = null) {
  const fileBaseName = filename.replace(/\.(mp3|flac|m4a|mp4|wav|txt|lrc)$/i, '').trim();
  const fileGeneric = isGenericFilename(fileBaseName);

  let tagTitle = tags && tags.title ? tags.title.trim() : '';
  let tagArtist = tags && tags.artist ? tags.artist.trim() : 'Juice WRLD';
  let tagAlbum = tags && tags.album ? tags.album.trim() : '';

  // Parse filename tokens
  const fileParsed = parseTitleTokens(fileBaseName);

  // Parse tag title tokens if available
  const tagParsed = tagTitle ? parseTitleTokens(tagTitle) : null;

  let baseTitle = '';
  let chosenSource = 'filename';

  if (fileGeneric && tagParsed && tagParsed.baseTitle) {
    baseTitle = tagParsed.baseTitle;
    chosenSource = 'id3';
  } else if (fileParsed.baseTitle && !isGenericFilename(fileParsed.baseTitle)) {
    baseTitle = fileParsed.baseTitle;
    chosenSource = 'filename';
  } else if (tagParsed && tagParsed.baseTitle) {
    baseTitle = tagParsed.baseTitle;
    chosenSource = 'id3';
  } else {
    baseTitle = fileBaseName;
  }

  // Combine nicknames discovered from both filename and ID3 tags
  const combinedNicknames = [];
  const addNickname = (nick) => {
    if (!nick) return;
    const clean = nick.trim();
    if (!clean || clean.length < 2) return;
    const normN = normalizeTitle(clean);
    const normB = normalizeTitle(baseTitle);
    if (!normN || normN === normB) return;

    const exists = combinedNicknames.some(existing => existing.toLowerCase() === clean.toLowerCase());
    if (!exists) {
      combinedNicknames.push(clean);
    }
  };

  fileParsed.nicknames.forEach(addNickname);
  if (tagParsed) {
    tagParsed.nicknames.forEach(addNickname);
  }

  // Also check ID3 comment for aka / alias
  if (tags && tags.comment) {
    const commentMatch = tags.comment.match(/(?:aka|alias)[:\s]+([^\r\n]+)/i);
    if (commentMatch) {
      commentMatch[1].split(/[,;\/]/).map(a => a.trim()).filter(Boolean).forEach(addNickname);
    }
  }

  // Detect Era from Album tag if available
  let detectedEra = null;
  const albumLower = tagAlbum.toLowerCase();
  if (albumLower.includes('death race') || albumLower.includes('drfl')) {
    detectedEra = 'DRFL';
  } else if (albumLower.includes('outsider') || albumLower.includes('out')) {
    detectedEra = 'OUT';
  } else if (albumLower.includes('goodbye') || albumLower.includes('gbgr')) {
    detectedEra = 'GBGR';
  } else if (albumLower.includes('wrld on drugs') || albumLower.includes('wod')) {
    detectedEra = 'WOD';
  }

  const versions = Array.from(new Set([...fileParsed.versions, ...(tagParsed ? tagParsed.versions : [])]));
  const features = Array.from(new Set([...fileParsed.features, ...(tagParsed ? tagParsed.features : [])]));

  return {
    rawFilename: filename,
    source: chosenSource,
    baseTitle,
    artist: tagArtist || 'Juice WRLD',
    nicknames: combinedNicknames,
    versions,
    features,
    detectedEra,
    isGenericFilename: fileGeneric
  };
}

module.exports = {
  isGenericFilename,
  stripArtistAndTrackNumber,
  parseTitleTokens,
  extractSongAliases,
  VERSION_REGEX,
  FEATURE_REGEX,
  DESCRIPTOR_REGEX
};
