# Inspector Panel at 150% Text Scale

**Status:** Complete (2026-11-04). Implementation, focused verification, and review are complete; the separate compact toolbar-access follow-up remains open.

## Goal and boundary

Keep the single-item Inspector readable and operable at 150% text scale on compact 320×480 and 390×480 viewports, including its destination selector and Move action. Exercise long clue content so the Inspector's details region must scroll internally. Preserve the existing item-selection, move, focus, autosave, and placement behavior.

This slice covers one selected item and the regular Inspector action flow. Group-selection behavior remains covered by the existing panel-coordination tests. It does not change the save format, destination rules, world camera, story content, or unrelated panels.

## Findings and implementation plan

- The base `.item-inspector` is an absolutely positioned panel with hidden outer overflow. At widths up to 720px it is inset 10px horizontally, placed 66px above the bottom, and capped at `min(54%, 480px)`.
- `.item-inspector__details` is already a vertical flex scrollport with horizontal overflow hidden. The heading and `.item-inspector__actions` are non-shrinking flex children; the action area contains the target label/select, Move button, and Focus button.
- The 150% compact baseline is red: at 320×480 the Inspector is about 300×194.7px; at 390×480 it is about 370×203.77px. In both cases the details flex child has zero client height (with scrollHeight 1609 and 1302 respectively), and at 390px focus has already scrolled the outer panel by 16px. The current percentage cap leaves room for the fixed heading/actions but collapses the details region.
- Existing `world-and-save-recovery.spec.js` cases check Move bounds at desktop and at 390×480 with a long clue, but use the default text scale. Other tests cover keyboard selection/focus, successful movement, and save positions without the 150% compact layout.
- Add `e2e/lab/inspector-panel-layout.spec.js` with cases for both 320×480 and 390×480. Seed a fresh game save plus the version-1 preferences envelope with `textScale: 1.5`. Give `calibration-card-01` a long clue (reuse the existing 980-character fixture pattern) to force details scrolling.
- Select the item and assert the applied 150% scale, the Inspector's full bounds inside the viewport, no horizontal overflow in the page or panel, and a vertically scrollable `.item-inspector__details`. Measure the panel's bottom inset from the viewport and assert it remains 66px at both sizes. Record the toolbar and panel rectangles/overlap as diagnostic output for the separate follow-up, without changing toolbar layout. Scroll the details region and confirm it advances independently while the Inspector and document remain stationary.
- Traverse focus from Close through the destination select, Move, and Focus controls. For each focused control, assert its full rectangle stays within the Inspector and viewport and its center remains hit-testable. After scrolling details, repeat checks for the destination select and Move action.
- Select the item's correct destination (`cabinet-calibration`), submit Move with the keyboard, and verify the destination count, success status, focus remains on Move, and autosave records the correct destination placement. Decode the autosave to confirm its current version and shape are unchanged and it contains no text-scale preference; confirm the 150% value remains in the separate preferences record. Keep the test's content-derived geometry tolerant of text wrapping, while requiring the controls to remain usable.
- For short compact screens, replace the Inspector's percentage cap with vertical insets. The first attempt used `top: 10px; bottom: 66px; max-height: none` and measured 284.56px at 320×480 and 301.34px at 390×480, but details stayed at 0px and Move/Focus clipped because the fixed heading/actions consumed the available height.
- The two-column move-form reflow now keeps Move and Focus visible, but details are still only 3px at 320×480 and 45px at 390×480. The 320px case needs about 45 additional pixels to meet the 48px details minimum; 390px needs 3px.
- Keep the compact `.move-item-form` reflow: label across both columns, destination select and Move button in a two-column row (`minmax(0, 1fr)` plus a button-sized column, aligned at the bottom), and Focus on its own full-width row. The select may shrink and ellipsize its selected option; preserve the 36px select and 34px action-button minimum heights and the 150% text size.
- Final short-compact layout uses `top: 0; bottom: 66px; max-height: none`, retaining `left/right: 10px` and hidden outer overflow. It hides only `.item-inspector .panel-heading .eyebrow` because the `<aside aria-label="Selected item details">` already names the region; panel vertical padding is 4px, heading bottom padding 4px, action top margin/padding and gap are 4px, label line-height is 1.1, and move-form row gap is 3px. The 320×480 and 390×480 details scrollports measure 82px and 118px respectively. Title/label font size and minimum control target sizes remain unchanged.
- Keep the heading, action block, and controls non-shrinking. The top inset is 0px and the bottom remains fixed at 66px. Preserve `.world-bottom-stack`, toolbar CSS, and stacking.
- Keep `.item-inspector__details` as the independent `min-height: 0; flex: 1 1 auto; overflow-y: auto` scrollport and require at least 48px client height at both viewports. The outer panel must stay at `scrollTop === 0`; detail scrolling must not move the panel or page.
- Preserve the current panel bottom inset, z-index, `.world-bottom-stack`, and toolbar layout. Do not reduce type size to gain room. The destination select, Move button, and Focus button must remain fully visible and operable while long clue text scrolls.

