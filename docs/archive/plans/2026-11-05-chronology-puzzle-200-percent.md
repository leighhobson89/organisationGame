# Plan: Chronology Puzzle at 200% Text Scale

**Status:** Complete. The 200% compact-header adjustment and focused regression passed review.

## Goal and rationale

Keep the Chronology Puzzle usable at 200% text scale on a compact 320 by 360 viewport. The existing focused puzzle-layout spec already covers the compact 150% flow, including toolbar clearance and solved-state visibility. Add 200% coverage for the full keyboard-driven puzzle journey and its progression result.

## Scope and constraints

- Seed the existing unlocked Chronology Puzzle fixture and persist a 200% text-scale preference before loading the game.
- At 320 by 360, verify the applied scale, panel and page bounds, no horizontal overflow, at least 10px clearance from the toolbar, and internal panel scrolling.
- Verify keyboard traversal through each event choice and Undo, Clear, and Submit. Each focused control must remain visible within the panel and viewport and be hit-testable.
- Solve and submit the puzzle; verify the completion status is visible and Chronology Wheel progression is unlocked or active.
- Preserve puzzle rules, event copy and ordering, save/progression shape, desktop behavior, and existing 150% compact and 400px layouts.
- Make production styling changes only if the focused regression exposes a defect. Keep changes limited to the compact puzzle surface.
- Keep the independent human playtest and content-expansion gate unchanged. The user deferred that playtest; this slice does not close or replace it.

## Implementation approach

1. Extend `e2e/lab/chronology-puzzle-panel-layout.spec.js` with a 200%/320 by 360 case using the existing unlocked puzzle fixture and focus/hit-test helpers.
2. Run the focused regression before implementation and record its baseline. Keep verification limited to this specification; do not run the full suite.
3. The red baseline exposed clipping of the first focused event choice. A compact-header CSS adjustment scoped to 200% text resolved the visibility issue without changing the existing 150% compact and 400px layouts.
4. Re-run the focused layout spec, review the diff, update the testing guide and release-polish roadmap record, and archive this finalized plan.

## Test plan

The Test Engineer added `200% text keeps Chronology Puzzle controls reachable at 320x360` in `e2e/lab/chronology-puzzle-panel-layout.spec.js`. The case seeds the existing unlocked chronology fixture and a persisted text scale of 2, then checks panel bounds, page/panel horizontal overflow, internal scrolling, at least 10px toolbar clearance, and toolbar availability. It Tabs through each event choice and Undo, Clear, and Submit, checking focused-control visibility and center hit-testing, then solves the configured chronology and checks completion feedback and Chronology Wheel progression.

Focused command: `npx playwright test e2e/lab/chronology-puzzle-panel-layout.spec.js --grep "200% text keeps Chronology Puzzle controls reachable at 320x360"`.

Baseline result: **1 failed.** Panel/viewport, overflow, scrolling, and toolbar assertions passed before keyboard visibility failed on the first `first stable impression` event choice. Its rectangle was x=29–291 and y=129.61–273.95; the panel's visible client bounds were x=11–309 and y=153.92–248.92. Center hit-testing passed, but the focused event extended beyond the panel's visible client area. No source changes were made for the baseline.

After the 200%-only compact-header CSS adjustment, the full focused layout spec passed 4/4 in 13.7 seconds, covering 150% at 320x360, 320x400, and 390x400 plus 200% at 320x360. The first normal run returned Windows `spawn EPERM`; the authorized process-access rerun passed. Scoped Code Reviewer found no actionable issues. No build or full suite was run.

## Acceptance criteria

- [x] The 200% preference is applied to the seeded unlocked puzzle at 320 by 360.
- [x] The panel and page remain within viewport bounds without horizontal overflow; panel scrolling works and the toolbar clears the panel by at least 10px.
- [x] Keyboard traversal reaches all event choices, Undo, Clear, and Submit with visible, in-bounds, hit-testable focus.
- [x] Submitting the correct chronology makes the completion status visible and advances progression to the Chronology Wheel.
- [x] Existing puzzle behavior, save/progression shape, and tested 150% compact and 400px layouts are preserved; the human-playtest/content-expansion gate remains open.
- [x] The focused regression passes, relevant documentation is updated, and the finalized plan is archived.
