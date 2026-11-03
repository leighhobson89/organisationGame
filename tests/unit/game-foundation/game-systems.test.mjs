import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { generateLab, generateLegacyLab } from '../../../src/game/content/generateLab.js';
import { validateDrop } from '../../../src/game/domain/placement.js';
import { completeCollection, findMissingCollectionMember } from '../../../src/game/domain/progression.js';
import { screenToWorld, worldToScreen, zoomAtPointer } from '../../../src/game/world/camera.js';
import { SpatialIndex } from '../../../src/game/world/spatialIndex.js';
import { allocateBatchTargetPlacements, allocateTargetPlacement, getTargetSlotPosition } from '../../../src/game/world/placementLayout.js';
import { decodeSave, encodeSave, importSave } from '../../../src/game/persistence/save.js';
import { createNewGameState, CURRENT_GAME_STATE_VERSION, getCanonicalItemRotation, normalizeGameState } from '../../../src/game/persistence/gameState.js';
import { loadGameFromStorage } from '../../../src/game/persistence/loadGame.js';
import * as catalog from '../../../src/game/content/catalog.js';
import LZString from 'lz-string';

const {
  COLLECTIONS,
  DESTINATIONS,
  PUZZLES,
  SCRATCH_PADS,
  SKILLS,
  WORLD_BOUNDS,
} = catalog;
const getScratchPadsForOwnedSkills = catalog.getScratchPadsForOwnedSkills;

function scratchPadsForOwnedSkills(ownedSkillIds) {
  if (typeof getScratchPadsForOwnedSkills === 'function') return getScratchPadsForOwnedSkills(ownedSkillIds);
  if (!ownedSkillIds.includes('modular-worktables')) return SCRATCH_PADS;
  return SCRATCH_PADS.map((pad) => ({
    ...pad,
    capacity: 30,
    layout: { ...pad.layout, rows: 6 },
  }));
}

