# Plan: Coordinate the Clockwork Atlas at Compact Widths

## Goal

Keep the Clockwork Atlas usable alongside the game's panels at compact
viewports. At widths of 720px or less, prevent the Atlas from being hidden
behind Notebook, Instruments, Inspector, or Puzzle panels while preserving the
existing desktop overlay behavior.

## Responsive behavior

- At compact widths, opening the Atlas closes any open side panel.
- At compact widths, opening Notebook, Instruments, Inspector, or Puzzle closes
  the Atlas.
- If the viewport changes from desktop to compact with the Atlas and a right
  side panel open, close the Atlas and keep the right panel, matching the
  existing compact resize priority.
- Preserve current behavior at widths above 720px, including the desktop
  ability to show the Atlas alongside side panels.
- Closing the Atlas programmatically from a side-panel control must leave focus
  on the control the user activated rather than moving it to the Atlas toggle.

## Constraints

- Use the existing 720px compact breakpoint.
- Change only transient panel coordination and focus behavior. Preserve item
  selection, progression, camera position, Atlas navigation, saved state and
  schema, catalog, and rendering behavior.
- Preserve existing Atlas/Finder coordination and keyboard controls.
- Do not run the full test suite without user approval.

## Affected files

- `src/app/App.jsx`: coordinate compact Atlas visibility with the existing
  side-panel state and viewport-size transitions.
- `src/ui/WorldViewport.jsx`: expose Atlas open/close coordination to App while
  retaining its local camera and gesture lifecycle; support programmatic close
  without stealing focus.
- `e2e/lab/world-atlas.spec.js` and/or
  `e2e/lab/panel-coordination.spec.js`: add focused compact and desktop
  regressions.

## Initial verification scope

- Verify both directions at 390 × 480: opening Atlas closes side panels, and
  opening side panels closes Atlas.
- Verify desktop Atlas and side-panel coexistence remains unchanged.
- Verify resizing to compact closes Atlas when a right panel is open and keeps
  the right panel visible.
- Verify programmatic Atlas closure leaves focus on the activated panel
  control, and existing Finder/Atlas behavior remains intact.
- Run focused browser tests, the production build, and code review. Do not run
  the full suite without user approval.

## Test plan

The Test Engineer added three regressions in `e2e/lab/world-atlas.spec.js`:

1. `compact Notebook opening closes the Atlas without stealing focus` checks
   that opening Notebook closes Atlas at compact width while focus remains on
   the Notebook control.
2. `compact Atlas opening closes Inspector while preserving item selection`
   checks that opening Atlas at compact width closes Inspector without losing
   the selected item.
3. `desktop Atlas and Inspector coexist, then compact resize keeps Inspector
   and closes Atlas` verifies desktop coexistence, then focuses the Atlas map
   before resizing to compact and checks that Inspector remains, Atlas closes,
   and focus returns to the Atlas toggle.

Focused command:

~~~sh
npx playwright test e2e/lab/world-atlas.spec.js --workers=1 --grep "compact Notebook opening|compact Atlas opening|desktop Atlas and Inspector"
~~~

The red baseline failed all three tests only at the expected coordination
assertions: Atlas stayed open when Notebook opened; Inspector stayed open when
Atlas opened; and Atlas stayed open after resizing from desktop to compact.
Setup and preceding assertions passed.

## Final verification (2026-11-03)

- The focused Atlas coordination regressions passed 3/3. The combined
  `world-atlas.spec.js` and `panel-coordination.spec.js` run passed 27/27.
- The Vite production build passed. Code Reviewer confirmed both findings
  resolved and reported no remaining issues.
- The scoped diff-check was clean aside from expected LF-to-CRLF conversion
  warnings. The full test suite was not run.
- The independent human-playtest/content-expansion gate remains open.
