import { expect, test } from '@playwright/test';
import { DESTINATIONS, SCRATCH_PADS } from '../../src/game/content/catalog.js';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { encodeSave } from '../../src/game/persistence/save.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const neutralJumpValue = '';
const neutralJumpLabel = 'Jump to location';

async function readSceneCamera(page) {
  return page.locator('.world-scene').evaluate((scene) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(scene).transform);
    return { panX: matrix.e, panY: matrix.f, scale: matrix.a };
  });
}

async function readViewportSize(page) {
  return page.getByTestId('world-viewport').evaluate((viewport) => ({
    width: viewport.clientWidth,
    height: viewport.clientHeight,
  }));
}

async function expectJumpReset(jump, context) {
  const value = await jump.inputValue();
  const selectedLabel = (await jump.locator('option:checked').innerText()).trim();
  const placeholderOption = jump.locator('option[value=""]');
  const placeholderCount = await placeholderOption.count();
  expect(value, `${context}: World Jump should return to the neutral option`).toBe(neutralJumpValue);
  expect(selectedLabel, `${context}: the neutral option should be labelled ${neutralJumpLabel}`)
    .toBe(neutralJumpLabel);
  expect(placeholderCount, `${context}: World Jump should include its neutral option`).toBe(1);
  if (placeholderCount === 1) {
    expect(await placeholderOption.isDisabled(), `${context}: the neutral option should be disabled`).toBe(true);
  }
}

async function expectTargetCentered(page, target, context) {
  const [camera, viewportSize] = await Promise.all([readSceneCamera(page), readViewportSize(page)]);
  const targetCenter = {
    x: target.position.x + target.width / 2,
    y: target.position.y + target.height / 2,
  };
  const screenPoint = {
    x: camera.panX + targetCenter.x * camera.scale,
    y: camera.panY + targetCenter.y * camera.scale,
  };
  expect.soft(Math.abs(screenPoint.x - viewportSize.width / 2), `${context}: target should be centered horizontally`)
    .toBeLessThanOrEqual(1);
  expect.soft(Math.abs(screenPoint.y - viewportSize.height / 2), `${context}: target should be centered vertically`)
    .toBeLessThanOrEqual(1);
}

async function expectTargetMovedAway(page, target, context) {
  const [camera, viewportSize] = await Promise.all([readSceneCamera(page), readViewportSize(page)]);
  const center = {
    x: target.position.x + target.width / 2,
    y: target.position.y + target.height / 2,
  };
  const distance = Math.hypot(
    camera.panX + center.x * camera.scale - viewportSize.width / 2,
    camera.panY + center.y * camera.scale - viewportSize.height / 2,
  );
  expect.soft(distance, `${context}: ArrowRight should move the camera away from the target`)
    .toBeGreaterThan(80);
}

async function verifyRepeatNavigation(page, jump, viewport, target, value, context) {
  const beforeFirstJump = await readSceneCamera(page);
  await jump.selectOption(value);
  await expect.poll(() => readSceneCamera(page)).not.toEqual(beforeFirstJump);
  await expectTargetCentered(page, target, `${context} first jump`);
  await expectJumpReset(jump, `${context} after first jump`);

  await viewport.focus();
  const beforeArrow = await readSceneCamera(page);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => readSceneCamera(page)).not.toEqual(beforeArrow);
  await expectTargetMovedAway(page, target, `${context} after ArrowRight`);

  const beforeRepeat = await readSceneCamera(page);
  await jump.selectOption(value);
  await expect.poll(() => readSceneCamera(page)).not.toEqual(beforeRepeat);
  await expectTargetCentered(page, target, `${context} repeated jump`);
  await expectJumpReset(jump, `${context} after repeated jump`);
}

test('World Jump repeats the same destination and scratch-pad navigation after panning away', async ({ page }) => {
  await page.setViewportSize({ width: 3000, height: 1800 });
  const state = createNewGameState();
  state.camera = { panX: 0, panY: 0, scale: 0.4 };
  await page.addInitScript(({ key, value }) => {
    window.localStorage.clear();
    window.localStorage.setItem(key, value);
  }, { key: autoSaveKey, value: encodeSave(state) });
  await page.goto('/');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');

  const jump = page.getByTestId('world-jump');
  const viewport = page.getByTestId('world-viewport');
  await expectJumpReset(jump, 'on initial load');

  const destination = DESTINATIONS.find((entry) => entry.id === 'case-parallax-trials');
  await verifyRepeatNavigation(page, jump, viewport, destination, `destination:${destination.id}`, 'distant destination');

  await jump.selectOption('start');
  await expectJumpReset(jump, 'after choosing Starting area');
  const scratchPad = SCRATCH_PADS.find((entry) => entry.id === 'scratch-b');
  await verifyRepeatNavigation(page, jump, viewport, scratchPad, `scratchpad:${scratchPad.id}`, 'work surface');
});
