import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { expect, test } from '@playwright/test';
import { DEFAULT_CONTENT_SEED, CURRENT_GAME_STATE_VERSION, createDefaultProgress, normalizeGameState } from '../src/game/persistence/gameState.js';
import { SpatialIndex } from '../src/game/world/spatialIndex.js';
import { decodeSave, encodeSave } from '../src/game/persistence/save.js';
import { roundedMedian } from './benchmark-summary.js';
import { AUTHORED_ITEM_COUNT, createBenchmarkItems } from './fixtures.js';

const itemCounts = [174, 500, 1_000, 2_500, 5_024];
const measuredTrialCount = 3;
const warmupTrialCount = 1;
const totalTrialCount = measuredTrialCount + warmupTrialCount;
const cellSize = 320;
const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const sparseCalibrationItemIds = [
  'calibration-card-01',
  'calibration-card-02',
  'calibration-card-03',
  'calibration-card-04',
  'calibration-card-05',
  'calibration-card-06',
  'calibration-card-07',
  'calibration-card-08',
];
const viewDefinitions = [
  {
    id: 'start',
    label: 'Starting camera at 0.5 scale',
    camera: { panX: 110, panY: 91, scale: 0.5 },
  },
  {
    id: 'sparse-calibration',
    label: 'Populated sparse calibration view with 8–10 mounted objects',
    camera: { panX: -1_840, panY: -964, scale: 2.5 },
  },
  {
    id: 'full-world',
    label: 'Full-world stress view at 0.2 scale',
    camera: { panX: 0, panY: 0, scale: 0.2 },
  },
];

function createSpatialGridMetrics(items) {
  const cells = new Map();
  const familyCounts = {};

  for (const item of items) {
    familyCounts[item.family] = (familyCounts[item.family] ?? 0) + 1;
    const left = item.position?.x ?? 0;
    const top = item.position?.y ?? 0;
    const right = left + (item.width ?? 100);
    const bottom = top + (item.height ?? 70);

    for (let row = Math.floor(top / cellSize); row <= Math.floor(bottom / cellSize); row += 1) {
      for (let column = Math.floor(left / cellSize); column <= Math.floor(right / cellSize); column += 1) {
        const key = `${column},${row}`;
        if (!cells.has(key)) cells.set(key, new Set());
        cells.get(key).add(item.id);
      }
    }
  }

  const densities = [...cells.values()].map((ids) => ids.size).sort((left, right) => left - right);
  const percentile = (ratio) => densities.length === 0
    ? 0
    : densities[Math.min(densities.length - 1, Math.ceil(densities.length * ratio) - 1)];

  return {
    cellSize,
    occupiedCells: cells.size,
    entitiesPerOccupiedCell: {
      p50: percentile(0.5),
      p95: percentile(0.95),
      max: densities.at(-1) ?? 0,
    },
    familyCounts,
  };
}

async function expectSparseCalibrationReadiness(page) {
  const itemNodes = page.locator('.lab-object');
  await expect.poll(async () => {
    const ids = await itemNodes.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-item-id')));
    return ids.length >= sparseCalibrationItemIds.length
      && ids.length <= 10
      && sparseCalibrationItemIds.every((id) => ids.includes(id));
  }).toBe(true);

  const mountedIds = await itemNodes.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-item-id')));
  expect(mountedIds, 'the sparse view should mount all eight calibration cards')
    .toEqual(expect.arrayContaining(sparseCalibrationItemIds));
  expect(mountedIds.length, 'the populated sparse view should mount 8–10 item cards')
    .toBeGreaterThanOrEqual(sparseCalibrationItemIds.length);
  expect(mountedIds.length, 'the populated sparse view should mount 8–10 item cards')
    .toBeLessThanOrEqual(10);
  return mountedIds;
}

