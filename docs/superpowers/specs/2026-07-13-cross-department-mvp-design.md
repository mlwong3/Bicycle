# 跨部門單車舉報、巡查及個案管理 MVP 設計

> 依據：`/Users/Kelvinwml/Downloads/bike-trace-cross-department-case-management-mvp-plan.md`
>
> 設計狀態：已確認・本機／示範模式 MVP

## 1. 目標及範圍

本輪把騎跡由「管理員示範工作台」推進為「跨部門單車舉報、巡查及個案管理原型」。展示閉環為：

```text
市民舉報 → 管理員接收 → AI 文字／欄位分類建議
→ 人工六項相片 rubric → 程序確認
→ 巡查次序建議 → 管理員確認 → 現場完成處理
→ 市民端顯示「已完成處理」
```

本輪採用本機／示範模式 MVP。保留既有市民端、Firebase 輕量同步及 localStorage fallback；真正的管理員 custom claim、Firestore／Storage Rules 收緊及後端 AI 代理列為後續接入工作。

系統固定定位為「跨部門單車舉報、巡查及個案管理原型」，不宣稱正式政府執法系統。所有期限、程序、部門及路線結果均須標示為原型設定或模擬估算。

## 2. 資料模型及邊界

保留現有 `Report` 型別及 adapter，避免直接破壞市民舉報、Firebase 同步及 localStorage fallback。市民端只可取得公開資料：

```ts
type PublicReport = {
  id: string;
  reporterUid?: string;
  publicStatus: 'pending' | 'processing' | 'resolved' | 'dismissed';
  publicMessage?: string;
  locationLabel: string;
  imagePreviewPath?: string;
};
```

新增明確的管理員資料界線，保存分類、人工觀察及程序資料。實作初期由 adapter 從現有 `Report` 轉換，毋須立即遷移所有 Firestore collection：

```ts
type CaseType =
  | 'obstruction' | 'illegal_parking' | 'suspected_abandoned'
  | 'damaged_bicycle' | 'safety_hazard' | 'duplicate'
  | 'insufficient_information' | 'other';

type Urgency = 'emergency' | 'urgent' | 'normal';

type AdminReport = {
  id: string;
  description: string;
  exactLocation?: { lat: number; lng: number };
  locationSource: 'gps' | 'manual' | 'unknown';
  status: ReportStatus;
  caseType?: CaseType;
  urgency?: Urgency;
  aiClassification?: AiCaseClassification;
  manualRubric?: ManualRubricRecord;
  procedureConfigSnapshot?: ProcedureConfig;
  deadlineAt?: string;
  procedureConfirmed: boolean;
  coordinatesValid: boolean;
  isDuplicate: boolean;
  assignedDepartment?: string;
  patrolRouteId?: string;
  resolvedAt?: string;
  resolvedBy?: string;
};
```

狀態固定為：

```ts
type ReportStatus =
  | 'pending' | 'reviewing' | 'classified' | 'field_review_required'
  | 'notice_issued' | 'deadline_expired' | 'clearance_approved'
  | 'scheduled' | 'in_progress' | 'resolved' | 'needs_information'
  | 'duplicate' | 'dismissed';
```

`clearance_approved` 是加入巡查建議的必要閘門。案件必須具有效座標、已完成程序確認、非重複及非不成立，才可成為巡查候選。

每次狀態、分類、rubric 或程序變更都新增事件，不直接覆寫審計資料：

```ts
type ReportEvent = {
  action: 'status_changed' | 'classification_updated' | 'rubric_completed'
    | 'procedure_confirmed' | 'route_assigned' | 'case_resolved';
  fromStatus?: ReportStatus;
  toStatus?: ReportStatus;
  actorUid: string;
  actorRole: 'admin' | 'field-staff' | 'system';
  note?: string;
  createdAt: string;
};
```

## 3. 人工 rubric 及程序設定

管理員逐項記錄鏽蝕、輪胎、積塵、附著物、零件缺失及車鎖狀態。每項支援 `0–3` 分、`null`（不可觀察）及備註：

```ts
type RubricObservation = {
  score: 0 | 1 | 2 | 3 | null;
  observable: boolean;
  note?: string;
};

type ManualRubric = {
  rust: RubricObservation;
  tire: RubricObservation;
  dust: RubricObservation;
  attachment: RubricObservation;
  missing: RubricObservation;
  lock: RubricObservation;
};

type ManualRubricRecord = ManualRubric & {
  completedBy: string;
  completedAt: string;
};
```

不可觀察不會轉換為 0 分。系統只計算資料完整度、可觀察項目數及摘要，不輸出停泊時長、棄置概率或直接清理建議。

程序設定包括名稱、通知期限、負責部門、完成條件及每站服務時間；選用後複製至案件快照，期限由快照計算，不依賴固定 14 日常數。

介面固定顯示：

> 示範期限及程序由本原型設定，實際期限、法律依據及跨部門安排須由相關部門按個案確認。

