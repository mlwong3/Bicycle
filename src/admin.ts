import {
  getAllowedNextStatuses as getWorkflowAllowedNextStatuses,
  getStatusLabel as getWorkflowStatusLabel,
  getPublicStatusLabel,
} from './reportStatus';
import type { ReportStatus, StatusHistoryEntry } from './types';

export type { ReportStatus, StatusHistoryEntry } from './types';

type ReportWithWorkflow = {
  status: ReportStatus;
  statusHistory?: StatusHistoryEntry[];
  handledBy?: string;
};

type ReportWithCoordinates = {
  status: string;
  lat?: number;
  lng?: number;
};

export const ADMIN_SESSION_KEY = 'bike_trace:admin_demo_session';

export function getAllowedNextStatuses(status: ReportStatus): ReportStatus[] {
  return getWorkflowAllowedNextStatuses(status);
}

export function getStatusLabel(status: ReportStatus): string {
  return getWorkflowStatusLabel(status);
}

export function getCitizenStatusLabel(status: ReportStatus): string {
  return getPublicStatusLabel(status);
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