function createPreparedFixtures(itemCount) {
  const generateStartedAt = performance.now();
  const items = createBenchmarkItems(itemCount);
  const generationMs = performance.now() - generateStartedAt;
  const ids = items.map((item) => item.id);
  assert.equal(items.length, itemCount, `generated ${itemCount} entities`);
  assert.equal(new Set(ids).size, itemCount, `generated ${itemCount} unique ids`);

  const indexStartedAt = performance.now();
  const index = new SpatialIndex(cellSize);
  for (const item of items) {
    index.insert({
      id: item.id,
      x: item.position?.x ?? 0,
      y: item.position?.y ?? 0,
      width: item.width ?? 100,
      height: item.height ?? 70,
    });
  }
  const spatialIndexBuildMs = performance.now() - indexStartedAt;

  const fixtureByView = {};
  const encodingTimes = {};
  const byteLengths = {};

  for (const view of viewDefinitions) {
    const state = {
      version: CURRENT_GAME_STATE_VERSION,
      contentSeed: DEFAULT_CONTENT_SEED,
      items,
      progress: createDefaultProgress(),
      camera: view.camera,
      inventionStage: 'Dormant',
      notebook: { discoveries: [] },
    };
    const normalized = normalizeGameState(state);
    assert.equal(normalized.items.length, itemCount, `normalized ${itemCount}-entity v3 fixture`);

    const encodeStartedAt = performance.now();
    const encodedSave = encodeSave(normalized);
    encodingTimes[view.id] = performance.now() - encodeStartedAt;
    byteLengths[view.id] = encodedSave.length;
    assert.equal(decodeSave(encodedSave).items.length, itemCount, `decoded ${itemCount}-entity v3 fixture`);
    fixtureByView[view.id] = encodedSave;
  }

  return {
    fixtures: fixtureByView,
    itemIds: ids,
    nodePreparation: {
      generationMs,
      spatialIndexBuildMs,
      saveEncodingMsByView: encodingTimes,
      compressedSaveCharactersByView: byteLengths,
      spatialGrid: createSpatialGridMetrics(items),
    },
  };
}

function percentile(values, ratio) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)].toFixed(2));
}

function summarizeIntervals(intervals) {
  const dropped = intervals.filter((interval) => interval > 50).length;
  return {
    sampleCount: intervals.length,
    p50Ms: percentile(intervals, 0.5),
    p95Ms: percentile(intervals, 0.95),
    p99Ms: percentile(intervals, 0.99),
    over50msCount: dropped,
    over50msRate: intervals.length === 0 ? null : Number((dropped / intervals.length).toFixed(4)),
  };
}

async function installBenchmarkInstrumentation(page) {
  await page.addInitScript(() => {
    const state = {
      longTasks: [],
      activeFrameRun: null,
      observerSupported: typeof PerformanceObserver !== 'undefined',
    };
    window.__labScalingBenchmark = state;

    try {
      const observer = new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) {
          state.longTasks.push({ startTimeMs: entry.startTime, durationMs: entry.duration });
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
    } catch {
      state.observerSupported = false;
    }

    state.beginFrameRun = (label) => {
      if (state.activeFrameRun?.rafId) cancelAnimationFrame(state.activeFrameRun.rafId);
      const run = {
        label,
        startedAtMs: performance.now(),
        actionEndedAtMs: null,
        previousFrameMs: null,
        intervalsMs: [],
        rafId: null,
      };
      state.activeFrameRun = run;
      const sampleFrame = (timestamp) => {
        if (state.activeFrameRun !== run) return;
        if (run.previousFrameMs !== null) run.intervalsMs.push(timestamp - run.previousFrameMs);
        run.previousFrameMs = timestamp;
        run.rafId = requestAnimationFrame(sampleFrame);
      };
      run.rafId = requestAnimationFrame(sampleFrame);
    };

    state.markActionEnded = (label) => {
      if (state.activeFrameRun?.label === label) state.activeFrameRun.actionEndedAtMs = performance.now();
    };

    state.finishFrameRun = async (label) => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const run = state.activeFrameRun;
      if (!run || run.label !== label) return null;
      const endedAtMs = performance.now();
      if (run.rafId) cancelAnimationFrame(run.rafId);
      state.activeFrameRun = null;
      await new Promise((resolve) => setTimeout(resolve, 0));
      return {
        label,
        actionDurationMs: run.actionEndedAtMs === null ? null : run.actionEndedAtMs - run.startedAtMs,
        sampleWindowMs: endedAtMs - run.startedAtMs,
        intervalsMs: run.intervalsMs,
        longTasks: state.longTasks.filter((task) => task.startTimeMs >= run.startedAtMs && task.startTimeMs <= endedAtMs),
      };
    };
  });
}

