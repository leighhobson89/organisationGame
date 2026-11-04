# Fresh-Start 400px Responsive Polish

## Goal

Verify that the fresh-start world view remains readable and usable at the game's 400px minimum supported height, at the largest built-in text scale.

## Scope

- Preserve all existing 480px viewport coverage.
- Add 150% text-scale checks for fresh-start viewports at 320 × 400 and 390 × 400.
- In `compact-start-framing.spec.js`, verify the calibration Folio and first clue remain inside the world viewport, both remain more than half exposed, and both are center-hit-testable.
- In `mobile-toolbar.spec.js`, verify first-action guidance is visible and unclipped, the hint clears the toolbar, and toolbar controls stay inside viewport bounds and remain accessible and hit-testable.
- At 400–439px on mobile, keep the first-action hint at the stack top and toolbar at the bottom. Hide only `.world-hint__controls`, reduce hint typography and padding while retaining the lead, and compact the toolbar into two 38px rows with 4px column gaps, zero row gap and padding, short Reset/Find/Select labels, and 4px stack bottom padding.
- At mobile widths up to 720px and heights 400–439px, subtract 20px from the fresh-start camera's `panY` so the world objects move up. Do not change saved-camera behavior, 480px CSS, or 480px camera framing.

## Implementation and Verification

The first-action hint/toolbar layout and 400–439px fresh-start camera adjustment were applied as scoped above. The new media and camera conditions do not affect 480px behavior. The full suite was not run.

## Test Plan

At fresh start, both specs set the saved text scale to 150% and cover 320 × 400 and 390 × 400:

- `compact-start-framing.spec.js` checks the active CSS text scale, calibration Folio and first clue within the world viewport, more than 50% exposure of both the Folio and clue above the hint and toolbar, and center-point hit tests for both items.
- `mobile-toolbar.spec.js` checks world item count and first-action guidance copy; toolbar viewport bounds and text clipping; hint visibility, viewport/clipping bounds, and no overlap with the toolbar; and that all six role/name-addressable toolbar controls are enabled and center-hit-testable.
- Preserve the existing 480px cases.

Run the focused checks with:

```sh
npm run test:e2e -- --workers=1 e2e/lab/compact-start-framing.spec.js e2e/lab/mobile-toolbar.spec.js --grep "400"
```

Baseline result: `mobile-toolbar.spec.js` passed both 400px cases (2/2). `compact-start-framing.spec.js` failed both 400px cases with a first-clue exposed ratio of 0. The measured baseline rectangles were:

| Viewport | First clue | Folio | World viewport | Hint | Toolbar |
| --- | --- | --- | --- | --- | --- |
| 320 × 400 | y=314.44, h=39 | y=139.44, h=150 | y=119.44 | y=129.44, h=90.63 | y=300, h=90 |
| 390 × 400 | y=297.66, h=39 | y=122.66, h=150 | y=102.66 | y=112.66, h=139.56 | y=260.22, h=136 |

The implemented 400–439px first-action hint/toolbar compaction and fresh-start camera shift keep the 320px clue more than 50% exposed while the Folio stays at the viewport top; at 390px, the clue clears the toolbar and the Folio stays at the viewport top. Bounds and center hit tests pass for both objects at both widths. The focused `--grep "400"` run passed 4/4, and `--grep "480"` passed 19/19. The Vite 8.3.5 production build passed with 59 modules; Code Reviewer found no actionable findings; scoped `git diff --check` reported only expected LF-to-CRLF notices. The full suite was not run. The independent human-playtest/content-expansion gate remains open.
