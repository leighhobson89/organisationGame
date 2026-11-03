# Compact fresh-start camera framing

**Status:** Complete. The focused regression, production build, and code review passed; the separate independent human-playtest/content-expansion gate remains open per the user's deferral.

## Purpose

On a fresh phone-sized viewport, the first calibration card is visible but its Harmonic Calibration Folio destination is mostly off-screen. Frame the initial view so the first action and its destination are visible together on compact screens.

## Scope

- Adjust only the camera created for a new game in `createStartingCamera`.
- At viewport widths up to 480px, use horizontal focus x=944 so the Folio and first calibration card fit together.
- At widths 481–720px, use horizontal focus x=1106 so the Folio and all eight starting calibration cards fit.
- Above 720px, preserve the existing horizontal focus x=1360 and desktop framing.
- Use vertical focus `Math.min(650, viewportHeight + 130)`, with the existing viewport height calculation, to keep the Folio visible on short screens and settle at the current y focus on taller screens.
- Do not modify saved-camera restoration, save data, world contents, or interaction behavior.

## Acceptance criteria

- At 320×480 and 375×667, a fresh save shows the complete Folio and first calibration card inside the world viewport.
- Width breakpoints at 480/481px and 720/721px retain their intended framing; the full starting calibration group and Folio fit at widths from 481px through 720px.
- Desktop framing above 720px remains unchanged.
- Existing saved camera transforms remain in use after load and viewport resizing.

## Verification scope

- A Test Engineer added `e2e/lab/compact-start-framing.spec.js` before implementation. It checks fresh starts at 320×480 and 375×667, horizontal breakpoint edges at 480/481px and 720/721px, the complete Folio-and-card group from 481px through 720px, desktop framing, and preservation of an existing saved camera.
- The red baseline ran with `npx playwright test e2e/lab/compact-start-framing.spec.js --workers=1`: 4 failures at 320×480, 375×667, 480px, and 481px because the Folio is clipped; the desktop and saved-camera checks passed.
- The initial-camera implementation ran in parallel with this plan update, as required by the project handoff. The saved-camera case includes compact-to-desktop viewport resize.
- `npx playwright test e2e/lab/compact-start-framing.spec.js --workers=1` passed 8/8.
- `npm run build` passed with Vite 8.3.5 (59 modules).
- Code Reviewer found no actionable issues. `git diff --check -- src/game/persistence/gameState.js` reported no whitespace errors, with only the expected LF-to-CRLF conversion notice; the new test and plan whitespace check was clean.
- The full test suite was not run. Relevant testing, vertical-slice, and roadmap documentation has been updated; this finalized plan is archived, leaving the deferred browser-scaling/playtest gate as the only active plan.

## Risks

- The explicit horizontal framing bands produce visible camera shifts across the 480/481px and 720/721px boundaries. These are intentional and should remain covered by boundary assertions.
- Very short viewports leave less vertical clearance around the Folio; the vertical focus formula keeps its top edge inside the view while preserving the existing framing when the viewport is tall enough.