async function sampleInteraction(page, label, action) {
  await page.evaluate((runLabel) => window.__labScalingBenchmark.beginFrameRun(runLabel), label);
  await action();
  await page.evaluate((runLabel) => window.__labScalingBenchmark.markActionEnded(runLabel), label);
  // Keep the sampler running briefly after the last input so camera commit and drag/drop work are included.
  await page.waitForTimeout(220);
  const result = await page.evaluate((runLabel) => window.__labScalingBenchmark.finishFrameRun(runLabel), label);
  if (!result) throw new Error(`Frame sampler did not return results for ${label}.`);
  return {
    ...result,
    frameIntervals: summarizeIntervals(result.intervalsMs),
    longTasksOver50ms: result.longTasks.filter((task) => task.durationMs > 50).length,
  };
}

async function readViewMetrics(page, itemCount) {
  const [itemCountText, mountedItemCount, browserMetrics] = await Promise.all([
    page.getByTestId('world-item-count').innerText(),
    page.locator('.lab-object').count(),
    page.evaluate((expectedItemCount) => {
      const viewport = document.querySelector('[data-testid="world-viewport"]');
      const scene = document.querySelector('.world-scene');
      const navigation = performance.getEntriesByType('navigation')[0];
      const transform = scene?.style.transform ?? '';
      const translation = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
      const scaleMatch = transform.match(/scale\(([-\d.]+)\)/);
      const camera = {
        panX: Number(translation?.[1] ?? 0),
        panY: Number(translation?.[2] ?? 0),
        scale: Number(scaleMatch?.[1] ?? 1),
      };
      const viewportWidth = viewport?.clientWidth ?? 0;
      const viewportHeight = viewport?.clientHeight ?? 0;
      const worldWidth = 5200;
      const worldHeight = 3400;
      const left = (0 - 120 - camera.panX) / camera.scale;
      const right = (viewportWidth + 120 - camera.panX) / camera.scale;
      const top = (0 - 120 - camera.panY) / camera.scale;
      const bottom = (viewportHeight + 120 - camera.panY) / camera.scale;
      const visibleWorldWidth = Math.max(0, Math.min(worldWidth, right) - Math.max(0, left));
      const visibleWorldHeight = Math.max(0, Math.min(worldHeight, bottom) - Math.max(0, top));
      const visibleAreaRatio = Math.min(1, (visibleWorldWidth * visibleWorldHeight) / (worldWidth * worldHeight));
      const longTaskState = window.__labScalingBenchmark;
      const overviewCanvas = document.querySelector('.world-overview-canvas');
      const overviewCanvasVisible = Boolean(overviewCanvas)
        && !overviewCanvas.hidden
        && getComputedStyle(overviewCanvas).display !== 'none';
      const canvasRepresentedItemCount = overviewCanvasVisible
        ? Number(overviewCanvas.getAttribute('data-rendered-item-count') ?? 0)
        : 0;
      const mountedIds = [...document.querySelectorAll('.lab-object')]
        .map((element) => element.getAttribute('data-item-id'))
        .filter(Boolean);

      return {
        readyTimeMs: performance.now(),
        navigationTimingMs: navigation ? {
          responseEnd: navigation.responseEnd,
          domInteractive: navigation.domInteractive,
          domContentLoadedEnd: navigation.domContentLoadedEventEnd,
          loadEventEnd: navigation.loadEventEnd,
        } : null,
        viewport: { width: viewportWidth, height: viewportHeight },
        camera,
        visibleWorldAreaRatio: visibleAreaRatio,
        uniformSpreadExpectedMounted: expectedItemCount * visibleAreaRatio,
        overviewCanvasVisible,
        canvasRepresentedItemCount,
        mountedItemIds: mountedIds.length <= 10 ? mountedIds : mountedIds.slice(0, 10),
        longTaskObserverSupported: longTaskState.observerSupported,
        longTasks: [...longTaskState.longTasks],
        userAgent: navigator.userAgent,
      };
    }, itemCount),
  ]);

  const readyTimeMs = browserMetrics.readyTimeMs;
  const longTasks = browserMetrics.longTasks;
  return {
    itemCountText,
    totalItemCount: itemCount,
    mountedItemCount,
    overlayItemCount: mountedItemCount,
    mountedToTotalRatio: Number((mountedItemCount / itemCount).toFixed(4)),
    overviewCanvasVisible: browserMetrics.overviewCanvasVisible,
    canvasRepresentedItemCount: browserMetrics.canvasRepresentedItemCount,
    firstInteractiveTimeMs: Number(readyTimeMs.toFixed(2)),
    navigationTimingMs: browserMetrics.navigationTimingMs,
    viewport: browserMetrics.viewport,
    camera: browserMetrics.camera,
    visibleWorldAreaRatio: Number(browserMetrics.visibleWorldAreaRatio.toFixed(4)),
    uniformSpreadExpectedMounted: Number(browserMetrics.uniformSpreadExpectedMounted.toFixed(2)),
    twiceUniformSpreadExpectedMounted: Number((browserMetrics.uniformSpreadExpectedMounted * 2).toFixed(2)),
    mountedItemIds: browserMetrics.mountedItemIds,
    mountedToUniformSpreadRatio: browserMetrics.uniformSpreadExpectedMounted === 0
      ? null
      : Number((mountedItemCount / browserMetrics.uniformSpreadExpectedMounted).toFixed(4)),
    longTaskObserverSupported: browserMetrics.longTaskObserverSupported,
    longTaskCount: longTasks.length,
    longTaskTotalDurationMs: Number(longTasks.reduce((total, task) => total + task.durationMs, 0).toFixed(2)),
    longTasksOver50ms: longTasks.filter((task) => task.durationMs > 50).length,
    userAgent: browserMetrics.userAgent,
  };
}

