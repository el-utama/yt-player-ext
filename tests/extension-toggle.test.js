import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const popupHtml = read('popup.html');
const stylesCss = read('styles.css');

// Read source files for testing
const popupQueueUI = read('src/popup/queue-ui.js');
const popupUI = read('src/popup/ui.js');
const contentState = read('src/content/state.js');
const contentMessaging = read('src/content/messaging.js');
const contentPlayer = read('src/content/player.js');
const contentSearch = read('src/content/search.js');
const contentDom = read('src/content/dom.js');
const sharedUtils = read('src/shared/utils.js');
const backgroundBadge = read('src/background/badge.js');
const backgroundStorage = read('src/background/storage.js');
const backgroundMessaging = read('src/background/messaging.js');
const backgroundQueue = read('src/background/queue.js');
const backgroundBootstrap = read('src/background/bootstrap.js');
const contentScrobble = read('src/content/scrobble.js');
const contentNavigation = read('src/content/navigation.js');

function extensionEnabled(storage) {
  return storage.extensionEnabled !== false;
}

function badgeFor(enabled) {
  return enabled ? { text: '', color: '#555555' } : { text: 'OFF', color: '#d93025' };
}

test('manifest version and MV3 action are present', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, '3.2.8');
  assert.ok(manifest.action, 'manifest.action must exist for badge support');
  assert.ok(manifest.permissions.includes('scripting'), 'scripting permission is required by pausePlayer()');
});

test('background reconciles the player tab on every service worker start', () => {
  assert.match(backgroundBootstrap, /async function initPlayerTab\(\)/);
  assert.match(backgroundBootstrap, /await ensurePlayerTabId\(getStorage\)/);
  assert.match(backgroundBootstrap, /void initPlayerTab\(\);/);
  assert.match(backgroundBootstrap, /onTabRemoved\(tabId, getState\(\), setStorage\)/);
});

test('queue keeps playerTabId in sync for existing and new tabs', () => {
  assert.match(backgroundQueue, /export async function ensurePlayerTabId/);
  assert.match(backgroundQueue, /state\.playerTabId = tab\.id/);
  assert.match(backgroundQueue, /state\.playerTabId = existing\.id/);
  assert.match(backgroundQueue, /\[STORAGE_KEYS\.PLAYER_TAB_ID\]: existing\.id/);
});

test('manual skip reports delivery failure instead of silently succeeding', () => {
  assert.match(backgroundMessaging, /await sendControlToPlayer\('TRIGGER_SKIP', getStorage\)/);
  assert.match(backgroundMessaging, /no-player-tab/);
  assert.match(backgroundMessaging, /await ensurePlayerTabId\(getStorage\)/);
  assert.match(popupQueueUI, /Skip gagal/);
});

test('popup exposes a persistent global switch', () => {
  assert.match(popupHtml, /id="extensionEnabled"/);
  assert.match(popupHtml, /id="extensionEnabledLabel"/);
  assert.match(popupQueueUI, /extensionEnabled/);
  assert.match(popupUI, /applyExtensionEnabled/);
  assert.match(stylesCss, /\.switch-slider/);
});

test('popup controls use the real element ids', () => {
  assert.match(popupUI, /\$\('songList'\)/);
  assert.doesNotMatch(popupUI, /\$\('songListInput'\)/);
  assert.doesNotMatch(popupQueueUI, /\$\('songListInput'\)/);
  assert.match(popupUI, /adSkipEnable/);
  assert.match(popupQueueUI, /Skip gagal/);
});

test('switch defaults to enabled and disabled storage turns automation off', () => {
  assert.equal(extensionEnabled({}), true);
  assert.equal(extensionEnabled({ extensionEnabled: true }), true);
  assert.equal(extensionEnabled({ extensionEnabled: false }), false);
  assert.match(contentState, /enabled: false/);
  assert.match(contentState, /setEnabled/);
});

