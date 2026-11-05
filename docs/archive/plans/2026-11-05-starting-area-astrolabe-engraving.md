# Plan: Add a Subdued Astrolabe Engraving to the Starting Area

**Status:** Complete. The starting area now has one static instrument detail that strengthens the steampunk floor identity without changing game content or interaction.

## Goal and scope

Add one subdued brass astrolabe/optical-instrument engraving inside `.world-ground` at world coordinates left 48, top 520, size 420 x 240. Keep it behind all destinations and cards, decorative (`aria-hidden`), and non-interactive.

Likely implementation files:

- `src/ui/WorldViewport.jsx` to render the static engraving as part of the world-ground layer.
- `src/styles/app.css` for its absolute world-coordinate placement and subdued appearance.
- `e2e/lab/world-ground-appearance.spec.js` for visibility, bounds, non-overlap, semantics, stacking, and pointer-isolation assertions.

Do not animate it or change the catalog, generated item positions, camera defaults/behavior, save state/schema, progression, or gameplay. Use only static vector/CSS decoration; do not add an external image asset.

## Implementation decisions

- Place the engraving within `.world-ground` so the camera transform moves and scales it with the floor.
- Keep the engraving behind the world overview canvas, all destinations, and item cards; it must not cover authored cards or intercept pointer/touch/keyboard input.
- Use subdued brass linework with enough contrast to be noticed at the fresh desktop view, while preserving floor and object readability.
- Keep all geometry within the specified 420 × 240 world-space bounds.

## Acceptance criteria

- At a fresh 1440 × 900 desktop view, the complete engraving is visible in the starting area.
- It does not overlap the Harmonic Calibration Folio or any of the eight calibration cards.
- Existing destination and item cards remain visually topmost and center-hit-testable.
- The engraving is inside `.world-ground`, `aria-hidden="true"`, and non-interactive (`pointer-events: none`); it has no animation.
- Panning and zooming move/scale it through the existing `.world-ground` camera transform.
- The world still reports 174 items, with no catalog, generated-position, game-state, or save-schema changes.

## Verification plan

- The Test Engineer added a failing regression to `e2e/lab/world-ground-appearance.spec.js` using a fresh 1440 × 900 viewport with the default camera and 174-item game.
- It requires exactly one engraving inside the ground with computed CSS `left/top/width/height` equal to 48/520/420/240; visible and fully inside the viewport; `aria-hidden="true"`; `pointer-events: none`; no animation; opacity greater than 0.08 and no more than 0.45; and no overlap with any rendered destination or item card.
- The same spec retains its general ground-layer pan/zoom movement and stacking-order guard.
- Expected red baseline: the regression cannot find the `world-ground-engraving` locator because the engraving has not yet been implemented.
- Run `npx playwright test e2e/lab/world-ground-appearance.spec.js --reporter=line --workers=1`.
- Run `npx playwright test e2e/lab/compact-start-framing.spec.js e2e/lab/organising-loop.spec.js --reporter=line --workers=1` to protect fresh framing and card hit testing.
- Run `npm run build` and scoped Code Reviewer review. Do not run the full suite.
- Record results and update visual documentation after implementation. Keep the independent human-playtest/content-expansion gate open.

## Results

- Test Engineer red baseline: `npx playwright test e2e/lab/world-ground-appearance.spec.js --grep "starting-area engraving" --reporter=line --workers=1` failed 1/1 at the intended missing `data-testid="world-ground-engraving"` count (0 vs 1).
- Implementation: `WorldGroundEngraving` adds a static inline SVG inside `.world-ground`; CSS places it at left 48px/top 520px with a 420px by 240px footprint, subdued brass color, 0.22 opacity, no animation, and no pointer events. It remains in the existing camera-transformed ground layer. No image asset, game content, camera behavior, save format, progression, or gameplay changed in this slice.
- `npx playwright test e2e/lab/world-ground-appearance.spec.js --reporter=line --workers=1` passed 2/2. The engraving case checks computed CSS world geometry, viewport bounds, card non-overlap, `aria-hidden`, pointer pass-through, opacity, static rendering, and the 174-item count; the existing test continues to cover ground pan/zoom behavior.
- `npx playwright test e2e/lab/compact-start-framing.spec.js e2e/lab/organising-loop.spec.js --reporter=line --workers=1` passed 31/31.
- `npm run build` passed with Vite 8.3.5 (62 modules).
- Scoped Code Reviewer found no actionable findings. The full test suite was not run. The independent human-playtest/content-expansion gate remains open.
- The finalized plan is archived at `docs/archive/plans/2026-11-05-starting-area-astrolabe-engraving.md`.
