import React, { useEffect, useRef, useState } from 'react';
import { containModalTabFocus } from './modalFocus.js';

function useReducedMotionPreference(userReducedMotion) {
  const [osReducedMotion, setOsReducedMotion] = useState(() => (
    typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = (event) => setOsReducedMotion(event.matches);
    setOsReducedMotion(preference.matches);
    if (preference.addEventListener) preference.addEventListener('change', updatePreference);
    else preference.addListener?.(updatePreference);
    return () => {
      if (preference.removeEventListener) preference.removeEventListener('change', updatePreference);
      else preference.removeListener?.(updatePreference);
    };
  }, []);

  return Boolean(userReducedMotion || osReducedMotion);
}

export function CompletionSequence({
  stats,
  onContinue,
  onReturnFocusFallback,
  userReducedMotion = false,
}) {
  const headingRef = useRef(null);
  const prefersReducedMotion = useReducedMotionPreference(userReducedMotion);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = headingRef.current?.closest('[role="dialog"]');
    const focusFrame = window.requestAnimationFrame(() => headingRef.current?.focus());
    const onKeyDown = (event) => {
      containModalTabFocus(event, dialog, {
        focusFallback: headingRef.current,
        initialFocus: headingRef.current,
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKeyDown);
      const isDocumentFallback = previousFocus === document.body
        || previousFocus === document.documentElement;
      if (!isDocumentFallback && previousFocus?.isConnected && typeof previousFocus.focus === 'function') {
        previousFocus.focus();
        if (document.activeElement === previousFocus) return;
      }
      onReturnFocusFallback?.();
    };
  }, [onReturnFocusFallback]);

  return (
    <div className={`completion-sequence${prefersReducedMotion ? ' completion-sequence--reduced-motion' : ''}`} data-testid="completion-sequence" data-motion={prefersReducedMotion ? 'reduced' : 'full'}>
      <section className="completion-sequence__dialog" role="dialog" aria-modal="true" aria-labelledby="completion-sequence-title" aria-describedby="completion-sequence-description">
        <div className="completion-sequence__projection" aria-hidden="true">
          <span className="completion-sequence__projection-ring completion-sequence__projection-ring--outer" />
          <span className="completion-sequence__projection-ring completion-sequence__projection-ring--middle" />
          <span className="completion-sequence__projection-ring completion-sequence__projection-ring--inner" />
          <svg className="completion-sequence__projection-trace" viewBox="0 0 280 280" focusable="false" aria-hidden="true">
            <path pathLength="1" d="M38 151 C52 128 65 116 81 118 C99 120 103 144 121 146 C142 148 150 121 165 108 C181 94 201 98 215 117 C231 139 235 161 221 174 C207 187 189 171 177 159 C164 146 150 148 137 162 C123 177 114 195 96 198 C73 202 52 181 38 151 Z" />
          </svg>
          <span className="completion-sequence__projection-core">✧</span>
        </div>
        <div className="completion-sequence__content">
          <p className="eyebrow">The Palimpsest Engine</p>
          <h2 id="completion-sequence-title" ref={headingRef} tabIndex="-1">The laboratory is restored</h2>
          <p id="completion-sequence-description" className="completion-sequence__description">
            The Engine reads residual impressions from objects and reconstructs them as a luminous spatial replay. It replayed an impression left by the Chaos Event: the Engine was a witness, not its cause. Professor and Elian were witnesses as well.
          </p>
          <p className="completion-sequence__narrative">
            Unsent Apology: the Professor feared Elian would blame the machine for his choice. Clearest reading of his choice: he followed the first stable impression via the eastward survey to the sealed bell chamber. Records do not directly name that choice or establish whether it caused the Chaos Event.
          </p>
          <p className="completion-sequence__uncertainty">
            The recovered records do not establish what began the Chaos Event, and they leave Elian's response unresolved.
          </p>
          <p className="completion-sequence__status" role="status" aria-live="polite">
            Congratulations! Every catalogued object is filed, every collection is complete, and every puzzle is solved.
          </p>

          <dl className="completion-sequence__stats" aria-label="Completion statistics">
            <div className="completion-sequence__stat">
              <dt>Objects restored</dt>
              <dd data-testid="completion-stat-items">{stats.restoredItemCount} of {stats.totalItemCount}</dd>
            </div>
            <div className="completion-sequence__stat">
              <dt>Restoration</dt>
              <dd data-testid="completion-stat-percent">{stats.restorationPercent}%</dd>
            </div>
            <div className="completion-sequence__stat">
              <dt>Collections completed</dt>
              <dd data-testid="completion-stat-collections">{stats.completedCollectionCount} of {stats.totalCollectionCount}</dd>
            </div>
            <div className="completion-sequence__stat">
              <dt>Puzzles solved</dt>
              <dd data-testid="completion-stat-puzzles">{stats.solvedPuzzleCount} of {stats.totalPuzzleCount}</dd>
            </div>
            <div className="completion-sequence__stat">
              <dt>Notebook discoveries</dt>
              <dd data-testid="completion-stat-discoveries">{stats.notebookDiscoveryCount}</dd>
            </div>
            <div className="completion-sequence__stat">
              <dt>Owned skills</dt>
              <dd data-testid="completion-stat-skills">{stats.ownedSkillCount}</dd>
            </div>
          </dl>

          <button type="button" className="primary-control completion-sequence__continue" onClick={onContinue}>
            Continue exploring
          </button>
        </div>
      </section>
    </div>
  );
}
