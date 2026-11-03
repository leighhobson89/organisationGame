# Plan: Build the laboratory game foundation and vertical slice

**Status:** Completed for the initial foundation and playable-slice milestone on 2026-11-03. This plan does not mark the full game, runtime scaling, or ending as complete.

## Goal and scope

Build the requested original steampunk laboratory organisation game in stages.
This plan covers project setup, useful game/design documentation, and a playable
vertical slice with the main organising loop. It also records the path to the
complete game so the slice's systems can grow without building a disposable
prototype.

Use Vite, React, plain JavaScript ES modules, and CSS. Keep the experience
client-side with no backend. The laboratory is one continuous, finite, large
coordinate space with all regions reachable from the start.

## Architecture decisions

- Organise authored definitions and deterministic filler generation under
  `src/game/content/`.
- Keep placement, collection progress, skills, puzzles, and save validation as
  pure or narrowly stateful modules under `src/game/domain/` and
  `src/game/persistence/`.
- Keep camera math, pointer interaction, and a uniform-grid spatial index under
  `src/game/world/`. Begin with culled React DOM items; profile before adopting a
  canvas or a more complex renderer.
- Keep the React application shell and panels under `src/app/` and `src/ui/`,
  with the visual system under `src/styles/`.
- Represent items by stable IDs, a family/type, collection, world position, and
  placement. Seed generated filler for reproducible content and save fixtures.
- Use pointer-to-world transforms for camera-aware dragging. Validate only
  drops into final destinations. A wrong item remains in the chosen destination
  with invalid styling and a non-colour-only cue until moved again.
- Store serializable, versioned state in localStorage as LZ-String-compressed
  data. Route startup recovery, autosaves, and imports through a canonical,
  safe `normalizeGameState` boundary. Bump the canonical format to v2; migrate
  known v1 states and strictly validate v2. Import must migrate and validate a
  candidate before backing up or applying it. Preserve a valid raw v1 autosave
  in recovery storage before a migrated v2 autosave can replace it. Preserve a
  corrupt autosave, recover a valid backup, and only then enable writes that
  could overwrite the main record.
- Treat rotation as trusted content data. Filed items render at 0°; when an item
  returns to the workspace, derive its canonical generated rotation from the
  trusted item definition. Ignore imported rotation values.
- Preserve the workspace's current 78px visual minimum. For filed elements,
  override `min-height` with canonical `item.height` so their actual border-box
  dimensions fit the 92×66 item and 100×74 slot bounds. Do not change workspace
  styling to solve filed-slot containment.
- Give destinations and scratch pads contained, capacity-aware slots. Use one
  shared slot-allocation and capacity-validation path for pointer and inspector
  moves. Pointer drops choose the nearest free slot; count invalid items as
  occupants. Exclude the moving item from capacity checks so same-target moves
  remain possible when full; reject new arrivals without changing their state.
- Migrate v1 placements in saved item order. Preserve an existing valid unused
  slot where possible; otherwise assign the nearest free slot to the saved
  position and recompute the v2 position and rotation. Preserve every item. If
  a legacy target exceeds capacity, move overflow to the workspace at
  `previousWorkspacePosition ?? old position` and surface a migration notice.
  Reject over-capacity v2 input. Re-normalizing or round-tripping v2 must not
  move items, change counts, or duplicate progress.
- Use these initial bounds and grids: calibration folio at `(540, 170)`,
  `420×300`, with a `4×2` grid; blueprint cabinet at `(1500, 2640)`, `640×660`,
  with `6×6` slots; field-note drawer at `(2180, 2640)`, clockwork bin at
  `(2860, 2640)`, and experiment archive at `(3540, 2640)`, each `640×660` with
  `6×7` grids and a 40-item capacity. Each scratch pad keeps its current X
  position at Y `1850`, with `540×530` bounds, a `5×5` grid, and 24-item
  capacity. Use 100×74 large-container cells with 8px gaps, 20px horizontal
  inset, and 76px top inset; keep focus controls and badges outside item slots.
