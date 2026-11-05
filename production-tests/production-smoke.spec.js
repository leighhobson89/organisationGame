import { expect, test } from '@playwright/test';
import { decodeSave } from '../src/game/persistence/save.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const backupKey = 'palimpsest-laboratory.backup.v1';

function expectCalibrationCardFiled(save) {
  const card = save.items.find((item) => item.id === 'calibration-card-01');
  expect(card, 'the autosave should contain the first calibration card').toBeDefined();
  expect(card.placement).toMatchObject({
    kind: 'destination',
    destinationId: 'cabinet-calibration',
  });
  expect(card.validation).toBe('correct');
}

function expectCalibrationCardOnWorkspace(save, description) {
  const card = save.items.find((item) => item.id === 'calibration-card-01');
  expect(card, `${description} should contain the first calibration card`).toBeDefined();
  expect(card.placement, `${description} should restore the card to the workspace`).toMatchObject({ kind: 'workspace' });
}

test('production preview loads its modules and preserves a filed calibration card after reload', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  const moduleResponses = [];
  const failedResponses = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push({ text: message.text(), location: message.location() });
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    const resourceType = response.request().resourceType();
    if (response.status() >= 400) {
      failedResponses.push({ url: response.url(), status: response.status() });
    }
    if (resourceType !== 'script' && resourceType !== 'worker') return;

    const contentType = response.headers()['content-type'] ?? '';
    moduleResponses.push({
      url: response.url(),
      status: response.status(),
      contentType,
    });
  });

  await page.goto('/');
  await expect(page).toHaveTitle('The Palimpsest Laboratory');
  await expect(page.getByTestId('world-item-count')).toContainText('174');

  expect(moduleResponses, 'the production page should load JavaScript modules').not.toHaveLength(0);
  expect(moduleResponses.filter(({ status }) => status < 200 || status >= 300),
    'JavaScript module and worker requests should succeed').toEqual([]);
  expect(moduleResponses.filter(({ contentType }) => !/javascript|webassembly/i.test(contentType)),
    'JavaScript module and worker responses should use an executable MIME type').toEqual([]);
  expect(failedResponses, 'production startup should not request missing assets').toEqual([]);

  await page.getByTestId('lab-item-calibration-card-01').click();
  await page.getByRole('combobox', { name: /destination/i }).selectOption('cabinet-calibration');
  await page.getByRole('button', { name: 'Move item', exact: true }).click();
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
  await expect(page.getByTestId('destination-cabinet-calibration'))
    .toHaveAttribute('aria-label', /1 of 8 objects placed/i);

  const savedAfterMove = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  expect(savedAfterMove, 'filing the item should write an autosave').toBeTruthy();
  expectCalibrationCardFiled(decodeSave(savedAfterMove));

  await page.reload();
  await expect(page.getByTestId('world-item-count')).toContainText('174');
  await expect(page.getByTestId('destination-cabinet-calibration'))
    .toHaveAttribute('aria-label', /1 of 8 objects placed/i);

  const savedAfterReload = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  expect(savedAfterReload, 'reload should retain the existing autosave').toBeTruthy();
  expectCalibrationCardFiled(decodeSave(savedAfterReload));
  expect(pageErrors, 'production startup and reload should not throw uncaught runtime errors').toEqual([]);
  expect(consoleErrors, 'production startup and reload should not log browser errors').toEqual([]);
});

test('production preview restores a portable import and retains the pre-import backup', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('world-item-count')).toContainText('174');

  await page.getByTestId('open-saves').click();
  const initialExport = await page.getByTestId('save-export-string').inputValue();
  expect(initialExport, 'Save & Restore should expose a valid portable export').toBeTruthy();
  expectCalibrationCardOnWorkspace(decodeSave(initialExport), 'the initial export');
  await page.getByRole('button', { name: 'Close save dialog' }).click();

  await page.getByTestId('lab-item-calibration-card-01').click();
  await page.getByRole('combobox', { name: /destination/i }).selectOption('cabinet-calibration');
  await page.getByRole('button', { name: 'Move item', exact: true }).click();
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
  await expect(page.getByTestId('destination-cabinet-calibration'))
    .toHaveAttribute('aria-label', /1 of 8 objects placed/i);

  const filedAutosave = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  expect(filedAutosave, 'filing should be persisted before the portable import').toBeTruthy();
  expectCalibrationCardFiled(decodeSave(filedAutosave));
  expect(await page.evaluate((key) => window.localStorage.getItem(key), backupKey),
    'the import should create the pre-import backup').toBeNull();

  await page.getByTestId('open-saves').click();
  await page.getByTestId('save-import-string').fill(initialExport);
  await page.getByRole('checkbox', { name: /valid import replaces the current laboratory/i }).check();
  await page.getByRole('button', { name: 'Validate & import save' }).click();
  await expect(page.getByTestId('save-feedback')).toContainText(/save imported/i);
  await expect(page.getByTestId('destination-cabinet-calibration'))
    .toHaveAttribute('aria-label', /0 of 8 objects placed/i);
  expectCalibrationCardOnWorkspace(decodeSave(await page.getByTestId('save-export-string').inputValue()),
    'the current export after import');

  await expect.poll(async () => {
    const raw = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
    if (!raw) return null;
    return decodeSave(raw).items.find((item) => item.id === 'calibration-card-01')?.placement.kind;
  }, { message: 'autosave should persist the imported workspace placement' }).toBe('workspace');
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');

  const resetAutosave = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  expect(resetAutosave).not.toBe(filedAutosave);
  expectCalibrationCardOnWorkspace(decodeSave(resetAutosave), 'the post-import autosave');
  const preImportBackup = await page.evaluate((key) => window.localStorage.getItem(key), backupKey);
  expect(preImportBackup, 'import should preserve the pre-import state in backup storage').toBeTruthy();
  expectCalibrationCardFiled(decodeSave(preImportBackup));

  await page.reload();
  await expect(page.getByTestId('world-item-count')).toContainText('174');
  await expect(page.getByTestId('destination-cabinet-calibration'))
    .toHaveAttribute('aria-label', /0 of 8 objects placed/i);
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');

  const reloadedAutosave = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  expectCalibrationCardOnWorkspace(decodeSave(reloadedAutosave), 'the reloaded autosave');
  expect(await page.evaluate((key) => window.localStorage.getItem(key), backupKey)).toBe(preImportBackup);

  await page.getByTestId('open-saves').click();
  expectCalibrationCardOnWorkspace(decodeSave(await page.getByTestId('save-export-string').inputValue()),
    'the export after reload');
});
