# 管理員系統規劃 — 政府人員違規單車處理 + AI 分析

> 規劃文件・專案：mlwong3/Bicycle（騎跡 Bike Trace）・建立日期：2026-07-13
> 目標：加入「管理員系統」，模擬政府人員收到市民舉報相片後，如何審核、分析及清理違規停泊單車。
> 三大決策（已確認）：AI 先作一次獨立試運行再決定是否納入方案、管理員採「示範密碼登入」、路線採「多點清理巡邏路線」。

---

## 一、目標與定位

- **模擬對象**：香港現實中違泊單車由運輸署、食環署、地政總署等跨部門處理，流程為「巡查發現／接獲舉報 → 貼上勸諭告示 → 限期（一般約兩星期）後仍未移走 → 充公清理」。本系統以此流程為藍本做簡化模擬。
- **角色分工**：市民端（現有 ReportTab）負責影相舉報；管理員端（新增 AdminTab）負責接收、覆核、排程清理、結案；AI 僅作獨立試運行。
- **展示重點**：讓評審看到完整閉環——市民舉報 → 管理員收到 → 人員覆核及疑似棄置風險評估 → 產生示範巡邏路線 → 結案後市民端狀態同步更新。
- **誠實原則**（沿用專案風格）：AI 估算屬推測性質，介面必須標示信心度與「僅供參考，最終由人員判斷」；模擬模式須明確標示「示範資料」。

## 二、現況與可重用模組

| 現有模組 | 重用方式 |
|---|---|
| `types.ts` 的 `Report`（imageUrl/location/description/status/date） | 擴充欄位（見第五節），不破壞現有市民端 |
| `backend.ts` 的 `syncReport()` + Firestore `reports` collection | 管理員端直接讀同一 collection，加狀態寫回 |
| `mapbox.ts`（Directions + 反向地理編碼） | 巡邏路線逐段導航繪製 |
| `trackRouting.ts`（官方單車徑 Dijkstra） | 相鄰兩個清理點之間可沿單車徑規劃（優先）|
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

- **案件列表**：讀取 `reports`，按狀態分欄（待審核 / 已分析 / 已排程 / 已結案 / 不成立），顯示相片縮圖、地點、舉報時間、AI 破舊評分徽章。
- **案件詳情**：大圖 + 地圖定位 + 舉報描述 + AI 分析結果卡 + 狀態操作按鈕。
- **統計卡**：本週新增舉報、待處理數、平均處理時間、已清理數量（配合比賽展示數據故事）。

### 3.3 案件狀態機

```
pending（市民已舉報）
  → reviewing（管理員已接收，等待人員覆核）
  → noticed（已貼勸諭告示，記錄 noticeDate，模擬 14 日限期倒數）
  → scheduled（已納入清理路線）
  → resolved（已清理結案）
  → dismissed（不成立／重複舉報）
```

- 現有 `Report.status` 只有 `pending | resolved`，擴充為上述枚舉；市民端顯示映射（noticed/scheduled 統一顯示「處理中」），避免改動市民端 UI 太多。
- 每次狀態變更寫入 `statusHistory[]`（時間、操作者、備註），詳情頁顯示時間線。

## 四、AI 分析設計（獨立試運行，尚未納入真實處理流程）

### 4.1 目的

由相片辨認可見的破舊、附著物與零件缺失等訊號，輸出「疑似棄置風險評估」，協助人員決定是否優先現場覆核。此評估**不推斷停泊時長，亦不可單獨作出清理或充公決定**。

### 4.2 破舊程度視覺指標（rubric）

AI 與 fallback 共用同一套可解釋指標，每項 0–3 分：

| 指標 | 觀察點 | 與風險的關係 |
|---|---|---|
| 鏽蝕 rust | 鏈條、車架焊接位、手把、輪圈 | 明顯鏽蝕增加「需現場覆核」的優先度 |
| 輪胎 tire | 洩氣、完全扁塌、胎膠龜裂 | 與其他訊號同時出現時提高風險 |
| 積塵污垢 dust | 車座、車架塵埃層、水漬痕 | 只作視覺線索，不作時間判定 |
| 附著物 attachment | 蜘蛛網、落葉堆積、植物纏繞、貼滿街招 | 可作為長期未處理的輔助線索 |
| 零件缺失 missing | 車座、車輪、鏈條被拆走 | 可能反映損毀或失竊，須人員覆核 |
| 車鎖狀態 lock | 鎖生鏽、鎖已被剪斷仍無人取車 | 可提高風險，但不可據此認定棄置 |

