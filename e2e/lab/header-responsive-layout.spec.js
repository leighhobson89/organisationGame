import { expect, test } from '@playwright/test';
import { CHAPTER_COLLECTION_IDS, COLLECTIONS, DESTINATIONS, SCRATCH_PADS } from '../../src/game/content/catalog.js';
import { createNewGameState, normalizeGameState } from '../../src/game/persistence/gameState.js';
import { PREFERENCES_STORAGE_KEY } from '../../src/game/preferences/preferences.js';
import { encodeSave } from '../../src/game/persistence/save.js';
import { getTargetSlotPosition } from '../../src/game/world/placementLayout.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const scaledHeaderPreferences = {
  version: 1,
  textScale: 1.25,
  reduceMotion: false,
  soundEffectsEnabled: false,
};
const puzzleButtonName = /Chronology of the Last Bell.*solved/i;
const headerActions = [
  { testId: 'toggle-notebook', name: 'Notebook' },
  { testId: 'toggle-skills', name: 'Instruments' },
  { testId: 'open-puzzle', name: puzzleButtonName },
  { testId: 'open-saves', name: 'Save & restore' },
  { testId: 'open-settings', name: 'Settings' },
];

function createHeaderFixture() {
  const state = createNewGameState();

  for (const collection of COLLECTIONS.filter((entry) => CHAPTER_COLLECTION_IDS.includes(entry.id))) {
    collection.itemIds.forEach((itemId, slotIndex) => {
      const item = state.items.find((entry) => entry.id === itemId);
      if (!item) throw new Error(`Unable to find chapter item ${itemId}.`);

      const position = getTargetSlotPosition({
        target: { kind: 'destination', id: collection.destinationId },
        item,
        slotIndex,
        destinations: DESTINATIONS,
        scratchPads: SCRATCH_PADS,
      });
      if (!position) throw new Error(`Unable to place ${item.id} in ${collection.destinationId}.`);

      item.position = position;
      item.placement = { kind: 'destination', destinationId: collection.destinationId, slotIndex };
      item.validation = 'correct';
    });
  }

  state.progress.completedCollectionIds = [...CHAPTER_COLLECTION_IDS];
  state.progress.unlockedPuzzleIds = ['chronology-last-bell'];
  state.progress.solvedPuzzleIds = ['chronology-last-bell'];
  state.inventionStage = 'Chronology Wheel';

  return encodeSave(normalizeGameState(state));
}

async function loadHeaderFixture(page, viewport, preferences = null) {
  await page.setViewportSize(viewport);
  await page.addInitScript(({ key, value, preferencesKey, storedPreferences }) => {
    window.localStorage.setItem(key, value);
    if (storedPreferences) window.localStorage.setItem(preferencesKey, JSON.stringify(storedPreferences));
  }, {
    key: autoSaveKey,
    value: createHeaderFixture(),
    preferencesKey: PREFERENCES_STORAGE_KEY,
    storedPreferences: preferences,
  });
  await page.goto('/');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
}

async function expectHeaderActions(page) {
  const buttons = [];
  for (const action of headerActions) {
    const button = page.getByTestId(action.testId);
    await expect(button).toBeVisible();
    await expect(button).toHaveAccessibleName(action.name);
    buttons.push(button);
  }
  return buttons;
}

async function assertNoOverlap(left, right, description) {
  const [leftBox, rightBox] = await Promise.all([left.boundingBox(), right.boundingBox()]);
  expect(leftBox, `${description}: first element should have geometry`).not.toBeNull();
  expect(rightBox, `${description}: second element should have geometry`).not.toBeNull();

  const overlaps = leftBox.x < rightBox.x + rightBox.width
    && leftBox.x + leftBox.width > rightBox.x
    && leftBox.y < rightBox.y + rightBox.height
    && leftBox.y + leftBox.height > rightBox.y;
  expect(overlaps, description).toBe(false);
}

