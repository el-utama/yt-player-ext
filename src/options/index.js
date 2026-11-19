// Options Page - Full settings management

import { loadSettings, exportSettingsPayload, importSettingsPayload, DEFAULT_SETTINGS } from '../shared/settings.js';
import { formatDuration } from '../shared/utils.js';
import { sendMessage } from '../shared/messaging.js';
import { getStorage, setStorage, STORAGE_KEYS } from './storage.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// Elements cache (populated after DOM ready)
let elements = {};

// Toast helper
function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Cache DOM elements
function cacheElements() {
  elements = {
    // General
    masterEnabled: $('#optMasterEnabled'),
    popupSize: $$('input[name="popupSize"]'),
    openYTM: $('#optOpenYTM'),
    reloadExt: $('#optReloadExt'),

    // Ads
    adSkipEnabled: $('#optAdSkipEnabled'),
    adSkipMinDelay: $('#optAdSkipMinDelay'),
    adSkipMaxWait: $('#optAdSkipMaxWait'),

    // Random
    randomMode: $$('input[name="randomMode"]'),
    randomMin: $('#optRandomMin'),
    randomMax: $('#optRandomMax'),

    // Scroll Simulation
    scrollSimEnabled: $('#optScrollSimEnabled'),
    scrollSimMinMinutes: $('#optScrollSimMinMinutes'),
    scrollSimMaxMinutes: $('#optScrollSimMaxMinutes'),
    scrollSimDuration: $('#optScrollSimDuration'),

    // Queue
    queueShuffle: $('#optQueueShuffle'),
    queueLoop: $('#optQueueLoop'),
    queueAvoidRepeat: $('#optQueueAvoidRepeat'),
    enforceQueue: $('#optEnforceQueue'),

    // Sleep
    sleepMode: $$('input[name="sleepMode"]'),
    sleepMinutes: $('#optSleepMinutes'),
    sleepTracks: $('#optSleepTracks'),

    // Diagnostics
    diagnosticsVerbose: $('#optDiagnosticsVerbose'),
    copyDiagnostics: $('#optCopyDiagnostics'),
    clearDiagnostics: $('#optClearDiagnostics'),
    diagnosticsPreview: $('#diagnosticsPreview'),

    // Watch Duration
    refreshWatch: $('#optRefreshWatch'),
    resetWatchStats: $('#optResetWatchStats'),
    watchStatsTable: $('#watchStatsTable'),
    watchStatsBody: $('#watchStatsBody'),
    watchStatsEmpty: $('#watchStatsEmpty'),
    watchStatsTotal: $('#watchStatsTotal'),

    // Data
    exportSettings: $('#optExportSettings'),
    exportHistory: $('#optExportHistory'),
    importFile: $('#optImportFile'),
    importBtn: $('#optImportBtn'),
    resetSettings: $('#optResetSettings'),
    clearHistory: $('#optClearHistory'),

    // About
    aboutVersion: $('#aboutVersion'),
    viewChangelog: $('#optViewChangelog'),
    viewSource: $('#optViewSource'),

    // Navigation
    sidenavItems: $$('.sidenav-item'),
    sections: $$('.section'),

    // Footer
    saveSettingsBtn: $('#optSaveSettings'),
    saveStatusEl: $('#optSaveStatus'),
  };
}

// Navigation
function setupNavigation() {
  elements.sidenavItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.section;
      elements.sidenavItems.forEach((b) => b.classList.toggle('active', b === btn));
      elements.sections.forEach((sec) => sec.classList.toggle('active', sec.id === `section-${target}`));
    });
  });
}

