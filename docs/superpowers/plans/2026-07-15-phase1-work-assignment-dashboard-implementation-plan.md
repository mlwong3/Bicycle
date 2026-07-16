# Phase 1 Work Assignment Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可展示的 Phase 1 跨部門工作分配中心及統籌儀表板，讓一宗案件可產生多張有依賴關係的工作單，並以已排期工作單產生巡邏路線。

**Architecture:** 保留現有 `Report` 作整體案件資料，新增獨立的 `WorkOrder`、`JointOperation` 及 `Team` 領域模型。程序模板、狀態轉換、團隊推薦、儀表板統計及路線篩選均以純 TypeScript 函數實作；React 元件只負責顯示及觸發回呼。Phase 1 使用 localStorage 及示範資料，不新增真實政府帳戶或官方系統整合。

**Tech Stack:** React 19、TypeScript 5.8、Vite 6、Tailwind CSS 4、Lucide React、Node.js `node:test`、localStorage。

## Global Constraints

- 只實作已確認的 Phase 1，不建立 Phase 2 或 Phase 3 功能。
- 系統定位為「跨部門單車執法決策支援及聯合行動管理原型」。
- AI 只可提出非約束性建議，不可批准工作分配或執法決定。
- 部門權責、地區、職能、設備及前置工作是硬性條件，不可被評分覆蓋。
- 儀表板必須標示「原型示範資料」，不可描述為真實政府績效。
- 巡邏路線只可使用已排期、可執行、同部門、同日期及相容工作類型的工作單。
- 保留現有 13 個案件狀態；案件狀態與工作單狀態必須分離。
- 不修改或提交 `esp32/parking_sensor/parking_sensor.ino`、`.agents/`、`nfc_cards/封存.zip` 或 `skills-lock.json`。
- 每項功能先寫失敗測試，再寫最少實作，通過後才提交。

---

## File Structure

### New domain files

- `src/workOrders.ts`：工作單狀態轉換、前置條件、證據檢查及更新函數。
- `src/workOrderTemplates.ts`：三個 Phase 1 程序模板及由案件產生工作單的函數。
- `src/assignment.ts`：團隊硬性篩選、可解釋評分及推薦排序。
- `src/dashboard.ts`：儀表板篩選、概況卡、優先清單、部門工作量和聯合行動進度。
- `src/components/CoordinationDashboard.tsx`：跨部門統籌儀表板。
- `src/components/WorkAssignmentCentre.tsx`：工作單列表、依賴狀態及派工操作。

### Existing files to modify

- `src/types.ts`：加入工作單、團隊、聯合行動、儀表板及新路線型別。
- `src/demoData.ts`：加入五個部門、十個團隊、三個模板的示範工作單及聯合行動。
- `src/storage.ts`：加入工作單及聯合行動的版本化儲存鍵。
- `src/App.tsx`：管理工作單及聯合行動狀態、儲存、重設及回呼。
- `src/components/AdminTab.tsx`：加入「統籌儀表板／案件工作台」分頁及接駁新元件。
- `src/components/PatrolPlanner.tsx`：由案件候選改為工作單候選。
- `src/patrol.ts`：按工作單、部門、日期及任務模式建立路線。
- `src/caseAdapter.ts`：移除路線確認直接排程案件的責任，保留案件轉換及補丁功能。
- `src/backend.ts`：確保 `syncReportStatus` 仍只同步案件欄位；Phase 1 工作單保持本機示範資料。
- `ADMIN_SYSTEM_PLAN.md`：補充 Phase 1 工作分配及儀表板已實作範圍。

### New test files

- `tests/workOrders.test.ts`
- `tests/workOrderTemplates.test.ts`
- `tests/assignment.test.ts`
- `tests/dashboard.test.ts`
- `tests/workOrderPatrol.test.ts`

---

### Task 1: 建立工作單、聯合行動及團隊型別

**Files:**
- Modify: `src/types.ts`
- Create: `tests/workOrders.test.ts`
- Create: `src/workOrders.ts`

**Interfaces:**
- Produces: `DepartmentCode`, `WorkOrderTaskType`, `WorkOrderStatus`, `WorkOrder`, `JointOperation`, `Team`, `canTransitionWorkOrder()`, `isWorkOrderReady()`, `applyWorkOrderTransition()`。
- Consumes: 現有 `Urgency`、`Coordinates`。

- [ ] **Step 1: 寫出失敗的工作單狀態測試**

在 `tests/workOrders.test.ts` 建立：

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyWorkOrderTransition, isWorkOrderReady } from '../src/workOrders';
import type { WorkOrder } from '../src/types';

const baseWorkOrder: WorkOrder = {
  id: 'wo-1',
  caseId: 'case-1',
  taskType: 'site_verification',
  title: '現場核實',
  leadDepartment: 'HAD',
  supportingDepartments: [],
  district: '沙田',
  priority: 'normal',
  prerequisiteWorkOrderIds: [],
  requiredCapabilities: ['site-verification'],
  requiredEquipment: [],
  evidenceChecklist: [{ id: 'photo', label: '現場相片', completed: false }],
  status: 'draft',
  assignmentHistory: [],
  createdAt: '2026-07-15T09:00:00.000Z',
  updatedAt: '2026-07-15T09:00:00.000Z',
};

test('downstream work is not ready before every prerequisite is completed', () => {
  const downstream = { ...baseWorkOrder, id: 'wo-2', prerequisiteWorkOrderIds: ['wo-1'] };
  assert.equal(isWorkOrderReady(downstream, [baseWorkOrder], new Date('2026-07-15T10:00:00.000Z')), false);
  assert.equal(isWorkOrderReady(downstream, [{ ...baseWorkOrder, status: 'completed' }], new Date('2026-07-15T10:00:00.000Z')), true);
});

