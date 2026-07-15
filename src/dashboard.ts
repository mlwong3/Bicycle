import { isWorkOrderReady } from './workOrders';
import type {
  AdminReport,
  DashboardFilters,
  DepartmentCode,
  DepartmentLoad,
  JointOperation,
  WorkOrder,
} from './types';

const DEPARTMENTS: readonly DepartmentCode[] = ['HAD', 'TD', 'LandsD', 'FEHD', 'HKPF'];

export interface DashboardView {
  summary: {
    unclassifiedCases: number;
    immediateDanger: number;
    awaitingAcceptance: number;
    scheduled: number;
    blockedOrOverdue: number;
    todayJointOperations: number;
  };
  priorityItems: Array<{ workOrderId: string; caseId: string; reason: string; rank: number }>;
  departmentLoads: Record<DepartmentCode, DepartmentLoad>;
  operationReadiness: Array<{ jointOperationId: string; completed: number; mandatory: number; ready: boolean }>;
  todayExecutableWorkOrderIds: string[];
}

function datePart(value: string | undefined): string | undefined {
  return value?.slice(0, 10);
}

function workOrderDate(order: WorkOrder): string | undefined {
  return datePart(order.scheduledAt ?? order.createdAt);
}

function dateMatches(value: string | undefined, date: string): boolean {
  return !date || date === 'all' || datePart(value) === date;
}

function isOverdue(order: WorkOrder, now: Date): boolean {
  if (!order.dueAt) return false;
  const dueAt = Date.parse(order.dueAt);
  return Number.isFinite(dueAt) && dueAt < now.getTime();
}

function priorityClass(order: WorkOrder, now: Date): { rank: number; reason: string } {
  if (order.priority === 'emergency') return { rank: 1, reason: '緊急工作單' };
  if (order.status === 'blocked') return { rank: 2, reason: '工作單已阻塞' };
  if (isOverdue(order, now)) return { rank: 3, reason: '已逾期' };
  if (order.status === 'awaiting_acceptance') return { rank: 4, reason: '等待團隊確認' };
  if (order.taskType === 'jurisdiction_review') return { rank: 5, reason: '權責覆核' };
  return { rank: 6, reason: '一般工作單' };
}

function compareDueAt(left: WorkOrder, right: WorkOrder): number {
  const leftDue = left.dueAt ? Date.parse(left.dueAt) : Number.POSITIVE_INFINITY;
  const rightDue = right.dueAt ? Date.parse(right.dueAt) : Number.POSITIVE_INFINITY;
  const safeLeft = Number.isFinite(leftDue) ? leftDue : Number.POSITIVE_INFINITY;
  const safeRight = Number.isFinite(rightDue) ? rightDue : Number.POSITIVE_INFINITY;
  return safeLeft - safeRight || left.id.localeCompare(right.id);
}

function createDepartmentLoads(): Record<DepartmentCode, DepartmentLoad> {
  return Object.fromEntries(DEPARTMENTS.map((department) => [department, {
    awaitingAcceptance: 0,
    scheduled: 0,
    inProgress: 0,
    blocked: 0,
    completedToday: 0,
  }])) as Record<DepartmentCode, DepartmentLoad>;
}

export function buildDashboardView(
  reports: AdminReport[],
  orders: WorkOrder[],
  operations: JointOperation[],
  filters: DashboardFilters,
  now: Date,
): DashboardView {
  const filteredOrders = orders.filter((order) => (
    (filters.district === 'all' || order.district === filters.district)
    && (filters.department === 'all' || order.leadDepartment === filters.department)
    && dateMatches(workOrderDate(order), filters.date)
    && (filters.status === 'all' || order.status === filters.status)
  ));
  const filteredOrderIds = new Set(filteredOrders.map((order) => order.id));
  const filteredCaseIds = new Set(filteredOrders.map((order) => order.caseId));
  const filteredReports = reports.filter((report) => filteredCaseIds.has(report.id));

  const priorityOrders = [...filteredOrders]
    .map((order) => ({ order, ...priorityClass(order, now) }))
    .sort((left, right) => left.rank - right.rank || compareDueAt(left.order, right.order));
  const priorityItems = priorityOrders.map(({ order, reason }, index) => ({
    workOrderId: order.id,
    caseId: order.caseId,
    reason,
    rank: index + 1,
  }));

  const departmentLoads = createDepartmentLoads();
  for (const order of filteredOrders) {
    const load = departmentLoads[order.leadDepartment];
    if (order.status === 'awaiting_acceptance') load.awaitingAcceptance += 1;
    if (order.status === 'scheduled') load.scheduled += 1;
    if (order.status === 'in_progress') load.inProgress += 1;
    if (order.status === 'blocked') load.blocked += 1;
    if (order.status === 'completed' && dateMatches(order.updatedAt, filters.date)) load.completedToday += 1;
  }

  const operationReadiness = operations
    .filter((operation) => dateMatches(operation.actionDate, filters.date))
    .filter((operation) => operation.mandatoryWorkOrderIds.some((id) => filteredOrderIds.has(id)))
    .map((operation) => {
      const mandatoryOrders = operation.mandatoryWorkOrderIds
        .filter((id) => filteredOrderIds.has(id))
        .map((id) => filteredOrders.find((order) => order.id === id) as WorkOrder);
      const completed = mandatoryOrders.filter((order) => order.status === 'completed').length;
      return {
        jointOperationId: operation.id,
        completed,
        mandatory: mandatoryOrders.length,
        ready: mandatoryOrders.length > 0 && completed === mandatoryOrders.length,
      };
    });

  const todayExecutableWorkOrderIds = filteredOrders
    .filter((order) => order.status === 'scheduled' && dateMatches(order.scheduledAt, filters.date))
    .filter((order) => isWorkOrderReady(order, orders, now))
    .map((order) => order.id);

  const emergencyCaseIds = new Set(
    filteredReports.filter((report) => report.urgency === 'emergency').map((report) => report.id),
  );
  const emergencyOrderCaseIds = new Set(
    filteredOrders.filter((order) => order.priority === 'emergency').map((order) => order.caseId),
  );

  return {
    summary: {
      unclassifiedCases: filteredReports.filter((report) => report.status === 'pending' || report.status === 'reviewing').length,
      immediateDanger: new Set([...emergencyCaseIds, ...emergencyOrderCaseIds]).size,
      awaitingAcceptance: filteredOrders.filter((order) => order.status === 'awaiting_acceptance').length,
      scheduled: filteredOrders.filter((order) => order.status === 'scheduled').length,
      blockedOrOverdue: filteredOrders.filter((order) => order.status === 'blocked' || isOverdue(order, now)).length,
      todayJointOperations: operationReadiness.length,
    },
    priorityItems,
    departmentLoads,
    operationReadiness,
    todayExecutableWorkOrderIds,
  };
}
