# Plan: Medium Desktop Guidance Bay

**Status:** Complete (2026-11-05). The medium-desktop guidance bay and toolbar layout are implemented and focused-verified. The separate two-chapter human playtest remains deferred, and the content-expansion gate stays open.

## Goal and scope

At medium desktop widths (1051–1340 px), heights of at least 720 px, and text scales from 112.5% upward, keep the fresh-start first-action hint readable without covering world cards, navigation controls, or transient feedback. Apply only when no panel, Atlas, Finder, or Inspector is open. Preserve the first Harmonic Calibration Folio and its clue in the visible starting area.

Current overlap audit for the existing same-size hint:

| Viewport | Text scale | Overlapped cards |
| --- | ---: | ---: |
| 1280×720 | 125%, 150%, 200% | 10, 10, 1 |
| 1051×900 | 125%, 150%, 200% | 18, 22, 12 |

Several audited cases have no collision-free relocation at the hint's current size. Do not shrink or hide the first-action content to satisfy the layout.

## Implemented layout

1. On medium desktop, the fresh first-action hint wraps across a full-width bottom guidance bay outside the world viewport. The world viewport ends above that reserved bay, so cards remain unobscured. A visible toast shares the reserved area without covering the hint, cards, or controls.
2. The layout applies at 1051–1340px, heights of at least 720px, and text scales from 112.5% upward when no panel, Atlas, Finder, or Inspector is open. Default-scale, compact, and open-panel layouts retain their existing behavior.
3. The high-text desktop toolbar uses a content-sized width capped to the viewport. Direct controls do not shrink or wrap; horizontal scrolling and existing edge cues appear when the row's content exceeds the rail. Labels remain intact. Keyboard focus scrolls only when a focusable control itself is clipped.
4. The guidance layout does not reset the camera or rewrite the saved camera/autosave state. The Folio and first clue remain inside the world viewport and hit-testable.

Likely implementation files are `src/styles/app.css` and, only if the layout needs measured height or structure changes, `src/ui/WorldViewport.jsx`. The pre-existing 1440 px check is `e2e/lab/scaled-desktop-hint-occlusion.spec.js`; the new medium-desktop matrix is `e2e/lab/medium-desktop-guidance-bay.spec.js`. Keep these checks scoped to layout and do not couple them to the deferred playthrough gate.

## Verification and findings

- The original same-size hint baseline failed all 10 viewport/scale cases. At 1051×900, cards overlapped at all tested scales. At 1280×720, overlap occurred at 112.5–175%; at 200%, the hint overlapped the Harmonic Calibration Folio. The initial hint geometry did not overlap the toolbar or Atlas toggle.
- The red toolbar baseline at 1280×720/200% measured 118.53px tall and intersected the Folio. The final toolbar stays on one row and clears the Folio.
- At 1051×900/200%, horizontal overflow comes from the clipped, nonfocusable world-object count; the last actionable toolbar control is already visible. The regression verifies the right overflow cue and preserves focus and the accessible name. It only expects scrolling when a focusable control is clipped, so it does not demand unnecessary movement when the focused action is already visible.
- The red toast baseline at 1280×720/200% had the viewport ending at y=720, toast bounds y=643.8–702, and hint bounds y=438.3–704. The toast overlapped the hint and one visible card. The final toast remains in the reserved area without those collisions.
- The 10 grid tests cover 1051×900 and 1280×720 at 112.5%, 125%, 150%, 175%, and 200%. They check viewport bounds, separation between the world viewport and hint bay, hint/card/control clearance, and Folio/first-clue visibility and hit testing. Additional cases check the one-row toolbar/Folio clearance, overflow cue and conditional focus scrolling, exact camera/autosave preservation, and toast placement.
- Final verification: 42 focused E2E checks passed; `npm run build` passed with 62 modules. The full test suite was not run.

## Red baseline details

On the unreserved layout, the 10 grid cases failed because the hint overlapped visible cards and the world viewport extended below the hint instead of ending above the guidance bay. At 1051×900, cards overlapped at every tested text scale. At 1280×720, cards overlapped from 112.5% through 175%, and at 200% the hint overlapped the Harmonic Calibration Folio. The hint did not overlap toolbar or Atlas controls. The camera/autosave preservation test passed on baseline, confirming that the original layout did not rewrite those values during viewport resizing.

At 1280×720 and 200%, the original toast baseline had the world viewport ending at y=720, toast bounds y=643.8–702, and hint bounds y=438.3–704. The toast overlapped the hint and one visible card. The completed layout moves the toast into the reserved bay, where the focused regression verifies that it clears the hint, cards, and controls.

A screenshot at 1280×720 and 200% showed the original `.game-toolbar` wrapping into multiple vertical rows and overlapping the top of the Harmonic Calibration Folio at approximately y=390–423. Its measured height was 118.53px. This was a toolbar-to-Folio collision separate from hint geometry. The completed toolbar regression now verifies a single row and Folio clearance; the overflow/focus regression accounts for the object-count clipping and only requires scroll movement when a focusable control is clipped.

## Acceptance criteria

- [x] The guidance bay clears cards, controls, and toast across the 10 scoped viewport/scale cases; the hint and toast stay within the browser viewport.
- [x] The toolbar stays on one row and clear of the Folio at 1280×720/200%; at 1051×900/200%, the overflow cue and conditional focus scrolling preserve the visible action and full accessible label.
- [x] The first Harmonic Calibration Folio and first clue stay inside and hit-testable in the world viewport; camera transform and saved autosave bytes remain unchanged.
- [x] Default-scale, compact, and open-panel layouts retain existing behavior.
- [x] Final focused E2E verification passed 42/42, and `npm run build` passed with 62 modules.
- [x] The polish is separate from the independent human two-chapter playthrough; that playtest remains deferred and the content-expansion gate remains open.

The independent human playthrough is a separate deferred gate and is not completed by this layout work.
