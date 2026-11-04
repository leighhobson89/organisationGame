# Plan: Compact Inspector and World Toolbar Below 480px

**Status:** Complete (2026-11-04). The short-height Inspector/toolbar layout and focused verification are complete; the independent playtest/content-expansion gate remains open under the separate browser-scaling plan.

## Goal and boundary

Keep the Inspector's essential actions and world controls usable on supported compact viewports from 400px through 479px high. The game's existing 400px shell minimum remains the lower supported height. Preserve the current 480 to 520px layout and all desktop behavior.

## Implementation plan

- From 400px through 479px, reserve a 44px single-row world-toolbar lane above the Inspector. Keep toolbar controls at least 38px high and allow horizontal scrolling when the row does not fit. Ensure controls remain reachable and focused controls scroll into view for keyboard and touch users.
- From 400px through 439px, compact the game header only while the Inspector is open. Hide the kicker that is already omitted in compact layouts, reduce title/progress-dial size, and tighten header padding, gaps, and navigation controls to recover approximately 40 to 50px of vertical space. Keep the toolbar and Inspector simultaneously visible: place the Inspector below the toolbar and leave an 8px bottom margin. At 150% text scale, retain at least 48px of Inspector details height.
- When a header navigation control receives programmatic focus, minimally scroll its existing navigation scroller to reveal that control. Preserve current focus order, navigation behavior, and other header scrolling behavior.
- From 440px through 479px, use the same single-row toolbar rail without the short-height header compaction.
- Keep the existing compact-toast layer above the world toolbar but below the Inspector. Ensure the toolbar remains operable when a toast is shown.
- At 400px through 479px, keep the group-selection count inline in the same 44px horizontally scrolling toolbar row as the controls. The third vertical count row remains limited to 480px through 520px, where the established layout is unchanged.
- Recalculate the appropriate layout when the viewport crosses the 400px, 440px, and 480px thresholds, without losing the selected item/group or leaving focus in hidden content.

## Focused regression plan

The red baseline has now been captured before implementation. It confirms toolbar/Inspector overlap at short heights and records these measurements:

| Case | Inspector vertical bounds | Toolbar | Overlap | Bottom inset | Details height |
| --- | --- | --- | ---: | ---: | ---: |
| 320x400, 125%, single item | y=101-334 | y=300-390, 90px | 34px | 66px | 62px |
| 320x400, 150%, single item | y=119.4-334 | y=300-390, 90px | 34px | 66px | 2px |
| 320x440, 150%, single item | not reported | 90px | 34px | not reported | 42px |
| 390x440, 150%, single item | not reported | 136px | 80px | not reported | 78px |
| 320x400, 150%, group selection | not reported | 119px | 63px | not reported | 71px |

The direct header geometry checks recorded `.game-header` height as 101px at 320x400/125% and 119.44px at 320x400/150%; the Inspector begins at those same vertical positions. The unchanged-CSS red run passed the 5 existing checks and failed the 10 new short-height checks, confirming the new coverage exposes the baseline layout problem.

`e2e/lab/inspector-panel-layout.spec.js` already contains focused E2E coverage for this header navigation focus-scroll behavior: it programmatically focuses Notebook, Instruments, Save and restore, and Settings, then checks that each focused control remains within the viewport and hit-testable. This coverage is part of the focused Inspector-layout run below. The file also covers 320x400, 320x440, and 390x440 at 125% and 150% text scale. The regression checks direct header/title geometry and header navigation controls; single-item and group selection; the inline group count in the same 44px toolbar row at 400px through 479px; a 44px toolbar rail with 38px targets; keyboard focus auto-scroll and touch swipe; available and scrollable details space; resize checkpoints at 400, 430, 440, 479, and 480px; and compact-toast stacking and hit testing. Assert the Inspector remains below the toolbar with an 8px bottom margin, 150% details retain at least 48px, focused controls remain visible and operable, content does not cause document-level horizontal overflow, and no toolbar/Inspector collision blocks interaction. Retain existing 480px assertions, including the third vertical count row, to guard the established layout.

Run focused checks only; do not run the full suite without user approval:

```powershell
npx playwright test e2e/lab/inspector-panel-layout.spec.js --workers=1
npx playwright test e2e/lab/inspector-panel-layout.spec.js e2e/lab/mobile-toolbar.spec.js e2e/lab/panel-coordination.spec.js --workers=1
```

## Acceptance criteria

- [x] At 400 to 479px, the toolbar occupies a non-overlapping 44px row with 38px targets; the group-selection count remains inline in that row, and horizontally clipped controls remain keyboard- and touch-accessible.
- [x] At 400 to 439px with the Inspector open, the compact header recovers at least 35px, the Inspector stays below the toolbar with an 8px bottom margin, and 150% details retain at least 48px.
- [x] Programmatic focus on header navigation controls scrolls the existing nav scroller enough to make the focused control visible, without changing focus order or other header behavior.
- [x] Single and group selection, selected details, toolbar focus/scrolling, and toast layering remain usable at the specified text scales and viewport sizes.
- [x] Resizing across the short-height thresholds preserves the selection and restores an appropriate visible focus target; the established 480 to 520px layout continues to pass unchanged.
- [x] Focused regressions pass and project documentation is updated. The finalized plan is archived in `docs/archive/plans/`; `docs/plans/` retains the separate active browser-scaling/playtest gate. The full suite was not run.

## Verification and review

The unchanged-CSS red baseline passed 5 existing checks and failed 10 new short-height checks. After implementation, the focused Inspector spec passed 15/15 and the combined Inspector, mobile-toolbar, and panel-coordination run passed 44/44. The initial sandbox worker spawn returned Windows `EPERM`; rerunning the focused checks with process access succeeded. Code Reviewer found no actionable findings. The full test suite was not run, and the independent playtest/content-expansion gate remains open.
