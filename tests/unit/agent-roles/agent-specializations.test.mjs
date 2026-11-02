import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const agentsDirectory = join(projectRoot, 'agents');

function readAgent(name) {
  return readFileSync(join(agentsDirectory, `${name}.md`), 'utf8');
}

function frontmatterOf(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, 'agent prompt should begin with YAML frontmatter');
  return match[1];
}

test('the Python developer role is removed', () => {
  assert.equal(existsSync(join(agentsDirectory, 'python-developer.md')), false);
});

const roles = [
  {
    id: 'javascript-developer',
    displayName: 'JavaScript Developer',
    expertise: [/JavaScript/i, /runtime/i, /asynchronous/i],
    includedExtensions: ['*.js', '*.mjs'],
    excludedExtensions: ['*.css', '*.scss'],
  },
  {
    id: 'react-developer',
    displayName: 'React Developer',
    expertise: [/React/i, /components?/i, /accessib(le|ility)/i],
    includedExtensions: ['*.jsx', '*.tsx'],
    excludedExtensions: ['*.css', '*.scss'],
  },
  {
    id: 'css-developer',
    displayName: 'CSS Developer',
    expertise: [/CSS/i, /responsive/i, /cascade/i],
    includedExtensions: ['*.css', '*.scss'],
    excludedExtensions: ['*.js', '*.jsx'],
  },
];

for (const role of roles) {
  test(`${role.displayName} has scoped expert guidance and matching metadata`, () => {
    const markdown = readAgent(role.id);
    const frontmatter = frontmatterOf(markdown);

    assert.match(frontmatter, new RegExp(`^  id: ${role.id}$`, 'm'));
    assert.match(frontmatter, new RegExp(`^  displayName: ${role.displayName}$`, 'm'));

    for (const term of role.expertise) {
      assert.match(markdown, term, `prompt should demonstrate expertise matching ${term}`);
    }

    for (const extension of role.includedExtensions) {
      assert.ok(frontmatter.includes(extension), `role should be allowed to edit ${extension} files`);
    }

    for (const extension of role.excludedExtensions) {
      assert.ok(!frontmatter.includes(extension), `role should not own ${extension} files`);
    }
  });
}
