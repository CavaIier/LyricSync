const fs = require('fs');
const path = require('path');

/**
 * Decodes string from buffer according to ID3 text encoding byte
 */
function decodeTextFrame(buf) {
  if (!buf || buf.length < 1) return '';
  const encoding = buf[0];
  const data = buf.subarray(1);

  try {
    if (encoding === 0) {
      // ISO-8859-1
      return data.toString('latin1').replace(/\0+$/, '').trim();
    } else if (encoding === 1) {
      // UTF-16 with BOM
      if (data.length < 2) return '';
      const bom = (data[0] << 8) | data[1];
      if (bom === 0xFEFF) {
        // UTF-16BE
        return data.subarray(2).swap16().toString('utf16le').replace(/\0+$/, '').trim();
      } else if (bom === 0xFFFE) {
        // UTF-16LE
        return data.subarray(2).toString('utf16le').replace(/\0+$/, '').trim();
      }
      return data.toString('utf16le').replace(/\0+$/, '').trim();
    } else if (encoding === 2) {
      // UTF-16BE without BOM
      const copy = Buffer.from(data);
      return copy.swap16().toString('utf16le').replace(/\0+$/, '').trim();
    } else if (encoding === 3) {
      // UTF-8
      return data.toString('utf-8').replace(/\0+$/, '').trim();
    }
    return data.toString('utf-8').replace(/\0+$/, '').trim();
  } catch (e) {
    return data.toString('latin1').replace(/\0+$/, '').trim();
  }
}

/**
 * Synchsafe integer conversion (7 bits per byte)
 */
function readSynchsafeInt(buf, offset = 0) {
  return (
    ((buf[offset] & 0x7F) << 21) |
    ((buf[offset + 1] & 0x7F) << 14) |
    ((buf[offset + 2] & 0x7F) << 7) |
    (buf[offset + 3] & 0x7F)
  );
}

/**
 * Parse ID3v2 tag (ID3v2.3 and ID3v2.4)
 */
function parseId3v2(fd, fileSize) {
  const headerBuf = Buffer.alloc(10);
  const bytesRead = fs.readSync(fd, headerBuf, 0, 10, 0);
  if (bytesRead < 10) return null;

  if (headerBuf[0] !== 0x49 || headerBuf[1] !== 0x44 || headerBuf[2] !== 0x33) {
    return null; // Not ID3
  }

  const versionMajor = headerBuf[3]; // 3 for v2.3, 4 for v2.4
  const flags = headerBuf[5];
  const tagSize = readSynchsafeInt(headerBuf, 6);

  if (tagSize <= 0 || tagSize > 10 * 1024 * 1024) return null; // Sanity check

  const tagBuf = Buffer.alloc(Math.min(tagSize, 512 * 1024)); // Read up to 512KB of tag
  const tagBytesRead = fs.readSync(fd, tagBuf, 0, tagBuf.length, 10);
  if (tagBytesRead <= 0) return null;

  let pos = 0;
  // Skip extended header if present
  if (flags & 0x40) {
    if (versionMajor === 4) {
      const extSize = readSynchsafeInt(tagBuf, pos);
      pos += extSize;
    } else if (versionMajor === 3) {
      const extSize = tagBuf.readUInt32BE(pos);
      pos += 4 + extSize;
    }
  }

  const tags = {};

  while (pos + 10 < tagBytesRead) {
    // Check for padding (null bytes)
    if (tagBuf[pos] === 0) break;

    const frameId = tagBuf.toString('ascii', pos, pos + 4);
    if (!/^[A-Z0-9]{4}$/.test(frameId)) break;

    let frameSize = 0;
    if (versionMajor === 4) {
      frameSize = readSynchsafeInt(tagBuf, pos + 4);
    } else {
      frameSize = tagBuf.readUInt32BE(pos + 4);
    }

    pos += 10;
    if (frameSize <= 0 || pos + frameSize > tagBytesRead) break;

    const frameData = tagBuf.subarray(pos, pos + frameSize);
    pos += frameSize;

    if (frameId.startsWith('T') && frameId !== 'TXXX') {
      const text = decodeTextFrame(frameData);
      if (text) {
        if (frameId === 'TIT2') tags.title = text;
        else if (frameId === 'TPE1') tags.artist = text;
        else if (frameId === 'TALB') tags.album = text;
        else if (frameId === 'TCON') tags.genre = text;
      }
    } else if (frameId === 'COMM') {
      // Comment frame: encoding (1 byte) + language (3 bytes) + short desc + full comment
      if (frameData.length > 4) {
        const text = decodeTextFrame(frameData.subarray(3));
        if (text && !tags.comment) tags.comment = text;
      }
    }
  }

  return Object.keys(tags).length > 0 ? tags : null;
}

/**
 * Parse ID3v1 tag (last 128 bytes of file)
 */
function parseId3v1(fd, fileSize) {
  if (fileSize < 128) return null;
  const buf = Buffer.alloc(128);
  fs.readSync(fd, buf, 0, 128, fileSize - 128);

  if (buf.toString('ascii', 0, 3) !== 'TAG') return null;

  const title = buf.toString('latin1', 3, 33).replace(/\0+$/, '').trim();
  const artist = buf.toString('latin1', 33, 63).replace(/\0+$/, '').trim();
  const album = buf.toString('latin1', 63, 93).replace(/\0+$/, '').trim();

  const res = {};
  if (title) res.title = title;
  if (artist) res.artist = artist;
  if (album) res.album = album;

  return Object.keys(res).length > 0 ? res : null;
}

