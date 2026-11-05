# Plan: Professor's Notebook at 200% Text Scale

**Status:** Complete. The 200% compact Notebook layout and focused regression passed review.

## Goal and rationale

Verify the Professor's Notebook remains readable and keyboard-operable at 200% text scale in the worst-case compact 320 by 360 viewport. Build on the existing seeded 150% Notebook regression without expanding the viewport matrix.

## Scope and constraints

- Parameterize `seedNotebook(page, textScale)` and use `2` for the new 200% case at 320 by 360.
- Verify the applied text scale, Notebook panel and document bounds within the viewport, no horizontal overflow in the panel or page, at least 8px separation from the toolbar, and internal vertical scrolling.
- Verify keyboard focus, viewport containment, and center hit-testing for each horizontally scrollable header action: Notebook, Skills, Save, and Settings.
- Tab through every collection action. Verify each focused action remains fully visible inside the panel and viewport and is hit-testable at its center.
- Scroll Recent discoveries and verify the title and body of every seeded discovery remain reachable.
- Preserve existing Notebook and story content, collection behavior, and save/progression semantics. Make production styling changes only if the focused regression demonstrates a defect; keep any adjustment scoped to the Notebook.
- Run only the focused Notebook spec; do not run the full suite. Keep the independent human-playtest/content-expansion gate open.

## Implementation approach

1. Extend `e2e/lab/notebook-panel-layout.spec.js` by parameterizing the existing `seedNotebook` scale and adding one 200% case at 320 by 360.
2. Check panel/page bounds, horizontal overflow, toolbar separation, internal scrolling, keyboard focus visibility and hit testing for every collection action, and title/body reachability for each seeded discovery.
3. Scope compact header geometry for the 200% case so the Notebook panel exposes the full collection action and header actions stay within the viewport. Reduce horizontal padding on the compact header controls from 6px to 3px; preserve the existing 150% cases and Notebook content behavior.
4. Run the focused Notebook spec, complete scoped review, update relevant documentation, and archive the finalized plan.

## Test plan

The Test Engineer added `200% text scale keeps Notebook content and collection actions reachable at 320x360` in `e2e/lab/notebook-panel-layout.spec.js`. It parameterizes `seedNotebook` with text scale 2 and checks applied scale, panel/page bounds and horizontal overflow, toolbar separation, internal scrolling, keyboard focus plus viewport containment and center hit-testing for Notebook, Skills, Save, and Settings header actions and each collection action, and reachability of every seeded discovery title and body.

Focused case command: `npx playwright test e2e/lab/notebook-panel-layout.spec.js --grep "200% text scale keeps Notebook content and collection actions reachable at 320x360"`.

Baseline results: the first focused run **failed 1 test** at **Harmonic Calibration** visibility. The action is 114.91px tall while the visible Notebook scrollport is 97px high. Its bounds were y=144.80–259.70 against scrollport y=153.92–250.92: its center is hit-testable, but it extends about 9px above and 8.8px below the visible area. After adding header-action checks, a second 200% run found the focused **Save & Restore** header button hit-testable but extending to x=323.5 in the 320px viewport. The existing six 150% cases passed; the 200% run stopped at this header assertion before collection or discovery checks.

The 200%-only compact header adjustment made the Notebook panel large enough to expose the collection action. Reducing horizontal padding on compact header controls from 6px to 3px kept Save within the viewport. The focused 200% case passed 1/1 in 4.1 seconds. The exact full-spec command, `npx playwright test e2e/lab/notebook-panel-layout.spec.js --reporter=line --workers=1`, passed 7/7 in 16.3 seconds, including the six existing 150% cases and the 200% case with header/collection-action focus and hit testing plus all seeded discovery title/body reachability. Scoped Code Reviewer found no actionable findings. No full suite was run.

## Acceptance criteria

- [x] The 200% text preference is applied in the 320 by 360 Notebook case.
- [x] Panel and page remain within viewport bounds without horizontal overflow; the panel scrolls internally and remains separated from the toolbar.
- [x] Keyboard focus reaches Notebook, Skills, Save, and Settings header actions with each fully inside the viewport and center hit-testable.
- [x] Keyboard traversal reaches every collection action with focus fully visible within the panel and viewport and center hit-testing successful.
- [x] Each seeded recent-discovery title and body is reachable by scrolling.
- [x] Notebook/story content and behavior, collection behavior, and save/progression semantics remain unchanged; the human-playtest/content-expansion gate remains open.
- [x] Scoped review is complete, relevant documentation is updated, and the finalized plan is archived.
