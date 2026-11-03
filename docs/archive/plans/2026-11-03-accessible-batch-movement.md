# Accessible Multi-Selection and Atomic Batch Movement

**Status:** Completed and reviewed on 2026-11-03. The active browser-scaling and human-playtest gate remains open.

## Goal and scope

Allow players to select several laboratory objects and move them together through an accessible Inspector workflow. Preserve all existing one-item interactions, authored content, progression rules, game-save schema, and the active playtest/content-expansion gate.

Selection is transient interface state. It must not enter `gameState`, autosaves, manual saves, exports, imports, or the v3 save schema.

## Player interaction

- Add a toolbar toggle that enters and exits selection mode.
- In selection mode, activating an object by pointer, touch, or keyboard toggles its membership. Activation must not begin an object drag.
- Expose each selectable object's membership with visible `aria-pressed` state and show a visible selected-item count.
- Cap selection at 40 objects, matching the largest destination capacity. This keeps the 40 selected objects plus the separately forced focused item below the hybrid Canvas overview's 64-item DOM overlay cap. Attempting to add a 41st object leaves membership unchanged and announces the limit.
- In the Inspector, provide a destination selector and a **Move N selected items** action. Keep the existing single-item Inspector move behavior unchanged outside batch selection.
- On successful movement, present a clear result. On capacity failure, keep the selection and announce why the batch could not be moved.

## Atomic placement and progression contract

Implement batch allocation through `src/game/world/placementLayout.js`, reuse correctness validation in `src/game/domain/placement.js` and progression rules in `src/game/domain/progression.js`, and orchestrate the atomic commit in `src/app/App.jsx`. Selection controls live in `src/ui/WorldViewport.jsx`, `src/ui/LabObject.jsx`, and `src/ui/ItemInspector.jsx`.

1. Build a staged placement result without mutating the live game state.
2. When allocating target slots, ignore the current occupants that are part of the selected batch so their slots are available to the staged move.
3. If every item cannot fit, reject the whole batch. Do not change any item placement, progress, rewards, gameplay events, or saved state; retain the selection and provide clear live feedback.
4. If all items fit, commit the complete staged placement set as one state transition. Validate each item independently, so an item sent to the wrong destination commits there and remains visibly misfiled while correctly placed items can count toward progression.
5. Derive collection and puzzle progress from the final staged state. Award each newly earned reward and publish each resulting gameplay event exactly once; do not replay progression for intermediate staged states.

## Focused regression plan

### Unit tests

Add three focused specifications to `tests/unit/game-foundation/game-systems.test.mjs`:

- Vacated slots are available during staged allocation, staged slots are unique, and the input state remains immutable.
- Duplicate selected IDs are deduplicated; an unknown ID rejects the batch atomically.
- Insufficient target capacity rejects the entire batch without any partial allocation.

### Browser E2E tests

Add six focused cases to `e2e/lab/organising-loop.spec.js`:

- Keyboard and pointer selection toggles membership without dragging; moving the selected items completes Harmonic Calibration once, awards one skill point, and unlocks its puzzle once. Assert a successful batch clears selection mode, resets the selected count to zero, and returns each affected object's `aria-pressed` state to `false`.
- An over-capacity batch is rejected while preserving item placements, progression, and saved state, and retaining the selection for correction.
- Mixed validation: move `calibration-card-08` and `blueprint-fragment-002` to `cabinet-blueprints`; assert the blueprint is correctly filed while the calibration card remains accessible and visibly misfiled.
- Selection cap: after selecting 40 objects, attempting to select a 41st leaves the existing membership and count unchanged and announces the 40-item limit.
- In Canvas-only overview mode, pointer-select a rendered item without starting a drag and verify its selection state.
- When entering multi-select with an item already inspected, include that item in the selected group; keyboard-deselecting it returns the count to zero and its `aria-pressed` state to `false`. Then select one item and move it through the group Inspector; success clears the group, exits selection mode, and resets its `aria-pressed` state to `false`.

Verified focused commands were `node --test --test-isolation=none tests/unit/game-foundation/game-systems.test.mjs`, `npm run test:e2e -- --workers=1 e2e/lab/organising-loop.spec.js`, and `npm run build`. The full test suite was not run.

## Acceptance criteria

- [x] Pointer, touch, and keyboard users can enter selection mode and toggle item membership without starting a drag.
- [x] Selection stops at 40 objects; an attempted 41st selection preserves membership and exposes an accessible limit message.
- [x] Selection count and membership are visibly and accessibly exposed, and the Inspector offers the destination and batch action.
- [x] Batch movement is all-or-nothing for allocation failures, with no item, progress, reward, event, or save mutation on rejection.
- [x] A fitting batch commits in one transition; item correctness remains independent, and final-state progression/rewards/events occur exactly once.
- [x] Selection is transient and no save-schema or content changes are introduced.
- [x] Existing one-item flows pass focused regressions, and the active browser-scaling/human-playtest gate stays open and unchanged.

## Final verification

- `node --test --test-isolation=none tests/unit/game-foundation/game-systems.test.mjs`: **49/49 passed**.
- `npm run test:e2e -- --workers=1 e2e/lab/organising-loop.spec.js`: **9/9 passed**.
- `npm run build`: passed with Vite 8.3.5.
- Code Reviewer found no actionable issues.
- The full test suite and independent human playthrough were not run; the active human-playtest/content-expansion gate remains open.

## Finalization

Updated `docs/ARCHITECTURE.md`, `docs/VERTICAL_SLICE.md`, `docs/TESTING_GUIDE.md`, and `docs/ROADMAP.md`; archived this plan as `docs/archive/plans/2026-11-03-accessible-batch-movement.md`. The active browser-scaling and human-playtest gate remains open and unchanged.
