import { expect, test } from '@playwright/test';
import { WORLD_BOUNDS } from '../src/game/content/catalog.js';
import { createDefaultProgress, CURRENT_GAME_STATE_VERSION, DEFAULT_CONTENT_SEED } from '../src/game/persistence/gameState.js';
import { decodeSave, encodeSave } from '../src/game/persistence/save.js';
import { AUTHORED_ITEM_COUNT, createBenchmarkItems } from './fixtures.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const sparseCamera = { panX: -1840, panY: -964, scale: 2.5 };
const draggedItemId = 'calibration-card-01';
const finalDestinationId = 'cabinet-calibration';
const authoredItemCount = AUTHORED_ITEM_COUNT;

function createWorldFixture(itemCount) {
  const items = createBenchmarkItems(itemCount);
  const state = {
    version: CURRENT_GAME_STATE_VERSION,
    contentSeed: DEFAULT_CONTENT_SEED,
    items,
    progress: createDefaultProgress(),
    camera: { ...sparseCamera },
    inventionStage: 'Dormant',
    notebook: { discoveries: [] },
  };

  return {
    encodedSave: encodeSave(state),
    items,
    itemIds: items.map((item) => item.id),
  };
}

async function readSceneCamera(scene) {
  return scene.evaluate((element) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return { panX: matrix.e, panY: matrix.f, scale: matrix.a };
  });
}

async function readCullingRevision(viewport) {
  const value = await viewport.getAttribute('data-culling-revision');
  expect(value, 'the viewport should expose its internal culling snapshot revision').not.toBeNull();
  expect(value).toMatch(/^\d+$/);
  return Number(value);
}

async function readWorldPointAt(scene, viewport, clientPoint) {
  return scene.evaluate((element, point) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    const rect = document.querySelector('[data-testid="world-viewport"]').getBoundingClientRect();
    return {
      x: (point.x - rect.left - matrix.e) / matrix.a,
      y: (point.y - rect.top - matrix.f) / matrix.d,
    };
  }, clientPoint);
}

function encodeFixtureAtCamera(fixture, camera) {
  const state = decodeSave(fixture.encodedSave);
  state.camera = { ...camera };
  return encodeSave(state);
}

async function clickWorldPoint(page, position) {
  const viewport = page.getByTestId('world-viewport');
  const viewportBox = await viewport.boundingBox();
  expect(viewportBox).not.toBeNull();
  const camera = await readSceneCamera(page.locator('.world-scene'));
  await page.mouse.click(
    viewportBox.x + camera.panX + position.x * camera.scale,
    viewportBox.y + camera.panY + position.y * camera.scale,
  );
}

async function sampleCanvasCard(canvas, item) {
  return canvas.evaluate((element, specimen) => {
    const context = element.getContext('2d', { willReadFrequently: true });
    const scaleX = element.width / 5200;
    const scaleY = element.height / 3400;
    const left = Math.max(0, Math.floor(specimen.position.x * scaleX));
    const top = Math.max(0, Math.floor(specimen.position.y * scaleY));
    const width = Math.max(1, Math.min(element.width - left, Math.ceil(specimen.width * scaleX)));
    const height = Math.max(1, Math.min(element.height - top, Math.ceil(specimen.height * scaleY)));
    const pixels = context.getImageData(left, top, width, height).data;
    const colors = new Set();
    const gray = [];
    let opaquePixels = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      const [red, green, blue, alpha] = pixels.slice(offset, offset + 4);
      gray.push(Math.round(red * 0.299 + green * 0.587 + blue * 0.114));
      if (alpha > 0) {
        opaquePixels += 1;
        colors.add(`${red},${green},${blue}`);
      }
    }
    const edgePixels = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = y * width + x;
        const current = gray[offset];
        const horizontalEdge = x > 0 && Math.abs(current - gray[offset - 1]) > 32;
        const verticalEdge = y > 0 && Math.abs(current - gray[offset - width]) > 32;
        edgePixels.push(horizontalEdge || verticalEdge ? '1' : '0');
      }
    }
    return { opaquePixels, colors: [...colors].sort(), edgeSignature: edgePixels.join('') };
  }, item);
}

