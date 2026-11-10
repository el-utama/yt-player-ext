# Audit Findings — yt-player-ext (2026-11-10)

Scope: static source review only. No browser/Node Puppeteer environment available (node_modules absent; INSTALL_AND_TESTING.md §7 confirms live DOM verification deferred). One git commit; working tree clean.

## Remediation claims (from AUDIT_REPORT.md 2026-11-09) — verified present in code

| Report item | Code location | Status |
|---|---|---|
| Continuous eligible playback (paused/ad/time gate) | content.js:279-280, `tick()` | Present |
| Ad markers centralised | content.js:7 `adMarkers`, `:71-76` `isAdShowing()` | Present |
| Skip serialized after scrobble decision | content.js:200-209 `advanceAfterDecision()` (`state.advancing` guard); background.js:96-110 `enqueueTransition` | Present |
| Whitelist normalization (Unicode/case/punct/tokens, `official audio` stripped) | content.js:78-97 `normalizeText()`, `isWhitelisted()` | Present |
| Per-track session key + dedup | content.js:133-144 `resetTrackState(identity, sessionId)`; background.js:129-143 `saveScrobble()` sessionId dedup | Present |
| SPA MutationObserver + native media events | content.js:384-388 observer; `:216-228` play/pause/ended/timeupdate listeners | Present |
| Autoplay disable idempotent | content.js:146-157 `disableAutoplay()` (clicks only if `aria-pressed`/`active`/enabled text) | Present |
| Queue transition lock | background.js:89-94 `enqueueTransition()` promise chain | Present |
| Message sender validation | background.js:10-17 `isPlayerSender()`, :163 `contentActions` guard | Present |
| playerTabId reconcile on startup/removed | background.js:29-48 `reconcilePlayerTab()`, :149-151 `onStartup`, :153-158 `onRemoved` | Present |
| Query qualification (no suffix appended) | background.js:25-27 `qualifiedSearchQuery()` returns `query.trim()` | Present (design choice: no "Official Audio" suffix, per README troubleshooting) |
| CSV escaping + Blob + BOM + revoke | popup.js:70-72 `csvEscape()`, :74-99 `exportCsv()` | Present |
| Queue input normalization (CRLF, trim, dedup-empty, slice 500) | popup.js:105-109 | Present |

## Genuine open findings

**F1 — `tabs` permission cannot be removed (manifest.json:6-9, background.js)**
Code uses `tabs.create`, `tabs.update`, `tabs.get`, `tabs.query`, `tabs.sendMessage`, `tabs.onRemoved` — all require the `tabs` permission. The AUDIT_REPORT P2 suggestion that `tabs` "tampaknya dapat digantikan" is not supported by the current implementation. Keep `tabs`; do not switch to `<all_urls>`. No action required unless APIs are refactored to messaging-only.

**F2 — No `icons` declared (manifest.json)**
Optional UI metadata. Add `icons` only when assets exist; low priority.

**F3 — Search result selection fragility remains partial (content.js:287-343)**
`selectFirstTrack()` falls back to clicking a play-button when `best.match.artistCount === 0` (line 333), i.e. no artist token required. A title-only match can be clicked after 4 attempts (line 328). Risk: wrong track selected when artist metadata absent from DOM. Fail-closed path (`search_no_exact_match`) exists after 30 attempts. Keep monitoring; tighten artist requirement if mis-selections observed.

**F4 — Single-keyword whitelist can pass (content.js:96)**
`isWhitelisted()` returns true when `keywords.length === 1 && matches.length === 1`. A short title-only keyword (≥3 chars) whitelists regardless of artist. Consider fail-closed when artist tokens exist in query but none match.

**F5 — `resetTrackState()` invoked via async storage read every 500ms tick (content.js:268-272)**
Creates a `storageGet` promise every tick and resets `lastTick` only on identity change (guarded). Functionally safe but wasteful; read `currentSessionId` once at bind/navigation instead of per-tick.

**F6 — Double `advanceAfterDecision()` trigger paths (content.js:227, 283)**
Fired from video `ended` listener and from `tick()` when `video.ended`. Both guarded by `state.advancing` and `!isAdShowing`, so double-transition is prevented; acceptable but redundant.

**F7 — No automated tests / CI (no package.json, no test tooling)**
Normalization (whitelist, CSV escaping, queue transitions) has no unit test coverage. Add when build tooling is introduced.

**F8 — Live selector verification outstanding**
AUDIT_REPORT §Tindak lanjut #2 and INSTALL_AND_TESTING.md §4 require verifying `resultPlayButton`, `playerTitle`, `autoplay`, `adMarkers` on live YT Music DOM. Deferred pending browser availability.

## Conclusion
P0/P1 remediation is implemented in code. No regressions introduced against the reported fixes. F1 is the only item requiring a deliberate decision (retain `tabs`). F3/F4 are tuning items; F5/F6 minor cleanup; F7/F8 are process items awaiting a browser-enabled environment.
