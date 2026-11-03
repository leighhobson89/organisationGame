import { expect, test } from '@playwright/test';
import { observeAudioEvents, readAudioEventTypes } from '../helpers/audioEvents.js';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { decodeSave, encodeSave } from '../../src/game/persistence/save.js';
import { COLLECTIONS, DESTINATIONS, SCRATCH_PADS, WORLD_BOUNDS } from '../../src/game/content/catalog.js';
import { getTargetSlotPosition } from '../../src/game/world/placementLayout.js';

const firstCalibrationCard = 'calibration-card-01';
const correctDestination = 'cabinet-calibration';
const wrongDestination = 'cabinet-blueprints';
const autoSaveKey = 'palimpsest-laboratory.autosave.v1';

async function moveSelectedItem(page, destinationId) {
  await page.getByRole('combobox', { name: /destination/i }).selectOption(destinationId);
  await page.getByRole('button', { name: 'Move item', exact: true }).click();
}

async function selectAndMoveItem(page, itemId, destinationId) {
  await page.getByTestId(`lab-item-${itemId}`).click();
  await moveSelectedItem(page, destinationId);
}

function fileFixtureItem(state, itemId, target, slotIndex) {
  const item = state.items.find((entry) => entry.id === itemId);
  const position = getTargetSlotPosition({ target, item, slotIndex, destinations: DESTINATIONS, scratchPads: SCRATCH_PADS });
  if (!item || !position) throw new Error(`Unable to place fixture item ${itemId} in ${target.id} slot ${slotIndex}`);
  item.position = position;
  item.placement = { kind: 'destination', destinationId: target.id, slotIndex };
  item.validation = item.correctDestinationId === target.id ? 'correct' : 'invalid';
  item.rotation = 0;
}

function createPartiallyFiledCalibrationState({ filedCount = 6, fillRemainingSlot = false } = {}) {
  const state = createNewGameState();
  const target = { kind: 'destination', id: 'cabinet-calibration' };
  for (let slotIndex = 0; slotIndex < filedCount; slotIndex += 1) {
    fileFixtureItem(state, `calibration-card-${String(slotIndex + 1).padStart(2, '0')}`, target, slotIndex);
  }
  if (fillRemainingSlot) fileFixtureItem(state, 'blueprint-fragment-001', target, 7);
  return state;
}

function findIsolatedWorldPosition(item, items) {
  for (let y = 2500; y + item.height <= WORLD_BOUNDS.height; y += 76) {
    for (let x = 0; x <= 420 && x + item.width <= WORLD_BOUNDS.width; x += 84) {
      const candidate = { x, y, width: item.width, height: item.height };
      const overlapsItem = items.some((other) => other.id !== item.id
        && candidate.x < other.position.x + other.width
        && candidate.x + candidate.width > other.position.x
        && candidate.y < other.position.y + other.height
        && candidate.y + candidate.height > other.position.y);
      const overlapsTarget = [...DESTINATIONS, ...SCRATCH_PADS].some((target) => (
        candidate.x < target.position.x + target.width
          && candidate.x + candidate.width > target.position.x
          && candidate.y < target.position.y + target.height
          && candidate.y + candidate.height > target.position.y
      ));
      if (!overlapsItem && !overlapsTarget) return { x, y };
    }
  }
  throw new Error(`Could not find an isolated world location for ${item.id}`);
}

