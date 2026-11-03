import { expect, test } from '@playwright/test';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { decodeSave, encodeSave } from '../../src/game/persistence/save.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const fixtureMarker = 'palimpsest-lab.touch-navigation-fixture-seeded';
const defaultCamera = { panX: 0, panY: 0, scale: 0.5 };
const calibrationItemId = 'calibration-card-01';

function createTouchFixture({ camera = defaultCamera, dragItem = false } = {}) {
  const state = createNewGameState();
  state.items.forEach((item, index) => {
    item.position = {
      x: 4140 + (index % 5) * 78,
      y: 3060 + (index % 4) * 62,
    };
  });

  if (dragItem) {
    const item = state.items.find((entry) => entry.id === calibrationItemId);
    if (!item) throw new Error(`Unable to find touch-drag fixture item ${calibrationItemId}.`);
    item.position = { x: 260, y: 230 };
  }

  state.camera = { ...camera };
  return state;
}

async function openTouchLab(browser, options = {}) {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const state = createTouchFixture(options);
  await page.addInitScript(({ key, value, marker }) => {
    if (window.sessionStorage.getItem(marker) === 'seeded') return;
    window.sessionStorage.setItem(marker, 'seeded');
    window.localStorage.clear();
    window.localStorage.setItem(key, value);
  }, { key: autoSaveKey, value: encodeSave(state), marker: fixtureMarker });
  await page.goto('/');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });
  const client = await context.newCDPSession(page);
  return { context, page, client, state };
}

async function dispatchTouch(client, type, points = []) {
  await client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map(({ id, x, y }) => ({ id, x, y, radiusX: 2, radiusY: 2, force: 0.7 })),
  });
}

async function endTouches(client) {
  await dispatchTouch(client, 'touchEnd');
}

async function readSceneCamera(page) {
  return page.locator('.world-scene').evaluate((scene) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(scene).transform);
    return { panX: matrix.e, panY: matrix.f, scale: matrix.a };
  });
}

function expectCameraClose(actual, expected) {
  expect(Math.abs(actual.panX - expected.panX), 'touch camera panX should persist within codec precision').toBeLessThanOrEqual(0.01);
  expect(Math.abs(actual.panY - expected.panY), 'touch camera panY should persist within codec precision').toBeLessThanOrEqual(0.01);
  expect(Math.abs(actual.scale - expected.scale), 'touch camera scale should persist within codec precision').toBeLessThanOrEqual(0.0001);
}

async function readSavedCamera(page) {
  const rawSave = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  return decodeSave(rawSave).camera;
}

async function findEmptyTouchPoint(page) {
  const point = await page.getByTestId('world-viewport').evaluate((viewport) => {
    const bounds = viewport.getBoundingClientRect();
    const blocked = '[data-item-id], [data-drop-id], button, input, select, textarea, .game-toolbar, .world-hint, .lab-toast, [data-testid="item-inspector"]';
    for (let y = bounds.top + 110; y < bounds.bottom - 155; y += 24) {
      for (let x = bounds.left + 50; x < bounds.right - 50; x += 24) {
        const hit = document.elementFromPoint(x, y);
        if (hit && viewport.contains(hit) && !hit.closest(blocked)) return { x, y };
      }
    }
    return null;
  });
  expect(point, 'the fixture should expose empty touch space in the world viewport').not.toBeNull();
  return point;
}

async function findEmptyTouchPair(page) {
  const pair = await page.getByTestId('world-viewport').evaluate((viewport) => {
    const bounds = viewport.getBoundingClientRect();
    const blocked = '[data-item-id], [data-drop-id], button, input, select, textarea, .game-toolbar, .world-hint, .lab-toast, [data-testid="item-inspector"]';
    const step = 46;
    for (let y = bounds.top + 120; y < bounds.bottom - 160; y += 24) {
      for (let middleX = bounds.left + step + 48; middleX < bounds.right - step - 48; middleX += 20) {
        const first = { x: middleX - step, y };
        const second = { x: middleX + step, y };
        const firstHit = document.elementFromPoint(first.x, first.y);
        const secondHit = document.elementFromPoint(second.x, second.y);
        if (firstHit && secondHit
          && viewport.contains(firstHit) && viewport.contains(secondHit)
          && !firstHit.closest(blocked) && !secondHit.closest(blocked)) {
          return {
            first: { id: 1, ...first },
            second: { id: 2, ...second },
          };
        }
      }
    }
    return null;
  });
  expect(pair, 'the fixture should expose a clear two-finger touch area').not.toBeNull();
  return pair;
}

async function readWorldPointAt(page, screenPoint) {
  return page.getByTestId('world-viewport').evaluate((viewport, point) => {
    const bounds = viewport.getBoundingClientRect();
    const scene = viewport.querySelector('.world-scene');
    const matrix = new DOMMatrixReadOnly(getComputedStyle(scene).transform);
    return {
      x: (point.x - bounds.left - matrix.e) / matrix.a,
      y: (point.y - bounds.top - matrix.f) / matrix.a,
    };
  }, screenPoint);
}

