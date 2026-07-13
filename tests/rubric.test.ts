import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateRubricSummary } from '../src/rubric';

test('unobservable rubric values are excluded rather than scored as zero', () => {
  const summary = calculateRubricSummary({
    rust: { score: null, observable: false },
    tire: { score: 3, observable: true },
    dust: { score: 1, observable: true },
    attachment: { score: null, observable: false },
    missing: { score: 0, observable: true },
    lock: { score: null, observable: false },
  });
  assert.equal(summary.scoredCount, 3);
  assert.equal(summary.totalScore, 4);
  assert.equal(summary.maximumObservableScore, 9);
  assert.equal(summary.dataSufficiency, 'partial');
});
