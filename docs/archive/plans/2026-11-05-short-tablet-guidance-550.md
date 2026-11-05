# Plan: Extend Short-Tablet Guidance to 550px

## Goal

Extend the verified default-scale short-tablet fresh-start layout to 550px viewport height while keeping the first calibration clue, Atlas control, guidance, and toolbar usable.

## Architect direction

For 721–1050px widths at 550px viewport height:

- Reserve a 120px bottom guidance bay, ending around y=430; the first calibration clue ends around y=426 and must remain inside the world viewport.
- Keep the first-action and selection guidance hint at `bottom: 16px` in the reserved bay.
- Place the Atlas toggle at `top: 240px` within `.game-main` (approximately y=385–421 on the measured viewport), below the Folio ending around y=315 and left of the first-row world cards.
- Keep the toolbar on one row and horizontally scrollable/focusable. Reduce its vertical padding to 2px so its minimum-height controls produce an approximately 42px rail ending near y=175, above the first world item around y=180.

These positions are starting measurements from the Architect, not substitutes for the focused regression's geometry assertions. Adjust them only as needed to meet the acceptance criteria below.

## Scope and constraints

- Extend the existing default-100% layout across widths 721, 768, and 1050px and heights 550, 600, and 719px (nine layout cases). Preserve the six already-verified 600px and 719px cases.
- Cover real selection-toast interactions at both 768×550 and the existing 768×600 preservation viewport by activating **Select multiple items** through the UI.
- Preserve the existing treatment at widths up to 720px and the 720px-and-taller tablet bridge, including the 721×720/200% coverage.
- Do not change camera transforms or autosave bytes, story, progression, panel behavior, or layout behavior outside this scope.
- Keep the toolbar as a one-row, keyboard-focusable horizontal rail; preserve visible focus and control hit testing when it scrolls. At 768×550, Tab from Zoom out to an initially offscreen toolbar action must scroll the rail without changing page scroll, and leave the focused action fully visible, outlined, and center-hit-testable.
- Keep the 550px treatment at 100% text scale. The 200%-at-short-height layout remains a broader responsive redesign limitation.
- Keep the human-playtest, audio-listening, and content-expansion gates open.

## Regression scope and red baseline

`e2e/lab/short-tablet-guidance.spec.js` covers 12 cases: the 3×3 viewport matrix at 100% scale, real selection-toast cases at 768×550 and 768×600, and keyboard traversal at 768×550. It verifies hint, toolbar, Atlas, Folio, first-clue, and visible-card geometry; Atlas containment and center hit testing; the toast bay and no-overlap state; horizontal toolbar scrolling with visible keyboard focus and no page scrolling; no horizontal document overflow; and unchanged camera state with no side panel after selecting **Select multiple items**.

The red baseline command `npx playwright test e2e/lab/short-tablet-guidance.spec.js --workers=1` ran 11 pre-keyboard cases: 7 passed and 4 failed. The existing 600px/719px layout cases and 768×600 toast case remained green. The three 550px layout cases failed: at every width, the hint at y=379.3–474 overlaps the toolbar at y=460.7–536 by 13.3px. At 721px and 768px the Atlas toggle at y=223.3–259.3 intersects the Folio at y=165.3–315.3; the hint covers calibration cards 01–08. At 1050px the hint covers calibration cards 01 and 05. At all widths the toolbar covers Brass Cog 004, Escapement Wheel 014, and Copper Ratchet 032/034. The real 768×550 toast case also failed: the toast at y=383.9–424 is outside the reserved bay while the world viewport ends at y=550, overlaps the still-visible hint at y=421.6–474, and covers multiple cards. These failures defined the implementation baseline.

## Acceptance criteria

- At 550px, the first clue remains within the world viewport and the Folio/clue remain center-hit-testable.
- The 120px guidance bay contains the hint and any real selection toast without hint/toast overlap or collision with visible world cards.
- The Atlas toggle remains fully inside `.game-main`, below the Folio and clear of first-row cards; it is center-hit-testable.
- The one-row toolbar stays above the first world item, has no collision with cards, and remains scrollable and keyboard-focusable without changing camera or autosave state.
- At 768×550, keyboard traversal from Zoom out scrolls the toolbar rail to an initially offscreen action without scrolling the page; the action remains fully visible, focused with a visible outline, and center-hit-testable.
- Existing 600px and 719px behavior and the 721×720/200% tablet bridge remain green.
- No horizontal document overflow is introduced.

## Final results

- `npx playwright test e2e/lab/short-tablet-guidance.spec.js --workers=1` passed 12/12. Nine layout cases cover all combinations of 721/768/1050px widths and 550/600/719px heights at 100%; two cases verify the real selection toast at 768×550/600, and one verifies keyboard traversal through the overflowed toolbar at 768×550.
- `npx playwright test e2e/lab/short-tablet-guidance.spec.js e2e/lab/tablet-bridge-guidance.spec.js e2e/lab/compact-start-framing.spec.js --workers=1 --reporter=dot` passed 48/48, including the 721×720/200% tablet guard.
- `npm run build` passed with 62 modules after the CSS change; no further build was needed after the final test-only assertion.
- A 768×550 screenshot was checked. Scoped review found no actionable issues. Scoped `git diff --check` was clean apart from expected LF-to-CRLF notices. The full suite was not run.

## Verification

Fresh-start guidance and controls are verified at default 100% text for widths 721–1050px and viewport heights 550, 600, and 719px. The 200%-at-short-height layout remains a broader responsive redesign limitation. The existing 720px-and-taller tablet bridge (including 721×720/200%), compact widths through 720px, camera, and autosave behavior remain covered. The independent human-playtest, audio-listening, and content-expansion gates remain open.

## Completion

Complete. The focused and combined regressions, build, screenshot inspection, and scoped review passed. The Testing Guide, Roadmap, and README record the verified range and remaining limitation. This plan is archived; only the separate browser-scaling playtest gate remains active in `docs/plans/`.
