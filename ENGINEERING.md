# 單車管理（綠色騎士）— 工程文件

> 一站式智能單車管理 Web 應用。支援地圖泊位導航、違規舉報與回收、智能 NFC 登記，以及個人單車與環保數據追蹤。
>
> 文件版本：1.0 ・ 對應 App 版本：1.2.0 ・ 產生日期：2026-06-27

---

## 1. 專案概述

| 項目 | 說明 |
|------|------|
| 應用名稱 | 單車管理（UI 內品牌名「綠色騎士」） |
| 應用類型 | 純前端單頁應用（SPA），無後端伺服器、無遠端 API 呼叫 |
| 目標平台 | 行動裝置優先（Mobile-first），同時支援桌面版響應式佈局 |
| 介面語言 | 繁體中文（內建語言切換 zh / en 狀態，惟目前未做全站文案翻譯） |
| 資料來源 | 全部為本機種子資料（`src/data.ts`）＋ `localStorage` 持久化 |
| 地理範圍 | 香港（種子泊位集中於沙田、大埔、北區、屯門、西貢等地） |
| 來源 | 由 Google AI Studio 生成之原型（App ID 見 README） |

### 核心功能模組
1. **地圖導航**：在 Leaflet 地圖上顯示單車泊位、規劃模擬導航路線、切換政府／開源底圖、疊加官方 OGC WMS 圖層。
2. **違規舉報與回收**：拍照＋GPS 定位提交違規舉報、瀏覽單車回收站與環保合作夥伴。
3. **NFC 登記**：模擬 NFC 感應流程，為單車寫入車架編號與車主資料，完成防盜登記。
4. **個人中心**：管理已登記單車、檢視收藏／舉報／減碳統計、語言／通知／幫助設定。

---

## 2. 技術棧

| 分類 | 技術 | 版本 | 用途 |
|------|------|------|------|
| 框架 | React | ^19.0.1 | UI 框架 |
| 語言 | TypeScript | ~5.8.2 | 型別系統 |
| 建構工具 | Vite | ^6.2.3 | 開發伺服器與打包 |
| 樣式 | Tailwind CSS | ^4.1.14 | 原子化 CSS（透過 `@tailwindcss/vite` 外掛） |
| 動畫 | motion (Framer Motion) | ^12.23.24 | 頁面轉場、彈窗動畫 |
| 圖示 | lucide-react | ^0.546.0 | SVG 圖示庫 |
| 地圖 | Leaflet | ^1.9.4 | 互動式地圖渲染 |

### 已宣告但目前未使用的相依套件
> 以下套件存在於 `package.json`，但原始碼中查無實際引用，屬於 AI Studio 樣板殘留，未來可考慮移除以縮減安裝體積：

- `@google/genai`、`@vis.gl/react-google-maps`、`@types/google.maps` — 地圖實際使用 Leaflet，未使用 Google Maps / Gemini。
- `express`、`@types/express`、`dotenv` — 純前端應用，無 Node 伺服器入口（`package.json` 亦無 server 腳本）。
- `metadata.json` 宣告了 `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`，但程式中無任何 Gemini 呼叫。

---

## 3. 目錄結構

```
Code/
├── index.html                  # HTML 入口，掛載 #root
├── package.json                # 相依與 npm 腳本
├── tsconfig.json               # TypeScript 設定（bundler 模式、jsx: react-jsx）
├── vite.config.ts              # Vite 設定（React + Tailwind 外掛、env 注入、HMR 開關）
├── metadata.json               # AI Studio 應用中繼資料（名稱、描述、能力宣告）
├── README.md                   # AI Studio 樣板說明（執行步驟）
└── src/
    ├── main.tsx                # React 入口，StrictMode 渲染 <App/>
    ├── index.css               # 僅 `@import "tailwindcss";`
    ├── types.ts                # 全域 TypeScript 介面定義
    ├── data.ts                 # 種子資料（單車、泊位、回收站、夥伴、舉報、引導頁）
    ├── App.tsx                 # 根組件：狀態中樞、路由（tab）、佈局、持久化
    └── components/
        ├── Onboarding.tsx      # 首次啟動引導頁（3 頁輪播）
        ├── MapTab.tsx          # 地圖導航頁（Leaflet 整合，最大組件 ~868 行）
        ├── ReportTab.tsx       # 違規舉報與回收頁
        ├── NfcTab.tsx          # NFC 登記頁（3 步驟流程）
        ├── PersonalTab.tsx     # 個人中心與數據頁
        ├── MenuSidebar.tsx     # 行動版左側抽屜選單
        └── SettingsModal.tsx   # 設定彈窗（含資料重置）
```

---

## 4. 系統架構

