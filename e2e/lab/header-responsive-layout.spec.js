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
const largeTextHeaderPreferences = {
  ...scaledHeaderPreferences,
  textScale: 1.5,
};
const extraLargeTextHeaderPreferences = {
  ...scaledHeaderPreferences,
  textScale: 2,
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

async function assertScaledHeaderGeometry(page, viewport, textPercent = 125) {
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
  await assertNoOverlap(brand, nav, `scaled header brand must not overlap laboratory tools navigation at ${textPercent}% text`);
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
    await assertNoOverlap(brand, button, `scaled header brand must not overlap ${headerActions[firstIndex].testId} at ${textPercent}% text`);
    await assertNoOverlap(button, progress, `${headerActions[firstIndex].testId} must not overlap the scaled restoration summary`);

    for (let secondIndex = firstIndex + 1; secondIndex < buttons.length; secondIndex += 1) {
      await assertNoOverlap(button, buttons[secondIndex], `${headerActions[firstIndex].testId} must not overlap ${headerActions[secondIndex].testId} at scaled text`);
    }
  }
}

async function assertScaledMobileHeaderReachability(page, viewport, textPercent = 125) {
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
    expect(labelMeasurement.scrollWidth, `${action.testId} label should not be clipped at ${textPercent}%`).toBeLessThanOrEqual(labelMeasurement.clientWidth + 1);
    expect(labelMeasurement.scrollHeight, `${action.testId} label should not be clipped at ${textPercent}%`).toBeLessThanOrEqual(labelMeasurement.clientHeight + 1);
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
  for (const [textPercent, preferences] of [
    [125, scaledHeaderPreferences],
    [150, largeTextHeaderPreferences],
  ]) {
    test(`laboratory header remains readable with ${textPercent}% text at ${viewport.width}px`, async ({ page }) => {
      await loadHeaderFixture(page, viewport, preferences);
      await expect(page.locator('html')).toHaveCSS('--text-scale', String(textPercent / 100));
      await assertScaledHeaderGeometry(page, viewport, textPercent);
    });
  }
}

test('laboratory restoration summary stays complete and inside the header at 200% text', async ({ page }) => {
  const viewport = { width: 1280, height: 720 };
  await loadHeaderFixture(page, viewport, extraLargeTextHeaderPreferences);
  await expect(page.locator('html')).toHaveCSS('--text-scale', '2');

  await expect(page.getByTestId('skill-points')).toHaveText(/^3 collection rewards .*Skill points: 0$/);
  await expect(page.getByTestId('chapter-progress')).toHaveText('Research collections: 3 of 3');
  await expect(page.getByTestId('invention-stage')).toHaveText('Invention stage: Chronology Wheel');

  await assertScaledHeaderGeometry(page, viewport, 200);

  const header = page.locator('.game-header');
  const progress = page.locator('.header-progress');
  const [headerBox, progressBox] = await Promise.all([header.boundingBox(), progress.boundingBox()]);
  expect(headerBox).not.toBeNull();
  expect(progressBox).not.toBeNull();

  const summaryRows = progress.locator('small:visible');
  await expect(summaryRows).toHaveCount(4);
  for (const row of await summaryRows.all()) {
    const rowGeometry = await row.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      right: element.getBoundingClientRect().right,
    }));
    expect(rowGeometry.scrollWidth, 'each visible progress summary must fit without clipping').toBeLessThanOrEqual(rowGeometry.clientWidth);
    expect(rowGeometry.right, 'each visible progress summary must stay inside the restoration summary').toBeLessThanOrEqual(progressBox.x + progressBox.width + 1);
    expect(rowGeometry.right, 'each visible progress summary must stay inside the page header').toBeLessThanOrEqual(headerBox.x + headerBox.width + 1);
    expect(rowGeometry.right, 'each visible progress summary must stay inside the viewport').toBeLessThanOrEqual(viewport.width + 1);
  }
});

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

test('compact header exposes laboratory restoration as an accessible progressbar', async ({ page }) => {
  await loadHeaderFixture(page, { width: 390, height: 480 });

  await expect(page.locator('.header-progress > span:last-child')).toBeHidden();
  const restoration = page.getByRole('progressbar', { name: 'Laboratory restoration' });
  await expect(restoration).toBeVisible();
  await expect(restoration).toHaveAttribute('aria-valuemin', '0');
  await expect(restoration).toHaveAttribute('aria-valuemax', '100');
  const displayedPercent = Number.parseInt(await restoration.textContent(), 10);
  expect(displayedPercent, 'fixture should exercise a nonzero restoration value').toBeGreaterThan(0);
  await expect(restoration).toHaveAttribute('aria-valuenow', String(displayedPercent));
});

