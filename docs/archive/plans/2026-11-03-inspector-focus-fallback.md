# Plan: Inspector Focus Fallback

**Status:** Complete; implementation, focused verification, and review finished.

## Goal

When the Inspector closes, return focus to a selected world item that can actually receive focus. If the first candidate exists in the DOM but cannot accept focus, continue through the selected-item candidates until focus moves successfully.

## Scope

- Updated `WorldViewport.focusItemControl` in `src/ui/WorldViewport.jsx` so it reports success only when `document.activeElement === control` after calling `.focus()`; otherwise it continues to the next candidate.
- Added a focused group-selection regression in `e2e/lab/panel-coordination.spec.js`: select two items, disable the current item's control, close Inspector, and verify focus falls back to the first selected item while both items remain selected.
- Preserve behavior outside Inspector focus return. Leave the deferred browser scaling and human playtest gate unchanged.

## Verification

The focused regression is `closing a group Inspector falls back to another selected item when the current item cannot receive focus` in `e2e/lab/panel-coordination.spec.js`. It selects `calibration-card-01` and `calibration-card-02`, disables the current item's button, closes Inspector, checks that both items remain pressed and selected, then expects focus on the first item.

The red baseline command was `npx playwright test e2e/lab/panel-coordination.spec.js --workers=1 --grep "closing a group Inspector falls back"`. It failed at `firstItem.toBeFocused()` after the selection-retention assertions passed, confirming the fallback defect. After implementation, the focused selected-item, Puzzle, and fallback checks passed 3/3. The production build passed; Code Reviewer found no functional issue; scoped diff-check was clean aside from the expected LF-to-CRLF warning. The full suite was not run.

## Documentation and closeout

Relevant project documentation was updated. This plan is archived as `docs/archive/plans/2026-11-03-inspector-focus-fallback.md`. The deferred browser scaling and human playtest gate remains open in `docs/plans/`.
