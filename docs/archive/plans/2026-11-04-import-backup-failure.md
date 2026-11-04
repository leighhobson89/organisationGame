# Plan: Preserve Current Save When Import Backup Fails

**Status:** Complete (2026-11-04). The backup-failure and focused import regressions passed; no implementation change was needed.

## Goal and boundary

Verify that a valid imported save is not applied if writing the pre-import backup fails. Keep the initial change coverage-only; production changes are in scope only if the focused regression proves that the current implementation applies the import or changes current save data after the backup error.

## Implementation plan

- Create current progress and a valid import payload with clearly distinct state, plus a preexisting backup value.
- Force the pre-import backup write to fail during import.
- Assert the import is rejected, current progress remains the existing state, and both the preexisting backup and autosave remain byte-for-byte unchanged.
- Preserve existing import validation, successful import, migration, and restore behavior.

## Focused regression plan

The Test Specialist added `backup failure rejects a valid import and preserves current progress and saves` to `e2e/lab/world-and-save-recovery.spec.js`. The case seeds a preexisting backup with distinct camera pan/scale, captures a valid initial export, then moves `calibration-card-01` into `cabinet-calibration` and waits for autosave so the current state is distinct from the import. It overrides `Storage.prototype.setItem` to throw `QuotaExceededError` only for the backup key, then attempts to import the valid initial export. Assertions check backup-failure feedback, one placed object and an identical current export, and byte-for-byte unchanged autosave and preexisting backup. The initial sandbox worker spawn returned Windows `EPERM`; the process-access rerun passed the targeted backup-failure check 1/1 and the focused import group 7/7. No source change was needed. Code Reviewer found no actionable findings. The full suite was not run.

Verify with the focused grep only:

```powershell
npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js --grep "backup failure"
```

Do not run the full suite.

## Acceptance criteria

- [x] The regression imports a valid payload whose progress is distinct from the current laboratory and uses a preexisting backup.
- [x] A failed pre-import backup write prevents the valid payload from being applied.
- [x] The current progress, original backup, and autosave are all unchanged after the failure.
- [x] Existing successful and invalid-import behavior remains intact; the focused import group passed without an implementation change.
- [x] The focused regression passes, the Testing Guide and roadmap are updated, and the finalized plan is archived in `docs/archive/plans/` with `docs/plans/` containing only the active browser-scaling/playtest plan. The full suite was not run.
