# 騎跡 Bike Trace — 工程文件

> 香港智能單車管理與綠色出行展示應用。支援運輸署開放數據地圖、NFC 登記、違規舉報、單車回收資訊、個人中心、減碳數據，以及 Firebase 輕量後端同步。
>
> 文件版本：2.0 ・ 對應 App 版本：0.0.0 ・ 更新日期：2026-06-27

---

## 1. 專案概述

| 項目 | 說明 |
|------|------|
| 應用名稱 | 騎跡 Bike Trace |
| 應用類型 | React + Vite 單頁 Web App |
| 主要用途 | 比賽展示及校內試用原型：展示智能單車管理、NFC 登記、防盜概念、單車泊位及減碳數據 |
| 目標平台 | 行動裝置優先，同時支援桌面版響應式佈局 |
| 介面語言 | 主要為繁體中文；保留 `zh/en` 語言狀態，但英文文案未全面完成 |
| 資料來源 | 本機種子資料、運輸署開放數據、localStorage、Firebase Firestore |
| 後端狀態 | 已加入輕量 Firebase 後端；Firebase 未設定時自動退回本機 localStorage |
| 部署 | Firebase Hosting + GitHub Actions；亦保留 GitHub Pages workflow |

### 核心功能

1. **地圖導航**：用 Leaflet 顯示單車泊位、單車徑、官方 CSDI / WMS 圖層及模擬導航。
2. **開放數據**：透過運輸署 CSDI ArcGIS REST API 載入單車泊位及單車徑。
3. **違規舉報**：提交違規或損壞單車報告，資料保存於本機並可同步至 Firestore。
4. **NFC 登記**：支援 Android Chrome Web NFC；不支援裝置使用 QR / 模擬流程。
5. **個人中心**：管理已登記單車、收藏泊位、舉報紀錄、積分及減碳數據。
6. **輕量後端**：用 Firebase Anonymous Auth + Firestore 同步 `bikes`、`nfcTags`、`reports`、`trips`。

---

## 2. 技術棧

| 分類 | 技術 | 用途 |
|------|------|------|
| 前端框架 | React 19 | UI 與狀態管理 |
| 語言 | TypeScript | 型別檢查及資料模型 |
| 建構工具 | Vite 6 | 開發伺服器及 production build |
| 樣式 | Tailwind CSS 4 | 介面排版及視覺樣式 |
| 動畫 | motion | 頁面轉場、彈窗及抽屜動畫 |
| 圖示 | lucide-react | UI 圖示 |
| 地圖 | Leaflet | 互動地圖、標記、路線及 GeoJSON 圖層 |
| 後端 | Firebase Auth / Firestore | 匿名登入及雲端資料同步 |
| 部署 | Firebase Hosting | 靜態網站部署 |

### 仍可清理的相依套件

以下依賴仍在 `package.json`，但目前程式未實際使用，後續可移除以縮小安裝體積：

- `@google/genai`
- `@vis.gl/react-google-maps`
- `@types/google.maps`
- `express`
- `@types/express`
- `dotenv`

---

## 3. 目錄結構

```text
Code/
├── index.html                    # HTML 入口，標題為「騎跡 Bike Trace」
├── package.json                  # npm scripts 及相依套件
├── vite.config.ts                # Vite、React、Tailwind 設定
├── firebase.json                 # Firebase Hosting + Firestore 設定
├── firestore.rules               # Firestore 安全規則
├── firestore.indexes.json        # Firestore 索引設定
├── .env.example                  # Firebase / CSDI 環境變數範本
├── README.md                     # 專案執行及 Firebase 設定說明
├── UPDATE_SPEC.md                # 更新記錄、規劃及待辦
├── DEPLOY_FIREBASE.md            # Firebase 部署指引
└── src/
    ├── main.tsx                  # React 入口
    ├── App.tsx                   # 全站狀態中樞、頁面切換、通知、Firebase 同步觸發
    ├── types.ts                  # Bike / Report / ParkingSpot 等資料型別
    ├── data.ts                   # 種子資料及引導頁資料
    ├── storage.ts                # 版本化 localStorage 工具及舊 key 遷移
    ├── firebase.ts               # Firebase 動態載入及匿名登入
    ├── backend.ts                # Firestore 同步服務
    ├── opendata.ts               # 運輸署開放數據 API + 快取
    ├── carbon.ts                 # 減碳計算及距離公式
    ├── nfc.ts                    # Web NFC 讀寫工具
    └── components/
        ├── Onboarding.tsx
        ├── MapTab.tsx
        ├── ReportTab.tsx
        ├── NfcTab.tsx
        ├── PersonalTab.tsx
        ├── MenuSidebar.tsx
        └── SettingsModal.tsx
```