const approximately = (actual, expected, epsilon = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} should be close to ${expected}`);
};

function measureGeneratedOverlaps(items) {
  let overlappingPairs = 0;
  const overlappingItemIds = new Set();
  const fullyOccludedItemIds = new Set();

  for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
      const left = items[leftIndex];
      const right = items[rightIndex];
      if (left.authored === true && right.authored === true) continue;

      const overlapLeft = Math.max(left.position.x, right.position.x);
      const overlapTop = Math.max(left.position.y, right.position.y);
      const overlapRight = Math.min(left.position.x + left.width, right.position.x + right.width);
      const overlapBottom = Math.min(left.position.y + left.height, right.position.y + right.height);
      if (overlapRight <= overlapLeft || overlapBottom <= overlapTop) continue;

      overlappingPairs += 1;
      overlappingItemIds.add(left.id);
      overlappingItemIds.add(right.id);

      const coversLeft = overlapLeft <= left.position.x
        && overlapTop <= left.position.y
        && overlapRight >= left.position.x + left.width
        && overlapBottom >= left.position.y + left.height;
      const coversRight = overlapLeft <= right.position.x
        && overlapTop <= right.position.y
        && overlapRight >= right.position.x + right.width
        && overlapBottom >= right.position.y + right.height;
      if (coversLeft) fullyOccludedItemIds.add(left.id);
      if (coversRight) fullyOccludedItemIds.add(right.id);
    }
  }

  return { overlappingPairs, overlappingItemIds, fullyOccludedItemIds };
}

test('seeded lab generation is reproducible and spans multiple item families', () => {
  const first = generateLab('first-shift', 150);
  const second = generateLab('first-shift', 150);
  const first174 = generateLab('first-shift', 174);
  const repeated174 = generateLab('first-shift', 174);

  assert.equal(first.length, 150);
  assert.deepEqual(first, second);
  assert.deepEqual(first174, repeated174, 'the full new-game layout should repeat for the same seed');
  assert.notDeepEqual(first174, generateLab('another-shift', 174), 'different seeds should produce different filler layouts');
  assert.equal(new Set(first.map((item) => item.id)).size, 150, 'every item should have a stable unique id');
  assert.ok(new Set(first.map((item) => item.family)).size >= 4, 'the laboratory should contain varied object families');
});

test('large legacy generation preserves the exact first 150 item layout prefix', () => {
  const seed = 'palimpsest-first-shift';
  const freshGameItems = generateLegacyLab(seed, 150);
  const maximumItems = generateLegacyLab(seed, 5000).slice(0, 150);

  assert.deepEqual(maximumItems, freshGameItems,
    'large-count fallback placement must not change the optimized fresh-game slice');
});

test('chapter content preserves all 150 canonical objects and appends three deterministic eight-item collections', () => {
  const seed = 'palimpsest-first-shift';
  const original = generateLab(seed, 150);
  const expanded = generateLab(seed, 174);
  const repeated = generateLab(seed, 174);
  const canonicalFingerprint = createHash('sha256').update(JSON.stringify(original)).digest('hex');

  assert.equal(canonicalFingerprint, '2cc1aa9b7ba1a64e9bcc22bea5b6b68d5e8c73a2ccd29f0bb4fc882d8afa3c52',
    'the original 150 canonical records remain seeded; only their initial filler positions changed');
  assert.deepEqual(expanded.slice(0, 150), original, 'chapter generation must append without changing the first 150 records');
  assert.deepEqual(expanded, repeated, 'all chapter IDs and starting positions must be deterministic for a seed');
  assert.equal(expanded.length, 174);
  assert.equal(new Set(expanded.map((item) => item.id)).size, 174);

  const chapterItems = expanded.slice(150);
  assert.equal(chapterItems.length, 24);
  assert.ok(chapterItems.every((item) => item.authored === true), 'all appended chapter objects should be authored');
  assert.ok(chapterItems.every((item) => item.collectionId), 'every chapter object belongs to a chapter collection');
  const chapterCollectionIds = [...new Set(chapterItems.map((item) => item.collectionId))].sort();
  assert.equal(chapterCollectionIds.length, 3);

  for (const collectionId of chapterCollectionIds) {
    const members = chapterItems.filter((item) => item.collectionId === collectionId);
    assert.equal(members.length, 8, `${collectionId} should have eight authored members`);
    assert.deepEqual(
      Object.fromEntries(['handwritten-note', 'experiment-record', 'map-fragment', 'formula-card'].map(
        (family) => [family, members.filter((item) => item.family === family).length],
      )),
      { 'handwritten-note': 2, 'experiment-record': 2, 'map-fragment': 2, 'formula-card': 2 },
      `${collectionId} must contain two items from each planned family`,
    );
  }

  const chapterCollections = COLLECTIONS.filter((collection) => chapterCollectionIds.includes(collection.id));
  assert.equal(chapterCollections.length, 3, 'each generated chapter group should have catalog collection metadata');
  assert.equal(new Set(chapterCollections.map((collection) => collection.destinationId)).size, 3,
    'each chapter collection needs a dedicated destination');
  for (const collection of chapterCollections) {
    const destination = DESTINATIONS.find((entry) => entry.id === collection.destinationId);
    assert.ok(destination, `${collection.id} should point to a known destination`);
    assert.equal(destination.slotCount, 8);
    assert.equal(destination.layout.columns, 4);
    assert.equal(destination.layout.rows, 2);
    assert.equal(collection.itemIds.length, 8);
    assert.deepEqual(new Set(collection.itemIds), new Set(chapterItems
      .filter((item) => item.collectionId === collection.id).map((item) => item.id)));
  }
});

test('174-item generation preserves the ordered content contract independently of positions', () => {
  const items = generateLab('palimpsest-first-shift', 174);
  const nonPositionContent = items.map(({ position, ...content }) => content);
  const contentFingerprint = createHash('sha256').update(JSON.stringify(nonPositionContent)).digest('hex');

  assert.equal(items.length, 174);
  assert.equal(contentFingerprint, 'eccce8b298bb74cb2872f11906fbcd2df50f1089c0e1225ad54a83f17e301374',
    'the ordered IDs, families, clues, destinations, and all other generated content must stay unchanged');
});

test('174-item generated positions stay inside the world bounds across seeds', () => {
  for (const seed of ['first-shift', 'palimpsest-first-shift', 'alternate-position-shift']) {
    const items = generateLab(seed, 174);
    assert.equal(items.length, 174);

    for (const item of items) {
      assert.ok(item.position.x >= WORLD_BOUNDS.x, `${seed}: ${item.id} starts left of the world bounds`);
      assert.ok(item.position.y >= WORLD_BOUNDS.y, `${seed}: ${item.id} starts above the world bounds`);
      assert.ok(item.position.x + item.width <= WORLD_BOUNDS.x + WORLD_BOUNDS.width,
        `${seed}: ${item.id} extends past the right world bound`);
      assert.ok(item.position.y + item.height <= WORLD_BOUNDS.y + WORLD_BOUNDS.height,
        `${seed}: ${item.id} extends past the bottom world bound`);
    }
  }
});

test('authored collection groups keep their established starting coordinates', () => {
  const items = generateLab('palimpsest-first-shift', 174);
  const calibrationCards = items.filter((item) => item.collectionId === 'harmonic-calibration');
  const calibrationPositions = calibrationCards.map((item, index) => ({
    id: item.id,
    position: item.position,
    expected: { x: 980 + (index % 4) * 104, y: 520 + Math.floor(index / 4) * 82 },
  }));
  assert.ok(calibrationPositions.every(({ position, expected }) => (
    position.x === expected.x && position.y === expected.y
  )), 'the authored calibration folio coordinates must remain fixed');

  const chapterOrigins = new Map([
    ['bell-before-dawn', { x: 2940, y: 760 }],
    ['meridian-survey', { x: 3630, y: 760 }],
    ['parallax-trials', { x: 4320, y: 760 }],
  ]);
  for (const collection of COLLECTIONS.filter((entry) => entry.chapter === 2)) {
    const origin = chapterOrigins.get(collection.id);
    const itemsById = new Map(items.map((item) => [item.id, item]));
    collection.itemIds.forEach((itemId, index) => {
      const item = itemsById.get(itemId);
      const expected = { x: origin.x + (index % 4) * 116, y: origin.y + Math.floor(index / 4) * 88 };
      assert.deepEqual(item.position, expected, `${itemId} is an authored chapter item whose coordinates stay fixed`);
    });
  }
});

test('174-item generated filler materially reduces overlap and avoids full occlusion', () => {
  const items = generateLab('palimpsest-first-shift', 174);
  const metrics = measureGeneratedOverlaps(items);
  const maximumOverlappingPairs = Math.floor(259 * 0.8);

  assert.ok(metrics.overlappingPairs <= maximumOverlappingPairs,
    `${metrics.overlappingPairs} overlap pairs should be no more than 80% of the 259-pair baseline`);
  assert.equal(metrics.fullyOccludedItemIds.size, 0,
    `fully obscured generated items: ${[...metrics.fullyOccludedItemIds].join(', ')}`);
});

test('a new game includes the 24 authored chapter items', () => {
  const state = createNewGameState();

  assert.equal(state.items.length, 174);
  assert.equal(state.version, CURRENT_GAME_STATE_VERSION);
  assert.equal(new Set(state.items.map((item) => item.id)).size, state.items.length);
});

test('authored calibration cards remain individually clickable in the 174-item starting layout', () => {
  const items = generateLab('first-shift', 174);
  const calibrationCards = items.filter((item) => item.id.startsWith('calibration-card-'));
  const minimumGap = 6;

  assert.equal(calibrationCards.length, 8, 'the authored calibration collection should contain eight cards');

  for (const card of calibrationCards) {
    for (const other of items) {
      if (other.id === card.id) continue;

      const separatedHorizontally = card.position.x + card.width + minimumGap < other.position.x
        || other.position.x + other.width + minimumGap < card.position.x;
      const separatedVertically = card.position.y + card.height + minimumGap < other.position.y
        || other.position.y + other.height + minimumGap < card.position.y;

      assert.ok(
        separatedHorizontally || separatedVertically,
        `${card.id} overlaps or crowds ${other.id}; calibration cards must remain individually clickable`,
      );
    }
  }
});

test('final placement validation marks mistakes but keeps the chosen destination', () => {
  const item = { id: 'note-aster-01', correctDestinationId: 'drawer-field-notes' };
  const correctTarget = { kind: 'destination', id: 'drawer-field-notes' };
  const wrongTarget = { kind: 'destination', id: 'cabinet-blueprints' };

  const correct = validateDrop(item, correctTarget);
  assert.equal(correct.status, 'correct');
  assert.deepEqual(correct.target, correctTarget);

  const incorrect = validateDrop(item, wrongTarget);
  assert.equal(incorrect.status, 'invalid');
  assert.deepEqual(incorrect.target, wrongTarget, 'an incorrect item stays in the place where the player dropped it');
});

test('workspace and scratch-pad drops remain unvalidated', () => {
  const item = { id: 'gear-copper-01', correctDestinationId: 'bin-clockwork' };
  const targets = [
    { kind: 'workspace', x: 260, y: 140 },
    { kind: 'scratchpad', id: 'scratch-a' },
  ];

  for (const target of targets) {
    const result = validateDrop(item, target);
    assert.equal(result.status, 'unchecked');
    assert.deepEqual(result.target, target);
  }
});

test('camera transforms are inverse and cursor-centered zoom preserves the world point', () => {
  const camera = { panX: -380, panY: 215, scale: 0.8 };
  const worldPoint = { x: 1240, y: 680 };
  const screenPoint = worldToScreen(worldPoint, camera);
  const roundTrip = screenToWorld(screenPoint, camera);

  approximately(roundTrip.x, worldPoint.x);
  approximately(roundTrip.y, worldPoint.y);

  const pointer = { x: 720, y: 390 };
  const pointBeforeZoom = screenToWorld(pointer, camera);
  const zoomed = zoomAtPointer(camera, pointer, 1.35);
  const pointAfterZoom = screenToWorld(pointer, zoomed);

  approximately(pointAfterZoom.x, pointBeforeZoom.x);
  approximately(pointAfterZoom.y, pointBeforeZoom.y);
  assert.equal(zoomed.scale, 1.35);
});

test('spatial index returns only entries intersecting the requested viewport', () => {
  const index = new SpatialIndex(100);
  index.insert({ id: 'visible-note', x: 20, y: 30, width: 40, height: 25 });
  index.insert({ id: 'overlapping-gear', x: 95, y: 95, width: 30, height: 30 });
  index.insert({ id: 'far-map', x: 520, y: 460, width: 80, height: 50 });

  const results = index.query({ x: 0, y: 0, width: 120, height: 120 });
  assert.deepEqual(new Set(results.map((item) => item.id)), new Set(['visible-note', 'overlapping-gear']));
});

test('spatial queries resolve cell candidates without scanning the full entries map', () => {
  const index = new SpatialIndex(100);
  index.insert({ id: 'visible-note', x: 20, y: 30, width: 40, height: 25 });

  for (let itemNumber = 0; itemNumber < 1000; itemNumber += 1) {
    index.insert({ id: `distant-item-${itemNumber}`, x: 1000 + itemNumber * 120, y: 900, width: 30, height: 30 });
  }

  const originalIterator = index.entries[Symbol.iterator];
  let scannedEntries = 0;
  index.entries[Symbol.iterator] = function* trackFullMapScan() {
    for (const entry of originalIterator.call(this)) {
      scannedEntries += 1;
      yield entry;
    }
  };

  const results = index.query({ x: 0, y: 0, width: 120, height: 120 });

  assert.deepEqual(results.map((item) => item.id), ['visible-note']);
  assert.equal(scannedEntries, 0, 'the query should look up only IDs gathered from intersecting grid cells');
});

test('collection completion grants one skill point and unlocks its puzzle once', () => {
  const initial = {
    skillPoints: 0,
    completedCollectionIds: [],
    unlockedPuzzleIds: [],
  };
  const collection = { id: 'blueprints-astronomy', puzzleId: 'astronomy-overlay' };

  const firstCompletion = completeCollection(initial, collection);
  assert.equal(firstCompletion.skillPoints, 1);
  assert.deepEqual(firstCompletion.completedCollectionIds, ['blueprints-astronomy']);
  assert.deepEqual(firstCompletion.unlockedPuzzleIds, ['astronomy-overlay']);
  assert.deepEqual(initial, { skillPoints: 0, completedCollectionIds: [], unlockedPuzzleIds: [] }, 'progression updates should not mutate the previous state');

  const repeatedCompletion = completeCollection(firstCompletion, collection);
  assert.deepEqual(repeatedCompletion, firstCompletion, 'replaying a collection reward should not duplicate it');
});

test('chronology gate stays locked until each of the three chapter collections is complete', () => {
  const chapterCollectionIds = new Set(generateLab('palimpsest-first-shift', 174)
    .slice(150).map((item) => item.collectionId));
  const chapterCollections = COLLECTIONS.filter((collection) => chapterCollectionIds.has(collection.id));
  const chronology = PUZZLES.find((puzzle) => /chronolog/i.test(puzzle.id) || /chronolog/i.test(puzzle.title));

  assert.equal(chapterCollections.length, 3, 'the chronology gate needs all three authored collection definitions');
  assert.ok(chronology, 'the chapter must define a chronology puzzle');
  assert.ok(chapterCollections.every((collection) => collection.puzzleId === chronology.id),
    'all three collections should point to the shared chronology gate');

  let progress = { skillPoints: 0, completedCollectionIds: [], unlockedPuzzleIds: [] };
  for (const [index, collection] of chapterCollections.entries()) {
    progress = completeCollection(progress, collection);
    assert.equal(progress.skillPoints, index + 1, 'each newly completed collection grants one skill point');
    assert.ok(progress.completedCollectionIds.includes(collection.id));
    assert.equal(progress.unlockedPuzzleIds.includes(chronology.id), index === chapterCollections.length - 1,
      'the chronology puzzle must remain locked before the final chapter collection');
  }

  const completedAgain = completeCollection(progress, chapterCollections[2]);
  assert.deepEqual(completedAgain, progress, 'a completed chapter collection cannot grant another point or unlock');
});

test('a forged v3 chronology unlock is rejected unless all chapter items are correctly filed', () => {
  const forged = createNewGameState();
  forged.progress.unlockedPuzzleIds = ['chronology-last-bell'];

  assert.throws(() => normalizeGameState(forged), /chronology puzzle progress|collection prerequisites/i);
});

test('the missing-member compass returns one unfiled member without mutating items, including the selected last member', () => {
  const collection = COLLECTIONS.find((entry) => entry.chapter === 2);
  const makeMembers = (missingIds) => collection.itemIds.map((id) => ({
    id,
    collectionId: collection.id,
    validation: missingIds.has(id) ? 'unchecked' : 'correct',
    placement: missingIds.has(id)
      ? { kind: 'workspace' }
      : { kind: 'destination', destinationId: collection.destinationId },
  }));

  const oneMissing = makeMembers(new Set([collection.itemIds[0]]));
  const before = structuredClone(oneMissing);
  assert.equal(findMissingCollectionMember(oneMissing, collection.itemIds[0]), collection.itemIds[0]);
  assert.deepEqual(oneMissing, before, 'compass use must not mutate item data');

  const severalMissing = makeMembers(new Set([collection.itemIds[0], collection.itemIds[1]]));
  assert.equal(findMissingCollectionMember(severalMissing, collection.itemIds[0]), collection.itemIds[1],
    'prefer an unfiled sibling when one is available');
  assert.equal(findMissingCollectionMember(makeMembers(new Set()), collection.itemIds[0]), null,
    'a fully filed collection has no missing member');
});

test('compressed saves round-trip and rejected imports leave current state untouched', () => {
  const currentState = {
    version: 3,
    worldSeed: 'palimpsest-first-shift',
    items: generateLab('palimpsest-first-shift', 174),
    progress: {
      skillPoints: 1,
      completedCollectionIds: ['harmonic-calibration'],
      unlockedPuzzleIds: ['pulse-sequence'],
      solvedPuzzleIds: [],
      ownedSkills: [],
    },
    camera: { panX: -612, panY: -180, scale: 0.76 },
    inventionStage: 'Dormant',
    notebook: { discoveries: ['calibration-folio'] },
  };
  const encoded = encodeSave(currentState);
  const normalizedCurrentState = normalizeGameState(currentState);

  assert.equal(typeof encoded, 'string');
  assert.deepEqual(decodeSave(encoded), currentState);
  assert.deepEqual(importSave(encoded, currentState), { ok: true, state: normalizedCurrentState });

  for (const malformed of ['', 'not-a-save']) {
    const rejected = importSave(malformed, currentState);
    assert.equal(rejected.ok, false);
    assert.strictEqual(rejected.state, currentState);
    assert.equal(currentState.items[0].id, 'calibration-card-01');
  }

  const unsupportedVersion = LZString.compressToEncodedURIComponent(JSON.stringify({ ...currentState, version: 999 }));
  assert.throws(() => decodeSave(unsupportedVersion), /version/i);
});

const generatedItems = generateLab('palimpsest-first-shift', 174);

function gameState(overrides = {}) {
  return {
    version: CURRENT_GAME_STATE_VERSION,
    items: structuredClone(generatedItems),
    progress: {
      skillPoints: 0,
      completedCollectionIds: [],
      unlockedPuzzleIds: [],
      solvedPuzzleIds: [],
      ownedSkills: [],
    },
    camera: { panX: 0, panY: 0, scale: 0.5 },
    inventionStage: 'Dormant',
    notebook: { discoveries: [] },
    ...overrides,
  };
}

function stateFromNormalization(result) {
  return result?.state && Array.isArray(result.state.items) ? result.state : result;
}

function migrationNotice(result) {
  return result?.notice ?? result?.migrationNotice ?? result?.state?.migrationNotice ?? null;
}

function compressLegacyState(state) {
  return LZString.compressToEncodedURIComponent(JSON.stringify(state));
}

function slotPosition(entry, item, slotIndex) {
  const layout = entry.layout;
  const row = Math.floor(slotIndex / layout.columns);
  const column = slotIndex % layout.columns;
  return {
    x: entry.position.x + layout.insetX + column * (layout.cellWidth + layout.gapX) + (layout.cellWidth - item.width) / 2,
    y: entry.position.y + layout.insetY + row * (layout.cellHeight + layout.gapY) + (layout.cellHeight - item.height) / 2,
  };
}

function legacySaveState(items, overrides = {}) {
  return gameState({
    version: 1,
    items,
    ...overrides,
  });
}

function createV2MigrationFixture(itemCount = 150) {
  const items = generateLegacyLab('palimpsest-first-shift', itemCount).map((item) => structuredClone(item));
  const calibration = DESTINATIONS.find((entry) => entry.id === 'cabinet-calibration');
  const analysisTable = SCRATCH_PADS.find((entry) => entry.id === 'scratch-a');
  const calibrationItems = items.filter((item) => item.id.startsWith('calibration-card-')).slice(0, 2);

  for (const [slotIndex, item] of calibrationItems.entries()) {
    item.position = getTargetSlotPosition({
      target: { kind: 'destination', id: calibration.id },
      item,
      slotIndex,
      destinations: DESTINATIONS,
      scratchPads: SCRATCH_PADS,
    });
    item.previousWorkspacePosition = { x: 1100 + slotIndex * 130, y: 920 };
    item.placement = { kind: 'destination', destinationId: calibration.id, slotIndex };
    item.rotation = 0;
    item.validation = 'correct';
  }

  const scratchItem = items.find((item) => item.family === 'gear');
  const scratchPosition = getTargetSlotPosition({
    target: { kind: 'scratchpad', id: analysisTable.id },
    item: scratchItem,
    slotIndex: 3,
    destinations: DESTINATIONS,
    scratchPads: SCRATCH_PADS,
  });
  scratchItem.position = scratchPosition;
  scratchItem.previousWorkspacePosition = { x: 1720, y: 1010 };
  scratchItem.placement = { kind: 'scratchpad', scratchPadId: analysisTable.id, slotIndex: 3 };
  scratchItem.rotation = 0;

  return {
    version: 2,
    contentSeed: 'palimpsest-first-shift',
    items,
    progress: {
      skillPoints: 2,
      completedCollectionIds: ['harmonic-calibration'],
      unlockedPuzzleIds: ['pulse-sequence'],
      solvedPuzzleIds: [],
      ownedSkills: ['resonance-lens'],
    },
    camera: { panX: -338, panY: 124, scale: 0.72 },
    inventionStage: 'Memory Crystal',
    notebook: { discoveries: ['memory-impression-01'] },
  };
}

test('game state normalization rejects more than the v3 5,024-object limit', () => {
  const template = generatedItems[0];
  const items = Array.from({ length: 5025 }, (_, index) => ({
    ...template,
    id: `normalization-limit-${index}`,
    position: { x: 100 + (index % 100), y: 100 + Math.floor(index / 100) },
  }));

  assert.throws(() => normalizeGameState(gameState({ items })), /5,?024|item limit|too many objects/i);
});

test('game state normalization rejects non-positive or over-512 item dimensions', () => {
  const validItem = generatedItems[0];
  const invalidDimensions = [
    { width: 0, height: 64 },
    { width: -1, height: 64 },
    { width: 513, height: 64 },
    { width: 88, height: 0 },
    { width: 88, height: -1 },
    { width: 88, height: 513 },
  ];

  for (const dimensions of invalidDimensions) {
    const item = { ...validItem, ...dimensions };
    assert.throws(
      () => normalizeGameState(gameState({ items: [item] })),
      /dimension|width|height|size/i,
      `expected ${JSON.stringify(dimensions)} to be rejected`,
    );
  }
});

test('game state normalization rejects unknown destination and scratch-pad IDs', () => {
  const validItem = generatedItems[0];

  assert.throws(
    () => normalizeGameState(gameState({
      items: [{ ...validItem, placement: { kind: 'destination', destinationId: 'destination-does-not-exist' } }],
    })),
    /destination/i,
  );

  assert.throws(
    () => normalizeGameState(gameState({
      items: [{ ...validItem, placement: { kind: 'scratchpad', scratchPadId: 'scratchpad-does-not-exist' } }],
    })),
    /scratch/i,
  );
});

test('game state normalization rejects duplicate IDs and invalid world coordinates', () => {
  const duplicateItems = structuredClone(generatedItems.slice(0, 2));
  duplicateItems[1].id = duplicateItems[0].id;
  assert.throws(() => normalizeGameState(gameState({ items: duplicateItems })), /duplicate/i);

  const item = generatedItems[0];
  const invalidPositions = [
    { x: -1, y: 100 },
    { x: 5200 - item.width + 1, y: 100 },
    { x: 100, y: -1 },
    { x: 100, y: 3400 - item.height + 1 },
  ];

  for (const position of invalidPositions) {
    assert.throws(
      () => normalizeGameState(gameState({ items: [{ ...item, position }] })),
      /world|coordinate|position|bound/i,
      `expected ${JSON.stringify(position)} to be outside the laboratory bounds`,
    );
  }
});

test('game state normalization accepts generated data and applies safe defaults', () => {
  const normalized = normalizeGameState({ version: 3, items: generatedItems });

  assert.equal(normalized.version, 3);
  assert.equal(normalized.items.length, 174);
  assert.ok(normalized.items.every((item) => item.width > 0 && item.width <= 512));
  assert.ok(normalized.items.every((item) => item.height > 0 && item.height <= 512));
  assert.ok(normalized.progress && Array.isArray(normalized.progress.completedCollectionIds));
  assert.ok(normalized.camera && Number.isFinite(normalized.camera.scale));
  assert.equal(normalized.inventionStage, 'Dormant');
});

test('filed rotations normalize to zero in destinations and scratch pads, then restore canonical rotation', () => {
  const generated = generateLab('palimpsest-first-shift', 150);
  const destinationEntry = DESTINATIONS.find((entry) => entry.id === 'bin-clockwork');
  const scratchEntry = SCRATCH_PADS.find((entry) => entry.id === 'scratch-a');
  const destinationItem = generated.find((item) => item.family === 'gear' && item.rotation !== 0);
  const scratchItem = generated.find((item) => item.id !== destinationItem.id && item.rotation !== 0);
  assert.ok(destinationItem && scratchItem, 'the test should use authored rotated filler geometry');

  const destinationAllocation = allocateTargetPlacement({
    target: { kind: 'destination', id: destinationEntry.id },
    item: destinationItem,
    items: generated,
    destinations: DESTINATIONS,
    scratchPads: SCRATCH_PADS,
  });
  const scratchAllocation = allocateTargetPlacement({
    target: { kind: 'scratchpad', id: scratchEntry.id },
    item: scratchItem,
    items: generated,
    destinations: DESTINATIONS,
    scratchPads: SCRATCH_PADS,
  });
  assert.equal(destinationAllocation.ok, true);
  assert.equal(scratchAllocation.ok, true);

  const filedRawItems = [
    {
      ...destinationItem,
      rotation: 0,
      position: destinationAllocation.position,
      placement: destinationAllocation.placement,
      previousWorkspacePosition: destinationItem.position,
    },
    {
      ...scratchItem,
      rotation: 0,
      position: scratchAllocation.position,
      placement: scratchAllocation.placement,
      previousWorkspacePosition: scratchItem.position,
    },
  ];
  const filed = stateFromNormalization(normalizeGameState(legacySaveState(filedRawItems)));

  for (const item of filed.items.filter((entry) => filedRawItems.some((raw) => raw.id === entry.id))) {
    assert.equal(item.rotation, 0, `${item.id} must not rotate while filed`);
    const target = item.placement.kind === 'destination' ? destinationEntry : scratchEntry;
    assert.ok(item.position.x >= target.position.x && item.position.x + item.width <= target.position.x + target.width);
    assert.ok(item.position.y >= target.position.y && item.position.y + item.height <= target.position.y + target.height);
  }

  const returned = stateFromNormalization(normalizeGameState({
    ...filed,
    items: filed.items.filter((entry) => filedRawItems.some((raw) => raw.id === entry.id)).map((item) => ({
      ...item,
      rotation: getCanonicalItemRotation(item.id),
      position: item.previousWorkspacePosition,
      placement: { kind: 'workspace' },
    })),
  }));
  assert.equal(returned.items.find((item) => item.id === destinationItem.id).rotation, destinationItem.rotation);
  assert.equal(returned.items.find((item) => item.id === scratchItem.id).rotation, scratchItem.rotation);
});

test('v1 saves migrate missing and duplicate slots to deterministic nearest contained slots', () => {
  const destination = DESTINATIONS.find((entry) => entry.id === 'cabinet-blueprints');
  const candidates = generateLab('palimpsest-first-shift', 150)
    .filter((item) => item.family === 'blueprint-fragment' && !item.collectionId)
    .slice(0, 4);
  const legacyItems = candidates.map((item, index) => ({
    ...item,
    position: slotPosition(destination, item, [12, 13, 14, 15][index]),
    previousWorkspacePosition: item.position,
    placement: {
      kind: 'destination',
      destinationId: destination.id,
      ...(index >= 2 ? { slotIndex: 0 } : {}),
    },
  }));
  const progress = {
    skillPoints: 3,
    completedCollectionIds: ['harmonic-calibration'],
    unlockedPuzzleIds: ['pulse-sequence'],
    solvedPuzzleIds: [],
    ownedSkills: ['resonance-lens'],
  };
  const rawState = legacySaveState(legacyItems, { progress, notebook: { discoveries: ['memory-impression-01'] } });

  const firstResult = normalizeGameState(rawState);
  const migrated = stateFromNormalization(firstResult);

  assert.equal(migrated.version, 3);
  assert.equal(migrated.items.length, legacyItems.length + 24, 'migration preserves every old item and appends the chapter');
  assert.deepEqual(migrated.progress, progress, 'migration must preserve progression');
  const migratedItems = migrated.items.slice(0, legacyItems.length);
  assert.deepEqual(migratedItems.map((item) => item.placement.slotIndex), [12, 13, 0, 15]);
  assert.equal(new Set(migratedItems.map((item) => item.placement.slotIndex)).size, migratedItems.length);
  for (const item of migratedItems) {
    assert.ok(item.position.x >= destination.position.x && item.position.x + item.width <= destination.position.x + destination.width);
    assert.ok(item.position.y >= destination.position.y && item.position.y + item.height <= destination.position.y + destination.height);
  }

  const secondResult = normalizeGameState(migrated);
  assert.deepEqual(stateFromNormalization(secondResult), migrated, 're-normalizing a migrated state must be stable');
});

test('v1 over-capacity salvage keeps all items and returns overflow to saved workspace positions', () => {
  const scratchPad = SCRATCH_PADS.find((entry) => entry.id === 'scratch-a');
  const candidates = generateLab('palimpsest-first-shift', 150).slice(8, 34);
  const legacyItems = candidates.map((item, index) => ({
    ...item,
    position: index < scratchPad.capacity
      ? slotPosition(scratchPad, item, index)
      : { x: scratchPad.position.x + 400, y: scratchPad.position.y + 400 + (index - scratchPad.capacity) * 80 },
    placement: { kind: 'scratchpad', scratchPadId: scratchPad.id, ...(index < scratchPad.capacity ? { slotIndex: index } : {}) },
    ...(index === scratchPad.capacity
      ? { previousWorkspacePosition: { x: 1900, y: 1200 } }
      : index > scratchPad.capacity ? {} : { previousWorkspacePosition: item.position }),
  }));
  const progress = { skillPoints: 2, completedCollectionIds: ['harmonic-calibration'], unlockedPuzzleIds: ['pulse-sequence'], solvedPuzzleIds: [], ownedSkills: [] };
  const rawState = legacySaveState(legacyItems, { progress });
  const rawSave = compressLegacyState(rawState);
  const storage = createMemoryStorage({ [loadOptions.autoSaveKey]: rawSave });
  const loaded = loadGameFromStorage(storage, {
    ...loadOptions,
    createNewGame: () => gameState(),
  });

  assert.equal(loaded.state.version, 3);
  assert.equal(loaded.state.items.length, legacyItems.length + 24);
  assert.deepEqual(loaded.state.progress, progress);
  assert.equal(loaded.state.items[24].placement.kind, 'workspace');
  assert.deepEqual(loaded.state.items[24].position, { x: 1900, y: 1200 });
  assert.equal(loaded.state.items[25].placement.kind, 'workspace');
  assert.deepEqual(loaded.state.items[25].position, legacyItems[25].position, 'overflow without a saved workspace point returns to its old position');
  assert.ok(migrationNotice(loaded), 'the player should receive a migration/salvage notice');
});

test('v3 state rejects target over-capacity and duplicate slot collisions', () => {
  const scratchPad = SCRATCH_PADS.find((entry) => entry.id === 'scratch-a');
  const items = generateLab('palimpsest-first-shift', 150).slice(8, 34);
  const validV3 = stateFromNormalization(normalizeGameState(legacySaveState(items.slice(0, 1), { version: 3 })));
  assert.equal(validV3.version, 3, 'version 3 must be the current schema before strict slot validation is exercised');

  const overCapacityItems = items.map((item, index) => ({
    ...item,
    placement: { kind: 'scratchpad', scratchPadId: scratchPad.id, slotIndex: index },
  }));
  assert.throws(
    () => normalizeGameState(legacySaveState(overCapacityItems, { version: 3 })),
    /capacity|slot|too many|over/i,
  );

  const collisionItems = items.slice(0, 2).map((item) => ({
    ...item,
    placement: { kind: 'scratchpad', scratchPadId: scratchPad.id, slotIndex: 4 },
  }));
  assert.throws(
    () => normalizeGameState(legacySaveState(collisionItems, { version: 3 })),
    /duplicate|collision|occupied|slot/i,
  );
});

test('loading a v1 autosave preserves its exact raw bytes in recovery before v3 replacement', () => {
  const item = generateLab('palimpsest-first-shift', 150)[0];
  const legacyState = legacySaveState([{ ...item, placement: { kind: 'workspace' } }]);
  const originalRaw = compressLegacyState(legacyState);
  const storage = createMemoryStorage({ [loadOptions.autoSaveKey]: originalRaw });

  const loaded = loadGameFromStorage(storage, {
    ...loadOptions,
    createNewGame: () => gameState(),
  });

  assert.equal(loaded.state.version, 3);
  assert.equal(storage.getItem(loadOptions.autoSaveKey), originalRaw, 'load must not replace the source before recovery preservation');
  assert.equal(storage.getItem(loadOptions.recoveryKey), originalRaw);
  assert.ok(migrationNotice(loaded));
});

function placedItem(items, item, result) {
  const updated = { ...item, position: result.position, placement: result.placement };
  return items.map((entry) => entry.id === item.id ? updated : entry);
}

function rectanglesOverlap(left, right) {
  return left.position.x < right.position.x + right.width
    && left.position.x + left.width > right.position.x
    && left.position.y < right.position.y + right.height
    && left.position.y + left.height > right.position.y;
}

test('target layout allocates distinct non-overlapping collection slots and reuses an item slot', () => {
  const collectionItems = generateLab('palimpsest-first-shift', 150)
    .filter((item) => item.collectionId === 'harmonic-calibration');
  const target = { kind: 'destination', id: 'cabinet-calibration' };
  let items = generateLab('palimpsest-first-shift', 150);
  const allocations = [];

  for (const originalItem of collectionItems) {
    const item = items.find((entry) => entry.id === originalItem.id);
    const result = allocateTargetPlacement({ target, item, items, destinations: DESTINATIONS, scratchPads: SCRATCH_PADS });
    assert.equal(result.ok, true);
    allocations.push({ ...item, position: result.position, placement: result.placement, slotIndex: result.slotIndex });
    items = placedItem(items, item, result);
  }

  assert.equal(new Set(allocations.map((item) => item.slotIndex)).size, 8);
  for (let leftIndex = 0; leftIndex < allocations.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < allocations.length; rightIndex += 1) {
      assert.equal(rectanglesOverlap(allocations[leftIndex], allocations[rightIndex]), false);
    }
  }

  const item = items.find((entry) => entry.id === collectionItems[3].id);
  const originalAllocation = allocations.find((entry) => entry.id === item.id);
  const reused = allocateTargetPlacement({ target, item, items, destinations: DESTINATIONS, scratchPads: SCRATCH_PADS });
  assert.equal(reused.ok, true);
  assert.equal(reused.slotIndex, originalAllocation.slotIndex);
  assert.deepEqual(reused.position, originalAllocation.position);
});

test('target layout fills all 24 scratch-pad slots, reuses a same-target slot, then reports overflow', () => {
  const allItems = generateLab('palimpsest-first-shift', 150);
  const itemsToPlace = allItems.slice(8, 33);
  const target = { kind: 'scratchpad', id: 'scratch-a' };
  const allocated = [];
  let items = allItems;

  for (const originalItem of itemsToPlace.slice(0, 24)) {
    const item = items.find((entry) => entry.id === originalItem.id);
    const result = allocateTargetPlacement({ target, item, items, destinations: DESTINATIONS, scratchPads: SCRATCH_PADS });
    assert.equal(result.ok, true);
    allocated.push({ ...item, position: result.position, placement: result.placement, slotIndex: result.slotIndex });
    items = placedItem(items, item, result);
  }

  assert.equal(new Set(allocated.map((item) => item.slotIndex)).size, 24);
  for (let leftIndex = 0; leftIndex < allocated.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < allocated.length; rightIndex += 1) {
      assert.equal(rectanglesOverlap(allocated[leftIndex], allocated[rightIndex]), false);
    }
  }

  const existingOccupant = items.find((entry) => entry.id === allocated[7].id);
  const sameTargetMove = allocateTargetPlacement({ target, item: existingOccupant, items, destinations: DESTINATIONS, scratchPads: SCRATCH_PADS });
  assert.equal(sameTargetMove.ok, true, 'an existing item can move within its already-full target');
  assert.equal(sameTargetMove.slotIndex, allocated[7].slotIndex);
  assert.deepEqual(sameTargetMove.position, allocated[7].position);

  const nextItem = items.find((entry) => entry.id === itemsToPlace[24].id);
  const overflow = allocateTargetPlacement({ target, item: nextItem, items, destinations: DESTINATIONS, scratchPads: SCRATCH_PADS });
  assert.equal(overflow.ok, false);
  assert.match(overflow.reason, /capacit|full|slot/i);
});

function itemFiledAtTarget(item, target, slotIndex) {
  const position = getTargetSlotPosition({ target, item, slotIndex, destinations: DESTINATIONS, scratchPads: SCRATCH_PADS });
  assert.ok(position, `${item.id} should fit in ${target.id} slot ${slotIndex}`);
  return {
    ...item,
    position,
    placement: { kind: 'destination', destinationId: target.id, slotIndex },
    validation: item.correctDestinationId === target.id ? 'correct' : 'invalid',
  };
}

test('batch allocation treats selected occupants as vacated and stages unique slots without mutating inputs', () => {
  const target = { kind: 'destination', id: 'cabinet-calibration' };
  const selectedIds = ['calibration-card-02', 'calibration-card-07'];
  const filedSlots = new Map(Array.from({ length: 8 }, (_, slotIndex) => [
    `calibration-card-${String(slotIndex + 1).padStart(2, '0')}`,
    slotIndex,
  ]));
  const items = generateLab('palimpsest-first-shift', 174).map((item) => (
    filedSlots.has(item.id) ? itemFiledAtTarget(item, target, filedSlots.get(item.id)) : item
  ));
  const before = structuredClone(items);

  const result = allocateBatchTargetPlacements({
    target,
    itemIds: selectedIds,
    items,
    destinations: DESTINATIONS,
    scratchPads: SCRATCH_PADS,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.allocations.map((allocation) => allocation.itemId), selectedIds);
  assert.equal(new Set(result.allocations.map((allocation) => allocation.slotIndex)).size, selectedIds.length,
    'each selected object receives a distinct slot');
  const unselectedOccupiedSlots = new Set(items
    .filter((item) => !selectedIds.includes(item.id) && item.placement?.destinationId === target.id)
    .map((item) => item.placement.slotIndex));
  assert.ok(result.allocations.every((allocation) => !unselectedOccupiedSlots.has(allocation.slotIndex)),
    'selected occupants are vacated while unselected occupants remain protected');
  for (const allocation of result.allocations) {
    assert.ok(Number.isFinite(allocation.position.x) && Number.isFinite(allocation.position.y));
    assert.deepEqual(allocation.placement, {
      kind: 'destination', destinationId: target.id, slotIndex: allocation.slotIndex,
    });
  }
  assert.deepEqual(items, before, 'batch allocation must not change the source item records');
});

test('batch allocation deduplicates repeated selected IDs and rejects unknown IDs without partial output', () => {
  const target = { kind: 'destination', id: 'cabinet-calibration' };
  const items = generateLab('palimpsest-first-shift', 174);
  const before = structuredClone(items);
  const duplicated = allocateBatchTargetPlacements({
    target,
    itemIds: ['calibration-card-01', 'calibration-card-01'],
    items,
    destinations: DESTINATIONS,
    scratchPads: SCRATCH_PADS,
  });

  assert.equal(duplicated.ok, true);
  assert.deepEqual(duplicated.allocations.map((allocation) => allocation.itemId), ['calibration-card-01']);

  const invalid = allocateBatchTargetPlacements({
    target,
    itemIds: ['calibration-card-01', 'not-a-laboratory-object'],
    items,
    destinations: DESTINATIONS,
    scratchPads: SCRATCH_PADS,
  });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.reason);
  assert.deepEqual(invalid.allocations, [], 'invalid selection rejects the whole batch');
  assert.deepEqual(items, before, 'validation and allocation must leave all source records untouched');
});

test('batch allocation returns no staged placements when the target lacks capacity for the whole selection', () => {
  const target = { kind: 'destination', id: 'cabinet-calibration' };
  const occupiedSlots = new Map(Array.from({ length: 7 }, (_, slotIndex) => [
    `calibration-card-${String(slotIndex + 1).padStart(2, '0')}`,
    slotIndex,
  ]));
  occupiedSlots.set('blueprint-fragment-001', 7);
  const items = generateLab('palimpsest-first-shift', 174).map((item) => (
    occupiedSlots.has(item.id) ? itemFiledAtTarget(item, target, occupiedSlots.get(item.id)) : item
  ));
  const before = structuredClone(items);
  const result = allocateBatchTargetPlacements({
    target,
    itemIds: ['calibration-card-08', 'blueprint-fragment-002'],
    items,
    destinations: DESTINATIONS,
    scratchPads: SCRATCH_PADS,
  });

  assert.equal(result.ok, false);
  assert.ok(result.reason);
  assert.deepEqual(result.allocations, [], 'a late capacity failure must not leak earlier allocations');
  assert.deepEqual(items, before, 'a failed batch must not mutate item positions or placements');
});

function assertEveryDeclaredSlotFits(target, selectItems, label) {
  const allItems = generateLab('palimpsest-first-shift', 350);
  const targetEntry = target.kind === 'destination'
    ? DESTINATIONS.find((entry) => entry.id === target.id)
    : SCRATCH_PADS.find((entry) => entry.id === target.id);
  const capacity = target.kind === 'destination' ? targetEntry.slotCount : targetEntry.capacity;
  const selectedItems = selectItems(allItems);
  let items = allItems;
  const allocations = [];

  assert.ok(selectedItems.length >= capacity, `${label} needs ${capacity} candidate items`);
  for (const originalItem of selectedItems.slice(0, capacity)) {
    const item = items.find((entry) => entry.id === originalItem.id);
    const result = allocateTargetPlacement({ target, item, items, destinations: DESTINATIONS, scratchPads: SCRATCH_PADS });
    assert.equal(result.ok, true, `${label}: ${item.id} should receive a slot`);
    assert.ok(result.position.x >= targetEntry.position.x, `${label}: ${item.id} starts left of its target`);
    assert.ok(result.position.y >= targetEntry.position.y, `${label}: ${item.id} starts above its target`);
    assert.ok(result.position.x + item.width <= targetEntry.position.x + targetEntry.width, `${label}: ${item.id} extends past its target's right edge`);
    assert.ok(result.position.y + item.height <= targetEntry.position.y + targetEntry.height, `${label}: ${item.id} extends past its target's bottom edge`);
    const allocation = { ...item, position: result.position, placement: result.placement };
    assert.ok(allocations.every((other) => !rectanglesOverlap(allocation, other)), `${label}: ${item.id} overlaps another target slot`);
    allocations.push(allocation);
    items = placedItem(items, item, result);
  }
}

