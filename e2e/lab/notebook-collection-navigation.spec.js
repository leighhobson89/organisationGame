import { expect, test } from '@playwright/test';
import { DESTINATIONS } from '../../src/game/content/catalog.js';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { decodeSave, encodeSave } from '../../src/game/persistence/save.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const destination = DESTINATIONS.find((entry) => entry.id === 'case-bell-before-dawn');

async function readSceneCamera(page) {
  return page.locator('.world-scene').evaluate((scene) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(scene).transform);
    return { panX: matrix.e, panY: matrix.f, scale: matrix.a };
  });
}

async function expectDestinationCentered(page) {
  const [camera, viewportSize] = await Promise.all([
    readSceneCamera(page),
    page.getByTestId('world-viewport').evaluate((viewport) => ({
      width: viewport.clientWidth,
      height: viewport.clientHeight,
    })),
  ]);
  const targetCenter = {
    x: destination.position.x + destination.width / 2,
    y: destination.position.y + destination.height / 2,
  };
  const screenPoint = {
    x: camera.panX + targetCenter.x * camera.scale,
    y: camera.panY + targetCenter.y * camera.scale,
  };

  expect.soft(Math.abs(screenPoint.x - viewportSize.width / 2), 'destination should be centered horizontally')
    .toBeLessThanOrEqual(1);
  expect.soft(Math.abs(screenPoint.y - viewportSize.height / 2), 'destination should be centered vertically')
    .toBeLessThanOrEqual(1);
}

async function readAutosave(page) {
  const encodedSave = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  return decodeSave(encodedSave);
}

async function expectSavedCameraCentered(page, savedCamera) {
  const viewportSize = await page.getByTestId('world-viewport').evaluate((viewport) => ({
    width: viewport.clientWidth,
    height: viewport.clientHeight,
  }));
  const targetCenter = {
    x: destination.position.x + destination.width / 2,
    y: destination.position.y + destination.height / 2,
  };
  const screenPoint = {
    x: savedCamera.panX + targetCenter.x * savedCamera.scale,
    y: savedCamera.panY + targetCenter.y * savedCamera.scale,
  };

  expect(Math.abs(screenPoint.x - viewportSize.width / 2), 'saved camera should center the destination horizontally')
    .toBeLessThanOrEqual(1);
  expect(Math.abs(screenPoint.y - viewportSize.height / 2), 'saved camera should center the destination vertically')
    .toBeLessThanOrEqual(1);
}

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 390, height: 480 },
]) {
  test(`Notebook collection focus returns to its toggle and centers the destination at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const state = createNewGameState();
    await page.setViewportSize(viewport);
    await page.addInitScript(({ key, value }) => {
      window.localStorage.clear();
      window.localStorage.setItem(key, value);
    }, { key: autoSaveKey, value: encodeSave(state) });
    await page.goto('/');
    await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');

    const initialSave = await readAutosave(page);
    const notebookToggle = page.getByTestId('toggle-notebook');
    await notebookToggle.click();
    await expect(page.getByTestId('notebook-panel')).toBeVisible();

    const collectionButton = page.getByTestId('collection-bell-before-dawn');
    await collectionButton.focus();
    await expect(collectionButton).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('notebook-panel')).toHaveCount(0);
    await expect.soft(notebookToggle).toBeFocused();
    await expect.soft(page.getByTestId('world-announcer')).toContainText(destination.label);
    await expectDestinationCentered(page);

    await expect.poll(async () => {
      const [status, savedState] = await Promise.all([
        page.getByTestId('autosave-status').innerText(),
        readAutosave(page),
      ]);
      return status === 'Saved just now' && savedState.camera.panX !== initialSave.camera.panX
        ? savedState.camera
        : null;
    }).not.toBeNull();
    const savedState = await readAutosave(page);
    expect(savedState.items, 'collection focus should not change saved items').toEqual(initialSave.items);
    expect(savedState.progress, 'collection focus should not change saved progress').toEqual(initialSave.progress);
    expect(savedState.notebook, 'collection focus should not change saved notebook data').toEqual(initialSave.notebook);
    await expectSavedCameraCentered(page, savedState.camera);

    await notebookToggle.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('notebook-panel')).toBeVisible();
  });
}
