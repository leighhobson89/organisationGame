import { expect, test } from '@playwright/test';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { encodeSave } from '../../src/game/persistence/save.js';
import { PREFERENCES_STORAGE_KEY } from '../../src/game/preferences/preferences.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const folioTestId = 'destination-cabinet-calibration';
const firstClueTestId = 'lab-item-calibration-card-01';
const viewports = [
  { width: 721, height: 720 },
  { width: 1050, height: 900 },
];
const textScales = [1, 1.125, 1.25, 1.5, 1.75, 2];

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

async function expectCenterHitTestable(locator, description, expectedRole) {
  const hitTest = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      accessibleName: element.getAttribute('aria-label'),
      role: element.getAttribute('role') || element.tagName.toLowerCase(),
      hitTargetOrDescendant: hit === element || element.contains(hit),
      hit: hit && {
        testId: hit.getAttribute('data-testid'),
        className: typeof hit.className === 'string' ? hit.className : '',
      },
    };
  });
  expect(hitTest.accessibleName, `${description} should expose an accessible name`).toBeTruthy();
  expect(hitTest.role, `${description} should retain its accessible role`).toBe(expectedRole);
  expect(hitTest.hitTargetOrDescendant, `${description} should remain hit-testable at its center (${JSON.stringify(hitTest)})`).toBe(true);
}

