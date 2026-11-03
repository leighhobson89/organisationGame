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

export function CompletionSequence({ stats, onContinue, userReducedMotion = false }) {
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
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <div className={`completion-sequence${prefersReducedMotion ? ' completion-sequence--reduced-motion' : ''}`} data-testid="completion-sequence" data-motion={prefersReducedMotion ? 'reduced' : 'full'}>
      <section className="completion-sequence__dialog" role="dialog" aria-modal="true" aria-labelledby="completion-sequence-title" aria-describedby="completion-sequence-description">
        <div className="completion-sequence__projection" aria-hidden="true">
          <span className="completion-sequence__projection-ring completion-sequence__projection-ring--outer" />
          <span className="completion-sequence__projection-ring completion-sequence__projection-ring--middle" />
          <span className="completion-sequence__projection-ring completion-sequence__projection-ring--inner" />
          <span className="completion-sequence__projection-core">✧</span>
        </div>
        <div className="completion-sequence__content">
          <p className="eyebrow">The Palimpsest Engine</p>
          <h2 id="completion-sequence-title" ref={headingRef} tabIndex="-1">The laboratory is restored</h2>
          <p id="completion-sequence-description" className="completion-sequence__description">
            The Engine reads residual impressions from objects and reconstructs them as a luminous spatial replay. It replayed an impression left by the Chaos Event: the Engine was a witness, not its cause. Professor and Elian were witnesses as well.
          </p>
          <p className="completion-sequence__narrative">
            The Professor chose to keep the Engine recording through an unstable echo so their account of what they witnessed would survive. His unsent apology points to that choice.
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