### 4.3 疑似棄置風險評估

總分（加權和，0–100）映射為四級，只反映相片中的視覺風險訊號：

| 風險評分 | 風險級別 | 建議行動 |
|---|---|---|
| 0–24 | 低 | 按一般程序處理；如有阻塞或安全問題再巡查 |
| 25–49 | 中 | 建議安排現場覆核及記錄 |
| 50–74 | 高 | 優先覆核；確認後才按程序貼告示或排程 |
| 75–100 | 很高 | 優先安排人員現場判斷，不能直接清理或充公 |

每級附 `confidence`（high/medium/low）：例如相片模糊、只影到局部，信心度降級並提示管理員補充現場照。

### 4.4 真 AI 獨立試運行（Gemini Vision）

- 不接入前端、不寫入 Firestore；只以一張獲授權測試相片執行一次並記錄結果，確認可靠性後才決定是否開發 `src/ai.ts`。
- Prompt 要求以 **structured JSON output**（responseSchema）回傳：

```json
{
  "isBicycle": true,
  "indicators": { "rust": 2, "tire": 3, "dust": 2, "attachment": 1, "missing": 0, "lock": 1 },
  "riskScore": 62,
  "riskLevel": "high",
  "confidence": "medium",
  "reasons": ["鏈條與輪圈明顯鏽蝕", "前胎完全扁塌", "車座有塵埃層"],
  "suggestedAction": "優先納入清理路線"
}
```

- `isBicycle=false`（相片不是單車）→ 提示管理員標記為「不成立」，順便展示 AI 能過濾無效舉報。
- 試運行結果只作可行性驗證；如日後採用，正式系統必須經後端（Cloud Functions）代理呼叫，並由人員覆核。

### 4.5 模擬 fallback（無金鑰／離線／API 失敗）

- 沿用 4.2 rubric，但改為**管理員勾選檢查表**：詳情頁列出六項指標各 0–3 分的按鈕組，人員目測相片評分，程式即時計算 riskScore 與風險級別——與 AI 試運行輸出同一格式。
- 好處：零成本、可解釋、展示時就算網絡故障也能完整走流程；且「人員輔助評分」本身就是合理的 human-in-the-loop 設計，不是造假。
- 介面徽章區分來源：`AI 分析（Gemini）` vs `人員評分（規則模型）`。

### 4.6 升級路徑（文件記錄，非本期實作）

- 自訓模型：收集標註相片，以 Teachable Machine / TensorFlow.js MobileNet 遷移學習做瀏覽器端分類，比賽可講述「數據收集 → 訓練 → 部署」故事。
- 同地點重複舉報交叉驗證：同一位置多次舉報同一單車（相片相似度／NFC tagId）可作為現場覆核參考；首次舉報日期最多只反映系統已知的下限，不能等同真實停泊時長。

## 五、資料模型變更（Firestore）

```ts
// types.ts 擴充
export interface Report {
  id: string;
  imageUrl?: string;
  location: string;
  lat?: number; lng?: number;          // 新增：舉報座標（ReportTab GPS 已有來源）
  description: string;
  status: 'pending' | 'reviewing' | 'noticed' | 'scheduled' | 'resolved' | 'dismissed';
  date: string;
  aiAnalysis?: AiAnalysis;             // 新增：4.4 的 JSON + source: 'gemini' | 'manual-rubric'
  noticeDate?: string;                 // 新增：貼告示日期（14 日倒數）
  statusHistory?: { status: string; at: string; by: string; note?: string }[];
  handledBy?: string;                  // 管理員 uid
}
```

- 新 collection：`admins/{uid}`（登入記錄）、`patrolRoutes/{id}`（已生成的巡邏路線：案件 id 順序、總距離、生成時間、完成狀態）。
- `firestore.rules`：`reports` 市民只能建立及讀自己的；處理欄位（status/aiAnalysis/noticeDate…）僅 admins 可寫。示範階段規則可從寬，文件註明正式收緊方案。
- 相片儲存：現時 `imageUrl` 為 base64/本地 URL；若要跨裝置展示（市民手機舉報 → 管理員電腦收到），需啟用 Firebase Storage 上傳，得出下載 URL。此為本計劃前置工作。