---

## 4. 系統架構

### 4.1 整體架構

此專案是「前端為主、Firebase 作輕量後端」的架構。簡單理解：

- React App 負責畫面、按鈕、表單、地圖及互動。
- localStorage 是「本機備份」，即使 Firebase 未設定也能展示。
- Firebase 是「雲端同步」，用來保存單車、NFC 標籤、舉報及行程。
- 運輸署 CSDI API 是「政府開放數據來源」，提供單車泊位及單車徑。

```text
使用者手機 / 電腦
        |
        v
React App (App.tsx)
        |
        +--> localStorage fallback
        |
        +--> Firebase Auth 匿名登入
        |       |
        |       v
        |   Firestore collections
        |   - bikes
        |   - nfcTags
        |   - reports
        |   - trips
        |
        +--> 運輸署 CSDI ArcGIS REST API
        |
        +--> Leaflet 地圖圖磚 / WMS 圖層
```

### 4.2 資料流

| 使用者動作 | 前端即時處理 | 本機保存 | Firebase 同步 |
|------------|--------------|----------|---------------|
| 完成引導頁 | 更新 `hasCompletedOnboarding` | `storage.ts` | 不同步 |
| 登記單車 | 新增 `Bike`、加 50 積分 | `bikes`、`userScore` | `bikes`、`nfcTags` |
| 提交舉報 | 新增 `Report`、加 50 積分 | `reports`、`userScore` | `reports` |
| 完成導航 | 累加騎乘距離 | `totalDistanceKm` | `trips` |
| 收藏泊位 | 更新泊位 ID 清單 | `savedParkingIds` | 暫不同步 |
| 重設資料 | 還原預設資料 | 只清除此 App 的 key | 不刪雲端資料 |

### 4.3 App.tsx 的角色

`App.tsx` 是整個 App 的「總控制室」：

- 管理主要狀態：單車、舉報、收藏泊位、積分、騎乘距離、目前頁面、語言。
- 使用 `storage.ts` 讀寫版本化 localStorage。
- 提供 callback 給不同頁面，例如 `handleAddBike`、`handleAddReport`、`handleTripComplete`。
- 在新增資料後呼叫 `backend.ts`，嘗試同步到 Firebase。
- 顯示 App 內通知，取代原本的 `alert()`。

---

## 5. 資料模型

### 5.1 TypeScript 主要型別

```ts
interface Bike {
  id: string;
  model: string;
  frameNo: string;
  ownerName: string;
  nfcBound: boolean;
  nfcTagId?: string;
}

interface Report {
  id: string;
  imageUrl?: string;
  location: string;
  description: string;
  status: 'pending' | 'resolved';
  date: string;
}

interface ParkingSpot {
  id: string;
  name: string;
  distance: string;
  availableSlots: number;
  totalSlots: number;
  type: string;
  lat: number;
  lng: number;
}
```

### 5.2 Firestore collections

| Collection | 用途 | 主要欄位 |
|------------|------|----------|
| `bikes` | 已登記單車 | `bikeId`, `frameNo`, `model`, `ownerUid`, `ownerDisplayName`, `nfcTagId`, `nfcBound` |
| `nfcTags` | NFC 標籤對應 | `tagId`, `bikeId`, `frameNo`, `ownerUid`, `status`, `writtenAt` |
| `reports` | 違規 / 損壞舉報 | `id`, `location`, `description`, `imageUrl`, `status`, `createdBy` |
| `trips` | 騎乘及減碳紀錄 | `tripId`, `uid`, `distanceKm`, `carbonSavedKg`, `createdAt` |

### 5.3 localStorage keys

新版本 key 集中於 `src/storage.ts`，格式為：

```text
hk_bike:v2:<name>
```

例子：

