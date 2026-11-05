# Compact Fresh-Start Hint Overlay Spacing

## Goal

Keep first-action guidance, the Clockwork Atlas toggle, and autosave feedback readable and separate on short compact viewports.

## Observed evidence

A fresh-start screenshot at 320 × 360 showed the first-action hint occupying the same top-left area as the Atlas toggle. The `Saved just now` autosave indicator also covered part of the hint text. Existing compact toolbar checks verify the hint against the toolbar, but do not check the Atlas toggle or autosave indicator.

The `Saved just now` pill is `.game-save-indicator` in `App`; `.lab-toast` in `WorldViewport` reports transient gameplay feedback and is a separate element with different placement and behavior.

## Scope and constraints

- Add focused geometry coverage for the fresh, no-panel layout at 320 × 360 and a representative short-height boundary viewport in the 360–399px range.
- Verify that the first-action hint, Atlas toggle, and visible autosave status do not overlap; verify the Atlas toggle remains inside the viewport and hit-testable.
- Keep any layout correction scoped to compact short-height, no-panel states.
- Preserve first-action copy, clue exposure, toolbar geometry and access, Atlas behavior, open-panel layouts, autosave behavior, and existing 320 × 400/480px behavior.
- Do not change persistence or saved game data.

## Implementation and verification

The CSS Developer added `padding-top: 54px` to the existing fresh/no-panel `.world-bottom-stack` rule for widths up to 720px and heights 360–399px. This reserves a top lane above the hint for the Atlas toggle and autosave badge while preserving the existing toolbar and panel rules.

After the Test Engineer records the failing baseline, update the plan with the exact test scope and baseline result before implementation begins. Run the focused compact-start test, review the scoped change, and run `git diff --check` on changed files. Do not run the full suite without user approval.

## Test plan and red baseline

The Test Engineer added the focused cases to `e2e/lab/compact-start-framing.spec.js`. They check pairwise overlap of the first-action hint, Atlas toggle, and visible autosave status at 320 × 360 and 360 × 399, and verify the Atlas toggle remains center-hit-testable.

Red baseline command:

```sh
npm run test:e2e -- --workers=1 e2e/lab/compact-start-framing.spec.js --grep "hint overlays"
```

Both cases fail on the current layout. At both sizes, the hint and Atlas start at y=111; the hint spans x=10 with width=300px at 320px and 340px at 360px, while the Atlas toggle spans x=10 with width=46.64px and height=38px. The screenshot also shows the `Saved just now` autosave status covering part of the hint. The initial sandbox worker spawn returned `EPERM`; the elevated rerun confirmed the red failures.

After implementation, the focused `compact-start-framing.spec.js` passed 22/22, including both new overlap cases and the existing compact/desktop framing coverage. The CSS scope excludes panels and the Finder. The Atlas toggle remains center-hit-testable.

Scoped Code Reviewer found no actionable findings. `git diff --check` found no whitespace errors; Git emitted only expected LF-to-CRLF working-copy notices. No build or full test suite was run.

## Documentation and completion

Completed 2026-11-04. Updated the roadmap, testing guide, and vertical-slice notes with the verified fix. Archive this finalized plan as `docs/archive/plans/2026-11-04-compact-fresh-start-hint-overlays.md`; keep the separate browser-scaling playtest gate active.
