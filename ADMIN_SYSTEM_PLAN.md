# 騎跡跨部門單車舉報、巡查及個案管理原型

> 規劃文件・專案：mlwong3/Bicycle（騎跡 Bike Trace）・建立日期：2026-07-13
> 目標：在現有市民舉報功能上，建立跨部門案件分類、人工觀察、程序確認、巡查次序及市民端狀態同步的示範原型。
> 新方案（已確認）：本期移除 AI 相片分析；AI 只處理舉報文字及結構化欄位，人工 rubric 作為相片狀況主要依據。

---

## 一、目標與定位

- **系統定位**：本系統是跨部門案件管理原型，不宣稱正式政府執法、法定通知或正式派工系統。
- **角色分工**：市民端負責拍照、定位、描述及提交；管理員負責分類、人工觀察、程序確認、巡查次序及結案；AI 只提供文字分類建議。
- **展示重點**：市民舉報 → AI 整理文字／欄位 → 人工 rubric → 程序確認 → 巡查次序建議 → 管理員確認 → 市民端顯示已完成處理。
- **誠實原則**：所有 AI、期限及路線均標示為建議或示範估算；示範資料固定標示 `Prototype Simulation`。

## 二、現況與可重用模組

| 現有模組 | 重用方式 |
|---|---|
| `types.ts` 的 `Report`（imageUrl/location/description/status/date） | 擴充欄位（見第五節），不破壞現有市民端 |
| `backend.ts` 的同步及讀取 adapter | 保留現有 `reports` 相容性，轉換為公開 `PublicReport` 及內部 `AdminReport` |
| `mapbox.ts`（Directions + 反向地理編碼） | 巡邏路線逐段導航繪製 |
| `trackRouting.ts`（官方單車徑 Dijkstra） | 只作單車流動或地圖參考；清理車輛不可沿單車徑導航 |
| `geolocation.ts` | 管理員出發點定位 |
| `predict.ts` 的可解釋模型風格 | AI fallback 沿用「可解釋規則 + 標示方法」的做法 |
| MapTab 的 Leaflet 地圖 | 巡邏路線視覺化直接疊加 |

## 三、管理員系統功能

### 3.1 登入（示範密碼）

- 入口：MenuSidebar 加「管理員模式」項（或設定頁長按 logo 3 秒隱藏入口，展示時更有戲劇性）。
- 驗證：輸入示範密碼（如 `admin2026`，存於環境變數 `VITE_ADMIN_DEMO_PASSWORD`，有 fallback 預設值）；通過後 `sessionStorage` 標記 admin session，UI 切換至管理員視圖。
- Firestore：`admins/{uid}` 記錄登入的匿名 uid + 登入時間，供 audit 展示；Firestore 規則限制只有標記過的 uid 可寫 `reports` 的處理欄位。
- 誠實標示：登入頁註明「示範用途，正式系統應採用政府帳戶 + 多重驗證」。

### 3.2 案件工作台（Dashboard）

- **案件列表**：按狀態、分類、緊急程度及部門篩選，顯示相片縮圖、地點及舉報時間。
- **案件詳情**：大圖 + 地圖定位 + 舉報描述 + AI 文字分類建議 + 人工六項 rubric + 程序設定 + 狀態時間線。
- **統計卡**：本週新增舉報、待處理數、平均處理時間、已完成處理數量（配合比賽展示數據故事）。

### 3.3 案件狀態機

```text
pending → reviewing → classified → field_review_required
         → notice_issued → deadline_expired → clearance_approved
         → scheduled → in_progress → resolved
```

`reviewing`、`classified` 及現場覆核階段可分支至 `needs_information`、`duplicate` 或 `dismissed`。`clearance_approved` 是加入巡查建議的必要閘門；不得直接由未確認案件跳至 `scheduled`。

市民端只顯示「待審核／處理中／已完成處理／不成立」，管理員端顯示完整內部狀態。每次變更均寫入不可任意刪除的事件記錄，包括時間、操作者、原因及備註。

## 四、AI 文字／欄位分類設計

### 4.1 目的

AI 只根據案件描述、選取標籤、地點名稱、座標狀態及人工 rubric 摘要，建議案件分類、緊急程度、負責部門、缺少資料、優先度級別、理由及信心度。AI 不接收相片，不判斷單車是否棄置，不宣告違法，不批准清理及不結案。

### 4.2 人工六項相片 rubric