test('completion requires every evidence item and records an audit entry', () => {
  const started = { ...baseWorkOrder, status: 'in_progress' as const };
  assert.equal(applyWorkOrderTransition(started, 'completed', 'staff-1', '2026-07-15T10:00:00.000Z').status, 'in_progress');
  const evidenced = { ...started, evidenceChecklist: [{ id: 'photo', label: '現場相片', completed: true }] };
  const completed = applyWorkOrderTransition(evidenced, 'completed', 'staff-1', '2026-07-15T10:00:00.000Z');
  assert.equal(completed.status, 'completed');
  assert.equal(completed.assignmentHistory.at(-1)?.action, 'status_changed');
});
```

- [ ] **Step 2: 執行測試並確認失敗**

Run: `node --import tsx --test tests/workOrders.test.ts`  
Expected: FAIL，顯示找不到 `../src/workOrders` 或 `WorkOrder`。

- [ ] **Step 3: 在 `src/types.ts` 加入完整領域型別**

```ts
export type DepartmentCode = 'HAD' | 'TD' | 'LandsD' | 'FEHD' | 'HKPF';

export type WorkOrderTaskType =
  | 'jurisdiction_review'
  | 'safety_response'
  | 'site_verification'
  | 'suspension_notice'
  | 'site_closure'
  | 'statutory_notice'
  | 'removal'
  | 'custody_disposal'
  | 'coordination_closeout';

export type WorkOrderStatus =
  | 'draft'
  | 'awaiting_acceptance'
  | 'accepted'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'declined'
  | 'cancelled';

export interface EvidenceChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  note?: string;
}

export interface WorkOrderHistoryEntry {
  at: string;
  actorUid: string;
  action: 'created' | 'assigned' | 'accepted' | 'declined' | 'status_changed' | 'blocked' | 'reassigned' | 'route_assigned';
  fromStatus?: WorkOrderStatus;
  toStatus?: WorkOrderStatus;
  reason?: string;
}

export interface WorkOrder {
  id: string;
  caseId: string;
  jointOperationId?: string;
  taskType: WorkOrderTaskType;
  title: string;
  leadDepartment: DepartmentCode;
  supportingDepartments: DepartmentCode[];
  assignedTeamId?: string;
  assignedStaffUid?: string;
  district: string;
  scheduledAt?: string;
  dueAt?: string;
  executableAfter?: string;
  priority: Urgency;
  prerequisiteWorkOrderIds: string[];
  requiredCapabilities: string[];
  requiredEquipment: string[];
  evidenceChecklist: EvidenceChecklistItem[];
  status: WorkOrderStatus;
  blockerReason?: string;
  patrolRouteId?: string;
  assignmentHistory: WorkOrderHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  department: DepartmentCode;
  districts: string[];
  capabilities: string[];
  equipment: string[];
  onDuty: boolean;
  dailyCapacity: number;
  activeWorkload: number;
}

export interface JointOperation {
  id: string;
  title: string;
  location: string;
  district: string;
  actionDate: string;
  coordinatingDepartment: DepartmentCode;
  participatingDepartments: DepartmentCode[];
  mandatoryWorkOrderIds: string[];
  status: 'draft' | 'preparing' | 'ready' | 'in_progress' | 'completed' | 'postponed';
}
```

- [ ] **Step 4: 建立最少工作單規則實作**

在 `src/workOrders.ts` 建立：

```ts
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
```

- [ ] **Step 5: 執行測試及型別檢查**

Run: `node --import tsx --test tests/workOrders.test.ts && npm run lint`  
Expected: 2 tests PASS；TypeScript 0 errors。

- [ ] **Step 6: 提交 Task 1**

```bash
git add src/types.ts src/workOrders.ts tests/workOrders.test.ts
git commit -m "feat: add work order domain model"
```

---

### Task 2: 建立三個可配置程序模板

**Files:**
- Create: `src/workOrderTemplates.ts`
- Create: `tests/workOrderTemplates.test.ts`

**Interfaces:**
- Consumes: `AdminReport`, `WorkOrder`, `DepartmentCode`, `WorkOrderTaskType`。
- Produces: `ProcedureTemplateId`, `createWorkOrdersFromTemplate(report, templateId, createdAt, jointOperationId?)`。

- [ ] **Step 1: 寫出六張聯合行動工作單的失敗測試**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkOrdersFromTemplate } from '../src/workOrderTemplates';
import { toAdminReport } from '../src/caseAdapter';

test('public bicycle parking template creates six ordered department work orders', () => {
  const report = toAdminReport({
    id: 'case-parking', location: '沙田公共單車泊車處', description: '聯合行動示範',
    status: 'classified', date: '2026-07-15', lat: 22.38, lng: 114.18,
  });
  const orders = createWorkOrdersFromTemplate(report, 'public_bike_parking_joint_operation', '2026-07-15T09:00:00.000Z', 'joint-1');
  assert.equal(orders.length, 6);
  assert.deepEqual(orders.map((order) => order.leadDepartment), ['TD', 'HKPF', 'LandsD', 'FEHD', 'LandsD', 'HAD']);
  assert.deepEqual(orders[3].prerequisiteWorkOrderIds, [orders[1].id, orders[2].id]);
  assert.equal(orders.every((order) => order.jointOperationId === 'joint-1'), true);
});

test('emergency template starts with police safety response', () => {
  const report = toAdminReport({
    id: 'case-danger', location: '源禾路', description: '即時危險', status: 'classified',
    date: '2026-07-15', caseType: 'safety_hazard', urgency: 'emergency',
  });
  const orders = createWorkOrdersFromTemplate(report, 'immediate_danger', '2026-07-15T09:00:00.000Z');
  assert.equal(orders[0].leadDepartment, 'HKPF');
  assert.equal(orders[0].priority, 'emergency');
});
```

- [ ] **Step 2: 執行測試並確認失敗**

Run: `node --import tsx --test tests/workOrderTemplates.test.ts`  
Expected: FAIL，顯示找不到 `workOrderTemplates`。

- [ ] **Step 3: 建立模板資料及產生函數**

在 `src/workOrderTemplates.ts` 建立 `ProcedureTemplateId`、模板定義及輸出函數。公共泊車處模板必須依次建立以下定義：

