import { expect, test } from '@playwright/test';
import { createNewGameState } from '../../src/game/persistence/gameState.js';
import { decodeSave, encodeSave } from '../../src/game/persistence/save.js';
import { DESTINATIONS, SCRATCH_PADS } from '../../src/game/content/catalog.js';
import { getTargetSlotPosition } from '../../src/game/world/placementLayout.js';

const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const preferencesKey = 'palimpsest-laboratory.preferences.v1';
const noteId = 'bell-before-dawn-02';
const noteTitle = 'Margin Note: Keep the Door Open';
const targetId = 'case-bell-before-dawn';

function createFiledNoteState() {
  const state = createNewGameState();
  const note = state.items.find((item) => item.id === noteId);
  expect(note).toMatchObject({
    title: noteTitle,
    family: 'handwritten-note',
    width: 82,
    height: 60,
  });

  const target = { kind: 'destination', id: targetId };
  const position = getTargetSlotPosition({
    target,
    item: note,
    slotIndex: 0,
    destinations: DESTINATIONS,
    scratchPads: SCRATCH_PADS,
  });
  expect(position).toBeTruthy();
  note.position = position;
  note.placement = { kind: 'destination', destinationId: targetId, slotIndex: 0 };
  note.validation = 'correct';
  note.rotation = 0;

  return { state, position };
}

async function loadFiledNote(page, textScale) {
  const { state, position } = createFiledNoteState();

  await page.addInitScript(({ gameKey, preferencesStorageKey, save, scale }) => {
    window.localStorage.setItem(gameKey, save);
    window.localStorage.setItem(preferencesStorageKey, JSON.stringify({
      version: 1,
      textScale: scale,
      reduceMotion: false,
      soundEffectsEnabled: false,
    }));
  }, {
    gameKey: autoSaveKey,
    preferencesStorageKey: preferencesKey,
    save: encodeSave(state),
    scale: textScale,
  });
  await page.goto('/');
  await page.getByTestId('world-jump').selectOption(`destination:${targetId}`);

  const button = page.getByTestId(`lab-item-${noteId}`);
  await expect(button).toBeVisible();
  const savedStateBefore = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  const savedNoteBefore = savedStateBefore.items.find((item) => item.id === noteId);
  expect(savedNoteBefore).toMatchObject({
    position,
    placement: { kind: 'destination', destinationId: targetId, slotIndex: 0 },
    width: 82,
    height: 60,
  });
  return { button, savedNoteBefore };
}

async function loadFiledNoteAtViewportPoint(page, textScale, cameraScale, edge = null) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  const viewport = await page.getByTestId('world-viewport').boundingBox();
  expect(viewport).toBeTruthy();

  const { state, position } = createFiledNoteState();
  const itemCenter = {
    x: position.x + state.items.find((item) => item.id === noteId).width / 2,
    y: position.y + state.items.find((item) => item.id === noteId).height / 2,
  };
  const note = state.items.find((item) => item.id === noteId);
  const edgeInset = 20;
  const desiredCenter = edge
    ? {
      x: edge.endsWith('left')
        ? note.width * cameraScale / 2 + edgeInset
        : viewport.width - note.width * cameraScale / 2 - edgeInset,
      y: edge.startsWith('top')
        ? note.height * cameraScale / 2 + edgeInset
        : viewport.height - note.height * cameraScale / 2 - edgeInset,
    }
    : { x: viewport.width / 2, y: viewport.height / 2 };
  state.camera = {
    panX: desiredCenter.x - itemCenter.x * cameraScale,
    panY: desiredCenter.y - itemCenter.y * cameraScale,
    scale: cameraScale,
  };

  await page.evaluate(({ gameKey, preferencesStorageKey, save, scale }) => {
    window.localStorage.setItem(gameKey, save);
    window.localStorage.setItem(preferencesStorageKey, JSON.stringify({
      version: 1,
      textScale: scale,
      reduceMotion: false,
      soundEffectsEnabled: false,
    }));
  }, {
    gameKey: autoSaveKey,
    preferencesStorageKey: preferencesKey,
    save: encodeSave(state),
    scale: textScale,
  });
  await page.reload();

  const button = page.getByTestId(`lab-item-${noteId}`);
  await expect(button).toBeVisible();
  await expect(page.locator('.zoom-readout')).toHaveText(`${Math.round(cameraScale * 100)}%`);
  const savedState = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  const savedNoteBefore = savedState.items.find((item) => item.id === noteId);
  expect(savedNoteBefore).toMatchObject({
    position,
    placement: { kind: 'destination', destinationId: targetId, slotIndex: 0 },
    width: 82,
    height: 60,
  });
  return { button, savedNoteBefore };
}

