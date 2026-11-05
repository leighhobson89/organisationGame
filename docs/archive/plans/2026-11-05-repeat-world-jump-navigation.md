# Plan: Repeatable World-Jump Navigation

**Status:** Complete. Focused navigation regressions, build, and scoped review passed; this plan is archived.

## Scope

Return the world-jump select to a neutral placeholder after every navigation action so the same target, including Starting area, can be selected repeatedly without choosing an intervening option. The placeholder is distinct from the real `start` action: use a disabled `value=""` option such as **Jump to location**, while `start` remains a selectable navigation option.

Preserve the fresh game's initial camera and existing Reset view behavior. Keep camera navigation on the existing camera persistence path; do not change placements, progression, or save schema.

## Acceptance criteria

- After each world-jump navigation action, the select returns to a disabled neutral placeholder with `value=""`; it does not use the real `start` value as its neutral state.
- The real **Starting area** option remains selectable from the neutral placeholder, so it can be activated again after the user pans away.
- A destination can be selected, followed by another navigation action, and then selected again to recenter the world.
- A scratch pad can be selected, followed by another navigation action, and then selected again to recenter the world.
- Fresh-start camera framing and the Reset view control retain their existing behavior.
- Navigation preserves existing camera persistence while causing no placement, progression, or save-schema effects.

## Focused test plan and baseline

The focused case is `World Jump repeats the same destination and scratch-pad navigation after panning away` in `e2e/lab/world-jump-repeat.spec.js`. It loads a fresh 3000 x 1800 overview fixture at camera scale 0.4 and pan 0, verifies the disabled `value=""` **Jump to location** placeholder on initial load, and checks navigation to the distant `case-parallax-trials` destination and `scratch-b` work surface. For each target it checks camera centering, confirms the selector resets to neutral, moves the camera away with ArrowRight, selects the same option again, and confirms the camera moves and recenters. It also selects the real Starting area action and verifies the selector returns to neutral.

The initial valid baseline showed the existing selector selected **Starting area** (`start`) instead of a neutral option, retained `destination:case-parallax-trials` after destination navigation, and retained `scratchpad:scratch-b` after scratch-pad navigation. The strengthened test requires the disabled neutral option and polls for camera movement after repeated selection.

## Final verification

- Focused repeat/mobile/Starting-area/Reset selection coverage passed 8/8. It verifies the disabled `value=""` **Jump to location** placeholder, repeat destination and scratch-pad selection after ArrowRight moves the camera away, and that the real `start` action returns to neutral.
- Existing unfinished-collection navigation passed 3/3.
- Vite build passed with 62 modules; scoped review found no actionable issues.
- Existing fresh-start framing and Reset behavior remain covered. Camera navigation continues on its existing persistence path; placements, progression, and save schema remain unchanged.
- The broader human-playtest/content-expansion gate remains open.

Finalized 2026-11-05 and archived as `docs/archive/plans/2026-11-05-repeat-world-jump-navigation.md`.
