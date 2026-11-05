import React from 'react';

/** Static floor engraving for the western starting area. */
export function WorldGroundEngraving() {
  return (
    <svg
      className="world-ground-engraving"
      data-testid="world-ground-engraving"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 420 240"
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="206" cy="120" r="91" strokeWidth="1.1" />
        <circle cx="206" cy="120" r="79" strokeWidth="0.8" />
        <circle cx="206" cy="120" r="60" strokeWidth="0.9" />
        <circle cx="206" cy="120" r="42" strokeWidth="0.75" />

        <path
          d="M206 20v18m0 164v18M106 120h18m164 0h18M135.3 49.3l12.7 12.7m116 116 12.7 12.7m0-141.4L264 62m-116 116-12.7 12.7"
          strokeWidth="1.15"
        />
        <path
          d="M206 36v8m0 152v8m-76-84h8m136 0h8m-118.5-53.5 5.7 5.7m93.6 93.6 5.7 5.7m0-105-5.7 5.7m-93.6 93.6-5.7 5.7"
          strokeWidth="0.8"
        />

        <ellipse cx="206" cy="120" rx="91" ry="34" strokeWidth="0.8" transform="rotate(-28 206 120)" />
        <path d="m206 79 8.5 32.5L247 120l-32.5 8.5L206 161l-8.5-32.5L165 120l32.5-8.5z" strokeWidth="1" />
        <circle cx="206" cy="120" r="8" strokeWidth="0.9" />
        <circle cx="206" cy="120" r="2.2" fill="currentColor" stroke="none" />

        <path d="M24 53h48m-48 0 10-6m-10 6 10 6M24 187h48m-48 0 10-6m-10 6 10 6" strokeWidth="0.8" />
        <path d="M350 53h46m-46 0 9-6m-9 6 9 6M350 187h46m-46 0 9-6m-9 6 9 6" strokeWidth="0.8" />
        <path d="M45 39v28m-4-24h8m-8 20h8M375 39v28m-4-24h8m-8 20h8" strokeWidth="0.7" />

        <path d="M92 25h42m-42 0 7-4m-7 4 7 4M278 25h50m-50 0 7-4m-7 4 7 4M92 215h50m-50 0 7-4m-7 4 7 4m136-4h50m-50 0 7-4m-7 4 7 4" strokeWidth="0.7" />
        <path d="M74 120h22m220 0h26M206 9v10m0 202v10" strokeWidth="0.7" />
        <path d="M96 104v32m-4-27h8m-8 22h8m224-27v32m-4-27h8m-8 22h8" strokeWidth="0.65" />
      </g>
    </svg>
  );
}

export default WorldGroundEngraving;