async function assertScaledHeaderGeometry(page, viewport) {
  const header = page.locator('.game-header');
  const brand = page.locator('.game-brand');
  const progress = page.locator('.header-progress');
  const nav = page.getByRole('navigation', { name: 'Laboratory tools' });
  const buttons = await expectHeaderActions(page);
  const [headerBox, navBox] = await Promise.all([header.boundingBox(), nav.boundingBox()]);

  expect(headerBox, 'scaled page header should have rendered geometry').not.toBeNull();
  expect(navBox, 'scaled header action row should have rendered geometry').not.toBeNull();
  expect(headerBox.x).toBeGreaterThanOrEqual(0);
  expect(headerBox.x + headerBox.width).toBeLessThanOrEqual(viewport.width);
  expect(navBox.x, 'scaled header action row should stay inside the viewport').toBeGreaterThanOrEqual(0);
  expect(navBox.x + navBox.width, 'scaled header action row should stay inside the viewport').toBeLessThanOrEqual(viewport.width);
  expect(navBox.y, 'scaled header action row should stay inside the header').toBeGreaterThanOrEqual(headerBox.y);
  expect(navBox.y + navBox.height, 'scaled header action row should stay inside the header').toBeLessThanOrEqual(headerBox.y + headerBox.height);

  const navMeasurement = await nav.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(navMeasurement.scrollWidth, 'scaled header actions should not be clipped by the nav').toBeLessThanOrEqual(navMeasurement.clientWidth);
  await assertNoOverlap(brand, progress, 'scaled brand and restoration summary must not overlap');

  for (let firstIndex = 0; firstIndex < buttons.length; firstIndex += 1) {
    const button = buttons[firstIndex];
    const buttonBox = await button.boundingBox();
    expect(buttonBox, 'scaled header action should have rendered geometry').not.toBeNull();
    expect(buttonBox.x, 'scaled header action should stay inside the viewport').toBeGreaterThanOrEqual(0);
    expect(buttonBox.x + buttonBox.width, 'scaled header action should stay inside the viewport').toBeLessThanOrEqual(viewport.width);
    expect(buttonBox.y, 'scaled header action should stay inside the header').toBeGreaterThanOrEqual(headerBox.y);
    expect(buttonBox.y + buttonBox.height, 'scaled header action should stay inside the header').toBeLessThanOrEqual(headerBox.y + headerBox.height);

    const labelMeasurement = await button.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(labelMeasurement.scrollWidth, 'scaled header action label should be fully visible').toBeLessThanOrEqual(labelMeasurement.clientWidth);
    await assertNoOverlap(button, progress, `${headerActions[firstIndex].testId} must not overlap the scaled restoration summary`);

    for (let secondIndex = firstIndex + 1; secondIndex < buttons.length; secondIndex += 1) {
      await assertNoOverlap(button, buttons[secondIndex], `${headerActions[firstIndex].testId} must not overlap ${headerActions[secondIndex].testId} at scaled text`);
    }
  }
}

async function assertScaledMobileHeaderReachability(page, viewport) {
  const header = page.locator('.game-header');
  const nav = page.getByRole('navigation', { name: 'Laboratory tools' });
  const headerBox = await header.boundingBox();
  const navBox = await nav.boundingBox();

  expect(headerBox, 'scaled mobile header should have rendered geometry').not.toBeNull();
  expect(navBox, 'scaled mobile navigation should have rendered geometry').not.toBeNull();
  expect(headerBox.x).toBeGreaterThanOrEqual(0);
  expect(headerBox.x + headerBox.width).toBeLessThanOrEqual(viewport.width);
  expect(navBox.x).toBeGreaterThanOrEqual(0);
  expect(navBox.x + navBox.width).toBeLessThanOrEqual(viewport.width);

  const navSettings = await nav.evaluate((element) => ({
    overflowX: window.getComputedStyle(element).overflowX,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(navSettings.overflowX, 'scaled mobile actions should remain reachable through the horizontal navigation row').toBe('auto');
  expect(navSettings.scrollWidth).toBeGreaterThanOrEqual(navSettings.clientWidth);

  for (const action of headerActions) {
    const button = page.getByTestId(action.testId);
    await expect(button).toBeVisible();
    await expect(button).toHaveAccessibleName(action.name);
    await button.scrollIntoViewIfNeeded();

    const [buttonBox, visibleNavBox, labelMeasurement] = await Promise.all([
      button.boundingBox(),
      nav.boundingBox(),
      button.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      })),
    ]);
    expect(buttonBox, `${action.testId} should have rendered geometry`).not.toBeNull();
    expect(buttonBox.x, `${action.testId} should be reachable within the viewport`).toBeGreaterThanOrEqual(visibleNavBox.x - 1);
    expect(buttonBox.x + buttonBox.width, `${action.testId} should be reachable within the viewport`).toBeLessThanOrEqual(visibleNavBox.x + visibleNavBox.width + 1);
    expect(buttonBox.y, `${action.testId} should stay inside the header`).toBeGreaterThanOrEqual(headerBox.y - 1);
    expect(buttonBox.y + buttonBox.height, `${action.testId} should stay inside the viewport`).toBeLessThanOrEqual(viewport.height + 1);
    expect(labelMeasurement.scrollWidth, `${action.testId} label should not be clipped at 125%`).toBeLessThanOrEqual(labelMeasurement.clientWidth + 1);
    expect(labelMeasurement.scrollHeight, `${action.testId} label should not be clipped at 125%`).toBeLessThanOrEqual(labelMeasurement.clientHeight + 1);
  }
}

