# Plan: Touch Pinch Navigation

**Status:** Complete (2026-11-03). Implementation, focused verification, and
review are complete. The independent human-playtest gate remains open; the
user deferred that playtest for now, so content expansion remains gated.

## Goal

Add two-finger pinch zoom to the existing continuous laboratory world. Zoom is
anchored at the moving midpoint between the two touches, so the point beneath
the gesture remains stable as the fingers move. Preserve one-finger empty-space
pan and item drag, along with current mouse, wheel, and keyboard behavior.

## Scope and intended behavior

- Add the pure camera helper
  `zoomAtPinch(camera, start, current, options = {})` in
  `src/game/world/camera.js`. Both gesture points have this shape:

  ```js
  {
    midpoint: { x, y },
    distance,
  }
  ```

- Compute the requested scale from the ratio between current and starting
  finger distance, clamped to the same default limits as `zoomAtPointer`:
  minimum `0.2`, maximum `2.5`. Optional `minScale` and `maxScale` values use
  the existing zoom-helper conventions.
- Anchor the world point beneath the starting midpoint at the current
  midpoint after zoom. Given `start.midpoint` and `camera`, preserve
  `screenToWorld(start.midpoint, camera)` by setting the new pan so this world
  point projects to `current.midpoint` at the new scale:

  ```text
  anchor = screenToWorld(start.midpoint, camera)
  scale = clamp(camera.scale * current.distance / start.distance,
                minScale, maxScale)
  panX = current.midpoint.x - anchor.x * scale
  panY = current.midpoint.y - anchor.y * scale
  ```
- In `WorldViewport`, track touch pointers by `pointerId` and use pointer
  capture for the active gesture. The first touch continues to follow existing
  behavior: an empty-space contact pans, and a contact on an item can drag it.
  When a second touch arrives during empty-space pan, transition into a pinch
  using the current camera and both viewport-local points.
- If a second touch arrives during an item drag, cancel the item drag before
  starting the pinch. Clear its drag preview, restore the item's original
  state, release its capture as appropriate, and do not call drop, placement,
  or item-drop audio paths.
- When one of the two pinch fingers lifts normally, finish the pinch at the
  current camera and rebase the remaining finger as a one-finger pan. Movement
  after the lift pans continuously without a jump. When the last active finger
  lifts, commit the latest camera and release captures.
- Ignore a third touch while a two-finger pinch is active. It must not replace
  either pinch pointer or change the pinch baseline. If one pinch finger lifts,
  continue with the remaining pinch finger as a pan; do not promote a third
  touch into the active pair until the current gesture has ended.
- Treat `pointercancel` or unexpected loss of capture on an active touch as a
  cancellation of the current gesture. Restore the camera to the current
  gesture's start camera, clear all gesture/preview state, and release any
  remaining captures. A canceled item drag must never file the item.
- Continue to use the existing one-pointer pan/item-drag behavior. Mouse drag,
  wheel zoom through `zoomAtPointer`, keyboard pan/zoom, selection, item drop,
  and pointercancel/Escape behavior remain available and unchanged when a
  pinch is not active.

## Implementation constraints

1. Keep `zoomAtPinch` pure and colocated with the existing transform helpers
   in `src/game/world/camera.js`. Validate finite midpoint coordinates,
   positive finite distances, valid camera values, and ordered positive zoom
   bounds. Do not mutate inputs.
2. Implement pointer-state transitions in `src/ui/WorldViewport.jsx`. Keep
   gesture points in viewport-local coordinates, capture each active touch,
   update the camera through the existing `scheduleCamera` path while moving,
   and finalize/cancel through the existing camera commit path.
3. Use a stable pinch-start camera and baseline points for each pinch. Compute
   every pinch update from that baseline with `zoomAtPinch`; do not compound
   rounding by repeatedly using an already-zoomed camera as the next start.
4. On pinch start during an item drag, cancel that drag without invoking
   `onDrop`, `emitGameAudioEvent('item.drop', ...)`, placement validation, or
   progression changes. Preserve the original item position and placement.
