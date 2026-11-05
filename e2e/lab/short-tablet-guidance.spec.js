import { expect, test } from '@playwright/test';
import { PREFERENCES_STORAGE_KEY } from '../../src/game/preferences/preferences.js';

const folioTestId = 'destination-cabinet-calibration';
const firstClueTestId = 'lab-item-calibration-card-01';
const widths = [721, 768, 1050];
const heights = [550, 600, 719];

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

async function expectFullyInside(locator, container, description) {
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
  }, container);

  expect(geometry, `${description} and its containing viewport should have geometry`).not.toBeNull();
  expect(geometry.inside, `${description} should remain fully inside its viewport (${JSON.stringify(geometry)})`).toBe(true);
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

  expect(hitTest.hitTargetOrDescendant, `${description} should remain hit-testable at its center (${JSON.stringify(hitTest)})`).toBe(true);
}

for (const width of widths) {
  for (const height of heights) {
    const viewport = { width, height };
    test(`fresh ${viewport.width}x${viewport.height} guidance at 100% clears short-tablet controls and cards`, async ({ page }) => {
      await openFreshGame(page, viewport, 1);

      const hint = page.locator('.world-hint');
      const toolbar = page.locator('.game-toolbar');
      const atlas = page.getByTestId('world-atlas-toggle');
      const folio = page.getByTestId(folioTestId);
      const firstClue = page.getByTestId(firstClueTestId);
      await expect(hint).toBeVisible();
      await expect(hint).toContainText(/Start with Harmonic Calibration/i);
      await expect(toolbar).toBeVisible();
      await expect(atlas).toBeVisible();

      const layout = await page.evaluate(() => {
        const readRect = (element) => {
          const rect = element.getBoundingClientRect();
          return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
        };
        const intersects = (first, second) => first.left < second.right
          && first.right > second.left
          && first.top < second.bottom
          && first.bottom > second.top;
        const hint = readRect(document.querySelector('.world-hint'));
        const toolbar = readRect(document.querySelector('.game-toolbar'));
        const atlas = readRect(document.querySelector('[data-testid="world-atlas-toggle"]'));
        const folio = readRect(document.querySelector('[data-testid="destination-cabinet-calibration"]'));
        const worldViewport = readRect(document.querySelector('[data-testid="world-viewport"]'));
        const browser = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
        const overlays = [
          ['hint', hint],
          ['toolbar', toolbar],
          ['Atlas toggle', atlas],
        ];
        const violations = [];

        for (const [name, rect] of overlays) {
          if (rect.left < browser.left - 1 || rect.top < browser.top - 1
            || rect.right > browser.right + 1 || rect.bottom > browser.bottom + 1) {
            violations.push(`${name} is outside the browser viewport`);
          }
        }

        for (let firstIndex = 0; firstIndex < overlays.length; firstIndex += 1) {
          for (let secondIndex = firstIndex + 1; secondIndex < overlays.length; secondIndex += 1) {
            const [firstName, firstRect] = overlays[firstIndex];
            const [secondName, secondRect] = overlays[secondIndex];
            if (intersects(firstRect, secondRect)) violations.push(`${firstName} overlaps ${secondName}`);
          }
        }

        if (intersects(atlas, folio)) violations.push('Atlas toggle overlaps the Harmonic Calibration Folio');
        if (intersects(toolbar, folio)) violations.push('toolbar overlaps the Harmonic Calibration Folio');

        const worldCards = Array.from(document.querySelectorAll('.world-scene .destination-card, .world-scene .lab-object'));
        for (const [overlayName, overlayRect] of overlays) {
          for (const card of worldCards) {
            if (card.getClientRects().length === 0) continue;
            const rect = readRect(card);
            const visibleRect = {
              left: Math.max(rect.left, worldViewport.left),
              top: Math.max(rect.top, worldViewport.top),
              right: Math.min(rect.right, worldViewport.right),
              bottom: Math.min(rect.bottom, worldViewport.bottom),
            };
            if (visibleRect.right <= visibleRect.left || visibleRect.bottom <= visibleRect.top) continue;
            if (intersects(overlayRect, visibleRect)) {
              const label = card.getAttribute('aria-label') || card.textContent.trim();
              violations.push(`${overlayName} overlaps visible card: ${label}`);
            }
          }
        }

        return {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          hint,
          toolbar,
          atlas,
          folio,
          worldViewport,
          violations,
          document: {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          },
        };
      });

      expect(
        layout.violations,
        `short-tablet guidance, controls, Folio, and visible cards should remain clear (${JSON.stringify(layout)})`,
      ).toEqual([]);
      expect(
        layout.document.scrollWidth,
        `the ${viewport.width}px short-tablet layout should not create horizontal document overflow (${JSON.stringify(layout)})`,
      ).toBeLessThanOrEqual(layout.document.clientWidth + 1);

      await expectCenterHitTestable(atlas, 'the World Atlas toggle');
      await expectFullyInside(atlas, '.game-main', 'the World Atlas toggle');
      await expectFullyInside(folio, '[data-testid="world-viewport"]', 'the Harmonic Calibration Folio');
      await expectFullyInside(firstClue, '[data-testid="world-viewport"]', 'the first calibration clue');
      await expectCenterHitTestable(folio, 'the Harmonic Calibration Folio');
      await expectCenterHitTestable(firstClue, 'the first calibration clue');
    });
  }
}

