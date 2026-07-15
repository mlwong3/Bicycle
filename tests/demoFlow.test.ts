import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAdminPatch, toAdminReport } from '../src/caseAdapter';
import { buildWorkOrderPatrolRoute } from '../src/patrol';
import type { WorkOrder } from '../src/types';

test('demo flow requires clearance and scheduled work before route inclusion', () => {
  const initial = toAdminReport({ id: 'flow-1', location: '大埔海濱公園', lat: 22.451, lng: 114.177, description: '單車阻塞行人通道', citizenTags: ['obstruction'], status: 'pending', date: '2026-07-15' });
  const cleared = applyAdminPatch({ ...initial, status: 'clearance_approved' }, { procedureConfirmed: true }, 'admin-demo', '管理員確認可巡查');
  const base: WorkOrder = { id: 'flow-order', caseId: cleared.id, taskType: 'site_verification', title: '現場核實', leadDepartment: 'FEHD', supportingDepartments: [], location: cleared.location, district: '大埔', assignedTeamId: 'team-fehd', scheduledAt: '2026-07-15T09:00:00.000Z', priority: 'normal', prerequisiteWorkOrderIds: [], requiredCapabilities: [], requiredEquipment: [], evidenceChecklist: [], status: 'draft', assignmentHistory: [], createdAt: '2026-07-15T08:00:00.000Z', updatedAt: '2026-07-15T08:00:00.000Z' };
  const options = { travelMode: 'inspection-driving' as const, taskGroup: 'verification' as const, maxStops: 5, serviceMinutesPerStop: 10 };
  const beforeSchedule = buildWorkOrderPatrolRoute({ lat: 22.38, lng: 114.18 }, [base], [cleared], options, 'FEHD', '2026-07-15');
  assert.deepEqual(beforeSchedule.workOrderIds, []);
  const scheduled = { ...base, status: 'scheduled' as const };
  const route = buildWorkOrderPatrolRoute({ lat: 22.38, lng: 114.18 }, [scheduled], [cleared], options, 'FEHD', '2026-07-15');
  assert.deepEqual(route.workOrderIds, ['flow-order']);
  assert.equal(cleared.status, 'clearance_approved');
});
