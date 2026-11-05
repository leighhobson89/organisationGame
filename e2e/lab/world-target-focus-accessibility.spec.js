import { expect, test } from '@playwright/test';
import { DESTINATIONS, SCRATCH_PADS } from '../../src/game/content/catalog.js';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { encodeSave } from '../../src/game/persistence/save.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';

async function readSceneCamera(page) {
  return page.locator('.world-scene').evaluate((scene) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(scene).transform);
    return { panX: matrix.e, panY: matrix.f, scale: matrix.a };
  });
}

async function expectTargetCentered(page, target) {
  const [camera, viewportSize] = await Promise.all([
    readSceneCamera(page),
    page.getByTestId('world-viewport').evaluate((viewport) => ({
      width: viewport.clientWidth,
      height: viewport.clientHeight,
    })),
  ]);
  const targetCenter = {
    x: target.position.x + target.width / 2,
    y: target.position.y + target.height / 2,
  };
  const screenPoint = {
    x: camera.panX + targetCenter.x * camera.scale,
    y: camera.panY + targetCenter.y * camera.scale,
  };

  expect(Math.abs(screenPoint.x - viewportSize.width / 2), `${target.label} should be centered horizontally`)
    .toBeLessThanOrEqual(1);
  expect(Math.abs(screenPoint.y - viewportSize.height / 2), `${target.label} should be centered vertically`)
    .toBeLessThanOrEqual(1);
}

test('destination and work-surface focus buttons have unique accessible names and recenter the camera', async ({ page }) => {
  await page.setViewportSize({ width: 3000, height: 1800 });
  const state = createNewGameState();
  state.camera = { panX: 0, panY: 0, scale: 0.4 };
  await page.addInitScript(({ key, value }) => {
    window.localStorage.clear();
    window.localStorage.setItem(key, value);
  }, { key: autoSaveKey, value: encodeSave(state) });
  await page.goto('/');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');

  const expectedNames = [
    ...DESTINATIONS.map((destination) => `Focus ${destination.label}`),
    ...SCRATCH_PADS.map((scratchPad) => `Focus ${scratchPad.label}`),
  ];
  expect(new Set(expectedNames).size, 'all destination and work-surface focus names should be unique')
    .toBe(DESTINATIONS.length + SCRATCH_PADS.length);
  const focusButtons = page.locator('.destination-focus, .scratch-pad button');
  await expect(focusButtons).toHaveCount(expectedNames.length);

  for (const destination of DESTINATIONS) {
    const button = page.getByTestId(`destination-${destination.id}`).locator('.destination-focus');
    await expect(button).toHaveText('Focus');
    await expect(button).toHaveAccessibleName(`Focus ${destination.label}`);
  }
  for (const scratchPad of SCRATCH_PADS) {
    const button = page.getByTestId(`scratch-${scratchPad.id}`).getByRole('button', {
      name: `Focus ${scratchPad.label}`,
      exact: true,
    });
    await expect(button).toHaveText('Focus');
    await expect(button).toHaveAccessibleName(`Focus ${scratchPad.label}`);
  }
  for (const name of expectedNames) {
    await expect(page.getByRole('button', { name, exact: true }), `${name} should resolve to exactly one control`)
      .toHaveCount(1);
  }

  const destination = DESTINATIONS.at(-1);
  const scratchPad = SCRATCH_PADS.at(-1);
  const cameraBeforeDestination = await readSceneCamera(page);
  await page.getByTestId(`destination-${destination.id}`)
    .locator('.destination-focus').click();
  await expect.poll(() => readSceneCamera(page)).not.toEqual(cameraBeforeDestination);
  await expectTargetCentered(page, destination);

  const cameraBeforeScratchPad = await readSceneCamera(page);
  await page.getByTestId(`scratch-${scratchPad.id}`)
    .getByRole('button', { name: `Focus ${scratchPad.label}`, exact: true }).click();
  await expect.poll(() => readSceneCamera(page)).not.toEqual(cameraBeforeScratchPad);
  await expectTargetCentered(page, scratchPad);
});
