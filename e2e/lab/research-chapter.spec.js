import { expect, test } from '@playwright/test';
import { observeAudioEvents, readAudioEventTypes } from '../helpers/audioEvents.js';
import { generateLab, generateLegacyLab } from '../../src/game/content/generateLab.js';
import { COLLECTIONS, DESTINATIONS, PUZZLES, SCRATCH_PADS, WORLD_BOUNDS } from '../../src/game/content/catalog.js';
import { createNewGameState, normalizeGameState } from '../../src/game/persistence/gameState.js';
import { decodeSave, encodeSave } from '../../src/game/persistence/save.js';
import { getTargetSlotPosition } from '../../src/game/world/placementLayout.js';
import LZString from 'lz-string';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const recoveryKey = 'palimpsest-laboratory.recovery.v1';
const backupKey = 'palimpsest-laboratory.backup.v1';
const seed = 'palimpsest-first-shift';
const testViewport = { width: 1280, height: 720 };

function cameraCenteredOnInvention() {
  const scale = 0.5;
  const centerX = WORLD_BOUNDS.x + WORLD_BOUNDS.width / 2;
  const centerY = WORLD_BOUNDS.y + WORLD_BOUNDS.height / 2;
  return {
    panX: testViewport.width / 2 - centerX * scale,
    panY: (testViewport.height - 68) / 2 - centerY * scale,
    scale,
  };
}

function cameraWithEnginePartiallyBeyondRightEdge() {
  const scale = 2.5;
  const centerX = WORLD_BOUNDS.x + WORLD_BOUNDS.width / 2;
  const centerY = WORLD_BOUNDS.y + WORLD_BOUNDS.height / 2;
  const rightWorld = centerX - 130;
  return {
    panX: testViewport.width - rightWorld * scale,
    panY: (testViewport.height - 68) / 2 - centerY * scale,
    scale,
  };
}

function createV2MigrationFixture({ camera = { panX: -450, panY: -160, scale: 0.62 } } = {}) {
  const items = generateLegacyLab(seed, 150).map((item) => structuredClone(item));
  const calibrationItem = items.find((item) => item.id === 'calibration-card-01');
  const target = { kind: 'destination', id: 'cabinet-calibration' };
  calibrationItem.position = getTargetSlotPosition({
    target,
    item: calibrationItem,
    slotIndex: 0,
    destinations: DESTINATIONS,
    scratchPads: SCRATCH_PADS,
  });
  calibrationItem.previousWorkspacePosition = { x: 1180, y: 880 };
  calibrationItem.placement = { kind: 'destination', destinationId: target.id, slotIndex: 0 };
  calibrationItem.rotation = 0;
  calibrationItem.validation = 'correct';

  const state = {
    version: 2,
    contentSeed: seed,
    items,
    progress: { skillPoints: 1, completedCollectionIds: [], unlockedPuzzleIds: [], solvedPuzzleIds: [], ownedSkills: [] },
    camera,
    inventionStage: 'Memory Crystal',
    notebook: { discoveries: ['memory-impression-01'] },
  };
  return {
    state,
    oldCalibrationItem: structuredClone(calibrationItem),
    raw: LZString.compressToEncodedURIComponent(JSON.stringify(state)),
  };
}

async function focusDestination(page, destinationId) {
  await page.getByTestId('world-jump').selectOption(`destination:${destinationId}`);
}

async function fileCollection(page, collection) {
  await focusDestination(page, collection.destinationId);
  for (const itemId of collection.itemIds) {
    await page.getByTestId(`lab-item-${itemId}`).click();
    await page.getByRole('combobox', { name: /move to destination or work surface/i }).selectOption(collection.destinationId);
    await page.getByRole('button', { name: 'Move item', exact: true }).click();
    await expect(page.getByTestId(`lab-item-${itemId}`)).toHaveClass(/success-pulse/);
  }
}

test('a fresh laboratory presents the Palimpsest Engine as a dormant, accessible instrument', async ({ page }) => {
  await page.setViewportSize(testViewport);
  const freshState = createNewGameState();
  freshState.camera = cameraCenteredOnInvention();
  await page.addInitScript(({ key, raw }) => window.localStorage.setItem(key, raw), {
    key: autoSaveKey,
    raw: encodeSave(freshState),
  });
  await page.goto('/');

  const engine = page.locator('.invention-core');
  await expect(engine).toBeVisible();
  await expect(engine).toHaveAttribute('aria-label', 'The Palimpsest Engine');
  await expect(engine).toHaveClass(/invention-core--dormant/);
  await expect(engine.locator('.engine-stage')).toHaveText('Dormant');
  await expect(engine.locator('.engine-crystal')).toHaveCount(0);
  await expect(engine.locator('.engine-wheel')).toHaveCount(0);
});

