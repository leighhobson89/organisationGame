import { expect, test } from '@playwright/test';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { decodeSave, encodeSave } from '../../src/game/persistence/save.js';
import { PREFERENCES_STORAGE_KEY } from '../../src/game/preferences/preferences.js';
import { expectPlaceholderContrast } from '../helpers/placeholderContrast.js';

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

async function waitForDialogLayoutToSettle(dialog) {
  await dialog.evaluate(async (element) => {
    const runningAnimations = element.getAnimations({ subtree: true })
      .filter((animation) => animation.playState === 'running');
    await Promise.all(runningAnimations.map((animation) => animation.finished.catch(() => {})));
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  });
}

async function expectFocusedControlVisible(dialog, control) {
  await expect(control).toBeFocused();
  const visibility = await dialog.evaluate((element) => {
    const focused = document.activeElement;
    const dialogRect = element.getBoundingClientRect();
    const focusedRect = focused.getBoundingClientRect();
    const dialogLeft = dialogRect.left + element.clientLeft;
    const dialogTop = dialogRect.top + element.clientTop;
    const dialogRight = dialogLeft + element.clientWidth;
    const dialogBottom = dialogTop + element.clientHeight;
    const tolerance = 1;
    const hit = document.elementFromPoint(
      focusedRect.left + focusedRect.width / 2,
      focusedRect.top + focusedRect.height / 2,
    );

    return {
      insideDialog: element.contains(focused),
      fullRectVisible: focusedRect.left >= Math.max(0, dialogLeft) - tolerance
        && focusedRect.right <= Math.min(window.innerWidth, dialogRight) + tolerance
        && focusedRect.top >= Math.max(0, dialogTop) - tolerance
        && focusedRect.bottom <= Math.min(window.innerHeight, dialogBottom) + tolerance,
      hitTestable: hit === focused || focused.contains(hit),
      dialogRect: {
        left: dialogRect.left,
        top: dialogRect.top,
        right: dialogRect.right,
        bottom: dialogRect.bottom,
        clientHeight: element.clientHeight,
        scrollTop: element.scrollTop,
      },
      focusedRect: {
        left: focusedRect.left,
        top: focusedRect.top,
        right: focusedRect.right,
        bottom: focusedRect.bottom,
        width: focusedRect.width,
        height: focusedRect.height,
      },
    };
  });
  expect(visibility.insideDialog, `focused control should remain in Save & Restore: ${JSON.stringify(visibility)}`).toBe(true);
  expect(visibility.fullRectVisible, `focused control should be fully visible: ${JSON.stringify(visibility)}`).toBe(true);
  expect(visibility.hitTestable, `focused control should be hit-testable: ${JSON.stringify(visibility)}`).toBe(true);
}

async function expectSaveDialogFitsViewport(dialog, viewport) {
  const layout = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      dialogInViewport: rect.left >= 0 && rect.right <= window.innerWidth
        && rect.top >= 0 && rect.bottom <= window.innerHeight,
      dialogHasHorizontalOverflow: element.scrollWidth > element.clientWidth + 1,
      pageHasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      dialogScrollsVertically: element.scrollHeight > element.clientHeight,
    };
  });

  expect(layout.dialogInViewport, `dialog should fit ${viewport.width}x${viewport.height}`).toBe(true);
  expect(layout.dialogHasHorizontalOverflow, 'dialog content should not overflow horizontally').toBe(false);
  expect(layout.pageHasHorizontalOverflow, 'page should not overflow horizontally').toBe(false);
  expect(layout.dialogScrollsVertically, 'save dialog content should scroll vertically').toBe(true);
}

async function tabToControl(page, dialog, control) {
  await page.keyboard.press('Tab');
  await expectFocusedControlVisible(dialog, control);
}

test('Save & Restore recovers Tab focus when focus moves outside the dialog', async ({ page }) => {
  await page.goto('/');
  await openSaveDialog(page);

  const dialog = page.getByRole('dialog', { name: /save & restore/i });
  const focusableControls = dialog.locator('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])');
  const outsideControl = page.getByTestId('open-settings');

  await outsideControl.focus();
  await page.keyboard.press('Tab');
  await expect(focusableControls.first()).toBeFocused();

  await outsideControl.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(focusableControls.last()).toBeFocused();
});

