# Plan: Close Save & Restore After Imported Completion

**Status:** Complete. Continuing after importing a fully restored save now closes the ending and Save & Restore, restores focus to the persistent opener, and returns access to world controls. The focused spec passed 12/12; the build passed after process-access retries; scoped review found no actionable findings. The full suite was not run.

## Goal and boundary

Fix the imported-completion handoff. In the imported fully-restored-save scenario, Continue exploring must close the ending and Save & Restore dialog, return focus to the persistent `open-saves` opener, and make world controls available. Update `e2e/lab/full-restoration-ending.spec.js` to assert the complete handoff and explicitly reopen Save & Restore before its later incomplete-import steps.

Preserve invalid and incomplete import behavior, validation, backup-before-import, the save schema, and real-completion behavior: only completing the laboratory through gameplay activates audio and presents the ending, once.

## Test plan

Extend the existing imported/restored and real-completion journey. Verify:

- Importing a fully restored save displays the completion ending without emitting `invention.activated`.
- Continue exploring closes both the ending and Save & Restore dialog, restores focus to the persistent Save & Restore opener, and leaves world controls available.
- Completion activation audio remains suppressed after continuing from the imported ending.
- Save & Restore can be explicitly reopened before the existing incomplete-save import flow; validation/import behavior and the subsequent real final filing remain intact.
- Real gameplay completion activates audio and shows the ending only once; invalid and incomplete import scenarios retain their current behavior.

### Test Specialist regression and baseline

The Test Specialist added assertions that Continue exploring closes both the ending and Save & Restore dialog, returns focus to `open-saves`, leaves world controls available, keeps imported activation audio suppressed, and explicitly reopens Save & Restore before the later incomplete import. The focused baseline was 11 passed and 1 failed: the failure is exactly at the new dialog-closure assertion because Save & Restore remains mounted. The other 11 flows passed, including true completion and incomplete-save scenarios.

After the App handoff change, `npm run test:e2e -- --workers=1 e2e/lab/full-restoration-ending.spec.js` passed 12/12. It confirms both dialogs close, focus returns to `open-saves`, world controls are available, imported activation remains suppressed, incomplete imports remain ending-free, and real gameplay completion activates once. `npm run build` passed after process-access retries, and scoped Code Reviewer found no actionable findings.

Run only the focused E2E spec:

```sh
npm run test:e2e -- --workers=1 e2e/lab/full-restoration-ending.spec.js
```

Do not run the full test suite without approval.

## Implementation and acceptance

Make the smallest change needed to hand control back to the lab after Continue exploring from an imported completion. Preserve confirmation, validation, backup, import/save data, and genuine completion semantics.

- [x] The imported-completion case verifies both dialogs close, focus returns to `open-saves`, world controls are available, and activation audio remains suppressed.
- [x] Save & Restore is explicitly reopened before later incomplete-import steps; invalid/incomplete imports and real completion behavior remain covered.
- [x] The focused command passed 12/12 and review found no actionable issues; the build passed after process-access retries.
- [x] Relevant project documentation was updated and this plan was archived after implementation, review, and verification.

The full test suite was not run.

