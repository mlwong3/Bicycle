export type ReportStatus = 'pending' | 'reviewing' | 'noticed' | 'scheduled' | 'resolved' | 'dismissed';

export interface StatusHistoryEntry {
  status: ReportStatus;
  at: string;
  by: string;
  note?: string;
}

type ReportWithWorkflow = {
  status: ReportStatus;
  statusHistory?: StatusHistoryEntry[];
  handledBy?: string;
};

type ReportWithCoordinates = {
  status: ReportStatus;
  lat?: number;
  lng?: number;
};

export const ADMIN_SESSION_KEY = 'bike_trace:admin_demo_session';

const ALLOWED_NEXT_STATUSES: Record<ReportStatus, ReportStatus[]> = {
  pending: ['reviewing', 'dismissed'],
  reviewing: ['noticed', 'dismissed'],
  noticed: ['scheduled', 'dismissed'],
  scheduled: ['resolved', 'dismissed'],
  resolved: [],
  dismissed: [],
};

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: '待審核',
  reviewing: '覆核中',
  noticed: '已貼告示',
  scheduled: '已排程',
  resolved: '已清理',
  dismissed: '不成立',
};

const CITIZEN_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: '待審核',
  reviewing: '處理中',
  noticed: '處理中',
  scheduled: '處理中',
  resolved: '已清理',
  dismissed: '不成立',
};

export function getAllowedNextStatuses(status: ReportStatus): ReportStatus[] {
  return ALLOWED_NEXT_STATUSES[status];
}

export function getStatusLabel(status: ReportStatus): string {
  return STATUS_LABELS[status];
}

export function getCitizenStatusLabel(status: ReportStatus): string {
  return CITIZEN_STATUS_LABELS[status];
}

export function appendStatusHistory<T extends ReportWithWorkflow>(
  report: T,
  nextStatus: ReportStatus,
  actor: string,
  note: string | undefined,
  at: string,
): Omit<T, 'status' | 'statusHistory' | 'handledBy'> & {
  status: ReportStatus;
  statusHistory: StatusHistoryEntry[];
  handledBy: string;
} {
  return {
    ...report,
    status: nextStatus,
    handledBy: actor,
    statusHistory: [
      ...(report.statusHistory || []),
      { status: nextStatus, at, by: actor, ...(note?.trim() ? { note: note.trim() } : {}) },
    ],
  };
}

export function getPatrolEligibleReports<T extends ReportWithCoordinates>(reports: T[]): T[] {
  return reports.filter((report) =>
    (report.status === 'noticed' || report.status === 'scheduled') &&
    Number.isFinite(report.lat) &&
    Number.isFinite(report.lng),
  );
}

export function isAdminPasswordValid(input: string, expected: string): boolean {
  return input.trim() !== '' && input === expected;
}

export function hasAdminSession(): boolean {
  return typeof window !== 'undefined' && window.sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
}

export function startAdminSession(): void {
  if (typeof window !== 'undefined') window.sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
}

export function endAdminSession(): void {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
}
