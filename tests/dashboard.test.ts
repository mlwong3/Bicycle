import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDashboardView } from '../src/dashboard';
import type { AdminReport, JointOperation, WorkOrder } from '../src/types';

const reports = [{
  id: 'case-1', location: '沙田', description: '阻塞', date: '2026-07-15', status: 'classified',
  locationSource: 'gps', caseType: 'obstruction', urgency: 'emergency', procedureConfirmed: true,
  coordinatesValid: true, isDuplicate: false,
}] satisfies AdminReport[];

const orders = [{
  id: 'wo-1', caseId: 'case-1', taskType: 'safety_response', title: '安全處理',
  leadDepartment: 'HKPF', supportingDepartments: [], location: '沙田', district: '沙田', priority: 'emergency',
  assignedTeamId: 'team-1', scheduledAt: '2026-07-15T10:00:00.000Z', prerequisiteWorkOrderIds: [],
  requiredCapabilities: [], requiredEquipment: [], evidenceChecklist: [], status: 'scheduled',
  assignmentHistory: [], createdAt: '2026-07-15T09:00:00.000Z', updatedAt: '2026-07-15T09:00:00.000Z',
}] satisfies WorkOrder[];

const operations: JointOperation[] = [];

test('one filter set drives cards, priority queue, department load and routes', () => {
  const view = buildDashboardView(reports, orders, operations, {
    district: '沙田', department: 'HKPF', date: '2026-07-15', status: 'all',
  }, new Date('2026-07-15T09:00:00.000Z'));
  assert.equal(view.summary.immediateDanger, 1);
  assert.equal(view.priorityItems[0].workOrderId, 'wo-1');
  assert.equal(view.departmentLoads.HKPF.scheduled, 1);
  assert.deepEqual(view.todayExecutableWorkOrderIds, ['wo-1']);

  const empty = buildDashboardView(reports, orders, operations, {
    district: '大埔', department: 'HKPF', date: '2026-07-15', status: 'all',
  }, new Date('2026-07-15T09:00:00.000Z'));
  assert.equal(empty.summary.immediateDanger, 0);
  assert.equal(empty.priorityItems.length, 0);
});

test('priority queue uses emergency, blocked, overdue, acceptance and jurisdiction order', () => {
  const priorityOrders: WorkOrder[] = [
    { ...orders[0], id: 'jurisdiction', taskType: 'jurisdiction_review', priority: 'normal', status: 'draft', scheduledAt: undefined },
    { ...orders[0], id: 'awaiting', taskType: 'site_verification', priority: 'normal', status: 'awaiting_acceptance', scheduledAt: undefined },
    { ...orders[0], id: 'overdue', taskType: 'removal', priority: 'normal', status: 'scheduled', dueAt: '2026-07-14T09:00:00.000Z' },
    { ...orders[0], id: 'blocked', taskType: 'removal', priority: 'normal', status: 'blocked', scheduledAt: undefined },
    { ...orders[0], id: 'emergency', priority: 'emergency', status: 'draft', scheduledAt: undefined },
  ];
  const view = buildDashboardView(reports, priorityOrders, operations, {
    district: '沙田', department: 'HKPF', date: '2026-07-15', status: 'all',
  }, new Date('2026-07-15T09:00:00.000Z'));
  assert.deepEqual(view.priorityItems.map((item) => item.workOrderId), ['emergency', 'blocked', 'overdue', 'awaiting', 'jurisdiction']);
});

test('today executable requires scheduled status and structural readiness', () => {
  const notScheduled = { ...orders[0], id: 'draft-ready', status: 'draft' as const };
  const missingTeam = { ...orders[0], id: 'scheduled-no-team', assignedTeamId: undefined };
  const view = buildDashboardView(reports, [orders[0], notScheduled, missingTeam], operations, {
    district: '沙田', department: 'HKPF', date: '2026-07-15', status: 'all',
  }, new Date('2026-07-15T09:00:00.000Z'));
  assert.deepEqual(view.todayExecutableWorkOrderIds, ['wo-1']);
});

test('joint-operation readiness follows the same filtered order set', () => {
  const operation: JointOperation = {
    id: 'joint-1', title: '聯合行動', location: '沙田', district: '沙田', actionDate: '2026-07-15',
    coordinatingDepartment: 'HAD', participatingDepartments: ['HKPF'],
    mandatoryWorkOrderIds: ['completed-order', 'open-order'], status: 'preparing',
  };
  const operationOrders = [
    { ...orders[0], id: 'completed-order', status: 'completed' as const },
    { ...orders[0], id: 'open-order', status: 'scheduled' as const },
  ];
  const view = buildDashboardView(reports, operationOrders, [operation], {
    district: '沙田', department: 'HKPF', date: '2026-07-15', status: 'all',
  }, new Date('2026-07-15T09:00:00.000Z'));
  assert.deepEqual(view.operationReadiness, [{ jointOperationId: 'joint-1', completed: 1, mandatory: 2, ready: false }]);

  const empty = buildDashboardView(reports, operationOrders, [operation], {
    district: '大埔', department: 'HKPF', date: '2026-07-15', status: 'all',
  }, new Date('2026-07-15T09:00:00.000Z'));
  assert.equal(empty.summary.todayJointOperations, 0);
  assert.deepEqual(empty.operationReadiness, []);
});
