import { subscribeGameAudioEvents } from './audioEvents.js';

const MAX_GAIN = 0.18;
const MAX_CUES = 6;
const SETTINGS_PREVIEW_TYPE = 'settings.preview';

// Each motif is a short sequence of notes. Gaps keep the synthesized notes
// distinct while limiting each cue to one active oscillator at a time.
const CUES = Object.freeze({
  'item.pickup': [
    { frequency: 720, duration: 0.075, waveform: 'triangle', gain: 0.08 },
  ],
  'item.drop': [
    { frequency: 340, duration: 0.11, waveform: 'triangle', gain: 0.075 },
  ],
  'item.placement.correct': [
    { frequency: 650, duration: 0.1, waveform: 'sine', gain: 0.09 },
    { frequency: 880, duration: 0.13, waveform: 'sine', gain: 0.09 },
  ],
  'item.placement.invalid': [
    { frequency: 245, duration: 0.12, waveform: 'triangle', gain: 0.09 },
    { frequency: 185, duration: 0.14, waveform: 'triangle', gain: 0.09 },
  ],
  'collection.completed': [
    { frequency: 520, duration: 0.11, waveform: 'sine', gain: 0.085 },
    { frequency: 660, duration: 0.11, waveform: 'sine', gain: 0.085 },
    { frequency: 790, duration: 0.13, waveform: 'sine', gain: 0.085 },
  ],
  'puzzle.discovered': [
    { frequency: 590, duration: 0.12, waveform: 'sine', gain: 0.08 },
    { frequency: 760, duration: 0.15, waveform: 'sine', gain: 0.08 },
  ],
  'puzzle.completed': [
    { frequency: 640, duration: 0.1, waveform: 'sine', gain: 0.09 },
    { frequency: 820, duration: 0.1, waveform: 'sine', gain: 0.09 },
    { frequency: 980, duration: 0.13, waveform: 'sine', gain: 0.09 },
  ],
  'skill.unlocked': [
    { frequency: 470, duration: 0.09, waveform: 'triangle', gain: 0.08 },
    { frequency: 620, duration: 0.09, waveform: 'triangle', gain: 0.08 },
    { frequency: 790, duration: 0.1, waveform: 'triangle', gain: 0.08 },
    { frequency: 970, duration: 0.12, waveform: 'triangle', gain: 0.08 },
  ],
  'skill.activated': [
    { frequency: 720, duration: 0.1, waveform: 'sine', gain: 0.075 },
    { frequency: 540, duration: 0.12, waveform: 'sine', gain: 0.075 },
  ],
  'machinery.stage.changed': [
    { frequency: 350, duration: 0.1, waveform: 'triangle', gain: 0.08 },
    { frequency: 440, duration: 0.1, waveform: 'triangle', gain: 0.08 },
    { frequency: 560, duration: 0.12, waveform: 'triangle', gain: 0.08 },
  ],
  'invention.assembled': [
    { frequency: 420, duration: 0.1, waveform: 'sine', gain: 0.085 },
    { frequency: 560, duration: 0.1, waveform: 'sine', gain: 0.085 },
    { frequency: 710, duration: 0.12, waveform: 'sine', gain: 0.085 },
  ],
  'invention.activated': [
    { frequency: 520, duration: 0.11, waveform: 'sine', gain: 0.1 },
    { frequency: 780, duration: 0.11, waveform: 'sine', gain: 0.1 },
    { frequency: 1040, duration: 0.11, waveform: 'sine', gain: 0.1 },
    { frequency: 1320, duration: 0.14, waveform: 'sine', gain: 0.1 },
  ],
  [SETTINGS_PREVIEW_TYPE]: [
    { frequency: 560, duration: 0.1, waveform: 'sine', gain: 0.075 },
    { frequency: 740, duration: 0.12, waveform: 'sine', gain: 0.075 },
  ],
});

function resolveAudioContextConstructor(injected) {
  if (injected !== undefined) return typeof injected === 'function' ? injected : null;

  try {
    const constructor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    return typeof constructor === 'function' ? constructor : null;
  } catch {
    return null;
  }
}

function safelyDisconnect(node) {
  try {
    node?.disconnect?.();
  } catch {
    // A node may already have been disconnected by the browser.
  }
}