- `hk_bike:v2:registered_list`
- `hk_bike:v2:reports_history`
- `hk_bike:v2:saved_parking_spots`
- `hk_bike:v2:total_distance_km`
- `hk_bike:v2:csdi_api_key`

`storage.ts` 亦會讀取舊 key，例如 `hk_bike_registered_list`，讀到後會遷移到新版 key。

---

## 6. Firebase 輕量後端

### 6.1 初始化方式

Firebase 設定位於 `.env.local`，範本見 `.env.example`：

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=bicycle-ee76c.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=bicycle-ee76c
VITE_FIREBASE_STORAGE_BUCKET=bicycle-ee76c.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

`src/firebase.ts` 會檢查必要設定是否齊全：

- 若設定齊全：動態載入 Firebase SDK，並用 Anonymous Auth 登入。
- 若設定不足：回傳 `null`，App 繼續使用 localStorage。

### 6.2 為何使用動態載入

Firebase SDK 體積較大。程式使用 `import('firebase/...')` 動態載入，只有真正同步資料時才下載 Firebase 模組，避免拖慢初始畫面。

### 6.3 安全規則

`firestore.rules` 不開放所有人讀寫。基本原則是：

- 使用者必須已登入。
- 單車和 NFC 標籤只能由 `ownerUid` 相同的使用者讀寫。
- 舉報只能由 `createdBy` 相同的使用者讀寫。
- 行程只能由 `uid` 相同的使用者讀寫。

這是展示原型可接受的基本安全設定；正式校內部署仍應加入教師 / 管理員角色。

---

## 7. 主要模組說明

### 7.1 MapTab.tsx：地圖與開放數據

功能：

- 建立 Leaflet 地圖。
- 切換底圖：CartoDB、OpenStreetMap、CSDI 標準地圖、衛星圖。
- 支援 CSDI API Key 輸入及儲存。
- 用運輸署 FeatureServer 載入：
  - `CYCPARKSPACE` 單車泊位
  - `CYCTRACK` 單車徑
- 用 `L.geoJSON` 顯示單車徑綠線。
- 用自訂 Leaflet marker 顯示泊位。
- 模擬導航，完成後把距離傳回 `App.tsx` 計算減碳。

資料效能：

- `opendata.ts` 對 API 結果做 2 分鐘快取。
- 地圖 `moveend` 後延遲 350ms 才重新載入，避免拖動地圖時大量重複請求。
- 縮放小於 13 時不載入大量單車徑資料。

### 7.2 NfcTab.tsx：NFC 登記

功能：

- 三步流程：掃描標籤、輸入資料、寫入 / 上傳數據。
- 支援 Web NFC 寫入，主要適用 Android Chrome + HTTPS。
- 不支援 Web NFC 時，使用模擬流程展示。
- 產生示範標籤編號，例如 `QJ-NFC-123456`。
- 成功後新增單車到本機狀態，並嘗試同步 `bikes` 及 `nfcTags` 到 Firestore。

注意：

- 現時 `nfc.ts` 的真實寫入仍包含 `ownerName`，但 `UPDATE_SPEC.md` 已列明下一步應改為只寫入 `tagId`、`bikeId`、`frameNo`、`appUrl`。
- 正式展示應避免把真實學生姓名寫入 NFC 標籤。

### 7.3 ReportTab.tsx：違規舉報與回收

功能：

- 上傳 / 模擬照片。
- 模擬 GPS 定位。
- 提交舉報後新增 `Report`。
- 同步到 Firestore `reports` collection。
- 顯示回收站及環保合作夥伴。
- 所有提示改用 App 內通知，不再使用 `alert()`。

### 7.4 PersonalTab.tsx：個人中心

功能：

- 顯示使用者頭像、等級、綠色積分。
- 顯示已登記單車。
- 顯示收藏泊位、舉報紀錄、減碳數據。
- 減碳計算來自 `carbon.ts`：

```text
減碳量 = 騎乘距離 x 每公里汽車碳排
```

目前使用香港《溫室氣體排放量計算工具》無鉛汽油 2.360 kg CO2 / 公升，再以市區油耗 8 L / 100km 估算。

### 7.5 storage.ts：本機資料保護

功能：

- 所有 localStorage 讀寫都包 `try/catch`。
- 儲存 key 有版本號。
- 支援舊 key 遷移。
- `clearAppStorage()` 只刪除本 App 的 key，不再使用 `localStorage.clear()`。

