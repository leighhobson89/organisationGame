import { expect, test } from '@playwright/test';

function splitCssLayers(value) {
  const layers = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '(') depth += 1;
    if (value[index] === ')') depth -= 1;
    if (value[index] === ',' && depth === 0) {
      layers.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }

  if (value.slice(start).trim()) layers.push(value.slice(start).trim());
  return layers;
}

function numericStackLevel(zIndex) {
  return zIndex === 'auto' ? 0 : Number.parseInt(zIndex, 10);
}

test('the world ground decorates the world without intercepting or changing its contents', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  await expect(page.getByTestId('world-item-count')).toHaveText('174 objects');

  const scene = page.locator('.world-scene');
  const ground = scene.locator(':scope > .world-ground');
  const canvas = scene.locator(':scope > .world-overview-canvas');
  const card = scene.locator('.destination-card').first();
  const item = scene.locator('.lab-object').first();

  await expect(ground, 'the scene should contain one decorative ground layer').toHaveCount(1);
  await expect(ground, 'the ground is decorative content for assistive technology').toHaveAttribute('aria-hidden', 'true');

  const initialStyles = await ground.evaluate((element) => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    const scene = element.parentElement;
    return {
      pointerEvents: style.pointerEvents,
      backgroundImage: style.backgroundImage,
      width: element.offsetWidth,
      height: element.offsetHeight,
      bounds: { x: bounds.x, width: bounds.width },
      sceneTransform: getComputedStyle(scene).transform,
      groundZIndex: style.zIndex,
      canvasZIndex: getComputedStyle(scene.querySelector('.world-overview-canvas')).zIndex,
      cardZIndex: getComputedStyle(scene.querySelector('.destination-card')).zIndex,
      itemZIndex: getComputedStyle(scene.querySelector('.lab-object')).zIndex,
      cardPointerEvents: getComputedStyle(scene.querySelector('.destination-card')).pointerEvents,
      itemPointerEvents: getComputedStyle(scene.querySelector('.lab-object')).pointerEvents,
    };
  });

  expect(initialStyles.width, 'the ground should span the world width').toBeGreaterThan(5000);
  expect(initialStyles.height, 'the ground should span the world height').toBeGreaterThan(3000);
  expect(initialStyles.pointerEvents, 'the ground must not intercept world interactions').toBe('none');

  const backgroundLayers = splitCssLayers(initialStyles.backgroundImage);
  const panelSeams = backgroundLayers.find((layer) => /^repeating-linear-gradient\(/i.test(layer));
  expect(panelSeams, 'the computed ground should include repeating linear panel seams').toBeDefined();
  const seamStops = [...panelSeams.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((match) => Number(match[1]));
  expect(
    Math.max(...seamStops) - Math.min(...seamStops),
    'the repeating seam pattern should span broad panels rather than a fine grid',
  ).toBeGreaterThanOrEqual(120);

  const surveyRings = backgroundLayers.filter((layer) => /(?:repeating-)?radial-gradient\(/i.test(layer));
  expect(surveyRings, 'the computed ground should include radial survey rings').not.toHaveLength(0);

  const groundStackLevel = numericStackLevel(initialStyles.groundZIndex);
  for (const [layerName, zIndex] of [
    ['overview canvas', initialStyles.canvasZIndex],
    ['destination card', initialStyles.cardZIndex],
    ['interactive item card', initialStyles.itemZIndex],
  ]) {
    expect(groundStackLevel, `the ground should paint behind the ${layerName}`).toBeLessThan(numericStackLevel(zIndex));
  }
  expect(initialStyles.cardPointerEvents, 'the destination card should remain interactive').not.toBe('none');
  expect(initialStyles.itemPointerEvents, 'the item card should remain interactive').not.toBe('none');

  const viewport = page.getByTestId('world-viewport');
  await viewport.press('ArrowRight');
  await expect.poll(() => ground.evaluate((element) => element.getBoundingClientRect().x)).toBeLessThan(initialStyles.bounds.x);
  await expect.poll(() => scene.evaluate((element) => getComputedStyle(element).transform)).not.toBe(initialStyles.sceneTransform);

  const pannedWidth = await ground.evaluate((element) => element.getBoundingClientRect().width);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(() => ground.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(pannedWidth);
  await expect(page.getByTestId('world-item-count')).toHaveText('174 objects');
});
