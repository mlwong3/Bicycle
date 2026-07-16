import type { AdminReport, AiCaseClassification, DepartmentCode, ManualRubricRecord, Report, Team, WorkOrder, JointOperation, WorkOrderStatus } from './types';
import { toAdminReport } from './caseAdapter';
import { createWorkOrdersFromTemplate, type ProcedureTemplateId } from './workOrderTemplates';

// 為示範案件產生一致的「已保存分類」，讓處理流程指示器呈順序完成，不會出現後段已完成而分類未完成的跳空
function demoClassification(caseType: AdminReport['caseType'], urgency: AdminReport['urgency'], suggestedDepartment: string): AiCaseClassification {
  return {
    caseType,
    urgency,
    obstructionLevel: caseType === 'obstruction' ? 3 : caseType === 'safety_hazard' ? 2 : 0,
    suggestedDepartment,
    missingInformation: [],
    possibleDuplicateReportIds: [],
    priorityBand: urgency === 'normal' ? 'low' : 'high',
    rationale: ['示範分類：已由管理員覆核並保存。'],
    confidence: 'high',
    source: 'rule-fallback',
    suggestedAction: '建議交由負責部門再確認',
  };
}

// 為已確認程序的示範案件補上人工評分紀錄，使「現場評估」先於「程序確認」完成
function demoRubric(completedAt: string): ManualRubricRecord {
  return {
    rust: { score: 1, observable: true },
    tire: { score: 2, observable: true },
    dust: { score: 1, observable: true },
    attachment: { score: 1, observable: true },
    missing: { score: 0, observable: true },
    lock: { score: null, observable: false },
    completedBy: 'admin-demo',
    completedAt,
  };
}

const DEMO_IMAGE = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDAYCf6Xkf4n3qT8pMN7LJOvO0Tm8bTlqPgOgecV2SsNRtSf3bJYsNKe76k4CdtVbYqVorJLFz1C5vpFTdOIb1dr-04QHvGEDP8L9LAH9nYbs7P8UEuED875gMgD-GWiHfLtV639ROGYja9KtOkNLEsMPoc--7R60KwBmDFQqTvKrSXrfzrnhKM2GQjSCZMUcsT_CKvQ-y00-piszmb4s-eJgWQFIY5LKLhnk1tdOXnEoCRS_e3xfq-WDlk8y9lY5Z5d_mFge_N';

const base = {
  imageUrl: DEMO_IMAGE,
  locationSource: 'gps' as const,
  urgency: 'normal' as const,
  procedureConfirmed: false,
  coordinatesValid: true,
  isDuplicate: false,
  demoMode: true,
};

