# Plan: Horizontal Touchpad Panning

**Status:** Complete. Horizontal-only wheel panning is implemented and verified. The separate browser-scaling and two-chapter human playtest gate remains open.

## Goal and boundary

Make horizontal-only trackpad wheel input pan the world horizontally. A positive `deltaX` should decrease `camera.panX`, with no change to camera scale and no zoom announcement. Keep vertical wheel input as cursor-anchored zoom, and preserve the existing zoom-announcement debounce.

The current `onWheel` handler in `src/ui/useWorldViewportController.js` chooses zoom direction from `deltaY < 0 ? zoom-in : zoom-out`. Thus an event with nonzero `deltaX` and `deltaY === 0` is treated as zoom-out. Before this slice, browser coverage in `e2e/lab/zoom-announcements.spec.js` exercised vertical wheel zoom and pinch announcement behavior, but not horizontal-only wheel input.

Keep this slice limited to the wheel handler and its focused browser regression. If the regression is red, change only `onWheel` in `useWorldViewportController.js`; do not alter vertical anchored zoom or announcement timing. Keep the real-browser interaction at a 1280x720 viewport and use the existing zoom-announcement E2E helpers/fixtures. Do not run the full test suite. The separate content-expansion gate remains open pending the deferred human playtest.

## Implementation and verification

1. Added a real-wheel browser regression for horizontal-only input in `e2e/lab/zoom-announcements.spec.js`. At 1280x720 it captures camera state and the zoom readout, sends `page.mouse.wheel(120, 0)`, then checks that `panX` decreases, `panY` and scale remain unchanged, the readout is unchanged, and no zoom announcement occurs after the debounce window.
2. Updated `onWheel` in `useWorldViewportController.js` to pan for horizontal-only wheel input. Positive `deltaX` decreases `panX`; vertical wheel input retains cursor-anchored zoom and the existing announcement debounce.
3. Ran the focused `zoom-announcements.spec.js` browser spec and production build, and completed scoped review. The full suite was not run.
4. Updated `docs/TESTING_GUIDE.md` and `docs/ROADMAP.md`; archived this finalized plan in `docs/archive/plans/2026-11-03-horizontal-touchpad-pan.md`.

## Focused regression baseline

The first focused run after adding the horizontal wheel case reported 9 passed and 1 failed. The new test failed as expected: instead of panning left from the starting `panX` of 30, the handler zoomed out and shifted `panX` to 34.29, violating the expected `panX < 30`. The other nine tests in the focused spec passed. After implementation, `npm run test:e2e -- --workers=1 e2e/lab/zoom-announcements.spec.js` passed 10/10. `npm run build` passed with Vite 8.3.5 (59 modules), and scoped review found no actionable findings. The full suite was not run.

## Acceptance criteria

- [x] At 1280x720, a real horizontal-only wheel event with positive `deltaX` pans horizontally by decreasing `camera.panX`.
- [x] The horizontal-only wheel event leaves scale and zoom announcements unchanged.
- [x] Existing vertical wheel zoom remains cursor-anchored and announcement debounce still reports only the final settled percentage.
- [x] The focused `e2e/lab/zoom-announcements.spec.js` passes, the production build passes, and the scoped code review finds no actionable issue.
- [x] The human playtest/content-expansion gate remains open.

## Roles and review

The Architect defined this narrow change and verification scope. The Test Engineer added the focused failing regression before implementation. The JavaScript implementation specialist updated the handler. The Documentation Specialist recorded the results in the testing guide and roadmap and archived this plan.
