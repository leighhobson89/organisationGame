function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function destinationIdOf(item) {
  return item?.placement?.destinationId ?? item?.placement?.id;
}

function isCorrectlyFiled(item) {
  const correctDestinationId = item?.correctDestinationId;
  return typeof correctDestinationId === 'string'
    && correctDestinationId.length > 0
    && item?.validation === 'correct'
    && item?.placement?.kind === 'destination'
    && destinationIdOf(item) === correctDestinationId;
}

function isCollectionComplete(collection, items) {
  const itemIds = asArray(collection?.itemIds);
  if (itemIds.length === 0
    || typeof collection?.destinationId !== 'string') return false;

  return itemIds.every((itemId) => {
    const item = items.find((entry) => entry?.id === itemId);
    return isCorrectlyFiled(item) && destinationIdOf(item) === collection.destinationId;
  });
}

function countUniqueIds(values) {
  return new Set(asArray(values).filter((value) => typeof value === 'string' && value.length > 0)).size;
}

function completionCounts({ items, progress, collections, puzzles, expectedItemIds }) {
  const currentItems = asArray(items);
  const catalogCollections = asArray(collections);
  const catalogPuzzles = asArray(puzzles);
  const expectedIds = new Set(asArray(expectedItemIds).filter((id) => typeof id === 'string' && id.length > 0));
  const currentItemIds = new Set(currentItems.map((item) => item?.id).filter((id) => typeof id === 'string' && id.length > 0));
  const missingExpectedItemCount = [...expectedIds].filter((id) => !currentItemIds.has(id)).length;
  const solvedPuzzleIds = new Set(asArray(progress?.solvedPuzzleIds));
  const restoredItemCount = currentItems.filter(isCorrectlyFiled).length;
  const completedCollectionCount = catalogCollections.filter((collection) => (
    isCollectionComplete(collection, currentItems)
  )).length;
  const solvedPuzzleCount = catalogPuzzles.filter((puzzle) => (
    typeof puzzle?.id === 'string' && solvedPuzzleIds.has(puzzle.id)
  )).length;

  return {
    currentItems,
    missingExpectedItemCount,
    catalogCollections,
    catalogPuzzles,
    restoredItemCount,
    completedCollectionCount,
    solvedPuzzleCount,
  };
}

/**
 * Derive whether the supplied laboratory state has reached full restoration.
 * Completion is based on current item placement and catalog membership, plus
 * the solved-puzzle record; collection progress records alone are not enough.
 */
export function isGameComplete({ items, progress, collections, puzzles, expectedItemIds } = {}) {
  const counts = completionCounts({ items, progress, collections, puzzles, expectedItemIds });
  return counts.currentItems.length > 0
    && counts.missingExpectedItemCount === 0
    && counts.restoredItemCount === counts.currentItems.length
    && counts.completedCollectionCount === counts.catalogCollections.length
    && counts.solvedPuzzleCount === counts.catalogPuzzles.length;
}

/** Return read-only completion statistics derived from the supplied state. */
export function getCompletionStats({ items, progress, collections, puzzles, notebook, expectedItemIds } = {}) {
  const counts = completionCounts({ items, progress, collections, puzzles, expectedItemIds });
  const totalItemCount = counts.currentItems.length + counts.missingExpectedItemCount;

  return {
    restoredItemCount: counts.restoredItemCount,
    totalItemCount,
    restorationPercent: totalItemCount === 0
      ? 0
      : Math.round((counts.restoredItemCount / totalItemCount) * 100),
    completedCollectionCount: counts.completedCollectionCount,
    totalCollectionCount: counts.catalogCollections.length,
    solvedPuzzleCount: counts.solvedPuzzleCount,
    totalPuzzleCount: counts.catalogPuzzles.length,
    notebookDiscoveryCount: countUniqueIds(notebook?.discoveries),
    ownedSkillCount: countUniqueIds(progress?.ownedSkills),
  };
}
