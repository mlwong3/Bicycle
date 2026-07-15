import type {
  AdminReport,
  DepartmentCode,
  WorkOrder,
  WorkOrderTaskType,
} from './types';

export type ProcedureTemplateId =
  | 'immediate_danger'
  | 'street_waste'
  | 'public_bike_parking_joint_operation';

type TemplateStep = {
  key: string;
  taskType: WorkOrderTaskType;
  title: string;
  leadDepartment: DepartmentCode;
  prerequisites: readonly string[];
  requiredCapabilities: readonly string[];
  requiredEquipment: readonly string[];
};

const DEMO_DISTRICTS = ['沙田', '大埔', '南區', '西貢', '屯門', '元朗', '葵青'] as const;

const PUBLIC_PARKING_STEPS = [
  { key: 'suspension', taskType: 'suspension_notice', title: '發出暫停使用泊車處通知', leadDepartment: 'TD', prerequisites: [], requiredCapabilities: ['suspension-notice'], requiredEquipment: ['temporary-signage'] },
  { key: 'closure', taskType: 'site_closure', title: '封閉泊車處或處理告示', leadDepartment: 'HKPF', prerequisites: ['suspension'], requiredCapabilities: ['site-closure'], requiredEquipment: ['closure-barrier'] },
  { key: 'statutory', taskType: 'statutory_notice', title: '在單車張貼法定通知', leadDepartment: 'LandsD', prerequisites: ['closure'], requiredCapabilities: ['statutory-notice'], requiredEquipment: ['notice-kit'] },
  { key: 'removal', taskType: 'removal', title: '行動日移走單車', leadDepartment: 'FEHD', prerequisites: ['closure', 'statutory'], requiredCapabilities: ['bicycle-removal'], requiredEquipment: ['removal-vehicle'] },
  { key: 'custody', taskType: 'custody_disposal', title: '接管、保管及後續處置', leadDepartment: 'LandsD', prerequisites: ['removal'], requiredCapabilities: ['custody-disposal'], requiredEquipment: ['custody-vehicle'] },
  { key: 'closeout', taskType: 'coordination_closeout', title: '聯合行動覆核及結案', leadDepartment: 'HAD', prerequisites: ['suspension', 'closure', 'statutory', 'removal', 'custody'], requiredCapabilities: ['coordination-closeout'], requiredEquipment: ['case-management'] },
] as const satisfies readonly TemplateStep[];

const TEMPLATE_STEPS: Record<ProcedureTemplateId, readonly TemplateStep[]> = {
  immediate_danger: [
    { key: 'safety-response', taskType: 'safety_response', title: '即時危險安全處理', leadDepartment: 'HKPF', prerequisites: [], requiredCapabilities: ['safety-response'], requiredEquipment: ['safety-kit'] },
    { key: 'follow-up', taskType: 'coordination_closeout', title: '民政處跟進覆核', leadDepartment: 'HAD', prerequisites: ['safety-response'], requiredCapabilities: ['coordination-closeout'], requiredEquipment: ['case-management'] },
  ],
  street_waste: [
    { key: 'site-verification', taskType: 'site_verification', title: '街道棄置單車現場核實', leadDepartment: 'FEHD', prerequisites: [], requiredCapabilities: ['site-verification'], requiredEquipment: ['camera'] },
    { key: 'removal', taskType: 'removal', title: '移走街道棄置單車', leadDepartment: 'FEHD', prerequisites: ['site-verification'], requiredCapabilities: ['bicycle-removal'], requiredEquipment: ['removal-vehicle'] },
  ],
  public_bike_parking_joint_operation: PUBLIC_PARKING_STEPS,
};

const EVIDENCE_LABELS: Partial<Record<WorkOrderTaskType, string>> = {
  site_verification: '現場核實紀錄',
  statutory_notice: '法定通知相片',
  removal: '移走紀錄及相片',
  custody_disposal: '接管及後續處置紀錄',
};

function deriveDistrict(location: string): string {
  return DEMO_DISTRICTS.find((district) => location.includes(district)) ?? '未確認地區';
}

function resolvePrerequisiteIds(
  templateId: ProcedureTemplateId,
  step: TemplateStep,
  ids: ReadonlyMap<string, string>,
): string[] {
  return step.prerequisites.map((key) => {
    const id = ids.get(key);
    if (!id) throw new Error(`Template ${templateId} references unknown prerequisite key: ${key}`);
    return id;
  });
}

export function createWorkOrdersFromTemplate(
  report: AdminReport,
  templateId: ProcedureTemplateId,
  createdAt: string,
  jointOperationId?: string,
): WorkOrder[] {
  const steps = TEMPLATE_STEPS[templateId];
  if (!steps) throw new Error(`Unknown procedure template: ${String(templateId)}`);
  const ids = new Map(steps.map((step) => [step.key, `${report.id}-${step.key}`]));

  return steps.map((step) => {
    const evidenceLabel = EVIDENCE_LABELS[step.taskType];
    return {
      id: `${report.id}-${step.key}`,
      caseId: report.id,
      ...(jointOperationId ? { jointOperationId } : {}),
      taskType: step.taskType,
      title: step.title,
      leadDepartment: step.leadDepartment,
      supportingDepartments: [],
      location: report.location,
      district: deriveDistrict(report.location),
      priority: report.urgency,
      prerequisiteWorkOrderIds: resolvePrerequisiteIds(templateId, step, ids),
      requiredCapabilities: [...step.requiredCapabilities],
      requiredEquipment: [...step.requiredEquipment],
      evidenceChecklist: evidenceLabel ? [{ id: 'evidence', label: evidenceLabel, completed: false }] : [],
      status: 'draft',
      assignmentHistory: [],
      createdAt,
      updatedAt: createdAt,
    };
  });
}