```ts
const PUBLIC_PARKING_STEPS = [
  { key: 'suspension', taskType: 'suspension_notice', title: '發出暫停使用泊車處通知', leadDepartment: 'TD', prerequisites: [] },
  { key: 'closure', taskType: 'site_closure', title: '封閉泊車處或處理告示', leadDepartment: 'HKPF', prerequisites: ['suspension'] },
  { key: 'statutory', taskType: 'statutory_notice', title: '在單車張貼法定通知', leadDepartment: 'LandsD', prerequisites: ['closure'] },
  { key: 'removal', taskType: 'removal', title: '行動日移走單車', leadDepartment: 'FEHD', prerequisites: ['closure', 'statutory'] },
  { key: 'custody', taskType: 'custody_disposal', title: '接管、保管及後續處置', leadDepartment: 'LandsD', prerequisites: ['removal'] },
  { key: 'closeout', taskType: 'coordination_closeout', title: '聯合行動覆核及結案', leadDepartment: 'HAD', prerequisites: ['suspension', 'closure', 'statutory', 'removal', 'custody'] },
] as const;
```

`createWorkOrdersFromTemplate()` 必須以 `${report.id}-${step.key}` 建立穩定 ID；每張工作單初始狀態為 `draft`，並為 `site_verification`、`statutory_notice`、`removal` 及 `custody_disposal` 分別加入可完成的證據項目。`street_waste` 模板建立食環署現場核實及移走兩張工作單；`immediate_danger` 模板建立警務處安全處理及民政處跟進覆核兩張工作單。

- [ ] **Step 4: 執行模板測試及完整測試**

Run: `node --import tsx --test tests/workOrderTemplates.test.ts && npm test`  
Expected: 新增 2 tests PASS；既有 tests 全部 PASS。

- [ ] **Step 5: 提交 Task 2**

```bash
git add src/workOrderTemplates.ts tests/workOrderTemplates.test.ts
git commit -m "feat: add phase 1 procedure templates"
```

---

### Task 3: 建立規則輔助團隊推薦及人工確認

**Files:**
- Create: `src/assignment.ts`
- Create: `tests/assignment.test.ts`
- Modify: `src/workOrders.ts`

**Interfaces:**
- Consumes: `WorkOrder`, `Team`, `DepartmentCode`。
- Produces: `TeamRecommendation`, `recommendTeams(order, teams, now)`, `assignWorkOrder(order, team, actorUid, at, reason?)`。

- [ ] **Step 1: 寫出硬性資格及確定性排序失敗測試**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { recommendTeams } from '../src/assignment';
import type { Team, WorkOrder } from '../src/types';

const order: WorkOrder = {
  id: 'wo-removal', caseId: 'case-1', taskType: 'removal', title: '移走單車',
  leadDepartment: 'FEHD', supportingDepartments: [], district: '沙田', priority: 'urgent',
  dueAt: '2026-07-16T09:00:00.000Z', prerequisiteWorkOrderIds: [],
  requiredCapabilities: ['bicycle-removal'], requiredEquipment: ['removal-vehicle'],
  evidenceChecklist: [], status: 'draft', assignmentHistory: [],
  createdAt: '2026-07-15T09:00:00.000Z', updatedAt: '2026-07-15T09:00:00.000Z',
};

const teams: Team[] = [
  { id: 'wrong-dept', name: '地政隊', department: 'LandsD', districts: ['沙田'], capabilities: ['bicycle-removal'], equipment: ['removal-vehicle'], onDuty: true, dailyCapacity: 5, activeWorkload: 0 },
  { id: 'fehd-b', name: '食環 B 隊', department: 'FEHD', districts: ['沙田'], capabilities: ['bicycle-removal'], equipment: ['removal-vehicle'], onDuty: true, dailyCapacity: 5, activeWorkload: 4 },
  { id: 'fehd-a', name: '食環 A 隊', department: 'FEHD', districts: ['沙田'], capabilities: ['bicycle-removal'], equipment: ['removal-vehicle'], onDuty: true, dailyCapacity: 5, activeWorkload: 1 },
];

test('legal department and capabilities are hard filters', () => {
  const result = recommendTeams(order, teams, new Date('2026-07-15T09:00:00.000Z'));
  assert.deepEqual(result.map((item) => item.teamId), ['fehd-a', 'fehd-b']);
  assert.equal(result.some((item) => item.teamId === 'wrong-dept'), false);
});

test('same inputs produce the same recommendation and explanation', () => {
  const first = recommendTeams(order, teams, new Date('2026-07-15T09:00:00.000Z'));
  const second = recommendTeams(order, teams, new Date('2026-07-15T09:00:00.000Z'));
  assert.deepEqual(first, second);
  assert.equal(first[0].reasons.includes('部門權責符合'), true);
});
```

- [ ] **Step 2: 執行測試並確認失敗**

Run: `node --import tsx --test tests/assignment.test.ts`  
Expected: FAIL，顯示找不到 `assignment`。

- [ ] **Step 3: 實作硬性篩選及權重評分**

在 `src/assignment.ts` 實作：

```ts
import type { Team, WorkOrder } from './types';

export interface TeamRecommendation {
  teamId: string;
  score: number;
  reasons: string[];
}

function includesAll(actual: string[], required: string[]): boolean {
  return required.every((item) => actual.includes(item));
}

export function recommendTeams(order: WorkOrder, teams: Team[], now: Date): TeamRecommendation[] {
  return teams
    .filter((team) => team.department === order.leadDepartment)
    .filter((team) => team.onDuty && team.districts.includes(order.district))
    .filter((team) => includesAll(team.capabilities, order.requiredCapabilities))
    .filter((team) => includesAll(team.equipment, order.requiredEquipment))
    .map((team) => {
      const urgency = order.priority === 'emergency' ? 100 : order.priority === 'urgent' ? 75 : 50;
      const daysUntilDue = order.dueAt ? Math.max(0, (Date.parse(order.dueAt) - now.getTime()) / 86400000) : 5;
      const due = Math.max(0, 100 - daysUntilDue * 10);
      const district = 100;
      const capability = 100;
      const workload = Math.max(0, 100 * (1 - team.activeWorkload / Math.max(1, team.dailyCapacity)));
      const score = order.priority === 'emergency'
        ? 1000 + workload
        : 0.35 * urgency + 0.25 * due + 0.15 * district + 0.15 * capability + 0.10 * workload;
      return {
        teamId: team.id,
        score: Math.round(score * 100) / 100,
        reasons: ['部門權責符合', '服務地區符合', '職能及設備符合', `現時工作量 ${team.activeWorkload}/${team.dailyCapacity}`],
      };
    })
    .sort((a, b) => b.score - a.score || a.teamId.localeCompare(b.teamId));
}
```

在 `src/workOrders.ts` 加入 `assignWorkOrder()`；它必須再次驗證部門、當值、地區、職能及設備，不能只相信介面傳入值：

```ts
import type { Team, WorkOrder, WorkOrderHistoryEntry } from './types';

