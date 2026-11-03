# Viewport camera controller extraction

## Goal

Extract camera scheduling and the main workspace gesture lifecycle from
`WorldViewport.jsx` into `useWorldViewportController`, preserving camera,
pointer, touch, keyboard, persistence, and cleanup behavior.

## Ownership and contract

- The hook owns camera/culling/size state and refs; animation-frame and zoom
  timers; pointer, touch, pinch, and Space gesture refs; drag preview; spatial
  index; keyboard listener; `ResizeObserver`; and main pointer, wheel, zoom,
  and focus handlers.
- `WorldViewport` retains DOM refs and Atlas state. It supplies the camera
  preview callback gated by `atlasOpenRef` and the title-reveal positioning
  callback.
- Return `cameraRef`, `size`, `cullingCamera`/revision, `dragPreview`, and the
  commit/schedule/cancel/focus/fit/zoom operations and pointer handlers needed
  by the view.
- Preserve external camera synchronization by cancelling/releasing gestures
  without rolling back over an incoming camera. Preserve resize cancellation
  and refresh, unmount capture/timer cleanup, pointer lost/cancel behavior,
  save timing, and current title-reveal positioning.

## Verification scope

- The focused regression plan adds two baseline-verified browser cases:
  resizing during a touch pan cancels it and ignores later movement, and
  unexpected pointer capture loss cancels pan and ignores later movement.
- Run those cases with `npx playwright test e2e/lab/touch-navigation.spec.js e2e/lab/world-and-save-recovery.spec.js --workers=1 --grep "resizing during a touch pan|unexpected pointer capture loss"`.
- Run the focused camera unit check:
  `node --test --test-isolation=none
  tests/unit/game-foundation/camera-pinch.test.mjs`.
- Run the relevant E2E specs:
  `npx playwright test e2e/lab/touch-navigation.spec.js
  e2e/lab/world-and-save-recovery.spec.js e2e/lab/organising-loop.spec.js
  --workers=1`.
- Run `npm run build` and code review after implementation. Run
  `npm run test:perf` only if rendering or camera behavior changes.
- Do not run the full test suite for this slice.

## Outcome (2026-11-03)

- `node --test --test-isolation=none
  tests/unit/game-foundation/camera-pinch.test.mjs` passed 4/4.
- `npx playwright test e2e/lab/touch-navigation.spec.js
  e2e/lab/world-and-save-recovery.spec.js e2e/lab/organising-loop.spec.js
  e2e/lab/filed-note-title.spec.js --workers=1` passed 53/53. Coverage
  includes resize-during-touch-pan and unexpected pointer-capture-loss
  cancellation, both ignoring later movement.
- `npm run build` passed with Vite 8.3.5. Code Reviewer found no correctness
  findings; `git diff --check` was clean. The full suite was not run.
