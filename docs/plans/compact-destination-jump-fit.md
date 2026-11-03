# Plan: Fit Compact Destination Jumps

**Status:** Active. This plan covers a narrow viewport regression; the separate human playtest and content-expansion gate remain open.

## Goal and scope

When a player selects a world destination, the camera should frame that destination within the visible world viewport on compact screens. `WorldViewport.jsx` currently uses a fixed `0.76` scale for destination jumps. That can clip the Blueprint Cabinet (640×660 world units) inside a 390×480 viewport.

Keep the change limited to destination jumps. Preserve the current desktop zoom preference, scratchpad behavior, saves, and game content. If the regression demonstrates clipping, compute the destination jump scale with the existing `fitTargetScale(destination, 0.76)` helper so it fits while retaining the current scale as its maximum/preferred value.

## Regression test plan

The focused browser regression is in `e2e/lab/research-chapter.spec.js`. At a 390×480 viewport, it starts from a fresh save, selects `destination:cabinet-blueprints`, waits for `destination-cabinet-blueprints`, and asserts the complete bounding box stays inside `world-viewport` with a 1px tolerance on all four edges. The baseline run confirmed the bug: 6 of 7 tests passed, while the new assertion failed because the Cabinet's left edge was 48.2px outside the viewport (expected at least -1px).

## Verification and review

- Run `npm run test:e2e -- --workers=1 e2e/lab/research-chapter.spec.js` and iterate until the focused research-chapter spec passes.
- Run the production build.
- Review the diff for scope: destination jump fit only, with desktop behavior and scratchpad behavior preserved.
- Do not run the full test suite without user approval.
- Keep the independent human playtest and content-expansion gate open; this viewport fix does not satisfy that gate.

## Documentation and completion

After implementation and review, update relevant project documentation if the behavior or test instructions require it. Archive this finalized plan in `docs/archive/plans/` under a dated, descriptive filename and leave `docs/plans/` empty once all work in this plan is complete.
