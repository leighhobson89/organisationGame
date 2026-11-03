import { expect, test } from '@playwright/test';
import { COLLECTIONS, DESTINATIONS, PUZZLES, SCRATCH_PADS } from '../../src/game/content/catalog.js';
import { createDefaultProgress, createNewGameState, normalizeGameState } from '../../src/game/persistence/gameState.js';
import { decodeSave, encodeSave } from '../../src/game/persistence/save.js';
import { allocateTargetPlacement } from '../../src/game/world/placementLayout.js';
import { PREFERENCES_STORAGE_KEY } from '../../src/game/preferences/preferences.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';

function createAlmostCompleteFixture() {
  const fresh = createNewGameState();
  const finalItem = fresh.items.find((item) => !item.collectionId);
  const placedItems = [];

  for (const item of fresh.items) {
    if (item.id === finalItem.id) continue;
    const allocation = allocateTargetPlacement({
      target: { kind: 'destination', id: item.correctDestinationId },
      item,
      items: placedItems,
      destinations: DESTINATIONS,
      scratchPads: SCRATCH_PADS,
    });
    if (!allocation.ok) throw new Error(`Could not prepare ${item.id}: ${allocation.reason}`);
    placedItems.push({
      ...item,
      position: allocation.position,
      placement: allocation.placement,
      rotation: 0,
      validation: 'correct',
    });
  }

  const placedById = new Map(placedItems.map((item) => [item.id, item]));
  const state = normalizeGameState({
    ...fresh,
    items: fresh.items.map((item) => placedById.get(item.id) ?? item),
    progress: {
      ...createDefaultProgress(),
      skillPoints: 2,
      completedCollectionIds: COLLECTIONS.map((collection) => collection.id),
      unlockedPuzzleIds: PUZZLES.map((puzzle) => puzzle.id),
      solvedPuzzleIds: PUZZLES.map((puzzle) => puzzle.id),
      ownedSkills: ['resonance-lens', 'missing-member-compass'],
    },
    camera: { panX: 0, panY: 0, scale: 0.2 },
    inventionStage: 'Chronology Wheel',
    notebook: {
      discoveries: [
        'memory-impression-01',
        'discovery-bell-before-dawn',
        'discovery-meridian-survey',
        'discovery-parallax-trials',
        'discovery-chronology-last-bell',
      ],
    },
  });

  return { encodedSave: encodeSave(state), finalItem };
}

async function loadAlmostCompleteSave(page, fixture) {
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: autoSaveKey,
    value: fixture.encodedSave,
  });
  await page.goto('/');
}

async function completeLastItem(page, item) {
  await page.getByRole('button', { name: 'Find an item' }).click();
  const search = page.getByRole('searchbox', { name: 'Search laboratory items' });
  await search.fill(item.title);
  const result = page.getByTestId(`item-finder-result-${item.id}`);
  await result.focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('move-target').selectOption(item.correctDestinationId);
  await page.getByTestId('move-item').click();
}

