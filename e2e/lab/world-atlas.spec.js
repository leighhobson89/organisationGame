import { expect, test } from '@playwright/test';
import { createBenchmarkItems } from '../../performance/fixtures.js';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { decodeSave, encodeSave } from '../../src/game/persistence/save.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const fixtureMarker = 'palimpsest-lab.world-atlas-fixture-seeded';
const initialCamera = { panX: -300, panY: -180, scale: 0.5 };

function createAtlasFixture({ itemCount = 174, camera = initialCamera } = {}) {
  const state = createNewGameState();
  state.items = createBenchmarkItems(itemCount);
  state.camera = { ...camera };
  return { encodedSave: encodeSave(state), items: state.items, camera: { ...camera } };
}

async function loadAtlasFixture(page, options = {}) {
  const fixture = createAtlasFixture(options);
  await page.addInitScript(({ key, value, marker }) => {
    if (window.sessionStorage.getItem(marker) === 'seeded') return;
    window.sessionStorage.setItem(marker, 'seeded');
    window.localStorage.clear();
    window.localStorage.setItem(key, value);
  }, { key: autoSaveKey, value: fixture.encodedSave, marker: fixtureMarker });
  await page.goto('/');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });
  return fixture;
}

async function readSceneCamera(page) {
  return page.locator('.world-scene').evaluate((scene) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(scene).transform);
    return { panX: matrix.e, panY: matrix.f, scale: matrix.a };
  });
}

function expectCameraClose(actual, expected) {
  expect(Math.abs(actual.panX - expected.panX), 'camera panX should match within save-codec precision').toBeLessThanOrEqual(0.01);
  expect(Math.abs(actual.panY - expected.panY), 'camera panY should match within save-codec precision').toBeLessThanOrEqual(0.01);
  expect(Math.abs(actual.scale - expected.scale), 'camera scale should match within save-codec precision').toBeLessThanOrEqual(0.0001);
}

async function openAtlas(page) {
  const toggle = page.getByTestId('world-atlas-toggle');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  const panel = page.getByTestId('world-atlas-panel');
  await expect(panel).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  return { toggle, panel };
}

async function findEmptyPoint(page, container, excludedSelector) {
  const point = await container.evaluate((element, selector) => {
    const bounds = element.getBoundingClientRect();
    for (let y = bounds.top + 24; y < bounds.bottom - 24; y += 18) {
      for (let x = bounds.left + 24; x < bounds.right - 24; x += 18) {
        const hit = document.elementFromPoint(x, y);
        if (!hit || !element.contains(hit) || hit.closest(selector)) continue;
        return { x, y };
      }
    }
    return null;
  }, excludedSelector);
  expect(point, 'the map surface should expose a draggable area without a landmark').not.toBeNull();
  return point;
}

async function dragPointer(page, start, end) {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 5 });
  await page.mouse.up();
}

