import assert from 'node:assert/strict';
import test from 'node:test';
import { getCitizenStatusLabel } from '../src/admin';
import { createCitizenReport } from '../src/reportWorkflow';

test('citizen status mapping hides internal workflow details', () => {
  assert.equal(getCitizenStatusLabel('noticed'), '處理中');
  assert.equal(getCitizenStatusLabel('scheduled'), '處理中');
  assert.equal(getCitizenStatusLabel('resolved'), '已清理');
  assert.equal(getCitizenStatusLabel('dismissed'), '不成立');
});

test('all internal statuses have citizen-facing labels', () => {
  for (const status of ['pending', 'reviewing', 'noticed', 'scheduled', 'resolved', 'dismissed'] as const) {
    assert.notEqual(getCitizenStatusLabel(status), undefined);
  }
});

test('citizen submissions retain GPS coordinates and begin with a pending history entry', () => {
  const report = createCitizenReport({
    id: 'report-gps',
    location: '沙田單車徑',
    lat: 22.3875,
    lng: 114.1915,
    description: '單車阻塞通道',
    date: '2026-07-13',
    at: '2026-07-13T09:00:00.000Z',
  });

  assert.equal(report.status, 'pending');
  assert.equal(report.lat, 22.3875);
  assert.equal(report.lng, 114.1915);
  assert.deepEqual(report.statusHistory, [{ status: 'pending', at: '2026-07-13T09:00:00.000Z', by: 'citizen' }]);
});
