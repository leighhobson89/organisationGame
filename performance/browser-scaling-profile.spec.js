import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  CURRENT_GAME_STATE_VERSION,
  DEFAULT_CONTENT_SEED,
  createDefaultProgress,
  normalizeGameState,
} from '../src/game/persistence/gameState.js';
import { encodeSave } from '../src/game/persistence/save.js';
import { createBenchmarkItems } from './fixtures.js';

const itemCounts = [174, 5_024];
const startupPhase = 'startup-including-initial-autosave';
const autoSaveKey = 'palimpsest-laboratory.autosave.v1';
const camera = { panX: 110, panY: 91, scale: 0.5 };
const traceCategories = [
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'blink',
  'cc',
  'v8',
].join(',');

function makeFixture(itemCount) {
  const state = normalizeGameState({
    version: CURRENT_GAME_STATE_VERSION,
    contentSeed: DEFAULT_CONTENT_SEED,
    items: createBenchmarkItems(itemCount),
    progress: createDefaultProgress(),
    camera,
    inventionStage: 'Dormant',
    notebook: { discoveries: [] },
  });
  assert.equal(state.items.length, itemCount);
  return encodeSave(state);
}

function profileSummary(profile) {
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const selfTimeUs = new Map();
  for (let index = 0; index < (profile.samples?.length ?? 0); index += 1) {
    const nodeId = profile.samples[index];
    const sampleDuration = profile.timeDeltas?.[index] ?? 0;
    selfTimeUs.set(nodeId, (selfTimeUs.get(nodeId) ?? 0) + sampleDuration);
  }

  const topSelfSamples = [...selfTimeUs.entries()]
    .map(([nodeId, selfUs]) => {
      const node = nodes.get(nodeId);
      const frame = node?.callFrame ?? {};
      return {
        functionName: frame.functionName || '(anonymous/native)',
        url: frame.url || '(runtime/native)',
        lineNumber: frame.lineNumber ?? null,
        columnNumber: frame.columnNumber ?? null,
        selfSampleMs: Number((selfUs / 1_000).toFixed(2)),
        samples: node?.hitCount ?? null,
      };
    })
    .sort((left, right) => right.selfSampleMs - left.selfSampleMs)
    .slice(0, 30);

  const sourceTotals = new Map();
  for (const entry of topSelfSamples) {
    sourceTotals.set(entry.url, (sourceTotals.get(entry.url) ?? 0) + entry.selfSampleMs);
  }
  return {
    sampleCount: profile.samples?.length ?? 0,
    profileDurationMs: profile.endTime && profile.startTime
      ? Number(((profile.endTime - profile.startTime) / 1_000).toFixed(2))
      : null,
    topSelfSamples,
    topSourcesAmongTopNodes: [...sourceTotals.entries()]
      .map(([url, selfSampleMs]) => ({ url, selfSampleMs: Number(selfSampleMs.toFixed(2)) }))
      .sort((left, right) => right.selfSampleMs - left.selfSampleMs),
  };
}

function traceSummary(events) {
  const completeEvents = events
    .filter((event) => event.ph === 'X' && Number.isFinite(event.dur))
    .map((event) => ({
      name: event.name,
      category: event.cat,
      durationMs: Number((event.dur / 1_000).toFixed(2)),
      traceClockMs: Number((event.ts / 1_000).toFixed(2)),
      url: event.args?.data?.url ?? event.args?.url ?? null,
      functionName: event.args?.data?.functionName ?? null,
    }));
  const totals = new Map();
  for (const event of completeEvents) {
    totals.set(event.name, (totals.get(event.name) ?? 0) + event.durationMs);
  }
  return {
    eventCount: events.length,
    completeDurationEventCount: completeEvents.length,
    // Chromium trace events are nested; these sums overlap and are rankings, not additive wall time.
    durationByEventNameMsOverlapping: [...totals.entries()]
      .map(([name, durationMs]) => ({ name, durationMs: Number(durationMs.toFixed(2)) }))
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, 30),
    longestEvents: completeEvents.sort((left, right) => right.durationMs - left.durationMs).slice(0, 50),
  };
}

async function startCapture(session) {
  const traceEvents = [];
  session.on('Tracing.dataCollected', ({ value }) => traceEvents.push(...value));
  const tracingComplete = new Promise((resolve) => session.once('Tracing.tracingComplete', resolve));
  await session.send('Profiler.enable');
  await session.send('Tracing.start', {
    categories: traceCategories,
    transferMode: 'ReportEvents',
  });
  await session.send('Profiler.start');

  return async () => {
    const { profile } = await session.send('Profiler.stop');
    await session.send('Tracing.end');
    const traceComplete = await tracingComplete;
    await session.send('Profiler.disable');
    return { profile, traceEvents, traceComplete };
  };
}