const targetContainmentCases = [
  ['all eight calibration slots stay inside the folio', { kind: 'destination', id: 'cabinet-calibration' }, (items) => items.filter((item) => item.id.startsWith('calibration-card-'))],
  ['all 36 blueprint slots stay inside the cabinet', { kind: 'destination', id: 'cabinet-blueprints' }, (items) => items.filter((item) => item.family === 'blueprint-fragment' && !item.collectionId)],
  ['all 40 note slots stay inside the drawer', { kind: 'destination', id: 'drawer-field-notes' }, (items) => items.filter((item) => item.family === 'handwritten-note')],
  ['all 40 gear slots stay inside the bin', { kind: 'destination', id: 'bin-clockwork' }, (items) => items.filter((item) => item.family === 'gear')],
  ['all 40 experiment slots stay inside the archive', { kind: 'destination', id: 'archive-experiments' }, (items) => items.filter((item) => item.family === 'experiment-record')],
  ['all 24 first scratch-pad slots stay inside the work surface', { kind: 'scratchpad', id: 'scratch-a' }, (items) => items.slice(8, 32)],
  ['all 24 second scratch-pad slots stay inside the work surface', { kind: 'scratchpad', id: 'scratch-b' }, (items) => items.slice(8, 32)],
];

for (const [name, target, selectItems] of targetContainmentCases) {
  test(name, () => assertEveryDeclaredSlotFits(target, selectItems, name));
}

