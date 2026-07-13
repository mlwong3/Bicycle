import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_SESSION_KEY,
  appendStatusHistory,
  endAdminSession,
  getAllowedNextStatuses,
  getPatrolEligibleReports,
  hasAdminSession,
  isAdminPasswordValid,
  startAdminSession,
} from '../src/admin';
import { isInlineReportImage } from '../src/reportMedia';

test('pending only advances to reviewing or dismissed', () => {
  assert.deepEqual(getAllowedNextStatuses('pending'), ['reviewing', 'dismissed']);
});

test('status update appends history without removing existing entries', () => {
  const report = {
    id: 'r1',
    location: '沙田',
    description: '阻路',
    status: 'pending' as const,
    date: '2026-07-13',
    statusHistory: [{ status: 'pending' as const, at: '2026-07-13T09:00:00.000Z', by: 'citizen' }],
  };

  const updated = appendStatusHistory(report, 'reviewing', 'admin-demo', '已接收', '2026-07-13T10:00:00.000Z');

  assert.equal(updated.status, 'reviewing');
  assert.equal(updated.statusHistory?.length, 2);
  assert.equal(updated.statusHistory?.[0].status, 'pending');
});

test('patrol candidates require coordinates and an actionable status', () => {
  const reports = [
    { id: 'a', status: 'noticed' as const, lat: 22.38, lng: 114.18 },
    { id: 'b', status: 'scheduled' as const },
    { id: 'c', status: 'resolved' as const, lat: 22.39, lng: 114.19 },
  ];

  assert.deepEqual(getPatrolEligibleReports(reports).map((report) => report.id), ['a']);
});

test('legacy reports without history stay valid but cannot become patrol candidates', () => {
  const legacy = {
    id: 'legacy',
    location: '大埔',
    description: '單車',
    status: 'pending' as const,
    date: '2026-06-19',
  };

  assert.deepEqual(getPatrolEligibleReports([legacy]), []);
});

test('only image data URLs are eligible for report image upload', () => {
  assert.equal(isInlineReportImage('data:image/png;base64,AAA'), true);
  assert.equal(isInlineReportImage('https://example.com/bike.jpg'), false);
  assert.equal(isInlineReportImage('data:text/plain;base64,AAA'), false);
  assert.equal(isInlineReportImage(undefined), false);
});

test('admin session uses a dedicated session key and is cleared on logout', () => {
  const storage = new Map<string, string>();
  const originalWindow = globalThis.window;

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: (key: string) => storage.get(key) || null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    },
  });

  try {
    assert.equal(ADMIN_SESSION_KEY, 'bike_trace:admin_demo_session');
    assert.equal(isAdminPasswordValid('admin2026', 'admin2026'), true);
    assert.equal(isAdminPasswordValid('wrong', 'admin2026'), false);
    assert.equal(hasAdminSession(), false);
    startAdminSession();
    assert.equal(hasAdminSession(), true);
    endAdminSession();
    assert.equal(hasAdminSession(), false);
  } finally {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  }
});