### 4.1 整體架構

這是一個**無後端的客戶端應用**。所有「伺服器」行為（提交舉報、上傳 NFC 資料、導航計算）皆以 `setTimeout` 模擬延遲，資料僅存於記憶體與 `localStorage`。唯一的真實外部請求是**地圖圖磚**（向 CSDI / CartoDB / OSM / Esri 取得 tile 影像）。

```
┌──────────────────────────────────────────────────────────┐
│                        App.tsx                            │
│  （單一狀態中樞：bikes / reports / savedParkingIds /      │
│    userScore / currentTab / language）                     │
│                                                            │
│  ┌── useState 初始化（讀 localStorage 或 data.ts 種子）    │
│  └── useEffect ×7（每個 state 變動即寫回 localStorage）    │
└───────────────┬──────────────────────────────────────────┘
                │ props / callbacks 向下傳遞
    ┌───────────┼───────────┬───────────┬──────────────┐
    ▼           ▼           ▼           ▼              ▼
 MapTab     ReportTab    NfcTab    PersonalTab    MenuSidebar /
 (Leaflet)  (舉報/回收)  (NFC)     (個人/數據)     SettingsModal
    │
    ▼
 外部圖磚服務（CSDI / CartoDB / OSM / Esri、HK LandsD WMS）
```

### 4.2 狀態管理模式

- **單一資料來源**：所有跨頁共享狀態集中在 `App.tsx`，透過 props 與 callback 下傳，無使用 Context / Redux / Zustand。
- **持久化**：每個共享 state 各配一個 `useEffect`，於變動時 `JSON.stringify` 寫入對應 `localStorage` key。
- **頁面局部狀態**：表單輸入、彈窗開關、掃描動畫等僅存於各子組件 `useState`，不持久化。

### 4.3 LocalStorage Keys 一覽

| Key | 型別 | 預設值 | 寫入位置 |
|-----|------|--------|----------|
| `hk_bike_onboarding_done` | `"true"/"false"` | `false` | App.tsx |
| `hk_bike_registered_list` | `Bike[]` JSON | `INITIAL_BIKES` | App.tsx |
| `hk_bike_reports_history` | `Report[]` JSON | `INITIAL_REPORTS` | App.tsx |
| `hk_bike_saved_parking_spots` | `string[]` JSON | `['parking-1']` | App.tsx |
| `hk_bike_user_green_score` | `number` | `450` | App.tsx |
| `hk_bike_current_active_tab` | `string` | `'report'` | App.tsx |
| `hk_bike_display_language` | `'zh'/'en'` | `'zh'` | App.tsx |
| `HK_CSDI_API_KEY` | `string` | `''` | MapTab.tsx |
| `HK_BIKE_ENABLED_WMS_LAYERS` | `string[]` JSON | `['buildings','transportation']` | MapTab.tsx |

> **注意**：`SettingsModal` 的「重置」呼叫 `localStorage.clear()`，會一併清掉 MapTab 的兩個 key，但 `handleResetApplication` 只重設了 App 層的 state，未重設 MapTab 的 csdiKey / WMS 圖層（需重新整理頁面才會同步）。

---

## 5. 資料模型（`src/types.ts`）

```ts
interface Bike {            // 已登記單車
  id: string;
  model: string;            // 型號，如「城市通勤者」
  frameNo: string;          // 車架編號，如 HK-CITY-88392
  ownerName: string;
  nfcBound: boolean;        // 是否已綁定 NFC
}

interface Report {          // 違規／損壞舉報
  id: string;
  imageUrl?: string;        // 照片（base64 或預設 URL）
  location: string;
  description: string;
  status: 'pending' | 'resolved';
  date: string;             // YYYY-MM-DD
}

interface ParkingSpot {     // 單車泊位
  id: string;
  name: string;
  distance: string;         // 顯示字串，如「距離 400米」
  availableSlots: number;
  totalSlots: number;
  type: string;             // 泊架類型
  lat: number;
  lng: number;
}

interface RecycleStation {  // 回收站
  id; name; distance; logoUrl; logoAlt; contactNo;
}

interface EcoPartner {      // 環保合作夥伴
  id; name; rating; description; distance;
  imageUrl; imageAlt; address; services: string[];
}
```

### 種子資料規模（`src/data.ts`）
- `INITIAL_BIKES`：2 台
- `PARKING_SPOTS`：24 個泊位（含真實香港經緯度）
- `RECYCLE_STATIONS`：2 站
- `ECO_PARTNERS`：2 家
- `INITIAL_REPORTS`：3 筆
- `ONBOARDING_PAGES`：3 頁引導內容

---

## 6. 模組詳細設計

