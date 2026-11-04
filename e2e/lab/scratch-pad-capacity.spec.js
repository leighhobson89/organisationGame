import { expect, test } from '@playwright/test';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { decodeSave, encodeSave } from '../../src/game/persistence/save.js';
import { DESTINATIONS, getScratchPadsForOwnedSkills, SCRATCH_PADS } from '../../src/game/content/catalog.js';
import { getTargetSlotPosition } from '../../src/game/world/placementLayout.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const backupKey = 'palimpsest-laboratory.backup.v1';
const fixtureMarker = 'palimpsest-lab.scratch-capacity-fixture-seeded';
const scratchPad = SCRATCH_PADS.find((entry) => entry.id === 'scratch-a');
const addedItemId = 'calibration-card-01';

function createFullScratchPadState({ skillPoints = 0 } = {}) {
  const state = createNewGameState();
  state.progress.skillPoints = skillPoints;

  const candidates = state.items.filter((item) => item.id !== addedItemId
    && item.width <= scratchPad.layout.cellWidth
    && item.height <= scratchPad.layout.cellHeight).slice(0, scratchPad.capacity);
  if (candidates.length !== scratchPad.capacity) throw new Error('Unable to fill the fixture scratch pad.');

  for (const [slotIndex, item] of candidates.entries()) {
    const workspacePosition = { ...item.position };
    item.position = getTargetSlotPosition({
      target: { kind: 'scratchpad', id: scratchPad.id },
      item,
      slotIndex,
      destinations: DESTINATIONS,
      scratchPads: SCRATCH_PADS,
    });
    item.previousWorkspacePosition = workspacePosition;
    item.placement = { kind: 'scratchpad', scratchPadId: scratchPad.id, slotIndex };
    item.rotation = 0;
    item.validation = 'unchecked';
  }

  const item = state.items.find((entry) => entry.id === addedItemId);
  item.position = { x: scratchPad.position.x - item.width - 8, y: scratchPad.position.y + 112 };
  item.previousWorkspacePosition = { ...item.position };
  item.placement = { kind: 'workspace' };
  item.rotation = 0;
  item.validation = 'unchecked';
  return state;
}

async function openScratchPad(page) {
  await page.getByTestId('world-jump').selectOption(`scratchpad:${scratchPad.id}`);
  return page.getByTestId(`scratch-${scratchPad.id}`);
}

async function moveAddedItemToScratchPad(page) {
  await page.getByTestId(`lab-item-${addedItemId}`).click();
  await page.getByRole('combobox', { name: /move to destination or work surface/i })
    .selectOption(scratchPad.id);
  await page.getByRole('button', { name: 'Move item', exact: true }).click();
}

async function loadFixture(page, state) {
  await page.addInitScript(({ key, raw, marker }) => {
    if (window.sessionStorage.getItem(marker) === 'seeded') return;
    window.sessionStorage.setItem(marker, 'seeded');
    window.localStorage.setItem(key, raw);
  }, {
    key: autoSaveKey,
    raw: encodeSave(state),
    marker: fixtureMarker,
  });
  await page.goto('/');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
}

test('scratch pad jump keeps the full pad inside a compact viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');

  const viewport = page.getByTestId('world-viewport');
  await expect(viewport).toBeVisible();
  const pad = await openScratchPad(page);
  await expect(pad).toBeVisible();

  const viewportBox = await viewport.boundingBox();
  const padBox = await pad.boundingBox();
  expect(viewportBox, 'the world viewport should have measurable bounds').not.toBeNull();
  expect(padBox, 'the scratch pad should have measurable bounds').not.toBeNull();
  expect(padBox.x).toBeGreaterThanOrEqual(viewportBox.x - 1);
  expect(padBox.y).toBeGreaterThanOrEqual(viewportBox.y - 1);
  expect(padBox.x + padBox.width).toBeLessThanOrEqual(viewportBox.x + viewportBox.width + 1);
  expect(padBox.y + padBox.height).toBeLessThanOrEqual(viewportBox.y + viewportBox.height + 1);
});

