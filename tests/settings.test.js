// Regression tests for the shared settings contract between popup/options.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let store = {};
let writeCount = 0;

globalThis.chrome = {
  runtime: { lastError: undefined },
  storage: {
    local: {
      get(keys, callback) {
        if (keys === null || keys === undefined) {
          callback(structuredClone(store));
          return;
        }
        const list = Array.isArray(keys) ? keys : [keys];
        const result = {};
        for (const key of list) {
          if (Object.prototype.hasOwnProperty.call(store, key)) {
            result[key] = structuredClone(store[key]);
          }
        }
        callback(result);
      },
      set(values, callback) {
        writeCount += 1;
        for (const [key, value] of Object.entries(values)) {
          store[key] = structuredClone(value);
        }
        callback();
      },
    },
  },
};

const {
  DEFAULT_SETTINGS,
  loadSettings,
  mergeSettings,
  normalizeSettings,
  saveSettings,
} = await import('../src/shared/settings.js');

beforeEach(() => {
  store = {};
  writeCount = 0;
});

test('normalizeSettings keeps queue.enforceQueue (default and explicit false)', () => {
  assert.equal(normalizeSettings({}).queue.enforceQueue, true);
  assert.equal(normalizeSettings({ queue: { enforceQueue: false } }).queue.enforceQueue, false);
  assert.equal(normalizeSettings({ queue: { enforceQueue: 'yes' } }).queue.enforceQueue, true);
});

test('mergeSettings preserves enforceQueue when patching other queue fields', () => {
  const base = normalizeSettings({ queue: { enforceQueue: false } });
  const merged = mergeSettings(base, { queue: { shuffle: true } });
  assert.equal(merged.queue.enforceQueue, false);
  assert.equal(merged.queue.shuffle, true);
});

test('saveSettings persists the nested object and the legacy mirror', async () => {
  await saveSettings({ adSkip: { enabled: false }, ui: { popupSize: 'large' } });
  const settings = await loadSettings();

  assert.equal(store.settings.adSkip.enabled, false);
  assert.equal(store.settings.ui.popupSize, 'large');
  assert.equal(store.adSkipEnabled, false);
  assert.equal(store.popupSize, 'large');
  assert.equal(settings.ui.popupSize, 'large');
});

test('popup size written by either UI lands in settings.ui and the legacy key', async () => {
  await saveSettings({ ui: { popupSize: 'small' } });
  assert.equal(store.settings.ui.popupSize, 'small');
  assert.equal(store.popupSize, 'small');

  // Legacy-only write from an older popup build must not be lost when the
  // settings object is normalized again.
  const loaded = await loadSettings();
  assert.equal(loaded.ui.popupSize, 'small');
});

test('concurrent patches are serialized instead of overwriting each other', async () => {
  await Promise.all([
    saveSettings({ ui: { popupSize: 'large' } }),
    saveSettings({ queue: { shuffle: true } }),
    saveSettings({ adSkip: { enabled: false } }),
  ]);

  const settings = await loadSettings();
  assert.equal(settings.ui.popupSize, 'large');
  assert.equal(settings.queue.shuffle, true);
  assert.equal(settings.adSkip.enabled, false);
});

test('loadSettings never writes back once the settings object exists', async () => {
  store = {
    settings: {
      schema: 2,
      masterEnabled: true,
      adSkip: { enabled: true, minDelay: 5000, maxWait: 30000 },
      randomWatch: { mode: 'off', minSeconds: 40, maxSeconds: 60 },
      // Unknown field and missing enforceQueue: normalization differs from storage.
      queue: { shuffle: true, loop: 'off', avoidRepeat: 0, legacyExtra: 1 },
      ui: { popupSize: 'large' },
      sleepTimer: { mode: 'off', minutes: 30, tracks: 10 },
      diagnostics: { verbose: false },
    },
  };

  const settings = await loadSettings();
  assert.equal(settings.ui.popupSize, 'large');
  assert.equal(settings.queue.shuffle, true);
  assert.equal(settings.queue.enforceQueue, true);
  assert.equal(writeCount, 0, 'read contexts must not race the background writer');
});

test('loadSettings migrates legacy flat keys on first use', async () => {
  store = {
    extensionEnabled: false,
    adSkipEnabled: false,
    shuffleEnabled: true,
    popupSize: 'small',
    randomEnabled: true,
  };

  const settings = await loadSettings();
  assert.equal(settings.masterEnabled, false);
  assert.equal(settings.adSkip.enabled, false);
  assert.equal(settings.queue.shuffle, true);
  assert.equal(settings.ui.popupSize, 'small');
  assert.equal(settings.randomWatch.mode, 'queue');
  assert.equal(store.settings.schema, DEFAULT_SETTINGS.schema);
  assert.equal(writeCount, 1, 'migration writes exactly once');
});