for (const textScale of [1, 1.25]) {
  test(`a filed note reveals its full title at ${Math.round(textScale * 100)}% text scale without changing its slot`, async ({ page }) => {
    const { button, savedNoteBefore } = await loadFiledNote(page, textScale);
    await expect(button).toHaveAccessibleName(new RegExp(noteTitle));
    const beforeGeometry = await button.evaluate((element) => ({
      left: element.style.left,
      top: element.style.top,
      width: element.style.width,
      height: element.style.height,
      rect: (() => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      })(),
    }));
    const reveal = button.locator('.lab-object-title-reveal');

    await button.hover();
    await expect(reveal).toBeVisible();
    await expect(reveal).toHaveText(noteTitle);
    await expect(reveal).toHaveAttribute('aria-hidden', 'true');

    await page.mouse.move(0, 0);
    expect(await button.evaluate((element) => element.matches(':hover'))).toBe(false);
    await expect(reveal).toBeHidden();
    await button.focus();
    await expect(button).toBeFocused();
    await expect(reveal).toBeVisible();
    await expect(reveal).toHaveText(noteTitle);

    const revealLayout = await reveal.evaluate((element) => {
      const elementRect = element.getBoundingClientRect();
      const itemRect = element.closest('.lab-object').getBoundingClientRect();
      let clippedByAncestor = false;
      for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (!['hidden', 'clip'].some((value) => style.overflowX === value || style.overflowY === value)) continue;
        const rect = ancestor.getBoundingClientRect();
        if (elementRect.left < rect.left || elementRect.right > rect.right
          || elementRect.top < rect.top || elementRect.bottom > rect.bottom) {
          clippedByAncestor = true;
          break;
        }
      }

      return {
        fontSize: getComputedStyle(element).fontSize,
        textFitsItsBox: element.scrollHeight <= element.clientHeight + 1,
        clippedByAncestor,
        revealWidth: elementRect.width,
        itemWidth: itemRect.width,
      };
    });
    expect(revealLayout.textFitsItsBox).toBe(true);
    expect(revealLayout.clippedByAncestor).toBe(false);
    expect(revealLayout.revealWidth).toBeGreaterThan(revealLayout.itemWidth);
    const rootFontSize = await page.locator('html').evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(Number.parseFloat(revealLayout.fontSize) / rootFontSize).toBeGreaterThanOrEqual(0.8);

    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await button.evaluate((element) => element.blur());
    await expect(button).not.toBeFocused();
    expect(await button.evaluate((element) => element.matches(':hover'))).toBe(false);
    await expect(reveal).toBeVisible();

    const afterGeometry = await button.evaluate((element) => ({
      left: element.style.left,
      top: element.style.top,
      width: element.style.width,
      height: element.style.height,
      rect: (() => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      })(),
    }));
    expect(afterGeometry).toEqual(beforeGeometry);
    const savedState = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
    expect(savedState.items.find((item) => item.id === noteId)).toMatchObject({
      position: savedNoteBefore.position,
      placement: savedNoteBefore.placement,
      width: savedNoteBefore.width,
      height: savedNoteBefore.height,
    });
  });
}

