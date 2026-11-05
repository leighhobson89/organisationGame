# Plan: Item Finder Misfiled Keyboard Recovery

**Status:** Complete. The focused keyboard recovery regression and scoped review passed; no production behavior change was needed.

## Scope

Extend the existing misfiled Item Finder recovery E2E in `e2e/lab/item-finder-layout.spec.js` to activate the misfiled result by keyboard focus and Enter, without pointer activation. Verify the existing keyboard selection path into the Inspector, including focus transfer to the Move destination selector.

This is focused verification of existing behavior. No production behavior change is expected.

## Acceptance criteria

- The regression focuses the misfiled Finder result and activates it with Enter; it does not click the result.
- The Finder closes after activation.
- The existing Inspector displays the misfiled status and its Move action.
- The Move destination selector receives keyboard focus through the existing keyboard selection path.
- Existing misfiled recovery assertions remain covered, with no production behavior or persistence changes.

## Focused test plan

The existing `Finder identifies a canvas-only misfiled item and exposes its recovery at 200% text on a narrow screen` case in `e2e/lab/item-finder-layout.spec.js` now focuses the invalid Finder result and presses Enter. It asserts that the Finder closes, the existing Inspector exposes its misfiled status and Move action, and the Move destination selector receives focus. The result is not activated with a pointer click.

The focused E2E case passed 1/1. Scoped test review found no actionable findings. No production behavior change was needed; no build or full suite was run. The independent human two-chapter playtest remains deferred and the content-expansion gate remains open.

Finalized 2026-11-05 and archived as `docs/archive/plans/2026-11-05-item-finder-misfiled-keyboard-recovery.md`.
