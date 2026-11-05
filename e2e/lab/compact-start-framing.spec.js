import { expect, test } from '@playwright/test';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { encodeSave } from '../../src/game/persistence/save.js';
import { PREFERENCES_STORAGE_KEY } from '../../src/game/preferences/preferences.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const folioTestId = 'destination-cabinet-calibration';
const firstCardTestId = 'lab-item-calibration-card-01';

async function openFreshGame(page, { width, height, textScale }) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(({ preferencesKey, scale }) => {
    window.localStorage.clear();
    if (scale !== undefined) {
      window.localStorage.setItem(preferencesKey, JSON.stringify({
        version: 1,
        textScale: scale,
        reduceMotion: false,
        soundEffectsEnabled: false,
      }));
    }
  }, { preferencesKey: PREFERENCES_STORAGE_KEY, scale: textScale });
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

async function expectCenterHitTestable(locator, description, expectedRole) {
  const hitTest = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      accessibleName: element.getAttribute('aria-label'),
      role: element.getAttribute('role') || element.tagName.toLowerCase(),
      bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      hitTargetOrDescendant: hit === element || element.contains(hit),
      hit: hit && {
        tag: hit.tagName.toLowerCase(),
        testId: hit.getAttribute('data-testid'),
        accessibleName: hit.getAttribute('aria-label'),
        className: typeof hit.className === 'string' ? hit.className : '',
      },
    };
  });

  expect(hitTest.accessibleName, `${description} should expose an accessible name`).toBeTruthy();
  expect(hitTest.role, `${description} should retain its accessible role`).toBe(expectedRole);
  expect(hitTest.hitTargetOrDescendant, `${description} should remain hit-testable at its center (${JSON.stringify(hitTest)})`).toBe(true);
}

async function expectNoOverlap(first, second, description) {
  const [firstBox, secondBox] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  expect(firstBox, `${description}: first element should have geometry`).not.toBeNull();
  expect(secondBox, `${description}: second element should have geometry`).not.toBeNull();
  const overlaps = firstBox.x < secondBox.x + secondBox.width
    && firstBox.x + firstBox.width > secondBox.x
    && firstBox.y < secondBox.y + secondBox.height
    && firstBox.y + firstBox.height > secondBox.y;
  expect(overlaps, `${description} should not overlap (${JSON.stringify({ firstBox, secondBox })})`).toBe(false);
}

async function expectFirstClueAndFolioVisible(page) {
  await expectInsideWorldViewport(page, page.getByTestId(folioTestId));
  await expectInsideWorldViewport(page, page.getByTestId(firstCardTestId));
}

async function expectObjectMostlyExposed(page, locator, description, state) {
  const geometry = await locator.evaluate((item) => {
    const target = item.getBoundingClientRect();
    const overlayRects = ['.world-hint', '.game-toolbar']
      .map((selector) => document.querySelector(selector)?.getBoundingClientRect())
      .filter(Boolean);
    const intersection = (first, second) => {
      const left = Math.max(first.left, second.left);
      const top = Math.max(first.top, second.top);
      const right = Math.min(first.right, second.right);
      const bottom = Math.min(first.bottom, second.bottom);
      return {
        left,
        top,
        right,
        bottom,
        area: Math.max(0, right - left) * Math.max(0, bottom - top),
      };
    };

    const coveredByOverlays = overlayRects.reduce((total, overlay) => (
      total + intersection(target, overlay).area
    ), 0);
    const coveredByBoth = overlayRects.length === 2
      ? intersection(intersection(target, overlayRects[0]), overlayRects[1]).area
      : 0;
    const area = target.width * target.height;
    const summarize = ({ x, y, width, height }) => ({ x, y, width, height });
    const folio = document.querySelector('[data-testid="destination-cabinet-calibration"]');
    const worldViewport = document.querySelector('[data-testid="world-viewport"]');
    return {
      exposedRatio: 1 - ((coveredByOverlays - coveredByBoth) / area),
      clue: summarize(target),
      folio: folio ? summarize(folio.getBoundingClientRect()) : null,
      worldViewport: worldViewport ? summarize(worldViewport.getBoundingClientRect()) : null,
      overlays: overlayRects.map(summarize),
    };
  });

  expect(
    geometry.exposedRatio,
    `${description} should remain more than half visible above the hint and toolbar in the ${state} state (${JSON.stringify(geometry)})`,
  ).toBeGreaterThan(0.5);
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
  { width: 320, height: 400 },
  { width: 390, height: 400 },
]) {
  test(`150% text at a fresh ${viewport.width}x${viewport.height} start frames the calibration Folio and exposes the first clue`, async ({ page }) => {
    await openFreshGame(page, { ...viewport, textScale: 1.5 });
    await expect(page.locator('html')).toHaveCSS('--text-scale', '1.5');
    await expectFirstClueAndFolioVisible(page);
    const folio = page.getByRole('region', { name: /^Harmonic Calibration Folio\./ });
    const firstClue = page.getByTestId(firstCardTestId);
    await expectObjectMostlyExposed(page, folio, 'the Harmonic Calibration Folio', 'fresh start');
    await expectObjectMostlyExposed(page, firstClue, 'the first calibration clue', 'fresh start');
    await expectCenterHitTestable(folio, 'the Harmonic Calibration Folio', 'region');
    await expectCenterHitTestable(firstClue, 'the first calibration clue', 'button');
  });
}

