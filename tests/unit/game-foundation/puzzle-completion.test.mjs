import assert from 'node:assert/strict';
import test from 'node:test';

import { CHAPTER_COLLECTION_IDS, COLLECTIONS, PUZZLES } from '../../../src/game/content/catalog.js';
import { completeCollection } from '../../../src/game/domain/progression.js';
import { createNewGameState } from '../../../src/game/persistence/gameState.js';
import { planPuzzleCompletion } from '../../../src/game/domain/puzzleCompletion.js';

const pulsePuzzle = PUZZLES.find((puzzle) => puzzle.id === 'pulse-sequence');
const chronologyPuzzle = PUZZLES.find((puzzle) => puzzle.id === 'chronology-last-bell');
const harmonicCollection = COLLECTIONS.find((collection) => collection.id === 'harmonic-calibration');

function gameWithEarnedCollections(collectionIds = [], overrides = {}) {
  const base = createNewGameState();
  const progress = collectionIds.reduce((current, collectionId) => {
    const collection = COLLECTIONS.find((entry) => entry.id === collectionId);
    assert.ok(collection, `expected catalog collection ${collectionId}`);
    return completeCollection(current, collection);
  }, base.progress);

  return {
    ...base,
    ...overrides,
    progress: { ...progress, ...overrides.progress },
  };
}

function assertRejectedWithoutNextGame(result, reasonCode) {
  assert.equal(result.ok, false);
  assert.equal(result.reason, reasonCode);
  assert.equal(Object.hasOwn(result, 'nextGame'), false,
    'a rejected plan must not expose a partially updated game');
}

test('already solved puzzle rejection takes precedence over its missing unlock', () => {
  const game = gameWithEarnedCollections([], {
    progress: { solvedPuzzleIds: [pulsePuzzle.id], unlockedPuzzleIds: [] },
  });

  assertRejectedWithoutNextGame(
    planPuzzleCompletion({ game, puzzleId: pulsePuzzle.id }),
    'already-solved',
  );
});

test('unknown puzzle IDs are rejected without a next game', () => {
  const game = gameWithEarnedCollections();

  assertRejectedWithoutNextGame(
    planPuzzleCompletion({ game, puzzleId: 'unknown-puzzle' }),
    'unknown-puzzle',
  );
});

test('chronology completion is rejected for unmet prerequisites before checking its unlock', () => {
  const game = gameWithEarnedCollections();

  assertRejectedWithoutNextGame(
    planPuzzleCompletion({ game, puzzleId: chronologyPuzzle.id }),
    'prerequisites-unmet',
  );
});

test('a puzzle with satisfied prerequisites is still rejected when it is not unlocked', () => {
  const game = gameWithEarnedCollections(CHAPTER_COLLECTION_IDS, {
    progress: { unlockedPuzzleIds: [] },
  });

  assertRejectedWithoutNextGame(
    planPuzzleCompletion({ game, puzzleId: chronologyPuzzle.id }),
    'not-unlocked',
  );
});

test('solving the pulse puzzle records its solution, Memory Crystal stage, and clue', () => {
  const earnedGame = gameWithEarnedCollections([harmonicCollection.id]);
  const game = {
    ...earnedGame,
    metadata: { sessionLabel: 'review copy' },
    notebook: {
      ...earnedGame.notebook,
      discoveries: ['existing-discovery'],
      annotations: ['preserve this note'],
    },
  };
  const originalGame = structuredClone(game);

  const result = planPuzzleCompletion({ game, puzzleId: pulsePuzzle.id });

  assert.equal(result.ok, true);
  assert.equal(result.fromStage, 'Dormant');
  assert.equal(result.toStage, 'Memory Crystal');
  assert.ok(result.nextGame.progress.solvedPuzzleIds.includes(pulsePuzzle.id));
  assert.equal(result.nextGame.inventionStage, 'Memory Crystal');
  assert.deepEqual(result.nextGame.notebook.discoveries, [
    'existing-discovery',
    pulsePuzzle.reward.clueId,
  ]);
  assert.deepEqual(result.nextGame.notebook.annotations, ['preserve this note']);
  assert.deepEqual(result.nextGame.metadata, game.metadata);
  assert.deepEqual(result.nextGame.items, game.items);
  assert.deepEqual(result.nextGame.camera, game.camera);
  assert.deepEqual(game, originalGame, 'planning completion must not mutate the current game');
});

test('solving chronology awards the Chronology Wheel and its clue', () => {
  const game = gameWithEarnedCollections(CHAPTER_COLLECTION_IDS, {
    inventionStage: 'Memory Crystal',
  });

  const result = planPuzzleCompletion({ game, puzzleId: chronologyPuzzle.id });

  assert.equal(result.ok, true);
  assert.equal(result.fromStage, 'Memory Crystal');
  assert.equal(result.toStage, 'Chronology Wheel');
  assert.ok(result.nextGame.progress.solvedPuzzleIds.includes(chronologyPuzzle.id));
  assert.equal(result.nextGame.inventionStage, 'Chronology Wheel');
  assert.ok(result.nextGame.notebook.discoveries.includes(chronologyPuzzle.reward.clueId));
});

test('solving a puzzle does not add a reward clue that is already in the notebook', () => {
  const game = gameWithEarnedCollections([harmonicCollection.id], {
    notebook: { discoveries: [pulsePuzzle.reward.clueId, 'another-discovery'] },
  });

  const result = planPuzzleCompletion({ game, puzzleId: pulsePuzzle.id });

  assert.equal(result.ok, true);
  assert.equal(
    result.nextGame.notebook.discoveries.filter((id) => id === pulsePuzzle.reward.clueId).length,
    1,
  );
  assert.deepEqual(result.nextGame.notebook.discoveries, game.notebook.discoveries);
});

test('solving the pulse puzzle cannot regress an already assembled Chronology Wheel', () => {
  const game = gameWithEarnedCollections([harmonicCollection.id], {
    inventionStage: 'Chronology Wheel',
  });

  const result = planPuzzleCompletion({ game, puzzleId: pulsePuzzle.id });

  assert.equal(result.ok, true);
  assert.equal(result.fromStage, 'Chronology Wheel');
  assert.equal(result.toStage, 'Chronology Wheel');
  assert.equal(result.nextGame.inventionStage, 'Chronology Wheel');
});
