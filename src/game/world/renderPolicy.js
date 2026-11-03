const OVERVIEW_ENTER_SCALE = 0.4;
const DETAIL_EXIT_SCALE = 0.5;
const DETAIL_ENTER_ITEM_LIMIT = 256;
const DETAIL_EXIT_ITEM_LIMIT = 192;

/**
 * Pick a renderer mode with a small hysteresis band to avoid switching modes
 * repeatedly while zooming around a boundary.
 */
export function getRenderMode({ currentMode, scale, visibleCount }) {
  if (currentMode === 'overview') {
    return scale >= DETAIL_EXIT_SCALE && visibleCount <= DETAIL_EXIT_ITEM_LIMIT
      ? 'detail'
      : 'overview';
  }

  return scale <= OVERVIEW_ENTER_SCALE || visibleCount > DETAIL_ENTER_ITEM_LIMIT
    ? 'overview'
    : 'detail';
}
