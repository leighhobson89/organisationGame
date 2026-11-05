import { expect, test } from '@playwright/test';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { encodeSave } from '../../src/game/persistence/save.js';
import { PREFERENCES_STORAGE_KEY } from '../../src/game/preferences/preferences.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const folioTestId = 'destination-cabinet-calibration';
const firstClueTestId = 'lab-item-calibration-card-01';
const widths = [721, 768, 1050];
const heights = [550, 600, 719];
const textScales = [1.5, 1.75, 2];

async function openFreshGame(page, viewport, textScale) {
  await page.setViewportSize(viewport);
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
  await expect(page.getByTestId('world-item-count')).toHaveText('174 objects');
}

function intersects(first, second) {
  return first.left < second.right
    && first.right > second.left
    && first.top < second.bottom
    && first.bottom > second.top;
}

async function readBounds(locator) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  });
}

async function expectFullyInside(locator, containerSelector, description) {
  const geometry = await locator.evaluate((element, selector) => {
    const rect = element.getBoundingClientRect();
    const parent = document.querySelector(selector)?.getBoundingClientRect();
    return parent && {
      element: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      container: { left: parent.left, top: parent.top, right: parent.right, bottom: parent.bottom },
      inside: rect.left >= parent.left - 1
        && rect.top >= parent.top - 1
        && rect.right <= parent.right + 1
        && rect.bottom <= parent.bottom + 1,
    };
  }, containerSelector);

  expect.soft(geometry, `${description} and its containing viewport should have geometry`).not.toBeNull();
  if (geometry) {
    expect.soft(geometry.inside, `${description} should remain inside its viewport (${JSON.stringify(geometry)})`).toBe(true);
  }
}

async function expectCenterHitTestable(locator, description) {
  const hitTest = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      hitTargetOrDescendant: hit === element || element.contains(hit),
      hit: hit && {
        testId: hit.getAttribute('data-testid'),
        className: typeof hit.className === 'string' ? hit.className : '',
      },
    };
  });
  expect.soft(hitTest.hitTargetOrDescendant, `${description} should be center-hit-testable (${JSON.stringify(hitTest)})`).toBe(true);
}

async function expectNoDocumentOverflow(page, context) {
  const dimensions = await page.evaluate(() => ({
    viewport: { width: window.innerWidth, height: window.innerHeight },
    root: {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    },
    body: {
      scrollWidth: document.body.scrollWidth,
      clientWidth: document.body.clientWidth,
      scrollHeight: document.body.scrollHeight,
      clientHeight: document.body.clientHeight,
    },
  }));
  expect.soft(dimensions.root.scrollWidth, `${context}: root should not overflow horizontally (${JSON.stringify(dimensions)})`)
    .toBeLessThanOrEqual(dimensions.root.clientWidth + 1);
  expect.soft(dimensions.root.scrollHeight, `${context}: root should not overflow vertically (${JSON.stringify(dimensions)})`)
    .toBeLessThanOrEqual(dimensions.root.clientHeight + 1);
  expect.soft(dimensions.body.scrollWidth, `${context}: body should not overflow horizontally (${JSON.stringify(dimensions)})`)
    .toBeLessThanOrEqual(dimensions.body.clientWidth + 1);
  expect.soft(dimensions.body.scrollHeight, `${context}: body should not overflow vertically (${JSON.stringify(dimensions)})`)
    .toBeLessThanOrEqual(dimensions.body.clientHeight + 1);
}

