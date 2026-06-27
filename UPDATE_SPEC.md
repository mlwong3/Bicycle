# 單車管理 — 更新記錄、實作規劃與待辦工作

> 本文件記錄專案的更新歷程、後續實作規劃與尚待完成的工作。
> 專案：mlwong3/Bicycle ・ Firebase：bicycle-ee76c ・ 最後更新：2026-06-27

---

## 一、更新記錄（Changelog）

### 2026-06-27

| # | 項目 | 內容 | 狀態 |
|---|------|------|------|
| 0 | 工程文件 | 分析整個專案結構，產生 `ENGINEERING.md`（架構、技術棧、各模組說明） | ✅ 完成 |
| 1 | 修復 GitHub Pages 空白畫面 | 診斷出 `main.tsx 404`：Pages 直接放原始碼而非編譯產物。`vite.config.ts` 加 `base: './'`、新增 `.github/workflows/deploy.yml` 自動 build+部署 | ✅ 完成（待刪 static.yml） |
| 2 | 減碳計算改用官方係數 | 新增 `src/carbon.ts`（無鉛汽油 2.360 kg/L × 市區油耗 8 L/100km ≈ 0.19 kg/km）。`App.tsx` 累計實際騎乘距離並持久化；`PersonalTab` 改以「距離 × 官方係數」顯示，附出處與保守估計註腳。取代原捏造公式 | ✅ 完成 |
| 3 | 加入真實 Web NFC | 新增 `src/nfc.ts`（`NDEFReader` 讀寫）。`NfcTab` 提交時嘗試真 NFC 寫入，不支援即退回模擬，並標示本次為實體寫入或模擬。順手修正成功彈窗 `py-32` 過大按鈕 bug | ✅ 完成 |
| 4 | 載入運輸署單車開放數據 | 新增 `src/opendata.ts` 存取 CSDI ArcGIS FeatureServer（`outSR=4326`+`f=geojson`）。決定採線上 API（非本地 GML/FGDB）。`MapTab` 以 `L.geoJSON` 疊加官方單車徑（綠線） | ✅ 完成 |
| 5 | 地圖改用真實泊位、移除假資料 | `MapTab` 將原本 24 個捏造泊位換成運輸署開放數據泊位作為主要標記；資訊卡改顯示「登記車位數、擁有者、實際距離」等真實屬性；依 bbox 在 `moveend` 載入，API 失敗退回種子資料 | ✅ 完成 |
| 6 | Firebase Hosting 部署設定 | 新增 `firebase.json`、`.firebaserc`、`.github/workflows/firebase-deploy.yml`（專案 `bicycle-ee76c`）、`DEPLOY_FIREBASE.md` 指引。選定 Firebase Hosting + GitHub Actions 自動部署 | ✅ 設定完成（待最終驗證） |
| 7 | 輕量 Firebase 後端及程式碼改進 | 採用 Firebase Authentication 匿名登入 + Firestore 作輕量後端，新增 `src/firebase.ts`、`src/backend.ts`、`.env.example`、Firestore 規則；保留 localStorage fallback。完成開放數據快取 / 節流、安全 storage 版本化、App 內通知取代 `alert()`、README / metadata / title 更新 | ✅ 完成（待部署驗證） |
| 8 | 更新下一輪程式碼改進規劃 | 清理第五章已完成項目，改為聚焦 NFC 私隱、Firebase 實測、MapTab 拆分、資料一致性、i18n、依賴清理及部署驗證 | ✅ 完成 |
| 9 | Firebase 連線現況釐清 + 5.2 好處 | 實測確認部署版未注入金鑰、未真正連 Firestore（退回 localStorage）；`firebase-deploy.yml` 加入 `VITE_FIREBASE_*` env 注入；5.2 補上「連上 Firebase 的好處」與操作步驟 | ✅ 完成 |
| 10 | MapTab 拆分（第一階段） | 抽出 `ParkingInfoCard`、`NavigationPanel` 兩個展示元件，MapTab 縮短約 130 行；`useLeafletMap` / `useCyclingData` / `MapControls` 留待下一輪 | ✅ 完成 |
| 11 | 示範收藏路線 | 個人中心「收藏路線」改名「示範收藏路線」，明確標示為示範數據 | ✅ 完成 |
| 12 | 只保留繁體中文 | 移除個人中心語言切換 UI 與英文選項、App 的 `language` 狀態與英文標題分支，全站固定繁體中文 | ✅ 完成 |

