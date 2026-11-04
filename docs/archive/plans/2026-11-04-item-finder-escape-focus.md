# Item Finder Escape and Focus Return

## Goal

Let keyboard users dismiss the Item Finder from its search field and return to the toolbar control that opened it.

## Scope

- Handle Escape while the Item Finder is open by calling its existing `onClose` callback.
- Use the existing close path so focus returns to the toolbar's **Find an item** control.
- Keep camera position and game state unchanged when dismissing the Finder.
- Preserve existing search, selection, close-button, and announcement behavior.

## Implementation and Verification

- Add the Escape key handling in `src/ui/ItemFinder.jsx`, scoped to the open Finder and using its existing close callback.
- Add a focused regression to `e2e/lab/item-finder-announcements.spec.js`: open the Finder, verify its search field has focus, press Escape, verify the Finder closes and focus returns to **Find an item**, and verify the camera has not moved.
- Run only the focused Item Finder E2E regression. Do not run the full suite without user approval.

## Test Plan

The regression in `e2e/lab/item-finder-announcements.spec.js` opens the Finder and verifies the search field is focused, captures the `.world-scene` inline transform, presses Escape from the search field, then verifies the Finder region is removed, the exact **Find an item** opener has focus, and the transform is unchanged.

Focused command:

```sh
npm run test:e2e -- --workers=1 e2e/lab/item-finder-announcements.spec.js --grep "Escape"
```

Pre-implementation baseline: failed as expected because pressing Escape left the Finder search region present (expected count 0, received 1).

## Outcome

- The focused E2E passed 1/1 after implementation.
- The Vite production build passed with 59 modules. Its initial sandbox process spawn returned `EPERM`; the retry with process access passed.
- Code Reviewer found no issues. The full test suite was not run.
- The independent human playtest remains deferred, so the content-expansion gate remains open.

This finalized plan is archived at `docs/archive/plans/2026-11-04-item-finder-escape-focus.md`.