async function expectHeaderActionsReachable(page, context) {
  const header = page.locator('.game-header');
  const actions = page.locator('.header-actions');
  const controls = actions.locator('button:visible, a[href]:visible, input:visible, select:visible');
  const headerLayout = await page.evaluate(() => {
    const read = (element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    return {
      header: read(document.querySelector('.game-header')),
      brand: read(document.querySelector('.game-brand')),
      progress: read(document.querySelector('.header-progress')),
      actions: read(document.querySelector('.header-actions')),
      viewport: { left: 0, top: 0, right: innerWidth, bottom: innerHeight },
    };
  });
  expect.soft(headerLayout.header.left, `${context}: header should fit the viewport (${JSON.stringify(headerLayout)})`).toBeGreaterThanOrEqual(-1);
  expect.soft(headerLayout.header.right, `${context}: header should fit the viewport (${JSON.stringify(headerLayout)})`).toBeLessThanOrEqual(headerLayout.viewport.right + 1);
  expect.soft(headerLayout.header.top, `${context}: header should fit the viewport (${JSON.stringify(headerLayout)})`).toBeGreaterThanOrEqual(-1);
  expect.soft(headerLayout.header.bottom, `${context}: header should fit the viewport (${JSON.stringify(headerLayout)})`).toBeLessThanOrEqual(headerLayout.viewport.bottom + 1);
  expect.soft(intersects(headerLayout.brand, headerLayout.progress), `${context}: brand and progress summary should not overlap (${JSON.stringify(headerLayout)})`).toBe(false);
  expect.soft(intersects(headerLayout.brand, headerLayout.actions), `${context}: brand and header actions should not overlap (${JSON.stringify(headerLayout)})`).toBe(false);
  expect.soft(intersects(headerLayout.progress, headerLayout.actions), `${context}: progress summary and header actions should not overlap (${JSON.stringify(headerLayout)})`).toBe(false);

  const count = await controls.count();
  expect.soft(count, `${context}: header action labels should remain keyboard reachable`).toBeGreaterThan(0);
  if (!count) return;

  const initial = await actions.evaluate((element) => ({
    scrollLeft: element.scrollLeft,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
    pageScroll: { x: window.scrollX, y: window.scrollY },
  }));
  let scrolled = false;
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    await expect.soft(control, `${context}: header action ${index + 1} should have a full accessible label`).toHaveAccessibleName(/.+/);
    if (index === 0) await control.focus();
    else await page.keyboard.press('Tab');
    await expect.soft(control, `${context}: Tab should reach header action ${index + 1}`).toBeFocused();
    const geometry = await control.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const rail = element.closest('.header-actions');
      const railRect = rail.getBoundingClientRect();
      const left = railRect.left + rail.clientLeft;
      const right = left + rail.clientWidth;
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        label: element.getAttribute('aria-label') || element.innerText,
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
        insideRail: rect.left >= left - 1 && rect.right <= right + 1,
        insideViewport: rect.left >= -1 && rect.right <= innerWidth + 1
          && rect.top >= -1 && rect.bottom <= innerHeight + 1,
        hitTestable: hit === element || element.contains(hit),
        scrollLeft: rail.scrollLeft,
        pageScroll: { x: window.scrollX, y: window.scrollY },
      };
    });
    scrolled ||= geometry.scrollLeft > initial.scrollLeft + 1;
    expect.soft(geometry.insideRail, `${context}: focused header action should be visible in the horizontal rail (${JSON.stringify({ initial, geometry })})`).toBe(true);
    expect.soft(geometry.insideViewport, `${context}: focused header action should stay inside the viewport (${JSON.stringify(geometry)})`).toBe(true);
    expect.soft(geometry.hitTestable, `${context}: focused header action should be hit-testable (${JSON.stringify(geometry)})`).toBe(true);
    expect.soft(geometry.pageScroll, `${context}: header navigation should not scroll the document (${JSON.stringify(geometry)})`).toEqual(initial.pageScroll);
  }

  if (initial.scrollWidth > initial.clientWidth + 1) {
    expect.soft(['auto', 'scroll'].includes(initial.overflowX), `${context}: overflowing header actions should use a horizontal rail (${JSON.stringify(initial)})`).toBe(true);
    expect.soft(scrolled, `${context}: keyboard navigation should scroll the overflowing header rail`).toBe(true);
  }
}

