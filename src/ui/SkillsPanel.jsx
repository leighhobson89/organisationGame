import React from 'react';
import { SKILLS } from '../game/content/catalog.js';

export function SkillsPanel({
  progress,
  activeSkillIds = [],
  canUseSkills = {},
  onPurchaseSkill,
  onToggleSkill,
}) {
  const points = progress.skillPoints ?? 0;
  const ownedSkills = new Set(progress.ownedSkills ?? []);
  const activeSkills = new Set(activeSkillIds);

  return (
    <aside className="panel skills-panel" aria-label="Professor's instruments" data-testid="skills-panel">
      <header className="panel-heading">
        <div><p className="eyebrow">Analytical instruments</p><h2>Workshop Skills</h2></div>
        <span className="skill-points"><strong>{points}</strong><small>insight {points === 1 ? 'point' : 'points'}</small></span>
      </header>
      <div className="skill-list">
        {SKILLS.map((skill) => {
          const owned = ownedSkills.has(skill.id);
          const active = activeSkills.has(skill.id);
          const canUse = canUseSkills[skill.id] ?? false;
          const isLens = skill.id === 'resonance-lens';
          const isCompass = skill.id === 'missing-member-compass';
          const actionName = skill.id;
          const activateLabel = skill.activateLabel ?? (isLens
            ? 'Activate lens'
            : isCompass ? 'Activate compass' : `Activate ${skill.label}`);
          const activeLabel = skill.activeLabel ?? (isLens
            ? 'Lens active'
            : isCompass ? 'Compass active' : `${skill.label} active`);
          const purchaseLabel = skill.purchaseLabel ?? (isLens
            ? `Build lens · ${skill.cost} point${skill.cost === 1 ? '' : 's'}`
            : isCompass
              ? `Build compass · ${skill.cost} point${skill.cost === 1 ? '' : 's'}`
              : `Build ${skill.label} · ${skill.cost} point${skill.cost === 1 ? '' : 's'}`);

          return (
            <article key={skill.id} className={`skill-card${owned ? ' is-owned' : ''}`} data-testid={`skill-${skill.id}`}>
              <div className="skill-icon" aria-hidden="true">{skill.mark ?? skill.icon ?? '✦'}</div>
              <div className="skill-copy">
                <p className="eyebrow">{skill.kind ?? 'Analytical tool'} · {skill.cost} {skill.cost === 1 ? 'point' : 'points'}</p>
                <h3>{skill.label}</h3>
                <p>{skill.description}</p>
              </div>
              {owned ? skill.passive ? (
                <small className="skill-selection-hint" role="status">{skill.ownedStatus ?? 'Installed'}</small>
              ) : (
                <>
                  <button
                    type="button"
                    className={`primary-control${active ? ' is-active' : ''}`}
                    data-testid={`toggle-${actionName}`}
                    aria-pressed={active}
                    disabled={!canUse}
                    onClick={() => onToggleSkill(skill.id)}
                  >
                    {active ? activeLabel : activateLabel}
                  </button>
                  {!canUse && <small className="skill-selection-hint">{skill.selectionHint ?? 'Select a relevant object first.'}</small>}
                </>
              ) : (
                <button
                  type="button"
                  className="primary-control"
                  data-testid={`purchase-${actionName}`}
                  disabled={points < skill.cost}
                  onClick={() => onPurchaseSkill(skill.id)}
                >
                  {purchaseLabel}
                </button>
              )}
            </article>
          );
        })}
      </div>
      <p className="skill-note">Insight points are earned by restoring complete collections. Choose tools that help you investigate; the professor leaves the sorting to you.</p>
    </aside>
  );
}
