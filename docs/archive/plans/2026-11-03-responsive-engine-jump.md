# Responsive Palimpsest Engine Jump

**Status:** Completed and reviewed on 2026-11-03. The active browser scaling and human playtest gate remains open.

## Goal and scope

Make the existing **Palimpsest Engine** jump frame the Engine at a readable size across viewport widths. Preserve its current world-space center and navigation target. Use the existing `fitTargetScale` helper with a preferred scale of `1`: the jump should reach 100% when the Engine fits and reduce the scale as needed on narrower viewports.

Do not change Engine content, progression, saved data, other jump destinations, or the active human-playtest/content-expansion gate.

## Implementation

- Replace the fixed `0.62` scale in the Engine jump handler with the fitted scale for the existing Engine target.
- Retain the current focus point at the Engine's world-space center.

## Test plan

- Add focused E2E coverage for the Engine jump at a desktop viewport: the Engine is centered and the zoom readout reaches 100% when the target fits.
- Add focused E2E coverage at a narrow viewport: the Engine remains fully visible, centered, and uses a smaller fitted scale.
- Run the focused E2E file and production build; do not run the full test suite without user approval.

## Acceptance criteria

- [x] The desktop jump uses 100% scale when the complete Engine fits with the existing viewport margin.
- [x] The narrow-viewport jump fits the complete Engine at a lower scale and centers it in the viewport.
- [x] Other navigation, progression, content, saves, and the active browser-scaling/human-playtest gate remain unchanged.

## Baseline and final verification

- Red baseline: before implementation, both new E2E cases failed against the fixed 0.62 scale. The desktop readout stayed at 62% instead of reaching 100%; the narrow-viewport readout also stayed at 62%, below the fitted-scale threshold.
- Final focused command: `npm run test:e2e -- --workers=1 e2e/lab/research-chapter.spec.js` — **7/7 passed**, including both new viewport cases.
- `npm run build` — passed with Vite 8.3.5.
- Code Reviewer found no actionable issues.
- The full test suite and independent human playthrough were not run. The separate human-playtest/content-expansion gate remains active.

## Finalization

After implementation, focused verification, and review, update relevant project documentation and archive this plan in `docs/archive/plans/` with a dated filename. Keep `docs/plans/` empty except for the active browser scaling and human playtest gate.
