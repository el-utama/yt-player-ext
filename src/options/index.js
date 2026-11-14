// Options Page - Full settings management

import { loadSettings, saveSettings, exportSettingsPayload, importSettingsPayload, DEFAULT_SETTINGS, SETTINGS_KEY, SETTINGS_SCHEMA, LEGACY_KEYS } from '../shared/settings.js';
import { sendMessage } from '../shared/messaging.js';
import { getStorage, setStorage, STORAGE_KEYS } from './storage.js';

const $ = (id) => document.getElementById(id);
const $$ = (selector) => document.querySelectorAll(selector);

// Elements
const elements = {
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
};

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

  // Queue
  elements.queueShuffle.checked = settings.queue.shuffle;
  elements.queueLoop.value = settings.queue.loop;
  elements.queueAvoidRepeat.value = settings.queue.avoidRepeat;
  elements.enforceQueue.checked = true; // Hardcoded for now, could be a setting

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

  // Queue
  bindCheckbox(elements.queueShuffle, 'queue.shuffle');
  bindSelect(elements.queueLoop, 'queue.loop');
  bindNumber(elements.queueAvoidRepeat, 'queue.avoidRepeat', { min: 0, max: 50 });
  // enforceQueue is hardcoded for now

  // Sleep
  bindRadioGroup(elements.sleepMode, 'sleepTimer.mode');
  bindSleepNumber(elements.sleepMinutes, 'sleepTimer.minutes');
  bindSleepNumber(elements.sleepTracks, 'sleepTimer.tracks');

  // Diagnostics
  bindCheckbox(elements.diagnosticsVerbose, 'diagnostics.verbose');
  elements.copyDiagnostics.addEventListener('click', copyDiagnostics);
  elements.clearDiagnostics.addEventListener('click', clearDiagnostics);

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

    await saveSettings(imported);
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
    await saveSettings(DEFAULT_SETTINGS);
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

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupBindings();
  await loadForm();
});
