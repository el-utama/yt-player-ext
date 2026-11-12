const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const popupHtml = read('popup.html');
const popupJs = read('popup.js');
const contentJs = read('content.js');
const backgroundJs = read('background.js');
const stylesCss = read('styles.css');

function extensionEnabled(storage) {
  return storage.extensionEnabled !== false;
}

function badgeFor(enabled) {
  return enabled ? { text: '', color: '#555555' } : { text: 'OFF', color: '#d93025' };
}

test('manifest version and MV3 action are present', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, '3.2.7');
  assert.ok(manifest.action, 'manifest.action must exist for badge support');
});

test('popup exposes a persistent global switch', () => {
  assert.match(popupHtml, /id="extensionEnabled"/);
  assert.match(popupHtml, /id="extensionEnabledLabel"/);
  assert.match(popupJs, /storageSet\(\{ extensionEnabled: enabled, autoSelectNeeded: false \}\)/);
  assert.match(popupJs, /extensionEnabled\.addEventListener\('change'/);
  assert.match(popupJs, /applyExtensionEnabled\(enabled !== false, false\)/);
  assert.match(stylesCss, /\.switch-slider/);
});

test('switch defaults to enabled and disabled storage turns automation off', () => {
  assert.equal(extensionEnabled({}), true);
  assert.equal(extensionEnabled({ extensionEnabled: true }), true);
  assert.equal(extensionEnabled({ extensionEnabled: false }), false);
  assert.match(contentJs, /enabled: false/);
  assert.match(contentJs, /state\.enabled = enabledState\.extensionEnabled !== false/);
  assert.match(contentJs, /reportStatus\('disabled', 'Ekstensi nonaktif'\)/);
  assert.match(contentJs, /chrome\.storage\.onChanged\.addListener/);
});

test('content script guards all automation entry points', () => {
  assert.match(contentJs, /if \(!state\.enabled \|\| !video/);
  assert.match(contentJs, /if \(!state\.enabled\) return false;/);
  assert.match(contentJs, /if \(!state\.enabled\) return;/);
  assert.match(contentJs, /if \(!state\.enabled \|\| token !== state\.navigationToken/);
  assert.match(contentJs, /error: 'extension-disabled'/);
});

test('background rejects commands while disabled and cancels queued navigation', () => {
  assert.match(backgroundJs, /async function isExtensionEnabled\(\)/);
  assert.match(backgroundJs, /if \(!await isExtensionEnabled\(\)\)/);
  assert.match(backgroundJs, /error: 'extension-disabled'/);
  assert.match(backgroundJs, /if \(!await isExtensionEnabled\(\)\) return;/);
});

test('badge state is deterministic', () => {
  assert.deepEqual(badgeFor(true), { text: '', color: '#555555' });
  assert.deepEqual(badgeFor(false), { text: 'OFF', color: '#d93025' });
  assert.match(backgroundJs, /chrome\.action\.setBadgeText/);
  assert.match(backgroundJs, /chrome\.action\.setBadgeBackgroundColor/);
  assert.match(backgroundJs, /changes\.extensionEnabled\.newValue !== false/);
});

test('search selection and autoplay controls are fail-closed', () => {
  assert.match(contentJs, /if \(!state\.enabled \|\| !window\.location\.pathname\.includes\('\/watch'\)\) return;/);
  assert.match(contentJs, /playPause: 'ytmusic-player-bar #play-pause-button, ytmusic-player-bar \.play-pause-button/);
  assert.doesNotMatch(contentJs, /ytmusic-player-bar button\[aria-label\], ytmusic-player-bar \[role="button"\]\[aria-label\]/);
  assert.match(contentJs, /const eligibleCandidates = candidates\.filter/);
  assert.match(contentJs, /match\.titleMatches === match\.titleCount/);
  assert.match(contentJs, /titleExact = Boolean\(parsed\.title && candidate\.includes\(parsed\.title\)\)/);
  assert.match(contentJs, /tokens\.some\(\(token\) => candidate\.includes\(token\)\)/);
  assert.match(contentJs, /if \(best && attempts >= 4\)/);
  assert.match(contentJs, /if \(!container\) return null;/);
  assert.match(contentJs, /ytmusic-card-shelf-renderer/);
  assert.match(contentJs, /top_result_play/);
  assert.match(contentJs, /else best\.playButton\?\.click\(\)/);
  assert.match(contentJs, /function findPlayControl\(\)/);
  assert.match(contentJs, /ytmusic-player-bar button, ytmusic-player-bar \[role="button"\]/);
  assert.match(contentJs, /reportStatus\('play_control_not_found'\)/);
});

console.log('Extension toggle regression tests loaded. Run with: node --test tests/extension-toggle.test.js');