async function importCameraDuringActivePan(page, camera) {
  const fixture = createWorldFixture(5024);
  const importedState = decodeSave(fixture.encodedSave);
  importedState.camera = camera;
  const importedSave = encodeSave(importedState);
  await page.addInitScript(({ key, value }) => {
    const installedKey = '__browser_scaling_fixture_installed';
    if (window.sessionStorage.getItem(installedKey)) return;
    window.localStorage.clear();
    window.localStorage.setItem(key, value);
    window.sessionStorage.setItem(installedKey, 'true');
  }, { key: autoSaveKey, value: fixture.encodedSave });
  await page.goto('/');
  await expect(page.getByTestId('world-item-count')).toHaveText('5024 objects');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });

  const viewport = page.getByTestId('world-viewport');
  const scene = page.locator('.world-scene');
  const viewportBox = await viewport.boundingBox();
  expect(viewportBox).not.toBeNull();
  const panStart = { x: viewportBox.x + 1200, y: viewportBox.y + 100 };
  const initialTransform = await scene.evaluate((element) => element.style.transform);
  await page.mouse.move(panStart.x, panStart.y);
  await page.mouse.down();
  await page.mouse.move(panStart.x + 40, panStart.y + 20, { steps: 3 });
  await expect.poll(() => scene.evaluate((element) => element.style.transform)).not.toBe(initialTransform);

  await page.getByTestId('open-saves').evaluate((element) => element.click());
  await page.getByTestId('save-import-string').fill(importedSave);
  await page.getByRole('checkbox', { name: /valid import replaces the current laboratory/i })
    .evaluate((element) => element.click());
  await page.getByTestId('import-save').evaluate((element) => element.click());
  await expect(page.getByTestId('save-feedback')).toContainText(/save imported/i);

  const sceneAfterImport = await readSceneCamera(scene);
  expect(sceneAfterImport.panX).toBeCloseTo(camera.panX, 4);
  expect(sceneAfterImport.panY).toBeCloseTo(camera.panY, 4);
  expect(sceneAfterImport.scale).toBeCloseTo(camera.scale, 4);
  return { camera, fixture, scene, viewport };
}

test('5,024-item renderer fixture spreads synthetic filler deterministically without moving the authored 174', () => {
  const authoredItems = createBenchmarkItems(authoredItemCount);
  const firstFixture = createWorldFixture(5024);
  const secondFixture = createWorldFixture(5024);
  const syntheticItems = firstFixture.items.slice(authoredItemCount);
  const occupiedCells = new Set(syntheticItems.map((item) => `${Math.floor(item.position.x / 900)},${Math.floor(item.position.y / 650)}`));

  expect(firstFixture.items.slice(0, authoredItemCount)).toEqual(authoredItems);
  expect(secondFixture.items.slice(0, authoredItemCount)).toEqual(authoredItems);
  expect(firstFixture.itemIds).toEqual(secondFixture.itemIds);
  expect(syntheticItems.map((item) => item.position)).toEqual(
    secondFixture.items.slice(authoredItemCount).map((item) => item.position),
  );
  expect(firstFixture.items).toHaveLength(5024);
  expect(new Set(firstFixture.itemIds).size).toBe(5024);
  expect(occupiedCells.size, 'synthetic filler should cover multiple world regions').toBeGreaterThanOrEqual(12);
});

