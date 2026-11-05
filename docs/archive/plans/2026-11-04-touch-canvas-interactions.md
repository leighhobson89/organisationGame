# Plan: Touch Interactions with Canvas-Rendered Items

**Status:** Completed (2026-11-04). This slice verifies coarse-pointer interaction at the hybrid Canvas overview boundary. It does not close the independent human-playtest or content-expansion gate.

## Goal and boundary

Add focused browser coverage for touching an item while it is represented by the overview Canvas rather than a DOM card. Reuse the coarse-pointer Touch CDP fixture at 390 × 844 and set the camera scale to 0.4, which selects overview mode. Confirm `calibration-card-01` has no DOM card before contact. Preserve existing pointer, camera, placement, and save behavior outside these interactions.

Do not change authored content, save formats, rendering policy, or touch thresholds unless a regression test demonstrates a defect.

## Implementation

1. Add a touch-tap case that selects the Canvas-only calibration card and opens its Inspector.
2. Add a touch-drag case that moves the Canvas-only calibration card into the visible `cabinet-calibration` destination.
3. Change runtime code only if the new focused regression cases expose an actual defect.

## Acceptance criteria

- Both cases confirm overview Canvas mode and verify the calibration card is absent from the DOM before touch begins.
- A tap selects the item and opens the Inspector without moving or filing it, changing the camera, or emitting pickup/drop events.
- A drag files the item correctly, autosaves the placement, leaves the camera unchanged, and emits `item.pickup`, `item.drop`, then `item.placement.correct`.
- Focused touch-navigation and Canvas-selection regressions pass.
- The independent human playtest remains deferred and content expansion remains gated.

## Test plan

The Test Specialist added two cases to `e2e/lab/touch-navigation.spec.js`:

- `a coarse-pointer tap selects a Canvas-rendered card without moving or filing it` checks that tapping the Canvas-only `calibration-card-01` opens its Inspector and selects it, while preserving its saved position, placement, validation, and camera and emitting no pickup/drop events.
- `a coarse-pointer drag files a Canvas-rendered card into its correct destination` checks that dragging the same card into `cabinet-calibration` autosaves the correct placement, preserves the camera, and emits `item.pickup`, `item.drop`, then `item.placement.correct`.

Both touch cases use the shared Canvas-only fixture setup: `calibration-card-01` is moved behind the ordinary overlay population, the overview Canvas must represent all 174 items, exactly 64 ordinary `.lab-object` DOM overlays must exist, and the target must have no DOM item element before contact. The fixture correction filled all 64 overlay slots before positioning the target; the first attempt correctly failed at this prerequisite because the target still had a DOM overlay, before any touch action ran.

## Verification results

The combined focused command passed 3/3:

~~~sh
npm run test:e2e -- --workers=1 e2e/lab/touch-navigation.spec.js e2e/lab/organising-loop.spec.js --grep "Canvas-rendered|pointer selection from the overview canvas" --reporter=line
~~~

The run covers the existing pointer selection from the overview Canvas and both new touch cases. The corrected fixture confirms that all 174 items are represented by Canvas and 64 ordinary `.lab-object` overlays remain mounted; the target calibration card has no DOM item representation before either touch action. Tap opens the Inspector while preserving the live and saved camera, saved position, placement, and validation, and emits no pickup/drop events. Drag files the card into `cabinet-calibration`, autosaves the correct placement, preserves the live and saved camera, and emits `item.pickup`, `item.drop`, then `item.placement.correct`.

No runtime change was needed. Scoped review found no actionable findings. The full suite was not run. The independent human playtest remains deferred and content expansion remains gated; `docs/plans/browser-scaling-playtest-gate.md` stays active.
