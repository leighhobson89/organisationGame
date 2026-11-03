import { expect, test } from '@playwright/test';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { decodeSave, encodeSave } from '../../src/game/persistence/save.js';
import { WORLD_BOUNDS } from '../../src/game/content/catalog.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const sourceId = 'parallax-trials-01';
const canvasMatchId = 'parallax-trials-08';

function createLensState({ camera } = {}) {
  const state = createNewGameState();
  state.progress.ownedSkills = ['resonance-lens'];
  if (camera) state.camera = camera;
  return state;
}

async function seedGame(page, state) {
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: autoSaveKey,
    value: encodeSave(state),
  });
  await page.goto('/');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
}

function canvasRegionFor(item) {
  const width = item.width ?? 112;
  const height = item.height ?? 76;
  const rotation = item.placement?.kind === 'workspace' ? (item.rotation ?? 0) : 0;
  const angle = (rotation * Math.PI) / 180;
  const centerX = (item.position?.x ?? 0) + width / 2;
  const centerY = (item.position?.y ?? 0) + height / 2;
  const localX = width / 2 - 18;
  const localY = 18 - height / 2;
  const markerX = centerX + localX * Math.cos(angle) - localY * Math.sin(angle);
  const markerY = centerY + localX * Math.sin(angle) + localY * Math.cos(angle);
  return {
    x: Math.round((markerX - 12) * 0.5),
    y: Math.round((markerY - 12) * 0.5),
    width: 24,
    height: 24,
  };
}

async function readCanvasRegion(page, region) {
  return page.getByTestId('world-overview-canvas').evaluate((canvas, sample) => {
    const context = canvas.getContext('2d');
    return Array.from(context.getImageData(sample.x, sample.y, sample.width, sample.height).data);
  }, region);
}

test('the Resonance Lens paints Canvas-only matches and reports them without changing the save', async ({ page }) => {
  await page.setViewportSize({ width: 3000, height: 1800 });
  const scale = 0.4;
  const state = createLensState({
    camera: {
      scale,
      panX: 1500 - (WORLD_BOUNDS.x + WORLD_BOUNDS.width / 2) * scale,
      panY: 900 - (WORLD_BOUNDS.y + WORLD_BOUNDS.height / 2) * scale,
    },
  });
  const source = state.items.find((item) => item.id === sourceId);
  const canvasMatch = state.items.find((item) => item.id === canvasMatchId);
  canvasMatch.rotation = 35;
  expect(source?.collectionId).toBe(canvasMatch?.collectionId);

  await seedGame(page, state);
  const canvas = page.getByTestId('world-overview-canvas');
  await expect(canvas).toBeVisible();
  const canvasOnlyMatch = page.getByTestId(`lab-item-${canvasMatchId}`);
  await expect(canvasOnlyMatch).toHaveCount(0);
  const markerRegion = canvasRegionFor(canvasMatch);
  const pixelsBefore = await readCanvasRegion(page, markerRegion);

  const viewport = await page.getByTestId('world-viewport').boundingBox();
  expect(viewport).not.toBeNull();
  await page.mouse.click(
    viewport.x + state.camera.panX + (source.position.x + (source.width ?? 112) / 2) * scale,
    viewport.y + state.camera.panY + (source.position.y + (source.height ?? 76) / 2) * scale,
  );
  await expect(page.getByTestId(`lab-item-${sourceId}`)).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('toggle-skills').click();
  const autosaveBeforeActivation = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  const itemsBeforeActivation = decodeSave(autosaveBeforeActivation).items;

  await page.getByTestId('toggle-resonance-lens').click();
  await expect.soft(page.getByTestId('game-feedback')).toContainText(/7 items related to/i);
  await expect.soft(page.getByTestId('skill-announcer')).toHaveText('');
  await expect(page.getByTestId('canvas-only-highlight-titles')).toContainText('Two Witnesses, One Impression');
  await expect.poll(() => readCanvasRegion(page, markerRegion)).not.toEqual(pixelsBefore);
  expect(await page.locator('.world-scene .lab-object').count()).toBeLessThanOrEqual(64);

  const autosaveAfterActivation = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  expect(autosaveAfterActivation).toBe(autosaveBeforeActivation);
  expect(decodeSave(autosaveAfterActivation).items).toEqual(itemsBeforeActivation);
});

test('detail-mode Lens marks expose their source in the related card name', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const state = createLensState({ camera: { panX: 0, panY: 0, scale: 0.8 } });
  const source = state.items.find((item) => item.id === 'calibration-card-01');
  const match = state.items.find((item) => item.id === 'calibration-card-02');
  for (const [index, item] of state.items.entries()) {
    if (item.id === source.id || item.id === match.id) continue;
    item.position = { x: 4100 + (index % 5) * 80, y: 2860 + (index % 4) * 64 };
  }
  source.position = { x: 220, y: 180 };
  match.position = { x: 420, y: 180 };

  await seedGame(page, state);
  const sourceCard = page.getByTestId(`lab-item-${source.id}`);
  const matchCard = page.getByTestId(`lab-item-${match.id}`);
  await sourceCard.click();
  await page.getByTestId('toggle-skills').click();
  await page.getByTestId('toggle-resonance-lens').click();

  await expect(matchCard).toHaveClass(/is-related/);
  await expect(matchCard.locator('.lab-object-highlight-marker')).toBeVisible();
  await expect(matchCard).toHaveAccessibleName(/highlighted by the Resonance Lens/i);
  await expect(page.getByTestId('game-feedback')).toContainText(/7 items related to/i);
  await expect(page.getByTestId('skill-announcer')).toHaveText('');
});
