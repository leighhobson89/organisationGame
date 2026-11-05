# Plan: World Atlas at 200% Text Scale

**Status:** Finalized; scoped review found no actionable findings.

## Goal and rationale

Verify Clockwork Atlas remains readable, reachable, and operable at 200% text scale in the worst-case 320 by 360 viewport. The existing 150% compact regression covers panel and toolbar behavior but does not cover the additional heading, description, and instruction height at 200%; extend that same interaction path without changing map or camera semantics.

## Scope and constraints

- Reuse `loadAtlasFixture(page, { textScale: 2 })` and `openAtlas(page)` for a single 320 by 360 regression in `e2e/lab/world-atlas.spec.js`; retain the existing 150% case unchanged.
- Verify the persisted text scale is applied and Atlas exposes its accessible region, heading, description, Close control, map group, instructions, and live announcer.
- Check heading title/description for collisions with each other, Close, and instructions. Verify the panel and its content remain within the viewport, and the page and panel do not overflow horizontally.
- Keep at least 10px clearance above the existing compact toolbar rail, with no panel overlap. Preserve the rail and keyboard center-hit-test visibility of its controls while Atlas is open.
- Verify keyboard focus stays on the map group while ArrowRight moves the map crosshair and announces a nearby landmark; Enter pans to it and changes the viewport outline without changing camera scale. Escape closes Atlas, returns focus to the Atlas toggle, and preserves the recentered camera state.
- Preserve map projection, landmark labels and behavior, camera zoom/recenter semantics, selection, persistence, and save schema. Make only compact 200%-specific presentation changes if the focused regression demonstrates a layout defect.
- Run only focused World Atlas tests; do not run the full suite. Keep the independent human-playtest/content-expansion gate unchanged.

## Implementation approach

1. Add a 200% text-scale case to the existing 320 by 360 World Atlas compact regression in `e2e/lab/world-atlas.spec.js`, using the existing fixture, panel-opening, camera, outline, and toolbar helpers.
2. Assert applied scale, accessible Atlas content, non-colliding heading/description/Close/instructions, viewport bounds, and no horizontal overflow for the page or panel.
3. Assert at least 10px toolbar clearance and no overlap, then traverse the compact toolbar controls by keyboard and verify each remains in the rail and viewport and is center hit-testable.
4. Repeat the landmark keyboard path: the map group retains keyboard focus while ArrowRight moves the map crosshair and announces the nearby landmark; Enter recenters the camera and changes the Atlas outline while preserving scale; Escape closes Atlas, returns focus to its toggle, and leaves the camera recentered.
5. Run only the focused World Atlas tests and scoped review. Update the Testing Guide and Roadmap and archive this plan after implementation and review.

## Test plan

The Test Engineer added `World atlas stays accessible at 320x360 with 200% text and preserves keyboard camera behavior` to `e2e/lab/world-atlas.spec.js`.

Focused command: `npx playwright test e2e/lab/world-atlas.spec.js --grep "World atlas stays accessible at 320x360 with 200% text and preserves keyboard camera behavior"`.

Initial baseline: the Atlas heading/description overlapped Close. The heading text spanned x=17–219 and Close spanned x=208.98–263. The first test draft also incorrectly expected ArrowRight to transfer focus to a landmark. Atlas intentionally keeps DOM focus on the map group while ArrowRight updates the live announcement; the test was corrected to assert that behavior.

The 200%-only compact header adjustment places Close in the flex row and lets the heading/description use the remaining width; text/font sizes remain unchanged. The focused 200% case passed 1/1. The full focused spec command, `npx playwright test e2e/lab/world-atlas.spec.js --reporter=line --workers=1`, passed 16/16 in 38.9 seconds, including the existing 150% case and Atlas coverage. Scoped review found no actionable findings. No build or full suite was run.

## Acceptance criteria

- [x] The 200% preference is applied at 320 by 360, and the Atlas accessible region, header/title/description, Close control, map, instructions, and live announcer are available.
- [x] Header text does not collide with itself, Close, or instructions. The panel and page stay within viewport bounds with no horizontal overflow.
- [x] The panel clears the toolbar by at least 10px without overlap; the compact toolbar rail remains present, and all its controls remain keyboard reachable, in bounds, and center hit-testable.
- [x] The map group retains focus as ArrowRight moves the map crosshair and announces a nearby landmark; Enter recenters the camera and changes the outline without changing scale; Escape closes Atlas, returns focus to the toggle, and preserves the recentered camera.
- [x] Existing 150% compact coverage and Atlas/Inspector, map, camera, and persistence behavior remain intact; no save-schema or progression behavior changes.
- [x] Only focused World Atlas tests are run; scoped review is complete, project documentation is updated, the finalized plan is archived, and the separate human-playtest/content-expansion gate remains active.