export const INITIAL_ADMIN_REPORTS: AdminReport[] = [
  {
    ...base,
    id: 'demo-obstruction',
    location: '沙田源禾路體育館外',
    description: '有單車倒塌在行人路上阻礙通道，輪胎已漏氣。',
    citizenTags: ['obstruction', 'safety_hazard'],
    lat: 22.3824,
    lng: 114.1881,
    status: 'pending',
    date: '2026-07-13',
    caseType: 'obstruction',
    statusHistory: [{ status: 'pending', at: '2026-07-13T09:00:00.000Z', by: 'citizen' }],
  },
  {
    ...base,
    id: 'demo-classification',
    location: '大埔單車徑近廣福邨段',
    description: '發現共享單車被棄置於草叢中，擋泥板破損。',
    citizenTags: ['suspected_abandoned', 'damaged_bicycle'],
    lat: 22.4512,
    lng: 114.1735,
    status: 'classified',
    date: '2026-07-12',
    caseType: 'suspected_abandoned',
    aiClassification: demoClassification('suspected_abandoned', 'normal', '示範單車管理小組'),
    statusHistory: [
      { status: 'pending', at: '2026-07-12T08:30:00.000Z', by: 'citizen' },
      { status: 'reviewing', at: '2026-07-12T09:00:00.000Z', by: 'admin-demo' },
      { status: 'classified', at: '2026-07-12T09:10:00.000Z', by: 'admin-demo', note: '已完成初步分類，等待人工觀察。' },
    ],
  },
  {
    ...base,
    id: 'demo-field-review',
    location: '香港仔海傍道 12 號',
    description: '欄杆旁有私家單車鏈條斷裂且隨意放置。',
    citizenTags: ['damaged_bicycle'],
    lat: 22.2488,
    lng: 114.1547,
    status: 'field_review_required',
    date: '2026-07-11',
    caseType: 'damaged_bicycle',
    aiClassification: demoClassification('damaged_bicycle', 'normal', '示範單車管理小組'),
    statusHistory: [
      { status: 'pending', at: '2026-07-11T11:00:00.000Z', by: 'citizen' },
      { status: 'reviewing', at: '2026-07-11T11:20:00.000Z', by: 'admin-demo' },
      { status: 'classified', at: '2026-07-11T11:30:00.000Z', by: 'admin-demo' },
      { status: 'field_review_required', at: '2026-07-11T12:00:00.000Z', by: 'admin-demo', note: '需要現場核實位置及安全影響。' },
    ],
  },
  {
    ...base,
    id: 'demo-notice',
    location: '馬鞍山海濱長廊入口',
    description: '單車停放於入口旁，可能影響人流通過。',
    citizenTags: ['obstruction'],
    lat: 22.4277,
    lng: 114.2431,
    status: 'notice_issued',
    date: '2026-07-10',
    caseType: 'obstruction',
    urgency: 'urgent',
    noticeDate: '2026-07-10',
    procedureConfirmed: true,
    aiClassification: demoClassification('obstruction', 'urgent', '示範跨部門聯合小組'),
    manualRubric: demoRubric('2026-07-10T09:50:00.000Z'),
    statusHistory: [
      { status: 'pending', at: '2026-07-10T09:00:00.000Z', by: 'citizen' },
      { status: 'reviewing', at: '2026-07-10T09:20:00.000Z', by: 'admin-demo' },
      { status: 'classified', at: '2026-07-10T09:30:00.000Z', by: 'admin-demo' },
      { status: 'notice_issued', at: '2026-07-10T10:00:00.000Z', by: 'admin-demo', note: '本次示範已記錄通知程序。' },
    ],
  },
  {
    ...base,
    id: 'demo-patrol-ready',
    location: '沙田城門河單車徑入口',
    description: '單車長時間放置在指定泊位外，現場觀察資料完整。',
    citizenTags: ['suspected_abandoned'],
    lat: 22.3858,
    lng: 114.1919,
    status: 'clearance_approved',
    date: '2026-07-08',
    caseType: 'suspected_abandoned',
    urgency: 'urgent',
    procedureConfirmed: true,
    aiClassification: demoClassification('suspected_abandoned', 'urgent', '示範單車管理小組'),
    manualRubric: {
      rust: { score: 2, observable: true, note: '鏈條有鏽蝕。' },
      tire: { score: 2, observable: true, note: '前胎明顯洩氣。' },
      dust: { score: 2, observable: true, note: '車座有積塵。' },
      attachment: { score: 1, observable: true },
      missing: { score: 0, observable: true },
      lock: { score: null, observable: false, note: '相片未能觀察車鎖。' },
      completedBy: 'admin-demo',
      completedAt: '2026-07-09T10:00:00.000Z',
    },
    statusHistory: [
      { status: 'pending', at: '2026-07-08T09:00:00.000Z', by: 'citizen' },
      { status: 'reviewing', at: '2026-07-08T09:20:00.000Z', by: 'admin-demo' },
      { status: 'classified', at: '2026-07-08T09:30:00.000Z', by: 'admin-demo' },
      { status: 'clearance_approved', at: '2026-07-09T10:10:00.000Z', by: 'admin-demo', note: '已完成程序確認，可作巡查建議。' },
    ],
  },
  {
    ...base,
    id: 'demo-duplicate',
    location: '大圍車公廟路段',
    description: '與另一宗舉報位置及描述相近，待合併處理。',
    citizenTags: ['other'],
    lat: 22.3729,
    lng: 114.1789,
    status: 'duplicate',
    date: '2026-07-07',
    caseType: 'duplicate',
    isDuplicate: true,
    duplicateOf: 'demo-obstruction',
    statusHistory: [
      { status: 'pending', at: '2026-07-07T09:00:00.000Z', by: 'citizen' },
      { status: 'reviewing', at: '2026-07-07T09:20:00.000Z', by: 'admin-demo' },
      { status: 'duplicate', at: '2026-07-07T09:40:00.000Z', by: 'admin-demo', note: '已指向主案件。' },
    ],
  },
  {
    ...base,
    id: 'demo-immediate-danger',
    location: '沙田源禾路近體育館出入口',
    description: '單車倒塌阻塞出口並有即時安全風險，需要跨部門跟進。',
    citizenTags: ['safety_hazard'],
    lat: 22.3828,
    lng: 114.1885,
    status: 'classified',
    date: '2026-07-15',
    caseType: 'safety_hazard',
    urgency: 'emergency',
    procedureConfirmed: true,
    aiClassification: demoClassification('safety_hazard', 'emergency', '示範現場安全小組'),
    manualRubric: demoRubric('2026-07-15T08:40:00.000Z'),
  },
  {
    ...base,
    id: 'demo-street-waste',
    location: '大埔單車徑近廣福邨段',
    description: '街道旁發現疑似棄置單車，安排食環署現場核實及移走。',
    citizenTags: ['suspected_abandoned'],
    lat: 22.4515,
    lng: 114.1738,
    status: 'field_review_required',
    date: '2026-07-15',
    caseType: 'suspected_abandoned',
    urgency: 'urgent',
    procedureConfirmed: true,
    aiClassification: demoClassification('suspected_abandoned', 'urgent', '示範單車管理小組'),
    manualRubric: demoRubric('2026-07-15T08:45:00.000Z'),
  },
  {
    ...base,
    id: 'demo-public-parking',
    location: '沙田公共單車泊車處',
    description: '公共單車泊車處聯合行動示範案件。',
    citizenTags: ['suspected_abandoned', 'obstruction'],
    lat: 22.3802,
    lng: 114.1902,
    status: 'notice_issued',
    date: '2026-07-15',
    caseType: 'suspected_abandoned',
    urgency: 'urgent',
    procedureConfirmed: true,
    aiClassification: demoClassification('suspected_abandoned', 'urgent', '示範泊位管理小組'),
    manualRubric: demoRubric('2026-07-15T08:50:00.000Z'),
  },
];