for (const viewport of [
  { width: 320, height: 480 },
  { width: 390, height: 480 },
]) {
  for (const [textPercent, preferences] of [[125, scaledHeaderPreferences], [150, largeTextHeaderPreferences]]) {
    test(`all mobile header controls stay reachable without clipping at ${textPercent}% text and ${viewport.width}px`, async ({ page }) => {
      await loadHeaderFixture(page, viewport, preferences);
      await expect(page.locator('html')).toHaveCSS('--text-scale', String(textPercent / 100));
      await assertScaledMobileHeaderReachability(page, viewport, textPercent);
    });
  }
}

test('standalone header keeps all tools reachable at 200% text on a 320x360 viewport', async ({ page }) => {
  const viewport = { width: 320, height: 360 };
  await loadHeaderFixture(page, viewport, extraLargeTextHeaderPreferences);
  await expect(page.locator('html')).toHaveCSS('--text-scale', '2');

  const header = page.locator('.game-header');
  const nav = page.getByRole('navigation', { name: 'Laboratory tools' });
  const buttons = await expectHeaderActions(page);
  const [headerBox, navBox, documentWidth, navMetrics] = await Promise.all([
    header.boundingBox(),
    nav.boundingBox(),
    page.evaluate(() => document.documentElement.scrollWidth),
    nav.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      overflowX: window.getComputedStyle(element).overflowX,
      scrollLeft: element.scrollLeft,
    })),
  ]);

  expect(headerBox, 'standalone header should have rendered geometry').not.toBeNull();
  expect(navBox, 'standalone navigation should have rendered geometry').not.toBeNull();
  expect(headerBox.x, 'header should begin inside the viewport').toBeGreaterThanOrEqual(0);
  expect(headerBox.x + headerBox.width, 'header should stay inside the viewport').toBeLessThanOrEqual(viewport.width);
  expect(headerBox.y, 'header should begin inside the viewport').toBeGreaterThanOrEqual(0);
  expect(headerBox.y + headerBox.height, 'header should stay inside the viewport').toBeLessThanOrEqual(viewport.height);
  expect(navBox.x, 'navigation should stay inside the viewport').toBeGreaterThanOrEqual(0);
  expect(navBox.x + navBox.width, 'navigation should stay inside the viewport').toBeLessThanOrEqual(viewport.width);
  expect(navBox.y, 'navigation should stay inside the header').toBeGreaterThanOrEqual(headerBox.y - 1);
  expect(navBox.y + navBox.height, 'navigation should stay inside the header').toBeLessThanOrEqual(headerBox.y + headerBox.height + 1);
  expect(documentWidth, 'standalone header should not create page-level horizontal overflow').toBeLessThanOrEqual(viewport.width);
  expect(navMetrics.overflowX, 'navigation should scroll horizontally for the five completed-game actions').toBe('auto');
  expect(navMetrics.scrollWidth, 'the five actions should exercise horizontal navigation scrolling').toBeGreaterThan(navMetrics.clientWidth);

  const initialScrollLeft = navMetrics.scrollLeft;
  let navigationScrolled = false;
  await page.keyboard.press('Tab');

  for (let index = 0; index < headerActions.length; index += 1) {
    const action = headerActions[index];
    const button = buttons[index];
    await expect(button, `${action.testId} should receive sequential keyboard focus`).toBeFocused();

    const [buttonBox, visibleNavBox, actionMetrics, scrollLeft] = await Promise.all([
      button.boundingBox(),
      nav.boundingBox(),
      button.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hitTarget = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        const style = window.getComputedStyle(element);
        return {
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          centerHit: hitTarget === element || element.contains(hitTarget),
          focusVisible: element.matches(':focus-visible'),
          outlineStyle: style.outlineStyle,
          outlineWidth: Number.parseFloat(style.outlineWidth),
        };
      }),
      nav.evaluate((element) => element.scrollLeft),
    ]);

    expect(buttonBox, `${action.testId} should have rendered geometry`).not.toBeNull();
    expect(buttonBox.x, `${action.testId} should remain fully visible inside the navigation`).toBeGreaterThanOrEqual(visibleNavBox.x - 1);
    expect(buttonBox.x + buttonBox.width, `${action.testId} should remain fully visible inside the navigation`)
      .toBeLessThanOrEqual(visibleNavBox.x + visibleNavBox.width + 1);
    expect(buttonBox.y, `${action.testId} should remain inside the header`).toBeGreaterThanOrEqual(headerBox.y - 1);
    expect(buttonBox.y + buttonBox.height, `${action.testId} should remain inside the header`)
      .toBeLessThanOrEqual(headerBox.y + headerBox.height + 1);
    expect(buttonBox.x, `${action.testId} should remain inside the viewport`).toBeGreaterThanOrEqual(0);
    expect(buttonBox.x + buttonBox.width, `${action.testId} should remain inside the viewport`).toBeLessThanOrEqual(viewport.width);
    expect(buttonBox.y, `${action.testId} should remain inside the viewport`).toBeGreaterThanOrEqual(0);
    expect(buttonBox.y + buttonBox.height, `${action.testId} should remain inside the viewport`).toBeLessThanOrEqual(viewport.height);
    expect(actionMetrics.scrollWidth, `${action.testId} label should not be horizontally clipped`)
      .toBeLessThanOrEqual(actionMetrics.clientWidth + 1);
    expect(actionMetrics.scrollHeight, `${action.testId} label should not be vertically clipped`)
      .toBeLessThanOrEqual(actionMetrics.clientHeight + 1);
    expect(actionMetrics.centerHit, `${action.testId} should be center hit-testable while focused`).toBe(true);
    expect(actionMetrics.focusVisible, `${action.testId} should show its keyboard focus indicator`).toBe(true);
    expect(actionMetrics.outlineStyle, `${action.testId} should have a visible keyboard outline`).not.toBe('none');
    expect(actionMetrics.outlineWidth, `${action.testId} keyboard outline should have positive width`).toBeGreaterThan(0);
    if (scrollLeft > initialScrollLeft + 1) navigationScrolled = true;

    if (index < headerActions.length - 1) await page.keyboard.press('Tab');
  }

  expect(navigationScrolled, 'keyboard traversal should scroll the navigation to later actions').toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth),
    'keyboard traversal should not create page-level horizontal overflow').toBeLessThanOrEqual(viewport.width);
});

