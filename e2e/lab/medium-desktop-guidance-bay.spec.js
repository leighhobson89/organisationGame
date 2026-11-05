import { expect, test } from '@playwright/test';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { encodeSave } from '../../src/game/persistence/save.js';
import { PREFERENCES_STORAGE_KEY } from '../../src/game/preferences/preferences.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const folioTestId = 'destination-cabinet-calibration';
const firstClueTestId = 'lab-item-calibration-card-01';
const viewports = [
  { width: 1051, height: 900 },
  { width: 1280, height: 720 },
];
const textScales = [1.125, 1.25, 1.5, 1.75, 2];

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

async function expectFullyInside(page, locator, container, description) {
  const geometry = await locator.evaluate((element, containerSelector) => {
    const rect = element.getBoundingClientRect();
    const parent = document.querySelector(containerSelector)?.getBoundingClientRect();
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
      target: element.getAttribute('data-testid'),
      hitTargetOrDescendant: hit === element || element.contains(hit),
      hit: hit && {
        testId: hit.getAttribute('data-testid'),
        className: typeof hit.className === 'string' ? hit.className : '',
      },
    };
  });

  expect(
    hitTest.hitTargetOrDescendant,
    `${description} should remain hit-testable at its center (${JSON.stringify(hitTest)})`,
  ).toBe(true);
}

async function expectNoOverlap(first, second, description) {
  const [firstBox, secondBox] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  expect(firstBox, `${description}: first element should have geometry`).not.toBeNull();
  expect(secondBox, `${description}: second element should have geometry`).not.toBeNull();
  const overlaps = firstBox.x < secondBox.x + secondBox.width
    && firstBox.x + firstBox.width > secondBox.x
    && firstBox.y < secondBox.y + secondBox.height
    && firstBox.y + firstBox.height > secondBox.y;
  expect(overlaps, `${description} should not overlap (${JSON.stringify({ firstBox, secondBox })})`).toBe(false);
}

for (const viewport of viewports) {
  for (const textScale of textScales) {
    test(`fresh ${viewport.width}x${viewport.height} guidance bay at ${Math.round(textScale * 100)}% keeps cards clear and calibration visible`, async ({ page }) => {
      await openFreshGame(page, viewport, textScale);

      const hint = page.locator('.world-hint');
      await expect(hint).toBeVisible();
      const layout = await hint.evaluate((element) => {
        const hintRect = element.getBoundingClientRect();
        const worldViewportRect = document.querySelector('[data-testid="world-viewport"]').getBoundingClientRect();
        const overlaps = (first, second) => first.left < second.right
          && first.right > second.left
          && first.top < second.bottom
          && first.bottom > second.top;
        const cardSelectors = '.world-scene .destination-card, .world-scene .lab-object';
        const targets = [
          ...Array.from(document.querySelectorAll(cardSelectors)).map((target) => ({ target, kind: 'visible world card' })),
          ...Array.from(document.querySelectorAll('.game-toolbar, .world-atlas-toggle')).map((target) => ({ target, kind: 'world control' })),
        ];
        const overlappingElements = targets
          .filter(({ target, kind }) => {
            if (target.getClientRects().length === 0) return false;
            const rect = target.getBoundingClientRect();
            const visibleRect = kind === 'visible world card'
              ? {
                left: Math.max(rect.left, worldViewportRect.left),
                top: Math.max(rect.top, worldViewportRect.top),
                right: Math.min(rect.right, worldViewportRect.right),
                bottom: Math.min(rect.bottom, worldViewportRect.bottom),
              }
              : rect;
            if (visibleRect.right <= visibleRect.left || visibleRect.bottom <= visibleRect.top) return false;
            return overlaps(hintRect, visibleRect);
          })
          .map(({ target, kind }) => {
            const rect = target.getBoundingClientRect();
            const bounds = kind === 'visible world card'
              ? {
                left: Math.max(rect.left, worldViewportRect.left),
                top: Math.max(rect.top, worldViewportRect.top),
                right: Math.min(rect.right, worldViewportRect.right),
                bottom: Math.min(rect.bottom, worldViewportRect.bottom),
              }
              : rect;
            return {
              kind,
              label: target.getAttribute('aria-label') || target.textContent.trim(),
              className: typeof target.className === 'string' ? target.className : '',
              bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom },
            };
          });

        return {
          hintBounds: { left: hintRect.left, top: hintRect.top, right: hintRect.right, bottom: hintRect.bottom },
          worldViewportBounds: {
            left: worldViewportRect.left,
            top: worldViewportRect.top,
            right: worldViewportRect.right,
            bottom: worldViewportRect.bottom,
          },
          viewport: { width: window.innerWidth, height: window.innerHeight },
          insideViewport: hintRect.left >= 0
            && hintRect.top >= 0
            && hintRect.right <= window.innerWidth
            && hintRect.bottom <= window.innerHeight,
          worldViewportEndsAboveHint: worldViewportRect.bottom <= hintRect.top + 1,
          overlappingElements,
        };
      });

      expect(
        layout.insideViewport,
        `the complete guidance bay should stay inside ${viewport.width}x${viewport.height} at ${Math.round(textScale * 100)}% (${JSON.stringify(layout)})`,
      ).toBe(true);
      expect(
        layout.worldViewportEndsAboveHint,
        `the world viewport should end before the reserved guidance bay at ${viewport.width}x${viewport.height} and ${Math.round(textScale * 100)}% (${JSON.stringify(layout)})`,
      ).toBe(true);
      expect(
        layout.overlappingElements,
        `the guidance bay should not cover world cards or controls at ${viewport.width}x${viewport.height} and ${Math.round(textScale * 100)}% (${JSON.stringify(layout)})`,
      ).toEqual([]);

      const folio = page.getByTestId(folioTestId);
      const firstClue = page.getByTestId(firstClueTestId);
      await expectNoOverlap(page.locator('.game-toolbar'), folio, 'world toolbar and Harmonic Calibration Folio');
      await expectFullyInside(page, folio, '[data-testid="world-viewport"]', 'the Harmonic Calibration Folio');
      await expectFullyInside(page, firstClue, '[data-testid="world-viewport"]', 'the first calibration clue');
      await expectCenterHitTestable(folio, 'the Harmonic Calibration Folio');
      await expectCenterHitTestable(firstClue, 'the first calibration clue');
    });
  }
}

