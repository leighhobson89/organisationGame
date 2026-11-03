import assert from 'node:assert/strict';
import test from 'node:test';
import { roundedMedian } from '../../../performance/benchmark-summary.js';

test('benchmark summary preserves small mounted ratios and frame-drop rates', () => {
  const ratioAt2500 = roundedMedian([8 / 2_500], 4);
  const ratioAt5024 = roundedMedian([8 / 5_024], 4);
  const dropRateAt5024 = roundedMedian([8 / 5_024], 4);

  assert.equal(ratioAt2500, 0.0032);
  assert.ok(ratioAt2500 > 0, '8 mounted items out of 2,500 must not round to zero');
  assert.equal(ratioAt5024, 0.0016);
  assert.ok(ratioAt5024 > 0, '8 mounted items out of 5,024 must not round to zero');
  assert.equal(dropRateAt5024, 0.0016);
  assert.ok(dropRateAt5024 > 0, 'small frame-drop rates must not round to zero');
  assert.equal(roundedMedian([123.456]), 123.46, 'timing fields retain two decimal places');
});
