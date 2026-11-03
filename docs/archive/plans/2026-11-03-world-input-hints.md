# World input hints

## Purpose

Correct the navigation guidance shown in the laboratory world. The current hint says to hold Space to pan and use the mouse wheel to zoom for every user. The viewport also pans when empty space is dragged without Space, and touch users can pan with one finger and zoom with a pinch.

## Scope

- Show pointer-appropriate pan and zoom instructions in the normal world hint and in the multi-selection hint.
- For fine pointers, describe dragging empty space to pan and the wheel to zoom.
- For coarse pointers, describe dragging empty space to pan and pinching to zoom.
- Keep the first-action calibration lead and multi-selection guidance intact.
- Update the world region's accessible description if needed so it describes both zoom methods accurately.
- Do not change gesture behavior, camera state, saves, or game content.

## Implementation

Render separate fine-pointer and coarse-pointer guidance and select the visible copy with a pointer-capability media query. Keep the shared item-drag instruction and first-action lead outside those variants. Use the same guidance in the multi-selection state while preserving its selection and Inspector instructions.

## Acceptance criteria

- Fine-pointer users see accurate empty-space pan and wheel-zoom guidance.
- Coarse-pointer users see accurate empty-space pan and pinch-zoom guidance.
- Both pointer types receive the appropriate guidance in normal and multi-selection states.
- Existing first-action content, hint placement, and gesture behavior remain unchanged.
- Only the focused browser checks and build are required; do not run the full suite.

## Test plan

- `npx playwright test e2e/lab/world-input-guidance.spec.js e2e/lab/first-action-guidance.spec.js e2e/lab/mobile-toolbar.spec.js --workers=1` checks fine- and coarse-pointer wording in normal and multi-selection states, the world region's accessible label, first-action guidance persistence, and hint geometry at compact and desktop sizes.
- `npm run build` checks the production React/Vite bundle.

## Risks

- A hybrid device may expose a fine primary pointer while also supporting touch. The visible guidance follows the browser's primary-pointer capability; touch gesture support remains available.
- Duplicate hidden hint variants could affect accessible text if they are not hidden from the accessibility tree. Verify the visible and accessible guidance in browser checks.

## Verification and review

- `npx playwright test e2e/lab/world-input-guidance.spec.js e2e/lab/first-action-guidance.spec.js e2e/lab/mobile-toolbar.spec.js --workers=1` passed 6/6. Coverage includes fine/coarse pointer instructions in normal and multi-selection states, the world accessible label, first-action guidance persistence, and compact/desktop hint geometry.
- `npm run build` passed with Vite 8.3.5 (59 modules).
- Code Reviewer found no actionable issues.
- Scoped `git diff --check` passed; Git reported expected LF-to-CRLF conversion notices.
- The full suite was not run. The independent human-playtest/content-expansion gate remains open at the user's request.