test('Save & Restore transfers focus into confirmations and returns it to the slot action', async ({ page }) => {
  const savedSlot = JSON.stringify({
    version: 1,
    slotId: 2,
    savedAt: '2026-11-03T12:00:00.000Z',
    encodedSave: encodeSave(createNewGameState()),
  });
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: slotTwoKey,
    value: savedSlot,
  });
  await page.goto('/');
  await waitForAutosave(page);
  await openSaveDialog(page);

  const slot = page.getByRole('region', { name: 'Slot 2' });
  const restore = slot.getByRole('button', { name: 'Restore Slot 2', exact: true });
  await restore.click();
  const confirmRestore = slot.getByRole('button', { name: 'Confirm restore to Slot 2', exact: true });
  await expect(confirmRestore).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(restore).toBeFocused();

  await restore.click();
  await expect(confirmRestore).toBeFocused();
  await confirmRestore.click();
  await expect(restore).toBeFocused();

  const overwrite = slot.getByRole('button', { name: 'Overwrite Slot 2', exact: true });
  await overwrite.click();
  const confirmOverwrite = slot.getByRole('button', { name: 'Confirm overwrite Slot 2', exact: true });
  await expect(confirmOverwrite).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(overwrite).toBeFocused();

  await overwrite.click();
  await expect(confirmOverwrite).toBeFocused();
  await confirmOverwrite.click();
  await expect(overwrite).toBeFocused();

  const deleteAction = slot.getByRole('button', { name: 'Delete Slot 2', exact: true });
  await deleteAction.click();
  const confirmDelete = slot.getByRole('button', { name: 'Confirm delete Slot 2', exact: true });
  await expect(confirmDelete).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(deleteAction).toBeFocused();

  await deleteAction.click();
  await expect(confirmDelete).toBeFocused();
  await confirmDelete.click();
  await expect(slot.getByRole('button', { name: 'Save to Slot 2', exact: true })).toBeFocused();
});

test('150% Save & Restore stays usable by keyboard at narrow mobile widths', async ({ page }) => {
  const savedState = createNewGameState();
  savedState.progress.skillPoints = 37;
  const slotTwo = JSON.stringify({
    version: 1,
    slotId: 2,
    savedAt: '2026-11-03T12:00:00.000Z',
    encodedSave: encodeSave(savedState),
  });
  await page.addInitScript(({ preferencesKey, preferences, slotKey, slotValue }) => {
    window.localStorage.setItem(preferencesKey, preferences);
    window.localStorage.setItem(slotKey, slotValue);
  }, {
    preferencesKey: PREFERENCES_STORAGE_KEY,
    preferences: JSON.stringify({ version: 1, textScale: 1.5, reduceMotion: false }),
    slotKey: slotTwoKey,
    slotValue: slotTwo,
  });

  for (const viewport of [
    { width: 320, height: 360 },
    { width: 320, height: 480 },
    { width: 390, height: 480 },
    { width: 320, height: 400 },
    { width: 390, height: 400 },
  ]) {
    if (page.url() !== 'about:blank') {
      await page.evaluate(() => window.localStorage.clear());
    }
    await page.setViewportSize(viewport);
    await page.goto('/');
    await waitForAutosave(page);

    const textScale = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim());
    expect(textScale).toBe('1.5');
    await openSaveDialog(page);

    const dialog = page.getByRole('dialog', { name: /save & restore/i });
    await waitForDialogLayoutToSettle(dialog);
    await expectSaveDialogFitsViewport(dialog, viewport);
    const initialFocus = dialog.getByRole('button', { name: 'Close save dialog' });
    await expectFocusedControlVisible(dialog, initialFocus);

    const exportField = page.getByTestId('save-export-string');
    const copyButton = page.getByTestId('copy-save');
    const slotOne = page.getByRole('region', { name: 'Slot 1' });
    const slotTwoRegion = page.getByRole('region', { name: 'Slot 2' });
    const slotThree = page.getByRole('region', { name: 'Slot 3' });
    const overwriteSlotTwo = slotTwoRegion.getByRole('button', { name: 'Overwrite Slot 2', exact: true });
    const restoreSlotTwo = slotTwoRegion.getByRole('button', { name: 'Restore Slot 2', exact: true });
    const deleteSlotTwo = slotTwoRegion.getByRole('button', { name: 'Delete Slot 2', exact: true });
    const importField = page.getByTestId('save-import-string');
    const acknowledgement = page.getByRole('checkbox', { name: /valid import replaces the current laboratory/i });
    const importButton = page.getByRole('button', { name: 'Validate & import save', exact: true });

    for (const control of [
      exportField,
      copyButton,
      slotOne.getByRole('button', { name: 'Save to Slot 1', exact: true }),
      overwriteSlotTwo,
      restoreSlotTwo,
      deleteSlotTwo,
      slotThree.getByRole('button', { name: 'Save to Slot 3', exact: true }),
      importField,
    ]) {
      await tabToControl(page, dialog, control);
    }

    const dialogScrollTop = await dialog.evaluate((element) => element.scrollTop);
    expect(dialogScrollTop, 'Tab navigation should scroll the dialog to its lower content').toBeGreaterThan(0);
    await page.keyboard.type('x');
    await tabToControl(page, dialog, acknowledgement);
    await page.keyboard.press('Space');
    await expect(acknowledgement).toBeChecked();
    await tabToControl(page, dialog, importButton);
    await expect(importButton).toBeEnabled();

    await restoreSlotTwo.click();
    const confirmRestore = slotTwoRegion.getByRole('button', { name: 'Confirm restore to Slot 2', exact: true });
    await expectFocusedControlVisible(dialog, confirmRestore);
    await page.keyboard.press('Escape');
    await expectFocusedControlVisible(dialog, restoreSlotTwo);

    await restoreSlotTwo.click();
    await expectFocusedControlVisible(dialog, confirmRestore);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('save-feedback')).toContainText('Slot 2 restored.');
    await expectFocusedControlVisible(dialog, restoreSlotTwo);
    await expect(page.getByTestId('skill-points')).toContainText('Skill points: 37');
  }
});