function scratchSlotItems(items, scratchPad, count) {
  return items.filter((item) => item.width <= scratchPad.layout.cellWidth
    && item.height <= scratchPad.layout.cellHeight).slice(0, count).map((item, slotIndex) => {
    const position = getTargetSlotPosition({
      target: { kind: 'scratchpad', id: scratchPad.id },
      item,
      slotIndex,
      destinations: DESTINATIONS,
      scratchPads: [scratchPad],
    });
    return {
      ...item,
      position,
      previousWorkspacePosition: { ...item.position },
      placement: { kind: 'scratchpad', scratchPadId: scratchPad.id, slotIndex },
      rotation: 0,
      validation: 'unchecked',
    };
  });
}

test('scratch-pad capacity stays at 24 until Modular Worktables is owned', () => {
  const skill = SKILLS.find((entry) => entry.id === 'modular-worktables');
  assert.ok(skill, 'the catalog should contain Modular Worktables');
  assert.equal(skill.cost, 1, 'the permanent capacity upgrade should cost one insight point');
  assert.equal(typeof getScratchPadsForOwnedSkills, 'function', 'the catalog should expose its skill-derived scratch-pad definitions');
  const basePads = scratchPadsForOwnedSkills([]);
  const expandedPads = scratchPadsForOwnedSkills(['modular-worktables']);

  assert.deepEqual(basePads.map((pad) => [pad.id, pad.capacity, pad.layout.rows]), [
    ['scratch-a', 24, 5],
    ['scratch-b', 24, 5],
  ]);
  assert.deepEqual(expandedPads.map((pad) => [pad.id, pad.capacity, pad.layout.rows]), [
    ['scratch-a', 30, 6],
    ['scratch-b', 30, 6],
  ]);
  assert.equal(SCRATCH_PADS[0].capacity, 24, 'deriving an upgrade must not mutate the shared base catalog');
});

