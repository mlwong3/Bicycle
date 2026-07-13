import type { ProcedureConfig } from './types';

export const DEFAULT_PROCEDURES: ProcedureConfig[] = [
  {
    id: 'demo-field-review',
    label: '示範：現場覆核後處理',
    noticePeriodHours: 48,
    legalBasisNote: '本次展示設定；實際依據須由相關部門確認。',
    responsibleDepartment: '示範跨部門聯合小組',
    completionCondition: 'field_confirmed',
    defaultServiceMinutes: 15,
    active: true,
  },
  {
    id: 'demo-manual-approval',
    label: '示範：管理員確認程序',
    legalBasisNote: '本次展示設定；不代表固定法律程序。',
    responsibleDepartment: '示範單車管理小組',
    completionCondition: 'manual_approval',
    defaultServiceMinutes: 12,
    active: true,
  },
];

export function calculateDeadline(config: ProcedureConfig, issuedAt: Date): string | null {
  if (!config.noticePeriodHours || config.noticePeriodHours <= 0) return null;
  return new Date(issuedAt.getTime() + config.noticePeriodHours * 60 * 60 * 1000).toISOString();
}

export function createProcedureSnapshot(config: ProcedureConfig): ProcedureConfig {
  return { ...config };
}
