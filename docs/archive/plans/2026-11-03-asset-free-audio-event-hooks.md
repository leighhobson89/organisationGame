# Plan: Asset-Free Audio Event Hooks

**Status:** Complete. The asset-free transient event bus and all 12 gameplay hooks are implemented, focused-verified, built, and reviewed. The separate human-playthrough/content-expansion gate remains active in `docs/plans/browser-scaling-playtest-gate.md`.

## Goal

Add a small, asset-free transient event publisher so future audio work can subscribe to stable gameplay cues without coupling game rules to sound playback. This milestone defines and emits gameplay events only; it adds no sound assets or playback.

## Event contract

Use these stable dotted event names:

| Event | Payload fields | Emission rule |
| --- | --- | --- |
| `item.pickup` | `itemId` | Emit once when a pointer gesture crosses the existing 4px drag threshold and becomes a real item drag. A press/release without a drag emits no pickup. |
| `item.drop` | `itemId`, optional `targetKind`, `targetId` | Emit on pointer release after a real drag, including when placement allocation is rejected by capacity. This is a gesture event, not a placement result. |
| `item.placement.correct` | `itemId`, `targetKind`, `targetId` | Emit after an accepted placement is validated as correct. |
| `item.placement.invalid` | `itemId`, `targetKind`, `targetId` | Emit after an accepted placement is validated as invalid. |
| `collection.completed` | `collectionId` | Emit only after the existing completion guard succeeds and the completion transition is committed. |
| `puzzle.discovered` | `puzzleId` | Emit only after the existing discovery/unlock guard succeeds. |
| `puzzle.completed` | `puzzleId` | Emit only after the existing puzzle-solve guard succeeds and the solved state is committed. |
| `skill.unlocked` | `skillId` | Emit only after the existing purchase/unlock guard succeeds. |
| `skill.activated` | `skillId` | Emit only when the existing skill activation succeeds. |
| `machinery.stage.changed` | `fromStage`, `toStage` | Emit only after the existing stage transition is committed. |
| `invention.assembled` | `inventionId` | Emit when a guarded puzzle solve transitions `inventionStage` from another stage into `Chronology Wheel`. Assembly is derived from this stage transition; there is no separate assembly boolean. |
| `invention.activated` | `inventionId`, `stageId` | Emit only when derived `gameComplete` changes false-to-true, with `{ inventionId: 'palimpsest-engine', stageId: 'Chronology Wheel' }`. Never emit because an already-complete save was loaded. |

Payloads contain only small identifiers, target fields, and stage fields listed above. Do not attach item objects, positions, clues, save data, or presentation state.

Inspector moves emit the appropriate semantic `item.placement.correct` or `item.placement.invalid` event after an accepted move and validation. They do not emit `item.pickup` or `item.drop`, because no pointer pickup or release occurred. If placement allocation is rejected, emit no placement-result event; the pointer `item.drop` still reports that the drag ended and carries no success/rejection result.

Emit progression events after their existing guards and state transitions succeed. Failed purchases, locked puzzle attempts, duplicate completion rewards, rejected capacity moves, stage no-ops, and other rejected transitions do not emit progression cues. On a successful Chronology puzzle solve that advances the Engine from another stage into Chronology Wheel, emit `puzzle.completed`, then `machinery.stage.changed`, then `invention.assembled`. `invention.activated` is a later effect emitted only when derived `gameComplete` changes false-to-true; it is not an assembly event. Final activation is edge-triggered, never replayed during initialization or loading an already-complete save.

## Publisher behavior and boundaries

- Add a minimal in-memory publisher/subscriber API with the global `subscribeGameAudioEvents(listener)` entry point. Each listener receives every published event; the event's stable dotted name and small payload identify it. Subscriptions are not filtered by event name and can be removed. Keep gameplay code independent of any audio library.
- When an event has no subscribers, publishing it is a no-op. Do not queue, retain, replay, or persist events for later subscribers.
- Subscribers receive only events published while subscribed. A later subscription must not replay past events.
- Do not add audio files, sound playback, audio preferences, audio settings UI, persistent event history, or save-schema fields.
- Preserve all existing content, IDs, ordering, positions in saved games, validation, placement, progression, and accessibility behavior.
- Keep the independent human-playthrough/content-expansion gate active. This event-hook milestone does not provide audio feedback or complete a human playtest.

## Acceptance criteria

- Each listed event has a stable dotted name and emits only at the specified user gesture or committed gameplay transition.
- Pointer pickup is emitted only after crossing the existing 4px threshold; a real dragged item emits `item.drop` when released, even if capacity rejects the proposed placement.
- Capacity rejection produces no semantic placement-result event. Accepted pointer and Inspector placements emit the matching correct/invalid semantic event; Inspector actions emit neither pointer event.
- Progression cues are absent when existing guards fail and emit once when their state transition succeeds. Final activation fires only on false-to-true, not on repeated activation or completed-save load.
- Event payloads contain only the listed small IDs, target, and stage fields.
- With no subscribers, events are discarded immediately; subscribing later does not receive queued or replayed events.
- No audio asset/playback, preferences, save fields, content changes, or progression changes are introduced.

