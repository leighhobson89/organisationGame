import assert from 'node:assert/strict';
import test from 'node:test';

import {
  emitGameAudioEvent,
  GAME_AUDIO_EVENT_TYPES,
  subscribeGameAudioEvents,
} from '../../../src/game/audio/audioEvents.js';
import { createWebAudioAdapter } from '../../../src/game/audio/webAudioAdapter.js';

function createAudioParam() {
  return {
    value: 0,
    events: [],
    setValueAtTime(value, time) {
      this.value = value;
      this.events.push({ type: 'set', value, time });
    },
    linearRampToValueAtTime(value, time) {
      this.value = value;
      this.events.push({ type: 'linear-ramp', value, time });
    },
    exponentialRampToValueAtTime(value, time) {
      this.value = value;
      this.events.push({ type: 'exponential-ramp', value, time });
    },
    setTargetAtTime(value, time, constant) {
      this.value = value;
      this.events.push({ type: 'target', value, time, constant });
    },
    cancelScheduledValues(time) {
      this.events.push({ type: 'cancel', time });
    },
  };
}

function createFakeAudioContextClass({ rejectedResumes = 0 } = {}) {
  return class FakeAudioContext {
    static instances = [];
    static pendingRejectedResumes = rejectedResumes;

    constructor() {
      this.state = 'suspended';
      this.currentTime = 12;
      this.destination = {};
      this.oscillators = [];
      this.gains = [];
      this.resumeCount = 0;
      this.closeCount = 0;
      FakeAudioContext.instances.push(this);
    }

    async resume() {
      this.resumeCount += 1;
      if (FakeAudioContext.pendingRejectedResumes > 0) {
        FakeAudioContext.pendingRejectedResumes -= 1;
        throw new Error('audio context resume was rejected');
      }
      this.state = 'running';
    }

    async close() {
      this.closeCount += 1;
      this.state = 'closed';
    }

    createOscillator() {
      const { currentTime } = this;
      const oscillator = {
        type: 'sine',
        frequency: createAudioParam(),
        connections: [],
        startedAt: null,
        stoppedAt: null,
        stopCalls: [],
        connect(destination) { this.connections.push(destination); return destination; },
        start(time = currentTime) {
          this.startedAt = time;
          this.frequencyAtStart = this.frequency.value;
        },
        stop(time) { this.stopCalls.push(time); this.stoppedAt = time; },
      };
      this.oscillators.push(oscillator);
      return oscillator;
    }

    createGain() {
      const gain = {
        gain: createAudioParam(),
        connections: [],
        connect(destination) { this.connections.push(destination); return destination; },
      };
      this.gains.push(gain);
      return gain;
    }
  };
}

function createAdapter(options = {}) {
  const AudioContext = options.AudioContext ?? createFakeAudioContextClass();
  const adapter = createWebAudioAdapter({
    AudioContext,
    enabled: true,
    minIntervalMs: 60,
    now: () => 1000,
    ...options,
  });
  return { adapter, AudioContext };
}

function startedOscillators(AudioContext) {
  return AudioContext.instances.flatMap((context) => context.oscillators).filter((oscillator) => oscillator.startedAt !== null);
}

test('each current gameplay event maps to a bounded quiet Web Audio cue', async (t) => {
  let now = 1000;
  const AudioContext = createFakeAudioContextClass();
  const adapter = createWebAudioAdapter({ AudioContext, enabled: true, minIntervalMs: 60, now: () => now });
  t.after(() => adapter.dispose());
  await adapter.unlock();

  for (const type of GAME_AUDIO_EVENT_TYPES) {
    emitGameAudioEvent(type, {});
    now += 100;
  }

  const cues = startedOscillators(AudioContext);
  assert.ok(cues.length >= GAME_AUDIO_EVENT_TYPES.length, 'every published gameplay event should produce a cue');
  assert.ok(cues.every(({ frequencyAtStart }) => Number.isFinite(frequencyAtStart) && frequencyAtStart > 0));

  const context = AudioContext.instances[0];
  const scheduledGains = context.gains.flatMap(({ gain }) => gain.events)
    .filter(({ type: eventType }) => eventType === 'set' || eventType === 'linear-ramp' || eventType === 'exponential-ramp');
  assert.ok(scheduledGains.length > 0, 'each cue should use a gain envelope');
  assert.ok(Math.max(...scheduledGains.map(({ value }) => value)) <= 0.25, 'synthetic cues stay quiet');
  assert.ok(cues.every((cue) => Number.isFinite(cue.stoppedAt)
    && cue.stoppedAt > cue.startedAt
    && cue.stoppedAt - cue.startedAt <= 1.2), 'every oscillator has a bounded stop time');
});

