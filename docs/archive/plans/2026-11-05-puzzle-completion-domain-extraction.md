# Plan: Extract Puzzle Completion into the Game Domain

**Status:** Complete. The extraction, focused verification, review, and project documentation are finalized. The independent browser-scaling/human-playtest gate remains open, and content expansion stays gated.

## Goal and evidence

Move puzzle eligibility checks and the completion/reward state transition from `handleSolvePuzzle` in `src/app/App.jsx` into a pure domain planner at `src/game/domain/puzzleCompletion.js`. Keep the game-state calculation separate from App's audio events, toast copy, and other UI effects.

## Scope and constraints

- Add `src/game/domain/puzzleCompletion.js`, exporting `planPuzzleCompletion({ game, puzzleId })`.
- Preserve the current silent validation order: already solved, puzzle lookup, completed-collection prerequisites, then puzzle unlock state.
- For a no-op, return `{ ok: false, reason }` with one of `already-solved`, `unknown-puzzle`, `prerequisites-unmet`, or `not-unlocked`. Do not return `nextGame` for no-ops.
- For a successful solve, return `{ ok: true, nextGame, fromStage, toStage }`.
- Keep the planner pure and preserve the input game. Update solved puzzle IDs, invention stage, and Notebook discoveries immutably in `nextGame`.
- Add the puzzle reward clue only when it is not already in Notebook discoveries.
- Keep invention stage progression monotonic and preserve support for the `memory-crystal` reward-stage alias.
- Keep `puzzle.completed`, stage-change, and assembly audio event emission and existing toast wording in `App.jsx`.
- Do not change authored puzzle content, save schema, or the active browser-scaling/human-playtest gate.

## Verification scope

- The Test Engineer added `tests/unit/game-foundation/puzzle-completion.test.mjs` before implementation. It covers:
  - Already-solved validation taking precedence over a missing unlock, with the exact `already-solved` reason.
  - An unknown puzzle ID returning the exact `unknown-puzzle` reason.
  - Chronology prerequisites being checked before unlock state, returning `prerequisites-unmet`.
  - Met prerequisites with no unlock returning `not-unlocked`.
  - A pulse solve awarding the Memory Crystal stage and clue while preserving deep input immutability and unrelated state; success asserts `fromStage` and `toStage`.
  - A chronology solve awarding the Chronology Wheel stage and clue, with success stage fields asserted.
  - Reward clue deduplication when the clue is already present.
  - Monotonic stage behavior when solving the pulse puzzle while already at Chronology Wheel.
- Red baseline: `node --test --test-isolation=none tests/unit/game-foundation/puzzle-completion.test.mjs` failed as expected with `ERR_MODULE_NOT_FOUND` for `src/game/domain/puzzleCompletion.js`.
- The focused puzzle-completion unit test passed 8/8. Organizing-loop and research-chapter puzzle browser cases passed 17/17.
- Do not run the full test suite.

## Final verification and review

- The pre-implementation baseline failed as expected with `ERR_MODULE_NOT_FOUND` for `src/game/domain/puzzleCompletion.js`.
- `node --test --test-isolation=none tests/unit/game-foundation/puzzle-completion.test.mjs` passed 8/8.
- Organizing-loop and research-chapter E2E passed 17/17.
- The Vite build passed with 61 modules.
- Scoped review found no actionable regression.
- Scoped `git diff --check` found no whitespace errors, only LF-to-CRLF notices.
- The full test suite was not run. The independent human-playtest/content-expansion gate remains open.

## Acceptance criteria

- The domain planner returns the specified no-op reason without `nextGame` and preserves the current validation order.
- Successful plans update solved IDs, reward clue, and invention stage immutably, preserving the existing monotonic stage behavior and alias.
- `App.jsx` consumes the planner result while retaining audio, stage/assembly event, toast, and other UI effects.
- Focused unit and relevant puzzle E2E verification pass; the full suite is not run.
- The independent browser-scaling/human-playtest gate remains open and unchanged.