test('all 30 Modular Worktables slots remain inside both scratch pads without overlap', () => {
  const expandedPads = scratchPadsForOwnedSkills(['modular-worktables']);
  const items = generateLab('scratch-pad-capacity', 350);

  for (const pad of expandedPads) {
    const candidates = items.filter((item) => item.width <= pad.layout.cellWidth && item.height <= pad.layout.cellHeight).slice(0, pad.capacity);
    assert.equal(candidates.length, 30, `${pad.label} needs 30 objects that fit its slot dimensions`);
    const placements = candidates.map((item, slotIndex) => {
      const position = getTargetSlotPosition({
        target: { kind: 'scratchpad', id: pad.id },
        item,
        slotIndex,
        destinations: DESTINATIONS,
        scratchPads: expandedPads,
      });
      assert.ok(position, `${pad.label} slot ${slotIndex} should fit inside the board`);
      return { ...item, position };
    });

    for (let leftIndex = 0; leftIndex < placements.length; leftIndex += 1) {
      const left = placements[leftIndex];
      assert.ok(left.position.x >= pad.position.x && left.position.y >= pad.position.y);
      assert.ok(left.position.x + left.width <= pad.position.x + pad.width);
      assert.ok(left.position.y + left.height <= pad.position.y + pad.height);
      for (let rightIndex = leftIndex + 1; rightIndex < placements.length; rightIndex += 1) {
        assert.equal(rectanglesOverlap(left, placements[rightIndex]), false, `${pad.label} slots must not overlap`);
      }
    }
  }
});

