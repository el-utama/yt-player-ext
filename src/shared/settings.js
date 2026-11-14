// Shared Settings - Single source of truth for extension configuration
//
// Every context (background, content script, popup, options page) reads the
// same nested `settings` object. Legacy flat keys from 3.3.0 are still written
// for one release so open tabs running an older content script keep working.

import { storageGet, storageSet } from './messaging.js';

export const SETTINGS_KEY = 'settings';
export const SETTINGS_SCHEMA = 2;

export const LOOP_MODES = ['off', 'all', 'one'];
export const RANDOM_MODES = ['off', 'queue', 'all'];
export const POPUP_SIZES = ['small', 'medium', 'large'];
export const SLEEP_MODES = ['off', 'minutes', 'tracks'];

export const DEFAULT_SETTINGS = Object.freeze({
  schema: SETTINGS_SCHEMA,
  masterEnabled: true,
  adSkip: Object.freeze({ enabled: true, minDelay: 5000, maxWait: 30000 }),
  randomWatch: Object.freeze({ mode: 'off', minSeconds: 40, maxSeconds: 60 }),
  queue: Object.freeze({ shuffle: false, loop: 'off', avoidRepeat: 0 }),
  ui: Object.freeze({ popupSize: 'medium' }),
  sleepTimer: Object.freeze({ mode: 'off', minutes: 30, tracks: 10 }),
  diagnostics: Object.freeze({ verbose: false }),
});

// Flat keys written by 3.3.0. Mirrored on every save during 3.4.x.
export const LEGACY_KEYS = Object.freeze({
  masterEnabled: 'extensionEnabled',
  adSkipEnabled: 'adSkipEnabled',
  adSkipMinDelay: 'adSkipMinDelay',
  adSkipMaxWait: 'adSkipMaxWait',
  randomEnabled: 'randomEnabled',
  randomMinSeconds: 'randomMinSeconds',
  randomMaxSeconds: 'randomMaxSeconds',
  shuffleEnabled: 'shuffleEnabled',
  popupSize: 'popupSize',
});

function cloneDefaults() {
  return {
    schema: SETTINGS_SCHEMA,
    masterEnabled: DEFAULT_SETTINGS.masterEnabled,
    adSkip: { ...DEFAULT_SETTINGS.adSkip },
    randomWatch: { ...DEFAULT_SETTINGS.randomWatch },
    queue: { ...DEFAULT_SETTINGS.queue },
    ui: { ...DEFAULT_SETTINGS.ui },
    sleepTimer: { ...DEFAULT_SETTINGS.sleepTimer },
    diagnostics: { ...DEFAULT_SETTINGS.diagnostics },
  };
}

