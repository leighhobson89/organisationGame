# Plan: Asset-Free Audio Playback

**Status:** Finalized 2026-11-03. Implementation, focused verification, build, and review are complete. The separate human playthrough/content-expansion gate remains active, and human listening-quality review remains part of broader release polish.

## Goal

Add a small Web Audio playback adapter that subscribes to the existing gameplay event bus and plays short, restrained synthesized cues. Add a persistent **Sound effects** control to Settings. Keep playback optional, local to the browser, and independent of gameplay rules.

## Playback contract

- Subscribe through the existing global `subscribeGameAudioEvents(listener)` API. Do not change the 12 event definitions, payloads, emission guards, or gameplay transitions.
- Map all existing event names to short oscillator/gain-envelope cues:
  - `item.pickup` and `item.drop`: subtle mechanical ticks.
  - `item.placement.correct` and `item.placement.invalid`: distinct soft confirmation and error tones.
  - `collection.completed`, `puzzle.discovered`, `puzzle.completed`, `skill.unlocked`, and `skill.activated`: brief, distinct motifs.
  - `machinery.stage.changed`, `invention.assembled`, and `invention.activated`: restrained rising cues, with final activation the clearest resolution.
- Bound cue duration, gain, and simultaneous voices. Clean up oscillator/gain nodes after playback and rate-limit or drop rapid repeated events so they cannot create a harsh or dense sound.
- Create or resume `AudioContext` only when effects are enabled and a trusted user gesture has occurred. Retry unlock on a later gesture if the context remains suspended.
- Do not queue or replay events while sound is disabled or the context is suspended. Events that occur in those states are discarded; after enabling/unlock, only new events may play.
- Turning Sound effects off immediately stops or cancels active cues and releases the playback subscription/resources. Dispose the adapter on application teardown and close its `AudioContext`.
- Audio support, context creation/resume, and playback failures must not interrupt gameplay or the event publisher. Unsupported or rejected Web Audio operations fail closed and remain safe to retry after a later gesture.

## Preference compatibility

Add a boolean `soundEffectsEnabled` setting to the existing version 1 accessibility-preferences record; do not add an audio field to the game save or autosave. Preserve the existing `textScale` and `reduceMotion` values in older version 1 preference records that do not yet contain this field. Normalize a missing value to `false`, so players opt in before hearing the new sounds and are not surprised by audio in a previously silent game. Persist changes through the existing preferences storage helper and retain the current behavior when browser storage is unavailable: the setting applies for the session and reports that it could not be saved.

Add an accessible labeled **Sound effects** control to the existing Settings dialog. Toggling it applies immediately and persists. The toggle does not change OS reduced-motion handling or the text-scale preference.

## Scope boundaries

- Use the built-in Web Audio API only. Do not add audio files/assets, external requests, packages/dependencies, or continuous music.
- Do not add game-save fields, autosave changes, gameplay state, progression, or new gameplay event names.
- Do not change the current event publisher or event emission timing. Playback is an optional listener only.
- Keep the separate independent human-playthrough/content-expansion gate active; this milestone is not playtest evidence and does not authorize content expansion.
- Human listening for tone quality remains a later polish check; automated checks verify wiring, timing bounds, disable behavior, and cleanup.

## Acceptance criteria

- The playback adapter subscribes to the existing 12 stable gameplay events and maps each to an appropriate short, quiet synthesized cue.
- Pickup/drop and correct/invalid placement cues are distinct; progression cues are restrained motifs; machinery/invention cues build gently, with final activation most recognizable.
- No cue plays until effects are enabled and Web Audio has been unlocked by a user gesture. Muted or suspended events are discarded without queue/replay.
- Disabling sound immediately stops active cues, unsubscribes or otherwise disables event handling, and releases active nodes; unmount cleans up the adapter and context.
- Playback uses bounded gain, duration, and polyphony; repeated rapid events are rate-limited or dropped.
- Missing Web Audio support and context/playback errors do not throw into gameplay, interrupt subscribers, or prevent toggling the setting.
- Existing version 1 preference records without `soundEffectsEnabled` retain their text scale and reduced-motion values and safely receive the default `false` sound setting.
- The Settings control is accessible and the choice persists across reload when storage works. With storage unavailable, the choice still applies for the current session.
- No game-save/autosave fields, new assets, network requests, third-party dependencies, or continuous music are introduced.

## Focused validation plan

The Test Engineer supplied the following focused regression targets, commands, and pre-implementation results. Final verification is recorded below.

