import { COLLECTIONS, PUZZLES } from '../content/catalog.js';

function unique(values) {
  return [...new Set(Array.isArray(values) ? values : [])];
}

/**
 * Apply a collection's one-time reward and puzzle unlock immutably.
 * This records that the collection was completed, so returning to it cannot
 * award duplicate skill points.
 */
export function completeCollection(progress, collection) {
  if (!progress || typeof progress !== 'object') {
    throw new TypeError('Progress state is required.');
  }

  if (!collection || typeof collection.id !== 'string' || collection.id.length === 0) {
    throw new TypeError('A collection with an id is required.');
  }

  const completedCollectionIds = unique(progress.completedCollectionIds);
  if (completedCollectionIds.includes(collection.id)) return progress;

  const nextCompletedCollectionIds = [...completedCollectionIds, collection.id];
  const unlockedPuzzleIds = unique(progress.unlockedPuzzleIds);
  if (typeof collection.puzzleId === 'string' && collection.puzzleId.length > 0) {
    const puzzle = PUZZLES.find((entry) => entry.id === collection.puzzleId);
    const requiredCollections = puzzle?.requiresCompletedCollectionIds ?? [];
    const gateIsOpen = requiredCollections.every((id) => nextCompletedCollectionIds.includes(id));
    if (gateIsOpen) unlockedPuzzleIds.push(collection.puzzleId);
  }

  const reward = collection.skillPointReward ?? 1;
  if (!Number.isFinite(reward) || reward < 0) {
    throw new RangeError('A collection skill-point reward must be a non-negative number.');
  }

  return {
    ...progress,
    skillPoints: (Number.isFinite(progress.skillPoints) ? progress.skillPoints : 0) + reward,
    completedCollectionIds: nextCompletedCollectionIds,
    unlockedPuzzleIds: unique(unlockedPuzzleIds),
  };
}

function isCorrectCollectionPlacement(item, collection) {
  const placement = item?.placement;
  return item?.validation === 'correct'
    && placement?.kind === 'destination'
    && (placement.destinationId ?? placement.id) === collection.destinationId;
}

/**
 * Find one loose or misfiled chapter sibling of the selected object.
 * The helper only returns an ID; it never changes item or progress data.
 */
export function findMissingCollectionMember(items, selectedItemId) {
  if (!Array.isArray(items) || typeof selectedItemId !== 'string') return null;
  const selectedItem = items.find((item) => item?.id === selectedItemId);
  if (!selectedItem?.collectionId) return null;

  const collection = COLLECTIONS.find((entry) => entry.id === selectedItem.collectionId && entry.chapter === 2);
  if (!collection) return null;

  const missingIds = collection.itemIds.filter((itemId) => {
    const member = items.find((item) => item?.id === itemId);
    return member && !isCorrectCollectionPlacement(member, collection);
  });

  return missingIds.find((itemId) => itemId !== selectedItemId) ?? missingIds[0] ?? null;
}
