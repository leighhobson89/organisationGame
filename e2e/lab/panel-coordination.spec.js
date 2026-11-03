import { expect, test } from '@playwright/test';
import { COLLECTIONS, DESTINATIONS } from '../../src/game/content/catalog.js';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { encodeSave } from '../../src/game/persistence/save.js';
import { getTargetSlotPosition } from '../../src/game/world/placementLayout.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const selectedItemId = 'calibration-card-01';

function cameraForCompactItem(item, viewport = { width: 390, height: 480 }) {
  const scale = 0.5;
  const centerX = viewport.width / 2;
  const centerY = viewport.height - 88 - 100;
  return {
    panX: centerX - (item.position.x + (item.width ?? 0) / 2) * scale,
    panY: centerY - (item.position.y + (item.height ?? 0) / 2) * scale,
    scale,
  };
}

async function loadLab(page, { ownedSkills = [], viewport, focusItemId } = {}) {
  if (viewport) await page.setViewportSize(viewport);
  const state = createNewGameState();
  state.progress.ownedSkills = ownedSkills;
  const item = state.items.find((entry) => entry.id === (focusItemId ?? selectedItemId));
  if (focusItemId) state.camera = cameraForCompactItem(item, viewport);

  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: autoSaveKey,
    value: encodeSave(state),
  });
  await page.goto('/');

  expect(item).toBeTruthy();
  expect(item.placement.kind).toBe('workspace');
  return item;
}

function createAlmostUnlockedChapterFixture({ completedCount = 2 } = {}) {
  const state = createNewGameState();
  const chapterCollections = COLLECTIONS.filter((collection) => collection.chapter === 2);
  expect(chapterCollections).toHaveLength(3);
  expect(completedCount).toBeGreaterThanOrEqual(1);
  expect(completedCount).toBeLessThan(chapterCollections.length);
  const pendingCollection = chapterCollections[completedCount];
  const pendingItemId = pendingCollection.itemIds.at(-1);
  const completedCollectionIds = chapterCollections.slice(0, completedCount).map((collection) => collection.id);

  state.items = state.items.map((item) => {
    const collectionIndex = chapterCollections.findIndex((entry) => entry.itemIds.includes(item.id));
    if (collectionIndex < 0 || collectionIndex > completedCount
      || (collectionIndex === completedCount && item.id === pendingItemId)) return item;
    const collection = chapterCollections[collectionIndex];

    const slotIndex = collection.itemIds.indexOf(item.id);
    const target = { kind: 'destination', id: collection.destinationId };
    return {
      ...item,
      position: getTargetSlotPosition({ target, item, slotIndex, destinations: DESTINATIONS, scratchPads: [] }),
      placement: { kind: 'destination', destinationId: collection.destinationId, slotIndex },
      rotation: 0,
      validation: 'correct',
    };
  });
  state.progress = {
    ...state.progress,
    completedCollectionIds,
    skillPoints: completedCollectionIds.length,
    unlockedPuzzleIds: [],
    solvedPuzzleIds: [],
  };

  return {
    state,
    pendingCollection,
    pendingItem: state.items.find((item) => item.id === pendingItemId),
  };
}

test('selecting a loose object closes Instruments and preserves it for the Resonance Lens', async ({ page }) => {
  const item = await loadLab(page, { ownedSkills: ['resonance-lens'] });
  const instrumentsButton = page.getByRole('button', { name: 'Instruments', exact: true });
  const itemButton = page.getByRole('button', { name: new RegExp(item.title) });
  const instrumentsHeading = page.getByRole('heading', { name: 'Workshop Skills' });
  const inspector = page.getByRole('complementary', { name: 'Selected item details' });

  await instrumentsButton.click();
  await expect(instrumentsHeading).toBeVisible();
  await itemButton.click();

  await expect(instrumentsHeading).toBeHidden();
  await expect(inspector.getByRole('heading', { name: item.title })).toBeVisible();

  await instrumentsButton.click();
  await expect(inspector).toBeHidden();
  await expect(instrumentsHeading).toBeVisible();

  const activateLens = page.getByRole('button', { name: 'Activate lens', exact: true });
  await expect(activateLens).toBeEnabled();
  await activateLens.click();
  await expect(page.getByRole('button', { name: 'Lens active', exact: true })).toBeVisible();
});

