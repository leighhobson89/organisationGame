# Plan: Header Responsive Reflow

**Status:** Complete (2026-11-03). Focused verification passed 11/11, the
production build passed, and reviewer re-review found no actionable findings.

## Finding and goal

At 1084px, the header's default flex row squeezes the Instruments action because
the brand and restoration summary retain minimum widths while all five header
actions resist shrinking. Existing responsive rules switch to horizontally
scrollable actions at 1050px and to mobile stacking at 720px, leaving the
721px to 1340px range without a medium-width reflow. Keep brand and restoration
information on the first row, then place the complete tool navigation on a
full-width second row through 1340px; restore the single-row layout at 1341px.

## Intended behavior

- At widths from 721px through 1340px, the brand and restoration summary remain
  together on the first header row; the full header action navigation occupies
  a second row spanning the header width.
- Preserve compact button styling at widths up to 1050px. Within that band,
  retain the existing horizontally scrollable action treatment where needed,
  now inside the second-row navigation.
- Preserve the existing mobile stacking and horizontal-scroll action treatment
  at 720px and below.
- Preserve the current single-row header at 1440px desktop width.
- Keep the five actions in their existing order with their current labels,
  focus order, keyboard behavior, callbacks, and enabled/pressed states. The
  long active-puzzle action remains reachable and readable.
- Do not change game or save state.

## Implementation boundaries

1. Keep the change to header layout rules in `src/styles/app.css`; preserve the
   existing `App.jsx` header markup and controls.
2. Add a medium-width layout rule that reflows `.game-header` between 721px and
   1340px, keeping the brand/restoration block on row one and `.header-actions`
   on a full-width row two. Keep the single-row layout from 1341px upward.
3. Retain compact `header-control` styling and horizontal scrolling up through
   1050px as required. Preserve the existing mobile layout at 720px and below.
4. Keep the 1440px desktop header on one row. Do not change text, control
   order, focus behavior, interaction callbacks, save data, progression, story,
   or content.
5. Keep the independent human-playtest/content-expansion gate open and
   unchanged.

## Acceptance criteria

- At 721px, 1024px, 1084px, 1280px, 1281px, 1320px, 1321px, and 1340px,
  brand/restoration and action navigation occupy separate rows without overlap
  or clipping; navigation and action bounds stay inside the header.
- At 1341px and 1440px, the header remains in its single-row desktop layout.
- The fixture exposes all five actions, including the long puzzle action, so
  the regression covers the constrained header rather than an empty or short
  state.
- At 390px, all controls remain reachable through the existing mobile
  horizontal-scroll treatment, with labels, focus order, and keyboard
  behavior preserved.
- The layout change leaves game state and saves untouched.

## Test plan

**Status:** Complete. Focused E2E passed 11/11, the production build passed,
and reviewer re-review found no actionable findings. The full suite was not run.

File: `e2e/lab/header-responsive-layout.spec.js`.

```sh
npx playwright test e2e/lab/header-responsive-layout.spec.js --workers=1
```

The fixture exposes all five actions, including the long active-puzzle
button. The regression covers 721px, 1024px, 1084px, 1280px, 1281px, 1320px,
1321px, 1340px, 1341px, 1440px, and 390px. At 721px through 1340px it checks
header/navigation/action geometry and clipping; at 1341px and 1440px it checks
the single-row desktop layout. At 390px it checks all five accessible action
names, preserves `overflow-x: auto`, and allows the content to fit exactly when
`scrollWidth === clientWidth`.

The first test-author attempt was blocked before execution by Playwright
`spawn EPERM`. The corrected original five-viewport baseline had **3/5 failures**
before the CSS fix: at 1084px, 1024px, and 1280px, `toggle-notebook`
overlapped the restoration summary; the 1440px and 390px cases passed. Code
review found no definite CSS defect but identified missing breakpoint-edge
coverage. The 721px
and 1281px edge cases were added; the 1281px run failed because the single-row
header still overlapped. A later expanded run showed 1320px reflow and the
1440px single-row layout passing, while 1321px still overlapped by 6px.
Architect review recommends reflow through 1340px, then a single row from
1341px. The final focused command, `npx playwright test e2e/lab/header-responsive-layout.spec.js --workers=1`, passed 11/11 across the listed viewport matrix. The all-five-action fixture checked bounds, overlap and clipping, mobile overflow configuration, and single-row behavior at 1341px and 1440px. `npm run build` passed with Vite 8.3.5, and reviewer re-review found no actionable findings. The full suite was not run.
