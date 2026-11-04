# Plan: Compact Panels at 400px and 150% Text Scale

**Status:** Complete (2026-11-04). The scoped CSS changes and focused E2E verification are complete. Code Review's P3 compact-search coverage finding was addressed in the [follow-up plan](2026-11-04-compact-finder-search-filter.md); review found no actionable CSS or layout issues.

## Goal and boundary

Validate the five existing compact UI surfaces at the supported 400px shell height and 150% text scale, at both 320px and 390px viewport widths:

- Settings: `e2e/lab/preferences.spec.js`
- Save & Restore: `e2e/lab/manual-saves.spec.js`
- Instruments: `e2e/lab/skills-panel-layout.spec.js`
- Notebook: `e2e/lab/notebook-panel-layout.spec.js`
- Item Finder: `e2e/lab/item-finder-layout.spec.js`

Keep this work limited to those five surfaces at 320x400 and 390x400. Preserve their existing focus, preference, restore, search, notebook, and skill flows. Do not change authored content, save format, game behavior, or the independent human-playtest/content-expansion gate.

## Surface-specific coverage

| Surface | Focused 400px coverage |
| --- | --- |
| Settings | Traverse Text size, Reduce motion, Sound effects, and Preview by keyboard. Keep Close and Done pinned and usable while settings content scrolls internally; preserve preference selection and persistence. |
| Save & Restore | Traverse save slots, Export, Import, and acknowledgement controls; exercise restore confirmation and focus return while keeping the surface shell in bounds. |
| Instruments | Traverse every skill action by keyboard while internal scrolling advances; retain existing skill availability and activation behavior. |
| Notebook | Traverse every collection action by keyboard through internal scrolling; keep existing Notebook content/discoveries reachable. |
| Item Finder | Cover search, first and last result, Next page, internal shell/results scrolling, pagination, and Atlas/toolbar clearance. Keep search focus and result/pagination actions visible and hit-testable. |

The main shell-size risk is Item Finder: its existing short-height `max-height: min(40%, calc(100% - 224px))` can leave only about 57 to 74px of Finder height at 400px, depending on viewport width. Measure its shell and inner scrollports in the red baseline before choosing any CSS adjustment.

## Implementation plan

- First capture the red baseline for both viewport widths and 150% text scale in every dedicated spec. Record each panel shell's bounds, document horizontal overflow, content scrollport dimensions and scroll movement, and focused-action bounds/hit testing.
- Add focused cases to the five named specs. Assert the surface shell and its visible controls remain within the viewport; content scrolls internally; keyboard-focused actions remain fully visible and hit-testable; and the document does not overflow horizontally.
- Retain the surface-specific end-to-end flows above: Settings preference selection/persistence, Save & Restore slot/export/import/acknowledgement and confirmation/focus behavior, every Instruments and Notebook action, and Item Finder search/results/pagination plus Atlas/toolbar clearance.
- For Item Finder at 320x400 and 390x400, keep the search field and Close control simultaneously visible inside the Finder shell when it opens. While Finder is open, constrain the world toolbar to a horizontally scrollable row no taller than 48px, with 38px targets, leaving at least 10px between Finder and toolbar. Preserve intended search focus, toolbar-control focus as the rail scrolls, and existing behavior at 480px and above.
- Make a localized CSS-only adjustment for a surface only when its red baseline demonstrates a layout or scroll/focus-visibility failure. Preserve existing component behavior and unaffected viewport layouts.

## Focused regression plan

The unchanged-source baseline for the five-spec aggregate completed with 29/31 checks passing. Settings, Save & Restore, Instruments, and Notebook passed at both sizes. Only Item Finder failed, where the Atlas toggle overlaps the Finder close button at both viewport widths. Its measured geometry is:

| Viewport | Finder shell bounds and size | Atlas toggle bounds | Close button bounds | Shell scroll/client height | Toolbar clearance |
| --- | --- | --- | --- | --- | ---: |
| 320x400 | x=10-310, y=177.44-234; 300x56.56px | x=10-71.95, y=129.44-167.44 | x=20-52, y=107.38-139.38 | 361/57px | 66px |
| 390x400 | x=10-380, y=160.66-234; 370x73.34px | x=10-71.95, y=112.66-150.66 | x=20-52, y=99.59-131.59 | 361/73px | 20px |