- Treat `pointercancel` and Escape as cancellation of active item drags and
  camera pans. Restore the pre-gesture item/camera state, preserve selection,
  and return focus to the original item or viewport after cancellation.
- Keep keyboard focus on the inspector's Move button after a move or capacity
  rejection. Retain the selected item and inspector; announce the result
  through the status region instead of moving focus to the destination.
- Use **The Palimpsest Engine** as the selected invention concept: it rebuilds a
  luminous replay from object impressions, connecting organisation to story
  discovery while leaving sorting under player control. Retain the Aether Loom
  and Chrono-Weaver concepts as rejected alternatives in the vision document.

## Vertical-slice scope

Create a polished initial laboratory with about 150 items across authored story
objects and deterministic filler families (blueprint fragments, notes, gears,
and experiment records). Include:

- Cursor-centered zoom, panning, reset/focus navigation, and viewport culling.
- Dragging among the main world, temporary scratch pads, and several final
  destinations whose slots remain contained within their surfaces. Pointer and
  inspector moves share the same capacity-aware allocator and validation.
- Correct placement feedback and persistent, recoverable invalid placement.
- An eight-card **Harmonic Calibration** collection. Completing it grants one
  skill point once and reveals a glyph-sequence puzzle from marks that align
  across the cards. The first **Resonance Lens** skill highlights related
  objects and their clues without sorting them automatically.
- Local and global progress, a physical-notebook-inspired journal, and the
  first visible stage of the Palimpsest Engine.
- A selected-item inspector that shows the item's discovered category/clues and
  offers explicit keyboard-accessible move actions for the workspace, scratch
  pad, and destinations. This gives players a precise alternative to dragging.
- The inspector remains selected after a move or full-target rejection. Keep
  focus on its Move button and announce success/rejection without sending focus
  to the destination.
- Frequent autosaving and manual compressed save export/import with safe
  normalization, corrupt-save recovery, and failure handling.
- Cancellation of an active item drag or camera pan with `pointercancel` or
  Escape, restoring the pre-gesture item or camera state and returning focus to
  the selected object or viewport.
- A rich, readable brass-and-parchment visual system with low-frequency paper
  texture, visually distinct item-family silhouettes, subtle feedback motion,
  high-contrast focus indicators, keyboard access, and reduced-motion support.

Do not expand to thousands of authored objects before the slice is fun and the
rendering strategy is measured.

## Documentation deliverables

Create and maintain:

- `docs/GAME_VISION.md`: player fantasy, setting, core loop, object taxonomy,
  collections, story, invention concepts and choice, skills, puzzles, and
  experience goals.
- `docs/ARCHITECTURE.md`: modules, world/camera/rendering strategy, content
  pipeline, save schema, accessibility, testing, and technical risk assessment.
- `docs/VERTICAL_SLICE.md`: feature boundary, interaction details, and
  acceptance criteria for the playable slice.
- `docs/ROADMAP.md`: initial milestone checklist from setup through full
  restoration, invention activation, ending, scale, and release polish.

## Specialist workflow

Use the available Architect, Documentation Specialist, Test Engineer,
JavaScript Developer, React Developer, CSS Developer, and Code Reviewer roles
through the project. The repository has no dedicated game-design, narrative,
performance, accessibility, or playtesting role. Use Architect and JavaScript
Developer for game-system/content design, React and CSS Developers for UX and
accessibility reviews, Test Engineer for automated QA, and Code Reviewer for
performance and implementation review. Record this role coverage and limitation
in the project docs; do not invent specialist capabilities the role files do not
claim.

## Final verification and remaining work

- [x] `npm run test:game` — 32/32 passed.
- [x] `npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js e2e/lab/organising-loop.spec.js` — 22/22 passed (20 world/save/recovery and 2 organising-loop tests).
- [x] `npm run build` — passed.
- [x] Record the Node generation/index microbenchmark at 150, 500, 1,000, 2,500, and 5,000 entities. These are data/index timings, not browser rendering, frame, drag, or pan performance; at 5,000 entries, the viewport query returned about 72% of items. Method and results are in `docs/ARCHITECTURE.md`.
- [ ] Measure browser frame and interaction performance at representative entity counts before scaling.
- [ ] Conduct and record a human playtest.
- [ ] Complete the full story and ending in later milestones.