test('the Palimpsest Engine remains mounted when only its left side overlaps the viewport', async ({ page }) => {
  await page.setViewportSize(testViewport);
  const freshState = createNewGameState();
  freshState.camera = cameraWithEnginePartiallyBeyondRightEdge();
  const validFreshState = normalizeGameState(freshState);
  await page.addInitScript(({ key, raw }) => window.localStorage.setItem(key, raw), {
    key: autoSaveKey,
    raw: encodeSave(validFreshState),
  });
  await page.goto('/');

  const viewport = page.getByTestId('world-viewport');
  const engine = page.locator('.invention-core');
  await expect(viewport).toBeVisible();
  await expect(engine).toBeVisible();
  const viewportBox = await viewport.boundingBox();
  const engineBox = await engine.boundingBox();
  expect(viewportBox).not.toBeNull();
  expect(engineBox).not.toBeNull();
  const viewportRight = viewportBox.x + viewportBox.width;
  const viewportBottom = viewportBox.y + viewportBox.height;
  expect(engineBox.x).toBeLessThan(viewportRight);
  expect(engineBox.x + engineBox.width / 2).toBeGreaterThan(viewportRight);
  expect(engineBox.x + engineBox.width).toBeGreaterThan(viewportRight);
  expect(engineBox.y).toBeLessThan(viewportBottom);
  expect(engineBox.y + engineBox.height).toBeGreaterThan(viewportBox.y);
});

test('jumping to the Palimpsest Engine frames it at full size on desktop', async ({ page }) => {
  await page.setViewportSize(testViewport);
  await page.goto('/');

  await page.getByTestId('world-jump').selectOption('engine');
  await expect(page.locator('.zoom-readout')).toHaveText('100%');

  const viewport = page.getByTestId('world-viewport');
  const engine = page.locator('.invention-core');
  await expect(engine).toBeVisible();
  const viewportBox = await viewport.boundingBox();
  const engineBox = await engine.boundingBox();
  expect(viewportBox).not.toBeNull();
  expect(engineBox).not.toBeNull();
  expect(engineBox.x).toBeGreaterThanOrEqual(viewportBox.x);
  expect(engineBox.x + engineBox.width).toBeLessThanOrEqual(viewportBox.x + viewportBox.width);
  expect(engineBox.y).toBeGreaterThanOrEqual(viewportBox.y);
  expect(engineBox.y + engineBox.height).toBeLessThanOrEqual(viewportBox.y + viewportBox.height);
  expect(Math.abs((engineBox.x + engineBox.width / 2) - (viewportBox.x + viewportBox.width / 2))).toBeLessThanOrEqual(1);
  expect(Math.abs((engineBox.y + engineBox.height / 2) - (viewportBox.y + viewportBox.height / 2))).toBeLessThanOrEqual(1);
});

test('jumping to the Palimpsest Engine fits it inside a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 480 });
  await page.goto('/');

  await page.getByTestId('world-jump').selectOption('engine');
  const zoomReadout = page.locator('.zoom-readout');
  await expect.poll(async () => Number.parseInt(await zoomReadout.innerText(), 10)).toBeGreaterThan(70);
  await expect.poll(async () => Number.parseInt(await zoomReadout.innerText(), 10)).toBeLessThan(100);

  const viewport = page.getByTestId('world-viewport');
  const engine = page.locator('.invention-core');
  await expect(engine).toBeVisible();
  const viewportBox = await viewport.boundingBox();
  const engineBox = await engine.boundingBox();
  expect(viewportBox).not.toBeNull();
  expect(engineBox).not.toBeNull();
  expect(engineBox.x).toBeGreaterThanOrEqual(viewportBox.x);
  expect(engineBox.x + engineBox.width).toBeLessThanOrEqual(viewportBox.x + viewportBox.width);
  expect(engineBox.y).toBeGreaterThanOrEqual(viewportBox.y);
  expect(engineBox.y + engineBox.height).toBeLessThanOrEqual(viewportBox.y + viewportBox.height);
  expect(Math.abs((engineBox.x + engineBox.width / 2) - (viewportBox.x + viewportBox.width / 2))).toBeLessThanOrEqual(1);
  expect(Math.abs((engineBox.y + engineBox.height / 2) - (viewportBox.y + viewportBox.height / 2))).toBeLessThanOrEqual(1);
});

