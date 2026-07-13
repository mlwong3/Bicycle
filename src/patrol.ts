import { isRouteEligible } from './reportStatus';
import { calculatePriorityScore } from './priority';
import type { AdminReport, Coordinates, PatrolOptions, PatrolRouteDraft } from './types';

const SPEED_KMH: Record<PatrolOptions['travelMode'], number> = {
  'inspection-walking': 4.5,
  'inspection-driving': 10,
  'clearance-vehicle': 10,
};

export function haversineDistanceKm(a: Coordinates, b: Coordinates): number {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => value * Math.PI / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const latA = toRadians(a.lat);
  const latB = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function coordinateOf(report: AdminReport): Coordinates {
  return { lat: report.lat as number, lng: report.lng as number };
}

function routeDistance(start: Coordinates, reports: AdminReport[]): number {
  let distance = 0;
  let current = start;
  for (const report of reports) {
    const next = coordinateOf(report);
    distance += haversineDistanceKm(current, next);
    current = next;
  }
  return distance;
}

function improveWithTwoOpt(start: Coordinates, reports: AdminReport[]): AdminReport[] {
  let best = reports.slice();
  let bestDistance = routeDistance(start, best);
  let improved = true;

  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i += 1) {
      for (let j = i + 1; j < best.length; j += 1) {
        const candidate = best.slice(0, i)
          .concat(best.slice(i, j + 1).reverse(), best.slice(j + 1));
        const candidateDistance = routeDistance(start, candidate);
        if (candidateDistance + 1e-9 < bestDistance) {
          best = candidate;
          bestDistance = candidateDistance;
          improved = true;
        }
      }
    }
  }
  return best;
}

function nearestNeighbour(start: Coordinates, reports: AdminReport[]): AdminReport[] {
  const remaining = reports.slice();
  const ordered: AdminReport[] = [];
  let current = start;
  while (remaining.length > 0) {
    remaining.sort((a, b) => {
      const distanceDifference = haversineDistanceKm(current, coordinateOf(a)) - haversineDistanceKm(current, coordinateOf(b));
      return Math.abs(distanceDifference) > 1e-9 ? distanceDifference : a.id.localeCompare(b.id);
    });
    const next = remaining.shift();
    if (!next) break;
    ordered.push(next);
    current = coordinateOf(next);
  }
  return ordered;
}

export function buildPatrolOrder(
  start: Coordinates,
  reports: AdminReport[],
  options: PatrolOptions,
): PatrolRouteDraft {
  const maxStops = Math.min(8, Math.max(1, Math.floor(options.maxStops)));
  const now = new Date();
  const eligible = reports
    .filter((report) => isRouteEligible(report) && Number.isFinite(report.lat) && Number.isFinite(report.lng))
    .map((report) => ({ report, priorityScore: calculatePriorityScore(report, now) }))
    .sort((a, b) => b.priorityScore - a.priorityScore || a.report.id.localeCompare(b.report.id))
    .slice(0, maxStops);
  const selected = eligible.map((item) => item.report);
  const initialOrder = nearestNeighbour(start, selected);
  const initialDistanceKm = routeDistance(start, initialOrder);
  const ordered = improveWithTwoOpt(start, initialOrder);
  const estimatedDistanceKm = routeDistance(start, ordered);
  const speed = SPEED_KMH[options.travelMode];
  const travelMinutes = speed > 0 ? estimatedDistanceKm / speed * 60 : 0;
  const serviceMinutes = ordered.length * Math.max(0, options.serviceMinutesPerStop);

  return {
    reportIds: ordered.map((report) => report.id),
    orderedStops: ordered.map((report, index) => ({
      reportId: report.id,
      order: index + 1,
      priorityScore: calculatePriorityScore(report, now),
      estimatedServiceMinutes: Math.max(0, options.serviceMinutesPerStop),
    })),
    startPoint: start,
    travelMode: options.travelMode,
    estimatedDistanceKm: Math.round(estimatedDistanceKm * 100) / 100,
    initialDistanceKm: Math.round(initialDistanceKm * 100) / 100,
    estimatedTravelMinutesRange: {
      min: Math.round(travelMinutes + serviceMinutes),
      max: Math.round(travelMinutes * 1.5 + serviceMinutes),
    },
    algorithm: 'nearest-neighbor-2opt',
    routeSource: options.routeSource || 'straight-line-estimate',
    status: 'draft',
  };
}
