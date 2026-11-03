import { expect, test } from '@playwright/test';
import { DESTINATIONS, SCRATCH_PADS } from '../../src/game/content/catalog.js';
import { createNewGameState, normalizeGameState } from '../../src/game/persistence/gameState.js';
import { decodeSave, encodeSave } from '../../src/game/persistence/save.js';
import { getTargetSlotPosition } from '../../src/game/world/placementLayout.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const fixtureMarker = 'palimpsest-lab.aether-wayfinder-fixture-seeded';
const skillId = 'aether-wayfinder';
const defaultItemId = 'calibration-card-01';

function createWayfinderFixture({ skillPoints = 0, owned = false, placement = 'workspace', cameraScale } = {}) {
  const state = createNewGameState();
  state.progress.skillPoints = skillPoints;
  let itemId = defaultItemId;

  if (placement !== 'workspace') {
    itemId = placement === 'misfiled' ? 'blueprint-fragment-001' : defaultItemId;
    const item = state.items.find((entry) => entry.id === itemId);
    if (!item) throw new Error(`Unable to find Wayfinder fixture item ${itemId}.`);
    const targetKind = placement === 'scratchpad' ? 'scratchpad' : 'destination';
    const targetId = placement === 'scratchpad'
      ? 'scratch-a'
      : placement === 'misfiled' ? 'cabinet-calibration' : item.correctDestinationId;
    const target = targetKind === 'scratchpad'
      ? SCRATCH_PADS.find((entry) => entry.id === targetId)
      : DESTINATIONS.find((entry) => entry.id === targetId);
    const position = getTargetSlotPosition({
      target: { kind: targetKind, id: targetId },
      item,
      slotIndex: 0,
      destinations: DESTINATIONS,
      scratchPads: SCRATCH_PADS,
    });
    if (!position) throw new Error(`Unable to place ${item.id} in fixture destination ${targetId}.`);
    item.previousWorkspacePosition = { ...item.position };
    item.position = position;
    item.placement = targetKind === 'scratchpad'
      ? { kind: 'scratchpad', scratchPadId: targetId, slotIndex: 0 }
      : { kind: 'destination', destinationId: targetId, slotIndex: 0 };
  }

  const normalized = normalizeGameState(state);
  if (owned) normalized.progress.ownedSkills = [skillId];
  if (placement === 'scratchpad') {
    const pad = SCRATCH_PADS.find((entry) => entry.id === 'scratch-a');
    const scale = normalized.camera.scale;
    normalized.camera.panX = 640 - (pad.position.x + pad.width / 2) * scale;
    normalized.camera.panY = 366 - (pad.position.y + pad.height / 2) * scale;
  }
  if (cameraScale !== undefined) normalized.camera.scale = cameraScale;
  return { state: normalized, itemId };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function loadFixture(page, options = {}) {
  const { state, itemId } = createWayfinderFixture(options);
  const raw = encodeSave(state);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(({ key, value, marker }) => {
    if (window.sessionStorage.getItem(marker) === 'seeded') return;
    window.sessionStorage.setItem(marker, 'seeded');
    window.localStorage.setItem(key, value);
  }, { key: autoSaveKey, value: raw, marker: fixtureMarker });
  await page.goto('/');
  await expect(page.getByTestId('world-item-count')).toBeVisible();
  return { state, itemId };
}

async function openWayfinderCard(page) {
  await page.getByTestId('toggle-skills').click();
  const card = page.getByTestId(`skill-${skillId}`);
  await expect(card).toBeVisible();
  return card;
}

async function selectItemAndOpenWayfinder(page, itemId) {
  await page.getByTestId(`lab-item-${itemId}`).click();
  const card = await openWayfinderCard(page);
  return { card, item: page.getByTestId(`lab-item-${itemId}`) };
}

async function selectItemThroughFinder(page, itemTitle) {
  await page.getByRole('button', { name: 'Find an item', exact: true }).click();
  const finder = page.getByRole('search', { name: 'Find a laboratory item' });
  await finder.getByRole('searchbox', { name: 'Search laboratory items' }).fill(itemTitle);
  await finder.getByRole('button', { name: new RegExp(itemTitle) }).click();
}

async function assertStaticMarkerForSevenSeconds(page, activatedAt) {
  const marker = page.getByTestId('aether-wayfinder-marker');
  await expect(marker).toBeVisible();
  await expect(marker).toHaveAttribute('role', 'status');
  await expect(marker).toHaveAttribute('aria-live', 'polite');

  const longestAnimationMs = await marker.evaluate((element) => {
    const elements = [element, ...element.querySelectorAll('*')];
    const durations = elements.flatMap((entry) => {
      const styles = [window.getComputedStyle(entry), window.getComputedStyle(entry, '::before'), window.getComputedStyle(entry, '::after')];
      return styles.flatMap((style) => style.animationDuration.split(',').map((duration) => {
        const value = Number.parseFloat(duration);
        return duration.trim().endsWith('ms') ? value : value * 1000;
      }));
    });
    return Math.max(0, ...durations);
  });
  expect(longestAnimationMs, 'reduced motion should stop the Wayfinder highlight animation').toBeLessThanOrEqual(1);

  await page.waitForTimeout(Math.max(0, 6900 - (Date.now() - activatedAt)));
  await expect(marker).toBeVisible();
  await page.waitForTimeout(Math.max(0, 7200 - (Date.now() - activatedAt)));
  await expect(marker).toHaveCount(0);
}

test('Aether Wayfinder costs two points and v3 ownership survives autosave and reload', async ({ page }) => {
  await loadFixture(page, { skillPoints: 2 });
  const card = await openWayfinderCard(page);
  const purchase = card.getByTestId(`purchase-${skillId}`);
  await expect(purchase).toBeEnabled();
  await expect(purchase).toContainText(/2\s+points?/i);
  await purchase.click();
  await expect(page.getByTestId('skill-points')).toContainText('Skill points: 0');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');

  const purchased = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(purchased.progress.skillPoints).toBe(0);
  expect(purchased.progress.ownedSkills).toContain(skillId);

  await page.reload();
  await expect(page.getByTestId('recovery-notice')).toHaveCount(0);
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
  const reloaded = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(reloaded.progress.skillPoints).toBe(0);
  expect(reloaded.progress.ownedSkills).toContain(skillId);

  const restoredCard = await openWayfinderCard(page);
  await expect(restoredCard.getByTestId(`purchase-${skillId}`)).toHaveCount(0);
  await expect(restoredCard.getByTestId(`toggle-${skillId}`)).toBeVisible();
});

test('Aether Wayfinder is disabled when no item is selected', async ({ page }) => {
  await loadFixture(page, { owned: true });
  const card = await openWayfinderCard(page);
  await expect(card.getByTestId(`toggle-${skillId}`)).toBeDisabled();
});

test('Aether Wayfinder is disabled for a correctly filed selected item', async ({ page }) => {
  const { itemId } = await loadFixture(page, { owned: true, placement: 'correct' });
  const { card } = await selectItemAndOpenWayfinder(page, itemId);
  await expect(card.getByTestId(`toggle-${skillId}`)).toBeDisabled();
});

test('Aether Wayfinder is enabled for a selected loose item', async ({ page }) => {
  const { itemId } = await loadFixture(page, { owned: true, placement: 'workspace' });
  const { card } = await selectItemAndOpenWayfinder(page, itemId);
  await expect(card.getByTestId(`toggle-${skillId}`)).toBeEnabled();
});

test('Aether Wayfinder is enabled for a selected misfiled item', async ({ page }) => {
  const { itemId } = await loadFixture(page, { owned: true, placement: 'misfiled' });
  const { card, item } = await selectItemAndOpenWayfinder(page, itemId);
  await expect(item).toHaveClass(/misfiled/);
  await expect(card.getByTestId(`toggle-${skillId}`)).toBeEnabled();
});

test('Aether Wayfinder is enabled for a selected item on a scratch pad', async ({ page }) => {
  const { itemId } = await loadFixture(page, { owned: true, placement: 'scratchpad' });
  const { card, item } = await selectItemAndOpenWayfinder(page, itemId);
  await expect(item).toHaveAttribute('aria-pressed', 'true');
  await expect(card.getByTestId(`toggle-${skillId}`)).toBeEnabled();
});

test('activating Aether Wayfinder focuses the canonical destination and announces a temporary marker without changing game data', async ({ page }) => {
  const { state, itemId } = await loadFixture(page, { owned: true, placement: 'misfiled' });
  const selectedTitle = state.items.find((item) => item.id === itemId).title;
  const { card } = await selectItemAndOpenWayfinder(page, itemId);
  const activate = card.getByTestId(`toggle-${skillId}`);
  await expect(activate).toBeEnabled();
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
  const before = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  const viewport = page.getByTestId('world-viewport');
  const canonicalDestination = page.getByTestId('destination-cabinet-blueprints');

  await activate.click();
  const activatedAt = Date.now();

  const marker = page.getByTestId('aether-wayfinder-marker');
  await expect(marker).toBeVisible();
  await expect(marker).toHaveAttribute('role', 'status');
  await expect(marker).toHaveAttribute('aria-live', 'polite');
  await expect(marker).toContainText('For this item');
  await expect(marker).toHaveAccessibleName(new RegExp(`${selectedTitle}.*Blueprint Cabinet`, 'i'));
  await expect(canonicalDestination).toHaveAccessibleName(new RegExp(escapeRegex(selectedTitle), 'i'));
  await expect(canonicalDestination).toHaveAccessibleName(/Blueprint Cabinet/i);
  await expect(page.getByTestId('skill-announcer')).toHaveText('',
    'the marker live region should announce item and destination without a duplicate Wayfinder message');
  await expect.poll(async () => {
    const [viewportBox, destinationBox] = await Promise.all([viewport.boundingBox(), canonicalDestination.boundingBox()]);
    if (!viewportBox || !destinationBox) return Number.POSITIVE_INFINITY;
    const viewportCenter = { x: viewportBox.x + viewportBox.width / 2, y: viewportBox.y + viewportBox.height / 2 };
    const destinationCenter = { x: destinationBox.x + destinationBox.width / 2, y: destinationBox.y + destinationBox.height / 2 };
    return Math.hypot(viewportCenter.x - destinationCenter.x, viewportCenter.y - destinationCenter.y);
  }, 'the canonical destination should be centered in the world viewport').toBeLessThanOrEqual(8);

  await page.getByTestId('open-saves').click();
  const after = decodeSave(await page.getByTestId('save-export-string').inputValue());
  expect(after.items).toEqual(before.items,
    'wayfinding must not move, file, rotate, or validate any laboratory object');
  expect(after.progress).toEqual(before.progress,
    'wayfinding must not change skill points, collection completion, puzzle progress, or owned skills');
  await page.getByRole('button', { name: 'Close save dialog' }).click();

  await page.waitForTimeout(Math.max(0, 6900 - (Date.now() - activatedAt)));
  await expect(marker).toBeVisible();
  await page.waitForTimeout(Math.max(0, 7200 - (Date.now() - activatedAt)));
  await expect(marker).toHaveCount(0);
});

test('Aether Wayfinder keeps its marker legible at minimum zoom and the guided destination on-screen', async ({ page }) => {
  const { state, itemId } = await loadFixture(page, { owned: true, cameraScale: 0.2 });
  const selectedTitle = state.items.find((item) => item.id === itemId).title;
  const initialScale = await page.locator('.world-scene').evaluate((scene) => (
    new DOMMatrixReadOnly(window.getComputedStyle(scene).transform).a
  ));
  expect(initialScale, 'fixture should start at the minimum supported zoom').toBeCloseTo(0.2, 2);

  const { card } = await selectItemAndOpenWayfinder(page, itemId);
  await card.getByTestId(`toggle-${skillId}`).click();

  const viewport = page.getByTestId('world-viewport');
  const destination = page.getByTestId('destination-cabinet-calibration');
  const marker = page.getByTestId('aether-wayfinder-marker');
  await expect(marker).toBeVisible();
  await expect.poll(async () => (await marker.boundingBox())?.height ?? 0,
    'Wayfinder focus should enlarge the marker from the minimum-zoom view').toBeGreaterThanOrEqual(14);
  const [viewportBox, destinationBox, markerBox] = await Promise.all([
    viewport.boundingBox(),
    destination.boundingBox(),
    marker.boundingBox(),
  ]);
  expect(viewportBox, 'world viewport should have rendered bounds').not.toBeNull();
  expect(destinationBox, 'guided destination should have rendered bounds').not.toBeNull();
  expect(markerBox, 'Wayfinder marker should have rendered bounds').not.toBeNull();

  const focusedScale = await page.locator('.world-scene').evaluate((scene) => (
    new DOMMatrixReadOnly(window.getComputedStyle(scene).transform).a
  ));
  expect.soft(focusedScale, 'minimum-zoom Wayfinder focus should enlarge the view enough to read its destination').toBeGreaterThanOrEqual(0.7);
  expect.soft(markerBox.height, 'marker text and symbol should remain readable after Wayfinder focus').toBeGreaterThanOrEqual(19);
  await expect(destination).toHaveAccessibleName(new RegExp(escapeRegex(selectedTitle), 'i'));
  await expect(destination).toHaveAccessibleName(/Harmonic Calibration Folio/i);
  expect(destinationBox.x, 'guided destination should remain inside the viewport on the left').toBeGreaterThanOrEqual(viewportBox.x);
  expect(destinationBox.y, 'guided destination should remain inside the viewport at the top').toBeGreaterThanOrEqual(viewportBox.y);
  expect(destinationBox.x + destinationBox.width, 'guided destination should remain inside the viewport on the right')
    .toBeLessThanOrEqual(viewportBox.x + viewportBox.width);
  expect(destinationBox.y + destinationBox.height, 'guided destination should remain inside the viewport at the bottom')
    .toBeLessThanOrEqual(viewportBox.y + viewportBox.height);
  expect(markerBox.x, 'Wayfinder marker should remain inside the viewport on the left').toBeGreaterThanOrEqual(viewportBox.x);
  expect(markerBox.y, 'Wayfinder marker should remain inside the viewport at the top').toBeGreaterThanOrEqual(viewportBox.y);
  expect(markerBox.x + markerBox.width, 'Wayfinder marker should remain inside the viewport on the right')
    .toBeLessThanOrEqual(viewportBox.x + viewportBox.width);
  expect(markerBox.y + markerBox.height, 'Wayfinder marker should remain inside the viewport at the bottom')
    .toBeLessThanOrEqual(viewportBox.y + viewportBox.height);
});

test('the Wayfinder marker clears when the selected item changes', async ({ page }) => {
  const { itemId } = await loadFixture(page, { owned: true });
  const { card } = await selectItemAndOpenWayfinder(page, itemId);
  await card.getByTestId(`toggle-${skillId}`).click();
  const marker = page.getByTestId('aether-wayfinder-marker');
  await expect(marker).toBeVisible();

  await selectItemThroughFinder(page, 'Harmonic Calibration 02');
  await expect(page.getByTestId('lab-item-calibration-card-02')).toHaveAttribute('aria-pressed', 'true');
  await expect(marker).toHaveCount(0);
});

test('the Wayfinder marker clears when its selected item is correctly filed', async ({ page }) => {
  const { itemId } = await loadFixture(page, { owned: true });
  const { card } = await selectItemAndOpenWayfinder(page, itemId);
  const activate = card.getByTestId(`toggle-${skillId}`);
  await activate.click();
  const marker = page.getByTestId('aether-wayfinder-marker');
  await expect(marker).toBeVisible();

  await selectItemThroughFinder(page, 'Harmonic Calibration 01');
  await expect(marker).toBeVisible();
  const inspector = page.getByTestId('item-inspector');
  await inspector.getByRole('combobox', { name: 'Move to destination or work surface' }).selectOption('cabinet-calibration');
  await inspector.getByRole('button', { name: 'Move item', exact: true }).click();
  await expect(marker).toHaveCount(0);

  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
  const saved = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(saved.items.find((item) => item.id === itemId)).toMatchObject({
    placement: { kind: 'destination', destinationId: 'cabinet-calibration' },
    validation: 'correct',
  });
});

test('reduced motion suppresses the Wayfinder highlight animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { itemId } = await loadFixture(page, { owned: true });
  const { card } = await selectItemAndOpenWayfinder(page, itemId);
  await card.getByTestId(`toggle-${skillId}`).click();
  await assertStaticMarkerForSevenSeconds(page, Date.now());
});

test('the persisted Always reduce motion setting keeps the Wayfinder marker static for seven seconds', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const { itemId } = await loadFixture(page, { owned: true });

  await page.getByTestId('open-settings').click();
  await page.getByRole('checkbox', { name: 'Always reduce motion' }).check();
  await expect(page.getByTestId('settings-status')).toHaveText('Settings saved.');
  await expect(page.locator('html')).toHaveAttribute('data-user-reduced-motion', 'true');
  const persistedPreferences = await page.evaluate(() => window.localStorage.getItem('palimpsest-laboratory.preferences.v1'));
  expect(JSON.parse(persistedPreferences)).toMatchObject({ version: 1, reduceMotion: true });
  await page.getByRole('button', { name: 'Done', exact: true }).click();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-user-reduced-motion', 'true');
  const { card } = await selectItemAndOpenWayfinder(page, itemId);
  await card.getByTestId(`toggle-${skillId}`).click();
  await assertStaticMarkerForSevenSeconds(page, Date.now());
});
