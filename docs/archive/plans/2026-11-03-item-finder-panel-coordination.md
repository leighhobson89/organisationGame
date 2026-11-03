# Item Finder Panel Coordination

## Status

Complete and reviewed on 2026-11-03. Implementation, focused regressions, build, and review are complete. Archived at `docs/archive/plans/2026-11-03-item-finder-panel-coordination.md`. The independent human-playthrough gate remains active.

## Problem

The Instruments (skills) panel can remain open when the player selects an item in the world or opens the Item Finder. Finder can also overlap an already-open Inspector or puzzle panel. Its search input does not receive focus when it opens, touch scrolling is blocked by the viewport's `touch-action: none` rule, and arrow keys used on Finder buttons can pan the world behind it. These conflicts make item search, selection, and actions difficult to use.

## Goal

Coordinate these task panels so the active item interaction is visible and the selected item remains available for skill eligibility after the player reopens Instruments.

## Scope

- In `App.jsx`, selecting a world item closes the Instruments panel and preserves `selectedItemId`.
- Pass an `onOpenFinder` callback from `App.jsx` to `WorldViewport.jsx`. When the Item Finder opens, close Instruments and clear whichever right-side panel is active. Preserve `selectedItemId`; the Notebook may remain open.
- In `WorldViewport.jsx`, exclude `.world-item-finder` descendants from pointer gesture/capture and wheel zoom handling so Finder interactions do not act on the world.
- Prevent keyboard events originating inside `.world-item-finder` from reaching the viewport's world-navigation handler, while preserving normal Finder keyboard controls.
- Move keyboard focus into the Finder search box when it opens. Return focus to the Find button after non-selection dismissals; after a keyboard result selection, preserve the Inspector's existing focus transfer to its move-target selector.
- Permit native vertical touch scrolling of Finder results while retaining custom pointer gestures for the world.
- Preserve the existing behavior where reopening Instruments closes the Inspector. Keep the selected item so eligible skills can still act on it.
- Add focused end-to-end regression coverage for panel transitions, Finder pointer selection, focus behavior, wheel isolation, and touch scrolling.

## Boundaries

- Do not change Finder ownership, save data, item state, or game rules.
- Do not close the Notebook when the Finder opens.
- Do not use global z-index changes to mask panel state conflicts.
- Do not broaden this into a general panel-layout or responsive-design change.

## Acceptance Criteria

- Selecting a world item while Instruments is open hides Instruments and shows the Inspector without overlap.
- Reopening Instruments hides the Inspector, preserves the selected item, and keeps an eligible skill enabled for that item.
- Opening the Item Finder while Instruments or a right-side panel is open hides those panels and shows the Finder without overlap; the Notebook can remain open and the selected item remains unchanged.
- Activating a Finder result with the pointer closes the Finder and opens the Inspector for the selected result.
- Opening the Finder by keyboard places focus in its search box. Closing it with the close button or toolbar toggle returns focus to the Find button. Selecting a result by keyboard opens the Inspector and transfers focus to its move-target selector.
- Scrolling the Finder results with a wheel or touch scrolls its list without changing the world's zoom or camera position.
- Pressing arrow keys while a Finder result or close button is focused does not move the world or dismiss the Finder.

## Implementation Notes

- Coordinate panel state in `App.jsx` and `WorldViewport.jsx`; opening Finder closes Skills and clears the active right panel without changing selection or Notebook state.
- Update the world-item selection handler to close only the skills panel while preserving the selection.
- Notify the App when the local Finder state changes from closed to open so it can close Instruments.
- Ignore events originating in `.world-item-finder` descendants when starting or capturing WorldViewport pointer gestures, and when applying wheel zoom. Keep normal Finder scrolling and result activation working.
- Ignore keyboard events originating in `.world-item-finder` descendants in the viewport's world-pan handler. Do not suppress Finder's own keyboard behavior.
- Give the Finder search box focus on mount. Track the Find button and restore focus to it whenever Finder dismissal removes the search UI; keep result selection's Inspector focus behavior intact.
- Remove `touch-action: none` from the viewport ancestor of the Finder and apply it to the world gesture surface/scene instead. Set Finder results to native vertical touch scrolling so touch-action inheritance does not block it.
- Keep the existing Instruments-header behavior that closes the Inspector when Instruments is reopened.

