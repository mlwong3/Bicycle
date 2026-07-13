# 跨部門單車個案管理 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在現有騎跡市民舉報及管理員示範工作台上，建立可測試的跨部門案件分類、人工 rubric、可配置程序、巡查次序建議及公開狀態同步 MVP。

**Architecture:** 保留現有 `Report`、Firebase 輕量同步及 localStorage fallback，以 `AdminReport`／`PublicReport` adapter 建立公開與內部資料邊界。AI 本輪只提供不含相片的文字／欄位規則式分類介面；巡查採純函式優先度、最近鄰居及 2-opt，並由管理員確認後才更新案件。

**Tech Stack:** React 19、Vite、TypeScript、Firebase Firestore／Storage adapter、Leaflet／現有地圖元件、Node test runner + tsx、Tailwind CSS。

## Global Constraints

- 系統定位固定為「跨部門單車舉報、巡查及個案管理原型」，不宣稱正式政府執法系統。
- 本期移除 AI 相片分析；六項相片 rubric 由管理員人工觀察及記錄。
- AI 只處理文字、表單欄位及人工觀察摘要，不直接閱讀相片及不直接改變案件狀態。
- AI、分類及路線均屬建議；最終決定須留下操作者、時間及備註。
- 通知期限、程序名稱及部門可配置，不把 14 日寫成固定法律規定。
- 只有 `clearance_approved`、有效座標、程序已確認及非重複案件可加入巡查建議。
- 不把 AI API 金鑰放在前端 `VITE_` 環境變數或瀏覽器程式碼中。
- `sessionStorage` 只保存示範介面狀態，不作真正管理員權限來源。
- 示範資料標示為 `Prototype Simulation`，並可一鍵重設。
- 保留未相關的 `esp32/parking_sensor/parking_sensor.ino`、`.agents/`、NFC 壓縮檔及 `skills-lock.json` 既有修改，不納入提交。

---

### Task 1: 共用型別及案件狀態機

**Files:**
- Modify: `src/types.ts`
- Create: `src/reportStatus.ts`
- Modify: `src/admin.ts`
- Test: `tests/reportStatus.test.ts`

**Interfaces:**
- `ReportStatus`, `CaseType`, `Urgency`, `PublicReport`, `AdminReport`, `ReportEvent` 放在 `src/types.ts`。
- `canTransition(from: ReportStatus, to: ReportStatus): boolean`。
- `getStatusLabel(status: ReportStatus): string`。
- `toPublicStatus(status: ReportStatus): PublicReport['publicStatus']`。
- `getPublicStatusLabel(status: ReportStatus): string`。
- `ALL_REPORT_STATUSES: readonly ReportStatus[]`。
- `isRouteEligible(report: Pick<AdminReport, ...>): boolean`。
- `admin.ts` re-export 狀態型別及現有 session helper，維持現有 import 相容。
- `Report` retains `reporterUid?`, `citizenTags: string[]`, `locationSource`, and optional `demoMode` so existing App consumers remain structurally compatible。

Test fixtures used by later tasks are created in `tests/fixtures.ts`:

```ts
export const START = { lat: 22.38, lng: 114.18 };
export const OPTIONS = {
  travelMode: 'inspection-walking' as const,
  maxStops: 8,
  serviceMinutesPerStop: 12,
};
export function makeAdminReport(patch: Partial<AdminReport> = {}): AdminReport {
  return {
    id: `test-${Math.random()}`,
    location: '示範地點', description: '單車阻塞通道', date: '2026-07-13',
    status: 'reviewing', procedureConfirmed: false,
    coordinatesValid: true, isDuplicate: false, ...patch,
  };
}
export function makeEligibleReports(count: number): AdminReport[] {
  return Array.from({ length: count }, (_, index) => makeAdminReport({
    id: `eligible-${index}`, status: 'clearance_approved',
    procedureConfirmed: true, lat: 22.38 + index * 0.001, lng: 114.18 + index * 0.001,
  }));
}
```

- [ ] **Step 1: Write the failing tests**