Retain these measurements with the regression results. Fix the Item Finder overlap only after its red baseline demonstrates the failure; preserve the passing baseline for the other four panels and avoid unrelated CSS changes.

The targeted Finder-open red assertions confirm that search autofocus scrolls Close outside the Finder shell at both widths. The open-state toolbar also exceeds the planned height and has no horizontal scrollport. The document has no horizontal overflow, and keyboard-focused toolbar controls remain visible and hit-testable.

| Viewport | Finder shell | Close after search autofocus | Shell scrollTop | Toolbar bounds/height | Toolbar overflow-x and scrollWidth/clientWidth |
| --- | --- | --- | ---: | --- | --- |
| 320x400 | y=177.44-234 | y=90.44-122.44, outside shell | 97px | y=300-390, 90px | visible; 298/298px |
| 390x400 | y=160.66-234 | y=82.66-114.66, outside shell | 88px | y=254-390, 136px | visible; 368/368px |

The focused red assertions also verify no document-level horizontal overflow and visible, hit-testable keyboard focus on toolbar controls. The implementation should keep search and Close simultaneously visible in the Finder shell, limit the open-state toolbar to a horizontally scrollable row no taller than 48px with 38px targets, preserve at least 10px of Finder-to-toolbar clearance, retain intended search/toolbar focus behavior, and leave 480px-and-above behavior unchanged.

Final implementation uses a Finder shell with `top: 58px` and `bottom: 64px` from 400px through 439px. Its world toolbar is a 44px horizontal rail with 38px targets and 10px Finder-to-toolbar clearance. Save & Restore's textarea has an 85px minimum height at narrow 400px through 480px widths. These scoped CSS adjustments address the red-baseline failures while preserving the other four panels' passing geometry.

The original focused five-spec E2E command passed 31/31 at 320x400 and 390x400 with 150% text scale. The separate Item Finder search-filter follow-up passed 4/4 and is recorded in `2026-11-04-compact-finder-search-filter.md`; review found no actionable CSS/layout or Save textarea issues. These are separate runs, not a combined rerun. The full suite was not run, and the independent human-playtest/content-expansion gate remains open.

Run only these focused E2E specs during this slice:

```powershell
npx playwright test e2e/lab/preferences.spec.js e2e/lab/manual-saves.spec.js e2e/lab/skills-panel-layout.spec.js e2e/lab/notebook-panel-layout.spec.js e2e/lab/item-finder-layout.spec.js --workers=1
```

Do not run the full suite without user approval.

## Acceptance criteria

- [x] Each of the five dedicated specs covers both 320x400 and 390x400 at 150% text scale.
- [x] Each surface shell and its controls remain within the viewport, and the page has no horizontal overflow.
- [x] Each surface's content scrolls internally where needed, while its shell and key actions remain usable.
- [x] Keyboard focus reaches the existing actions; each focused action is fully visible and hit-testable.
- [x] Existing preference, save/restore, skill, Notebook, and Item Finder flows remain intact.
- [x] At 320x400 and 390x400, Finder opens with the search field and Close simultaneously visible inside its shell; the open-state toolbar is horizontally scrollable, no taller than 48px, has 38px targets, and clears Finder by at least 10px.
- [x] Finder search focus and toolbar-control focus remain usable through horizontal scrolling, and existing 480px-and-above behavior is unchanged.
- [x] Save & Restore's text area retains an 85px minimum height at narrow 400px through 480px widths.
- [x] Any CSS change is limited to a failure demonstrated by the red baseline; no authored content, persistence format, or unrelated UI behavior changes.
- [x] Focused E2E checks pass, relevant documentation is updated, and the finalized plan is archived in `docs/archive/plans/` with `docs/plans/` containing only the other active browser-scaling/playtest plan. The full suite was not run.
