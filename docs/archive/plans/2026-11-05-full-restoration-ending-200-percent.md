# Plan: Full-Restoration Ending at 200% Text Scale

**Status:** Complete. The refined 200% reachability regression passes; no production CSS or source change was needed.

## Goal and rationale

Verify the full-restoration ending remains readable and keyboard-operable at 200% text scale on a compact 320 by 360 viewport. Reuse the existing almost-complete fixture and compact ending assertions so the new scale case exercises the same real completion path and visible content as existing checks.

## Scope and constraints

- Use `openEndingFromAlmostCompleteFixture(page, { textScale: 2 })` to open the ending from the existing almost-complete save fixture.
- At 320 by 360, verify the 200% text scale is applied, the ending dialog stays inside the viewport, and neither the page nor ending has horizontal overflow.
- Verify internal dialog scrolling can reach the narrative's start and end separately, and can fully reveal the live completion status and each of the six statistics. At 200%, the 685px narrative paragraph is taller than the 324px dialog scrollport, so the paragraph cannot fit in view all at once.
- Tab to **Continue exploring** and verify focus remains inside the dialog and viewport. Press Enter and verify the action closes the ending.
- Preserve ending story copy and evidence, completion behavior, and save/progression semantics. Make ending CSS changes only if the focused regression demonstrates a layout defect; scope any correction to the ending dialog.
- Keep the independent human playtest and content-expansion gate unchanged. This polish slice does not close or replace that gate.

## Implementation approach

1. Add a focused 200%-text, 320 by 360 case to `e2e/lab/full-restoration-ending.spec.js` using the existing fixture helper and reachability assertions.
2. Run only the focused ending spec and record the baseline. Do not run the full test suite.
3. Refine the narrative assertion to check that its start and end are separately reachable; keep full-rectangle visibility for the shorter status and statistic cards. The initial failure was an overstrict whole-paragraph containment assertion. The existing dialog already scrolls correctly, so no production CSS or source change was needed.
4. Re-run the focused case and entire focused ending spec, review the diff, update relevant documentation, and archive the finalized plan.

## Test plan

The Test Engineer added the 320x360/200% case to the ending layout matrix in `e2e/lab/full-restoration-ending.spec.js`. It reuses `openEndingFromAlmostCompleteFixture(page, { textScale: 2 })` and checks applied scale, dialog/page viewport bounds and horizontal overflow, internal scrolling, and reachability of the narrative, live status, and all six statistics. It also checks Tab focus and Enter activation for **Continue exploring** inside the dialog and viewport.

Focused command: `npx playwright test e2e/lab/full-restoration-ending.spec.js --grep "320x360 with 200% text"`.

Initial baseline: **1 failed** because the whole-element containment helper required the 200% narrative paragraph to fit inside the scrollport at once. The 685.31px paragraph is taller than the 324px scrollport; its top was -162.5px while the scrollport began at 17px. The scale, viewport, and internal-scroll checks passed. Subsequent inspection confirmed the existing dialog scroll height supports scrolling; an ineffective CSS attempt was reverted. The test was refined to check narrative start and end reachability separately and to retain full-rectangle checks for the shorter status and all six statistics.

The refined focused case passed 1/1 in 4.3 seconds. The entire focused ending spec passed 16/16 in 28.4 seconds with `npx playwright test e2e/lab/full-restoration-ending.spec.js --reporter=line --workers=1`. The first normal sandbox run returned `spawn EPERM`; the authorized process-access rerun passed. Scoped Code Reviewer found no actionable findings. No build or full test suite was run.

## Acceptance criteria

- [x] The 200% preference is applied in the 320 by 360 ending journey.
- [x] The dialog remains within the viewport; the page and ending have no horizontal overflow; the dialog scrolls vertically.
- [x] Scrolling reaches the narrative's start and end separately and fully reveals the live completion status and all six statistics.
- [x] Tab focuses **Continue exploring** inside both the dialog and viewport, and Enter activates it.
- [x] Story copy/evidence and save/progression behavior remain unchanged; the independent human-playtest/content-expansion gate remains open.
- [x] The focused ending spec passes, relevant documentation is updated, and the finalized plan is archived.
