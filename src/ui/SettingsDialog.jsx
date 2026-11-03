import React, { useEffect, useRef } from 'react';

export function SettingsDialog({ preferences, saveStatus, onChange, onClose }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const focusables = () => [...(dialog?.querySelectorAll(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ) ?? [])];
    const firstControl = dialog?.querySelector('select, input, button');
    firstControl?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const elements = focusables();
      if (elements.length === 0) {
        event.preventDefault();
        dialog?.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <div
      className="settings-backdrop"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        ref={dialogRef}
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        aria-describedby="settings-description"
        data-testid="settings-dialog"
        tabIndex="-1"
      >
        <header className="settings-dialog__header">
          <div>
            <p className="eyebrow">Make the laboratory comfortable</p>
            <h2 id="settings-title">Settings</h2>
          </div>
          <button type="button" className="settings-dialog__close panel-close" aria-label="Close settings" onClick={onClose}>×</button>
        </header>

        <div className="settings-dialog__content">
          <p id="settings-description">Adjust text size, motion preferences, and optional sound effects for this laboratory.</p>

          <div className="settings-dialog__field">
            <label className="settings-dialog__label" htmlFor="settings-text-size">Text size</label>
            <select
              id="settings-text-size"
              value={String(preferences.textScale)}
              onChange={(event) => onChange({ textScale: Number(event.target.value) })}
            >
              <option value="1">100%</option>
              <option value="1.125">112.5%</option>
              <option value="1.25">125%</option>
            </select>
          </div>

          <div className="settings-dialog__field settings-dialog__field--checkbox">
            <label className="settings-dialog__label" htmlFor="settings-reduce-motion">
              <input
                id="settings-reduce-motion"
                type="checkbox"
                checked={preferences.reduceMotion}
                onChange={(event) => onChange({ reduceMotion: event.target.checked })}
              />
              Always reduce motion
            </label>
          </div>

          <div className="settings-dialog__field settings-dialog__field--checkbox settings-dialog__field--sound-effects">
            <label className="settings-dialog__label" htmlFor="settings-sound-effects">
              <input
                id="settings-sound-effects"
                type="checkbox"
                checked={preferences.soundEffectsEnabled}
                onChange={(event) => onChange({ soundEffectsEnabled: event.target.checked }, event.nativeEvent)}
              />
              Sound effects
            </label>
          </div>
        </div>

        <div className="settings-dialog__actions">
          <p className="settings-dialog__status" role="status" aria-live="polite" data-testid="settings-status">{saveStatus}</p>
          <button type="button" className="primary-control" onClick={onClose}>Done</button>
        </div>
      </section>
    </div>
  );
}
