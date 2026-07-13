import type { AdminReport, PublicReport, ReportStatus } from './types';

export const ALL_REPORT_STATUSES: readonly ReportStatus[] = [
  'pending',
  'reviewing',
  'classified',
  'field_review_required',
  'notice_issued',
  'deadline_expired',
  'clearance_approved',
  'scheduled',
  'in_progress',
  'resolved',
  'needs_information',
  'duplicate',
  'dismissed',
];

const ALLOWED_NEXT_STATUSES: Record<ReportStatus, readonly ReportStatus[]> = {
  pending: ['reviewing', 'dismissed'],
  reviewing: ['classified', 'needs_information', 'dismissed'],
  classified: ['field_review_required', 'notice_issued', 'needs_information', 'duplicate', 'dismissed'],
  field_review_required: ['classified', 'notice_issued', 'needs_information', 'duplicate', 'dismissed'],
  notice_issued: ['deadline_expired', 'field_review_required', 'dismissed'],
  deadline_expired: ['clearance_approved', 'field_review_required', 'dismissed'],
  clearance_approved: ['scheduled', 'field_review_required', 'dismissed'],
  scheduled: ['in_progress', 'dismissed'],
  in_progress: ['resolved', 'field_review_required'],
  resolved: [],
  needs_information: ['reviewing', 'classified', 'dismissed'],
  duplicate: [],
  dismissed: [],
};

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: '待審核',
  reviewing: '覆核中',
  classified: '已分類',
  field_review_required: '需要現場覆核',
  notice_issued: '已記錄通知',
  deadline_expired: '期限已屆滿',
  clearance_approved: '已確認可巡查',
  scheduled: '已排程',
  in_progress: '巡查中',
  resolved: '已完成處理',
  needs_information: '需要補充資料',
  duplicate: '已合併案件',
  dismissed: '不成立',
};

export function getAllowedNextStatuses(status: ReportStatus): ReportStatus[] {
  return [...ALLOWED_NEXT_STATUSES[status]];
}

export function canTransition(from: ReportStatus, to: ReportStatus): boolean {
  return ALLOWED_NEXT_STATUSES[from].includes(to);
}

export function getStatusLabel(status: ReportStatus): string {
  return STATUS_LABELS[status];
}

export function toPublicStatus(status: ReportStatus): PublicReport['publicStatus'] {
  if (status === 'pending') return 'pending';
  if (status === 'resolved') return 'resolved';
  if (status === 'dismissed' || status === 'duplicate') return 'dismissed';
  return 'processing';
}

export function getPublicStatusLabel(status: ReportStatus): string {
  const publicStatus = toPublicStatus(status);
  if (publicStatus === 'pending') return '待審核';
  if (publicStatus === 'resolved') return '已完成處理';
  if (publicStatus === 'dismissed') return status === 'duplicate' ? '已合併案件' : '不成立';
  return '處理中';
}

export function isRouteEligible(
  report: Pick<AdminReport, 'status' | 'coordinatesValid' | 'procedureConfirmed' | 'isDuplicate'>,
): boolean {
  return report.status === 'clearance_approved'
    && report.coordinatesValid
    && report.procedureConfirmed
    && !report.isDuplicate;
}
