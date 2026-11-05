# Plan: Recover a Valid Backup after Autosave Corruption

**Status:** Finalized; focused regression passed and final review found no actionable findings.

## Goal and rationale

Verify startup recovery uses a valid backup when the autosave is corrupt, preserves the corrupt raw autosave in recovery storage, and keeps the recovered progress through the next autosave and reload. Use visibly distinct backup progress so the test proves the recovered state rather than merely checking that the app starts.

## Scope and constraints

- Add one focused E2E regression in `e2e/lab/world-and-save-recovery.spec.js`.
- Seed a corrupt autosave raw string and a valid, visibly distinct backup before application startup.
- Assert the startup recovery notice explains that the laboratory was recovered from its backup and that the original autosave was preserved.
- Verify a distinctive property from the backup is visible in the UI, such as the backup's filed calibration-card placement/count or its distinct skill points.
- Verify the exact corrupt autosave raw bytes are preserved under the recovery key.
- Wait for recovered-state autosave, reload, and assert the visible backup progress remains restored.
- Keep this test-only unless the focused E2E demonstrates a recovery defect. Do not run the full suite; keep the independent human-playtest/content-expansion gate unchanged.

## Implementation approach

1. Seed a malformed autosave and a valid backup with a UI-visible difference from a fresh world.
2. Load the app and assert the alert recovery notice and the distinctive backup progress.
3. Read the recovery key and compare its value byte-for-byte with the original corrupt autosave string.
4. Wait for autosave, reload, and verify the recovered progress remains visible and the corrupt bytes remain preserved.
5. Run only the focused regression. Make a production change only if the existing recovery behavior fails; otherwise keep the update test-only.

## Test plan

Focused command: `npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js --grep "recovers a valid backup"`.

The focused command `npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js --grep "recovers a valid backup"` passed **1/1 in 3.7 seconds** after a process-access retry. It seeds a corrupt autosave and a valid backup with 37 skill points, checks the recovery alert and visible progress, verifies the exact corrupt bytes under the recovery key, confirms autosave replaces the corrupt copy, then reloads and verifies recovered progress and backup state remain. No app source change or full suite was run. Final review found no actionable findings.

## Acceptance criteria

- [x] A corrupt autosave and a valid, visibly distinct backup are seeded before startup.
- [x] The startup alert identifies backup recovery, distinct backup progress is visible, and the corrupt raw bytes are preserved exactly under the recovery key.
- [x] After autosave and reload, the recovered backup progress remains visible.
- [x] Only the focused E2E is run; no production change was needed; the plan is archived and the independent human-playtest/content-expansion gate remains unchanged.
