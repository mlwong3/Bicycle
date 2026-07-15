import test from 'node:test';
import assert from 'node:assert/strict';
import { getWorkOrderLockReason, getWorkOrderQueueLabel, getAssignmentConfirmationReason } from '../src/components/WorkAssignmentCentre';
import type { WorkOrder } from '../src/types';

const order = (overrides: Partial<WorkOrder> = {}): WorkOrder => ({
  id: 'wo-1', caseId: 'case-1', taskType: 'site_verification', title: '現場核實',
  leadDepartment: 'FEHD', supportingDepartments: [], location: '大埔單車徑', district: '大埔',
  priority: 'normal', prerequisiteWorkOrderIds: [], requiredCapabilities: [], requiredEquipment: [],
  evidenceChecklist: [], status: 'scheduled', assignmentHistory: [],
  createdAt: '2026-07-15T00:00:00.000Z', updatedAt: '2026-07-15T00:00:00.000Z',
  ...overrides,
});

test('pure work-order helpers explain prerequisite and schedule locks', () => {
  const blocked = order({ prerequisiteWorkOrderIds: ['wo-pre'] });
  const prerequisite = order({ id: 'wo-pre', status: 'in_progress' });
  assert.equal(getWorkOrderLockReason(blocked, [blocked, prerequisite], new Date('2026-07-15T01:00:00.000Z')), '等待前置工作完成');
  assert.equal(getWorkOrderLockReason(order({ executableAfter: '2026-07-16T00:00:00.000Z' }), [order({ executableAfter: '2026-07-16T00:00:00.000Z' })], new Date('2026-07-15T01:00:00.000Z')), '尚未到可執行時間');
});

test('pure queue helper uses the required human-readable labels', () => {
  assert.equal(getWorkOrderQueueLabel('draft'), '待分配');
  assert.equal(getWorkOrderQueueLabel('awaiting_acceptance'), '待接收');
  assert.equal(getWorkOrderQueueLabel('in_progress'), '進行中');
});

test('malformed executableAfter is locked using the work-order readiness rule', () => {
  const malformed = order({ assignedTeamId: 'team-fehd', executableAfter: 'not-a-date' });
  assert.equal(getWorkOrderLockReason(malformed, [malformed], new Date('2026-07-15T01:00:00.000Z')), '可執行時間資料無效');
});

test('accepted work is schedulable and reassignment requires a nonblank reason', () => {
  const accepted = order({ status: 'accepted', assignedTeamId: 'team-old' });
  assert.equal(getWorkOrderQueueLabel(accepted.status), '已接收');
  assert.equal(getAssignmentConfirmationReason(accepted, 'team-new', '   '), '重新分配必須填寫理由');
  assert.equal(getAssignmentConfirmationReason(accepted, 'team-new', '改由支援隊處理'), undefined);
});
