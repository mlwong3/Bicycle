# 騎跡 Bike Trace

香港智能單車管理與綠色出行展示應用，支援運輸署單車開放數據、NFC 登記、違規舉報、回收資訊、個人單車管理及減碳數據追蹤。

## 核心功能

- 地圖泊位及單車徑：使用運輸署 CSDI ArcGIS REST 開放數據。
- NFC 登記：支援 Android Chrome Web NFC，其他裝置使用 QR / 模擬流程作展示 fallback。
- 輕量 Firebase 後端：以 Firebase Authentication 匿名登入及 Firestore 同步單車、NFC 標籤、舉報及騎乘紀錄。
- 本機 fallback：Firebase 未設定時仍可使用 localStorage 保存展示資料。
- 減碳估算：以香港官方無鉛汽油排放係數換算單車取代汽車行程的 CO2 減排。

## 本機執行

前置需求：Node.js 20 或以上。

```bash
npm install
npm run dev
```

開發伺服器預設：

```text
http://localhost:3000
```

## Firebase 設定

1. 在 Firebase Console 建立或使用 `bicycle-ee76c` 專案。
2. 啟用 Authentication 的 Anonymous sign-in。
3. 啟用 Cloud Firestore。
4. 複製 `.env.example` 為 `.env.local`，填入 Firebase Web App 設定。
5. 如要部署 Firestore 規則，使用 `firebase deploy --only firestore`。

`.env.local` 需要以下欄位：

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Firebase 未設定時，App 會自動使用本機 localStorage fallback。

## 部署

GitHub Pages 和 Firebase Hosting 可並行使用。

```bash
npm run build
```

Firebase Hosting 發佈目錄為 `dist`，設定見 `firebase.json`。

## 注意事項

- Web NFC 僅 Android Chrome 89+ 支援，且需要 HTTPS 和使用者手勢觸發。
- NFC 實物展示建議只寫入 `tagId`、`bikeId`、`frameNo`、App URL，不寫入真實學生姓名或個人敏感資料。
- CSDI 地圖 API Key 可透過環境變數或 App 內設定面板輸入。