test('768x550 Tab scrolls the navigation rail to Select multiple items without moving the page', async ({ page }) => {
  await openFreshGame(page, { width: 768, height: 550 }, 1);

  const toolbar = page.locator('.game-toolbar');
  const controls = toolbar.locator('button:visible, select:visible');
  const zoomOut = page.getByRole('button', { name: 'Zoom out', exact: true });
  const target = page.getByTestId('multi-selection-toggle');
  const targetIndex = await controls.evaluateAll((elements) => elements.findIndex((element) => element.dataset.testid === 'multi-selection-toggle'));
  expect(targetIndex, 'Select multiple items should be part of the world navigation rail').toBeGreaterThan(0);

  const before = await page.evaluate(() => {
    const rail = document.querySelector('.game-toolbar');
    const button = document.querySelector('[data-testid="multi-selection-toggle"]');
    const railRect = rail.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const clipLeft = railRect.left + rail.clientLeft;
    const clipRight = clipLeft + rail.clientWidth;
    return {
      clientWidth: rail.clientWidth,
      scrollWidth: rail.scrollWidth,
      scrollLeft: rail.scrollLeft,
      targetInsideRail: buttonRect.left >= clipLeft - 1 && buttonRect.right <= clipRight + 1,
      pageScroll: { x: window.scrollX, y: window.scrollY },
    };
  });
  expect(before.scrollWidth, 'the short-tablet navigation rail should overflow horizontally').toBeGreaterThan(before.clientWidth + 1);
  expect(before.targetInsideRail, 'Select multiple items should begin outside the visible portion of the rail').toBe(false);

  await zoomOut.focus();
  await expect(zoomOut).toBeFocused();
  for (let index = 1; index <= targetIndex; index += 1) {
    await page.keyboard.press('Tab');
    await expect(controls.nth(index), 'Tab should move through the world navigation controls in order').toBeFocused();
  }
  await expect(target, 'Tab traversal should leave Select multiple items focused').toBeFocused();

  const after = await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const rail = element.closest('.game-toolbar');
    const railRect = rail.getBoundingClientRect();
    const clipLeft = railRect.left + rail.clientLeft;
    const clipTop = railRect.top + rail.clientTop;
    const clipRight = clipLeft + rail.clientWidth;
    const clipBottom = clipTop + rail.clientHeight;
    const style = window.getComputedStyle(element);
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      scrollLeft: rail.scrollLeft,
      insideRail: rect.left >= clipLeft - 1 && rect.right <= clipRight + 1
        && rect.top >= clipTop - 1 && rect.bottom <= clipBottom + 1,
      insideViewport: rect.left >= -1 && rect.top >= -1
        && rect.right <= window.innerWidth + 1 && rect.bottom <= window.innerHeight + 1,
      focused: document.activeElement === element,
      focusVisible: element.matches(':focus-visible'),
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      hitTestable: hit === element || element.contains(hit),
      pageScroll: { x: window.scrollX, y: window.scrollY },
    };
  });

  expect(after.scrollLeft, `keyboard focus should scroll the rail toward Select multiple items (${JSON.stringify({ before, after })})`).toBeGreaterThan(before.scrollLeft);
  expect(after.insideRail, `the focused action should be fully inside the rail (${JSON.stringify(after)})`).toBe(true);
  expect(after.insideViewport, `the focused action should remain inside the browser viewport (${JSON.stringify(after)})`).toBe(true);
  expect(after.focused, 'the action should retain keyboard focus after horizontal scrolling').toBe(true);
  expect(after.focusVisible, 'keyboard focus should use the visible focus state').toBe(true);
  expect(after.outlineStyle, 'the focused action should have a visible keyboard outline').not.toBe('none');
  expect(after.outlineWidth, 'the keyboard outline should have positive width').toBeGreaterThan(0);
  expect(after.hitTestable, 'the focused action should remain center-hit-testable').toBe(true);
  expect(after.pageScroll, 'keyboard toolbar scrolling should not move the document').toEqual(before.pageScroll);
});

