import { expect, test } from '@playwright/test';
import { PREFERENCES_STORAGE_KEY } from '../../src/game/preferences/preferences.js';

const scaledTextPreferences = {
  version: 1,
  textScale: 1.25,
  reduceMotion: false,
  soundEffectsEnabled: false,
};

async function loadScaledTextPreferences(page, viewport) {
  await page.setViewportSize(viewport);
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)), {
    key: PREFERENCES_STORAGE_KEY,
    value: scaledTextPreferences,
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveCSS('--text-scale', '1.25');
}

async function assertToolbarTextIsNotClipped(page) {
  const controls = await page.locator('.game-toolbar').locator(':scope > :not(.sr-only)').evaluateAll((elements) => elements
    .filter((element) => {
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    })
    .map((element) => ({
      name: element.getAttribute('aria-label') || element.innerText || element.tagName,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    })));

  for (const control of controls) {
    expect(control.scrollWidth, `${control.name} toolbar text should not be clipped horizontally at 125%`).toBeLessThanOrEqual(control.clientWidth + 1);
    expect(control.scrollHeight, `${control.name} toolbar text should not be clipped vertically at 125%`).toBeLessThanOrEqual(control.clientHeight + 1);
  }
}

async function assertSelectionToastTextIsNotClipped(page) {
  const toast = page.locator('.lab-toast');
  const dimensions = await toast.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(dimensions.scrollWidth, 'selection toast text should not be clipped horizontally at 125%').toBeLessThanOrEqual(dimensions.clientWidth + 1);
  expect(dimensions.scrollHeight, 'selection toast text should not be clipped vertically at 125%').toBeLessThanOrEqual(dimensions.clientHeight + 1);
}

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

async function assertFirstActionGuidance(page) {
  const hint = page.locator('.world-hint');
  await expect(hint).toContainText(/Harmonic Calibration/i);
  await expect(hint).toContainText(/blueprints?/i);
  await expect(hint).toContainText(/Harmonic Calibration Folio/i);
  await expect(hint).toContainText(/Drag objects to a cabinet or workbench/i);
  const mouseGuidance = hint.locator('.world-hint__mouse-guidance');
  await expect(mouseGuidance).toBeVisible();
  await expect(mouseGuidance).toContainText(/drag empty space to pan/i);
  await expect(mouseGuidance).toContainText(/wheel to zoom/i);
}

async function assertSelectionGuidance(page) {
  const hint = page.locator('.world-hint');
  await expect(hint).toContainText(/Click or press Enter on objects to select them/i);
  await expect(hint).toContainText(/use the Inspector to move the group/i);
  const mouseGuidance = hint.locator('.world-hint__mouse-guidance');
  await expect(mouseGuidance).toBeVisible();
  await expect(mouseGuidance).toContainText(/drag empty space to pan/i);
  await expect(mouseGuidance).toContainText(/wheel to zoom/i);
}

async function assertHintFitsViewport(page, viewport, state) {
  const hint = page.locator('.world-hint');
  const geometry = await hint.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    };
  });

  expect.soft(geometry.left, `world hint should stay inside the left viewport edge in ${state} state`).toBeGreaterThanOrEqual(0);
  expect.soft(geometry.top, `world hint should stay inside the top viewport edge in ${state} state`).toBeGreaterThanOrEqual(0);
  expect.soft(geometry.right, `world hint should stay inside the right viewport edge in ${state} state`).toBeLessThanOrEqual(viewport.width);
  expect.soft(geometry.bottom, `world hint should stay inside the bottom viewport edge in ${state} state`).toBeLessThanOrEqual(viewport.height);
  expect.soft(geometry.scrollWidth, `world hint text should not be clipped horizontally in ${state} state`).toBeLessThanOrEqual(geometry.clientWidth + 1);
  expect.soft(geometry.scrollHeight, `world hint text should not be clipped vertically in ${state} state`).toBeLessThanOrEqual(geometry.clientHeight + 1);
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
  await assertFirstActionGuidance(page);

  const jump = page.getByRole('combobox', { name: 'Jump to laboratory location' });
  await jump.selectOption('engine');
  await expect(jump).toHaveValue('engine');
  await expect(jump.locator('option:checked')).toHaveText('Palimpsest Engine');
  expect.soft((await jump.boundingBox()).width, 'mobile location selector should retain enough width for its selected destination').toBeGreaterThanOrEqual(154);

  await assertToolbarGeometry(page, viewport);
  await assertHintDoesNotOverlapToolbar(page, 'normal');
  await assertHintFitsViewport(page, viewport, 'normal');
  await expect(page.getByTestId('world-item-count')).toContainText('174');

  await page.getByRole('button', { name: 'Select multiple items', exact: true }).click();
  await expect(page.getByTestId('multi-selection-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('multi-selection-count')).toHaveText('0 selected');
  await assertSelectionGuidance(page);
  await expect(page.getByTestId('world-item-count')).toContainText('174');
  await assertToolbarGeometry(page, viewport);
  await assertHintDoesNotOverlapToolbar(page, 'selection-count');
  await assertHintFitsViewport(page, viewport, 'selection-count');
  await assertSelectionToastGeometry(page, viewport);
});

