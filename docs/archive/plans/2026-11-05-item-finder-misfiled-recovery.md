# Plan: Item Finder Misfiled Recovery Cue

**Status:** Complete. Focused regression, implementation review, and build verification passed; this plan is archived.

## Scope

Show a compact, visible **Misfiled** label on invalid-placement results in the Item Finder. Give those results an accessible name that states the misfiled condition and a clear recovery cue: select the result to inspect and move the item.

Keep the existing selection path into the Inspector. The selected item continues to show its existing misfiled status and Move control, and recovery continues through the existing move workflow. This slice changes no game content, placement rules, save data, or persistence behavior.

## Acceptance criteria

- Invalid-placement Finder results show a compact **Misfiled** label; valid results do not receive that label.
- The accessible name for an invalid result identifies it as misfiled and tells the user that selecting it allows recovery through the Inspector's Move control.
- Selecting an invalid result opens the existing Inspector with its misfiled status and Move control available; moving the item uses the established workflow.
- At 320px viewport width with the highest supported text scale, the result label and controls remain legible and reachable without horizontal page overflow or obscured content.
- No item content, placement data, save format, or persistence behavior changes.

## Focused regression and baseline

The focused case is `Finder identifies a canvas-only misfiled item and exposes its recovery at 200% text on a narrow screen` in `e2e/lab/item-finder-layout.spec.js`. It runs at 320 x 480 with 200% text, verifies a canonical item placed in the wrong destination is Canvas-only before opening the Finder, and checks that the result exposes the recovery cue and that the existing Inspector recovery path is reachable.

The first authorized run was discarded as invalid evidence: save normalization derives a workspace item's validation as unchecked, so that fixture did not establish a misfiled state. The corrected fixture places a canonical item in the wrong destination while keeping it Canvas-only. Its red baseline failed 1/1 at the missing visible **Misfiled** label, as expected.

## Implementation targets

- `src/ui/ItemFinder.jsx` now shows a compact **Misfiled** label on invalid results. Its accessible name states: "Misfiled. Select this result to inspect it and move it somewhere else to correct the record."
- Selecting the result continues into the existing Inspector, whose misfiled status and Move control remain available.
- The 320 x 480, 200% text case verifies the label fits, the result has no horizontal row or page overflow, and the Inspector recovery controls remain available.

## Final verification

- Corrected focused regression in `e2e/lab/item-finder-layout.spec.js`: passed 1/1.
- `npm run build`: passed with Vite 8.3.5 and 62 modules.
- Scoped review found no actionable issues.
- The full test suite was not run. The independent human two-chapter playtest remains deferred and its gate remains open; content expansion remains gated.

Finalized 2026-11-05 and archived as `docs/archive/plans/2026-11-05-item-finder-misfiled-recovery.md`.
