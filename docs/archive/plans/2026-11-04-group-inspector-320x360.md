# Group Inspector at 320 × 360 with 150% Text

## Status

Finalized (2026-11-04). The independent human playtest remains deferred, and content expansion remains gated under the browser-scaling playtest plan.

## Goal

Keep two-item group selection usable when the Inspector is open at 320 × 360 with 150% text, including the compact toolbar's horizontal scrolling behavior.

## Scope

- Add focused regression coverage for the group-selection/short-height intersection at 320 × 360 and 150% text. Existing short-height Inspector cases exercise a single item; existing group cases cover taller viewports.
- Verify the selected count and group Move action are visible, focusable, and hit-testable.
- Keep the group detail scrollport at least 48px high and verify its content remains internally scrollable.
- Verify the Inspector and 44px short-height toolbar do not overlap, and keyboard focus can scroll the toolbar horizontally to the required controls without moving the page.
- If the baseline exposes a defect, adjust only the short-height Inspector/toolbar CSS.

## Constraints

- Preserve both selected item IDs, their placements, grouping behavior, and existing save shape.
- Preserve single-item Inspector behavior and the Atlas toggle's reserved clearance.
- Preserve desktop and other compact viewport behavior outside this focused case.
- Keep the independent human playtest deferred and content expansion gated; automated layout coverage does not close either gate.

## Verification

The focused regression is in `e2e/lab/inspector-panel-layout.spec.js` and runs with:

```powershell
npx playwright test e2e/lab/inspector-panel-layout.spec.js --grep "group Inspector and toolbar actions remain reachable" --reporter=line --workers=1
```

It verifies group selection, group detail scrolling, Inspector/toolbar non-overlap, and keyboard focus/hit testing including horizontal toolbar scroll advancement. The unchanged-CSS run passed 1/1 at 320 × 360 with 150% text. Geometry measured the panel at x=10–310, y=96–352 (8px bottom inset), toolbar at x=74–310, y=48–92, no intersection, 118px client height / 540px content for group details, and 320px document width. The initial sandbox worker spawn returned `EPERM`; the focused single-case rerun with process access passed. This is a coverage-only improvement, so no source/CSS changes or production build were needed.

The combined follow-up command was:

```powershell
npm run test:e2e -- --workers=1 e2e/lab/inspector-panel-layout.spec.js e2e/lab/mobile-toolbar.spec.js e2e/lab/panel-coordination.spec.js
```

It passed 51 tests and failed one existing mobile-toolbar test: `the Inspector keeps full guidance and its toolbar layout at 320x360 with 150% text`. The failure is that `.world-hint__lead` is hidden after selection; an isolated reproduction fails identically. This is separate from group Inspector reachability and is tracked for a follow-up. The scoped Code Reviewer found no remaining issues in this coverage-only slice. The full suite was not run.

## Execution record

The focused regression passed 1/1 on unchanged CSS, confirming the 320 × 360 group-selection layout is usable under the tested conditions. The Test Specialist and Architect found no source change necessary; this slice adds intersection coverage for an existing supported behavior. The broader 51/52 run exposed a separate mobile-toolbar guidance failure, reproduced in isolation and reserved for its own follow-up plan. Scoped review found no remaining issues. The independent human playtest remains deferred, and content expansion remains gated.
