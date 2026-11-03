import { expect, test } from '@playwright/test';
import { COLLECTIONS, DESTINATIONS, SCRATCH_PADS } from '../../src/game/content/catalog.js';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { encodeSave } from '../../src/game/persistence/save.js';
import { getTargetSlotPosition } from '../../src/game/world/placementLayout.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const testViewport = { width: 1280, height: 720 };
const calibration = COLLECTIONS.find((collection) => collection.id === 'harmonic-calibration');
const bellCollection = COLLECTIONS.find((collection) => collection.id === 'bell-before-dawn');

function fileFixtureItem(state, itemId, destinationId, slotIndex) {
  const item = state.items.find((entry) => entry.id === itemId);
  const target = { kind: 'destination', id: destinationId };
  const position = getTargetSlotPosition({ target, item, slotIndex, destinations: DESTINATIONS, scratchPads: SCRATCH_PADS });
  if (!item || !position) throw new Error(`Unable to place ${itemId} in ${destinationId} slot ${slotIndex}`);
  item.position = position;
  item.placement = { kind: 'destination', destinationId, slotIndex };
  item.rotation = 0;
  item.validation = item.correctDestinationId === destinationId ? 'correct' : 'invalid';
}

function encodeFixture(state) {
  return encodeSave(state);
}

async function loadFixture(page, state) {
  await page.setViewportSize(testViewport);
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: autoSaveKey,
    value: encodeFixture(state),
  });
  await page.goto('/');
}

async function expectItemCenteredInViewport(page, itemId) {
  const viewport = page.getByTestId('world-viewport');
  const item = page.getByTestId(`lab-item-${itemId}`);
  await expect(item).toBeVisible();
  const viewportBox = await viewport.boundingBox();
  const itemBox = await item.boundingBox();
  expect(viewportBox).not.toBeNull();
  expect(itemBox).not.toBeNull();
  expect(Math.abs((itemBox.x + itemBox.width / 2) - (viewportBox.x + viewportBox.width / 2))).toBeLessThanOrEqual(8);
  expect(Math.abs((itemBox.y + itemBox.height / 2) - (viewportBox.y + viewportBox.height / 2))).toBeLessThanOrEqual(8);
}

test('the world jump lists unfinished collections with live correct-placement counts and keeps fixed locations', async ({ page }) => {
  const state = createNewGameState();
  fileFixtureItem(state, calibration.itemIds[0], calibration.destinationId, 0);
  fileFixtureItem(state, bellCollection.itemIds[0], bellCollection.destinationId, 0);
  fileFixtureItem(state, bellCollection.itemIds[1], bellCollection.destinationId, 1);
  await loadFixture(page, state);

  const jump = page.getByTestId('world-jump');
  const collectionOptions = jump.locator('option[value^="collection:"]');
  await expect(collectionOptions).toHaveCount(COLLECTIONS.length);

  for (const [collection, correctCount] of [[calibration, 1], [bellCollection, 2], ...COLLECTIONS
    .filter((entry) => ![calibration.id, bellCollection.id].includes(entry.id))
    .map((entry) => [entry, 0])]) {
    await expect(jump.locator(`option[value="collection:${collection.id}"]`))
      .toHaveText(`${collection.label} · ${correctCount}/${collection.itemIds.length}`);
  }

  await expect(jump.locator('option[value="start"]')).toHaveText('Starting area');
  await expect(jump.locator('option[value="engine"]')).toHaveText('Palimpsest Engine');
  await expect(jump.locator('option[value="destination:cabinet-blueprints"]')).toHaveCount(1);
  await expect(jump.locator('option[value="scratchpad:scratch-a"]')).toHaveCount(1);

  const nextCollection = COLLECTIONS.find((collection) => collection.id === 'meridian-survey');
  await jump.selectOption(`collection:${nextCollection.id}`);
  const firstLooseItem = nextCollection.itemIds[0];
  await expectItemCenteredInViewport(page, firstLooseItem);
  await page.getByTestId(`lab-item-${firstLooseItem}`).click();
  await page.getByTestId('move-target').selectOption(nextCollection.destinationId);
  await page.getByTestId('move-item').click();

  await expect(jump.locator(`option[value="collection:${nextCollection.id}"]`))
    .toHaveText(`${nextCollection.label} · 1/${nextCollection.itemIds.length}`);
});

test('an unfinished collection jump focuses its first misfiled member even when progress calls it complete', async ({ page }) => {
  const state = createNewGameState();
  state.camera = { panX: -1900, panY: -1200, scale: 0.5 };
  fileFixtureItem(state, calibration.itemIds[0], 'cabinet-blueprints', 0);
  fileFixtureItem(state, calibration.itemIds[1], calibration.destinationId, 0);
  state.progress.completedCollectionIds = [calibration.id];
  state.progress.skillPoints = 1;
  await loadFixture(page, state);

  const jump = page.getByTestId('world-jump');
  const option = jump.locator(`option[value="collection:${calibration.id}"]`);
  await expect(option).toHaveText(`${calibration.label} · 1/${calibration.itemIds.length}`);
  await jump.selectOption(`collection:${calibration.id}`);

  const firstMisfiledItem = page.getByTestId(`lab-item-${calibration.itemIds[0]}`);
  await expect(firstMisfiledItem).toHaveClass(/misfiled/);
  await expectItemCenteredInViewport(page, calibration.itemIds[0]);
});

test('a collection with every member correctly filed is omitted from unfinished collection navigation', async ({ page }) => {
  const state = createNewGameState();
  for (let slotIndex = 0; slotIndex < calibration.itemIds.length; slotIndex += 1) {
    fileFixtureItem(state, calibration.itemIds[slotIndex], calibration.destinationId, slotIndex);
  }
  state.progress.completedCollectionIds = [calibration.id];
  state.progress.unlockedPuzzleIds = ['pulse-sequence'];
  state.progress.skillPoints = 1;
  await loadFixture(page, state);

  const jump = page.getByTestId('world-jump');
  await expect(jump.locator(`option[value="collection:${calibration.id}"]`)).toHaveCount(0);
  await expect(jump.locator(`option[value="collection:${bellCollection.id}"]`))
    .toHaveText(`${bellCollection.label} · 0/${bellCollection.itemIds.length}`);
});
