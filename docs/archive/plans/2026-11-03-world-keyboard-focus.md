# Plan: World Keyboard Focus

**Status:** Complete. World arrow panning is scoped to the focused world region.

## Goal and boundary

Fix keyboard event bubbling so arrow keys from focused controls inside the world do not pan the camera. Arrow-key panning remains available when the `world-viewport` region itself has focus. Preserve each control's keyboard behavior, existing world panning, and other keyboard interactions. The independent human playtest and content-expansion gate in `docs/plans/browser-scaling-playtest-gate.md` remains open.

## Proposed fix

Guard the viewport's arrow-key panning handler with a direct-target check so it only handles those keys when the viewport itself is focused. Focused controls and other interactive descendants receive their own arrow keys without triggering camera movement.

## Test scope

Add a focused regression to `e2e/lab/world-and-save-recovery.spec.js`: focus the in-world `lab-item-calibration-card-01` button, press `ArrowRight`, and assert the scene transform is unchanged and focus remains on the card; then focus the world viewport, press `ArrowRight`, and assert the camera pans. The proposed fix is to handle viewport arrow panning only when the viewport itself is focused.

The red baseline reproduced the defect: `ArrowRight` changed `.world-scene` from `translate(30px, 1px) scale(0.5)` to `translate(-60px, 1px) scale(0.5)`. The focus-retained assertion passed, while the no-pan assertion failed. The initial sandbox worker spawn hit `EPERM`; the grep-only regression was run after escalation and confirmed the expected failure.

## Verification scope

- The red grep-only baseline showed `ArrowRight` on the focused in-world card changed `.world-scene` from `translate(30px, 1px) scale(0.5)` to `translate(-60px, 1px) scale(0.5)`; the focus assertion passed and the no-pan assertion failed.
- After the direct-target handler guard, `npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js` passed 26/26, and the post-review grep-only case passed 1/1.
- The sandbox Playwright worker spawn hit `EPERM`; escalated focused runs produced these results. Scoped Code Reviewer found no remaining findings.
- No build or full test suite was run.

## Completion

The verified coverage and review results are recorded in `docs/TESTING_GUIDE.md` and `docs/ROADMAP.md`. This plan is archived as `docs/archive/plans/2026-11-03-world-keyboard-focus.md`; the independent human-playtest/content-expansion gate remains open.