async function preparePage(context, encodedSave, itemCount, view) {
  const page = await context.newPage();
  await page.addInitScript(({ key, save }) => {
    window.localStorage.clear();
    window.localStorage.setItem(key, save);
  }, { key: autoSaveKey, save: encodedSave });
  await installBenchmarkInstrumentation(page);

  const navigationStartedAt = performance.now();
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), 'the production preview should serve the benchmark app').toBeTruthy();
  await expect(page.getByTestId('world-item-count')).toHaveText(`${itemCount} objects`);
  const viewport = page.getByTestId('world-viewport');
  await expect.poll(() => viewport.evaluate((element) => element.clientWidth))
    .toBe(1440);
  await expect.poll(() => viewport.evaluate((element) => element.clientHeight))
    .toBeGreaterThan(700);
  // WorldViewport starts with a 1000x700 query size; let ResizeObserver's React update commit before taking culling metrics.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const itemNodes = page.locator('.lab-object');
  if (view.id === 'sparse-calibration') {
    await expectSparseCalibrationReadiness(page);
  } else if (view.id === 'full-world') {
    const canvas = page.getByTestId('world-overview-canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('data-rendered-item-count', String(itemCount));
    await expect.poll(() => itemNodes.count()).toBeLessThanOrEqual(64);
  } else {
    const recentCounts = [];
    await expect.poll(async () => {
      recentCounts.push(await itemNodes.count());
      if (recentCounts.length > 3) recentCounts.shift();
      return recentCounts.length === 3 && recentCounts.every((count) => count === recentCounts[0]);
    }, { timeout: 10_000, intervals: [100, 150, 200, 250, 300] }).toBe(true);
  }
  const hasExpectedObjectNode = view.id !== 'sparse-calibration';
  if (hasExpectedObjectNode) await expect(page.locator('.lab-object').first()).toBeVisible();
  const metrics = await readViewMetrics(page, itemCount);
  metrics.firstInteractiveSignal = hasExpectedObjectNode
    ? 'item counter and first lab-object are visible'
    : 'item counter is visible with all calibration cards and 8–10 sparse items mounted';
  return { page, metrics, navigationElapsedMs: Number((performance.now() - navigationStartedAt).toFixed(2)) };
}

async function measurePan(page, label) {
  const viewport = page.getByTestId('world-viewport');
  const scene = page.locator('.world-scene');
  const box = await viewport.boundingBox();
  if (!box) throw new Error('World viewport has no bounding box for pan measurement.');
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const transformBefore = await scene.evaluate((element) => element.style.transform);

  const measurement = await sampleInteraction(page, label, async () => {
    await viewport.focus();
    await page.keyboard.down('Space');
    try {
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await page.mouse.move(point.x + 100, point.y + 60, { steps: 12 });
      await page.mouse.up();
    } finally {
      await page.keyboard.up('Space');
    }
  });
  await expect.poll(() => scene.evaluate((element) => element.style.transform))
    .not.toBe(transformBefore);
  const transformAfter = await scene.evaluate((element) => element.style.transform);
  return { ...measurement, transformBefore, transformAfter };
}

