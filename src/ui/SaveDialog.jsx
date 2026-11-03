import React, { useEffect, useRef, useState } from 'react';
import { containModalTabFocus, getModalFocusableElements } from './modalFocus.js';
import {
  deleteManualSaveSlot,
  readManualSaveSlots,
  saveManualSaveSlot,
} from '../game/persistence/manualSaves.js';

const MANUAL_SLOT_IDS = [1, 2, 3];

function readSlotsSafely() {
  try {
    return readManualSaveSlots().slots;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Browser storage is unavailable.';
    return MANUAL_SLOT_IDS.map((slotId) => ({ slotId, status: 'unavailable', error: message }));
  }
}

function formatSavedAt(savedAt) {
  if (!savedAt) return null;
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(savedAt));
  } catch {
    return savedAt;
  }
}

function slotStatusText(slot) {
  if (slot.status === 'empty') return 'Empty — no snapshot saved.';
  if (slot.status === 'corrupt') return `Damaged save — ${slot.error || 'This snapshot could not be read.'}`;
  if (slot.status === 'unavailable') return `Slot unavailable — ${slot.error || 'Browser storage could not be read.'}`;
  if (slot.legacy) return 'Saved; date unknown (older local snapshot).';
  return 'Saved snapshot.';
}

function isStored(slot) {
  return slot.status === 'saved' || slot.status === 'corrupt';
}

