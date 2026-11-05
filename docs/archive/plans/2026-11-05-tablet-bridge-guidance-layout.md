# Plan: Tablet-Bridge Fresh-Start Layout

**Status:** Complete (2026-11-05). The tablet-bridge guidance layout is implemented, reviewed, and focused-verified.

## Goal and scope

Keep the complete first-action hint, toolbar, Harmonic Calibration Folio, and first clue clear and usable at tablet-bridge widths from 721px through 1050px, at viewport heights of at least 720px. This fills the responsive gap between the compact layout (through 720px) and the medium-desktop reserved guidance bay (starting at 1051px).

Test fresh first-action games with no panel, Atlas panel, Finder, or Inspector open. Preserve valid saved/imported camera values exactly. Fresh/reset framing may receive the scoped camera adjustment below. Keep the existing compact layout at widths up to 720px and the 1051px-and-up medium-desktop guidance bay unchanged.

## Confirmed regression scope

Cover two boundary viewports across every currently supported text scale:

| Viewport | Text scales |
| --- | --- |
| 721×720 | 100%, 112.5%, 125%, 150%, 175%, 200% |
| 1050×900 | 100%, 112.5%, 125%, 150%, 175%, 200% |

This gives 12 layout cases in `e2e/lab/tablet-bridge-guidance.spec.js`. The spec also includes one saved-camera/autosave case and one real selection-feedback toast case, for 14 tests total. Each fresh-start case checks the full first-action copy, hint/toolbar/Atlas bounds and overlap with each other and visible world cards, no horizontal document overflow, Folio/clue containment and center hit testing, and keyboard traversal, focus visibility, accessible names, and hit testing for visible toolbar controls. It requires scroll progress only when the rail overflows. The 721×720/200% case also verifies the final toolbar and Atlas placement, the 172px reserved bay, and at least 6px clearance between the first clue and world viewport edge. The camera case loads a known saved transform, resizes across the 721px boundary, and verifies both the live transform and exact autosave bytes remain unchanged. The toast case selects an item at 721×720/200% and verifies the toast uses the reserved bay while the hint is hidden.

## Red baseline

All 12 layout cases fail the expected overlay/card-clearance assertion. At 721×720 and 100%, the hint spans y=549–644 and overlaps the toolbar at y=631–706 as well as visible cards; the Atlas toggle at y=223–259 overlaps the Folio at y=231–381. The baseline reports no horizontal page overflow and no follow-on Folio/clue geometry, hit-testing, or toolbar-focus failures. The camera/autosave case passes. These results isolate the defect to fresh-start overlay/card clearance while preserving the existing camera state.

The red selection-toast baseline at 721×720/200% failed as expected: the first-action hint remained visible and the toast occupied y=499.66–594 while the world viewport ended at y=720. The toast overlapped the Folio, calibration clues, visible cards, and toolbar. The Architect-approved target hides the hint while a toast is visible and uses the reserved bottom guidance bay for that toast.

## Implemented layout

1. For 721–1050px widths and heights of at least 720px, the no-panel fresh-start and selection-guidance selectors reserve the world viewport's bottom area for the full-width hint. At 200%, the world viewport uses `bottom: 172px`. A non-empty toast hides the hint and uses the reserved bay.
2. The one-row toolbar rail sits in the safe top band with `top: -12px`, `left: calc(50% - 120px)`, `right: 16px`, `width: auto`, and `justify-content: flex-start`; its controls do not shrink or wrap and the rail scrolls horizontally as needed. The Atlas toggle uses compact styling at the top left.
3. Fresh/reset framing applies a total tablet-bridge `panY` adjustment of −50px. At 721×720/200%, the first clue clears the world viewport boundary by at least 6px. This offset applies only to fresh/reset framing; valid saved/imported camera transforms and autosave bytes remain unchanged.
4. Default-scale, compact-width, short-height, panel, Atlas-panel, Finder, Inspector, and medium-desktop behavior outside this scope remain unchanged.

## Layout and interaction requirements

- Keep the full first-action hint copy within the browser viewport and clear of the toolbar, Atlas control, and visible world cards.
- Keep the toolbar in a one-row scrollable safe top band to the right of the Folio; keep the compact Atlas toggle at top left. Keep the Folio and first clue fully inside the world viewport and center-hit-testable, with at least 6px clue clearance at 721×720/200%.
- Prevent horizontal page overflow.
- Keep toolbar controls reachable by keyboard and center-hit-testable. If the toolbar uses horizontal scrolling, focus a control and require scroll movement only when that focusable control is clipped; verify the accessible label remains available.
- Ensure selectors for the bottom guidance layout match both the first-action lead and selection-guidance copy.
- At 721×720 and 200%, use a real item selection to show feedback; verify the hint hides and the toast sits in the reserved bay without overlapping the Folio, clues, visible cards, toolbar, or Atlas control.
- Add one saved-camera case to confirm layout changes do not reset the live transform or saved camera value.

## Likely files and handoff

Implementation files are `src/styles/app.css` and `src/game/persistence/gameState.js`; focused coverage is in `e2e/lab/tablet-bridge-guidance.spec.js`. The responsive verification also covers `e2e/lab/medium-desktop-guidance-bay.spec.js`, `e2e/lab/compact-start-framing.spec.js`, and the scaled/desktop hint regressions.

Final verification passed 56/56 focused responsive E2E checks across tablet, medium-desktop, compact-start, and scaled/desktop hint cases. `npm run build` passed with Vite 8.3.5 and 62 modules. The full suite was not run. Focused review is complete.

## Acceptance criteria

- [x] The full hint, toolbar, Atlas control, Folio, and first clue meet the geometry requirements across the 12-case matrix.
- [x] The page has no horizontal overflow; toolbar actions remain focusable and hit-testable, with conditional focus scrolling when a focusable control is clipped.
- [x] At 721×720/200%, the Atlas toggle uses compact top-left styling; the one-row toolbar rail uses the specified top, left, right, and width values.
- [x] At 200%, the world viewport reserves 172px for the guidance bay; styles apply to first-action and selection guidance, and a visible toast hides the hint and uses the bay.
- [x] Fresh/reset framing applies a total `panY` adjustment of −50px and leaves at least 6px between the first clue and world viewport edge. Saved/imported camera transforms and autosave bytes remain unchanged.
- [x] Real selection feedback places the toast inside the reserved bay without overlapping the Folio, clues, visible cards, toolbar, or Atlas control.
- [x] Existing compact and medium-desktop layouts remain unchanged.
- [x] Focused responsive regressions passed 56/56; the Vite 8.3.5 build passed with 62 modules. The full suite was not run.
- [x] The independent human two-chapter playtest remains deferred and the content-expansion gate remains open.

The tablet-bridge layout does not close or contribute human playtest evidence toward the separate two-chapter/content-expansion gate.
