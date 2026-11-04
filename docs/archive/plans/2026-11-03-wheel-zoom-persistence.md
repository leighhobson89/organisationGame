# Plan: Mouse Wheel Zoom Persistence

**Status:** Complete. Real wheel zoom is saved and restored across reload.

## Goal and boundary

Add one real mouse-wheel persistence regression to `e2e/lab/zoom-announcements.spec.js`. At a 1280-by-720 viewport, load a fresh game, find an empty point in the world, and apply a standard `page.mouse.wheel(0, -120)` zoom gesture.

Keep the change limited to the browser regression and any runtime fix required if it exposes a persistence defect. Preserve cursor anchoring, zoom announcements, camera format, touch gestures, and authored content. The independent two-chapter playtest and content-expansion gate in `docs/plans/browser-scaling-playtest-gate.md` remains open.

## Approach

- Reuse the existing empty-world-point and live-scene-camera helpers where useful; add decoded-autosave camera support if needed.
- Record the initial camera, issue the wheel event, and wait until the scale and settled zoom announcement update.
- Poll the decoded autosave camera until it matches the live scene camera.
- Reload and verify that the restored camera matches the saved camera and retains the zoomed scale.

## Test plan

In `zoom-announcements.spec.js`, set a 1280x720 viewport, load a fresh game, find an empty world point, record the scene camera, move the mouse there, and call `page.mouse.wheel(0, -120)`. Wait for scale to increase and the settled announcement to match the visible readout. Poll the decoded autosave camera against the live scene camera, allowing at most 0.01 for each pan value and 0.0001 for scale. Read the saved camera, reload, wait for `autosave-status` to show `Saved just now`, then assert the restored camera matches the saved camera.

## Verification scope

- `npx playwright test e2e/lab/zoom-announcements.spec.js --workers=1` passed 12/12. The initial sandbox Playwright spawn returned `EPERM`; the escalated focused rerun passed.
- The test waits for settled zoom, confirms decoded autosave camera matches live camera within 0.01px pan and 0.0001 scale, reloads, and verifies restoration.
- React implementation review found no runtime change needed. Scoped Code Reviewer found no actionable findings.
- No production build or full suite was run.

## Completion

The verified coverage and review outcome are recorded in `docs/TESTING_GUIDE.md` and `docs/ROADMAP.md`. This plan is archived as `docs/archive/plans/2026-11-03-wheel-zoom-persistence.md`. The independent two-chapter human playtest and content-expansion gate remains open.
