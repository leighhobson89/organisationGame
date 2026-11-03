import { expect, test } from '@playwright/test';
import { observeAudioEvents, readAudioEventTypes } from '../helpers/audioEvents.js';
import { generateLab } from '../../src/game/content/generateLab.js';
import { DESTINATIONS, SCRATCH_PADS } from '../../src/game/content/catalog.js';
import { decodeSave, encodeSave } from '../../src/game/persistence/save.js';
import { getTargetSlotPosition } from '../../src/game/world/placementLayout.js';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import LZString from 'lz-string';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const backupKey = 'palimpsest-laboratory.backup.v1';
const calibrationCard = 'calibration-card-01';

async function moveWithInspector(page, itemId, targetId) {
  await page.getByTestId(`lab-item-${itemId}`).click();
  await page.getByRole('combobox', { name: /move to destination or work surface/i }).selectOption(targetId);
  await page.getByRole('button', { name: 'Move item', exact: true }).click();
}

async function waitForAutosave(page) {
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
}

function createFullScratchPadSave(movingItemIndex = 32) {
  const items = generateLab('palimpsest-first-shift', 174);
  const scratchPadId = 'scratch-a';
  const scratchPad = SCRATCH_PADS.find((entry) => entry.id === scratchPadId);
  const target = { kind: 'scratchpad', id: scratchPadId };
  const padItems = items.slice(8, 32);

  for (const [index, item] of items.entries()) {
    if (index >= 8 && index < 32) continue;
    item.position = {
      x: 3000 + (index % 12) * 150,
      y: 2200 + Math.floor(index / 12) * 65,
    };
  }

  for (const [slotIndex, item] of padItems.entries()) {
    item.previousWorkspacePosition = { ...item.position };
    item.position = getTargetSlotPosition({ target, item, slotIndex, destinations: DESTINATIONS, scratchPads: SCRATCH_PADS });
    item.placement = { kind: 'scratchpad', scratchPadId, slotIndex };
    item.rotation = 0;
  }

  const movingItem = items[movingItemIndex];
  if (movingItemIndex === 32) {
    movingItem.position = { x: 1220, y: 2220 };
    movingItem.placement = { kind: 'workspace' };
  }

  return {
    movingItemId: movingItem.id,
    slotCount: scratchPad.capacity,
    unusedCellPosition: {
      x: (scratchPad.layout.insetX + 4 * (scratchPad.layout.cellWidth + scratchPad.layout.gapX) + scratchPad.layout.cellWidth / 2) / scratchPad.width,
      y: (scratchPad.layout.insetY + 4 * (scratchPad.layout.cellHeight + scratchPad.layout.gapY) + scratchPad.layout.cellHeight / 2) / scratchPad.height,
    },
    encodedSave: encodeSave({
      version: 3,
      contentSeed: 'palimpsest-first-shift',
      items,
      progress: { skillPoints: 0, completedCollectionIds: [], unlockedPuzzleIds: [], solvedPuzzleIds: [], ownedSkills: [] },
      camera: { panX: 0, panY: 0, scale: 0.5 },
      inventionStage: 'Dormant',
      notebook: { discoveries: [] },
    }),
  };
}

function compressV1Save(state) {
  return LZString.compressToEncodedURIComponent(JSON.stringify(state));
}

function createV1State(items, progress = {}) {
  return {
    version: 1,
    contentSeed: 'palimpsest-first-shift',
    items,
    progress: {
      skillPoints: 0,
      completedCollectionIds: [],
      unlockedPuzzleIds: [],
      solvedPuzzleIds: [],
      ownedSkills: [],
      ...progress,
    },
    camera: { panX: 0, panY: 0, scale: 0.5 },
    inventionStage: 'Dormant',
    notebook: { discoveries: [] },
  };
}

function createFiledGeometrySave() {
  const items = generateLab('palimpsest-first-shift', 174);
  const target = { kind: 'destination', id: 'drawer-field-notes' };
  const entry = DESTINATIONS.find((destination) => destination.id === target.id);
  const filedItems = items.filter((item) => item.family === 'handwritten-note').slice(0, 2);
  const filedIds = new Set(filedItems.map((item) => item.id));
  const workspaceWitness = items.find((item) => !filedIds.has(item.id) && item.placement.kind === 'workspace');

  for (const [index, item] of items.entries()) {
    if (filedIds.has(item.id) || item.id === workspaceWitness.id) continue;
    item.position = {
      x: 3000 + (index % 12) * 150,
      y: 2200 + Math.floor(index / 12) * 65,
    };
  }

  for (const [index, item] of filedItems.entries()) {
    const slotIndex = index === 0 ? 5 : 11;
    item.previousWorkspacePosition = { ...item.position };
    item.position = getTargetSlotPosition({ target, item, slotIndex, destinations: DESTINATIONS, scratchPads: SCRATCH_PADS });
    item.placement = { kind: 'destination', destinationId: target.id, slotIndex };
    item.rotation = 0;
  }
  workspaceWitness.position = { x: entry.position.x - workspaceWitness.width - 16, y: entry.position.y + 300 };

  return {
    encodedSave: encodeSave({
      version: 3,
      contentSeed: 'palimpsest-first-shift',
      items,
      progress: { skillPoints: 0, completedCollectionIds: [], unlockedPuzzleIds: [], solvedPuzzleIds: [], ownedSkills: [] },
      camera: { panX: 0, panY: 0, scale: 0.5 },
      inventionStage: 'Dormant',
      notebook: { discoveries: [] },
    }),
    filedItems,
    workspaceWitness,
  };
}