test('Modular Worktables expands both scratch pads and preserves a new slot through reload', async ({ page }) => {
  const state = createFullScratchPadState({ skillPoints: 1 });
  await loadFixture(page, state);

  const pad = await openScratchPad(page);
  await expect(pad).toHaveAttribute('aria-label', /24 of 24 spaces used/i);
  await expect(pad).toContainText(/24\s*\/\s*24 spaces/i);

  await page.getByTestId('toggle-skills').click();
  await expect(page.getByTestId('skill-modular-worktables')).toBeVisible();
  await page.getByTestId('purchase-modular-worktables').click();
  await expect(page.getByText(/six more spaces available on each table/i)).toBeVisible();
  await expect(page.getByTestId('skill-modular-worktables')).toContainText(/owned|installed|expanded/i);
  await expect(page.getByTestId('toggle-modular-worktables')).toHaveCount(0,
    'a permanent capacity upgrade should not appear as an activatable tool');

  await expect(pad).toHaveAttribute('aria-label', /24 of 30 spaces used/i);
  await expect(pad).toContainText(/24\s*\/\s*30 spaces/i);
  await moveAddedItemToScratchPad(page);
  await expect(pad).toHaveAttribute('aria-label', /25 of 30 spaces used/i);
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');

  const saved = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(saved.progress.ownedSkills).toContain('modular-worktables');
  expect(saved.items.find((item) => item.id === addedItemId).placement).toMatchObject({
    kind: 'scratchpad',
    scratchPadId: scratchPad.id,
    slotIndex: 24,
  });

  await page.reload();
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
  await expect(page.getByTestId('recovery-notice')).toHaveCount(0);
  const reloaded = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(reloaded.progress.ownedSkills).toContain('modular-worktables');
  expect(reloaded.items.find((item) => item.id === addedItemId).placement).toMatchObject({
    kind: 'scratchpad',
    scratchPadId: scratchPad.id,
    slotIndex: 24,
  });
  const restoredPad = await openScratchPad(page);
  await expect(restoredPad).toHaveAttribute('aria-label', /25 of 30 spaces used/i);
  await expect(restoredPad).toContainText(/25\s*\/\s*30 spaces/i);
  await expect(page.getByTestId(`lab-item-${addedItemId}`)).toBeVisible();
  const restored = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(restored.items.find((item) => item.id === addedItemId).placement).toMatchObject({
    kind: 'scratchpad',
    scratchPadId: scratchPad.id,
    slotIndex: 24,
  });
  await page.getByTestId('toggle-skills').click();
  await expect(page.getByTestId('skill-modular-worktables')).toContainText(/owned|installed|expanded/i);
});

test('a full unupgraded scratch pad retains its 24-slot limit', async ({ page }) => {
  await loadFixture(page, createFullScratchPadState());
  const pad = await openScratchPad(page);
  await expect(pad).toHaveAttribute('aria-label', /24 of 24 spaces used/i);
  await expect(pad).toContainText(/24\s*\/\s*24 spaces/i);

  await moveAddedItemToScratchPad(page);
  await expect(page.getByTestId('game-feedback')).toContainText(/target is full|move an object out/i);
  await expect(pad).toHaveAttribute('aria-label', /24 of 24 spaces used/i);

  const saved = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect(saved.progress.ownedSkills).not.toContain('modular-worktables');
  expect(saved.items.find((item) => item.id === addedItemId).placement.kind).toBe('workspace');
});

test('importing slot 24 without Modular Worktables preserves the live 24-slot save and backup', async ({ page }) => {
  await loadFixture(page, createFullScratchPadState());
  const pad = await openScratchPad(page);
  await expect(pad).toHaveAttribute('aria-label', /24 of 24 spaces used/i);
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');

  const beforeAutosave = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  expect(beforeAutosave).not.toBeNull();
  const backupState = decodeSave(beforeAutosave);
  backupState.progress.skillPoints += 1;
  const beforeBackup = encodeSave(backupState);
  await page.evaluate(({ key, value }) => window.localStorage.setItem(key, value), {
    key: backupKey,
    value: beforeBackup,
  });
  expect(beforeBackup).not.toBe(beforeAutosave);

  await page.getByTestId('open-saves').click();
  const beforeExport = await page.getByTestId('save-export-string').inputValue();
  const invalidState = decodeSave(beforeExport);
  const invalidItem = invalidState.items.find((item) => item.id === addedItemId);
  const expandedPads = getScratchPadsForOwnedSkills(['modular-worktables']);
  invalidItem.position = getTargetSlotPosition({
    target: { kind: 'scratchpad', id: scratchPad.id },
    item: invalidItem,
    slotIndex: 24,
    destinations: DESTINATIONS,
    scratchPads: expandedPads,
  });
  invalidItem.placement = { kind: 'scratchpad', scratchPadId: scratchPad.id, slotIndex: 24 };
  invalidItem.rotation = 0;
  invalidItem.validation = 'unchecked';
  const invalidImport = encodeSave(invalidState);

  await page.getByTestId('save-import-string').fill(invalidImport);
  await page.getByRole('checkbox', { name: /valid import replaces the current laboratory/i }).check();
  await page.getByRole('button', { name: 'Validate & import save' }).click();
  await expect(page.getByTestId('save-feedback')).toContainText(/slot|capacity|scratch|invalid/i);
  await expect(page.getByTestId('save-export-string')).toHaveValue(beforeExport);

  const afterAutosave = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  const afterBackup = await page.evaluate((key) => window.localStorage.getItem(key), backupKey);
  expect(afterAutosave).toBe(beforeAutosave);
  expect(afterBackup).toBe(beforeBackup);

  await page.getByRole('button', { name: 'Close save dialog' }).click();
  await expect(pad).toHaveAttribute('aria-label', /24 of 24 spaces used/i);
  await expect(page.getByTestId('world-item-count')).toContainText('174');
  const liveState = decodeSave(afterAutosave);
  expect(liveState.progress.ownedSkills).not.toContain('modular-worktables');
  expect(liveState.items.find((item) => item.id === addedItemId).placement.kind).toBe('workspace');
});
