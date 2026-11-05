# Plan: Save & Restore at 200% Text Scale

**Status:** Complete. The focused 200% regression passed on the existing implementation; no production changes were needed.

## Goal and rationale

Make the Save & Restore workflow usable at 200% text scale on a compact 320 by 360 viewport. This dialog combines export text, three manual slots, and import controls, making it the densest high-value surface not yet covered at 200%. Extend the existing 150% narrow-viewport coverage and reuse its viewport, scrolling, focus-visibility, and hit-test helpers.

## Scope and constraints

- Seed a valid existing manual save slot and a persisted 200% text-scale preference before loading the app.
- At 320 by 360, verify the dialog fits within the viewport, neither the page nor dialog has horizontal overflow, and the dialog scrolls vertically.
- Navigate by keyboard and verify each focused control remains inside the dialog and viewport and is hit-testable. Cover export, manual-slot actions, the import field, acknowledgement, and import button.
- Activate Restore on the seeded slot and verify its confirmation copy and action are visible, with focus on the action. Confirm Escape returns focus to Restore, then confirm the restore and verify success feedback and restored state.
- Reuse existing save fixtures/helpers and do not change the save schema, import/restore behavior, or persistence semantics.
- Keep the independent two-chapter human playtest and content-expansion gate unchanged. The user deferred that playtest; this accessibility slice does not close or replace it.

## Implementation approach

1. Add a focused 200%/320 by 360 case to the existing Save & Restore E2E coverage, using the valid Slot 2 fixture and established layout/focus helpers.
2. Check viewport fit, page and dialog horizontal overflow, internal vertical scrolling, and keyboard focus visibility/hit-testing through export, slot actions, and import controls.
3. Verify Restore confirmation focus, Escape focus return, keyboard confirmation, success feedback, and the restored Slot 2 skill points.
4. Keep the change limited to regression coverage unless the focused test exposes a production defect. Do not run the full suite without user approval.

## Test plan

The Test Engineer added `200% Save & Restore stays usable by keyboard at 320x360` in `e2e/lab/manual-saves.spec.js`. It sets a 320x360 viewport and seeds a version-1 manual Slot 2 with 37 skill points plus a persisted text scale of 2. It verifies the preference, dialog bounds, horizontal overflow, vertical scrolling, and visible/hit-testable focus through the export field, copy action, save/overwrite/restore/delete slot actions, import field, acknowledgement, and enabled import button. Typing `x` into the import field enables the import button without changing persistence. The test then opens Restore confirmation, verifies the confirmation copy and action are visible and the action is hit-testable, cancels with Escape and checks focus returns to Restore, confirms with Enter, and verifies success feedback, focus return, and the restored skill points.

Focused command: `npx playwright test e2e/lab/manual-saves.spec.js --grep "200% Save & Restore stays usable by keyboard at 320x360"`.

Baseline result: **1 passed in 3.5 seconds before production changes; no red UI regression was found.** An initial test attempt could not focus the disabled import button because the import field was empty; the test fixture now enters `x` before navigating to it. This was a fixture correction, not a product defect. The final regression also asserts the exact Slot 2 restore confirmation copy is visible.

## Acceptance criteria

- [x] The seeded 200% preference is applied and the 320 by 360 Save & Restore dialog stays entirely in the viewport.
- [x] The page and dialog have no horizontal overflow; dialog content scrolls vertically.
- [x] Keyboard navigation reaches the covered export, slot, and import controls, with each focused control visible, inside the dialog, and hit-testable.
- [x] Restore confirmation copy and action are visible; Escape returns focus to Restore; confirming restores the saved state and announces success.
- [x] Existing save format and restore/import semantics are unchanged; the unrelated human-playtest/content-expansion gate remains open.
- [x] The focused regression passes, and the finalized plan is archived after review and documentation updates.