test('the player can recover a misfiled card, restore its collection, and solve the revealed puzzle', async ({ page }) => {
  await page.goto('/');
  await observeAudioEvents(page);

  await expect(page.getByTestId('world-item-count')).toContainText('174');

  const firstCard = page.getByTestId(`lab-item-${firstCalibrationCard}`);
  await expect(firstCard).toBeVisible();

  await firstCard.click();
  await moveSelectedItem(page, wrongDestination);
  await expect.poll(() => readAudioEventTypes(page)).toContain('item.placement.invalid');

  await expect(firstCard).toContainText('Misfiled');
  await expect(firstCard).toHaveAccessibleName(/Misfiled/i);

  await firstCard.click();
  await moveSelectedItem(page, correctDestination);
  await expect.poll(() => readAudioEventTypes(page)).toContain('item.placement.correct');
  await expect(firstCard).not.toContainText('Misfiled');

  for (let cardNumber = 2; cardNumber <= 8; cardNumber += 1) {
    const itemId = `calibration-card-${String(cardNumber).padStart(2, '0')}`;
    await selectAndMoveItem(page, itemId, correctDestination);
  }

  await expect(page.getByText(/skill points?\D*1\b/i)).toBeVisible();
  await expect.poll(() => readAudioEventTypes(page)).toContain('collection.completed');
  await expect.poll(() => readAudioEventTypes(page)).toContain('puzzle.discovered');
  const restoredBadge = page.getByTestId(`destination-${correctDestination}`).locator('.destination-complete');
  await expect(restoredBadge).toBeVisible();
  await expect(restoredBadge).toHaveText('✓ Restored');

  await page.getByTestId('toggle-skills').click();
  await page.getByTestId('purchase-resonance-lens').click();
  await expect(page.getByTestId('skill-resonance-lens')).toContainText(
    /other members of the selected item's collection, or items of the same family when it has no collection/i,
  );
  await expect(page.getByTestId('skill-resonance-lens')).toContainText(/never moves or files them/i);
  await expect.poll(() => readAudioEventTypes(page)).toContain('skill.unlocked');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');

  const relatedCard = page.getByTestId('lab-item-calibration-card-01');
  const relatedCardBefore = await relatedCard.boundingBox();
  expect(relatedCardBefore).not.toBeNull();
  const autosaveBeforeActivation = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  await page.getByTestId('toggle-resonance-lens').click();
  await expect.poll(() => readAudioEventTypes(page)).toContain('skill.activated');

  await expect(relatedCard).toHaveClass(/is-related/);
  await expect(page.getByTestId('destination-cabinet-calibration')).toHaveAttribute('aria-label', /8 of 8 objects placed/i);
  const relatedCardAfter = await relatedCard.boundingBox();
  expect(relatedCardAfter).not.toBeNull();
  expect(Math.abs(relatedCardAfter.x - relatedCardBefore.x)).toBeLessThan(1);
  expect(Math.abs(relatedCardAfter.y - relatedCardBefore.y)).toBeLessThan(1);
  expect(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey)).toBe(autosaveBeforeActivation);

  const puzzleHeaderControl = page.getByTestId('open-puzzle');
  await puzzleHeaderControl.click();

  const puzzle = page.getByTestId('puzzle-panel');
  await expect(puzzle).toBeVisible();

  for (const symbolIndex of [1, 0, 3, 2]) {
    await puzzle.getByTestId(`puzzle-symbol-${symbolIndex}`).click();
  }

  await puzzle.getByRole('button', { name: 'Submit sequence', exact: true }).click();
  await expect.poll(() => readAudioEventTypes(page)).toContain('puzzle.completed');
  await expect.poll(() => readAudioEventTypes(page)).toContain('machinery.stage.changed');
  await expect(page.getByTestId('invention-stage')).toContainText('Memory Crystal');

  await puzzle.getByRole('button', { name: 'Close puzzle panel' }).click();
  await expect(puzzle).toBeHidden();
  await expect(puzzleHeaderControl).toBeFocused();
});

