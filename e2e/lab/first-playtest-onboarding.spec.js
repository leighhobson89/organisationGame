import { expect, test } from '@playwright/test';
import LZString from 'lz-string';
import { DESTINATIONS, SCRATCH_PADS } from '../../src/game/content/catalog.js';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { decodeSave, encodeSave } from '../../src/game/persistence/save.js';
import { getTargetSlotPosition } from '../../src/game/world/placementLayout.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const backupKey = 'palimpsest-laboratory.backup.v1';
const manualSlotKeys = [
  'palimpsest-laboratory.manual.v1',
  'palimpsest-laboratory.manual.slot-2.v1',
  'palimpsest-laboratory.manual.slot-3.v1',
];
const calibrationTitles = [
  'Carrier Tone Plate',
  'Western Echo Trace',
  'Eastern Echo Trace',
  'Counterphase Sketch',
  'Crystal Response Diagram',
  'Silent Chamber Trace',
  'Bell-Rail Harmonic',
  'Residual Wave Etching',
];

async function waitForAutosave(page) {
  await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now');
}

function createManualSlot(slotId) {
  const state = createNewGameState();
  state.progress.skillPoints = slotId + 2;

  return JSON.stringify({
    version: 1,
    slotId,
    savedAt: `2026-11-05T12:0${slotId}:00.000Z`,
    encodedSave: encodeSave(state),
  });
}

function createStartOverStorageFixture() {
  const currentState = createNewGameState();
  currentState.progress.skillPoints = 19;
  const backupState = createNewGameState();
  backupState.progress.skillPoints = 31;

  return {
    currentAutosave: encodeSave(currentState),
    existingBackup: encodeSave(backupState),
    manualSlots: manualSlotKeys.map((_, index) => createManualSlot(index + 1)),
  };
}

async function installStartOverStorageFixture(page, fixture) {
  await page.addInitScript(({ fixture: values, autoKey, oldBackup, slotKeys }) => {
    window.localStorage.clear();
    window.localStorage.setItem(autoKey, values.currentAutosave);
    window.localStorage.setItem('palimpsest-laboratory.backup.v1', oldBackup);
    for (const [index, key] of slotKeys.entries()) window.localStorage.setItem(key, values.manualSlots[index]);

    window.__blockedStorageWriteKey = null;
    window.__storageWriteFailureCount = 0;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (window.__blockedStorageWriteKey === key) {
        window.__storageWriteFailureCount += 1;
        throw new DOMException(`Mocked ${key} write failure.`, 'QuotaExceededError');
      }
      return originalSetItem.call(this, key, value);
    };
  }, {
    fixture,
    autoKey: autoSaveKey,
    oldBackup: fixture.existingBackup,
    slotKeys: manualSlotKeys,
  });

  await page.goto('/');
  await expect(page.getByTestId('skill-points')).toContainText('Skill points: 19');
  await waitForAutosave(page);
}

test('How to Play remains available and gives actionable first-run steps', async ({ page }) => {
  await page.goto('/');

  const howToPlayButton = page.getByRole('button', { name: 'How to Play', exact: true });
  await expect(howToPlayButton).toBeVisible();
  await howToPlayButton.click({ timeout: 5000 });

  const guide = page.getByRole('dialog', { name: 'How to Play', exact: true });
  await expect(guide).toBeVisible();
  await expect(guide.getByTestId('begin-first-task')).toBeFocused();
  await expect(guide).toContainText(/select and inspect/i);
  await expect(guide).toContainText(/clue/i);
  await expect(guide).toContainText(/inspector/i);
  await expect(guide).toContainText(/move item/i);
  await expect(guide).toContainText(/Harmonic Calibration/i);

  await page.keyboard.press('Escape');
  await expect(guide).toHaveCount(0);
  await expect(howToPlayButton).toBeVisible();
  await expect(howToPlayButton).toBeFocused();

  await page.keyboard.press('Enter');
  const reopenedGuide = page.getByRole('dialog', { name: 'How to Play', exact: true });
  await reopenedGuide.getByRole('button', { name: 'Find the first tuning plate' }).click();
  await expect(reopenedGuide).toHaveCount(0);
  await expect(page.getByTestId('lab-item-calibration-card-01')).toBeFocused();

  await page.reload();
  await expect(page.getByRole('button', { name: 'How to Play', exact: true })).toBeVisible();
});