```ts
test('clearance approval is required before scheduled', () => {
  assert.equal(canTransition('classified', 'scheduled'), false);
  assert.equal(canTransition('clearance_approved', 'scheduled'), true);
});

test('public mapping hides internal workflow states', () => {
  assert.equal(toPublicStatus('classified'), 'processing');
  assert.equal(toPublicStatus('resolved'), 'resolved');
  assert.equal(toPublicStatus('dismissed'), 'dismissed');
});

test('patrol eligibility requires procedure, coordinates and non-duplicate state', () => {
  const base = {
    status: 'clearance_approved' as const,
    coordinatesValid: true,
    procedureConfirmed: true,
    isDuplicate: false,
  };
  assert.equal(isRouteEligible(base), true);
  assert.equal(isRouteEligible({ ...base, procedureConfirmed: false }), false);
  assert.equal(isRouteEligible({ ...base, isDuplicate: true }), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reportStatus.test.ts`

Expected: FAIL because the new status functions do not exist.

- [ ] **Step 3: Write minimal implementation**

Move the status union from `src/admin.ts` to `src/types.ts`; add the full 14-state union from the design, the transition table with branch states, public status mapping, labels and route eligibility. Re-export `ReportStatus` and `StatusHistoryEntry` from `src/admin.ts` so current components keep compiling.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reportStatus.test.ts`

Expected: all new state and mapping tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/reportStatus.ts src/admin.ts tests/reportStatus.test.ts
git commit -m "refactor: add cross-department report state model"
```

### Task 2: 人工 rubric 及可配置程序

**Files:**
- Create: `src/rubric.ts`
- Create: `src/procedureConfig.ts`
- Test: `tests/rubric.test.ts`
- Test: `tests/procedureConfig.test.ts`

**Interfaces:**
- `RubricObservation`, `ManualRubric`, `RubricSummary`, `ProcedureConfig` from `src/types.ts`。
- `calculateRubricSummary(rubric: ManualRubric): RubricSummary`。
- `DEFAULT_PROCEDURES: ProcedureConfig[]`。
- `calculateDeadline(config: ProcedureConfig, issuedAt: Date): string | null`。
- `createProcedureSnapshot(config: ProcedureConfig): ProcedureConfig`。

- [ ] **Step 1: Write the failing tests**

```ts
test('unobservable rubric values are excluded rather than scored as zero', () => {
  const summary = calculateRubricSummary({
    rust: { score: null, observable: false },
    tire: { score: 3, observable: true },
    dust: { score: 1, observable: true },
    attachment: { score: null, observable: false },
    missing: { score: 0, observable: true },
    lock: { score: null, observable: false },
  });
  assert.equal(summary.scoredCount, 3);
  assert.equal(summary.totalScore, 4);
  assert.equal(summary.dataSufficiency, 'partial');
});

test('procedure deadline uses the selected snapshot, not a fixed 14-day rule', () => {
  const config = { ...DEFAULT_PROCEDURES[0], noticePeriodHours: 48 };
  assert.equal(calculateDeadline(config, new Date('2026-07-13T10:00:00.000Z')), '2026-07-15T10:00:00.000Z');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/rubric.test.ts tests/procedureConfig.test.ts`

Expected: FAIL because the modules and functions do not exist.

- [ ] **Step 3: Write minimal implementation**

Implement six named rubric keys, count only `observable && score !== null`, return `dataSufficiency` as `sufficient`, `partial` or `insufficient`, and calculate deadlines from `noticePeriodHours`. Include two clearly labelled demo procedures with configurable values and no hard-coded 14-day logic.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/rubric.test.ts tests/procedureConfig.test.ts`

Expected: all rubric and procedure tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/rubric.ts src/procedureConfig.ts tests/rubric.test.ts tests/procedureConfig.test.ts
git commit -m "feat: add manual rubric and configurable procedures"
```

### Task 3: AI 文字分類介面及規則式 fallback

**Files:**
- Create: `src/aiClassification.ts`
- Modify: `src/types.ts`
- Test: `tests/aiClassification.test.ts`

**Interfaces:**
- `AiClassificationInput`, `AiCaseClassification` from `src/types.ts`。
- `buildAiClassificationInput(report: AdminReport): AiClassificationInput`。
- `fallbackClassifyReport(input: AiClassificationInput): AiCaseClassification`。
- `classifyReportText(input: AiClassificationInput): Promise<AiCaseClassification>`，本輪固定回傳 deterministic fallback 並標示 `source: 'rule-fallback'`。

- [ ] **Step 1: Write the failing tests**