test('5,024 items: pan and wheel use frame-bounded culling with settled camera commits', async ({ page }) => {
  const fixture = createWorldFixture(5024);
  await page.addInitScript(({ key, value }) => {
    const installedKey = '__browser_scaling_fixture_installed';
    if (window.sessionStorage.getItem(installedKey)) return;
    window.localStorage.clear();
    window.localStorage.setItem(key, value);
    window.sessionStorage.setItem(installedKey, 'true');
  }, { key: autoSaveKey, value: fixture.encodedSave });
  await page.goto('/');

  await expect(page.getByTestId('world-item-count')).toHaveText('5024 objects');
  const viewport = page.getByTestId('world-viewport');
  const scene = page.locator('.world-scene');
  const cardIds = fixture.items.slice(0, 8).map((item) => item.id);
  const mountedCardIds = async () => (await page.locator('.lab-object').evaluateAll((nodes) => nodes.map((node) => node.dataset.itemId))).sort();
  const expectCalibrationCardsMounted = async () => {
    const mountedIds = await mountedCardIds();
    expect(mountedIds, 'all eight calibration cards should remain mounted in the sparse view')
      .toEqual(expect.arrayContaining(cardIds));
    expect(mountedIds.length, 'the sparse view should keep all eight calibration cards and at most two nearby items mounted')
      .toBeGreaterThanOrEqual(cardIds.length);
    expect(mountedIds.length, 'the sparse view should keep all eight calibration cards and at most two nearby items mounted')
      .toBeLessThanOrEqual(10);
  };
  await expect(page.getByTestId(`lab-item-${cardIds[0]}`)).toBeVisible();
  await expectCalibrationCardsMounted();

  const viewportBox = await viewport.boundingBox();
  expect(viewportBox).not.toBeNull();
  const panStart = { x: viewportBox.x + 1200, y: viewportBox.y + 100 };
  const panStartTransform = await scene.evaluate((element) => element.style.transform);
  const panStartCamera = await readSceneCamera(scene);
  const panStartRevision = await readCullingRevision(viewport);
  await viewport.evaluate((element) => {
    element.addEventListener('pointerdown', (event) => {
      window.__cameraRegressionPointerId = event.pointerId;
    }, { once: true });
  });
  await page.mouse.move(panStart.x, panStart.y);
  await page.mouse.down();
  const pointerId = await page.evaluate(() => window.__cameraRegressionPointerId);
  expect(Number.isInteger(pointerId)).toBe(true);
  await viewport.evaluate((element, { id, x, y }) => {
    for (let index = 1; index <= 40; index += 1) {
      element.dispatchEvent(new PointerEvent('pointermove', {
        pointerId: id,
        clientX: x + index * 0.6,
        clientY: y + index * 0.3,
        buttons: 1,
        bubbles: true,
      }));
    }
  }, { id: pointerId, x: panStart.x, y: panStart.y });
  await page.mouse.move(panStart.x + 24, panStart.y + 12);
  await expect.poll(() => scene.evaluate((element) => element.style.transform))
    .not.toBe(panStartTransform);
  const panMotionRevision = await readCullingRevision(viewport);
  expect(panMotionRevision - panStartRevision, 'small pan moves inside overscan should not repeatedly refresh culling')
    .toBeLessThanOrEqual(1);
  await page.mouse.up();

  await expect.poll(() => readCullingRevision(viewport)).toBeGreaterThan(panMotionRevision);
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });
  const savedAfterPan = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  const committedPanCamera = await readSceneCamera(scene);
  expect(savedAfterPan.camera.panX).toBeCloseTo(committedPanCamera.panX, 2);
  expect(savedAfterPan.camera.panY).toBeCloseTo(committedPanCamera.panY, 2);

  const cancelStartTransform = await scene.evaluate((element) => element.style.transform);
  const cancelStartCamera = await readSceneCamera(scene);
  await viewport.evaluate((element) => {
    element.addEventListener('pointerdown', (event) => {
      window.__cameraRegressionCancelPointerId = event.pointerId;
    }, { once: true });
  });
  await page.mouse.move(panStart.x, panStart.y);
  await page.mouse.down();
  await page.mouse.move(panStart.x + 72, panStart.y + 40, { steps: 4 });
  await expect.poll(() => scene.evaluate((element) => element.style.transform))
    .not.toBe(cancelStartTransform);
  const cancelPointerId = await page.evaluate(() => window.__cameraRegressionCancelPointerId);
  expect(Number.isInteger(cancelPointerId)).toBe(true);
  await viewport.evaluate((element, pointerId) => {
    element.dispatchEvent(new PointerEvent('pointercancel', {
      pointerId,
      bubbles: true,
    }));
  }, cancelPointerId);
  await expect.poll(() => scene.evaluate((element) => element.style.transform))
    .toBe(cancelStartTransform);
  await page.mouse.up();
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });
  const savedAfterCancel = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(savedAfterCancel.camera).toEqual(savedAfterPan.camera);
  expect(await readSceneCamera(scene)).toEqual(cancelStartCamera);

  const zoomOut = page.getByRole('button', { name: 'Zoom out' });
  for (let index = 0; index < 4; index += 1) await zoomOut.click();
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });
  const zoomReadout = page.locator('.zoom-readout');
  const zoomBeforeBurst = await zoomReadout.innerText();
  const zoomBeforeCamera = await readSceneCamera(scene);
  const zoomBeforeRevision = await readCullingRevision(viewport);
  const zoomPoint = {
    x: viewportBox.x + viewportBox.width / 2,
    y: viewportBox.y + viewportBox.height / 2,
  };
  const worldAnchorBefore = await readWorldPointAt(scene, viewport, zoomPoint);
  await page.mouse.move(zoomPoint.x, zoomPoint.y);
  await viewport.evaluate((element, { point }) => {
    for (let index = 0; index < 10; index += 1) {
      element.dispatchEvent(new WheelEvent('wheel', {
        deltaY: -120,
        clientX: point.x,
        clientY: point.y,
        bubbles: true,
        cancelable: true,
      }));
    }
  }, { point: zoomPoint });
  await expect.poll(async () => (await readSceneCamera(scene)).scale).toBeGreaterThan(zoomBeforeCamera.scale);
  const wheelBurstRevision = await readCullingRevision(viewport);
  expect(wheelBurstRevision - zoomBeforeRevision, 'a coalesced wheel burst should not recalculate culling for every input event')
    .toBeLessThanOrEqual(4);

  await expect.poll(() => readCullingRevision(viewport)).toBeGreaterThan(wheelBurstRevision);
  await expect.poll(() => zoomReadout.innerText()).not.toBe(zoomBeforeBurst);
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });
  const zoomedCamera = await readSceneCamera(scene);
  const worldAnchorAfter = await readWorldPointAt(scene, viewport, zoomPoint);
  expect(Math.abs(worldAnchorAfter.x - worldAnchorBefore.x), 'zoom should keep the cursor world point within a fraction of a screen pixel')
    .toBeLessThan(0.1);
  expect(Math.abs(worldAnchorAfter.y - worldAnchorBefore.y), 'zoom should keep the cursor world point within a fraction of a screen pixel')
    .toBeLessThan(0.1);
  expect(await zoomReadout.innerText()).toBe(`${Math.round(zoomedCamera.scale * 100)}%`);
  expect(zoomedCamera.scale).toBeCloseTo(2.5, 2);
  const savedAfterZoom = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(savedAfterZoom.camera.panX).toBeCloseTo(zoomedCamera.panX, 2);
  expect(savedAfterZoom.camera.panY).toBeCloseTo(zoomedCamera.panY, 2);
  expect(savedAfterZoom.camera.scale).toBeCloseTo(zoomedCamera.scale, 4);
  await expectCalibrationCardsMounted();

  await page.getByTestId('world-jump').selectOption(`destination:${finalDestinationId}`);
  const draggedItem = page.getByTestId(`lab-item-${draggedItemId}`);
  const destination = page.getByTestId(`destination-${finalDestinationId}`);
  await expect(draggedItem).toBeVisible();
  await expect(destination).toBeVisible();
  await draggedItem.dragTo(destination, { targetPosition: { x: 110, y: 80 }, steps: 8 });
  await expect(destination).toHaveAttribute('aria-label', /1 of 8 objects placed/i);
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });
  const savedAfterDrag = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(savedAfterDrag.items).toHaveLength(5024);
  expect(savedAfterDrag.items.map((item) => item.id)).toEqual(fixture.itemIds);
  expect(savedAfterDrag.items.find((item) => item.id === draggedItemId).placement)
    .toMatchObject({ kind: 'destination', destinationId: finalDestinationId });
});

