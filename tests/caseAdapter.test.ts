import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAdminPatch, toAdminReport, toPublicReport } from '../src/caseAdapter';
import { DEMO_TEAMS, INITIAL_ADMIN_REPORTS, INITIAL_JOINT_OPERATIONS, INITIAL_WORK_ORDERS } from '../src/demoData';

test('legacy report is adapted with safe internal defaults', () => {
  const admin = toAdminReport({
    id: 'legacy',
    location: '沙田',
    description: '阻塞',
    status: 'pending',
    date: '2026-07-13',
  });
  assert.equal(admin.caseType, 'other');
  assert.equal(admin.locationSource, 'unknown');
  assert.equal(admin.procedureConfirmed, false);
  assert.equal(toPublicReport(admin).publicStatus, 'pending');
});

test('admin patch preserves existing data and does not change status implicitly', () => {
  const initial = toAdminReport({
    id: 'patch', location: '大埔', description: '單車', status: 'classified', date: '2026-07-13',
  });
  const patched = applyAdminPatch(initial, { caseType: 'obstruction', urgency: 'urgent' });
  assert.equal(patched.status, 'classified');
  assert.equal(patched.caseType, 'obstruction');
  assert.equal(patched.urgency, 'urgent');
  assert.equal(patched.description, '單車');
});

test('demo data covers six distinct workflow situations', () => {
  assert.equal(INITIAL_ADMIN_REPORTS.length >= 6, true);
  assert.equal(INITIAL_ADMIN_REPORTS.every((report) => report.demoMode === true), true);
  assert.equal(INITIAL_ADMIN_REPORTS.some((report) => report.status === 'clearance_approved'), true);
  assert.equal(INITIAL_ADMIN_REPORTS.some((report) => report.isDuplicate), true);
});

test('phase 1 demo data covers five departments, ten teams and a six-step joint operation', () => {
  assert.equal(new Set(DEMO_TEAMS.map((team) => team.department)).size, 5);
  assert.equal(DEMO_TEAMS.length, 10);
  assert.equal(INITIAL_JOINT_OPERATIONS.length >= 1, true);
  const operation = INITIAL_JOINT_OPERATIONS[0];
  assert.equal(operation.mandatoryWorkOrderIds.length, 6);
  assert.equal(operation.mandatoryWorkOrderIds.every((id) => INITIAL_WORK_ORDERS.some((order) => order.id === id)), true);
});
