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

function cameraCenteredOnInvention(scale = 0.5) {
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

function boxesOverlap(first, second) {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y;
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

function createSevenOfEightCollectionState(collection) {
  const state = createNewGameState();
  const destination = DESTINATIONS.find((entry) => entry.id === collection.destinationId);
  for (const [slotIndex, itemId] of collection.itemIds.slice(0, -1).entries()) {
    const item = state.items.find((entry) => entry.id === itemId);
    if (!item || !destination) throw new Error(`Could not seed collection ${collection.id}`);
    item.position = getTargetSlotPosition({
      target: { kind: 'destination', id: destination.id },
      item,
      slotIndex,
      destinations: DESTINATIONS,
      scratchPads: SCRATCH_PADS,
    });
    item.placement = { kind: 'destination', destinationId: destination.id, slotIndex };
    item.rotation = 0;
    item.validation = 'correct';
  }
  return state;
}

async function openAlmostCompleteCollectionAndFileLastItem(page, collection, state) {
  await page.addInitScript(({ key, raw }) => window.localStorage.setItem(key, raw), {
    key: autoSaveKey,
    raw: encodeSave(state),
  });
  await page.goto('/');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
  await page.getByTestId('world-jump').selectOption(`collection:${collection.id}`);

  const finalItem = page.getByTestId(`lab-item-${collection.itemIds.at(-1)}`);
  await expect(finalItem).toBeVisible();
  await finalItem.focus();
  await finalItem.press('Enter');
  await expect(page.getByTestId('item-inspector')).toBeVisible();

  await page.getByTestId('move-target').selectOption(collection.destinationId);
  const moveButton = page.getByTestId('move-item');
  await moveButton.focus();
  await moveButton.press('Enter');
  return moveButton;
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

test('the Engine overview keeps its title and stage readable at 50% zoom', async ({ page }) => {
  await page.setViewportSize(testViewport);
  const chronologyState = createNewGameState();
  chronologyState.camera = cameraCenteredOnInvention(0.5);
  chronologyState.inventionStage = 'Chronology Wheel';
  const normalizedState = normalizeGameState(chronologyState);
  await page.addInitScript(({ key, raw }) => window.localStorage.setItem(key, raw), {
    key: autoSaveKey,
    raw: encodeSave(normalizedState),
  });
  await page.goto('/');

  await expect(page.locator('.zoom-readout')).toHaveText('50%');
  const engine = page.locator('.invention-core');
  const title = engine.locator('.engine-label strong');
  const synopsis = engine.locator('.engine-label span');
  const stage = engine.locator('.engine-stage');
  const artwork = engine.locator('.engine-rings');
  await expect(engine).toHaveAttribute('aria-label', 'The Palimpsest Engine');
  await expect(stage).toHaveText('Chronology Wheel');

  const screenTextSizes = await page.evaluate(() => {
    const inverseScale = Number.parseFloat(getComputedStyle(document.querySelector('.world-scene')).getPropertyValue('--inverse-camera-scale'));
    const getScreenFontSize = (selector) => Number.parseFloat(getComputedStyle(document.querySelector(selector)).fontSize) / inverseScale;
    return {
      title: getScreenFontSize('.engine-label strong'),
      stage: getScreenFontSize('.engine-stage'),
    };
  });
  expect(screenTextSizes.title).toBeGreaterThanOrEqual(11);
  expect(screenTextSizes.stage).toBeGreaterThanOrEqual(9);
  await expect(engine).toHaveAccessibleDescription(/The chronology wheel can now reconcile the Engine/i);

  const [engineBox, titleBox, stageBox, artworkBox, synopsisBox] = await Promise.all([
    engine.boundingBox(),
    title.boundingBox(),
    stage.boundingBox(),
    artwork.boundingBox(),
    synopsis.boundingBox(),
  ]);
  expect(engineBox).not.toBeNull();
  expect(titleBox).not.toBeNull();
  expect(stageBox).not.toBeNull();
  expect(artworkBox).not.toBeNull();
  expect(synopsisBox).not.toBeNull();
  expect(titleBox.x).toBeGreaterThanOrEqual(engineBox.x);
  expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(engineBox.x + engineBox.width);
  expect(titleBox.y).toBeGreaterThanOrEqual(engineBox.y);
  expect(stageBox.x).toBeGreaterThanOrEqual(engineBox.x);
  expect(stageBox.x + stageBox.width).toBeLessThanOrEqual(engineBox.x + engineBox.width);
  expect(stageBox.y + stageBox.height).toBeLessThanOrEqual(engineBox.y + engineBox.height);
  expect(boxesOverlap(titleBox, artworkBox)).toBe(false);
  expect(boxesOverlap(stageBox, artworkBox)).toBe(false);
  expect(boxesOverlap(titleBox, stageBox)).toBe(false);
  expect(synopsisBox.width).toBeLessThanOrEqual(1);
  expect(synopsisBox.height).toBeLessThanOrEqual(1);
});

test('the Engine restores its complete descriptive layout at 100% zoom', async ({ page }) => {
  await page.setViewportSize(testViewport);
  const chronologyState = createNewGameState();
  chronologyState.camera = cameraCenteredOnInvention(1);
  chronologyState.inventionStage = 'Chronology Wheel';
  const normalizedState = normalizeGameState(chronologyState);
  await page.addInitScript(({ key, raw }) => window.localStorage.setItem(key, raw), {
    key: autoSaveKey,
    raw: encodeSave(normalizedState),
  });
  await page.goto('/');

  await expect(page.locator('.zoom-readout')).toHaveText('100%');
  const engine = page.locator('.invention-core');
  const title = engine.locator('.engine-label strong');
  const synopsis = engine.locator('.engine-label span');
  const stage = engine.locator('.engine-stage');
  const artwork = engine.locator('.engine-rings');
  await expect(engine).toHaveAccessibleDescription(/The chronology wheel can now reconcile the Engine/i);
  await expect(synopsis).toBeVisible();
  await expect(stage).toHaveText('Chronology Wheel');

  const screenTextSizes = await page.evaluate(() => ({
    title: Number.parseFloat(getComputedStyle(document.querySelector('.engine-label strong')).fontSize),
    stage: Number.parseFloat(getComputedStyle(document.querySelector('.engine-stage')).fontSize),
  }));
  expect(screenTextSizes.title).toBeGreaterThanOrEqual(15);
  expect(screenTextSizes.stage).toBeGreaterThanOrEqual(10);

  const [engineBox, titleBox, stageBox, artworkBox] = await Promise.all([
    engine.boundingBox(),
    title.boundingBox(),
    stage.boundingBox(),
    artwork.boundingBox(),
  ]);
  expect(engineBox).not.toBeNull();
  expect(titleBox).not.toBeNull();
  expect(stageBox).not.toBeNull();
  expect(artworkBox).not.toBeNull();
  expect(titleBox.x).toBeGreaterThanOrEqual(engineBox.x);
  expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(engineBox.x + engineBox.width);
  expect(stageBox.x).toBeGreaterThanOrEqual(engineBox.x);
  expect(stageBox.x + stageBox.width).toBeLessThanOrEqual(engineBox.x + engineBox.width);
  expect(boxesOverlap(titleBox, artworkBox)).toBe(false);
  expect(boxesOverlap(stageBox, artworkBox)).toBe(false);
  expect(boxesOverlap(titleBox, stageBox)).toBe(false);
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

test('jumping to the Blueprint Cabinet keeps its full card inside a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 480 });
  await page.goto('/');

  await page.getByTestId('world-jump').selectOption('destination:cabinet-blueprints');

  const viewport = page.getByTestId('world-viewport');
  const cabinet = page.getByTestId('destination-cabinet-blueprints');
  await expect(cabinet).toBeVisible();
  const viewportBox = await viewport.boundingBox();
  const cabinetBox = await cabinet.boundingBox();
  expect(viewportBox).not.toBeNull();
  expect(cabinetBox).not.toBeNull();
  expect(cabinetBox.x).toBeGreaterThanOrEqual(viewportBox.x - 1);
  expect(cabinetBox.x + cabinetBox.width).toBeLessThanOrEqual(viewportBox.x + viewportBox.width + 1);
  expect(cabinetBox.y).toBeGreaterThanOrEqual(viewportBox.y - 1);
  expect(cabinetBox.y + cabinetBox.height).toBeLessThanOrEqual(viewportBox.y + viewportBox.height + 1);
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

test('compact keyboard completion returns focus after opening the notebook', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 480 });
  const collection = COLLECTIONS.find((entry) => entry.id === 'bell-before-dawn');
  const state = createSevenOfEightCollectionState(collection);
  const finalItemId = collection.itemIds.at(-1);

  await openAlmostCompleteCollectionAndFileLastItem(page, collection, state);

  await expect(page.getByTestId('notebook-panel')).toBeVisible();
  await expect(page.getByTestId('item-inspector')).toHaveCount(0);
  await expect(page.getByTestId(`collection-${collection.id}`)).toContainText('8 / 8 filed');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');

  const savedState = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(savedState.progress.completedCollectionIds).toContain(collection.id);
  expect(savedState.progress.unlockedPuzzleIds).not.toContain('chronology-last-bell');
  expect(savedState.items.find((item) => item.id === finalItemId)).toMatchObject({
    validation: 'correct',
    placement: { kind: 'destination', destinationId: collection.destinationId },
  });
  await expect(page.getByTestId('multi-selection-toggle')).toBeFocused();
});

test('desktop keyboard collection completion keeps the Inspector focused', async ({ page }) => {
  await page.setViewportSize(testViewport);
  const collection = COLLECTIONS.find((entry) => entry.id === 'bell-before-dawn');
  const state = createSevenOfEightCollectionState(collection);

  const moveButton = await openAlmostCompleteCollectionAndFileLastItem(page, collection, state);

  await expect(page.getByTestId('notebook-panel')).toBeVisible();
  await expect(page.getByTestId('item-inspector')).toBeVisible();
  await expect(moveButton).toBeFocused();
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

  const earnedCollection = chapterCollections[0];
  const withdrawnItemId = earnedCollection.itemIds[0];
  const cameraBeforeFocus = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey)).camera;
  await focusDestination(page, earnedCollection.destinationId);
  await expect.poll(async () => decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey)).camera)
    .not.toEqual(cameraBeforeFocus);
  const autosaveBeforeWithdrawal = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);

  await page.getByTestId(`lab-item-${withdrawnItemId}`).click();
  await page.getByTestId('move-target').selectOption('workspace');
  await page.getByTestId('move-item').click();

  const expectCurrentChapterStatus = async () => {
    await expect(page.getByTestId('chapter-progress')).toHaveText('Research collections: 2 of 3');
    await expect(page.getByTestId('skill-points'))
      .toHaveText(`3 collection rewards · Skill points: ${solvedSave.progress.skillPoints}`);
    await expect(page.getByTestId('invention-stage')).toContainText('Chronology Wheel');
    await expect(page.getByTestId('open-puzzle')).toContainText(/Chronology.*solved/i);

    await focusDestination(page, earnedCollection.destinationId);
    await expect(page.getByTestId(`destination-${earnedCollection.destinationId}`).locator('.destination-complete'))
      .toHaveCount(0);
    const notebookToggle = page.getByTestId('toggle-notebook');
    if (await notebookToggle.getAttribute('aria-pressed') !== 'true') await notebookToggle.click();
    const notebook = page.getByTestId('notebook-panel');
    const collectionRow = notebook.getByTestId(`collection-${earnedCollection.id}`);
    await expect(collectionRow).toContainText('7 / 8 filed');
    await expect(collectionRow).toContainText('Reward earned; refiling needed.');
    await expect(collectionRow).not.toHaveClass(/is-complete/);
    await expect(collectionRow).toHaveAccessibleName(/7 of 8 correctly placed\. Reward earned; refiling needed\./i);
    await expect(notebook.locator('.notebook-section').first().locator('.section-heading span')).toHaveText('2 restored');
  };

  await expectCurrentChapterStatus();
  await expect.poll(async () => {
    const raw = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
    try {
      return decodeSave(raw).items.find((item) => item.id === withdrawnItemId).placement.kind;
    } catch {
      return 'unreadable';
    }
  }).toBe('workspace');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');

  const withdrawnSave = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(withdrawnSave.progress.completedCollectionIds).toEqual(solvedSave.progress.completedCollectionIds);
  expect(withdrawnSave.progress.skillPoints).toBe(solvedSave.progress.skillPoints);
  expect(withdrawnSave.progress.unlockedPuzzleIds).toContain(chronologyPuzzle.id);
  expect(withdrawnSave.progress.solvedPuzzleIds).toContain(chronologyPuzzle.id);
  expect(withdrawnSave.items.find((item) => item.id === withdrawnItemId)).toMatchObject({
    validation: 'unchecked',
    placement: { kind: 'workspace' },
  });

  await page.reload();
  await expect(page.getByTestId('recovery-notice')).toHaveCount(0);
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
  const reloadedWithdrawal = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(reloadedWithdrawal.items.find((item) => item.id === withdrawnItemId)).toMatchObject({
    validation: 'unchecked',
    placement: { kind: 'workspace' },
  });
  expect(reloadedWithdrawal.progress).toEqual(withdrawnSave.progress);
  expect(reloadedWithdrawal.inventionStage).toBe('Chronology Wheel');
  await expectCurrentChapterStatus();
  await page.getByTestId('open-puzzle').click();
  const chronologyPuzzlePanel = page.getByTestId('chronology-puzzle-panel');
  await expect(chronologyPuzzlePanel).toBeVisible();
  await expect(chronologyPuzzlePanel.getByRole('heading', { level: 2 })).toBeFocused();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey)).not.toBe(autosaveBeforeWithdrawal);
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
