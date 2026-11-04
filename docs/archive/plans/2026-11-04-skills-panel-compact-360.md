# Plan: Workshop Skills Panel at 320×360

**Status:** Complete. Compact responsive polish is focused-verified and reviewed; the independent human playthrough gate in `browser-scaling-playtest-gate.md` remains active.

## Goal and boundary

At 320×360 with 150% text scaling, the Skills panel spans y=129.44–278.58 and overlaps the toolbar (y=260–350) by 18.58px; its heading reaches 0.39px below the panel. Keep the panel title and points badge visible and leave at least 8px between the panel and toolbar.

Scope the CSS change to the Skills panel at widths up to 360px and heights from 360px through 399px. Compact panel padding and heading spacing/size, and hide the redundant eyebrow. Preserve vertical scrolling, all skill actions and selection hints, and avoid page overflow. Do not change other panels, skill behavior, content, or saves. Preserve behavior at 320×400, 390×400, 320×480, and 390×480.

## Implementation and verification

Focused cases cover 320×360 and 360×399 at 150% text. The confirmed red baseline is:

```text
npm run test:e2e -- --workers=1 e2e/lab/skills-panel-layout.spec.js --grep "320x360|360x399"
```

Both baseline cases failed the 8px toolbar-clearance check: 320×360 overlapped the toolbar by 18.58px, while 360×399 had only 2.625px clearance. After implementation, `npm run test:e2e -- --workers=1 e2e/lab/skills-panel-layout.spec.js` passed 8/8, including the two new cases, existing 320/390×400 and 320/390×480 layouts, and 390×480/1280×720 card-action cases. The new cases verify the title and points badge remain visible, the panel clears the toolbar by at least 8px, and the page has no horizontal overflow. Existing internal scrolling, keyboard access to all skill actions, selection hints, and passive-skill status remain covered. Code Reviewer found no actionable issues.

No build or full suite was run. Archive this finalized plan as `docs/archive/plans/2026-11-04-skills-panel-compact-360.md`; leave `browser-scaling-playtest-gate.md` active. Independent human playtesting remains deferred and content expansion stays gated.
