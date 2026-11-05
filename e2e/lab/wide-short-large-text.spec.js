import { expect, test } from '@playwright/test';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { encodeSave } from '../../src/game/persistence/save.js';
import { PREFERENCES_STORAGE_KEY } from '../../src/game/preferences/preferences.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const wideShortLargeTextAttribute = 'data-wide-short-large-text';
const widths = [1341, 1440];
const heights = [550, 600, 719];
const textScales = [1.5, 1.75, 2];
const openPanelCases = [
  {
    name: 'Notebook',
    selector: '.notebook-panel',
    open: async (page) => page.getByTestId('toggle-notebook').click(),
  },
  {
    name: 'Atlas',
    selector: '[data-testid="world-atlas-panel"]',
    open: async (page) => page.getByTestId('world-atlas-toggle').click(),
  },
  {
    name: 'Item Finder',
    selector: '.world-item-finder',
    open: async (page) => page.getByRole('button', { name: 'Find an item', exact: true }).click(),
  },
  {
    name: 'Inspector',
    selector: '[data-testid="item-inspector"]',
    open: async (page) => page.getByTestId('lab-item-calibration-card-01').click(),
  },
];

const layoutStyleSelectors = {
  header: '.game-header',
  main: '.game-main',
  worldViewport: '[data-testid="world-viewport"]',
  overlayHost: '.world-overlay-host',
  bottomStack: '.world-bottom-stack',
  toolbar: '.game-toolbar',
  hint: '.world-hint',
};
const layoutStyleProperties = [
  'display', 'position', 'top', 'right', 'bottom', 'left',
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'boxSizing', 'margin', 'padding', 'gap', 'rowGap', 'columnGap',
  'flexDirection', 'flexWrap', 'alignItems', 'justifyContent',
  'gridTemplateColumns', 'gridTemplateRows', 'overflowX', 'overflowY', 'transform',
];

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

async function expectNoDocumentOverflow(page, context) {
  const dimensions = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    document: {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    },
  }));
  expect.soft(dimensions.document.scrollWidth, `${context}: document should not overflow horizontally (${JSON.stringify(dimensions)})`)
    .toBeLessThanOrEqual(dimensions.document.clientWidth + 1);
  expect.soft(dimensions.document.scrollHeight, `${context}: document should not overflow vertically (${JSON.stringify(dimensions)})`)
    .toBeLessThanOrEqual(dimensions.document.clientHeight + 1);
}

async function readOpenPanelLayoutStyles(page) {
  return page.evaluate(({ selectors, properties }) => Object.fromEntries(
    Object.entries(selectors).map(([name, selector]) => {
      const element = document.querySelector(selector);
      if (!element) return [name, null];
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return [name, {
        styles: Object.fromEntries(properties.map((property) => [property, style[property]])),
        bounds: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      }];
    }),
  ), { selectors: layoutStyleSelectors, properties: layoutStyleProperties });
}

async function expectContainedAndCenterHitTestable(locator, containerSelector, description, context) {
  const geometry = await locator.evaluate((element, selector) => {
    const rect = element.getBoundingClientRect();
    const parent = document.querySelector(selector)?.getBoundingClientRect();
    if (!parent) return null;
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      target: element.getAttribute('data-testid') || element.getAttribute('aria-label') || element.textContent.trim(),
      element: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      container: { left: parent.left, top: parent.top, right: parent.right, bottom: parent.bottom },
      fullyInside: rect.left >= parent.left - 1 && rect.top >= parent.top - 1
        && rect.right <= parent.right + 1 && rect.bottom <= parent.bottom + 1,
      centerHitTestable: hit === element || element.contains(hit),
      hit: hit && {
        testId: hit.getAttribute('data-testid'),
        label: hit.getAttribute('aria-label') || hit.textContent.trim(),
        className: typeof hit.className === 'string' ? hit.className : '',
      },
    };
  }, containerSelector);
  expect.soft(geometry, `${context}: ${description} and its viewport should have geometry`).not.toBeNull();
  if (!geometry) return;
  expect.soft(geometry.fullyInside, `${context}: ${description} should remain fully inside its intended viewport (${JSON.stringify(geometry)})`)
    .toBe(true);
  expect.soft(geometry.centerHitTestable, `${context}: ${description} should be hit-testable at its center (${JSON.stringify(geometry)})`)
    .toBe(true);
}

