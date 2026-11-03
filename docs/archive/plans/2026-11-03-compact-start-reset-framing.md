# Plan: Compact Starting-Camera Reset Framing

**Status:** Completed. The responsive reset fix, focused browser regression, build, and scoped review passed on 2026-11-03. The independent human-playtest/content-expansion gate remains open because the user deferred that playtest for now.

## Goal and boundary

Keep the Starting area’s Folio and first clue visible after returning from the Engine on compact viewports. Fresh saves already derive responsive camera framing through `createStartingCamera()` in `src/game/persistence/gameState.js`, while the start jump, imperative `WorldViewport` ref reset, and toolbar “Reset view” use fixed desktop framing. At 320×480 and 390×480, those reset paths can move the Folio out of view.

Cover both user paths at both viewport sizes:

1. Open a fresh game, jump from Starting area to Engine, then jump back to Starting area.
2. Open a fresh game, jump to Engine, then use the toolbar’s “Reset view” action.

Use the existing `openFreshGame` and `expectFirstClueAndFolioVisible` helpers in `e2e/lab/compact-start-framing.spec.js`. The visibility assertions must verify that the Folio and first clue fit fully inside the world viewport.

Keep this change limited to starting-camera framing and its focused browser regression. Preserve saved-camera restoration, desktop framing, game content, and the save schema. Do not close or change the independent human-playtest/content-expansion gate in `docs/plans/browser-scaling-playtest-gate.md`.

## Test-first implementation plan

The Test Engineer has added the four focused E2E regression cases before implementation. At each target viewport (320×480 and 390×480), cover:

1. `world-jump` from Engine back to Starting area.
2. Toolbar “Reset view” after jumping from Starting area to Engine.

Each case asserts that both the Folio and first clue fit fully inside `world-viewport`, reusing `openFreshGame` and `expectFirstClueAndFolioVisible` from `e2e/lab/compact-start-framing.spec.js`.

**Red baseline:** The focused spec ran with 8 passed and 4 failed. All four new cases reproduce the issue: on each return path at both viewport sizes, the Folio leaves the viewport. The measured Folio left edge is -250px at 320×480 and -215px at 390×480 for both paths; the visibility assertion requires a left edge of at least -1px. Keep the regression assertions intact while implementing the shared responsive framing fix.

The Starting-area jump, imperative `WorldViewport` ref reset, and toolbar reset now share `focusStartingView`, which commits `createStartingCamera()` framing. Keep the saved-camera load path unchanged and do not weaken the visibility assertions to obtain a pass.

## Verification and review

- `npx playwright test e2e/lab/compact-start-framing.spec.js --workers=1` passed 12/12, including all four compact return cases, desktop fresh-start framing, and saved-camera preservation across compact-to-desktop resize. The four new cases changed from the recorded red baseline (8 passed, 4 failed) to passing.
- `npm run build` passed with Vite 8.3.5 (59 modules).
- Scoped review found no actionable findings. The three Starting-area reset paths use the responsive starting camera; saved-camera restoration remains separate, and the desktop framing regression passed. The reset fix did not change game content or the save schema.
- The full test suite was not run; `AGENTS.md` requires user approval before a full suite. The independent human playthrough remains deferred, and content expansion remains gated.

## Acceptance criteria

- [x] At 320×480 and 390×480, returning from Engine to Starting area with the world jump keeps both the Folio and first clue completely inside `world-viewport`.
- [x] At 320×480 and 390×480, the toolbar “Reset view” action after jumping to Engine keeps both items completely inside `world-viewport`.
- [x] The four focused regression cases are in place and fail against the unfixed behavior (focused baseline: 8 passed, 4 failed).
- [x] All three Starting-area camera reset paths use consistent responsive starting framing; saved-camera restoration remains fixed to the saved transform.
- [x] Existing desktop framing and the game content and save schema remain unchanged.
- [x] The focused E2E spec and production build pass, and the review finds no out-of-scope behavior change.
- [x] The independent human playthrough remains open and content expansion remains gated until that separate requirement is completed.

Project documentation is updated. Archive this plan as `docs/archive/plans/2026-11-03-compact-start-reset-framing.md`; keep the deferred browser-scaling/playtest gate as the only active plan in `docs/plans/`.
