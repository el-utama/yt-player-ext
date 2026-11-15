// Static checks for popup module wiring: a missing import used to abort the
// whole DOMContentLoaded handler, leaving the queue list empty.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const POPUP_MODULES = [
  'index.js',
  'queue-ui.js',
  'settings.js',
  'master.js',
  'now-playing.js',
  'history-ui.js',
];

const UI_HELPERS = [
  '$',
  'setStatus',
  'applyExtensionEnabled',
  'applyPopupSize',
  'formatSeconds',
  'formatTimestamp',
  'escapeCsvField',
  'escapeHtml',
];

function importedUiHelpers(source) {
  const match = source.match(/import\s*\{([^}]*)\}\s*from\s*'\.\/ui\.js'/);
  return new Set((match?.[1] || '').split(',').map((name) => name.trim()).filter(Boolean));
}

function stripImports(source) {
  return source.replace(/^import[^\n]*\n/gm, '');
}

test('popup modules import every ui helper they call', () => {
  for (const file of POPUP_MODULES) {
    const source = read(`src/popup/${file}`);
    const imported = importedUiHelpers(source);
    const body = stripImports(source);

    for (const helper of UI_HELPERS) {
      const escaped = helper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const callPattern = new RegExp(`(^|[^A-Za-z0-9_$])${escaped}\\(`, 'm');
      if (callPattern.test(body)) {
        assert.ok(
          imported.has(helper),
          `src/popup/${file} calls ${helper}() without importing it from ./ui.js`,
        );
      }
    }
  }
});

test('popup entry wires the refresh button with an available helper', () => {
  const source = read('src/popup/index.js');
  assert.match(source, /import\s*\{[^}]*\$[^}]*\}\s*from\s*'\.\/ui\.js'/);
  assert.match(source, /\$\('refreshBtn'\)/);
});

test('queue editor can apply the extension-enabled UI state', () => {
  const source = read('src/popup/queue-ui.js');
  assert.match(source, /import\s*\{[^}]*applyExtensionEnabled[^}]*\}\s*from\s*'\.\/ui\.js'/);
});