async function openSaveDialogWithDistinctBackup(page) {
  await page.goto('/');
  await waitForAutosave(page);
  const beforeAutosave = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  expect(beforeAutosave).not.toBeNull();

  const baselineState = decodeSave(beforeAutosave);
  const backupState = structuredClone(baselineState);
  backupState.progress.skillPoints += 1;
  const distinctBackup = encodeSave(backupState);
  await page.evaluate(({ key, value }) => window.localStorage.setItem(key, value), { key: backupKey, value: distinctBackup });
  const beforeBackup = await page.evaluate((key) => window.localStorage.getItem(key), backupKey);
  expect(beforeBackup).not.toBe(beforeAutosave);

  await page.getByTestId('open-saves').click();
  const beforeExport = await page.getByTestId('save-export-string').inputValue();
  return {
    beforeAutosave,
    beforeBackup,
    beforeExport,
    beforeState: decodeSave(beforeExport),
  };
}

async function expectV3ImportRejectedWithoutChanges(page, baseline, invalidState, feedbackPattern) {
  await page.getByTestId('save-import-string').fill(encodeSave(invalidState));
  await page.getByRole('checkbox', { name: /valid import replaces the current laboratory/i }).check();
  await page.getByRole('button', { name: 'Validate & import save' }).click();

  await expect(page.getByTestId('save-feedback')).toContainText(feedbackPattern);
  await expect(page.getByTestId('save-export-string')).toHaveValue(baseline.beforeExport);
  expect(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey)).toBe(baseline.beforeAutosave);
  expect(await page.evaluate((key) => window.localStorage.getItem(key), backupKey)).toBe(baseline.beforeBackup);
  expect(baseline.beforeState.version).toBe(3);
}

async function tabUntilTestId(page, testId, maxTabs = 400) {
  for (let index = 0; index < maxTabs; index += 1) {
    const focusedTestId = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    if (focusedTestId === testId) return;
    await page.keyboard.press('Tab');
  }

  throw new Error(`Keyboard navigation did not reach ${testId} within ${maxTabs} Tab presses.`);
}

async function findEmptyViewportPoint(page) {
  const point = await page.evaluate(() => {
    const viewport = document.querySelector('[data-testid="world-viewport"]');
    const bounds = viewport?.getBoundingClientRect();
    if (!viewport || !bounds) return null;

    for (let y = bounds.top + 32; y < bounds.bottom - 112; y += 32) {
      for (let x = bounds.left + 32; x < bounds.right - 32; x += 32) {
        const hit = document.elementFromPoint(x, y);
        if (!hit || !viewport.contains(hit)) continue;
        if (hit.closest('[data-item-id], [data-drop-id], .game-toolbar, [data-testid="item-inspector"]')) continue;
        return { x, y };
      }
    }

    return null;
  });

  if (!point) throw new Error('No empty laboratory point was available for the pan-cancel test.');
  return point;
}

test('pointer cancellation abandons an item drag without moving or filing the item', async ({ page }) => {
  await page.goto('/');
  const item = page.getByTestId(`lab-item-${calibrationCard}`);
  await expect(item).toBeVisible();
  const before = await item.boundingBox();
  expect(before).not.toBeNull();

  await page.evaluate(() => {
    window.__e2ePointerId = null;
    document.addEventListener('pointerdown', (event) => {
      window.__e2ePointerId = event.pointerId;
    }, { capture: true, once: true });
  });

  const start = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
  const end = { x: start.x + 84, y: start.y + 54 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 4 });

  const pointerId = await page.evaluate(() => window.__e2ePointerId);
  expect(pointerId).not.toBeNull();
  await page.getByTestId('world-viewport').dispatchEvent('pointercancel', {
    pointerId,
    pointerType: 'mouse',
    isPrimary: true,
    clientX: end.x,
    clientY: end.y,
    button: -1,
    buttons: 0,
  });
  await page.mouse.up();

  const after = await item.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after.x - before.x)).toBeLessThan(1);
  expect(Math.abs(after.y - before.y)).toBeLessThan(1);
  await expect(item).not.toContainText('Misfiled');
});

test('pointer cancellation restores the camera transform after a pan gesture', async ({ page }) => {
  await page.goto('/');
  const world = page.getByTestId('world-viewport');
  const scene = page.locator('.world-scene');
  const originalTransform = await scene.evaluate((element) => element.style.transform);
  const start = await findEmptyViewportPoint(page);
  const end = { x: start.x + 76, y: start.y + 48 };

  await page.evaluate(() => {
    window.__e2ePointerId = null;
    document.addEventListener('pointerdown', (event) => {
      window.__e2ePointerId = event.pointerId;
    }, { capture: true, once: true });
  });

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 4 });
  const pointerId = await page.evaluate(() => window.__e2ePointerId);
  expect(pointerId).not.toBeNull();

  await world.dispatchEvent('pointercancel', {
    pointerId,
    pointerType: 'mouse',
    isPrimary: true,
    clientX: end.x,
    clientY: end.y,
    button: -1,
    buttons: 0,
  });
  await page.mouse.up();

  await expect.poll(() => scene.evaluate((element) => element.style.transform)).toBe(originalTransform);
});

