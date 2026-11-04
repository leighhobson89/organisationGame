# Plan: Touch Item Drag and Drop Regression

**Status:** Complete. The primary item-to-destination flow is covered through the touch pointer path.

## Goal and boundary

Add one focused browser regression to `e2e/lab/touch-navigation.spec.js`. A fresh 390-by-844 `hasTouch` fixture will drag `calibration-card-01` into `cabinet-calibration` using CDP touch events.

Keep the change limited to touch drag-and-drop coverage and any source fix required if the regression exposes a defect. Preserve the existing touch pan, pinch, tap threshold, mouse drag, save format, and authored content. The independent two-chapter human playtest and content-expansion gate in `docs/plans/browser-scaling-playtest-gate.md` stays open.

## Approach

- Reuse the touch fixture and event helpers in `touch-navigation.spec.js`.
- Start at the visible calibration card, move the touch in steps to the calibration cabinet, and release inside its drop target.
- Assert the cabinet count and saved item placement/validation, autosave completion, unchanged camera, and ordered `item.pickup`, `item.drop`, and `item.placement.correct` events.
- If the focused regression reveals incorrect touch behavior, make the smallest pointer-path fix and retain coverage for the failure.

## Test plan

In `touch-navigation.spec.js`, CDP-dispatch one touch that starts at the calibration card center, then send eight `touchMove` events. The first seven move through intermediate positions; the eighth ends at the center of `destination-cabinet-calibration`. Then send `touchEnd`. Assert the destination reports `1 of 8`, autosave finishes, the saved item has destination placement in `cabinet-calibration` and `correct` validation without assuming a slot index, the camera is unchanged, and audio events are exactly `item.pickup` -> `item.drop` -> `item.placement.correct`.

## Verification scope

- `npm run test:e2e -- --workers=1 e2e/lab/touch-navigation.spec.js` passed 10/10. The initial sandbox Playwright worker spawn returned `EPERM`; the rerun with escalation passed.
- React implementation review confirmed no source change was required. Scoped Code Reviewer found no actionable findings.
- No production source change or build was needed. The full suite was not run.

## Completion

The focused test and review results are recorded in `docs/TESTING_GUIDE.md` and `docs/ROADMAP.md`. This plan is archived as `docs/archive/plans/2026-11-03-touch-item-drag-drop-regression.md`; the independent two-chapter playtest and content-expansion gate remains open.
