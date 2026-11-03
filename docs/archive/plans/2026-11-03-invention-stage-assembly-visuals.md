# Invention Stage Assembly Visuals

**Status:** Completed 2026-11-03. This milestone makes the existing Engine stages visually distinct without adding progression content. The browser-scaling and human-playtest gate remains open.

## Goal

Make the Palimpsest Engine visibly take shape as its current research stages are earned. Preserve the existing Dormant, Memory Crystal, and Chronology Wheel progression and labels.

## Scope and constraints

- **Dormant:** show the brass frame with a dim, empty lens.
- **Memory Crystal:** add a faceted, illuminated crystal to the existing lens assembly.
- **Chronology Wheel:** retain the crystal and add a visible toothed, spoked wheel.
- Build the stage details with the existing React component and CSS; add no image assets or dependencies.
- Keep decorative markup hidden from assistive technology while retaining the stage name and description as readable text.
- Respect operating-system and saved reduced-motion preferences.
- Keep the Engine mounted when it intersects the viewport, including when only a clipped edge is visible. `isNearViewport()` expects `position` to be the object's top-left corner, so calculate it as the Engine center minus half its width and height. Retain the Engine center separately for `.invention-anchor` placement; do not reuse the top-left culling position as the visual anchor.
- Do not change progression rules, item count, save data, stage IDs, world dimensions, or the active human-playtest/content-expansion gate.

## Implementation touchpoints

- `src/ui/InventionCore.jsx`: render stage-specific decorative parts from the existing stage value.
- `src/styles/app.css`: style the crystal and wheel with clear Dormant/Memory Crystal/Chronology Wheel states and restrained motion.
- `src/ui/WorldViewport.jsx`: pass the Engine culling descriptor to `isNearViewport()` with top-left `position.x/y` (center minus half the Engine dimensions), `width`, and `height`; retain the center coordinates for `.invention-anchor` placement.
- `e2e/lab/research-chapter.spec.js`: the fresh game uses a camera centered on the Engine and verifies the accessible Dormant label without crystal/wheel parts. The chapter journey verifies the Memory Crystal while centered, then continues to verify Chronology Wheel progression and persisted puzzle state after the camera focuses the final case.
- Add a partial-overlap regression case: position the camera so a clipped edge of the Engine is still inside the viewport and assert the Engine remains mounted. This checks that culling uses the top-left position and full dimensions rather than treating the center as the object's top-left.
- A separate centered v3 save fixture at the Chronology Wheel stage verifies the crystal remains visible, the decorative wheel is visible and `aria-hidden`, and the OS reduced-motion preference shortens wheel animation to the project's 0.01 ms duration. The saved user reduced-motion preference disables animation. Keep visual assertions on the invention while it is actually in the viewport.

## Test plan

- Run `npm run test:e2e -- --workers=1 e2e/lab/research-chapter.spec.js e2e/lab/organising-loop.spec.js` for fresh-game, culling, stage, migration, puzzle, and persistence coverage.
- Verify a fresh game renders the Dormant state with no crystal or wheel, and the migration journey shows the Memory Crystal while the Engine is centered.
- Verify a centered Chronology Wheel save retains the crystal and exposes a decorative `aria-hidden` wheel; when the E2E emulates the OS reduced-motion preference, assert computed wheel animation duration is at most 0.01 ms. The saved user reduced-motion preference disables animations separately.
- Verify the Engine stays mounted with a clipped edge intersecting the viewport even when its center is outside the viewport.
- Verify the chapter journey still advances chronology and preserves puzzle progress after the camera focuses the final case.
- Red baseline (2026-11-03): both centered-camera cases failed because `.invention-core` was not mounted; the Engine culling descriptor passed top-level `x/y` to a helper that reads `position.x/y`.
- Red baseline (2026-11-03): `the Palimpsest Engine remains mounted when only its left side overlaps the viewport` also failed because `.invention-core` was absent. This confirms culling must use the Engine's top-left position plus full dimensions so a visible clipped edge counts as an intersection.
- After the culling fix, the fresh Dormant case passed and the migration journey showed Memory Crystal while centered. Its later Chronology Wheel assertion ran after the journey focused the final case, so the Engine was offscreen and correctly culled. Move the wheel visibility and reduced-motion checks to the separate centered Chronology Wheel save fixture.

## Verification

- `npm run test:e2e -- --workers=1 e2e/lab/research-chapter.spec.js e2e/lab/organising-loop.spec.js`: passed 8/8, including Dormant, partial-overlap culling with the Engine center outside the viewport, centered Chronology Wheel crystal/wheel/reduced-motion checks, and migration/puzzle progression.
- `npm run build`: passed with Vite 8.3.5.
- Code Reviewer re-review found no actionable issues.
- The full test suite and human playthrough were not run; the independent human-playtest/content-expansion gate remains open.

## Acceptance checklist

- [x] Render distinct Dormant, Memory Crystal, and Chronology Wheel states using existing React/CSS with no assets or dependencies.
- [x] Preserve readable stage labels/descriptions, hide decorative details from assistive technology, and respect saved/OS reduced-motion preferences; the OS E2E assertion verifies computed wheel animation duration at most 0.01 ms, while saved user reduced motion disables animations.
- [x] Preserve progression, item count, stage IDs, save data, and world dimensions.
- [x] Pass a top-left Engine AABB plus dimensions to viewport culling while keeping `.invention-anchor` at the Engine center; retain mounting for partial viewport overlap.
- [x] Pass focused E2E, production build, and Code Reviewer re-review.
- [x] Keep the separate human-playtest/content-expansion gate active.

## Completion

Relevant design, architecture, roadmap, vertical-slice, and testing documentation is updated. This finalized plan is archived at `docs/archive/plans/2026-11-03-invention-stage-assembly-visuals.md`; `docs/plans/browser-scaling-playtest-gate.md` remains active and unchanged until the human playthrough and independent feedback are complete.
