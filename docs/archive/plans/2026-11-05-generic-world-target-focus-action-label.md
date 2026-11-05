# Plan: Generic World-Target Focus Action Label

**Status:** Complete. Focused E2E, build, and final review passed; this plan is archived.

## Scope

Replace the inaccurate visible destination action text **Focus cabinet** with the generic **Focus** on all eight destination buttons. Give each destination button the target-specific accessible name `Focus ${destination.label}`. Scratch-pad buttons already use visible **Focus** and target-specific accessible names; keep them unchanged.

Preserve destination headings and camera recentering behavior. Destination focus intentionally updates the persisted camera through the existing `handleCameraChange` path; this change preserves that behavior. Placements, progression, and the save schema remain unchanged. This slice changes only the destination focus action label and accessible name.

## Acceptance criteria

- All eight destination buttons display **Focus** and have the accessible name `Focus ${destination.label}`.
- Destination headings continue to show the existing destination labels.
- Both scratch-pad buttons retain their visible **Focus** text and accessible name `Focus ${pad.label}`.
- Activating destination and scratch-pad focus controls continues to recenter the world on the selected target.
- Destination focusing continues to recenter the world and persist the camera through the existing path.
- Placements, progression, and save schema remain unchanged.

## Focused test plan and red baseline

The focused case is `destination and work-surface focus buttons have unique accessible names and recenter the camera` in `e2e/lab/world-target-focus-accessibility.spec.js`. It uses a fresh 3000 x 1800 overview fixture with camera pan 0,0 and scale 0.4; verifies exact unique accessible names and visible **Focus** text on all eight destination and two scratch-pad buttons; and activates a distant destination and scratch pad to check their camera-centered positions.

The valid red baseline failed at the visible-copy assertion for `destination-cabinet-calibration`: `toHaveText('Focus')` expected **Focus** but received **Focus cabinet** (1 failed). The implementation sets destination button text to **Focus** and its accessible name to `Focus ${destination.label}`, while preserving headings, recentering behavior, scratch-pad controls, and existing camera persistence. The focused label/recenter test does not add a camera-save assertion because this is a copy-only change.

## Final verification

- `e2e/lab/world-target-focus-accessibility.spec.js`: passed 1/1.
- `npm run build`: passed with 62 modules.
- Final scoped review found no actionable findings.

Finalized 2026-11-05 and archived as `docs/archive/plans/2026-11-05-generic-world-target-focus-action-label.md`.