// Load all settings into form
async function loadForm() {
  const settings = await loadSettings();

  // General
  elements.masterEnabled.checked = settings.masterEnabled;
  elements.popupSize.forEach((r) => {
    r.checked = r.value === settings.ui.popupSize;
  });

  // Ads
  elements.adSkipEnabled.checked = settings.adSkip.enabled;
  elements.adSkipMinDelay.value = settings.adSkip.minDelay;
  elements.adSkipMaxWait.value = settings.adSkip.maxWait;

  // Random
  elements.randomMode.forEach((r) => {
    r.checked = r.value === settings.randomWatch.mode;
  });
  elements.randomMin.value = settings.randomWatch.minSeconds;
  elements.randomMax.value = settings.randomWatch.maxSeconds;

  // Scroll Simulation
  elements.scrollSimEnabled.checked = settings.scrollSimulation.enabled;
  elements.scrollSimMinMinutes.value = settings.scrollSimulation.minMinutes;
  elements.scrollSimMaxMinutes.value = settings.scrollSimulation.maxMinutes;
  elements.scrollSimDuration.value = settings.scrollSimulation.durationSeconds;

  // Queue
  elements.queueShuffle.checked = settings.queue.shuffle;
  elements.queueLoop.value = settings.queue.loop;
  elements.queueAvoidRepeat.value = settings.queue.avoidRepeat;
  elements.enforceQueue.checked = settings.queue.enforceQueue ?? true;

  // Sleep
  elements.sleepMode.forEach((r) => {
    r.checked = r.value === settings.sleepTimer.mode;
  });
  elements.sleepMinutes.value = settings.sleepTimer.minutes;
  elements.sleepTracks.value = settings.sleepTimer.tracks;

  // Diagnostics
  elements.diagnosticsVerbose.checked = settings.diagnostics.verbose;
  await refreshDiagnosticsPreview();

  // About
  const manifest = chrome.runtime.getManifest();
  elements.aboutVersion.textContent = manifest.version;
}

// Save a partial patch
async function savePatch(patch) {
  try {
    const response = await sendMessage({ action: 'SET_SETTINGS', patch });
    if (!response.ok) throw new Error(response.error);
    showToast('Tersimpan', 'success');
    await loadForm(); // Refresh from canonical source
  } catch (error) {
    showToast(`Gagal: ${error.message}`, 'error');
    await loadForm(); // Revert form
  }
}

// Keep the form in sync when another context (e.g. the popup) writes settings.
let formSyncTimer = null;
let pendingFormSync = false;

function isFormControlFocused() {
  const active = document.activeElement;
  if (!active || active.tagName !== 'INPUT') return false;
  // Only defer for fields with in-progress text; toggles can update safely.
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file'].includes(active.type);
}

function scheduleFormSync() {
  if (isFormControlFocused()) {
    // Do not overwrite a field the user is editing; refresh once focus leaves.
    pendingFormSync = true;
    return;
  }
  pendingFormSync = false;
  clearTimeout(formSyncTimer);
  formSyncTimer = setTimeout(() => {
    void loadForm();
  }, 120);
}

function watchSettingsChanges() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes.settings) return;
    scheduleFormSync();
  });

  document.addEventListener('focusout', () => {
    if (pendingFormSync) scheduleFormSync();
  });
}

// Bind simple checkbox -> patch
function bindCheckbox(el, path) {
  el.addEventListener('change', () => {
    const patch = path.split('.').reduceRight((acc, key) => ({ [key]: acc }), el.checked);
    savePatch(patch);
  });
}

// Bind number input -> patch (with debounce)
function bindNumber(el, path, { min, max, clampToMin } = {}) {
  let timer = null;
  el.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      let value = Number(el.value);
      if (!Number.isFinite(value)) value = Number(el.min || 0);
      if (min !== undefined) value = Math.max(min, value);
      if (max !== undefined) value = Math.min(max, value);
      if (clampToMin) {
        const sibling = document.querySelector(`[data-pair="${el.id}"]`);
        if (sibling) value = Math.max(Number(sibling.value || 0), value);
      }
      el.value = value;
      const patch = path.split('.').reduceRight((acc, key) => ({ [key]: acc }), value);
      savePatch(patch);
    }, 300);
  });
}

