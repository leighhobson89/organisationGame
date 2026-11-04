# Plan: Save & Restore at 150% Text Scale

**Status:** Complete. The focused Save & Restore coverage passes at both compact viewports; no production or CSS change was needed.

## Goal and boundary

Verify the Save & Restore dialog remains readable and operable at 150% text scale in compact 320×480 and 390×480 viewports. Preserve the save format and current save, restore, delete, export, and import behavior. This is an accessibility polish slice; it does not change story content or close the independent human-playtest/content-expansion gate.

## Implementation outcome

- Added a 150% compact viewport case to `e2e/lab/manual-saves.spec.js` for 320×480 and 390×480. It seeds the preference and an existing Slot 2 save.
- The existing Save & Restore layout passed the viewport, overflow, scrolling, and focus-visibility checks, so no production or CSS change was needed.
- No save format, persistence behavior, game content, or unrelated UI surface changed.

## Test plan

The focused case in `e2e/lab/manual-saves.spec.js` runs at 320×480 and 390×480 at 150%. It:

- Seeds a valid Slot 2 save and the 150% preference, then asserts the computed `--text-scale` is 1.5.
- Checks dialog viewport bounds, page and dialog horizontal overflow, and internal vertical scrolling.
- Tabs through export, empty-slot Save, occupied-slot Overwrite/Restore/Delete, and import controls. Each focused control's full bounding rectangle must remain inside the dialog scrollport and viewport, with a 1 px tolerance.
- Types one character in the import field, enables its acknowledgement, and confirms the import action becomes enabled.
- Opens Restore for Slot 2, checks that the confirmation receives focus and remains visible, presses Escape and checks focus returns to Restore, then confirms the restore and checks the restored status, skill-point value, and focus return.

The first attempt to type the entire compressed save into the import field timed out. The test now types one character because this check verifies keyboard reachability and enabling the action; it does not need to import a full save.

Focused command:

```sh
npm run test:e2e -- --workers=1 e2e/lab/manual-saves.spec.js
```

## Scope and constraints

- Viewports: 320×480 and 390×480.
- Text scale: 150%.
- Preserve all save slots, their existing actions, export/import behavior, restore confirmation, persistence, and saved-game format.
- No story or authored-content changes. Keep the independent two-chapter human-playtest/content-expansion gate open.
- Do not run the full test suite without user approval.

## Acceptance criteria

- [x] Both compact viewport cases confirm the 150% preference is applied.
- [x] The dialog stays within the viewport and has no horizontal overflow; its content scrolls vertically as needed.
- [x] Export, manual slot actions, and import controls are reachable by scrolling and keyboard navigation, with each focused control's full rectangle visible.
- [x] Slot 2 restore confirmation is visible and focused; Escape returns focus to Restore; confirming restores the saved state and returns focus.
- [x] No CSS or production change was needed because the focused regression reproduced no layout or reachability failure.
- [x] Relevant documentation is updated, and this plan is archived under `docs/archive/plans/` with a dated descriptive filename. The active browser-scaling playtest gate remains in `docs/plans/`.

## Implementation and verification

`npm run test:e2e -- --workers=1 e2e/lab/manual-saves.spec.js` passed all 5 tests, including the new 150% case at both compact viewport sizes. The 150% case verifies dialog geometry and scrolling, keyboard reachability, full-control focus visibility within the dialog and viewport, and Slot 2 restore confirmation focus behavior. Implementation source review found no issue; no production or CSS change was needed. No full test suite was run. The independent two-chapter human-playtest/content-expansion gate remains open.
