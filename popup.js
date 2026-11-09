document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const songListInput = $('songList');
  const startBtn = $('startBtn');
  const queueList = $('queueList');
  const historyList = $('historyList');
  const status = $('status');
  const playlistSection = $('playlistSection');
  const historySection = $('historySection');
  const tabPlaylistBtn = $('tabPlaylistBtn');
  const tabHistoryBtn = $('tabHistoryBtn');
  const sizeButtons = [...document.querySelectorAll('.size-btn')];

  const storageGet = (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  const storageSet = (values) => new Promise((resolve) => chrome.storage.local.set(values, resolve));
  const send = (message) => new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));

  function applyPopupSize(size) {
    const allowed = ['small', 'medium', 'large'];
    const selected = allowed.includes(size) ? size : 'medium';
    document.documentElement.dataset.popupSize = selected;
    document.body.dataset.popupSize = selected;
    sizeButtons.forEach((button) => {
      const active = button.dataset.size === selected;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function setStatus(message, isError = false) {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('error', isError);
  }

  function showTab(showHistory) {
    playlistSection.style.display = showHistory ? 'none' : 'block';
    historySection.style.display = showHistory ? 'block' : 'none';
    tabPlaylistBtn.classList.toggle('active', !showHistory);
    tabHistoryBtn.classList.toggle('active', showHistory);
    if (showHistory) loadHistory();
  }

  async function refreshQueueUI() {
    const data = await storageGet(['queue', 'currentIndex', 'playbackStatus', 'playbackDetails']);
    queueList.textContent = '';
    (Array.isArray(data.queue) ? data.queue : []).forEach((track, index) => {
      const li = document.createElement('li');
      li.textContent = `${index + 1}. ${track}${index === data.currentIndex ? ' ▶' : ''}`;
      if (index === data.currentIndex) li.classList.add('active-track');
      queueList.appendChild(li);
    });
    const detail = data.playbackDetails ? ` (${data.playbackDetails})` : '';
    setStatus(data.playbackStatus ? `Status: ${data.playbackStatus}${detail}` : 'Siap');
  }

  async function loadHistory() {
    const data = await storageGet(['scrobbleHistory']);
    historyList.textContent = '';
    const history = Array.isArray(data.scrobbleHistory) ? data.scrobbleHistory : [];
    history.slice().reverse().forEach((item) => {
      const li = document.createElement('li');
      const date = Number.isFinite(item.timestamp) ? new Date(item.timestamp).toLocaleString('id-ID') : '-';
      li.textContent = `[${date}] ${item.title || '(tanpa judul)'}`;
      historyList.appendChild(li);
    });
    if (!history.length) setStatus('Histori kosong');
  }

  function csvEscape(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  async function exportCsv() {
    const data = await storageGet(['scrobbleHistory']);
    const history = Array.isArray(data.scrobbleHistory) ? data.scrobbleHistory : [];
    if (!history.length) {
      setStatus('Histori kosong', true);
      return;
    }
    const rows = [
      ['Waktu', 'Judul Track', 'URL'],
      ...history.map((row) => [
        new Date(row.timestamp).toLocaleString('id-ID'),
        row.title || '',
        row.url || ''
      ])
    ];
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}\r\n`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ytmusic-scrobble-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('CSV berhasil diekspor');
  }

  tabPlaylistBtn.addEventListener('click', () => showTab(false));
  tabHistoryBtn.addEventListener('click', () => showTab(true));

  startBtn.addEventListener('click', async () => {
    const tracks = songListInput.value
      .split(/\r?\n/)
      .map((track) => track.replace(/\t+/g, ' - ').replace(/\s{2,}/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 500);
    if (!tracks.length) {
      setStatus('Masukkan minimal satu lagu', true);
      return;
    }
    await storageSet({ queue: tracks, currentIndex: 0 });
    const response = await send({ action: 'START_PLAYLIST' });
    if (response?.ok === false) setStatus('Gagal memulai playlist', true);
    else setStatus(`${tracks.length} lagu dimuat`);
    await refreshQueueUI();
  });

  $('nextBtn').addEventListener('click', async () => {
    await send({ action: 'MANUAL_SKIP' });
    setStatus('Memproses skip…');
    setTimeout(refreshQueueUI, 500);
  });

  $('prevBtn').addEventListener('click', async () => {
    await send({ action: 'PREV_TRACK' });
    setTimeout(refreshQueueUI, 500);
  });

  $('togglePlayBtn').addEventListener('click', () => send({ action: 'TOGGLE_PLAY' }));

  $('clearHistoryBtn').addEventListener('click', async () => {
    if (!confirm('Hapus seluruh histori pemutaran?')) return;
    await storageSet({ scrobbleHistory: [] });
    await loadHistory();
    setStatus('Histori dihapus');
  });

  $('exportCsvBtn').addEventListener('click', exportCsv);
  sizeButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const size = button.dataset.size || 'medium';
      applyPopupSize(size);
      await storageSet({ popupSize: size });
    });
  });
  void storageGet(['popupSize']).then(({ popupSize }) => applyPopupSize(popupSize));
  void refreshQueueUI();
});
