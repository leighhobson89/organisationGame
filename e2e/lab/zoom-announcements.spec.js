import { expect, test } from '@playwright/test';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { decodeSave, encodeSave } from '../../src/game/persistence/save.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const touchFixtureMarker = 'palimpsest-lab.zoom-announcements-fixture-seeded';
const touchCamera = { panX: 0, panY: 0, scale: 0.5 };

function createTouchFixture() {
  const state = createNewGameState();
  state.items.forEach((item, index) => {
    item.position = {
      x: 4140 + (index % 5) * 78,
      y: 3060 + (index % 4) * 62,
    };
  });
  state.camera = { ...touchCamera };
  return state;
}

async function startAnnouncementRecording(page) {
  await page.addInitScript(() => {
    window.__zoomAnnouncements = [];
    let previousText = '';
    const recordAnnouncement = () => {
      const status = document.querySelector('[data-testid="zoom-announcer"]');
      if (!status) return;
      const text = status.textContent.trim();
      if (text === previousText) return;
      previousText = text;
      if (text) window.__zoomAnnouncements.push(text);
    };
    const observer = new MutationObserver(recordAnnouncement);
    observer.observe(document, { childList: true, characterData: true, subtree: true });
  });
}

async function loadLab(page) {
  await startAnnouncementRecording(page);
  await page.goto('/');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });
}

async function readAnnouncements(page) {
  return page.evaluate(() => window.__zoomAnnouncements);
}

async function expectOneSettledAnnouncement(page) {
  const readout = page.locator('.zoom-readout');
  await expect.poll(async () => (await readAnnouncements(page)).length).toBe(1);
  const [announcement] = await readAnnouncements(page);
  expect(announcement).toContain(await readout.innerText());
  await page.waitForTimeout(250);
  expect(await readAnnouncements(page)).toEqual([announcement]);
}

async function findEmptyPoint(page) {
  const point = await page.getByTestId('world-viewport').evaluate((viewport) => {
    const bounds = viewport.getBoundingClientRect();
    const blocked = '[data-item-id], [data-drop-id], button, input, select, textarea, .game-toolbar, .world-hint, .lab-toast, [data-testid="item-inspector"]';
    for (let y = bounds.top + 100; y < bounds.bottom - 130; y += 24) {
      for (let x = bounds.left + 45; x < bounds.right - 45; x += 24) {
        const hit = document.elementFromPoint(x, y);
        if (hit && viewport.contains(hit) && !hit.closest(blocked)) return { x, y };
      }
    }
    return null;
  });
  expect(point, 'the viewport should contain empty space to pan').not.toBeNull();
  return point;
}

async function openTouchLab(browser) {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const state = createTouchFixture();
  await startAnnouncementRecording(page);
  await page.addInitScript(({ key, value, marker }) => {
    if (window.sessionStorage.getItem(marker) === 'seeded') return;
    window.sessionStorage.setItem(marker, 'seeded');
    window.localStorage.clear();
    window.localStorage.setItem(key, value);
  }, { key: autoSaveKey, value: encodeSave(state), marker: touchFixtureMarker });
  await page.goto('/');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });
  const client = await context.newCDPSession(page);
  return { context, page, client };
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

async function readSavedCamera(page) {
  const rawSave = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  return decodeSave(rawSave).camera;
}

function expectCameraClose(actual, expected) {
  expect(Math.abs(actual.panX - expected.panX), 'camera panX should persist within codec precision').toBeLessThanOrEqual(0.01);
  expect(Math.abs(actual.panY - expected.panY), 'camera panY should persist within codec precision').toBeLessThanOrEqual(0.01);
  expect(Math.abs(actual.scale - expected.scale), 'camera scale should persist within codec precision').toBeLessThanOrEqual(0.0001);
}

async function findEmptyTouchPair(page) {
  const pair = await page.getByTestId('world-viewport').evaluate((viewport) => {
    const bounds = viewport.getBoundingClientRect();
    const blocked = '[data-item-id], [data-drop-id], button, input, select, textarea, .game-toolbar, .world-hint, .lab-toast, [data-testid="item-inspector"]';
    const halfDistance = 44;
    for (let y = bounds.top + 120; y < bounds.bottom - 160; y += 24) {
      for (let midpointX = bounds.left + halfDistance + 48; midpointX < bounds.right - halfDistance - 48; midpointX += 20) {
        const first = { x: midpointX - halfDistance, y };
        const second = { x: midpointX + halfDistance, y };
        const firstHit = document.elementFromPoint(first.x, first.y);
        const secondHit = document.elementFromPoint(second.x, second.y);
        if (firstHit && secondHit
          && viewport.contains(firstHit) && viewport.contains(secondHit)
          && !firstHit.closest(blocked) && !secondHit.closest(blocked)) {
          return { first: { id: 1, ...first }, second: { id: 2, ...second } };
        }
      }
    }
    return null;
  });
  expect(pair, 'the touch viewport should contain clear space for a two-finger gesture').not.toBeNull();
  return pair;
}

