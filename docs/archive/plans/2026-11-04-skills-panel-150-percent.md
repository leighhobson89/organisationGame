# Plan: Skills Panel at 150% Text Scale

**Status:** Complete. The focused Skills-panel coverage passed at both compact viewports; no production or CSS change was needed.

## Goal and boundary

Verify that the Workshop Skills panel remains readable and operable at 150% text scale in 320 × 480 and 390 × 480 viewports. Preserve skill purchase, activation, point accounting, and saved-game behavior. This polish slice does not change authored content or close the independent human-playtest/content-expansion gate.

## Implementation plan

- Extend `e2e/lab/skills-panel-layout.spec.js` with 150% cases at both compact viewports, while retaining its existing default-scale cases.
- Seed the existing version-1 preference envelope with `textScale: 1.5` and the current five-point game fixture before page load.
- Check the applied `--text-scale`, panel bounds within the viewport, panel and page horizontal overflow, and that the Skills panel scrolls internally.
- Starting from the focused **Instruments** control, Tab through **Save & Restore** and **Settings** to the first skill purchase action. Continue with Tab through every purchase action; each focused action must remain fully visible inside the panel and viewport, and traversal must advance the panel's internal scroll position.
- Keep purchase/activation outcomes, disabled activation without a relevant selection, and passive-skill status covered by the existing default-scale cases; the new 150% cases focus on keyboard reachability and layout.
- Change production CSS or behavior only if the focused cases reveal a failure; keep any correction limited to the Skills panel.

## Implementation outcome

- Added two 150% cases in `e2e/lab/skills-panel-layout.spec.js`, at 320 × 480 and 390 × 480, while retaining the default-scale behavior cases.
- The Skills panel fit the viewport, had no horizontal overflow, scrolled internally, and kept each Tab-focused purchase action fully visible through the traversal. No production or CSS change was needed.
- No skill behavior, persistence format, authored content, or unrelated UI surface changed.

## Verification

Focused browser verification:

```sh
npm run test:e2e -- --workers=1 e2e/lab/skills-panel-layout.spec.js
```

The focused spec passed 4/4 after the initial sandbox worker spawn returned `EPERM`; the focused rerun passed. Code Reviewer found no actionable findings. No production/CSS change was needed. The full suite was not run. The independent human-playtest/content-expansion gate remains open.

## Acceptance criteria

- [x] Both compact viewport cases apply 150% text scale and keep the panel within the viewport without horizontal overflow.
- [x] Tab from Instruments through Save & Restore and Settings reaches the first purchase action, then all purchase actions; each full focused bound stays inside the panel and viewport, and internal scroll advances.
- [x] Existing default-scale cases continue to cover skill purchase, activation eligibility, and passive-skill behavior.
- [x] No unrelated content, persistence format, or behavior changes; the independent human-playtest/content-expansion gate remains open.