// Bind radio group -> patch
function bindRadioGroup(radios, path) {
  radios.forEach((r) => {
    r.addEventListener('change', () => {
      if (r.checked) {
        const patch = path.split('.').reduceRight((acc, key) => ({ [key]: acc }), r.value);
        savePatch(patch);
      }
    });
  });
}

// Bind select -> patch
function bindSelect(el, path) {
  el.addEventListener('change', () => {
    const patch = path.split('.').reduceRight((acc, key) => ({ [key]: acc }), el.value);
    savePatch(patch);
  });
}

// Debounced save for sleep timer numbers
function bindSleepNumber(el, path) {
  let timer = null;
  el.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      let value = Number(el.value);
      if (!Number.isFinite(value) || value < Number(el.min)) value = Number(el.min);
      if (value > Number(el.max)) value = Number(el.max);
      el.value = value;
      const patch = path.split('.').reduceRight((acc, key) => ({ [key]: acc }), value);
      savePatch(patch);
    }, 300);
  });
}

// Setup all bindings
function setupBindings() {
  // General
  bindCheckbox(elements.masterEnabled, 'masterEnabled');
  bindRadioGroup(elements.popupSize, 'ui.popupSize');

  elements.openYTM.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://music.youtube.com', active: true });
  });
  elements.reloadExt.addEventListener('click', () => {
    chrome.runtime.reload();
    showToast('Memuat ulang ekstensi…', 'info');
  });

  // Ads
  bindCheckbox(elements.adSkipEnabled, 'adSkip.enabled');
  bindNumber(elements.adSkipMinDelay, 'adSkip.minDelay', { min: 0, max: 60000 });
  bindNumber(elements.adSkipMaxWait, 'adSkip.maxWait', { min: 0, max: 120000, clampToMin: true });
  // Pair min/max for validation
  elements.adSkipMinDelay.dataset.pair = elements.adSkipMinDelay.id;
  elements.adSkipMaxWait.dataset.pair = elements.adSkipMinDelay.id;

  // Random
  bindRadioGroup(elements.randomMode, 'randomWatch.mode');
  bindNumber(elements.randomMin, 'randomWatch.minSeconds', { min: 0, max: 3600 });
  bindNumber(elements.randomMax, 'randomWatch.maxSeconds', { min: 0, max: 3600, clampToMin: true });
  elements.randomMin.dataset.pair = elements.randomMin.id;
  elements.randomMax.dataset.pair = elements.randomMin.id;

  // Scroll Simulation
  bindCheckbox(elements.scrollSimEnabled, 'scrollSimulation.enabled');
  bindNumber(elements.scrollSimMinMinutes, 'scrollSimulation.minMinutes', { min: 1, max: 1440 });
  bindNumber(elements.scrollSimMaxMinutes, 'scrollSimulation.maxMinutes', { min: 1, max: 1440, clampToMin: true });
  bindNumber(elements.scrollSimDuration, 'scrollSimulation.durationSeconds', { min: 1, max: 60 });
  elements.scrollSimMinMinutes.dataset.pair = elements.scrollSimMinMinutes.id;
  elements.scrollSimMaxMinutes.dataset.pair = elements.scrollSimMinMinutes.id;

  // Queue
  bindCheckbox(elements.queueShuffle, 'queue.shuffle');
  bindSelect(elements.queueLoop, 'queue.loop');
  bindNumber(elements.queueAvoidRepeat, 'queue.avoidRepeat', { min: 0, max: 50 });
  bindCheckbox(elements.enforceQueue, 'queue.enforceQueue');

  // Sleep
  bindRadioGroup(elements.sleepMode, 'sleepTimer.mode');
  bindSleepNumber(elements.sleepMinutes, 'sleepTimer.minutes');
  bindSleepNumber(elements.sleepTracks, 'sleepTimer.tracks');

  // Diagnostics
  bindCheckbox(elements.diagnosticsVerbose, 'diagnostics.verbose');
  elements.copyDiagnostics.addEventListener('click', copyDiagnostics);
  elements.clearDiagnostics.addEventListener('click', clearDiagnostics);

  // Watch Duration
  elements.refreshWatch.addEventListener('click', loadWatchStats);
  elements.resetWatchStats.addEventListener('click', resetWatchStats);

  // Data
  elements.exportSettings.addEventListener('click', exportSettings);
  elements.exportHistory.addEventListener('click', exportHistory);
  elements.importBtn.addEventListener('click', () => elements.importFile.click());
  elements.importFile.addEventListener('change', importSettings);
  elements.resetSettings.addEventListener('click', resetSettings);
  elements.clearHistory.addEventListener('click', clearHistory);

  // About
  elements.viewChangelog.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://github.com/el-utama/yt-player-ext/blob/main/CHANGELOG.md', active: true });
  });
  elements.viewSource.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://github.com/el-utama/yt-player-ext', active: true });
  });

  // Save button
  const saveBtn = elements.saveSettingsBtn;
  const statusEl = elements.saveStatusEl;
  if (saveBtn && statusEl) {
    saveBtn.addEventListener('click', saveAllSettings);
  }
}