test('accessible multi-selection completes a collection with one reward and puzzle unlock', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const state = createPartiallyFiledCalibrationState();
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: autoSaveKey,
    value: encodeSave(state),
  });
  await page.goto('/');
  await observeAudioEvents(page);
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');

  const savedBeforeSelection = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  await page.getByRole('button', { name: 'Select multiple items', exact: true }).click();
  const selectionToggle = page.getByTestId('multi-selection-toggle');
  await expect(selectionToggle).toHaveAttribute('aria-pressed', 'true');

  const seventhCard = page.getByTestId('lab-item-calibration-card-07');
  const eighthCard = page.getByTestId('lab-item-calibration-card-08');
  await seventhCard.click();
  await expect(seventhCard).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('multi-selection-count')).toHaveText('1 selected');
  await eighthCard.focus();
  await eighthCard.press('Enter');
  await expect(eighthCard).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('multi-selection-count')).toHaveText('2 selected');
  await expect(page.getByTestId('item-inspector')).toBeVisible();
  const selectedSummary = page.getByTestId('selected-items-summary');
  const selectedRows = selectedSummary.getByRole('listitem');
  const selectedCalibrationItems = ['calibration-card-07', 'calibration-card-08']
    .map((itemId) => state.items.find((entry) => entry.id === itemId));
  await expect(selectedRows).toHaveCount(selectedCalibrationItems.length);
  for (const selectedItem of selectedCalibrationItems) {
    const selectedRow = selectedRows.filter({
      has: page.getByText(selectedItem.title, { exact: true }),
    });
    await expect(selectedRow.getByText(selectedItem.title, { exact: true })).toBeVisible();
    const terms = selectedRow.locator('dt');
    const definitions = selectedRow.locator('dd');
    await expect(terms.nth(0)).toBeVisible();
    await expect(terms.nth(0)).toHaveText('Family');
    await expect(terms.nth(1)).toBeVisible();
    await expect(terms.nth(1)).toHaveText('Clue');
    await expect(definitions.nth(0)).toHaveText(selectedItem.family);
    await expect(definitions.nth(1)).toHaveText(selectedItem.clue);
  }
  expect(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey)).toBe(savedBeforeSelection,
    'selection state is transient and must stay outside the autosave');

  await page.getByRole('combobox', { name: /destination or work surface/i }).selectOption(correctDestination);
  await page.getByRole('button', { name: 'Move 2 selected items', exact: true }).click();

  await expect(selectionToggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('multi-selection-count')).toHaveCount(0);
  await expect(page.getByTestId('lab-item-calibration-card-08')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId(`destination-${correctDestination}`)).toHaveAttribute('aria-label', /8 of 8 objects placed/i);
  await expect(page.getByTestId('skill-points')).toContainText('Skill points: 1');
  await expect.poll(() => readAudioEventTypes(page)).toContain('collection.completed');
  await expect.poll(() => readAudioEventTypes(page)).toContain('puzzle.discovered');
  const eventTypes = await readAudioEventTypes(page);
  expect(eventTypes.filter((type) => type === 'collection.completed')).toHaveLength(1);
  expect(eventTypes.filter((type) => type === 'puzzle.discovered')).toHaveLength(1);

  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
  const savedState = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  const calibration = COLLECTIONS.find((collection) => collection.id === 'harmonic-calibration');
  expect(savedState.items.filter((item) => calibration.itemIds.includes(item.id))).toHaveLength(calibration.itemIds.length);
  expect(savedState.items.filter((item) => calibration.itemIds.includes(item.id)).every((item) => (
    item.validation === 'correct'
      && item.placement.kind === 'destination'
      && item.placement.destinationId === correctDestination
  ))).toBe(true);
  expect(savedState.progress.completedCollectionIds.filter((id) => id === calibration.id)).toHaveLength(1);
  expect(savedState.progress.unlockedPuzzleIds.filter((id) => id === 'pulse-sequence')).toHaveLength(1);
  expect(savedState.progress.skillPoints).toBe(1);
});

test('a mixed batch validates each item independently at its own destination', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const state = createNewGameState();
  const nearbyBlueprint = state.items.find((item) => item.id === 'blueprint-fragment-002');
  nearbyBlueprint.position = { x: 1390, y: 602 };
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: autoSaveKey,
    value: encodeSave(state),
  });
  await page.goto('/');

  await page.getByRole('button', { name: 'Select multiple items', exact: true }).click();
  await page.getByTestId('lab-item-calibration-card-08').click();
  const blueprint = page.getByTestId('lab-item-blueprint-fragment-002');
  await blueprint.focus();
  await blueprint.press('Enter');
  await expect(page.getByTestId('multi-selection-count')).toHaveText('2 selected');

  await page.getByRole('combobox', { name: /destination or work surface/i }).selectOption(wrongDestination);
  await page.getByRole('button', { name: 'Move 2 selected items', exact: true }).click();

  const misfiledCalibration = page.getByTestId('lab-item-calibration-card-08');
  await expect(blueprint).toHaveClass(/success-pulse/);
  await expect(blueprint).not.toContainText('Misfiled');
  await expect(misfiledCalibration).toContainText('Misfiled');
  await expect(misfiledCalibration).toHaveAccessibleName(/Misfiled/i);
  await expect(misfiledCalibration).toHaveAccessibleDescription(/Misfiled/i);

  await expect(page.getByTestId('destination-cabinet-blueprints')).toHaveAttribute('aria-label', /2 of 36 objects placed/i);
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
  const savedState = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(savedState.items.find((item) => item.id === 'calibration-card-08')).toMatchObject({
    validation: 'invalid',
    placement: { kind: 'destination', destinationId: wrongDestination },
  });
  expect(savedState.items.find((item) => item.id === 'blueprint-fragment-002')).toMatchObject({
    validation: 'correct',
    placement: { kind: 'destination', destinationId: wrongDestination },
  });
});

