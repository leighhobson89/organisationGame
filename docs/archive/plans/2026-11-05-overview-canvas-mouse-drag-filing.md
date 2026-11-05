# Plan: Overview Canvas Mouse-Drag Filing

**Status:** Complete. The corrected focused E2E passed and scoped review found no actionable issues; no production change was needed.

## Scope

Add a Playwright mouse-drag regression in `e2e/lab/organising-loop.spec.js` for an isolated canonical card rendered by the overview Canvas rather than a DOM overlay. At overview scale, drag from the card's Canvas hit point into its correct destination.

This is likely test-only. Make no production source changes unless the regression demonstrates a product defect.

## Acceptance criteria

- Before dragging, verify the overview Canvas is visible and the isolated canonical card's ID is absent from `.world-scene .lab-object` DOM overlays.
- Compute and use a visible Canvas hit point for the card at overview scale, then perform a mouse drag into its correct destination.
- Verify the item is filed in its correct destination and the autosave reports the saved state.
- Verify the camera transform and ordered item IDs remain unchanged by the drag.
- Verify the emitted event sequence is `item.pickup`, `item.drop`, then `item.placement.correct`.
- Do not change production behavior unless the regression exposes a defect requiring correction.

## Focused test plan

The test specialist added `mouse dragging a canvas-only calibration card files it correctly without moving the camera` to `e2e/lab/organising-loop.spec.js`. It seeds a fresh game at 3000 x 1800, removes the first canonical calibration card from its original array position, arranges the first 64 remaining items in a grid, puts the target at an isolated world position, and moves it to the end of `state.items`. The camera scale is 0.4 with a centered world view. Before dragging, it verifies that all items render through the Canvas and the target ID is absent from the 64 `.world-scene .lab-object` overlays.

The test computes the card start point and correct-destination drop point from the viewport bounds, camera pan, world positions, and scale, then checks both points are inside the viewport. After a mouse drag, it verifies autosave, correct validation and destination slot/position, unchanged ordered item IDs and saved camera, unchanged visible camera transform, destination count, and the exact event sequence `item.pickup` -> `item.drop` -> `item.placement.correct`.

## Baseline and fixture correction

The first run was discarded as fixture failure: it stopped at the Canvas-only precondition because `calibration-card-01` was still included in the first 64 DOM overlays. It did not exercise the drag, so it provides no drag behavior baseline.

The corrected fixture mirrors the touch-navigation Canvas setup: the first 64 remaining items are placed in a grid, then the isolated target is appended last. The focused command `npx playwright test e2e/lab/organising-loop.spec.js --grep "mouse dragging a canvas-only calibration card" --reporter=line --workers=1` passed 1/1. The combined follow-up command `npx playwright test e2e/lab/organising-loop.spec.js e2e/lab/touch-navigation.spec.js --grep "mouse dragging a canvas-only calibration card|pointer selection from the overview canvas|a coarse-pointer (tap|drag) .*Canvas-rendered card" --reporter=line --workers=1` passed 4/4, covering overview pointer selection, mouse Canvas drag, touch Canvas tap, and touch Canvas drag. Scoped review found no actionable issues. No production change, build, or full suite was needed or run. The independent human playtest remains deferred and the content-expansion gate remains open.

Finalized 2026-11-05 and archived as `docs/archive/plans/2026-11-05-overview-canvas-mouse-drag-filing.md`.