/**
 * Parse FLAC Vorbis Comments
 */
function parseFlac(fd, fileSize) {
  const magic = Buffer.alloc(4);
  fs.readSync(fd, magic, 0, 4, 0);
  if (magic.toString('ascii') !== 'fLaC') return null;

  let offset = 4;
  const tags = {};

  while (offset + 4 < fileSize) {
    const blockHeader = Buffer.alloc(4);
    fs.readSync(fd, blockHeader, 0, 4, offset);
    offset += 4;

    const isLast = (blockHeader[0] & 0x80) !== 0;
    const blockType = blockHeader[0] & 0x7F;
    const blockLength = (blockHeader[1] << 16) | (blockHeader[2] << 8) | blockHeader[3];

    if (blockType === 4) {
      // VORBIS_COMMENT block
      const commentBuf = Buffer.alloc(Math.min(blockLength, 256 * 1024));
      fs.readSync(fd, commentBuf, 0, commentBuf.length, offset);

      let cPos = 0;
      if (cPos + 4 > commentBuf.length) break;
      const vendorLen = commentBuf.readUInt32LE(cPos);
      cPos += 4 + vendorLen;

      if (cPos + 4 <= commentBuf.length) {
        const userCount = commentBuf.readUInt32LE(cPos);
        cPos += 4;

        for (let i = 0; i < userCount && cPos + 4 <= commentBuf.length; i++) {
          const itemLen = commentBuf.readUInt32LE(cPos);
          cPos += 4;
          if (cPos + itemLen > commentBuf.length) break;

          const itemStr = commentBuf.toString('utf-8', cPos, cPos + itemLen);
          cPos += itemLen;

          const eqIdx = itemStr.indexOf('=');
          if (eqIdx !== -1) {
            const key = itemStr.substring(0, eqIdx).trim().toUpperCase();
            const val = itemStr.substring(eqIdx + 1).trim();
            if (key === 'TITLE' && !tags.title) tags.title = val;
            if (key === 'ARTIST' && !tags.artist) tags.artist = val;
            if (key === 'ALBUM' && !tags.album) tags.album = val;
          }
        }
      }
      return Object.keys(tags).length > 0 ? tags : null;
    }

    offset += blockLength;
    if (isLast) break;
  }

  return null;
}

/**
 * Parse M4A atoms for metadata
 */
function parseM4a(fd, fileSize) {
  // Read first 256KB to look for ilst atom
  const readSize = Math.min(fileSize, 256 * 1024);
  const buf = Buffer.alloc(readSize);
  fs.readSync(fd, buf, 0, readSize, 0);

  const tags = {};
  const ilstIndex = buf.indexOf(Buffer.from('ilst'));
  if (ilstIndex === -1) return null;

  let pos = ilstIndex + 4;
  const limit = Math.min(pos + 64 * 1024, readSize);

  while (pos + 8 < limit) {
    const atomSize = buf.readUInt32BE(pos);
    const atomType = buf.toString('latin1', pos + 4, pos + 8);
    if (atomSize <= 0 || pos + atomSize > limit) break;

    // Inside item atom, look for 'data' child atom
    const dataIndex = buf.indexOf(Buffer.from('data'), pos);
    if (dataIndex !== -1 && dataIndex < pos + atomSize) {
      const dataSize = buf.readUInt32BE(dataIndex - 4);
      // 'data' has 4 bytes size, 4 bytes 'data', 4 bytes flags/type, 4 bytes locale = 16 bytes header
      const dataContentPos = dataIndex + 12;
      const dataLen = dataSize - 16;
      if (dataLen > 0 && dataContentPos + dataLen <= limit) {
        const text = buf.toString('utf-8', dataContentPos, dataContentPos + dataLen).trim();
        if (text) {
          if (atomType === '©nam' && !tags.title) tags.title = text;
          if (atomType === '©ART' && !tags.artist) tags.artist = text;
          if (atomType === '©alb' && !tags.album) tags.album = text;
        }
      }
    }

    pos += atomSize;
  }

  return Object.keys(tags).length > 0 ? tags : null;
}

/**
 * Read metadata from an audio file (.mp3, .flac, .m4a, .wav)
 * @param {string} filePath - Absolute path to audio file
 * @returns {object|null} - { title, artist, album, comment } or null
 */
function readAudioTags(filePath) {
  let fd = null;
  try {
    const ext = path.extname(filePath).toLowerCase();
    const stats = fs.statSync(filePath);
    if (!stats.isFile() || stats.size === 0) return null;

    fd = fs.openSync(filePath, 'r');

    if (ext === '.mp3') {
      const id3v2 = parseId3v2(fd, stats.size);
      if (id3v2 && id3v2.title) return id3v2;
      const id3v1 = parseId3v1(fd, stats.size);
      if (id3v1 && id3v1.title) return Object.assign({}, id3v1, id3v2);
      return id3v2 || id3v1;
    } else if (ext === '.flac') {
      return parseFlac(fd, stats.size);
    } else if (ext === '.m4a' || ext === '.mp4') {
      return parseM4a(fd, stats.size);
    }

    return null;
  } catch (err) {
    return null;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch (e) {}
    }
  }
}

module.exports = {
  readAudioTags,
  parseId3v2,
  parseId3v1,
  parseFlac,
  parseM4a
};
