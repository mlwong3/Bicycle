import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAdminPatch, toAdminReport, applyPatrolConfirmation } from '../src/caseAdapter';
import { buildPatrolOrder } from '../src/patrol';
import { isRouteEligible } from '../src/reportStatus';

test('demo flow requires human clearance before route confirmation', () => {
  const initial = toAdminReport({
    id: 'flow-1',
    location: '大埔海濱公園',
    lat: 22.451,
    lng: 114.177,
    description: '單車阻塞行人通道',
    citizenTags: ['obstruction'],
    status: 'pending',
    date: '2026-07-13',
  });
  const reviewing = applyAdminPatch(initial, { status: 'reviewing' }, 'admin-demo', '開始覆核');
  const classified = applyAdminPatch(reviewing, { status: 'classified', caseType: 'obstruction' }, 'admin-demo', '已完成分類');
  const fieldReview = applyAdminPatch(classified, { status: 'field_review_required' }, 'admin-demo', '需要現場確認');
  const notice = applyAdminPatch(fieldReview, { status: 'notice_issued' }, 'admin-demo', '記錄示範通知');
  const expired = applyAdminPatch(notice, { status: 'deadline_expired' }, 'admin-demo', '示範期限已屆滿');
  const cleared = applyAdminPatch(expired, { status: 'clearance_approved', procedureConfirmed: true }, 'admin-demo', '管理員確認可巡查');

  assert.equal(isRouteEligible(classified), false);
  assert.equal(isRouteEligible(cleared), true);
  assert.equal(cleared.statusHistory?.at(-1)?.status, 'clearance_approved');

  const route = buildPatrolOrder(
    { lat: 22.38, lng: 114.18 },
    [cleared],
    { travelMode: 'inspection-driving', maxStops: 5, serviceMinutesPerStop: 10 },
  );
  assert.deepEqual(route.reportIds, ['flow-1']);

  const scheduled = applyPatrolConfirmation([cleared], route, 'admin-demo', '2026-07-13T12:00:00.000Z');
  assert.equal(scheduled[0].status, 'scheduled');
  assert.equal(scheduled[0].patrolRouteId, 'demo-route');
  assert.equal(scheduled[0].events?.at(-1)?.action, 'route_assigned');
});