```ts
test('classification input contains text and structured fields but no image data', () => {
  const input = buildAiClassificationInput({
    id: 'r1', description: '單車阻塞行人通道', location: '示範地點', date: '2026-07-13',
    status: 'reviewing', imageUrl: 'data:image/png;base64,SECRET', citizenTags: ['obstruction'],
    coordinatesValid: true, isDuplicate: false, procedureConfirmed: false,
  });
  assert.equal('imageUrl' in input, false);
  assert.equal(input.hasCoordinates, true);
});

test('fallback classification is advisory and requests missing information', async () => {
  const result = await classifyReportText({
    reportId: 'r1', description: '單車阻塞行人通道', citizenTags: ['obstruction'],
    locationLabel: '示範地點', hasCoordinates: false,
    manualRubricSummary: { observedIndicators: [], unobservableIndicators: ['lock'] },
  });
  assert.equal(result.source, 'rule-fallback');
  assert.equal(result.caseType, 'obstruction');
  assert.equal(result.missingInformation.includes('GPS 位置'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/aiClassification.test.ts`

Expected: FAIL because the classification module does not exist.

- [ ] **Step 3: Write minimal implementation**

Build a whitelisted text input, classify obstruction/safety/damage/abandoned keywords deterministically, set low confidence when coordinates or rubric data are missing, and never return a direct-clearing or direct-confiscation instruction.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/aiClassification.test.ts`

Expected: all classification tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/aiClassification.ts src/types.ts tests/aiClassification.test.ts
git commit -m "feat: add advisory text classification fallback"
```

### Task 4: 優先度及巡查次序純函式

**Files:**
- Create: `src/priority.ts`
- Create: `src/patrol.ts`
- Test: `tests/patrol.test.ts`

**Interfaces:**
- `PatrolOptions`, `PatrolRouteDraft`, `Coordinates` from `src/types.ts`。
- `PatrolOptions` includes `routeSource?: 'mapbox' | 'leaflet-estimate' | 'straight-line-estimate'`。
- `PatrolRouteDraft` includes `initialDistanceKm`, `estimatedDistanceKm`, `reportIds`, `orderedStops`, `status: 'draft'`, `algorithm`, `routeSource`, `travelMode` and `estimatedTravelMinutesRange`。
- `calculatePriorityScore(report: AdminReport, now: Date): number`。
- `buildPatrolOrder(start: Coordinates, reports: AdminReport[], options: PatrolOptions): PatrolRouteDraft`。
- `haversineDistanceKm(a: Coordinates, b: Coordinates): number`。

- [ ] **Step 1: Write the failing tests**

```ts
test('patrol planner selects at most the configured five to eight stops', () => {
  const reports = makeEligibleReports(9);
  const route = buildPatrolOrder({ lat: 22.38, lng: 114.18 }, reports, {
    travelMode: 'inspection-walking', maxStops: 5, serviceMinutesPerStop: 12,
  });
  assert.equal(route.reportIds.length, 5);
  assert.equal(route.algorithm, 'nearest-neighbor-2opt');
});

test('same inputs produce the same order and 2-opt does not increase distance', () => {
  const reports = makeEligibleReports(6);
  const first = buildPatrolOrder(START, reports, OPTIONS);
  const second = buildPatrolOrder(START, reports, OPTIONS);
  assert.deepEqual(first.reportIds, second.reportIds);
  assert.equal(first.estimatedDistanceKm <= first.initialDistanceKm, true);
});

test('route draft uses a limitation label when no map route is available', () => {
  const route = buildPatrolOrder(START, makeEligibleReports(2), { ...OPTIONS, routeSource: 'straight-line-estimate' });
  assert.equal(route.routeSource, 'straight-line-estimate');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/patrol.test.ts`

Expected: FAIL because the planner modules do not exist.

- [ ] **Step 3: Write minimal implementation**

Normalize the five priority factors, filter with `isRouteEligible`, sort ties by report id, apply maxStops, create a nearest-neighbour route from the start point, and run deterministic 2-opt only when it reduces Haversine distance. Add service minutes and travel-mode metadata; default route source is `straight-line-estimate` until a map route is integrated.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/patrol.test.ts`

Expected: all patrol tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/priority.ts src/patrol.ts src/types.ts tests/patrol.test.ts
git commit -m "feat: add explainable patrol ordering"
```

### Task 5: Adapter、示範資料及後端相容層

**Files:**
- Create: `src/caseAdapter.ts`
- Create: `src/demoData.ts`
- Modify: `src/data.ts`
- Modify: `src/backend.ts`
- Test: `tests/caseAdapter.test.ts`

