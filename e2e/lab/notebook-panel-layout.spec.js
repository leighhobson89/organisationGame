import { expect, test } from '@playwright/test';
import { COLLECTIONS, NOTEBOOK_DISCOVERIES } from '../../src/game/content/catalog.js';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { encodeSave } from '../../src/game/persistence/save.js';
import { PREFERENCES_STORAGE_KEY } from '../../src/game/preferences/preferences.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const MINIMUM_TEXT_CONTRAST = 4.5;

function parseRgb(value) {
  const components = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!components || components.length !== 3) throw new Error(`Unsupported color: ${value}`);
  return components;
}

function parseHex(value) {
  const hex = value.replace('#', '');
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

function relativeLuminance([red, green, blue]) {
  const linearize = (channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
}

function contrastRatio(first, second) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

async function seedNotebook(page, textScale = 1.5) {
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
      textScale,
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
      targetBounds: {
        left: targetRect.left,
        top: targetRect.top,
        right: targetRect.right,
        bottom: targetRect.bottom,
        width: targetRect.width,
        height: targetRect.height,
      },
      panelBounds: {
        left: panelRect.left,
        top: panelRect.top,
        right: panelRect.right,
        bottom: panelRect.bottom,
        clientWidth: panelElement.clientWidth,
        clientHeight: panelElement.clientHeight,
        scrollTop: panelElement.scrollTop,
      },
      visiblePanelBounds: { left: panelLeft, top: panelTop, right: panelRight, bottom: panelBottom },
      viewportBounds: { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight },
      hitTarget: hit ? { tagName: hit.tagName, id: hit.id, className: String(hit.className) } : null,
    };
  });

  expect(isVisible.fullyVisible, `${description} should remain fully visible inside the panel and viewport: ${JSON.stringify(isVisible)}`).toBe(true);
  expect(isVisible.hitTestable, `${description} should be hit-testable at its center: ${JSON.stringify(isVisible)}`).toBe(true);
}

async function expectFocusedHeaderControlReachable(control, description) {
  await expect(control).toBeFocused();
  const visibility = await control.evaluate((target) => {
    const rect = target.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      fullyVisible: rect.left >= -1 && rect.right <= window.innerWidth + 1
        && rect.top >= -1 && rect.bottom <= window.innerHeight + 1,
      hitTestable: hit === target || target.contains(hit),
      targetBounds: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      viewportBounds: { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight },
      hitTarget: hit ? { tagName: hit.tagName, id: hit.id, className: String(hit.className) } : null,
    };
  });

  expect(visibility.fullyVisible, `${description} should remain fully visible in the viewport: ${JSON.stringify(visibility)}`).toBe(true);
  expect(visibility.hitTestable, `${description} should be hit-testable at its center: ${JSON.stringify(visibility)}`).toBe(true);
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
  expect(layout.panelScrollsVertically, 'Notebook panel should scroll internally').toBe(true);
}

