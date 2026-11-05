# Plan: Autosave Storage Commit Failure

**Status:** Finalized; test-only regression passes and final review found no actionable findings.

## Goal and rationale

Add focused unit coverage for a localStorage write failure that happens after the autosave worker successfully encodes a scheduled state. The last known valid autosave must remain intact, and the player-facing status must report that autosaving is unavailable. Existing worker-error coverage does not exercise storage failing during commit of a successful worker response.

## Scope and constraints

- Add a test-only regression in `tests/unit/game-foundation/autosave-coordinator.test.mjs`.
- Seed valid previous bytes under `AUTO_SAVE_KEY`; configure storage `setItem` to throw only for `AUTO_SAVE_KEY`.
- Schedule a state, advance the debounce timer until the worker receives the request, then deliver a successful worker response so the failure occurs at the storage commit step.
- Assert the previous valid autosave bytes remain unchanged and the emitted/player-facing status reports autosave unavailable.
- Optionally verify that a later scheduled state does not write after the coordinator disables the worker following the storage failure.
- Do not change production code or autosave semantics in this slice. Do not run an app build, E2E, or full suite; preserve the independent human-playtest/content-expansion gate.

## Implementation approach

1. Extend the existing autosave coordinator harness to seed the previous autosave and make its storage fake throw only when committing `AUTO_SAVE_KEY`.
2. Add the successful-worker-response scenario and assert commit failure preserves the old bytes and reports autosave unavailability.
3. If practical within the focused test, schedule a subsequent state and assert the disabled worker does not produce a replacement write.
4. Run the focused command and `git diff --check`; keep any follow-up production behavior work outside this test-only plan.

## Test plan

Focused command: `node --test --test-isolation=none --test-name-pattern="storage write failure" tests/unit/game-foundation/autosave-coordinator.test.mjs`.

The Test Engineer added the named storage-write-failure case. Focused command: `node --test --test-isolation=none --test-name-pattern="storage write failure" tests/unit/game-foundation/autosave-coordinator.test.mjs`.

Result: **1/1 passed** on the current implementation. The test confirms the successful worker response reaches a throwing `AUTO_SAVE_KEY` commit, the old bytes remain unchanged, status reports `Autosave unavailable`, and later schedules produce neither another worker request nor storage write after the coordinator disables the worker. No production source change was needed. Scoped `git diff --check` reported no whitespace errors; it noted the expected LF-to-CRLF conversion for the test file. No app build, E2E, or full suite was run. Final review found no actionable findings.

## Acceptance criteria

- [x] The test seeds valid old autosave bytes and throws from storage only for `AUTO_SAVE_KEY`.
- [x] The failure occurs after a successful worker reply, and the previous autosave bytes remain unchanged.
- [x] The coordinator reports autosave unavailable; later scheduling confirms that a disabled worker does not make another worker request or write another autosave.
- [x] This remains test-only; the focused unit command passes, `git diff --check` is clean, and no app build, E2E, or full suite is run.
- [x] The plan is finalized and archived; the separate human-playtest/content-expansion gate remains active.