function teamCanTakeOrder(order: WorkOrder, team: Team): boolean {
  return team.department === order.leadDepartment
    && team.onDuty
    && team.districts.includes(order.district)
    && order.requiredCapabilities.every((item) => team.capabilities.includes(item))
    && order.requiredEquipment.every((item) => team.equipment.includes(item));
}

export function assignWorkOrder(
  order: WorkOrder,
  team: Team,
  actorUid: string,
  at: string,
  reason = '',
): WorkOrder {
  if (!teamCanTakeOrder(order, team)) return order;
  const isReassignment = Boolean(order.assignedTeamId && order.assignedTeamId !== team.id);
  if (isReassignment && !reason.trim()) return order;
  const entry: WorkOrderHistoryEntry = {
    at,
    actorUid,
    action: isReassignment ? 'reassigned' : 'assigned',
    ...(reason.trim() ? { reason: reason.trim() } : {}),
  };
  return {
    ...order,
    assignedTeamId: team.id,
    status: 'awaiting_acceptance',
    updatedAt: at,
    assignmentHistory: [...order.assignmentHistory, entry],
  };
}
```

- [ ] **Step 4: 執行測試及型別檢查**

Run: `node --import tsx --test tests/assignment.test.ts tests/workOrders.test.ts && npm run lint`  
Expected: 4 tests PASS；TypeScript 0 errors。

- [ ] **Step 5: 提交 Task 3**

```bash
git add src/assignment.ts src/workOrders.ts tests/assignment.test.ts tests/workOrders.test.ts
git commit -m "feat: add explainable team assignment"
```

---

### Task 4: 建立儀表板資料選擇器

**Files:**
- Create: `src/dashboard.ts`
- Create: `tests/dashboard.test.ts`
- Modify: `src/types.ts`

**Interfaces:**
- Consumes: `AdminReport[]`, `WorkOrder[]`, `JointOperation[]`, `DashboardFilters`, `Date`。
- Produces: `DashboardView`, `buildDashboardView()`，供所有儀表板區塊共用。

- [ ] **Step 1: 寫出跨區塊一致篩選的失敗測試**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDashboardView } from '../src/dashboard';
import type { AdminReport, JointOperation, WorkOrder } from '../src/types';

const reports = [{
  id: 'case-1', location: '沙田', description: '阻塞', date: '2026-07-15', status: 'classified',
  locationSource: 'gps', caseType: 'obstruction', urgency: 'emergency', procedureConfirmed: true,
  coordinatesValid: true, isDuplicate: false,
}] satisfies AdminReport[];

const orders = [{
  id: 'wo-1', caseId: 'case-1', taskType: 'safety_response', title: '安全處理',
  leadDepartment: 'HKPF', supportingDepartments: [], district: '沙田', priority: 'emergency',
  scheduledAt: '2026-07-15T10:00:00.000Z', prerequisiteWorkOrderIds: [],
  requiredCapabilities: [], requiredEquipment: [], evidenceChecklist: [], status: 'scheduled',
  assignmentHistory: [], createdAt: '2026-07-15T09:00:00.000Z', updatedAt: '2026-07-15T09:00:00.000Z',
}] satisfies WorkOrder[];

const operations: JointOperation[] = [];

test('one filter set drives cards, priority queue, department load and routes', () => {
  const view = buildDashboardView(reports, orders, operations, {
    district: '沙田', department: 'HKPF', date: '2026-07-15', status: 'all',
  }, new Date('2026-07-15T09:00:00.000Z'));
  assert.equal(view.summary.immediateDanger, 1);
  assert.equal(view.priorityItems[0].workOrderId, 'wo-1');
  assert.equal(view.departmentLoads.HKPF.scheduled, 1);
  assert.deepEqual(view.todayExecutableWorkOrderIds, ['wo-1']);

  const empty = buildDashboardView(reports, orders, operations, {
    district: '大埔', department: 'HKPF', date: '2026-07-15', status: 'all',
  }, new Date('2026-07-15T09:00:00.000Z'));
  assert.equal(empty.summary.immediateDanger, 0);
  assert.equal(empty.priorityItems.length, 0);
});
```

- [ ] **Step 2: 執行測試並確認失敗**

Run: `node --import tsx --test tests/dashboard.test.ts`  
Expected: FAIL，顯示找不到 `dashboard` 或 `DashboardFilters`。

- [ ] **Step 3: 加入儀表板型別及單一資料流實作**

在 `src/types.ts` 加入：

```ts
export interface DashboardFilters {
  district: 'all' | string;
  department: 'all' | DepartmentCode;
  date: string;
  status: 'all' | WorkOrderStatus;
}

export interface DepartmentLoad {
  awaitingAcceptance: number;
  scheduled: number;
  inProgress: number;
  blocked: number;
  completedToday: number;
}
```

在 `src/dashboard.ts` 建立 `buildDashboardView()`，先用同一個 `filteredOrders` 套用地區、部門、日期及狀態，再由它計算：

```ts
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
```

優先清單固定按 `emergency → blocked → overdue → awaiting_acceptance → jurisdiction_review` 排序，同級以 `dueAt` 及 `id` 決定順序。`todayExecutableWorkOrderIds` 只包括狀態為 `scheduled`、日期符合及 `isWorkOrderReady()` 為真的工作單。

- [ ] **Step 4: 執行儀表板測試及全部純函數測試**

Run: `node --import tsx --test tests/dashboard.test.ts tests/workOrders.test.ts tests/assignment.test.ts`  
Expected: 所有 tests PASS。

- [ ] **Step 5: 提交 Task 4**

```bash
git add src/types.ts src/dashboard.ts tests/dashboard.test.ts
git commit -m "feat: add coordination dashboard selectors"
```

---

### Task 5: 加入 Phase 1 示範資料及本機狀態

