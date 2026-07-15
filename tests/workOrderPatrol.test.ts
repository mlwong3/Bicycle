import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWorkOrderPatrolRoute } from '../src/patrol';
import type { AdminReport, WorkOrder } from '../src/types';

const reports: AdminReport[] = [
  { id: 'case-a', location: '沙田 A', description: '核實', date: '2026-07-15', status: 'classified', lat: 22.38, lng: 114.18, locationSource: 'gps', caseType: 'other', urgency: 'normal', procedureConfirmed: true, coordinatesValid: true, isDuplicate: false },
  { id: 'case-b', location: '沙田 B', description: '移走', date: '2026-07-15', status: 'classified', lat: 22.39, lng: 114.19, locationSource: 'gps', caseType: 'other', urgency: 'normal', procedureConfirmed: true, coordinatesValid: true, isDuplicate: false },
];

function makeOrder(id: string, caseId: string, taskType: WorkOrder['taskType'], department: WorkOrder['leadDepartment'], patch: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id, caseId, taskType, title: id, leadDepartment: department, supportingDepartments: [], location: `沙田 ${id}`, district: '沙田',
    assignedTeamId: 'team-1', scheduledAt: '2026-07-15T09:00:00.000Z', priority: 'normal', prerequisiteWorkOrderIds: [],
    requiredCapabilities: [], requiredEquipment: [], evidenceChecklist: [], status: 'scheduled',
    assignmentHistory: [], createdAt: '2026-07-15T08:00:00.000Z', updatedAt: '2026-07-15T08:00:00.000Z', ...patch,
  };
}

const options = { travelMode: 'inspection-walking' as const, taskGroup: 'verification' as const, maxStops: 5, serviceMinutesPerStop: 12 };

test('route contains only the selected department, date and compatible task group', () => {
  const orders = [
    makeOrder('verify-fehd', 'case-a', 'site_verification', 'FEHD'),
    makeOrder('remove-fehd', 'case-b', 'removal', 'FEHD'),
    makeOrder('verify-had', 'case-a', 'site_verification', 'HAD'),
  ];
  const route = buildWorkOrderPatrolRoute({ lat: 22.38, lng: 114.18 }, orders, reports, options, 'FEHD', '2026-07-15');
  assert.deepEqual(route.workOrderIds, ['verify-fehd']);
  assert.equal(route.taskGroup, 'verification');
});

test('route excludes unscheduled, not-ready, invalid-coordinate and wrong-date work', () => {
  const orders = [
    makeOrder('scheduled', 'case-a', 'site_verification', 'FEHD'),
    makeOrder('draft', 'case-b', 'site_verification', 'FEHD', { status: 'draft' }),
    makeOrder('future', 'case-a', 'site_verification', 'FEHD', { executableAfter: '2026-07-16T00:00:00.000Z' }),
    makeOrder('bad-time', 'case-a', 'site_verification', 'FEHD', { executableAfter: 'bad-date' }),
    makeOrder('wrong-date', 'case-a', 'site_verification', 'FEHD', { scheduledAt: '2026-07-16T09:00:00.000Z' }),
  ];
  const route = buildWorkOrderPatrolRoute({ lat: 22.38, lng: 114.18 }, orders, reports, options, 'FEHD', '2026-07-15');
  assert.deepEqual(route.workOrderIds, ['scheduled']);
});

test('clearance vehicle cannot mix with verification or notice tasks', () => {
  const route = buildWorkOrderPatrolRoute({ lat: 22.38, lng: 114.18 }, [makeOrder('remove', 'case-a', 'removal', 'FEHD')], reports, { ...options, travelMode: 'clearance-vehicle', taskGroup: 'verification' }, 'FEHD', '2026-07-15');
  assert.deepEqual(route.workOrderIds, []);
});