export function SaveDialog({ encodedSave, saveStatus, onClose, onImport }) {
  const [importText, setImportText] = useState('');
  const [replaceAcknowledged, setReplaceAcknowledged] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [slots, setSlots] = useState(readSlotsSafely);
  const [pendingAction, setPendingAction] = useState(null);
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const pendingActionRef = useRef(pendingAction);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!pendingAction) return undefined;
    const focusFrame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector('.manual-save-slot__confirmation button:not(:disabled)')?.focus();
    });
    return () => cancelAnimationFrame(focusFrame);
  }, [pendingAction]);

  const beginPendingAction = (type, slotId, triggerAction) => {
    const nextAction = { type, slotId, triggerAction };
    pendingActionRef.current = nextAction;
    setPendingAction(nextAction);
  };

  const clearPendingAction = () => {
    pendingActionRef.current = null;
    setPendingAction(null);
  };

  const focusSlotAction = (slotId, action) => {
    requestAnimationFrame(() => {
      const actionButton = document.getElementById(`manual-save-slot-${slotId}-${action}`);
      if (actionButton && !actionButton.disabled) {
        actionButton.focus();
        return;
      }
      dialogRef.current?.querySelector('button:not(:disabled)')?.focus();
    });
  };

  const cancelPendingAction = () => {
    const { slotId, triggerAction } = pendingActionRef.current ?? {};
    clearPendingAction();
    if (slotId) focusSlotAction(slotId, triggerAction || 'overwrite');
  };

  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    getModalFocusableElements(dialog)[0]?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (pendingActionRef.current) {
          cancelPendingAction();
          return;
        }
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

  const refreshSlots = () => setSlots(readSlotsSafely());

  const saveToSlot = (slot) => {
    const result = saveManualSaveSlot(undefined, slot.slotId, encodedSave, {
      now: () => new Date(),
    });
    if (result.status === 'saved') {
      refreshSlots();
      setFeedback(`A snapshot was saved to Slot ${slot.slotId}.`);
    } else if (result.status === 'confirmation-required') {
      beginPendingAction('overwrite', slot.slotId, 'save');
    } else {
      setFeedback(result.error || 'This snapshot could not be saved in browser storage.');
      refreshSlots();
    }
  };

  const confirmOverwrite = (slot) => {
    const result = saveManualSaveSlot(undefined, slot.slotId, encodedSave, {
      overwriteConfirmed: true,
      now: () => new Date(),
    });
    clearPendingAction();
    focusSlotAction(slot.slotId, 'overwrite');
    if (result.status === 'saved') {
      setFeedback(`Slot ${slot.slotId} was overwritten with the current snapshot.`);
    } else {
      setFeedback(result.error || 'The saved snapshot could not be overwritten.');
    }
    refreshSlots();
  };

  const confirmDelete = (slot) => {
    const result = deleteManualSaveSlot(undefined, slot.slotId, { confirmed: true });
    clearPendingAction();
    focusSlotAction(slot.slotId, result.status === 'deleted' ? 'save' : 'delete');
    if (result.status === 'deleted') {
      setFeedback(`The snapshot in Slot ${slot.slotId} was deleted.`);
    } else {
      setFeedback(result.error || 'The snapshot could not be deleted from browser storage.');
    }
    refreshSlots();
  };

  const confirmRestore = (slot) => {
    if (slot.status !== 'saved' || !slot.encodedSave) {
      clearPendingAction();
      focusSlotAction(slot.slotId, 'restore');
      setFeedback('This slot is damaged or unavailable and cannot be restored.');
      return;
    }

    const result = onImport(slot.encodedSave);
    clearPendingAction();
    focusSlotAction(slot.slotId, 'restore');
    if (result?.ok) {
      setFeedback(`Slot ${slot.slotId} restored. Your previous progress was backed up.`);
    } else {
      setFeedback(result?.error ?? 'That snapshot could not be restored. Your current progress is unchanged.');
    }
    refreshSlots();
  };

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(encodedSave);
      setFeedback('Compressed save copied to the clipboard.');
    } catch {
      setFeedback('Select the save string below and copy it.');
    }
  };

  const submitImport = () => {
    if (!replaceAcknowledged) return;
    const result = onImport(importText.trim());
    if (result?.ok) {
      setFeedback('Save imported. Your previous progress was backed up.');
      setImportText('');
      setReplaceAcknowledged(false);
    } else {
      setFeedback(result?.error ?? 'That save could not be imported. Your current progress is unchanged.');
    }
  };

  const confirmationFor = (slot) => {
    if (pendingAction?.slotId !== slot.slotId) return null;

    const cancel = cancelPendingAction;
    if (pendingAction.type === 'overwrite') {
      return (
        <div className="manual-save-slot__confirmation" role="group" aria-label={`Confirm overwrite Slot ${slot.slotId}`}>
          <p>Replace the snapshot currently stored in Slot {slot.slotId}?</p>
          <button type="button" className="primary-control" onClick={() => confirmOverwrite(slot)}>
            Confirm overwrite Slot {slot.slotId}
          </button>
          <button type="button" className="text-control" onClick={cancel}>Cancel</button>
        </div>
      );
    }

    if (pendingAction.type === 'delete') {
      return (
        <div className="manual-save-slot__confirmation" role="group" aria-label={`Confirm delete Slot ${slot.slotId}`}>
          <p>Delete the saved snapshot in Slot {slot.slotId}?</p>
          <button type="button" className="primary-control" onClick={() => confirmDelete(slot)}>
            Confirm delete Slot {slot.slotId}
          </button>
          <button type="button" className="text-control" onClick={cancel}>Cancel</button>
        </div>
      );
    }

    return (
      <div className="manual-save-slot__confirmation" role="group" aria-label={`Confirm restore to Slot ${slot.slotId}`}>
        <p>Replace current progress with the snapshot in Slot {slot.slotId}? Your current game will be backed up first.</p>
        <button type="button" className="primary-control" onClick={() => confirmRestore(slot)}>
          Confirm restore to Slot {slot.slotId}
        </button>
        <button type="button" className="text-control" onClick={cancel}>Cancel</button>
      </div>
    );
  };

  const renderSlot = (slot) => {
    const slotNumber = slot.slotId;
    const headingId = `manual-save-slot-${slotNumber}-title`;
    const occupied = isStored(slot);
    const pending = pendingAction?.slotId === slotNumber;

    return (
      <section className="manual-save-slot" role="region" aria-labelledby={headingId} key={slotNumber}>
        <h3 id={headingId}>Slot {slotNumber}</h3>
        <p className="manual-save-slot__status" data-status={slot.status} role={slot.status === 'corrupt' || slot.status === 'unavailable' ? 'alert' : 'status'}>
          {slotStatusText(slot)}
        </p>
        <div className="manual-save-slot__meta">
          {slot.status === 'saved' && !slot.legacy && slot.savedAt && <time dateTime={slot.savedAt}>{formatSavedAt(slot.savedAt)}</time>}
          {slot.legacy && <span>Older local snapshot</span>}
        </div>
        <div className="manual-save-slot__actions">
          {!occupied && slot.status === 'empty' && (
            <button
              type="button"
              id={`manual-save-slot-${slotNumber}-save`}
              data-slot-action="save"
              className="primary-control"
              disabled={!encodedSave}
              onClick={() => saveToSlot(slot)}
            >
              Save to Slot {slotNumber}
            </button>
          )}
          {occupied && (
            <>
              <button
                type="button"
                id={`manual-save-slot-${slotNumber}-overwrite`}
                data-slot-action="overwrite"
                className="primary-control"
                disabled={!encodedSave || pending}
                onClick={() => beginPendingAction('overwrite', slotNumber, 'overwrite')}
              >
                Overwrite Slot {slotNumber}
              </button>
              {slot.status === 'saved' && (
                <button
                  type="button"
                  id={`manual-save-slot-${slotNumber}-restore`}
                  data-slot-action="restore"
                  className="primary-control"
                  disabled={pending}
                  onClick={() => beginPendingAction('restore', slotNumber, 'restore')}
                >
                  Restore Slot {slotNumber}
                </button>
              )}
              <button
                type="button"
                id={`manual-save-slot-${slotNumber}-delete`}
                data-slot-action="delete"
                className="text-control"
                disabled={pending}
                onClick={() => beginPendingAction('delete', slotNumber, 'delete')}
              >
                Delete Slot {slotNumber}
              </button>
            </>
          )}
        </div>
        {confirmationFor(slot)}
      </section>
    );
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="save-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="save-dialog-title" data-testid="save-dialog" tabIndex="-1">
        <header className="panel-heading">
          <div><p className="eyebrow">Keep your discoveries</p><h2 id="save-dialog-title">Save &amp; Restore</h2></div>
          <button type="button" className="panel-close" aria-label="Close save dialog" onClick={onClose}>×</button>
        </header>
        <p className="save-status-line" role="status">Autosave: {saveStatus}</p>

        <section className="save-section">
          <h3>Export your laboratory</h3>
          <p>Copy this compressed string to keep a portable backup of your discoveries.</p>
          <textarea className="save-string" aria-label="Compressed save string" readOnly value={encodedSave} onFocus={(event) => event.target.select()} data-testid="save-export-string" />
          <div className="save-actions">
            <button type="button" className="primary-control" data-testid="copy-save" onClick={copyExport}>Copy compressed save</button>
          </div>
        </section>

        <section className="save-section" aria-labelledby="manual-save-slots-title">
          <h3 id="manual-save-slots-title">Manual save slots</h3>
          <p>Keep up to three local snapshots. Restoring one checks it first and backs up your current laboratory.</p>
          <div className="manual-save-slots">
            {slots.map(renderSlot)}
          </div>
        </section>

        <section className="save-section import-section">
          <h3>Restore a laboratory</h3>
          <p>Paste a compressed save string. It is checked before use, and the current autosave is backed up first.</p>
          <label htmlFor="save-import">Compressed save string</label>
          <textarea id="save-import" className="save-string" value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="Paste an exported save here" data-testid="save-import-string" />
          <label className="replace-confirmation">
            <input type="checkbox" checked={replaceAcknowledged} onChange={(event) => setReplaceAcknowledged(event.target.checked)} />
            I understand a valid import replaces the current laboratory.
          </label>
          <button type="button" className="primary-control" data-testid="import-save" disabled={!importText.trim() || !replaceAcknowledged} onClick={submitImport}>Validate &amp; import save</button>
        </section>
        {feedback && <p className="save-feedback" role="status" data-testid="save-feedback">{feedback}</p>}
        <p className="save-safety-note">A malformed or unsupported save will not change your current progress.</p>
      </section>
    </div>
  );
}
