/**
 * Return the other catalog items that share a focus object's collection, or
 * its family when the focus object has no collection.
 *
 * The focus object itself is intentionally excluded so callers can use the
 * returned length as the number of related items revealed by the Lens.
 */
export function getResonanceLensMatches(items, focusedItem) {
  if (!focusedItem) return [];

  return items.filter((item) => item.id !== focusedItem.id && (
    focusedItem.collectionId
      ? item.collectionId === focusedItem.collectionId
      : item.family === focusedItem.family
  ));
}
