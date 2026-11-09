const PLAYER_ORIGIN = 'https://music.youtube.com';
const state = {
  playerTabId: null,
  transitionPromise: Promise.resolve()
};

const storageGet = (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve));
const storageSet = (values) => new Promise((resolve) => chrome.storage.local.set(values, resolve));

function isPlayerSender(sender) {
  return Boolean(
    sender?.tab?.id &&
    sender.tab.id === state.playerTabId &&
    typeof sender.tab.url === 'string' &&
    sender.tab.url.startsWith(PLAYER_ORIGIN)
  );
}

function normalizeQueue(queue) {
  return Array.isArray(queue)
    ? queue.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : [];
}

function qualifiedSearchQuery(query) {
  return query.trim();
}

async function reconcilePlayerTab() {
  const saved = await storageGet(['playerTabId']);
  const candidateId = Number.isInteger(saved.playerTabId) ? saved.playerTabId : null;

  if (candidateId !== null) {
    const tab = await new Promise((resolve) => chrome.tabs.get(candidateId, (result) => {
      resolve(chrome.runtime.lastError ? null : result);
    }));
    if (tab?.url?.startsWith(PLAYER_ORIGIN)) {
      state.playerTabId = tab.id;
      return tab;
    }
  }

  const tabs = await new Promise((resolve) => chrome.tabs.query({ url: `${PLAYER_ORIGIN}/*` }, resolve));
  const existing = tabs.find((tab) => Number.isInteger(tab.id));
  state.playerTabId = existing?.id ?? null;
  await storageSet({ playerTabId: state.playerTabId });
  return existing || null;
}

async function getOrCreatePlayerTab() {
  const existing = await reconcilePlayerTab();
  if (existing) return existing;

  const tab = await new Promise((resolve) => chrome.tabs.create({
    url: PLAYER_ORIGIN,
    active: true
  }, resolve));
  state.playerTabId = tab.id;
  await storageSet({ playerTabId: state.playerTabId });
  return tab;
}

async function playTrackAtIndex(index) {
  const data = await storageGet(['queue']);
  const queue = normalizeQueue(data.queue);
  if (!Number.isInteger(index) || index < 0 || index >= queue.length) {
    await storageSet({ playbackStatus: 'idle', currentIndex: null });
    return;
  }

  const rawQuery = queue[index];
  const sessionId = `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
  await storageSet({
    queue,
    currentIndex: index,
    currentExpectedQuery: rawQuery,
    currentSessionId: sessionId,
    autoSelectNeeded: true,
    playbackStatus: 'loading'
  });

  const tab = await getOrCreatePlayerTab();
  await new Promise((resolve) => chrome.tabs.update(tab.id, {
    url: `${PLAYER_ORIGIN}/search?q=${encodeURIComponent(qualifiedSearchQuery(rawQuery))}`,
    active: true
  }, resolve));
}

function enqueueTransition(task) {
  state.transitionPromise = state.transitionPromise
    .catch(() => undefined)
    .then(task);
  return state.transitionPromise;
}

function nextTrack() {
  return enqueueTransition(async () => {
    const data = await storageGet(['currentIndex']);
    const currentIndex = Number.isInteger(data.currentIndex) ? data.currentIndex : -1;
    await playTrackAtIndex(currentIndex + 1);
  });
}

function previousTrack() {
  return enqueueTransition(async () => {
    const data = await storageGet(['currentIndex']);
    const currentIndex = Number.isInteger(data.currentIndex) ? data.currentIndex : 0;
    await playTrackAtIndex(currentIndex - 1);
  });
}

function sendControlToPlayer(action) {
  if (!state.playerTabId) return;
  chrome.tabs.sendMessage(state.playerTabId, { action }, () => {
    void chrome.runtime.lastError;
  });
}

function isValidTrackInfo(trackInfo) {
  return Boolean(
    trackInfo &&
    typeof trackInfo.title === 'string' && trackInfo.title.length > 0 && trackInfo.title.length <= 500 &&
    typeof trackInfo.url === 'string' && trackInfo.url.startsWith(PLAYER_ORIGIN) &&
    Number.isFinite(trackInfo.timestamp) &&
    typeof trackInfo.sessionId === 'string' && trackInfo.sessionId.length <= 120
  );
}

async function saveScrobble(trackInfo) {
  if (!isValidTrackInfo(trackInfo)) return false;
  const data = await storageGet(['scrobbleHistory']);
  const history = Array.isArray(data.scrobbleHistory) ? data.scrobbleHistory : [];
  if (history.some((item) => item?.sessionId === trackInfo.sessionId)) return true;

  history.push({
    title: trackInfo.title.trim(),
    url: trackInfo.url,
    timestamp: trackInfo.timestamp,
    sessionId: trackInfo.sessionId
  });
  await storageSet({ scrobbleHistory: history.slice(-1000) });
  return true;
}

chrome.runtime.onInstalled.addListener(() => {
  void reconcilePlayerTab();
});

chrome.runtime.onStartup.addListener(() => {
  void reconcilePlayerTab();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === state.playerTabId) {
    state.playerTabId = null;
    void storageSet({ playerTabId: null, playbackStatus: 'idle' });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const action = message?.action;
  const contentActions = new Set(['TRACK_ENDED', 'NEXT_TRACK', 'SCROBBLE', 'PLAYBACK_STATUS', 'CONTENT_READY']);
  if (contentActions.has(action) && !isPlayerSender(sender)) {
    sendResponse({ ok: false, error: 'untrusted-sender' });
    return false;
  }

  (async () => {
    switch (action) {
      case 'START_PLAYLIST':
        await enqueueTransition(() => playTrackAtIndex(0));
        break;
      case 'TRACK_ENDED':
      case 'NEXT_TRACK':
        await nextTrack();
        break;
      case 'PREV_TRACK':
        await previousTrack();
        break;
      case 'TOGGLE_PLAY':
        sendControlToPlayer('TOGGLE_PLAY');
        break;
      case 'MANUAL_SKIP':
        sendControlToPlayer('TRIGGER_SKIP');
        break;
      case 'SCROBBLE':
        if (!await saveScrobble(message.trackInfo)) {
          sendResponse({ ok: false, error: 'invalid-track-info' });
          return;
        }
        break;
      case 'PLAYBACK_STATUS':
        if (typeof message.status !== 'string' || message.status.length > 80) {
          sendResponse({ ok: false, error: 'invalid-status' });
          return;
        }
        await storageSet({
          playbackStatus: message.status,
          playbackDetails: typeof message.details === 'string' ? message.details.slice(0, 300) : ''
        });
        break;
      case 'CONTENT_READY':
        await storageSet({ playbackStatus: 'content_ready', playbackDetails: sender.tab.url || '' });
        break;
      case 'GET_STATE':
        sendResponse(await storageGet(['queue', 'currentIndex', 'playbackStatus', 'scrobbleHistory']));
        return;
      default:
        sendResponse({ ok: false, error: 'unknown-action' });
        return;
    }
    sendResponse({ ok: true });
  })().catch((error) => sendResponse({ ok: false, error: String(error) }));

  return true;
});

void reconcilePlayerTab();