test('Modular Worktables allocates slot 29 and rejects an arrival after all 30 slots are used', () => {
  const pad = scratchPadsForOwnedSkills(['modular-worktables']).find((entry) => entry.id === 'scratch-a');
  const candidates = generateLab('scratch-pad-capacity', 350)
    .filter((item) => item.width <= pad.layout.cellWidth && item.height <= pad.layout.cellHeight);
  const occupants = scratchSlotItems(candidates, pad, 29);
  const arrival = candidates.find((item) => !occupants.some((occupant) => occupant.id === item.id));
  const allocation = allocateTargetPlacement({
    target: { kind: 'scratchpad', id: pad.id },
    item: arrival,
    items: [...occupants, arrival],
    destinations: DESTINATIONS,
    scratchPads: [pad],
  });

  assert.equal(allocation.ok, true);
  assert.equal(allocation.slotIndex, 29);
  assert.ok(allocation.position);

  const fullOccupants = scratchSlotItems(candidates, pad, 30);
  const overflow = candidates.find((item) => !fullOccupants.some((occupant) => occupant.id === item.id));
  const rejected = allocateTargetPlacement({
    target: { kind: 'scratchpad', id: pad.id },
    item: overflow,
    items: [...fullOccupants, overflow],
    destinations: DESTINATIONS,
    scratchPads: [pad],
  });

  assert.equal(rejected.ok, false);
  assert.match(rejected.reason, /full|capacity|slot/i);
});