**Interfaces:**
- `toAdminReport(report: Report): AdminReport`。
- `toPublicReport(report: Report): PublicReport`。
- `applyAdminPatch(report: AdminReport, patch: Partial<AdminReport>): AdminReport`。
- `INITIAL_ADMIN_REPORTS: AdminReport[]` with six `Prototype Simulation` cases。
- `getAdminReports()` and `getCitizenReports(reporterUid?: string)` use Firebase when available and local adapter fallback otherwise。

- [ ] **Step 1: Write the failing tests**

```ts
test('legacy report is adapted with safe internal defaults', () => {
  const admin = toAdminReport({ id: 'legacy', location: '沙田', description: '阻塞', status: 'pending', date: '2026-07-13' });
  assert.equal(admin.caseType, 'other');
  assert.equal(admin.locationSource, 'unknown');
  assert.equal(admin.procedureConfirmed, false);
  assert.equal(toPublicReport(admin).publicStatus, 'pending');
});

test('demo data covers six distinct workflow situations', () => {
  assert.equal(INITIAL_ADMIN_REPORTS.length, 6);
  assert.equal(INITIAL_ADMIN_REPORTS.every((report) => report.demoMode === true), true);
  assert.equal(INITIAL_ADMIN_REPORTS.some((report) => report.status === 'clearance_approved'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/caseAdapter.test.ts`

Expected: FAIL because adapter and new demo data do not exist.

- [ ] **Step 3: Write minimal implementation**

Create adapters that preserve image, location, description, date and coordinates; map all internal states to four public states; add six labelled cases covering obstruction, suspected abandonment, damaged bicycle, duplicate, insufficient information and a patrol-ready case. Keep `INITIAL_REPORTS` as a public-compatible projection for existing App consumers.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/caseAdapter.test.ts`

Expected: all adapter and demo-data tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/caseAdapter.ts src/demoData.ts src/data.ts src/backend.ts tests/caseAdapter.test.ts
git commit -m "feat: add public and admin case adapters"
```

### Task 6: 管理員工作台及表單整合

**Files:**
- Create: `src/components/ManualRubricForm.tsx`
- Create: `src/components/ProcedureConfigPanel.tsx`
- Create: `src/components/CaseClassificationPanel.tsx`
- Create: `src/components/PatrolPlanner.tsx`
- Modify: `src/components/AdminTab.tsx`
- Modify: `src/App.tsx`
- Test: `tests/adminWorkflow.test.ts`

**Interfaces:**
- `AdminTab` receives `AdminReport[]` and emits `onPatchReport(reportId, patch)`。
- `PatrolPlanner` emits `onConfirmRoute(route: PatrolRouteDraft)` only from its explicit confirmation button。
- `ManualRubricForm` emits `ManualRubric` only after all six fields are explicitly selected or marked unobservable。
- `ProcedureConfigPanel` emits a copied `ProcedureConfig` and `procedureConfirmed: true` only after user action。
- `PatrolPlanner` receives `AdminReport[]`, `start`, and `PatrolOptions`; emits `PatrolRouteDraft` and explicit confirmation。

- [ ] **Step 1: Write the failing workflow tests**

```ts
test('admin patch records classification and procedure confirmation without resolving the case', () => {
  const initial = makeAdminReport({ status: 'classified' });
  const patched = applyAdminPatch(initial, {
    caseType: 'obstruction', urgency: 'urgent', procedureConfirmed: true,
  });
  assert.equal(patched.status, 'classified');
  assert.equal(patched.procedureConfirmed, true);
  assert.equal(patched.caseType, 'obstruction');
});

test('route confirmation is the only action that schedules eligible cases', () => {
  const route = buildPatrolOrder(START, [makeAdminReport({ status: 'clearance_approved' })], OPTIONS);
  assert.equal(route.status, 'draft');
  assert.equal(canTransition('clearance_approved', 'scheduled'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/adminWorkflow.test.ts`

Expected: FAIL because the new patch and workflow integration do not exist.

- [ ] **Step 3: Write minimal implementation**

Replace the old six-status filters in `AdminTab` with the new labels and filters. Add classification suggestions with accept/edit actions, the six-item rubric form, procedure snapshot/confirmation panel, timeline event rendering and a patrol planner showing priority, ordered stops, distance estimate, route source and limitation notice. In `App.tsx`, merge admin patches into the existing report state, persist locally, sync best-effort, and update selected reports to `scheduled` only after explicit route confirmation.

