import { expect, test } from '@playwright/test';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { encodeSave } from '../../src/game/persistence/save.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';

function matchingItems(items, query) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return items;
  return items.filter((item) => [item.title, item.family, item.clue, item.id]
    .some((value) => String(value ?? '').toLocaleLowerCase().includes(normalizedQuery)));
}

function matchingCountText(count) {
  return `${count} matching ${count === 1 ? 'item' : 'items'}`;
}

async function loadFinder(page) {
  const state = createNewGameState();
  await page.addInitScript(({ key, value }) => {
    window.__itemFinderAnnouncements = [];
    let previousText = '';
    const recordStatusChange = () => {
      const status = document.querySelector('[data-testid="item-finder-announcer"]');
      if (!status) return;
      const text = status.textContent.trim();
      if (text === previousText) return;
      previousText = text;
      if (text) window.__itemFinderAnnouncements.push(text);
    };
    const observer = new MutationObserver(recordStatusChange);
    observer.observe(document, { childList: true, characterData: true, subtree: true });

    window.localStorage.clear();
    window.localStorage.setItem(key, value);
  }, { key: autoSaveKey, value: encodeSave(state) });
  await page.goto('/');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Find an item', exact: true }).click();
  const finder = page.getByRole('search', { name: 'Find a laboratory item' });
  await expect(finder).toBeVisible();
  return { finder, items: state.items };
}

async function readAnnouncements(page) {
  return page.evaluate(() => window.__itemFinderAnnouncements);
}

async function typeSequentially(input, text) {
  await input.pressSequentially(text, { delay: 12 });
}

async function readStatusText(page) {
  return page.evaluate(() => document.querySelector('[data-testid="item-finder-announcer"]')?.textContent.trim() ?? '');
}

