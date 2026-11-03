# World Atlas panel extraction

## Goal

Reduce the responsibility of `WorldViewport` by extracting the Atlas panel's
presentational markup and display-only geometry into a controlled
`src/ui/WorldAtlasPanel.jsx` component. Preserve all existing behavior.

## Implementation boundaries

- Move the Atlas section markup and its display-only derivations (density
  cells, viewport polygon/points, and projected crosshair) into the new view.
- Keep Atlas state, toggle behavior, camera gestures/scheduling, and Finder
  mutual exclusion in `WorldViewport`; those depend on viewport-owned refs and
  orchestration.
- Pass current Atlas data, map ref, camera/size/bounds, status, and the existing
  close, key, pointer, recenter, and focus callbacks as props.
- Preserve DOM IDs/classes, accessible names and instructions, pointer event
  placement/bubbling, focus return, camera persistence, and save schema. Do not
  add persisted state.

## Verification scope

- No new regression test is needed: the existing Atlas unit and browser tests
  cover its behavior and the extraction is presentational.
- Run `node --test --test-isolation=none
  tests/unit/game-foundation/world-atlas.test.mjs`.
- Run `npx playwright test e2e/lab/world-atlas.spec.js --workers=1`.
- Run `npm run build` and request a code review after implementation.
- Run `npx playwright test e2e/lab/panel-coordination.spec.js --workers=1`
  only if the extraction changes event propagation.
- Do not run the full test suite for this slice.
