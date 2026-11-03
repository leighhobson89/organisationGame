import { expect, test } from '@playwright/test';

async function assertToolbarGeometry(page, viewport, { singleRow = false } = {}) {
  const toolbar = page.locator('.game-toolbar');
  await expect(toolbar).toBeVisible();

  const toolbarBox = await toolbar.boundingBox();
  expect(toolbarBox, 'world toolbar should have rendered geometry').not.toBeNull();
  expect.soft(toolbarBox.x, 'toolbar should stay inside the left viewport edge').toBeGreaterThanOrEqual(0);
  expect.soft(toolbarBox.y, 'toolbar should stay inside the top viewport edge').toBeGreaterThanOrEqual(0);
  expect.soft(toolbarBox.x + toolbarBox.width, 'toolbar should stay inside the right viewport edge').toBeLessThanOrEqual(viewport.width);
  expect.soft(toolbarBox.y + toolbarBox.height, 'toolbar should stay inside the bottom viewport edge').toBeLessThanOrEqual(viewport.height);

  const children = await toolbar.locator(':scope > :not(.sr-only)').evaluateAll((elements) => elements
    .filter((element) => {
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    })
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        name: element.getAttribute('aria-label') || element.innerText || element.tagName,
        x: rect.x,
        y: rect.y,
        right: rect.right,
        bottom: rect.bottom,
      };
    }));

  expect(children.length, 'toolbar should contain visible controls').toBeGreaterThan(0);
  for (const child of children) {
    expect.soft(child.x, `${child.name} should stay inside the left viewport edge`).toBeGreaterThanOrEqual(0);
    expect.soft(child.y, `${child.name} should stay inside the top viewport edge`).toBeGreaterThanOrEqual(0);
    expect.soft(child.right, `${child.name} should stay inside the right viewport edge`).toBeLessThanOrEqual(viewport.width);
    expect.soft(child.bottom, `${child.name} should stay inside the bottom viewport edge`).toBeLessThanOrEqual(viewport.height);
  }

  for (let firstIndex = 0; firstIndex < children.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < children.length; secondIndex += 1) {
      const first = children[firstIndex];
      const second = children[secondIndex];
      const overlaps = first.x < second.right && first.right > second.x
        && first.y < second.bottom && first.bottom > second.y;
      expect.soft(overlaps, `${first.name} must not overlap ${second.name}`).toBe(false);
    }
  }

  if (singleRow) {
    const verticalCenters = children.map((child) => (child.y + child.bottom) / 2);
    expect(Math.max(...verticalCenters) - Math.min(...verticalCenters), 'desktop controls should remain aligned in one toolbar row').toBeLessThanOrEqual(2);
  }

  return toolbar;
}

async function assertToolbarControls(page) {
  await expect(page.getByRole('button', { name: 'Zoom out', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Jump to laboratory location' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset view', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Find an item', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select multiple items', exact: true })).toBeVisible();
}

async function assertHintDoesNotOverlapToolbar(page, state) {
  const hint = page.locator('.world-hint');
  const toolbar = page.locator('.game-toolbar');
  await expect(hint).toBeVisible();
  const [hintBox, toolbarBox] = await Promise.all([hint.boundingBox(), toolbar.boundingBox()]);
  expect(hintBox, `world hint should have geometry in ${state} state`).not.toBeNull();
  expect(toolbarBox, `world toolbar should have geometry in ${state} state`).not.toBeNull();

  const overlaps = hintBox.x < toolbarBox.x + toolbarBox.width
    && hintBox.x + hintBox.width > toolbarBox.x
    && hintBox.y < toolbarBox.y + toolbarBox.height
    && hintBox.y + hintBox.height > toolbarBox.y;
  expect.soft(overlaps, `world hint should not overlap the toolbar in ${state} state`).toBe(false);
}