async function measureWheelZoom(page, label) {
  const box = await page.getByTestId('world-viewport').boundingBox();
  if (!box) throw new Error('World viewport has no bounding box for wheel measurement.');
  const zoomReadout = page.locator('.zoom-readout');
  const zoomBefore = await zoomReadout.innerText();
  const currentScale = Number.parseFloat(zoomBefore) / 100;
  const wheelDeltaY = currentScale <= 0.2 ? -320 : 320;
  const measurement = await sampleInteraction(page, label, async () => {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, wheelDeltaY);
  });
  await expect(zoomReadout).not.toHaveText(zoomBefore);
  const zoomAfter = await zoomReadout.innerText();
  return { ...measurement, wheelDeltaY, zoomBefore, zoomAfter };
}

async function measureCalibrationDrag(page, label) {
  await page.getByTestId('world-jump').selectOption('destination:cabinet-calibration');
  const item = page.getByTestId('lab-item-calibration-card-01');
  const destination = page.getByTestId('destination-cabinet-calibration');
  await expect(item).toBeVisible();
  await expect(destination).toBeVisible();
  const destinationBounds = await destination.boundingBox();
  if (!destinationBounds) throw new Error('Calibration destination has no bounding box for drag measurement.');

  const measurement = await sampleInteraction(page, label, async () => {
    await item.dragTo(destination, {
      targetPosition: { x: destinationBounds.width / 2, y: destinationBounds.height / 2 },
      steps: 8,
    });
  });
  await expect(destination).toHaveAttribute('aria-label', /1 of 8 objects placed/i);
  await expect(page.getByTestId('world-item-count')).toHaveText(/\d+ objects/);
  return { ...measurement, result: 'calibration-card-01 filed; total entity count remains displayed' };
}

async function captureView(context, fixture, itemCount, view) {
  const { page, metrics, navigationElapsedMs } = await preparePage(context, fixture, itemCount, view);
  expect(metrics.itemCountText).toBe(`${itemCount} objects`);
  expect(metrics.totalItemCount).toBe(itemCount);

  if (view.id === 'sparse-calibration') {
    expect(metrics.mountedItemCount, 'populated sparse view should mount all eight calibration cards').toBeGreaterThanOrEqual(8);
    expect(metrics.mountedItemCount, 'populated sparse view should mount between eight and ten items').toBeLessThanOrEqual(10);
    expect(metrics.mountedItemCount, 'populated sparse view should cull the total save').toBeLessThan(itemCount);
    expect(metrics.mountedItemIds, 'sparse readiness metrics should include all eight calibration IDs')
      .toEqual(expect.arrayContaining(sparseCalibrationItemIds));
  }
  if (view.id === 'full-world') {
    expect(metrics.overviewCanvasVisible, 'full-world stress view should use the overview Canvas').toBe(true);
    expect(metrics.canvasRepresentedItemCount, 'overview should represent the full item set').toBe(itemCount);
    expect(metrics.overlayItemCount, 'ordinary DOM overlays should respect the 64-card budget').toBeLessThanOrEqual(64);
  }

  const interactions = {};
  try {
    interactions.pan = await measurePan(page, `${view.id}-pan`);
    interactions.wheelZoom = await measureWheelZoom(page, `${view.id}-wheel-zoom`);
    interactions.calibrationDrag = await measureCalibrationDrag(page, `${view.id}-calibration-drag`);
    metrics.longTaskCountAfterInteractions = await page.evaluate(() => window.__labScalingBenchmark.longTasks.length);
    return {
      ...metrics,
      navigationElapsedMs,
      interactions,
    };
  } finally {
    await page.close();
  }
}

function median(values, digits = 2) {
  return roundedMedian(values, digits);
}

