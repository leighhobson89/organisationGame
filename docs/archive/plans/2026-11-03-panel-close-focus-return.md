# Plan: Return Focus When Closing Inspector and Puzzle Panels

## Goal

Make closing Inspector and Puzzle panels keyboard-friendly by returning focus
to the control that opened the panel, while preserving current selection and
game state.

## Focus behavior

- Closing Inspector returns focus to the selected world-item control. For a
  group selection, try the current selected item first, then the first selected
  item ID if the current selection cannot receive focus.
- Closing Puzzle returns focus to the persistent Open Puzzle header button.
- Apply the same behavior across desktop and compact layouts and for pointer or
  keyboard activation of the close control.

## Constraints

- Preserve selected item IDs, multi-selection mode, camera position,
  progression, save data/schema, and panel visibility behavior beyond the
  focus return.
- Preserve existing keyboard interactions, including focus transfer into
  Inspector move controls and puzzle controls.
- Keep focus return resilient when the focused item is represented by the
  hybrid Canvas renderer or the 64-overlay policy.
- Do not run the full test suite without user approval.

## Affected files

- `src/app/App.jsx`: coordinate panel-close callbacks with the appropriate
  world-item or Open Puzzle control.
- `src/ui/WorldViewport.jsx`: expose or extend an imperative focus helper for
  selected world-item controls, including the ordered fallback for groups.
- `e2e/lab/filed-note-title.spec.js` and
  `e2e/lab/organising-loop.spec.js` and
  `e2e/lab/panel-coordination.spec.js`: add focused single-selection, group-
  selection, and puzzle-close focus regressions as appropriate.

## Initial verification scope

- Close Inspector for a single selection and check focus returns to that item.
- Close Inspector for a group selection and verify focus returns to the
  current selected item. Implement the first-selected-ID fallback if the
  current item cannot receive focus; the focused regression does not directly
  cover this fallback.
- Close Puzzle and check focus returns to the persistent Open Puzzle header
  button.
- Verify desktop and compact layouts retain existing selection, movement,
  puzzle behavior, and saved state.
- Run focused browser tests, the production build, and code review. Do not run
  the full suite without user approval.

## Test plan

The Test Engineer added three focused cases:

1. `dragging a card under a selected title reveal files it in its destination`
   in `e2e/lab/filed-note-title.spec.js`: the shared title-reveal fixture
   asserts the selected note remains pressed and regains focus after closing
   Inspector.
2. `the player can recover a misfiled card, restore its collection, and solve
   the revealed puzzle` in `e2e/lab/organising-loop.spec.js`: after solving and
   closing Puzzle, assert that the panel hides and focus returns to the
   persistent Open Puzzle header control.
3. `closing a group Inspector returns focus to the current item and retains
   the selection` in `e2e/lab/panel-coordination.spec.js`: at 1280 × 720,
   select `calibration-card-01` and `calibration-card-02`, close Inspector,
   verify both remain selected and the count remains two, then assert focus
   returns to current item `calibration-card-02`. The current-item-unavailable
   fallback is not directly covered by this case.

Focused commands:

~~~sh
npx playwright test e2e/lab/filed-note-title.spec.js e2e/lab/organising-loop.spec.js --workers=1 --grep "dragging a card under a selected title reveal|the player can recover a misfiled card"
npx playwright test e2e/lab/panel-coordination.spec.js --workers=1 --grep "closing a group Inspector returns focus"
~~~

The red baseline failed all three selected cases exactly at their
`toBeFocused()` assertions. In the group case, setup and selection/count
preservation passed before the focus assertion failed. The single-item and
puzzle cases also passed their preceding selection, movement, progression, and
puzzle-solving checks.

## Final verification (2026-11-03)

- The three focused Inspector/Puzzle close-focus cases passed 3/3. The relevant
  `filed-note-title.spec.js`, `organising-loop.spec.js`, and
  `panel-coordination.spec.js` run passed 40/40.
- The production build passed. Code Reviewer found no issues. Scoped
  diff-check was clean aside from expected LF-to-CRLF conversion warnings.
- The first-selected-ID fallback for group selection is implemented but was
  not directly regression-tested. The full test suite was not run.
- The independent human-playtest/content-expansion gate remains open.
