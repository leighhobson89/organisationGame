import { expect, test } from '@playwright/test';

const sampleRate = 48_000;
const frameCount = 36_000;
const audioEvents = [
  'item.pickup',
  'item.drop',
  'item.placement.correct',
  'item.placement.invalid',
  'collection.completed',
  'puzzle.discovered',
  'puzzle.completed',
  'skill.unlocked',
  'skill.activated',
  'machinery.stage.changed',
  'invention.assembled',
  'invention.activated',
];

const distinctCuePairs = [
  ['item.placement.correct', 'item.placement.invalid'],
  ['collection.completed', 'invention.activated'],
  ['skill.unlocked', 'skill.activated'],
];

test('all gameplay Web Audio cues render bounded, distinct offline PCM with silent tails', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(async ({ events, rate, frames, pairs }) => {
    const OfflineContext = window.OfflineAudioContext ?? window.webkitOfflineAudioContext;
    if (typeof OfflineContext !== 'function') {
      return { supported: false, reason: 'This browser does not provide OfflineAudioContext.' };
    }

    const { createWebAudioAdapter } = await import('/src/game/audio/webAudioAdapter.js');
    const { emitGameAudioEvent, GAME_AUDIO_EVENT_TYPES } = await import('/src/game/audio/audioEvents.js');
    const unexpectedEvents = events.filter((type) => !GAME_AUDIO_EVENT_TYPES.includes(type));
    if (unexpectedEvents.length > 0) {
      throw new Error(`Requested unknown gameplay audio events: ${unexpectedEvents.join(', ')}`);
    }

    const renderedCues = {};
    const renderedPcm = {};
    const contextRecords = [];

    for (const eventType of events) {
      let bridge;
      class OfflineAudioContextBridge {
        constructor() {
          this.native = new OfflineContext(1, frames, rate);
          this.virtualState = 'suspended';
          bridge = this;
          contextRecords.push(this);
        }

        get state() { return this.virtualState; }
        get currentTime() { return this.native.currentTime; }
        get destination() { return this.native.destination; }
        createOscillator() { return this.native.createOscillator(); }
        createGain() { return this.native.createGain(); }
        async resume() { this.virtualState = 'running'; }
        async close() { this.virtualState = 'closed'; }
      }

      const adapter = createWebAudioAdapter({
        AudioContext: OfflineAudioContextBridge,
        minIntervalMs: 0,
      });

      try {
        const unlocked = await adapter.unlock();
        if (!unlocked) throw new Error(`Audio adapter could not unlock for ${eventType}.`);
        if (!bridge) throw new Error(`Audio adapter did not construct an offline context for ${eventType}.`);

        emitGameAudioEvent(eventType, { source: 'offline-render-regression' });
        const buffer = await bridge.native.startRendering();
        const pcm = buffer.getChannelData(0);
        renderedPcm[eventType] = pcm.slice();
        let peak = 0;
        let firstActive = -1;
        let lastActive = -1;
        let fullBufferSquareSum = 0;
        let activeSquareSum = 0;
        let firstFiveMsPeak = 0;
        let lastFiveMsPeak = 0;
        let finalHundredMsSquareSum = 0;
        const firstFiveMsFrames = Math.round(rate * 0.005);
        const finalHundredMsStart = frames - Math.round(rate * 0.1);

        for (let index = 0; index < pcm.length; index += 1) {
          const absolute = Math.abs(pcm[index]);
          peak = Math.max(peak, absolute);
          fullBufferSquareSum += pcm[index] * pcm[index];
          if (absolute > 1e-4) {
            if (firstActive < 0) firstActive = index;
            lastActive = index;
            activeSquareSum += pcm[index] * pcm[index];
          }
          if (index >= finalHundredMsStart) finalHundredMsSquareSum += pcm[index] * pcm[index];
        }

        const activeFrameCount = firstActive < 0 ? 0 : lastActive - firstActive + 1;
        const fullBufferRms = Math.sqrt(fullBufferSquareSum / pcm.length);
        const activeRms = activeFrameCount === 0 ? 0 : Math.sqrt(activeSquareSum / activeFrameCount);
        if (activeFrameCount > 0) {
          const firstFiveMsEnd = Math.min(lastActive + 1, firstActive + firstFiveMsFrames);
          for (let index = firstActive; index < firstFiveMsEnd; index += 1) {
            firstFiveMsPeak = Math.max(firstFiveMsPeak, Math.abs(pcm[index]));
          }
          const lastFiveMsStart = Math.max(firstActive, lastActive - firstFiveMsFrames + 1);
          for (let index = lastFiveMsStart; index <= lastActive; index += 1) {
            lastFiveMsPeak = Math.max(lastFiveMsPeak, Math.abs(pcm[index]));
          }
        }
        const finalHundredMsFrames = pcm.length - finalHundredMsStart;
        const finalHundredMsRms = Math.sqrt(finalHundredMsSquareSum / finalHundredMsFrames);

        renderedCues[eventType] = {
          peak,
          fullBufferRms,
          activeRms,
          activeDurationSeconds: activeFrameCount / rate,
          firstFiveMsPeak,
          lastFiveMsPeak,
          finalHundredMsRms,
          sampleRate: buffer.sampleRate,
          frameCount: buffer.length,
          contextStateAfterUnlock: bridge.state === 'running' ? 'running' : bridge.state,
        };
      } finally {
        adapter.dispose();
      }
    }

    const normalizedPcmDistance = (first, second) => {
      let firstPeak = 0;
      let secondPeak = 0;
      for (let index = 0; index < first.length; index += 1) {
        firstPeak = Math.max(firstPeak, Math.abs(first[index]));
        secondPeak = Math.max(secondPeak, Math.abs(second[index]));
      }
      if (firstPeak === 0 || secondPeak === 0 || first.length !== second.length) return 0;

      let squareSum = 0;
      for (let index = 0; index < first.length; index += 1) {
        const difference = first[index] / firstPeak - second[index] / secondPeak;
        squareSum += difference * difference;
      }
      return Math.sqrt(squareSum / first.length);
    };

    const normalizedDistances = Object.fromEntries(pairs.map(([firstType, secondType]) => [
      `${firstType} vs ${secondType}`,
      normalizedPcmDistance(renderedPcm[firstType], renderedPcm[secondType]),
    ]));

    return {
      supported: true,
      eventTypes: GAME_AUDIO_EVENT_TYPES,
      cues: renderedCues,
      normalizedDistances,
      contextCount: contextRecords.length,
      closedBridgeCount: contextRecords.filter((context) => context.state === 'closed').length,
    };
  }, { events: audioEvents, rate: sampleRate, frames: frameCount, pairs: distinctCuePairs });

  expect(result.supported, result.reason ?? 'OfflineAudioContext should be available in the configured Edge browser').toBe(true);
  expect(result.eventTypes).toEqual(audioEvents);
  expect(result.contextCount, 'each cue render should create a fresh native offline context').toBe(audioEvents.length);
  expect(result.closedBridgeCount, 'adapter.dispose should call close on each audio bridge after PCM collection').toBe(audioEvents.length);

  for (const eventType of audioEvents) {
    const cue = result.cues[eventType];
    expect(cue, `${eventType} should have rendered PCM metrics`).toBeTruthy();
    expect(cue.peak, `${eventType} peak should remain audible but bounded`).toBeGreaterThanOrEqual(0.02);
    expect(cue.peak, `${eventType} peak should remain audible but bounded`).toBeLessThanOrEqual(0.2);
    expect(cue.fullBufferRms, `${eventType} full-buffer RMS should retain audible energy`).toBeGreaterThanOrEqual(0.005);
    expect(cue.activeRms, `${eventType} active region should retain audible energy`).toBeGreaterThanOrEqual(0.005);
    expect(cue.activeDurationSeconds, `${eventType} active duration should remain short and nonzero`).toBeGreaterThanOrEqual(0.06);
    expect(cue.activeDurationSeconds, `${eventType} active duration should remain short and nonzero`).toBeLessThanOrEqual(0.55);
    expect(cue.firstFiveMsPeak, `${eventType} should fade in over its first five milliseconds`).toBeLessThan(0.85 * cue.peak);
    expect(cue.lastFiveMsPeak, `${eventType} should fade out over its final five milliseconds`).toBeLessThan(0.85 * cue.peak);
    expect(cue.finalHundredMsRms, `${eventType} should leave the final 100ms silent`).toBeLessThan(1e-6);
    expect(cue.sampleRate, `${eventType} should render at ${sampleRate} Hz`).toBe(sampleRate);
    expect(cue.frameCount, `${eventType} should render exactly ${frameCount} frames`).toBe(frameCount);
    expect(cue.contextStateAfterUnlock, `${eventType} should unlock through the bridge before rendering`).toBe('running');
  }

  for (const [pair, distance] of Object.entries(result.normalizedDistances)) {
    expect(distance, `normalized PCM distance for ${pair} should show distinct cues`).toBeGreaterThan(0.1);
  }
});