async function waitForRenderedStatus(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test('Escape closes Finder, restores focus to its opener, and leaves the camera unchanged', async ({ page }) => {
  const { finder } = await loadFinder(page);
  const search = finder.getByRole('searchbox', { name: 'Search laboratory items' });
  const scene = page.locator('.world-scene');

  await expect(search).toBeFocused();
  const cameraTransform = await scene.evaluate((element) => element.style.transform);

  await search.press('Escape');

  await expect(finder).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Find an item', exact: true })).toBeFocused();
  expect(await scene.evaluate((element) => element.style.transform)).toBe(cameraTransform);
});

test('Finder count and page readouts are not live, with one initially empty polite status', async ({ page }) => {
  const { finder } = await loadFinder(page);

  const count = finder.locator('.item-finder-count');
  const pageReadout = finder.getByTestId('item-finder-page');
  await expect(count).toHaveText('174 matching items');
  await expect(pageReadout).toHaveText('Page 1 of 7');
  await expect(count).not.toHaveAttribute('aria-live');
  await expect(pageReadout).not.toHaveAttribute('aria-live');

  const status = finder.getByTestId('item-finder-announcer');
  await expect(status).toHaveCount(1);
  await expect(status).toHaveAttribute('role', 'status');
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await expect(status).toBeEmpty();
  expect(await readAnnouncements(page)).toEqual([]);
});

test('sequential typing announces one settled count and clearing the query announces once', async ({ page }) => {
  const { finder, items } = await loadFinder(page);
  const search = finder.getByRole('searchbox', { name: 'Search laboratory items' });
  const count = finder.locator('.item-finder-count');
  const pageReadout = finder.getByTestId('item-finder-page');
  const results = finder.locator('.item-finder-result');
  const statusTextAtOpen = await readStatusText(page);
  expect(statusTextAtOpen).toBe('');

  const midQuery = 'Harmonic Cal';
  await typeSequentially(search, midQuery);
  const midMatches = matchingItems(items, midQuery);
  await expect(count).toHaveText(`${midMatches.length} matching items`);
  await expect(results).toHaveCount(midMatches.length);
  await expect(pageReadout).toHaveText(`Page 1 of ${Math.max(1, Math.ceil(midMatches.length / 25))}`);
  expect(await readStatusText(page)).toBe(statusTextAtOpen);
  expect(await readAnnouncements(page), 'partial query input should not update the shared status').toEqual([]);

  const finalQuery = 'Harmonic Calibration 01';
  await typeSequentially(search, finalQuery.slice(midQuery.length));
  const finalMatches = matchingItems(items, finalQuery);
  await expect(count).toHaveText(`${finalMatches.length} matching items`);
  await expect(results).toHaveCount(finalMatches.length);
  await expect(results.first()).toHaveAttribute('data-testid', `item-finder-result-${finalMatches[0].id}`);
  expect(await readStatusText(page)).toBe(statusTextAtOpen);
  await page.waitForTimeout(350);
  const afterSettledQuery = await readAnnouncements(page);

  await search.fill('');
  await expect(count).toHaveText(`${items.length} matching items`);
  await expect(results).toHaveCount(25);
  await expect(pageReadout).toHaveText('Page 1 of 7');
  await page.waitForTimeout(350);
  const afterClear = await readAnnouncements(page);

  const finalPageCount = Math.max(1, Math.ceil(finalMatches.length / 25));
  expect(afterSettledQuery).toEqual([`${matchingCountText(finalMatches.length)}. Page 1 of ${finalPageCount}.`]);
  expect(afterClear).toEqual([
    `${matchingCountText(finalMatches.length)}. Page 1 of ${finalPageCount}.`,
    `${matchingCountText(items.length)}. Page 1 of ${Math.ceil(items.length / 25)}.`,
  ]);
  await expect(finder.getByTestId('item-finder-announcer')).toHaveAttribute('aria-live', 'polite');
});

test('Next and Previous each announce exactly one page change through the shared status', async ({ page }) => {
  const { finder, items } = await loadFinder(page);
  const pageReadout = finder.getByTestId('item-finder-page');
  const results = finder.locator('.item-finder-result');
  const pageCount = Math.ceil(items.length / 25);

  await finder.getByRole('button', { name: 'Next page' }).click();
  await expect(pageReadout).toHaveText(`Page 2 of ${pageCount}`);
  await expect(results.first()).toHaveAttribute('data-testid', `item-finder-result-${items[25].id}`);
  await waitForRenderedStatus(page);
  const afterNext = await readAnnouncements(page);

  await finder.getByRole('button', { name: 'Previous page' }).click();
  await expect(pageReadout).toHaveText(`Page 1 of ${pageCount}`);
  await expect(results.first()).toHaveAttribute('data-testid', `item-finder-result-${items[0].id}`);
  await waitForRenderedStatus(page);
  const afterPrevious = await readAnnouncements(page);

  expect(afterNext).toEqual([`Page 2 of ${pageCount}. ${matchingCountText(items.length)}.`]);
  expect(afterPrevious).toEqual([
    `Page 2 of ${pageCount}. ${matchingCountText(items.length)}.`,
    `Page 1 of ${pageCount}. ${matchingCountText(items.length)}.`,
  ]);
  expect(await finder.locator('.item-finder-count').getAttribute('aria-live')).toBeNull();
  expect(await pageReadout.getAttribute('aria-live')).toBeNull();
  await expect(finder.getByTestId('item-finder-announcer')).toHaveAttribute('aria-live', 'polite');
});

test('Next during a pending query announces the current page and count without a stale overwrite', async ({ page }) => {
  const { finder, items } = await loadFinder(page);
  const search = finder.getByRole('searchbox', { name: 'Search laboratory items' });
  const count = finder.locator('.item-finder-count');
  const pageReadout = finder.getByTestId('item-finder-page');
  const results = finder.locator('.item-finder-result');
  const query = 'a';
  const matches = matchingItems(items, query);
  expect(matches.length).toBeGreaterThan(25);

  // Two immediate edits leave the final query's 300 ms announcement pending.
  await search.fill('e');
  await search.fill(query);
  const pageCount = Math.ceil(matches.length / 25);
  await expect(count).toHaveText(`${matchingCountText(matches.length)}`);
  await expect(results).toHaveCount(25);
  await expect(pageReadout).toHaveText(`Page 1 of ${pageCount}`);

  await finder.getByRole('button', { name: 'Next page' }).click();
  await expect(pageReadout).toHaveText(`Page 2 of ${pageCount}`);
  await expect(results.first()).toHaveAttribute('data-testid', `item-finder-result-${matches[25].id}`);
  await waitForRenderedStatus(page);
  const immediateStatus = await readStatusText(page);
  const expectedStatus = `Page 2 of ${pageCount}. ${matchingCountText(matches.length)}.`;

  await page.waitForTimeout(350);
  const finalStatus = await readStatusText(page);
  const announcements = await readAnnouncements(page);

  expect.soft(immediateStatus).toBe(expectedStatus);
  expect.soft(finalStatus).toBe(expectedStatus);
  expect.soft(announcements).toEqual([expectedStatus]);
});