## 六、AI 巡邏路線規劃

### 6.1 問題定義

管理員選定日期後，系統從已完成程序確認、且具有效座標的案件生成一條**示範優化巡邏路線**。它是小規模 TSP 近似解，不能宣稱為實際最短或正式派工結果。

### 6.2 演算法（自建、可解釋，沿用 trackRouting.ts 風格）

1. **優先級評分**：`priority = 0.5×riskScore + 0.3×案件等待日數(封頂30) + 0.2×同區聚集度`。沒有 AI 結果時只採用等待日數與聚集度；案件多於單日容量時，取前 N 宗作示範。
2. **距離矩陣**:直線（Haversine）距離近似，避免 N² 次 API 呼叫。
3. **TSP 近似解**：最近鄰居法（nearest neighbor）建初始路線 → 2-opt 迭代改善（N≤15 毫秒級完成）。
4. **真實路線繪製**：確定訪問順序後，相鄰兩點間先試 `trackRouting`（沿官方單車徑）、退 Mapbox Directions、再退直線——完全重用現有三級 fallback，路線來源徽章照舊。
5. **輸出**：地圖疊加編號標記（①②③…）+ 路線線段 + 側欄清單（每站案件摘要、風險評估〔如有〕、預計到達時間）。實際車速、停留時間、道路限制及派工規則須由人員確認。

### 6.3 展示話術

「系統先把已確認、具座標的案件按可解釋規則排序，再以近似演算法比較巡邏次序；結果是示範性路線建議，供人員覆核後使用。」可展示「建議次序」相對「按舉報順序」的估算距離差異，但須標示為估算。

## 七、實作階段

### Phase 1 — 基礎（管理員端跑通）
- [x] `types.ts` / `backend.ts`：Report 擴充欄位 + 狀態枚舉 + 讀取全部 reports 的 API
- [x] ReportTab 舉報時寫入 lat/lng；嘗試 Firebase Storage 上傳相片，失敗保留原圖供本機示範
- [x] 管理員登入（示範密碼 + sessionStorage + best-effort `admins` 記錄）
- [x] AdminTab：案件列表、詳情、狀態流轉、statusHistory 時間線

### Phase 2 — AI 分析
- [ ] 獨立 AI 試運行：完成一次授權相片測試後，才決定是否開發 `src/ai.ts`
- [ ] 人員評分 fallback（rubric 檢查表 UI + 同格式輸出）
- [ ] 詳情頁風險評估卡（指標、風險級別、信心度、來源徽章、誠實註腳）
- [ ] `isBicycle` 無效舉報過濾流程

### Phase 3 — 巡邏路線
- [ ] `src/patrol.ts`：優先級評分 + NN + 2-opt
- [ ] 路線地圖視覺化（重用 MapTab 地圖或 AdminTab 內嵌地圖）+ 逐站清單 + 完成清理操作
- [ ] `patrolRoutes` 持久化 + 距離節省 % 對比

### Phase 4 — 打磨與展示
- [ ] 統計儀表板（處理量、平均時長、清理熱點）
- [x] 市民端狀態同步顯示（舉報紀錄見到「待審核／處理中／已清理／不成立」）
- [ ] `firestore.rules` 收緊 + 示範資料標示檢查
- [ ] 完整 demo 腳本：手機舉報 → 電腦管理員收到 → AI 分析 → 生成路線 → 結案 → 手機見到已清理

## 八、風險與注意事項

| 風險 | 對策 |
|---|---|
| Gemini 金鑰暴露於前端 | 示範用免費金鑰 + 用量上限；文件註明正式方案走 Cloud Functions |
| AI 誤判（如新車被評為高風險） | 僅輸出風險訊號，不推斷停泊時長；人員現場覆核後才可採取任何行動 |
| 相片含路人／車牌等私隱 | 舉報頁提示避免拍攝途人；規劃註明正式系統應自動模糊人臉（列入升級路徑） |
| 現場展示無網絡／API 故障 | fallback rubric 全流程可離線走完；預先入好 5–8 宗示範案件（標明示範資料） |
| 展示資料狀態混亂 | AdminTab 加「重設示範案件」按鈕，一鍵回復展示初始狀態 |
| 與現實流程差異被評審質疑 | 介面用「勸諭告示」「限期移走」等真實術語，主動說明是簡化模擬並引述跨部門實際做法 |