test('200% Save & Restore stays usable by keyboard at 320x360', async ({ page }) => {
  const savedState = createNewGameState();
  savedState.progress.skillPoints = 37;
  const slotTwo = JSON.stringify({
    version: 1,
    slotId: 2,
    savedAt: '2026-11-03T12:00:00.000Z',
    encodedSave: encodeSave(savedState),
  });
  await page.setViewportSize({ width: 320, height: 360 });
  await page.addInitScript(({ preferencesKey, preferences, slotKey, slotValue }) => {
    window.localStorage.setItem(preferencesKey, preferences);
    window.localStorage.setItem(slotKey, slotValue);
  }, {
    preferencesKey: PREFERENCES_STORAGE_KEY,
    preferences: JSON.stringify({ version: 1, textScale: 2, reduceMotion: false }),
    slotKey: slotTwoKey,
    slotValue: slotTwo,
  });

  await page.goto('/');
  await waitForAutosave(page);
  const textScale = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim());
  expect(textScale).toBe('2');
  await openSaveDialog(page);

  const dialog = page.getByRole('dialog', { name: /save & restore/i });
  await waitForDialogLayoutToSettle(dialog);
  await expectSaveDialogFitsViewport(dialog, { width: 320, height: 360 });
  const initialFocus = dialog.getByRole('button', { name: 'Close save dialog' });
  await expectFocusedControlVisible(dialog, initialFocus);

  const exportField = page.getByTestId('save-export-string');
  const copyButton = page.getByTestId('copy-save');
  const slotOne = page.getByRole('region', { name: 'Slot 1' });
  const slotTwoRegion = page.getByRole('region', { name: 'Slot 2' });
  const slotThree = page.getByRole('region', { name: 'Slot 3' });
  const restoreSlotTwo = slotTwoRegion.getByRole('button', { name: 'Restore Slot 2', exact: true });
  const importField = page.getByTestId('save-import-string');
  const acknowledgement = page.getByRole('checkbox', { name: /valid import replaces the current laboratory/i });
  const importButton = page.getByRole('button', { name: 'Validate & import save', exact: true });

  for (const control of [
    exportField,
    copyButton,
    slotOne.getByRole('button', { name: 'Save to Slot 1', exact: true }),
    slotTwoRegion.getByRole('button', { name: 'Overwrite Slot 2', exact: true }),
    restoreSlotTwo,
    slotTwoRegion.getByRole('button', { name: 'Delete Slot 2', exact: true }),
    slotThree.getByRole('button', { name: 'Save to Slot 3', exact: true }),
    importField,
  ]) {
    await tabToControl(page, dialog, control);
  }

  const dialogScrollTop = await dialog.evaluate((element) => element.scrollTop);
  expect(dialogScrollTop, 'Tab navigation should scroll the dialog to its lower content').toBeGreaterThan(0);
  await page.keyboard.type('x');
  await tabToControl(page, dialog, acknowledgement);
  await page.keyboard.press('Space');
  await expect(acknowledgement).toBeChecked();
  await tabToControl(page, dialog, importButton);
  await expect(importButton).toBeEnabled();

  await restoreSlotTwo.click();
  const confirmRestore = slotTwoRegion.getByRole('button', { name: 'Confirm restore to Slot 2', exact: true });
  await expectFocusedControlVisible(dialog, confirmRestore);
  await expect(slotTwoRegion.getByText('Replace current progress with the snapshot in Slot 2? Your current game will be backed up first.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expectFocusedControlVisible(dialog, restoreSlotTwo);

  await restoreSlotTwo.click();
  await expectFocusedControlVisible(dialog, confirmRestore);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('save-feedback')).toContainText('Slot 2 restored.');
  await expectFocusedControlVisible(dialog, restoreSlotTwo);
  await expect(page.getByTestId('skill-points')).toContainText('Skill points: 37');
});

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