test('default-text header controls fit at 320x360 without clipped navigation or labels', async ({ browser }) => {
  const viewport = { width: 320, height: 360 };
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:5173',
    viewport,
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('html')).toHaveCSS('--text-scale', '1');

    const defaultHeaderActions = [
      { testId: 'toggle-notebook', name: 'Notebook' },
      { testId: 'toggle-skills', name: 'Instruments' },
      { testId: 'open-saves', name: 'Save & restore' },
      { testId: 'open-settings', name: 'Settings' },
    ];
    const nav = page.getByRole('navigation', { name: 'Laboratory tools' });
    const navBox = await nav.boundingBox();
    expect(navBox, 'short mobile navigation should have rendered geometry').not.toBeNull();
    expect(navBox.x, 'short mobile navigation should stay inside the viewport').toBeGreaterThanOrEqual(0);
    expect(navBox.x + navBox.width, 'short mobile navigation should stay inside the viewport').toBeLessThanOrEqual(viewport.width);
    expect(navBox.y, 'short mobile navigation should stay inside the viewport').toBeGreaterThanOrEqual(0);
    expect(navBox.y + navBox.height, 'short mobile navigation should stay inside the viewport').toBeLessThanOrEqual(viewport.height);

    const navMeasurement = await nav.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(navMeasurement.scrollWidth, 'default-text header actions should fit without horizontal navigation clipping')
      .toBeLessThanOrEqual(navMeasurement.clientWidth);

    for (const action of defaultHeaderActions) {
      const button = page.getByTestId(action.testId);
      await expect(button).toBeVisible();
      await expect(button).toHaveAccessibleName(action.name);
      const buttonBox = await button.boundingBox();
      expect(buttonBox, `${action.testId} should have rendered geometry`).not.toBeNull();
      expect(buttonBox.x, `${action.testId} should be wholly inside the navigation`).toBeGreaterThanOrEqual(navBox.x - 1);
      expect(buttonBox.x + buttonBox.width, `${action.testId} should be wholly inside the navigation`)
        .toBeLessThanOrEqual(navBox.x + navBox.width + 1);
      expect(buttonBox.y, `${action.testId} should be wholly inside the navigation`).toBeGreaterThanOrEqual(navBox.y - 1);
      expect(buttonBox.y + buttonBox.height, `${action.testId} should be wholly inside the navigation`)
        .toBeLessThanOrEqual(navBox.y + navBox.height + 1);
      expect(buttonBox.x, `${action.testId} should be wholly inside the viewport`).toBeGreaterThanOrEqual(0);
      expect(buttonBox.x + buttonBox.width, `${action.testId} should be wholly inside the viewport`)
        .toBeLessThanOrEqual(viewport.width);
      expect(buttonBox.y, `${action.testId} should be wholly inside the viewport`).toBeGreaterThanOrEqual(0);
      expect(buttonBox.y + buttonBox.height, `${action.testId} should be wholly inside the viewport`)
        .toBeLessThanOrEqual(viewport.height);

      const labelMeasurement = await button.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      }));
      expect(labelMeasurement.scrollWidth, `${action.testId} label should not be horizontally clipped`)
        .toBeLessThanOrEqual(labelMeasurement.clientWidth);
      expect(labelMeasurement.scrollHeight, `${action.testId} label should not be vertically clipped`)
        .toBeLessThanOrEqual(labelMeasurement.clientHeight);
    }
  } finally {
    await context.close();
  }
});