async function measurePan(page) {
  const viewport = page.getByTestId('world-viewport');
  const box = await viewport.boundingBox();
  if (!box) throw new Error('World viewport has no bounding box for pan profiling.');
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
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
  await page.waitForTimeout(220);
}

async function measureWheel(page) {
  const box = await page.getByTestId('world-viewport').boundingBox();
  if (!box) throw new Error('World viewport has no bounding box for wheel profiling.');
  const zoom = page.locator('.zoom-readout');
  const before = await zoom.innerText();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 320);
  await expect(zoom).not.toHaveText(before);
  await page.waitForTimeout(220);
}

async function prepareCalibrationDrag(page) {
  await page.getByTestId('world-jump').selectOption('destination:cabinet-calibration');
  const item = page.getByTestId('lab-item-calibration-card-01');
  const destination = page.getByTestId('destination-cabinet-calibration');
  await expect(item).toBeVisible();
  await expect(destination).toBeVisible();
  const bounds = await destination.boundingBox();
  if (!bounds) throw new Error('Calibration destination has no bounds for drag profiling.');

  return { item, destination, targetPosition: { x: bounds.width / 2, y: bounds.height / 2 } };
}

async function performCalibrationDrag(page, preparedDrag, { settle = true } = {}) {
  const { item, destination, targetPosition } = preparedDrag;
  await item.dragTo(destination, {
    targetPosition,
    steps: 8,
  });
  await expect(destination).toHaveAttribute('aria-label', /1 of 8 objects placed/i);
  if (settle) await page.waitForTimeout(220);
}

async function profileSession(browser, itemCount, fixture, phase, outputDirectory) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  let page;
  let session;
  try {
    page = await context.newPage();
    if (phase === startupPhase) {
      await page.addInitScript(({ key, save }) => {
        window.localStorage.clear();
        window.localStorage.setItem(key, save);
      }, { key: autoSaveKey, save: fixture });
      session = await context.newCDPSession(page);
      const stopCapture = await startCapture(session);
      const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
      expect(response?.ok()).toBeTruthy();
      await expect(page.getByTestId('world-item-count')).toHaveText(`${itemCount} objects`);
      const viewport = page.getByTestId('world-viewport');
      await expect.poll(() => viewport.evaluate((element) => element.clientWidth)).toBe(1440);
      await expect.poll(() => viewport.evaluate((element) => element.clientHeight)).toBeGreaterThan(700);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const nodes = page.locator('.lab-object');
      const recentCounts = [];
      await expect.poll(async () => {
        recentCounts.push(await nodes.count());
        if (recentCounts.length > 3) recentCounts.shift();
        return recentCounts.length === 3 && recentCounts.every((count) => count === recentCounts[0]);
      }, { timeout: 15_000, intervals: [100, 150, 200, 250, 300] }).toBe(true);
      await expect(nodes.first()).toBeVisible();
      const capture = await stopCapture();
      return await writeCapture(outputDirectory, itemCount, phase, capture, page);
    }

    const instrumentStorage = phase === 'delayed-autosave';
    if (instrumentStorage) {
      await page.addInitScript(() => {
        window.__profileStorageWrites = [];
        const nativeSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function profileSetItem(key, value) {
          const startedAt = performance.now();
          try {
            return nativeSetItem.call(this, key, value);
          } finally {
            window.__profileStorageWrites.push({
              key: String(key),
              valueCharacters: String(value).length,
              durationMs: Number((performance.now() - startedAt).toFixed(3)),
              atMs: Number(performance.now().toFixed(2)),
            });
          }
        };
      });
    }
    await page.addInitScript(({ key, save }) => {
      window.localStorage.clear();
      window.localStorage.setItem(key, save);
    }, { key: autoSaveKey, save: fixture });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('world-item-count')).toHaveText(`${itemCount} objects`);
    const viewport = page.getByTestId('world-viewport');
    await expect.poll(() => viewport.evaluate((element) => element.clientWidth)).toBe(1440);
    await expect.poll(() => viewport.evaluate((element) => element.clientHeight)).toBeGreaterThan(700);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const nodes = page.locator('.lab-object');
    const recentCounts = [];
    await expect.poll(async () => {
      recentCounts.push(await nodes.count());
      if (recentCounts.length > 3) recentCounts.shift();
      return recentCounts.length === 3 && recentCounts.every((count) => count === recentCounts[0]);
    }, { timeout: 15_000, intervals: [100, 150, 200, 250, 300] }).toBe(true);
    await expect(nodes.first()).toBeVisible();
    await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });

    session = await context.newCDPSession(page);
    const preparedDrag = phase === 'drag' || phase === 'delayed-autosave'
      ? await prepareCalibrationDrag(page)
      : null;
    if (preparedDrag) {
      await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });
    }
    if (phase === 'delayed-autosave') {
      await performCalibrationDrag(page, preparedDrag, { settle: false });
      const status = page.getByTestId('autosave-status');
      await expect(status).toHaveText(/Saving/);
    }
    const storageWritesBefore = instrumentStorage
      ? await page.evaluate(() => window.__profileStorageWrites.length)
      : 0;
    const stopCapture = await startCapture(session);
    if (phase === 'delayed-autosave') {
      await expect(page.getByTestId('autosave-status')).toHaveText('Saved just now', { timeout: 15_000 });
    } else {
      // Startup has been separately recorded; each interaction profile uses the benchmark's exact action and settle sequence.
      if (phase === 'pan') await measurePan(page);
      else if (phase === 'wheel') await measureWheel(page);
      else {
        await performCalibrationDrag(page, preparedDrag);
      }
    }
    const capture = await stopCapture();
    const extra = instrumentStorage
      ? { storageWrites: await page.evaluate((fromIndex) => window.__profileStorageWrites.slice(fromIndex), storageWritesBefore) }
      : {};
    return await writeCapture(outputDirectory, itemCount, phase, capture, page, extra);
  } finally {
    if (session) await session.detach().catch(() => {});
    await context.close();
  }
}

