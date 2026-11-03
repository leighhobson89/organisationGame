import { WORLD_BOUNDS } from '../src/game/content/catalog.js';
import { generateLab } from '../src/game/content/generateLab.js';
import { DEFAULT_CONTENT_SEED } from '../src/game/persistence/gameState.js';

export const AUTHORED_ITEM_COUNT = 174;

/** Spread only generated filler through the remaining world, leaving authored locations intact. */
export function distributeSyntheticFiller(items) {
  let randomState = 0x51a7c0de;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 0x1_0000_0000;
  };
  const minimumX = 2600;
  const minimumY = 900;

  return items.map((item) => ({
    ...item,
    position: {
      x: minimumX + random() * (WORLD_BOUNDS.width - minimumX - item.width),
      y: minimumY + random() * (WORLD_BOUNDS.height - minimumY - item.height),
    },
  }));
}

/** Return fixed-ID v3 content while preserving all authored records and positions first. */
export function createBenchmarkItems(itemCount) {
  const generatedItems = generateLab(DEFAULT_CONTENT_SEED, itemCount);
  if (itemCount <= AUTHORED_ITEM_COUNT) return generatedItems;

  return [
    ...generatedItems.slice(0, AUTHORED_ITEM_COUNT),
    ...distributeSyntheticFiller(generatedItems.slice(AUTHORED_ITEM_COUNT)),
  ];
}
