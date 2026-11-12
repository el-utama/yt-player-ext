// Shared Utilities - Pure functions for text normalization, parsing, scoring

import { FEATURING_WORDS, ARTIST_SEPARATOR } from './constants.js';

/**
 * Normalize text for comparison: lowercase, remove special chars, trim
 */
export function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[()[\]{}.,!?_:;|/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse track query into title and artist array
 * Handles "Title - Artist" format and featuring artists
 */
export function parseTrackQuery(expectedQuery) {
  const raw = String(expectedQuery || '').trim();
  const separator = raw.lastIndexOf(' - ');
  const title = separator > 0 ? raw.slice(0, separator) : raw;
  const artistText = separator > 0 ? raw.slice(separator + 3) : '';
  
  const artists = artistText
    .replace(FEATURING_WORDS, '|')
    .split(ARTIST_SEPARATOR)
    .flatMap((part) => part.split('|'))
    .map((part) => normalizeText(part)
      .replace(/\b(?:official|audio|video|lyrics?)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim())
    .filter((part, index, list) => part.length >= 2 && list.indexOf(part) === index);
  
  return { 
    raw, 
    title: normalizeText(title), 
    artistText: normalizeText(artistText), 
    artists 
  };
}

/**
 * Extract artist tokens for matching
 */
export function artistTokens(value) {
  return normalizeText(value)
    .replace(FEATURING_WORDS, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 2 && !/^(?:official|audio|video|lyrics?)$/i.test(word));
}

/**
 * Check if current title matches whitelist (queue item)
 */
export function isWhitelisted(currentTitle, expectedQuery) {
  const title = normalizeText(currentTitle);
  const parsed = parseTrackQuery(expectedQuery);
  
  if (!title || !parsed.title) return false;
  
  const titleWords = parsed.title.split(/[\s\-]+/).filter((word) => word.length >= 2);
  const titleMatches = titleWords.filter((word) => title.includes(word)).length;
  
  return titleWords.length === 1
    ? titleMatches === 1
    : titleMatches >= Math.min(2, titleWords.length);
}

/**
 * Get track title from player DOM
 */
export function getTrackTitle() {
  const titleEl = document.querySelector('.title.ytmusic-player-bar, ytmusic-player-bar .title');
  return (titleEl?.textContent || document.title || '').replace(/\s+/g, ' ').trim();
}

/**
 * Create unique track identity for session tracking
 */
export function getTrackIdentity(video, title) {
  return `${window.location.href.split('&')[0]}|${normalizeText(title)}|${video?.duration || 0}`;
}

/**
 * Score search result against expected query
 * Returns object with score and match details
 */
export function scoreSearchResult(text, expectedQuery) {
  const candidate = normalizeText(text);
  const parsed = parseTrackQuery(expectedQuery);
  
  const titleTokens = parsed.title.split(/[\s\-]+/).filter((word) => word.length >= 2);
  const expectedArtistTokens = [...new Set(parsed.artists.flatMap(artistTokens))];
  
  const titleMatches = titleTokens.filter((token) => candidate.includes(token)).length;
  const artistMatches = expectedArtistTokens.filter((token) => candidate.includes(token)).length;
  
  const titleExact = Boolean(parsed.title && candidate.includes(parsed.title));
  const artistExact = parsed.artists.length > 0 && parsed.artists.every(
    (artist) => candidate.includes(normalizeText(artist))
  );
  
  const artistMatch = !parsed.artists.length || parsed.artists.every((artist) => {
    const tokens = artistTokens(artist);
    return tokens.length > 0 && tokens.some((token) => candidate.includes(token));
  });
  
  return {
    score: (titleExact ? 1000000000 : 0)
      + (artistExact ? 1000000 : 0)
      + (artistMatch ? 10000 : 0)
      + (titleMatches * 100) + artistMatches,
    titleExact,
    titleMatches,
    titleCount: titleTokens.length,
    artistExact,
    artistMatches,
    artistCount: expectedArtistTokens.length,
    artistCoverage: expectedArtistTokens.length ? artistMatches / expectedArtistTokens.length : 1,
    artistMatch,
  };
}

/**
 * Generate session ID
 */
export function generateSessionId(index) {
  return `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Normalize queue array
 */
export function normalizeQueue(queue) {
  return Array.isArray(queue)
    ? queue.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : [];
}

/**
 * Validate track info for scrobbling
 */
export function isValidTrackInfo(trackInfo) {
  return Boolean(
    trackInfo &&
    typeof trackInfo.title === 'string' && trackInfo.title.length > 0 && trackInfo.title.length <= 500 &&
    typeof trackInfo.url === 'string' && trackInfo.url.startsWith('https://music.youtube.com') &&
    Number.isFinite(trackInfo.timestamp) &&
    typeof trackInfo.sessionId === 'string' && trackInfo.sessionId.length <= 120
  );
}

/**
 * Sleep utility
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}