async function expectContentReachableWithinPanel(panel, element, description) {
  const targetHandle = await element.elementHandle();
  const dimensions = await element.evaluate((node) => ({
    elementHeight: node.getBoundingClientRect().height,
    panelClientHeight: node.closest('[data-testid="notebook-panel"]').clientHeight,
  }));
  const readBounds = async () => panel.evaluate((panelElement, target) => {
    const panelRect = panelElement.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const panelTop = panelRect.top + panelElement.clientTop;
    return {
      top: targetRect.top,
      bottom: targetRect.bottom,
      panelTop,
      panelBottom: panelTop + panelElement.clientHeight,
    };
  }, targetHandle);

  if (dimensions.elementHeight <= dimensions.panelClientHeight + 1) {
    await element.scrollIntoViewIfNeeded();
    const bounds = await readBounds();
    expect(bounds.top, `${description} should be reachable below the panel top edge`).toBeGreaterThanOrEqual(bounds.panelTop - 1);
    expect(bounds.bottom, `${description} should be reachable above the panel bottom edge`).toBeLessThanOrEqual(bounds.panelBottom + 1);
    return;
  }

  await panel.evaluate((panelElement, target) => {
    const panelTop = panelElement.getBoundingClientRect().top + panelElement.clientTop;
    panelElement.scrollTop += target.getBoundingClientRect().top - panelTop;
  }, targetHandle);
  const startBounds = await readBounds();
  expect(startBounds.top, `the start of ${description} should be reachable below the panel top edge`)
    .toBeGreaterThanOrEqual(startBounds.panelTop - 1);
  expect(startBounds.top, `the start of ${description} should be inside the panel scrollport`)
    .toBeLessThan(startBounds.panelBottom);

  await panel.evaluate((panelElement, target) => {
    const panelTop = panelElement.getBoundingClientRect().top + panelElement.clientTop;
    const panelBottom = panelTop + panelElement.clientHeight;
    panelElement.scrollTop += target.getBoundingClientRect().bottom - panelBottom;
  }, targetHandle);
  const endBounds = await readBounds();
  expect(endBounds.bottom, `the end of ${description} should be reachable above the panel bottom edge`)
    .toBeLessThanOrEqual(endBounds.panelBottom + 1);
  expect(endBounds.bottom, `the end of ${description} should be inside the panel scrollport`)
    .toBeGreaterThan(endBounds.panelTop);
}

test('Notebook eyebrow text meets WCAG AA contrast against the darkest parchment stop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await seedNotebook(page);
  await page.getByTestId('toggle-notebook').click();

  const eyebrow = page.locator('.notebook-panel .eyebrow').first();
  await expect(eyebrow).toBeVisible();
  const foreground = await eyebrow.evaluate((element) => getComputedStyle(element).color);
  const ratio = contrastRatio(parseRgb(foreground), parseHex('#ead9b5'));

  expect(
    ratio,
    `Notebook eyebrow foreground ${foreground} should meet ${MINIMUM_TEXT_CONTRAST}:1 contrast against parchment-200 (#ead9b5); got ${ratio.toFixed(2)}:1`,
  ).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
});

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

test('200% text scale keeps Notebook content and collection actions reachable at 320x360', async ({ page }) => {
  const viewport = { width: 320, height: 360 };
  await page.setViewportSize(viewport);
  await seedNotebook(page, 2);
  await expect(page.locator('html')).toHaveCSS('--text-scale', '2');
  await page.getByTestId('toggle-notebook').click();

  const panel = page.getByTestId('notebook-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: /Professor.*Notebook/ })).toBeVisible();
  await expect(panel.getByRole('progressbar', { name: /% of objects correctly filed/ })).toBeVisible();
  await expectNotebookPanelFits(panel, viewport);

  const toggleNotebook = page.getByTestId('toggle-notebook');
  await toggleNotebook.focus();
  await expectFocusedHeaderControlReachable(toggleNotebook, 'Notebook header control');
  await page.keyboard.press('Tab');
  const toggleSkills = page.getByTestId('toggle-skills');
  await expect(toggleSkills).toBeFocused();
  await expectFocusedHeaderControlReachable(toggleSkills, 'Skills header control');
  await page.keyboard.press('Tab');
  const openSaves = page.getByTestId('open-saves');
  await expect(openSaves).toBeFocused();
  await expectFocusedHeaderControlReachable(openSaves, 'Save & Restore header control');
  await page.keyboard.press('Tab');
  const openSettings = page.getByTestId('open-settings');
  await expect(openSettings).toBeFocused();
  await expectFocusedHeaderControlReachable(openSettings, 'Settings header control');
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
    await expect(title).toBeVisible();
    await expectContentReachableWithinPanel(panel, title, `${discovery.title} title`);
    await expect(text).toBeVisible();
    await expectContentReachableWithinPanel(panel, text, `${discovery.title} body`);
  }
});