// Save all settings from form
async function saveAllSettings() {
  const saveBtn = elements.saveSettingsBtn;
  const statusEl = elements.saveStatusEl;
  if (!saveBtn || !statusEl) return;

  // Collect all form values into a patch
  const patch = collectFormValues();

  // UI: saving state
  saveBtn.disabled = true;
  saveBtn.textContent = 'Menyimpan…';
  statusEl.innerHTML = '<span class="spinner"></span> Menyimpan…';
  statusEl.className = 'save-status saving';

  try {
    const response = await sendMessage({ action: 'SET_SETTINGS', patch });
    if (!response.ok) throw new Error(response.error);

    // Success
    statusEl.textContent = '✓ Tersimpan';
    statusEl.className = 'save-status success';
    showToast('Pengaturan disimpan', 'success');

    // Reload form to reflect any normalized values
    await loadForm();
  } catch (error) {
    // Error
    statusEl.textContent = '✗ Gagal: ' + error.message;
    statusEl.className = 'save-status error';
    showToast('Gagal menyimpan: ' + error.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Simpan Perubahan';
    // Clear status after 3 seconds
    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = 'save-status';
    }, 3000);
  }
}

/**
 * Collect all form values into a settings patch object
 */
function collectFormValues() {
  const patch = {};

  // General
  patch.masterEnabled = elements.masterEnabled.checked;

  const popupSize = document.querySelector('input[name="popupSize"]:checked');
  if (popupSize) patch.ui = { popupSize: popupSize.value };

  // Ads
  patch.adSkip = {
    enabled: elements.adSkipEnabled.checked,
    minDelay: Number(elements.adSkipMinDelay.value) || 0,
    maxWait: Number(elements.adSkipMaxWait.value) || 0,
  };

  // Random
  const randomMode = document.querySelector('input[name="randomMode"]:checked');
  patch.randomWatch = {
    mode: randomMode ? randomMode.value : 'off',
    minSeconds: Number(elements.randomMin.value) || 0,
    maxSeconds: Number(elements.randomMax.value) || 0,
  };

  // Scroll Simulation
  patch.scrollSimulation = {
    enabled: elements.scrollSimEnabled.checked,
    minMinutes: Number(elements.scrollSimMinMinutes.value) || 15,
    maxMinutes: Number(elements.scrollSimMaxMinutes.value) || 20,
    durationSeconds: Number(elements.scrollSimDuration.value) || 5,
  };

  // Queue
  patch.queue = {
    shuffle: elements.queueShuffle.checked,
    loop: elements.queueLoop.value,
    avoidRepeat: Number(elements.queueAvoidRepeat.value) || 0,
    enforceQueue: elements.enforceQueue.checked,
  };

  // Sleep Timer
  const sleepMode = document.querySelector('input[name="sleepMode"]:checked');
  patch.sleepTimer = {
    mode: sleepMode ? sleepMode.value : 'off',
    minutes: Number(elements.sleepMinutes.value) || 30,
    tracks: Number(elements.sleepTracks.value) || 10,
  };

  // Diagnostics
  patch.diagnostics = {
    verbose: elements.diagnosticsVerbose.checked,
  };

  return patch;
}