**Files:**
- Modify: `src/demoData.ts`
- Modify: `src/storage.ts`
- Modify: `src/App.tsx`
- Modify: `tests/caseAdapter.test.ts`

**Interfaces:**
- Produces: `DEMO_TEAMS`, `INITIAL_WORK_ORDERS`, `INITIAL_JOINT_OPERATIONS`。
- Consumes: `createWorkOrdersFromTemplate()`、`STORAGE_KEYS.workOrders`、`STORAGE_KEYS.jointOperations`。

- [ ] **Step 1: 把示範資料覆蓋測試改為工作分配流程**

在 `tests/caseAdapter.test.ts` 增加：

```ts
import { DEMO_TEAMS, INITIAL_JOINT_OPERATIONS, INITIAL_WORK_ORDERS } from '../src/demoData';

test('phase 1 demo data covers five departments, ten teams and a six-step joint operation', () => {
  assert.equal(new Set(DEMO_TEAMS.map((team) => team.department)).size, 5);
  assert.equal(DEMO_TEAMS.length, 10);
  assert.equal(INITIAL_JOINT_OPERATIONS.length >= 1, true);
  const operation = INITIAL_JOINT_OPERATIONS[0];
  assert.equal(operation.mandatoryWorkOrderIds.length, 6);
  assert.equal(operation.mandatoryWorkOrderIds.every((id) => INITIAL_WORK_ORDERS.some((order) => order.id === id)), true);
});
```

- [ ] **Step 2: 執行測試並確認失敗**

Run: `node --import tsx --test tests/caseAdapter.test.ts`  
Expected: FAIL，顯示缺少三個示範資料輸出。

- [ ] **Step 3: 建立五部門、十團隊及三模板示範資料**

在 `src/demoData.ts`：

- 保留現有六宗案件；新增至少一宗 `immediate_danger`、一宗 `street_waste` 及一宗 `public_bike_parking_joint_operation` 對應示範。
- 每個 `DepartmentCode` 建立兩個團隊，沙田隊和跨區支援隊；能力及設備須能使每種模板至少有一個合資格團隊。
- 用 `createWorkOrdersFromTemplate()` 產生工作單；公共泊車處行動的六張工作單分別設為 `completed`、`scheduled`、`awaiting_acceptance`、`blocked`、`draft`、`draft`，讓儀表板可展示不同狀態。
- `blocked` 工作必須有 `blockerReason`，`completed` 工作的證據清單全部設為完成。

- [ ] **Step 4: 加入儲存鍵及 App 狀態回呼**

在 `src/storage.ts` 的 `STORAGE_KEYS` 加入：

```ts
workOrders: `hk_bike:${VERSION}:work_orders`,
jointOperations: `hk_bike:${VERSION}:joint_operations`,
```

在 `src/App.tsx` 加入：

```ts
const [workOrders, setWorkOrders] = useState<WorkOrder[]>(() =>
  readStoredJson(STORAGE_KEYS.workOrders, INITIAL_WORK_ORDERS));
const [jointOperations, setJointOperations] = useState<JointOperation[]>(() =>
  readStoredJson(STORAGE_KEYS.jointOperations, INITIAL_JOINT_OPERATIONS));

useEffect(() => writeStoredJson(STORAGE_KEYS.workOrders, workOrders), [workOrders]);
useEffect(() => writeStoredJson(STORAGE_KEYS.jointOperations, jointOperations), [jointOperations]);
```

新增 `handleUpdateWorkOrder(next: WorkOrder)` 及 `handleCreateTemplateWorkOrders(reportId, templateId)`；後者不得為已有工作單的案件重複產生相同 ID。`handleResetDemoReports()` 及 `handleResetApplication()` 必須同時重設案件、工作單及聯合行動。

- [ ] **Step 5: 執行測試及型別檢查**

Run: `node --import tsx --test tests/caseAdapter.test.ts tests/workOrderTemplates.test.ts && npm run lint`  
Expected: tests PASS；TypeScript 0 errors。

- [ ] **Step 6: 提交 Task 5**

```bash
git add src/demoData.ts src/storage.ts src/App.tsx tests/caseAdapter.test.ts
git commit -m "feat: add phase 1 assignment demo state"
```

---

### Task 6: 建立統籌儀表板及工作分配中心介面

