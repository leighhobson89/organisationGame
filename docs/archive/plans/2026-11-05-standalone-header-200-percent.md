# Plan: Standalone Header at 200% Text

**Status:** Finalized; strengthened focused regression passed and final review found no actionable findings.

## Goal and rationale

Verify the standalone laboratory header remains readable and keyboard-usable on the compact 320 by 360 viewport at 200% text. Use a completed-game fixture so all five header actions are present: Notebook, Instruments, the solved Chronology Puzzle, Save & Restore, and Settings.

## Scope and constraints

- Add one focused case in `e2e/lab/header-responsive-layout.spec.js` using the existing completed-game fixture at 320 by 360 and 200% text scale.
- Verify all five actions remain visible and retain their expected accessible names; action labels must not clip.
- Verify header and navigation bounds stay within the viewport, the action row fits within its header, and neither document nor navigation introduces unwanted horizontal page overflow.
- Traverse the actions with Tab while the navigation scrolls; each focused action must remain visible in the navigation and viewport, match `:focus-visible`, render a non-`none` outline, and be center hit-testable.
- Preserve the existing default, 125%, and 150% header cases, their five action semantics, and all application behavior. Do not change progression, data, or save behavior.
- Run only the focused header responsive-layout check; do not run an app build, full E2E suite, or full test suite unless separately requested. Keep the independent human-playtest/content-expansion gate unchanged.

## Implementation approach

1. Add one 200%/320 by 360 case using the existing completed-game fixture and header action helpers.
2. Assert scale, all five accessible names, label clipping, header/navigation/viewport bounds, and horizontal overflow.
3. Tab through the actions and verify focus visibility, center hit testing, and navigation scroll as clipped controls are revealed.
4. A compact-height, 200%-scale standalone solved-puzzle button wrapping rule in `src/styles/app.css` resolves the observed navigation clipping while preserving action semantics and the other header layouts. Its selector excludes puzzle, Notebook, Skills, Finder, Atlas, and Inspector states.
5. Strengthen the focused check to assert `:focus-visible` and a rendered outline whose computed style is not `none`; rerun and review the standalone-only CSS scope before updating docs and archiving.

## Test plan

The Test Engineer's focused 200%/320 by 360 regression checks applied scale; header, navigation, document, and viewport bounds; horizontal overflow; the five accessible names and unclipped labels; and keyboard Tab traversal with navigation scrolling, visible focus, and center hit testing. The strengthened version also requires each focused action to match `:focus-visible` and have a computed outline style other than `none` with positive outline width.

Focused command: `npx playwright test e2e/lab/header-responsive-layout.spec.js --grep "standalone header keeps all tools reachable at 200% text"`.

Baseline result: **1 failed.** After Tab reached the solved Chronology action, its left edge was x=−22.61 while the navigation began at x=12, so the focused action was outside the visible navigation bounds. The initial sandbox run returned `spawn EPERM`; the focused process-access retry produced this failure. No implementation changes had been made for the baseline.

After the compact-height, 200%-scale solved-puzzle button wrapping rule was added in `src/styles/app.css`, the initial focused command passed 1/1 after a process-access retry. Review then required explicit `:focus-visible` and rendered-outline assertions, which the Test Engineer added; that strengthened case passed 1/1 in 2.8 seconds after a process-access retry. The CSS selector was then narrowed to exclude puzzle, Notebook, Skills, Finder, Atlas, and Inspector states. The CSS specialist reran the strengthened focused regression, which passed 1/1. Scoped diff-check was clean apart from LF/CRLF notices. Final re-review found no actionable findings. No full suite or app build was run.

## Acceptance criteria

- [x] The completed-game fixture applies 200% text at 320 by 360 and exposes all five expected header actions with their accessible names.
- [x] Action labels remain unclipped; header, navigation, and actions stay within their expected bounds; the page has no horizontal overflow.
- [x] Tab traversal makes the navigation scroll as needed and keeps each focused action visibly focused, reachable in the nav/viewport, and center hit-testable; focus matches `:focus-visible` and renders a non-`none` outline with positive width.
- [x] The 200% compact wrapping rule is scoped to the standalone header and excludes puzzle, Notebook, Skills, Finder, Atlas, and Inspector states.
- [x] Existing header action semantics remain unchanged; no data, progression, or save behavior changes.
- [x] Only the focused header check is run; scoped review is complete, the plan is archived, and the separate human-playtest/content-expansion gate remains active.