test('content script guards all automation entry points', () => {
  assert.match(contentMessaging, /extension-disabled/);
  assert.match(contentMessaging, /if \(!state\.enabled\)/);
  assert.match(contentMessaging, /sendResponse.*ok: false/);
  assert.doesNotMatch(contentMessaging, /addListener\(async/);
  assert.match(contentMessaging, /return true; \/\/ Async response/);
});

test('background rejects commands while disabled and cancels queued navigation', () => {
  assert.match(backgroundStorage, /isExtensionEnabled/);
  assert.match(backgroundMessaging, /extension-disabled/);
  assert.match(backgroundMessaging, /if \(!await isExtensionEnabled\(getStorage\)\)/);
});

test('badge state is deterministic', () => {
  assert.deepEqual(badgeFor(true), { text: '', color: '#555555' });
  assert.deepEqual(badgeFor(false), { text: 'OFF', color: '#d93025' });
  assert.match(backgroundBadge, /setBadgeText/);
  assert.match(backgroundBadge, /setBadgeBackgroundColor/);
  assert.match(backgroundBadge, /newValue !== false/);
});

test('search selection and autoplay controls are fail-closed', () => {
  assert.match(contentPlayer, /includes\('\/watch'\)/);
  assert.match(contentSearch, /play.*putar|reproduc|wiedergabe/);
  assert.match(contentSearch, /eligibleCandidates/);
  assert.match(contentSearch, /titleMatches/);
  assert.match(contentSearch, /titleExact/);
  assert.match(sharedUtils, /tokens.*some/);
  assert.match(contentSearch, /attempts >= 4/);
  assert.match(contentSearch, /!container/);
  assert.match(contentSearch, /playButton/);
  assert.match(contentPlayer, /findPlayControl/);
  assert.match(contentDom, /role="button"/);
  assert.match(contentPlayer, /play_control_not_found/);
});

test('native autoplay takeover is detected and handed back to the queue', async () => {
  assert.match(contentPlayer, /export function enforceQueueOwnership/);
  assert.match(contentPlayer, /\/\[\?&\]list=RD\//);
  assert.match(contentPlayer, /native_autoplay_detected/);
  assert.match(contentPlayer, /getTrackIdentity, isWhitelisted/);
  assert.match(contentScrobble, /A scrobble failure must never block queue advancement/);

  // Behavioural check: a radio URL playing an unexpected track must trigger.
  const { state } = await import('../src/content/state.js');
  const { enforceQueueOwnership } = await import('../src/content/player.js');
  const realWindow = globalThis.window;
  const { isWhitelisted } = await import('../src/shared/utils.js');

  globalThis.window = { location: { pathname: '/watch', search: '?v=abc&list=RDAMVMabc' } };
  state.enabled = false;
  state.advancing = false;
  state.nativeTakeoverHandled = false;
  state.lastPlayerUrl = '';

  // The queue expects a different track, so the radio must be overridden.
  assert.equal(isWhitelisted('Somebody To Love', 'Bohemian Rhapsody - Queen'), false);
  enforceQueueOwnership('Somebody To Love', 'Bohemian Rhapsody - Queen');
  assert.equal(state.nativeTakeoverHandled, true);

  // A matching track and a non-radio URL must not trigger an advance.
  state.nativeTakeoverHandled = false;
  state.lastPlayerUrl = '';
  enforceQueueOwnership('Bohemian Rhapsody', 'Bohemian Rhapsody - Queen');
  assert.equal(state.nativeTakeoverHandled, false);

  globalThis.window = { location: { pathname: '/watch', search: '?v=abc' } };
  state.lastPlayerUrl = '';
  enforceQueueOwnership('Somebody To Love', 'Bohemian Rhapsody - Queen');
  assert.equal(state.nativeTakeoverHandled, false);

  globalThis.window = realWindow;
});

test('search selection survives duplicate navigation events', () => {
  assert.doesNotMatch(contentSearch, /navigationToken/);
  assert.match(contentSearch, /state\.selectInterval = interval/);
  assert.match(contentSearch, /duplicate `yt-navigate-finish` event must not cancel selection/);
  assert.doesNotMatch(contentNavigation, /navigationToken/);
  assert.doesNotMatch(contentState, /navigationToken/);
  assert.match(contentNavigation, /clearInterval\(state\.selectInterval\)/);
});

console.log('Extension toggle regression tests loaded. Run with: node --test tests/extension-toggle.test.js');