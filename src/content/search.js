// Content Search - Search result selection logic

import { SEARCH_RENDERERS } from '../shared/constants.js';
import { storageGet } from './storage.js';
import { scoreSearchResult } from '../shared/utils.js';
import { state } from './state.js';
import { reportStatus } from '../shared/messaging.js';

/**
 * Select first matching track from search results
 */
export async function selectFirstTrack() {
  if (!state.enabled) return;
  if (state.selecting) return;

  state.selecting = true;
  const { currentExpectedQuery } = await storageGet(['currentExpectedQuery']);
  const expectedQuery = currentExpectedQuery || '';

  reportStatus('search_selecting', expectedQuery);
  let attempts = 0;
  if (state.selectInterval) clearInterval(state.selectInterval);

  const interval = setInterval(() => {
    attempts += 1;

    // Only abort when the extension is disabled or we already left the search
    // page. A duplicate `yt-navigate-finish` event must not cancel selection.
    if (!state.enabled || !window.location.pathname.includes('/search')) {
      clearInterval(interval);
      state.selectInterval = null;
      state.selecting = false;
      return;
    }

    const seen = new Set();
    const sources = [
      ...document.querySelectorAll('a[href*="/watch?v="]'),
      ...[...document.querySelectorAll('button, [role="button"]')].filter((button) => {
        const label = [
          button.getAttribute('aria-label'),
          button.getAttribute('title'),
          button.textContent,
        ].filter(Boolean).join(' ');

        return /play|putar|reproduc|wiedergabe|riprodu|æ’­æ”¾|å†ç”Ÿ|ìž¬ìƒ/i.test(label)
          && !/next|previous|save|queue|volume|mute|shuffle|repeat/i.test(label)
          && button.offsetParent !== null;
      }),
    ];

    const candidates = sources
      .map((source) => {
        const isAnchor = source.tagName === 'A';
        const anchor = isAnchor
          ? source
          : source.closest(SEARCH_RENDERERS)?.querySelector('a[href*="/watch?v="]');
        const container = source.closest(SEARCH_RENDERERS) || anchor?.closest(SEARCH_RENDERERS);

        if (!container) return null;

        const href = anchor?.href || '';
        const key = href || container;
        if (seen.has(key)) return null;
        seen.add(key);

        const playButton = isAnchor
          ? [...container.querySelectorAll('button, [role="button"]')].find((button) =>
            /play|putar|reproduc|wiedergabe|riprodu|æ’­æ”¾|å†ç”Ÿ|ìž¬ìƒ/i.test([
              button.getAttribute('aria-label'),
              button.getAttribute('title'),
              button.textContent,
            ].filter(Boolean).join(' ')))
          : source;

        const context = [
          container.textContent,
          anchor?.getAttribute('aria-label'),
          anchor?.textContent,
          source.getAttribute?.('aria-label'),
          source.getAttribute?.('title'),
        ].filter(Boolean).join(' ');

        return { anchor, playButton, match: scoreSearchResult(context, expectedQuery) };
      })
      .filter(Boolean)
      .sort((left, right) => right.match.score - left.match.score);

    const eligibleCandidates = candidates.filter((candidate) => {
      const match = candidate.match;
      const titleMatch = match.titleCount > 0 && match.titleMatches === match.titleCount;
      return titleMatch && match.artistMatch;
    });

    const best = eligibleCandidates[0];
    const anchor = best?.anchor;

    if (best && attempts >= 4) {
      clearInterval(interval);
      state.selectInterval = null;
      state.selecting = false;
      reportStatus(
        'search_selected',
        `${anchor?.href || 'top_result_play'} | title_exact=${best.match.titleExact} | artist_exact=${best.match.artistExact}`,
      );
      if (anchor) {
        window.location.assign(anchor.href);
      } else {
        best.playButton?.click();
      }
    } else if (attempts >= 30) {
      clearInterval(interval);
      state.selectInterval = null;
      state.selecting = false;
      reportStatus('search_no_exact_match', expectedQuery);
    }
  }, 400);
  state.selectInterval = interval;
}
