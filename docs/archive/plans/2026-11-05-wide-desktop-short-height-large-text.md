# Plan: Short-Height Wide-Desktop Large-Text Layout

**Status:** Complete (2026-11-05). The short-height wide-desktop large-text layout and regression coverage are implemented and verified. The independent human playthrough remains deferred, and content expansion stays gated.

## Goal

Add focused support for fresh-start guidance on wide-desktop viewports at least 1341px wide, 550–719px tall, and stored text scales of 150%, 175%, or 200%. Keep the first-action guidance, world controls, and starting collection usable without changing saved game state.

## Evidence and boundaries

The wide-desktop guidance rule in `src/styles/app.css` starts at 1341px wide and 720px tall. The short-height large-text mode in `src/app/App.jsx` ends at 1340px wide. Existing wide-desktop hint-occlusion specs cover 1440×900, so the short-height wide-desktop range is not covered. The architecture review identified a responsive coverage gap; the red baseline below confirms visible overlap failures within this range.

Cover widths 1341px and 1440px; heights 550px, 600px, and 719px; and stored text scales 150%, 175%, and 200%. Preserve medium-desktop behavior at widths up to 1340px, tall layouts at heights of 720px or more, low-height layouts below 550px, other text scales, and open panel layouts. Do not change stored text scale, camera, or autosave data to make the layout fit.

## Implementation direction

- Add a clearly scoped short-height wide-desktop large-text mode for widths of at least 1341px, heights 550–719px, and scales 150%, 175%, or 200%.
- Keep this mode separate from the existing medium-desktop and short-height medium-desktop mode conditions. Ensure the medium range through 1340px, tall wide-desktop range, low heights, and other scales keep their current behavior.
- Keep the first-action lead visible without interaction and preserve access to secondary progress and controls guidance. Use native disclosures and keyboard-scroll rails only where the measured layout requires them.
- Keep the Atlas control, Harmonic Calibration Folio, and first clue visible, clear of guidance and controls, and usable.
- Preserve the existing Notebook, Atlas, Finder, and Inspector layouts whenever one of those panels is open.
- Keep selection guidance and transient toast feedback readable and clear of visible cards and controls. Avoid browser document overflow.
- Preserve camera transforms, stored preferences, and exact autosave data during responsive reflow.

## Regression handoff

`e2e/lab/wide-short-large-text.spec.js` covers an 18-case matrix at widths 1341/1440px × heights 550/600/719px × scales 150%/175%/200%. It checks the future wide-mode attribute; first-action hint clearance from cards, controls, and Atlas; viewport and hint-content bounds; Atlas/Folio/first-clue containment and center hit testing; both header and toolbar keyboard rails; selection and toast behavior; horizontal/vertical document overflow; and exact text-scale, camera-transform, and autosave-byte preservation.

Boundary checks cover widths 1340/1341px, heights 549/550/719/720px, and the out-of-scope 125% scale. Persistence and boundary cases also check the mode attribute. Open Notebook, Atlas, Finder, and Inspector tests compare computed styles and geometry against the same DOM with the new mode removed, to prevent responsive flow styling from leaking into panels. The spec reuses assertions from adjacent wide- and medium-desktop specs where appropriate.

**Initial red run (inconclusive):** The first test attempt used a hard assertion for the future mode attribute. That assertion failed before the geometry assertions could run, so this attempt did not establish whether the layout itself overlapped.

**Refined red baseline:** `npx playwright test e2e/lab/wide-short-large-text.spec.js --workers=1 --reporter=dot` ran 27 tests: 25 failed and 2 passed. All 18 matrix cases reported the mode attribute absent and actual first-action hint/card overlaps. At 1341×600/200%, the hint also overlapped the toolbar and Atlas, and the toolbar covered the Folio center, making it not hit-testable. The 1440×600/200% selection case found hint/toast/card overlap. Both keyboard-rail cases passed, and exact camera/autosave preservation held. Attribute-only checks in persistence, boundary, and panel cases failed because the mode does not exist before implementation.

## Acceptance criteria

- [x] The supported viewport/scale matrix keeps the first-action guidance visible and essential controls usable; the initial isolated spec passed 27/27.
- [x] The Atlas, Folio, and first clue remain visible, hit-testable, and clear of guidance, cards, and controls; the document does not overflow.
- [x] Header and world-toolbar controls remain reachable by keyboard without browser-page scrolling.
- [x] Selection guidance and transient feedback remain readable and clear of other overlays and visible world cards.
- [x] Stored text scale, camera transform, and exact autosave data remain unchanged by layout and resizing.
- [x] Boundary checks preserve the medium, tall, low-height, out-of-scope-scale, and open-panel layouts; flow styling is restricted to fresh starts with no panel open.
- [x] The final combined responsive run passed 112/112; `npm run build` passed with 62 modules; `node --check` and scoped diff-check were clean apart from LF-to-CRLF notices; Code Reviewer found no actionable findings. Project documentation is updated and this plan is archived as `docs/archive/plans/2026-11-05-wide-desktop-short-height-large-text.md`.

## Verification

The initial isolated wide-desktop spec passed 27/27. The final combined responsive run passed 112/112. `npm run build` passed with 62 modules, `node --check` and scoped diff-check were clean apart from LF-to-CRLF notices, and scoped review found no actionable issues. The full test suite was not run.

## Completion

Implementation, focused verification, review, and project documentation are complete for fresh-start layouts at widths of at least 1341px, heights of 550–719px, and stored text scales of 150%, 175%, and 200%. The flow styling applies only when no panel is open; medium, tall, low-height, other-scale, and open-panel layouts are preserved. README, Roadmap, and Testing Guide document the behavior and evidence. Archive this plan as `docs/archive/plans/2026-11-05-wide-desktop-short-height-large-text.md`; `docs/plans/` retains the active `browser-scaling-playtest-gate.md`. The independent human playthrough remains deferred, and content expansion remains gated.

