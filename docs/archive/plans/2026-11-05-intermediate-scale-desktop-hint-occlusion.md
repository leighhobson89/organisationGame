# Plan: Keep Fresh-Start Guidance Clear at Intermediate Text Scales

**Status:** Complete. The fresh 1440x900 wide desktop hint now uses a clear upper-left lane at 112.5% and 125% text scale.

## Goal and scope

At wide, tall desktop sizes, move the fresh-start `.world-hint` at 112.5% and 125% text scale into a clear upper-left lane. Keep its text, effective font size, and pointer behavior unchanged.

Likely implementation files:

- `src/styles/app.css` for intermediate-scale selectors and placement offsets.
- `e2e/lab/scaled-desktop-hint-occlusion.spec.js` for regressions at the two intermediate scales.

Do not change the default-scale top-right placement, the existing 150%/175%/200% rule, compact or short-viewport layouts, open-panel layouts, camera behavior, content, saves, or gameplay. Preserve the user-deferred independent chapter playtest and content-expansion gate.

## Geometry and implementation direction

- The existing bottom-left hint overlaps six rendered loose cards at 112.5% and six at 125% in an isolated fresh 1440 × 900 context.
- A simulated 300px-wide upper-left hint clears visible cards and controls at both scales. At 112.5%, its bounds are x=16–316 and y=221.19–343.39. At 125%, its bounds are x=16–316 and y=228.11–402.11. The Harmonic Calibration Folio begins at x=380.
- Extend the existing wide/tall desktop rule (at least 1341px wide and 720px tall) to exact text scales 1.125 and 1.25, scoped to the fresh world with no open panel.
- Keep the hint below the toolbar and Atlas control and to the left of the Folio. Choose scale-specific offsets from actual browser geometry.
- Retain the 300px maximum width, original copy, and original text size. Keep default scale and all other responsive states unchanged.

## Acceptance criteria

- At 1440 × 900 and 112.5% and 125% text scale, the complete hint remains inside the viewport.
- At both scales, it does not overlap any rendered destination or item card, the toolbar, or the Atlas control.
- The Folio remains clear, and the hint stays readable at its existing text size.
- Existing default-scale and 150%/175%/200% placements remain unchanged.
- Compact/mobile, short-viewport, and open-panel layouts remain unchanged.
- No game content, camera, save, or interaction behavior changes.
- The independent human playtest remains deferred and content expansion remains gated.

## Verification plan

- Extend `e2e/lab/scaled-desktop-hint-occlusion.spec.js` with fresh 1440 × 900 cases at 112.5% and 125%, checking viewport bounds and zero positive-area overlap with rendered world cards, the toolbar, and Atlas control.
- Red baseline command: `npx playwright test e2e/lab/scaled-desktop-hint-occlusion.spec.js --grep "112.5%|125%" --reporter=line --workers=1`.
- Run the scaled hint regression, default desktop guidance regression, and compact-start framing checks.
- Run `npm run build` and request scoped Code Reviewer review.
- Do not run the full suite without user approval.

## Results

- Architect's read-only geometry audit found six card overlaps at both intermediate scales. A simulated 300px upper-left lane cleared the Folio, cards, and controls at measured bounds x=16–316, y=221.19–343.39 (112.5%) and x=16–316, y=228.11–402.11 (125%).
- Test Engineer's red baseline ran `npx playwright test e2e/lab/scaled-desktop-hint-occlusion.spec.js --grep "112.5%|125%" --reporter=line --workers=1`. Both selected cases stayed within the viewport but failed the zero-overlap assertion with six world cards each; neither overlapped the toolbar or Atlas control. The sandbox worker spawn returned `EPERM`; the focused retry with process access confirmed both failures.
- Implementation extends the existing wide/tall desktop rule (at least 1341px by 720px), scoped to the fresh world with no open panel, to exact root scales 1.125 and 1.25. Both use `top: 122px`, `left: 16px`, and `max-width: 300px`. Measured bounds were x=16-316/y=221.1875-343.3906 at 112.5%, and x=16-316/y=228.1094-402.1094 at 125%; cards, toolbar, Atlas, and Folio are clear. Default/100% remains top-right; compact, short-viewport, panel, and other-scale layouts are unchanged.
- The focused red baseline command failed both selected scale cases with six overlapping cards each: `npx playwright test e2e/lab/scaled-desktop-hint-occlusion.spec.js --grep "112.5%|125%" --reporter=line --workers=1`.
- Final focused verification passed 28/28: `npx playwright test e2e/lab/scaled-desktop-hint-occlusion.spec.js e2e/lab/desktop-start-hint-occlusion.spec.js e2e/lab/compact-start-framing.spec.js --reporter=line --workers=1`. `npm run build` passed with Vite 8.3.5 (62 modules). Scoped Code Reviewer found no actionable issues. Scoped `git diff --check` was clean apart from the expected LF-to-CRLF notice. The full suite was not run.
- The independent human playtest remains deferred and content expansion remains gated.
