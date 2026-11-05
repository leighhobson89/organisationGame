# Plan: Large-Text Short-Tablet Layout

## Goal

Redesign the short-tablet layout so players using 150%, 175%, or 200% stored text scale can still follow the first action, use the world controls, and access progression information at 721–1050px widths and 550–719px heights.

## Architect direction

- Use a compact two-row header. Keep the restoration dial and its label visible, and place secondary restoration metrics in a native `<details>` disclosure.
- Keep all header actions together in a horizontal, keyboard-scrollable rail.
- Keep the first-action lead visible. Put secondary world controls and the keyboard pan hint behind a native `<details>` disclosure so they remain available without consuming the initial viewport.
- Keep the world toolbar in one horizontal scroll rail with hit targets at least 44px high.
- Reserve distinct space for the header, toolbar, and first-action guidance. Keep the Atlas control, Harmonic Calibration Folio, and first clue visible and usable.

These are design constraints for the implementation, not a substitute for the focused geometry and interaction checks. The Architect and implementer may adjust layout details as needed to satisfy the regression while preserving these requirements.

## Scope and constraints

- Cover tablet-bridge widths 721–1050px and short heights 550–719px at stored text scales 150%, 175%, and 200%.
- Keep the restoration dial/label and first-action lead visible without requiring an interaction to discover them.
- Use semantic native disclosures for secondary header metrics and secondary world controls/keyboard guidance. Keep summaries keyboard-operable and visibly focused.
- Keep all header actions reachable through the horizontal header rail and all world toolbar actions reachable through its one-row rail, with hit targets at least 44px high.
- Preserve the compact layout at widths up to 720px; preserve the existing tablet bridge at heights 720px and above; preserve other text scales and panel behavior.
- Do not reduce the stored text scale or mutate camera/autosave state to make the layout fit.
- Leave the independent human-playtest, audio-listening, and content-expansion gates open.

## Regression handoff

`e2e/lab/short-tablet-large-text.spec.js` covers the 3×3×3 matrix: widths 721/768/1050px, heights 550/600/719px, and stored text scales 150%/175%/200%. Each case verifies that the stored and computed text scale remain unchanged; checks the two-row header, visible restoration progressbar, native **Progress details** disclosure and its secondary metrics; checks the native **Controls and keyboard help** disclosure while keeping the first-action lead visible; verifies header-action names and keyboard reachability through the scrolling rail without page scroll; verifies one-row toolbar geometry, minimum 44×44px targets, focus scrolling, hit testing, and no page scroll; checks Atlas/Folio/first-clue containment, visible-card clearance, and center hit testing; and checks horizontal and vertical document overflow.

The spec also includes a 720×550/200% compact-boundary check, a saved-camera/autosave-byte preservation check at 768×600/200% across a short-tablet resize, and relies on `e2e/lab/tablet-bridge-guidance.spec.js` to protect 721×720/200%.

Focused matrix command: `npx playwright test e2e/lab/short-tablet-large-text.spec.js --workers=1`. The original red baseline completed 29 tests: all 27 responsive matrix cases failed, while the 720px compact-boundary and saved-camera/autosave guards passed. The visible failures clustered around missing native disclosures and short-height header/world-control collisions or target-size constraints. An initial Windows sandbox browser spawn returned `spawn EPERM`; the approved process-access rerun with `--workers=1` reached the cases and confirmed the baseline.

After the responsive layout passed, a real selection-mode case at 768×600/200% was added. Its red baseline showed that the plain selection hint inherited the first-action two-column grid; its content, containment, collision, and overflow assertions passed. Scoping the two-column grid to lead-bearing hints restored paragraph flow, and the case confirms the selection guidance remains readable and clear while camera state is unchanged.

## Acceptance criteria

- At 150%, 175%, and 200%, the header keeps the restoration dial and label visible; secondary restoration metrics are available in a native disclosure.
- The first-action lead remains visible. Secondary world controls and keyboard pan guidance are reachable through a native disclosure with clear keyboard focus.
- Every header action is reachable through the scrollable header rail, and every world toolbar action through its one-row rail, without page-level horizontal overflow.
- Toolbar hit targets are at least 44px high. Keyboard traversal scrolls either rail when a focused control begins offscreen, keeps focus visible, and does not move the page.
- The Atlas, Folio, and first clue remain visible, center-hit-testable, and clear of header, toolbar, and guidance overlays at the supported scales and viewports.
- No stored text-scale, camera transform, or autosave value is rewritten as a layout side effect.
- Existing compact, 720px-and-taller tablet, other-scale, and panel regressions remain green.

## Verification

The focused spec `npx playwright test e2e/lab/short-tablet-large-text.spec.js --workers=1` passed 30/30, including the 27-case matrix, 720px compact-boundary guard, saved-camera/autosave preservation, and 768×600/200% selection-mode case. Existing responsive guards passed 71/71. `npm run build` passed with 62 modules. Scoped diff-check was clean, and Code Reviewer re-review found no findings. The full suite was not run.

## Completion

Implementation, focused verification, review, and project documentation are complete. Large-text short-tablet guidance is verified at 150%, 175%, and 200% for widths 721–1050px and heights 550–719px. The independent human-playtest/content-expansion gate remains open. Archived as `docs/archive/plans/2026-11-05-short-tablet-large-text.md`; `docs/plans/` retains only the browser-scaling playtest gate.
