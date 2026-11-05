import { expect, test } from '@playwright/test';

const preferencesKey = 'palimpsest-laboratory.preferences.v1';

for (const textScale of [1.125, 1.25, 1.5, 1.75, 2]) {
  test(`fresh desktop guidance stays clear of cards and controls at ${textScale * 100}% text`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(({ key, scale }) => {
      window.localStorage.clear();
      window.localStorage.setItem(key, JSON.stringify({
        version: 1,
        textScale: scale,
        reduceMotion: false,
        soundEffectsEnabled: false,
      }));
    }, { key: preferencesKey, scale: textScale });
    await page.goto('/');

    await expect(page.getByTestId('world-item-count')).toHaveText('174 objects');

    const hint = page.locator('.world-hint');
    await expect(hint).toBeVisible();

    const layout = await hint.evaluate((element) => {
      const hintRect = element.getBoundingClientRect();
      const visibleInViewport = hintRect.left >= 0
        && hintRect.top >= 0
        && hintRect.right <= window.innerWidth
        && hintRect.bottom <= window.innerHeight;
      const targets = [
        ...Array.from(document.querySelectorAll('.world-scene .destination-card, .world-scene .lab-object'))
          .map((target) => ({ target, kind: 'world card' })),
        ...Array.from(document.querySelectorAll('.game-toolbar, .world-atlas-toggle'))
          .map((target) => ({ target, kind: 'world control' })),
      ];
      const overlappingElements = targets
        .filter(({ target }) => {
          if (target.getClientRects().length === 0) return false;
          const rect = target.getBoundingClientRect();
          return hintRect.left < rect.right
            && hintRect.right > rect.left
            && hintRect.top < rect.bottom
            && hintRect.bottom > rect.top;
        })
        .map(({ target, kind }) => {
          const rect = target.getBoundingClientRect();
          return {
            kind,
            label: target.getAttribute('aria-label') || target.textContent.trim(),
            className: typeof target.className === 'string' ? target.className : '',
            bounds: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
          };
        });

      return {
        visibleInViewport,
        hintBounds: { left: hintRect.left, top: hintRect.top, right: hintRect.right, bottom: hintRect.bottom },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        overlappingElements,
      };
    });

    expect(layout.overlappingElements, `the guidance should leave cards and controls unobscured at ${textScale * 100}%: ${JSON.stringify(layout)}`).toEqual([]);
    expect(layout.visibleInViewport, `the full guidance panel should stay within the viewport at ${textScale * 100}%: ${JSON.stringify(layout)}`).toBe(true);
  });
}