Known slice limitations: compact filed note titles may clip; manual local backup has no dedicated restore UI.

## Focused verification records

- Focused unit command for game-system contracts (32/32 passed):
  `node --test --test-isolation=none tests/unit/game-foundation/game-systems.test.mjs`
- The unit checks require seeded generation to produce the requested count,
  stable unique IDs, and at least four families; placement validation to return
  `correct`, `invalid`, or `unchecked` while preserving the selected target;
  camera transforms to round-trip and pointer-centered zoom to preserve its
  world point; spatial queries to return only intersecting entries. Add a sparse
  index regression with many offscreen entries that verifies `query()` visits
  only IDs collected from intersecting grid cells rather than scanning the
  entire entries map after candidate collection; collection rewards to be
  immutable and idempotent while unlocking one skill point and puzzle; and
  compressed saves to round-trip while malformed/unsupported imports are
  rejected without changing current state. `normalizeGameState` must reject
  over-capacity item arrays, zero or oversized dimensions, unknown placement
  target kinds or IDs, duplicate item IDs, and positions outside configured
  world bounds before accepting an import. Confirm canonical generated states
  still normalize and import successfully without changing valid IDs,
  dimensions, positions, or target references.
- Persistence checks: preserve a corrupt autosave byte-for-byte, recover a valid
  backup before enabling an autosave that could overwrite the main record, and
  cover the no-valid-backup case. Preserve the raw valid v1 autosave in recovery
  storage before the first migrated v2 autosave replaces the main key. Invalid
  imports must not replace current progress. Manual-save restore UI is outside
  this increment; startup autosave recovery remains in scope.
- Add focused v1-to-v2 migration and rotation regressions:
  - [x] Preserve each valid unused v1 slot; for missing/duplicate slots or old
    positions outside the new grid, assign the nearest free slot in saved item
    order, then recompute canonical v2 position and rotation.
  - [x] When a v1 target exceeds capacity, retain every item by salvaging
    overflow to `previousWorkspacePosition ?? old position` and return a
    migration notice; strict v2 normalization rejects the same over-capacity
    state.
  - [x] Cover rotated items filed in every target kind (render at 0°), returning
    them to the workspace (restore trusted content rotation), and ignoring
    imported rotation values.
  - [x] Re-normalizing and save-round-tripping a migrated v2 state leaves item
    positions, counts, and progression unchanged.
  - [x] Strict v2 normalization rejects an item with a valid target ID but a
    position that does not match its canonical slot, and rejects a placed item
    missing `slotIndex`.
  - [x] An import is migrated and validated before backup/apply; rejection
    leaves the live state, autosave, and backup unchanged.
- Add focused regression checks for slot containment and shared allocation:
  - [x] Every generated destination/scratch-pad slot stays inside its usable
    bounds, avoids header/footer controls, and does not overlap another slot.
  - [x] Pointer and inspector moves use the same allocator and capacity rules;
    pointer moves choose the nearest free slot.
  - [x] A new arrival to a full target is rejected without changing its
    placement; an existing occupant can move within that same full target and
    occupant count remains constant.
  - [x] Invalidly placed objects still count toward target capacity.
- Add focused regression checks for keyboard focus and gesture cancellation:
  - [x] After inspector Move succeeds or is rejected for capacity, selection and
    inspector remain available, focus stays on Move, and the status region
    announces the result.
  - [x] `pointercancel` restores the dragged item and its selection/focus;
    Escape cancels both an item drag and a pan, restores the initial item/camera
    state, and leaves the item unfiled.
- Browser E2E exercises real Playwright pointer input to move an item to a
  scratch pad, pan and zoom, and make correct and incorrect destination drops.
  Also verify a full-target rejection and allowed same-target move, keyboard
  focus handoff after inspector Move, and Escape cancellation. Cover valid and
  rejected imports through the UI, then reload after a real pointer move to
  confirm autosave restoration. Unit calls or programmatic state changes do not
  substitute for pointer/autosave coverage.