function safelyClose(context) {
  try {
    const result = context?.close?.();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch {
    // Audio cleanup must not escape into the gameplay event publisher.
  }
}

/**
 * Subscribe to gameplay audio events and play bounded, synthesized cues.
 * AudioContext creation and resumption happen only through an explicit unlock().
 */
export function createWebAudioAdapter({
  AudioContext: injectedAudioContext,
  enabled = true,
  now = () => globalThis.performance?.now?.() ?? Date.now(),
  minIntervalMs = 60,
} = {}) {
  const getAudioContextConstructor = () => resolveAudioContextConstructor(injectedAudioContext);
  const minimumInterval = Number.isFinite(minIntervalMs) ? Math.max(0, minIntervalMs) : 60;
  const clock = typeof now === 'function' ? now : () => Date.now();
  const lastCueTimes = new Map();
  const activeCues = new Set();

  let isEnabled = Boolean(enabled);
  let disposed = false;
  let context = null;
  let unlockPromise = null;
  let unsubscribe = null;

  function currentTimeMs() {
    try {
      const value = clock();
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  }

  function contextTime() {
    try {
      const value = context?.currentTime;
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  }

  function removeCue(cue) {
    activeCues.delete(cue);
  }

  function releaseVoice(voice, { stop = false, stopAt = 0 } = {}) {
    if (!voice || voice.released) return;
    voice.released = true;
    try {
      voice.oscillator.onended = null;
    } catch {
      // Some browser implementations may expose a read-only event property.
    }
    if (stop && voice.started) {
      try {
        voice.oscillator.stop(stopAt);
      } catch {
        // Stopping an already ended oscillator is harmless.
      }
    }
    safelyDisconnect(voice.oscillator);
    safelyDisconnect(voice.gainNode);
    voice.cue.voices.delete(voice);
    if (voice.cue.voices.size === 0) removeCue(voice.cue);
  }

  function discardExpiredCues(timeMs) {
    for (const cue of activeCues) {
      if (cue.expiresAt <= timeMs) {
        for (const voice of [...cue.voices]) releaseVoice(voice);
      }
    }
  }

  function stopAllCues() {
    const stopAt = contextTime();
    for (const cue of [...activeCues]) {
      for (const voice of [...cue.voices]) releaseVoice(voice, { stop: true, stopAt });
      removeCue(cue);
    }
  }

  function makeCue(event) {
    try {
      playCue(event);
    } catch {
      // Optional audio failures must not escape through the gameplay event bus.
    }
  }

  function playCue(event) {
    if (disposed || !isEnabled || !context || context.state !== 'running') return false;
    const notes = CUES[event?.type];
    if (!notes) return false;

    const startedAtMs = currentTimeMs();
    discardExpiredCues(startedAtMs);

    const lastAt = lastCueTimes.get(event.type);
    if (lastAt !== undefined && startedAtMs - lastAt < minimumInterval) return false;
    if (activeCues.size >= MAX_CUES) return false;

    let offset = 0;
    const cueDuration = notes.reduce((sum, note) => sum + note.duration + 0.012, -0.012);
    const cue = {
      expiresAt: startedAtMs + cueDuration * 1000,
      voices: new Set(),
    };
    activeCues.add(cue);
    lastCueTimes.set(event.type, startedAtMs);

    for (const note of notes) {
      let oscillator = null;
      let gainNode = null;
      let voice = null;
      try {
        oscillator = context.createOscillator();
        gainNode = context.createGain();
        const startAt = contextTime() + offset;
        const endAt = startAt + note.duration;
        const peak = Math.min(MAX_GAIN, note.gain);
        oscillator.type = note.waveform;
        oscillator.frequency.setValueAtTime(note.frequency, startAt);
        gainNode.gain.setValueAtTime(0, startAt);
        gainNode.gain.linearRampToValueAtTime(peak, startAt + 0.008);
        gainNode.gain.setValueAtTime(peak, Math.max(startAt + 0.009, endAt - 0.025));
        gainNode.gain.linearRampToValueAtTime(0, endAt);
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        voice = { cue, oscillator, gainNode, started: false, released: false };
        cue.voices.add(voice);
        oscillator.onended = () => releaseVoice(voice);
        oscillator.start(startAt);
        voice.started = true;
        oscillator.stop(endAt);
        offset += note.duration + 0.012;
      } catch {
        // Release partially created nodes and leave the rest of gameplay alone.
        if (voice) {
          releaseVoice(voice, { stop: voice.started, stopAt: contextTime() });
        } else {
          safelyDisconnect(oscillator);
          safelyDisconnect(gainNode);
        }
      }
    }

    if (cue.voices.size === 0) removeCue(cue);
    return cue.voices.size > 0;
  }

  function subscribe() {
    if (!disposed && isEnabled && !unsubscribe) {
      try {
        unsubscribe = subscribeGameAudioEvents(makeCue);
      } catch {
        unsubscribe = null;
      }
    }
  }

  function unsubscribeFromEvents() {
    if (!unsubscribe) return;
    try {
      unsubscribe();
    } catch {
      // The bus cleanup is defensive; adapter state must still settle.
    }
    unsubscribe = null;
  }

  async function unlock() {
    if (disposed || !isEnabled) return false;
    if (unlockPromise) return unlockPromise;

    const unlockOperation = (async () => {
      try {
        if (context?.state === 'closed') context = null;
        if (!context) {
          const Constructor = getAudioContextConstructor();
          if (!Constructor) return false;
          context = new Constructor();
        }

        const targetContext = context;
        if (targetContext.state !== 'running') {
          if (typeof targetContext.resume !== 'function') return false;
          await targetContext.resume();
        }

        return !disposed && isEnabled && context === targetContext && targetContext.state === 'running';
      } catch {
        // Keep a created context so a later user gesture can retry resume().
        return false;
      }
    })();

    unlockPromise = unlockOperation;
    try {
      return await unlockOperation;
    } finally {
      if (unlockPromise === unlockOperation) unlockPromise = null;
    }
  }

  async function preview() {
    if (disposed || !isEnabled) return false;
    try {
      if (!await unlock()) return false;
      return playCue({ type: SETTINGS_PREVIEW_TYPE });
    } catch {
      // Preview playback is optional and must not escape into Settings or gameplay.
      return false;
    }
  }

  function closeContext() {
    if (!context) return;
    const closingContext = context;
    context = null;
    unlockPromise = null;
    safelyClose(closingContext);
  }

  function setEnabled(nextEnabled) {
    if (disposed) return;
    const shouldEnable = Boolean(nextEnabled);
    if (shouldEnable === isEnabled) return;

    isEnabled = shouldEnable;
    if (isEnabled) {
      subscribe();
      return;
    }

    unsubscribeFromEvents();
    stopAllCues();
    closeContext();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    isEnabled = false;
    unsubscribeFromEvents();
    stopAllCues();
    closeContext();
    lastCueTimes.clear();
  }

  subscribe();

  return Object.freeze({ unlock, preview, setEnabled, dispose });
}