test('Escape cancels an active item drag without moving or filing the item', async ({ page }) => {
  await page.goto('/');
  const item = page.getByTestId(`lab-item-${calibrationCard}`);
  await expect(item).toBeVisible();
  const before = await item.boundingBox();
  expect(before).not.toBeNull();

  const start = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 90, start.y + 56, { steps: 4 });
  await page.keyboard.press('Escape');
  await page.mouse.up();

  const after = await item.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after.x - before.x)).toBeLessThan(1);
  expect(Math.abs(after.y - before.y)).toBeLessThan(1);
  await expect(item).not.toContainText('Misfiled');
});

test('Escape restores the camera transform after an active pan gesture', async ({ page }) => {
  await page.goto('/');
  const scene = page.locator('.world-scene');
  const originalTransform = await scene.evaluate((element) => element.style.transform);
  const start = await findEmptyViewportPoint(page);

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 78, start.y + 46, { steps: 4 });
  await page.keyboard.press('Escape');
  await page.mouse.up();

  await expect.poll(() => scene.evaluate((element) => element.style.transform)).toBe(originalTransform);
});

test('physical dragging files an item to a destination and moves another to a scratch pad', async ({ page }) => {
  await page.goto('/');

  const item = page.getByTestId(`lab-item-${calibrationCard}`);
  const destination = page.getByTestId('destination-cabinet-calibration');
  await expect(item).toBeVisible();
  await expect(destination).toBeVisible();
  await item.dragTo(destination, { targetPosition: { x: 110, y: 80 }, steps: 8 });
  await expect(destination).toHaveAttribute('aria-label', /1 of 8 objects placed/i);
  await expect(item).not.toContainText('Misfiled');

  const world = page.getByTestId('world-viewport');
  await world.focus();
  for (let step = 0; step < 3; step += 1) await page.keyboard.press('ArrowDown');

  const looseItem = page.getByTestId('lab-item-calibration-card-02');
  const scratchPad = page.getByTestId('scratch-scratch-a');
  await expect(looseItem).toBeVisible();
  await expect(scratchPad).toBeVisible();
  await looseItem.dragTo(scratchPad, { targetPosition: { x: 140, y: 90 }, steps: 8 });

  await expect(scratchPad).toHaveAttribute('aria-label', /1 objects here/i);
  await expect(page.getByTestId('game-feedback')).toContainText(/temporary arrangement/i);
});

test('keyboard-only selection and filing moves a lab item into its final destination', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('world-item-count')).toContainText('174');

  await tabUntilTestId(page, `lab-item-${calibrationCard}`);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('item-inspector')).toBeVisible();

  await tabUntilTestId(page, 'move-target');
  for (let step = 0; step < 3; step += 1) await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('move-target')).toHaveValue('cabinet-calibration');

  await tabUntilTestId(page, 'move-item');
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('destination-cabinet-calibration')).toHaveAttribute('aria-label', /1 of 8 objects placed/i);
});

test('keyboard selection moves focus directly to the inspector move control', async ({ page }) => {
  await page.goto('/');
  await tabUntilTestId(page, `lab-item-${calibrationCard}`);
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('item-inspector')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('move-target');
});

test('a physical drop on a full scratch pad keeps the item loose and reports capacity', async ({ page }) => {
  const fixture = createFullScratchPadSave();
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), { key: autoSaveKey, value: fixture.encodedSave });
  await page.goto('/');
  await observeAudioEvents(page);

  await page.getByTestId('world-jump').selectOption('scratchpad:scratch-a');
  const scratchPad = page.getByTestId('scratch-scratch-a');
  const looseItem = page.getByTestId(`lab-item-${fixture.movingItemId}`);
  await expect(scratchPad).toBeVisible();
  await expect(scratchPad).toHaveAttribute('aria-label', /24 objects here/i);
  await expect(looseItem).toBeVisible();
  const before = await looseItem.boundingBox();
  expect(before).not.toBeNull();

  const padBounds = await scratchPad.boundingBox();
  expect(padBounds).not.toBeNull();
  await looseItem.dragTo(scratchPad, {
    targetPosition: { x: padBounds.width * fixture.unusedCellPosition.x, y: padBounds.height * fixture.unusedCellPosition.y },
    steps: 8,
  });

  await expect(scratchPad).toHaveAttribute('aria-label', /24 objects here/i);
  await expect(page.getByTestId('game-feedback')).toContainText(/full|capacity|slot/i);
  expect(await readAudioEventTypes(page)).toEqual([
    'item.pickup',
    'item.drop',
  ], 'a rejected capacity allocation has no placement result event');
  await expect(page.locator('.inspector-meta strong')).toHaveText(/Loose in the laboratory/i);
  const after = await looseItem.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after.x - before.x)).toBeLessThan(1);
  expect(Math.abs(after.y - before.y)).toBeLessThan(1);
});

