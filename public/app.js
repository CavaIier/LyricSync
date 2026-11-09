/**
 * LyricSync — Modern Juice WRLD Synced Lyrics, Full Search & Master Tracker
 */

(function () {
  'use strict';

  // ==========================================================================
  // State
  // ==========================================================================
  let allSongs = [];
  let songsMap = new Map(); // id -> song full or summary
  let trackerSongs = [];
  let trackerStats = null;
  let donationsData = null;
  let updatesData = null;
  let aliasesMap = {};

  // User custom nicknames stored in browser localStorage: { [songId]: ['Nickname1', 'Nickname2'] }
  let userCustomNicknames = {};
  try {
    const saved = localStorage.getItem('lyricsync_custom_nicknames');
    if (saved) userCustomNicknames = JSON.parse(saved);
  } catch (e) {
    userCustomNicknames = {};
  }

  // View state: 'library' | 'tracker'
  let currentActiveView = 'library';

  // Library filters
  let currentFilterEra = 'ALL'; // 'ALL' | 'DRFL' | 'OUT' | 'NEW'
  let searchMode = 'titles'; // 'titles' | 'lyrics'
  let searchQuery = '';
  let currentSort = 'title-asc';
  let viewMode = localStorage.getItem('lyricsync_view') || 'grid';
  let activeFilteredSongs = [];

  // Tracker filters
  let trackerEraFilter = 'ALL';
  let trackerStatusFilter = 'ALL'; // 'ALL' | 'synced' | 'unsynced'
  let trackerSearchQuery = '';

  // Modal State
  let currentModalSong = null;
  let currentModalMode = 'synced'; // 'synced' | 'plain' | 'raw'
  let activeDonationCoinId = 'btc';

  // Audio / Playback Simulation State
  let isPlaying = false;
  let playbackTimer = null;
  let playbackCurrentTime = 0;
  let playbackDuration = 0;
  let usingLocalAudio = false;

  // ==========================================================================
  // DOM Elements
  // ==========================================================================
  // Navigation
  const tabLibraryBtn = document.getElementById('tabLibraryBtn');
  const tabTrackerBtn = document.getElementById('tabTrackerBtn');
  const librarySection = document.getElementById('librarySection');
  const trackerSection = document.getElementById('trackerSection');
  const brandHomeBtn = document.getElementById('brandHomeBtn');

  // Header Actions
  const headerUpdatesBtn = document.getElementById('headerUpdatesBtn');
  const headerDonateBtn = document.getElementById('headerDonateBtn');
  const footerDonateBtn = document.getElementById('footerDonateBtn');

  // Search & Library Controls
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const searchModePills = document.getElementById('searchModePills');
  const eraFilters = document.getElementById('eraFilters');
  const sortSelect = document.getElementById('sortSelect');
  const viewGridBtn = document.getElementById('viewGridBtn');
  const viewListBtn = document.getElementById('viewListBtn');
  const songsGrid = document.getElementById('songsGrid');
  const emptyState = document.getElementById('emptyState');
  const resetSearchBtn = document.getElementById('resetSearchBtn');
  const visibleCount = document.getElementById('visibleCount');
  const activeFilterDesc = document.getElementById('activeFilterDesc');

  // Badges & Counters
  const libraryTabBadge = document.getElementById('libraryTabBadge');
  const trackerTabBadge = document.getElementById('trackerTabBadge');
  const badgeAll = document.getElementById('badgeAll');
  const badgeDrfl = document.getElementById('badgeDrfl');
  const badgeOut = document.getElementById('badgeOut');
  const badgeNew = document.getElementById('badgeNew');

  // Tracker Elements
  const trackerProgressBar = document.getElementById('trackerProgressBar');
  const trackerPctBadge = document.getElementById('trackerPctBadge');
  const trackerSyncedNum = document.getElementById('trackerSyncedNum');
  const trackerTotalNum = document.getElementById('trackerTotalNum');
  const trackerSyncedDetail = document.getElementById('trackerSyncedDetail');
  const trackerUnsyncedDetail = document.getElementById('trackerUnsyncedDetail');

  const drflTrackerSynced = document.getElementById('drflTrackerSynced');
  const drflTrackerTotal = document.getElementById('drflTrackerTotal');
  const drflTrackerPct = document.getElementById('drflTrackerPct');
  const drflTrackerBar = document.getElementById('drflTrackerBar');

  const outTrackerSynced = document.getElementById('outTrackerSynced');
  const outTrackerTotal = document.getElementById('outTrackerTotal');
  const outTrackerPct = document.getElementById('outTrackerPct');
  const outTrackerBar = document.getElementById('outTrackerBar');

  const gbgrTrackerSynced = document.getElementById('gbgrTrackerSynced');
  const gbgrTrackerTotal = document.getElementById('gbgrTrackerTotal');
  const gbgrTrackerPct = document.getElementById('gbgrTrackerPct');
  const gbgrTrackerBar = document.getElementById('gbgrTrackerBar');

  const wodTrackerSynced = document.getElementById('wodTrackerSynced');
  const wodTrackerTotal = document.getElementById('wodTrackerTotal');
  const wodTrackerPct = document.getElementById('wodTrackerPct');
  const wodTrackerBar = document.getElementById('wodTrackerBar');

  const trackerSearchInput = document.getElementById('trackerSearchInput');
  const clearTrackerSearchBtn = document.getElementById('clearTrackerSearchBtn');
  const trackerEraPills = document.getElementById('trackerEraPills');
  const trackerStatusPills = document.getElementById('trackerStatusPills');
  const trackerVisibleCount = document.getElementById('trackerVisibleCount');
  const trackerListContainer = document.getElementById('trackerListContainer');

  const trkCountAll = document.getElementById('trkCountAll');
  const trkCountDrfl = document.getElementById('trkCountDrfl');
  const trkCountOut = document.getElementById('trkCountOut');
  const trkCountGbgr = document.getElementById('trkCountGbgr');
  const trkCountWod = document.getElementById('trkCountWod');
  const trkStatusSyncedCount = document.getElementById('trkStatusSyncedCount');
  const trkStatusUnsyncedCount = document.getElementById('trkStatusUnsyncedCount');

  // Lyrics Modal Elements
  const lyricsModal = document.getElementById('lyricsModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalSongTitle = document.getElementById('modalSongTitle');
  const modalSongArtist = document.getElementById('modalSongArtist');
  const modalEraBadge = document.getElementById('modalEraBadge');
  const modalDuration = document.getElementById('modalDuration');
  const modalLineCount = document.getElementById('modalLineCount');
  const modalNewBadge = document.getElementById('modalNewBadge');
  const modalAliasesBox = document.getElementById('modalAliasesBox');
  const modalAliasesList = document.getElementById('modalAliasesList');
  const addAliasBtn = document.getElementById('addAliasBtn');
  const modalLyricsBody = document.getElementById('modalLyricsBody');
  const copyPlainBtn = document.getElementById('copyPlainBtn');
  const copyLrcBtn = document.getElementById('copyLrcBtn');
  const downloadLrcBtn = document.getElementById('downloadLrcBtn');
  const downloadTxtBtn = document.getElementById('downloadTxtBtn');
  const prevSongBtn = document.getElementById('prevSongBtn');
  const nextSongBtn = document.getElementById('nextSongBtn');

  // Playback Controls
  const playPauseBtn = document.getElementById('playPauseBtn');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const currentTimeDisplay = document.getElementById('currentTimeDisplay');
  const totalTimeDisplay = document.getElementById('totalTimeDisplay');
  const playbackScrubber = document.getElementById('playbackScrubber');
  const localAudioInput = document.getElementById('localAudioInput');
  const audioPlayer = document.getElementById('audioPlayer');

  // Crypto Modal Elements
  const cryptoModal = document.getElementById('cryptoModal');
  const cryptoModalCloseBtn = document.getElementById('cryptoModalCloseBtn');
  const cryptoCoinTabs = document.getElementById('cryptoCoinTabs');
  const walletCoinName = document.getElementById('walletCoinName');
  const walletNetworkBadge = document.getElementById('walletNetworkBadge');
  const cryptoQrCode = document.getElementById('cryptoQrCode');
  const walletAddressText = document.getElementById('walletAddressText');
  const copyWalletAddressBtn = document.getElementById('copyWalletAddressBtn');

  // Updates Modal Elements
  const updatesModal = document.getElementById('updatesModal');
  const updatesModalCloseBtn = document.getElementById('updatesModalCloseBtn');
  const updatesModalTimeline = document.getElementById('updatesModalTimeline');

  // Alias Modal Elements
  const aliasModal = document.getElementById('aliasModal');
  const aliasModalCloseBtn = document.getElementById('aliasModalCloseBtn');
  const aliasSongTitleHeading = document.getElementById('aliasSongTitleHeading');
  const customNicknameInput = document.getElementById('customNicknameInput');
  const saveCustomNicknameBtn = document.getElementById('saveCustomNicknameBtn');
  const userCustomNicknamesList = document.getElementById('userCustomNicknamesList');
  const suggestGithubAliasBtn = document.getElementById('suggestGithubAliasBtn');

  // Toast Container
  const toastContainer = document.getElementById('toastContainer');

  // ==========================================================================
  // Zero-Dependency Pure JS QR Code SVG Generator
  // ==========================================================================
  const QRCode = (function () {
    const EXP = new Uint8Array(512);
    const LOG = new Uint8Array(256);
    for (let i = 0, x = 1; i < 255; i++) {
      EXP[i] = x;
      EXP[i + 255] = x;
      LOG[x] = i;
      x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
    }
    function gfMul(x, y) { return x === 0 || y === 0 ? 0 : EXP[LOG[x] + LOG[y]]; }
    function polyMul(p1, p2) {
      const res = new Uint8Array(p1.length + p2.length - 1);
      for (let i = 0; i < p1.length; i++) {
        for (let j = 0; j < p2.length; j++) res[i + j] ^= gfMul(p1[i], p2[j]);
      }
      return res;
    }
    function polyMod(dividend, divisor) {
      const result = new Uint8Array(dividend);
      for (let i = 0; i <= dividend.length - divisor.length; i++) {
        const coef = result[i];
        if (coef !== 0) {
          for (let j = 1; j < divisor.length; j++) result[i + j] ^= gfMul(divisor[j], coef);
        }
      }
      return result.slice(dividend.length - divisor.length + 1);
    }
    function rsGenPoly(n) {
      let poly = new Uint8Array([1]);
      for (let i = 0; i < n; i++) poly = polyMul(poly, new Uint8Array([1, EXP[i]]));
      return poly;
    }
    const VERSIONS = [
      null,
      { ver: 1, size: 21, total: 26, ec: 7, blocks: 1 },
      { ver: 2, size: 25, total: 44, ec: 10, blocks: 1 },
      { ver: 3, size: 29, total: 70, ec: 15, blocks: 1 },
      { ver: 4, size: 33, total: 100, ec: 20, blocks: 1 },
      { ver: 5, size: 37, total: 134, ec: 26, blocks: 1 },
      { ver: 6, size: 41, total: 172, ec: 18, blocks: 2 }
    ];
    function encodeText(text) {
      const data = [];
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code < 128) data.push(code);
        else data.push(...new TextEncoder().encode(text[i]));
      }
      let vInfo = null;
      for (let v = 1; v < VERSIONS.length; v++) {
        const cap = VERSIONS[v].total - VERSIONS[v].ec - 2;
        if (data.length <= cap) { vInfo = VERSIONS[v]; break; }
      }
      if (!vInfo) vInfo = VERSIONS[6];
      const dataCap = vInfo.total - vInfo.ec;
      const bits = [];
      bits.push(0, 1, 0, 0); // Byte mode
      const len = data.length;
      for (let i = 7; i >= 0; i--) bits.push((len >> i) & 1);
      for (const b of data) {
        for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
      }
      while (bits.length % 8 !== 0) bits.push(0);
      const maxBits = dataCap * 8;
      for (let i = 0; bits.length < maxBits && i < 4; i++) bits.push(0);
      while (bits.length % 8 !== 0) bits.push(0);
      const padBytes = [0xec, 0x11];
      let padIdx = 0;
      while (bits.length < maxBits) {
        const pb = padBytes[padIdx++ % 2];
        for (let i = 7; i >= 0; i--) bits.push((pb >> i) & 1);
      }
      const codewords = new Uint8Array(dataCap);
      for (let i = 0; i < dataCap; i++) {
        let byte = 0;
        for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i * 8 + j];
        codewords[i] = byte;
      }
      const ecLen = vInfo.ec / vInfo.blocks;
      const gen = rsGenPoly(ecLen);
      const ecData = polyMod(new Uint8Array([...codewords, ...new Uint8Array(ecLen)]), gen);

      const N = vInfo.size;
      const matrix = Array.from({ length: N }, () => new Int8Array(N));
      const reserved = Array.from({ length: N }, () => new Uint8Array(N));
      function setModule(r, c, val) {
        if (r >= 0 && r < N && c >= 0 && c < N) {
          matrix[r][c] = val ? 1 : 0;
          reserved[r][c] = 1;
        }
      }
      function addFinder(r, c) {
        for (let dr = -1; dr <= 7; dr++) {
          for (let dc = -1; dc <= 7; dc++) {
            const row = r + dr, col = c + dc;
            if (row < 0 || row >= N || col < 0 || col >= N) continue;
            if (dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6) {
              const border = dr === 0 || dr === 6 || dc === 0 || dc === 6;
              const center = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
              setModule(row, col, border || center);
            } else setModule(row, col, false);
          }
        }
      }
      addFinder(0, 0); addFinder(0, N - 7); addFinder(N - 7, 0);
      for (let i = 8; i < N - 8; i++) {
        if (!reserved[6][i]) setModule(6, i, i % 2 === 0);
        if (!reserved[i][6]) setModule(i, 6, i % 2 === 0);
      }
      setModule(4 * vInfo.ver + 9, 8, true);
      if (vInfo.ver >= 2) {
        const pos = [6, N - 7];
        for (const ar of pos) {
          for (const ac of pos) {
            if (reserved[ar][ac]) continue;
            for (let dr = -2; dr <= 2; dr++) {
              for (let dc = -2; dc <= 2; dc++) {
                const border = Math.abs(dr) === 2 || Math.abs(dc) === 2;
                setModule(ar + dr, ac + dc, border || (dr === 0 && dc === 0));
              }
            }
          }
        }
      }
      for (let i = 0; i < 9; i++) {
        if (i < N) reserved[8][i] = reserved[i][8] = 1;
      }
      for (let i = 0; i < 8; i++) {
        reserved[8][N - 1 - i] = reserved[N - 1 - i][8] = 1;
      }
      const allBytes = [...codewords, ...ecData];
      let byteIdx = 0, bitIdx = 7, up = true;
      for (let c = N - 1; c > 0; c -= 2) {
        if (c === 6) c--;
        const cols = [c, c - 1];
        const rows = up ? Array.from({ length: N }, (_, i) => N - 1 - i) : Array.from({ length: N }, (_, i) => i);
        for (const r of rows) {
          for (const col of cols) {
            if (!reserved[r][col]) {
              let val = 0;
              if (byteIdx < allBytes.length) {
                val = (allBytes[byteIdx] >> bitIdx) & 1;
                bitIdx--;
                if (bitIdx < 0) { bitIdx = 7; byteIdx++; }
              }
              if ((r + col) % 2 === 0) val ^= 1;
              matrix[r][col] = val;
            }
          }
        }
        up = !up;
      }
      const fmt = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
      const fc1 = [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
      const fc2 = [[N-1,8],[N-2,8],[N-3,8],[N-4,8],[N-5,8],[N-6,8],[N-7,8],[8,N-8],[8,N-7],[8,N-6],[8,N-5],[8,N-4],[8,N-3],[8,N-2],[8,N-1]];
      for (let i = 0; i < 15; i++) {
        matrix[fc1[i][0]][fc1[i][1]] = fmt[i];
        matrix[fc2[i][0]][fc2[i][1]] = fmt[i];
      }
      return matrix;
    }
    function toSVG(text, size = 160) {
      try {
        const matrix = encodeText(text);
        const n = matrix.length;
        const pad = 2;
        const total = n + pad * 2;
        const cellSize = size / total;
        let rects = '';
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            if (matrix[r][c] === 1) {
              const x = (c + pad) * cellSize;
              const y = (r + pad) * cellSize;
              rects += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="#000"/>`;
            }
          }
        }
        return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
          <rect width="${size}" height="${size}" fill="#fff"/>
          ${rects}
        </svg>`;
      } catch (e) {
        return `<div style="padding: 20px; font-size: 12px; color: #64748b;">(QR code unavailable)</div>`;
      }
    }
    return { toSVG };
  })();

  // ==========================================================================
  // Initialization & Data Loading
  // ==========================================================================
  async function init() {
    setupEventListeners();
    updateViewModeButtons();
    await loadData();
    handleHashNavigation();
  }

  async function loadData() {
    const isLocalServer = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocalServer) {
      try {
        const res = await fetch('/api/songs');
        if (res.ok) {
          const data = await res.json();
          processLoadedData(data);
          return;
        }
      } catch (e) {
        console.warn('Live API unavailable, trying static songs-data.json...');
      }
    }

    try {
      const res = await fetch('songs-data.json');
      if (res.ok) {
        const data = await res.json();
        processLoadedData(data);
        return;
      }
    } catch (e) {
      console.error('Failed to load songs data:', e);
      showToast('Error loading songs archive', 'error');
    }
  }

  function processLoadedData(data) {
    allSongs = data.songs || [];
    allSongs.forEach(s => songsMap.set(s.id, s));

    trackerSongs = data.tracker || [];
    trackerStats = data.trackerStats || null;
    donationsData = data.donations || null;
    updatesData = data.updates || null;
    aliasesMap = data.aliases || {};

    updateStats(data.eras, data.totalSongs);
    updateTrackerStatsDisplay();
    renderSongs();
    renderTracker();
  }

  function updateStats(eras, total) {
    if (libraryTabBadge) libraryTabBadge.textContent = total || allSongs.length;
    if (badgeAll) badgeAll.textContent = total || allSongs.length;

    let drfl = 0, out = 0, newCount = 0;
    allSongs.forEach(s => {
      if (s.era === 'DRFL') drfl++;
      if (s.era === 'OUT') out++;
      if (s.isNew) newCount++;
    });

    if (badgeDrfl) badgeDrfl.textContent = drfl;
    if (badgeOut) badgeOut.textContent = out;
    if (badgeNew) badgeNew.textContent = newCount;
  }

  function updateTrackerStatsDisplay() {
    if (!trackerStats) return;

    if (trackerTabBadge) trackerTabBadge.textContent = trackerStats.totalTracked.toLocaleString();
    if (trackerPctBadge) trackerPctBadge.textContent = `${trackerStats.overallPercentage}%`;
    if (trackerProgressBar) trackerProgressBar.style.width = `${trackerStats.overallPercentage}%`;
    if (trackerSyncedNum) trackerSyncedNum.textContent = trackerStats.syncedCount.toLocaleString();
    if (trackerTotalNum) trackerTotalNum.textContent = trackerStats.totalTracked.toLocaleString();
    if (trackerSyncedDetail) trackerSyncedDetail.textContent = trackerStats.syncedCount.toLocaleString();
    if (trackerUnsyncedDetail) trackerUnsyncedDetail.textContent = trackerStats.unsyncedCount.toLocaleString();

    // Era mini stats
    const eb = trackerStats.eraBreakdown || {};
    if (eb.DRFL) {
      if (drflTrackerSynced) drflTrackerSynced.textContent = eb.DRFL.synced;
      if (drflTrackerTotal) drflTrackerTotal.textContent = eb.DRFL.total;
      if (drflTrackerPct) drflTrackerPct.textContent = `${eb.DRFL.percentage}%`;
      if (drflTrackerBar) drflTrackerBar.style.width = `${eb.DRFL.percentage}%`;
      if (trkCountDrfl) trkCountDrfl.textContent = eb.DRFL.total;
    }
    if (eb.OUT) {
      if (outTrackerSynced) outTrackerSynced.textContent = eb.OUT.synced;
      if (outTrackerTotal) outTrackerTotal.textContent = eb.OUT.total;
      if (outTrackerPct) outTrackerPct.textContent = `${eb.OUT.percentage}%`;
      if (outTrackerBar) outTrackerBar.style.width = `${eb.OUT.percentage}%`;
      if (trkCountOut) trkCountOut.textContent = eb.OUT.total;
    }
    if (eb.GBGR) {
      if (gbgrTrackerSynced) gbgrTrackerSynced.textContent = eb.GBGR.synced;
      if (gbgrTrackerTotal) gbgrTrackerTotal.textContent = eb.GBGR.total;
      if (gbgrTrackerPct) gbgrTrackerPct.textContent = `${eb.GBGR.percentage}%`;
      if (gbgrTrackerBar) gbgrTrackerBar.style.width = `${eb.GBGR.percentage}%`;
      if (trkCountGbgr) trkCountGbgr.textContent = eb.GBGR.total;
    }
    if (eb.WOD) {
      if (wodTrackerSynced) wodTrackerSynced.textContent = eb.WOD.synced;
      if (wodTrackerTotal) wodTrackerTotal.textContent = eb.WOD.total;
      if (wodTrackerPct) wodTrackerPct.textContent = `${eb.WOD.percentage}%`;
      if (wodTrackerBar) wodTrackerBar.style.width = `${eb.WOD.percentage}%`;
      if (trkCountWod) trkCountWod.textContent = eb.WOD.total;
    }

    if (trkCountAll) trkCountAll.textContent = trackerStats.totalTracked.toLocaleString();
    if (trkStatusSyncedCount) trkStatusSyncedCount.textContent = trackerStats.syncedCount.toLocaleString();
    if (trkStatusUnsyncedCount) trkStatusUnsyncedCount.textContent = trackerStats.unsyncedCount.toLocaleString();
  }

  // ==========================================================================
  // View Switcher (Library vs Tracker)
  // ==========================================================================
  function switchView(target) {
    currentActiveView = target;
    if (target === 'tracker') {
      librarySection.style.display = 'none';
      trackerSection.style.display = 'block';
      tabLibraryBtn.classList.remove('active');
      tabTrackerBtn.classList.add('active');
      renderTracker();
    } else {
      trackerSection.style.display = 'none';
      librarySection.style.display = 'block';
      tabTrackerBtn.classList.remove('active');
      tabLibraryBtn.classList.add('active');
      renderSongs();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==========================================================================
  // Songs Library Search & Filter Engine
  // ==========================================================================
  function filterAndSortSongs() {
    let filtered = allSongs.slice();

    // 1. Era filter
    if (currentFilterEra === 'NEW') {
      filtered = filtered.filter(s => s.isNew);
    } else if (currentFilterEra !== 'ALL') {
      filtered = filtered.filter(s => s.era === currentFilterEra);
    }

    // 2. Search filter
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      if (searchMode === 'lyrics') {
        // Full Lyrics Deep Search
        const terms = query.split(/\s+/).filter(Boolean);
        const matching = [];

        filtered.forEach(song => {
          song._matchingSnippet = null;
          if (!song.lines || song.lines.length === 0) return;

          // Find first line that contains all or any search terms
          for (const lineObj of song.lines) {
            const lineText = lineObj.text || '';
            const lineLower = lineText.toLowerCase();
            const matchedAll = terms.every(t => lineLower.includes(t));

            if (matchedAll) {
              // Highlight matched words
              let highlighted = escapeHtml(lineText);
              terms.forEach(t => {
                const regex = new RegExp(`(${escapeRegex(t)})`, 'gi');
                highlighted = highlighted.replace(regex, '<mark>$1</mark>');
              });
              song._matchingSnippet = {
                text: highlighted,
                time: lineObj.displayTime || ''
              };
              matching.push(song);
              return;
            }
          }
        });
        filtered = matching;
      } else {
        // Titles, Features, & Aliases Search
        filtered = filtered.filter(s => {
          s._matchingSnippet = null;
          const title = s.title.toLowerCase();
          const artist = (s.artist || '').toLowerCase();
          const raw = (s.rawName || '').toLowerCase();

          // Check standard title & artist
          if (title.includes(query) || artist.includes(query) || raw.includes(query)) return true;

          // Check community aliases
          if (s.aliases && s.aliases.some(a => a.toLowerCase().includes(query))) return true;

          // Check user custom nicknames for this song
          const userNicks = userCustomNicknames[s.id] || [];
          if (userNicks.some(n => n.toLowerCase().includes(query))) return true;

          return false;
        });
      }
    } else {
      // Clear snippets when query is empty
      filtered.forEach(s => s._matchingSnippet = null);
    }

    // 3. Sorting
    filtered.sort((a, b) => {
      switch (currentSort) {
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        case 'era':
          return a.era.localeCompare(b.era) || a.title.localeCompare(b.title);
        case 'duration':
          return (b.durationSec || 0) - (a.durationSec || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }

  function renderSongs() {
    activeFilteredSongs = filterAndSortSongs();

    if (visibleCount) visibleCount.textContent = activeFilteredSongs.length;

    // Filter description
    let desc = '';
    if (currentFilterEra === 'NEW') desc = '• Showing Recently Added';
    else if (currentFilterEra !== 'ALL') desc = `• Filtered by ${currentFilterEra} Era`;
    if (searchQuery) desc += ` • Search: "${escapeHtml(searchQuery)}" (${searchMode === 'lyrics' ? 'Lyrics Mode' : 'Title Mode'})`;
    if (activeFilterDesc) activeFilterDesc.textContent = desc;

    if (activeFilteredSongs.length === 0) {
      songsGrid.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    const html = activeFilteredSongs.map(song => {
      const eraClass = song.era === 'DRFL' ? 'badge-drfl' : 'badge-out';
      const borderClass = song.era === 'DRFL' ? 'border-drfl' : 'border-out';
      const userNicks = userCustomNicknames[song.id] || [];
      const allAliases = [...(song.aliases || []), ...userNicks];

      // Aliases preview in card
      let aliasHtml = '';
      if (allAliases.length > 0) {
        const topAliases = allAliases.slice(0, 2);
        aliasHtml = `
          <div class="card-aliases">
            <span class="card-alias-label">aka:</span>
            ${topAliases.map(a => `<span class="card-alias-chip">${escapeHtml(a)}</span>`).join('')}
            ${allAliases.length > 2 ? `<span class="card-alias-label">+${allAliases.length - 2}</span>` : ''}
          </div>
        `;
      }

      // Lyric match preview snippet
      let snippetHtml = '';
      if (song._matchingSnippet) {
        snippetHtml = `
          <div class="lyric-snippet-match">
            <div class="snippet-label">Matched Lyric Line ${song._matchingSnippet.time ? `[${song._matchingSnippet.time}]` : ''}</div>
            <div class="snippet-text">"${song._matchingSnippet.text}"</div>
          </div>
        `;
      }

      return `
        <article class="song-card ${borderClass}" data-id="${song.id}">
          <div class="card-top">
            <span class="era-badge ${eraClass}">${escapeHtml(song.eraBadge || song.era)}</span>
            <div class="card-meta-right">
              ${song.hasTimestamps ? `
                <span class="sync-indicator" title="Synchronized LRC with timestamps">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                  LRC
                </span>
              ` : ''}
              <span>${song.durationFormatted || '0:00'}</span>
            </div>
          </div>

          <div class="card-body">
            <h3 class="song-title">
              <span>${escapeHtml(song.title)}</span>
              ${song.isNew ? `<span class="new-neon-badge">NEW</span>` : ''}
            </h3>
            <div class="song-artist">${escapeHtml(song.artist || 'Juice WRLD')}</div>
            ${aliasHtml}
            ${snippetHtml}
          </div>

          <div class="card-footer-stats">
            <span>${song.lineCount || 0} lines</span>
            <span>•</span>
            <span>${escapeHtml(song.eraName || song.era)}</span>
          </div>

          <div class="card-actions">
            <button class="card-btn card-btn-view" data-action="view" data-id="${song.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span>Play / View</span>
            </button>
            <button class="card-btn card-btn-copy" data-action="copy" data-id="${song.id}" title="Quick copy clean lyrics">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Copy</span>
            </button>
          </div>
        </article>
      `;
    }).join('');

    songsGrid.innerHTML = html;
  }

  // ==========================================================================
  // Community Song Tracker Engine
  // ==========================================================================
  function filterTrackerSongs() {
    let filtered = trackerSongs.slice();

    // 1. Era filter
    if (trackerEraFilter !== 'ALL') {
      filtered = filtered.filter(t => t.era === trackerEraFilter);
    }

    // 2. Status filter
    if (trackerStatusFilter !== 'ALL') {
      filtered = filtered.filter(t => t.status === trackerStatusFilter);
    }

    // 3. Search query
    const q = trackerSearchQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(t => {
        if (t.title.toLowerCase().includes(q)) return true;
        if (t.notes && t.notes.toLowerCase().includes(q)) return true;
        if (t.aliases && t.aliases.some(a => a.toLowerCase().includes(q))) return true;
        return false;
      });
    }

    return filtered;
  }

  function renderTracker() {
    const list = filterTrackerSongs();
    if (trackerVisibleCount) trackerVisibleCount.textContent = list.length.toLocaleString();

    if (list.length === 0) {
      trackerListContainer.innerHTML = `
        <div class="empty-state" style="padding: 40px 20px;">
          <div class="empty-icon">🔍</div>
          <h3>No tracked songs match this filter</h3>
          <p>Try switching eras or clearing your search query.</p>
        </div>
      `;
      return;
    }

    const html = list.map((item, idx) => {
      const isSynced = item.status === 'synced';
      const eraBadgeClass = `badge-${item.era.toLowerCase()}`;

      let aliasHtml = '';
      if (item.aliases && item.aliases.length > 0) {
        aliasHtml = `
          <span class="tracker-notes-tag" title="Alternative Title">aka ${escapeHtml(item.aliases.join(', '))}</span>
        `;
      }

      return `
        <div class="tracker-row-card ${isSynced ? 'is-synced' : 'is-unsynced'}">
          <div class="tracker-row-left">
            <span class="tracker-row-index">#${idx + 1}</span>
            <span class="era-badge ${eraBadgeClass}">${escapeHtml(item.era)}</span>
            <div class="tracker-row-title-box">
              <div class="tracker-song-title">${escapeHtml(item.title)}</div>
              <div class="tracker-song-meta">
                ${item.notes ? `<span class="tracker-notes-tag">${escapeHtml(item.notes)}</span>` : ''}
                ${aliasHtml}
                ${isSynced && item.durationFormatted ? `<span>Duration: ${item.durationFormatted}</span>` : ''}
              </div>
            </div>
          </div>

          <div class="tracker-row-right">
            <span class="status-badge ${isSynced ? 'badge-synced' : 'badge-unsynced'}">
              <span class="status-indicator-dot ${isSynced ? 'synced' : 'unsynced'}"></span>
              ${isSynced ? 'Synced' : 'Not Yet Synced'}
            </span>

            ${isSynced && item.songId ? `
              <button class="btn-tracker-play" data-songid="${item.songId}" title="Open karaoke lyrics player">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span>Play / View LRC</span>
              </button>
            ` : `
              <button class="btn-tracker-request" data-title="${encodeURIComponent(item.title)}" data-era="${item.era}" title="Suggest or submit lyrics on GitHub">
                <span>Request Sync</span>
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');

    trackerListContainer.innerHTML = html;
  }

  // ==========================================================================
  // Lyrics Modal Logic
  // ==========================================================================
  async function openSongModal(songId) {
    let song = songsMap.get(songId);

    // If song details aren't fully loaded, fetch them
    if (!song || !song.lines || !song.lrcContent) {
      try {
        const res = await fetch(`/api/song/${songId}`);
        if (res.ok) {
          song = await res.json();
          songsMap.set(song.id, song);
        }
      } catch (e) {
        console.warn('Could not fetch single song API, using cached object');
      }
    }

    if (!song) {
      showToast('Song not found in archive', 'error');
      return;
    }

    currentModalSong = song;
    window.location.hash = `song=${encodeURIComponent(song.id)}`;

    modalSongTitle.textContent = song.title;
    modalSongArtist.textContent = song.artist || 'Juice WRLD';
    modalEraBadge.textContent = song.eraBadge || song.era;
    modalEraBadge.className = `era-badge ${song.era === 'DRFL' ? 'badge-drfl' : 'badge-out'}`;
    modalDuration.textContent = song.durationFormatted || '0:00';
    modalLineCount.textContent = `${song.lineCount || 0} lines`;

    if (modalNewBadge) {
      modalNewBadge.style.display = song.isNew ? 'inline-block' : 'none';
    }

    renderModalAliases(song);

    // Reset player state
    stopPlayback();
    playbackDuration = song.durationSec || 0;
    totalTimeDisplay.textContent = song.durationFormatted || '0:00';
    currentTimeDisplay.textContent = '00:00';
    playbackScrubber.value = 0;

    renderModalLyricsContent();

    lyricsModal.classList.add('active');
    lyricsModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function renderModalAliases(song) {
    const userNicks = userCustomNicknames[song.id] || [];
    const communityAliases = song.aliases || [];

    if (communityAliases.length === 0 && userNicks.length === 0) {
      modalAliasesList.innerHTML = '<span style="color: var(--text-muted); font-size: 0.75rem;">None listed</span>';
      return;
    }

    let tagsHtml = '';
    communityAliases.forEach(a => {
      tagsHtml += `<span class="alias-tag" title="Official community alternate title">${escapeHtml(a)}</span>`;
    });
    userNicks.forEach(u => {
      tagsHtml += `<span class="alias-tag custom-tag" title="Your saved nickname">${escapeHtml(u)} ⭐</span>`;
    });

    modalAliasesList.innerHTML = tagsHtml;
  }

  function closeSongModal() {
    lyricsModal.classList.remove('active');
    lyricsModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    stopPlayback();
    currentModalSong = null;

    if (window.location.hash.startsWith('#song=')) {
      history.pushState('', document.title, window.location.pathname + window.location.search);
    }
  }

  function renderModalLyricsContent() {
    if (!currentModalSong) return;

    if (currentModalMode === 'synced') {
      const lines = currentModalSong.lines || [];
      if (lines.length === 0) {
        modalLyricsBody.innerHTML = `<div class="empty-state">No lyrics text available</div>`;
        return;
      }

      const html = lines.map((l, idx) => {
        const timeBadge = l.displayTime ? `<span class="lyric-time-chip">${l.displayTime}</span>` : '';
        const isEmpty = !l.text || l.text.trim().length === 0;
        return `
          <div class="lyric-line-row ${isEmpty ? 'stanza-break' : ''}" data-idx="${idx}" data-time="${l.seconds !== null ? l.seconds : ''}">
            ${timeBadge}
            <span class="lyric-text">${isEmpty ? '&nbsp;' : escapeHtml(l.text)}</span>
          </div>
        `;
      }).join('');

      modalLyricsBody.innerHTML = `<div class="lyrics-synced-container" id="syncedContainer">${html}</div>`;
      document.getElementById('playbackBar').style.display = 'block';
    } else if (currentModalMode === 'plain') {
      modalLyricsBody.innerHTML = `
        <div class="plain-lyrics-container">
          <pre class="plain-text-box">${escapeHtml(currentModalSong.plainText || '')}</pre>
        </div>
      `;
      document.getElementById('playbackBar').style.display = 'none';
    } else if (currentModalMode === 'raw') {
      modalLyricsBody.innerHTML = `
        <div class="raw-lrc-container">
          <pre class="raw-lrc-box">${escapeHtml(currentModalSong.lrcContent || '')}</pre>
        </div>
      `;
      document.getElementById('playbackBar').style.display = 'none';
    }
  }

  // ==========================================================================
  // Playback & Karaoke Scroller
  // ==========================================================================
  function togglePlayback() {
    if (isPlaying) pausePlayback();
    else startPlayback();
  }

  function startPlayback() {
    if (!currentModalSong) return;
    isPlaying = true;
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';

    if (usingLocalAudio && audioPlayer.src) {
      audioPlayer.play().catch(e => console.warn('Audio play blocked:', e));
    }

    const startTime = Date.now() - (playbackCurrentTime * 1000);

    playbackTimer = setInterval(() => {
      if (usingLocalAudio && !audioPlayer.paused) {
        playbackCurrentTime = audioPlayer.currentTime;
      } else {
        playbackCurrentTime = (Date.now() - startTime) / 1000;
      }

      if (playbackDuration > 0 && playbackCurrentTime >= playbackDuration) {
        stopPlayback();
        return;
      }

      updatePlaybackUI();
    }, 100);
  }

  function pausePlayback() {
    isPlaying = false;
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    if (playbackTimer) clearInterval(playbackTimer);
    if (usingLocalAudio && !audioPlayer.paused) audioPlayer.pause();
  }

  function stopPlayback() {
    pausePlayback();
    playbackCurrentTime = 0;
    updatePlaybackUI();
  }

  function seekTo(seconds) {
    playbackCurrentTime = Math.max(0, Math.min(seconds, playbackDuration || 300));
    if (usingLocalAudio) audioPlayer.currentTime = playbackCurrentTime;
    updatePlaybackUI();
    if (isPlaying) {
      pausePlayback();
      startPlayback();
    }
  }

  function updatePlaybackUI() {
    currentTimeDisplay.textContent = formatDuration(playbackCurrentTime);
    if (playbackDuration > 0) {
      playbackScrubber.value = (playbackCurrentTime / playbackDuration) * 100;
    }

    if (currentModalMode !== 'synced' || !currentModalSong) return;

    const lines = currentModalSong.lines || [];
    let activeIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].seconds !== null && lines[i].seconds <= playbackCurrentTime + 0.15) {
        activeIdx = i;
      } else if (lines[i].seconds !== null && lines[i].seconds > playbackCurrentTime + 0.15) {
        break;
      }
    }

    const rows = modalLyricsBody.querySelectorAll('.lyric-line-row');
    rows.forEach((r, idx) => {
      if (idx === activeIdx) {
        if (!r.classList.contains('active-line')) {
          r.classList.add('active-line');
          r.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        r.classList.remove('active-line');
      }
    });
  }

  // ==========================================================================
  // Crypto Donations Modal
  // ==========================================================================
  function openCryptoModal() {
    if (!donationsData || !donationsData.wallets) return;

    renderCryptoCoinTabs();
    selectCryptoCoin(activeDonationCoinId);

    cryptoModal.classList.add('active');
    cryptoModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeCryptoModal() {
    cryptoModal.classList.remove('active');
    cryptoModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function renderCryptoCoinTabs() {
    const wallets = donationsData.wallets || [];
    const html = wallets.map(w => `
      <button class="crypto-coin-tab ${w.id === activeDonationCoinId ? 'active' : ''}" data-coin="${w.id}">
        <span class="coin-icon">${w.icon || '🪙'}</span>
        <span>${escapeHtml(w.name)}</span>
      </button>
    `).join('');
    cryptoCoinTabs.innerHTML = html;
  }

  function selectCryptoCoin(coinId) {
    activeDonationCoinId = coinId;
    const wallet = (donationsData.wallets || []).find(w => w.id === coinId) || donationsData.wallets[0];
    if (!wallet) return;

    // Update tab styling
    document.querySelectorAll('.crypto-coin-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.coin === coinId);
    });

    walletCoinName.textContent = `${wallet.name} (${wallet.symbol})`;
    walletNetworkBadge.textContent = wallet.network || 'Mainnet';
    walletAddressText.textContent = wallet.address;

    // Render live SVG QR code
    cryptoQrCode.innerHTML = QRCode.toSVG(wallet.address, 160);
  }

  // ==========================================================================
  // Updates & Changelog Modal
  // ==========================================================================
  function openUpdatesModal() {
    if (!updatesData || !updatesData.changelog) return;

    const html = updatesData.changelog.map(item => `
      <div class="timeline-card">
        <div class="timeline-header">
          <span class="timeline-ver">${escapeHtml(item.version)}</span>
          <span class="timeline-date">${escapeHtml(item.date)}</span>
        </div>
        <div class="timeline-title">${escapeHtml(item.title)}</div>
        <ul class="timeline-changes-list">
          ${item.changes.map(c => `<li>${escapeHtml(c)}</li>`).join('')}
        </ul>
      </div>
    `).join('');

    updatesModalTimeline.innerHTML = html;
    updatesModal.classList.add('active');
    updatesModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeUpdatesModal() {
    updatesModal.classList.remove('active');
    updatesModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // ==========================================================================
  // Custom Nicknames / Aliases Modal
  // ==========================================================================
  function openAliasModal() {
    if (!currentModalSong) return;

    aliasSongTitleHeading.textContent = currentModalSong.title;
    customNicknameInput.value = '';

    renderUserNicknamesList(currentModalSong.id);

    aliasModal.classList.add('active');
    aliasModal.setAttribute('aria-hidden', 'false');
  }

  function closeAliasModal() {
    aliasModal.classList.remove('active');
    aliasModal.setAttribute('aria-hidden', 'true');
    if (currentModalSong) {
      renderModalAliases(currentModalSong);
      renderSongs();
    }
  }

  function renderUserNicknamesList(songId) {
    const list = userCustomNicknames[songId] || [];
    if (list.length === 0) {
      userCustomNicknamesList.innerHTML = '<span style="font-size: 0.78rem; color: var(--text-muted);">No custom nicknames saved yet.</span>';
      return;
    }

    userCustomNicknamesList.innerHTML = list.map((nick, idx) => `
      <span class="custom-nickname-chip">
        <span>${escapeHtml(nick)}</span>
        <button data-remove="${idx}" title="Remove nickname">&times;</button>
      </span>
    `).join('');
  }

  function saveCustomNickname() {
    if (!currentModalSong) return;
    const val = customNicknameInput.value.trim();
    if (!val) return;

    const songId = currentModalSong.id;
    if (!userCustomNicknames[songId]) userCustomNicknames[songId] = [];

    if (!userCustomNicknames[songId].includes(val)) {
      userCustomNicknames[songId].push(val);
      try {
        localStorage.setItem('lyricsync_custom_nicknames', JSON.stringify(userCustomNicknames));
      } catch (e) {}
      showToast(`Saved nickname "${val}"!`, 'success');
    }

    customNicknameInput.value = '';
    renderUserNicknamesList(songId);
  }

  function removeCustomNickname(idx) {
    if (!currentModalSong) return;
    const songId = currentModalSong.id;
    if (userCustomNicknames[songId]) {
      userCustomNicknames[songId].splice(idx, 1);
      if (userCustomNicknames[songId].length === 0) delete userCustomNicknames[songId];
      try {
        localStorage.setItem('lyricsync_custom_nicknames', JSON.stringify(userCustomNicknames));
      } catch (e) {}
      renderUserNicknamesList(songId);
      showToast('Nickname removed', 'info');
    }
  }

  function openGithubSuggestIssue() {
    if (!currentModalSong) return;
    const title = encodeURIComponent(`[Song Alias Suggestion] ${currentModalSong.title}`);
    const body = encodeURIComponent(
      `### Song Alias / Alternative Title Suggestion\n\n` +
      `- **Song Title**: ${currentModalSong.title}\n` +
      `- **Era**: ${currentModalSong.era}\n` +
      `- **Suggested Alternative Name(s)**: \n` +
      `- **Source / Known In Community As**: \n`
    );
    const url = `https://github.com/CavaIier/LyricSync/issues/new?title=${title}&body=${body}`;
    window.open(url, '_blank');
  }

  function openGithubRequestSync(songTitle, era) {
    const title = encodeURIComponent(`[Sync Request] ${decodeURIComponent(songTitle)} (${era})`);
    const body = encodeURIComponent(
      `### Lyric Sync Request\n\n` +
      `- **Song**: ${decodeURIComponent(songTitle)}\n` +
      `- **Era**: ${era}\n` +
      `- **Have LRC / Plain Lyrics?**: (Paste them here if you have them!)\n`
    );
    const url = `https://github.com/CavaIier/LyricSync/issues/new?title=${title}&body=${body}`;
    window.open(url, '_blank');
  }

  // ==========================================================================
  // Clipboard & Download Actions
  // ==========================================================================
  async function copyTextToClipboard(text, successMessage) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showToast(successMessage, 'success');
    } catch (e) {
      showToast('Copy failed. Please copy manually.', 'error');
    }
  }

  function triggerDownload(content, filename, mime = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}`, 'success');
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <span>${escapeHtml(message)}</span>
      </div>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  // ==========================================================================
  // Event Listeners
  // ==========================================================================
  function setupEventListeners() {
    // Navigation Tabs
    tabLibraryBtn.addEventListener('click', () => switchView('library'));
    tabTrackerBtn.addEventListener('click', () => switchView('tracker'));
    brandHomeBtn.addEventListener('click', () => switchView('library'));

    // Header buttons
    headerUpdatesBtn.addEventListener('click', openUpdatesModal);
    headerDonateBtn.addEventListener('click', openCryptoModal);
    footerDonateBtn.addEventListener('click', openCryptoModal);

    // Search Mode Toggle
    searchModePills.addEventListener('click', (e) => {
      const btn = e.target.closest('.search-mode-pill');
      if (!btn) return;
      searchMode = btn.dataset.mode;
      document.querySelectorAll('.search-mode-pill').forEach(b => b.classList.toggle('active', b === btn));
      searchInput.placeholder = searchMode === 'lyrics' 
        ? 'Search inside full song lyrics... (Press / to focus)' 
        : 'Search by song title or alternate name... (Press / to focus)';
      renderSongs();
    });

    // Search input
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      clearSearchBtn.style.display = searchQuery ? 'flex' : 'none';
      renderSongs();
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearSearchBtn.style.display = 'none';
      searchInput.focus();
      renderSongs();
    });

    // Keyboard shortcut: Press / or Ctrl+K to search
    window.addEventListener('keydown', (e) => {
      if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && document.activeElement !== searchInput && document.activeElement !== trackerSearchInput && !lyricsModal.classList.contains('active')) {
        e.preventDefault();
        searchInput.focus();
      }
      if (e.key === 'Escape') {
        if (aliasModal.classList.contains('active')) closeAliasModal();
        else if (cryptoModal.classList.contains('active')) closeCryptoModal();
        else if (updatesModal.classList.contains('active')) closeUpdatesModal();
        else if (lyricsModal.classList.contains('active')) closeSongModal();
      }
    });

    // Era filter buttons in Library
    eraFilters.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      currentFilterEra = btn.dataset.era;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderSongs();
    });

    // Sort select
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderSongs();
    });

    // Grid vs List view toggle
    viewGridBtn.addEventListener('click', () => setViewMode('grid'));
    viewListBtn.addEventListener('click', () => setViewMode('list'));

    // Reset button in empty state
    resetSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearSearchBtn.style.display = 'none';
      currentFilterEra = 'ALL';
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.era === 'ALL'));
      renderSongs();
    });

    // Song card click delegation
    songsGrid.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('[data-action="copy"]');
      if (copyBtn) {
        e.stopPropagation();
        const id = copyBtn.dataset.id;
        const song = songsMap.get(id);
        if (song) copyTextToClipboard(song.plainText, `Copied lyrics for "${song.title}"!`);
        return;
      }

      const card = e.target.closest('.song-card');
      if (card) {
        openSongModal(card.dataset.id);
      }
    });

    // Tracker Controls
    trackerSearchInput.addEventListener('input', (e) => {
      trackerSearchQuery = e.target.value;
      clearTrackerSearchBtn.style.display = trackerSearchQuery ? 'flex' : 'none';
      renderTracker();
    });
    clearTrackerSearchBtn.addEventListener('click', () => {
      trackerSearchInput.value = '';
      trackerSearchQuery = '';
      clearTrackerSearchBtn.style.display = 'none';
      trackerSearchInput.focus();
      renderTracker();
    });

    trackerEraPills.addEventListener('click', (e) => {
      const pill = e.target.closest('.tracker-pill');
      if (!pill) return;
      trackerEraFilter = pill.dataset.era;
      document.querySelectorAll('.tracker-pill').forEach(p => p.classList.toggle('active', p === pill));
      renderTracker();
    });

    trackerStatusPills.addEventListener('click', (e) => {
      const pill = e.target.closest('.tracker-status-pill');
      if (!pill) return;
      trackerStatusFilter = pill.dataset.status;
      document.querySelectorAll('.tracker-status-pill').forEach(p => p.classList.toggle('active', p === pill));
      renderTracker();
    });

    trackerListContainer.addEventListener('click', (e) => {
      const playBtn = e.target.closest('.btn-tracker-play');
      if (playBtn) {
        const songId = playBtn.dataset.songid;
        if (songId) openSongModal(songId);
        return;
      }
      const reqBtn = e.target.closest('.btn-tracker-request');
      if (reqBtn) {
        openGithubRequestSync(reqBtn.dataset.title, reqBtn.dataset.era);
      }
    });

    // Lyrics Modal actions
    modalCloseBtn.addEventListener('click', closeSongModal);
    lyricsModal.addEventListener('click', (e) => {
      if (e.target === lyricsModal) closeSongModal();
    });

    copyPlainBtn.addEventListener('click', () => {
      if (currentModalSong) copyTextToClipboard(currentModalSong.plainText, 'Clean lyrics copied to clipboard!');
    });
    copyLrcBtn.addEventListener('click', () => {
      if (currentModalSong) copyTextToClipboard(currentModalSong.lrcContent, 'LRC timestamps copied to clipboard!');
    });
    downloadLrcBtn.addEventListener('click', () => {
      if (currentModalSong) {
        const fn = `${currentModalSong.artist} - ${currentModalSong.title}.lrc`;
        triggerDownload(currentModalSong.lrcContent, fn);
      }
    });
    downloadTxtBtn.addEventListener('click', () => {
      if (currentModalSong) {
        const fn = `${currentModalSong.artist} - ${currentModalSong.title}.txt`;
        triggerDownload(currentModalSong.plainText, fn);
      }
    });

    // View mode tabs in modal
    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentModalMode = tab.dataset.mode;
        renderModalLyricsContent();
      });
    });

    // Playback Controls
    playPauseBtn.addEventListener('click', togglePlayback);
    playbackScrubber.addEventListener('input', (e) => {
      if (playbackDuration > 0) seekTo((e.target.value / 100) * playbackDuration);
    });

    // Local Audio File Loading
    localAudioInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const fileUrl = URL.createObjectURL(file);
      audioPlayer.src = fileUrl;
      usingLocalAudio = true;
      audioPlayer.onloadedmetadata = () => {
        playbackDuration = audioPlayer.duration;
        totalTimeDisplay.textContent = formatDuration(audioPlayer.duration);
        showToast(`Loaded audio: "${file.name}"`, 'success');
      };
    });

    // Click lyric line to jump in playback
    modalLyricsBody.addEventListener('click', (e) => {
      const row = e.target.closest('.lyric-line-row');
      if (!row) return;
      const secStr = row.dataset.time;
      if (secStr !== '') {
        const sec = parseFloat(secStr);
        if (!isNaN(sec)) seekTo(sec);
      }
    });

    // Next / Prev Song in modal
    prevSongBtn.addEventListener('click', () => navigateModalSong(-1));
    nextSongBtn.addEventListener('click', () => navigateModalSong(1));

    // Crypto modal events
    cryptoModalCloseBtn.addEventListener('click', closeCryptoModal);
    cryptoModal.addEventListener('click', (e) => { if (e.target === cryptoModal) closeCryptoModal(); });
    cryptoCoinTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.crypto-coin-tab');
      if (tab) selectCryptoCoin(tab.dataset.coin);
    });
    copyWalletAddressBtn.addEventListener('click', () => {
      const addr = walletAddressText.textContent;
      if (addr) copyTextToClipboard(addr, `Copied ${walletCoinName.textContent} wallet address!`);
    });

    // Updates modal events
    updatesModalCloseBtn.addEventListener('click', closeUpdatesModal);
    updatesModal.addEventListener('click', (e) => { if (e.target === updatesModal) closeUpdatesModal(); });

    // Alias modal events
    addAliasBtn.addEventListener('click', openAliasModal);
    aliasModalCloseBtn.addEventListener('click', closeAliasModal);
    aliasModal.addEventListener('click', (e) => { if (e.target === aliasModal) closeAliasModal(); });
    saveCustomNicknameBtn.addEventListener('click', saveCustomNickname);
    customNicknameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveCustomNickname(); });
    userCustomNicknamesList.addEventListener('click', (e) => {
      const rmBtn = e.target.closest('[data-remove]');
      if (rmBtn) removeCustomNickname(parseInt(rmBtn.dataset.remove, 10));
    });
    suggestGithubAliasBtn.addEventListener('click', openGithubSuggestIssue);
  }

  function navigateModalSong(direction) {
    if (!currentModalSong || activeFilteredSongs.length === 0) return;
    const currentIdx = activeFilteredSongs.findIndex(s => s.id === currentModalSong.id);
    if (currentIdx === -1) return;

    let nextIdx = currentIdx + direction;
    if (nextIdx < 0) nextIdx = activeFilteredSongs.length - 1;
    if (nextIdx >= activeFilteredSongs.length) nextIdx = 0;

    openSongModal(activeFilteredSongs[nextIdx].id);
  }

  function setViewMode(mode) {
    viewMode = mode;
    try { localStorage.setItem('lyricsync_view', mode); } catch (e) {}
    updateViewModeButtons();
  }

  function updateViewModeButtons() {
    if (viewMode === 'list') {
      viewListBtn.classList.add('active');
      viewGridBtn.classList.remove('active');
      songsGrid.classList.add('list-view');
    } else {
      viewGridBtn.classList.add('active');
      viewListBtn.classList.remove('active');
      songsGrid.classList.remove('list-view');
    }
  }

  function handleHashNavigation() {
    const hash = window.location.hash;
    if (hash.startsWith('#song=')) {
      const songId = decodeURIComponent(hash.replace('#song=', ''));
      if (songsMap.has(songId)) openSongModal(songId);
    } else if (hash === '#tracker') {
      switchView('tracker');
    } else if (hash === '#donate') {
      openCryptoModal();
    }
  }

  function formatDuration(sec) {
    if (!sec || isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Initialize app
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
