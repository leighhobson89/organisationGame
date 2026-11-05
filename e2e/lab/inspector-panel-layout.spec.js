import { expect, test } from '@playwright/test';
import { DESTINATIONS, SCRATCH_PADS } from '../../src/game/content/catalog.js';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { decodeSave, encodeSave } from '../../src/game/persistence/save.js';
import { PREFERENCES_STORAGE_KEY } from '../../src/game/preferences/preferences.js';
import { getTargetSlotPosition } from '../../src/game/world/placementLayout.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const calibrationCard = 'calibration-card-01';
const destinationId = 'cabinet-calibration';

async function measurePanelAndDocument(page) {
  return page.getByTestId('item-inspector').evaluate((panel) => {
    const panelRect = panel.getBoundingClientRect();
    const toolbarRect = document.querySelector('.game-toolbar')?.getBoundingClientRect() ?? null;
    const header = document.querySelector('.game-header');
    const headerRect = header?.getBoundingClientRect() ?? null;
    const details = panel.querySelector('.item-inspector__details');
    const detailsRect = details.getBoundingClientRect();
    const intersection = toolbarRect ? {
      left: Math.max(panelRect.left, toolbarRect.left),
      top: Math.max(panelRect.top, toolbarRect.top),
      right: Math.min(panelRect.right, toolbarRect.right),
      bottom: Math.min(panelRect.bottom, toolbarRect.bottom),
    } : null;
    if (intersection) {
      intersection.width = Math.max(0, intersection.right - intersection.left);
      intersection.height = Math.max(0, intersection.bottom - intersection.top);
      intersection.overlaps = intersection.width > 0 && intersection.height > 0;
    }
    return {
      panel: {
        left: panelRect.left,
        top: panelRect.top,
        right: panelRect.right,
        bottom: panelRect.bottom,
        width: panelRect.width,
        height: panelRect.height,
        scrollTop: panel.scrollTop,
        clientWidth: panel.clientWidth,
        scrollWidth: panel.scrollWidth,
      },
      panelBottomInset: window.innerHeight - panelRect.bottom,
      header: headerRect ? {
        top: headerRect.top,
        bottom: headerRect.bottom,
        height: headerRect.height,
        clientWidth: header.clientWidth,
        scrollWidth: header.scrollWidth,
      } : null,
      toolbar: toolbarRect ? {
        left: toolbarRect.left,
        top: toolbarRect.top,
        right: toolbarRect.right,
        bottom: toolbarRect.bottom,
        width: toolbarRect.width,
        height: toolbarRect.height,
      } : null,
      panelToolbarIntersection: intersection,
      details: {
        top: detailsRect.top,
        bottom: detailsRect.bottom,
        clientHeight: details.clientHeight,
        scrollHeight: details.scrollHeight,
        scrollTop: details.scrollTop,
        clientWidth: details.clientWidth,
        scrollWidth: details.scrollWidth,
      },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      document: {
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      },
    };
  });
}

async function measureFocusedControl(page, locator) {
  return locator.evaluate((control) => {
    const rect = control.getBoundingClientRect();
    const panel = control.closest('[data-testid="item-inspector"]');
    const toolbar = control.closest('.game-toolbar');
    const panelRect = panel?.getBoundingClientRect() ?? null;
    const toolbarRect = toolbar?.getBoundingClientRect() ?? null;
    const containerRect = panelRect ?? toolbarRect;
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      tagName: control.tagName,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      centerHit: Boolean(hit && control.contains(hit)),
      panel: panelRect ? { left: panelRect.left, top: panelRect.top, right: panelRect.right, bottom: panelRect.bottom } : null,
      container: containerRect ? { left: containerRect.left, top: containerRect.top, right: containerRect.right, bottom: containerRect.bottom } : null,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      active: document.activeElement === control,
    };
  });
}

async function tabUntilFocused(page, locator, maxTabs = 8) {
  for (let index = 0; index <= maxTabs; index += 1) {
    if (await locator.evaluate((element) => document.activeElement === element)) return;
    if (index < maxTabs) await page.keyboard.press('Tab');
  }

  throw new Error(`Keyboard navigation did not reach ${await locator.getAttribute('data-testid') ?? 'the requested control'} within ${maxTabs} Tab presses.`);
}

function expectControlUsable(measurement, label) {
  expect(measurement.active, `${label} should have keyboard focus`).toBe(true);
  expect(measurement.left, `${label} left edge should stay in the Inspector`).toBeGreaterThanOrEqual(measurement.panel.left);
  expect(measurement.top, `${label} top edge should stay in the Inspector`).toBeGreaterThanOrEqual(measurement.panel.top);
  expect(measurement.right, `${label} right edge should stay in the Inspector`).toBeLessThanOrEqual(measurement.panel.right);
  expect(measurement.bottom, `${label} bottom edge should stay in the Inspector`).toBeLessThanOrEqual(measurement.panel.bottom);
  expect(measurement.left, `${label} left edge should stay in the viewport`).toBeGreaterThanOrEqual(0);
  expect(measurement.top, `${label} top edge should stay in the viewport`).toBeGreaterThanOrEqual(0);
  expect(measurement.right, `${label} right edge should stay in the viewport`).toBeLessThanOrEqual(measurement.viewport.width);
  expect(measurement.bottom, `${label} bottom edge should stay in the viewport`).toBeLessThanOrEqual(measurement.viewport.height);
  expect(measurement.centerHit, `${label} center should be hit-testable`).toBe(true);
}

function expectControlUsableSoft(measurement, label) {
  expect.soft(measurement.active, `${label} should have keyboard focus`).toBe(true);
  expect.soft(measurement.left, `${label} left edge should stay in the Inspector`).toBeGreaterThanOrEqual(measurement.panel.left);
  expect.soft(measurement.top, `${label} top edge should stay in the Inspector`).toBeGreaterThanOrEqual(measurement.panel.top);
  expect.soft(measurement.right, `${label} right edge should stay in the Inspector`).toBeLessThanOrEqual(measurement.panel.right);
  expect.soft(measurement.bottom, `${label} bottom edge should stay in the Inspector`).toBeLessThanOrEqual(measurement.panel.bottom);
  expect.soft(measurement.left, `${label} left edge should stay in the viewport`).toBeGreaterThanOrEqual(0);
  expect.soft(measurement.top, `${label} top edge should stay in the viewport`).toBeGreaterThanOrEqual(0);
  expect.soft(measurement.right, `${label} right edge should stay in the viewport`).toBeLessThanOrEqual(measurement.viewport.width);
  expect.soft(measurement.bottom, `${label} bottom edge should stay in the viewport`).toBeLessThanOrEqual(measurement.viewport.height);
  expect.soft(measurement.centerHit, `${label} center should be hit-testable`).toBe(true);
}

function expectToolbarControlUsable(measurement, label) {
  expect(measurement.active, `${label} should have keyboard focus`).toBe(true);
  expect(measurement.container, `${label} should belong to the world toolbar`).not.toBeNull();
  expect(measurement.left, `${label} left edge should stay in the viewport`).toBeGreaterThanOrEqual(0);
  expect(measurement.top, `${label} top edge should stay in the viewport`).toBeGreaterThanOrEqual(0);
  expect(measurement.right, `${label} right edge should stay in the viewport`).toBeLessThanOrEqual(measurement.viewport.width);
  expect(measurement.bottom, `${label} bottom edge should stay in the viewport`).toBeLessThanOrEqual(measurement.viewport.height);
  expect(measurement.centerHit, `${label} center should be hit-testable`).toBe(true);
}

async function assertToolbarTextDoesNotOverflow(page, textPercent) {
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
    expect(control.scrollWidth, `${control.name} toolbar text should not overflow horizontally at ${textPercent}%`).toBeLessThanOrEqual(control.clientWidth + 1);
    expect(control.scrollHeight, `${control.name} toolbar text should not overflow vertically at ${textPercent}%`).toBeLessThanOrEqual(control.clientHeight + 1);
  }
}

