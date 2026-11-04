import { expect, test } from '@playwright/test';
import { CHAPTER_COLLECTION_IDS, COLLECTIONS, DESTINATIONS, PUZZLES, SCRATCH_PADS } from '../../src/game/content/catalog.js';
import { createNewGameState, normalizeGameState } from '../../src/game/persistence/gameState.js';
import { encodeSave } from '../../src/game/persistence/save.js';
import { PREFERENCES_STORAGE_KEY } from '../../src/game/preferences/preferences.js';
import { getTargetSlotPosition } from '../../src/game/world/placementLayout.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const chronology = PUZZLES.find((puzzle) => puzzle.id === 'chronology-last-bell');

function createChronologyFixture() {
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
  state.progress.unlockedPuzzleIds = [chronology.id];
  state.inventionStage = 'Memory Crystal';

  return encodeSave(normalizeGameState(state));
}

async function seedChronology(page) {
  await page.addInitScript(({ saveKey, saveValue, preferencesKey, preferencesValue }) => {
    window.localStorage.setItem(saveKey, saveValue);
    window.localStorage.setItem(preferencesKey, preferencesValue);
  }, {
    saveKey: autoSaveKey,
    saveValue: createChronologyFixture(),
    preferencesKey: PREFERENCES_STORAGE_KEY,
    preferencesValue: JSON.stringify({
      version: 1,
      textScale: 1.5,
      reduceMotion: false,
      soundEffectsEnabled: false,
    }),
  });

  await page.goto('/');
  await expect(page.locator('html')).toHaveCSS('--text-scale', '1.5');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
}

async function expectPuzzlePanelFits(panel, viewport) {
  const layout = await panel.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      panelInViewport: rect.left >= 0 && rect.right <= window.innerWidth
        && rect.top >= 0 && rect.bottom <= window.innerHeight,
      panelHasHorizontalOverflow: element.scrollWidth > element.clientWidth + 1,
      pageHasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      panelScrollsVertically: element.scrollHeight > element.clientHeight,
    };
  });

  expect(layout.panelInViewport, `Chronology panel should fit ${viewport.width}x${viewport.height}`).toBe(true);
  expect(layout.panelHasHorizontalOverflow, 'Chronology content should not overflow horizontally').toBe(false);
  expect(layout.pageHasHorizontalOverflow, 'page should not overflow horizontally').toBe(false);
  expect(layout.panelScrollsVertically, 'Chronology panel should scroll internally at 150%').toBe(true);
}

async function expectToolbarAvailableBesidePanel(panel, page) {
  const geometry = await panel.evaluate((element) => {
    const toolbar = document.querySelector('.game-toolbar');
    const panelRect = element.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    const overlaps = panelRect.left < toolbarRect.right && panelRect.right > toolbarRect.left
      && panelRect.top < toolbarRect.bottom && panelRect.bottom > toolbarRect.top;
    return {
      panel: { left: panelRect.left, top: panelRect.top, right: panelRect.right, bottom: panelRect.bottom },
      toolbar: { left: toolbarRect.left, top: toolbarRect.top, right: toolbarRect.right, bottom: toolbarRect.bottom },
      clearance: toolbarRect.top - panelRect.bottom,
      overlaps,
    };
  });

  expect.soft(geometry.clearance, `Chronology panel should leave at least 10px above the toolbar: ${JSON.stringify(geometry)}`)
    .toBeGreaterThanOrEqual(10);
  expect.soft(geometry.overlaps, `Chronology panel should not overlap the toolbar: ${JSON.stringify(geometry)}`).toBe(false);

  const toolbar = page.getByRole('group', { name: 'World navigation controls' });
  await expect(toolbar).toBeVisible();
  const controls = toolbar.locator('button:visible, select:visible, input:visible');
  const controlCount = await controls.count();
  expect(controlCount, 'toolbar should expose keyboard-focusable controls').toBeGreaterThan(0);

  await controls.first().focus();
  for (let index = 0; index < controlCount; index += 1) {
    const control = controls.nth(index);
    if (index > 0) await page.keyboard.press('Tab');
    await expect(control, `toolbar control ${index + 1} should be keyboard reachable`).toBeFocused();
    const hitTestable = await control.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit === element || element.contains(hit);
    });
    expect(hitTestable, `toolbar control ${index + 1} should be hit-testable at its center`).toBe(true);
  }
}

