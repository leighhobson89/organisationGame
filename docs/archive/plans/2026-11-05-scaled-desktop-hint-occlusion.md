# Plan: Keep Fresh-Start Guidance Clear of Cards at Large Text Sizes

**Status:** Complete. At 1440 x 900, the fresh-start hint now moves into the upper-left lane at 150%, 175%, and 200% text scale, leaving the lower-left loose-card area visible.

## Goal and scope

At wide, tall desktop sizes, reposition the fresh-start `.world-hint` at 150%, 175%, and 200% text scale so it remains fully visible without covering world cards or navigation controls. Keep its copy and effective font size unchanged.

Likely implementation files:

- `src/styles/app.css` for scale-specific desktop positioning.
- `e2e/lab/scaled-desktop-hint-occlusion.spec.js` for focused layout regressions.

Do not change compact/mobile layouts, default text-scale placement, hint copy, camera behavior, game content, save state/schema, or interaction behavior. Preserve the user-deferred independent chapter playtest and content-expansion gate.

## Geometry and implementation direction

- Use the measured upper-left lane below the toolbar and Atlas control and to the left of the Harmonic Calibration Folio.
- At 150% text, a 310px-wide candidate at x=16–326, y=245–449.56 cleared the visible cards; the toolbar ended at y=230.92, Atlas at y=235.61, and the Folio began at x=380.
- At 200% text, the nearest lower-left card begins at x=329, so the hint uses a 300px maximum width to leave a 13px horizontal margin.
- The 300px-wide upper-left lane remains clear at 150%, 175%, and 200%; all three supported large text scales are covered by the regression.
- The override applies at wide/tall desktop viewports (at least 1341px wide and 720px tall), text scales 1.5, 1.75, and 2, and the fresh world with no panel, Atlas, Finder, or Inspector open.
- Scale-specific `top` offsets are 125px, 131px, and 140px, respectively; each puts the hint below the measured toolbar and Atlas control.
- Preserve the original text size and ensure the complete hint stays inside the viewport.

## Acceptance criteria

- At 1440 × 900 and 150%, 175%, and 200% text scale, the whole guidance panel is visible and readable.
- At all three scales, the guidance does not overlap any rendered destination or item card, the toolbar, the Atlas control, or the Harmonic Calibration Folio.
- Existing 100% wide-desktop placement remains unchanged.
- Compact/mobile, short-viewport, and open-panel layouts remain unchanged.
- Hint copy, camera, saves, content, and input behavior remain unchanged.
- The independent human playtest remains deferred and content expansion remains gated.

## Verification plan

- Add a focused regression at a fresh 1440 × 900 for 150%, 175%, and 200% text scale. Assert the complete hint is within the viewport and its rectangle has no positive-area overlap with rendered cards, toolbar, or Atlas control; include the Folio in the destination-card geometry.
- Before implementation, `npx playwright test e2e/lab/scaled-desktop-hint-occlusion.spec.js --reporter=line --workers=1` confirmed the current bottom-left placement failed at all three scales because the hint overlapped rendered cards.
- `npx playwright test e2e/lab/scaled-desktop-hint-occlusion.spec.js e2e/lab/desktop-start-hint-occlusion.spec.js e2e/lab/compact-start-framing.spec.js --reporter=line --workers=1` protects scaled, default, compact, and short-viewport layouts.
- Run `npm run build` and request scoped Code Reviewer review.
- Do not run the full suite without user approval.

## Results

- Architect geometry audit: the existing panel overlaps 8, 9, and 11 cards at 150%, 175%, and 200%. The Folio and first calibration clues remain clear. The 300px upper-left lane clears cards, toolbar, and Atlas control with a 13px margin from the nearest 200% card.
- Test Engineer red baseline: the focused scaled regression failed at all three scales and confirmed 8/9/11 card overlaps, with no toolbar or Atlas overlap. The initial sandbox Playwright worker spawn returned `EPERM`; the process-access retry confirmed the expected overlaps. No app code changed for the baseline.
- Implementation: the scale-specific CSS repositions the hint to left 16px, max-width 300px, and top offsets 125/131/140px for 150/175/200%. The original hint copy and font size are unchanged. Default scale, 125% scale, compact, short-viewport, and panel layouts retain their existing placement.
- Focused verification: `npx playwright test e2e/lab/scaled-desktop-hint-occlusion.spec.js e2e/lab/desktop-start-hint-occlusion.spec.js e2e/lab/compact-start-framing.spec.js --reporter=line --workers=1` passed 26/26.
- `npm run build` passed with Vite 8.3.5 (62 modules). Final scoped Code Reviewer review found no actionable findings. The full suite was not run.
- The independent human playtest remains deferred and content expansion remains gated.