for (const viewport of [
  { width: 721, height: 800 },
  { width: 1084, height: 827 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1281, height: 800 },
  { width: 1320, height: 800 },
  { width: 1321, height: 800 },
  { width: 1340, height: 800 },
  { width: 1341, height: 800 },
  { width: 1440, height: 900 },
]) {
  test(`laboratory header controls reflow without clipping at ${viewport.width}px`, async ({ page }) => {
    await loadHeaderFixture(page, viewport);

    const header = page.locator('.game-header');
    const brand = page.locator('.game-brand');
    const progress = page.locator('.header-progress');
    const nav = page.getByRole('navigation', { name: 'Laboratory tools' });
    const buttons = await expectHeaderActions(page);

    const headerBox = await header.boundingBox();
    expect(headerBox, 'page header should have rendered geometry').not.toBeNull();
    expect(headerBox.x).toBeGreaterThanOrEqual(0);
    expect(headerBox.x + headerBox.width).toBeLessThanOrEqual(viewport.width);

    const navMeasurement = await nav.evaluate((element) => ({
      left: element.getBoundingClientRect().left,
      right: element.getBoundingClientRect().right,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(navMeasurement.left, 'header action row should stay inside the viewport').toBeGreaterThanOrEqual(0);
    expect(navMeasurement.right, 'header action row should stay inside the viewport').toBeLessThanOrEqual(viewport.width);
    expect(navMeasurement.scrollWidth, 'all header actions should be visible without horizontal clipping').toBeLessThanOrEqual(navMeasurement.clientWidth);

    const progressBox = await progress.boundingBox();
    for (let firstIndex = 0; firstIndex < buttons.length; firstIndex += 1) {
      const firstBox = await buttons[firstIndex].boundingBox();
      expect(firstBox, 'header action should have rendered geometry').not.toBeNull();
      expect(firstBox.x, 'header action should stay inside the viewport').toBeGreaterThanOrEqual(0);
      expect(firstBox.x + firstBox.width, 'header action should stay inside the viewport').toBeLessThanOrEqual(viewport.width);
      expect(firstBox.y, 'header action should stay inside the header').toBeGreaterThanOrEqual(headerBox.y);
      expect(firstBox.y + firstBox.height, 'header action should stay inside the header').toBeLessThanOrEqual(headerBox.y + headerBox.height);

      const textMeasurement = await buttons[firstIndex].evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(textMeasurement.scrollWidth, 'header action label should not be clipped').toBeLessThanOrEqual(textMeasurement.clientWidth);

      if (firstIndex === 0) await assertNoOverlap(brand, progress, 'brand and restoration summary must not overlap');
      await assertNoOverlap(buttons[firstIndex], progress, `${headerActions[firstIndex].testId} must not overlap the restoration summary`);

      for (let secondIndex = firstIndex + 1; secondIndex < buttons.length; secondIndex += 1) {
        await assertNoOverlap(buttons[firstIndex], buttons[secondIndex], `${headerActions[firstIndex].testId} must not overlap ${headerActions[secondIndex].testId}`);
      }
    }

    if (viewport.width === 1341 || viewport.width === 1440) {
      const navBox = await nav.boundingBox();
      expect(Math.abs(navBox.y + navBox.height / 2 - (progressBox.y + progressBox.height / 2)),
        'wide desktop navigation should remain aligned in the existing single header row').toBeLessThanOrEqual(2);
    }
  });
}

for (const viewport of [
  { width: 1341, height: 900 },
  { width: 1440, height: 900 },
]) {
  test(`laboratory header remains readable with 125% text at ${viewport.width}px`, async ({ page }) => {
    await loadHeaderFixture(page, viewport, scaledHeaderPreferences);
    await expect(page.locator('html')).toHaveCSS('--text-scale', '1.25');
    await assertScaledHeaderGeometry(page, viewport);
  });
}

test('mobile laboratory header keeps all tools accessible in the existing scrollable row', async ({ page }) => {
  const viewport = { width: 390, height: 844 };
  await loadHeaderFixture(page, viewport);

  const header = page.locator('.game-header');
  const nav = page.getByRole('navigation', { name: 'Laboratory tools' });
  const headerBox = await header.boundingBox();
  const navBox = await nav.boundingBox();
  expect(headerBox, 'mobile header should have rendered geometry').not.toBeNull();
  expect(navBox, 'mobile navigation should have rendered geometry').not.toBeNull();
  expect(headerBox.x).toBeGreaterThanOrEqual(0);
  expect(headerBox.x + headerBox.width).toBeLessThanOrEqual(viewport.width);
  expect(navBox.x).toBeGreaterThanOrEqual(0);
  expect(navBox.x + navBox.width).toBeLessThanOrEqual(viewport.width);

  const navMeasurement = await nav.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: window.getComputedStyle(element).overflowX,
  }));
  expect(navMeasurement.overflowX, 'mobile navigation should preserve horizontal scrolling when needed').toBe('auto');
  expect(navMeasurement.scrollWidth, 'mobile navigation content should fit or remain horizontally scrollable').toBeGreaterThanOrEqual(navMeasurement.clientWidth);
  await expectHeaderActions(page);
});

for (const viewport of [
  { width: 320, height: 480 },
  { width: 390, height: 480 },
]) {
  test(`all mobile header controls stay reachable without clipping at 125% text and ${viewport.width}px`, async ({ page }) => {
    await loadHeaderFixture(page, viewport, scaledHeaderPreferences);
    await expect(page.locator('html')).toHaveCSS('--text-scale', '1.25');
    await assertScaledMobileHeaderReachability(page, viewport);
  });
}