test('pointer selection from the overview canvas exposes the canvas-only item without dragging', async ({ page }) => {
  await page.setViewportSize({ width: 3000, height: 1800 });
  const state = createNewGameState();
  const canvasOnlyItem = state.items.at(-1);
  canvasOnlyItem.position = findIsolatedWorldPosition(canvasOnlyItem, state.items);
  const scale = 0.4;
  state.camera = {
    scale,
    panX: 1500 - (WORLD_BOUNDS.x + WORLD_BOUNDS.width / 2) * scale,
    panY: 900 - (WORLD_BOUNDS.y + WORLD_BOUNDS.height / 2) * scale,
  };
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: autoSaveKey,
    value: encodeSave(state),
  });
  await page.goto('/');
  await observeAudioEvents(page);

  const canvas = page.getByTestId('world-overview-canvas');
  await expect(canvas).toBeVisible();
  const overlayItemIds = await page.locator('.world-scene .lab-object').evaluateAll((buttons) => (
    buttons.map((button) => button.dataset.itemId)
  ));
  expect(overlayItemIds).not.toContain(canvasOnlyItem.id,
    'the chosen item must be drawn by canvas rather than an existing DOM overlay');

  const viewport = page.getByTestId('world-viewport');
  const viewportBox = await viewport.boundingBox();
  expect(viewportBox).not.toBeNull();
  const pointer = {
    x: viewportBox.x + state.camera.panX + (canvasOnlyItem.position.x + canvasOnlyItem.width / 2) * scale,
    y: viewportBox.y + state.camera.panY + (canvasOnlyItem.position.y + canvasOnlyItem.height / 2) * scale,
  };
  expect(pointer.x).toBeGreaterThan(viewportBox.x);
  expect(pointer.x).toBeLessThan(viewportBox.x + viewportBox.width);
  expect(pointer.y).toBeGreaterThan(viewportBox.y);
  expect(pointer.y).toBeLessThan(viewportBox.y + viewportBox.height);

  await page.getByRole('button', { name: 'Select multiple items', exact: true }).click();
  await page.mouse.click(pointer.x, pointer.y);

  const selectedCanvasItem = page.getByTestId(`lab-item-${canvasOnlyItem.id}`);
  await expect(selectedCanvasItem).toBeVisible();
  await expect(selectedCanvasItem).toHaveAttribute('aria-pressed', 'true');
  await expect(selectedCanvasItem).not.toHaveClass(/is-dragging/);
  await expect(page.getByTestId('multi-selection-count')).toHaveText('1 selected');
  expect(await readAudioEventTypes(page)).not.toContain('item.pickup',
    'a canvas selection must not start an item drag');
});

test('entering multi-selection carries the current item into the group and allows deselection', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');

  const item = page.getByTestId('lab-item-calibration-card-01');
  await item.click();
  await expect(item).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Select multiple items', exact: true }).click();

  const selectionCount = page.getByTestId('multi-selection-count');
  await expect(selectionCount).toHaveText('1 selected');
  await expect(item).toHaveAttribute('aria-pressed', 'true');

  await item.focus();
  await item.press('Enter');
  await expect(selectionCount).toHaveText('0 selected');
  await expect(item).toHaveAttribute('aria-pressed', 'false');

  await item.focus();
  await item.press('Enter');
  await expect(selectionCount).toHaveText('1 selected');
  await expect(item).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('move-target').selectOption(correctDestination);
  await page.getByTestId('move-selected-items').click();

  await expect(page.getByTestId('multi-selection-toggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(selectionCount).toHaveCount(0);
  await expect(item).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId(`destination-${correctDestination}`)).toHaveAttribute('aria-label', /1 of 8 objects placed/i);
});