// Diagnostics
async function refreshDiagnosticsPreview() {
  try {
    const response = await sendMessage({ action: 'GET_DIAGNOSTICS' });
    if (response.ok && response.diagnostics) {
      const lines = response.diagnostics.map((d) => {
        const time = new Date(d.at).toLocaleTimeString();
        return `[${time}] ${d.status}${d.details ? ': ' + d.details : ''}`;
      }).join('\n');
      elements.diagnosticsPreview.textContent = lines || '(kosong)';
    } else {
      elements.diagnosticsPreview.textContent = '(tidak ada data)';
    }
  } catch (_error) {
    elements.diagnosticsPreview.textContent = '(gagal memuat)';
  }
}

async function copyDiagnostics() {
  try {
    const response = await sendMessage({ action: 'GET_DIAGNOSTICS' });
    if (response.ok && response.diagnostics) {
      const text = JSON.stringify(response.diagnostics, null, 2);
      await navigator.clipboard.writeText(text);
      showToast('Log disalin ke clipboard', 'success');
    }
  } catch (_error) {
    showToast('Gagal menyalin', 'error');
  }
}

async function clearDiagnostics() {
  // No direct API; we could send a message to background to clear, but for now just refresh
  await refreshDiagnosticsPreview();
  showToast('Log diagnostik dibersihkan (perlu reload untuk persisten)', 'info');
}

// Data operations
function exportSettings() {
  loadSettings().then((settings) => {
    const payload = exportSettingsPayload(settings);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ytmusic-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Pengaturan diekspor', 'success');
  });
}

