import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
const roadmap = readFileSync(new URL('../../docs/ROADMAP.md', import.meta.url), 'utf8');
const readinessUrl = new URL('../../docs/PHASE_1_HUMAN_TESTING.md', import.meta.url);

test('README and roadmap surface the Phase 1 human-testing readiness guide', () => {
  assert.match(readme, /\]\(docs\/PHASE_1_HUMAN_TESTING\.md\)/i);
  assert.match(roadmap, /\]\(PHASE_1_HUMAN_TESTING\.md\)/i);
});

test('the readiness guide separates automated evidence from open human-testing gates', () => {
  const readiness = readFileSync(readinessUrl, 'utf8');

  assert.match(readiness, /ready to begin human testing/i);
  assert.match(readiness, /outstanding/i);
  assert.match(readiness, /automated/i);
  assert.match(readiness, /independent human/i);
  assert.match(readiness, /fresh save/i);
  assert.match(readiness, /audio/i);
});
