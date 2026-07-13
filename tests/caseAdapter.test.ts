import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAdminPatch, toAdminReport, toPublicReport } from '../src/caseAdapter';
import { INITIAL_ADMIN_REPORTS } from '../src/demoData';

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
  assert.equal(INITIAL_ADMIN_REPORTS.length, 6);
  assert.equal(INITIAL_ADMIN_REPORTS.every((report) => report.demoMode === true), true);
  assert.equal(INITIAL_ADMIN_REPORTS.some((report) => report.status === 'clearance_approved'), true);
  assert.equal(INITIAL_ADMIN_REPORTS.some((report) => report.isDuplicate), true);
});
