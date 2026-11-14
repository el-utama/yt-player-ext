// Content Now Playing - Build and throttle now-playing snapshots for the popup

import { state } from './state.js';
import { getTrackTitle, getTrackArtist } from './dom.js';
import { sendMessage } from '../shared/messaging.js';

const HEARTBEAT_MS = 2000;

function safeSeconds(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 10) / 10 : 0;
}

/**
 * Pure snapshot builder. Kept free of DOM access so it can be unit tested.
 */
export function buildNowPlaying({
  title = '',
  artist = '',
  video = null,
  adShowing = false,
  playbackMode = 'native',
  loopMode = 'off',
  shuffleEnabled = false,
} = {}) {
  const rawDuration = Number(video?.duration);
  const rawPosition = Number(video?.currentTime);
  const durationSeconds = Number.isFinite(rawDuration) && rawDuration > 0
    ? Math.round(rawDuration * 10) / 10
    : 0;
  const positionSeconds = Number.isFinite(rawPosition) && rawPosition >= 0
    ? Math.min(Math.round(rawPosition * 10) / 10, durationSeconds || rawPosition)
    : 0;

  return {
    title: String(title || '').trim(),
    artist: String(artist || '').trim(),
    durationSeconds,
    positionSeconds,
    isPlaying: Boolean(video) && video.paused === false,
    adShowing: Boolean(adShowing),
    playbackMode: playbackMode === 'extension' ? 'extension' : 'native',
    loopMode: ['off', 'all', 'one'].includes(loopMode) ? loopMode : 'off',
    shuffleEnabled: Boolean(shuffleEnabled),
  };
}

function signatureOf(snapshot) {
  return [
    snapshot.title,
    snapshot.artist,
    snapshot.adShowing ? 'ad' : 'track',
    snapshot.isPlaying ? 'playing' : 'paused',
    snapshot.playbackMode,
    snapshot.loopMode,
    snapshot.shuffleEnabled ? 'shuffle' : 'ordered',
  ].join('|');
}

/**
 * Send a snapshot to the background. Throttled to one write every 2 seconds
 * unless the track/state signature changed.
 */
export function reportNowPlaying(force = false) {
  if (!state.enabled) return false;

  const video = state.video || document.querySelector('video');
  if (!video) return false;

  const snapshot = buildNowPlaying({
    title: getTrackTitle(),
    artist: getTrackArtist(),
    video,
    adShowing: state.lastAdState,
    playbackMode: state.playbackMode,
    loopMode: state.loopMode,
    shuffleEnabled: state.shuffleEnabled,
  });

  const signature = signatureOf(snapshot);
  const now = Date.now();
  const changed = signature !== state.nowPlayingSignature;

  if (!force && !changed && now - state.nowPlayingSentAt < HEARTBEAT_MS) return false;

  state.nowPlayingSignature = signature;
  state.nowPlayingSentAt = now;
  void sendMessage({ action: 'NOW_PLAYING', nowPlaying: snapshot });
  return true;
}

export { safeSeconds };
