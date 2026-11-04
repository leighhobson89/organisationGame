# Plan: Professor's Notebook at 150% Text Scale

**Status:** Complete. Focused compact-viewport coverage passed at both sizes, and review found no actionable issues. No production or CSS change was needed.

## Goal and boundary

Verify that the Professor's Notebook remains readable and operable at 150% text scale in 320 × 480 and 390 × 480 viewports. Preserve collection navigation, existing discovery text, progress display, and saved-game behavior. This polish slice adds no authored story content and does not close the independent human-playtest/content-expansion gate.

## Implementation outcome

- Added `e2e/lab/notebook-panel-layout.spec.js` cases for 320 × 480 and 390 × 480.
- Seeded a fresh game, the version-1 preference envelope with `textScale: 1.5`, and all five existing `NOTEBOOK_DISCOVERIES` before page load.
- Verified the applied `--text-scale`, Notebook panel bounds within the viewport, no horizontal overflow in the panel or page, and internal vertical scrolling.
- Verified Tab traversal from Notebook through Instruments, Save & Restore, and Settings to all four collection actions. Every focused button's full bounds remain inside the panel and viewport while the panel scrolls.
- Scrolled through Recent discoveries and verified all five existing entries, including the final note, remain reachable and visible.
- The baseline passed without a layout or reachability failure, so no production CSS or behavior change was needed.

## Test design and baseline

The new `notebook-panel-layout.spec.js` has one case for each compact viewport. Each case seeds the version-1 150% preference and all five existing discoveries, then checks scale, panel/page bounds, horizontal overflow, and internal scrolling. Keyboard traversal is verified in this order: Notebook → Instruments → Save & Restore → Settings → all four collection actions. Each focused collection action's full bounds must remain inside the panel and viewport while internal scroll advances. The test then scrolls through Recent discoveries and confirms all five titles and notes, including the final note, are reachable.

The focused spec passed **2/2** on the escalated rerun after the initial sandbox Playwright worker startup returned `EPERM`. Code review found no actionable findings. No production or CSS change was needed. The full suite was not run, and the independent human-playtest/content-expansion gate remains open.

## Verification

Run the focused browser spec:

```sh
npm run test:e2e -- --workers=1 e2e/lab/notebook-panel-layout.spec.js
```

Do not run the full suite without user approval. The finalized plan is archived with a dated descriptive filename; `docs/plans/` retains only the still-active playtest gate.

## Acceptance criteria

- [x] Both compact viewport cases apply 150% text scale and keep the panel within the viewport without horizontal overflow.
- [x] Keyboard traversal reaches every collection button, with its full focused bounds visible inside the panel and viewport as internal scrolling advances.
- [x] All five existing discovery entries, including the final note, are reachable and visible by scrolling.
- [x] No story, persistence format, or unrelated behavior changes; the independent human-playtest/content-expansion gate remains open.
