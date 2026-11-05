import React, { useEffect, useMemo, useRef, useState } from 'react';

function choiceValue(choice) {
  if (choice && typeof choice === 'object') return choice.id ?? choice.value ?? choice.glyph ?? choice.label ?? String(choice);
  return String(choice);
}

function choiceLabel(choice) {
  if (choice && typeof choice === 'object') return choice.label ?? choice.title ?? choice.glyph ?? choice.value ?? choice.id ?? '?';
  return String(choice);
}

export function PuzzlePanel({ puzzle, solved, onSolve, onClose, onSelectPuzzle, unlockedPuzzles = [] }) {
  const isChronology = Array.isArray(puzzle.events);
  const choices = useMemo(() => (isChronology ? puzzle.events : (puzzle.symbols ?? puzzle.choices ?? [])).slice(), [isChronology, puzzle]);
  const solution = useMemo(() => (puzzle.solution ?? []).map(choiceValue), [puzzle]);
  const [sequence, setSequence] = useState([]);
  const [result, setResult] = useState('');
  const headingRef = useRef(null);
  const firstChoiceRef = useRef(null);
  const panelTestId = isChronology ? 'chronology-puzzle-panel' : 'puzzle-panel';
  const submitLabel = isChronology ? 'Submit chronology' : 'Submit sequence';

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const firstChoice = firstChoiceRef.current;
      if (firstChoice && !firstChoice.disabled) firstChoice.focus();
      else headingRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    setSequence([]);
    setResult('');
  }, [puzzle.id, solution.length]);

  const choose = (choice) => {
    if (solved) return;
    const value = choiceValue(choice);
    setSequence((current) => current.length < solution.length ? [...current, value] : current);
    setResult('');
  };

  const submit = () => {
    const correct = sequence.length === solution.length && sequence.every((value, index) => value === solution[index]);
    if (correct) {
      setResult(puzzle.successMessage ?? (isChronology
        ? 'The dates align. The Chronology Wheel locks into the Engine.'
        : 'The sequence aligns. A memory crystal forms in the engine.'));
      onSolve(puzzle.id);
    } else {
      setResult(puzzle.retryMessage ?? (isChronology
        ? 'The events still contradict one another. Recheck the dates in your notebook.'
        : 'The pulses fall out of sequence. The notebook’s clue may help.'));
    }
  };

  const sequenceLabel = isChronology ? 'Entered event order' : 'Entered pulse sequence';
  const choiceGroupLabel = isChronology ? 'Choose an event' : 'Choose a pulse glyph';

  return (
    <aside className="panel puzzle-panel" aria-label={puzzle.title ?? 'Laboratory puzzle'} data-testid={panelTestId}>
      <header className="panel-heading">
        <div><p className="eyebrow">{isChronology ? 'Recovered timeline' : 'Recovered pattern'}</p><h2 ref={headingRef} tabIndex={-1}>{puzzle.title ?? 'Laboratory puzzle'}</h2></div>
        <button type="button" className="panel-close" aria-label="Close puzzle panel" onClick={onClose}>×</button>
      </header>
      {unlockedPuzzles.length > 1 && onSelectPuzzle && (
        <label className="puzzle-picker-label">
          Opened puzzles
          <select
            aria-label="Choose unlocked puzzle"
            data-testid="choose-unlocked-puzzle"
            value={puzzle.id}
            onChange={(event) => onSelectPuzzle(event.target.value)}
          >
            {unlockedPuzzles.map((entry) => <option key={entry.id} value={entry.id}>{entry.title ?? entry.id}</option>)}
          </select>
        </label>
      )}
      <p className="puzzle-clue">{puzzle.prompt ?? 'Arrange the recovered clues in their recorded order.'}</p>
      {solved ? (
        <div className="puzzle-solved" role="status" data-testid="puzzle-result">
          <span aria-hidden="true">✧</span>
          <p>{result || puzzle.successMessage || (isChronology
            ? 'The dates align. The Chronology Wheel locks into the Engine.'
            : 'The sequence aligns. A memory crystal forms in the engine.')}</p>
        </div>
      ) : (
        <>
          <div className="puzzle-sequence" role="group" aria-label={sequenceLabel} aria-live="polite" aria-atomic="true">
            {Array.from({ length: solution.length }, (_, index) => {
              const value = sequence[index];
              const selectedChoice = choices.find((entry) => choiceValue(entry) === value);
              return (
                <span key={index} className="puzzle-slot" aria-label={`${isChronology ? 'Event' : 'Pulse'} slot ${index + 1}: ${value ? choiceLabel(selectedChoice ?? value) : 'empty'}`}>
                  {value ? choiceLabel(selectedChoice ?? value) : '·'}
                </span>
              );
            })}
          </div>
          <div className="puzzle-symbols" role="group" aria-label={choiceGroupLabel}>
            {choices.map((choice, index) => {
              const id = choiceValue(choice);
              const evidenceId = isChronology && choice.evidence ? `chronology-evidence-${id}` : undefined;
              return (
                <button
                  key={`${id}-${index}`}
                  type="button"
                  className={`puzzle-symbol${isChronology ? ' puzzle-event' : ''}`}
                  data-testid={isChronology ? `chronology-event-${id}` : `puzzle-symbol-${index}`}
                  ref={index === 0 ? firstChoiceRef : undefined}
                  aria-label={isChronology ? choiceLabel(choice) : `Pulse glyph ${choiceLabel(choice)}`}
                  aria-describedby={evidenceId}
                  disabled={sequence.length >= solution.length}
                  onClick={() => choose(choice)}
                >
                  {choiceLabel(choice)}
                  {isChronology && choice.evidence && <small id={evidenceId} className="puzzle-event-evidence">{choice.evidence}</small>}
                </button>
              );
            })}
          </div>
          <div className="puzzle-actions">
            <button type="button" className="text-control" onClick={() => { setSequence((current) => current.slice(0, -1)); setResult(''); }}>Undo last {isChronology ? 'event' : 'glyph'}</button>
            <button type="button" className="text-control" onClick={() => { setSequence([]); setResult(''); }}>Clear {isChronology ? 'timeline' : 'sequence'}</button>
            <button type="button" className="primary-control" onClick={submit} disabled={sequence.length !== solution.length}>{submitLabel}</button>
          </div>
          {result && <p className="puzzle-feedback" role="status" data-testid="puzzle-result">{result}</p>}
        </>
      )}
    </aside>
  );
}