test('physical dragging an existing occupant within a full scratch pad is allowed', async ({ page }) => {
  const fixture = createFullScratchPadSave(8);
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), { key: autoSaveKey, value: fixture.encodedSave });
  await page.goto('/');

  await page.getByTestId('world-jump').selectOption('scratchpad:scratch-a');
  const scratchPad = page.getByTestId('scratch-scratch-a');
  const item = page.getByTestId(`lab-item-${fixture.movingItemId}`);
  await expect(scratchPad).toHaveAttribute('aria-label', /24 objects here/i);
  await expect(item).toBeVisible();
  const before = await item.boundingBox();
  expect(before).not.toBeNull();

  const padBounds = await scratchPad.boundingBox();
  expect(padBounds).not.toBeNull();
  await item.dragTo(scratchPad, {
    targetPosition: { x: padBounds.width * fixture.unusedCellPosition.x, y: padBounds.height * fixture.unusedCellPosition.y },
    steps: 8,
  });

  await expect(scratchPad).toHaveAttribute('aria-label', /24 objects here/i);
  await expect(page.getByTestId('game-feedback')).toContainText(/temporary arrangement|work surface/i);
  await expect(page.locator('.inspector-meta strong')).toHaveText(/Analysis Table/i);
  const after = await item.boundingBox();
  expect(after).not.toBeNull();
  expect(after.x).toBeGreaterThanOrEqual((await scratchPad.boundingBox()).x);
  expect(after.y).toBeGreaterThanOrEqual((await scratchPad.boundingBox()).y);
});

test('filed note buttons fit canonical geometry without row overlap and workspace keeps 78px minimum height', async ({ page }) => {
  const fixture = createFiledGeometrySave();
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), { key: autoSaveKey, value: fixture.encodedSave });
  await page.goto('/');
  await page.getByTestId('world-jump').selectOption('destination:drawer-field-notes');

  const [firstItem, secondItem] = fixture.filedItems.map((item) => page.getByTestId(`lab-item-${item.id}`));
  const workspaceItem = page.getByTestId(`lab-item-${fixture.workspaceWitness.id}`);
  await expect(firstItem).toBeVisible();
  await expect(secondItem).toBeVisible();
  await expect(workspaceItem).toBeVisible();

  const sceneScale = await page.locator('.world-scene').evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).a);
  const readRect = (locator) => locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
  });
  const firstRect = await readRect(firstItem);
  const secondRect = await readRect(secondItem);
  for (const [item, rect] of [[fixture.filedItems[0], firstRect], [fixture.filedItems[1], secondRect]]) {
    expect(rect.width).toBeLessThanOrEqual(item.width * sceneScale + 1);
    expect(rect.height).toBeLessThanOrEqual(item.height * sceneScale + 1);
    expect(await page.getByTestId(`lab-item-${item.id}`).evaluate((element) => element.style.transform)).toBe('rotate(0deg)');
  }
  const overlap = firstRect.left < secondRect.right
    && firstRect.right > secondRect.left
    && firstRect.top < secondRect.bottom
    && firstRect.bottom > secondRect.top;
  expect(overlap).toBe(false);

  const workspaceStyle = await workspaceItem.evaluate((element) => ({ minHeight: getComputedStyle(element).minHeight, rect: element.getBoundingClientRect() }));
  expect(workspaceStyle.minHeight).toBe('78px');
  expect(workspaceStyle.rect.height / sceneScale).toBeCloseTo(78, 0);
});

test('inspector move success keeps focus on Move and announces the result', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId(`lab-item-${calibrationCard}`).click();
  await page.getByTestId('move-target').selectOption('cabinet-calibration');
  const moveButton = page.getByTestId('move-item');
  await moveButton.click();

  await expect(page.getByTestId('destination-cabinet-calibration')).toHaveAttribute('aria-label', /1 of 8 objects placed/i);
  await expect(page.getByTestId('item-inspector')).toBeVisible();
  await expect(moveButton).toBeFocused();
  await expect(page.getByTestId('game-feedback')).toHaveRole('status');
  await expect(page.getByTestId('game-feedback')).toHaveAttribute('aria-live', 'polite');
  await expect(page.getByTestId('game-feedback')).toContainText(/filed correctly/i);
});

