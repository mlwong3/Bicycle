import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDeadline, createProcedureSnapshot, DEFAULT_PROCEDURES } from '../src/procedureConfig';

test('procedure deadline uses the selected snapshot, not a fixed 14-day rule', () => {
  const config = { ...DEFAULT_PROCEDURES[0], noticePeriodHours: 48 };
  assert.equal(
    calculateDeadline(config, new Date('2026-07-13T10:00:00.000Z')),
    '2026-07-15T10:00:00.000Z',
  );
});

test('procedure snapshot is a copy that can be changed without mutating defaults', () => {
  const snapshot = createProcedureSnapshot(DEFAULT_PROCEDURES[0]);
  snapshot.label = '本次示範程序';
  assert.notEqual(snapshot.label, DEFAULT_PROCEDURES[0].label);
});