function summarizeTrials(trials) {
  return itemCounts.map((itemCount) => {
    const measured = trials.filter((trial) => trial.itemCount === itemCount && !trial.warmup);
    return {
      itemCount,
      views: Object.fromEntries(viewDefinitions.map((view) => {
        const viewTrials = measured.map((trial) => trial.views[view.id]);
        const interactions = ['pan', 'wheelZoom', 'calibrationDrag'];
        return [view.id, {
          medianFirstInteractiveTimeMs: median(viewTrials.map((result) => result.firstInteractiveTimeMs)),
          medianMountedItemCount: median(viewTrials.map((result) => result.mountedItemCount)),
          medianOverlayItemCount: median(viewTrials.map((result) => result.overlayItemCount)),
          medianCanvasRepresentedItemCount: median(viewTrials.map((result) => result.canvasRepresentedItemCount)),
          medianMountedToTotalRatio: median(viewTrials.map((result) => result.mountedToTotalRatio), 4),
          interactionMedians: Object.fromEntries(interactions.map((interaction) => [interaction, {
            p95FrameIntervalMs: median(viewTrials.map((result) => result.interactions[interaction].frameIntervals.p95Ms).filter(Number.isFinite)),
            over50msRate: median(viewTrials.map((result) => result.interactions[interaction].frameIntervals.over50msRate).filter(Number.isFinite), 4),
            maxLongTasksOver50ms: Math.max(0, ...viewTrials.map((result) => result.interactions[interaction].longTasksOver50ms)),
          }])),
        }];
      })),
    };
  });
}

test('serial browser scaling benchmark for 174, 500, 1,000, 2,500, and 5,024 entities', async ({ browser }, testInfo) => {
  test.setTimeout(1_800_000);
  const hostCpus = os.cpus();
  const playwrightPackage = JSON.parse(fs.readFileSync(new URL('../node_modules/@playwright/test/package.json', import.meta.url), 'utf8'));
  const environment = {
    capturedAt: new Date().toISOString(),
    nodeVersion: process.version,
    operatingSystem: { platform: os.platform(), release: os.release(), architecture: os.arch() },
    cpu: { model: hostCpus[0]?.model ?? 'unavailable', logicalCores: hostCpus.length },
    totalMemoryBytes: os.totalmem(),
    edgeVersion: browser.version(),
    browserChannel: 'msedge',
    playwrightVersion: playwrightPackage.version,
    headless: true,
    contextIsolationPolicy: 'a fresh browser context is created for each measured view',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    spatialCellSize: cellSize,
    measuredTrialCount,
    warmupTrialCount,
  };
  const fixturesByCount = new Map();
  const trials = [];

  for (const itemCount of itemCounts) {
    fixturesByCount.set(itemCount, createPreparedFixtures(itemCount));
  }

  for (const itemCount of itemCounts) {
    const prepared = fixturesByCount.get(itemCount);
    for (let trialNumber = 0; trialNumber < totalTrialCount; trialNumber += 1) {
      const warmup = trialNumber < warmupTrialCount;
      const views = {};

      for (const view of viewDefinitions) {
        const context = await browser.newContext({
          viewport: { width: 1440, height: 900 },
          deviceScaleFactor: 1,
        });
        try {
          views[view.id] = await captureView(context, prepared.fixtures[view.id], itemCount, view);
        } finally {
          await context.close();
        }
      }

      trials.push({
        itemCount,
        trialNumber: trialNumber + 1,
        warmup,
        nodePreparation: prepared.nodePreparation,
        views,
      });
      console.log(`[browser-scaling] ${warmup ? 'warm-up' : `trial ${trialNumber}`} finished for ${itemCount} entities`);
    }
  }

  const report = {
    schemaVersion: 1,
    note: 'Hardware-sensitive timings are raw same-host evidence. The harness intentionally has no universal millisecond assertions. This run uses deterministic distributed synthetic filler; do not compare it as identical fixture geometry to the earlier clustered clean benchmark baseline.',
    fixtureDefinition: {
      authoredItemCount: AUTHORED_ITEM_COUNT,
      syntheticFiller: 'deterministically distributed over the world bounds; authored records, IDs, and positions are preserved',
      comparison: 'The earlier 2026-11-03 clean benchmark used clustered generateLab filler and remains a separate baseline.',
    },
    environment,
    fixtures: itemCounts.map((itemCount) => ({ itemCount, nodePreparation: fixturesByCount.get(itemCount).nodePreparation })),
    trials,
    summary: summarizeTrials(trials),
  };
  const reportPath = path.resolve('test-results/performance-benchmark/browser-scaling-results.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await testInfo.attach('browser-scaling-results.json', {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: 'application/json',
  });
  console.log(`[browser-scaling] Raw benchmark results saved to ${reportPath}`);
  console.log(`[browser-scaling] Environment: ${JSON.stringify(environment)}`);
  console.log(`[browser-scaling] Summary: ${JSON.stringify(report.summary)}`);
});
