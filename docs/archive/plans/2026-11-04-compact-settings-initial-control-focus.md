# Plan: Focus the First Settings Control on Open

## Context

At 320×360 with 150% text scaling, opening Settings focuses the Close button. The Text size select and other preferences begin below the visible content area, so the panel opens without showing an editable preference.

Focusing the first preference field fixes that initial view. The focused regression then exposed three failures when changing Text size to 150%: the scale/status reflow can leave the focused select outside the visible content area.

## Change

- Focus the first preference field (`select, input`) when the dialog opens, allowing the existing scroll container to bring Text size into view.
- After a `textScale` change, adjust only `.settings-dialog__content`'s scroll position when needed to keep the focused Text size control fully visible; preserve focus through the reflow.
- Keep Close before the form fields in DOM and keyboard order; preserve Escape handling, focus restoration, dialog geometry, scroll behavior, preference persistence, and all other controls.
- Make no copy or CSS changes.

## Verification

- Preload the 150% text preference, set the viewport to 320×360, and open Settings. Immediately verify `#settings-text-size` has initial focus, fits fully inside the visible `.settings-dialog__content` viewport, and is hit-testable at its center.
- At 320×360, 320×400, and 390×400, change Text size to 150%. Immediately verify the focused select remains fully inside the visible content viewport and hit-testable after reflow.
- Verify the page has no horizontal overflow; retain the existing compact checks for dialog bounds, keyboard traversal, Escape, opener focus restoration, and lower-control reachability.
- Run only the focused Settings E2E cases and inspect the scoped diff; do not run the full suite.

The initial-focus red baseline failed because Close received focus, leaving Text size outside the visible content viewport. The follow-up red run passed initial focus but failed three post-scale visibility checks when reflow moved the focused select outside the scroll area.

## Boundary

This is a presentation and focus-entry refinement. It does not change game or preference data, and it does not close or alter the deferred independent chapter-playtest/content-expansion gate.
