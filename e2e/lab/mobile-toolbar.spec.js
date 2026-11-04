import { expect, test } from '@playwright/test';
import { PREFERENCES_STORAGE_KEY } from '../../src/game/preferences/preferences.js';

const scaledTextPreferences = {
  version: 1,
  textScale: 1.25,
  reduceMotion: false,
  soundEffectsEnabled: false,
};

async function loadScaledTextPreferences(page, viewport, textScale = 1.25) {
  await page.setViewportSize(viewport);
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)), {
    key: PREFERENCES_STORAGE_KEY,
    value: { ...scaledTextPreferences, textScale },
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveCSS('--text-scale', String(textScale));
}

async function assertToolbarTextIsNotClipped(page, textPercent = 125) {
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
    expect(control.scrollWidth, `${control.name} toolbar text should not be clipped horizontally at ${textPercent}%`).toBeLessThanOrEqual(control.clientWidth + 1);
    expect(control.scrollHeight, `${control.name} toolbar text should not be clipped vertically at ${textPercent}%`).toBeLessThanOrEqual(control.clientHeight + 1);
  }
}

async function assertSelectionToastTextIsNotClipped(page, textPercent = 125) {
  const toast = page.locator('.lab-toast');
  const dimensions = await toast.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(dimensions.scrollWidth, `selection toast text should not be clipped horizontally at ${textPercent}%`).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  expect(dimensions.scrollHeight, `selection toast text should not be clipped vertically at ${textPercent}%`).toBeLessThanOrEqual(dimensions.clientHeight + 1);
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

async function assertToolbarControlsAreHitTestable(page) {
  const controls = [
    page.getByRole('button', { name: 'Zoom out', exact: true }),
    page.getByRole('button', { name: 'Zoom in', exact: true }),
    page.getByRole('combobox', { name: 'Jump to laboratory location' }),
    page.getByRole('button', { name: 'Reset view', exact: true }),
    page.getByRole('button', { name: 'Find an item', exact: true }),
    page.getByRole('button', { name: 'Select multiple items', exact: true }),
  ];

  for (const control of controls) {
    const name = await control.getAttribute('aria-label') || await control.innerText();
    await expect(control, `${name} should remain an enabled accessible control`).toBeEnabled();
    const receivesPointer = await control.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit === element || element.contains(hit);
    });
    expect(receivesPointer, `${name} should remain hit-testable at its center`).toBe(true);
  }
}

async function assertVisibleToolbarTargetsAreUsable(page) {
  const measurements = await page.locator('.game-toolbar').locator('button:visible, select:visible').evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      name: element.getAttribute('aria-label') || element.innerText || element.tagName.toLowerCase(),
      width: rect.width,
      height: rect.height,
      hitTestable: hit === element || element.contains(hit),
    };
  }));

  expect(measurements.length, 'toolbar should expose visible interactive controls').toBeGreaterThan(0);
  for (const target of measurements) {
    expect(target.width, `${target.name} should have a usable width`).toBeGreaterThanOrEqual(38);
    expect(target.height, `${target.name} should have a usable height`).toBeGreaterThanOrEqual(38);
    expect(target.hitTestable, `${target.name} should be hit-testable at its center`).toBe(true);
  }
}