**Files:**
- Create: `src/components/CoordinationDashboard.tsx`
- Create: `src/components/WorkAssignmentCentre.tsx`
- Modify: `src/components/AdminTab.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- `CoordinationDashboardProps`: `reports`, `workOrders`, `jointOperations`, `onSelectCase`, `onSelectWorkOrder`。
- `WorkAssignmentCentreProps`: `reports`, `workOrders`, `teams`, `onUpdateWorkOrder`, `onSelectCase`, `onNotify`。

- [ ] **Step 1: 建立儀表板元件，所有區塊共用同一組篩選器**

`CoordinationDashboard.tsx` 必須：

- 以 `useState<DashboardFilters>` 管理地區、部門、日期及狀態；預設日期取示範資料可用日期，而不是瀏覽器當日造成空白畫面。
- 只呼叫一次 `buildDashboardView()`，再把結果供六張概況卡、優先清單、部門工作量、聯合行動準備程度及今日路線使用。
- 頁首固定顯示：`原型示範資料｜不代表真實政府案件或部門績效`。
- 點擊概況卡只更新相應篩選；點擊優先工作呼叫 `onSelectWorkOrder(id)`。
- 空清單顯示具體文字，例如「目前篩選條件下沒有受阻或逾期工作」，不可只顯示空白。

元件頂層結構使用：

```tsx
return (
  <section className="space-y-4" aria-label="跨部門統籌儀表板">
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
      原型示範資料｜不代表真實政府案件或部門績效
    </div>
    <DashboardFilterBar filters={filters} onChange={setFilters} />
    <DashboardSummaryCards summary={view.summary} />
    <div className="grid xl:grid-cols-2 gap-4">
      <PriorityWorkList items={view.priorityItems} onSelect={onSelectWorkOrder} />
      <JointOperationReadiness items={view.operationReadiness} />
      <DepartmentLoadTable loads={view.departmentLoads} />
      <TodayActionList workOrderIds={view.todayExecutableWorkOrderIds} workOrders={workOrders} />
    </div>
  </section>
);
```

四個小型顯示元件留在同一檔案，避免 Phase 1 過度拆分。

- [ ] **Step 2: 建立工作分配中心操作**

`WorkAssignmentCentre.tsx` 必須顯示：

- 工作狀態分頁：待分配、待接收、已排期、進行中、受阻、已完成。
- 每張工作單的案件地點、部門、團隊、前置工作、到期時間及受阻原因。
- 未分配工作使用 `recommendTeams()` 顯示最多三個推薦團隊和評分理由；按「確認分配」後呼叫 `assignWorkOrder()`。
- 已指派團隊可執行接收、退回、排期、開始、受阻及完成；退回和受阻必須輸入原因。
- 完成前逐項勾選 `evidenceChecklist`；未齊證據時按鈕保持停用。
- 前置工作未完成或 `executableAfter` 未到時顯示鎖定原因，不提供開始按鈕。

- [ ] **Step 3: 將管理員工作台拆成兩個 Phase 1 視圖**

在 `AdminTab.tsx` 加入：

```ts
const [adminView, setAdminView] = useState<'dashboard' | 'cases'>('dashboard');
```

登入後頁首提供「統籌儀表板」及「案件與工作分配」兩個按鈕。`dashboard` 顯示 `CoordinationDashboard`；`cases` 保留現有案件詳情，在案件詳情後加入 `WorkAssignmentCentre`。移除舊四張只計案件狀態的統計卡，避免與新儀表板重複。

更新 `AdminTabProps`：

```ts
interface AdminTabProps {
  reports: AdminReport[];
  workOrders: WorkOrder[];
  jointOperations: JointOperation[];
  teams: Team[];
  onPatchReport: (reportId: string, patch: Partial<AdminReport>, note?: string) => void;
  onUpdateWorkOrder: (next: WorkOrder) => void;
  onCreateTemplateWorkOrders: (reportId: string, templateId: ProcedureTemplateId) => void;
  onConfirmPatrolRoute: (route: PatrolRouteDraft) => void;
  onResetDemoReports: () => void;
  onNotify: (message: string, tone?: 'success' | 'info' | 'warning' | 'error') => void;
}
```

- [ ] **Step 4: 執行型別檢查並修正所有 props 接駁**

Run: `npm run lint`  
Expected: TypeScript 0 errors；`AdminTab`、`App` 及新元件 props 完全一致。

- [ ] **Step 5: 啟動本機介面作人工檢查**

Run: `npm run dev`  
Expected: Vite 顯示本機網址；登入管理員示範模式後預設看到儀表板，四個篩選器可操作，工作分配中心可完成分配和狀態更新。完成檢查後按 Ctrl-C 停止。

- [ ] **Step 6: 提交 Task 6**

```bash
git add src/components/CoordinationDashboard.tsx src/components/WorkAssignmentCentre.tsx src/components/AdminTab.tsx src/App.tsx
git commit -m "feat: add phase 1 coordination workbench"
```

---

### Task 7: 把巡邏路線改為使用已排期工作單

**Files:**
- Modify: `src/types.ts`
- Modify: `src/patrol.ts`
- Modify: `src/components/PatrolPlanner.tsx`
- Modify: `src/App.tsx`
- Modify: `src/caseAdapter.ts`
- Create: `tests/workOrderPatrol.test.ts`
- Modify: `tests/patrol.test.ts`
- Modify: `tests/adminWorkflow.test.ts`
- Modify: `tests/demoFlow.test.ts`

**Interfaces:**
- Replaces: `buildPatrolOrder(start, reports, options)`。
- Produces: `buildWorkOrderPatrolRoute(start, workOrders, reports, options, department, actionDate)`。
- `PatrolRouteDraft` 以 `workOrderIds` 及 `orderedStops[].workOrderId` 為主，不再以案件狀態作路線資格。

- [ ] **Step 1: 寫出路線隔離規則失敗測試**

在 `tests/workOrderPatrol.test.ts` 建立：

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWorkOrderPatrolRoute } from '../src/patrol';
import type { AdminReport, WorkOrder } from '../src/types';

const reports = [
  { id: 'case-a', location: '沙田 A', description: '核實', date: '2026-07-15', status: 'classified', lat: 22.38, lng: 114.18, locationSource: 'gps', caseType: 'other', urgency: 'normal', procedureConfirmed: true, coordinatesValid: true, isDuplicate: false },
  { id: 'case-b', location: '沙田 B', description: '移走', date: '2026-07-15', status: 'classified', lat: 22.39, lng: 114.19, locationSource: 'gps', caseType: 'other', urgency: 'normal', procedureConfirmed: true, coordinatesValid: true, isDuplicate: false },
] satisfies AdminReport[];

function makeOrder(id: string, caseId: string, taskType: WorkOrder['taskType'], department: WorkOrder['leadDepartment']): WorkOrder {
  return {
    id, caseId, taskType, title: id, leadDepartment: department, supportingDepartments: [], district: '沙田',
    scheduledAt: '2026-07-15T09:00:00.000Z', priority: 'normal', prerequisiteWorkOrderIds: [],
    requiredCapabilities: [], requiredEquipment: [], evidenceChecklist: [], status: 'scheduled',
    assignmentHistory: [], createdAt: '2026-07-15T08:00:00.000Z', updatedAt: '2026-07-15T08:00:00.000Z',
  };
}

test('route contains only the selected department, date and compatible task group', () => {
  const orders = [
    makeOrder('verify-fehd', 'case-a', 'site_verification', 'FEHD'),
    makeOrder('remove-fehd', 'case-b', 'removal', 'FEHD'),
    makeOrder('verify-had', 'case-a', 'site_verification', 'HAD'),
  ];
  const route = buildWorkOrderPatrolRoute({ lat: 22.38, lng: 114.18 }, orders, reports, {
    travelMode: 'inspection-walking', maxStops: 5, serviceMinutesPerStop: 12,
  }, 'FEHD', '2026-07-15');
  assert.deepEqual(route.workOrderIds, ['verify-fehd']);
});
```

- [ ] **Step 2: 執行測試並確認失敗**

