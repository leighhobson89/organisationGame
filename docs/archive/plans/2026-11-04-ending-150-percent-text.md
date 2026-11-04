# Plan: Restoration Ending at 150% Text Scale

**Status:** Complete. The compact restoration-ending matrix passes at 125% and 150% with no CSS change needed.

## Goal and boundary

Verify the full-restoration ending remains readable and operable at 125% and 150% text scale in compact 320×480 and 390×480 viewports. Preserve the current ending flow and all 125% coverage. This is an accessibility polish slice; it does not change story content or close the independent human-playtest/content-expansion gate.

## Proposed implementation

- Parameterize the compact ending setup and assertions in `e2e/lab/full-restoration-ending.spec.js` so each viewport runs at both 125% and 150%.
- Keep the same ending entry path, viewport geometry checks, and reachability assertions for both scales.
- Change ending CSS only if the focused cases reproduce a specific failure, and limit any correction to the completion dialog's layout, sizing, or scrolling rules in `src/styles/app.css`.
- Do not change ending copy, completion logic, save formats, or other UI surfaces.

## Test plan

The focused compact-ending matrix in `e2e/lab/full-restoration-ending.spec.js` covers all four combinations: 320×480 at 125% and 150%, and 390×480 at 125% and 150%. Each case:

- Seed the existing almost-complete save fixture and a preference value for its scale, complete the final filing through the UI, and assert the computed `--text-scale` matches the selected value.
- Assert that the ending dialog has vertical overflow and can scroll to bring the narrative, live completion status, and each of the six statistics fully into its visible scroll area.
- Measure the completion sequence, dialog, content, statistics grid, and statistic cards for horizontal overflow and viewport bounds; also check that **Continue exploring** stays within the dialog scrollport and viewport after focus.
- Tab from the focused ending heading to **Continue exploring**, verify focus and that the action remains visible within the dialog and viewport, then press Enter and confirm the ending closes.
- Retain the existing 125% cases and all their assertions while adding equivalent checks at 150%.

Focused command:

```sh
npm run test:e2e -- --workers=1 e2e/lab/full-restoration-ending.spec.js
```

The Test Engineer added the scale parameter to the existing fixture setup and expanded the compact matrix while retaining the 125% cases. The focused spec passed all 10 tests, including the four compact scale/viewport combinations. The existing layout passes at 150%, so no source CSS change is expected.

## Scope and constraints

- Viewports: 320×480 and 390×480.
- Text scales: retain 125% and add 150%.
- Preserve the current completion sequence, narrative, status, six statistic values, focus behavior, and Continue exploring action.
- No story or authored-content changes. Keep the independent two-chapter human-playtest/content-expansion gate open.
- Do not run the full test suite without user approval.

## Acceptance criteria

- [x] All four viewport/scale combinations confirm the selected text scale is applied.
- [x] The dialog scrolls vertically and exposes the narrative, status, and all six statistics in its visible scroll area.
- [x] Ending content and controls have no horizontal overflow or viewport clipping.
- [x] Tab reaches **Continue exploring**, which remains visible; Enter activates it and closes the ending.
- [x] All existing 125% assertions remain intact and pass alongside the new 150% cases.
- [x] Any CSS change is limited to a failure demonstrated by the focused regression; the current layout passes, so no CSS change was needed.
- [x] Relevant documentation is updated, and this plan is archived under `docs/archive/plans/` with a dated descriptive filename. The active browser-scaling playtest gate remains in `docs/plans/`.

## Implementation and verification

The four compact matrix cases verify applied scale, vertical dialog scrolling, full reachability of the narrative, status, and six statistic cards, horizontal overflow and viewport bounds, keyboard focus visibility, and Enter activation of **Continue exploring**. The focused command passed 10/10. Implementation assessment found the existing layout passes at both scales, so no CSS or production source change was needed. Code Reviewer found no findings. No production build or full test suite was run. The human-playtest/content-expansion gate remains open.
