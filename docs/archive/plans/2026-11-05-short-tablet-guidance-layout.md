# Plan: Short-Height Tablet Guidance Layout

## Goal

Keep first-start guidance, world controls, and the first calibration objects readable and usable at tablet-bridge widths for a fresh game at the default 100% text scale.

## Confirmed issue

A fresh game captured at 768×600 shows `.world-hint` overlapping the bottom-anchored `.game-toolbar`. The Atlas toggle also overlaps the Harmonic Calibration Folio. The current 721–1050px rules anchor the toolbar 14px from the bottom and the hint 76px from the bottom; the tablet-bridge guidance rules only apply from 720px viewport height.

At 721×600 and 200% text scale, measurements show a 291px header, a 266px full hint, and a 119px toolbar, in addition to the Atlas/Folio clearance problem. Correcting that state requires a broader responsive redesign, so it is a documented limitation outside this focused slice.

At 550px viewport height, the top-row toolbar still overlaps visible world cards (for example, Workshop Reminder 034), so that tighter short-height layout is excluded from this slice and remains a separate limitation.

## Scope and constraints

- Address only fresh-start layout at the default 100% text scale for widths 721, 768, and 1050px and heights 600 and 719px (six cases).
- Keep the guidance and controls clear of each other, the Atlas toggle, and visible world cards.
- Keep the Atlas toggle fully inside `.game-main` and center-hit-testable; staying within the browser viewport alone is insufficient.
- Keep the Harmonic Calibration Folio and first calibration clue inside the world viewport and center-hit-testable. Prevent horizontal document overflow.
- Preserve the compact layout at widths up to 720px and the existing tablet-bridge layout at heights of 720px and above, including the 721×720/200% coverage.
- Leave panel layouts, story, progression, and valid saved/imported camera transforms and autosave data unchanged. Do not introduce a camera offset to force the fresh-start objects into view; solve any fit issue through layout.
- Leave the independent human-playtest, audio-listening, and content-expansion gates open.

## Regression scope and baseline

`e2e/lab/short-tablet-guidance.spec.js` covers six fresh-start combinations of widths 721, 768, and 1050px and heights 600 and 719px at 100% text scale. It checks that the hint, toolbar, and Atlas toggle stay in the browser and clear of one another and visible world cards; checks the Atlas/Folio and toolbar/Folio pairs; verifies the Atlas toggle stays inside `.game-main` and is center-hit-testable; verifies Folio and first-clue containment and center hit testing; and checks horizontal document overflow.

Add one real-interaction feedback case at 768×600/100%: activate **Select multiple items** through the normal UI. This produces the application's selection feedback toast without changing the camera or opening a panel, and replaces `.world-hint__lead` with the mouse/touch selection guidance spans. Ensure the short-tablet selectors still match that selection state, reserve the guidance bay, and hide `.world-hint` while the toast is visible. Verify the toast is inside the reserved bottom guidance bay and clear of the hint, toolbar, Atlas toggle, Folio, first clue, and visible world cards. Do not set toast text directly in the DOM; exercise the real UI action.

The real selection-toggle interaction is the seventh focused case. The initial 7-test red-baseline run, `npx playwright test e2e/lab/short-tablet-guidance.spec.js --workers=1`, failed all six fresh-start layouts on Atlas containment: at 721×600 the toggle spans y=129.3–165.3 while `.game-main` begins at y=145.3, although its center remains hit-testable. The selection-toast case failed as expected: the toast spans y=433.9–474 with the world viewport ending at y=600, overlaps the still-visible hint at y=471.6–524, and covers three visible cards.

The original nine-case red baseline also showed hint/toolbar, Atlas/Folio, and visible-card collisions at 721×550. Later CSS iterations cleared the six scoped 600px/719px layouts, but 550px still has a toolbar/card collision and remains excluded. The 200% text-scale case at 721×600 remains a separate broader-redesign limitation.

## Implementation direction

Use a short-tablet responsive treatment that gives the guidance a clear region and moves world controls out of that region while retaining the existing first-action copy. Keep styling isolated from the compact layout, the existing 720px-and-taller tablet bridge, panels, and saved-camera behavior. Treat the 550px toolbar/card overlap and measured 721×600/200% layout as separate limitations for broader responsive redesigns, not as targets for this slice.

## Acceptance criteria

- The Atlas toggle is fully inside `.game-main`, remains clear of the Folio and other controls, and is center-hit-testable in all six fresh-start layouts.
- The short-tablet selectors apply to both first-action and mouse/touch selection guidance states.
- Activating **Select multiple items** produces a real feedback toast without opening a panel or moving the camera; while it is visible, the hint is hidden and the toast stays in the reserved bay, clear of controls and visible world cards.
- The 550px and 200%-at-600px limitations remain explicitly out of scope.

## Final results

- `npx playwright test e2e/lab/short-tablet-guidance.spec.js --workers=1` passed 7/7 after adding Atlas containment, real selection-toast, no-panel, and unchanged-camera assertions.
- `npx playwright test e2e/lab/short-tablet-guidance.spec.js e2e/lab/tablet-bridge-guidance.spec.js e2e/lab/compact-start-framing.spec.js --workers=1 --reporter=dot` passed 43/43, including the existing 721×720/200% guard.
- `npm run build` passed with 62 modules after the initial sandbox `spawn EPERM` retry with process access.
- A 768×600 screenshot was visually checked. Scoped review first identified Atlas clipping and toast overlap; both were fixed, and final review found no remaining findings.
- Scoped `git diff --check` was clean. The full test suite was not run.

## Verification

The short-tablet fix applies at the default 100% scale for 721–1050px widths and 600px and 719px heights, and handles the selection feedback toast in the reserved bay. The 550px toolbar/card collision and the 200%-at-600px layout remain documented responsive limitations requiring broader work. The compact layout through 720px, existing tablet bridge at heights of 720px and above, panels, saved/imported camera transforms, and camera autosave remain unchanged. The independent human-playtest, subjective audio-listening, and content-expansion gates remain open. No full suite was run.

## Completion

Complete. The focused regressions, build, screenshot inspection, and scoped review passed. The Testing Guide, Roadmap, and README record the verified range and remaining limitations. This plan is archived; the separate browser-scaling playtest gate remains active in `docs/plans/`.