async function expectToolbarFocusReachable(page) {
  const toolbar = page.locator('.game-toolbar');
  const controls = toolbar.locator('button:visible, select:visible');
  const count = await controls.count();
  expect(count, 'the world toolbar should expose focusable controls').toBeGreaterThan(0);

  const initial = await toolbar.evaluate((element) => ({
    scrollLeft: element.scrollLeft,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  const scrollOffsets = [initial.scrollLeft];

  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    const beforeFocus = await control.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const rail = element.closest('.game-toolbar');
      const railRect = rail.getBoundingClientRect();
      const style = window.getComputedStyle(rail);
      return {
        elementRect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
        railRect: { left: railRect.left, top: railRect.top, right: railRect.right, bottom: railRect.bottom, width: railRect.width, height: railRect.height },
        clientWidth: rail.clientWidth,
        clientHeight: rail.clientHeight,
        scrollWidth: rail.scrollWidth,
        scrollHeight: rail.scrollHeight,
        scrollLeft: rail.scrollLeft,
        scrollTop: rail.scrollTop,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        windowScroll: { x: window.scrollX, y: window.scrollY },
      };
    });
    if (index === 0) await control.focus();
    else await page.keyboard.press('Tab');
    await expect(control, 'Tab should reach every visible world toolbar control in order').toBeFocused();
    await expect(control, 'every world toolbar control should retain an accessible name').toHaveAccessibleName(/.+/);

    const geometry = await control.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const rail = element.closest('.game-toolbar');
      const railRect = rail.getBoundingClientRect();
      const clipLeft = railRect.left + rail.clientLeft;
      const clipTop = railRect.top + rail.clientTop;
      const clipRight = clipLeft + rail.clientWidth;
      const clipBottom = clipTop + rail.clientHeight;
      const style = window.getComputedStyle(rail);
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        name: element.getAttribute('aria-label') || element.labels?.[0]?.innerText || element.innerText,
        elementRect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
        railRect: { left: railRect.left, top: railRect.top, right: railRect.right, bottom: railRect.bottom, width: railRect.width, height: railRect.height },
        clientWidth: rail.clientWidth,
        clientHeight: rail.clientHeight,
        scrollWidth: rail.scrollWidth,
        scrollHeight: rail.scrollHeight,
        scrollLeft: rail.scrollLeft,
        scrollTop: rail.scrollTop,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        windowScroll: { x: window.scrollX, y: window.scrollY },
        insideViewport: rect.left >= -1 && rect.top >= -1
          && rect.right <= window.innerWidth + 1 && rect.bottom <= window.innerHeight + 1,
        insideToolbar: rect.left >= clipLeft - 1 && rect.right <= clipRight + 1
          && rect.top >= clipTop - 1 && rect.bottom <= clipBottom + 1,
        hitTestable: hit === element || element.contains(hit),
        scrollLeft: rail.scrollLeft,
      };
    });

    const focusEffect = { beforeFocus, afterFocus: geometry };
    expect(geometry.insideViewport, `${geometry.name} should remain inside the browser viewport; focus effect: ${JSON.stringify(focusEffect)}`).toBe(true);
    expect(geometry.insideToolbar, `${geometry.name} should scroll into the toolbar view when focused; focus effect: ${JSON.stringify(focusEffect)}`).toBe(true);
    expect(geometry.hitTestable, `${geometry.name} should remain hit-testable after focus scrolling; focus effect: ${JSON.stringify(focusEffect)}`).toBe(true);
    scrollOffsets.push(geometry.scrollLeft);
  }

  const finalRail = await toolbar.evaluate((element) => ({
    scrollLeft: element.scrollLeft,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  if (initial.scrollWidth > initial.clientWidth + 1) {
    const scrollChanged = scrollOffsets.some((offset, index) => index > 0 && offset !== scrollOffsets[index - 1]);
    const reachedEnd = finalRail.scrollLeft + finalRail.clientWidth >= finalRail.scrollWidth - 1;
    expect(scrollChanged || reachedEnd, 'keyboard focus should scroll an overflowing toolbar rail to its actions').toBe(true);
  }
}

for (const viewport of viewports) {
  for (const textScale of textScales) {
    test(`fresh ${viewport.width}x${viewport.height} at ${Math.round(textScale * 100)}% keeps tablet-bridge guidance and controls clear`, async ({ page }) => {
      await openFreshGame(page, viewport, textScale);

      const hint = page.locator('.world-hint');
      const toolbar = page.locator('.game-toolbar');
      const atlas = page.getByTestId('world-atlas-toggle');
      const folio = page.getByTestId(folioTestId);
      const firstClue = page.getByTestId(firstClueTestId);
      await expect(hint).toBeVisible();
      await expect(hint).toContainText(/Start with Harmonic Calibration/i);
      await expect(hint).toContainText(/select a blueprint to inspect its clue/i);
      await expect(hint).toContainText(/file it in the Harmonic Calibration Folio/i);
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
        const worldViewport = readRect(document.querySelector('[data-testid="world-viewport"]'));
        const folio = readRect(document.querySelector('[data-testid="destination-cabinet-calibration"]'));
        const firstClue = readRect(document.querySelector('[data-testid="lab-item-calibration-card-01"]'));
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

        const worldCards = Array.from(document.querySelectorAll('.world-scene .destination-card, .world-scene .lab-object'));
        for (const overlay of overlays) {
          for (const card of worldCards) {
            if (card.getClientRects().length === 0) continue;
            const rect = readRect(card);
            const clipped = {
              left: Math.max(rect.left, worldViewport.left),
              top: Math.max(rect.top, worldViewport.top),
              right: Math.min(rect.right, worldViewport.right),
              bottom: Math.min(rect.bottom, worldViewport.bottom),
            };
            if (clipped.right <= clipped.left || clipped.bottom <= clipped.top) continue;
            if (intersects(overlay[1], clipped)) {
              const label = card.getAttribute('aria-label') || card.textContent.trim();
              violations.push(`${overlay[0]} overlaps visible card: ${label}`);
            }
          }
        }

        return {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          hint,
          toolbar,
          atlas,
          worldViewport,
          folio,
          firstClue,
          violations,
          document: {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          },
        };
      });

      expect.soft(layout.violations, `tablet-bridge hint, toolbar, Atlas, and visible cards should remain clear (${JSON.stringify(layout)})`).toEqual([]);
      expect.soft(
        layout.document.scrollWidth,
        `the ${viewport.width}px tablet-bridge layout should not create horizontal document overflow (${JSON.stringify(layout)})`,
      ).toBeLessThanOrEqual(layout.document.clientWidth + 1);

      await expectToolbarFocusReachable(page);
      await expectFullyInside(folio, '[data-testid="world-viewport"]', 'the Harmonic Calibration Folio');
      await expectFullyInside(firstClue, '[data-testid="world-viewport"]', 'the first calibration clue');
      if (viewport.width === 721 && viewport.height === 720 && textScale === 2) {
        const tabletGeometry = await page.evaluate(() => {
          const gameMain = document.querySelector('.game-main').getBoundingClientRect();
          const atlas = document.querySelector('[data-testid="world-atlas-toggle"]').getBoundingClientRect();
          const toolbarElement = document.querySelector('.game-toolbar');
          const toolbar = toolbarElement.getBoundingClientRect();
          const childCenters = Array.from(toolbarElement.children)
            .filter((child) => child.getClientRects().length > 0)
            .map((child) => {
              const rect = child.getBoundingClientRect();
              return rect.top + rect.height / 2;
            });
          const worldViewport = document.querySelector('[data-testid="world-viewport"]').getBoundingClientRect();
          const clue = document.querySelector('[data-testid="lab-item-calibration-card-01"]').getBoundingClientRect();
          return {
            gameMain: { left: gameMain.left, top: gameMain.top, right: gameMain.right, bottom: gameMain.bottom },
            atlas: { left: atlas.left, top: atlas.top, right: atlas.right, bottom: atlas.bottom },
            toolbar: { left: toolbar.left, top: toolbar.top, right: toolbar.right, bottom: toolbar.bottom, height: toolbar.height },
            toolbarChildCenterSpread: childCenters.length > 0 ? Math.max(...childCenters) - Math.min(...childCenters) : Number.POSITIVE_INFINITY,
            worldViewport: { left: worldViewport.left, top: worldViewport.top, right: worldViewport.right, bottom: worldViewport.bottom },
            clue: { top: clue.top, bottom: clue.bottom },
            gameMainMidpoint: (gameMain.left + gameMain.right) / 2,
            reservedBayHeight: gameMain.bottom - worldViewport.bottom,
          };
        });
        expect(
          Math.abs(tabletGeometry.atlas.left - (tabletGeometry.gameMain.left + 16)),
          `the Atlas should sit 16px from the game-main left edge (${JSON.stringify(tabletGeometry)})`,
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(tabletGeometry.atlas.top - tabletGeometry.gameMain.top),
          `the Atlas should align with the top of game-main (${JSON.stringify(tabletGeometry)})`,
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(tabletGeometry.toolbar.left - (tabletGeometry.gameMainMidpoint - 120)),
          `the toolbar should start 120px left of the viewport midpoint (${JSON.stringify(tabletGeometry)})`,
        ).toBeLessThanOrEqual(2);
        expect(
          Math.abs(tabletGeometry.toolbar.right - (tabletGeometry.gameMain.right - 16)),
          `the toolbar should end 16px before the right edge (${JSON.stringify(tabletGeometry)})`,
        ).toBeLessThanOrEqual(2);
        expect(
          tabletGeometry.toolbar.height,
          `the toolbar should occupy one row (${JSON.stringify(tabletGeometry)})`,
        ).toBeLessThanOrEqual(80);
        expect(
          tabletGeometry.toolbarChildCenterSpread,
          `toolbar controls should share one row (${JSON.stringify(tabletGeometry)})`,
        ).toBeLessThanOrEqual(3);
        expect(
          Math.abs(tabletGeometry.reservedBayHeight - 172),
          `the tablet guidance bay should reserve approximately 172px (${JSON.stringify(tabletGeometry)})`,
        ).toBeLessThanOrEqual(1);
        expect(
          tabletGeometry.clue.bottom,
          `the first clue should clear the bottom edge of the reserved world viewport by at least 6px (${JSON.stringify(tabletGeometry)})`,
        ).toBeLessThanOrEqual(tabletGeometry.worldViewport.bottom - 6);
      }
      await expectCenterHitTestable(folio, 'the Harmonic Calibration Folio', 'region');
      await expectCenterHitTestable(firstClue, 'the first calibration clue', 'button');
    });
  }
}