> 以上程式碼變更已於本機通過 `tsc` 型別檢查與 `vite build`（於無 `#` 字元的乾淨路徑），並完成本機 git commit。

---

## 二、待完成工作（To-Do）

### A. 下一階段優先工作：NFC 實物展示
- [ ] **製作 NFC 貼紙 + 展示卡**：以比賽展示為目標，先製作 3-5 套可穩定示範的 NFC 標籤與展示卡。
- [ ] **建立 NFC 登記表**：記錄 `tagId`、`bikeId`、`frameNo`、車款、寫入日期、測試狀態及備註。
- [ ] **完成 Android Chrome 真 NFC 測試**：以 HTTPS 網址測試實體寫入及讀取流程。
- [ ] **準備 iPhone / 桌面 fallback**：以 QR Code 或 App 內模擬流程展示，避免現場因裝置不支援 Web NFC 而中斷。

### B. 部署相關（優先）
- [ ] **將最新 commit 推上 GitHub `main`**（含開放數據泊位、減碳、NFC、Firebase 設定）。推送後 Firebase 會自動重新部署。
- [ ] **刪除 `.github/workflows/static.yml`**：它把原始碼根目錄當網站上傳，導致 GitHub Pages 一直空白（`main.tsx 404`）。刪掉後 Pages 才會用 `deploy.yml` 的編譯產物。
- [ ] **確認 Firebase 部署成功**：Actions 的 `Deploy to Firebase Hosting` 綠勾，網址 `https://bicycle-ee76c.web.app`。
- [ ] （選用）設定「自動更新 GitHub」：需一組 GitHub 細粒度權杖（fine-grained PAT，限 Bicycle repo、Contents 讀寫）以便由工具直接 `git push`。

### C. 功能完善
- [ ] **NFC 私隱改善**：NFC 標籤只寫入 `tagId`、`bikeId`、`frameNo`、App URL，不寫入真實學生姓名或個人資料。
- [ ] **NFC 錯誤狀態改善**：區分「真 NFC 成功」、「裝置不支援」及「寫入失敗」，不把所有失敗都顯示成模擬成功。
- [ ] **地圖模組拆分**：`MapTab.tsx` 體積過大，待拆成地圖初始化、開放數據載入、控制面板及泊位資訊卡等子模組。
- [x] **地圖資料快取**：為運輸署開放數據加入簡單快取或節流，減少 `moveend` 重複請求。
- [x] **localStorage 版本化與容錯**：讀寫加入 `try/catch`、key 加版本，並把重設功能改為只清除本 App 的 key。
- [x] **移除 `alert()`**：改用 App 內 toast / modal，提升比賽展示時的專業感。
- [ ] **「收藏路線」仍寫死為 12**（`PersonalTab.tsx`），未與真實狀態連動，待改為真實數據或移除。
- [ ] **i18n 未完成**：語言狀態 `zh/en` 已存在，但切換 en 後大部分文案仍為中文，待補文案字典。
- [ ] 單車徑（CYCTRACK）與斜道（CYCRAMP）目前只疊加單車徑；可評估是否加入斜道圖層。
- [ ] 開放數據在縮放 < 13 時不載入（效能保護），可評估加入「載入此區域」按鈕。

### D. 清理與文件
- [ ] **移除未使用相依**：`@google/genai`、`@vis.gl/react-google-maps`、`@types/google.maps`、`express`、`dotenv`（AI Studio 樣板殘留，見 `ENGINEERING.md`）。
- [x] **更新樣板文字**：`index.html` 的 `<title>` 仍為「My Google AI Studio App」；`README.md` 仍提 Gemini；`metadata.json` 宣告未實作的 Gemini 能力。
- [ ] **處理 GitHub 與本機分支分歧**：以最新版內容為準，補回 `UPDATE_SPEC.md` 到遠端，確保規格文件可在 GitHub 查閱。
- [ ] 上傳文件檔（`ENGINEERING.md`、`UPDATE_SPEC.md`、`DEPLOY_FIREBASE.md`）作為比賽開發紀錄（非必要，但加分）。

