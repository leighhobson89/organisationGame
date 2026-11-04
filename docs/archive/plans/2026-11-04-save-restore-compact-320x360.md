# Plan: Save & Restore at 320×360

**Status:** Complete. The existing Save & Restore source and CSS passed at 320×360 with 150% text, so no production change was needed. The focused manual-saves spec passed 5/5, and scoped Code Reviewer found no actionable findings. No build or full suite was run.

## Goal and boundary

Verify the existing Save & Restore dialog and its complete keyboard-driven flow at 320×360 with 150% text. Extend `e2e/lab/manual-saves.spec.js` to check dialog and page horizontal overflow, internal vertical scrolling, full visibility and hit-testing of focused controls, export, all three save slots, import controls, restore confirmation and focus return, and restoration of Slot 2.

If the new viewport exposes a defect, adjust only compact `.save-dialog` CSS needed to make this flow usable. Preserve the save envelope and schema, backup-before-restore/import behavior, confirmations, and the existing 320 × 400, 390 × 400, 320 × 480, and 390 × 480 layouts.

## Test plan

Add the 320×360 viewport with 150% text to the focused Save & Restore layout flow. Confirm that:

- The dialog remains within the viewport and neither it nor the page overflows horizontally; dialog content scrolls vertically where needed.
- Keyboard traversal keeps each control inside the dialog and viewport, with its full rectangle visible and its center hit-testable, through export, Slot 1, Slot 2 overwrite/restore/delete, Slot 3, import, and acknowledgement controls.
- Restore confirmation receives focus, Escape returns focus to the Slot 2 restore action, and confirming restore returns focus and restores the saved Skill Points state.
- Existing confirmations and backup-before-restore/import semantics remain intact.

### Test Specialist baseline

The focused manual-saves spec passed 5/5 with the added 320×360, 150%-text case. At 320×360, the dialog rect was x=14–306 and y=14–346 (292×332); `clientWidth`/`scrollWidth` were 290/290, `clientHeight`/`scrollHeight` were 330/2117, and document/viewport width was 320/320. All controls and restore assertions passed. The baseline is green, so no production CSS change is indicated.

The complete focused run passed 5/5 across 320 × 360, 320 × 400, 390 × 400, 320 × 480, and 390 × 480. Scoped Code Reviewer found no actionable findings. No source or CSS change was needed.

Run only the focused E2E spec:

```sh
npm run test:e2e -- --workers=1 e2e/lab/manual-saves.spec.js
```

Do not run the full test suite without approval.

## Implementation and acceptance

Use the unchanged-source baseline to decide whether a CSS correction is needed. If needed, scope it to compact `.save-dialog` rules, preserve the existing textarea behavior at narrow 400px layouts, and avoid changing the save data format or restoration flow.

- [x] The 320×360, 150%-text regression verifies viewport bounds, no horizontal overflow, dialog scrolling, keyboard focus visibility and hit-testing, export, all three slots, import controls, restore confirmation/focus return, and Slot 2 restoration.
- [x] The green unchanged-source baseline required no CSS change; save envelope/schema, backup, import/restore confirmation, and existing 400px/480px behavior are preserved.
- [x] The focused command passed 5/5 across all five tested viewport sizes, and scoped review found no actionable issues.
- [x] Relevant project documentation was updated and this plan was archived after review and verification.

No production build or full test suite was run for this slice.

