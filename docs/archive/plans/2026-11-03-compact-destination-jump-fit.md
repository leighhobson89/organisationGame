# Plan: Fit Compact Destination Jumps

**Status:** Complete. Compact destination jumps now fit the selected target. The independent human playtest and content-expansion gate remain open.

## Goal and scope

When a player selects a world destination, the camera should frame that destination within the visible world viewport on compact screens. `WorldViewport.jsx` used a fixed `0.76` scale for destination jumps, which clipped the Blueprint Cabinet (640 by 660 world units) inside a 390 by 480 viewport.

The change is limited to destination jumps. It uses the existing `fitTargetScale(destination, 0.76)` helper, preserving the current scale as the preferred zoom ceiling. Desktop zoom behavior, scratch-pad behavior, saves, and game content are unchanged.

## Regression test

The browser regression in `e2e/lab/research-chapter.spec.js` starts from a fresh save at a 390 by 480 viewport, selects `destination:cabinet-blueprints`, waits for `destination-cabinet-blueprints`, and asserts that the complete bounding box stays inside `world-viewport` with a 1px tolerance on all four edges.

The baseline run passed 6 of 7 tests. The new assertion failed because the Cabinet's left edge was 48.2px outside the viewport (expected at least -1px), confirming the clipping defect.

## Verification and review

- `npm run test:e2e -- --workers=1 e2e/lab/research-chapter.spec.js` passed 8/8 after the fix.
- `npm run build` passed with Vite 8.3.5 (59 modules).
- Scoped review found no actionable issues.
- The full test suite was not run.
- The independent human playtest and content-expansion gate remain open; this viewport fix does not satisfy that gate.

## Documentation

Updated `docs/TESTING_GUIDE.md` and `docs/ROADMAP.md` with the compact destination-fit behavior and verification results. The deferred browser-scaling/playtest plan remains active in `docs/plans/`.