test('settings persist the selected text size separately from game saves and restore focus on Escape', async ({ page }) => {
  await page.goto('/');

  const settingsButton = page.getByRole('button', { name: 'Settings', exact: true });
  await settingsButton.click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings).toBeVisible();

  const textSize = page.getByLabel('Text size');
  expect(await textSize.locator('option').evaluateAll((options) => options.map((option) => option.value)))
    .toEqual(['1', '1.125', '1.25']);
  const baselineFontSizes = await page.evaluate(() => ({
    root: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
    body: Number.parseFloat(getComputedStyle(document.body).fontSize),
  }));
  await textSize.selectOption('1.25');
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim()))
    .toBe('1.25');
  const scaledFontSizes = await page.evaluate(() => ({
    root: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
    body: Number.parseFloat(getComputedStyle(document.body).fontSize),
  }));
  expect(scaledFontSizes.root).toBeCloseTo(baselineFontSizes.root * 1.25, 1);
  expect(scaledFontSizes.body).toBeCloseTo(baselineFontSizes.body * 1.25, 1);
  await page.getByRole('checkbox', { name: 'Always reduce motion' }).check();

  const storedPreferences = await page.evaluate((key) => window.localStorage.getItem(key), PREFERENCES_STORAGE_KEY);
  expect(JSON.parse(storedPreferences)).toEqual({
    version: 1,
    textScale: 1.25,
    reduceMotion: true,
    soundEffectsEnabled: false,
  });

  await page.keyboard.press('Escape');
  await expect(settings).toHaveCount(0);
  await expect(settingsButton).toBeFocused();

  await page.reload();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim()))
    .toBe('1.25');
  await settingsButton.click();
  await expect(page.getByLabel('Text size')).toHaveValue('1.25');
  await expect(page.getByRole('checkbox', { name: 'Always reduce motion' })).toBeChecked();
  await page.keyboard.press('Escape');

  await page.getByTestId('open-saves').click();
  const savedGame = decodeSave(await page.getByTestId('save-export-string').inputValue());
  expect(savedGame).not.toHaveProperty('preferences');
  expect(savedGame).not.toHaveProperty('textScale');
  expect(savedGame).not.toHaveProperty('reduceMotion');
  expect(savedGame).not.toHaveProperty('soundEffectsEnabled');
  expect(JSON.stringify(savedGame)).not.toMatch(/textScale|reduceMotion|soundEffectsEnabled/);
});

test('Settings recovers Tab focus when focus moves outside the dialog', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();

  const settings = page.getByRole('dialog', { name: 'Settings' });
  const firstControl = settings.getByRole('button', { name: /close settings/i });
  const lastControl = settings.getByRole('button', { name: 'Done', exact: true });
  const outsideControl = page.getByTestId('open-saves');

  await outsideControl.focus();
  await page.keyboard.press('Tab');
  await expect(firstControl).toBeFocused();

  await outsideControl.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(lastControl).toBeFocused();
});

test('Settings controls and the close action stay usable at 390×480 with 125% text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 480 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Settings' });
  const textSize = page.getByLabel('Text size');
  const reduceMotion = page.getByRole('checkbox', { name: 'Always reduce motion' });
  const closeButton = dialog.getByRole('button', { name: /close/i });
  await textSize.selectOption('1.25');
  await expect(textSize).toBeVisible();
  await expect(reduceMotion).toBeVisible();
  await expect(closeButton).toBeVisible();

  const boxes = await Promise.all([dialog.boundingBox(), textSize.boundingBox(), reduceMotion.boundingBox(), closeButton.boundingBox()]);
  expect(boxes.every(Boolean)).toBe(true);
  for (const box of boxes) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height).toBeLessThanOrEqual(480);
  }
  expect(await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))).toEqual({ x: 0, y: 0 });
  await closeButton.click();
  await expect(dialog).toHaveCount(0);
});

test('Always reduce motion makes the ending reduced when the OS has no motion preference', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const fixture = createAlmostCompleteFixture();
  await loadAlmostCompleteSave(page, fixture);

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Always reduce motion' }).check();
  await page.keyboard.press('Escape');
  await completeLastItem(page, fixture.finalItem);

  await expect(page.getByTestId('completion-sequence')).toHaveAttribute('data-motion', 'reduced');
});

test('the OS reduced-motion setting is honored when Always reduce motion is off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const fixture = createAlmostCompleteFixture();
  await loadAlmostCompleteSave(page, fixture);

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Always reduce motion' })).not.toBeChecked();
  await page.keyboard.press('Escape');
  await completeLastItem(page, fixture.finalItem);

  await expect(page.getByTestId('completion-sequence')).toHaveAttribute('data-motion', 'reduced');
});

test('a live OS reduced-motion change updates the open ending when the user option is off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const fixture = createAlmostCompleteFixture();
  await loadAlmostCompleteSave(page, fixture);

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Always reduce motion' })).not.toBeChecked();
  await page.keyboard.press('Escape');
  await completeLastItem(page, fixture.finalItem);

  const ending = page.getByTestId('completion-sequence');
  await expect(ending).toHaveAttribute('data-motion', 'full');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(ending).toHaveAttribute('data-motion', 'reduced');
});