## Test Plan

Focused Playwright regressions are in `e2e/lab/panel-coordination.spec.js`:

1. Open Instruments, select a world item, assert Instruments is hidden and Inspector is visible; reopen Instruments, assert Inspector is hidden and an eligible skill remains usable on the selected item.
2. Select an item to open the Inspector, then open Find an item; assert Finder is visible, Inspector is hidden, and selected-item state is retained. Open Instruments before Finder and assert it closes; verify the Notebook remains visible when already open.
3. Open Find an item by keyboard and assert focus enters the search box; close Finder with its close button and via the toolbar toggle, asserting focus returns to the Find button for each dismissal. Reopen Finder and select a result by keyboard; assert the Finder closes, the Inspector opens for that result, and focus moves to the Inspector's move-target selector.
4. Scroll the Finder result list with a mouse wheel and a touch-capable mobile swipe; assert its scroll position advances while world zoom and camera position remain unchanged.
5. Focus a Finder close button and a Finder result in turn, press an arrow key, and assert the world transform remains unchanged, Finder remains open, and the focused control remains focused.

The pre-fix focused baseline for the expanded panel/focus/touch regressions was **4 passed, 3 failed**. Passing cases covered Lens selection after opening Instruments, Instruments/Finder pointer selection, keyboard result focus transfer to the Inspector, and wheel isolation. The three new failures reproduced the remaining issues: opening Finder left the Inspector visible; opening Finder by keyboard did not focus its search box; and the viewport still computed `touch-action: none`, preventing native touch scrolling of the results list. A later review also identified arrow-key events from Finder controls panning the world; that regression was added and fixed before final verification.

Before the `.world-item-finder` key-handler return was added, the keyboard regression confirmed world panning from Finder controls: ArrowRight on the Finder close button changed the scene transform from `translate(30px, 75px) scale(0.5)` to `translate(-60px, 75px) scale(0.5)`, and ArrowDown on a Finder result changed it to `translate(-60px, -15px) scale(0.5)`.

Final verification on 2026-11-03:

- `npm run test:e2e -- --workers=1 e2e/lab/panel-coordination.spec.js`: **8/8 passed**. Coverage includes panel visibility/selection retention, Finder focus transfer and restoration, keyboard result focus to the Inspector, pointer and arrow-key isolation, and wheel/touch scrolling without world movement.
- `npm run build`: passed with Vite 8.3.5.
- Code Reviewer found no actionable findings.
- The full test suite was not run. The fresh-origin CUA overlap observation is recorded in `docs/playtests/2026-11-03-research-chapters.md`; the automated fix verification was not a new full manual playthrough.

```powershell
npm run test:e2e -- --workers=1 e2e/lab/panel-coordination.spec.js
npm run build
```

## Risks and Review Points

- Closing Instruments must not clear `selectedItemId`; otherwise eligible skills may become unavailable when the panel is reopened.
- Finder-open notification should occur only on the transition to open and must not interfere with Finder result selection, selected-item state, or Notebook visibility.
- Clearing the right panel on Finder open must cover both Inspector and puzzle panels without changing puzzle/save state.
- Focus restoration for non-selection dismissal must not override the Inspector's intended focus on the selected item's move-target selector after keyboard result selection.
- Pointer and wheel exclusions must keep Finder activation/scrolling intact. Touch-action changes must preserve custom world panning and item dragging while enabling Finder result scrolling.
- Keyboard events within Finder must not pan the world, while arrow keys remain available to Finder controls and search.
- Review panel state ownership and callback dependencies to avoid stale closures or accidental changes to unrelated panel behavior.

## Completion Checklist

- [x] Focused tests added and shown to fail before the implementation.
- [x] Panel coordination implemented within the stated scope.
- [x] Focused Playwright spec passes (8/8).
- [x] Production build succeeds.
- [x] Code review confirms selection persistence and unrelated panel behavior.
- [x] Update relevant project documentation and archive this finalized plan in `docs/archive/plans/2026-11-03-item-finder-panel-coordination.md`; keep the independent browser-scaling playtest plan active.
