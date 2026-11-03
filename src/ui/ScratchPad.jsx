import React from 'react';

export function ScratchPad({ pad, itemCount, onFocus }) {
  return (
    <section
      className="scratch-pad"
      style={{
        left: pad.position?.x ?? 0,
        top: pad.position?.y ?? 0,
        width: pad.width ?? 360,
        height: pad.height ?? 230,
      }}
      data-testid={`scratch-${pad.id}`}
      data-drop-kind="scratchpad"
      data-drop-id={pad.id}
      role="region"
      aria-roledescription="temporary drop workspace"
      aria-label={`${pad.label}. Temporary work surface. ${itemCount} of ${pad.capacity} spaces used. Dropping here does not validate a final placement.`}
    >
      <header className="scratch-pad-header">
        <span aria-hidden="true">▱</span>
        <div>
          <h3>{pad.label}</h3>
          <p>Temporary work surface · {itemCount} / {pad.capacity} spaces</p>
        </div>
        <button type="button" className="hud-control" onClick={() => onFocus(pad)}>
          Focus
        </button>
      </header>
    </section>
  );
}
