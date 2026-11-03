import { expect, test } from '@playwright/test';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { encodeSave } from '../../src/game/persistence/save.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const selectedItemId = 'calibration-card-01';

async function loadLab(page, { ownedSkills = [] } = {}) {
  const state = createNewGameState();
  state.progress.ownedSkills = ownedSkills;

  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: autoSaveKey,
    value: encodeSave(state),
  });
  await page.goto('/');

  const item = state.items.find((entry) => entry.id === selectedItemId);
  expect(item).toBeTruthy();
  expect(item.placement.kind).toBe('workspace');
  return item;
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

  const world = page.getByRole('region', { name: /Laboratory world/ });
  const zoomReadout = world.getByText(/^\d+%$/);
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
