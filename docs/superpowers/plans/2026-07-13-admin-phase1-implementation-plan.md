# 騎跡管理員系統 Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成管理員示範工作台的 Phase 1 基礎閉環，將舉報資料擴充為可追蹤案件，同時把 AI 部分隔離為一次性「疑似棄置風險評估」試運行。

**Architecture:** 保持現有 React + Vite 單頁架構。以 `src/admin.ts` 放置可測試的狀態機、標籤及路線候選資料邏輯；`AdminTab` 只負責示範登入及介面；App 維持 reports 單一狀態來源。Firebase 寫入採 best-effort，權限失敗時保留 localStorage／記憶體示範能力，不放寬現有 Firestore 規則。

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4, Firebase Auth/Firestore/Storage, Node `node:test` + 已有 `tsx`。

## Global Constraints

- AI正式方案暫不加入 Gemini Vision；AI試運行不得修改正式 `Report` 或觸發巡邏路線。
- 所有文件及介面使用「疑似棄置風險評估」，不使用「停泊時長推斷」作為功能名稱。
- 示範密碼只代表展示登入，不能宣稱為正式政府身份驗證。
- 不放寬 Firestore 規則至所有匿名使用者可讀寫全部案件。
- 沒有 `lat/lng` 的案件不得成為日後巡邏路線候選。
- 保留現有 ESP32 修改、`.agents/`、NFC 壓縮檔及其他未相關工作樹變更。
- 建置若受工作區路徑中的 `#` 影響，須於不含 `#` 的暫存路徑重跑驗證。

## File Map

- Modify `src/types.ts`: 報告狀態、座標及狀態歷史型別。
- Create `src/admin.ts`: 純函式狀態機、標籤、示範 session 及巡邏候選篩選。
- Modify `src/backend.ts`: best-effort 管理員登入記錄、狀態同步、報告讀取及圖片上傳。
- Modify `src/App.tsx`: AdminTab 路由、報告更新回呼、座標保存及圖片上傳後更新。
- Create `src/components/AdminTab.tsx`: 管理員示範登入、案件列表、詳情及時間線。
- Modify `src/components/ReportTab.tsx`: 保存 GPS 座標及手動改址時清除舊座標。
- Modify `src/components/MenuSidebar.tsx`: 加入管理員模式入口。
- Modify `src/components/PersonalTab.tsx`: 將新狀態映射為市民可理解的文案。
- Modify `src/data.ts`: 為示範案件補充座標及狀態歷史資料。
- Modify `package.json`: 加入 `test` script。
- Create `tests/admin.test.ts`: 狀態轉換及巡邏候選測試。
- Create `tests/report.test.ts`: 市民端狀態映射及座標資料測試。
- Modify `ADMIN_SYSTEM_PLAN.md`: 改用風險評估術語及補充 Phase 1／路線限制。
- Modify `UPDATE_SPEC.md`: 記錄本次變更及仍未完成的 AI／路線工作。

---

### Task 1: 建立測試入口及可測試的管理員規則

**Files:**
- Modify: `package.json`
- Create: `tests/admin.test.ts`
- Create: `tests/report.test.ts`
- Create: `src/admin.ts`

**Interfaces:**
- Produces `ReportStatus`, `getStatusLabel(status)`, `getAllowedNextStatuses(status)`, `appendStatusHistory(report, nextStatus, actor, note, at)`, `getPatrolEligibleReports(reports)`。

- [ ] **Step 1: Write the failing tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { getAllowedNextStatuses, appendStatusHistory, getPatrolEligibleReports } from '../src/admin';

test('pending only advances to reviewing or dismissed', () => {
  assert.deepEqual(getAllowedNextStatuses('pending'), ['reviewing', 'dismissed']);
});

test('status update appends history without removing existing entries', () => {
  const report = {
    id: 'r1', location: '沙田', description: '阻路', status: 'pending' as const,
    date: '2026-07-13', statusHistory: [{ status: 'pending', at: '2026-07-13T09:00:00.000Z', by: 'citizen' }]
  };
  const updated = appendStatusHistory(report, 'reviewing', 'admin-demo', '已接收', '2026-07-13T10:00:00.000Z');
  assert.equal(updated.status, 'reviewing');
  assert.equal(updated.statusHistory?.length, 2);
  assert.equal(updated.statusHistory?.[0].status, 'pending');
});

