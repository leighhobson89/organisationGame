# Clockwork Atlas at 320 × 360

## Goal

Keep Clockwork Atlas readable, reachable, and operable at a 320 × 360 viewport with 150% text scaling.

## Scope

- Inspect and, if needed, adjust `src/styles/app.css` for the compact Atlas panel, whose available geometry is approximately 260px wide by 170px high.
- Keep the panel header, map, instructions, and Close control visible or reachable without overlap or clipping; the heading and instructions must not collide.
- Keep at least 10px clearance between the Atlas panel and bottom toolbar. Compact toolbar controls must remain reachable and hit-testable while Atlas is open.
- Preserve Atlas map projection, landmarks, camera zoom behavior, content, and saved data/schema.
- Preserve existing 320 × 480 and 390 × 480 compact layouts and behavior at viewport heights of 440px and above.
- Preserve Atlas/Inspector coordination at 390 × 480: the Atlas toggle remains visible and openable with Inspector open; opening Atlas closes Inspector while retaining the selected item; resizing from desktop to compact closes Atlas, retains Inspector, and returns focus to the visible Atlas toggle.

## Implementation and Verification

- Add one focused regression to `e2e/lab/world-atlas.spec.js` at 320 × 360 with 150% text scaling.
- Retain and pass the 390 × 480 Atlas/Inspector coordination regressions in `e2e/lab/world-atlas.spec.js`, including toggle visibility/opening with Inspector, preserved selection, and desktop-to-compact resize focus return.
- Verify Atlas viewport bounds, header/instructions non-overlap, Close bounds and hit testing, at least 10px panel-to-toolbar clearance, and reachable/hit-testable compact toolbar controls.
- Verify keyboard map navigation with ArrowRight and Enter recenters the camera while preserving scale and changing the camera outline; Escape closes Atlas, restores focus to its toggle, and leaves camera state unchanged after closing.
- Run the focused World Atlas E2E spec, production build, and scoped code review. Do not run the full suite without user approval.

## Test Plan

**Complete:** `e2e/lab/world-atlas.spec.js` covers the focused 320 × 360, 150% text regression and two 390 × 480 Inspector/Atlas coordination regressions. The short-height case verifies panel bounds, header/instructions separation, at least 10px panel-to-toolbar clearance, compact toolbar control reachability and hit testing, Close bounds and hit testing, keyboard map navigation with ArrowRight and Enter, preserved camera scale and a changed camera outline after recentering, Escape dismissal with focus returned to the Atlas toggle, and unchanged camera state after closing.

Both 390 × 480 coordination cases explicitly assert the Atlas toggle is visible while Inspector is open. One verifies opening Atlas closes Inspector while retaining item selection; the other verifies desktop-to-compact resize closes Atlas, retains Inspector, and returns focus to the visible toggle. Their red runs fail only because the toggle is hidden by the compact Inspector styles; the pre-open desktop toggle visibility assertion passes.

Run the focused full `world-atlas.spec.js`, production build, and scoped review. Do not run the full test suite without user approval.

Pre-implementation baseline: the focused World Atlas spec passed 13/15. The two existing 390 × 480 Atlas/Inspector cases failed because the compact Inspector CSS blocks hid `.world-atlas-toggle`, preventing Atlas from opening or regaining visible focus. The Atlas 320 × 360 panel was in viewport bounds at x=10, y=165.4375, width=260, height=170, bottom=335.4375. The toolbar was at x=10, y=260, width=300, height=90, bottom=350, leaving −75.4375px clearance (an overlap). The heading collided with both the instructions and Close. Close remained in bounds and center-hit-testable, but the toolbar lacked its compact rail. Keyboard recentering, preserved scale, Escape dismissal, focus return, and unchanged camera after closing passed.

## Outcome

- The focused `world-atlas.spec.js` passed 15/15, including the 320 × 360/150% layout and both 390 × 480 Inspector/Atlas coordination regressions.
- The Vite 8.3.5 production build passed with 59 modules.
- Scoped Code Reviewer found no findings. The full test suite was not run.
- The independent human playtest remains deferred, so content expansion stays gated.

This finalized plan is archived at `docs/archive/plans/2026-11-04-clockwork-atlas-compact-360px.md`.
