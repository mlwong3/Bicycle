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
  assignedTeamId: 'team-1',
  location: '沙田源禾路體育館外',
  district: '沙田',
  executableAfter: '2026-07-15T09:30:00.000Z',
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

test('work is not ready when executableAfter is invalid', () => {
  const scheduled = {
    ...baseWorkOrder,
    assignedTeamId: 'team-1',
    executableAfter: 'not-a-date',
  };
  assert.equal(isWorkOrderReady(scheduled, [scheduled], new Date('2026-07-15T10:00:00.000Z')), false);
});

test('scheduled work cannot start without an assigned team', () => {
  const scheduled = { ...baseWorkOrder, status: 'scheduled' as const, assignedTeamId: undefined };
  const transitioned = applyWorkOrderTransition(
    scheduled,
    'in_progress',
    'staff-1',
    '2026-07-15T10:00:00.000Z',
    '',
    [scheduled],
    new Date('2026-07-15T10:00:00.000Z'),
  );
  assert.equal(transitioned.status, 'scheduled');
});

test('scheduled work cannot start until every prerequisite is completed', () => {
  const prerequisite = { ...baseWorkOrder, id: 'wo-prerequisite', status: 'accepted' as const };
  const scheduled = {
    ...baseWorkOrder,
    id: 'wo-dependent',
    status: 'scheduled' as const,
    prerequisiteWorkOrderIds: [prerequisite.id],
  };
  const transitioned = applyWorkOrderTransition(
    scheduled,
    'in_progress',
    'staff-1',
    '2026-07-15T10:00:00.000Z',
    '',
    [prerequisite, scheduled],
    new Date('2026-07-15T10:00:00.000Z'),
  );
  assert.equal(transitioned.status, 'scheduled');
});

test('scheduled work cannot start before executableAfter', () => {
  const scheduled = {
    ...baseWorkOrder,
    status: 'scheduled' as const,
    executableAfter: '2026-07-15T11:00:00.000Z',
  };
  const transitioned = applyWorkOrderTransition(
    scheduled,
    'in_progress',
    'staff-1',
    '2026-07-15T10:00:00.000Z',
    '',
    [scheduled],
    new Date('2026-07-15T10:00:00.000Z'),
  );
  assert.equal(transitioned.status, 'scheduled');
});

test('scheduled work cannot start when executableAfter is invalid', () => {
  const scheduled = {
    ...baseWorkOrder,
    status: 'scheduled' as const,
    executableAfter: 'not-a-date',
  };
  const transitioned = applyWorkOrderTransition(
    scheduled,
    'in_progress',
    'staff-1',
    '2026-07-15T10:00:00.000Z',
    '',
    [scheduled],
    new Date('2026-07-15T10:00:00.000Z'),
  );
  assert.equal(transitioned.status, 'scheduled');
});

test('scheduled work cannot start after a calendar-invalid executableAfter is normalized', () => {
  const scheduled = {
    ...baseWorkOrder,
    status: 'scheduled' as const,
    executableAfter: '2026-02-30T09:30:00.000Z',
  };
  const transitioned = applyWorkOrderTransition(
    scheduled,
    'in_progress',
    'staff-1',
    '2026-03-03T10:00:00.000Z',
    '',
    [scheduled],
    new Date('2026-03-03T10:00:00.000Z'),
  );
  assert.equal(transitioned.status, 'scheduled');
});

test('completion requires every evidence item and records an audit entry', () => {
  const started = { ...baseWorkOrder, status: 'in_progress' as const };
  assert.equal(applyWorkOrderTransition(started, 'completed', 'staff-1', '2026-07-15T10:00:00.000Z', '', [started], new Date('2026-07-15T10:00:00.000Z')).status, 'in_progress');
  const evidenced = { ...started, evidenceChecklist: [{ id: 'photo', label: '現場相片', completed: true }] };
  const completed = applyWorkOrderTransition(evidenced, 'completed', 'staff-1', '2026-07-15T10:00:00.000Z', '', [evidenced], new Date('2026-07-15T10:00:00.000Z'));
  assert.equal(completed.status, 'completed');
  assert.equal(completed.assignmentHistory.at(-1)?.action, 'status_changed');
});