async function expectFirstActionLayout(page, context) {
  const hint = page.locator('.world-hint');
  const lead = hint.locator('.world-hint__lead');
  const toolbar = page.locator('.game-toolbar');
  const atlas = page.getByTestId('world-atlas-toggle');
  await expect.soft(lead, `${context}: first-action guidance should remain visible`).toBeVisible();
  await expect.soft(lead, `${context}: first-action guidance should name the first collection`).toContainText(/Start with Harmonic Calibration/i);
  await expect.soft(page.getByRole('progressbar', { name: 'Laboratory restoration' }), `${context}: restoration progress should stay available`).toBeVisible();
  await expect.soft(toolbar, `${context}: world controls should remain visible`).toBeVisible();
  await expect.soft(atlas, `${context}: the World Atlas control should remain visible`).toBeVisible();

  const geometry = await page.evaluate(() => {
    const read = (element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    const intersectsRects = (first, second) => first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top;
    const hint = read(document.querySelector('.world-hint'));
    const toolbar = read(document.querySelector('.game-toolbar'));
    const atlas = read(document.querySelector('[data-testid="world-atlas-toggle"]'));
    const world = read(document.querySelector('[data-testid="world-viewport"]'));
    const viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const visibleCards = [...document.querySelectorAll('.world-scene .destination-card, .world-scene .lab-object')]
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => {
        const rect = read(element);
        return {
          label: element.getAttribute('aria-label') || element.textContent.trim(),
          bounds: {
            left: Math.max(rect.left, world.left),
            top: Math.max(rect.top, world.top),
            right: Math.min(rect.right, world.right),
            bottom: Math.min(rect.bottom, world.bottom),
          },
        };
      })
      .filter(({ bounds }) => bounds.right > bounds.left && bounds.bottom > bounds.top);
    const overlapViolations = [];
    for (const [name, bounds] of [['toolbar', toolbar], ['Atlas control', atlas]]) {
      if (intersectsRects(hint, bounds)) overlapViolations.push(`first-action hint overlaps ${name}`);
    }
    for (const card of visibleCards) {
      if (intersectsRects(hint, card.bounds)) overlapViolations.push(`first-action hint covers ${card.label}`);
    }
    return {
      hint,
      toolbar,
      atlas,
      viewport,
      insideViewport: [hint, toolbar, atlas].every((bounds) => bounds.left >= -1
        && bounds.top >= -1 && bounds.right <= viewport.right + 1 && bounds.bottom <= viewport.bottom + 1),
      hintContent: {
        scrollWidth: document.querySelector('.world-hint').scrollWidth,
        clientWidth: document.querySelector('.world-hint').clientWidth,
        scrollHeight: document.querySelector('.world-hint').scrollHeight,
        clientHeight: document.querySelector('.world-hint').clientHeight,
      },
      overlaps: overlapViolations,
    };
  });

  expect.soft(geometry.insideViewport, `${context}: hint and controls should fit inside the browser (${JSON.stringify(geometry)})`).toBe(true);
  expect.soft(geometry.hintContent.scrollWidth, `${context}: first-action guidance should not clip horizontally (${JSON.stringify(geometry)})`)
    .toBeLessThanOrEqual(geometry.hintContent.clientWidth + 1);
  expect.soft(geometry.hintContent.scrollHeight, `${context}: first-action guidance should not clip vertically (${JSON.stringify(geometry)})`)
    .toBeLessThanOrEqual(geometry.hintContent.clientHeight + 1);
  expect.soft(geometry.overlaps, `${context}: first-action guidance should not cover controls or visible cards (${JSON.stringify(geometry)})`)
    .toEqual([]);
}

for (const width of widths) {
  for (const height of heights) {
    for (const textScale of textScales) {
      const viewport = { width, height };
      const context = `${width}x${height} at ${Math.round(textScale * 100)}%`;
      test(`fresh ${context} keeps large-text first-action guidance usable`, async ({ page }) => {
        await openFreshGame(page, viewport, textScale);
        await expect.soft(page.locator('.game-shell')).toHaveAttribute(wideShortLargeTextAttribute, 'true');
        for (const selector of ['.notebook-panel', '[data-testid="world-atlas-panel"]', '.world-item-finder', '[data-testid="item-inspector"]']) {
          await expect(page.locator(selector), `${context}: fresh-start guidance should be checked with no open panel (${selector})`).toHaveCount(0);
        }

        const savedScale = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).textScale, PREFERENCES_STORAGE_KEY);
        expect.soft(savedScale, `${context}: the user's saved scale should be preserved`).toBe(textScale);
        await expect.soft(page.locator('html'), `${context}: computed text scale should match the user's preference`)
          .toHaveCSS('--text-scale', String(textScale));

        await expectFirstActionLayout(page, context);
        await expectContainedAndCenterHitTestable(
          page.getByTestId('world-atlas-toggle'),
          '.game-main',
          'World Atlas control',
          context,
        );
        await expectContainedAndCenterHitTestable(
          page.getByTestId('destination-cabinet-calibration'),
          '[data-testid="world-viewport"]',
          'Harmonic Calibration Folio',
          context,
        );
        await expectContainedAndCenterHitTestable(
          page.getByTestId('lab-item-calibration-card-01'),
          '[data-testid="world-viewport"]',
          'first calibration clue',
          context,
        );
        await expectNoDocumentOverflow(page, context);
      });
    }
  }
}

