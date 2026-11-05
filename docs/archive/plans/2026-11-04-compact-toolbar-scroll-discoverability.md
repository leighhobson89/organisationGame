# Compact Toolbar Scroll Discoverability

## Goal

Make clipped controls on the compact 44px horizontal toolbar rail discoverable while preserving its geometry and hit testing.

## Scope and approach

1. Track left and right overflow from the rail's `scrollLeft`, `scrollWidth`, and `clientWidth`. Recalculate on scroll, viewport resize, toolbar/content resize, and rail content mutations.
2. Render a brass chevron as a decorative sibling outside each clipped edge. Position the chevron 6px beyond the toolbar bounds so it does not cover clipped control labels. Hide it when that edge has no overflow.
3. Keep the chevrons outside hit testing with `pointer-events: none`; preserve the 44px rail, its scrollport, control positions, and interaction mapping.

## Acceptance

- At `320x360`, only the right cue appears at the rail's start; both appear in the middle; only the left appears at the end.
- The cue centers stay 5px from their matching toolbar edge (within 1px), and neither cue intercepts pointer input or covers control text.
- Scroll, viewport/rail resize, and content-size changes update overflow state and cue visibility.
- At `1440x900`, the toolbar fits and neither cue appears.
- Existing toolbar controls keep their geometry, center hit testing, keyboard focus scrolling, and touch scrolling.

## Test plan

- Add a focused regression to `e2e/lab/mobile-toolbar.spec.js` for start, middle, and end states at `320x360`, and a no-overflow desktop state at `1440x900`.
- Check cue presence by edge, `pointer-events: none`, direct sibling placement, and center alignment 5px outside the matching toolbar edge (within 1px). Confirm **Zoom in** remains hit-testable at its center.
- Red baseline: the initial `320x360` rail had no right cue (expected one).
- Run the complete focused mobile-toolbar spec after implementation and visually inspect the start, middle, and end states.

## Outcome

`WorldViewport` tracks overflow on scroll and observes toolbar/content changes and viewport resizing. It positions sibling chevrons outside the rail and hides them when their edge fits. The focused `npm run test:e2e -- --workers=1 e2e/lab/mobile-toolbar.spec.js` run passed 17/17. `npm run build` passed with Vite 8.3.5 and 59 modules. Visual review at `320x360` confirmed that cues remain outside the clipped labels at the start, middle, and end. The full suite was not run. Independent human playtesting remains deferred and content expansion remains gated.

## Boundaries

- Desktop toolbar behavior remains unchanged.
- No story, authored content, save, or gameplay changes.
