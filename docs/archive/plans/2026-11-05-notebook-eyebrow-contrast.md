# Plan: Improve Notebook Eyebrow Contrast

## Goal

Raise the contrast of the notebook panel eyebrow text to at least 4.5:1 against the parchment surface.

## Scope and constraints

- Change only `.notebook-panel .eyebrow` in `src/styles/app.css`, replacing `#8d6839` with `var(--ink-700)` (`#54402a`).
- Preserve all other colors, layout, typography, and copy.
- Keep the active browser scaling and human playtest gate unchanged.

## Verification

- Add a focused regression to `e2e/lab/notebook-panel-layout.spec.js` that reads the computed eyebrow foreground and checks WCAG contrast against the parchment endpoint `--parchment-200` (`#ead9b5`) is at least 4.5:1.
- Run the focused notebook panel spec and `git diff --check`; do not run the full test suite.

## Test plan

- Focused command: `npm run test:e2e -- e2e/lab/notebook-panel-layout.spec.js`.
- Baseline regression result: failed as intended; the computed foreground measured 3.62:1 against `#ead9b5`, below the 4.5:1 requirement.

## Result

- Baseline contrast was 3.62:1. After changing `.notebook-panel .eyebrow` to `var(--ink-700)`, the focused contrast case passed 1/1 and `npx playwright test e2e/lab/notebook-panel-layout.spec.js` passed 8/8.
- `git diff --check` found no whitespace errors; only LF-to-CRLF notices were reported.
- Scoped Code Reviewer found no actionable findings. The full suite was not run.
- The active browser-scaling and human-playtest gate remains open.