- The real-DOM bounds regression inspects filed item rectangles in two adjacent
  slot rows and asserts their actual border boxes fit within the configured
  bounds and do not intersect. Keep the workspace's existing 78px visual
  minimum unchanged during this check.
- The v1 import E2E imports a v1 fixture, verifies migrated placements and any
  overflow notice, waits for the v2 autosave, reloads, and confirms item count and
  placements remain stable. A rejected import must leave the live state and
  stored autosave/backup strings unchanged.
- Strict-v2 import E2E rejects a valid target ID paired with a
  mismatched slot position and a placed item missing `slotIndex`. Snapshot
  the live exported state, autosave string, and backup string before each
  rejection; assert all three remain unchanged afterward.
- Browser checks also confirm the first view is visibly dense but navigable, a
  user can complete a collection and inspect progress/notebook feedback, and a
  saved state survives reload.
- UI review: keyboard users can inspect a selected item and move it through
  explicit controls; focus remains high contrast at all zoom levels, and reduced
  motion disables decorative movement without hiding state changes.
- [x] Record Node generation/index microbenchmarks at 150, 500, 1,000, 2,500,
  and 5,000 entities; these are not browser performance measurements.
- [ ] Measure browser frame and interaction performance at 150, 500, and 1,000
  entities and decide whether further rendering optimizations are required
  before scaling toward 2,500 and 5,000 items.
- Run only focused checks for the changed functional area during development;
  ask for approval before a full suite, as required by `AGENTS.md`.

## Milestones

1. Set up the Vite/React JavaScript project, focused unit and browser test
   surfaces, source folders, and the four documentation deliverables.
2. Build data-driven item definitions, authored collections, seeded generation,
   the large world model, camera controls, and spatial culling.
3. Add drag/drop, capacity-aware destination/scratch-pad slots, validation,
   invalid recovery, gesture cancellation, and collection progress.
4. Add the first skill, collection-emergent puzzle, notebook, and invention
   reconstruction stage.
5. Add canonical v1-to-v2 save migration, strict v2 normalization, protected
   autosave recovery, versioned compressed autosaves, and safe manual
   export/import.
6. Playtest the slice, address usability and accessibility findings, and
   profile at increasing entity counts.
7. Expand content, collections, puzzles, skills, story, and invention stages;
   implement full restoration and the ending sequence; then run release polish.

## Acceptance criteria for this plan's first implementation milestone

- The project launches locally in a modern desktop browser with no backend.
- The screen shows an immediately dense but legible slice of one larger
  navigable laboratory and roughly 150 stable item entities across several
  families.
- The complete vertical-slice interactions above work end to end, including
  correct and incorrect destinations, scratch pads, a one-time collection
  reward, the first skill and puzzle, notebook/progress feedback, invention
  progress, and persistent compressed saves.
- All content slots remain contained inside their surfaces with no overlap or
  control occlusion. Inspector and pointer moves share capacity validation;
  full-target rejection preserves state, while same-target moves remain valid.
- Filed item border boxes fit their 92×66 item/100×74 slot bounds, including
  across two adjacent rows, while workspace styling retains its 78px visual
  minimum.
- Keyboard activation of a world item opens the inspector and focuses
  `move-target`. After Move succeeds or capacity rejects it, focus stays on
  `move-item` and the result is announced.
- Filed items render at 0° and return to trusted content rotation in the
  workspace. V1 saves migrate without losing items; overflow is salvaged with a
  notice, the raw v1 autosave is kept in recovery before v2 overwrite, and
  repeated v2 normalization/save round-trips remain stable. V2 imports are
  strict, and a rejected import changes neither live progress nor backup data.
- `pointercancel` and Escape restore in-progress gestures and return focus to
  the selected item or viewport.
- Focused unit and browser E2E checks pass as recorded above. A human playtest
  remains future work; record findings when that playtest occurs.
- Node index/generation timings and known limitations are recorded. Browser
  frame and interaction performance remain unverified before content scaling.
