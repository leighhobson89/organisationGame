# Plan: Desktop Header at 150% Text Scale

**Status:** Complete. Wide-desktop header layout is focused-verified at 150% with no source CSS change needed.

## Goal and boundary

Verify the desktop laboratory header remains readable and separated at the largest built-in text scale. Cover the existing 1341×900 and 1440×900 wide-header cases at 150%, retaining the 125% cases and current 100% row behavior. This is a focused layout-verification slice; the human-playtest/content-expansion gate remains open.

## Proposed implementation

- Extend `e2e/lab/header-responsive-layout.spec.js` with 150% preference fixtures for the existing wide-desktop viewport cases.
- Reuse `assertScaledHeaderGeometry` for bounds, label clipping, and overlap checks, and add an explicit brand-to-navigation separation assertion.
- Change header CSS only if the focused regression reproduces a layout defect, preserving the existing 125% and 100% behavior.

## Test plan and baseline

Extend `e2e/lab/header-responsive-layout.spec.js` to run the existing `assertScaledHeaderGeometry` helper at 125% and 150% for both 1341×900 and 1440×900. The helper checks header and navigation bounds, label clipping, action-to-summary separation, and action-to-action overlap; new assertions also check brand-to-navigation and brand-to-action separation.

Focused command:

```sh
npm run test:e2e -- --workers=1 e2e/lab/header-responsive-layout.spec.js
```

The regression passed 19/19 with both new 150% wide-desktop cases and the existing 125% cases. The baseline 150% layout passes; no source CSS change is expected unless review identifies a specific issue.

## Scope and constraints

- Viewports: 1341×900 and 1440×900.
- Retain existing 125% checks and 100% single-row checks.
- Preserve header action order, labels, accessible names, focus behavior, and responsive behavior at other widths.
- Do not change preferences or game-save formats, gameplay, content, or the independent human-playtest/content-expansion gate.

## Acceptance criteria

- [x] At 150%, all header actions remain in bounds, labels are unclipped, and actions do not overlap the restoration summary.
- [x] The brand remains separated from the laboratory navigation at both wide desktop viewports.
- [x] Existing 100% and 125% header layout checks remain passing.
- [x] The 150% baseline passes without a source CSS change.
- [x] Relevant documentation is updated, the finalized plan is archived under `docs/archive/plans/` with a dated descriptive filename, and `docs/plans/` contains only intentionally active plans.

## Implementation and verification

No source CSS change was needed. `npm run test:e2e -- --workers=1 e2e/lab/header-responsive-layout.spec.js` passed 19/19, retaining the 125% desktop cases and adding 150% cases at 1341×900 and 1440×900. The checks cover bounds, unclipped labels, action-to-summary and action-to-action separation, and brand-to-navigation and brand-to-action separation; the existing 100% single-row checks remain in place. Code Reviewer found no actionable findings. No build or full suite was run. The independent human-playtest/content-expansion gate remains open.
