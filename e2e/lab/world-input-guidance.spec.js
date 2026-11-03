import { expect, test } from '@playwright/test';

async function expectGuidanceForPointer(page, pointer) {
  const isCoarse = pointer === 'coarse';
  const mouseGuidance = page.locator('.world-hint__mouse-guidance');
  const touchGuidance = page.locator('.world-hint__touch-guidance');
  const visibleGuidance = isCoarse ? touchGuidance : mouseGuidance;
  const hiddenGuidance = isCoarse ? mouseGuidance : touchGuidance;

  await expect(visibleGuidance).toBeVisible();
  await expect(hiddenGuidance).toBeHidden();
  await expect(visibleGuidance).toContainText(/drag empty space to pan/i);
  if (isCoarse) {
    await expect(visibleGuidance).toContainText(/pinch to zoom/i);
    await expect(visibleGuidance).not.toContainText(/wheel to zoom|hold Space and drag to pan/i);
  } else {
    await expect(visibleGuidance).toContainText(/wheel to zoom/i);
    await expect(visibleGuidance).not.toContainText(/pinch to zoom|hold Space and drag to pan/i);
  }
}

async function expectWorldAccessibleLabel(page) {
  const world = page.getByTestId('world-viewport');
  await expect(world).toHaveAttribute('aria-label', /drag empty space to pan/i);
  await expect(world).toHaveAttribute('aria-label', /wheel or pinch to zoom/i);
  await expect(world).toHaveAttribute('aria-label', /arrow keys while focused/i);
}

async function expectNormalAndSelectionGuidance(page, pointer, activateSelection) {
  const hint = page.locator('.world-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toContainText(/Start with Harmonic Calibration/i);
  await expectGuidanceForPointer(page, pointer);
  await expectWorldAccessibleLabel(page);

  await activateSelection();
  const selectionPrefix = pointer === 'coarse'
    ? /Tap or press Enter on objects to select them/i
    : /Click or press Enter on objects to select them/i;
  const alternateSelectionPrefix = pointer === 'coarse'
    ? /Click or press Enter on objects to select them/i
    : /Tap or press Enter on objects to select them/i;
  const visibleHintText = await hint.evaluate((element) => element.innerText);
  expect(visibleHintText).toMatch(selectionPrefix);
  expect(visibleHintText).not.toMatch(alternateSelectionPrefix);
  await expect(hint).toContainText(/use the Inspector to move the group/i);
  await expectGuidanceForPointer(page, pointer);
  await expectWorldAccessibleLabel(page);
}

test('fine-pointer world hints describe empty-space drag and mouse-wheel zoom', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await expect(page.getByTestId('world-item-count')).toBeVisible();
  expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)).toBe(false);

  await expectNormalAndSelectionGuidance(page, 'fine', () => (
    page.getByTestId('multi-selection-toggle').click()
  ));
});

test('coarse-pointer world hints describe empty-space drag and pinch zoom', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:5173',
    hasTouch: true,
    viewport: { width: 390, height: 480 },
  });

  try {
    const page = await context.newPage();
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto('/');
    await expect(page.getByTestId('world-item-count')).toBeVisible();
    expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)).toBe(true);

    await expectNormalAndSelectionGuidance(page, 'coarse', () => (
      page.getByTestId('multi-selection-toggle').tap()
    ));
  } finally {
    await context.close();
  }
});