test('Move item stays visible at 1084×827 without scrolling Inspector details and saves positions', async ({ page }) => {
  const viewport = { width: 1084, height: 827 };
  await page.setViewportSize(viewport);

  const state = createNewGameState();
  const startingItem = state.items.find((item) => item.id === calibrationCard);
  const originalWorkspacePosition = { ...startingItem.position };
  startingItem.clue = `${'The recorder caught a fragment through the wavering chamber echo. '.repeat(24)}`.slice(0, 980);
  const encodedSave = encodeSave(state);
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: autoSaveKey,
    value: encodedSave,
  });
  await page.goto('/');

  const item = page.getByTestId(`lab-item-${calibrationCard}`);
  await expect(item).toBeVisible();
  const pageScrollBeforeSelection = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  await item.click();

  const inspector = page.getByTestId('item-inspector');
  const moveButton = page.getByTestId('move-item');
  await expect(inspector).toBeVisible();
  await expect(moveButton).toBeVisible();
  const beforeMoveMeasurement = await inspector.evaluate((element) => {
    const move = element.querySelector('[data-testid="move-item"]');
    const panelRect = element.getBoundingClientRect();
    const moveRect = move.getBoundingClientRect();
    const scrollableDetails = [element, ...element.querySelectorAll('*')].some((candidate) => (
      candidate.scrollHeight > candidate.clientHeight + 1
      && ['auto', 'scroll'].includes(getComputedStyle(candidate).overflowY)
    ));
    return {
      panel: { top: panelRect.top, bottom: panelRect.bottom, left: panelRect.left, right: panelRect.right },
      move: { top: moveRect.top, bottom: moveRect.bottom, left: moveRect.left, right: moveRect.right },
      inspectorScrollTop: element.scrollTop,
      scrollableDetails,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      pageScroll: { x: window.scrollX, y: window.scrollY },
    };
  });

  expect(beforeMoveMeasurement.viewport).toEqual(viewport);
  expect(beforeMoveMeasurement.scrollableDetails).toBe(true);
  expect(beforeMoveMeasurement.inspectorScrollTop).toBe(0);
  expect(beforeMoveMeasurement.pageScroll).toEqual(pageScrollBeforeSelection);
  expect(beforeMoveMeasurement.move.top).toBeGreaterThanOrEqual(Math.max(0, beforeMoveMeasurement.panel.top));
  expect(beforeMoveMeasurement.move.bottom).toBeLessThanOrEqual(Math.min(viewport.height, beforeMoveMeasurement.panel.bottom));
  expect(beforeMoveMeasurement.move.left).toBeGreaterThanOrEqual(beforeMoveMeasurement.panel.left);
  expect(beforeMoveMeasurement.move.right).toBeLessThanOrEqual(Math.min(viewport.width, beforeMoveMeasurement.panel.right));

  await page.getByTestId('move-target').selectOption('cabinet-calibration');
  const afterTargetSelection = await inspector.evaluate((element) => ({
    scrollTop: element.scrollTop,
    pageScrollY: window.scrollY,
    moveBottom: element.querySelector('[data-testid="move-item"]').getBoundingClientRect().bottom,
    panelBottom: element.getBoundingClientRect().bottom,
  }));
  expect(afterTargetSelection.scrollTop).toBe(0);
  expect(afterTargetSelection.pageScrollY).toBe(pageScrollBeforeSelection.y);
  expect(afterTargetSelection.moveBottom).toBeLessThanOrEqual(Math.min(viewport.height, afterTargetSelection.panelBottom));

  await moveButton.click();
  await expect(page.getByTestId('destination-cabinet-calibration')).toHaveAttribute('aria-label', /1 of 8 objects placed/i);
  await expect.poll(async () => {
    const rawSave = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
    if (!rawSave) return null;
    return decodeSave(rawSave).items.find((savedItem) => savedItem.id === calibrationCard)?.placement?.destinationId ?? null;
  }).toBe('cabinet-calibration');

  const savedState = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  const savedItem = savedState.items.find((entry) => entry.id === calibrationCard);
  const expectedPosition = getTargetSlotPosition({
    target: { kind: 'destination', id: 'cabinet-calibration' },
    item: startingItem,
    slotIndex: 0,
    destinations: DESTINATIONS,
    scratchPads: SCRATCH_PADS,
  });
  expect(savedItem.placement).toEqual({ kind: 'destination', destinationId: 'cabinet-calibration', slotIndex: 0 });
  expect(savedItem.position).toEqual(expectedPosition);
  expect(savedItem.previousWorkspacePosition).toEqual(originalWorkspacePosition);
});

