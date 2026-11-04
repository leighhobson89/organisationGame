# Plan: Restoration Ending at 400px

**Status:** Complete (2026-11-04). The focused 400px ending verification passed without a production or CSS change; Code Reviewer found no actionable concerns.

## Goal and boundary

Verify the existing full-restoration ending at 150% text scale on 320x400 and 390x400 viewports. Extend `e2e/lab/full-restoration-ending.spec.js` and retain the current 320x480 and 390x480 cases at 125% and 150%.

Keep the work to presentation and interaction verification for the current ending: no narrative changes, authored content changes, production CSS before focused measurements show a failure, or changes to the independent human-playtest/content-expansion gate.

## Implementation plan

- Capture the unchanged-source red baseline at both 400px viewports and 150% text scale before making layout changes.
- Reuse the existing ending layout and focus checks for the new cases: verify the applied text scale, internal dialog scrolling and full reachability of the narrative, live status, and all six statistics.
- Verify Tab places focus on **Continue exploring** with the full control bounds inside the dialog scrollport and viewport; Enter dismisses the ending and returns to the game.
- Check the ending, dialog, content, statistics, and statistic cards for horizontal overflow and viewport bounds.
- Make a narrowly scoped CSS change only if a focused baseline assertion demonstrates a layout or reachability failure. Preserve the 480px cases and all narrative/game behavior.

## Focused regression plan

The Test Specialist added the 150% 320x400 and 390x400 cases to the existing viewport loop in `e2e/lab/full-restoration-ending.spec.js`. Both reuse the established assertions: applied text scale; internal dialog scrolling; reachability of the narrative, live status, and six statistics; **Continue exploring** Tab focus bounds within the dialog and viewport; horizontal overflow; Enter dismissal; and the restored world item count. The initial sandbox attempt hit Windows `spawn EPERM`. Rerunning with process access, the focused spec passed 12/12, including both new cases, and `npm run build` passed with Vite 8.3.5 (59 modules). No CSS change was needed. Code Reviewer found no actionable concerns. The full suite was not run.

Run the focused ending spec only during this slice:

```powershell
npm run test:e2e -- --workers=1 e2e/lab/full-restoration-ending.spec.js
```

Do not run the full suite without user approval.

## Acceptance criteria

- [x] The focused spec covers 320x400 and 390x400 at 150% while retaining existing 320x480 and 390x480 checks at 125% and 150%.
- [x] The ending dialog scrolls internally and the narrative, live status, and all six statistics remain reachable.
- [x] Tab reaches **Continue exploring** with its full bounds within the dialog and viewport; Enter dismisses the ending.
- [x] The ending layout has no horizontal overflow at the new sizes.
- [x] No CSS change was needed; narrative, authored content, and human-playtest scope remain unchanged.
- [x] Focused verification passes, relevant documentation is updated, and the finalized plan is archived in `docs/archive/plans/` with `docs/plans/` left with only the active browser-scaling/playtest plan. The full suite was not run.