test('Modular Worktables batch allocation uses the last two slots atomically', () => {
  const pad = scratchPadsForOwnedSkills(['modular-worktables']).find((entry) => entry.id === 'scratch-b');
  const candidates = generateLab('scratch-pad-capacity', 350)
    .filter((item) => item.width <= pad.layout.cellWidth && item.height <= pad.layout.cellHeight);
  const occupants = scratchSlotItems(candidates, pad, 28);
  const selectedItems = candidates.filter((item) => !occupants.some((occupant) => occupant.id === item.id)).slice(0, 2);
  const input = [...occupants, ...selectedItems];
  const before = structuredClone(input);
  const result = allocateBatchTargetPlacements({
    target: { kind: 'scratchpad', id: pad.id },
    itemIds: selectedItems.map((item) => item.id),
    items: input,
    destinations: DESTINATIONS,
    scratchPads: [pad],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.allocations.map((entry) => entry.slotIndex), [28, 29]);
  assert.deepEqual(input, before, 'batch allocation must not mutate the source items');

  const oneFreeSlot = scratchSlotItems(candidates, pad, 29);
  const finalTwo = candidates.filter((item) => !oneFreeSlot.some((occupant) => occupant.id === item.id)).slice(0, 2);
  const rejected = allocateBatchTargetPlacements({
    target: { kind: 'scratchpad', id: pad.id },
    itemIds: finalTwo.map((item) => item.id),
    items: [...oneFreeSlot, ...finalTwo],
    destinations: DESTINATIONS,
    scratchPads: [pad],
  });

  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.allocations, []);
});

function placeItemInScratchSlot(state, item, pad, slotIndex, scratchPads = [pad]) {
  const position = getTargetSlotPosition({
    target: { kind: 'scratchpad', id: pad.id },
    item,
    slotIndex,
    destinations: DESTINATIONS,
    scratchPads,
  });
  if (!position) throw new Error(`Unable to place ${item.id} in ${pad.id} slot ${slotIndex}`);
  item.position = position;
  item.placement = { kind: 'scratchpad', scratchPadId: pad.id, slotIndex };
  item.rotation = 0;
  item.validation = 'unchecked';
}

test('v3 saves allow scratch-pad slots 24–29 only when Modular Worktables is owned', () => {
  const expandedPads = scratchPadsForOwnedSkills(['modular-worktables']);
  const expandedPad = expandedPads.find((entry) => entry.id === 'scratch-a');
  const withSkill = gameState({ progress: { skillPoints: 0, ownedSkills: ['modular-worktables'] } });
  const upgradedItem = withSkill.items[0];
  placeItemInScratchSlot(withSkill, upgradedItem, expandedPad, 29, expandedPads);

  const normalized = normalizeGameState(withSkill);
  assert.deepEqual(normalized.progress.ownedSkills, ['modular-worktables']);
  assert.deepEqual(normalized.items.find((item) => item.id === upgradedItem.id).placement, {
    kind: 'scratchpad', scratchPadId: expandedPad.id, slotIndex: 29,
  });
  assert.deepEqual(normalizeGameState(decodeSave(encodeSave(normalized))), normalized,
    'the purchased skill and newly valid slot must survive a compressed v3 round-trip');

  const overCapacity = structuredClone(withSkill);
  placeItemInScratchSlot(overCapacity, overCapacity.items[0], expandedPad, 29, expandedPads);
  overCapacity.items[0].placement.slotIndex = 30;
  assert.throws(() => normalizeGameState(overCapacity), /slot|capacity|scratch/i,
    'ownership expands the valid indexes only through 29');

  for (const slotIndex of [24, 29]) {
    const withoutSkill = gameState();
    placeItemInScratchSlot(withoutSkill, withoutSkill.items[0], expandedPad, slotIndex, expandedPads);
    assert.throws(() => normalizeGameState(withoutSkill), /slot|capacity|scratch/i,
      `slot ${slotIndex} must remain invalid without the capacity skill`);
  }
});

test('legacy v1 and v2 saves cannot claim the new scratch-capacity skill', () => {
  for (const version of [1, 2]) {
    const legacy = version === 1
      ? legacySaveState(generateLegacyLab('palimpsest-first-shift', 150))
      : createV2MigrationFixture();
    const forged = {
      ...legacy,
      version,
      progress: { ...legacy.progress, ownedSkills: ['modular-worktables'] },
    };

    assert.throws(() => normalizeGameState(forged), /owned skills.*unknown|unknown id/i,
      `v${version} must retain its existing legacy skill whitelist`);
  }
});

test('v3 Aether Wayfinder ownership round-trips through canonical persistence', () => {
  const wayfinder = SKILLS.find((skill) => skill.id === 'aether-wayfinder');
  assert.ok(wayfinder, 'Aether Wayfinder should be registered as a canonical skill');
  assert.equal(wayfinder.cost, 2, 'Aether Wayfinder costs two insight points');

  const current = gameState({
    progress: {
      skillPoints: 0,
      completedCollectionIds: [],
      unlockedPuzzleIds: [],
      solvedPuzzleIds: [],
      ownedSkills: ['aether-wayfinder'],
    },
  });
  const normalized = normalizeGameState(current);
  assert.deepEqual(normalized.progress.ownedSkills, ['aether-wayfinder']);
  assert.deepEqual(normalizeGameState(decodeSave(encodeSave(normalized))), normalized,
    'v3 ownership must survive canonical normalization and compressed save reload');
});

test('legacy v1 and v2 saves cannot claim Aether Wayfinder ownership', () => {
  for (const version of [1, 2]) {
    const legacy = version === 1
      ? legacySaveState(generateLegacyLab('palimpsest-first-shift', 150))
      : createV2MigrationFixture();
    const forged = {
      ...legacy,
      version,
      progress: { ...legacy.progress, ownedSkills: ['aether-wayfinder'] },
    };

    assert.throws(() => normalizeGameState(forged), /owned skills.*unknown|unknown id/i,
      `v${version} must not add Aether Wayfinder to its historical skill whitelist`);
  }
});