## Focused validation plan

The Test Engineer added focused unit and E2E regressions before implementation. Their paths, commands, pre-implementation results, and final verification are recorded here.

Planned unit and integration coverage:

- The global `subscribeGameAudioEvents(listener)` callback, unsubscription, stable event-name delivery, payload field limits, and no-subscriber no-op behavior.
- Confirm a late subscriber does not receive earlier events and that no queue or replay storage exists.
- Exercise pointer gestures below and above the 4px threshold; confirm pickup occurs once only after threshold crossing and release emits drop even when capacity rejects placement.
- Confirm successful correct and invalid placements emit semantic events; a rejected allocation emits no placement result; Inspector moves emit semantic events without pointer pickup/drop events.
- Confirm each progression event fires only after its existing guard and committed transition; rejected and duplicate attempts do not fire.
- Confirm any actual machinery-stage transition emits `machinery.stage.changed`; a guarded transition into Chronology Wheel emits `puzzle.completed`, then `machinery.stage.changed`, then `invention.assembled`. Confirm final activation follows later on derived completion false-to-true and does not fire while loading an already-complete save.
- Explicitly distinguish completed-save import from real completion: importing a restored save opens the ending UI without emitting `invention.activated`; a subsequent genuine completion transition emits it once.
- Confirm event publishing does not change the save schema, content, or game state.

Unit test path: `tests/unit/game-foundation/audio-events.test.mjs`.  
Focused unit command: `node --test --test-isolation=none tests/unit/game-foundation/audio-events.test.mjs`.

Unit red baseline: the test file failed to load before tests ran with `ERR_MODULE_NOT_FOUND` for `src/game/audio/audioEvents.js` (Node reported 14.6 ms; the parent agent reproduced this result).

E2E test files:

- `e2e/lab/organising-loop.spec.js`
- `e2e/lab/world-and-save-recovery.spec.js`
- `e2e/lab/research-chapter.spec.js`
- `e2e/lab/full-restoration-ending.spec.js`
- Shared helper: `e2e/helpers/audioEvents.js`

Focused E2E command:

~~~sh
npm run test:e2e -- --workers=1 e2e/lab/organising-loop.spec.js e2e/lab/world-and-save-recovery.spec.js e2e/lab/research-chapter.spec.js e2e/lab/full-restoration-ending.spec.js
~~~

Initial E2E pre-implementation result: the Playwright runner could not spawn a worker (`spawn EPERM`) before executing tests. `node --check` passed on the modified test files.

Additional focused regression added after review: `e2e/lab/full-restoration-ending.spec.js`, test `importing a restored save shows the ending without activation, then real completion activates once`. Its focused command is:

~~~sh
npm run test:e2e -- --workers=1 e2e/lab/full-restoration-ending.spec.js -g "importing a restored save"
~~~

This pre-fix run executed and failed as expected: importing an already-complete save incorrectly emitted `invention.activated`, even though the ending UI opened. The regression also checks that a later real completion transition activates exactly once. This was a behavioral E2E failure, distinct from the earlier `spawn EPERM` runner failure.

Final focused results:

- `node --test --test-isolation=none tests/unit/game-foundation/audio-events.test.mjs`: 6/6 passed.
- `npm run test:e2e -- --workers=1 e2e/lab/organising-loop.spec.js e2e/lab/world-and-save-recovery.spec.js e2e/lab/research-chapter.spec.js e2e/lab/full-restoration-ending.spec.js`: 33/33 passed, including completed-save import without activation and real completion activation exactly once.
- `npm run build`: passed with Vite 8.3.5.
- Code Reviewer found no remaining actionable issues after the fix.
- The full test suite was not run.

Run only focused tests and the production build for this milestone. Do not run the full test suite without user approval as required by `AGENTS.md`.

## Handoff and completion

The Architect owns the event names, payload limits, and timing semantics. The Test Engineer owns focused publisher and gameplay-transition regressions. The implementation should add only the transient hooks and event emissions; no audio client is in scope. The Code Reviewer checks that existing guards remain authoritative, events fire once at the right transitions, no-subscriber events are discarded, and no persistence or content behavior changes. The Documentation Specialist records the final results.

- [x] Record focused test paths, commands, and pre-implementation results before implementation.
- [x] Add the transient publisher and all event emissions without audio assets/playback or save changes.
- [x] Pass focused unit/E2E checks, build, and code review.
- [x] Keep `docs/plans/browser-scaling-playtest-gate.md` active and content expansion gated.

The human playthrough remains a separate active gate. This milestone adds no audio assets or playback and does not clear the content-expansion gate.