test('the Chronology Wheel stage presents its crystal assembly with reduced motion', async ({ page }) => {
  await page.setViewportSize(testViewport);
  const chronologyState = createNewGameState();
  chronologyState.camera = cameraCenteredOnInvention();
  chronologyState.inventionStage = 'Chronology Wheel';
  const validChronologyState = normalizeGameState(chronologyState);
  await page.addInitScript(({ key, raw }) => window.localStorage.setItem(key, raw), {
    key: autoSaveKey,
    raw: encodeSave(validChronologyState),
  });
  await page.goto('/');

  await expect(page.getByTestId('invention-stage')).toContainText('Chronology Wheel');
  const engine = page.locator('.invention-core');
  await expect(engine).toBeVisible();
  await expect(engine).toHaveAttribute('aria-label', 'The Palimpsest Engine');
  await expect(engine).toHaveClass(/invention-core--chronology-wheel/);
  await expect(engine.locator('.engine-stage')).toHaveText('Chronology Wheel');
  await expect(engine.locator('.engine-crystal')).toBeVisible();

  const chronologyWheel = engine.locator('.engine-wheel');
  await expect(chronologyWheel).toBeVisible();
  await expect(chronologyWheel).toHaveAttribute('aria-hidden', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => chronologyWheel.evaluate((wheel) => {
    const duration = getComputedStyle(wheel).animationDuration;
    const value = Number.parseFloat(duration);
    return duration.endsWith('ms') ? value : value * 1000;
  })).toBeLessThanOrEqual(0.01);
});

test('v2 migration preserves the old placement and the chapter gate, compass, and chronology can be completed', async ({ page }) => {
  await page.setViewportSize(testViewport);
  const migratedFixture = createV2MigrationFixture({ camera: cameraCenteredOnInvention() });
  await page.addInitScript(({ key, raw }) => {
    if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, raw);
  }, {
    key: autoSaveKey,
    raw: migratedFixture.raw,
  });
  await page.goto('/');
  await observeAudioEvents(page);

  const engine = page.locator('.invention-core');
  await expect(engine).toBeVisible();
  await expect(engine).toHaveAttribute('aria-label', 'The Palimpsest Engine');
  await expect(engine).toHaveClass(/invention-core--memory-crystal/);
  await expect(engine.locator('.engine-stage')).toHaveText('Memory Crystal');
  await expect(engine.locator('.engine-crystal')).toBeVisible();
  await expect(engine.locator('.engine-wheel')).toHaveCount(0);

  await expect(page.getByTestId('world-item-count')).toContainText('174');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
  expect(await page.evaluate((key) => window.localStorage.getItem(key), recoveryKey)).toBe(migratedFixture.raw);
  const autosaveAfterMigration = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(autosaveAfterMigration.version).toBe(3);
  expect(autosaveAfterMigration.items.find((item) => item.id === migratedFixture.oldCalibrationItem.id)).toMatchObject({
    position: migratedFixture.oldCalibrationItem.position,
    placement: migratedFixture.oldCalibrationItem.placement,
    rotation: migratedFixture.oldCalibrationItem.rotation,
  });
  expect(autosaveAfterMigration.progress).toMatchObject(migratedFixture.state.progress);
  expect(autosaveAfterMigration.camera).toEqual(migratedFixture.state.camera);

  const expanded = generateLab(seed, 174);
  const chapterCollections = COLLECTIONS.filter((collection) => new Set(expanded.slice(150).map((item) => item.collectionId)).has(collection.id));
  expect(chapterCollections).toHaveLength(3);
  const chronologyPuzzle = PUZZLES.find((puzzle) => /chronolog/i.test(puzzle.id) || /chronolog/i.test(puzzle.title));
  expect(chronologyPuzzle).toBeTruthy();
  await expect(page.getByTestId('chapter-progress')).toContainText('0 of 3');
  await expect(page.getByTestId('chronology-puzzle-panel')).toHaveCount(0);

  await fileCollection(page, chapterCollections[0]);
  await fileCollection(page, chapterCollections[1]);
  await expect(page.getByTestId('chapter-progress')).toContainText('2 of 3');
  await expect(page.getByTestId('chronology-puzzle-panel')).toHaveCount(0);

  const incompleteCollection = chapterCollections[2];
  const selectedItemId = incompleteCollection.itemIds[0];
  await focusDestination(page, incompleteCollection.destinationId);
  await page.getByTestId(`lab-item-${selectedItemId}`).click();
  await page.getByTestId('toggle-skills').click();
  await page.getByTestId('purchase-missing-member-compass').click();
  await expect(page.getByTestId('skill-points')).toContainText('Skill points: 2');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
  const beforeCompass = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  await page.getByTestId('toggle-missing-member-compass').click();

  const relatedSiblingIds = incompleteCollection.itemIds.filter((itemId) => itemId !== selectedItemId);
  await expect.poll(async () => {
    let count = 0;
    for (const itemId of relatedSiblingIds) {
      const item = page.getByTestId(`lab-item-${itemId}`);
      if (await item.count() && await item.evaluate((element) => element.classList.contains('is-related'))) count += 1;
    }
    return count;
  }).toBe(1);
  const afterCompass = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(afterCompass.items).toEqual(beforeCompass.items, 'the compass must not move, file, or validate any item');

  await fileCollection(page, incompleteCollection);
  await expect(page.getByTestId('chapter-progress')).toContainText('3 of 3');
  await expect(page.getByTestId('chronology-puzzle-panel')).toBeVisible();

  const puzzle = page.getByTestId('chronology-puzzle-panel');
  await expect(puzzle.getByTestId(`chronology-event-${chronologyPuzzle.solution[0]}`))
    .toHaveAccessibleDescription(/Trial 03 holds an image on 12 October/i);
  for (const eventId of chronologyPuzzle.solution) {
    await puzzle.getByTestId(`chronology-event-${eventId}`).click();
  }
  const audioEventsBeforeChronologySolve = await readAudioEventTypes(page);
  await puzzle.getByRole('button', { name: /submit chronology/i }).click();
  await expect.poll(() => readAudioEventTypes(page)).toContain('puzzle.completed');
  await expect.poll(() => readAudioEventTypes(page)).toContain('machinery.stage.changed');
  await expect.poll(() => readAudioEventTypes(page)).toContain('invention.assembled');
  expect((await readAudioEventTypes(page)).slice(audioEventsBeforeChronologySolve.length)).toEqual([
    'puzzle.completed',
    'machinery.stage.changed',
    'invention.assembled',
  ]);
  await expect(page.getByTestId('invention-stage')).toContainText('Chronology Wheel');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
  const solvedSave = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(solvedSave.version).toBe(3);
  expect(solvedSave.progress.solvedPuzzleIds).toContain(chronologyPuzzle.id);
  expect(solvedSave.notebook.discoveries).toContain('discovery-chronology-last-bell');
  expect(solvedSave.progress.ownedSkills).toContain('missing-member-compass');
  for (const collection of chapterCollections) {
    expect(solvedSave.progress.completedCollectionIds).toContain(collection.id);
    for (const itemId of collection.itemIds) {
      expect(solvedSave.items.find((item) => item.id === itemId)).toMatchObject({
        validation: 'correct',
        placement: { kind: 'destination', destinationId: collection.destinationId },
      });
    }
  }
  expect(solvedSave.items.find((item) => item.id === migratedFixture.oldCalibrationItem.id)).toMatchObject({
    position: migratedFixture.oldCalibrationItem.position,
    placement: migratedFixture.oldCalibrationItem.placement,
    rotation: migratedFixture.oldCalibrationItem.rotation,
  });

  await page.reload();
  await expect(page.getByTestId('world-item-count')).toContainText('174');
  await expect(page.getByTestId('chapter-progress')).toContainText('3 of 3');
  await expect(page.getByTestId('invention-stage')).toContainText('Chronology Wheel');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');

  const restoredSave = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(restoredSave.version).toBe(3);
  expect(restoredSave.items).toEqual(solvedSave.items);
  expect(restoredSave.progress).toEqual(solvedSave.progress);
  expect(restoredSave.notebook).toEqual(solvedSave.notebook);
  expect(restoredSave.camera).toEqual(solvedSave.camera);
  expect(restoredSave.inventionStage).toBe('Chronology Wheel');
  expect(restoredSave.progress.solvedPuzzleIds).toContain(chronologyPuzzle.id);
  expect(restoredSave.notebook.discoveries).toContain('discovery-chronology-last-bell');

  await page.getByTestId('toggle-notebook').click();
  await expect(page.getByTestId('notebook-panel')).toContainText('The Last Bell');
});