test('1280x720 at 200% keeps the toolbar on one row and clear of the Harmonic Calibration Folio', async ({ page }) => {
  await openFreshGame(page, { width: 1280, height: 720 }, 2);

  const layout = await page.evaluate(() => {
    const toolbar = document.querySelector('.game-toolbar');
    const toolbarRect = toolbar.getBoundingClientRect();
    const folioRect = document.querySelector('[data-testid="destination-cabinet-calibration"]').getBoundingClientRect();
    const childCenters = Array.from(toolbar.children)
      .filter((child) => child.getClientRects().length > 0)
      .map((child) => {
        const rect = child.getBoundingClientRect();
        return rect.top + rect.height / 2;
      });
    return {
      toolbar: { left: toolbarRect.left, top: toolbarRect.top, right: toolbarRect.right, bottom: toolbarRect.bottom, height: toolbarRect.height },
      folio: { left: folioRect.left, top: folioRect.top, right: folioRect.right, bottom: folioRect.bottom },
      childCenterSpread: childCenters.length > 0 ? Math.max(...childCenters) - Math.min(...childCenters) : Number.POSITIVE_INFINITY,
    };
  });
  const overlaps = layout.toolbar.left < layout.folio.right
    && layout.toolbar.right > layout.folio.left
    && layout.toolbar.top < layout.folio.bottom
    && layout.toolbar.bottom > layout.folio.top;

  expect(layout.toolbar.height, `the world toolbar should fit in one row (${JSON.stringify(layout)})`).toBeLessThanOrEqual(80);
  expect(layout.childCenterSpread, `toolbar controls should share one row (${JSON.stringify(layout)})`).toBeLessThanOrEqual(8);
  expect(overlaps, `the world toolbar should not intersect the Folio (${JSON.stringify(layout)})`).toBe(false);
});

test('1051x900 at 200% exposes right toolbar overflow and keeps the last action focusable', async ({ page }) => {
  await openFreshGame(page, { width: 1051, height: 900 }, 2);

  const toolbar = page.locator('.game-toolbar');
  const initial = await toolbar.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    scrollLeft: element.scrollLeft,
  }));

  expect(initial.scrollWidth, 'the full navigation rail should retain horizontal overflow instead of wrapping').toBeGreaterThan(initial.clientWidth + 1);
  await expect(page.locator('.game-toolbar-overflow-cue--right')).toBeVisible();

  const lastAction = toolbar.locator('button:visible, select:visible').last();
  const accessibleNameBefore = await lastAction.getAttribute('aria-label');
  expect(accessibleNameBefore, 'the last actionable toolbar control should retain an accessible name').toBeTruthy();
  const beforeFocus = await lastAction.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const rail = element.closest('.game-toolbar');
    const railRect = rail.getBoundingClientRect();
    const clipLeft = railRect.left + rail.clientLeft;
    const clipRight = clipLeft + rail.clientWidth;
    return {
      inside: rect.left >= clipLeft - 1 && rect.right <= clipRight + 1,
      scrollLeft: rail.scrollLeft,
    };
  });
  await lastAction.focus();
  await expect(lastAction).toBeFocused();

  const focusedBounds = await lastAction.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const rail = element.closest('.game-toolbar');
    const railRect = rail.getBoundingClientRect();
    const clipLeft = railRect.left + rail.clientLeft;
    const clipRight = clipLeft + rail.clientWidth;
    return {
      left: rect.left,
      right: rect.right,
      clipLeft,
      clipRight,
      inside: rect.left >= clipLeft - 1 && rect.right <= clipRight + 1,
      scrollLeft: rail.scrollLeft,
    };
  });

  if (!beforeFocus.inside) {
    expect(focusedBounds.scrollLeft, 'focusing a clipped toolbar action should advance the overflow rail').toBeGreaterThan(beforeFocus.scrollLeft);
  }
  expect(focusedBounds.inside, `the focused action should scroll fully inside the toolbar rail (${JSON.stringify(focusedBounds)})`).toBe(true);
  expect(await lastAction.getAttribute('aria-label'), 'focus scrolling should preserve the control accessible name').toBe(accessibleNameBefore);
});