async function expectProgressDetails(page, context) {
  const dial = page.getByRole('progressbar', { name: 'Laboratory restoration' });
  const progressbar = await dial.evaluate((element) => ({
    role: element.getAttribute('role'),
    minimum: element.getAttribute('aria-valuemin'),
    maximum: element.getAttribute('aria-valuemax'),
    current: Number(element.getAttribute('aria-valuenow')),
  }));
  expect.soft(progressbar.role, `${context}: restoration dial should retain progressbar semantics`).toBe('progressbar');
  expect.soft(progressbar.minimum, `${context}: restoration progress should expose its minimum`).toBe('0');
  expect.soft(progressbar.maximum, `${context}: restoration progress should expose its maximum`).toBe('100');
  expect.soft(Number.isFinite(progressbar.current) && progressbar.current >= 0 && progressbar.current <= 100,
    `${context}: restoration progress should expose a valid current value (${JSON.stringify(progressbar)})`).toBe(true);
  await expect.soft(page.locator('.header-progress strong')).toHaveText('Restoration');

  const details = page.locator('details').filter({ has: page.getByText('Progress details', { exact: true }) });
  const detailsCount = await details.count();
  expect.soft(detailsCount, `${context}: progress metrics should be available in a native Progress details disclosure`).toBe(1);
  if (detailsCount !== 1) return;

  expect.soft(await details.evaluate((element) => element.tagName.toLowerCase()), `${context}: progress details should use native disclosure semantics`).toBe('details');
  expect.soft(await details.evaluate((element) => element.open), `${context}: progress details should be available on demand`).toBe(false);
  await details.locator('summary').click();
  await expect.soft(details, `${context}: Progress details should open on demand`).toHaveJSProperty('open', true);
  for (const [testId, label] of [
    ['skill-points', 'skill point/reward metric'],
    ['chapter-progress', 'research collection metric'],
    ['invention-stage', 'invention stage metric'],
  ]) {
    const metric = details.getByTestId(testId);
    await expect.soft(metric, `${context}: ${label} should remain available in Progress details`).toBeVisible();
    expect.soft((await metric.innerText()).trim(), `${context}: ${label} should not be empty`).not.toBe('');
  }
  await details.locator('summary').click();
}

async function expectControlsDisclosure(page, context) {
  const hint = page.locator('.world-hint');
  const lead = page.locator('.world-hint__lead');
  await expect.soft(lead, `${context}: the first-action lead should remain visible`).toBeVisible();
  await expect.soft(lead).toContainText(/Start with Harmonic Calibration/i);

  const details = page.locator('details').filter({ has: page.getByText('Controls and keyboard help', { exact: true }) });
  const detailsCount = await details.count();
  expect.soft(detailsCount, `${context}: controls guidance should use a native on-demand disclosure`).toBe(1);
  if (detailsCount !== 1) return;

  expect.soft(await details.evaluate((element) => element.tagName.toLowerCase()), `${context}: controls guidance should use native details/summary semantics`).toBe('details');
  expect.soft(await details.evaluate((element) => element.open), `${context}: detailed guidance should start collapsed`).toBe(false);
  await details.locator('summary').click();
  await expect.soft(details, `${context}: Controls and keyboard help should open`).toHaveJSProperty('open', true);
  await expect.soft(lead, `${context}: opening keyboard help should leave the first-action lead visible`).toBeVisible();
  const expandedCopy = await details.innerText();
  for (const instruction of [
    /Drag objects to a cabinet or workbench/i,
    /drag empty space to pan/i,
    /wheel to zoom/i,
    /Use arrow keys to pan/i,
  ]) {
    expect.soft(expandedCopy, `${context}: expanded instructions should include ${instruction}`).toMatch(instruction);
  }
  await details.locator('summary').click();
  await expect.soft(hint, `${context}: first-action guidance should remain visible after closing help`).toBeVisible();
}

