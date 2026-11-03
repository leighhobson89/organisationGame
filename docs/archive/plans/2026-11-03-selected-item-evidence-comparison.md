# Selected-Item Evidence Comparison

**Status:** Complete and reviewed on 2026-11-03. This usability improvement reuses authored clues and does not change the active human-playtest/content-expansion gate.

## Goal

Make multi-selection useful for comparing evidence: the Inspector currently lists selected titles, but hides their family and clue text, forcing the player to inspect objects individually.

## Scope and constraints

- In `src/ui/ItemInspector.jsx`, show a readable semantic `<dl>` for every selected item: the title plus visible **Family** and **Clue** terms with their existing definition values.
- In `src/styles/app.css`, style family and clue details compactly and legibly within the existing independently scrollable details region; keep group move controls pinned.
- Render all selected items up to the existing 40-item limit; do not truncate the list to the first eight. Keep the list in the existing scrollable details area so the move controls remain pinned and available.
- Preserve single-item inspection, batch movement, per-item placement validation, selection state, and save schema.
- Add no catalog objects, clues, story content, destinations, or progression changes. Leave `docs/plans/browser-scaling-playtest-gate.md` open and unchanged.

## Focused regression plan

Update `e2e/lab/organising-loop.spec.js` to cover:

- A multi-selection of two known objects exposes each selected title and semantic **Family**/**Clue** terms with the exact expected values, then still moves both through the existing batch action.
- The 40-item selection-cap case shows all 40 comparison rows, confirms the details overflow and scroll, and verifies the group **Move** button remains visible inside the Inspector after scrolling.
- Existing single-item inspection and batch validation behavior remain intact in the focused organizing-loop run.

Run the focused organizing-loop E2E cases, `npm run build`, and Code Reviewer review. Do not run the full suite without user approval.

Test file: `e2e/lab/organising-loop.spec.js`.

Focused command: `npm run test:e2e -- --workers=1 e2e/lab/organising-loop.spec.js --grep "multi-selection"`.

Pre-implementation red baseline: **2 intended failures**. The two-item comparison rows lacked the expected family and clue details, and the 40-item selection rendered only eight rows. The separate deselection behavior passed.

## Acceptance criteria

- [x] Each selected item through the 40-item cap has its title and semantic `<dl>` with visible **Family** and **Clue** terms and the existing values available to assistive technology.
- [x] Comparison details scroll independently; the group move selector/action remains visible and usable within the Inspector after scrolling.
- [x] Focused tests verify exact two-item term/value pairs, successful batch movement, and all 40 rows with scrollable details and a visible group Move action at the cap.
- [x] No authored content, progression, transient selection semantics, or save data changes.
- [x] The active human-playtest/content-expansion gate remains open and unchanged.

## Final verification

- `npm run test:e2e -- --workers=1 e2e/lab/organising-loop.spec.js --grep "multi-selection"`: **3/3 passed**. Coverage includes exact Family/Clue terms and values for two selected objects before successful movement, all 40 comparison rows, independent detail scrolling with the group Move control still available, and deselection.
- `npm run build`: passed with Vite 8.3.5.
- Code Reviewer found no actionable issues.
- The full test suite was not run; the independent human playthrough remains open and content expansion remains gated.

Updated `docs/ARCHITECTURE.md`, `docs/VERTICAL_SLICE.md`, `docs/TESTING_GUIDE.md`, and `docs/ROADMAP.md`. Archive this finalized plan as `docs/archive/plans/2026-11-03-selected-item-evidence-comparison.md`; keep the active `browser-scaling-playtest-gate.md` as the only file in `docs/plans/`.
