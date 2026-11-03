# Plan: Resonance Lens Highlight Polish

**Status:** Complete (2026-11-03). Implementation, focused verification, and
review are complete. The independent human-playtest and content-expansion gate
remains open and unchanged.

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

**Status:** Focused regression tests and implementation are complete.

### Unit regression

File: `tests/unit/game-foundation/skill-highlights.test.mjs` (2 tests).

```sh
node --test --test-isolation=none tests/unit/game-foundation/skill-highlights.test.mjs
```

The unit tests verify collection matching, family fallback, selected-item
exclusion, and input immutability. **Final result:** 2/2 passed.

### Browser regression

Files: `e2e/lab/resonance-lens-highlights.spec.js` (2 cases) and the
Compass/chronology journey in `e2e/lab/research-chapter.spec.js`.

```sh
npm run test:e2e -- --workers=1 e2e/lab/resonance-lens-highlights.spec.js e2e/lab/research-chapter.spec.js --grep "Lens|v2 migration preserves"
```

The overview case seeds the deterministic 0.4-scale scene with the last
Parallax Trials card rendered by Canvas rather than a DOM overlay. It verifies
that the Canvas paints a rotation-aware marker, Canvas-only titles are exposed
to screen readers, visible feedback names the focused item and match count,
and activation leaves item state and the save unchanged. The detail case
verifies the matching DOM card's visible marker and accessible **Highlighted
by the Resonance Lens** source. The filtered research-chapter journey checks
that Compass behavior and chronology progression remain intact. **Final
result:** 3/3 browser cases passed. The recorded red baseline was 2/2 failed:
overview status was missing and Canvas marker pixels did not change; detail
accessible naming omitted the Lens highlight source.

The unit and E2E coverage verify the collection-or-family match rule, selected
item exclusion, the unchanged 64-overlay cap, Canvas-only accessible titles,
the single Lens live announcement, and item/save immutability. Compass keeps
its distinct source label and cue. Reduced motion keeps a static marker and
status available. `npm run build` passed with Vite 8.3.5. Code review and
re-review found no actionable findings. The full test suite was not run. The
separate independent human-playtest/content-expansion gate remains open.
