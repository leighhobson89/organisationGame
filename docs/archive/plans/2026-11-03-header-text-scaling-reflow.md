# Plan: Header Text Scaling Reflow

**Status:** Complete (2026-11-03). Focused verification passed 13/13, the
production build passed, and reviewer re-review found no actionable findings.

## Finding and goal

The root font size increases rem-based header labels by 25% when text scaling is
set to 125%. Above 1340px, the header returns to a nowrap layout. The
`.header-actions` region can shrink while its child buttons keep their minimum
content width, so scaled action labels can intrude into the restoration
summary.

Preserve the current 100% header layout: one row at 1341px and 1440px, and two
rows from 721px through 1340px. At 125% text scale, keep every header action
visible, readable, within bounds, unclipped, and separate from the restoration
summary at 1341px and 1440px. Let the action navigation reflow intrinsically as
needed; do not shrink or hide button text.

## Intended behavior

- At 100% text scale, preserve the existing one-row layout at 1341px and
  1440px, and the existing two-row layout from 721px through 1340px.
- At 125% text scale and 1341px or 1440px, all five actions fit within the
  header without overlapping the restoration summary, clipping, or hiding
  labels. The action navigation may wrap its contents when necessary.
- Preserve the existing mobile header at 720px and below.
- Keep action order, accessible names, focus and keyboard behavior, callbacks,
  and enabled/pressed states unchanged.
- Do not change game or save behavior. Text-scale preference seeding is test
  setup only.

## Implementation boundaries

1. Keep the change focused on header/action layout and intrinsic navigation
   sizing. Preserve header markup and all five controls.
2. Keep the normal-scale breakpoints and row behavior unchanged: 721px through
   1340px uses two header rows; 1341px and 1440px use one header row.
3. Let the action navigation accommodate scaled labels by wrapping or otherwise
   reflowing its contents. Do not reduce font size, truncate or hide labels, or
   let actions overlap the restoration summary or escape the header.
4. Preserve the existing mobile layout at 720px and below.
5. Preserve game state, save schema, progression, item content, and the
   independent human-playtest/content-expansion gate.

## Acceptance criteria

- With text scale at 100%, the header remains one row at 1341px and 1440px.
- With text scale at 100%, the existing two-row layout remains at 721px
  through 1340px.
- With text scale at 125%, the all-five-action fixture at 1341px and 1440px
  shows all actions and labels within the header and action-navigation bounds,
  without overlap with the restoration summary or clipping.
- At 125%, action labels retain their normal text size and remain available to
  sighted and assistive-technology users; intrinsic navigation reflow is
  allowed.
- The mobile layout at 720px and below remains intact, and the change does not
  modify game or save state.

## Test plan

**Status:** Complete. The focused E2E passed 13/13, the production build
passed, reviewer re-review found no actionable findings, and the full suite was
not run.

File: `e2e/lab/header-responsive-layout.spec.js`.

```sh
npx playwright test e2e/lab/header-responsive-layout.spec.js --workers=1
```

The regression uses the existing all-five-action header fixture. Seed
preferences with
`{version:1,textScale:1.25,reduceMotion:false,soundEffectsEnabled:false}` and
cover 1341px and 1440px at 125% text scale. Also preserve the 100% single-row
checks at 1341px and 1440px. The existing responsive-header checks cover the
721px through 1340px and mobile behavior.

The focused test verifies all five accessible action names, action bounds, no
overlap with the restoration summary, no clipping, and intrinsic action-nav
reflow at 125%; at 100%, it verifies the existing one-row layout. The test
author's initial attempt was blocked before execution by Playwright
`spawn EPERM`. The red baseline retry ran 13 cases: **11/13 passed**; only
the 125% cases at 1341px and 1440px failed because `toggle-notebook`
overlapped the scaled restoration summary. All default-scale viewport cases
and 390px mobile passed. The final focused run passed **13/13**, including
the corrected 125% cases and unchanged 100% single-row layout at 1341px
and 1440px. `npm run build` passed with Vite 8.3.5, and reviewer re-review
found no actionable findings. The full suite was not run.