管理員逐項觀察鏽蝕、輪胎、積塵、附著物、零件缺失及車鎖狀態，每項 0–3 分；相片看不到時使用 `null`，不得當作 0 分。分數只代表相片可見狀況訊號，不等同棄置概率或停泊時長。

| 指標 | 觀察點 | 與風險的關係 |
|---|---|---|
| 鏽蝕 rust | 鏈條、車架焊接位、手把、輪圈 | 明顯鏽蝕增加「需現場覆核」的優先度 |
| 輪胎 tire | 洩氣、完全扁塌、胎膠龜裂 | 與其他訊號同時出現時提高風險 |
| 積塵污垢 dust | 車座、車架塵埃層、水漬痕 | 只作視覺線索，不作時間判定 |
| 附著物 attachment | 蜘蛛網、落葉堆積、植物纏繞、貼滿街招 | 可作為長期未處理的輔助線索 |
| 零件缺失 missing | 車座、車輪、鏈條被拆走 | 可能反映損毀或失竊，須人員覆核 |
| 車鎖狀態 lock | 鎖生鏽、鎖已被剪斷仍無人取車 | 可提高風險，但不可據此認定棄置 |

### 4.3 AI fallback 及安全界線

無後端代理、無網絡或回覆格式錯誤時，顯示「AI 暫時不可用」，保留案件原資料，由管理員手動分類；巡查模組改用規則式欄位。AI 結果只保存為建議，管理員可接受、修改或拒絕。

本期不把 AI API 金鑰放入前端 `VITE_` 環境變數，也不新增前端直接呼叫外部 AI。後續如接入供應商，必須經 Cloud Functions 或同等後端代理及 schema 驗證。

### 4.4 升級路徑（文件記錄，非本期實作）

- 自訓模型：收集標註相片，以 Teachable Machine / TensorFlow.js MobileNet 遷移學習做瀏覽器端分類，比賽可講述「數據收集 → 訓練 → 部署」故事。
- 同地點重複舉報交叉驗證：同一位置多次舉報可作為現場覆核參考；首次舉報日期不能等同真實停泊時長。

## 五、資料模型變更（Firestore）

```ts
type PublicReport = {
  id: string;
  reporterUid?: string;
  publicStatus: 'pending' | 'processing' | 'resolved' | 'dismissed';
  publicMessage?: string;
  locationLabel: string;
  imagePreviewPath?: string;
};

type AdminReport = {
  id: string;
  description: string;
  exactLocation?: { lat: number; lng: number };
  locationSource: 'gps' | 'manual' | 'unknown';
  status: ReportStatus;
  caseType: CaseType;
  urgency: Urgency;
  aiClassification?: AiCaseClassification;
  manualRubric?: ManualRubricRecord;
  procedureConfigSnapshot?: ProcedureConfig;
  deadlineAt?: string;
  procedureConfirmed: boolean;
  coordinatesValid: boolean;
  isDuplicate: boolean;
  patrolRouteId?: string;
};
```

- 正式架構建議分層為 `publicReports/{id}`、`adminReports/{id}`、`adminReports/{id}/events/{eventId}` 及 `patrolRoutes/{id}`；本期先由 `caseAdapter.ts` 保持現有 `reports` collection 相容。
- 真正管理員 claim、Firestore／Storage Rules 收緊及後端 AI 代理不在本期實作。
- 相片優先使用 Firebase Storage；上傳失敗時不得顯示虛假的成功提交。

## 六、AI 巡邏路線規劃

### 6.1 問題定義

管理員選定日期後，系統從已完成程序確認、且具有效座標的案件生成一條**示範優化巡邏路線**。它是小規模 TSP 近似解，不能宣稱為實際最短或正式派工結果。

### 6.2 演算法（自建、可解釋，沿用 trackRouting.ts 風格）

1. **優先級評分**：`35%×安全／阻塞 + 25%×等待時間 + 20%×人工 rubric + 10%×同區聚集 + 10%×資料完整度／AI 信心`。AI 不可用時改用資料完整度；案件多於單日容量時，取 5–8 宗作示範。
2. **距離矩陣**:直線（Haversine）距離近似，避免 N² 次 API 呼叫。
3. **TSP 近似解**：最近鄰居法（nearest neighbor）建初始路線 → 2-opt 迭代改善（N≤15 毫秒級完成）。
4. **路線模式**：步行巡查可使用步行路線；一般駕駛及清理車輛使用道路路線，不使用官方單車徑作車輛導航；沒有地圖 API 時退回直線估算並標示限制。
5. **輸出**：案件順序、每站摘要、優先度、估算距離、估算時間範圍、路線來源及管理員確認按鈕。估算不包括現場處理、泊車、搬運及跨部門協調。

