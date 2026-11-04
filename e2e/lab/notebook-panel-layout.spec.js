import { expect, test } from '@playwright/test';
import { COLLECTIONS, NOTEBOOK_DISCOVERIES } from '../../src/game/content/catalog.js';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { encodeSave } from '../../src/game/persistence/save.js';
import { PREFERENCES_STORAGE_KEY } from '../../src/game/preferences/preferences.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';

async function seedNotebook(page) {
  const state = createNewGameState();
  state.notebook.discoveries = NOTEBOOK_DISCOVERIES.map((entry) => entry.id);

  await page.addInitScript(({ saveKey, saveValue, preferencesKey, preferencesValue }) => {
    window.localStorage.setItem(saveKey, saveValue);
    window.localStorage.setItem(preferencesKey, preferencesValue);
  }, {
    saveKey: autoSaveKey,
    saveValue: encodeSave(state),
    preferencesKey: PREFERENCES_STORAGE_KEY,
    preferencesValue: JSON.stringify({
      version: 1,
      textScale: 1.5,
      reduceMotion: false,
      soundEffectsEnabled: false,
    }),
  });

  await page.goto('/');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
}

async function expectFullyVisibleWithinPanel(panel, element, description) {
  await expect(element).toBeFocused();
  const isVisible = await panel.evaluate((panelElement) => {
    const target = document.activeElement;
    const panelRect = panelElement.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const panelLeft = panelRect.left + panelElement.clientLeft;
    const panelTop = panelRect.top + panelElement.clientTop;
    const panelRight = panelLeft + panelElement.clientWidth;
    const panelBottom = panelTop + panelElement.clientHeight;
    const tolerance = 1;
    const hit = document.elementFromPoint(
      targetRect.left + targetRect.width / 2,
      targetRect.top + targetRect.height / 2,
    );

    return {
      fullyVisible: targetRect.left >= Math.max(0, panelLeft) - tolerance
      && targetRect.right <= Math.min(window.innerWidth, panelRight) + tolerance
      && targetRect.top >= Math.max(0, panelTop) - tolerance
      && targetRect.bottom <= Math.min(window.innerHeight, panelBottom) + tolerance,
      hitTestable: hit === target || target.contains(hit),
    };
  });

  expect(isVisible.fullyVisible, `${description} should remain fully visible inside the panel and viewport`).toBe(true);
  expect(isVisible.hitTestable, `${description} should be hit-testable at its center`).toBe(true);
}

async function expectNotebookPanelFits(panel, viewport) {
  const layout = await panel.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const heading = element.querySelector('.panel-heading');
    const headingRect = heading.getBoundingClientRect();
    const toolbarRect = document.querySelector('.game-toolbar').getBoundingClientRect();
    const visiblePanelTop = rect.top + element.clientTop;
    const visiblePanelBottom = visiblePanelTop + element.clientHeight;

    return {
      panelInViewport: rect.left >= 0 && rect.right <= window.innerWidth
        && rect.top >= 0 && rect.bottom <= window.innerHeight,
      panelAboveToolbar: rect.bottom <= toolbarRect.top - 8,
      headingInsideVisiblePanel: headingRect.top >= visiblePanelTop
        && headingRect.bottom <= visiblePanelBottom,
      panelHasHorizontalOverflow: element.scrollWidth > element.clientWidth + 1,
      pageHasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      panelScrollsVertically: element.scrollHeight > element.clientHeight,
    };
  });

  expect(layout.panelInViewport, `Notebook panel should fit ${viewport.width}x${viewport.height}`).toBe(true);
  if (viewport.width <= 360 && viewport.height >= 360 && viewport.height <= 399) {
    expect(layout.panelAboveToolbar, 'Notebook panel should leave at least 8px above the bottom toolbar').toBe(true);
    expect(layout.headingInsideVisiblePanel, 'Notebook heading should fit inside the visible panel area').toBe(true);
  }
  expect(layout.panelHasHorizontalOverflow, 'Notebook content should not overflow horizontally').toBe(false);
  expect(layout.pageHasHorizontalOverflow, 'page should not overflow horizontally').toBe(false);
  expect(layout.panelScrollsVertically, 'Notebook panel should scroll internally at 150%').toBe(true);
}

for (const viewport of [
  { width: 320, height: 480 },
  { width: 390, height: 480 },
  { width: 320, height: 400 },
  { width: 390, height: 400 },
  { width: 320, height: 360 },
  { width: 360, height: 399 },
]) {
  test(`150% text scale keeps Notebook content and collection actions reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await seedNotebook(page);
    await expect(page.locator('html')).toHaveCSS('--text-scale', '1.5');
    await page.getByTestId('toggle-notebook').click();

    const panel = page.getByTestId('notebook-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { name: /Professor.*Notebook/ })).toBeVisible();
    await expect(panel.getByRole('progressbar', { name: /% of objects correctly filed/ })).toBeVisible();
    await expectNotebookPanelFits(panel, viewport);

    await page.getByTestId('toggle-notebook').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('toggle-skills')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('open-saves')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('open-settings')).toBeFocused();
    await page.keyboard.press('Tab');

    const firstCollectionButton = panel.getByTestId(`collection-${COLLECTIONS[0].id}`);
    await expect(firstCollectionButton).toBeFocused();
    const scrollBeforeTraversal = await panel.evaluate((element) => element.scrollTop);

    for (const [index, collection] of COLLECTIONS.entries()) {
      const collectionButton = panel.getByTestId(`collection-${collection.id}`);
      await expect(collectionButton).toBeFocused();
      await expectFullyVisibleWithinPanel(panel, collectionButton, `${collection.label} collection action`);
      if (index < COLLECTIONS.length - 1) {
        await page.keyboard.press('Tab');
        await expect(panel.getByTestId(`collection-${COLLECTIONS[index + 1].id}`)).toBeFocused();
      }
    }

    const scrollAfterTraversal = await panel.evaluate((element) => element.scrollTop);
    expect(scrollAfterTraversal, 'Tab traversal should scroll the panel to lower collections')
      .toBeGreaterThan(scrollBeforeTraversal);

    await expect(panel.getByRole('heading', { name: 'Recent discoveries' })).toBeVisible();
    for (const discovery of NOTEBOOK_DISCOVERIES) {
      const title = panel.getByText(discovery.title, { exact: true });
      const text = panel.getByText(discovery.text, { exact: true });
      await title.scrollIntoViewIfNeeded();
      await text.scrollIntoViewIfNeeded();
      await expect(title).toBeVisible();
      await expect(text).toBeVisible();
    }
  });
}
