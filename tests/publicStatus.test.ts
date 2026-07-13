import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_REPORT_STATUSES, getPublicStatusLabel } from '../src/reportStatus';
import { createCitizenReport } from '../src/reportWorkflow';

test('citizen submission retains tags and location source', () => {
  const report = createCitizenReport({
    id: 'r-tags',
    location: '示範地點',
    description: '阻塞通道',
    citizenTags: ['obstruction'],
    locationSource: 'manual',
    date: '2026-07-13',
    at: '2026-07-13T10:00:00.000Z',
  });
  assert.deepEqual(report.citizenTags, ['obstruction']);
  assert.equal(report.locationSource, 'manual');
});

test('all internal states have a public label', () => {
  for (const status of ALL_REPORT_STATUSES) assert.ok(getPublicStatusLabel(status));
});
