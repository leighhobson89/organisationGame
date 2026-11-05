import { expect, test } from '@playwright/test';
import { COLLECTIONS, DESTINATIONS, SCRATCH_PADS } from '../../src/game/content/catalog.js';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { encodeSave } from '../../src/game/persistence/save.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const testViewport = { width: 3000, height: 1800 };

async function loadFreshSave(page, state = createNewGameState()) {
  state.camera = { panX: 0, panY: 0, scale: 0.4 };
  await page.setViewportSize(testViewport);
  await page.addInitScript(({ key, value }) => {
    window.localStorage.clear();
    window.localStorage.setItem(key, value);
  }, { key: autoSaveKey, value: encodeSave(state) });
  await page.goto('/');
}

async function chooseJump(page, value, expectedLabel) {
  const jump = page.getByTestId('world-jump');
  const announcer = page.getByTestId('world-announcer');

  await jump.selectOption(value);
  await expect(jump).toHaveValue('');
  await expect(announcer).toContainText(expectedLabel);

  return announcer;
}

async function readSceneCamera(page) {
  return page.locator('.world-scene').evaluate((scene) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(scene).transform);
    return { panX: matrix.e, panY: matrix.f, scale: matrix.a };
  });
}

test('World Jump announces the Starting area and Palimpsest Engine', async ({ page }) => {
  await loadFreshSave(page);

  const announcer = await chooseJump(page, 'start', 'Starting area');
  await expect(announcer).toContainText('Starting area');

  await chooseJump(page, 'engine', 'Palimpsest Engine');
});

test('World Jump announces the selected destination and scratch pad', async ({ page }) => {
  await loadFreshSave(page);

  const destination = DESTINATIONS.find((entry) => entry.id === 'case-parallax-trials');
  const scratchPad = SCRATCH_PADS.find((entry) => entry.id === 'scratch-b');

  await chooseJump(page, `destination:${destination.id}`, destination.label);
  await chooseJump(page, `scratchpad:${scratchPad.id}`, scratchPad.label);
});

test('a collection jump announces the collection and its first unfinished item', async ({ page }) => {
  const state = createNewGameState();
  const collection = COLLECTIONS.find((entry) => entry.id === 'meridian-survey');
  const firstUnfinishedItem = state.items.find((item) => item.id === collection.itemIds[0]);
  await loadFreshSave(page, state);

  const announcer = await chooseJump(page, `collection:${collection.id}`, collection.label);
  await expect(announcer).toContainText(firstUnfinishedItem.title);
});

test('a repeated destination jump announces again while ArrowRight panning stays silent', async ({ page }) => {
  const state = createNewGameState();
  await loadFreshSave(page, state);

  const destination = DESTINATIONS.find((entry) => entry.id === 'case-parallax-trials');
  const jump = page.getByTestId('world-jump');
  const viewport = page.getByTestId('world-viewport');
  const announcer = page.getByTestId('world-announcer');

  await announcer.evaluate((element) => {
    window.__worldAnnouncementMessages = [];
    const observer = new MutationObserver(() => {
      const message = element.textContent.trim();
      if (message) window.__worldAnnouncementMessages.push(message);
    });
    observer.observe(element, { childList: true, characterData: true, subtree: true });
  });

  await jump.selectOption(`destination:${destination.id}`);
  await expect(jump).toHaveValue('');
  await expect(announcer).toContainText(destination.label);
  await expect.poll(() => page.evaluate(() => window.__worldAnnouncementMessages.length)).toBe(1);
  const firstAnnouncement = await announcer.innerText();

  await viewport.focus();
  const beforeArrow = await readSceneCamera(page);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => readSceneCamera(page)).not.toEqual(beforeArrow);
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  await expect.poll(() => page.evaluate(() => window.__worldAnnouncementMessages.length)).toBe(1);
  await expect(announcer).toHaveText(firstAnnouncement);

  await jump.selectOption(`destination:${destination.id}`);
  await expect(jump).toHaveValue('');
  await expect(announcer).toContainText(destination.label);
  await expect.poll(() => page.evaluate(() => window.__worldAnnouncementMessages.length)).toBe(2);
  await expect(announcer).toHaveText(firstAnnouncement);
  await expect.poll(() => page.evaluate(() => window.__worldAnnouncementMessages))
    .toEqual([firstAnnouncement, firstAnnouncement]);
});