test('multi-selection stops at 40 and announces the limit without selecting item 41', async ({ page }) => {
  await page.setViewportSize({ width: 3000, height: 1800 });
  const state = createNewGameState();
  const scale = 0.4;
  state.camera = {
    scale,
    panX: 1500 - (WORLD_BOUNDS.x + WORLD_BOUNDS.width / 2) * scale,
    panY: 900 - (WORLD_BOUNDS.y + WORLD_BOUNDS.height / 2) * scale,
  };
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: autoSaveKey,
    value: encodeSave(state),
  });
  await page.goto('/');

  await page.getByRole('button', { name: 'Select multiple items', exact: true }).click();
  const itemButtons = page.locator('.world-viewport .lab-object');
  await expect.poll(() => itemButtons.count()).toBeGreaterThanOrEqual(41);
  const visibleItemIds = await itemButtons.evaluateAll((buttons) => buttons
    .slice(0, 41)
    .map((button) => button.dataset.itemId));
  expect(new Set(visibleItemIds).size).toBe(41, 'the test must activate 41 distinct visible laboratory objects');

  for (const itemId of visibleItemIds.slice(0, 40)) {
    const item = page.getByTestId(`lab-item-${itemId}`);
    await item.focus();
    await item.press('Enter');
  }
  await expect(page.getByTestId('multi-selection-count')).toHaveText('40 selected');
  const selectedSummary = page.getByTestId('selected-items-summary');
  const selectedRows = selectedSummary.getByRole('listitem');
  await expect(selectedRows).toHaveCount(40);
  const lastSelectedItem = state.items.find((item) => item.id === visibleItemIds[39]);
  await expect(selectedRows.nth(39)).toContainText(lastSelectedItem.title);
  await expect(selectedRows.nth(39)).toContainText(lastSelectedItem.clue);
  const detailsMetrics = await selectedSummary.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(detailsMetrics.scrollHeight).toBeGreaterThan(detailsMetrics.clientHeight,
    'all selected-item details should overflow the Inspector details region');
  await selectedSummary.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const detailsScrollTop = await selectedSummary.evaluate((element) => element.scrollTop);
  expect(detailsScrollTop).toBeGreaterThan(0, 'the selected-item details region should scroll independently');
  const inspectorBounds = await page.getByTestId('item-inspector').boundingBox();
  const moveButton = page.getByTestId('move-selected-items');
  await expect(moveButton).toBeVisible();
  const moveButtonBounds = await moveButton.boundingBox();
  expect(inspectorBounds).not.toBeNull();
  expect(moveButtonBounds).not.toBeNull();
  expect(moveButtonBounds.x).toBeGreaterThanOrEqual(inspectorBounds.x);
  expect(moveButtonBounds.y).toBeGreaterThanOrEqual(inspectorBounds.y);
  expect(moveButtonBounds.x + moveButtonBounds.width).toBeLessThanOrEqual(inspectorBounds.x + inspectorBounds.width);
  expect(moveButtonBounds.y + moveButtonBounds.height).toBeLessThanOrEqual(inspectorBounds.y + inspectorBounds.height);
  const selectedIdsAtLimit = await itemButtons.evaluateAll((buttons) => buttons
    .filter((button) => button.getAttribute('aria-pressed') === 'true')
    .map((button) => button.dataset.itemId));
  expect(new Set(selectedIdsAtLimit)).toEqual(new Set(visibleItemIds.slice(0, 40)));
  expect(await page.locator('.world-scene .lab-object').count()).toBeLessThanOrEqual(64,
    'the selected-item overlays must stay within the overview renderer ceiling');

  const fortyFirstItem = page.getByTestId(`lab-item-${visibleItemIds[40]}`);
  await fortyFirstItem.focus();
  await fortyFirstItem.press('Enter');

  await expect(page.getByTestId('multi-selection-count')).toHaveText('40 selected');
  await expect(fortyFirstItem).toHaveAttribute('aria-pressed', 'false');
  const selectedIdsAfterLimitAttempt = await itemButtons.evaluateAll((buttons) => buttons
    .filter((button) => button.getAttribute('aria-pressed') === 'true')
    .map((button) => button.dataset.itemId));
  expect(new Set(selectedIdsAfterLimitAttempt)).toEqual(new Set(selectedIdsAtLimit),
    'rejecting the 41st object must preserve the existing selected IDs');
  const limitAnnouncement = page.getByRole('status').filter({ hasText: /40/i });
  await expect(limitAnnouncement).toContainText(/40/i);
  await expect(limitAnnouncement).toContainText(/limit|max|cap|only|up to|no more|cannot|can't/i);
});

