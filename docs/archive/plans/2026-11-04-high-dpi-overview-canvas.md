# High-DPI Overview Canvas

## Goal

Keep the full-world overview Canvas crisp on high-DPI displays without changing its CSS geometry, hit testing, or DOM overlay policy, and release its large backing bitmap while hidden.

## Scope and approach

1. Pass `cameraScale` from `WorldViewport` to `WorldOverviewCanvas`.
2. While visible, compute backing pixels per world unit as `round(clamp(cameraScale * devicePixelRatio, 0.5, 1) * 8) / 8`; use this value for the Canvas backing dimensions and drawing scale. Recompute when a quantized camera-scale step changes or `devicePixelRatio` changes.
3. When hidden, set the Canvas backing bitmap to `1×1` to release memory. Reopening must restore the appropriate backing resolution and drawing.
4. Preserve CSS geometry, hit testing, representation of all 5,024 items, and the 64-DOM-overlay limit.

## Acceptance values

For a `5200×3400` world at camera scale `0.45`:

| Device pixel ratio | Backing pixels per world unit | Backing bitmap |
| --- | ---: | ---: |
| 1 | 0.5 | `2600×1700` |
| 2 | 0.875 | `4550×2975` |

## Verification

- Add focused cases in `performance/browser-scaling-regression.spec.js` for the 5,024-item, `0.45`-scale view at DPR 1 and DPR 2. Check backing bitmap dimensions, unchanged CSS geometry and full item representation, and a Canvas-only hit target.
- Check that hiding the overview reduces its backing bitmap to `1×1`; reopening restores the DPR- and scale-appropriate dimensions, drawing, and Canvas-only hit behavior.
- Run the focused performance E2E with `npm run test:e2e:performance -- --workers=1` and run `npm run build` after implementation.
- Review scale quantization updates, DPR-change handling, and unchanged behavior outside the requested resolution and hidden-bitmap scope.

## Boundaries

- No changes to world CSS size, interaction mapping, item representation, or overlay cap.
- The separate independent human-playtest and content-expansion gate remains active.

## Test plan

- The 5,024-item case asserts the backing ratio `round(clamp(sceneScale * devicePixelRatio, 0.5, 1) * 8) / 8`, DPR 1 dimensions of `2600×1700`, and DPR 2 dimensions of `4550×2975` at scale `0.45`. It also checks all 5,024 items remain represented, no more than 64 `.lab-object` overlays are present, CSS dimensions remain equal to the world dimensions, and a visible Canvas item absent from the DOM can be hit-tested.
- The DPR 1 case changes `window.devicePixelRatio` to 2, dispatches `resize`, and checks that backing dimensions update. The 174-item DPR 2 lifecycle checks that the detail Canvas starts at `1×1`, overview dimensions match actual scene scale, CSS dimensions stay unchanged, hiding returns the bitmap to `1×1`, and reopening restores the expected dimensions and Canvas-only hit testing.
- Red baseline: at DPR 2 and scale `0.45`, the 5,024-item backing remained `2600×1700` instead of `4550×2975`; when the 174-item overview became hidden, its backing remained `2600×1700` instead of `1×1`.
- After implementation became available during the test-only iteration, both filtered cases passed **2/2**. The full `npm run test:e2e:performance -- --workers=1` suite passed **14/14**, `npm run build` passed with Vite 8.3.5 (**59 modules**), scoped manual review found no actionable issues, and `git diff --check` passed.
- The separate independent human-playtest and content-expansion gate remains active and is unchanged by this work.