test('1341x550 at 200% keeps world toolbar actions reachable by keyboard without scrolling the page', async ({ page }) => {
  const context = '1341x550 at 200%';
  await openFreshGame(page, { width: 1341, height: 550 }, 2);

  const toolbar = page.locator('.game-toolbar');
  const controls = toolbar.locator('button:visible, select:visible');
  const count = await controls.count();
  expect(count, `${context}: the world toolbar should expose keyboard-focusable actions`).toBeGreaterThan(0);
  const initialPageScroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));

  await controls.first().focus();
  let scrolledRail = false;
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    if (index > 0) await page.keyboard.press('Tab');
    await expect(control, `${context}: Tab should reach world toolbar action ${index + 1}`).toBeFocused();
    await expect(control, `${context}: toolbar action ${index + 1} should have an accessible name`).toHaveAccessibleName(/.+/);
    const geometry = await control.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const rail = element.closest('.game-toolbar');
      const railRect = rail.getBoundingClientRect();
      const left = railRect.left + rail.clientLeft;
      const right = left + rail.clientWidth;
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        visibleInRail: rect.left >= left - 1 && rect.right <= right + 1,
        hitTestable: hit === element || element.contains(hit),
        scrollLeft: rail.scrollLeft,
        pageScroll: { x: scrollX, y: scrollY },
      };
    });
    scrolledRail ||= geometry.scrollLeft > 1;
    expect.soft(geometry.visibleInRail, `${context}: focused actions should remain visible inside the toolbar rail (${JSON.stringify(geometry)})`).toBe(true);
    expect.soft(geometry.hitTestable, `${context}: focused actions should remain hit-testable (${JSON.stringify(geometry)})`).toBe(true);
    expect.soft(geometry.pageScroll, `${context}: keyboard navigation should not scroll the page`).toEqual(initialPageScroll);
  }

  const overflow = await toolbar.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
  if (overflow) expect(scrolledRail, `${context}: keyboard focus should scroll an overflowing toolbar rail`).toBe(true);
});

test('1341x550 at 200% keeps header actions keyboard-reachable inside their horizontal rail', async ({ page }) => {
  const context = '1341x550 at 200%';
  await openFreshGame(page, { width: 1341, height: 550 }, 2);

  const actions = page.locator('.header-actions');
  const controls = actions.locator('button:visible, a[href]:visible, input:visible, select:visible');
  const count = await controls.count();
  expect(count, `${context}: the header should expose keyboard-focusable actions`).toBeGreaterThan(0);
  const initial = await actions.evaluate((element) => {
    element.scrollLeft = 0;
    return {
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      overflowX: getComputedStyle(element).overflowX,
      pageScroll: { x: scrollX, y: scrollY },
    };
  });
  let scrolledRail = false;

  await controls.first().focus();
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    if (index > 0) await page.keyboard.press('Tab');
    await expect(control, `${context}: Tab should reach header action ${index + 1}`).toBeFocused();
    await expect(control, `${context}: header action ${index + 1} should have an accessible name`).toHaveAccessibleName(/.+/);
    const geometry = await control.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const rail = element.closest('.header-actions');
      const railRect = rail.getBoundingClientRect();
      const left = railRect.left + rail.clientLeft;
      const right = left + rail.clientWidth;
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        label: element.getAttribute('aria-label') || element.innerText,
        bounds: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
        insideRail: rect.left >= left - 1 && rect.right <= right + 1,
        insideViewport: rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1,
        centerHitTestable: hit === element || element.contains(hit),
        scrollLeft: rail.scrollLeft,
        pageScroll: { x: scrollX, y: scrollY },
      };
    });
    scrolledRail ||= geometry.scrollLeft > 1;
    expect.soft(geometry.insideRail, `${context}: focused header actions should be visible inside the rail (${JSON.stringify({ initial, geometry })})`)
      .toBe(true);
    expect.soft(geometry.insideViewport, `${context}: focused header actions should stay inside the browser (${JSON.stringify(geometry)})`)
      .toBe(true);
    expect.soft(geometry.centerHitTestable, `${context}: focused header actions should remain hit-testable (${JSON.stringify(geometry)})`)
      .toBe(true);
    expect.soft(geometry.pageScroll, `${context}: keyboard navigation should not scroll the page (${JSON.stringify(geometry)})`)
      .toEqual(initial.pageScroll);
  }

  if (initial.scrollWidth > initial.clientWidth + 1) {
    expect.soft(['auto', 'scroll'].includes(initial.overflowX), `${context}: overflowing header actions should form a scrollable rail (${JSON.stringify(initial)})`)
      .toBe(true);
    expect.soft(scrolledRail, `${context}: keyboard focus should scroll an overflowing header rail`).toBe(true);
  }
});

