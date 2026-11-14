// Shared Queue Logic - Pure selection helpers for the extension queue
//
// Kept free of Chrome APIs so the behaviour can be unit tested without a
// browser. The background queue module persists `bag` and `history` in
// storage between transitions.

import { LOOP_MODES } from './settings.js';

export const EMPTY_SELECTION = Object.freeze({ index: null, bag: [], history: [] });

function validIndex(index, length) {
  return Number.isInteger(index) && index >= 0 && index < length;
}

export function normalizeHistory(history, length) {
  if (!Array.isArray(history)) return [];
  return history.filter((index) => validIndex(index, length)).slice(-Math.max(length * 2, 2));
}

export function normalizeBag(bag, length) {
  if (!Array.isArray(bag)) return [];
  const seen = new Set();
  return bag.filter((index) => {
    if (!validIndex(index, length) || seen.has(index)) return false;
    seen.add(index);
    return true;
  });
}

/**
 * Refill the shuffle bag with every index except the current one.
 * When `avoidRepeat` is set, recently played tracks are excluded as long as
 * at least one other track remains.
 */
export function refillBag(length, currentIndex, history, avoidRepeat = 0) {
  const all = [];
  for (let index = 0; index < length; index += 1) {
    if (index !== currentIndex) all.push(index);
  }
  if (all.length === 0 && length > 0) return [0];

  const recent = normalizeHistory(history, length).slice(-Math.max(0, avoidRepeat));
  const filtered = all.filter((index) => !recent.includes(index));
  return filtered.length > 0 ? filtered : all;
}

function pushHistory(history, index, length) {
  return [...normalizeHistory(history, length), index].slice(-Math.max(length * 2, 2));
}

/**
 * Choose the next queue index.
 *
 * @returns {{index: number|null, bag: number[], history: number[]}}
 *   `index === null` means the queue is finished (loop off at the end).
 */
export function pickNextIndex({
  length,
  currentIndex,
  loop = 'off',
  shuffle = false,
  bag = [],
  history = [],
  avoidRepeat = 0,
}) {
  const safeLoop = LOOP_MODES.includes(loop) ? loop : 'off';
  if (!Number.isInteger(length) || length <= 0) return { ...EMPTY_SELECTION };

  const current = validIndex(currentIndex, length) ? currentIndex : -1;

  if (safeLoop === 'one' && current >= 0) {
    return { index: current, bag: normalizeBag(bag, length), history: normalizeHistory(history, length) };
  }

  if (shuffle) {
    let nextBag = normalizeBag(bag, length);
    if (nextBag.length === 0) {
      nextBag = refillBag(length, current, history, avoidRepeat);
    }
    const pick = nextBag[Math.floor(Math.random() * nextBag.length)];
    const remaining = nextBag.filter((index) => index !== pick);
    return {
      index: Number.isInteger(pick) ? pick : null,
      bag: remaining,
      history: Number.isInteger(pick) ? pushHistory(history, pick, length) : normalizeHistory(history, length),
    };
  }

  let next = current + 1;
  if (next >= length) {
    if (safeLoop !== 'all') {
      return { index: null, bag: [], history: normalizeHistory(history, length) };
    }
    next = 0;
  }

  return {
    index: next,
    bag: [],
    history: pushHistory(history, next, length),
  };
}

/**
 * Choose the previous queue index from the navigation history.
 * `loop one` does not affect manual Previous.
 */
export function pickPrevIndex({
  length,
  currentIndex,
  loop = 'off',
  shuffle = false,
  history = [],
}) {
  const safeLoop = LOOP_MODES.includes(loop) ? loop : 'off';
  if (!Number.isInteger(length) || length <= 0) return { index: null, history: [] };

  const current = validIndex(currentIndex, length) ? currentIndex : 0;
  const entries = normalizeHistory(history, length);

  if (entries.length >= 2) {
    const previous = entries[entries.length - 2];
    return { index: previous, history: entries.slice(0, -1) };
  }

  if (shuffle) {
    // Without history the previous track is unknown in shuffle mode.
    return { index: null, history: entries };
  }

  let previous = current - 1;
  if (previous < 0) {
    if (safeLoop !== 'all') return { index: null, history: entries };
    previous = length - 1;
  }
  return { index: previous, history: entries };
}