async function assertCompactToolbarBoundsAndNoPageOverflow(page, viewport) {
  const measurements = await page.evaluate(() => {
    const toolbar = document.querySelector('.game-toolbar');
    const rect = toolbar.getBoundingClientRect();
    return {
      toolbar: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      page: {
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };
  });

  expect(measurements.toolbar.left, 'compact toolbar should stay inside the left viewport edge').toBeGreaterThanOrEqual(0);
  expect(measurements.toolbar.top, 'compact toolbar should stay inside the top viewport edge').toBeGreaterThanOrEqual(0);
  expect(measurements.toolbar.right, 'compact toolbar should stay inside the right viewport edge').toBeLessThanOrEqual(viewport.width);
  expect(measurements.toolbar.bottom, 'compact toolbar should stay inside the bottom viewport edge').toBeLessThanOrEqual(viewport.height);
  expect(measurements.page.scrollWidth, 'compact layout should not create horizontal page overflow').toBeLessThanOrEqual(measurements.page.width);
  expect(measurements.page.scrollHeight, 'compact layout should not create vertical page overflow').toBeLessThanOrEqual(measurements.page.height);
}

async function assertCompactToolbarTargetsWorkThroughKeyboardScroll(page, { expectedPageScroll } = {}) {
  const toolbar = page.locator('.game-toolbar');
  const controls = toolbar.locator('button:visible, select:visible');
  const count = await controls.count();
  expect(count, 'compact toolbar should expose its interactive controls').toBeGreaterThan(0);

  const rowCenters = [];
  const scrollOffsets = [await toolbar.evaluate((element) => element.scrollLeft)];
  await controls.first().focus();

  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    if (index > 0) await page.keyboard.press('Tab');
    await expect(control, 'Tab should reach each visible toolbar control in order').toBeFocused();

    const target = await control.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const toolbarElement = element.closest('.game-toolbar');
      const toolbarRect = toolbarElement.getBoundingClientRect();
      const clipLeft = toolbarRect.left + toolbarElement.clientLeft;
      const clipTop = toolbarRect.top + toolbarElement.clientTop;
      const clipRight = clipLeft + toolbarElement.clientWidth;
      const clipBottom = clipTop + toolbarElement.clientHeight;
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        name: element.getAttribute('aria-label') || element.innerText || element.tagName.toLowerCase(),
        width: rect.width,
        height: rect.height,
        centerY: rect.top + rect.height / 2,
        visibleWithinToolbar: rect.left >= clipLeft - 1 && rect.right <= clipRight + 1
          && rect.top >= clipTop - 1 && rect.bottom <= clipBottom + 1,
        hitTestable: hit === element || element.contains(hit),
      };
    });

    expect(target.width, `${target.name} should have a usable width`).toBeGreaterThanOrEqual(38);
    expect(target.height, `${target.name} should have a usable height`).toBeGreaterThanOrEqual(38);
    expect(target.visibleWithinToolbar, `${target.name} should scroll fully into the toolbar view when focused`).toBe(true);
    expect(target.hitTestable, `${target.name} should be hit-testable at its center after focus scrolls it into view`).toBe(true);
    rowCenters.push(target.centerY);
    scrollOffsets.push(await toolbar.evaluate((element) => element.scrollLeft));
  }

  expect(Math.max(...rowCenters) - Math.min(...rowCenters), 'compact toolbar controls should share one horizontal rail').toBeLessThanOrEqual(2);
  const finalScroll = await toolbar.evaluate((element) => ({
    left: element.scrollLeft,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  const scrollChanged = scrollOffsets.some((offset, index) => index > 0 && offset !== scrollOffsets[index - 1]);
  const reachedEnd = finalScroll.left + finalScroll.clientWidth >= finalScroll.scrollWidth - 1;
  expect(scrollChanged || reachedEnd, 'Tab focus should scroll the rail or leave it at its end').toBe(true);
  if (expectedPageScroll) {
    expect(await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY })), 'keyboard toolbar scrolling should not move the document')
      .toEqual(expectedPageScroll);
  }
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

