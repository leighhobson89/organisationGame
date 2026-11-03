import { expect, test } from '@playwright/test';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { encodeSave } from '../../src/game/persistence/save.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const folioTestId = 'destination-cabinet-calibration';
const firstCardTestId = 'lab-item-calibration-card-01';

async function openFreshGame(page, { width, height }) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await expect(page.getByTestId('world-viewport')).toBeVisible();
}

async function expectInsideWorldViewport(page, locator) {
  const viewportBox = await page.getByTestId('world-viewport').boundingBox();
  const objectBox = await locator.boundingBox();
  expect(viewportBox, 'the world viewport should have rendered geometry').not.toBeNull();
  expect(objectBox, `${await locator.getAttribute('aria-label')} should have rendered geometry`).not.toBeNull();

  expect(objectBox.x).toBeGreaterThanOrEqual(viewportBox.x - 1);
  expect(objectBox.y).toBeGreaterThanOrEqual(viewportBox.y - 1);
  expect(objectBox.x + objectBox.width).toBeLessThanOrEqual(viewportBox.x + viewportBox.width + 1);
  expect(objectBox.y + objectBox.height).toBeLessThanOrEqual(viewportBox.y + viewportBox.height + 1);
}

async function expectFirstClueAndFolioVisible(page) {
  await expectInsideWorldViewport(page, page.getByTestId(folioTestId));
  await expectInsideWorldViewport(page, page.getByTestId(firstCardTestId));
}

async function expectCalibrationGroupVisible(page) {
  await expectFirstClueAndFolioVisible(page);
  for (let index = 1; index <= 8; index += 1) {
    const itemId = `calibration-card-${String(index).padStart(2, '0')}`;
    await expectInsideWorldViewport(page, page.getByTestId(`lab-item-${itemId}`));
  }
}

for (const viewport of [
  { width: 320, height: 480 },
  { width: 375, height: 667 },
]) {
  test(`a fresh ${viewport.width}x${viewport.height} start frames the calibration Folio and first clue`, async ({ page }) => {
    await openFreshGame(page, viewport);
    await expectFirstClueAndFolioVisible(page);
  });
}

for (const viewport of [
  { width: 320, height: 480 },
  { width: 390, height: 480 },
]) {
  test(`jumping back to the start at ${viewport.width}x${viewport.height} frames the calibration Folio and first clue`, async ({ page }) => {
    await openFreshGame(page, viewport);

    const locationJump = page.getByTestId('world-jump');
    await locationJump.selectOption('engine');
    await expect(page.locator('.invention-core')).toBeVisible();

    await locationJump.selectOption('start');
    await expectFirstClueAndFolioVisible(page);
  });

  test(`resetting the view at ${viewport.width}x${viewport.height} frames the calibration Folio and first clue`, async ({ page }) => {
    await openFreshGame(page, viewport);

    const locationJump = page.getByTestId('world-jump');
    await locationJump.selectOption('engine');
    await expect(page.locator('.invention-core')).toBeVisible();
    await page.getByRole('button', { name: 'Reset view' }).click();
    await expectFirstClueAndFolioVisible(page);
  });
}

for (const width of [480, 481, 720, 721]) {
  test(`a fresh ${width}px-wide start keeps the calibration destination and first clue in view`, async ({ page }) => {
    await openFreshGame(page, { width, height: 667 });
    await expectFirstClueAndFolioVisible(page);

    if (width >= 481 && width <= 720) {
      await expectCalibrationGroupVisible(page);
    }
  });
}

test('the desktop fresh-start camera keeps its established calibration framing', async ({ page }) => {
  const viewport = { width: 1440, height: 900 };
  await openFreshGame(page, viewport);

  const viewportBox = await page.getByTestId('world-viewport').boundingBox();
  const folioBox = await page.getByTestId(folioTestId).boundingBox();
  expect(viewportBox).not.toBeNull();
  expect(folioBox).not.toBeNull();
  expect(folioBox.x - viewportBox.x).toBeCloseTo(380, 1);
  expect(folioBox.y - viewportBox.y).toBeCloseTo(176, 1);
  await expectInsideWorldViewport(page, page.getByTestId(firstCardTestId));
});

test('a saved camera stays fixed when a game is opened at compact width', async ({ page }) => {
  const savedCamera = { panX: -321, panY: -222, scale: 0.9 };
  const savedState = createNewGameState();
  savedState.camera = savedCamera;

  await page.setViewportSize({ width: 375, height: 667 });
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: autoSaveKey,
    value: encodeSave(savedState),
  });
  await page.goto('/');
  await expect(page.getByTestId('world-viewport')).toBeVisible();

  await page.setViewportSize({ width: 721, height: 900 });
  await expect.poll(() => page.locator('.world-scene').evaluate((element) => element.style.transform))
    .toBe('translate(-321px, -222px) scale(0.9)');
});