test('the visible zoom readout is not a live region', async ({ page }) => {
  await loadLab(page);

  const readout = page.locator('.zoom-readout');
  await expect(readout).toHaveText(/^\d+%$/);
  await expect(readout).not.toHaveAttribute('aria-live');
});

test('mounting the laboratory leaves the polite zoom status empty', async ({ page }) => {
  await loadLab(page);

  const announcer = page.getByTestId('zoom-announcer');
  await expect(announcer).toHaveCount(1);
  await expect(announcer).toHaveAttribute('role', 'status');
  await expect(announcer).toHaveAttribute('aria-live', 'polite');
  await expect(announcer).toBeEmpty();
  expect(await readAnnouncements(page)).toEqual([]);
});

test('a real wheel zoom keeps an empty off-center pointer anchored to the same world point', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await loadLab(page);

  const viewport = page.getByTestId('world-viewport');
  const point = await findEmptyPoint(page);
  const viewportRect = await viewport.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  });
  const localPointer = { x: point.x - viewportRect.left, y: point.y - viewportRect.top };
  expect(
    Math.hypot(localPointer.x - viewportRect.width / 2, localPointer.y - viewportRect.height / 2),
    'the wheel point should be well away from the viewport center',
  ).toBeGreaterThanOrEqual(100);

  const cameraBefore = await readSceneCamera(page);
  const anchoredWorldPoint = {
    x: (localPointer.x - cameraBefore.panX) / cameraBefore.scale,
    y: (localPointer.y - cameraBefore.panY) / cameraBefore.scale,
  };

  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, -120);
  await expect.poll(async () => (await readSceneCamera(page)).scale).not.toBe(cameraBefore.scale);

  const cameraAfter = await readSceneCamera(page);
  expect(Math.abs(cameraAfter.scale - cameraBefore.scale * 1.12), 'a 120px wheel notch should retain the existing 12% zoom step')
    .toBeLessThanOrEqual(0.001);
  const screenPointAfter = {
    x: anchoredWorldPoint.x * cameraAfter.scale + cameraAfter.panX,
    y: anchoredWorldPoint.y * cameraAfter.scale + cameraAfter.panY,
  };
  expect(Math.abs(screenPointAfter.x - localPointer.x), 'wheel zoom should preserve the cursor world point horizontally')
    .toBeLessThanOrEqual(1);
  expect(Math.abs(screenPointAfter.y - localPointer.y), 'wheel zoom should preserve the cursor world point vertically')
    .toBeLessThanOrEqual(1);
});

test('a real wheel zoom persists and restores the camera after reload', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await loadLab(page);

  const point = await findEmptyPoint(page);
  const cameraBefore = await readSceneCamera(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, -120);

  await expect.poll(async () => (await readSceneCamera(page)).scale).toBeGreaterThan(cameraBefore.scale);
  await expectOneSettledAnnouncement(page);

  await expect.poll(async () => {
    const [saved, live] = await Promise.all([readSavedCamera(page), readSceneCamera(page)]);
    return Math.abs(saved.panX - live.panX) <= 0.01
      && Math.abs(saved.panY - live.panY) <= 0.01
      && Math.abs(saved.scale - live.scale) <= 0.0001;
  }).toBe(true);

  const savedCamera = await readSavedCamera(page);
  await page.reload();
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });
  expectCameraClose(await readSceneCamera(page), savedCamera);
});

