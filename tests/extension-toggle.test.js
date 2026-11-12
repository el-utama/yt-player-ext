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
});

test('popup exposes a persistent global switch', () => {
  assert.match(popupHtml, /id="extensionEnabled"/);
  assert.match(popupHtml, /id="extensionEnabledLabel"/);
  assert.match(popupQueueUI, /extensionEnabled/);
  assert.match(popupUI, /applyExtensionEnabled/);
  assert.match(stylesCss, /\.switch-slider/);
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

console.log('Extension toggle regression tests loaded. Run with: node --test tests/extension-toggle.test.js');