### 6.1 App.tsx（根組件）
- **職責**：狀態中樞、tab 切換（充當路由）、響應式佈局（桌面側欄／行動底部 dock）、localStorage 持久化、引導頁攔截。
- **關鍵 handler**：
  - `handleAddBike` — 新增單車並 `+50` 綠色積分。
  - `handleAddReport` — 新增舉報（status 預設 `pending`）並 `+50` 積分。
  - `toggleSaveParking` — 收藏／取消收藏泊位。
  - `handleResetApplication` — `localStorage.clear()` 並還原所有 state 至出廠值。
- **佈局**：`md:` 斷點切換——桌面顯示左側 80 寬導覽列；行動顯示頂部 App Bar ＋ 底部浮動 dock。頁面切換用 `AnimatePresence mode="wait"` 做淡入位移轉場。

### 6.2 Onboarding.tsx
- 3 頁輪播引導，支援「下一步 / 跳過 / 圓點跳頁」，最後一頁顯示「立即開始」。
- 完成後設 `hasCompletedOnboarding=true`，不再顯示。
- 用 motion `custom` direction 做左右滑動方向感知動畫。

### 6.3 MapTab.tsx（最複雜模組）
- **地圖引擎**：Leaflet，透過 `useRef` 管理 map / tileLayer / labelLayer / markers / polyline / WMS layers 實例，避免 React 重渲染重建地圖。
- **底圖主題**（4 種）：
  - `csdi-topographic` / `csdi-satellite`：香港地政總署官方圖磚（**需 CSDI API Key**）。
  - `cartodb`（預設，無需密鑰）、`osm`：開源退回方案；衛星無密鑰時退回 Esri World Imagery。
- **API Key 處理**：優先讀 `localStorage` → `process.env.CSDI_API_KEY` → `import.meta.env.VITE_CSDI_API_KEY`。無有效密鑰時自動降級為 CartoDB 並顯示提示卡。
- **OGC WMS 疊加圖層**（需密鑰）：建築物 / 交通運輸 / 興趣點 / 地段界線，四選多。
- **導航模擬**：`startNavigation` 以一連串 `setTimeout` 推進進度（25→60→90→100%）並更新語音指示文字，地圖繪製綠色虛線 polyline 並 `fitBounds`。
- **標記系統**：用 `L.divIcon` 注入自訂 HTML pin（含選中 / 滿位警示三態樣式）；`SPOT_COORDINATES` 為前 3 個泊位的覆寫座標，其餘用資料內 lat/lng。
- **搜尋**：依名稱或泊架類型即時過濾標記。

### 6.4 ReportTab.tsx
- **舉報表單**：照片上傳（`FileReader` 轉 base64；未上傳時點擊套用預設示意圖）、GPS 定位（在 4 個模擬地點間輪替）、描述必填、提交後 `setTimeout` 模擬上傳並彈出成功動畫（`+50` 積分）。
- **回收站**：水平捲動卡片，點「聯絡機構」開彈窗顯示電話。
- **環保夥伴**：卡片列表 + 詳情彈窗（地址、服務標籤、積分兌換說明）。
- **3 個彈窗**：回收站聯絡、夥伴詳情、查看全部回收站指南，皆用 `AnimatePresence` 管理。

### 6.5 NfcTab.tsx
- **3 步驟流程**：掃描標籤 → 輸入資料 → 上傳數據，頂部有進度指示器。
- **NFC 模擬**：點擊圓盤 `setTimeout 1.8s` 後標記成功並自動填入 mock 車款 / 車架號 / 車主。
- **QR 掃描**：`alert` 模擬並生成隨機車架號。
- 提交成功後彈窗顯示登記摘要，導向個人中心。

### 6.6 PersonalTab.tsx
- **使用者頭部**：頭像、等級徽章、綠色積分。
- **我的單車**：水平捲動卡片（NFC 綁定狀態圖示）＋「登記新單車」卡導向 NFC 頁；點卡開詳情彈窗可「解除綁定」。
- **Bento 數據網格**：收藏路線（固定 12）、收藏泊位（同步真實 count）、舉報紀錄（同步真實 count，含待核 / 已結辦）、減碳數據（依舉報數計算）。
- **設定列**：語言、通知、幫助與回饋，各自彈窗。
- **減碳計算**：`(12.5 + (reports.length - 3) * 0.5).toFixed(1)` kg。

### 6.7 MenuSidebar.tsx / SettingsModal.tsx
- `MenuSidebar`：行動版左側抽屜，導覽連結 + 分享 App（複製網址）+ 系統說明。
- `SettingsModal`：安全 / 高對比說明 + 本地資料重置（含 `window.confirm` 二次確認）。