test('an over-capacity batch changes no items or progress and keeps its selection', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const state = createPartiallyFiledCalibrationState({ filedCount: 7, fillRemainingSlot: true });
  const nearbyUnfiledItem = state.items.find((item) => item.id === 'blueprint-fragment-002');
  nearbyUnfiledItem.position = { x: 1390, y: 602 };
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: autoSaveKey,
    value: encodeSave(state),
  });
  await page.goto('/');
  await observeAudioEvents(page);
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');

  const savedBeforeSelection = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  const beforeMove = decodeSave(savedBeforeSelection);
  await page.getByRole('button', { name: 'Select multiple items', exact: true }).click();
  const selectionToggle = page.getByTestId('multi-selection-toggle');
  await expect(selectionToggle).toHaveAttribute('aria-pressed', 'true');

  const eighthCard = page.getByTestId('lab-item-calibration-card-08');
  const extraBlueprint = page.getByTestId('lab-item-blueprint-fragment-002');
  await eighthCard.click();
  await extraBlueprint.focus();
  await extraBlueprint.press('Enter');
  await expect(eighthCard).toHaveAttribute('aria-pressed', 'true');
  await expect(extraBlueprint).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('multi-selection-count')).toHaveText('2 selected');
  expect(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey)).toBe(savedBeforeSelection,
    'selecting items must not add transient selection data to the autosave');

  await page.getByRole('combobox', { name: /destination or work surface/i }).selectOption(correctDestination);
  await page.getByRole('button', { name: 'Move 2 selected items', exact: true }).click();

  await expect(page.getByTestId('game-feedback')).toContainText(/full|capacit|slot|space/i);
  await expect(selectionToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('multi-selection-count')).toHaveText('2 selected');
  await expect(eighthCard).toHaveAttribute('aria-pressed', 'true');
  await expect(extraBlueprint).toHaveAttribute('aria-pressed', 'true');

  const savedAfterFailure = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  const afterFailure = decodeSave(savedAfterFailure);
  expect(afterFailure.items).toEqual(beforeMove.items, 'capacity rejection must not partially move any item');
  expect(afterFailure.progress).toEqual(beforeMove.progress, 'capacity rejection must not award or unlock anything');
  expect(await readAudioEventTypes(page)).toEqual([], 'a rejected batch should not emit successful placement or progression events');
});

test('item pickup waits for a real drag threshold and a pointer drop reports placement outcome', async ({ page }) => {
  const state = createNewGameState();
  const itemState = state.items.find((item) => item.id === firstCalibrationCard);
  itemState.position = { x: 1600, y: 2900 };
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: autoSaveKey,
    value: encodeSave(state),
  });
  await page.goto('/');
  await observeAudioEvents(page);
  await page.getByTestId('world-jump').selectOption('destination:cabinet-blueprints');

  const item = page.getByTestId(`lab-item-${firstCalibrationCard}`);
  const wrongCabinet = page.getByTestId('destination-cabinet-blueprints');
  await item.click();
  expect(await readAudioEventTypes(page)).toEqual([], 'a selection click does not emit pickup or drop cues');

  await item.dragTo(wrongCabinet, { targetPosition: { x: 110, y: 80 }, steps: 8 });
  await expect(item).toContainText('Misfiled');
  expect(await readAudioEventTypes(page)).toEqual([
    'item.pickup',
    'item.drop',
    'item.placement.invalid',
  ]);
});

test('a filed card remains filed after reloading the laboratory', async ({ page }) => {
  await page.goto('/');

  await selectAndMoveItem(page, firstCalibrationCard, correctDestination);
  const destination = page.getByTestId(`destination-${correctDestination}`);
  await expect(destination).toHaveAttribute('aria-label', /1 of 8 objects placed/i);
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');

  await page.reload();

  await expect(page.getByTestId(`destination-${correctDestination}`)).toHaveAttribute(
    'aria-label',
    /1 of 8 objects placed/i,
  );
});