Run: `node --import tsx --test tests/workOrderPatrol.test.ts`  
Expected: FAIL，顯示缺少 `buildWorkOrderPatrolRoute`。

- [ ] **Step 3: 修改路線型別及純函數**

將 `PatrolRouteDraft` 改為：

```ts
export interface PatrolRouteDraft {
  workOrderIds: string[];
  orderedStops: Array<{
    workOrderId: string;
    caseId: string;
    order: number;
    priorityScore: number;
    estimatedServiceMinutes: number;
  }>;
  department: DepartmentCode;
  actionDate: string;
  taskGroup: 'verification' | 'notice' | 'removal';
  startPoint: Coordinates;
  travelMode: PatrolTravelMode;
  estimatedDistanceKm: number;
  initialDistanceKm: number;
  estimatedTravelMinutesRange: { min: number; max: number };
  algorithm: 'nearest-neighbor-2opt';
  routeSource: 'mapbox' | 'leaflet-estimate' | 'straight-line-estimate';
  status: 'draft';
}
```

`buildWorkOrderPatrolRoute()` 必須先過濾 `status === 'scheduled'`、`leadDepartment`、`scheduledAt` 日期、已完成前置工作、未過 `executableAfter` 及案件有效座標，再把工作類型分為：

```ts
const TASK_GROUP = {
  jurisdiction_review: 'verification',
  safety_response: 'verification',
  site_verification: 'verification',
  suspension_notice: 'notice',
  site_closure: 'notice',
  statutory_notice: 'notice',
  removal: 'removal',
  custody_disposal: 'removal',
  coordination_closeout: 'verification',
} as const;
```

在 `PatrolOptions` 加入必填欄位：

```ts
export interface PatrolOptions {
  travelMode: PatrolTravelMode;
  taskGroup: 'verification' | 'notice' | 'removal';
  maxStops: number;
  serviceMinutesPerStop: number;
  routeSource?: 'mapbox' | 'leaflet-estimate' | 'straight-line-estimate';
}
```

`inspection-walking` 和 `inspection-driving` 可配合 `verification` 或 `notice`；`clearance-vehicle` 只接受 `removal`。若傳入不相容組合，`buildWorkOrderPatrolRoute()` 回傳零站路線。不得把不同群組放在同一路線。

- [ ] **Step 4: 更新巡邏介面及確認回呼**

`PatrolPlanner` 接收 `workOrders` 及 `reports`，新增部門、行動日期及工作類型選擇。候選數量由工作單資格計算。確認路線時只為路線內工作單寫入 `patrolRouteId` 及 `route_assigned` 審計項目，不再把案件狀態自動改為 `scheduled`。

從 `caseAdapter.ts` 移除 `applyPatrolConfirmation()`；在 `workOrders.ts` 加入：

```ts
export function applyWorkOrderRouteConfirmation(
  orders: WorkOrder[], route: PatrolRouteDraft, actorUid: string, at: string, routeId: string,
): WorkOrder[] {
  return orders.map((order) => route.workOrderIds.includes(order.id) ? {
    ...order,
    patrolRouteId: routeId,
    updatedAt: at,
    assignmentHistory: [...order.assignmentHistory, { at, actorUid, action: 'route_assigned' }],
  } : order);
}
```

- [ ] **Step 5: 更新舊測試至新工作單路線語意**

`tests/patrol.test.ts` 保留距離、確定性及最多站點測試，但輸入改為 `WorkOrder[] + AdminReport[]`。`tests/adminWorkflow.test.ts` 及 `tests/demoFlow.test.ts` 改為驗證：案件分類和程序確認不會自動建立路線；工作單排期後才可進入路線；確認路線只更新工作單而不更改案件狀態。

- [ ] **Step 6: 執行路線及回歸測試**

Run: `node --import tsx --test tests/workOrderPatrol.test.ts tests/patrol.test.ts tests/adminWorkflow.test.ts tests/demoFlow.test.ts && npm run lint`  
Expected: 所有路線 tests PASS；TypeScript 0 errors。

- [ ] **Step 7: 提交 Task 7**

```bash
git add src/types.ts src/patrol.ts src/workOrders.ts src/components/PatrolPlanner.tsx src/App.tsx src/caseAdapter.ts tests/workOrderPatrol.test.ts tests/patrol.test.ts tests/adminWorkflow.test.ts tests/demoFlow.test.ts
git commit -m "feat: route scheduled work orders"
```

---

### Task 8: 完成端對端示範、文件及驗證

**Files:**
- Modify: `tests/demoFlow.test.ts`
- Modify: `ADMIN_SYSTEM_PLAN.md`
- Modify: `README.md` if it exists; otherwise do not create it

**Interfaces:**
- Consumes: 三個模板、工作單狀態函數、分配函數、儀表板選擇器及工作單路線函數。
- Produces: 一個自動化 Phase 1 示範流程測試及可供比賽講解的系統說明。

- [ ] **Step 1: 加入完整六工作單流程測試**

在 `tests/demoFlow.test.ts` 加入以下固定資料測試，依次執行：

1. 從公共泊車處案件產生六張工作單；
2. 為第一張工作單推薦並確認運輸署團隊；
3. 接收、排期、開始、完成證據及完成工作；
4. 驗證第二張工作單才變成可執行；
5. 把一張下游工作設為受阻，驗證儀表板 `blockedOrOverdue` 增加；
6. 完成所有必要工作，驗證聯合行動準備度為 `6/6`；
7. 驗證案件只有在人員明確更新時才結案。

