import React, { useEffect, useRef } from 'react';
import { containModalTabFocus } from './modalFocus.js';

export function HowToPlayDialog({ onClose, onBeginFirstTask }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.querySelector('[data-testid="begin-first-task"]')?.focus();

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

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section
        className="save-dialog how-to-play-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-to-play-title"
        aria-describedby="how-to-play-intro"
        data-testid="how-to-play-dialog"
        tabIndex="-1"
      >
        <header className="panel-heading">
          <div><p className="eyebrow">First shift field guide</p><h2 id="how-to-play-title">How to Play</h2></div>
          <button type="button" className="panel-close" aria-label="Close How to Play" onClick={onClose}>×</button>
        </header>
        <p id="how-to-play-intro">Restore the laboratory by reading its scraps and matching them to their final containers.</p>
        <ol className="how-to-play-steps">
          <li><strong>Select and inspect.</strong> Click or tap a scrap, or focus it and press Enter. The Inspector shows its title, type, series, and clue.</li>
          <li><strong>Match the evidence.</strong> A scrap's series and clue point to a named collection or container. For example, the tuning plates marked <em>Harmonic Calibration</em> belong in the <em>Harmonic Calibration Folio</em>.</li>
          <li><strong>File it.</strong> Drag a scrap into its container, or select it and use <strong>Move item</strong>. Container slots fill automatically; filing order does not matter. Scratch pads are temporary work surfaces.</li>
          <li><strong>Solve puzzles separately.</strong> A puzzle will tell you when to arrange a sequence. The order of items inside their collection containers does not solve a puzzle.</li>
          <li><strong>Follow your progress.</strong> Restoration appears in the header. The Notebook tracks collections and discoveries; progress autosaves. Save &amp; Restore holds manual snapshots, imports, and Start Over.</li>
          <li><strong>Navigate the lab.</strong> Drag empty space to pan and use the wheel or toolbar to zoom. On touch screens, drag to pan and pinch to zoom.</li>
        </ol>
        <section className="how-to-play-first-task" aria-labelledby="how-to-play-first-task-title">
          <h3 id="how-to-play-first-task-title">Your first task</h3>
          <p>Find the <strong>Carrier Tone Plate</strong>, read its clue and series in the Inspector, then file it in the matching Harmonic Calibration Folio.</p>
          <div className="save-actions">
            <button type="button" className="primary-control" data-testid="begin-first-task" onClick={onBeginFirstTask}>Find the first tuning plate</button>
            <button type="button" className="text-control" onClick={onClose}>Close guide</button>
          </div>
        </section>
      </section>
    </div>
  );
}