test('1280x720 at 200% keeps a saved camera transform and autosave bytes through guidance layout', async ({ page }) => {
  const savedCamera = { panX: -321, panY: -222, scale: 0.9 };
  const savedState = createNewGameState();
  savedState.camera = savedCamera;
  const savedBytes = encodeSave(savedState);

  await page.setViewportSize({ width: 1280, height: 720 });
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
  await expect.poll(() => scene.evaluate((element) => element.style.transform))
    .toBe('translate(-321px, -222px) scale(0.9)');
  const storedBytes = await page.evaluate((saveKey) => window.localStorage.getItem(saveKey), autoSaveKey);
  expect(storedBytes, 'the guidance layout should preserve the saved autosave bytes exactly').toBe(savedBytes);

  await page.setViewportSize({ width: 1279, height: 720 });
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect.poll(() => scene.evaluate((element) => element.style.transform))
    .toBe('translate(-321px, -222px) scale(0.9)');
  const bytesAfterLayout = await page.evaluate((saveKey) => window.localStorage.getItem(saveKey), autoSaveKey);
  expect(bytesAfterLayout, 'viewport layout should not rewrite the saved autosave bytes').toBe(savedBytes);
});

test('1280x720 at 200% keeps visible feedback inside the reserved bay clear of hint, cards, and controls', async ({ page }) => {
  await openFreshGame(page, { width: 1280, height: 720 }, 2);

  const toast = page.getByTestId('game-feedback');
  await toast.evaluate((element) => {
    element.textContent = 'Calibration selection feedback.';
  });
  await expect(toast).toBeVisible();

  const layout = await toast.evaluate((element) => {
    const toastRect = element.getBoundingClientRect();
    const hintRect = document.querySelector('.world-hint').getBoundingClientRect();
    const worldViewportRect = document.querySelector('[data-testid="world-viewport"]').getBoundingClientRect();
    const viewportRect = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    const overlaps = (first, second) => first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top;
    const targets = [
      ...Array.from(document.querySelectorAll('.world-scene .destination-card, .world-scene .lab-object'))
        .map((target) => ({ target, kind: 'visible world card' })),
      ...Array.from(document.querySelectorAll('.game-toolbar, .world-atlas-toggle'))
        .map((target) => ({ target, kind: 'world control' })),
      { target: document.querySelector('.world-hint'), kind: 'world hint' },
    ];
    const overlappingElements = targets
      .filter(({ target, kind }) => {
        if (!target || target.getClientRects().length === 0) return false;
        const rect = target.getBoundingClientRect();
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
        className: typeof target.className === 'string' ? target.className : '',
        bounds: (() => {
          const rect = target.getBoundingClientRect();
          const visibleRect = kind === 'visible world card'
            ? {
              left: Math.max(rect.left, worldViewportRect.left),
              top: Math.max(rect.top, worldViewportRect.top),
              right: Math.min(rect.right, worldViewportRect.right),
              bottom: Math.min(rect.bottom, worldViewportRect.bottom),
            }
            : rect;
          return {
            left: visibleRect.left,
            top: visibleRect.top,
            right: visibleRect.right,
            bottom: visibleRect.bottom,
          };
        })(),
      }));

    return {
      toastBounds: { left: toastRect.left, top: toastRect.top, right: toastRect.right, bottom: toastRect.bottom },
      worldViewportBounds: { left: worldViewportRect.left, top: worldViewportRect.top, right: worldViewportRect.right, bottom: worldViewportRect.bottom },
      insideViewport: toastRect.left >= viewportRect.left
        && toastRect.top >= viewportRect.top
        && toastRect.right <= viewportRect.right
        && toastRect.bottom <= viewportRect.bottom,
      insideReservedBay: toastRect.top >= worldViewportRect.bottom - 1,
      overlappingElements,
    };
  });

  expect(layout.insideViewport, `feedback should remain in the browser viewport (${JSON.stringify(layout)})`).toBe(true);
  expect(layout.insideReservedBay, `feedback should stay in the reserved bay below the world viewport (${JSON.stringify(layout)})`).toBe(true);
  expect(layout.overlappingElements, `feedback should not cover the hint, cards, or controls (${JSON.stringify(layout)})`).toEqual([]);
});