async function expectFocusedControlReachable(panel, control, description) {
  await control.focus();
  await expect(control).toBeFocused();
  const visibility = await panel.evaluate((element) => {
    const target = document.activeElement;
    const panelRect = element.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const panelLeft = panelRect.left + element.clientLeft;
    const panelTop = panelRect.top + element.clientTop;
    const panelRight = panelLeft + element.clientWidth;
    const panelBottom = panelTop + element.clientHeight;
    const hit = document.elementFromPoint(
      targetRect.left + targetRect.width / 2,
      targetRect.top + targetRect.height / 2,
    );

    return {
      fullyVisible: targetRect.left >= Math.max(0, panelLeft) - 1
        && targetRect.right <= Math.min(window.innerWidth, panelRight) + 1
        && targetRect.top >= Math.max(0, panelTop) - 1
        && targetRect.bottom <= Math.min(window.innerHeight, panelBottom) + 1,
      hitTestable: hit === target || target.contains(hit),
      targetBounds: { left: targetRect.left, right: targetRect.right, top: targetRect.top, bottom: targetRect.bottom },
      panelBounds: { left: panelLeft, right: panelRight, top: panelTop, bottom: panelBottom },
    };
  });

  expect(visibility.fullyVisible, `${description} should be fully visible inside the panel and viewport: ${JSON.stringify(visibility)}`).toBe(true);
  expect(visibility.hitTestable, `${description} should be hit-testable at its center`).toBe(true);
}

async function expectWithinPanelViewport(panel, target, description) {
  const visibility = await panel.evaluate((element, targetElement) => {
    const panelRect = element.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const left = panelRect.left + element.clientLeft;
    const top = panelRect.top + element.clientTop;
    const right = left + element.clientWidth;
    const bottom = top + element.clientHeight;
    return {
      fullyVisible: targetRect.left >= Math.max(0, left) - 1
      && targetRect.right <= Math.min(window.innerWidth, right) + 1
      && targetRect.top >= Math.max(0, top) - 1
      && targetRect.bottom <= Math.min(window.innerHeight, bottom) + 1,
      target: { left: targetRect.left, top: targetRect.top, right: targetRect.right, bottom: targetRect.bottom },
      panel: { left, top, right, bottom, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, scrollTop: element.scrollTop },
    };
  }, await target.elementHandle());

  expect(visibility.fullyVisible, `${description} should be visible inside the panel and viewport: ${JSON.stringify(visibility)}`).toBe(true);
}

for (const viewport of [{ width: 320, height: 360 }, { width: 320, height: 400 }, { width: 390, height: 400 }]) {
  test(`150% text keeps Chronology Puzzle controls reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await seedChronology(page);
    await page.getByTestId('open-puzzle').click();

    const panel = page.getByTestId('chronology-puzzle-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { name: chronology.title })).toBeVisible();
    await expectPuzzlePanelFits(panel, viewport);
    if (viewport.width === 320 && viewport.height === 360) {
      await expectToolbarAvailableBesidePanel(panel, page);
    }

    const close = panel.getByRole('button', { name: 'Close puzzle panel' });
    await expectFocusedControlReachable(panel, close, 'Close puzzle panel');
    await close.click();
    await expect(panel).toHaveCount(0);
    await page.getByTestId('open-puzzle').click();
    await expect(panel).toBeVisible();

    const panelScrollTopBeforeTraversal = await panel.evaluate((element) => element.scrollTop);
    await panel.getByRole('button', { name: 'Close puzzle panel' }).focus();
    for (const event of chronology.events) {
      const eventButton = panel.getByTestId(`chronology-event-${event.id}`);
      await page.keyboard.press('Tab');
      await expect(eventButton).toBeFocused();
      await expectFocusedControlReachable(panel, eventButton, `${event.label} event choice`);
      await expect(eventButton).toHaveAccessibleDescription(event.evidence);
    }

    const undo = panel.getByRole('button', { name: 'Undo last event' });
    await page.keyboard.press('Tab');
    await expect(undo).toBeFocused();
    await expectFocusedControlReachable(panel, undo, 'Undo last event');

    const clear = panel.getByRole('button', { name: 'Clear timeline' });
    await page.keyboard.press('Tab');
    await expect(clear).toBeFocused();
    await expectFocusedControlReachable(panel, clear, 'Clear timeline');
    const panelScrollTopAfterTraversal = await panel.evaluate((element) => element.scrollTop);
    expect(panelScrollTopAfterTraversal, 'keyboard traversal should scroll to the lower Chronology controls')
      .toBeGreaterThan(panelScrollTopBeforeTraversal);

    for (const eventId of chronology.solution) {
      const eventButton = panel.getByTestId(`chronology-event-${eventId}`);
      await expectFocusedControlReachable(panel, eventButton, `${eventId} event choice`);
      await eventButton.click();
    }

    const submit = panel.getByRole('button', { name: 'Submit chronology' });
    await expect(submit).toBeEnabled();
    await clear.focus();
    await page.keyboard.press('Tab');
    await expect(submit).toBeFocused();
    await expectFocusedControlReachable(panel, submit, 'Submit chronology');
    await submit.click();

    const result = panel.getByTestId('puzzle-result');
    await expect(result).toHaveAttribute('role', 'status');
    await expect(result).toContainText(/dates align.*Chronology Wheel/i);
    await result.scrollIntoViewIfNeeded();
    await expect(result).toBeVisible();
    await expect(page.getByTestId('invention-stage')).toContainText('Chronology Wheel');
    await expect(page.getByTestId('open-puzzle')).toContainText(/solved/i);
    await expectWithinPanelViewport(panel, result, 'Chronology completion status');
  });
}
