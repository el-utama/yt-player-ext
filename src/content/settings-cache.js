// Content Settings Cache - Apply the shared settings object to content state
//
// The content script runs on YouTube Music pages and must not query storage on
// every 500 ms tick. Settings are loaded once, then refreshed whenever the
// background/options page writes the `settings` key.

import { state, setEnabled, resetScrollSimulationTimer } from './state.js';
import { loadSettings, normalizeSettings, SETTINGS_KEY } from '../shared/settings.js';

/**
 * Copy a validated settings object into the content-script state cache.
 * Returns true when the master switch changed.
 */
export function applySettings(settings) {
  const normalized = normalizeSettings(settings);
  const wasEnabled = state.enabled;

  const prevRandomMode = state.randomWatchMode;
  const prevMin = state.randomMinSeconds;
  const prevMax = state.randomMaxSeconds;

  const prevScrollSimEnabled = state.scrollSimulationEnabled;
  const prevScrollSimMin = state.scrollSimMinMinutes;
  const prevScrollSimMax = state.scrollSimMaxMinutes;

  state.settings = normalized;
  state.settingsReady = true;

  state.adSkipEnabled = normalized.adSkip.enabled;
  state.adSkipMinDelay = normalized.adSkip.minDelay;
  state.adSkipMaxWait = Math.max(normalized.adSkip.minDelay, normalized.adSkip.maxWait);

  state.randomWatchMode = normalized.randomWatch.mode;
  state.randomEnabled = normalized.randomWatch.mode !== 'off';
  state.randomMinSeconds = normalized.randomWatch.minSeconds;
  state.randomMaxSeconds = normalized.randomWatch.maxSeconds;

  state.loopMode = normalized.queue.loop;
  state.shuffleEnabled = normalized.queue.shuffle;
  state.enforceQueue = normalized.queue.enforceQueue ?? true;

  // Scroll simulation settings
  state.scrollSimulationEnabled = normalized.scrollSimulation.enabled;
  state.scrollSimMinMinutes = normalized.scrollSimulation.minMinutes;
  state.scrollSimMaxMinutes = normalized.scrollSimulation.maxMinutes;
  state.scrollSimDurationSeconds = normalized.scrollSimulation.durationSeconds;
  state.scrollSimIntervalMs = normalized.scrollSimulation.scrollIntervalMs;
  state.scrollSimScrollAmountPx = normalized.scrollSimulation.scrollAmountPx;

  setEnabled(normalized.masterEnabled !== false);

  // If random settings changed while a track is playing, recompute target
  const randomChanged = prevRandomMode !== state.randomWatchMode
    || prevMin !== state.randomMinSeconds
    || prevMax !== state.randomMaxSeconds;
  if (randomChanged && state.randomEnabled) {
    import('./state.js').then(({ refreshRandomTarget }) => refreshRandomTarget());
  }

  // If scroll simulation settings changed, reset timer
  const scrollSimChanged = prevScrollSimEnabled !== state.scrollSimulationEnabled
    || prevScrollSimMin !== state.scrollSimMinMinutes
    || prevScrollSimMax !== state.scrollSimMaxMinutes;
  if (scrollSimChanged) {
    resetScrollSimulationTimer();
  }

  return wasEnabled !== state.enabled;
}

/**
 * Load settings from storage and apply them.
 */
export async function initSettings() {
  const settings = await loadSettings();
  applySettings(settings);
  return settings;
}

/**
 * Subscribe to settings and navigation-key changes. `onMasterChange` receives
 * the new enabled flag so the caller can start/stop automation.
 */
export function watchSettings(onMasterChange) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    if (changes[SETTINGS_KEY]) {
      const next = changes[SETTINGS_KEY].newValue;
      const changed = applySettings(next && typeof next === 'object' ? next : {});
      if (changed && typeof onMasterChange === 'function') onMasterChange(state.enabled);
    }

    if (changes.currentExpectedQuery) {
      state.expectedQuery = typeof changes.currentExpectedQuery.newValue === 'string'
        ? changes.currentExpectedQuery.newValue
        : '';
      state.playbackMode = state.expectedQuery ? 'extension' : 'native';
    }

    if (changes.currentSessionId) {
      state.currentSessionId = typeof changes.currentSessionId.newValue === 'string'
        ? changes.currentSessionId.newValue
        : '';
    }
  });
}

/**
 * Seed navigation keys from storage once at startup.
 */
export async function initNavigationState(getStorageFn) {
  const data = await getStorageFn(['currentExpectedQuery', 'currentSessionId']);
  state.expectedQuery = typeof data.currentExpectedQuery === 'string' ? data.currentExpectedQuery : '';
  state.currentSessionId = typeof data.currentSessionId === 'string' ? data.currentSessionId : '';
  state.playbackMode = state.expectedQuery ? 'extension' : 'native';
}
