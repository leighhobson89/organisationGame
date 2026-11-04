# Plan: Settings at 320×360

**Status:** Complete. The Settings regression now covers 320×360 with 150% text; the unchanged CSS passed all focused checks. The focused preferences spec passed 13/13, and scoped Code Reviewer found no actionable findings. No source change, build, or full suite was needed or run.

## Goal and boundary

Verify the Settings dialog remains usable at 320×360 with 150% text. Add this viewport to the existing regression in `e2e/lab/preferences.spec.js`; preserve the pinned title/Close and Done controls, internally scrolling `.settings-dialog__content`, and keyboard access to Text size, Always reduce motion, Sound effects, and Preview sound.

If the new case exposes a layout defect, change only compact Settings dialog CSS. Preserve preference v1, root text-scale behavior, reduced-motion and audio behavior, and unrelated dialogs.

## Test plan

Extend the existing 150%-text Settings viewport coverage with 320×360. Verify:

- The dialog, Settings heading, Close, and Done controls remain inside the viewport; neither the dialog content nor page overflows horizontally.
- The settings content scrolls internally when needed and keyboard focus can reach Text size, Always reduce motion, Sound effects, Preview sound, and Done, with focused controls visible and hit-testable.
- The existing text-scale, reduce-motion, and sound-preview interactions still work, and closing Settings removes the dialog cleanly.

### Test Specialist baseline

The focused `npm run test:e2e -- --workers=1 e2e/lab/preferences.spec.js` run passed 13/13 after adding 320×360 to the existing 150%-text compact viewport loop and including the Settings heading in pinned-bounds checks. Controls, internal scrolling, overflow, focus visibility and hit-testing, and clean close all passed on unchanged CSS; no production CSS change is indicated.

The focused run also retains the existing 320 × 400 and 390 × 400 compact cases, plus 480px layouts, preference persistence, and save-separation coverage. Scoped Code Reviewer found no actionable findings.

Run only the focused E2E spec:

```sh
npm run test:e2e -- --workers=1 e2e/lab/preferences.spec.js
```

Do not run the full test suite without approval.

## Implementation and acceptance

Use the unchanged-source baseline to determine whether a CSS change is needed. If needed, scope it only to compact Settings dialog selectors. Preserve preference v1 and behavior in unrelated dialogs.

- [x] The 320×360, 150%-text regression verifies dialog bounds, internal scrolling, no horizontal overflow, keyboard reachability and focus visibility/hit-testing for all named controls, and clean close.
- [x] The unchanged CSS required no production change; preference v1, root text scaling, reduced-motion/audio behavior, and unrelated dialogs are preserved.
- [x] The focused command passed 13/13 and scoped review found no actionable issues.
- [x] Relevant project documentation was updated and this plan was archived after review and verification.

No production build or full test suite was run for this slice.

