import assert from 'node:assert/strict';
import test from 'node:test';
import { applyWorkOrderTransition, isWorkOrderReady } from '../src/workOrders';
import type { WorkOrder } from '../src/types';

const baseWorkOrder: WorkOrder = {
  id: 'wo-1',
  caseId: 'case-1',
  taskType: 'site_verification',
  title: '現場核實',
  leadDepartment: 'HAD',
  supportingDepartments: [],
  district: '沙田',
  priority: 'normal',
  prerequisiteWorkOrderIds: [],
  requiredCapabilities: ['site-verification'],
  requiredEquipment: [],
  evidenceChecklist: [{ id: 'photo', label: '現場相片', completed: false }],
  status: 'draft',
  assignmentHistory: [],
  createdAt: '2026-07-15T09:00:00.000Z',
  updatedAt: '2026-07-15T09:00:00.000Z',
};

test('downstream work is not ready before every prerequisite is completed', () => {
  const downstream = { ...baseWorkOrder, id: 'wo-2', prerequisiteWorkOrderIds: ['wo-1'] };
  assert.equal(isWorkOrderReady(downstream, [baseWorkOrder], new Date('2026-07-15T10:00:00.000Z')), false);
  assert.equal(isWorkOrderReady(downstream, [{ ...baseWorkOrder, status: 'completed' }], new Date('2026-07-15T10:00:00.000Z')), true);
});

test('completion requires every evidence item and records an audit entry', () => {
  const started = { ...baseWorkOrder, status: 'in_progress' as const };
  assert.equal(applyWorkOrderTransition(started, 'completed', 'staff-1', '2026-07-15T10:00:00.000Z').status, 'in_progress');
  const evidenced = { ...started, evidenceChecklist: [{ id: 'photo', label: '現場相片', completed: true }] };
  const completed = applyWorkOrderTransition(evidenced, 'completed', 'staff-1', '2026-07-15T10:00:00.000Z');
  assert.equal(completed.status, 'completed');
  assert.equal(completed.assignmentHistory.at(-1)?.action, 'status_changed');
});
