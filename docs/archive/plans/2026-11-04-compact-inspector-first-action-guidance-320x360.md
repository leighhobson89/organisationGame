# Compact Inspector First-Action Guidance at 320×360

## Status

Finalized after implementation, focused verification, and scoped code review. The change preserves the visible Inspector guidance controls at compact heights; content expansion remains gated on the deferred independent human playtest.

## Goal

At a 320×360 viewport with 150% text, keep the full `.world-hint__controls` row visible and usable while the Inspector is open, without overlap with the Inspector or toolbar. Preserve the Inspector's 44px horizontal action rail for single and group selections, 38px targets, keyboard-focus scrolling within the rail without moving the page, at least 48px of reachable details, and the selected item's context.

## Evidence and current behavior

The existing `mobile-toolbar.spec.js` Inspector case at 320×360 fails reproducibly because `.world-hint__lead` is hidden after the first calibration item is selected and its Inspector opens. The captured layout has a 48px header, toolbar at y=48–92, Inspector at y=96–352, and no remaining visible guidance lane.

The archived compact-viewport plan requires panel-open states to preserve the full `.world-hint__controls` row. `docs/VERTICAL_SLICE.md` records the first-action lead and visible controls as part of the fresh-start guidance. The lead may be collapsed only after selection if the 320×360 layout cannot retain it without obscuring controls or Inspector actions; it must remain visible before selection. The controls row must remain intact.

## Scope

- Correct the compact Inspector layout at 320×360 and 150% text so the full controls row is visible and does not overlap the toolbar or Inspector.
- Keep Inspector Close, destination selection, Move, and Focus reachable, with at least 48px of reachable details.
- Keep the first-action lead visible before selection; retain it after selection if the layout allows. If it must collapse after selection, scope that behavior to the selected-item state and preserve the controls row.
- Preserve selection, camera behavior, and the existing save schema.
- Preserve 400px-and-above behavior, desktop behavior, and other panel layouts and coordination.
- Keep document and viewport dimensions free of horizontal overflow. The Inspector action rail may scroll horizontally within its own viewport as designed.

## Implementation approach

The fix uses a narrowly scoped responsive CSS adjustment for the compact Inspector state, guided by browser-measured element bounds. At widths up to 720px and heights 360–399px, the controls hint remains visible below the shared 44px rail and separate from the toolbar and Inspector. The single-item Inspector uses compact heading/action spacing and collapses the completed “select a blueprint” lead only while open; the accessible destination-selector label remains associated. Single-item details measure 84px at 320 × 360 and 390 × 360. The group Inspector retains its rail and 72px details at 320 × 360. The page stays in bounds. The no-panel fresh-start layout and existing panel coordination are preserved; game content, selection or filing semantics, camera persistence, and save data are unchanged.

## Verification scope

Add or refine focused browser regression coverage before implementation. Verify the compact Inspector guidance case along with `mobile-toolbar.spec.js`, `inspector-panel-layout.spec.js`, and `panel-coordination.spec.js`. Check visible bounds, overlap, action reachability, details height, horizontal overflow, and preservation of the selected item and camera/save behavior. Run only these focused checks; do not run the full suite without user approval.

## Test plan

The Test Specialist extended the existing `mobile-toolbar.spec.js` Inspector case. Before selection, assert the first-action lead is readable. After opening the Inspector at 320×360/150% text, assert the controls row is visible and within the viewport, with no overlap against the toolbar or Inspector. Preserve the Inspector's 44px horizontal action rail in both single- and group-selection states, with 38px targets. Keyboard focus must scroll the rail to reveal the focused action without changing page `scrollX` or `scrollY`. Assert document/viewport dimensions do not overflow; the rail's own horizontal scrolling is intentional. Keep the existing Inspector reachability, details-height, and panel-coordination assertions in `inspector-panel-layout.spec.js` and `panel-coordination.spec.js` as focused preservation guards.

The focused red baseline was run with:

```text
npm run test:e2e -- --workers=1 e2e/lab/mobile-toolbar.spec.js --grep "Inspector keeps full guidance"
```

It failed 1/1 as intended on controls-row visibility. At the failure, the controls row bounds were `(0, 0)–(0, 0)`, toolbar bounds were `(74, 48)–(310, 92)`, Inspector bounds were `(10, 96)–(310, 352)`, page and viewport measured 320×360, and scroll remained `(0, 0)`. The default sandbox worker launch first returned `spawn EPERM`; the focused rerun with escalation established this red baseline. The prior `mobile-toolbar.spec.js` assertion that Inspector `overflowX` must not be `auto` was stale; the short-height layout intentionally uses the 44px horizontal Inspector rail.

The focused Inspector-guidance regression passed. The verification guard passed with:

```text
npm run test:e2e -- --workers=1 e2e/lab/mobile-toolbar.spec.js e2e/lab/inspector-panel-layout.spec.js e2e/lab/panel-coordination.spec.js
```

The guard passed 52/52 after one transient trace-teardown `ENOENT` rerun. It verifies the pre-selection lead, visible post-selection controls, controls/toolbar/Inspector bounds and separation, 38px targets, the 44px single/group action rail, keyboard focus scrolling without page movement, details reachability, and page overflow. `npm run build` passed with Vite 8.3.5 (59 modules). Scoped Code Reviewer found no actionable findings. The full suite was not run.

## Documentation and closeout

The relevant project and testing documentation is updated in `docs/ROADMAP.md`, `docs/TESTING_GUIDE.md`, and `docs/VERTICAL_SLICE.md`. This finalized plan is archived as `docs/archive/plans/2026-11-04-compact-inspector-first-action-guidance-320x360.md`. The full suite was not run; the independent human playtest remains deferred and content expansion remains gated. Keep only the active browser-scaling playtest gate in `docs/plans/`.
