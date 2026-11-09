#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const process = require('node:process');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_QUERY = 'Daft Punk Get Lucky';
const DEFAULT_REPORT = path.join(ROOT, '.work', 'dom-audit', 'latest.json');
const DEFAULT_SCREENSHOT_DIR = path.join(ROOT, '.work', 'dom-audit', 'screenshots');

const SELECTOR_CATALOG = {
  resultPlayButton: [
    'ytmusic-responsive-list-item-renderer .play-button',
    'ytmusic-responsive-list-item-renderer [aria-label*="Play"]',
    'ytmusic-responsive-list-item-renderer button[aria-label*="play" i]'
  ],
  playerTitle: [
    '.title.ytmusic-player-bar',
    'ytmusic-player-bar .title',
    'ytmusic-player-bar [class*="title"]'
  ],
  autoplay: [
    'ytmusic-player-bar [aria-label*="Autoplay" i]',
    'ytmusic-player-bar .toggle.ytmusic-player-bar',
    'ytmusic-player-bar [role="switch"][aria-label*="auto" i]'
  ],
  adMarkers: [
    '.ad-showing',
    '.ad-interrupting',
    '.ytp-ad-player-overlay',
    '.ytp-ad-text',
    '[class*="ad-showing" i]',
    '[class*="ad-interrupting" i]'
  ],
  video: ['video']
};

function parseArgs(argv) {
  const args = {
    query: DEFAULT_QUERY,
    url: 'https://music.youtube.com',
    report: DEFAULT_REPORT,
    screenshotDir: DEFAULT_SCREENSHOT_DIR,
    headed: false,
    timeout: 30000,
    wait: 5000,
    screenshotOnFailure: true,
    userDataDir: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--query' && next) args.query = next, i += 1;
    else if (arg === '--url' && next) args.url = next, i += 1;
    else if (arg === '--report' && next) args.report = path.resolve(next), i += 1;
    else if (arg === '--screenshot-dir' && next) args.screenshotDir = path.resolve(next), i += 1;
    else if (arg === '--timeout' && next) args.timeout = Number(next), i += 1;
    else if (arg === '--wait' && next) args.wait = Number(next), i += 1;
    else if (arg === '--headed') args.headed = true;
    else if (arg === '--no-screenshot') args.screenshotOnFailure = false;
    else if (arg === '--user-data-dir' && next) args.userDataDir = path.resolve(next), i += 1;
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/ytmusic-dom-audit.js [options]\n\nOptions:\n  --query <text>             Search query used for the search-page probe\n  --url <url>                Base URL, default https://music.youtube.com\n  --report <path>            JSON report path\n  --screenshot-dir <path>    Failure screenshot directory\n  --timeout <ms>             Navigation timeout, default 30000\n  --wait <ms>                Post-navigation wait, default 5000\n  --headed                  Show the browser window\n  --user-data-dir <path>    Isolated Puppeteer profile directory\n  --no-screenshot            Disable failure screenshots\n`);
      process.exit(0);
    }
  }
  if (!Number.isFinite(args.timeout) || args.timeout < 1000) throw new Error('--timeout must be at least 1000');
  if (!Number.isFinite(args.wait) || args.wait < 0) throw new Error('--wait must be non-negative');
  return args;
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function collectDomProbe(page) {
  return page.evaluate((catalog) => {
    const count = (selector) => {
      try { return document.querySelectorAll(selector).length; } catch { return -1; }
    };
    const firstText = (selector) => document.querySelector(selector)?.textContent?.trim().slice(0, 300) || null;
    const matched = {};
    for (const [name, selectors] of Object.entries(catalog)) {
      matched[name] = selectors.map((selector) => ({
        selector,
        count: count(selector),
        sampleText: firstText(selector)
      }));
    }

    const classNames = [...document.querySelectorAll('ytmusic-player-bar, video, [class*="ad" i]')]
      .slice(0, 150)
      .map((node) => ({ tag: node.tagName, className: String(node.className || '').slice(0, 300) }));
    const visibleText = document.body?.innerText?.slice(0, 2000) || '';
    const hasLoginOrConsent = /sign in|choose an account|consent|accept all/i.test(visibleText);
    const video = document.querySelector('video');

    return {
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      matched,
      classNames,
      visibleText,
      hasLoginOrConsent,
      video: video ? {
        paused: video.paused,
        ended: video.ended,
        currentTime: video.currentTime,
        duration: video.duration,
        readyState: video.readyState
      } : null
    };
  }, SELECTOR_CATALOG);
}