test('at compact width, selecting an item closes Notebook and keeps Inspector Move usable', async ({ page }) => {
  const item = await loadLab(page, { viewport: { width: 390, height: 480 }, focusItemId: selectedItemId });
  const notebook = page.getByRole('complementary', { name: "Professor's notebook" });
  const inspector = page.getByRole('complementary', { name: 'Selected item details' });

  await page.getByRole('button', { name: 'Notebook', exact: true }).click();
  await expect(notebook).toBeVisible();
  await page.getByTestId(`lab-item-${item.id}`).dispatchEvent('click', { detail: 1 });

  await expect.soft(notebook).toBeHidden();
  await expect(inspector.getByRole('heading', { name: item.title })).toBeVisible();
  const moveTarget = inspector.getByRole('combobox', { name: 'Move to destination or work surface' });
  const moveItem = inspector.getByRole('button', { name: 'Move item', exact: true });
  await expect(moveTarget).toBeVisible();
  await expect(moveItem).toBeEnabled();
  await moveTarget.selectOption('cabinet-calibration');
  await moveItem.click();
  await expect(inspector).toContainText('Correctly catalogued.');
});

test('at compact width, opening Notebook closes Inspector but preserves item selection', async ({ page }) => {
  const item = await loadLab(page, { viewport: { width: 390, height: 480 }, focusItemId: selectedItemId });
  await page.getByTestId(`lab-item-${item.id}`).dispatchEvent('click', { detail: 1 });

  const inspector = page.getByRole('complementary', { name: 'Selected item details' });
  const notebook = page.getByRole('complementary', { name: "Professor's notebook" });
  const itemButton = page.getByTestId(`lab-item-${item.id}`);
  await expect(inspector).toBeVisible();
  await expect(itemButton).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Notebook', exact: true }).click();

  await expect(notebook).toBeVisible();
  await expect.soft(inspector).toBeHidden();
  await expect(itemButton).toHaveAttribute('aria-pressed', 'true');
  await expect(itemButton).toHaveClass(/is-selected/);
});

test('desktop allows Notebook and Inspector together, then compact resize keeps Inspector only', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const item = await loadLab(page);
  const itemButton = page.getByTestId(`lab-item-${item.id}`);
  const notebook = page.getByRole('complementary', { name: "Professor's notebook" });
  const inspector = page.getByRole('complementary', { name: 'Selected item details' });

  await page.getByRole('button', { name: 'Notebook', exact: true }).click();
  await itemButton.click();
  await expect(notebook).toBeVisible();
  await expect(inspector.getByRole('heading', { name: item.title })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 480 });

  await expect(inspector).toBeVisible();
  await expect(notebook).toBeHidden();
});

test('compact chapter completion prioritizes the newly unlocked puzzle over Notebook', async ({ page }) => {
  const { state, pendingCollection, pendingItem } = createAlmostUnlockedChapterFixture();
  state.camera = cameraForCompactItem(pendingItem);
  await page.setViewportSize({ width: 390, height: 480 });
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: autoSaveKey,
    value: encodeSave(state),
  });
  await page.goto('/');

  const notebook = page.getByRole('complementary', { name: "Professor's notebook" });
  await page.getByRole('button', { name: 'Notebook', exact: true }).click();
  await expect(page.getByTestId('chapter-progress')).toContainText('2 of 3');
  await page.getByTestId(`lab-item-${pendingItem.id}`).dispatchEvent('click', { detail: 1 });
  await expect.soft(notebook).toBeHidden();

  const inspector = page.getByRole('complementary', { name: 'Selected item details' });
  await expect(inspector).toBeVisible();
  await inspector.getByRole('combobox', { name: 'Move to destination or work surface' })
    .selectOption(pendingCollection.destinationId);
  await inspector.getByRole('button', { name: 'Move item', exact: true }).click();

  await expect(page.getByTestId('chapter-progress')).toContainText('3 of 3');
  await expect(page.getByTestId('chronology-puzzle-panel')).toBeVisible();
  await expect(notebook).toBeHidden();
  await expect(inspector).toBeHidden();
});