export const INITIAL_REPORTS: Report[] = INITIAL_ADMIN_REPORTS.map((report) => ({ ...report }));

const TEAM_DISTRICTS = ['沙田', '大埔', '南區'];
const DEPARTMENT_TEAM_DEFINITIONS: Array<{
  department: DepartmentCode;
  capabilities: string[];
  equipment: string[];
}> = [
  { department: 'HAD', capabilities: ['coordination-closeout'], equipment: ['case-management'] },
  { department: 'TD', capabilities: ['suspension-notice'], equipment: ['temporary-signage'] },
  { department: 'LandsD', capabilities: ['statutory-notice', 'custody-disposal'], equipment: ['notice-kit', 'custody-vehicle'] },
  { department: 'FEHD', capabilities: ['site-verification', 'bicycle-removal'], equipment: ['camera', 'removal-vehicle'] },
  { department: 'HKPF', capabilities: ['safety-response', 'site-closure'], equipment: ['safety-kit', 'closure-barrier'] },
];

export const DEMO_TEAMS: Team[] = DEPARTMENT_TEAM_DEFINITIONS.flatMap(({ department, capabilities, equipment }) => [
  {
    id: `team-${department.toLowerCase()}-shatin`,
    name: `${department} 沙田隊`,
    department,
    districts: ['沙田'],
    capabilities,
    equipment,
    onDuty: true,
    dailyCapacity: 5,
    activeWorkload: 1,
  },
  {
    id: `team-${department.toLowerCase()}-support`,
    name: `${department} 跨區支援隊`,
    department,
    districts: TEAM_DISTRICTS,
    capabilities,
    equipment,
    onDuty: true,
    dailyCapacity: 5,
    activeWorkload: 2,
  },
]);

const TEAM_BY_DEPARTMENT = Object.fromEntries(
  DEPARTMENT_TEAM_DEFINITIONS.map(({ department }) => [department, `team-${department.toLowerCase()}-shatin`]),
) as Record<DepartmentCode, string>;

function createTemplateOrders(reportId: string, templateId: ProcedureTemplateId, createdAt: string, jointOperationId?: string): WorkOrder[] {
  const report = INITIAL_ADMIN_REPORTS.find((item) => item.id === reportId);
  if (!report) throw new Error(`Missing demo report: ${reportId}`);
  return createWorkOrdersFromTemplate(toAdminReport(report), templateId, createdAt, jointOperationId);
}

function setDemoOrderState(order: WorkOrder, status: WorkOrderStatus, blockerReason?: string): WorkOrder {
  return {
    ...order,
    assignedTeamId: TEAM_BY_DEPARTMENT[order.leadDepartment],
    status,
    ...(status === 'blocked' ? { blockerReason: blockerReason || '等待現場安全條件確認' } : {}),
    evidenceChecklist: status === 'completed'
      ? order.evidenceChecklist.map((item) => ({ ...item, completed: true }))
      : order.evidenceChecklist,
  };
}

const DEMO_CREATED_AT = '2026-07-15T09:00:00.000Z';
const immediateDangerOrders = createTemplateOrders('demo-immediate-danger', 'immediate_danger', DEMO_CREATED_AT)
  .map((order, index) => setDemoOrderState(order, index === 0 ? 'in_progress' : 'draft'));
const streetWasteOrders = createTemplateOrders('demo-street-waste', 'street_waste', DEMO_CREATED_AT)
  .map((order, index) => setDemoOrderState(order, index === 0 ? 'scheduled' : 'draft'));
const publicParkingOperationId = 'joint-demo-public-parking';
const publicParkingOrders = createTemplateOrders(
  'demo-public-parking',
  'public_bike_parking_joint_operation',
  DEMO_CREATED_AT,
  publicParkingOperationId,
).map((order, index) => setDemoOrderState(order, [
  'completed', 'scheduled', 'awaiting_acceptance', 'blocked', 'draft', 'draft',
][index] as WorkOrderStatus, index === 3 ? '等待移走行動日及現場安全確認' : undefined));

export const INITIAL_WORK_ORDERS: WorkOrder[] = [
  ...immediateDangerOrders,
  ...streetWasteOrders,
  ...publicParkingOrders,
];

export const INITIAL_JOINT_OPERATIONS: JointOperation[] = [{
  id: publicParkingOperationId,
  title: '沙田公共單車泊車處聯合行動',
  location: '沙田公共單車泊車處',
  district: '沙田',
  actionDate: '2026-07-15',
  coordinatingDepartment: 'HAD',
  participatingDepartments: ['TD', 'HKPF', 'LandsD', 'FEHD', 'HAD'],
  mandatoryWorkOrderIds: publicParkingOrders.map((order) => order.id),
  status: 'preparing',
}];
