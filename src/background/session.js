// Background Watch Session - Track eligible playback duration per artist per tab session.
//
// A "session" is the lifetime of one YouTube Music tab. When a tab opens, a new
// session entry is created. Eligible playback seconds (not paused, no ad) are
// accumulated per artist. When the tab is closed, session data is merged into
// all-time totals and the session entry is removed.

import { STORAGE_KEYS } from './storage.js';
import { getStorage, setStorage } from './storage.js';

// In-memory cache of active sessions: tabId -> { startedAt, artists: { name: seconds } }
const activeSessions = new Map();

/**
 * Start a watch session for a tab. Called when the content script initializes.
 */
export async function startWatchSession(tabId) {
  if (activeSessions.has(tabId)) return;

  const data = await getStorage([STORAGE_KEYS.WATCH_SESSION]);
  const sessions = data[STORAGE_KEYS.WATCH_SESSION] || {};

  if (!sessions[tabId]) {
    sessions[tabId] = {
      startedAt: Date.now(),
      artists: {},
    };
    await setStorage({ [STORAGE_KEYS.WATCH_SESSION]: sessions });
  }

  activeSessions.set(tabId, sessions[tabId]);
}

/**
 * Add eligible playback seconds to an artist in the current tab's session.
 */
export async function addWatchDuration(tabId, artist, seconds) {
  if (!artist || typeof seconds !== 'number' || seconds <= 0) return;

  let session = activeSessions.get(tabId);
  if (!session) {
    const data = await getStorage([STORAGE_KEYS.WATCH_SESSION]);
    const sessions = data[STORAGE_KEYS.WATCH_SESSION] || {};
    session = sessions[tabId];
    if (!session) {
      // Session not found; start a new one.
      session = { startedAt: Date.now(), artists: {} };
    }
    activeSessions.set(tabId, session);
  }

  session.artists[artist] = (session.artists[artist] || 0) + seconds;

  await setStorage({ [STORAGE_KEYS.WATCH_SESSION]: sessionMapToStorage(activeSessions) });
}

/**
 * Get all watch statistics: per-tab sessions and all-time totals.
 */
export async function getWatchStats() {
  const data = await getStorage([
    STORAGE_KEYS.WATCH_SESSION,
    STORAGE_KEYS.WATCH_ALL_TIME,
  ]);

  const sessions = data[STORAGE_KEYS.WATCH_SESSION] || {};
  const allTime = data[STORAGE_KEYS.WATCH_ALL_TIME] || {};

  return { sessions, allTime };
}

/**
 * End a watch session for a tab: merge session artists into all-time, then remove
 * the session entry. Called when the tab is removed.
 */
export async function endWatchSession(tabId) {
  activeSessions.delete(tabId);

  const data = await getStorage([
    STORAGE_KEYS.WATCH_SESSION,
    STORAGE_KEYS.WATCH_ALL_TIME,
  ]);

  const sessions = data[STORAGE_KEYS.WATCH_SESSION] || {};
  const allTime = data[STORAGE_KEYS.WATCH_ALL_TIME] || {};

  const session = sessions[tabId];
  if (session && session.artists) {
    for (const [artist, seconds] of Object.entries(session.artists)) {
      allTime[artist] = (allTime[artist] || 0) + seconds;
    }
  }

  delete sessions[tabId];

  await setStorage({
    [STORAGE_KEYS.WATCH_SESSION]: sessions,
    [STORAGE_KEYS.WATCH_ALL_TIME]: allTime,
  });
}

/**
 * Reset all watch data (sessions + all-time).
 */
export async function resetWatchData() {
  activeSessions.clear();
  await setStorage({
    [STORAGE_KEYS.WATCH_SESSION]: {},
    [STORAGE_KEYS.WATCH_ALL_TIME]: {},
  });
}

/**
 * Convert the in-memory Map to a plain object for storage.
 */
function sessionMapToStorage(sessions) {
  const result = {};
  for (const [tabId, session] of sessions.entries()) {
    result[String(tabId)] = session;
  }
  return result;
}