---

## 三、技術參考（實作重點與出處）

### 減碳計算
- 出處：香港《溫室氣體排放量計算工具》(2024, C02/24)，無鉛汽油 = 2.360 kg CO₂/公升。
- 公式：`每公里碳排 = (油耗 L/100km ÷ 100) × 2.360`；以 8 L/100km 計 ≈ 0.19 kg/km。
- 誠實註腳：僅計 CO₂（未含 CH₄/N₂O，偏保守）；油耗為假設值，正式版宜引用來源或讓使用者選車型。

### Web NFC
- API：`NDEFReader`（`write` / `scan`+`onreading`）。
- 限制：僅 Android Chrome 89+、需 HTTPS、需使用者手勢；iOS/桌面不支援 → 退回模擬。

### 開放數據（運輸署單車資訊）
- 資料集：https://data.gov.hk/tc-data/dataset/hk-td-tis_20-cycling-information
- 端點：`https://portal.csdi.gov.hk/server/rest/services/common/td_rcd_1629267205229_68005/FeatureServer`
- 圖層：0 = CYCPARKSPACE（泊位）、1 = CYCRAMP（斜道）、2 = CYCTRACK（單車徑）。
- 查詢：`/{layer}/query?where=1=1&outFields=*&outSR=4326&f=geojson`（可加 envelope 做 bbox 過濾）。
- 已驗證：回傳 WGS84 GeoJSON、允許瀏覽器 CORS。本地 `Data/` 內 GML/KMZ/FGDB 僅作離線備援，不上傳。

### 部署
- GitHub Pages：`deploy.yml`，Source 需設「GitHub Actions」，並刪除衝突的 `static.yml`。
- Firebase Hosting：`firebase.json`（public=`dist`）+ `firebase-deploy.yml`（`FirebaseExtended/action-hosting-deploy`，secret `FIREBASE_SERVICE_ACCOUNT`，projectId `bicycle-ee76c`）。兩者為獨立目標，可同時上線。

---

## 四、NFC 卡片製作規劃

### 4.1 目標與定位

- **目標**：以比賽展示為優先，先完成少量可穩定示範的 NFC 實物。
- **形式**：採用「NFC 貼紙 + 展示卡」組合。
- **展示重點**：讓評審清楚看到「單車實物標籤」、「手機 NFC 寫入 / 讀取」、「App 登記資料」三者之間的關係。
- **私隱原則**：NFC 標籤只存最少識別資料，不寫入真實學生姓名、電話或其他個人資料。

### 4.2 物料清單

| 物料 | 建議規格 | 用途 | 備註 |
|------|----------|------|------|
| NFC 貼紙 | NTAG213 或 NTAG215、13.56MHz、NDEF | 貼在單車模型、車架或展示板上 | 先購買 10-20 張，方便測試及備用 |
| 展示卡 | A6、名片大小膠卡或過膠紙卡 | 印上作品名稱、車架編號、QR Code 及使用提示 | 與 NFC 貼紙配成一套展示件 |
| QR Code | 指向 App 網址或示範登記頁 | 作為 iPhone / 桌面 fallback | 避免現場裝置不支援 Web NFC |
| 防金屬 NFC 標籤 | anti-metal NFC tag | 若要直接貼在真單車金屬車架 | 成本較高，作進階測試用途 |
| 登記表 | Google Sheet 或 Excel | 記錄標籤編號、測試狀態及備註 | 方便比賽展示及管理 |

### 4.3 NFC 資料設計

NFC 標籤建議只寫入以下最少資料：

```json
{
  "tagId": "QJ-NFC-001",
  "bikeId": "bike-demo-001",
  "frameNo": "HK-QJ-0001",
  "appUrl": "https://bicycle-ee76c.web.app"
}
```