## Separate pre-existing toolbar follow-up

At compact widths the Inspector spans nearly the full panel width and stacks at z-index 20, above the compact toolbar at z-index 10. With its established 66px bottom inset, the panel bounds overlap part of the toolbar. This is a pre-existing concurrent-access polish issue, not a blocker for the 150% Inspector-content correction: the current slice keeps the 66px inset and does not increase the overlap. A later task should decide how to preserve simultaneous access to Inspector actions and world-toolbar controls. Do not change toolbar or stacking behavior in this slice.

## Verification

Run focused browser coverage only; the full suite requires user approval:

```sh
npm run test:e2e -- --workers=1 e2e/lab/inspector-panel-layout.spec.js
npm run test:e2e -- --workers=1 e2e/lab/panel-coordination.spec.js
npm run test:e2e -- --workers=1 e2e/lab/world-and-save-recovery.spec.js --grep "keyboard selection moves focus directly to the inspector move control|Move item stays inside the Inspector|inspector move success keeps focus on Move"
```

The baseline had details client height 0 and clipped Move/Focus controls. Top/bottom sizing and the two-column action reflow made the actions visible but left details at 3px/45px. The final short-compact spacing uses `top:0` while holding `bottom:66px`; it hides the redundant eyebrow and trims decorative padding/gaps without reducing font size or target sizes. The regression asserts a 66px bottom inset at both widths, positive details scroll range and scrollTop, stationary panel/page positions, panel scrollTop 0, and full focused-action bounds before and after scrolling. It passed at both sizes; details scrollports measured 82px/118px. The diagnostic records an existing Inspector/toolbar intersection of 300×34px at 320×480 and 370×80px at 390×480. This concurrent-access issue is unchanged and tracked separately. The focused layout spec passed 2/2, panel coordination passed 18/18, and the targeted movement/focus cases passed 3/3. Review found no remaining code findings. The full suite was not run. The independent human-playtest/content-expansion gate remains open.

## Acceptance criteria

- [x] At both 320×480 and 390×480, the 150% scale is applied, the Inspector stays within the viewport, and neither the page nor Inspector has horizontal overflow.
- [x] The compact Inspector reserves a details scrollport of at least 48px between its fixed heading and actions; long clue/details content scrolls inside `.item-inspector__details` without moving the outer panel or document.
- [x] Keyboard focus can reach Close, target selection, Move, and Focus; each focused control remains fully visible and hit-testable within the panel and viewport before and after details scrolling.
- [x] The correct destination can be selected and Move submitted at both sizes; successful movement updates destination occupancy and autosave, with focus returned to Move.
- [x] The Inspector bottom inset remains 66px at both target viewports; the pre-existing overlapping toolbar issue is logged as a diagnostic and left for a separate follow-up.
- [x] Existing keyboard selection, group-selection coordination, item movement, and save-position semantics remain covered and unchanged (panel coordination 18/18; targeted movement/focus cases 3/3).
- [x] The game's current save version and shape remain unchanged; 150% text scale stays in its separate preferences record, with no unrelated panel, world, story, or destination behavior changes.