async function expectWorldLayout(page, context) {
  const hint = page.locator('.world-hint');
  const toolbar = page.locator('.game-toolbar');
  const atlas = page.getByTestId('world-atlas-toggle');
  const folio = page.getByTestId(folioTestId);
  const firstClue = page.getByTestId(firstClueTestId);
  await expect.soft(hint, `${context}: first-action hint should remain visible`).toBeVisible();
  await expect.soft(hint.locator('.world-hint__lead')).toBeVisible();
  await expect.soft(toolbar).toBeVisible();
  await expect.soft(atlas).toBeVisible();

  const layout = await page.evaluate(() => {
    const read = (element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    const overlaps = (first, second) => first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top;
    const hint = read(document.querySelector('.world-hint'));
    const toolbar = read(document.querySelector('.game-toolbar'));
    const atlas = read(document.querySelector('[data-testid="world-atlas-toggle"]'));
    const folio = read(document.querySelector('[data-testid="destination-cabinet-calibration"]'));
    const firstClue = read(document.querySelector('[data-testid="lab-item-calibration-card-01"]'));
    const worldViewport = read(document.querySelector('[data-testid="world-viewport"]'));
    const gameMain = read(document.querySelector('.game-main'));
    const overlays = [['hint', hint], ['toolbar', toolbar], ['Atlas toggle', atlas]];
    const violations = [];

    for (let first = 0; first < overlays.length; first += 1) {
      for (let second = first + 1; second < overlays.length; second += 1) {
        if (overlaps(overlays[first][1], overlays[second][1])) {
          violations.push(`${overlays[first][0]} overlaps ${overlays[second][0]}`);
        }
      }
    }
    for (const [name, overlay] of overlays) {
      for (const card of document.querySelectorAll('.world-scene .destination-card, .world-scene .lab-object')) {
        if (card.getClientRects().length === 0) continue;
        const rect = read(card);
        const visible = {
          left: Math.max(rect.left, worldViewport.left),
          top: Math.max(rect.top, worldViewport.top),
          right: Math.min(rect.right, worldViewport.right),
          bottom: Math.min(rect.bottom, worldViewport.bottom),
        };
        if (visible.right <= visible.left || visible.bottom <= visible.top) continue;
        if (overlaps(overlay, visible)) {
          const label = card.getAttribute('aria-label') || card.textContent.trim();
          violations.push(`${name} overlaps visible world card: ${label}`);
        }
      }
      if (overlaps(overlay, folio)) violations.push(`${name} overlaps Harmonic Calibration Folio`);
    }

    const toolbarElement = document.querySelector('.game-toolbar');
    const toolbarControls = Array.from(toolbarElement.querySelectorAll('button:not([disabled]), select:not([disabled]), input:not([disabled])'))
      .filter((element) => element.getClientRects().length > 0);
    const centers = toolbarControls.map((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top + rect.height / 2;
    });
    const style = getComputedStyle(toolbarElement);
    return {
      hint,
      toolbar,
      atlas,
      folio,
      firstClue,
      worldViewport,
      gameMain,
      violations,
      toolbarStyle: { display: style.display, flexWrap: style.flexWrap, overflowX: style.overflowX },
      toolbarControlCount: toolbarControls.length,
      toolbarTargetSizes: toolbarControls.map((element) => {
        const rect = element.getBoundingClientRect();
        return { label: element.getAttribute('aria-label') || element.innerText, width: rect.width, height: rect.height };
      }),
      toolbarCenterSpread: centers.length > 0 ? Math.max(...centers) - Math.min(...centers) : null,
      atlasInsideGameMain: atlas.left >= gameMain.left - 1 && atlas.top >= gameMain.top - 1
        && atlas.right <= gameMain.right + 1 && atlas.bottom <= gameMain.bottom + 1,
      folioInsideWorld: folio.left >= worldViewport.left - 1 && folio.top >= worldViewport.top - 1
        && folio.right <= worldViewport.right + 1 && folio.bottom <= worldViewport.bottom + 1,
      firstClueInsideWorld: firstClue.left >= worldViewport.left - 1 && firstClue.top >= worldViewport.top - 1
        && firstClue.right <= worldViewport.right + 1 && firstClue.bottom <= worldViewport.bottom + 1,
    };
  });

  expect.soft(layout.violations, `${context}: hint, controls, Atlas, Folio, and visible cards should not overlap (${JSON.stringify(layout)})`).toEqual([]);
  expect.soft(layout.atlasInsideGameMain, `${context}: Atlas should remain inside the game viewport (${JSON.stringify(layout)})`).toBe(true);
  expect.soft(layout.toolbarStyle.display, `${context}: world controls should remain a single flex row (${JSON.stringify(layout.toolbarStyle)})`).toBe('flex');
  expect.soft(layout.toolbarStyle.flexWrap, `${context}: world controls should not wrap (${JSON.stringify(layout.toolbarStyle)})`).toBe('nowrap');
  expect.soft(['auto', 'scroll'].includes(layout.toolbarStyle.overflowX), `${context}: world controls should use a horizontal scroll rail (${JSON.stringify(layout.toolbarStyle)})`).toBe(true);
  expect.soft(layout.toolbarCenterSpread, `${context}: interactive world controls should share one row (${JSON.stringify(layout)})`).toBeLessThanOrEqual(3);
  expect.soft(layout.toolbarTargetSizes.every(({ width, height }) => width >= 44 && height >= 44),
    `${context}: each interactive world-toolbar target should be at least 44×44px (${JSON.stringify(layout.toolbarTargetSizes)})`).toBe(true);
  expect.soft(layout.folioInsideWorld, `${context}: Folio should stay within the world viewport (${JSON.stringify(layout)})`).toBe(true);
  expect.soft(layout.firstClueInsideWorld, `${context}: first clue should stay within the world viewport (${JSON.stringify(layout)})`).toBe(true);

  await expectFullyInside(atlas, '.game-main', 'World Atlas toggle');
  await expectCenterHitTestable(atlas, 'World Atlas toggle');
  await expectFullyInside(folio, '[data-testid="world-viewport"]', 'Harmonic Calibration Folio');
  await expectFullyInside(firstClue, '[data-testid="world-viewport"]', 'first calibration clue');
  await expectCenterHitTestable(folio, 'Harmonic Calibration Folio');
  await expectCenterHitTestable(firstClue, 'first calibration clue');
}

async function expectToolbarKeyboardRail(page, context) {
  const toolbar = page.locator('.game-toolbar');
  const controls = toolbar.locator('button:not([disabled]):visible, select:not([disabled]):visible, input:not([disabled]):visible');
  const count = await controls.count();
  expect.soft(count, `${context}: world toolbar should retain keyboard-operable actions`).toBeGreaterThan(0);
  if (!count) return;

  const initial = await toolbar.evaluate((element) => {
    element.scrollLeft = 0;
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      scrollLeft: element.scrollLeft,
      pageScroll: { x: window.scrollX, y: window.scrollY },
    };
  });
  let scrolled = false;
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    await expect.soft(control, `${context}: toolbar action ${index + 1} should have an accessible name`).toHaveAccessibleName(/.+/);
    if (index === 0) await control.focus();
    else await page.keyboard.press('Tab');
    await expect.soft(control, `${context}: Tab should reach world action ${index + 1}`).toBeFocused();
    const geometry = await control.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const rail = element.closest('.game-toolbar');
      const railRect = rail.getBoundingClientRect();
      const left = railRect.left + rail.clientLeft;
      const top = railRect.top + rail.clientTop;
      const right = left + rail.clientWidth;
      const bottom = top + rail.clientHeight;
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        label: element.getAttribute('aria-label') || element.innerText,
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
        insideRail: rect.left >= left - 1 && rect.right <= right + 1
          && rect.top >= top - 1 && rect.bottom <= bottom + 1,
        hitTestable: hit === element || element.contains(hit),
        scrollLeft: rail.scrollLeft,
        pageScroll: { x: window.scrollX, y: window.scrollY },
      };
    });
    scrolled ||= geometry.scrollLeft > initial.scrollLeft + 1;
    expect.soft(geometry.insideRail, `${context}: focused world action should scroll fully into its rail (${JSON.stringify(geometry)})`).toBe(true);
    expect.soft(geometry.hitTestable, `${context}: focused world action should remain center-hit-testable (${JSON.stringify(geometry)})`).toBe(true);
    expect.soft(geometry.pageScroll, `${context}: toolbar focus should not scroll the page (${JSON.stringify(geometry)})`).toEqual(initial.pageScroll);
  }
  if (initial.scrollWidth > initial.clientWidth + 1) {
    expect.soft(scrolled, `${context}: Tab/focus should scroll an overflowing world toolbar`).toBe(true);
  }
}