test('1440x600 at 200% keeps selection guidance and feedback clear of one another and world content', async ({ page }) => {
  const context = '1440x600 at 200% selection mode';
  await openFreshGame(page, { width: 1440, height: 600 }, 2);

  const cameraBefore = await page.locator('.world-scene').evaluate((element) => element.style.transform);
  const toggle = page.getByTestId('multi-selection-toggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('game-feedback')).toBeVisible();
  await expect(page.locator('.world-hint')).toContainText(/Click or press Enter on objects to select them/i);
  expect(await page.locator('.world-scene').evaluate((element) => element.style.transform), `${context}: selection mode should not alter the camera`)
    .toBe(cameraBefore);

  const layout = await page.evaluate(() => {
    const read = (element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    const overlaps = (first, second) => first.left < second.right
      && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
    const hint = read(document.querySelector('.world-hint'));
    const toast = read(document.querySelector('[data-testid="game-feedback"]'));
    const toolbar = read(document.querySelector('.game-toolbar'));
    const world = read(document.querySelector('[data-testid="world-viewport"]'));
    const collisions = [];
    for (const [name, bounds] of [['toast', toast], ['toolbar', toolbar]]) {
      if (overlaps(hint, bounds)) collisions.push(`selection hint overlaps ${name}`);
    }
    if (overlaps(toast, toolbar)) collisions.push('feedback overlaps toolbar');
    for (const element of document.querySelectorAll('.world-scene .destination-card, .world-scene .lab-object')) {
      if (element.getClientRects().length === 0) continue;
      const rect = read(element);
      const visible = {
        left: Math.max(rect.left, world.left),
        top: Math.max(rect.top, world.top),
        right: Math.min(rect.right, world.right),
        bottom: Math.min(rect.bottom, world.bottom),
      };
      if (visible.right <= visible.left || visible.bottom <= visible.top) continue;
      if (overlaps(hint, visible)) collisions.push(`selection hint covers ${element.getAttribute('aria-label') || element.textContent.trim()}`);
      if (overlaps(toast, visible)) collisions.push(`feedback covers ${element.getAttribute('aria-label') || element.textContent.trim()}`);
    }
    return {
      hint,
      toast,
      toolbar,
      viewport: { left: 0, top: 0, right: innerWidth, bottom: innerHeight },
      collisions,
    };
  });
  for (const [label, bounds] of [['selection hint', layout.hint], ['feedback', layout.toast], ['toolbar', layout.toolbar]]) {
    expect.soft(bounds.left, `${context}: ${label} should remain inside the browser viewport (${JSON.stringify(layout)})`).toBeGreaterThanOrEqual(-1);
    expect.soft(bounds.top, `${context}: ${label} should remain inside the browser viewport (${JSON.stringify(layout)})`).toBeGreaterThanOrEqual(-1);
    expect.soft(bounds.right, `${context}: ${label} should remain inside the browser viewport (${JSON.stringify(layout)})`).toBeLessThanOrEqual(layout.viewport.right + 1);
    expect.soft(bounds.bottom, `${context}: ${label} should remain inside the browser viewport (${JSON.stringify(layout)})`).toBeLessThanOrEqual(layout.viewport.bottom + 1);
  }
  expect.soft(layout.collisions, `${context}: selection guidance and feedback should not cover each other, controls, or visible cards (${JSON.stringify(layout)})`)
    .toEqual([]);
  await expectNoDocumentOverflow(page, context);
});

test('1440x600 at 200% preserves camera and autosave bytes during responsive reflow', async ({ page }) => {
  const savedState = createNewGameState();
  savedState.camera = { panX: -321, panY: -222, scale: 0.9 };
  const savedBytes = encodeSave(savedState);
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.addInitScript(({ saveKey, preferencesKey, bytes }) => {
    window.localStorage.clear();
    window.localStorage.setItem(saveKey, bytes);
    window.localStorage.setItem(preferencesKey, JSON.stringify({
      version: 1,
      textScale: 2,
      reduceMotion: false,
      soundEffectsEnabled: false,
    }));
  }, { saveKey: autoSaveKey, preferencesKey: PREFERENCES_STORAGE_KEY, bytes: savedBytes });
  await page.goto('/');
  await expect(page.getByTestId('world-item-count')).toHaveText('174 objects');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });
  await expect.soft(page.locator('.game-shell')).toHaveAttribute(wideShortLargeTextAttribute, 'true');

  const scene = page.locator('.world-scene');
  const expectedTransform = 'translate(-321px, -222px) scale(0.9)';
  await expect.poll(() => scene.evaluate((element) => element.style.transform)).toBe(expectedTransform);
  expect(await page.evaluate((key) => localStorage.getItem(key), autoSaveKey), 'loading this large-text layout should preserve autosave bytes')
    .toBe(savedBytes);

  await page.setViewportSize({ width: 1439, height: 600 });
  await page.setViewportSize({ width: 1440, height: 600 });
  await expect.poll(() => scene.evaluate((element) => element.style.transform)).toBe(expectedTransform);
  expect(await page.evaluate((key) => localStorage.getItem(key), autoSaveKey), 'responsive reflow should not rewrite the saved camera or autosave bytes')
    .toBe(savedBytes);
});

