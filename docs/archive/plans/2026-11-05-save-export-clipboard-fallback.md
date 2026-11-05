# Plan: Save Export Clipboard Fallback

**Status:** Finalized; strengthened focused regression passed and re-review found no actionable findings.

## Goal and rationale

Verify Save & Restore still provides a usable portable-save path when clipboard access is unavailable. A rejected browser clipboard write should announce a clear accessible fallback while leaving the nonempty export string available for manual copying.

## Scope and constraints

- Add one focused E2E case in `e2e/lab/manual-saves.spec.js`.
- Mock `navigator.clipboard.writeText` to reject before clicking **Copy compressed save**.
- Assert the UI exposes the accessible fallback/status message asking the player to select and copy the save string.
- Assert the export field remains available and contains a nonempty compressed save string for manual copying.
- Keep the production behavior test-only unless the focused test demonstrates a user-visible defect; do not change save format or clipboard semantics outside fallback behavior.
- Run only the focused manual-saves case. Keep the independent human-playtest/content-expansion gate unchanged.

## Implementation approach

1. Add a focused clipboard-unavailable E2E case that stubs `navigator.clipboard.writeText` to reject.
2. Open Save & Restore, click **Copy compressed save**, and verify accessible fallback feedback plus a nonempty export field.
3. Run the focused manual-saves command. Make an app change only if the fallback feedback or export field does not meet the requirement, then rerun the focused case.

## Test plan

Focused command: `npm run test:e2e -- --workers=1 e2e/lab/manual-saves.spec.js --grep "clipboard unavailable"`.

The focused command `npm run test:e2e -- --workers=1 e2e/lab/manual-saves.spec.js --grep "clipboard unavailable"` initially passed **1/1 in 3.0 seconds** after a process-access retry. It mocks `navigator.clipboard.writeText` rejection, verifies the export remains visible, read-only, nonempty, and unchanged, and checks manual-copy feedback through `role=status`. Review identified a gap: the test must explicitly assert that the feedback status is visible. The Test Engineer added `feedback.toBeVisible()`; the strengthened focused rerun passed **1/1 in 2.8 seconds** after a process-access retry. No app source change or full suite was run. Re-review found no actionable findings.

## Acceptance criteria

- [x] Clipboard `writeText` rejects when the player clicks **Copy compressed save**.
- [x] A visible accessible `role=status` message explains the manual-copy fallback.
- [x] The export field remains available with a nonempty compressed save string.
- [x] Only the focused E2E is run; no app change was needed, and the independent human-playtest/content-expansion gate stays unchanged.