不應寫入：

- 真實學生姓名
- 電話號碼
- 身份證明資料
- 住址或精確個人位置
- 任何不需要公開讀取的個人資料

如需在 App 內顯示車主，可由 App 本地資料或後端資料庫以 `bikeId` 對應，不應直接依賴 NFC 內的個人資料。

### 4.4 展示卡版面建議

| 位置 | 內容 |
|------|------|
| 正面標題 | 騎跡 Bike Trace |
| 正面主視覺 | NFC 圖示、單車圖示、作品主色 |
| 正面資料 | 車架編號、NFC 標籤編號、感應提示 |
| 正面提示 | 「請以 Android Chrome 靠近 NFC 貼紙」 |
| 背面說明 | Web NFC 技術、私隱設計、QR fallback |
| 背面 QR Code | App 網址或示範頁 |

建議展示文字：

> 此 NFC 標籤只儲存單車識別編號，不儲存個人敏感資料。Android Chrome 可使用 Web NFC 讀寫；iPhone 或桌面裝置可使用 QR Code 或模擬模式展示。

### 4.5 寫卡流程

1. 使用 NFC Tools 或同類工具先清空 / 格式化 NFC 貼紙為 NDEF。
2. 在登記表建立標籤資料，例如 `QJ-NFC-001`。
3. 使用 Android 手機開啟 HTTPS 版 App。
4. 進入 NFC 登記頁，輸入示範車款、車架編號及示範車主。
5. 將手機靠近 NFC 貼紙，完成 Web NFC 寫入。
6. 寫入後立即用 App 或 NFC Tools 讀取，確認資料正確。
7. 在登記表更新測試狀態：`未寫入`、`已寫入`、`已讀取驗證`、`需重寫`。
8. 將 NFC 貼紙貼到單車模型、真單車指定位置或展示板，並與展示卡配對。

### 4.6 現場展示流程

| 步驟 | 展示內容 | 成功準則 |
|------|----------|----------|
| 1 | 展示 NFC 貼紙及展示卡 | 評審可理解卡片與單車的對應關係 |
| 2 | Android Chrome 靠近 NFC 貼紙 | App 能顯示真 NFC 寫入 / 讀取流程 |
| 3 | App 顯示單車登記資料 | 車架編號與展示卡一致 |
| 4 | 個人中心顯示 NFC 已綁定 | 能看到已登記單車及防盜狀態 |
| 5 | iPhone / 桌面 fallback | 可用 QR Code 或模擬流程繼續展示 |

---

## 五、程式碼改進規劃

> 本章只保留尚未完成或需要下一輪實作的工作。已完成項目（開放數據快取 / 節流、localStorage 版本化與容錯、移除 `alert()`、README / metadata / title 更新、Firebase 輕量後端骨架）已移至 Changelog 記錄，不再列入本章待實作內容。

### 5.1 NFC 私隱與真實標籤驗證

**目標**：把 NFC 從「可展示寫入」提升為「較安全、可驗證的標籤登記流程」。

- 修改 `src/nfc.ts`，真 NFC 寫入內容只保留 `tagId`、`bikeId`、`frameNo`、`appUrl`。
- `ownerName` 只保留在 App / Firestore 顯示資料，不寫入 NFC 標籤。
- 新增「讀取 NFC 標籤」流程，掃描後用 `tagId` 查回對應單車。
- 成功彈窗要清楚分辨：
  - 真 NFC 寫入成功
  - 真 NFC 讀取成功
  - 裝置不支援 Web NFC
  - 寫入 / 讀取失敗
  - 模擬流程完成
- 為比賽展示準備 3-5 個固定測試 tag，例如 `QJ-NFC-001` 至 `QJ-NFC-005`。

**驗收標準**：

- NFC payload 不含真實姓名或個人敏感資料。
- Android Chrome + HTTPS 可寫入及讀取至少 1 張測試貼紙。
- iPhone / 桌面仍可使用 QR 或模擬流程完成展示。

