import { calculatePriorityScore } from './priority';
import { isWorkOrderReady } from './workOrders';
import type { AdminReport, Coordinates, DepartmentCode, PatrolOptions, PatrolRouteDraft, PatrolTaskGroup, WorkOrder } from './types';

const SPEED_KMH: Record<PatrolOptions['travelMode'], number> = { 'inspection-walking': 4.5, 'inspection-driving': 10, 'clearance-vehicle': 10 };
const TASK_GROUP: Record<WorkOrder['taskType'], PatrolTaskGroup> = {
  jurisdiction_review: 'verification', safety_response: 'verification', site_verification: 'verification',
  suspension_notice: 'notice', site_closure: 'notice', statutory_notice: 'notice', removal: 'removal',
  custody_disposal: 'removal', coordination_closeout: 'verification',
};

export function haversineDistanceKm(a: Coordinates, b: Coordinates): number {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => value * Math.PI / 180;
  const dLat = toRadians(b.lat - a.lat); const dLng = toRadians(b.lng - a.lng);
  const latA = toRadians(a.lat); const latB = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function emptyRoute(start: Coordinates, options: PatrolOptions, department: DepartmentCode, actionDate: string): PatrolRouteDraft {
  return { workOrderIds: [], orderedStops: [], department, actionDate, taskGroup: options.taskGroup, startPoint: start, travelMode: options.travelMode, estimatedDistanceKm: 0, initialDistanceKm: 0, estimatedTravelMinutesRange: { min: 0, max: 0 }, algorithm: 'nearest-neighbor-2opt', routeSource: options.routeSource || 'straight-line-estimate', status: 'draft' };
}

function routeDistance(start: Coordinates, points: Coordinates[]): number {
  let distance = 0; let current = start;
  for (const point of points) { distance += haversineDistanceKm(current, point); current = point; }
  return distance;
}

function nearestNeighbour(start: Coordinates, items: Array<{ order: WorkOrder; report: AdminReport; priorityScore: number }>): Array<{ order: WorkOrder; report: AdminReport; priorityScore: number }> {
  const remaining = items.slice(); const ordered: typeof items = []; let current = start;
  while (remaining.length > 0) {
    remaining.sort((a, b) => { const difference = haversineDistanceKm(current, { lat: a.report.lat as number, lng: a.report.lng as number }) - haversineDistanceKm(current, { lat: b.report.lat as number, lng: b.report.lng as number }); return Math.abs(difference) > 1e-9 ? difference : a.order.id.localeCompare(b.order.id); });
    const next = remaining.shift(); if (!next) break; ordered.push(next); current = { lat: next.report.lat as number, lng: next.report.lng as number };
  }
  return ordered;
}

function improveWithTwoOpt(start: Coordinates, items: Array<{ order: WorkOrder; report: AdminReport; priorityScore: number }>): typeof items {
  let best = items.slice(); let bestDistance = routeDistance(start, best.map((item) => ({ lat: item.report.lat as number, lng: item.report.lng as number })));
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i += 1) for (let j = i + 1; j < best.length; j += 1) {
      const candidate = best.slice(0, i).concat(best.slice(i, j + 1).reverse(), best.slice(j + 1));
      const distance = routeDistance(start, candidate.map((item) => ({ lat: item.report.lat as number, lng: item.report.lng as number })));
      if (distance + 1e-9 < bestDistance) { best = candidate; bestDistance = distance; improved = true; }
    }
  }
  return best;
}

export function buildWorkOrderPatrolRoute(start: Coordinates, workOrders: WorkOrder[], reports: AdminReport[], options: PatrolOptions, department: DepartmentCode, actionDate: string): PatrolRouteDraft {
  const compatibleMode = options.travelMode === 'clearance-vehicle' ? options.taskGroup === 'removal' : options.taskGroup === 'verification' || options.taskGroup === 'notice';
  if (!compatibleMode) return emptyRoute(start, options, department, actionDate);
  const now = new Date(`${actionDate}T23:59:59.999Z`);
  if (!Number.isFinite(now.getTime())) return emptyRoute(start, options, department, actionDate);
  const reportById = new Map(reports.map((report) => [report.id, report]));
  const maxStops = Math.min(8, Math.max(1, Math.floor(options.maxStops)));
  const eligible = workOrders
    .filter((order) => order.status === 'scheduled' && order.leadDepartment === department && order.scheduledAt?.slice(0, 10) === actionDate && TASK_GROUP[order.taskType] === options.taskGroup)
    .filter((order) => isWorkOrderReady(order, workOrders, now))
    .map((order) => ({ order, report: reportById.get(order.caseId) }))
    .filter((item): item is { order: WorkOrder; report: AdminReport } => Boolean(item.report) && Number.isFinite(item.report.lat) && Number.isFinite(item.report.lng) && item.report.coordinatesValid !== false)
    .map((item) => ({ ...item, priorityScore: calculatePriorityScore(item.report, now) }))
    .sort((a, b) => b.priorityScore - a.priorityScore || a.order.id.localeCompare(b.order.id))
    .slice(0, maxStops);
  const initial = nearestNeighbour(start, eligible);
  const initialDistanceKm = routeDistance(start, initial.map((item) => ({ lat: item.report.lat as number, lng: item.report.lng as number })));
  const ordered = improveWithTwoOpt(start, initial);
  const estimatedDistanceKm = routeDistance(start, ordered.map((item) => ({ lat: item.report.lat as number, lng: item.report.lng as number })));
  const speed = SPEED_KMH[options.travelMode]; const travelMinutes = speed > 0 ? estimatedDistanceKm / speed * 60 : 0; const serviceMinutes = ordered.length * Math.max(0, options.serviceMinutesPerStop);
  return { workOrderIds: ordered.map((item) => item.order.id), orderedStops: ordered.map((item, index) => ({ workOrderId: item.order.id, caseId: item.order.caseId, order: index + 1, priorityScore: item.priorityScore, estimatedServiceMinutes: Math.max(0, options.serviceMinutesPerStop) })), department, actionDate, taskGroup: options.taskGroup, startPoint: start, travelMode: options.travelMode, estimatedDistanceKm: Math.round(estimatedDistanceKm * 100) / 100, initialDistanceKm: Math.round(initialDistanceKm * 100) / 100, estimatedTravelMinutesRange: { min: Math.round(travelMinutes + serviceMinutes), max: Math.round(travelMinutes * 1.5 + serviceMinutes) }, algorithm: 'nearest-neighbor-2opt', routeSource: options.routeSource || 'straight-line-estimate', status: 'draft' };
}
