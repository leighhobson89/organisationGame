import { AUTO_SAVE_KEY } from './loadGame.js';

const DEFAULT_DEBOUNCE_MS = 450;
const SAVING_STATUS = 'Saving…';
const SAVED_STATUS = 'Saved just now';
const UNAVAILABLE_STATUS = 'Autosave unavailable';

/** Debounce worker encoding and commit only the newest successful result on the main thread. */
export function createAutosaveCoordinator({
  worker,
  storage,
  autoSaveKey = AUTO_SAVE_KEY,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  setTimeout: scheduleTimeout = globalThis.setTimeout,
  clearTimeout: cancelTimeout = globalThis.clearTimeout,
  onStatus = () => {},
} = {}) {
  let revision = 0;
  let requestSequence = 0;
  let latestRequestId = null;
  let debounceTimer = null;
  let workerAvailable = Boolean(worker);
  let disposed = false;
  const pendingRequests = new Map();

  const reportStatus = (status) => {
    try { onStatus(status); } catch { /* Status reporting must not interrupt save safety. */ }
  };

  const clearDebounce = () => {
    if (debounceTimer === null) return;
    cancelTimeout(debounceTimer);
    debounceTimer = null;
  };

  const markUnavailable = () => {
    workerAvailable = false;
    latestRequestId = null;
    pendingRequests.clear();
    clearDebounce();
    reportStatus(UNAVAILABLE_STATUS);
  };

  const onWorkerMessage = (event) => {
    if (disposed) return;
    const message = event?.data;
    const request = pendingRequests.get(message?.requestId);
    if (!request) return;
    pendingRequests.delete(message.requestId);

    if (request.revision !== revision || request.requestId !== latestRequestId) return;
    if (message.error || typeof message.encodedSave !== 'string' || message.encodedSave.length === 0) {
      markUnavailable();
      return;
    }

    try {
      if (!storage || typeof storage.setItem !== 'function') throw new Error('Browser storage is unavailable.');
      storage.setItem(autoSaveKey, message.encodedSave);
      reportStatus(SAVED_STATUS);
    } catch {
      markUnavailable();
    }
  };

  const onWorkerError = (event) => {
    event?.preventDefault?.();
    if (!disposed) markUnavailable();
  };

  if (workerAvailable) {
    if (typeof worker.addEventListener === 'function') {
      worker.addEventListener('message', onWorkerMessage);
      worker.addEventListener('error', onWorkerError);
    } else {
      const previousMessageHandler = worker.onmessage;
      const previousErrorHandler = worker.onerror;
      worker.onmessage = (event) => {
        previousMessageHandler?.call(worker, event);
        onWorkerMessage(event);
      };
      worker.onerror = (event) => {
        previousErrorHandler?.call(worker, event);
        onWorkerError(event);
      };
    }
  }

  const coordinator = {
    schedule(state) {
      if (disposed) return;
      revision += 1;
      latestRequestId = null;
      pendingRequests.clear();
      clearDebounce();

      if (!workerAvailable) {
        reportStatus(UNAVAILABLE_STATUS);
        return;
      }

      const scheduledRevision = revision;
      reportStatus(SAVING_STATUS);
      try {
        debounceTimer = scheduleTimeout(() => {
          debounceTimer = null;
          if (disposed || !workerAvailable || scheduledRevision !== revision) return;

          const requestId = ++requestSequence;
          latestRequestId = requestId;
          pendingRequests.set(requestId, { requestId, revision: scheduledRevision });
          try {
            worker.postMessage({ requestId, revision: scheduledRevision, state });
          } catch {
            markUnavailable();
          }
        }, debounceMs);
      } catch {
        markUnavailable();
      }
    },

    invalidate() {
      if (disposed) return;
      revision += 1;
      latestRequestId = null;
      pendingRequests.clear();
      clearDebounce();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      revision += 1;
      latestRequestId = null;
      pendingRequests.clear();
      clearDebounce();
      if (typeof worker?.removeEventListener === 'function') {
        worker.removeEventListener('message', onWorkerMessage);
        worker.removeEventListener('error', onWorkerError);
      }
      try { worker?.terminate?.(); } catch { /* Disposal should stay safe during unmount. */ }
    },
  };

  return coordinator;
}
