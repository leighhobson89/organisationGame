# Plan: Keyboard Access to the Group Inspector at 200% Text

## Problem

At 320 × 360 with 200% text, the group Inspector must show evidence for all selected objects in a scrollable details region while keeping the panel, toolbar, and move controls usable. The overflow region currently has no explicit `tabIndex`; the browser baseline must establish whether keyboard users can reach and scroll it.

## Scope and implementation

- At 320 × 360 and 200% text, select all eight Harmonic Calibration items and open the group Inspector.
- Verify all eight selected evidence rows, page/panel/toolbar bounds, and separation between the panel and toolbar.
- Make the evidence scrollport explicitly keyboard-focusable and expose it as a named region so Tab from Close can reach it and PageDown/End can expose the last item's clue.
- Adjust the group action form layout at 320 × 360 / 200% to give the move-target selector a separate, usable, non-overlapping control area. A stacked layout is acceptable if it fits better than a side-by-side layout.
- Confirm Close, the move-target selector, and Move remain keyboard-focusable, visible, and hit-testable before and after scrolling.
- Use Enter to move all eight items to Analysis Table (`scratch-a`) without completing the collection; wait for autosave and verify their saved placements.
- Preserve existing placement, selection, reward, progression, camera, and save-schema behavior.

## Acceptance criteria

- The selected-items summary contains all eight Harmonic Calibration titles, families, and clues.
- The page, panel, and toolbar stay within the 320 × 360 viewport; the panel does not overlap the toolbar.
- The evidence scrollport has an accessible region name, Tab from Close reaches it, and PageDown/End brings the last selected item's clue into view.
- At 320 × 360 / 200%, the move-target selector has a separate, usable hit area that does not overlap the Move button; both controls remain keyboard-focusable and hit-testable.
- Close, move-target, and Move remain focused, visible, and hit-testable when reached by keyboard.
- Enter moves all eight items to scratch-a; the collection remains incomplete, and autosave records all eight scratch-pad placements.
- Source changes remain scoped to the evidence scrollport semantics and the group action form layout needed at this viewport and text scale.

## Focused verification

- Regression: `200% group Inspector keeps all eight evidence rows reachable by keyboard at 320x360` in `e2e/lab/inspector-panel-layout.spec.js`.
- Focused command: `npx playwright test e2e/lab/inspector-panel-layout.spec.js --grep "200% group Inspector keeps all eight evidence rows reachable by keyboard at 320x360" --workers=1 --reporter=line`.
- The red baseline confirms the Finder selects all eight objects; all eight evidence titles/families/clues render; viewport, panel, and toolbar bounds pass; moving the group to scratch-a, autosave, and noncompletion checks pass.
- Keyboard failures: Tab plus PageDown/End does not reveal the eighth clue. The move-target selector is only 20px wide at x=21–41, y=294.5–350.5 and is covered by the Move button; its center hit-test fails both before and after evidence scrolling.
- These failures establish the need for explicit evidence-scrollport focusability/role/name and a usable, non-overlapping group action form layout at 320 × 360 / 200%.
- The focused regression, the existing `group Inspector and toolbar actions remain reachable at 320x360 with 150% text` guard, and the `single-item Inspector and toolbar remain readable and reachable at 320x360 with 200% text` guard passed 3/3.
- `npm run build` passed with Vite 8.3.5 (62 modules). Scoped review completed. The full suite was not run.
- `docs/TESTING_GUIDE.md` and `docs/ROADMAP.md` record the behavior and verification results.

## Status

Complete. Focused regression and adjacent layout guards, production build, scoped review, and documentation update are complete. Finalized 2026-11-05 and archived as `docs/archive/plans/2026-11-05-group-inspector-200-percent-keyboard-access.md`.
