# Plan: Offline Render Validation for Gameplay Audio

**Status:** Complete as an automated PCM-validation slice (2026-11-05). Scoped review found no actionable findings. Subjective listening and the human chapter playtest remain open.

## Goal and scope

Verify that `createWebAudioAdapter` schedules audible, bounded, distinguishable PCM for every gameplay audio event when rendered by the browser's `OfflineAudioContext`. This validates the actual scheduled output, silence bounds, and event-pair distinction. It does not judge whether cues sound pleasant or fit the game's aesthetic.

Keep human listening separate from this automated signal check. The independent two-chapter human playtest remains deferred, and the content-expansion gate remains open.

## Rendering harness

The focused browser regression is `e2e/lab/audio-rendering.spec.js`. It uses the browser's real `OfflineAudioContext` with one channel, 48,000Hz sample rate, and 36,000 frames (750ms) per render.

For each event, create one offline context and one adapter. Inject a small `AudioContext` bridge into `createWebAudioAdapter`: delegate destination, current time, oscillator creation, and gain creation to the underlying offline context, while exposing virtual `state`/`resume()` behavior so the adapter's normal `unlock()` succeeds without starting the offline context prematurely. Import and call `emitGameAudioEvent` from the application module, emit exactly one event, call `startRendering()`, and inspect the returned channel-zero PCM. Dispose the adapter and isolate event-bus listeners for each case.

Use a fresh context/adapter for each of the 12 event types:

- `item.pickup`
- `item.drop`
- `item.placement.correct`
- `item.placement.invalid`
- `collection.completed`
- `puzzle.discovered`
- `puzzle.completed`
- `skill.unlocked`
- `skill.activated`
- `machinery.stage.changed`
- `invention.assembled`
- `invention.activated`

## Signal assertions

Measure each rendered mono buffer against these limits:

- Absolute peak is between 0.02 and 0.20.
- Full-buffer RMS is at least 0.005.
- Active-span RMS, computed over the samples above the `1e-4` activity threshold, is at least 0.005.
- The first-to-last sample span with absolute value above `1e-4` is 0.06–0.55 seconds.
- Peak absolute amplitude in both the first and last 5ms of the active span is below 0.85 times the cue peak.
- RMS over the final 100ms of the 750ms render is below `1e-6`.

For each pair below, normalize each buffer to unit peak, compute the RMS difference across the complete 36,000 samples, and require a distance greater than 0.1:

- `item.placement.correct` vs `item.placement.invalid`
- `collection.completed` vs `invention.activated`
- `skill.unlocked` vs `skill.activated`

## Test coverage

The focused regression is `e2e/lab/audio-rendering.spec.js`. It exercises `src/game/audio/webAudioAdapter.js` and `src/game/audio/audioEvents.js` through application-module imports. Existing scheduled-node unit coverage is in `tests/unit/game-foundation/web-audio-adapter.test.mjs`.

## Verification results

`npx playwright test e2e/lab/audio-rendering.spec.js --reporter=line --workers=1` passed 1/1 in 2.3 seconds in the configured Edge browser using the real `OfflineAudioContext`. The single test rendered all 12 gameplay event cues with isolated contexts/adapters. Each cue met the peak range 0.02–0.20, full-buffer RMS ≥0.005, active-span RMS ≥0.005, active duration 0.06–0.55 seconds, first/last 5ms peaks below 0.85× cue peak, and final-100ms RMS below `1e-6`. The three normalized pairwise PCM distances exceeded 0.1. Adapter bridge lifecycle checks passed. Scoped review found no actionable findings. No application source change or build was needed, and the full suite was not run.

## Acceptance criteria

- [x] One offline context and adapter render each of the 12 gameplay event types through a single imported event emission.
- [x] Every PCM buffer meets the peak, full-buffer RMS, active-span RMS/duration, attack/release, and final-silence limits.
- [x] All three event pairs exceed the normalized PCM distance threshold.
- [x] The adapter unlock bridge and cleanup lifecycle preserve isolation across renders.
- [x] The focused browser regression passed 1/1; scoped review found no actionable findings. No app source change or build was needed.
- [x] The automated result is limited to rendered output bounds and distinction. Subjective listening remains unverified; this does not close the audio listening/polish gate.
- [x] The two-chapter human playtest remains deferred and the content-expansion gate stays open.

Automated PCM validation does not establish subjective audio quality. Human listening and the separate two-chapter playtest remain unverified; do not report either gate as closed.