- [ ] **Step 4: Run tests and type-check**

Run: `npm test -- tests/adminWorkflow.test.ts`

Expected: workflow tests PASS.

Run: `npm run lint`

Expected: TypeScript exits with code 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/ManualRubricForm.tsx src/components/ProcedureConfigPanel.tsx src/components/CaseClassificationPanel.tsx src/components/PatrolPlanner.tsx src/components/AdminTab.tsx src/App.tsx tests/adminWorkflow.test.ts
git commit -m "feat: integrate cross-department admin workbench"
```

### Task 7: 市民端公開狀態、舉報欄位及文件同步

**Files:**
- Modify: `src/components/ReportTab.tsx`
- Modify: `src/components/PersonalTab.tsx`
- Modify: `src/reportWorkflow.ts`
- Modify: `src/admin.ts`
- Modify: `UPDATE_SPEC.md`
- Modify: `ADMIN_SYSTEM_PLAN.md`
- Test: `tests/publicStatus.test.ts`

**Interfaces:**
- `CitizenReportSubmission` includes `citizenTags: string[]` and `locationSource: 'gps' | 'manual' | 'unknown'`。
- `createCitizenReport` stores tags and location source without exposing admin fields。
- Personal records use `getPublicStatusLabel` and never display internal status names。

- [ ] **Step 1: Write the failing tests**

```ts
test('citizen submission retains tags and location source', () => {
  const report = createCitizenReport({
    id: 'r-tags', location: '示範地點', description: '阻塞通道',
    citizenTags: ['obstruction'], locationSource: 'manual', date: '2026-07-13', at: '2026-07-13T10:00:00.000Z',
  });
  assert.deepEqual(report.citizenTags, ['obstruction']);
  assert.equal(report.locationSource, 'manual');
});

test('all internal states have a public label', () => {
  for (const status of ALL_REPORT_STATUSES) assert.ok(getPublicStatusLabel(status));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/publicStatus.test.ts`

Expected: FAIL because the new submission fields and public labels do not exist.

- [ ] **Step 3: Write minimal implementation**

Add selectable citizen tags for obstruction, suspected abandonment, damaged bicycle and safety hazard; preserve GPS/manual source; update PersonalTab badges and counts to public labels; update both planning documents to state that AI handles text/fields only and that patrol results are estimates.

- [ ] **Step 4: Run tests and type-check**

Run: `npm test -- tests/publicStatus.test.ts`

Expected: public status tests PASS.

Run: `npm run lint`

Expected: TypeScript exits with code 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/ReportTab.tsx src/components/PersonalTab.tsx src/reportWorkflow.ts src/admin.ts UPDATE_SPEC.md ADMIN_SYSTEM_PLAN.md tests/publicStatus.test.ts
git commit -m "feat: sync public case status and report metadata"
```

### Task 8: 整合驗收及交付

**Files:**
- Create: `tests/demoFlow.test.ts`
- Modify: `README.md` or `UPDATE_SPEC.md` if the current demo instructions are stale

- [ ] **Step 1: Write the end-to-end pure-flow test**

```ts
test('demo flow stops at human confirmation boundaries', () => {
  const report = makeAdminReport({ status: 'classified', coordinatesValid: true });
  assert.equal(isRouteEligible(report), false);
  const confirmed = applyAdminPatch(report, { status: 'clearance_approved', procedureConfirmed: true });
  assert.equal(isRouteEligible(confirmed), true);
  const draft = buildPatrolOrder(START, [confirmed], OPTIONS);
  assert.equal(draft.status, 'draft');
});
```

- [ ] **Step 2: Run the complete verification suite**

Run: `npm test`

Expected: zero failed tests.

Run: `npm run lint`

Expected: TypeScript exits with code 0.

Run: `npm run build`

Expected: Vite exits with code 0. If the iCloud path stalls at `#`, copy the repo to `/private/tmp/bike-trace-cross-department-build` without changing source files and rerun there.

- [ ] **Step 3: Review changed files and unrelated worktree state**

Run: `git diff --check`, `git status --short`, and `git diff --stat HEAD~1`.

Confirm that only the planned commits contain changes and the pre-existing ESP32, `.agents/`, NFC archive and lockfile remain untouched.

- [ ] **Step 4: Commit final verification/document updates**

```bash
git add tests/demoFlow.test.ts README.md UPDATE_SPEC.md
git commit -m "test: verify cross-department demo flow"
```