### 5.2 Firebase 實測、權限與部署環境

**現況（2026-06-27 實測）**：Firebase **連線程式碼已就緒，但部署版尚未真正連上 server**。
`firebase` 套件已安裝、`src/firebase.ts` 的匿名登入 + Firestore 邏輯已寫好；但
`firebase-deploy.yml` 未注入 `VITE_FIREBASE_*` 金鑰、亦無 `.env.local`，故
`isFirebaseConfigured` 為 `false` → `getFirebaseServices()` 回 `null` → 自動退回
localStorage。換言之「引擎已裝好但未插鑰匙」，現在資料只存在使用者本機瀏覽器。

> 補充：Firebase 是 Google 的雲端 serverless 後端（Auth + Firestore 皆在 Google 伺服器），
> 不需自架伺服器；「連上 server」指的是把前端金鑰接上、讓 App 與 Firestore 實際通訊。

**真正連上 Firebase 後的好處（為何值得做）**：

- **跨裝置 / 跨瀏覽器同步**：資料存雲端，換手機、換電腦、清快取後仍在；不再像
  localStorage 只綁單一瀏覽器。對比賽展示尤其重要——評審用自己的裝置掃 NFC / 開網址，
  也能看到同一筆登記資料。
- **多人協作與即時性**：多位同學或評審同時操作時看到一致資料；Firestore 可即時更新。
- **資料可信度與持久性**：舉報、單車、行程紀錄不會因清瀏覽器資料而消失，作品更像真實系統。
- **權限控管（資安加分）**：透過 `firestore.rules` 限制「只能讀寫自己建立的資料」，
  可向評審展示真實的後端安全設計，而非純前端假資料。
- **展示「真‧前後端架構」**：從「純前端 + 假資料」升級為「前端 + 雲端資料庫 + 匿名身分」，
  是 STEM 評審重視的工程完整度。
- **可擴充校內試用**：日後可加 `role`（`student` / `teacher` / `admin`）做分級管理。

**要做的事（讓它真正連上）**：

1. Firebase Console → 啟用 **Anonymous Authentication**。
2. 啟用 **Cloud Firestore**，並部署 `firestore.rules`。
3. 取得網頁應用程式設定（apiKey、authDomain、appId 等），於 GitHub 加入 Secrets：
   `VITE_FIREBASE_API_KEY`、`VITE_FIREBASE_AUTH_DOMAIN`、`VITE_FIREBASE_PROJECT_ID`、
   `VITE_FIREBASE_STORAGE_BUCKET`、`VITE_FIREBASE_MESSAGING_SENDER_ID`、`VITE_FIREBASE_APP_ID`。
   （`firebase-deploy.yml` 的 build 步驟已加入這些 `env:` 注入，設好 Secret 即生效。）
4. 本機開發則於 `.env.local` 填同樣變數（範本見 `.env.example`）。
5. 實測 `bikes` / `nfcTags` / `reports` / `trips` 是否成功寫入 Firestore。
6. 檢查規則是否只容許使用者讀寫自己建立的資料。

**驗收標準**：

- Firebase Hosting 網址可正常開啟 App。
- 登記單車後 Firestore 出現對應 `bikes` / `nfcTags` 文件。
- 提交舉報後 Firestore 出現對應 `reports` 文件。
- 完成導航後 Firestore 出現對應 `trips` 文件。
- 未設定金鑰時，App 仍能以 localStorage 正常展示（優雅降級）。

### 5.3 MapTab 拆分與地圖體驗

**目標**：降低 `MapTab.tsx` 複雜度，方便學生理解及後續維護。

建議拆分為：

- `useLeafletMap`：地圖初始化、底圖切換、縮放控制。
- `useCyclingData`：運輸署泊位及單車徑資料載入。
- `MapControls`：搜尋列、CSDI key、圖層選單。
- `ParkingInfoCard`：下方泊位資訊卡。
- `NavigationPanel`：導航進度、距離及完成邏輯。

同時改善：