test('the calibration series has distinctive titles and explains its destination slots', async ({ page }) => {
  await page.goto('/');

  const visibleTitles = [];
  for (let index = 1; index <= 8; index += 1) {
    const card = page.getByTestId(`lab-item-calibration-card-${String(index).padStart(2, '0')}`);
    await expect(card).toBeVisible();
    const title = await card.locator('.lab-object-title').innerText();
    const accessibleName = await card.getAttribute('aria-label');
    expect(accessibleName).toContain(title);
    visibleTitles.push(title);
  }
  expect([...visibleTitles].sort()).toEqual([...calibrationTitles].sort());

  await page.getByTestId('lab-item-calibration-card-01').click();
  const inspector = page.getByTestId('item-inspector');
  await expect(inspector).toBeVisible();
  await expect(inspector).toContainText('Series: Harmonic Calibration');

  const folio = page.getByTestId('destination-cabinet-calibration');
  await expect(folio).toBeVisible();
  await expect(folio).toContainText(/auto-fill slots/i);
  await expect(folio).toContainText(/any order/i);
});

test('Start Over can be canceled or confirmed without losing autosave backup or manual slots', async ({ page }) => {
  const currentState = createNewGameState();
  currentState.progress.skillPoints = 19;
  const encodedCurrentState = encodeSave(currentState);
  const manualSlots = manualSlotKeys.map((_, index) => createManualSlot(index + 1));

  await page.addInitScript(({ autosave, slotKeys, slots }) => {
    window.localStorage.clear();
    window.localStorage.setItem(autosave.key, autosave.value);
    for (const [index, key] of slotKeys.entries()) window.localStorage.setItem(key, slots[index]);
  }, {
    autosave: { key: autoSaveKey, value: encodedCurrentState },
    slotKeys: manualSlotKeys,
    slots: manualSlots,
  });

  await page.goto('/');
  await expect(page.getByTestId('skill-points')).toContainText('Skill points: 19');
  await waitForAutosave(page);

  const calibrationCard = page.getByTestId('lab-item-calibration-card-01');
  await calibrationCard.click();
  await expect(page.getByTestId('item-inspector')).toBeVisible();
  await expect(calibrationCard).toHaveAttribute('aria-pressed', 'true');

  const autosaveBefore = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  const backupBefore = await page.evaluate((key) => window.localStorage.getItem(key), backupKey);
  const slotsBefore = await page.evaluate((keys) => keys.map((key) => window.localStorage.getItem(key)), manualSlotKeys);

  await page.getByTestId('open-saves').click();
  const saveDialog = page.getByRole('dialog', { name: /Save & Restore/i });
  await expect(saveDialog).toBeVisible();

  const startOverButton = saveDialog.getByRole('button', { name: 'Start Over', exact: true });
  await startOverButton.click({ timeout: 5000 });
  let confirmation = saveDialog.getByRole('group', { name: /start over/i });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  expect(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey)).toBe(autosaveBefore);
  expect(await page.evaluate((key) => window.localStorage.getItem(key), backupKey)).toBe(backupBefore);
  await expect(page.getByTestId('skill-points')).toContainText('Skill points: 19');

  await startOverButton.click();
  confirmation = saveDialog.getByRole('group', { name: /start over/i });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: /confirm.*start over|start over/i }).click();
  await waitForAutosave(page);

  await expect(page.getByTestId('skill-points')).toContainText('Skill points: 0');
  await expect(page.getByTestId('world-item-count')).toHaveText('174 objects');
  await expect(calibrationCard).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.world-hint')).toContainText('Start with the eight tuning plates');
  const autosaveAfter = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  const backupAfter = await page.evaluate((key) => window.localStorage.getItem(key), backupKey);
  expect(autosaveAfter).not.toBe(autosaveBefore);
  expect(decodeSave(autosaveAfter).progress.skillPoints).toBe(0);
  expect(backupAfter).toBe(autosaveBefore);
  expect(await page.evaluate((keys) => keys.map((key) => window.localStorage.getItem(key)), manualSlotKeys)).toEqual(slotsBefore);
});

