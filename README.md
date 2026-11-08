# 🎵 LyricSync — Juice WRLD Synced Lyrics & LRC Archive

A modern, high-performance web application designed for searching, viewing, copying, and downloading time-synchronized (`.lrc`) and plain text lyrics for Juice WRLD tracks across different eras (**Death Race For Love** and **The Outsiders**).

![LyricSync](public/favicon.ico)

---

## ⚡ Quick Start

### Option 1: Double-Click (Windows)
Double-click **`start.bat`**. It will start the local server and automatically open your default browser to `http://localhost:3000`.

### Option 2: Terminal / Command Prompt
```bash
node server.js
```
or with npm:
```bash
npm start
```
Open **`http://localhost:3000`** in your browser.

---

## ✨ Features

- 🔍 **Real-Time Instant Search**: Fast, client-side filtering as you type by song title, features, or era. Press `/` anywhere to focus search.
- 🏷️ **Era Filtering**:
  - **DRFL**: Death Race For Love Era (30 tracks)
  - **OUT**: The Outsiders Era (85 tracks)
  - Automatic detection of any new era folders added to the workspace.
- 📋 **One-Click Copy**:
  - **Copy Clean Lyrics**: Copies plain text lyrics without timestamps or tags, ready to paste into notes, messages, or Genius.
  - **Copy .LRC**: Copies properly formatted, synchronized LRC lines with millisecond timestamps.
  - Quick copy buttons directly on song cards without opening the modal!
- 📥 **Instant Downloads**:
  - **Download .LRC**: Saves a standard `.lrc` file universally compatible with Spotify, Walkman, Poweramp, Musicolet, Foobar2000, etc.
  - **Download .TXT**: Plain text lyrics download.
- 🎤 **Interactive Karaoke & Sync Viewer**:
  - Click any timestamp to jump to that moment in the track.
  - **Live Auto-Scroll Simulation**: Simulated playback engine that highlights the current line and scrolls lyrics karaoke-style in real time.
  - **Load Audio File**: Select or drag & drop your own audio track (`.mp3`, `.wav`, `.flac`) to listen while lyrics scroll live in perfect sync!
- 🎛️ **View Modes**:
  - Grid View & Compact List View toggle.
  - Sort by Title (A-Z, Z-A), Era, or Duration.
- 🌐 **Deep Link / Direct URLs**:
  - Direct song URLs via hash (e.g. `http://localhost:3000/#drfl-rental`), making sharing specific song lyrics effortless.
- 🚀 **Zero External Dependencies**:
  - Runs natively on standard Node.js without needing any `npm install`!

---

## 📂 Folder Structure

```text
LyricSync/
├── DRFL/                         # Death Race For Love era song files (.txt / .lrc)
├── OUT/                          # The Outsiders era song files (.txt / .lrc)
├── lib/
│   └── parser.js                 # Universal LRC parser, timestamp normalizer, & folder scanner
├── public/
│   ├── index.html                # Semantic, responsive web interface
│   ├── styles.css                # Obsidian & neon glassmorphic design system
│   ├── app.js                    # Search engine, karaoke player, copy & download logic
│   └── songs-data.json           # Pre-compiled static database
├── scripts/
│   └── build-static.js           # Static build generator for GitHub Pages / Vercel
├── server.js                     # Zero-dependency Node.js HTTP & API server
├── package.json
├── start.bat                     # 1-click Windows launcher
└── README.md
```

---

## ➕ Adding New Songs or Eras

The server automatically scans all folders in real-time.

1. **Adding a song to an existing era**:
   - Simply drop a `.txt` or `.lrc` file into `DRFL/` or `OUT/`.
   - Name it in the format: `Juice WRLD - Song Title.txt`.
2. **Adding a new era**:
   - Create a new folder (e.g. `GBGR/` or `JW3/` or `WOD/`).
   - Place songs inside it.
   - The server and web UI will automatically detect the new era and add a dedicated filter tab!

---

## 🚀 Static Hosting (GitHub Pages, Vercel, Netlify)

To deploy as a static website without a Node.js server:
1. Run:
   ```bash
   node scripts/build-static.js
   ```
2. Deploy the `public/` folder (or repository root) to **GitHub Pages**, **Vercel**, **Netlify**, or **Cloudflare Pages**.
3. The frontend is built with auto-fallback: if the Node API is not present, it automatically loads `songs-data.json` and performs all copying, searching, and downloads entirely client-side!

---

## 🛠️ LRC Format Sanitation Details

Original lyric dumps often contain dirty database prefixes like `eng||[0:09.30]` or varied timestamp formats like `[00:00:03]` or `[0:15:50]` which break standard music players.

**LyricSync's parser automatically:**
1. Strips any `eng||` or language tags.
2. Normalizes all timestamps to standard RFC LRC format `[mm:ss.xx]`.
3. Adds proper metadata tags (`[ti:...]`, `[ar:Juice WRLD]`, `[al:...]`).
4. Strips timestamps cleanly when exporting or copying plain lyrics.
