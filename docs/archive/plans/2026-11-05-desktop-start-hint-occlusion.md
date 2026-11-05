# Plan: Reduce Desktop Fresh-Start Guidance Occlusion

**Status:** Complete. On wide, tall desktop at the default text scale, the fresh-start guidance panel now sits below the toolbar and above the first right-side card row. Compact, short-viewport, scaled-text, and panel layouts retain their existing placement.

## Goal and scope

Reduce the area where the fresh-start `.world-hint` visually overlaps rendered destination and item cards at desktop size. Keep the hint's content and interaction behavior unchanged. Preserve the user-deferred independent chapter playtest and content-expansion gate.

## Implementation

- Added a CSS override for viewports at least 1341px wide and 720px tall, only at the default `--text-scale: 1` and when no panel is open.
- The rule sets the hint to `top: 88px; right: 16px; bottom: auto; left: auto` within `.world-bottom-stack`.
- Compact widths, short viewports, scaled text, open panels, camera defaults, game content, save state, hint copy, and pointer behavior are unchanged.
- Added `e2e/lab/desktop-start-hint-occlusion.spec.js`, which checks the full hint stays within the 1440x900 viewport and does not overlap visible destination/item cards, the toolbar, or Atlas control.

## Geometry review

In an isolated fresh 1440x900 browser context, `.world-bottom-stack` begins at y=92.3125. The hint measures x=984–1424 and y=180.3125–275.0469. The toolbar ends at y=167.1875; the Atlas control occupies x=16–68.64 and y=170.31–206.31; the Harmonic Calibration Folio occupies x=380–590 and y=268.31–418.31. The nearest right-side card begins at y=305.79. The measured hint rectangle overlaps none of those controls or any rendered destination/item card.

The updated fresh screenshot confirms that the guidance remains readable and the previously obscured lower-left cards are visible.

## Verification

- Red baseline: the new regression failed as intended, reporting five card overlaps at 1440x900, including Letter Fragment 001 and Idler Gear 023. The initial sandbox Playwright worker spawn returned `EPERM`; the focused retry with process access confirmed the expected failure.
- `npx playwright test e2e/lab/desktop-start-hint-occlusion.spec.js e2e/lab/compact-start-framing.spec.js --reporter=line --workers=1` passed 23/23.
- `npm run build` passed with Vite 8.3.5 (62 modules).
- Scoped Code Reviewer found no actionable findings. `git diff --check` passed for the slice; only expected LF-to-CRLF notices were reported by Git.
- The full test suite was not run.

The independent human chapter playtest remains deferred, and content expansion remains gated.