test('patrol candidates require coordinates and an actionable status', () => {
  const reports = [
    { id: 'a', status: 'noticed' as const, lat: 22.38, lng: 114.18 },
    { id: 'b', status: 'scheduled' as const },
    { id: 'c', status: 'resolved' as const, lat: 22.39, lng: 114.19 },
  ];
  assert.deepEqual(getPatrolEligibleReports(reports).map((report) => report.id), ['a']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --test-name-pattern="pending only advances|status update appends|patrol candidates"`

Expected: FAIL because `src/admin.ts` and the `test` script do not exist yet.

- [ ] **Step 3: Implement the minimal pure helpers**

```ts
export type ReportStatus = 'pending' | 'reviewing' | 'noticed' | 'scheduled' | 'resolved' | 'dismissed';

export interface StatusHistoryEntry {
  status: ReportStatus;
  at: string;
  by: string;
  note?: string;
}

export function getAllowedNextStatuses(status: ReportStatus): ReportStatus[] {
  return {
    pending: ['reviewing', 'dismissed'],
    reviewing: ['noticed', 'dismissed'],
    noticed: ['scheduled', 'dismissed'],
    scheduled: ['resolved', 'dismissed'],
    resolved: [],
    dismissed: [],
  }[status];
}
```

Add the remaining helpers with immutable report updates and filter candidates to `noticed`/`scheduled` reports with finite numeric coordinates. Add `"test": "tsx --test tests/*.test.ts"` to `package.json`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`

Expected: all current tests pass with zero failures.

- [ ] **Step 5: Commit**

```bash
git add package.json src/admin.ts tests/admin.test.ts tests/report.test.ts
git commit -m "test: define admin report workflow rules"
```

### Task 2: 擴充 Report 資料模型及後端 best-effort 介面

**Files:**
- Modify: `src/types.ts`
- Modify: `src/backend.ts`
- Modify: `firestore.rules` only if a narrow, non-public rule is required; do not add allow-all rules.
- Test: `tests/admin.test.ts`

**Interfaces:**
- `Report` consumes `ReportStatus` and `StatusHistoryEntry` from `admin.ts`。
- Produces `syncReportStatus(report)`, `recordAdminDemoLogin()`, `fetchAllReports()` and `uploadReportImage(imageUrl, reportId)`。

- [ ] **Step 1: Write the failing test for backward-compatible report data**

```ts
test('patrol candidate filtering accepts legacy reports without history', () => {
  const legacy = { id: 'legacy', location: '大埔', description: '單車', status: 'pending' as const, date: '2026-06-19' };
  assert.deepEqual(getPatrolEligibleReports([legacy]), []);
});
```

- [ ] **Step 2: Run the focused test and verify the intended failure**

Run: `npm test -- --test-name-pattern="backward-compatible"`

Expected: FAIL until the expanded `Report`/status helper contract is compiled and used by the test.

- [ ] **Step 3: Implement the data contract**

```ts
export interface Report {
  id: string;
  imageUrl?: string;
  location: string;
  lat?: number;
  lng?: number;
  description: string;
  status: ReportStatus;
  date: string;
  noticeDate?: string;
  statusHistory?: StatusHistoryEntry[];
  handledBy?: string;
}
```

In `backend.ts`, keep existing `syncReport` behavior for citizen creation. Add separate best-effort functions that catch permission/network errors and return `false`/`null` rather than breaking local demo mode. `uploadReportImage` only uploads data URLs to `reports/<reportId>.<extension>` and returns the original URL when upload is unavailable.

- [ ] **Step 4: Run tests and type checking**

Run: `npm test && npm run lint`

Expected: tests pass and TypeScript reports zero errors; any existing UI status comparisons must be fixed before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/backend.ts tests/admin.test.ts
git commit -m "feat: extend reports for admin workflow"
```

### Task 3: 保存 GPS 座標及示範案件資料

**Files:**
- Modify: `src/components/ReportTab.tsx`
- Modify: `src/App.tsx`
- Modify: `src/data.ts`
- Test: `tests/report.test.ts`

**Interfaces:**
- `ReportTab` passes `lat`/`lng` only when the current location was obtained by GPS and has not been manually edited afterwards。
- `App.handleAddReport` creates `pending` reports with an initial `statusHistory` entry and preserves local fallback behavior。

- [ ] **Step 1: Write the failing test for status mapping and coordinate eligibility**

```ts
import { getCitizenStatusLabel } from '../src/admin';

test('citizen status mapping hides internal workflow details', () => {
  assert.equal(getCitizenStatusLabel('noticed'), '處理中');
  assert.equal(getCitizenStatusLabel('scheduled'), '處理中');
  assert.equal(getCitizenStatusLabel('resolved'), '已清理');
  assert.equal(getCitizenStatusLabel('dismissed'), '不成立');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --test-name-pattern="citizen status mapping"`

Expected: FAIL because the mapping helper does not yet exist.

- [ ] **Step 3: Implement GPS-aware submission**

Add a `locationCoords` state to `ReportTab`; set it after `getCurrentPosition`, clear it when the location input is manually edited, pass it in `onAddReport`, and clear it after submission. In `App.tsx`, initialize new reports with:

```ts
status: 'pending',
statusHistory: [{ status: 'pending', at: new Date().toISOString(), by: 'citizen' }],
lat: newReportData.lat,
lng: newReportData.lng,
```

Add coordinates to the existing three seed reports only when the source data already has a reliable demo location; otherwise leave them absent so the route filter behaves honestly.

- [ ] **Step 4: Run the test and type checking**

Run: `npm test -- --test-name-pattern="citizen status mapping" && npm run lint`

Expected: PASS and no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ReportTab.tsx src/App.tsx src/data.ts src/admin.ts tests/report.test.ts
git commit -m "feat: preserve report coordinates and citizen status labels"
```

### Task 4: 建立管理員示範登入及 AdminTab

**Files:**
- Create: `src/components/AdminTab.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/MenuSidebar.tsx`
- Modify: `src/backend.ts`
- Test: `tests/admin.test.ts`

**Interfaces:**
- `AdminTabProps` consumes `reports`, `onUpdateReport`, `onResetDemoReports`, and `onNotify`。
- `AdminTab` uses `ADMIN_SESSION_KEY`, `isAdminSession()`, `startAdminSession()` and `endAdminSession()` from `admin.ts`。

- [ ] **Step 1: Write the failing test for session behavior**

```ts
test('admin session uses a dedicated session key', () => {
  assert.equal(ADMIN_SESSION_KEY, 'bike_trace:admin_demo_session');
  assert.equal(isAdminPasswordValid('admin2026', 'admin2026'), true);
  assert.equal(isAdminPasswordValid('wrong', 'admin2026'), false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --test-name-pattern="admin session"`

Expected: FAIL because the session helpers do not yet exist.

- [ ] **Step 3: Implement the minimal session and UI**

Use `sessionStorage` only when `window` is available. The login view must show the demonstration warning. The authenticated view must contain:

- status filter buttons;
- report cards with image, location, date and status;
- selected report detail;
- only the allowed next status buttons from `getAllowedNextStatuses`;
- note field and timeline;
- logout and reset demonstration data controls.

In `App.tsx`, add `admin` to desktop/mobile-accessible navigation, render `AdminTab`, and update reports immutably through `appendStatusHistory`. Call `syncReportStatus` as a non-blocking best-effort operation.

- [ ] **Step 4: Run tests, type check and local build**

Run: `npm test && npm run lint && npm run build`

Expected: all tests pass, TypeScript passes, and Vite build exits with code 0. If the iCloud `#` path causes a Vite path error, copy the repo to a temporary path without `#` and rerun the same commands there.

- [ ] **Step 5: Commit**

```bash
git add src/components/AdminTab.tsx src/App.tsx src/components/MenuSidebar.tsx src/backend.ts src/admin.ts tests/admin.test.ts
git commit -m "feat: add admin demonstration workbench"
```

### Task 5: 完善市民端狀態顯示及文件術語

**Files:**
- Modify: `src/components/PersonalTab.tsx`
- Modify: `ADMIN_SYSTEM_PLAN.md`
- Modify: `UPDATE_SPEC.md`
- Test: `tests/report.test.ts`

- [ ] **Step 1: Write the failing test for all citizen-facing statuses**

```ts
test('all internal statuses have citizen-facing labels', () => {
  for (const status of ['pending', 'reviewing', 'noticed', 'scheduled', 'resolved', 'dismissed'] as const) {
    assert.notEqual(getCitizenStatusLabel(status), undefined);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --test-name-pattern="all internal statuses"`

Expected: FAIL until every status is mapped.

- [ ] **Step 3: Implement wording and documents**

`PersonalTab` must display `reviewing/noticed/scheduled` as `處理中`, `resolved` as `已清理`, and `dismissed` as `不成立`.

Update `ADMIN_SYSTEM_PLAN.md` to:

- rename the AI section and all output fields from duration inference to risk assessment;
- use `riskScore`/`riskLevel` in the trial schema;
- state that the AI trial is not part of the real solution yet;
- change route language from `最優清理路線` to `示範優化路線`;
- document the practical route metrics and limitations.

Add a dated changelog entry to `UPDATE_SPEC.md` stating that Phase 1 is being implemented, while real AI and patrol routing remain pending evaluation.

- [ ] **Step 4: Run tests and documentation checks**

Run: `npm test && git diff --check -- src/components/PersonalTab.tsx ADMIN_SYSTEM_PLAN.md UPDATE_SPEC.md`

Expected: all tests pass and no whitespace errors are reported.

- [ ] **Step 5: Commit**

```bash
git add src/components/PersonalTab.tsx ADMIN_SYSTEM_PLAN.md UPDATE_SPEC.md tests/report.test.ts
git commit -m "docs: frame bike abandonment as risk assessment"
```

### Task 6: 進行隔離 AI試運行，不接入正式方案

**Files:**
- Create: `AI_TRIAL_PROMPT.md`
- Create: `scripts/run-ai-risk-trial.ts` only if a safe trial input and API key are available.
- Create: `AI_TRIAL_RESULT.md` only after an actual trial has run.

- [ ] **Step 1: Prepare the trial contract**

Use one supplied or clearly marked demonstration image. The prompt must request `isBicycle`, `riskScore`, `riskLevel`, `confidence`, six visual indicators, reasons and a human-review recommendation. It must explicitly prohibit exact parking-duration claims.

- [ ] **Step 2: Run one isolated trial**

Run only if `VITE_GEMINI_API_KEY` is available without printing it. Do not import `@google/genai` into the app and do not write the result to Firestore. If the key or image is unavailable, record the trial as blocked and run the manual rubric fallback instead.

- [ ] **Step 3: Review the output against five criteria**

Check bicycle detection, visual reason quality, risk-level plausibility, confidence honesty and human-review wording. Mark the result as exploratory, not as evidence of model accuracy.

- [ ] **Step 4: Keep the result outside production flow**

Do not create `src/ai.ts`, do not add `aiAnalysis` to live reports, and do not let the result affect admin status or route ordering until the user explicitly approves a second implementation phase.

### Task 7: Final verification and handoff

**Files:**
- Verify all Phase 1 files and the final working-tree diff.

- [ ] **Step 1: Run the full local verification**

Run: `npm test && npm run lint && npm run build`

- [ ] **Step 2: Inspect the diff and requirements**

Run: `git diff --stat`, `git diff --check`, and `git status --short --untracked-files=all`.

Confirm that no unrelated ESP32, `.agents/`, NFC archive or credential files were staged.

- [ ] **Step 3: Report evidence and limitations**

Report the exact verification results, changed files, preserved files, AI trial outcome, and the patrol-routing conclusion. Do not claim cross-device Firebase administration or real government security unless it was actually tested and authorized by the current rules.

