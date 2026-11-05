# Compact Header Controls at 320px

## Goal

Keep the compact header's navigation actions and labels fully visible at a `320×360` viewport with default text, without disrupting existing responsive header behavior.

## Scope and approach

1. Add a focused regression to `e2e/lab/header-responsive-layout.spec.js` for the default-text header at `320×360`.
2. Assert navigation content fits without horizontal overflow and every header control and label remains fully visible within its viewport.
3. If the regression confirms a sizing issue, reduce compact header row gaps or padding only at widths up to `360px`. Preserve the existing larger-text scrolling and focus behavior, and header layout at other widths.

## Acceptance

- At `320×360` with default text, nav `scrollWidth` is no greater than `clientWidth`.
- Every header control and its label has its full bounds visible; no control extends past the viewport edge.
- Existing larger-text and other-width header scroll/focus behavior remains covered and unchanged.

## Verification

- The initial browser measurement found `.header-actions` at `296px` wide with `309px` of scroll content; the Settings control's right edge reached `x=321.25`.
- The test specialist will add the focused regression and run its red baseline before implementation.
- After the width-scoped gap/padding correction, the `.header-actions` client and scroll widths are both `296px`, and Settings ends at `x=299.25` inside the viewport.
- `npm run test:e2e -- --workers=1 e2e/lab/header-responsive-layout.spec.js` passed **20/20**; `npm run build` passed with Vite 8.3.5 (**59 modules**). Scoped review found no actionable findings, and `git diff --check` was clean apart from LF-to-CRLF notices.

## Boundaries

- No markup, save, story, or gameplay changes.
- No playtest or content-gate changes; the separate independent human-playtest/content-expansion gate remains active.

## Test plan

- Use a fresh `BrowserContext` at `320×360` so the case has default preferences and exactly the four default header controls.
- Assert the header navigation's `scrollWidth` is no greater than its `clientWidth`, and that every control and label is fully contained by the navigation and viewport.
- Red baseline: navigation content measures `309px` against a `296px` client width, so the no-overflow assertion fails; Settings ends at `x=321.25`.
- At widths up to 360px, reduce `.header-actions` gap to 3px and `.header-control` inline padding to 6px. The final navigation measures 296px/296px, and Settings ends at `x=299.25`.
- The complete `header-responsive-layout.spec.js` passed 20/20, retaining larger-text scroll/focus and other-width coverage. The Vite build passed with 59 modules, and scoped review found no actionable findings.