test('compact chapter completion without a puzzle shows Notebook and closes Inspector', async ({ page }) => {
  const { state, pendingCollection, pendingItem } = createAlmostUnlockedChapterFixture({ completedCount: 1 });
  state.camera = cameraForCompactItem(pendingItem);
  await page.setViewportSize({ width: 390, height: 480 });
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: autoSaveKey,
    value: encodeSave(state),
  });
  await page.goto('/');

  const notebook = page.getByRole('complementary', { name: "Professor's notebook" });
  await page.getByRole('button', { name: 'Notebook', exact: true }).click();
  await expect(page.getByTestId('chapter-progress')).toContainText('1 of 3');
  await page.getByTestId(`lab-item-${pendingItem.id}`).dispatchEvent('click', { detail: 1 });
  await expect.soft(notebook).toBeHidden();

  const inspector = page.getByRole('complementary', { name: 'Selected item details' });
  await expect(inspector).toBeVisible();
  await inspector.getByRole('combobox', { name: 'Move to destination or work surface' })
    .selectOption(pendingCollection.destinationId);
  await inspector.getByRole('button', { name: 'Move item', exact: true }).click();

  await expect(page.getByTestId('chapter-progress')).toContainText('2 of 3');
  await expect(page.getByTestId('chronology-puzzle-panel')).toHaveCount(0);
  await expect(notebook).toBeVisible();
  await expect(inspector).toBeHidden();
});

test('opening item search closes Instruments and pointer selection opens the Inspector', async ({ page }) => {
  const item = await loadLab(page);
  const instrumentsButton = page.getByRole('button', { name: 'Instruments', exact: true });
  const instrumentsHeading = page.getByRole('heading', { name: 'Workshop Skills' });

  await instrumentsButton.click();
  await expect(instrumentsHeading).toBeVisible();
  await page.getByRole('button', { name: 'Find an item', exact: true }).click();

  await expect(instrumentsHeading).toBeHidden();
  const finder = page.getByRole('search', { name: 'Find a laboratory item' });
  const search = finder.getByRole('searchbox', { name: 'Search laboratory items' });
  await expect(search).toBeVisible();
  await search.fill(item.title);

  const result = finder.getByRole('button', { name: new RegExp(item.title) });
  await expect(result).toBeVisible();
  await result.click();

  await expect(finder).toBeHidden();
  const inspector = page.getByRole('complementary', { name: 'Selected item details' });
  await expect(inspector.getByRole('heading', { name: item.title })).toBeVisible();
});

test('opening item search closes the Inspector while preserving the selection and Notebook', async ({ page }) => {
  const item = await loadLab(page);
  const itemButton = page.getByTestId(`lab-item-${item.id}`);
  await itemButton.click();

  const inspector = page.getByRole('complementary', { name: 'Selected item details' });
  await expect(inspector.getByRole('heading', { name: item.title })).toBeVisible();
  await page.getByRole('button', { name: 'Notebook', exact: true }).click();
  const notebook = page.getByRole('complementary', { name: "Professor's notebook" });
  await expect(notebook).toBeVisible();

  await page.getByRole('button', { name: 'Find an item', exact: true }).click();

  await expect(page.getByRole('search', { name: 'Find a laboratory item' })).toBeVisible();
  await expect(inspector).toBeHidden();
  await expect(notebook).toBeVisible();
  await expect(itemButton).toHaveAttribute('aria-pressed', 'true');
});

test('at compact width, opening item Finder closes Notebook and focuses its search field', async ({ page }) => {
  await loadLab(page, { viewport: { width: 390, height: 480 } });
  const notebook = page.getByRole('complementary', { name: "Professor's notebook" });
  await page.getByRole('button', { name: 'Notebook', exact: true }).click();
  await expect(notebook).toBeVisible();

  await page.getByRole('button', { name: 'Find an item', exact: true }).click();

  const finder = page.getByRole('search', { name: 'Find a laboratory item' });
  const search = finder.getByRole('searchbox', { name: 'Search laboratory items' });
  await expect(finder).toBeVisible();
  await expect(notebook).toBeHidden();
  await expect(search).toBeFocused();
});