test('Move item stays inside the Inspector at 390×480 before auto-scroll', async ({ page }) => {
  const viewport = { width: 390, height: 480 };
  await page.setViewportSize(viewport);

  const state = createNewGameState();
  const startingItem = state.items.find((item) => item.id === calibrationCard);
  startingItem.clue = `${'The recorder caught a fragment through the wavering chamber echo. '.repeat(24)}`.slice(0, 980);
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: autoSaveKey,
    value: encodeSave(state),
  });
  await page.goto('/');

  const pageScrollBeforeSelection = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  await page.getByRole('button', { name: 'Find an item' }).click();
  await page.getByRole('searchbox', { name: 'Search laboratory items' }).fill(calibrationCard);
  const finderResult = page.getByTestId(`item-finder-result-${calibrationCard}`);
  await finderResult.focus();
  await page.keyboard.press('Enter');

  const inspector = page.getByTestId('item-inspector');
  const moveButton = page.getByTestId('move-item');
  await expect(inspector).toBeVisible();
  await expect(moveButton).toBeVisible();
  const measurement = await inspector.evaluate((element) => {
    const move = element.querySelector('[data-testid="move-item"]');
    const panelRect = element.getBoundingClientRect();
    const moveRect = move.getBoundingClientRect();
    const scrollableDetails = [element, ...element.querySelectorAll('*')].some((candidate) => (
      candidate.scrollHeight > candidate.clientHeight + 1
      && ['auto', 'scroll'].includes(getComputedStyle(candidate).overflowY)
    ));
    return {
      panel: { top: panelRect.top, bottom: panelRect.bottom, left: panelRect.left, right: panelRect.right },
      move: { top: moveRect.top, bottom: moveRect.bottom, left: moveRect.left, right: moveRect.right },
      inspectorScrollTop: element.scrollTop,
      scrollableDetails,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      pageScroll: { x: window.scrollX, y: window.scrollY },
    };
  });

  expect(measurement.viewport).toEqual(viewport);
  expect(measurement.scrollableDetails).toBe(true);
  expect(measurement.inspectorScrollTop).toBe(0);
  expect(measurement.pageScroll).toEqual(pageScrollBeforeSelection);
  expect(measurement.move.top).toBeGreaterThanOrEqual(Math.max(0, measurement.panel.top));
  expect(measurement.move.bottom).toBeLessThanOrEqual(Math.min(viewport.height, measurement.panel.bottom));
  expect(measurement.move.left).toBeGreaterThanOrEqual(Math.max(0, measurement.panel.left));
  expect(measurement.move.right).toBeLessThanOrEqual(Math.min(viewport.width, measurement.panel.right));
});

test('inspector capacity rejection keeps focus on Move and announces the result', async ({ page }) => {
  const fixture = createFullScratchPadSave();
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), { key: autoSaveKey, value: fixture.encodedSave });
  await page.goto('/');

  await page.getByTestId('world-jump').selectOption('scratchpad:scratch-a');
  const item = page.getByTestId(`lab-item-${fixture.movingItemId}`);
  await item.click();
  await page.getByTestId('move-target').selectOption('scratch-a');
  const moveButton = page.getByTestId('move-item');
  await moveButton.click();

  await expect(page.getByTestId('scratch-scratch-a')).toHaveAttribute('aria-label', /24 objects here/i);
  await expect(page.getByTestId('item-inspector')).toBeVisible();
  await expect(page.locator('.inspector-meta strong')).toHaveText(/Loose in the laboratory/i);
  await expect(moveButton).toBeFocused();
  await expect(page.getByTestId('game-feedback')).toHaveRole('status');
  await expect(page.getByTestId('game-feedback')).toHaveAttribute('aria-live', 'polite');
  await expect(page.getByTestId('game-feedback')).toContainText(/full|capacity|slot/i);
});

test('keyboard panning and zoom controls visibly update the laboratory view', async ({ page }) => {
  await page.goto('/');

  const world = page.getByTestId('world-viewport');
  const scene = page.locator('.world-scene');
  const originalTransform = await scene.evaluate((element) => element.style.transform);
  await world.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => scene.evaluate((element) => element.style.transform)).not.toBe(originalTransform);

  const zoom = page.locator('.zoom-readout');
  const originalZoom = await zoom.innerText();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(zoom).not.toHaveText(originalZoom);
});

test('valid import restores the exported laboratory state', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('open-saves').click();
  const originalExport = await page.getByTestId('save-export-string').inputValue();
  await page.getByRole('button', { name: 'Close save dialog' }).click();

  await moveWithInspector(page, calibrationCard, 'cabinet-calibration');
  await waitForAutosave(page);
  await expect(page.getByTestId('destination-cabinet-calibration')).toHaveAttribute('aria-label', /1 of 8 objects placed/i);

  await page.getByTestId('open-saves').click();
  await page.getByTestId('save-import-string').fill(originalExport);
  await page.getByRole('checkbox', { name: /valid import replaces the current laboratory/i }).check();
  await page.getByRole('button', { name: 'Validate & import save' }).click();

  await expect(page.getByTestId('save-feedback')).toContainText(/save imported/i);
  await expect(page.getByTestId('destination-cabinet-calibration')).toHaveAttribute('aria-label', /0 of 8 objects placed/i);
  const exportAfterImport = decodeSave(await page.getByTestId('save-export-string').inputValue());
  expect(exportAfterImport.items.find((item) => item.id === calibrationCard).placement)
    .toMatchObject({ kind: 'workspace' });
  await waitForAutosave(page);
});

test('Save & Restore exports the latest state when opened during the autosave debounce', async ({ page }) => {
  await page.goto('/');
  await waitForAutosave(page);

  await moveWithInspector(page, calibrationCard, 'cabinet-calibration');
  await expect(page.getByTestId('destination-cabinet-calibration')).toHaveAttribute('aria-label', /1 of 8 objects placed/i);
  await page.getByTestId('open-saves').click();

  const exportedState = decodeSave(await page.getByTestId('save-export-string').inputValue());
  const exportedCard = exportedState.items.find((item) => item.id === calibrationCard);
  expect(exportedCard.placement).toMatchObject({ kind: 'destination', destinationId: 'cabinet-calibration' });
  expect(exportedCard.validation).toBe('correct');
});

