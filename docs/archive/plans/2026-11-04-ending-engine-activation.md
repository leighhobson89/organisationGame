# Engine Ending Activation Visual Polish

## Goal

Give the existing decorative Engine projection a finite, one-shot activation: an abstract spatial trace forms during default motion, then remains fully formed and static. Reduced-motion users see the same completed static endpoint without animation.

## Scope and approach

1. Add focused regression coverage in `e2e/lab/full-restoration-ending.spec.js` for the one-shot default-motion activation and the fully formed static endpoint under reduced motion.
2. Keep the effect inside the existing decorative projection. Start each CSS animation once when the projection mounts; keep it finite and do not loop or restart it on rerenders. Reopening may remount the ending and replay the activation. The complete projection must settle after the brief activation.
3. Implement only the projection visual effect and its motion-preference behavior. Do not change layout, save data, progression, audio, or story copy.
4. Preserve all story uncertainties: do not resolve what the Professor chose, how it related to the Chaos Event, the Event's trigger, or Elian's response.

## Verification

- The focused activation case passed **1/1**, and `npx playwright test e2e/lab/full-restoration-ending.spec.js --workers=1` passed **15/15** after implementation.
- `npm run build` passed with Vite 8.3.5 (**59 modules**).
- Scoped review confirmed the outer ring runs once for **2.7s**, the trace forms once over **1.35s**, and the core activates after a **650ms delay** for **760ms**. All three effects settle without rerender restarts; reduced motion disables them and retains a visible, fully drawn static trace. No story, save, progression, or audio changes were made.

## Boundaries

- The separate independent human-playtest and content-expansion gate remains active.
- This polish does not add story meaning or gameplay effects.

## Test plan

- Add one `.completion-sequence__projection-trace` SVG with one animated `<path>`. In default motion, assert the path selector `.completion-sequence__projection-trace path` uses `completion-trace-form`, the existing `.completion-sequence__projection-core` uses `completion-core-activate`, and `.completion-sequence__projection-ring--outer` has a named activation rotation. Each animation must have nonzero duration and exactly one iteration; the outer ring duration must also be no more than 3000ms.
- Verify the trace and core remain inside `.completion-sequence__projection[aria-hidden="true"]`, that the projection has no image role, and that the completed projection settles after the brief activation.
- In reduced motion, all three animation names must be `none`, and the trace path must remain visible with opacity 1 and `stroke-dashoffset: 0` so the completed trace is static.
- The focused baseline was red as expected: the trace SVG was absent (expected one element, received zero), and the existing outer ring rotated indefinitely over 36000ms.
- After implementation, the focused activation case passed 1/1 and `npx playwright test e2e/lab/full-restoration-ending.spec.js --workers=1` passed 15/15; `npm run build` passed with Vite 8.3.5 (59 modules). Review confirmed the visual and reduced-motion acceptance criteria.