test('closing a group Inspector falls back to another selected item when the current item cannot receive focus', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await loadLab(page);
  const selectionToggle = page.getByRole('button', { name: 'Select multiple items', exact: true });
  await selectionToggle.click();

  const firstItem = page.getByTestId('lab-item-calibration-card-01');
  const currentItem = page.getByTestId('lab-item-calibration-card-02');
  await expect(firstItem).toBeVisible();
  await expect(currentItem).toBeVisible();
  await firstItem.click();
  await currentItem.click();

  const inspector = page.getByRole('complementary', { name: 'Selected item details' });
  await expect(inspector).toBeVisible();
  await expect(firstItem).toHaveAttribute('aria-pressed', 'true');
  await expect(currentItem).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('multi-selection-count')).toHaveText('2 selected');
  await currentItem.evaluate((button) => {
    button.disabled = true;
  });
  await inspector.getByRole('button', { name: 'Close item inspector' }).click();

  await expect(inspector).toBeHidden();
  await expect(firstItem).toHaveAttribute('aria-pressed', 'true');
  await expect(currentItem).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('multi-selection-count')).toHaveText('2 selected');
  await expect(firstItem).toBeFocused();
});

test('at compact width, opening Notebook closes Finder and keeps focus on Notebook', async ({ page }) => {
  await loadLab(page, { viewport: { width: 390, height: 480 } });
  const findButton = page.getByRole('button', { name: 'Find an item', exact: true });
  await findButton.click();
  const finder = page.getByRole('search', { name: 'Find a laboratory item' });
  await expect(finder.getByRole('searchbox', { name: 'Search laboratory items' })).toBeFocused();

  const notebookButton = page.getByRole('button', { name: 'Notebook', exact: true });
  await notebookButton.click();

  await expect(finder).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: "Professor's notebook" })).toBeVisible();
  await expect(notebookButton).toBeFocused();
});

test('desktop Finder and Notebook coexist, then compact resize closes Finder and restores its toggle focus', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await loadLab(page);
  const notebookButton = page.getByRole('button', { name: 'Notebook', exact: true });
  await notebookButton.click();
  const notebook = page.getByRole('complementary', { name: "Professor's notebook" });
  await page.getByRole('button', { name: 'Find an item', exact: true }).click();

  const finder = page.getByRole('search', { name: 'Find a laboratory item' });
  const search = finder.getByRole('searchbox', { name: 'Search laboratory items' });
  await expect(notebook).toBeVisible();
  await expect(finder).toBeVisible();
  await expect(search).toBeFocused();

  await page.setViewportSize({ width: 390, height: 480 });

  await expect(finder).toHaveCount(0);
  await expect(notebook).toBeVisible();
  await expect(page.getByRole('button', { name: 'Find an item', exact: true })).toBeFocused();
});

test('compact resize closes Finder without stealing focus when it was outside Finder', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await loadLab(page);
  const notebookButton = page.getByRole('button', { name: 'Notebook', exact: true });
  await notebookButton.click();
  const notebook = page.getByRole('complementary', { name: "Professor's notebook" });
  await page.getByRole('button', { name: 'Find an item', exact: true }).click();
  const finder = page.getByRole('search', { name: 'Find a laboratory item' });
  await expect(finder).toBeVisible();
  await notebookButton.focus();
  await expect(notebookButton).toBeFocused();

  await page.setViewportSize({ width: 390, height: 480 });

  await expect(finder).toHaveCount(0);
  await expect(notebook).toBeVisible();
  await expect(notebookButton).toBeFocused();
});

test('keyboard focus enters item search and returns to Find after closing', async ({ page }) => {
  await loadLab(page);
  const findButton = page.getByRole('button', { name: 'Find an item', exact: true });
  await findButton.focus();
  await page.keyboard.press('Enter');

  const finder = page.getByRole('search', { name: 'Find a laboratory item' });
  const search = finder.getByRole('searchbox', { name: 'Search laboratory items' });
  await expect(search).toBeFocused();

  await finder.getByRole('button', { name: 'Close item finder' }).click();

  await expect(finder).toBeHidden();
  await expect(findButton).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(search).toBeFocused();
  await findButton.evaluate((button) => button.click());

  await expect(finder).toBeHidden();
  await expect(findButton).toBeFocused();
});

test('keyboard Finder selection opens the Inspector and focuses its target selector', async ({ page }) => {
  const item = await loadLab(page);
  const findButton = page.getByRole('button', { name: 'Find an item', exact: true });
  await findButton.click();

  const finder = page.getByRole('search', { name: 'Find a laboratory item' });
  const search = finder.getByRole('searchbox', { name: 'Search laboratory items' });
  await search.fill(item.title);
  const result = finder.getByRole('button', { name: new RegExp(item.title) });
  await result.focus();
  await page.keyboard.press('Enter');

  const inspector = page.getByRole('complementary', { name: 'Selected item details' });
  await expect(finder).toBeHidden();
  await expect(inspector.getByRole('heading', { name: item.title })).toBeVisible();
  await expect(inspector.getByRole('combobox', { name: 'Move to destination or work surface' })).toBeFocused();
});