5. Clear active pointer IDs, captures, pending camera frames, and gesture state
   on normal completion, `pointercancel`, lost capture, and component cleanup.
   Do not let a stale pointer event revive a canceled gesture.
6. Keep camera changes on the existing `onCameraChange`/commit and save path.
   Add no item, catalog, story, progression, or save fields; leave schema v3
   unchanged.
7. Preserve existing world keyboard handlers, mouse interactions, wheel
   anchoring, atlas/Finder interactions, and the separate human-playtest and
   content-expansion gate.

## Risks and verification

- A changing midpoint and distance must both affect the output: verify the
  start-midpoint world anchor remains under the current midpoint while scale
  follows the distance ratio, including zoom-limit clamping.
- Multi-pointer events can race with pointer capture, pointer release, and
  browser `pointercancel`. Verify all capture IDs and state transitions are
  cleaned up and a later pointer cannot complete a canceled drag.
- Transitioning from item drag to pinch must not trigger a drop or mutate the
  item. Verify this for both an in-progress drag and a touch that begins on an
  item before the second finger arrives.
- Lifting one pinch finger must rebase to the remaining finger's current
  position and continue pan smoothly. A third touch must not change the active
  pair or cause a camera jump.
- Verify empty-space one-finger panning, item dragging, mouse pan/drag, wheel
  zoom, and keyboard pan/zoom still work with the same camera behavior.
- Camera gestures must use the existing camera commit/save path. Verify the
  final camera autosaves and reloads with the existing `{ panX, panY, scale }`
  shape and no added save fields.
- Keep camera updates frame-bounded during a pinch. Check ordinary rendering,
  culling, hit testing, and item movement remain responsive at the existing
  5,024-entity limit.
- The independent human-playtest/content-expansion gate remains unchanged.
  Automated gesture coverage does not replace human feedback.

## Test plan

**Status:** Implementation, focused verification, and review are complete.

Affected implementation modules are `src/game/world/camera.js` and
`src/ui/WorldViewport.jsx`.

### Unit regression

File: `tests/unit/game-foundation/camera-pinch.test.mjs` (4 tests).

```sh
node --test --test-isolation=none --test-name-pattern="pinch zoom" tests/unit/game-foundation/camera-pinch.test.mjs
```

The tests cover moving-midpoint anchoring and distance-ratio scaling without
mutating inputs, configured minimum/maximum scale clamping, rejection of zero,
negative, or non-finite distances, and midpoint/scale-bound validation.
**Red baseline:** module linking failed because `camera.js` does not yet export
`zoomAtPinch`; 0 tests executed.
**Final result:** the focused unit command passed 4/4 after implementation.

### Browser regression

File: `e2e/lab/touch-navigation.spec.js` (6 cases).

```sh
npm run test:e2e -- --workers=1 e2e/lab/touch-navigation.spec.js
```

Coverage includes one-finger empty-space pan without zoom change, two-finger
pinch in and out with a moving midpoint anchor, continuing to pan after one
pinch finger lifts, canceling an item drag when a second finger arrives
without changing placement, one-finger camera autosave/reload, and separate
pinch-camera autosave/reload coverage. **Recorded red baseline:** CDP
multi-touch ran successfully; 3 passed and 2 failed. Pinch scale stayed at
`0.5`, and lift-to-pan did not move the camera (`panX` stayed `20`). The lift
sequence was reached, but the CDP `touchEnd` event included only the lifted
contact; Chromium/Edge kept both contacts active because the `touchMove`
omitted the remaining contact. The regression now sends the remaining contact
in `touchMove` and ends only the lifted pointer, so continuation is exercised
correctly. Artifacts from the original run are under
`test-results/lab-touch-navigation-*`. The corrected six-case E2E passed 6/6.

The E2E cases also verify that the item-drag-to-pinch cancellation never drops
or files the item and that pan and pinch camera persistence use the existing
save shape. The production build passed with Vite 8.3.5, and Code Reviewer
found no actionable issues. The full test suite was not run. Preserve the
current pointercancel, Escape, mouse, wheel, and keyboard regressions. The
user deferred the independent human playtest for now; the separate gate stays
open and content expansion remains gated.
