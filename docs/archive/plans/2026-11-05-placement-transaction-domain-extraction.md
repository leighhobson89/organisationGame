# Plan: Extract Placement Transactions into the Game Domain

**Status:** Complete. The extraction, focused verification, review, and project documentation are finalized. The independent human-playtest/content-expansion gate remains open.

## Goal and evidence

Move placement and progression calculations out of the approximately 250-line single-item and batch-move handlers in `src/app/App.jsx` into a pure game-domain module. `App.jsx` currently coordinates allocation, validation, collection rewards, puzzle unlocks, and Notebook discoveries in both handlers, with duplicated completion logic. The original project specification calls for gameplay and progression systems to remain modular as the game grows.

## Scope and constraints

- Add `src/game/domain/placementTransaction.js` with `planSinglePlacement({ game, itemId, target, position })` and `planBatchPlacement({ game, itemIds, target })`.
- Keep the planners pure: they calculate changes and outcomes without committing game state or emitting audio, changing focus, opening panels, or showing toasts.
- Return `{ ok: false, reason }` on allocation rejection, with no partial state changes.
- On success, return:

  ```js
  {
    ok: true,
    changes: { items, progress, discoveries },
    movedItems,
    validationCounts: { correct, invalid, unchecked },
    newlyCompletedCollections,
    newlyUnlockedPuzzles,
    addedDiscoveryIds,
  }
  ```

- Preserve world-bound clamping, pointer-drop position-to-slot behavior, Inspector slot selection, validation, and catalog ordering.
- Preserve the current discovery rule: a single move adds only the last newly completed collection's discovery; a batch adds discoveries for every newly completed collection. `App` merges returned discoveries with the existing Notebook object so unrelated Notebook fields remain intact.
- Preserve atomic batch allocation failure, per-item validation on successful mixed batches, reward and puzzle progression, rotations, and current UI/audio outcomes.
- Keep persistence commits, audio events, focus, selection cleanup, panel state, and toast wording in `App.jsx`.
- Do not change authored content, save schema, or the active browser-scaling/human-playtest gate.

## Verification scope

- The Test Engineer added `tests/unit/game-foundation/placement-transactions.test.mjs` before implementation. It covers:
  - A single move that completes the final chapter collection, earns its reward, unlocks its puzzle, adds its discovery once, and leaves the input game immutable.
  - An atomic batch with both correctly filed and misfiled items, preserving game-item order and reporting per-item validation counts.
  - A batch that completes the final two items in a chapter collection, earning its reward and unlocking the chronology puzzle with one discovery.
  - A batch rejected for scratch-pad capacity overflow, returning no changes and leaving the input game untouched despite one slot being available for the first staged item.
- Red baseline: `node --test --test-isolation=none tests/unit/game-foundation/placement-transactions.test.mjs` failed as expected with `ERR_MODULE_NOT_FOUND` for `src/game/domain/placementTransaction.js`.
- After implementation, the focused placement-transaction unit test passed 4/4 after implementation and again after order-case refinement; organizing-loop and research-chapter browser tests passed 17/17.
- Do not run the full test suite.

## Final verification and review

- The pre-implementation baseline failed as expected with `ERR_MODULE_NOT_FOUND` for `src/game/domain/placementTransaction.js`.
- `node --test --test-isolation=none tests/unit/game-foundation/placement-transactions.test.mjs` passed 4/4 after implementation and again after refining the reversed-ID order case.
- Organizing-loop and research-chapter Playwright E2E passed 17/17.
- The Vite build passed with 60 modules. The initial sandbox attempt returned `EPERM`; a process-access retry passed.
- Code review found no production issue and confirmed the reversed IDs prove game-item order.
- Scoped `git diff --check` found no whitespace errors, only an LF-to-CRLF notice.
- The full test suite was not run. The active browser-scaling/human-playtest gate remains open, and content expansion remains gated.

## Acceptance criteria

- Single and batch planners return deterministic outcomes without mutating their input game state.
- Rejections contain no commit changes; failed batches remain all-or-nothing.
- Successful moves preserve existing placement geometry, validation, rewards, puzzle unlocks, and Notebook discovery behavior.
- `App.jsx` consumes planner outcomes and retains all React, persistence, focus, panel, audio, and feedback side effects.
- Focused unit and E2E verification passes; the full suite is not run.
- The independent human-playtest/content-expansion gate remains open and unchanged.
