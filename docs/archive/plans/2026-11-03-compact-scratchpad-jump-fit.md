# Plan: Fit Scratchpad Jumps in Compact Viewports

**Status:** Complete. Compact scratchpad jumps fit the viewport; the preferred zoom, save behavior, capacity, and content remain unchanged.

## Goal and scope

Make a scratchpad opened from the scratchpad collection fully visible in the compact 320×480 game viewport. Scratchpads measure 540×530 world units. The current `jumpTo('scratchpad')` path uses a fixed scale of 0.72, rendering a pad about 389px wide and clipping it in a 320px viewport. Existing compact tests cover navigation and capacity but do not assert the selected target's geometry.

The focused regression should start a fresh game at 320×480, select `scratch-a`, and assert that the complete scratchpad bounding box is inside the world viewport. If the test reproduces the clipping, adjust only the scratchpad jump scale to use `fitTargetScale(pad, 0.72)`.

After scoping the existing capacity assertion to `[data-testid="game-feedback"]`, the final pre-implementation baseline ran four tests: three passed and one failed. Only the new 320×480 geometry assertion failed: the pad's left edge was at −34.4px (the accepted minimum is −1px), confirming the clipping. The selector correction restored the existing capacity case and changes test targeting only, not application behavior.

The implementation uses `fitTargetScale(pad, 0.72)` for scratchpad jumps. It preserves the existing destination fit, desktop preferred scale of 0.72, scratchpad geometry, save behavior, capacity, and content. This is a framing change only.

## Verification

- [x] Run the focused scratch-pad-capacity E2E spec and confirm the new compact bounding-box assertion passes: 4/4 passed.
- [x] Confirm the existing capacity assertion targets the game-feedback element unambiguously via `[data-testid="game-feedback"]`; the capacity case passes.
- [x] Run the production build: Vite 8.3.5 build passed (59 modules).
- [x] Perform a scoped review of the jump-scale change and its regression coverage: no actionable findings.
- [x] The full suite was not run; `AGENTS.md` requires user approval before running it.

The independent human playthrough/content-expansion gate remains open; this focused viewport fix does not satisfy or change that gate.

## Acceptance criteria

- [x] At 320×480 in a fresh game, selecting `scratch-a` shows the full pad bounding box inside the world viewport. The baseline left edge was −34.4px; after the fix the focused assertion passes.
- [x] The existing capacity assertion uses a locator scoped to `[data-testid="game-feedback"]` and passes.
- [x] Only scratchpad jump framing changes; destination fit, desktop preferred zoom, pad geometry, saves, capacity, and content remain unchanged.
- [x] The focused E2E spec and production build pass, and scoped review finds no unrelated changes.
- [x] The human-playtest/content-expansion gate remains open; the full suite was not run.
