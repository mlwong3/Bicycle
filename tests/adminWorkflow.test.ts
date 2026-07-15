import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAdminPatch } from '../src/caseAdapter';
import { buildWorkOrderPatrolRoute } from '../src/patrol';
import { applyWorkOrderRouteConfirmation } from '../src/workOrders';
import type { AdminReport, WorkOrder } from '../src/types';

const report: AdminReport = { id: 'route-report', location: '示範地點', description: '單車阻塞通道', date: '2026-07-15', status: 'clearance_approved', locationSource: 'gps', caseType: 'obstruction', urgency: 'normal', procedureConfirmed: true, coordinatesValid: true, isDuplicate: false, lat: 22.381, lng: 114.181 };
const order: WorkOrder = { id: 'route-order', caseId: report.id, taskType: 'site_verification', title: '現場核實', leadDepartment: 'FEHD', supportingDepartments: [], location: report.location, district: '沙田', assignedTeamId: 'team-fehd', scheduledAt: '2026-07-15T09:00:00.000Z', priority: 'normal', prerequisiteWorkOrderIds: [], requiredCapabilities: [], requiredEquipment: [], evidenceChecklist: [], status: 'scheduled', assignmentHistory: [], createdAt: '2026-07-15T08:00:00.000Z', updatedAt: '2026-07-15T08:00:00.000Z' };

test('classification and procedure confirmation do not create a patrol route', () => {
  const initial = { ...report, status: 'classified' as const, procedureConfirmed: false };
  const patched = applyAdminPatch(initial, { caseType: 'obstruction', urgency: 'urgent', procedureConfirmed: true });
  assert.equal(patched.status, 'classified');
  assert.equal(patched.patrolRouteId, undefined);
});

test('route confirmation updates only scheduled work orders and leaves case status unchanged', () => {
  const route = buildWorkOrderPatrolRoute({ lat: 22.38, lng: 114.18 }, [order], [report], { travelMode: 'inspection-walking', taskGroup: 'verification', maxStops: 5, serviceMinutesPerStop: 12 }, 'FEHD', '2026-07-15');
  const confirmed = applyWorkOrderRouteConfirmation([order], route, 'admin-demo', '2026-07-15T12:00:00.000Z', 'demo-route');
  assert.equal(confirmed[0].status, 'scheduled');
  assert.equal(confirmed[0].patrolRouteId, 'demo-route');
  assert.equal(confirmed[0].assignmentHistory.at(-1)?.action, 'route_assigned');
  assert.equal(report.status, 'clearance_approved');
});
