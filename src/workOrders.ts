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
  if (order.executableAfter && Date.parse(order.executableAfter) > now.getTime()) return false;
  return order.prerequisiteWorkOrderIds.every((id) => allOrders.find((item) => item.id === id)?.status === 'completed');
}

export function applyWorkOrderTransition(
  order: WorkOrder,
  nextStatus: WorkOrderStatus,
  actorUid: string,
  at: string,
  reason = '',
): WorkOrder {
  if (!canTransitionWorkOrder(order.status, nextStatus)) return order;
  if (nextStatus === 'completed' && order.evidenceChecklist.some((item) => !item.completed)) return order;
  if ((nextStatus === 'blocked' || nextStatus === 'declined') && !reason.trim()) return order;

  return {
    ...order,
    status: nextStatus,
    updatedAt: at,
    ...(nextStatus === 'blocked' ? { blockerReason: reason.trim() } : {}),
    ...(!['blocked'].includes(nextStatus) ? { blockerReason: undefined } : {}),
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
