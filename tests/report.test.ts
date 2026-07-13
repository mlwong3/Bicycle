import assert from 'node:assert/strict';
import test from 'node:test';
import { getCitizenStatusLabel } from '../src/admin';

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
