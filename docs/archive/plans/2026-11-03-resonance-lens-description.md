# Plan: Resonance Lens Description

**Status:** Complete. The Lens description matches the existing highlight behavior, the focused E2E and production build passed, and review found no actionable issues.

## Goal and boundary

The Resonance Lens currently says it highlights items that “share a clue,” while `WorldViewport` highlights other items from the selected item's collection, or items of the same family when the selected item has no collection. Make the description accurate and clear to players.

Limit the change to the skill's user-facing description and focused E2E coverage. Preserve highlight logic, skill duration and cost, progression, saved state, and the active human-playtest/content-expansion gate.

## Implementation

- Update the Resonance Lens description in `src/game/content/catalog.js` to explain that it briefly highlights other members of the selected item's collection, or items of the same family when it has no collection.
- Preserve the existing statement that the Lens does not move or file items.
- Add an assertion to the existing Lens activation journey in `e2e/lab/organising-loop.spec.js` for the updated description; keep the existing `.is-related` and unchanged-position/save assertions.

## Regression and verification

The Test Engineer added a copy assertion to the existing Lens activation journey in `e2e/lab/organising-loop.spec.js`. The red baseline was recorded with `npm run test:e2e -- --workers=1 e2e/lab/organising-loop.spec.js --grep "recover a misfiled card"`: it failed 1/1 because the description still said “share a clue” instead of describing collection/family highlighting. After implementation, the same focused command passed 1/1. `npm run build` passed with Vite 8.3.5. Code Reviewer confirmed no remaining actionable issues. The full test suite was not run.

## Documentation and handoff

`docs/ARCHITECTURE.md` now describes the collection/family behavior, and `docs/TESTING_GUIDE.md` records the focused result. The separate active browser-scaling and human-playtest gate remains unchanged; this copy correction does not complete independent human playtesting or authorize content expansion. This finalized plan is archived at `docs/archive/plans/2026-11-03-resonance-lens-description.md`.

## Acceptance criteria

- [x] Resonance Lens copy accurately describes collection/family highlighting and states it never moves or files items.
- [x] Focused E2E verifies the description and retains coverage that the Lens actually highlights related items without moving them or changing saves.
- [x] Focused E2E and production build pass; review finds no actionable issue.
- [x] Relevant docs are aligned and this plan is archived after completion.