- API 失敗、低縮放比例、無資料區域的提示文字。
- 加入「載入此區域」按鈕，讓使用者主動載入大量資料。
- 評估加入 CYCRAMP 單車斜道 / 隧道 / 橋圖層。

**進度（2026-06-27）**：
- ✅ 已抽出 `src/components/map/ParkingInfoCard.tsx`（泊位資訊卡）。
- ✅ 已抽出 `src/components/map/NavigationPanel.tsx`（導航面板）。動畫包裝 (`motion.div` + `key`)
  留在 MapTab，子元件只負責內容，`tsc` 與 build 已通過、行為不變。
- ⏳ 待續：`useLeafletMap`（地圖初始化 / 底圖 / WMS）、`useCyclingData`（開放數據載入）、
  `MapControls`（搜尋列 / CSDI key / 圖層選單）尚未抽出，留待下一輪（屬較高風險重構）。

**驗收標準**：

- `MapTab.tsx` 明顯縮短，主要只負責組合子模組。（目前已縮短約 130 行，持續進行中）
- 地圖原有功能保持不變。
- `npm run lint` 及 build 通過。

### 5.4 資料一致性與展示可信度

**目標**：移除或標示仍屬示範性質的假資料，令比賽展示更可信。

- 「收藏路線 12」改為真實資料，或改名為「示範收藏路線」。
- 個人中心的 NFC 感應金鑰由固定 `NFC-SEC-AA8281` 改為實際 `nfcTagId`。
- ReportTab 的示範照片、GPS 位置及回收站資料需標示為「示範資料」或接入真實資料來源。
- 檢查減碳距離是否會因重複按導航完成而過度累加；必要時加入行程紀錄列表或去重機制。

**驗收標準**：

- UI 不會把示範資料誤表達為即時真實資料。
- NFC 編號、車架編號及個人中心顯示一致。

### 5.5 語言、套件清理與效能

**目標**：提升作品完整度、減少不必要體積，並避免中英文不一致。

- 二選一處理 i18n：
  - 完成全站中英文字典；或
  - 暫時移除英文切換，只保留繁體中文。
- 移除未使用依賴：
  - `@google/genai`
  - `@vis.gl/react-google-maps`
  - `@types/google.maps`
  - `express`
  - `@types/express`
  - `dotenv`
- 進一步 code splitting，降低 build 的大型 chunk 警告。
- 補充最少量自動測試或 smoke test 文件，方便比賽前快速檢查。

**驗收標準**：

- `package.json` 只保留實際使用的依賴。
- 切換語言不會出現中英混雜，或不再提供未完成的英文切換。
- build 警告減少，主要頁面仍可正常載入。

---

## 六、後續實作優次建議

| 優次 | 工作 | 原因 | 驗收標準 |
|------|------|------|----------|
| P0 | 製作 3-5 套 NFC 貼紙 + 展示卡 | 直接影響比賽現場展示 | Android Chrome 可成功寫入及讀取；iPhone / 桌面有 fallback |
| P0 | NFC 私隱與讀取驗證 | 避免把個人資料寫入可公開讀取的 NFC 標籤 | NFC payload 不含真實姓名；可用 tagId 查回單車 |
| P0 | Firebase 部署實測 | 確認輕量後端可真正同步資料 | Firebase Hosting 上可寫入 bikes / nfcTags / reports / trips |
| P1 | MapTab 拆分 | 降低維護成本，方便學生理解 | 地圖功能拆成 hooks / 子元件，行為維持不變 |
| P1 | 示範資料一致性 | 提升比賽可信度 | 固定假數據被移除、接入真實狀態或標示為示範 |
| P2 | i18n 決策 | 避免展示時文案不一致 | 完成中英字典，或只保留繁體中文 |
| P2 | 清理未使用依賴及 bundle | 減少安裝和打包體積 | package 依賴精簡，build 大型 chunk 警告減少 |
| P3 | 補充測試及展示檢查表 | 比賽前降低出錯風險 | 有可跟從的 smoke test 步驟 |

---

*更新本文件時，請於「更新記錄」新增日期條目，並同步勾選/移動「待完成工作」項目。*