test('721x720 at 200% places selection feedback in the reserved bay and hides the hint', async ({ page }) => {
  await openFreshGame(page, { width: 721, height: 720 }, 2);

  const hint = page.locator('.world-hint');
  const toast = page.getByTestId('game-feedback');
  await page.getByRole('button', { name: 'Select multiple items', exact: true }).click();
  await expect(toast).toContainText('Select or deselect objects in the laboratory');
  await expect(toast).toBeVisible();
  await expect.soft(hint, 'the transient feedback toast should temporarily hide the world hint').toBeHidden();

  const layout = await toast.evaluate((element) => {
    const toastRect = element.getBoundingClientRect();
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
        return overlaps(toastRect, visibleRect);
      })
      .map(({ target, kind }) => ({
        kind,
        label: target.getAttribute('aria-label') || target.textContent.trim(),
        bounds: (() => {
          const rect = target.getBoundingClientRect();
          if (kind !== 'visible world card') return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
          return {
            left: Math.max(rect.left, worldViewportRect.left),
            top: Math.max(rect.top, worldViewportRect.top),
            right: Math.min(rect.right, worldViewportRect.right),
            bottom: Math.min(rect.bottom, worldViewportRect.bottom),
          };
        })(),
      }));
    return {
      toastBounds: { left: toastRect.left, top: toastRect.top, right: toastRect.right, bottom: toastRect.bottom },
      worldViewportBounds: {
        left: worldViewportRect.left,
        top: worldViewportRect.top,
        right: worldViewportRect.right,
        bottom: worldViewportRect.bottom,
      },
      insideViewport: toastRect.left >= viewportRect.left
        && toastRect.top >= viewportRect.top
        && toastRect.right <= viewportRect.right
        && toastRect.bottom <= viewportRect.bottom,
      insideReservedBay: toastRect.top >= worldViewportRect.bottom - 1,
      overlappingElements,
    };
  });

  expect.soft(layout.insideViewport, `feedback should remain inside the browser viewport (${JSON.stringify(layout)})`).toBe(true);
  expect.soft(layout.insideReservedBay, `feedback should stay below the world viewport in the reserved bay (${JSON.stringify(layout)})`).toBe(true);
  expect.soft(layout.overlappingElements, `feedback should not cover cards or controls (${JSON.stringify(layout)})`).toEqual([]);
});

test('721x720 at 200% preserves a saved camera and autosave bytes through tablet-bridge layout', async ({ page }) => {
  const savedCamera = { panX: -321, panY: -222, scale: 0.9 };
  const savedState = createNewGameState();
  savedState.camera = savedCamera;
  const savedBytes = encodeSave(savedState);

  await page.setViewportSize({ width: 721, height: 720 });
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
  expect(storedBytes, 'the tablet-bridge layout should preserve the saved autosave bytes exactly').toBe(savedBytes);

  await page.setViewportSize({ width: 722, height: 720 });
  await page.setViewportSize({ width: 721, height: 720 });
  await expect.poll(() => scene.evaluate((element) => element.style.transform))
    .toBe('translate(-321px, -222px) scale(0.9)');
  const bytesAfterResize = await page.evaluate((saveKey) => window.localStorage.getItem(saveKey), autoSaveKey);
  expect(bytesAfterResize, 'resizing through the tablet-bridge layout should not rewrite autosave bytes').toBe(savedBytes);
});
