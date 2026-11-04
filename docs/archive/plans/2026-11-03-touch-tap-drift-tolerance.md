# Plan: Touch Tap Drift Tolerance

**Status:** Complete. Touch item dragging uses a 10 CSS-pixel threshold; mouse and selection thresholds remain unchanged.

## Problem

`useWorldViewportController` currently applies a 4 CSS-pixel movement threshold to every pointer type. The touch-navigation E2E covers a stationary tap, but not the small amount of finger drift common during a tap. A 6-pixel drift can begin an item pickup/drop and move the item instead of selecting it.

## Scope

- Add a real touch regression using the existing 390 x 844 `hasTouch` calibration fixture and CDP touch start, move, and end events.
- Start on the calibration card, move the touch 6 CSS pixels, and release.
- Assert the Inspector shows the selected card, the camera is unchanged, the saved item state is unchanged, and no `item.pickup` or `item.drop` audio events occur.
- If the regression fails on the current code, use a pointer-type-aware drag threshold: about 10 CSS pixels for touch while retaining 4 CSS pixels for mouse.
- Preserve intentional item dragging, pinch gestures, panning, save behavior, and mouse interaction.

Out of scope: changing authored story or research content, broad gesture redesign, and performance or content-scaling work. The independent human playtest and content-expansion gate in `docs/plans/browser-scaling-playtest-gate.md` remain open; the user's deferral does not close that gate.

## Test and verification plan

The Test Engineer added the focused regression before implementation. Baseline: `npm run test:e2e -- --workers=1 e2e/lab/touch-navigation.spec.js` ran 9 tests; 8 passed and the new +6px touch case failed because it emitted `item.pickup` and `item.drop`. Its Inspector/title, camera, and saved item-state assertions passed, isolating the failure to unintended drag events.

After implementation, the full focused touch-navigation spec passed 9/9. The 6px drift case selects the card without moving or saving it and emits no `item.pickup` or `item.drop` events. The production build passed with Vite 8.3.5 (59 modules), and scoped review found no actionable findings.

- Focused regression: `npm run test:e2e -- --workers=1 e2e/lab/touch-navigation.spec.js`
- Production build.
- Scoped code review of the threshold change and gesture preservation.
- Do not run the full test suite without user approval.

## Completion

The full test suite was not run. `docs/TESTING_GUIDE.md` and `docs/ROADMAP.md` record the change and its verification. Archive this plan as `docs/archive/plans/2026-11-03-touch-tap-drift-tolerance.md`. Keep the separate human-playtest/content-expansion gate active.
