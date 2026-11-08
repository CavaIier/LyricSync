const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const parser = require('./lib/parser');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.lrc': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

// Cache parsed data, refreshable
let cachedData = null;
let lastScanTime = 0;

function getData(forceRefresh = false) {
  const now = Date.now();
  // Cache for 10 seconds unless forced
  if (!cachedData || forceRefresh || (now - lastScanTime > 10000)) {
    cachedData = parser.scanWorkspace(__dirname);
    lastScanTime = now;
  }
  return cachedData;
}

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(reqUrl.pathname);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Endpoints
  if (pathname.startsWith('/api/')) {
    // GET /api/songs
    if (pathname === '/api/songs') {
      const data = getData(reqUrl.searchParams.get('refresh') === 'true');
      const summaries = data.songs.map(s => ({
        id: s.id,
        era: s.era,
        eraName: s.eraName,
        eraBadge: s.eraBadge,
        eraColor: s.eraColor,
        filename: s.filename,
        rawName: s.rawName,
        title: s.title,
        artist: s.artist,
        hasTimestamps: s.hasTimestamps,
        durationSec: s.durationSec,
        durationFormatted: s.durationFormatted,
        lineCount: s.lineCount
      }));

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        eras: data.eras,
        songs: summaries,
        totalSongs: data.totalSongs,
        timestamp: data.timestamp
      }));
      return;
    }

    // GET /api/song/:id
    if (pathname.startsWith('/api/song/')) {
      const songId = pathname.replace('/api/song/', '').trim();
      const data = getData();
      const song = data.songs.find(s => s.id === songId || s.id.endsWith(songId));

      if (!song) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Song not found' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(song));
      return;
    }

    // GET /api/download/:id
    if (pathname.startsWith('/api/download/')) {
      const songId = pathname.replace('/api/download/', '').trim();
      const format = (reqUrl.searchParams.get('format') || 'lrc').toLowerCase();
      const data = getData();
      const song = data.songs.find(s => s.id === songId || s.id.endsWith(songId));

      if (!song) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Song not found' }));
        return;
      }

      let content = '';
      let ext = 'lrc';
      let mime = 'text/plain; charset=utf-8';

      if (format === 'txt') {
        content = song.plainText;
        ext = 'txt';
      } else {
        content = song.lrcContent;
        ext = 'lrc';
      }

      const safeFilename = `${song.artist} - ${song.title}.${ext}`.replace(/[\\/:*?"<>|]/g, '_');
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(safeFilename)}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`
      });
      res.end(content);
      return;
    }

    // Unknown API route
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
    return;
  }

  // Serve static files from public/
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, pathname);

  // Security check: ensure within public directory
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // If file not found and doesn't have an extension, fall back to index.html (SPA routing)
      if (!path.extname(pathname)) {
        const indexPath = path.join(PUBLIC_DIR, 'index.html');
        fs.readFile(indexPath, (err2, content) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

function startServer(port) {
  server.listen(port, () => {
    console.log(`\n=================================================`);
    console.log(`  🎵 LyricSync - Juice WRLD Lyrics Engine`);
    console.log(`=================================================`);
    console.log(`  Local URL:   http://localhost:${port}`);
    console.log(`  Network:     http://127.0.0.1:${port}`);
    console.log(`  Loaded eras: DRFL & OUT (${getData().totalSongs} total songs)`);
    console.log(`=================================================\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(PORT);
