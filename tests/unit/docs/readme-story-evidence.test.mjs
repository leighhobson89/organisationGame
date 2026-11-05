import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const readmePath = fileURLToPath(new URL('../../../README.md', import.meta.url));
const readme = readFileSync(readmePath, 'utf8');

function findOpeningStorySummary(markdown) {
  const paragraph = markdown.match(/The ending is derived[\s\S]*?(?=\n\s*\n|$)/i);
  assert.ok(paragraph, 'README should include its opening ending summary');
  return paragraph[0];
}

function findKnownLimitationsStory(markdown) {
  const bullet = markdown.match(/^- \*\*Story:\*\*.*$/im);
  assert.ok(bullet, 'README should include a Known limitations Story bullet');
  return bullet[0];
}

function assertEvidenceBoundedStory(text, location) {
  assert.match(text, /unsent apology|apology/i, `${location} should identify the apology as the clue`);
  assert.match(text, /Professor.{0,100}(?:feared|afraid|worried)/i,
    `${location} should say the Professor feared or worried about something`);
  assert.match(text, /Elian.{0,100}blam\w*.{0,60}(?:machine|Engine)/i,
    `${location} should say the fear was that Elian would blame the machine`);
  assert.match(text, /choice/i, `${location} should describe the choice as unnamed`);
  assert.match(text, /(?:recovered )?records?.{0,120}(?:do not|don't|cannot|can't|never).{0,100}(?:name|identify|specify|establish).{0,60}choice/i,
    `${location} should say the records do not identify the choice`);
  assert.match(text, /Chaos Event/i, `${location} should mention the Chaos Event`);
  assert.match(text, /(?:do not|don't|cannot|can't|never).{0,50}(?:establish|show|reveal|explain).{0,60}(?:whether|how).{0,80}(?:connect\w*|link\w*|relat\w*|cause|trigger).{0,50}Chaos Event/i,
    `${location} should leave the choice's relationship to the Chaos Event unresolved`);
  assert.match(text, /(?:(?:do not|don't|cannot|can't).{0,50}(?:establish|identify|specify).{0,70}(?:Event's )?(?:original )?trigger)|(?:(?:Event's )?(?:original )?trigger.{0,80}(?:unknown|unresolved|not established|unclear|unanswered))/i,
    `${location} should leave the Chaos Event's original trigger unresolved`);
  assert.match(text, /(?:Elian's response.{0,60}(?:unresolved|unknown|unclear|unanswered|not established)|(?:do not|don't|cannot|can't).{0,50}(?:establish|identify|record|say|reveal).{0,70}Elian's response)/i,
    `${location} should leave Elian's response unresolved`);
  assert.doesNotMatch(text, /preserv\w*.{0,30}recording/i,
    `${location} should not claim the clues support a choice to preserve the recording`);
}

test('README story summaries stay within the recovered evidence', () => {
  assertEvidenceBoundedStory(findOpeningStorySummary(readme), 'Opening story summary');
  assertEvidenceBoundedStory(findKnownLimitationsStory(readme), 'Known limitations Story bullet');
});