async function writeCapture(outputDirectory, itemCount, phase, capture, page, extra = {}) {
  if (!capture.profile.samples?.length) throw new Error(`${itemCount}-${phase} produced no CPU profile samples.`);
  if (capture.traceEvents.length === 0) throw new Error(`${itemCount}-${phase} produced no Chromium trace events.`);
  if (phase === 'delayed-autosave'
    && !(extra.storageWrites ?? []).some((write) => write.key === autoSaveKey)) {
    throw new Error(`${itemCount}-${phase} did not capture the autosave localStorage write.`);
  }

  const basename = `${itemCount}-${phase}`;
  const tracePath = path.join(outputDirectory, `${basename}.trace.json`);
  const cpuPath = path.join(outputDirectory, `${basename}.cpu-profile.json`);
  fs.writeFileSync(tracePath, `${JSON.stringify({ traceEvents: capture.traceEvents }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(cpuPath, `${JSON.stringify(capture.profile, null, 2)}\n`, 'utf8');
  const storageWrites = extra.storageWrites ?? [];
  return {
    itemCount,
    phase,
    tracePath,
    cpuProfilePath: cpuPath,
    trace: traceSummary(capture.traceEvents),
    cpu: profileSummary(capture.profile),
    browserContext: await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      viewport: { width: innerWidth, height: innerHeight },
      deviceScaleFactor: devicePixelRatio,
    })),
    storageWrites,
  };
}

test('capture isolated production startup and interaction profiles at 174 and 5,024 items', async ({ browser }, testInfo) => {
  const outputDirectory = path.resolve('test-results/performance-profiles');
  fs.mkdirSync(outputDirectory, { recursive: true });
  const environment = {
    capturedAt: new Date().toISOString(),
    os: `${os.type()} ${os.release()} ${os.arch()}`,
    cpu: os.cpus()[0]?.model ?? 'unknown',
    logicalCores: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    node: process.version,
    browser: browser.browserType().name(),
    browserVersion: browser.version(),
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    productionBuild: true,
    syntheticFiller: 'deterministic spatial distribution; first 174 authored records and locations preserved',
    diagnosticInstrumentation: 'CDP V8 CPU sampling + Chromium timeline events; separate from benchmark timing',
  };
  const results = [];
  const phases = [startupPhase, 'pan', 'wheel', 'drag', 'delayed-autosave'];
  for (const itemCount of itemCounts) {
    const fixture = makeFixture(itemCount);
    for (const phase of phases) {
      console.log(`[browser-profile] capturing ${phase} at ${itemCount} entities`);
      results.push(await profileSession(browser, itemCount, fixture, phase, outputDirectory));
    }
  }

  const report = {
    schemaVersion: 1,
    note: 'Profiles are separate diagnostic captures with tracing overhead. Startup-including-initial-autosave covers the initial 450ms autosave debounce when it falls before the DOM readiness barrier. Never compare profile durations directly to the unprofiled performance benchmark. Trace event duration sums overlap because Chromium records nested events; traceClockMs is the raw Chrome trace clock and is not capture-relative.',
    environment,
    scenarios: results,
  };
  const reportPath = path.join(outputDirectory, 'profile-summary.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await testInfo.attach('profile-summary.json', {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: 'application/json',
  });
  console.log(`[browser-profile] summary saved to ${reportPath}`);
});