test('small pixel wheel deltas zoom smoothly while keeping the pointer anchored and announcing once', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await loadLab(page);

  const viewport = page.getByTestId('world-viewport');
  const point = await findEmptyPoint(page);
  const viewportRect = await viewport.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  });
  const localPointer = { x: point.x - viewportRect.left, y: point.y - viewportRect.top };
  const cameraBefore = await readSceneCamera(page);
  const readout = page.locator('.zoom-readout');
  const readoutBefore = await readout.innerText();
  const anchoredWorldPoint = {
    x: (localPointer.x - cameraBefore.panX) / cameraBefore.scale,
    y: (localPointer.y - cameraBefore.panY) / cameraBefore.scale,
  };

  await viewport.evaluate((element, pointer) => {
    for (let index = 0; index < 10; index += 1) {
      element.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: pointer.x,
        clientY: pointer.y,
        deltaY: -2,
        deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      }));
    }
  }, point);

  await expect.poll(async () => (await readSceneCamera(page)).scale).toBeGreaterThan(cameraBefore.scale);
  const cameraAfter = await readSceneCamera(page);
  expect(cameraAfter.scale / cameraBefore.scale, 'small pixel deltas should produce a smooth aggregate zoom')
    .toBeLessThan(1.05);
  await expectOneSettledAnnouncement(page);
  expect(await readout.innerText(), 'small pixel deltas should update the visible zoom readout')
    .not.toBe(readoutBefore);

  const screenPointAfter = {
    x: anchoredWorldPoint.x * cameraAfter.scale + cameraAfter.panX,
    y: anchoredWorldPoint.y * cameraAfter.scale + cameraAfter.panY,
  };
  expect(Math.abs(screenPointAfter.x - localPointer.x), 'pixel wheel zoom should preserve the cursor world point horizontally')
    .toBeLessThanOrEqual(1);
  expect(Math.abs(screenPointAfter.y - localPointer.y), 'pixel wheel zoom should preserve the cursor world point vertically')
    .toBeLessThanOrEqual(1);
});

test('horizontal trackpad movement pans without changing zoom or announcing', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await loadLab(page);

  const point = await findEmptyPoint(page);
  const cameraBefore = await readSceneCamera(page);
  const readout = page.locator('.zoom-readout');
  const readoutBefore = await readout.innerText();

  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(120, 0);
  await expect.poll(async () => (await readSceneCamera(page)).panX)
    .toBeLessThan(cameraBefore.panX);

  await page.waitForTimeout(300);
  const cameraAfter = await readSceneCamera(page);
  expect(cameraAfter.panY, 'horizontal wheel input should preserve vertical pan')
    .toBeCloseTo(cameraBefore.panY, 5);
  expect(cameraAfter.scale, 'horizontal wheel input should preserve zoom scale')
    .toBeCloseTo(cameraBefore.scale, 5);
  await expect(readout, 'horizontal wheel input should preserve the zoom readout')
    .toHaveText(readoutBefore);
  expect(await readAnnouncements(page), 'horizontal wheel input should not announce a zoom change')
    .toEqual([]);
});

test('rapid wheel zoom changes announce only the final settled percentage', async ({ page }) => {
  await loadLab(page);

  const viewport = page.getByTestId('world-viewport');
  const readout = page.locator('.zoom-readout');
  const originalZoom = await readout.innerText();
  const bounds = await viewport.boundingBox();
  expect(bounds).not.toBeNull();
  await viewport.evaluate((element, point) => {
    for (let index = 0; index < 6; index += 1) {
      element.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: point.x,
        clientY: point.y,
        deltaY: -120,
      }));
    }
  }, { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });

  await expect(readout).not.toHaveText(originalZoom);
  await expectOneSettledAnnouncement(page);
});

test('pan-only movement changes the view without a zoom announcement', async ({ page }) => {
  await loadLab(page);

  const point = await findEmptyPoint(page);
  const scene = page.locator('.world-scene');
  const originalTransform = await scene.evaluate((element) => element.style.transform);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 54, point.y + 31);
  await page.mouse.up();
  await expect.poll(() => scene.evaluate((element) => element.style.transform)).not.toBe(originalTransform);
  await page.waitForTimeout(300);

  expect(await readAnnouncements(page)).toEqual([]);
  const announcer = page.getByTestId('zoom-announcer');
  await expect(announcer).toHaveAttribute('role', 'status');
  await expect(announcer).toHaveAttribute('aria-live', 'polite');
});

test('toolbar zoom announces one settled final percentage', async ({ page }) => {
  await loadLab(page);

  const readout = page.locator('.zoom-readout');
  const originalZoom = await readout.innerText();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(readout).not.toHaveText(originalZoom);
  await expectOneSettledAnnouncement(page);
});