function numberIn(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function bool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Clamp and validate a settings object. Never throws; unknown fields are
 * dropped so a corrupted import cannot leak values into the extension.
 */
export function normalizeSettings(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const defaults = cloneDefaults();

  const adSkipSource = source.adSkip && typeof source.adSkip === 'object' ? source.adSkip : {};
  const randomSource = source.randomWatch && typeof source.randomWatch === 'object' ? source.randomWatch : {};
  const queueSource = source.queue && typeof source.queue === 'object' ? source.queue : {};
  const uiSource = source.ui && typeof source.ui === 'object' ? source.ui : {};
  const sleepSource = source.sleepTimer && typeof source.sleepTimer === 'object' ? source.sleepTimer : {};
  const diagnosticsSource = source.diagnostics && typeof source.diagnostics === 'object' ? source.diagnostics : {};

  const minDelay = numberIn(adSkipSource.minDelay, 0, 60000, defaults.adSkip.minDelay);
  const maxWait = Math.max(minDelay, numberIn(adSkipSource.maxWait, 0, 120000, defaults.adSkip.maxWait));

  const minSeconds = numberIn(randomSource.minSeconds, 0, 3600, defaults.randomWatch.minSeconds);
  const maxSeconds = Math.max(minSeconds, numberIn(randomSource.maxSeconds, 0, 3600, defaults.randomWatch.maxSeconds));

  return {
    schema: SETTINGS_SCHEMA,
    masterEnabled: bool(source.masterEnabled, defaults.masterEnabled),
    adSkip: {
      enabled: bool(adSkipSource.enabled, defaults.adSkip.enabled),
      minDelay,
      maxWait,
    },
    randomWatch: {
      mode: oneOf(randomSource.mode, RANDOM_MODES, defaults.randomWatch.mode),
      minSeconds,
      maxSeconds,
    },
    queue: {
      shuffle: bool(queueSource.shuffle, defaults.queue.shuffle),
      loop: oneOf(queueSource.loop, LOOP_MODES, defaults.queue.loop),
      avoidRepeat: numberIn(queueSource.avoidRepeat, 0, 50, defaults.queue.avoidRepeat),
    },
    ui: {
      popupSize: oneOf(uiSource.popupSize, POPUP_SIZES, defaults.ui.popupSize),
    },
    sleepTimer: {
      mode: oneOf(sleepSource.mode, SLEEP_MODES, defaults.sleepTimer.mode),
      minutes: numberIn(sleepSource.minutes, 1, 1440, defaults.sleepTimer.minutes),
      tracks: numberIn(sleepSource.tracks, 1, 999, defaults.sleepTimer.tracks),
    },
    diagnostics: {
      verbose: bool(diagnosticsSource.verbose, defaults.diagnostics.verbose),
    },
  };
}

/**
 * Build settings from the flat 3.3.0 storage keys.
 */
export function migrateLegacySettings(flat) {
  const source = flat && typeof flat === 'object' ? flat : {};
  const settings = cloneDefaults();

  if (source.extensionEnabled === false) settings.masterEnabled = false;
  if (source.adSkipEnabled === false) settings.adSkip.enabled = false;
  settings.adSkip.minDelay = numberIn(source.adSkipMinDelay, 0, 60000, settings.adSkip.minDelay);
  settings.adSkip.maxWait = Math.max(
    settings.adSkip.minDelay,
    numberIn(source.adSkipMaxWait, 0, 120000, settings.adSkip.maxWait),
  );
  settings.randomWatch.minSeconds = numberIn(
    source.randomMinSeconds, 0, 3600, settings.randomWatch.minSeconds,
  );
  settings.randomWatch.maxSeconds = Math.max(
    settings.randomWatch.minSeconds,
    numberIn(source.randomMaxSeconds, 0, 3600, settings.randomWatch.maxSeconds),
  );
  if (source.randomEnabled === true) settings.randomWatch.mode = 'queue';
  if (source.shuffleEnabled === true) settings.queue.shuffle = true;
  if (POPUP_SIZES.includes(source.popupSize)) settings.ui.popupSize = source.popupSize;

  return normalizeSettings(settings);
}

/**
 * Flat keys mirrored for tabs that still run the 3.3.0 content script.
 */
export function toLegacySettings(settings) {
  const normalized = normalizeSettings(settings);
  return {
    [LEGACY_KEYS.masterEnabled]: normalized.masterEnabled,
    [LEGACY_KEYS.adSkipEnabled]: normalized.adSkip.enabled,
    [LEGACY_KEYS.adSkipMinDelay]: normalized.adSkip.minDelay,
    [LEGACY_KEYS.adSkipMaxWait]: normalized.adSkip.maxWait,
    [LEGACY_KEYS.randomEnabled]: normalized.randomWatch.mode !== 'off',
    [LEGACY_KEYS.randomMinSeconds]: normalized.randomWatch.minSeconds,
    [LEGACY_KEYS.randomMaxSeconds]: normalized.randomWatch.maxSeconds,
    [LEGACY_KEYS.shuffleEnabled]: normalized.queue.shuffle,
    [LEGACY_KEYS.popupSize]: normalized.ui.popupSize,
  };
}

export function mergeSettings(base, patch) {
  const current = normalizeSettings(base);
  const source = patch && typeof patch === 'object' ? patch : {};
  return normalizeSettings({
    ...current,
    ...source,
    adSkip: { ...current.adSkip, ...(source.adSkip || {}) },
    randomWatch: { ...current.randomWatch, ...(source.randomWatch || {}) },
    queue: { ...current.queue, ...(source.queue || {}) },
    ui: { ...current.ui, ...(source.ui || {}) },
    sleepTimer: { ...current.sleepTimer, ...(source.sleepTimer || {}) },
    diagnostics: { ...current.diagnostics, ...(source.diagnostics || {}) },
  });
}

/**
 * Persist settings and the legacy mirror.
 */
export async function persistSettings(settings) {
  const normalized = normalizeSettings(settings);
  await storageSet({
    [SETTINGS_KEY]: normalized,
    settingsSchemaVersion: SETTINGS_SCHEMA,
    ...toLegacySettings(normalized),
  });
  return normalized;
}

/**
 * Load settings, migrating 3.3.0 flat keys on first use.
 */
export async function loadSettings() {
  const legacyValues = Object.values(LEGACY_KEYS);
  const stored = await storageGet([SETTINGS_KEY, ...legacyValues]);

  if (!stored[SETTINGS_KEY] || typeof stored[SETTINGS_KEY] !== 'object') {
    return persistSettings(migrateLegacySettings(stored));
  }

  const normalized = normalizeSettings(stored[SETTINGS_KEY]);
  if (JSON.stringify(normalized) !== JSON.stringify(stored[SETTINGS_KEY])) {
    return persistSettings(normalized);
  }
  return normalized;
}

/**
 * Merge a partial patch into the stored settings and persist the result.
 */
export async function saveSettings(patch) {
  const current = await loadSettings();
  return persistSettings(mergeSettings(current, patch));
}

export function exportSettingsPayload(settings) {
  return {
    schema: SETTINGS_SCHEMA,
    exportedAt: Date.now(),
    settings: normalizeSettings(settings),
  };
}

/**
 * Validate an imported payload. Returns normalized settings or null.
 */
export function importSettingsPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const candidate = payload.settings && typeof payload.settings === 'object'
    ? payload.settings
    : payload;
  if (!candidate || typeof candidate !== 'object') return null;
  return normalizeSettings(candidate);
}