test('a rejected chronology-gate import leaves the live export, autosave, and backup unchanged', async ({ page }) => {
  const backupSentinel = 'existing-backup-must-remain-unchanged';
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: backupKey,
    value: backupSentinel,
  });
  await page.goto('/');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');

  const autosaveBefore = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  const backupBefore = await page.evaluate((key) => window.localStorage.getItem(key), backupKey);
  const invalidV3 = decodeSave(autosaveBefore);
  invalidV3.progress.unlockedPuzzleIds = ['chronology-last-bell'];
  const invalidImport = LZString.compressToEncodedURIComponent(JSON.stringify(invalidV3));

  await page.getByTestId('open-saves').click();
  const exportField = page.getByTestId('save-export-string');
  const exportBefore = await exportField.inputValue();
  await page.getByTestId('save-import-string').fill(invalidImport);
  await page.getByRole('checkbox').check();
  await page.getByTestId('import-save').click();

  await expect(page.getByTestId('save-feedback')).toContainText(/chronology puzzle progress|collection prerequisites/i);
  expect(await exportField.inputValue()).toBe(exportBefore);
  expect(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey)).toBe(autosaveBefore);
  expect(await page.evaluate((key) => window.localStorage.getItem(key), backupKey)).toBe(backupBefore);
});
