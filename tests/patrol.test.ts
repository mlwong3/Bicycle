import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPatrolOrder, haversineDistanceKm } from '../src/patrol';
import type { AdminReport, PatrolOptions } from '../src/types';

const START = { lat: 22.38, lng: 114.18 };
const OPTIONS: PatrolOptions = {
  travelMode: 'inspection-walking',
  maxStops: 8,
  serviceMinutesPerStop: 12,
};

function makeEligibleReports(count: number): AdminReport[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `eligible-${index}`,
    location: `示範地點 ${index}`,
    description: '單車阻塞通道',
    date: '2026-07-13',
    status: 'clearance_approved' as const,
    lat: 22.38 + index * 0.001,
    lng: 114.18 + index * 0.001,
    locationSource: 'gps' as const,
    caseType: 'obstruction' as const,
    urgency: 'urgent' as const,
    procedureConfirmed: true,
    coordinatesValid: true,
    isDuplicate: false,
  }));
}

test('patrol planner selects at most the configured five to eight stops', () => {
  const route = buildPatrolOrder(START, makeEligibleReports(9), {
    ...OPTIONS,
    maxStops: 5,
  });
  assert.equal(route.reportIds.length, 5);
  assert.equal(route.algorithm, 'nearest-neighbor-2opt');
});

test('same inputs produce the same order and 2-opt does not increase distance', () => {
  const reports = makeEligibleReports(6);
  const first = buildPatrolOrder(START, reports, OPTIONS);
  const second = buildPatrolOrder(START, reports, OPTIONS);
  assert.deepEqual(first.reportIds, second.reportIds);
  assert.equal(first.estimatedDistanceKm <= first.initialDistanceKm, true);
});

test('route draft uses a limitation label when no map route is available', () => {
  const route = buildPatrolOrder(START, makeEligibleReports(2), {
    ...OPTIONS,
    routeSource: 'straight-line-estimate',
  });
  assert.equal(route.routeSource, 'straight-line-estimate');
  assert.equal(haversineDistanceKm(START, START), 0);
});

test('ineligible reports are excluded before ordering', () => {
  const reports = [...makeEligibleReports(2), { ...makeEligibleReports(1)[0], id: 'not-ready', procedureConfirmed: false }];
  const route = buildPatrolOrder(START, reports, OPTIONS);
  assert.equal(route.reportIds.includes('not-ready'), false);
});
