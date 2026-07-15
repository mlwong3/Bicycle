import type { WorkOrder, WorkOrderStatus } from './types';

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

export function canTransitionWorkOrder(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return NEXT[from].includes(to);
}

export function isWorkOrderReady(order: WorkOrder, allOrders: WorkOrder[], now: Date): boolean {
  const executableAfter = Date.parse(order.executableAfter ?? '');
  if (!order.assignedTeamId || !Number.isFinite(executableAfter) || !Number.isFinite(now.getTime()) || executableAfter > now.getTime()) return false;
  return order.prerequisiteWorkOrderIds.every((id) => allOrders.find((item) => item.id === id)?.status === 'completed');
}

function withoutBlockerReason(order: WorkOrder): WorkOrder {
  const { blockerReason, ...orderWithoutBlockerReason } = order;
  return orderWithoutBlockerReason;
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
