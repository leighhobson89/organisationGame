# Plan: Coordinate Item Finder and Side Panels at Compact Widths

## Goal

Keep Item Finder and the side panels usable at compact viewports by preventing
them from obscuring each other. Preserve desktop coexistence and existing
Inspector/Finder and Atlas/Finder behavior.

## Responsive behavior

- At widths of 720px or less, opening Item Finder closes Notebook or
  Instruments.
- At compact widths, opening Notebook or Instruments closes Item Finder.
- Preserve desktop behavior: Finder and Notebook/Skills may remain open
  together, and existing Inspector/Finder transitions remain intact.
- If the viewport changes from desktop to compact while Finder and a side
  panel are open, close Finder and keep the side panel.
- Closing Finder programmatically from a side-panel control keeps focus on that
  control. If resizing closes a Finder that held focus, return focus to the
  Finder toggle.

## Constraints

- Use the existing 720px compact breakpoint.
- Preserve item selection, camera behavior, save data/schema, and Atlas/Finder
  coordination. Change only transient panel visibility and focus handling.
- Preserve the existing Inspector/Finder behavior, including selecting a
  Finder result closing Finder and opening Inspector.
- Do not run the full test suite without user approval.

## Affected files

- `src/app/App.jsx`: coordinate the side-panel state with Finder visibility at
  compact widths and on resize.
- `src/ui/WorldViewport.jsx`: expose Finder open/close coordination to App and
  support programmatic closure without stealing focus.
- `e2e/lab/panel-coordination.spec.js` and/or
  `e2e/lab/item-finder-announcements.spec.js`: add focused responsive
  coordination and focus regressions.

## Initial verification scope

- At 390 × 480, verify opening Finder closes Notebook/Skills and opening
  Notebook/Skills closes Finder.
- Verify desktop Finder and Notebook coexistence and existing Inspector/Finder
  behavior.
- Verify desktop-to-compact resize keeps the side panel and closes Finder.
- Verify side-panel controls retain focus when closing Finder, and resize
  returns focus to the Finder toggle if Finder held focus.
- Run focused browser tests, the production build, and code review. Do not run
  the full suite without user approval.

## Test plan

The Test Engineer added four cases in `e2e/lab/panel-coordination.spec.js`:

1. `at compact width, opening item Finder closes Notebook and focuses its
   search field` checks the compact transition from Notebook to Finder and
   search-field focus.
2. `at compact width, opening Notebook closes Finder and keeps focus on
   Notebook` checks the reverse compact transition and preserves focus on the
   Notebook control.
3. `desktop Finder and Notebook coexist, then compact resize closes Finder and
   restores its toggle focus` verifies desktop coexistence, then resizes with
   Finder focused and checks Finder closes while its toggle receives focus.
4. `compact resize closes Finder without stealing focus when it was outside
   Finder` checks resize closure while focus remains on the Notebook control.

Focused command:

~~~sh
npx playwright test e2e/lab/panel-coordination.spec.js --workers=1 --grep "compact width, opening item Finder|compact width, opening Notebook closes Finder|desktop Finder and Notebook coexist|compact resize closes Finder"
~~~

The red baseline failed all four cases only on the expected closure assertions.
Desktop Finder/Notebook coexistence passed before the resize assertion failed.

## Final verification (2026-11-03)

- The focused Finder coordination regressions passed 4/4. The combined
  `panel-coordination.spec.js`, `world-atlas.spec.js`, and
  `item-finder-announcements.spec.js` run passed 35/35.
- The production build passed. Code Reviewer found no issues.
- Scoped diff-check was clean aside from expected line-ending warnings. The
  full test suite was not run.
- Existing Inspector/Finder and Atlas/Finder behavior, desktop coexistence,
  selection, camera, and save behavior remain preserved.
