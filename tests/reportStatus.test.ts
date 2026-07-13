import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_REPORT_STATUSES,
  canTransition,
  getPublicStatusLabel,
  isRouteEligible,
  toPublicStatus,
} from '../src/reportStatus';

test('clearance approval is required before scheduled', () => {
  assert.equal(canTransition('classified', 'scheduled'), false);
  assert.equal(canTransition('clearance_approved', 'scheduled'), true);
});

test('public mapping hides internal workflow states', () => {
  assert.equal(toPublicStatus('classified'), 'processing');
  assert.equal(toPublicStatus('resolved'), 'resolved');
  assert.equal(toPublicStatus('dismissed'), 'dismissed');
  assert.equal(getPublicStatusLabel('deadline_expired'), '處理中');
});

test('all internal statuses have public labels', () => {
  assert.equal(ALL_REPORT_STATUSES.length, 13);
  for (const status of ALL_REPORT_STATUSES) assert.ok(getPublicStatusLabel(status));
});

test('patrol eligibility requires procedure, coordinates and non-duplicate state', () => {
  const base = {
    status: 'clearance_approved' as const,
    coordinatesValid: true,
    procedureConfirmed: true,
    isDuplicate: false,
  };
  assert.equal(isRouteEligible(base), true);
  assert.equal(isRouteEligible({ ...base, procedureConfirmed: false }), false);
  assert.equal(isRouteEligible({ ...base, isDuplicate: true }), false);
  assert.equal(isRouteEligible({ ...base, coordinatesValid: false }), false);
});
