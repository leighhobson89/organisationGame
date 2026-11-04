import { expect, test } from '@playwright/test';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { encodeSave } from '../../src/game/persistence/save.js';
import { PREFERENCES_STORAGE_KEY } from '../../src/game/preferences/preferences.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';

async function seedGame(page) {
  const state = createNewGameState();
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
  await page.getByRole('button', { name: 'Find an item', exact: true }).click();
  return state;
}

async function expectFocusVisibleInFinder(finder, control, description, innerScrollport = null) {
  await expect(control).toBeFocused();
  const geometry = await control.evaluate((element, innerSelector) => {
    const panel = element.closest('.world-item-finder');
    const panelRect = panel.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const panelLeft = panelRect.left + panel.clientLeft;
    const panelTop = panelRect.top + panel.clientTop;
    const panelRight = panelLeft + panel.clientWidth;
    const panelBottom = panelTop + panel.clientHeight;
    const tolerance = 1;
    const inside = (rect, left, top, right, bottom) => rect.left >= Math.max(0, left) - tolerance
      && rect.right <= Math.min(window.innerWidth, right) + tolerance
      && rect.top >= Math.max(0, top) - tolerance
      && rect.bottom <= Math.min(window.innerHeight, bottom) + tolerance;
    const inner = innerSelector ? element.closest(innerSelector) : null;
    const innerRect = inner?.getBoundingClientRect();
    const resultList = panel.querySelector('.item-finder-results');
    const resultRect = resultList?.getBoundingClientRect();
    const centerX = elementRect.left + elementRect.width / 2;
    const centerY = elementRect.top + elementRect.height / 2;
    const hitElement = document.elementFromPoint(centerX, centerY);
    const worldHint = document.querySelector('.world-hint');
    const worldHintRect = worldHint?.getBoundingClientRect();
    const rectDetails = (rect) => rect && ({
      left: Number(rect.left.toFixed(2)),
      top: Number(rect.top.toFixed(2)),
      right: Number(rect.right.toFixed(2)),
      bottom: Number(rect.bottom.toFixed(2)),
      width: Number(rect.width.toFixed(2)),
      height: Number(rect.height.toFixed(2)),
    });
    const hitDescription = hitElement && {
      tagName: hitElement.tagName,
      className: typeof hitElement.className === 'string' ? hitElement.className : '',
      testId: hitElement.getAttribute('data-testid'),
      ariaLabel: hitElement.getAttribute('aria-label'),
      isTargetOrDescendant: hitElement === element || element.contains(hitElement),
      insideWorldHint: Boolean(hitElement.closest('.world-hint')),
    };
    const overlap = worldHintRect && {
      left: Math.max(elementRect.left, worldHintRect.left),
      top: Math.max(elementRect.top, worldHintRect.top),
      right: Math.min(elementRect.right, worldHintRect.right),
      bottom: Math.min(elementRect.bottom, worldHintRect.bottom),
    };
    const worldHintOverlap = overlap && overlap.right > overlap.left && overlap.bottom > overlap.top
      ? { width: overlap.right - overlap.left, height: overlap.bottom - overlap.top }
      : null;

    return {
      withinPanel: inside(elementRect, panelLeft, panelTop, panelRight, panelBottom),
      withinInnerScrollport: !inner || inside(
        elementRect,
        innerRect.left + inner.clientLeft,
        innerRect.top + inner.clientTop,
        innerRect.left + inner.clientLeft + inner.clientWidth,
        innerRect.top + inner.clientTop + inner.clientHeight,
      ),
      elementRect: rectDetails(elementRect),
      finderRect: rectDetails(panelRect),
      finderContentBounds: { left: panelLeft, top: panelTop, right: panelRight, bottom: panelBottom },
      resultsScrollport: resultRect && {
        rect: rectDetails(resultRect),
        clientLeft: resultList.clientLeft,
        clientTop: resultList.clientTop,
        clientWidth: resultList.clientWidth,
        clientHeight: resultList.clientHeight,
        scrollTop: resultList.scrollTop,
        clientBounds: {
          left: resultRect.left + resultList.clientLeft,
          top: resultRect.top + resultList.clientTop,
          right: resultRect.left + resultList.clientLeft + resultList.clientWidth,
          bottom: resultRect.top + resultList.clientTop + resultList.clientHeight,
        },
      },
      elementFromPoint: {
        point: { x: Number(centerX.toFixed(2)), y: Number(centerY.toFixed(2)) },
        hit: hitDescription,
      },
      worldHintRect: rectDetails(worldHintRect),
      worldHintOverlap,
    };
  }, innerScrollport);

  const details = JSON.stringify(geometry);
  expect.soft(geometry.withinPanel, `${description} should remain fully inside the Finder and viewport: ${details}`).toBe(true);
  expect.soft(geometry.withinInnerScrollport, `${description} should remain fully inside its result scrollport: ${details}`).toBe(true);
  expect.soft(
    geometry.elementFromPoint.hit?.isTargetOrDescendant,
    `${description} should not be obscured at its center point: ${details}`,
  ).toBe(true);
}