test('rejected import leaves both current progress and autosave unchanged', async ({ page }) => {
  const existingBackup = encodeSave({
    version: 3,
    worldSeed: 'palimpsest-first-shift',
    items: generateLab('palimpsest-first-shift', 174),
    progress: { skillPoints: 0, completedCollectionIds: [], unlockedPuzzleIds: [], solvedPuzzleIds: [], ownedSkills: [] },
    camera: { panX: -612, panY: -180, scale: 0.76 },
    inventionStage: 'Dormant',
    notebook: { discoveries: [] },
  });
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: backupKey,
    value: existingBackup,
  });

  await page.goto('/');
  await waitForAutosave(page);

  await page.getByTestId('open-saves').click();
  const currentExport = await page.getByTestId('save-export-string').inputValue();
  const invalidState = decodeSave(currentExport);
  invalidState.items[0].placement = { kind: 'destination', destinationId: 'destination-does-not-exist' };
  const invalidButDecodableSave = encodeSave(invalidState);
  const beforeAutosave = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  const beforeBackup = await page.evaluate((key) => window.localStorage.getItem(key), backupKey);
  expect(beforeAutosave).not.toBeNull();
  expect(beforeBackup).toBe(existingBackup);

  await page.getByTestId('save-import-string').fill(invalidButDecodableSave);
  await page.getByRole('checkbox', { name: /valid import replaces the current laboratory/i }).check();
  await page.getByRole('button', { name: 'Validate & import save' }).click();

  await expect(page.getByTestId('save-feedback')).toContainText(/destination|invalid|unknown|unchanged/i);
  await expect(page.getByTestId('destination-cabinet-calibration')).toHaveAttribute('aria-label', /0 of 8 objects placed/i);
  const afterAutosave = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  const afterBackup = await page.evaluate((key) => window.localStorage.getItem(key), backupKey);
  expect(afterAutosave).toBe(beforeAutosave);
  expect(afterBackup).toBe(beforeBackup);
});

test('v1 import migrates before backup, autosave, and reload', async ({ page }) => {
  const legacyItems = generateLab('palimpsest-first-shift', 150);
  const filedItem = legacyItems[0];
  filedItem.position = { x: 700, y: 300 };
  filedItem.previousWorkspacePosition = { x: 980, y: 520 };
  filedItem.placement = { kind: 'destination', destinationId: 'cabinet-calibration' };
  const rotatedScratchItem = legacyItems.find((item) => item.id !== filedItem.id && item.rotation !== 0);
  const trustedWorkspaceRotation = rotatedScratchItem.rotation;
  rotatedScratchItem.previousWorkspacePosition = { ...rotatedScratchItem.position };
  rotatedScratchItem.placement = { kind: 'scratchpad', scratchPadId: 'scratch-a' };
  const legacySave = compressV1Save(createV1State(legacyItems, { skillPoints: 3 }));

  await page.goto('/');
  await waitForAutosave(page);
  const originalAutosave = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  expect(originalAutosave).not.toBeNull();

  await page.getByTestId('open-saves').click();
  await page.getByTestId('save-import-string').fill(legacySave);
  await page.getByRole('checkbox', { name: /valid import replaces the current laboratory/i }).check();
  await page.getByRole('button', { name: 'Validate & import save' }).click();

  await expect(page.getByTestId('save-feedback')).toContainText(/restored|import|migrat/i);
  await expect(page.getByTestId('destination-cabinet-calibration')).toHaveAttribute('aria-label', /1 of 8 objects placed/i);
  await expect(page.getByTestId('skill-points')).toContainText(/Skill points: 3/i);
  await waitForAutosave(page);

  const migratedRaw = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  const migrationBackup = await page.evaluate((key) => window.localStorage.getItem(key), backupKey);
  const migratedSave = decodeSave(migratedRaw);
  const migratedItem = migratedSave.items.find((item) => item.id === filedItem.id);
  expect(migrationBackup).toBe(originalAutosave, 'the backup should capture the current state before applying the migrated import');
  expect(migratedSave.version).toBe(3);
  expect(migratedSave.items).toHaveLength(174);
  expect(migratedSave.progress.skillPoints).toBe(3);
  expect(migratedItem.placement.destinationId).toBe('cabinet-calibration');
  expect(Number.isInteger(migratedItem.placement.slotIndex)).toBe(true);
  expect(migratedItem.rotation).toBe(0);
  const migratedScratchItem = migratedSave.items.find((item) => item.id === rotatedScratchItem.id);
  expect(migratedScratchItem.placement.scratchPadId).toBe('scratch-a');
  expect(Number.isInteger(migratedScratchItem.placement.slotIndex)).toBe(true);
  expect(migratedScratchItem.rotation).toBe(0);

  await page.reload();
  await waitForAutosave(page);
  await expect(page.getByTestId('world-item-count')).toContainText('174');
  await expect(page.getByTestId('destination-cabinet-calibration')).toHaveAttribute('aria-label', /1 of 8 objects placed/i);
  await expect(page.getByTestId('skill-points')).toContainText(/Skill points: 3/i);
  const reloadedSave = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  const reloadedItem = reloadedSave.items.find((item) => item.id === filedItem.id);
  expect(reloadedSave.version).toBe(3);
  expect(reloadedItem.placement).toEqual(migratedItem.placement);
  expect(reloadedItem.position).toEqual(migratedItem.position);
  expect(reloadedSave.items.find((item) => item.id === rotatedScratchItem.id).placement).toEqual(migratedScratchItem.placement);

  await page.getByTestId('world-jump').selectOption('scratchpad:scratch-a');
  const rotatedItemControl = page.getByTestId(`lab-item-${rotatedScratchItem.id}`);
  await expect(rotatedItemControl).toBeVisible();
  await expect.poll(() => rotatedItemControl.evaluate((element) => element.style.transform)).toBe('rotate(0deg)');
  await rotatedItemControl.click();
  await page.getByTestId('move-target').selectOption('workspace');
  await page.getByTestId('move-item').click();
  await expect.poll(() => rotatedItemControl.evaluate((element) => element.style.transform)).toBe(`rotate(${trustedWorkspaceRotation}deg)`);
});