---

## 7. 設計系統與 UI 規範

| 設計 token | 值 | 用途 |
|-----------|-----|------|
| 主色（品牌綠） | `#006b2c` | 按鈕、強調、選中態 |
| 主色 hover | `#005320` | 按鈕 hover |
| 背景底色 | `#fcf9f8` | App 外層背景 |
| 警示 / 滿位 | rose-500 系 | 滿位泊位、刪除 |
| 字型 | `font-sans`（系統字） | 全站 |
| 圓角 | `rounded-xl` ～ `rounded-3xl` | 卡片、彈窗、按鈕 |
| 響應式斷點 | Tailwind `md:`（768px） | 行動／桌面切換 |

- 動畫一律經 `motion/react`：頁面 `opacity + y` 位移、彈窗 `scale + opacity`、抽屜 `spring`。
- 圖示一律用 `lucide-react`，部分自繪 inline SVG（單車、人形）。

---

## 8. 建構與執行

### 前置需求
- Node.js（建議 18+）

### 安裝與啟動
```bash
npm install
npm run dev        # Vite dev server，http://0.0.0.0:3000
```

### npm 腳本
| 腳本 | 指令 | 說明 |
|------|------|------|
| `dev` | `vite --port=3000 --host=0.0.0.0` | 開發伺服器 |
| `build` | `vite build` | 產出 production 靜態檔至 `dist/` |
| `preview` | `vite preview` | 預覽打包結果 |
| `lint` | `tsc --noEmit` | 型別檢查 |
| `clean` | `rm -rf dist server.js` | 清理產物 |

### 環境變數
| 變數 | 用途 | 注入方式 |
|------|------|----------|
| `CSDI_API_KEY` | 地政總署 CSDI 地圖密鑰 | `vite.config.ts` 經 `define` 注入 `process.env` |
| `VITE_CSDI_API_KEY` | 同上（Vite 慣例） | `import.meta.env` |
| `GOOGLE_MAPS_PLATFORM_KEY` | 已注入但未使用 | `vite.config.ts` |
| `GEMINI_API_KEY` | README 提及但程式未使用 | — |
| `DISABLE_HMR` | AI Studio 用於停用熱更新 | `vite.config.ts` |

> 使用者亦可在地圖頁的「CSDI 設定」面板手動輸入密鑰，存入 `localStorage`。

---

## 9. 已知問題與技術債

| 嚴重度 | 位置 | 問題 |
|--------|------|------|
| 🔴 Bug | `NfcTab.tsx:239` | 成功彈窗按鈕 class 為 `py-32`（疑為 `py-3` 筆誤），造成按鈕異常巨大。 |
| 🟡 一致性 | `App.tsx` ↔ `MapTab.tsx` | 重置應用未清除 MapTab 的 `csdiKey` / WMS state（`localStorage.clear()` 清了儲存但記憶體 state 未同步，需刷新）。 |
| 🟡 i18n | 全站 | 語言狀態 `zh/en` 已建立，但除標題外文案未實際翻譯，切 en 大部分仍顯示中文。 |
| 🟡 假數據 | `PersonalTab.tsx:144` | 「收藏路線」固定寫死 12，未與真實狀態連動。 |
| 🟢 體積 | `package.json` | 多個未使用相依（genai / google-maps / express / dotenv）可移除。 |
| 🟢 中繼資料 | `metadata.json` | 宣告 Gemini server capability 但無對應實作。 |
| 🟢 安全 | `MapTab.tsx` | CSDI 密鑰以明文存於 `localStorage` 並附在 tile URL query string（原型可接受，正式上線需檢視）。 |
| 🟢 文件 | `README.md` / `index.html` | 仍為 AI Studio 樣板（標題 "My Google AI Studio App"、README 提 Gemini），與實際應用不符。 |

---

## 10. 後續建議

1. **修正 `py-32` 按鈕 bug**（最快可改）。
2. **清理未使用相依**並更新 `metadata.json` / `README.md` / `<title>` 以反映真實應用。
3. **補完 i18n**：若 en 為需求，建立文案字典並全站套用 `language`。
4. **狀態管理升級**：頁面增多時，可將共享狀態抽至 Context 或輕量 store，減少 prop drilling。
5. **接入真實後端**：目前所有提交皆為模擬；若要落地，需設計 API 與資料庫並替換 `setTimeout` 流程。
6. **重置一致性**：將 MapTab 的密鑰 / 圖層 state 納入統一重置流程。
7. **加入測試**：目前無任何測試；建議至少為 `data.ts` 與核心 handler 加單元測試。

---

*本文件依據 2026-06-27 之原始碼快照產生，如程式碼更新請同步維護。*