### 7.6 backend.ts：雲端同步服務

功能：

- `syncBikeRegistration()`：同步單車及 NFC 標籤。
- `syncReport()`：同步舉報紀錄。
- `syncTrip()`：同步騎乘距離及減碳量。

設計原則：

- 所有同步都是「嘗試式」。
- Firebase 未設定或同步失敗時，不阻止前端展示流程。
- App 仍以本機狀態即時更新，提升展示穩定性。

---

## 8. 建構、執行與部署

### 8.1 本機執行

```bash
npm install
npm run dev
```

開發伺服器預設：

```text
http://localhost:3000
```

### 8.2 型別檢查

```bash
npm run lint
```

此指令實際執行：

```bash
tsc --noEmit
```

### 8.3 打包

```bash
npm run build
```

注意：目前專案所在 iCloud 路徑含 `#` 字元，Vite 在該路徑直接 build 可能解析失敗。已驗證在無 `#` 的臨時路徑可成功 build。

### 8.4 Firebase Hosting

`firebase.json` 設定：

- `hosting.public = dist`
- SPA rewrite 到 `/index.html`
- Firestore rules / indexes 亦列於同一設定檔

部署前需：

1. 啟用 Firebase Authentication Anonymous sign-in。
2. 啟用 Cloud Firestore。
3. 設定 GitHub secret `FIREBASE_SERVICE_ACCOUNT`。
4. 如需雲端同步，在 Firebase Hosting 環境或 GitHub Actions 內提供 Vite Firebase 環境變數。

---

## 9. 現時已改善項目

| 項目 | 狀態 |
|------|------|
| 後端 | 已加入 Firebase Auth + Firestore 輕量同步 |
| 本機儲存 | 已改為版本化 key、try/catch、舊 key 遷移 |
| 重設資料 | 已改為只清除此 App 的 key |
| 地圖資料 | 已加入 API 快取及 moveend 節流 |
| UI 提示 | 已以 App 內 toast / notice 取代 `alert()` |
| 文件 | README、metadata、index title 已更新為騎跡 |
| Build | 無 `#` 路徑下已通過 production build |

---

## 10. 已知問題與技術債

| 優先 | 位置 | 問題 |
|------|------|------|
| P0 | `nfc.ts` / `NfcTab.tsx` | NFC 真實寫入仍包含 `ownerName`，下一步應改為只寫入最少識別資料 |
| P1 | Firebase 設定 | 需要在 Firebase Console 啟用 Anonymous Auth、Firestore，並填入 Vite 環境變數 |
| P1 | `PersonalTab.tsx` | 「收藏路線」仍寫死為 12，未與真實資料連動 |
| P1 | i18n | 保留英文切換狀態，但全站英文文案未完成 |
| P2 | `MapTab.tsx` | 單一檔案仍偏大，建議拆成 hooks 及子元件 |
| P2 | bundle size | build 仍有大型 chunk 警告，可進一步 code splitting |
| P2 | dependencies | 仍有未使用套件，可清理 package |
| P3 | 權限 | Firestore 目前只分使用者本人資料，未設教師 / 管理員角色 |

---

## 11. 給學生的簡化理解

可以把整個系統想像成一間單車服務中心：

- **React 畫面**：服務中心的櫃檯，負責讓使用者按按鈕、填表、看地圖。
- **App.tsx**：櫃檯主任，負責分配資料給不同頁面。
- **MapTab**：地圖職員，負責查找泊位和單車徑。
- **NfcTab**：登記職員，負責把單車和 NFC 標籤配對。
- **ReportTab**：舉報職員，負責接收違規單車報告。
- **PersonalTab**：個人檔案櫃，顯示我的單車、積分和減碳紀錄。
- **localStorage**：放在自己手機內的小記事簿。
- **Firebase**：雲端資料櫃，讓資料不只留在同一部手機。
- **Firestore rules**：資料櫃的鎖，防止其他人隨便讀寫你的資料。
- **運輸署開放數據**：政府提供的地圖資料，例如單車泊位和單車徑。

---

*本文件已按 2026-06-27 最新程式碼更新。後續如完成 NFC 私隱改造、MapTab 拆分或 Firebase 角色權限，請同步維護。*
