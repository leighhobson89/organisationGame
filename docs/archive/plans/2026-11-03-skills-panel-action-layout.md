# Plan: Skills Panel Action Layout

**Status:** Complete (2026-11-03). Implementation, focused verification, and
review are complete. The independent human-playtest/content-expansion gate
remains open and unchanged.

## Goal

Give each skill card a full-width action/status row below its icon and flexible
description, so purchase, activation, and selection guidance remain readable at
desktop and narrow mobile sizes.

## Intended behavior

- In `.skill-card`, `.primary-control` and `.skill-selection-hint` span both
  grid columns with `grid-column: 1 / -1`.
- The existing 42px icon and flexible `.skill-copy` remain the first row.
- Buttons and status hints occupy the full card content width in the following
  row. A selection hint follows its disabled activation button; passive owned
  status keeps the same full-width action-row treatment.
- Existing button text, accessible names, enabled/disabled state,
  `aria-pressed` state, callbacks, and status content remain unchanged.
- At 390 × 480 and 1280 × 720, button and hint bounds remain within their card
  and panel content. Long action text and hints remain visible without
  horizontal clipping.

## Implementation boundaries

1. Make this a stylesheet-only grid placement change for `.skill-card` action
   and status children. Preserve the current `SkillsPanel.jsx` markup.
2. Retain the icon/copy grid columns and current card spacing; do not change
   skill descriptions, labels, unlock/activation logic, or panel behavior.
3. Do not change skill catalog data, ownership, progression, audio, autosave,
   import/export, or the v3 save schema.
4. Keep the scope limited to the skills panel layout. Do not change story,
   authored content, camera, Compass/Lens behavior, or the independent
   human-playtest/content-expansion gate.

## Acceptance criteria

- At 390 × 480 and 1280 × 720, every skill-card action button spans both grid
  columns and stays inside the card's content bounds.
- Every visible action keeps its existing accessible name and state: purchase
  controls retain their disabled condition, and owned active tools retain
  their current `aria-pressed` value.
- Where a selection hint or passive status is present, it appears below the
  action/description row, spans both columns, and remains visible within the
  card bounds.
- Existing callbacks and progression behavior remain unchanged.

## Test plan

**Status:** Focused regression and implementation are complete.

File: `e2e/lab/skills-panel-layout.spec.js`.

```sh
npx playwright test e2e/lab/skills-panel-layout.spec.js
```

The regression seeds five skill points and runs at 390 × 480 and 1280 × 720.
It checks purchase and activation accessible names/states, plus full
content-width geometry for purchase actions, disabled owned activations,
selection hints, and passive installed status. The initial test-agent run was
blocked before tests by Windows Playwright worker `spawn EPERM`. After
permitted worker launch, the focused retry ran both viewport cases and
recorded the expected **2/2 failures** at the right-edge geometry assertion.
The 390px button ended at x=84 instead of the expected card-content edge x=348;
the 1280px button ended at x=1052 instead of x=1232. The current single-column
action placement constrained the controls to the 42px icon column.

After implementation, `npx playwright test e2e/lab/skills-panel-layout.spec.js`
passed 2/2 at 390 × 480 and 1280 × 720. It verifies full card-content width
for purchase and activation actions, selection hints, and passive installed
status, while preserving accessible names and states. `npm run build` passed
with Vite 8.3.5, and Code Reviewer found no actionable findings. The full test
suite was not run. The independent human-playtest/content-expansion gate
remains open.
