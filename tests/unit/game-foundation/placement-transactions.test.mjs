import assert from 'node:assert/strict';
import test from 'node:test';

import { COLLECTIONS, DESTINATIONS, PUZZLES, SCRATCH_PADS } from '../../../src/game/content/catalog.js';
import { completeCollection } from '../../../src/game/domain/progression.js';
import { createNewGameState } from '../../../src/game/persistence/gameState.js';
import { getTargetSlotPosition } from '../../../src/game/world/placementLayout.js';
import { planBatchPlacement, planSinglePlacement } from '../../../src/game/domain/placementTransaction.js';

function correctPlacement(game, collection, itemId, slotIndex) {
  const item = game.items.find((entry) => entry.id === itemId);
  assert.ok(item, `expected catalog item ${itemId}`);

  const target = { kind: 'destination', id: collection.destinationId };
  const position = getTargetSlotPosition({
    target,
    item,
    slotIndex,
    destinations: DESTINATIONS,
    scratchPads: SCRATCH_PADS,
  });
  assert.ok(position, `expected a valid slot ${slotIndex} in ${collection.destinationId}`);

  return {
    ...item,
    position,
    placement: { kind: 'destination', destinationId: collection.destinationId, slotIndex },
    validation: 'correct',
  };
}

function gameWithCorrectCollections(collections, {
  omitItemId = null,
  omitItemIds = [],
  completedCollections = [],
} = {}) {
  const base = createNewGameState();
  const placements = new Map();
  const omittedItemIds = new Set([omitItemId, ...omitItemIds].filter(Boolean));

  for (const collection of collections) {
    collection.itemIds.forEach((itemId, slotIndex) => {
      if (!omittedItemIds.has(itemId)) placements.set(itemId, { collection, slotIndex });
    });
  }

  const items = base.items.map((item) => {
    const placement = placements.get(item.id);
    return placement ? correctPlacement(base, placement.collection, item.id, placement.slotIndex) : item;
  });
  const progress = completedCollections.reduce(
    (current, collection) => completeCollection(current, collection),
    base.progress,
  );

  return { ...base, items, progress };
}

