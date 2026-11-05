import {
  COLLECTIONS,
  DESTINATIONS,
  getScratchPadsForOwnedSkills,
  PUZZLES,
  WORLD_BOUNDS,
} from '../content/catalog.js';
import { isCollectionComplete } from './completion.js';
import { validateDrop } from './placement.js';
import { completeCollection } from './progression.js';
import { getCanonicalItemRotation } from '../persistence/gameState.js';
import { allocateBatchTargetPlacements, allocateTargetPlacement } from '../world/placementLayout.js';

function keepPositionInsideWorld(position, item) {
  const width = item.width ?? 0;
  const height = item.height ?? 0;
  return {
    x: Math.max(WORLD_BOUNDS.x, Math.min(WORLD_BOUNDS.x + WORLD_BOUNDS.width - width, position.x)),
    y: Math.max(WORLD_BOUNDS.y, Math.min(WORLD_BOUNDS.y + WORLD_BOUNDS.height - height, position.y)),
  };
}

function ownedScratchPads(game) {
  return getScratchPadsForOwnedSkills(game.progress?.ownedSkills ?? []);
}

function createMovedItem(item, target, allocation, game) {
  const nextPosition = keepPositionInsideWorld(allocation.position, item);
  const allocatedTarget = {
    ...target,
    ...(Number.isInteger(allocation.slotIndex) ? { slotIndex: allocation.slotIndex } : {}),
  };
  const validation = validateDrop(item, allocatedTarget);

  return {
    ...item,
    position: nextPosition,
    placement: allocation.placement,
    rotation: allocation.placement.kind === 'workspace'
      ? getCanonicalItemRotation(item.id, game.contentSeed)
      : 0,
    validation: validation.status,
    previousWorkspacePosition: target.kind === 'workspace'
      ? nextPosition
      : target.kind === 'destination' && item.placement?.kind === 'workspace'
        ? item.position
        : item.previousWorkspacePosition ?? item.position,
  };
}

function countValidationStatuses(movedItems) {
  const counts = { correct: 0, invalid: 0, unchecked: 0 };
  for (const item of movedItems) {
    if (Object.hasOwn(counts, item.validation)) counts[item.validation] += 1;
  }
  return counts;
}

function collectProgression(game, items, { includeAllDiscoveries }) {
  let progress = game.progress;
  const newlyCompletedCollections = [];
  const previouslyUnlockedPuzzleIds = new Set(progress.unlockedPuzzleIds ?? []);

  for (const collection of COLLECTIONS) {
    if (isCollectionComplete(collection, items)
      && !(progress.completedCollectionIds ?? []).includes(collection.id)) {
      progress = completeCollection(progress, collection);
      newlyCompletedCollections.push(collection);
    }
  }

  const newlyUnlockedPuzzles = PUZZLES.filter((puzzle) => (
    (progress.unlockedPuzzleIds ?? []).includes(puzzle.id)
      && !previouslyUnlockedPuzzleIds.has(puzzle.id)
  ));
  const discoveries = [...(game.notebook?.discoveries ?? [])];
  const collectionsForDiscoveries = includeAllDiscoveries
    ? newlyCompletedCollections
    : newlyCompletedCollections.slice(-1);
  const addedDiscoveryIds = [];

  for (const collection of collectionsForDiscoveries) {
    const discoveryId = collection.discoveryId;
    if (discoveryId && !discoveries.includes(discoveryId)) {
      discoveries.push(discoveryId);
      addedDiscoveryIds.push(discoveryId);
    }
  }

  return {
    progress,
    discoveries,
    addedDiscoveryIds,
    newlyCompletedCollections,
    newlyUnlockedPuzzles,
  };
}

function buildSuccess(game, items, movedItems, { includeAllDiscoveries }) {
  const progression = collectProgression(game, items, { includeAllDiscoveries });
  return {
    ok: true,
    changes: {
      items,
      progress: progression.progress,
      discoveries: progression.discoveries,
    },
    movedItems,
    validationCounts: countValidationStatuses(movedItems),
    newlyCompletedCollections: progression.newlyCompletedCollections,
    newlyUnlockedPuzzles: progression.newlyUnlockedPuzzles,
    addedDiscoveryIds: progression.addedDiscoveryIds,
  };
}

/** Plan one placement without changing the supplied game state. */
export function planSinglePlacement({ game, itemId, target, position } = {}) {
  const item = game?.items?.find((entry) => entry.id === itemId);
  if (!item) return { ok: false, reason: 'That object is no longer available.' };

  const desiredPosition = position ? keepPositionInsideWorld(position, item) : undefined;
  const allocation = allocateTargetPlacement({
    target,
    item,
    items: game.items,
    destinations: DESTINATIONS,
    scratchPads: ownedScratchPads(game),
    preferredPosition: desiredPosition
      ? target?.kind === 'workspace'
        ? desiredPosition
        : {
          x: desiredPosition.x + (item.width ?? 0) / 2,
          y: desiredPosition.y + (item.height ?? 0) / 2,
        }
      : undefined,
  });
  if (!allocation.ok) return { ok: false, reason: allocation.reason };

  const movedItem = createMovedItem(item, target, allocation, game);
  const items = game.items.map((entry) => entry.id === itemId ? movedItem : entry);
  return buildSuccess(game, items, [movedItem], { includeAllDiscoveries: false });
}

/** Plan an atomic batch placement without changing the supplied game state. */
export function planBatchPlacement({ game, itemIds, target } = {}) {
  const allocationResult = allocateBatchTargetPlacements({
    target,
    itemIds,
    items: game?.items,
    destinations: DESTINATIONS,
    scratchPads: ownedScratchPads(game ?? {}),
  });
  if (!allocationResult.ok) return { ok: false, reason: allocationResult.reason };

  const allocationById = new Map(allocationResult.allocations.map((allocation) => [allocation.itemId, allocation]));
  const movedItems = [];
  const items = game.items.map((item) => {
    const allocation = allocationById.get(item.id);
    if (!allocation) return item;

    const movedItem = createMovedItem(item, target, allocation, game);
    movedItems.push(movedItem);
    return movedItem;
  });

  return buildSuccess(game, items, movedItems, { includeAllDiscoveries: true });
}
