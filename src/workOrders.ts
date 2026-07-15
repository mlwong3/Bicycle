import type { Team, WorkOrder, WorkOrderHistoryEntry, WorkOrderStatus } from './types';

const NEXT: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  draft: ['awaiting_acceptance', 'cancelled'],
  awaiting_acceptance: ['accepted', 'declined', 'cancelled'],
  accepted: ['scheduled', 'blocked', 'cancelled'],
  scheduled: ['in_progress', 'blocked', 'cancelled'],
  in_progress: ['completed', 'blocked'],
  completed: [],
  blocked: ['accepted', 'scheduled', 'in_progress', 'cancelled'],
  declined: ['awaiting_acceptance', 'cancelled'],
  cancelled: [],
};

const CANONICAL_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function canTransitionWorkOrder(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return NEXT[from].includes(to);
}

export function isWorkOrderReady(order: WorkOrder, allOrders: WorkOrder[], now: Date): boolean {
  let executableAfter: number | undefined;
  if (order.executableAfter !== undefined) {
    if (!CANONICAL_UTC_TIMESTAMP.test(order.executableAfter)) return false;
    const parsedExecutableAfter = new Date(order.executableAfter);
    if (!Number.isFinite(parsedExecutableAfter.getTime()) || parsedExecutableAfter.toISOString() !== order.executableAfter) return false;
    executableAfter = parsedExecutableAfter.getTime();
  }
  if (!order.assignedTeamId || !Number.isFinite(now.getTime()) || (executableAfter !== undefined && executableAfter > now.getTime())) return false;
  return order.prerequisiteWorkOrderIds.every((id) => allOrders.find((item) => item.id === id)?.status === 'completed');
}

function withoutBlockerReason(order: WorkOrder): WorkOrder {
  const { blockerReason, ...orderWithoutBlockerReason } = order;
  return orderWithoutBlockerReason;
}

function teamCanTakeOrder(order: WorkOrder, team: Team): boolean {
  return team.department === order.leadDepartment
    && team.onDuty
    && team.districts.includes(order.district)
    && order.requiredCapabilities.every((item) => team.capabilities.includes(item))
    && order.requiredEquipment.every((item) => team.equipment.includes(item));
}

export function assignWorkOrder(
  order: WorkOrder,
  team: Team,
  actorUid: string,
  at: string,
  reason = '',
): WorkOrder {
  if (!teamCanTakeOrder(order, team)) return order;
  const isReassignment = Boolean(order.assignedTeamId && order.assignedTeamId !== team.id);
  if (isReassignment && !reason.trim()) return order;
  const entry: WorkOrderHistoryEntry = {
    at,
    actorUid,
    action: isReassignment ? 'reassigned' : 'assigned',
    ...(reason.trim() ? { reason: reason.trim() } : {}),
  };
  return {
    ...order,
    assignedTeamId: team.id,
    status: 'awaiting_acceptance',
    updatedAt: at,
    assignmentHistory: [...order.assignmentHistory, entry],
  };
}

export function applyWorkOrderTransition(
  order: WorkOrder,
  nextStatus: WorkOrderStatus,
  actorUid: string,
  at: string,
  reason: string,
  allOrders: WorkOrder[],
  now: Date,
): WorkOrder {
  if (!canTransitionWorkOrder(order.status, nextStatus)) return order;
  if (nextStatus === 'in_progress' && !isWorkOrderReady(order, allOrders, now)) return order;
  if (nextStatus === 'completed' && order.evidenceChecklist.some((item) => !item.completed)) return order;
  if ((nextStatus === 'blocked' || nextStatus === 'declined') && !reason.trim()) return order;

  return {
    ...(nextStatus === 'blocked' ? order : withoutBlockerReason(order)),
    status: nextStatus,
    updatedAt: at,
    ...(nextStatus === 'blocked' ? { blockerReason: reason.trim() } : {}),
    assignmentHistory: [...order.assignmentHistory, {
      at,
      actorUid,
      action: nextStatus === 'blocked' ? 'blocked' : nextStatus === 'declined' ? 'declined' : 'status_changed',
      fromStatus: order.status,
      toStatus: nextStatus,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    }],
  };
}
