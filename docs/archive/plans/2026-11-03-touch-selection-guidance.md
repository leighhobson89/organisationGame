# Touch selection guidance

## Purpose

Make the multi-selection hint use touch-appropriate wording on coarse-pointer devices. The current pointer-specific pan and zoom guidance is accurate, but its selection instruction still starts with “Click” on touch devices.

## Scope

- Show “Tap or press Enter to select objects” for coarse-pointer devices.
- Keep “Click or press Enter to select objects” for fine-pointer devices.
- Preserve the Inspector group-move instruction and each pointer type's existing pan/zoom guidance.
- Keep the normal first-action hint and all interaction behavior unchanged.
- Do not change selection state, camera behavior, saves, or game content.

## Implementation

Use separate fine-pointer and coarse-pointer selection instruction variants selected by the same pointer-capability media query as the world navigation hints. Keep the shared Inspector instruction and existing pan/zoom variants intact. Ensure the hidden instruction copy is excluded from the accessibility tree.

## Acceptance criteria

- Fine-pointer multi-selection guidance says “Click or press Enter”.
- Coarse-pointer multi-selection guidance says “Tap or press Enter”.
- Both variants retain the Inspector instruction and correct pointer-specific pan/zoom text.
- The normal first-action hint, selection behavior, and saved state remain unchanged.

## Test plan

- `npx playwright test e2e/lab/world-input-guidance.spec.js --workers=1` verifies the visible fine-pointer “Click or press Enter” and coarse-pointer “Tap or press Enter” multi-selection prefixes, preserves Inspector and pointer-specific pan/zoom guidance, and rejects exposure of the hidden alternate prefix.

## Risks

- Duplicated pointer-specific instruction variants could expose both copies to assistive technology if the inactive copy is not hidden accessibly.
- A hybrid device follows its primary-pointer media query, consistent with the existing world hint behavior.

## Verification and review

- `npx playwright test e2e/lab/world-input-guidance.spec.js --workers=1` passed 2/2. The cases verify the visible fine-pointer and coarse-pointer multi-selection prefixes, preserve the Inspector and pointer-specific pan/zoom instructions, and reject exposure of the hidden alternate copy.
- `npm run build` passed with Vite 8.3.5 (59 modules).
- Code Reviewer found no actionable issues.
- Scoped `git diff --check` passed with expected LF-to-CRLF notices.
- The full suite was not run. The user's deferred independent human-playtest/content-expansion gate remains open.
