# Task 1 實作報告：建立工作單、聯合行動及團隊型別

## 1. 任務範圍

本次只處理以下三個程式／測試檔案：

- `src/types.ts`
- `src/workOrders.ts`
- `tests/workOrders.test.ts`

沒有修改 ESP32、`.agents`、NFC archive 或 skills lock 相關內容。

## 2. TDD 紀錄

### RED

先建立 `tests/workOrders.test.ts`，再執行：

```bash
node --import tsx --test tests/workOrders.test.ts
```

結果：失敗。測試正確顯示找不到尚未建立的 `src/workOrders` 模組，符合預期的 RED 階段。

### GREEN

加入型別及最小工作單規則實作後，執行同一項聚焦測試，結果為：

- 2 tests passed
- 0 tests failed

## 3. 完成內容

### `src/types.ts`

新增：

- `DepartmentCode`
- `WorkOrderTaskType`
- `WorkOrderStatus`
- `EvidenceChecklistItem`
- `WorkOrderHistoryEntry`
- `WorkOrder`
- `Team`
- `JointOperation`

工作單保留部門、地區、能力、設備、前置工作單及證據清單欄位；個案 `ReportStatus` 及工作單 `WorkOrderStatus` 維持分離。

### `src/workOrders.ts`

新增：

- `canTransitionWorkOrder()`：按明確狀態圖限制狀態轉換。
- `isWorkOrderReady()`：檢查 `executableAfter` 及所有前置工作單是否完成。
- `applyWorkOrderTransition()`：限制未完成證據清單的完成操作，要求 blocked／declined 原因，並追加稽核歷史。

### `tests/workOrders.test.ts`

新增兩項測試：

1. 前置工作單未全部完成時，下游工作單不可執行。
2. 證據未完成時不可完成工作單；證據齊備後完成並記錄稽核項目。

## 4. 驗證結果

執行：

```bash
node --import tsx --test tests/workOrders.test.ts
npm test
npm run lint
git diff --check
```

結果：

- 聚焦測試：2/2 通過。
- 全套測試：32/32 通過。
- TypeScript lint：`tsc --noEmit` 通過，0 errors。
- 差異格式檢查：通過。

## 5. 待確認事項及限制

- 本任務只建立領域型別及工作單規則；尚未接駁 UI、資料庫、Firebase 或正式政府系統。
- 部門權限、地點、能力及設備欄位已納入型別，但團隊配對及授權檢查不在本任務的最小實作範圍內。
- 測試目前集中覆蓋前置條件、證據門檻及稽核記錄；狀態轉換矩陣可在後續任務加入更完整的逐項測試。

## 6. 提交資料

提交 subject：`feat: add work order domain model`

提交 SHA：`51a7ec56b218d42dd9a9b425d36437cac2fb5ded`

---

## 7. Review 修正（2026-07-15）

### 修正內容

- `scheduled → in_progress` 現在必須傳入完整工作單清單及當前時間；只有已指派團隊、所有前置工作單均為 `completed`，以及 `executableAfter` 為有效且已到達的日期時，才可轉為 `in_progress`。
- `isWorkOrderReady()` 對無效的 `executableAfter`、無效的 `now`、未指派團隊及未完成前置工作單，一律回傳 `false`；缺少 `executableAfter` 仍屬有效。
- 非 `blocked` 狀態轉換會移除既有 `blockerReason` 屬性，而不再序列化為 `blockerReason: undefined`。
- 未新增能力、授權或設備評分／配對邏輯；該等篩選維持為 Task 3 的範圍。

### 新增測試覆蓋

`tests/workOrders.test.ts` 新增或更新以下驗證：

1. 無效 `executableAfter` 時 readiness 為 `false`。
2. 未指派團隊時，工作單不可由 `scheduled` 轉為 `in_progress`。
3. 前置工作單尚未完成時，工作單不可轉為 `in_progress`。
4. `executableAfter` 尚未到達或無效時，工作單不可轉為 `in_progress`。

### TDD 證據

先加入測試並執行聚焦測試，已記錄以下 RED 結果：

- 無效 `executableAfter`：現有實作錯誤地回傳 `true`，測試以 `true !== false` 失敗。
- 未指派團隊的開始執行：現有實作錯誤地轉為 `in_progress`，測試以 `in_progress !== scheduled` 失敗。

完成最小修正後，聚焦測試為 7/7 通過。

### 最終驗證

執行：

```bash
node --import tsx --test tests/workOrders.test.ts
npm test
npm run lint
git diff --check
```

結果：

- 聚焦測試：7/7 通過。
- 全套測試：37/37 通過。
- TypeScript lint：`tsc --noEmit` 通過，0 errors。
- 差異格式檢查：通過。

## 8. 最終 Review 修正：嚴格驗證 `executableAfter`（2026-07-15）

### RED

先加入回歸測試：已指派且狀態為 `scheduled` 的工作單，如
`executableAfter = 2026-02-30T09:30:00.000Z`，即使當前時間已在 JavaScript
正規化後的日期之後，也不得轉為 `in_progress`。

執行：

```bash
node --import tsx --test tests/workOrders.test.ts
```

結果：8 項測試中 7 項通過、1 項失敗；新測試顯示現有 `Date.parse` 邏輯錯誤地把工作單轉為 `in_progress`。

### GREEN

加入最小嚴格驗證：`executableAfter` 如有提供，必須符合
`YYYY-MM-DDTHH:mm:ss.sssZ`，並且 `new Date(raw).toISOString() === raw`；缺少
`executableAfter` 仍屬有效。日曆無效、格式錯誤或非 canonical 的值一律 fail closed。

再次執行聚焦測試，結果為 8/8 通過。

### 最終驗證

- `npm test`：38/38 通過。
- `npm run lint`：`tsc --noEmit` 通過，0 errors。
- `git diff --check`：通過。
- 變更只限於 Task 1 工作單驗證及其回歸測試；沒有修改 Task 3 範圍。
