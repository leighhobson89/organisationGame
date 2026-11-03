# Compact layout at scaled text size

**Status:** Complete. Compact 125% text scaling and toast-layering polish passed the focused related browser checks and final review. The independent human-playtest/content-expansion gate remains open per the user's deferral.

## Purpose

Persistent 125% text scaling is covered in desktop header tests, while phone-sized toolbar tests use the default scale. Verify the combined setting at 320×480 and 390×480.

## Scope

- Exercise the persistent 125% text-scale preference at both phone-sized viewports.
- Check header controls remain reachable and labels are not clipped.
- Check the world toolbar, first-action hint, and selection toast stay within the viewport and do not overlap.
- Preserve default-scale mobile behavior, desktop layout, and preference/save separation.

## Acceptance and verification

- Focused browser regressions confirm every header action is reachable, all labels fit, and the toolbar, hint, and selection toast remain in bounds without overlap at both sizes.
- Test Engineer added four focused regressions: mobile toolbar/hint/toast geometry at 320×480 and 390×480, plus 125%-scale header action reachability at both widths.
- The red baseline fails all four new tests. At 320px, the first Notebook button begins at x=-299 while the navigation starts near x=12; at 390px, the button begins at x=-229. At 320×480 the first-action hint overlaps the toolbar in the normal state, and the hint, selection toast, and toolbar overlap during selection. At 390×480, the selection toast overlaps both the hint and toolbar.
- Implementation ran in parallel with this plan update. The mobile header scroll now starts from the first action; a content-driven stack keeps the toolbar, hint, and toast in bounds; the toast layers below compact panels and clears when Atlas or Finder opens.
- Review follow-up: the portaled selection/action toast initially used z-index 35 while compact Inspector panels use z-index 20, allowing the toast to cover Inspector text. Both 320×480 and 390×480 cases failed at baseline. The final behavior layers the toast below compact panels while retaining its live status semantics; selecting an item in multi-selection opens Inspector with the toast below it at both sizes.
- Second review follow-up: a pending toast could also cover the Clockwork Atlas (z-index 28) or Finder (z-index 24) on compact screens because those overlays are inside the world viewport's z-index 0 stacking context. The red baseline showed each overlay opened successfully while the old multi-selection toast remained visible at 320×480 and 390×480. The final behavior clears the stale visual status when either overlay opens.
- `npx playwright test e2e/lab/mobile-toolbar.spec.js e2e/lab/header-responsive-layout.spec.js e2e/lab/world-atlas.spec.js e2e/lab/panel-coordination.spec.js e2e/lab/touch-navigation.spec.js e2e/lab/world-input-guidance.spec.js e2e/lab/first-action-guidance.spec.js --workers=1` passed 66/66.
- `npm run build` passed with Vite 8.3.5 (59 modules). Code Reviewer final pass found no actionable issues. `git diff --check` found no whitespace errors, only expected LF-to-CRLF notices for modified source/test files.
- The full suite was not run per `AGENTS.md`. Relevant testing, vertical-slice, and roadmap documentation has been updated; archive this finalized plan while keeping the deferred browser-scaling/playtest gate as the only active plan.
- Do not run the full suite without user approval. Keep the deferred browser-scaling/playtest gate open.
