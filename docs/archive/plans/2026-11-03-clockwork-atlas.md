# Plan: Clockwork Atlas Interactive Minimap

**Status:** Complete (2026-11-03). Focused verification and final review
passed; the full suite was not run. Keep the independent human-playtest and
content-expansion gate open. Archived as
`docs/archive/plans/2026-11-03-clockwork-atlas.md`.

## Goal

Add a content-free interactive minimap for the complete 5,200 × 3,400
laboratory. The atlas gives players a compact overview of item density,
destinations, scratch pads, the Engine, and the portion of the world currently
visible in the main viewport. It provides another way to navigate the existing
world without changing the jump selector, Item Finder, or core sorting loop.

## Scope and intended behavior

- Add a collapsible map toggle and a labelled map region to `WorldViewport`.
  The map represents the full `worldBounds`, currently `{ x: 0, y: 0,
  width: 5200, height: 3400 }`.
- Show item distribution as a bounded grid of density bins aggregated from
  current item positions. Draw landmarks for every destination, both scratch
  pads, and the Palimpsest Engine. Do not add per-item map controls, item title
  labels, story text, world entities, or other authored content.
- Draw the current camera's visible world rectangle, clipped to the map's
  world bounds. Keep it synchronized with the latest camera and measured
  viewport size, including during ordinary pan and zoom.
- A pointer click or drag on the map selects a world point and recenters the
  main viewport on it while preserving the current camera scale. Clamp the
  inverse-mapped point to `worldBounds`. Pointer interaction must not pan the
  world directly, select or drag an item, or trigger wheel zoom behind the
  map.
- Provide a keyboard crosshair. When the map opens, move focus into its
  keyboard interaction surface. Arrow keys move the crosshair by one map bin
  and clamp it at the map edges; Enter recenters on the crosshair while
  preserving zoom. Escape closes the map and restores focus to its toggle.
- Provide a polite status that reports the resulting map location and current
  zoom after pointer recentering or Enter. Keep announcements concise and do
  not emit a stream of announcements for every pointer-move frame.
- At 390 × 480 and 320 × 480, the map starts collapsed. Its toggle and open
  map layout must remain usable at both widths and avoid covering essential
  world controls. On wider layouts, the toggle controls whether the map is
  shown.
- Respect reduced motion. In either saved user preference or OS reduced-motion
  mode, map opening/closing and camera recentering respond immediately without
  animated transitions. Density, landmarks, camera outline, and keyboard
  crosshair remain available.
- Keep the existing world jump selector and Item Finder available and
  behaviorally unchanged. Do not require either tool to open or operate the
  atlas.

## Projection and camera mapping

Use `worldBounds` as the source of the atlas extent, including its origin.
Fit that extent uniformly inside the map drawing area and center it in both
axes so any unused area becomes letterboxing. For local map size `mapWidth ×
mapHeight`, compute the scale and letterbox offset as:

```text
mapScale = min(mapWidth / worldBounds.width,
               mapHeight / worldBounds.height)
offsetX = (mapWidth - mapScale * worldBounds.width) / 2
offsetY = (mapHeight - mapScale * worldBounds.height) / 2
```

Project a world point `(worldX, worldY)` to local map coordinates:

```text
mapX = offsetX + (worldX - worldBounds.x) * mapScale
mapY = offsetY + (worldY - worldBounds.y) * mapScale
```

For pointer input, invert that mapping and clamp to the world bounds:

```text
worldX = clamp(worldBounds.x + (mapX - offsetX) / mapScale,
                worldBounds.x, worldBounds.x + worldBounds.width)
worldY = clamp(worldBounds.y + (mapY - offsetY) / mapScale,
                worldBounds.y, worldBounds.y + worldBounds.height)
```

Use the existing camera transform convention: `screen = world * scale + pan`.
For viewport width `viewWidth`, height `viewHeight`, and camera `{ panX, panY,
scale }`, derive the unclipped visible world rectangle from the four viewport
edges, then intersect it with `worldBounds` before projecting it onto the map:

```text
visibleLeft   = (0 - panX) / scale
visibleTop    = (0 - panY) / scale
visibleRight  = (viewWidth - panX) / scale
visibleBottom = (viewHeight - panY) / scale
```

To recenter on world point `(worldX, worldY)` without changing zoom, use the
existing viewport center and camera scale:

```text
panX = viewWidth / 2 - worldX * scale
panY = viewHeight / 2 - worldY * scale
```

Do not duplicate or reinterpret camera transform math elsewhere. Handle
letterboxing before inverse pointer mapping, then clamp the world point so
clicks in letterboxed regions map safely to the nearest world edge.

## Implementation constraints

1. Integrate the atlas with the existing `WorldViewport`, `worldBounds`,
   camera refs, viewport-size observer, and camera update callbacks. Derive the
   camera rectangle from the latest camera state rather than a stale render or
   culling snapshot.
2. Keep geometry and aggregation in pure helpers with these planned APIs:
   `createWorldAtlasProjection(worldBounds, { width, height }, padding)`,
   `buildAtlasDensity(items, worldBounds, columns, rows)`, and
   `getAtlasViewportPolygon(camera, viewportSize, worldBounds, projection)`.
   Keep projection math independent of React and testable with varied bounds.
3. Aggregate density from existing item positions and draw a bounded number
   of bins regardless of whether the save contains 174 or 5,024 items. Update
   aggregates when world items change, not on each pointer or camera frame.
   Obtain destination, scratch-pad, and Engine landmarks from existing world
   data. Do not add React DOM nodes proportional to the entity count.
