import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const supportedNodeRange = '^20.19.0 || >=22.12.0';
const readJson = (relativePath) => JSON.parse(readFileSync(
  fileURLToPath(new URL(relativePath, import.meta.url)),
  'utf8',
));

const packageJson = readJson('../../../package.json');
const packageLock = readJson('../../../package-lock.json');
const readme = readFileSync(fileURLToPath(new URL('../../../README.md', import.meta.url)), 'utf8');
const testingGuide = readFileSync(fileURLToPath(new URL('../../../docs/TESTING_GUIDE.md', import.meta.url)), 'utf8');

test('project metadata and documentation agree on the supported Node.js range', () => {
  assert.equal(packageJson.engines?.node, supportedNodeRange,
    'package.json should declare the supported Node.js range');
  assert.equal(packageLock.packages?.['']?.engines?.node, supportedNodeRange,
    'the package-lock root package should declare the same Node.js range');

  for (const [path, contents] of [
    ['README.md', readme],
    ['docs/TESTING_GUIDE.md', testingGuide],
  ]) {
    assert.ok(contents.includes(supportedNodeRange),
      `${path} should state the supported Node.js range ${supportedNodeRange}`);
  }

  assert.doesNotMatch(testingGuide, /does not declare a top-level Node engine field/i,
    'the Testing Guide should not retain the stale engine-omission caveat');
});