async function openCalibrationInspector(page, viewport, textScale, { clue } = {}) {
  await page.setViewportSize(viewport);

  const state = createNewGameState();
  if (clue) state.items.find((item) => item.id === calibrationCard).clue = clue;
  await page.addInitScript(({ autosaveKey, autosaveValue, preferencesKey, scale }) => {
    window.localStorage.setItem(autosaveKey, autosaveValue);
    window.localStorage.setItem(preferencesKey, JSON.stringify({
      version: 1,
      textScale: scale,
      reduceMotion: false,
      soundEffectsEnabled: false,
    }));
  }, {
    autosaveKey: autoSaveKey,
    autosaveValue: encodeSave(state),
    preferencesKey: PREFERENCES_STORAGE_KEY,
    scale: textScale,
  });
  await page.goto('/');

  await page.getByRole('button', { name: 'Find an item' }).click();
  await page.getByRole('searchbox', { name: 'Search laboratory items' }).fill(calibrationCard);
  const finderResult = page.getByTestId(`item-finder-result-${calibrationCard}`);
  await finderResult.focus();
  await page.keyboard.press('Enter');

  const panel = page.getByTestId('item-inspector');
  await expect(panel).toBeVisible();
  return panel;
}

async function openCompactGroupInspector(page, viewport, textScale) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(({ preferencesKey, scale }) => {
    window.localStorage.clear();
    window.localStorage.setItem(preferencesKey, JSON.stringify({
      version: 1,
      textScale: scale,
      reduceMotion: false,
      soundEffectsEnabled: false,
    }));
  }, { preferencesKey: PREFERENCES_STORAGE_KEY, scale: textScale });
  await page.goto('/');

  const selectionToggle = page.getByTestId('multi-selection-toggle');
  await selectionToggle.click();
  await page.getByTestId('lab-item-calibration-card-01').click();
  await page.getByTestId('lab-item-calibration-card-02').click();
  const selectedCount = page.getByTestId('multi-selection-count');
  await expect(selectedCount).toHaveText('2 selected');

  await page.setViewportSize(viewport);
  const panel = page.getByTestId('item-inspector');
  await expect(panel).toBeVisible();
  return { panel, selectedCount };
}

async function measureToolbarScrollport(page) {
  return page.locator('.game-toolbar').evaluate((toolbar) => {
    let candidate = toolbar;
    while (candidate) {
      const style = window.getComputedStyle(candidate);
      if (candidate.scrollWidth > candidate.clientWidth + 1 && /auto|scroll/.test(style.overflowX)) {
        const rect = candidate.getBoundingClientRect();
        return {
          tagName: candidate.tagName,
          className: typeof candidate.className === 'string' ? candidate.className : '',
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          clientWidth: candidate.clientWidth,
          scrollWidth: candidate.scrollWidth,
          scrollLeft: candidate.scrollLeft,
          overflowX: style.overflowX,
        };
      }
      candidate = candidate.parentElement;
    }
    return null;
  });
}

async function expectCompactInspectorActions(page, panel, { group = false } = {}) {
  const controls = [
    [panel.getByRole('button', { name: 'Close item inspector' }), 'Close'],
    [page.getByTestId('move-target'), 'destination selector'],
    [page.getByTestId(group ? 'move-selected-items' : 'move-item'), 'Move'],
    ...(!group ? [[panel.getByRole('button', { name: 'Focus this object in the lab' }), 'Focus']] : []),
  ];
  for (const [control, label] of controls) {
    await control.focus();
    const measurement = await measureFocusedControl(page, control);
    expectControlUsable(measurement, `${label} in compact Inspector`);
  }
}

async function expectCompactHeaderControls(page) {
  const controls = [
    [page.getByTestId('toggle-notebook'), 'Notebook'],
    [page.getByTestId('toggle-skills'), 'Instruments'],
    [page.getByTestId('open-saves'), 'Save and restore'],
    [page.getByTestId('open-settings'), 'Settings'],
  ];
  for (const [control, label] of controls) {
    await control.focus();
    const measurement = await measureFocusedControl(page, control);
    expect(measurement.active, `${label} should receive keyboard focus`).toBe(true);
    expect(measurement.left, `${label} should remain in the viewport`).toBeGreaterThanOrEqual(0);
    expect(measurement.top, `${label} should remain in the viewport`).toBeGreaterThanOrEqual(0);
    expect(measurement.right, `${label} should remain in the viewport`).toBeLessThanOrEqual(measurement.viewport.width);
    expect(measurement.bottom, `${label} should remain in the viewport`).toBeLessThanOrEqual(measurement.viewport.height);
    expect(measurement.centerHit, `${label} center should remain hit-testable`).toBe(true);
    expect(measurement.bottom - measurement.top, `${label} should retain a 35px header target`).toBeGreaterThanOrEqual(35);
  }
}

for (const viewport of [{ width: 320, height: 360 }, { width: 390, height: 360 }]) {
  test(`Long-clue single-item Inspector and world toolbar remain accessible at ${viewport.width}x${viewport.height} with 150% text`, async ({ page }) => {
    const clue = 'The recorder caught a fragment through the wavering chamber echo. '.repeat(16).slice(0, 980);
    const panel = await openCalibrationInspector(page, viewport, 1.5, { clue });
    const close = panel.getByRole('button', { name: 'Close item inspector' });
    const target = page.getByTestId('move-target');
    const move = page.getByTestId('move-item');
    const focus = panel.getByRole('button', { name: 'Focus this object in the lab' });
    const initialMeasurement = await measurePanelAndDocument(page);
    console.info(`Inspector ${viewport.width}×${viewport.height} initial layout: ${JSON.stringify(initialMeasurement)}`);
  
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim())).toBe('1.5');
    expect(initialMeasurement.viewport).toEqual(viewport);
    expect(initialMeasurement.panel.left).toBeGreaterThanOrEqual(0);
    expect(initialMeasurement.panel.top).toBeGreaterThanOrEqual(0);
    expect(initialMeasurement.panel.right).toBeLessThanOrEqual(viewport.width);
    expect(initialMeasurement.panel.bottom).toBeLessThanOrEqual(viewport.height);
    expect(initialMeasurement.panelBottomInset, 'Inspector should leave a usable bottom safe margin').toBeGreaterThanOrEqual(8);
    expect(initialMeasurement.panelToolbarIntersection.overlaps, 'Inspector and world toolbar should not overlap').toBe(false);
    expect(initialMeasurement.details.clientHeight, 'long-clue details should retain at least 48px of scrollport').toBeGreaterThanOrEqual(48);
    expect(initialMeasurement.details.scrollHeight, 'long-clue details should scroll internally').toBeGreaterThan(initialMeasurement.details.clientHeight);
  
    await close.focus();
    const inspectorControls = [[close, 'Close'], [target, 'destination selector'], [move, 'Move'], [focus, 'Focus']];
    for (const [index, [control, label]] of inspectorControls.entries()) {
      if (index > 0) await tabUntilFocused(page, control);
      await expect(control, `${label} should be keyboard reachable`).toBeFocused();
      const measurement = await measureFocusedControl(page, control);
      console.info(`${label} at ${viewport.width}×${viewport.height}: ${JSON.stringify(measurement)}`);
      expectControlUsable(measurement, label);
    }
  
    const toolbarControls = [
      [page.getByRole('button', { name: 'Zoom out' }), 'Zoom out'],
      [page.getByRole('button', { name: 'Zoom in' }), 'Zoom in'],
      [page.getByTestId('world-jump'), 'World jump'],
      [page.getByRole('button', { name: 'Reset view' }), 'Reset view'],
      [page.getByRole('button', { name: 'Find an item' }), 'Find an item'],
      [page.getByTestId('multi-selection-toggle'), 'Select multiple items'],
    ];
    for (const [index, [control, label]] of toolbarControls.entries()) {
      if (index === 0) await control.focus();
      else await tabUntilFocused(page, control);
      const measurement = await measureFocusedControl(page, control);
      console.info(`${label} at ${viewport.width}×${viewport.height}: ${JSON.stringify(measurement)}`);
      expectToolbarControlUsable(measurement, label);
    }
    await assertToolbarTextDoesNotOverflow(page, 150);
  
    const panelBeforeDetailsScroll = await panel.boundingBox();
    const documentBeforeDetailsScroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    const details = panel.locator('.item-inspector__details');
    await details.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect.poll(() => details.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const afterDetailsScroll = await measurePanelAndDocument(page);
    expect(afterDetailsScroll.panel).toMatchObject({
      left: panelBeforeDetailsScroll.x,
      top: panelBeforeDetailsScroll.y,
      width: panelBeforeDetailsScroll.width,
      height: panelBeforeDetailsScroll.height,
    });
    expect(afterDetailsScroll.document).toMatchObject({ scrollX: documentBeforeDetailsScroll.x, scrollY: documentBeforeDetailsScroll.y });
    expect(afterDetailsScroll.details.scrollTop).toBeGreaterThan(0);
    expect(afterDetailsScroll.details.clientHeight).toBeGreaterThanOrEqual(48);
  });
}

