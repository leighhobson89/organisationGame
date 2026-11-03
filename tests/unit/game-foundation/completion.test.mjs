import assert from 'node:assert/strict';
import test from 'node:test';
import { getCompletionStats, isGameComplete } from '../../../src/game/domain/completion.js';

const collections = [
  { id: 'collection-a', destinationId: 'destination-a', itemIds: ['a'] },
  { id: 'collection-b', destinationId: 'destination-b', itemIds: ['b'] },
];
const puzzles = [{ id: 'puzzle-a' }, { id: 'puzzle-b' }];

function correctItem(id, destinationId = `destination-${id}`) {
  return {
    id,
    correctDestinationId: destinationId,
    validation: 'correct',
    placement: { kind: 'destination', destinationId },
  };
}

function completeInput(overrides = {}) {
  return {
    items: [correctItem('a'), correctItem('b')],
    progress: {
      completedCollectionIds: ['collection-a', 'collection-b'],
      solvedPuzzleIds: ['puzzle-a', 'puzzle-b'],
      ownedSkills: ['resonance-lens'],
    },
    collections,
    puzzles,
    notebook: { discoveries: ['memory-impression-01'] },
    ...overrides,
  };
}

test('game completion requires at least one item and every item correctly filed in a destination', () => {
  const input = completeInput();
  assert.equal(isGameComplete(input), true);
  assert.equal(isGameComplete({ ...input, items: [] }), false);
  assert.equal(isGameComplete({ ...input, items: [input.items[0], { ...input.items[1], placement: { kind: 'workspace' } }] }), false);
  assert.equal(isGameComplete({ ...input, items: [input.items[0], { ...input.items[1], placement: { kind: 'scratchpad', scratchPadId: 'scratch-a' } }] }), false);
  assert.equal(isGameComplete({ ...input, items: [input.items[0], { ...input.items[1], validation: 'invalid' }] }), false);
  assert.equal(isGameComplete({ ...input, items: [input.items[0], { ...input.items[1], validation: 'unchecked' }] }), false);
  assert.equal(isGameComplete({
    ...input,
    items: [input.items[0], { ...input.items[1], placement: { kind: 'destination', destinationId: 'wrong-destination' } }],
  }), false, 'an item cannot count as restored outside its canonical destination');
});

test('game completion requires every catalog collection and puzzle to be complete', () => {
  const input = completeInput();
  const physicallyCompleteWithoutCollectionProgress = {
    ...input,
    progress: { ...input.progress, completedCollectionIds: [] },
  };
  assert.equal(isGameComplete(physicallyCompleteWithoutCollectionProgress), true,
    'correctly filed collection members complete their collections without progress IDs');
  assert.equal(getCompletionStats(physicallyCompleteWithoutCollectionProgress).completedCollectionCount, 2);
  assert.equal(isGameComplete({
    ...input,
    progress: { ...input.progress, solvedPuzzleIds: ['puzzle-a'] },
  }), false);
  const misfiledMemberWithStaleCollectionRecord = {
    ...input,
    items: [input.items[0], {
      ...input.items[1],
      validation: 'invalid',
      placement: { kind: 'destination', destinationId: 'wrong-destination' },
    }],
  };
  assert.equal(isGameComplete({
    ...misfiledMemberWithStaleCollectionRecord,
  }), false, 'a stale completed-collection record cannot replace correct member filing');
  assert.equal(getCompletionStats(misfiledMemberWithStaleCollectionRecord).completedCollectionCount, 1);
});

test('expected catalog item IDs prevent completion and count absent items as unrestored', () => {
  const input = completeInput({ expectedItemIds: ['a', 'b', 'required-current-item'] });

  assert.equal(isGameComplete(input), false, 'a required catalog object cannot be absent from the current save');
  const stats = getCompletionStats(input);
  assert.equal(stats.restoredItemCount, 2);
  assert.equal(stats.totalItemCount, 3);
  assert.equal(stats.restorationPercent, 67);
});

test('completion statistics count restored items, catalog progress, notebook discoveries, and owned skills', () => {
  const stats = getCompletionStats({
    items: [
      correctItem('a'),
      { ...correctItem('b'), validation: 'invalid' },
      { ...correctItem('c'), placement: { kind: 'workspace' } },
    ],
    progress: {
      completedCollectionIds: ['collection-a', 'collection-b', 'collection-a', 'unknown-collection'],
      solvedPuzzleIds: ['puzzle-a', 'unknown-puzzle'],
      ownedSkills: ['resonance-lens', 'resonance-lens'],
    },
    collections,
    puzzles: [puzzles[0]],
    notebook: { discoveries: ['memory-impression-01', 'discovery-bell-before-dawn'] },
  });

  assert.deepEqual(stats, {
    restoredItemCount: 1,
    totalItemCount: 3,
    restorationPercent: 33,
    completedCollectionCount: 1,
    totalCollectionCount: 2,
    solvedPuzzleCount: 1,
    totalPuzzleCount: 1,
    notebookDiscoveryCount: 2,
    ownedSkillCount: 1,
  });
});

test('missing notebook data reports zero discoveries in completion statistics', () => {
  const { notebook, ...input } = completeInput();
  assert.equal(getCompletionStats(input).notebookDiscoveryCount, 0);
});

test('completion statistics handle zero items and do not mutate their inputs', () => {
  const input = completeInput({
    items: [],
    progress: {
      completedCollectionIds: [],
      solvedPuzzleIds: [],
      ownedSkills: [],
    },
    notebook: { discoveries: [] },
  });
  Object.freeze(input.items);
  Object.freeze(input.progress.completedCollectionIds);
  Object.freeze(input.progress.solvedPuzzleIds);
  Object.freeze(input.progress.ownedSkills);
  Object.freeze(input.progress);
  Object.freeze(input.collections);
  Object.freeze(input.puzzles);
  Object.freeze(input.notebook.discoveries);
  Object.freeze(input.notebook);
  Object.freeze(input);

  assert.deepEqual(getCompletionStats(input), {
    restoredItemCount: 0,
    totalItemCount: 0,
    restorationPercent: 0,
    completedCollectionCount: 0,
    totalCollectionCount: 2,
    solvedPuzzleCount: 0,
    totalPuzzleCount: 2,
    notebookDiscoveryCount: 0,
    ownedSkillCount: 0,
  });
  assert.equal(isGameComplete(input), false);
});
