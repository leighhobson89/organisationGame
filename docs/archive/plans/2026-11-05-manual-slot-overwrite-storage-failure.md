# Plan: Manual Slot Overwrite Storage Failure

**Status:** Finalized; focused regression passed and final review found no actionable findings.

## Goal and rationale

Verify overwriting an occupied manual Slot 2 fails safely when the browser cannot write that slot. The player should receive accessible failure feedback, while the original slot bytes/status and current live/export state remain unchanged.

## Scope and constraints

- Add one focused regression in `e2e/lab/manual-saves.spec.js` using an occupied, valid Slot 2 fixture.
- Capture the slot's original raw value and occupied/status presentation before attempting the overwrite.
- Make storage writes fail only for the Slot 2 key, leaving all other storage operations available.
- Start an overwrite, confirm the confirmation prompt, and verify accessible failure feedback after the attempted write.
- Assert the original Slot 2 raw value and occupied/status presentation remain unchanged, and the current live state and exported state remain unchanged.
- Make no application change unless the focused UI regression shows failure feedback or preservation behavior is wrong. Keep the independent human-playtest/content-expansion gate unchanged.

## Implementation approach

1. Seed a valid occupied Slot 2 with raw bytes distinguishable from current game state, and record the current game's export and Slot 2 presentation.
2. Install a storage write failure scoped only to the Slot 2 storage key.
3. Open Save & Restore, request Slot 2 overwrite, and confirm it.
4. Assert accessible error feedback, unchanged Slot 2 bytes/status, and unchanged live/export state.
5. Run only the focused manual-saves regression. If UI feedback or preservation fails, make the smallest necessary app change and rerun the focused case; otherwise keep the change test-only.

## Test plan

Focused command: `npm run test:e2e -- --workers=1 e2e/lab/manual-saves.spec.js --grep "overwrite storage failure"`.

Result: **1/1 passed in 3.0 seconds** after a process-access retry. Coverage verifies occupied Slot 2, `Storage.prototype.setItem` throwing only for its key, overwrite confirmation, accessible `role=status` failure feedback, unchanged slot status/raw bytes, autosave, live skill points, and current export; the storage interception is confirmed. The first run exposed an overstrict write-count assertion because rollback also retries the key; the test was adjusted to assert at least one attempted write and the focused rerun passed. No app source change or full suite was run. Final review found no actionable findings.

## Acceptance criteria

- [x] The test begins with a valid occupied Slot 2 and records its raw value/status plus the current export.
- [x] Only Slot 2 storage writes fail; overwriting requires confirmation and exposes accessible failure feedback.
- [x] The failure leaves the original Slot 2 value/status and live/export state unchanged.
- [x] Only the focused regression is run; no app change was needed; the plan is archived and the independent human-playtest/content-expansion gate is untouched.
