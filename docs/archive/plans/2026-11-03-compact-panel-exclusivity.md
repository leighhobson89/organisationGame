# Plan: Make Side Panels Exclusive at Compact Widths

## Goal

Prevent the left and right game panels from overlapping at viewport widths of
720px or less. Keep the Notebook/Skills group on the left and the
Inspector/Puzzle group on the right, but allow only one side to be open at a
time on compact screens. Preserve the existing ability to show panels from
both sides together on desktop.

## Responsive panel behavior

- At compact widths, manually opening a left-side panel closes the right-side
  panel; manually opening a right-side panel closes the left-side panel.
- Selecting an item on compact closes the left panel and opens the Inspector.
  On desktop, selecting an item keeps an open left panel while opening the
  Inspector.
- If the viewport changes from desktop to compact while both sides are open,
  keep the right-side panel and close the left-side panel.
- On compact collection completion, prioritize a newly unlocked Puzzle and
  close any left panel. If no puzzle unlocks, show the Notebook and close the
  Inspector. Preserve the existing desktop collection-completion presentation.

## Constraints

- Treat `720px` and below as compact, matching the existing responsive
  breakpoint.
- Preserve current selection, collection rewards, puzzle unlocks, progression,
  camera behavior, save data/schema, catalog/content, and rendering behavior.
  Only transient panel visibility coordination changes.
- Keep desktop panel coexistence unchanged.
- Preserve panel controls and their existing keyboard/focus behavior.
- Do not run the full test suite without user approval.

## Affected files

- `src/app/App.jsx`: coordinate the left/right panel states for manual opening,
  item selection, resize from desktop to compact, and collection completion.
- `e2e/lab/panel-coordination.spec.js`: extend the existing panel E2E with
  compact transitions and unchanged desktop coexistence.

## Verification scope

- Extend `e2e/lab/panel-coordination.spec.js` to cover Notebook-to-item
  selection and Inspector-to-Notebook opening at compact size; automatic
  Puzzle priority when a collection unlocks it; desktop coexistence; and
  desktop-to-compact resize with the right panel retained. Include a 390 × 480
  check that the Inspector's Move action remains usable.
- Run the focused E2E, `npm run build`, and code review.
- Do not run the full test suite without user approval.

## Test plan

The Test Engineer extended `e2e/lab/panel-coordination.spec.js` with five
focused cases:

1. `at compact width, selecting an item closes Notebook and keeps Inspector
   Move usable` covers 390 × 480, left-panel closure on selection, Inspector
   opening, and a working Move action.
2. `at compact width, opening Notebook closes Inspector but preserves item
   selection` checks the opposite manual panel transition without losing the
   current item selection.
3. `desktop allows Notebook and Inspector together, then compact resize keeps
   Inspector only` verifies desktop coexistence and right-panel priority when
   resizing to 390 × 480.
4. `compact chapter completion prioritizes the newly unlocked puzzle over
   Notebook` completes the third chapter-two collection and checks that the
   newly unlocked chronology panel is shown.
5. `compact chapter completion without a puzzle shows Notebook and closes
   Inspector` completes an earlier chapter collection and checks Notebook
   priority when no puzzle unlocks.

Focused command:

~~~sh
npx playwright test e2e/lab/panel-coordination.spec.js --workers=1 --grep "at compact width|desktop allows|compact chapter"
npm run test:e2e -- --workers=1 e2e/lab/panel-coordination.spec.js
~~~

The focused red command ran the five new cases and failed all five at the
expected compact panel-visibility assertions:

- On compact item selection, Notebook stayed open; Inspector and its Move
  action opened and worked.
- Manually opening Notebook left Inspector open; the selected item's
  `aria-pressed` state and `.is-selected` highlight remained intact.
- Desktop Notebook/Inspector coexistence passed; resizing to compact left
  Notebook open instead of keeping only Inspector.
- After the third chapter-two collection completed and Chronology unlocked,
  both the puzzle and Notebook were visible instead of prioritizing the puzzle.
- After an earlier chapter collection completed without a puzzle unlock,
  Notebook opened but Inspector remained visible.

The completion fixtures used two earned collections plus seven of eight items
filed in the third, and one earned collection plus seven of eight in the
second; the final member was filed through Inspector at 390 × 480.

## Final verification (2026-11-03)

- The focused five-case regression passed 5/5. The full
  `panel-coordination.spec.js` passed 13/13.
- The Vite production build passed; Code Reviewer found no actionable findings.
  The scoped diff-check was clean apart from expected CRLF conversion warnings.
- The full test suite was not run. The independent human-playtest/content-
  expansion gate remains open.
