import { encodeSave } from './save.js';

self.addEventListener('message', (event) => {
  const { requestId, revision, state } = event.data ?? {};
  try {
    self.postMessage({ requestId, revision, encodedSave: encodeSave(state) });
  } catch (error) {
    self.postMessage({
      requestId,
      revision,
      error: error instanceof Error ? error.message : 'The save could not be encoded.',
    });
  }
});