async function assertFirstActionLeadReadable(page) {
  const lead = page.locator('.world-hint__lead');
  await expect(lead).toBeVisible();
  await expect(lead).toContainText(/Start with Harmonic Calibration/i);
  await expect(lead).toContainText(/select a blueprint to inspect its clue/i);
  await expect(lead).toContainText(/file it in the Harmonic Calibration Folio/i);

  const dimensions = await lead.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(dimensions.scrollWidth, 'first-action lead should not be clipped horizontally').toBeLessThanOrEqual(dimensions.clientWidth + 1);
  expect(dimensions.scrollHeight, 'first-action lead should not be clipped vertically').toBeLessThanOrEqual(dimensions.clientHeight + 1);
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

async function assertInspectorGuidanceLayout(page, viewport, initialScroll) {
  const layout = await page.evaluate(() => {
    const readRect = (selector) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      const style = element ? window.getComputedStyle(element) : null;
      return {
        visible: Boolean(element && style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length),
        left: rect?.left ?? null,
        top: rect?.top ?? null,
        right: rect?.right ?? null,
        bottom: rect?.bottom ?? null,
        width: rect?.width ?? null,
        height: rect?.height ?? null,
      };
    };

    const toolbar = document.querySelector('.game-toolbar');
    return {
      controls: readRect('.world-hint__controls'),
      toolbar: {
        ...readRect('.game-toolbar'),
        clientWidth: toolbar?.clientWidth ?? null,
        scrollWidth: toolbar?.scrollWidth ?? null,
        scrollLeft: toolbar?.scrollLeft ?? null,
        overflowX: toolbar ? window.getComputedStyle(toolbar).overflowX : null,
      },
      inspector: readRect('[data-testid="item-inspector"]'),
      page: {
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      },
    };
  });

  for (const [name, box] of Object.entries({
    'world hint controls': layout.controls,
    'world toolbar': layout.toolbar,
    Inspector: layout.inspector,
  })) {
    expect(box.visible, `${name} should be visible with the Inspector open; layout: ${JSON.stringify(layout)}`).toBe(true);
    expect(box.left, `${name} should remain inside the left viewport edge`).toBeGreaterThanOrEqual(0);
    expect(box.top, `${name} should remain inside the top viewport edge`).toBeGreaterThanOrEqual(0);
    expect(box.right, `${name} should remain inside the right viewport edge`).toBeLessThanOrEqual(viewport.width);
    expect(box.bottom, `${name} should remain inside the bottom viewport edge`).toBeLessThanOrEqual(viewport.height);
  }

  expect(layout.toolbar.height, 'the Inspector should use a 44px compact toolbar rail').toBe(44);
  expect(layout.toolbar.overflowX, 'the Inspector toolbar should expose its horizontal rail').toMatch(/^(auto|scroll)$/);
  expect(layout.toolbar.scrollWidth, 'the Inspector toolbar rail should contain later actions beyond its visible width').toBeGreaterThan(layout.toolbar.clientWidth);

  const regions = [
    ['world hint controls', layout.controls],
    ['world toolbar', layout.toolbar],
    ['Inspector', layout.inspector],
  ];
  for (let firstIndex = 0; firstIndex < regions.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < regions.length; secondIndex += 1) {
      const [firstName, first] = regions[firstIndex];
      const [secondName, second] = regions[secondIndex];
      const overlaps = first.left < second.right && first.right > second.left
        && first.top < second.bottom && first.bottom > second.top;
      expect(overlaps, `${firstName} should not overlap ${secondName}; layout: ${JSON.stringify(layout)}`).toBe(false);
    }
  }

  for (const name of ['scrollWidth', 'scrollHeight']) {
    expect(layout.page[name], `Inspector guidance layout should not create page ${name} overflow`).toBeLessThanOrEqual(layout.page[name === 'scrollWidth' ? 'width' : 'height']);
  }
  expect(layout.page.scrollX, 'Inspector guidance layout should not move the page horizontally').toBe(initialScroll.x);
  expect(layout.page.scrollY, 'Inspector guidance layout should not move the page vertically').toBe(initialScroll.y);
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
  for (const [textPercent, textScale] of [[125, 1.25], [150, 1.5]]) {
    test(`${textPercent}% text keeps mobile toolbar, guidance, and selection toast readable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await loadScaledTextPreferences(page, viewport, textScale);
      await expect(page.getByTestId('world-item-count')).toBeVisible();
      await assertToolbarControls(page);
      await assertFirstActionGuidance(page);

      await assertToolbarGeometry(page, viewport);
      await assertToolbarTextIsNotClipped(page, textPercent);
      await assertHintDoesNotOverlapToolbar(page, 'normal');
      await assertHintFitsViewport(page, viewport, 'normal');

      await page.getByRole('button', { name: 'Select multiple items', exact: true }).click();
      await expect(page.getByTestId('multi-selection-toggle')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('multi-selection-count')).toHaveText('0 selected');
      await assertSelectionGuidance(page);
      await assertToolbarGeometry(page, viewport);
      await assertToolbarTextIsNotClipped(page, textPercent);
      await assertHintDoesNotOverlapToolbar(page, 'selection-count');
      await assertHintFitsViewport(page, viewport, 'selection-count');
      await assertSelectionToastGeometry(page, viewport);
      await assertSelectionToastTextIsNotClipped(page, textPercent);
    });
  }

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

for (const viewport of [
  { width: 320, height: 400 },
  { width: 390, height: 400 },
]) {
  test(`150% text keeps fresh-start toolbar and first-action guidance usable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await loadScaledTextPreferences(page, viewport, 1.5);
    await expect(page.getByTestId('world-item-count')).toBeVisible();
    await assertToolbarControls(page);
    await assertFirstActionLeadReadable(page);

    await assertToolbarGeometry(page, viewport);
    await assertToolbarTextIsNotClipped(page, 150);
    await assertToolbarControlsAreHitTestable(page);
    await assertHintDoesNotOverlapToolbar(page, 'fresh start');
    await assertHintFitsViewport(page, viewport, 'fresh start');
  });
}