for (const { key, label } of [
  { key: backupKey, label: 'backup' },
  { key: autoSaveKey, label: 'autosave' },
]) {
  test(`Start Over preserves progress and manual slots when the ${label} write fails`, async ({ page }) => {
    const fixture = createStartOverStorageFixture();
    await installStartOverStorageFixture(page, fixture);

    const autosaveBefore = await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), autoSaveKey);
    const backupBefore = await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), backupKey);
    const slotsBefore = await page.evaluate((keys) => keys.map((storageKey) => window.localStorage.getItem(storageKey)), manualSlotKeys);

    await page.getByTestId('open-saves').click();
    const saveDialog = page.getByRole('dialog', { name: /Save & Restore/i });
    await saveDialog.getByRole('button', { name: 'Start Over', exact: true }).click({ timeout: 5000 });
    const confirmation = saveDialog.getByRole('group', { name: /start over/i });
    await expect(confirmation).toBeVisible();
    await page.evaluate((storageKey) => { window.__blockedStorageWriteKey = storageKey; }, key);
    await confirmation.getByRole('button', { name: /confirm.*start over|start over/i }).click();

    const feedback = page.getByTestId('save-feedback');
    await expect(feedback).toHaveAttribute('role', 'status');
    await expect(feedback).toContainText(/could not|failed|unavailable|unable/i);
    await expect(page.getByTestId('skill-points')).toContainText('Skill points: 19');
    expect(await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), autoSaveKey)).toBe(autosaveBefore);
    expect(await page.evaluate((keys) => keys.map((storageKey) => window.localStorage.getItem(storageKey)), manualSlotKeys)).toEqual(slotsBefore);
    expect(await page.evaluate(() => window.__storageWriteFailureCount)).toBeGreaterThan(0);
    if (key === backupKey) {
      expect(await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), backupKey)).toBe(backupBefore);
    } else {
      expect(await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), backupKey)).toBe(autosaveBefore);
    }
  });
}

test('a legacy calibration title upgrades without changing its placement or progress', async ({ page }) => {
  const legacyState = createNewGameState();
  legacyState.version = 2;
  legacyState.items = legacyState.items.slice(0, 150);
  legacyState.progress.skillPoints = 17;

  const card = legacyState.items.find((item) => item.id === 'calibration-card-01');
  const originalWorkspacePosition = { ...card.position };
  const slotIndex = 3;
  card.title = 'Harmonic Calibration 01';
  card.previousWorkspacePosition = originalWorkspacePosition;
  card.placement = { kind: 'destination', destinationId: 'cabinet-calibration', slotIndex };
  card.position = getTargetSlotPosition({
    target: { kind: 'destination', id: 'cabinet-calibration' },
    item: card,
    slotIndex,
    destinations: DESTINATIONS,
    scratchPads: SCRATCH_PADS,
  });
  const originalDestinationPosition = { ...card.position };

  await page.addInitScript(({ key, value }) => {
    window.localStorage.clear();
    window.localStorage.setItem(key, value);
  }, {
    key: autoSaveKey,
    value: LZString.compressToEncodedURIComponent(JSON.stringify(legacyState)),
  });
  await page.goto('/');
  await expect(page.getByTestId('skill-points')).toContainText('Skill points: 17');
  await waitForAutosave(page);

  const cardButton = page.getByTestId('lab-item-calibration-card-01');
  await expect(cardButton).toBeVisible();
  await expect(cardButton.locator('.lab-object-title')).toHaveText('Carrier Tone Plate');
  const migratedAutosave = await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey);
  const migratedState = decodeSave(migratedAutosave);
  const migratedCard = migratedState.items.find((item) => item.id === 'calibration-card-01');
  expect(migratedCard.title).toBe('Carrier Tone Plate');
  expect(migratedCard.placement).toEqual({ kind: 'destination', destinationId: 'cabinet-calibration', slotIndex });
  expect(migratedCard.position).toEqual(originalDestinationPosition);
  expect(migratedState.progress.skillPoints).toBe(17);
});
