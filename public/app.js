/**
 * LyricSync — Modern Juice WRLD Synced Lyrics & LRC Archive
 */

(function () {
  'use strict';

  // State
  let allSongs = [];
  let songsMap = new Map(); // id -> song full or summary
  let currentFilterEra = 'ALL';
  let searchQuery = '';
  let currentSort = 'title-asc';
  let viewMode = localStorage.getItem('lyricsync_view') || 'grid';

  // Modal State
  let currentModalSong = null;
  let currentModalMode = 'synced'; // 'synced' | 'plain' | 'raw'
  let activeFilteredSongs = [];

  // Audio / Playback Simulation State
  let isPlaying = false;
  let playbackTimer = null;
  let playbackCurrentTime = 0;
  let playbackDuration = 0;
  let usingLocalAudio = false;

  // DOM Elements
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const eraFilters = document.getElementById('eraFilters');
  const sortSelect = document.getElementById('sortSelect');
  const viewGridBtn = document.getElementById('viewGridBtn');
  const viewListBtn = document.getElementById('viewListBtn');
  const songsGrid = document.getElementById('songsGrid');
  const emptyState = document.getElementById('emptyState');
  const resetSearchBtn = document.getElementById('resetSearchBtn');
  const visibleCount = document.getElementById('visibleCount');
  const activeFilterDesc = document.getElementById('activeFilterDesc');

  // Header counters
  const totalCount = document.getElementById('totalCount');
  const drflCount = document.getElementById('drflCount');
  const outCount = document.getElementById('outCount');
  const badgeAll = document.getElementById('badgeAll');
  const badgeDrfl = document.getElementById('badgeDrfl');
  const badgeOut = document.getElementById('badgeOut');

  // Modal elements
  const lyricsModal = document.getElementById('lyricsModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalSongTitle = document.getElementById('modalSongTitle');
  const modalSongArtist = document.getElementById('modalSongArtist');
  const modalEraBadge = document.getElementById('modalEraBadge');
  const modalDuration = document.getElementById('modalDuration');
  const modalLineCount = document.getElementById('modalLineCount');
  const modalLyricsBody = document.getElementById('modalLyricsBody');
  const copyPlainBtn = document.getElementById('copyPlainBtn');
  const copyLrcBtn = document.getElementById('copyLrcBtn');
  const downloadLrcBtn = document.getElementById('downloadLrcBtn');
  const downloadTxtBtn = document.getElementById('downloadTxtBtn');
  const prevSongBtn = document.getElementById('prevSongBtn');
  const nextSongBtn = document.getElementById('nextSongBtn');

  // Playback elements
  const playPauseBtn = document.getElementById('playPauseBtn');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const currentTimeDisplay = document.getElementById('currentTimeDisplay');
  const totalTimeDisplay = document.getElementById('totalTimeDisplay');
  const playbackScrubber = document.getElementById('playbackScrubber');
  const localAudioInput = document.getElementById('localAudioInput');
  const audioPlayer = document.getElementById('audioPlayer');

  // Toast Container
  const toastContainer = document.getElementById('toastContainer');

  // ==========================================================================
  // Initialization & Data Loading
  // ==========================================================================

  async function init() {
    setupEventListeners();
    updateViewModeButtons();
    await loadSongsData();
    handleHashNavigation();
  }

  async function loadSongsData() {
    const isLocalServer = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocalServer) {
      try {
        let res = await fetch('/api/songs');
        if (res.ok) {
          const data = await res.json();
          allSongs = data.songs;
          updateStats(data.eras, data.totalSongs);
          renderSongs();
          return;
        }
      } catch (e) {
        console.warn('Live API unavailable, trying static songs-data.json...');
      }
    }

    try {
      // Static deployment or fallback
      let res = await fetch('songs-data.json');
      if (res.ok) {
        const data = await res.json();
        allSongs = data.songs;
        // Cache full data in map
        allSongs.forEach(s => songsMap.set(s.id, s));
        updateStats(data.eras, data.totalSongs);
        renderSongs();
        return;
      }
    } catch (e) {
      console.error('Failed to load songs data:', e);
      showToast('Error loading songs data.', 'error');
    }
  }

  function updateStats(eras, total) {
    if (totalCount) totalCount.textContent = total;
    if (badgeAll) badgeAll.textContent = total;

    eras.forEach(e => {
      if (e.code === 'DRFL') {
        if (drflCount) drflCount.textContent = e.count;
        if (badgeDrfl) badgeDrfl.textContent = e.count;
      } else if (e.code === 'OUT') {
        if (outCount) outCount.textContent = e.count;
        if (badgeOut) badgeOut.textContent = e.count;
      }
    });
  }

  // ==========================================================================
  // Filtering, Searching & Sorting
  // ==========================================================================

  function getFilteredAndSortedSongs() {
    let result = allSongs.slice();

    // Era Filter
    if (currentFilterEra !== 'ALL') {
      result = result.filter(s => s.era === currentFilterEra);
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(s => {
        return (
          s.title.toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q) ||
          s.era.toLowerCase().includes(q) ||
          s.filename.toLowerCase().includes(q)
        );
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (currentSort === 'title-asc') {
        return a.title.localeCompare(b.title);
      } else if (currentSort === 'title-desc') {
        return b.title.localeCompare(a.title);
      } else if (currentSort === 'duration') {
        return (b.durationSec || 0) - (a.durationSec || 0);
      } else if (currentSort === 'era') {
        if (a.era !== b.era) return a.era.localeCompare(b.era);
        return a.title.localeCompare(b.title);
      }
      return 0;
    });

    return result;
  }

  function renderSongs() {
    activeFilteredSongs = getFilteredAndSortedSongs();

    if (visibleCount) visibleCount.textContent = activeFilteredSongs.length;

    if (activeFilterDesc) {
      if (searchQuery.trim()) {
        activeFilterDesc.textContent = `for "${searchQuery}"`;
      } else {
        activeFilterDesc.textContent = '';
      }
    }

    if (activeFilteredSongs.length === 0) {
      songsGrid.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    // Apply list view class if needed
    if (viewMode === 'list') {
      songsGrid.classList.add('list-view');
    } else {
      songsGrid.classList.remove('list-view');
    }

    const cardsHtml = activeFilteredSongs.map(song => createSongCard(song)).join('');
    songsGrid.innerHTML = cardsHtml;
  }

  function createSongCard(song) {
    const eraClass = song.era.toLowerCase() === 'drfl' ? 'card-drfl' : 'card-out';
    const badgeClass = song.era.toLowerCase() === 'drfl' ? 'badge-drfl' : 'badge-out';

    return `
      <div class="song-card ${eraClass}" data-id="${song.id}">
        <div class="card-top">
          <span class="era-badge ${badgeClass}">${song.era} Era</span>
          <div class="card-meta-right">
            ${song.hasTimestamps ? `
              <span class="sync-indicator" title="Synchronized LRC available">
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
          <h3 class="song-title">${escapeHtml(song.title)}</h3>
          <div class="song-artist">${escapeHtml(song.artist)}</div>
        </div>

        <div class="card-footer-stats">
          <span>${song.lineCount} lines</span>
          <span>•</span>
          <span>${song.eraName || song.era}</span>
        </div>

        <div class="card-actions">
          <button class="card-btn card-btn-primary action-view" data-id="${song.id}" title="View and play synchronized lyrics">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span>View</span>
          </button>
          
          <button class="card-btn action-copy-lyrics" data-id="${song.id}" title="Copy lyrics to clipboard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy</span>
          </button>

          <button class="card-btn action-copy-lrc" data-id="${song.id}" title="Copy synced LRC text">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="4 17 10 11 4 5"></polyline>
              <line x1="12" y1="19" x2="20" y2="19"></line>
            </svg>
            <span>LRC</span>
          </button>

          <button class="card-btn action-download-lrc" data-id="${song.id}" title="Download .lrc file">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Download</span>
          </button>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // Lyrics Fetching & Modal Display
  // ==========================================================================

  async function fetchSongDetails(songId) {
    if (songsMap.has(songId) && songsMap.get(songId).lines) {
      return songsMap.get(songId);
    }

    const isLocalServer = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalServer) {
      try {
        const res = await fetch(`/api/song/${songId}`);
        if (res.ok) {
          const fullSong = await res.json();
          songsMap.set(songId, fullSong);
          return fullSong;
        }
      } catch (e) {
        console.warn('API fetch failed, checking cached local data...');
      }
    }

    // Try finding in static songs-data.json
    if (songsMap.has(songId)) {
      return songsMap.get(songId);
    }

    return null;
  }

  async function openSongModal(songId) {
    const song = await fetchSongDetails(songId);
    if (!song) {
      showToast('Could not find lyrics for this song', 'error');
      return;
    }

    currentModalSong = song;
    window.location.hash = song.id;

    // Header info
    modalSongTitle.textContent = song.title;
    modalSongArtist.textContent = song.artist;
    modalEraBadge.textContent = `${song.era} Era`;
    modalEraBadge.className = `era-badge ${song.era.toLowerCase() === 'drfl' ? 'badge-drfl' : 'badge-out'}`;
    modalDuration.textContent = song.durationFormatted || '0:00';
    modalLineCount.textContent = `${song.lineCount} lines`;

    // Reset playback
    stopPlayback();
    playbackDuration = song.durationSec || 180;
    totalTimeDisplay.textContent = formatDuration(playbackDuration);
    playbackScrubber.max = playbackDuration;
    playbackScrubber.value = 0;
    currentTimeDisplay.textContent = '00:00';

    // Render lyrics body based on mode
    renderModalLyrics();

    // Show modal
    lyricsModal.classList.add('active');
    lyricsModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeSongModal() {
    lyricsModal.classList.remove('active');
    lyricsModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    stopPlayback();
    currentModalSong = null;

    // Reset URL hash without jumping
    if (window.location.hash) {
      history.replaceState(null, null, ' ');
    }
  }

  function renderModalLyrics() {
    if (!currentModalSong) return;

    if (currentModalMode === 'synced') {
      const lines = currentModalSong.lines || [];
      const linesHtml = lines.map(line => {
        if (!line.text && !line.timestamp) {
          return '<div class="lyric-line-row empty-row"><br></div>';
        }
        return `
          <div class="lyric-line-row" data-sec="${line.seconds !== null ? line.seconds : ''}">
            ${line.timestamp ? `<span class="lyric-time-chip">${line.timestamp}</span>` : ''}
            <span class="lyric-text">${escapeHtml(line.text || '')}</span>
          </div>
        `;
      }).join('');

      modalLyricsBody.innerHTML = `<div class="lyrics-synced-container">${linesHtml}</div>`;

      // Attach click to seek
      const rows = modalLyricsBody.querySelectorAll('.lyric-line-row[data-sec]');
      rows.forEach(row => {
        row.addEventListener('click', () => {
          const sec = parseFloat(row.getAttribute('data-sec'));
          if (!isNaN(sec)) {
            seekToTime(sec);
          }
        });
      });
    } else if (currentModalMode === 'plain') {
      modalLyricsBody.innerHTML = `
        <div class="lyrics-plain-container">${escapeHtml(currentModalSong.plainText || '')}</div>
      `;
    } else if (currentModalMode === 'raw') {
      modalLyricsBody.innerHTML = `
        <pre class="lyrics-raw-container">${escapeHtml(currentModalSong.lrcContent || '')}</pre>
      `;
    }
  }

  // ==========================================================================
  // Playback Simulation & Karaoke Engine
  // ==========================================================================

  function togglePlayPause() {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }

  function startPlayback() {
    if (!currentModalSong) return;
    isPlaying = true;
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';

    if (usingLocalAudio && audioPlayer.src) {
      audioPlayer.play().catch(e => console.warn('Audio play prevented:', e));
    } else {
      // Simulation mode
      const intervalMs = 100;
      playbackTimer = setInterval(() => {
        playbackCurrentTime += intervalMs / 1000;
        if (playbackCurrentTime >= playbackDuration) {
          playbackCurrentTime = playbackDuration;
          stopPlayback();
        }
        updatePlaybackUI();
      }, intervalMs);
    }
  }

  function stopPlayback() {
    isPlaying = false;
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    if (playbackTimer) {
      clearInterval(playbackTimer);
      playbackTimer = null;
    }
    if (usingLocalAudio) {
      audioPlayer.pause();
    }
  }

  function seekToTime(sec) {
    playbackCurrentTime = Math.max(0, Math.min(sec, playbackDuration));
    if (usingLocalAudio) {
      audioPlayer.currentTime = playbackCurrentTime;
    }
    updatePlaybackUI();
  }

  function updatePlaybackUI() {
    currentTimeDisplay.textContent = formatDuration(playbackCurrentTime);
    playbackScrubber.value = playbackCurrentTime;

    if (currentModalMode === 'synced') {
      highlightActiveLyricLine(playbackCurrentTime);
    }
  }

  function highlightActiveLyricLine(currentTime) {
    const rows = modalLyricsBody.querySelectorAll('.lyric-line-row[data-sec]');
    let activeRow = null;

    rows.forEach(row => {
      const secStr = row.getAttribute('data-sec');
      if (secStr !== '') {
        const sec = parseFloat(secStr);
        if (sec <= currentTime + 0.15) {
          activeRow = row;
        }
      }
      row.classList.remove('active');
    });

    if (activeRow) {
      activeRow.classList.add('active');
      // Scroll into view gently if playing
      if (isPlaying) {
        activeRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  // ==========================================================================
  // Copy & Download Handlers
  // ==========================================================================

  async function copyToClipboard(text, successMsg) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        showToast(successMsg, 'success');
        return;
      }
    } catch (e) {
      console.warn('Clipboard API failed, trying fallback...', e);
    }

    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      showToast(successMsg, 'success');
    } catch (err) {
      showToast('Could not copy to clipboard', 'error');
    }
    document.body.removeChild(textarea);
  }

  function triggerDownload(content, filename, mimeType = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast(`Downloaded ${filename}`, 'success');
  }

  async function handleCopyPlain(songId) {
    const song = await fetchSongDetails(songId);
    if (!song) return;
    copyToClipboard(song.plainText, `Copied plain lyrics for "${song.title}"`);
  }

  async function handleCopyLrc(songId) {
    const song = await fetchSongDetails(songId);
    if (!song) return;
    copyToClipboard(song.lrcContent, `Copied synced .LRC for "${song.title}"`);
  }

  async function handleDownloadLrc(songId) {
    const song = await fetchSongDetails(songId);
    if (!song) return;
    const filename = `${song.artist} - ${song.title}.lrc`.replace(/[\\/:*?"<>|]/g, '_');
    triggerDownload(song.lrcContent, filename);
  }

  async function handleDownloadTxt(songId) {
    const song = await fetchSongDetails(songId);
    if (!song) return;
    const filename = `${song.artist} - ${song.title}.txt`.replace(/[\\/:*?"<>|]/g, '_');
    triggerDownload(song.plainText, filename);
  }

  // ==========================================================================
  // Navigation & Helpers
  // ==========================================================================

  function navigateSong(direction) {
    if (!currentModalSong || activeFilteredSongs.length === 0) return;
    const currentIndex = activeFilteredSongs.findIndex(s => s.id === currentModalSong.id);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = activeFilteredSongs.length - 1;
    if (nextIndex >= activeFilteredSongs.length) nextIndex = 0;

    openSongModal(activeFilteredSongs[nextIndex].id);
  }

  function handleHashNavigation() {
    const hash = window.location.hash.replace('#', '').trim();
    if (hash) {
      openSongModal(hash);
    }
  }

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>${escapeHtml(message)}</span>
    `;

    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  function updateViewModeButtons() {
    if (viewMode === 'list') {
      viewListBtn.classList.add('active');
      viewGridBtn.classList.remove('active');
    } else {
      viewGridBtn.classList.add('active');
      viewListBtn.classList.remove('active');
    }
  }

  function formatDuration(totalSec) {
    if (!totalSec || isNaN(totalSec)) return '00:00';
    const min = Math.floor(totalSec / 60);
    const sec = Math.floor(totalSec % 60);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================================================
  // Event Listeners
  // ==========================================================================

  function setupEventListeners() {
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

    resetSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearSearchBtn.style.display = 'none';
      currentFilterEra = 'ALL';
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.era === 'ALL');
      });
      renderSongs();
    });

    // Era Filter Buttons
    eraFilters.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilterEra = btn.dataset.era;
      renderSongs();
    });

    // Sort select
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderSongs();
    });

    // View toggle buttons
    viewGridBtn.addEventListener('click', () => {
      viewMode = 'grid';
      localStorage.setItem('lyricsync_view', 'grid');
      updateViewModeButtons();
      renderSongs();
    });

    viewListBtn.addEventListener('click', () => {
      viewMode = 'list';
      localStorage.setItem('lyricsync_view', 'list');
      updateViewModeButtons();
      renderSongs();
    });

    // Card Clicks (delegated)
    songsGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.song-card');
      if (!card) return;
      const songId = card.dataset.id;

      // Check specific action buttons
      if (e.target.closest('.action-copy-lyrics')) {
        handleCopyPlain(songId);
        return;
      }
      if (e.target.closest('.action-copy-lrc')) {
        handleCopyLrc(songId);
        return;
      }
      if (e.target.closest('.action-download-lrc')) {
        handleDownloadLrc(songId);
        return;
      }

      // Default: open modal
      openSongModal(songId);
    });

    // Modal close
    modalCloseBtn.addEventListener('click', closeSongModal);
    lyricsModal.addEventListener('click', (e) => {
      if (e.target === lyricsModal) closeSongModal();
    });

    // Modal action toolbar
    copyPlainBtn.addEventListener('click', () => {
      if (currentModalSong) handleCopyPlain(currentModalSong.id);
    });
    copyLrcBtn.addEventListener('click', () => {
      if (currentModalSong) handleCopyLrc(currentModalSong.id);
    });
    downloadLrcBtn.addEventListener('click', () => {
      if (currentModalSong) handleDownloadLrc(currentModalSong.id);
    });
    downloadTxtBtn.addEventListener('click', () => {
      if (currentModalSong) handleDownloadTxt(currentModalSong.id);
    });

    // Modal mode switcher tabs
    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentModalMode = tab.dataset.mode;
        renderModalLyrics();
      });
    });

    // Modal nav
    prevSongBtn.addEventListener('click', () => navigateSong(-1));
    nextSongBtn.addEventListener('click', () => navigateSong(1));

    // Playback scrubber
    playbackScrubber.addEventListener('input', (e) => {
      seekToTime(parseFloat(e.target.value));
    });

    playPauseBtn.addEventListener('click', togglePlayPause);

    // Local audio file player
    localAudioInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const fileUrl = URL.createObjectURL(file);
        audioPlayer.src = fileUrl;
        usingLocalAudio = true;
        showToast(`Loaded audio: ${file.name}`, 'success');

        audioPlayer.onloadedmetadata = () => {
          playbackDuration = audioPlayer.duration;
          totalTimeDisplay.textContent = formatDuration(playbackDuration);
          playbackScrubber.max = playbackDuration;
        };

        audioPlayer.ontimeupdate = () => {
          playbackCurrentTime = audioPlayer.currentTime;
          updatePlaybackUI();
        };

        audioPlayer.onended = () => {
          stopPlayback();
        };

        startPlayback();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Focus search with '/'
      if (e.key === '/' && document.activeElement !== searchInput && !lyricsModal.classList.contains('active')) {
        e.preventDefault();
        searchInput.focus();
        return;
      }

      // Modal navigation & controls
      if (lyricsModal.classList.contains('active')) {
        if (e.key === 'Escape') {
          closeSongModal();
        } else if (e.key === 'ArrowLeft') {
          navigateSong(-1);
        } else if (e.key === 'ArrowRight') {
          navigateSong(1);
        } else if (e.key === ' ' && e.target === document.body) {
          e.preventDefault();
          togglePlayPause();
        }
      }
    });

    // Window popstate / hash change
    window.addEventListener('hashchange', handleHashNavigation);
  }

  // Start app
  document.addEventListener('DOMContentLoaded', init);
})();