async function expectWorldPointAt(page, worldPoint, expectedScreenPoint) {
  const viewport = await page.getByTestId('world-viewport').boundingBox();
  expect(viewport).not.toBeNull();
  const camera = await readSceneCamera(page);
  const actual = {
    x: viewport.x + camera.panX + worldPoint.x * camera.scale,
    y: viewport.y + camera.panY + worldPoint.y * camera.scale,
  };
  expect(Math.hypot(actual.x - expectedScreenPoint.x, actual.y - expectedScreenPoint.y),
    'the world point under the original pinch midpoint should follow the moving midpoint').toBeLessThanOrEqual(4);
}

function touchPair(midpoint, distance) {
  const halfDistance = distance / 2;
  return [
    { id: 1, x: midpoint.x - halfDistance, y: midpoint.y },
    { id: 2, x: midpoint.x + halfDistance, y: midpoint.y },
  ];
}

async function withTouchLab(browser, options, exercise) {
  const fixture = await openTouchLab(browser, options);
  try {
    await exercise(fixture);
  } finally {
    await fixture.context.close();
  }
}

test('one-finger touch drag pans empty world space without changing zoom', async ({ browser }) => {
  await withTouchLab(browser, {}, async ({ page, client }) => {
    const start = await findEmptyTouchPoint(page);
    const cameraBefore = await readSceneCamera(page);
    const finish = { id: 1, x: start.x + 68, y: start.y + 42 };

    await dispatchTouch(client, 'touchStart', [{ id: 1, ...start }]);
    await dispatchTouch(client, 'touchMove', [finish]);
    await endTouches(client);

    await expect.poll(async () => (await readSceneCamera(page)).panX).not.toBe(cameraBefore.panX);
    const cameraAfter = await readSceneCamera(page);
    expect(cameraAfter.panX).toBeCloseTo(cameraBefore.panX + 68, 1);
    expect(cameraAfter.panY).toBeCloseTo(cameraBefore.panY + 42, 1);
    expect(cameraAfter.scale).toBe(cameraBefore.scale);
  });
});

test('two-finger pinch zooms in and out while keeping the moving midpoint anchored', async ({ browser }) => {
  await withTouchLab(browser, {}, async ({ page, client }) => {
    const pair = await findEmptyTouchPair(page);
    const startMidpoint = {
      x: (pair.first.x + pair.second.x) / 2,
      y: (pair.first.y + pair.second.y) / 2,
    };
    const initialCamera = await readSceneCamera(page);
    const anchoredBeforeZoomIn = await readWorldPointAt(page, startMidpoint);
    const zoomInMidpoint = { x: startMidpoint.x + 26, y: startMidpoint.y - 18 };
    const zoomInPoints = touchPair(zoomInMidpoint, 148);

    await dispatchTouch(client, 'touchStart', [pair.first, pair.second]);
    await dispatchTouch(client, 'touchMove', zoomInPoints);
    await endTouches(client);

    await expect.poll(async () => (await readSceneCamera(page)).scale).toBeGreaterThan(initialCamera.scale + 0.1);
    const cameraAfterZoomIn = await readSceneCamera(page);
    await expectWorldPointAt(page, anchoredBeforeZoomIn, zoomInMidpoint);

    const zoomOutStartMidpoint = zoomInMidpoint;
    const anchoredBeforeZoomOut = await readWorldPointAt(page, zoomOutStartMidpoint);
    const zoomOutMidpoint = { x: zoomOutStartMidpoint.x - 20, y: zoomOutStartMidpoint.y + 16 };
    const zoomOutPoints = touchPair(zoomOutMidpoint, 88);
    await dispatchTouch(client, 'touchStart', zoomInPoints);
    await dispatchTouch(client, 'touchMove', zoomOutPoints);
    await endTouches(client);

    await expect.poll(async () => (await readSceneCamera(page)).scale).toBeLessThan(cameraAfterZoomIn.scale - 0.05);
    await expectWorldPointAt(page, anchoredBeforeZoomOut, zoomOutMidpoint);
  });
});

test('one remaining finger continues panning after the other finger lifts', async ({ browser }) => {
  await withTouchLab(browser, {}, async ({ page, client }) => {
    const pair = await findEmptyTouchPair(page);
    const midpoint = { x: (pair.first.x + pair.second.x) / 2, y: pair.first.y };
    const zoomedPair = touchPair(midpoint, 132);
    const cameraBefore = await readSceneCamera(page);

    await dispatchTouch(client, 'touchStart', [{ id: 1, ...pair.first }]);
    await dispatchTouch(client, 'touchStart', [{ id: 1, ...pair.first }, { id: 2, ...pair.second }]);
    await dispatchTouch(client, 'touchMove', zoomedPair);
    await page.waitForTimeout(100);
    const cameraAfterPinch = await readSceneCamera(page);
    expect.soft(cameraAfterPinch.scale, 'the two active fingers should enter pinch zoom before one lifts')
      .toBeGreaterThan(cameraBefore.scale + 0.05);

    // CDP ends only the listed contact here; touchEnd with no points ends both.
    await dispatchTouch(client, 'touchEnd', [zoomedPair[1]]);
    const continuedFinger = { ...zoomedPair[0], x: zoomedPair[0].x + 36, y: zoomedPair[0].y + 22 };
    await dispatchTouch(client, 'touchMove', [continuedFinger]);
    await endTouches(client);

    await expect.poll(async () => (await readSceneCamera(page)).panX).not.toBe(cameraAfterPinch.panX);
    const cameraAfterPan = await readSceneCamera(page);
    expect(cameraAfterPan.panX).toBeCloseTo(cameraAfterPinch.panX + 36, 1);
    expect(cameraAfterPan.panY).toBeCloseTo(cameraAfterPinch.panY + 22, 1);
    expect(cameraAfterPan.scale).toBeCloseTo(cameraAfterPinch.scale, 5);
  });
});

