# Plan: Compact Start Clue Visibility

**Status:** Complete. Responsive polish keeps the first calibration clue mostly visible at 320 × 480.

## Goal and boundary

Keep the first calibration clue visually discoverable at a 320×480 viewport while retaining concise guidance for starting the Harmonic Calibration collection. Preserve existing hint content and layout behavior at larger mobile sizes, the toolbar's reachable controls, and the current start framing at other viewport sizes. This is a focused responsive-polish slice; it does not expand authored content or close the independent human playtest gate.

## Proposed implementation

At up to 360px wide and 520px high, compact the toolbar into three rows with short control labels and reduce the fresh-start hint's padding and type size. Retain its full concise calibration instruction and avoid covering most of `lab-item-calibration-card-01` with the hint or toolbar. Keep the existing 390×480 hint and toolbar behavior intact.

## Test plan

Extend `e2e/lab/compact-start-framing.spec.js` to measure the fraction of `lab-item-calibration-card-01` exposed after intersecting its bounds with the combined `.world-hint` and `.game-toolbar` coverage at 320×480. Require more than 50% of the clue's area to remain exposed in each of these states:

- Fresh game start.
- Start view restored after jumping to another destination and back.
- Start view restored with Reset view after jumping to another destination.

The pre-fix exposed-area ratio was 0.2051 (20.5%). Keep the existing 390×480 checks, and run the focused `compact-start-framing.spec.js` and `mobile-toolbar.spec.js` specs. Do not run the full test suite without user approval.

## Verification outcome

The exposed-area ratio is 0.588 (58.8%) after the responsive layout change. The focused `compact-start-framing` and `mobile-toolbar` E2E specs passed 24/24. Scoped Code Reviewer found no actionable findings. No build or full test suite was run. The independent human-playtest/content-expansion gate remains open.

## Scope and constraints

- Limit changes to the responsive hint presentation and focused E2E coverage unless investigation shows a necessary dependency.
- Preserve the hint's accessible text and existing pointer-transparent behavior.
- Preserve world camera framing and the toolbar interaction behavior outside the affected viewport class.
- Keep the active browser scaling and independent playtest gate in `docs/plans/browser-scaling-playtest-gate.md` open.

## Acceptance criteria

- [x] At 320×480, the calibration instruction remains concise and more than 50% of the first calibration clue area remains exposed above the hint and toolbar; measured exposure is 58.8%.
- [x] Existing 390×480 guidance and toolbar checks continue to pass.
- [x] Focused responsive regressions cover a fresh start and the start view restored by reset and destination jump.
- [x] Relevant project documentation is updated, the finalized plan is archived under `docs/archive/plans/` with a dated descriptive filename, and `docs/plans/` contains only intentionally active plans.