for (const viewport of [
  { width: 320, height: 360 },
  { width: 667, height: 375 },
]) {
  test(`150% text keeps the fresh-start toolbar and hint usable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await loadScaledTextPreferences(page, viewport, 1.5);
    await expect(page.getByTestId('world-item-count')).toBeVisible();
    await expect(page.locator('html')).toHaveCSS('--text-scale', '1.5');
    await assertToolbarControls(page);
    await assertFirstActionLeadReadable(page);

    await assertToolbarTextIsNotClipped(page, 150);
    if (viewport.width === 320) {
      await assertCompactToolbarBoundsAndNoPageOverflow(page, viewport);
      await assertCompactToolbarTargetsWorkThroughKeyboardScroll(page);
    } else {
      await assertToolbarGeometry(page, viewport);
      await assertVisibleToolbarTargetsAreUsable(page);
    }
    await assertHintDoesNotOverlapToolbar(page, 'fresh start');
    await assertHintFitsViewport(page, viewport, 'fresh start');
  });
}

test('the Inspector keeps full guidance and its toolbar layout at 320x360 with 150% text', async ({ page }) => {
  const viewport = { width: 320, height: 360 };
  await loadScaledTextPreferences(page, viewport, 1.5);

  const lead = page.locator('.world-hint__lead');
  const guidanceControls = page.locator('.world-hint__controls');
  await expect(lead).toBeVisible();
  await assertFirstActionLeadReadable(page);
  await assertHintDoesNotOverlapToolbar(page, 'fresh start');
  await assertHintFitsViewport(page, viewport, 'fresh start');
  const initialScroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));

  const firstCalibrationCard = page.getByTestId('lab-item-calibration-card-01');
  await expect(firstCalibrationCard).toBeVisible();
  await firstCalibrationCard.click();

  await expect(page.getByTestId('item-inspector')).toBeVisible();
  await assertInspectorGuidanceLayout(page, viewport, initialScroll);
  const toolbar = page.locator('.game-toolbar');
  const initialToolbarScroll = await toolbar.evaluate((element) => element.scrollLeft);
  expect(initialToolbarScroll, 'the compact Inspector toolbar rail should begin at its first action').toBe(0);
  await assertCompactToolbarTargetsWorkThroughKeyboardScroll(page, { expectedPageScroll: initialScroll });
  const finalToolbarScroll = await toolbar.evaluate((element) => element.scrollLeft);
  expect(finalToolbarScroll, 'keyboard focus should scroll the compact rail to later toolbar actions').toBeGreaterThan(initialToolbarScroll);
});

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
