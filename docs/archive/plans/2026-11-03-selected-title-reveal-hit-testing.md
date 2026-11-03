# Selected title reveal hit testing

## Goal

Allow pointer interaction with a nearby overlapping game object when a
selected card's readable title reveal covers it. Keep the selected title
readable while restoring core drag/drop access to the underlying object.

## Proposed implementation and constraints

- Architect's preliminary recommendation is `pointer-events: none` on the
  reveal when its parent `.lab-object` is selected. Confirm the edge case where
  the reveal overlaps empty world background: pointer input there must not
  create surprising pan/drag behavior or break reveal hover continuity.
- Preserve hover-only reveal positioning and continuity, keyboard and focus
  behavior, accessibility, item geometry, and save data.
- Update stale scratch-pad `aria-label` assertions to match the current markup;
  this is test maintenance, not a markup change.

## Focused verification

- The new covered-card drag regression in
  `e2e/lab/filed-note-title.spec.js` fails before the fix: the destination
  remains at 1/8. A second case verifies that dragging in the empty spill area
  does not pan; it passes on the baseline.
- Six stale scratch-pad `aria-label` assertions are updated to the current
  `N of 24 spaces used` wording.
- Run both focused pointer cases with `npx playwright test e2e/lab/filed-note-title.spec.js --workers=1 --grep "dragging a card under a selected title reveal|dragging in a selected title reveal spill area"`.
- Run drag/drop recovery coverage with `npx playwright test e2e/lab/world-and-save-recovery.spec.js --workers=1 --grep "physical dragging files an item to a destination|a physical drop on a full scratch pad|physical dragging an existing occupant|inspector capacity rejection"`.
- Run the full focused title spec with
  `npx playwright test e2e/lab/filed-note-title.spec.js --workers=1` and
  `npm run build`.
- Do not run the full suite for this slice.

## Outcome (2026-11-03)

- The selected-title reveal now passes pointer input through to a covered card.
  The empty spill-area regression confirms the same pointer geometry does not
  start a world pan. Six stale scratch-pad accessible-label assertions were
  updated to expect `N of 24 spaces used`.
- `node --test --test-isolation=none
  tests/unit/game-foundation/camera-pinch.test.mjs` passed 4/4.
- `npx playwright test e2e/lab/touch-navigation.spec.js
  e2e/lab/world-and-save-recovery.spec.js e2e/lab/organising-loop.spec.js
  e2e/lab/filed-note-title.spec.js --workers=1` passed 53/53, including the
  covered-card drag, spill-area no-pan, physical drag/drop recovery, and title
  reveal cases. The title spec passed 13/13.
- `npm run build` passed with Vite 8.3.5. Code Reviewer found no correctness
  findings; `git diff --check` was clean. The full suite was not run.