for (const termination of ['pointerup', 'Escape']) {
  test(`5,024 items: ${termination} after an external camera import during pan keeps the imported camera`, async ({ page }) => {
    const importedCamera = { panX: -910, panY: -440, scale: 1.35 };
    const { camera, fixture, scene } = await importCameraDuringActivePan(page, importedCamera);

    if (termination === 'pointerup') {
      await page.mouse.up();
    } else {
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('save-dialog')).toBeHidden();
      await page.mouse.up();
    }

    const cameraAfterTermination = await readSceneCamera(scene);
    expect(cameraAfterTermination.panX).toBeCloseTo(camera.panX, 4);
    expect(cameraAfterTermination.panY).toBeCloseTo(camera.panY, 4);
    expect(cameraAfterTermination.scale).toBeCloseTo(camera.scale, 4);
    await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });

    const savedState = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
    expect(savedState.camera.panX).toBeCloseTo(camera.panX, 4);
    expect(savedState.camera.panY).toBeCloseTo(camera.panY, 4);
    expect(savedState.camera.scale).toBeCloseTo(camera.scale, 4);
    expect(savedState.items.map((item) => item.id)).toEqual(fixture.itemIds);
  });
}

test('5,024 items: camera imported near the wheel settle deadline stays live and saved', async ({ page }) => {
  const fixture = createWorldFixture(5024);
  const importedCamera = { panX: -910, panY: -440, scale: 1.35 };
  const importedState = decodeSave(fixture.encodedSave);
  importedState.camera = importedCamera;
  const importedSave = encodeSave(importedState);
  await page.addInitScript(({ key, value }) => {
    const installedKey = '__browser_scaling_fixture_installed';
    if (window.sessionStorage.getItem(installedKey)) return;
    window.localStorage.clear();
    window.localStorage.setItem(key, value);
    window.sessionStorage.setItem(installedKey, 'true');
  }, { key: autoSaveKey, value: fixture.encodedSave });
  await page.goto('/');
  await expect(page.getByTestId('world-item-count')).toHaveText('5024 objects');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });

  await page.getByTestId('open-saves').click();
  await page.getByTestId('save-import-string').fill(importedSave);
  await page.getByRole('checkbox', { name: /valid import replaces the current laboratory/i }).check();
  const viewport = page.getByTestId('world-viewport');
  const scene = page.locator('.world-scene');
  const viewportBox = await viewport.boundingBox();
  expect(viewportBox).not.toBeNull();
  const wheelPoint = { x: viewportBox.x + viewportBox.width / 2, y: viewportBox.y + viewportBox.height / 2 };
  const cameraBeforeWheel = await readSceneCamera(scene);

  // Queue the real import-button handler at 179ms, just before WorldViewport's 180ms wheel commit.
  // The large valid save also makes this exercise the same synchronous decode/normalize path as a user import.
  await viewport.evaluate((element, { point, delay }) => {
    element.dispatchEvent(new WheelEvent('wheel', {
      deltaY: 120,
      clientX: point.x,
      clientY: point.y,
      bubbles: true,
      cancelable: true,
    }));
    window.setTimeout(() => document.querySelector('[data-testid="import-save"]')?.click(), delay);
  }, { point: wheelPoint, delay: 179 });
  await expect.poll(() => readSceneCamera(scene).then((camera) => camera.scale))
    .toBeLessThan(cameraBeforeWheel.scale);
  await expect(page.getByTestId('save-feedback')).toContainText(/save imported/i, { timeout: 15_000 });
  await page.waitForTimeout(250);

  const liveCamera = await readSceneCamera(scene);
  expect(liveCamera.panX).toBeCloseTo(importedCamera.panX, 4);
  expect(liveCamera.panY).toBeCloseTo(importedCamera.panY, 4);
  expect(liveCamera.scale).toBeCloseTo(importedCamera.scale, 4);
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });
  const savedState = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(savedState.camera).toEqual(importedCamera);
  expect(savedState.items.map((item) => item.id)).toEqual(fixture.itemIds);
});