async function expectInsideViewport(element, viewportWidth, viewportHeight, message) {
  const box = await element.boundingBox();
  expect(box, `${message} should have rendered bounds`).not.toBeNull();
  expect(box.x, `${message} should not extend beyond the left edge`).toBeGreaterThanOrEqual(0);
  expect(box.y, `${message} should not extend beyond the top edge`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${message} should not extend beyond the right edge`).toBeLessThanOrEqual(viewportWidth);
  expect(box.y + box.height, `${message} should not extend beyond the bottom edge`).toBeLessThanOrEqual(viewportHeight);
}

async function readOutlineSignature(page) {
  const outline = page.getByTestId('world-atlas-viewport-outline');
  await expect(outline).toBeVisible();
  return {
    bounds: await outline.boundingBox(),
    points: await outline.getAttribute('points'),
    path: await outline.getAttribute('d'),
  };
}

test('World atlas opens collapsed, shows landmarks and bounded density, and outlines the current viewport', async ({ page }) => {
  const fixture = await loadAtlasFixture(page);
  const toggle = page.getByTestId('world-atlas-toggle');

  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('world-atlas-panel')).toHaveCount(0);

  const { panel } = await openAtlas(page);
  const calibrationLandmark = page.getByTestId('world-atlas-landmark-cabinet-calibration');
  const density = page.getByTestId('world-atlas-density');
  const outline = page.getByTestId('world-atlas-viewport-outline');
  await expect(calibrationLandmark).toBeVisible();
  await expect(calibrationLandmark).toHaveAccessibleName(/Harmonic Calibration Folio/i);
  await expect(density).toBeVisible();
  await expect(density).toHaveAttribute('data-item-count', String(fixture.items.length));
  await expect(outline).toBeVisible();
  const outlineBox = await outline.boundingBox();
  const panelBox = await panel.boundingBox();
  expect(outlineBox?.width).toBeGreaterThan(0);
  expect(outlineBox?.height).toBeGreaterThan(0);
  expect(panelBox).not.toBeNull();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(panel).toHaveCount(0);
});

test('World atlas landmark click and map drag recenter the camera without changing zoom', async ({ page }) => {
  await loadAtlasFixture(page);
  const { panel } = await openAtlas(page);
  const beforeClick = await readSceneCamera(page);

  await page.getByTestId('world-atlas-landmark-cabinet-calibration').click();
  await expect.poll(() => readSceneCamera(page)).not.toEqual(beforeClick);
  const afterClick = await readSceneCamera(page);
  expect(afterClick.scale).toBeCloseTo(beforeClick.scale, 5);
  expect(Math.abs(afterClick.panX - beforeClick.panX) + Math.abs(afterClick.panY - beforeClick.panY))
    .toBeGreaterThan(1);

  const start = await findEmptyPoint(page, panel,
    'button, a, input, select, [data-testid^="world-atlas-landmark-"]');
  const beforeDrag = await readSceneCamera(page);
  await dragPointer(page, start, { x: start.x + 36, y: start.y + 24 });
  await expect.poll(async () => (await readSceneCamera(page)).panX).not.toBe(beforeDrag.panX);
  const afterDrag = await readSceneCamera(page);
  expect(afterDrag.scale).toBeCloseTo(beforeDrag.scale, 5);
});

test('World atlas viewport outline updates after world pan and wheel zoom', async ({ page }) => {
  await loadAtlasFixture(page);
  await openAtlas(page);
  const viewport = page.getByTestId('world-viewport');
  const outline = page.getByTestId('world-atlas-viewport-outline');
  const beforePanOutline = await readOutlineSignature(page);
  const panStart = await findEmptyPoint(page, viewport,
    '.game-toolbar, [data-item-id], [data-drop-id], [data-testid="item-inspector"], [data-testid="world-atlas-panel"]');
  const cameraBeforePan = await readSceneCamera(page);
  await dragPointer(page, panStart, { x: panStart.x + 58, y: panStart.y + 35 });
  await expect.poll(async () => (await readSceneCamera(page)).panX).not.toBe(cameraBeforePan.panX);
  await expect.poll(async () => JSON.stringify(await readOutlineSignature(page))).not.toBe(JSON.stringify(beforePanOutline));

  const beforeWheelOutline = await readOutlineSignature(page);
  const cameraBeforeWheel = await readSceneCamera(page);
  const viewportBox = await viewport.boundingBox();
  expect(viewportBox).not.toBeNull();
  await page.mouse.move(viewportBox.x + viewportBox.width / 2, viewportBox.y + viewportBox.height / 2);
  await page.mouse.wheel(0, -120);
  await expect.poll(async () => (await readSceneCamera(page)).scale).not.toBe(cameraBeforeWheel.scale);
  await expect.poll(async () => JSON.stringify(await readOutlineSignature(page))).not.toBe(JSON.stringify(beforeWheelOutline));
  await expect(outline).toBeVisible();
});

test('World atlas pointer gestures do not move or file underlying laboratory items', async ({ page }) => {
  const fixture = await loadAtlasFixture(page);
  const { panel } = await openAtlas(page);
  const itemId = 'calibration-card-01';
  const before = fixture.items.find((item) => item.id === itemId);
  const start = await findEmptyPoint(page, panel,
    'button, a, input, select, [data-testid^="world-atlas-landmark-"]');
  await dragPointer(page, start, { x: start.x + 44, y: start.y + 30 });
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');

  const saved = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  const after = saved.items.find((item) => item.id === itemId);
  expect(after.position).toEqual(before.position);
  expect(after.placement).toEqual(before.placement);
  expect(after.validation).toBe(before.validation);
});

test('World atlas supports arrow and Enter navigation, Escape close, focus return, and a live status', async ({ page }) => {
  await loadAtlasFixture(page);
  const { toggle } = await openAtlas(page);
  const landmark = page.getByTestId('world-atlas-landmark-cabinet-calibration');
  const announcer = page.getByTestId('world-atlas-announcer');
  await landmark.focus();
  const cameraBefore = await readSceneCamera(page);

  await page.keyboard.press('ArrowRight');
  await expect(announcer).not.toHaveText('');
  const focusedLandmarkId = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  expect(focusedLandmarkId).toMatch(/^world-atlas-landmark-/);

  await page.keyboard.press('Enter');
  await expect.poll(async () => (await readSceneCamera(page)).panX).not.toBe(cameraBefore.panX);
  await expect(announcer).not.toHaveText('');
  await page.keyboard.press('Escape');

  await expect(page.getByTestId('world-atlas-panel')).toHaveCount(0);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid')))
    .toBe('world-atlas-toggle');
});

test('World atlas leaves existing world-jump and item-Finder routes available', async ({ page }) => {
  const fixture = await loadAtlasFixture(page);
  const { toggle } = await openAtlas(page);
  await toggle.click();

  const jump = page.getByTestId('world-jump');
  await jump.selectOption('destination:cabinet-calibration');
  await expect.poll(async () => (await readSceneCamera(page)).scale).toBeCloseTo(0.76, 2);

  await page.getByRole('button', { name: 'Find an item' }).click();
  const search = page.getByRole('searchbox', { name: 'Search laboratory items' });
  const item = fixture.items.find((entry) => entry.id === 'calibration-card-01');
  await search.fill(item.title);
  await page.getByTestId(`item-finder-result-${item.id}`).click();
  await expect(page.getByTestId('item-inspector')).toContainText(item.title);
  await expect(page.getByTestId(`lab-item-${item.id}`)).toHaveAttribute('aria-pressed', 'true');
  expect((await readSceneCamera(page)).scale).toBeGreaterThanOrEqual(0.72);
});

test('World atlas and item Finder are mutually exclusive at 390px width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 480 });
  await loadAtlasFixture(page);
  const atlasToggle = page.getByTestId('world-atlas-toggle');
  const atlasPanel = page.getByTestId('world-atlas-panel');
  const finderButton = page.getByRole('button', { name: 'Find an item' });
  const searchbox = page.getByRole('searchbox', { name: 'Search laboratory items' });

  await finderButton.click();
  await expect(searchbox).toBeVisible();
  await expect(atlasToggle).toHaveAttribute('aria-expanded', 'false');

  await atlasToggle.click();
  await expect(atlasPanel).toBeVisible();
  await expect(atlasToggle).toHaveAttribute('aria-expanded', 'true');
  await expect.soft(searchbox, 'opening Atlas should close the Finder').toHaveCount(0);

  // If the first direction is broken, close Finder explicitly so the second
  // direction still starts with only Atlas open and gets its own assertion.
  if (await searchbox.count()) {
    await page.getByRole('button', { name: 'Close item finder' }).evaluate((button) => button.click());
  }
  await expect(searchbox).toHaveCount(0);
  await expect(atlasPanel).toBeVisible();

  await finderButton.click();
  await expect.soft(atlasPanel, 'opening Finder should close Atlas').toHaveCount(0);
  await expect.soft(atlasToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(searchbox).toBeVisible();
  await expect(searchbox).toBeEnabled();
  await searchbox.fill('Harmonic Calibration 01');
  await expect(searchbox).toHaveValue('Harmonic Calibration 01');
});

test('World atlas geometry fits and collapses at 390px and 320px widths', async ({ page }) => {
  for (const [index, width] of [390, 320].entries()) {
    await page.setViewportSize({ width, height: 480 });
    if (index === 0) {
      await loadAtlasFixture(page);
    } else {
      await page.reload();
      await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });
    }
    const { toggle, panel } = await openAtlas(page);
    await expectInsideViewport(toggle, width, 480, `atlas toggle at ${width}px`);
    await expectInsideViewport(panel, width, 480, `atlas panel at ${width}px`);
    await expect(page.locator('.game-toolbar')).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toHaveCount(0);
    await expect(page.getByTestId('world-viewport')).toBeVisible();
  }
});

test('World atlas respects reduced motion preferences', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await loadAtlasFixture(page);
  const { panel } = await openAtlas(page);
  const landmark = page.getByTestId('world-atlas-landmark-cabinet-calibration');
  const motionDurations = await Promise.all([panel, landmark].map((locator) => locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const milliseconds = (value) => Math.max(0, ...value.split(',').map((part) => {
      const amount = Number.parseFloat(part);
      if (!Number.isFinite(amount)) return 0;
      return part.trim().endsWith('ms') ? amount : amount * 1000;
    }));
    return Math.max(milliseconds(style.animationDuration), milliseconds(style.transitionDuration));
  })));

  expect(Math.max(...motionDurations), 'atlas movement and highlighting should be static for reduced-motion users')
    .toBeLessThanOrEqual(1);
});

test('World atlas camera changes autosave and reload without adding map fields to the save schema', async ({ page }) => {
  const fixture = await loadAtlasFixture(page);
  const { toggle } = await openAtlas(page);
  await page.getByTestId('world-atlas-landmark-cabinet-calibration').click();

  const cameraAfterClick = await readSceneCamera(page);
  await expect.poll(async () => {
    const rawSave = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
    const persistedCamera = decodeSave(rawSave)?.camera;
    if (!persistedCamera) return { panX: false, panY: false, scale: false };
    return {
      panX: Math.abs(persistedCamera.panX - cameraAfterClick.panX) <= 0.01,
      panY: Math.abs(persistedCamera.panY - cameraAfterClick.panY) <= 0.01,
      scale: Math.abs(persistedCamera.scale - cameraAfterClick.scale) <= 0.0001,
    };
  }).toEqual({ panX: true, panY: true, scale: true });
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');

  const rawSave = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  const saved = decodeSave(rawSave);
  expectCameraClose(saved.camera, cameraAfterClick);
  expect(saved.camera).toEqual(expect.objectContaining({ panX: expect.any(Number), panY: expect.any(Number), scale: expect.any(Number) }));
  expect(Object.keys(saved.camera).sort()).toEqual(['panX', 'panY', 'scale']);
  for (const key of Object.keys(saved)) {
    expect(key.toLowerCase()).not.toMatch(/atlas|map/);
  }

  await page.reload();
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
  const cameraAfterReload = await readSceneCamera(page);
  expectCameraClose(cameraAfterReload, saved.camera);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(fixture.camera).not.toEqual(saved.camera);
});

test('World atlas aggregates 5,024 items into bounded density instead of per-item DOM nodes', async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = await loadAtlasFixture(page, { itemCount: 5024 });
  await expect(page.getByTestId('world-item-count')).toHaveText('5024 objects', { timeout: 30_000 });
  const { panel } = await openAtlas(page);
  const density = page.getByTestId('world-atlas-density');
  await expect(density).toBeVisible();
  await expect(density).toHaveAttribute('data-item-count', '5024');

  const binCount = Number(await density.getAttribute('data-bin-count'));
  expect(binCount, 'density bin count should be fixed and bounded independently of item count')
    .toBeGreaterThan(0);
  expect(binCount).toBeLessThanOrEqual(512);
  await expect(page.locator('[data-testid^="world-atlas-item-"]')).toHaveCount(0);
  const panelNodeCount = await panel.locator('*').count();
  expect(panelNodeCount, 'the atlas DOM should remain bounded instead of mounting one node per item')
    .toBeLessThanOrEqual(512);
  expect(fixture.items).toHaveLength(5024);
});
