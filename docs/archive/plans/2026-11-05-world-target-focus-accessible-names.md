# Plan: World Target Focus Accessible Names

**Status:** Complete. Focused accessibility verification, final review, and build passed; this plan is archived.

## Scope

Give each world destination and scratch-pad focus button an accessible name that identifies its target while preserving the visible phrase. Destination buttons use `Focus cabinet: ${destination.label}` so the accessible name retains the visible phrase `Focus cabinet` for speech input and Label in Name. Scratch-pad buttons use `Focus ${pad.label}` and retain their visible `Focus` phrase. Preserve recentering behavior.

## Acceptance criteria

- Each of the 8 destination focus buttons has the accessible name `Focus cabinet: ${destination.label}` and retains the visible phrase `Focus cabinet`.
- Each of the 2 scratch-pad focus buttons has the accessible name `Focus ${pad.label}` and retains the visible phrase `Focus`.
- All 10 controls have correct, unique accessible names that include their visible phrases.
- Activating a representative destination focus control still recenters the world on that destination.
- Activating a representative scratch-pad focus control still recenters the world on that scratch pad.

## Focused test plan and expected red

The focused case is `destination and work-surface focus buttons have unique accessible names and recenter the camera` in `e2e/lab/world-target-focus-accessibility.spec.js`. It loads a fresh save at 3000 x 1800 with the camera at scale 0.4 and pan 0,0. It checks the exact expected accessible name for all 8 destinations and 2 scratch pads, asserts the ten names are unique, and confirms each name resolves to exactly one button.

The case activates a distant destination and a scratch pad, then verifies each target's center aligns with the viewport center using the measured camera transform.

The first run was discarded as a selector-count fixture failure: `getByRole('button', { name: /^Focus / })` counted the 8 destination controls but excluded the 2 scratch-pad buttons, whose current accessible name is `Focus`. The corrected test uses `.destination-focus, .scratch-pad button` to include all ten controls.

The valid red baseline reached the intended product assertion: `destination-cabinet-calibration` did not have the accessible name `Focus Harmonic Calibration Folio` (failure at line 62). Scoped review refined the destination requirement to `Focus cabinet: ${destination.label}` to retain the visible phrase for speech input and Label in Name; the scratch-pad requirement remains `Focus ${pad.label}`. The final spec expects these refined names.

## Final verification

- `e2e/lab/world-target-focus-accessibility.spec.js`: passed 1/1, checking all 10 unique target names and recentering from representative destination and scratch-pad controls.
- `npm run build`: passed with Vite 8.3.5 and 62 modules.
- Final review found no remaining issues. Scoped diff check emitted only LF-to-CRLF notices.

Finalized 2026-11-05 and archived as `docs/archive/plans/2026-11-05-world-target-focus-accessible-names.md`.