test('a pinch arriving during an item drag cancels the drag without changing placement', async ({ browser }) => {
  await withTouchLab(browser, { dragItem: true }, async ({ page, client, state }) => {
    const item = page.getByTestId(`lab-item-${calibrationItemId}`);
    await expect(item).toBeVisible();
    const itemBounds = await item.boundingBox();
    expect(itemBounds).not.toBeNull();
    const firstStart = { id: 1, x: itemBounds.x + itemBounds.width / 2, y: itemBounds.y + itemBounds.height / 2 };
    const firstMoved = { ...firstStart, x: firstStart.x + 18, y: firstStart.y + 8 };
    const secondStart = { id: 2, x: firstStart.x + 90, y: firstStart.y + 58 };
    const secondMoved = { ...secondStart, x: secondStart.x + 36, y: secondStart.y + 24 };
    const originalItem = state.items.find((entry) => entry.id === calibrationItemId);

    await dispatchTouch(client, 'touchStart', [firstStart]);
    await dispatchTouch(client, 'touchMove', [firstMoved]);
    await dispatchTouch(client, 'touchStart', [firstMoved, secondStart]);
    await dispatchTouch(client, 'touchMove', [firstMoved, secondMoved]);
    await endTouches(client);

    const savedItem = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey))
      .items.find((entry) => entry.id === calibrationItemId);
    expect(savedItem.position).toEqual(originalItem.position);
    expect(savedItem.placement).toEqual(originalItem.placement);
    expect(savedItem.validation).toBe(originalItem.validation);
    await expect.poll(() => item.evaluate((element) => ({ left: element.style.left, top: element.style.top })))
      .toEqual({ left: `${originalItem.position.x}px`, top: `${originalItem.position.y}px` });
  });
});

test('touch camera pan autosaves and restores after reload', async ({ browser }) => {
  await withTouchLab(browser, {}, async ({ page, client, state }) => {
    const start = await findEmptyTouchPoint(page);
    const initialCamera = { ...state.camera };
    await dispatchTouch(client, 'touchStart', [{ id: 1, ...start }]);
    await dispatchTouch(client, 'touchMove', [{ id: 1, x: start.x + 54, y: start.y + 32 }]);
    await endTouches(client);

    await expect.poll(async () => {
      const saved = await readSavedCamera(page);
      const live = await readSceneCamera(page);
      return Math.abs(saved.panX - live.panX) <= 0.01
        && Math.abs(saved.panY - live.panY) <= 0.01
        && Math.abs(saved.scale - live.scale) <= 0.0001;
    }).toBe(true);
    const savedCamera = await readSavedCamera(page);
    expect(savedCamera.panX).not.toBe(initialCamera.panX);
    await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');

    await page.reload();
    await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
    expectCameraClose(await readSceneCamera(page), savedCamera);
  });
});

test('pinch camera zoom autosaves and restores after reload', async ({ browser }) => {
  await withTouchLab(browser, {}, async ({ page, client, state }) => {
    const pair = await findEmptyTouchPair(page);
    const midpoint = { x: (pair.first.x + pair.second.x) / 2, y: pair.first.y };
    const initialCamera = { ...state.camera };
    const zoomedPair = touchPair(midpoint, 136);

    await dispatchTouch(client, 'touchStart', [{ id: 1, ...pair.first }]);
    await dispatchTouch(client, 'touchStart', [pair.first, pair.second]);
    await dispatchTouch(client, 'touchMove', zoomedPair);
    await endTouches(client);

    await expect.poll(async () => {
      const saved = await readSavedCamera(page);
      const live = await readSceneCamera(page);
      return Math.abs(saved.panX - live.panX) <= 0.01
        && Math.abs(saved.panY - live.panY) <= 0.01
        && Math.abs(saved.scale - live.scale) <= 0.0001;
    }).toBe(true);
    const savedCamera = await readSavedCamera(page);
    expect(savedCamera.scale).toBeGreaterThan(initialCamera.scale);
    await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');

    await page.reload();
    await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
    expectCameraClose(await readSceneCamera(page), savedCamera);
  });
});
