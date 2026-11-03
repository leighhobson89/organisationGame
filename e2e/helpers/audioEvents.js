export async function observeAudioEvents(page) {
  await page.evaluate(async () => {
    const { subscribeGameAudioEvents } = await import('/src/game/audio/audioEvents.js');
    window.__gameAudioEventLog = [];
    window.__unsubscribeGameAudioEvents?.();
    window.__unsubscribeGameAudioEvents = subscribeGameAudioEvents((event) => {
      window.__gameAudioEventLog.push(event);
    });
  });
}

export async function readAudioEventTypes(page) {
  return page.evaluate(() => (window.__gameAudioEventLog ?? []).map((event) => event.type));
}