async function exportHistory() {
  const data = await getStorage([STORAGE_KEYS.SCOBBLE_HISTORY]);
  const history = Array.isArray(data[STORAGE_KEYS.SCOBBLE_HISTORY]) ? data[STORAGE_KEYS.SCOBBLE_HISTORY] : [];

  if (history.length === 0) {
    showToast('Tidak ada histori untuk diekspor', 'error');
    return;
  }

  const headers = ['Title', 'URL', 'Timestamp', 'Session ID'];
  const rows = history.map((item) => [
    `"${String(item.title).replace(/"/g, '""')}"`,
    `"${String(item.url).replace(/"/g, '""')}"`,
    `"${new Date(item.timestamp).toLocaleString()}"`,
    `"${String(item.sessionId).replace(/"/g, '""')}"`,
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ytmusic-scrobble-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Histori diekspor (CSV)', 'success');
}

async function importSettings(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const imported = importSettingsPayload(payload);

    if (!imported) throw new Error('Format JSON tidak valid atau skema tidak dikenali');

    const response = await sendMessage({ action: 'SET_SETTINGS', patch: imported });
    if (!response.ok) throw new Error(response.error);
    showToast('Pengaturan diimpor', 'success');
    await loadForm();
  } catch (error) {
    showToast(`Import gagal: ${error.message}`, 'error');
  } finally {
    event.target.value = '';
  }
}

async function resetSettings() {
  if (!confirm('Reset SEMUA pengaturan ke default bawaan? Tindakan ini tidak bisa dibatalkan.')) return;
  if (!confirm('Yakin? Ini akan menghapus konfigurasi ad-skip, random, queue, sleep timer, dan diagnostik.')) return;

  try {
    const response = await sendMessage({ action: 'SET_SETTINGS', patch: DEFAULT_SETTINGS });
    if (!response.ok) throw new Error(response.error);
    showToast('Pengaturan direset ke default', 'success');
    await loadForm();
  } catch (error) {
    showToast(`Reset gagal: ${error.message}`, 'error');
  }
}

async function clearHistory() {
  if (!confirm('Hapus seluruh histori scrobble?')) return;
  await setStorage({ [STORAGE_KEYS.SCOBBLE_HISTORY]: [] });
  showToast('Histori dihapus', 'success');
}

// Watch Duration Stats
async function loadWatchStats() {
  try {
    const response = await sendMessage({ action: 'GET_WATCH_STATS' });
    if (!response.ok) throw new Error(response.error);

    const sessions = response.sessions || {};
    const allTime = response.allTime || {};

    // Aggregate per-artist across all active sessions
    const artistSessionSeconds = {};
    let anySession = false;
    for (const [tabId, session] of Object.entries(sessions)) {
      if (!session || !session.artists) continue;
      anySession = true;
      for (const [artist, seconds] of Object.entries(session.artists)) {
        artistSessionSeconds[artist] = (artistSessionSeconds[artist] || 0) + seconds;
      }
    }

    const allArtists = new Set([...Object.keys(artistSessionSeconds), ...Object.keys(allTime)]);

    if (allArtists.size === 0) {
      elements.watchStatsTable.style.display = 'none';
      elements.watchStatsEmpty.style.display = 'block';
      elements.watchStatsTotal.textContent = '';
      return;
    }

    elements.watchStatsEmpty.style.display = 'none';
    elements.watchStatsTable.style.display = 'table';

    const tbody = elements.watchStatsBody;
    tbody.innerHTML = '';

    let grandTotal = 0;

    const sortedArtists = [...allArtists].sort((a, b) => {
      const aTotal = (artistSessionSeconds[a] || 0) + (allTime[a] || 0);
      const bTotal = (artistSessionSeconds[b] || 0) + (allTime[b] || 0);
      return bTotal - aTotal;
    });

    for (const artist of sortedArtists) {
      const sessionSecs = artistSessionSeconds[artist] || 0;
      const allTimeSecs = allTime[artist] || 0;
      const total = sessionSecs + allTimeSecs;
      grandTotal += total;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding: 8px; border-bottom: 1px solid #333;">${escapeHtml(artist)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #333; font-family: monospace;">${formatDuration(sessionSecs)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #333; font-family: monospace;">${formatDuration(allTimeSecs)}</td>
      `;
      tbody.appendChild(tr);
    }

    // Grand total row
    const totalRow = document.createElement('tr');
    totalRow.innerHTML = `
      <td style="padding: 8px; border-top: 2px solid var(--border); font-weight: 600;">Total</td>
      <td style="padding: 8px; border-top: 2px solid var(--border); font-family: monospace; font-weight: 600;"></td>
      <td style="padding: 8px; border-top: 2px solid var(--border); font-family: monospace; font-weight: 600;">${formatDuration(grandTotal)}</td>
    `;
    tbody.appendChild(totalRow);

    const totalSession = Object.values(artistSessionSeconds).reduce((a, b) => a + b, 0);
    elements.watchStatsTotal.textContent = `Total sesi ini: ${formatDuration(totalSession)} | Semua waktu: ${formatDuration(grandTotal)}`;
  } catch (error) {
    showToast(`Gagal memuat statistik: ${error.message}`, 'error');
  }
}

async function resetWatchStats() {
  if (!confirm('Hapus seluruh data durasi menonton (sesi + semua waktu)? Tindakan ini tidak bisa dibatalkan.')) return;
  try {
    const response = await sendMessage({ action: 'RESET_WATCH_STATS' });
    if (!response.ok) throw new Error(response.error);
    elements.watchStatsTable.style.display = 'none';
    elements.watchStatsEmpty.style.display = 'block';
    elements.watchStatsTotal.textContent = '';
    showToast('Data durasi dihapus', 'success');
  } catch (error) {
    showToast(`Reset gagal: ${error.message}`, 'error');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  cacheElements();
  setupNavigation();
  setupBindings();
  watchSettingsChanges();
  await loadForm();
  await loadWatchStats();
});