function chooseFirstMatch(probe, name) {
  const matches = probe.matched[name] || [];
  return matches.find((item) => item.count > 0) || null;
}

function evaluateProbe(name, probe, pageKind) {
  const match = chooseFirstMatch(probe, name);
  const isSearch = pageKind === 'search';
  const isPlayer = pageKind === 'player';
  const required = (name === 'resultPlayButton' && isSearch)
    || (name === 'playerTitle' && isPlayer)
    || (name === 'video' && isPlayer);
  const warningOnly = name === 'autoplay' || name === 'adMarkers';

  if (required && !match) return { status: 'fail', reason: `${name} tidak ditemukan` };
  if (!required && !match && !warningOnly) return { status: 'skip', reason: `${name} tidak diperlukan pada halaman ${pageKind}` };
  if (!match && warningOnly) return { status: 'warn', reason: `${name} belum terdeteksi; selector atau state halaman mungkin berubah` };
  return { status: 'pass', selector: match.selector, count: match.count };
}

async function probePage(page, pageKind, url, args) {
  const result = { pageKind, url, loaded: false, probe: null, checks: [], error: null };
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: args.timeout });
    await new Promise((resolve) => setTimeout(resolve, args.wait));
    result.loaded = true;
    result.probe = await collectDomProbe(page);
    for (const name of Object.keys(SELECTOR_CATALOG)) {
      result.checks.push({ name, ...evaluateProbe(name, result.probe, pageKind) });
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }
  return result;
}

async function findFirstWatchUrl(page, searchUrl, args) {
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: args.timeout });
  await new Promise((resolve) => setTimeout(resolve, args.wait));
  return page.evaluate(() => {
    const candidates = [...document.querySelectorAll('a[href*="/watch"], ytmusic-responsive-list-item-renderer a')];
    const anchor = candidates.find((element) => element.href && /\/watch/.test(element.href));
    return anchor?.href || null;
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const browser = await puppeteer.launch({
    headless: !args.headed,
    userDataDir: args.userDataDir || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(args.timeout);
  const searchUrl = `${args.url.replace(/\/$/, '')}/search?q=${encodeURIComponent(args.query)}`;
  const report = {
    startedAt,
    finishedAt: null,
    query: args.query,
    baseUrl: args.url,
    searchUrl,
    selectorCatalog: SELECTOR_CATALOG,
    probes: [],
    summary: { pass: 0, warn: 0, fail: 0 },
    exitCode: 0
  };

  try {
    report.probes.push(await probePage(page, 'home', args.url, args));
    report.probes.push(await probePage(page, 'search', searchUrl, args));

    let watchUrl = null;
    try { watchUrl = await findFirstWatchUrl(page, searchUrl, args); } catch (error) {
      report.probes.push({ pageKind: 'player', loaded: false, error: `Gagal menemukan watch URL: ${error.message}` });
    }
    if (watchUrl) report.probes.push(await probePage(page, 'player', watchUrl, args));
    else report.probes.push({ pageKind: 'player', loaded: false, skipped: true, reason: 'Tidak ada link /watch pada hasil search' });

    for (const probe of report.probes) {
      for (const check of probe.checks || []) {
        if (check.status === 'pass') report.summary.pass += 1;
        else if (check.status === 'warn') report.summary.warn += 1;
        else if (check.status === 'fail') report.summary.fail += 1;
      }
      if (probe.error) report.summary.fail += 1;
    }

    if (args.screenshotOnFailure && report.summary.fail > 0) {
      await fs.mkdir(args.screenshotDir, { recursive: true });
      const screenshot = path.join(args.screenshotDir, `failure-${Date.now()}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      report.failureScreenshot = screenshot;
    }
    report.exitCode = report.summary.fail > 0 ? 2 : report.summary.warn > 0 ? 1 : 0;
  } finally {
    report.finishedAt = new Date().toISOString();
    await ensureDir(args.report);
    await fs.writeFile(args.report, JSON.stringify(report, null, 2), 'utf8');
    await browser.close();
  }

  console.log(JSON.stringify({ report: args.report, summary: report.summary, exitCode: report.exitCode }, null, 2));
  process.exitCode = report.exitCode;
}

main().catch(async (error) => {
  console.error(error.stack || error);
  process.exitCode = 2;
});
