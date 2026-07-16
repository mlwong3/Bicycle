import { canTransition, toPublicStatus } from './reportStatus';
import type { AdminReport, PublicReport, Report, ReportStatus } from './types';

function normalizeStatus(status: string): ReportStatus {
  if (status === 'noticed') return 'notice_issued';
  if (status === 'scheduled') return 'scheduled';
  if (status === 'resolved') return 'resolved';
  if (status === 'dismissed') return 'dismissed';
  if (status === 'pending' || status === 'reviewing' || status === 'classified' || status === 'field_review_required'
    || status === 'notice_issued' || status === 'deadline_expired' || status === 'clearance_approved'
    || status === 'in_progress' || status === 'needs_information' || status === 'duplicate') return status;
  return 'pending';
}

export function toAdminReport(report: Report): AdminReport {
  const status = normalizeStatus(report.status);
  const hasCoordinates = Number.isFinite(report.lat) && Number.isFinite(report.lng);
  return {
    ...report,
    status,
    locationSource: report.locationSource || (hasCoordinates ? 'gps' : 'unknown'),
    caseType: report.caseType || 'other',
    urgency: report.urgency || 'normal',
    procedureConfirmed: report.procedureConfirmed ?? false,
    coordinatesValid: report.coordinatesValid ?? hasCoordinates,
    isDuplicate: report.isDuplicate ?? status === 'duplicate',
    demoMode: report.demoMode ?? false,
    citizenTags: report.citizenTags || [],
  };
}

export function toPublicReport(report: Report): PublicReport {
  return {
    id: report.id,
    reporterUid: report.reporterUid,
    publicStatus: toPublicStatus(normalizeStatus(report.status)),
    publicMessage: report.status === 'resolved' ? '案件已完成處理。' : undefined,
    submittedAt: report.date,
    updatedAt: report.statusHistory?.at(-1)?.at || report.date,
    locationLabel: report.location,
    imagePreviewPath: report.imageUrl,
  };
}

export function applyAdminPatch(report: AdminReport, patch: Partial<AdminReport>, actor = 'admin-demo', note = ''): AdminReport {
  if (patch.status && patch.status !== report.status && !canTransition(report.status, patch.status)) return report;
  const updatedAt = new Date().toISOString();
  const statusChanged = Boolean(patch.status && patch.status !== report.status);
  const eventAction = patch.status
    ? 'status_changed'
    : patch.aiClassification || patch.caseType || patch.urgency
      ? 'classification_updated'
      : patch.manualRubric
        ? 'rubric_completed'
        : patch.procedureConfirmed
          ? 'procedure_confirmed'
          : undefined;
  const updated = {
    ...report,
    ...patch,
    ...(statusChanged ? {
      handledBy: actor,
      statusHistory: [
        ...(report.statusHistory || []),
        { status: patch.status as ReportStatus, at: updatedAt, by: actor, ...(note.trim() ? { note: note.trim() } : {}) },
      ],
    } : {}),
    updatedAt,
  } as AdminReport;
  if (!eventAction) return updated;
  return {
    ...updated,
    events: [
      ...(report.events || []),
      {
        action: eventAction,
        ...(statusChanged ? { fromStatus: report.status, toStatus: patch.status } : {}),
        actorUid: actor,
        actorRole: 'admin',
        createdAt: updatedAt,
      },
    ],
  };
}
