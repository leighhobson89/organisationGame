# Plan: Preserve Focus When Collection Unlocks a Puzzle

## Problem

Completing a collection can replace the Inspector with its newly unlocked puzzle. The Inspector's Move handler schedules focus back to its Move button, but that button is removed when the puzzle opens. The batch move path also skips its selection-toggle focus fallback when a puzzle unlocks. Keyboard users can therefore lose their place when the new puzzle appears.

## Scope and implementation

- When `PuzzlePanel` opens, move focus to its first available puzzle choice so keyboard users can continue immediately.
- If there is no available choice, focus the puzzle heading as a stable fallback.
- Cover automatic puzzle opening after both a single-item Inspector move and a group Inspector move.
- Preserve existing puzzle selection, puzzle solving, placement, save, and pointer behavior.

## Acceptance criteria

- After a keyboard-initiated single-item move completes a collection and opens its puzzle, the first choice receives focus.
- After a keyboard-initiated group move completes a collection and opens its puzzle, the first choice receives focus.
- Pressing Enter after focus lands on the first choice activates it and updates the entered sequence.
- When no puzzle choice is available, the heading receives focus.
- Manual puzzle selection and pointer-based moves continue to work as before.
- No placement, progression, or persistence data changes beyond the existing collection and puzzle unlock.

## Focused verification

- Red baseline command: `npx playwright test e2e/lab/organising-loop.spec.js --grep "accessible multi-selection completes|keyboard item move that unlocks" --workers=1 --reporter=line`; both cases failed because `puzzle-symbol-0` was not focused after the newly unlocked puzzle opened. The initial sandbox run returned `EPERM`; the process-access run confirmed the 2/2 red baseline.
- Final move-focus verification: the same command passed 2/2. Both cases assert focus on the first choice and successful Enter activation; the group case retains reward, puzzle unlock, and saved-placement assertions.
- Solved fallback verification: `npx playwright test e2e/lab/research-chapter.spec.js --grep "v2 migration preserves the old placement" --workers=1 --reporter=line` passed 1/1, asserting heading focus after reopening the solved Chronology puzzle. The sandbox worker spawn returned `EPERM`; the process-access rerun passed.
- `npm run build` passed with Vite 8.3.5 (62 modules). Code Reviewer re-review found no actionable issues. The full suite was not run.
- Updated ROADMAP, ARCHITECTURE, and TESTING_GUIDE with the behavior and verification results.

## Status

Implemented and verified; archived 2026-11-05.
