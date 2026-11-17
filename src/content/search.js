// Content Search - Search result selection logic

import { SEARCH_RENDERERS, SEARCH_FILTER_CHIPS, SONGS_FILTER_LABELS } from '../shared/constants.js';
import { storageGet } from './storage.js';
import { scoreSearchResult, parseTrackQuery } from '../shared/utils.js';
import { state } from './state.js';
import { reportStatus } from '../shared/messaging.js';
import { clickSongsFilter } from './dom.js';

const MAX_ATTEMPTS_PER_PHASE = 30;
const MIN_ATTEMPTS_BEFORE_SELECT = 4;
const FILTER_SWITCH_WAIT_MS = 2500; // wait for results to reload after clicking filter

/**
 * Parse expected query once to know if an artist was specified.
 * Used to enforce strict artist matching.
 */
function hasArtistInQuery(expectedQuery) {
  const parsed = parseTrackQuery(expectedQuery);
  return parsed.artists.length > 0;
}

/**
 * Select first matching track from search results with 2-phase fallback:
 * Phase 1: Normal search (all filters)
 * Phase 2: After failure, click "Songs" filter and retry
 *
 * Strict matching: if the expected query contains an artist, the result
 * must match BOTH title AND artist. Otherwise we risk autoplaying a song
 * by a different artist (e.g. "Porch Light" by another artist when queue
 * expects "Porch Light - eL Utama").
 */
export async function selectFirstTrack() {
  if (!state.enabled) return;
  if (state.selecting) return;

  state.selecting = true;
  state.searchPhase = 'normal'; // 'normal' | 'songs_filter' | 'done'
  state.searchPhaseAttempts = 0;
  state.filterSwitchAttempted = false;

  const { currentExpectedQuery } = await storageGet(['currentExpectedQuery']);
  const expectedQuery = currentExpectedQuery || '';
  const queryHasArtist = hasArtistInQuery(expectedQuery);

  reportStatus('search_selecting', `phase=normal query="${expectedQuery}"`);
  let attempts = 0;
  if (state.selectInterval) clearInterval(state.selectInterval);

  const interval = setInterval(() => {
    attempts += 1;
    state.searchPhaseAttempts = attempts;

    // Only abort when the extension is disabled or we already left the search
    // page. A duplicate `yt-navigate-finish` event must not cancel selection.
    if (!state.enabled || !window.location.pathname.includes('/search')) {
      clearInterval(interval);
      state.selectInterval = null;
      state.selecting = false;
      state.searchPhase = 'done';
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

        return /play|putar|reproduc|wiedergabe|riprodu|æ'­æ”¾|å†ç”Ÿ|ìž¬ìƒ/i.test(label)
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
              /play|putar|reproduc|wiedergabe|riprodu|æ'­æ”¾|å†ç”Ÿ|ìž¬ìƒ/i.test([
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

      // Title must fully match (all title tokens present)
      const titleMatch = match.titleCount > 0 && match.titleMatches === match.titleCount;

      // Artist matching:
      // - If query has an artist (e.g. "eL Utama"), require artistExact (full name present)
      //   to avoid autoplaying a different artist's song.
      // - If query has no artist, artistMatch (token-based) is sufficient.
      const artistOk = queryHasArtist ? match.artistExact : match.artistMatch;

      return titleMatch && artistOk;
    });

    const best = eligibleCandidates[0];
    const anchor = best?.anchor;

    if (best && attempts >= MIN_ATTEMPTS_BEFORE_SELECT) {
      clearInterval(interval);
      state.selectInterval = null;
      state.selecting = false;
      state.searchPhase = 'done';
      reportStatus(
        'search_selected',
        `${anchor?.href || 'top_result_play'} | phase=${state.searchPhase} | title_exact=${best.match.titleExact} | artist_exact=${best.match.artistExact}`,
      );
      if (anchor) {
        window.location.assign(anchor.href);
      } else {
        best.playButton?.click();
      }
    } else if (attempts >= MAX_ATTEMPTS_PER_PHASE) {
      // Phase 1 failed - try Songs filter fallback
      if (state.searchPhase === 'normal' && !state.filterSwitchAttempted) {
        state.filterSwitchAttempted = true;
        state.searchPhase = 'songs_filter';
        attempts = 0; // reset counter for phase 2
        state.searchPhaseAttempts = 0;

        reportStatus('search_filter_fallback', `switching to Songs filter query="${expectedQuery}"`);

        // Click Songs filter
        const filterClicked = clickSongsFilter();
        if (!filterClicked) {
          reportStatus('search_filter_fallback_failed', 'Songs filter not found');
          // Continue anyway, maybe results already filtered
        }

        // Wait for results to reload, then continue checking
        setTimeout(() => {
          // The interval continues, attempts will increment from 0
          reportStatus('search_selecting', `phase=songs_filter query="${expectedQuery}"`);
        }, FILTER_SWITCH_WAIT_MS);
        return;
      }

      // Phase 2 also failed (or filter not available)
      // No matching track found even after Songs filter - report warning
      clearInterval(interval);
      state.selectInterval = null;
      state.selecting = false;
      state.searchPhase = 'done';
      reportStatus('search_no_exact_match', `phase=${state.searchPhase} query="${expectedQuery}"`);
    }
  }, 400);
  state.selectInterval = interval;
}