## 4. AI 文字／欄位分類

AI 只接收案件描述、選取標籤、地點名稱、是否有座標及人工 rubric 摘要；不接收圖片二進制資料，也不分析相片內容。

```ts
type AiCaseClassification = {
  caseType: CaseType;
  urgency: Urgency;
  obstructionLevel: 0 | 1 | 2 | 3;
  suggestedDepartment: string | null;
  missingInformation: string[];
  possibleDuplicateReportIds: string[];
  priorityBand: 'low' | 'medium' | 'high';
  rationale: string[];
  confidence: 'low' | 'medium' | 'high';
  source: 'ai-text-classification' | 'rule-fallback';
};
```

AI 結果只作建議，管理員可以接受、修改或拒絕；AI 不可直接改變狀態、批准清理或結案。無後端代理或 API 失敗時，顯示「AI 暫時不可用」，由管理員手動分類，巡查模組改用規則式欄位。

本輪不把 API 金鑰放入前端 `VITE_` 環境變數，不新增前端直接呼叫外部 AI 的實作；先建立可測試的分類介面及 fallback。

## 5. 巡查次序建議

候選必須符合：

```ts
report.status === 'clearance_approved'
  && report.coordinatesValid
  && report.procedureConfirmed
  && !report.isDuplicate;
```

優先度為可解釋的模擬計算：

```text
35% × 安全／阻塞程度
+ 25% × 等待時間
+ 20% × 人工 rubric 可見狀況
+ 10% × 重複舉報或同區聚集度
+ 10% × AI 分類信心及資料完整度
```

AI 不可用時，最後一項改為資料完整度；rubric 大部分不可觀察時，降低人工觀察權重並標示資料不足。

管理員輸入出發點、巡查日期、任務模式、最多案件數及每站服務時間。系統取最高 5–8 宗候選案件，使用最近鄰居法建立初始次序，再以 2-opt 改善直線距離。相同輸入必須得到相同初始排序。

| 模式 | 用途 | 限制 |
|---|---|---|
| `inspection-walking` | 步行現場巡查 | 不代表搬運能力 |
| `inspection-driving` | 一般駕駛巡查 | 使用道路路線，不使用單車徑作車輛導航 |
| `clearance-vehicle` | 清理車輛示範 | 只顯示次序，不代表實際派工、泊車或載量可行 |

路線 API 失敗時顯示直線估算並標示「非道路實際路線」。管理員確認前，案件不會自動變為 `scheduled`。

路線卡片固定顯示：

> 本結果為小規模示範性巡查次序建議，使用目前案件座標及設定計算；不代表實際最短路線、正式派工或法律程序結果。估算時間不包括現場處理、泊車、搬運及跨部門協調時間。

## 6. 介面及同步

市民端保留拍照、定位、描述及提交流程；GPS 不可用時保存位置來源；只顯示待審核、處理中、已完成處理或不成立，不顯示 AI 理由、管理員備註、內部 rubric 或其他案件精確資料。

管理員端保留示範模式入口並顯示 `Prototype Simulation`；案件列表可按狀態、分類、緊急程度及部門篩選；詳情包括相片、位置、描述、分類建議、人工 rubric、程序設定、狀態時間線及事件；支援一鍵重設示範資料。

管理員確認完成後，由 adapter 更新內部及公開資料；市民端重新讀取或訂閱自己的案件後顯示「已完成處理」。公開狀態不能反向改寫內部狀態。

## 7. 權限、私隱及驗證

- 示範登入只作介面狀態，不作真正權限來源；正式接入 Firebase Auth custom claim。
- 正式資料應分層為 `publicReports`、`adminReports`、事件及 `patrolRoutes`；本輪先以 adapter 保持相容。
- 圖片優先使用 Firebase Storage；上傳失敗不可顯示虛假的成功提交。
- AI Secret 不可出現在前端 bundle 或瀏覽器程式碼。
- 示範圖片不得含可識別路人、車牌或私人資料；示範資料標示為 `Prototype Simulation` 並可一鍵重設。

至少覆蓋以下測試：非法狀態跳轉、公開狀態映射、`null` rubric 不當作 0 分、程序快照期限、巡查候選篩選、固定排序、2-opt 距離不增加、AI fallback 不改狀態及結案後市民端取得 `resolved`。

建置若受 iCloud 路徑中的 `#` 令 Vite 停滯，使用不含特殊字元的暫存副本驗證，並分開記錄限制。

## 8. 非本輪工作

- 真正 Firebase Auth 管理員 claim、多重驗證及正式帳戶清單；
- Firestore／Storage Rules 正式收緊及 Rules emulator 測試；
- Cloud Functions 或同等後端 AI 代理；
- AI 相片分析、相片相似度及自動棄置判定；
- 多車隊 VRP、車輛容量、泊車及跨部門正式派工；
- 自動人臉／車牌模糊化；
- 以模擬資料宣稱政府效率或固定成本節省。