test('invalid v1 import leaves current autosave and backup unchanged', async ({ page }) => {
  await page.goto('/');
  await waitForAutosave(page);
  const originalAutosave = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  expect(originalAutosave).not.toBeNull();
  await page.evaluate(({ key, value }) => window.localStorage.setItem(key, value), { key: backupKey, value: originalAutosave });

  const invalidItems = generateLab('palimpsest-first-shift', 150);
  invalidItems[0].placement = { kind: 'destination', destinationId: 'unknown-destination' };
  const invalidLegacySave = compressV1Save(createV1State(invalidItems, { skillPoints: 7 }));
  const originalBackup = await page.evaluate((key) => window.localStorage.getItem(key), backupKey);

  await page.getByTestId('open-saves').click();
  await page.getByTestId('save-import-string').fill(invalidLegacySave);
  await page.getByRole('checkbox', { name: /valid import replaces the current laboratory/i }).check();
  await page.getByRole('button', { name: 'Validate & import save' }).click();

  await expect(page.getByTestId('save-feedback')).toContainText(/unknown|destination|invalid/i);
  expect(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey)).toBe(originalAutosave);
  expect(await page.evaluate((key) => window.localStorage.getItem(key), backupKey)).toBe(originalBackup);
  await expect(page.getByTestId('skill-points')).toContainText(/Skill points: 0/i);
});

test('v3 import with a valid target but mismatched slot position leaves all current save data unchanged', async ({ page }) => {
  const baseline = await openSaveDialogWithDistinctBackup(page);
  const invalidState = structuredClone(baseline.beforeState);
  const item = invalidState.items[0];
  const target = { kind: 'destination', id: 'cabinet-calibration' };
  item.position = getTargetSlotPosition({ target, item, slotIndex: 1, destinations: DESTINATIONS, scratchPads: SCRATCH_PADS });
  item.placement = { kind: 'destination', destinationId: target.id, slotIndex: 0 };

  await expectV3ImportRejectedWithoutChanges(page, baseline, invalidState, /position|slot|invalid/i);
});

test('v3 import with a valid target but missing slot index leaves all current save data unchanged', async ({ page }) => {
  const baseline = await openSaveDialogWithDistinctBackup(page);
  const invalidState = structuredClone(baseline.beforeState);
  const item = invalidState.items[0];
  const target = { kind: 'scratchpad', id: 'scratch-a' };
  item.position = getTargetSlotPosition({ target, item, slotIndex: 0, destinations: DESTINATIONS, scratchPads: SCRATCH_PADS });
  item.placement = { kind: 'scratchpad', scratchPadId: target.id };

  await expectV3ImportRejectedWithoutChanges(page, baseline, invalidState, /slot|invalid/i);
});

test('a corrupt startup autosave is preserved until the player explicitly starts a fresh laboratory', async ({ page }) => {
  const corruptRaw = 'do-not-overwrite-this-corrupt-autosave';
  await page.addInitScript((payload) => {
    window.localStorage.clear();
    window.localStorage.setItem('palimpsest-laboratory.autosave.v1', payload);
  }, corruptRaw);

  await page.goto('/');
  await expect(page.getByTestId('world-item-count')).toContainText('174');
  await expect(page.getByTestId('autosave-status')).toHaveText('Recovery needed');
  await expect(page.getByTestId('recovery-notice')).toHaveAttribute('role', 'alert');
  await expect(page.getByTestId('start-fresh-lab')).toHaveAccessibleName('Start fresh laboratory');

  const savedStrings = await page.evaluate(() => Object.entries(window.localStorage));
  expect(savedStrings.find(([key]) => key === autoSaveKey)?.[1]).toBe(corruptRaw);
  expect(savedStrings.some(([key, value]) => key.toLowerCase().includes('recovery') && value === corruptRaw)).toBe(true);

  await page.getByTestId('start-fresh-lab').click();
  await waitForAutosave(page);
  const replacedAutosave = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  expect(replacedAutosave).not.toBe(corruptRaw);
});