for (const textScale of textScales) {
  for (const width of widths) {
    for (const height of heights) {
      const viewport = { width, height };
      const context = `${width}x${height} at ${Math.round(textScale * 100)}%`;
      test(`fresh ${context} short-tablet large-text layout remains usable`, async ({ page }) => {
        await openFreshGame(page, viewport, textScale);

        const savedScale = await page.evaluate((preferencesKey) => {
          const preferences = JSON.parse(window.localStorage.getItem(preferencesKey));
          return preferences.textScale;
        }, PREFERENCES_STORAGE_KEY);
        expect.soft(savedScale, `${context}: the saved text scale should remain unchanged`).toBe(textScale);
        await expect.soft(page.locator('html'), `${context}: computed text scale should remain unchanged`).toHaveCSS('--text-scale', String(textScale));

        await expectNoDocumentOverflow(page, context);
        await expectHeaderActionsReachable(page, context);
        await expectProgressDetails(page, context);
        await expectControlsDisclosure(page, context);
        await expectWorldLayout(page, context);
        await expectToolbarKeyboardRail(page, context);
      });
    }
  }
}

test('720px compact boundary at 200% keeps its existing compact stack; 721x720 remains guarded by tablet-bridge-guidance', async ({ page }) => {
  const viewport = { width: 720, height: 550 };
  await openFreshGame(page, viewport, 2);
  await expect(page.locator('html')).toHaveCSS('--text-scale', '2');
  const compactStack = await page.locator('.world-bottom-stack').evaluate((element) => ({
    display: getComputedStyle(element).display,
    flexDirection: getComputedStyle(element).flexDirection,
    viewportWidth: innerWidth,
  }));
  expect(compactStack.viewportWidth).toBe(720);
  expect(compactStack.display, `720px should keep the existing compact stack (${JSON.stringify(compactStack)})`).toBe('flex');
  expect(compactStack.flexDirection, `720px should keep the existing compact stack direction (${JSON.stringify(compactStack)})`).toBe('column');
  await expectNoDocumentOverflow(page, '720x550 at 200% compact boundary');
  // The existing e2e/lab/tablet-bridge-guidance.spec.js matrix protects 721x720 at 200%.
});