async function expectFinderLayout(finder, viewport) {
  const geometry = await finder.evaluate((element) => {
    const panelRect = element.getBoundingClientRect();
    const rectDetails = (rect) => ({
      left: Number(rect.left.toFixed(2)),
      top: Number(rect.top.toFixed(2)),
      right: Number(rect.right.toFixed(2)),
      bottom: Number(rect.bottom.toFixed(2)),
      width: Number(rect.width.toFixed(2)),
      height: Number(rect.height.toFixed(2)),
    });
    const results = element.querySelector('.item-finder-results');

    return {
      panelInViewport: panelRect.left >= 0 && panelRect.right <= window.innerWidth
        && panelRect.top >= 0 && panelRect.bottom <= window.innerHeight,
      panelHasHorizontalOverflow: element.scrollWidth > element.clientWidth + 1,
      pageHasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      panelAllowsVerticalScroll: ['auto', 'scroll'].includes(getComputedStyle(element).overflowY),
      panelHasVerticalOverflow: element.scrollHeight > element.clientHeight + 1,
      panelRect: rectDetails(panelRect),
      panelScrollHeight: element.scrollHeight,
      panelClientHeight: element.clientHeight,
      resultsAllowVerticalScroll: ['auto', 'scroll'].includes(getComputedStyle(results).overflowY),
      resultsHaveVerticalOverflow: results.scrollHeight > results.clientHeight + 1,
    };
  });

  expect.soft(geometry.panelInViewport, `Finder should fit ${viewport.width}x${viewport.height}`).toBe(true);
  expect.soft(geometry.panelHasHorizontalOverflow, 'Finder should not overflow horizontally').toBe(false);
  expect.soft(geometry.pageHasHorizontalOverflow, 'page should not overflow horizontally').toBe(false);
  expect.soft(
    geometry.panelAllowsVerticalScroll && geometry.panelHasVerticalOverflow,
    `Finder shell should scroll vertically when its content exceeds the visible shell: ${JSON.stringify(geometry)}`,
  ).toBe(true);
  expect.soft(
    geometry.resultsAllowVerticalScroll && geometry.resultsHaveVerticalOverflow,
    `results should remain independently scrollable: ${JSON.stringify(geometry)}`,
  ).toBe(true);
}