test('174/5,024 items: overview canvas covers all entities with family and invalid cues', async ({ page }) => {
  let firstLoad = true;
  for (const itemCount of [174, 5024]) {
    const fixture = createWorldFixture(itemCount);
    const initialSave = encodeFixtureAtCamera(fixture, { panX: 0, panY: 0, scale: 0.2 });
    if (firstLoad) {
      await page.addInitScript(({ key, value }) => {
        const installedKey = '__browser_scaling_fixture_installed';
        if (window.sessionStorage.getItem(installedKey)) return;
        window.localStorage.clear();
        window.localStorage.setItem(key, value);
        window.sessionStorage.setItem(installedKey, 'true');
      }, { key: autoSaveKey, value: initialSave });
      await page.goto('/');
      firstLoad = false;
    } else {
      await page.evaluate(({ key, value }) => window.localStorage.setItem(key, value), {
        key: autoSaveKey,
        value: initialSave,
      });
      await page.reload();
    }

    await expect(page.getByTestId('world-item-count')).toHaveText(`${itemCount} objects`);
    const canvas = page.getByTestId('world-overview-canvas');
    await expect(canvas, 'overview should paint the full world on Canvas').toBeVisible();
    await expect(canvas).toHaveAttribute('data-rendered-item-count', String(itemCount));
    expect(await page.locator('.lab-object').count(), 'ordinary overview cards stay within the 64-card cap')
      .toBeLessThanOrEqual(64);

    const movingItem = fixture.items.find((item) => item.id === 'calibration-card-02');
    const ordinaryFamilyItem = fixture.items.find((item) => item.family === 'handwritten-note');
    const blueprintPixelsBefore = await sampleCanvasCard(canvas, movingItem);
    const notePixels = await sampleCanvasCard(canvas, ordinaryFamilyItem);
    expect(blueprintPixelsBefore.opaquePixels).toBeGreaterThan(0);
    expect(notePixels.opaquePixels).toBeGreaterThan(0);
    expect(notePixels.colors, 'different item families should paint distinct visible cues')
      .not.toEqual(blueprintPixelsBefore.colors);

    await clickWorldPoint(page, {
      x: movingItem.position.x + movingItem.width / 2,
      y: movingItem.position.y + movingItem.height / 2,
    });
    await expect(page.getByTestId('item-inspector')).toContainText(movingItem.title);
    await page.getByTestId('move-target').selectOption('drawer-field-notes');
    await page.getByTestId('move-item').click();
    await expect(page.getByTestId('item-inspector')).toContainText('Misfiled');
    await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });

    const savedAfterInvalidMove = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
    const invalidItem = savedAfterInvalidMove.items.find((item) => item.id === movingItem.id);
    expect(invalidItem.validation).toBe('invalid');
    expect(savedAfterInvalidMove.items.map((item) => item.id)).toEqual(fixture.itemIds);
    savedAfterInvalidMove.camera = { panX: 0, panY: 0, scale: 0.2 };
    await page.evaluate(({ key, value }) => window.localStorage.setItem(key, value), {
      key: autoSaveKey,
      value: encodeSave(savedAfterInvalidMove),
    });
    await page.reload();

    await expect(page.getByTestId('world-item-count')).toHaveText(`${itemCount} objects`);
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('data-rendered-item-count', String(itemCount));
    expect(await page.locator('.lab-object').count()).toBeLessThanOrEqual(64);
    const invalidPixels = await sampleCanvasCard(canvas, invalidItem);
    expect(invalidPixels.opaquePixels).toBeGreaterThan(0);
    expect(invalidPixels.edgeSignature,
      'the invalid cue should alter the card’s grayscale edge pattern, not only its color')
      .not.toBe(blueprintPixelsBefore.edgeSignature);

    const reloadedState = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
    expect(reloadedState.items.map((item) => item.id)).toEqual(fixture.itemIds);
    expect(reloadedState.items.find((item) => item.id === movingItem.id).validation).toBe('invalid');
  }
});