test('a title reveal stays open when the pointer enters it at 2.5× zoom without dragging the filed note', async ({ page }) => {
  const { button, savedNoteBefore } = await loadFiledNoteAtViewportPoint(page, 1, 1);
  const reveal = button.locator('.lab-object-title-reveal');
  await button.hover();
  await expect(reveal).toBeVisible();
  const oneXBounds = await reveal.boundingBox();
  expect(oneXBounds).toBeTruthy();

  for (let zoomStep = 0; zoomStep < 6; zoomStep += 1) {
    await page.getByRole('button', { name: 'Zoom in' }).click();
  }
  await expect(page.locator('.zoom-readout')).toHaveText('250%');
  await button.hover();
  await expect(reveal).toBeVisible();
  const beforeGeometry = await button.evaluate((element) => ({
    left: element.style.left,
    top: element.style.top,
    width: element.style.width,
    height: element.style.height,
    transform: element.style.transform,
    dragging: element.classList.contains('is-dragging'),
  }));
  const twoPointFiveXBounds = await reveal.boundingBox();
  expect(twoPointFiveXBounds).toBeTruthy();
  expect.soft(twoPointFiveXBounds.width).toBeLessThanOrEqual(oneXBounds.width * 1.25);
  expect.soft(twoPointFiveXBounds.width).toBeGreaterThanOrEqual(oneXBounds.width * 0.75);
  expect.soft(twoPointFiveXBounds.height).toBeLessThanOrEqual(oneXBounds.height * 1.25);
  expect.soft(twoPointFiveXBounds.height).toBeGreaterThanOrEqual(oneXBounds.height * 0.75);

  const revealPointer = {
    x: twoPointFiveXBounds.x + twoPointFiveXBounds.width / 2,
    y: twoPointFiveXBounds.y + twoPointFiveXBounds.height / 2,
  };
  const scene = page.locator('.world-scene');
  const beforeSceneTransform = await scene.evaluate((element) => element.style.transform);
  await page.mouse.move(revealPointer.x, revealPointer.y);
  expect.soft(await reveal.isVisible()).toBe(true);
  expect.soft(await button.evaluate((element) => element.matches(':hover'))).toBe(true);

  await page.mouse.down();
  await page.mouse.move(revealPointer.x + 18, revealPointer.y + 12, { steps: 2 });
  expect.soft(await button.evaluate((element) => element.classList.contains('is-dragging'))).toBe(false);
  await page.mouse.up();

  const afterGeometry = await button.evaluate((element) => ({
    left: element.style.left,
    top: element.style.top,
    width: element.style.width,
    height: element.style.height,
    transform: element.style.transform,
    dragging: element.classList.contains('is-dragging'),
  }));
  expect.soft(afterGeometry).toEqual(beforeGeometry);
  expect.soft(await scene.evaluate((element) => element.style.transform)).toBe(beforeSceneTransform);
  const savedState = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
  expect.soft(savedState.items.find((item) => item.id === noteId)).toMatchObject({
    position: savedNoteBefore.position,
    placement: savedNoteBefore.placement,
    width: savedNoteBefore.width,
    height: savedNoteBefore.height,
  });
});

for (const textScale of [1, 1.25]) {
  for (const edge of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
    test(`a filed-note title reveal stays inside the ${edge} viewport edge at 2.5× zoom and ${Math.round(textScale * 100)}% text scale`, async ({ page }) => {
      const { button, savedNoteBefore } = await loadFiledNoteAtViewportPoint(page, textScale, 2.5, edge);
      const viewportBounds = await page.getByTestId('world-viewport').boundingBox();
      const reveal = button.locator('.lab-object-title-reveal');
      const scene = page.locator('.world-scene');
      const beforeSceneTransform = await scene.evaluate((element) => element.style.transform);
      const beforeGeometry = await button.evaluate((element) => ({
        left: element.style.left,
        top: element.style.top,
        width: element.style.width,
        height: element.style.height,
        transform: element.style.transform,
        rect: (() => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return { x, y, width, height };
        })(),
      }));

      await button.hover();
      await expect(reveal).toBeVisible();
      await expect(reveal).toHaveText(noteTitle);
      const revealLayout = await reveal.evaluate((element) => {
        const elementRect = element.getBoundingClientRect();
        return {
          bounds: {
            left: elementRect.left,
            top: elementRect.top,
            right: elementRect.right,
            bottom: elementRect.bottom,
          },
          textFitsItsBox: element.scrollHeight <= element.clientHeight + 1,
        };
      });
      expect(viewportBounds).toBeTruthy();
      const inset = 8;
      expect(revealLayout.bounds.left).toBeGreaterThanOrEqual(viewportBounds.x + inset);
      expect(revealLayout.bounds.right).toBeLessThanOrEqual(viewportBounds.x + viewportBounds.width - inset);
      expect(revealLayout.bounds.top).toBeGreaterThanOrEqual(viewportBounds.y + inset);
      expect(revealLayout.bounds.bottom).toBeLessThanOrEqual(viewportBounds.y + viewportBounds.height - inset);
      expect(revealLayout.textFitsItsBox).toBe(true);

      await button.click();
      await expect(page.getByTestId('item-inspector')).toBeVisible();
      await expect(page.getByTestId('item-inspector').getByRole('heading', { level: 2 })).toHaveText(noteTitle);
      const afterGeometry = await button.evaluate((element) => ({
        left: element.style.left,
        top: element.style.top,
        width: element.style.width,
        height: element.style.height,
        transform: element.style.transform,
        rect: (() => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return { x, y, width, height };
        })(),
      }));
      expect(afterGeometry).toEqual(beforeGeometry);
      expect(await scene.evaluate((element) => element.style.transform)).toBe(beforeSceneTransform);
      const savedState = decodeSave(await page.evaluate((key) => window.localStorage.getItem(key), autoSaveKey));
      expect(savedState.items.find((item) => item.id === noteId)).toMatchObject({
        position: savedNoteBefore.position,
        placement: savedNoteBefore.placement,
        width: savedNoteBefore.width,
        height: savedNoteBefore.height,
      });
    });
  }
}