async function expectToolbarAvailable(finder, toolbar, worldJump) {
  const geometry = await finder.evaluate((panel) => {
    const toolbar = document.querySelector('.game-toolbar');
    const worldJump = document.querySelector('.world-jump');
    const panelRect = panel.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    const jumpRect = worldJump.getBoundingClientRect();
    const overlaps = (first, second) => first.left < second.right && first.right > second.left
      && first.top < second.bottom && first.bottom > second.top;
    return {
      finderOverlapsToolbar: overlaps(panelRect, toolbarRect),
      finderOverlapsWorldJump: overlaps(panelRect, jumpRect),
      toolbarRect: { left: toolbarRect.left, top: toolbarRect.top, right: toolbarRect.right, bottom: toolbarRect.bottom },
      worldJumpRect: { left: jumpRect.left, top: jumpRect.top, right: jumpRect.right, bottom: jumpRect.bottom },
    };
  });

  await expect(toolbar).toBeVisible();
  await expect(worldJump).toBeVisible();
  expect.soft(geometry.finderOverlapsToolbar, `Finder should not overlap the bottom toolbar: ${JSON.stringify(geometry)}`).toBe(false);
  expect.soft(geometry.finderOverlapsWorldJump, `Finder should not overlap world-jump: ${JSON.stringify(geometry)}`).toBe(false);

  for (const [control, description] of [
    [toolbar.getByRole('button', { name: 'Zoom out' }), 'toolbar button'],
    [worldJump, 'world-jump'],
  ]) {
    const hitTest = await control.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit === element || element.contains(hit);
    });
    expect.soft(hitTest, `${description} should remain hit-testable while Finder is open`).toBe(true);
  }
}

async function expectFinderControlsVisibleOnOpen(finder, close, search) {
  const layout = await finder.evaluate((panel, selectors) => {
    const bounds = (element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    const inside = (target, container) => target.left >= Math.max(0, container.left)
      && target.right <= Math.min(window.innerWidth, container.right)
      && target.top >= Math.max(0, container.top)
      && target.bottom <= Math.min(window.innerHeight, container.bottom);
    const panelBounds = bounds(panel);
    const closeBounds = bounds(panel.querySelector(selectors.close));
    const searchBounds = bounds(panel.querySelector(selectors.search));

    return {
      panelBounds,
      closeBounds,
      searchBounds,
      scrollTop: panel.scrollTop,
      closeInsidePanelAndViewport: inside(closeBounds, panelBounds),
      searchInsidePanelAndViewport: inside(searchBounds, panelBounds),
    };
  }, {
    close: '[aria-label="Close item finder"]',
    search: 'input[type="search"]',
  });

  expect.soft(
    layout.closeInsidePanelAndViewport,
    `Close button should be visible inside the Finder shell on open: ${JSON.stringify(layout)}`,
  ).toBe(true);
  expect.soft(
    layout.searchInsidePanelAndViewport,
    `Search field should be visible inside the Finder shell on open: ${JSON.stringify(layout)}`,
  ).toBe(true);
}

async function expectCompactToolbarRow(toolbar, page, viewport) {
  const layout = await toolbar.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
      overflowX: style.overflowX,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      horizontalScrollEnabled: ['auto', 'scroll'].includes(style.overflowX),
      hasHorizontalOverflow: element.scrollWidth > element.clientWidth + 1,
      documentHasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

  expect.soft(layout.rect.height, `world toolbar should fit in a compact row: ${JSON.stringify(layout)}`)
    .toBeLessThanOrEqual(48);
  expect.soft(layout.horizontalScrollEnabled, `world toolbar should scroll horizontally: ${JSON.stringify(layout)}`)
    .toBe(true);
  if (viewport.width <= 390) {
    expect.soft(layout.hasHorizontalOverflow, `narrow toolbar controls should extend into its horizontal scrollport: ${JSON.stringify(layout)}`)
      .toBe(true);
  } else {
    expect.soft(layout.hasHorizontalOverflow, `toolbar controls should fit without horizontal scrolling at ${viewport.width}px: ${JSON.stringify(layout)}`)
      .toBe(false);
  }
  expect.soft(layout.documentHasHorizontalOverflow, 'page should not overflow horizontally').toBe(false);

  const controls = toolbar.locator('button:not([disabled]), select:not([disabled]), input:not([disabled])');
  const count = await controls.count();
  expect(count, 'world toolbar should expose keyboard-focusable controls').toBeGreaterThan(0);
  await controls.first().focus();

  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    await expect(control, `toolbar control ${index + 1} should be keyboard-reachable`).toBeFocused();
    const focusLayout = await control.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const toolbar = element.closest('.game-toolbar');
      const toolbarRect = toolbar.getBoundingClientRect();
      const left = toolbarRect.left + toolbar.clientLeft;
      const top = toolbarRect.top + toolbar.clientTop;
      const right = left + toolbar.clientWidth;
      const bottom = top + toolbar.clientHeight;
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        withinToolbar: rect.left >= left - 1 && rect.right <= right + 1
          && rect.top >= top - 1 && rect.bottom <= bottom + 1,
        withinViewport: rect.left >= 0 && rect.right <= window.innerWidth
          && rect.top >= 0 && rect.bottom <= window.innerHeight,
        hitTestable: hit === element || element.contains(hit),
      };
    });
    expect.soft(focusLayout.withinToolbar, `toolbar control ${index + 1} should be fully visible in the scrollport`).toBe(true);
    expect.soft(focusLayout.withinViewport, `toolbar control ${index + 1} should be inside the viewport`).toBe(true);
    expect.soft(focusLayout.hitTestable, `toolbar control ${index + 1} should be hit-testable`).toBe(true);
    if (index < count - 1) {
      await page.keyboard.press('Tab');
    }
  }
  await toolbar.evaluate((element) => { element.scrollLeft = 0; });
  await page.getByRole('searchbox', { name: 'Search laboratory items' }).focus();
}

