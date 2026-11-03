# Coarse-pointer tap selection

**Status:** Complete. The focused touch-navigation spec passes with real coarse-pointer tap-selection coverage, and existing app behavior required no changes.

## Goal

Verify that a real touch tap selects a laboratory object and opens its Inspector without moving or filing the object or changing the camera.

## Scope

- Reuse the fresh `hasTouch` fixture in `e2e/lab/touch-navigation.spec.js` at 390 by 844.
- Place `calibration-card-01` at world coordinates `{ x: 260, y: 230 }`; keep the other fixture items outside the viewport.
- Capture the item's visible bounds and tap its center using Playwright's touchscreen input.
- Confirm the Inspector opens for the tapped item and displays its title.
- Confirm the camera remains unchanged and the autosaved item's position, placement, and validation match the fixture.

## Boundaries

- If the regression fails, limit implementation changes to touch item selection and the related pointer-event wiring.
- Preserve drag thresholds, drag-and-drop, pinch takeover/cancellation, and save behavior.
- Do not add or change game content.
- The independent human playtest and content-expansion gate remain open; this automated check does not satisfy that gate.

## Verification

- The new case reuses `openTouchLab(browser, { dragItem: true })`, which creates a fresh 390 by 844 `hasTouch` context with `calibration-card-01` at `{ x: 260, y: 230 }` and the other fixture items outside the viewport.
- It measures the card center, records the scene camera, and uses `page.touchscreen.tap` to select the card.
- It verifies the Inspector shows the card title, the camera is unchanged, and the saved position, placement, and validation equal the fixture values.
- `npm run test:e2e -- --workers=1 e2e/lab/touch-navigation.spec.js` passed 8/8, including the new tap case.
- `npm run build` passed with Vite 8.3.5 (59 modules); scoped Code Reviewer found no actionable issues.
- No app behavior changed. The full test suite was not run; the independent human-playtest/content-expansion gate remains open.
- Do not run the full suite without user approval, per `AGENTS.md`.

## Acceptance criteria

- A real coarse-pointer tap selects `calibration-card-01` and shows its title in the Inspector.
- The camera and the item's saved position, placement, and validation remain unchanged.
- The focused touch-navigation spec and production build pass; review finds no actionable issues.
- The deferred human-playtest/content-expansion gate remains open.
