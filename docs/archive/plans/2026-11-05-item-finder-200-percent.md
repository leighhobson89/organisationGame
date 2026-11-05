# Plan: Item Finder at 200% Text Scale

**Status:** Finalized; scoped review found no blocking findings.

## Goal and rationale

Verify Item Finder remains readable and operable at 200% text scale in the worst-case compact 320 by 360 viewport. Extend the current six-case 150% coverage with one high-scale case that exercises its complete keyboard, search, paging, and selection flow.

## Scope and constraints

- Parameterize the existing `seedGame` helper with a `textScale` option defaulting to 1.5; seed `2` for one 320 by 360 case.
- Verify scale 2 is applied; Close and Search autofocus are visible on open and focus-visible; Finder and page remain within viewport bounds without horizontal overflow.
- Verify the Finder shell and results list remain independently scrollable, Finder clears the bottom toolbar by at least 10px, and neither world-jump nor the Atlas toggle overlaps the Finder or its essential controls.
- Verify the compact toolbar fits its row bounds, scrolls horizontally where needed without page overflow, and each focused toolbar control remains fully inside the `.header-actions` client scrollport and viewport and center hit-testable. Confirm `scrollLeft` advances as keyboard traversal exposes controls that were initially clipped. Verify the brand title stays fully visible inside the header and viewport, without vertical clipping.
- Traverse by keyboard through Close, Search, result items, and Next page. Verify each focused control remains visible and hit-testable in its relevant scroll area, and that both shell and results scroll positions advance.
- Press Enter on Next page and verify page advancement. Search for a query that narrows the seeded results and verify the matching count, reset page, and ordered result IDs. Select a result and verify it opens the Inspector.
- Preserve Item Finder filtering, paging, selection, and dismissal behavior and all six existing 150% cases. Make compact Finder styling changes only if the focused regression demonstrates a layout defect.
- Run only the focused Item Finder spec; do not run the full suite. Keep the independent human-playtest/content-expansion gate unchanged.

## Implementation approach

1. Parameterize `seedGame(page, { textScale = 1.5 })` and add one 200%/320 by 360 case to `e2e/lab/item-finder-layout.spec.js`.
2. Reuse the existing Finder panel, toolbar, focus visibility/hit-testing, independent-scroll, filtering, and pagination assertions; extend the journey through result selection into Inspector.
3. Strengthen the compact-toolbar checks to assert full containment of focused controls in the `.header-actions` client scrollport and verify horizontal `scrollLeft` progression during keyboard traversal.
4. Add `.world-item-finder` to the existing 200%-compact header matching, including the nested Finder case. Tighten header, label, and input line-height at 200% compact so Close remains visible after Search autofocus while preserving 200% font sizing. Widen the Finder-specific action area so Save fits its scrollport, and adjust only the Finder-specific title typography to keep the full brand title visible without truncation or vertical clipping. The final layout uses 16.64px title text with 17.47px line-height on two lines within the 48px header; the Finder-only kicker is hidden while body and search retain 200% sizing.
5. Run only the focused Finder spec, complete scoped review, update relevant documentation, and archive the finalized plan after review.

## Test plan

The Test Engineer added `200% Item Finder controls remain visible and keyboard-reachable at 320x360` in `e2e/lab/item-finder-layout.spec.js`. It uses the 200% seeded state at 320x360 and checks Finder entry, layout/toolbar constraints, independent scrolling, keyboard focus visibility and hit-testing, pagination/search, and selection into Inspector.

Focused command: `npx playwright test e2e/lab/item-finder-layout.spec.js --grep "200% Item Finder controls remain visible and keyboard-reachable at 320x360"`.

Baseline result: **1 failed; no EPERM.** Search autofocus succeeded, but Close was offscreen on open. Finder bounds were x=10–310, y=148.61–296; Close bounds were x=268–300, y=−34.39 to −2.39; Search bounds were x=20–300, y=191.11–252.61; the Finder shell had `scrollTop=193`. No source edits had been made for the baseline.

After adding focused header-control checks, a second baseline had two soft geometry failures: Close remained at y=−34.39 to −2.39 while the Finder shell was y=148.61–296 with `scrollTop=193`, and the focused Save header action extended from x=177.91 to x=323.5, 3.5px beyond the 320px viewport. The other header controls passed. There was no `EPERM` and no source/CSS edits had been made.

After adding focused header-control checks, the strengthened header-scrollport assertion exposed a third issue: Save was 139.6px wide, but the `.header-actions` client width was 122px. After Tab, Save spanned x=180.91–320.5 while the scrollport spanned x=190–312 (`scrollLeft=229`), so it was viewport-contained and hit-testable but did not fit its own scroller. The Finder-specific action area was widened. The new brand containment check then exposed a side effect at the 130px brand basis: the `h1` spans y=−17.30 to 64.31 (82px high) while its header spans y=0 to 47; the title wraps to three lines and is vertically clipped. The CSS specialist is adjusting only Finder-specific title typography to fit the full title without truncation.

After the compact 200% header adjustment, the focused 200% case passed 1/1. The strengthened case checks the full brand title, keyboard focus visibility and center hit-testing, and full containment inside the header action scrollport while horizontal scrolling reveals controls. Final title bounds are y=6.03–40.97 within the 48px header; the title uses 16.64px text and 17.47px line-height across two lines. The Finder-only kicker is hidden, while Finder body and search retain 200% sizing. The `.header-actions` scrollport is x=172–312 (140px wide), and Save is x=171.91–311.50, fully contained.

The focused 200% case passed 1/1. The full focused spec command, `npx playwright test e2e/lab/item-finder-layout.spec.js --reporter=line --workers=1`, passed 7/7 in 18.4 seconds, including the six existing 150% cases. The earlier CSS specialist targeted run passed with process access; the first sandbox full-spec run returned `spawn EPERM`, and the process-access rerun passed. The strengthened final run passed. Scoped review found no blocking findings and accepted the Finder-specific title treatment as an intentional compact-header exception. No full test suite has been run.

## Acceptance criteria

- [x] The 200% preference is applied in the 320 by 360 Finder case; Close and Search remain visible on open and Search receives focus.
- [x] Finder/page bounds and horizontal overflow pass; shell and results scroll independently; Finder has at least 10px toolbar clearance and no overlap with world-jump or Atlas toggle.
- [x] Compact toolbar geometry and horizontal scrolling pass; focused controls stay inside the `.header-actions` client scrollport and viewport, are center hit-testable, and keyboard traversal advances `scrollLeft` when needed. The brand title stays fully visible inside the header and viewport without vertical clipping.
- [x] Keyboard traversal reaches Close, Search, results, and Next page with focus visible and hit-testable in the relevant scroll areas, and both shell/results scrolling advance.
- [x] Enter advances the page; searching verifies narrowed count, Page 1 reset, and result IDs; selecting a result opens the Inspector.
- [x] All six existing 150% cases and Finder semantics remain unchanged; the independent human-playtest/content-expansion gate remains open.
- [x] The strengthened focused regression passes, scoped review is complete, relevant documentation is updated, and the finalized plan is archived.
