# Plan: Consistent Modal Focus Containment

**Status:** Complete (2026-11-03). Focus recovery is consistent across Settings, Save & Restore, and the full-restoration ending. The independent human-playtest/content-expansion gate remains open.

## Goal and boundary

Keep keyboard focus inside each `aria-modal` dialog when Tab or Shift+Tab is pressed, including when focus has moved outside the dialog. When Save & Restore opens an overwrite, delete, or restore confirmation, move focus to the first confirmation button after it mounts. Preserve initial focus, Escape behavior, pending-action cancellation, and focus return to the triggering save action after cancellation or confirmation. The ending remains open until **Continue exploring** is activated.

This is an accessibility correction only. It does not change game progression, saves, confirmation semantics, or content.

## Implementation outline

- Reuse one focused control-discovery and Tab/Shift+Tab containment pattern across Settings, Save & Restore, and the ending.
- If focus is outside a modal, Tab moves to its first focusable control and Shift+Tab to its last.
- Move focus into the first action of Save & Restore confirmation prompts after the prompt mounts.
- Preserve current Escape handling: Settings closes, Save & Restore cancels a pending action before closing, and the completion ending is not dismissed by Escape.
- Preserve existing focus restoration when a modal closes and when a save confirmation is cancelled or completed.

## Verification scope

### Test plan

- In `e2e/lab/manual-saves.spec.js`, verify Tab and Shift+Tab restore focus to the first and last controls when focus starts outside Save & Restore. Verify opening overwrite, delete, and restore prompts moves focus to the confirmation action, while cancel/confirm returns focus to the triggering or corresponding action.
- In `e2e/lab/full-restoration-ending.spec.js`, verify Tab and Shift+Tab return focus to **Continue exploring** when focus starts outside the completion dialog, without dismissing the ending.
- In `e2e/lab/preferences.spec.js`, retain the passing Settings consistency regression: focus outside the dialog is recovered to the first control with Tab and the last with Shift+Tab.
- Run the focused cases with:

  ```sh
  npx playwright test e2e/lab/manual-saves.spec.js e2e/lab/full-restoration-ending.spec.js e2e/lab/preferences.spec.js --grep "Save & Restore recovers Tab focus|Save & Restore transfers focus|completion dialog recovers Tab focus|Settings recovers Tab focus" --workers=1
  ```

### Red baseline

- The targeted run reproduced three failures: outside-focus Tab recovery in Save & Restore, focus transfer into the restore confirmation, and outside-focus Tab recovery in the completion dialog.
- The Settings consistency regression passed 1/1 at baseline.

After implementation, run only the focused modal and save-dialog browser tests, build, and review. Do not run the full test suite without user approval. Update the architecture, testing, and roadmap docs with verified behavior and results. Archive the plan after review and verification; keep the deferred human-playtest plan active in `docs/plans/`.

## Acceptance criteria

- Settings, Save & Restore, and completion dialogs recover focus to the appropriate boundary control when Tab or Shift+Tab starts outside the modal.
- Save overwrite, delete, and restore confirmations receive focus after opening, and existing cancel/confirm focus return remains intact.
- Existing Escape, save, and ending behavior remains unchanged.
- Focused tests and build pass; review finds no actionable issues; the independent human-playtest/content-expansion gate remains open.

## Results (2026-11-03)

- `npx playwright test e2e/lab/manual-saves.spec.js e2e/lab/full-restoration-ending.spec.js e2e/lab/preferences.spec.js --workers=1` passed 16/16.
- `npm run build` passed with Vite 8.3.5.
- Reviewer re-review found no actionable findings.
- The full suite was not run. The user deferred the independent playtest; `docs/plans/browser-scaling-playtest-gate.md` remains active and content expansion stays gated.
- Architecture, testing, and roadmap documentation were updated with the shared focus behavior and verification results.