```ts
import { recommendTeams } from '../src/assignment';
import { buildDashboardView } from '../src/dashboard';
import { DEMO_TEAMS } from '../src/demoData';
import { createWorkOrdersFromTemplate } from '../src/workOrderTemplates';
import { applyWorkOrderTransition, assignWorkOrder, isWorkOrderReady } from '../src/workOrders';

test('phase 1 demo shows one case, six accountable work orders and human-controlled closeout', () => {
  const at = '2026-07-15T09:00:00.000Z';
  const report = toAdminReport({
    id: 'joint-case', location: '沙田公共單車泊車處', description: '聯合行動示範',
    status: 'classified', date: '2026-07-15', lat: 22.38, lng: 114.18,
  });
  const orders = createWorkOrdersFromTemplate(report, 'public_bike_parking_joint_operation', at, 'joint-demo');
  assert.equal(orders.length, 6);

  const recommendations = recommendTeams(orders[0], DEMO_TEAMS, new Date(at));
  const selectedTeam = DEMO_TEAMS.find((team) => team.id === recommendations[0].teamId);
  assert.ok(selectedTeam);
  let first = assignWorkOrder(orders[0], selectedTeam, 'coordinator-demo', at);
  first = applyWorkOrderTransition(first, 'accepted', 'team-lead-demo', '2026-07-15T09:10:00.000Z');
  first = applyWorkOrderTransition(first, 'scheduled', 'team-lead-demo', '2026-07-15T09:20:00.000Z');
  first = applyWorkOrderTransition(first, 'in_progress', 'staff-demo', '2026-07-15T09:30:00.000Z');
  first = { ...first, evidenceChecklist: first.evidenceChecklist.map((item) => ({ ...item, completed: true })) };
  first = applyWorkOrderTransition(first, 'completed', 'staff-demo', '2026-07-15T10:00:00.000Z');
  assert.equal(isWorkOrderReady(orders[1], [first, ...orders.slice(1)], new Date('2026-07-15T10:01:00.000Z')), true);

  const blockedOrders = [first, ...orders.slice(1)].map((order) => order.id === orders[3].id
    ? { ...order, status: 'blocked' as const, blockerReason: '等待法定期限屆滿' }
    : order);
  const operation = {
    id: 'joint-demo', title: '沙田聯合行動', location: report.location, district: '沙田',
    actionDate: '2026-07-15', coordinatingDepartment: 'HAD' as const,
    participatingDepartments: ['HAD', 'TD', 'LandsD', 'FEHD', 'HKPF'] as const,
    mandatoryWorkOrderIds: orders.map((order) => order.id), status: 'preparing' as const,
  };
  const blockedView = buildDashboardView([report], blockedOrders, [{ ...operation, participatingDepartments: [...operation.participatingDepartments] }], {
    district: 'all', department: 'all', date: '2026-07-15', status: 'all',
  }, new Date('2026-07-15T10:01:00.000Z'));
  assert.equal(blockedView.summary.blockedOrOverdue, 1);

  const completedOrders = orders.map((order) => ({
    ...order,
    status: 'completed' as const,
    evidenceChecklist: order.evidenceChecklist.map((item) => ({ ...item, completed: true })),
  }));
  const completedView = buildDashboardView([report], completedOrders, [{ ...operation, participatingDepartments: [...operation.participatingDepartments] }], {
    district: 'all', department: 'all', date: '2026-07-15', status: 'all',
  }, new Date('2026-07-15T17:00:00.000Z'));
  assert.equal(completedView.operationReadiness[0].completed, 6);
  assert.equal(completedView.operationReadiness[0].ready, true);
  assert.equal(report.status, 'classified');
});
```

測試不可使用系統當前時間或隨機 ID。

- [ ] **Step 2: 更新管理系統計劃文件**

在 `ADMIN_SYSTEM_PLAN.md` 加入「Phase 1 工作分配及統籌儀表板」章節，列明：

- 一宗案件、多張工作單；
- 五個示範部門及十個示範團隊；
- 三個示範流程模板；
- 規則輔助、人員確認；
- 儀表板六張概況卡、優先清單、工作量及聯合行動準備度；
- 路線只使用已排期工作單；
- 所有資料為原型示範資料；
- 不包含 AI 自動派工、正式政府績效或真實系統接駁。

- [ ] **Step 3: 執行完整自動驗證**

Run: `npm test`  
Expected: 所有 tests PASS，沒有 skip 或 fail。

Run: `npm run lint`  
Expected: TypeScript 0 errors。

Run: `git diff --check`  
Expected: 沒有輸出，exit code 0。

- [ ] **Step 4: 執行 Vite 建置**

Run: `npm run build`  
Expected: `vite build` 完成並產生 `dist/`。若 iCloud 路徑中的 `#` 令建置失敗，複製已追蹤原始碼到 `/private/tmp/bike-trace-phase1-build` 後在該暫存路徑執行 `npm ci && npm run build`；只把建置結果記錄在交付說明，不提交 `dist/` 或暫存檔。

- [ ] **Step 5: 執行人工示範驗收**

Run: `npm run dev`  
Expected: 使用示範密碼登入後可完成以下流程：

1. 儀表板顯示原型資料提示及六張概況卡；
2. 篩選沙田和指定部門後所有區塊同步更新；
3. 從優先工作進入相應案件；
4. 為一宗案件建立流程模板及分配團隊；
5. 未完成前置工作時下游按鈕鎖定；
6. 受阻工作出現在儀表板；
7. 只有已排期、同部門、同日期及同類型工作進入路線；
8. 重設示範案件同時重設工作單及聯合行動。

完成後按 Ctrl-C 停止伺服器。

- [ ] **Step 6: 提交 Task 8**

```bash
git add tests/demoFlow.test.ts ADMIN_SYSTEM_PLAN.md README.md
git commit -m "docs: complete phase 1 assignment demo"
```

若專案沒有 `README.md`，提交指令改為：

```bash
git add tests/demoFlow.test.ts ADMIN_SYSTEM_PLAN.md
git commit -m "docs: complete phase 1 assignment demo"
```

---

## Final Verification Checklist

- [ ] `npm test` 全部通過。
- [ ] `npm run lint` 沒有 TypeScript 錯誤。
- [ ] `npm run build` 在原路徑或安全暫存路徑成功。
- [ ] `git diff --check` 沒有空白錯誤。
- [ ] 一宗公共泊車處案件可產生六張工作單。
- [ ] 不具權責、地區、職能或設備的團隊不會獲推薦。
- [ ] 重新指派、退回及受阻均保留理由和審計紀錄。
- [ ] 所有必要工作未完成前，案件不能透過工作單自動結案。
- [ ] 儀表板全部區塊使用同一組篩選結果。
- [ ] 路線只包含已排期、可執行、同部門、同日期及相容工作類型的工作單。
- [ ] 所有政府後台畫面均標示為原型示範資料。
- [ ] Git 提交不包含四項使用者自有未提交檔案。