test('Arrow keys inside Finder controls do not pan the laboratory world', async ({ page }) => {
  await loadLab(page);
  await page.getByRole('button', { name: 'Find an item', exact: true }).click();

  const finder = page.getByRole('search', { name: 'Find a laboratory item' });
  const worldScene = page.getByTestId('world-viewport').locator('.world-scene');
  const closeButton = finder.getByRole('button', { name: 'Close item finder' });
  const firstResult = finder.getByRole('list').getByRole('button').first();

  for (const [control, key] of [[closeButton, 'ArrowRight'], [firstResult, 'ArrowDown']]) {
    await control.focus();
    await expect(control).toBeFocused();
    const transformBefore = await worldScene.evaluate((scene) => scene.style.transform);

    await page.keyboard.press(key);

    await expect.soft(finder).toBeVisible();
    await expect.soft(control).toBeFocused();
    expect.soft(await worldScene.evaluate((scene) => scene.style.transform)).toBe(transformBefore);
  }
});

test('wheel scrolling Finder results does not zoom the laboratory world', async ({ page }) => {
  await loadLab(page);
  await page.getByRole('button', { name: 'Find an item', exact: true }).click();

  const finder = page.getByRole('search', { name: 'Find a laboratory item' });
  await expect(finder.getByText('174 matching items', { exact: true })).toBeVisible();
  const results = finder.getByRole('list');
  const scrollTopBefore = await results.evaluate((list) => list.scrollTop);
  const resultListBox = await results.boundingBox();
  expect(resultListBox).not.toBeNull();

  const worldControls = page.getByRole('group', { name: 'World navigation controls' });
  const zoomReadout = worldControls.getByText(/^\d+%$/);
  const zoomBefore = await zoomReadout.textContent();
  await page.mouse.move(resultListBox.x + resultListBox.width / 2, resultListBox.y + resultListBox.height / 2);
  await page.mouse.wheel(0, 420);
  await page.waitForTimeout(250);

  const scrollTopAfter = await results.evaluate((list) => list.scrollTop);
  const zoomAfter = await zoomReadout.textContent();
  expect.soft(scrollTopAfter).toBeGreaterThan(scrollTopBefore);
  expect.soft(zoomAfter).toBe(zoomBefore);
});

test('touch scrolling Finder results does not move or zoom the laboratory world', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await loadLab(page);
    await page.getByRole('button', { name: 'Find an item', exact: true }).click();

    const finder = page.getByRole('search', { name: 'Find a laboratory item' });
    const results = finder.getByRole('list');
    await expect(finder.getByText('174 matching items', { exact: true })).toBeVisible();
    const resultListBox = await results.boundingBox();
    expect(resultListBox).not.toBeNull();
    const scrollTopBefore = await results.evaluate((list) => list.scrollTop);
    const world = page.getByTestId('world-viewport');
    const viewportTouchAction = await world.evaluate((viewport) => getComputedStyle(viewport).touchAction);
    expect(viewportTouchAction).toMatch(/^(auto|pan-y)$/);
    const worldTransformBefore = await world.locator('.world-scene').evaluate((scene) => scene.style.transform);
    const cullingRevisionBefore = await world.getAttribute('data-culling-revision');

    const client = await context.newCDPSession(page);
    const x = resultListBox.x + resultListBox.width / 2;
    const startY = resultListBox.y + resultListBox.height * 0.8;
    const endY = resultListBox.y + resultListBox.height * 0.2;
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y: startY, id: 1 }],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: endY, id: 1 }],
    });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => results.evaluate((list) => list.scrollTop)).toBeGreaterThan(scrollTopBefore);

    const worldTransformAfter = await world.locator('.world-scene').evaluate((scene) => scene.style.transform);
    const cullingRevisionAfter = await world.getAttribute('data-culling-revision');
    expect(worldTransformAfter).toBe(worldTransformBefore);
    expect(cullingRevisionAfter).toBe(cullingRevisionBefore);
    await client.detach();
  } finally {
    await context.close();
  }
});