test('single-item Inspector and toolbar remain readable and reachable at 320x360 with 200% text', async ({ page }) => {
  const viewport = { width: 320, height: 360 };
  const clue = 'The recorder caught a fragment through the wavering chamber echo. '.repeat(24).slice(0, 980);
  const panel = await openCalibrationInspector(page, viewport, 2, { clue });
  const initial = await measurePanelAndDocument(page);

  await expect(page.locator('html')).toHaveCSS('--text-scale', '2');
  expect(initial.viewport).toEqual(viewport);
  expect(initial.panel.left).toBeGreaterThanOrEqual(0);
  expect(initial.panel.top).toBeGreaterThanOrEqual(0);
  expect(initial.panel.right).toBeLessThanOrEqual(viewport.width);
  expect(initial.panel.bottom).toBeLessThanOrEqual(viewport.height);
  expect(initial.panelBottomInset, '200% Inspector should retain a safe viewport margin').toBeGreaterThanOrEqual(8);
  expect(initial.panelToolbarIntersection.overlaps, '200% Inspector should not cover the world toolbar').toBe(false);
  expect(initial.document.scrollWidth, '200% Inspector should not create page-level horizontal overflow').toBeLessThanOrEqual(viewport.width);
  expect(initial.panel.scrollWidth, 'Inspector panel should not overflow horizontally').toBeLessThanOrEqual(initial.panel.clientWidth + 1);
  expect(initial.details.clientHeight, '200% Inspector details should retain a usable scrollport').toBeGreaterThanOrEqual(48);
  expect(initial.details.scrollHeight, 'long Inspector clue should be reachable by internal scrolling').toBeGreaterThan(initial.details.clientHeight);

  const clueText = panel.locator('.item-clue');
  const clueDimensions = await clueText.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(clueDimensions.scrollWidth, '200% clue text should wrap without horizontal clipping')
    .toBeLessThanOrEqual(clueDimensions.clientWidth + 1);
  expect(clueDimensions.scrollHeight, 'the clue paragraph should expose its full text within the details scroll area')
    .toBeLessThanOrEqual(clueDimensions.clientHeight + 1);

  const inspectorControls = [
    [panel.getByRole('button', { name: 'Close item inspector' }), 'Close'],
    [page.getByTestId('move-target'), 'destination selector'],
    [page.getByTestId('move-item'), 'Move'],
    [panel.getByRole('button', { name: 'Focus this object in the lab' }), 'Focus'],
  ];
  for (const [index, [control, label]] of inspectorControls.entries()) {
    if (index === 0) await control.focus();
    else await tabUntilFocused(page, control);
    expectControlUsable(await measureFocusedControl(page, control), `${label} action at 200%`);
  }

  const toolbarControls = [
    [page.getByRole('button', { name: 'Zoom out' }), 'Zoom out'],
    [page.getByRole('button', { name: 'Zoom in' }), 'Zoom in'],
    [page.getByTestId('world-jump'), 'World jump'],
    [page.getByRole('button', { name: 'Reset view' }), 'Reset view'],
    [page.getByRole('button', { name: 'Find an item' }), 'Find an item'],
    [page.getByTestId('multi-selection-toggle'), 'Select multiple items'],
  ];
  for (const [index, [control, label]] of toolbarControls.entries()) {
    if (index === 0) await control.focus();
    else await tabUntilFocused(page, control);
    expectToolbarControlUsable(await measureFocusedControl(page, control), `${label} at 200%`);
  }
  await assertToolbarTextDoesNotOverflow(page, 200);

  const panelBeforeDetailsScroll = await panel.boundingBox();
  const documentBeforeDetailsScroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  const details = panel.locator('.item-inspector__details');
  await details.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => details.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const afterDetailsScroll = await measurePanelAndDocument(page);
  expect(afterDetailsScroll.panel).toMatchObject({
    left: panelBeforeDetailsScroll.x,
    top: panelBeforeDetailsScroll.y,
    width: panelBeforeDetailsScroll.width,
    height: panelBeforeDetailsScroll.height,
  });
  expect(afterDetailsScroll.document).toMatchObject({ scrollX: documentBeforeDetailsScroll.x, scrollY: documentBeforeDetailsScroll.y });
  expect(afterDetailsScroll.details.scrollTop).toBeGreaterThan(0);
});

