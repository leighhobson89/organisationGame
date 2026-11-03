# Plan: First-Action Guidance

**Status:** Complete. Implementation, focused verification, scoped code review, documentation, and archival are complete.

## Goal and boundary

Help a new player recognize a concrete first step in the existing Harmonic Calibration collection. While no collection member is actually filed in its correct destination, show a concise lead pointing to the Harmonic Calibration blueprints and the Harmonic Calibration Folio. Keep the existing drag, pan, and zoom instructions visible alongside it.

Preserve the current multi-selection hint. Once at least one Harmonic Calibration member is correctly filed, hide only the first-action lead. A misplaced item, an item left in the workspace, or a completion flag without a corresponding correct placement must not hide it.

Do not add authored game content, save fields, or persisted onboarding state. Keep the change scoped to the existing world hint and its narrow-screen presentation.

## Architecture and implementation scope

- Derive lead visibility from the current item placement records and the existing canonical correct-filing rule; do not use collection completion/progress flags as the source of truth.
- Reuse the canonical correct-filing predicate instead of adding another divergent implementation.
- Keep the lead and manipulation controls as distinct visible pieces of guidance. The lead should identify the blueprints and destination in plain language without replacing the drag/pan/zoom help.
- Retain the existing multi-selection guidance behavior and avoid adding live announcements or persisted state.
- Check the world toolbar at narrow mobile widths so the added line wraps without clipping, overlap, or obscuring controls.

### Architect review

**Scope and design decision:** Derive visibility from canonical correct placements in the Harmonic Calibration collection; keep normal manipulation guidance visible, preserve multi-selection text, and add no save fields or authored content. Code review found no actionable findings.

## Test plan

**Test Engineer plan:** Focused tests are in place and the red baseline has been recorded before implementation. Coverage includes:

- A fresh save shows the first-action lead and existing manipulation instructions.
- One canonical correctly filed Harmonic Calibration member hides the lead.
- Misfiled, unfiled, or unrelated items do not hide the lead.
- Stale or contradictory completion progress does not control lead visibility.
- Multi-selection guidance remains unchanged.
- At 320×480 and 390×480, the world toolbar and guidance remain readable, wrap as needed, and do not clip or overlap; retain the existing desktop layout check.

Run the focused checks with:

```text
node --test --test-isolation=none tests/unit/game-foundation/first-action-guidance.test.mjs
npx playwright test e2e/lab/first-action-guidance.spec.js e2e/lab/mobile-toolbar.spec.js --workers=1
```

**Red baseline:** Before implementation, the unit test failed because the planned helper module was absent. Playwright reported three expected failures: the fresh-save lead expectation and the 390 x 480 and 320 x 480 mobile first-action guidance checks. The existing desktop toolbar case passed. A default-sandbox E2E attempt hit Windows `spawn EPERM`; the focused escalated run reached the expected failures.

## Verification

- `node --test --test-isolation=none tests/unit/game-foundation/first-action-guidance.test.mjs` passed 6/6.
- `npx playwright test e2e/lab/first-action-guidance.spec.js e2e/lab/mobile-toolbar.spec.js --workers=1` passed 4/4: fresh-save lead and correct-filing dismissal; 390 x 480 and 320 x 480 mobile geometry; and the existing desktop layout at 1440 x 900.
- `npm run build` passed with Vite 8.3.5.
- Code review found no actionable findings. Visibility uses current placements and the shared correct-filing predicate; no authored content or save schema changed.
- The full test suite was not run, per the approval requirement in `AGENTS.md`.

## Completion and archiving

The finalized plan is archived as `docs/archive/plans/2026-11-03-first-action-guidance.md`. The separate browser-scaling/playtest gate remains active until its human-playtest criteria are satisfied.
