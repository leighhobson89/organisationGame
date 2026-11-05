# Plan: Short-Height Medium-Desktop Large-Text Layout

**Status:** Complete (2026-11-05). The short-height medium-desktop large-text layout and regression coverage are implemented and verified. The independent human playthrough remains deferred, and the content-expansion gate stays open.

## Goal

Polish the first-action layout for 1051–1340px-wide viewports that are 550–719px tall at stored text scales of 150%, 175%, or 200%. Keep the first-action guidance and essential world controls usable without covering the starting collection or changing saved game state.

## Evidence and boundary

The medium-desktop guidance bay in `src/styles/app.css` applies at 1051–1340px only when the viewport is at least 720px tall. The short-height large-text layout is enabled from `src/app/App.jsx` only at 721–1050px, 550–719px, and scales 150%, 175%, and 200%. The neighboring specs stop at those same boundaries, leaving short-height medium desktop uncovered.

Cover widths 1051, 1280, and 1340px; heights 550, 600, and 719px; and scales 150%, 175%, and 200%. Keep widths up to 1050px, heights of 720px or more, widths from 1341px, other scales, and open panel layouts under their existing rules. Do not change stored text scale, camera, or autosave data to make the layout fit. Keep the independent human playthrough and content-expansion gate open.

## Implementation direction

- Add a clearly scoped short-height medium-desktop large-text layout mode. Do not broaden the existing `isShortTablet` meaning; keep responsive layout selectors bounded to 1051–1340px and 550–719px.
- Adapt the existing native disclosure and keyboard-scroll rail patterns only where measurements show they fit this wider, shorter viewport. Keep the first-action lead visible without interaction; preserve access to secondary progress and controls guidance.
- Reserve distinct space for the header, world toolbar, and first-action guidance. Keep the Atlas control, Harmonic Calibration Folio, and first clue visible and usable.
- Keep toolbar actions on a reachable horizontal rail with touch targets at least 44px high. Keep guidance, transient feedback, visible world cards, and controls clear of one another.
- Preserve current behavior outside the specified width, height, scale, and no-panel conditions.

## Regression handoff

`e2e/lab/medium-short-large-text.spec.js` covers the 3×3×3 viewport and scale matrix; stored and computed text-scale preservation; first-action guidance; visibility, containment, and hit testing of the Atlas, Folio, and first clue; keyboard reachability of header and toolbar controls; overlay clearance; and document overflow. It includes a real selection interaction to cover selection guidance and feedback, a saved-camera and exact-autosave-byte preservation case across a one-pixel resize, and the width, height, and scale boundary guards.

Boundary guards cover 1050×600/200%, 1051×720/200%, 1340×720/200%, 1341×600/200%, and 1280×600/125%. Adjacent layout helpers and assertions are reused where suitable, while the assertions remain specific to this viewport class.

**Red baseline:** The refined `npx playwright test e2e/lab/medium-short-large-text.spec.js --workers=1` run had 32 tests: 28 failed and 4 passed. All 27 matrix cases failed because the first-action hint overlapped visible world cards. In these cases, the hint and controls stayed inside the browser viewport and the hint content did not clip. The selection case found overlaps between the hint, toast, and visible cards. Added Folio/card/Atlas containment and center-hit-test assertions did not add a new failure category. Header and world-toolbar keyboard rails, persistence, and boundary cases passed. These are pre-implementation baseline results; the final section below records the later implementation and verification.

**Review-driven isolation coverage:** The matrix asserts that the medium-mode attribute is present in all 27 supported combinations and absent at all five out-of-scope boundaries. Notebook, Atlas, and Finder open-state tests compare computed styles and element bounds against the same DOM with the medium-mode attribute removed. Before the CSS fix, `npx playwright test e2e/lab/medium-short-large-text.spec.js --grep "layout independent of the short-large-text flow mode" --workers=1 --reporter=dot` ran 3 tests and all 3 failed as expected: flow styling changed positions, dimensions, and other computed layout styles. This verifies that the regression detects style leakage into open-panel layouts. This is a pre-implementation baseline; the final section below records the later implementation and verification.

## Acceptance criteria

- [x] The 27 supported viewport/scale combinations keep the first-action lead visible and keep essential controls reachable; the matrix asserts the medium-mode attribute is present in every supported case.
- [x] Header and toolbar keyboard access remains usable, with focus scrolling contained to their own rails and without browser-page scrolling.
- [x] The Atlas, Folio, and first clue remain visible, hit-testable, and clear of guidance, controls, and feedback; no document overflow occurs.
- [x] Selection guidance and transient feedback remain readable and clear of other overlays and visible world cards; the corrected focused overlay-isolation run passed 3/3.
- [x] Stored preferences, live camera transform, and serialized autosave bytes remain unchanged by layout and viewport resizing.
- [x] Boundary checks show no layout leakage into compact, taller, larger-width, or out-of-scope text-scale layouts; all five boundaries assert the medium-mode attribute is absent, and Notebook/Atlas/Finder style and bounds preservation checks pass. The final combined focused run passed 79/79.
- [x] `npm run build` passed with 62 modules; `node --check` and scoped diff-check were clean; Code Reviewer found no actionable issues. Project documentation is updated, this plan is archived as `docs/archive/plans/2026-11-05-medium-desktop-short-height-large-text.md`, and only the active browser-scaling playtest gate remains in `docs/plans/`.

## Verification

The initial refined red baseline ran 32 tests: 28 failed and 4 passed. All 27 matrix cases exposed first-action hint/card overlap, and the selection case found hint/toast/card overlaps. Added containment and hit-test assertions introduced no new failure category; keyboard rails, persistence, and boundary cases passed. The review-driven pre-fix isolation run passed 0/3 as expected because flow styling changed Notebook/Atlas/Finder layout styles and geometry.

After implementation, the final combined focused responsive run passed 79/79. The focused overlay-isolation correction passed 3/3. `npm run build` passed with 62 modules; `node --check` and scoped diff-check were clean; scoped review found no actionable issues. The full test suite was not run.

## Completion

Implementation, focused verification, review, and project documentation are complete for 1051–1340px × 550–719px at 150%, 175%, and 200% text scale. README, Roadmap, and Testing Guide now document the behavior and evidence. Archived as `docs/archive/plans/2026-11-05-medium-desktop-short-height-large-text.md`; `docs/plans/` retains the active `browser-scaling-playtest-gate.md`. The independent human playthrough remains deferred, and content expansion remains gated.