async function expectAtlasToggleClearOfFinder(finder, atlasToggle) {
  const geometry = await finder.evaluate((panel) => {
    const toggle = document.querySelector('[data-testid="world-atlas-toggle"]');
    const toolbar = document.querySelector('.game-toolbar');
    const search = panel.querySelector('input[type="search"]');
    const close = panel.querySelector('[aria-label="Close item finder"]');
    const rectDetails = (element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    const toggleRect = rectDetails(toggle);
    const finderRect = rectDetails(panel);
    const toolbarRect = rectDetails(toolbar);
    const searchRect = rectDetails(search);
    const closeRect = rectDetails(close);
    const finderStyle = getComputedStyle(panel);
    const overlaps = (first, second) => first.left < second.right && first.right > second.left
      && first.top < second.bottom && first.bottom > second.top;

    return {
      toggleRect,
      finderRect,
      toolbarRect,
      searchRect,
      closeRect,
      finderMaxHeight: finderStyle.maxHeight,
      finderOverflowY: finderStyle.overflowY,
      finderScrollHeight: panel.scrollHeight,
      finderClientHeight: panel.clientHeight,
      toolbarClearance: toolbarRect.top - finderRect.bottom,
      overlapsFinder: overlaps(toggleRect, finderRect),
      overlapsSearch: overlaps(toggleRect, searchRect),
      overlapsClose: overlaps(toggleRect, closeRect),
    };
  });

  await expect(atlasToggle).toBeVisible();
  expect.soft(
    geometry.overlapsFinder,
    `Atlas toggle should not overlap the Finder shell: ${JSON.stringify(geometry)}`,
  ).toBe(false);
  expect.soft(
    geometry.overlapsSearch || geometry.overlapsClose,
    `Atlas toggle should not overlap essential Finder controls: ${JSON.stringify(geometry)}`,
  ).toBe(false);
  expect.soft(
    geometry.toolbarClearance,
    `Finder should end at least 10px above the bottom toolbar: ${JSON.stringify(geometry)}`,
  ).toBeGreaterThanOrEqual(10);
}

for (const viewport of [
  { width: 320, height: 480 },
  { width: 390, height: 480 },
  { width: 320, height: 400 },
  { width: 390, height: 400 },
  { width: 320, height: 360 },
  { width: 667, height: 375 },
]) {
  test(`150% Item Finder controls remain visible and keyboard-reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const seededState = await seedGame(page);
    await expect(page.locator('html')).toHaveCSS('--text-scale', '1.5');

    const finder = page.getByRole('search', { name: 'Find a laboratory item' });
    const search = finder.getByRole('searchbox', { name: 'Search laboratory items' });
    const close = finder.getByRole('button', { name: 'Close item finder' });
    const results = finder.locator('.item-finder-result');
    const nextPage = finder.getByRole('button', { name: 'Next page' });
    const resultScrollport = finder.locator('.item-finder-results');
    const toolbar = page.getByRole('group', { name: 'World navigation controls' });
    const worldJump = page.getByTestId('world-jump');
    const atlasToggle = page.getByTestId('world-atlas-toggle');

    await expect(finder).toBeVisible();
    await expect(search).toBeFocused();
    await expect(finder.locator('.item-finder-count')).toHaveText(`${seededState.items.length} matching items`);

    if (viewport.height <= 400) {
      await expectFinderControlsVisibleOnOpen(finder, close, search);
      await expectCompactToolbarRow(toolbar, page, viewport);
    }

    const pageIndicator = finder.getByTestId('item-finder-page');
    const firstPageLabel = await pageIndicator.textContent();
    const pageMatch = firstPageLabel?.match(/^Page 1 of (\d+)$/);
    expect(pageMatch, `Expected a rendered first-page count, got: ${firstPageLabel}`).not.toBeNull();
    const pageCount = Number(pageMatch[1]);
    const firstPageCount = await results.count();
    expect(firstPageCount, 'the rendered first page should contain results').toBeGreaterThan(0);
    expect(pageCount, 'rendered page count should match the seeded item count and page capacity')
      .toBe(Math.ceil(seededState.items.length / firstPageCount));
    expect(pageCount, 'the seeded item catalog should have a next page').toBeGreaterThan(1);

    await expectToolbarAvailable(finder, toolbar, worldJump);
    await expectAtlasToggleClearOfFinder(finder, atlasToggle);
    await expectFinderLayout(finder, viewport);

    const initialPanelScrollTop = await finder.evaluate((element) => element.scrollTop);
    const initialResultsScrollTop = await resultScrollport.evaluate((element) => element.scrollTop);
    await page.keyboard.press('Shift+Tab');
    await expectFocusVisibleInFinder(finder, close, 'Close button');
    await page.keyboard.press('Tab');
    await expectFocusVisibleInFinder(finder, search, 'Search field');
    await page.keyboard.press('Tab');

    const firstResult = results.first();
    await expectFocusVisibleInFinder(finder, firstResult, 'First search result', '.item-finder-results');

    for (let index = 1; index < firstPageCount; index += 1) {
      await page.keyboard.press('Tab');
    }

    const lastResult = results.nth(firstPageCount - 1);
    await expectFocusVisibleInFinder(finder, lastResult, 'Last search result', '.item-finder-results');
    const finalResultsScrollTop = await resultScrollport.evaluate((element) => element.scrollTop);
    expect.soft(finalResultsScrollTop, 'Tab traversal should scroll the results list to later items')
      .toBeGreaterThan(initialResultsScrollTop);

    await page.keyboard.press('Tab');
    await expectFocusVisibleInFinder(finder, nextPage, 'Next page button');
    const finalPanelScrollTop = await finder.evaluate((element) => element.scrollTop);
    expect.soft(finalPanelScrollTop, 'Tab traversal should scroll the Finder shell to later controls')
      .toBeGreaterThan(initialPanelScrollTop);
    await page.keyboard.press('Enter');
    await expect(pageIndicator).toHaveText(`Page 2 of ${pageCount}`);

    const query = 'Brass Cog';
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const expectedMatches = seededState.items.filter((item) => [item.title, item.family, item.clue, item.id]
      .some((value) => String(value ?? '').toLocaleLowerCase().includes(normalizedQuery)));
    expect(expectedMatches.length, 'the search query should match at least one fixture item').toBeGreaterThan(0);
    expect(expectedMatches.length, 'the search query should narrow the fixture items')
      .toBeLessThan(seededState.items.length);
    await search.fill(query);
    await expect(finder.locator('.item-finder-count'))
      .toHaveText(`${expectedMatches.length} matching ${expectedMatches.length === 1 ? 'item' : 'items'}`);
    await expect(pageIndicator)
      .toHaveText(`Page 1 of ${Math.max(1, Math.ceil(expectedMatches.length / 25))}`);
    const filteredResultIds = await results.evaluateAll((elements) => elements
      .map((element) => element.getAttribute('data-testid')));
    expect(filteredResultIds).toEqual(expectedMatches.slice(0, 25)
      .map((item) => `item-finder-result-${item.id}`));
  });
}
