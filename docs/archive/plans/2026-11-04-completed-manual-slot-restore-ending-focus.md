# Plan: Completed Manual-Slot Restore Ending Focus

**Status:** Complete. A confirmed Slot 2 restore of a completed save focuses the ending heading without activation audio; Continue closes both dialogs, returns focus to `open-saves`, and restores world control access. The combined focused specs passed 18/18 on unchanged production source. React implementation review and Code Reviewer found no actionable findings. No build or full suite was run.

## Goal and boundary

Seed a version 1 manual-slot envelope containing a fully filed completion save. Open Save & Restore, request and confirm restore, and verify the completion ending appears with its heading focused and no `invention.activated` audio. Continue exploring must close both the ending and Save & Restore, restore focus to the persistent `open-saves` control, and make world controls available.

Preserve the existing pasted-import and incomplete-import cases, ordinary manual restore and pre-restore backup behavior, the save schema, and exactly-once activation audio/ending on real gameplay completion. The new focus assertion should detect any race between Save & Restore's restore-action focus scheduling and CompletionSequence heading focus.

## Test plan

Add a completed-manual-slot scenario to `e2e/lab/full-restoration-ending.spec.js`, using the existing full-completion fixture and manual slot envelope. Verify:

- Confirmed restore shows the ending and focuses its **The laboratory is restored** heading.
- Restoring a completed save does not emit `invention.activated`.
- Continue exploring closes both overlays, returns focus to the persistent `open-saves` opener, and leaves world controls available.
- Existing pasted-import suppression, incomplete-import ending absence, ordinary restore backup, and real-completion exactly-once activation behavior continue to pass.

### Test Specialist baseline and verification

The combined focused command passed 18/18 on unchanged production source. The new Slot 2 complete-save restore confirms that the restore action focuses the completion heading, `invention.activated` remains absent, Continue closes both dialogs and returns focus to `open-saves`, and world controls plus the item count are available. The pasted-import handoff and manual pre-restore backup tests also passed.

The focused command was `npm run test:e2e -- --workers=1 e2e/lab/full-restoration-ending.spec.js e2e/lab/manual-saves.spec.js`. React implementation review and scoped Code Reviewer found no actionable findings.

Run only the focused specs:

```sh
npm run test:e2e -- --workers=1 e2e/lab/full-restoration-ending.spec.js e2e/lab/manual-saves.spec.js
```

Do not run the full test suite without approval.

## Implementation and acceptance

Use the baseline to determine whether restore/ending focus needs a correction. Keep any implementation limited to the manual-slot restore/completion handoff and preserve the existing import, backup, confirmation, schema, and genuine-completion behavior.

- [x] The completed manual-slot restore verifies confirmation, focused ending heading, suppressed activation audio, both dialogs closing on Continue, opener focus return, and world-control availability.
- [x] Existing pasted imports, incomplete imports, ordinary restore/backup, save schema, and one-time real-completion activation remain covered.
- [x] The combined focused command passed 18/18 on unchanged production source; React implementation review and Code Reviewer found no actionable issues.
- [x] Relevant project documentation was updated and this plan was archived after review and verification.

No production build or full test suite was run for this slice.