test('overwrite storage failure reports an accessible error and preserves Slot 2 and live state', async ({ page }) => {
  const liveState = createNewGameState();
  liveState.progress.skillPoints = 7;
  const slotState = createNewGameState();
  slotState.progress.skillPoints = 23;
  const liveAutosave = encodeSave(liveState);
  const occupiedSlot = JSON.stringify({
    version: 1,
    slotId: 2,
    savedAt: '2026-11-03T12:00:00.000Z',
    encodedSave: encodeSave(slotState),
  });

  await page.addInitScript(({ autosaveKey, autosaveValue, slotKey, slotValue }) => {
    window.localStorage.setItem(autosaveKey, autosaveValue);
    window.localStorage.setItem(slotKey, slotValue);
    const originalSetItem = Storage.prototype.setItem;
    window.__manualSlotWriteAttempts = 0;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === slotKey) {
        window.__manualSlotWriteAttempts += 1;
        throw new DOMException('Mocked Slot 2 storage write failure.', 'QuotaExceededError');
      }
      return originalSetItem.call(this, key, value);
    };
  }, {
    autosaveKey: autoSaveKey,
    autosaveValue: liveAutosave,
    slotKey: slotTwoKey,
    slotValue: occupiedSlot,
  });

  await page.goto('/');
  await waitForAutosave(page);
  await openSaveDialog(page);

  const slot = page.getByRole('region', { name: 'Slot 2' });
  const slotStatus = slot.locator('.manual-save-slot__status');
  const overwrite = slot.getByRole('button', { name: 'Overwrite Slot 2', exact: true });
  const originalSlotStatus = await slotStatus.textContent();
  const exportField = page.getByTestId('save-export-string');
  const exportBefore = await exportField.inputValue();
  const autosaveBefore = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);

  await expect(slotStatus).toHaveAttribute('role', 'status');
  await expect(slotStatus).toHaveAttribute('data-status', 'saved');
  await expect(slotStatus).toHaveText('Saved snapshot.');
  await expect(page.getByTestId('skill-points')).toContainText('Skill points: 7');
  expect(decodeSave(exportBefore).progress.skillPoints).toBe(7);
  expect(await page.evaluate((key) => window.localStorage.getItem(key), slotTwoKey)).toBe(occupiedSlot);
  expect(decodeSave(JSON.parse(occupiedSlot).encodedSave).progress.skillPoints).toBe(23);

  await overwrite.click();
  const confirmOverwrite = slot.getByRole('button', { name: 'Confirm overwrite Slot 2', exact: true });
  await expect(confirmOverwrite).toBeFocused();
  await confirmOverwrite.click();

  const failureFeedback = page.getByTestId('save-feedback');
  await expect(failureFeedback).toHaveAttribute('role', 'status');
  await expect(failureFeedback).toContainText('Mocked Slot 2 storage write failure.');
  await expect(slotStatus).toHaveAttribute('data-status', 'saved');
  await expect(slotStatus).toHaveText(originalSlotStatus);
  await expect(page.getByTestId('skill-points')).toContainText('Skill points: 7');
  expect(await page.evaluate((key) => window.localStorage.getItem(key), slotTwoKey)).toBe(occupiedSlot);
  expect(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey)).toBe(autosaveBefore);
  expect(await exportField.inputValue()).toBe(exportBefore);
  expect(await page.evaluate(() => window.__manualSlotWriteAttempts)).toBeGreaterThan(0);
});

test('clipboard unavailable shows accessible copy instructions and keeps the export available', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException('Clipboard access is unavailable for this test.', 'NotAllowedError');
        },
      },
    });
  });

  await page.goto('/');
  await waitForAutosave(page);
  await openSaveDialog(page);

  const exportField = page.getByTestId('save-export-string');
  const exportBefore = await exportField.inputValue();
  expect(exportBefore, 'a portable export should be present before copying').not.toBe('');
  await expect(exportField).toBeVisible();
  await expect(exportField).toHaveAttribute('readonly', '');

  await page.getByTestId('copy-save').click();

  const feedback = page.getByTestId('save-feedback');
  await expect(feedback).toBeVisible();
  await expect(feedback).toHaveAttribute('role', 'status');
  await expect(feedback).toHaveText('Select the save string below and copy it.');
  await expect(exportField).toBeVisible();
  expect(await exportField.inputValue()).toBe(exportBefore);
});

test('Save & Restore placeholder contrast meets WCAG AA', async ({ page }) => {
  await page.goto('/');
  await waitForAutosave(page);
  await openSaveDialog(page);

  await expectPlaceholderContrast(page.locator('#save-import'), 'Save & Restore import');
});
