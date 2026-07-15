import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAdminPatch, toAdminReport } from '../src/caseAdapter';
import { recommendTeams } from '../src/assignment';
import { buildDashboardView } from '../src/dashboard';
import { DEMO_TEAMS } from '../src/demoData';
import { buildWorkOrderPatrolRoute } from '../src/patrol';
import { createWorkOrdersFromTemplate } from '../src/workOrderTemplates';
import { applyWorkOrderTransition, assignWorkOrder, isWorkOrderReady } from '../src/workOrders';
import type { JointOperation, WorkOrder } from '../src/types';

test('demo flow requires clearance and scheduled work before route inclusion', () => {
  const initial = toAdminReport({ id: 'flow-1', location: '大埔海濱公園', lat: 22.451, lng: 114.177, description: '單車阻塞行人通道', citizenTags: ['obstruction'], status: 'pending', date: '2026-07-15' });
  const cleared = applyAdminPatch({ ...initial, status: 'clearance_approved' }, { procedureConfirmed: true }, 'admin-demo', '管理員確認可巡查');
  const base: WorkOrder = { id: 'flow-order', caseId: cleared.id, taskType: 'site_verification', title: '現場核實', leadDepartment: 'FEHD', supportingDepartments: [], location: cleared.location, district: '大埔', assignedTeamId: 'team-fehd', scheduledAt: '2026-07-15T09:00:00.000Z', priority: 'normal', prerequisiteWorkOrderIds: [], requiredCapabilities: [], requiredEquipment: [], evidenceChecklist: [], status: 'draft', assignmentHistory: [], createdAt: '2026-07-15T08:00:00.000Z', updatedAt: '2026-07-15T08:00:00.000Z' };
  const options = { travelMode: 'inspection-driving' as const, taskGroup: 'verification' as const, maxStops: 5, serviceMinutesPerStop: 10 };
  const beforeSchedule = buildWorkOrderPatrolRoute({ lat: 22.38, lng: 114.18 }, [base], [cleared], options, 'FEHD', '2026-07-15', '2026-07-15T08:00:00.000Z');
  assert.deepEqual(beforeSchedule.workOrderIds, []);
  const scheduled = { ...base, status: 'scheduled' as const };
  const route = buildWorkOrderPatrolRoute({ lat: 22.38, lng: 114.18 }, [scheduled], [cleared], options, 'FEHD', '2026-07-15', '2026-07-15T08:00:00.000Z');
  assert.deepEqual(route.workOrderIds, ['flow-order']);
  assert.equal(cleared.status, 'clearance_approved');
});

test('phase 1 public parking demo proves six work orders and human-controlled closeout', () => {
  const at = '2026-07-15T09:00:00.000Z';
  const report = toAdminReport({ id: 'joint-case', location: '沙田公共單車泊車處', description: '聯合行動示範', status: 'classified', date: '2026-07-15', lat: 22.38, lng: 114.18 });
  const orders = createWorkOrdersFromTemplate(report, 'public_bike_parking_joint_operation', at, 'joint-demo');
  assert.equal(orders.length, 6);
  assert.deepEqual(orders.map((order) => order.leadDepartment), ['TD', 'HKPF', 'LandsD', 'FEHD', 'LandsD', 'HAD']);

  const firstRecommendation = recommendTeams(orders[0], DEMO_TEAMS, new Date(at))[0];
  assert.ok(firstRecommendation);
  const firstTeam = DEMO_TEAMS.find((team) => team.id === firstRecommendation.teamId);
  assert.ok(firstTeam);
  const secondTeam = DEMO_TEAMS.find((team) => team.id === recommendTeams(orders[1], DEMO_TEAMS, new Date(at))[0]?.teamId);
  assert.ok(secondTeam);
  let first = assignWorkOrder(orders[0], firstTeam, 'coordinator-demo', at);
  assert.equal(first.status, 'awaiting_acceptance');
  let workingOrders = [first, ...orders.slice(1)];
  const secondAssigned = assignWorkOrder(orders[1], secondTeam, 'coordinator-demo', at);
  workingOrders = [workingOrders[0], secondAssigned, ...workingOrders.slice(2)];
  assert.equal(isWorkOrderReady(secondAssigned, workingOrders, new Date('2026-07-15T09:01:00.000Z')), false);

  first = applyWorkOrderTransition(first, 'accepted', 'team-lead-demo', '2026-07-15T09:10:00.000Z', '', workingOrders, new Date('2026-07-15T09:10:00.000Z'));
  first = applyWorkOrderTransition(first, 'scheduled', 'team-lead-demo', '2026-07-15T09:20:00.000Z', '', workingOrders, new Date('2026-07-15T09:20:00.000Z'));
  first = applyWorkOrderTransition(first, 'in_progress', 'staff-demo', '2026-07-15T09:30:00.000Z', '', workingOrders, new Date('2026-07-15T09:30:00.000Z'));
  first = { ...first, evidenceChecklist: first.evidenceChecklist.map((item) => ({ ...item, completed: true })) };
  first = applyWorkOrderTransition(first, 'completed', 'staff-demo', '2026-07-15T10:00:00.000Z', '', workingOrders, new Date('2026-07-15T10:00:00.000Z'));
  workingOrders = [first, ...workingOrders.slice(1)];
  assert.equal(isWorkOrderReady(secondAssigned, workingOrders, new Date('2026-07-15T10:01:00.000Z')), true);

  const operation: JointOperation = { id: 'joint-demo', title: '沙田公共泊車處聯合行動', location: report.location, district: '沙田', actionDate: '2026-07-15', coordinatingDepartment: 'HAD', participatingDepartments: ['HAD', 'TD', 'LandsD', 'FEHD', 'HKPF'], mandatoryWorkOrderIds: orders.map((order) => order.id), status: 'preparing' };
  const baseFilters = { district: 'all' as const, department: 'all' as const, date: '2026-07-15', status: 'all' as const };
  const beforeBlocked = buildDashboardView([report], workingOrders, [operation], baseFilters, new Date('2026-07-15T10:01:00.000Z'));
  assert.equal(beforeBlocked.summary.blockedOrOverdue, 0);
  const blockedOrders = workingOrders.map((order) => order.id === orders[3].id ? { ...order, status: 'blocked' as const, blockerReason: '等待法定期限屆滿' } : order);
  const blockedView = buildDashboardView([report], blockedOrders, [operation], baseFilters, new Date('2026-07-15T10:01:00.000Z'));
  assert.equal(blockedView.summary.blockedOrOverdue, 1);

  const completedOrders = orders.map((order) => ({ ...order, status: 'completed' as const, evidenceChecklist: order.evidenceChecklist.map((item) => ({ ...item, completed: true })) }));
  const completedView = buildDashboardView([report], completedOrders, [operation], baseFilters, new Date('2026-07-15T17:00:00.000Z'));
  assert.equal(completedView.operationReadiness[0].completed, 6);
  assert.equal(completedView.operationReadiness[0].mandatory, 6);
  assert.equal(completedView.operationReadiness[0].ready, true);
  assert.equal(report.status, 'classified');
});