test('overview hysteresis promotes crisp detail cards and caps ordinary overlays', async ({ page }) => {
  const fixture = createWorldFixture(174);
  const initialSave = encodeFixtureAtCamera(fixture, { panX: 0, panY: 0, scale: 0.2 });
  await page.addInitScript(({ key, value }) => {
    const installedKey = '__browser_scaling_fixture_installed';
    if (window.sessionStorage.getItem(installedKey)) return;
    window.localStorage.clear();
    window.localStorage.setItem(key, value);
    window.sessionStorage.setItem(installedKey, 'true');
  }, { key: autoSaveKey, value: initialSave });
  await page.goto('/');

  const canvas = page.getByTestId('world-overview-canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-rendered-item-count', '174');
  expect(await page.locator('.lab-object').count()).toBeLessThanOrEqual(64);
  const zoomIn = page.getByRole('button', { name: 'Zoom in' });
  for (let index = 0; index < 5; index += 1) await zoomIn.click();
  const belowExitThreshold = await readSceneCamera(page.locator('.world-scene'));
  expect(belowExitThreshold.scale).toBeGreaterThan(0.4);
  expect(belowExitThreshold.scale).toBeLessThan(0.5);
  await expect(canvas, 'overview should remain active below the 0.5 exit boundary').toBeVisible();

  await zoomIn.click();
  await expect(canvas, 'the view should return to crisp detail at or above 0.5 with at most 320 visible items')
    .toBeHidden();
  await page.getByRole('button', { name: 'Reset view' }).click();
  await expect(page.getByTestId('lab-item-calibration-card-01')).toBeVisible();
  await page.getByTestId('lab-item-calibration-card-01').click();
  await expect(page.getByTestId('item-inspector')).toContainText('Harmonic Calibration 01');

  const zoomOut = page.getByRole('button', { name: 'Zoom out' });
  await zoomOut.click();
  await zoomOut.click();
  await expect(canvas, 'close detail cards should switch back to overview below 0.4').toBeVisible();
  await expect(page.getByTestId('lab-item-calibration-card-01')).toBeVisible();
  expect(await page.getByTestId('lab-item-calibration-card-01').getAttribute('aria-pressed')).toBe('true');
  expect(await page.locator('.lab-object').count(), 'the selected card may be forced in addition to the ordinary overlay budget')
    .toBeLessThanOrEqual(65);
});

test('low-zoom canvas hit testing selects and physically files a distant synthetic item', async ({ page }) => {
  const fixture = createWorldFixture(5024);
  const distantItem = fixture.items.at(-1);
  const initialSave = encodeFixtureAtCamera(fixture, { panX: 0, panY: 0, scale: 0.2 });
  await page.addInitScript(({ key, value }) => {
    const installedKey = '__browser_scaling_fixture_installed';
    if (window.sessionStorage.getItem(installedKey)) return;
    window.localStorage.clear();
    window.localStorage.setItem(key, value);
    window.sessionStorage.setItem(installedKey, 'true');
  }, { key: autoSaveKey, value: initialSave });
  await page.goto('/');
  await expect(page.getByTestId('world-overview-canvas')).toBeVisible();
  await expect(page.getByTestId('world-item-count')).toHaveText('5024 objects');

  await clickWorldPoint(page, {
    x: distantItem.position.x + distantItem.width / 2,
    y: distantItem.position.y + distantItem.height / 2,
  });
  await expect(page.getByTestId('item-inspector')).toContainText(distantItem.title);
  const crispItem = page.getByTestId(`lab-item-${distantItem.id}`);
  await expect(crispItem).toBeVisible();
  const destination = page.getByTestId(`destination-${distantItem.correctDestinationId}`);
  await expect(destination).toBeVisible();
  await crispItem.dragTo(destination, { targetPosition: { x: 70, y: 70 }, steps: 8 });
  await expect(destination).toHaveAttribute('aria-label', /1 of \d+ objects placed/i);
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });

  const liveCamera = await readSceneCamera(page.locator('.world-scene'));
  const savedState = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(savedState.items.map((item) => item.id)).toEqual(fixture.itemIds);
  expect(savedState.items.find((item) => item.id === distantItem.id).placement)
    .toMatchObject({ kind: 'destination', destinationId: distantItem.correctDestinationId });
  expect(savedState.camera.panX).toBeCloseTo(liveCamera.panX, 2);
  expect(savedState.camera.panY).toBeCloseTo(liveCamera.panY, 2);
  expect(savedState.camera.scale).toBeCloseTo(liveCamera.scale, 4);
});

