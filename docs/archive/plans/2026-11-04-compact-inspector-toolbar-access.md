# Compact Inspector and Toolbar Access

**Status:** Complete (2026-11-04). Responsive layout, focused verification, review, and documentation are complete. Heights below 480px remain a separate follow-up.

## Goal

Keep the selected-item Inspector and world-navigation toolbar simultaneously visible and operable on compact screens 480–520px high. Before the change, the Inspector and toolbar intersected by 300 × 34px at 320 × 480 and 370 × 80px at 390 × 480 at both 125% and 150% text scale. The Inspector was at z-index 20 and the toolbar at z-index 10, so raising the toolbar alone could cover Move or Focus controls.

## Scope and approach

- Reserve a separate top lane for the compact toolbar when the Inspector is open. At 320px width the toolbar uses two rows and measures 86px high; its controls retain 38px targets. The selection-count third-row state uses a 128px lane.
- Keep the Inspector inside the viewport below the toolbar, with at least an 8px bottom safe margin. Use a 4px gap in the single-selection layout and 2px in the group-selection layout; do not pin the old 66px bottom inset.
- At 125% and 150%, keep the Inspector details independently scrollable, with at least 48px of scrollport at 150%; keep heading and Move/Focus actions visible.
- Preserve keyboard access and center hit testing for Inspector Close, destination selection, Move, and Focus, and for Zoom out/in, world jump, Reset view, Find an item, and multi-selection toggle. Keep visible focus indicators and verify controls remain within the viewport.
- Preserve compact selection guidance and toast behavior, including the existing toast layering relative to panels. Do not change toolbar actions, camera behavior, item selection, Inspector movement, persistence, or desktop geometry above the compact breakpoint.

## Acceptance criteria

- [x] At 320 × 480 and 390 × 480 with both 125% and 150% text scale, the Inspector and toolbar rectangles do not intersect; the Inspector stays inside the viewport with at least an 8px bottom margin.
- [x] At 150%, long single-item details retain 50px/86px internal scrollports at 320px/390px width, respectively; at 125%, they retain 110px/127px. Scrolling details does not move the panel or page.
- [x] The 150% group-selection, third-toolbar-row case retains a 79px details scrollport after resize from 1280 × 720 to 320 × 480. Group Move and the multi-selection count remain center-hit-testable.
- [x] Keyboard focus reaches each Inspector and interactive toolbar control. Focused controls remain within the viewport and hit-testable at their centers without cross-region obstruction.
- [x] Existing compact item selection, movement, toolbar actions, toast layering, Finder/Inspector coordination, and desktop layout continue to work.
- [x] Compact toolbar geometry remains 86px for two rows with 38px targets and 128px when the third selection-count row appears. The Inspector-to-toolbar gap is 4px for a single item and 2px for group selection.

## Verification

The red baseline failed the zero-intersection assertions at both 125% and 150%. At both scales, the Inspector and toolbar intersected by 300 × 34px at 320 × 480 and 370 × 80px at 390 × 480. At 125%, the original panel top was y=101px and its bottom inset was 66px. The initial focused browser launch hit sandbox `spawn EPERM`; the escalated rerun confirmed the overlaps.

The final focused layout spec has five cases: two 125% single-item cases, two 150% single-item cases, and a 150% group-selection/third-toolbar-row resize case. It measures Inspector, toolbar, details, and focused-control geometry; verifies no horizontal overflow, viewport containment and safe margin, zero panel/toolbar intersection, details scrolling, and keyboard hit testing for Inspector and toolbar actions. Results:

```sh
npm run test:e2e -- --workers=1 e2e/lab/inspector-panel-layout.spec.js
npm run test:e2e -- --workers=1 e2e/lab/mobile-toolbar.spec.js e2e/lab/panel-coordination.spec.js
```

The focused Inspector layout run passed 5/5. The combined mobile-toolbar and panel-coordination run passed 29/29. Review found no actionable issues. The full suite was not run. The responsive CSS applies at 480–520px high; the prior overlapping behavior below 480px remains explicitly tracked for a future compact fallback task.