test('768x600 at 200% preserves a saved camera and autosave bytes through short-tablet reflow', async ({ page }) => {
  const savedCamera = { panX: -321, panY: -222, scale: 0.9 };
  const savedState = createNewGameState();
  savedState.camera = savedCamera;
  const savedBytes = encodeSave(savedState);
  await page.setViewportSize({ width: 768, height: 600 });
  await page.addInitScript(({ autoSaveKey: saveKey, preferencesKey, saveBytes }) => {
    window.localStorage.clear();
    window.localStorage.setItem(saveKey, saveBytes);
    window.localStorage.setItem(preferencesKey, JSON.stringify({
      version: 1,
      textScale: 2,
      reduceMotion: false,
      soundEffectsEnabled: false,
    }));
  }, {
    autoSaveKey,
    preferencesKey: PREFERENCES_STORAGE_KEY,
    saveBytes: savedBytes,
  });
  await page.goto('/');
  await expect(page.getByTestId('world-item-count')).toHaveText('174 objects');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });

  const scene = page.locator('.world-scene');
  const expectedTransform = 'translate(-321px, -222px) scale(0.9)';
  await expect.poll(() => scene.evaluate((element) => element.style.transform)).toBe(expectedTransform);
  const bytesOnLoad = await page.evaluate((saveKey) => window.localStorage.getItem(saveKey), autoSaveKey);
  expect(bytesOnLoad, 'loading at 200% should preserve the saved autosave bytes').toBe(savedBytes);

  await page.setViewportSize({ width: 768, height: 601 });
  await page.setViewportSize({ width: 768, height: 600 });
  await expect.poll(() => scene.evaluate((element) => element.style.transform)).toBe(expectedTransform);
  const bytesAfterReflow = await page.evaluate((saveKey) => window.localStorage.getItem(saveKey), autoSaveKey);
  expect(bytesAfterReflow, 'short-tablet reflow should not rewrite saved camera/autosave bytes').toBe(savedBytes);
});