test('keyboard Item Finder paginates and focuses a distant synthetic entity', async ({ page }) => {
  const fixture = createWorldFixture(5024);
  const distantItem = fixture.items.at(-1);
  await page.addInitScript(({ key, value }) => {
    const installedKey = '__browser_scaling_fixture_installed';
    if (window.sessionStorage.getItem(installedKey)) return;
    window.localStorage.clear();
    window.localStorage.setItem(key, value);
    window.sessionStorage.setItem(installedKey, 'true');
  }, { key: autoSaveKey, value: fixture.encodedSave });
  await page.goto('/');
  await expect(page.getByTestId('world-item-count')).toHaveText('5024 objects');

  const openFinder = page.getByRole('button', { name: 'Find an item' });
  await openFinder.focus({ timeout: 5_000 });
  await page.keyboard.press('Enter');
  const search = page.getByRole('searchbox', { name: 'Search laboratory items' });
  await expect(search).toBeVisible();
  const results = page.locator('[data-testid^="item-finder-result-"]');
  await expect(results).toHaveCount(25);
  await page.getByRole('button', { name: 'Next page' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('item-finder-page')).toContainText('2');
  await search.focus();
  await page.keyboard.press('Control+A');
  await search.pressSequentially(distantItem.title);
  await expect(results).toHaveCount(1);
  const result = page.getByRole('button', { name: new RegExp(distantItem.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
  await result.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId(`lab-item-${distantItem.id}`)).toBeVisible();
  await expect(page.getByTestId('item-inspector')).toContainText(distantItem.title);
  await page.getByTestId('move-target').selectOption(distantItem.correctDestinationId);
  await page.getByTestId('move-item').click();
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });

  const sceneCamera = await readSceneCamera(page.locator('.world-scene'));
  const savedState = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(savedState.items).toHaveLength(5024);
  expect(savedState.items.map((item) => item.id)).toEqual(fixture.itemIds);
  expect(savedState.items.find((item) => item.id === distantItem.id).placement)
    .toMatchObject({ kind: 'destination', destinationId: distantItem.correctDestinationId });
  expect(savedState.camera.panX).toBeCloseTo(sceneCamera.panX, 2);
  expect(savedState.camera.panY).toBeCloseTo(sceneCamera.panY, 2);
  expect(savedState.camera.scale).toBeCloseTo(sceneCamera.scale, 4);
});

test('detail-scale pan/zoom/drag/cancel/save preserves exact ordered state', async ({ page }) => {
  const fixture = createWorldFixture(174);
  await page.addInitScript(({ key, value }) => {
    const installedKey = '__browser_scaling_fixture_installed';
    if (window.sessionStorage.getItem(installedKey)) return;
    window.localStorage.clear();
    window.localStorage.setItem(key, value);
    window.sessionStorage.setItem(installedKey, 'true');
  }, { key: autoSaveKey, value: fixture.encodedSave });
  await page.goto('/');
  await expect(page.getByTestId('world-item-count')).toHaveText('174 objects');
  await expect(page.getByTestId('world-overview-canvas')).toBeHidden();
  await expect(page.getByTestId('lab-item-calibration-card-01')).toBeVisible();

  const viewport = page.getByTestId('world-viewport');
  const scene = page.locator('.world-scene');
  const viewportBox = await viewport.boundingBox();
  expect(viewportBox).not.toBeNull();
  const panStartCamera = await readSceneCamera(scene);
  await viewport.focus();
  await page.keyboard.down('Space');
  await page.mouse.move(viewportBox.x + 1200, viewportBox.y + 120);
  await page.mouse.down();
  await page.mouse.move(viewportBox.x + 1240, viewportBox.y + 150, { steps: 3 });
  await expect.poll(() => scene.evaluate((element) => element.style.transform)).not.toBe(
    `translate(${panStartCamera.panX}px, ${panStartCamera.panY}px) scale(${panStartCamera.scale})`,
  );
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.keyboard.up('Space');
  await expect.poll(() => readSceneCamera(scene)).toEqual(panStartCamera);

  await page.getByRole('button', { name: 'Zoom out' }).click();
  const zoomStartCamera = await readSceneCamera(scene);
  const zoomReadoutBefore = await page.locator('.zoom-readout').innerText();
  const zoomPoint = { x: viewportBox.x + viewportBox.width / 2, y: viewportBox.y + viewportBox.height / 2 };
  const worldAnchorBefore = await readWorldPointAt(scene, viewport, zoomPoint);
  await page.mouse.move(zoomPoint.x, zoomPoint.y);
  await page.mouse.wheel(0, -120);
  await expect.poll(() => readSceneCamera(scene).then((camera) => camera.scale)).toBeGreaterThan(zoomStartCamera.scale);
  await expect.poll(() => page.locator('.zoom-readout').innerText()).not.toBe(zoomReadoutBefore);
  const zoomedCamera = await readSceneCamera(scene);
  const worldAnchorAfter = await readWorldPointAt(scene, viewport, zoomPoint);
  expect(Math.abs(worldAnchorAfter.x - worldAnchorBefore.x)).toBeLessThan(0.1);
  expect(Math.abs(worldAnchorAfter.y - worldAnchorBefore.y)).toBeLessThan(0.1);

  await page.getByTestId('world-jump').selectOption('destination:cabinet-calibration');
  const draggedItem = page.getByTestId('lab-item-calibration-card-01');
  const destination = page.getByTestId('destination-cabinet-calibration');
  await expect(draggedItem).toBeVisible();
  await expect(destination).toBeVisible();
  await draggedItem.dragTo(destination, { targetPosition: { x: 120, y: 110 }, steps: 8 });
  await expect(destination).toHaveAttribute('aria-label', /1 of 8 objects placed/i);
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });

  const savedBeforeReload = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  const liveCamera = await readSceneCamera(scene);
  expect(savedBeforeReload.items.map((item) => item.id)).toEqual(fixture.itemIds);
  expect(savedBeforeReload.items.find((item) => item.id === 'calibration-card-01').placement)
    .toMatchObject({ kind: 'destination', destinationId: 'cabinet-calibration' });
  expect(savedBeforeReload.camera.panX).toBeCloseTo(liveCamera.panX, 2);
  expect(savedBeforeReload.camera.panY).toBeCloseTo(liveCamera.panY, 2);
  expect(savedBeforeReload.camera.scale).toBeCloseTo(liveCamera.scale, 4);
  await page.reload();
  await expect(page.getByTestId('world-item-count')).toHaveText('174 objects');
  const savedAfterReload = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(savedAfterReload.items.map((item) => item.id)).toEqual(fixture.itemIds);
  expect(savedAfterReload.items.find((item) => item.id === 'calibration-card-01').placement)
    .toMatchObject({ kind: 'destination', destinationId: 'cabinet-calibration' });
  expect(savedAfterReload.camera).toEqual(savedBeforeReload.camera);
});

