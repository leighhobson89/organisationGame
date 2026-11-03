import { isCorrectlyFiled } from './completion.js';

/**
 * Keep the first-action guidance visible until a calibration member is filed
 * at the collection's canonical destination.
 */
export function shouldShowCalibrationLead({ items, collection } = {}) {
  if (!Array.isArray(items)
    || !Array.isArray(collection?.itemIds)
    || collection.itemIds.length === 0
    || typeof collection.destinationId !== 'string'
    || collection.destinationId.length === 0) {
    return false;
  }

  return !collection.itemIds.some((itemId) => {
    if (typeof itemId !== 'string' || itemId.length === 0) return false;

    const item = items.find((entry) => entry?.id === itemId);
    const placedDestinationId = item?.placement?.destinationId ?? item?.placement?.id;
    return isCorrectlyFiled(item) && placedDestinationId === collection.destinationId;
  });
}