test('pinch zoom announces its settled percentage once and continuation pan stays silent', async ({ browser }) => {
  const { context, page, client } = await openTouchLab(browser);
  try {
    const pair = await findEmptyTouchPair(page);
    const readout = page.locator('.zoom-readout');
    const originalZoom = await readout.innerText();
    const movedFirst = { ...pair.first, x: pair.first.x - 24 };
    const movedSecond = { ...pair.second, x: pair.second.x + 32 };

    await dispatchTouch(client, 'touchStart', [pair.first]);
    await dispatchTouch(client, 'touchStart', [pair.first, pair.second]);
    await dispatchTouch(client, 'touchMove', [movedFirst, movedSecond]);
    await dispatchTouch(client, 'touchEnd', [movedSecond]);
    const cameraAfterPinch = await readSceneCamera(page);
    await dispatchTouch(client, 'touchMove', [{ ...movedFirst, x: movedFirst.x + 28, y: movedFirst.y + 18 }]);
    await endTouches(client);

    await expect(readout).not.toHaveText(originalZoom);
    await expect.poll(async () => (await readSceneCamera(page)).panX).not.toBe(cameraAfterPinch.panX);
    expect((await readSceneCamera(page)).scale).toBeCloseTo(cameraAfterPinch.scale, 5);
    await expectOneSettledAnnouncement(page);
    const announcer = page.getByTestId('zoom-announcer');
    await expect(announcer).toHaveAttribute('role', 'status');
    await expect(announcer).toHaveAttribute('aria-live', 'polite');
  } finally {
    await context.close();
  }
});

test('a staged pinch waits for release to announce its final scale and continuation pan stays silent', async ({ browser }) => {
  const { context, page, client } = await openTouchLab(browser);
  try {
    const pair = await findEmptyTouchPair(page);
    const readout = page.locator('.zoom-readout');
    const originalZoom = await readout.innerText();
    const cameraBeforePinch = await readSceneCamera(page);
    const firstStage = [
      { ...pair.first, x: pair.first.x + 24 },
      { ...pair.second, x: pair.second.x - 24 },
    ];
    const finalStage = [
      { ...pair.first, x: pair.first.x - 30 },
      { ...pair.second, x: pair.second.x + 30 },
    ];

    await dispatchTouch(client, 'touchStart', [pair.first]);
    await dispatchTouch(client, 'touchStart', [pair.first, pair.second]);
    await dispatchTouch(client, 'touchMove', firstStage);
    await expect(readout).not.toHaveText(originalZoom);
    await expect.poll(async () => (await readSceneCamera(page)).scale).toBeLessThan(cameraBeforePinch.scale);
    await page.waitForTimeout(240);
    expect(await readAnnouncements(page), 'an active pinch should stay silent after a pause').toEqual([]);

    const firstStageScale = (await readSceneCamera(page)).scale;
    await dispatchTouch(client, 'touchMove', finalStage);
    await expect.poll(async () => (await readSceneCamera(page)).scale).toBeGreaterThan(firstStageScale);
    await dispatchTouch(client, 'touchEnd', [finalStage[1]]);
    const cameraAfterPinch = await readSceneCamera(page);
    await dispatchTouch(client, 'touchMove', [{ ...finalStage[0], x: finalStage[0].x + 28, y: finalStage[0].y + 18 }]);
    await endTouches(client);

    await expect.poll(async () => (await readSceneCamera(page)).panX).not.toBe(cameraAfterPinch.panX);
    expect((await readSceneCamera(page)).scale).toBeCloseTo(cameraAfterPinch.scale, 5);
    await expectOneSettledAnnouncement(page);
  } finally {
    await context.close();
  }
});

test('cancelling a pinch back to the last announced zoom does not repeat that percentage', async ({ browser }) => {
  const { context, page, client } = await openTouchLab(browser);
  try {
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expectOneSettledAnnouncement(page);
    const readout = page.locator('.zoom-readout');
    const announcedZoom = await readout.innerText();
    const announcementsBeforePinch = await readAnnouncements(page);
    expect(announcementsBeforePinch).toHaveLength(1);

    const pair = await findEmptyTouchPair(page);
    const cameraBeforePinch = await readSceneCamera(page);
    const zoomedOutPair = [
      { ...pair.first, x: pair.first.x + 24 },
      { ...pair.second, x: pair.second.x - 24 },
    ];
    await dispatchTouch(client, 'touchStart', [pair.first]);
    await dispatchTouch(client, 'touchStart', [pair.first, pair.second]);
    await dispatchTouch(client, 'touchMove', zoomedOutPair);
    await expect(readout).not.toHaveText(announcedZoom);
    await expect.poll(async () => (await readSceneCamera(page)).scale).toBeLessThan(cameraBeforePinch.scale);

    await page.keyboard.press('Escape');
    await endTouches(client);
    await expect(readout).toHaveText(announcedZoom);
    await expect.poll(async () => (await readSceneCamera(page)).scale).toBeCloseTo(cameraBeforePinch.scale, 5);
    await page.waitForTimeout(300);

    expect(await readAnnouncements(page), 'rollback to the last announced zoom should not repeat its status').toEqual(announcementsBeforePinch);
  } finally {
    await context.close();
  }
});