test('an enabled Settings preview unlocks and plays without publishing a gameplay event', async (t) => {
  const AudioContext = createFakeAudioContextClass();
  const adapter = createWebAudioAdapter({ AudioContext, enabled: true, minIntervalMs: 0 });
  const receivedEvents = [];
  const removeObserver = subscribeGameAudioEvents((event) => receivedEvents.push(event.type));
  t.after(async () => {
    removeObserver();
    await adapter.dispose();
  });

  assert.equal(GAME_AUDIO_EVENT_TYPES.includes('settings.preview'), false);
  assert.equal(await adapter.preview(), true);
  assert.equal(AudioContext.instances.length, 1, 'preview unlocks through the adapter');
  assert.ok(startedOscillators(AudioContext).length > 0, 'preview schedules a short synthesized motif');
  assert.deepEqual(receivedEvents, [], 'preview does not publish a fake gameplay event');
});

test('muted or unsupported Settings preview is unavailable without scheduling audio', async (t) => {
  const mutedAudioContext = createFakeAudioContextClass();
  const muted = createWebAudioAdapter({ AudioContext: mutedAudioContext, enabled: false });
  const unsupported = createWebAudioAdapter({ AudioContext: null, enabled: true });
  t.after(async () => {
    await muted.dispose();
    await unsupported.dispose();
  });

  assert.equal(await muted.preview(), false);
  assert.equal(mutedAudioContext.instances.length, 0, 'a muted preview does not construct an AudioContext');
  assert.equal(await unsupported.preview(), false, 'missing Web Audio is reported as unavailable');
});

test('disabling sound effects immediately stops an active Settings preview', async (t) => {
  const AudioContext = createFakeAudioContextClass();
  const adapter = createWebAudioAdapter({ AudioContext, enabled: true, minIntervalMs: 0 });
  t.after(() => adapter.dispose());

  assert.equal(await adapter.preview(), true);
  const voices = startedOscillators(AudioContext);
  assert.ok(voices.length > 0);
  const stopCountBeforeMute = voices.reduce((sum, voice) => sum + voice.stopCalls.length, 0);

  adapter.setEnabled(false);

  const stopCountAfterMute = voices.reduce((sum, voice) => sum + voice.stopCalls.length, 0);
  assert.ok(stopCountAfterMute > stopCountBeforeMute, 'muting stops every scheduled preview voice');
});

test('a rejected Settings preview unlock is non-fatal and can retry on a later gesture', async (t) => {
  const receivedEvents = [];
  const removeObserver = subscribeGameAudioEvents((event) => receivedEvents.push(event.type));
  const AudioContext = createFakeAudioContextClass({ rejectedResumes: 1 });
  const adapter = createWebAudioAdapter({ AudioContext, enabled: true, minIntervalMs: 0 });
  t.after(async () => {
    removeObserver();
    await adapter.dispose();
  });

  assert.equal(await adapter.preview(), false);
  assert.equal(startedOscillators(AudioContext).length, 0);
  assert.deepEqual(receivedEvents, []);

  assert.equal(await adapter.preview(), true);
  assert.ok(startedOscillators(AudioContext).length > 0, 'a later trusted preview can recover playback');
  assert.deepEqual(receivedEvents, []);
});

test('placement success and invalidity use distinguishable cues', async (t) => {
  let now = 1000;
  const AudioContext = createFakeAudioContextClass();
  const adapter = createWebAudioAdapter({ AudioContext, enabled: true, minIntervalMs: 0, now: () => now });
  t.after(() => adapter.dispose());
  await adapter.unlock();

  emitGameAudioEvent('item.placement.correct');
  const correctCueFrequencies = startedOscillators(AudioContext).map(({ frequencyAtStart }) => frequencyAtStart);
  now += 1;
  emitGameAudioEvent('item.placement.invalid');

  const invalidCueFrequencies = startedOscillators(AudioContext)
    .slice(correctCueFrequencies.length)
    .map(({ frequencyAtStart }) => frequencyAtStart);
  assert.ok(correctCueFrequencies.length > 0);
  assert.ok(invalidCueFrequencies.length > 0);
  assert.notDeepEqual(invalidCueFrequencies, correctCueFrequencies);
});

test('events before the user unlock gesture are dropped and never replayed', async (t) => {
  const { adapter, AudioContext } = createAdapter();
  t.after(() => adapter.dispose());

  emitGameAudioEvent('item.pickup');
  assert.equal(AudioContext.instances.length, 0, 'AudioContext construction waits until explicit unlock');

  await adapter.unlock();
  assert.equal(startedOscillators(AudioContext).length, 0, 'unlock does not replay an earlier event');

  emitGameAudioEvent('item.drop');
  assert.ok(startedOscillators(AudioContext).length > 0, 'a fresh event after unlock plays');
});