test('768x600 at 200% keeps selection guidance readable and clear of the toast, toolbar, and visible cards', async ({ page }) => {
  await openFreshGame(page, { width: 768, height: 600 }, 2);

  const scene = page.locator('.world-scene');
  const cameraBefore = await scene.evaluate((element) => element.style.transform);
  const selectionToggle = page.getByTestId('multi-selection-toggle');
  await selectionToggle.click();
  await expect(selectionToggle).toHaveAttribute('aria-pressed', 'true');
  expect(await scene.evaluate((element) => element.style.transform), 'selection mode should not change the world camera')
    .toBe(cameraBefore);

  const hint = page.locator('.world-hint');
  const toolbar = page.locator('.game-toolbar');
  const toast = page.getByTestId('game-feedback');
  await expect(hint, 'multi-selection guidance should remain visible beside the feedback toast').toBeVisible();
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('Select or deselect objects in the laboratory');

  const geometry = await page.evaluate(() => {
    const read = (element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    const overlaps = (first, second) => first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top;
    const hintElement = document.querySelector('.world-hint');
    const hint = read(hintElement);
    const toolbar = read(document.querySelector('.game-toolbar'));
    const toast = read(document.querySelector('[data-testid="game-feedback"]'));
    const worldViewport = read(document.querySelector('[data-testid="world-viewport"]'));
    const gameMain = read(document.querySelector('.game-main'));
    const overlays = [['hint', hint], ['toolbar', toolbar], ['toast', toast]];
    const collisions = [];

    for (let first = 0; first < overlays.length; first += 1) {
      for (let second = first + 1; second < overlays.length; second += 1) {
        if (overlaps(overlays[first][1], overlays[second][1])) {
          collisions.push(`${overlays[first][0]} overlaps ${overlays[second][0]}`);
        }
      }
    }
    for (const [name, overlay] of overlays) {
      for (const card of document.querySelectorAll('.world-scene .destination-card, .world-scene .lab-object')) {
        if (card.getClientRects().length === 0) continue;
        const rect = read(card);
        const visibleCard = {
          left: Math.max(rect.left, worldViewport.left),
          top: Math.max(rect.top, worldViewport.top),
          right: Math.min(rect.right, worldViewport.right),
          bottom: Math.min(rect.bottom, worldViewport.bottom),
        };
        if (visibleCard.right <= visibleCard.left || visibleCard.bottom <= visibleCard.top) continue;
        if (overlaps(overlay, visibleCard)) {
          collisions.push(`${name} overlaps visible card: ${card.getAttribute('aria-label') || card.textContent.trim()}`);
        }
      }
    }

    return {
      hint,
      toolbar,
      toast,
      gameMain,
      worldViewport,
      collisions,
      hintText: hintElement.innerText,
      hintDisplay: getComputedStyle(hintElement).display,
      hintContentSize: {
        scrollWidth: hintElement.scrollWidth,
        clientWidth: hintElement.clientWidth,
        scrollHeight: hintElement.scrollHeight,
        clientHeight: hintElement.clientHeight,
      },
      hintInsideGameMain: hint.left >= gameMain.left - 1 && hint.top >= gameMain.top - 1
        && hint.right <= gameMain.right + 1 && hint.bottom <= gameMain.bottom + 1,
      allInsideBrowser: overlays.every(([, rect]) => rect.left >= -1 && rect.top >= -1
        && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1),
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
      },
    };
  });
  for (const instruction of [
    /Click or press Enter on objects to select them/i,
    /use the Inspector to move the group/i,
    /drag empty space to pan/i,
    /wheel to zoom/i,
  ]) {
    expect.soft(geometry.hintText, `visible selection guidance should include ${instruction} (${JSON.stringify(geometry)})`).toMatch(instruction);
  }
  expect.soft(geometry.hintDisplay,
    `multi-selection guidance should keep normal paragraph flow instead of the first-action lead/details grid (${JSON.stringify(geometry)})`)
    .toBe('block');
  expect.soft(geometry.hint.left, `selection guidance should remain within the game viewport (${JSON.stringify(geometry)})`).toBeGreaterThanOrEqual(-1);
  expect.soft(geometry.hint.top, `selection guidance should remain within the game viewport (${JSON.stringify(geometry)})`).toBeGreaterThanOrEqual(-1);
  expect.soft(geometry.hintInsideGameMain, `selection guidance should stay inside game-main (${JSON.stringify(geometry)})`).toBe(true);
  expect.soft(geometry.allInsideBrowser, `selection feedback and controls should fit the browser (${JSON.stringify(geometry)})`).toBe(true);
  expect.soft(geometry.hintContentSize.scrollWidth, `selection guidance should not clip horizontally (${JSON.stringify(geometry)})`)
    .toBeLessThanOrEqual(geometry.hintContentSize.clientWidth + 1);
  expect.soft(geometry.hintContentSize.scrollHeight, `selection guidance should not clip vertically (${JSON.stringify(geometry)})`)
    .toBeLessThanOrEqual(geometry.hintContentSize.clientHeight + 1);
  expect.soft(geometry.collisions, `selection hint, toolbar, toast, and visible cards should not collide (${JSON.stringify(geometry)})`).toEqual([]);
  expect.soft(geometry.document.scrollWidth, `selection state should not overflow the page horizontally (${JSON.stringify(geometry)})`)
    .toBeLessThanOrEqual(geometry.document.clientWidth + 1);
  expect.soft(geometry.document.scrollHeight, `selection state should not overflow the page vertically (${JSON.stringify(geometry)})`)
    .toBeLessThanOrEqual(geometry.document.clientHeight + 1);
});
