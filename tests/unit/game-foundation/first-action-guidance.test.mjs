import test from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTIONS } from '../../../src/game/content/catalog.js';
import { createNewGameState } from '../../../src/game/persistence/gameState.js';
import { shouldShowCalibrationLead } from '../../../src/game/domain/firstActionLead.js';

const calibrationCollection = COLLECTIONS.find((collection) => collection.id === 'harmonic-calibration');
const firstCalibrationItemId = calibrationCollection.itemIds[0];

function createItems() {
  return createNewGameState().items;
}

function setPlacement(items, itemId, placement, validation) {
  const item = items.find((entry) => entry.id === itemId);
  assert.ok(item, `expected item ${itemId} to exist`);
  item.placement = placement;
  item.validation = validation;
}

test('the calibration lead appears for an empty state and ignores stale completion progress', () => {
  assert.equal(shouldShowCalibrationLead({ items: [], collection: calibrationCollection }), true);

  const items = createItems();
  assert.equal(shouldShowCalibrationLead({
    items,
    collection: calibrationCollection,
    progress: { completedCollectionIds: [calibrationCollection.id] },
  }), true);
});

test('one canonically correct calibration placement hides the lead', () => {
  const items = createItems();
  setPlacement(items, firstCalibrationItemId, {
    kind: 'destination',
    destinationId: calibrationCollection.destinationId,
    slotIndex: 0,
  }, 'correct');

  assert.equal(shouldShowCalibrationLead({ items, collection: calibrationCollection }), false);
});

test('a correctly filed item outside calibration does not hide its lead', () => {
  const items = createItems();
  const unrelatedItem = items.find((item) => item.id === 'bell-before-dawn-01');
  assert.ok(unrelatedItem, 'expected an unrelated chapter item to exist');
  setPlacement(items, unrelatedItem.id, {
    kind: 'destination',
    destinationId: unrelatedItem.correctDestinationId,
    slotIndex: 0,
  }, 'correct');

  assert.equal(shouldShowCalibrationLead({ items, collection: calibrationCollection }), true);
});

test('an unfiled calibration item keeps the lead visible', () => {
  const items = createItems();
  setPlacement(items, firstCalibrationItemId, { kind: 'workspace' }, 'unfiled');

  assert.equal(shouldShowCalibrationLead({ items, collection: calibrationCollection }), true);
});

test('a temporarily placed calibration item keeps the lead visible', () => {
  const items = createItems();
  setPlacement(items, firstCalibrationItemId, { kind: 'scratchpad', scratchPadId: 'scratch-a' }, 'correct');

  assert.equal(shouldShowCalibrationLead({ items, collection: calibrationCollection }), true);
});

test('a calibration item misfiled to another destination keeps the lead visible', () => {
  const items = createItems();
  setPlacement(items, firstCalibrationItemId, {
    kind: 'destination',
    destinationId: 'cabinet-blueprints',
    slotIndex: 0,
  }, 'invalid');

  assert.equal(shouldShowCalibrationLead({ items, collection: calibrationCollection }), true);
});
