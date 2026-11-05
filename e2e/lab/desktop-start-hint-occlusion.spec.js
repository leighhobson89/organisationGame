import { expect, test } from '@playwright/test';

test('fresh desktop guidance stays visible without covering cards or controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');

  await expect(page.getByTestId('world-item-count')).toHaveText('174 objects');

  const hint = page.locator('.world-hint');
  await expect(hint).toBeVisible();

  const layout = await hint.evaluate((element) => {
    const hintRect = element.getBoundingClientRect();
    const cards = Array.from(document.querySelectorAll('.world-scene .destination-card, .world-scene .lab-object'));
    const controls = Array.from(document.querySelectorAll('.game-toolbar, .world-atlas-toggle'));
    const overlappingCards = cards
      .filter((card) => {
        if (card.getClientRects().length === 0) return false;
        const cardRect = card.getBoundingClientRect();
        return hintRect.left < cardRect.right
          && hintRect.right > cardRect.left
          && hintRect.top < cardRect.bottom
          && hintRect.bottom > cardRect.top;
      })
      .map((card) => ({
        label: card.getAttribute('aria-label') || card.textContent.trim(),
        bounds: (() => {
          const rect = card.getBoundingClientRect();
          return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
        })(),
      }));
    const overlappingControls = controls
      .filter((control) => {
        if (control.getClientRects().length === 0) return false;
        const controlRect = control.getBoundingClientRect();
        return hintRect.left < controlRect.right
          && hintRect.right > controlRect.left
          && hintRect.top < controlRect.bottom
          && hintRect.bottom > controlRect.top;
      })
      .map((control) => {
        const rect = control.getBoundingClientRect();
        return {
          label: control.getAttribute('aria-label') || control.textContent.trim(),
          className: typeof control.className === 'string' ? control.className : '',
          bounds: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
        };
      });

    return {
      hintBounds: { left: hintRect.left, top: hintRect.top, right: hintRect.right, bottom: hintRect.bottom },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      overlappingCards,
      overlappingControls,
    };
  });

  expect(layout.hintBounds.left, 'the full guidance panel should stay within the viewport').toBeGreaterThanOrEqual(0);
  expect(layout.hintBounds.top, 'the full guidance panel should stay within the viewport').toBeGreaterThanOrEqual(0);
  expect(layout.hintBounds.right, 'the full guidance panel should stay within the viewport').toBeLessThanOrEqual(layout.viewport.width);
  expect(layout.hintBounds.bottom, 'the full guidance panel should stay within the viewport').toBeLessThanOrEqual(layout.viewport.height);
  expect(layout.overlappingCards, `the guidance panel should leave visible world cards unobscured: ${JSON.stringify(layout)}`).toEqual([]);
  expect(layout.overlappingControls, `the guidance panel should not cover toolbar or Atlas controls: ${JSON.stringify(layout)}`).toEqual([]);
});