test('narrow mobile toolbar, hint, and selection toast fit at 320x480', async ({ page }) => {
  const viewport = { width: 320, height: 480 };
  await page.setViewportSize(viewport);
  await page.goto('/');
  await expect(page.getByTestId('world-item-count')).toBeVisible();
  await assertToolbarControls(page);
  await assertFirstActionGuidance(page);

  await assertToolbarGeometry(page, viewport);
  await assertHintDoesNotOverlapToolbar(page, 'normal');
  await assertHintFitsViewport(page, viewport, 'normal');

  await page.getByRole('button', { name: 'Select multiple items', exact: true }).click();
  await expect(page.getByTestId('multi-selection-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('multi-selection-count')).toHaveText('0 selected');
  await assertSelectionGuidance(page);
  await assertToolbarGeometry(page, viewport);
  await assertHintDoesNotOverlapToolbar(page, 'selection-count');
  await assertHintFitsViewport(page, viewport, 'selection-count');
  await assertSelectionToastGeometry(page, viewport);
});

for (const viewport of [
  { width: 320, height: 480 },
  { width: 390, height: 480 },
]) {
  test(`125% text keeps mobile toolbar, guidance, and selection toast readable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await loadScaledTextPreferences(page, viewport);
    await expect(page.getByTestId('world-item-count')).toBeVisible();
    await assertToolbarControls(page);
    await assertFirstActionGuidance(page);

    await assertToolbarGeometry(page, viewport);
    await assertToolbarTextIsNotClipped(page);
    await assertHintDoesNotOverlapToolbar(page, 'normal');
    await assertHintFitsViewport(page, viewport, 'normal');

    await page.getByRole('button', { name: 'Select multiple items', exact: true }).click();
    await expect(page.getByTestId('multi-selection-toggle')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('multi-selection-count')).toHaveText('0 selected');
    await assertSelectionGuidance(page);
    await assertToolbarGeometry(page, viewport);
    await assertToolbarTextIsNotClipped(page);
    await assertHintDoesNotOverlapToolbar(page, 'selection-count');
    await assertHintFitsViewport(page, viewport, 'selection-count');
    await assertSelectionToastGeometry(page, viewport);
    await assertSelectionToastTextIsNotClipped(page);
  });

  test(`the 125% selection toast stays behind the Inspector at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await loadScaledTextPreferences(page, viewport);

    await page.getByRole('button', { name: 'Select multiple items', exact: true }).click();
    await expect(page.getByTestId('multi-selection-toggle')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('lab-item-calibration-card-01').dispatchEvent('click', { detail: 1 });

    const inspector = page.locator('.item-inspector');
    const toast = page.getByTestId('game-feedback');
    await expect(inspector).toBeVisible();
    await expect(toast).toHaveText('1 object selected.');

    const [toastZIndex, inspectorZIndex] = await Promise.all([
      toast.evaluate((element) => Number.parseInt(window.getComputedStyle(element).zIndex, 10)),
      inspector.evaluate((element) => Number.parseInt(window.getComputedStyle(element).zIndex, 10)),
    ]);
    expect(toastZIndex, 'selection toast should stack below Inspector content').toBeLessThan(inspectorZIndex);
  });
}

test('opening Clockwork Atlas clears the 125% multi-selection toast at 320x480', async ({ page }) => {
  const viewport = { width: 320, height: 480 };
  await loadScaledTextPreferences(page, viewport);
  await page.getByRole('button', { name: 'Select multiple items', exact: true }).click();

  const feedback = page.getByTestId('game-feedback');
  await expect(feedback).toBeVisible();
  await expect(feedback).toContainText(/Select or deselect objects/i);

  await page.getByRole('button', { name: 'Open Clockwork Atlas' }).click();
  await expect(page.getByTestId('world-atlas-panel')).toBeVisible();
  await expect(feedback).toHaveText('');
});

test('opening Item Finder clears the 125% multi-selection toast at 390x480', async ({ page }) => {
  const viewport = { width: 390, height: 480 };
  await loadScaledTextPreferences(page, viewport);
  await page.getByRole('button', { name: 'Select multiple items', exact: true }).click();

  const feedback = page.getByTestId('game-feedback');
  await expect(feedback).toBeVisible();
  await expect(feedback).toContainText(/Select or deselect objects/i);

  await page.getByRole('button', { name: 'Find an item', exact: true }).click();
  await expect(page.getByRole('search', { name: 'Find a laboratory item' })).toBeVisible();
  await expect(feedback).toHaveText('');
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