for (const viewport of [{ width: 320, height: 480 }, { width: 390, height: 480 }]) {
  test(`Inspector at 150% keeps controls operable at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);

    const state = createNewGameState();
    const startingItem = state.items.find((item) => item.id === calibrationCard);
    const originalWorkspacePosition = { ...startingItem.position };
    startingItem.clue = `${'The recorder caught a fragment through the wavering chamber echo. '.repeat(24)}`.slice(0, 980);
    const initialSave = encodeSave(state);
    const initialRootKeys = Object.keys(state).sort();
    await page.addInitScript(({ autosaveKey, autosaveValue, preferencesKey }) => {
      window.localStorage.setItem(autosaveKey, autosaveValue);
      window.localStorage.setItem(preferencesKey, JSON.stringify({
        version: 1,
        textScale: 1.5,
        reduceMotion: false,
        soundEffectsEnabled: false,
      }));
    }, { autosaveKey: autoSaveKey, autosaveValue: initialSave, preferencesKey: PREFERENCES_STORAGE_KEY });
    await page.goto('/');

    const appliedScale = await page.evaluate(() => ({
      variable: getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim(),
      rootFontSize: getComputedStyle(document.documentElement).fontSize,
    }));
    expect(appliedScale.variable).toBe('1.5');
    expect(Number.parseFloat(appliedScale.rootFontSize)).toBeCloseTo(24, 0);

    const pageScrollBeforeSelection = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    await page.getByRole('button', { name: 'Find an item' }).click();
    await page.getByRole('searchbox', { name: 'Search laboratory items' }).fill(calibrationCard);
    const finderResult = page.getByTestId(`item-finder-result-${calibrationCard}`);
    await finderResult.focus();
    await page.keyboard.press('Enter');

    const panel = page.getByTestId('item-inspector');
    const close = panel.getByRole('button', { name: 'Close item inspector' });
    const target = page.getByTestId('move-target');
    const move = page.getByTestId('move-item');
    const focus = panel.getByRole('button', { name: 'Focus this object in the lab' });
    await expect(panel).toBeVisible();
    await expect(target).toBeFocused();
    await close.focus();
    await expect(close).toBeFocused();

    const initialMeasurement = await measurePanelAndDocument(page);
    console.info(`Inspector ${viewport.width}×${viewport.height} initial layout: ${JSON.stringify(initialMeasurement)}`);
    expect(initialMeasurement.viewport).toEqual(viewport);
    expect(initialMeasurement.panel.left).toBeGreaterThanOrEqual(0);
    expect(initialMeasurement.panel.top).toBeGreaterThanOrEqual(0);
    expect(initialMeasurement.panel.right).toBeLessThanOrEqual(viewport.width);
    expect(initialMeasurement.panel.bottom).toBeLessThanOrEqual(viewport.height);
    expect(initialMeasurement.panelBottomInset, 'Inspector should leave a usable bottom safe margin').toBeGreaterThanOrEqual(8);
    expect(initialMeasurement.document.scrollWidth).toBeLessThanOrEqual(viewport.width);
    expect(initialMeasurement.panel.scrollWidth).toBeLessThanOrEqual(initialMeasurement.panel.clientWidth + 1);
    expect(initialMeasurement.details.scrollWidth).toBeLessThanOrEqual(initialMeasurement.details.clientWidth + 1);
    expect(initialMeasurement.details.clientHeight).toBeGreaterThanOrEqual(48);
    expect(initialMeasurement.details.scrollHeight).toBeGreaterThan(initialMeasurement.details.clientHeight);
    expect(initialMeasurement.panelToolbarIntersection.overlaps, 'Inspector and world toolbar should not overlap').toBe(false);
    expect(initialMeasurement.document).toMatchObject({ scrollX: pageScrollBeforeSelection.x, scrollY: pageScrollBeforeSelection.y });

    for (const [index, [control, label]] of [[close, 'Close'], [target, 'destination selector'], [move, 'Move'], [focus, 'Focus']].entries()) {
      if (index === 0) await expect(control).toBeFocused();
      else await tabUntilFocused(page, control);
      await expect(control).toBeFocused();
      const measurement = await measureFocusedControl(page, control);
      console.info(`${label} at ${viewport.width}×${viewport.height}: ${JSON.stringify(measurement)}`);
      expectControlUsable(measurement, label);
    }

    const toolbarControls = [
      [page.getByRole('button', { name: 'Zoom out' }), 'Zoom out'],
      [page.getByRole('button', { name: 'Zoom in' }), 'Zoom in'],
      [page.getByTestId('world-jump'), 'World jump'],
      [page.getByRole('button', { name: 'Reset view' }), 'Reset view'],
      [page.getByRole('button', { name: 'Find an item' }), 'Find an item'],
      [page.getByTestId('multi-selection-toggle'), 'Select multiple items'],
    ];
    for (const [index, [control, label]] of toolbarControls.entries()) {
      if (index === 0) await control.focus();
      else await tabUntilFocused(page, control);
      const measurement = await measureFocusedControl(page, control);
      console.info(`${label} at ${viewport.width}×${viewport.height}: ${JSON.stringify(measurement)}`);
      expectToolbarControlUsable(measurement, label);
    }
    await assertToolbarTextDoesNotOverflow(page, 150);

    const panelBeforeDetailsScroll = await panel.boundingBox();
    const documentBeforeDetailsScroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    const panelScrollBeforeDetailsScroll = await measurePanelAndDocument(page);
    const details = panel.locator('.item-inspector__details');
    await details.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect.poll(() => details.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const afterDetailsScroll = await measurePanelAndDocument(page);
    const panelAfterDetailsScroll = await panel.boundingBox();
    console.info(`Inspector ${viewport.width}×${viewport.height} after detail scroll: ${JSON.stringify(afterDetailsScroll)}`);
    expect(afterDetailsScroll.details.scrollTop).toBeGreaterThan(0);
    expect(afterDetailsScroll.panel.scrollTop).toBe(panelScrollBeforeDetailsScroll.panel.scrollTop);
    expect(afterDetailsScroll.panel).toMatchObject({
      left: panelBeforeDetailsScroll.x,
      top: panelBeforeDetailsScroll.y,
      width: panelBeforeDetailsScroll.width,
      height: panelBeforeDetailsScroll.height,
    });
    expect(afterDetailsScroll.document).toMatchObject({ scrollX: documentBeforeDetailsScroll.x, scrollY: documentBeforeDetailsScroll.y });
    expect(afterDetailsScroll.document.scrollWidth).toBeLessThanOrEqual(viewport.width);
    expect(panelAfterDetailsScroll).toMatchObject(panelBeforeDetailsScroll);

    await target.focus();
    await expect(target).toBeFocused();
    const targetAfterScroll = await measureFocusedControl(page, target);
    console.info(`Target after detail scroll at ${viewport.width}×${viewport.height}: ${JSON.stringify(targetAfterScroll)}`);
    expectControlUsable(targetAfterScroll, 'destination selector after detail scroll');
    await page.keyboard.press('Tab');
    await tabUntilFocused(page, move);
    await expect(move).toBeFocused();
    const moveAfterScroll = await measureFocusedControl(page, move);
    console.info(`Move after detail scroll at ${viewport.width}×${viewport.height}: ${JSON.stringify(moveAfterScroll)}`);
    expectControlUsable(moveAfterScroll, 'Move after detail scroll');

    await target.focus();
    const optionIndex = await target.evaluate((select, value) => [...select.options].findIndex((option) => option.value === value), destinationId);
    expect(optionIndex).toBeGreaterThanOrEqual(0);
    await page.keyboard.press('Home');
    for (let index = 0; index < optionIndex; index += 1) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(target).toHaveValue(destinationId);
    await move.focus();
    await expect(move).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('destination-cabinet-calibration')).toHaveAttribute('aria-label', /1 of 8 objects placed/i);
    await expect(page.getByTestId('game-feedback')).toHaveRole('status');
    await expect(page.getByTestId('game-feedback')).toContainText(/filed correctly/i);
    await expect(move).toBeFocused();
    await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');

    await expect.poll(async () => {
      const rawSave = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
      if (!rawSave) return null;
      return decodeSave(rawSave).items.find((item) => item.id === calibrationCard)?.placement?.destinationId ?? null;
    }).toBe(destinationId);

    const savedState = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
    const savedItem = savedState.items.find((item) => item.id === calibrationCard);
    expect(Object.keys(savedState).sort()).toEqual(initialRootKeys);
    expect(savedState.version).toBe(state.version);
    expect(savedState).not.toHaveProperty('textScale');
    expect(savedItem.placement).toEqual({ kind: 'destination', destinationId, slotIndex: 0 });
    expect(savedItem.position).toEqual(getTargetSlotPosition({
      target: { kind: 'destination', id: destinationId },
      item: startingItem,
      slotIndex: 0,
      destinations: DESTINATIONS,
      scratchPads: SCRATCH_PADS,
    }));
    expect(savedItem.previousWorkspacePosition).toEqual(originalWorkspacePosition);
    const preferences = JSON.parse(await page.evaluate((key) => window.localStorage.getItem(key), PREFERENCES_STORAGE_KEY));
    expect(preferences).toMatchObject({ version: 1, textScale: 1.5 });
  });
}

for (const viewport of [{ width: 320, height: 480 }, { width: 390, height: 480 }]) {
  test(`Inspector and world toolbar stay separately usable at 125% on ${viewport.width}×${viewport.height}`, async ({ page }) => {
    const panel = await openCalibrationInspector(page, viewport, 1.25);
    const measurement = await measurePanelAndDocument(page);
    console.info(`Inspector 125% ${viewport.width}×${viewport.height}: ${JSON.stringify(measurement)}`);
    expect(measurement.panel.left).toBeGreaterThanOrEqual(0);
    expect(measurement.panel.top).toBeGreaterThanOrEqual(0);
    expect(measurement.panel.right).toBeLessThanOrEqual(viewport.width);
    expect(measurement.panel.bottom).toBeLessThanOrEqual(viewport.height);
    expect(measurement.panelBottomInset, 'Inspector should leave a usable bottom safe margin').toBeGreaterThanOrEqual(8);
    expect(measurement.panelToolbarIntersection.overlaps, 'Inspector and world toolbar should not overlap').toBe(false);

    const inspectorControls = [
      [panel.getByRole('button', { name: 'Close item inspector' }), 'Close'],
      [page.getByTestId('move-target'), 'destination selector'],
      [page.getByTestId('move-item'), 'Move'],
      [panel.getByRole('button', { name: 'Focus this object in the lab' }), 'Focus'],
    ];
    for (const [control, label] of inspectorControls) {
      await control.focus();
      const focused = await measureFocusedControl(page, control);
      expectControlUsable(focused, `${label} at 125%`);
    }

    const toolbarControls = [
      [page.getByRole('button', { name: 'Zoom out' }), 'Zoom out'],
      [page.getByRole('button', { name: 'Zoom in' }), 'Zoom in'],
      [page.getByTestId('world-jump'), 'World jump'],
      [page.getByRole('button', { name: 'Reset view' }), 'Reset view'],
      [page.getByRole('button', { name: 'Find an item' }), 'Find an item'],
      [page.getByTestId('multi-selection-toggle'), 'Select multiple items'],
    ];
    for (const [index, [control, label]] of toolbarControls.entries()) {
      if (index === 0) await control.focus();
      else await tabUntilFocused(page, control);
      const focused = await measureFocusedControl(page, control);
      expectToolbarControlUsable(focused, `${label} at 125%`);
    }
    await assertToolbarTextDoesNotOverflow(page, 125);
  });
}

test('third-row group selection keeps the compact Inspector and toolbar controls usable at 320×480', async ({ page }) => {
  const desktopViewport = { width: 1280, height: 720 };
  const viewport = { width: 320, height: 480 };
  await page.setViewportSize(desktopViewport);

  await page.addInitScript(({ preferencesKey }) => {
    window.localStorage.clear();
    window.localStorage.setItem(preferencesKey, JSON.stringify({
      version: 1,
      textScale: 1.5,
      reduceMotion: false,
      soundEffectsEnabled: false,
    }));
  }, { preferencesKey: PREFERENCES_STORAGE_KEY });
  await page.goto('/');

  const selectionToggle = page.getByTestId('multi-selection-toggle');
  await selectionToggle.click();
  await expect(selectionToggle).toHaveAttribute('aria-pressed', 'true');
  const firstItem = page.getByTestId('lab-item-calibration-card-01');
  const secondItem = page.getByTestId('lab-item-calibration-card-02');
  await expect(firstItem).toBeVisible();
  await expect(secondItem).toBeVisible();
  await firstItem.click();
  await secondItem.click();
  const selectedCount = page.getByTestId('multi-selection-count');
  await expect(selectedCount).toHaveText('2 selected');

  const panel = page.getByTestId('item-inspector');
  await expect(panel).toBeVisible();
  await page.setViewportSize(viewport);
  await expect(panel).toBeVisible();
  await expect(selectedCount).toHaveText('2 selected');
  await expect(panel).toBeVisible();
  const measurement = await measurePanelAndDocument(page);
  console.info(`Inspector group 150% ${viewport.width}×${viewport.height}: ${JSON.stringify(measurement)}`);
  expect(measurement.panel.left).toBeGreaterThanOrEqual(0);
  expect(measurement.panel.top).toBeGreaterThanOrEqual(0);
  expect(measurement.panel.right).toBeLessThanOrEqual(viewport.width);
  expect(measurement.panel.bottom).toBeLessThanOrEqual(viewport.height);
  expect(measurement.panelBottomInset, 'group Inspector should leave a usable bottom safe margin').toBeGreaterThanOrEqual(8);
  expect(measurement.panelToolbarIntersection.overlaps, 'group Inspector and expanded toolbar should not overlap').toBe(false);
  const groupDetails = panel.getByTestId('selected-items-summary');
  const detailsMeasurement = await groupDetails.evaluate((details) => ({
    clientHeight: details.clientHeight,
    scrollHeight: details.scrollHeight,
    scrollTop: details.scrollTop,
  }));
  expect(detailsMeasurement.clientHeight, 'group Inspector details should remain scrollable').toBeGreaterThanOrEqual(48);
  expect(detailsMeasurement.scrollHeight).toBeGreaterThan(detailsMeasurement.clientHeight);
  await groupDetails.evaluate((details) => { details.scrollTop = details.scrollHeight; });
  await expect.poll(() => groupDetails.evaluate((details) => details.scrollTop)).toBeGreaterThan(0);

  await selectionToggle.focus();
  expectToolbarControlUsable(await measureFocusedControl(page, selectionToggle), 'multi-selection toggle at 150%');

  const groupMove = page.getByTestId('move-selected-items');
  await groupMove.focus();
  expectControlUsable(await measureFocusedControl(page, groupMove), 'group Move at 150%');

  const countMeasurement = await measureFocusedControl(page, selectedCount);
  expect(countMeasurement.top, 'selection count should occupy the expanded toolbar third row').toBeGreaterThan(measurement.toolbar.top + 70);
  expect(countMeasurement.left).toBeGreaterThanOrEqual(countMeasurement.container.left);
  expect(countMeasurement.top).toBeGreaterThanOrEqual(countMeasurement.container.top);
  expect(countMeasurement.right).toBeLessThanOrEqual(countMeasurement.container.right);
  expect(countMeasurement.bottom).toBeLessThanOrEqual(countMeasurement.container.bottom);
  expect(countMeasurement.left).toBeGreaterThanOrEqual(0);
  expect(countMeasurement.top).toBeGreaterThanOrEqual(0);
  expect(countMeasurement.right).toBeLessThanOrEqual(viewport.width);
  expect(countMeasurement.bottom).toBeLessThanOrEqual(viewport.height);
  expect(countMeasurement.centerHit, 'selection-count center should be hit-testable').toBe(true);
  await assertToolbarTextDoesNotOverflow(page, 150);
});

test('200% group Inspector keeps all eight evidence rows reachable by keyboard at 320x360', async ({ page }) => {
  const viewport = { width: 320, height: 360 };
  await page.setViewportSize(viewport);
  const initialState = createNewGameState();
  await page.addInitScript(({ preferencesKey }) => {
    window.localStorage.clear();
    window.localStorage.setItem(preferencesKey, JSON.stringify({
      version: 1,
      textScale: 2,
      reduceMotion: false,
      soundEffectsEnabled: false,
    }));
  }, { preferencesKey: PREFERENCES_STORAGE_KEY });
  await page.goto('/');
  await expect(page.locator('html')).toHaveCSS('--text-scale', '2');

  const selectionToggle = page.getByTestId('multi-selection-toggle');
  await selectionToggle.focus();
  await selectionToggle.press('Enter');
  await expect(selectionToggle).toHaveAttribute('aria-pressed', 'true');

  const itemIds = Array.from({ length: 8 }, (_, index) => `calibration-card-${String(index + 1).padStart(2, '0')}`);
  const findButton = page.getByRole('button', { name: 'Find an item', exact: true });
  const search = page.getByRole('searchbox', { name: 'Search laboratory items' });
  const selectedCount = page.getByTestId('multi-selection-count');
  for (const [index, itemId] of itemIds.entries()) {
    await findButton.focus();
    await findButton.press('Enter');
    await expect(search).toBeFocused();
    await search.fill(itemId);
    const result = page.getByTestId(`item-finder-result-${itemId}`);
    await expect(result).toBeVisible();
    await result.focus();
    await result.press('Enter');
    await expect(selectedCount).toHaveText(`${index + 1} selected`);
  }

  const panel = page.getByTestId('item-inspector');
  const summary = panel.getByTestId('selected-items-summary');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: '8 objects selected' })).toBeVisible();
  expect.soft(summary).toHaveRole('region');
  expect.soft(summary).toHaveAccessibleName('Selected objects and evidence');
  const rows = summary.getByRole('listitem');
  await expect(rows).toHaveCount(8);
  const calibrationItems = itemIds.map((itemId) => initialState.items.find((item) => item.id === itemId));
  for (const item of calibrationItems) {
    const row = rows.filter({ has: page.getByText(item.title, { exact: true }) });
    await expect(row).toHaveCount(1);
    await expect(row.locator('.selected-item-family')).toHaveText('Resonance tuning plate');
    await expect(row.locator('.selected-item-clue')).toHaveText(item.clue);
  }

  const layout = await measurePanelAndDocument(page);
  expect(layout.viewport).toEqual(viewport);
  expect(layout.panel.left).toBeGreaterThanOrEqual(0);
  expect(layout.panel.top).toBeGreaterThanOrEqual(0);
  expect(layout.panel.right).toBeLessThanOrEqual(viewport.width);
  expect(layout.panel.bottom).toBeLessThanOrEqual(viewport.height);
  expect(layout.document.scrollWidth, 'group Inspector should not create page-level horizontal overflow').toBeLessThanOrEqual(viewport.width);
  expect(layout.toolbar.left).toBeGreaterThanOrEqual(0);
  expect(layout.toolbar.right).toBeLessThanOrEqual(viewport.width);
  expect(layout.toolbar.top).toBeGreaterThanOrEqual(0);
  expect(layout.toolbar.bottom).toBeLessThanOrEqual(viewport.height);
  expect(layout.panelToolbarIntersection.overlaps, 'group Inspector should stay clear of the toolbar').toBe(false);

  const close = panel.getByRole('button', { name: 'Close item inspector' });
  const target = page.getByTestId('move-target');
  const move = page.getByTestId('move-selected-items');
  await expect(move).toHaveAccessibleName('Move 8 selected items');
  await close.focus();
  expectControlUsableSoft(await measureFocusedControl(page, close), 'group Inspector Close at 200%');
  await target.focus();
  const initialTargetMeasurement = await measureFocusedControl(page, target);
  expect.soft(initialTargetMeasurement.right - initialTargetMeasurement.left, 'group destination selector should retain at least 120px of width')
    .toBeGreaterThanOrEqual(120);
  expectControlUsableSoft(initialTargetMeasurement, 'group destination selector at 200%');
  await move.focus();
  expectControlUsableSoft(await measureFocusedControl(page, move), 'group Move at 200%');

  await close.focus();
  const beforeKeyboardScroll = await summary.evaluate((details) => ({
    scrollTop: details.scrollTop,
    clientHeight: details.clientHeight,
    scrollHeight: details.scrollHeight,
  }));
  expect.soft(beforeKeyboardScroll.scrollHeight, 'the selected-items evidence list should overflow its scroll region')
    .toBeGreaterThan(beforeKeyboardScroll.clientHeight);
  expect.soft(beforeKeyboardScroll.clientHeight, 'the selected-items evidence region should keep visible scrolling space')
    .toBeGreaterThan(0);
  await page.keyboard.press('Tab');
  const evidenceRegionFocused = await summary.evaluate((details) => document.activeElement === details);
  expect.soft(evidenceRegionFocused, 'Tab from Close should focus the selected-items evidence scroll region').toBe(true);
  await page.keyboard.press('PageDown');
  const afterPageDown = await summary.evaluate((details) => ({
    scrollTop: details.scrollTop,
    focused: document.activeElement === details,
  }));
  await page.keyboard.press('End');
  const afterEnd = await summary.evaluate((details) => {
    const detailsRect = details.getBoundingClientRect();
    const lastClue = details.querySelector('.selected-item-list > li:last-child .selected-item-clue');
    const clueRect = lastClue.getBoundingClientRect();
    return {
      scrollTop: details.scrollTop,
      focused: document.activeElement === details,
      lastClueVisible: clueRect.top >= detailsRect.top - 1 && clueRect.bottom <= detailsRect.bottom + 1,
    };
  });
  expect.soft(afterPageDown.focused, 'the evidence region should retain focus after PageDown').toBe(true);
  expect.soft(afterEnd.focused, 'the evidence region should retain focus after End').toBe(true);
  expect.soft(afterPageDown.scrollTop, 'PageDown should scroll the selected-items evidence region').toBeGreaterThan(beforeKeyboardScroll.scrollTop);
  expect.soft(afterEnd.scrollTop, 'End should scroll the selected-items evidence region to its end').toBeGreaterThan(afterPageDown.scrollTop);
  expect.soft(afterEnd.lastClueVisible, 'End should expose the eighth calibration-card clue').toBe(true);

  await target.focus();
  const targetMeasurementAfterScroll = await measureFocusedControl(page, target);
  expect.soft(targetMeasurementAfterScroll.right - targetMeasurementAfterScroll.left, 'group destination selector should remain at least 120px wide after evidence scrolling')
    .toBeGreaterThanOrEqual(120);
  expectControlUsableSoft(targetMeasurementAfterScroll, 'group destination selector after evidence scrolling');
  await target.selectOption('scratch-a');
  await expect(target).toHaveValue('scratch-a');
  await move.focus();
  expectControlUsableSoft(await measureFocusedControl(page, move), 'group Move after evidence scrolling');
  await move.press('Enter');

  await expect.poll(async () => {
    const savedValue = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
    if (!savedValue) return false;
    const savedState = decodeSave(savedValue);
    return itemIds.every((itemId) => {
      const item = savedState.items.find((entry) => entry.id === itemId);
      return item?.placement.kind === 'scratchpad' && item.placement.scratchPadId === 'scratch-a';
    });
  }).toBe(true);
  const savedState = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  for (const itemId of itemIds) {
    const item = savedState.items.find((entry) => entry.id === itemId);
    expect(item.placement).toMatchObject({ kind: 'scratchpad', scratchPadId: 'scratch-a' });
  }
  expect(savedState.progress.completedCollectionIds).not.toContain('harmonic-calibration');
  expect(savedState.progress.skillPoints).toBe(0);
});

for (const viewport of [
  { width: 320, height: 400 },
  { width: 320, height: 440 },
  { width: 390, height: 440 },
]) {
  for (const textScale of [1.25, 1.5]) {
    test(`compact Inspector and one-row toolbar remain usable at ${viewport.width}x${viewport.height}, ${textScale * 100}%`, async ({ page }) => {
      const longClue = 'The recorder caught a fragment through the wavering chamber echo. '.repeat(24);
      const panel = await openCalibrationInspector(page, viewport, textScale, { clue: longClue });
      const measurement = await measurePanelAndDocument(page);
      console.info(`Short-height single selection ${textScale * 100}% ${viewport.width}x${viewport.height}: ${JSON.stringify(measurement)}`);

      expect.soft(measurement.panel.left).toBeGreaterThanOrEqual(0);
      expect.soft(measurement.panel.top).toBeGreaterThanOrEqual(0);
      expect.soft(measurement.panel.right).toBeLessThanOrEqual(viewport.width);
      expect.soft(measurement.panel.bottom).toBeLessThanOrEqual(viewport.height);
      expect.soft(measurement.panelBottomInset, 'Inspector should leave a safe viewport margin').toBeGreaterThanOrEqual(8);
      expect.soft(measurement.document.scrollWidth, 'layout should not create document-level horizontal overflow').toBeLessThanOrEqual(viewport.width);
      expect.soft(measurement.panelToolbarIntersection.overlaps, 'Inspector and world toolbar should not overlap').toBe(false);
      expect.soft(measurement.toolbar.top).toBeGreaterThanOrEqual(0);
      expect.soft(measurement.toolbar.bottom).toBeLessThanOrEqual(viewport.height);
      if (viewport.height < 480) {
        expect.soft(measurement.toolbar.height, '400-479px viewports should use a single 44px toolbar row').toBeLessThanOrEqual(48);
        expect.soft(measurement.toolbar.height, 'toolbar row should leave room for 38px controls').toBeGreaterThanOrEqual(38);
      }

      if (viewport.width === 320 && viewport.height === 400) {
        const header = page.locator('.game-header');
        const titleMeasurement = await header.locator('.game-brand h1').evaluate((element) => ({
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        }));
        console.info(`Compact game header at ${textScale * 100}%: ${JSON.stringify({ ...measurement.header, title: titleMeasurement })}`);
        expect.soft(measurement.header.height, '400-439px game header should use the compact treatment').toBeLessThanOrEqual(90);
        expect.soft(measurement.header.scrollWidth, 'game header should not create horizontal overflow').toBeLessThanOrEqual(measurement.header.clientWidth);
        expect.soft(titleMeasurement.scrollHeight, 'game title should not clip vertically').toBeLessThanOrEqual(titleMeasurement.clientHeight + 1);
        expect.soft(titleMeasurement.scrollWidth, 'game title should not clip horizontally').toBeLessThanOrEqual(titleMeasurement.clientWidth + 1);
        await expectCompactHeaderControls(page);
      }

      if (textScale === 1.5) {
        expect.soft(measurement.details.clientHeight, '150% Inspector details should retain at least 48px of scrollable space').toBeGreaterThanOrEqual(48);
      }
      await expect(panel.getByRole('heading', { level: 2 })).toHaveText('Carrier Tone Plate');
      await expectCompactInspectorActions(page, panel);

      const details = panel.locator('.item-inspector__details');
      await details.evaluate((element) => { element.scrollTop = element.scrollHeight; });
      await expect.poll(() => details.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      const afterDetailsScroll = await measurePanelAndDocument(page);
      expect(afterDetailsScroll.panelToolbarIntersection.overlaps, 'scrolling Inspector details should not cause a toolbar collision').toBe(false);
      expect(afterDetailsScroll.document.scrollWidth).toBeLessThanOrEqual(viewport.width);

      const toolbarControls = [
        [page.getByRole('button', { name: 'Zoom out' }), 'Zoom out'],
        [page.getByRole('button', { name: 'Zoom in' }), 'Zoom in'],
        [page.getByTestId('world-jump'), 'World jump'],
        [page.getByRole('button', { name: 'Reset view' }), 'Reset view'],
        [page.getByRole('button', { name: 'Find an item' }), 'Find an item'],
        [page.getByTestId('multi-selection-toggle'), 'Select multiple items'],
      ];
      const scrollportBeforeKeyboardFocus = viewport.width === 320 ? await measureToolbarScrollport(page) : null;
      for (const [index, [control, label]] of toolbarControls.entries()) {
        if (index === 0) await control.focus();
        else await tabUntilFocused(page, control);
        const focused = await measureFocusedControl(page, control);
        expectToolbarControlUsable(focused, `${label} at ${viewport.width}x${viewport.height}`);
        expect(focused.bottom - focused.top, `${label} should retain a 38px touch target`).toBeGreaterThanOrEqual(38);
      }
      if (viewport.width === 320) {
        console.info(`Toolbar scrollport after keyboard focus at ${viewport.height}px: ${JSON.stringify(await measureToolbarScrollport(page))}`);
        expect(scrollportBeforeKeyboardFocus, '320px toolbar should expose a horizontal scrollport').not.toBeNull();
        const scrollportAfterKeyboardFocus = await measureToolbarScrollport(page);
        expect(scrollportAfterKeyboardFocus.scrollLeft, 'keyboard focus should auto-scroll horizontally to the focused toolbar control').toBeGreaterThan(scrollportBeforeKeyboardFocus.scrollLeft);
      }
      await assertToolbarTextDoesNotOverflow(page, textScale * 100);
    });
  }
}

test('group count and Inspector actions remain available in the 320x400, 150% compact layout', async ({ page }) => {
  const viewport = { width: 320, height: 400 };
  const { panel, selectedCount } = await openCompactGroupInspector(page, viewport, 1.5);
  const measurement = await measurePanelAndDocument(page);
  console.info(`Short-height group selection 150% ${viewport.width}x${viewport.height}: ${JSON.stringify(measurement)}`);
  expect.soft(measurement.panelToolbarIntersection.overlaps, 'group Inspector and toolbar should not overlap').toBe(false);
  expect.soft(measurement.toolbar.height, 'group selection count should stay in the single-row toolbar lane').toBeLessThanOrEqual(48);
  expect.soft(measurement.details.clientHeight, 'group Inspector should retain at least 48px of details at 150%').toBeGreaterThanOrEqual(48);
  expect.soft(measurement.document.scrollWidth).toBeLessThanOrEqual(viewport.width);

  await expect(selectedCount).toHaveText('2 selected');
  const beforeCountScroll = await measureToolbarScrollport(page);
  expect(beforeCountScroll, 'group toolbar should expose its horizontal scrollport').not.toBeNull();
  await selectedCount.evaluate((element) => element.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  await expect.poll(async () => (await measureToolbarScrollport(page))?.scrollLeft ?? 0).toBeGreaterThan(beforeCountScroll.scrollLeft);
  const afterCountScroll = await measureToolbarScrollport(page);
  const countMeasurement = await measureFocusedControl(page, selectedCount);
  expect(countMeasurement.left).toBeGreaterThanOrEqual(0);
  expect(countMeasurement.left).toBeGreaterThanOrEqual(afterCountScroll.left);
  expect(countMeasurement.top).toBeGreaterThanOrEqual(afterCountScroll.top);
  expect(countMeasurement.right).toBeLessThanOrEqual(viewport.width);
  expect(countMeasurement.right).toBeLessThanOrEqual(afterCountScroll.right);
  expect(countMeasurement.bottom).toBeLessThanOrEqual(afterCountScroll.bottom);
  expect(countMeasurement.centerHit, 'group count should remain visible after horizontal toolbar scrolling').toBe(true);

  await expectCompactInspectorActions(page, panel, { group: true });
  const selectionToggle = page.getByTestId('multi-selection-toggle');
  await selectionToggle.focus();
  const focusedToggle = await measureFocusedControl(page, selectionToggle);
  expectToolbarControlUsable(focusedToggle, 'group-selection toggle');
  expect(focusedToggle.bottom - focusedToggle.top, 'group-selection toggle should retain a 38px touch target').toBeGreaterThanOrEqual(38);
  await assertToolbarTextDoesNotOverflow(page, 150);
});

test('group Inspector and toolbar actions remain reachable at 320x360 with 150% text', async ({ page }) => {
  const viewport = { width: 320, height: 360 };
  const { panel, selectedCount } = await openCompactGroupInspector(page, viewport, 1.5);
  const measurement = await measurePanelAndDocument(page);
  console.info(`Short-height group selection 150% ${viewport.width}x${viewport.height}: ${JSON.stringify(measurement)}`);

  expect(measurement.panel.left).toBeGreaterThanOrEqual(0);
  expect(measurement.panel.top).toBeGreaterThanOrEqual(0);
  expect(measurement.panel.right).toBeLessThanOrEqual(viewport.width);
  expect(measurement.panel.bottom).toBeLessThanOrEqual(viewport.height);
  expect(measurement.panelBottomInset, 'group Inspector should leave a usable bottom safe margin').toBeGreaterThanOrEqual(8);
  expect(measurement.panelToolbarIntersection.overlaps, 'group Inspector and short-height toolbar should not overlap').toBe(false);
  expect(measurement.details.clientHeight, 'group Inspector should retain at least 48px of details at 150%').toBeGreaterThanOrEqual(48);
  expect(measurement.details.scrollHeight, 'group evidence should scroll inside the Inspector').toBeGreaterThan(measurement.details.clientHeight);
  expect(measurement.document.scrollWidth, 'group Inspector should not create page-level horizontal overflow').toBeLessThanOrEqual(viewport.width);

  await expect(panel.getByRole('heading', { name: '2 objects selected' })).toBeVisible();
  await expect(selectedCount).toHaveText('2 selected');
  const scrollportBeforeCount = await measureToolbarScrollport(page);
  expect(scrollportBeforeCount, 'group selection should retain a horizontally scrollable toolbar rail').not.toBeNull();
  await selectedCount.evaluate((element) => element.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  await expect.poll(async () => (await measureToolbarScrollport(page))?.scrollLeft ?? 0)
    .toBeGreaterThan(scrollportBeforeCount.scrollLeft);
  const scrollportAfterCount = await measureToolbarScrollport(page);
  const countMeasurement = await measureFocusedControl(page, selectedCount);
  expect(countMeasurement.left).toBeGreaterThanOrEqual(0);
  expect(countMeasurement.left).toBeGreaterThanOrEqual(scrollportAfterCount.left);
  expect(countMeasurement.top).toBeGreaterThanOrEqual(scrollportAfterCount.top);
  expect(countMeasurement.right).toBeLessThanOrEqual(viewport.width);
  expect(countMeasurement.right).toBeLessThanOrEqual(scrollportAfterCount.right);
  expect(countMeasurement.bottom).toBeLessThanOrEqual(scrollportAfterCount.bottom);
  expect(countMeasurement.centerHit, 'group count should be center-hit-testable after toolbar scrolling').toBe(true);

  const details = panel.getByTestId('selected-items-summary');
  await details.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => details.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  const close = panel.getByRole('button', { name: 'Close item inspector' });
  const target = page.getByTestId('move-target');
  const groupMove = page.getByTestId('move-selected-items');
  await close.focus();
  expectControlUsable(await measureFocusedControl(page, close), 'group Inspector Close at 320x360');
  await tabUntilFocused(page, target);
  expectControlUsable(await measureFocusedControl(page, target), 'group destination selector at 320x360');
  await tabUntilFocused(page, groupMove);
  expectControlUsable(await measureFocusedControl(page, groupMove), 'group Move at 320x360');

  const toolbarControls = [
    [page.getByRole('button', { name: 'Zoom out' }), 'Zoom out'],
    [page.getByRole('button', { name: 'Zoom in' }), 'Zoom in'],
    [page.getByTestId('world-jump'), 'World jump'],
    [page.getByRole('button', { name: 'Reset view' }), 'Reset view'],
    [page.getByRole('button', { name: 'Find an item' }), 'Find an item'],
    [page.getByTestId('multi-selection-toggle'), 'Select multiple items'],
  ];
  await page.locator('.game-toolbar').evaluate((toolbar) => { toolbar.scrollLeft = 0; });
  await expect.poll(() => measureToolbarScrollport(page).then((scrollport) => scrollport?.scrollLeft ?? 0)).toBe(0);
  const scrollportBeforeKeyboardFocus = await measureToolbarScrollport(page);
  expect(scrollportBeforeKeyboardFocus, 'group selection should retain a horizontally scrollable toolbar rail').not.toBeNull();
  const pageScrollBeforeKeyboardFocus = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  await toolbarControls[0][0].focus();
  for (const [index, [control, label]] of toolbarControls.entries()) {
    if (index > 0) await tabUntilFocused(page, control);
    const focused = await measureFocusedControl(page, control);
    expectToolbarControlUsable(focused, `${label} at 320x360 with group selection`);
    expect(focused.bottom - focused.top, `${label} should retain a 38px touch target`).toBeGreaterThanOrEqual(38);
  }
  const scrollportAfterKeyboardFocus = await measureToolbarScrollport(page);
  expect(scrollportAfterKeyboardFocus.scrollLeft, 'keyboard traversal should scroll the toolbar rail to later actions')
    .toBeGreaterThan(scrollportBeforeKeyboardFocus.scrollLeft);
  expect(await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY })), 'keyboard toolbar scrolling should not move the document')
    .toEqual(pageScrollBeforeKeyboardFocus);
  await expect(selectedCount).toHaveText('2 selected');
  await assertToolbarTextDoesNotOverflow(page, 150);
});

test('short-height resize across 400, 440, and 480 preserves selection and visible focus', async ({ page }) => {
  const viewport = { width: 320, height: 400 };
  const panel = await openCalibrationInspector(page, viewport, 1.5, {
    clue: 'The recorder caught a fragment through the wavering chamber echo. '.repeat(20),
  });
  const compactHeaderHeight = (await page.locator('.game-header').boundingBox()).height;
  let regularHeaderHeight = null;
  const target = page.getByTestId('move-target');
  await target.focus();
  for (const height of [430, 440, 479, 480, 400]) {
    await page.setViewportSize({ width: viewport.width, height });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { level: 2 })).toHaveText('Carrier Tone Plate');
    if (height === 440) regularHeaderHeight = (await page.locator('.game-header').boundingBox()).height;
    const measurement = await measurePanelAndDocument(page);
    console.info(`Resize checkpoint ${viewport.width}x${height}: ${JSON.stringify(measurement)}`);
    expect.soft(measurement.panelToolbarIntersection.overlaps, `Inspector and toolbar should not collide at ${height}px`).toBe(false);
    expect.soft(measurement.document.scrollWidth, `document should not overflow horizontally at ${height}px`).toBeLessThanOrEqual(viewport.width);

    await expectCompactInspectorActions(page, panel);
    const activeControl = page.locator(':focus');
    const activeMeasurement = await activeControl.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        visible: element.getClientRects().length > 0,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      };
    });
    expect(activeMeasurement.visible, `keyboard focus should not be lost at ${height}px`).toBe(true);
    expect(activeMeasurement.left).toBeGreaterThanOrEqual(0);
    expect(activeMeasurement.top).toBeGreaterThanOrEqual(0);
    expect(activeMeasurement.right).toBeLessThanOrEqual(viewport.width);
    expect(activeMeasurement.bottom).toBeLessThanOrEqual(height);
  }
  expect(regularHeaderHeight).not.toBeNull();
  expect.soft(compactHeaderHeight, 'game header should recover at least 35px at 400px while the Inspector is open').toBeLessThanOrEqual(regularHeaderHeight - 35);

  await page.getByRole('button', { name: 'Close item inspector' }).click();
  await expect(panel).toHaveCount(0);
  const headerAfterInspectorClose = await page.locator('.game-header').boundingBox();
  expect(headerAfterInspectorClose.height, 'short-height header compaction should end when the Inspector closes').toBeGreaterThan(compactHeaderHeight);
});

test('compact toast layers above the toolbar, below the Inspector, and leaves toolbar controls operable at 390x440', async ({ page }) => {
  const viewport = { width: 390, height: 440 };
  await openCalibrationInspector(page, viewport, 1.5);
  await page.getByTestId('multi-selection-toggle').click();
  const toast = page.getByTestId('game-feedback');
  await expect(toast).toContainText(/Select or deselect objects/i);
  const toolbar = page.locator('.game-toolbar');
  const inspector = page.getByTestId('item-inspector');
  const [toastZIndex, toolbarZIndex, inspectorZIndex] = await Promise.all([
    toast.evaluate((element) => Number.parseInt(window.getComputedStyle(element).zIndex, 10)),
    toolbar.evaluate((element) => Number.parseInt(window.getComputedStyle(element).zIndex, 10)),
    inspector.evaluate((element) => Number.parseInt(window.getComputedStyle(element).zIndex, 10)),
  ]);
  expect(toastZIndex, 'compact toast should be above the world toolbar').toBeGreaterThan(toolbarZIndex);
  expect(toastZIndex, 'compact toast should be below the Inspector').toBeLessThan(inspectorZIndex);

  const zoomOut = page.getByRole('button', { name: 'Zoom out' });
  const zoomReadout = toolbar.locator('.zoom-readout');
  const beforeZoom = await zoomReadout.textContent();
  await zoomOut.click({ timeout: 2000 });
  await expect.poll(() => zoomReadout.textContent()).not.toBe(beforeZoom);
  expect((await measureFocusedControl(page, zoomOut)).centerHit, 'toolbar action should remain hit-testable while the toast is shown').toBe(true);
});

test('horizontal toolbar lane scrolls with touch at 320x440 and leaves focused controls reachable', async ({ browser }) => {
  const viewport = { width: 320, height: 440 };
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    await openCalibrationInspector(page, viewport, 1.5);
    const initialScrollport = await measureToolbarScrollport(page);
    console.info(`Touch toolbar scrollport before swipe: ${JSON.stringify(initialScrollport)}`);
    expect(initialScrollport, 'compact toolbar should expose a horizontal touch scrollport').not.toBeNull();
    expect(initialScrollport.scrollWidth).toBeGreaterThan(initialScrollport.clientWidth);

    const cdp = await context.newCDPSession(page);
    const toolbarBox = await page.locator('.game-toolbar').boundingBox();
    const touchY = toolbarBox.y + toolbarBox.height / 2;
    const startX = Math.min(viewport.width - 8, toolbarBox.x + toolbarBox.width - 12);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y: touchY }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.max(8, startX - 110), y: touchY }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => (await measureToolbarScrollport(page))?.scrollLeft ?? 0, {
      message: 'touch swipe should reveal horizontally clipped toolbar controls',
    }).toBeGreaterThan(initialScrollport.scrollLeft);

    const selectionToggle = page.getByTestId('multi-selection-toggle');
    await selectionToggle.focus();
    const focused = await measureFocusedControl(page, selectionToggle);
    expectToolbarControlUsable(focused, 'multi-selection toggle after touch scrolling');
    expect(focused.bottom - focused.top, 'touch-scrollable toolbar control should be at least 38px high').toBeGreaterThanOrEqual(38);
  } finally {
    await context.close();
  }
});
