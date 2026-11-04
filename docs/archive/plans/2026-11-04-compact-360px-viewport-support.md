# Compact Viewport Support from 360px

## Goal

Keep the fresh-start hint, first calibration clue, and world toolbar usable at compact viewport heights from 360px through 399px on widths up to 720px, at 150% text scale.

## Scope

- Address the current 400px `.game-shell` minimum height and extend the short-height compact layout, whose toolbar and fresh-start rules currently begin at 400px.
- Apply the 360–399px first-action layout only to the no-panel fresh-start state. Keep its lead and first-clue presentation usable while making toolbar controls visible, reachable, and operable.
- When a panel is open, preserve the existing panel-specific short-height layout and the full `.world-hint__controls` row even if first-action guidance is still showing. Preserve Inspector, Notebook, Skills, Puzzle, Finder, and Atlas layout, focus, and coordination behavior.
- Limit changes to `src/styles/app.css`, and to `src/game/persistence/gameState.js` only if the unchanged-source baseline demonstrates that the fresh-start camera nudge must also cover this height range.
- Preserve behavior and layout at heights of 400px and above, desktop behavior, and layouts wider than 720px.
- Do not change game content, input semantics, persisted camera behavior, save data, or schema.

## Implementation and Verification

- Add the minimum CSS needed to support the no-panel fresh-start state at 360–399px. Scope first-action styles so they do not create the fresh-start horizontal toolbar rail or hide `.world-hint__controls` while a panel is open.
- If a camera-nudge extension is needed, keep it scoped to fresh-start framing in `gameState.js`; use the baseline to establish that need before making the change.
- Verify `compact-start-framing.spec.js` and `mobile-toolbar.spec.js` at 320 × 360 and 667 × 375 with 150% text. Cover viewport bounds and overflow, hint and first-clue visibility and hit testing, toolbar control visibility and hit testing, and clearance between the hint and toolbar.
- Retain existing 400px-and-up, compact breakpoint, and desktop checks to guard the preservation boundary.
- Run the focused E2E coverage only; do not run the full suite without user approval.

## Test Plan

The focused regressions are in `e2e/lab/compact-start-framing.spec.js` and `e2e/lab/mobile-toolbar.spec.js`:

- The 150% fresh-start cases at 320 × 360 and 667 × 375 verify the Harmonic Calibration Folio and first clue remain mostly exposed and center-hit-testable.
- The toolbar cases verify toolbar text and targets remain visible, unclipped, and hit-testable, and that the first-action hint fits without overlapping the toolbar.
- Retain the existing 375 × 667 fresh-start framing case as a preservation check; it passed in the baseline.
- A saved-camera-at-320 × 360 guard verifies the compact fresh-start camera adjustment does not alter a persisted camera; the existing 375 × 667 saved-camera regression remains in place.
- The focused panel-state regression in `mobile-toolbar.spec.js` opens Inspector at 320 × 360 while the first-action lead remains visible; it requires `.world-hint__controls` to remain visible and confirms the fresh-start horizontal toolbar rail is not applied. Existing Inspector/Notebook/Skills/Puzzle/Finder/Atlas coordination coverage remains in scope.

Pre-implementation baseline: all four new short-height fresh-start cases failed while the existing 375 × 667 fresh-start framing case passed. At 320 × 360, Folio exposure was 0.413, the hint began at y=201.4, and the toolbar ended at y=390, below the 360px viewport. At 667 × 375, Folio exposure was 0.468 and the toolbar ended at y=390, below the 375px viewport. The new 320 × 360 panel-state regression also failed as expected: `.world-hint__controls` remained hidden with Inspector open.

## Outcome

- The focused `compact-start-framing.spec.js` and `mobile-toolbar.spec.js` E2E run passed 36/36, including 320 × 360 and 667 × 375 at 150%, the 320 × 360 Inspector hint-controls guard, and saved-camera preservation at 320 × 360.
- The Vite production build passed with 59 modules.
- Code review confirmed the short-height first-action layout is limited to the no-panel fresh-start state and found no remaining issues.
- The full test suite was not run. The independent human playtest remains deferred, so content expansion remains gated.

This finalized plan is archived at `docs/archive/plans/2026-11-04-compact-360px-viewport-support.md`.