4. Reuse existing camera pan/update behavior. Preserve scale exactly for map
   recentering, coalesce pointer-drag camera updates to animation frames, and
   publish through the existing camera-change path so the normal viewport,
   culling, and saved camera stay in sync.
5. Isolate map gestures from `.world-viewport` gestures. Stop pointer and wheel
   propagation from the map surface, use pointer capture for map dragging, and
   ensure clicks cannot start item selection, object drag, world pan, or zoom.
6. Keep atlas visibility, keyboard crosshair, and any temporary pointer
   position in transient UI state only. Do not add game-state or save fields,
   change schema v3, alter item placements/progression, or persist the map's
   open state. Camera changes continue through the existing camera persistence
   behavior.
7. Give the toggle an accessible name and `aria-expanded`/`aria-controls`
   relationship. Give the map an accessible region label and expose landmark
   names and the camera's location/zoom through the polite status. Limit live
   announcements to meaningful navigation changes.
8. Preserve existing jump-selector and Finder controls, focus flows, camera
   persistence, and all world interactions outside the map overlay.

## Risks and verification

- Projection errors can arise from forgetting `worldBounds.x/y`, centering
  offsets, or inverse letterbox mapping. Verify center, all four edges, and a
  nonzero-origin bounds fixture in focused math coverage if the helpers accept
  alternate bounds.
- A map overlay may leak pointer, wheel, or keyboard input into the world and
  cause accidental item moves or camera changes. Verify pointer down/move/up,
  capture loss, wheel, touch, and keyboard events do not activate underlying
  world controls.
- The camera rectangle can lag during scheduled camera updates or viewport
  resize. Verify it tracks pan, wheel zoom, reset/jump, and resize without
  changing the camera scale during minimap recentering.
- Updating camera state on every map pointer event can increase render,
  culling, and autosave work. Keep map drawing bounded, aggregate density
  separately from pointer movement, coalesce drag updates, and commit through
  the current camera path.
- Verify map visibility and crosshair are not serialized, while a recentered
  camera is saved and restored by the existing camera persistence behavior.
  Existing v3 schema and world entity count must remain unchanged.
- Verify keyboard focus enters when opened, arrows clamp the crosshair, Enter
  recenters, and Escape closes and restores focus to the toggle. Verify status
  includes both location and zoom without excessive announcements.
- Check default-collapsed behavior and usable geometry at 390 × 480 and 320 ×
  480, as well as a desktop viewport. Check saved and OS reduced-motion modes
  produce immediate map and camera response.
- Recheck performance at the 5,024-item limit: fixed bin count, no per-entity
  map DOM, and no measurable disruption to normal world pan/zoom, hit-testing,
  drag, or culling. Performance timing remains host-sensitive.
- The independent human playtest and content-expansion gate stays open. This
  navigation aid adds no authored content and does not clear that gate.

## Test plan

**Status:** Focused verification complete. Historical red baselines are kept
below for regression context.

### Unit regression

File: `tests/unit/game-foundation/world-atlas.test.mjs` (6 tests).

```sh
node --test --test-isolation=none --test-name-pattern="World atlas" tests/unit/game-foundation/world-atlas.test.mjs
```

The six tests cover projection round-tripping with nonzero world origins,
aspect-ratio preservation and centered letterboxing, clamping out-of-bounds
points, camera-visible polygon clipping to the world bounds, fixed-grid density
aggregation, and aggregation of all 5,024 items without per-item output data.
**Red baseline:** 0/1 passed; the suite failed with `ERR_MODULE_NOT_FOUND` for
`src/game/world/atlasMap.js`, before the six cases could execute.

**Final result:** 6/6 passed.

### Browser regression

File: `e2e/lab/world-atlas.spec.js` (11 cases).

```sh
npm run test:e2e -- --workers=1 e2e/lab/world-atlas.spec.js
```

The cases cover collapsed/open toggle, landmarks and bounded density, camera
outline rendering and updates after pan/zoom, landmark click and map drag
recentering without zoom change, pointer isolation from item placement,
keyboard navigation and focus return, preservation of world jump and Finder,
mutual exclusion between Atlas and Finder in both directions at 390 × 480,
390/320px geometry, reduced motion, camera autosave/reload without atlas save
fields, and bounded DOM/density with 5,024 items. The expected test hooks are
`data-testid="world-atlas-toggle"`, `data-testid="world-atlas-panel"`,
`data-testid="world-atlas-density"`,
`data-testid="world-atlas-viewport-outline"`,
`data-testid="world-atlas-landmark-${id}"`, and
`data-testid="world-atlas-announcer"`.

**Historical red baseline:** before the Atlas UI was implemented, the original
10-case command completed under elevated execution with 10 failed and
0 passed. Each case failed at the expected missing `world-atlas-toggle` locator.
Playwright artifacts are under `test-results/lab-world-atlas-*`.

The 11th case checks that Atlas and Finder are mutually exclusive at
390 × 480:

```sh
npm run test:e2e -- --workers=1 e2e/lab/world-atlas.spec.js --grep "World atlas and item Finder are mutually exclusive"
```

Its pre-fix elevated red baseline was 1 failed with three soft assertion failures:
Finder remained open after opening Atlas, and Atlas remained open with
`aria-expanded="true"` after opening Finder. Artifacts are under
`test-results/lab-world-atlas-World-atla-30725-ly-exclusive-at-390px-width`.

**Final verification:** the complete E2E command passed 11/11, the unit command
passed 6/6, and `npm run build` passed with Vite 8.3.5. Code Reviewer found no
actionable findings. The full suite was not run. Keep the independent
human-playtest/content-expansion gate open.
