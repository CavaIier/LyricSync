const http = require('http');
const fs = require('fs');
const path = require('path');
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
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
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

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      if (!path.extname(pathname)) {
        const indexPath = path.join(PUBLIC_DIR, 'index.html');
        fs.readFile(indexPath, (err2, content) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(content);
          }
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n===========================================`);
    console.log(`🎵 LyricSync Server is running!`);
    console.log(`🚀 URL: http://localhost:${PORT}`);
    console.log(`📁 Static files served from: ${PUBLIC_DIR}`);
    console.log(`💡 Press Ctrl+C to stop.`);
    console.log(`===========================================\n`);
  });
}

module.exports = { server, getData };