### 6.3 展示話術

「系統先把已確認、具座標的案件按可解釋規則排序，再以近似演算法比較巡邏次序；結果是示範性路線建議，供人員覆核後使用。」可展示「建議次序」相對「按舉報順序」的估算距離差異，但須標示為估算。

## 七、實作階段

### Phase 1 工作分配及統籌儀表板（已交付原型）

- 一宗案件可拆分為多張具前置條件、權責部門、地區、職能、設備及證據要求的工作單。
- 示範資料涵蓋五個部門（HAD、TD、LandsD、FEHD、HKPF）及十個示範團隊。
- 提供三個可配置程序模板：即時危險、街道棄置物及公共單車泊車處聯合行動；公共泊車處流程包含六張有順序依賴的工作單。
- 以規則輔助團隊推薦及分數／理由展示，分配、接收、排期、開始、受阻、退回、重新分配及完成均須由人員確認並保留審計記錄。
- 統籌儀表板提供六張概況卡、優先工作清單、部門工作量、聯合行動準備度及今日可執行工作；所有區塊共用同一組篩選結果。
- 巡邏路線只使用指定部門、日期及工作群組內已排期且結構準備完成、具有效案件座標的工作單；確認路線只更新工作單，不自動更改案件狀態。
- 所有上述資料及流程均為 Phase 1 原型示範資料，不代表真實政府案件、正式政府績效或正式派工結果。
- 本 Phase 1 不包含 AI 自動派工、AI 自動決策、正式政府系統接駁、Firebase 工作單同步或正式道路路線服務。

### Phase 1 — 基礎（管理員端跑通）
- [x] `types.ts` / `backend.ts`：Report 擴充欄位 + 狀態枚舉 + 讀取全部 reports 的 API
- [x] ReportTab 舉報時寫入 lat/lng；嘗試 Firebase Storage 上傳相片，失敗保留原圖供本機示範
- [x] 管理員登入（示範密碼 + sessionStorage + best-effort `admins` 記錄）
- [x] AdminTab：案件列表、詳情、狀態流轉、statusHistory 時間線

### Phase 2 — 跨部門案件管理 MVP
- [x] AI 文字／欄位分類 deterministic fallback，明確不接收相片
- [x] 人員六項 rubric 檢查表及不可觀察選項
- [x] 可配置程序、案件快照及期限計算
- [x] 公開／管理員 adapter、案件分類及狀態事件

### Phase 3 — 巡查建議
- [x] `src/patrol.ts`：優先級評分 + NN + 2-opt
- [x] AdminTab 逐站清單、距離／時間估算、任務模式及管理員確認
- [ ] `patrolRoutes` 正式持久化及真實道路路線整合

### Phase 4 — 打磨與展示
- [ ] 統計儀表板（處理量、平均時長、清理熱點）
- [x] 市民端狀態同步顯示（舉報紀錄見到「待審核／處理中／已完成處理／不成立」）
- [ ] `firestore.rules` 收緊 + 示範資料標示檢查
- [ ] 完整 demo 腳本：手機舉報 → 電腦管理員收到 → AI 文字分類建議 → 人工確認 → 生成路線 → 結案 → 手機見到已完成處理

## 八、風險與注意事項

| 風險 | 對策 |
|---|---|
| AI 分類錯誤或資料不足 | AI 只作文字／欄位建議，顯示信心度及缺少資料，管理員可修正 |
| AI Secret 暴露於前端 | 本期不接外部 AI；日後必須使用 Cloud Functions 或同等後端代理 |
| 相片含路人／車牌等私隱 | 舉報頁提示避免拍攝途人；規劃註明正式系統應自動模糊人臉（列入升級路徑） |
| 現場展示無網絡／API 故障 | 規則式分類、人工 rubric 及直線路線 fallback 可完成示範；預先入好 5–8 宗模擬案件 |
| 展示資料狀態混亂 | AdminTab 加「重設示範案件」按鈕，一鍵回復展示初始狀態 |
| 與現實流程差異被評審質疑 | 使用「原型／模擬資料／示範設定」說明，不把期限、部門及路線結果宣稱為正式程序 |