for (const viewport of [
  { width: 320, height: 360 },
  { width: 667, height: 375 },
]) {
  test(`150% text at a fresh ${viewport.width}x${viewport.height} start keeps the calibration Folio and first clue exposed`, async ({ page }) => {
    await openFreshGame(page, { ...viewport, textScale: 1.5 });
    await expect(page.locator('html')).toHaveCSS('--text-scale', '1.5');
    await expectFirstClueAndFolioVisible(page);

    const folio = page.getByRole('region', { name: /^Harmonic Calibration Folio\./ });
    const firstClue = page.getByTestId(firstCardTestId);
    await expectObjectMostlyExposed(page, folio, 'the Harmonic Calibration Folio', 'fresh start');
    await expectObjectMostlyExposed(page, firstClue, 'the first calibration clue', 'fresh start');
    await expectCenterHitTestable(folio, 'the Harmonic Calibration Folio', 'region');
    await expectCenterHitTestable(firstClue, 'the first calibration clue', 'button');
  });
}

for (const viewport of [
  { width: 320, height: 360 },
  { width: 360, height: 399 },
]) {
  test(`fresh-start hint overlays remain separate at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await openFreshGame(page, viewport);

    const hint = page.locator('.world-hint');
    const atlasToggle = page.getByTestId('world-atlas-toggle');
    const autosaveStatus = page.getByTestId('autosave-status');
    await expect(hint).toBeVisible();
    await expect(atlasToggle).toBeVisible();
    await expect(autosaveStatus).toHaveText('Saved just now');

    await expectNoOverlap(hint, atlasToggle, 'fresh-start guidance and Atlas toggle');
    await expectNoOverlap(hint, autosaveStatus, 'fresh-start guidance and autosave status');
    await expectNoOverlap(atlasToggle, autosaveStatus, 'Atlas toggle and autosave status');
    await expectCenterHitTestable(atlasToggle, 'the Clockwork Atlas toggle', 'button');
  });
}

for (const state of ['fresh start', 'after jumping back to the start', 'after resetting the view']) {
  test(`the first calibration clue stays mostly visible beneath the guidance at 320x480 ${state}`, async ({ page }) => {
    await openFreshGame(page, { width: 320, height: 480 });

    if (state !== 'fresh start') {
      const locationJump = page.getByTestId('world-jump');
      await locationJump.selectOption('engine');
      await expect(page.locator('.invention-core')).toBeVisible();

      if (state === 'after jumping back to the start') {
        await locationJump.selectOption('start');
      } else {
        await page.getByRole('button', { name: 'Reset view' }).click();
      }
    }

    await expectFirstClueAndFolioVisible(page);
    await expectObjectMostlyExposed(page, page.getByTestId(firstCardTestId), 'the first calibration clue', state);
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

test('a saved camera is preserved when a game opens at 320x360', async ({ page }) => {
  const savedCamera = { panX: -321, panY: -222, scale: 0.9 };
  const savedState = createNewGameState();
  savedState.camera = savedCamera;

  await page.setViewportSize({ width: 320, height: 360 });
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: autoSaveKey,
    value: encodeSave(savedState),
  });
  await page.goto('/');
  await expect(page.getByTestId('world-viewport')).toBeVisible();

  await expect.poll(() => page.locator('.world-scene').evaluate((element) => element.style.transform))
    .toBe('translate(-321px, -222px) scale(0.9)');
});
