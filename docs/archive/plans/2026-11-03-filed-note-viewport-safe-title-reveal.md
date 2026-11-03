# Plan: Keep Filed-Note Title Reveals Inside the Viewport

**Status:** Completed and reviewed on 2026-11-03. The independent human-playthrough/content-expansion gate remains open.

## Goal

Keep the full-title reveal for compact filed notes entirely visible inside the laboratory viewport, including when the selected note is near any viewport edge.

## Scope and invariants

- Adjust only transient reveal presentation and placement. Do not change item IDs, authored dimensions, world positions, slot allocation, hit testing, progression, or saved data.
- Position an active reveal against `.world-viewport`: flip vertically when it would cross the top or bottom edge, align or clamp it horizontally as needed, and constrain/wrap the text when available space is small.
- Recalculate placement when the active label, camera scale, viewport size, or text scale changes. Measure active labels only; avoid observers across the world.
- Preserve hover, keyboard-focus, and selected states; pointer travel from the note onto the reveal; 2.5× camera readability; button accessible names; and `aria-hidden` on duplicate visual title text.
- Preserve the `.world-viewport` clipping boundary while ensuring the reveal itself fits within it. Keep the selected item's Inspector title available.
- Keep `docs/plans/browser-scaling-playtest-gate.md` active and unchanged. This polish does not complete independent human playtesting or open content expansion.

## Test plan

The Test Engineer added eight cases to `e2e/lab/filed-note-title.spec.js`: top-left, top-right, bottom-left, and bottom-right viewport corners, each at 100% and 125% text scale with the camera at 2.5× zoom. Every case asserts that:

1. The complete title reveal stays inside an 8px inset of `.world-viewport` and the title text fits.
2. The Inspector continues to expose the complete title.
3. The item's rect and inline style, camera transform, and saved slot geometry remain unchanged.

The existing centered hover/focus/selection, pointer continuity, and reveal-origin drag cases remain in place. The default-sandbox attempt was blocked because Playwright could not spawn a worker (`EPERM`); the focused baseline was then run with escalated execution and is recorded below. Focused command:

```powershell
npm run test:e2e -- --workers=1 e2e/lab/filed-note-title.spec.js --grep "title reveal stays inside"
```

### Red baseline

The focused command ran all eight cases before implementation. Both top-left cases (100% and 125% text scale) passed. The six top-right, bottom-left, and bottom-right cases failed the viewport-bound assertion: right-edge reveals reached 1322–1388px against the 1272px inset limit, and bottom-edge reveals reached 738–761px against the 712px inset limit. This confirms the existing reveal overflows on the right and bottom edges.

### Final verification

- `npm run test:e2e -- --workers=1 e2e/lab/filed-note-title.spec.js`: **11/11 passed**, including the eight viewport-edge cases.
- `npm run build`: passed with Vite 8.3.5.
- Code Reviewer found no actionable issues.
- The full test suite was not run.

## Documentation and completion

The known-limitation notes in `docs/ARCHITECTURE.md` and `docs/VERTICAL_SLICE.md` now describe the viewport-bounded reveal. This finalized plan is archived as `docs/archive/plans/2026-11-03-filed-note-viewport-safe-title-reveal.md`. Keep `docs/plans/browser-scaling-playtest-gate.md` active and unchanged until the two-chapter independent human playthrough is complete; content expansion remains gated.
