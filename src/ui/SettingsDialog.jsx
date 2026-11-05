import React, { useEffect, useRef, useState } from 'react';
import { containModalTabFocus } from './modalFocus.js';

export function SettingsDialog({ preferences, saveStatus, onChange, onPreviewSound, onClose }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const [previewStatus, setPreviewStatus] = useState('');

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const firstControl = dialog?.querySelector('select, input');
    firstControl?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      containModalTabFocus(event, dialog);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    const content = dialog?.querySelector('.settings-dialog__content');
    const firstPreferenceField = dialog?.querySelector('select, input');
    if (!content || !firstPreferenceField || document.activeElement !== firstPreferenceField) return;

    const contentRect = content.getBoundingClientRect();
    const visibleTop = contentRect.top + content.clientTop;
    const visibleBottom = visibleTop + content.clientHeight;
    const fieldRect = firstPreferenceField.getBoundingClientRect();

    if (fieldRect.top < visibleTop) {
      content.scrollTop -= visibleTop - fieldRect.top;
    } else if (fieldRect.bottom > visibleBottom) {
      content.scrollTop += fieldRect.bottom - visibleBottom;
    }
  }, [preferences.textScale]);

  const handlePreviewSound = async (event) => {
    if (!preferences.soundEffectsEnabled) return;
    try {
      const didPlay = await onPreviewSound?.(event.nativeEvent);
      setPreviewStatus(didPlay ? 'Preview played' : 'Preview could not be played');
    } catch {
      setPreviewStatus('Preview could not be played');
    }
  };

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
              <option value="1.5">150%</option>
              <option value="1.75">175%</option>
              <option value="2">200%</option>
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
                onChange={(event) => {
                  setPreviewStatus('');
                  onChange({ soundEffectsEnabled: event.target.checked }, event.nativeEvent);
                }}
              />
              Sound effects
            </label>
          </div>

          <div className="settings-dialog__preview">
            <p id="settings-audio-preview-description" className="settings-dialog__description">
              Short synthesized cues play for actions and discoveries.
            </p>
            <button
              type="button"
              className="settings-dialog__preview-button"
              aria-describedby="settings-audio-preview-description"
              disabled={!preferences.soundEffectsEnabled}
              onClick={handlePreviewSound}
            >
              Preview sound
            </button>
            <p className="settings-dialog__preview-status" role="status" aria-live="polite" aria-label="Audio preview status" data-testid="audio-preview-status">
              {previewStatus}
            </p>
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
