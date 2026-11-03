import { expect, test } from '@playwright/test';

test('the first calibration placement dismisses only the first-action lead', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');

  const hint = page.locator('.world-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toContainText(/Harmonic Calibration/i);
  await expect(hint).toContainText(/blueprints?/i);
  await expect(hint).toContainText(/Harmonic Calibration Folio/i);
  await expect(hint).toContainText(/Drag objects to a cabinet or workbench/i);
  const mouseGuidance = hint.locator('.world-hint__mouse-guidance');
  await expect(mouseGuidance).toBeVisible();
  await expect(mouseGuidance).toContainText(/drag empty space to pan/i);
  await expect(mouseGuidance).toContainText(/wheel to zoom/i);

  const firstCard = page.getByTestId('lab-item-calibration-card-01');
  await expect(firstCard).toBeVisible();
  await firstCard.click();
  await page.getByTestId('move-target').selectOption('cabinet-calibration');
  await page.getByTestId('move-item').click();
  await expect(page.getByTestId('item-inspector')).toContainText(/Correctly catalogued/i);

  await expect(hint).not.toContainText(/Harmonic Calibration/i);
  await expect(hint).toContainText(/Drag objects to a cabinet or workbench/i);
  await expect(mouseGuidance).toBeVisible();
  await expect(mouseGuidance).toContainText(/drag empty space to pan/i);
  await expect(mouseGuidance).toContainText(/wheel to zoom/i);
});
