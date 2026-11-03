# Plan: Filed Note Title Reveal

## Status

Implementation, focused verification, review, and documentation are complete. The independent human-playthrough gate remains active in `docs/plans/browser-scaling-playtest-gate.md`.

## Problem

The `lab-object` card clips long titles when its fixed dimensions are compact. Handwritten notes can be 78 × 58 or 82 × 60 world units, while filed slots are 92 × 66. The card's `overflow: hidden`, padding, and title width restriction leave too little space for some names, especially at the supported 112.5% and 125% text scales. The full title remains in the object's accessible name, but its visible card label can be cut off.

## Goal

Keep compact filed cards within their current layout while giving players a clear way to read the complete title.

## Scope and invariants

- Add a full-title visual reveal for compact objects while the card is hovered, keyboard-focused, or selected. The reveal may extend beyond the card bounds and must layer above neighboring cards.
- Keep the reveal open while the pointer moves from the card onto the reveal: remove any gap between them and allow the reveal to receive pointer events. Prevent pointer interaction with the reveal from starting a world drag if the viewport drag handler would otherwise treat it as a card drag.
- Keep ordinary card previews legible and bounded; reveal the complete title in a responsive overlay using `rem`-based typography.
- Keep the reveal screen-readable at camera zoom levels up to 2.5 by compensating for the scene's camera scale.
- At viewport edges, allow the reveal to be clipped by the laboratory viewport; selecting the item must expose the complete title in the Inspector as the reliable fallback.
- Keep the full accessible name on the existing item button. Mark any duplicate visual title text `aria-hidden` so assistive technology does not announce it twice.
- Preserve all item IDs, titles, dimensions, workspace positions, placement positions, slot allocation, hit testing, and save data.
- Keep overlay text usable at 100%, 112.5%, and 125% text scales and at the supported desktop and mobile viewport sizes.
- Update the known-limitations documentation only after the reveal behavior is verified.

## Boundaries

- Do not enlarge stored item dimensions or change destination/scratch-pad layout geometry to make room for titles.
- Do not alter authored content or item ordering.
- Do not change the save schema or game rules.
- Do not add content, new panels, or global tooltip behavior.

## Acceptance criteria

- The filed **Margin Note: Keep the Door Open** (82 × 60) reveals its full title on hover, keyboard focus, and selection.
- The reveal remains readable at 100% and 125% text scale, wraps within a responsive maximum width, and is not clipped by the compact card.
- The object's accessible name continues to contain its full title, with no duplicate announcement from the visual reveal.
- Moving the pointer from the card into the reveal keeps it open.
- At camera zoom up to 2.5, the reveal remains screen-readable and does not scale with the world scene.
- Near viewport edges, the reveal may be clipped by the viewport; selecting the note exposes its complete title in the Inspector.
- The card's authored dimensions and slot position remain unchanged before and after revealing the title.
- The overlay rises above adjacent cards and may be clipped by the laboratory viewport boundary. The Inspector provides the complete title after selection when the overlay is clipped.
- Existing item selection, filing, moving, focus, and save behavior stay unchanged.

## Implementation notes

- The likely implementation is a separate `aria-hidden` title reveal element in `LabObject.jsx`, styled in `app.css` and shown for `:hover`, `:focus-visible`, and `.is-selected` states.
- Place the reveal flush against the card and make it pointer-enabled so hover persists while the pointer moves onto it. Check the viewport's pointer-down handling and guard the reveal from initiating world dragging if necessary.
- Raise the active card's stacking level and allow visible overflow while the reveal is shown; use a bounded, wrapping overlay with a parchment treatment so it reads as part of the object. Compensate for the camera transform so its dimensions and typography remain screen-readable through 2.5x zoom.
- Keep the current card and slot geometry intact. The reveal is a temporary presentation layer, not a larger item hit box or saved dimension.
- Preserve the current accessible button name, which already includes the entire item title.
- Use the Inspector's selected-item title as the guaranteed full-title fallback near viewport edges; viewport clipping of the reveal is acceptable.

## Test plan

Focused E2E coverage is in `e2e/lab/filed-note-title.spec.js`, using a valid save with **Margin Note: Keep the Door Open** filed in its canonical 82 × 60 slot.

1. At 100% text scale, focus and select the filed note; assert the full-title reveal is visible and readable in both interaction states.
2. Repeat at 125% text scale; assert the reveal can wrap without clipping.
3. In each scale case, assert the item's serialized dimensions and position, DOM width and height, and slot placement remain unchanged.
4. Assert the visual duplicate is hidden from the accessibility tree while the item button retains the complete accessible name.
5. At camera zoom 2.5, move the pointer from the filed card onto the reveal and assert it remains visible and screen-readable. Exercise the reveal-origin drag guard with mouse down, move, and up; assert item position, camera state, and saved geometry remain unchanged.
6. Position the note near a viewport edge and hover it. Allow the overlay to clip at the viewport boundary, then select the note and assert the Inspector exposes the complete title.

Verification outcome: `npm run test:e2e -- --workers=1 e2e/lab/filed-note-title.spec.js` passed 4/4, including hover/focus/selection, pointer continuity and reveal-origin drag prevention, 2.5x camera readability, the viewport-edge Inspector fallback, and unchanged item/camera/save geometry. The panel-coordination E2E passed 8/8; `npm run build` passed with Vite 8.3.5; Code Reviewer found no actionable issues. The earlier 2.5x baseline showed reveal bounds growing from 264.875 × 40.1094 CSS pixels at 1x to 662.1875 × 100.2734 at 2.5x and hover dismissal when entering the reveal; the final focused regression passes after correction. The full test suite was not run.

## Risks and review points

- The reveal may overlap neighboring cards; ensure it is transient, layered above the scene, and does not change hit testing or saved coordinates.
- Text scaling can increase both title width and height; bound width in responsive units and allow the overlay itself to grow vertically.
- A child overlay inside the camera-transformed scene can become oversized at high zoom; verify inverse scale compensation through 2.5x zoom while retaining responsive wrapping.
- Pointer-enabled reveal content can reach the viewport's world-drag handler; ensure hovering and selecting remain usable without accidental card movement.
- The reveal can be clipped near viewport edges by design, so the selected item's Inspector title must remain complete and visible as the fallback.
- Hover-only presentation would miss keyboard and touch users; selected and keyboard-focus states must reveal the full title too.
- Ensure child text remains legible in all family card color schemes and does not obscure the item's mark unnecessarily.

## Completion checklist

- [x] Focused tests added and shown to fail before implementation.
- [x] Full title reveal implemented for hover, keyboard focus, and selection.
- [x] Item dimensions, positions, placement, accessibility name, and save data remain unchanged.
- [x] Focused Playwright regression passes at 100% and 125% text scale and at 2.5x camera zoom.
- [x] Production build succeeds with Vite 8.3.5.
- [x] Code review confirms overlay stacking, accessibility, and preserved game behavior.
- [x] Update relevant project documentation, archive this plan with a dated descriptive filename, and keep the independent human-playtest gate active.
