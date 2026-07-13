import type { AdminReport } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rubricScore(report: AdminReport): number {
  const rubric = report.manualRubric;
  if (!rubric) return 0;
  const values = Object.values(rubric)
    .filter((value): value is { score: number | null; observable: boolean } => typeof value === 'object' && value !== null && 'score' in value)
    .filter((value) => value.observable && value.score !== null);
  if (values.length === 0) return 0;
  return (values.reduce((sum, value) => sum + (value.score || 0), 0) / (values.length * 3)) * 100;
}

function waitingScore(report: AdminReport, now: Date): number {
  const date = Date.parse(report.date);
  if (!Number.isFinite(date)) return 0;
  const days = Math.max(0, (now.getTime() - date) / (24 * 60 * 60 * 1000));
  return clamp((days / 30) * 100, 0, 100);
}

function obstructionScore(report: AdminReport): number {
  if (report.aiClassification) return (report.aiClassification.obstructionLevel / 3) * 100;
  if (report.caseType === 'obstruction') return 80;
  if (report.caseType === 'safety_hazard') return 70;
  return 0;
}

function confidenceAndCompletenessScore(report: AdminReport): number {
  const confidence = report.aiClassification?.confidence;
  const confidenceScore = confidence === 'high' ? 100 : confidence === 'medium' ? 60 : confidence === 'low' ? 20 : 0;
  const completenessScore = report.coordinatesValid && report.procedureConfirmed ? 100 : 40;
  return (confidenceScore + completenessScore) / 2;
}

export function calculatePriorityScore(report: AdminReport, now: Date): number {
  const score = 0.35 * obstructionScore(report)
    + 0.25 * waitingScore(report, now)
    + 0.2 * rubricScore(report)
    + 0.1 * 0
    + 0.1 * confidenceAndCompletenessScore(report);
  return Math.round(clamp(score, 0, 100) * 100) / 100;
}