test('muted events are discarded, and enabling sound plays only new events after unlock', async (t) => {
  const AudioContext = createFakeAudioContextClass();
  const adapter = createWebAudioAdapter({ AudioContext, enabled: false, minIntervalMs: 0 });
  t.after(() => adapter.dispose());

  await adapter.unlock();
  emitGameAudioEvent('collection.completed');
  assert.equal(AudioContext.instances.length, 0, 'a muted setting does not create an audio context');

  adapter.setEnabled(true);
  await adapter.unlock();
  assert.equal(startedOscillators(AudioContext).length, 0, 'events emitted while muted are not queued');
  emitGameAudioEvent('puzzle.discovered');
  assert.ok(startedOscillators(AudioContext).length > 0, 'a fresh event plays after opt-in and unlock');

  const activeCue = startedOscillators(AudioContext).at(-1);
  const scheduledStops = activeCue.stopCalls.length;
  adapter.setEnabled(false);
  assert.ok(activeCue.stopCalls.length > scheduledStops, 'muting immediately stops a cue that is already active');
  const startsBeforeMutedEvent = startedOscillators(AudioContext).length;
  emitGameAudioEvent('skill.activated');
  assert.equal(startedOscillators(AudioContext).length, startsBeforeMutedEvent);
});

test('dispose unsubscribes, stops future playback, closes the context, and is idempotent', async () => {
  const { adapter, AudioContext } = createAdapter();
  await adapter.unlock();
  const observerEvents = [];
  const removeObserver = subscribeGameAudioEvents((event) => observerEvents.push(event.type));

  emitGameAudioEvent('item.pickup');
  const startedBeforeDispose = startedOscillators(AudioContext).length;
  await adapter.dispose();
  await adapter.dispose();
  emitGameAudioEvent('item.drop');

  assert.equal(startedOscillators(AudioContext).length, startedBeforeDispose);
  assert.equal(AudioContext.instances[0].state, 'closed');
  assert.deepEqual(observerEvents, ['item.pickup', 'item.drop'], 'disposing the adapter leaves other event subscribers intact');
  removeObserver();
});

test('rapid repeated cues are rate limited without suppressing a later cue', async (t) => {
  let now = 100;
  const AudioContext = createFakeAudioContextClass();
  const adapter = createWebAudioAdapter({ AudioContext, enabled: true, minIntervalMs: 80, now: () => now });
  t.after(() => adapter.dispose());
  await adapter.unlock();

  emitGameAudioEvent('item.pickup');
  const firstCueCount = startedOscillators(AudioContext).length;
  emitGameAudioEvent('item.pickup');
  assert.equal(startedOscillators(AudioContext).length, firstCueCount, 'a repeat inside the rate limit is suppressed');

  now += 81;
  emitGameAudioEvent('item.pickup');
  assert.ok(startedOscillators(AudioContext).length > firstCueCount, 'a later event is allowed after the limit');
});

test('unsupported Web Audio remains a no-op and does not interrupt gameplay subscribers', async (t) => {
  const received = [];
  const removeObserver = subscribeGameAudioEvents((event) => received.push(event.type));
  const adapter = createWebAudioAdapter({ AudioContext: null, enabled: true });
  t.after(async () => {
    removeObserver();
    await adapter.dispose();
  });

  await assert.doesNotReject(adapter.unlock());
  assert.doesNotThrow(() => emitGameAudioEvent('item.placement.correct'));
  assert.deepEqual(received, ['item.placement.correct']);
});

test('a rejected context resume is non-fatal, preserves gameplay subscribers, and can retry on a later gesture', async (t) => {
  const received = [];
  const removeObserver = subscribeGameAudioEvents((event) => received.push(event.type));
  const AudioContext = createFakeAudioContextClass({ rejectedResumes: 1 });
  const adapter = createWebAudioAdapter({ AudioContext, enabled: true, minIntervalMs: 0 });
  t.after(async () => {
    removeObserver();
    await adapter.dispose();
  });

  await assert.doesNotReject(adapter.unlock());
  assert.doesNotThrow(() => emitGameAudioEvent('collection.completed'));
  assert.deepEqual(received, ['collection.completed']);
  assert.equal(startedOscillators(AudioContext).length, 0);

  await assert.doesNotReject(adapter.unlock());
  emitGameAudioEvent('puzzle.completed');
  assert.deepEqual(received, ['collection.completed', 'puzzle.completed']);
  assert.ok(startedOscillators(AudioContext).length > 0, 'a later successful unlock restores playback');
});