async function assertSelectionToastGeometry(page, viewport) {
  const toast = page.locator('.lab-toast');
  const hint = page.locator('.world-hint');
  const toolbar = page.locator('.game-toolbar');
  await expect(toast).toBeVisible();
  const [toastBox, hintBox, toolbarBox] = await Promise.all([
    toast.boundingBox(),
    hint.boundingBox(),
    toolbar.boundingBox(),
  ]);
  expect(toastBox, 'selection toast should have rendered geometry').not.toBeNull();
  expect(hintBox, 'world hint should have rendered geometry').not.toBeNull();
  expect(toolbarBox, 'world toolbar should have rendered geometry').not.toBeNull();

  expect.soft(toastBox.x, 'selection toast should stay inside the left viewport edge').toBeGreaterThanOrEqual(0);
  expect.soft(toastBox.y, 'selection toast should stay inside the top viewport edge').toBeGreaterThanOrEqual(0);
  expect.soft(toastBox.x + toastBox.width, 'selection toast should stay inside the right viewport edge').toBeLessThanOrEqual(viewport.width);
  expect.soft(toastBox.y + toastBox.height, 'selection toast should stay inside the bottom viewport edge').toBeLessThanOrEqual(viewport.height);

  for (const [otherName, otherBox] of [['world hint', hintBox], ['toolbar', toolbarBox]]) {
    const overlaps = toastBox.x < otherBox.x + otherBox.width
      && toastBox.x + toastBox.width > otherBox.x
      && toastBox.y < otherBox.y + otherBox.height
      && toastBox.y + toastBox.height > otherBox.y;
    expect.soft(overlaps, `selection toast should not overlap the ${otherName}`).toBe(false);
  }
}

test('mobile world toolbar keeps controls readable, visible, and separated at 390x480', async ({ page }) => {
  const viewport = { width: 390, height: 480 };
  await page.setViewportSize(viewport);
  await page.goto('/');
  await expect(page.getByTestId('world-item-count')).toBeVisible();
  await assertToolbarControls(page);

  const jump = page.getByRole('combobox', { name: 'Jump to laboratory location' });
  await jump.selectOption('engine');
  await expect(jump).toHaveValue('engine');
  await expect(jump.locator('option:checked')).toHaveText('Palimpsest Engine');
  expect.soft((await jump.boundingBox()).width, 'mobile location selector should retain enough width for its selected destination').toBeGreaterThanOrEqual(154);

  await assertToolbarGeometry(page, viewport);
  await assertHintDoesNotOverlapToolbar(page, 'normal');
  await expect(page.getByTestId('world-item-count')).toContainText('174');

  await page.getByRole('button', { name: 'Select multiple items', exact: true }).click();
  await expect(page.getByTestId('multi-selection-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('multi-selection-count')).toHaveText('0 selected');
  await expect(page.getByTestId('world-item-count')).toContainText('174');
  await assertToolbarGeometry(page, viewport);
  await assertHintDoesNotOverlapToolbar(page, 'selection-count');
  await assertSelectionToastGeometry(page, viewport);
});

test('narrow mobile toolbar, hint, and selection toast fit at 320x480', async ({ page }) => {
  const viewport = { width: 320, height: 480 };
  await page.setViewportSize(viewport);
  await page.goto('/');
  await expect(page.getByTestId('world-item-count')).toBeVisible();
  await assertToolbarControls(page);

  await assertToolbarGeometry(page, viewport);
  await assertHintDoesNotOverlapToolbar(page, 'normal');

  await page.getByRole('button', { name: 'Select multiple items', exact: true }).click();
  await expect(page.getByTestId('multi-selection-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('multi-selection-count')).toHaveText('0 selected');
  await assertToolbarGeometry(page, viewport);
  await assertHintDoesNotOverlapToolbar(page, 'selection-count');
  await assertSelectionToastGeometry(page, viewport);
});

test('desktop world toolbar stays in its existing single-row layout at 1440x900', async ({ page }) => {
  const viewport = { width: 1440, height: 900 };
  await page.setViewportSize(viewport);
  await page.goto('/');
  await expect(page.getByTestId('world-item-count')).toBeVisible();
  await assertToolbarControls(page);

  const jump = page.getByRole('combobox', { name: 'Jump to laboratory location' });
  expect((await jump.boundingBox()).width, 'desktop location selector should retain its content width').toBeGreaterThanOrEqual(154);
  await assertToolbarGeometry(page, viewport, { singleRow: true });

  const toolbarBox = await page.locator('.game-toolbar').boundingBox();
  expect(Math.abs(toolbarBox.x + toolbarBox.width / 2 - viewport.width / 2), 'desktop toolbar should remain centered').toBeLessThanOrEqual(2);
});
