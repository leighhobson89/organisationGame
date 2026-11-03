# Mouse pan cancellation on resize

**Status:** Complete. The resize regression exposed that an active mouse pan remained at its moved position after resize. The viewport observer now cancels active pan gestures, and focused browser verification passes.

## Goal

Ensure a viewport resize cancels an active mouse pan and restores the camera to the gesture's starting position. Later pointer movement from that gesture must not move the camera or alter the saved camera state.

## Scope

- Open a fresh laboratory at 1280x720 and locate empty world space.
- Record the original scene transform and camera.
- Start a mouse pan in empty space and move far enough to confirm the camera changed.
- Keep the mouse button held while resizing to 1024x720.
- Confirm the camera transform returns to its original value.
- Move the held pointer again, flush animation frames, and release it; confirm the camera and persisted camera remain unchanged.

## Boundaries

- If the regression fails, limit the source fix to resize cancellation for an active mouse pan in `src/ui/useWorldViewportController.js`.
- Preserve touch resize cancellation, item dragging, pinch takeover and cancellation, and camera scheduling.
- Do not change save fields or unrelated navigation behavior.
- The independent human playtest and content-expansion gate remain open; this automated check does not satisfy that gate.

## Test plan and baseline

- Set the browser viewport to 1280x720, open a fresh lab, and wait for the autosave to initialize.
- Find an empty viewport point, start a mouse pan, and move 76x48 CSS pixels to verify the scene transform changes.
- While the mouse remains held, resize to 1024x720 and require the scene transform to return to its original value.
- Move the held pointer again, flush animation frames, and release it. Confirm the scene transform remains original and the saved camera matches the pre-pan camera.
- Baseline command: `npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js` ran 25 tests; 24 passed and the new resize case failed after 5 seconds. It expected `translate(30px, 1px) scale(0.5)` after resize but received `translate(106px, 49px) scale(0.5)`, confirming the active mouse pan was not cancelled.
- The focused regression identified the resize cancellation condition in `useWorldViewportController.js` as the implementation boundary. The resize observer now cancels when touch pointers are active or the current gesture is a pan. This preserves touch cancellation while leaving mouse item drags unaffected.

## Verification

- The new focused regression in `e2e/lab/world-and-save-recovery.spec.js` uses the existing empty-viewport and animation-frame helpers.
- The baseline focused run passed 24/25 and failed the new resize case: after resizing, the scene remained at `translate(106px, 49px) scale(0.5)` instead of returning to `translate(30px, 1px) scale(0.5)`.
- After the resize cancellation fix, `npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js` passed 25/25.
- `npm run build` passed with Vite 8.3.5 (59 modules), and scoped review found no actionable issues.
- The full test suite was not run, per `AGENTS.md`; the independent human-playtest/content-expansion gate remains open.

## Acceptance criteria

- Resizing while a mouse pan is active restores the starting camera transform.
- Subsequent movement and release from the cancelled gesture do not change the live or saved camera.
- The focused world-and-save-recovery spec and production build pass, and review finds no actionable issues.
- The deferred human-playtest/content-expansion gate remains open.
