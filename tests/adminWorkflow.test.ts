import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPatrolConfirmation, applyAdminPatch } from '../src/caseAdapter';
import { buildPatrolOrder } from '../src/patrol';
import type { AdminReport } from '../src/types';

const START = { lat: 22.38, lng: 114.18 };

function makeReport(patch: Partial<AdminReport> = {}): AdminReport {
  return {
    id: 'workflow-report',
    location: '示範地點',
    description: '單車阻塞通道',
    date: '2026-07-13',
    status: 'classified',
    locationSource: 'gps',
    caseType: 'other',
    urgency: 'normal',
    procedureConfirmed: false,
    coordinatesValid: true,
    isDuplicate: false,
    lat: 22.381,
    lng: 114.181,
    ...patch,
  };
}

test('admin patch records classification and procedure confirmation without resolving the case', () => {
  const initial = makeReport({ status: 'classified' });
  const patched = applyAdminPatch(initial, {
    caseType: 'obstruction', urgency: 'urgent', procedureConfirmed: true,
  });
  assert.equal(patched.status, 'classified');
  assert.equal(patched.procedureConfirmed, true);
  assert.equal(patched.caseType, 'obstruction');
});

test('route confirmation is the only action that schedules eligible cases', () => {
  const eligible = makeReport({ id: 'route-report', status: 'clearance_approved', procedureConfirmed: true });
  const draft = buildPatrolOrder(START, [eligible], {
    travelMode: 'inspection-walking', maxStops: 5, serviceMinutesPerStop: 12,
  });
  assert.equal(draft.status, 'draft');
  assert.equal(eligible.status, 'clearance_approved');
  const confirmed = applyPatrolConfirmation([eligible], draft, 'admin-demo', '2026-07-13T12:00:00.000Z');
  assert.equal(confirmed[0].status, 'scheduled');
  assert.equal(confirmed[0].patrolRouteId, 'demo-route');
});
