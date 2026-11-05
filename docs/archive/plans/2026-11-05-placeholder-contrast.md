# Plan: Placeholder Text Contrast

**Status:** Finalized; focused regressions and build passed, scoped review found no actionable findings.

## Goal and scope

Raise placeholder-text contrast to at least 4.5:1 for the Item Finder search field and shared panel / Save & Restore fields. Initial spot measurements were 3.43:1 for Save & Restore fields due to opacity `.8` on `#f3e6c5`, and 4.37:1 for Finder at the gradient endpoint due to opacity `.9`. The regression helper sampled all gradient stops and measured a 3.79:1 Finder minimum and 3.44:1 for Save & Restore. The proposed `#655137` at opacity 1 clears 4.5:1.

Limit CSS changes to the Finder placeholder and shared panel/Save & Restore placeholder rules in `src/styles/app.css`. Preserve backgrounds, copy, field sizing, and layout. Keep the independent human-playtest/content-expansion gate unchanged.

The focused CSS change sets both placeholder targets to `color: #655137` at opacity 1. Backgrounds, copy, field sizing, and layout remain unchanged.

## Approach

1. Have the Test Engineer add focused contrast regressions for Item Finder and Save & Restore.
2. Adjust only the relevant placeholder color/opacity declarations to reach at least 4.5:1 at their respective backgrounds, preserving surrounding presentation.
3. Run the focused Item Finder and manual-saves E2E specs, then obtain scoped review.

## Test plan

The Test Engineer added two focused regressions:

- `Item Finder placeholder contrast meets WCAG AA at every gradient stop` in `e2e/lab/item-finder-layout.spec.js`.
- `Save & Restore placeholder contrast meets WCAG AA` in `e2e/lab/manual-saves.spec.js`.

Focused commands:

- `npm run test:e2e -- --workers=1 e2e/lab/item-finder-layout.spec.js --grep "Item Finder placeholder contrast meets WCAG AA at every gradient stop"`
- `npm run test:e2e -- --workers=1 e2e/lab/manual-saves.spec.js --grep "Save & Restore placeholder contrast meets WCAG AA"`

Both regressions failed at the intended pre-implementation baseline. Finder minimum contrast across its gradient stops was **3.79:1**; Save & Restore placeholder contrast was **3.44:1**. Both are below the 4.5:1 target.

After setting the Finder and shared panel/Save & Restore placeholder color to `#655137` at opacity 1, the focused contrast cases passed **2/2**. The full focused Item Finder and manual-saves specs passed **17/17**. `npm run build` passed with Vite 8.3.5 (59 modules). Scoped Code Reviewer found no actionable findings. Scoped `git diff --check` was clean except for expected CRLF notices. No full suite was run; the independent human-playtest/content-expansion gate remains open.

## Acceptance

- [x] Finder and shared panel/Save & Restore placeholders each meet at least 4.5:1 contrast.
- [x] Focused Item Finder and manual-saves E2E checks pass; scoped review found no actionable issue.
- [x] Backgrounds, copy, field sizing, and layout are preserved; the independent human-playtest/content-expansion gate remains active.
