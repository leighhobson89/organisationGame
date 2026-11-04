# Plan: Compact Notebook at 320×360

**Status:** Complete. CSS-only responsive polish is focused-verified and reviewed; the independent human playthrough gate in `browser-scaling-playtest-gate.md` remains active.

## Goal and boundary

At a 320×360 viewport with 150% text scaling, the Notebook panel spans y=129.44–278.58 and overlaps the toolbar (y=260–350) by 18.58px. Its heading ends 0.39px below the panel. Keep the Notebook title visible and leave at least 8px between the panel and toolbar while preserving access to all Notebook content.

Limit the fix to a short viewport rule for widths up to 360px and heights from 360px through 399px. Compact Notebook padding and heading spacing/size; hiding its redundant eyebrow is allowed. Keep vertical scrolling enabled. Do not change other panels, content, or save data. Preserve the current layout at 320×400 and 320×480.

## Implementation and verification

The focused regression covers 320×360 and 360×399 at 150% text scaling. The confirmed red baseline is:

```text
npm run test:e2e -- --workers=1 e2e/lab/notebook-panel-layout.spec.js --grep "320x360|360x399"
```

Both baseline cases failed at the panel-to-toolbar clearance assertion. After implementation, the focused `npm run test:e2e -- --workers=1 e2e/lab/notebook-panel-layout.spec.js` run passed 6/6, including both new viewports and existing 320×400, 390×400, 320×480, and 390×480 cases. The new cases confirm the full title remains visible and the panel clears the toolbar by at least 8px without page overflow. Internal scrolling retains keyboard access to all four collection actions and all five existing discoveries. Code Reviewer found no actionable issues.

No build or full suite was run. Archive this finalized plan as `docs/archive/plans/2026-11-04-notebook-panel-compact-360.md`; leave `browser-scaling-playtest-gate.md` active. Independent human playtesting remains deferred and content expansion stays gated.
