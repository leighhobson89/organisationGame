# Plan: Resonance Lens Highlight Polish

**Status:** Active (2026-11-03). Architect plan recorded; focused regression
tests and implementation are pending. Keep the independent human-playtest and
content-expansion gate open.

## Finding

The exploratory CUA run reported that Lens glimmers were difficult to verify.
The current code reveals a render-mode gap: `WorldViewport` marks matching
`LabObject` DOM cards, but `WorldOverviewCanvas` receives no highlighted item
IDs. Matches drawn only on Canvas therefore lose both Lens and Compass cues at
overview scale. Highlighted DOM cards also do not expose their highlighted
state in their accessible names. See the [exploratory research-chapter
playtest](../playtests/2026-11-03-research-chapters.md).

## Goal

Make Lens and Compass targets easy to find in both detail and overview modes,
with a clear visible cue and an accessible explanation. Preserve the
non-automating nature of both tools, current content and persistence, the
64-item DOM overlay cap, and the independent playtest gate.

## Intended behavior

- The Resonance Lens continues to identify other members of the selected
  item's collection, or items of the same family when the selected item has no
  collection. The selected item itself is not counted as a match.
- The Missing Member Compass continues to identify its one loose candidate.
  Lens and Compass matches use distinguishable accessible descriptions and
  remain visible in both DOM detail cards and the Canvas overview.
- A concise status names the focused item and reports how many related items
  were found. It supports both visible feedback and a polite screen-reader
  announcement without changing when or how items are placed.
- Highlight marks remain recognizable at overview scale and do not force
  additional DOM overlays. Detail cards receive an equally clear mark.
- Any highlight animation respects the existing saved and operating-system
  reduced-motion preferences; the static mark and status remain available.
- Existing temporary activation timing remains seven seconds. Highlighting
  changes no item position, placement, validation, progression, audio event,
  catalog entry, or save field.

## Implementation boundaries

1. Derive the Lens match set and count from the existing collection-or-family
   rule once per relevant state change, and combine it with the existing
   Compass candidate IDs without changing either tool's eligibility.
2. Pass the highlighted IDs and their source to `WorldOverviewCanvas`. Paint a
   distinct high-contrast mark for matches while retaining the current Canvas
   world transform, hit testing, culling, and overlay exclusions. Do not
   promote highlights to DOM overlays or exceed the 64-overlay cap.
3. Give highlighted `LabObject` cards the matching detail-mode mark and an
   accessible name or description identifying the highlighting tool.
4. Update the existing skill status/feedback path with the selected item and
   match count. Avoid duplicate or contradictory announcements when the Lens
   cools, the Compass points to a candidate, or another action replaces the
   transient message.
5. Keep motion out of the behavior when reduced motion is active; preserve the
   existing seven-second activation and all camera, selection, and save
   behavior.

## Risks and constraints

- Canvas is rendered at half-resolution before camera scaling. Verify that a
  highlight mark remains legible at the minimum supported overview scale,
  without blurring or adding a per-item DOM node.
- A family match may include many items. Keep matching linear in the existing
  item list and draw only the cue needed for each already-rendered Canvas card;
  avoid extra spatial queries or Canvas layers.
- Do not count the selected item as its own related item. Keep Lens and
  Compass source labels accurate when both could otherwise be active.
- Some matches may be outside the current viewport or represented only by
  Canvas. The announced count should describe the complete match set, while
  the visual cue appears only where the renderer currently represents the
  item.
- The exploratory visibility observation is not independent human feedback.
  Automated verification cannot close the separate two-chapter human-playtest
  or content-expansion gate.

## Test plan

**Status:** Focused regression test authoring is pending.

- Cover a Lens collection match and family fallback, excluding the selected
  item, through user-visible activation and accessible status.
- Cover the highlighted card cue and accessible source label in detail mode.
- Force overview mode with a Canvas-only match and verify the Canvas actually
  paints its cue, not only that the ID was passed as a prop. Also verify the
  64-overlay cap is unchanged.
- Verify the Compass candidate keeps its distinct cue and does not move, file,
  or validate an item.
- Verify reduced motion leaves a static, perceivable cue and match status.
- Assert activation leaves item state and saved data unchanged. Run the
  focused browser regressions and production build, then review the change.
  Do not run the full test suite without user approval.
