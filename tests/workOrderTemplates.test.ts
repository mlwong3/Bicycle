import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkOrdersFromTemplate } from '../src/workOrderTemplates';
import { toAdminReport } from '../src/caseAdapter';
import { recommendTeams } from '../src/assignment';
import { DEMO_TEAMS } from '../src/demoData';

test('public bicycle parking template creates six ordered department work orders', () => {
  const report = toAdminReport({
    id: 'case-parking', location: '沙田公共單車泊車處', description: '聯合行動示範',
    status: 'classified', date: '2026-07-15', lat: 22.38, lng: 114.18,
  });
  const orders = createWorkOrdersFromTemplate(report, 'public_bike_parking_joint_operation', '2026-07-15T09:00:00.000Z', 'joint-1');
  assert.equal(orders.length, 6);
  assert.deepEqual(orders.map((order) => order.leadDepartment), ['TD', 'HKPF', 'LandsD', 'FEHD', 'LandsD', 'HAD']);
  assert.deepEqual(orders.map((order) => order.location), Array(6).fill(report.location));
  assert.deepEqual(orders.map((order) => order.district), Array(6).fill('沙田'));
  assert.deepEqual(orders[0].prerequisiteWorkOrderIds, []);
  assert.deepEqual(orders[1].prerequisiteWorkOrderIds, [orders[0].id]);
  assert.deepEqual(orders[2].prerequisiteWorkOrderIds, [orders[1].id]);
  assert.deepEqual(orders[3].prerequisiteWorkOrderIds, [orders[1].id, orders[2].id]);
  assert.deepEqual(orders[4].prerequisiteWorkOrderIds, [orders[3].id]);
  assert.deepEqual(orders[5].prerequisiteWorkOrderIds, orders.slice(0, 5).map((order) => order.id));
  assert.equal(orders.every((order) => order.jointOperationId === 'joint-1'), true);
});

test('emergency template starts with police safety response', () => {
  const report = toAdminReport({
    id: 'case-danger', location: '源禾路', description: '即時危險', status: 'classified',
    date: '2026-07-15', caseType: 'safety_hazard', urgency: 'emergency',
  });
  const orders = createWorkOrdersFromTemplate(report, 'immediate_danger', '2026-07-15T09:00:00.000Z');
  assert.equal(orders[0].leadDepartment, 'HKPF');
  assert.equal(orders[0].priority, 'emergency');
  assert.equal(orders[0].location, report.location);
  assert.equal(orders[0].district, '未確認地區');
});

test('unknown procedure template fails closed with a clear error', () => {
  const report = toAdminReport({
    id: 'case-unknown', location: '示範地點', description: '未知模板', status: 'classified',
    date: '2026-07-15',
  });
  assert.throws(
    () => createWorkOrdersFromTemplate(report, 'unknown_template' as never, '2026-07-15T09:00:00.000Z'),
    /Unknown procedure template: unknown_template/,
  );
});

test('template removal requires bicycle-removal capability and removal-vehicle equipment', () => {
  const report = toAdminReport({ id: 'case-removal', location: '大埔單車徑', description: '街道棄置物', status: 'classified', date: '2026-07-15', urgency: 'urgent' });
  const removal = createWorkOrdersFromTemplate(report, 'street_waste', '2026-07-15T09:00:00.000Z')[1];
  assert.deepEqual(removal.requiredCapabilities, ['bicycle-removal']);
  assert.deepEqual(removal.requiredEquipment, ['removal-vehicle']);
  const filtered = recommendTeams(removal, [
    ...DEMO_TEAMS,
    { ...DEMO_TEAMS.find((team) => team.department === 'FEHD')!, id: 'fehd-no-removal-equipment', equipment: ['camera'] },
  ], new Date('2026-07-15T09:00:00.000Z'));
  assert.equal(filtered.some((item) => item.teamId === 'fehd-no-removal-equipment'), false);
  assert.equal(filtered.length > 0, true);
});