test('target layout chooses the free slot nearest a preferred pointer position', () => {
  const allItems = generateLab('palimpsest-first-shift', 350);
  const target = { kind: 'destination', id: 'cabinet-blueprints' };
  const targetEntry = DESTINATIONS.find((entry) => entry.id === target.id);
  const occupants = allItems.slice(0, 7).map((item, index) => ({
    ...item,
    position: { x: 80 + index * 100, y: 80 },
    placement: { kind: 'destination', destinationId: target.id, slotIndex: index + 1 },
  }));
  const movingItem = { ...allItems[7], position: { x: 100, y: 100 }, placement: { kind: 'workspace' } };
  const preferredPosition = {
    x: targetEntry.position.x + 20 + 2 * 100 + movingItem.width / 2,
    y: targetEntry.position.y + 76 + 1 * 74 + movingItem.height / 2,
  };

  const result = allocateTargetPlacement({
    target,
    item: movingItem,
    items: [...occupants, movingItem],
    destinations: DESTINATIONS,
    scratchPads: SCRATCH_PADS,
    preferredPosition,
  });

  assert.equal(result.ok, true);
  assert.equal(result.slotIndex, 8, 'the pointer is closest to slot 8; slot 0 is also free');
});

test('invalidly placed occupants still consume every declared destination slot', () => {
  const allItems = generateLab('palimpsest-first-shift', 350);
  const target = { kind: 'destination', id: 'cabinet-blueprints' };
  const capacity = DESTINATIONS.find((entry) => entry.id === target.id).slotCount;
  const occupants = allItems.slice(0, capacity).map((item, slotIndex) => ({
    ...item,
    position: { x: 80 + slotIndex * 100, y: 80 },
    placement: { kind: 'destination', destinationId: target.id, slotIndex },
    validation: 'invalid',
  }));
  const arrival = { ...allItems[capacity], position: { x: 100, y: 100 }, placement: { kind: 'workspace' } };

  const result = allocateTargetPlacement({
    target,
    item: arrival,
    items: [...occupants, arrival],
    destinations: DESTINATIONS,
    scratchPads: SCRATCH_PADS,
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /capacit|full|slot/i);
});

function createMemoryStorage(initialEntries = {}) {
  const entries = new Map(Object.entries(initialEntries));
  return {
    entries,
    getItem(key) { return entries.has(key) ? entries.get(key) : null; },
    setItem(key, value) { entries.set(key, String(value)); },
    removeItem(key) { entries.delete(key); },
  };
}

const loadOptions = {
  autoSaveKey: 'lab-autosave',
  backupKey: 'lab-backup',
  recoveryKey: 'lab-recovery',
};

test('v2 migration appends chapter content once and preserves all existing records and game state', () => {
  const v2 = createV2MigrationFixture();
  const migrated = normalizeGameState(v2);
  const authoredAppendix = generateLab(v2.contentSeed, 174).slice(150);

  assert.equal(CURRENT_GAME_STATE_VERSION, 3);
  assert.equal(migrated.version, 3);
  assert.equal(migrated.items.length, 174);
  assert.deepEqual(migrated.items.slice(0, 150), v2.items, 'every old item keeps its ID, target, slot, position, rotation, and validation');
  assert.deepEqual(migrated.items.slice(150), authoredAppendix, 'the 24 authored items append in deterministic workspace positions');
  assert.deepEqual(migrated.progress, v2.progress);
  assert.deepEqual(migrated.camera, v2.camera);
  assert.deepEqual(migrated.notebook, v2.notebook);
  assert.equal(migrated.inventionStage, v2.inventionStage);

  const renormalized = normalizeGameState(migrated);
  assert.deepEqual(renormalized, migrated, 'v3 normalization must be idempotent');
  assert.deepEqual(normalizeGameState(decodeSave(encodeSave(migrated))), migrated,
    'canonical v3 saves must round-trip through the compressed codec');

  const currentState = createNewGameState();
  const invalidV3 = structuredClone(migrated);
  invalidV3.items[1].id = invalidV3.items[0].id;
  const rejected = importSave(encodeSave(invalidV3), currentState);
  assert.equal(rejected.ok, false, 'invalid v3 imports should be rejected after decompression');
  assert.strictEqual(rejected.state, currentState, 'a rejected migration import must leave live state untouched');
});

test('v2 maximum-size migration retains all 5,000 old objects and appends 24 chapter objects', () => {
  const v2 = createV2MigrationFixture(5000);
  const migrated = normalizeGameState(v2);

  assert.equal(migrated.version, 3);
  assert.equal(migrated.items.length, 5024);
  assert.deepEqual(migrated.items.slice(0, 5000), v2.items, 'the migration must not drop or rewrite any valid v2 object');
  assert.equal(new Set(migrated.items.map((item) => item.id)).size, 5024);
  assert.ok(migrated.items.slice(5000).every((item) => item.authored && item.collectionId));
});

test('v2 migration and later workspace returns retain rotations for the saved content seed', () => {
  const contentSeed = 'alternate-rotation-shift';
  const oldItems = generateLegacyLab(contentSeed, 150).map((item) => structuredClone(item));
  const v2 = {
    ...createV2MigrationFixture(),
    contentSeed,
    items: oldItems,
    progress: { skillPoints: 1, completedCollectionIds: [], unlockedPuzzleIds: [], solvedPuzzleIds: [], ownedSkills: [] },
  };
  const rotated = oldItems.find((item) => item.placement.kind === 'workspace' && item.rotation !== 0);
  assert.ok(rotated, 'the alternate seed should include a workspace object with a nonzero canonical rotation');

  const migrated = normalizeGameState(v2);
  const migratedItem = migrated.items.find((item) => item.id === rotated.id);
  assert.equal(migratedItem.rotation, rotated.rotation, 'migration preserves the saved custom-seed rotation');
  assert.equal(getCanonicalItemRotation(rotated.id, contentSeed), rotated.rotation,
    'returning the filed object to the workspace restores its seed-specific rotation');
  assert.deepEqual(normalizeGameState(migrated), migrated, 'the custom-seed rotation survives subsequent v3 loads');
});

test('loading a v2 autosave preserves its exact raw bytes in recovery before the first v3 save', () => {
  const v2 = createV2MigrationFixture();
  const originalRaw = compressLegacyState(v2);
  const storage = createMemoryStorage({ [loadOptions.autoSaveKey]: originalRaw });
  const loaded = loadGameFromStorage(storage, { ...loadOptions, createNewGame: createNewGameState });

  assert.equal(loaded.state.version, 3);
  assert.equal(loaded.state.items.length, 174);
  assert.equal(storage.getItem(loadOptions.autoSaveKey), originalRaw, 'the old autosave stays intact until replacement is safe');
  assert.equal(storage.getItem(loadOptions.recoveryKey), originalRaw, 'the raw v2 payload is preserved byte-for-byte');
  assert.ok(loaded.notice, 'the player should be told that the save was upgraded');
});

test('startup recovers a valid current backup and preserves the corrupt autosave string', () => {
  const originalRaw = 'corrupt-autosave-payload';
  const backupState = { version: 3, contentSeed: 'backup-shift', items: generateLab('backup-shift', 174), progress: { skillPoints: 2 } };
  const backupRaw = encodeSave(backupState);
  const storage = createMemoryStorage({
    [loadOptions.autoSaveKey]: originalRaw,
    [loadOptions.backupKey]: backupRaw,
  });

  const result = loadGameFromStorage(storage, {
    ...loadOptions,
    createNewGame: () => ({ version: 3, items: [] }),
  });

  assert.equal(result.state.items[0].id, backupState.items[0].id);
  assert.equal(storage.getItem(loadOptions.autoSaveKey), originalRaw);
  assert.equal(storage.getItem(loadOptions.recoveryKey), originalRaw);
  assert.equal(typeof result.autosaveEnabled, 'boolean');
  assert.ok(typeof result.notice === 'string' && result.notice.length > 0);
});

test('startup blocks autosave when both saved copies are corrupt until explicit user action', () => {
  const originalRaw = 'corrupt-autosave-payload';
  const corruptBackup = 'also-corrupt-backup';
  const freshState = { version: 3, contentSeed: 'fresh-shift', items: generateLab('fresh-shift', 174) };
  const storage = createMemoryStorage({
    [loadOptions.autoSaveKey]: originalRaw,
    [loadOptions.backupKey]: corruptBackup,
  });
  let newGameCreated = false;

  const result = loadGameFromStorage(storage, {
    ...loadOptions,
    createNewGame: () => { newGameCreated = true; return freshState; },
  });

  assert.equal(newGameCreated, true);
  assert.strictEqual(result.state, freshState);
  assert.equal(result.autosaveEnabled, false);
  assert.equal(storage.getItem(loadOptions.autoSaveKey), originalRaw);
  assert.equal(storage.getItem(loadOptions.recoveryKey), originalRaw);
  assert.ok(typeof result.notice === 'string' && result.notice.length > 0);
});
