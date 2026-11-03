import { expect, test } from '@playwright/test';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { decodeSave, encodeSave } from '../../src/game/persistence/save.js';
import { PREFERENCES_STORAGE_KEY } from '../../src/game/preferences/preferences.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const backupKey = 'palimpsest-laboratory.backup.v1';
const slotOneKey = 'palimpsest-laboratory.manual.v1';
const slotTwoKey = 'palimpsest-laboratory.manual.slot-2.v1';

async function waitForAutosave(page) {
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
}

async function openSaveDialog(page) {
  await page.getByTestId('open-saves').click();
  await expect(page.getByRole('dialog', { name: /save & restore/i })).toBeVisible();
}

test('a manual slot survives reload and restores with a pre-restore backup', async ({ page }) => {
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: PREFERENCES_STORAGE_KEY,
    value: JSON.stringify({ version: 1, textScale: 1.125, reduceMotion: true }),
  });
  await page.goto('/');
  await waitForAutosave(page);

  await openSaveDialog(page);
  const firstSlot = page.getByRole('region', { name: 'Slot 1' });
  await firstSlot.getByRole('button', { name: 'Save to Slot 1', exact: true }).click();
  await expect(firstSlot).toContainText(/saved/i);
  await expect(firstSlot.getByRole('button', { name: 'Confirm save to Slot 1', exact: true })).toHaveCount(0);

  const slotSnapshotRaw = await page.evaluate((key) => window.localStorage.getItem(key), slotOneKey);
  const slotSnapshot = JSON.parse(slotSnapshotRaw);
  expect(slotSnapshot.version).toBe(1);
  expect(slotSnapshot.slotId).toBe(1);
  expect(typeof slotSnapshot.savedAt).toBe('string');
  const initialSkillPoints = decodeSave(slotSnapshot.encodedSave).progress.skillPoints;

  const changedState = decodeSave(await page.getByTestId('save-export-string').inputValue());
  changedState.progress.skillPoints = initialSkillPoints + 7;
  const changedSave = encodeSave(changedState);
  const autosaveBeforeImport = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  await page.getByTestId('save-import-string').fill(changedSave);
  await page.getByRole('checkbox', { name: /valid import replaces the current laboratory/i }).check();
  await page.getByRole('button', { name: 'Validate & import save', exact: true }).click();
  await expect(page.getByTestId('skill-points')).toContainText(`Skill points: ${initialSkillPoints + 7}`);
  await waitForAutosave(page);

  const importBackup = await page.evaluate((key) => window.localStorage.getItem(key), backupKey);
  expect(decodeSave(importBackup).progress.skillPoints).toBe(initialSkillPoints);
  expect(importBackup).toBe(autosaveBeforeImport);

  await page.reload();
  await expect(page.getByTestId('skill-points')).toContainText(`Skill points: ${initialSkillPoints + 7}`);
  await waitForAutosave(page);
  await openSaveDialog(page);
  const restoredSlot = page.getByRole('region', { name: 'Slot 1' });
  const restoreSlotOne = restoredSlot.getByRole('button', { name: 'Restore Slot 1', exact: true });
  await restoreSlotOne.click();
  await restoredSlot.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(restoreSlotOne).toBeFocused();
  await expect(page.getByTestId('skill-points')).toContainText(`Skill points: ${initialSkillPoints + 7}`);

  const beforeRestoreBackup = await page.evaluate((key) => window.localStorage.getItem(key), backupKey);
  const savedSlotBeforeRestore = await page.evaluate((key) => window.localStorage.getItem(key), slotOneKey);
  await restoreSlotOne.click();
  await restoredSlot.getByRole('button', { name: 'Confirm restore to Slot 1', exact: true }).click();
  await expect(restoreSlotOne).toBeFocused();
  await expect(page.getByTestId('skill-points')).toContainText(`Skill points: ${initialSkillPoints}`);
  await waitForAutosave(page);

  const restoredBackup = await page.evaluate((key) => window.localStorage.getItem(key), backupKey);
  expect(decodeSave(restoredBackup).progress.skillPoints).toBe(initialSkillPoints + 7);
  expect(restoredBackup).not.toBe(beforeRestoreBackup);
  expect(await page.evaluate((key) => window.localStorage.getItem(key), slotOneKey)).toBe(savedSlotBeforeRestore);
  expect(JSON.parse(await page.evaluate((key) => window.localStorage.getItem(key), PREFERENCES_STORAGE_KEY)))
    .toEqual({ version: 1, textScale: 1.125, reduceMotion: true });

  await page.reload();
  await expect(page.getByTestId('skill-points')).toContainText(`Skill points: ${initialSkillPoints}`);
});

test('a corrupt slot stays isolated, and overwrite/delete actions require confirmation', async ({ page }) => {
  const validSave = encodeSave(createNewGameState());
  const corruptSlot = '{damaged slot';
  const secondSlot = JSON.stringify({
    version: 1,
    slotId: 2,
    savedAt: '2026-11-03T12:00:00.000Z',
    encodedSave: validSave,
  });
  await page.addInitScript(({ entries }) => {
    for (const [key, value] of Object.entries(entries)) window.localStorage.setItem(key, value);
  }, {
    entries: {
      [slotOneKey]: corruptSlot,
      [slotTwoKey]: secondSlot,
    },
  });
  await page.goto('/');
  await waitForAutosave(page);
  await openSaveDialog(page);

  const firstSlot = page.getByRole('region', { name: 'Slot 1' });
  const secondSlotRegion = page.getByRole('region', { name: 'Slot 2' });
  await expect(firstSlot).toContainText(/corrupt|damaged|could not be read/i);
  await expect(secondSlotRegion).toContainText(/saved/i);
  await expect(secondSlotRegion.getByRole('button', { name: 'Restore Slot 2', exact: true })).toBeEnabled();

  const autosaveBefore = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  const backupBefore = await page.evaluate((key) => window.localStorage.getItem(key), backupKey);
  const restoreSlotTwo = secondSlotRegion.getByRole('button', { name: 'Restore Slot 2', exact: true });
  await restoreSlotTwo.click();
  await secondSlotRegion.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(restoreSlotTwo).toBeFocused();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey)).toBe(autosaveBefore);
  expect(await page.evaluate((key) => window.localStorage.getItem(key), backupKey)).toBe(backupBefore);
  expect(await page.evaluate((key) => window.localStorage.getItem(key), slotTwoKey)).toBe(secondSlot);

  const overwriteSlotTwo = secondSlotRegion.getByRole('button', { name: 'Overwrite Slot 2', exact: true });
  await overwriteSlotTwo.click();
  await secondSlotRegion.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(overwriteSlotTwo).toBeFocused();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), slotTwoKey)).toBe(secondSlot);

  const deleteSlotTwo = secondSlotRegion.getByRole('button', { name: 'Delete Slot 2', exact: true });
  await deleteSlotTwo.click();
  await secondSlotRegion.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(deleteSlotTwo).toBeFocused();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), slotTwoKey)).toBe(secondSlot);

  await deleteSlotTwo.click();
  await secondSlotRegion.getByRole('button', { name: 'Confirm delete Slot 2', exact: true }).click();
  await expect(secondSlotRegion.getByRole('button', { name: 'Save to Slot 2', exact: true })).toBeFocused();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), slotTwoKey)).toBeNull();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), slotOneKey)).toBe(corruptSlot);
});