test('single placement completes a collection, unlocks its gated puzzle, and adds its discovery once', () => {
  const chapterCollections = COLLECTIONS.filter((collection) => collection.chapter === 2);
  const completedBeforeMove = chapterCollections.slice(0, -1);
  const collection = chapterCollections.at(-1);
  const itemId = collection.itemIds.at(-1);
  const puzzle = PUZZLES.find((entry) => entry.id === collection.puzzleId);
  const game = gameWithCorrectCollections([...completedBeforeMove, collection], {
    omitItemId: itemId,
    completedCollections: completedBeforeMove,
  });
  const originalGame = structuredClone(game);

  const result = planSinglePlacement({
    game,
    itemId,
    target: { kind: 'destination', id: collection.destinationId },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.movedItems.map((item) => item.id), [itemId]);
  assert.deepEqual(result.validationCounts, { correct: 1, invalid: 0, unchecked: 0 });
  assert.deepEqual(result.newlyCompletedCollections.map((entry) => entry.id), [collection.id]);
  assert.deepEqual(result.newlyUnlockedPuzzles.map((entry) => entry.id), [puzzle.id]);
  assert.deepEqual(result.addedDiscoveryIds, [collection.discoveryId]);
  assert.deepEqual(result.changes.discoveries, [collection.discoveryId]);
  assert.equal(result.changes.progress.skillPoints, game.progress.skillPoints + collection.skillPointReward);
  assert.ok(result.changes.progress.completedCollectionIds.includes(collection.id));
  assert.ok(result.changes.progress.unlockedPuzzleIds.includes(puzzle.id));
  assert.equal(result.movedItems[0].validation, 'correct');
  assert.equal(result.movedItems[0].placement.destinationId, collection.destinationId);
  assert.deepEqual(game, originalGame, 'planning a placement must not mutate the current game');

  const committedGame = {
    ...game,
    items: result.changes.items,
    progress: result.changes.progress,
    notebook: { ...game.notebook, discoveries: result.changes.discoveries },
  };
  const repeated = planSinglePlacement({
    game: committedGame,
    itemId,
    target: { kind: 'destination', id: collection.destinationId },
  });

  assert.equal(repeated.ok, true);
  assert.deepEqual(repeated.addedDiscoveryIds, []);
  assert.equal(repeated.changes.discoveries.filter((id) => id === collection.discoveryId).length, 1);
  assert.deepEqual(repeated.newlyCompletedCollections, []);
  assert.deepEqual(repeated.newlyUnlockedPuzzles, []);
});

test('batch placement atomically moves valid and misfiled objects and reports each outcome', () => {
  const game = createNewGameState();
  const collection = COLLECTIONS.find((entry) => entry.id === 'harmonic-calibration');
  const correctItemId = collection.itemIds[0];
  const misfiledItemId = COLLECTIONS.find((entry) => entry.chapter === 2).itemIds[0];
  const itemIds = [misfiledItemId, correctItemId];
  const originalGame = structuredClone(game);

  const result = planBatchPlacement({
    game,
    itemIds,
    target: { kind: 'destination', id: collection.destinationId },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.validationCounts, { correct: 1, invalid: 1, unchecked: 0 });
  assert.deepEqual(result.movedItems.map((item) => item.id), game.items
    .filter((item) => itemIds.includes(item.id))
    .map((item) => item.id), 'batch results should follow current game-item order');
  assert.equal(result.movedItems.find((item) => item.id === correctItemId).validation, 'correct');
  assert.equal(result.movedItems.find((item) => item.id === misfiledItemId).validation, 'invalid');
  assert.deepEqual(result.newlyCompletedCollections, []);
  assert.deepEqual(result.newlyUnlockedPuzzles, []);
  assert.deepEqual(result.addedDiscoveryIds, []);
  assert.deepEqual(result.changes.discoveries, game.notebook.discoveries);
  assert.deepEqual(result.changes.progress, game.progress);

  for (const itemId of itemIds) {
    const moved = result.changes.items.find((item) => item.id === itemId);
    assert.equal(moved.placement.destinationId, collection.destinationId);
  }
  assert.deepEqual(game, originalGame, 'planning a batch must not partially mutate the current game');
});

test('a batch completing the final chapter collection earns its reward, unlocks chronology, and adds one discovery', () => {
  const chapterCollections = COLLECTIONS.filter((collection) => collection.chapter === 2);
  const completedBeforeMove = chapterCollections.slice(0, -1);
  const collection = chapterCollections.at(-1);
  const itemIds = collection.itemIds.slice(-2);
  const puzzle = PUZZLES.find((entry) => entry.id === collection.puzzleId);
  const game = gameWithCorrectCollections([...completedBeforeMove, collection], {
    omitItemIds: itemIds,
    completedCollections: completedBeforeMove,
  });
  const originalGame = structuredClone(game);

  const result = planBatchPlacement({
    game,
    itemIds,
    target: { kind: 'destination', id: collection.destinationId },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.validationCounts, { correct: 2, invalid: 0, unchecked: 0 });
  assert.deepEqual(result.newlyCompletedCollections.map((entry) => entry.id), [collection.id]);
  assert.deepEqual(result.newlyUnlockedPuzzles.map((entry) => entry.id), [puzzle.id]);
  assert.deepEqual(result.addedDiscoveryIds, [collection.discoveryId]);
  assert.deepEqual(result.changes.discoveries, [collection.discoveryId]);
  assert.equal(result.changes.discoveries.filter((id) => id === collection.discoveryId).length, 1);
  assert.equal(result.changes.progress.skillPoints, game.progress.skillPoints + collection.skillPointReward);
  assert.ok(result.changes.progress.completedCollectionIds.includes(collection.id));
  assert.ok(result.changes.progress.unlockedPuzzleIds.includes(puzzle.id));
  assert.deepEqual(game, originalGame, 'planning a completing batch must not mutate the current game');
});

test('batch placement rejects a capacity overflow without returning partial changes', () => {
  const base = createNewGameState();
  const scratchPad = SCRATCH_PADS[0];
  const target = { kind: 'scratchpad', id: scratchPad.id };
  const selectedItems = base.items.slice(0, 2);
  const occupiedItems = base.items.slice(2, 25);
  let occupiedIndex = 0;

  const items = base.items.map((item) => {
    if (!occupiedItems.some((occupied) => occupied.id === item.id)) return item;
    const position = getTargetSlotPosition({
      target,
      item,
      slotIndex: occupiedIndex,
      destinations: DESTINATIONS,
      scratchPads: SCRATCH_PADS,
    });
    assert.ok(position, `expected scratch-pad slot ${occupiedIndex}`);
    const moved = {
      ...item,
      position,
      placement: { kind: 'scratchpad', scratchPadId: scratchPad.id, slotIndex: occupiedIndex },
      validation: 'unchecked',
    };
    occupiedIndex += 1;
    return moved;
  });
  assert.equal(occupiedIndex, scratchPad.capacity - 1, 'one free slot lets the planner stage one item before failing');

  const game = { ...base, items };
  const originalGame = structuredClone(game);
  const result = planBatchPlacement({
    game,
    itemIds: selectedItems.map((item) => item.id),
    target,
  });

  assert.deepEqual(result.ok, false);
  assert.match(result.reason, /full/i);
  assert.deepEqual(Object.keys(result).sort(), ['ok', 'reason']);
  assert.deepEqual(game, originalGame, 'a rejected batch must leave every item and progression field untouched');
});