test('wide short-height large-text mode respects width, height, and scale boundaries', async ({ page }) => {
  await openFreshGame(page, { width: 1340, height: 600 }, 2);
  await expect.soft(page.locator('.game-shell')).not.toHaveAttribute(wideShortLargeTextAttribute);

  await openFreshGame(page, { width: 1341, height: 549 }, 2);
  await expect.soft(page.locator('.game-shell')).not.toHaveAttribute(wideShortLargeTextAttribute);

  await openFreshGame(page, { width: 1341, height: 550 }, 2);
  await expect.soft(page.locator('.game-shell')).toHaveAttribute(wideShortLargeTextAttribute, 'true');

  await openFreshGame(page, { width: 1440, height: 719 }, 2);
  await expect.soft(page.locator('.game-shell')).toHaveAttribute(wideShortLargeTextAttribute, 'true');

  await openFreshGame(page, { width: 1440, height: 720 }, 2);
  await expect.soft(page.locator('.game-shell')).not.toHaveAttribute(wideShortLargeTextAttribute);

  await openFreshGame(page, { width: 1440, height: 600 }, 1.25);
  await expect(page.locator('html')).toHaveCSS('--text-scale', '1.25');
  await expect.soft(page.locator('.game-shell')).not.toHaveAttribute(wideShortLargeTextAttribute);
  await expect(page.locator('.world-hint__lead')).toBeVisible();
});

for (const panelCase of openPanelCases) {
  test(`1440x600 at 200% keeps ${panelCase.name} layout independent of the wide short-large-text flow mode`, async ({ page }) => {
    await openFreshGame(page, { width: 1440, height: 600 }, 2);
    const gameShell = page.locator('.game-shell');
    await expect.soft(gameShell).toHaveAttribute(wideShortLargeTextAttribute, 'true');

    await panelCase.open(page);
    const panel = page.locator(panelCase.selector);
    await expect(panel, `${panelCase.name} should open through its normal UI control`).toBeVisible();
    await expect.soft(gameShell).toHaveAttribute(wideShortLargeTextAttribute, 'true');
    const modeStyles = await readOpenPanelLayoutStyles(page);
    expect(Object.values(modeStyles).every(Boolean), 'the requested layout surfaces should exist while the panel is open').toBe(true);

    await gameShell.evaluate((element, attribute) => element.removeAttribute(attribute), wideShortLargeTextAttribute);
    const noModeStyles = await readOpenPanelLayoutStyles(page);
    expect(noModeStyles, `${panelCase.name}: open-panel layout styles should match with the mode attribute removed`)
      .toEqual(modeStyles);
  });
}