Planned unit coverage:

- Map every event name to the intended cue and verify duration/gain/polyphony bounds using a fake `AudioContext`.
- Verify no playback or queued event when disabled or suspended, and that a later gesture unlocks playback only for subsequent events.
- Verify sound-off stops/disconnects active nodes and removes the subscription; dispose unsubscribes and closes the context; repeated events are rate-limited or dropped.
- Verify unavailable, throwing, or rejected AudioContext operations fail without escaping into gameplay.
- Verify legacy v1 preferences preserve `textScale` and `reduceMotion`, default missing `soundEffectsEnabled` to `false`, and round-trip the new field.

Planned browser coverage:

- Verify the labeled Settings control toggles `soundEffectsEnabled` and persists across reload.
- With a user gesture and effects enabled, verify a real gameplay event produces Web Audio oscillator activity; verify disabled effects produce no playback.
- Verify toggling effects off stops current playback and no muted event replays after re-enabling.
- Verify no new audio/preference fields enter the game save and that no autoplay sound occurs on startup or completed-save load.

The adapter test contract is `createWebAudioAdapter({ AudioContext, enabled = true, now, minIntervalMs })`, returning `unlock`, `setEnabled`, and `dispose` controls. The app passes the persistent `soundEffectsEnabled` preference explicitly, which defaults to `false`.

Unit test targets: `tests/unit/game-foundation/web-audio-adapter.test.mjs` and updated `tests/unit/game-foundation/user-preferences.test.mjs`.  
Focused unit command: `node --test --test-isolation=none tests/unit/game-foundation/web-audio-adapter.test.mjs tests/unit/game-foundation/user-preferences.test.mjs`.  
E2E test target: `e2e/lab/audio-settings.spec.js`.  
Focused E2E command: `npx playwright test e2e/lab/audio-settings.spec.js --workers=1`.  
Pre-implementation unit baseline: with `node --test --test-isolation=none tests/unit/game-foundation/web-audio-adapter.test.mjs tests/unit/game-foundation/user-preferences.test.mjs`, the adapter test module fails to import with `ERR_MODULE_NOT_FOUND`; 10 preference assertions fail because `soundEffectsEnabled` is not implemented; and one existing storage-exception preference test passes.

Pre-implementation E2E baseline: `npx playwright test e2e/lab/audio-settings.spec.js --workers=1` is blocked before test execution because Playwright worker startup fails with Windows `spawn EPERM`. This is a runner-startup blocker, not a behavioral E2E result. `node --check` passed on the adapter unit test, updated preference unit test, and E2E file.

Run focused tests and the production build only for this milestone. Do not run the full test suite without user approval as required by `AGENTS.md`.

### Final verification

- `node --test --test-isolation=none tests/unit/game-foundation/web-audio-adapter.test.mjs tests/unit/game-foundation/user-preferences.test.mjs`: 19/19 passed.
- `npx playwright test e2e/lab/audio-settings.spec.js e2e/lab/preferences.spec.js e2e/lab/manual-saves.spec.js --workers=1`: 9/9 passed.
- `npm run build`: passed with Vite 8.3.5.
- Reviewer re-review found no actionable issues.
- The full test suite was not run. The initial E2E baseline's Windows `spawn EPERM` occurred before test execution; the final focused browser run passed after process-spawn access was available.
- Automated wiring is verified; human listening-quality review remains open as part of broader release polish. The independent human playthrough/content-expansion gate also remains active.

## Handoff and completion

The Architect owns the playback and preference compatibility contract. The Test Engineer owns focused fake-Web-Audio unit tests and browser wiring regressions. Implementation should add only the optional playback adapter and Settings control while preserving event and save behavior. Code review should check gesture gating, no-queue semantics, cleanup/rate limits, error isolation, and backward-compatible preferences. The Documentation Specialist records results and archives this plan after implementation, review, and documentation are complete.

- [x] Record scope, event mapping, compatibility, failure behavior, acceptance criteria, and planned verification areas.
- [x] Record focused test targets and commands.
- [x] Record pre-implementation unit and E2E startup results before implementation begins.
- [x] Implement optional synthesized playback and the persistent Sound effects control.
- [x] Pass focused unit/E2E checks, build, and code review.
- [x] Keep `docs/plans/browser-scaling-playtest-gate.md` active and content expansion gated.

The milestone is complete and this plan is archived. The human playthrough and content-expansion gate remains separately active; a human listening-quality check remains part of broader release polish.