async function expectSelectionFeedbackBay(page, height) {
  await openFreshGame(page, { width: 768, height }, 1);

  const sidePanels = page.locator('.panel, .world-atlas-panel, .world-item-finder');
  await expect(sidePanels, 'the selection-mode toast check should start without an open side panel').toHaveCount(0);
  const scene = page.locator('.world-scene');
  const cameraBeforeToggle = await scene.evaluate((element) => element.style.transform);
  const selectionToggle = page.getByTestId('multi-selection-toggle');
  await selectionToggle.click();
  await expect(selectionToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(sidePanels, 'the Select multiple items action should not open a side panel').toHaveCount(0);
  expect(await scene.evaluate((element) => element.style.transform), 'the selection-mode toast should not move the camera')
    .toBe(cameraBeforeToggle);

  const toast = page.getByTestId('game-feedback');
  const hint = page.locator('.world-hint');
  await expect(toast).toContainText('Select or deselect objects in the laboratory');
  await expect(toast).toBeVisible();
  await expect.soft(hint, 'selection feedback should temporarily hide the world hint').toBeHidden();

  const layout = await page.evaluate(() => {
    const readRect = (element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    const toast = document.querySelector('[data-testid="game-feedback"]');
    const hint = document.querySelector('.world-hint');
    const toastRect = readRect(toast);
    const hintRect = readRect(hint);
    const worldViewportRect = readRect(document.querySelector('[data-testid="world-viewport"]'));
    const overlaps = (first, second) => first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top;
    const targets = [
      { target: hint, kind: 'world hint' },
      ...Array.from(document.querySelectorAll('.game-toolbar, .world-atlas-toggle'))
        .map((target) => ({ target, kind: 'world control' })),
      ...Array.from(document.querySelectorAll('.world-scene .destination-card, .world-scene .lab-object'))
        .map((target) => ({ target, kind: 'visible world card' })),
    ];
    const overlappingElements = targets
      .filter(({ target, kind }) => {
        if (target.getClientRects().length === 0) return false;
        const rect = readRect(target);
        const visibleRect = kind === 'visible world card'
          ? {
            left: Math.max(rect.left, worldViewportRect.left),
            top: Math.max(rect.top, worldViewportRect.top),
            right: Math.min(rect.right, worldViewportRect.right),
            bottom: Math.min(rect.bottom, worldViewportRect.bottom),
          }
          : rect;
        if (visibleRect.right <= visibleRect.left || visibleRect.bottom <= visibleRect.top) return false;
        return overlaps(toastRect, visibleRect);
      })
      .map(({ target, kind }) => ({
        kind,
        label: target.getAttribute('aria-label') || target.textContent.trim(),
        bounds: readRect(target),
      }));
    const hintVisible = hint.getClientRects().length > 0 && window.getComputedStyle(hint).display !== 'none';
    return {
      toast: toastRect,
      hint: hintRect,
      worldViewport: worldViewportRect,
      hintVisible,
      overlappingElements,
      insideViewport: toastRect.left >= 0
        && toastRect.top >= 0
        && toastRect.right <= window.innerWidth
        && toastRect.bottom <= window.innerHeight,
      insideGuidanceBay: toastRect.top >= worldViewportRect.bottom - 1,
      clearOfHint: !hintVisible || !overlaps(toastRect, hintRect),
    };
  });

  expect(layout.insideViewport, `selection feedback should stay inside the browser viewport (${JSON.stringify(layout)})`).toBe(true);
  expect(layout.insideGuidanceBay, `selection feedback should stay below the shortened world viewport (${JSON.stringify(layout)})`).toBe(true);
  expect(layout.clearOfHint, `selection feedback should be clear of the remaining hint (${JSON.stringify(layout)})`).toBe(true);
  expect(layout.overlappingElements, `selection feedback should not cover controls or visible cards (${JSON.stringify(layout)})`).toEqual([]);
}

test('768x600 selection feedback stays in the guidance bay clear of the hint, controls, and cards', async ({ page }) => {
  await expectSelectionFeedbackBay(page, 600);
});

test('768x550 selection feedback stays in the guidance bay clear of the hint, controls, and cards', async ({ page }) => {
  await expectSelectionFeedbackBay(page, 550);
});
