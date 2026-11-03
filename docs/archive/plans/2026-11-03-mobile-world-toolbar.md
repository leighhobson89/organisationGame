# Mobile world toolbar regression

**Status:** Complete (2026-11-03). The CSS implementation, focused E2E, build,
final review, and project documentation are complete. The separate
human-playthrough/content-expansion gate remains active.

## Goal and boundaries

At viewport widths up to 720px, keep all world navigation and selection controls readable, visible, and inside the viewport. The 390x480 Edge repro shows the toolbar itself stays within x=10..380, but flex shrinking reduces its controls and `#world-jump` to 36px, clipping labels. Preserve the existing desktop layout, control order and semantics, keyboard access, live status labels, camera/game state, saves, and pointer behavior. This is a CSS layout fix plus focused browser regression coverage; no application logic or save-format changes.

## Implementation

1. In the mobile `.game-toolbar` rules in `src/styles/app.css`, allow controls to wrap into rows and remove horizontal scrolling that masks clipped controls. Keep the toolbar constrained to the existing 10px viewport gutters and align rows so every control remains inside its bounds.
2. Prevent toolbar children from flex-shrinking below their content width. Restore an explicit mobile minimum width for `.world-jump` after the generic `.hud-control` rule so the selected destination is readable. Preserve the existing compact zoom controls and all control text.
3. Check the expanded toolbar against the mobile world hint and other overlays at 320x480 and 390x480. Adjust only mobile hint placement if needed to avoid the toolbar or selection toast obscuring it; keep the hint non-interactive and preserve its content.
4. Leave desktop rules and React markup/behavior unchanged.

## Regression coverage

The focused Playwright regression in `e2e/lab/mobile-toolbar.spec.js` verifies:

- At 390x480, assert the toolbar and each visible control's bounding box fit within the viewport, and toolbar children do not overlap one another.
- At 320x480, assert the toolbar and selection toast remain within the viewport; check hint/toolbar non-overlap in the normal state and hint/toast plus toolbar/toast non-overlap while the selection toast is visible.
- Assert accessible controls for Zoom out, Zoom in, Jump to laboratory location, Reset view, Find an item, and Select multiple items remain present; assert the jump select is at least 154px wide and its selected option remains visible.
- Toggle multi-selection by keyboard or button activation; assert the live `0 selected` count appears and the reflowed toolbar still fits without child overlap. At 390 × 480, compare the rendered bounds and assert no overlap between the toolbar and `.world-hint` in either state, and between `.lab-toast`, `.world-hint`, and `.game-toolbar` while the selection toast is visible. Confirm the persistent world-item count remains visible.
- At 1440x900, assert the toolbar and controls remain visible and non-overlapping in the existing desktop arrangement.

Use geometry derived from rendered bounding boxes and semantic locators; avoid pixel screenshots as the sole assertion.

Focused command:

```sh
npm run test:e2e -- --workers=1 e2e/lab/mobile-toolbar.spec.js
```

Pre-fix 390 × 480 repro baseline: the toolbar occupied
y=398.7–470 and `.world-hint` occupied y=371.1–418, producing a 19.3px vertical
overlap. The screenshot shows this in both the default toolbar and the
multi-selection state. The focused geometry regression captured this
pre-implementation overlap; the corrected layout now keeps them separate.

Pre-toast-placement selection-state baseline, measured after toolbar wrapping:
`.lab-toast` occupied
y=305.8–364, `.world-hint` y=273.1–320, and `.game-toolbar` y=355.3–470. The
toast overlapped the hint by 14.2px and the toolbar by 8.7px. At 390 × 480,
the CSS placement correction resolves both measured overlaps; the focused
regression asserts that the visible toast no longer intersects either element.

Historical focused E2E red baseline (before implementation):
`npm run test:e2e -- --workers=1 e2e/lab/mobile-toolbar.spec.js` ran two cases;
the desktop layout passed and the 390 × 480 mobile case failed. The mobile case
reported the jump selector at 36px instead of the required 154px minimum,
controls extending beyond the viewport, and toolbar/hint overlap in both the
default and selection-count states. The corrected run is recorded below.

Historical 320 × 480 review baseline before the CSS correction: the 390 × 480 mobile and 1440 × 900 desktop
cases pass, but the 320 × 480 case fails. In the normal state, `.world-hint`
overlaps the toolbar. In the selection state, the toast overlaps both the hint
and toolbar; the toast and toolbar bounds themselves pass their viewport
checks. That pre-fix focused run was 2/3. The final passing results are recorded
below.

## Risks and verification

Wrapping changes toolbar height, so its final row must not collide with the hint or extend beyond the viewport at either mobile repro size. Exercise both hidden and visible selection-count states because the conditional count changes available row width. The geometry and interaction checks should confirm no application state, save, camera, or pointer changes were introduced. The full suite requires user approval and was not run.

## Verification results (2026-11-03)

- `npm run test:e2e -- --workers=1 e2e/lab/mobile-toolbar.spec.js`: 3/3 passed at 390 × 480, 320 × 480, and 1440 × 900. The mobile checks verify controls remain within the viewport, the selector remains readable, the hint does not overlap the toolbar in normal and selection-count states, and the selection toast does not overlap the hint or toolbar. The desktop toolbar retains its single-row layout.
- `npm run build`: passed.
- Final review found no actionable issues. The full suite was not run.
- Updated `docs/TESTING_GUIDE.md`, `docs/VERTICAL_SLICE.md`, and `docs/ARCHITECTURE.md`. The human-playthrough/content-expansion gate remains active in `docs/plans/browser-scaling-playtest-gate.md`.