for (const itemCount of [174, 5024]) {
  test(`${itemCount} items: cull a sparse view, pan, zoom, and drag without losing entities`, async ({ page }) => {
    const fixture = createWorldFixture(itemCount);
    await page.addInitScript(({ key, value }) => {
      const installedKey = '__browser_scaling_fixture_installed';
      if (window.sessionStorage.getItem(installedKey)) return;
      window.localStorage.clear();
      window.localStorage.setItem(key, value);
      window.sessionStorage.setItem(installedKey, 'true');
    }, { key: autoSaveKey, value: fixture.encodedSave });
    await page.goto('/');

    await expect(page.getByTestId('world-item-count')).toHaveText(`${itemCount} objects`);
    const viewport = page.getByTestId('world-viewport');
    const scene = page.locator('.world-scene');
    await expect(page.getByTestId('lab-item-calibration-card-01')).toBeVisible();
    const sparseMountedCount = await page.locator('.lab-object').count();
    expect(sparseMountedCount, 'the populated sparse view should mount calibration items').toBeGreaterThan(0);
    expect(sparseMountedCount, 'the remote sparse view should mount at most ten item elements').toBeLessThanOrEqual(10);
    expect(sparseMountedCount, 'the sparse viewport must cull items instead of mounting the entire save').toBeLessThan(itemCount);

    const viewportBox = await viewport.boundingBox();
    expect(viewportBox).not.toBeNull();
    const panStart = { x: viewportBox.x + 1200, y: viewportBox.y + 100 };
    const transformBeforePan = await scene.evaluate((element) => element.style.transform);
    await page.mouse.move(panStart.x, panStart.y);
    await page.mouse.down();
    await page.mouse.move(panStart.x + 90, panStart.y + 55, { steps: 6 });
    await page.mouse.up();
    await expect.poll(() => scene.evaluate((element) => element.style.transform))
      .not.toBe(transformBeforePan);

    const zoomReadout = page.locator('.zoom-readout');
    const zoomBefore = await zoomReadout.innerText();
    await page.mouse.move(panStart.x, panStart.y);
    await page.mouse.wheel(0, 320);
    await expect(zoomReadout).not.toHaveText(zoomBefore);

    await page.getByTestId('world-jump').selectOption(`destination:${finalDestinationId}`);
    const draggedItem = page.getByTestId(`lab-item-${draggedItemId}`);
    const destination = page.getByTestId(`destination-${finalDestinationId}`);
    await expect(draggedItem).toBeVisible();
    await expect(destination).toBeVisible();
    await draggedItem.dragTo(destination, { targetPosition: { x: 110, y: 80 }, steps: 8 });
    await expect(destination).toHaveAttribute('aria-label', /1 of 8 objects placed/i);
    await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });
    await expect(page.getByTestId('world-item-count')).toHaveText(`${itemCount} objects`);

    const rawSave = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
    expect(rawSave).toBeTruthy();
    const savedState = decodeSave(rawSave);
    expect(savedState.items).toHaveLength(itemCount);
    expect(savedState.items.map((item) => item.id)).toEqual(fixture.itemIds);
    expect(new Set(savedState.items.map((item) => item.id)).size).toBe(itemCount);
    const originalAuthoredPositions = fixture.items.slice(0, authoredItemCount)
      .filter((item) => item.id !== draggedItemId)
      .map((item) => ({ id: item.id, position: item.position }));
    expect(savedState.items.slice(0, authoredItemCount)
      .filter((item) => item.id !== draggedItemId)
      .map((item) => ({ id: item.id, position: item.position })))
      .toEqual(originalAuthoredPositions);
    expect(savedState.items.find((item) => item.id === draggedItemId).placement)
      .toMatchObject({ kind: 'destination', destinationId: finalDestinationId });

    const fullWorldState = { ...savedState, camera: { panX: 0, panY: 0, scale: 0.2 } };
    await page.evaluate(({ key, value }) => window.localStorage.setItem(key, value), {
      key: autoSaveKey,
      value: encodeSave(fullWorldState),
    });
    await page.reload();
    await expect(page.getByTestId('world-item-count')).toHaveText(`${itemCount} objects`);
    const overviewCanvas = page.getByTestId('world-overview-canvas');
    await expect(overviewCanvas, 'the 0.2-scale full-world view should use overview canvas coverage').toBeVisible();
    await expect(overviewCanvas).toHaveAttribute('data-rendered-item-count', String(itemCount));
    const fullWorldMountedCount = await page.locator('.lab-object').count();
    expect(fullWorldMountedCount, 'ordinary overview DOM cards should remain within the overlay budget').toBeLessThanOrEqual(64);
    const reloadedState = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
    expect(reloadedState.items.map((item) => item.id)).toEqual(fixture.itemIds);
  });
}
